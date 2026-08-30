/**
 * type-roles.render.test.mjs - Gate A for component #13, the type roles.
 *
 * Row #13 is one of the two wave-1 rows that ships NO element (SCOPE.md:1531: "Dissolves
 * into the token layer plus a shared style module rather than an element"), so what is
 * under test is a `css` fragment - `src/components/type-roles.js` - applied to PLAIN
 * ELEMENTS inside a component's shadow root. `test/fixtures/type-roles-fixture.js` is
 * the subject; it makes no design decisions and every value asserted below comes from
 * the module or from a token.
 *
 * Runs at both Gate A geometries - 1281x801 @ dsf 1.5 (the bench truth) and the
 * 1000x600 floor - and asserts on computed style and box geometry, never on source
 * text (Part 8 §2).
 *
 * WHAT IS PROVED HERE, in the order the blocks appear:
 *   1. each of the six roles lands on its §3.5 token, with the oracle's own number
 *      asserted literally where the serialisation is stable;
 *   2. the token drill - twelve tokens retargeted on :root, each rendered value moving
 *      AND landing on the token, then restored. This is also bug L12's class: a layer
 *      that had copied the palette privately would not move;
 *   3. the five declared departures from Slate, asserted AS departures with both
 *      numbers named, so drifting back to Slate's value is a red test too;
 *   4. the two anti-T11 mechanisms ("the loading/empty states are authored centred and
 *      rendered left-aligned by three shell rules - four call sites affected"):
 *      the zero-specificity one - a component's own bare element selector and its own
 *      class both beat a role, with no !important in either sheet - AND the one
 *      specificity cannot supply, a role declaring no alignment at all, so an ancestor
 *      that centres reaches the type by inheritance;
 *  4b. the LIGHT-DOM door (DQ-2-C): a role class outside a shadow root is inert, and
 *      `adoptTypeRoles(root)` is the one thing that makes it live — both halves
 *      asserted, because the inert half is a trap that reports nothing;
 *   5. the UI scale is never fluid and the display scale always is, both measured
 *      against the COMPONENT's container rather than the viewport (spec §2.1 Rule 1,
 *      §2.2);
 *   6. a11y: text-transform is paint - the accessible name keeps the authored case.
 *
 * NOT ASSERTED, deliberately: the focus ring and the hit floor. A type role is not
 * interactive and never becomes focusable; the elements that carry one are headings and
 * paragraphs. CONVENTIONS §5 names the hit utility's three consumers (#15, #23, #35) and
 * this is not one of them.
 *
 * ORACLE CARVE-OUT, quoted because it decides a value here: `prov_query.py` answers
 * "property not probed" for `line-height` and for `text-align` - "The provenance probe
 * measured an 18-property appearance surface and nothing else." `line-height` comes
 * from the Slate source read-only (`slate-components.css:81-136`), which is the
 * documented fallback, and the test asserts the ratios rather than a probe value.
 * `text-align` is the source read the module DECLINES - Slate's `left !important` is
 * bug T11 - so what is asserted below is the initial value showing through.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { assertTokenDrill, DRILL_COLOUR, DRILL_LENGTH } from '../harness/assertions.js';

const FIXTURE = ['/test/fixtures/type-roles-fixture.js'];
const MARKUP = '<div id="frame"><type-roles-fixture></type-roles-fixture></div>';

const S = (id) => `type-roles-fixture >>> #${id}`;

/** parseFloat on a computed length, so 33.6px and "33.6px" compare as numbers. */
const px = (value) => Number.parseFloat(value);

/** Whole CSS px, for lengths the engine may snap at dsf 1.5 (CONVENTIONS §10). */
const near = (got, want, tol, what) =>
    assert.ok(
        Math.abs(px(got) - want) <= tol,
        `${what}: expected ${want} +/- ${tol}, got ${got}`,
    );

let browser;

before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`type roles @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        /* ===================================================================
         * 1. THE SIX ROLES LAND ON THEIR TOKENS
         * =================================================================== */

        test('title: 28px / 500 / --ui-text ink, on an h1 whose UA margin is zeroed', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                /* ORACLE settings-calibration-fan .slate-title [i=45] font-size = 28px
                 * winning rule slate-components.css {.slate-title} authored
                 * `var(--slate-text-xl)`; font-weight = 500 authored
                 * `var(--slate-weight-medium)`; color = rgb(244, 247, 248) authored
                 * `var(--slate-text)`. */
                const got = await page.computed(S('title'), [
                    'font-size', 'font-weight', 'color', 'line-height', 'text-align',
                    'margin-top', 'margin-bottom', 'font-family',
                ]);

                assert.equal(got['font-size'], '28px');
                assert.equal(got['font-weight'], '500');
                assert.equal(got.color, await page.resolveToken('--ui-text', 'color'));
                near(got['line-height'], 28 * 1.2, 0.5, 'title line-height is 1.2');
                assert.equal(got['text-align'], 'start');

                /* The UA gives an h1 0.67em of block margin. The role zeroes it: spacing
                 * is the layout's job, from --ui-space-*. */
                assert.equal(got['margin-top'], '0px');
                assert.equal(got['margin-bottom'], '0px');

                /* No @font-face in a component (CONVENTIONS §7): the family arrives by
                 * inheritance from styles/document.css. */
                assert.match(got['font-family'], /Geist/);
            });
        });

        test('the same role reads identically on a div and on an h1', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const props = ['font-size', 'font-weight', 'color', 'line-height',
                    'margin-top', 'margin-bottom', 'text-align'];
                const semantic = await page.computed(S('title'), props);
                const generic = await page.computed(S('title-div'), props);

                assert.deepEqual(generic, semantic,
                    'a role that renders differently on <h1> than on <div> is a trap - '
                    + 'the whole reason the block roles zero the UA margin');
            });
        });

        test('heading: 20px / 500 / --ui-text ink, line-height 1.3', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                /* ORACLE settings-calibration-fan .slate-heading [i=46] font-size = 20px
                 * authored `var(--slate-text-lg)`; font-weight = 500; color =
                 * rgb(244, 247, 248). */
                const got = await page.computed(S('heading'),
                    ['font-size', 'font-weight', 'color', 'line-height', 'margin-top']);

                assert.equal(got['font-size'], '20px');
                assert.equal(got['font-weight'], '500');
                assert.equal(got.color, await page.resolveToken('--ui-text', 'color'));
                near(got['line-height'], 20 * 1.3, 0.5, 'heading line-height is 1.3');
                assert.equal(got['margin-top'], '0px');
            });
        });

        test('caption: 16px / 400 / --ui-muted, capped at --ui-measure and well short of its container', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                /* ORACLE settings-calibration-fan .slate-caption [i=47] font-size = 16px
                 * authored `var(--slate-text-note)`; font-weight = 400 authored
                 * `var(--slate-weight-regular)`; color = rgb(148, 161, 169) authored
                 * `var(--slate-muted)`. */
                const got = await page.computed(S('caption'), [
                    'font-size', 'font-weight', 'color', 'line-height', 'display',
                    'max-inline-size', 'margin-top', 'text-align',
                ]);

                assert.equal(got['font-size'], '16px');
                assert.equal(got['font-weight'], '400');
                assert.equal(got.color, await page.resolveToken('--ui-muted', 'color'));
                near(got['line-height'], 16 * 1.5, 0.5, 'caption line-height is 1.5');
                assert.equal(got.display, 'block');
                assert.equal(got['margin-top'], '0px');
                assert.equal(got['text-align'], 'start');

                /* 70ch, resolved by the engine against the caption's own font. The
                 * assertion that matters is the SHAPE: the copy stops at the cap and
                 * does not run the width of a wall panel. */
                const cap = px(got['max-inline-size']);
                const box = await page.box(S('caption'));
                const frame = await page.box('#frame');

                assert.ok(cap > 0 && Number.isFinite(cap), `70ch resolved to ${got['max-inline-size']}`);
                near(box.width, cap, 1, 'the caption fills its measure');
                assert.ok(box.width < frame.width - 40,
                    `the caption (${box.width}) must stop short of its container (${frame.width})`);
            });
        });

        test('body: 17px / 400, and no ink of its own', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                /* ORACLE settings-machine-machine-info .slate-body [i=51] font-size =
                 * 17px authored `var(--slate-text-base)`; font-weight = 400. The ink in
                 * Slate came from a SECOND class on the element - color =
                 * rgb(244, 247, 248) winning rule slate-components.css {.slate-text} -
                 * so inheriting it is the same appearance with one fewer class. */
                const got = await page.computed(S('body'),
                    ['font-size', 'font-weight', 'color', 'line-height']);

                assert.equal(got['font-size'], '17px');
                assert.equal(got['font-weight'], '400');
                near(got['line-height'], 17 * 1.5, 0.5, 'body line-height is 1.5');
                assert.equal(got.color, await page.resolveToken('--ui-text', 'color'),
                    'inherited from styles/document.css, not declared by the role');
            });
        });

        test('microcap: 15px / 700 / --ui-muted / uppercase / --ui-tracking-cap', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                /* ORACLE expanded-charts .slate-microcap [i=168] font-size = 15px
                 * authored `var(--slate-text-cap)`; text-transform = uppercase authored
                 * `uppercase`; color = rgb(148, 161, 169) authored `var(--slate-muted)`.
                 * The weight and the tracking are the two declared departures, below. */
                const got = await page.computed(S('microcap'),
                    ['font-size', 'font-weight', 'color', 'text-transform',
                        'letter-spacing', 'line-height']);

                assert.equal(got['font-size'], '15px');
                assert.equal(got['text-transform'], 'uppercase');
                assert.equal(got.color, await page.resolveToken('--ui-muted', 'color'));
                near(got['line-height'], 15 * 1.2, 0.5, 'microcap line-height is 1.2');
            });
        });

        test('numeric is a modifier: tabular figures, and nothing else', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                /* ORACLE expanded-charts #expanded-compliance-badge [i=166] font-size =
                 * 18px, font-weight = 500, color = rgb(148, 161, 169), each "(no
                 * declaration - inherited or initial value)": .slate-numeric set none of
                 * them, and neither does .ui-numeric. */
                const inside = await page.computed(S('numeric-inline'),
                    ['font-variant-numeric', 'font-size', 'font-weight', 'color']);
                const host = await page.computed(S('body'),
                    ['font-size', 'font-weight', 'color']);

                /* Chrome re-orders the shorthand into its canonical grammar order, so the
                 * authored `tabular-nums lining-nums` computes as `lining-nums
                 * tabular-nums`. Asserted as a SET, so the test says what it means and a
                 * serialisation change is not a false failure. */
                assert.deepEqual(
                    inside['font-variant-numeric'].split(/\s+/).sort(),
                    ['lining-nums', 'tabular-nums'],
                );
                assert.equal(inside['font-size'], host['font-size']);
                assert.equal(inside['font-weight'], host['font-weight']);
                assert.equal(inside.color, host.color);
            });
        });

        test('tabular figures are real: two equal-length digit strings occupy the same width', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const a = await page.box(S('numeric-a'));
                const b = await page.box(S('numeric-b'));

                near(`${a.width}px`, b.width, 0.5,
                    'tabular-nums: a changing readout must not jitter');
            });
        });

        /* ===================================================================
         * 2. THE TOKEN DRILL - tokens are consumed, not copied (bug L12's class)
         * =================================================================== */

        test('the drill: every role value moves with its token and lands on it', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                await assertTokenDrill(page, {
                    token: '--ui-text-xl', value: DRILL_LENGTH,
                    selector: S('title'), property: 'font-size',
                });
                await assertTokenDrill(page, {
                    token: '--ui-text-lg', value: DRILL_LENGTH,
                    selector: S('heading'), property: 'font-size',
                });
                await assertTokenDrill(page, {
                    token: '--ui-text-note', value: DRILL_LENGTH,
                    selector: S('caption'), property: 'font-size',
                });
                await assertTokenDrill(page, {
                    token: '--ui-text-base', value: DRILL_LENGTH,
                    selector: S('body'), property: 'font-size',
                });
                await assertTokenDrill(page, {
                    token: '--ui-text-sm', value: DRILL_LENGTH,
                    selector: S('microcap'), property: 'font-size',
                });
                await assertTokenDrill(page, {
                    token: '--ui-muted', value: DRILL_COLOUR,
                    selector: S('caption'), property: 'color',
                });
                await assertTokenDrill(page, {
                    token: '--ui-text', value: DRILL_COLOUR,
                    selector: S('title'), property: 'color',
                });
                await assertTokenDrill(page, {
                    token: '--ui-weight-medium', value: '800',
                    selector: S('heading'), property: 'font-weight',
                });
                await assertTokenDrill(page, {
                    token: '--ui-weight-semibold', value: '200',
                    selector: S('microcap'), property: 'font-weight',
                });
                await assertTokenDrill(page, {
                    token: '--ui-tracking-cap', value: DRILL_LENGTH,
                    selector: S('microcap'), property: 'letter-spacing',
                });
                await assertTokenDrill(page, {
                    token: '--ui-measure', value: DRILL_LENGTH,
                    selector: S('caption'), property: 'max-inline-size',
                });
                await assertTokenDrill(page, {
                    token: '--ui-display-md', value: DRILL_LENGTH,
                    selector: S('readout'), property: 'font-size',
                });
            });
        });

        /* ===================================================================
         * 3. THE DECLARED DEPARTURES FROM SLATE, asserted as departures
         * =================================================================== */

        test('the microcap is Slate\'s own 600, and the departure is closed', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                /* ORACLE expanded-charts .slate-microcap [i=168] font-weight = 600
                 * winning rule slate-components.css {.slate-microcap} authored
                 * `var(--slate-weight-semibold)`.
                 *
                 * THIS WAS A DEPARTURE AND IS NOT ONE ANY MORE (parity surface 1). The
                 * token sheet shipped three weights (400/500/700) on the authority of
                 * LAYOUT_SPEC_DRAFT §3.5, whose own citation — slate-tokens.css:148-153 —
                 * declares FOUR: regular 400, medium 500, semibold 600, light 300. The
                 * same sentence mis-transcribed --slate-tracking-cap as .04em, which
                 * surface 0 had already reversed. The corpus settles it: 496 records
                 * render 600 and the only 700s are 51 elements of one Tailwind
                 * `font-bold` utility on a modal title. So the role is 600, which is what
                 * the oracle it was derived from says. */
                const weight = await page.prop(S('microcap'), 'font-weight');
                assert.equal(weight, '600', 'the microcap role is Slate\'s semibold');
                assert.equal(weight, await page.tokenValue('--ui-weight-semibold'));
            });
        });

        test('the microcap tracks Slate\'s 1.8px', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                /* ORACLE expanded-charts .slate-microcap [i=168] letter-spacing = 1.8px
                 * winning rule slate-components.css {.slate-microcap} authored
                 * `var(--slate-tracking-cap)` (.12em at 15px).
                 *
                 * THE DEPARTURE IS GONE — parity surface 0. This used to assert 0.6px
                 * on the authority of LAYOUT_SPEC_DRAFT §3.5, which writes ".04em" while
                 * citing slate-tokens.css:148-153 — the lines that declare .12em. The
                 * spec's own citation contradicts its number, so there was never a
                 * disagreement to resolve in .04em's favour. Slate's rendered corpus is
                 * unanimous the other way: every uppercase element carrying a tracking
                 * in the 49 baseline states clusters at .12em (140 at 15px + 50 at
                 * 17px), and nothing clusters at .04em. */
                const tracking = await page.prop(S('microcap'), 'letter-spacing');
                near(tracking, 1.8, 0.05, 'microcap tracking is .12em at 15px');
                assert.ok(Math.abs(px(tracking) - 0.6) > 1, `the .04em departure is gone, got ${tracking}`);
            });
        });

        test('departure: the numeric role does not restate the font family', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                /* ORACLE expanded-charts #expanded-compliance-badge [i=166] font-family =
                 * `Geist, system-ui, sans-serif` winning rule slate-components.css
                 * {.slate-numeric} authored `var(--slate-font-numeric)`.
                 * styles/tokens.css:346-348: "One family, not two: the old
                 * --slate-font-numeric was already defined as var(--slate-font-ui)."
                 * The family must therefore be INHERITED here, which is what lets a
                 * component choose a family and have its numbers follow. Proof: give the
                 * fixture's own subtree a different family and the numeric role must
                 * move with it. */
                const before = await page.prop(S('numeric-inline'), 'font-family');
                assert.match(before, /Geist/);

                await page.setStyle('#frame', { 'font-family': 'monospace' });
                const after = await page.prop(S('numeric-inline'), 'font-family');
                assert.equal(after, 'monospace',
                    'a restated family token would have pinned this back to Geist');
            });
        });

        /* ===================================================================
         * 4. THE ZERO-SPECIFICITY MECHANISM (bug T11's class, from both sides)
         * =================================================================== */

        test('a component\'s bare element selector beats a role, with no !important', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                /* The roles are authored inside :where() - (0,0,0) - so the fixture's own
                 * `h3 { font-size: var(--ui-text-note) }` at (0,0,1) wins. Slate needed
                 * !important on every declaration in this block because a global class
                 * could be reached from any sheet; nothing can reach into a shadow root,
                 * so the reason is gone (spec §2.1 Rule 3). */
                const overridden = await page.prop(S('override'), 'font-size');
                const heading = await page.prop(S('heading'), 'font-size');

                assert.equal(overridden, '16px', 'the component rule wins');
                assert.equal(heading, '20px', 'and only for the element it names');
                assert.notEqual(overridden, heading);
            });
        });

        test('T11 does not recur: a component that wants centred copy gets it', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                /* Bug T11: "The loading/empty states are authored centred and rendered
                 * left-aligned by three shell rules - four call sites affected"
                 * (slate-shell.css:1304-1306, 1326-1328, 1244-1250). A role declares no
                 * alignment at all, so `start` here is the INITIAL VALUE showing
                 * through, not a rule - and the fixture's own `.centred` wins on the
                 * element that asks for it. */
                assert.equal(await page.prop(S('caption'), 'text-align'), 'start');
                assert.equal(await page.prop(S('caption-centred'), 'text-align'), 'center');
            });
        });

        test('T11, the half specificity cannot reach: centring an ANCESTOR reaches the type', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                /* The T11 shape that :where() does NOT defend against, and the one the
                 * Slate empty states were authored in: the container centres, and every
                 * descendant is expected to follow. `text-align` is inherited, and ANY
                 * declaration on the element beats an inherited value however low its
                 * specificity - inheritance is only consulted when nothing applies. So
                 * `:where(.ui-title) { text-align: start }` was T11 with no rule to
                 * out-specify. MEASURED before the declarations came out: caption and
                 * title `start` while #heading and #body, which never declared it, read
                 * `center`. Now all four follow.
                 *
                 * #frame is in the light tree and the roles are inside a shadow root:
                 * inherited properties cross the boundary, which is the whole reason a
                 * declaration in the shared layer was able to stop them. */
                const roles = ['title', 'title-div', 'heading', 'caption', 'body'];

                await page.setStyle('#frame', { 'text-align': 'center' });
                for (const id of roles) {
                    assert.equal(await page.prop(S(id), 'text-align'), 'center',
                        `#${id} did not follow the ancestor's centring - that is bug T11`);
                }

                /* And back: nothing is latched, and the initial value returns. */
                await page.setStyle('#frame', { 'text-align': 'start' });
                for (const id of roles) {
                    assert.equal(await page.prop(S(id), 'text-align'), 'start', `#${id}`);
                }
            });
        });

        test('the module does nothing until a class asks for it', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const unroled = await page.computed(S('unroled'),
                    ['font-size', 'font-weight', 'text-transform', 'font-variant-numeric']);

                assert.equal(unroled['text-transform'], 'none');
                assert.equal(unroled['font-variant-numeric'], 'normal');
                assert.equal(unroled['font-weight'], '400');
                assert.notEqual(unroled['font-size'], '28px');
            });
        });

        /* ===================================================================
         * 4b. THE LIGHT DOM — the trap DQ-2-C fell into, pinned in both
         *     directions (parity surface 4)
         *
         * A role class outside a shadow root is INERT, and nothing says so: no
         * warning, no failing selector, no missing element — the markup reads
         * exactly like every styled caption in the app and renders unstyled
         * copy at no measure. That is how eight spans in the editor's Gate B
         * fixture shipped at --ui-text, two of them 914px wide, through four
         * parity surfaces. Both halves are asserted here so neither the trap
         * nor its door can go quiet: the class alone must NOT style, and
         * `adoptTypeRoles(root)` must make the same element read exactly like
         * the shadow-root caption two hundred lines up.
         * =================================================================== */

        test('a role in the LIGHT DOM is inert until adoptTypeRoles asks for it', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                /* Built the way a driver outside the component layer builds one —
                 * createElement plus a class name, which is verbatim what
                 * test/fixtures/editor-shell-fixture.js does. */
                await page.evalFn(() => {
                    const span = document.createElement('span');
                    span.id = 'light-caption';
                    span.className = 'ui-caption';
                    span.textContent = 'Explanatory copy under a label.';
                    document.body.append(span);
                    return true;
                });
                await page.settle();

                const muted = await page.resolveToken('--ui-muted', 'color');
                const inert = await page.computed('#light-caption',
                    ['color', 'max-inline-size', 'display']);

                assert.notEqual(inert.color, muted,
                    'THE TRAP: the class alone reaches no rule, so the ink is inherited');
                assert.equal(inert['max-inline-size'], 'none', 'and there is no measure cap');
                assert.equal(inert.display, 'inline', 'and a span is still an inline span');

                /* THE DOOR. Imported in the page, so what is exercised is the export
                 * a fixture would call and not a copy of its two lines. */
                await page.eval("import('/src/components/type-roles.js')"
                    + '.then(function (m) { m.adoptTypeRoles(document); return true; })');
                await page.settle();

                const live = await page.computed('#light-caption',
                    ['color', 'max-inline-size', 'display', 'font-size', 'font-weight']);

                assert.equal(live.color, muted, 'the caption ink is --ui-muted');
                assert.equal(live.display, 'block');
                assert.equal(live['font-size'], '16px');
                assert.equal(live['font-weight'], '400');
                near(live['max-inline-size'],
                    px(await page.prop(S('caption'), 'max-inline-size')), 1,
                    'the same --ui-measure the shadow-root caption is capped at');
            });
        });

        /* ===================================================================
         * 5. BOTH SCALES ARE FIXED PX — the display scale stopped being fluid at
         *    parity surface 0
         * =================================================================== */

        test('neither scale moves when the container narrows', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const wide = await page.computed(S('readout'), ['font-size']);
                const wideTitle = await page.prop(S('title'), 'font-size');

                /* The HOST is narrowed, not the viewport — the same probe that used to
                 * prove the display clamp read its own container. --ui-display-md was
                 * clamp(32px, 3.4cqi, 42px); it is now the fixed 42px Slate declares
                 * (slate-tokens.css:144), because the clamp's floors were
                 * LAYOUT_SPEC_DRAFT §3.5 PROPOSALS that the spec itself says "want a look
                 * on the bench" and never got one, while its ceilings were already
                 * Slate's numbers. A readout that shrinks with its container is not
                 * something Slate does anywhere.
                 *
                 * The probe is kept and inverted: it now proves the readout HOLDS, which
                 * is the property Ben asked for. */
                await page.setStyle('#frame', { 'inline-size': '600px' });

                const narrow = await page.computed(S('readout'), ['font-size']);
                const narrowTitle = await page.prop(S('title'), 'font-size');

                assert.equal(narrow['font-size'], wide['font-size'],
                    `display type holds its size: ${wide['font-size']} -> ${narrow['font-size']}`);
                assert.equal(narrow['font-size'], '42px', 'and it is Slate\'s --slate-display-md');
                assert.equal(narrowTitle, wideTitle,
                    'the UI scale is fixed px, never fluid (spec §2.2): legibility is a floor');
                assert.equal(narrowTitle, '28px');
            });
        });

        /* ===================================================================
         * 6. A11Y - the uppercase is paint, not the name
         * =================================================================== */

        test('text-transform is paint: the accessible name keeps the authored case', async () => {
            await browser.withPage({ geometry }, async (page) => {
                await page.mount(MARKUP, FIXTURE);

                const rendered = await page.prop(S('microcap'), 'text-transform');
                const name = await page.evalFn(
                    (s) => window.__h.need(s).textContent.trim(),
                    S('microcap'),
                );

                assert.equal(rendered, 'uppercase');
                assert.equal(name, 'Pressure',
                    'a screen reader announces the authored case; only the paint shouts');
            });
        });
    });
}
