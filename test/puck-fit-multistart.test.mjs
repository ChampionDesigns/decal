import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createPuckFit, DEFAULT_START_PUCK, PUCK_SPEC } from '../src/lib/puck-fit.js';
import { createMultiStartFit, fitSpread, FIT_STARTS, SPREAD_J_FACTOR } from '../src/lib/puck-multistart.js';
import { shotPlan } from '../src/lib/chart-shot-load.js';
import { convertedShot, RECORDED_SHOT_IDS } from './fixtures/chart-shots.js';

function inputOf(id) {
    const plan = shotPlan(convertedShot(id));
    return { shot: plan.shot, steps: plan.steps, settings: plan.settings, targetWeight: plan.targetWeight };
}

function fitAll(input) {
    const fit = createMultiStartFit(input);
    let p = fit.progress();
    while (!p.done) p = fit.run(25);
    return fit.result();
}

const SHORT = inputOf(RECORDED_SHOT_IDS[0]);

test('the start list holds four pucks inside the bounds, the default first', () => {
    assert.equal(FIT_STARTS.length, 4);
    assert.equal(FIT_STARTS[0], DEFAULT_START_PUCK);
    for (const start of FIT_STARTS) {
        for (const { key, lo, hi } of PUCK_SPEC) assert.ok(start[key] >= lo && start[key] <= hi, key);
    }
    assert.ok(Math.abs(FIT_STARTS[1].m - DEFAULT_START_PUCK.m * 0.8) < 1e-9);
    assert.ok(Math.abs(FIT_STARTS[2].m - DEFAULT_START_PUCK.m * 1.25) < 1e-9);
    assert.ok(Math.abs(FIT_STARTS[3].m - DEFAULT_START_PUCK.m * 2.2) < 1e-9);
    assert.equal(SPREAD_J_FACTOR, 1.2);
});

test('the fit runs from each start in chunks and keeps the best J', () => {
    const fit = createMultiStartFit(SHORT);
    const seen = new Set();
    let p = fit.progress();
    assert.equal(p.done, false);
    while (!p.done) {
        p = fit.run(10);
        seen.add(p.start);
        assert.ok(p.iterations >= 0);
    }
    assert.equal(p.start, 4);
    const r = fit.result();
    assert.equal(r.fits.length, FIT_STARTS.length);
    assert.equal(r.best.J, Math.min(...r.fits.map((f) => f.J)));
    assert.equal(r.iterations, r.fits.reduce((a, f) => a + f.iterations, 0));
    assert.ok(seen.size > 1);
});

test('the best J is not worse than the single fit from the default start', () => {
    const single = createPuckFit(SHORT);
    single.run();
    const r = fitAll(SHORT);
    assert.ok(r.best.J <= single.result().J, `${r.best.J} against ${single.result().J}`);
    assert.equal(r.fits[0].J, single.result().J);
});

test('the result is the same on two runs', () => {
    const a = fitAll(SHORT);
    const b = fitAll(SHORT);
    assert.deepEqual(a.fits.map((f) => f.J), b.fits.map((f) => f.J));
    assert.deepEqual(a.best.puck, b.best.puck);
});

test('the spread gives the ranges of the fits near the best J for the recorded shots', () => {
    for (const id of RECORDED_SHOT_IDS) {
        const plan = shotPlan(convertedShot(id));
        if (!plan.usable) continue;
        const r = fitAll({ shot: plan.shot, steps: plan.steps, settings: plan.settings, targetWeight: plan.targetWeight });
        const spread = fitSpread(r.fits);
        const near = r.fits.filter((f) => f.J <= SPREAD_J_FACTOR * r.best.J);
        assert.equal(spread.count, near.length, id);
        for (const key of ['endTime', 'peakPressure', 'finalWeight']) {
            assert.ok(Number.isFinite(spread[key]) && spread[key] >= 0, `${id} ${key}`);
        }
        const ends = near.map((f) => f.check.run.end.t);
        assert.ok(Math.abs(spread.endTime - (Math.max(...ends) - Math.min(...ends))) < 1e-9);
    }
});

test('the spread of one fit is zero and of no fit is null', () => {
    const fake = (J, t, P, W) => ({ J, check: { run: { end: { t }, out: { P }, W } } });
    assert.equal(fitSpread([]), null);
    assert.deepEqual(fitSpread([fake(1, 20, [1, 9], 40)]), { count: 1, endTime: 0, peakPressure: 0, finalWeight: 0 });
    const s = fitSpread([fake(1, 20, [9], 40), fake(1.2, 25, [8], 41), fake(1.3, 90, [2], 10)]);
    assert.deepEqual({ ...s, peakPressure: Math.round(s.peakPressure) }, { count: 2, endTime: 5, peakPressure: 1, finalWeight: 1 });
});
