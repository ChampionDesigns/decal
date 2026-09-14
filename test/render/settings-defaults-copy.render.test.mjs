/**
 * The default-reset page says what the reset does.
 *
 * Reads the preflight sentence, the table and the confirmation, and checks they agree.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULES = ['/test/fixtures/settings-shell-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('the default-reset page says what the reset does', () => {
    let page;

    before(async () => {
        page = await browser.newPage({ geometry: BENCH });
        await page.mount(STAGE, MODULES);
        await page.evalFn(() => window.__settings.mount().then(() => true));
        assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');

        await page.evalFn(() => window.__settings.flowCalibration(1.4).then(() => true));
        await page.evalFn(async () => {
            await window.__settings.selectCategory('calibration');
            await window.__settings.selectLeaf('calibration-default-load-settings');
            return true;
        });
        await page.settle();
    });

    after(async () => { await page?.close(); });

    const said = () => page.evalFn(() => {
        const root = document.querySelector('settings-screen')
            .shadowRoot.getElementById('bespoke').shadowRoot;
        const section = root.getElementById('defaults');
        const flow = root.querySelector('[data-field="flowMultiplier"]');
        const dialog = root.getElementById('defaults-confirm');
        return {
            preflight: section?.querySelector('.ui-caption')?.textContent.trim() ?? null,
            flowRow: flow ? [...flow.children].map((cell) => cell.textContent.trim()) : null,
            question: dialog?.getAttribute('question') ?? null,
            detail: dialog?.getAttribute('detail') ?? null,
        };
    });

    test('the table lists flow calibration and what it will become', async () => {
        const shown = await said();
        assert.notEqual(shown.flowRow, null, 'the flow multiplier is one of the eight');
        assert.ok(shown.flowRow.some((cell) => /flow calibration/i.test(cell)),
            `the row names the setting: ${JSON.stringify(shown.flowRow)}`);
        assert.equal(shown.flowRow[shown.flowRow.length - 1], '1',
            'and says it goes back to 1');
        assert.equal(shown.flowRow[shown.flowRow.length - 2], '1.4',
            'from the value this machine is actually holding');
    });

    test('the preflight copy names the calibration that is kept, not one that is not', async () => {
        const shown = await said();
        assert.match(String(shown.preflight), /flow calibration/i,
            'the sentence above the table lists the calibration the button resets');
        assert.match(String(shown.preflight), /load[- ]cell/i,
            'and names the calibration that really is left alone');
        assert.doesNotMatch(String(shown.preflight), /no calibration/i,
            'a blanket "no calibration" is contradicted by the row underneath it');
    });

    test('the confirmation says the same thing as the table', async () => {
        const shown = await said();
        assert.match(String(shown.detail), /flow calibration/i,
            'the last sentence before an irreversible button names the flow multiplier, '
            + 'which the page-name list cannot be relied on to reach');
        assert.match(String(shown.detail), /\b1\b/, 'and the value it goes back to');
        assert.match(String(shown.detail), /load[- ]cell/i,
            'and keeps the true reassurance rather than the false one');
    });
});
