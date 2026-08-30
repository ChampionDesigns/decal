

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
