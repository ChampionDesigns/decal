/**
 * The profile draft: the working copy a screen edits, and the rules that keep it valid.
 */

import {
    newStep, seedStepForPump, limiterOnClear,
    LIMITER_TOLERANCES, limiterToleranceOfStep,
} from './profile-modes.js';
import { exitBand } from './exit-sentence.js';

/** The four event names this module applies. Spelled once, imported by the screen. */
export const EDITOR_EDIT = Object.freeze({
    STEP_CHANGE: 'step-change',
    VALUE_COMMIT: 'value-commit',
    EXIT_CONDITION_CHANGE: 'exit-condition-change',
    LEVER_CHANGE: 'lever-change',
    EXIT_REMOVE: 'exit-remove',
});

/** The step key whose event value is the inner `.value` of an object. */
const LIMITER_FIELD = 'limiter';

/** The step key whose assignment is a mode reseed rather than a write. */
const PUMP_FIELD = 'pump';

const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

const refuse = (draft, reason) => Object.freeze({ draft, applied: false, reason });

function withStep(draft, index, change) {
    if (!isObject(draft)) return refuse(draft, 'the draft is not a profile object');
    const steps = Array.isArray(draft.steps) ? draft.steps : null;
    if (!steps) return refuse(draft, 'the draft carries no steps array');
    if (!Number.isInteger(index) || index < 0 || index >= steps.length) {
        return refuse(draft, `no step at index ${index}`);
    }
    const next = change({ ...steps[index] });
    if (!isObject(next)) return refuse(draft, 'the edit produced no step');
    return Object.freeze({
        draft: { ...draft, steps: steps.map((step, i) => (i === index ? next : step)) },
        applied: true,
        reason: null,
    });
}

/**
 * `step-change` and `value-commit` — one cell's value moved.
 *
 * @param {object|null} draft
 * @param {{index:number, field:string, value:*}} detail
 */
export function applyStepValue(draft, { index, field, value } = {}) {
    if (typeof field !== 'string' || field === '') {
        return refuse(draft, 'the edit named no field');
    }
    return withStep(draft, index, (step) => {
        if (field === LIMITER_FIELD) {
            const held = isObject(step.limiter) ? step.limiter : limiterOnClear(step.pump);
            return { ...step, limiter: { ...held, value } };
        }
        if (field === PUMP_FIELD) {
            if (isObject(step.limiter)) step.limiter = { ...step.limiter };
            return seedStepForPump(step, value);
        }
        return { ...step, [field]: value };
    });
}

/**
 * `exit-condition-change` — the exit dialog confirmed a condition for one step.
 *
 * @param {object|null} draft
 * @param {{index:number, type:string, condition:string, value:number}} detail
 */
export function applyExitCondition(draft, { index, type, condition, value } = {}) {
    return withStep(draft, index, (step) => ({
        ...step,
        exit: { type, condition, value },
    }));
}

export function applyExitRemove(draft, { index, slot } = {}) {
    if (slot === 'condition') {
        return withStep(draft, index, (step) => ({ ...step, exit: null }));
    }
    const record = exitBand(null).find((entry) => entry.slot === slot) ?? null;
    if (!record || record.field === 'exit') {
        return refuse(draft, `no draft rule for exit slot '${slot}'`);
    }
    return withStep(draft, index, (step) => ({ ...step, [record.field]: 0 }));
}

export function applyLeverChange(draft, { index, leverSpring, leverGive } = {}) {
    return withStep(draft, index, (step) => ({ ...step, leverSpring, leverGive }));
}

/**
 * The limiter tolerance: one profile-wide setting, written to `step.limiter.range` on
 * every step whose limiter is measured in that tolerance's unit. Its own door rather than
 * a case in `applyEditorEdit`, because it names no step index.
 *
 * A STEP WITH NO LIMITER OBJECT IS LEFT ALONE. `limiter: null` is how a step says it has
 * no limit, and a step with no limit has no knee to widen — writing one would put content
 * into the profile that nobody authored. A profile with no such limiter is REFUSED, so
 * the caller can disable the control rather than offer one that writes nothing.
 *
 * @param {object|null} draft
 * @param {{tolerance:string, value:number}} detail  `tolerance` is one of LIMITER_TOLERANCES
 * @returns {{draft:object|null, applied:boolean, reason:string|null}}
 */
export function applyLimiterTolerance(draft, { tolerance, value } = {}) {
    if (!LIMITER_TOLERANCES.includes(tolerance)) {
        return refuse(draft, `'${tolerance}' is not a limiter tolerance `
            + `(${LIMITER_TOLERANCES.join(', ')})`);
    }
    if (!Number.isFinite(value)) return refuse(draft, 'the tolerance is not a number');
    if (!isObject(draft)) return refuse(draft, 'the draft is not a profile object');
    const steps = Array.isArray(draft.steps) ? draft.steps : null;
    if (!steps) return refuse(draft, 'the draft carries no steps array');

    let reached = 0;
    const next = steps.map((step) => {
        if (!isObject(step) || !isObject(step.limiter)) return step;
        if (limiterToleranceOfStep(step) !== tolerance) return step;
        reached += 1;
        if (step.limiter.range === value) return step;
        return { ...step, limiter: { ...step.limiter, range: value } };
    });

    if (reached === 0) {
        return refuse(draft, `no step in this profile carries a ${tolerance} limiter`);
    }
    return Object.freeze({ draft: { ...draft, steps: next }, applied: true, reason: null });
}

export function applyEditorEdit(draft, name, detail = {}) {
    switch (name) {
        case EDITOR_EDIT.STEP_CHANGE:
        case EDITOR_EDIT.VALUE_COMMIT:
            return applyStepValue(draft, detail);
        case EDITOR_EDIT.EXIT_CONDITION_CHANGE:
            return applyExitCondition(draft, detail);
        case EDITOR_EDIT.LEVER_CHANGE:
            return applyLeverChange(draft, detail);
        case EDITOR_EDIT.EXIT_REMOVE:
            return applyExitRemove(draft, detail);
        default:
            return refuse(draft, `no draft rule for '${name}'`);
    }
}

export const STEP_ACTIONS = Object.freeze([
    'move-left', 'delete', 'insert-after', 'duplicate', 'move-right',
]);

/** Rule 1 above, as the number it is: a profile is never left with fewer steps than this. */
export const MIN_PROFILE_STEPS = 1;

/** The profile key that points at the preinfusion step. Rule 2 above. */
const VOLUME_COUNT_KEY = 'target_volume_count_start';

/** The transition that has no meaning on step 1. Rule 3 above. */
const HOLD_TRANSITION = 'hold';

/** A refusal that still answers "where is the person" — see the door's shape note. */
const refuseAction = (draft, index, reason) => Object.freeze({
    draft, applied: false, reason, index,
});

/**
 * The preinfusion marker as a 0-BASED step index, or -1 for None.
 * A profile that does not carry the key at all also answers -1, and `withMarker` then
 * declines to invent one.
 */
function markerIndex(draft) {
    const raw = draft[VOLUME_COUNT_KEY];
    return Number.isInteger(raw) && raw > 0 ? raw - 1 : -1;
}

function withMarker(profile, source, marker) {
    if (!Object.prototype.hasOwnProperty.call(source, VOLUME_COUNT_KEY)) return profile;
    return { ...profile, [VOLUME_COUNT_KEY]: marker < 0 ? 0 : marker + 1 };
}

function withoutLeadingHold(steps, was) {
    if (steps[0] === was) return steps;
    if (steps[0] && steps[0].transition === HOLD_TRANSITION) {
        steps[0] = { ...steps[0], transition: 'fast' };
    }
    return steps;
}

function copyStep(step) {
    const copy = { ...step };
    if (isObject(step.limiter)) copy.limiter = { ...step.limiter };
    if (isObject(step.exit)) copy.exit = { ...step.exit };
    return copy;
}

export function applyStepAction(draft, { action, index } = {}, { stepName = '' } = {}) {
    if (!STEP_ACTIONS.includes(action)) {
        return refuseAction(draft, index, `no draft rule for the step action '${action}'`);
    }
    if (!isObject(draft)) return refuseAction(draft, index, 'the draft is not a profile object');
    const steps = Array.isArray(draft.steps) ? draft.steps : null;
    if (!steps) return refuseAction(draft, index, 'the draft carries no steps array');
    const floor = action === 'insert-after' ? -1 : 0;
    if (!Number.isInteger(index) || index < floor || index >= steps.length) {
        return refuseAction(draft, index, `no step at index ${index}`);
    }

    const next = steps.slice();
    let marker = markerIndex(draft);
    let here = index;

    if (action === 'move-left' || action === 'move-right') {
        const to = action === 'move-left' ? index - 1 : index + 1;
        if (to < 0 || to >= next.length) {
            return refuseAction(draft, index,
                `step ${index + 1} is already at that end, so '${action}' has nowhere to go`);
        }
        const moved = next[index];
        next[index] = next[to];
        next[to] = moved;
        if (marker === index) marker = to;
        else if (marker === to) marker = index;
        here = to;
    } else if (action === 'delete') {
        if (next.length <= MIN_PROFILE_STEPS) {
            return refuseAction(draft, index,
                'the last step cannot be deleted — a profile with no steps has no step '
                + 'columns, so it has no action rail either and there is no way back');
        }
        next.splice(index, 1);
        if (marker === index) marker = -1;
        else if (marker > index) marker -= 1;
        /* THE CARET LANDS ON WHATEVER TOOK THIS COLUMN'S PLACE — the step that shifted
         * left into it, or the new last step when the deleted one was the last. */
        here = Math.min(index, next.length - 1);
    } else {
        const at = index + 1;
        next.splice(at, 0, action === 'duplicate'
            ? copyStep(steps[index])
            : newStep({ name: stepName }));
        if (marker >= at) marker += 1;
        here = at;
    }

    const withSteps = { ...draft, steps: withoutLeadingHold(next, steps[0]) };
    return Object.freeze({
        draft: withMarker(withSteps, draft, marker),
        applied: true,
        reason: null,
        index: here,
    });
}

export function renameBody(baseline, title) {
    if (!isObject(baseline)) return null;
    const wanted = typeof title === 'string' ? title.trim() : '';
    if (wanted === '') return null;
    return { ...baseline, title: wanted };
}
