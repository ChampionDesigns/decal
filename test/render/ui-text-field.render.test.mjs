/**
 * ui-text-field.render.test.mjs — Gate A for Wave 1 item #6, "Text field".
 *
 * Everything here is asserted on COMPUTED style, box geometry and real behaviour
 * through CDP, never on source text (Part 8 §2), at BOTH standard geometries —
 * 1281×801 @ dsf 1.5 (the bench truth) and the 1000×600 floor.
 *
 * THE SIX REQUIRED CLASSES, and where each one lives below:
 *   1. token drill — one per token the component consumes (§"tokens are consumed").
 *   2. focus geometry from --ui-focus-*, unclipped (§"the one ring").
 *   3. container behaviour at the floor (§"reads its own container").
 *   4. bug ids asserted dead — E14, E7, L24 (§"bugs that cannot express here").
 *   5. aria contract (§"the accessible name").
 *   6. hit-area floor (§"the hit floor").
 * Plus the thing the row exists to prove: `formAssociated` really works
 * (`DECISIONS.md:196`, §"form association").
 *
 * ORACLE VALUES UNDER TEST, quoted verbatim from `prov_query.py value --state
 * profile-selector --id profile-filter`, the one Slate field painted by the library
 * rule rather than by a screen's Tailwind pile-up:
 *   height 64px ← slate-components.css {.slate-field} authored `var(--slate-control-height)`
 *   padding-left 18px, border-top-left-radius 6px, border-top-width 1px ← same rule
 *   font-size 17px ← authored `var(--slate-text-base)`
 *   font-weight 400 ← authored `var(--slate-weight-regular)`
 *   color rgb(244,247,248) dark / rgb(23,26,28) light ← authored `var(--slate-text)`
 *   background-color rgb(26,33,39) dark / rgb(248,249,249) light
 *   border-top-color rgb(58,72,82) dark / rgb(203,208,211) light
 * Each is asserted as the TOKEN it now comes from, not as the number — a number
 * would pass for a component that hard-codes it, which is the failure the drill
 * exists to catch.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH, FLOOR } from '../harness/index.js';
import { assertTokenDrill, assertHitFloor, DRILL_COLOUR, DRILL_LENGTH } from '../harness/assertions.js';

const MODULES = ['/src/components/ui-text-field.js'];
const FIELD = 'ui-text-field >>> #field';
const INPUT = 'ui-text-field >>> #control';
const LABEL = 'ui-text-field >>> #label';

const PLAIN = '<ui-text-field placeholder="Search profiles"></ui-text-field>';
const LABELLED = '<ui-text-field label="Scale host" value="10.0.0.42"></ui-text-field>';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

/**
 * The focus-ring assertion, in the shape `assertFocusUnclipped` has — minus its one
 * assumption that does not hold here.
 *
 * That helper asserts `:focus-visible` on the element it reads the outline from, and
 * this component draws the ring on the field WRAPPER while the INPUT takes the focus
 * (CONVENTIONS §3: "a wrapper that should show the ring while an inner input takes
 * focus"). So the focus is verified on the input — which is stronger, because it
 * proves the focus is real and keyboard-modal — and the ring is read off the wrapper
 * with the same token comparisons and the same clipper walk.
 */
async function assertRing(page, { ring, focus, offsetToken }) {
    await page.focusVisible(focus);

    const inner = await page.focusGeometry(focus);
    assert.ok(inner.focusVisible, `${focus} does not match :focus-visible after a keyboard focus`);
    assert.equal(
        inner.outlineStyle, 'none',
        'the input must paint NO ring of its own — one treatment, drawn once (spec §3.6)',
    );

    const g = await page.focusGeometry(ring);
    const width = await page.resolveValue('var(--ui-focus-w)', 'outline-width');
    const colour = await page.resolveValue('var(--ui-steel)', 'outline-color');
    const offset = await page.resolveValue(`var(${offsetToken})`, 'outline-offset');

    assert.notEqual(g.outlineStyle, 'none', `${ring} paints no focus ring at all`);
    assert.equal(g.outlineWidth, width, `${ring}'s ring is not --ui-focus-w`);
    assert.equal(g.outlineColor, colour, `${ring}'s ring is not --ui-steel`);
    assert.equal(g.outlineOffset, offset, `${ring}'s offset is not ${offsetToken}`);

    const clipped = g.clippers
        .map((c) => {
            const sides = [];
            if (g.ringRect.top < c.top - 0.5) sides.push('top');
            if (g.ringRect.left < c.left - 0.5) sides.push('left');
            if (g.ringRect.bottom > c.bottom + 0.5) sides.push('bottom');
            if (g.ringRect.right > c.right + 0.5) sides.push('right');
            return { anchor: c.anchor, sides };
        })
        .filter((c) => c.sides.length);

    assert.deepEqual(clipped, [], `bug L24's class: ${ring}'s ring is clipped — ${JSON.stringify(clipped)}`);
    return g;
}

/**
 * The line box an entry's own type actually occupies, against the content box it has
 * to fit in — bug E7's measurement, stated the way the bug is stated.
 *
 * A probe block carrying the input's own resolved font and leading is laid out beside
 * it (`position: absolute`, so it disturbs no flex line) and its border box IS the line
 * box, including a `line-height: normal` the computed style only reports as the word.
 * `Range.getClientRects` over the text will not do: it returns the INK rect, 27px for
 * E7's 24px/1.2 type, which fits inside the 28px box the bug is about and would report
 * the defect as healthy.
 */
async function lineBoxFit(page, selector) {
    return page.evalFn((sel) => {
        const input = window.__h.need(sel);
        const cs = getComputedStyle(input);
        const probe = document.createElement('div');
        probe.textContent = input.value;
        probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;padding:0;border:0;'
            + 'font-family:' + cs.fontFamily + ';font-size:' + cs.fontSize
            + ';font-weight:' + cs.fontWeight + ';font-style:' + cs.fontStyle
            + ';line-height:' + cs.lineHeight + ';letter-spacing:' + cs.letterSpacing;
        input.parentNode.appendChild(probe);
        const lineBox = probe.getBoundingClientRect().height;
        probe.remove();
        return {
            lineBox,
            content: input.clientHeight
                - parseFloat(cs.paddingTop || '0') - parseFloat(cs.paddingBottom || '0'),
            clientHeight: input.clientHeight,
            scrollHeight: input.scrollHeight,
            lineHeight: cs.lineHeight,
            fontSize: cs.fontSize,
        };
    }, selector);
}

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-text-field @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (markup, fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(markup, MODULES);
            assert.deepEqual(page.pageErrors, [], 'the component must mount without throwing');
            return fn(page);
        });

        test('the emulated geometry is the one the suite asked for', () => mounted(PLAIN, async (page) => {
            const env = JSON.parse(await page.eval(
                'JSON.stringify({dpr: devicePixelRatio, w: innerWidth, h: innerHeight})',
            ));
            assert.deepEqual(env, {
                dpr: geometry.deviceScaleFactor,
                w: geometry.width,
                h: geometry.height,
            });
        }));

        /* ================================================================== *
         * The resting box IS the oracle's field
         * ================================================================== */

        test('the resting box carries the oracle\'s measured field', () => mounted(PLAIN, async (page) => {
            // CITE profile-selector #profile-filter [i=13] height = 64px <-
            //      slate-components.css {.slate-field} authored `var(--slate-control-height)`
            const box = await page.box(FIELD);
            assert.equal(box.height, 64, '--ui-control-h, and it is 64px at BOTH geometries (spec §2.2)');

            const field = await page.computed(FIELD, [
                'padding-left', 'padding-right', 'border-top-left-radius', 'border-top-style', 'box-sizing',
            ]);
            // CITE ... padding-left = 18px <- {.slate-field} (token-driven) -> --ui-space-4
            assert.equal(field['padding-left'], await page.resolveValue('var(--ui-space-4)', 'padding-left'));
            assert.equal(field['padding-right'], field['padding-left'], 'the inset is symmetric');
            // CITE ... border-top-left-radius = 6px <- {.slate-field} -> --ui-radius
            assert.equal(
                field['border-top-left-radius'],
                await page.resolveValue('var(--ui-radius)', 'border-top-left-radius'),
            );
            assert.equal(field['border-top-style'], 'solid');
            assert.equal(field['box-sizing'], 'border-box', '64px is the OUTER box, as Slate measures it');

            // CITE ... border-top-width = 1px <- {.slate-field} (token-driven) -> --ui-border-w
            // Compared as a NUMBER with a device-pixel tolerance: at dsf 1.5 a 1px
            // border is 1.5 device px and the engine snaps it (CONVENTIONS §10).
            const bw = parseFloat(await page.prop(FIELD, 'border-top-width'));
            assert.ok(bw > 0 && bw <= 1.5, `hairline border, got ${bw}px`);

            const input = await page.computed(INPUT, ['font-size', 'font-weight', 'font-family', 'text-align']);
            // CITE ... font-size = 17px <- {.slate-field} authored `var(--slate-text-base)`
            assert.equal(input['font-size'], await page.resolveValue('var(--ui-text-base)', 'font-size'));
            // CITE ... font-weight = 400 <- {.slate-field} authored `var(--slate-weight-regular)`
            assert.equal(input['font-weight'], await page.resolveValue('var(--ui-weight-regular)', 'font-weight'));
            // CITE themes: font-family `Geist, system-ui, sans-serif` in BOTH themes
            assert.equal(input['font-family'], await page.resolveValue('var(--ui-font-family)', 'font-family'));
            assert.equal(input['text-align'], 'start');
        }));

        test('zero !important anywhere in the component\'s own cascade', () => mounted(PLAIN, async (page) => {
            // Slate paints every settings field through
            // `#subpage-host #settings-content-area input:not([type="range"])…` with
            // !important=yes on eight of the eighteen probed properties. Nothing can
            // reach in here, so nothing needs it (spec §2.1 Rule 3).
            const count = await page.evalFn(() => {
                const root = document.querySelector('ui-text-field').shadowRoot;
                let hits = 0;
                for (const sheet of root.adoptedStyleSheets) {
                    for (const rule of sheet.cssRules) {
                        if (rule.style) {
                            for (const prop of rule.style) {
                                if (rule.style.getPropertyPriority(prop) === 'important') hits += 1;
                            }
                        }
                    }
                }
                return hits;
            });
            assert.equal(count, 0);
        }));

        /* ================================================================== *
         * Standing assertion 1 — tokens are consumed, not copied
         * ================================================================== */

        test('drill: --ui-control-h moves the field\'s height', () => mounted(PLAIN, async (page) => {
            const drill = await assertTokenDrill(page, {
                token: '--ui-control-h',
                value: '91px',
                selector: FIELD,
                property: 'block-size',
            });
            assert.equal(drill.before, '64px', 'the resting height is --ui-control-h\'s own value');
        }));

        test('drill: --ui-space-4 moves the text inset', () => mounted(PLAIN, async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-4', value: DRILL_LENGTH, selector: FIELD, property: 'padding-left',
            });
        }));

        test('drill: --ui-radius moves the corner', () => mounted(PLAIN, async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-radius', value: DRILL_LENGTH, selector: FIELD, property: 'border-top-left-radius',
            });
        }));

        test('drill: --ui-key moves the control face', () => mounted(PLAIN, async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-key', value: DRILL_COLOUR, selector: FIELD, property: 'background-color',
            });
        }));

        test('drill: --ui-line moves the edge around the control', () => mounted(PLAIN, async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-line', value: DRILL_COLOUR, selector: FIELD, property: 'border-top-color',
            });
        }));

        test('drill: --ui-hairline moves the edge\'s WIDTH through --ui-border-w', () => mounted(PLAIN, async (page) => {
            // --ui-border-w is var(--ui-hairline), so this proves the derivation as
            // well as the consumption. `expected` is given explicitly because the
            // assertion's own probe has no border-style and would resolve 0px.
            await assertTokenDrill(page, {
                token: '--ui-hairline',
                value: DRILL_LENGTH,
                selector: FIELD,
                property: 'border-top-width',
                expected: DRILL_LENGTH,
            });
        }));

        test('drill: --ui-text moves the entry ink across the shadow boundary', () => mounted(PLAIN, async (page) => {
            // DRILLED ON THE FIELD, WHICH IS WHERE THE COMPONENT DECLARES IT. Drilling
            // the input alone proves nothing: `.input` is `color: inherit` and
            // styles/document.css:37 already sets `html { color: var(--ui-text) }`, so
            // a bare <input style="color: inherit"> with no component and no component
            // rule moves on the same drill — measured, rgb(244,247,248) →
            // rgb(255,0,170), identical to the component's answer.
            //
            // So first break the inheritance: with an unrelated `color` on <html>, a
            // field that had no declaration of its own would take it.
            await page.setStyle('html', { color: 'rgb(3, 4, 5)' });
            const held = await page.prop(FIELD, 'color');
            await page.setStyle('html', { color: null });
            assert.equal(
                held, await page.resolveToken('--ui-text', 'color'),
                'the field inherited an ancestor colour instead of declaring --ui-text — '
                + 'the token consumption this drill is supposed to prove does not exist',
            );

            // Then the drill itself, on the declaring element.
            await assertTokenDrill(page, {
                token: '--ui-text', value: DRILL_COLOUR, selector: FIELD, property: 'color',
            });

            // And the boundary half: the entry takes its ink from the field box, so
            // one declaration paints both. Custom properties are the ONLY styling that
            // crosses the shadow boundary (A6).
            assert.equal(await page.prop(INPUT, 'color'), await page.prop(FIELD, 'color'));
        }));

        test('drill: --ui-text-base moves the entry type', () => mounted(PLAIN, async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-base', value: DRILL_LENGTH, selector: INPUT, property: 'font-size',
            });
        }));

        test('drill: --ui-weight-regular moves the entry weight', () => mounted(PLAIN, async (page) => {
            // The equality check above compares font-weight with the token's own value,
            // 400 — which is ALSO the UA default for an <input> (measured: a bare input
            // with no author font-weight computes 400). That assertion therefore passes
            // with the declaration deleted, let alone hard-coded, so the consumption is
            // proved here instead: retarget the token and the entry has to move.
            await assertTokenDrill(page, {
                token: '--ui-weight-regular', value: '800', selector: INPUT, property: 'font-weight',
            });
        }));

        test('drill: --ui-font-family moves the entry face', () => mounted(PLAIN, async (page) => {
            // Same failure, one property along: the equality check is satisfied by a
            // literal `Geist, system-ui, sans-serif` typed into the component. A drill
            // is not. (A component may never declare a face of its own — CONVENTIONS §7,
            // spec §6.3 Rule 2 — so the family can only ever be this token.)
            await assertTokenDrill(page, {
                token: '--ui-font-family', value: 'Georgia, serif', selector: INPUT, property: 'font-family',
            });
        }));

        test('drill: --ui-muted moves the placeholder', () => mounted(PLAIN, async (page) => {
            // NO ORACLE ANSWER — ::placeholder is outside the corpus's 18-property
            // appearance surface, so this value comes from the token and the test
            // pins it to the token rather than to a number.
            const drill = await assertTokenDrill(page, {
                token: '--ui-muted', value: DRILL_COLOUR, selector: INPUT, property: 'color', pseudo: '::placeholder',
            });
            assert.equal(drill.after, DRILL_COLOUR);
            assert.equal(
                await page.prop(INPUT, 'opacity', { pseudo: '::placeholder' }), '1',
                'a UA opacity default would make the token a lie',
            );
        }));

        test('drill: --ui-text-note and --ui-text-2 move the label', () => mounted(LABELLED, async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-note', value: DRILL_LENGTH, selector: LABEL, property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-text-2', value: DRILL_COLOUR, selector: LABEL, property: 'color',
            });
        }));

        test('drill: --ui-space-2 moves the gap under the label', () => mounted(LABELLED, async (page) => {
            // One drill per token the component consumes, and this one had none at all —
            // neither a drill nor an equality check — so a hard-coded 8px shipped green.
            await assertTokenDrill(page, {
                token: '--ui-space-2', value: DRILL_LENGTH, selector: LABEL, property: 'margin-block-end',
            });
        }));

        test('drill: --ui-space-3 moves BOTH adornment gaps', () => mounted(
            '<ui-text-field placeholder="Search">'
            + '<span slot="lead" style="inline-size: 24px; block-size: 24px; display: inline-block"></span>'
            + '<span slot="trail" style="inline-size: 24px; block-size: 24px; display: inline-block"></span>'
            + '</ui-text-field>',
            async (page) => {
                // The same token, twice in the component (component lines 251/255) and
                // previously asserted nowhere: the lead-adornment geometry test only
                // checks that the entry follows the glyph, which a literal satisfies.
                // The gap lives on the SLOTTED element rather than as a flex `gap`, so
                // these are read on light-DOM children of the host.
                await assertTokenDrill(page, {
                    token: '--ui-space-3',
                    value: DRILL_LENGTH,
                    selector: 'ui-text-field span[slot="lead"]',
                    property: 'margin-inline-end',
                });
                await assertTokenDrill(page, {
                    token: '--ui-space-3',
                    value: DRILL_LENGTH,
                    selector: 'ui-text-field span[slot="trail"]',
                    property: 'margin-inline-start',
                });
            },
        ));

        test('drill: --ui-opacity-disabled dims the whole control', () => mounted(
            '<ui-text-field disabled label="Scale host" value="10.0.0.42"></ui-text-field>',
            async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-opacity-disabled', value: '0.17', selector: 'ui-text-field', property: 'opacity',
                });
                assert.equal(
                    await page.evalFn(() => document.querySelector('ui-text-field').shadowRoot
                        .getElementById('control').disabled),
                    true,
                    'the dial is PAINT — the entry must also really be disabled (CONVENTIONS §4)',
                );
            },
        ));

        test('drill: --ui-status-danger paints the invalid edge', () => mounted(
            '<ui-text-field invalid label="Scale host" value="nope"></ui-text-field>',
            async (page) => {
                // NO ORACLE ANSWER: there is no invalid-field state among the 49.
                await assertTokenDrill(page, {
                    token: '--ui-status-danger', value: DRILL_COLOUR, selector: FIELD, property: 'border-top-color',
                });
                assert.equal(
                    await page.evalFn(() => document.querySelector('ui-text-field').shadowRoot
                        .getElementById('control').getAttribute('aria-invalid')),
                    'true',
                    'the visual state and the accessibility state are the same state',
                );
            },
        ));

        /* ================================================================== *
         * Standing assertion 2 — the one focus ring, unclipped
         * ================================================================== */

        test('the ring is the token ring on the field box, outset and unclipped', () => mounted(PLAIN, async (page) => {
            const g = await assertRing(page, { ring: FIELD, focus: INPUT, offsetToken: '--ui-focus-offset' });
            assert.deepEqual(g.clippers, [], 'nothing clips a field in an open row');
        }));

        test('drill: --ui-steel moves the ring', () => mounted(PLAIN, async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-steel',
                value: DRILL_COLOUR,
                selector: FIELD,
                property: 'outline-color',
                // A token change does not survive a re-focus for free.
                prepare: (p) => p.focusVisible(INPUT),
            });
        }));

        test('BUG L24 DEAD: inside overflow:hidden the ring goes inset, not clipped', () => mounted(
            '<div id="clipper" style="overflow: hidden; inline-size: 320px">'
            + '<ui-text-field focus-ring="inset" placeholder="Search"></ui-text-field></div>',
            async (page) => {
                // Bug L24 (§7.2): "A11Y: focus rings clipped on all four sides by the
                // components they sit inside." The host attribute switches
                // --_ui-focus-offset for the whole component; the wrapper's ring reads
                // it through the exported fragment, so the fix is one attribute.
                const g = await assertRing(page, {
                    ring: FIELD, focus: INPUT, offsetToken: '--ui-focus-offset-inset',
                });
                assert.ok(g.clippers.length >= 1, 'the clipping ancestor must be real, or this is vacuous');
                assert.equal(g.clippers[0].overflowY, 'hidden');
            },
        ));

        test('there is exactly ONE ring, not two', () => mounted(PLAIN, async (page) => {
            await page.focusVisible(INPUT);
            const rings = await page.evalFn(() => {
                const host = document.querySelector('ui-text-field');
                const painted = [];
                if (getComputedStyle(host).outlineStyle !== 'none') painted.push('host');
                for (const el of host.shadowRoot.querySelectorAll('*')) {
                    if (getComputedStyle(el).outlineStyle !== 'none') painted.push(el.id || el.localName);
                }
                return painted;
            });
            assert.deepEqual(rings, ['field'], 'five focus treatments is what this file exists to prevent');
        }));

        /* ================================================================== *
         * Standing assertion 3 — a component reads its own container
         * ================================================================== */

        test('the field follows its own CONTAINER, never the viewport', () => mounted(PLAIN, async (page) => {
            // The inversion is the proof: the same host width must give the same field
            // at 1281 and at 1000 viewport px. A component keyed on @media could not.
            await page.setStyle('ui-text-field', { 'inline-size': '240px' });
            let box = await page.box(FIELD);
            assert.equal(box.width, 240);
            assert.equal(box.height, 64, 'the height is a fixed token, not a fraction (spec §2.2)');

            await page.setStyle('ui-text-field', { 'inline-size': '820px' });
            box = await page.box(FIELD);
            assert.equal(box.width, 820);
            assert.equal(box.height, 64);
        }));

        test('a squeezed container shrinks the entry rather than overflowing it', () => mounted(PLAIN, async (page) => {
            await page.setStyle('ui-text-field', { 'inline-size': '160px' });
            const m = await page.metrics(FIELD);
            assert.ok(
                m.scrollWidth <= m.clientWidth + 0.5,
                `the entry overflows its field: scrollWidth ${m.scrollWidth} vs clientWidth ${m.clientWidth}. `
                + 'min-inline-size: 0 on the flex item is what stops this.',
            );
            const input = await page.box(INPUT);
            const field = await page.box(FIELD);
            assert.ok(input.width > 0, 'the entry must not collapse to nothing');
            assert.ok(input.right <= field.right + 0.5 && input.left >= field.left - 0.5);
        }));

        test('no @media (width…) anywhere in the component', () => mounted(PLAIN, async (page) => {
            // Spec §2.1 Rule 1 — "No component contains a @media (width…) query."
            const media = await page.evalFn(() => {
                const root = document.querySelector('ui-text-field').shadowRoot;
                const out = [];
                for (const sheet of root.adoptedStyleSheets) {
                    for (const rule of sheet.cssRules) {
                        if (rule.media) out.push(rule.conditionText || String(rule.media.mediaText));
                    }
                }
                return out;
            });
            assert.deepEqual(media, []);
        }));

        /* ================================================================== *
         * The hit floor (spec §2.3, Appendix 5)
         * ================================================================== */

        test('the field reaches --ui-hit-min on the block axis without a utility', () => mounted(PLAIN, async (page) => {
            // The row does not cite Appendix 5 — the ink IS the target here, because
            // --ui-control-h (64) already clears --ui-hit-min (48). Asserted anyway:
            // bugs P4 and L22 are both "a floor the comment claims and the box has not".
            const hit = await assertHitFloor(page, FIELD, { mode: 'box', axes: ['block'] });
            assert.ok(hit.block >= hit.floor, `${hit.block}px against a ${hit.floor}px floor`);

            // And the press lands on the entry, not just near it.
            await page.setStyle('ui-text-field', { 'inline-size': '320px' });
            const field = await page.box(FIELD);
            await page.click(FIELD, { offset: { x: 6, y: field.height / 2 } });
            const focused = await page.evalFn(() => {
                const root = document.querySelector('ui-text-field').shadowRoot;
                return root.activeElement ? root.activeElement.id : null;
            });
            assert.equal(focused, 'control', 'a press in the field\'s inset must reach the entry');
        }));

        /* ================================================================== *
         * The aria contract — bugs E14 and E7 asserted dead
         * ================================================================== */

        test('BUG E14 DEAD: the label and the entry are paired by construction', () => mounted(LABELLED, async (page) => {
            // E14 (§7.4): "A11Y: … settings fields have no `for`/`id` pairing."
            // One shadow root, one id, the pairing written in render() — a screen
            // cannot forget it because a screen does not write it.
            const a11y = await page.evalFn(() => {
                const root = document.querySelector('ui-text-field').shadowRoot;
                const input = root.getElementById('control');
                const label = root.getElementById('label');
                return {
                    htmlFor: label.htmlFor,
                    inputId: input.id,
                    labels: input.labels.length,
                    text: label.textContent.trim(),
                    ariaLabel: input.getAttribute('aria-label'),
                };
            });
            assert.equal(a11y.htmlFor, a11y.inputId);
            assert.equal(a11y.labels, 1, 'the entry has exactly one label element');
            assert.equal(a11y.text, 'Scale host');
            assert.equal(a11y.ariaLabel, null, 'a visible label is the name; no duplicate aria-label');

            // Clicking the label focuses the entry — the pairing, rendered.
            await page.click(LABEL);
            const focused = await page.evalFn(() => document.querySelector('ui-text-field')
                .shadowRoot.activeElement?.id ?? null);
            assert.equal(focused, 'control');
        }));

        test('hide-label keeps the accessible name and drops only the ink', () => mounted(
            '<ui-text-field hide-label label="Scale host" value="10.0.0.42"></ui-text-field>',
            async (page) => {
                const a11y = await page.evalFn(() => {
                    const root = document.querySelector('ui-text-field').shadowRoot;
                    return {
                        label: root.getElementById('label'),
                        ariaLabel: root.getElementById('control').getAttribute('aria-label'),
                    };
                });
                assert.equal(a11y.label, null, 'no visible label element');
                assert.equal(a11y.ariaLabel, 'Scale host', 'the name survives — an unnamed field is bug T15\'s shape');
            },
        ));

        test('required and readonly reach the entry, not just the host', () => mounted(
            '<ui-text-field required readonly label="Scale host"></ui-text-field>',
            async (page) => {
                const state = await page.evalFn(() => {
                    const i = document.querySelector('ui-text-field').shadowRoot.getElementById('control');
                    return { required: i.required, readOnly: i.readOnly };
                });
                assert.deepEqual(state, { required: true, readOnly: true });
            },
        ));

        test('BUG E7 DEAD: the entry cannot clip its own line box', () => mounted(
            '<ui-text-field value="pgjqy Jgq"></ui-text-field>',
            async (page) => {
                // E7 (§7.4, LAYOUT_SPEC_DRAFT.md:1158): "The step-name input clips its
                // own descenders — 28.8px of line box in a 28px box, ~31.7px on the
                // tablet." Nothing here sizes the entry from a type measurement: it
                // stretches to the field's content box, which is --ui-control-h minus
                // two hairlines.
                //
                // MEASURED AS THE BUG IS STATED — line box against content box. The
                // obvious proxy, scrollHeight <= clientHeight, is VACUOUS: an <input>
                // never reports vertical scroll overflow in Blink, and the third
                // assertion below pins that fact on E7's own shape rather than trusting
                // it. A box-height proxy is not much better: 62px of box for 17px of
                // type has ~36px of slack and would survive a large regression.
                const fit = await lineBoxFit(page, INPUT);
                assert.ok(
                    fit.content + 0.5 >= fit.lineBox,
                    `the entry clips its own line box: ${fit.lineBox}px of line box in a `
                    + `${fit.content}px content box (font-size ${fit.fontSize}, line-height ${fit.lineHeight})`,
                );

                // THE DISCRIMINATOR, in the same page and through the same function:
                // E7's exact shape must FAIL the measurement above, or the measurement
                // is not testing anything. "28.8px of line box in a 28px box."
                await page.evalFn(() => {
                    const holder = document.createElement('div');
                    holder.innerHTML = '<input id="e7" value="pgjqy Jgq" style="box-sizing:border-box;'
                        + 'height:28px;font-size:24px;line-height:1.2;padding:0;border:0">';
                    document.getElementById('mount').appendChild(holder);
                    return true;
                });
                const bug = await lineBoxFit(page, '#e7');
                assert.ok(
                    bug.lineBox > bug.content + 0.5,
                    'the line-box measurement does not catch E7 itself, so the assertion above is '
                    + `vacuous: ${bug.lineBox}px of line box in a ${bug.content}px content box`,
                );
                assert.equal(
                    bug.scrollHeight, bug.clientHeight,
                    'E7\'s own shape reports no scroll overflow — which is exactly why '
                    + 'scrollHeight <= clientHeight cannot carry this claim',
                );
            },
        ));

        /* ================================================================== *
         * Form association — the friction DECISIONS.md:196 names
         * ================================================================== */

        test('the value submits with the form under the host\'s name', () => mounted(
            '<form id="f"><ui-text-field name="host" value="10.0.0.42"></ui-text-field></form>',
            async (page) => {
                const got = await page.eval(
                    'new FormData(document.getElementById("f")).get("host")',
                );
                assert.equal(got, '10.0.0.42', 'static formAssociated + setFormValue, or the field is invisible to the form');
            },
        ));

        test('the value submits under a name set as a PROPERTY, not only as an attribute', () => mounted(
            '<form id="f"><ui-text-field value="10.0.0.42"></ui-text-field></form>',
            async (page) => {
                // The test above states name="host" in markup, which is the one path
                // that always worked. Form submission reads the HOST's name CONTENT
                // ATTRIBUTE (an element with no non-empty name attribute contributes
                // no entry at all), so a `name` that did not reflect took the field
                // out of the form silently: measured { hasAttr: false, prop: 'host' }
                // with `new FormData(f).entries()` coming back [].
                const got = await page.evalFn(() => {
                    const el = document.querySelector('ui-text-field');
                    el.name = 'host';
                    return el.updateComplete.then(() => ({
                        attr: el.getAttribute('name'),
                        prop: el.name,
                        entries: [...new FormData(document.getElementById('f')).entries()],
                    }));
                });
                assert.equal(got.attr, 'host', 'name must reflect, or the form cannot see the field');
                assert.equal(got.prop, 'host');
                assert.deepEqual(got.entries, [['host', '10.0.0.42']]);

                // And the reflection does not litter: an empty name is no name, so the
                // attribute is removed rather than written as name="" — the rule the
                // component states for `align` ("noise in the DOM and in a capture diff").
                const cleared = await page.evalFn(() => {
                    const el = document.querySelector('ui-text-field');
                    el.name = '';
                    return el.updateComplete.then(() => ({
                        hasAttr: el.hasAttribute('name'),
                        entries: [...new FormData(document.getElementById('f')).entries()],
                    }));
                });
                assert.deepEqual(cleared, { hasAttr: false, entries: [] });
            },
        ));

        test('a bare field writes no name attribute at all', () => mounted(PLAIN, async (page) => {
            assert.equal(
                await page.evalFn(() => document.querySelector('ui-text-field').hasAttribute('name')),
                false,
                'a reflected default would put name="" on every instance in the gallery',
            );
        }));

        test('a focusable ADORNMENT gets the Decal ring, not the UA\'s', () => mounted(
            '<ui-text-field placeholder="Search"><button slot="trail" id="clr">c</button></ui-text-field>',
            async (page) => {
                // Wave 2 #30 (Search field) is built on these slots and its clear button
                // is exactly this case. Shadow styles do not reach light-DOM slotted
                // content and `:has()` walks the DOM tree rather than the flattened one,
                // so neither the base's focusable list nor `.field:has(:focus-visible)`
                // can see it: measured, the button fell back to the UA's own
                // `outline: auto` (1px, rgb(16,16,16)) — a sixth focus treatment inside
                // a Decal field. `::slotted(:focus-visible)` is what reaches it.
                const BUTTON = 'ui-text-field button[slot="trail"]';
                await page.focusVisible(BUTTON);
                const g = await page.focusGeometry(BUTTON);

                assert.ok(g.focusVisible, 'the adornment did not take a keyboard focus');
                assert.equal(g.outlineStyle, 'solid', 'the UA ring is `auto`; the Decal ring is solid');
                assert.equal(g.outlineWidth, await page.resolveValue('var(--ui-focus-w)', 'outline-width'));
                assert.equal(g.outlineColor, await page.resolveValue('var(--ui-steel)', 'outline-color'));
                assert.equal(g.outlineOffset, await page.resolveValue('var(--ui-focus-offset)', 'outline-offset'));

                // ONE ring, and it is on the thing that took the focus: the field must
                // not also light up (that would be `:focus-within`, which would ring on
                // a mouse press too).
                assert.equal(await page.prop(FIELD, 'outline-style'), 'none');
                assert.equal(await page.prop('ui-text-field', 'outline-style'), 'none');
            },
        ));

        test('the adornment\'s ring follows the host\'s offset variant', () => mounted(
            '<div id="clipper" style="overflow: hidden; inline-size: 320px">'
            + '<ui-text-field focus-ring="inset" placeholder="Search">'
            + '<button slot="trail" id="clr">c</button></ui-text-field></div>',
            async (page) => {
                // --_ui-focus-offset is inherited from :host, and a slotted element
                // inherits through the slot in the flat tree — so bug L24's one-line
                // answer reaches the adornment as well, with no second attribute.
                const BUTTON = 'ui-text-field button[slot="trail"]';
                await page.focusVisible(BUTTON);
                assert.equal(
                    await page.prop(BUTTON, 'outline-offset'),
                    await page.resolveValue('var(--ui-focus-offset-inset)', 'outline-offset'),
                );
            },
        ));

        test('typing moves the value, the form value and the events', () => mounted(
            '<form id="f"><ui-text-field name="host" value=""></ui-text-field></form>',
            async (page) => {
                await page.evalFn(() => {
                    window.__seen = [];
                    const el = document.querySelector('ui-text-field');
                    for (const type of ['input', 'change']) {
                        el.addEventListener(type, (e) => window.__seen.push(
                            `${type}:${e.target === el ? 'host' : 'leaked'}`,
                        ));
                    }
                    return true;
                });
                await page.click(INPUT);
                await page.press('r');
                await page.press('e');
                await page.press('a');

                assert.equal(await page.evalFn(() => document.querySelector('ui-text-field').value), 'rea');
                assert.equal(await page.eval('new FormData(document.getElementById("f")).get("host")'), 'rea');

                // `input` is composed and already crosses, retargeted to the host;
                // `change` is composed:FALSE natively and is re-dispatched, so a
                // consumer listening on <ui-text-field> sees both.
                const seen = await page.evalFn(() => window.__seen.slice());
                assert.deepEqual(seen, ['input:host', 'input:host', 'input:host']);

                await page.evalFn(() => {
                    document.querySelector('ui-text-field').shadowRoot.getElementById('control')
                        .dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                });
                const after = await page.evalFn(() => window.__seen.slice());
                assert.equal(after.at(-1), 'change:host', 'change must be re-dispatched across the boundary');
            },
        ));

        test('form reset restores the authored value', () => mounted(
            '<form id="f"><ui-text-field name="host" value="10.0.0.42"></ui-text-field></form>',
            async (page) => {
                await page.evalFn(() => { document.querySelector('ui-text-field').value = 'typed over'; return true; });
                await page.evalFn(() => { document.getElementById('f').reset(); return true; });
                await page.settle();
                assert.equal(await page.evalFn(() => document.querySelector('ui-text-field').value), '10.0.0.42');
                assert.equal(await page.eval('new FormData(document.getElementById("f")).get("host")'), '10.0.0.42');
            },
        ));

        test('validity is mirrored from the entry, anchored on the entry', () => mounted(
            '<form id="f"><ui-text-field name="host" required value=""></ui-text-field></form>',
            async (page) => {
                const empty = await page.evalFn(() => {
                    const el = document.querySelector('ui-text-field');
                    return { valid: el.checkValidity(), missing: el.validity.valueMissing, willValidate: el.willValidate };
                });
                assert.deepEqual(empty, { valid: false, missing: true, willValidate: true });

                await page.evalFn(() => { document.querySelector('ui-text-field').value = 'set'; return true; });
                await page.settle();
                const filled = await page.evalFn(() => {
                    const el = document.querySelector('ui-text-field');
                    return { valid: el.checkValidity(), missing: el.validity.valueMissing, form: el.form?.id ?? null };
                });
                assert.deepEqual(filled, { valid: true, missing: false, form: 'f' });
            },
        ));

        test('an unrecognised type falls back to text rather than smuggling a control in', () => mounted(
            '<ui-text-field type="checkbox"></ui-text-field>',
            async (page) => {
                const type = await page.evalFn(() => document.querySelector('ui-text-field')
                    .shadowRoot.getElementById('control').type);
                assert.equal(type, 'text', 'number belongs to the stepper (#4); checkbox is the switch (#5)');
                const ok = await page.evalFn(() => document.querySelector('ui-text-field')
                    .shadowRoot.getElementById('control').type === 'text');
                assert.equal(ok, true);
            },
        ));

        test('align is a reflected variant, not a class a screen reaches in with', () => mounted(
            '<ui-text-field align="center" value="30"></ui-text-field>',
            async (page) => {
                assert.equal(await page.prop(INPUT, 'text-align'), 'center');
                await page.evalFn(() => { document.querySelector('ui-text-field').align = 'end'; return true; });
                await page.settle();
                // Chrome reports the logical keyword as authored, not resolved to
                // left/right — so the assertion is on the keyword, and the point is
                // that setting the PROPERTY reflected the attribute and repainted.
                assert.equal(await page.prop(INPUT, 'text-align'), 'end');
                assert.equal(
                    await page.evalFn(() => document.querySelector('ui-text-field').getAttribute('align')),
                    'end',
                    'align reflects, so the cascade sees what the property says',
                );
            },
        ));

        test('a lead adornment insets the entry without moving the field\'s own padding', () => mounted(
            '<ui-text-field placeholder="Search"><span slot="lead" style="inline-size: 24px; '
            + 'block-size: 24px; display: inline-block"></span></ui-text-field>',
            async (page) => {
                const field = await page.box(FIELD);
                const lead = await page.box('ui-text-field span[slot="lead"]');
                const input = await page.box(INPUT);
                const inset = parseFloat(await page.prop(FIELD, 'padding-left'));

                assert.ok(
                    Math.abs(lead.left - (field.left + inset)) < 1.5,
                    'the glyph sits at the oracle\'s 18px inset, not at 18 + a flex gap',
                );
                assert.ok(input.left > lead.right, 'the entry follows the glyph');

                // And with NO adornment the entry itself starts at that same inset —
                // a `gap` on the flex container would have pushed it a step further.
                await page.mount(PLAIN, MODULES);
                const bare = await page.box(INPUT);
                const bareField = await page.box(FIELD);
                assert.ok(
                    Math.abs(bare.left - (bareField.left + inset)) < 1.5,
                    `empty slots must contribute nothing: entry at ${bare.left - bareField.left}px, inset ${inset}px`,
                );
            },
        ));
    });
}

/* ---------------------------------------------------------------------------
 * Cross-geometry: the two standard geometries are genuinely different renderings
 * ------------------------------------------------------------------------- */

test('the bench and the floor render the same field', async () => {
    const read = (geometry) => browser.withPage({ geometry }, async (page) => {
        await page.mount(PLAIN, MODULES);
        await page.setStyle('ui-text-field', { 'inline-size': '420px' });
        return {
            dpr: await page.eval('devicePixelRatio'),
            viewport: await page.eval('innerWidth'),
            field: await page.box(FIELD),
            fontSize: await page.prop(INPUT, 'font-size'),
        };
    });

    const bench = await read(BENCH);
    const floor = await read(FLOOR);

    assert.equal(bench.dpr, 1.5);
    assert.equal(floor.dpr, 1);
    assert.notEqual(bench.viewport, floor.viewport, 'the viewports must actually differ');
    assert.equal(bench.field.height, 64, 'spec §2.2 — control heights are a fixed token, never fluid');
    assert.equal(floor.field.height, 64);
    assert.equal(bench.field.width, 420, 'the container decides the width, at both viewports');
    assert.equal(floor.field.width, 420);
    assert.equal(bench.fontSize, floor.fontSize, 'UI type is fixed steps, never fluid (spec §2.2)');
});
