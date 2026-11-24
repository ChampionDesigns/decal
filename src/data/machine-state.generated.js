// GENERATED FILE — DO NOT EDIT.
//
//   generator: scripts/generate-machine-state.js
//   source:    lib/src/models/device/machine.dart (ReaPrime)
//   commit:    31c9a9ba83ac2e5e4bea40dc36f7337448982919
//   sha256:    2932f00c231a34e0ca67ce18949dd7d02d47df350030c6ebe96c3dd603521057
//
// Regenerate with `node scripts/generate-machine-state.js`; `--check` fails on a stale
// artifact and test/machine-state-freshness.test.mjs runs that check.
//
// Hand-editing this file reintroduces exactly the defect it exists to prevent: the old
// skin's hand copy invented `READY: 'ready'` (not a state in either direction) and lost
// `schedIdle` (which is one), and both shipped as live contract bugs.

/** ReaPrime `enum MachineState` — every member, in declaration order. */
export const MACHINE_STATES = Object.freeze([
    'booting',
    'busy',
    'idle',
    'schedIdle',
    'sleeping',
    'heating',
    'preheating',
    'espresso',
    'hotWater',
    'flush',
    'steam',
    'steamRinse',
    'skipStep',
    'cleaning',
    'descaling',
    'calibration',
    'selfTest',
    'airPurge',
    'needsWater',
    'error',
    'fwUpgrade',
]);

/** The same members by symbolic name. Generated, so it cannot drift from the enum. */
export const MACHINE_STATE = Object.freeze({
    BOOTING: 'booting',
    BUSY: 'busy',
    IDLE: 'idle',
    SCHED_IDLE: 'schedIdle',
    SLEEPING: 'sleeping',
    HEATING: 'heating',
    PREHEATING: 'preheating',
    ESPRESSO: 'espresso',
    HOT_WATER: 'hotWater',
    FLUSH: 'flush',
    STEAM: 'steam',
    STEAM_RINSE: 'steamRinse',
    SKIP_STEP: 'skipStep',
    CLEANING: 'cleaning',
    DESCALING: 'descaling',
    CALIBRATION: 'calibration',
    SELF_TEST: 'selfTest',
    AIR_PURGE: 'airPurge',
    NEEDS_WATER: 'needsWater',
    ERROR: 'error',
    FW_UPGRADE: 'fwUpgrade',
});

/** ReaPrime `enum MachineSubstate` — every member, in declaration order. */
export const MACHINE_SUBSTATES = Object.freeze([
    'idle',
    'preparingForShot',
    'preinfusion',
    'pouring',
    'pouringDone',
    'cleaningStart',
    'cleaningGroup',
    'cleanSoaking',
    'cleaningSteam',
    'pausedSteam',
    'puffing',
    'refillStopped',
    'pumpZeroing',
    'errorNaN',
    'errorInf',
    'errorGeneric',
    'errorAcc',
    'errorTSensor',
    'errorPSensor',
    'errorWLevel',
    'errorDip',
    'errorAssertion',
    'errorUnsafe',
    'errorInvalidParam',
    'errorFlash',
    'errorOOM',
    'errorDeadline',
    'errorHiCurrent',
    'errorLoCurrent',
    'errorBootFill',
    'errorNoAC',
    'errorPumpZero',
    'errorPumpNeedsCalibration',
    'errorFrontSwitchOff',
    'errorPumpFault',
    'errorPumpSilent',
]);

/** The same members by symbolic name. Generated, so it cannot drift from the enum. */
export const MACHINE_SUBSTATE = Object.freeze({
    IDLE: 'idle',
    PREPARING_FOR_SHOT: 'preparingForShot',
    PREINFUSION: 'preinfusion',
    POURING: 'pouring',
    POURING_DONE: 'pouringDone',
    CLEANING_START: 'cleaningStart',
    CLEANING_GROUP: 'cleaningGroup',
    CLEAN_SOAKING: 'cleanSoaking',
    CLEANING_STEAM: 'cleaningSteam',
    PAUSED_STEAM: 'pausedSteam',
    PUFFING: 'puffing',
    REFILL_STOPPED: 'refillStopped',
    PUMP_ZEROING: 'pumpZeroing',
    ERROR_NA_N: 'errorNaN',
    ERROR_INF: 'errorInf',
    ERROR_GENERIC: 'errorGeneric',
    ERROR_ACC: 'errorAcc',
    ERROR_T_SENSOR: 'errorTSensor',
    ERROR_P_SENSOR: 'errorPSensor',
    ERROR_W_LEVEL: 'errorWLevel',
    ERROR_DIP: 'errorDip',
    ERROR_ASSERTION: 'errorAssertion',
    ERROR_UNSAFE: 'errorUnsafe',
    ERROR_INVALID_PARAM: 'errorInvalidParam',
    ERROR_FLASH: 'errorFlash',
    ERROR_OOM: 'errorOOM',
    ERROR_DEADLINE: 'errorDeadline',
    ERROR_HI_CURRENT: 'errorHiCurrent',
    ERROR_LO_CURRENT: 'errorLoCurrent',
    ERROR_BOOT_FILL: 'errorBootFill',
    ERROR_NO_AC: 'errorNoAC',
    ERROR_PUMP_ZERO: 'errorPumpZero',
    ERROR_PUMP_NEEDS_CALIBRATION: 'errorPumpNeedsCalibration',
    ERROR_FRONT_SWITCH_OFF: 'errorFrontSwitchOff',
    ERROR_PUMP_FAULT: 'errorPumpFault',
    ERROR_PUMP_SILENT: 'errorPumpSilent',
});

/** Provenance, asserted by the freshness test rather than trusted. */
export const MACHINE_STATE_SOURCE = Object.freeze({
    file: 'lib/src/models/device/machine.dart',
    commit: '31c9a9ba83ac2e5e4bea40dc36f7337448982919',
    sha256: '2932f00c231a34e0ca67ce18949dd7d02d47df350030c6ebe96c3dd603521057',
});
