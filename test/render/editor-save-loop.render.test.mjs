/**
 * editor-save-loop.render.test.mjs — THE SAVE, FOLLOWED THROUGH.
 *
 * Ben, 27 August 2026: "the profile editor, the save button doesn't seem to be doing
 * anything. I can make a change, hit save exit and go back into the editor and it dosn't
 * seem to have the change."
 *
 * ===========================================================================
 * WHY THIS SUITE EXISTS WHEN THE EDITOR'S OWN SAVE TEST WAS ALREADY GREEN
 * ===========================================================================
 * `editor-skeleton.render.test.mjs` has proved since fix run 4 that an edit counts, that
 * the band reads "Save (1)", that the press POSTs a wrapped body carrying the edit and the
 * parent link, and that the answer is announced and re-seated. All of it was true while
 * Ben's work was disappearing, because all of it is about ONE SCREEN and the defect was
 * between two.
 *
 * MEASURED, before the fix, through the shell in this file's own fixture: open "7g basket"
 * (step 1 at 90 C), press the matrix's + once (90 -> 90.5), press Save. One POST goes out
 * with 90.5 on the wire; ReaPrime answers 201 with a NEW record carrying
 * parentId = the opened record, which is DQ-629 working exactly as Ben ruled it should;
 * the toast says "Saved. The previous version is kept." Then leave, and press Edit again:
 * **the editor re-seated the PARENT, at 90 C.** The library had never been told, so its
 * `selectedId` still named the record the save had superseded. 147 records became 148 and
 * the app went on pointing at the old one.
 *
 * So the assertion that would have caught it is not "the request was made". It is THE
 * SECOND OPENING — press Edit twice with a save in between and read the number on screen.
 * That is what the first block does, and it is written as one ordered walk because the
 * steps really are ordered: you cannot re-open before you have left.
 *
 * ===========================================================================
 * WHAT ONE PRESS OF SAVE MEANS — BEN'S TWO RULINGS, 27 AUGUST 2026, LATE
 * ===========================================================================
 * This suite was written that morning and every test in it had to be rewritten by the
 * evening, because Ben went back to the bench with the fix on it and pressed Save.
 *
 * WHAT HE SAW: the save landed, and he was still in the editor with a toast on it. So he
 * pressed Save again — that second press lands on the `!dirty` branch, which CLOSES — and
 * then re-opened to check, and read the old value, because he had not been looking at the
 * saved record. His words:
 *
 *     "pressing save should close and arm, I shouldn't need to press save twice"
 *
 * TWO RULINGS IN ONE SENTENCE, and both are now source:
 *
 *   SAVE CLOSES. `commitPlan`'s content-save branch returns `close: true` (it returned
 *   false), and so does its cannot-tell branch. `editor-screen.js #commit` starts the
 *   write FIRST and leaves after it — the early-return close is now `plan.close &&
 *   !plan.operation`, because leaving before `#store[operation](body)` would have thrown
 *   the write away on the way out. One button, one meaning.
 *
 *   EVERY SAVE ARMS. `app-boot.js adoptSavedProfile()` calls `library.arm(savedId)` on
 *   every successful save. It used to be guarded — arm only if the machine was already
 *   holding the record the editor was seated on — and block 1b's second test pinned that
 *   guard. The guard is gone and the test now claims the opposite; the block's own header
 *   carries why, including the part that is not just "Ben said so": the guard compared
 *   against `library.get().loaded.id`, which R1 resolves by TITLE MATCH, and Ben's bench
 *   has five records titled "Pressure Tuning", so R1 answered `ambiguous`, `loaded.id`
 *   came back null and the guard refused every time. Its failure mode was silence, inside
 *   the very "I saved and nothing happened" it was meant to prevent.
 *
 * ONE THING WENT WITH THE CLOSE, and it is asserted rather than mourned: the editor's
 * notice surface is the EDITOR'S, so a Save that leaves takes the "Saved. The previous
 * version is kept." toast with it. Block 1 reads that absence out loud, because a build
 * that later keeps the person informed across the close should turn a test red and get
 * the rule looked at, not slide past a comment nobody re-read.
 *
 * ===========================================================================
 * BLOCK 1b IS THE SAME COMPLAINT'S OTHER HALF: THE MACHINE, NOT THE SELECTOR
 * ===========================================================================
 * Block 1 follows the SELECTION. Ben's route into the editor is the Live band's "Edit
 * profile", which `<app-root>` resolves through `library.get().loaded` — the profile the
 * MACHINE is holding — and which a save deliberately did not move. So the sentence came
 * back after the selection was already following the save: every edit still started from
 * the same fixed point, and the versions came out as siblings off one ancestor rather than
 * as a chain. Measured on his tablet over ADB, 27 August 2026, three of the five visible
 * "Pressure Tuning" rows shared one parent, `profile:ea352e2e…` — the armed record.
 *
 * Block 1b is two tests. The FIRST is now Ben's whole walk end to end and is the strongest
 * claim this file makes: edit, ONE press of Save, the editor closes by itself, the machine
 * is holding what was saved, and re-opening shows the edit. The SECOND is the same walk
 * with the machine holding something else, and it says the arm happens anyway — which is
 * the rule, and which is a real cost stated in the open rather than a guard's silence.
 * Both are mutation-checked against the source they pin; the block's own header has it.
 *
 * ===========================================================================
 * THE LAST TWO BLOCKS ARE THE SAME DEFECT CLASS, ONE LAYER DOWN
 * ===========================================================================
 * A Save that cannot tell whether there are changes must not quietly decide there are
 * none — `commitPlan`'s CANNOT TELL IS NOT CLEAN block argues why, and block 2 presses the
 * real control against a store that answers `tell: 'cannot-tell'` and asserts that the
 * draft is WRITTEN. Until Ben's ruling it also asserted that the screen stayed; now the
 * screen leaves like any other save and what still matters — the only thing that ever
 * mattered there — is that the draft was written on the way out rather than dropped.
 * Block 3 is the smallest version of B10's rule: a commit that never became a request
 * still says so, and still does not navigate, because there was nothing to save.
 *
 * A8 — NOTHING HERE READS A FILE. Every claim is a real press through Chrome's hit test,
 * a value read off the mounted draft, a request the fixture's server recorded, or the
 * text of a rendered notice.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { EDITOR, mountEditor, editingProfile } from '../harness/editor.js';

const FIXTURE = ['/test/fixtures/editor-save-loop-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

/** One call into the fixture's in-page surface. */
const L = (page, expression) => page.eval(`window.__saveLoop.${expression}`);

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`the save loop @ ${geometry.name}`, () => {

        /* =================================================================
         * 1. THE WALK BEN TOOK. One mount, one ordered trip, and the
         *    assertions read what each step captured — so a failure names
         *    the STEP rather than the chain.
         *
         *    IT IS ONE PRESS OF SAVE SINCE 27 AUGUST 2026, and the test
         *    title says so because that is the half Ben was arguing with.
         *    It used to press Save and then press Cancel to leave, which
         *    is exactly what he was doing by hand — and pressing a second
         *    control to finish a save is what made the first one read as
         *    dead. "pressing save should close and arm, I shouldn't need
         *    to press save twice."
         * ================================================================= */
        test('ONE press of Save writes the edit, closes the editor, and the edit is there on re-opening',
            () => browser.withPage({ geometry }, async (page) => {
                await page.mount(STAGE, FIXTURE);
                assert.equal(await L(page, 'mount()'), 'ready', 'the shell must boot');
                assert.equal(await L(page, "goto('selector')"), 'selector-screen');
                assert.equal(await L(page, 'librarySettled()'), true);

                /* PICK A ROW AND OPEN IT, through the selector's own controls. */
                const openedId = await L(page, 'clickRow(0)');
                assert.ok(openedId, 'a profile row was pressed');
                assert.equal(await L(page, 'pressEdit()'), 'editor-screen');

                const before = await L(page, 'editor()');
                assert.equal(before.recordId, openedId, 'the editor opened the row that was picked');
                assert.equal(before.saveLabel, 'Save', 'nothing is unsaved yet');
                const wasTemperature = before.temperatures[0];
                assert.ok(Number.isFinite(wasTemperature), 'step 1 has a temperature to move');

                /* THE EDIT, THROUGH THE CELL'S OWN + — not a dispatched event. */
                assert.equal(await L(page, 'bumpTemperature(0)'), true, 'the + was pressed');
                const edited = await L(page, 'editor()');
                assert.ok(edited.temperatures[0] > wasTemperature,
                    `the cell moved (${wasTemperature} -> ${edited.temperatures[0]})`);
                assert.equal(edited.saveLabel, 'Save (1)', 'D11: one change, counted');
                const wanted = edited.temperatures[0];

                /* THE SAVE. ONE PRESS, AND IT IS THE ONLY PRESS IN THIS TEST THAT LEAVES —
                 * there is no Cancel after it, which is the whole of Ben's first ruling. */
                assert.equal(await L(page, 'pressSave()'), true);

                /* AND THE EDITOR IS GONE, WITHOUT A SECOND PRESS. This is the assertion
                 * the 27 August evening rewrite is for: the walk that failed him was Save,
                 * Save again to get out, re-open — two presses of one control meaning two
                 * different things, which is why a working save read as a broken one. */
                assert.equal(await L(page, "settledScreen('selector-screen')"), 'selector-screen',
                    'Save closed the editor by itself — Ben, 27 August 2026: "pressing save '
                    + 'should close and arm, I shouldn\'t need to press save twice"');

                /* WHAT THE CLOSE COST, SAID OUT LOUD RATHER THAN LEFT IN A COMMENT.
                 *
                 * This assertion used to read the toast — `[{tone: 'ok', text: 'Saved. The
                 * previous version is kept.'}]`, B10's "save, then report what happened",
                 * and it was true on this path until the ruling. It cannot be true now: the
                 * notice surface is `<editor-screen>`'s own `#notice`, `#commit` leaves as
                 * soon as the write is in flight, and the shell unmounts the screen — so
                 * the report is authored into a surface that is no longer on the page. The
                 * store's answer still reaches `app-boot.js`, which follows the save
                 * through and notes it to the LOGGER, and that is not the same as telling
                 * the person.
                 *
                 * IT IS ASSERTED AS AN ABSENCE ON PURPOSE. A comment saying "the toast is
                 * gone now" rots the first time someone makes the outcome survive the
                 * close; a test saying it goes RED, and the rule gets looked at rather than
                 * quietly outlived. `editor-skeleton.render.test.mjs` still pins the toast
                 * itself, on a screen mounted with no shell to unmount it, so the sentence
                 * and its tone are not unpinned by this — only its reachability from the
                 * shipping path is, and this is where that is recorded. */
                assert.equal(await L(page, 'notices()'), null,
                    'the editor took its notice surface with it: after the ruling there is '
                    + 'no on-screen report of a save, because the screen that would carry '
                    + 'it has left. If this ever comes back, revisit B10 here rather than '
                    + 'deleting the assertion');

                const created = await L(page, 'created()');
                assert.equal(created.length, 1, 'one press, one record');
                assert.equal(created[0].parentId, openedId,
                    'B11/DQ-629: the new record links to the one the editor opened from');
                assert.equal(created[0].temperatures[0], wanted, 'the edit reached the server');

                /* THE HALF THAT WAS MISSING. The listing has grown, and the app is now
                 * pointing at the record the save created rather than at its parent. */
                const library = await L(page, 'library()');
                assert.equal(library.selectedId, created[0].id,
                    'the saved record is the one the app is working on — this is the '
                    + 'assertion Ben\'s bug fails: it stayed on the parent');

                /* AND THE WHOLE POINT, READ OFF THE SCREEN. */
                assert.equal(await L(page, 'pressEdit()'), 'editor-screen');
                const reopened = await L(page, 'editor()');
                assert.equal(reopened.recordId, created[0].id);
                assert.equal(reopened.temperatures[0], wanted,
                    `re-opening the editor must show the saved value (${wanted}), not the `
                    + `one it was saved over (${wasTemperature})`);
                assert.equal(reopened.saveLabel, 'Save', 'and nothing is unsaved in it');

                /* EXACTLY ONE WRITE. A follow-through that re-saved, or a re-read that
                 * looped, would show up here before it showed up anywhere else. */
                const writes = (await L(page, 'calls()'))
                    .filter((c) => c.method === 'POST' && c.path === '/api/v1/profiles');
                assert.equal(writes.length, 1, 'one Save, one POST');

                /* AND THE FOLLOW-THROUGH MUST NOT OUTLIVE ITS SAVE — the hazard the fix
                 * itself introduces, measured as request volume because that is where it
                 * shows first. The editor store goes on reporting `save: 'saved'` long
                 * after the save, and `open()` seats a record without clearing it, so a
                 * follow-through keyed on "the state SAYS saved" rather than on the EDGE
                 * INTO saved re-fires on every subsequent open: an ordinary Edit press
                 * would re-read the whole listing, and would then be one `select` away
                 * from dragging the selection off whatever the user had just picked.
                 *
                 * The trip above already left the editor and came back, so the listing has
                 * settled. Pressing Edit from a selector that is already mounted loads
                 * nothing by itself — so the count must not move. Measured with the edge
                 * guard removed: 7 reads across this walk instead of 5. */
                assert.equal(await L(page, 'pressCancel()'), 'selector-screen');
                const otherId = await L(page, 'clickRow(2)');
                assert.ok(otherId && otherId !== created[0].id, 'a different row was picked');

                const readsBefore = await L(page, 'listingReads()');
                assert.equal(await L(page, 'pressEdit()'), 'editor-screen');
                assert.equal(await L(page, 'listingReads()'), readsBefore,
                    'opening the editor is not a save, so it must not re-read the listing');

                const other = await L(page, 'editor()');
                assert.equal(other.recordId, otherId,
                    'the editor opened the profile that was picked, not the last one saved');
                assert.equal((await L(page, 'library()')).selectedId, otherId,
                    'and the selection stayed on it');

                assert.deepEqual(page.pageErrors, [], 'and the trip threw nothing');
            }));
    });
}

/* =====================================================================
 * 1b. THE OTHER HALF OF THE SAME BUG: WHAT THE MACHINE IS HOLDING.
 * =====================================================================
 *
 * Block 1 above proves that the SELECTOR follows a save. That was only half of Ben's
 * complaint, and the half that had already been fixed by the time he wrote the sentence
 * again. The other half is that "Edit profile" on the Live band does not resolve through
 * the selector's highlight at all: `<app-root>` resolves it through
 * `library.get().loaded` — the profile THE MACHINE is holding — and a save deliberately
 * did not move that.
 *
 * MEASURED ON BEN'S TABLET, 27 August 2026, driven over ADB before the fix. One press of
 * a temperature step took 85.0 to 85.5, the band read "Save (1)", Save wrote
 * `profile:4357388e…` at 85.5, and the listing went 101 -> 102 records. Then: leave, press
 * Edit profile again, and the editor opened 85.0. Three of the five visible "Pressure
 * Tuning" rows shared ONE parent, `profile:ea352e2e…` — the record the machine was
 * holding — so the versions were SIBLINGS off a fixed point rather than a chain, because
 * every edit started from the same place. Nothing was ever lost; every version was in the
 * library and the editor kept re-opening the ancestor. His words, again: "I can make a
 * change, hit save exit and go back into the editor and it dosn't seem to have the
 * change."
 *
 * BEN'S RULING, 27 August 2026, asked as a straight question and answered "yes": after you
 * save an edit to the armed profile, the machine should be armed with the new version, so
 * what you pull matches what you edited. That is the first test.
 *
 * ===========================================================================
 * THE SECOND TEST CLAIMED THE OPPOSITE THIS MORNING. HERE IS WHY IT DOES NOT NOW.
 * ===========================================================================
 * "Arm the save" is one sentence with two readings, and this file argued the narrow one
 * for most of 27 August 2026. `adoptSavedProfile` armed only when the machine was ALREADY
 * holding what was edited — the save is a CHILD of the held record, or it came back with
 * the SAME id — and this test asserted, against the wire, that editing anything else left
 * the machine alone. The reasoning was that arming every save lets an edit to an unrelated
 * profile silently change what the machine will brew next: a side effect nobody asked for,
 * invisible when it happens, discovered one shot later.
 *
 * TWO THINGS RETIRED THE GUARD, AND THE SECOND IS THE ONE THAT SETTLES IT.
 *
 *   BEN ASKED FOR THE PLAIN RULE, in plain words, that evening: "pressing save should
 *   close and arm, I shouldn't need to press save twice." Not "arm when it is the one you
 *   were brewing". Arm.
 *
 *   AND THE GUARD COULD NOT ANSWER ITS OWN QUESTION ON HIS MACHINE. It compared against
 *   `library.get().loaded.id`, and `loaded` is resolved by matching the workflow
 *   document's profile TITLE against the listing, because the workflow carries no record
 *   id (`adapters-r.js r1LoadedProfileId`). Ben's bench has FIVE visible records titled
 *   "Pressure Tuning". R1 answers `ambiguous` — correctly, it will not guess — `loaded.id`
 *   comes back null, and a guard whose premise is null refuses every time. So on the one
 *   machine this was written for, the guard's behaviour was: never arm, say nothing. That
 *   is the same silence as the bug it was sitting inside.
 *
 * A GUARD THAT CANNOT FIRE IS NOT PROTECTION, IT IS A DEAD BRANCH WITH A GOOD COMMENT ON
 * IT. The rule that replaced it needs no premise at all, which is the better reason to
 * prefer it: a save is a deliberate act on a profile, and arming what you just saved is
 * what the person who pressed the button meant.
 *
 * WHAT IT COSTS IS REAL AND IS NOT HIDDEN. The second test below is now the statement of
 * the cost: save an edit to something the machine was NOT holding, and the machine is
 * holding it afterwards. If that ever turns out to be the wrong trade, this is the test
 * that has to be argued with — which is the point of writing it as a claim rather than
 * deleting it. The fix for the ambiguity it stands on is upstream's, and is already
 * written up as the fifth ask: put the record id in the workflow document.
 *
 * A CLAIM IS ONLY PINNED BY A TEST THAT FAILS WHEN THE CODE IS BROKEN. Both tests below
 * were mutation-checked against the current source: deleting `library.arm(savedId)` from
 * `adoptSavedProfile` turns BOTH red on an empty arm list, and reverting `commitPlan`'s
 * content-save branch to `close: false` turns both red where they read the screen. Neither
 * passes both ways.
 *
 * ===========================================================================
 * WHY THE PREMISE IS STATED WITH A TITLE, AND WHY THIS PARTICULAR ONE
 * ===========================================================================
 * `hold()` seats the workflow document before the shell boots, and it takes a TITLE
 * because R1 does: ReaPrime's workflow carries the profile BODY and no record id, so
 * `r1LoadedProfileId` matches the served title against the listing. In this corpus 14
 * titles are shared — 35 records called "Temp Test", 11 called "Extractamundo Dos!", 10
 * called "Power" — and R1 answers `ambiguous` for every one of them rather than picking
 * one, which is correct and leaves `loaded.id` NULL. That is not a fixture quirk: it is
 * the exact condition that killed the guard on Ben's bench, reproduced in a corpus. A test
 * seated on one of those titles would have no held record for the app to name, so "the
 * machine was holding X" would be unobservable and both tests would pass for a reason that
 * has nothing to do with the code. The fixture refuses a duplicate title for that reason,
 * and the first assertion of each test below is that the premise actually took.
 *
 * "Extractamundo Dos! (2)" is the held record because it is what the CAPTURE was holding —
 * the recorded `api__v1__workflow.json` names it — and because its title is one of the
 * unique ones. "Soup 58" is the unrelated profile for the same reason: unique title,
 * visible, and a first step with a temperature to move.
 *
 * AT ONE GEOMETRY, like blocks 2 and 3. Nothing in this decision reads a box; the press
 * machinery it rides on is already proved at every Gate A geometry by block 1.
 * ===================================================================== */
describe('every save arms the machine with what was saved', () => {

    /** The record the capture had armed. Unique title, so R1 resolves it by title match. */
    const HELD = 'Extractamundo Dos! (2)';
    /** Something else entirely. Unique title, visible, first step carries a temperature. */
    const OTHER = 'Soup 58';

    /**
     * Boot the shell with the machine holding `title`.
     *
     * THE ORDER IS LOAD-BEARING: `hold()` writes the document the server will serve, and
     * `mount()` is what reads it. Seating after the boot would leave the app's `loaded`
     * derived from the recording and the assertions arguing with a premise that never
     * reached the app.
     */
    const bootHolding = async (page, title) => {
        await page.mount(STAGE, FIXTURE);
        const heldId = await L(page, `hold(${JSON.stringify(title)})`);
        assert.ok(heldId, `the corpus can seat "${title}" — a duplicate title answers null, `
            + 'and a test on one would have no held record to compare against');
        assert.equal(await L(page, 'mount()'), 'ready', 'the shell must boot');
        assert.equal(await L(page, "goto('selector')"), 'selector-screen');
        assert.equal(await L(page, 'librarySettled()'), true);

        const held = await L(page, 'held()');
        assert.equal(held.id, heldId,
            `the app resolved the held profile (source: ${held.source}, reason: ${held.reason}) `
            + '— every assertion below is about what happens to THIS record');
        assert.equal(held.known, true, 'and it is a known answer, not a blank one');
        return heldId;
    };

    /* =================================================================
     * BEN'S WALK, END TO END, AND IT IS THE STRONGEST CLAIM IN THIS FILE.
     * The hardware run this reproduces:
     *
     *     machine holds         85.0
     *     Edit profile          opens 85.0
     *     press +               85.0 -> 85.5,  band reads "Save (1)"
     *     Save                  written, AND the editor closes on that one press
     *     machine holds         85.5      <- follows the save
     *     Edit profile          opens 85.5 <- the bug, gone
     *
     * The numbers here are this corpus's rather than the tablet's (83.5 -> 84.0 on the
     * same half-degree step), and every other line is the same line.
     *
     * THERE IS NO "leave" STEP ANY MORE, and its absence is an assertion rather than a
     * tidy-up. This walk read `Save`, then `Cancel`, then `Edit` until the evening of
     * 27 August 2026; Ben's version of that middle step was a second press of SAVE, and
     * the pair is what made a save that worked look like a save that did nothing.
     * "pressing save should close and arm, I shouldn't need to press save twice."
     * ================================================================= */
    test('one press: the save is written, the editor closes, and the machine holds what was saved',
        () => browser.withPage({ geometry: GATE_A_GEOMETRIES[0] }, async (page) => {
            const heldId = await bootHolding(page, HELD);

            /* OPEN THE HELD PROFILE, through the selector's own row and its own Edit. */
            assert.equal(await L(page, `clickRowTitled(${JSON.stringify(HELD)})`), heldId,
                'the row that was pressed is the record the machine is holding');
            assert.equal(await L(page, 'pressEdit()'), 'editor-screen');

            const before = await L(page, 'editor()');
            assert.equal(before.recordId, heldId, 'the editor opened the held record');
            assert.equal(before.saveLabel, 'Save', 'nothing is unsaved yet');
            const wasTemperature = before.temperatures[0];
            assert.ok(Number.isFinite(wasTemperature), 'step 1 has a temperature to move');

            /* THE EDIT, through the cell's own +. */
            assert.equal(await L(page, 'bumpTemperature(0)'), true, 'the + was pressed');
            const edited = await L(page, 'editor()');
            assert.ok(edited.temperatures[0] > wasTemperature,
                `the cell moved (${wasTemperature} -> ${edited.temperatures[0]})`);
            assert.equal(edited.saveLabel, 'Save (1)', 'D11: one change, counted');
            const wanted = edited.temperatures[0];

            /* THE SAVE — one press, and the only press between the edit and the re-open. */
            assert.equal(await L(page, 'pressSave()'), true);

            /* IT CLOSED. Ben's first ruling, on the walk his second ruling is about. */
            assert.equal(await L(page, "settledScreen('selector-screen')"), 'selector-screen',
                'the one press left the editor as well as writing — no Cancel, no second Save');

            const created = await L(page, 'created()');
            assert.equal(created.length, 1, 'one press, one record');
            assert.equal(created[0].parentId, heldId,
                'B11/DQ-629: the save is a CHILD of the held record — a chain off what the '
                + 'machine was holding, which is what Ben\'s tablet was failing to produce');
            assert.equal(created[0].temperatures[0], wanted, 'the edit reached the server');

            /* THE HALF THAT WAS MISSING — AND IT IS ASSERTED AGAINST THE SERVER, NOT
             * AGAINST THE APP'S OPINION OF ITSELF. `armCalls()` is what the fixture's
             * `POST /api/v1/machine/profile` actually received, so this cannot be
             * satisfied by a store that merely believes it armed something. */
            assert.deepEqual(await L(page, 'armCalls()'),
                [{ title: created[0].title, temperatures: created[0].temperatures }],
                'the machine was handed the SAVED record\'s content, exactly once — '
                + 'Ben\'s ruling: after you save an edit to the armed profile, the machine '
                + 'should be armed with the new version');

            /* ARMING IS HALF OF LOADING. `library.arm()` writes the workflow document
             * after a 200, and without that write `GET /workflow` would go on naming the
             * previous profile — the old title on the Live header and in every shot
             * ReaPrime records from then on. The arm route is the same one the selector
             * calls; this proves it took the SAME second step here. */
            assert.deepEqual(await L(page, 'workflowWrites()'),
                [{ title: created[0].title, temperatures: created[0].temperatures }],
                'and the document was written to match, which is the other half of loading');

            const held = await L(page, 'held()');
            assert.equal(held.id, created[0].id,
                `the app's loaded profile followed the save (source: ${held.source}) — this `
                + 'is the value <app-root> resolves the Live band\'s "Edit profile" through');
            assert.deepEqual((await L(page, 'machineHolds()')).temperatures,
                created[0].temperatures,
                'and the served document itself carries the edit, which is what a reboot '
                + 'would read back');

            /* AND THE WHOLE POINT, READ OFF THE SCREEN — Ben's last two lines. There is no
             * `pressCancel()` in front of this any more: the save already left, so Edit is
             * pressed from the selector the save put him back on. */
            assert.equal(await L(page, 'pressEdit()'), 'editor-screen');
            const reopened = await L(page, 'editor()');
            assert.equal(reopened.recordId, created[0].id);
            assert.equal(reopened.temperatures[0], wanted,
                `re-opening must show the saved value (${wanted}), not the one it was `
                + `saved over (${wasTemperature})`);

            /* EXACTLY ONE OF EACH WRITE. An arm that re-entered its own re-read — the
             * arm calls `api.load()`, which republishes the library — would show up here
             * as a second POST before it showed up as anything a person could see. */
            const calls = await L(page, 'calls()');
            assert.equal(calls.filter((c) => c.method === 'POST' && c.path === '/api/v1/profiles').length,
                1, 'one Save, one POST /profiles');
            assert.equal(calls.filter((c) => c.method === 'POST' && c.path === '/api/v1/machine/profile').length,
                1, 'one Save, one arm — not a loop');

            assert.deepEqual(page.pageErrors, [], 'and the trip threw nothing');
        }));

    /* =================================================================
     * THE RULE'S OTHER EDGE, AND THE PRICE OF IT.
     *
     * THIS TEST USED TO CLAIM THE OPPOSITE, and it was mutation-checked
     * and green when it did. It read "editing anything else leaves the
     * machine alone" and asserted, off the wire, that `armCalls()` and
     * `workflowWrites()` were both empty and that the served workflow
     * document was byte-for-byte where it started. That was the guard in
     * `adoptSavedProfile`, and the guard is gone — Ben, 27 August 2026:
     * "pressing save should close and arm, I shouldn't need to press save
     * twice", and, decisively, the guard could not fire on his bench at
     * all, because five records share the title "Pressure Tuning" and R1
     * answers `ambiguous` rather than guessing. The block header above has
     * the whole argument.
     *
     * SO THE CLAIM IS INVERTED, NOT DELETED, and it is deliberately still
     * the harder-to-swallow of the two: save an edit to a profile the
     * machine was NOT holding, and the machine is holding it afterwards.
     * That is a real consequence of a rule stated in four plain words, and
     * a rule with a cost should have the cost written down where the next
     * person meets it — not left implied by the absence of a test. If the
     * trade is ever revisited, THIS is the test to argue with.
     *
     * EVERY ASSERTION IS OFF THE WIRE, exactly as the guard's version was.
     * `armCalls()` and `workflowWrites()` are what the fixture's server
     * received, so a store that merely believes it armed something cannot
     * satisfy them — the same reader that made the negative honest is what
     * makes the positive honest.
     * ================================================================= */
    test('editing anything else arms it too — every save arms, and this is what that costs',
        () => browser.withPage({ geometry: GATE_A_GEOMETRIES[0] }, async (page) => {
            const heldId = await bootHolding(page, HELD);
            /* THE MACHINE'S OWN STATE, READ FROM THE SERVER BEFORE ANYTHING HAPPENS. The
             * assertion at the end is that this object MOVED, rather than that it equals
             * some number written into this file — a test that hardcodes the held
             * temperature stops meaning anything the day the corpus is recaptured. It was
             * read for the same reason when the claim was the opposite one. */
            const machineBefore = await L(page, 'machineHolds()');

            /* OPEN SOMETHING ELSE. Not the held record — that is the entire premise. */
            const otherId = await L(page, `clickRowTitled(${JSON.stringify(OTHER)})`);
            assert.ok(otherId, `the row for "${OTHER}" was found and pressed`);
            assert.notEqual(otherId, heldId,
                'and it is NOT the record the machine is holding');
            assert.equal(await L(page, 'pressEdit()'), 'editor-screen');
            assert.equal((await L(page, 'editor()')).recordId, otherId,
                'the editor opened the unrelated profile');

            /* THE SAME EDIT AND THE SAME SAVE AS THE TEST ABOVE. Only the record differs,
             * so any difference in what follows is a difference the relationship to the
             * held record made — and after the ruling, there is no difference at all. */
            assert.equal(await L(page, 'bumpTemperature(0)'), true, 'the + was pressed');
            assert.equal((await L(page, 'editor()')).saveLabel, 'Save (1)',
                'the edit counted, so this is a real save and not a no-op press');
            assert.equal(await L(page, 'pressSave()'), true);
            assert.equal(await L(page, "settledScreen('selector-screen')"), 'selector-screen',
                'and it closed on the one press, the same as any other save');

            const created = await L(page, 'created()');
            assert.equal(created.length, 1, 'the save really happened');
            assert.equal(created[0].parentId, otherId,
                'as a child of the profile that was edited, not of the held one');

            /* THE ASSERTION THE WHOLE BLOCK IS FOR, POINTING THE OTHER WAY. */
            assert.deepEqual(await L(page, 'armCalls()'),
                [{ title: created[0].title, temperatures: created[0].temperatures }],
                'the machine was armed with the SAVED record, once — the rule is "every '
                + 'save arms", not "every save that happens to be the armed one"');
            assert.deepEqual(await L(page, 'workflowWrites()'),
                [{ title: created[0].title, temperatures: created[0].temperatures }],
                'and the document was written to match, which is the other half of loading');

            /* ONE OF EACH, READ OFF THE WIRE. A follow-through that re-entered its own
             * re-read would show as a second arm here before it showed anywhere else. */
            const calls = await L(page, 'calls()');
            assert.equal(calls.filter((c) => c.method === 'POST'
                && c.path === '/api/v1/machine/profile').length, 1,
            'one save, one arm — not a loop');
            assert.equal(calls.filter((c) => c.method === 'PUT'
                && c.path === '/api/v1/workflow').length, 1,
            'and one document write');

            /* AND BOTH ANSWERS TO "WHAT IS THE MACHINE HOLDING" HAVE MOVED, TOGETHER.
             * They are read separately on purpose: `held()` is the app's belief, off
             * `library.get().loaded`, and `machineHolds()` is the server's own document
             * with no store in between. An app that believed one thing while the machine
             * held another is the failure this fixture grew three readers to catch. */
            const held = await L(page, 'held()');
            assert.equal(held.id, created[0].id,
                `the app now names the saved record (source: ${held.source})`);
            assert.notEqual(held.id, heldId,
                'which is NOT the record it was holding when the walk started — this is '
                + `the cost, stated: "${HELD}" was armed, "${OTHER}" was edited, and the `
                + 'machine will now brew the edit');
            const machineAfter = await L(page, 'machineHolds()');
            assert.notDeepEqual(machineAfter, machineBefore,
                'the served document moved — read from the server, which is what a reboot '
                + 'would read back');
            assert.deepEqual(machineAfter.temperatures, created[0].temperatures,
                'and it moved to exactly the content that was saved');

            /* THE OTHER HALF, WHICH NEVER CHANGED. The selection follows the save too, and
             * asserting it here as well as in block 1 is what stops this test passing for
             * a build in which `adoptSavedProfile` does the arm and nothing else. */
            assert.equal((await L(page, 'library()')).selectedId, created[0].id,
                'the selector followed the save as well — the follow-through is whole');

            assert.deepEqual(page.pageErrors, [], 'and the trip threw nothing');
        }));
});

/* =====================================================================
 * 2 and 3. THE DECISION POINT ITSELF, at one geometry — neither block is
 *    about a box, and both mount the screen alone with a store the test
 *    controls, which is the seam `<editor-screen>` declares (the store is
 *    the SHELL'S, handed over on `boot`).
 * ===================================================================== */
describe('a Save that cannot tell writes the draft rather than dropping it', () => {

    /**
     * Seat the screen on a store whose dirty-state answer is the real
     * `changeCountOf(draft, null)` — count 0, clean true, tell 'cannot-tell'. That is the
     * answer the module has always returned for a baseline it cannot read, and taking
     * `.count` off it is what used to turn the press into a silent exit.
     */
    const seatUntellable = (page) => page.evalFn(async () => {
        const commit = await import('/src/lib/editor-commit.js');
        const adapters = await import('/src/data/adapters-r.js');
        const record = { id: 'profile:open', profile: window.__profile };
        const listeners = new Set();
        const state = { load: 'ready', record, baseline: null, save: 'idle', report: null,
            refusal: null, error: null, version: null, lineage: { known: false }, at: 0 };
        window.__saves = [];
        const store = {
            get: () => state,
            subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); },
            /* THE REAL FUNCTION, ASKED THE REAL QUESTION. Nothing here fakes the shape of
             * the answer — the baseline is genuinely unreadable and the module says so. */
            changeCount: (draft) => commit.changeCountOf(draft, state.baseline),
            headerCommit: (draft) => commit.headerCommitFor(commit.changeCountOf(draft, state.baseline)),
            saveAsNewVersion(profile) { window.__saves.push({ operation: 'saveAsNewVersion', profile }); },
            saveMetadata(metadata) { window.__saves.push({ operation: 'saveMetadata', metadata }); },
            saveInPlace(profile) { window.__saves.push({ operation: 'saveInPlace', profile }); },
            lineage: () => state.lineage,
            version: () => null,
            report: () => null,
            clearSave() {},
            close() {},
            stop() {},
        };
        const screen = window.__h.need('editor-screen');
        /* THE COUNTER IS RE-ENTRANT-SAFE, and it has to be now that it counts UP TO ONE
         * rather than staying at zero. `page.eval` retries a call once when CDP collects
         * the promise under load (the harness says so on stderr when it does), and a
         * second run of this seat would add a SECOND listener over the same screen — so
         * one navigation would score two and the test would fail on a number that has
         * nothing to do with the code. Removing the previous handler first makes the seat
         * idempotent; measured, as a spurious `2 !== 1` on a loaded box. */
        window.__left = 0;
        if (window.__onLeave) screen.removeEventListener('navigate', window.__onLeave);
        window.__onLeave = () => { window.__left += 1; };
        screen.addEventListener('navigate', window.__onLeave);
        screen.boot = {
            profileEditor: store,
            capabilities: { machineLimits: () => adapters.r2MachineLimits([{ id: 'machine' }]) },
            logger: null,
        };
        for (const fn of listeners) fn(state);
        await screen.updateComplete;
    });

    /* =================================================================
     * THE CLAIM THAT SURVIVED THE RULING, AND THE HALF OF IT THAT DID NOT.
     *
     * This test was called "the press writes INSTEAD OF leaving", and its
     * last assertion was `window.__left === 0` — the editor must not go
     * away over an unsaved draft. That was the right pair of claims while
     * `close` and `operation` were alternatives: an unanswerable dirty
     * state used to land on `close: true, operation: null`, which shut the
     * screen with no write, no toast and no question, and the fix was to
     * turn it into a write.
     *
     * Ben, 27 August 2026: "pressing save should close and arm, I
     * shouldn't need to press save twice." A save now writes AND leaves,
     * and `commitPlan`'s cannot-tell branch went with the rest — it
     * returns `saveAsNewVersion` with `close: true`. So "instead of
     * leaving" is not a claim anyone can make here now.
     *
     * WHAT IT WAS ALWAYS ABOUT IS UNTOUCHED, and it is what the test
     * asserts: the draft is WRITTEN. The defect was never the navigation,
     * it was the SILENCE — a control that shut over work that existed
     * nowhere else. DQ-629 keeps the previous version, so a spare write is
     * recoverable; a dropped draft is not. The leave is asserted as ZERO
     * here, because a save that never lands must not close: see the
     * paragraph at that assertion for what closing on the press cost.
     * ================================================================= */
    test('an unknown dirty state is written, not dropped, on the way out',
        () => browser.withPage({ geometry: GATE_A_GEOMETRIES[0] }, async (page) => {
            await mountEditor(page, { matrix: null, fields: 0 });
            await page.evalFn((profile) => { window.__profile = profile; }, editingProfile());
            await seatUntellable(page);
            await page.settle(6);

            /* THE LABEL IS STILL THE CLEAN ONE, and that is deliberate: B10's rule about a
             * label survives untouched — nobody can say what N is, so no N is shown. */
            const label = await page.evalFn(
                (s) => (window.__h.q(s)?.textContent ?? '').trim(), EDITOR.save,
            );
            assert.equal(label, 'Save', 'the BAND still rounds an unknown down to clean');

            await page.click(EDITOR.save);
            await page.settle(6);

            const saves = await page.evalFn(() => window.__saves.map((s) => ({
                operation: s.operation, title: s.profile?.title ?? null,
                steps: Array.isArray(s.profile?.steps) ? s.profile.steps.length : null,
            })));
            assert.deepEqual(saves, [{ operation: 'saveAsNewVersion', title: 'Morning ristretto', steps: 2 }],
                'an unknown dirty state SAVES — DQ-629 keeps the previous version, so the '
                + 'spare write is recoverable and a silent close is not');

            /* AND THE EDITOR IS STILL HERE, WHICH IS THE POINT OF THIS TEST.
             *
             * The close is not the press's to make — it waits for the store's SAVED, and
             * this seat never reaches it (the fixture answers no record). An earlier pass
             * closed in `#commit` as soon as the write was in flight, and that took the
             * failure path down with it: `<app-root>` unmounts this screen, the unmount
             * runs `#unwatch`, and the outcome then arrives at nothing — the toast was not
             * off-screen, it was never created. A refused save became SILENT and the draft
             * died with the screen, which is a worse defect than the one Ben's ruling was
             * fixing: work that exists nowhere else, gone, with nothing said.
             *
             * So the rule is: SAVED closes; FAILED and REFUSED stay, with the draft intact
             * and the server's own sentence on screen. This assertion is the second half —
             * the write above happened, and nothing closed over it. */
            assert.equal(await page.evalFn(() => window.__left), 0,
                'a save that did not land must NOT close — the draft exists nowhere else, '
                + 'and Ben\'s "Save should close" (27 August 2026) is about a save that '
                + 'succeeded, not about one that was refused');
        }));

    /**
     * A COMMIT THAT NEVER BECAME A REQUEST, AND THE STATE THAT REACHES IT.
     *
     * `#record` and `_draft` normally move together, but they are set from two different
     * expressions and one of them can be null while the other is not: a record with no
     * `profile` key seats fine (`#record` is the record) and leaves the draft null
     * (`#onStoreState`: the draft is `record.profile`, which is not there). With a caller
     * supplying `change-count`, the band then draws a FILLED "Save (3)" over an editor
     * that has nothing to send — and the press used to be a bare `return`: no request, no
     * navigation, no word. The control looked live and was not.
     */
    const seatBodyless = (page) => page.evalFn(async () => {
        const adapters = await import('/src/data/adapters-r.js');
        const listeners = new Set();
        /* A RECORD WITH NO PROFILE. `_handleGetById` answers the whole ProfileRecord and
         * every field on it is optional to a client; this is what an answer missing the
         * one field the editor needs looks like on the way in. */
        const state = { load: 'ready', record: { id: 'profile:bodyless' }, baseline: null,
            save: 'idle', report: null, refusal: null, error: null, version: null,
            lineage: { known: false }, at: 0 };
        window.__saves = [];
        const store = {
            get: () => state,
            subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); },
            changeCount: () => ({ count: 0, clean: true, tell: 'cannot-tell', fields: [] }),
            headerCommit: () => ({ commit: false, changeCount: 0 }),
            saveAsNewVersion(profile) { window.__saves.push({ operation: 'saveAsNewVersion', profile }); },
            saveMetadata() { window.__saves.push({ operation: 'saveMetadata' }); },
            saveInPlace() { window.__saves.push({ operation: 'saveInPlace' }); },
            lineage: () => state.lineage,
            version: () => null,
            report: () => null,
            clearSave() {}, close() {}, stop() {},
        };
        const screen = window.__h.need('editor-screen');
        /* Same re-entrant-safe counter as `seatUntellable` above, for the same reason. */
        window.__left = 0;
        if (window.__onLeave) screen.removeEventListener('navigate', window.__onLeave);
        window.__onLeave = () => { window.__left += 1; };
        screen.addEventListener('navigate', window.__onLeave);
        /* THE CALLER'S OWN COUNT — the property fallback `#count` uses when there is no
         * draft to measure. Three unsaved changes, according to whoever mounted this. */
        screen.changeCount = 3;
        screen.boot = {
            profileEditor: store,
            capabilities: { machineLimits: () => adapters.r2MachineLimits([{ id: 'machine' }]) },
            logger: null,
        };
        for (const fn of listeners) fn(state);
        await screen.updateComplete;
    });

    test('a commit that never became a request says so rather than doing nothing quietly',
        () => browser.withPage({ geometry: GATE_A_GEOMETRIES[0] }, async (page) => {
            await mountEditor(page, { matrix: null, fields: 0 });
            await seatBodyless(page);
            await page.settle(6);

            assert.equal(await page.evalFn(
                (s) => (window.__h.q(s)?.textContent ?? '').trim(), EDITOR.save,
            ), 'Save (3)', 'the band is offering a filled Save over an editor with no draft');

            await page.click(EDITOR.save);
            await page.settle(6);

            assert.deepEqual(await page.evalFn(() => window.__saves), [],
                'there was genuinely nothing to send, so nothing was sent');
            assert.equal(await page.evalFn(() => window.__left), 0,
                'and it did not silently navigate away either');

            /* B10: save, then report what happened — and "nothing happened" is something
             * that happened. This is the ending the branch did not have. */
            const notices = await page.evalFn((sel) => [...window.__h.need(sel).children]
                .map((n) => ({ tone: n.getAttribute('tone'), text: n.textContent.trim() })), EDITOR.notice);
            assert.deepEqual(notices,
                [{ tone: 'warn', text: 'Nothing was saved — no profile is open.' }]);
        }));
});
