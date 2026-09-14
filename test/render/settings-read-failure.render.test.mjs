import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULES = ['/test/fixtures/settings-shell-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

const KEY = 'waterTankUnit';
const ROW = 'machine-water-tank-unit';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe('a preference that could not be read', () => {
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
            window.__settings.refuseReads(false);
            window.__settings.holdRemembered(false);
            window.__settings.releaseRemembered();
            return true;
        });
        await page?.close();
    });

    beforeEach(async () => {
        await page.evalFn((key) => {
            window.__settings.refuseReads(false);
            window.__settings.holdRemembered(false);
            window.__settings.releaseRemembered();
            return window.__settings.reread(key).then(() => true);
        }, KEY);
        await page.settle();
    });

    const lines = () => page.evalFn(() => {
        const root = document.querySelector('settings-screen').shadowRoot;
        return {
            pending: root.getElementById('preference-pending')?.textContent.trim() ?? null,
            unread: root.getElementById('preference-unread')?.textContent.trim() ?? null,
        };
    });

    test('a read that could not be made is said, and a read that works takes it back', async () => {
        assert.deepEqual(await lines(), { pending: null, unread: null },
            'a page with nothing wrong says nothing');

        await page.evalFn((key) => {
            window.__settings.refuseReads(true);
            return window.__settings.reread(key).then(() => true);
        }, KEY);
        await page.settle();

        assert.match(String((await lines()).unread), /could not be read/i,
            'the control is drawing the shipped default and nothing said the machine was '
            + 'never asked — which is the state a person cannot act on');

        await page.evalFn((key) => {
            window.__settings.refuseReads(false);
            return window.__settings.reread(key).then(() => true);
        }, KEY);
        await page.settle();

        assert.equal((await lines()).unread, null,
            'a read that worked is what clears a read that did not');
    });

    test('a failed read leaves a write that is still on the wire saying so', async () => {
        await page.evalFn(() => { window.__settings.holdRemembered(true); return true; });
        await page.evalFn((row) => window.__settings.change(row, 'mL'), ROW);
        await page.settle();
        assert.match(String((await lines()).pending), /Saving/,
            'the write is out and unanswered, or this case proves nothing');

        await page.evalFn((key) => {
            window.__settings.refuseReads(true);
            return window.__settings.reread(key).then(() => true);
        }, KEY);
        await page.settle();

        assert.equal(await page.evalFn(() => window.__settings.heldRemembered()) > 0, true,
            'the write must STILL be unanswered, or the marker came down for the ordinary reason');
        const said = await lines();
        assert.match(String(said.pending), /Saving/,
            'a read that learned nothing about the write ended the write\'s pending state, '
            + 'and the request is still going');
        assert.match(String(said.unread), /could not be read/i,
            'and the read still reports itself — neither outcome silences the other');

        await page.evalFn(() => {
            window.__settings.refuseReads(false);
            window.__settings.releaseRemembered();
            return true;
        });
        await page.settle();
        assert.equal((await lines()).pending, null, 'the answered write takes its own line down');
    });
});
