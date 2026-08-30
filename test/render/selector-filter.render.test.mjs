/**
 * selector-filter.render.test.mjs — the filter that waited for Enter.
 *
 * Written 29 August 2026 for the fix campaign's cluster L, finding **F-030**.
 *
 *   F-030  "Filter profiles" narrowed nothing as you typed. The audit read the listing
 *          after every one of the eight characters of "Baseline" and again after a further
 *          5 000 ms with no keystrokes: 42 rows, unfiltered, every time. One press of Enter
 *          then narrowed it to 5 — "a key nothing on the glass mentions". And the
 *          keystrokes were NOT lost: the field's value read "Baseline" at all three depths
 *          and sixteen `input` events were raised and heard. The narrowing was bound to
 *          submit.
 *
 * F-016 #8 (the row's unnamed overflow opener) WAS attempted in this same pass and is
 * PARKED, with the measurement in FIXLOG.md and the reasoning in `selector-screen.js` beside
 * the span itself: naming that element folds its name into every ROW's name, which is the
 * P12 defect this screen already paid for once.
 *
 * BOTH GATE A GEOMETRIES, on the shared carry fixture: a real `createAppBoot`, the real
 * library store, and a scripted table with no server behind it.
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

        /* ═══════════════════════════════════════════════════════════════════
         * F-030 — narrowing follows the keystrokes
         * ═════════════════════════════════════════════════════════════════ */

        test('F-030 — the listing narrows BEFORE any Enter', () => mounted(async (page) => {
            const whole = await page.evalFn(() => window.__carry.listing().count);
            const typed = await page.evalFn(() => window.__carry.typeFilter('Baseline'));

            assert.equal(typed.query, 'Baseline', 'the screen holds what was typed');
            const last = typed.perKeystroke[typed.perKeystroke.length - 1];
            assert.ok(last < whole,
                `after eight characters the listing is narrower than ${whole} — got ${last}`);
            /* THE FINDING'S OWN MEASUREMENT: "after each of the eight characters …
             * div#rows still holds 42 rows". Not one of the eight may be the whole list
             * once the query has stopped matching everything. */
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
                /* THE ROUTE THAT USED TO BE THE ONLY ONE. `search` is still bound; it now
                 * lands on the same rule instead of being the rule. */
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
