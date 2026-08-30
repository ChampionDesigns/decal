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

export const ML_PER_MM = 40;

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

export function toDisplayLevel(mm, unit) {
    if (!Number.isFinite(mm)) return mm;
    return unit === TANK_UNIT.ML ? mmToMillilitres(mm) : mm;
}

export function fromDisplayLevel(shown, unit) {
    if (!Number.isFinite(shown)) return shown;
    return unit === TANK_UNIT.ML ? millilitresToMm(shown) : shown;
}

export function tankDecimals() {
    return 0;
}
