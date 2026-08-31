/**
 * The names ReaPrime uses TODAY, and the names it used to use.
 */

export const SNAPSHOT_KEYS = Object.freeze([
    'timestamp',
    'state',
    'flow',
    'pressure',
    'targetFlow',
    'targetPressure',
    'mixTemperature',
    'groupTemperature',
    'targetMixTemperature',
    'targetGroupTemperature',
    'profileFrame',
    'steamTemperature',
]);

export const SNAPSHOT_DERIVED_KEYS = Object.freeze([
    'puckResistanceDerived',
    'loadImpedanceDerived',
    'hydraulicPowerDerived',
]);

export const WATER_LEVEL_KEYS = Object.freeze([
    'currentLevel',
    'refillLevel',
]);

export const SCALE_KEYS = Object.freeze([
    'timestamp',
    'weight',
    'weightFlow',
    'battery',
    'timerValue',
]);

export const ESTIMATOR_CHANNELS = Object.freeze([
    'timestamp',
    'rev',
    'flags',
    'r1',
    'r2',
    'compliance',
    'confidence',
    'lag',
    'lagConfidence',
    'sigmaQ',
    'absorbedVolume',
    'lastPauseTau',
    'collapseEventCount',
    'collapseLastEventT',
    'collapseLastEventMagnitude',
    'collapseLastEventConcavity',
    'hydraulicPowerMeasured',
]);

export const ESTIMATOR_ALWAYS_PRESENT_CHANNELS = Object.freeze([
    'timestamp',
    'rev',
    'flags',
    'confidence',
    'lagConfidence',
    'sigmaQ',
]);

/** `hydraulicPowerMeasured` needs BengleEstSample rev >= 3; absent on older firmware. */
export const ESTIMATOR_MEASURED_POWER_MIN_REV = 3;

/** The milk probe's channels (bengle_milk_probe.dart). `temperature` is °C. */
export const MILK_PROBE_CHANNELS = Object.freeze(['timestamp', 'temperature']);

/**
 * Sensor deviceId suffixes. Both ids are `${machineDeviceId}-<suffix>`, so A MACHINE SWAP
 * PRODUCES A NEW ID — which is why discovery re-runs on socket close and why
 * nothing here caches an id.
 */
export const SENSOR_ID_SUFFIX = Object.freeze({
    puckEstimator: '-puckestimator',
    milkProbe: '-milkprobe',
});

export const RENAMES = Object.freeze([
    { dead: 'puckResistance', live: 'puckResistanceDerived', on: 'machine', scope: 'global', source: 'machine.dart (MachineSnapshot.puckResistanceDerived)', sevenRow: 1 },
    { dead: 'loadImpedance', live: 'loadImpedanceDerived', on: 'machine', scope: 'global', source: 'machine.dart (MachineSnapshot.loadImpedanceDerived)', sevenRow: 2 },
    { dead: 'hydraulicPower', live: 'hydraulicPowerDerived', on: 'machine', scope: 'global', source: 'machine.dart (MachineSnapshot.hydraulicPowerDerived)', sevenRow: 3 },
    { dead: 'fusedR1', live: 'r1', on: 'estimator', scope: 'global', source: 'bengle_puck_estimator.dart (dataChannels)', sevenRow: 4 },
    { dead: 'fusedR2', live: 'r2', on: 'estimator', scope: 'global', source: 'bengle_puck_estimator.dart (dataChannels)', sevenRow: 4 },
    { dead: 'fusedC', live: 'compliance', on: 'estimator', scope: 'global', source: 'bengle_puck_estimator.dart (dataChannels)', sevenRow: 5 },
    { dead: 'estFlags', live: 'flags', on: 'estimator', scope: 'global', source: 'bengle_puck_estimator.dart (dataChannels)', sevenRow: 5 },
    { dead: 'detEventCount', live: 'collapseEventCount', on: 'estimator', scope: 'global', source: 'bengle_puck_estimator.dart (encodeSample)', sevenRow: 6 },
    { dead: 'detLastEventT', live: 'collapseLastEventT', on: 'estimator', scope: 'global', source: 'bengle_puck_estimator.dart (encodeSample)', sevenRow: 6 },
    { dead: 'detLastEventMag', live: 'collapseLastEventMagnitude', on: 'estimator', scope: 'global', source: 'bengle_puck_estimator.dart (encodeSample)', sevenRow: 6 },
    { dead: 'detLastEventConc', live: 'collapseLastEventConcavity', on: 'estimator', scope: 'global', source: 'bengle_puck_estimator.dart (encodeSample)', sevenRow: 6 },
    { dead: 'weightFlow', live: 'weightFlow', on: 'scale', scope: 'machine', source: 'scale_controller.dart (WeightSnapshot.toJson); removed from MachineSnapshot in 633f6f68', sevenRow: 7 },
    { dead: 'weight', live: 'weight', on: 'scale', scope: 'machine', source: 'scale_controller.dart (WeightSnapshot.toJson); removed from MachineSnapshot in 633f6f68', sevenRow: null },
    { dead: 'milkTemperature', live: 'temperature', on: 'milkProbe', scope: 'machine', source: 'bengle_milk_probe.dart; removed from MachineSnapshot in 633f6f68 (still a stored SteamSnapshot field)', sevenRow: null },
    { dead: 'fusedConf', live: 'confidence', on: 'estimator', scope: 'global', source: 'bengle_puck_estimator.dart (encodeSample)', sevenRow: null },
    { dead: 'estLag', live: 'lag', on: 'estimator', scope: 'global', source: 'bengle_puck_estimator.dart (encodeSample)', sevenRow: null },
    { dead: 'vAbs', live: 'absorbedVolume', on: 'estimator', scope: 'global', source: 'bengle_puck_estimator.dart (encodeSample)', sevenRow: null },
]);

/** The seven of Part 6's table, for the test that pins them. */
export const SEVEN_RENAMES = Object.freeze(RENAMES.filter((r) => r.sevenRow !== null));

/** Part 6's table has SEVEN ROWS covering twelve names — `fusedR1`/`fusedR2` share a row,
 *  `fusedC`/`estFlags` share one, and all four `detEvent*` share one. */
export const SEVEN_RENAME_ROWS = 7;

export const DEAD_NAMES_GLOBAL = Object.freeze(
    RENAMES.filter((r) => r.scope === 'global').map((r) => r.dead),
);

/**
 * Names that are dead ON THE MACHINE SNAPSHOT. Used only to REPORT that a frame carries
 * one — never to read a value out of it.
 */
export const DEAD_MACHINE_SNAPSHOT_KEYS = Object.freeze([
    ...DEAD_NAMES_GLOBAL,
    ...RENAMES.filter((r) => r.scope === 'machine').map((r) => r.dead),
]);

export function deadKeysPresent(frame) {
    if (!frame || typeof frame !== 'object') return [];
    return DEAD_MACHINE_SNAPSHOT_KEYS.filter((key) => Object.hasOwn(frame, key));
}

/** @param {string} id @returns {'puckEstimator'|'milkProbe'|null} */
export function sensorKindOf(id) {
    if (typeof id !== 'string') return null;
    for (const [kind, suffix] of Object.entries(SENSOR_ID_SUFFIX)) {
        if (id.endsWith(suffix)) return kind;
    }
    return null;
}

export function findSensorId(listing, kind) {
    if (!Array.isArray(listing)) return null;
    const suffix = SENSOR_ID_SUFFIX[kind];
    if (!suffix) return null;
    for (const entry of listing) {
        const id = typeof entry === 'string' ? entry : entry && entry.id;
        if (typeof id === 'string' && id.endsWith(suffix)) return id;
    }
    return null;
}
