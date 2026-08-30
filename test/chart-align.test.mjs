
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { alignChannels, bridgeUnspoken, seriesColumns } from '../src/lib/chart-align.js';

describe('bridgeUnspoken — the two meanings of null', () => {
    test('slots the channel never spoke about are interpolated from the readings either side', () => {
        const x = [0, 1, 2, 3];
        const col = [0, null, null, 3];
        const spoken = [true, false, false, true];
        assert.deepEqual(bridgeUnspoken(x, col, spoken), [0, 1, 2, 3]);
    });

    test('an EXPLICIT null is a real gap and survives — the derived channels push one while gated', () => {
        const x = [0, 1, 2, 3];
        const col = [5, null, null, 9];
        //                ^ spoken: the channel said "no valid value here"
        const spoken = [true, true, false, true];
        assert.deepEqual(bridgeUnspoken(x, col, spoken), [5, null, null, 9],
            'nothing after an explicit null may be bridged from before it: the break is the datum');
    });

    test('before the first reading and after the last there is nothing to interpolate from', () => {
        const x = [0, 1, 2, 3, 4];
        const col = [null, 2, null, 6, null];
        const spoken = [false, true, false, true, false];
        assert.deepEqual(bridgeUnspoken(x, col, spoken), [null, 2, 4, 6, null],
            'a leading or trailing gap stays absent rather than being invented');
    });

    test('two samples at the same x cannot divide by zero', () => {
        const x = [0, 0, 0];
        const col = [4, null, 8];
        assert.deepEqual(bridgeUnspoken(x, col, [true, false, true]), [4, 4, 8],
            'a zero span holds the earlier value rather than producing NaN');
    });

    test('it mutates and returns the caller\'s array, as the original did', () => {
        const col = [1, null, 3];
        const out = bridgeUnspoken([0, 1, 2], col, [true, false, true]);
        assert.equal(out, col, 'the caller owns a freshly built array and nothing else holds it');
    });
});

describe('alignChannels — the fast path is the live one', () => {
    test('equal-length channels are used AS THEY ARE, by reference', () => {
        const pressure = { x: [0, 1, 2], y: [1, 2, 3] };
        const flow = { x: [0, 1, 2], y: [4, 5, 6] };
        const data = alignChannels({ pressure, flow }, ['pressure', 'flow']);

        assert.equal(data[0], pressure.x, 'the x axis is the first channel\'s own array — nothing copied');
        assert.equal(data[1], pressure.y);
        assert.equal(data[2], flow.y, 'every live frame takes this path; copying here would be per-frame work');
    });

    test('`keys` fixes the column order, so the data and the series arrays cannot drift', () => {
        const channels = {
            pressure: { x: [0, 1], y: [1, 2] },
            flow: { x: [0, 1], y: [8, 9] },
        };
        assert.deepEqual(alignChannels(channels, ['flow', 'pressure']), [[0, 1], [8, 9], [1, 2]]);
    });
});

describe('alignChannels — the slow path a replayed shot takes', () => {
    test('different lengths give the union of the timestamps, sorted, with the unspoken slots bridged', () => {
        const a = { x: [0, 1, 2], y: [1, null, 3] };   // an EXPLICIT null at t=1
        const b = { x: [0, 2], y: [5, 7] };            // never sampled t=1
        const data = alignChannels({ a, b }, ['a', 'b']);

        assert.deepEqual(data[0], [0, 1, 2], 'one x axis, the union of both, ascending');
        assert.deepEqual(data[1], [1, null, 3], 'a\'s explicit null stays a gap');
        assert.deepEqual(data[2], [5, 6, 7], 'b never spoke at t=1, so the value between its readings is drawn');
    });

    test('a key with no record yields a full-length column of nulls', () => {
        const a = { x: [0, 1, 2], y: [1, 2, 3] };
        const b = { x: [0, 2], y: [5, 7] };
        const data = alignChannels({ a, b }, ['a', 'b', 'notStartedYet']);

        assert.equal(data.length, 4, 'a channel that has not started must not shorten the data array');
        assert.deepEqual(data[3], [null, null, null]);
    });

    test('duplicate timestamps across channels collapse to one column', () => {
        const a = { x: [0, 5, 10], y: [1, 2, 3] };
        const b = { x: [10, 5, 0, 5], y: [9, 8, 7, 8] };   // out of order and repeated
        const data = alignChannels({ a, b }, ['a', 'b']);
        assert.deepEqual(data[0], [0, 5, 10]);
        assert.deepEqual(data[2], [7, 8, 9]);
    });

    test('no channels at all is an empty axis, not a throw', () => {
        assert.deepEqual(alignChannels({}, ['a']), [[], []],
            'an x axis of nothing and one empty column — a chart before its first frame');
    });
});

describe('seriesColumns', () => {
    test('drops the x axis and hands the autoscalers the y columns', () => {
        assert.deepEqual(seriesColumns([[0, 1], [2, 3], [4, 5]]), [[2, 3], [4, 5]]);
    });
});
