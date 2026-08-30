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

/**
 * WHAT A FRAME IS, asked once.
 *
 * These three questions have exactly one implementation in the skin and it lives in
 * `rea-ws-channels.js`, beside the classifier that routes a socket message. This layer
 * imports it rather than restating it, because when the two were stated separately they
 * DISAGREED: the classifier called a JSON array MALFORMED while the readers below read it
 * as ok — every channel "absent" — which is indistinguishable from a machine, a scale or a
 * sensor that is on the wire and reporting nothing. An envelope read as a frame is the same
 * defect at one remove: `{"status":"disconnected"}` on the scale socket has no `weight` and
 * no `weightFlow`.
 *
 * @returns {'error'|'status'|null} the envelope this payload is, if it is one
 */
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

/**
 * Read one `/ws/v1/machine/snapshot` frame, or one stored `measurements[].machine`.
 *
 * The two are the same shape by construction: `MachineSnapshot.toJson` serves both, and
 * the three derived channels are recomputed ON READ from the stored raw pressure/flow, so
 * a shot recorded years ago gains them with no migration. They are therefore read the same
 * way in both — by key presence.
 *
 * `deadKeys` is a DIAGNOSTIC and never a value source: a non-empty list means the server
 * is older than the pinned commit. Log it; do not read it.
 *
 * @param {object|null|undefined} frame
 */
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

/**
 * Read one `/ws/v1/scale/snapshot` frame, or one stored `measurements[].scale`.
 *
 * THIS IS THE ONE GRAVIMETRIC SOURCE — `weightFlow` here, server-smoothed, identical on
 * Bengle and DE1. A stored shot recorded with no scale attached serialises `scale: null`,
 * which is a NO_SOURCE absence for the whole shot: a gap, not a zero.
 *
 * Unlike the machine snapshot, `battery` and `timerValue` are written unconditionally, so
 * on this frame a NULL value — not an absent key — is the absence signal. `timerValue` is
 * milliseconds.
 *
 * @param {object|null|undefined} frame
 */
/**
 * The tank's own frame: `{currentLevel, refillLevel}`, in MILLIMETRES.
 *
 * Ben, 23 Aug 2026: "Tank just shows as -, no water level being shown." The tile was
 * built dashed on purpose and its own note named the gap exactly — "the water level is on
 * /ws/v1/machine/waterLevels, which rea-ws-channels.js names and no feed in
 * live-stores.js attaches. Attaching it is a feed, a reader, a budget row and a recorded
 * frame the mock does not hold — a build, not a polish". This is that build.
 *
 * A LEVEL AND A THRESHOLD, and the second is not decoration: a tank running low is a
 * level-vs-refillLevel fact, and it is independent of the DE1's own `needsWater` state,
 * which per the state machine only fires as a hard block once the machine actively tries
 * to heat or pull. A tablet watching the level can say so while the machine is idle.
 */
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

/**
 * Is this sensor payload ReaPrime's error envelope rather than a frame?
 *
 * `sensors_handler.dart` answers an unknown sensor id with `{"error":"not found"}` and
 * closes the socket. The old skin mapped that envelope to an empty channel set, so a
 * machine swap — which mints a new sensor id — silently emptied every estimator channel
 * and every consumer fell back to the derived one with nothing surfaced. An error envelope
 * is a SIGNAL, not a frame, and the caller acts on it (Gate 3: re-discover on close).
 */
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

/**
 * Read one puck-estimator frame — live from `/ws/v1/sensors/<id>/snapshot`, or the stored
 * `measurements[].sensors['<machine>-puckestimator']` map.
 *
 * Channels keep the FIRMWARE's names, which are ReaPrime's names: `r1`, `r2`,
 * `compliance`, `flags`, `confidence`, `lag`, `lagConfidence`, `sigmaQ`, `absorbedVolume`,
 * `lastPauseTau`, the four `collapse*`, and `hydraulicPowerMeasured` on firmware rev >= 3.
 * The old skin's `fusedR1` / `fusedR2` / `fusedC` / `estFlags` / `detEvent*` are dead and
 * are not translated back here — translating them back is precisely the shim this layer
 * replaces.
 *
 * Everything but the always-present six is omitted when the firmware has not observed it,
 * so key presence is the validity signal again. An omitted `r2` is "not observed", which a
 * zero would misrepresent as a real measurement of zero resistance.
 *
 * @param {object|null|undefined} frame
 * @param {{missingReason?: string}} [options]
 */
export function readEstimatorFrame(frame, options) {
    return readSensorFrame(frame, ESTIMATOR_CHANNELS, options);
}

/**
 * Read one milk-probe frame: `temperature`, in °C.
 *
 * This is the LIVE milk read. A stored steam session is a different read entirely — see
 * `readStoredSteamSnapshot` — and that split is a real branch until ReaPrime unifies them.
 *
 * @param {object|null|undefined} frame
 * @param {{missingReason?: string}} [options]
 */
export function readMilkProbeFrame(frame, options) {
    return readSensorFrame(frame, MILK_PROBE_CHANNELS, options);
}

/**
 * Read one stored `measurements[]` entry.
 *
 * RULE 3 LIVES HERE. If the entry has no `sensors` key, every sensor channel comes back as
 * a PERMANENT absence — unavailable for this shot, forever — rather than as a normal
 * "not yet" absence, so a renderer can tell "the estimator has nothing to say right now"
 * from "this shot predates the estimator being recorded at all". Neither one falls through
 * to `puckResistanceDerived`.
 *
 * @param {object|null|undefined} measurement
 * @param {{estimatorId?: string|null, milkProbeId?: string|null}} [ids]
 *        Sensor ids for this shot, from `storedShotSensors`. Omit to resolve by suffix.
 */
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

/**
 * What sensor data a STORED SHOT carries, decided once for the whole shot.
 *
 * A shot in which no measurement ever carried a `sensors` key has none and never will:
 * that is the permanent-absence rule at shot scope, and it is the answer a history screen
 * needs before it draws anything (show a gap and say why, rather than draw a derived
 * channel in the estimator's colour).
 *
 * Cheap on purpose — key lookups only, no per-sample parsing. The single parse of the
 * measurements array is Gate 6's job, not this layer's.
 *
 * @param {{measurements?: Array}|null|undefined} record  a `GET /api/v1/shots/<id>` body
 */
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

/**
 * Read a stored steam session sample.
 *
 * THE ONE PLACE `milkTemperature` IS A LIVE NAME. `SteamSnapshot` has no `sensors` map, so
 * a stored steam session persists a bespoke `milkTemperature` double while the live trace
 * comes off the milk-probe sensor's `temperature`. One trace, two reads, until ReaPrime
 * unifies them — the reads are separate here so the day it unifies, one of them is deleted
 * rather than quietly aliased.
 *
 * The field is written unconditionally and may be null, so null is the absence signal.
 * Expect null often: ReaPrime's steam sequencer picks its temperature source by map
 * insertion order and can pick the puck estimator, which has no `temperature` channel at
 * all — a ReaPrime-side contract bug on the upstream list, NOT something this layer papers
 * over.
 *
 * @param {object|null|undefined} snapshot
 */
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
