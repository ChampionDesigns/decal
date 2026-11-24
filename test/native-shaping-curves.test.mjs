import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    BENGLE_PUMP_END, DE1_240V_CURVE, benglePumpLine, pumpCurveLine, rampResponse, stepResponse,
} from '../src/lib/native-shaping-curves.js';
import { FLOW_ZERO_SNAP, MODEL_HZ, pumpCeiling, switchTick } from '../src/lib/shot-model.js';
import { DEFAULT_PUMP_CURVE } from '../src/lib/native-shaping-rules.js';

const VEC = JSON.parse(readFileSync(new URL('./fixtures/native-shaping-vectors.json', import.meta.url), 'utf8'));

function along(line, P) {
    for (let i = 1; i < line.length; i++) {
        const [p0, q0] = line[i - 1];
        const [p1, q1] = line[i];
        if (P >= p0 && P <= p1) return p1 === p0 ? q1 : q0 + (q1 - q0) * (P - p0) / (p1 - p0);
    }
    return null;
}

describe('the Bengle pump line', () => {
    const line = benglePumpLine();

    test('is flat at 20 mL/s up to 5.5 bar', () => {
        for (const P of [0, 3, 5.5]) assert.equal(along(line, P), 20, `${P} bar`);
    });

    test('falls to 10 mL/s at 9.5 bar and to 0 at 13.5 bar', () => {
        assert.ok(Math.abs(along(line, 9.5) - 10) < 1e-9);
        assert.equal(along(line, 13.5), 0);
    });

    test('is the model ceiling at full flow', () => {
        for (let P = 0; P <= BENGLE_PUMP_END; P += 0.25) {
            assert.ok(Math.abs(along(line, P) - pumpCeiling(P)) < 1e-9, `${P} bar`);
        }
    });

    test('has the three corner points only', () => {
        assert.deepEqual(line, [[0, 20], [5.5, 20], [13.5, 0]]);
    });
});

describe('the DE1 240 V curve', () => {
    test('passes the five check values within 0.01 mL/s', () => {
        const checks = [[0, 10.66], [3, 7.935], [6, 5.632], [9, 3.599], [12, 1.788]];
        for (const [P, Q] of checks) {
            assert.ok(Math.abs(along(DE1_240V_CURVE, P) - Q) <= 0.01, `${P} bar`);
        }
    });

    test('is not the 120 V table', () => {
        assert.ok(Math.abs(along(DE1_240V_CURVE, 0) - 8.9) > 1);
        assert.ok(Math.abs(along(DE1_240V_CURVE, 12) - 3.83) > 1);
    });

    test('has 41 points from 0 to 12 bar in 0.3 bar steps', () => {
        assert.equal(DE1_240V_CURVE.length, 41);
        DE1_240V_CURVE.forEach(([P], i) => assert.ok(Math.abs(P - i * 0.3) < 1e-9));
    });
});

describe('the pump curve line', () => {
    test('starts at the fixed point and passes each curve point', () => {
        const line = pumpCurveLine(DEFAULT_PUMP_CURVE);
        assert.deepEqual(line[0], [0, 20]);
        for (const pt of DEFAULT_PUMP_CURVE) {
            assert.ok(Math.abs(along(line, pt.pressure) - pt.flow) < 1e-6, `${pt.pressure} bar`);
        }
    });

    test('an empty curve draws nothing', () => {
        assert.deepEqual(pumpCurveLine([]), []);
        assert.deepEqual(pumpCurveLine(null), []);
    });
});

describe('the mini chart responses', () => {
    test('a time constant of 0 gives the plain step', () => {
        const r = stepResponse('flow', 0, 'both');
        assert.deepEqual(r.shaped, r.raw);
    });

    test('a time constant slows the step in the modes it acts on', () => {
        const at = (r, t) => r.shaped[r.t.findIndex((x) => x >= t)];
        const both = stepResponse('pressure', 1, 'both');
        const fall = stepResponse('pressure', 1, 'fall');
        assert.ok(at(both, 0.5) < 6);
        assert.equal(at(fall, 0.5), 6);
        assert.ok(at(fall, 3) > 3);
    });

    test('a ramp time of 0 gives the plain ramp', () => {
        for (const kind of ['pressure', 'flow']) {
            const r = rampResponse(kind, 0);
            assert.deepEqual(r.shaped, r.raw, kind);
        }
        const lagged = rampResponse('pressure', 2);
        assert.ok(lagged.shaped[lagged.shaped.length - 1] < 9);
        const flow = rampResponse('flow', 2);
        assert.ok(flow.shaped[flow.shaped.length - 1] > 2);
    });

    test('the pressure ramp rises 2 to 9 bar and the flow ramp falls 6 to 2 mL/s, in 4 s from 0 s', () => {
        const p = rampResponse('pressure', 0);
        const q = rampResponse('flow', 0);
        assert.equal(p.t[0], -0.5);
        assert.ok(Math.abs(p.t.at(-1) - 5.5) < 1e-9);
        const at = (r, s) => r.raw[r.t.findIndex((x) => x >= s - 1e-9)];
        assert.equal(at(p, -0.5), 2);
        assert.equal(at(p, 4), 9);
        assert.equal(at(q, -0.5), 6);
        assert.equal(at(q, 4), 2);
        assert.ok(Math.abs(at(q, 2) - 4) < 1e-9);
    });

    test('the pressure ramp lags only when the pressure mode acts on a rising ramp', () => {
        const fall = rampResponse('pressure', 1, 'fall');
        assert.deepEqual(fall.shaped, fall.raw);
        for (const mode of ['both', 'rise']) {
            const r = rampResponse('pressure', 1, mode);
            assert.notDeepEqual(r.shaped, r.raw, mode);
            assert.ok(r.shaped[r.shaped.length - 1] < 9, mode);
        }
    });

    test('the flow ramp lags only when the flow mode acts on a falling ramp', () => {
        const rise = rampResponse('flow', 1, 'rise');
        assert.deepEqual(rise.shaped, rise.raw);
        for (const mode of ['both', 'fall']) {
            const r = rampResponse('flow', 1, mode);
            assert.notDeepEqual(r.shaped, r.raw, mode);
            assert.ok(r.shaped[r.shaped.length - 1] > 2, mode);
        }
    });

    test('the ramp drawing is the reference pressure ramp', () => {
        const v = VEC.smooth_pressure.find((r) => r.tau === 0.5 && r.seed === 2 && r.target === 9 && r.seconds === 4);
        const r = rampResponse('pressure', 0.5);
        let checked = 0;
        r.t.forEach((at, k) => {
            const n = Math.round(at * MODEL_HZ);
            if (n < 0 || n >= v.goal.length) return;
            assert.ok(Math.abs(r.shaped[k] - v.goal[n]) < 1e-9, `${at} s: ${r.shaped[k]} against ${v.goal[n]}`);
            checked++;
        });
        assert.ok(checked > 300, `${checked} samples`);
    });

    test('the first filter line is drawn only for a pressure step with a second filter', () => {
        assert.equal(stepResponse('pressure', 1, 'both').first, null);
        assert.equal(stepResponse('pressure', 1, 'both', 0).first, null);
        assert.equal(stepResponse('flow', 1, 'both', 1).first, null);
        const two = stepResponse('pressure', 1, 'both', 0.8);
        const one = stepResponse('pressure', 1, 'both');
        assert.deepEqual(two.first, one.shaped);
        assert.deepEqual(two.t, one.t);
        assert.notDeepEqual(two.shaped, one.shaped);
        const at = (arr, r, s) => arr[r.t.findIndex((x) => x >= s)];
        assert.ok(at(two.shaped, two, 1) < at(two.first, two, 1), 'the second filter lags the first');
    });

    test('the second filter follows the pressure mode', () => {
        const fall = stepResponse('pressure', 1, 'fall', 0.8);
        const plain = stepResponse('pressure', 1, 'fall');
        const rising = (r) => r.shaped.filter((_, k) => r.t[k] < 2.5);
        assert.deepEqual(rising(fall), rising(plain));
        assert.notDeepEqual(fall.shaped, plain.shaped);
    });

    test('the step drawing follows the limited curve', () => {
        const tau = 1.5;
        const N = switchTick(tau);
        const r = stepResponse('pressure', tau, 'both');
        const dt = 1 / MODEL_HZ;
        const curve = (n) => (n <= N
            ? 6 - 4.5 / (1 + n * dt / tau) ** 2
            : 6 - 4.5 / (1 + N * dt / tau) ** 2 * Math.exp(-(n - N) * dt / tau));
        r.t.forEach((at, k) => {
            const n = Math.round(at * MODEL_HZ);
            if (n < 0 || at >= 2.5) return;
            assert.ok(Math.abs(r.shaped[k] - curve(n)) < 1e-9, `${at} s: ${r.shaped[k]} against ${curve(n)}`);
        });
        const late = r.shaped[r.t.findIndex((x) => x >= 2.4)];
        const hyperbolic = 6 - 4.5 / (1 + 2.4 / tau) ** 2;
        assert.ok(late - hyperbolic > 0.02, `the curve after tau is not the old curve: ${late} against ${hyperbolic}`);
    });

    test('the flow step drawing snaps to 0 below the snap value', () => {
        const r = stepResponse('flow', 0.2, 'both');
        const tail = r.shaped.filter((_, k) => r.t[k] >= 2.5);
        assert.ok(tail.includes(0));
        assert.ok(tail.every((v) => v === 0 || v >= FLOW_ZERO_SNAP), 'no value between 0 and the snap value');
        const first = tail.indexOf(0);
        assert.ok(tail.slice(first).every((v) => v === 0));
    });
});
