import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    checkNativeShaping,
    pointLimits,
    movePoint,
    DEFAULT_PUMP_CURVE,
    NATIVE_SHAPING_DEFAULTS,
    NATIVE_SHAPING_RULE as RULE,
} from '../src/lib/native-shaping-rules.js';
import { parseYaml } from '../scripts/lib/yaml-subset.js';
import { REA_ROOT } from '../scripts/lib/rea-source.js';
import { REST_REL } from '../scripts/generate-rea-routes.js';

const SPEC = parseYaml(readFileSync(join(REA_ROOT, REST_REL), 'utf8'), { file: REST_REL });
const SPEC_EXAMPLE = SPEC.components.schemas.NativeShaping.example;

function curve(...pairs) {
    return pairs.map(([pressure, flow]) => ({ pressure, flow }));
}

function check(block) {
    return checkNativeShaping(block);
}

function refused(block, field, rule) {
    const r = check(block);
    assert.equal(r.ok, false, `${field} should be refused`);
    assert.equal(r.block, null);
    assert.ok(
        r.errors.some((e) => e.field === field && e.rule === rule),
        `expected ${field} ${rule}, got ${JSON.stringify(r.errors)}`,
    );
}

describe('the spec example', () => {
    test('is the default curve of the editor', () => {
        assert.deepEqual(SPEC_EXAMPLE.pump_curve, DEFAULT_PUMP_CURVE.map((p) => ({ ...p })));
    });

    test('round-trips unchanged', () => {
        const r = check(SPEC_EXAMPLE);
        assert.equal(r.ok, true, JSON.stringify(r.errors));
        assert.deepEqual(r.block, SPEC_EXAMPLE);
    });
});

describe('defaults', () => {
    test('an empty object takes every default', () => {
        const r = check({});
        assert.equal(r.ok, true);
        assert.deepEqual(r.block, { ...NATIVE_SHAPING_DEFAULTS, pump_curve: [] });
    });

    test('null values take the defaults', () => {
        const r = check({ version: null, pump_curve: null, flow_tau: null, flow_mode: null, ramp_factor: null });
        assert.equal(r.ok, true);
        assert.equal(r.block.version, 1);
        assert.deepEqual(r.block.pump_curve, []);
        assert.equal(r.block.flow_tau, 0);
        assert.equal(r.block.flow_mode, 'both');
        assert.equal(r.block.ramp_factor, 1);
    });

    test('a block that is not an object is refused', () => {
        for (const bad of [null, [], 'x', 3]) assert.equal(check(bad).ok, false);
    });
});

describe('point pressure', () => {
    test('13.5 bar passes', () => {
        assert.equal(check({ pump_curve: curve([13.5, 1]) }).ok, true);
    });

    test('13.55 rounds to 13.6 and is refused', () => {
        refused({ pump_curve: curve([13.55, 1]) }, 'pump_curve[0].pressure', RULE.RANGE);
    });

    test('13.54 rounds to 13.5 and passes as 13.5', () => {
        const r = check({ pump_curve: curve([13.54, 1]) });
        assert.equal(r.ok, true);
        assert.equal(r.block.pump_curve[0].pressure, 13.5);
    });

    test('0.45 rounds half up to 0.5 and passes', () => {
        const r = check({ pump_curve: curve([0.45, 1]) });
        assert.equal(r.ok, true, JSON.stringify(r.errors));
        assert.equal(r.block.pump_curve[0].pressure, 0.5);
    });

    test('0.44 rounds to 0.4 and is refused', () => {
        refused({ pump_curve: curve([0.44, 1]) }, 'pump_curve[0].pressure', RULE.RANGE);
    });

    test('a spacing of 0.5 bar passes', () => {
        assert.equal(check({ pump_curve: curve([1, 10], [1.5, 9]) }).ok, true);
    });

    test('a spacing of 0.4 bar is refused', () => {
        refused({ pump_curve: curve([1, 10], [1.4, 9]) }, 'pump_curve[1].pressure', RULE.PRESSURE_RISE);
    });

    test('the spacing is checked after rounding', () => {
        assert.equal(check({ pump_curve: curve([1.04, 10], [1.45, 9]) }).ok, true);
        refused({ pump_curve: curve([1.05, 10], [1.54, 9]) }, 'pump_curve[1].pressure', RULE.PRESSURE_RISE);
    });

    test('a point that is not a number is refused', () => {
        refused({ pump_curve: [{ pressure: 'a', flow: 1 }] }, 'pump_curve[0].pressure', RULE.NUMBER);
        refused({ pump_curve: [{ flow: 1 }] }, 'pump_curve[0].pressure', RULE.NUMBER);
        refused({ pump_curve: [{ pressure: Number.NaN, flow: 1 }] }, 'pump_curve[0].pressure', RULE.NUMBER);
    });
});

describe('point flow', () => {
    test('20 mL/s passes', () => {
        assert.equal(check({ pump_curve: curve([1, 20]) }).ok, true);
    });

    test('20.05 rounds to 20.1 and is refused', () => {
        refused({ pump_curve: curve([1, 20.05]) }, 'pump_curve[0].flow', RULE.RANGE);
    });

    test('0 mL/s passes and a negative flow is refused', () => {
        assert.equal(check({ pump_curve: curve([1, 0]) }).ok, true);
        refused({ pump_curve: curve([1, -0.1]) }, 'pump_curve[0].flow', RULE.RANGE);
    });

    test('a rising flow is refused', () => {
        refused({ pump_curve: curve([1, 10], [2, 10.1]) }, 'pump_curve[1].flow', RULE.FLOW_RISE);
    });

    test('an equal flow passes', () => {
        assert.equal(check({ pump_curve: curve([1, 10], [2, 10]) }).ok, true);
    });
});

describe('the time constants and the ramp factor', () => {
    for (const field of ['flow_tau', 'pressure_tau']) {
        test(`${field} 5.0 passes`, () => {
            const r = check({ [field]: 5.0 });
            assert.equal(r.ok, true);
            assert.equal(r.block[field], 5);
        });

        test(`${field} 5.01 rounds to 5.02 and is refused`, () => {
            refused({ [field]: 5.01 }, field, RULE.RANGE);
        });

        test(`${field} 0 passes and below 0 is refused`, () => {
            assert.equal(check({ [field]: 0 }).ok, true);
            refused({ [field]: -0.02 }, field, RULE.RANGE);
        });

        test(`${field} rounds half up to 0.02`, () => {
            assert.equal(check({ [field]: 0.51 }).block[field], 0.52);
            assert.equal(check({ [field]: 0.509 }).block[field], 0.5);
        });
    }

    test('ramp 4.0 passes', () => {
        const r = check({ ramp_factor: 4.0 });
        assert.equal(r.ok, true);
        assert.equal(r.block.ramp_factor, 4);
    });

    test('ramp 4.01 rounds to 4.02 and is refused', () => {
        refused({ ramp_factor: 4.01 }, 'ramp_factor', RULE.RANGE);
    });

    test('ramp 0 passes', () => {
        assert.equal(check({ ramp_factor: 0 }).block.ramp_factor, 0);
    });
});

describe('modes and version', () => {
    test('both, rise and fall pass for each mode', () => {
        for (const m of ['both', 'rise', 'fall']) {
            const r = check({ flow_mode: m, pressure_mode: m });
            assert.equal(r.ok, true);
            assert.equal(r.block.flow_mode, m);
            assert.equal(r.block.pressure_mode, m);
        }
    });

    test('another mode is refused', () => {
        refused({ flow_mode: 'up' }, 'flow_mode', RULE.MODE);
        refused({ pressure_mode: 'BOTH' }, 'pressure_mode', RULE.MODE);
    });

    test('version 1 passes and version 2 is refused', () => {
        assert.equal(check({ version: 1 }).ok, true);
        refused({ version: 2 }, 'version', RULE.VERSION);
        refused({ version: '1' }, 'version', RULE.VERSION);
    });
});

describe('the point count', () => {
    const eight = curve([1, 20], [2, 18], [3, 16], [4, 14], [5, 12], [6, 10], [7, 8], [8, 6]);

    test('0, 3 and 8 points are valid', () => {
        assert.equal(check({ pump_curve: [] }).ok, true);
        assert.equal(check({ pump_curve: curve([1, 18], [5, 10], [10, 3]) }).ok, true);
        const r = check({ pump_curve: eight });
        assert.equal(r.ok, true);
        assert.equal(r.block.pump_curve.length, 8);
    });

    test('9 points are refused', () => {
        refused({ pump_curve: [...eight, { pressure: 9, flow: 4 }] }, 'pump_curve', RULE.COUNT);
    });

    test('a curve that is not an array is refused', () => {
        refused({ pump_curve: {} }, 'pump_curve', RULE.TYPE);
    });
});

describe('moving a point', () => {
    const five = DEFAULT_PUMP_CURVE.map((p) => ({ ...p }));

    test('the limits of an inner point come from its neighbours', () => {
        assert.deepEqual(pointLimits(five, 2), { pMin: 3.5, pMax: 8.5, qMin: 5, qMax: 12 });
    });

    test('the first point is held under the fixed 20 mL/s and over 0.5 bar', () => {
        assert.deepEqual(pointLimits(five, 0), { pMin: 0.5, pMax: 2.5, qMin: 12, qMax: 20 });
    });

    test('the last point is held under 13.5 bar and over 0 mL/s', () => {
        assert.deepEqual(pointLimits(five, 4), { pMin: 9.5, pMax: 13.5, qMin: 0, qMax: 5 });
    });

    test('a move stops at each limit and rounds to 0.1', () => {
        assert.deepEqual(movePoint(five, 2, 100, 100)[2], { pressure: 8.5, flow: 12 });
        assert.deepEqual(movePoint(five, 2, -100, -100)[2], { pressure: 3.5, flow: 5 });
        assert.deepEqual(movePoint(five, 2, 6.04, 6.06)[2], { pressure: 6, flow: 6.1 });
        assert.deepEqual(movePoint(five, 4, 20, -1)[4], { pressure: 13.5, flow: 0 });
    });

    test('a moved curve keeps its count and stays valid', () => {
        for (const start of [five, curve([1, 18], [5, 10], [10, 3]),
            curve([1, 20], [2, 18], [3, 16], [4, 14], [5, 12], [6, 10], [7, 8], [8, 6])]) {
            let pts = start;
            for (let i = 0; i < pts.length; i += 1) {
                pts = movePoint(pts, i, 100, 100);
                pts = movePoint(pts, i, -100, -100);
                pts = movePoint(pts, i, pts[i].pressure + 0.3, pts[i].flow - 0.7);
            }
            const r = check({ pump_curve: pts });
            assert.equal(r.ok, true, JSON.stringify(r.errors));
            assert.equal(r.block.pump_curve.length, start.length);
        }
    });

    test('a move does not change the other points', () => {
        const out = movePoint(five, 1, 4, 10);
        assert.deepEqual(out.filter((_, i) => i !== 1), five.filter((_, i) => i !== 1));
    });
});
