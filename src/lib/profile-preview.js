/**
 * profile-preview.js — a PROFILE's target curves, in the shape `<ui-chart-card>` reads.
 *
 * Wave 5.3, `sel-core-loop` bullet 1 ("show the selected profile's chart and notes") and
 * `bug-chartC3-unpadded-preview-host`.
 *
 * ===========================================================================
 * WHY THIS FILE EXISTS, SAID PLAINLY
 * ===========================================================================
 * `src/lib/shot-derivation.js` is gate 6 and it derives SHOTS: it takes a sample buffer
 * or a stored record and reads MEASURED values off it. The selector's detail pane draws
 * something else entirely — a profile that has never been run, whose curves are the
 * COMMANDED targets its steps declare. There is no producer for that anywhere in the
 * tree, and wave 5.3's skeleton recorded the gap rather than inventing one:
 *
 *     "src/lib/shot-derivation.js exports emptyShotDerivation / createShotDerivationVisitor
 *      / deriveFromBuffer / deriveFromRecord / shiftSeriesX / indexAtTime and derives SHOTS
 *      only … the builder must either add one or feed the card a derivation-shaped object."
 *
 * This is the second of those two, and it is deliberately NOT the first. Nothing here
 * touches gate 6, and gate 6 does not learn about profiles: a shot derivation carries
 * sources, availability, counts, phases and scalars, every one of which is a statement
 * about samples that exist. A profile has no samples, so a "profile mode" inside gate 6
 * would be a second shape wearing the first one's name — and `deriveFromRecord`'s
 * callers would have to start asking which kind they were holding.
 *
 * WHAT IT COMPOSES, RATHER THAN RESTATES:
 *
 *   `profile-modes.js` `stepTargetOverlay(step)` — the per-step commanded values, ALREADY
 *   the gate-7 port of the editor's preview-graph rules and already the single owner of
 *   "what does a Power step command?". Its own header states the contract this file
 *   depends on: "returns NULL for a channel the step does not command, so the trace shows
 *   a GAP rather than a commanded zero". A pressure step commands no flow, and drawing
 *   flow 0 under it is a lie about the machine.
 *
 *   `shot-derivation.js` `SERIES_KEYS` — the channel vocabulary, so a key that is not a
 *   real channel cannot be produced here. The two keys used are `targetPressure` and
 *   `targetFlow`, which are gate 6's STEPPED_CHANNELS: "the two channels that carry the
 *   vertical-step anchor, and therefore the only two with an x array of their own". A
 *   profile preview is nothing BUT that anchor, which is why those are the right two.
 *
 * ===========================================================================
 * THE SHAPE, AND EXACTLY HOW MUCH OF IT THE CARD READS
 * ===========================================================================
 * `<ui-chart-card>` reads four things off a derivation and nothing else
 * (`ui-chart-card.js:501-541`): `ok`, `series`, `axis.t`, `stepMarks`. So this module
 * fills those four honestly and fills the REST OF THE SHOT SHAPE with the refusal
 * values `emptyShotDerivation` uses — never with plausible-looking numbers.
 *
 * That is the whole reason `kind: 'profile-preview'` is on the object. A caller that
 * reaches for `scalars.dose` on one of these gets `null`, the same answer a shot with no
 * scale gives, and the caller cannot tell the two apart from the value alone. It can from
 * `kind`, and `phaseRows()`, `deriveFromBuffer()` and every other gate-6 consumer will
 * never see one of these because the selector is the only screen that makes them.
 *
 * ===========================================================================
 * THE CURVE, AND WHY THERE ARE TWO POINTS PER STEP
 * ===========================================================================
 * A step declares a duration (`seconds`) and a commanded value. Two points — one at the
 * step's start, one at its end — is what makes a FAST transition draw as a riser and a
 * SMOOTH one draw as a ramp:
 *
 *     fast    (t0, v)     (t1, v)        a flat hold; the riser is the segment from the
 *                                        previous step's end point, which sits at the
 *                                        SAME x, so the line is vertical
 *     smooth  (t0, prev)  (t1, v)        a ramp across the step from wherever the
 *                                        previous step left the channel
 *
 * DUPLICATE X VALUES AT THE BOUNDARIES ARE DELIBERATE AND ARE SAFE HERE, and the reason
 * is `chart-align.js`: `alignChannels` takes its fast path — `[xs, ...ys]`, no union, no
 * de-duplication — when every listed channel has an x array of the same length. Both
 * channels this module emits are built off one loop and therefore share one x grid, so
 * the fast path is always the one taken. Building them separately would drop every
 * boundary to a single point through the `Set` union and turn every riser into a slope.
 * That is the one coupling in this file and it is asserted by its suite.
 *
 * A STEP WITH NO DURATION CONTRIBUTES NO POINTS. `seconds: 0` is a legal profile step and
 * a zero-width segment is not a curve; it still contributes its STEP MARK, so the
 * boundary is drawn and named even where there is nothing between it and the next.
 *
 * NO DOM, no store, no endpoint — `src/lib/` is "plain ES modules with no DOM access", so
 * every line here runs under `node:test`.
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

/**
 * The non-curve half of the shape, matching `emptyShotDerivation`'s refusal values.
 *
 * NOTHING IS INVENTED HERE. Every field is the value gate 6 uses to say "no answer", so a
 * consumer that reads one gets the same "no" it would get from a shot with no samples,
 * rather than a number this module made up out of a profile's intentions.
 */
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

/**
 * Turn a ReaPrime `Profile` into the derivation-shaped object `<ui-chart-card>` reads.
 *
 * @param {object|null} profile  a `Profile.toJson` body — the `profile` field of a
 *        `ProfileRecord`, NOT the record. A record has no `steps`, and handing one in is
 *        the mistake this signature is written to make obvious.
 * @returns {object} frozen. `ok:false` with a `reason` when there is nothing to draw.
 */
export function profilePreviewDerivation(profile) {
    if (!profile || typeof profile !== 'object') return emptyProfilePreview(PREVIEW_REFUSAL.NO_PROFILE);
    const steps = Array.isArray(profile.steps) ? profile.steps.filter(Boolean) : [];
    if (steps.length === 0) return emptyProfilePreview(PREVIEW_REFUSAL.NO_STEPS);

    const xs = [];
    const pressure = [];
    const flow = [];
    const stepMarks = [];
    /* The last value each channel actually COMMANDED, so a smooth transition ramps from
     * where the trace really is rather than from zero. A channel that has never been
     * commanded ramps from its own target, which draws as a hold — the honest picture of
     * "this is the first step that says anything about flow". */
    let heldPressure = null;
    let heldFlow = null;
    let t = 0;

    for (const step of steps) {
        const seconds = Number(step.seconds);
        const overlay = stepTargetOverlay(step);
        const targetPressure = finite(overlay.pressure);
        const targetFlow = finite(overlay.flow);

        /* THE MARK IS EMITTED FOR EVERY STEP, including a zero-length one: a boundary
         * that exists in the profile exists on the chart, named, even where it has no
         * width. `ui-chart-card.js:536` skips a mark with a non-finite t, so `t` is
         * always a number by the time it lands here. */
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
    /* ONE x ARRAY, SHARED BY REFERENCE. See the header: `alignChannels`'s fast path needs
     * both channels to be the same length, and sharing the array makes that structural
     * rather than something a later edit has to remember. */
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
