/**
 * ui-stepper.render.test.mjs - Gate A for Wave 2 item #4 (Stepper).
 *
 * Runs the whole rig at BOTH standard geometries - 1281x801 @ dsf 1.5 (the bench
 * truth) and the 1000x600 floor - and asserts only on computed style, box geometry
 * and behaviour, never on source text (SCOPE Part 8 section 2).
 *
 * WHAT EACH GROUP IS FOR
 *   1. the oracle geometry, reproduced exactly: at a 268px container the control is
 *      78 / 110 / 78 with two hairlines, which is what `prov_query.py find
 *      --cls slate-stepper` measures in all 85 elements across 16 states;
 *   2. tokens are consumed, not copied - every appearance value the oracle measured,
 *      drilled through :root;
 *   3. THE WAVE LAW, in its negative form. This component has no selected state, so
 *      all four selection dials must reach nothing in it and no element in the shadow
 *      tree may carry a selection state. The founding defect was a component quietly
 *      growing a seventh selected look; this is the assertion that makes it visible;
 *   4. focus geometry from --ui-focus-*, unclipped - bug L24, whose two named clippers
 *      include this exact control (`.slate-stepper { overflow: hidden }`);
 *   5. C3 - one cap value, and `compact` as a NAMED density rather than the editor's
 *      private 64px;
 *   6. B2 - the component owns no limits. Unstated is unbounded, stated limits are
 *      data, and the supplied step function decides when there is one;
 *   7. behaviour and the events that cross the shadow boundary;
 *   8. the aria contract (spec Appendix 15) and bug L22's value-cell half;
 *   9. the hit floor (Appendix 5) and the container floor (section 2.4), both measured
 *      on the rendered box rather than read off a rule.
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

/* THE ORACLE'S OWN BOX. `prov_query.py find --cls slate-stepper` -> 85 elements in 16
 * states, ONE distinct geometry: 268 x 64. Every geometry assertion below is made
 * inside a container stated at that width, because a component reads its container and
 * not the window (spec section 2.1 Rule 1). */
const STAGE = 'inline-size: 268px;';

const one = (attrs = '', style = STAGE) => `
<div id="stage" style="${style}">
  <ui-stepper id="s" label="Steam temperature" unit="°C" value="155" ${attrs}></ui-stepper>
</div>`;

/* A stated range, as `machine-limits.js` will hand one down. B3 moved the steam floor
 * to 135 and brought the ceiling DOWN to 165 on a Bengle - which is exactly why these
 * numbers live in the test's markup and not in the component. */
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

        /* -- 1. the oracle geometry, reproduced ---------------------------- */

        test('at a 268px container the control is 78 / 110 / 78 and 64 tall', () => plain(async (page) => {
            // ORACLE  prov_query.py find --cls slate-stepper -> "found 85 element(s) in
            //         16 state(s)", "distinct geometries (w x h), all matched elements:
            //         268 x 64  x85"; find --cls slate-stepper-value -> 85 elements,
            //         "110 x 62  x85"; settings-machine-steam <button> [i=51]
            //         rect x=1562 y=286 w=78 h=62.
            //         78 + 110 + 78 + 2 hairlines = 268, exactly.
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
            // Slate's own header at slate-components.css:540 - "minus / value / plus as
            // ONE CONTINUOUS INSTRUMENT, seams not gaps". Three boxes, no daylight.
            const dec = await page.box('#s >>> #decrement');
            const val = await page.box('#s >>> #value');
            const inc = await page.box('#s >>> #increment');
            assert.ok(Math.abs(val.left - dec.right) < 0.5, 'no gap between the minus cap and the value');
            assert.ok(Math.abs(inc.left - val.right) < 0.5, 'no gap between the value and the plus cap');
        }));

        test('the seam is drawn once, by the component, on each cap (L9, structurally)', () => plain(async (page) => {
            // ORACLE  settings-machine-steam <button> [i=51] box-shadow =
            //         rgba(194, 208, 218, 0.17) -1px 0px 0px 0px inset  <-
            //         slate-components.css `.slate-stepper > button:first-child`
            //         authored `inset calc(-1 * var(--slate-hairline)) 0 var(--slate-seam)`.
            const shadows = await page.computed('#s >>> #decrement', ['box-shadow']);
            assert.match(shadows['box-shadow'], /inset/, 'the seam is an inset shadow');
            assert.match(shadows['box-shadow'], /-1px/, 'one hairline, offset inward');

            const plus = await page.prop('#s >>> #increment', 'box-shadow');
            assert.match(plus, /inset/);
            assert.ok(!/-1px/.test(plus), 'the plus cap draws its seam on the other side');

            // L9 is "the seam drawn TWICE". A document rule cannot reach a cap to add a
            // second one - that is the shadow boundary, not a convention.
            await page.evalFn(() => {
                const s = document.createElement('style');
                s.textContent = '.cap, #decrement { border-right: 4px solid red !important; }';
                document.head.append(s);
            });
            await page.settle(1);
            const after = await page.prop('#s >>> #decrement', 'border-right-width');
            assert.equal(after, '0px', 'no outer sheet can add a second drawer of the seam');
        }));

        /* -- 2. tokens are consumed, not copied ---------------------------- */

        test('the seam and the outer corners are NAMED, not positional', () => ranged(async (page) => {
            // A live defect, caught in review and pinned here. Slate writes
            // `.slate-stepper > button:first-child / :last-child` because its band holds
            // exactly three children. This band holds a FOURTH whenever a range is
            // stated - the visually-hidden hint the group is described by - so a
            // positional selector stopped matching the plus cap the moment a limit
            // arrived, and the cap silently lost both its seam and its outer corner in
            // exactly the states that have a range. This fixture HAS a range.
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
            // ORACLE  settings-machine-steam .slate-stepper [i=50] background-color =
            //         rgb(26, 33, 39)  <-  slate-components.css `.slate-stepper`
            //         (token-driven).
            await assertTokenDrill(page, {
                token: '--ui-key',
                value: DRILL_COLOUR,
                selector: '#s >>> .band',
                property: 'background-color',
            });
        }));

        test('drill: --ui-line moves the band edge, --ui-border-w its width', () => plain(async (page) => {
            // ORACLE  settings-machine-steam .slate-stepper [i=50] border-top-color =
            //         rgb(58, 72, 82); border-top-width = 1px.
            await assertTokenDrill(page, {
                token: '--ui-line',
                value: DRILL_COLOUR,
                selector: '#s >>> .band',
                property: 'border-top-color',
            });
            // expectLanding: false because a border WIDTH is only half a border - the
            // harness resolves a drill value on a probe element with no border-style, so
            // 5px computes as 0px there. The landing is asserted here instead.
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
            // ORACLE  settings-machine-steam .slate-stepper [i=50]
            //         border-top-left-radius = 6px.
            const r = await assertTokenDrill(page, {
                token: '--ui-radius',
                value: '13px',
                selector: '#s >>> .band',
                property: 'border-top-left-radius',
            });
            assert.equal(r.before, '6px', 'the oracle radius');
        }));

        test('drill: the cap corner follows the same radius, because the band no longer clips', () => plain(async (page) => {
            // L24's other half. Slate reaches for `overflow: hidden` to keep the caps
            // inside the radius and cuts every focus ring in the process; the caps carry
            // the corners themselves here, so nothing needs clipping.
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
            // ORACLE  settings-machine-steam <button> [i=51] color = rgb(148, 161, 169)
            //         <- slate-components.css `.slate-stepper > button` authored
            //         `var(--slate-muted)`; .slate-stepper-unit [i=54] color =
            //         rgb(148, 161, 169) authored `var(--slate-muted)`.
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

        /**
         * THE DEFAULT CAP CONTENT IS SLATE'S 24px SVG GLYPH, AND NOTHING ELSE.
         *
         * Parity surface 0 replaced the text `−` / `+` with Slate's own inline paths;
         * its review then found that every cap test in this suite is a TOKEN DRILL,
         * and a token drill passes for a text glyph exactly as it does for an SVG one.
         * So the change that mattered most to the look of every stepper in the skin was
         * the one thing nothing here asserted. This is the pin, and it is written
         * against the RENDERED tree rather than the template: the slots stay, so a
         * caller may still put text in a cap (Slate's own two continuation steppers do),
         * and what is pinned is only what a caller who says nothing gets.
         *
         * SOURCE  slate-components.css:582-586 `.slate-stepper > button > svg {
         *         display: block; width: var(--slate-space-5) }` = 24px = --ui-icon.
         * CENSUS  144 stepper caps in prov-baseline/: 116 render EMPTY text (the SVG),
         *         28 render "−"/"+" and all 28 are the two hand-built continuation
         *         steppers on the Live rail. The SVG is the default; the text is the
         *         exception, and it is still expressible through the slot.
         */
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
                    `#${cap.id}'s glyph is display:${cap.display} — slate-components.css:582 sets block`);
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
            // ORACLE  settings-machine-steam <button> [i=51] font-size = 28px  <-
            //         slate-components.css `.slate-stepper > button` authored
            //         `var(--slate-text-xl)`.
            const d = await assertTokenDrill(page, {
                token: '--ui-text-xl',
                value: '37px',
                selector: '#s >>> #decrement',
                property: 'font-size',
            });
            assert.equal(d.before, '28px', 'the oracle size');
        }));

        test('drill: --ui-text moves the value ink and --ui-display-xs sizes it', () => plain(async (page) => {
            // ORACLE  settings-machine-steam .slate-stepper-value [i=52] color =
            //         rgb(244, 247, 248) authored `var(--slate-text)`; font-size = 27px
            //         authored `var(--slate-display-xs)`.
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
            // THE DEPARTURE IS GONE — parity surface 0. --ui-display-xs used to be
            // clamp(22px, 2.2cqi, 27px), and cqi resolves against THIS component's own
            // container: at the oracle's 268px control 2.2cqi is 5.9px, so the clamp sat
            // on its 22px floor and the value rendered FIVE PIXELS under the oracle
            // everywhere. The clamp's floors were LAYOUT_SPEC_DRAFT proposals that
            // wanted a bench look and never got one; its ceilings were Slate's declared
            // numbers. The token is now the fixed 27px, so this element lands on the
            // very oracle the token was derived from.
            assert.equal(size.before, '27px');
        }));

        test('the unit is Slate\'s 14, stated once, and --ui-tracking-unit opens it',
            () => plain(async (page) => {
                /* THIS DRILLED --ui-text-md UNTIL 26 AUGUST 2026, and the token had been
                 * taken off this element the day before — deliberately, by Ben.
                 *
                 * The two oracles disagree and always did:
                 *   ORACLE live-ready <small> [i=28] "g" font-size 18, tracking 0.54 —
                 *          Slate's LIVE RAIL treatment, 56 records.
                 *   ORACLE settings-machine-hot-water .slate-stepper-unit [i=78] 14px,
                 *          tracking normal — Slate's SETTINGS treatment, 20 records.
                 * One component cannot draw both, and the tie-break used to be the rail's.
                 *
                 * BEN CHOSE THE OTHER ONE (25 August 2026): "Use slates 14." The component
                 * records why the number is a literal rather than a token, and the reason
                 * is arithmetic the scale cannot express: `--ui-text-md` resolves to 18
                 * against our 27px value, so the unit read as two thirds of the reading
                 * instead of half of it, and a value with its unit looked like two numbers.
                 * The scale has 12 and 15 and nothing between, so rounding either way
                 * misses Slate by three pixels on a mark that sits beside every number in
                 * the skin.
                 *
                 * SO THE ASSERTION IS THE NUMBER AND ITS PROVENANCE, not a drill. A drill
                 * proves a value came from a token; there is no token to come from, and
                 * pinning the literal here is what stops it drifting back to 18. The
                 * TRACKING is still a token and is still drilled below. */
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
                    'and it does NOT follow --ui-text-md — that is the whole of Ben\'s choice');

                const tracked = await page.computed('#s >>> #unit', ['letter-spacing', 'font-size']);
                assert.ok(Math.abs(parseFloat(tracked['letter-spacing'])
                    - 0.03 * parseFloat(tracked['font-size'])) < 0.02,
                    `the unit tracks ${tracked['letter-spacing']} against --ui-tracking-unit (.03em) `
                    + `on its own rendered ${tracked['font-size']}`);
            }));

        test('drill: --ui-seam-ink moves both the seam and the value face', () => plain(async (page) => {
            // ORACLE  .slate-stepper-value [i=52] background-color =
            //         color(srgb 0.760784 0.815686 0.854902 / 0.0927451) [prov-baseline]
            //         / color(srgb 0.117647 0.164706 0.196078 / 0.0603922) [prov-light]
            //         - which is --ui-seam-ink at 55%, in both themes, to six decimals.
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
            // --ui-control-inner is DERIVED from --ui-control-h (calc(h - 2 * hairline)),
            // so one edit moves both and they can never disagree - which is the whole
            // point of section 3.1 declaring it derived rather than as a second literal.
            const cell = await page.prop('#s >>> #value', 'block-size');
            assert.equal(cell, '62px');
        }));

        test('drill: --ui-stepper-cap is the ONE cap value (section 3.1, four values resolved to one)', () => plain(async (page) => {
            // Slate has four: 92px global (renders nowhere), 78 on Live, 78 in Settings,
            // and a hard 64 in the editor's re-implementation. One token, one control.
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
            // Bug P4's exact shape is a comment claiming a floor the box does not have.
            // The floor is in the track - max(--ui-hit-min, cap) - so it cannot be
            // claimed and missing.
            await page.setToken('--ui-stepper-cap', '20px');
            const dec = await page.box('#s >>> #decrement');
            await page.setToken('--ui-stepper-cap', null);
            assert.equal(Math.round(dec.width), 48, '--ui-hit-min is a floor, not a suggestion');
        }));

        /* -- 3. THE WAVE LAW: the four dials reach nothing here ------------ */

        test('the four selection dials reach nothing in this component', () => editable(async (page) => {
            // Part 10 section 12: one selection treatment, through the four dials,
            // enforced by the shadow boundary. A stepper has no selected state, so it
            // must paint none - and a seventh selected look starting inside a control
            // that "obviously" has no selection is exactly how the first six happened.
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
            // The state contract is Slate's (spec Appendix 15): aria-pressed /
            // aria-selected / aria-checked / aria-current / .is-selected. A stepper
            // expresses none of them, so accessibility state and visual state agree by
            // having nothing to disagree about.
            const found = await page.evalFn(() => {
                const root = document.querySelector('#s').shadowRoot;
                const sel = '[aria-pressed="true"],[aria-selected="true"],[aria-checked="true"],'
                    + '[aria-current="true"],.is-selected';
                return [...root.querySelectorAll(sel)].map((el) => el.id || el.className);
            });
            assert.deepEqual(found, [], 'a stepper has no selected state to express');
        }));

        /* -- 4. focus, unclipped (bug L24) --------------------------------- */

        test('focus: the minus cap rings at the token geometry, unclipped', () => plain(async (page) => {
            // L24: "focus rings clipped on all four sides by the components they sit
            // inside" - and this control is one of the two named clippers,
            // "the +/- caps live inside .slate-stepper { overflow: hidden }"
            // (LAYOUT_SPEC_DRAFT.md:400-406).
            const g = await assertFocusUnclipped(page, '#s >>> #decrement');
            assert.equal(g.clippers.filter((c) => c.sides).length, 0);
        }));

        test('focus: the plus cap and an editable value cell too', () => editable(async (page) => {
            await assertFocusUnclipped(page, '#s >>> #increment');
            await assertFocusUnclipped(page, '#s >>> #value');
        }));

        test('focus: the ring inside the band is the INSET offset, not a third treatment', () => plain(async (page) => {
            // CONVENTIONS.md section 3: "two offsets, one treatment". A cap sits flush
            // against the band's border, so an outset ring would paint over the border
            // and over its neighbour. Same width, same ink, the documented second offset.
            await page.focusVisible('#s >>> #decrement');
            const g = await page.focusGeometry('#s >>> #decrement');
            const inset = await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset');
            assert.equal(g.outlineOffset, inset);
            const width = await page.resolveValue('var(--ui-focus-w)', 'outline-width');
            assert.equal(g.outlineWidth, width, 'one width, from --ui-focus-w');
        }));

        /* -- 5. C3: one cap value, and a NAMED compact density ------------- */

        test('C3: density="compact" moves the caps and nothing else', () => mounted(
            one('density="compact"'), async (page) => {
                // C3 (SCOPE.md:171): "Step-matrix caps become a named `compact` density,
                // not a private 64px". The editor's 64 is --ui-control-h, the row height
                // every control already shares, so the compact cap is a SQUARE cap and is
                // DERIVED rather than typed.
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
            // OQ-4, verbatim: "the editor's steps matrix packs N step columns across the
            // width, so 78px caps cost 28px per step against 64 - real money at five
            // steps". Two caps x 14px is 28px a step; five steps is 140px of matrix.
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

        /* -- 6. B2: the component owns no limits --------------------------- */

        test('B2: with no min and no max the control is genuinely unbounded', () => plain(async (page) => {
            // "exactly one limits table in the skin, never two" (SCOPE.md:3063). A
            // default ceiling here would BE a second table. The steam ceiling is 165 on a
            // Bengle (B3); this control walks straight past it because it has never heard
            // of steam.
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

            // "At a range end the button does nothing; it must not keep looking live.
            // (Steam sits pinned at 170/170 with a fully lit +.)" - Slate's own note at
            // slate-components.css:595-600, describing the bug it left in place.
            const dim = await page.prop('#s >>> #increment', 'opacity');
            const dial = await page.resolveValue('var(--ui-opacity-disabled)', 'opacity');
            assert.equal(dim, dial, 'one dial, --ui-opacity-disabled');
        }));

        test('B2: the range hint is read from the same two properties that clamp', () => ranged(async (page) => {
            // The carried machine-limits.js pattern: "a range hint read from the same
            // declaration so a label cannot claim a stale range". Here there IS only one
            // declaration, so staleness is structurally impossible - proved by moving the
            // limits and watching the hint move with them.
            const hint = () => page.evalFn(() => {
                const r = document.querySelector('#s').shadowRoot;
                const el = r.querySelector('#range');
                return el ? el.textContent : null;
            });
            assert.equal(await hint(), 'Range 135 to 165 °C');

            await page.evalFn(async () => {
                const el = document.querySelector('#s');
                el.max = 160;               // a DE1 rather than a Bengle (B3)
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
            // machine-limits.js understands "the steam hole (0-or-working-band)" and
            // steps ACROSS it. That knowledge must not be in this file and must not be
            // prevented by it: `next` is a property, and when it is there it decides.
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

        /* -- 7. behaviour, across the shadow boundary ---------------------- */

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
                // 2.1 + 0.1 is 2.2000000000000002 in IEEE 754. A readout is not the place
                // to find that out.
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

        /* -- 8. the aria contract (Appendix 15) and L22 -------------------- */

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
            // L22: "rail value cells are tabindex=-1" (app.js:91) - present in the tab
            // order's markup and removed from the tab order, which is the worst of both.
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

        /* -- 9. hit floor and container floor ------------------------------ */

        test('Appendix 5: every target clears --ui-hit-min on both axes', () => editable(async (page) => {
            // Measured on the RENDERED box, never read off a rule - which is the whole
            // lesson of bug P4, "measured 64x64, so --slate-hit-min is silently not
            // applied where the comment says it is".
            for (const part of ['#decrement', '#value', '#increment']) {
                const m = await assertHitFloor(page, `#s >>> ${part}`, { mode: 'box' });
                assert.ok(m.inline >= 48 && m.block >= 48, `${part} ${m.inline}x${m.block}`);
            }
        }));

        test('the container floor: the control holds its size and overflows where it shows', () => mounted(
            one('', 'inline-size: 160px;'), async (page) => {
                // Section 2.4 wants an explicit floor and a stated overflow. The host's
                // min-inline-size is derived from the same three numbers the grid uses -
                // two caps, the value cell's floor, two hairlines - so it IS 268, the
                // oracle's one distinct geometry, arrived at rather than typed. A
                // container too narrow produces a VISIBLE overflow rather than a number
                // squeezed to nothing, which is Slate's minmax(0, 1fr) outcome.
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
                // Section 2.4's riskiest inherited behaviour is silent clipping - "at no
                // point does anything tell the user content was removed" - and
                // `.slate-stepper (:549)` is on that list by line number.
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
            // CONVENTIONS.md section 6, verified on the rendered cascade rather than on
            // source text: a plain document rule at higher specificity than :host must be
            // able to retarget the documented custom property. Nothing here is defended
            // with !important, so the token wins.
            await page.setStyle('#s', { '--ui-stepper-cap': '91px' });
            const dec = await page.box('#s >>> #decrement');
            await page.setStyle('#s', { '--ui-stepper-cap': null });
            assert.equal(Math.round(dec.width), 91, 'a consumer retargets through the token, with no fight');
        }));
    });
}

/* ---------------------------------------------------------------------------
 * Cross-geometry: the control is its container's, not the window's
 * ------------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------------
 * Both themes, against both corpora
 * ------------------------------------------------------------------------- */

test('the control inverts with the theme, and lands on the oracle in both', async () => {
    const read = (theme) => browser.withPage({ geometry: BENCH, theme }, async (page) => {
        await page.mount(PLAIN, MODULE);
        return page.computed('#s >>> .band', ['background-color', 'border-top-color']);
    });

    // ORACLE  settings-machine-steam .slate-stepper [i=50] background-color =
    //         rgb(26, 33, 39) [prov-baseline] / rgb(248, 249, 249) [prov-light]
    //         <- slate-components.css `.slate-stepper` (token-driven)  -> --ui-key
    // ORACLE  ... border-top-color = rgb(58, 72, 82) [prov-baseline] /
    //         rgb(203, 208, 211) [prov-light]                          -> --ui-line
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
    // ORACLE  settings-machine-steam .slate-stepper-value [i=52] background-color =
    //         color(srgb 0.760784 0.815686 0.854902 / 0.0927451) [prov-baseline] /
    //         color(srgb 0.117647 0.164706 0.196078 / 0.0603922) [prov-light]
    //         <- slate-components.css `.slate-stepper-value` (set via a CSS shorthand;
    //         the source reads color-mix(in srgb, var(--slate-seam) 55%, transparent)).
    // 194/255 = 0.760784 and 0.17 x 0.55 = 0.0935; 30/255 = 0.117647 and 0.11 x 0.55 =
    // 0.0605. The token carries both, and one declaration renders both.
    const read = (theme) => browser.withPage({ geometry: BENCH, theme }, async (page) => {
        await page.mount(PLAIN, MODULE);
        return page.prop('#s >>> #value', 'background-color');
    });

    assert.match(await read('dark'), /^color\(srgb 0\.760784 0\.815686 0\.854902 \/ 0\.0(9|93)/);
    assert.match(await read('light'), /^color\(srgb 0\.117647 0\.164706 0\.196078 \/ 0\.0(6|60)/);
});
