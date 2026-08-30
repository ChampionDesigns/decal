

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

export const ENJOYMENT_KEY = 'enjoyment';

/** `WorkflowContext` — what the shot was asked to do. */
export const WORKFLOW_CONTEXT_KEYS = Object.freeze(['targetDoseWeight', 'targetYield']);

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

export function readStoredShot(record) {
    const shell = record && typeof record === 'object' && !Array.isArray(record) ? record : null;
    const measurements = shell && Array.isArray(shell.measurements) ? shell.measurements : null;
    return Object.freeze({
        ok: shell !== null,
        id: readValue(shell, 'id'),
        timestamp: readValue(shell, 'timestamp'),
        stopReason: readValue(shell, 'stopReason'),
        hasMeasurements: !!shell && hasKey(shell, 'measurements') && measurements !== null,
        measurements: measurements === null ? [] : measurements,
        annotations: readShotAnnotations(shell),
        workflow: readShotWorkflow(shell),
    });
}

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
