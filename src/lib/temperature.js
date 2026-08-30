// The temperature CONVERSION — pure policy, no store, no DOM, no ambient state.
//
// WHY IT IS IN `lib/` AND THE STORE IS NOT. `live-targets.js` is a lib and its own suite
// forbids it to import from `src/stores/` — "no endpoint, no store, no adapter and no
// machine name" — which is the right rule and which this file was on the wrong side of.
// The Live rail needs the CONVERSION; it has no business with the PREFERENCE, which is a
// stored thing with a load, a write and a failure mode. So the two are split at exactly
// that line: the arithmetic and the policy live here, and `stores/units.js` owns the key.
//
// It re-exports every name below, so nothing that already imported from there had to move.
//
// The four policies are unchanged in spirit and pure — the unit is an ARGUMENT, never read
// from ambient state:
//
//   1. Convert at the input edge. Every writer sends Celsius.
//   2. A step delta has no offset. (Qualified: see `displayRange`, which steps by the
//      MACHINE's step so the hole-aware `step()` in `machine-limits.js` still governs.)
//   3. Round BOUNDS to whole display units.
//   4. One absent mark — the em dash, and never a zero.

import { hasReading } from '../data/reading.js';
import { bandHint } from './machine-limits.js';

/** The two display units. The wire is ALWAYS Celsius — this is a display preference. */
export const TEMP_UNIT = Object.freeze({ CELSIUS: 'C', FAHRENHEIT: 'F' });

/** Every legal unit, for validation and for a settings control to enumerate. */
export const TEMP_UNITS = Object.freeze([TEMP_UNIT.CELSIUS, TEMP_UNIT.FAHRENHEIT]);

/** What an unset preference means. Celsius, because the wire is Celsius. */
export const DEFAULT_TEMP_UNIT = TEMP_UNIT.CELSIUS;

export const TEMP_UNIT_KEY = 'tempUnit';

export const NO_READING_MARK = '—';

/** Degree suffix per unit. */
const UNIT_SYMBOL = Object.freeze({ [TEMP_UNIT.CELSIUS]: '°C', [TEMP_UNIT.FAHRENHEIT]: '°F' });

/** @param {string} unit @returns {'°C'|'°F'} */
export function unitSymbol(unit) {
    return UNIT_SYMBOL[normaliseUnit(unit) || DEFAULT_TEMP_UNIT];
}

export function normaliseUnit(value) {
    if (typeof value !== 'string') return null;
    const upper = value.trim().toUpperCase();
    return TEMP_UNITS.includes(upper) ? upper : null;
}

export function celsiusToFahrenheit(celsius) {
    return (celsius * 9 / 5) + 32;
}

export function fahrenheitToCelsius(fahrenheit) {
    return (fahrenheit - 32) * 5 / 9;
}

/** Canonical Celsius -> the number shown in `unit`. */
export function toDisplayTemp(celsius, unit) {
    return unit === TEMP_UNIT.FAHRENHEIT ? celsiusToFahrenheit(celsius) : celsius;
}

/**
 * POLICY 1 — convert at the input edge. A value the user typed or dragged in the CURRENT
 * display unit becomes canonical Celsius here, so every writer sends Celsius and no
 * conversion survives past the edge.
 */
export function fromDisplayTemp(displayValue, unit) {
    return unit === TEMP_UNIT.FAHRENHEIT ? fahrenheitToCelsius(displayValue) : displayValue;
}

/**
 * POLICY 2 — a step delta has NO OFFSET. Only the 5/9 scale applies, so a "+1 degree"
 * button feels like one degree in whichever unit is showing rather than a fixed 1 C jump
 * that reads as 1.8 F.
 */
export function displayStepToCelsius(displayStep, unit) {
    return unit === TEMP_UNIT.FAHRENHEIT ? displayStep * 5 / 9 : displayStep;
}

/**
 * POLICY 3 — round BOUNDS to whole display units. For a numpad limit or a clamp, never for
 * a live reading: a bound that shows a fraction invites a value the machine will refuse.
 */
export function boundToDisplay(celsius, unit) {
    return Math.round(toDisplayTemp(celsius, unit));
}

/** How many decimals a step implies: 0.5 -> 1, 1 -> 0. */
export function decimalsForStep(step) {
    return String(step).split('.')[1]?.length ?? 0;
}

/** A value formatted to its step's precision. Non-numeric input is a caller bug, not a 0. */
export function formatToStep(value, step) {
    const decimals = decimalsForStep(step);
    const n = Number(value);
    if (!Number.isFinite(n)) return NO_READING_MARK;
    return decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
}

export function formatTemperature(celsius, unit, { decimals = 1, withSymbol = true, dash = NO_READING_MARK } = {}) {
    if (!hasReading(celsius)) return dash;
    const shown = toDisplayTemp(celsius, unit).toFixed(decimals);
    return withSymbol ? `${shown}${unitSymbol(unit)}` : shown;
}

export function displayRange(range, unit) {
    if (!range) return range;
    if (range.unit !== '°C' || unit !== TEMP_UNIT.FAHRENHEIT) return range;
    return Object.freeze({
        ...range,
        min: boundToDisplay(range.min, unit),
        max: boundToDisplay(range.max, unit),
        ...(range.floor !== undefined ? { floor: boundToDisplay(range.floor, unit) } : null),
        step: range.step * 9 / 5,
        unit: unitSymbol(unit),
        /* THE PRECISION FOLLOWS THE MACHINE'S STEP, not the converted one. */
        decimals: decimalsForStep(range.step),
    });
}

export function displayRangeHint(range, unit, options) {
    return bandHint(displayRange(range, unit), options);
}
