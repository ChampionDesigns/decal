import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    EDITOR, mountEditor, seatProfile, editingProfile, matrixStep, selectPanel,
} from '../harness/editor.js';

const geometry = GATE_A_GEOMETRIES[0];

const SWITCH = 'editor-screen >>> #field-de1-emulation';

const face = (page) => page.evalFn((sel) => {
    const screen = window.__h.need(sel);
    const control = screen.renderRoot.querySelector('#field-de1-emulation');
    if (!control) return null;
    const row = control.closest('ui-settings-row');
    const inside = row?.renderRoot ?? row?.shadowRoot ?? null;
    const box = control.getBoundingClientRect();
    return {
        checked: control.checked === true,
        disabled: control.disabled === true,
        ariaChecked: control.getAttribute('aria-checked'),
        label: (inside?.querySelector('#heading')?.textContent ?? '').trim(),
        caption: (inside?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        drawn: box.width > 0 && box.height > 0,
        draft: screen._draft?.de1_emulation ?? null,
        count: window.__editorStore.changeCount(screen._draft).count,
    };
}, EDITOR.screen);

const AVAILABLE = 'Makes this profile behave like a 240 V Decent DE1: the pump flow falls as '
    + 'the pressure rises, and pressure steps rise slowly. Off uses the Bengle\'s own control.';
const BLOCKED = 'Not available: this profile has a power, lever or hold step.';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('the DE1 emulation switch on the Settings tab', () => {
    const staged = (opts, fn) => browser.withPage({ geometry }, async (page) => {
        await mountEditor(page, { matrix: null, fields: 0 });
        await seatProfile(page, opts);
        await selectPanel(page, 'settings');
        return fn(page);
    });

    test('a profile without the value opens with the switch off, and it can be pressed',
        () => staged({ machineClass: 'bengle' }, async (page) => {
            const seen = await face(page);
            assert.ok(seen, 'the row is on the glass');
            assert.equal(seen.drawn, true);
            assert.equal(seen.label, 'DE1 emulation');
            assert.equal(seen.checked, false);
            assert.equal(seen.ariaChecked, 'false');
            assert.equal(seen.disabled, false);
            assert.ok(seen.caption.includes(AVAILABLE), seen.caption);
            assert.equal(seen.count, 0);
        }));

    test('a press writes true on the draft, a second press writes false, and the count follows',
        () => staged({ machineClass: 'bengle' }, async (page) => {
            await page.click(SWITCH);
            await page.settle(4);
            const on = await face(page);
            assert.equal(on.checked, true);
            assert.equal(on.draft, true);
            assert.equal(on.count, 1);

            await page.click(SWITCH);
            await page.settle(4);
            const off = await face(page);
            assert.equal(off.checked, false);
            assert.equal(off.draft, false);
            assert.equal(off.count, 0);
        }));

    test('a stored true opens with the switch on', () => staged({
        machineClass: 'bengle',
        profile: { ...editingProfile(), de1_emulation: true },
    }, async (page) => {
        const seen = await face(page);
        assert.equal(seen.checked, true);
        assert.equal(seen.ariaChecked, 'true');
    }));

    for (const [kind, over] of [
        ['power', { pump: 'power' }],
        ['lever', { pump: 'lever' }],
        ['hold', { transition: 'hold' }],
    ]) {
        test(`a profile with a ${kind} step shows the value, greyed out, and says why`, () => staged({
            machineClass: 'bengle',
            profile: { ...editingProfile([matrixStep(), matrixStep(over)]), de1_emulation: true },
        }, async (page) => {
            const seen = await face(page);
            assert.equal(seen.checked, true, 'the stored value is still shown');
            assert.equal(seen.disabled, true);
            assert.ok(seen.caption.includes(BLOCKED), seen.caption);

            await page.click(SWITCH);
            await page.settle(4);
            const after = await face(page);
            assert.equal(after.checked, true, 'a press does not change it');
            assert.equal(after.draft, true);
            assert.equal(after.count, 0);
        }));
    }

    for (const [why, machineClass] of [['is a DE1', 'de1'], ['is not known yet', null]]) {
        test(`the row is not drawn when the machine ${why}`, () => staged(
            { machineClass },
            async (page) => {
                assert.equal(await face(page), null);
                const rows = await page.evalFn((sel) => {
                    const screen = window.__h.need(sel);
                    return [...screen.renderRoot.querySelectorAll('ui-settings-row')]
                        .map((r) => r.dataset.row);
                }, EDITOR.screen);
                assert.ok(rows.includes('tank_temperature'), rows.join(','));
                assert.equal(rows.includes('de1-emulation'), false);
            },
        ));
    }
});

describe('the editor follows a capability answer that arrives after it is drawn', () => {
    test('a late Bengle answer draws the switch and the prefix, and a forget takes them away',
        () => browser.withPage({ geometry }, async (page) => {
            await mountEditor(page, { matrix: null, fields: 0 });
            await seatProfile(page, {
                machineClass: 'bengle', late: true, profile: { ...editingProfile(), de1_emulation: true },
            });
            await selectPanel(page, 'settings');
            const title = () => page.evalFn((sel) => (window.__h.need(sel).renderRoot
                .querySelector('#editor-title')?.textContent ?? '').trim(), EDITOR.screen);
            assert.equal(await face(page), null);
            assert.equal(await title(), 'Morning ristretto');
            await page.evalFn(() => window.__machine.load());
            await page.settle(6);
            assert.ok(await face(page), 'the row is drawn after the answer');
            assert.equal(await title(), 'B-DE1 · Morning ristretto');
            await page.evalFn(() => window.__machine.forget());
            await page.settle(6);
            assert.equal(await face(page), null);
            assert.equal(await title(), 'Morning ristretto');
        }));
});

describe('the editor header shows the DE1 emulation prefix', () => {
    const staged = (opts, fn) => browser.withPage({ geometry }, async (page) => {
        await mountEditor(page, { matrix: null, fields: 0 });
        await seatProfile(page, opts);
        return fn(page);
    });

    const header = (page) => page.evalFn((sel) => {
        const screen = window.__h.need(sel);
        return {
            name: (screen.renderRoot.querySelector('#editor-title')?.textContent ?? '').trim(),
            field: screen.renderRoot.querySelector('#rename-field')?.value ?? null,
            draft: screen._draft?.title ?? null,
        };
    }, EDITOR.screen);

    test('a stored true on a supported machine shows the prefix; the title field keeps the plain title',
        () => staged({ machineClass: 'bengle', profile: { ...editingProfile(), de1_emulation: true } }, async (page) => {
            const seen = await header(page);
            assert.equal(seen.name, 'B-DE1 · Morning ristretto');
            assert.equal(seen.field, 'Morning ristretto');
            assert.equal(seen.draft, 'Morning ristretto');
        }));

    test('the switch adds the prefix and takes it away again', () => staged({ machineClass: 'bengle' }, async (page) => {
        assert.equal((await header(page)).name, 'Morning ristretto');
        await selectPanel(page, 'settings');
        await page.click(SWITCH);
        await page.settle(4);
        assert.equal((await header(page)).name, 'B-DE1 · Morning ristretto');
        await page.click(SWITCH);
        await page.settle(4);
        assert.equal((await header(page)).name, 'Morning ristretto');
    }));

    test('a power step gives the plain title', () => staged({
        machineClass: 'bengle',
        profile: { ...editingProfile([matrixStep(), matrixStep({ pump: 'power' })]), de1_emulation: true },
    }, async (page) => {
        assert.equal((await header(page)).name, 'Morning ristretto');
    }));

    for (const [why, machineClass] of [['a DE1', 'de1'], ['an unknown machine', null]]) {
        test(`${why} gives the plain title`, () => staged({
            machineClass,
            profile: { ...editingProfile(), de1_emulation: true },
        }, async (page) => {
            assert.equal((await header(page)).name, 'Morning ristretto');
        }));
    }
});
