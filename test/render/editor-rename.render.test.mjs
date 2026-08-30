/**
 * The rename dialog's two silent failures.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    EDITOR, mountEditor, seatProfile, editingProfile, editorCalls, editorStoreState,
} from '../harness/editor.js';

const geometry = GATE_A_GEOMETRIES[0];

const REFUSAL = 'editor-screen >>> #rename-refusal';

/** Is the rename dialog on the glass? Read off the element, not inferred. */
const renameOpen = (page) => page.evalFn(
    (sel) => window.__h.need(sel).open === true, EDITOR.renameDialog,
);

/** Type a title into the field the way a person leaves it — value set, `input` raised. */
async function typeTitle(page, text) {
    await page.evalFn((sel, value) => {
        const host = window.__h.need(sel);
        const input = host.renderRoot.querySelector('input');
        if (input) {
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        } else {
            host.value = value;
        }
        return host.value;
    }, EDITOR.renameField, text);
    await page.settle(2);
}

/** Open the rename the way the header does — the pencil beside the title. */
async function openRename(page) {
    await page.click(EDITOR.pencil);
    await page.settle(3);
    assert.equal(await renameOpen(page), true, 'the pencil must open the rename dialog');
}

/** What the refusal surface says, or null when it is not composed at all. */
const refusalText = (page) => page.evalFn(
    (sel) => (window.__h.q(sel)?.textContent ?? '').trim() || null, REFUSAL,
);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('a seated profile renamed to nothing is REFUSED, out loud (F-050)', () => {
    const staged = (fn) => browser.withPage({ geometry }, async (page) => {
        await mountEditor(page);
        await seatProfile(page, { profile: editingProfile() });
        return fn(page);
    });

    for (const [what, typed] of [['an empty title', ''], ['a whitespace-only title', '   ']]) {
        test(`${what} keeps the dialog open and renders a refusal`, () => staged(async (page) => {
            await openRename(page);
            assert.equal(await refusalText(page), null,
                'a fresh open accuses nobody of anything');

            await typeTitle(page, typed);
            const before = await editorStoreState(page);
            await page.click(EDITOR.renameSave);
            await page.settle(4);

            assert.equal(await renameOpen(page), true,
                'the dialog must NOT dismiss — a close with reason "confirm" is what made '
                + 'this look like an accepted rename');
            const said = await refusalText(page);
            assert.ok(said && said.length > 0, 'the refusal must be on the glass');

            const calls = await editorCalls(page);
            assert.deepEqual(calls, [], 'declining to send is correct and stays correct');
            const after = await editorStoreState(page);
            assert.equal(after.title, before.title, 'the title did not move');
            assert.equal(after.save, before.save, 'and no save was attempted');
            assert.deepEqual(page.pageErrors, []);
        }));
    }

    test('the refusal is announced, not merely drawn', () => staged(async (page) => {
        await openRename(page);
        await typeTitle(page, '   ');
        await page.click(EDITOR.renameSave);
        await page.settle(4);
        const role = await page.evalFn((sel) => window.__h.q(sel)?.getAttribute('role'), REFUSAL);
        assert.equal(role, 'status', 'the house refusal idiom is a role=status caption');
        const invalid = await page.evalFn(
            (sel) => window.__h.need(sel).hasAttribute('invalid'), EDITOR.renameField,
        );
        assert.equal(invalid, true, 'and the field it belongs to says so too');
    }));

    test('a REAL title still renames, and the dialog closes behind it', () => staged(async (page) => {
        await openRename(page);
        await typeTitle(page, 'Sunday ristretto');
        await page.click(EDITOR.renameSave);
        await page.settle(6);

        assert.equal(await renameOpen(page), false, 'a real body dismisses as it always did');
        assert.equal(await refusalText(page), null, 'and leaves no refusal behind it');
        const calls = await editorCalls(page);
        assert.equal(calls.length, 1, 'exactly one request');
        assert.equal(calls[0].method, 'PUT');
        assert.equal(calls[0].body?.profile?.title, 'Sunday ristretto');
    }));

    test('a refused rename, corrected, then goes through — the refusal is not sticky',
        () => staged(async (page) => {
            await openRename(page);
            await typeTitle(page, '');
            await page.click(EDITOR.renameSave);
            await page.settle(4);
            assert.ok(await refusalText(page));

            await typeTitle(page, 'Second try');
            await page.click(EDITOR.renameSave);
            await page.settle(6);

            assert.equal(await renameOpen(page), false);
            const calls = await editorCalls(page);
            assert.equal(calls.length, 1);
            assert.equal(calls[0].body?.profile?.title, 'Second try');
        }));
});

describe('a NEW profile can be named before its first save (F-041)', () => {
    const staged = (fn) => browser.withPage({ geometry }, async (page) => {
        await mountEditor(page);
        await seatProfile(page, {
            record: {
                id: null,
                profile: { ...editingProfile(), title: 'New profile' },
                metadataHash: null,
                compoundHash: null,
                parentId: null,
                visibility: 'visible',
                isDefault: false,
                createdAt: '2026-08-29T00:00:00.000Z',
                updatedAt: '2026-08-29T00:00:00.000Z',
                metadata: null,
            },
        });
        return fn(page);
    });

    /** The draft the screen holds, and what the store makes of it. */
    const draftReport = (page) => page.evalFn((sel) => {
        const screen = window.__h.need(sel);
        const draft = screen._draft;
        return {
            title: draft ? draft.title : null,
            count: window.__editorStore.changeCount(draft).count,
            fields: window.__editorStore.changeCount(draft).fields,
        };
    }, EDITOR.screen);

    /** What the header's own title button reads. */
    const headerTitle = (page) => page.evalFn(
        (sel) => (window.__h.need(sel).textContent ?? '').trim(), EDITOR.profileTitle,
    );

    test('the typed name lands on the working draft, and the header reads it',
        () => staged(async (page) => {
            assert.equal(await headerTitle(page), 'New profile',
                'this is the name every Decal-created profile used to reach the server with');

            await openRename(page);
            await typeTitle(page, 'Gentle and sweet');
            await page.click(EDITOR.renameSave);
            await page.settle(6);

            assert.equal(await renameOpen(page), false, 'the dialog closes on a real name');
            const report = await draftReport(page);
            assert.equal(report.title, 'Gentle and sweet', 'the DRAFT carries the typed name');
            assert.equal(await headerTitle(page), 'Gentle and sweet',
                'and the header re-reads it — the surface a person checks');
            assert.deepEqual(page.pageErrors, []);
        }));

    test('the change is COUNTED, so the band offers a save', () => staged(async (page) => {
        assert.equal((await draftReport(page)).count, 0, 'an untouched new draft is clean');

        await openRename(page);
        await typeTitle(page, 'Gentle and sweet');
        await page.click(EDITOR.renameSave);
        await page.settle(6);

        const report = await draftReport(page);
        assert.equal(report.count, 1, 'one change');
        assert.deepEqual(report.fields, ['title'], 'and it is the title');
    }));

    test('nothing is sent by the rename itself — there is no record to rename yet',
        () => staged(async (page) => {
            await openRename(page);
            await typeTitle(page, 'Gentle and sweet');
            await page.click(EDITOR.renameSave);
            await page.settle(6);
            assert.deepEqual(await editorCalls(page), [],
                'a profile that does not exist on the server cannot be renamed on it');
        }));

    test('the FIRST save carries the typed name', () => staged(async (page) => {
        await openRename(page);
        await typeTitle(page, 'Gentle and sweet');
        await page.click(EDITOR.renameSave);
        await page.settle(6);

        await page.click(EDITOR.save);
        await page.settle(8);

        const calls = await editorCalls(page);
        assert.equal(calls.length, 1, 'exactly one request, and it is the create');
        assert.equal(calls[0].method, 'POST');
        assert.equal(calls[0].body?.profile?.title, 'Gentle and sweet',
            'the name reaches the server on the profile\'s very first save');
    }));

    test('an empty title is still refused here, by the same rule (F-050 holds on both '
        + 'states)', () => staged(async (page) => {
        await openRename(page);
        await typeTitle(page, '  ');
        await page.click(EDITOR.renameSave);
        await page.settle(4);

        assert.equal(await renameOpen(page), true, 'the dialog stays open');
        assert.ok(await refusalText(page), 'and says why');
        assert.equal((await draftReport(page)).title, 'New profile', 'the draft is untouched');
    }));
});
