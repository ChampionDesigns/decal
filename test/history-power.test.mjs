// history-power.test.mjs — the power page's DOM-free half: the derived-channel plot's
// axes, the P–Q trajectory's points, and Q16's correspondence marks. Fix run 6.
//
// A8: this suite executes the module. It does not read `history-power.js` as text and it
// does not assert on a shape nothing draws — the two failure modes the ported history
// tests had ("a test asserting on trace objects nothing renders is a test of the wrong
// thing"). The rendering half is `test/render/history-power.render.test.mjs`.
//
// THE SUBJECT IS A REAL RECORDED SHOT, run through the real gate-6 derivation, with the
// derived channels recomputed exactly as ReaPrime recomputes them on read (machine.dart
// :64-140 at pin 2b047d02). A hand-built sample can only contain what its author already
// believed; these are 923 measurements off a bench.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    DERIVED_CHANNELS, DERIVED_LEFT_CHANNELS, DERIVED_LOG_CEIL, DERIVED_LOG_FLOOR,
    DERIVED_SCALES, PQ_FLOW_MAX, PQ_GAP_SECONDS, PQ_MARK_TARGET, PQ_PRESSURE_MAX,
    correspondenceMarks, derivedLeftRange, derivedPresence, derivedTickValues,
    formatLogTick, logRecords, noDerivedChannels, rampColour, toLog10, trajectoryFrame,
    trajectoryPoints, trajectorySpan,
} from '../src/lib/history-power.js';
import { deriveFromRecord, SERIES_KEYS } from '../src/lib/shot-derivation.js';
import { TICK_STEPS } from '../src/lib/chart-axis.js';

const FIXTURE_DIR = fileURLToPath(new URL('../tools/rea-fixtures/', import.meta.url));
const SHOT_A = 'api__v1__shots__5fc3f631-6b18-471b-9800-00d552dbbecb.json';
const SHOT_B = 'api__v1__shots__d5139a1f-c4ee-47e2-bb80-0cbf3e39b6a3.json';

/** ReaPrime's own recompute-on-read, transcribed — see the route fixture's docblock. */
function upgrade(record) {
    const gate = (p, f, v) => ((f >= 0.3 && p >= 0.3 && Number.isFinite(v)) ? v : null);
    return {
        ...record,
        measurements: record.measurements.map((m) => {
            const machine = m.machine;
            const p = machine?.pressure;
            const f = machine?.flow;
            if (typeof p !== 'number' || typeof f !== 'number') return m;
            const next = { ...machine };
            const R = gate(p, f, p / (f * f));
            const Z = gate(p, f, p / f);
            const W = gate(p, f, 0.1 * p * f);
            if (R !== null) next.puckResistanceDerived = R;
            if (Z !== null) next.loadImpedanceDerived = Z;
            if (W !== null) next.hydraulicPowerDerived = W;
            return { ...m, machine: next };
        }),
    };
}

const record = (name) => JSON.parse(readFileSync(`${FIXTURE_DIR}${name}`, 'utf8'));
const A = deriveFromRecord(upgrade(record(SHOT_A)));
const B = deriveFromRecord(upgrade(record(SHOT_B)));
const RAW_A = deriveFromRecord(record(SHOT_A));

/** A derivation shaped by hand, for the cases a recording cannot produce on demand. */
function madeUp({ t, flow, pressure, resistance = [], impedance = [], power = [] }) {
    const series = {};
    for (const key of SERIES_KEYS) series[key] = { x: t, y: t.map(() => null) };
    series.flow = { x: t, y: flow };
    series.pressure = { x: t, y: pressure };
    if (resistance.length) series.resistance = { x: t, y: resistance };
    if (impedance.length) series.impedance = { x: t, y: impedance };
    if (power.length) series.power = { x: t, y: power };
    return { ok: true, series, axis: { t, stampMs: t } };
}

describe('the three channels are READ, never derived (A7)', () => {
    test('the derivation carries them as SERIES_KEYS and the page names those keys', () => {
        for (const key of DERIVED_CHANNELS) {
            assert.ok(SERIES_KEYS.includes(key),
                `${key} is not a gate-6 series key — this page must plot what the walk emits`);
        }
        /* Ben, 25 Aug 2026: "Power will be on the Pressure/Flow chart, not on the
         * resistance / impedance chart. No second axis on these charts." */
        assert.deepEqual([...DERIVED_LEFT_CHANNELS], [...DERIVED_CHANNELS]);
        assert.ok(!DERIVED_CHANNELS.includes('power'),
            'W is on the flow page now, where it shares pressure and flow own band');
        assert.deepEqual(DERIVED_SCALES, {}, 'no channel is on a second axis');
    });

    test('a recording the server never served the channels for reports none, and no number', () => {
        /* The fixtures AS RECORDED predate ReaPrime's derived getters. The derivation
         * still walks them; what it must not do is invent a value from pressure and flow
         * it has in its hand. */
        const presence = derivedPresence(RAW_A);
        assert.deepEqual(
            { resistance: presence.resistance, impedance: presence.impedance },
            { resistance: 0, impedance: 0 },
            'A7: no fallback computation anywhere behind this page');
        assert.equal(presence.any, false);
        assert.equal(noDerivedChannels(RAW_A, null), true);
        assert.equal(RAW_A.sources.power, 'none', 'and the source says so out loud');
    });

    test('the same recording served WITH the keys reports them, from the derived source', () => {
        const presence = derivedPresence(A);
        assert.equal(presence.any, true);
        assert.equal(A.sources.resistance, 'derived');
        assert.equal(A.sources.power, 'derived');
        /* THE HOLES ARE REAL AND ARE COUNTED. ReaPrime gates at 0.3 mL/s and 0.3 bar and
         * OMITS the key below it, so a shot has fewer readings than samples and the
         * difference is the gap the chart draws. */
        assert.equal(A.axis.t.length, 50);
        assert.equal(presence.resistance, 34);
        assert.equal(presence.impedance, 34);
    });
});

describe('the P–Q trajectory', () => {
    test('pairs flow against pressure on the derivation\'s own clock', () => {
        const points = trajectoryPoints(A);
        assert.equal(points.length >= A.axis.t.length, true);
        const real = points.filter((p) => p.x !== null);
        assert.equal(real.length, 50, 'every in-shot sample has a flow and a pressure');
        /* Point i is sample i of the SAME x array — gate 6 assigns `axis.t` to every
         * measured channel by identity, which is why index pairing is x pairing here. */
        assert.equal(real[0].x, A.series.flow.y[0]);
        assert.equal(real[0].y, A.series.pressure.y[0]);
        assert.equal(real[0].t, A.axis.t[0]);
    });

    test('refuses to pair a derivation whose channels are not on one clock', () => {
        const broken = madeUp({ t: [0, 1, 2], flow: [1, 2], pressure: [3, 4, 5] });
        assert.deepEqual(trajectoryPoints(broken), [],
            'a wrong pairing is worse than no trajectory — Slate paired by index and could not tell');
    });

    test('an absent reading is a null POINT, so the path breaks on both sides of it', () => {
        const one = madeUp({ t: [0, 1, 2], flow: [1, null, 3], pressure: [4, 5, 6] });
        const points = trajectoryPoints(one);
        assert.equal(points.length, 3);
        assert.deepEqual([points[0].x, points[1].x, points[2].x], [1, null, 3]);
    });

    test('a jump longer than PQ_GAP_SECONDS inserts a break rather than bridging it', () => {
        const t = [0, 0.2, 0.4 + PQ_GAP_SECONDS + 1, 0.6 + PQ_GAP_SECONDS + 1];
        const points = trajectoryPoints(madeUp({ t, flow: [1, 2, 3, 4], pressure: [1, 2, 3, 4] }));
        const nulls = points.filter((p) => p.x === null);
        assert.equal(nulls.length, 1, 'one break, and it is between the two runs');
        assert.equal(points.indexOf(nulls[0]), 2);
    });

    test('the offset moves B\'s clock and not its shape', () => {
        const plain = trajectoryPoints(B);
        const slid = trajectoryPoints(B, { offset: 2 });
        assert.deepEqual(slid.map((p) => p.x), plain.map((p) => p.x), 'a time offset cannot move a P-Q path');
        assert.deepEqual(slid.map((p) => p.y), plain.map((p) => p.y));
        assert.equal(slid[0].t - plain[0].t, 2, 'what it moves is the colour clock');
    });

    test('ONE clock for both shots, and the offset is in it', () => {
        assert.equal(trajectorySpan({ a: A }), A.axis.t[A.axis.t.length - 1]);
        const both = trajectorySpan({ a: A, b: B, offset: 1.5 });
        assert.equal(both, B.axis.t[B.axis.t.length - 1] + 1.5,
            'the later end of the two wins, B\'s slide included');
        assert.equal(trajectorySpan({}), 0);
    });

    test('the frame never shrinks below Slate\'s, and never crops the data', () => {
        const frame = trajectoryFrame({ a: A, b: B });
        const flowMax = Math.max(...[A, B].flatMap((d) => d.series.flow.y.filter(Number.isFinite)));
        assert.ok(flowMax > PQ_FLOW_MAX,
            'the fixture pair is exactly the case a literal port would have cropped');
        assert.ok(frame.flowMax >= flowMax, `the frame (${frame.flowMax}) holds the data (${flowMax})`);
        assert.equal(frame.pressureMax, PQ_PRESSURE_MAX, 'and an espresso keeps Slate\'s own frame');

        const small = trajectoryFrame({ a: madeUp({ t: [0], flow: [2], pressure: [6] }) });
        assert.deepEqual({ ...small }, { flowMax: PQ_FLOW_MAX, pressureMax: PQ_PRESSURE_MAX },
            'never below 8 x 12: the same pour is drawn in the same frame it always was');
    });
});

describe('Q16 — the correspondence marks', () => {
    test('the step is a round number out of the ONE tick table', () => {
        const { step, marks } = correspondenceMarks({ a: B });
        assert.ok(TICK_STEPS.includes(step), `${step} is not in chart-axis.js's ladder`);
        assert.ok(marks.length <= PQ_MARK_TARGET, 'at most PQ_MARK_TARGET marks');
        assert.deepEqual(marks.map((m) => m.t), marks.map((_, i) => (i + 1) * step),
            'the instants are multiples of the step, on A\'s clock');
        assert.deepEqual(marks.map((m) => m.label), marks.map((m) => `${m.t}s`));
    });

    test('a mark carries A\'s point and, when the offset places one, B\'s', () => {
        const { marks } = correspondenceMarks({ a: A, b: B, offset: 1.5 });
        assert.ok(marks.length > 0);
        for (const mark of marks) {
            assert.ok(mark.a, 'every mark sits on A');
            if (mark.b) {
                assert.notDeepEqual(mark.a, mark.b,
                    'the two shots are at different places at the same instant — that is the point');
            }
        }
    });

    test('sliding the alignment walks B\'s ends and leaves A\'s alone', () => {
        const at0 = correspondenceMarks({ a: A, b: B, offset: 0 });
        const at2 = correspondenceMarks({ a: A, b: B, offset: 2 });
        assert.deepEqual(at0.marks.map((m) => m.a), at2.marks.map((m) => m.a),
            'A does not move: it is the reference');
        const moved = at0.marks.some((m, i) => JSON.stringify(m.b) !== JSON.stringify(at2.marks[i]?.b));
        assert.equal(moved, true, 'B\'s ends walk along B\'s trajectory — the slider does something');
    });

    test('links are exactly the marks with both ends', () => {
        const { marks, links } = correspondenceMarks({ a: A, b: B, offset: 1.5 });
        assert.equal(links.length, marks.filter((m) => m.a && m.b).length);
        for (const link of links) {
            assert.ok(Number.isFinite(link.from.x) && Number.isFinite(link.to.x));
        }
    });

    test('no A, no marks — and no throw', () => {
        assert.deepEqual(correspondenceMarks({}).marks, []);
        assert.deepEqual(correspondenceMarks({ a: null, b: B, offset: 3 }).marks, []);
    });
});

describe('the axes', () => {
    test('the left axis is LOG, and its range is given in log10 units', () => {
        const [lo, hi] = derivedLeftRange({ a: A, b: B });
        assert.ok(lo >= Math.log10(DERIVED_LOG_FLOOR) - 1e-9, 'never below the floor');
        assert.ok(hi <= Math.log10(DERIVED_LOG_CEIL) + 1e-9, 'never above the ceiling');
        assert.ok(hi > lo);
    });

    test('it is computed from BOTH shots, so neither redraws when the other is picked', () => {
        const [, together] = derivedLeftRange({ a: A, b: B });
        const [, aAlone] = derivedLeftRange({ a: A });
        assert.ok(together >= aAlone);
        const peak = Math.max(...[A, B].flatMap((d) => DERIVED_LEFT_CHANNELS
            .flatMap((k) => d.series[k].y.filter((v) => typeof v === 'number' && v > 0))));
        assert.ok(together >= Math.log10(Math.min(peak, DERIVED_LOG_CEIL)) - 1e-9,
            'the axis holds the data');
    });

    test('an empty pair still gets numbers on the axis', () => {
        assert.deepEqual(derivedLeftRange({}),
            [Math.log10(DERIVED_LOG_FLOOR), Math.log10(DERIVED_LOG_CEIL)]);
        assert.deepEqual(derivedLeftRange({ a: RAW_A }),
            [Math.log10(DERIVED_LOG_FLOOR), Math.log10(DERIVED_LOG_CEIL)],
            'a shot the server served no derived channel for is an EMPTY axis, not a wrong one');
    });

    test('a tick is LABELLED as the number it stands for, not as its log', () => {
        assert.equal(formatLogTick(2), '100');
        assert.equal(formatLogTick(1), '10');
        assert.equal(formatLogTick(0), '1.0');
        assert.equal(formatLogTick(Math.log10(0.05)), '0.05');
    });

    test('every tick lands INSIDE the range, wide or narrow', () => {
        for (const range of [[-1.3, 2], [0.2, 0.7], [0, 0.4]]) {
            const splits = derivedTickValues(range);
            assert.ok(splits.length, `a range of ${range} must produce labels`);
            for (const v of splits) {
                assert.ok(v >= range[0] - 1e-9 && v <= range[1] + 1e-9, `${v} is outside ${range}`);
            }
        }
    });

    test('a decade span ticks by decades; a narrow one subdivides at 1, 2 and 5', () => {
        assert.deepEqual(derivedTickValues([0, 2]).map((v) => Math.round(v * 1000) / 1000),
            [0, 1, 2]);
        const narrow = derivedTickValues([0, 1]).map((v) => Math.round(10 ** v * 100) / 100);
        assert.deepEqual(narrow, [1, 2, 5, 10]);
    });

    test('the DATA is transformed with the axis, and a non-positive sample is a gap', () => {
        assert.deepEqual(toLog10([1, 10, 0, -4, null]), [0, 1, null, null, null]);
        const out = logRecords({ resistance: { x: [0, 1], y: [1, 100] } });
        assert.deepEqual(out.resistance.x, [0, 1], 'x is untouched');
        assert.deepEqual(out.resistance.y, [0, 2]);
    });
});

describe('the time ramp is the stylesheet\'s (A6)', () => {
    const STOPS = ['#440154', '#31688e', '#fde725'];

    test('an end is its own stop and the middle is a blend', () => {
        /* An end blends with itself, so every parseable stop comes back in one spelling
         * rather than sometimes as the authored hex and sometimes as a mix. */
        assert.equal(rampColour(STOPS, 0), 'rgb(68, 1, 84)');
        assert.equal(rampColour(STOPS, 1), 'rgb(253, 231, 37)');
        assert.equal(rampColour(STOPS, 0.5), 'rgb(49, 104, 142)');
        assert.equal(rampColour(STOPS, 0.25), 'rgb(59, 53, 113)');
    });

    test('it clamps rather than extrapolating, and survives an unparseable stop', () => {
        assert.equal(rampColour(STOPS, -5), 'rgb(68, 1, 84)');
        assert.equal(rampColour(STOPS, 99), 'rgb(253, 231, 37)');
        assert.equal(rampColour(STOPS, NaN), 'rgb(68, 1, 84)');
        assert.equal(rampColour(['oklch(0.5 0.1 200)', 'oklch(0.9 0.1 100)'], 0.9),
            'oklch(0.9 0.1 100)', 'a fork\'s ramp bands rather than disappearing');
        assert.equal(rampColour([], 0.5), null);
        assert.equal(rampColour(['#440154'], 0.5), '#440154');
    });

    test('rgb() stops parse too — a computed custom property may come back either way', () => {
        assert.equal(rampColour(['rgb(0, 0, 0)', 'rgb(100, 200, 40)'], 0.5), 'rgb(50, 100, 20)');
    });
});
