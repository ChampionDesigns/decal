import {
    MODEL_HZ, makePumpCurve, pumpCeiling, rampFromFactor, rampStart, shapedGoal,
} from './shot-model.js';

export const CURVE_AXES = Object.freeze({ pressureMax: 14, flowMax: 21 });

export const BENGLE_PUMP_END = 13.5;

export const DE1_240V_CURVE = Object.freeze([
    [0.0, 10.66], [0.3, 10.325], [0.6, 10.008], [0.9, 9.776], [1.2, 9.483], [1.5, 9.205],
    [1.8, 8.936], [2.1, 8.658], [2.4, 8.452], [2.7, 8.186], [3.0, 7.935], [3.3, 7.688],
    [3.6, 7.468], [3.9, 7.226], [4.2, 6.975], [4.5, 6.756], [4.8, 6.523], [5.1, 6.305],
    [5.4, 6.07], [5.7, 5.867], [6.0, 5.632], [6.3, 5.422], [6.6, 5.218], [6.9, 5.004],
    [7.2, 4.802], [7.5, 4.586], [7.8, 4.379], [8.1, 4.192], [8.4, 3.982], [8.7, 3.77],
    [9.0, 3.599], [9.3, 3.404], [9.6, 3.199], [9.9, 3.032], [10.2, 2.833], [10.5, 2.64],
    [10.8, 2.48], [11.1, 2.304], [11.4, 2.115], [11.7, 1.931], [12.0, 1.788],
].map((pair) => Object.freeze(pair)));

const LINE_STEP_BAR = 0.5;
const CURVE_STEP_BAR = 0.05;

export function benglePumpLine() {
    const n = Math.round(BENGLE_PUMP_END / LINE_STEP_BAR);
    const all = [];
    for (let i = 0; i <= n; i++) {
        const P = i * LINE_STEP_BAR;
        all.push([P, pumpCeiling(P)]);
    }
    return all.filter((pt, i) => {
        if (i === 0 || i === all.length - 1) return true;
        const [a, b] = [all[i - 1], all[i + 1]];
        const cross = (pt[0] - a[0]) * (b[1] - a[1]) - (pt[1] - a[1]) * (b[0] - a[0]);
        return Math.abs(cross) > 1e-9;
    });
}

export function pumpCurveLine(points) {
    const pairs = Array.isArray(points) ? points.map((pt) => [pt.pressure, pt.flow]) : [];
    const curve = makePumpCurve(pairs);
    if (!curve) return [];
    const out = [];
    const n = Math.round(CURVE_AXES.pressureMax / CURVE_STEP_BAR);
    for (let i = 0; i <= n; i++) {
        const P = i * CURVE_STEP_BAR;
        out.push([P, curve(P)]);
    }
    return out;
}

const STEP_SHAPES = Object.freeze({
    flow: Object.freeze({ from: 2, to: 8, back: 0 }),
    pressure: Object.freeze({ from: 1.5, to: 6, back: 3 }),
});

export function stepResponse(kind, tau, mode) {
    const shape = STEP_SHAPES[kind] ?? STEP_SHAPES.pressure;
    const pump = kind === 'flow' ? 'flow' : 'pressure';
    const { from, to, back } = shape;
    const rise = Math.round(0.5 * MODEL_HZ);
    const fall = Math.round(3 * MODEL_HZ);
    const count = Math.round(5.5 * MODEL_HZ);
    const t = [];
    const raw = [];
    const shaped = [];
    let goal = null;
    let v = from;
    for (let i = 0; i <= count; i++) {
        let r = from;
        if (i === rise) goal = shapedGoal({ pump, smooth: false, seed: from, target: to, tau, mode });
        if (i === fall) goal = shapedGoal({ pump, smooth: false, seed: v, target: back, tau, mode });
        if (i >= fall) r = back;
        else if (i >= rise) r = to;
        v = goal ? goal(r) : from;
        if (i % 2 === 0) {
            t.push(-0.5 + i / MODEL_HZ);
            raw.push(r);
            shaped.push(v);
        }
    }
    return { t, raw, shaped };
}

export function rampResponse(rampFactor, tau, mode = 'both') {
    const seed = 2;
    const target = 9;
    const begin = Math.round(0.5 * MODEL_HZ);
    const width = 4 * MODEL_HZ;
    const count = Math.round(6.5 * MODEL_HZ);
    const from = rampStart('pressure', seed);
    const goal = shapedGoal({
        pump: 'pressure', smooth: true, seed, target, tau: rampFromFactor(rampFactor, tau), mode,
    });
    const t = [];
    const raw = [];
    const shaped = [];
    for (let i = 0; i <= count; i++) {
        const n = i - begin;
        const u = n < 0 ? seed : from + (target - from) * Math.min(n / width, 1);
        const v = n < 0 ? seed : goal(u);
        if (i % 2 === 0) {
            t.push(-0.5 + i / MODEL_HZ);
            raw.push(u);
            shaped.push(v);
        }
    }
    return { t, raw, shaped };
}
