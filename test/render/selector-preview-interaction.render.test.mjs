/**
 * selector-preview-interaction.render.test.mjs — the preview's legend and cursor.
 *
 * A chip toggles its own trace and the choice survives a theme, geometry or density
 * rebuild; the chips stay on one row inside the card; and the cursor follows the
 * pointer along the time axis and clears when it leaves.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launch } from '../harness/index.js';
import { mountSelectorApp } from '../harness/selector-ux.js';

const BENCH = { name: 'bench', width: 1281, height: 801, deviceScaleFactor: 1.5, mobile: false };
const FLOOR = { ...BENCH, name: 'floor', width: 1000, height: 600 };
const KEY = 'app-root >>> selector-screen >>> #key';

test('the selector preview keeps its legend controls and cursor across the approved UI and fitted layouts', async () => {
    const browser = await launch();
    const page = await browser.newPage({ geometry: BENCH, theme: 'light' });
    try {
        await mountSelectorApp(page);
        await page.evalFn(async () => {
            __ux.boot.library.select(__ux.selected.id);
            await __ux.settle();
            __ux.preview = __ux.screen().shadowRoot.getElementById('preview');
        });
        const visible = () => page.evalFn(() => __ux.preview.channels.map((channel, index) => ({
            key: channel.key, visible: __ux.preview.plotHandle.isSeriesVisible(index),
        })));
        assert.deepEqual(await visible(), [
            { key: 'targetPressure', visible: true }, { key: 'targetFlow', visible: true },
        ]);
        await page.click(`${KEY} >>> [data-key="targetPressure"]`);
        assert.deepEqual(await visible(), [
            { key: 'targetPressure', visible: false }, { key: 'targetFlow', visible: true },
        ], 'the pressure chip changes its own trace and leaves flow visible');
        await page.setTheme('dark');
        await page.settle(6);
        assert.equal((await visible())[0].visible, false,
            'a palette rebuild must keep the pressure trace hidden while its chip is off');
        assert.equal(await page.evalFn(selector => window.__h.need(selector).getAttribute('aria-pressed'),
            `${KEY} >>> [data-key="targetPressure"]`), 'false', 'the chip and rebuilt trace agree');
        await page.setGeometry(FLOOR);
        await page.settle(6);
        assert.equal((await visible())[0].visible, false, 'a fit rebuild keeps the hidden trace hidden');
        await page.setGeometry(BENCH);
        await page.settle(6);
        assert.equal((await visible())[0].visible, false, 'returning to the larger viewport keeps the same choice');
        await page.press('Enter');
        assert.equal((await visible())[0].visible, true, 'keyboard activation restores the same trace');

        for (const geometry of [BENCH, FLOOR]) {
            await page.setGeometry(geometry);
            for (const theme of ['light', 'dark']) {
                await page.setTheme(theme);
                for (const density of ['fit-screen', 'largest']) {
                    await page.evalFn(async density => {
                        const { applyDensity } = await import('/src/lib/density.js');
                        applyDensity(document.documentElement, density);
                        await __ux.settle();
                    }, density);
                    const bounds = await page.evalFn(() => {
                        const r = __ux.screen().shadowRoot, card = __ux.preview;
                        const over = card.shadowRoot.querySelector('.u-over').getBoundingClientRect();
                        const frame = card.shadowRoot.querySelector('[part="frame"]').getBoundingClientRect();
                        const chips = [...r.getElementById('key').shadowRoot.querySelectorAll('[data-key]')]
                            .map(chip => { const box = chip.getBoundingClientRect(); return { top: box.top, bottom: box.bottom, right: box.right }; });
                        return { left: over.left, top: over.top, width: over.width, height: over.height,
                            bottom: over.bottom, frameBottom: frame.bottom, frameRight: frame.right,
                            chips, axis: r.getElementById('axis-x').textContent.trim() };
                    });
                    assert.match(bounds.axis, /Time.*s/);
                    assert.equal(bounds.chips.length, 2);
                    assert.ok(Math.abs(bounds.chips[0].top - bounds.chips[1].top) < 1, 'both legend chips remain on one row');
                    assert.ok(bounds.chips.every(chip => chip.bottom <= bounds.top && chip.right <= bounds.frameRight + 1));
                    assert.ok(bounds.height > 100 && bounds.bottom <= bounds.frameBottom + 1, 'the plot remains usable inside the card');
                    await page.mouse('mouseMoved', bounds.left + bounds.width * 0.35, bounds.top + bounds.height * 0.5);
                    const first = await page.evalFn(() => ({ ...__ux.preview.cursor }));
                    await page.mouse('mouseMoved', bounds.left + bounds.width * 0.75, bounds.top + bounds.height * 0.5);
                    const second = await page.evalFn(() => ({ ...__ux.preview.cursor }));
                    assert.equal(first.active, true); assert.equal(second.active, true);
                    assert.ok(Number.isFinite(first.t) && second.t > first.t, 'the cursor follows the pointer along the time axis');
                    assert.ok(Number.isFinite(second.values.targetPressure), 'the cursor samples the actual pressure plan');
                    if (process.env.DECAL_UX_EVIDENCE && density === 'largest') {
                        await mkdir(process.env.DECAL_UX_EVIDENCE, { recursive: true });
                        await writeFile(`${process.env.DECAL_UX_EVIDENCE}/selector-merged-preview-${geometry.name}-${theme}.png`, await page.screenshot());
                    }
                    await page.mouse('mouseMoved', 2, 2);
                    assert.equal(await page.evalFn(() => __ux.preview.cursor.active), false, 'leaving clears the inspection cursor');
                }
            }
        }
        assert.deepEqual(page.pageErrors, []);
    } finally { await browser.close(); }
});
