import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULES = ['/test/fixtures/de1-emulation-name-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';
const geometry = GATE_A_GEOMETRIES[0];

const PREFIXED = 'B-DE1 · Alpha bloom';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const staged = (opts, fn) => browser.withPage({ geometry }, async (page) => {
    await page.mount(STAGE, MODULES);
    await page.evalFn((o) => window.__names.mount(o), opts);
    assert.deepEqual(page.pageErrors, [], 'the boot must start without throwing');
    return fn(page);
});

const rowsOf = async (page) => {
    await page.evalFn(() => window.__names.show('selector'));
    await page.settle(6);
    const rows = await page.evalFn(() => window.__names.selectorRows());
    return Object.fromEntries(rows.map((row) => [row.id, row.text]));
};

describe('the library list shows the DE1 emulation prefix', () => {
    test('a profile that runs as a DE1 is prefixed; a blocked one and a plain one are not',
        () => staged({ supported: true }, async (page) => {
            const rows = await rowsOf(page);
            assert.ok(rows['profile:name0000'].startsWith(PREFIXED), JSON.stringify(rows));
            assert.ok(rows['profile:name0001'].startsWith('Beta power'), JSON.stringify(rows));
            assert.ok(rows['profile:name0002'].startsWith('Gamma classic'), JSON.stringify(rows));
            assert.equal(Object.values(rows).filter((text) => text.includes('B-DE1')).length, 1);
        }));

    test('the detail title of the chosen profile carries the prefix',
        () => staged({ supported: true }, async (page) => {
            await page.evalFn(() => window.__names.show('selector'));
            assert.equal(await page.evalFn(() => window.__names.select('profile:name0000')), true);
            await page.settle(6);
            assert.equal(await page.evalFn(() => window.__names.detailTitle()), PREFIXED);
        }));

    test('without machine support no row is prefixed',
        () => staged({ supported: null }, async (page) => {
            const rows = await rowsOf(page);
            assert.ok(rows['profile:name0000'].startsWith('Alpha bloom'), JSON.stringify(rows));
            assert.equal(Object.values(rows).some((text) => text.includes('B-DE1')), false);
        }));
});

describe('the home screen shows the DE1 emulation prefix', () => {
    test('the loaded profile name is prefixed when it runs as a DE1',
        () => staged({ supported: true }, async (page) => {
            await page.evalFn(() => window.__names.show('live'));
            await page.settle(6);
            assert.equal(await page.evalFn(() => window.__names.liveName()), PREFIXED);
        }));

    test('the loaded profile name is plain without machine support',
        () => staged({ supported: false }, async (page) => {
            await page.evalFn(() => window.__names.show('live'));
            await page.settle(6);
            assert.equal(await page.evalFn(() => window.__names.liveName()), 'Alpha bloom');
        }));
});

describe('the shot history shows the prefix from the shot, not the profile', () => {
    test('the emulated shot is prefixed and the normal shot is not, in the list and the pickers',
        () => staged({ supported: false }, async (page) => {
            await page.evalFn(() => window.__names.show('history', { page: 'data' }));
            await page.settle(10);
            const list = await page.evalFn(() => window.__names.shotList());
            assert.ok(list.includes(PREFIXED), list);
            assert.ok(list.includes('Gamma classic'), list);
            assert.equal(list.includes('B-DE1 · Gamma classic'), false, list);
            assert.equal(list.includes('B-DE1 \u00b7 B-DE1'), false, list);
            const pickers = (await page.evalFn(() => window.__names.pickerOptions())).flat();
            assert.ok(pickers.some((label) => label.includes(PREFIXED)), JSON.stringify(pickers));
            assert.ok(pickers.some((label) => label.includes('Gamma classic')
                && !label.includes('B-DE1')), JSON.stringify(pickers));
        }));
});
