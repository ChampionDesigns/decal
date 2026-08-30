/**
 *.5, the step-matrix cluster's MODEL half.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    STEP_MATRIX_ROWS,
    STEP_MATRIX_ROW_KEYS,
    CELL_KINDS,
    PROBE_OPTIONS,
    CELL_NAME_KEY,
    STEP_NAME_KEY,
    STEP_ORDINAL_KEY,
    HELD_TARGET_TEXT,
    matrixRow,
    isHeldTarget,
    cellKindFor,
    fieldFor,
    readValue,
    bankOptionsFor,
    enumerateMatrixCells,
} from '../src/lib/step-matrix-rows.js';
import { createEditorRanges, EDITOR_RANGE_FIELD_IDS } from '../src/lib/editor-ranges.js';
import { AUTHORING_RANGES, MODE_TABLE, PUMP_MODE_CYCLE, modeRanges } from '../src/lib/profile-modes.js';
import { limitsFor } from '../src/lib/machine-limits.js';
import { translations } from '../src/lib/i18n.js';

/** A step in the shape ReaPrime serves. VALUES ONLY — never a bound (B2). */
const step = (over = {}) => ({
    name: 'Preinfusion',
    pump: 'flow',
    transition: 'fast',
    exit: null,
    volume: 0,
    seconds: 30,
    weight: 0,
    temperature: 92,
    sensor: 'coffee',
    flow: 4,
    limiter: { value: 9, range: 0.6 },
    ...over,
});

const doorFor = (machineClass = 'bengle') => createEditorRanges({
    machineLimits: limitsFor(machineClass),
    machineClass,
});

describe('the ten rows, and Slate\'s own order', () => {
    test('the row list is the carried GRID_ROW_KEYS with a head and an action row', () => {
        assert.deepEqual(STEP_MATRIX_ROW_KEYS, [
            'head', 'temperature', 'probe', 'pump', 'transition',
            'target', 'limiter', 'duration', 'exits', 'actions',
        ]);
        assert.equal(STEP_MATRIX_ROWS.length, 10,
            'ten rows — the same ten Slate spelled as ten !important track heights');
    });

    test('every row declares a kind the inventory can fill', () => {
        for (const row of STEP_MATRIX_ROWS) {
            assert.ok(CELL_KINDS.includes(row.kind) || row.kind === 'target',
                `${row.key}: "${row.kind}" is not a primitive this matrix composes`);
        }
    });

    test('two group seams, and they are Slate\'s own GRID_GROUP_END plus the head rule', () => {
        const ends = STEP_MATRIX_ROWS.filter((row) => row.groupEnd).map((row) => row.key);
        assert.deepEqual(ends, ['head', 'probe', 'limiter'],
            'three horizontal rules only (profile-editor-v3.css:333-338)');
    });

    test('an unknown row is refused, never answered with a plausible one (A7)', () => {
        assert.throws(() => matrixRow('temp'), /not a matrix row/);
        assert.equal(matrixRow('limiter').key, 'limiter');
    });

    test('NOT ONE BOUND IS DECLARED IN THE ROW MODEL (B2)', () => {
        const banned = new Set(['min', 'max', 'step', 'ceiling', 'floor', 'limit']);
        const walk = (value, path) => {
            if (!value || typeof value !== 'object') return;
            for (const [key, inner] of Object.entries(value)) {
                assert.ok(!banned.has(key),
                    `${path}.${key} is a bound, and the row model declares none (B2)`);
                walk(inner, `${path}.${key}`);
            }
        };
        walk(STEP_MATRIX_ROWS, 'STEP_MATRIX_ROWS');
        walk(PROBE_OPTIONS, 'PROBE_OPTIONS');
        for (const row of STEP_MATRIX_ROWS) {
            for (const [, inner] of Object.entries(row)) {
                assert.notEqual(typeof inner, 'number',
                    `${row.key} carries a number, and a row has no number to carry`);
            }
        }
    });

    test('every ranged row names a field id the ONE door declares', () => {
        const ranged = STEP_MATRIX_ROWS.filter((row) => row.rangeField);
        assert.deepEqual(ranged.map((row) => row.key), ['temperature', 'target', 'limiter', 'duration']);
        for (const row of ranged) {
            assert.ok(EDITOR_RANGE_FIELD_IDS.includes(row.rangeField),
                `${row.key} -> ${row.rangeField} is not an editor-ranges field`);
        }
    });

    test('and the door hands back the owning table\'s OWN object, never a copy', () => {
        for (const machineClass of ['bengle', 'de1']) {
            const door = doorFor(machineClass);
            assert.ok(Object.is(door.rangeFor('stepSeconds'), AUTHORING_RANGES.seconds));
            assert.ok(Object.is(door.rangeFor('stepTemperature'), limitsFor(machineClass).brewTemp));
            for (const pump of PUMP_MODE_CYCLE) {
                assert.ok(Object.is(door.rangeFor('stepTarget', { pump }),
                    modeRanges(pump, machineClass).target), `${machineClass} ${pump} target`);
                assert.ok(Object.is(door.rangeFor('stepLimiter', { pump }),
                    modeRanges(pump, machineClass).limiter), `${machineClass} ${pump} limiter`);
            }
        }
        assert.equal(doorFor('bengle').rangeFor('stepTarget', { pump: 'flow' }).max, 20);
        assert.equal(doorFor('bengle').rangeFor('stepLimiter', { pump: 'pressure' }).max, 20);
        assert.equal(doorFor('de1').rangeFor('stepTarget', { pump: 'flow' }).max, 15);
        assert.equal(doorFor('de1').rangeFor('stepLimiter', { pump: 'pressure' }).max, 8);
    });
});

describe('what one cell is, for one step', () => {
    test('the Target row is a stepper, and a locked box on a HOLD step', () => {
        const target = matrixRow('target');
        assert.equal(cellKindFor(target, step()), 'stepper');
        assert.equal(cellKindFor(target, step({ transition: 'hold' })), 'locked');
        assert.equal(isHeldTarget(step({ transition: 'hold' })), true);
        assert.equal(isHeldTarget(step()), false);
    });

    test('no other row changes primitive with the step', () => {
        for (const row of STEP_MATRIX_ROWS) {
            if (row.key === 'target') continue;
            assert.equal(cellKindFor(row, step()), row.kind);
            assert.equal(cellKindFor(row, step({ transition: 'hold', pump: 'lever' })), row.kind);
        }
    });

    test('the Target row writes the MODE\'s own key, and the lever\'s target is P0', () => {
        const target = matrixRow('target');
        assert.equal(fieldFor(target, step({ pump: 'flow' })), MODE_TABLE.flow.targetKey);
        assert.equal(fieldFor(target, step({ pump: 'pressure' })), 'pressure');
        assert.equal(fieldFor(target, step({ pump: 'power' })), 'power');
        assert.equal(fieldFor(target, step({ pump: 'lever' })), 'pressure',
            'P0 is stored in the pressure key — a preset never touches it');
    });

    test('an unrecognised pump is refused rather than read as flow (A7)', () => {
        assert.throws(() => fieldFor(matrixRow('target'), step({ pump: 'turbo' })),
            /is not a pump mode/);
    });

    test('the limiter cell reads the limiter\'s VALUE off the served shape', () => {
        assert.equal(readValue(matrixRow('limiter'), step()), 9);
        assert.equal(readValue(matrixRow('limiter'), step({ limiter: null })), null);
        assert.equal(readValue(matrixRow('temperature'), step()), 92);
        assert.equal(readValue(matrixRow('duration'), step()), 30);
        assert.equal(readValue(matrixRow('target'), step({ pump: 'flow', flow: 6 })), 6);
    });

    test('a missing value is null and never a stand-in number', () => {
        const bare = { pump: 'flow' };
        assert.equal(readValue(matrixRow('temperature'), bare), null);
        assert.equal(readValue(matrixRow('duration'), bare), null);
        assert.equal(readValue(matrixRow('temperature'), null), null);
    });
});

describe('the three segmented rows take the ports\' decisions', () => {
    test('Probe is the two-value enum, and nothing else', () => {
        const bank = bankOptionsFor(matrixRow('probe'), step(), 0, {});
        assert.deepEqual(bank.options.map((o) => o.value), ['coffee', 'water']);
        assert.equal(bank.value, 'coffee');
        assert.equal(bank.readOnly, false);
    });

    test('Pump is pumpChipsFor: two modes ungated, four when offered', () => {
        const row = matrixRow('pump');
        assert.deepEqual(bankOptionsFor(row, step(), 0, {}).options.map((o) => o.value),
            ['pressure', 'flow']);
        assert.deepEqual(
            bankOptionsFor(row, step(), 0, { pumpModesOffered: true }).options.map((o) => o.value),
            ['pressure', 'flow', 'power', 'lever'],
        );
        assert.deepEqual(
            bankOptionsFor(row, step({ pump: 'lever' }), 0, {}).options.map((o) => o.value),
            ['pressure', 'flow', 'lever'],
            'a loaded advanced profile keeps its own chip so it stays full-fidelity',
        );
    });

    test('Transition is transitionSegments, greying rather than vanishing', () => {
        const row = matrixRow('transition');
        const plain = bankOptionsFor(row, step(), 1, {});
        assert.deepEqual(plain.options.map((o) => o.value), ['fast', 'smooth']);
        const withHold = bankOptionsFor(row, step(), 1, { holdOffered: true });
        assert.deepEqual(withHold.options.map((o) => o.value), ['fast', 'smooth', 'hold']);
        assert.equal(withHold.options.find((o) => o.value === 'hold').disabled, false);
        const first = bankOptionsFor(row, step(), 0, { holdOffered: true });
        assert.equal(first.options.find((o) => o.value === 'hold').disabled, true,
            'HOLD is not authorable on the first step');
        const lever = bankOptionsFor(row, step({ pump: 'lever' }), 1, { holdOffered: true });
        assert.equal(lever.readOnly, true, 'a lever step pins JUMP');
        assert.equal(lever.value, 'fast');
    });

    test('a row that is not a bank refuses to answer as one', () => {
        assert.throws(() => bankOptionsFor(matrixRow('temperature'), step(), 0, {}),
            /is not a bank row/);
    });
});

describe('D2 — every label is a key, and the composed names are templates', () => {
    test('the per-cell name is one key with two placeholders, never two joined strings', () => {
        assert.match(CELL_NAME_KEY, /\{label\}/);
        assert.match(CELL_NAME_KEY, /\{n\}/);
        assert.match(STEP_NAME_KEY, /\{n\}/);
        assert.match(STEP_ORDINAL_KEY, /\{n\}.*\{total\}/);
    });

    test('every label is ENGLISH TEXT, so an untranslated string is never an identifier', () => {
        const keys = [
            ...STEP_MATRIX_ROWS.map((row) => row.label),
            ...PROBE_OPTIONS.map((option) => option.label),
            CELL_NAME_KEY, STEP_NAME_KEY, STEP_ORDINAL_KEY, HELD_TARGET_TEXT,
        ];
        for (const key of keys) {
            assert.ok(key.length > 0, 'an empty key is not a string anyone can translate');
            assert.ok(!/^[a-z]+([._][a-z]+)+$/.test(key), `${key} reads as an identifier, not English`);
            assert.equal(translations.t(key, { label: 'Pump', n: 1, total: 2 }).includes('{'), false,
                `${key} leaves a placeholder unfilled`);
        }
    });

    test('the placeholders are filled by t(), so a word order change survives', () => {
        const filled = translations.t(CELL_NAME_KEY, { label: 'Temperature', n: 3 });
        assert.match(filled, /Temperature/);
        assert.match(filled, /3/);
        assert.ok(!filled.includes('{'), `placeholder left unfilled: ${filled}`);
    });
});

describe('the words and the per-surface overrides are Slate\'s, measured 25 Aug 2026', () => {
    test('Transition reads Fast and Smooth, which is the matrix\'s surface wording', () => {
        const options = bankOptionsFor(matrixRow('transition'), step(), 1, {}).options;
        assert.deepEqual(options.map((o) => o.label), ['Fast', 'Smooth'],
            'ORACLE .pe-grid-cell on the Transition row: "Fast", "Smooth"');
        assert.deepEqual(options.map((o) => o.value), ['fast', 'smooth'],
            'and the wire values did not move with the words');
    });

    test('the exits row is "Exit when", the wording that also let the caps fit', () => {
        assert.equal(matrixRow('exits').label, 'Exit when',
            'ORACLE .pe-grid-label.pe-exits');
    });

    test('the actions row keeps a label to be SPOKEN and is marked not to be drawn', () => {
        const row = matrixRow('actions');
        assert.equal(row.railHidden, true, 'ORACLE .pe-grid-label.pe-action has no text');
        assert.ok(row.label, 'but the accessible name still needs a word to build from');
    });

    test('Max Duration says "s" in the cell while the range still says "sec"', () => {
        assert.equal(matrixRow('duration').unit, 's',
            'ORACLE .pe-value-unit in the Max Duration cell');
        assert.equal(AUTHORING_RANGES.seconds.unit, 'sec',
            'and the RANGE is untouched — Slate\'s own review sentence reads "for 10 sec"');
        assert.equal(matrixRow('duration').rangeField, 'stepSeconds',
            'the override is a word, never a second set of bounds');
    });

    test('the limiter says OFF rather than a number it does not have', () => {
        assert.equal(matrixRow('limiter').zeroLabel, 'OFF',
            'ORACLE span.pe-value-number.pe-limiter-off reads "OFF"');
        assert.equal(readValue(matrixRow('limiter'), step({ limiter: null })), null);
        assert.equal(readValue(matrixRow('limiter'), step({ limiter: { value: 0 } })), 0);
        assert.equal(readValue(matrixRow('limiter'), step({ limiter: { value: 6 } })), 6);
    });

    test('no other row grew an override', () => {
        for (const row of STEP_MATRIX_ROWS) {
            if (row.key !== 'duration') assert.equal(row.unit, undefined, `${row.key} states a unit`);
            if (row.key !== 'limiter') assert.equal(row.zeroLabel, undefined, `${row.key} states a zero label`);
            if (row.key !== 'actions') assert.equal(row.railHidden, undefined, `${row.key} hides its rail`);
        }
    });
});

describe('the enumeration a totality check walks', () => {
    test('every (row, step) pair resolves to one primitive and at most one range field', () => {
        const steps = [step(), step({ transition: 'hold' }), step({ pump: 'pressure' })];
        const cells = enumerateMatrixCells(steps);
        assert.equal(cells.length, STEP_MATRIX_ROWS.length * steps.length, '10 rows x 3 steps');
        for (const cell of cells) {
            assert.ok(CELL_KINDS.includes(cell.kind), `${cell.row}: unknown primitive ${cell.kind}`);
            if (cell.rangeField) {
                assert.ok(EDITOR_RANGE_FIELD_IDS.includes(cell.rangeField));
            }
        }
        const locked = cells.filter((cell) => cell.kind === 'locked');
        assert.equal(locked.length, 1, 'exactly the one HOLD step has a locked target');
        assert.equal(locked[0].row, 'target');
    });

    test('no steps means no cells, and no invented row', () => {
        assert.deepEqual(enumerateMatrixCells([]), []);
        assert.deepEqual(enumerateMatrixCells(null), []);
    });
});
