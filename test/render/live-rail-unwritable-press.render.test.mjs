/**
 * live-rail-unwritable-press.render.test.mjs — the Live rail's optimistic press.
 *
 * A press paints on the rail before anything is awaited and the machine's answer
 * corrects it. A press the profile document cannot build a patch for is refused
 * inside the dispatch, so it never paints and nothing is sent.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULES = ['/test/fixtures/live-selector-carry-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const mounted = (fn) => browser.withPage({ geometry: BENCH }, async (page) => {
    await page.mount(STAGE, MODULES);
    await page.settle(6);
    await page.evalFn(() => window.__carry.mount({ loadWorkflow: true }));
    assert.deepEqual(page.pageErrors, [], 'the rail must mount without throwing');
    await fn(page);
    assert.deepEqual(page.pageErrors, [], 'the rail must run without throwing');
});

describe('the Live rail holds until the patch is known @ bench', () => {

    test('a writable press is on the rail in the same tick, and is sent', async () => {
        await mounted(async (page) => {
            const pressed = await page.evalFn(async () => {
                const before = window.__carry.rail('drinkWeight');
                const result = await window.__carry.pressRail('drinkWeight');
                return { before, ...result };
            });

            assert.equal(pressed.before.disabled, false, 'the drink-weight row was not pressable');
            assert.ok(Number.isFinite(pressed.before.value), 'the row was drawing no number to step');
            assert.ok(pressed.atOnce > pressed.before.value,
                'the pressed value was not on the rail before anything was awaited');
            assert.equal(pressed.rail.held, pressed.atOnce, 'and it did not survive the round trip');
            assert.equal(pressed.puts.length, 1, 'one press, one write');
            assert.ok(pressed.puts[0].context, 'the drink weight is written on the context block');
        });
    });

    test('a brew-temperature press on a profile WITH steps behaves exactly the same', async () => {
        await mounted(async (page) => {
            const pressed = await page.evalFn(async () => {
                const before = window.__carry.rail('brewTemp');
                const result = await window.__carry.pressRail('brewTemp');
                return { before, ...result };
            });

            assert.equal(pressed.before.disabled, false, 'the brew row was not pressable');
            assert.ok(pressed.atOnce > pressed.before.value,
                'the guard is refusing a press it can build a patch for');
            assert.equal(pressed.puts.length, 1, 'one press, one write');
            assert.ok(pressed.puts[0].profile, 'a brew temperature is written by replacing the profile');
        });
    });

    test('a profile with no steps draws the brew row as unavailable', async () => {
        await mounted(async (page) => {
            const stepless = await page.evalFn(async () => {
                const served = await window.__carry.serveSteplessProfile();
                return { served, rail: window.__carry.rail('brewTemp') };
            });

            assert.equal(stepless.served.steps, 0, 'the served profile still has steps');
            assert.equal(stepless.rail.held, null, 'the screen holds a brew temperature it was not given');
            assert.equal(stepless.rail.disabled, true, 'a row with no value is still pressable');
        });
    });

    test('a press the document cannot answer never reaches the rail, and sends nothing', async () => {
        await mounted(async (page) => {
            const refused = await page.evalFn(async () => {
                await window.__carry.serveSteplessProfile();
                const before = window.__carry.workflowPuts().length;
                const result = await window.__carry.reportRailStep('brewTemp', 93);
                return { before, ...result };
            });

            assert.equal(refused.atOnce, null,
                'the unwritable press was painted on the rail and then had to be taken back');
            assert.equal(refused.rail.held, null, 'and it was still there after the queue had run');
            assert.equal(refused.rail.disabled, true, 'the row came back to life on a press that wrote nothing');
            assert.equal(refused.puts.length, refused.before,
                'a press with no patch to build still put something on the wire');
        });
    });

    test('a refused press leaves the writable rows working', async () => {
        await mounted(async (page) => {
            const after = await page.evalFn(async () => {
                await window.__carry.serveSteplessProfile();
                await window.__carry.reportRailStep('brewTemp', 93);
                const before = window.__carry.rail('dose');
                const result = await window.__carry.pressRail('dose');
                return { before, ...result };
            });

            assert.ok(after.atOnce > after.before.value, 'the dose press did not reach the rail');
            assert.equal(after.puts.length, 1, 'and it was not sent');
            assert.ok(after.puts[0].context, 'the dose is written on the context block');
        });
    });
});
