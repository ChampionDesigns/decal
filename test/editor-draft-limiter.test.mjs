/**
 * editor-draft-limiter.test.mjs — ARMING A LIMITER FROM A STORED `null` (audit F-048).
 *
 * Ben, 29 August 2026: "add a limiter... press save... an error, something about null."
 *
 * WHAT WENT WRONG, IN ONE LINE. `applyStepValue`'s limiter branch read
 * `isObject(step.limiter) ? step.limiter : {}` — so a step whose profile stores
 * `limiter: null` (64 of the 147 fixture records carry at least one) armed as
 * `{"value": 0.1}` with NO `range`. ReaPrime's `StepLimiter.fromJson` hands that null
 * `range` to `parseDouble(String)` and answers 500 on a create, 400 on an update, and the
 * draft stays poisoned: stepping back to OFF leaves `{"value": 0}`, still rangeless, and
 * the NEXT save fails identically, taking every other edit in the draft with it.
 *
 * ZERO AND ABSENT ARE ONE STATE ON THE GLASS AND TWO ON THE WIRE. A limiter stored as
 * `{value: 0, range: 0.6}` draws the same `OFF` cell and arms cleanly; that is why the
 * edge survived a whole e2e suite whose limiter test edited an already-set limiter.
 *
 * THIS FILE IS A NEW SIBLING RATHER THAN A BLOCK IN `editor-draft.test.mjs` because that
 * file carries Ben's own in-flight work (the `exit-remove` rule, 29 Aug) and the fix
 * campaign's standing order is not to edit it.
 *
 * A8: every assertion is about a returned value. Nothing here reads a source file.
 *
 * THE ORACLE IS NOT IMPORTED HERE and cannot be: it is Dart. The bodies these rules
 * produce were fed to `_audit/transitions-2026-08-29/oracle/rea_oracle.dart` in the fix
 * loop instead, and the verify log records the ACCEPTs. What this file pins is the SHAPE
 * the oracle turned out to need — a numeric `range` on every limiter that leaves here.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { applyStepValue, applyStepAction, applyEditorEdit, EDITOR_EDIT } from '../src/lib/editor-draft.js';
/* The soft-knee width has ONE declaration in this tree. Retyping 0.6 here would make this
 * file a second one, and the first thing to drift the day it moves. */
import { POWER_CAP_DEFAULT, limiterOnClear } from '../src/lib/profile-modes.js';

const step = (over = {}) => ({
    name: 'preinfusion',
    pump: 'flow',
    transition: 'fast',
    exit: null,
    volume: 0,
    seconds: 30,
    weight: 0,
    temperature: 92,
    sensor: 'coffee',
    flow: 6,
    limiter: null,
    ...over,
});

const draft = (steps = [step()]) => ({
    version: 2, title: 'Extractamundo Dos!', notes: '', author: 'Decent',
    beverage_type: 'espresso', steps, target_volume: 0, target_weight: 36,
    target_volume_count_start: 0, tank_temperature: 0,
});

/** The one property ReaPrime's parse chain needs and the old branch never wrote. */
const wellFormed = (limiter, what) => {
    assert.ok(limiter && typeof limiter === 'object', `${what}: no limiter object`);
    assert.equal(Number.isFinite(limiter.range), true,
        `${what}: range is ${JSON.stringify(limiter.range)} — ReaPrime reads it through `
        + 'parseDouble(String) and a null throws before any handler sees the body');
    assert.equal(Number.isFinite(limiter.value), true, `${what}: value is not a number`);
};

describe('arming a limiter on a step whose stored limiter is null (F-048)', () => {
    test('a null limiter is armed as a COMPLETE limiter, range and all', () => {
        const { draft: after, applied } = applyStepValue(draft(), {
            index: 0, field: 'limiter', value: 0.1,
        });
        assert.equal(applied, true);
        wellFormed(after.steps[0].limiter, 'armed from null');
        assert.equal(after.steps[0].limiter.value, 0.1, 'the typed number is the value');
    });

    test('the range is the mode factory\'s, not a number typed in this module', () => {
        const { draft: after } = applyStepValue(draft(), { index: 0, field: 'limiter', value: 4 });
        assert.equal(after.steps[0].limiter.range, limiterOnClear('flow').range);
        assert.equal(after.steps[0].limiter.range, POWER_CAP_DEFAULT.range);
    });

    test('an `undefined` limiter and a missing key are the same state', () => {
        const bare = step();
        delete bare.limiter;
        for (const [what, steps] of [
            ['undefined', [step({ limiter: undefined })]],
            ['absent', [bare]],
        ]) {
            const { draft: after } = applyStepValue(draft(steps), {
                index: 0, field: 'limiter', value: 3,
            });
            wellFormed(after.steps[0].limiter, what);
        }
    });

    test('a limiter that ALREADY has a range keeps its own — nothing is reseeded', () => {
        const { draft: after } = applyStepValue(draft([step({ limiter: { value: 9, range: 1.25 } })]), {
            index: 0, field: 'limiter', value: 4.5,
        });
        assert.deepEqual(after.steps[0].limiter, { value: 4.5, range: 1.25 });
    });

    test('stepping back to OFF leaves a COMPLETE zero, so the next save is clean too', () => {
        /* THE POISON'S SECOND HALF. The finding: "stepping the limiter back to OFF leaves a
         * rangeless {value:0}, the cell looks restored, and the NEXT Save fails
         * identically, taking every other edit in the draft with it." */
        const armed = applyStepValue(draft(), { index: 0, field: 'limiter', value: 0.1 }).draft;
        const off = applyStepValue(armed, { index: 0, field: 'limiter', value: 0 }).draft;
        wellFormed(off.steps[0].limiter, 'stepped back to OFF');
        assert.equal(off.steps[0].limiter.value, 0);
    });

    test('the power step\'s cap arms complete too — its limiter is mandatory', () => {
        const { draft: after } = applyStepValue(draft([step({ pump: 'power', power: 2, limiter: null })]), {
            index: 0, field: 'limiter', value: 6,
        });
        wellFormed(after.steps[0].limiter, 'power cap armed from null');
    });
});

describe('the three gestures that reached the poison (F-048, transition sweep E07/E08/X-dup)', () => {
    test('E07 — a pressure/flow flip does not touch the limiter, so the armed one must '
        + 'already be complete', () => {
        const armed = applyStepValue(draft(), { index: 0, field: 'limiter', value: 0.1 }).draft;
        const flipped = applyStepValue(armed, { index: 0, field: 'pump', value: 'pressure' }).draft;
        wellFormed(flipped.steps[0].limiter, 'flow -> pressure');
        const back = applyStepValue(flipped, { index: 0, field: 'pump', value: 'flow' }).draft;
        wellFormed(back.steps[0].limiter, 'pressure -> flow');
    });

    test('E08 — a flip to Power takes the CLAMP arm, not the rebuild arm, and the clamp '
        + 'carries whatever range it was given', () => {
        const armed = applyStepValue(draft(), { index: 0, field: 'limiter', value: 0.1 }).draft;
        const power = applyStepValue(armed, { index: 0, field: 'pump', value: 'power' }).draft;
        assert.equal(power.steps[0].pump, 'power');
        wellFormed(power.steps[0].limiter, 'flow -> power (clamped, not rebuilt)');
    });

    test('duplicating a null-limiter step and arming the COPY is complete too', () => {
        const copied = applyStepAction(draft(), { action: 'duplicate', index: 0 });
        assert.equal(copied.applied, true);
        const { draft: after } = applyStepValue(copied.draft, {
            index: copied.index, field: 'limiter', value: 2,
        });
        wellFormed(after.steps[copied.index].limiter, 'the duplicate, armed');
        assert.equal(after.steps[0].limiter, null, 'the original is untouched');
    });

    test('the numpad route reaches the same rule — one gesture, two doors', () => {
        const { draft: after } = applyEditorEdit(draft(), EDITOR_EDIT.VALUE_COMMIT, {
            origin: 'matrix', row: 'limiter', index: 0, field: 'limiter', value: 0.1, raw: '0.1',
        });
        wellFormed(after.steps[0].limiter, 'value-commit from null');
    });
});

describe('nothing is written in place', () => {
    test('the original step and its limiter are not mutated', () => {
        const before = draft();
        const original = before.steps[0];
        applyStepValue(before, { index: 0, field: 'limiter', value: 7 });
        assert.equal(original.limiter, null, 'the draft the surfaces still hold is unchanged');
        assert.equal(before.steps[0], original);
    });
});
