/**
 * scale-tare-store.js — the one caller of `PUT /api/v1/scale/tare`, and the only place
 * that decides whether a tare actually happened.
 *
 * Ben, 23 Aug 2026: "with slate, if you tough the weight value it sends the tare command
 * to the machine resetting the weigh to 0.0g".
 *
 * ===========================================================================
 * A 200 IS NOT A TARE, AND THAT IS THE WHOLE OF THIS FILE
 * ===========================================================================
 * TWO refusals sit behind this route and only one of them answers.
 *
 *   REAPRIME REFUSES VISIBLY. `scale_handler.dart` returns 400 with
 *   `{type: 'block_tare_during_shot'}` when `blockTareDuringShot` is set, a shot is
 *   active and the gateway is not in full mode. That is a real answer and it is
 *   reported as a refusal, in the machine's own words.
 *
 *   THE FIRMWARE REFUSES SILENTLY. `doLCTare()` returns early while a shot runs — a
 *   mid-pour re-zero moves the mass reference under the running shot and stop-at-weight
 *   would over-deliver — and it says so only on its own serial console. The MMR write
 *   still succeeds, so ReaPrime answers 200 and the client learns nothing.
 *
 * Slate shipped exactly that bug and fixed it (`f813dea`): it awaited the write and
 * toasted "Scale tared" over a refusal. Its answer, and this one, is reaprime's own
 * advice in `integrated_scale_capability`: A TARE MUST BE CONFIRMED BY WATCHING THE
 * WEIGHT, NOT THE FLAG. So the request is only the first half; the second half watches
 * the scale feed settle near zero, and on timeout NAMES THE LIKELY CAUSE rather than
 * reporting a bare failure.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it does not read the shot state to predict a
 * refusal. Predicting is how Slate's B10 defect worked — re-implementing the server's
 * rule in the client, where it drifts. The machine decides; this watches.
 */

import { createStore } from './store.js';
import { callRoute } from '../data/rea-routes.js';

/** Where a tare attempt is. */
export const TARE_STATUS = Object.freeze({
    IDLE: 'idle',
    /** The request is out, or the weight is being watched. */
    WORKING: 'working',
    /** The weight settled near zero — the only evidence a tare took. */
    DONE: 'done',
    /** The machine said no, in words this can quote. */
    REFUSED: 'refused',
    /** No refusal and no zero: the request went out and nothing moved. */
    UNCONFIRMED: 'unconfirmed',
    /** The route itself failed. */
    ERROR: 'error',
});

/**
 * How near zero counts as tared. A settled platform reads a few hundredths; a cup that
 * has not moved reads its own mass. Half a gram is well inside the first and nowhere
 * near the second — the same threshold Slate uses to detect the boundary tare in a shot
 * series, for the same reason.
 */
export const TARE_ZERO_G = 0.5;

/** How long to watch before giving up. Long enough for a scale's own settle. */
export const TARE_CONFIRM_MS = 2500;

const NO_ATTEMPT = Object.freeze({
    status: TARE_STATUS.IDLE,
    /** The machine's own words when it refused, or null. */
    refusal: null,
    /** A transport or handler failure, or null. */
    error: null,
    /** The weight the watch last saw, so a caller can say what it settled at. */
    weight: null,
});

/**
 * @param deps.transport  the shared transport — the route is addressed by ID, never spelled
 * @param deps.scale      the SCALE FEED store, watched to confirm. Injected rather than
 *                        reached for: this store owns no feed and starts nothing.
 * @param {Function} [deps.setTimer]    injected one-shot timer (see below)
 * @param {Function} [deps.clearTimer]  its cancel
 *
 * THE TIMER IS INJECTED, WHICH IS PATTERN A. "A store that starts its own timer outlives
 * whatever wanted it" — the store suite scans this directory for scheduling calls and
 * allows only lines a file has DECLARED, which is how the rule stays enforced rather than
 * remembered. The confirm window needs a deadline (a scale that never answers must not
 * leave the surface stuck on WORKING), so the deadline is a parameter and a caller under
 * test can drive it without a real clock.
 */
export function createScaleTareStore({
    transport,
    scale,
    logger = null,
    now = () => Date.now(),
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (id) => clearTimeout(id),
} = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createScaleTareStore: a transport must be injected');
    }
    if (!scale || typeof scale.subscribe !== 'function') {
        throw new Error('createScaleTareStore: the scale feed must be injected — a tare is '
            + 'confirmed by watching the weight, not by the route answering');
    }

    const store = createStore(NO_ATTEMPT);
    const log = logger && typeof logger.scope === 'function' ? logger.scope('scale-tare') : logger;
    let inFlight = null;

    const patch = (next) => store.set(Object.freeze({ ...store.get(), ...next }));

    /** The weight the scale feed is publishing, or null when it is saying nothing. */
    const weightNow = () => {
        const state = scale.get();
        const value = state && state.value ? state.value.weight : null;
        return typeof value === 'number' && Number.isFinite(value) ? value : null;
    };

    /**
     * Watch until the weight is near zero, or until the budget runs out.
     *
     * Subscribes rather than polls: the feed publishes on every frame, so the first
     * settled reading answers immediately instead of on the next tick of a timer.
     */
    const confirm = () => new Promise((resolve) => {
        const started = now();
        let stop = null;
        let timer = null;
        const finish = (settled, weight) => {
            if (stop) stop();
            if (timer !== null) clearTimer(timer);
            resolve({ settled, weight });
        };
        const look = () => {
            const weight = weightNow();
            if (weight !== null && Math.abs(weight) <= TARE_ZERO_G) finish(true, weight);
            else if (now() - started >= TARE_CONFIRM_MS) finish(false, weight);
        };
        stop = scale.subscribe(look);
        timer = setTimer(() => finish(false, weightNow()), TARE_CONFIRM_MS);
        look();
    });

    const api = Object.freeze({
        subscribe: store.subscribe,
        get: store.get,

        /**
         * Ask the machine to tare, then find out whether it did.
         *
         * Concurrent presses join one attempt: a second tare on top of a first tells the
         * machine nothing new and would race its own confirmation.
         */
        async tare() {
            if (inFlight) return inFlight;
            patch({ status: TARE_STATUS.WORKING, refusal: null, error: null, weight: null });

            inFlight = (async () => {
                const result = await callRoute(transport, 'putScaleTare', { method: 'PUT' });

                if (!result.ok) {
                    /* THE VISIBLE REFUSAL. `problem.type` is the handler's own word for
                     * it; the message is what a person should read. */
                    const problem = result.problem ?? null;
                    if (result.status === 400) {
                        const refusal = Object.freeze({
                            type: problem && problem.type ? problem.type : null,
                            message: (problem && (problem.details ?? problem.message))
                                ?? result.message ?? null,
                        });
                        if (log) log.info(`tare refused: ${refusal.type ?? 'no type'}`);
                        return patch({ status: TARE_STATUS.REFUSED, refusal });
                    }
                    if (log) log.warn(`tare failed: ${result.message}`);
                    return patch({ status: TARE_STATUS.ERROR, error: result });
                }

                /* THE 200 PROVES ONLY THAT THE WRITE LANDED. Watch the weight. */
                const { settled, weight } = await confirm();
                return patch({
                    status: settled ? TARE_STATUS.DONE : TARE_STATUS.UNCONFIRMED,
                    weight,
                });
            })().finally(() => { inFlight = null; });

            return inFlight;
        },

        /** Put the surface back to rest once a screen has shown the answer. */
        clear() { return store.set(NO_ATTEMPT); },
    });

    return api;
}
