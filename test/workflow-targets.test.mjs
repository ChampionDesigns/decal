/**
 * The Live rail's values, read off the workflow and written back.
 *
 * WHAT THESE PIN. The rail did not work: `targets` and `limits` had no writer, so every
 * stepper, preset cell and the keypad's Confirm rendered disabled on any machine, and the
 * one handler that writes `targets` sat behind the controls that being unwritten had
 * disabled. These assert the mapping against the SHIPPED FIXTURE rather than a hand-made
 * object, because the fixture is a recording of what a real machine serves — a mapping
 * that passes against an invented document proves nothing about the rail.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    targetsFrom, patchFor, brewTempOf, WORKFLOW_TARGET_KEYS,
} from '../src/lib/workflow-targets.js';
import { LIMIT_KEYS } from '../src/lib/machine-limits.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = JSON.parse(
    readFileSync(path.join(REPO, 'tools/rea-fixtures/api__v1__workflow.json'), 'utf8'));

test('every rail key the fixture carries is read, with the served number', () => {
    const targets = targetsFrom(WORKFLOW);

    assert.equal(targets.dose, 17.0, 'dose is context.targetDoseWeight');
    assert.equal(targets.drinkWeight, 40.0, 'drink weight is context.targetYield');
    assert.equal(targets.steamTemp, 170);
    assert.equal(targets.steamFlow, 2.1);
    assert.equal(targets.steamDuration, 45);
    assert.equal(targets.milkStopTemp, 0.0, '0 is a real setting, not an absence');
    assert.equal(targets.hotWaterTemp, 98);
    assert.equal(targets.hotWaterVolume, 240);
    assert.equal(targets.flushTemp, 90);
    assert.equal(targets.flushFlow, 6.0);
    assert.equal(targets.flushDuration, 5);
});

/* THE REGRESSION THIS FILE EXISTS TO PREVENT, and it was written the wrong way first.
 * The fixture's steps read 83.5 / 75 / 75. The old app prints 83.5 (`app.js:1479`,
 * `profileManager.js:552` — `steps[0].temperature`, no agreement test). A rule that
 * required the steps to agree printed the DASH here: a control reading empty where the
 * thing it replaces reads a number. */
test('brew temperature is the first step, exactly as the old app reads it', () => {
    assert.equal(brewTempOf(WORKFLOW), 83.5);
    assert.equal(targetsFrom(WORKFLOW).brewTemp, 83.5);

    const temps = WORKFLOW.profile.steps.map((s) => s.temperature);
    assert.ok(new Set(temps).size > 1,
        'the fixture no longer has differing step temperatures — this test stopped '
        + 'covering the case it exists for');
});

test('a key the document does not carry is ABSENT, never zero', () => {
    const targets = targetsFrom({ context: {}, steamSettings: {}, profile: { steps: [] } });
    for (const key of WORKFLOW_TARGET_KEYS) {
        assert.equal(Object.hasOwn(targets, key), false, `${key} was invented from nothing`);
    }
    assert.deepEqual(targetsFrom(null), {});
    assert.deepEqual(targetsFrom(undefined), {});
});

test('a non-number is not a target — the machine holds numbers', () => {
    const targets = targetsFrom({ context: { targetDoseWeight: '17', targetYield: null } });
    assert.equal(Object.hasOwn(targets, 'dose'), false, 'a string is not a reading');
    assert.equal(Object.hasOwn(targets, 'drinkWeight'), false, 'null is not a reading');
});

test('every rail key is sourced, and the two that are not are named', () => {
    /* LIMIT_KEYS is the authority for what a rail row may ask for. A key in that table
     * that this module cannot source is a row that renders unavailable for ever, so the
     * gap must be deliberate and visible rather than discovered on the glass. */
    const unsourced = LIMIT_KEYS.filter((k) => !WORKFLOW_TARGET_KEYS.includes(k));
    /* TWO BECAME EIGHT ON 24 AUG, AND EIGHT BECAME SIXTEEN ON 26 AUG 2026. Every one of
     * the eight new ones is a SETTINGS-ONLY row that no Live rail control asks for, which
     * is the honest shape of this gap: the module sources what the RAIL needs from
     * `GET /workflow`, and the limits table also carries rows for pages the rail has
     * nothing to do with. The eight and where they live:
     *
     *   cupWarmerTarget, preWarmLead   the cup-warmer page, on its own door
     *   fanThreshold                   Calibration > Fan Threshold
     *   flowCalibration                Calibration > Flow Multiplier
     *   hotWaterDuration, hotWaterFlow the Hot Water page
     *   sleepAfter                     the sleep policy, on the presence door
     *   screensaverCycle, waterAlertLevel   two skin-stored preferences
     *
     * `hotWaterDuration` IS THE ONE WORTH A SECOND LOOK, because unlike the rest it IS on
     * the workflow document — `hotWaterData.duration`, which the workflow door now reads.
     * It is unsourced HERE because this module is the RAIL's reader and the rail has no
     * hot-water duration control. Two readers of one document, each for its own surface,
     * is the arrangement; a key appearing in both would be the mistake.
     *
     * `tankTemp` IS THE SAME SHAPE, older: the document carries `profile.tank_temperature`,
     * the rail has no tank control, and the profile field is the value that OVERWRITES the
     * machine's threshold rather than a reading of it.
     *
     * AND SIXTEEN BECAME EIGHTEEN ON 27 AUGUST 2026 — the settings pass added two bands to
     * `machine-limits.js` and this census is the file that has to be told, which is the
     * whole point of asserting an exact list rather than a count. Both are the same shape
     * as the eight above, a settings row the rail does not carry:
     *
     *   hotWaterLookahead   Hot Water > Flow multiplier. The lead the stop-at-weight
     *                       sequencer works to (`hot_water_sequencer.dart:117` reads it as
     *                       `lookaheadSeconds`). `settings-leaves.js` machine-hot-water-
     *                       lookahead is the row; the rail has no hot-water page.
     *   screenBrightness    Display > Brightness. A TABLET setting, not a machine one at
     *                       all — `settings-bespoke-leaf.js` reads the band to gray the
     *                       slider's ends, and `GET /workflow` could not carry it if it
     *                       wanted to.
     *
     * THE ARITHMETIC IN THE SENTENCE ABOVE SAID FIFTEEN AND THE LIST HELD SIXTEEN, from
     * the 26 August edit onwards. Corrected here rather than left, because a census whose
     * own prose miscounts its own list is the one comment in the file a reader cannot
     * check at a glance. */
    assert.deepEqual(unsourced.sort(), [
        'appFlowMultiplier', 'calibrationWeight', 'cupWarmerTarget', 'fanThreshold',
        'flowCalibration', 'heaterIdleTemp', 'heaterPh1Flow', 'heaterPh2Flow',
        'heaterPh2Timeout', 'hotWaterDuration', 'hotWaterFlow', 'hotWaterLookahead',
        'preWarmLead', 'screenBrightness', 'screensaverCycle', 'sleepAfter', 'tankTemp',
        'waterAlertLevel',
    ], 'a rail key lost its source, or gained one without this test being told');
});

test('the patch is PARTIAL — one block, and the rest of the document untouched', () => {
    const patch = patchFor(WORKFLOW, 'dose', 19);
    assert.deepEqual(Object.keys(patch), ['context'],
        'the write carries a block the press did not change');
    assert.equal(patch.context.targetDoseWeight, 19);
    assert.equal(patch.context.targetYield, 40.0, 'the sibling field was dropped');
    assert.equal(patch.profile, undefined);
    assert.equal(patch.steamSettings, undefined);
});

test('brew temperature writes EVERY step, which is the old app\'s rule', () => {
    const patch = patchFor(WORKFLOW, 'brewTemp', 91);
    assert.deepEqual(Object.keys(patch), ['profile']);
    assert.deepEqual(patch.profile.steps.map((s) => s.temperature), [91, 91, 91]);
    assert.equal(patch.profile.steps.length, WORKFLOW.profile.steps.length);
    assert.equal(patch.profile.title, WORKFLOW.profile.title, 'the profile lost its identity');
    /* The steps it is not changing ride along whole: a step is more than a temperature. */
    assert.equal(patch.profile.steps[0].pump, WORKFLOW.profile.steps[0].pump);
    assert.equal(patch.profile.steps[1].name, WORKFLOW.profile.steps[1].name);
    assert.notEqual(WORKFLOW.profile.steps[0].temperature, 91, 'the source document was mutated');
});

test('a key this module does not own, or a value that is not a number, writes nothing', () => {
    assert.equal(patchFor(WORKFLOW, 'fanThreshold', 40), null);
    assert.equal(patchFor(WORKFLOW, 'dose', null), null);
    assert.equal(patchFor(WORKFLOW, 'dose', '19'), null);
    assert.equal(patchFor(WORKFLOW, 'dose', Number.NaN), null);
    assert.equal(patchFor({ profile: { steps: [] } }, 'brewTemp', 91), null);
});

/* ═══════════════════════════════════════════ the grind, which is a string upstream ═ */

describe('grind — the rail row the workflow does carry', () => {
    test('it is read from context.grinderSetting, as a number', () => {
        assert.equal(targetsFrom({ context: { grinderSetting: '8.50' } }).grind, 8.5);
    });

    test('a bare number is read too — a document written by something else is a document', () => {
        assert.equal(targetsFrom({ context: { grinderSetting: 9 } }).grind, 9);
    });

    test('ABSENT IS ABSENT: a machine that was never told a grind has no key at all', () => {
        /* `WorkflowContext.toJson` omits it when null, so this is the common case and not
         * an edge one. The row renders the dash; A7 unchanged. */
        assert.equal('grind' in targetsFrom({ context: { targetDoseWeight: 18 } }), false);
        assert.equal('grind' in targetsFrom({ context: { grinderSetting: null } }), false);
        assert.equal('grind' in targetsFrom({ context: { grinderSetting: '' } }), false);
        assert.equal('grind' in targetsFrom({ context: { grinderSetting: 'fine' } }), false);
    });

    test('it is WRITTEN as a two-decimal string, which is the old app\'s own spelling', () => {
        /* `ui.js:210-215` writes parseFloat(v).toFixed(2). Two skins writing "8.5" and
         * "8.50" into one field would each read the other\'s value as a different number
         * the moment a toFixed moved. */
        assert.deepEqual(patchFor({ context: {} }, 'grind', 8.5),
            { context: { grinderSetting: '8.50' } });
    });

    test('the patch is partial: the rest of the context rides along, nothing else does', () => {
        const workflow = { context: { targetDoseWeight: 18, targetYield: 40 }, steamSettings: { flow: 2.1 } };
        assert.deepEqual(patchFor(workflow, 'grind', 9), {
            context: { targetDoseWeight: 18, targetYield: 40, grinderSetting: '9.00' },
        });
    });
});
