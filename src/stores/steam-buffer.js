/**
 * THE STEAM SESSION.
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

    return {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },

        take({ mode, pouring, machine, milk = null, at = now() } = {}) {
            if (mode !== CHART_MODE.STEAM) {
                if (t.length === 0 && originMs === null) return store.get();
                return store.get();
            }
            if (!pouring) {
                /* THE RAMP. The canvas is claimed and the axes are up; nothing is plotted
                 * until the valve opens, and a ramp that follows a finished session must
                 * not append to it. */
                if (originMs !== null) { reset(); return publish(); }
                return store.get();
            }
            if (!machine || machine.ok !== true) return store.get();
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
            if (t.length === 0 && originMs === null) return store.get();
            reset();
            return store.set({ ...EMPTY });
        },

        stop() { store.destroy(); },
    };
}
