/**
 * A PROFILE's ceilings, as terms a header can say out loud.
 */

import { stepTargetOverlay } from './profile-modes.js';

export const TOTALS_SEPARATOR = ' · ';

const stepsOf = (profile) => (Array.isArray(profile?.steps) ? profile.steps : []);
const positive = (value) => (Number.isFinite(value) && value > 0 ? value : null);

export function formatCeilingDuration(totalSeconds) {
    const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function profileTotals(profile) {
    const steps = stepsOf(profile);

    /* A STEP WITH NO POSITIVE DURATION IS UNBOUNDED IN TIME, so the profile is too and
     * there is no ceiling to state. An empty profile has none either — zero steps is not
     * a zero-second shot. */
    const seconds = steps.reduce((sum, step) => sum + (Number(step?.seconds) || 0), 0);
    const unbounded = steps.length === 0 || steps.some((step) => positive(Number(step?.seconds)) === null);

    const volumes = steps.map((step) => positive(Number(step?.volume))).filter((v) => v !== null);

    const pressures = steps
        .map((step) => positive(Number(stepTargetOverlay(step)?.pressure)))
        .filter((v) => v !== null);

    return Object.freeze({
        steps: steps.length,
        maxSeconds: unbounded ? null : seconds,
        capVolume: volumes.length ? Math.max(...volumes) : null,
        peakPressure: pressures.length ? Math.max(...pressures) : null,
    });
}

export function profileTotalTerms(profile) {
    const totals = profileTotals(profile);
    const terms = [
        totals.steps === 1
            ? { text: '{count} step', params: { count: totals.steps } }
            : { text: '{count} steps', params: { count: totals.steps } },
    ];
    if (totals.maxSeconds !== null) {
        terms.push({ text: 'max {duration}', params: { duration: formatCeilingDuration(totals.maxSeconds) } });
    }
    if (totals.capVolume !== null) {
        terms.push({ text: 'cap {volume} mL', params: { volume: String(totals.capVolume) } });
    }
    if (totals.peakPressure !== null) {
        terms.push({ text: 'peak {pressure} bar', params: { pressure: totals.peakPressure.toFixed(1) } });
    }
    return Object.freeze(terms.map((term) => Object.freeze(term)));
}
