/**
 * live-stop-modes.render.test.mjs — the Live rail and the two stop conditions, after the
 * rail's toggle was withdrawn.
 *
 * ===========================================================================
 * WHAT THIS SUITE USED TO PROVE, AND WHY IT NO LONGER CAN
 * ===========================================================================
 *
 * It pressed a control that is gone. Until 30 August 2026 the rail drew a second line
 * under STEAM and HOT WATER — "Timed stop", "Weight target" — and that line was a
 * `<ui-button>`: pressing it swapped the mode and wrote the machine's own field. It was
 * L25's fix ("v1 restores a visible control for Time/Milk and Temp/Vol", SCOPE.md:1983).
 *
 * BEN WITHDREW IT, AND HIS REASON IS THE STRONGEST ARGUMENT AGAINST IT: "these labels
 * (Timed Stop and Weight Target) are actual toggles, even though it wasn't clear they
 * were." A control that reads as a caption is a control nobody presses, and it cost the
 * rail two labels at a second size that no other row carries. Settings keeps both modes —
 * `machine-steam-stop` and `machine-water-stop` in `settings-leaves.js` — so the CAPABILITY
 * is where it always was; what went is the shortcut.
 *
 * ===========================================================================
 * WHAT STILL MATTERS, AND IS THEREFORE STILL HERE
 * ===========================================================================
 *
 * The mode still reaches the rail. That was never the caption's doing: the mode picks
 * WHICH target row is drawn and WHAT UNIT it is spelled in, and both of those are the
 * defect this suite was built for. Set hot water to stop at weight and the well must read
 * grams, not millilitres — same field, same band, different quantity. So the read half is
 * kept in full and the press half is gone with the button.
 *
 * AND THE ABSENCE IS ASSERTED, not assumed. A caption that came back would be a control
 * with no wiring behind it: `stop-mode-change` has no emitter and no listener any more, and
 * `gate-wire` reports zero dead wires only while both halves stay removed.
 *
 * ===========================================================================
 * WHY THE GATES FIXTURE AND NOT THE SHELL FIXTURE
 * ===========================================================================
 *
 * `live-gates-fixture.js` builds the shipping stores over a SCRIPTED TRANSPORT that records
 * every call with its BODY, and serves the recorded `tools/rea-fixtures/` documents as the
 * default answers. Same recorded bytes as the shell fixture, so the two instruments cannot
 * disagree about what a machine serves.
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
                /* THE MILK PROBE IS AN R3 SENSOR ANSWER and this fixture's capability read
                 * answers 500, so the option is fail-closed by default — correctly, since an
                 * unknown capability is not a probe. */
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

        /* -- 1. THE MODE STILL REACHES THE RAIL ------------------------------ */

        test('the hot-water TARGET is spelled in the unit the stop mode means', () => mounted(async (page) => {
            /* ONE FIELD, TWO READINGS. `hotWaterVolume` is millilitres under a volume stop
             * and grams under a weight stop — same number, same band, different quantity —
             * and the settings page has said so in `variants` since that leaf was built.
             *
             * THIS IS NOW THE WHOLE OF WHAT THE RAIL SAYS ABOUT THE MODE, which is why it
             * carries more weight than it did when a caption said it in words too. Ben's
             * case for dropping the caption was that the unit already tells the two apart;
             * this is the assertion that keeps that true. */
            const unit = await page.evalFn((sel) => window.__h.q(sel).getAttribute('unit'),
                `${S} >>> ui-stepper[data-row="water-stop-target"]`);
            assert.equal(unit, 'g', 'the pour ends on the scale and the well says millilitres');
        }));

        /* -- 2. AND THE WITHDRAWN CONTROL STAYS WITHDRAWN -------------------- */

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
            /* THE CAPTION WENT; THE HEADING DID NOT. STEAM and HOT WATER are the rail's own
             * section names and the caption was a second line UNDER them, so a removal that
             * took the heading with it would have left two unnamed rows. */
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
