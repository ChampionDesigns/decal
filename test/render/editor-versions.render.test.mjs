/**
 * Saving a profile leaves one row on the list and its history behind it.
 *
 * Two content saves do not make two entries in the library. The previous-versions dialog is
 * where the history lives: it lists what came before, says what changed, and restores a
 * chosen version.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const FIXTURE = ['/test/fixtures/editor-save-loop-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

/** The subject. See the header for why it is this record and not whichever row is first. */
const SUBJECT = 'Temp test 2';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

/** One call into the fixture's in-page surface. */
const L = (page, expression) => page.eval(`window.__saveLoop.${expression}`);

const [GEOMETRY] = GATE_A_GEOMETRIES;

describe(`profile versions @ ${GEOMETRY.name}`, () => {

    test('two content saves leave ONE row on the list, and the versions behind it',
        () => browser.withPage({ geometry: GEOMETRY }, async (page) => {
            await page.mount(STAGE, FIXTURE);
            assert.equal(await L(page, 'mount()'), 'ready', 'the shell must boot');
            assert.equal(await L(page, "goto('selector')"), 'selector-screen');
            assert.equal(await L(page, 'librarySettled()'), true);

            assert.equal(await L(page, `listableRowsTitled('${SUBJECT}')`), 1,
                `the corpus holds exactly one visible "${SUBJECT}" to start from`);
            const stored0 = await L(page, `storedTitled('${SUBJECT}')`);
            assert.equal(stored0.length, 1, 'and the server is holding exactly one record for it');

            const rootId = await L(page, `clickRowTitled('${SUBJECT}')`);
            assert.ok(rootId, 'the row was found and pressed');
            assert.equal(await L(page, 'pressEdit()'), 'editor-screen');

            const opened = await L(page, 'editor()');
            assert.equal(opened.recordId, rootId, 'the editor opened the row that was picked');
            const original = opened.temperatures[0];
            assert.ok(Number.isFinite(original), 'step 1 has a temperature to move');

            assert.equal(await L(page, 'bumpTemperature(0)'), true, 'the + was pressed');
            const firstEdit = (await L(page, 'editor()')).temperatures[0];
            assert.ok(firstEdit > original, `the cell moved (${original} -> ${firstEdit})`);
            assert.equal(await L(page, 'pressSave()'), true);

            assert.equal(await L(page, "settledScreen('selector-screen')"), 'selector-screen',
                'the one press wrote the version AND left the editor');

            assert.equal(await L(page, `listableRowsTitled('${SUBJECT}')`), 1,
                'after a save the profile still has ONE row on the list — '
                + '"After each save there should still only be one profie"');

            assert.equal(await L(page, `hiddenRowsTitled('${SUBJECT}')`), 0,
                'and the superseded version is not in the Hidden list either — '
                + 'it belongs to the version history, not to "profiles you put away"');

            /* THE SERVER'S SIDE. Nothing was destroyed to get one row: there are two
             * records and one of them is hidden. */
            const stored1 = await L(page, `storedTitled('${SUBJECT}')`);
            assert.equal(stored1.length, 2, 'the server holds BOTH versions — nothing was deleted');
            assert.equal(stored1.filter((r) => r.visibility === 'visible').length, 1);
            assert.equal(stored1.filter((r) => r.visibility === 'hidden').length, 1);
            assert.equal(stored1.find((r) => r.visibility === 'hidden').id, rootId,
                'and the one that was hidden is the record the save superseded');

            assert.equal(await L(page, `clickRowTitled('${SUBJECT}')`), stored1.find((r) => r.visibility === 'visible').id,
                'the one remaining row is the version just saved');
            assert.equal(await L(page, 'pressEdit()'), 'editor-screen');
            assert.equal(await L(page, 'bumpTemperature(0)'), true);
            const secondEdit = (await L(page, 'editor()')).temperatures[0];
            assert.ok(secondEdit > firstEdit, `the cell moved again (${firstEdit} -> ${secondEdit})`);
            assert.equal(await L(page, 'pressSave()'), true);
            assert.equal(await L(page, "settledScreen('selector-screen')"), 'selector-screen',
                'and the second save let itself out too');

            assert.equal(await L(page, `listableRowsTitled('${SUBJECT}')`), 1,
                'still one row after the second save — the list does not grow at all');
            const stored2 = await L(page, `storedTitled('${SUBJECT}')`);
            assert.equal(stored2.length, 3, 'and all three versions are still on the server');
            assert.equal(stored2.filter((r) => r.visibility === 'visible').length, 1);

            assert.deepEqual(page.pageErrors, [], 'and the trip threw nothing');
        }));

    test('Previous versions lists the history, says what changed, and restores',
        () => browser.withPage({ geometry: GEOMETRY }, async (page) => {
            await page.mount(STAGE, FIXTURE);
            assert.equal(await L(page, 'mount()'), 'ready');
            assert.equal(await L(page, "goto('selector')"), 'selector-screen');
            assert.equal(await L(page, 'librarySettled()'), true);

            const rootId = await L(page, `clickRowTitled('${SUBJECT}')`);
            assert.equal(await L(page, 'pressEdit()'), 'editor-screen');
            const original = (await L(page, 'editor()')).temperatures[0];

            for (const _ of [1, 2]) {
                assert.equal(await L(page, 'bumpTemperature(0)'), true);
                assert.equal(await L(page, 'pressSave()'), true);
                assert.equal(await L(page, "settledScreen('selector-screen')"), 'selector-screen',
                    'the save closed the editor by itself');
                assert.ok(await L(page, `clickRowTitled('${SUBJECT}')`),
                    'the profile still has exactly one row to go back into');
                assert.equal(await L(page, `filterList('${SUBJECT}')`), true,
                    'the editor is opened from a filtered library');
                assert.equal(await L(page, 'pressEdit()'), 'editor-screen');
            }
            const tip = await L(page, 'editor()');
            assert.ok(tip.temperatures[0] > original, 'the tip is two bumps above the original');

            assert.equal(await L(page, 'openVersions()'), 'ready',
                'the lineage came back with more than one entry');
            const rows = await L(page, 'versionRows()');
            assert.equal(rows.length, 2,
                'the dialog lists the two older versions and not the one being edited');
            assert.ok(rows.every((row) => row.id && row.id !== tip.recordId),
                'every row names a record, and none of them is the open one');
            assert.ok(rows.some((row) => row.id === rootId), 'the original is in the list');

            const rootRow = rows.find((row) => row.id === rootId);
            const middleRow = rows.find((row) => row.id !== rootId);
            assert.match(rootRow.text, /original/,
                'the first version has no parent to be diffed against and says "original"');
            assert.match(middleRow.text, /step 1/,
                'and the version after it says which step it moved');
            assert.doesNotMatch(middleRow.text, /steps\[0\]/,
                'in words — a field list is not a sentence');

            assert.equal(await L(page, `pickVersion('${rootId}')`), true);
            const restored = await L(page, 'editor()');
            assert.equal(restored.temperatures[0], original,
                'picking the original puts its steps back into the draft');
            assert.equal(restored.recordId, tip.recordId,
                'and writes NOTHING — the editor is still seated on the record it opened');
            assert.equal(restored.saveLabel, 'Save (1)',
                'the restore is an unsaved change like any other, so Cancel still throws it away');

            assert.equal(await L(page, 'pressSave()'), true);
            assert.equal(await L(page, "settledScreen('selector-screen')"), 'selector-screen',
                'the restore save leaves like any other save');

            assert.equal(await L(page, `listableRowsTitled('${SUBJECT}')`), 1,
                'the profile still has exactly one row — not two, and not zero');
            const stored = await L(page, `storedTitled('${SUBJECT}')`);
            assert.equal(stored.length, 3,
                'and no fourth record was created: the server already had this content');
            const visible = stored.filter((r) => r.visibility === 'visible');
            assert.equal(visible.length, 1);
            assert.equal(visible[0].id, rootId,
                'the visible row is the version that was restored');

            /* AND READ IT BACK OFF THE SCREEN, which is the only proof that matters. */
            assert.equal(await page.evalFn(() => document.querySelector('app-root').shadowRoot
                .querySelector('selector-screen').shadowRoot.getElementById('hidden-toggle')
                .getAttribute('aria-pressed')), 'false',
            'returning after restore keeps the visible library; the hidden former tip must not switch the view');
            assert.equal(await page.evalFn(() => document.querySelector('app-root').shadowRoot
                .querySelector('selector-screen').shadowRoot.getElementById('filter').value), '',
            'saving a different record reveals that saved version rather than restoring the old filter');
            assert.equal(await L(page, `clickRowTitled('${SUBJECT}')`), rootId);
            assert.equal(await L(page, 'pressEdit()'), 'editor-screen');
            const reopened = await L(page, 'editor()');
            assert.equal(reopened.temperatures[0], original,
                `re-opening shows the restored value (${original}), not the tip it was `
                + 'restored over');
            assert.equal(reopened.saveLabel, 'Save', 'and nothing is unsaved in it');

            assert.equal(await L(page, 'openVersions()'), 'ready');
            const after = await L(page, 'versionRows()');
            assert.equal(after.length, 2,
                'the two later versions are still there to walk forward to');

            assert.deepEqual(page.pageErrors, [], 'and the trip threw nothing');
        }));
});
