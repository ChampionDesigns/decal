/**
 * The one caller of PUT /api/v1/scale/tare, and the only place that decides whether a tare actually happened.
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
