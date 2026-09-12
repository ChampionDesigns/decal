/**
 * The empty step area is a door, not a gap.
 *
 * A profile with no steps offers a way to add one where the steps would be, and pressing it
 * creates a step rather than leaving the area inert.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { mountEditor, seatProfile, editingProfile, matrixStep } from '../harness/editor.js';

const geometry = GATE_A_GEOMETRIES[0];

/** The screen's OWN matrix — `mountEditor({matrix: null})` leaves the region for it. */
const MATRIX = 'editor-screen >>> #matrix';
const ADD = `${MATRIX} >>> #add-step`;

/** How many step columns the matrix draws, counted off the header row it renders. */
const columns = (page) => page.evalFn((sel) => {
    const host = window.__h.need(sel);
    const head = host.renderRoot.querySelector('[data-row="head"]');
    if (!head) return 0;
    return head.querySelectorAll('.cell:not(.rail)').length;
}, MATRIX);

/** The add door's accessible name, from Chrome's own tree rather than from the markup. */
async function addName(page) {
    await page.send('Accessibility.enable');
    const backend = await page.evalFn((sel) => {
        const host = window.__h.need(sel);
        window.__addNode = host.renderRoot.querySelector('#add-step');
        return Boolean(window.__addNode);
    }, MATRIX);
    assert.equal(backend, true, 'the add door must be composed to be named');
    const { result } = await page.send('Runtime.evaluate', {
        expression: 'window.__addNode', returnByValue: false,
    });
    const { nodes } = await page.send('Accessibility.getPartialAXTree', {
        objectId: result.objectId, fetchRelatives: false,
    });
    const node = nodes.find((n) => n.role?.value === 'button') ?? nodes[0];
    return { name: node?.name?.value ?? '', role: node?.role?.value ?? '' };
}

async function pressAdd(page) {
    await page.evalFn((sel) => {
        window.__h.need(sel).renderRoot.querySelector('#add-step')
            .scrollIntoView({ block: 'center', inline: 'nearest' });
        return true;
    }, MATRIX);
    await page.settle(2);

    const box = await page.box(ADD);
    assert.ok(box.width > 0 && box.height > 0, 'the door has no box to press');
    assert.ok(box.left >= 0 && box.left + box.width <= page.geometry.width,
        'the door is outside the window, so a press at its coordinates would land elsewhere');
    await page.click(ADD);
    await page.settle(6);
}

/** The steps the store currently holds, by name — the fact behind the column count. */
const draftSteps = (page) => page.evalFn(
    (sel) => (window.__h.need(sel)._draft?.steps ?? []).map((s) => s.name), 'editor-screen',
);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('the empty step area is a door (F-033)', () => {
    const staged = (steps, fn) => browser.withPage({ geometry }, async (page) => {
        await mountEditor(page, { matrix: null, fields: 0 });
        await seatProfile(page, { profile: { ...editingProfile(), steps } });
        return fn(page);
    });

    const three = () => [
        matrixStep({ name: 'one' }),
        matrixStep({ name: 'two', pump: 'pressure', pressure: 9 }),
        matrixStep({ name: 'three' }),
    ];

    test('it carries a plus, it has a real box, and it is named', () => staged(three(), async (page) => {
        assert.equal(await columns(page), 3, 'the profile starts at three columns');
        assert.equal(await page.exists(ADD), true, 'the empty area composes the door');

        await page.evalFn((sel) => {
            window.__h.need(sel).renderRoot.querySelector('#add-step')
                .scrollIntoView({ block: 'center', inline: 'nearest' });
            return true;
        }, MATRIX);
        await page.settle(2);
        const box = await page.box(ADD);
        assert.ok(box.width > 0 && box.height > 0,
            'the door has a box to press — the trailing track has a minimum of ZERO, so '
            + 'without a floor this collapses the moment the columns fill the port');

        const glyph = await page.evalFn((sel) => {
            const host = window.__h.need(sel);
            const svg = host.renderRoot.querySelector('#add-step svg.plus');
            if (!svg) return null;
            const rect = svg.getBoundingClientRect();
            return { paths: svg.querySelectorAll('path').length, w: rect.width, h: rect.height };
        }, MATRIX);
        assert.ok(glyph, 'the small plus asked for is composed');
        assert.equal(glyph.paths, 1);
        assert.ok(glyph.w > 0 && glyph.h > 0, 'and it is drawn, not collapsed');

        const named = await addName(page);
        assert.equal(named.role, 'button', 'it is a control, not a paint');
        assert.ok(named.name.trim().length > 0,
            'a control with no accessible name is F-016 all over again');
    }));

    test('a tap there adds a column, at the end', () => staged(three(), async (page) => {
        await pressAdd(page);

        assert.equal(await columns(page), 4, 'the matrix draws one more step column');
        const names = await draftSteps(page);
        assert.equal(names.length, 4);
        assert.deepEqual(names.slice(0, 3), ['one', 'two', 'three'],
            'the existing steps are untouched and in order');
        assert.deepEqual(page.pageErrors, []);
    }));

    test('and again — the door does not go stale after the first press',
        () => staged(three(), async (page) => {
            await pressAdd(page);
            await pressAdd(page);
            assert.equal(await columns(page), 5);
        }));

    test('FROM ZERO STEPS — the dead end has a way out', () => staged([], async (page) => {
        assert.equal(await columns(page), 0, 'nothing to insert after: no column, no rail');
        assert.equal(await page.exists(ADD), true,
            'the door is the ONLY control on this profile, so it has to be there');

        const box = await page.box(ADD);
        assert.ok(box.width > 0 && box.height > 0,
            'and it must have a box — a zero-height door is the dead end with a handle on it');

        await pressAdd(page);

        assert.equal(await columns(page), 1, 'its first column');
        assert.equal((await draftSteps(page)).length, 1);
        assert.deepEqual(page.pageErrors, []);
    }));

    test('a read-only matrix keeps the paint and gains no control',
        () => browser.withPage({ geometry }, async (page) => {
            await mountEditor(page, { matrix: null, fields: 0 });
            await seatProfile(page, { profile: { ...editingProfile(), steps: three() } });
            await page.evalFn(async (sel) => {
                const host = window.__h.need(sel);
                host.editable = false;
                await host.updateComplete;
            }, MATRIX);
            await page.settle(3);

            assert.equal(await page.exists(ADD), false,
                'a matrix nobody can edit has nothing to add a step to');
            const paint = await page.evalFn((sel) => {
                const el = window.__h.need(sel).renderRoot.querySelector('.filler');
                return el ? { tag: el.tagName, hidden: el.getAttribute('aria-hidden') } : null;
            }, MATRIX);
            assert.deepEqual(paint, { tag: 'DIV', hidden: 'true' },
                'the seam paint is exactly what it always was');
        }));
});
