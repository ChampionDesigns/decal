// THE STORED SHOT RECORD, ADDRESSED — the non-frame half of `GET /api/v1/shots/<id>`.
//
// `rea-address.js` is the reader for FRAMES: a machine snapshot, a scale snapshot, a sensor
// frame, one `measurements[]` row. A stored shot carries three things that are not frames and
// that Gate 6's derivation needs anyway:
//
//   * the record SHELL — `id`, `timestamp`, `measurements`, `workflow`, `annotations`,
//     `stopReason` (the `ShotRecord` schema, generated into `rea-routes.generated.js`);
//   * `ShotAnnotations` — where the dose actually used, the settled yield and ReaPrime's own
//     `enjoyment` rating live;
//   * the two things the shot's WORKFLOW says about it that a chart needs: the target dose,
//     and the profile's step names for the phase marks.
//
// They live here rather than in `rea-address.js` for one reason: that module is a pure frame
// reader, imported per SAMPLE at 10 Hz, and a record shell is read once per shot. Same rules,
// same primitives (`reading.js`), separate file — and, crucially, THE SAME PROHIBITION. Gate
// 6's derivation contains no server key string at all; every name ReaPrime chose for a stored
// shot is written down here, once, beside the frame names.
//
// A7 APPLIES UNCHANGED. Nothing here substitutes, integrates or guesses:
//
//   * `actualYield` absent is an ABSENCE. The derivation may prefer the settled scale weight
//     it OBSERVED, and it says which one it used — it does not silently swap them.
//   * `targetDoseWeight` is the dose that was ASKED FOR and `actualDoseWeight` is the dose
//     that went in. Two different quantities, both real, and the preference between them is
//     the caller's stated policy, not a fallback.
//   * `dose_weight` on the profile IS NOT READ. The old skin's third dose fallback reads a
//     field `Profile.toJson` does not emit, so it could only ever have produced `undefined`
//     — the fallback rule in its purest form, and it is deleted rather than ported.
//
// Shapes read AS WRITTEN at ReaPrime 2b047d02: `shot_record.dart` (ShotRecord.toJson),
// `shot_annotations.dart` (:5-14, :45-54), `workflow.dart` (WorkflowContext), `profile.dart`
// (Profile.toJson — `steps`, each with `name`). This module makes no request of its own and
// declares no route; `getShotsById` is Gate 3's contract entry.

import { ABSENCE, noReading, readNumber, readValue, readChannels, hasKey } from './reading.js';

/**
 * `ShotRecord.toJson`'s keys. Checked against the generated route table by test, so this
 * cannot drift from the documented schema without the test naming the key.
 */
export const SHOT_RECORD_KEYS = Object.freeze([
    'id',
    'timestamp',
    'measurements',
    'workflow',
    'annotations',
    'stopReason',
]);

/**
 * `ShotAnnotations`. Six modelled fields plus a free `extras` map, and NOT ONE computed shot
 * metric among them — no peak, no average, no duration, no time-to-first-drop. That absence
 * is the whole of B5: the per-shot scalars are computed in the skin for v1 because nothing
 * serves them, and R5 is the upstream ask that would let the derivation read them instead.
 */
export const SHOT_ANNOTATION_KEYS = Object.freeze([
    'actualDoseWeight',
    'actualYield',
    'drinkTds',
    'drinkEy',
    'enjoyment',
    'espressoNotes',
]);

/** The annotation keys that carry a number. `espressoNotes` is text. */
export const SHOT_ANNOTATION_NUMERIC_KEYS = Object.freeze(
    SHOT_ANNOTATION_KEYS.filter((key) => key !== 'espressoNotes'),
);

/**
 * `enjoyment` is ReaPrime's own per-shot rating: a nullable double on `ShotAnnotations`, its
 * own DB column, round-tripping through `GET /shots/<id>` and writable by a deep-merging
 * `PUT /api/v1/shots/<id>` with `{annotations:{enjoyment:n}}`.
 *
 * It REPLACES the old skin's private key-value rating, which was invisible to every other
 * client, to `/api/v1/data/export` and to shot filtering, and was orphaned for ever when the
 * shot was deleted. There is no migration: a rating that only this skin could see is not a
 * record of anything.
 *
 * ReaPrime does not bound the double. The old panel's 0..100 is a SKIN scale, so it belongs
 * to the rating control, not to the reader — this module reports the number the server holds.
 */
export const ENJOYMENT_KEY = 'enjoyment';

/** `WorkflowContext` — what the shot was asked to do. */
export const WORKFLOW_CONTEXT_KEYS = Object.freeze(['targetDoseWeight', 'targetYield']);

/**
 * Read `record.annotations`.
 *
 * An absent `annotations` object is NO_SOURCE for every field; a present object with a key
 * missing is ABSENT for that field. Both render as a dash, and neither becomes a zero.
 *
 * @param {object|null|undefined} record  a `GET /api/v1/shots/<id>` body
 */
export function readShotAnnotations(record) {
    const annotations = record && typeof record === 'object' && record.annotations
        && typeof record.annotations === 'object'
        ? record.annotations
        : null;
    return Object.freeze({
        present: annotations !== null,
        ...readChannels(annotations, SHOT_ANNOTATION_KEYS, { textKeys: ['espressoNotes'] }),
    });
}

/**
 * Read the shot's workflow: the target dose, and the profile's step names.
 *
 * Step names are what the phase marks are LABELLED with. A record whose workflow carries no
 * profile still produces marks — the boundary is a fact about the machine's `profileFrame`,
 * not about the profile listing — they simply have no name, which is `null` and renders as an
 * unlabelled tick rather than as an empty string that looks like a label that failed.
 *
 * @param {object|null|undefined} record
 */
export function readShotWorkflow(record) {
    const workflow = record && typeof record === 'object' && record.workflow
        && typeof record.workflow === 'object'
        ? record.workflow
        : null;
    const context = workflow && workflow.context && typeof workflow.context === 'object'
        ? workflow.context
        : null;
    const profile = workflow && workflow.profile && typeof workflow.profile === 'object'
        ? workflow.profile
        : null;
    const rawSteps = profile && Array.isArray(profile.steps) ? profile.steps : null;
    return Object.freeze({
        present: workflow !== null,
        title: readValue(profile, 'title'),
        ...readChannels(context, WORKFLOW_CONTEXT_KEYS),
        /** `null` when the workflow carries no profile — distinct from a profile with no steps. */
        stepNames: rawSteps === null
            ? null
            : Object.freeze(rawSteps.map((step) => (
                step && typeof step === 'object' && typeof step.name === 'string' ? step.name : null
            ))),
    });
}

/**
 * Read the record shell.
 *
 * `measurements` comes back BY REFERENCE and unparsed: parsing it is Gate 6's single walk and
 * this layer deliberately does not add a second pass over it. `ok` is false for a payload
 * that is not a shot record at all, which is a different thing from a shot with no samples.
 *
 * @param {object|null|undefined} record
 */
export function readStoredShot(record) {
    const shell = record && typeof record === 'object' && !Array.isArray(record) ? record : null;
    const measurements = shell && Array.isArray(shell.measurements) ? shell.measurements : null;
    return Object.freeze({
        ok: shell !== null,
        id: readValue(shell, 'id'),
        timestamp: readValue(shell, 'timestamp'),
        stopReason: readValue(shell, 'stopReason'),
        /**
         * A meta-only payload (the list rows, `/shots/latest`) omits `measurements` entirely.
         * That is not an empty shot — it is a record whose samples were never sent — so it is
         * reported as an absence and the derivation refuses rather than drawing nothing.
         */
        hasMeasurements: !!shell && hasKey(shell, 'measurements') && measurements !== null,
        measurements: measurements === null ? [] : measurements,
        annotations: readShotAnnotations(shell),
        workflow: readShotWorkflow(shell),
    });
}

/**
 * The dose that went in, or the dose that was asked for, or an absence — and it always says
 * WHICH.
 *
 * Two named quantities with a stated preference is not a fallback path: a ratio computed from
 * the target is a ratio for a shot nobody pulled, so the record wins where it exists, and the
 * caller can see that it did. The old third rung — `workflow.profile.dose_weight`, a field
 * that does not exist — is gone.
 *
 * @param {{annotations: object, workflow: object}} stored  a `readStoredShot` result
 * @returns {{value: number|object, source: 'actual'|'target'|null}}
 */
export function shotDose(stored) {
    const actual = stored && stored.annotations ? stored.annotations.actualDoseWeight : undefined;
    if (typeof actual === 'number' && Number.isFinite(actual) && actual > 0) {
        return Object.freeze({ value: actual, source: 'actual' });
    }
    const target = stored && stored.workflow ? stored.workflow.targetDoseWeight : undefined;
    if (typeof target === 'number' && Number.isFinite(target) && target > 0) {
        return Object.freeze({ value: target, source: 'target' });
    }
    return Object.freeze({ value: noReading(ABSENCE.ABSENT), source: null });
}

export { ABSENCE, readNumber };
