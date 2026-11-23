import {
    MODEL_HZ, directionOn, emaSpeed, hyperbolic, makePumpCurve, pumpCeiling,
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
    const { from, to, back } = shape;
    const dt = 1 / 60;
    const t = [];
    const raw = [];
    const shaped = [];
    let seed = from;
    const count = Math.round(5.5 / dt);
    for (let i = 0; i <= count; i++) {
        const at = -0.5 + i * dt;
        let r;
        let v;
        if (at < 0) {
            r = from;
            v = from;
        } else if (at < 2.5) {
            r = to;
            v = tau > 0 && directionOn(mode, from, to) ? hyperbolic(from, to, tau, at) : to;
            seed = v;
        } else {
            r = back;
            v = tau > 0 && directionOn(mode, seed, back) && Math.abs(seed - back) > 1e-6
                ? hyperbolic(seed, back, tau, at - 2.5) : back;
            if (kind === 'flow' && back === 0 && v < 0.05) v = 0;
        }
        t.push(at);
        raw.push(r);
        shaped.push(v);
    }
    return { t, raw, shaped };
}

export function rampResponse(rampFactor, tau) {
    const t = [];
    const raw = [];
    const shaped = [];
    const lag = rampFactor * tau;
    let ema = 2;
    const count = Math.round(6.5 * MODEL_HZ);
    for (let i = 0; i <= count; i++) {
        const at = -0.5 + i / MODEL_HZ;
        const u = at < 0 ? 2 : 2 + 7 * Math.min(at / 4, 1);
        let v;
        if (at < 0) {
            v = 2;
        } else if (lag > 0) {
            ema += (u - ema) * emaSpeed(lag);
            v = ema;
        } else {
            v = u;
        }
        if (i % 2 === 0) {
            t.push(at);
            raw.push(u);
            shaped.push(v);
        }
    }
    return { t, raw, shaped };
}
