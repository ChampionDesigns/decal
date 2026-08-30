/**
 * The Live rail and the two stop conditions, after the rail's toggle was withdrawn.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';

const MODULES = ['/test/fixtures/live-gates-fixture.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"></div>';

const S = 'live-screen';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`the Live rail's stop conditions @ ${geometry.name}`, () => {

        /** Mount, let both documents land, and let the screen settle on them. */
        const mounted = (fn, { milkProbe = null } = {}) => browser.withPage({ geometry }, async (page) => {
            await page.mount(STAGE, MODULES);
            await page.evalFn(async (probe) => {
                await window.__live;
                if (probe !== null) {
                    window.__live.boot.capabilities.sensorCapability = () => ({ capability: probe });
                }
                window.__live.mount();
                await window.__live.loadGates();
            }, milkProbe);
            await page.settle(8);
            assert.deepEqual(page.pageErrors, [], 'the screen must render without throwing');
            return fn(page);
        });

        test('the hot-water TARGET is spelled in the unit the stop mode means', () => mounted(async (page) => {
            const unit = await page.evalFn((sel) => window.__h.q(sel).getAttribute('unit'),
                `${S} >>> ui-stepper[data-row="water-stop-target"]`);
            assert.equal(unit, 'g', 'the pour ends on the scale and the well says millilitres');
        }));

        test('no stop caption is drawn on any rail row', () => mounted(async (page) => {
            const found = await page.evalFn(() => {
                const root = window.__h.q('live-screen').shadowRoot;
                return {
                    captions: root.querySelectorAll('.stop-caption').length,
                    slotted: [...root.querySelectorAll('[slot="caption"]')].length,
                };
            });
            assert.equal(found.captions, 0,
                'the rail draws a stop caption again — it is a button with no wiring behind it');
            assert.equal(found.slotted, 0, 'something is slotted into a stepper\'s caption box');
        }));

        test('the two stop rows still draw their block name', () => mounted(async (page) => {
            const names = await page.evalFn(() => ['steam-stop-target', 'water-stop-target']
                .map((row) => {
                    const el = window.__h.q(`live-screen >>> ui-stepper[data-row="${row}"]`);
                    return el ? (el.getAttribute('label') || '') : null;
                }));
            for (const name of names) {
                assert.ok(name && name.trim().length > 0, `a stop row lost its name: ${JSON.stringify(names)}`);
            }
        }));
    });
}
