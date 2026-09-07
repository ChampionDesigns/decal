/**
 * The steam session's sample buffer.
 */

import { createStore } from './store.js';
import { CHART_MODE, STEAM_CHANNELS } from '../lib/steam-chart.js';

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
            if (t.length >= STEAM_SAMPLE_CAP) {
                dropped += 1;
                return dropped === 1 ? publish() : store.get();
            }
            const seconds = (at - originMs) / 1000;
            t.push(seconds);
            for (const key of STEAM_CHANNELS) {
                const value = key === 'milkTemperature' ? milk : machine[key];
                columns[key].push(typeof value === 'number' && Number.isFinite(value) ? value : null);
            }
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
