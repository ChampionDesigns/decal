export const MODEL_HZ = 120;

const DT = 1 / MODEL_HZ;
const TAU_PUMP = 0.15;
const TAU_CTL = 0.25;
const MAX_FLOW = 20;
const RECORD_EVERY = 12;
const SHAPING_MODES = Object.freeze(['both', 'rise', 'fall']);

export const NATIVE_SHAPING_KEY = 'native_shaping';

export const FIRMWARE_DEFAULT_SETTINGS = Object.freeze({
    curve: null,
    fTau: 0,
    fMode: 'both',
    pTau: 0,
    pMode: 'both',
    rFac: 1,
});

export const WIRE_STEPS_PER_UNIT = Object.freeze({ tau: 50, ramp: 50, pressure: 10, flow: 10 });

function compliance(P) {
    const p = Math.max(P, 0);
    return 0.0996 + 6.953 / ((p + 1) * (p + 1));
}

function pressureCeiling(cmd, P) {
    if (!(P < 13.5)) return 0;
    const band = Math.max(1, cmd / 2.5);
    const on = 13.5 - band;
    return P <= on ? cmd : cmd * (1 - Math.min((P - on) / band, 1));
}

export function pumpCeiling(P) {
    return pressureCeiling(MAX_FLOW, P);
}

export function makePumpCurve(points) {
    if (!points || !points.length) return null;
    const xs = [0];
    const ys = [20];
    for (const [p, q] of points) {
        xs.push(p);
        ys.push(q);
    }
    const n = xs.length - 1;
    const h = [];
    const s = [];
    const d = [];
    for (let i = 0; i < n; i++) {
        h[i] = xs[i + 1] - xs[i];
        s[i] = (ys[i + 1] - ys[i]) / h[i];
    }
    d[0] = 0;
    d[n] = 0;
    for (let i = 1; i < n; i++) {
        if (s[i - 1] * s[i] <= 0) {
            d[i] = 0;
        } else {
            const w1 = 2 * h[i] + h[i - 1];
            const w2 = h[i] + 2 * h[i - 1];
            d[i] = (w1 + w2) / (w1 / s[i - 1] + w2 / s[i]);
        }
    }
    return (P) => {
        if (!(P > 0)) return 20;
        if (P >= xs[n]) return ys[n];
        let k = 0;
        while (xs[k + 1] <= P) k++;
        const u = (P - xs[k]) / h[k];
        const u2 = u * u;
        const u3 = u2 * u;
        return (2 * u3 - 3 * u2 + 1) * ys[k] + (u3 - 2 * u2 + u) * h[k] * d[k]
            + (-2 * u3 + 3 * u2) * ys[k + 1] + (u3 - u2) * h[k] * d[k + 1];
    };
}

export function directionOn(mode, a, b) {
    return mode === 'both' || (mode === 'rise' && b > a) || (mode === 'fall' && b < a);
}

export function hyperbolic(a, b, tau, t) {
    const x = 1 + t / tau;
    return b + (a - b) / (x * x);
}

export function emaSpeed(tau) {
    return 1 - Math.exp(-1 / (MODEL_HZ * tau));
}

function fillShape(pk, V) {
    const a = pk.V_fill - pk.w;
    const b = pk.V_fill + pk.w;
    if (V <= a) return 0;
    if (V >= b) return 1;
    const x = (V - a) / (b - a);
    return x * x * (3 - 2 * x);
}

function resistanceAt(pk, V) {
    const a = pk.V_fill - pk.w;
    const b = pk.V_fill + pk.w;
    if (V <= a) return pk.R_fill;
    if (V >= b) return pk.R_end;
    const x = (V - a) / (b - a);
    const s = x * x * (3 - 2 * x);
    return Math.exp(Math.log(pk.R_fill) + s * (Math.log(pk.R_end) - Math.log(pk.R_fill)));
}

function effectiveResistance(pk, V, u) {
    return resistanceAt(pk, V) * (1 + (pk.m - 1) * u * fillShape(pk, V));
}

function puckFlow(pk, V, P, u) {
    return P <= 0 ? 0 : P / effectiveResistance(pk, V, u);
}

function settle(pk, u, q, qp, h) {
    const qin = q + Math.max(0, qp - q);
    const next = u + h * ((1 - u) / pk.ts - u * qin / pk.Vo);
    return next < 0 ? 0 : next > 1 ? 1 : next;
}

function stepLimits(step) {
    return step.L > 0 && step.R > 0 ? [step.L, step.R] : [12, 12];
}

function softKnee(d, L, R) {
    let o;
    if (R <= 0.01) o = Math.min(d, L);
    else if (d <= L) o = d;
    else if (d < L + 2 * R) o = d - (d - L) * (d - L) / (4 * R);
    else o = L + R;
    return Math.max(0, Math.min(o, MAX_FLOW, R > 0.01 ? L + R : L));
}

function cupWeight(pk, V) {
    return 0.996 * Math.max(0, V - pk.V_hold);
}

function r3(v) {
    return Math.round(v * 1000) / 1000;
}

export function runShotModel(steps, settings, puck, options) {
    const opt = options || {};
    const set = settings || {};
    const g = opt.grind || 1;
    const stopW = opt.stopW || 0;
    const tMax = opt.tMax || 120;
    const pk = {
        V_fill: puck.V_fill,
        w: puck.w,
        R_fill: puck.R_fill * g,
        R_end: puck.R_end * g,
        m: puck.m,
        ts: puck.ts,
        Vo: puck.Vo,
        V_hold: puck.V_hold,
    };
    let u = 0;
    const curve = makePumpCurve(set.curve);
    const fTau = set.fTau || 0;
    const pTau = set.pTau || 0;
    const rFac = set.rFac === undefined ? 1 : set.rFac;
    const fMode = set.fMode || 'both';
    const pMode = set.pMode || 'both';
    const nS = steps.length;
    const h = DT / 4;
    const lagA = 1 - Math.exp(-DT / 0.1);
    let P = 0;
    let V = 0;
    let Qp = 0;
    let t = 0;
    let n = 0;
    let k = -1;
    let fr = null;
    let tF = 0;
    let fVol = 0;
    let Lr = [12, 12];
    const prevPump = steps[0].pump;
    let lastReq = 0;
    let fSeed = 0;
    let pSeed = 0;
    let ema = 0;
    let rampStart = 0;
    const lim = { seeded: false, f: 0, pf: null };
    const out = { t: [], P: [], Q: [], W: [], tQ: [], tP: [], k: [] };
    const frames = [];
    let end = null;
    let tq = null;
    let tp = null;

    function record() {
        out.t.push(r3(t));
        out.P.push(r3(P));
        out.Q.push(r3(Qp));
        out.W.push(r3(cupWeight(pk, V)));
        out.k.push(k);
        out.tQ.push(tq === null ? null : r3(tq));
        out.tP.push(tp === null ? null : r3(tp));
    }

    function close(why) {
        const f = frames[frames.length - 1];
        f.t1 = t;
        f.exit = why;
    }

    function enter(next) {
        const prev = k >= 0 ? steps[k].pump : prevPump;
        k = next;
        fr = steps[k];
        tF = 0;
        fVol = 0;
        Lr = stepLimits(fr);
        fSeed = lastReq > 0 && prev === 'flow' ? lastReq : Qp;
        pSeed = P;
        ema = fr.pump === 'flow' ? fSeed : pSeed;
        rampStart = fr.pump === 'flow' ? fSeed : Math.max(pSeed, 0.01);
        if (fr.pump === 'pressure') lim.seeded = false;
        frames.push({ k, name: fr.name, t0: t, t1: null, exit: '' });
    }

    enter(0);
    record();
    for (;;) {
        const Re = effectiveResistance(pk, V, u);
        const R = Re * Re / Math.max(P, 0.5);
        const frac = fr.sec > 0 ? Math.min(tF / fr.sec, 1) : 1;
        const b = fr.v;
        let x;
        let cmd;
        tq = null;
        tp = null;
        if (fr.pump === 'flow') {
            if (fr.smooth) {
                const ramp = rampStart + (b - rampStart) * frac;
                const tr = rFac * fTau;
                if (tr > 0 && directionOn(fMode, rampStart, b)) {
                    ema += (ramp - ema) * emaSpeed(tr);
                    x = ema;
                    if (b === 0 && x < 0.05) x = 0;
                } else {
                    x = ramp;
                }
            } else if (fTau > 0 && directionOn(fMode, fSeed, b) && Math.abs(fSeed - b) > 1e-6) {
                x = hyperbolic(fSeed, b, fTau, tF);
                if (b === 0 && x < 0.05) x = 0;
            } else {
                x = b;
            }
            const req = Math.min(Math.max(x, 0), MAX_FLOW);
            tq = req;
            lastReq = req;
            if (req === 0) {
                cmd = 0;
            } else {
                const r = Math.max(Lr[1], 0.01);
                const sl = 0.75 * req / r;
                const g1 = Math.min(1.0, sl);
                const g2 = Math.min(2.5, sl);
                const zeroAt = Lr[0] + r;
                const fT = 0.97 / Math.sqrt(Math.max(0.08, R));
                if (!lim.seeded) {
                    lim.f = fT;
                    lim.seeded = true;
                } else {
                    lim.f += (fT - lim.f) * lagA;
                }
                const q8 = Math.min(req, 8);
                const a2 = q8 / r;
                const kk = lim.f;
                const sR = (-kk + Math.sqrt(kk * kk + 4 * a2 * q8 * (1 + Lr[0] / r))) / (2 * a2);
                let cap = Math.min(Math.max(sR * sR, Lr[0]), Lr[0] + r);
                cap = Math.min(cap, Lr[0] + 0.5 * r);
                const hold = lim.f * Math.sqrt(Math.max(cap, 0));
                const e = cap - P;
                const corr = g1 * e + (g2 - g1) * (e > 0 ? 1 : e < 0 ? -1 : 0) * Math.max(0, Math.abs(e) - 0.1);
                cmd = Math.max(0, Math.min(hold + corr, req));
                if (P >= zeroAt) cmd = 0;
            }
        } else {
            lastReq = 0;
            if (fr.smooth) {
                const ramp = rampStart + (b - rampStart) * frac;
                const tr = rFac * pTau;
                if (tr > 0 && directionOn(pMode, rampStart, b)) {
                    ema += (ramp - ema) * emaSpeed(tr);
                    x = ema;
                } else {
                    x = ramp;
                }
            } else if (b === 0) {
                x = 0;
            } else if (pTau > 0 && directionOn(pMode, pSeed, b) && Math.abs(pSeed - b) > 1e-6) {
                x = hyperbolic(pSeed, b, pTau, tF);
            } else {
                x = b;
            }
            tp = x;
            cmd = softKnee(puckFlow(pk, V, P, u) + compliance(P) * (tp - P) / TAU_CTL, Lr[0], Lr[1]);
            if (tp > 0.1) {
                const pm = lim.pf === null ? P : lim.pf;
                const rt = Math.min(pm / tp, 1);
                cmd = Math.min(cmd, Lr[0] + Lr[1] * (1 - rt * rt * rt * rt));
            }
        }
        if (curve) {
            const cv = curve(P);
            if (cv < cmd) cmd = cv;
        }
        lim.pf = lim.pf === null ? P : lim.pf + (P - lim.pf) * lagA;
        cmd = pressureCeiling(cmd, P);
        Qp += (cmd - Qp) * (1 - Math.exp(-DT / TAU_PUMP));
        for (let i = 0; i < 4; i++) {
            const qo = puckFlow(pk, V, P, u);
            u = settle(pk, u, qo, Qp, h);
            P += (Qp - qo) * h / compliance(P);
            if (P < 0) P = 0;
            V += qo * h;
        }
        fVol += Qp * DT;
        t += DT;
        tF += DT;
        n++;
        const w = cupWeight(pk, V);
        let why = null;
        if (n % RECORD_EVERY === 0) record();
        if (fr.exit) {
            const mv = fr.exit.type === 'pressure' ? P : Qp;
            if (fr.exit.cond === 'over' ? mv > fr.exit.v : mv < fr.exit.v) why = 'exit';
        }
        if (!why && fr.wt > 0 && w >= fr.wt) why = 'weight';
        if (!why && fr.vol > 0 && fVol >= fr.vol) why = 'volume';
        if (!why && tF >= fr.sec - 1e-9) why = 'time';
        if (stopW > 0 && w >= stopW) {
            close('stop');
            end = { t, why: 'stop' };
            break;
        }
        if (why) {
            close(why);
            if (k + 1 < nS) {
                enter(k + 1);
            } else {
                end = { t, why: 'end' };
                break;
            }
        }
        if (t >= tMax) {
            close('limit');
            end = { t, why: 'limit' };
            break;
        }
    }
    if (n % RECORD_EVERY !== 0) record();
    return { out, frames, end, W: cupWeight(pk, V), steps: n };
}

export function wireUnits(value, perUnit) {
    return Math.floor(value * perUnit + 0.5 + 1e-9);
}

function onWireStep(value, perUnit) {
    return wireUnits(value, perUnit) / perUnit;
}

function finiteOr(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function modeOr(value, fallback) {
    return SHAPING_MODES.includes(value) ? value : fallback;
}

export function settingsFromNativeShaping(block) {
    const d = FIRMWARE_DEFAULT_SETTINGS;
    if (!block || typeof block !== 'object' || Array.isArray(block)) return { ...d };
    const points = Array.isArray(block.pump_curve) ? block.pump_curve : [];
    const curve = points
        .filter((pt) => pt && Number.isFinite(pt.pressure) && Number.isFinite(pt.flow))
        .map((pt) => [onWireStep(pt.pressure, WIRE_STEPS_PER_UNIT.pressure), onWireStep(pt.flow, WIRE_STEPS_PER_UNIT.flow)]);
    return {
        curve: curve.length ? curve : null,
        fTau: onWireStep(finiteOr(block.flow_tau, d.fTau), WIRE_STEPS_PER_UNIT.tau),
        fMode: modeOr(block.flow_mode, d.fMode),
        pTau: onWireStep(finiteOr(block.pressure_tau, d.pTau), WIRE_STEPS_PER_UNIT.tau),
        pMode: modeOr(block.pressure_mode, d.pMode),
        rFac: onWireStep(finiteOr(block.ramp_factor, d.rFac), WIRE_STEPS_PER_UNIT.ramp),
    };
}

const MODELLED_PUMPS = Object.freeze(['flow', 'pressure']);
const MODELLED_TRANSITIONS = Object.freeze(['fast', 'smooth']);

function modelStep(step) {
    if (!step || typeof step !== 'object') return null;
    if (!MODELLED_PUMPS.includes(step.pump)) return null;
    if (!MODELLED_TRANSITIONS.includes(step.transition ?? 'fast')) return null;
    const target = step.pump === 'flow' ? step.flow : step.pressure;
    if (!Number.isFinite(target)) return null;
    const exit = step.exit && typeof step.exit === 'object'
        && Number.isFinite(step.exit.value) && (step.exit.type === 'pressure' || step.exit.type === 'flow')
        ? { type: step.exit.type, cond: step.exit.condition === 'under' ? 'under' : 'over', v: step.exit.value }
        : null;
    const limiter = step.limiter && typeof step.limiter === 'object' ? step.limiter : null;
    return {
        name: typeof step.name === 'string' ? step.name : '',
        pump: step.pump,
        v: target,
        smooth: step.transition === 'smooth',
        sec: finiteOr(step.seconds, 0),
        exit,
        vol: finiteOr(step.volume, 0),
        wt: finiteOr(step.weight, 0),
        L: finiteOr(limiter?.value, 0),
        R: finiteOr(limiter?.range, 0),
    };
}

export function stepsFromProfile(profile) {
    const steps = profile && Array.isArray(profile.steps) ? profile.steps : null;
    if (!steps || !steps.length) return null;
    const out = steps.map(modelStep);
    return out.every(Boolean) ? out : null;
}
