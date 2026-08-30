/**
 * editor-versions.render.test.mjs — ONE ROW PER PROFILE, AND A WAY BACK.
 *
 * Ben, 27 August 2026, on being told that every content save added a near-duplicate row to
 * his profile list:
 *
 *   "the 'Every content save adds a near-duplicate row to your profile list' is not what I
 *    wanted. The idea is to have a history list so I can undo changes etc. After each save
 *    there should still only be one profie, but we should be able to go back to a previous
 *    version, how we do that I dont know what is best, I fill the best would be a diff of
 *    the new and old and changes recoreded not full profiles and we can walk back like
 *    GitHub does it I assume. But I dont know how much work that is to implement."
 *
 * ===========================================================================
 * WHY THIS IS A FULL-SHELL SUITE AND NOT A STORE TEST
 * ===========================================================================
 * `editor-save-semantics.test.mjs` drives the editor store directly and can prove every
 * request this feature makes. It would have gone green on all of them while Ben's list
 * still grew, because the thing being claimed is not about a request — it is about WHAT
 * THE LIST LOOKS LIKE AFTER YOU LEAVE THE EDITOR, which is two screens and one store
 * handoff away from the POST.
 *
 * That is this codebase's own recorded defect class, three times over: "a finished half
 * with no other half". The save path was complete and correct and nothing hid the parent;
 * the versions dialog was complete and correct and nothing had ever put a second version
 * in it. Both halves were green. So this suite books the trip Ben takes — pick the row,
 * edit, save, LEAVE, and count the rows on the list he comes back to — and only then opens
 * the history and walks back.
 *
 * ===========================================================================
 * THE SUBJECT IS CHOSEN, NOT TAKEN — and A7 is the reason
 * ===========================================================================
 * "Temp test 2" (`profile:d78a45dfcd047d734f95`) is the one record in the 147-record
 * recording that answers every question this suite needs to ask without a caveat:
 *
 *   * VISIBLE and NOT `isDefault` — a bundled profile is deliberately never hidden by a
 *     save (it is a factory template; deriving from it is not superseding it), so a test
 *     that opened one would measure the exception rather than the rule. Only 6 of the 78
 *     visible records qualify.
 *   * ITS TITLE IS UNIQUE in the corpus, so "how many rows does this profile have" is a
 *     question with one honest answer. Counting by TITLE is the point: Ben's complaint was
 *     near-DUPLICATE ROWS, which is a thing a person sees by name.
 *   * NO PARENT AND NO CHILDREN, so the version history starts genuinely empty and every
 *     entry in it at the end was put there by this test.
 *   * THREE STEPS, ALL AT 93.0 C, so the temperature cell has somewhere to move.
 *
 * `clickRowTitled` presses the row this profile actually has. Index-based row picking
 * cannot work here and the reason is the feature itself: hiding a superseded version
 * re-orders the list under the test, so index 0 before a save and index 0 after it are
 * different rows.
 *
 * ===========================================================================
 * SAVE CLOSES THE EDITOR NOW, AND THIS SUITE WAS REWRITTEN AROUND IT
 * ===========================================================================
 * Ben, later on 27 August 2026, after saving on the bench and being left standing in the
 * editor: "pressing save should close and arm, I shouldn't need to press save twice."
 * `commitPlan`'s content-save branch returns `close: true` now, and `editor-screen.js
 * #commit` starts the write and then leaves.
 *
 * TWO THINGS IN HERE WERE WRITTEN ON THE OTHER RULE. Each save used to be followed by an
 * explicit `pressCancel()` to get back to the list, and block 2 took two saves in a row
 * WITHOUT leaving, which is what let it read three notices off one toast surface. Both
 * walks now re-enter the editor between saves, because that is what a person does.
 *
 * AND THE TOASTS ARE UNREACHABLE FROM THE SHELL. `<editor-screen>`'s
 * `disconnectedCallback` runs `#unwatch()`, so once the save has taken the screen away the
 * store's answer reaches nothing: `#announce` is never called and the notice is never
 * created — it is not merely invisible. Every save-outcome sentence this screen owns is
 * affected, the failures included. What that costs each block is written where the
 * assertion used to be, rather than summarised here and forgotten.
 *
 * A8 — NOTHING HERE READS A FILE. Every claim is a real press through Chrome's hit test, a
 * value read off the mounted draft, the text of a rendered row, or the state of the
 * fixture server that answered the requests.
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

/* THE WHOLE TRIP RUNS AT ONE GEOMETRY. Nothing this suite asserts is about a box — it is
 * about how many rows a list has and what a dialog says — and `GATE_A_GEOMETRIES` exists
 * to catch layout that only works at one size. Running an eight-step save walk twice to
 * re-prove a number that cannot vary by viewport would double the slowest suite in the
 * tree for no measurement. The editor's own geometry is covered by
 * `editor-skeleton.render.test.mjs` at every gate-A size. */
const [GEOMETRY] = GATE_A_GEOMETRIES;

describe(`profile versions @ ${GEOMETRY.name}`, () => {

    /* =====================================================================
     * 1. BEN'S COMPLAINT, COUNTED. Two saves, and the list must not grow.
     * ===================================================================== */
    test('two content saves leave ONE row on the list, and the versions behind it',
        () => browser.withPage({ geometry: GEOMETRY }, async (page) => {
            await page.mount(STAGE, FIXTURE);
            assert.equal(await L(page, 'mount()'), 'ready', 'the shell must boot');
            assert.equal(await L(page, "goto('selector')"), 'selector-screen');
            assert.equal(await L(page, 'librarySettled()'), true);

            /* THE STARTING STATE, MEASURED RATHER THAN ASSUMED. If the corpus ever grows a
             * second "Temp test 2" this fails here, naming the reason, instead of failing
             * later as a mysterious off-by-one in a count of rows. */
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

            /* ---- SAVE ONE ---------------------------------------------------- */
            assert.equal(await L(page, 'bumpTemperature(0)'), true, 'the + was pressed');
            const firstEdit = (await L(page, 'editor()')).temperatures[0];
            assert.ok(firstEdit > original, `the cell moved (${original} -> ${firstEdit})`);
            assert.equal(await L(page, 'pressSave()'), true);

            /* THE SAVE IS THE WAY OUT NOW, so there is no `pressCancel()` here any more.
             *
             * This line used to be a toast assertion — `[{tone: 'ok', text: 'Saved. The
             * previous version is kept.'}]`, the LINKED wording — followed by a Cancel
             * press to get back to the list. Ben, 27 August 2026: "pressing save should
             * close and arm, I shouldn't need to press save twice." The Cancel is gone
             * because the save does its job, and the toast is gone with it: the screen
             * unmounts, `disconnectedCallback` unsubscribes, and the store's answer
             * arrives at nothing. That wording is still pinned where it can still be
             * reached — `editor-skeleton.render.test.mjs`, on an editor mounted with no
             * shell to unmount it — so the sentence is not unpinned by this rewrite; only
             * its reachability from the shipping path is, and block 1 of
             * `editor-save-loop.render.test.mjs` is where that is recorded as its own
             * assertion. */
            assert.equal(await L(page, "settledScreen('selector-screen')"), 'selector-screen',
                'the one press wrote the version AND left the editor');

            /* THE ASSERTION BEN ASKED FOR. Before this change it was 2. */
            assert.equal(await L(page, `listableRowsTitled('${SUBJECT}')`), 1,
                'after a save the profile still has ONE row on the list — '
                + '"After each save there should still only be one profie"');

            /* AND THE PILE MUST NOT HAVE MOVED RATHER THAN GONE. A superseded version is
             * hidden, and the selector's Hidden toggle reads the hidden set — so without
             * the superseded filter this is where the near-duplicates would pile up
             * instead, and Ben's complaint would be relocated rather than fixed. */
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

            /* ---- SAVE TWO, because a fix that only holds for the first save is not a fix.
             * This is the save that would take the list to three rows. -------------- */
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

    /* =====================================================================
     * 2. WALKING BACK. The history, what it says changed, and a restore that
     *    leaves the list exactly as it found it.
     * ===================================================================== */
    test('Previous versions lists the history, says what changed, and restores',
        () => browser.withPage({ geometry: GEOMETRY }, async (page) => {
            await page.mount(STAGE, FIXTURE);
            assert.equal(await L(page, 'mount()'), 'ready');
            assert.equal(await L(page, "goto('selector')"), 'selector-screen');
            assert.equal(await L(page, 'librarySettled()'), true);

            const rootId = await L(page, `clickRowTitled('${SUBJECT}')`);
            assert.equal(await L(page, 'pressEdit()'), 'editor-screen');
            const original = (await L(page, 'editor()')).temperatures[0];

            /* TWO SAVES, so the history has two entries behind the tip: the root, and one
             * version between it and where we end up.
             *
             * THE LOOP RE-ENTERS THE EDITOR EVERY TIME, and it did not have to before
             * 27 August 2026. Two `pressSave()` calls back to back used to leave you
             * standing in the editor on the record you had just written, which is exactly
             * what Ben objected to: "pressing save should close and arm, I shouldn't need
             * to press save twice." Each save now lets itself out, so the walk back in —
             * pick the one visible row, press Edit — is part of the loop. That is a
             * truer reproduction of the trip than the old one was, not a workaround for
             * it: nobody edits a profile twice without going past the list. */
            for (const _ of [1, 2]) {
                assert.equal(await L(page, 'bumpTemperature(0)'), true);
                assert.equal(await L(page, 'pressSave()'), true);
                assert.equal(await L(page, "settledScreen('selector-screen')"), 'selector-screen',
                    'the save closed the editor by itself');
                assert.ok(await L(page, `clickRowTitled('${SUBJECT}')`),
                    'the profile still has exactly one row to go back into');
                assert.equal(await L(page, 'pressEdit()'), 'editor-screen');
            }
            const tip = await L(page, 'editor()');
            assert.ok(tip.temperatures[0] > original, 'the tip is two bumps above the original');

            /* ---- THE HISTORY ------------------------------------------------- */
            assert.equal(await L(page, 'openVersions()'), 'ready',
                'the lineage came back with more than one entry');
            const rows = await L(page, 'versionRows()');
            assert.equal(rows.length, 2,
                'the dialog lists the two older versions and not the one being edited');
            assert.ok(rows.every((row) => row.id && row.id !== tip.recordId),
                'every row names a record, and none of them is the open one');
            assert.ok(rows.some((row) => row.id === rootId), 'the original is in the list');

            /* WHAT CHANGED, IN WORDS. Ben asked for "a diff of the new and old"; this is
             * that diff, computed from two records the dialog is already holding and never
             * stored anywhere. The root has no parent to be compared against and says so
             * ("original"), which is A7 — not "no changes", which would be a claim about a
             * comparison that never happened. The other row moved exactly one step, and
             * the step number a person reads is ONE-BASED because that is how the matrix
             * in front of them counts. */
            const rootRow = rows.find((row) => row.id === rootId);
            const middleRow = rows.find((row) => row.id !== rootId);
            assert.match(rootRow.text, /original/,
                'the first version has no parent to be diffed against and says "original"');
            assert.match(middleRow.text, /step 1/,
                'and the version after it says which step it moved');
            assert.doesNotMatch(middleRow.text, /steps\[0\]/,
                'in words — a field list is not a sentence');

            /* ---- THE WALK BACK ----------------------------------------------- */
            assert.equal(await L(page, `pickVersion('${rootId}')`), true);
            const restored = await L(page, 'editor()');
            assert.equal(restored.temperatures[0], original,
                'picking the original puts its steps back into the draft');
            assert.equal(restored.recordId, tip.recordId,
                'and writes NOTHING — the editor is still seated on the record it opened');
            assert.equal(restored.saveLabel, 'Save (1)',
                'the restore is an unsaved change like any other, so Cancel still throws it away');

            /* THE SAVE THAT MAKES IT STICK, AND THE TRAP IT WALKS THROUGH.
             *
             * The content being posted is content the server already has, so
             * `ProfileController.create` returns THE EXISTING RECORD — hidden, because this
             * version was superseded two saves ago — and ignores the parentId that was
             * sent. Without the un-hide in `settleToOneRow`, this press would hide the tip,
             * resolve to a hidden record, and leave the profile with NO row at all. */
            assert.equal(await L(page, 'pressSave()'), true);
            assert.equal(await L(page, "settledScreen('selector-screen')"), 'selector-screen',
                'the restore save leaves like any other save');

            /* WHAT THIS BLOCK LOST ON 27 AUGUST 2026, NAMED SO IT CAN BE FOUND AGAIN.
             *
             * Three assertions stood here. They read the toast surface — which kept every
             * notice because this walk never left the editor — and claimed that the last
             * one said "Restored. This version is now the current one.", that it was NOT
             * the NOT_LINKED wording ("the previous version was not kept", which is what
             * a content-addressed re-use used to be reported as), and that there were
             * three of them, one per save, none swallowed.
             *
             * NONE OF THE THREE CAN BE MADE NOW, and not because the toast is merely off
             * screen. `#commit` leaves as soon as the write is in flight, the shell
             * unmounts `<editor-screen>`, and `disconnectedCallback` calls `#unwatch()` —
             * so the store publishes SAVED into a subscription that no longer exists,
             * `#announce` is never reached, and the notice is never created at all. That
             * is a consequence of Ben's ruling ("pressing save should close and arm, I
             * shouldn't need to press save twice"), not of this rewrite, and it applies to
             * every save-outcome sentence the screen owns — the refusals and failures too.
             *
             * "Restored. This version is now the current one." is left with NO test
             * anywhere as a result: it was pinned here and only here. It is written out
             * above so a grep for the sentence still lands in this file, and so that
             * whoever decides how a save reports itself after the close has the wording
             * and the reason in front of them.
             *
             * WHAT IS ASSERTED INSTEAD IS THE THING THE TOAST WAS REPORTING, and it is
             * read off the server rather than off a sentence: no fourth record was
             * created, and the record that came back is the one that was restored, un-
             * hidden. That is the whole of "this version is now the current one", and it
             * was the load-bearing claim under the wording all along. */
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
            assert.equal(await L(page, `clickRowTitled('${SUBJECT}')`), rootId);
            assert.equal(await L(page, 'pressEdit()'), 'editor-screen');
            const reopened = await L(page, 'editor()');
            assert.equal(reopened.temperatures[0], original,
                `re-opening shows the restored value (${original}), not the tip it was `
                + 'restored over');
            assert.equal(reopened.saveLabel, 'Save', 'and nothing is unsaved in it');

            /* THE FUTURE WAS NOT LOST. Walking back is forward-only: the two versions that
             * came after the one we restored are still in the history, so a person who
             * undoes too far can redo. This is why restoring saves rather than deletes. */
            assert.equal(await L(page, 'openVersions()'), 'ready');
            const after = await L(page, 'versionRows()');
            assert.equal(after.length, 2,
                'the two later versions are still there to walk forward to');

            assert.deepEqual(page.pageErrors, [], 'and the trip threw nothing');
        }));
});
