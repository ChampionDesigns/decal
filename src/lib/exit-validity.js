// O5 — an exit condition that can never fire, rendered identically to a valid
// one. "Flow falls below 0.0 mL/s" is not a strict setting, it is a step with
// one fewer exit than it appears to have.
//
// Deliberately conservative: only what is provably unsatisfiable from the
// CHANNEL'S DOMAIN is flagged. Pressure, flow and power are all non-negative,
// so nothing can fall below zero and everything is already past zero on entry.
// Anything that merely looks unlikely is left alone — a warning that fires on
// legitimate profiles is worse than no warning.
//
// Explicitly NOT flagged: a TARGET of 0.0 mL/s. That is a zero-flow bloom, a
// real technique, and it is a different field from an exit threshold.

/** Channels whose value cannot go below zero, so a zero threshold is degenerate. */
const NON_NEGATIVE = new Set(['pressure', 'flow', 'power']);

/**
 * Why this exit can never end the step, or null if it can.
 * @param {{type?: string, condition?: string, value?: number}} exit
 * @returns {string|null}
 */
export function deadExitReason(exit) {
    if (!exit || !NON_NEGATIVE.has(exit.type)) return null;
    const value = Number(exit.value);
    if (!Number.isFinite(value) || value !== 0) return null;
    if (exit.condition === 'under') return 'never fires — cannot fall below zero';
    return 'fires immediately — already past zero';
}

/** True when the exit is provably incapable of ending its step. */
export function isDeadExit(exit) {
    return deadExitReason(exit) !== null;
}

export function exitValueMin(condition, step = 0.1) {
    return condition === 'under' ? step : 0;
}

export function remainingExitsNote(step) {
    const remaining = [];
    if (Number(step?.volume) > 0) remaining.push(`${Number(step.volume)} mL`);
    if (Number(step?.weight) > 0) remaining.push(`${Number(step.weight)} g`);
    if (Number(step?.seconds) > 0) remaining.push(`${Number(step.seconds)} s`);
    if (remaining.length === 0) return 'nothing else ends this step';
    return `ends on ${remaining.join(' or ')}`;
}
