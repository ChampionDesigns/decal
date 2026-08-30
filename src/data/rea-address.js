// THE ADDRESS LAYER — the one reader in Decal that speaks ReaPrime's current names.
//
// SCOPE Part 3 "Sequencing and size" item 1 / Part 6 "The order to port" gate 2:
//
//   "The address layer before any domain module (Gate 2, small): one reader speaking
//    ReaPrime's current names — the derived channels by key-presence, the estimator
//    sensor's own r1/r2/compliance/flags/collapse*, scale.weightFlow,
//    measurement.sensors[...] for stored shots — plus the generated MachineState enum.
//    Six modules are then a rename against this layer; ported first instead, the old
//    names get baked in again behind fallbacks that hide the miss."
//
// So this module is the whole reason Wave 0b runs second. Every consumer — detector,
// fused, shot-series, steam-chart, steam-mode, the live model, the stores, the charts —
// reads THROUGH here and never touches a raw frame key. There is exactly one file to
// change the day ReaPrime renames something again, and the rename announces itself on the
// first frame instead of hiding for months behind a plausible number.
//
// FOUR RULES, and they are the whole design:
//
//  1. A7 — NEVER PORT A FALLBACK PATH. There is no `?? computeR(...)`, no delta-plus-EMA
//     weight flow, no zero standing in for a measurement. An absent channel comes back as
//     an absence with a reason (reading.js), which renders as a gap or a dash.
//
//  2. KEY PRESENCE IS THE VALIDITY SIGNAL for the three derived channels and for every
//     estimator channel outside the always-present six. ReaPrime omits rather than nulls,
//     and says so in its own comment. The gate lives in ReaPrime; its constants appear
//     nowhere in this skin.
//
//  3. ABSENCE IS PERMANENT IN A STORED SHOT. A recorded measurement with no `sensors` key
//     was written before ReaPrime 2b047d02; `MachineSnapshot.fromJson` reads a fixed key
//     list with no unknown-key bag, so estimator data in that row was dropped the first
//     time ReaPrime read it and no later read can recover it. Render a gap. NEVER fall
//     through to the derived channel and present it as the same measurement — they are
//     computed from different flows (Q_puck vs Q_in) and diverge exactly where it matters.
//
//  4. NO MACHINE-TYPE BRANCH, ANYWHERE. There is deliberately no reader for
//     `machine.weight`, `machine.weightFlow` or `machine.milkTemperature`: 633f6f68
//     deleted all three ("MachineSnapshot stays pure machine telemetry"). Gravimetric
//     flow is `scale.weightFlow` for every machine — the Bengle's integrated scale is
//     exposed as a virtual scale — and milk temperature is the milk probe sensor's
//     `temperature`. The old skin's `isBengleMachine()` branch on the deleted key is
//     three of the 31 live contract bugs; it has no successor here.
//
// Shapes below were read from the handlers and models AS WRITTEN at ReaPrime 2b047d02
// (machine.dart, scale_controller.dart, shot_snapshot.dart, bengle_puck_estimator.dart,
// bengle_milk_probe.dart, steam_snapshot.dart, sensors_handler.dart). This module makes
// no request of its own — it is a pure reader over frames the transport hands it — so it
// declares no routes; the routes that carry these frames are Gate 3's contract entries.

import {
    SNAPSHOT_KEYS,
    SNAPSHOT_DERIVED_KEYS,
    SCALE_KEYS,
    WATER_LEVEL_KEYS,
    ESTIMATOR_CHANNELS,
    MILK_PROBE_CHANNELS,
    SENSOR_ID_SUFFIX,
    deadKeysPresent,
    sensorKindOf,
} from './rea-names.js';
import {
    ABSENCE,
    noReading,
    isNoReading,
    hasReading,
    readNumber,
    readValue,
    readChannels,
    allAbsent,
    hasKey,
    presentChannels,
} from './reading.js';
import { isMachineState, isMachineSubstate } from './machine-state.js';
import { isFrameObject, isErrorEnvelope, isStatusEnvelope } from './rea-ws-channels.js';

export { ABSENCE, isNoReading, hasReading, presentChannels };

function envelopeKindOf(payload) {
    if (isErrorEnvelope(payload)) return 'error';
    if (isStatusEnvelope(payload)) return 'status';
    return null;
}

/** The frame, or null when the payload is not a frame at all. Never a partial read. */
function frameOrNull(payload) {
    return isFrameObject(payload) && envelopeKindOf(payload) === null ? payload : null;
}

/** The ten numeric machine channels — everything in SNAPSHOT_KEYS but timestamp and state. */
const SNAPSHOT_NUMERIC_KEYS = Object.freeze(
    SNAPSHOT_KEYS.filter((key) => key !== 'timestamp' && key !== 'state'),
);

export function readMachineSnapshot(payload) {
    // An array, an error envelope, a status envelope: none of them is a snapshot, and none
    // of them may read as one with every channel quietly absent.
    const frame = frameOrNull(payload);
    const present = frame !== null;
    const stateBlock = present && frame.state && typeof frame.state === 'object' ? frame.state : null;
    const state = readValue(stateBlock, 'state', ABSENCE.NO_SOURCE);
    const substate = readValue(stateBlock, 'substate', ABSENCE.NO_SOURCE);

    return Object.freeze({
        ok: present,
        /** 'error' | 'status' when the payload was a SIGNAL rather than a frame. */
        envelope: envelopeKindOf(payload),
        timestamp: readValue(frame, 'timestamp'),
        state,
        substate,
        // An unrecognised name means the server knows a state this build's generated enum
        // does not. Visible, never smoothed over.
        stateKnown: isMachineState(state),
        substateKnown: isMachineSubstate(substate),
        ...readChannels(frame, SNAPSHOT_NUMERIC_KEYS),
        // Rule 2: written -> valid, omitted -> gated. No threshold appears here.
        ...readChannels(frame, SNAPSHOT_DERIVED_KEYS),
        deadKeys: Object.freeze(deadKeysPresent(frame)),
    });
}

/** Which of the three derived channels this frame actually carries. */
export function derivedChannelsPresent(snapshot) {
    return presentChannels(snapshot, SNAPSHOT_DERIVED_KEYS);
}

export function readWaterLevels(payload) {
    const frame = frameOrNull(payload);
    return Object.freeze({
        ok: frame !== null,
        envelope: envelopeKindOf(payload),
        ...readChannels(frame, WATER_LEVEL_KEYS),
    });
}

export function readScaleSnapshot(payload) {
    // THE STATUS ENVELOPE IS NOT A WEIGHT. `scale_handler.dart`'s `sendStatus` writes
    // `{"status":"disconnected"}` down the SAME socket as `WeightSnapshot.toJson`; read as a
    // snapshot it has no `weight` and no `weightFlow`, which is exactly a scale that is
    // present and reporting nothing. It is a signal, and the caller acts on it.
    const frame = frameOrNull(payload);
    return Object.freeze({
        ok: frame !== null,
        envelope: envelopeKindOf(payload),
        ...readChannels(frame, SCALE_KEYS, { textKeys: ['timestamp'] }),
    });
}

export const isSensorErrorEnvelope = isErrorEnvelope;

function readSensorFrame(payload, channels, { missingReason = ABSENCE.NO_SOURCE } = {}) {
    if (isErrorEnvelope(payload)) {
        return Object.freeze({
            ok: false,
            error: payload.error,
            channels: allAbsent(channels, ABSENCE.ERROR),
        });
    }
    const frame = frameOrNull(payload);
    if (frame === null) {
        return Object.freeze({ ok: false, error: null, channels: allAbsent(channels, missingReason) });
    }
    return Object.freeze({
        ok: true,
        error: null,
        channels: readChannels(frame, channels, { textKeys: ['timestamp'], missingReason }),
    });
}

export function readEstimatorFrame(frame, options) {
    return readSensorFrame(frame, ESTIMATOR_CHANNELS, options);
}

export function readMilkProbeFrame(frame, options) {
    return readSensorFrame(frame, MILK_PROBE_CHANNELS, options);
}

export function readStoredMeasurement(measurement, ids = {}) {
    const hasSensors = hasKey(measurement, 'sensors')
        && !!measurement.sensors && typeof measurement.sensors === 'object';
    const missingReason = hasSensors ? ABSENCE.ABSENT : ABSENCE.PERMANENT;
    const pick = (kind, given) => {
        if (!hasSensors) return null;
        if (given) return measurement.sensors[given] ?? null;
        for (const [id, frame] of Object.entries(measurement.sensors)) {
            if (sensorKindOf(id) === kind) return frame;
        }
        return null;
    };

    return Object.freeze({
        machine: readMachineSnapshot(measurement && measurement.machine),
        // `scale: null` is written for every sample of a shot pulled with no scale.
        scale: readScaleSnapshot(measurement && measurement.scale),
        volume: readNumber(measurement, 'volume'),
        sensorsRecorded: hasSensors,
        estimator: readEstimatorFrame(pick('puckEstimator', ids.estimatorId), { missingReason }),
        milkProbe: readMilkProbeFrame(pick('milkProbe', ids.milkProbeId), { missingReason }),
    });
}

export function storedShotSensors(record) {
    const measurements = record && Array.isArray(record.measurements) ? record.measurements : [];
    const ids = new Set();
    let sampled = 0;
    for (const measurement of measurements) {
        if (!hasKey(measurement, 'sensors')) continue;
        const sensors = measurement.sensors;
        if (!sensors || typeof sensors !== 'object') continue;
        sampled += 1;
        for (const id of Object.keys(sensors)) ids.add(id);
    }
    const idOf = (kind) => [...ids].find((id) => sensorKindOf(id) === kind) || null;
    const estimatorId = idOf('puckEstimator');
    const milkProbeId = idOf('milkProbe');
    return Object.freeze({
        /** True only if at least one measurement recorded a sensors map. */
        recorded: sampled > 0,
        samplesWithSensors: sampled,
        sampleCount: measurements.length,
        estimatorId,
        milkProbeId,
        estimator: !!estimatorId,
        milkProbe: !!milkProbeId,
        ids: Object.freeze([...ids]),
    });
}

export function readStoredSteamSnapshot(payload) {
    const snapshot = frameOrNull(payload);
    return Object.freeze({
        ok: snapshot !== null,
        machine: readMachineSnapshot(snapshot && snapshot.machine),
        milkTemperature: readNumber(snapshot, 'milkTemperature'),
    });
}

/** Sensor id suffixes, re-exported so callers never spell one out. */
export { SENSOR_ID_SUFFIX, sensorKindOf };
export { findSensorId } from './rea-names.js';
export { noReading, toPlot, toText, hasKey } from './reading.js';
