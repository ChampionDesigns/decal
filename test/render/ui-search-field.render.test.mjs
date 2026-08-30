/**
 * ui-search-field.render.test.mjs — Gate A for Wave 2 item #30, "Search field".
 *
 * Everything here is asserted on COMPUTED style, box geometry and real behaviour
 * through CDP, never on source text (Part 8 §2), at BOTH standard geometries —
 * 1281×801 @ dsf 1.5 (the bench truth) and the 1000×600 floor.
 *
 * THE ROW'S OWN DEFECT, and the assertion that retires it. §5.2 #30: "The 52px left
 * pad is 18 + 20 + 14, undocumented."
 *   CITE  settings-machine-steam #settings-search [i=7] padding-left = 52px  <-
 *         slate-shell.css  `#subpage-host #settings-search`  authored `52px`
 *         !important=no  (FROZEN/hardcoded)
 * The retirement is not "we wrote 54 instead of 52". It is that the well is three
 * tokens added up by the layout engine, so it MOVES when any of the three moves — a
 * frozen literal cannot do that, and the three drills in "the well is arithmetic"
 * below are the proof. No number in this file is compared against a hard-coded 52 or
 * 54: every expectation is computed from the tokens at run time.
 *
 * THE REST OF THE ORACLE UNDER TEST (`themes --state settings-machine-steam --id
 * settings-search`: "15 of 18 properties identical across themes; 3 differ"):
 *   height 64px ← authored `var(--slate-control-height)`      → --ui-control-h
 *   border-top-width 1px, border-top-left-radius 6px          → --ui-border-w, --ui-radius
 *   background-color rgb(26,33,39) / rgb(248,249,249)         → --ui-key
 *   border-top-color rgb(58,72,82) / rgb(203,208,211)         → --ui-line
 *   color rgb(244,247,248) / rgb(23,26,28)                    → --ui-text
 * Each is asserted as the TOKEN it now comes from, never as the number.
 *
 * THE GLYPH has no oracle answer at all — "SVG elements are not in the oracle's
 * element walk" (styles/tokens.css:124) — so its ink comes from a read-only source
 * read (settings.html:20 `text-[var(--text-primary)]`, slate-tokens.css:236
 * `--text-primary: var(--slate-text)` → --ui-text) and is drilled like everything else.
 *
 * THE SIX REQUIRED CLASSES, and where each lives below:
 *   1. token drills, including the three that ARE the row (§"the well is arithmetic",
 *      §"tokens are consumed").
 *   2. focus geometry from --ui-focus-*, unclipped, in both offsets (§"the one ring").
 *   3. container behaviour at the floor (§"reads its own container").
 *   4. bug ids asserted dead — §5.2 #30, T15, E14, L24, L12 (§"bugs …").
 *   5. aria contract (§"the accessible name").
 *   6. hit-area floor (§"the hit floor").
 * Plus the two things composition itself can break: the disabled dial applied once,
 * and events crossing two shadow boundaries.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { assertTokenDrill, assertHitFloor, DRILL_COLOUR, DRILL_LENGTH } from '../harness/assertions.js';

const MODULES = ['/src/components/ui-search-field.js'];

/** The composed field element, and the two boxes inside it that carry the paint. */
const FIELD_EL = 'ui-search-field >>> #field';
const BOX = 'ui-search-field >>> #field >>> #field';
const INPUT = 'ui-search-field >>> #field >>> #control';
const LABEL = 'ui-search-field >>> #field >>> #label';
const WELL = 'ui-search-field >>> .well';
const GLYPH = 'ui-search-field >>> .glyph';

const PLAIN = '<div style="inline-size:600px"><ui-search-field placeholder="Search settings">'
    + '</ui-search-field></div>';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

/**
 * THE MEASUREMENT THE ROW IS ABOUT: where the entry's text box starts, relative to
 * the field's own border box. In Slate this distance is a single frozen `52px`
 * declaration that the glyph, positioned absolutely over it, knows nothing about.
 * Here it is the sum of the boxes actually in the flex line, so it is READ, never
 * declared. Rounded to whole CSS px because at dsf 1.5 lengths snap to device pixels
 * (CONVENTIONS §10 fact 2) and every value it is compared against is an integer.
 */
function entryInset(page) {
    return page.evalFn(() => {
        const host = document.querySelector('ui-search-field');
        const field = host.shadowRoot.querySelector('#field');
        const box = field.shadowRoot.querySelector('#field');
        const input = field.shadowRoot.querySelector('#control');
        return Math.round(input.getBoundingClientRect().left - box.getBoundingClientRect().left);
    });
}

/** A token's rendered length, in px, as a number. */
async function len(page, token) {
    return parseFloat(await page.resolveValue(`var(${token})`, 'padding-left'));
}

/**
 * The ring assertion, in `assertFocusUnclipped`'s shape minus its one assumption that
 * cannot hold here: this component draws no ring of its own at all. The entry takes
 * the focus, the field WRAPPER inside ui-text-field paints the one ring
 * (CONVENTIONS §3, "a wrapper that should show the ring while an inner input takes
 * focus"), and this host — the outer one — must paint nothing, or composition has
 * just invented a second treatment.
 */
async function assertOneRing(page, { offsetToken = '--ui-focus-offset' } = {}) {
    await page.focusVisible(INPUT);

    const inner = await page.focusGeometry(INPUT);
    assert.ok(inner.focusVisible, 'the entry does not match :focus-visible after a keyboard focus');
    assert.equal(inner.outlineStyle, 'none', 'the entry paints no ring of its own — one treatment');

    const host = await page.computed('ui-search-field', ['outline-style']);
    assert.equal(
        host['outline-style'], 'none',
        'the search field HOST paints a ring while its entry is focused — that is a second ring '
        + 'on one control, the thing CONVENTIONS §11 says delegatesFocus must not be turned on for. '
        + '(Measured: with the entry focused the host matches :focus and :focus-within, not '
        + ':focus-visible, which is why it stays none.)',
    );

    const g = await page.focusGeometry(BOX);
    assert.notEqual(g.outlineStyle, 'none', 'the field wrapper paints no focus ring at all');
    assert.equal(
        g.outlineWidth,
        await page.resolveValue('var(--ui-focus-w)', 'outline-width'),
        'the ring is not --ui-focus-w',
    );
    assert.equal(
        g.outlineColor,
        await page.resolveValue('var(--ui-steel)', 'outline-color'),
        'the ring is not --ui-steel',
    );
    assert.equal(
        g.outlineOffset,
        await page.resolveValue(`var(${offsetToken})`, 'outline-offset'),
        `the ring's offset is not ${offsetToken}`,
    );

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
    assert.deepEqual(clipped, [], `bug L24's class: the ring is clipped — ${JSON.stringify(clipped)}`);
    return g;
}

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-search-field @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

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
         * THE WELL IS ARITHMETIC — §5.2 #30, retired
         * ================================================================== */

        test('the entry inset is the sum of three tokens, not a literal', () => mounted(PLAIN, async (page) => {
            // CITE settings-machine-steam #settings-search [i=7] padding-left = 52px
            //      <- slate-shell.css `#subpage-host #settings-search` authored `52px`
            //      !important=no (FROZEN/hardcoded)   — 18 + 20 + 14, undocumented.
            const border = parseFloat(await page.prop(BOX, 'border-left-width'));
            const inset = await len(page, '--ui-space-4');
            const icon = await len(page, '--ui-icon');
            const gap = await len(page, '--ui-space-3');

            const measured = await entryInset(page);
            assert.equal(
                measured, Math.round(border + inset + icon + gap),
                'the entry must start exactly after the field inset, the glyph square and the lead gap.\n'
                + `  border ${border} + --ui-space-4 ${inset} + --ui-icon ${icon} + --ui-space-3 ${gap}`
                + `, measured ${measured}.`,
            );

            // The glyph is the middle term and it is a BOX IN THE FLOW, which is the
            // whole mechanism: Slate's is position:absolute over the pad.
            const well = await page.box(WELL);
            assert.equal(well.width, icon, 'the well is --ui-icon wide');
            assert.equal(well.height, icon, 'the well is --ui-icon tall');
            const box = await page.box(BOX);
            assert.equal(
                Math.round(well.left - box.left), Math.round(border + inset),
                'the glyph sits at the field inset, in flow — nothing is positioned over the pad',
            );
        }));

        test('drill: --ui-space-4 moves the well, so the pad cannot be frozen', () => mounted(PLAIN, async (page) => {
            const before = await entryInset(page);
            const was = await len(page, '--ui-space-4');
            await assertTokenDrill(page, {
                token: '--ui-space-4',
                value: DRILL_LENGTH,
                read: entryInset,
                expected: Math.round(before - was + parseFloat(DRILL_LENGTH)),
            });
        }));

        test('drill: --ui-icon moves the well', () => mounted(PLAIN, async (page) => {
            const before = await entryInset(page);
            const was = await len(page, '--ui-icon');
            await assertTokenDrill(page, {
                token: '--ui-icon',
                value: DRILL_LENGTH,
                read: entryInset,
                expected: Math.round(before - was + parseFloat(DRILL_LENGTH)),
            });
        }));

        test('drill: --ui-space-3 moves the well', () => mounted(PLAIN, async (page) => {
            const before = await entryInset(page);
            const was = await len(page, '--ui-space-3');
            await assertTokenDrill(page, {
                token: '--ui-space-3',
                value: DRILL_LENGTH,
                read: entryInset,
                expected: Math.round(before - was + parseFloat(DRILL_LENGTH)),
            });
        }));

        test('drill: --ui-icon moves the glyph square itself', () => mounted(PLAIN, async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-icon', value: DRILL_LENGTH, selector: WELL, property: 'inline-size',
            });
        }));

        /* ================================================================== *
         * Standing assertion 1 — tokens are consumed, not copied
         * ================================================================== */

        test('drill: --ui-control-h moves the field height', () => mounted(PLAIN, async (page) => {
            // CITE ... height = 64px <- authored `var(--slate-control-height)` (token-driven)
            const drill = await assertTokenDrill(page, {
                token: '--ui-control-h', value: '91px', selector: BOX, property: 'block-size',
            });
            assert.equal(drill.before, '64px', 'the resting height is --ui-control-h');
        }));

        test('drill: --ui-key moves the control face', () => mounted(PLAIN, async (page) => {
            // CITE ... background-color: dark rgb(26,33,39) / light rgb(248,249,249)
            await assertTokenDrill(page, {
                token: '--ui-key', value: DRILL_COLOUR, selector: BOX, property: 'background-color',
            });
        }));

        test('drill: --ui-line moves the edge around the control', () => mounted(PLAIN, async (page) => {
            // CITE ... border-top-color: dark rgb(58,72,82) / light rgb(203,208,211)
            await assertTokenDrill(page, {
                token: '--ui-line', value: DRILL_COLOUR, selector: BOX, property: 'border-top-color',
            });
        }));

        test('drill: --ui-radius moves the corner', () => mounted(PLAIN, async (page) => {
            // CITE ... border-top-left-radius = 6px <- a `[class*="rounded-full"]`
            //      killer rule with !important=yes. Value carried, mechanism not.
            await assertTokenDrill(page, {
                token: '--ui-radius', value: DRILL_LENGTH, selector: BOX, property: 'border-top-left-radius',
            });
        }));

        test('drill: --ui-text moves the glyph ink, and the glyph is NOT muted', () => mounted(PLAIN, async (page) => {
            // No oracle answer for an SVG; read-only source read: settings.html:20
            // `text-[var(--text-primary)]`, slate-tokens.css:236 `--text-primary:
            // var(--slate-text)` -> --ui-text.
            //
            // This also pins a cross-boundary fact that is easy to believe and wrong:
            // ui-text-field paints every adornment ::slotted(*) at --ui-muted from its
            // OWN tree, and this component's .well rule wins because for two normal
            // declarations in different tree contexts the OUTER tree wins whatever the
            // specificity (CSS Scoping §3.3, CONVENTIONS §3a).
            const muted = await page.resolveToken('--ui-muted');
            const ink = await page.prop(WELL, 'color');
            assert.notEqual(ink, muted, 'the search glyph took ui-text-field\'s muted adornment ink');
            await assertTokenDrill(page, {
                token: '--ui-text', value: DRILL_COLOUR, selector: WELL, property: 'color',
            });
        }));

        test('the glyph paints in currentColor, so one ink moves both', () => mounted(PLAIN, async (page) => {
            // Spec §2.3 case 3 keeps stroke widths with the artwork; the INK is the
            // component's. Chrome resolves a `stroke: currentColor` paint to the used
            // colour at computed-value time, but the keyword is accepted too — either
            // spelling proves the artwork carries no colour of its own, which is the
            // assertion. A third value would be a literal in the SVG.
            const wellInk = await page.prop(WELL, 'color');
            const glyphStroke = await page.prop(GLYPH, 'stroke');
            assert.ok(
                glyphStroke === wellInk || glyphStroke === 'currentcolor',
                `the artwork carries its own ink: stroke ${glyphStroke} against the well's ${wellInk}`,
            );
        }));

        test('the entry type carries the library type role, not the screen override', () => mounted(PLAIN, async (page) => {
            // DELIBERATE DEPARTURE, declared: Slate's two search-shaped fields disagree.
            // CITE settings-machine-steam #settings-search [i=7] font-size = 18px <-
            //      slate-shell.css `#subpage-host #settings-search` authored
            //      `var(--slate-text-md)` !important=no (token-driven)
            // against the LIBRARY rule's 17px on `.slate-field`. One component, one
            // type role: `.ui-body` is --ui-text-base (src/components/TYPE_ROLES.md).
            const input = await page.computed(INPUT, ['font-size', 'font-weight', 'font-family']);
            assert.equal(input['font-size'], await page.resolveValue('var(--ui-text-base)', 'font-size'));
            // CITE ... font-weight = 400 <- authored `400` (FROZEN/hardcoded)
            assert.equal(input['font-weight'], await page.resolveValue('var(--ui-weight-regular)', 'font-weight'));
            // CITE themes: font-family `Geist, system-ui, sans-serif` in BOTH themes
            assert.equal(input['font-family'], await page.resolveValue('var(--ui-font-family)', 'font-family'));
        }));

        /* ================================================================== *
         * L12 — no private palette, and zero !important
         * ================================================================== */

        test('zero !important in this component\'s own cascade', () => mounted(PLAIN, async (page) => {
            const hits = await page.evalFn(() => {
                const root = document.querySelector('ui-search-field').shadowRoot;
                let n = 0;
                for (const sheet of root.adoptedStyleSheets) {
                    for (const rule of sheet.cssRules) {
                        if (!rule.style) continue;
                        for (const prop of rule.style) {
                            if (rule.style.getPropertyPriority(prop) === 'important') n += 1;
                        }
                    }
                }
                return n;
            });
            assert.equal(hits, 0, 'spec §2.1 Rule 3 — and nothing can reach in here, so nothing needs one');
        }));

        test('L12: the component declares no --ui-* token of its own', () => mounted(PLAIN, async (page) => {
            const declared = await page.evalFn(() => {
                const root = document.querySelector('ui-search-field').shadowRoot;
                const out = [];
                for (const sheet of root.adoptedStyleSheets) {
                    for (const rule of sheet.cssRules) {
                        if (!rule.style) continue;
                        for (const prop of rule.style) {
                            if (prop.startsWith('--ui-')) out.push(prop);
                        }
                    }
                }
                return out;
            });
            assert.deepEqual(declared, [], 'bug L12 is a private palette shadowing the public tokens');
        }));

        /* ================================================================== *
         * Standing assertion 4 — the one ring, unclipped, in both offsets
         * ================================================================== */

        test('one ring, on the field wrapper, unclipped', () => mounted(PLAIN, async (page) => {
            await assertOneRing(page);
        }));

        test('L24: focus-ring="inset" survives composition and moves the ring inward', () => {
            const markup = '<div style="inline-size:600px;overflow:hidden">'
                + '<ui-search-field focus-ring="inset" placeholder="Search settings"></ui-search-field></div>';
            return mounted(markup, async (page) => {
                // THE FINDING this asserts: --_ui-focus-offset is inherited, but the
                // base declares it on EVERY :host, so ui-text-field's own declaration
                // outranks the value inherited from this host. Without the relay in
                // render() the ring silently stays outset and L24's one-line answer
                // stops at the boundary.
                const g = await assertOneRing(page, { offsetToken: '--ui-focus-offset-inset' });
                const box = await page.box(BOX);
                assert.ok(
                    g.ringRect.left >= box.left - 0.5 && g.ringRect.right <= box.right + 0.5,
                    'an inset ring must be drawn inside its own box',
                );
            });
        });

        /* ================================================================== *
         * Standing assertion 3 — it reads its own container, never the viewport
         * ================================================================== */

        test('the field fills its container and keeps its fixed height', () => {
            const markup = '<div id="pane" style="inline-size:320px"><ui-search-field placeholder="Search">'
                + '</ui-search-field></div>';
            return mounted(markup, async (page) => {
                const pane = await page.box('#pane');
                const box = await page.box(BOX);
                assert.equal(Math.round(box.width), Math.round(pane.width), 'the field fills the container');
                assert.equal(
                    box.height,
                    parseFloat(await page.resolveValue('var(--ui-control-h)', 'block-size')),
                    'spec §2.2: "Control heights, touch targets, hairlines — Fixed token. Never fluid"',
                );
            });
        });

        test('at a 200px container the glyph keeps its square and nothing overflows', () => {
            const markup = '<div id="pane" style="inline-size:200px"><ui-search-field placeholder="Search">'
                + '</ui-search-field></div>';
            return mounted(markup, async (page) => {
                const icon = await len(page, '--ui-icon');
                const well = await page.box(WELL);
                // Bug T9's class: "it is a flex item with default shrink … A touch
                // floor that a parent can shrink is not a floor."
                assert.equal(well.width, icon, 'the glyph shrank with the container');
                assert.equal(well.height, icon, 'the glyph shrank with the container');

                const m = await page.metrics(BOX);
                assert.ok(
                    m.scrollWidth <= m.clientWidth + 0.5,
                    `the field overflows its own box at 200px (scroll ${m.scrollWidth} vs client ${m.clientWidth})`,
                );
                const pane = await page.box('#pane');
                const box = await page.box(BOX);
                assert.ok(box.right <= pane.right + 0.5, 'the field spills out of its container');
            });
        });

        test('no @media query anywhere in the component\'s styles', () => mounted(PLAIN, async (page) => {
            // §2.1 Rule 1: a component reads its own container, never the viewport.
            // The suite runs at two viewports; this is the mechanism check that makes
            // "the same at both" true by construction rather than by coincidence.
            const medias = await page.evalFn(() => {
                const root = document.querySelector('ui-search-field').shadowRoot;
                const out = [];
                for (const sheet of root.adoptedStyleSheets) {
                    for (const rule of sheet.cssRules) {
                        if (rule.constructor.name === 'CSSMediaRule') out.push(rule.conditionText);
                    }
                }
                return out;
            });
            assert.deepEqual(medias.filter((c) => /\d/.test(c)), [], 'no width-keyed @media (spec §2.1 Rule 1)');
        }));

        /* ================================================================== *
         * The hit floor
         * ================================================================== */

        test('the field clears --ui-hit-min with paint alone', () => mounted(PLAIN, async (page) => {
            // The ink IS the box here (64px against a 48px floor), so no hit-area
            // overlay is imported — CONVENTIONS §5, "the overlay exists for a leaf
            // whose ink is SMALLER than the floor".
            await assertHitFloor(page, BOX, { mode: 'box', axes: ['block'] });
        }));

        /* ================================================================== *
         * The accessible name — bugs T15 and E14
         * ================================================================== */

        test('T15: a host-written aria-label is MOVED to the entry, not left on a generic', () => {
            const markup = '<ui-search-field aria-label="Search settings" placeholder="Search settings...">'
                + '</ui-search-field>';
            return mounted(markup, async (page) => {
                const state = JSON.parse(await page.evalFn(() => {
                    const host = document.querySelector('ui-search-field');
                    const input = host.shadowRoot.querySelector('#field')
                        .shadowRoot.querySelector('#control');
                    return JSON.stringify({
                        hostHas: host.hasAttribute('aria-label'),
                        name: input.getAttribute('aria-label'),
                        role: input.type,
                    });
                }));
                // §7.5 T15: "aria-label on role-less divs". A custom element with no
                // role IS one, and Chrome names it anyway — two announcements of one
                // name, the second on a container that does nothing.
                assert.equal(state.hostHas, false, 'the name is still on the role-less host');
                assert.equal(state.name, 'Search settings', 'the entry did not take the name');
            });
        });

        test('the entry always has an accessible name, falling back to the placeholder', () => {
            return mounted(PLAIN, async (page) => {
                const name = await page.evalFn(() => document.querySelector('ui-search-field')
                    .shadowRoot.querySelector('#field').shadowRoot.querySelector('#control')
                    .getAttribute('aria-label'));
                assert.equal(name, 'Search settings', 'T15\'s other half: a control with no name at all');
            });
        });

        test('the glyph is decorative and announced to nobody', () => mounted(PLAIN, async (page) => {
            const hidden = await page.evalFn(() => document.querySelector('ui-search-field')
                .shadowRoot.querySelector('.well').getAttribute('aria-hidden'));
            assert.equal(hidden, 'true', 'Slate gets this right (settings.html:20) and it is carried');
        }));

        test('E14: show-label renders a label whose for/id pairing cannot come apart', () => {
            const markup = '<div style="inline-size:600px">'
                + '<ui-search-field show-label label="Search settings" placeholder="Search settings...">'
                + '</ui-search-field></div>';
            return mounted(markup, async (page) => {
                assert.ok(await page.exists(LABEL), 'no visible label rendered');
                const paired = await page.evalFn(() => {
                    const root = document.querySelector('ui-search-field')
                        .shadowRoot.querySelector('#field').shadowRoot;
                    const label = root.querySelector('#label');
                    const input = root.querySelector('#control');
                    return label.getAttribute('for') === input.id && root.contains(input);
                });
                // §7.4 E14: "settings fields have no for/id pairing". One shadow root,
                // one id, wired in ui-text-field's own render().
                assert.ok(paired, 'the label and the entry are not paired inside one root');
            });
        });

        /* ================================================================== *
         * The disabled dial, applied ONCE across two boundaries
         * ================================================================== */

        test('disabled dims once, not three times, and refuses input', () => {
            const markup = '<ui-search-field disabled placeholder="Search"></ui-search-field>';
            return mounted(markup, async (page) => {
                // resolveValue, not tokenValue: the token is authored `.38` and the
                // engine computes `0.38`, so the raw authored string would never match.
                const dial = await page.resolveValue('var(--ui-opacity-disabled)', 'opacity');
                assert.equal(await page.prop('ui-search-field', 'opacity'), dial);
                assert.equal(
                    await page.prop(FIELD_EL, 'opacity'), '1',
                    'the inner field dims too — .38 x .38 x .38 = .0548, seven times past the dial',
                );
                assert.equal(await page.prop(BOX, 'opacity'), '1');
                assert.ok(
                    await page.evalFn(() => document.querySelector('ui-search-field')
                        .shadowRoot.querySelector('#field').shadowRoot.querySelector('#control').disabled),
                    'the host attribute must also refuse input, not only dim',
                );
            });
        });

        test('drill: --ui-opacity-disabled moves the dim', () => {
            const markup = '<ui-search-field disabled placeholder="Search"></ui-search-field>';
            return mounted(markup, async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-opacity-disabled',
                    value: '0.5',
                    selector: 'ui-search-field',
                    property: 'opacity',
                });
            });
        });

        /* ================================================================== *
         * Behaviour — two shadow boundaries, and the UA control that is not here
         * ================================================================== */

        test('input crosses both shadow boundaries and updates .value', () => mounted(PLAIN, async (page) => {
            await page.recordEvents('ui-search-field', ['input', 'change', 'search']);
            await page.focusVisible(INPUT);
            await page.press('f');
            await page.press('l');
            const seen = await page.recordedEvents();
            assert.equal(seen.filter((e) => e.type === 'input').length, 2, 'one input per keystroke, not two');
            assert.equal(
                await page.evalFn(() => document.querySelector('ui-search-field').value), 'fl',
                'the host property must track the entry',
            );
        }));

        test('Enter emits one search event, whatever the keyboard sends', () => mounted(PLAIN, async (page) => {
            await page.recordEvents('ui-search-field', ['search']);
            await page.focusVisible(INPUT);
            await page.press('c');
            await page.press('Enter');
            const seen = await page.recordedEvents();
            // slate settings.js:8128-8133: "'search' fires on type=search; keep Enter
            // as a fallback for keyboards that send it instead." One event here.
            assert.equal(seen.filter((e) => e.type === 'search').length, 1);
        }));

        test('clear() empties the field and reports it the way the platform does', () => mounted(PLAIN, async (page) => {
            await page.focusVisible(INPUT);
            await page.press('c');
            await page.recordEvents('ui-search-field', ['input', 'search']);
            await page.evalFn(() => { document.querySelector('ui-search-field').clear(); return true; });
            // Lit's update is async, so the entry's own value lands on the next cycle;
            // reading it in the same turn would report the text still there.
            await page.settle(2);
            const after = await page.evalFn(() => document.querySelector('ui-search-field')
                .shadowRoot.querySelector('#field').shadowRoot.querySelector('#control').value);
            const seen = (await page.recordedEvents()).map((e) => e.type);
            assert.equal(after, '', 'the entry still holds text');
            assert.deepEqual(seen, ['input', 'search'], 'the native pair, in the native order');
        }));

        test('no UA clear button is drawn inside the field', () => mounted(PLAIN, async (page) => {
            // MEASURED, and the reason type="search" is not used: with it, a click 10px
            // in from the entry's right edge cleared the value — Chrome's own
            // ::-webkit-search-cancel-button, inside ui-text-field's shadow root, out of
            // reach of every rule this component can write and of every token.
            await page.focusVisible(INPUT);
            await page.press('c');
            await page.press('a');
            const box = await page.box(INPUT);
            await page.click(INPUT, { offset: { x: box.width - 10, y: box.height / 2 } });
            const value = await page.evalFn(() => document.querySelector('ui-search-field').value);
            assert.equal(value, 'ca', 'something inside the field cleared it — a UA affordance is drawing');
        }));

        test('a slotted trailing control gets the seam, and an empty trail costs nothing', () => {
            const withTrail = '<div style="inline-size:600px"><ui-search-field placeholder="Search">'
                + '<button id="clear" slot="trail">clear</button></ui-search-field></div>';
            return mounted(withTrail, async (page) => {
                const input = await page.box(INPUT);
                const button = await page.box('#clear');
                assert.equal(
                    Math.round(button.left - input.right),
                    await len(page, '--ui-space-3'),
                    'a forwarded slot is display:contents, so the gap has to be declared on the '
                    + 'consumer\'s own nodes — the box the inner field targets does not exist',
                );
            });
        });

        test('an empty trail slot adds no dead space', () => mounted(PLAIN, async (page) => {
            const box = await page.box(BOX);
            const input = await page.box(INPUT);
            const border = parseFloat(await page.prop(BOX, 'border-right-width'));
            const inset = await len(page, '--ui-space-4');
            assert.equal(
                Math.round(box.right - input.right), Math.round(border + inset),
                'the entry must run to the field inset when nothing is slotted trailing',
            );
        }));
    });
}
