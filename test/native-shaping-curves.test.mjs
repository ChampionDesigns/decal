import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    BENGLE_PUMP_END, DE1_240V_CURVE, benglePumpLine, pumpCurveLine, rampResponse, stepResponse,
} from '../src/lib/native-shaping-curves.js';
import { pumpCeiling } from '../src/lib/shot-model.js';
import { DEFAULT_PUMP_CURVE } from '../src/lib/native-shaping-rules.js';

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

    test('a ramp factor of 0 gives the plain ramp', () => {
        const r = rampResponse(0, 1);
        assert.deepEqual(r.shaped, r.raw);
        const lagged = rampResponse(2, 1);
        assert.ok(lagged.shaped[lagged.shaped.length - 1] < 9);
    });

    test('the ramp lags only when the pressure mode acts on a rising ramp', () => {
        const fall = rampResponse(1, 1, 'fall');
        assert.deepEqual(fall.shaped, fall.raw);
        for (const mode of ['both', 'rise']) {
            const r = rampResponse(1, 1, mode);
            assert.notDeepEqual(r.shaped, r.raw, mode);
            assert.ok(r.shaped[r.shaped.length - 1] < 9, mode);
        }
    });
});
