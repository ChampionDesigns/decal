/**
 * presence-store.js — sleep timeout, presence detection and the wake schedules.
 *
 * THE LEAF SHIPPED ITS LAYOUT AND NOT ITS DATA, and this store is the other half. Its
 * own comment said why, and the sentence is worth keeping because it was right:
 *
 *   "Every control in Slate's version is a WRITE — enable presence, set the sleep
 *   timeout, add a schedule, delete one, toggle one — and their door is `GET/POST
 *   /api/v1/presence/settings` plus `/presence/schedules`, which are RECORDED (both have
 *   fixtures) and UNADOPTED: no client addresses them … a control that cannot write is a
 *   lie about the machine."
 *
 * Adopting them is what changed. Both routes were already in the generated table, both
 * fixtures were already served, and `putPresenceSchedulesById` already had a contract
 * row — so what was missing was a caller, which is the definition of a door with nobody
 * walking through it.
 *
 * ===========================================================================
 * ONE READ SERVES BOTH CARDS
 * ===========================================================================
 *
 * `GET /presence/settings` returns the settings AND the schedules — the handler
 * deserialises `wakeSchedules` and puts them in the same body. `GET /presence/schedules`
 * returns the same list on its own. So this store reads the first and never the second:
 * two reads for one answer is two chances to show a schedule list that disagrees with
 * the switch above it.
 *
 * THE THREE WRITES ARE THE OTHER THREE ROUTES, and each re-reads rather than patching a
 * local copy. The machine is the owner, the handler CLAMPS the sleep timeout
 * (`normalizeSleepTimeoutPreferenceMinutes`, 0..240) and mints the schedule id, so the
 * value shown after a write is the value it holds.
 *
 * ===========================================================================
 * WHAT THE HANDLER REFUSES, read at 2b047d02
 * ===========================================================================
 *
 *   sleepTimeoutMinutes   `v is! int` -> 400. Then CLAMPED to 0..240, never refused for
 *                         range — so a bad number comes back as a different number and
 *                         the re-read is the only way to see it.
 *   userPresenceEnabled   `v is! bool` -> 400.
 *   keepAwakeFor          `< 0 || > 720` -> 400. `0` and `null` both mean "clear".
 *   hour / minute         0..23 and 0..59 -> 400 outside.
 *   daysOfWeek            weekdays 1..7, ISO — Monday is 1 and Sunday is 7. An EMPTY set
 *                         is legal and means every day (`matchesTime` only filters when
 *                         the set is non-empty), which is why the UI says "Every day"
 *                         rather than "No days".
 *
 * A SCHEDULE'S TIME IS "HH:MM" ON THE WIRE. `WakeSchedule.toJson` pads both halves, and
 * `fromJson` splits on the colon — the same string `<ui-time-picker>` speaks
 * (`time-picker-core.js` `formatTime24`/`parseTime24`), so no format is invented here.
 */

import { callRoute } from '../data/rea-routes.js';
import { createStore } from './store.js';

/** What the store knows right now. Mirrors the workflow store's four. */
export const PRESENCE_STATUS = Object.freeze({
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    /** Asked and refused, or the server was not there. The cards say so. */
    UNAVAILABLE: 'unavailable',
});

/**
 * The sleep-timeout band, from `lib/src/settings/sleep_timeout_preference.dart`:
 * `kMinSleepTimeoutPreferenceMinutes = 0`, `kMaxSleepTimeoutPreferenceMinutes = 240`.
 *
 * NOT IN `machine-limits.js`, for the reason `NIGHT_MODE_MINUTE_RANGE` is not either:
 * that table is the MACHINE's ranges (B2/R2) and this is a server-side clamp on an app
 * preference. It is here because the handler CLAMPS rather than refuses, so a control
 * that offered 300 would appear to work and quietly become 240.
 */
/* 5-300 IN FIVES SINCE 26 AUGUST 2026 (Ben: "5 minute steps, 5 to 300 minutes"). It was
 * 0-240 in ones, which had two problems and the smaller one was the step: a stepper
 * walking a four-hour range one minute at a time cannot reach its own top. The larger was
 * the FLOOR — zero meant "never sleeps by itself", a second job hidden in the bottom of a
 * range, and the page has an Automatic sleep switch now that says it properly. */
export const SLEEP_TIMEOUT_RANGE = Object.freeze({ min: 5, max: 300, step: 5, unit: 'min' });

/** `keepAwakeFor` bounds, from `_addScheduleHandler`. 0 and null both clear it. */
export const KEEP_AWAKE_RANGE = Object.freeze({ min: 0, max: 720, step: 15, unit: 'min' });

/**
 * The four presets Slate offers for the sleep timeout, plus its Custom escape.
 *
 * These are Slate's own four (`settings.js`, `[15, 30, 45, 60].map`). They are OPTIONS,
 * not a range: any integer in `SLEEP_TIMEOUT_RANGE` is valid and the leaf's stepper can
 * reach it, so this list is a shortcut rather than a constraint.
 */
export const SLEEP_TIMEOUT_PRESETS = Object.freeze([15, 30, 45, 60]);

const EMPTY_STATE = Object.freeze({
    status: PRESENCE_STATUS.IDLE,
    /** `userPresenceEnabled`, or null while unknown. Never defaulted to false. */
    presenceEnabled: null,
    /** Minutes, or null while unknown. */
    sleepTimeoutMinutes: null,
    /** ISO string or null — the handler's own `keepAwakeUntil`. Read-only here. */
    keepAwakeUntil: null,
    /** The schedules as served, in the handler's order. Never partially invented. */
    schedules: Object.freeze([]),
    error: null,
    /** The last write that failed, so a surface can say so. Cleared by the next success. */
    writeError: null,
});

export function createPresenceStore({ transport, logger = null } = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createPresenceStore: a transport must be injected (see createReaTransport)');
    }
    const log = logger && logger.scope ? logger.scope('presence') : logger;
    const store = createStore({ ...EMPTY_STATE }, { label: 'presence', logger: log });
    let inFlight = null;

    const publish = (patch) => {
        store.set({ ...store.get(), ...patch });
        return store.get();
    };

    /** Read the document and publish it. One read, both cards. */
    async function read() {
        const result = await callRoute(transport, 'getPresenceSettings');
        if (!result.ok || !result.data || typeof result.data !== 'object') {
            return publish({ status: PRESENCE_STATUS.UNAVAILABLE, error: result });
        }
        const data = result.data;
        return publish({
            status: PRESENCE_STATUS.READY,
            presenceEnabled: typeof data.userPresenceEnabled === 'boolean' ? data.userPresenceEnabled : null,
            sleepTimeoutMinutes: Number.isFinite(data.sleepTimeoutMinutes) ? data.sleepTimeoutMinutes : null,
            keepAwakeUntil: typeof data.keepAwakeUntil === 'string' ? data.keepAwakeUntil : null,
            schedules: Object.freeze(Array.isArray(data.schedules) ? data.schedules.map(freezeSchedule) : []),
            error: null,
        });
    }

    /**
     * Every write ends in a re-read, and the re-read is not politeness.
     *
     * The handler CLAMPS the sleep timeout and MINTS the schedule id, so the only way to
     * show what the server holds is to ask it. A failed write leaves the shown values
     * alone and sets `writeError`; it never rolls a local copy forward.
     */
    async function writeThrough(routeId, options, label) {
        const result = await callRoute(transport, routeId, options);
        if (!result.ok) {
            if (log && log.warn) log.warn(`presence write refused for ${label}`);
            publish({ writeError: result });
            return false;
        }
        publish({ writeError: null });
        await read();
        return true;
    }

    return {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },

        /** Read once. Concurrent callers share the flight, as the workflow store does. */
        load() {
            if (inFlight) return inFlight;
            publish({ status: PRESENCE_STATUS.LOADING });
            inFlight = read().finally(() => { inFlight = null; });
            return inFlight;
        },

        /** Re-read now, whatever is in flight. After a write, or on a screen return. */
        refresh() {
            inFlight = null;
            return this.load();
        },

        /** `userPresenceEnabled`. A non-boolean never reaches the wire — the handler 400s. */
        setPresenceEnabled(enabled) {
            if (typeof enabled !== 'boolean') return Promise.resolve(false);
            return writeThrough('postPresenceSettings', { body: { userPresenceEnabled: enabled } }, 'presence enabled');
        },

        /**
         * `sleepTimeoutMinutes`. INTEGER OR NOTHING: the handler tests `v is! int`, and a
         * Dart int is not a JS float that happens to be whole — 30.0 serialises as `30.0`
         * and is refused. `Math.round` is the boundary, here, once.
         */
        setSleepTimeout(minutes) {
            if (!Number.isFinite(minutes)) return Promise.resolve(false);
            const whole = Math.round(minutes);
            if (whole < SLEEP_TIMEOUT_RANGE.min || whole > SLEEP_TIMEOUT_RANGE.max) return Promise.resolve(false);
            return writeThrough('postPresenceSettings', { body: { sleepTimeoutMinutes: whole } }, 'sleep timeout');
        },

        /**
         * Add a schedule. `time` is "HH:MM"; `days` is a set of ISO weekdays 1..7 and an
         * EMPTY list means every day.
         */
        addSchedule({ time, days = [], enabled = true, keepAwakeFor = null } = {}) {
            const body = scheduleBody({ time, days, enabled, keepAwakeFor });
            if (!body) return Promise.resolve(false);
            return writeThrough('postPresenceSchedules', { body }, 'add schedule');
        },

        /** Change one. Any subset; an absent field is left as it was by the handler. */
        updateSchedule(id, patch) {
            if (typeof id !== 'string' || !id) return Promise.resolve(false);
            if (!patch || typeof patch !== 'object') return Promise.resolve(false);
            const body = {};
            if ('time' in patch) {
                if (!isTime24(patch.time)) return Promise.resolve(false);
                body.time = patch.time;
            }
            if ('days' in patch) {
                if (!isDays(patch.days)) return Promise.resolve(false);
                body.daysOfWeek = [...patch.days].sort((a, b) => a - b);
            }
            if ('enabled' in patch) {
                if (typeof patch.enabled !== 'boolean') return Promise.resolve(false);
                body.enabled = patch.enabled;
            }
            if ('keepAwakeFor' in patch) {
                const keep = normaliseKeepAwake(patch.keepAwakeFor);
                if (keep === false) return Promise.resolve(false);
                body.keepAwakeFor = keep;
            }
            if (Object.keys(body).length === 0) return Promise.resolve(false);
            return writeThrough('putPresenceSchedulesById', { params: { id }, body }, `schedule ${id}`);
        },

        /** Remove one. A 404 is a refusal like any other and leaves the list alone. */
        deleteSchedule(id) {
            if (typeof id !== 'string' || !id) return Promise.resolve(false);
            return writeThrough('deletePresenceSchedulesById', { params: { id } }, `delete schedule ${id}`);
        },

        /** Drop the last write failure — the surface acknowledged it. */
        clearWriteError() {
            if (store.get().writeError === null) return;
            publish({ writeError: null });
        },

        stop() { store.destroy(); },
    };
}

/* ---------------------------------------------------------------- validation */

/** "HH:MM", the shape `WakeSchedule.toJson` writes and `fromJson` splits. */
function isTime24(value) {
    return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** ISO weekdays. Monday 1 .. Sunday 7, and an empty list means every day. */
function isDays(value) {
    return Array.isArray(value) && value.every((day) => Number.isInteger(day) && day >= 1 && day <= 7);
}

/**
 * `keepAwakeFor` in minutes, or `null` to clear. Returns `false` for a value the handler
 * would refuse — a sentinel, because `null` is itself a legal answer here.
 */
function normaliseKeepAwake(value) {
    if (value === null || value === undefined || value === 0) return null;
    if (!Number.isFinite(value)) return false;
    const whole = Math.round(value);
    if (whole < KEEP_AWAKE_RANGE.min || whole > KEEP_AWAKE_RANGE.max) return false;
    return whole;
}

/** The body `POST /presence/schedules` takes, or null when it would be refused. */
function scheduleBody({ time, days, enabled, keepAwakeFor }) {
    if (!isTime24(time)) return null;
    if (!isDays(days)) return null;
    if (typeof enabled !== 'boolean') return null;
    const keep = normaliseKeepAwake(keepAwakeFor);
    if (keep === false) return null;
    const body = { time, daysOfWeek: [...days].sort((a, b) => a - b), enabled };
    /* SENT ONLY WHEN IT IS A NUMBER. The handler reads `json['keepAwakeFor'] as int?`,
     * so null is legal — but an absent key and a null key mean the same thing there and
     * the smaller body is the one that reads correctly in a capture. */
    if (keep !== null) body.keepAwakeFor = keep;
    return body;
}

/** One served schedule, frozen. Never reshaped: the handler's own field names survive. */
function freezeSchedule(schedule) {
    return Object.freeze({ ...schedule, daysOfWeek: Object.freeze([...(schedule.daysOfWeek ?? [])]) });
}
