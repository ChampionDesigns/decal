/**
 * A PROFILE's target curves, in the shape <ui-chart-card> reads.
 */

import { SERIES_KEYS } from './shot-derivation.js';
import { stepTargetOverlay } from './profile-modes.js';

/** What `kind` says about one of these, so a gate-6 consumer can refuse it by name. */
export const PROFILE_PREVIEW_KIND = 'profile-preview';

/** The two channels a profile preview draws, in draw order. Both are `SERIES_KEYS`. */
export const PREVIEW_CHANNEL_KEYS = Object.freeze(['targetPressure', 'targetFlow']);

/** Why a preview refused. Each is reportable and none is a guess. */
export const PREVIEW_REFUSAL = Object.freeze({
    NO_PROFILE: 'noProfile',
    NO_STEPS: 'noSteps',
    NO_DURATION: 'noDuration',
});

const finite = (value) => (Number.isFinite(value) ? value : null);

/** Every `SERIES_KEYS` channel, empty. A preview speaks about two of them. */
function emptyPreviewSeries() {
    const series = {};
    for (const key of SERIES_KEYS) series[key] = { x: [], y: [] };
    return series;
}

function previewFrame(reason) {
    return {
        kind: PROFILE_PREVIEW_KIND,
        ok: reason === null,
        reason,
        shotId: null,
        phase: null,
        open: false,
        joinedLate: false,
        sources: Object.freeze({}),
        sourcesHeldBy: null,
        counts: Object.freeze({ samples: 0, inShot: 0, unplaceable: 0, beforeOrigin: 0 }),
        availability: Object.freeze({ scale: false, volume: false, sensors: false, weightRebased: false }),
        phases: Object.freeze({ preinfusion: null, extraction: null, total: null }),
        scalars: Object.freeze({
            durationSeconds: null, dose: null, doseSource: null, yield: null, yieldSource: null,
            ratio: null, timeToFirstDrop: null, averageFlow: null, peakFlowAfterFirstDrop: null,
            peakPressure: null, averagePressure: null, enjoyment: null,
        }),
        lastSample: null,
    };
}

/** A refusal: the shape, the reason, and empty everything. */
export function emptyProfilePreview(reason = PREVIEW_REFUSAL.NO_PROFILE) {
    return Object.freeze({
        ...previewFrame(reason),
        axis: Object.freeze({ t: Object.freeze([]), stampMs: Object.freeze([]), originMs: null, originRule: 'none' }),
        series: Object.freeze(emptyPreviewSeries()),
        stepMarks: Object.freeze([]),
        /** The programmed total, for a caller that wants it without walking the axis. */
        programmedSeconds: 0,
    });
}

export function profilePreviewDerivation(profile) {
    if (!profile || typeof profile !== 'object') return emptyProfilePreview(PREVIEW_REFUSAL.NO_PROFILE);
    const steps = Array.isArray(profile.steps) ? profile.steps.filter(Boolean) : [];
    if (steps.length === 0) return emptyProfilePreview(PREVIEW_REFUSAL.NO_STEPS);

    const xs = [];
    const pressure = [];
    const flow = [];
    const stepMarks = [];
    let heldPressure = null;
    let heldFlow = null;
    let t = 0;

    for (const step of steps) {
        const seconds = Number(step.seconds);
        const overlay = stepTargetOverlay(step);
        const targetPressure = finite(overlay.pressure);
        const targetFlow = finite(overlay.flow);

        stepMarks.push(Object.freeze({
            t,
            name: typeof step.name === 'string' && step.name !== '' ? step.name : null,
        }));

        if (!(seconds > 0)) continue;

        const smooth = step.transition === 'smooth';
        const startPressure = smooth ? (heldPressure ?? targetPressure) : targetPressure;
        const startFlow = smooth ? (heldFlow ?? targetFlow) : targetFlow;

        xs.push(t, t + seconds);
        pressure.push(startPressure, targetPressure);
        flow.push(startFlow, targetFlow);

        if (targetPressure !== null) heldPressure = targetPressure;
        if (targetFlow !== null) heldFlow = targetFlow;
        t += seconds;
    }

    if (xs.length === 0) return emptyProfilePreview(PREVIEW_REFUSAL.NO_DURATION);

    const series = emptyPreviewSeries();
    const x = Object.freeze(xs);
    series.targetPressure = Object.freeze({ x, y: Object.freeze(pressure) });
    series.targetFlow = Object.freeze({ x, y: Object.freeze(flow) });

    return Object.freeze({
        ...previewFrame(null),
        axis: Object.freeze({ t: x, stampMs: Object.freeze([]), originMs: null, originRule: 'none' }),
        series: Object.freeze(series),
        stepMarks: Object.freeze(stepMarks),
        programmedSeconds: t,
    });
}
