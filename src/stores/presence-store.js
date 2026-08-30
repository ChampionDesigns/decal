/**
 * Sleep timeout, presence detection and the wake schedules.
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

export const SLEEP_TIMEOUT_RANGE = Object.freeze({ min: 5, max: 300, step: 5, unit: 'min' });

/** `keepAwakeFor` bounds, from `_addScheduleHandler`. 0 and null both clear it. */
export const KEEP_AWAKE_RANGE = Object.freeze({ min: 0, max: 720, step: 15, unit: 'min' });

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
    if (keep !== null) body.keepAwakeFor = keep;
    return body;
}

/** One served schedule, frozen. Never reshaped: the handler's own field names survive. */
function freezeSchedule(schedule) {
    return Object.freeze({ ...schedule, daysOfWeek: Object.freeze([...(schedule.daysOfWeek ?? [])]) });
}
