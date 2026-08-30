// A FEED STORE — one socket feed, held as last-known value plus staleness.
//
// SCOPE Part 3 §4: "One store per feed — machine snapshot, scale, shot state, connection
// (the FULL B8 state), display, update, sensors — each holding the last frame, replaying
// it to late subscribers … and exposing subscription to Lit components."
//
// And the rule that shapes every field below:
//
//     "Machine truth is never owned by the skin. The store's job is LAST-KNOWN VALUE PLUS
//      STALENESS, never a second source of truth."
//
// So this module holds four facts and derives nothing else: what the server last said,
// when it said it, whether the source is still there, and whether what we hold is old
// enough that a screen should say so. It does not average, smooth, interpolate, re-derive
// or substitute. A7: there is no fallback path here, and that is not an omission — a
// locally-recomputed value behind a dead source is the whole defect class this wave exists
// to kill, and it is exactly what the old skin did with gravimetric flow.
//
// THE DELETION RULE, stated because it is the one that is easy to get backwards: a source
// that closes does NOT clear the value. Clearing would make a screen paint zeros or
// blanks, which reads as "the machine says zero" — a fresh-looking lie. The value stays,
// marked stale, and the screen decides how to show age. The layer BELOW does the opposite
// on purpose: `rea-fanout.js` drops its replay value on close, because replaying a frame
// from a socket that is gone would hand a NEW subscriber a stale value with no marker at
// all. Two different jobs: the fan-out replays only what is current; the store remembers
// with a date on it.
//
// TIME IS INJECTED AND NOTHING TICKS. There is no `setInterval` in this file. Staleness is
// classified when a frame arrives and re-classified when someone calls `refreshStaleness`
// — the render loop, a `requestAnimationFrame`, a test. A store that started its own timer
// at construction is `estimator-link.js:120-121`, which polled forever whether anything
// wanted an answer or not (CARRY_FORWARD.md §6 pattern A).

import { createStore, UNCHANGED } from './store.js';

export const FEED_STATUS = Object.freeze({
    /** Nothing has ever arrived. Not an error — the boot state of every feed. */
    NEVER: 'never',
    /** A frame arrived, recently enough (or the feed has no rate to be late against). */
    LIVE: 'live',
    STALE: 'stale',
    UNAVAILABLE: 'unavailable',
});

export const DEFAULT_STALE_AFTER_MS = Object.freeze({
    /** ~10 Hz in a shot -> 2 s is ~20 missed frames. */
    machineSnapshot: 2000,
    /** Scale frames arrive on weight change; a still scale is quiet. Wider on purpose. */
    scale: 4000,
    /** Transitions only. */
    shotState: null,
    /** State changes only. */
    devices: null,
    display: null,
    update: null,
    /** Sensor streams follow the machine's sample rate. */
    sensor: 3000,
    waterLevels: null,
});

export function createFeedStore({
    label,
    read,
    clock = () => Date.now(),
    staleAfterMs = null,
    logger = null,
} = {}) {
    if (typeof label !== 'string' || !label) throw new Error('createFeedStore: label is required');
    if (typeof read !== 'function') {
        throw new Error(`createFeedStore(${label}): a reader is required — the address layer reads ReaPrime's names, not the store`);
    }
    if (staleAfterMs !== null && !(Number.isFinite(staleAfterMs) && staleAfterMs > 0)) {
        throw new Error(`createFeedStore(${label}): staleAfterMs must be a positive number or null`);
    }

    const initial = Object.freeze({
        label,
        status: FEED_STATUS.NEVER,
        /** The address layer's reading of the last frame, or null before the first. */
        value: null,
        /** The raw frame. Diagnostic — the VALUE is what consumers read. */
        frame: null,
        /** THE ARRIVAL STAMP the store adds: local clock, when this frame reached us.
         *  Not a plot axis. The plot axis is ReaPrime's own stamp — see time-axis.js. */
        receivedAt: null,
        frames: 0,
        sourceOpen: false,
        /** The last transport signal, verbatim. Never stored as a value. */
        signal: null,
        /** The last error envelope's text, or null. A signal, kept for a screen to show. */
        error: null,
        /** The scale channel's `{"status": …}` envelope, the only notice that a scale left. */
        deviceStatus: null,
        staleLatched: false,
        staleAfterMs,
    });

    const store = createStore(initial, { label, logger });
    let detachSource = null;

    const note = (level, message) => {
        if (logger && logger[level]) logger[level](`${label}: ${message}`);
    };

    /** Classify by age. Called on arrival and on refresh; never on a timer of its own. */
    const classify = (receivedAt, now) => {
        if (receivedAt === null) return FEED_STATUS.NEVER;
        if (staleAfterMs === null) return FEED_STATUS.LIVE;
        return (now - receivedAt) > staleAfterMs ? FEED_STATUS.STALE : FEED_STATUS.LIVE;
    };

    const feed = {
        label,

        /* The store surface, delegated so a consumer never needs to know this is a
         * composition. A component subscribes to a feed exactly as it subscribes to any
         * other store. */
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },
        revision() { return store.revision(); },
        size() { return store.size(); },
        destroy() {
            feed.detach();
            store.destroy();
        },

        /**
         * A frame arrived. Reads it through the address layer, stamps it, publishes NEW
         * state (pattern F: nothing is mutated in place).
         */
        accept(frame) {
            const now = clock();
            return store.update((state) => Object.freeze({
                ...state,
                status: classify(now, now),
                value: read(frame),
                frame,
                receivedAt: now,
                frames: state.frames + 1,
                sourceOpen: true,
                // An error is cleared by a frame arriving: the feed is demonstrably working.
                error: null,
                staleLatched: false,
            }));
        },

        /**
         * A transport signal arrived: open, close, connecting, unavailable, an error
         * envelope, a scale status envelope. Signals are never values and never plotted.
         */
        signal(signal) {
            const kind = signal && typeof signal === 'object' ? signal.kind : null;
            if (!kind) return store.get();
            return store.update((state) => {
                const next = { ...state, signal: Object.freeze({ ...signal }) };
                switch (kind) {
                    case 'open':
                        next.sourceOpen = true;
                        break;
                    case 'close':
                        // The value SURVIVES, marked. See the deletion rule at the top.
                        next.sourceOpen = false;
                        if (state.receivedAt !== null) {
                            next.status = FEED_STATUS.STALE;
                            next.staleLatched = true;
                        }
                        break;
                    case 'connecting':
                        next.sourceOpen = false;
                        break;
                    case 'unavailable':
                        next.sourceOpen = false;
                        next.status = FEED_STATUS.UNAVAILABLE;
                        note('info', 'source reported unavailable');
                        break;
                    case 'error':
                        // `{"error":"not found"}` and friends. Kept as a fact to render,
                        // never folded into the value.
                        next.error = typeof signal.error === 'string' ? signal.error : String(signal.error ?? 'error');
                        if (state.receivedAt !== null) {
                            next.status = FEED_STATUS.STALE;
                            next.staleLatched = true;
                        }
                        break;
                    case 'status':
                        // The scale's connection envelope: the ONLY notice that the scale
                        // left, because "no further frames" is indistinguishable from a
                        // scale that is simply not changing.
                        next.deviceStatus = typeof signal.status === 'string' ? signal.status : null;
                        if (next.deviceStatus === 'disconnected' && state.receivedAt !== null) {
                            next.status = FEED_STATUS.STALE;
                            // The scale socket stays OPEN across a scale disconnect — the
                            // channel table says so and websocket_v1.yml tells clients not to
                            // reconnect — so `sourceOpen` is still true and truthfully so.
                            // The latch is what stops that truth reviving a dead reading.
                            next.staleLatched = true;
                        }
                        break;
                    default:
                        // transportError, commandResult, malformed: recorded as the last
                        // signal and nothing more. A malformed frame is NOT a value.
                        break;
                }
                return Object.freeze(next);
            });
        },

        refreshStaleness(now = clock()) {
            return store.update((state) => {
                if (state.status === FEED_STATUS.UNAVAILABLE || state.receivedAt === null) return UNCHANGED;
                // A source that told us it went stays stale however new the value. Age can
                // only make a reading older; it can never make a departed source present.
                const status = state.staleLatched ? FEED_STATUS.STALE : classify(state.receivedAt, now);
                if (status === state.status) return UNCHANGED;
                return Object.freeze({ ...state, status });
            });
        },

        /** Age of the held value in ms, or null if there is nothing held. */
        ageMs(now = clock()) {
            const { receivedAt } = store.get();
            return receivedAt === null ? null : now - receivedAt;
        },

        attach(source) {
            if (!source || typeof source.subscribe !== 'function') {
                throw new Error(`${label}: attach needs a source with subscribe()`);
            }
            feed.detach();
            const offSignal = typeof source.onSignal === 'function'
                ? source.onSignal((signal) => feed.signal(signal))
                : null;
            const offFrames = source.subscribe((frame) => feed.accept(frame));
            detachSource = () => {
                if (offSignal) offSignal();
                offFrames();
            };
            return feed.detach;
        },

        detach() {
            if (!detachSource) return;
            const off = detachSource;
            detachSource = null;
            off();
            feed.signal({ kind: 'close', reason: 'detached' });
        },

        attached() {
            return detachSource !== null;
        },
    };

    return feed;
}

/** Convenience predicates, so no screen re-spells the comparison. */
export function isLive(state) {
    return !!state && state.status === FEED_STATUS.LIVE;
}

export function isStale(state) {
    return !!state && state.status === FEED_STATUS.STALE;
}

/** True when the feed has never produced a value — different from stale, and rendered
 *  differently: "waiting" rather than "last seen at". */
export function isBlank(state) {
    return !state || state.status === FEED_STATUS.NEVER;
}

/**
 * The value, or null.
 *
 * Named so that reading a feed's value is one obvious call and there is no temptation to
 * write `state.value || somethingElse` at a call site — that `||` is a fallback path.
 */
export function valueOf(state) {
    return state && state.value !== undefined ? state.value : null;
}
