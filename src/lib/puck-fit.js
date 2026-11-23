import { runShotModel } from './shot-model.js';
import { de1EmulationOf, shotRanAsDe1 } from './de1-emulation.js';

export const PUCK_SPEC = Object.freeze([
    Object.freeze({ key: 'R_fill', log: true, lo: 2e-4, hi: 0.2, step: 0.3 }),
    Object.freeze({ key: 'V_fill', log: false, lo: 0, hi: 80, step: 1.5 }),
    Object.freeze({ key: 'w', log: false, lo: 0.2, hi: 20, step: 2 }),
    Object.freeze({ key: 'R_end', log: true, lo: 0.01, hi: 50, step: 0.3 }),
    Object.freeze({ key: 'm', log: true, lo: 1, hi: 200, step: 0.3 }),
    Object.freeze({ key: 'ts', log: true, lo: 0.2, hi: 60, step: 0.3 }),
    Object.freeze({ key: 'Vo', log: true, lo: 0.05, hi: 50, step: 0.3 }),
    Object.freeze({ key: 'V_hold', log: false, lo: 0, hi: 80, step: 1.5 }),
]);

export const DEFAULT_START_PUCK = Object.freeze({
    R_fill: 0.0902,
    V_fill: 24.16,
    w: 11.19,
    R_end: 0.8995,
    m: 61.96,
    ts: 3.247,
    Vo: 0.1544,
    V_hold: 26.83,
});

export const FIT_STOP = Object.freeze({
    maxIterations: 1500,
    window: 100,
    relativeChange: 0.0005,
    maxRestarts: 8,
    restartGain: 0.01,
});

const SAMPLE_TOLERANCE_S = 0.06;
const MISSED_STOP_COST = 1e3;

function nearestValue(out, key, t) {
    const a = out.t;
    const n = a.length;
    if (!n || t < a[0] - SAMPLE_TOLERANCE_S || t > a[n - 1] + SAMPLE_TOLERANCE_S) return null;
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (a[m] < t) lo = m;
        else hi = m;
    }
    const i = Math.abs(a[lo] - t) <= Math.abs(a[hi] - t) ? lo : hi;
    return out[key][i];
}

function frameChanges(t, frame) {
    const changes = [];
    for (let i = 1; i < t.length; i++) if (frame[i] !== frame[i - 1]) changes.push(t[i]);
    return changes;
}

export function checkPuck(puck, { shot, steps, settings, targetWeight }) {
    const run = runShotModel(steps, settings, puck, { grind: 1, stopW: targetWeight, tMax: 120 });
    const frames = run.frames;
    const mainFrame = shot.frame.length ? shot.frame[shot.frame.length - 1] : 0;
    const firstMain = shot.frame.indexOf(mainFrame);
    const shotStart = firstMain > 0 ? shot.t[firstMain] : 0;
    const modelFrame = frames.find((f) => f.k === mainFrame);
    const modelStart = modelFrame ? modelFrame.t0 : null;
    let s = 0;
    let n = 0;
    let s2 = 0;
    let n2 = 0;
    let sw = 0;
    let nw = 0;
    for (let i = 0; i < shot.t.length; i++) {
        let v = nearestValue(run.out, 'P', shot.t[i]);
        if (v !== null) {
            s2 += (v - shot.P[i]) ** 2;
            n2++;
        }
        v = shot.W[i] === null ? null : nearestValue(run.out, 'W', shot.t[i]);
        if (v !== null) {
            sw += (v - shot.W[i]) ** 2;
            nw++;
        }
        if (modelStart !== null && shot.frame[i] === mainFrame) {
            v = nearestValue(run.out, 'P', shot.t[i] - shotStart + modelStart);
            if (v !== null) {
                s += (v - shot.P[i]) ** 2;
                n++;
            }
        }
    }
    return {
        time: run.end.t,
        why: run.end.why,
        rmsAll: n2 ? Math.sqrt(s2 / n2) : null,
        rmsMain: n ? Math.sqrt(s / n) : null,
        rmsW: nw ? Math.sqrt(sw / nw) : null,
        W: run.W,
        run,
    };
}

function fitCost(check) {
    if (check.rmsAll === null || check.why !== 'stop') return MISSED_STOP_COST + (check.rmsAll || 50);
    return check.rmsAll ** 2 + (check.rmsW / 5) ** 2;
}

function encode(puck) {
    return PUCK_SPEC.map(({ key, log }) => (log ? Math.log(puck[key]) : puck[key]));
}

function decode(x) {
    const puck = {};
    PUCK_SPEC.forEach(({ key, log, lo, hi }, i) => {
        const v = log ? Math.exp(x[i]) : x[i];
        puck[key] = Math.min(hi, Math.max(lo, v));
    });
    return puck;
}

export function valuesNearBound(puck) {
    return PUCK_SPEC
        .filter(({ key, lo, hi }) => (puck[key] / Math.max(lo, 1e-9) < 1.1 && lo > 0) || puck[key] / hi > 0.9)
        .map(({ key }) => key);
}

export function createPuckFit({
    shot,
    steps,
    settings,
    targetWeight,
    startPuck = DEFAULT_START_PUCK,
    maxIterations = FIT_STOP.maxIterations,
    window = FIT_STOP.window,
    relativeChange = FIT_STOP.relativeChange,
    maxRestarts = FIT_STOP.maxRestarts,
    restartGain = FIT_STOP.restartGain,
}) {
    const input = { shot, steps, settings, targetWeight };
    const n = PUCK_SPEC.length;
    let evals = 0;
    let iterations = 0;
    let reason = null;
    let restarts = 0;
    let roundStartJ = null;
    let simplex = null;
    let costs = null;
    let history = [];

    function cost(x) {
        evals++;
        return fitCost(checkPuck(decode(x), input));
    }

    function build(x0, f0) {
        simplex = [x0];
        for (let i = 0; i < n; i++) {
            const y = x0.slice();
            y[i] += PUCK_SPEC[i].step;
            simplex.push(y);
        }
        costs = simplex.map((x, i) => (i === 0 && f0 !== undefined ? f0 : cost(x)));
        history = [];
    }

    function start() {
        build(encode(startPuck));
        roundStartJ = costs[0];
    }

    function restart() {
        const b = bestIndex();
        const gain = roundStartJ - costs[b];
        if (restarts >= maxRestarts || (restarts > 0 && gain <= restartGain * costs[b])) return false;
        restarts++;
        roundStartJ = costs[b];
        build(simplex[b], costs[b]);
        return true;
    }

    function sortSimplex() {
        const idx = costs.map((f, i) => i).sort((a, b) => costs[a] - costs[b]);
        simplex = idx.map((i) => simplex[i]);
        costs = idx.map((i) => costs[i]);
    }

    function iterate() {
        sortSimplex();
        const c = new Array(n).fill(0);
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += simplex[i][j] / n;
        const point = (a) => c.map((v, j) => v + a * (simplex[n][j] - v));
        const xr = point(-1);
        const fr = cost(xr);
        if (fr < costs[0]) {
            const xe = point(-2);
            const fe = cost(xe);
            if (fe < fr) {
                simplex[n] = xe;
                costs[n] = fe;
            } else {
                simplex[n] = xr;
                costs[n] = fr;
            }
        } else if (fr < costs[n - 1]) {
            simplex[n] = xr;
            costs[n] = fr;
        } else {
            const xc = fr < costs[n] ? point(-0.5) : point(0.5);
            const fc = cost(xc);
            if (fc < Math.min(fr, costs[n])) {
                simplex[n] = xc;
                costs[n] = fc;
            } else {
                for (let i = 1; i <= n; i++) {
                    simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j]));
                    costs[i] = cost(simplex[i]);
                }
            }
        }
        iterations++;
        history.push(Math.min(...costs));
    }

    function settled() {
        if (history.length <= window) return false;
        const before = history[history.length - 1 - window];
        const now = history[history.length - 1];
        return before - now <= relativeChange * now;
    }

    function bestIndex() {
        let b = 0;
        for (let i = 1; i < costs.length; i++) if (costs[i] < costs[b]) b = i;
        return b;
    }

    function progress() {
        const b = simplex ? bestIndex() : -1;
        return {
            iterations,
            evals,
            restarts,
            bestJ: b >= 0 ? costs[b] : null,
            bestPuck: b >= 0 ? decode(simplex[b]) : null,
            done: reason !== null,
            reason,
        };
    }

    function run(chunk = Infinity) {
        if (reason !== null) return progress();
        if (!simplex) start();
        let left = chunk;
        while (left > 0 && reason === null) {
            iterate();
            left--;
            if (settled() && !restart()) reason = 'settled';
            else if (iterations >= maxIterations) reason = 'limit';
        }
        return progress();
    }

    function stop() {
        if (!simplex) start();
        if (reason === null) reason = 'stopped';
        return progress();
    }

    function result() {
        if (!simplex) return null;
        const b = bestIndex();
        const puck = decode(simplex[b]);
        return {
            puck,
            J: costs[b],
            check: checkPuck(puck, input),
            iterations,
            evals,
            restarts,
            reason,
            nearBound: valuesNearBound(puck),
        };
    }

    return { run, stop, progress, result };
}

export const SHOT_NOT_USABLE = Object.freeze({
    NO_RECORD: 'noRecord',
    NO_SAMPLES: 'noSamples',
    DE1_EMULATION: 'de1Emulation',
    NO_WEIGHT: 'noWeight',
    NO_TARGET_WEIGHT: 'noTargetWeight',
});

export const SAMPLE_MERGE_MS = 30;

const PREPARING = 'preparingForShot';

function finite(v) {
    return typeof v === 'number' && Number.isFinite(v);
}

function sampleGroups(record) {
    const list = record && Array.isArray(record.measurements) ? record.measurements : [];
    let first = 0;
    let lastPreparing = -1;
    for (let i = 0; i < list.length; i++) {
        if (list[i]?.machine?.state?.substate === PREPARING) lastPreparing = i;
    }
    if (lastPreparing >= 0) first = lastPreparing + 1;
    const groups = [];
    for (let i = first; i < list.length; i++) {
        const machine = list[i]?.machine;
        const stamp = machine && typeof machine.timestamp === 'string' ? Date.parse(machine.timestamp) : NaN;
        if (!Number.isFinite(stamp) || !finite(machine.pressure)) continue;
        const weight = list[i]?.scale?.weight;
        const sample = {
            ms: stamp,
            P: machine.pressure,
            Q: finite(machine.flow) ? machine.flow : null,
            W: finite(weight) ? weight : null,
            frame: finite(machine.profileFrame) ? machine.profileFrame : null,
        };
        const group = groups[groups.length - 1];
        if (group && stamp - group.ms0 < SAMPLE_MERGE_MS) group.items.push(sample);
        else groups.push({ ms0: stamp, items: [sample] });
    }
    return groups.length ? groups : null;
}

function mean(xs) {
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function meanOrNull(items, key) {
    const xs = items.map((s) => s[key]).filter((v) => v !== null);
    return xs.length ? mean(xs) : null;
}

function groupTimes(groups) {
    const origin = groups[0].ms0;
    return groups.map((g) => (mean(g.items.map((s) => s.ms)) - origin) / 1000);
}

export function samplesFromRecord(record) {
    const groups = sampleGroups(record);
    if (!groups) return null;
    const t = groupTimes(groups);
    const P = groups.map((g) => mean(g.items.map((s) => s.P)));
    const W = groups.map((g) => meanOrNull(g.items, 'W'));
    const frame = groups.map((g) => g.items[g.items.length - 1].frame);
    return { t, P, W, frame, changes: frameChanges(t, frame) };
}

export function flowSamplesFromRecord(record) {
    const groups = sampleGroups(record);
    if (!groups) return null;
    return { t: groupTimes(groups), Q: groups.map((g) => meanOrNull(g.items, 'Q')) };
}

export function shotTargetWeight(record) {
    const context = record?.workflow?.context;
    if (finite(context?.targetYield) && context.targetYield > 0) return context.targetYield;
    const profile = record?.workflow?.profile;
    if (finite(profile?.target_weight) && profile.target_weight > 0) return profile.target_weight;
    return null;
}

export function shotRanDe1Emulation(record) {
    return shotRanAsDe1(record) || record?.workflow?.machine?.de1Emulation === true
        || de1EmulationOf(record?.workflow?.profile);
}

export function shotFromRecord(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return { usable: false, reason: SHOT_NOT_USABLE.NO_RECORD };
    }
    if (shotRanDe1Emulation(record)) {
        return { usable: false, reason: SHOT_NOT_USABLE.DE1_EMULATION };
    }
    const samples = samplesFromRecord(record);
    if (!samples) return { usable: false, reason: SHOT_NOT_USABLE.NO_SAMPLES };
    if (samples.W.every((v) => v === null)) return { usable: false, reason: SHOT_NOT_USABLE.NO_WEIGHT };
    const targetWeight = shotTargetWeight(record);
    if (targetWeight === null) return { usable: false, reason: SHOT_NOT_USABLE.NO_TARGET_WEIGHT };
    return { usable: true, shot: { ...samples, targetWeight } };
}
