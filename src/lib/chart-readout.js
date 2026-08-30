/**
 * chart-readout.js — the NUMBERS a chart cursor puts on the card, and the one place
 * they are turned into text.
 *
 * WHY IT EXISTS. `<ui-chart-card>` has emitted `cursor-change` — `{ active, idx, t,
 * values }`, "the same numbers the chart drew, at the same index" — since wave 3, and
 * `<ui-chart-legend>` has declared a `values` property since wave 3 as well. Neither had
 * a consumer: audit F-032 measured a scrub on all four history cards and the editor
 * preview and found `legend.values` null, the `foot` slot empty and the card's whole
 * shadow `textContent` empty at every pointer position. The cursor half was delivered and
 * the readout half was not. This module is the missing half's arithmetic; the pages
 * (`history-flow-page`, `history-power-page`, `editor-preview`) are its only callers.
 *
 * IT HOLDS NO WORD A PERSON READS (D2). Everything here is a NUMBER and a UNIT SYMBOL —
 * `bar`, `mL/s`, `s` — which is the same line `expanded-summary.js` draws for the same
 * reason: a unit symbol is not translated, a label is. Every LABEL a readout carries
 * ("Pressure", "Flow") is composed by the screen through its own `t`, and this module
 * returns keys for the screen to name.
 *
 * IT ROUNDS THROUGH `scalarText` AND NOT THROUGH ITS OWN `toFixed`. `shot-summary.js`
 * already owns "a scalar as text": round to N decimals, print the zero, answer the dash
 * for an absence. A second rounding rule here would be a second answer to how many digits
 * a pressure has — and the summary strip and the cursor readout naming the same channel
 * with different precision is exactly the drift one formatter exists to stop.
 *
 * AN ABSENT READING IS ABSENT, NOT A DASH. `#10`'s own contract is "Absent keys render no
 * readout at all, which is the resting state of every legend that has no cursor on its
 * plot", so `readoutValues` OMITS a key it cannot name rather than filling it with the
 * summary table's em dash. A dash on a chip would read as "this channel is zero here",
 * which is a different claim from "the chart drew nothing here".
 *
 * THE SOLIDUS IS ASSEMBLED, NEVER WRITTEN INTO A TEMPLATE. Gate D cannot tell a units
 * string with a `/` in it from a path being built out of template holes, so
 * `expanded-summary.js` spells `'mL' + '/' + 's'` and so does this file. The join is a
 * constant for the same reason.
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

/**
 * HOW EACH CHANNEL IS READ — decimals and unit, by gate 6 series key.
 *
 * The decimals are the ones the rest of the skin already prints: one for the hydraulics
 * and the temperatures (`expanded-summary.js` pairs peak and average at one), none for
 * watts (a tenth of a watt is noise on a 2 kW heater), two for the derived pair (R and Z
 * live between 0.01 and 10, so a tenth would round most of a shot to the same number).
 *
 * A KEY THAT IS NOT HERE IS NOT REFUSED — `readoutValue` falls back to one decimal and no
 * unit, so a channel added to `SERIES_KEYS` tomorrow reads as a bare number rather than
 * throwing at a cursor move. It should still be given a row.
 */
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

/**
 * One channel's reading, as text — or `null` when there is nothing to read.
 *
 * `withUnit` is FALSE by default because the commonest consumer is a legend chip, whose
 * label already carries the unit ("Pressure (bar)"): printing it again would read
 * "Pressure (bar) 9.1 bar". A readout with no label of its own — the trajectory well, the
 * editor preview — asks for the unit.
 */
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

/**
 * The map `<ui-chart-legend>.values` takes — `{ [key]: '9.1' }` — built from a
 * `cursor-change` detail.
 *
 * `keys` is the legend's OWN item keys, so a card drawing ten series (a comparison lays
 * B's five over A's) still hands its key the five it names. `hidden` is the legend's own
 * `hiddenKeys`: a chip the reader turned OFF names no number, because the chart is not
 * drawing that line and "the same numbers the chart drew" would stop being true.
 *
 * Returns an EMPTY object for a resting cursor, which is what clears the readout.
 */
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

/**
 * The whole reading as terms — `[{ key, value }]`, in the order the keys were given, with
 * the time last.
 *
 * KEYS, NOT LABELS: the caller turns `pressure` into the word "Pressure" through its own
 * `t`. `time` is a term like any other and its key is not a series key, which is why the
 * caller's label table has to name it too.
 *
 * `withUnit` IS THE DIFFERENCE BETWEEN A CARD WITH A KEY AND ONE WITHOUT. A card whose
 * legend is on screen has already said "Pressure (bar)" on the chip, so the announced
 * line repeats neither the unit nor anything else; a card with no legend at all — the
 * trajectory well, the editor preview — is the only place a reading is printed, and there
 * the unit has to ride with the number.
 */
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

/**
 * The same three terms for ONE POINT of the pressure-against-flow trajectory, whose x is
 * flow and whose y is pressure — `{ x, y, t }`, the shape `history-power.js`
 * `trajectoryPoints` produces.
 *
 * PRESSURE FIRST, then flow, then the second it belongs to: that is the order the chart's
 * own name reads in ("Pressure versus flow trajectory") and the order F-034's intent
 * states ("the pressure it sat at, the flow it sat at, and the second of the shot it
 * belongs to").
 */
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

/**
 * `[{ key, value }]` plus a label table, joined into the one line a foot strip prints.
 *
 * The labels arrive already translated — `{ pressure: t('Pressure'), … }` — and a term
 * whose key the table does not name prints its value alone, which is the honest thing to
 * do with a number nobody has a word for.
 */
export function readoutLine(terms, labels = {}) {
    return (terms ?? [])
        .map((term) => (labels[term.key] ? `${labels[term.key]} ${term.value}` : term.value))
        .join(READOUT_JOIN);
}
