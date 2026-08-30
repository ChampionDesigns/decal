/**
 * tank-volume.test.mjs — the tank's mm | mL choice, and the arithmetic under it.
 *
 * THE SETTING EXISTED AND NOTHING READ IT. `machine-water-tank-unit` has offered mm | mL
 * since the settings screen was built; `waterTankUnit` had no reader anywhere, so the Live
 * screen's Tank tile drew millimetres whichever the person picked. Found on 26 August 2026
 * by sweeping every settings row for something on the other end.
 *
 * THE FIGURE IS BEN'S. "1mm = 40ml for the water tank" (26 August 2026). Slate carries a
 * 68-entry non-linear table ported from the TCL skin that averages about 30 mL/mm and tops
 * out at 2058 mL; the two cannot both describe the same tank, and the one that governs is
 * the one from the person with the machine on the bench. That disagreement is asserted
 * here as well as written down, so a future "fix" back to Slate's table fails a test
 * rather than passing quietly.
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
    test('Ben\'s figure, and it is NOT Slate\'s table', () => {
        assert.equal(ML_PER_MM, 40, 'Ben, 26 August 2026: "1mm = 40ml for the water tank"');
        /* SLATE'S FIRST FEW ENTRIES, for the contrast: 1 mm -> 16 mL, 2 -> 43, 3 -> 70.
         * If this ever agrees with them again, someone has put the table back. */
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
        /* A TANK THAT HAS NOT REPORTED AND AN EMPTY TANK ARE DIFFERENT STATES, and 0 mL is
         * a claim about the second. The dash the tile already draws has to survive the
         * conversion, so a non-finite value comes back as itself. */
        for (const unit of TANK_UNITS) {
            for (const absent of [undefined, null, NaN]) {
                const out = toDisplayLevel(absent, unit);
                assert.equal(Number.isFinite(out), false, `${absent} in ${unit} must not become a number`);
            }
        }
        assert.equal(toDisplayLevel(undefined, TANK_UNIT.ML), undefined, 'and it is the same value back');
    });

    test('a value entered on screen goes back to the wire in millimetres', () => {
        /* Nothing in this build writes a tank LEVEL — the machine measures it — but the
         * low-water ALERT is a millimetre threshold a person sets, and the day that row is
         * offered in mL this is what keeps the wire in millimetres. */
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
