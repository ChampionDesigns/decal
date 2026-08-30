
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    DASH_PATTERNS,
    TICK_STEPS,
    dashPattern,
    ruleDash,
    tickSplits,
    tickStepFor,
} from '../src/lib/chart-axis.js';

/* The rendered numbers this suite reasons in: --ui-chart-tick-gap is 170px. */
const GAP = 170;

describe('tickStepFor — the coarsest interval that keeps the labels apart', () => {
    test('minGap is REQUIRED, because this module does not restate the token', () => {
        assert.throws(() => tickStepFor(30, 900), /minGap is required/);
        assert.throws(() => tickStepFor(30, 900, 0), /positive number of CSS px/);
        assert.throws(() => tickStepFor(30, 900, '170px'), /minGap is required/,
            'a CSS string is not a number of px; the caller parses the token');
    });

    test('a short shot and a long one get a comparable NUMBER of ticks, not a common interval', () => {
        const width = 900;
        const short = tickStepFor(20, width, GAP);
        const long = tickStepFor(120, width, GAP);
        assert.equal(short, 5);
        assert.equal(long, 30);
        assert.equal(Math.round(20 / short), 4);
        assert.equal(Math.round(120 / long), 4, 'four intervals either way — that is the whole point');
    });

    test('every step it can return is on the readable ladder', () => {
        for (const span of [1, 7, 19, 25, 61, 400, 3000]) {
            assert.ok(TICK_STEPS.includes(tickStepFor(span, 900, GAP)),
                `span ${span} produced an interval off the ladder — 7 s and 25 s are not readable`);
        }
    });

    test('a narrow plot takes a coarser step for the same span', () => {
        assert.ok(tickStepFor(60, 400, GAP) >= tickStepFor(60, 1200, GAP));
    });

    test('there is a floor of two ticks however narrow the plot gets', () => {
        assert.equal(tickStepFor(4, 10, GAP), 2, 'span 4 over two intervals');
    });

    test('a span or width of nothing yields the finest step rather than a division by zero', () => {
        assert.equal(tickStepFor(0, 900, GAP), TICK_STEPS[0]);
        assert.equal(tickStepFor(30, 0, GAP), TICK_STEPS[0]);
        assert.equal(tickStepFor(-5, 900, GAP), TICK_STEPS[0]);
    });

    test('a span past the end of the ladder saturates at the coarsest step', () => {
        assert.equal(tickStepFor(100000, 300, GAP), TICK_STEPS[TICK_STEPS.length - 1]);
    });
});

describe('tickSplits — every tick on the ladder inside the range', () => {
    test('an aligned range includes both ends', () => {
        assert.deepEqual(tickSplits(0, 30, 5), [0, 5, 10, 15, 20, 25, 30]);
    });

    test('an unaligned range starts at the first tick INSIDE it', () => {
        assert.deepEqual(tickSplits(3, 12, 5), [5, 10]);
    });

    test('floating-point accumulation does not produce 15.000000000000002', () => {
        assert.deepEqual(tickSplits(0, 1, 0.1), [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
    });

    test('an end that lands within epsilon of the range still counts', () => {
        assert.deepEqual(tickSplits(0, 0.3, 0.1), [0, 0.1, 0.2, 0.3]);
    });

    test('a nonsense range or step is empty, not infinite', () => {
        assert.deepEqual(tickSplits(0, 30, 0), []);
        assert.deepEqual(tickSplits(0, 30, -5), []);
        assert.deepEqual(tickSplits(30, 0, 5), []);
    });
});

describe('the dash table — one exported constant (§6.2)', () => {
    test('the four named rhythms, measured from the old renderer\'s own SVG', () => {
        assert.deepEqual({ ...DASH_PATTERNS }, {
            dot: [3, 3], dash: [9, 9], longdash: [15, 15], dashdot: [9, 3, 3, 3],
        });
    });

    test('a named dash comes back as a COPY, so no caller can edit the table', () => {
        const got = dashPattern('dash');
        assert.deepEqual(got, [9, 9]);
        assert.notEqual(got, DASH_PATTERNS.dash);
        got[0] = 99;
        assert.deepEqual(dashPattern('dash'), [9, 9]);
    });

    test('no dash and an unknown name are both SOLID', () => {
        assert.equal(dashPattern(undefined), undefined);
        assert.equal(dashPattern(null), undefined);
        assert.equal(dashPattern(''), undefined);
        assert.equal(dashPattern('squiggle'), undefined, 'an unknown name draws a solid line, not a throw');
    });
});

describe('ruleDash — the empty array must survive', () => {
    test('only `undefined` takes the fallback', () => {
        assert.deepEqual(ruleDash(undefined, [9, 9]), [9, 9]);
    });

    test('an EMPTY array means SOLID and is kept', () => {
        assert.deepEqual(ruleDash([], [9, 9]), [],
            'a detector event is a thing the puck did, drawn unbroken; `|| default` would have '
            + 'made it dashed like the step boundaries it must be told apart from');
    });

    test('null is a stated value too and is not the fallback', () => {
        assert.equal(ruleDash(null, [9, 9]), null, 'callers test for undefined, never for falsiness');
    });
});
