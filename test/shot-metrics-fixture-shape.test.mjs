
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
        assert.equal(got.reason, 'noPouringSample');
        assert.equal(got.counts.inShot, 0, 'not one flat row was read as a sample');
    });

    test('a refusal is not zero — nothing renders as a value that was never read', () => {
        assert.notEqual(got.scalars.peakPressure, 0);
        assert.equal(got.scalars.peakPressure, null);
        assert.equal(got.scalars.yieldSource, null);
    });

    test('half-flat is refused too: a nested machine cannot rescue a flat scale', () => {
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
        const bundle = { series: { pressure: { x: [0, 1], y: [9, 8] } }, axis: { t: [0, 1] } };
        assert.equal(deriveFromRecord(bundle).ok, false);
        assert.equal(deriveFromRecord(bundle).reason, 'measurementsNotServed');
        assert.equal(deriveFromRecord('a channel map, stringified').reason, 'notAShotRecord');
    });
});
