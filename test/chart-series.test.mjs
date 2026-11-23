import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { runShotModel } from '../src/lib/shot-model.js';
import { flowSamplesFromRecord, samplesFromRecord } from '../src/lib/puck-fit.js';
import {
    GFLOW_HALF_S, POOR_FIT_RMS_BAR, centredRate, chartYMax, grindFactor, isPoorFit, mainStepOf,
    runResults, seriesToggle, shotResults, resultChange,
} from '../src/lib/chart-series.js';
import { convertedShot, RECORDED_SHOT_IDS } from './fixtures/chart-shots.js';

const REF = JSON.parse(readFileSync(new URL('./fixtures/shot-model-reference.json', import.meta.url), 'utf8'));

function run(grind) {
    return runShotModel(REF.steps, REF.settings.firstTest, REF.puck, { grind, stopW: REF.targetWeight, tMax: 120 });
}

function slowRate(t, w, i) {
    let lo = i;
    let hi = i;
    while (lo > 0 && t[lo - 1] >= t[i] - GFLOW_HALF_S - 1e-9) lo--;
    while (hi + 1 < t.length && t[hi + 1] <= t[i] + GFLOW_HALF_S + 1e-9) hi++;
    const dt = t[hi] - t[lo];
    return dt > 1e-6 ? Math.max(0, (w[hi] - w[lo]) / dt) : 0;
}

test('the model GFlow is the centred one second change of the model cup weight', () => {
    const out = run(1).out;
    const g = centredRate(out.t, out.W);
    assert.equal(g.length, out.t.length);
    for (let i = 0; i < out.t.length; i += 7) {
        assert.ok(Math.abs(g[i] - slowRate(out.t, out.W, i)) < 1e-9, `t ${out.t[i]}`);
    }
    const mid = out.t.findIndex((v) => v > 20);
    const j = out.t.findIndex((v) => v >= out.t[mid] + 0.5 - 1e-9);
    const k = out.t.findIndex((v) => v >= out.t[mid] - 0.5 - 1e-9);
    assert.ok(Math.abs(g[mid] - (out.W[j] - out.W[k]) / (out.t[j] - out.t[k])) < 1e-9);
});

test('a falling weight gives a GFlow of 0, never below', () => {
    const t = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5];
    const w = [10, 9, 8, 7, 6, 5, 4];
    assert.deepEqual(centredRate(t, w), [0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(centredRate([0, 0.5, 1], [0, 1, 2]), [2, 2, 2]);
});

test('the shot GFlow uses the same centred change of the recorded weight and ignores the recorded weight flow', () => {
    const record = convertedShot(RECORDED_SHOT_IDS[2]);
    const samples = samplesFromRecord(record);
    const g = centredRate(samples.t, samples.W);
    const altered = structuredClone(record);
    for (const row of altered.measurements) if (row.scale) row.scale.weightFlow = 9.9;
    const again = samplesFromRecord(altered);
    assert.deepEqual(centredRate(again.t, again.W), g);
    assert.ok(g.every((v) => v >= 0));
    const i = samples.t.findIndex((v) => v > 5);
    assert.ok(Math.abs(g[i] - slowRate(samples.t, samples.W, i)) < 1e-9);
});

test('the shot flow samples read the machine flow on the time base of the fit samples', () => {
    const record = convertedShot(RECORDED_SHOT_IDS[2]);
    const samples = samplesFromRecord(record);
    const flow = flowSamplesFromRecord(record);
    assert.deepEqual(flow.t, samples.t);
    assert.equal(flow.Q.length, samples.P.length);
    assert.ok(flow.Q.some((v) => v > 1));
    const altered = structuredClone(record);
    for (const row of altered.measurements) if (row.scale) row.scale.weightFlow = 9.9;
    assert.deepEqual(flowSamplesFromRecord(altered).Q, flow.Q);
});

test('the y range comes from every series and stays when a series hides', () => {
    const out = run(1).out;
    const parts = [out.P, out.Q, out.tP, out.tQ, centredRate(out.t, out.W)];
    const yMax = chartYMax(parts);
    assert.ok(yMax >= 12 && yMax % 2 === 0);
    let show = { P: true, Q: true, G: true, targets: true };
    show = seriesToggle(show, 'P').show;
    assert.equal(show.P, false);
    assert.equal(chartYMax(parts), yMax);
    assert.equal(chartYMax([[3]]), 12);
    assert.equal(chartYMax([[13.1]]), 14);
});

test('the last measured series cannot hide, and the target hides only the dashed lines', () => {
    let r = seriesToggle({ P: true, Q: false, G: false, targets: true }, 'P');
    assert.equal(r.refused, true);
    assert.equal(r.show.P, true);
    r = seriesToggle({ P: true, Q: true, G: false, targets: true }, 'Q');
    assert.deepEqual(r, { show: { P: true, Q: false, G: false, targets: true }, refused: false });
    r = seriesToggle({ P: true, Q: false, G: false, targets: true }, 'targets');
    assert.deepEqual(r, { show: { P: true, Q: false, G: false, targets: false }, refused: false });
    r = seriesToggle(r.show, 'targets');
    assert.equal(r.show.targets, true);
});

test('the poor fit warning starts at 0.5 bar rms', () => {
    assert.equal(POOR_FIT_RMS_BAR, 0.5);
    assert.equal(isPoorFit(0.49), false);
    assert.equal(isPoorFit(0.5), true);
    assert.equal(isPoorFit(0.51), true);
    assert.equal(isPoorFit(null), false);
});

test('grind -1, 0 and 1 give factors 2, 1 and 0.5 on the puck resistance', () => {
    assert.equal(grindFactor(-1), 2);
    assert.equal(grindFactor(0), 1);
    assert.equal(grindFactor(1), 0.5);
    assert.equal(grindFactor(Number.NaN), 1);
    const finer = run(grindFactor(-1));
    const base = run(grindFactor(0));
    const coarser = run(grindFactor(1));
    assert.ok(finer.end.t > base.end.t && base.end.t > coarser.end.t,
        `${finer.end.t} ${base.end.t} ${coarser.end.t}`);
});

test('the results of a run and of a shot use the main step of the shot', () => {
    const record = convertedShot(RECORDED_SHOT_IDS[2]);
    const shot = samplesFromRecord(record);
    const flow = flowSamplesFromRecord(record);
    const mainStep = mainStepOf(shot);
    assert.equal(mainStep, 0);
    assert.equal(mainStepOf({ t: [0, 1, 2, 5, 6], frame: [0, 1, 1, 2, 2] }), 1);
    const a = shotResults(shot, flow, { dose: 17, mainStep });
    assert.ok(Math.abs(a.time - shot.t[shot.t.length - 1]) < 1e-9);
    assert.ok(a.peakP > 0 && a.meanQ !== null);
    assert.equal(a.why, null);
    const b = runResults(run(1), { dose: 18, mainStep: 2 });
    assert.equal(b.why, 'stop');
    assert.ok(Math.abs(b.ratio - b.W / 18) < 1e-12);
    assert.equal(resultChange(1, 1.004, 2), 0);
    assert.ok(Math.abs(resultChange(1, 2.5, 1) - 1.5) < 1e-12);
    assert.equal(resultChange(null, 2, 1), null);
});
