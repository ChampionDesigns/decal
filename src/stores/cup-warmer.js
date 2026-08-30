// The cup-warmer store — ReaPrime's registers, read as served.
//
// SCOPE Part 6, REPLACE-WITH-REAPRIME: `cup-warmer.js` (265 lines) is replaced by
// `GET/PUT /api/v1/machine/cupWarmer`, `GET/PUT /api/v1/machine/cupWarmer/preheat` and
// `GET /api/v1/machine/capabilities`. What survives is roughly fifty lines of THINKING,
// and it is all in this file:
//
//   * the loading / ready / error trichotomy that refuses to fabricate a snapshot out of a
//     failed fetch (the old `cupWarmerViewMode`);
//   * the two named warning states where an enabled pre-heat silently does nothing;
//   * "null and absent both mean no reading, never fabricated data".
//
// FOUR PREMISES OF THE OLD MODULE THAT ARE DEAD, each checked against the handler AS
// WRITTEN at 2b047d02e42e29bf2d96a2aa964ef94e4a4daba3:
//
//  1. "There is no separate enable field on the wire, so temperature > 0 IS the on state"
//     (old cup-warmer.js:5-6). FALSE. `GET /machine/cupWarmer` serves
//     `{temperature, enabled, currentTemperature}`; `enabled` is `getCupWarmerEnabled()`,
//     which reads the `cupWarmerMode` MMR register (`cup_warmer_capability.dart:8-9`),
//     a DIFFERENT register from `matSetPoint` (`bengle.dart:32-37`). A machine holding
//     setpoint 60 with the warmer off painted as ON. On/off is READ, never inferred.
//
//  2. "A disabled warmer has nowhere to keep its target, so the skin must." FALSE for the
//     same reason: disabling writes `cupWarmerMode = 0` and leaves `matSetPoint` untouched,
//     so the machine keeps the target and the GET returns it. This store therefore keeps NO
//     local mirror of the target. (`storage-routes.js` still carries a `cupWarmerTarget`
//     row; nothing in this store reads or writes it. Flagged for the storage owner.)
//
//  3. "Pre-heat lives on /machine/cupWarmer." FALSE, and this was the expensive one: the
//     pre-heat fields were read off a route that never serves them, so the "does this
//     firmware have the registers?" test was permanently false and the page told owners of
//     fully-capable machines that their firmware does not support pre-heat — a hardware
//     verdict manufactured out of data never received. Pre-heat is its own route, serving
//     `CupWarmerPreheatState.toJson` = `{enabled, leadMinutes, active}`
//     (`de1handler.dart` GET/PUT `/api/v1/machine/cupWarmer/preheat`; `cup_warmer.dart`).
//
//  4. "Support is inferred from the shape of the answer." Replaced by A3: support is
//     `GET /machine/capabilities` — the same predicate ReaPrime enforces per route via
//     `_bengleFirmwareGate` — plus that gate's own 404 as the authoritative second answer.
//     Never a model-string sniff, and never the shape of a payload.
//
// A7 THROUGHOUT: a failed fetch produces a FAILURE, never a `{temperature: 0}` snapshot; an
// absent or null `currentTemperature` produces an absence carrying its reason, never a
// number; an unknown wake-schedule list produces NO warning rather than a guessed one.
//
// DOM-free and route-free: the ReaPrime helpers are injected (`src/data/rea-routes.js`,
// whose HELPER_DEMAND table names this item as their consumer), so no path string appears
// here and the whole store runs under node:test against plain objects.

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
    // The four helpers this store needs, named in the routes surface's HELPER_DEMAND table
    // with this item as their consumer. No path is spelled here — that is the whole point.
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
                // The handler would answer 400 "enabled and/or leadMinutes required". Not
                // sending is not a fallback — there is nothing to send, and the caller gets
                // told so rather than a request being fabricated.
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
