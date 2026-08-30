/**
 * The cup-warmer store — ReaPrime's registers, read as served.
 */

import { createStore } from './store.js';
import { ABSENCE, isNoReading, readNumber, readValue } from '../data/reading.js';

export const CUP_WARMER_STATUS = Object.freeze({
    LOADING: 'loading',
    READY: 'ready',
    ERROR: 'error',
    UNSUPPORTED: 'unsupported',
});

export const PREHEAT_WARNING = Object.freeze({
    NO_SETPOINT: 'noSetpoint',
    NO_SCHEDULE: 'noSchedule',
});

/** The two capability names this store gates on. ReaPrime's spelling, not ours. */
export const CUP_WARMER_CAPABILITY = 'cupWarmer';
export const PREHEAT_CAPABILITY = 'preheat';

const NOOP_LOGGER = Object.freeze({ debug() {}, info() {}, warn() {}, error() {} });

export function readWarmer(data) {
    if (!data || typeof data !== 'object') return null;
    return Object.freeze({
        temperature: readNumber(data, 'temperature', ABSENCE.NO_SOURCE),
        enabled: readValue(data, 'enabled', ABSENCE.NO_SOURCE),
        currentTemperature: readNumber(data, 'currentTemperature', ABSENCE.NO_SOURCE),
    });
}

export function readPreheat(data) {
    if (!data || typeof data !== 'object') return null;
    return Object.freeze({
        enabled: readValue(data, 'enabled', ABSENCE.NO_SOURCE),
        leadMinutes: readNumber(data, 'leadMinutes', ABSENCE.NO_SOURCE),
        active: readValue(data, 'active', ABSENCE.NO_SOURCE),
    });
}

export function isWarmerOn(warmer) {
    if (!warmer) return null;
    if (warmer.enabled === true || warmer.enabled === false) return warmer.enabled;
    return null;
}

/**
 * Does the warmer have a working setpoint? The wire reserves 0 for "no heat", and the
 * pre-heat gate needs a positive setpoint as well as the enable.
 *
 * @returns {boolean|null} null when unknown.
 */
export function hasSetpoint(warmer) {
    if (!warmer || isNoReading(warmer.temperature)) return null;
    return warmer.temperature > 0;
}

export function hasEnabledWakeSchedule(schedules) {
    if (!Array.isArray(schedules)) return null;
    return schedules.some((entry) => entry && entry.enabled !== false);
}

export function preheatWarnings({ preheat, warmer, schedules } = {}) {
    if (!preheat || preheat.enabled !== true) return [];
    const warnings = [];
    const on = isWarmerOn(warmer);
    const setpoint = hasSetpoint(warmer);
    if (on === false || setpoint === false) warnings.push(PREHEAT_WARNING.NO_SETPOINT);
    if (hasEnabledWakeSchedule(schedules) === false) warnings.push(PREHEAT_WARNING.NO_SCHEDULE);
    return warnings;
}

/** The state a store starts in and returns to on `invalidate()`. Frozen; never mutated. */
export function emptyCupWarmerState() {
    return Object.freeze({
        status: CUP_WARMER_STATUS.LOADING,
        supported: null,
        preheatSupported: null,
        warmer: null,
        preheat: null,
        schedules: null,
        warnings: Object.freeze([]),
        error: null,
        preheatError: null,
        refreshing: false,
        pending: 0,
        fetchedAt: null,
    });
}

export function createCupWarmerStore({
    routes,
    readCapabilities = null,
    readSchedules = null,
    logger = NOOP_LOGGER,
    now = () => Date.now(),
} = {}) {
    for (const helper of ['cupWarmer', 'setCupWarmer', 'cupWarmerPreheat', 'setCupWarmerPreheat']) {
        if (!routes || typeof routes[helper] !== 'function') {
            throw new Error(`createCupWarmerStore: routes.${helper}() must be injected`);
        }
    }
    const log = logger.scope ? logger.scope('cupWarmer') : logger;
    const state = createStore(emptyCupWarmerState(), { label: 'cupWarmer', logger: log });

    /** Return-new-state, always: `patch` is folded into a fresh frozen object. */
    function publish(patch) {
        const next = Object.freeze({ ...state.get(), ...patch });
        state.set(next);
        return next;
    }

    /** The state a fetch could not produce: everything absent, nothing invented. */
    const featureAbsent = () => ({
        status: CUP_WARMER_STATUS.UNSUPPORTED,
        supported: false,
        preheatSupported: false,
        warmer: null,
        preheat: null,
        schedules: null,
        warnings: Object.freeze([]),
        error: null,
        preheatError: null,
        refreshing: false,
        fetchedAt: now(),
    });

    async function capabilities() {
        if (typeof readCapabilities !== 'function') return null;
        const list = await readCapabilities();
        return Array.isArray(list) ? list : null;
    }

    let scheduleReader = typeof readSchedules === 'function' ? readSchedules : null;

    async function schedules() {
        if (typeof scheduleReader !== 'function') return null;
        const list = await scheduleReader();
        return Array.isArray(list) ? list : null;
    }

    const store = {
        /** The current frame. Frozen; a consumer cannot patch a plausible value onto it. */
        get() {
            return state.get();
        },

        useSchedules(reader) {
            scheduleReader = typeof reader === 'function' ? reader : null;
        },

        /** Subscribe; fires immediately with the last frame, then on every change. */
        subscribe(listener) {
            return state.subscribe(listener);
        },

        async refresh() {
            publish({ refreshing: true });

            const caps = await capabilities();
            if (caps && !caps.includes(CUP_WARMER_CAPABILITY)) {
                log.debug('the machine does not list the cup warmer — no fetch');
                return publish(featureAbsent());
            }

            const result = await routes.cupWarmer();
            if (!result.ok) {
                if (result.status === 404) {
                    return publish(featureAbsent());
                }
                log.error('cup-warmer read failed', result);
                return publish({
                    status: CUP_WARMER_STATUS.ERROR,
                    error: result,
                    refreshing: false,
                });
            }

            const warmer = readWarmer(result.data);
            const wantPreheat = !caps || caps.includes(PREHEAT_CAPABILITY);
            let preheat = null;
            let preheatSupported = wantPreheat ? null : false;
            let preheatError = null;

            if (wantPreheat) {
                const preheatResult = await routes.cupWarmerPreheat();
                if (preheatResult.ok) {
                    preheat = readPreheat(preheatResult.data);
                    preheatSupported = true;
                } else if (preheatResult.status === 404) {
                    preheatSupported = false;
                } else {
                    log.error('pre-heat read failed', preheatResult);
                    preheatError = preheatResult;
                }
            }

            const wakeSchedules = await schedules();
            return publish({
                status: CUP_WARMER_STATUS.READY,
                supported: true,
                preheatSupported,
                warmer,
                preheat,
                schedules: wakeSchedules,
                warnings: Object.freeze(preheatWarnings({ preheat, warmer, schedules: wakeSchedules })),
                error: null,
                preheatError,
                refreshing: false,
                fetchedAt: now(),
            });
        },

        setEnabled(enabled) {
            return write(() => routes.setCupWarmer({ enabled: Boolean(enabled) }));
        },

        setTarget(celsius, { enabled } = {}) {
            const body = { temperature: celsius };
            if (enabled === true || enabled === false) body.enabled = enabled;
            return write(() => routes.setCupWarmer(body));
        },

        setPreheat({ enabled, leadMinutes } = {}) {
            const body = {};
            if (enabled === true || enabled === false) body.enabled = enabled;
            if (typeof leadMinutes === 'number') body.leadMinutes = leadMinutes;
            if (Object.keys(body).length === 0) {
                log.error('setPreheat called with nothing to change');
                return Promise.resolve({ ok: false, empty: true });
            }
            return write(() => routes.setCupWarmerPreheat(body));
        },

        invalidate() {
            state.set(emptyCupWarmerState());
            return state.get();
        },
    };

    return store;

    async function write(send) {
        publish({ pending: state.get().pending + 1 });
        const result = await send();
        publish({ pending: Math.max(0, state.get().pending - 1) });
        if (!result.ok) {
            log.error('cup-warmer write failed', result);
            publish({ status: CUP_WARMER_STATUS.ERROR, error: result });
            return { ok: false, error: result };
        }
        await store.refresh();
        return { ok: true };
    }
}
