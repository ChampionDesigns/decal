/**
 * WHICH control the Live rail's tracks carry, and WHAT the foot band's phase table says.
 */

import { MACHINE_STATE } from '../data/machine-state.js';
import { hasLimit, step as stepLimit, clamp as clampLimit, bandHint } from './machine-limits.js';
import { machineFallbackFor } from './settings-defaults.js';
import {
    TEMP_UNIT, displayRange, toDisplayTemp, fromDisplayTemp, decimalsForStep, unitSymbol,
} from './temperature.js';

/* ═══════════════════════════════════════════════════════════════ the four modes */

export const LIVE_MODES = Object.freeze([
    Object.freeze({ id: MACHINE_STATE.ESPRESSO, label: 'Espresso' }),
    Object.freeze({ id: MACHINE_STATE.STEAM, label: 'Steam' }),
    Object.freeze({ id: MACHINE_STATE.HOT_WATER, label: 'Hot water' }),
    Object.freeze({ id: MACHINE_STATE.FLUSH, label: 'Flush' }),
]);

export const DEFAULT_MODE = MACHINE_STATE.ESPRESSO;

const MACHINE_MODES = new Set(LIVE_MODES.map((mode) => mode.id));

export const STEAM_STOP = Object.freeze({ OFF: 'off', TIME: 'time', MILK: 'milk' });
/** Hot water's two stop conditions — both arm `hotWaterVolume`. */
export const WATER_STOP = Object.freeze({ VOLUME: 'volume', WEIGHT: 'weight' });

export function steamStopFrom(targets) {
    const held = targets && typeof targets === 'object' ? targets : null;
    let known = false;
    for (const [field, mode] of [['milkStopTemp', STEAM_STOP.MILK], ['steamDuration', STEAM_STOP.TIME]]) {
        const value = held ? held[field] : undefined;
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        known = true;
        if (value > 0) return mode;
    }
    return known ? STEAM_STOP.OFF : null;
}

export function waterStopFrom(stopAtWeight) {
    if (stopAtWeight === true) return WATER_STOP.WEIGHT;
    if (stopAtWeight === false) return WATER_STOP.VOLUME;
    return null;
}

export function armValueFor(field, held, limits) {
    const now = Number(held);
    if (Number.isFinite(now) && now > 0) return now;
    const fallback = Number(machineFallbackFor(field));
    if (Number.isFinite(fallback) && fallback > 0) return fallback;
    const floor = hasLimit(limits, field) ? Number(limits[field].min) : Number.NaN;
    return Number.isFinite(floor) && floor > 0 ? floor : 0;
}

/** The row kinds a rail track can hold. The screen switches on these, never on a label. */
export const RAIL_ROW = Object.freeze({
    TARGET: 'target',
    STOP_MODE: 'stopMode',
    PRESETS: 'presets',
});

export function isRunning(machineState) {
    return MACHINE_MODES.has(machineState);
}

/** The tone `<ui-status-chip>` draws for each machine state. */
const MACHINE_TONE = Object.freeze({
    [MACHINE_STATE.IDLE]: 'ok',
    [MACHINE_STATE.SCHED_IDLE]: 'ok',
    [MACHINE_STATE.HEATING]: 'active',
    [MACHINE_STATE.PREHEATING]: 'active',
    [MACHINE_STATE.ESPRESSO]: 'active',
    [MACHINE_STATE.HOT_WATER]: 'active',
    [MACHINE_STATE.FLUSH]: 'active',
    [MACHINE_STATE.STEAM]: 'active',
    [MACHINE_STATE.STEAM_RINSE]: 'active',
    [MACHINE_STATE.AIR_PURGE]: 'active',
    [MACHINE_STATE.CLEANING]: 'active',
    [MACHINE_STATE.DESCALING]: 'active',
    [MACHINE_STATE.CALIBRATION]: 'active',
    [MACHINE_STATE.SELF_TEST]: 'active',
    [MACHINE_STATE.FW_UPGRADE]: 'active',
    [MACHINE_STATE.SKIP_STEP]: 'active',
    [MACHINE_STATE.ERROR]: 'error',
    [MACHINE_STATE.NEEDS_WATER]: 'attention',
    [MACHINE_STATE.BUSY]: 'busy',
    [MACHINE_STATE.BOOTING]: 'busy',
    [MACHINE_STATE.SLEEPING]: 'asleep',
});

/** The tone for a state, or null for anything that is not a machine state. */
export function machineTone(machineState) {
    return MACHINE_TONE[machineState] ?? null;
}

export function modeFor(machineState, chosen = DEFAULT_MODE) {
    if (MACHINE_MODES.has(machineState)) return machineState;
    return MACHINE_MODES.has(chosen) ? chosen : DEFAULT_MODE;
}

/** True while the mode is the machine's to decide — the picker is inert then. */
export function modeIsMachines(machineState) {
    return MACHINE_MODES.has(machineState);
}

/* ════════════════════════════════════════ running the machine */

export const MACHINE_KEYS = Object.freeze([
    Object.freeze({ id: 'espresso', state: MACHINE_STATE.ESPRESSO, label: 'Espresso' }),
    Object.freeze({ id: 'hot-water', state: MACHINE_STATE.HOT_WATER, label: 'Hot Water' }),
    Object.freeze({ id: 'steam', state: MACHINE_STATE.STEAM, label: 'Steam' }),
    Object.freeze({ id: 'flush', state: MACHINE_STATE.FLUSH, label: 'Flush' }),
]);

/** The abort, which is a state request like any other and is drawn as its own control. */
export const STOP_STATE = MACHINE_STATE.IDLE;

export const DEFAULT_KEY_BINDINGS = Object.freeze({
    e: MACHINE_STATE.ESPRESSO,
    w: MACHINE_STATE.HOT_WATER,
    s: MACHINE_STATE.STEAM,
    f: MACHINE_STATE.FLUSH,
    ' ': MACHINE_STATE.IDLE,
    p: MACHINE_STATE.SLEEPING,
});

/**
 * The state a key asks for, or null.
 *
 * NULL FOR EVERY KEY THAT IS NOT BOUND, so a caller has one comparison and never a
 * `in`-check against an object it did not build.
 */
export function stateForKey(key, bindings = DEFAULT_KEY_BINDINGS) {
    if (typeof key !== 'string' || key === '') return null;
    const found = bindings[key === ' ' ? key : key.toLowerCase()];
    return typeof found === 'string' ? found : null;
}

export function machineKeyGate(machineState) {
    const running = isRunning(machineState);
    return Object.freeze({ actions: !running, stop: running });
}

/* ═══════════════════════════════════════════════════════ the stop-mode toggles */

/** Every state the caption may REPORT. Anything else is "not answered yet", never a mode. */
const STEAM_STATES = new Set([STEAM_STOP.OFF, STEAM_STOP.TIME, STEAM_STOP.MILK]);
const WATER_STATES = new Set([WATER_STOP.VOLUME, WATER_STOP.WEIGHT]);

const STEAM_NEXT = Object.freeze({
    [STEAM_STOP.OFF]: STEAM_STOP.TIME,
    [STEAM_STOP.TIME]: STEAM_STOP.MILK,
    [STEAM_STOP.MILK]: STEAM_STOP.TIME,
});
const WATER_NEXT = Object.freeze({
    [WATER_STOP.VOLUME]: WATER_STOP.WEIGHT,
    [WATER_STOP.WEIGHT]: WATER_STOP.VOLUME,
});

export function stopModeRow(mode, { steamStop, waterStop, offers = {} } = {}) {
    if (mode === MACHINE_STATE.STEAM) {
        const value = STEAM_STATES.has(steamStop) ? steamStop : null;
        return Object.freeze({
            kind: RAIL_ROW.STOP_MODE,
            id: 'steam-stop',
            label: 'Steam stops on',
            value,
            next: STEAM_NEXT[value] ?? null,
            items: Object.freeze([
                Object.freeze({ value: STEAM_STOP.TIME, label: 'Time' }),
                Object.freeze({
                    value: STEAM_STOP.MILK,
                    label: 'Milk',
                    disabled: offers.milkProbe !== true,
                    unavailable: offers.milkProbe !== true ? 'milkProbe' : null,
                }),
            ]),
        });
    }
    if (mode === MACHINE_STATE.HOT_WATER) {
        const value = WATER_STATES.has(waterStop) ? waterStop : null;
        return Object.freeze({
            kind: RAIL_ROW.STOP_MODE,
            id: 'water-stop',
            label: 'Hot water stops on',
            value,
            next: WATER_NEXT[value] ?? null,
            items: Object.freeze([
                Object.freeze({ value: WATER_STOP.VOLUME, label: 'Volume' }),
                Object.freeze({
                    value: WATER_STOP.WEIGHT,
                    label: 'Weight',
                    disabled: offers.stopAtWeight !== true,
                    unavailable: offers.stopAtWeight !== true ? 'stopAtWeight' : null,
                }),
            ]),
        });
    }
    return null;
}

/* ═══════════════════════════════════════════════════════════════ the rail's tracks */

const target = (id, limitKey, label, extra = {}) =>
    Object.freeze({ kind: RAIL_ROW.TARGET, id, limitKey, label, ...extra });

const TEMPERATURE = 'temperature';
const FLOW = 'flow';

export const DEFAULT_PRESETS = Object.freeze({
    drinkWeight: Object.freeze([30, 36, 40, 50]),
    steamFlow: Object.freeze([0.6, 0.8, 1.0, 1.2]),
});

const SECTION = Object.freeze({
    ESPRESSO: 'espresso',
    BREW: 'brew',
    STEAM: 'steam',
    FLUSH: 'flush',
    HOTWATER: 'hotwater',
});

const STANDING_ROWS = Object.freeze([
    target('grind', 'grind', 'Grind', { section: SECTION.ESPRESSO, authored: true }),
    target('dose', 'dose', 'Dose', { section: SECTION.ESPRESSO }),
    target('drink-weight', 'drinkWeight', 'Drink', { presets: true, section: SECTION.ESPRESSO }),
    target('brew-temp', 'brewTemp', 'Brew', { channel: TEMPERATURE, section: SECTION.BREW }),
    /* STEAM: the stop-mode toggle, then the target it names. */
    Object.freeze({ kind: RAIL_ROW.STOP_MODE, id: 'steam-stop', of: MACHINE_STATE.STEAM, section: SECTION.STEAM }),
    target('steam-flow', 'steamFlow', 'Flow', {
        presets: true, channel: FLOW, section: SECTION.STEAM, continuation: true,
    }),
    target('flush-duration', 'flushDuration', 'Flush', { section: SECTION.FLUSH }),
    Object.freeze({ kind: RAIL_ROW.STOP_MODE, id: 'water-stop', of: MACHINE_STATE.HOT_WATER, section: SECTION.HOTWATER }),
    target('water-temp', 'hotWaterTemp', 'Temperature', {
        channel: TEMPERATURE, section: SECTION.HOTWATER, continuation: true,
    }),
]);

const STOP_TARGET = Object.freeze({
    [STEAM_STOP.OFF]: target('steam-stop-target', 'steamDuration', 'Steam', {
        section: SECTION.STEAM,
    }),
    [STEAM_STOP.TIME]: target('steam-stop-target', 'steamDuration', 'Steam', {
        section: SECTION.STEAM,
    }),
    [STEAM_STOP.MILK]: target('steam-stop-target', 'milkStopTemp', 'Steam', {
        channel: TEMPERATURE, section: SECTION.STEAM,
    }),
    [WATER_STOP.VOLUME]: target('water-stop-target', 'hotWaterVolume', 'Hot Water', {
        section: SECTION.HOTWATER,
    }),
    [WATER_STOP.WEIGHT]: target('water-stop-target', 'hotWaterVolume', 'Hot Water', {
        section: SECTION.HOTWATER, unit: 'g',
    }),
});

export function railRows({
    limits = null,
    steamStop = null,
    waterStop = null,
    offers = {},
    presets = {},
    tempUnit = TEMP_UNIT.CELSIUS,
} = {}) {
    const rows = [];

    for (const row of STANDING_ROWS) {
        if (row.kind === RAIL_ROW.STOP_MODE) {
            const built = stopModeRow(row.of, { steamStop, waterStop, offers });
            if (!built) continue;
            const chosen = built.value;
            const fallback = row.of === MACHINE_STATE.STEAM ? STEAM_STOP.TIME : WATER_STOP.VOLUME;
            const built_ = Object.freeze({ ...built, section: row.section });
            const targetRow = STOP_TARGET[chosen] ?? STOP_TARGET[fallback];
            rows.push(withRange(Object.freeze({ ...targetRow, stopMode: built_ }), limits, tempUnit));
            continue;
        }
        rows.push(withRange(row, limits, tempUnit));
    }

    const banks = { ...DEFAULT_PRESETS, ...(presets || null) };
    for (const row of [...rows]) {
        if (row.presets && Array.isArray(banks[row.limitKey]) && banks[row.limitKey].length > 0) {
            rows.splice(rows.indexOf(row) + 1, 0, Object.freeze({
                kind: RAIL_ROW.PRESETS,
                id: `${row.id}-presets`,
                label: `${row.label} presets`,
                limitKey: row.limitKey,
                section: row.section ?? null,
                presets: Object.freeze([...banks[row.limitKey]]),
            }));
        }
    }

    if (rows.length) rows[0] = Object.freeze({ ...rows[0], abortSlot: true });

    let seen = null;
    return Object.freeze(rows.map((row) => {
        if (!row.section || row.section === seen) return row;
        const first = seen !== null;
        seen = row.section;
        return first ? Object.freeze({ ...row, sectionStart: true }) : row;
    }));
}

export function stepFor(limits, key, tempUnit = TEMP_UNIT.CELSIUS) {
    if (!hasLimit(limits, key)) return null;
    const range = limits[key];
    if (range.unit === '°C' && tempUnit === TEMP_UNIT.FAHRENHEIT) {
        return (value, direction) => toDisplayTemp(
            stepLimit(limits, key, fromDisplayTemp(Number(value), tempUnit), direction),
            tempUnit,
        );
    }
    return (value, direction) => stepLimit(limits, key, value, direction);
}

export function numpadBandFor(row, limits, tempUnit = TEMP_UNIT.CELSIUS) {
    const key = row?.limitKey;
    if (!key || !hasLimit(limits, key)) return null;
    /* THE ROW'S RANGE WHEN IT HAS ONE, else the table's own face of it. A row always has
     * one after `withRange`; the fallback is for a caller holding a bare descriptor. */
    const shown = row.range ?? displayRange(limits[key], tempUnit);
    const converted = limits[key].unit === '°C' && tempUnit === TEMP_UNIT.FAHRENHEIT;
    const word = row.unit ?? shown.unit;
    return Object.freeze({
        min: shown.min,
        max: shown.max,
        step: shown.step,
        decimals: shown.decimals ?? decimalsForStep(shown.step),
        unit: word,
        /* THE SENTENCE, FROM THE ONE COMPOSER, over the band being drawn and with the
         * row's own word for it. Nothing is assembled here. */
        label: bandHint(shown, { unit: word }),
        clamp: converted
            ? (value) => toDisplayTemp(
                clampLimit(limits, key, fromDisplayTemp(Number(value), tempUnit)), tempUnit)
            : (value) => clampLimit(limits, key, value),
    });
}

function withRange(row, limits, tempUnit = TEMP_UNIT.CELSIUS) {
    if (!row) return row;
    if (!hasLimit(limits, row.limitKey)) {
        return Object.freeze({ ...row, range: null, unavailable: 'limits' });
    }
    return Object.freeze({
        ...row,
        range: displayRange(limits[row.limitKey], tempUnit),
        unavailable: null,
    });
}

export function bandDerivationFor(live, stored, { browsing = false, running = false } = {}) {
    if (running) return (live && live.ok) ? live : (live ?? stored ?? null);
    if (browsing) return stored ?? null;
    if (live && live.ok) return live;
    return stored ?? live ?? null;
}

/* ═══════════════════════════════════════════════════ the foot band's phase table */

export const PHASE_COLUMNS = Object.freeze([
    Object.freeze({ key: 'time', label: 'Time', unit: 's', align: 'end', grow: 0 }),
    Object.freeze({
        key: 'weight',
        label: 'Weight',
        unit: 'g',
        align: 'end',
        grow: 0,
        ink: 'var(--ui-channel-weight-flow)',
    }),
    Object.freeze({ key: 'volume', label: 'Volume', unit: 'mL', align: 'end', grow: 0 }),
]);

const PHASE_ORDER = Object.freeze([
    Object.freeze({ key: 'preinfusion', header: 'Preinfusion' }),
    Object.freeze({ key: 'extraction', header: 'Extraction' }),
    Object.freeze({ key: 'total', header: 'Total', emphasis: true }),
]);

export function historyPhaseColumns(tempUnit = TEMP_UNIT.CELSIUS) {
    return Object.freeze([
        ...PHASE_COLUMNS,
        Object.freeze({
            key: 'temp', label: 'Temp', unit: unitSymbol(tempUnit), align: 'end', grow: 0,
        }),
        Object.freeze({
            key: 'flow',
            label: 'Flow',
            unit: 'mL' + '/' + 's',
            align: 'end',
            grow: 0,
            ink: 'var(--ui-channel-flow)',
        }),
        Object.freeze({
            key: 'pressure',
            label: 'Pressure',
            unit: 'bar',
            align: 'end',
            grow: 0,
            ink: 'var(--ui-channel-pressure)',
        }),
    ]);
}

export const PHASE_RANGE_ARROW = '\u2794';

function spellRange(parts, places) {
    const spelled = parts
        .filter((v) => typeof v === 'number' && Number.isFinite(v))
        .map((v) => v.toFixed(places));
    if (!spelled.length) return null;
    const [first] = spelled;
    const last = spelled[spelled.length - 1];
    if (spelled.length === 1 || first === last) return first;
    const unique = [first];
    for (const value of spelled.slice(1)) {
        if (value !== unique[unique.length - 1]) unique.push(value);
    }
    return unique.join(PHASE_RANGE_ARROW);
}

export function historyPhaseRows(derivation, tempUnit = TEMP_UNIT.CELSIUS) {
    const phases = derivation && derivation.ok ? derivation.phases : null;
    const shown = (celsius) => (typeof celsius === 'number' && Number.isFinite(celsius)
        ? toDisplayTemp(celsius, tempUnit)
        : celsius);
    return Object.freeze(phaseRows(derivation).map((row) => {
        const phase = phases ? phases[row.key] : null;
        if (!phase || row.key === 'total') return row;
        const extra = {
            temp: spellRange([shown(phase.groupTemp?.min), shown(phase.groupTemp?.max)], 0),
            flow: spellRange([phase.flow?.start, phase.flow?.peak, phase.flow?.end], 1),
            pressure: spellRange([phase.pressure?.start, phase.pressure?.peak, phase.pressure?.end], 1),
        };
        const cells = { ...row.cells };
        for (const [key, value] of Object.entries(extra)) {
            if (value !== null) cells[key] = value;
        }
        return Object.freeze({ ...row, cells: Object.freeze(cells) });
    }));
}

const cell = (value, places) => (typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(places)
    : null);

export function phaseRows(derivation) {
    const phases = derivation && derivation.ok ? derivation.phases : null;
    return Object.freeze(PHASE_ORDER.map((row) => {
        const phase = phases ? phases[row.key] : null;
        const cells = phase
            ? {
                time: cell(phase.seconds, 1),
                weight: cell(phase.weight, 1),
                volume: cell(phase.volume, 1),
            }
            : {};
        for (const key of Object.keys(cells)) {
            if (cells[key] === null) delete cells[key];
        }
        return Object.freeze({ ...row, cells: Object.freeze(cells) });
    }));
}
