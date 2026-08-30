/**
 * calibration-store.js — D9's two calibration surfaces, over four routes.
 * Wave 5.4, row `d9-calibration-surfaces`.
 *
 * SCOPE Part 5 §4: "**D9 (accepted): calibration** — expose the flow-calibration factor;
 * rebuild the load-cell wizard (proven and used)." Part 1: "the load-cell flow is a thin
 * client over `PUT /api/v1/machine/scaleCalibration`".
 *
 * ONE STORE, ONE SUBJECT, FOUR ROUTES — the shape `src/stores/cup-warmer.js` already has
 * (it owns four cup-warmer routes). Calibration is one thing the user came to do, and
 * splitting it in two would make the leaf assemble a subject the data layer refused to.
 *
 * ===========================================================================
 * CB-15 — THE FIVE-WAY MISMATCH THIS REPLACES
 * ===========================================================================
 *
 * Part 6, REPLACE-WITH-REAPRIME, `loadcell-cal.js` (72 lines): "Written against an API
 * that has never existed in the repo — wrong path, wrong verb, wrong command set, wrong
 * body key, wrong response model, and a two-point left/right flow the machine replaced
 * with a single latch plus auto-detection."
 *
 *   the old skin           the machine, at pin 2b047d02
 *   POST /machine/scale/calibrate      PUT  /api/v1/machine/scaleCalibration
 *   {command: zero|left|right}         {command: 'abort'|'zero'|'latch'}
 *   {grams: n}                         {weightGrams: num, 1..10000, latch only}
 *   a flat reply                       202 {status,state} / 409 {status,reason,state}
 *   two points (left, right)           ONE latch; the machine detects the cell itself
 *
 * `detectedCell` (`none` | `a` | `b`) IS that auto-detection, and it is why there is no
 * left/right anywhere in this file: the machine says which cell the weight landed on.
 *
 * ===========================================================================
 * THE STATE IS THE MACHINE'S, IN EVERY RESPONSE
 * ===========================================================================
 *
 * The contract row's gate reads: "both the 202 and the 409 carry the full calibration
 * state / drive the wizard from `state`; never keep a second copy of the phase in the
 * client." So every command's reply is READ FOR ITS STATE, refusal included — a 409
 * ("machine busy or shot in progress") updates the wizard exactly as an acceptance does,
 * because the machine described itself either way.
 *
 * `ScaleCalibrationState` (`lib/src/models/device/scale_calibration.dart:90`) is five
 * fields and this store carries all five verbatim:
 *
 *   step            idle | zeroing | calLatch | taring | complete | error
 *   detectedCell    none | a | b                     <- the auto-detection
 *   subState        settling | averaging | done | error
 *   secondsRemaining  int                            <- THE LIVE COUNTDOWN
 *   status          ok | incomplete | noZero | notSettled | badWeight | badDelta
 *                   | illConditioned | outOfRange | notIsolated  (+ `none`, the 0xFF
 *                   sentinel for "nothing has run")
 *
 * THE NINE-VALUE DIAGNOSTIC STATUS IS THE POINT OF THE REBUILD. The old skin showed a
 * generic HTTP error where the machine had said `badDelta` — "the two cells disagree" —
 * and the user had no way to learn that. All nine cross this layer as data; the sentence
 * each one becomes is the leaf's (D2: English copy through `t()`).
 *
 * ===========================================================================
 * THE ONE TIMER IN THIS CLUSTER, AND IT IS NOT THE LED PATH
 * ===========================================================================
 *
 * `secondsRemaining` counts down inside the machine, so a LIVE countdown means re-reading
 * `GET /api/v1/machine/scaleCalibration`. That is a poll, and a poll needs a clock.
 *
 * It is injected, exactly as `shot-mirror.js` injects its two deadlines and for the same
 * stated reason, and it is disarmed by construction: the loop arms itself only while the
 * machine reports `zeroing` or `calLatch` (`ScaleCalibrationState.isInProgress`), and a
 * terminal or idle step stops it dead. The interval defaults to the countdown's own unit
 * — one second — so it is a resolution, not a tuned magic number.
 *
 * THIS IS NOT D7's PATH. The screen law's "no timer at all" is the LED preview write path
 * (`led-strip-store.js`, which contains no clock of any kind and is grepped for four
 * spellings by the suite). A calibration read poll is a different mechanism on a
 * different route answering a different question, and conflating the two would leave the
 * countdown frozen at whatever number the last command happened to return.
 *
 * ===========================================================================
 * THE FLOW-CALIBRATION FACTOR — a SECOND pair of routes, adopted here
 * ===========================================================================
 *
 * GET / POST `/api/v1/machine/calibration`, `{flowMultiplier}` — `de1handler.dart:464`
 * and `:472` at the pin — re-anchored 21 Aug, where the row and this header both cited
 * `:463`/`:471`, which are blank lines. They were in the generated table with NO contract
 * row, because nothing addressed them; this store is the consumer that gives them one.
 *
 * A CORRECTION TO A NEIGHBOUR'S NOTE, recorded rather than left: the registry's pending
 * row for `calibration-flow-multiplier` named "GET/PUT /api/v1/machine/scaleCalibration"
 * as its owner. That is the LOAD-CELL route; the flow multiplier is the pair above. The
 * pending row is retired by this wave and the row it becomes is a stepper on #29.
 *
 * NO DOM. Every path comes from the generated route table by id; none is spelled here.
 */

import { callRoute } from '../data/rea-routes.js';
import { createStore } from './store.js';

const NOOP_LOGGER = Object.freeze({ debug() {}, info() {}, warn() {}, error() {} });

/** `ScaleCalibrationStep`, in wire order (`scale_calibration.dart:1-18`). */
export const CAL_STEP = Object.freeze({
    IDLE: 'idle',
    ZEROING: 'zeroing',
    CAL_LATCH: 'calLatch',
    TARING: 'taring',
    COMPLETE: 'complete',
    ERROR: 'error',
});

/** `ScaleCalibrationSubState` (`:20-35`). */
export const CAL_SUBSTATE = Object.freeze({
    SETTLING: 'settling',
    AVERAGING: 'averaging',
    DONE: 'done',
    ERROR: 'error',
});

/**
 * `ScaleCalibrationStatus` (`:37-58`) — the NINE, plus the never-run sentinel.
 *
 * Frozen as a LIST because the leaf's job is to have a sentence for each and the suite's
 * job is to assert it has nine of them. A status the machine grows and this list does not
 * have reads as unknown at the leaf rather than as `ok`.
 */
export const CAL_STATUS = Object.freeze([
    'ok', 'incomplete', 'noZero', 'notSettled', 'badWeight',
    'badDelta', 'illConditioned', 'outOfRange', 'notIsolated',
]);

/** The 0xFF sentinel. "Nothing has run", never "everything is fine". */
export const CAL_STATUS_NONE = 'none';

/** `ScaleCalibrationCell` (`:60-74`) — the auto-detection's answer. */
export const CAL_CELL = Object.freeze(['none', 'a', 'b']);

/** The three commands the handler accepts. Anything else is a documented 400. */
export const CAL_COMMAND = Object.freeze({ ABORT: 'abort', ZERO: 'zero', LATCH: 'latch' });

/** What this store knows about the load cells. */
export const CAL_LOAD = Object.freeze({
    NOT_LOADED: 'notLoaded',
    READY: 'ready',
    /** 404 — `_bengleFirmwareGate(de1, 'scaleCalibration')`. The wizard must not render. */
    UNSUPPORTED: 'unsupported',
    /** The request never landed, or the body was not a state. */
    UNAVAILABLE: 'unavailable',
});

/** Why a command did not take. `REJECTED` is the machine's own 409. */
export const CAL_REFUSAL = Object.freeze({
    REJECTED: 'rejected',
    BAD_REQUEST: 'badRequest',
    UNSUPPORTED: 'unsupported',
    FAILED: 'failed',
});

const UNKNOWN_STATE = Object.freeze({
    step: CAL_STEP.IDLE,
    detectedCell: 'none',
    subState: CAL_SUBSTATE.SETTLING,
    secondsRemaining: 0,
    status: CAL_STATUS_NONE,
});

const EMPTY = Object.freeze({
    load: CAL_LOAD.NOT_LOADED,
    /** The machine's own five fields, or null when nothing has been read. */
    state: null,
    /** The last refusal, with the machine's `reason` where it gave one. */
    refusal: null,
    reason: null,
    /** The flow-calibration factor, or null. A separate route, a separate absence. */
    flowMultiplier: null,
    flowLoaded: false,
    version: 0,
});

/** In progress exactly as ReaPrime defines it (`scale_calibration.dart:101-103`). */
export const isCalibrationInProgress = (state) => !!state
    && (state.step === CAL_STEP.ZEROING || state.step === CAL_STEP.CAL_LATCH);

/** Terminal exactly as ReaPrime defines it (`:105-107`). */
export const isCalibrationTerminal = (state) => !!state
    && (state.step === CAL_STEP.COMPLETE || state.step === CAL_STEP.ERROR);

/**
 * Read a `ScaleCalibrationState.toJson` body. Every field required, as the generated
 * table declares (`requiredKeys: [step, detectedCell, subState, secondsRemaining,
 * status]`); a body missing one is not a state and reads as null rather than as defaults.
 */
export function readCalibrationState(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    const { step, detectedCell, subState, secondsRemaining, status } = body;
    if (typeof step !== 'string' || typeof detectedCell !== 'string'
        || typeof subState !== 'string' || typeof status !== 'string'
        || !Number.isFinite(secondsRemaining)) return null;
    return Object.freeze({
        step, detectedCell, subState, status,
        secondsRemaining: Math.max(0, Math.trunc(secondsRemaining)),
    });
}

/**
 * @param {object} deps
 * @param {object} deps.transport          `createReaTransport(...)`
 * @param {object} [deps.logger]
 * @param {number} [deps.pollMs]           the countdown's resolution, not a tuned number
 * @param {Function} [deps.setTimer]       injected one-shot timer (see the header)
 * @param {Function} [deps.clearTimer]
 */
export function createCalibrationStore({
    transport,
    logger = NOOP_LOGGER,
    pollMs = 1000,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (id) => clearTimeout(id),
} = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createCalibrationStore: a transport must be injected (see createReaTransport)');
    }
    const log = logger.scope ? logger.scope('calibration') : logger;
    const store = createStore({ ...EMPTY }, { label: 'calibration', logger: log, freeze: false });

    let ticket = null;
    let stopped = false;

    const publish = (patch) => store.set({ ...store.get(), ...patch, version: store.get().version + 1 });

    /** Disarm. Called on every terminal state, every failure and every teardown. */
    function disarm() {
        if (ticket !== null) clearTimer(ticket);
        ticket = null;
    }

    /**
     * Arm the countdown poll, but ONLY while the machine says it is working.
     *
     * One-shot, re-armed by the read it schedules — never `setInterval`, so a slow read
     * cannot stack requests behind itself.
     */
    function arm(state) {
        disarm();
        if (stopped || !isCalibrationInProgress(state)) return;
        ticket = setTimer(() => { ticket = null; void api.read(); }, pollMs);
    }

    /** Take a state from any reply that carries one, and re-arm from what it says. */
    function absorb(body, patch = {}) {
        const state = readCalibrationState(body);
        if (state === null) return null;
        publish({ load: CAL_LOAD.READY, state, ...patch });
        arm(state);
        return state;
    }

    const api = {
        subscribe: (listener) => store.subscribe(listener),
        get: () => store.get(),

        /** The machine's five fields, or null. */
        state: () => store.get().state,

        /** True while the machine reports it is working. */
        get busy() { return isCalibrationInProgress(store.get().state); },

        /* ---- the load cells --------------------------------------------- */

        /**
         * Read the calibration state. 404 is the feature gate — hide the wizard.
         */
        async read() {
            const result = await callRoute(transport, 'getMachineScaleCalibration');
            if (!result.ok) {
                disarm();
                const load = result.status === 404 ? CAL_LOAD.UNSUPPORTED : CAL_LOAD.UNAVAILABLE;
                log.info(`scaleCalibration read: ${load} (${result.status ?? 'no status'})`);
                return publish({ load, state: null });
            }
            if (absorb(result.data) === null) {
                disarm();
                log.warn('scaleCalibration answered a body that is not a state');
                return publish({ load: CAL_LOAD.UNAVAILABLE, state: null });
            }
            return store.get();
        },

        /**
         * Send one command and take the state out of whatever comes back.
         *
         * `weightGrams` travels ONLY with `latch`, which is what the handler documents
         * ("REQUIRED when command=='latch', ignored otherwise") — sending it with the
         * others would be a body field the handler discards, and a caller reading this
         * later would reasonably think it meant something.
         */
        async command(command, weightGrams = null) {
            const body = command === CAL_COMMAND.LATCH
                ? { command, weightGrams }
                : { command };
            const result = await callRoute(transport, 'putMachineScaleCalibration', { body });

            if (result.ok) {
                absorb(result.data && result.data.state, { refusal: null, reason: null });
                return Object.freeze({ ok: true, refusal: null, reason: null });
            }

            /* A 409 IS A DESCRIPTION, NOT A DEAD END. The handler answers
             * {status:'rejected', reason, state} and the state in it is current — so the
             * wizard updates from a refusal exactly as it does from an acceptance. */
            const problem = result.problem && typeof result.problem === 'object' ? result.problem : null;
            if (result.status === 409) {
                absorb(problem && problem.state);
                const reason = problem && typeof problem.reason === 'string' ? problem.reason : null;
                publish({ refusal: CAL_REFUSAL.REJECTED, reason });
                return Object.freeze({ ok: false, refusal: CAL_REFUSAL.REJECTED, reason });
            }
            disarm();
            const refusal = result.status === 404
                ? CAL_REFUSAL.UNSUPPORTED
                : (result.status === 400 ? CAL_REFUSAL.BAD_REQUEST : CAL_REFUSAL.FAILED);
            if (refusal === CAL_REFUSAL.UNSUPPORTED) publish({ load: CAL_LOAD.UNSUPPORTED, state: null });
            const reason = problem && typeof problem.error === 'string' ? problem.error : null;
            publish({ refusal, reason });
            log.warn(`scaleCalibration ${command} refused: ${result.status ?? 'no status'}`);
            return Object.freeze({ ok: false, refusal, reason });
        },

        /** The three, named. Nothing above this store spells a command string. */
        zero: () => api.command(CAL_COMMAND.ZERO),
        latch: (weightGrams) => api.command(CAL_COMMAND.LATCH, weightGrams),
        abort: () => api.command(CAL_COMMAND.ABORT),

        /* ---- the flow-calibration factor --------------------------------- */

        /** `GET /api/v1/machine/calibration` -> `{flowMultiplier}`. */
        async readFlow() {
            const result = await callRoute(transport, 'getMachineCalibration');
            if (!result.ok) {
                log.info(`flow calibration read failed: ${result.status ?? 'no status'}`);
                return publish({ flowLoaded: true, flowMultiplier: null });
            }
            const value = result.data && typeof result.data === 'object'
                ? result.data.flowMultiplier
                : null;
            return publish({
                flowLoaded: true,
                flowMultiplier: Number.isFinite(value) ? value : null,
            });
        },

        /**
         * `POST /api/v1/machine/calibration` with `{flowMultiplier}`.
         *
         * The handler answers `jsonAccepted()` — 202 with a NULL body and a JSON content
         * type — so there is nothing to read back and the value is re-read rather than
         * assumed. A write is a request; the machine is the owner.
         */
        async writeFlow(flowMultiplier) {
            if (!Number.isFinite(flowMultiplier)) return false;
            const result = await callRoute(transport, 'postMachineCalibration', {
                body: { flowMultiplier },
            });
            if (!result.ok) {
                log.warn(`flow calibration write refused: ${result.status ?? 'no status'}`);
                return false;
            }
            await api.readFlow();
            return true;
        },

        /** The machine went away. */
        forget() {
            disarm();
            store.set({ ...EMPTY });
        },

        stop() {
            stopped = true;
            disarm();
            store.destroy();
        },
    };

    return api;
}
