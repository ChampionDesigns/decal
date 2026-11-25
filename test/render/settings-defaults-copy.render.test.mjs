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

    test('the table has no flow calibration row, because the reset does not write it', async () => {
        const shown = await said();
        assert.equal(shown.flowRow, null, `the flow multiplier is not one of the seven: ${JSON.stringify(shown.flowRow)}`);
    });

    test('the preflight copy says which versions set the flow calibration to 1', async () => {
        const shown = await said();
        assert.match(String(shown.preflight), /^Puts seven machine settings back/);
        assert.match(String(shown.preflight), /Older app versions also set the flow calibration to 1\. Newer versions do not change it\./);
        assert.match(String(shown.preflight), /The load-cell calibration, your profiles and your shot history do not change\.$/);
        assert.doesNotMatch(String(shown.preflight), /among them/i);
        assert.doesNotMatch(String(shown.preflight), /no calibration/i);
    });

    test('the confirmation says the same thing as the table', async () => {
        const shown = await said();
        assert.equal(shown.question, 'Restore these seven settings?');
        assert.match(String(shown.detail), /Older app versions also set the flow calibration to 1\. Newer versions do not change it\./);
        assert.match(String(shown.detail), /The load-cell calibration does not change\.$/);
        assert.doesNotMatch(String(shown.detail), /goes back to 1\b/);
    });

    test('neither text names a version number or gives older versions of the app a name', async () => {
        const shown = await said();
        for (const text of [shown.preflight, shown.detail]) {
            assert.doesNotMatch(String(text), /\d+\.\d+/, text);
            assert.doesNotMatch(String(text), /reaprime|decide|decaid/i, text);
            assert.match(String(text), /Older app versions/, text);
        }
    });

    test('neither text says the flow calibration stays on every version', async () => {
        const shown = await said();
        for (const text of [shown.preflight, shown.detail]) {
            assert.doesNotMatch(String(text), /The flow calibration(,| and) the load-cell calibration/i, text);
            assert.doesNotMatch(String(text), /flow calibration[^.]*do(es)? not change/i, text);
        }
    });
});
