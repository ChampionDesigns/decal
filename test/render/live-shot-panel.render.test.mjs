/**
 * live-shot-panel.render.test.mjs — the Live band's shot panel: the rating that was never
 * sent, and the notes sheet that named no shot.
 *
 * Written 29 August 2026 for the fix campaign's cluster L.
 *
 *   F-023 (+ F-010)  "Rate this shot". The rating was set, was printed — the button went
 *          from "Rate this shot —" to "Rate this shot 60" — and was NEVER SENT. The audit
 *          swept a whole run's request log: zero writes to any `/api/v1/shots/<id>` route,
 *          `localStorage` and `sessionStorage` both `{}`. After a reload it read "—"
 *          again. Wave 0 had already reported the wire: `ui-rating-control` emits
 *          `rating-change` and nothing in `src/` listened (F-010). Everything else
 *          existed — a pin-verified `putShotsById` row whose `consumedBy` NAMED
 *          `shots-store.js setEnjoyment`, and that method, fully built, with no caller.
 *
 *   F-029  "All notes" opened a sheet whose whole text was "Close": a header, an empty
 *          body and one button. It named no shot — not the date, not the profile, not the
 *          weight the panel two inches away was printing from the SAME already-fetched
 *          record.
 *
 * THE SMALLEST HONEST PATCH IS PART OF THE SUBJECT. `putShotsById`'s own contract gate says
 * the handler deep-merges the body over `existingShot.toJson()`, so a partial
 * `{annotations:{enjoyment}}` preserves every other annotation and every sample — and
 * sending a whole record back is the risky spelling, not the safe one. The fixture's PUT
 * merges one level deep for exactly that reason, and there is a test below that the shot's
 * OTHER annotation survives the write.
 *
 * BOTH GATE A GEOMETRIES, on the shared carry fixture: a real `createAppBoot`, a real
 * transport, the real shots store, and a scripted table with no server behind it.
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

        /* ═══════════════════════════════════════════════════════════════════
         * F-023 / F-010 — the rating leaves the building
         * ═════════════════════════════════════════════════════════════════ */

        test('F-023 — rating a shot PUTs the enjoyment to that shot', () => mounted(async (page) => {
            await page.evalFn(() => window.__carry.clearRequests());
            await page.evalFn(() => window.__carry.rate(60));

            const puts = await page.evalFn(() => window.__carry.requests('/api/v1/shots/')
                .filter((r) => r.method === 'PUT'));
            /* THE MEASUREMENT THE FINDING MADE, INVERTED: "zero writes to any
             * /api/v1/shots/<id> route" becomes exactly one, to this shot. */
            assert.equal(puts.length, 1, `one PUT, not ${puts.length}: ${JSON.stringify(puts)}`);
            assert.equal(puts[0].path, '/api/v1/shots/shot-carry-newest');
            assert.deepEqual(puts[0].body, { annotations: { enjoyment: 60 } },
                'the SMALLEST honest patch — the handler deep-merges it');
        }));

        test('F-023 — the panel prints the rating from the answer, and it survives a reload',
            () => mounted(async (page) => {
                await page.evalFn(() => window.__carry.rate(60));
                assert.equal(await page.evalFn(() => window.__carry.shotPanel().rating), 60,
                    'the band holds the score');
                assert.match(await page.evalFn(() => window.__carry.ratingFace()), /60/,
                    'and the button prints it in place of the dash');

                /* THE HALF THE FINDING'S PROVEN LINE IS ABOUT: "both are still so after a
                 * reload". A fresh boot re-reads the list from the server, so this is the
                 * server's copy answering, not the screen's memory. */
                await page.evalFn(() => window.__carry.mount());
                assert.equal(await page.evalFn(() => window.__carry.shotPanel().rating), 60,
                    'the rating came back from the server');
            }));

        test('F-023 — the write is a PATCH: the shot\'s other annotations survive it',
            () => mounted(async (page) => {
                await page.evalFn(() => window.__carry.rate(75));

                const record = await page.evalFn(() => window.__carry
                    .serverShot('shot-carry-newest').annotations);
                assert.equal(record.enjoyment, 75, 'the rating landed');
                assert.equal(record.actualDoseWeight, 18, 'and the dose annotation was not trampled');
                assert.ok(record.espressoNotes, 'nor the note');
            }));

        test('F-023 — rating the OLDER shot names the older shot', () => mounted(async (page) => {
            /* THE JOIN THAT A ONE-SHOT FIXTURE CANNOT SEE. The control carries `shotId`
             * and the listener uses it, so stepping the band moves what is rated. A
             * listener that reached for "the newest" instead would pass with one shot. */
            const older = await page.evalFn(() => window.__carry.stepOlder());
            assert.equal(older, 'shot-carry-older', 'the arrow steps the band');

            await page.evalFn(() => window.__carry.clearRequests());
            await page.evalFn(() => window.__carry.rate(20));
            const puts = await page.evalFn(() => window.__carry.requests('/api/v1/shots/')
                .filter((r) => r.method === 'PUT'));
            assert.equal(puts.length, 1);
            assert.equal(puts[0].path, '/api/v1/shots/shot-carry-older');
        }));

        /* ═══════════════════════════════════════════════════════════════════
         * F-029 — the notes sheet names this shot and shows what is written
         * ═════════════════════════════════════════════════════════════════ */

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
            /* ROUND 2 (D14): the note is read off the EDITOR's live document rather than
             * off the paragraph round 1 printed. The claim is unchanged — the sheet shows
             * the text stored against this shot — and the surface it is shown on is now
             * one a person can type into. */
            assert.equal(sheet.notes, expected, 'the stored note, verbatim');
            assert.equal(sheet.empty, null, 'and no empty state beside it');
        }));

        test('D14 — a shot with no note opens an EMPTY EDITOR that invites one',
            () => mounted(async (page) => {
                await page.evalFn(() => window.__carry.stepOlder());
                const sheet = await page.evalFn(() => window.__carry.openNotes());

                /* ROUND 1's ASSERTION, OVERRIDDEN BY D14. It read:
                 *     assert.ok(sheet.empty, 'so the sheet says so');
                 *     assert.match(sheet.empty.body, /Nothing is written against this shot/);
                 * — correct for a sheet that could only READ. Once the sheet can be written
                 * in, "no note yet" is not an empty STATE, it is an empty FIELD: there is
                 * something to do about it, and an empty-state panel would be a wall in
                 * front of the thing you came to do. The sentence survives as the editor's
                 * invitation, which is where a person can act on it. */
                assert.equal(sheet.editable, true, 'the shot can be written about');
                assert.equal(sheet.notes, '', 'and there is nothing written yet');
                assert.equal(sheet.empty, null, 'so no empty-state panel stands in the way');
                assert.match(sheet.placeholder, /Nothing is written against this shot/,
                    'the sentence moved into the field as its invitation');

                /* AND IT STILL NAMES THE SHOT. An empty editor is not an empty sheet. */
                assert.match(sheet.identity, /Beta ristretto/, 'the older shot is still named');
            }));

        /* ═══════════════════════════════════════════════════════════════════
         * D14 — the name, and the writing half
         *
         * Round 1 flagged the wording ("All notes" inside a PER-SHOT control argues for
         * this shot; the word "All" argues for every note ever written) and left the
         * intent line's "and add to" owed. Ben settled both: the surface is "Shot notes"
         * and it writes.
         * ═════════════════════════════════════════════════════════════════ */

        test('D14 — the surface is called "Shot notes", on the button and on the sheet',
            () => mounted(async (page) => {
                /* ROUND 1's ASSERTION, OVERRIDDEN BY D14. It read:
                 *     assert.equal(sheet.heading, 'All notes',
                 *         'the audit flagged the naming for Ben; this fix changes the
                 *          CONTENT only');
                 * That test existed to hold the line while the naming was Ben's to make.
                 * He has made it. */
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
                /* THE SMALLEST HONEST PATCH, AND THE ANNOTATION RATHER THAN ITS SHADOW:
                 * the handler rewrites the top-level `shotNotes` from this field on every
                 * PUT, so a body carrying `shotNotes` would be writing to a place the
                 * server is about to overwrite from somewhere else. */
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
                await page.evalFn(() => window.__carry.rate(42));
                await page.evalFn(() => window.__carry.openNotes());
                await page.evalFn(() => window.__carry.typeNote('Second pull of the morning.'));
                await page.evalFn(() => window.__carry.saveNote());

                const record = await page.evalFn(() => window.__carry
                    .serverShot('shot-carry-newest').annotations);
                assert.equal(record.espressoNotes, 'Second pull of the morning.',
                    'the note landed');
                assert.equal(record.enjoyment, 42, 'and the rating written a moment earlier survived');
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
