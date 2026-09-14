import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, sleep, BENCH } from '../harness/index.js';

const MODULES = ['/test/fixtures/settings-shell-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

const ROW = 'machine-water-tank-unit';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('"Saving your choice…" has an end', () => {
    let page;

    before(async () => {
        page = await browser.newPage({ geometry: BENCH });
        await page.mount(STAGE, MODULES);
        await page.evalFn(() => window.__settings.mount().then(() => true));
        assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
        await page.evalFn(async () => {
            await window.__settings.selectCategory('machine');
            await window.__settings.selectLeaf('machine-water-tank');
            return true;
        });
        await page.settle();
    });

    after(async () => {
        await page?.evalFn(() => {
            window.__settings.holdRemembered(false);
            window.__settings.releaseRemembered();
            return true;
        });
        await page?.close();
    });

    const marker = () => page.evalFn(() => document.querySelector('settings-screen')
        .shadowRoot.getElementById('preference-pending')?.textContent.trim() ?? null);

    test('a write that has left and not answered is said, and clears when it answers', async () => {
        await page.evalFn(() => { window.__settings.holdRemembered(true); return true; });
        assert.equal(await marker(), null, 'a page with nothing in flight says nothing');

        await page.evalFn((row) => window.__settings.change(row, 'mL'), ROW);
        await page.settle();

        assert.match(String(await marker()), /Saving/,
            'the request is out and the control still shows the old value — the middle state '
            + 'is exactly what a person cannot otherwise see');

        await page.evalFn(() => window.__settings.releaseRemembered());
        await page.settle();
        assert.equal(await marker(), null, 'an answered write leaves nothing to wait for');
    });

    test('a write nothing ever answers still takes the line down', async () => {
        await page.evalFn(() => {
            window.__settings.holdRemembered(true);

            document.querySelector('settings-screen').pendingBackstopMs = 250;
            return true;
        });

        await page.evalFn((row) => window.__settings.change(row, 'mm'), ROW);
        await page.settle();
        assert.match(String(await marker()), /Saving/, 'the marker is up, or there is nothing to time out');

        await sleep(700);
        await page.settle();

        assert.equal(await page.evalFn(() => window.__settings.heldRemembered()) > 0, true,
            'the write must STILL be unanswered, or the marker came down for the ordinary reason');
        assert.equal(await marker(), null,
            'nothing answered and the line stood — a spinner that never stops says a request '
            + 'is still going when nothing is');

        const said = await page.evalFn(() => {
            const root = document.querySelector('settings-screen').shadowRoot;
            return {
                write: root.getElementById('write-refusal')?.textContent.trim() ?? null,
                commit: root.getElementById('commit-refusal')?.textContent.trim() ?? null,
            };
        });
        assert.deepEqual(said, { write: null, commit: null },
            'the backstop reported a failure it never saw');

        await page.evalFn(() => window.__settings.releaseRemembered());
        await page.settle();
    });
});
