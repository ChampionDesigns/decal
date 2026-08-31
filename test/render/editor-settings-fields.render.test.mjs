/**
 * The.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    EDITOR, mountEditor, seatProfile, editingProfile, editorCalls, selectPanel, matrixStep,
} from '../harness/editor.js';

const geometry = GATE_A_GEOMETRIES[0];

const field = (id) => `editor-screen >>> #field-${id}`;

/** The draft the screen holds and what the store makes of it — the fact behind the face. */
const report = (page) => page.evalFn((sel) => {
    const screen = window.__h.need(sel);
    const draft = screen._draft;
    const change = window.__editorStore.changeCount(draft);
    return {
        title: draft?.title ?? null,
        author: draft?.author ?? null,
        beverage: draft?.beverage_type ?? null,
        notes: draft?.notes ?? null,
        tank: draft?.tank_temperature ?? null,
        countFrom: draft?.target_volume_count_start ?? null,
        count: change.count,
        fields: change.fields,
    };
}, EDITOR.screen);

/** Type into one composed text field and leave it, the way a person does. */
async function typeInto(page, id, value) {
    await page.evalFn((sel, v) => {
        const host = window.__h.need(sel);
        /* input or textarea: a multiline field renders a textarea. */
        const input = host.renderRoot.querySelector('input, textarea');
        input.value = v;
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return host.value;
    }, field(id), value);
    await page.settle(4);
}

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('the editor Settings tab composes bound fields (F-031)', () => {
    const staged = (fn, profile = null) => browser.withPage({ geometry }, async (page) => {
        /* `fields: 0` mounts NO `slot="settings"` children, which is what `app-root` does
         * — so this stage is the shipped composition and not a fixture's. */
        await mountEditor(page, { matrix: null, fields: 0 });
        await seatProfile(page, { profile: profile ?? editingProfile() });
        await selectPanel(page, 'settings');
        return fn(page);
    });

    test('the six fields are on the glass', () => staged(async (page) => {
        for (const id of ['title', 'author', 'beverage_type', 'notes',
            'tank-temperature', 'count-from']) {
            assert.equal(await page.exists(field(id)), true, `#field-${id} must compose`);
        }
        assert.deepEqual(page.pageErrors, []);
    }));

    test('each field reads the profile it was opened on', () => staged(async (page) => {
        const read = (id) => page.evalFn((s) => window.__h.need(s).value, field(id));
        assert.equal(await read('title'), 'Morning ristretto');
        assert.equal(await read('author'), 'bench');
        assert.equal(await read('beverage_type'), 'espresso');
    }));

    test('typing in Author moves the draft AND counts as a change', () => staged(async (page) => {
        assert.equal((await report(page)).count, 0, 'an untouched draft is clean');

        await typeInto(page, 'author', 'A. Author');

        const after = await report(page);
        assert.equal(after.author, 'A. Author', 'the draft took it');
        assert.equal(after.count, 1, 'and it is counted');
        assert.deepEqual(after.fields, ['author'], 'as the field it is');
    }));

    test('the other three text fields write their own keys and nobody else\'s',
        () => staged(async (page) => {
            await typeInto(page, 'title', 'Gentle and sweet');
            await typeInto(page, 'beverage_type', 'filter');
            await typeInto(page, 'notes', 'dial in at 18 g');

            const after = await report(page);
            assert.equal(after.title, 'Gentle and sweet');
            assert.equal(after.beverage, 'filter');
            assert.equal(after.notes, 'dial in at 18 g');
            assert.equal(after.author, 'bench', 'untouched fields stay put');
            assert.equal(after.count, 3);
        }));

    test('the tank temperature is stored as a NUMBER, and rubbish writes nothing',
        () => staged(async (page) => {
            const before = (await report(page)).tank;

            /* A press on the cap, which is what a person touches. */
            await page.evalFn((sel) => {
                const host = window.__h.need(sel);
                host.renderRoot.querySelector('#increment').click();
            }, field('tank-temperature'));
            await page.settle(2);

            const after = (await report(page)).tank;
            assert.equal(typeof after, 'number', 'the draft holds a number, never a string');
            assert.ok(after > before, `the press moved it: ${before} -> ${after}`);

            /* A stepper cannot be typed into, so a non-number can only arrive at the wire. */
            await page.evalFn((sel) => {
                window.__h.need(sel).dispatchEvent(new CustomEvent('change', {
                    detail: { value: 'warm-ish' }, bubbles: true, composed: true,
                }));
            }, field('tank-temperature'));
            await page.settle(2);
            assert.equal((await report(page)).tank, after, 'an unparseable value writes nothing');
        }));

    test('Start measuring the drink at lists the draft\'s OWN steps, and writes the frame index',
        () => staged(async (page) => {
            const options = await page.evalFn(
                (s) => window.__h.need(s).options.map((o) => o.value), field('count-from'),
            );
            assert.deepEqual(options, ['0', '1'],
                'one entry per step and nothing else — the bound IS the step list');

            await page.evalFn((s) => {
                const host = window.__h.need(s);
                host.value = '1';
                host.dispatchEvent(new CustomEvent('change', {
                    detail: { value: '1' }, bubbles: true, composed: true,
                }));
                return true;
            }, field('count-from'));
            await page.settle(4);

            const after = await report(page);
            assert.equal(after.countFrom, 1,
                'the second step, zero-based — the frame the machine starts counting at');
            assert.deepEqual(after.fields, ['target_volume_count_start']);
        }));

    test('the FIRST save carries every field that was typed', () => staged(async (page) => {
        await typeInto(page, 'author', 'A. Author');
        await typeInto(page, 'notes', 'dial in at 18 g');
        await page.evalFn((sel) => {
            window.__h.need(sel).renderRoot.querySelector('#increment').click();
        }, field('tank-temperature'));
        await page.settle(2);
        const tank = (await report(page)).tank;

        await page.click(EDITOR.save);
        await page.settle(8);

        const calls = await editorCalls(page);
        const body = calls[0]?.body?.profile ?? {};
        assert.equal(calls[0]?.method, 'POST');
        assert.equal(body.author, 'A. Author');
        assert.equal(body.notes, 'dial in at 18 g');
        assert.equal(typeof tank, 'number', 'the press wrote a number to the draft');
        assert.equal(body.tank_temperature, tank, 'and the save carried that same number');
    }));

    test('a caller that mounts its OWN rows still gets exactly those',
        () => browser.withPage({ geometry }, async (page) => {
            await mountEditor(page, { matrix: null, fields: 3 });
            await seatProfile(page, { profile: editingProfile() });
            await selectPanel(page, 'settings');

            assert.equal(await page.exists(field('author')), false,
                'the fallback renders only when the slot has nothing assigned — the '
                + 'harness, the capture fixture and several suites mount their own rows');
            assert.equal(await page.count('editor-screen [slot="settings"]'), 3,
                'and the caller\'s three are what is there');
        }));
});
