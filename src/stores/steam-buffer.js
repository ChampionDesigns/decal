// steam-buffer.js — THE STEAM SESSION, AS SOMETHING THE LIVE CHART CAN DRAW.
//
// WHY IT IS NOT THE SHOT BUFFER. `shot-buffer.js` opens and closes on
// `/ws/v1/machine/shotState` — ReaPrime's SEQUENCER — and the sequencer runs for
// ESPRESSO only (`de1_state_manager.dart` starts one in `_handleTrackingModeForEspresso`
// and `_handleDisabledModeForEspresso`; `_handleSteamState` starts nothing). So there is
// no shot around a steam, no shotState frames, and nothing for that buffer to hold. The
// old skin does not use its shot path either: it plots a steam straight off the machine
// snapshot.
//
// WHAT IT ACCUMULATES, and where each channel comes from:
//   pressure, flow, targetFlow, steamTemperature   /ws/v1/machine/snapshot (SNAPSHOT_KEYS)
//   milkTemperature                                the milk-probe sensor socket
// Milk is on a different socket because ReaPrime removed `milkTemperature` from
// MachineSnapshot in 633f6f68; reading it off the snapshot would read a field the machine
// stopped sending.
//
// t = 0 IS THE FIRST POURING SAMPLE. The machine reports `steam` for the whole session,
// the ramp-up and the wind-down included, and graphing all of it buries the steaming
// between two irrelevant humps — `steam-chart.js` carries the reasoning and the rule.
// Samples before the valve opens are DROPPED rather than kept at negative t: an espresso's
// preinfusion is part of the shot and a steam's ramp is not part of the steaming.
//
// IT PUBLISHES A DERIVATION SHAPE, so `<ui-chart-card>` takes it with no second code path:
// `{ok, axis:{t}, series:{key:{x,y}}}` is the whole of what that card reads.

import { createStore } from './store.js';
import { CHART_MODE, STEAM_CHANNELS } from '../lib/steam-chart.js';

/**
 * How many samples one session may hold — Ben's number, 25 August 2026: "Sample cap Steam:
 * good to have but can reduce to 2000." A 15 Hz feed fills it in a little over two minutes,
 * which is longer than any steaming and shorter than the espresso cap by the ratio the two
 * jobs actually differ by. It was 9,000, which was the espresso cap's arithmetic applied to
 * a session that never runs that long.
 */
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

    /**
     * The published series, built ONCE per session over the LIVE arrays.
     *
     * NOTHING IS COPIED, and that is a measured decision rather than a style. Slicing six
     * arrays on every sample is O(n^2) over a session — 9000 samples took 2.6 s in the
     * suite before this — and the layer underneath is written for exactly this: uPlot's
     * host says "Append-safe: nothing is copied" of the records it is handed. What makes
     * a publish a CHANGE is the new state object, which is what a consumer compares.
     */
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
        /* THE X ARRAY IS THE SHARED AXIS FOR EVERY CHANNEL, which is the shape the card's
         * cursor indexes into. A channel with no reading yet still gets the axis and a
         * null at that index, so the arrays stay the same length and a gap draws as a gap
         * rather than shifting the line left. */
        series = Object.freeze(Object.fromEntries(
            STEAM_CHANNELS.map((key) => [key, Object.freeze({ x: t, y: columns[key] })]),
        ));
    };

    reset();

    return {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },

        /**
         * Take one frame.
         *
         * THE MODE DECIDES, NOT THIS STORE. `chartModeFor` already answers "is this a
         * steam session, and is it pouring"; asking the same question a second way here
         * is how two answers appear. What this owns is the accumulation.
         *
         * A NEW SESSION CLEARS THE OLD ONE, and the trigger is the mode leaving steam
         * rather than a session id — the machine issues none. So a hold that expires and
         * a steam that follows an espresso both arrive as `mode: espresso` first, and the
         * next pouring sample starts from zero.
         *
         * @param {object} frame
         * @param {string} frame.mode      the resolved chart mode
         * @param {boolean} frame.pouring  is the valve open on this frame
         * @param {object|null} frame.machine  a machine snapshot reading, or null
         * @param {number|null} frame.milk     the milk probe's temperature, or null
         * @param {number} frame.at        the frame's own timestamp, in ms
         */
        take({ mode, pouring, machine, milk = null, at = now() } = {}) {
            if (mode !== CHART_MODE.STEAM) {
                if (t.length === 0 && originMs === null) return store.get();
                /* LEAVING STEAM ENDS THE SESSION. The samples stay published until the
                 * next one starts, because the hold's whole purpose is to keep the
                 * finished graph on screen for the settle window. */
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
                /* PUBLISHED ONCE, AT THE CAP. A session that runs past it is being
                 * dropped from now on and the count only grows; republishing per dropped
                 * sample would be churn for a number nobody is watching change. */
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
