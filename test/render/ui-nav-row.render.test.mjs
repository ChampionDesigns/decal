/**
 * ui-nav-row.render.test.mjs — Gate A for component #24 (wave 2, item #24).
 *
 * Runs the whole rig at BOTH standard geometries — 1281×801 @ dsf 1.5 (the bench truth)
 * and the 1000×600 floor — asserting only on computed style, box geometry and behaviour,
 * never on source text (Part 8 §2).
 *
 * THE STANDING CLASSES, and where each lives below:
 *   1. token drill — eleven tokens retargeted on :root with the rendered value asserted
 *      to move AND to land on the token, plus the DERIVATION drill that decision C4
 *      turns on: --ui-nav-row is calc((--ui-control-h + 2 × --ui-space-3) × --ui-density)
 *      and all three inputs must move it;
 *   2. THE DIAL DRILL — assertOneSelectionTreatment on a current row against a resting
 *      sibling, plus the assertion this wave exists for: the ONLY painted differences
 *      between the two are the four properties `selectionSurface` writes, and only ONE
 *      box in the component changes at all (Part 10 §12, spec §3.9);
 *   3. focus geometry from --ui-focus-*, unclipped — inside a real clipping column, at
 *      the inset offset, which is bug L24's class;
 *   4. container behaviour — the row fills its container and reads no viewport; the label
 *      ellipsises in a 200px column instead of widening it; the 88px pitch and the 48px
 *      hit floor both hold there;
 *   5. THE THREE BUGS, asserted inexpressible — T5 (the 4px LED that wins a specificity
 *      fight), T3 (the 6px radius that wins the same kind of fight), T2 (the pitch and
 *      the separator that come from a sibling selector that cannot match);
 *   6. the aria contract (spec Appendix 15) — aria-current on the announced element, in
 *      the one state that carries it, from both spellings of the property.
 *
 * ONE GEOMETRY IS DELIBERATELY NOT GEOMETRY-INDEPENDENT, and it is the only one in the
 * component: --ui-nav-row carries × var(--ui-density), and styles/tokens.css:929-933
 * declares `@media (height < 700px) { :root { --ui-density: 0.875 } }` — the ONE global
 * query the architecture allows (CONVENTIONS §2). So the row is 88px at BENCH and 77px
 * at FLOOR by design, and the suite asserts exactly that: the arithmetic, at both
 * geometries, plus the proof that pinning --ui-density makes the two agree to the pixel.
 *
 * ORACLE VALUES ARE ASSERTED LITERALLY where the serialisation is stable. Every literal
 * below carries its CITE line; the component header carries the full set.
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

const MODULE = ['/src/components/ui-nav-row.js'];

/* #category is a REAL clipping column — ten 88px rows in a 300px box with overflow:auto,
 * which is Slate's own shape (settings.html:27, `overflow-y-auto`, ten categories) — so
 * the focus assertions are not vacuous. #subcategory is the SECOND column, and it exists
 * for one reason: T2 is "the sub-category column does not align with the category
 * column", so the pitch has to be compared across two containers that share nothing but
 * a token. #narrow is the container-floor stage. Both columns draw their seams as grid
 * gaps (CONVENTIONS §13), which is what replaces the per-row border. */
const STAGE_CSS = `
<style>
    #category, #subcategory {
        display: grid;
        gap: var(--ui-seam);
        background-color: var(--ui-line);
        align-content: start;
        inline-size: 260px;
        block-size: 300px;
        overflow: auto;
    }
    #subcategory { inline-size: 338px; }
    #narrow { inline-size: 200px; }
    #wide { inline-size: 520px; }
</style>`;

const CATEGORIES = [
    'Machine', 'Accessories', 'Connections', 'Calibration', 'Maintenance',
    'Display', 'Units & Language', 'Extensions', 'Updates', 'Help',
];

const MARKUP = `${STAGE_CSS}
<div id="category">
    <ui-nav-row id="current" current>${CATEGORIES[0]}</ui-nav-row>
    ${CATEGORIES.slice(1).map((name, i) => `<ui-nav-row id="cat${i + 1}">${name}</ui-nav-row>`).join('\n    ')}
</div>
<div id="subcategory">
    <ui-nav-row id="sub0" current>Water tank</ui-nav-row>
    <ui-nav-row id="sub1">Steam</ui-nav-row>
    <ui-nav-row id="sub2">Hot water</ui-nav-row>
    <ui-nav-row id="sub3">Flush</ui-nav-row>
</div>
<div id="narrow">
    <ui-nav-row id="squeezed">Sleep &amp; wake schedules, and the rest of the machine group</ui-nav-row>
</div>
<div id="wide">
    <ui-nav-row id="open">Extensions</ui-nav-row>
    <ui-nav-row id="off" disabled>Scale</ui-nav-row>
</div>
<div id="routes"></div>`;

/**
 * Every measured value in the component header, in one place, so a drift shows up as one
 * failing assertion with its citation attached rather than as a mystery.
 */
const ORACLE = {
    dark: {
        /* CITE #accessories-btn [i=11] color = rgb(148, 161, 169) <- slate-shell.css
         *      `#subpage-host .settings-nav-btn` authored `var(--slate-muted)` */
        restingInk: 'rgb(148, 161, 169)',
        /* CITE #left-panel [i=6] background-color = rgb(14, 19, 23) <- slate-shell.css
         *      `#subpage-host #settings-body > #left-panel` — the ground the transparent
         *      row sat on, and --ui-fascia exactly */
        ground: 'rgb(14, 19, 23)',
        /* CITE #machine-btn [i=9] background-color = rgb(176, 196, 206) <-
         *      authored `var(--slate-selected-face)` !important */
        currentFace: 'rgb(176, 196, 206)',
        /* CITE #machine-btn [i=9] color = rgb(18, 24, 28) <- authored
         *      `var(--slate-selected-ink)` !important */
        currentInk: 'rgb(18, 24, 28)',
        /* CITE #accessories-btn [i=11] box-shadow = rgb(58, 72, 82) 0px 1px 0px 0px inset
         *      <- `ul > li + li .settings-nav-btn` authored
         *      `inset 0 var(--slate-hairline) 0 var(--slate-line)` — the SEPARATOR ink,
         *      = --ui-line. Carried by the container's seam gap, never by this row. */
        seam: 'rgb(58, 72, 82)',
    },
    light: {
        restingInk: 'rgb(90, 101, 108)',
        ground: 'rgb(242, 243, 243)',
        currentFace: 'rgb(49, 92, 112)',
        currentInk: 'rgb(248, 252, 253)',
        seam: 'rgb(203, 208, 211)',
    },
    /* Theme-independent, from the same records. */
    fontSize: '22px',          // CITE [i=11] font-size = 22px <- var(--slate-text-nav)
    fontWeight: '400',         // CITE [i=11] font-weight = 400 <- var(--slate-weight-regular)
    paddingInline: '24px',     // CITE [i=11] padding-left = 24px <- padding: 0 var(--slate-space-5)
    borderWidth: '0px',        // CITE [i=11] border-top-width = 0px <- app.css `*, :after, :before`
    /* CITE [i=9] font-weight = 500 <- slate-shell.css `.slate-nav-selected`, authored
     * var(--slate-weight-medium) !important. Carried since parity surface 2 through
     * --ui-selected-weight, the fifth dial: Slate renders 500 on all 76 of the
     * corpus's selected nav rows, across 38 states, with no exception. */
    currentWeight: '500',
    /* What Slate renders and this component deliberately does not. */
    slateRadius: '6px',        // CITE [i=9] border-top-left-radius = 6px  (T3)
    slateLed: 4,               // CITE [i=9] box-shadow ... 0px -4px 0px 0px inset  (T5)
    slatePitch: 89,            // CITE .settings-nav-btn rects [0,219,260,89] ...  (T18)
};

/** The derivation decision C4 settled: 88px, and where each part of it comes from. */
const DERIVED = { controlH: 64, space3: 12, navRow: 88 };

/** The five properties `selectionSurface` writes, and the whole of the treatment.
 *  `font-weight` joined the list at parity surface 2 (base.js, --ui-selected-weight). */
const DIAL_PROPERTIES = ['background-color', 'color', 'box-shadow', 'text-shadow', 'font-weight'];

/**
 * Everything else worth comparing between a current row and a resting one. A difference
 * here is a SIXTH selection treatment starting.
 */
const NON_DIAL_PROPERTIES = [
    'font-size', 'font-family', 'letter-spacing', 'text-transform',
    'text-decoration-line', 'border-top-width', 'border-bottom-width', 'border-left-width',
    'border-top-left-radius', 'border-bottom-right-radius',
    'padding-left', 'padding-right', 'padding-top', 'padding-bottom',
    'min-height', 'opacity', 'background-image', 'outline-style', 'transform',
    'display', 'align-items', 'gap', 'cursor', 'text-align',
];

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-nav-row @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-nav-row must mount without throwing');
            return fn(page);
        });

        /** The one global query the architecture allows — tokens.css:929-933. */
        const density = (page) => page.eval(
            "parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-density'))",
        ).then(Number);

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

        test('drill: the pitch reads --ui-nav-row, on the host and on the button',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-nav-row',
                    value: '37px',
                    selector: '#cat1',
                    property: 'min-height',
                });
                await assertTokenDrill(page, {
                    token: '--ui-nav-row',
                    value: '37px',
                    selector: '#cat1 >>> #row',
                    property: 'min-height',
                });
            }));

        test('DEPARTURE 1 / decision C4: the pitch is DERIVED, and all three inputs move it',
            () => mounted(async (page) => {
                // T18 is "--slate-nav-row: 89px justifies itself with a derivation that is
                // wrong on both halves", and C4's answer is not a better number, it is a
                // derivation: calc((--ui-control-h + 2 × --ui-space-3) × --ui-density).
                // A magic 88 would pass the --ui-nav-row drill above and fail every one of
                // these, which is the difference the decision is about.
                const d = await density(page);
                const natural = (DERIVED.controlH + 2 * DERIVED.space3) * d;
                assert.equal(await page.prop('#cat1', 'min-height'), `${natural}px`);

                await page.setToken('--ui-control-h', '37px');
                assert.equal(await page.prop('#cat1', 'min-height'),
                    `${(37 + 2 * DERIVED.space3) * d}px`,
                    'the control height must reach the nav row — the whole point of the '
                    + 'derivation is that a control and its row cannot drift apart');
                await page.setToken('--ui-control-h', null);

                await page.setToken('--ui-space-3', '5px');
                assert.equal(await page.prop('#cat1', 'min-height'),
                    `${(DERIVED.controlH + 2 * 5) * d}px`,
                    'and so must the spacing step');
                await page.setToken('--ui-space-3', null);

                await page.setToken('--ui-density', '2');
                assert.equal(await page.prop('#cat1', 'min-height'),
                    `${(DERIVED.controlH + 2 * DERIVED.space3) * 2}px`,
                    'and the density multiplier, which is the ONLY thing in this component '
                    + 'that changes with the window (tokens.css:929-933)');
                await page.setToken('--ui-density', null);

                assert.equal(await page.prop('#cat1', 'min-height'), `${natural}px`,
                    'restored');
                assert.notEqual(Math.round(natural), ORACLE.slatePitch,
                    'and it is not 89 — CITE .settings-nav-btn rects [0,219,260,89]');
            }));

        test('drill: the inset is --ui-space-5 and the gap is --ui-space-2',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-space-5',
                    value: '37px',
                    selector: '#cat1 >>> #row',
                    property: 'padding-left',
                });
                await assertTokenDrill(page, {
                    token: '--ui-space-2',
                    value: '37px',
                    selector: '#cat1 >>> #row',
                    property: 'gap',
                });
            }));

        test('drill: the type reads --ui-text-nav and --ui-weight-regular',
            () => mounted(async (page) => {
                await assertTokenDrill(page, {
                    token: '--ui-text-nav',
                    value: '37px',
                    selector: '#cat1 >>> #row',
                    property: 'font-size',
                });
                await assertTokenDrill(page, {
                    token: '--ui-weight-regular',
                    value: '700',
                    selector: '#cat1 >>> #row',
                    property: 'font-weight',
                });
            }));

        test('drill: --ui-fascia is the ground and --ui-muted is the resting ink',
            () => mounted(async (page) => {
                // L12's class: a component holding its own copy of the palette would paint
                // the same and NOT move when the token moves.
                await assertTokenDrill(page, {
                    token: '--ui-fascia',
                    value: DRILL_COLOUR,
                    selector: '#cat1 >>> #row',
                    property: 'background-color',
                });
                await assertTokenDrill(page, {
                    token: '--ui-fascia',
                    value: DRILL_COLOUR,
                    selector: '#cat1',
                    property: 'background-color',
                });
                await assertTokenDrill(page, {
                    token: '--ui-muted',
                    value: DRILL_COLOUR,
                    selector: '#cat1 >>> #row',
                    property: 'color',
                });
            }));

        test('the label names no colour, no size and no weight of its own',
            () => mounted(async (page) => {
                // Everything it needs arrives from the button above it, which is what lets
                // --ui-selected-ink reach it by inheritance with no second colour named
                // anywhere in the file.
                const label = await page.computed('#cat1 >>> #label',
                    ['color', 'font-size', 'font-weight']);
                const row = await page.computed('#cat1 >>> #row',
                    ['color', 'font-size', 'font-weight']);
                assert.deepEqual(label, row, 'the label inherits its whole type from the row');
            }));

        /* -- 2. THE DIAL DRILL: one selection treatment ---------------------- */

        test('the current row is painted by the four dials and nothing else',
            () => mounted(async (page) => {
                // The wave's headline obligation (Part 10 §12). This checks that face and
                // ink are the dials', that the LED and the glow MOVE when their dials move
                // (reading a 0px LED off a 0px token proves nothing), and that a resting
                // sibling stays unpainted.
                const result = await assertOneSelectionTreatment(page, {
                    selected: '#current >>> #row',
                    unselected: '#cat1 >>> #row',
                });
                assert.ok(result.face && result.ink, 'the dials must resolve to real values');
            }));

        test('NO PRIVATE SELECTED LOOK: the only differences are the five dial properties',
            () => mounted(async (page) => {
                // This is the founding defect made inexpressible. Slate's current nav row
                // carries a weight change (slate-shell.css:497), a ::before leading bar
                // (:517-527) and a 4px inset LED (slate-components.css:262-268) on top of
                // the two dials — three private expressions of one state, of which only
                // ONE (the weight) is a value a fork can retarget. Anything of that shape
                // here shows up as a sixth differing property.
                const current = await page.computed('#current >>> #row', NON_DIAL_PROPERTIES);
                const resting = await page.computed('#cat1 >>> #row', NON_DIAL_PROPERTIES);
                const differing = Object.keys(current).filter((k) => current[k] !== resting[k]);
                assert.deepEqual(differing, [],
                    'a current row differs from a resting one somewhere other than the five '
                    + 'dials — that is a sixth selection treatment starting');

                // Parity surface 2 REVERSED what was departure 4: Slate bolds the current
                // row to 500 and so does this, through the fifth dial rather than through
                // a rule — which is why font-weight moved into DIAL_PROPERTIES and out of
                // the list compared above.
                const weights = await page.computed('#current >>> #row', ['font-weight']);
                const restingWeight = await page.computed('#cat1 >>> #row', ['font-weight']);
                assert.equal(weights['font-weight'], ORACLE.currentWeight,
                    'CITE [i=9] the current row is Slate\'s 500');
                assert.equal(restingWeight['font-weight'], ORACLE.fontWeight,
                    'CITE [i=11] a resting row is Slate\'s 400');
                assert.equal(weights['font-weight'],
                    await page.resolveToken('--ui-selected-weight', 'font-weight'),
                    'the 500 is READ from the dial, not written in this component');

                // And the leading bar: no pseudo-element paints anything on a current row.
                for (const pseudo of ['::before', '::after']) {
                    const p = await page.computed('#current >>> #row',
                        ['content', 'background-color'], { pseudo });
                    assert.equal(p.content, 'none',
                        `slate-shell.css:517-527 draws a ${pseudo} leading bar of `
                        + 'var(--slate-selected-led); the LED dial is the sanctioned '
                        + 'expression of that and there is exactly one of it');
                }
            }));

        test('EXACTLY ONE BOX CHANGES: the host is inert in both states',
            () => mounted(async (page) => {
                // Two boxes painting one state is how a second treatment starts, even when
                // both start out identical. The host paints the ground and nothing else.
                const currentHost = await page.computed('#current', [...DIAL_PROPERTIES, 'opacity']);
                const restingHost = await page.computed('#cat1', [...DIAL_PROPERTIES, 'opacity']);
                assert.deepEqual(currentHost, restingHost,
                    'the host of a current row paints differently from the host of a resting '
                    + 'one — the button is meant to be the whole selection surface');

                const face = await page.resolveToken('--ui-selected-face', 'background-color');
                assert.notEqual(currentHost['background-color'], face,
                    'and the host must not be carrying a second copy of the face');
                assert.equal(await page.prop('#current >>> #row', 'background-color'), face,
                    'the button is');
            }));

        test('both spellings of the state select the row, and they are one property',
            () => mounted(async (page) => {
                const face = await page.resolveToken('--ui-selected-face', 'background-color');

                // The Lit spelling.
                await page.evalFn(() => { document.getElementById('cat1').current = true; return true; });
                await page.settle(2);
                assert.equal(await page.prop('#cat1 >>> #row', 'background-color'), face,
                    '.current = true must select');
                // Reflected on the host for a container to select on; rendered onto the
                // button because the button is the element a reader announces. One
                // property, two renderings, so they cannot disagree.
                assert.deepEqual(
                    await page.evalFn(() => ({
                        host: document.getElementById('cat1').hasAttribute('current'),
                        button: document.getElementById('cat1').shadowRoot
                            .getElementById('row').getAttribute('aria-current'),
                    })),
                    { host: true, button: 'true' },
                    'the property must reflect to the host AND reach the announced element '
                    + '(spec Appendix 15)');

                // The attribute spelling, on a row that has never seen the property.
                await page.evalFn(() => {
                    document.getElementById('cat2').setAttribute('current', '');
                    return true;
                });
                await page.settle(2);
                assert.equal(await page.prop('#cat2 >>> #row', 'background-color'), face,
                    'the current attribute written by a screen must select too');
                assert.equal(
                    await page.evalFn(() => document.getElementById('cat2').current), true,
                    'and it must arrive back on the property');

                // And back off again, both ways.
                await page.evalFn(() => { document.getElementById('cat1').current = false; return true; });
                await page.settle(2);
                assert.notEqual(await page.prop('#cat1 >>> #row', 'background-color'), face);
                assert.equal(
                    await page.evalFn(() => document.getElementById('cat1').shadowRoot
                        .getElementById('row').getAttribute('aria-current')),
                    null,
                    'aria-current is written on the current row ONLY — its absence means '
                    + 'false, and ten rows each announcing false is noise');
            }));

        /* -- the measured starting values, both themes ---------------------- */

        test("the resting and current paint are the oracle's measured values, in both themes",
            () => mounted(async (page) => {
                for (const theme of ['dark', 'light']) {
                    await page.setTheme(theme);
                    const want = ORACLE[theme];

                    const resting = await page.computed('#cat1 >>> #row',
                        ['background-color', 'color']);
                    assert.equal(resting['background-color'], want.ground,
                        `${theme}: --ui-fascia IS the ground Slate's transparent nav row sat `
                        + 'on (CITE #left-panel [i=6])');
                    assert.equal(resting.color, want.restingInk,
                        `${theme}: --ui-muted (CITE [i=11] color <- var(--slate-muted))`);

                    const current = await page.computed('#current >>> #row',
                        ['background-color', 'color']);
                    assert.equal(current['background-color'], want.currentFace,
                        `${theme}: --ui-selected-face (CITE [i=9] background-color)`);
                    assert.equal(current.color, want.currentInk,
                        `${theme}: --ui-selected-ink (CITE [i=9] color)`);

                    // The separator ink is unchanged even though this component never draws
                    // it: --ui-line is what a seam gap between two rows shows.
                    assert.equal(await page.resolveToken('--ui-line', 'color'), want.seam,
                        `${theme}: CITE [i=11] box-shadow inset ink — it survives the move to a gap`);

                    // The host's ground follows the theme too, and is the same colour.
                    assert.equal(await page.prop('#cat1', 'background-color'), want.ground,
                        `${theme}: the host's backstop ground is the same --ui-fascia`);
                }
            }));

        test('the theme-independent half of the record is carried exactly',
            () => mounted(async (page) => {
                const d = await density(page);
                const row = await page.computed('#cat1 >>> #row', [
                    'font-size', 'font-weight', 'padding-left', 'padding-right',
                    'padding-top', 'padding-bottom', 'border-top-width', 'box-shadow',
                    'text-align', 'white-space',
                ]);
                assert.equal(row['font-size'], ORACLE.fontSize, 'CITE [i=11] 22px');
                assert.equal(row['font-weight'], ORACLE.fontWeight, 'CITE [i=11] 400');
                assert.equal(row['padding-left'], ORACLE.paddingInline, 'CITE [i=11] 24px');
                assert.equal(row['padding-right'], ORACLE.paddingInline,
                    'symmetrical: padding: 0 var(--slate-space-5)');
                assert.equal(row['padding-top'], '0px', 'the height is the pitch, not padding');
                assert.equal(row['padding-bottom'], '0px');
                assert.equal(row['border-top-width'], ORACLE.borderWidth,
                    'CITE [i=11] border-top-width = 0px');
                assert.equal(row['box-shadow'], 'none',
                    'DEPARTURE 5: the 1px separator is the container gap, not a per-row '
                    + 'inset shadow (CONVENTIONS §13)');
                assert.equal(row['text-align'], 'start', 'settings.html:30 text-left');

                const rendered = await page.box('#cat1');
                assert.equal(Math.round(rendered.height), Math.round(DERIVED.navRow * d),
                    'the RENDERED box, not the rule');

                // The label's line box is the type times the document's leading, which is
                // the same relation ui-list-row measured on its title (20 × 1.5 = 30).
                const label = await page.box('#cat1 >>> #label');
                assert.equal(Math.round(label.height), Math.round(22 * 1.5),
                    '22px × the 1.5 in styles/document.css:64 — the UA button font '
                    + 'shorthand is undone by line-height: inherit');
            }));

        /* -- 5. THE THREE BUGS, asserted inexpressible ----------------------- */

        test('T5: the current row draws no LED, and the 4px still in the token sheet cannot reach it',
            () => mounted(async (page) => {
                // "The selected nav row still draws a 4px LED it is explicitly not supposed
                // to ... The fork dial --slate-selected-led is bypassed entirely."
                // CITE #machine-btn [i=9] box-shadow = rgba(0, 0, 0, 0) 0px -4px 0px 0px
                //      inset, color(srgb 0.690196 0.768627 0.807843 / 0.72) 0px -4px 0px
                //      0px inset  <-  slate-components.css `.slate-nav-selected` !important
                const shadow = await page.prop('#current >>> #row', 'box-shadow');
                assert.doesNotMatch(shadow, new RegExp(`-${ORACLE.slateLed}px`),
                    `the current row is drawing a ${ORACLE.slateLed}px strip — that is T5`);
                for (const segment of shadowSegments(shadow)) {
                    assert.doesNotMatch(segment, /[1-9]\d*px/,
                        `every segment of the LED shadow must be zero-length while `
                        + `--ui-selected-led is 0px; got ${segment}`);
                }

                // The 4px is STILL A TOKEN — tokens.css:129-138 carries this very reading
                // as the provenance of --ui-toggle-led — and it reaches this row through
                // nothing at all. That is what "the fork dial is bypassed" becomes when
                // there is one dial: moving the OTHER length moves nothing.
                const before = await page.prop('#current >>> #row', 'box-shadow');
                await page.setToken('--ui-toggle-led', '13px');
                assert.equal(await page.prop('#current >>> #row', 'box-shadow'), before,
                    '--ui-toggle-led reached the LED — the strip must read --ui-selected-led '
                    + 'and nothing else');
                await page.setToken('--ui-toggle-led', null);

                // And the dial itself does move it, in the one place, both directions.
                await page.setToken('--ui-selected-led', `${ORACLE.slateLed}px`);
                const lit = await page.prop('#current >>> #row', 'box-shadow');
                assert.match(lit, new RegExp(`-?${ORACLE.slateLed}px`),
                    'the LED is expressible — it is just off, which is Slate\'s own answer');
                assert.equal(shadowSegments(lit).length, 2,
                    'two segments: the transparent resting slot, then the dial');
                await page.setToken('--ui-selected-led', null);

                // The RESTING row has no shadow in either state of the world.
                assert.equal(await page.prop('#cat1 >>> #row', 'box-shadow'), 'none');
            }));

        test('T5, the mechanism: a sheet outside cannot win the specificity fight, because it cannot enter',
            () => mounted(async (page) => {
                // T5 is a specificity fight, and a fight needs two sheets able to reach one
                // element. The defect's own rule is injected here at higher specificity
                // with !important on top of that — the exact shape of
                // slate-components.css:262-268 beating slate-shell.css:496.
                const before = await page.computed('#current >>> #row',
                    ['box-shadow', 'background-color', 'font-weight']);
                await page.evalFn(() => {
                    const s = document.createElement('style');
                    s.id = 't5-component-sheet';
                    s.textContent = [
                        '#category ui-nav-row .row, #category ui-nav-row button,',
                        '#category ui-nav-row [aria-current="true"],',
                        '#category ui-nav-row #row {',
                        '  box-shadow: inset 0 -4px 0 0 rgb(176, 196, 206) !important;',
                        '  font-weight: 500 !important;',
                        '  background-color: rgb(40, 49, 57) !important;',
                        '}',
                    ].join('\n');
                    document.head.appendChild(s);
                    return true;
                });
                await page.settle(2);
                assert.deepEqual(
                    await page.computed('#current >>> #row',
                        ['box-shadow', 'background-color', 'font-weight']),
                    before,
                    'a sheet outside the shadow root repainted the row — the mechanism that '
                    + 'stops T5 is REACH, not specificity, and reach is absolute');
            }));

        test('T3: the row is square, and the rule that rounds it in Slate cannot land',
            () => mounted(async (page) => {
                // "Nav rows are rounded despite border-radius: 0 in two places — an
                // attribute-selector rule later in the same file wins. Measured 6px."
                // CITE #machine-btn [i=9] border-top-left-radius = 6px <- slate-shell.css
                //      `#subpage-host [class*="rounded-lg"]` ... !important=yes
                const corners = [
                    'border-top-left-radius', 'border-top-right-radius',
                    'border-bottom-left-radius', 'border-bottom-right-radius',
                ];
                for (const selector of ['#cat1 >>> #row', '#current >>> #row', '#cat1']) {
                    const got = await page.computed(selector, corners);
                    assert.deepEqual(got, Object.fromEntries(corners.map((c) => [c, '0px'])),
                        `${selector} is rounded — DEPARTURE 2 is that the authored intent `
                        + '(slate-shell.css:464, :534) finally renders');
                }
                assert.notEqual('0px', ORACLE.slateRadius, 'and 6px is what Slate renders');

                // The defeating rule, verbatim in shape: an attribute-substring selector
                // with !important, written after everything.
                await page.evalFn(() => {
                    const s = document.createElement('style');
                    s.id = 't3-pill-rule';
                    s.textContent =
                        '#category [class*="row"], #category ui-nav-row .row, '
                        + '#category ui-nav-row button { border-radius: 6px !important }';
                    document.head.appendChild(s);
                    return true;
                });
                await page.settle(2);
                assert.equal(await page.prop('#cat1 >>> #row', 'border-top-left-radius'), '0px',
                    'the pill-flattening rule reached in and rounded the row');
            }));

        test('T2: one pitch, two columns, and it moves as one', () => mounted(async (page) => {
            // "The sub-category column does not align with the category column ... Measured
            // pitch 89 vs 93." The pitch is a token here, so there is no per-column
            // selector to get right and no `> * + *` to fail to match.
            const heights = await page.evalFn(() => {
                const read = (sel) => [...document.querySelectorAll(sel)]
                    .map((el) => Math.round(el.getBoundingClientRect().height));
                return {
                    category: read('#category ui-nav-row'),
                    subcategory: read('#subcategory ui-nav-row'),
                };
            });
            assert.equal(heights.category.length, 10, 'ten categories, as Slate has');
            assert.equal(heights.subcategory.length, 4);
            const all = [...heights.category, ...heights.subcategory];
            assert.equal(new Set(all).size, 1,
                `two columns of nav rows rendered at ${[...new Set(all)].join(' vs ')} — `
                + 'that is T2, and one token is what makes it unreachable');

            // And they move together, because they read one token.
            await page.setToken('--ui-nav-row', '37px');
            const moved = await page.evalFn(() => [...document.querySelectorAll('ui-nav-row')]
                .map((el) => Math.round(el.getBoundingClientRect().height)));
            await page.setToken('--ui-nav-row', null);
            assert.equal(new Set(moved).size, 1, 'every row in both columns moved together');
            assert.equal(moved[0], 37);
        }));

        test('T2, the other half: no row draws a separator — the gap does (CONVENTIONS §13)',
            () => mounted(async (page) => {
                // "the same mistake means the sub-nav has no row separators at all (measured
                // box-shadow: none)". A gap needs no sibling selector, so N cells give N-1
                // seams and there is nothing to render zero of.
                const drawn = await page.evalFn(() => {
                    const out = [];
                    for (const el of document.querySelectorAll('ui-nav-row')) {
                        const host = getComputedStyle(el);
                        const row = getComputedStyle(el.shadowRoot.getElementById('row'));
                        out.push([
                            host.borderTopWidth, host.borderBottomWidth,
                            row.borderTopWidth, row.borderBottomWidth,
                            row.borderLeftWidth, row.borderRightWidth,
                        ].join('/'));
                    }
                    return out;
                });
                assert.equal(new Set(drawn).size, 1, 'every row must be identical here');
                assert.equal(drawn[0], '0px/0px/0px/0px/0px/0px',
                    'T2\'s shape needs a per-cell border to exist at all, and there is not one');

                // The seam is real and it is the container's: N rows, N-1 gaps of --ui-line.
                const gaps = await page.evalFn(() => {
                    const rows = [...document.querySelectorAll('#category ui-nav-row')]
                        .map((el) => el.getBoundingClientRect());
                    const out = [];
                    for (let i = 1; i < rows.length; i += 1) {
                        out.push(Math.round((rows[i].top - rows[i - 1].bottom) * 100) / 100);
                    }
                    return out;
                });
                assert.equal(gaps.length, 9, 'ten cells give nine seams');
                assert.equal(new Set(gaps).size, 1, 'and they are all the same seam');
                assert.ok(gaps[0] > 0, `the gap must actually be drawn; got ${gaps[0]}`);
            }));

        /* -- 3. focus geometry, unclipped (bug L24's class) ------------------ */

        test('a row inside a clipping column keeps its whole ring (L24)', () => mounted(async (page) => {
            const g = await assertFocusUnclipped(page, '#cat1 >>> #row');
            assert.equal(g.outlineOffset, '-3px',
                '--ui-focus-offset-inset: a nav row is flush with its neighbours, so the '
                + 'ring is drawn inside its own box or the column clips it');
            assert.ok(g.clippers.length >= 1,
                'the column must really clip, or this assertion is vacuous');
        }));

        test('the focus ring is the ONLY focus signal (DEPARTURE 7)', () => mounted(async (page) => {
            // slate-shell.css:471-475 repaints the row face on :focus-visible as well as
            // :hover, because Slate's component ring reached only four classes and a nav
            // row was not one of them. The base's ring reaches every focusable in the
            // shadow tree, so focus is the ring and hover is the face.
            const before = await page.prop('#cat1 >>> #row', 'background-color');
            await page.focusVisible('#cat1 >>> #row');
            assert.equal(await page.prop('#cat1 >>> #row', 'background-color'), before,
                'focus repainted the row face — that is the second signal Slate needed and '
                + 'this one does not');
            assert.notEqual(await page.prop('#cat1 >>> #row', 'outline-style'), 'none',
                'and the ring is what says focus instead');
        }));

        test('a consumer can still ask for the outset ring, and gets exactly one',
            () => mounted(async (page) => {
                await page.evalFn(() => {
                    document.getElementById('open').setAttribute('focus-ring', 'outset');
                    return true;
                });
                await page.settle(1);
                const g = await assertFocusUnclipped(page, '#open >>> #row');
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
                selector: '#cat1 >>> #row',
                property: 'outline-color',
                prepare: (p) => p.focusVisible('#cat1 >>> #row'),
            });
            await assertTokenDrill(page, {
                token: '--ui-focus-w',
                value: '37px',
                selector: '#cat1 >>> #row',
                property: 'outline-width',
                prepare: (p) => p.focusVisible('#cat1 >>> #row'),
            });
        }));

        /* -- 4. container behaviour, and the floor --------------------------- */

        test('the row fills its container and reads no viewport', () => mounted(async (page) => {
            const d = await density(page);
            const wide = await page.box('#open');
            assert.equal(Math.round(wide.width), 520, 'the row is as wide as #wide');
            const narrow = await page.box('#squeezed');
            assert.equal(Math.round(narrow.width), 200, 'and as wide as #narrow');

            // Recorded with --ui-density PINNED, so the one global height band
            // (tokens.css:929-933) does not mask a component that reads the viewport.
            await page.setToken('--ui-density', '1');
            acrossGeometries[geometry.name] = {
                rowHeight: Math.round((await page.box('#cat1')).height),
                buttonHeight: Math.round((await page.box('#cat1 >>> #row')).height),
                narrowHeight: Math.round((await page.box('#squeezed')).height),
                paddingLeft: await page.prop('#cat1 >>> #row', 'padding-left'),
                fontSize: await page.prop('#cat1 >>> #row', 'font-size'),
                gap: await page.prop('#cat1 >>> #row', 'gap'),
                radius: await page.prop('#cat1 >>> #row', 'border-top-left-radius'),
            };
            await page.setToken('--ui-density', null);

            assert.equal(acrossGeometries[geometry.name].rowHeight, DERIVED.navRow,
                'with the density pinned the pitch is 88 at every geometry');
            assert.equal(Math.round((await page.box('#cat1')).height),
                Math.round(DERIVED.navRow * d),
                'and unpinned it is 88 × the band\'s multiplier, which is the only thing '
                + 'about this component that changes with the window');
        }));

        test('the button fills the host in both axes, so no cell is a hole',
            () => mounted(async (page) => {
                // CONVENTIONS §13 trap 1: "a cell that paints nothing is a hole — the
                // ground shows through everything not painted over it". The host paints the
                // same fascia as a backstop, and the button covers it exactly.
                const host = await page.box('#cat1');
                const button = await page.box('#cat1 >>> #row');
                assert.equal(Math.round(button.width), Math.round(host.width));
                assert.equal(Math.round(button.height), Math.round(host.height));

                // And a taller track still has no gap in it.
                await page.setStyle('#cat1', { 'block-size': '140px' });
                const grownHost = await page.box('#cat1');
                const grownButton = await page.box('#cat1 >>> #row');
                assert.equal(Math.round(grownHost.height), 140);
                assert.equal(Math.round(grownButton.height), 140,
                    'the button did not stretch with its host — the leftover strip would '
                    + 'show the seam ground through the row');
            }));

        test('DEPARTURE 8: the label ellipsises rather than widening the column',
            () => mounted(async (page) => {
                // The oracle is DISQUALIFIED for responsive behaviour (Part 10 §4): Slate
                // is frozen at 1920×1200 and its nav button has no overflow treatment at
                // all. LAYOUT_SPEC_DRAFT.md governs.
                const label = await page.computed('#squeezed >>> #label',
                    ['overflow-x', 'text-overflow', 'white-space']);
                assert.equal(label['overflow-x'], 'hidden');
                assert.equal(label['text-overflow'], 'ellipsis');
                assert.equal(label['white-space'], 'nowrap');

                const row = await page.box('#squeezed');
                const inner = await page.box('#squeezed >>> #label');
                assert.equal(Math.round(row.width), 200, 'the row did not widen its container');
                assert.ok(inner.right <= row.right + 0.5,
                    `the label ran past the row: row right ${row.right}, label right ${inner.right}`);
                assert.equal(Math.round(row.height),
                    Math.round(DERIVED.navRow * await density(page)),
                    'one line, always — a nav row that wraps stops being a row');
            }));

        test('the row holds the 48px hit floor in a 200px column', () => mounted(async (page) => {
            // Appendix 5 / spec §2.3: the floor is physical — "a wet fingertip is about
            // 9mm; at this panel's density that is ~48px". The ink is 88px (77 in the
            // compact band) so the paint IS the hit box and there is no overlay — but P4
            // is exactly "a floor the comment claims and the box does not have", so it is
            // the RENDERED box that is measured.
            const got = await assertHitFloor(page, '#squeezed >>> #row', { mode: 'box' });
            assert.ok(got.block >= got.floor,
                `${got.block}px against a ${got.floor}px floor`);
            assert.ok(got.inline >= got.floor);
            const overlay = await page.computed('#squeezed >>> #row', ['content'], { pseudo: '::before' });
            assert.equal(overlay.content, 'none',
                'and there is no hit-area overlay, because the ink already clears the floor '
                + '(CONVENTIONS §5: the overlay is for a leaf whose INK is smaller)');
        }));

        test('no viewport query decides anything here', () => mounted(async (page) => {
            // The row keeps the base's container-type: inline-size and asks no width
            // question of its own; what changes its layout is its CONTAINER.
            const props = ['min-height', 'padding-left', 'gap', 'font-size'];
            const before = await page.computed('#open >>> #row', props);
            await page.setStyle('#wide', { 'inline-size': '260px' });
            assert.deepEqual(await page.computed('#open >>> #row', props), before,
                'nothing in this component is size-keyed, so a container change moves the '
                + 'box and not the paint');
            assert.equal(Math.round((await page.box('#open')).width), 260,
                'and the box did follow the container');
        }));

        test('the host really is a container, and the base put it there',
            () => mounted(async (page) => {
                const container = await page.prop('#cat1', 'container-type');
                assert.equal(container, 'inline-size',
                    'CONVENTIONS §2 — the row reads its own container, never the viewport; '
                    + 'display: grid here must not have cost the containment');
            }));

        /* -- 6. the aria contract (spec Appendix 15) ------------------------- */

        test('the state is on the element a reader announces, and the host stays role-less',
            () => mounted(async (page) => {
                const shape = await page.evalFn(() => {
                    const host = document.getElementById('current');
                    const resting = document.getElementById('cat1');
                    const btn = host.shadowRoot.getElementById('row');
                    return {
                        hostRole: host.getAttribute('role'),
                        hostTabindex: host.getAttribute('tabindex'),
                        hostCurrent: host.hasAttribute('current'),
                        hostAriaCurrent: host.getAttribute('aria-current'),
                        btnTag: btn.tagName,
                        btnType: btn.getAttribute('type'),
                        btnCurrent: btn.getAttribute('aria-current'),
                        // The accessible name comes from the SLOTTED text, which lives in
                        // the light tree and is therefore invisible to btn.textContent -
                        // the flattened tree is what the accessibility tree is built from.
                        btnName: btn.querySelector('slot').assignedNodes()
                            .map((n) => n.textContent).join('').trim(),
                        restingBtnCurrent: resting.shadowRoot.getElementById('row')
                            .getAttribute('aria-current'),
                        focusRing: host.getAttribute('focus-ring'),
                    };
                });
                assert.deepEqual(shape, {
                    // No role: Slate's markup is <nav><ul><li><button> and the list
                    // semantics belong to the column, not to a wrapper between ul and li.
                    hostRole: null,
                    hostTabindex: null,
                    hostCurrent: true,
                    // Deliberately NOT aria-current on the host: it is a role-less generic
                    // there, and it would also match the fragment's :host() half and paint
                    // a second, invisible copy of the face under the button.
                    hostAriaCurrent: null,
                    btnTag: 'BUTTON',
                    btnType: 'button',
                    btnCurrent: 'true',
                    btnName: 'Machine',
                    restingBtnCurrent: null,
                    focusRing: 'inset',
                }, 'accessibility state and visual state must be one attribute on one box '
                    + '(spec Appendix 15); bug T15 is what the alternative looks like');
            }));

        test('disabled dims the host and stops the real control', () => mounted(async (page) => {
            const shape = await page.evalFn(() => {
                const el = document.getElementById('off');
                const btn = el.shadowRoot.getElementById('row');
                return {
                    hostAttr: el.hasAttribute('disabled'),
                    btnDisabled: btn.disabled,
                    tabbable: btn.tabIndex,
                };
            });
            assert.deepEqual(shape, { hostAttr: true, btnDisabled: true, tabbable: 0 });

            const dimmed = parseFloat(await page.prop('#off', 'opacity'));
            const lit = parseFloat(await page.prop('#open', 'opacity'));
            assert.ok(dimmed < lit,
                'the base paints disabled from --ui-opacity-disabled (CONVENTIONS §4); '
                + `got ${dimmed} against ${lit}`);
            await assertTokenDrill(page, {
                token: '--ui-opacity-disabled',
                value: '0.5',
                selector: '#off',
                property: 'opacity',
            });
        }));

        test('the disabled dial is applied ONCE — the host dims, the inner button does not',
            () => mounted(async (page) => {
                // Fix-phase finding c2-2. This row carries BOTH spellings of disabled at
                // once (the reflected host attribute is the paint; the native attribute
                // on the real <button> is the refusal), and the base paints both —
                // base.js:509 for the shadow tree, base.js:521 for the host. Without
                // `.row:where(:disabled) { opacity: 1 }` the two multiply and the row
                // renders at .38 × .38 = .144, three times fainter than spec §3.7's one
                // value. The test above passed straight over it because it read opacity
                // on the HOST only and drilled the token at the host only.
                const host = parseFloat(await page.prop('#off', 'opacity'));
                const inner = parseFloat(await page.prop('#off >>> #row', 'opacity'));
                const dial = parseFloat(await page.tokenValue('--ui-opacity-disabled'));

                assert.equal(inner, 1,
                    `the inner button dimmed too (${inner}) — the one dial is being applied twice; `
                    + `the rendered result is ${host} × ${inner} = ${host * inner}`);
                assert.ok(Math.abs(host - dial) < 1e-6,
                    `the host must carry the dial exactly, not a multiple of it (${host} vs ${dial})`);

                // …and the enabled row is untouched by the guard: no accidental
                // opacity: 1 that would defeat a consumer dimming the row itself.
                assert.equal(parseFloat(await page.prop('#open >>> #row', 'opacity')), 1);

                // Same shape as its sibling #25, which already had the line. Anything
                // else means the two halves of the settings nav dim differently.
                assert.equal(await page.prop('#off >>> #row', 'cursor'), 'default',
                    'a row that refuses the press must not advertise a pointer');
            }));

        /* -- events ---------------------------------------------------------- */

        test('pressing the row emits one composed `navigate` event carrying its state',
            () => mounted(async (page) => {
                await page.evalFn(() => {
                    window.__seen = [];
                    document.getElementById('category').addEventListener('navigate', (e) => {
                        window.__seen.push({
                            target: e.target.id,
                            current: e.detail && e.detail.current,
                            composed: e.composed,
                            bubbles: e.bubbles,
                        });
                    });
                    return true;
                });
                await page.click('#cat1 >>> #row');
                await page.click('#current >>> #row');
                assert.deepEqual(await page.evalFn(() => window.__seen), [
                    { target: 'cat1', current: false, composed: true, bubbles: true },
                    { target: 'current', current: true, composed: true, bubbles: true },
                ], 'the event must cross the shadow boundary retargeted to the ROW, and say '
                    + 'whether the row was already the current one');
            }));

        test('the row does not select itself — a column owns that', () => mounted(async (page) => {
            const face = await page.resolveToken('--ui-selected-face', 'background-color');
            await page.click('#cat2 >>> #row');
            await page.settle(2);
            assert.notEqual(await page.prop('#cat2 >>> #row', 'background-color'), face,
                'the row selected itself; `current` in, event out, and the column decides');
            assert.equal(await page.prop('#current >>> #row', 'background-color'), face,
                'and the previously current row is untouched');
        }));

        test('a disabled row emits nothing', () => mounted(async (page) => {
            await page.evalFn(() => {
                window.__off = 0;
                document.getElementById('off').addEventListener('navigate', () => { window.__off += 1; });
                return true;
            });
            await page.click('#off >>> #row');
            assert.equal(await page.evalFn(() => window.__off), 0,
                'the native disabled on the real button refuses the press — the host '
                + 'attribute dims, it does not disable (CONVENTIONS §4)');
        }));

        /* -- construction routes and the shadow boundary --------------------- */

        test('rows built four different ways are the same row', () => mounted(async (page) => {
            const built = await page.evalFn(() => {
                const host = document.getElementById('routes');
                host.innerHTML = '<ui-nav-row id="n1">One</ui-nav-row>';
                const n2 = document.createElement('ui-nav-row');
                n2.id = 'n2';
                n2.textContent = 'Two';
                host.appendChild(n2);
                const n3 = document.getElementById('n1').cloneNode(true);
                n3.id = 'n3';
                host.appendChild(n3);
                const n4 = document.createElement('ui-nav-row');
                n4.id = 'n4';
                n4.setAttribute('current', '');
                n4.textContent = 'Four';
                host.appendChild(n4);
                return ['n1', 'n2', 'n3', 'n4'];
            });
            await page.settle(3);
            assert.deepEqual(built, ['n1', 'n2', 'n3', 'n4']);

            const shared = await page.evalFn(() => {
                const sheets = (id) => document.getElementById(id).shadowRoot.adoptedStyleSheets;
                const a = sheets('n1');
                const b = sheets('n4');
                const c = document.getElementById('cat1').shadowRoot.adoptedStyleSheets;
                return {
                    count: a.length,
                    sameAsN4: a.length === b.length && a.every((s, i) => s === b[i]),
                    sameAsMarkupRow: a.length === c.length && a.every((s, i) => s === c[i]),
                    ids: ['n1', 'n2', 'n3', 'n4'].map((id) => [...document.getElementById(id)
                        .shadowRoot.querySelectorAll('[id]')].map((n) => n.id).join(',')),
                    rings: ['n1', 'n2', 'n3', 'n4']
                        .map((id) => document.getElementById(id).getAttribute('focus-ring')),
                };
            });
            assert.ok(shared.count >= 2, 'base styles plus the component styles at least');
            assert.ok(shared.sameAsN4 && shared.sameAsMarkupRow,
                'every row must share the same CSSStyleSheet objects — one rule added to '
                + 'the component is added to every row that exists');
            assert.equal(new Set(shared.ids).size, 1, 'and the same shadow shape');
            assert.deepEqual(shared.rings, Array(4).fill('inset'));
        }));

        test('zero !important reaches the rendered result', () => mounted(async (page) => {
            // slate-shell.css carries 268 of them and every one exists because some other
            // sheet could reach the same element (CONVENTIONS §6). Nothing can reach in
            // here, so a plain rule in the same root must win.
            await page.evalFn(() => {
                const root = document.getElementById('cat1').shadowRoot;
                const s = document.createElement('style');
                s.textContent = '#row.row { font-size: 11px; border-radius: 9px }';
                root.appendChild(s);
                return true;
            });
            await page.settle(2);
            const got = await page.computed('#cat1 >>> #row', ['font-size', 'border-top-left-radius']);
            assert.deepEqual(got, { 'font-size': '11px', 'border-top-left-radius': '9px' },
                'a later plain rule in the same root must win — no !important in the component');
        }));
    });
}

describe('the same box at both geometries', () => {
    test('every measured value is geometry-independent once the density band is pinned', () => {
        const names = Object.keys(acrossGeometries);
        assert.equal(names.length, GATE_A_GEOMETRIES.length,
            'both geometry blocks must have run before this comparison means anything');
        const [first, ...rest] = names;
        for (const name of rest) {
            assert.deepEqual(acrossGeometries[name], acrossGeometries[first],
                `ui-nav-row renders differently at ${name} than at ${first} — `
                + 'something read the viewport (spec §2.1 Rule 1)');
        }
    });
});

describe('the gallery entry this component ships', () => {
    // The entry lives in its own file (tools/gallery/entries/ui-nav-row.entry.js) because
    // twelve wave-2 builders cannot all append to one array under a whole-file write rule;
    // the wave's single cross-cutting writer wires it into tools/gallery/entries.js. The
    // ENTRY's own correctness is this builder's problem.

    test('every declared state mounts, settles and paints', async () => {
        const { entry } = await import('../../tools/gallery/entries/ui-nav-row.entry.js');

        assert.equal(entry.id, 'ui-nav-row', 'the entry id is the tag name is the file name');
        assert.equal(entry.module, '../../src/components/ui-nav-row.js',
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
                await page.mount(wrapper, ['/src/components/ui-nav-row.js']);
                assert.deepEqual(page.pageErrors, [], `${entry.id}--${state.id} threw`);

                const painted = await page.evalFn(() => {
                    const el = document.querySelector('ui-nav-row');
                    if (!el || !el.shadowRoot) return null;
                    const row = el.shadowRoot.getElementById('row');
                    if (!row) return null;
                    const r = row.getBoundingClientRect();
                    return { w: r.width, h: r.height, bg: getComputedStyle(row).backgroundColor };
                });
                assert.ok(painted, `${entry.id}--${state.id} rendered no row at all`);
                assert.ok(painted.w > 0 && painted.h >= 70,
                    `${entry.id}--${state.id} rendered a ${painted.w}×${painted.h} box`);
                assert.notEqual(painted.bg, 'rgba(0, 0, 0, 0)',
                    `${entry.id}--${state.id} paints no ground — CONVENTIONS §13 trap 1, `
                    + 'a cell that paints nothing is a hole');
            }
        });
    });
});
