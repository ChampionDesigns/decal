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

/**
 * The trichotomy, plus the one state the contract adds.
 *
 * `unsupported` is NOT a fourth kind of fetch outcome — it is the CAPABILITY answer, and it
 * is a different thing from an error: the contract table's gate on all four routes reads
 * "404 here means the feature is absent — hide the control. It is not 'route missing' and
 * not an error to show."
 */
export const CUP_WARMER_STATUS = Object.freeze({
    LOADING: 'loading',
    READY: 'ready',
    ERROR: 'error',
    UNSUPPORTED: 'unsupported',
});

/**
 * The two named states where an ENABLED pre-heat silently does nothing.
 *
 * The mat only runs when the pre-heat schedule is enabled AND the warmer itself is on AND a
 * wake window is open or within its lead. So a pre-heat switched on with the warmer off, or
 * with no wake window configured, is a dead setting the user gets no feedback about. Both
 * are reachable states of the UI, so they are named rather than left silent.
 *
 * BENCH ITEM: the precise firmware gate is quoted from the old module's comment and has not
 * been re-verified against firmware at this pin. The two states are worth naming either way
 * — each is a user-visible dead setting — but the exact conjunction is a bench claim.
 */
export const PREHEAT_WARNING = Object.freeze({
    NO_SETPOINT: 'noSetpoint',
    NO_SCHEDULE: 'noSchedule',
});

/* THE PRE-HEAT LEAD'S RANGE IS NOT HERE, AND IT USED TO BE. `PREHEAT_LEAD_RANGE` was
 * exported from this file with a paragraph arguing it had to exist so "the leaf's stepper
 * and the leaf's keypad must read the same one (B2: one ranges table)" — and NOTHING read
 * it, in src/ or test/, while the live band sat in `machine-limits.js` disagreeing with it
 * on two of its three numbers. A dead constant contradicting the real one, under a comment
 * claiming the opposite, is the defect this fork exists to remove.
 *
 * The number it carried was true and was about the TRANSPORT, not about a control:
 * `bengle_interface.dart:49` clamps `leadMinutes` to 0..120. What a stepper OFFERS is
 * `preWarmLead` in `src/lib/machine-limits.js` — Ben's band and Ben's step, 5 to 60 in
 * fives — which is inside the transport's clamp and is the only ranges table (B2). */

/** The two capability names this store gates on. ReaPrime's spelling, not ours. */
export const CUP_WARMER_CAPABILITY = 'cupWarmer';
export const PREHEAT_CAPABILITY = 'preheat';

const NOOP_LOGGER = Object.freeze({ debug() {}, info() {}, warn() {}, error() {} });

/* ------------------------------------------------------------------ pure reads */

/**
 * `GET /machine/cupWarmer` body -> the warmer state, by KEY PRESENCE.
 *
 * Every field goes through the address layer's presence rules, so a server that stops
 * sending one produces a visible absence rather than a plausible value. In particular
 * `currentTemperature` is `Future<double?>` on the interface
 * (`bengle_interface.dart:25`) — the mock returns null whenever the warmer is off
 * (`mock_bengle.dart:95-96`) — so null is a NORMAL answer meaning "no reading", and it must
 * never become a 0.
 *
 * @param {object|null|undefined} data
 * @returns {null|{temperature: *, enabled: *, currentTemperature: *}} null when there is no
 *          body at all — "not loaded", which is not the same as "loaded and off".
 */
export function readWarmer(data) {
    if (!data || typeof data !== 'object') return null;
    return Object.freeze({
        temperature: readNumber(data, 'temperature', ABSENCE.NO_SOURCE),
        enabled: readValue(data, 'enabled', ABSENCE.NO_SOURCE),
        currentTemperature: readNumber(data, 'currentTemperature', ABSENCE.NO_SOURCE),
    });
}

/**
 * `GET /machine/cupWarmer/preheat` body -> the pre-heat state, by key presence.
 * `CupWarmerPreheatState` has three non-nullable fields, so at this pin all three arrive;
 * presence reads mean a future omission shows up as an absence instead of a false.
 */
export function readPreheat(data) {
    if (!data || typeof data !== 'object') return null;
    return Object.freeze({
        enabled: readValue(data, 'enabled', ABSENCE.NO_SOURCE),
        leadMinutes: readNumber(data, 'leadMinutes', ABSENCE.NO_SOURCE),
        active: readValue(data, 'active', ABSENCE.NO_SOURCE),
    });
}

/**
 * Is the warmer on? The SERVED boolean, and nothing else.
 *
 * @returns {boolean|null} null when the state is unknown or the field is absent — which is
 *          not "off". A control renders neither pressed nor unpressed on a null.
 */
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

/**
 * `GET /presence/schedules` -> is there at least one ENABLED wake window?
 *
 * The route answers a BARE ARRAY of `WakeSchedule.toJson`
 * (`presence_handler.dart` `_getSchedulesHandler`, `jsonOk(schedules.map(...).toList())`)
 * — the `{schedules: [...]}` shape belongs to the presence SETTINGS route, not this one.
 * `toJson` always writes `enabled`, so the "absent means enabled" reading is the spec's
 * default rather than a live case; it is honoured for spec conformance and costs nothing.
 *
 * @returns {boolean|null} null for a non-array: not fetched, or the fetch failed. An
 *          UNKNOWN list is not an empty one, and no warning is raised on data we do not
 *          have.
 */
export function hasEnabledWakeSchedule(schedules) {
    if (!Array.isArray(schedules)) return null;
    return schedules.some((entry) => entry && entry.enabled !== false);
}

/**
 * Why an enabled pre-heat will silently do nothing.
 *
 * Returns warning CODES; this module is DOM-free and i18n-free, so the copy is the screen's.
 * Unknowns produce nothing — never cry wolf.
 *
 * @param {object} input
 * @param {object|null} input.preheat   from readPreheat
 * @param {object|null} input.warmer    from readWarmer
 * @param {Array|null}  input.schedules the wake-schedule list, or null when unknown
 * @returns {string[]}
 */
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

/* ------------------------------------------------------------------ the store */

/**
 * The cup-warmer store.
 *
 * @param {object} options
 * @param {object} options.routes   the bound ReaPrime helpers: `cupWarmer`, `setCupWarmer`,
 *        `cupWarmerPreheat`, `setCupWarmerPreheat`. Each resolves to the transport result
 *        `{ok, status, data}` — a failure is DATA here, never a throw and never a null.
 * @param {Function} [options.readCapabilities]  `() => string[]|null` (may be async). The
 *        capabilities store's list, or null when it is not known yet. Null is NOT "absent".
 * @param {Function} [options.readSchedules]     `() => Array|null` (may be async). Supplied
 *        by whoever owns the presence data; omitted here so this store addresses exactly
 *        the four routes its contract rows cover. Absent -> the schedule warning is never
 *        raised, which is the "never cry wolf" rule, not a fallback.
 * @param {object} [options.logger]
 * @param {Function} [options.now]  injected clock, for `fetchedAt`
 */
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

    /* THE SCHEDULE READER CAN ARRIVE AFTER CONSTRUCTION, and that is what lets there be
     * ONE of this store rather than two.
     *
     * IT WAS BUILT TWICE UNTIL 26 AUGUST 2026. `app-boot.js` built one for the Live
     * header's Warmer button and `settings-model.js` built a second for the settings page's
     * door — and the boot instance was refreshed only at boot and on `machineChanged`, so
     * changing the mat target on the Settings page and pressing Save left the Live header
     * showing the old setpoint until the machine reconnected. B7's "one store per setting",
     * lost to two constructions of one store.
     *
     * WHY IT COULD NOT SIMPLY BE DELETED: the settings instance had something the boot one
     * lacked — the WAKE-SCHEDULE list, which is what turns "an enabled pre-heat with no wake
     * schedule" from a silent dead setting into a sentence. The presence store lives in the
     * settings shell, and hoisting IT into the boot to fix a duplication would have moved
     * the problem rather than solved it. So the reader is settable: the boot builds the one
     * store, and whoever ends up owning a presence store hands it in.
     *
     * A SETTER, NOT A SECOND CONSTRUCTOR ARGUMENT PATH: the constructor form still works and
     * is what a test uses. This only lets a later assembler fill a reader that was absent. */
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

        /**
         * Tell this store where the wake schedules are — see `scheduleReader` above.
         *
         * IT DOES NOT REFRESH. Handing over a reader says where to look next time, not that
         * the answer has changed; a refresh here would fire a pair of machine reads on every
         * shell assembly, and the settings screen reads on open anyway.
         */
        useSchedules(reader) {
            scheduleReader = typeof reader === 'function' ? reader : null;
        },

        /** Subscribe; fires immediately with the last frame, then on every change. */
        subscribe(listener) {
            return state.subscribe(listener);
        },

        /**
         * Read the machine. The sequence is capability list first (A3), the handler's own
         * 404 gate second and authoritative.
         *
         * On failure the previous frame is KEPT and flagged: the store's job is
         * last-known-value plus staleness (`fetchedAt` is the age a screen ages out on).
         * What it must never do is INVENT a frame — an error with no previous frame leaves
         * `warmer` null, which is exactly the case the old synthetic `{temperature: 0}`
         * snapshot destroyed.
         */
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

        /**
         * Turn the warmer on or off. `{enabled: false}` is the ONLY way to turn it off:
         * `{temperature: 0}` would ENABLE the warmer at a 0 C setpoint, because the handler
         * calls `setCupWarmerEnabled(true)` whenever a temperature arrives without an
         * explicit enable (`de1handler.dart` PUT `/machine/cupWarmer`, the
         * `else if (temperature != null)` arm).
         */
        setEnabled(enabled) {
            return write(() => routes.setCupWarmer({ enabled: Boolean(enabled) }));
        },

        /**
         * Set the mat target in whole degrees Celsius.
         *
         * NOTE THE SERVER-SIDE SIDE EFFECT: sending `temperature` alone also ENABLES the
         * warmer. That is the handler's behaviour, not a guess, and the refresh that
         * follows shows the caller what actually happened rather than predicting it (B10).
         * Pass `enabled` explicitly to state the intent instead.
         *
         * The 0-80 whole-degree range is NOT re-validated here: the handler answers a typed
         * 400 and the refusal is the server's to make (B9). A second copy of a range is a
         * second thing to drift.
         */
        setTarget(celsius, { enabled } = {}) {
            const body = { temperature: celsius };
            if (enabled === true || enabled === false) body.enabled = enabled;
            return write(() => routes.setCupWarmer(body));
        },

        /**
         * Change the scheduled pre-heat. Send only what changed: the handler reads the
         * current state and fills whichever key is omitted, so a partial body is a genuine
         * partial update rather than a reset.
         */
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

        /**
         * Drop everything on a machine (re)connect so nothing is painted from a machine
         * that is no longer there. The frame goes back to `loading`, not to a synthetic
         * "off".
         */
        invalidate() {
            state.set(emptyCupWarmerState());
            return state.get();
        },
    };

    return store;

    /**
     * One write, then a re-read. The PUT answers `{status: 'accepted'}` and NOTHING about
     * the resulting state, so the state comes from asking again — never from assuming the
     * write took the value we sent.
     */
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
