// The names ReaPrime uses TODAY, and the names it used to use.
//
// This file is DATA and it is the ONE place in Decal where a dead server key may be
// written down. Everything else reads through `rea-address.js`, which reads through this.
//
// WHY THIS FILE EXISTS (SCOPE Part 6, "The number that shapes the whole plan"): of the old
// skin's 4,188 lines of DOM-free logic only 8.7% copied unchanged, and the reason was not
// architecture — it was ADDRESSING. ReaPrime renamed or moved seven snapshot keys and six
// modules still read the old names, EACH BEHIND A LOCAL FALLBACK that silently absorbed
// the miss and produced a plausible number on a live bench frame. Seven silent
// misreadings shipped that way.
//
// A7, the single most important instruction in Part 6: NEVER PORT A FALLBACK PATH. Delete
// it, so absence becomes visible. Consequently nothing here maps a dead name to a live
// one at read time. `RENAMES` is a diagnostic and documentation table: it lets the reader
// say "this frame carries a name ReaPrime deleted" out loud, and it lets a test prove no
// module reads one. It is never consulted to PRODUCE a value.
//
// Every entry was re-read at ReaPrime commit 2b047d02 (the pinned reference worktree) on
// 17 Aug 2026, from the sources named on each row. Line numbers are deliberately absent:
// re-anchor by symbol.

/**
 * `MachineSnapshot.toJson` (machine.dart, `class MachineSnapshot`) — the twelve keys that
 * are ALWAYS emitted, in the order the server writes them.
 *
 * `state` is an object: `{state, substate}`, both enum NAMES (see machine-state.js).
 * `timestamp` is an ISO-8601 string. `profileFrame` and `steamTemperature` are ints.
 *
 * Carried by `/ws/v1/machine/snapshot` and by `measurements[].machine` in a stored shot.
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

/**
 * The three DERIVED hydraulic channels — `MachineSnapshot`'s `*Derived` getters.
 *
 * These are the key-presence channels. `toJson` writes each only when its getter is
 * non-null, and the getter is null below the server's own gate; the server's comment says
 * in as many words that "consumers can rely on key presence as the validity signal".
 * So `Object.hasOwn(frame, 'puckResistanceDerived')` IS the whole validity test.
 *
 * NEVER re-implement the gate and never copy its constants — see `reading.js`.
 *
 * Each has a MEASURED counterpart on the puck-estimator sensor computed from a different
 * flow (Q_puck rather than reported group flow Q_in), so the two agree in steady state and
 * diverge during compliance transients, and they go absent at DIFFERENT times. ReaPrime's
 * own comment: prefer the measured value when the machine offers it, and expect a switch
 * mid-shot to look like a glitch. That CHOICE is B6's, made at shot start and held
 * (`duplicated-channels-b6`), not made per sample here.
 */
export const SNAPSHOT_DERIVED_KEYS = Object.freeze([
    'puckResistanceDerived',
    'loadImpedanceDerived',
    'hydraulicPowerDerived',
]);

/**
 * `WeightSnapshot.toJson` (scale_controller.dart) — `/ws/v1/scale/snapshot`, and
 * `measurements[].scale` in a stored shot.
 *
 * THIS IS WHERE GRAVIMETRIC FLOW ARRIVES, for every machine. The Bengle's integrated
 * scale is exposed as a virtual scale, so Bengle and DE1 read identically and there is
 * exactly one gravimetric channel, already server-smoothed. There is no machine-type
 * branch anywhere in this layer.
 *
 * NOTE the shape difference from the machine snapshot: `toJson` writes `battery` and
 * `timerValue` UNCONDITIONALLY, so on the scale key presence is NOT the validity signal —
 * a null value is. `timerValue` is milliseconds (an int) or null.
 *
 * `controlWeightFlow` and `connectionGeneration` exist on the Dart object but are NOT
 * serialised; they are unreachable from the skin and are not named here.
 */
/**
 * The water-level frame's two channels, in MILLIMETRES.
 *
 * `/ws/v1/machine/waterLevels` carries `{currentLevel, refillLevel}` and the contract
 * table records what that means: mm -> mL is skin-side, because the 68-entry tank table
 * has no ReaPrime counterpart. Slate ports that table from the TCL skin and offers mL as
 * a SETTING, defaulting to mm; Decal reads and shows the millimetres the machine sends
 * and leaves the conversion to whoever adds the setting.
 */
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

/**
 * The puck-estimator sensor's channel list, in `SensorInfo.dataChannels` order
 * (bengle_puck_estimator.dart). Stream: `/ws/v1/sensors/<id>/snapshot`; stored shots carry
 * the latest frame per sample under `measurements[].sensors[<id>]`.
 */
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

/**
 * The six estimator channels `encodeSample` always writes. Every OTHER channel is omitted
 * when the firmware reports its wire sentinel — "an absent key means not observed, which a
 * zero would misrepresent as a real measurement of zero" (the class doc, verbatim intent).
 *
 * So on this sensor, as on the derived channels, key presence is the validity signal.
 */
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
 * PRODUCES A NEW ID — which is why discovery re-runs on socket close (Gate 3) and why
 * nothing here caches an id.
 */
export const SENSOR_ID_SUFFIX = Object.freeze({
    puckEstimator: '-puckestimator',
    milkProbe: '-milkprobe',
});

/**
 * The rename table. LEFT is what the old skin reads; RIGHT is the address today.
 *
 * `scope` says WHERE the left-hand name is dead:
 *   'global'  — the name is dead everywhere; seeing it anywhere is a defect.
 *   'machine' — dead on the MACHINE snapshot only. `weightFlow` is alive on the scale and
 *               `milkTemperature` is alive on a stored `SteamSnapshot`, so a text search
 *               for these two proves nothing on its own.
 *
 * The first seven rows are Part 6's seven-rename table. The rest are the same commit's
 * other casualties, found in recorded legacy shot rows; they are listed because a reader
 * that names only seven leaves the others to be rediscovered one silent misreading at a
 * time.
 */
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

/**
 * Names that are dead EVERYWHERE. A source file outside this one containing any of these
 * is a defect, and `test/rea-dead-names.test.mjs` is the executing check.
 */
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

/**
 * The dead names present on a frame — a DIAGNOSTIC, never a value source.
 *
 * A non-empty result means the server is older than the pinned commit (or something
 * upstream regressed). At 2b047d02 `MachineSnapshot.fromJson` reads a fixed key list with
 * no unknown-key bag and `toJson` re-emits only that list, so these names cannot reach the
 * skin from a current server even out of a legacy database row: they are dropped the first
 * time ReaPrime reads it.
 *
 * @param {object|null|undefined} frame  a machine-snapshot-shaped object
 * @returns {string[]} dead names found, in `RENAMES` order
 */
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

/**
 * Find one sensor id in a `GET /api/v1/sensors` listing — `[{id, info}, …]`
 * (sensors_handler.dart). Also accepts a bare array of ids.
 *
 * @param {Array|null} listing
 * @param {'puckEstimator'|'milkProbe'} kind
 * @returns {string|null}
 */
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
