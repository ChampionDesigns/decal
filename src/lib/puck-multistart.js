import { createPuckFit, DEFAULT_START_PUCK, PUCK_SPEC } from './puck-fit.js';
import { maxOf } from './chart-series.js';

function scaled(puck, factors) {
    const out = {};
    for (const { key, lo, hi } of PUCK_SPEC) {
        const f = typeof factors === 'number' ? factors : (factors[key] ?? 1);
        out[key] = Math.min(hi, Math.max(lo, puck[key] * f));
    }
    return Object.freeze(out);
}

export const FIT_STARTS = Object.freeze([
    DEFAULT_START_PUCK,
    scaled(DEFAULT_START_PUCK, 0.8),
    scaled(DEFAULT_START_PUCK, 1.25),
    scaled(DEFAULT_START_PUCK, { m: 2.2, w: 1.5, ts: 1.3 }),
]);

export const SPREAD_J_FACTOR = 1.2;

export function createMultiStartFit({ shot, steps, settings, targetWeight, starts = FIT_STARTS }) {
    const fits = [];
    let current = null;
    let index = 0;
    let iterations = 0;
    let evals = 0;
    let stopped = false;

    function done() {
        return stopped || index >= starts.length;
    }

    function progress() {
        const live = current ? current.progress() : null;
        return {
            done: done(),
            start: Math.min(index, starts.length),
            starts: starts.length,
            iterations: iterations + (live ? live.iterations : 0),
            evals: evals + (live ? live.evals : 0),
        };
    }

    function finishCurrent() {
        const r = current.result();
        fits.push(r);
        iterations += r.iterations;
        evals += r.evals;
        current = null;
        index++;
    }

    function run(chunk = Infinity) {
        let left = chunk;
        while (left > 0 && !done()) {
            if (!current) {
                current = createPuckFit({ shot, steps, settings, targetWeight, startPuck: starts[index] });
            }
            const before = current.progress().iterations;
            const p = current.run(left);
            left -= Math.max(1, p.iterations - before);
            if (p.done) finishCurrent();
        }
        return progress();
    }

    function stop() {
        stopped = true;
        current = null;
        return progress();
    }

    function result() {
        if (!fits.length) return null;
        let best = fits[0];
        for (const f of fits) if (f.J < best.J) best = f;
        return { best, fits: fits.slice(), iterations, evals };
    }

    return { run, stop, progress, result };
}

function range(values) {
    const xs = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (!xs.length) return null;
    return Math.max(...xs) - Math.min(...xs);
}

export function fitSpread(fits) {
    const list = Array.isArray(fits) ? fits.filter((f) => f && Number.isFinite(f.J) && f.check?.run) : [];
    if (!list.length) return null;
    const bestJ = Math.min(...list.map((f) => f.J));
    const near = list.filter((f) => f.J <= SPREAD_J_FACTOR * bestJ);
    return {
        count: near.length,
        endTime: range(near.map((f) => f.check.run.end.t)),
        peakPressure: range(near.map((f) => maxOf(f.check.run.out.P))),
        finalWeight: range(near.map((f) => f.check.run.W)),
    };
}
