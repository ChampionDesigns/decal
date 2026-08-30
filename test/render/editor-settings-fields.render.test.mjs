/**
 * editor-settings-fields.render.test.mjs — THE SETTINGS TAB HAS REAL FIELDS (audit F-031).
 *
 * SIX INTENTS, ONE FAULT. `editor-screen` rendered the settings panel with a bare
 * `<slot name="settings">` and NO fallback content, and `app-root` mounts `<editor-screen>`
 * with no light-DOM children — so in the shipped app the slot had zero assigned elements
 * and there was nothing on the glass to press. The rows visible on the screens page came
 * from a capture fixture's hand-built `<div slot="settings">` items carrying literals, wired
 * to nothing: typing `W3EDIT` into one left the draft and the change count unmoved with no
 * request on the wire. A profile's name, author, beverage and notes could not be edited from
 * this screen at all.
 *
 * WHAT IS ASSERTED IS THE WHOLE CHAIN, because every link of it was intact before and the
 * fault was that they were not joined: the control composes, the draft takes the value, the
 * change is COUNTED, and the next save carries it. A test that only asserted the rows exist
 * would pass against the capture fixture, which is the exact shape of the original defect.
 *
 * THE FALLBACK MUST NOT DISPLACE A CALLER'S OWN ROWS — the harness, the capture fixture and
 * several render suites mount their own — so that is asserted too.
 *
 * A8: nothing here reads a source file.
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
        const input = host.renderRoot.querySelector('input');
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

        await typeInto(page, 'author', 'Ben');

        const after = await report(page);
        assert.equal(after.author, 'Ben', 'the draft took it');
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
            await typeInto(page, 'tank-temperature', '22');
            assert.equal((await report(page)).tank, 22,
                'tank_temperature is one of the seven inputs to the content hash — a '
                + 'string where a number belongs changes what the server stores');

            await typeInto(page, 'tank-temperature', 'warm-ish');
            assert.equal((await report(page)).tank, 22, 'an unparseable entry writes nothing');
        }));

    test('Count volume from lists the draft\'s OWN steps, and writes the 1-based marker',
        () => staged(async (page) => {
            const options = await page.evalFn(
                (s) => window.__h.need(s).options.map((o) => o.value), field('count-from'),
            );
            assert.deepEqual(options, ['0', '1', '2'],
                'None, then one entry per step — the bound IS the step list');

            await page.evalFn((s) => {
                const host = window.__h.need(s);
                host.value = '2';
                host.dispatchEvent(new CustomEvent('change', {
                    detail: { value: '2' }, bubbles: true, composed: true,
                }));
                return true;
            }, field('count-from'));
            await page.settle(4);

            const after = await report(page);
            assert.equal(after.countFrom, 2, '1-based, with 0 meaning None');
            assert.deepEqual(after.fields, ['target_volume_count_start']);
        }));

    test('the FIRST save carries every field that was typed', () => staged(async (page) => {
        await typeInto(page, 'author', 'Ben');
        await typeInto(page, 'notes', 'dial in at 18 g');
        await typeInto(page, 'tank-temperature', '22');

        await page.click(EDITOR.save);
        await page.settle(8);

        const calls = await editorCalls(page);
        const body = calls[0]?.body?.profile ?? {};
        assert.equal(calls[0]?.method, 'POST');
        assert.equal(body.author, 'Ben');
        assert.equal(body.notes, 'dial in at 18 g');
        assert.equal(body.tank_temperature, 22);
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
