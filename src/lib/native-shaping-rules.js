import { NATIVE_SHAPING_KEY, WIRE_STEPS_PER_UNIT, wireUnits } from './shot-model.js';

export const NATIVE_SHAPING_MODES = Object.freeze(['both', 'rise', 'fall']);

export const NATIVE_SHAPING_LIMITS = Object.freeze({
    version: 1,
    maxPoints: 8,
    fixedPoint: Object.freeze({ pressure: 0, flow: 20 }),
    pressure: Object.freeze({ min: 0.5, max: 13.5, rise: 0.5, step: 0.1 }),
    flow: Object.freeze({ min: 0, max: 20, step: 0.1 }),
    tau: Object.freeze({ min: 0, max: 5, step: 0.02 }),
    ramp: Object.freeze({ min: 0, max: 4, step: 0.02 }),
});

export const NATIVE_SHAPING_DEFAULTS = Object.freeze({
    version: 1,
    pump_curve: Object.freeze([]),
    flow_tau: 0,
    flow_mode: 'both',
    pressure_tau: 0,
    pressure_mode: 'both',
    ramp_factor: 1,
});

export const DEFAULT_PUMP_CURVE = Object.freeze([
    Object.freeze({ pressure: 1, flow: 20 }),
    Object.freeze({ pressure: 3, flow: 12 }),
    Object.freeze({ pressure: 6, flow: 6 }),
    Object.freeze({ pressure: 9, flow: 5 }),
    Object.freeze({ pressure: 12, flow: 4 }),
]);

export const NATIVE_SHAPING_RULE = Object.freeze({
    TYPE: 'type',
    NUMBER: 'number',
    RANGE: 'range',
    VERSION: 'version',
    COUNT: 'count',
    MODE: 'mode',
    PRESSURE_RISE: 'pressureRise',
    FLOW_RISE: 'flowRise',
});

const R = NATIVE_SHAPING_RULE;
const L = NATIVE_SHAPING_LIMITS;

function absent(value) {
    return value === undefined || value === null;
}

function toNumber(raw) {
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string' && raw.trim() !== '') return Number(raw);
    return Number.NaN;
}

function units(raw, field, perUnit, limits, errors, fallback) {
    if (absent(raw) && fallback !== undefined) return wireUnits(fallback, perUnit);
    const number = toNumber(raw);
    if (!Number.isFinite(number)) {
        errors.push({ field, rule: R.NUMBER });
        return null;
    }
    const u = wireUnits(number, perUnit);
    if (u < wireUnits(limits.min, perUnit) || u > wireUnits(limits.max, perUnit)) {
        errors.push({ field, rule: R.RANGE });
    }
    return u;
}

function mode(raw, field, errors) {
    if (absent(raw)) return 'both';
    if (NATIVE_SHAPING_MODES.includes(raw)) return raw;
    errors.push({ field, rule: R.MODE });
    return null;
}

export function checkNativeShaping(input) {
    const errors = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return { ok: false, block: null, errors: [{ field: NATIVE_SHAPING_KEY, rule: R.TYPE }] };
    }
    if (!absent(input.version) && input.version !== L.version) {
        errors.push({ field: 'version', rule: R.VERSION });
    }
    const rawCurve = absent(input.pump_curve) ? [] : input.pump_curve;
    const curve = [];
    if (!Array.isArray(rawCurve)) {
        errors.push({ field: 'pump_curve', rule: R.TYPE });
    } else if (rawCurve.length > L.maxPoints) {
        errors.push({ field: 'pump_curve', rule: R.COUNT });
    } else {
        const P = WIRE_STEPS_PER_UNIT.pressure;
        const Q = WIRE_STEPS_PER_UNIT.flow;
        const rise = wireUnits(L.pressure.rise, P);
        rawCurve.forEach((point, i) => {
            const at = `pump_curve[${i}]`;
            if (!point || typeof point !== 'object' || Array.isArray(point)) {
                errors.push({ field: at, rule: R.TYPE });
                curve.push(null);
                return;
            }
            const p = units(point.pressure, `${at}.pressure`, P, L.pressure, errors);
            const q = units(point.flow, `${at}.flow`, Q, L.flow, errors);
            const before = curve[i - 1];
            if (before && p !== null && before.p !== null && p < before.p + rise) {
                errors.push({ field: `${at}.pressure`, rule: R.PRESSURE_RISE });
            }
            if (before && q !== null && before.q !== null && q > before.q) {
                errors.push({ field: `${at}.flow`, rule: R.FLOW_RISE });
            }
            curve.push({ p, q });
        });
    }
    const T = WIRE_STEPS_PER_UNIT.tau;
    const D = NATIVE_SHAPING_DEFAULTS;
    const flowTau = units(input.flow_tau, 'flow_tau', T, L.tau, errors, D.flow_tau);
    const flowMode = mode(input.flow_mode, 'flow_mode', errors);
    const pressureTau = units(input.pressure_tau, 'pressure_tau', T, L.tau, errors, D.pressure_tau);
    const pressureMode = mode(input.pressure_mode, 'pressure_mode', errors);
    const ramp = units(input.ramp_factor, 'ramp_factor', WIRE_STEPS_PER_UNIT.ramp, L.ramp, errors, D.ramp_factor);
    if (errors.length) return { ok: false, block: null, errors };
    return {
        ok: true,
        errors,
        block: {
            version: L.version,
            pump_curve: curve.map(({ p, q }) => ({
                pressure: p / WIRE_STEPS_PER_UNIT.pressure,
                flow: q / WIRE_STEPS_PER_UNIT.flow,
            })),
            flow_tau: flowTau / T,
            flow_mode: flowMode,
            pressure_tau: pressureTau / T,
            pressure_mode: pressureMode,
            ramp_factor: ramp / WIRE_STEPS_PER_UNIT.ramp,
        },
    };
}

export function pointLimits(points, i) {
    const P = WIRE_STEPS_PER_UNIT.pressure;
    const prev = points[i - 1];
    const next = points[i + 1];
    return {
        pMin: prev ? (wireUnits(prev.pressure, P) + wireUnits(L.pressure.rise, P)) / P : L.pressure.min,
        pMax: next ? (wireUnits(next.pressure, P) - wireUnits(L.pressure.rise, P)) / P : L.pressure.max,
        qMin: next ? next.flow : L.flow.min,
        qMax: prev ? prev.flow : L.fixedPoint.flow,
    };
}

export function movePoint(points, i, pressure, flow) {
    const lim = pointLimits(points, i);
    const P = WIRE_STEPS_PER_UNIT.pressure;
    const Q = WIRE_STEPS_PER_UNIT.flow;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const out = points.map((pt) => ({ ...pt }));
    out[i] = {
        pressure: wireUnits(clamp(pressure, lim.pMin, lim.pMax), P) / P,
        flow: wireUnits(clamp(flow, lim.qMin, lim.qMax), Q) / Q,
    };
    return out;
}
