/**
 * The POWER PAGE's own logic: the derived-channel plot's channel list, the P–Q trajectory's points, and the correspondence marks that tie the trajectory back to the clock.
 */

import { indexAtTime } from './shot-derivation.js';
import { TICK_STEPS } from './chart-axis.js';
import { HEADROOM, niceCeil } from './chart-autoscale.js';

export const DERIVED_LEFT_CHANNELS = Object.freeze(['resistance', 'impedance']);

/**
 * Every channel the derived-channel plot draws. The two left channels ARE the list now;
 * the name is kept because the page and its suite address the plot by it.
 */
export const DERIVED_CHANNELS = DERIVED_LEFT_CHANNELS;

export const DERIVED_SCALES = Object.freeze({});

export const DERIVED_LOG_FLOOR = 0.05;
export const DERIVED_LOG_CEIL = 100;

export const DERIVED_LOG_PAD = 0.25;

export function derivedLeftRange({ a = null, b = null } = {}) {
    const positive = [];
    for (const derivation of [a, b]) {
        if (!derivation || derivation.ok !== true) continue;
        for (const key of DERIVED_LEFT_CHANNELS) {
            for (const value of derivation.series?.[key]?.y ?? []) {
                if (typeof value === 'number' && Number.isFinite(value) && value > 0) positive.push(value);
            }
        }
    }
    if (positive.length < 2) return [Math.log10(DERIVED_LOG_FLOOR), Math.log10(DERIVED_LOG_CEIL)];
    const lo = Math.max(DERIVED_LOG_FLOOR, Math.min(...positive));
    const hi = Math.min(DERIVED_LOG_CEIL, Math.max(...positive));
    return [
        Math.max(Math.log10(DERIVED_LOG_FLOOR), Math.log10(lo) - DERIVED_LOG_PAD),
        Math.min(Math.log10(DERIVED_LOG_CEIL), Math.log10(hi) + DERIVED_LOG_PAD),
    ];
}

export function toLog10(values) {
    return (values ?? []).map((v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.log10(v) : null));
}

/** Every record's y in log10, x untouched. The one place the transform is applied. */
export function logRecords(records) {
    const out = {};
    for (const [key, record] of Object.entries(records ?? {})) {
        out[key] = { ...record, y: toLog10(record?.y) };
    }
    return out;
}

export function formatLogTick(v) {
    const real = 10 ** v;
    if (real >= 10) return String(Math.round(real));
    if (real >= 1) return real.toFixed(1);
    return real.toFixed(2);
}

export function derivedTickValues([lo, hi]) {
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || !(hi > lo)) return [];
    const wide = hi - lo >= 2;
    const out = [];
    for (let decade = Math.floor(lo); decade <= Math.ceil(hi); decade += 1) {
        for (const step of wide ? [1] : [1, 2, 5]) {
            const v = decade + Math.log10(step);
            if (v >= lo && v <= hi) out.push(v);
        }
    }
    return out;
}

export const PQ_FLOW_MAX = 8;
export const PQ_PRESSURE_MAX = 12;

export function trajectoryFrame({ a = null, b = null } = {}) {
    let flow = 0;
    let pressure = 0;
    for (const derivation of [a, b]) {
        if (!derivation || derivation.ok !== true) continue;
        for (const [key, current] of [['flow', flow], ['pressure', pressure]]) {
            let max = current;
            for (const value of derivation.series?.[key]?.y ?? []) {
                if (typeof value === 'number' && Number.isFinite(value) && value > max) max = value;
            }
            if (key === 'flow') flow = max; else pressure = max;
        }
    }
    return Object.freeze({
        flowMax: Math.max(PQ_FLOW_MAX, niceCeil(flow * HEADROOM)),
        pressureMax: Math.max(PQ_PRESSURE_MAX, niceCeil(pressure * HEADROOM)),
    });
}

export const PQ_GAP_SECONDS = 0.75;

export const PQ_MARK_TARGET = 6;

export function derivedPresence(derivation) {
    const series = derivation && derivation.ok === true ? derivation.series : null;
    const out = {};
    let any = false;
    for (const key of DERIVED_CHANNELS) {
        const ys = series && series[key] ? series[key].y : null;
        const n = Array.isArray(ys) ? ys.reduce((acc, v) => acc + (typeof v === 'number' ? 1 : 0), 0) : 0;
        out[key] = n;
        if (n > 0) any = true;
    }
    return Object.freeze({ ...out, any });
}

/** True when the two derivations between them carry no derived reading at all. */
export function noDerivedChannels(a, b) {
    return !derivedPresence(a).any && !derivedPresence(b).any;
}

export function trajectoryPoints(derivation, { offset = 0 } = {}) {
    if (!derivation || derivation.ok !== true) return [];
    const t = derivation.axis && Array.isArray(derivation.axis.t) ? derivation.axis.t : [];
    const flow = derivation.series && derivation.series.flow;
    const pressure = derivation.series && derivation.series.pressure;
    if (!flow || !pressure) return [];
    if (flow.y.length !== t.length || pressure.y.length !== t.length) return [];

    const shift = Number.isFinite(offset) ? offset : 0;
    const points = [];
    let lastReal = null;
    for (let i = 0; i < t.length; i += 1) {
        const x = flow.y[i];
        const y = pressure.y[i];
        const seconds = t[i] + shift;
        const real = typeof x === 'number' && typeof y === 'number'
            && Number.isFinite(x) && Number.isFinite(y);
        if (real && lastReal !== null && seconds - lastReal > PQ_GAP_SECONDS) {
            points.push({ x: null, y: null, t: seconds });
        }
        points.push(real ? { x, y, t: seconds } : { x: null, y: null, t: seconds });
        lastReal = real ? seconds : null;
    }
    return points;
}

export function trajectorySpan({ a = null, b = null, offset = 0 } = {}) {
    let span = 0;
    for (const [derivation, shift] of [[a, 0], [b, Number.isFinite(offset) ? offset : 0]]) {
        if (!derivation || derivation.ok !== true) continue;
        const t = derivation.axis && Array.isArray(derivation.axis.t) ? derivation.axis.t : [];
        if (!t.length) continue;
        const end = t[t.length - 1] + shift;
        if (end > span) span = end;
    }
    return span;
}

export function correspondenceMarks({ a = null, b = null, offset = 0 } = {}) {
    const none = Object.freeze({ step: 0, marks: Object.freeze([]), links: Object.freeze([]) });
    const aPoints = trajectoryPoints(a);
    if (!aPoints.length) return none;
    const aT = aPoints.map((p) => p.t);
    const span = aT[aT.length - 1];
    if (!(span > 0)) return none;

    const raw = span / PQ_MARK_TARGET;
    const step = TICK_STEPS.find((s) => s >= raw) ?? TICK_STEPS[TICK_STEPS.length - 1];

    const shift = Number.isFinite(offset) ? offset : 0;
    const bPoints = trajectoryPoints(b, { offset: shift });
    const bT = bPoints.map((p) => p.t);

    const marks = [];
    const links = [];
    for (let t = step; t < span; t += step) {
        const ai = indexAtTime(aT, t);
        const aAt = ai >= 0 && aPoints[ai] && aPoints[ai].x !== null ? aPoints[ai] : null;
        let bAt = null;
        if (bT.length && t >= bT[0] && t <= bT[bT.length - 1]) {
            const bi = indexAtTime(bT, t);
            if (bi >= 0 && bPoints[bi] && bPoints[bi].x !== null) bAt = bPoints[bi];
        }
        if (!aAt && !bAt) continue;
        const mark = {
            t,
            label: `${t}s`,
            a: aAt ? { x: aAt.x, y: aAt.y } : null,
            b: bAt ? { x: bAt.x, y: bAt.y } : null,
        };
        marks.push(mark);
        if (mark.a && mark.b) links.push({ from: mark.a, to: mark.b });
    }
    return { step, marks, links };
}

export function rampColour(stops, u) {
    const list = Array.isArray(stops) ? stops.filter(Boolean) : [];
    if (!list.length) return null;
    if (list.length === 1) return list[0];
    const x = Number.isFinite(u) ? Math.min(1, Math.max(0, u)) : 0;
    const last = list.length - 1;
    const pos = x * last;
    const i = Math.min(last - 1, Math.floor(pos));
    const f = pos - i;
    const from = parseRgb(list[i]);
    const to = parseRgb(list[i + 1]);
    if (!from || !to) return list[f < 0.5 ? i : i + 1];
    const mix = (k) => Math.round(from[k] + (to[k] - from[k]) * f);
    return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
}

/** `#rrggbb` or `rgb(r, g, b)` as `[r, g, b]`, or null for anything else. */
function parseRgb(value) {
    const text = String(value ?? '').trim();
    const hex = /^#([0-9a-f]{6})$/i.exec(text);
    if (hex) {
        const n = parseInt(hex[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const rgb = /^rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)/i.exec(text);
    if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    return null;
}
