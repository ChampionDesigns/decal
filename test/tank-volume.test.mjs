/**
 * The tank's mm | mL choice, and the arithmetic under it.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    TANK_UNIT, TANK_UNITS, DEFAULT_TANK_UNIT, ML_PER_MM,
    normaliseTankUnit, mmToMillilitres, millilitresToMm,
    toDisplayLevel, fromDisplayLevel, tankDecimals,
} from '../src/lib/tank-volume.js';

describe('the tank unit', () => {
    test('two units, and the default is the wire\'s own', () => {
        assert.deepEqual([...TANK_UNITS], ['mm', 'mL']);
        assert.equal(DEFAULT_TANK_UNIT, TANK_UNIT.MM,
            'the machine reports millimetres, so millimetres is what "no opinion" means');
    });

    test('an unrecognised preference answers null rather than coercing', () => {
        /* THE FALLBACK IS THE CALLER'S DECISION. Coercing here would hide it: two call
         * sites could then default differently and neither would say so. */
        assert.equal(normaliseTankUnit('mm'), 'mm');
        assert.equal(normaliseTankUnit('mL'), 'mL');
        for (const junk of ['ml', 'ML', 'litres', '', null, undefined, 40]) {
            assert.equal(normaliseTankUnit(junk), null, `${junk} is not a tank unit`);
        }
    });
});

describe('the conversion is forty millilitres to the millimetre', () => {
    test('the decided figure, and it is NOT the old table', () => {
        assert.equal(ML_PER_MM, 40, 'the decision: "1mm = 40ml for the water tank"');
        assert.notEqual(mmToMillilitres(1), 16);
        assert.notEqual(mmToMillilitres(67), 2058, 'Slate\'s table tops out there; this does not');
    });

    test('millimetres to millilitres, and back', () => {
        for (const mm of [0, 1, 15, 42, 67]) {
            assert.equal(mmToMillilitres(mm), mm * 40);
            assert.equal(millilitresToMm(mm * 40), mm, 'the reverse is exact at every whole millimetre');
        }
    });

    test('neither unit has a fractional part to print', () => {
        /* Forty times an integer is an integer, and the machine reports depth as a whole
         * count of millimetres — so "40.0 mL" would invent a precision the measurement
         * does not have. */
        assert.equal(tankDecimals(), 0);
    });
});

describe('the display edge', () => {
    test('millimetres pass through; millilitres are converted', () => {
        assert.equal(toDisplayLevel(15, TANK_UNIT.MM), 15);
        assert.equal(toDisplayLevel(15, TANK_UNIT.ML), 600);
    });

    test('an absent reading stays absent, in either unit', () => {
        for (const unit of TANK_UNITS) {
            for (const absent of [undefined, null, NaN]) {
                const out = toDisplayLevel(absent, unit);
                assert.equal(Number.isFinite(out), false, `${absent} in ${unit} must not become a number`);
            }
        }
        assert.equal(toDisplayLevel(undefined, TANK_UNIT.ML), undefined, 'and it is the same value back');
    });

    test('a value entered on screen goes back to the wire in millimetres', () => {
        assert.equal(fromDisplayLevel(600, TANK_UNIT.ML), 15);
        assert.equal(fromDisplayLevel(15, TANK_UNIT.MM), 15);
        assert.equal(Number.isFinite(fromDisplayLevel(undefined, TANK_UNIT.ML)), false);
    });

    test('a round trip through the display edge changes nothing', () => {
        for (const mm of [0, 5, 15, 30, 67]) {
            for (const unit of TANK_UNITS) {
                assert.equal(fromDisplayLevel(toDisplayLevel(mm, unit), unit), mm);
            }
        }
    });
});
