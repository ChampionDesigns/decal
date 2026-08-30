/**
 * The gauge cluster redraws at 5 Hz, and the two flushes hold.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    READINGS_MIN_MS, READING_KEYS, presenceOf, readingsDue,
} from '../src/lib/readings-rate.js';

const full = Object.freeze({
    pressure: 9, flow: 2, weight: 18, group: 92, steam: 150, tank: 20, milk: 4,
});
const at = (ms, over = {}) => ({ at: ms, presence: presenceOf({ ...full, ...over }), state: 'espresso' });

describe('5 Hz, and never faster', () => {
    test('the first frame always publishes — dashes must not sit through the first 200 ms', () => {
        assert.equal(readingsDue(null, at(0)), true);
    });

    test('a frame inside the window is refused', () => {
        assert.equal(readingsDue(at(1000), { ...at(1199) }), false);
    });

    test('the window is inclusive at 200 ms', () => {
        assert.equal(readingsDue(at(1000), { ...at(1200) }), true);
        assert.equal(READINGS_MIN_MS, 200);
    });

    test('values moving is NOT a reason to publish — that is the churn being removed', () => {
        const last = at(1000);
        const moved = { at: 1050, presence: presenceOf({ ...full, pressure: 3.3 }), state: 'espresso' };
        assert.equal(moved.presence, last.presence, 'a different number is the same presence');
        assert.equal(readingsDue(last, moved), false);
    });
});

describe('the two flushes, which are not optimisations', () => {
    test('a channel DISAPPEARING publishes at once, so a dash is never late', () => {
        const last = at(1000);
        const gone = { at: 1001, presence: presenceOf({ ...full, tank: null }), state: 'espresso' };
        assert.notEqual(gone.presence, last.presence);
        assert.equal(readingsDue(last, gone), true);
    });

    test('a channel APPEARING publishes at once', () => {
        const last = { at: 1000, presence: presenceOf({ ...full, milk: null }), state: 'espresso' };
        assert.equal(readingsDue(last, { ...at(1001) }), true);
    });

    test('a machine state change publishes at once, so the cluster cannot lag the promotion', () => {
        const last = at(1000);
        assert.equal(readingsDue(last, { ...at(1001), state: 'idle' }), true);
    });
});

describe('presence is about absence, not about size', () => {
    test('zero is a reading — the machine serves 0.0 at idle and it is not a dash', () => {
        const zeros = presenceOf(Object.fromEntries(READING_KEYS.map((k) => [k, 0])));
        assert.equal(zeros, '#'.repeat(READING_KEYS.length));
    });

    test('null and undefined are both absent', () => {
        assert.equal(presenceOf({ ...full, tank: null, milk: undefined }), '#####--');
    });

    test('no readings at all is the empty string, and it still differs from a full row', () => {
        assert.equal(presenceOf(null), '');
        assert.notEqual(presenceOf(null), presenceOf(full));
    });

    test('the key list is in the order the cluster reads', () => {
        assert.deepEqual([...READING_KEYS],
            ['pressure', 'flow', 'weight', 'group', 'steam', 'tank', 'milk']);
    });
});
