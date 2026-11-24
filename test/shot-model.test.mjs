import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    runShotModel,
    settingsFromNativeShaping,
    stepsFromProfile,
    FIRMWARE_DEFAULT_SETTINGS,
    MODEL_HZ,
} from '../src/lib/shot-model.js';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const REF = readJson('./fixtures/shot-model-reference.json');
const RECORDED_WORKFLOW = readJson('../tools/rea-fixtures/api__v1__workflow.json');

function withReferenceValues(step, ref) {
    const out = {
        ...step,
        transition: ref.smooth ? 'smooth' : 'fast',
        exit: ref.exit ? { type: ref.exit.type, condition: ref.exit.cond, value: ref.exit.v } : null,
        volume: ref.vol,
        seconds: ref.sec,
        weight: ref.wt,
        limiter: { value: ref.L, range: ref.R },
    };
    out[ref.pump] = ref.v;
    return out;
}

const PROFILE = {
    ...RECORDED_WORKFLOW.profile,
    steps: RECORDED_WORKFLOW.profile.steps.map((step, i) => withReferenceValues(step, REF.steps[i])),
};
const TOL = 0.01;
const STOP = { grind: 1, stopW: 50, tMax: 120 };

function caseById(id) {
    const found = REF.cases.find((c) => c.id === id);
    assert.ok(found, id);
    return found;
}

function halfSecondGrid(out) {
    const grid = { t: [], P: [], Q: [], W: [] };
    for (let i = 0; i < out.t.length; i++) {
        const h = out.t[i] * 2;
        if (Math.abs(h - Math.round(h)) < 1e-6) {
            grid.t.push(out.t[i]);
            grid.P.push(out.P[i]);
            grid.Q.push(out.Q[i]);
            grid.W.push(out.W[i]);
        }
    }
    return grid;
}

function near(actual, expected, tol, label) {
    assert.ok(Math.abs(actual - expected) <= tol, `${label}: ${actual} against ${expected}`);
}

test('the model steps at 120 Hz', () => {
    assert.equal(MODEL_HZ, 120);
});

for (const c of REF.cases) {
    test(`reference vector ${c.id}: end, frames and the half-second series`, () => {
        const r = runShotModel(c.steps, c.set, REF.puck, c.opt);
        near(r.end.t, c.end.t, TOL, 'end time');
        assert.equal(r.end.why, c.end.why);
        assert.equal(r.frames.length, c.frames.length);
        r.frames.forEach((f, i) => {
            assert.equal(f.k, c.frames[i].k);
            assert.equal(f.exit, c.frames[i].exit);
            near(f.t0, c.frames[i].t0, TOL, `frame ${i} start`);
            if (c.frames[i].t1 === null) assert.equal(f.t1, null);
            else near(f.t1, c.frames[i].t1, TOL, `frame ${i} end`);
        });
        const grid = halfSecondGrid(r.out);
        assert.equal(grid.t.length, c.grid.t.length);
        for (let i = 0; i < grid.t.length; i++) {
            near(grid.t[i], c.grid.t[i], TOL, `t ${i}`);
            near(grid.P[i], c.grid.P[i], TOL, `P at ${c.grid.t[i]} s`);
            near(grid.Q[i], c.grid.Q[i], TOL, `Q at ${c.grid.t[i]} s`);
            near(grid.W[i], c.grid.W[i], TOL, `W at ${c.grid.t[i]} s`);
        }
    });
}

const SHOT_TIMES = [
    ['first-test', 23.0],
    ['first-test-pressure-tau-0', 22.8],
    ['first-test-pressure-tau-0.25', 22.9],
    ['first-test-pressure-tau-1', 23.3],
    ['first-test-pressure-tau-2', 24.1],
    ['first-test-pressure-tau-4', 25.6],
    ['first-test-flow-tau-1.2', 29.0],
    ['fw-defaults', 19.6],
    ['first-test-smooth-1', 32.6],
    ['first-test-smooth-1-2', 24.3],
    ['fw-defaults-smooth-1', 29.2],
    ['fw-defaults-smooth-1-2', 23.9],
    ['first-test-grind-2', 39.9],
    ['first-test-grind-0.5', 14.8],
    ['first-test-second-filter-0.5', 23.4],
    ['first-test-smooth-all-ramp-times', 24.1],
];

for (const [id, seconds] of SHOT_TIMES) {
    test(`shot time of ${id} is ${seconds} s`, () => {
        const c = caseById(id);
        const r = runShotModel(c.steps, c.set, REF.puck, c.opt);
        near(r.end.t, seconds, 0.1, 'shot time');
    });
}

test('the reference cases cover every end reason and every step exit', () => {
    const ends = new Set(REF.cases.map((c) => c.end.why));
    assert.deepEqual([...ends].sort(), ['end', 'limit', 'stop']);
    const exits = new Set(REF.cases.flatMap((c) => c.frames.map((f) => f.exit)));
    for (const why of ['exit', 'time', 'weight', 'volume', 'stop', 'limit']) assert.ok(exits.has(why), why);
});

test('a smooth flow step leaves the puck settle state alone', () => {
    const steps = REF.steps.map((s, i) => ({ ...s, smooth: i === 0 }));
    const r = runShotModel(steps, REF.settings.firstTest, REF.puck, STOP);
    near(r.end.t, 32.6, 0.1, 'shot time');
    assert.ok(Math.abs(r.end.t - 27.6) > 1, `a ramp value written into the settle state gives about 27.6 s, got ${r.end.t}`);
    assert.equal(r.end.why, 'stop');
});

test('the same steps and settings give the same shot every run', () => {
    const a = runShotModel(REF.steps, REF.settings.firstTest, REF.puck, STOP);
    const b = runShotModel(REF.steps, REF.settings.firstTest, REF.puck, STOP);
    assert.deepEqual(a.out, b.out);
});

const FIRST_TEST_BLOCK = {
    version: 1,
    pump_curve: [
        { pressure: 1.0, flow: 20.0 }, { pressure: 3.0, flow: 12.0 },
        { pressure: 6.0, flow: 6.0 }, { pressure: 9.0, flow: 5.0 },
        { pressure: 12.0, flow: 4.0 },
    ],
    flow_tau: 0.5,
    flow_mode: 'both',
    pressure_tau: 0.5,
    pressure_mode: 'both',
    ramp_factor: 1.0,
};

test('the native shaping block of the first test gives the first test settings', () => {
    assert.deepEqual(settingsFromNativeShaping(FIRST_TEST_BLOCK), REF.settings.firstTest);
});

test('no native shaping block gives the firmware defaults', () => {
    assert.deepEqual(settingsFromNativeShaping(undefined), REF.settings.fwDefaults);
    assert.deepEqual(settingsFromNativeShaping(null), REF.settings.fwDefaults);
    assert.deepEqual({ ...FIRMWARE_DEFAULT_SETTINGS }, REF.settings.fwDefaults);
});

test('an empty block and an empty curve run as the firmware defaults', () => {
    assert.deepEqual(settingsFromNativeShaping({}), REF.settings.fwDefaults);
    assert.equal(settingsFromNativeShaping({ ...FIRST_TEST_BLOCK, pump_curve: [] }).curve, null);
});

test('each value runs as its wire step', () => {
    const set = settingsFromNativeShaping({
        ...FIRST_TEST_BLOCK,
        flow_tau: 0.509,
        pressure_tau: 0.511,
        ramp_factor: 0.989,
        pump_curve: [{ pressure: 0.96, flow: 19.96 }, { pressure: 2.96, flow: 12.04 }, ...FIRST_TEST_BLOCK.pump_curve.slice(2)],
    });
    assert.equal(set.fTau, 0.5);
    assert.equal(set.pTau, 0.52);
    assert.equal(set.pRamp, 0.98 * 0.52);
    assert.equal(set.fRamp, 0.98 * 0.5);
    assert.deepEqual(set.curve.slice(0, 2), [[1, 20], [3, 12]]);
    const rounded = settingsFromNativeShaping({ ...FIRST_TEST_BLOCK, flow_tau: 0.509 });
    const a = runShotModel(REF.steps, rounded, REF.puck, STOP);
    const b = runShotModel(REF.steps, REF.settings.firstTest, REF.puck, STOP);
    assert.equal(a.end.t, b.end.t);
});

test('a value whose product lands just under a half step still rounds up', () => {
    for (const [value, wire] of [[0.29, 0.3], [0.57, 0.58], [1.13, 1.14], [2.01, 2.02]]) {
        const set = settingsFromNativeShaping({ flow_tau: value, pressure_tau: value, ramp_factor: value });
        assert.equal(set.fTau, wire, `flow tau ${value}`);
        assert.equal(set.pTau, wire, `pressure tau ${value}`);
        assert.equal(set.pRamp, wire * wire, `pressure ramp from the ramp factor ${value}`);
        assert.equal(set.fRamp, wire * wire, `flow ramp from the ramp factor ${value}`);
        const times = settingsFromNativeShaping({ pressure_ramp_tau: value, flow_ramp_tau: value, pressure_filter_tau: value });
        assert.equal(times.pRamp, wire, `pressure ramp ${value}`);
        assert.equal(times.fRamp, wire, `flow ramp ${value}`);
        assert.equal(times.pFilt, wire, `second pressure filter ${value}`);
    }
    const curve = settingsFromNativeShaping({ pump_curve: [{ pressure: 1.25, flow: 19.95 }, { pressure: 2.45, flow: 0.05 }] }).curve;
    assert.deepEqual(curve, [[1.3, 20], [2.5, 0.1]]);
});

test('an unknown mode runs as both', () => {
    const set = settingsFromNativeShaping({ ...FIRST_TEST_BLOCK, flow_mode: 'up', pressure_mode: 'fall' });
    assert.equal(set.fMode, 'both');
    assert.equal(set.pMode, 'fall');
});

test('the test profile is the recorded profile with the reference values', () => {
    const recorded = RECORDED_WORKFLOW.profile.steps;
    PROFILE.steps.forEach((step, i) => {
        assert.equal(step.pump, REF.steps[i].pump);
        assert.deepEqual(Object.keys(step).sort(), Object.keys(recorded[i]).sort());
    });
});

test('the profile steps run as the reference steps', () => {
    const steps = stepsFromProfile(PROFILE);
    assert.deepEqual(steps, REF.steps);
    const r = runShotModel(steps, REF.settings.firstTest, REF.puck, STOP);
    const ref = runShotModel(REF.steps, REF.settings.firstTest, REF.puck, STOP);
    assert.equal(r.end.t, ref.end.t);
    near(r.end.t, 23.0, 0.1, 'shot time');
});

test('a smooth transition becomes a smooth step and a missing limiter gives no limit', () => {
    const profile = {
        steps: [{ ...PROFILE.steps[0], transition: 'smooth', limiter: null, exit: null }],
    };
    const [step] = stepsFromProfile(profile);
    assert.equal(step.smooth, true);
    assert.equal(step.L, 0);
    assert.equal(step.R, 0);
    assert.equal(step.exit, null);
});

test('the recorded profile maps without a loss', () => {
    const steps = stepsFromProfile(RECORDED_WORKFLOW.profile);
    assert.equal(steps.length, 3);
    assert.equal(steps[0].v, 12);
    assert.deepEqual(steps[0].exit, { type: 'pressure', cond: 'over', v: 4.5 });
    assert.deepEqual(steps[1].exit, { type: 'pressure', cond: 'under', v: 1 });
    assert.equal(steps[2].pump, 'pressure');
    assert.equal(steps[2].L, 6);
    assert.equal(steps[2].R, 3);
});

test('a profile the model cannot run gives no steps', () => {
    assert.equal(stepsFromProfile(null), null);
    assert.equal(stepsFromProfile({ steps: [] }), null);
    assert.equal(stepsFromProfile({ steps: [{ ...PROFILE.steps[0], pump: 'power' }] }), null);
    assert.equal(stepsFromProfile({ steps: [{ ...PROFILE.steps[0], transition: 'hold' }] }), null);
    assert.equal(stepsFromProfile({ steps: [{ ...PROFILE.steps[0], flow: undefined }] }), null);
});
