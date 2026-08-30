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
/* THE WORDING IS `machine-limits.js`'s AND ONLY THE CONVERSION IS THIS FILE'S — which is
 * what the comment on `displayRangeHint` at the foot of this file has always CLAIMED, and
 * was not true until 27 August 2026. See that function for the drift it cost. The import
 * runs one way only: `machine-limits.js` imports nothing at all (its own suite asserts
 * that its source contains no `import`), so there is no cycle to make here. */
import { bandHint } from './machine-limits.js';

/** The two display units. The wire is ALWAYS Celsius — this is a display preference. */
export const TEMP_UNIT = Object.freeze({ CELSIUS: 'C', FAHRENHEIT: 'F' });

/** Every legal unit, for validation and for a settings control to enumerate. */
export const TEMP_UNITS = Object.freeze([TEMP_UNIT.CELSIUS, TEMP_UNIT.FAHRENHEIT]);

/** What an unset preference means. Celsius, because the wire is Celsius. */
export const DEFAULT_TEMP_UNIT = TEMP_UNIT.CELSIUS;

/**
 * The LOGICAL key. The router owns the physical spelling and the layer; nothing here knows
 * whether it lands in ReaPrime's KV store or on the device. That is what lets the open
 * question (U7 — is the temperature unit machine-scoped or device-scoped?) be settled by
 * flipping one row in `storage-routes.js` with no call site moving.
 */
export const TEMP_UNIT_KEY = 'tempUnit';

/**
 * The ONE mark for an absent value.
 *
 * Named `NO_READING_MARK`, not `NO_READING`, on purpose: `../data/reading.js` exports
 * `NO_READING` as the absence VALUE (an object carrying a reason), and two different things
 * called NO_READING in one tree is how the old skin ended up with an em dash on the readout
 * row and an en dash eight inches under it. This is the typographic mark that absence is
 * PRINTED as; that one is the absence itself.
 *
 * It is a mark, not copy: it does not go through i18n.
 */
export const NO_READING_MARK = '—';

/** Degree suffix per unit. */
const UNIT_SYMBOL = Object.freeze({ [TEMP_UNIT.CELSIUS]: '°C', [TEMP_UNIT.FAHRENHEIT]: '°F' });

/* ------------------------------------------------------------------ pure policy */

/** @param {string} unit @returns {'°C'|'°F'} */
export function unitSymbol(unit) {
    return UNIT_SYMBOL[normaliseUnit(unit) || DEFAULT_TEMP_UNIT];
}

/**
 * A stored or user-supplied value -> a legal unit, or NULL when it is neither.
 *
 * Null rather than a silent default: the caller decides what an unreadable preference
 * means, and the store logs it. The old `unit === 'F' ? 'F' : 'C'` turned every typo into
 * Celsius without a word.
 */
/**
 * A stored preference -> a canonical unit, or null when it is neither.
 *
 * CASE-INSENSITIVE, AND THAT IS NOT A COURTESY. The settings bank writes LOWERCASE — its
 * items are `{value: 'c'}` and `{value: 'f'}`, and Ben's decided default is `'c'` — while
 * this module's constants have always been uppercase. Until 26 August 2026 nothing joined
 * the two, so the mismatch cost nothing; the moment the app started reading the preference
 * it would have answered null for every value the app can actually store, and the whole
 * conversion would have been silently inert with a green suite behind it.
 *
 * Fixed HERE rather than by re-spelling the bank, because the bank's values are already in
 * people's storage and a migration to change a letter's case is a migration to buy nothing.
 * Anything that is not one of the two still answers null — the caller decides what "no
 * opinion" means, and it always means Celsius, because the wire is Celsius.
 */
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

/**
 * POLICY 4 — one absent mark. A Celsius reading (or an absence from `../data/reading.js`)
 * formatted for display.
 *
 * A non-finite number is an ABSENCE, printed as the em dash — not as the old module's
 * hyphen, and never as a zero. `hasReading` is the same predicate the address layer uses,
 * so "what counts as a reading" is decided in exactly one place.
 *
 * @param {number|{noReading: true}} celsius
 * @param {string} unit
 * @param {object} [options]
 * @param {number} [options.decimals=1]
 * @param {boolean} [options.withSymbol=true]
 * @param {string} [options.dash=NO_READING_MARK]
 */
export function formatTemperature(celsius, unit, { decimals = 1, withSymbol = true, dash = NO_READING_MARK } = {}) {
    if (!hasReading(celsius)) return dash;
    const shown = toDisplayTemp(celsius, unit).toFixed(decimals);
    return withSymbol ? `${shown}${unitSymbol(unit)}` : shown;
}

/**
 * A limits range, wearing its Fahrenheit face.
 *
 * ONE OWNER FOR THE CONVERSION, because there are two surfaces that show a temperature the
 * person can change — the settings rows and the Live rail — and each has its own stepper,
 * its own bounds and its own formatter. Two copies of this arithmetic is how the rail and
 * the settings page come to disagree about where a band ends.
 *
 * WHAT IS CONVERTED AND WHAT IS NOT:
 *
 *   min / max   converted and ROUNDED to whole display units (Policy 3). A bound printed
 *               as 275.4 invites a value the band would refuse.
 *   step        the machine's own step, scaled. NOT one display degree — see below.
 *   unit        the symbol for the unit being drawn.
 *   decimals    the CELSIUS step's decimal count, which is what the drawn number carries.
 *               Ben, 26 August 2026: "rounding to same decimal place as the original
 *               value." A band that steps by a whole degree has no tenths to show, so a
 *               press reads 322 and not 321.8.
 *
 * WHY THE STEP IS THE MACHINE'S, which departs from Policy 2 above and so is argued rather
 * than assumed. That policy wants "+1 degree to feel like one degree in whichever unit is
 * showing", and it was written before `machine-limits.js` grew a hole-aware `step()`: the
 * steam band is 0 OR 135-170, and stepping down from 135 has to land on 0 rather than
 * inside the hole. Only that function knows, and it steps in Celsius. So a press moves ONE
 * MACHINE STEP and the Fahrenheit reading moves 1.8 — uneven after rounding, and every
 * value a press can reach is a value the machine can hold.
 *
 * A NON-TEMPERATURE RANGE COMES BACK UNTOUCHED, and so does a Celsius one. The caller does
 * not branch; this does.
 *
 * @param {object|null} range  a row out of the limits table
 * @param {string} unit        the unit being drawn
 * @returns {object|null} the same shape, plus `decimals`
 */
export function displayRange(range, unit) {
    if (!range) return range;
    /* NOTHING TO CONVERT MEANS THE TABLE'S OWN OBJECT, unchanged and by identity.
     * `live-targets.js`'s suite asserts a rail row carries "the table's own range" — a
     * copy with one extra key would fail it, and rightly: the point of that assertion is
     * that no layer between the table and the control invents a bound. A caller that wants
     * the decimal count for an unconverted range asks `decimalsForStep(range.step)`, which
     * is what the stepper already does for itself. */
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

/**
 * The band as a line of prose, in the unit it is being drawn in.
 *
 * `machine-limits.js` owns the wording and this owns nothing but the conversion. THAT
 * SENTENCE WAS A COMMENT AND NOT A FACT until 27 August 2026: the shape — "0 or
 * 135-170", the zero meaning appended after a middle dot — was re-spelled here by hand,
 * off `range.floor`, rather than asked for. So when Ben deleted `zeroMeans` from the
 * steam row on 26 August ("no need to have <130 = off, the new toggle has that now") and
 * `rangeHint` stopped teaching the zero, this went on teaching it. MEASURED on the
 * settings fixture, Machine › Steam: the same band read
 *
 *     Celsius      135–170 °C
 *     Fahrenheit   0 or 275–338 °F
 *
 * — one row, one band, two sentences, decided by a display preference that has no
 * business deciding it. `bandHint` is now the only author of the shape and this function
 * is the conversion in front of it, which is what the paragraph above always described.
 *
 * THE TAIL PARAMETER IS GONE and its absence is the point. It existed because the caller
 * had to salvage the zero-meaning clause out of the Celsius sentence and hand it back;
 * `displayRange` spreads the whole row, `zeroMeans` included, so the composer now reads
 * it off the converted band for itself and there is nothing left to pass.
 *
 * @param {object} range     a row out of the limits table, in CELSIUS
 * @param {string|null} unit the unit being drawn. Null, or Celsius, converts nothing —
 *                           `displayRange` hands back the table's own object — so a
 *                           caller does not branch on whether a conversion applies.
 * @param {object} [options] forwarded to `bandHint`: `unit` when the surface restates the
 *                           word (the hot-water mL/g case), `zeroMeans` when it restates
 *                           the meaning.
 */
export function displayRangeHint(range, unit, options) {
    return bandHint(displayRange(range, unit), options);
}
