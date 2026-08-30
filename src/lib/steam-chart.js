/**
 * steam-chart.js — WHAT THE LIVE CHART DRAWS WHILE THE MACHINE IS STEAMING.
 *
 * WHY IT EXISTS. Ben, 24 August 2026: "There is a steam chart that is shown in the live
 * view when steaming." The old skin swaps the Live page's chart to a steam graph for the
 * session and holds it for a settle window afterwards; Decal drew the espresso chart
 * through every steam and then went back to the last shot, which on a steam is a picture
 * of something that happened ten minutes ago.
 *
 * PORTED FROM `slate/app/src/modules/steam-chart.js`, which is already a pure, DOM-free
 * module with its own reasoning written down. What changed on the way over is named at
 * each point; nothing that was a MEASUREMENT there is a guess here.
 *
 * ===========================================================================
 * ONLY THE POURING SUBSTATE IS STEAMING
 * ===========================================================================
 * The machine reports state `steam` for the WHOLE session, the ramp-up before the valve
 * opens and the wind-down after it closes included. Graphing all of it buries the actual
 * steaming between two irrelevant humps — so the ORIGIN is the first pouring sample, the
 * same convention the espresso path already uses.
 *
 * ===========================================================================
 * OWNING THE CANVAS AND PLOTTING INTO IT ARE SEPARATE EVENTS
 * ===========================================================================
 * Pressing steam takes the canvas straight away — the empty steam axes appear at once
 * rather than the espresso chart lingering through the ~4 s ramp — while plotting still
 * waits for the valve. `poured` is what tells "waiting to start" from "finished, now
 * settling", and it is why the precedence below is not symmetric.
 */

import { MACHINE_STATE, MACHINE_SUBSTATE } from '../data/machine-state.js';

/** How long the steam graph stays on screen after steaming stops. Slate's own 10 s. */
export const STEAM_HOLD_MS = 10000;

/** The two modes the Live chart can be in. */
export const CHART_MODE = Object.freeze({ ESPRESSO: 'espresso', STEAM: 'steam' });

/**
 * The substate that counts as steaming.
 *
 * Slate hard-codes the string `'pouring'` and mirrors ReaPrime's own enum in a comment.
 * Here it comes off the generated enum, which is the rule this tree already follows for
 * every other state name: a hand copy is how the old skin shipped a state in neither
 * direction.
 */
export const STEAM_ACTIVE_SUBSTATE = MACHINE_SUBSTATE.POURING;

/** True when this frame is real steaming rather than a bracketing phase. */
export function isSteamPouring(substate) {
    return substate === STEAM_ACTIVE_SUBSTATE;
}

/**
 * The two fixed axes.
 *
 * BOTH ARE FIXED, and Slate's reasoning is the whole of it: a steam session has no
 * meaningful autoscale, and a moving axis makes consecutive sessions impossible to
 * compare by eye. Each runs PAST its last label so a trace sitting on that label stays
 * visible instead of being clipped by the plot edge — and the two tops are chosen so the
 * labels land on the same gridline (6/6.5 === 180/195), which makes one primary unit
 * exactly 30 °C and every gridline coincide.
 */
export const STEAM_Y_RANGE = Object.freeze([0, 6.5]);          // bar and mL/s

export const STEAM_Y2_RANGE = Object.freeze([0, 195]);         // °C

/** The channels the steam chart draws, in render order. Actuals above their target. */
export const STEAM_CHANNELS = Object.freeze([
    'targetFlow', 'pressure', 'flow', 'steamTemperature', 'milkTemperature',
]);

/** Which of them belong on the RIGHT axis. */
export const STEAM_Y2_CHANNELS = Object.freeze(['steamTemperature', 'milkTemperature']);

/**
 * The channel list as `<ui-chart-card>`'s `channelKeys` property takes it.
 *
 * OBJECTS AND NOT STRINGS, because two of the five belong on the OTHER AXIS and a string
 * cannot say so. A temperature drawn against the 0..6.5 bar scale is a line pinned to the
 * top of the plot for the whole session — which is what the first draft did, and it looks
 * exactly like a chart with no temperature on it.
 *
 * THE TARGET IS DOTTED AND MINOR, which is the espresso chart's own convention for a
 * commanded value beside its actual (§6.2), read off `CHANNEL_TREATMENTS` rather than
 * restated: a target that drew like an actual is the pair nobody can tell apart.
 */
export const STEAM_CHANNEL_SPECS = Object.freeze(STEAM_CHANNELS.map((key) => Object.freeze({
    key,
    ...(STEAM_Y2_CHANNELS.includes(key) ? { scale: 'y2' } : null),
    ...(key === 'targetFlow' ? { dash: true, minor: true } : null),
})));

/**
 * THE CHANNEL LIST FOR A SESSION, WITH OR WITHOUT A MILK PROBE.
 *
 * Ben, 25 August 2026: the steam chart "works well in slate, but is poorly done in
 * Decal. I need it to look & behave the same." This is one of the two differences.
 *
 * SLATE OMITS THE MILK TRACE ENTIRELY WHEN THERE IS NO PROBE, and its own signature says
 * so: `steamChartTraceSpecs(palette, { milk })`, filtering `milk || key !== `
 * `'milkTemperature'`. Decal drew all five always, and the buffer records milk as null
 * on a machine with no probe (`steam-buffer.js`: "the milk probe's temperature, or null"),
 * so the fifth series was a trace of nothing — and once the settle labels arrive it would
 * be a label of nothing too.
 *
 * A SERIES OF NULLS IS NOT THE SAME AS NO SERIES, which is why this is a filter and not a
 * paint change. The two look alike on the plot and differ everywhere it matters: a series
 * still holds a colour token, still takes a slot in the data array the card aligns, and
 * still names itself to anything reading the chart.
 */
export function steamChannelSpecs({ milk = false } = {}) {
    return Object.freeze(STEAM_CHANNEL_SPECS.filter(
        (spec) => milk || spec.key !== 'milkTemperature',
    ));
}

/**
 * THE LABEL DRAWN AT EACH TRACE'S END WHEN THE SESSION SETTLES — the other difference.
 *
 * Slate's `steamEndLabels`, and its reason is the whole of it: "Steam's only key: it has
 * no legend and no KPI strip naming its two axes, so two lines against different scales
 * would otherwise be unlabelled. They appear when the session settles, which is when
 * there is time to read them."
 *
 * NOT WHILE IT RUNS. A label pinned to a moving endpoint is a word sliding across the plot
 * at 15 Hz, which is harder to read than no word at all. `chartModeFor` already computes
 * the settle window — the hold that keeps the steam graph up for `STEAM_HOLD_MS` after the
 * valve closes — so "settled" is a state the fold already knows and not a new timer.
 *
 * THE TARGET IS NOT LABELLED. Slate drops it and names why: "a command, not a
 * measurement". Four traces, three labels.
 *
 * COLOUR IS THE CALLER'S. A label takes the ink of the trace it names, and the channel
 * inks are CSS custom properties read at paint time (A6) — so this returns the channel KEY
 * and the screen resolves it against the tokens it has already read for the plot.
 *
 * @param {object} derivation  the steam buffer's published `{ok, series}`
 * @param {object[]} specs     `steamChannelSpecs(...)`'s answer, so the two agree on milk
 */
export function steamEndLabels(derivation, specs) {
    if (!derivation || derivation.ok !== true) return Object.freeze([]);
    const labels = [];
    for (const spec of specs) {
        if (spec.key === 'targetFlow') continue;
        const series = derivation.series?.[spec.key];
        const xs = series?.x ?? [];
        const ys = series?.y ?? [];
        let last = -1;
        for (let i = ys.length - 1; i >= 0; i -= 1) {
            if (typeof ys[i] === 'number' && Number.isFinite(ys[i])) { last = i; break; }
        }
        if (last < 0) continue;
        labels.push(Object.freeze({
            key: spec.key,
            x: xs[last],
            y: ys[last],
            scale: spec.scale === 'y2' ? 'y2' : 'y',
        }));
    }
    return Object.freeze(labels);
}

/** Initial mode state. The Live screen boots showing espresso. */
export function initialChartMode() {
    return Object.freeze({ mode: CHART_MODE.ESPRESSO, holdUntil: null, poured: false });
}

/**
 * Fold one machine frame into the chart-mode state.
 *
 * PRECEDENCE, and it is deliberate:
 *   espresso                 -> espresso at once, even mid-hold. A new shot must never
 *                               hide behind the previous steam session.
 *   pouring                  -> steam, any pending hold cancelled.
 *   in steam, not poured yet  -> steam, no hold: the canvas is claimed and waiting.
 *   in steam, poured          -> steam, held for STEAM_HOLD_MS from the valve closing.
 *   left steam, poured        -> keep holding out the settle window.
 *   left steam, never poured  -> straight back to espresso; nothing was plotted, so there
 *                               is nothing to settle on.
 *
 * @param {{mode, holdUntil, poured}} prev
 * @param {{state: string, substate: string, now: number}} frame
 * @returns {{mode, holdUntil, poured, changed: boolean}}
 */
export function chartModeFor(prev, { state, substate, now }) {
    const previous = prev || initialChartMode();
    const inSteam = state === MACHINE_STATE.STEAM;
    const pouring = inSteam && isSteamPouring(substate);
    const espresso = state === MACHINE_STATE.ESPRESSO;
    let next;

    const hold = (poured) => {
        if (previous.holdUntil === null) {
            return { mode: CHART_MODE.STEAM, holdUntil: now + STEAM_HOLD_MS, poured };
        }
        if (now >= previous.holdUntil) {
            return { mode: CHART_MODE.ESPRESSO, holdUntil: null, poured: false };
        }
        return { mode: CHART_MODE.STEAM, holdUntil: previous.holdUntil, poured };
    };

    if (espresso) {
        next = { mode: CHART_MODE.ESPRESSO, holdUntil: null, poured: false };
    } else if (pouring) {
        next = { mode: CHART_MODE.STEAM, holdUntil: null, poured: true };
    } else if (inSteam) {
        next = previous.poured
            ? hold(true)
            : { mode: CHART_MODE.STEAM, holdUntil: null, poured: false };
    } else if (previous.mode === CHART_MODE.STEAM) {
        next = previous.poured
            ? hold(true)
            : { mode: CHART_MODE.ESPRESSO, holdUntil: null, poured: false };
    } else {
        next = { mode: CHART_MODE.ESPRESSO, holdUntil: null, poured: false };
    }

    return Object.freeze({ ...next, changed: next.mode !== previous.mode });
}

/** True once steaming has stopped and the graph is in its settle window. */
export function isSteamHoldActive(state) {
    return Boolean(state && state.mode === CHART_MODE.STEAM && state.holdUntil !== null);
}

/**
 * Milliseconds until the hold expires, or null when none is pending.
 *
 * A CALLER ARMS A TIMER ON THIS. Machine frames are what drive the mode, and a machine
 * that stops sending them mid-hold would leave the steam graph up for ever; the backstop
 * is why the hold is a deadline rather than a countdown.
 */
export function steamHoldRemainingMs(state, now) {
    if (!isSteamHoldActive(state)) return null;
    return Math.max(0, state.holdUntil - now);
}

/**
 * The x-axis end for a steam session, before any label inflation.
 *
 * The range tracks the data continuously rather than snapping to fixed steps, so the
 * right edge glides with the line — the espresso chart's own behaviour. The floor only
 * stops the very first frames rendering against a degenerate axis; past that the axis is
 * purely dynamic, and an 11 s session ends at ~11 s rather than at a padded round number.
 */
export const STEAM_MIN_X_RANGE = 4;

export function steamRangeMaxForTime(time) {
    const t = Number.isFinite(time) && time > 0 ? time : 0;
    return Math.max(STEAM_MIN_X_RANGE, t);
}
