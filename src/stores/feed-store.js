

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
         * state; nothing is mutated in place.
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
                        next.error = typeof signal.error === 'string' ? signal.error : String(signal.error ?? 'error');
                        if (state.receivedAt !== null) {
                            next.status = FEED_STATUS.STALE;
                            next.staleLatched = true;
                        }
                        break;
                    case 'status':
                        next.deviceStatus = typeof signal.status === 'string' ? signal.status : null;
                        if (next.deviceStatus === 'disconnected' && state.receivedAt !== null) {
                            next.status = FEED_STATUS.STALE;
                            next.staleLatched = true;
                        }
                        break;
                    default:
                        break;
                }
                return Object.freeze(next);
            });
        },

        refreshStaleness(now = clock()) {
            return store.update((state) => {
                if (state.status === FEED_STATUS.UNAVAILABLE || state.receivedAt === null) return UNCHANGED;
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
