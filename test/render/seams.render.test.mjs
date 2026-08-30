/**
 * seams.render.test.mjs — Gate A for wave 1 item #14, "Hairline / seam".
 *
 * ITEM #14 IS NOT AN ELEMENT (SCOPE Part 4: "this becomes a documented layout
 * utility, not an element"), so most of this suite mounts PLAIN divs carrying the
 * utility's classes and asserts on what the engine actually laid out — computed style
 * and box geometry, never source text (Part 8 §2, Gate A). The two paths that are
 * *not* plain divs — the fragment inside a real component's `static styles`, and the
 * component that IS the grid — get their own describe at the end, because those are
 * the paths a screen will actually use and neither is exercised by `adoptSeams`.
 *
 * WHAT IT PROVES, in the order the tests appear:
 *   1. the seam is a hairline GAP, measured between two adjacent cells, at both Gate
 *      A geometries — including dsf 1.5, where a hairline is 1.5 device px and could
 *      plausibly vanish or double;
 *   2. the container is the only drawer: the utility gives its cells no border and no
 *      shadow, which is the STRUCTURAL half of bug L9 (see the L9 note below — the
 *      other half is not this row's to claim);
 *   3. a seam exists between every adjacent pair with no sibling selector anywhere
 *      (bug T2, "the `> * + *` half of the rule can never match ... the sub-nav has NO
 *      row separators at all");
 *   4. it comes out of the GRID, not out of a pane: 260 + 1 + 339 = 600 (bug T19,
 *      "two hairlines of two different greys, which is why the nav container measures
 *      599 rather than 600");
 *   5. the two axis modifiers reproduce Slate's own two shapes — `gap: 1px` (the Live
 *      rail) and `gap: 0px 1px` (the editor matrix);
 *   6. every length and every colour comes from a token and moves when the token
 *      moves (the standing token drill), and the three weights land on the oracle's
 *      measured values in BOTH themes;
 *   7. the same fragment works inside a shadow root through `adoptSeams`, idempotently
 *      — the light-DOM half of this file is only reachable because the same call
 *      adopted it into the document;
 *   8. the two component paths: `static styles = [seams, css`…`]` on a `UiElement`
 *      (fragment order included, because Lit dedupes on the reversed array and keeps
 *      the LAST occurrence — base.js's own warning), and `:host(.seam-grid)` on a
 *      component that is itself the seamed grid, which is what the spec's screen
 *      skeletons ask for (LAYOUT_SPEC_DRAFT.md:521-525, :701-703).
 *
 * ORACLE VALUES ARE ASSERTED LITERALLY, with their CITE lines, so "measured from the
 * oracle" is checkable rather than claimed. Every one was produced by
 * `realine-run/tools/prov_query.py` against prov-baseline (dark) and prov-light.
 *
 * DISQUALIFICATION, run first (Part 10 §4). A DECISION DOES SETTLE THIS ROW, and it
 * settles it the way the utility is built: register decision **C5 (ACCEPTED)** —
 * "the divider: one 1px grid gap, `var(--ui-seam)`, replacing today's 2px band of two
 * different greys (T19)" (SCOPE.md:2243). The layout spec's **OQ-6 is that decision's
 * old number and is NOT open**: SCOPE.md:1761, "OQ-1…OQ-13 all map onto accepted
 * register decisions (… OQ-6→C5 …). Nothing below re-opens any of them." C5's
 * residual is a look-confirmation on the C1 prototype, collected as Q3
 * (SCOPE.md:5142) — a confirmation, not an open question, and it does not gate this
 * code. The oracle values below therefore corroborate; they do not decide. The
 * elements quoted are not on the 140-bug list for the property quoted (L9/T2/T19 are
 * what this row acts on, and each is asserted or scoped below rather than
 * reproduced), and the one genuinely responsive question — which screens become
 * seamed grids — has no Slate answer at all and belongs to each screen's own row.
 *
 * L9 IS ONLY HALF THIS ROW'S. L9 (LAYOUT_SPEC_DRAFT.md §7.2, `layout/live.md`
 * M-2:1489-1499) is the rail STEPPER drawing its seam twice — the component's inset
 * shadow (`slate-components.css:588`, `--slate-seam`) plus the Live border
 * (`slate-live.css:610-615`/`617-622`), with three of eight at 1px. Neither drawer is
 * in this utility: the inset shadow is `--ui-seam-ink` inside one control (#3
 * ui-bank) and the border is the Live screen's row. What test 2 below asserts is the
 * structural half — the utility hands a cell nothing to draw a seam with — and it is
 * named for that, not for L9's death.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH, GATE_A_GEOMETRIES } from '../harness/index.js';
import { assertTokenDrill, DRILL_COLOUR, DRILL_LENGTH } from '../harness/assertions.js';
import { entry as galleryEntry } from '../../tools/gallery/entries/seams.entry.js';

/* The subject: plain elements, no custom element anywhere in this file — which is
 * the row's whole point. Inline styles carry only geometry (tracks and sizes); every
 * colour and the seam width come from the utility, i.e. from the tokens. */
const MARKUP = `
<div id="stage" style="padding: 24px; display: grid; gap: 40px; justify-items: start">

    <!-- 1. A zone split. 260 + seam + 1fr inside 600 — bug T19's arithmetic. -->
    <div id="zone" class="seam-grid"
         style="inline-size: 600px; block-size: 200px;
                grid-template-columns: 260px minmax(0, 1fr)">
        <div class="seam-cell" id="zone-nav"></div>
        <div class="seam-cell" id="zone-pane"></div>
    </div>

    <!-- 2. Rows only, --ui-line: the 55 settings <hr class="border-t slate-hairline">
         elements, replaced by two gaps and no elements. -->
    <div id="rows" class="seam-grid seam-rows seam-line"
         style="inline-size: 600px; grid-template-rows: repeat(3, 63px)">
        <div class="seam-cell" id="row-1"></div>
        <div class="seam-cell" id="row-2"></div>
        <div class="seam-cell" id="row-3"></div>
    </div>

    <!-- 3. Columns only, --ui-line-strong: the editor matrix (gap 0px 1px) drawn in
         the rail's own grade. -->
    <div id="cols" class="seam-grid seam-cols seam-strong"
         style="inline-size: 601px; grid-template-columns: repeat(3, 199px);
                grid-template-rows: 60px 60px">
        <div class="seam-cell" id="col-a1"></div>
        <div class="seam-cell" id="col-b1"></div>
        <div class="seam-cell" id="col-c1"></div>
        <div class="seam-cell" id="col-a2"></div>
        <div class="seam-cell" id="col-b2"></div>
        <div class="seam-cell" id="col-c2"></div>
    </div>

    <!-- 4. Trap 1, asserted rather than only documented: cells that paint nothing
         make the whole box a slab of ground. -->
    <div id="hole" class="seam-grid"
         style="inline-size: 300px; block-size: 100px; grid-template-columns: 1fr 1fr">
        <div id="hole-a"></div>
        <div id="hole-b"></div>
    </div>

    <!-- 5. Trap 3: a nested seam grid is a cell, and names its own weight. -->
    <div id="outer" class="seam-grid seam-strong"
         style="inline-size: 600px; block-size: 120px; grid-template-columns: 1fr 1fr">
        <div class="seam-cell" id="outer-a"></div>
        <div id="inner" class="seam-grid seam-line seam-cell"
             style="grid-template-rows: 1fr 1fr">
            <div class="seam-cell" id="inner-a"></div>
            <div class="seam-cell" id="inner-b"></div>
        </div>
    </div>

    <!-- 6. The shadow-root half. Filled in by adoptSeams(root). -->
    <div id="host"></div>
</div>
`;

/* The component half — mounted separately, because these are custom elements and the
 * markup above deliberately contains none. Upgraded once `defineProbes` runs. */
const COMPONENT_MARKUP = `
<div id="stage" style="padding: 24px; display: grid; gap: 40px; justify-items: start">
    <seams-probe id="inside"></seams-probe>
    <seams-host-probe id="on-host"
         style="inline-size: 400px; block-size: 90px"></seams-host-probe>
    <seams-flex-probe id="flex-host"
         style="inline-size: 400px; block-size: 90px"></seams-flex-probe>
</div>
`;

/* The oracle's numbers, quoted once and asserted literally below.
 *
 * CITE live-ready #main-page [i=0] background-color = rgb(58, 72, 82) [prov-baseline]
 *      / rgb(203, 208, 211) [prov-light]  <-  slate-live.css `#main-page`
 *      authored `(NOT CAPTURED - set via a CSS shorthand)` (token-driven)  -> --ui-zone-seam
 * CITE settings-machine-machine-info .flex [i=52] border-top-color = rgb(58, 72, 82)
 *      [prov-baseline] / rgb(203, 208, 211) [prov-light]  <-  slate-components.css
 *      `.slate-hairline` !important=yes (token-driven)                     -> --ui-line
 * CITE editor-steps .pe-grid [i=17] background-color = rgb(58, 72, 82) [prov-baseline]
 *      / rgb(203, 208, 211) [prov-light]  <- profile-editor-v3.css `.pe-grid`  -> --ui-line
 * CITE live-ready .flex-grow [i=16] background-color = rgb(82, 97, 107) [prov-baseline]
 *      / rgb(170, 178, 183) [prov-light]  <-  slate-live.css
 *      `#main-page > .flex-grow.flex` (token-driven)                -> --ui-line-strong
 */
const ORACLE = {
    dark: {
        zoneSeam: 'rgb(58, 72, 82)',
        line: 'rgb(58, 72, 82)',
        lineStrong: 'rgb(82, 97, 107)',
    },
    light: {
        zoneSeam: 'rgb(203, 208, 211)',
        line: 'rgb(203, 208, 211)',
        lineStrong: 'rgb(170, 178, 183)',
    },
};

/* CITE live-ready .flex-grow [i=16] gap = 1px  <-  slate-live.css
 *      `#main-page > .flex-grow.flex` authored `1px` !important=no (FROZEN/hardcoded)
 * CITE editor-steps .pe-grid [i=17] gap = 0px 1px  <-  (no declaration - inherited or
 *      initial value) (FROZEN/hardcoded)
 * The WIDTH is frozen in Slate and a token here — spec §3.1: "Intrinsic. Kept as a
 * token so it can go to 0.5px/dpr". */
const SEAM_PX = 1;

/** The gap between two boxes laid out side by side, in CSS px. */
const inlineGap = (a, b) => b.left - (a.left + a.width);
/** The gap between two boxes laid out one above the other, in CSS px. */
const blockGap = (a, b) => b.top - (a.top + a.height);

/** Layout units are 1/64 px, so compare seams with a tolerance, not with ===. */
const near = (got, want, what) => assert.ok(
    Math.abs(got - want) < 0.05,
    `${what}: expected ${want} CSS px, measured ${got}`,
);

/** Filled in per geometry, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

/**
 * Mount the markup, then adopt the utility the way a document (the gallery, the
 * capture battery) adopts it. Everything in the light-DOM half of this suite is
 * proof that this call worked: without it the classes mean nothing at all.
 */
async function mountSeamed(page) {
    await page.mount(MARKUP, []);
    const adopted = await page.evalFn(async () => {
        const { adoptSeams } = await import('/src/components/seams.js');
        adoptSeams(document);

        const host = document.getElementById('host');
        const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
        adoptSeams(root);
        root.innerHTML =
            '<div id="s-zone" class="seam-grid seam-line"'
            + ' style="inline-size: 300px; block-size: 80px;'
            + ' grid-template-columns: 100px minmax(0, 1fr)">'
            + '<div class="seam-cell" id="s-a"></div>'
            + '<div class="seam-cell" id="s-b"></div>'
            + '</div>';
        return document.adoptedStyleSheets.length;
    });
    await page.settle(2);
    return adopted;
}

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`seam utility @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await mountSeamed(page);
            assert.deepEqual(page.pageErrors, [], 'the seam utility must adopt without throwing');
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

        /* == 1. THE SEAM IS A MEASURED HAIRLINE GAP ========================== */

        test('the seam measures one CSS px between two cells, on both axes', () => mounted(async (page) => {
            const nav = await page.box('#zone-nav');
            const pane = await page.box('#zone-pane');
            near(inlineGap(nav, pane), SEAM_PX, 'the column seam');

            const r1 = await page.box('#row-1');
            const r2 = await page.box('#row-2');
            near(blockGap(r1, r2), SEAM_PX, 'the row seam');

            // The computed properties agree with the geometry — the gap is where the
            // seam comes from, not a coincidence of two borders.
            const got = await page.computed('#zone', ['column-gap', 'row-gap', 'display']);
            assert.deepEqual(got, { 'column-gap': '1px', 'row-gap': '1px', display: 'grid' });

            acrossGeometries[geometry.name] = {
                columnSeam: Number(inlineGap(nav, pane).toFixed(3)),
                rowSeam: Number(blockGap(r1, r2).toFixed(3)),
            };
        }));

        test('the seam survives dsf 1.5 — it neither vanishes nor doubles', () => mounted(async (page) => {
            // A hairline at deviceScaleFactor 1.5 is 1.5 device px. CONVENTIONS §10:
            // "at dsf 1.5 a 3px outline computes 2.66667px, so compare whole CSS px".
            // The LAYOUT gap must stay one CSS px whatever the raster does with it.
            const a = await page.box('#col-a1');
            const b = await page.box('#col-b1');
            near(inlineGap(a, b), SEAM_PX, `the seam at dsf ${geometry.deviceScaleFactor}`);
            assert.equal(Math.round(inlineGap(a, b)), SEAM_PX);
        }));

        /* == 2. ONE DRAWER: THE CONTAINER — L9's STRUCTURAL HALF ============= */

        test('the utility gives a cell nothing to draw a seam with — the container is the only drawer',
            () => mounted(async (page) => {
                // SCOPE. This is the structural half of bug L9, not L9 itself. L9 is
                // "every rail stepper draws its seam TWICE (component inset shadow +
                // Live border), and three of eight draw 1px instead"; the inset shadow
                // is --ui-seam-ink inside one control (#3 ui-bank) and the border is
                // the Live screen's row, so neither drawer lives here and this row
                // cannot retire either of them. What IS this row's: a cell wearing
                // .seam-cell — and a grid wearing .seam-grid — gets no border and no
                // box-shadow from the utility, so there is never a second drawer to
                // fall out of step with the container's gap. A future edit that grew
                // one (a "helpful" 1px border on .seam-cell) fails here.
                for (const id of ['#zone-nav', '#zone-pane', '#row-1', '#row-2', '#row-3',
                    '#zone', '#rows', '#cols']) {
                    const got = await page.computed(id, [
                        'border-top-width', 'border-right-width', 'border-bottom-width',
                        'border-left-width', 'box-shadow',
                    ]);
                    assert.deepEqual(got, {
                        'border-top-width': '0px',
                        'border-right-width': '0px',
                        'border-bottom-width': '0px',
                        'border-left-width': '0px',
                        'box-shadow': 'none',
                    }, `${id} paints part of the seam itself`);
                }

                // And the classes really are what is being measured: an element with
                // none of them measures the same, so the comparison is a controlled
                // one rather than "a div has no border".
                const bare = await page.evalFn(() => {
                    const el = document.createElement('div');
                    document.getElementById('stage').append(el);
                    const cs = getComputedStyle(el);
                    const out = `${cs.borderTopWidth}|${cs.boxShadow}`;
                    el.remove();
                    return out;
                });
                assert.equal(bare, '0px|none',
                    'the control is not a control — a bare div already differs');
            }));

        /* == 3. NO SIBLING SELECTOR — bug T2 ================================= */

        test('bug T2 dead: N cells give N-1 seams, with no sibling selector anywhere', () => mounted(async (page) => {
            // T2: "the `> * + *` half of the rule can never match, because
            // renderSubcategories() returns a single <ul> ... the sub-nav has NO row
            // separators at all (measured box-shadow: none)". A gap is a property of
            // the container, so a separator cannot fail to exist because of how the
            // children happen to be nested.
            const [r1, r2, r3] = await Promise.all([
                page.box('#row-1'), page.box('#row-2'), page.box('#row-3'),
            ]);
            near(blockGap(r1, r2), SEAM_PX, 'seam 1 of 2');
            near(blockGap(r2, r3), SEAM_PX, 'seam 2 of 2');

            // And the ground really is visible in both gaps: the cells are painted
            // over it, so the two colours differ.
            const cell = await page.prop('#row-1', 'background-color');
            const ground = await page.prop('#rows', 'background-color');
            assert.notEqual(cell, ground, 'the cell and the ground are the same colour — no seam is visible');
        }));

        /* == 4. THE SEAM COMES OUT OF THE GRID — bug T19 ===================== */

        test('bug T19 dead: 260 + 1 + 339 = 600, one ink, one line', () => mounted(async (page) => {
            // T19: "The nav/pane seam is TWO hairlines of two different greys, which
            // is why the nav container measures 599 rather than 600." Register
            // decision C5 (ACCEPTED) settles the replacement as "one 1px grid gap,
            // var(--ui-seam)" (SCOPE.md:2243).
            const zone = await page.box('#zone');
            const nav = await page.box('#zone-nav');
            const pane = await page.box('#zone-pane');

            near(zone.width, 600, 'the split');
            near(nav.width, 260, 'the nav pane');
            near(pane.width, 339, 'the detail pane');
            near(nav.width + SEAM_PX + pane.width, zone.width, 'panes + seam = container');
        }));

        /* == 5. THE TWO AXIS SHAPES SLATE ALREADY HAS ======================== */

        test('gap: 1px and gap: 0px 1px — the rail and the editor matrix', () => mounted(async (page) => {
            // CITE live-ready .flex-grow [i=16] gap = 1px
            const both = await page.computed('#zone', ['column-gap', 'row-gap']);
            assert.deepEqual(both, { 'column-gap': '1px', 'row-gap': '1px' });

            // CITE editor-steps .pe-grid [i=17] gap = 0px 1px
            const cols = await page.computed('#cols', ['column-gap', 'row-gap']);
            assert.deepEqual(cols, { 'column-gap': '1px', 'row-gap': '0px' });

            // The rows in a column-ruled grid genuinely touch — that is what
            // "column gap as the only vertical rule" (spec Appendix 8) means.
            const a1 = await page.box('#col-a1');
            const a2 = await page.box('#col-a2');
            near(blockGap(a1, a2), 0, 'the row seam in a column-ruled grid');

            // And the mirror image, the settings list.
            const rows = await page.computed('#rows', ['column-gap', 'row-gap']);
            assert.deepEqual(rows, { 'column-gap': '0px', 'row-gap': '1px' });
        }));

        /* == 6. TOKENS ARE CONSUMED, NOT COPIED ============================= */

        test('drill: --ui-seam is the seam width', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-seam', value: DRILL_LENGTH,
                selector: '#zone', property: 'column-gap',
            });
            await assertTokenDrill(page, {
                token: '--ui-seam', value: DRILL_LENGTH,
                selector: '#rows', property: 'row-gap',
            });
        }));

        test('drill: --ui-hairline reaches the seam through --ui-seam', () => mounted(async (page) => {
            // Spec §3.9: "--ui-seam | var(--ui-hairline) | Named separately for
            // intent". The derivation is the point: one dpr change moves every seam
            // in the app, which is why the width is a token and not Slate's frozen
            // Tailwind literal (CITE ... border-top-width = 1px <- app.css `.border-t`
            // authored `1px` (FROZEN/hardcoded)).
            await assertTokenDrill(page, {
                token: '--ui-hairline', value: DRILL_LENGTH,
                selector: '#zone', property: 'column-gap',
            });
            const seam = await page.resolveToken('--ui-seam', 'column-gap');
            const hairline = await page.resolveToken('--ui-hairline', 'column-gap');
            assert.equal(seam, hairline, '--ui-seam must resolve to --ui-hairline, not to its own literal');
            assert.equal(seam, '1px');
        }));

        test('drill: the three weights are three tokens', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-zone-seam', value: DRILL_COLOUR,
                selector: '#zone', property: 'background-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-line', value: DRILL_COLOUR,
                selector: '#rows', property: 'background-color',
            });
            await assertTokenDrill(page, {
                token: '--ui-line-strong', value: DRILL_COLOUR,
                selector: '#cols', property: 'background-color',
            });
        }));

        test('drill: --ui-fascia is the cell ground', () => mounted(async (page) => {
            await assertTokenDrill(page, {
                token: '--ui-fascia', value: DRILL_COLOUR,
                selector: '#zone-nav', property: 'background-color',
            });
        }));

        test('the weights land on the oracle values, in BOTH themes', () => mounted(async (page) => {
            for (const theme of ['dark', 'light']) {
                await page.setTheme(theme);
                const want = ORACLE[theme];
                assert.equal(await page.prop('#zone', 'background-color'), want.zoneSeam,
                    `--ui-zone-seam in ${theme}`);
                assert.equal(await page.prop('#rows', 'background-color'), want.line,
                    `--ui-line in ${theme}`);
                assert.equal(await page.prop('#cols', 'background-color'), want.lineStrong,
                    `--ui-line-strong in ${theme}`);
            }
        }));

        /* == 7. THE TWO TRAPS, ASSERTED RATHER THAN ONLY DOCUMENTED ========= */

        test('trap 1: unpainted cells make the box a slab, not a seam', () => mounted(async (page) => {
            const a = await page.prop('#hole-a', 'background-color');
            const b = await page.prop('#hole-b', 'background-color');
            assert.equal(a, 'rgba(0, 0, 0, 0)');
            assert.equal(b, 'rgba(0, 0, 0, 0)');
            // The gap is still there — the failure is that nothing covers the ground,
            // which is why the utility documents .seam-cell rather than assuming it.
            near(inlineGap(await page.box('#hole-a'), await page.box('#hole-b')), SEAM_PX, 'the seam');
        }));

        test('trap 3: a nested seam grid keeps its own weight over the cell ground', () => mounted(async (page) => {
            // #inner carries seam-grid, seam-line AND seam-cell. The weight class is
            // (0,2,0) and the cell ground (0,1,0), so the weight wins whatever the
            // source order — a nested grid can never be silently repainted as a cell.
            const theme = await page.eval('document.documentElement.dataset.theme');
            assert.equal(await page.prop('#inner', 'background-color'), ORACLE[theme].line);
            assert.equal(await page.prop('#outer', 'background-color'), ORACLE[theme].lineStrong);
            near(blockGap(await page.box('#inner-a'), await page.box('#inner-b')), SEAM_PX,
                'the nested seam');
        }));

        /* == 8. THE SAME FRAGMENT INSIDE A SHADOW ROOT ====================== */

        test('adoptSeams works in a shadow root, and is idempotent', () => mounted(async (page) => {
            const sa = await page.box('#host >>> #s-a');
            const sb = await page.box('#host >>> #s-b');
            near(inlineGap(sa, sb), SEAM_PX, 'the seam inside a shadow root');

            const theme = await page.eval('document.documentElement.dataset.theme');
            assert.equal(await page.prop('#host >>> #s-zone', 'background-color'), ORACLE[theme].line);

            const state = JSON.parse(await page.evalFn(async () => {
                const m = await import('/src/components/seams.js');
                const b = await import('/src/components/base.js');
                const root = document.getElementById('host').shadowRoot;
                const before = root.adoptedStyleSheets.length;
                m.adoptSeams(root);
                m.adoptSeams(root);
                return JSON.stringify({
                    before,
                    after: root.adoptedStyleSheets.length,
                    adopted: b.hasAdoptedSheet(root, m.seamStyleSheet()),
                    sameObject: m.seamStyleSheet() === m.seamStyleSheet(),
                });
            }));
            assert.deepEqual(state, { before: 1, after: 1, adopted: true, sameObject: true });
        }));

        test('the utility defines no custom element — that is the row', () => mounted(async (page) => {
            // SCOPE Part 4: "this becomes a documented layout utility, not an
            // element". A future edit that quietly adds one fails here.
            const defined = await page.evalFn(async () => {
                await import('/src/components/seams.js');
                return ['ui-seam', 'ui-hairline', 'ui-separator', 'ui-divider']
                    .filter((tag) => customElements.get(tag) !== undefined);
            });
            assert.deepEqual(defined, []);
        }));
    });
}

/* ===========================================================================
 * 9. THE TWO COMPONENT PATHS.
 *
 * `adoptSeams` is the SECONDARY path — the gallery and the capture battery. The
 * documented normal path is `static styles = [seams, css`…`]` on a `UiElement`, and
 * the spec's screen skeletons need a third thing again: the component that IS the
 * grid, which no class selector inside its own shadow root can reach. Neither was
 * exercised above, and base.js's own warning is that fragment ORDER is the mechanism
 * that breaks silently ("Lit dedupes on the reversed array and keeps the LAST
 * occurrence"), so order is asserted by identity here rather than assumed.
 *
 * Geometry is irrelevant to these — they are mechanism, not layout — so they run once
 * at BENCH rather than twice.
 * =========================================================================== */

/** Define the three probe elements in the page. Idempotent per page. */
const defineProbes = (page) => page.evalFn(async () => {
    if (customElements.get('seams-probe')) return 'already';
    const { css, html } = await import('lit');
    const { UiElement } = await import('/src/components/base.js');
    const { seams } = await import('/src/components/seams.js');

    const GRID = 'inline-size: 300px; block-size: 80px;'
        + ' grid-template-columns: 100px minmax(0, 1fr)';

    // (a) THE NORMAL PATH — the fragment first, own rules after.
    class SeamsProbe extends UiElement {
        static styles = [seams, css`.own { color: var(--ui-text); }`];
        render() {
            return html`<div id="grid" class="seam-grid seam-line" style="${GRID}">
                <div class="seam-cell" id="p-a"></div>
                <div class="seam-cell" id="p-b"></div>
            </div>`;
        }
    }
    customElements.define('seams-probe', SeamsProbe);

    // (b) THE COMPONENT *IS* THE GRID — LAYOUT_SPEC_DRAFT.md:521-525, :701-703.
    class SeamsHostProbe extends UiElement {
        static styles = [seams, css`.own { color: var(--ui-text); }`];
        connectedCallback() {
            super.connectedCallback();
            // In connectedCallback, never the constructor: a custom element
            // constructor must not gain attributes.
            this.classList.add('seam-grid', 'seam-strong');
        }
        render() {
            return html`<div class="seam-cell" id="h-a"></div>
                <div class="seam-cell" id="h-b"></div>`;
        }
    }
    customElements.define('seams-host-probe', SeamsHostProbe);

    // (c) THE DOCUMENTED SPECIFICITY SURPRISE — a bare `:host { display: flex }` in
    //     the component's OWN styles is (0,1,0) and does NOT beat `:host(.seam-grid)`
    //     at (0,2,0), even though it is written later.
    class SeamsFlexProbe extends UiElement {
        static styles = [seams, css`:host { display: flex; }`];
        connectedCallback() {
            super.connectedCallback();
            this.classList.add('seam-grid', 'seam-line');
        }
        render() {
            return html`<div class="seam-cell" id="f-a"></div>
                <div class="seam-cell" id="f-b"></div>`;
        }
    }
    customElements.define('seams-flex-probe', SeamsFlexProbe);

    return 'defined';
});

describe('the fragment inside a real component', () => {
    const mountedComponents = (fn) => browser.withPage({ geometry: BENCH }, async (page) => {
        // DEFINE BEFORE MOUNT, and not the other way round: the harness's `mount`
        // awaits `customElements.whenDefined(tag)` for every hyphenated tag in the
        // markup (test/harness/page-helpers.js:381-382), so mounting an element that
        // is defined afterwards hangs forever rather than failing. That is also why
        // the real path passes a module to `mount(markup, modules)` — the module is
        // imported first. These three are defined in-page because a browser module
        // under test/ is a file Node's runner would try to run as a test.
        assert.equal(await defineProbes(page), 'defined');
        await page.mount(COMPONENT_MARKUP, []);
        await page.evalFn(() => Promise.all(
            ['#inside', '#on-host', '#flex-host']
                .map((s) => document.querySelector(s).updateComplete),
        ).then(() => true));
        await page.settle(2);
        assert.deepEqual(page.pageErrors, [], 'the probes must upgrade without throwing');
        return fn(page);
    });

    test('static styles = [seams, css`…`] seams the component\'s OWN descendants',
        () => mountedComponents(async (page) => {
            const got = await page.computed('#inside >>> #grid', ['display', 'column-gap', 'row-gap']);
            assert.deepEqual(got, { display: 'grid', 'column-gap': '1px', 'row-gap': '1px' });

            const theme = await page.eval('document.documentElement.dataset.theme');
            assert.equal(await page.prop('#inside >>> #grid', 'background-color'),
                ORACLE[theme].line);

            const a = await page.box('#inside >>> #p-a');
            const b = await page.box('#inside >>> #p-b');
            near(inlineGap(a, b), SEAM_PX, 'the seam inside a component');
        }));

    test('fragment ORDER: base first, seams second, own rules last', () => mountedComponents(async (page) => {
        // base.js: "Lit dedupes on the reversed array and keeps the LAST occurrence",
        // which is why finalizeStyles composes rather than concatenates. If that ever
        // inverts, the utility lands after a component's own rules and silently wins
        // ties it should lose.
        const order = JSON.parse(await page.evalFn(async () => {
            const { UiElement } = await import('/src/components/base.js');
            const { seams } = await import('/src/components/seams.js');
            const styles = customElements.get('seams-probe').elementStyles;
            return JSON.stringify({
                count: styles.length,
                base: styles.indexOf(UiElement.baseStyles),
                seams: styles.indexOf(seams),
            });
        }));
        assert.deepEqual(order, { count: 3, base: 0, seams: 1 });
    }));

    test(':host(.seam-grid) — the component that IS the seamed grid', () => mountedComponents(async (page) => {
        // LAYOUT_SPEC_DRAFT.md:521-525 `<live-screen> display:grid; gap:
        // var(--ui-seam); background: var(--ui-line-strong)` and :701-703
        // `<master-detail> display:grid; gap: var(--ui-seam)`. The grid is the HOST,
        // so a `.seam-grid` rule in its own shadow styles can never reach it.
        const got = await page.computed('#on-host', ['display', 'column-gap', 'row-gap']);
        assert.deepEqual(got, { display: 'grid', 'column-gap': '1px', 'row-gap': '1px' });

        const theme = await page.eval('document.documentElement.dataset.theme');
        assert.equal(await page.prop('#on-host', 'background-color'), ORACLE[theme].lineStrong,
            ':host(.seam-grid.seam-strong) must carry the weight');

        // And the seam really is laid out between the two cells of that host grid.
        const a = await page.box('#on-host >>> #h-a');
        const b = await page.box('#on-host >>> #h-b');
        near(blockGap(a, b), SEAM_PX, 'the seam on a host grid');
    }));

    test(':host(.seam-grid) is (0,2,0), so a bare :host rule written later does not beat it',
        () => mountedComponents(async (page) => {
            // The claim in seams.js USING IT (b). A component that means to override
            // must write `:host(.seam-grid)` itself; `:host { display: flex }` is one
            // step lower and loses despite coming later.
            const got = await page.computed('#flex-host', ['display', 'column-gap']);
            assert.deepEqual(got, { display: 'grid', 'column-gap': '1px' });
            const theme = await page.eval('document.documentElement.dataset.theme');
            assert.equal(await page.prop('#flex-host', 'background-color'), ORACLE[theme].line);
        }));
});

describe('the gallery entry renders what it claims', () => {
    /**
     * The entry is not wired into `tools/gallery/entries.js` yet — sixteen parallel
     * builders cannot all append to one array, so the GATE agent wires them. That
     * leaves a window in which a typo'd class or a demo module that stopped adopting
     * would be invisible until the battery photographed an unstyled stage. So: mount
     * each state's own markup with the entry's own module, exactly as `gallery.js`
     * does (`await loadModule(entry)`, then `stageHost.innerHTML = state.html`), and
     * assert every seam grid in it really is a seamed grid.
     */
    test('every state mounts, and every seam grid in it paints a ground and a hairline gap',
        () => browser.withPage({ geometry: BENCH }, async (page) => {
            for (const state of galleryEntry.states) {
                await page.mount(state.html, ['/tools/gallery/entries/seams.demo.js']);
                assert.deepEqual(page.pageErrors, [], `state ${state.id} threw on mount`);

                const grids = await page.evalFn(() => [...document.querySelectorAll('.seam-grid')]
                    .map((el) => {
                        const cs = getComputedStyle(el);
                        return {
                            display: cs.display,
                            ground: cs.backgroundColor,
                            gap: `${cs.columnGap} ${cs.rowGap}`,
                        };
                    }));

                assert.ok(grids.length > 0, `state ${state.id} contains no seam grid`);
                for (const [i, g] of grids.entries()) {
                    assert.equal(g.display, 'grid', `${state.id}[${i}] is not a grid`);
                    assert.notEqual(g.ground, 'rgba(0, 0, 0, 0)',
                        `${state.id}[${i}] has no ground, so its gaps show whatever is behind`);
                    assert.match(g.gap, /(^|\s)1px(\s|$)/,
                        `${state.id}[${i}] gap is ${g.gap}, not a hairline on either axis`);
                }
            }
        }));
});

describe('seam utility across geometries', () => {
    test('the seam is one CSS px at dsf 1 and at dsf 1.5', () => {
        assert.deepEqual(Object.keys(acrossGeometries).sort(), ['bench', 'floor']);
        for (const [name, got] of Object.entries(acrossGeometries)) {
            near(got.columnSeam, SEAM_PX, `${name}: the column seam`);
            near(got.rowSeam, SEAM_PX, `${name}: the row seam`);
        }
    });
});
