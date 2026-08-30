// The ±5 s alignment between two shots (Gate 7 port of `history-viewer.js`'s offset
// policy).
//
// These EXECUTE the policy. The bug the whole comparison surface was rebuilt around was
// invisible to source reading — the slider addressed a trace index one past the end, the
// code looked entirely correct, the renderer threw, a catch swallowed it, and the control
// did nothing at all (CARRY_FORWARD: "Keep the intent of `history-viewer.test.mjs` …
// Assert on where the traces moved, not on source text"). Slate's own suite still had two
// tests that matched on source text; those are the ones A8 retires, and their intent is
// re-expressed below against real arrays.
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

// ---------------------------------------------------------------------------
// The limit, and why it is five
// ---------------------------------------------------------------------------

test('the travel is five seconds either way, not fifteen', () => {
    // The alignment is for grind drift between two pours of the same profile:
    // preinfusion ends on a pressure threshold, so a coarser grind pushes everything
    // after it a second or two right. Fifteen seconds of travel spends most of the
    // slider on offsets that put the two shots in different phases entirely.
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

// ---------------------------------------------------------------------------
// Where the traces actually move — the thing that was silently inert before
// ---------------------------------------------------------------------------

test('the offset moves B by exactly the number of seconds asked for, head and tail', () => {
    const b = seriesOf();
    const moved = shiftSeriesX(b, clampAlignmentOffset(4));
    assert.ok(Math.abs(moved.x[0] - (b.x[0] + 4)) < 1e-9, `+4 gave ${moved.x[0]} from ${b.x[0]}`);
    assert.ok(Math.abs(moved.x.at(-1) - (b.x.at(-1) + 4)) < 1e-9,
        'the whole trace moves, not just its head');
});

test('A is the reference and nothing in this module moves it', () => {
    // The offset is applied by the caller, to B's series only. The slot constants say
    // which is which so no consumer has to guess the direction.
    assert.equal(ALIGNMENT_SLOT.REFERENCE, 'a');
    assert.equal(ALIGNMENT_SLOT.MOVING, 'b');
    // A REAL pair: A must be a series the shift could have reached, or the assertion
    // below holds for any implementation whatsoever and pins nothing.
    const a = seriesOf();
    const b = seriesOf();
    const before = a.x.slice();
    const movedB = shiftSeriesX(b, clampAlignmentOffset(3));
    assert.deepEqual(a.x, before, 'the alignment slides B against A, not both');
    // The separation is the whole content of the claim: if BOTH sides moved it would
    // still be zero, which is the failure the assertion above cannot see on its own.
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
    // The old path rewrote B's x arrays IN PLACE, because a redraw was assumed expensive;
    // it is 4 ms. A redraw re-reads the bundle, so the second draw must land where the
    // first one did — and the bundle must come out untouched.
    const b = seriesOf();
    const pristine = b.x.slice();
    const first = shiftSeriesX(b, clampAlignmentOffset(2));
    const second = shiftSeriesX(b, clampAlignmentOffset(2));
    assert.deepEqual(second.x, first.x, 'a second redraw at the same offset lands in the same place');
    assert.deepEqual(b.x, pristine, 'the bundle is never mutated');
    assert.notEqual(first.x, b.x, 'the shifted x is a new array');
});

test("B's step boundaries move with B, by the same clamped offset as its curves", () => {
    // Lining two shots up on the instant preinfusion ended is the alignment most people
    // are reaching for; rules that did not follow the curves would contradict them.
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

// ---------------------------------------------------------------------------
// The readout
// ---------------------------------------------------------------------------

test('the readout is always signed, to one decimal, in seconds', () => {
    assert.equal(formatAlignmentOffset(3), '+3.0 s');
    assert.equal(formatAlignmentOffset(0), '0.0 s');
    assert.equal(formatAlignmentOffset(-2.5), '-2.5 s');
    assert.equal(formatAlignmentOffset(0.25), '+0.3 s');
    assert.equal(formatAlignmentOffset('nonsense'), '0.0 s');
});

// ---------------------------------------------------------------------------
// Resets — an alignment belongs to one pair of shots
// ---------------------------------------------------------------------------

test('choosing a new comparison shot resets the alignment', () => {
    // An offset chosen for one pair, silently applied to another, is an alignment
    // nobody asked for and nobody can see is wrong.
    assert.equal(alignmentOffsetAfterSlotChange(3.4, ALIGNMENT_SLOT.MOVING), 0);
});

test('clearing the comparison resets it too', () => {
    // An alignment chosen for a pair means nothing once the pair is gone; the slot that
    // emptied is still B.
    assert.equal(alignmentOffsetAfterSlotChange(-5, 'b'), 0);
});

test('changing the reference shot keeps the offset, as Slate did', () => {
    // Carried literally, and recorded as a deferred question: the docblock's own reason
    // ("a new pair starts aligned") argues for resetting on A as well, but Slate resets
    // on B only and this port does not decide it. One line here and this test if it flips.
    assert.equal(alignmentOffsetAfterSlotChange(2, ALIGNMENT_SLOT.REFERENCE), 2);
    assert.equal(alignmentOffsetAfterSlotChange(99, 'a'), ALIGNMENT_OFFSET_LIMIT_S,
        'and it is still bounded on the way through');
});

// ---------------------------------------------------------------------------
// What the compare bar can do
// ---------------------------------------------------------------------------

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
    // A table has no time axis to slide, so the control has no meaning there and is not
    // rendered rather than rendered dead.
    const state = alignmentControlState({ offset: 2, hasComparison: true, hasTimeAxis: false });
    assert.equal(state.available, false);
});

test('the control state is frozen, and defaults to the safe reading', () => {
    const state = alignmentControlState();
    assert.equal(Object.isFrozen(state), true);
    assert.deepEqual({ ...state }, { available: true, sliderDisabled: true, resetDisabled: true });
});
