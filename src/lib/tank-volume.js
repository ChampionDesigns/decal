// The water tank's level, in the unit the person chose.
//
// THE SETTING EXISTED AND NOTHING READ IT. `machine-water-tank-unit` has offered mm | mL
// since the settings screen was built, and `waterTankUnit` had no reader anywhere — the
// Live screen's Tank tile drew millimetres whatever the bank said. Its own note said as
// much: "Slate shows the same by default and offers mL as a SETTING … When Decal grows
// that setting, this is the one place the unit changes." Found on 26 August 2026 by
// sweeping every settings row for something on the other end.
//
// THE CONVERSION IS BEN'S, AND IT IS NOT SLATE'S.
//
// Ben, 26 August 2026: "1mm = 40ml for the water tank." So this is one multiply, and the
// module is four lines of arithmetic wrapped in the reasons it is not more.
//
// SLATE DISAGREES, and the disagreement is recorded here rather than resolved silently.
// Slate carries a 68-entry lookup ported from the TCL skin (`waterTank.js` MM_TO_ML,
// 0 → 0, 1 → 16, 2 → 43 … 67 → 2058) which is NON-LINEAR and averages about 30 mL per
// millimetre, topping out at 2058 mL. Ben's figure is linear at 40. The two cannot both
// describe the same tank, and the one that governs here is the one from the person who
// has the machine on the bench — the same rule that governs every other hardware fact in
// this fork. If the table is ever wanted back, it is in Slate's tree and this is the one
// file that would change.
//
// MILLIMETRES ARE THE WIRE'S OWN UNIT. `/ws/v1/machine/waterLevels` carries
// `{currentLevel, refillLevel}` in mm, and the contract's note records that mm → mL has no
// ReaPrime counterpart: it is skin-side, here, once. Nothing converts on the way IN — a
// reading is stored and compared in the machine's own unit, and only the drawn number
// moves. That is the same shape the temperature unit takes, and for the same reason: a
// conversion that survives past the display edge is a conversion that eventually round-trips
// through a write.
//
// DOM-free and store-free: the unit is an ARGUMENT, never read from ambient state.

/** The two display units. The wire is ALWAYS millimetres. */
export const TANK_UNIT = Object.freeze({ MM: 'mm', ML: 'mL' });

/** Every legal unit, for validation and for a settings control to enumerate. */
export const TANK_UNITS = Object.freeze([TANK_UNIT.MM, TANK_UNIT.ML]);

/** What an unset preference means. Millimetres, because the wire is millimetres. */
export const DEFAULT_TANK_UNIT = TANK_UNIT.MM;

/**
 * Millilitres per millimetre of tank depth.
 *
 * Ben, 26 August 2026: "1mm = 40ml for the water tank." Named rather than inlined so the
 * figure has one home and one owner, and so a change is one line rather than a search.
 */
export const ML_PER_MM = 40;

/**
 * The stored preference, normalised, or null when it is not one of the two.
 *
 * The bank's own values are the strings below, and an unrecognised value is NOT coerced to
 * a default here — the caller decides whether "no opinion" means millimetres, and it
 * always does, but that decision belongs at the call site rather than hidden in a parser.
 */
export function normaliseTankUnit(value) {
    return TANK_UNITS.includes(value) ? value : null;
}

/** Millimetres of depth -> millilitres. */
export function mmToMillilitres(mm) {
    return mm * ML_PER_MM;
}

/** Millilitres -> millimetres of depth. The reverse, for a value typed in mL. */
export function millilitresToMm(ml) {
    return ml / ML_PER_MM;
}

/**
 * A canonical millimetre reading -> the number to draw in `unit`.
 *
 * NON-FINITE IN, NON-FINITE OUT. An absent reading stays absent: this returns the value it
 * was given rather than a zero, so the dash the caller already draws for an unread tank
 * survives the conversion. A tank that has not reported and a tank that is empty are
 * different states, and 0 mL is a claim about the second.
 */
export function toDisplayLevel(mm, unit) {
    if (!Number.isFinite(mm)) return mm;
    return unit === TANK_UNIT.ML ? mmToMillilitres(mm) : mm;
}

/**
 * The reverse, for a value a person entered in the unit on screen.
 *
 * Nothing in this build writes a tank LEVEL — the machine measures it — but the low-water
 * ALERT is a millimetre threshold a person sets, and the day that row is offered in mL
 * this is the function that keeps the wire in millimetres. Written now, beside its pair,
 * because a conversion with only one direction is how the other direction gets invented at
 * a call site.
 */
export function fromDisplayLevel(shown, unit) {
    if (!Number.isFinite(shown)) return shown;
    return unit === TANK_UNIT.ML ? millilitresToMm(shown) : shown;
}

/**
 * How many decimals the drawn number carries.
 *
 * MILLILITRES ARE WHOLE AND MILLIMETRES ARE WHOLE. The machine reports depth as an
 * integer count of millimetres, and forty times an integer is an integer — so neither unit
 * has a fractional part to print, and a "40.0 mL" would be inventing a precision the
 * measurement does not have.
 */
export function tankDecimals() {
    return 0;
}
