
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    ABSENCE,
    ENJOYMENT_KEY,
    SHOT_ANNOTATION_KEYS,
    SHOT_ANNOTATION_NUMERIC_KEYS,
    SHOT_RECORD_KEYS,
    WORKFLOW_CONTEXT_KEYS,
    readShotAnnotations,
    readShotWorkflow,
    readStoredShot,
    shotDose,
} from '../src/data/rea-shot-record.js';
import { hasReading, isNoReading } from '../src/data/reading.js';

const RECORD = {
    id: 'a-shot',
    timestamp: '2026-08-17T09:15:00.000Z',
    stopReason: 'weight',
    measurements: [{ machine: {} }],
    annotations: {
        actualDoseWeight: 18.2,
        actualYield: 36.4,
        drinkTds: 9.1,
        drinkEy: 21.3,
        enjoyment: 80,
        espressoNotes: 'jammy',
    },
    workflow: {
        context: { targetDoseWeight: 18, targetYield: 36 },
        profile: { title: 'Bench', steps: [{ name: 'Preinfuse' }, { name: 'Extract' }, {}] },
    },
};

describe('the key lists are the schema, written once', () => {
    test('ShotRecord and ShotAnnotations, as ReaPrime writes them', () => {
        assert.deepEqual([...SHOT_RECORD_KEYS],
            ['id', 'timestamp', 'measurements', 'workflow', 'annotations', 'stopReason']);
        assert.equal(SHOT_ANNOTATION_KEYS.length, 6);
        assert.ok(SHOT_ANNOTATION_KEYS.includes(ENJOYMENT_KEY),
            'enjoyment is ReaPrime\'s own column, not the old skin\'s private key-value orphan');
        assert.deepEqual([...WORKFLOW_CONTEXT_KEYS], ['targetDoseWeight', 'targetYield']);
    });

    test('the numeric list is the annotation list less the one text field', () => {
        assert.deepEqual([...SHOT_ANNOTATION_NUMERIC_KEYS],
            SHOT_ANNOTATION_KEYS.filter((key) => key !== 'espressoNotes'));
    });

    test('NOT ONE computed shot metric is an annotation — that absence is B5', () => {
        for (const dead of ['duration', 'peakPressure', 'averageFlow', 'timeToFirstDrop', 'ratio']) {
            assert.ok(!SHOT_ANNOTATION_KEYS.includes(dead),
                `${dead} is computed in the skin for v1 because nothing serves it`);
        }
    });
});

describe('readShotAnnotations', () => {
    test('reads the six fields, numbers as numbers and notes as text', () => {
        const got = readShotAnnotations(RECORD);
        assert.equal(got.present, true);
        assert.equal(got.actualDoseWeight, 18.2);
        assert.equal(got.enjoyment, 80);
        assert.equal(got.espressoNotes, 'jammy');
    });

    test('NO annotations object is an absence for every field, and says so', () => {
        const got = readShotAnnotations({ id: 'x' });
        assert.equal(got.present, false);
        for (const key of SHOT_ANNOTATION_KEYS) {
            assert.ok(isNoReading(got[key]), `${key} must be an absence, not undefined`);
        }
        assert.equal(Number(got.actualYield), Number(got.actualYield),
            'and arithmetic on it is NaN — loud rather than plausible');
        assert.ok(Number.isNaN(Number(got.actualYield)));
    });

    test('a present object with a key missing is ABSENT for that field only', () => {
        const got = readShotAnnotations({ annotations: { actualYield: 36.4 } });
        assert.equal(got.present, true);
        assert.equal(got.actualYield, 36.4);
        assert.equal(got.actualDoseWeight.reason, ABSENCE.ABSENT);
    });

    test('an explicit null is a NULL absence, which is a different fact', () => {
        const got = readShotAnnotations({ annotations: { enjoyment: null } });
        assert.equal(got.enjoyment.reason, ABSENCE.NULL, 'the server wrote the key and meant nothing by it');
    });

    test('a non-finite number is never read as a measurement', () => {
        const got = readShotAnnotations({ annotations: { drinkTds: 'nine' } });
        assert.ok(isNoReading(got.drinkTds));
        assert.equal(got.drinkTds.reason, ABSENCE.NON_FINITE);
    });
});

describe('readShotWorkflow — the two things a chart needs from it', () => {
    test('the target dose and the profile step NAMES, in order', () => {
        const got = readShotWorkflow(RECORD);
        assert.equal(got.present, true);
        assert.equal(got.title, 'Bench');
        assert.equal(got.targetDoseWeight, 18);
        assert.deepEqual([...got.stepNames], ['Preinfuse', 'Extract', null],
            'a step with no name is null — an unlabelled tick, not an empty string that looks '
            + 'like a label that failed');
    });

    test('NO profile is stepNames: null, which is not a profile with no steps', () => {
        assert.equal(readShotWorkflow({ workflow: { context: {} } }).stepNames, null,
            'the boundary is a fact about the machine\'s profileFrame, not about the profile listing');
        assert.deepEqual([...readShotWorkflow({ workflow: { profile: { steps: [] } } }).stepNames], []);
    });

    test('no workflow at all is an absence for every field', () => {
        const got = readShotWorkflow({ id: 'x' });
        assert.equal(got.present, false);
        assert.ok(isNoReading(got.targetDoseWeight));
        assert.ok(isNoReading(got.title));
        assert.equal(got.stepNames, null);
    });
});

describe('readStoredShot — the shell, and the ONE thing it does not parse', () => {
    test('measurements come back BY REFERENCE and unparsed', () => {
        const got = readStoredShot(RECORD);
        assert.equal(got.ok, true);
        assert.equal(got.id, 'a-shot');
        assert.equal(got.stopReason, 'weight');
        assert.equal(got.measurements, RECORD.measurements,
            'parsing it is Gate 6\'s single walk; this layer deliberately adds no second pass');
        assert.equal(got.hasMeasurements, true);
    });

    test('a META-ONLY payload is an absence of samples, not a shot with none', () => {
        const meta = readStoredShot({ id: 'a-shot', timestamp: RECORD.timestamp });
        assert.equal(meta.ok, true, 'it IS a record — /shots/latest and the list rows are real');
        assert.equal(meta.hasMeasurements, false);
        assert.deepEqual(meta.measurements, [], 'and the array is empty rather than undefined');
    });

    test('a shot with an empty measurements array HAS measurements — it simply has none', () => {
        const empty = readStoredShot({ id: 'x', measurements: [] });
        assert.equal(empty.hasMeasurements, true,
            'the two cases are different reasons and the derivation reports different ones');
    });

    test('a payload that is not a record at all is refused', () => {
        for (const notARecord of [null, undefined, 'shot', 42, [1, 2]]) {
            assert.equal(readStoredShot(notARecord).ok, false, `${JSON.stringify(notARecord)} is not a record`);
        }
        assert.equal(readStoredShot([]).ok, false, 'an ARRAY is the list endpoint\'s answer, not a shot');
    });

    test('a null measurements value is not a list', () => {
        const got = readStoredShot({ id: 'x', measurements: null });
        assert.equal(got.hasMeasurements, false);
        assert.deepEqual(got.measurements, []);
    });
});

describe('shotDose — two named quantities and a STATED preference', () => {
    test('the dose that went IN wins over the dose that was asked for', () => {
        assert.deepEqual({ ...shotDose(readStoredShot(RECORD)) }, { value: 18.2, source: 'actual' });
    });

    test('the target is used when there is no actual, and it SAYS so', () => {
        const stored = readStoredShot({ ...RECORD, annotations: { actualYield: 36.4 } });
        assert.deepEqual({ ...shotDose(stored) }, { value: 18, source: 'target' },
            'a ratio computed from the target is a ratio for a shot nobody pulled, so the caller '
            + 'can see that it is');
    });

    test('neither is an ABSENCE with a null source, never a zero', () => {
        const got = shotDose(readStoredShot({ id: 'x' }));
        assert.equal(got.source, null);
        assert.ok(isNoReading(got.value));
        assert.ok(!hasReading(got.value));
    });

    test('a dose of zero is not a dose', () => {
        const zeroed = readStoredShot({
            annotations: { actualDoseWeight: 0 },
            workflow: { context: { targetDoseWeight: 0 } },
        });
        assert.equal(shotDose(zeroed).source, null, 'zero grams of coffee is a sentinel, not a measurement');
    });

    test('the deleted third rung stays deleted', () => {
        const withDeadField = readStoredShot({
            workflow: { profile: { dose_weight: 20, steps: [] } },
        });
        assert.equal(shotDose(withDeadField).source, null,
            '`Profile.toJson` does not emit dose_weight — the fallback could only ever have '
            + 'produced undefined, which is the fallback rule in its purest form');
    });
});
