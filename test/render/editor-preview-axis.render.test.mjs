/**
 * The preview names its time axis, and carries no key of its own.
 *
 * The axis unit is read out of the same table the readouts use rather than retyped, the
 * card holds no legend of its own, and the plot keeps its floor.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { EDITOR, mountEditing, selectPanel, px } from '../harness/editor.js';

const AXIS = 'editor-preview >>> #axis-x';

const expected = (page) => page.evalFn(async () => {
    const readout = await import('/src/lib/chart-readout.js');
    return { timeUnit: String(readout.readoutTime(0)).replace(/^[^A-Za-z°]*/, '') };
});

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`the preview's axis @ ${geometry.name}`, () => {
        const shown = (fn) => browser.withPage({ geometry }, async (page) => {
            await mountEditing(page);
            await selectPanel(page, 'review');
            await page.settle(6);
            return fn(page);
        });

        test('the horizontal axis is named, with its unit', () => shown(async (page) => {
            const want = await expected(page);
            const text = await page.evalFn(
                (s) => window.__h.need(s).textContent.trim(), AXIS,
            );
            assert.ok(text.includes(want.timeUnit),
                `the axis label "${text}" does not carry "${want.timeUnit}"`);
            assert.ok(text.replace(want.timeUnit, '').trim().length > 2,
                `the axis label "${text}" is a unit with no name`);
            const box = await page.box(AXIS);
            assert.ok(box.width > 0 && box.height > 0, 'and it has a rendered box');
            assert.deepEqual(page.pageErrors, []);
        }));

        test('the card carries no chart key', () => shown(async (page) => {
            const found = await page.evalFn(() => {
                const preview = window.__h.q('editor-preview');
                return {
                    inPreview: preview.renderRoot.querySelectorAll('ui-chart-legend').length,
                    slotted: preview.renderRoot.querySelectorAll('[slot="legend"]').length,
                };
            });
            assert.deepEqual(found, { inPreview: 0, slotted: 0 });
        }));

        test('the plot keeps its floor', () => shown(async (page) => {
            const floor = px(await page.resolveToken('--ui-chart-min-h', 'block-size'));
            const card = await page.box(EDITOR.previewCard);
            assert.ok(card.height >= floor,
                `the card is below its own floor: ${card.height} < ${floor}`);
        }));
    });
}
