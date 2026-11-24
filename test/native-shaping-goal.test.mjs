import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    FLOW_ZERO_SNAP, MODEL_HZ, rampStart, runShotModel, settingsFromNativeShaping, shapedGoal, switchTick,
} from '../src/lib/shot-model.js';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const VEC = readJson('./fixtures/native-shaping-vectors.json');
const REF = readJson('./fixtures/shot-model-reference.json');
const DT = 1 / MODEL_HZ;
const TOL = 1e-6;

function goalOf(spec, inputs) {
    const next = shapedGoal(spec);
    return inputs.map((x) => next(x));
}

function largestError(actual, expected) {
    assert.equal(actual.length, expected.length);
    let worst = 0;
    for (let i = 0; i < actual.length; i++) worst = Math.max(worst, Math.abs(actual[i] - expected[i]));
    return worst;
}

function assertTicks(actual, expected, label) {
    const worst = largestError(actual, expected);
    assert.ok(worst <= TOL, `${label}: largest error ${worst}`);
}

function assertSwitchTick(v) {
    if (v.switch_tick === null) assert.equal(v.tau, 0, v.id);
    else assert.equal(switchTick(v.tau), v.switch_tick, v.id);
}

describe('the shaped goal against the reference vectors', () => {
    test('the vectors step at the model rate', () => {
        assert.equal(VEC.hz, MODEL_HZ);
    });

    for (const v of VEC.fast_pressure) {
        test(`fast pressure ${v.id} matches every tick`, () => {
            const spec = { pump: 'pressure', smooth: false, seed: v.seed, target: v.target, tau: v.tau, tau2: v.tau2, mode: v.mode };
            assertTicks(goalOf(spec, v.goal.map(() => v.target)), v.goal, v.id);
            assertSwitchTick(v);
        });
    }

    for (const v of VEC.smooth_pressure) {
        test(`smooth pressure ${v.id} matches every tick`, () => {
            const spec = { pump: 'pressure', smooth: true, seed: v.seed, target: v.target, tau: v.tau, mode: v.mode };
            assertTicks(goalOf(spec, v.ramp_input), v.goal, v.id);
            assertSwitchTick(v);
        });
    }

    for (const v of VEC.flow) {
        test(`flow ${v.id} matches every tick`, () => {
            const spec = { pump: 'flow', smooth: v.smooth, seed: v.seed, target: v.target, tau: v.tau, mode: v.mode };
            const inputs = v.smooth ? v.ramp_input : v.goal.map(() => v.target);
            const goal = goalOf(spec, inputs);
            assertTicks(goal, v.goal, v.id);
            assertSwitchTick(v);
            const firstZero = goal.findIndex((y) => y === 0);
            if (v.first_zero_tick === null) {
                assert.ok(firstZero === -1 || v.seed === 0, v.id);
            } else {
                assert.equal(firstZero, v.first_zero_tick, v.id);
                assert.ok(goal.slice(firstZero).every((y) => y === 0), v.id);
            }
        });
    }

    test('the ramp start of the model is the ramp start of the vectors', () => {
        for (const v of VEC.smooth_pressure) assert.equal(rampStart('pressure', v.seed), v.ramp_input[0], v.id);
        for (const v of VEC.flow.filter((f) => f.smooth)) assert.equal(rampStart('flow', v.seed), v.ramp_input[0], v.id);
        assert.equal(rampStart('pressure', 0), 0.01);
        assert.equal(rampStart('flow', 0), 0);
    });
});

describe('the limited curve', () => {
    for (const c of VEC.closed_form) {
        test(`a constant input at tau ${c.tau} gives the closed form`, () => {
            const N = switchTick(c.tau);
            assert.equal(N, c.switch_tick);
            const count = 10 * MODEL_HZ + 1;
            const goal = goalOf({ pump: 'pressure', smooth: false, seed: 2, target: 9, tau: c.tau, mode: 'both' }, Array(count).fill(9));
            const q = Math.exp(-DT / c.tau);
            let worst = 0;
            for (let n = 0; n < count; n++) {
                const exact = n <= N
                    ? 9 - 7 / (1 + n * DT / c.tau) ** 2
                    : 9 - 7 / (1 + N * DT / c.tau) ** 2 * q ** (n - N);
                worst = Math.max(worst, Math.abs(goal[n] - exact) / exact);
            }
            assert.ok(worst <= c.error + 0.01, `largest relative error ${worst}`);
            assert.ok(worst < 1e-12, `largest relative error ${worst}`);
        });
    }

    for (const [tau, N] of [[0.1, 12], [1.5, 180]]) {
        test(`the switch tick at tau ${tau} is the integer rule, not a float test`, () => {
            const step = Math.fround(1 / MODEL_HZ);
            assert.ok(Math.fround(N * step) > Math.fround(tau), 'a float32 test switches one tick early');
            assert.equal(switchTick(tau), N);
            const goal = goalOf({ pump: 'pressure', smooth: false, seed: 2, target: 9, tau, mode: 'both' }, Array(N + 3).fill(9));
            const k = (n) => (goal[n] - goal[n - 1]) / (9 - goal[n - 1]);
            const first = (n) => DT * (2 * tau + (2 * n - 1) * DT) / (tau + n * DT) ** 2;
            const late = 1 - Math.exp(-DT / tau);
            assert.ok(Math.abs(k(N) - first(N)) < 1e-12, `tick ${N} uses the first form`);
            assert.ok(Math.abs(k(N + 1) - late) < 1e-12, `tick ${N + 1} uses the late form`);
            assert.ok(Math.abs(first(N + 1) - late) > 1e-7, 'the two forms differ at the next tick');
        });
    }

    test('the switch tick holds for every tau on the wire step', () => {
        for (let byte = 0; byte <= 250; byte++) {
            const tau = byte / 50;
            let exact = 0;
            while (((exact + 1) * 5) <= byte * 12) exact++;
            assert.equal(switchTick(tau), exact, `tau ${tau}`);
        }
    });
});

describe('the second pressure filter', () => {
    test('a second filter of 0 gives the first filter alone', () => {
        const inputs = Array(601).fill(9);
        const none = goalOf({ pump: 'pressure', smooth: false, seed: 2, target: 9, tau: 1.12, mode: 'both' }, inputs);
        const zero = goalOf({ pump: 'pressure', smooth: false, seed: 2, target: 9, tau: 1.12, tau2: 0, mode: 'both' }, inputs);
        assert.deepEqual(zero, none);
        const N = switchTick(1.12);
        let y = 2;
        const own = [y];
        for (let n = 1; n < inputs.length; n++) {
            const r = (1.12 + (n - 1) * DT) / (1.12 + n * DT);
            y += (n <= N ? 1 - r * r : 1 - Math.exp(-DT / 1.12)) * (9 - y);
            own.push(y);
        }
        assert.ok(largestError(zero, own) < 1e-12);
    });

    test('the second filter acts only in fast pressure frames', () => {
        const ramp = VEC.smooth_pressure[0];
        const spec = { pump: 'pressure', smooth: true, seed: ramp.seed, target: ramp.target, tau: ramp.tau, mode: ramp.mode };
        assert.deepEqual(goalOf({ ...spec, tau2: 0.5 }, ramp.ramp_input), goalOf(spec, ramp.ramp_input));
        const flow = { pump: 'flow', smooth: false, seed: 4, target: 2, tau: 1, mode: 'both' };
        const inputs = Array(240).fill(2);
        assert.deepEqual(goalOf({ ...flow, tau2: 0.5 }, inputs), goalOf(flow, inputs));
    });

    test('the goal metrics of the puck flow match the reference', () => {
        const R = 0.65;
        const C = 0.5;
        const puck = (p) => (Math.max(p, 0) / R) ** (1 / 1.7);
        const near = (a, b, label) => assert.ok(Math.abs(a - b) <= 0.01, `${label}: ${a} against ${b}`);
        for (const m of VEC.goal_metrics) {
            const count = 20 * MODEL_HZ + 1;
            const p = goalOf({ pump: 'pressure', smooth: false, seed: 2, target: 9, tau: m.tau, tau2: m.tau2, mode: 'both' }, Array(count).fill(9));
            const t = p.map((_, i) => i * DT);
            const q = p.map((v, i) => {
                const a = Math.max(i - 1, 0);
                const b = Math.min(i + 1, count - 1);
                return puck(v) + C * (p[b] - p[a]) / (t[b] - t[a]);
            });
            const reach = (frac) => t[p.findIndex((v) => v >= 2 + frac * 7)];
            let k = 0;
            for (let i = 1; i < count; i++) if (q[i] > q[k]) k = i;
            const label = `tau ${m.tau}, second filter ${m.tau2}`;
            near(reach(0.5), m.t50, `${label} t50`);
            near(reach(0.9), m.t90, `${label} t90`);
            near(reach(0.99), m.t99, `${label} t99`);
            near(q[k], m.peak_flow, `${label} peak flow`);
            near(t[k], m.peak_at, `${label} peak time`);
            near(q[0], m.flow_at_0, `${label} flow at 0 s`);
            near(puck(2), m.flow_before, `${label} flow before`);
        }
    });
});

describe('the steps that the curve leaves alone', () => {
    test('a fast frame with tau 0 or the mode off gives the step on every tick', () => {
        const inputs = Array(120).fill(6);
        for (const spec of [
            { pump: 'pressure', smooth: false, seed: 9, target: 6, tau: 0, mode: 'both' },
            { pump: 'pressure', smooth: false, seed: 9, target: 6, tau: 1, mode: 'rise' },
            { pump: 'flow', smooth: false, seed: 9, target: 6, tau: 0, mode: 'both' },
            { pump: 'flow', smooth: false, seed: 9, target: 6, tau: 1, mode: 'rise' },
        ]) {
            assert.deepEqual(goalOf(spec, inputs), inputs, JSON.stringify(spec));
        }
    });

    test('a smooth frame with tau 0 or the mode off gives the pure ramp', () => {
        const up = VEC.smooth_pressure[0].ramp_input;
        const down = VEC.smooth_pressure[1].ramp_input;
        assert.deepEqual(goalOf({ pump: 'pressure', smooth: true, seed: 2, target: 9, tau: 0, mode: 'both' }, up), up);
        assert.deepEqual(goalOf({ pump: 'pressure', smooth: true, seed: 9, target: 6, tau: 1, mode: 'rise' }, down), down);
        assert.deepEqual(goalOf({ pump: 'flow', smooth: true, seed: 9, target: 6, tau: 1, mode: 'rise' }, down), down);
    });

    test('a fast pressure frame of 0 bar gives 0 on every tick', () => {
        const goal = goalOf({ pump: 'pressure', smooth: false, seed: 6, target: 0, tau: 1, tau2: 0.5, mode: 'both' }, Array(60).fill(0));
        assert.ok(goal.every((y) => y === 0));
    });
});

describe('the flow zero snap', () => {
    test('the snap is at 0.01 mL/s', () => {
        assert.equal(FLOW_ZERO_SNAP, 0.01);
        const first = (seed, smooth) => shapedGoal({ pump: 'flow', smooth, seed, target: 0, tau: 1, mode: 'both' })(0);
        for (const smooth of [false, true]) {
            assert.equal(first(0.011, smooth), 0.011, 'a goal of 0.011 mL/s does not snap');
            assert.equal(first(0.009, smooth), 0, 'a goal of 0.009 mL/s snaps');
        }
    });

    test('the snap acts only on a flow target of 0', () => {
        const goal = goalOf({ pump: 'flow', smooth: false, seed: 0.009, target: 0.005, tau: 1, mode: 'both' }, Array(10).fill(0.005));
        assert.equal(goal[0], 0.009);
        assert.ok(goal.every((y) => y > 0));
    });

    test('the filter goes on under the snap', () => {
        const v = VEC.flow.find((f) => f.first_zero_tick !== null);
        const next = shapedGoal({ pump: 'flow', smooth: false, seed: v.seed, target: 0, tau: v.tau, mode: v.mode });
        const goal = v.goal.map(() => next(0));
        const after = goal.slice(v.first_zero_tick);
        assert.ok(after.every((y) => y === 0));
        assert.ok(goal[v.first_zero_tick - 1] >= FLOW_ZERO_SNAP);
    });
});

describe('the ramp times of a block', () => {
    test('the ramp time keys are read on the wire step', () => {
        const set = settingsFromNativeShaping({
            flow_tau: 0.5, pressure_tau: 0.5, pressure_ramp_tau: 1.009, flow_ramp_tau: 0.211, pressure_filter_tau: 0.29,
        });
        assert.equal(set.pRamp, 1.0);
        assert.equal(set.fRamp, 0.22);
        assert.equal(set.pFilt, 0.3);
    });

    test('a block with only a ramp factor gives the ramp factor times each tau', () => {
        const set = settingsFromNativeShaping({ flow_tau: 1.2, pressure_tau: 0.4, ramp_factor: 2 });
        assert.equal(set.pRamp, 0.8);
        assert.equal(set.fRamp, 2.4);
        assert.equal(set.pFilt, 0);
    });

    test('a ramp from a ramp factor has no upper limit', () => {
        const set = settingsFromNativeShaping({ flow_tau: 5, pressure_tau: 2, ramp_factor: 4 });
        assert.equal(set.pRamp, 8);
        assert.equal(set.fRamp, 20);
    });

    test('a ramp time key wins over a ramp factor', () => {
        const set = settingsFromNativeShaping({ flow_tau: 1.2, pressure_tau: 0.4, ramp_factor: 2, pressure_ramp_tau: 0.3 });
        assert.equal(set.pRamp, 0.3);
        assert.equal(set.fRamp, 0);
    });

    test('no ramp key and no ramp factor give a ramp factor of 1', () => {
        const set = settingsFromNativeShaping({ flow_tau: 1.2, pressure_tau: 0.4 });
        assert.equal(set.pRamp, 0.4);
        assert.equal(set.fRamp, 1.2);
    });

    test('a block with no tau gives the pure ramp', () => {
        const set = settingsFromNativeShaping({ ramp_factor: 2 });
        assert.equal(set.pRamp, 0);
        assert.equal(set.fRamp, 0);
    });
});

describe('the model runs the shaped goal', () => {
    const SPEC = REF.steps[2];

    function only(step) {
        return [{ ...SPEC, exit: null, vol: 0, wt: 0, sec: 4, ...step }];
    }

    function goalAtRecords(out, key, goal) {
        for (let j = 1; j < out.t.length; j++) {
            const tick = Math.round(out.t[j] * MODEL_HZ) - 1;
            const want = Math.round(goal[tick] * 1000) / 1000;
            assert.ok(Math.abs(out[key][j] - want) < 1e-9, `${key} at ${out.t[j]} s: ${out[key][j]} against ${want}`);
        }
    }

    test('a fast pressure frame runs the first and the second filter', () => {
        const set = { curve: null, fTau: 0, fMode: 'both', pTau: 1.12, pMode: 'both', pRamp: 0, fRamp: 0, pFilt: 0.5 };
        const r = runShotModel(only({ pump: 'pressure', v: 9, smooth: false }), set, REF.puck, { tMax: 5 });
        const goal = goalOf({ pump: 'pressure', smooth: false, seed: 0, target: 9, tau: 1.12, tau2: 0.5, mode: 'both' }, Array(600).fill(9));
        goalAtRecords(r.out, 'tP', goal);
    });

    test('a smooth flow frame runs the flow ramp time', () => {
        const set = { curve: null, fTau: 0.5, fMode: 'both', pTau: 0, pMode: 'both', pRamp: 0, fRamp: 0.5, pFilt: 0 };
        const r = runShotModel(only({ pump: 'flow', v: 4, smooth: true, sec: 3 }), set, REF.puck, { tMax: 3 });
        const ramp = Array.from({ length: 360 }, (_, n) => 4 * Math.min(n / 360, 1));
        const goal = goalOf({ pump: 'flow', smooth: true, seed: 0, target: 4, tau: 0.5, mode: 'both' }, ramp);
        goalAtRecords(r.out, 'tQ', goal);
    });
});
