
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    alignChannels, bridgeUnspoken, seriesColumns, valueAtTime,
} from '../src/lib/chart-align.js';

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

describe('alignChannels — equal counts are not equal clocks', () => {
    test('two channels of the same length on different timestamps keep both sets of instants', () => {
        const a = { x: [0, 1, 2], y: [1, 2, 3] };
        const b = { x: [5, 7, 9], y: [7, 8, 9] };
        const data = alignChannels({ a, 'b:a': b }, ['a', 'b:a']);

        assert.deepEqual(data[0], [0, 1, 2, 5, 7, 9],
            'one visible clock covering both shots, not the first one\'s three seconds');
        assert.deepEqual(data[1].slice(0, 3), [1, 2, 3]);
        assert.deepEqual(data[2].slice(3), [7, 8, 9],
            'the comparison draws at its own times, which is where the offset put it');
    });

    test('a comparison slid by an offset draws at the slid times', () => {
        const a = { x: [0, 1, 2], y: [1, 2, 3] };
        const slid = { x: [5, 6, 7], y: [7, 8, 9] };
        const data = alignChannels({ a, 'b:a': slid }, ['a', 'b:a']);

        assert.equal(data[0][data[0].length - 1], 7, 'the axis reaches the slid shot\'s end');
        assert.equal(data[2][data[0].indexOf(5)], 7, 'B\'s first sample sits at 5 s, not at 0 s');
    });

    test('the live frame still takes the fast path, by reference and by value', () => {
        const xs = [0, 1, 2];
        const shared = alignChannels({ p: { x: xs, y: [1, 2, 3] }, f: { x: xs, y: [4, 5, 6] } }, ['p', 'f']);
        assert.equal(shared[0], xs, 'the same array is used as it is');

        const copied = alignChannels(
            { p: { x: [0, 1, 2], y: [1, 2, 3] }, f: { x: [0, 1, 2], y: [4, 5, 6] } }, ['p', 'f'],
        );
        assert.deepEqual(copied, [[0, 1, 2], [1, 2, 3], [4, 5, 6]],
            'equal instants in two arrays are one clock and nothing is rebuilt');
    });
});

describe('alignChannels — a step is two points at one instant', () => {
    test('a target\'s boundary pair survives, so the transition stays vertical', () => {
        const pressure = { x: [0, 1, 2, 3], y: [3, 3, 3, 9] };
        const target = { x: [0, 1, 2, 2, 3], y: [3, 3, 3, 9, 9] };
        const data = alignChannels({ pressure, targetPressure: target }, ['pressure', 'targetPressure']);

        assert.deepEqual(data[0], [0, 1, 2, 2, 3], 'the boundary keeps its two slots');
        assert.deepEqual(data[2], [3, 3, 3, 9, 9],
            'the outgoing 3 and the incoming 9 both reach the plot — the step is not a ramp');
        assert.deepEqual(data[1], [3, 3, 3, 3, 9],
            'pressure states its one reading in both slots of the instant the target jumped');
    });

    test('a genuinely smooth target is left smooth', () => {
        const pressure = { x: [0, 1, 2], y: [3, 5, 7] };
        const target = { x: [0, 1, 2, 3], y: [3, 5, 7, 9] };
        const data = alignChannels({ pressure, targetPressure: target }, ['pressure', 'targetPressure']);

        assert.deepEqual(data[0], [0, 1, 2, 3], 'no instant is duplicated, so no slot is');
        assert.deepEqual(data[2], [3, 5, 7, 9]);
    });

    test('two channels naming one instant still collapse to one slot', () => {
        const a = { x: [0, 5, 10], y: [1, 2, 3] };
        const b = { x: [0, 5, 10, 12], y: [7, 8, 9, 9] };
        assert.deepEqual(alignChannels({ a, b }, ['a', 'b'])[0], [0, 5, 10, 12],
            'the union is a union — only a channel\'s OWN consecutive pair earns a second slot');
    });
});

describe('valueAtTime — a channel answers on its own clock', () => {
    test('the latest sample at or before the instant', () => {
        const record = { x: [0, 1, 2, 3], y: [10, 11, 12, 13] };
        assert.equal(valueAtTime(record, 2), 12);
        assert.equal(valueAtTime(record, 2.4), 12, 'between samples, the one the chart is still drawing');
    });

    test('at a step boundary it answers the incoming side, which is what is drawn there', () => {
        const target = { x: [0, 1, 2, 2, 3], y: [3, 3, 3, 9, 9] };
        assert.equal(valueAtTime(target, 2), 9, 'the target the machine moved to, not the one it left');
        assert.equal(valueAtTime(target, 1.9), 3, 'and the outgoing value right up to the boundary');
    });

    test('outside the channel\'s own span there is nothing drawn to read', () => {
        const record = { x: [2, 3], y: [5, 6] };
        assert.equal(valueAtTime(record, 1), null);
        assert.equal(valueAtTime(record, 4), null);
        assert.equal(valueAtTime(null, 1), null);
        assert.equal(valueAtTime(record, Number.NaN), null);
    });

    test('an explicit null is returned as the gap it is', () => {
        assert.equal(valueAtTime({ x: [0, 1, 2], y: [1, null, 3] }, 1), null);
    });
});
