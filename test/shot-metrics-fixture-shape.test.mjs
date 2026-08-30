// DEFECT-DEFENDING SUITE 2, corrected (Risk 9) — the shot-metrics fixture shape.
//
// THE DEFECT, in one sentence: `shot-metrics.js` expected the FLAT channel map, the app
// handed it the SERIES BUNDLE (`shot-rating.js:38-39`), and all four readouts under the
// chart rendered a dash while the chart above them drew perfectly. It shipped that way
// because the suite hand-built the flat shape at `test/shot-metrics.test.mjs:9-13` — the
// shape the app never passed. Both halves were internally consistent; the only thing
// neither of them was, was the caller.
//
// THE CORRECTION IS STRUCTURAL. Gate 6 replaced the module with ONE derivation over ONE
// walk (`src/lib/shot-derivation.js`), reached by two entry points that take the two shapes
// the app actually holds: `deriveFromBuffer(buffer)` for the live shot and
// `deriveFromRecord(record)` for `GET /api/v1/shots/<id>`. There is no channel map to pass,
// so there is no contract left to mismatch — and `shot-derivation.test.mjs` walks the three
// real recordings in `tools/rea-fixtures/` rather than a payload of its own construction.
//
// WHAT THIS FILE ADDS is the assertion that closes the loop, and it is the one the old
// suite could not have made: THE FLAT SHAPE FAILS. Identical numbers, two shapes — nested
// derives the metrics, flat derives NOTHING and says why. The old defect was silent by
// construction (a green suite, a blank block, and no error anywhere between them), so the
// thing worth pinning is that the failure is now loud, refuses by name, and cannot be
// mistaken for a shot with nothing in it.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as derivation from '../src/lib/shot-derivation.js';
import { SERIES_KEYS, deriveFromRecord } from '../src/lib/shot-derivation.js';

const FIXTURE_DIR = fileURLToPath(new URL('../tools/rea-fixtures/', import.meta.url));
const SHOT = '7f6f1e2a-0000-4000-8000-00000000ff01';
const base = Date.parse('2026-08-18T04:00:00.000Z');
const at = (ms) => new Date(base + ms).toISOString();

/** The numbers, once. Both fixtures below are built from exactly these. */
const TICKS = Object.freeze([
    { ms: 0, substate: 'preinfusion', pressure: 2, flow: 0.1, weight: 0 },
    { ms: 1000, substate: 'preinfusion', pressure: 4, flow: 0.1, weight: 0.2 },
    { ms: 2000, substate: 'pouring', pressure: 9, flow: 2.4, weight: 0.9 },
    { ms: 3000, substate: 'pouring', pressure: 8.6, flow: 2.1, weight: 12 },
    { ms: 4000, substate: 'pouring', pressure: 8.2, flow: 1.9, weight: 24 },
    { ms: 5000, substate: 'pouring', pressure: 7.8, flow: 1.6, weight: 34 },
]);

/** The shape `MachineSnapshot.toJson` writes and the app therefore holds. */
const nested = () => ({
    id: SHOT,
    timestamp: at(0),
    measurements: TICKS.map(({ ms, substate, pressure, flow, weight }) => ({
        machine: {
            timestamp: at(ms),
            state: { state: 'espresso', substate },
            flow,
            pressure,
            targetFlow: 2,
            targetPressure: 9,
            mixTemperature: 90,
            groupTemperature: 92,
            targetMixTemperature: 92,
            targetGroupTemperature: 88,
            profileFrame: 0,
        },
        scale: { timestamp: at(ms), weight, weightFlow: 1.4, battery: 80, timerValue: ms },
    })),
});

/**
 * THE OLD FIXTURE. One flat row per tick, every channel at the top level — the shape
 * `shot-metrics.js` was written against and `test/shot-metrics.test.mjs:9-13` built by
 * hand. Same six ticks, same numbers, no `machine` and no `scale`.
 */
const flat = () => ({
    id: SHOT,
    timestamp: at(0),
    measurements: TICKS.map(({ ms, substate, pressure, flow, weight }) => ({
        timestamp: at(ms),
        substate,
        pressure,
        flow,
        weight,
        weightFlow: 1.4,
        groupTemperature: 92,
        targetGroupTemperature: 88,
        profileFrame: 0,
    })),
});

describe('the nested shape is the real one, and it derives', () => {
    const got = deriveFromRecord(nested());

    test('a record in the shape the route serves produces the metrics block', () => {
        assert.equal(got.ok, true);
        assert.equal(got.reason, null);
        assert.equal(got.scalars.peakPressure, 9);
        assert.equal(got.scalars.durationSeconds, 5);
        assert.equal(got.scalars.yield, 34, 'the settled weight off the scale');
    });

    test('and the recordings the derivation suite walks are that same nested shape', () => {
        // Not a payload of anyone's construction: three real `GET /shots/<id>` bodies.
        const recorded = readdirSync(FIXTURE_DIR)
            .filter((f) => /^api__v1__shots__[0-9a-f-]{36}\.json$/.test(f))
            .map((f) => JSON.parse(readFileSync(FIXTURE_DIR + f, 'utf8')));
        assert.equal(recorded.length, 3);
        for (const body of recorded) {
            assert.ok(body.measurements.length > 0);
            for (const row of body.measurements) {
                assert.equal(typeof row.machine, 'object', 'every recorded row nests under `machine`');
                assert.equal(Object.hasOwn(row, 'pressure'), false,
                    'and no recorded row carries a flat top-level channel');
                assert.equal(Object.hasOwn(row, 'flow'), false);
            }
        }
    });
});

describe('THE FLAT FIXTURE FAILS — the old contract cannot go green again', () => {
    const got = deriveFromRecord(flat());

    test('the same six ticks, flattened, derive nothing at all', () => {
        assert.equal(got.ok, false);
        for (const [name, value] of Object.entries(got.scalars)) {
            assert.equal(value, null, `scalars.${name} was derived from a shape the app never passes`);
        }
        for (const key of SERIES_KEYS) {
            assert.equal(got.series[key].y.length, 0, `series.${key} was populated from a flat row`);
        }
        assert.equal(got.axis.t.length, 0);
    });

    test('and it fails BY NAME, which is the half the old defect was missing', () => {
        // The defect was silent: a green suite, four dashes on screen, and nothing anywhere
        // in between that said a shape had been refused.
        assert.equal(got.reason, 'noPouringSample');
        assert.equal(got.counts.inShot, 0, 'not one flat row was read as a sample');
    });

    test('a refusal is not zero — nothing renders as a value that was never read', () => {
        // A7. Had the old module returned 0 for a peak it could not find, the readouts
        // would have shown a number instead of a dash and the defect would still be there.
        assert.notEqual(got.scalars.peakPressure, 0);
        assert.equal(got.scalars.peakPressure, null);
        assert.equal(got.scalars.yieldSource, null);
    });

    test('half-flat is refused too: a nested machine cannot rescue a flat scale', () => {
        // The realistic regression is not a wholly flat payload, it is one caller passing
        // one half in the old shape.
        const record = nested();
        record.measurements = record.measurements.map(({ machine }, i) => ({
            machine,
            weight: TICKS[i].weight,          // the scale, flattened onto the row
        }));
        const half = deriveFromRecord(record);
        assert.equal(half.ok, true, 'the machine half still reads — it is in the right shape');
        assert.equal(half.scalars.yield, null, 'but no weight is taken from the flat half');
        assert.equal(half.availability.scale, false);
        assert.ok(half.series.weight.y.every((v) => v === null));
    });
});

describe('there is no channel-map entry point left to mismatch', () => {
    test('the module takes a RECORD or a BUFFER, and nothing else', () => {
        assert.equal(typeof derivation.deriveFromRecord, 'function');
        assert.equal(typeof derivation.deriveFromBuffer, 'function');
        for (const gone of ['computeShotMetrics', 'shotMetrics', 'metricsFromSeries', 'deriveFromSeries']) {
            assert.equal(derivation[gone], undefined,
                `${gone} would be a third entry point taking a shape of its own — which is the defect`);
        }
    });

    test('a series bundle handed in where a record goes is refused, not half-read', () => {
        // `shot-rating.js:38-39` passed exactly this: the bundle, to something expecting the
        // channels. Here the mismatch cannot half-work — the bundle carries no
        // `measurements`, so it is refused on the way in and named for what is missing.
        const bundle = { series: { pressure: { x: [0, 1], y: [9, 8] } }, axis: { t: [0, 1] } };
        assert.equal(deriveFromRecord(bundle).ok, false);
        assert.equal(deriveFromRecord(bundle).reason, 'measurementsNotServed');
        assert.equal(deriveFromRecord('a channel map, stringified').reason, 'notAShotRecord');
    });
});
