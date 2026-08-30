/**
 * The two courtesy re-emits are gone.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    EDITOR, mountEditor, seatProfile, editingProfile, editorCalls,
} from '../harness/editor.js';

const geometry = GATE_A_GEOMETRIES[0];

const DISCARD = 'editor-screen >>> #discard-dialog';

/** Listen at the document for every name a root above the screen would have heard. */
async function watchWires(page) {
    await page.evalFn(() => {
        window.__wires = [];
        for (const name of ['editor-commit', 'editor-cancel', 'navigate']) {
            document.addEventListener(name, (event) => window.__wires.push({
                name, detail: event.detail ? JSON.parse(JSON.stringify(event.detail)) : null,
            }));
        }
        return true;
    });
}

const wiresNamed = (page, name) => page.evalFn(
    (n) => window.__wires.filter((w) => w.name === n), name,
);

/** Dirty the draft the way the matrix does — a composed `step-change` at the host. */
async function editSomething(page) {
    await page.evalFn((sel) => {
        window.__h.need(sel).dispatchEvent(new CustomEvent('step-change', {
            detail: { index: 0, row: 'temperature', field: 'temperature', value: 88 },
            bubbles: true,
            composed: true,
        }));
        return true;
    }, EDITOR.screen);
    await page.settle(4);
}

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('the retired editor seam (F-003, F-004)', () => {
    const staged = (fn) => browser.withPage({ geometry }, async (page) => {
        await mountEditor(page, { matrix: null, fields: 0 });
        await seatProfile(page, { profile: editingProfile() });
        await watchWires(page);
        return fn(page);
    });

    test('Save sends no `editor-commit` — AND still saves', () => staged(async (page) => {
        await editSomething(page);
        await page.click(EDITOR.save);
        await page.settle(8);

        assert.deepEqual(await wiresNamed(page, 'editor-commit'), [],
            'the announcement is retired');
        const calls = await editorCalls(page);
        assert.deepEqual(calls.map((c) => `${c.method} ${c.path}`), [
            'POST /profiles',
            'PUT /profiles/profile%3Aseated/visibility',
        ], 'and the action half is not retired — the create, then the supersede');
        assert.equal(calls[0].body?.profile?.steps?.[0]?.temperature, 88,
            'carrying the edit that was made');
        assert.deepEqual(page.pageErrors, []);
    }));

    test('Cancel sends no `editor-cancel` — AND still guards the unsaved work',
        () => staged(async (page) => {
            await editSomething(page);
            await page.click(EDITOR.cancel);
            await page.settle(6);

            assert.deepEqual(await wiresNamed(page, 'editor-cancel'), [],
                'the announcement is retired');
            assert.equal(await page.evalFn((s) => window.__h.need(s).open === true, DISCARD),
                true, 'and the guard still opens — a dirty screen you cannot leave is a trap');
            assert.deepEqual(await wiresNamed(page, 'navigate'), [],
                'the guard has not been answered yet, so nothing has left');
            assert.deepEqual(await editorCalls(page), [],
                'a cancel writes nothing, before or after this change');
        }));

    test('answering the guard still leaves', () => staged(async (page) => {
        await editSomething(page);
        await page.click(EDITOR.cancel);
        await page.settle(6);
        await page.click('editor-screen >>> #discard-confirm');
        await page.settle(6);

        const left = await wiresNamed(page, 'navigate');
        assert.equal(left.length, 1, 'the shell is asked to go back');
        assert.equal(left[0].detail?.back, true);
        assert.deepEqual(await wiresNamed(page, 'editor-cancel'), []);
    }));

    test('keeping editing still cancels the leave', () => staged(async (page) => {
        await editSomething(page);
        await page.click(EDITOR.cancel);
        await page.settle(6);
        await page.click('editor-screen >>> #discard-cancel');
        await page.settle(6);

        assert.equal(await page.evalFn((s) => window.__h.need(s).open === true, DISCARD), false);
        assert.deepEqual(await wiresNamed(page, 'navigate'), [],
            'answering "Keep editing" must not walk out anyway');
    }));
});
