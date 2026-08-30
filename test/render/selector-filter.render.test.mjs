/**
 * The filter that waited for Enter.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULES = ['/test/fixtures/live-selector-carry-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`selector filter and names @ ${geometry.name} (${geometry.width}x${geometry.height})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(STAGE, MODULES);
            await page.settle(6);
            await page.evalFn(() => window.__carry.mount());
            await page.evalFn(() => window.__carry.show('selector'));
            const listing = await page.evalFn(() => window.__carry.listing());
            assert.ok(listing.count > 1, `the listing has rows to narrow — got ${listing.count}`);
            assert.deepEqual(page.pageErrors, [], 'the selector must mount without throwing');
            await fn(page);
            assert.deepEqual(page.pageErrors, [], 'the selector must run without throwing');
        });

        test('F-030 — the listing narrows BEFORE any Enter', () => mounted(async (page) => {
            const whole = await page.evalFn(() => window.__carry.listing().count);
            const typed = await page.evalFn(() => window.__carry.typeFilter('Baseline'));

            assert.equal(typed.query, 'Baseline', 'the screen holds what was typed');
            const last = typed.perKeystroke[typed.perKeystroke.length - 1];
            assert.ok(last < whole,
                `after eight characters the listing is narrower than ${whole} — got ${last}`);
            assert.ok(typed.perKeystroke.some((count) => count < whole),
                `the count moved while typing — got ${JSON.stringify(typed.perKeystroke)}`);
        }));

        test('F-030 — it narrows MONOTONICALLY, character by character', () => mounted(async (page) => {
            const typed = await page.evalFn(() => window.__carry.typeFilter('Baseline'));
            for (let i = 1; i < typed.perKeystroke.length; i += 1) {
                assert.ok(typed.perKeystroke[i] <= typed.perKeystroke[i - 1],
                    `a longer query cannot match more rows: ${JSON.stringify(typed.perKeystroke)}`);
            }
        }));

        test('F-030 — and what is left is what was asked for', () => mounted(async (page) => {
            await page.evalFn(() => window.__carry.typeFilter('Baseline'));
            const listing = await page.evalFn(() => window.__carry.listing());
            assert.ok(listing.count > 0, 'the family is still there');
            for (const title of listing.titles) {
                assert.match(title, /Baseline/i, `every remaining row matches: ${title}`);
            }
        }));

        test('F-030 — Enter still works, and changes nothing that typing has not already done',
            () => mounted(async (page) => {
                const typed = await page.evalFn(() => window.__carry.typeFilter('Baseline'));
                const afterEnter = await page.evalFn(() => window.__carry.submitFilter());
                assert.equal(afterEnter, typed.perKeystroke[typed.perKeystroke.length - 1],
                    'Enter is a no-op on a listing already narrowed to the same query');
            }));

        test('F-030 — clearing the field puts the whole library back', () => mounted(async (page) => {
            const whole = await page.evalFn(() => window.__carry.listing().count);
            await page.evalFn(() => window.__carry.typeFilter('Baseline'));
            await page.evalFn(async () => {
                window.__h.q('selector-screen').shadowRoot.getElementById('filter').clear();
                await window.__h.q('selector-screen').updateComplete;
            });
            assert.equal(await page.evalFn(() => window.__carry.listing().count), whole,
                'clear() raises input AND search; either one has to put the rows back');
        }));

    });
}
