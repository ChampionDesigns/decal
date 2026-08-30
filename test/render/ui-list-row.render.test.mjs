/**
 * ui-list-row.render.test.mjs — Gate A for component #26 (wave 2, item #26).
 *
 * Runs the whole rig at BOTH standard geometries — 1281×801 @ dsf 1.5 (the bench
 * truth) and the 1000×600 floor — asserting only on computed style, box geometry and
 * behaviour, never on source text (Part 8 §2).
 *
 * THE STANDING CLASSES, and where each lives below:
 *   1. token drill — each token retargeted on :root with the rendered value asserted
 *      to move AND to land on the token;
 *   2. THE DIAL DRILL — assertOneSelectionTreatment on a selected row against an
 *      unselected sibling, plus the assertion this wave exists for: the ONLY painted
 *      differences between a selected row and an unselected one are the four
 *      properties `selectionSurface` writes. A fifth is a private selected look and
 *      fails here rather than shipping (Part 10 §12, spec §3.9);
 *   3. focus geometry from --ui-focus-*, unclipped — on the row inside a real
 *      clipping list, at the inset offset, which is bug L24's class;
 *   4. container behaviour — the row fills its container and reads no viewport; the
 *      title ellipsises in a 240px container instead of shoving a slotted control out;
 *      the 64px row floor holds there and a slotted control is not squeezed below the
 *      48px hit floor;
 *   5. THE BUG, asserted inexpressible — P6: four rows built by four different routes
 *      are byte-identical and literally share one stylesheet object and one
 *      constructor, so "the affordance added to one copy never reached the other" has
 *      no copy to not reach. Plus P8/P11's class: no rule from outside can repaint the
 *      row;
 *   6. the aria contract (spec Appendix 15) — role, both spellings of aria-selected,
 *      and what a slotted trigger does and does not do to the row's own name.
 *
 * ORACLE VALUES ARE ASSERTED LITERALLY where the serialisation is stable. Every
 * literal below carries its CITE line; the component header carries the full set.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * RE-ANCHORED 30 AUGUST 2026 — audit D11, the amputation of the built-in affordance
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * The row used to draw its own `<button id="overflow">`, and NINETEEN tests here
 * touched it. Eight named it as their SUBJECT; the other eleven used it as their
 * PROBE, because it was the only focusable, paintable, box-having child the row had of
 * its own. Deleting it invalidated all nineteen at once, which is why this was parked
 * once (FIXLOG RC-7) rather than done in passing.
 *
 * THE RE-ANCHOR, and it is deliberately not one rule for all nineteen:
 *
 *   ONTO A SLOTTED CONTROL (`slot="actions"`, the arrangement every screen in this
 *   skin actually uses) — the cases where the claim survives the move and gets BETTER
 *   for it, because the thing being asserted is now asserted about the thing the
 *   product really has: the ink dial reaching a row action (by inheritance, with no
 *   rule), the title ellipsising rather than shoving one out, the row not squeezing one
 *   below the hit floor, the press still reaching the list, the trigger's own
 *   aria-expanded, and P12's cost of `role="option"` over an operable child.
 *
 *   ONTO THE HOST — the focus cases. With the affordance gone the row has exactly ONE
 *   focusable thing of its own, and `focus-ring="inset"` is a host attribute whose
 *   whole job is the host's own ring. A control a screen slots brings its own focus
 *   treatment and its own gate-A suite; asserting a ring on it here would be asserting
 *   another component's contract through this one.
 *
 *   DELETED — the assertions whose subject is simply gone and whose claim is not made
 *   anywhere else: the four-token drill on the affordance's own paint, and the [i=23]
 *   halves of the two oracle-record tests. Those oracle readings are NOT lost; they
 *   are kept in the component header as provenance, marked as no longer asserted,
 *   because `slate-shell.css:278-291` is not recorded anywhere else in the repo.
 *
 * WHAT CHANGED IN WHAT IS PROVEN, stated plainly because it is the honest cost: the
 * eleven probe assertions used to prove "the row gives ITS OWN CHILD the ring, the
 * floor, the ink". Nine of them now prove "the row gives A CONSUMER'S CONTROL the
 * floor, the ink, the placement" or "the row gives ITSELF the ring". That is a real
 * assertion and a different one.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import {
    assertTokenDrill,
    assertOneSelectionTreatment,
    assertFocusUnclipped,
    assertHitFloor,
    shadowSegments,
    DRILL_COLOUR,
} from '../harness/assertions.js';

/* ui-badge is a WAVE 1 component, delivered and frozen, and row #26 declares it as a
 * dependency (SCOPE L1545: "depends on #1, #12"). ui-list-row imports it itself, so
 * the list here is one module; it is spelled out because the mount contract wants
 * server-root-relative URLs. */
const MODULE = ['/src/components/ui-list-row.js'];

/* #list is a REAL clipping list: six 64px rows in a 200px box with overflow:auto, so
 * the focus assertions below are not vacuous — L24 is "focus rings clipped on all four
 * sides by the components they sit inside", and a row is only ever inside one of
 * these. #narrow is the container-floor stage; #open is the unclipped control. */
const STAGE_CSS = `
<style>
    #list {
        inline-size: 520px;
        block-size: 200px;
        overflow: auto;
    }
    #narrow { inline-size: 240px; }
    #wide   { inline-size: 720px; }
    .disc {
        display: inline-grid;
        place-items: center;
        inline-size: 48px;
        block-size: 48px;
    }
    /* A CONSUMER'S ROW-ACTIONS TRIGGER, which is the only kind there is since D11.
     * Sized to --ui-hit-min so the row's job — not squeezing it — is measurable.
     * It declares NO color, deliberately: the ink-dial test's whole claim is that
     * color reaches slotted content from the host through the flattened tree with
     * no rule in the component and none here. */
    .rowaction {
        display: inline-grid;
        place-items: center;
        inline-size: 48px;
        block-size: 48px;
        padding: 0;
        border: 0;
        background: transparent;
        font: inherit;
    }
</style>`;

/* `#plain` carries a real <button> because ONE test needs an operable slotted child
 * (P12's cost of role="option"); `#picked`/`#unpicked` carry <span>s because a
 * <button>'s UA `color: buttontext` would mask the inheritance the ink-dial test is
 * about — which is reason (a) in the component header, arriving here as a fact about
 * the stage rather than as prose.
 *
 * `#bare` KEEPS ITS NOW-INERT `no-overflow`, on purpose: the amputation's tolerance
 * claim is that a consumer who never updates is inert rather than broken, and the only
 * way to assert that is to leave one in the stage that never updated. */
const MARKUP = `${STAGE_CSS}
<div id="list">
    <ui-list-row id="plain" tabindex="0">Lever Classic demo<button id="plain-act" slot="actions" class="rowaction" type="button" aria-label="More actions">⋯</button></ui-list-row>
    <ui-list-row id="chip" provenance="from Adaptive v2">Adaptive v3</ui-list-row>
    <ui-list-row id="picked" aria-selected="true">Power<span slot="actions" class="rowaction">⋯</span></ui-list-row>
    <ui-list-row id="unpicked">Default<span slot="actions" class="rowaction">⋯</span></ui-list-row>
    <ui-list-row id="bare" no-overflow>Cleaning / forward flush x5</ui-list-row>
    <ui-list-row id="favoured"><span>Best practice (light roast)</span><span slot="favourite" class="disc">3</span><span slot="actions" class="rowaction">⋯</span></ui-list-row>
</div>
<div id="narrow">
    <ui-list-row id="squeezed">Easy blooming — active pressure decline, long enough to need the clamp<span slot="actions" class="rowaction">⋯</span></ui-list-row>
</div>
<div id="wide">
    <ui-list-row id="open" tabindex="0">Extractamundo Dos!</ui-list-row>
</div>
<div id="routes"></div>`;

/**
 * Every measured value in the component header, in one place, so a drift shows up as
 * one failing assertion with its citation attached rather than as a mystery.
 */
const ORACLE = {
    dark: {
        /* CITE profile-selector .p-3 [i=21] color = rgb(244, 247, 248) <- app.css
         *      `.text-\[var\(--text-primary\)\]` authored `var(--text-primary)` */
        rowInk: 'rgb(244, 247, 248)',
        /* CITE profile-selector #profile-editor-grid [i=6] background-color =
         *      rgb(14, 19, 23) <- slate-shell.css `#subpage-host #profile-editor-grid`
         *      — the ground the transparent row sits on, = --ui-fascia */
        ground: 'rgb(14, 19, 23)',
        /* CITE profile-selector .p-3 [i=21] border-top-color = rgb(58, 72, 82) <-
         *      slate-shell.css `#profile-list > * + *` — the SEPARATOR ink, = --ui-line.
         *      Carried by the container's seam gap, never by this component. */
        seam: 'rgb(58, 72, 82)',
    },
    light: {
        rowInk: 'rgb(23, 26, 28)',
        ground: 'rgb(242, 243, 243)',
        seam: 'rgb(203, 208, 211)',
    },
    /* Theme-independent, from the same records. */
    rowMinHeight: '64px',          // CITE [i=21] min-height = 64px <- var(--slate-list-row)
    rowPaddingLeft: '24px',        // CITE [i=21] padding-left = 24px <- authored 24px
    rowFontSize: '20px',           // CITE [i=21] font-size = 20px <- var(--slate-text-lg)
    rowFontWeight: '400',          // CITE [i=21] font-weight = 400 <- authored 400
    rowRadius: '0px',              // CITE [i=21] border-top-left-radius = 0px
    rowBorderWidth: '0px',         // the separator is the container's gap (CONVENTIONS §13)
    titleLineBox: 30,              // CITE <span> [i=22] height = 30px — 20 × the document 1.5
    /* THE [i=23] ENTRIES WENT ON 30 AUGUST 2026 (D11) — overflowBox/Radius/BorderWidth/
     * FontSize/Face and both themes' overflowInk. They recorded `.slate-profile-more`,
     * the affordance this row no longer draws; asserting them against a consumer's
     * slotted control would be asserting Slate's measurements about something Slate
     * never measured. The readings survive in the component header as provenance. */
    /* CITE slate-shell.css:310 font-weight: 500 on a selected row (and :580's
     * var(--slate-weight-medium) !important, the second copy). Carried since parity
     * surface 2 through --ui-selected-weight, the fifth dial — the row writes no
     * weight rule of its own and the title inherits the host's. */
    selectedWeight: '500',
};

/** The five properties `selectionSurface` writes, and the whole of the treatment.
 *  `font-weight` joined at parity surface 2 (base.js, --ui-selected-weight). */
const DIAL_PROPERTIES = ['background-color', 'color', 'box-shadow', 'text-shadow', 'font-weight'];

/** Everything else worth comparing between a selected row and an unselected one. */
const NON_DIAL_PROPERTIES = [
    'font-size', 'font-family', 'letter-spacing', 'text-transform',
    'border-top-width', 'border-top-color', 'border-top-left-radius',
    'border-bottom-width', 'border-left-width', 'padding-left', 'padding-right',
    'min-height', 'opacity', 'background-image', 'outline-style', 'transform',
    'display', 'align-items', 'gap', 'cursor', 'user-select',
];

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-list-row @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-list-row must mount without throwing');
            return fn(page);
        });

        test('the emulated geometry is the one the suite asked for', () => mounted(async (page) => {
            const env = JSON.parse(await page.eval(
                'JSON.stringify({dpr: devicePixelRatio, w: innerWidth, h: innerHeight})',
            ));
            assert.deepEqual(env, {
                dpr: geometry.deviceScaleFactor,
                w: geometry.width,
                h: geometry.height,
            });
        }));

        /* -- 1. tokens are consumed, not copied ----------------------------- */

        test('drill: the row geometry reads --ui-list-row and --ui-space-5', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-list-row',
                value: '37px',
                selector: '#plain',
                property: 'min-height',
            });
            await assertTokenDrill(page, {
                token: '--ui-space-5',
                value: '37px',
                selector: '#plain',
                property: 'padding-left',
            });
            // --ui-list-row is itself var(--ui-control-h) (tokens.css:226): moving the
            // control height must move the row, or the merge the token sheet recorded
            // ("the old --slate-list-row and --slate-control-height have always been the
            // same number") is a comment rather than a mechanism.
            await assertTokenDrill(page, {
                token: '--ui-control-h',
                value: '37px',
                selector: '#plain',
                property: 'min-height',
            });
        }));

        test('drill: --ui-fascia is the row ground', () => mounted(async (page) => {
            // L12's class: a component holding its own copy of the palette would paint
            // the same and NOT move when the token moves.
            await assertTokenDrill(page, {
                token: '--ui-fascia',
                value: DRILL_COLOUR,
                selector: '#plain',
                property: 'background-color',
            });
        }));

        test('drill: the title reads --ui-text-lg and --ui-weight-regular', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-text-lg',
                value: '37px',
                selector: '#plain >>> #title',
                property: 'font-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-weight-regular',
                value: '700',
                selector: '#plain >>> #title',
                property: 'font-weight',
            });
        }));

        test('drill: the two gaps are --ui-space-3 (row) and --ui-space-2 (lead)', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-space-3',
                value: '37px',
                selector: '#chip',
                property: 'gap',
            });
            await assertTokenDrill(page, {
                token: '--ui-space-2',
                value: '37px',
                selector: '#chip >>> #lead',
                property: 'gap',
            });
        }));

        /* DELETED 30 AUGUST 2026, audit D11: 'drill: the affordance reads --ui-control-h,
         * --ui-radius, --ui-muted, --ui-text-xl'. Those four tokens were read by exactly
         * one rule — `.overflow`, the row's own built-in button — and nothing in this
         * component reads any of them now. A drill is a claim that a token reaches a
         * rendered property; with no rule there is no property to reach, and re-pointing
         * the drill at a consumer's slotted control would assert that the CONSUMER reads
         * --ui-control-h, which this component neither knows nor should. */

        /* -- 2. THE DIAL DRILL: one selection treatment ---------------------- */

        test('the selected row is painted by the four dials and nothing else', () => mounted(async (page) => {
            // The wave's headline obligation (Part 10 §12). This assertion checks that
            // face and ink are the dials', that the LED and the glow MOVE when their
            // dials move (reading a 0px LED off a 0px token proves nothing), and that
            // an unselected sibling stays unpainted.
            const result = await assertOneSelectionTreatment(page, {
                selected: '#picked',
                unselected: '#unpicked',
            });
            assert.ok(result.face && result.ink, 'the dials must resolve to real values');
        }));

        test('NO PRIVATE SELECTED LOOK: the only differences are the five dial properties',
            () => mounted(async (page) => {
                // This is the founding defect made inexpressible. Slate's selected row
                // carried a face that was not the face dial, a font-weight change and a
                // hand-drawn ::before LED bar, all !important (slate-shell.css:304-311,
                // :579-596). Of those three, ONE — the weight — became a value at parity
                // surface 2 and is now the fifth dial, so it is compared against the dial
                // below rather than against the resting row. Anything else of that shape
                // appearing here shows up as a sixth differing property.
                const picked = await page.computed('#picked', NON_DIAL_PROPERTIES);
                const unpicked = await page.computed('#unpicked', NON_DIAL_PROPERTIES);
                const differing = Object.keys(picked).filter((k) => picked[k] !== unpicked[k]);

                // border-top-color is the ONE that legitimately moves, and it is not a
                // treatment: its initial value IS currentColor, so it follows the ink
                // dial by definition. It is in the compared set on purpose — measured,
                // then explained — because dropping it would also drop the thing worth
                // watching, which is whether a border ever gains a WIDTH on selection
                // (Slate's selected row grows an inset shadow rule at
                // slate-shell.css:309). Both readings below prove it paints nothing and
                // is not declared anywhere in this component.
                assert.deepEqual(differing, ['border-top-color'],
                    'a selected row differs from an unselected one somewhere other than the '
                    + 'five dials — that is a sixth selection treatment starting');
                for (const [name, row] of [['selected', picked], ['unselected', unpicked]]) {
                    assert.equal(row['border-top-width'], '0px',
                        `the ${name} row has no border to colour`);
                    assert.equal(row['border-left-width'], '0px');
                    assert.equal(row['border-bottom-width'], '0px');
                }
                const inks = await Promise.all(['#picked', '#unpicked'].map((s) => page.computed(s, ['color', 'border-top-color'])));
                for (const ink of inks) {
                    assert.equal(ink['border-top-color'], ink.color,
                        'border-top-color is the initial currentColor, not a declaration');
                }

                // Parity surface 2 REVERSED what was departure 3: Slate bolds the selected
                // title to 500 and so does this — by inheritance from the host, which the
                // fifth dial paints. The component still writes no weight rule of its own,
                // which is what the drill below proves.
                const weight = await page.prop('#picked >>> #title', 'font-weight');
                const restingWeight = await page.prop('#unpicked >>> #title', 'font-weight');
                assert.equal(weight, ORACLE.selectedWeight,
                    'CITE slate-shell.css:310 — the selected title is Slate\'s 500');
                assert.equal(restingWeight, ORACLE.rowFontWeight,
                    'CITE [i=21] — an unselected title is Slate\'s 400');
                assert.equal(weight, await page.resolveToken('--ui-selected-weight', 'font-weight'),
                    'the 500 is READ from the dial, not written in this component');

                // And the leading bar: no pseudo-element paints anything on a selected row.
                for (const pseudo of ['::before', '::after']) {
                    const p = await page.computed('#picked', ['content', 'background-color'], { pseudo });
                    assert.equal(p.content, 'none',
                        `slate-shell.css:588-596 draws a ${pseudo} steel bar on the selected row; `
                        + 'the LED dial is the sanctioned expression of that and Slate ships it at 0px');
                }
            }));

        /* RE-ANCHORED 30 AUGUST 2026, audit D11. This asserted the ink dial reaching the
         * row's own `#overflow` glyph, which took `color: inherit` from a rule in the
         * component. The rule and the glyph are both gone, and the claim is STRONGER
         * without them: a control a screen slots is in the light tree, so `color`
         * reaches it from the host through the flattened tree with NO rule anywhere —
         * not in the component, not in this stage. Slate needed a rule for this
         * (slate-shell.css:299-302, "On the selected row the muted grey is nearly the
         * fill it sits on"); this arrangement needs none. */
        test('the ink dial reaches a slotted row action, by inheritance and by no rule at all',
            () => mounted(async (page) => {
                const ink = await page.resolveToken('--ui-selected-ink', 'color');
                assert.equal(await page.prop('#picked .rowaction', 'color'), ink,
                    'a slotted control on a selected row takes --ui-selected-ink');
                assert.notEqual(await page.prop('#unpicked .rowaction', 'color'), ink,
                    'and an unselected row does not — so this is the dial, not a default');
                assert.equal(
                    await page.prop('#unpicked .rowaction', 'color'),
                    await page.prop('#unpicked', 'color'),
                    'the resting case is inheritance too: the control is exactly the row\'s ink',
                );

                await assertTokenDrill(page, {
                    token: '--ui-selected-ink',
                    value: DRILL_COLOUR,
                    selector: '#picked .rowaction',
                    property: 'color',
                });
            }));

        test('the LED dial draws on the row, composed with a transparent resting slot',
            () => mounted(async (page) => {
                // The fragment composes rather than replaces: the dial's segment is the
                // LAST one, and a component with no resting shadow contributes a
                // transparent no-op in front of it (base.js, --_ui-rest-shadow).
                await page.setToken('--ui-selected-led', '37px');
                const shadow = await page.prop('#picked', 'box-shadow');
                await page.setToken('--ui-selected-led', null);

                const segments = shadowSegments(shadow);
                assert.equal(segments.length, 2,
                    'two segments: the resting slot, then the dial');
                assert.match(segments.at(-1), /inset/, 'the LED strip is an inset shadow');
                assert.match(segments.at(-1), /-?37px/, "and it carries the dial's length");
            }));

        test('both spellings of the state select the row, and they are one attribute',
            () => mounted(async (page) => {
                const face = await page.resolveToken('--ui-selected-face', 'background-color');

                // The Lit spelling.
                await page.evalFn(() => {
                    document.getElementById('unpicked').selected = true;
                    return true;
                });
                await page.settle(2);
                assert.equal(await page.prop('#unpicked', 'background-color'), face,
                    '.selected = true must select');
                assert.equal(
                    await page.evalFn(() => document.getElementById('unpicked').getAttribute('aria-selected')),
                    'true',
                    'and it must reflect to the aria state — accessibility state and visual '
                    + 'state are the same state (spec Appendix 15)');

                // The Slate spelling, on a row that has never seen the property.
                await page.evalFn(() => {
                    document.getElementById('plain').setAttribute('aria-selected', 'true');
                    return true;
                });
                await page.settle(2);
                assert.equal(await page.prop('#plain', 'background-color'), face,
                    'aria-selected="true" written by a screen must select too');
                assert.equal(
                    await page.evalFn(() => document.getElementById('plain').selected),
                    true,
                    'and it must arrive back on the property');
            }));

        /* -- the measured starting values, both themes ---------------------- */

        test("the resting paint is the oracle's measured values, in both themes", () => mounted(async (page) => {
            for (const theme of ['dark', 'light']) {
                await page.setTheme(theme);
                const want = ORACLE[theme];

                const row = await page.computed('#plain', ['background-color', 'color']);
                assert.equal(row['background-color'], want.ground,
                    `${theme}: --ui-fascia IS the ground Slate's transparent row sat on `
                    + '(CITE #profile-editor-grid [i=6])');
                assert.equal(row.color, want.rowInk, `${theme}: --ui-text (CITE [i=21] color)`);

                /* THE [i=23] PAIR WENT ON 30 AUGUST 2026, audit D11 — they read
                 * `#plain >>> #overflow` for --ui-muted and the transparent face. Both
                 * described `.slate-profile-more`, which this row no longer draws. */

                // The separator ink is unchanged even though this component never draws
                // it: --ui-line is what a seam gap between two rows shows.
                assert.equal(await page.resolveToken('--ui-line', 'color'), want.seam,
                    `${theme}: CITE [i=21] border-top-color — the ink survives the move to a gap`);
            }
        }));

        test('the theme-independent half of the record is carried exactly', () => mounted(async (page) => {
            const row = await page.computed('#plain', [
                'min-height', 'padding-left', 'padding-right', 'font-size', 'font-weight',
                'border-top-left-radius', 'border-top-width', 'box-shadow',
            ]);
            assert.equal(row['min-height'], ORACLE.rowMinHeight, 'CITE [i=21] 64px');
            assert.equal(row['padding-left'], ORACLE.rowPaddingLeft, 'CITE [i=21] 24px');
            assert.equal(row['padding-right'], ORACLE.rowPaddingLeft, 'symmetrical: padding: 0 24px');
            assert.equal(row['font-size'], ORACLE.rowFontSize, 'CITE [i=21] 20px');
            assert.equal(row['font-weight'], ORACLE.rowFontWeight, 'CITE [i=21] 400');
            assert.equal(row['border-top-left-radius'], ORACLE.rowRadius,
                'CITE [i=21] 0px — rows touch, so the corners are square');
            assert.equal(row['border-top-width'], ORACLE.rowBorderWidth,
                'DEPARTURE 2: the 1px separator is the container gap, not a per-row border');
            assert.equal(row['box-shadow'], 'none', 'CITE [i=21] box-shadow = none');

            const rendered = await page.box('#plain');
            assert.equal(Math.round(rendered.height), 64,
                'CITE [i=21] height = 64px — the rendered box, not the rule');

            const title = await page.box('#plain >>> #title');
            assert.equal(Math.round(title.height), ORACLE.titleLineBox,
                'CITE <span> [i=22] height = 30px — 20px × the 1.5 in styles/document.css:64');

            /* THE [i=23] BLOCK WENT ON 30 AUGUST 2026, audit D11 — five assertions on
             * the affordance's radius, border, font-size and 64×64 box. Every one was a
             * measurement of `.slate-profile-more`; the row draws no counterpart and a
             * consumer's slotted control is sized by the consumer, so there is nothing
             * here for the oracle to be right or wrong about. */
        }));

        test('no row in the list draws a separator — the gap does (CONVENTIONS §13)',
            () => mounted(async (page) => {
                const widths = await page.evalFn(() => {
                    const out = [];
                    for (const row of document.querySelectorAll('#list ui-list-row')) {
                        const cs = getComputedStyle(row);
                        out.push([cs.borderTopWidth, cs.borderBottomWidth].join('/'));
                    }
                    return out;
                });
                assert.deepEqual(widths, Array(6).fill('0px/0px'),
                    'bug T2\'s shape — "the > * + * half of the rule can never match" — needs a '
                    + 'per-cell border to exist at all, and there is not one');
            }));

        /* -- 3. focus geometry, unclipped (bug L24's class) ------------------ */

        test('a row inside a clipping list keeps its whole ring (L24)', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, '#plain');
            assert.equal(g.outlineOffset, '-3px',
                '--ui-focus-offset-inset: a list row is flush with its neighbours, so the '
                + 'ring is drawn inside its own box or the list clips it');
            assert.ok(g.clippers.length >= 1,
                'the list must really clip, or this assertion is vacuous');
        }));

        /* RE-ANCHORED ONTO THE HOST, 30 August 2026, audit D11. All three asserted the
         * ring on `#plain >>> #overflow` / `#open >>> #overflow`. With the affordance
         * gone the row has exactly ONE focusable thing of its own — the host — and
         * `focus-ring` is a host attribute whose whole job is the host's own ring. A
         * control a screen slots brings its own focus treatment and its own gate-A
         * suite; a ring assertion on it here would be this suite asserting another
         * component's contract through this one. */

        test('the inset offset is one mechanism, and the attribute is the whole of it',
            () => mounted(async (page) => {
                const inset = await page.evalFn(() => {
                    const el = document.getElementById('plain');
                    return { attr: el.getAttribute('focus-ring'), variant: el.focusVariant };
                });
                assert.deepEqual(inset, { attr: 'inset', variant: 'inset' },
                    'set on connect, and focusVariant reads the real attribute back');

                const g = await assertFocusUnclipped(page, '#plain');
                assert.equal(g.outlineOffset, '-3px', '--ui-focus-offset-inset');

                /* ONE MECHANISM: the offset comes from the token the attribute selects,
                 * so retargeting that token moves the ring and nothing in this file
                 * names a distance. The outset half is asserted on `#open` in the next
                 * test, NOT here — flipping `#plain` to outset inside a real clipping
                 * list is bug L24 itself, and `assertFocusUnclipped` would rightly
                 * refuse it. */
                await assertTokenDrill(page, {
                    token: '--ui-focus-offset-inset',
                    value: '-37px',
                    selector: '#plain',
                    property: 'outline-offset',
                    prepare: (p) => p.focusVisible('#plain'),
                });
            }));

        test('a consumer can still ask for the outset ring, and gets exactly one',
            () => mounted(async (page) => {
                await page.evalFn(() => {
                    document.getElementById('open').setAttribute('focus-ring', 'outset');
                    return true;
                });
                await page.settle(1);
                const g = await assertFocusUnclipped(page, '#open');
                assert.equal(g.outlineOffset, '2px', '--ui-focus-offset');
                assert.equal(
                    await page.evalFn(() => document.getElementById('open').focusVariant),
                    'outset',
                    'focusVariant reports the truth because the attribute is real');
            }));

        test('drill: --ui-steel and --ui-focus-w move the ring', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-steel',
                value: DRILL_COLOUR,
                selector: '#plain',
                property: 'outline-color',
                prepare: (p) => p.focusVisible('#plain'),
            });
            await assertTokenDrill(page, {
                token: '--ui-focus-w',
                value: '37px',
                selector: '#plain',
                property: 'outline-width',
                prepare: (p) => p.focusVisible('#plain'),
            });
        }));

        /* -- 4. container behaviour, and the floor --------------------------- */

        test('the row fills its container and reads no viewport', () => mounted(async (page) => {
            const wide = await page.box('#open');
            assert.equal(Math.round(wide.width), 720, 'the row is as wide as #wide');

            const narrow = await page.box('#squeezed');
            assert.equal(Math.round(narrow.width), 240, 'and as wide as #narrow');

            /* `overflowBox` was one of these five probes until 30 August 2026 (D11).
             * The cross-geometry comparison needs a box the COMPONENT decides, and the
             * affordance was the only one besides the row itself; `titleLineBox` takes
             * its place, since the title's line box is the row's own type arithmetic
             * (--ui-text-lg × the document leading) and would move if anything here
             * read the viewport. */
            acrossGeometries[geometry.name] = {
                rowHeight: Math.round((await page.box('#plain')).height),
                titleLineBox: await page.box('#plain >>> #title')
                    .then((r) => Math.round(r.height)),
                narrowRowHeight: Math.round(narrow.height),
                paddingLeft: await page.prop('#plain', 'padding-left'),
                titleFontSize: await page.prop('#plain >>> #title', 'font-size'),
            };
        }));

        /* RE-ANCHORED 30 August 2026, audit D11: the thing that must not be shoved out
         * of the row is now the control a screen slots, which is the case the product
         * actually has — the selector's rows all carry one and its titles are long. */
        test('DEPARTURE 4: the title ellipsises rather than shoving a slotted control out',
            () => mounted(async (page) => {
                // The oracle is DISQUALIFIED for responsive behaviour (Part 10 §4): Slate
                // is frozen at 1920×1200 and its title span has no overflow treatment at
                // all. LAYOUT_SPEC_DRAFT.md governs.
                const title = await page.computed('#squeezed >>> #title',
                    ['overflow-x', 'text-overflow', 'white-space']);
                assert.equal(title['overflow-x'], 'hidden');
                assert.equal(title['text-overflow'], 'ellipsis');
                assert.equal(title['white-space'], 'nowrap');

                const row = await page.box('#squeezed');
                const action = await page.box('#squeezed .rowaction');
                assert.ok(action.right <= row.right + 0.5,
                    `the slotted control was pushed out of the row: row right ${row.right}, `
                    + `control right ${action.right}`);
                assert.ok(action.left >= row.left,
                    'and it is still inside the row on the leading side');
                assert.equal(Math.round(row.height), 64,
                    'one line, always — a list row that wraps stops being a row');
            }));

        test('the row does not squeeze a slotted control below the 48px hit floor',
            () => mounted(async (page) => {
                /* Appendix 5 / spec §2.3: the floor is physical — "a wet fingertip is
                 * about 9mm; at this panel's density that is ~48px".
                 *
                 * RE-ANCHORED 30 August 2026, audit D11, and the claim MOVED with it.
                 * This asserted 64×64 on the row's own affordance — the component's own
                 * paint clearing the floor. Clearing the floor is now the consumer's
                 * job, on its own control, and what the ROW owes is not to take it
                 * away: the actions slot's flex item must keep its basis while `.lead`
                 * is the one that shrinks (flex: 1 1 auto, min-inline-size: 0). A 240px
                 * container with a 70-character title is where that would go wrong. */
                const got = await assertHitFloor(page, '#squeezed .rowaction', { mode: 'box' });
                assert.equal(got.inline, 48,
                    'the control is exactly the size the stage gave it — the row shrank '
                    + 'the title instead');
                assert.equal(got.block, 48);
            }));

        test('the row grows past its floor rather than clipping a two-line title',
            () => mounted(async (page) => {
                await page.setStyle('#squeezed >>> #title', { 'white-space': 'normal' });
                const grown = await page.box('#squeezed');
                assert.ok(grown.height >= 64,
                    'min-block-size is a FLOOR, not a height — a row with more in it grows');
                const inner = await page.box('#squeezed >>> #lead');
                assert.ok(inner.bottom <= grown.bottom + 0.5,
                    'and nothing is clipped out of the bottom of the row');
            }));

        test('no viewport query decides anything here', () => mounted(async (page) => {
            // The row keeps the base's container-type: inline-size and asks no width
            // question of its own; what changes its layout is its CONTAINER.
            const before = await page.computed('#open', ['min-height', 'padding-left', 'gap']);
            await page.setStyle('#wide', { 'inline-size': '300px' });
            const after = await page.computed('#open', ['min-height', 'padding-left', 'gap']);
            assert.deepEqual(after, before,
                'nothing in this component is size-keyed, so a container change moves the '
                + 'box and not the paint');
            const box = await page.box('#open');
            assert.equal(Math.round(box.width), 300, 'and the box did follow the container');
        }));

        /* -- 5. THE BUG, asserted inexpressible ------------------------------ */

        /* RE-ANCHORED 30 August 2026, audit D11. This asserted that four routes carry
         * a byte-identical AFFORDANCE — its tag, glyph, name, haspopup and 64×64 box.
         * The affordance is gone; the argument never needed it. P6 is that one component
         * makes divergence inexpressible, so what the four routes must agree about is
         * the ROW: the same shadow ids, the same host attributes, the same box, and —
         * the mechanical half — literally the same CSSStyleSheet objects and the same
         * constructor. That half is unchanged below and is the stronger of the two. */
        test('P6: four rows built four different ways are one row',
            () => mounted(async (page) => {
                // LAYOUT_SPEC_DRAFT.md:1135 — "the profile row is implemented twice (177
                // and 126 lines, byte-identical class strings) ... the affordance added to
                // the first never reached the second". There is one class and one template
                // here, so the four construction routes a screen might use cannot diverge.
                const built = await page.evalFn(() => {
                    const host = document.getElementById('routes');
                    host.innerHTML = '<ui-list-row id="r1">One</ui-list-row>';
                    const r2 = document.createElement('ui-list-row');
                    r2.id = 'r2';
                    r2.textContent = 'Two';
                    host.appendChild(r2);
                    const r3 = document.getElementById('r1').cloneNode(true);
                    r3.id = 'r3';
                    host.appendChild(r3);
                    const r4 = document.createElement('ui-list-row');
                    r4.id = 'r4';
                    r4.setAttribute('aria-selected', 'false');
                    r4.textContent = 'Four';
                    host.appendChild(r4);
                    return ['r1', 'r2', 'r3', 'r4'];
                });
                await page.settle(3);
                assert.deepEqual(built, ['r1', 'r2', 'r3', 'r4']);

                const shapes = await page.evalFn(() => {
                    const out = [];
                    for (const id of ['r1', 'r2', 'r3', 'r4']) {
                        const el = document.getElementById(id);
                        const box = el.getBoundingClientRect();
                        out.push({
                            ids: [...el.shadowRoot.querySelectorAll('[id]')].map((n) => n.id).join(','),
                            slots: [...el.shadowRoot.querySelectorAll('slot')]
                                .map((n) => n.getAttribute('name') ?? '(default)').join(','),
                            h: Math.round(box.height),
                            role: el.getAttribute('role'),
                            focusRing: el.getAttribute('focus-ring'),
                            tabindex: el.getAttribute('tabindex'),
                        });
                    }
                    return out;
                });
                const [first, ...rest] = shapes;
                for (const [i, shape] of rest.entries()) {
                    assert.deepEqual(shape, first,
                        `route ${i + 2} built a row that differs from route 1 — that is P6, and `
                        + 'it should not be reachable through a single component');
                }
                assert.equal(first.slots, '(default),favourite,actions',
                    'every row offers the same three slots in the same order — a screen '
                    + 'cannot get a row with nowhere to put its actions');
                assert.ok(!first.ids.includes('overflow'),
                    'and no row draws a built-in affordance any more (D11)');

                // The mechanical half: every instance shares ONE stylesheet object, so a
                // rule added to the component is added to every row that exists. THIS is
                // why the defect cannot be expressed, rather than merely is not.
                const shared = await page.evalFn(() => {
                    const sheetsOf = (id) => document.getElementById(id).shadowRoot.adoptedStyleSheets;
                    const a = sheetsOf('r1');
                    const b = sheetsOf('r4');
                    const c = document.getElementById('plain').shadowRoot.adoptedStyleSheets;
                    return {
                        count: a.length,
                        sameAsR4: a.length === b.length && a.every((s, i) => s === b[i]),
                        sameAsMarkupRow: a.length === c.length && a.every((s, i) => s === c[i]),
                        ctorShared: document.getElementById('r1').constructor
                            === document.getElementById('plain').constructor
                            && document.getElementById('r1').constructor === customElements.get('ui-list-row'),
                    };
                });
                assert.ok(shared.count >= 2, 'base styles plus the component styles at least');
                assert.ok(shared.sameAsR4 && shared.sameAsMarkupRow,
                    'all rows must share the same CSSStyleSheet objects');
                assert.ok(shared.ctorShared, 'and the same constructor');
            }));

        test('P8/P11 class: no rule from OUTSIDE can repaint the row', () => mounted(async (page) => {
            // P11 is this row's own bug — "Selecting a profile toggles three classes that
            // cannot paint" — and its mechanism is three sheets able to reach one element,
            // which is why slate-shell.css:304-311 needs !important on four declarations.
            // The mechanism that stops it here is REACH, not specificity, so the defect's
            // own shape is injected at higher specificity with !important on top.
            const props = ['background-color', 'color', 'font-weight', 'min-height', 'padding-left'];
            const beforeRow = await page.computed('#picked', props);
            const beforeTitle = await page.computed('#picked >>> #title', props);
            const beforeLead = await page.computed('#picked >>> #lead', props);

            await page.evalFn(() => {
                const s = document.createElement('style');
                s.id = 'p11-shell-rule';
                s.textContent = [
                    '#list ui-list-row *, #list ui-list-row span, #list ui-list-row button {',
                    '  background: transparent !important;',
                    '  background-color: transparent !important;',
                    '  color: inherit !important;',
                    '  font-weight: 500 !important;',
                    '  min-height: 89px !important;',
                    '  padding-left: 30px !important;',
                    '}',
                ].join('\n');
                document.head.appendChild(s);
                return true;
            });
            await page.settle(2);

            assert.deepEqual(await page.computed('#picked >>> #title', props), beforeTitle,
                'a screen sheet reached into the component and repainted its title');
            /* RE-ANCHORED 30 August 2026, audit D11: the second probe was the row's own
             * affordance. `#lead` takes its place — it is a shadow child the injected
             * rule names explicitly (`#list ui-list-row *`) and carries four of the five
             * properties, so the reach test is not weakened by the swap. What a consumer
             * SLOTS is deliberately not probed here: slotted content is in the light
             * tree and a screen sheet reaching it is not P11, it is the screen styling
             * its own element. */
            assert.deepEqual(await page.computed('#picked >>> #lead', props), beforeLead,
                'a screen sheet reached into the component and repainted its leading group');
            // The HOST is reachable from outside, deliberately — that is the theming
            // escape hatch — so it is not asserted frozen here. What matters is that the
            // row's INSIDES are not, which is the whole of P11's mechanism.
            assert.ok(beforeRow['background-color'], 'the host reading is taken for the record');
        }));

        /* -- 6. the aria contract (spec Appendix 15) ------------------------- */

        test('DEPARTURE 7: the row states NO role — the list owns the pattern, so it owns the role',
            () => mounted(async (page) => {
                /* THE btn* KEYS WENT ON 30 August 2026, audit D11 — btnName, btnPopup,
                 * btnType and btnExpanded described the row's own affordance. What is
                 * left is the whole of the row's aria contract, which was always the
                 * subject of this test: it states NO role, and it reflects aria-selected
                 * in BOTH states for whatever role a list gives it. */
                const shape = await page.evalFn(() => {
                    const el = document.getElementById('plain');
                    return {
                        role: el.getAttribute('role'),
                        selectedAttr: el.getAttribute('aria-selected'),
                        selectedProp: el.selected,
                        pickedAttr: document.getElementById('picked').getAttribute('aria-selected'),
                        pickedProp: document.getElementById('picked').selected,
                        hostTabindex: el.getAttribute('tabindex'),
                        shadowButtons: el.shadowRoot.querySelectorAll('button').length,
                    };
                });
                assert.deepEqual(shape, {
                    role: null,
                    selectedAttr: 'false',
                    selectedProp: false,
                    pickedAttr: 'true',
                    pickedProp: true,
                    hostTabindex: '0',
                    shadowButtons: 0,
                }, 'Slate\'s role="option" (profile_selector.js:784) is DISQUALIFIED: that line '
                    + 'is inside bug P12, whose complaint is "non-option children inside the '
                    + 'listbox". The row used to render one itself (LAYOUT_SPEC_DRAFT.md:1141) '
                    + 'and since D11 renders none — but a consumer may still SLOT one, so the '
                    + 'role stays the list\'s to state. aria-selected is reflected in BOTH '
                    + 'states for whatever role arrives.');
            }));

        test('a role the consumer states is left exactly alone, in either direction',
            () => mounted(async (page) => {
                const got = await page.evalFn(async () => {
                    const stage = document.getElementById('list');
                    const made = (attrs) => {
                        const el = document.createElement('ui-list-row');
                        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
                        el.textContent = 'Stated';
                        stage.append(el);
                        return el;
                    };
                    const asOption = made({ role: 'option' });
                    const asRow = made({ role: 'row' });
                    await Promise.all([asOption.updateComplete, asRow.updateComplete]);
                    const out = { option: asOption.getAttribute('role'), row: asRow.getAttribute('role') };
                    asOption.remove();
                    asRow.remove();
                    return out;
                });
                assert.deepEqual(got, { option: 'option', row: 'row' },
                    'the list that built the pattern states the role and the component never argues');
            }));

        /* RE-ANCHORED 30 August 2026, audit D11. The operable child used to be the row's
         * own `#overflow` button; it is now `#plain-act`, the <button> the STAGE slots
         * into `slot="actions"`. That is the only way a row can have an operable child
         * now, and it is exactly the case departure 7 defers to the list — the row
         * cannot consent on the list's behalf to a cost it does not know it is paying,
         * because it does not know what its consumer will slot. */
        test('WHY: stating role="option" over a row carrying an operable slotted control is not free',
            () => mounted(async (page) => {
                /* The measurement behind departure 7, taken from the engine rather than
                 * from the ARIA text. ARIA 1.2 lists `option` as children-presentational,
                 * i.e. the button should not be operable at all; Chrome does not prune it,
                 * it FOLDS ITS NAME INTO THE OPTION'S. Either outcome is a cost the row
                 * cannot consent to on the list's behalf, so this asserts the disjunction
                 * and records the reading of the day in the failure message. */
                await page.send('Accessibility.enable');
                const read = async () => {
                    const { nodes } = await page.send('Accessibility.getFullAXTree', { depth: -1 });
                    const btn = nodes.find((n) => (n.name?.value ?? '') === 'More actions');
                    /* THE ROW IS FOUND BY ITS ROLE, not by walking up from the button.
                     * A slotted control is a child of the row in the FLATTENED tree,
                     * which is what the AX tree is computed over — but the row's own
                     * generic wrapper sits between them, so the button's immediate AX
                     * parent is not the option. What this test is about is the OPTION's
                     * name, so ask the option. */
                    const option = nodes.find((n) => !n.ignored && n.role?.value === 'option');
                    return {
                        btnIgnored: btn ? btn.ignored === true : true,
                        ownerRole: option?.role?.value ?? null,
                        ownerName: option?.name?.value ?? '',
                    };
                };

                await page.evalFn(() => {
                    document.getElementById('plain').setAttribute('role', 'option');
                    return true;
                });
                await page.settle(2);
                const asOption = await read();
                await page.evalFn(() => {
                    document.getElementById('plain').removeAttribute('role');
                    return true;
                });
                await page.settle(2);
                const asShipped = await read();

                /* CHANGED 29 AUGUST 2026, audit F-016 #8, AND THIS ONE IS A RESULT
                 * RATHER THAN AN ADJUSTMENT. The assertion here was:
                 *
                 *     assert.ok(
                 *         asOption.btnIgnored || asOption.ownerName.includes('More actions'),
                 *         'with role="option" stated, the affordance is expected either to be pruned '
                 *         + '(ARIA children-presentational) or to have its name absorbed into the '
                 *         + `option's; measured: ${JSON.stringify(asOption)}`,
                 *     );
                 *
                 * — a DISJUNCTION over two bad outcomes, written because at the time
                 * those were the only two the engine offered, and departure 7 is built
                 * on there being no third. There is now a third and this row takes it:
                 * the row names ITSELF, so name-from-content never runs, so the
                 * affordance is neither pruned NOR absorbed. Measured here as the
                 * conjunction the old line could not have passed: the option keeps its
                 * own name, exactly its title, and the button keeps its own beside it.
                 *
                 * WHAT THIS DOES NOT OVERTURN: departure 7's actual conclusion, that the
                 * ROLE is the list's to state and not the row's. It removes one of the
                 * two costs the departure was weighing, and the P12 tab-stop cost — a
                 * <button> inside a listbox is a focusable non-option child — is
                 * untouched and is still the reason `selector-screen` passes
                 * `no-overflow` on every row it draws. */
                assert.equal(asOption.ownerName, 'Lever Classic demo',
                    'the option announces its own title and nothing else: a labelled '
                    + `affordance no longer folds into it (F-016 #8). Measured: ${JSON.stringify(asOption)}`);
                assert.equal(asOption.btnIgnored, false,
                    'and the slotted control is still a real exposed control with its own '
                    + 'name — the row was named, not the button silenced. THE TAB-STOP COST '
                    + 'IS UNTOUCHED: a focusable non-option child is still P12, which is why '
                    + 'selector-screen slots a <span> with no tabindex and not a <button>');
                assert.equal(asShipped.btnIgnored, false,
                    'as shipped — no role stated — the slotted control is a real exposed button');
                assert.equal(asShipped.ownerName, '',
                    'and no ancestor takes its name over: the row announces its title, once. '
                    + `Measured: ${JSON.stringify(asShipped)}`);
            }));

        /* ===================================================================
         * F-016 #8 — A NAMED AFFORDANCE THAT DOES NOT COST THE ROW ITS NAME
         *
         * Wave 1 found sixteen controls with no accessible name and #8 was the
         * selector's row-actions trigger. It has none because naming it used to rename
         * the ROW: a treeitem is named from its contents and a labelled descendant is
         * part of them, so the screen was choosing between an unnamed control and
         * seventy-eight rows announcing "Alpha bloom Loaded More actions for Alpha
         * bloom". The row now names itself, which is what makes both possible at once.
         * ================================================================= */

        test('F-016 #8: a labelled trigger in the actions slot does not enter the row\'s name',
            () => mounted(async (page) => {
                await page.evalFn(() => {
                    const el = document.getElementById('plain');
                    el.setAttribute('role', 'treeitem');
                    el.setAttribute('provenance', 'Loaded');
                    const trigger = document.createElement('span');
                    trigger.slot = 'actions';
                    trigger.id = 'trigger';
                    trigger.setAttribute('aria-label', 'More actions for Lever Classic demo');
                    trigger.textContent = '⋯';
                    el.append(trigger);
                    return true;
                });
                await page.settle(3);

                await page.send('Accessibility.enable');
                const { nodes } = await page.send('Accessibility.getFullAXTree', { depth: -1 });
                const named = nodes.filter((n) => !n.ignored)
                    .map((n) => ({ role: n.role?.value ?? '', name: n.name?.value ?? '' }));
                const row = named.find((n) => n.role === 'treeitem');

                /* THE ROW'S OWN NAME STAYS CLEAN — the whole point. It is exactly the
                 * string the engine composed before anything was labelled: the title,
                 * then the provenance chip. */
                assert.ok(row, `the row must be exposed as a treeitem — saw ${JSON.stringify(named)}`);
                assert.equal(row.name, 'Lever Classic demo Loaded',
                    'the row announces its own content and nothing else; the affordance\'s '
                    + `name must not be folded in (F-016 #8). Saw ${JSON.stringify(named)}`);
                assert.ok(!row.name.includes('More actions'),
                    'this is the exact string the selector measured and parked on');

                /* AND THE TRIGGER IS NAMED — the finding's own half. It is announced
                 * through the tree's full text, not as a role-bearing node, because a
                 * span with an aria-label and no role and no tabindex is deliberately
                 * NOT operable: a button here is P12's "non-option children inside the
                 * listbox" and costs a tab stop per row. */
                const everyString = nodes.filter((n) => !n.ignored)
                    .flatMap((n) => [n.name?.value, n.value?.value])
                    .filter((s) => typeof s === 'string' && s.trim());
                assert.ok(everyString.includes('More actions for Lever Classic demo'),
                    `the trigger must carry a name of its own — saw ${JSON.stringify(everyString)}`);
            }));

        test('F-016 #8: the row keeps a name a consumer wrote, and stays silent with no role',
            () => mounted(async (page) => {
                const got = await page.evalFn(async () => {
                    const stage = document.getElementById('list');

                    /* A consumer's own label is never overwritten. */
                    const mine = document.createElement('ui-list-row');
                    mine.setAttribute('role', 'treeitem');
                    mine.setAttribute('aria-label', 'The name the screen chose');
                    mine.textContent = 'Something else entirely';
                    stage.append(mine);

                    /* An unroled row is a generic box; naming it would announce a
                     * container on top of the text inside it. */
                    const unroled = document.createElement('ui-list-row');
                    unroled.textContent = 'No role here';
                    stage.append(unroled);

                    await Promise.all([mine.updateComplete, unroled.updateComplete]);
                    const out = {
                        consumerLabel: mine.getAttribute('aria-label'),
                        unroledLabel: unroled.getAttribute('aria-label'),
                    };

                    /* …and the moment a list DOES state a role, the row names itself. */
                    unroled.setAttribute('role', 'treeitem');
                    await new Promise((r) => { setTimeout(r, 0); });
                    out.afterRole = unroled.getAttribute('aria-label');

                    mine.remove();
                    unroled.remove();
                    return out;
                });
                assert.equal(got.consumerLabel, 'The name the screen chose',
                    'a name the consumer wrote is left alone');
                assert.equal(got.unroledLabel, null,
                    'an unroled row writes no aria-label: a name on a generic is announced '
                    + 'on top of the text it already contains');
                assert.equal(got.afterRole, 'No role here',
                    'and it names itself as soon as the list gives it a role');
            }));

        /* RE-ANCHORED 30 August 2026, audit D11, and the mechanism it exists to defend is
         * the same one. A shadow root forwards no aria-*, so a menu toggling
         * `aria-expanded` on the HOST would be announcing to a role-less generic. The
         * `overflow-expanded` / `overflow-label` attributes existed to relay that state
         * across the boundary to the row's own button. With the trigger slotted, the
         * consumer holds the real control and writes on it directly — there is no
         * boundary left to relay across, which is the better answer to the same problem.
         * THIS ASSERTS THE HOST STAYS OUT OF IT, because the failure it guards against
         * is a consumer writing the state on the row and it going nowhere. */
        test('the opener state lives on the slotted control, and the host is not a relay',
            () => mounted(async (page) => {
                await page.evalFn(() => {
                    const el = document.getElementById('plain');
                    // What a menu actually does: write on its own trigger.
                    el.querySelector('#plain-act').setAttribute('aria-expanded', 'true');
                    // And the retired API, written by a consumer that never updated.
                    el.setAttribute('overflow-expanded', 'true');
                    el.setAttribute('overflow-label', 'More actions for Lever Classic demo');
                    return true;
                });
                await page.settle(2);
                const got = await page.evalFn(() => {
                    const el = document.getElementById('plain');
                    return {
                        triggerExpanded: el.querySelector('#plain-act').getAttribute('aria-expanded'),
                        triggerName: el.querySelector('#plain-act').getAttribute('aria-label'),
                        shadowButtons: el.shadowRoot.querySelectorAll('button').length,
                        hostName: el.getAttribute('aria-label'),
                    };
                });
                assert.deepEqual(got, {
                    triggerExpanded: 'true',
                    triggerName: 'More actions',
                    shadowButtons: 0,
                    hostName: null,
                }, 'the trigger carries its own state and its own name; the retired '
                    + 'attributes are INERT — they render nothing and, critically, the '
                    + 'stale `overflow-label` did NOT become the row\'s own name');
            }));

        /* INVERTED 30 August 2026, audit D11. This asserted the OPT-OUT: `#bare` has
         * `no-overflow` so it renders no affordance, every other row does render one.
         * The default moved. A row now draws no actions control at all and a list that
         * wants one slots it, so there is nothing to opt out of — and the three retired
         * attributes had to stay TOLERATED, because eleven consumer sites were carrying
         * them and the component change had to be safe to land in either order. `#bare`
         * is the stage's untouched consumer and this is the tolerance assertion. */
        test('the retired opt-out is inert, not broken, and a bare row is the default',
            () => mounted(async (page) => {
                assert.equal(await page.exists('#plain >>> #overflow'), false,
                    'no row draws a built-in affordance any more');
                assert.equal(await page.exists('#bare >>> #overflow'), false,
                    'including the one that still asks not to');

                const bare = await page.evalFn(() => {
                    const el = document.getElementById('bare');
                    return {
                        attr: el.hasAttribute('no-overflow'),
                        // `undefined` does not survive the CDP round trip, so ask the
                        // question that does: is there a property behind the attribute?
                        propDeclared: 'noOverflow' in el,
                        actionsAssigned: el.shadowRoot
                            .querySelector('slot[name="actions"]').assignedNodes().length,
                    };
                });
                assert.deepEqual(bare, { attr: true, propDeclared: false, actionsAssigned: 0 },
                    'the attribute sits on the host doing nothing: Lit observes no property '
                    + 'for it, so a consumer that never updated is INERT rather than broken');

                // And it is not load-bearing geometry in either direction.
                assert.equal(Math.round((await page.box('#bare')).height), 64);
                assert.equal(
                    Math.round((await page.box('#bare')).height),
                    Math.round((await page.box('#unpicked')).height),
                    'a row with a slotted control and one without measure the same',
                );
            }));

        /* -- events and slots ------------------------------------------------ */

        /* CHANGED 29 AUGUST 2026, audit F-009. This asserted the emit:
         *
         *     assert.deepEqual(seen, [{
         *         target: 'plain', anchorId: 'overflow', composed: true, bubbles: true,
         *     }], 'the event must cross the shadow boundary retargeted to the ROW, and carry '
         *         + 'the anchor a menu (#21) will position against');
         *
         * No screen ever heard it, and the affordance that raised it is rendered nowhere
         * in the product — every `<ui-list-row>` in `src/` passes `no-overflow`. The
         * menu that #21 was supposed to position arrived instead through `slot="actions"`,
         * positioning itself against its own trigger, which is the thing an event could
         * not do. What is asserted now is the removal AND the one behaviour that was
         * never the handler's: the press still reaches the list, because the emit's
         * absence of `stopPropagation` is now simply an absence of any listener. */
        test('a press on a slotted row action announces nothing, and still reaches the list',
            () => mounted(async (page) => {
                await page.evalFn(() => {
                    window.__seen = [];
                    window.__clicks = 0;
                    const list = document.getElementById('list');
                    list.addEventListener('overflow', (e) => {
                        window.__seen.push({ target: e.target.id });
                    });
                    list.addEventListener('click', () => { window.__clicks += 1; });
                    return true;
                });
                await page.click('#plain #plain-act');
                await page.settle(2);
                const got = await page.evalFn(() => ({ seen: window.__seen, clicks: window.__clicks }));
                assert.deepEqual(got.seen, [],
                    'no `overflow` event exists to hear — the emit went with F-009 and the '
                    + 'affordance that raised it with D11');
                assert.equal(got.clicks, 1,
                    'and the press is NOT swallowed: it reaches the list, which is how the '
                    + 'row a menu acts on gets selected. The row adds no listener and no '
                    + 'stopPropagation to a slotted control, so this is bubbling and nothing '
                    + 'else — the same behaviour the built-in button had, for the same reason');
            }));

        test('the favourite disc is slotted, placed by the row, and rings itself',
            () => mounted(async (page) => {
                // Component #35 is a PARALLEL row in this same wave, so this row depends on
                // a slot rather than on it. The row owns placement and the gap; the disc
                // owns its own paint.
                /* RE-ANCHORED 30 August 2026, audit D11: the thing the disc sits before,
                 * and the thing the missing-disc gap is measured to, was the row's own
                 * affordance. Both are now the slotted actions control — which is what
                 * Slate's ordering was always about (the disc, then row actions). */
                const row = await page.box('#favoured');
                const disc = await page.box('#favoured .disc');
                const action = await page.box('#favoured .rowaction');
                assert.ok(disc.left > row.left, 'the disc is not crowding the title');
                assert.ok(disc.right <= action.left + 0.5,
                    'and it sits before the row actions, as Slate orders them '
                    + '(profile_selector.js:811 then :886)');
                assert.equal(Math.round(action.right), Math.round(row.right - 24),
                    'row actions end on the row\'s own 24px inset (CITE [i=21] padding) — '
                    + 'the row owns the placement even though it does not own the control');

                // An empty favourite slot must not leave a gap behind it.
                const plainLead = await page.box('#plain >>> #lead');
                const plainAction = await page.box('#plain #plain-act');
                assert.equal(
                    Math.round(plainAction.left - plainLead.right), 12,
                    'exactly one --ui-space-3 gap when there is no disc — the slot is '
                    + 'display: contents, so an unassigned slot contributes no flex item');
            }));

        test('the provenance chip is a ui-badge and keeps the badge treatment', () => mounted(async (page) => {
            // DEPARTURE 5: slate-shell.css:313-321 reaches into the row and repaints the
            // chip as a pipe-separated span with !important on four declarations. Nothing
            // can reach into a shadow root, so it stays a badge.
            const shape = await page.evalFn(() => {
                const el = document.getElementById('chip').shadowRoot.getElementById('provenance');
                return { tag: el ? el.tagName : null, text: el ? el.textContent.trim() : null };
            });
            assert.deepEqual(shape, { tag: 'UI-BADGE', text: 'from Adaptive v2' });

            const badge = await page.computed('#chip >>> #provenance >>> #badge',
                ['background-color', 'border-left-width', 'border-top-left-radius']);
            assert.notEqual(badge['background-color'], 'rgba(0, 0, 0, 0)',
                'a badge is its face — slate-shell.css:318 background: transparent !important '
                + 'cannot reach it');
            assert.equal(badge['border-left-width'], '0px',
                'and slate-shell.css:316 border-left: 1px solid var(--slate-line-strong) cannot either');
            assert.equal(badge['border-top-left-radius'], '6px', '--ui-radius, the badge\'s own');

            assert.equal(await page.exists('#plain >>> #provenance'), false,
                'a row with no provenance renders no chip at all');
        }));

        test('zero !important reaches the rendered result', () => mounted(async (page) => {
            // slate-shell.css carries 268 of them and every one exists because some other
            // sheet could reach the same element (CONVENTIONS §6). Nothing can reach in
            // here, so a plain rule in the same root must win.
            /* RE-ANCHORED 30 August 2026, audit D11: the probe was `#overflow.overflow`,
             * the row's own affordance. `#title.title` takes its place — a shadow child
             * the component really does declare rules on (the DEPARTURE 4 clamp), so a
             * later plain rule in the same root has something to beat. */
            await page.evalFn(() => {
                const root = document.getElementById('plain').shadowRoot;
                const s = document.createElement('style');
                s.textContent = '#title.title { text-overflow: clip }';
                root.appendChild(s);
                return true;
            });
            await page.settle(2);
            assert.equal(await page.prop('#plain >>> #title', 'text-overflow'), 'clip',
                'a later plain rule in the same root must win — no !important in the component');
        }));
    });
}

describe('the same box at both geometries', () => {
    test('every measured width and height is geometry-independent', () => {
        const names = Object.keys(acrossGeometries);
        assert.equal(names.length, GATE_A_GEOMETRIES.length,
            'both geometry blocks must have run before this comparison means anything');
        const [first, ...rest] = names;
        for (const name of rest) {
            assert.deepEqual(acrossGeometries[name], acrossGeometries[first],
                `ui-list-row renders differently at ${name} than at ${first} — `
                + 'something read the viewport (spec §2.1 Rule 1)');
        }
    });
});

describe('the gallery entry this component ships', () => {
    // The entry lives in its own file (tools/gallery/entries/ui-list-row.entry.js)
    // because twelve wave-2 builders cannot all append to one array under a whole-file
    // write rule; the wave's single cross-cutting writer wires it into
    // tools/gallery/entries.js. The ENTRY's own correctness is this builder's problem.

    test('every declared state mounts, settles and paints', async () => {
        const { entry } = await import('../../tools/gallery/entries/ui-list-row.entry.js');

        assert.equal(entry.id, 'ui-list-row', 'the entry id is the tag name is the file name');
        assert.equal(entry.module, '../../src/components/ui-list-row.js',
            'module is relative to tools/gallery/, which is where gallery.js imports it from');
        assert.ok(entry.states.length >= 3);
        assert.equal(new Set(entry.states.map((s) => s.id)).size, entry.states.length,
            'state ids are capture filenames, so they must be unique');

        await browser.withPage({ geometry: GATE_A_GEOMETRIES[0] }, async (page) => {
            for (const state of entry.states) {
                const wrapper = state.hostStyle
                    ? `<div id="stage" style="${Object.entries(state.hostStyle)
                        .map(([k, v]) => `${k}:${v}`).join(';')}">${state.html}</div>`
                    : `<div id="stage">${state.html}</div>`;
                await page.mount(wrapper, MODULE);
                assert.deepEqual(page.pageErrors, [], `${entry.id}--${state.id} threw`);

                const painted = await page.evalFn(() => {
                    const el = document.querySelector('ui-list-row');
                    if (!el || !el.shadowRoot) return null;
                    const title = el.shadowRoot.getElementById('title');
                    if (!title) return null;
                    const r = el.getBoundingClientRect();
                    return { w: r.width, h: r.height, bg: getComputedStyle(el).backgroundColor };
                });
                assert.ok(painted, `${entry.id}--${state.id} rendered no row at all`);
                assert.ok(painted.w > 0 && painted.h >= 64,
                    `${entry.id}--${state.id} rendered a ${painted.w}×${painted.h} box`);
                assert.notEqual(painted.bg, 'rgba(0, 0, 0, 0)',
                    `${entry.id}--${state.id} paints no ground — CONVENTIONS §13 trap 1, `
                    + 'a cell that paints nothing is a hole');
            }
        });
    });
});
