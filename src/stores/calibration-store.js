/**
 * The two calibration surfaces, over four routes.
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

        async command(command, weightGrams = null) {
            const body = command === CAL_COMMAND.LATCH
                ? { command, weightGrams }
                : { command };
            const result = await callRoute(transport, 'putMachineScaleCalibration', { body });

            if (result.ok) {
                absorb(result.data && result.data.state, { refusal: null, reason: null });
                return Object.freeze({ ok: true, refusal: null, reason: null });
            }

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
