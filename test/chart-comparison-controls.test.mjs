import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAlignmentOffset } from '../src/lib/alignment-offset.js';

test('typed alignment rejects malformed and out-of-range text without inventing zero', () => {
    for (const text of ['', ' ', '.', '-', '1e2', '0x2', 'Infinity', '2abc', '5.1', '-5.1']) {
        assert.equal(parseAlignmentOffset(text), null, text);
    }
    for (const [text, value] of [['+0.6', .6], ['-.5', -.5], ['-5', -5], ['5', 5], ['-0', 0], ['0.16', .2]]) {
        assert.equal(parseAlignmentOffset(text), value, text);
    }
});
