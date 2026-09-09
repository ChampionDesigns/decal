/**
 * The steam session's sample buffer.
 */

import { createStore } from './store.js';
import { CHART_MODE, STEAM_CHANNELS, isSteamFlowing } from '../lib/steam-chart.js';

export const STEAM_SAMPLE_CAP = 2000;

const emptySeries = () => Object.fromEntries(
    STEAM_CHANNELS.map((key) => [key, Object.freeze({ x: Object.freeze([]), y: Object.freeze([]) })]),
);

const EMPTY = Object.freeze({
    ok: false,
    reason: 'noSamples',
    axis: Object.freeze({ t: Object.freeze([]), originMs: null }),
    series: Object.freeze(emptySeries()),
    counts: Object.freeze({ samples: 0 }),
});

/**
 * @param {object} deps
 * @param {() => number} [deps.now]  the clock, injected so a test can drive it
 */
export function createSteamBuffer({ logger = null, now = () => Date.now() } = {}) {
    const log = logger && logger.scope ? logger.scope('steam') : logger;
    const store = createStore({ ...EMPTY }, { label: 'steamBuffer', logger: log });

    /** The open session's raw columns. Rebuilt into frozen series on every publish. */
    let originMs = null;
    let t = [];
    let columns = Object.fromEntries(STEAM_CHANNELS.map((key) => [key, []]));
    let dropped = 0;

    let series = null;

    /* THE QUIET TAIL IS HELD, NOT PUBLISHED. The machine keeps reporting `pouring` for
     * about 6.5 s after the steam flow stops on the automatic stop, and the graph drew
     * every one of those frames as a fall to zero. A frame below `STEAM_MIN_FLOW` waits
     * here instead. The next flowing frame flushes the whole wait, so a dip inside a
     * session keeps its shape; the end of the session simply drops it. */
    let pending = [];

    const append = (seconds, row) => {
        t.push(seconds);
        STEAM_CHANNELS.forEach((key, index) => columns[key].push(row[index]));
    };

    const publish = () => store.set(Object.freeze({
        ok: t.length > 0,
        reason: t.length > 0 ? null : 'noSamples',
        axis: Object.freeze({ t, originMs }),
        series,
        counts: Object.freeze({ samples: t.length, dropped }),
    }));

    /* The next pouring sample begins a NEW session rather than appending to the last.
     * Set when the mode leaves steam, which is the only signal the machine gives that a
     * session has finished — it issues no session id. */
    let stale = false;

    const reset = () => {
        originMs = null;
        t = [];
        columns = Object.fromEntries(STEAM_CHANNELS.map((key) => [key, []]));
        pending = [];
        dropped = 0;
        series = Object.freeze(Object.fromEntries(
            STEAM_CHANNELS.map((key) => [key, Object.freeze({ x: t, y: columns[key] })]),
        ));
    };

    reset();
    stale = false;

    return {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },

        take({ mode, pouring, machine, milk = null, at = now() } = {}) {
            if (mode !== CHART_MODE.STEAM) {
                /* Leaving steam ends the session. The samples stay published until the
                 * next one starts, because the hold keeps the finished graph on screen
                 * for the settle window. */
                stale = true;
                if (t.length === 0 && originMs === null) return store.get();
                return store.get();
            }
            if (!pouring) {
                /* The valve is shut and the mode is still steam: the ramp before a
                 * session, a pause inside it, and the settle window after the stop.
                 * NOTHING IS DISCARDED HERE. The machine reports puffing and paused steam
                 * as idle, so a stop lands here at once; dropping the session is the next
                 * session's job, not the end of this one's. */
                return store.get();
            }
            if (!machine || machine.ok !== true) return store.get();
            /* A new session starts from zero, on its first sample, so a finished graph is
             * replaced only when there is something to replace it with. */
            if (stale && originMs !== null) reset();
            stale = false;
            if (originMs === null) originMs = at;
            if (t.length + pending.length >= STEAM_SAMPLE_CAP) {
                dropped += 1;
                return dropped === 1 ? publish() : store.get();
            }
            const seconds = (at - originMs) / 1000;
            const row = STEAM_CHANNELS.map((key) => {
                const value = key === 'milkTemperature' ? milk : machine[key];
                return typeof value === 'number' && Number.isFinite(value) ? value : null;
            });
            if (!isSteamFlowing(machine.flow)) {
                pending.push({ seconds, row });
                return store.get();
            }
            for (const held of pending) append(held.seconds, held.row);
            pending = [];
            append(seconds, row);
            return publish();
        },

        /** Throw the session away — a machine swap, or a screen leaving. */
        clear() {
            stale = false;
            if (t.length === 0 && originMs === null) return store.get();
            reset();
            return store.set({ ...EMPTY });
        },

        stop() { store.destroy(); },
    };
}
