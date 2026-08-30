// The address layer — the one reader that speaks ReaPrime's current names.
//
// Frames below are built from the serialisers as written at ReaPrime 2b047d02
// (MachineSnapshot.toJson, WeightSnapshot.toJson, ShotSnapshot.toJson,
// BenglePuckEstimator.encodeSample, BengleMilkProbe, SteamSnapshot.toJson).
//
// The single most important test in this file is "a gated channel is absent, not
// recomputed". Every other assertion is scaffolding around that one, because a
// locally-recomputed ratio behind a dead server name is the defect class this whole wave
// exists to kill.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    ABSENCE,
    readMachineSnapshot,
    readScaleSnapshot,
    readEstimatorFrame,
    readMilkProbeFrame,
    readStoredMeasurement,
    storedShotSensors,
    readStoredSteamSnapshot,
    isSensorErrorEnvelope,
    derivedChannelsPresent,
    findSensorId,
    sensorKindOf,
    isNoReading,
    hasReading,
    toPlot,
} from '../src/data/rea-address.js';
import { SNAPSHOT_KEYS, ESTIMATOR_CHANNELS, DEAD_NAMES_GLOBAL } from '../src/data/rea-names.js';

const MACHINE_ID = 'DE1-ABCD';
const ESTIMATOR_ID = `${MACHINE_ID}-puckestimator`;
const MILK_ID = `${MACHINE_ID}-milkprobe`;

/** A frame below the derived gate: the three *Derived keys are OMITTED by the server. */
const gatedOff = () => ({
    timestamp: '2026-08-17T09:00:00.000',
    state: { state: 'espresso', substate: 'preinfusion' },
    flow: 0.2,
    pressure: 0.1,
    targetFlow: 2.0,
    targetPressure: 6.0,
    mixTemperature: 91.2,
    groupTemperature: 88.4,
    targetMixTemperature: 92.0,
    targetGroupTemperature: 89.0,
    profileFrame: 2,
    steamTemperature: 152,
});

/** The same frame above the gate: all three written. */
const gatedOn = () => ({
    ...gatedOff(),
    flow: 2.0,
    pressure: 8.0,
    puckResistanceDerived: 2.0,
    loadImpedanceDerived: 4.0,
    hydraulicPowerDerived: 1.6,
});

describe('the machine snapshot', () => {
    test('every key the server always writes is read', () => {
        const s = readMachineSnapshot(gatedOn());
        assert.equal(s.ok, true);
        assert.equal(s.timestamp, '2026-08-17T09:00:00.000');
        assert.equal(s.state, 'espresso');
        assert.equal(s.substate, 'preinfusion');
        assert.equal(s.stateKnown, true);
        assert.equal(s.substateKnown, true);
        for (const key of SNAPSHOT_KEYS) {
            if (key === 'timestamp' || key === 'state') continue;
            assert.equal(hasReading(s[key]), true, `${key} must be read`);
        }
        assert.equal(s.pressure, 8.0);
        assert.equal(s.steamTemperature, 152);
    });

    test('THE A7 TEST: a gated channel is absent, not recomputed', () => {
        const frame = gatedOff();
        const s = readMachineSnapshot(frame);

        // P/F² is computable from this very frame — 0.1 / 0.04 = 2.5 — and the old skin
        // computed it. It would have charted as a real puck resistance at a flow the
        // server considers meaningless noise. Here it is a gap, with a reason.
        for (const key of ['puckResistanceDerived', 'loadImpedanceDerived', 'hydraulicPowerDerived']) {
            assert.equal(isNoReading(s[key]), true, `${key} must not be manufactured`);
            assert.equal(s[key].reason, ABSENCE.ABSENT);
            assert.equal(toPlot(s[key]), null, `${key} must plot as a gap`);
        }
        assert.deepEqual(derivedChannelsPresent(s), []);
    });

    test('a written derived channel is read verbatim, gate or no gate', () => {
        const s = readMachineSnapshot(gatedOn());
        assert.equal(s.puckResistanceDerived, 2.0);
        assert.equal(s.loadImpedanceDerived, 4.0);
        assert.equal(s.hydraulicPowerDerived, 1.6);
        assert.deepEqual(derivedChannelsPresent(s).sort(),
            ['hydraulicPowerDerived', 'loadImpedanceDerived', 'puckResistanceDerived']);
        // And the reader does not check the value against its own recomputation either —
        // the server's number is the number.
        const odd = readMachineSnapshot({ ...gatedOn(), puckResistanceDerived: 999 });
        assert.equal(odd.puckResistanceDerived, 999);
    });

    test('a partial derived set is read one key at a time', () => {
        const frame = gatedOn();
        delete frame.hydraulicPowerDerived;
        const s = readMachineSnapshot(frame);
        assert.equal(s.puckResistanceDerived, 2.0);
        assert.equal(s.hydraulicPowerDerived.reason, ABSENCE.ABSENT);
    });

    test('there is NO reader for weight, weightFlow or milkTemperature on the machine', () => {
        // 633f6f68 deleted all three ("MachineSnapshot stays pure machine telemetry").
        // Three of the 31 live contract bugs are the old skin still reading them here.
        const legacy = { ...gatedOn(), weight: 18.2, weightFlow: 1.7, milkTemperature: 62.5 };
        const s = readMachineSnapshot(legacy);
        for (const key of ['weight', 'weightFlow', 'milkTemperature']) {
            assert.equal(Object.hasOwn(s, key), false, `${key} must have no reader on the machine snapshot`);
        }
        // It is REPORTED, though — a server older than the pin is visible, not silent.
        assert.deepEqual([...s.deadKeys].sort(), ['milkTemperature', 'weight', 'weightFlow']);
    });

    test('legacy estimator keys on the snapshot are reported and never read', () => {
        const legacy = { ...gatedOff(), fusedR1: 4.4, fusedR2: 2.2, estFlags: 5, detEventCount: 3 };
        const s = readMachineSnapshot(legacy);
        assert.deepEqual([...s.deadKeys].sort(), ['detEventCount', 'estFlags', 'fusedR1', 'fusedR2']);
        for (const dead of DEAD_NAMES_GLOBAL) assert.equal(Object.hasOwn(s, dead), false, dead);
        // And crucially the dead value does not leak into the live channel.
        assert.equal(isNoReading(s.puckResistanceDerived), true);
        assert.equal(isNoReading(s.loadImpedanceDerived), true);
    });

    test('an unknown state name is surfaced, not mapped to something familiar', () => {
        const s = readMachineSnapshot({ ...gatedOn(), state: { state: 'ready', substate: 'ending' } });
        assert.equal(s.state, 'ready');
        assert.equal(s.stateKnown, false);
        assert.equal(s.substateKnown, false);
    });

    test('a missing or malformed frame reads as absent throughout', () => {
        for (const bad of [null, undefined, 'not a frame', 42]) {
            const s = readMachineSnapshot(bad);
            assert.equal(s.ok, false);
            assert.equal(s.flow.reason, ABSENCE.NO_SOURCE);
            assert.equal(s.state.reason, ABSENCE.NO_SOURCE);
            assert.deepEqual([...s.deadKeys], []);
        }
        const noState = readMachineSnapshot({ ...gatedOn(), state: undefined });
        assert.equal(noState.state.reason, ABSENCE.NO_SOURCE);
    });
});

describe('the scale — the one gravimetric source', () => {
    const frame = () => ({
        timestamp: '2026-08-17T09:00:00.000',
        weight: 18.24,
        weightFlow: 1.72,
        battery: 87,
        timerValue: 12500,
    });

    test('weightFlow is read here, for every machine, with no machine-type branch', () => {
        const s = readScaleSnapshot(frame());
        assert.equal(s.ok, true);
        assert.equal(s.weightFlow, 1.72);
        assert.equal(s.weight, 18.24);
        assert.equal(s.battery, 87);
        assert.equal(s.timerValue, 12500);
    });

    test('a shot pulled with no scale is a gap for the whole shot, not a zero', () => {
        // Stored measurements serialise `scale: null` on every sample.
        const s = readScaleSnapshot(null);
        assert.equal(s.ok, false);
        assert.equal(s.weightFlow.reason, ABSENCE.NO_SOURCE);
        assert.equal(toPlot(s.weight), null);
    });

    test('on the scale a NULL value is the absence signal, since the keys are unconditional', () => {
        const s = readScaleSnapshot({ ...frame(), battery: null, timerValue: null });
        assert.equal(s.battery.reason, ABSENCE.NULL);
        assert.equal(s.timerValue.reason, ABSENCE.NULL);
        assert.equal(s.weightFlow, 1.72);
    });
});

describe('the puck estimator sensor', () => {
    const frame = () => ({
        timestamp: '2026-08-17T09:00:00.000',
        rev: 3,
        flags: 9,
        r1: 4.1,
        r2: 2.05,
        compliance: 1.48,
        confidence: 0.82,
        lagConfidence: 0.5,
        sigmaQ: 0.09,
        collapseEventCount: 2,
        collapseLastEventT: 14.2,
        collapseLastEventMagnitude: 0.31,
        collapseLastEventConcavity: -0.02,
        hydraulicPowerMeasured: 1.9,
    });

    test('channels keep the firmware/ReaPrime names — r1, r2, compliance, flags, collapse*', () => {
        const s = readEstimatorFrame(frame());
        assert.equal(s.ok, true);
        assert.equal(s.channels.r1, 4.1);
        assert.equal(s.channels.r2, 2.05);
        assert.equal(s.channels.compliance, 1.48);
        assert.equal(s.channels.flags, 9);
        assert.equal(s.channels.collapseEventCount, 2);
        assert.equal(s.channels.collapseLastEventMagnitude, 0.31);
        assert.equal(s.channels.hydraulicPowerMeasured, 1.9);
        assert.deepEqual(Object.keys(s.channels), [...ESTIMATOR_CHANNELS]);
    });

    test('no old name is translated back — the shim this layer replaces is gone', () => {
        const s = readEstimatorFrame(frame());
        for (const dead of DEAD_NAMES_GLOBAL) {
            assert.equal(Object.hasOwn(s.channels, dead), false, `${dead} must not reappear`);
        }
    });

    test('an unobserved channel is omitted by the firmware and stays absent here', () => {
        const partial = frame();
        delete partial.r2;
        delete partial.compliance;
        const s = readEstimatorFrame(partial);
        assert.equal(s.channels.r2.reason, ABSENCE.ABSENT);
        assert.equal(s.channels.compliance.reason, ABSENCE.ABSENT);
        assert.equal(toPlot(s.channels.r2), null, 'a gap, not a zero resistance');
        assert.equal(s.channels.r1, 4.1, 'and its neighbour is unaffected');
    });

    test('pre-rev-3 firmware simply has no measured power', () => {
        const old = frame();
        old.rev = 2;
        delete old.hydraulicPowerMeasured;
        const s = readEstimatorFrame(old);
        assert.equal(s.channels.rev, 2);
        assert.equal(s.channels.hydraulicPowerMeasured.reason, ABSENCE.ABSENT);
    });

    test('an error envelope is a signal, not a frame', () => {
        // sensors_handler answers an unknown id with {"error":"not found"} and closes. The
        // old skin mapped that to an empty channel set, so a machine swap silently emptied
        // every channel and every consumer fell back to the derived one.
        const envelope = { error: 'not found' };
        assert.equal(isSensorErrorEnvelope(envelope), true);
        const s = readEstimatorFrame(envelope);
        assert.equal(s.ok, false);
        assert.equal(s.error, 'not found');
        assert.equal(s.channels.r1.reason, ABSENCE.ERROR);
        assert.notEqual(s.channels.r1.reason, ABSENCE.ABSENT, 'distinguishable from "not observed"');
    });

    test('no frame yet is NO_SOURCE, distinct from both of the above', () => {
        const s = readEstimatorFrame(null);
        assert.equal(s.ok, false);
        assert.equal(s.error, null);
        assert.equal(s.channels.r1.reason, ABSENCE.NO_SOURCE);
    });

    test('the milk probe is read the same way, on its own channel', () => {
        const s = readMilkProbeFrame({ timestamp: 'T', temperature: 61.5 });
        assert.equal(s.channels.temperature, 61.5);
        assert.equal(readMilkProbeFrame({ timestamp: 'T' }).channels.temperature.reason, ABSENCE.ABSENT);
        assert.equal(Object.hasOwn(s.channels, 'milkTemperature'), false);
    });

    test('sensor ids are matched by suffix, because a machine swap mints a new one', () => {
        assert.equal(sensorKindOf(ESTIMATOR_ID), 'puckEstimator');
        assert.equal(sensorKindOf(MILK_ID), 'milkProbe');
        assert.equal(sensorKindOf('DE1-ABCD-scale'), null);
        const listing = [{ id: MILK_ID, info: {} }, { id: ESTIMATOR_ID, info: {} }];
        assert.equal(findSensorId(listing, 'puckEstimator'), ESTIMATOR_ID);
        assert.equal(findSensorId(listing, 'milkProbe'), MILK_ID);
        assert.equal(findSensorId([], 'puckEstimator'), null);
        assert.equal(findSensorId(null, 'puckEstimator'), null);
    });
});

describe('stored shots — absence is permanent', () => {
    const withSensors = () => ({
        machine: gatedOn(),
        scale: { timestamp: 'T', weight: 18.2, weightFlow: 1.7, battery: 90, timerValue: 9000 },
        volume: 22.5,
        sensors: { [ESTIMATOR_ID]: { rev: 3, flags: 9, r1: 4.1, r2: 2.05, confidence: 0.8, lagConfidence: 0.4, sigmaQ: 0.1 } },
    });

    /** A record written before 2b047d02: no `sensors` key anywhere, and no scale. */
    const legacy = () => ({ machine: gatedOn(), scale: null, volume: 22.5 });

    test('a recorded sensors map replays the estimator exactly as live saw it', () => {
        const m = readStoredMeasurement(withSensors());
        assert.equal(m.sensorsRecorded, true);
        assert.equal(m.estimator.channels.r1, 4.1);
        assert.equal(m.estimator.channels.r2, 2.05);
        assert.equal(m.scale.weightFlow, 1.7);
        assert.equal(m.volume, 22.5);
    });

    test('THE PERMANENCE TEST: no sensors key means unavailable for this shot, forever', () => {
        const m = readStoredMeasurement(legacy());
        assert.equal(m.sensorsRecorded, false);
        for (const channel of ESTIMATOR_CHANNELS) {
            assert.equal(m.estimator.channels[channel].reason, ABSENCE.PERMANENT, channel);
        }
        assert.equal(m.milkProbe.channels.temperature.reason, ABSENCE.PERMANENT);
    });

    test('permanent absence NEVER falls through to the derived channel', () => {
        // The two are computed from different flows (Q_puck vs Q_in) and diverge exactly
        // during the compliance transients anyone reading r2 cares about. Presenting one as
        // the other is the misreading; both are surfaced, separately, and the CHOICE
        // between them is B6's, made at shot start.
        const m = readStoredMeasurement(legacy());
        assert.equal(isNoReading(m.estimator.channels.r2), true);
        assert.equal(m.machine.puckResistanceDerived, 2.0, 'the derived channel is still read');
        assert.notEqual(m.estimator.channels.r2, m.machine.puckResistanceDerived);
    });

    test('an attached-but-silent sensor is a NORMAL absence, not a permanent one', () => {
        const m = readStoredMeasurement({ ...withSensors(), sensors: { [ESTIMATOR_ID]: { rev: 3, flags: 9, confidence: 0.1, lagConfidence: 0, sigmaQ: 0.4 } } });
        assert.equal(m.estimator.channels.r2.reason, ABSENCE.ABSENT);
        assert.notEqual(m.estimator.channels.r2.reason, ABSENCE.PERMANENT);
    });

    test('the shot-level question is answered once, from key presence', () => {
        const record = { measurements: [legacy(), withSensors(), legacy()] };
        const sensors = storedShotSensors(record);
        assert.equal(sensors.recorded, true);
        assert.equal(sensors.samplesWithSensors, 1);
        assert.equal(sensors.sampleCount, 3);
        assert.equal(sensors.estimatorId, ESTIMATOR_ID);
        assert.equal(sensors.estimator, true);
        assert.equal(sensors.milkProbe, false);

        const old = storedShotSensors({ measurements: [legacy(), legacy()] });
        assert.equal(old.recorded, false);
        assert.equal(old.estimatorId, null);
        assert.equal(old.estimator, false);

        assert.equal(storedShotSensors(null).recorded, false);
        assert.equal(storedShotSensors({}).sampleCount, 0);
    });

    test('a stored measurement carrying dead machine keys reports them and reads none', () => {
        const m = readStoredMeasurement({ ...legacy(), machine: { ...gatedOn(), weight: 18.2, weightFlow: 1.7, fusedR2: 2.4 } });
        assert.deepEqual([...m.machine.deadKeys].sort(), ['fusedR2', 'weight', 'weightFlow']);
        assert.equal(Object.hasOwn(m.machine, 'weightFlow'), false);
        // The only weight flow in the shot is the scale's, and this shot has no scale.
        assert.equal(m.scale.weightFlow.reason, ABSENCE.NO_SOURCE);
    });
});

describe('steam — one trace, two reads', () => {
    test('a stored steam session reads its own milkTemperature double', () => {
        const s = readStoredSteamSnapshot({ machine: gatedOn(), milkTemperature: 62.4 });
        assert.equal(s.ok, true);
        assert.equal(s.milkTemperature, 62.4);
        assert.equal(s.machine.pressure, 8.0);
    });

    test('the field is written unconditionally, so null is its absence — and null is common', () => {
        // ReaPrime's steam sequencer picks its temperature source by map insertion order
        // and can pick the puck estimator, which has no `temperature` channel at all. That
        // is a ReaPrime-side contract bug on the upstream list, not something to paper over.
        const s = readStoredSteamSnapshot({ machine: gatedOn(), milkTemperature: null });
        assert.equal(s.milkTemperature.reason, ABSENCE.NULL);
        assert.equal(toPlot(s.milkTemperature), null);
    });

    test('the live milk read is a different read entirely, and stays separate', () => {
        const live = readMilkProbeFrame({ timestamp: 'T', temperature: 62.4 });
        assert.equal(live.channels.temperature, 62.4);
        assert.equal(Object.hasOwn(live.channels, 'milkTemperature'), false);
    });
});

describe('recorded bench fixtures', () => {
    // tools/rea-fixtures holds real recorded ReaPrime responses. They were captured from an
    // OLDER build than the pinned commit (their shots carry weight / weightFlow /
    // milkTemperature / fusedR1 / detEventCount on the machine object, which 633f6f68
    // deleted and which 2b047d02's fixed-key fromJson/toJson cannot re-emit). That makes
    // them the best available evidence of a legacy row, and the sternest test of the rule:
    // whatever a frame carries, the reader takes nothing from a dead name.
    const dir = fileURLToPath(new URL('../tools/rea-fixtures/', import.meta.url));
    // `/shots/latest` lives in this directory too and is deliberately OUT of this loop:
    // `ShotsHandler._getLatestShot` answers `toJsonWithoutMeasurements()`, so a body with
    // no measurements is that route's CORRECT shape rather than a short recording. It is
    // asserted on its own terms below. The file that used to sit there was the by-id
    // response pasted over it — 426 measurements the route cannot send — and this loop
    // read them happily, which is how a fixture stops being a recording unnoticed.
    const LATEST = 'api__v1__shots__latest.json';
    const shotFiles = readdirSync(dir)
        .filter((f) => /^api__v1__shots__/.test(f) && f !== LATEST);

    test('the fixture set still contains shot records to read', () => {
        assert.ok(shotFiles.length >= 1, 'no recorded shot fixtures found');
    });

    test(`${LATEST}: a recording of the route, not of the by-id response`, () => {
        const record = JSON.parse(readFileSync(`${dir}${LATEST}`, 'utf8'));
        assert.equal(Object.hasOwn(record, 'measurements'), false,
            '_getLatestShot serves toJsonWithoutMeasurements, which omits the key entirely — '
            + 'a `measurements` array here is the by-id response pasted over this route again');
        assert.ok(record.id, 'still a shot record');
    });

    for (const file of shotFiles) {
        test(`${file}: every measurement reads through the address layer, dead names reported never read`, () => {
            const record = JSON.parse(readFileSync(`${dir}${file}`, 'utf8'));
            const measurements = Array.isArray(record.measurements) ? record.measurements : [];
            assert.ok(measurements.length > 0, 'fixture has measurements');

            const sensors = storedShotSensors(record);
            let deadSeen = 0;
            for (const measurement of measurements.slice(0, 200)) {
                const m = readStoredMeasurement(measurement, {
                    estimatorId: sensors.estimatorId,
                    milkProbeId: sensors.milkProbeId,
                });
                assert.equal(m.machine.ok, true);
                assert.equal(hasReading(m.machine.pressure), true);
                deadSeen += m.machine.deadKeys.length;
                for (const dead of DEAD_NAMES_GLOBAL) {
                    assert.equal(Object.hasOwn(m.machine, dead), false, `${dead} has no reader`);
                }
                if (!sensors.recorded) {
                    assert.equal(m.estimator.channels.r2.reason, ABSENCE.PERMANENT);
                    assert.equal(m.milkProbe.channels.temperature.reason, ABSENCE.PERMANENT);
                }
            }
            // Not asserted as a fixed number: if these fixtures are ever re-recorded against
            // the pinned build the count goes to zero and the rule above still holds.
            assert.ok(deadSeen >= 0);
        });
    }
});

/* ────────────────────────────────────────────────────────────────────────────────────
 * WHAT IS NOT A FRAME.
 *
 * These three readers accepted a JSON array and an envelope as valid frames — `ok: true`
 * with every channel reported "absent", which is indistinguishable from a machine, a scale
 * or a sensor that is on the wire and reporting nothing. The socket layer's classifier
 * called the same array MALFORMED, so the two layers disagreed about the same bytes; the
 * predicate now has one implementation and this file imports it.
 */
describe('an array and an envelope are not frames', () => {
    test('a JSON array is rejected by every reader, not read as "everything absent"', () => {
        for (const bad of [[], ['x'], [1, 2, 3]]) {
            const machine = readMachineSnapshot(bad);
            assert.equal(machine.ok, false, 'machine snapshot');
            assert.equal(machine.flow.reason, ABSENCE.NO_SOURCE);
            assert.equal(readScaleSnapshot(bad).ok, false, 'scale snapshot');
            assert.equal(readScaleSnapshot(bad).weightFlow.reason, ABSENCE.NO_SOURCE);
            assert.equal(readEstimatorFrame(bad).ok, false, 'estimator frame');
            assert.equal(readEstimatorFrame(bad).channels.r1.reason, ABSENCE.NO_SOURCE);
            assert.equal(readMilkProbeFrame(bad).ok, false, 'milk probe frame');
            assert.equal(readStoredSteamSnapshot(bad).ok, false, 'stored steam snapshot');
        }
    });

    test('the scale STATUS envelope is a signal, and reads as one', () => {
        // scale_handler.dart's `sendStatus` writes this down the same socket as
        // WeightSnapshot.toJson. Read as a snapshot it has no weight and no weightFlow —
        // exactly a scale that is present and still.
        const envelope = readScaleSnapshot({ status: 'disconnected' });
        assert.equal(envelope.ok, false);
        assert.equal(envelope.envelope, 'status');
        assert.equal(envelope.weight.reason, ABSENCE.NO_SOURCE);
        assert.equal(envelope.weightFlow.reason, ABSENCE.NO_SOURCE);
    });

    test('an error envelope is a signal on the machine snapshot too, not an empty machine', () => {
        const refused = readMachineSnapshot({ error: 'not found' });
        assert.equal(refused.ok, false);
        assert.equal(refused.envelope, 'error');
        assert.equal(refused.pressure.reason, ABSENCE.NO_SOURCE);
    });

    test('a real frame that happens to carry a status string is still a frame', () => {
        // The envelope test is `status` WITHOUT a timestamp — a WeightSnapshot always has
        // one — so a real frame is never mistaken for the envelope.
        const frame = readScaleSnapshot({ timestamp: '2026-08-17T09:00:00.000', status: 'x', weight: 18.2 });
        assert.equal(frame.ok, true);
        assert.equal(frame.envelope, null);
        assert.equal(frame.weight, 18.2);
    });

    test('the error-envelope rule has ONE implementation, shared with the classifier', async () => {
        const { classifyMessage, WS_MESSAGE } = await import('../src/data/rea-ws-channels.js');
        for (const payload of [{ error: 'not found' }, { error: 'Unknown command' }]) {
            assert.equal(isSensorErrorEnvelope(payload), true);
            assert.equal(classifyMessage(payload).kind, WS_MESSAGE.ERROR);
        }
        for (const payload of [[], null, 42, { weight: 1 }]) {
            assert.equal(isSensorErrorEnvelope(payload), false);
        }
        // The disagreement that was: the classifier called an array malformed while the
        // address layer read it as a frame.
        assert.equal(classifyMessage([]).kind, WS_MESSAGE.MALFORMED);
        assert.equal(readMachineSnapshot([]).ok, false);
    });
});
