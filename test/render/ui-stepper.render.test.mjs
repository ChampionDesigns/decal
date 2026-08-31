/**
 * the render harness for.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH, FLOOR } from '../harness/index.js';
import {
    assertTokenDrill,
    assertFocusUnclipped,
    assertHitFloor,
    DRILL_COLOUR,
} from '../harness/assertions.js';

const MODULE = ['/src/components/ui-stepper.js'];

const STAGE = 'inline-size: 268px;';

const one = (attrs = '', style = STAGE) => `
<div id="stage" style="${style}">
  <ui-stepper id="s" label="Steam temperature" unit="°C" value="155" ${attrs}></ui-stepper>
</div>`;

const RANGED = one('min="135" max="165" step="1"');
const PLAIN = one('');
const EDITABLE = one('editable min="135" max="165"');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const px = (v) => parseFloat(v);

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-stepper @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (markup, fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULE);
            assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
            return fn(page);
        });
        const plain = (fn) => mounted(PLAIN, fn);
        const ranged = (fn) => mounted(RANGED, fn);
        const editable = (fn) => mounted(EDITABLE, fn);

        test('the emulated geometry is the one the suite asked for', () => plain(async (page) => {
            const env = JSON.parse(await page.eval(
                'JSON.stringify({dpr: devicePixelRatio, w: innerWidth, h: innerHeight})',
            ));
            assert.deepEqual(env, {
                dpr: geometry.deviceScaleFactor,
                w: geometry.width,
                h: geometry.height,
            });
        }));

        test('at a 268px container the control is 78 / 110 / 78 and 64 tall', () => plain(async (page) => {
            const band = await page.box('#s >>> .band');
            const dec = await page.box('#s >>> #decrement');
            const val = await page.box('#s >>> #value');
            const inc = await page.box('#s >>> #increment');

            assert.equal(Math.round(band.width), 268, 'the band fills its 268px container');
            assert.equal(Math.round(band.height), 64, 'one control height, --ui-control-h');
            assert.equal(Math.round(dec.width), 78, 'the minus cap is --ui-stepper-cap');
            assert.equal(Math.round(inc.width), 78, 'the plus cap is --ui-stepper-cap');
            assert.equal(Math.round(val.width), 110, 'the value cell is the oracle 110');
            assert.equal(Math.round(dec.height), 62, '--ui-control-inner');
            assert.equal(Math.round(val.height), 62, '--ui-control-inner');
            assert.equal(Math.round(inc.height), 62, '--ui-control-inner');
        }));

        test('one continuous instrument: seams, not gaps', () => plain(async (page) => {
            const dec = await page.box('#s >>> #decrement');
            const val = await page.box('#s >>> #value');
            const inc = await page.box('#s >>> #increment');
            assert.ok(Math.abs(val.left - dec.right) < 0.5, 'no gap between the minus cap and the value');
            assert.ok(Math.abs(inc.left - val.right) < 0.5, 'no gap between the value and the plus cap');
        }));

        test('the seam is drawn once, by the component, on each cap (L9, structurally)', () => plain(async (page) => {
            const shadows = await page.computed('#s >>> #decrement', ['box-shadow']);
            assert.match(shadows['box-shadow'], /inset/, 'the seam is an inset shadow');
            assert.match(shadows['box-shadow'], /-1px/, 'one hairline, offset inward');

            const plus = await page.prop('#s >>> #increment', 'box-shadow');
            assert.match(plus, /inset/);
            assert.ok(!/-1px/.test(plus), 'the plus cap draws its seam on the other side');

            await page.evalFn(() => {
                const s = document.createElement('style');
                s.textContent = '.cap, #decrement { border-right: 4px solid red !important; }';
                document.head.append(s);
            });
            await page.settle(1);
            const after = await page.prop('#s >>> #decrement', 'border-right-width');
            assert.equal(after, '0px', 'no outer sheet can add a second drawer of the seam');
        }));

        test('the seam and the outer corners are NAMED, not positional', () => ranged(async (page) => {
            const plus = await page.computed('#s >>> #increment', [
                'box-shadow', 'border-top-right-radius', 'border-bottom-right-radius',
            ]);
            assert.match(plus['box-shadow'], /inset/, 'the plus cap still draws its seam');
            assert.equal(plus['border-top-right-radius'], '6px', 'and still carries the outer corner');
            assert.equal(plus['border-bottom-right-radius'], '6px');

            const hidden = await page.evalFn(
                () => document.querySelector('#s').shadowRoot.querySelector('.band').lastElementChild.id,
            );
            assert.equal(hidden, 'range', 'the fourth child that broke it is the range hint');
        }));

        test('drill: --ui-key moves the band face', () => plain(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-key',
                value: DRILL_COLOUR,
                selector: '#s >>> .band',
                property: 'background-color',
            });
        }));

        test('drill: --ui-line moves the band edge, --ui-border-w its width', () => plain(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-line',
                value: DRILL_COLOUR,
                selector: '#s >>> .band',
                property: 'border-top-color',
            });
            const w = await assertTokenDrill(page, {
                token: '--ui-border-w',
                value: '5px',
                selector: '#s >>> .band',
                property: 'border-top-width',
                expectLanding: false,
            });
            assert.equal(w.before, '1px', 'one hairline at rest');
            assert.equal(w.after, '5px');
        }));

        test('drill: --ui-radius moves the band corner', () => plain(async (page) => {
            const r = await assertTokenDrill(page, {
                token: '--ui-radius',
                value: '13px',
                selector: '#s >>> .band',
                property: 'border-top-left-radius',
            });
            assert.equal(r.before, '6px', 'the oracle radius');
        }));

        test('drill: the cap corner follows the same radius, because the band no longer clips', () => plain(async (page) => {
            const cap = await page.computed('#s >>> #decrement', ['border-top-left-radius', 'border-top-right-radius']);
            assert.equal(cap['border-top-left-radius'], '6px', 'the outer corner is the band radius');
            assert.equal(cap['border-top-right-radius'], '0px', 'the inner corner is square - it meets the value cell');
            assert.equal(
                await page.prop('#s >>> .band', 'overflow-x'), 'visible',
                'the band clips nothing: section 2.4 names .slate-stepper (:549) on the ' +
                '"hidden is the default answer everywhere" list',
            );
        }));

        test('drill: --ui-muted moves the cap glyph and the unit ink', () => plain(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-muted',
                value: DRILL_COLOUR,
                selector: '#s >>> #decrement',
                property: 'color',
            });
            await assertTokenDrill(page, {
                token: '--ui-muted',
                value: DRILL_COLOUR,
                selector: '#s >>> #unit',
                property: 'color',
            });
        }));

        test('the default cap content is a 24px SVG glyph, not text', () => plain(async (page) => {
            const icon = parseFloat(await page.resolveValue('var(--ui-icon)', 'width'));
            const caps = await page.evalFn(() => {
                const root = document.querySelector('#s').shadowRoot;
                return ['decrement', 'increment'].map((id) => {
                    const cap = root.querySelector(`#${id}`);
                    const svg = cap.querySelector('svg');
                    const box = svg && svg.getBoundingClientRect();
                    return {
                        id,
                        text: cap.textContent.replace(/\s+/g, ''),
                        hasSvg: !!svg,
                        display: svg ? getComputedStyle(svg).display : null,
                        width: box ? +box.width.toFixed(2) : null,
                        height: box ? +box.height.toFixed(2) : null,
                        paths: svg ? svg.querySelectorAll('path').length : 0,
                        slots: cap.querySelectorAll('slot').length,
                    };
                });
            });

            for (const cap of caps) {
                assert.equal(cap.text, '',
                    `#${cap.id} draws the text "${cap.text}" — Slate's default cap is a glyph, and `
                    + '116 of the corpus\'s 144 caps render empty text because the mark is an SVG');
                assert.ok(cap.hasSvg, `#${cap.id} has no <svg> in it at all`);
                assert.equal(cap.display, 'block',
                    `#${cap.id}'s glyph is display:${cap.display}sets block`);
                assert.ok(Math.abs(cap.width - icon) < 0.51,
                    `#${cap.id}'s glyph is ${cap.width}px wide against --ui-icon ${icon} `
                    + '(Slate sizes it var(--slate-space-5) = 24px)');
                assert.ok(Math.abs(cap.height - icon) < 0.51,
                    `#${cap.id}'s glyph is ${cap.height}px tall against --ui-icon ${icon}`);
                assert.ok(cap.paths >= 1, `#${cap.id}'s glyph draws no path`);
                assert.equal(cap.slots, 1,
                    `#${cap.id} has ${cap.slots} slots — the override stays expressible, exactly one way`);
            }
        }));

        test('drill: --ui-text-xl sizes the cap glyph', () => plain(async (page) => {
            const d = await assertTokenDrill(page, {
                token: '--ui-text-xl',
                value: '37px',
                selector: '#s >>> #decrement',
                property: 'font-size',
            });
            assert.equal(d.before, '28px', 'the oracle size');
        }));

        test('drill: --ui-text moves the value ink and --ui-display-xs sizes it', () => plain(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text',
                value: DRILL_COLOUR,
                selector: '#s >>> #value',
                property: 'color',
            });
            const size = await assertTokenDrill(page, {
                token: '--ui-display-xs',
                value: '37px',
                selector: '#s >>> #value',
                property: 'font-size',
            });
            assert.equal(size.before, '27px');
        }));

        test('the unit is Slate\'s 14, stated once, and --ui-tracking-unit opens it',
            () => plain(async (page) => {
                const size = await page.computed('#s >>> #unit', ['font-size']);
                assert.equal(size['font-size'], '14px',
                    'Slate\'s settings unit, and exactly half the 27px value beside it');

                const drilled = await assertTokenDrill(page, {
                    token: '--ui-text-md',
                    value: '37px',
                    selector: '#s >>> #unit',
                    property: 'font-size',
                    expectMove: false,
                });
                assert.equal(drilled.after, '14px',
                    'and it does NOT follow --ui-text-md — that is the whole of the choice');

                const tracked = await page.computed('#s >>> #unit', ['letter-spacing', 'font-size']);
                assert.ok(Math.abs(parseFloat(tracked['letter-spacing'])
                    - 0.03 * parseFloat(tracked['font-size'])) < 0.02,
                    `the unit tracks ${tracked['letter-spacing']} against --ui-tracking-unit (.03em) `
                    + `on its own rendered ${tracked['font-size']}`);
            }));

        test('drill: --ui-seam-ink moves both the seam and the value face', () => plain(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-seam-ink',
                value: 'rgb(0, 255, 0)',
                selector: '#s >>> #value',
                property: 'background-color',
                expected: 'color(srgb 0 1 0 / 0.55)',
            });
            await assertTokenDrill(page, {
                token: '--ui-seam-ink',
                value: DRILL_COLOUR,
                selector: '#s >>> #decrement',
                property: 'box-shadow',
                expectLanding: false,
            });
        }));

        test('drill: --ui-control-h moves the band, --ui-control-inner the cells', () => plain(async (page) => {
            const band = await assertTokenDrill(page, {
                token: '--ui-control-h',
                value: '91px',
                selector: '#s >>> .band',
                property: 'min-block-size',
            });
            assert.equal(band.before, '64px');
            const cell = await page.prop('#s >>> #value', 'block-size');
            assert.equal(cell, '62px');
        }));

        test('drill: --ui-stepper-cap is the ONE cap value (section 3.1, four values resolved to one)', () => plain(async (page) => {
            const d = await assertTokenDrill(page, {
                token: '--ui-stepper-cap',
                value: '91px',
                selector: '#s >>> #decrement',
                property: 'inline-size',
            });
            assert.equal(d.before, '78px', 'the resolved value');
            assert.equal(d.after, '91px');
            const plus = await page.prop('#s >>> #increment', 'inline-size');
            assert.equal(plus, '78px', 'both caps read the same token, restored together');
        }));

        test('Appendix 5: a cap retargeted under the hit floor still RENDERS at the floor', () => plain(async (page) => {
            await page.setToken('--ui-stepper-cap', '20px');
            const dec = await page.box('#s >>> #decrement');
            await page.setToken('--ui-stepper-cap', null);
            assert.equal(Math.round(dec.width), 48, '--ui-hit-min is a floor, not a suggestion');
        }));

        test('the four selection dials reach nothing in this component', () => editable(async (page) => {
            const PARTS = ['#s >>> .band', '#s >>> #decrement', '#s >>> #value', '#s >>> #increment', '#s >>> #unit'];
            const PROPS = ['background-color', 'color', 'box-shadow', 'text-shadow', 'font-weight'];

            const read = async () => {
                const out = {};
                for (const p of PARTS) out[p] = await page.computed(p, PROPS);
                return out;
            };

            const before = await read();
            await page.setToken('--ui-selected-face', DRILL_COLOUR);
            await page.setToken('--ui-selected-ink', 'rgb(0, 255, 0)');
            await page.setToken('--ui-selected-led', '37px');
            await page.setToken('--ui-selected-glow', '60%');
            const during = await read();
            for (const t of ['--ui-selected-face', '--ui-selected-ink', '--ui-selected-led', '--ui-selected-glow']) {
                await page.setToken(t, null);
            }
            assert.deepEqual(during, before, 'no part of this component reads a selection dial');
        }));

        test('no element in the shadow tree carries a selection state', () => editable(async (page) => {
            const found = await page.evalFn(() => {
                const root = document.querySelector('#s').shadowRoot;
                const sel = '[aria-pressed="true"],[aria-selected="true"],[aria-checked="true"],'
                    + '[aria-current="true"],.is-selected';
                return [...root.querySelectorAll(sel)].map((el) => el.id || el.className);
            });
            assert.deepEqual(found, [], 'a stepper has no selected state to express');
        }));

        test('focus: the minus cap rings at the token geometry, unclipped', () => plain(async (page) => {
            const g = await assertFocusUnclipped(page, '#s >>> #decrement');
            assert.equal(g.clippers.filter((c) => c.sides).length, 0);
        }));

        test('focus: the plus cap and an editable value cell too', () => editable(async (page) => {
            await assertFocusUnclipped(page, '#s >>> #increment');
            await assertFocusUnclipped(page, '#s >>> #value');
        }));

        test('focus: the ring inside the band is the INSET offset, not a third treatment', () => plain(async (page) => {
            await page.focusVisible('#s >>> #decrement');
            const g = await page.focusGeometry('#s >>> #decrement');
            const inset = await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset');
            assert.equal(g.outlineOffset, inset);
            const width = await page.resolveValue('var(--ui-focus-w)', 'outline-width');
            assert.equal(g.outlineWidth, width, 'one width, from --ui-focus-w');
        }));

        test('C3: density="compact" moves the caps and nothing else', () => mounted(
            one('density="compact"'), async (page) => {
                const dec = await page.box('#s >>> #decrement');
                const val = await page.box('#s >>> #value');
                const band = await page.box('#s >>> .band');
                assert.equal(Math.round(dec.width), 64, 'the editor\'s number, as a named density');
                assert.equal(Math.round(dec.height), 62, 'the height is NOT a density concern');
                assert.equal(Math.round(band.height), 64, 'nor is the row height');
                assert.equal(Math.round(val.width), 138, '268 - 2 - 64 - 64: the value takes the slack');
            },
        ));

        test('C3: the compact cap is derived from --ui-control-h, not typed', () => mounted(
            one('density="compact"'), async (page) => {
                await page.setToken('--ui-control-h', '91px');
                const dec = await page.box('#s >>> #decrement');
                await page.setToken('--ui-control-h', null);
                assert.equal(Math.round(dec.width), 91, 'one edit moves the row height and the compact cap together');
            },
        ));

        test('C3: compact is 28px per step cheaper, which is OQ-4\'s whole arithmetic', () => mounted(`
<div id="stage" style="inline-size: 1400px;">
  <div style="display: flex;">
    ${[0, 1, 2, 3, 4].map((i) => `<ui-stepper id="r${i}" unit="mL/s" value="2.1" step="0.1"></ui-stepper>`).join('')}
  </div>
  <div style="display: flex;">
    ${[0, 1, 2, 3, 4].map((i) => `<ui-stepper id="c${i}" density="compact" unit="mL/s" value="2.1" step="0.1"></ui-stepper>`).join('')}
  </div>
</div>`, async (page) => {
            const regular = await page.box('#r0');
            const compact = await page.box('#c0');
            assert.equal(Math.round(regular.width), 268, 'the resolved cap, twice, plus the cell');
            assert.equal(Math.round(compact.width), 240, '268 - 2 x 14');
            assert.equal(
                Math.round(5 * (regular.width - compact.width)), 140,
                'five steps: 140px, and the value cell never pays for it',
            );
            assert.equal(Math.round((await page.box('#c4 >>> #value')).width), 110,
                'the number keeps its measured cell in every column');
        }));

        test('B2: with no min and no max the control is genuinely unbounded', () => plain(async (page) => {
            const value = await page.evalFn(async () => {
                const el = document.querySelector('#s');
                for (let i = 0; i < 60; i += 1) el.shadowRoot.querySelector('#increment').click();
                await el.updateComplete;
                return el.value;
            });
            assert.equal(value, 215, '155 + 60 steps, with nothing in the component to stop it');

            const caps = await page.evalFn(() => {
                const r = document.querySelector('#s').shadowRoot;
                return {
                    minus: r.querySelector('#decrement').getAttribute('aria-disabled'),
                    plus: r.querySelector('#increment').getAttribute('aria-disabled'),
                };
            });
            assert.deepEqual(caps, { minus: null, plus: null }, 'no stated end, no disabled end');
        }));

        test('B2: stated limits are DATA - they clamp, disable and describe', () => ranged(async (page) => {
            const atTop = await page.evalFn(async () => {
                const el = document.querySelector('#s');
                for (let i = 0; i < 40; i += 1) el.shadowRoot.querySelector('#increment').click();
                await el.updateComplete;
                return {
                    value: el.value,
                    plus: el.shadowRoot.querySelector('#increment').getAttribute('aria-disabled'),
                    minus: el.shadowRoot.querySelector('#decrement').getAttribute('aria-disabled'),
                };
            });
            assert.deepEqual(atTop, { value: 165, plus: 'true', minus: null },
                'clamped at the stated max, and the cap that does nothing stops looking live');

            const dim = await page.prop('#s >>> #increment', 'opacity');
            const dial = await page.resolveValue('var(--ui-opacity-disabled)', 'opacity');
            assert.equal(dim, dial, 'one dial, --ui-opacity-disabled');
        }));

        test('B2: the range hint is read from the same two properties that clamp', () => ranged(async (page) => {
            const hint = () => page.evalFn(() => {
                const r = document.querySelector('#s').shadowRoot;
                const el = r.querySelector('#range');
                return el ? el.textContent : null;
            });
            assert.equal(await hint(), 'Range 135 to 165 °C');

            await page.evalFn(async () => {
                const el = document.querySelector('#s');
                el.max = 160;               // a DE1 rather than a Bengle 
                await el.updateComplete;
            });
            assert.equal(await hint(), 'Range 135 to 160 °C', 'the label cannot claim a stale range');

            await page.evalFn(async () => {
                const el = document.querySelector('#s');
                el.min = null; el.max = null;
                await el.updateComplete;
            });
            assert.equal(await hint(), null, 'no limits stated, no range claimed');
        }));

        test('B2: a supplied step function decides, including over a hole', () => plain(async (page) => {
            const seen = await page.evalFn(async () => {
                const el = document.querySelector('#s');
                el.value = 0;
                el.next = (v, dir) => (dir > 0 && v === 0 ? 135 : v + dir);
                await el.updateComplete;
                el.shadowRoot.querySelector('#increment').click();
                await el.updateComplete;
                const jumped = el.value;
                el.shadowRoot.querySelector('#increment').click();
                await el.updateComplete;
                return { jumped, then: el.value };
            });
            assert.deepEqual(seen, { jumped: 135, then: 136 },
                'the hole is skipped by the supplied function, not by anything in here');
        }));

        test('the caps step, and `change` crosses the shadow boundary', () => ranged(async (page) => {
            await page.recordEvents('#stage', ['change']);
            await page.click('#s >>> #increment');
            await page.click('#s >>> #increment');
            await page.click('#s >>> #decrement');
            await page.settle(2);
            const events = await page.recordedEvents();
            assert.equal(events.length, 3, 'three presses, three events, heard OUTSIDE the host');
            assert.deepEqual(events.map((e) => e.detail.value), [156, 157, 156]);
            assert.deepEqual(events.at(-1).detail, { value: 156, previous: 157, direction: -1 });
            assert.equal(await page.evalFn(() => document.querySelector('#s').value), 156);
        }));

        test('decimals come from the step, never from floating point', () => mounted(`
<div id="stage" style="${STAGE}">
  <ui-stepper id="s" label="Flow" unit="mL/s" value="2.1" step="0.1"></ui-stepper>
</div>`, async (page) => {
                const text = await page.evalFn(async () => {
                    const el = document.querySelector('#s');
                    el.shadowRoot.querySelector('#increment').click();
                    await el.updateComplete;
                    return { value: el.value, shown: el.shadowRoot.querySelector('#number').textContent };
                });
                assert.deepEqual(text, { value: 2.2, shown: '2.2' });
        }));

        test('a cap at a range end does nothing and says nothing', () => ranged(async (page) => {
            await page.evalFn(async () => {
                const el = document.querySelector('#s');
                el.value = 135;
                await el.updateComplete;
            });
            await page.recordEvents('#stage', ['change']);
            await page.click('#s >>> #decrement');
            await page.settle(2);
            assert.deepEqual(await page.recordedEvents(), [], 'no event from a cap that is at its end');
            assert.equal(await page.evalFn(() => document.querySelector('#s').value), 135);
        }));

        test('keyboard: arrows step, Home and End only where a limit is stated', () => ranged(async (page) => {
            await page.focusVisible('#s >>> #increment');
            await page.press('ArrowUp');
            await page.settle(1);
            assert.equal(await page.evalFn(() => document.querySelector('#s').value), 156);
            await page.press('ArrowDown');
            await page.press('ArrowDown');
            await page.settle(1);
            assert.equal(await page.evalFn(() => document.querySelector('#s').value), 154);
            await page.press('End');
            await page.settle(1);
            assert.equal(await page.evalFn(() => document.querySelector('#s').value), 165, 'End is the STATED max');
            await page.press('Home');
            await page.settle(1);
            assert.equal(await page.evalFn(() => document.querySelector('#s').value), 135);
        }));

        test('keyboard: Home and End do nothing when no limit is stated (B2)', () => plain(async (page) => {
            await page.focusVisible('#s >>> #increment');
            await page.press('End');
            await page.press('Home');
            await page.settle(1);
            assert.equal(
                await page.evalFn(() => document.querySelector('#s').value), 155,
                'there is no end to jump to, and the component does not invent one',
            );
        }));

        test('an editable value cell reports the press and opens nothing itself', () => editable(async (page) => {
            await page.recordEvents('#stage', ['edit']);
            await page.click('#s >>> #value');
            await page.settle(2);
            const events = await page.recordedEvents();
            assert.equal(events.length, 1);
            assert.deepEqual(events[0].detail, { value: 155 });
        }));

        test('disabled: one dial on the host, behaviour on the controls, no compounding', () => mounted(
            one('disabled min="135" max="165"'), async (page) => {
                const dial = await page.resolveValue('var(--ui-opacity-disabled)', 'opacity');
                assert.equal(await page.prop('#s', 'opacity'), dial, 'the host carries the dial');
                assert.equal(
                    await page.prop('#s >>> #decrement', 'opacity'), '1',
                    'the cap opts out, or .38 x .38 = .14 - three times fainter than every other disabled control',
                );
                assert.equal(
                    await page.evalFn(() => document.querySelector('#s').shadowRoot.querySelector('#increment').disabled),
                    true, 'paint is not behaviour: the native attribute is what stops input',
                );
                await page.recordEvents('#stage', ['change']);
                await page.click('#s >>> #increment');
                await page.settle(2);
                assert.deepEqual(await page.recordedEvents(), []);
            },
        ));

        test('aria: the control is a named group and each cap says what it does', () => ranged(async (page) => {
            const aria = await page.evalFn(() => {
                const r = document.querySelector('#s').shadowRoot;
                const band = r.querySelector('.band');
                return {
                    role: band.getAttribute('role'),
                    name: band.getAttribute('aria-label'),
                    describedBy: band.getAttribute('aria-describedby'),
                    hint: r.querySelector('#range')?.textContent ?? null,
                    minus: r.querySelector('#decrement').getAttribute('aria-label'),
                    plus: r.querySelector('#increment').getAttribute('aria-label'),
                };
            });
            assert.deepEqual(aria, {
                role: 'group',
                name: 'Steam temperature',
                describedBy: 'range',
                hint: 'Range 135 to 165 °C',
                minus: 'Decrease Steam temperature',
                plus: 'Increase Steam temperature',
            });
        }));

        test('aria: an editable cell is named with its value and promises the dialog', () => editable(async (page) => {
            const cell = await page.evalFn(() => {
                const el = document.querySelector('#s').shadowRoot.querySelector('#value');
                return {
                    tag: el.tagName,
                    name: el.getAttribute('aria-label'),
                    popup: el.getAttribute('aria-haspopup'),
                    live: el.getAttribute('aria-live'),
                };
            });
            assert.deepEqual(cell, {
                tag: 'BUTTON',
                name: 'Steam temperature, 155 °C',
                popup: 'dialog',
                live: 'polite',
            });
        }));

        test('L22: the value cell is reachable, or it is not a control at all', () => plain(async (page) => {
            const readonlyCell = await page.evalFn(() => {
                const el = document.querySelector('#s').shadowRoot.querySelector('#value');
                return { tag: el.tagName, tabindex: el.getAttribute('tabindex') };
            });
            assert.deepEqual(readonlyCell, { tag: 'DIV', tabindex: null },
                'not editable: a readout, with no tabindex at all - not -1');

            await page.evalFn(async () => {
                const el = document.querySelector('#s');
                el.editable = true;
                await el.updateComplete;
            });
            const reachable = await page.evalFn(() => {
                const el = document.querySelector('#s').shadowRoot.querySelector('#value');
                el.focus();
                return el.tagName === 'BUTTON' && el.shadowRoot === null
                    && document.querySelector('#s').shadowRoot.activeElement === el;
            });
            assert.ok(reachable, 'editable: a real button, and it takes focus');
        }));

        test('Appendix 5: every target clears --ui-hit-min on both axes', () => editable(async (page) => {
            for (const part of ['#decrement', '#value', '#increment']) {
                const m = await assertHitFloor(page, `#s >>> ${part}`, { mode: 'box' });
                assert.ok(m.inline >= 48 && m.block >= 48, `${part} ${m.inline}x${m.block}`);
            }
        }));

        test('the container floor: the control holds its size and overflows where it shows', () => mounted(
            one('', 'inline-size: 160px;'), async (page) => {
                const host = await page.box('#s');
                const dec = await page.box('#s >>> #decrement');
                const val = await page.box('#s >>> #value');
                assert.equal(Math.round(host.width), 268, '78 + 110 + 78 + 2 = the stated floor');
                assert.equal(Math.round(dec.width), 78, 'the cap is the token whatever the container does');
                assert.equal(Math.round(val.width), 110, 'the number keeps its measured cell');
            },
        ));

        test('the container, not the viewport: a 268px box is a 268px control', () => mounted(`
<div style="inline-size: 268px"><ui-stepper id="a" value="93" unit="°C"></ui-stepper></div>
<div style="inline-size: 420px"><ui-stepper id="b" value="93" unit="°C"></ui-stepper></div>`,
        async (page) => {
            const a = await page.box('#a >>> .band');
            const b = await page.box('#b >>> .band');
            assert.equal(Math.round(a.width), 268);
            assert.equal(Math.round(b.width), 420);
            assert.equal(Math.round((await page.box('#a >>> #decrement')).width), 78, 'the cap is a token, not a fraction');
            assert.equal(Math.round((await page.box('#b >>> #decrement')).width), 78);
            assert.equal(
                Math.round((await page.box('#b >>> #value')).width), 262,
                'the value cell takes the slack: 420 - 2 - 78 - 78',
            );
        }));

        test('a value too long for its cell says so, and stays in the accessible name', () => mounted(
            one('editable'), async (page) => {
                const state = await page.evalFn(async () => {
                    const el = document.querySelector('#s');
                    el.format = () => '40g (1:2.4) and a great deal more besides';
                    await el.updateComplete;
                    const cell = el.shadowRoot.querySelector('#value');
                    return {
                        overflows: cell.scrollWidth > cell.clientWidth,
                        name: cell.getAttribute('aria-label'),
                    };
                });
                assert.ok(state.overflows, 'the text is longer than the cell');
                assert.equal(await page.prop('#s >>> #value', 'text-overflow'), 'ellipsis',
                    'the one form of clipping that tells you it happened');
                assert.match(state.name, /a great deal more besides/,
                    'nothing is removed from the accessible name');
            },
        ));

        test('no !important survives anywhere in this component', () => plain(async (page) => {
            await page.setStyle('#s', { '--ui-stepper-cap': '91px' });
            const dec = await page.box('#s >>> #decrement');
            await page.setStyle('#s', { '--ui-stepper-cap': null });
            assert.equal(Math.round(dec.width), 91, 'a consumer retargets through the token, with no fight');
        }));
    });
}

test('the bench and the floor render the same control', async () => {
    const read = (geometry) => browser.withPage({ geometry }, async (page) => {
        await page.mount(RANGED, MODULE);
        return {
            dpr: await page.eval('devicePixelRatio'),
            band: (await page.box('#s >>> .band')).width,
            height: (await page.box('#s >>> .band')).height,
            cap: (await page.box('#s >>> #decrement')).width,
            value: (await page.box('#s >>> #value')).width,
            valueSize: await page.prop('#s >>> #value', 'font-size'),
            unitSize: await page.prop('#s >>> #unit', 'font-size'),
        };
    });

    const bench = await read(BENCH);
    const floor = await read(FLOOR);

    assert.equal(bench.dpr, 1.5);
    assert.equal(floor.dpr, 1);
    assert.deepEqual(
        { ...bench, dpr: null }, { ...floor, dpr: null },
        'every number in this control comes from its own container and the token sheet',
    );
    assert.equal(bench.cap, 78);
    assert.equal(px(bench.height), 64);
});

test('the control inverts with the theme, and lands on the oracle in both', async () => {
    const read = (theme) => browser.withPage({ geometry: BENCH, theme }, async (page) => {
        await page.mount(PLAIN, MODULE);
        return page.computed('#s >>> .band', ['background-color', 'border-top-color']);
    });

    const dark = await read('dark');
    const light = await read('light');

    assert.deepEqual(dark, {
        'background-color': 'rgb(26, 33, 39)',
        'border-top-color': 'rgb(58, 72, 82)',
    });
    assert.deepEqual(light, {
        'background-color': 'rgb(248, 249, 249)',
        'border-top-color': 'rgb(203, 208, 211)',
    });
});

test('the value face is --ui-seam-ink at 55% in BOTH themes, to six decimals', async () => {
    const read = (theme) => browser.withPage({ geometry: BENCH, theme }, async (page) => {
        await page.mount(PLAIN, MODULE);
        return page.prop('#s >>> #value', 'background-color');
    });

    assert.match(await read('dark'), /^color\(srgb 0\.760784 0\.815686 0\.854902 \/ 0\.0(9|93)/);
    assert.match(await read('light'), /^color\(srgb 0\.117647 0\.164706 0\.196078 \/ 0\.0(6|60)/);
});
