
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import * as autoscale from '../src/lib/chart-autoscale.js';
import {
    EASE_STEP,
    HEADROOM,
    TEMP_MAX,
    TEMP_MIN_SPAN,
    TEMP_PAD_ABOVE,
    TEMP_PAD_BELOW,
    Y_FLOOR_EXPANDED,
    Y_FLOOR_LIVE,
    computeDampedYMax,
    computeTempRange,
    niceCeil, widenBand,
} from '../src/lib/chart-autoscale.js';

describe('what the port DROPPED stays dropped', () => {
    test('the three expanded-chart autoscalers and their five constants are gone', () => {
        for (const name of [
            'computeExpandedR2Max', 'computeExpandedPowerYMax', 'computeExpandedZMax',
            'EXP_R2_FLOOR', 'EXP_R2_CAP', 'EXP_POWER_FLOOR', 'EXP_Z_FLOOR', 'EXP_Z_CAP',
        ]) {
            assert.equal(autoscale[name], undefined,
                `${name} came back: nothing read it — R and Z render on fixed LOG axes and W on a `
                + 'fixed linear one — and pinning its literal value was a test on dead code');
        }
    });

    test('the constants that DID survive are the ones with consumers', () => {
        assert.equal(Y_FLOOR_LIVE, 10, 'the resting top of the live plot');
        assert.equal(Y_FLOOR_EXPANDED, 12);
        assert.equal(HEADROOM, 1.05);
        assert.equal(EASE_STEP, 2, 'one number doing both jobs: the fall per call and the hysteresis band');
    });
});

describe('niceCeil — steps of 2 to 30, then 5 to 80, then 10', () => {
    test('the three bands and their boundaries', () => {
        assert.deepEqual([0, 1, 2, 3, 29, 30].map(niceCeil), [0, 2, 2, 4, 30, 30]);
        assert.deepEqual([31, 32, 79, 80].map(niceCeil), [35, 35, 80, 80]);
        assert.deepEqual([81, 90, 91, 101].map(niceCeil), [90, 90, 100, 110]);
    });

    test('nothing at or below zero produces an axis', () => {
        assert.equal(niceCeil(0), 0);
        assert.equal(niceCeil(-4), 0);
    });
});

describe('computeDampedYMax — grow instantly, ease down', () => {
    const ramp = (peak) => [[0, peak / 2, peak]];

    test('an empty plot rests on the floor', () => {
        assert.equal(computeDampedYMax([], null, { floor: Y_FLOOR_LIVE }), 10);
        assert.equal(computeDampedYMax([[]], null, { floor: Y_FLOOR_LIVE }), 10);
    });

    test('espresso pressure lives inside the resting floor', () => {
        assert.equal(computeDampedYMax(ramp(9), null, { floor: Y_FLOOR_LIVE }), 10,
            'niceCeil(9 × 1.05) is 10, so a normal shot never moves the axis');
    });

    test('a spike is kept in FULL and in one call — the peak is never lost', () => {
        const spiked = computeDampedYMax(ramp(30), 10, { floor: Y_FLOOR_LIVE });
        assert.equal(spiked, niceCeil(30 * HEADROOM));
        assert.equal(spiked, 35, 'grow is instantaneous: a fast preinfusion peak must not go over the top');
    });

    test('it eases down by at most EASE_STEP per call, never in one jump', () => {
        let y = 35;
        const settle = () => { y = computeDampedYMax(ramp(9), y, { floor: Y_FLOOR_LIVE }); return y; };
        assert.equal(settle(), 33);
        assert.equal(settle(), 31);
        assert.equal(settle(), 29);
    });

    test('the same number is the HYSTERESIS band: a need within EASE_STEP does not move it', () => {
        assert.equal(computeDampedYMax(ramp(10), 12, { floor: 0 }), 12,
            'need 12 against a ceiling of 12 is no move');
        assert.equal(computeDampedYMax([[10.4]], 12, { floor: 0 }), 12,
            'need 12 is inside the band — the axis must not jitter around a spike');
        assert.equal(computeDampedYMax([[8]], 12, { floor: 0 }), 12,
            'need 10 is exactly EASE_STEP below and still does NOT move: the band is strict, '
            + 'so a channel oscillating by one step cannot walk the axis down');
        assert.equal(computeDampedYMax([[7]], 12, { floor: 0 }), 10,
            'need 8 clears the band, and the fall is still capped at one step (12 -> 10, not 12 -> 8)');
    });

    test('nulls are skipped rather than read as zero', () => {
        assert.equal(
            computeDampedYMax([[null, 9, null]], null, { floor: 0 }),
            computeDampedYMax([[9]], null, { floor: 0 }),
            'the derived channels push an EXPLICIT null while gated; a zero there would be a reading',
        );
        assert.equal(computeDampedYMax([[null, null]], null, { floor: 4 }), 4);
    });

    test('non-finite samples cannot lift the ceiling', () => {
        assert.equal(computeDampedYMax([[Infinity, NaN, 2]], null, { floor: 0 }), niceCeil(2 * HEADROOM));
    });

    test('`cap` clamps the runaway channels, which is what clipping offscreen means', () => {
        assert.equal(computeDampedYMax([[400]], null, { floor: 0, cap: 12 }), 12,
            'R and Z spike toward infinity as flow approaches zero');
        assert.equal(computeDampedYMax([[1]], 40, { floor: 0, cap: 12 }), 12,
            'a stale ceiling above the cap is brought inside it immediately');
    });

    test('a missing or broken previous value starts from the floor, not from NaN', () => {
        assert.equal(computeDampedYMax([[1]], NaN, { floor: 6 }), 6);
        assert.equal(computeDampedYMax([[1]], undefined, { floor: 6 }), 6);
    });
});

describe('computeTempRange — ONLY the group target anchors', () => {
    test('one target gives target − 10 .. target + 5', () => {
        assert.deepEqual(computeTempRange([88, 88, 88]), [88 - TEMP_PAD_BELOW, 88 + TEMP_PAD_ABOVE]);
    });

    test('a target that MOVES widens the band over every target seen this shot', () => {
        assert.deepEqual(computeTempRange([80, 80, 70]), [60, 85],
            'target 80 -> 70..85; when it drops to 70 the band widens to 60..85');
    });

    test('with no target at all the band anchors on the LAST group-temp sample', () => {
        assert.deepEqual(computeTempRange([], [95, 93, 91]), [81, 96]);
        assert.deepEqual(computeTempRange([], []), [80, 95], 'and on 90 °C when there is nothing at all');
        assert.deepEqual(computeTempRange([NaN, NaN], [], []), [80, 95],
            'a target array of absences is no target');
    });

    test('THE BENCH LESSON: the mix TARGET never anchors, it only widens', () => {
        const dive = computeTempRange([88], [92, 90], [], [37, 60, 88]);
        assert.deepEqual(dive, [37, 93],
            'the dive is fully visible (37) and NOT padded below (27) — widening only');
    });

    test('every other line only widens, so none of them clips', () => {
        assert.deepEqual(computeTempRange([90], [99], [70]), [70, 99],
            'the band starts at 80..95 for a 90 target and stretches to reach both lines exactly');
    });

    test('the hard 105 °C ceiling wins over "never clip"', () => {
        const [lo, hi] = computeTempRange([100], [120]);
        assert.equal(hi, TEMP_MAX, 'no data may push the band past the hard ceiling');
        assert.ok(hi - lo >= TEMP_MIN_SPAN, 'and a sane span is kept when the cap squeezes it');
    });

    test('the squeezed band keeps at least TEMP_MIN_SPAN', () => {
        assert.deepEqual(computeTempRange([115]), [TEMP_MAX - TEMP_MIN_SPAN, TEMP_MAX]);
    });

    test('the band is reported in whole degrees', () => {
        const [lo, hi] = computeTempRange([88.4], [], [77.6]);
        assert.equal(lo, Math.floor(77.6));
        assert.equal(hi, Math.ceil(93.4));
    });
});

describe('widenBand — a temperature band may only grow within a shot', () => {
    test('the first band of a shot is taken whole', () => {
        assert.deepEqual(widenBand(null, [70, 95]), [70, 95]);
    });

    test('a NARROWER band does not move the axis — this is the flicker, fixed', () => {
        assert.deepEqual(widenBand([27, 95], [37, 95]), [27, 95]);
    });

    test('a band that reaches lower widens downward', () => {
        assert.deepEqual(widenBand([70, 95], [60, 95]), [60, 95]);
    });

    test('a band that reaches higher widens upward', () => {
        assert.deepEqual(widenBand([70, 90], [70, 96]), [70, 96]);
    });

    test('both ends may widen at once', () => {
        assert.deepEqual(widenBand([70, 90], [65, 95]), [65, 95]);
    });

    test('it cannot exceed what computeTempRange already capped — 105 stays 105', () => {
        const a = computeTempRange([100]);
        const b = computeTempRange([101]);
        assert.ok(widenBand(a, b)[1] <= TEMP_MAX);
    });

    test('a malformed held band is ignored rather than propagated', () => {
        assert.deepEqual(widenBand([70], [65, 95]), [65, 95]);
        assert.deepEqual(widenBand('nonsense', [65, 95]), [65, 95]);
    });

    test('a malformed new band leaves the drawn one alone', () => {
        assert.deepEqual(widenBand([70, 95], null), [70, 95]);
    });
});
