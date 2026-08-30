
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    MACHINE_CLASSES,
    LIMIT_KEYS,
    REAPRIME_FAN_MMR_CEILING,
    REAPRIME_FAN_RESET_REQUEST,
    FAN_THRESHOLD_AFTER_RESET,
    limitsFor,
    hasLimit,
    clamp,
    step,
    rangeHint,
    bandHint,
    numpadRange,
} from '../src/lib/machine-limits.js';
import { stripComments } from '../scripts/lib/source-scan.js';

const MODULE_PATH = fileURLToPath(new URL('../src/lib/machine-limits.js', import.meta.url));
const SOURCE = readFileSync(MODULE_PATH, 'utf8');
const CODE = stripComments(SOURCE);

const BENGLE = limitsFor('bengle');
const DE1 = limitsFor('de1');
const UNKNOWN = limitsFor(null);

describe('the agreed ranges are what is declared', () => {
    test('the machine-independent rows, written out longhand', () => {
        for (const limits of [BENGLE, DE1, UNKNOWN]) {
            assert.deepEqual(
                { min: limits.hotWaterTemp.min, max: limits.hotWaterTemp.max }, { min: 0, max: 99 });
            assert.deepEqual(
                { min: limits.hotWaterVolume.min, max: limits.hotWaterVolume.max }, { min: 0, max: 255 });
            assert.ok(limits.hotWaterVolume.max <= 255,
                'anything above a byte does not clamp on this machine, it wraps');
            assert.deepEqual(
                { min: limits.steamDuration.min, max: limits.steamDuration.max }, { min: 10, max: 120 });
            assert.equal(limits.steamDuration.step, 5, "Slate's step, and the only stated one");
            assert.deepEqual(
                { min: limits.steamFlow.min, max: limits.steamFlow.max }, { min: 0.4, max: 2.5 });
            assert.deepEqual(
                { min: limits.brewTemp.min, max: limits.brewTemp.max }, { min: 70, max: 110 });
        }
    });

    test('the two ranges folded in from where they were the only copy', () => {
        assert.deepEqual({ min: BENGLE.flushTemp.min, max: BENGLE.flushTemp.max }, { min: 5, max: 95 });
        assert.deepEqual({ min: BENGLE.flushFlow.min, max: BENGLE.flushFlow.max }, { min: 2, max: 8 });
    });

    test('B3 — the steam floor is the enablement threshold, on both machines', () => {
        assert.equal(BENGLE.steamTemp.floor, 135);
        assert.equal(DE1.steamTemp.floor, 135);
        assert.notEqual(BENGLE.steamTemp.floor, 130, 'the retired floor is the dead band');
    });

    test('B3 — the Bengle ceiling is 170, the DE1 is 160, and the class decides', () => {
        assert.equal(BENGLE.steamTemp.max, 170, 'measured on the bench machine');
        assert.equal(DE1.steamTemp.max, 160, 'doc/Skins.md:573, and nothing has re-measured it');
        assert.notEqual(BENGLE.steamTemp.max, DE1.steamTemp.max,
            'two classes with one number would make machineClass a parameter that changes nothing');
        for (const limits of [BENGLE, DE1]) {
            assert.equal(limits.steamTemp.min, 0, 'zero still means the heater is off');
            assert.equal(limits.steamTemp.floor, 135, 'and the hole below the band survives');
        }
    });

    test('the retired floor has no foothold in the module itself', () => {
        // Comments may still explain the old number; no declaration may carry it.
        const numbers = (CODE.match(/\b\d+(\.\d+)?\b/g) || []);
        assert.ok(!numbers.includes('130'),
            'machine-limits.js declares 130 — that is the retired steam floor');
    });

    test('tankTemp is present on every class, and machine-independent', () => {
        for (const limits of [BENGLE, DE1, UNKNOWN]) {
            assert.equal(hasLimit(limits, 'tankTemp'), true);
        }
        assert.ok(LIMIT_KEYS.includes('tankTemp'));
        assert.deepEqual(BENGLE.tankTemp, DE1.tankTemp,
            'a threshold that differed by class would be a capability gate wearing a limits row');
    });

    test('LIMIT_KEYS names every row the table can carry', () => {
        assert.deepEqual([...Object.keys(BENGLE)].sort(), [...LIMIT_KEYS].sort());
    });
});

describe('the machine class is an input, never a guess', () => {
    const MACHINE_DEPENDENT = ['steamTemp', 'fanThreshold'];

    test('an unknown class means a machine-dependent row is ABSENT, not defaulted', () => {
        for (const key of MACHINE_DEPENDENT) {
            assert.equal(hasLimit(UNKNOWN, key), false, `${key} must be absent on an unknown class`);
            assert.throws(() => clamp(UNKNOWN, key, 50), /no limits declared/);
            assert.throws(() => rangeHint(UNKNOWN, key), /no limits declared/);
        }
        assert.equal(limitsFor(undefined), UNKNOWN);
    });

    test('every other row survives an unknown class untouched', () => {
        for (const key of LIMIT_KEYS.filter((k) => !MACHINE_DEPENDENT.includes(k))) {
            assert.deepEqual(UNKNOWN[key], BENGLE[key]);
        }
    });

    test('the fan threshold is Ben\'s band on a Bengle and ReaPrime\'s on a DE1', () => {
        assert.deepEqual(
            { min: BENGLE.fanThreshold.min, max: BENGLE.fanThreshold.max }, { min: 40, max: 60 });
        assert.deepEqual(
            { min: DE1.fanThreshold.min, max: DE1.fanThreshold.max }, { min: 0, max: 50 });
        // It is a TEMPERATURE on both, not the percentage the old page printed.
        assert.equal(BENGLE.fanThreshold.unit, '\u00B0C');
        assert.equal(DE1.fanThreshold.unit, '\u00B0C');
        assert.equal(BENGLE.fanThreshold.step, 1);
        assert.equal(DE1.fanThreshold.step, 1);
        assert.notDeepEqual(BENGLE.fanThreshold, DE1.fanThreshold);
    });

    test('the Bengle band reaches above what ReaPrime will write, and that is recorded', () => {
        assert.equal(REAPRIME_FAN_MMR_CEILING, 50,
            "ReaPrime's declared MMR ceiling — re-read de1.models.dart before changing this");
        assert.ok(BENGLE.fanThreshold.max > REAPRIME_FAN_MMR_CEILING,
            'the gap is the known defect; if it has closed, delete this test and the caveats');
        // The DE1 row IS that ceiling rather than a second copy of the number.
        assert.equal(DE1.fanThreshold.max, REAPRIME_FAN_MMR_CEILING);
        assert.ok(BENGLE.fanThreshold.min < REAPRIME_FAN_MMR_CEILING);
    });

    test('a restore leaves 50, not the 55 ReaPrime asks for', () => {
        assert.equal(REAPRIME_FAN_RESET_REQUEST, 55, "the handler's own literal");
        assert.equal(FAN_THRESHOLD_AFTER_RESET, 50);
        assert.equal(FAN_THRESHOLD_AFTER_RESET, REAPRIME_FAN_MMR_CEILING,
            'it is 50 only because the clamp is 50 — derived, never typed');
        assert.ok(FAN_THRESHOLD_AFTER_RESET >= BENGLE.fanThreshold.min
            && FAN_THRESHOLD_AFTER_RESET <= BENGLE.fanThreshold.max);
        assert.ok(FAN_THRESHOLD_AFTER_RESET >= DE1.fanThreshold.min
            && FAN_THRESHOLD_AFTER_RESET <= DE1.fanThreshold.max);
    });

    test('a class the envelope was not decided for is an error, not a shrug', () => {
        assert.throws(() => limitsFor('decentPro'), /unknown machine class/);
        assert.deepEqual([...MACHINE_CLASSES], ['bengle', 'de1']);
    });

    test('the steam row says which class it was resolved for', () => {
        assert.equal(BENGLE.steamTemp.machineClass, 'bengle');
        assert.equal(DE1.steamTemp.machineClass, 'de1');
    });
});

describe('zero, and the hole above it', () => {
    test('zero survives, because on three of these it is a setting', () => {
        for (const key of ['hotWaterVolume', 'steamTemp', 'hotWaterTemp']) {
            assert.equal(clamp(BENGLE, key, 0), 0, `${key} must keep zero`);
            assert.equal(clamp(BENGLE, key, -5), 0, `${key} must clamp below zero UP to zero`);
        }
        assert.equal(clamp(BENGLE, 'steamDuration', 0), 10, 'the floor is the working band');
        assert.equal(clamp(BENGLE, 'steamDuration', -5), 10);
        assert.ok(BENGLE.hotWaterVolume.zeroMeans, 'a volume cap of zero is a real setting nobody else states');
        for (const key of ['steamTemp', 'steamDuration', 'flushDuration', 'tankTemp']) {
            assert.ok(!BENGLE[key].zeroMeans,
                `${key} must not teach its bottom value as an off switch — the page has a switch`);
        }
        assert.equal(BENGLE.steamTemp.min, 0, 'the mechanism stays; only the sentence went');
        assert.equal(BENGLE.steamTemp.floor, 135);
    });

    test('a value inside the steam hole snaps to the nearer END OF THE CORRECTED BAND', () => {
        assert.equal(clamp(BENGLE, 'steamTemp', 0), 0);
        assert.equal(clamp(BENGLE, 'steamTemp', 135), 135);
        assert.equal(clamp(BENGLE, 'steamTemp', 155), 155);
        assert.equal(clamp(BENGLE, 'steamTemp', 170), 170);
        assert.equal(clamp(BENGLE, 'steamTemp', 200), 170, 'and no higher');
        assert.equal(clamp(DE1, 'steamTemp', 200), 160, 'and the DE1 stops at ITS ceiling');
        assert.equal(clamp(BENGLE, 'steamTemp', 60), 0, 'nearer the off value');
        assert.equal(clamp(BENGLE, 'steamTemp', 100), 135, 'nearer the working band');
        // The number the old table accepted and the machine ignored.
        assert.equal(clamp(BENGLE, 'steamTemp', 130), 135, 'the dead band is not settable');
    });

    test('stepping crosses the hole instead of landing in it', () => {
        // Both ends have to be reachable with the same two buttons.
        assert.equal(step(BENGLE, 'steamTemp', 0, +1), 135, 'up from off enters the band at its floor');
        assert.equal(step(BENGLE, 'steamTemp', 135, -1), 0, 'down from the floor goes to off');
        assert.equal(step(BENGLE, 'steamTemp', 135, +1), 136);
        assert.equal(step(BENGLE, 'steamTemp', 170, +1), 170, 'and stops at the top');
        assert.equal(step(DE1, 'steamTemp', 160, +1), 160, 'the DE1 stops at 160');
        assert.equal(step(DE1, 'steamTemp', 165, +1), 160,
            'and a value above its ceiling comes back DOWN to it');
        assert.equal(step(BENGLE, 'steamTemp', 0, -1), 0, 'and at the bottom');
    });

    test('B3 REGRESSION — no path lands a user in the heater-off dead band', () => {
        const dead = (n) => n > 0 && n < 135;
        for (const limits of [BENGLE, DE1]) {
            for (let value = -20; value <= 220; value += 1) {
                assert.ok(!dead(clamp(limits, 'steamTemp', value)),
                    `clamp(${value}) landed in the dead band`);
                for (const direction of [+1, -1]) {
                    assert.ok(!dead(step(limits, 'steamTemp', value, direction)),
                        `step(${value}, ${direction}) landed in the dead band`);
                }
            }
        }
    });
});

describe('the arithmetic and the errors', () => {
    test('stepping a fractional range does not accumulate float noise', () => {
        assert.equal(step(BENGLE, 'steamFlow', 2.1, +1), 2.2);
        assert.equal(step(BENGLE, 'steamFlow', 0.4, -1), 0.4);
        assert.equal(step(BENGLE, 'steamFlow', 2.5, +1), 2.5);
        assert.equal(step(BENGLE, 'flushFlow', 2.1, +1), 2.2);
        assert.equal(step(BENGLE, 'brewTemp', 92, +1), 92.5);
    });

    test('a non-numeric value falls to the bottom rather than to NaN', () => {
        for (const key of Object.keys(BENGLE)) {
            assert.equal(clamp(BENGLE, key, undefined), BENGLE[key].min);
            assert.equal(clamp(BENGLE, key, ''), BENGLE[key].min);
            assert.ok(Number.isFinite(step(BENGLE, key, 'nonsense', +1)));
        }
    });

    test('an undeclared key is an error, not a silent pass-through', () => {
        assert.throws(() => clamp(BENGLE, 'steamTempreature', 150), /no limits declared/);
        assert.throws(() => step(BENGLE, 'nope', 1, 1), /no limits declared/);
        assert.throws(() => numpadRange(BENGLE, 'nope'), /no limits declared/);
        assert.throws(() => rangeHint(BENGLE, 'nope'), /no limits declared/);
    });

    test('the table is frozen, so no caller can edit a limit in passing', () => {
        assert.ok(Object.isFrozen(BENGLE));
        assert.ok(Object.isFrozen(BENGLE.steamTemp));
    });
});

describe('what the surfaces print', () => {
    test('the numpad range is the band the pad ACCEPTS, hole excluded', () => {
        const steam = numpadRange(BENGLE, 'steamTemp');
        assert.deepEqual({ min: steam.min, max: steam.max }, { min: 135, max: 170 });
        assert.equal(steam.label, bandHint({ ...BENGLE.steamTemp, min: 135, floor: undefined }));
        assert.equal(steam.label, '135–170 °C');
        assert.equal(numpadRange(DE1, 'steamTemp').label, '135–160 °C',
            'the DE1 prints ITS ceiling — the class is what the label is for');
        assert.equal(numpadRange(DE1, 'steamTemp').min, 135);
        assert.match(numpadRange(BENGLE, 'hotWaterTemp').label, /0–99/);
        assert.equal(numpadRange(BENGLE, 'brewTemp').step, 0.5, 'the numpad gets the step too');
        /* AND THE TABLE IS UNTOUCHED — the hole is still declared and `clamp` still
         * enforces it. Narrowing the PAD is not narrowing the wire. */
        assert.equal(BENGLE.steamTemp.min, 0);
        assert.equal(BENGLE.steamTemp.floor, 135);
        assert.equal(clamp(BENGLE, 'steamTemp', 63), 0);
    });

    test('the printed hint comes from the same declaration as the clamp', () => {
        assert.equal(rangeHint(BENGLE, 'steamDuration'), '10–120 s');
        assert.equal(rangeHint(BENGLE, 'hotWaterVolume'), '0–255 mL · 0 = no volume cap');
        assert.equal(rangeHint(BENGLE, 'steamTemp'), '135–170 °C');
        assert.equal(rangeHint(DE1, 'steamTemp'), '135–160 °C');
        assert.equal(rangeHint(BENGLE, 'hotWaterTemp', (n) => n, { unit: false }), '0–99');
        assert.equal(rangeHint(BENGLE, 'steamTemp', (n) => n, { unit: false }), '135–170');
        assert.equal(rangeHint(BENGLE, 'fanThreshold'), '40–60 °C');
        assert.equal(rangeHint(DE1, 'fanThreshold'), '0–50 °C');
    });

    test('a floor that DOES state a zero meaning still prints it — on the ROW', () => {
        const withMeaning = { hole: { min: 0, max: 10, floor: 4, step: 1, unit: 'x', zeroMeans: 'nothing at all' } };
        assert.equal(rangeHint(withMeaning, 'hole'), '0 (nothing at all) or 4–10 x');
        const pad = numpadRange(withMeaning, 'hole');
        assert.deepEqual({ min: pad.min, max: pad.max }, { min: 4, max: 10 });
        assert.equal(pad.label, '4–10 x');
    });

    test('bandHint is what rangeHint IS — one composer, two ways of naming the row', () => {
        for (const key of ['steamDuration', 'hotWaterVolume', 'steamTemp', 'hotWaterTemp']) {
            assert.equal(bandHint(BENGLE[key]), rangeHint(BENGLE, key), key);
            assert.equal(bandHint(BENGLE[key], { unit: '' }),
                rangeHint(BENGLE, key, undefined, { unit: false }), `${key}, bare`);
        }
    });

    test('bandHint reads the band it is HANDED, which is how a converted face gets a hint', () => {
        const shownF = { min: 32, max: 338, floor: 275, step: 1.8, unit: '°F' };
        assert.equal(bandHint(shownF), '275–338 °F');
        assert.equal(bandHint(BENGLE.steamTemp), '135–170 °C');
        const shape = (hint) => hint.replace(/[\d.]+/g, '#').replace(/°[CF]/, '°');
        assert.equal(shape(bandHint(shownF)), shape(bandHint(BENGLE.steamTemp)),
            'one band is one sentence — only the numbers and the symbol move');
    });

    test('a caller may restate the WORD without restating the band', () => {
        assert.equal(bandHint(BENGLE.hotWaterVolume, { unit: 'g', zeroMeans: 'no weight cap' }),
            '0–255 g · 0 = no weight cap');
        assert.equal(bandHint(BENGLE.hotWaterVolume, { unit: 'g' }),
            '0–255 g · 0 = no volume cap');
        assert.equal(bandHint(BENGLE.hotWaterVolume, { unit: '' }), '0–255 · 0 = no volume cap');
    });

    test('no range is no sentence — an absence is not a band of zeroes', () => {
        assert.equal(bandHint(null), '');
        assert.equal(bandHint(undefined), '');
        assert.equal(bandHint(UNKNOWN.steamTemp), '',
            'the row the unknown class withholds has no hint to print, and A7 draws the rest');
    });

    test('the hint runs every value through the caller format, so °F converts', () => {
        const f = (n) => Math.round(n * 9 / 5 + 32);
        assert.equal(rangeHint(BENGLE, 'steamTemp', f, { unit: false }), '275–338');
    });
});

describe('B2 — exactly one table in the skin', () => {
    const SRC = fileURLToPath(new URL('../src/', import.meta.url));
    const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
        entry.isDirectory()
            ? walk(`${dir}${entry.name}/`)
            : (entry.name.endsWith('.js') ? [`${dir}${entry.name}`] : [])
    ));

    const rangeDeclaration = (key) => new RegExp(`\\b${key}\\s*:\\s*\\{[^{}]*\\b(?:min|max|floor|step)\\s*:`);
    const splitDeclaration = (key) => new RegExp(`\\b${key}(?:Min|Max|Floor|Ceiling|Range|Limits?)\\s*[:=]`);

    test('no other module in src/ declares a range for one of these fields', () => {
        const offenders = [];
        for (const path of walk(SRC)) {
            if (path === MODULE_PATH) continue;
            const code = stripComments(readFileSync(path, 'utf8'));
            for (const key of LIMIT_KEYS) {
                if (rangeDeclaration(key).test(code)) offenders.push(`${path.slice(SRC.length)}: a ${key} range`);
                if (splitDeclaration(key).test(code)) offenders.push(`${path.slice(SRC.length)}: a ${key} bound`);
            }
            if (/\bfloor\s*:\s*1\d\d\b/.test(code)) {
                offenders.push(`${path.slice(SRC.length)}: a steam working-band floor`);
            }
        }
        assert.deepEqual(offenders, [], 'these limits must come from machine-limits.js (B2)');
    });

    test('the guard is not vacuous — every key is caught, in both spellings', () => {
        for (const key of LIMIT_KEYS) {
            assert.ok(
                rangeDeclaration(key).test(`const LIMITS = { ${key}: { min: 0, max: 9, step: 1 } };`),
                `a second ${key} range would walk past the guard`,
            );
            assert.ok(
                splitDeclaration(key).test(`const ${key}Max = 9;`),
                `a hand-written ${key} bound would walk past the guard`,
            );
        }
    });

    test('and it does not fire on a VALUE named for a field — only on a range for one', () => {
        const innocent = [
            'dose: null,', 'const dose = shotDose(stored);', 'brewTempPresets: {',
            'steamFlowPresets: {', 'hotWaterTempPresets: {', "changes: ['flushTemp', 'flushFlow'],",
        ];
        for (const line of innocent) {
            for (const key of LIMIT_KEYS) {
                assert.ok(!rangeDeclaration(key).test(line), `${key} range false positive on ${line}`);
                assert.ok(!splitDeclaration(key).test(line), `${key} bound false positive on ${line}`);
            }
        }
    });

    test('it is pure — no DOM, no request, no storage', () => {
        for (const forbidden of ['document', 'window', 'fetch(', 'localStorage', 'import ']) {
            assert.ok(!CODE.includes(forbidden), `machine-limits.js reaches for ${forbidden}`);
        }
    });
});
