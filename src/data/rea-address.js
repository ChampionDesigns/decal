/**
 * THE ADDRESS LAYER — the one reader in Decal that speaks ReaPrime's current names.
 */

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
