/**
 * The per-machine limits table the ranges door reads.
 */

/** The two machine classes the steam envelope is decided for (`doc/Skins.md:573`). */
export const MACHINE_CLASSES = Object.freeze(['bengle', 'de1']);

const STEAM_FLOOR = 135;
const STEAM_CEILING_BY_MACHINE_CLASS = Object.freeze({ bengle: 170, de1: 160 });

export const REAPRIME_FAN_MMR_CEILING = 50;

export const REAPRIME_FAN_RESET_REQUEST = 55;
export const FAN_THRESHOLD_AFTER_RESET = Math.min(
    REAPRIME_FAN_RESET_REQUEST, REAPRIME_FAN_MMR_CEILING,
);

const FAN_THRESHOLD_BY_MACHINE_CLASS = Object.freeze({
    bengle: Object.freeze({ min: 40, max: 60, step: 1, unit: '\u00B0C' }),
    de1: Object.freeze({ min: 0, max: REAPRIME_FAN_MMR_CEILING, step: 1, unit: '\u00B0C' }),
});

/** Every row this table can carry, machine-dependent rows included. */
export const LIMIT_KEYS = Object.freeze([
    'hotWaterTemp', 'hotWaterVolume', 'steamDuration', 'steamTemp', 'steamFlow',
    'dose', 'drinkWeight', 'grind', 'milkStopTemp', 'flushDuration', 'flushTemp',
    'flushFlow', 'fanThreshold', 'brewTemp', 'calibrationWeight',
    'heaterPh1Flow', 'heaterPh2Flow', 'heaterIdleTemp', 'heaterPh2Timeout',
    'tankTemp', 'appFlowMultiplier', 'hotWaterFlow', 'cupWarmerTarget',
    'flowCalibration', 'hotWaterDuration', 'waterAlertLevel', 'preWarmLead', 'sleepAfter',
    'screensaverCycle', 'hotWaterLookahead', 'screenBrightness',
]);

/** The machine-independent rows. Identical on every machine class. */
const BASE_LIMITS = Object.freeze({
    /** Hot water target temperature. 0 = off. */
    hotWaterTemp: Object.freeze({ min: 0, max: 99, step: 1, unit: '°C' }),
    hotWaterVolume: Object.freeze({ min: 0, max: 255, step: 5, unit: 'mL', zeroMeans: 'no volume cap' }),
    steamDuration: Object.freeze({ min: 10, max: 120, step: 5, unit: 's' }),
    /** Steam flow. No off value: zero flow is not a state the machine holds. */
    steamFlow: Object.freeze({ min: 0.4, max: 2.5, step: 0.1, unit: 'mL/s' }),
    dose: Object.freeze({ min: 1, max: 120, step: 1, unit: 'g' }),
    drinkWeight: Object.freeze({ min: 1, max: 1000, step: 1, unit: 'g' }),
    grind: Object.freeze({ min: 0, max: 9999, step: 0.1, coarseStep: 1, unit: '' }),
    /** Milk-probe auto-stop target. 0 = disarmed, handled by the mode toggle. */
    milkStopTemp: Object.freeze({ min: 30, max: 85, step: 1, unit: '°C' }),

    flushDuration: Object.freeze({ min: 0, max: 60, step: 1, unit: 's' }),
    flushTemp: Object.freeze({ min: 5, max: 95, step: 1, unit: '°C' }),
    flushFlow: Object.freeze({ min: 2, max: 8, step: 0.1, unit: 'mL/s' }),

    brewTemp: Object.freeze({ min: 70, max: 110, step: 0.5, unit: '°C' }),
    calibrationWeight: Object.freeze({ min: 1, max: 10000, step: 1, unit: 'g' }),
    heaterPh1Flow: Object.freeze({ min: 0, max: 10, step: 0.1, unit: 'mL/s' }),
    heaterPh2Flow: Object.freeze({ min: 0, max: 10, step: 0.1, unit: 'mL/s' }),
    heaterIdleTemp: Object.freeze({ min: 0, max: 95, step: 1, unit: '\u00B0C' }),
    heaterPh2Timeout: Object.freeze({ min: 0, max: 60, step: 1, unit: 's' }),

    tankTemp: Object.freeze({ min: 0, max: 60, step: 1, unit: '\u00B0C' }),
    appFlowMultiplier: Object.freeze({ min: 0, max: 2, step: 0.05, unit: 's' }),

    hotWaterFlow: Object.freeze({ min: 2, max: 8, step: 0.1, unit: 'mL/s' }),

    hotWaterLookahead: Object.freeze({ min: 0, max: 2, step: 0.05, unit: 's' }),

    hotWaterDuration: Object.freeze({ min: 5, max: 120, step: 5, unit: 's' }),

    waterAlertLevel: Object.freeze({ min: 0, max: 30, step: 5, unit: 'mm' }),

    preWarmLead: Object.freeze({ min: 5, max: 60, step: 5, unit: 'min' }),

    sleepAfter: Object.freeze({ min: 5, max: 300, step: 5, unit: 'min' }),

    screensaverCycle: Object.freeze({ min: 1, max: 10, step: 1, unit: 'min' }),

    screenBrightness: Object.freeze({ min: 10, max: 100, step: 1, unit: '%' }),

    flowCalibration: Object.freeze({ min: 0.5, max: 2, step: 0.01, unit: '×' }),

    cupWarmerTarget: Object.freeze({ min: 40, max: 70, step: 1, unit: '°C' }),
});

export function limitsFor(machineClass) {
    if (machineClass === null || machineClass === undefined) return BASE_LIMITS;
    if (!MACHINE_CLASSES.includes(machineClass)) {
        throw new Error(`machine-limits: unknown machine class "${machineClass}"`);
    }
    return Object.freeze({
        ...BASE_LIMITS,
        fanThreshold: FAN_THRESHOLD_BY_MACHINE_CLASS[machineClass],
        steamTemp: Object.freeze({
            min: 0,
            max: STEAM_CEILING_BY_MACHINE_CLASS[machineClass],
            floor: STEAM_FLOOR,
            step: 1,
            unit: '°C',
            machineClass,
        }),
    });
}

/** True when this table carries a range for `key` — absence is a real answer. */
export function hasLimit(limits, key) {
    return !!limits && Object.hasOwn(limits, key);
}

function rangeOf(limits, key) {
    const range = hasLimit(limits, key) ? limits[key] : undefined;
    if (!range) throw new Error(`no limits declared for "${key}"`);
    return range;
}

/** Clamp to a range, respecting a hole at the bottom if the range has one. */
export function clamp(limits, key, value) {
    const range = rangeOf(limits, key);
    const n = Number(value);
    if (!Number.isFinite(n)) return range.min;
    if (n <= range.min) return range.min;
    if (n >= range.max) return range.max;
    if (range.floor !== undefined && n < range.floor) {
        return (n - range.min) < (range.floor - n) ? range.min : range.floor;
    }
    return n;
}

export function step(limits, key, value, direction) {
    const range = rangeOf(limits, key);
    const current = Number.isFinite(Number(value)) ? Number(value) : range.min;
    /* A COARSE STEP THE VALUE ITSELF SELECTS — see the `grind` row for why. A range
     * without one steps by `step` at every value, which is every other row here. */
    const size = range.coarseStep !== undefined && Number.isInteger(current)
        ? range.coarseStep : range.step;
    const delta = (direction >= 0 ? 1 : -1) * size;

    if (range.floor !== undefined) {
        if (current <= range.min && delta > 0) return range.floor;
        if (current <= range.floor && delta < 0) return range.min;
    }
    // Round to the step's own precision: 2.1 + 0.1 is 2.2000000000000002.
    const decimals = String(size).split('.')[1]?.length ?? 0;
    return clamp(limits, key, Number((current + delta).toFixed(decimals)));
}

export function bandHint(range, { format = (n) => String(n), unit, zeroMeans } = {}) {
    /* NO RANGE IS NO SENTENCE, not an empty band. A caller with nothing to describe gets
     * nothing to print, and A7 decides what it draws in that space instead. */
    if (!range) return '';
    const word = unit === undefined ? range.unit : unit;
    const suffix = word ? ` ${word}` : '';
    const means = zeroMeans === undefined ? range.zeroMeans : zeroMeans;
    if (range.floor !== undefined) {
        if (!means) return `${format(range.floor)}–${format(range.max)}${suffix}`;
        return `0 (${means}) or ${format(range.floor)}–${format(range.max)}${suffix}`;
    }
    if (means) {
        return `${format(range.min)}–${format(range.max)}${suffix} · 0 = ${means}`;
    }
    return `${format(range.min)}–${format(range.max)}${suffix}`;
}

export function rangeHint(limits, key, format = (n) => String(n), { unit: withUnit = true } = {}) {
    return bandHint(rangeOf(limits, key), { format, unit: withUnit ? undefined : '' });
}

export function padBand(range) {
    if (!range || range.floor === undefined) return range;
    return {
        ...range,
        min: range.floor,
        floor: undefined,
        zeroMeans: undefined,
        refuseOutside: true,
    };
}

export function numpadRange(limits, key) {
    const band = padBand(rangeOf(limits, key));
    return Object.freeze({
        min: band.min,
        max: band.max,
        step: band.step,
        label: bandHint(band),
        /* Only ever present on a band `padBand` narrowed — see it for why one row refuses
         * where every other one corrects. */
        ...(band.refuseOutside ? { refuseOutside: true } : null),
    });
}
