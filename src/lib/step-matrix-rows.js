/**
 * THE STEP MATRIX'S ROW MODEL, and nothing else.
 */

import {
    MODE_TABLE,
    PUMP_MODE_LABEL,
    getModeConfig,
    pumpChipsFor,
    transitionSegments,
} from './profile-modes.js';

export const CELL_KINDS = Object.freeze(['head', 'stepper', 'locked', 'bank', 'exits', 'actions']);

export const PROBE_OPTIONS = Object.freeze([
    Object.freeze({ value: 'coffee', label: 'Coffee' }),
    Object.freeze({ value: 'water', label: 'Water' }),
]);

export const HELD_TARGET_TEXT = 'Holds previous target';

/** The per-cell accessible-name template (D2, E14). `{label}` is already translated. */
export const CELL_NAME_KEY = '{label}, step {n}';

/** The step-name field's accessible-name template (D2, E7). */
export const STEP_NAME_KEY = 'Step {n} name';

/** The head cell's ordinal line. An existing key whose own note names this screen. */
export const STEP_ORDINAL_KEY = 'Step {n} of {total}';

export const STEP_MATRIX_ROWS = Object.freeze([
    Object.freeze({
        key: 'head',
        label: 'Step',
        kind: 'head',
        field: 'name',
        rangeField: null,
        groupEnd: true,
    }),
    Object.freeze({
        key: 'temperature',
        label: 'Temperature',
        kind: 'stepper',
        field: 'temperature',
        rangeField: 'stepTemperature',
        groupEnd: false,
    }),
    Object.freeze({
        key: 'probe',
        label: 'Probe',
        kind: 'bank',
        field: 'sensor',
        rangeField: null,
        groupEnd: true,
    }),
    Object.freeze({
        key: 'pump',
        label: 'Pump',
        kind: 'bank',
        field: 'pump',
        rangeField: null,
        groupEnd: false,
    }),
    Object.freeze({
        key: 'transition',
        label: 'Transition',
        kind: 'bank',
        field: 'transition',
        rangeField: null,
        groupEnd: false,
    }),
    Object.freeze({
        key: 'target',
        label: 'Target',
        kind: 'target',
        field: null,
        rangeField: 'stepTarget',
        groupEnd: false,
    }),
    Object.freeze({
        key: 'limiter',
        label: 'Limiter',
        kind: 'stepper',
        field: 'limiter',
        rangeField: 'stepLimiter',
        groupEnd: true,
        zeroLabel: 'OFF',
    }),
    Object.freeze({
        key: 'duration',
        label: 'Max Duration',
        kind: 'stepper',
        field: 'seconds',
        rangeField: 'stepSeconds',
        groupEnd: false,
        unit: 's',
    }),
    Object.freeze({
        key: 'exits',
        label: 'Exit when',
        kind: 'exits',
        field: null,
        rangeField: null,
        groupEnd: false,
    }),
    Object.freeze({
        key: 'actions',
        label: 'Step actions',
        railHidden: true,
        kind: 'actions',
        field: null,
        rangeField: null,
        groupEnd: false,
    }),
]);

/** The row ids, in order. */
export const STEP_MATRIX_ROW_KEYS = Object.freeze(STEP_MATRIX_ROWS.map((row) => row.key));

const ROW_BY_KEY = new Map(STEP_MATRIX_ROWS.map((row) => [row.key, row]));

/**
 * One row by id. THERE IS NO FALLBACK (A7): an unknown row is a programming error, and
 * a module that answered with a plausible row would put the caller's typo on screen.
 */
export function matrixRow(key) {
    const row = ROW_BY_KEY.get(key);
    if (!row) {
        throw new Error(
            `step-matrix-rows: "${key}" is not a matrix row (${STEP_MATRIX_ROW_KEYS.join(', ')}).`,
        );
    }
    return row;
}

export function isHeldTarget(step) {
    return Boolean(step) && step.transition === 'hold';
}

export function cellKindFor(row, step) {
    if (row.kind !== 'target') return row.kind;
    return isHeldTarget(step) ? 'locked' : 'stepper';
}

export function fieldFor(row, step) {
    if (row.kind !== 'target') return row.field;
    const pump = step && step.pump;
    if (!pump) return null;
    return getModeConfig(pump).targetKey;
}

/** The value this cell shows, read off the step. Never a default that stands in. */
export function readValue(row, step) {
    if (!step) return null;
    if (row.key === 'limiter') {
        const held = step.limiter;
        return held && typeof held === 'object' ? held.value ?? null : null;
    }
    const field = fieldFor(row, step);
    if (!field) return null;
    const value = step[field];
    return value === undefined ? null : value;
}

/** The quantity-and-role names a matrix cell can carry. `null` = the plain ink. */
export const MATRIX_CHANNELS = Object.freeze([
    'temperature', 'flow', 'pressure', 'flow-limit', 'pressure-limit',
]);

/** `limiterRange` -> the quantity the limiter caps. The table's own names, read. */
const LIMIT_CHANNEL = Object.freeze({
    stepPressureLimit: 'pressure-limit',
    stepFlowLimit: 'flow-limit',
    powerPressureCap: 'pressure-limit',
    leverFlowCap: 'flow-limit',
});

/** `targetKey` -> the quantity the target commands. `power` is absent on purpose. */
const TARGET_CHANNEL = Object.freeze({ flow: 'flow', pressure: 'pressure' });

/**
 * The channel this cell's number speaks for, or `null` for the plain ink.
 * A step whose pump the table does not know answers `null` rather than guessing (A7).
 */
export function matrixChannel(row, step) {
    if (!row) return null;
    if (row.key === 'temperature') return 'temperature';
    const pump = step && step.pump;
    if (!pump || !(pump in MODE_TABLE)) return null;
    const cfg = MODE_TABLE[pump];
    if (row.key === 'target') return TARGET_CHANNEL[cfg.targetKey] ?? null;
    if (row.key === 'limiter') return LIMIT_CHANNEL[cfg.limiterRange] ?? null;
    return null;
}

export function bankOptionsFor(row, step, index, { pumpModesOffered = false, holdOffered = false } = {}) {
    if (row.key === 'probe') {
        return {
            options: PROBE_OPTIONS.map((option) => ({ ...option, disabled: false })),
            value: (step && step.sensor) || null,
            readOnly: false,
        };
    }
    if (row.key === 'pump') {
        return {
            options: pumpChipsFor(step, pumpModesOffered)
                .map((pump) => ({ value: pump, label: PUMP_MODE_LABEL[pump], disabled: false })),
            value: (step && step.pump) || null,
            readOnly: false,
        };
    }
    if (row.key === 'transition') {
        const segments = transitionSegments(step, index, holdOffered);
        return {
            options: segments.options.map((option) => ({
                value: option.value,
                label: option.label,
                disabled: Boolean(option.disabled),
            })),
            value: segments.active,
            readOnly: segments.readOnly,
        };
    }
    throw new Error(`step-matrix-rows: "${row.key}" is not a bank row`);
}

export function enumerateMatrixCells(steps) {
    const list = Array.isArray(steps) ? steps : [];
    const out = [];
    for (const row of STEP_MATRIX_ROWS) {
        list.forEach((step, index) => {
            out.push({
                row: row.key,
                index,
                kind: cellKindFor(row, step),
                field: fieldFor(row, step),
                rangeField: row.rangeField,
            });
        });
    }
    return out;
}
