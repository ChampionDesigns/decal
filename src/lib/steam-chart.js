/**
 * What.
 */

import { MACHINE_STATE, MACHINE_SUBSTATE } from '../data/machine-state.js';

export const STEAM_HOLD_MS = 10000;

/** The two modes the Live chart can be in. */
export const CHART_MODE = Object.freeze({ ESPRESSO: 'espresso', STEAM: 'steam' });

export const STEAM_ACTIVE_SUBSTATE = MACHINE_SUBSTATE.POURING;

/** True when this frame is real steaming rather than a bracketing phase. */
export function isSteamPouring(substate) {
    return substate === STEAM_ACTIVE_SUBSTATE;
}

export const STEAM_Y_RANGE = Object.freeze([0, 6.5]);          // bar and mL/s

export const STEAM_Y2_RANGE = Object.freeze([0, 195]);         // °C

/** The channels the steam chart draws, in render order. Actuals above their target. */
export const STEAM_CHANNELS = Object.freeze([
    'targetFlow', 'pressure', 'flow', 'steamTemperature', 'milkTemperature',
]);

/** Which of them belong on the RIGHT axis. */
export const STEAM_Y2_CHANNELS = Object.freeze(['steamTemperature', 'milkTemperature']);

export const STEAM_CHANNEL_SPECS = Object.freeze(STEAM_CHANNELS.map((key) => Object.freeze({
    key,
    ...(STEAM_Y2_CHANNELS.includes(key) ? { scale: 'y2' } : null),
    ...(key === 'targetFlow' ? { dash: true, minor: true } : null),
})));

export function steamChannelSpecs({ milk = false } = {}) {
    return Object.freeze(STEAM_CHANNEL_SPECS.filter(
        (spec) => milk || spec.key !== 'milkTemperature',
    ));
}

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

export function steamHoldRemainingMs(state, now) {
    if (!isSteamHoldActive(state)) return null;
    return Math.max(0, state.holdUntil - now);
}

export const STEAM_MIN_X_RANGE = 4;

export function steamRangeMaxForTime(time) {
    const t = Number.isFinite(time) && time > 0 ? time : 0;
    return Math.max(STEAM_MIN_X_RANGE, t);
}
