
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    ALIGNMENT_OFFSET_LIMIT_S,
    ALIGNMENT_OFFSET_STEP_S,
    ALIGNMENT_SLOT,
    clampAlignmentOffset,
    alignedInstant,
    alignmentOffsetAfterSlotChange,
    formatAlignmentOffset,
    alignmentControlState,
} from '../src/lib/alignment-offset.js';
import { shiftSeriesX } from '../src/lib/shot-derivation.js';

/** A shot's worth of x, in seconds from its own start, at 10 Hz. */
const seriesOf = (n = 40) => ({
    x: Array.from({ length: n }, (_, i) => i * 0.1),
    y: Array.from({ length: n }, (_, i) => 1 + i * 0.1),
});

test('the travel is five seconds either way, not fifteen', () => {
    assert.equal(ALIGNMENT_OFFSET_LIMIT_S, 5);
    assert.equal(clampAlignmentOffset(999), 5);
    assert.equal(clampAlignmentOffset(-999), -5);
    assert.equal(clampAlignmentOffset(5.000001), 5);
});

test('an offset inside the range is used exactly as given', () => {
    assert.equal(clampAlignmentOffset(2.4), 2.4);
    assert.equal(clampAlignmentOffset(-0.1), -0.1);
    assert.equal(clampAlignmentOffset(0), 0);
});

test('anything that is not a finite number is no offset at all', () => {
    for (const bad of ['nonsense', undefined, null, NaN, Infinity, -Infinity, {}, [1, 2]]) {
        assert.equal(clampAlignmentOffset(bad), 0, `${String(bad)} must not become an offset`);
    }
    // A control's value arrives as a string; a numeric one is still a number.
    assert.equal(clampAlignmentOffset('2.5'), 2.5);
});

test('a negative zero is zero, so the readout can never say "-0.0 s"', () => {
    assert.ok(Object.is(clampAlignmentOffset(-0), 0));
    assert.equal(formatAlignmentOffset(-0), '0.0 s');
    assert.equal(formatAlignmentOffset(-0.04), '0.0 s');
});

test('the control steps in tenths, matching the one-decimal readout', () => {
    assert.equal(ALIGNMENT_OFFSET_STEP_S, 0.1);
    // The policy bounds, it does not quantise: a value between steps is used as given.
    assert.equal(clampAlignmentOffset(1.25), 1.25);
});

test('the offset moves B by exactly the number of seconds asked for, head and tail', () => {
    const b = seriesOf();
    const moved = shiftSeriesX(b, clampAlignmentOffset(4));
    assert.ok(Math.abs(moved.x[0] - (b.x[0] + 4)) < 1e-9, `+4 gave ${moved.x[0]} from ${b.x[0]}`);
    assert.ok(Math.abs(moved.x.at(-1) - (b.x.at(-1) + 4)) < 1e-9,
        'the whole trace moves, not just its head');
});

test('A is the reference and nothing in this module moves it', () => {
    assert.equal(ALIGNMENT_SLOT.REFERENCE, 'a');
    assert.equal(ALIGNMENT_SLOT.MOVING, 'b');
    const a = seriesOf();
    const b = seriesOf();
    const before = a.x.slice();
    const movedB = shiftSeriesX(b, clampAlignmentOffset(3));
    assert.deepEqual(a.x, before, 'the alignment slides B against A, not both');
    for (let i = 0; i < a.x.length; i += 1) {
        assert.ok(Math.abs((movedB.x[i] - a.x[i]) - 3) < 1e-9,
            `sample ${i}: B sits ${movedB.x[i] - a.x[i]} s from A, not 3 s`);
    }
});

test('an out-of-range offset moves the traces by the CLAMPED amount, not the raw one', () => {
    // The readout and the traces must not be able to disagree: both go through the clamp.
    const b = seriesOf();
    const moved = shiftSeriesX(b, clampAlignmentOffset(12));
    assert.ok(Math.abs(moved.x[0] - (b.x[0] + ALIGNMENT_OFFSET_LIMIT_S)) < 1e-9);
    assert.equal(formatAlignmentOffset(12), '+5.0 s');
});

test('redrawing at the same offset does not compound the shift', () => {
    const b = seriesOf();
    const pristine = b.x.slice();
    const first = shiftSeriesX(b, clampAlignmentOffset(2));
    const second = shiftSeriesX(b, clampAlignmentOffset(2));
    assert.deepEqual(second.x, first.x, 'a second redraw at the same offset lands in the same place');
    assert.deepEqual(b.x, pristine, 'the bundle is never mutated');
    assert.notEqual(first.x, b.x, 'the shifted x is a new array');
});

test("B's step boundaries move with B, by the same clamped offset as its curves", () => {
    const b = seriesOf();
    const marks = [{ t: 0.5 }, { t: 1.9 }];
    const moved = shiftSeriesX(b, clampAlignmentOffset(3));
    const movedMarks = marks.map((m) => alignedInstant(m.t, 3));
    assert.deepEqual(movedMarks, [3.5, 4.9]);
    assert.ok(Math.abs((moved.x[5] - b.x[5]) - (movedMarks[0] - marks[0].t)) < 1e-9,
        'marks and curves move by one and the same offset');
    assert.equal(alignedInstant(1, 999), 1 + ALIGNMENT_OFFSET_LIMIT_S, 'marks are clamped too');
    assert.equal(alignedInstant(1, 'nonsense'), 1);
});

test('the readout is always signed, to one decimal, in seconds', () => {
    assert.equal(formatAlignmentOffset(3), '+3.0 s');
    assert.equal(formatAlignmentOffset(0), '0.0 s');
    assert.equal(formatAlignmentOffset(-2.5), '-2.5 s');
    assert.equal(formatAlignmentOffset(0.25), '+0.3 s');
    assert.equal(formatAlignmentOffset('nonsense'), '0.0 s');
});

test('choosing a new comparison shot resets the alignment', () => {
    assert.equal(alignmentOffsetAfterSlotChange(3.4, ALIGNMENT_SLOT.MOVING), 0);
});

test('clearing the comparison resets it too', () => {
    assert.equal(alignmentOffsetAfterSlotChange(-5, 'b'), 0);
});

test('changing the reference shot keeps the offset, as Slate did', () => {
    assert.equal(alignmentOffsetAfterSlotChange(2, ALIGNMENT_SLOT.REFERENCE), 2);
    assert.equal(alignmentOffsetAfterSlotChange(99, 'a'), ALIGNMENT_OFFSET_LIMIT_S,
        'and it is still bounded on the way through');
});

test('with no comparison shot the slider and reset are both dead', () => {
    const state = alignmentControlState({ offset: 0, hasComparison: false });
    assert.equal(state.sliderDisabled, true);
    assert.equal(state.resetDisabled, true);
    assert.equal(state.available, true, 'the bar is still shown — it explains the pairing');
});

test('reset is only ever an undo', () => {
    assert.equal(alignmentControlState({ offset: 0, hasComparison: true }).resetDisabled, true);
    assert.equal(alignmentControlState({ offset: 1.2, hasComparison: true }).resetDisabled, false);
    assert.equal(alignmentControlState({ offset: 'nonsense', hasComparison: true }).resetDisabled, true);
});

test('a page with no time axis has no alignment to show', () => {
    const state = alignmentControlState({ offset: 2, hasComparison: true, hasTimeAxis: false });
    assert.equal(state.available, false);
});

test('the control state is frozen, and defaults to the safe reading', () => {
    const state = alignmentControlState();
    assert.equal(Object.isFrozen(state), true);
    assert.deepEqual({ ...state }, { available: true, sliderDisabled: true, resetDisabled: true });
});
