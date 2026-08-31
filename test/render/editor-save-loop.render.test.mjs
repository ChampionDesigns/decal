/**
 * The save, followed through.
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

                assert.equal(await L(page, 'pressSave()'), true);

                assert.equal(await L(page, "settledScreen('selector-screen')"), 'selector-screen',
                    'Save closed the editor by itself — "pressing save '
                    + 'should close and arm, I shouldn\'t need to press save twice"');

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
                    + 'assertion the reported bug fails: it stayed on the parent');

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

describe('every save arms the machine with what was saved', () => {

    /** The record the capture had armed. Unique title, so R1 resolves it by title match. */
    const HELD = 'Extractamundo Dos! (2)';
    /** Something else entirely. Unique title, visible, first step carries a temperature. */
    const OTHER = 'Soup 58';

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

            assert.equal(await L(page, "settledScreen('selector-screen')"), 'selector-screen',
                'the one press left the editor as well as writing — no Cancel, no second Save');

            const created = await L(page, 'created()');
            assert.equal(created.length, 1, 'one press, one record');
            assert.equal(created[0].parentId, heldId,
                'B11/DQ-629: the save is a CHILD of the held record — a chain off what the '
                + 'machine was holding, which is what the tablet was failing to produce');
            assert.equal(created[0].temperatures[0], wanted, 'the edit reached the server');

            assert.deepEqual(await L(page, 'armCalls()'),
                [{ title: created[0].title, temperatures: created[0].temperatures }],
                'the machine was handed the SAVED record\'s content, exactly once — '
                + 'the ruling: after you save an edit to the armed profile, the machine '
                + 'should be armed with the new version');

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

            assert.equal(await L(page, 'pressEdit()'), 'editor-screen');
            const reopened = await L(page, 'editor()');
            assert.equal(reopened.recordId, created[0].id);
            assert.equal(reopened.temperatures[0], wanted,
                `re-opening must show the saved value (${wanted}), not the one it was `
                + `saved over (${wasTemperature})`);

            const calls = await L(page, 'calls()');
            assert.equal(calls.filter((c) => c.method === 'POST' && c.path === '/api/v1/profiles').length,
                1, 'one Save, one POST /profiles');
            assert.equal(calls.filter((c) => c.method === 'POST' && c.path === '/api/v1/machine/profile').length,
                1, 'one Save, one arm — not a loop');

            assert.deepEqual(page.pageErrors, [], 'and the trip threw nothing');
        }));

    test('editing anything else arms it too — every save arms, and this is what that costs',
        () => browser.withPage({ geometry: GATE_A_GEOMETRIES[0] }, async (page) => {
            const heldId = await bootHolding(page, HELD);
            const machineBefore = await L(page, 'machineHolds()');

            /* OPEN SOMETHING ELSE. Not the held record — that is the entire premise. */
            const otherId = await L(page, `clickRowTitled(${JSON.stringify(OTHER)})`);
            assert.ok(otherId, `the row for "${OTHER}" was found and pressed`);
            assert.notEqual(otherId, heldId,
                'and it is NOT the record the machine is holding');
            assert.equal(await L(page, 'pressEdit()'), 'editor-screen');
            assert.equal((await L(page, 'editor()')).recordId, otherId,
                'the editor opened the unrelated profile');

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

            assert.equal((await L(page, 'library()')).selectedId, created[0].id,
                'the selector followed the save as well — the follow-through is whole');

            assert.deepEqual(page.pageErrors, [], 'and the trip threw nothing');
        }));
});

describe('a Save that cannot tell writes the draft rather than dropping it', () => {

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

    test('an unknown dirty state is written, not dropped, on the way out',
        () => browser.withPage({ geometry: GATE_A_GEOMETRIES[0] }, async (page) => {
            await mountEditor(page, { matrix: null, fields: 0 });
            await page.evalFn((profile) => { window.__profile = profile; }, editingProfile());
            await seatUntellable(page);
            await page.settle(6);

            /* THE LABEL IS STILL THE CLEAN ONE, and that is deliberate: the rule's rule about a
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

            assert.equal(await page.evalFn(() => window.__left), 0,
                'a save that did not land must NOT close — the draft exists nowhere else, '
                + 'and "Save should close" is about a save that '
                + 'succeeded, not about one that was refused');
        }));

    const seatBodyless = (page) => page.evalFn(async () => {
        const adapters = await import('/src/data/adapters-r.js');
        const listeners = new Set();
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

            /* : save, then report what happened — and "nothing happened" is something
             * that happened. This is the ending the branch did not have. */
            const notices = await page.evalFn((sel) => [...window.__h.need(sel).children]
                .map((n) => ({ tone: n.getAttribute('tone'), text: n.textContent.trim() })), EDITOR.notice);
            assert.deepEqual(notices,
                [{ tone: 'warn', text: 'Nothing was saved — no profile is open.' }]);
        }));
});
