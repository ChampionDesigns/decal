/**
 * The draft writer (fix run 4, dec-A-B-1).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    applyEditorEdit, applyStepValue, applyExitCondition, applyLeverChange,
    applyExitRemove, applyStepAction, renameBody, EDITOR_EDIT, STEP_ACTIONS,
} from '../src/lib/editor-draft.js';
import { newStep } from '../src/lib/profile-modes.js';

const step = (over = {}) => ({
    name: 'Preinfusion',
    pump: 'flow',
    transition: 'fast',
    exit: null,
    volume: 0,
    seconds: 30,
    weight: 0,
    temperature: 92,
    sensor: 'coffee',
    flow: 4,
    limiter: { value: 9, range: 0.6 },
    ...over,
});

const draft = (steps = [step(), step()]) => ({
    version: 2, title: 'Morning ristretto', notes: '', author: 'bench',
    beverage_type: 'espresso', steps, target_volume: 0, target_weight: 36,
    target_volume_count_start: 0, tank_temperature: 0,
});

describe('a cell value moved — step-change and value-commit are one gesture', () => {
    test('an ordinary key is written on the addressed step only', () => {
        const before = draft();
        const { draft: after, applied } = applyStepValue(before, { index: 1, field: 'temperature', value: 88 });
        assert.equal(applied, true);
        assert.equal(after.steps[1].temperature, 88);
        assert.equal(after.steps[0].temperature, 92, 'the other step is untouched');
    });

    test('the numpad\'s confirm goes through the same rule, by the same coordinates', () => {
        const a = applyEditorEdit(draft(), EDITOR_EDIT.STEP_CHANGE, { index: 0, field: 'seconds', value: 12 });
        const b = applyEditorEdit(draft(), EDITOR_EDIT.VALUE_COMMIT, {
            index: 0, field: 'seconds', value: 12, origin: 'matrix', row: 'seconds', raw: '12',
        });
        assert.deepEqual(a.draft.steps[0], b.draft.steps[0]);
    });

    test('the limiter row carries a NUMBER and the writer wraps it, keeping the range', () => {
        const { draft: after } = applyStepValue(draft(), { index: 0, field: 'limiter', value: 4.5 });
        assert.deepEqual(after.steps[0].limiter, { value: 4.5, range: 0.6 });
    });

    test('a limiter on a step that has none is created rather than refused', () => {
        const { draft: after } = applyStepValue(draft([step({ limiter: undefined })]), {
            index: 0, field: 'limiter', value: 3,
        });
        assert.deepEqual(after.steps[0].limiter, { value: 3, range: 0.6 });
    });

    test('a pump change is a RESEED, and it is the mode table\'s reseed', () => {
        const { draft: after } = applyStepValue(draft(), { index: 0, field: 'pump', value: 'pressure' });
        const seeded = after.steps[0];
        assert.equal(seeded.pump, 'pressure');
        assert.equal(seeded.flow, undefined, 'the stale target key is gone');
        assert.ok(Number.isFinite(seeded.pressure), 'the new target is seeded');
    });

    test('the reseed never reaches the draft it was given — seedStepForPump mutates', () => {
        const before = draft();
        const original = before.steps[0];
        applyStepValue(before, { index: 0, field: 'pump', value: 'lever' });
        assert.equal(original.pump, 'flow', 'the caller\'s own step object is untouched');
        assert.equal(original.flow, 4);
        assert.equal(original.leverSpring, undefined);
    });

    test('the reseed\'s NESTED write never reaches the draft either — the limiter is copied '
        + 'before the power branch clamps through it', () => {
        const before = draft([step({ limiter: { value: 0.5, range: 0.6 } })]);
        const original = before.steps[0];
        const { draft: after, applied } = applyStepValue(before, { index: 0, field: 'pump', value: 'power' });
        assert.equal(applied, true);
        assert.equal(original.limiter.value, 0.5, 'the caller\'s own limiter object is untouched');
        assert.equal(after.steps[0].limiter.value, 1, 'the new step carries the clamped cap');
        assert.notEqual(after.steps[0].limiter, original.limiter, 'and it is its own object');
    });
});

describe('the two dialogs', () => {
    test('the exit dialog\'s three parts become the step\'s exit object', () => {
        const { draft: after } = applyExitCondition(draft(), {
            index: 1, slot: 'condition', type: 'pressure', condition: 'over', value: 4,
        });
        assert.deepEqual(after.steps[1].exit, { type: 'pressure', condition: 'over', value: 4 });
    });

    test('the lever dialog writes its two parameters and nothing else', () => {
        const before = draft([step({ pump: 'lever', pressure: 8 })]);
        const { draft: after } = applyLeverChange(before, { index: 0, leverSpring: 0.6, leverGive: 1.2 });
        assert.equal(after.steps[0].leverSpring, 0.6);
        assert.equal(after.steps[0].leverGive, 1.2);
        assert.equal(after.steps[0].pressure, 8, 'P0 has its own cell and is not the dialog\'s');
    });
});

describe('an exit slot is cleared by the rule the band uses to call it occupied', () => {
    test('removing the condition writes the server\'s own empty shape', () => {
        const before = draft([step({ exit: { type: 'pressure', condition: 'over', value: 4.5 } })]);
        const { draft: after, applied } = applyExitRemove(before, { index: 0, slot: 'condition' });
        assert.equal(applied, true);
        assert.equal(after.steps[0].exit, null, 'a loaded profile carries `exit: null` verbatim');
    });

    test('removing a scalar slot writes 0, which is what `scalarOf` reads as empty', () => {
        const before = draft([step({ volume: 100, weight: 36 })]);
        const { draft: after } = applyExitRemove(before, { index: 0, slot: 'volume' });
        assert.equal(after.steps[0].volume, 0);
        assert.equal(after.steps[0].weight, 36, 'the other slot is not touched');
    });

    test('a slot the band does not own is refused, not guessed at', () => {
        const before = draft();
        const { applied, reason } = applyExitRemove(before, { index: 0, slot: 'temperature' });
        assert.equal(applied, false);
        assert.match(reason, /temperature/);
    });

    test('the door routes the event name, so the screen needs no second wire', () => {
        const before = draft([step({ exit: { type: 'flow', condition: 'under', value: 1 } })]);
        const { draft: after, applied } = applyEditorEdit(
            before, EDITOR_EDIT.EXIT_REMOVE, { index: 0, slot: 'condition' },
        );
        assert.equal(applied, true);
        assert.equal(after.steps[0].exit, null);
    });

    test('EXIT_REMOVE is in the door table the screen iterates to attach listeners', () => {
        assert.equal(EDITOR_EDIT.EXIT_REMOVE, 'exit-remove');
        assert.ok(Object.values(EDITOR_EDIT).includes('exit-remove'));
    });
});

describe('nothing is written in place — Lit compares identity', () => {
    test('the profile, the steps array and the edited step are all new objects', () => {
        const before = draft();
        const { draft: after } = applyStepValue(before, { index: 0, field: 'seconds', value: 7 });
        assert.notEqual(after, before);
        assert.notEqual(after.steps, before.steps);
        assert.notEqual(after.steps[0], before.steps[0]);
        assert.equal(after.steps[1], before.steps[1], 'an untouched step keeps its identity');
        assert.equal(before.steps[0].seconds, 30, 'the original is unchanged');
    });
});

describe('an edit that cannot be applied is REPORTED, never swallowed', () => {
    const cases = [
        ['a null draft', () => applyStepValue(null, { index: 0, field: 'seconds', value: 1 })],
        ['no steps array', () => applyStepValue({ title: 'x' }, { index: 0, field: 'seconds', value: 1 })],
        ['an index past the end', () => applyStepValue(draft(), { index: 9, field: 'seconds', value: 1 })],
        ['a negative index', () => applyStepValue(draft(), { index: -1, field: 'seconds', value: 1 })],
        ['no field named', () => applyStepValue(draft(), { index: 0, value: 1 })],
        ['an unknown event', () => applyEditorEdit(draft(), 'nope', {})],
    ];
    for (const [name, run] of cases) {
        test(name, () => {
            const result = run();
            assert.equal(result.applied, false);
            assert.ok(typeof result.reason === 'string' && result.reason.length > 0,
                'a refusal carries a reason a log can print');
        });
    }
});

describe('the rename body is the served record with one string changed', () => {
    test('it is built from the BASELINE, so unsaved step edits cannot ride along', () => {
        const baseline = draft();
        const working = applyStepValue(baseline, { index: 0, field: 'seconds', value: 99 }).draft;
        const body = renameBody(baseline, 'Evening');
        assert.equal(body.title, 'Evening');
        assert.equal(body.steps[0].seconds, 30, 'the baseline\'s content, not the draft\'s');
        assert.equal(working.steps[0].seconds, 99, 'and the draft keeps its unsaved edit');
    });

    test('the name is trimmed, and an empty one is no rename at all', () => {
        assert.equal(renameBody(draft(), '  Evening  ').title, 'Evening');
        assert.equal(renameBody(draft(), '   '), null);
        assert.equal(renameBody(draft(), ''), null);
        assert.equal(renameBody(null, 'Evening'), null);
    });

    test('nothing but the title moves', () => {
        const baseline = draft();
        const body = renameBody(baseline, 'Evening');
        assert.deepEqual({ ...body, title: baseline.title }, baseline);
    });
});

/** A named list, so a failure says which step ended up where rather than printing objects. */
const names = (profile) => profile.steps.map((s) => s.name);

/** Three named steps, so order is readable. */
const three = () => draft([
    step({ name: 'one' }), step({ name: 'two' }), step({ name: 'three' }),
]);

describe('the step list itself — move, delete, insert and duplicate', () => {
    test('move-right swaps with the next step and the caret follows the step', () => {
        const result = applyStepAction(three(), { action: 'move-right', index: 0 });
        assert.equal(result.applied, true);
        assert.deepEqual(names(result.draft), ['two', 'one', 'three']);
        assert.equal(result.index, 1, 'the person is now where the step is');
    });

    test('move-left swaps with the previous step', () => {
        const result = applyStepAction(three(), { action: 'move-left', index: 2 });
        assert.deepEqual(names(result.draft), ['one', 'three', 'two']);
        assert.equal(result.index, 1);
    });

    test('delete removes the addressed step and the caret takes its column', () => {
        const result = applyStepAction(three(), { action: 'delete', index: 1 });
        assert.deepEqual(names(result.draft), ['one', 'three']);
        assert.equal(result.index, 1, 'whatever slid left into the deleted column');
    });

    test('deleting the LAST column leaves the caret on the new last step', () => {
        const result = applyStepAction(three(), { action: 'delete', index: 2 });
        assert.deepEqual(names(result.draft), ['one', 'two']);
        assert.equal(result.index, 1, 'never an index past the end of the list');
    });

    test('insert-after seeds the shared blank step, immediately after', () => {
        const result = applyStepAction(three(), { action: 'insert-after', index: 0 },
            { stepName: 'New step' });
        assert.deepEqual(names(result.draft), ['one', 'New step', 'two', 'three']);
        assert.equal(result.index, 1, 'the caret lands on what was just created');

        const seeded = result.draft.steps[1];
        assert.deepEqual({ ...seeded, name: '' }, { ...newStep(), name: '' });
        assert.equal(seeded.name, 'New step', 'and the caller\'s translated word is used');
    });

    test('insert-after with no word from the caller leaves the name empty', () => {
        const result = applyStepAction(three(), { action: 'insert-after', index: 0 });
        assert.equal(result.draft.steps[1].name, '',
            'a module with no t() must not write an English word into a saved profile');
    });

    test('duplicate copies the step it is under, into the next slot', () => {
        const result = applyStepAction(three(), { action: 'duplicate', index: 1 });
        assert.deepEqual(names(result.draft), ['one', 'two', 'two', 'three']);
        assert.equal(result.index, 2);
        assert.deepEqual(result.draft.steps[2], result.draft.steps[1], 'by value, identical');
    });

    test('a duplicate is INDEPENDENT — its limiter and exit are its own objects', () => {
        const before = draft([step({ name: 'one', exit: { type: 'pressure', condition: 'over', value: 4 } })]);
        const result = applyStepAction(before, { action: 'duplicate', index: 0 });
        const [original, copy] = result.draft.steps;
        assert.notEqual(copy, original, 'not the same step object');
        assert.notEqual(copy.limiter, original.limiter, 'nor the same limiter object');
        assert.notEqual(copy.exit, original.exit, 'nor the same exit object');
        copy.limiter.value = 1;
        copy.exit.value = 1;
        assert.equal(original.limiter.value, 9, 'editing the copy cannot reach the original');
        assert.equal(original.exit.value, 4);
    });
});

describe('the step list — the edges the rail already declares', () => {
    test('move-left is refused on the first step, and says why', () => {
        const before = three();
        const result = applyStepAction(before, { action: 'move-left', index: 0 });
        assert.equal(result.applied, false);
        assert.match(result.reason, /already at that end/);
        assert.equal(result.draft, before, 'and nothing was rebuilt');
        assert.equal(result.index, 0, 'the caret is left exactly where it was');
    });

    test('move-right is refused on the last step', () => {
        const result = applyStepAction(three(), { action: 'move-right', index: 2 });
        assert.equal(result.applied, false);
        assert.match(result.reason, /already at that end/);
    });

    test('the last remaining step cannot be deleted', () => {
        const before = draft([step({ name: 'only' })]);
        const result = applyStepAction(before, { action: 'delete', index: 0 });
        assert.equal(result.applied, false);
        assert.match(result.reason, /last step cannot be deleted/);
        assert.deepEqual(names(before), ['only'], 'the draft is untouched');
    });

    test('at two steps, delete is allowed and lands the profile on one', () => {
        const result = applyStepAction(draft([step({ name: 'a' }), step({ name: 'b' })]),
            { action: 'delete', index: 0 });
        assert.equal(result.applied, true);
        assert.deepEqual(names(result.draft), ['b']);
    });

    test('an action nobody declared is refused by name, never guessed at', () => {
        const result = applyStepAction(three(), { action: 'shuffle', index: 0 });
        assert.equal(result.applied, false);
        assert.match(result.reason, /no draft rule for the step action 'shuffle'/);
    });

    test('an index that is not in the draft is refused', () => {
        for (const index of [-1, 3, 1.5, null, undefined]) {
            const result = applyStepAction(three(), { action: 'delete', index });
            assert.equal(result.applied, false, `index ${String(index)}`);
        }
    });

    test('the five ids this module applies are exactly five', () => {
        assert.equal(STEP_ACTIONS.length, 5);
        assert.equal(new Set(STEP_ACTIONS).size, 5);
        for (const action of STEP_ACTIONS) {
            const result = applyStepAction(three(), { action, index: 1 });
            assert.equal(result.applied, true, `${action} has a rule`);
        }
    });
});

describe('the preinfusion marker survives every reorder', () => {
    /** A three-step profile whose marker points at step 2 (1-based). */
    const marked = (at = 2) => ({ ...three(), target_volume_count_start: at });

    /** Which step the marker points at, by name, or null for None. */
    const markedStep = (profile) => {
        const at = profile.target_volume_count_start;
        return at > 0 ? profile.steps[at - 1].name : null;
    };

    test('a move carries it with the step that moved', () => {
        assert.equal(markedStep(applyStepAction(marked(), { action: 'move-right', index: 1 }).draft), 'two');
        assert.equal(markedStep(applyStepAction(marked(), { action: 'move-left', index: 1 }).draft), 'two');
    });

    test('a move of the step BESIDE it carries it too', () => {
        /* 'two' is marked; moving 'one' right past it must leave 'two' marked. */
        assert.equal(markedStep(applyStepAction(marked(), { action: 'move-right', index: 0 }).draft), 'two');
    });

    test('an insert before it pushes it along', () => {
        const after = applyStepAction(marked(), { action: 'insert-after', index: 0 }).draft;
        assert.equal(markedStep(after), 'two');
        assert.deepEqual(names(after), ['one', '', 'two', 'three']);
    });

    test('an insert AFTER it leaves it alone', () => {
        assert.equal(markedStep(applyStepAction(marked(), { action: 'insert-after', index: 2 }).draft), 'two');
    });

    test('a delete before it pulls it back', () => {
        assert.equal(markedStep(applyStepAction(marked(), { action: 'delete', index: 0 }).draft), 'two');
    });

    test('deleting the marked step itself sets the marker to None, not to its neighbour', () => {
        const after = applyStepAction(marked(), { action: 'delete', index: 1 }).draft;
        assert.equal(after.target_volume_count_start, 0);
        assert.equal(markedStep(after), null);
    });

    test('a profile that carries no marker key is not given one', () => {
        const bare = { steps: [step({ name: 'a' }), step({ name: 'b' })] };
        const after = applyStepAction(bare, { action: 'move-right', index: 0 }).draft;
        assert.equal('target_volume_count_start' in after, false,
            'adding a key the document did not have changes what the server hashes');
    });
});

describe('a HOLD step is never promoted to first', () => {
    test('moving one left into the first column drops it to a hard jump', () => {
        const before = draft([step({ name: 'a' }), step({ name: 'held', transition: 'hold' })]);
        const after = applyStepAction(before, { action: 'move-left', index: 1 }).draft;
        assert.deepEqual(names(after), ['held', 'a']);
        assert.equal(after.steps[0].transition, 'fast');
        assert.equal(before.steps[1].transition, 'hold', 'and the draft it came from is untouched');
    });

    test('deleting the step in front of one does the same', () => {
        const before = draft([step({ name: 'a' }), step({ name: 'held', transition: 'hold' })]);
        const after = applyStepAction(before, { action: 'delete', index: 0 }).draft;
        assert.equal(after.steps[0].transition, 'fast');
    });

    test('a HOLD that stays where it is keeps its transition', () => {
        const before = draft([
            step({ name: 'a' }), step({ name: 'held', transition: 'hold' }), step({ name: 'c' }),
        ]);
        const after = applyStepAction(before, { action: 'move-right', index: 1 }).draft;
        assert.deepEqual(names(after), ['a', 'c', 'held']);
        assert.equal(after.steps[2].transition, 'hold');
    });
});

describe('a structural edit writes nothing in place — Lit compares identity', () => {
    test('the draft, the steps array and every moved step are new objects', () => {
        const before = three();
        const beforeSteps = before.steps;
        const beforeNames = names(before);
        const result = applyStepAction(before, { action: 'move-right', index: 0 });

        assert.notEqual(result.draft, before, 'a new profile');
        assert.notEqual(result.draft.steps, beforeSteps, 'a new array');
        assert.deepEqual(names(before), beforeNames, 'and the original list is unchanged');
        assert.deepEqual(beforeSteps, before.steps);
    });

    test('the steps that did NOT move are the same objects, so nothing else re-renders', () => {
        const before = three();
        const untouched = before.steps[2];
        const result = applyStepAction(before, { action: 'move-right', index: 0 });
        assert.equal(result.draft.steps[2], untouched);
    });
});

test('an insert or a duplicate never rewrites a leading HOLD it did not create', () => {
    const before = draft([
        step({ name: 'imported', transition: 'hold' }), step({ name: 'b' }),
    ]);
    for (const action of ['insert-after', 'duplicate']) {
        const after = applyStepAction(before, { action, index: 1 }).draft;
        assert.equal(after.steps[0].transition, 'hold', `${action} left step 0 alone`);
        assert.equal(after.steps[0], before.steps[0], 'and did not even rebuild it');
    }
});
