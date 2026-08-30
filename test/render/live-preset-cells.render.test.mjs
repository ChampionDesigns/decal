/**
 * The two preset banks on the Live rail, at the OUTCOME.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { DEFAULT_PRESETS } from '../../src/lib/live-targets.js';

const MODULES = ['/test/fixtures/live-selector-carry-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

/** The shipped flow bank, read from its owner so no number is typed into this file. */
const FLOW = DEFAULT_PRESETS.steamFlow;
const DRINK = DEFAULT_PRESETS.drinkWeight;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`live preset cells @ ${geometry.name} (${geometry.width}x${geometry.height})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(STAGE, MODULES);
            await page.settle(6);
            await page.evalFn(() => window.__carry.mount());
            assert.deepEqual(page.pageErrors, [], 'the rail must mount without throwing');
            await fn(page);
            assert.deepEqual(page.pageErrors, [], 'the rail must run without throwing');
        });

        test('F-022 — a TAP on a flow cell writes steamFlowPresetIndex', () => mounted(async (page) => {
            const before = await page.evalFn(() => window.__carry.stored('steamFlowPresetIndex'));
            assert.equal(before, null, 'nothing has ever written this key — that IS the finding');

            await page.evalFn(() => window.__carry.tapPreset('steamFlow', 1));

            const held = await page.evalFn(() => window.__carry.stored('steamFlowPresetIndex'));
            assert.equal(held, 1, `the second cell (${FLOW[1]} mL/s) is the armed one`);
        }));

        test('F-022 — and the hold menu\'s "Apply" writes the cell it is anchored to',
            () => mounted(async (page) => {
                const menu = await page.evalFn(() => window.__carry.holdPreset('steamFlow', 2));
                assert.ok(menu.items.includes('apply'), 'the hold offers Apply');
                assert.match(menu.labels[0], new RegExp(`^Apply ${FLOW[2]}$`),
                    'and it quotes the held cell');

                await page.evalFn(() => window.__carry.pressMenuItem('apply'));
                assert.equal(await page.evalFn(() => window.__carry.stored('steamFlowPresetIndex')), 2,
                    'the third cell is recorded as armed');
            }));

        test('F-022 — the workflow write is UNCHANGED: the key rides beside it, not instead',
            () => mounted(async (page) => {
                await page.evalFn(() => window.__carry.clearRequests());
                await page.evalFn(() => window.__carry.tapPreset('steamFlow', 3));

                const workflow = await page.evalFn(() => window.__carry.requests('/api/v1/workflow')
                    .filter((r) => r.method === 'PUT'));
                assert.equal(workflow.length, 1, 'one workflow write, as before the fix');
                assert.equal(workflow[0].body?.steamSettings?.flow, FLOW[3],
                    'carrying the cell\'s own number');

                const kv = await page.evalFn(() => window.__carry
                    .requests('/store/decal/steamFlowPresetIndex'));
                assert.equal(kv.length, 1, 'and one KV write, which is the half that was missing');
                assert.equal(kv[0].method, 'POST');
                assert.equal(kv[0].body, 3);
            }));

        test('F-022 — stepping the dial by hand CLEARS the key, so it cannot go stale',
            () => mounted(async (page) => {
                await page.evalFn(() => window.__carry.tapPreset('steamFlow', 1));
                assert.equal(await page.evalFn(() => window.__carry.stored('steamFlowPresetIndex')), 1);

                await page.evalFn(async () => {
                    const screen = window.__h.q('live-screen');
                    screen.dispatchEvent(new CustomEvent('target-change', {
                        detail: { key: 'steamFlow', value: 1.7, presetIndex: null },
                        bubbles: true, composed: true,
                    }));
                    await screen.updateComplete;
                    await new Promise((done) => { setTimeout(done, 40); });
                });

                assert.equal(await page.evalFn(() => window.__carry.stored('steamFlowPresetIndex')), null,
                    'no preset is armed, and the key says so by not being there');
            }));

        test('F-022 — the drink bank writes no index, because the table declares none',
            () => mounted(async (page) => {
                await page.evalFn(() => window.__carry.clearRequests());
                await page.evalFn(() => window.__carry.tapPreset('drinkWeight', 0));
                const kv = await page.evalFn(() => window.__carry.requests('/store/decal/'));
                const invented = kv.filter((r) => r.path.includes('PresetIndex'));
                assert.deepEqual(invented, [],
                    'a fix for a key with no writer must not answer with a key with no row');
            }));

        test('F-026 — the keypad opened by the hold is headed for the CELL',
            () => mounted(async (page) => {
                await page.evalFn(() => window.__carry.holdPreset('drinkWeight', 0));
                await page.evalFn(() => window.__carry.pressMenuItem('enter'));

                const pad = await page.evalFn(() => window.__carry.keypad());
                assert.equal(pad.open, true, 'the pad opens');
                assert.equal(pad.value, String(DRINK[0]), 'starting from the cell\'s own number');
                assert.match(pad.heading, /preset/i, `the heading names the cell: "${pad.heading}"`);
            }));

        test('F-026 — Confirm writes the CELL, and leaves the setting alone',
            () => mounted(async (page) => {
                const targetBefore = await page.evalFn(() => window.__h.q('live-screen').targets.drinkWeight);

                await page.evalFn(() => window.__carry.holdPreset('drinkWeight', 0));
                await page.evalFn(() => window.__carry.pressMenuItem('enter'));
                await page.evalFn(() => window.__carry.clearRequests());
                await page.evalFn(() => window.__carry.keypadConfirm(28));

                const cells = await page.evalFn(() => window.__carry.bankCells('drinkWeight'));
                assert.equal(cells[0], '28', `the held cell prints 28 — got ${JSON.stringify(cells)}`);

                const stored = await page.evalFn(() => window.__carry.stored('drinkOutPresets'));
                assert.deepEqual(stored, [28, DRINK[1], DRINK[2], DRINK[3]],
                    'and the whole bank persisted with the new cell in it');

                const target = await page.evalFn(() => window.__h.q('live-screen').targets.drinkWeight);
                assert.equal(target, targetBefore, 'the Drink target is untouched');
                const workflow = await page.evalFn(() => window.__carry.requests('/api/v1/workflow')
                    .filter((r) => r.method === 'PUT'));
                assert.deepEqual(workflow, [], 'no workflow write — this gesture is not about the machine');
            }));

        test('F-026 — the stepper\'s OWN readout still edits the setting', () => mounted(async (page) => {
            await page.evalFn(async () => {
                const screen = window.__h.q('live-screen');
                const stepper = screen.shadowRoot.querySelector('ui-stepper[data-key="drinkWeight"]');
                stepper.dispatchEvent(new CustomEvent('edit', { bubbles: true, composed: true }));
                await screen.updateComplete;
            });
            const pad = await page.evalFn(() => window.__carry.keypad());
            assert.equal(pad.open, true, 'the readout opens the pad');

            await page.evalFn(() => window.__carry.clearRequests());
            await page.evalFn(() => window.__carry.keypadConfirm(44));

            const target = await page.evalFn(() => window.__h.q('live-screen').targets.drinkWeight);
            assert.equal(target, 44, 'the SETTING takes the typed number');
            const cells = await page.evalFn(() => window.__carry.bankCells('drinkWeight'));
            assert.deepEqual(cells, DRINK.map(String), 'and the bank is exactly as it shipped');
        }));

        test('F-026 — the flow bank\'s cells take a typed value the same way',
            () => mounted(async (page) => {
                await page.evalFn(() => window.__carry.holdPreset('steamFlow', 3));
                await page.evalFn(() => window.__carry.pressMenuItem('enter'));
                await page.evalFn(() => window.__carry.keypadConfirm(1.4));

                const stored = await page.evalFn(() => window.__carry.stored('steamFlowPresets'));
                assert.deepEqual(stored, [FLOW[0], FLOW[1], FLOW[2], 1.4],
                    'the fourth cell is 1.4 and the other three are the shipped ones');
            }));

        /** Seed one document, boot on it, and read the cells that were drawn. */
        const drawnWith = async (page, stored) => {
            await page.evalFn((doc) => window.__carry.seedKv('drinkOutPresets', doc), stored);
            await page.evalFn(() => window.__carry.mount());
            return page.evalFn(() => window.__carry.bankCells('drinkWeight'));
        };

        test('F-051 — absent draws the shipped bank', () => mounted(async (page) => {
            assert.deepEqual(await drawnWith(page, null), DRINK.map(String));
        }));

        test('F-051 — four numbers are drawn exactly as given, a real zero included',
            () => mounted(async (page) => {
                assert.deepEqual(await drawnWith(page, [30, 0, 40, 50]), ['30', '0', '40', '50'],
                    'a stored 0 is a value the document really carries');
            }));

        test('F-051 — a NULL cell no longer draws as a zero', () => mounted(async (page) => {
            const drawn = await drawnWith(page, [30, null, 40, 50]);
            assert.deepEqual(drawn, DRINK.map(String),
                'the document cannot be believed, so the shipped bank is drawn');
            assert.notDeepEqual(drawn, ['30', '0', '40', '50'],
                'the null document and the zero document are no longer indistinguishable — '
                + 'that identity is the whole finding');
        }));

        test('F-051 — a non-numeric cell no longer costs the bank a CELL', () => mounted(async (page) => {
            const drawn = await drawnWith(page, [30, 'x', 40, 50]);
            assert.equal(drawn.length, DRINK.length,
                'four cells, not three — the shape does not change silently');
            assert.deepEqual(drawn, DRINK.map(String), 'and they are the shipped ones');
        }));

        test('F-051 — a numeric STRING is refused too: coercion was the fault',
            () => mounted(async (page) => {
                const drawn = await drawnWith(page, ['31', 36, 40, 50]);
                assert.deepEqual(drawn, DRINK.map(String), 'the shipped bank is drawn');
                assert.notEqual(drawn[0], '31', 'the string was not quietly turned into a number');
            }));
    });
}
