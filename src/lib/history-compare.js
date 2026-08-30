/**
 * Two shots on one clock.
 */

import { bridgeUnspoken } from './chart-align.js';
import { shiftSeriesX } from './shot-derivation.js';

/** An empty column is answered with this, so a caller never has to test for null. */
const EMPTY = Object.freeze([]);

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/* ───────────────────────────────────────────────────────────── the resampler */

export function resampleOnto(axis, srcX, srcY) {
    const wanted = Array.isArray(axis) ? axis : EMPTY;
    if (!wanted.length) return [];
    const xs = Array.isArray(srcX) ? srcX : EMPTY;
    const ys = Array.isArray(srcY) ? srcY : EMPTY;
    if (!xs.length) return new Array(wanted.length).fill(null);

    /* The clock the bridge runs on: every wanted instant plus every instant the channel
     * spoke at, so no reading is dropped for want of a slot to sit in. */
    const merged = new Set(wanted);
    let offGrid = false;
    for (const at of xs) {
        if (!merged.has(at)) { merged.add(at); offGrid = true; }
    }
    const clock = offGrid ? [...merged].sort((a, b) => a - b) : wanted;

    const index = new Map();
    for (let i = 0; i < clock.length; i += 1) index.set(clock[i], i);

    const column = new Array(clock.length).fill(null);
    /* Which slots the channel SPOKE ABOUT — including the ones it spoke about by saying
     * null. That distinction is the whole policy and it is why `spoken` is a second
     * array rather than a test on the value. */
    const spoken = new Array(clock.length).fill(false);
    for (let i = 0; i < xs.length && i < ys.length; i += 1) {
        const at = index.get(xs[i]);
        if (at === undefined) continue;
        column[at] = isNumber(ys[i]) ? ys[i] : null;
        spoken[at] = true;
    }

    bridgeUnspoken(clock, column, spoken);
    if (!offGrid) return column;
    return wanted.map((at) => {
        const found = index.get(at);
        return found === undefined ? null : column[found];
    });
}

/* ───────────────────────────────────────────────────────── the union clock */

/**
 * Every instant any of these bundles spoke at, once, ascending.
 *
 * @param {Array<{x: number[]}|null|undefined>} bundles
 * @returns {number[]}
 */
export function unionClock(bundles) {
    const union = new Set();
    for (const bundle of bundles ?? EMPTY) {
        if (!bundle || !Array.isArray(bundle.x)) continue;
        for (const at of bundle.x) if (isNumber(at)) union.add(at);
    }
    return [...union].sort((a, b) => a - b);
}

export function compareOnOneClock({ channels = EMPTY, a = null, b = null, offset = 0 } = {}) {
    const aSeries = a && a.ok === true ? a.series : null;
    const bSeries = b && b.ok === true ? b.series : null;
    const shift = Number.isFinite(offset) ? offset : 0;

    const bundles = [];
    const sources = [];
    for (const key of channels) {
        const fromA = aSeries?.[key] ?? null;
        const fromB = bSeries?.[key] ? shiftSeriesX(bSeries[key], shift) : null;
        if (fromA) bundles.push(fromA);
        if (fromB) bundles.push(fromB);
        sources.push({ key, a: fromA, b: fromB });
    }

    const axis = unionClock(bundles);
    const columns = {};
    const bColumns = {};
    for (const source of sources) {
        if (source.a) columns[source.key] = resampleOnto(axis, source.a.x, source.a.y);
        if (source.b) bColumns[source.key] = resampleOnto(axis, source.b.x, source.b.y);
    }
    return {
        axis,
        columns,
        keys: sources.filter((s) => s.a || s.b).map((s) => s.key),
        slots: { a: columns, b: bColumns },
    };
}

export function comparisonWindow(compared) {
    const axis = compared?.axis ?? EMPTY;
    const columns = compared?.columns ?? {};
    const bColumns = compared?.slots?.b ?? {};
    let min = null;
    let max = null;
    for (let i = 0; i < axis.length; i += 1) {
        let drawn = false;
        for (const column of Object.values(columns)) {
            if (isNumber(column[i])) { drawn = true; break; }
        }
        if (!drawn) {
            for (const column of Object.values(bColumns)) {
                if (isNumber(column[i])) { drawn = true; break; }
            }
        }
        if (!drawn) continue;
        if (min === null) min = axis[i];
        max = axis[i];
    }
    if (min === null) return { min: 0, max: 0, span: 0, empty: true };
    return { min, max, span: max - min, empty: false };
}

/* ─────────────────────────────────────────────────── the step boundaries */

export function comparisonStepRules({ a = null, b = null, offset = 0, paint = {} } = {}) {
    const { colour, ink, width, dash, alpha } = paint;
    const shift = Number.isFinite(offset) ? offset : 0;
    const vertical = [];
    const labels = [];

    const add = (derivation, at, style) => {
        if (!derivation || derivation.ok !== true) return;
        for (const mark of derivation.stepMarks ?? EMPTY) {
            if (!isNumber(mark?.t)) continue;
            vertical.push({ x: mark.t + at, color: colour, width, ...style });
            if (style.reference && mark.name) labels.push({ x: mark.t, text: mark.name, color: ink });
        }
    };

    add(a, 0, { reference: true });
    add(b, shift, { dash, alpha });

    /* `reference` is this function's own bookkeeping and is not part of `setRules`'s
     * shape, so it does not travel to the plot. */
    for (const rule of vertical) delete rule.reference;
    return { vertical, labels };
}
