/**
 * The Live band's shot panel: the rating that was never sent, and the notes sheet that named no shot.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULES = ['/test/fixtures/live-selector-carry-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`live shot panel @ ${geometry.name} (${geometry.width}x${geometry.height})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(STAGE, MODULES);
            await page.settle(6);
            await page.evalFn(() => window.__carry.mount());
            const panel = await page.evalFn(() => window.__carry.shotPanel());
            assert.equal(panel.id, 'shot-carry-newest', 'the band names the newest stored shot');
            assert.deepEqual(page.pageErrors, [], 'the panel must mount without throwing');
            await fn(page);
            assert.deepEqual(page.pageErrors, [], 'the panel must run without throwing');
        });

        test('F-023 — rating a shot PUTs the enjoyment to that shot', () => mounted(async (page) => {
            await page.evalFn(() => window.__carry.clearRequests());
            await page.evalFn(() => window.__carry.rate(6));

            const puts = await page.evalFn(() => window.__carry.requests('/api/v1/shots/')
                .filter((r) => r.method === 'PUT'));
            /* THE MEASUREMENT THE FINDING MADE, INVERTED: "zero writes to any
             * /api/v1/shots/<id> route" becomes exactly one, to this shot. */
            assert.equal(puts.length, 1, `one PUT, not ${puts.length}: ${JSON.stringify(puts)}`);
            assert.equal(puts[0].path, '/api/v1/shots/shot-carry-newest');
            assert.deepEqual(puts[0].body, { annotations: { enjoyment: 6 } },
                'the SMALLEST honest patch — the handler deep-merges it');
        }));

        test('F-023 — the panel prints the rating from the answer, and it survives a reload',
            () => mounted(async (page) => {
                await page.evalFn(() => window.__carry.rate(6));
                assert.equal(await page.evalFn(() => window.__carry.shotPanel().rating), 6,
                    'the band holds the score');
                assert.match(await page.evalFn(() => window.__carry.ratingFace()), /6\.0/,
                    'and the button prints it in place of the dash');

                await page.evalFn(() => window.__carry.mount());
                assert.equal(await page.evalFn(() => window.__carry.shotPanel().rating), 6,
                    'the rating came back from the server');
            }));

        test('a stored rating of 7.5 shows as 7.5 out of 10, not rescaled',
            () => mounted(async (page) => {
                assert.equal(await page.evalFn(
                    () => window.__carry.serveRating('shot-carry-newest', 7.5)), true);
                await page.evalFn(() => window.__carry.mount());
                assert.equal(await page.evalFn(() => window.__carry.shotPanel().rating), 7.5);
                assert.match(await page.evalFn(() => window.__carry.ratingFace()), /\b7\.5\b/);

                const sheet = await page.evalFn(() => window.__carry.sheetFace());
                assert.equal(sheet.label, 'Score out of 10');
                assert.equal(sheet.value, '7.5');
                assert.deepEqual([sheet.min, sheet.max, sheet.step], ['0', '10', '0.5']);
                assert.equal(sheet.name, 'Shot rating, 0 to 10');
                assert.equal(sheet.valueText, '7.5 of 10');
            }));

        test('F-023 — the write is a PATCH: the shot\'s other annotations survive it',
            () => mounted(async (page) => {
                await page.evalFn(() => window.__carry.rate(7.5));

                const record = await page.evalFn(() => window.__carry
                    .serverShot('shot-carry-newest').annotations);
                assert.equal(record.enjoyment, 7.5, 'the rating landed');
                assert.equal(record.actualDoseWeight, 18, 'and the dose annotation was not trampled');
                assert.ok(record.espressoNotes, 'nor the note');
            }));

        test('F-023 — rating the OLDER shot names the older shot', () => mounted(async (page) => {
            const older = await page.evalFn(() => window.__carry.stepOlder());
            assert.equal(older, 'shot-carry-older', 'the arrow steps the band');

            await page.evalFn(() => window.__carry.clearRequests());
            await page.evalFn(() => window.__carry.rate(2));
            const puts = await page.evalFn(() => window.__carry.requests('/api/v1/shots/')
                .filter((r) => r.method === 'PUT'));
            assert.equal(puts.length, 1);
            assert.equal(puts[0].path, '/api/v1/shots/shot-carry-older');
        }));

        test('F-029 — the sheet NAMES the shot the panel is about', () => mounted(async (page) => {
            const sheet = await page.evalFn(() => window.__carry.openNotes());
            assert.equal(sheet.open, true, 'the press opens the sheet');

            /* THE AUDIT'S OWN SENTENCE WAS "the sheet's whole text is 'Close'". */
            assert.notEqual(sheet.text, 'Close', 'the sheet is no longer one button');
            assert.ok(sheet.identity, `the sheet composes an identity block: ${sheet.text}`);
            assert.match(sheet.identity, /Alpha bloom/, 'it names the profile');
            assert.match(sheet.identity, /2026/, 'and the date the panel prints');
            assert.match(sheet.identity, /In\s/, 'and the charge, in the band\'s own words');
        }));

        test('F-029 — and SHOWS the text stored against it', () => mounted(async (page) => {
            const expected = await page.evalFn(() => window.__carry.shotNoteText());
            const sheet = await page.evalFn(() => window.__carry.openNotes());
            assert.equal(sheet.notes, expected, 'the stored note, verbatim');
            assert.equal(sheet.empty, null, 'and no empty state beside it');
        }));

        test('D14 — a shot with no note opens an EMPTY EDITOR that invites one',
            () => mounted(async (page) => {
                await page.evalFn(() => window.__carry.stepOlder());
                const sheet = await page.evalFn(() => window.__carry.openNotes());

                assert.equal(sheet.editable, true, 'the shot can be written about');
                assert.equal(sheet.notes, '', 'and there is nothing written yet');
                assert.equal(sheet.empty, null, 'so no empty-state panel stands in the way');
                assert.match(sheet.placeholder, /Nothing is written against this shot/,
                    'the sentence moved into the field as its invitation');

                /* AND IT STILL NAMES THE SHOT. An empty editor is not an empty sheet. */
                assert.match(sheet.identity, /Beta ristretto/, 'the older shot is still named');
            }));

        test('D14 — the surface is called "Shot notes", on the button and on the sheet',
            () => mounted(async (page) => {
                const face = await page.evalFn(() => window.__carry.notesFace());
                assert.equal(face, 'Shot notes', 'the button on the panel');

                const sheet = await page.evalFn(() => window.__carry.openNotes());
                assert.equal(sheet.heading, 'Shot notes', 'and the sheet it opens');
            }));

        test('D14 — typing a note and saving it PUTs the note to THIS shot',
            () => mounted(async (page) => {
                const opened = await page.evalFn(() => window.__carry.openNotes());
                assert.equal(opened.save.disabled, true,
                    'Save is not offered before anything has been typed');

                await page.evalFn(() => window.__carry.clearRequests());
                const dirty = await page.evalFn(() => window.__carry
                    .typeNote('Nine bar, tasted like blackcurrant.'));
                assert.equal(dirty, true, 'the editor reports the edit');
                const typed = await page.evalFn(() => window.__carry.openNotes());
                assert.equal(typed.save.disabled, false, 'and Save becomes available');

                const pressed = await page.evalFn(() => window.__carry.saveNote());
                assert.equal(pressed.pressed, true, 'Save is pressable');

                const puts = await page.evalFn(() => window.__carry.requests('/api/v1/shots/')
                    .filter((r) => r.method === 'PUT'));
                assert.equal(puts.length, 1, `one PUT, not ${puts.length}: ${JSON.stringify(puts)}`);
                assert.equal(puts[0].path, '/api/v1/shots/shot-carry-newest');
                assert.deepEqual(puts[0].body,
                    { annotations: { espressoNotes: 'Nine bar, tasted like blackcurrant.' } },
                    'the annotation, and nothing else');
            }));

        test('D14 — the saved note comes back: it survives the sheet and a reload',
            () => mounted(async (page) => {
                await page.evalFn(() => window.__carry.openNotes());
                await page.evalFn(() => window.__carry.typeNote('Ground finer than yesterday.'));
                await page.evalFn(() => window.__carry.saveNote());
                assert.equal(await page.evalFn(() => window.__carry.notesOpen()), false,
                    'saving shuts the sheet');

                const again = await page.evalFn(() => window.__carry.openNotes());
                assert.equal(again.notes, 'Ground finer than yesterday.',
                    're-opening shows what was saved');

                /* THE HALF THAT SEPARATES A WRITE FROM A DRAFT. A fresh boot re-reads the
                 * list from the server, so this is the server's copy answering. */
                await page.evalFn(() => window.__carry.mount());
                const reloaded = await page.evalFn(() => window.__carry.openNotes());
                assert.equal(reloaded.notes, 'Ground finer than yesterday.',
                    'the note came back from the server');
            }));

        test('D14 — the note write is a PATCH: the rating and the samples survive it',
            () => mounted(async (page) => {
                await page.evalFn(() => window.__carry.rate(4.5));
                await page.evalFn(() => window.__carry.openNotes());
                await page.evalFn(() => window.__carry.typeNote('Second pull of the morning.'));
                await page.evalFn(() => window.__carry.saveNote());

                const record = await page.evalFn(() => window.__carry
                    .serverShot('shot-carry-newest').annotations);
                assert.equal(record.espressoNotes, 'Second pull of the morning.',
                    'the note landed');
                assert.equal(record.enjoyment, 4.5, 'and the rating written a moment earlier survived');
                assert.equal(record.actualDoseWeight, 18, 'as did the dose annotation');
            }));

        test('D14 — Close sends nothing, however much was typed', () => mounted(async (page) => {
            await page.evalFn(() => window.__carry.openNotes());
            await page.evalFn(() => window.__carry.typeNote('Abandoned thought.'));
            await page.evalFn(() => window.__carry.clearRequests());
            await page.evalFn(() => window.__carry.closeNotes());

            const puts = await page.evalFn(() => window.__carry.requests('/api/v1/shots/')
                .filter((r) => r.method === 'PUT'));
            assert.deepEqual(puts, [], 'a sheet that was closed wrote nothing');
            const stored = await page.evalFn(() => window.__carry
                .serverShot('shot-carry-newest').annotations.espressoNotes);
            assert.notEqual(stored, 'Abandoned thought.', 'and the server still holds the old note');
        }));
    });
}
