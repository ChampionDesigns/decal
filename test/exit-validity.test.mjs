// O5's whole risk is over-flagging: a warning that appears on a legitimate
// profile teaches people to ignore warnings. These tests pin the boundary
// between "provably cannot fire" and "merely unusual".
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deadExitReason, isDeadExit, exitValueMin, remainingExitsNote } from '../src/lib/exit-validity.js';

test('falling below zero on a non-negative channel can never fire', () => {
    for (const type of ['pressure', 'flow', 'power']) {
        assert.match(deadExitReason({ type, condition: 'under', value: 0 }), /never fires/);
    }
});

test('rising past zero fires the instant the step starts', () => {
    assert.match(deadExitReason({ type: 'flow', condition: 'over', value: 0 }), /immediately/);
});

test('an ordinary threshold is not flagged', () => {
    assert.equal(deadExitReason({ type: 'flow', condition: 'under', value: 0.4 }), null);
    assert.equal(deadExitReason({ type: 'pressure', condition: 'over', value: 6 }), null);
    assert.equal(isDeadExit({ type: 'pressure', condition: 'over', value: 6 }), false);
});

test('volume and weight exits are never flagged — they accumulate', () => {
    // They have no comparator at all, so the zero case means "not set", which
    // the editor already renders as an absent chip.
    assert.equal(deadExitReason({ type: 'volume', condition: 'over', value: 0 }), null);
    assert.equal(deadExitReason({ type: 'weight', condition: 'under', value: 0 }), null);
});

test('a missing or malformed exit is not an error to report', () => {
    assert.equal(deadExitReason(null), null);
    assert.equal(deadExitReason({ type: 'flow', condition: 'under', value: NaN }), null);
    assert.equal(deadExitReason({}), null);
});

test('the "falls below" stepper cannot be dialled to the dead value', () => {
    assert.equal(exitValueMin('under', 0.1), 0.1);
    // "Rises past 0" is reachable and merely useless; the flag explains it.
    assert.equal(exitValueMin('over', 0.1), 0);
});

test('the note names the step\'s actual remaining exits', () => {
    assert.equal(remainingExitsNote({ volume: 100 }), 'ends on 100 mL');
    assert.equal(remainingExitsNote({ volume: 100, seconds: 30 }), 'ends on 100 mL or 30 s');
    assert.equal(remainingExitsNote({ weight: 36 }), 'ends on 36 g');
});

test('a step with no other exit says so rather than inventing a cap', () => {
    assert.equal(remainingExitsNote({ volume: 0, weight: 0, seconds: 0 }),
        'nothing else ends this step');
});
