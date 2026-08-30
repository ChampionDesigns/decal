/**
 * The NUMBERS a chart cursor puts on the card, and the one place they are turned into text.
 */

import { scalarText } from './shot-summary.js';

/**
 * The unit each channel is read in. One table, and it is the SYMBOL only — the quantity's
 * name belongs to whoever is doing the naming.
 */
const UNIT = Object.freeze({
    SECONDS: 's',
    PRESSURE: 'bar',
    FLOW: 'mL' + '/' + 's',
    WEIGHT_FLOW: 'g' + '/' + 's',
    GRAMS: 'g',
    MILLILITRES: 'mL',
    CELSIUS: '°C',
    WATTS: 'W',
    RESISTANCE: 'bar·s²' + '/' + 'mL²',
    IMPEDANCE: 'bar·s' + '/' + 'mL',
});

/** The join between two terms of one reading. A constant, for gate D's sake. */
export const READOUT_JOIN = '  ·  ';

export const CHANNEL_READOUT = Object.freeze({
    pressure: Object.freeze({ decimals: 1, unit: UNIT.PRESSURE }),
    targetPressure: Object.freeze({ decimals: 1, unit: UNIT.PRESSURE }),
    flow: Object.freeze({ decimals: 1, unit: UNIT.FLOW }),
    targetFlow: Object.freeze({ decimals: 1, unit: UNIT.FLOW }),
    weightFlow: Object.freeze({ decimals: 1, unit: UNIT.WEIGHT_FLOW }),
    weight: Object.freeze({ decimals: 1, unit: UNIT.GRAMS }),
    volume: Object.freeze({ decimals: 1, unit: UNIT.MILLILITRES }),
    groupTemp: Object.freeze({ decimals: 1, unit: UNIT.CELSIUS }),
    mixTemp: Object.freeze({ decimals: 1, unit: UNIT.CELSIUS }),
    targetTemp: Object.freeze({ decimals: 1, unit: UNIT.CELSIUS }),
    targetMixTemp: Object.freeze({ decimals: 1, unit: UNIT.CELSIUS }),
    power: Object.freeze({ decimals: 0, unit: UNIT.WATTS }),
    resistance: Object.freeze({ decimals: 2, unit: UNIT.RESISTANCE }),
    impedance: Object.freeze({ decimals: 2, unit: UNIT.IMPEDANCE }),
});

/** The fallback row, so an unlisted key reads rather than throws. */
const DEFAULT_ROW = Object.freeze({ decimals: 1, unit: null });

const finite = (value) => typeof value === 'number' && Number.isFinite(value);

export function readoutValue(key, value, { withUnit = false } = {}) {
    if (!finite(value)) return null;
    const row = CHANNEL_READOUT[key] ?? DEFAULT_ROW;
    return scalarText(value, {
        decimals: row.decimals,
        unit: withUnit ? row.unit : null,
    });
}

/** The shot clock, as text. Always carries its unit: a bare number is not a time. */
export function readoutTime(seconds) {
    if (!finite(seconds)) return null;
    return scalarText(seconds, { decimals: 1, unit: UNIT.SECONDS });
}

export function readoutValues(detail, keys, { hidden = [] } = {}) {
    const out = {};
    if (!detail || detail.active !== true) return out;
    const values = detail.values ?? {};
    const off = new Set(hidden);
    for (const key of keys ?? []) {
        if (off.has(key)) continue;
        const text = readoutValue(key, values[key]);
        if (text !== null) out[key] = text;
    }
    return out;
}

export function readoutTerms(detail, keys, { hidden = [], withUnit = true } = {}) {
    if (!detail || detail.active !== true) return [];
    const values = detail.values ?? {};
    const off = new Set(hidden);
    const terms = [];
    for (const key of keys ?? []) {
        if (off.has(key)) continue;
        const value = readoutValue(key, values[key], { withUnit });
        if (value !== null) terms.push({ key, value });
    }
    const time = readoutTime(detail.t);
    if (time !== null) terms.push({ key: 'time', value: time });
    return terms;
}

export function trajectoryTerms(point) {
    if (!point) return [];
    const terms = [];
    const pressure = readoutValue('pressure', point.y, { withUnit: true });
    if (pressure !== null) terms.push({ key: 'pressure', value: pressure });
    const flow = readoutValue('flow', point.x, { withUnit: true });
    if (flow !== null) terms.push({ key: 'flow', value: flow });
    const time = readoutTime(point.t);
    if (time !== null) terms.push({ key: 'time', value: time });
    return terms;
}

export function readoutLine(terms, labels = {}) {
    return (terms ?? [])
        .map((term) => (labels[term.key] ? `${labels[term.key]} ${term.value}` : term.value))
        .join(READOUT_JOIN);
}
