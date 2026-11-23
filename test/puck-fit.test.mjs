import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { runShotModel } from '../src/lib/shot-model.js';
import {
    PUCK_SPEC,
    DEFAULT_START_PUCK,
    FIT_STOP,
    SAMPLE_MERGE_MS,
    SHOT_NOT_USABLE,
    checkPuck,
    createPuckFit,
    samplesFromRecord,
    shotFromRecord,
    valuesNearBound,
} from '../src/lib/puck-fit.js';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const REF = readJson('./fixtures/shot-model-reference.json');
const RECORD = readJson('../tools/rea-fixtures/api__v1__shots__d5139a1f-c4ee-47e2-bb80-0cbf3e39b6a3.json');
const REAL_SHOT = { t: REF.shot.t, P: REF.shot.P, W: REF.shot.W, frame: REF.shot.fr };
function fitPuck(options) {
    const fit = createPuckFit(options);
    fit.run();
    return fit.result();
}

const BASE = { steps: REF.steps, settings: REF.settings.firstTest, targetWeight: REF.targetWeight };

test('the fit uses the eight puck values, bounds and steps of the reference', () => {
    assert.deepEqual(PUCK_SPEC.map((s) => s.key), Object.keys(REF.puck));
    assert.deepEqual(PUCK_SPEC.map((s) => s.key), Object.keys(REF.startPuck));
    assert.deepEqual({ ...DEFAULT_START_PUCK }, REF.startPuck);
    assert.deepEqual(PUCK_SPEC.filter((s) => s.log).map((s) => s.key), ['R_fill', 'R_end', 'm', 'ts', 'Vo']);
});

test('the reference puck repeats the reference check on the real shot', () => {
    const c = checkPuck(REF.fit.puck, { shot: REAL_SHOT, ...BASE });
    assert.equal(c.why, 'stop');
    assert.ok(Math.abs(c.rmsAll - REF.fit.check.rmsAll) < 0.001, `${c.rmsAll}`);
    assert.ok(Math.abs(c.rmsMain - REF.fit.check.rms3) < 0.001, `${c.rmsMain}`);
    assert.ok(Math.abs(c.rmsW - REF.fit.check.rmsW) < 0.005, `${c.rmsW}`);
});

test('the fit of the real shot reaches the reference J with an empty near-bound list', () => {
    const r = fitPuck({ shot: REAL_SHOT, ...BASE });
    assert.ok(r.J <= REF.fit.J * 1.01, `J ${r.J}`);
    assert.ok(r.check.rmsAll <= 0.25, `rms ${r.check.rmsAll}`);
    assert.ok(Math.abs(r.check.time - 26.2) <= 0.1, `time ${r.check.time}`);
    assert.deepEqual(r.nearBound, []);
    assert.equal(r.reason, 'settled');
    assert.ok(r.evals < REF.fit.evals, `${r.evals} model runs`);
});

test('without restarts the fit ends at the reference J', () => {
    const r = fitPuck({ shot: REAL_SHOT, ...BASE, maxRestarts: 0 });
    assert.ok(Math.abs(r.J - REF.fit.J) <= REF.fit.J * 0.01, `J ${r.J}`);
    assert.equal(r.restarts, 0);
    assert.deepEqual(r.nearBound, []);
});

function modelShot() {
    const run = runShotModel(REF.steps, REF.settings.firstTest, REF.puck, { grind: 1, stopW: REF.targetWeight, tMax: 120 });
    return { shot: { t: run.out.t, P: run.out.P, W: run.out.W, frame: run.out.k }, time: run.end.t };
}

test('the fit keeps a puck that already repeats the shot', () => {
    const { shot } = modelShot();
    const r = fitPuck({ shot, ...BASE, startPuck: REF.puck });
    assert.ok(r.check.rmsAll < 0.05, `rms ${r.check.rmsAll}`);
});

test('the fit from a puck 25 % off brings the modelled shot back near the sample', () => {
    const { shot, time } = modelShot();
    const startPuck = Object.fromEntries(Object.entries(REF.puck).map(([k, v]) => [k, v * 1.25]));
    const before = checkPuck(startPuck, { shot, ...BASE });
    const r = fitPuck({ shot, ...BASE, startPuck });
    assert.ok(r.check.rmsAll < before.rmsAll / 6, `rms ${before.rmsAll} to ${r.check.rmsAll}`);
    assert.ok(r.check.rmsAll < 0.1, `rms ${r.check.rmsAll}`);
    assert.ok(Math.abs(r.check.time - time) <= 0.1, `time ${r.check.time}`);
    assert.deepEqual(r.nearBound, []);
});

const SHORT = { maxIterations: 200, window: 20 };

test('a fit run in chunks gives the result of one run', () => {
    const one = createPuckFit({ shot: REAL_SHOT, ...BASE, ...SHORT });
    one.run();
    const chunked = createPuckFit({ shot: REAL_SHOT, ...BASE, ...SHORT });
    let p;
    do p = chunked.run(7); while (!p.done);
    const a = one.result();
    const b = chunked.result();
    assert.deepEqual(b.puck, a.puck);
    assert.equal(b.J, a.J);
    assert.equal(b.evals, a.evals);
    assert.equal(b.iterations, a.iterations);
    assert.ok(a.restarts > 0);
});

test('progress reports iterations, model runs, best J and best puck', () => {
    const fit = createPuckFit({ shot: REAL_SHOT, ...BASE, ...SHORT });
    const before = fit.progress();
    assert.equal(before.iterations, 0);
    assert.equal(before.bestJ, null);
    assert.equal(fit.result(), null);
    const first = fit.run(5);
    const second = fit.run(5);
    assert.equal(first.iterations, 5);
    assert.equal(second.iterations, 10);
    assert.ok(second.evals > first.evals);
    assert.ok(second.bestJ <= first.bestJ);
    assert.deepEqual(Object.keys(second.bestPuck), Object.keys(REF.puck));
    assert.equal(second.done, false);
});

test('stop ends the fit with the best result so far', () => {
    const fit = createPuckFit({ shot: REAL_SHOT, ...BASE });
    const p = fit.run(12);
    const stopped = fit.stop();
    assert.equal(stopped.done, true);
    assert.equal(stopped.reason, 'stopped');
    assert.equal(stopped.bestJ, p.bestJ);
    const after = fit.run(50);
    assert.equal(after.iterations, 12);
    const r = fit.result();
    assert.equal(r.J, p.bestJ);
    assert.deepEqual(r.puck, p.bestPuck);
    assert.equal(r.reason, 'stopped');
});

test('the fit ends at the iteration limit', () => {
    const r = fitPuck({ shot: REAL_SHOT, ...BASE, maxIterations: 30 });
    assert.equal(r.iterations, 30);
    assert.equal(r.reason, 'limit');
});

test('the fit does not pass the iteration limit when a restart starts', () => {
    for (const maxIterations of [20, 21, 22, 23, 24, 25]) {
        const r = fitPuck({ shot: REAL_SHOT, ...BASE, maxIterations, window: 3 });
        assert.ok(r.iterations <= maxIterations, `${r.iterations} of ${maxIterations}`);
    }
});

test('the main step is aligned on the change into the last frame', () => {
    const { shot } = modelShot();
    const first = shot.frame.indexOf(1);
    const late = { t: shot.t.slice(first), P: shot.P.slice(first), W: shot.W.slice(first), frame: shot.frame.slice(first) };
    late.t = late.t.map((v) => v - late.t[0]);
    const full = checkPuck(REF.puck, { shot, ...BASE });
    const c = checkPuck(REF.puck, { shot: late, ...BASE });
    assert.ok(c.rmsMain !== null);
    assert.ok(Math.abs(c.rmsMain - full.rmsMain) < 1e-9, `${c.rmsMain} against ${full.rmsMain}`);
});

test('the stop rule values', () => {
    assert.equal(FIT_STOP.maxIterations, 1500);
    assert.ok(FIT_STOP.window > 0 && FIT_STOP.relativeChange > 0);
});

test('a value within 10 % of a bound is listed', () => {
    assert.deepEqual(valuesNearBound(REF.puck), []);
    assert.deepEqual(valuesNearBound({ ...REF.puck, R_fill: 2.1e-4, V_hold: 75 }), ['R_fill', 'V_hold']);
});

const PREPARING = 'preparingForShot';
const STAMP = (s) => Date.parse(s.machine.timestamp);

test('a recorded shot starts at the first sample after preparing for the shot', () => {
    const m = RECORD.measurements;
    const first = m.map((s) => s.machine.state.substate).lastIndexOf(PREPARING) + 1;
    const samples = samplesFromRecord(RECORD);
    assert.equal(samples.t[0], 0);
    assert.equal(samples.P[0], m[first].machine.pressure);
    const last = m[m.length - 1];
    const lastGroupStart = m.findLastIndex((s, i) => i >= first && STAMP(last) - STAMP(s) >= SAMPLE_MERGE_MS) + 1;
    const tail = m.slice(lastGroupStart);
    const mean = tail.reduce((a, s) => a + STAMP(s), 0) / tail.length;
    assert.ok(Math.abs(samples.t.at(-1) - (mean - STAMP(m[first])) / 1000) < 1e-9);
});

test('recorded samples less than 30 ms apart are averaged', () => {
    const m = RECORD.measurements;
    const i = 228;
    assert.ok(STAMP(m[i]) - STAMP(m[i - 1]) < SAMPLE_MERGE_MS);
    assert.ok(STAMP(m[i - 1]) - STAMP(m[i - 2]) >= SAMPLE_MERGE_MS);
    assert.ok(STAMP(m[i + 1]) - STAMP(m[i - 1]) >= SAMPLE_MERGE_MS);
    const first = m.map((s) => s.machine.state.substate).lastIndexOf(PREPARING) + 1;
    const samples = samplesFromRecord(RECORD);
    const t = ((STAMP(m[i - 1]) + STAMP(m[i])) / 2 - STAMP(m[first])) / 1000;
    const k = samples.t.findIndex((v) => Math.abs(v - t) < 1e-9);
    assert.ok(k > 0, 'the averaged sample is on the time base');
    assert.ok(Math.abs(samples.P[k] - (m[i - 1].machine.pressure + m[i].machine.pressure) / 2) < 1e-9);
    assert.ok(samples.t.length < m.length - first);
    for (let j = 1; j < samples.t.length; j++) assert.ok(samples.t[j] > samples.t[j - 1]);
});

test('the frame change times of a recorded shot', () => {
    const m = RECORD.measurements;
    const first = m.map((s) => s.machine.state.substate).lastIndexOf(PREPARING) + 1;
    const expected = [];
    for (let i = first + 1; i < m.length; i++) {
        if (m[i].machine.profileFrame !== m[i - 1].machine.profileFrame) {
            expected.push((STAMP(m[i]) - STAMP(m[first])) / 1000);
        }
    }
    const samples = samplesFromRecord(RECORD);
    assert.equal(samples.changes.length, 2);
    samples.changes.forEach((c, j) => assert.ok(Math.abs(c - expected[j]) < 1e-9, `${c} against ${expected[j]}`));
    assert.deepEqual([...new Set(samples.frame)], [0, 1, 2]);
});

test('a recorded shot with no scale weight is not usable', () => {
    assert.deepEqual(shotFromRecord(RECORD), { usable: false, reason: SHOT_NOT_USABLE.NO_WEIGHT });
});

test('a shot that ran in DE1 emulation is not usable', () => {
    const asShot = { ...RECORD, de1Emulation: true };
    assert.deepEqual(shotFromRecord(asShot), { usable: false, reason: SHOT_NOT_USABLE.DE1_EMULATION });
    const asProfile = {
        ...RECORD,
        workflow: { ...RECORD.workflow, profile: { ...RECORD.workflow.profile, de1_emulation: true } },
    };
    assert.deepEqual(shotFromRecord(asProfile), { usable: false, reason: SHOT_NOT_USABLE.DE1_EMULATION });
});

test('a record with no shot samples is not usable', () => {
    assert.deepEqual(shotFromRecord(null), { usable: false, reason: SHOT_NOT_USABLE.NO_RECORD });
    assert.deepEqual(shotFromRecord({ ...RECORD, measurements: [] }), { usable: false, reason: SHOT_NOT_USABLE.NO_SAMPLES });
});

function sample(stamp, substate, pressure, weight, frame) {
    return {
        machine: { timestamp: stamp, state: { state: 'espresso', substate }, pressure, flow: 1, profileFrame: frame },
        scale: weight === null ? null : { timestamp: stamp, weight, weightFlow: 0 },
        volume: 0,
    };
}

test('a shot with no target weight is not usable', () => {
    const record = {
        measurements: [
            sample('2026-01-01T08:00:00.000', 'preinfusion', 1, 0.5, 0),
            sample('2026-01-01T08:00:00.100', 'pouring', 2, 1, 1),
        ],
        workflow: { profile: { title: 'x', steps: [] }, context: {} },
    };
    assert.deepEqual(shotFromRecord(record), { usable: false, reason: SHOT_NOT_USABLE.NO_TARGET_WEIGHT });
    const fromProfile = { ...record, workflow: { profile: { title: 'x', steps: [], target_weight: 40 } } };
    assert.equal(shotFromRecord(fromProfile).shot.targetWeight, 40);
});

test('a shot with scale weight gives the fit input', () => {
    const record = {
        id: 'a',
        timestamp: '2026-01-01T08:00:00.000',
        measurements: [
            sample('2026-01-01T08:00:00.000', PREPARING, 0, 0, 0),
            sample('2026-01-01T08:00:00.100', 'preinfusion', 1, 0, 0),
            sample('2026-01-01T08:00:00.100', 'preinfusion', 2, 0.2, 0),
            sample('2026-01-01T08:00:00.200', 'preinfusion', 3, null, 0),
            sample('2026-01-01T08:00:00.300', 'pouring', 4, 1, 1),
        ],
        workflow: { profile: { title: 'x', steps: [] }, context: { targetDoseWeight: 18, targetYield: 36 } },
    };
    const r = shotFromRecord(record);
    assert.equal(r.usable, true);
    assert.deepEqual(r.shot.P, [1.5, 3, 4]);
    assert.deepEqual(r.shot.W, [0.1, null, 1]);
    assert.deepEqual(r.shot.frame, [0, 0, 1]);
    assert.ok(Math.abs(r.shot.t[1] - 0.1) < 1e-9);
    assert.ok(Math.abs(r.shot.changes[0] - 0.2) < 1e-9);
    assert.equal(r.shot.targetWeight, 36);
    const c = checkPuck(REF.puck, { shot: r.shot, ...BASE });
    assert.ok(Number.isFinite(c.rmsW));
});
