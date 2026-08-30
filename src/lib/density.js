/**
 * C6, the preference half.
 */

/** The LOGICAL storage key. The router owns the layer and the prefix (B7). */
export const DENSITY_KEY = 'density';

/** The two custom properties C6 writes. Declared in `styles/tokens.css`. */
export const DENSITY_BASE_PROPERTY = '--ui-density-base';
export const TYPE_SCALE_PROPERTY = '--ui-type-scale';

export const DENSITY_STEPS = Object.freeze([
    Object.freeze({ value: 'small', label: 'Small', factor: 0.9 }),
    Object.freeze({ value: 'fit-screen', label: 'Fit screen', factor: 1 }),
    Object.freeze({ value: 'larger', label: 'Larger', factor: 1.1 }),
    Object.freeze({ value: 'largest', label: 'Largest', factor: 1.2 }),
]);

/** The step a machine with no stored choice renders at. The ladder's identity element. */
export const DEFAULT_DENSITY_STEP = 'fit-screen';

/** Every step value, for a bank's items and for the totality test. */
export const DENSITY_VALUES = Object.freeze(DENSITY_STEPS.map((step) => step.value));

export function normaliseDensity(value) {
    if (typeof value !== 'string') return null;
    return DENSITY_STEPS.find((step) => step.value === value) ?? null;
}

/** The factor for a step value; the default step's factor for anything else. */
export function densityFactor(value) {
    const step = normaliseDensity(value) ?? normaliseDensity(DEFAULT_DENSITY_STEP);
    return step.factor;
}

export function applyDensity(root, value) {
    const factor = densityFactor(value);
    if (root && root.style && typeof root.style.setProperty === 'function') {
        root.style.setProperty(DENSITY_BASE_PROPERTY, String(factor));
        root.style.setProperty(TYPE_SCALE_PROPERTY, String(factor));
    }
    return factor;
}

export function clearDensity(root) {
    if (root && root.style && typeof root.style.removeProperty === 'function') {
        root.style.removeProperty(DENSITY_BASE_PROPERTY);
        root.style.removeProperty(TYPE_SCALE_PROPERTY);
    }
}
