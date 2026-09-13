/**
 * The A/B comparison, as channel specs and records.
 */

import { ALIGNMENT_SLOT } from './alignment-offset.js';
import { SERIES_KEYS, shiftSeriesX } from './shot-derivation.js';
import { Y_FLOOR_EXPANDED } from './chart-autoscale.js';
import { comparisonStyle } from './chart-comparison-style.js';

export const COMPARISON_KEY_PREFIX = 'b:';

/** B's dash. A name in `chart-axis.js`'s one table, never a pattern spelled here. */
export const COMPARISON_DASH = 'dash';

export const COMPARISON_ALPHA = 0.72;

export const FLOW_TOP_CHANNELS = Object.freeze([
    'pressure', 'targetPressure', 'flow', 'targetFlow', 'weightFlow', 'power',
]);

export const FLOW_TEMP_CHANNELS = Object.freeze([
    'groupTemp', 'targetTemp', 'mixTemp', 'targetMixTemp',
]);

export const FLOW_PLOTS = Object.freeze([
    Object.freeze({
        id: 'top',
        label: 'Pressure and flow',
        channels: FLOW_TOP_CHANNELS,
        ratio: 1.209,
        expandedRatio: 1.403,
        yFloor: Y_FLOOR_EXPANDED,
    }),
    Object.freeze({
        id: 'temp',
        label: 'Temperature',
        channels: FLOW_TEMP_CHANNELS,
        ratio: 1,
        expandedRatio: 1,
        yPolicy: 'temp',
    }),
]);

export const DEFAULT_FLOW_PLOT = 'top';

/** `pressure` -> `b:pressure`. The one place the prefix is applied. */
export function comparisonKey(key) {
    return `${COMPARISON_KEY_PREFIX}${key}`;
}

/** True for a record key that belongs to the comparison shot. */
export function isComparisonKey(key) {
    return typeof key === 'string' && key.startsWith(COMPARISON_KEY_PREFIX);
}

function treatmentFor(treatments, key) {
    if (!treatments) return null;
    if (typeof treatments.get === 'function') return treatments.get(key) ?? null;
    if (Array.isArray(treatments)) return treatments.find((entry) => entry?.key === key) ?? null;
    return treatments[key] ?? null;
}

export function referenceSpecs(channels, treatments = null, { scales = null } = {}) {
    return channels.map((key) => {
        const treatment = treatmentFor(treatments, key);
        const spec = { key, minor: treatment?.minor === true, dash: treatment?.dash ?? null };
        const scale = scales ? scales[key] : null;
        if (scale) spec.scale = scale;
        return spec;
    });
}

export function abChannelSpecs(channels, {
    hasComparison = false, treatments = null, scales = null,
} = {}) {
    const a = referenceSpecs(channels, treatments, { scales });
    if (!hasComparison) return a;
    const styledA = a.map((spec) => ({ ...spec, ...comparisonStyle(spec.key, 'a') }));
    const b = a.map((spec) => ({
        ...spec,
        ...comparisonStyle(spec.key, 'b'),
        key: comparisonKey(spec.key),
    }));
    return [...styledA, ...b];
}

export function abRecords(channels, { a = null, b = null, offset = 0 } = {}) {
    const records = {};
    const aSeries = a && a.ok === true ? a.series : null;
    const bSeries = b && b.ok === true ? b.series : null;
    for (const key of channels) {
        if (aSeries && aSeries[key]) records[key] = aSeries[key];
        if (bSeries && bSeries[key]) {
            records[comparisonKey(key)] = shiftSeriesX(bSeries[key], offset);
        }
    }
    return records;
}

export function legendItems(channels, labels = {}, treatments = null) {
    return referenceSpecs(channels, treatments).map(({ key, minor, dash }) => ({
        key,
        label: labels[key] ?? key,
        minor,
        dash,
    }));
}

/**
 * Which slot a record key belongs to. Exported for the suite, which asserts the two sets
 * partition the plot's series exactly.
 */
export function slotOfKey(key) {
    return isComparisonKey(key) ? ALIGNMENT_SLOT.MOVING : ALIGNMENT_SLOT.REFERENCE;
}

/** Every derivation key this module may be asked for. A guard, not a list to iterate. */
export const KNOWN_SERIES_KEYS = SERIES_KEYS;
