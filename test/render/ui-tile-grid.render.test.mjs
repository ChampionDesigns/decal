/**
 * ui-tile-grid.render.test.mjs — Gate A for component #40 (wave 4, item #40).
 *
 * Runs at BOTH standard geometries — 1281×801 @ dsf 1.5 (the bench truth) and the
 * 1000×600 floor — asserting only on computed style and box geometry, never on source
 * text (Part 8 §2).
 *
 * THE STANDING CLASSES, and where each lives below:
 *   1. token drill — --ui-space-3 is the gutter on both axes, and the two private
 *      knobs (--_ui-tile-grid-min / --_ui-tile-grid-gap) move the layout from the
 *      light tree. The min drill is the load-bearing one: it is the difference between
 *      a component that READS 280 and one that has 280 baked into a track function.
 *   2. dial drill — SELECTION DOES NOT EXIST HERE, so the assertion is the inverse
 *      one, and it is the wave law: a slotted aria-checked="true" tile takes nothing
 *      from this grid, and moving all four --ui-selected-* dials moves nothing in it.
 *      "No component in this wave may own a private 'selected' look."
 *   3. focus-unclipped — a slotted focusable's ring at the grid's own edge, with no
 *      clipper anywhere in the chain (bug L24's class, structurally impossible here
 *      because nothing in this component clips).
 *   4. container floor — the whole component. The column count is a function of the
 *      CONTAINER and of nothing else: identical at both viewports, and at the 1000×600
 *      floor a 300px container still lays out without overflowing. Plus the departure:
 *      at 200px the grid does not run past its own container, which is what Slate does
 *      into a wrapper that clips (settings.js:5641).
 *
 * ORACLE. The container element is NOT in the corpus — `prov_query.py find --cls
 * slate-lang-grid` returns "searched 49 state(s) / found 0 element(s) in 0 state(s)",
 * and grid placement is outside the 18-property surface anyway (Part 10 §4 carve-out).
 * Its 30 CHILDREN are in the corpus, and they pin the container exactly:
 *
 *   CITE prov_query.py find --cls slate-lang-tile → "found 30 element(s) in 1 state(s)"
 *        settings-units---language-select-language
 *        [629,359,291,84] [932,359,291,84] [1235,359,291,84] [1538,359,291,84]
 *        [629,455,291,84] … "distinct geometries (w x h), all matched elements:
 *        291 x 84  x30"
 *
 * from which: column pitch 303 − track 291 = 12px gutter; row pitch 96 − tile 84 =
 * 12px gutter; container (1538 + 291) − 629 = 1200px. The 1200/4/291/303 quartet is
 * asserted literally below, because it is the one place Slate's authored rule and
 * Slate's rendered pixels agree and this component has to reproduce both.
 *
 * The bugs row for #40 is EMPTY (waves/4/ITEMS.json), so nothing here is a
 * bug-not-reproduced. What is asserted instead is the class of inherited behaviour the
 * component makes inexpressible: the silent horizontal clip (spec §2.4's subject), and
 * a container whose layout is decided by the viewport (spec §2.1 Rule 1).
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { assertTokenDrill, assertFocusUnclipped, DRILL_COLOUR } from '../harness/assertions.js';

const MODULE = ['/src/components/ui-tile-grid.js'];

/* ui-card is loaded ONLY for the gallery-state section, and it has to be: mount()
 * awaits customElements.whenDefined() for every hyphenated tag it finds on the stage
 * (page-helpers.js:377-382), so a state carrying `<ui-card>` with no module never
 * resolves — it hangs, it does not fail. Everywhere else the tiles are PLAIN buttons,
 * so this suite does not go red when a sibling builder's component moves. */
const GALLERY_MODULE = [...MODULE, '/src/components/ui-card.js'];

/* The tiles are plain light-DOM buttons on purpose. #40 depends on `tokens` and
 * nothing else (SCOPE.md:1644), and a suite that slotted a sibling builder's component
 * would go red when THEIR component moved. The ring rule is `focusRing` from base.js
 * re-created in the light tree, exactly as ui-card's suite does it, because
 * ::slotted() reaches a top-level assigned node but this tree needs its own copy to
 * measure against.
 *
 * Colour literals are fine in a TEST fixture: Gate C scans src/, styles/, tools/ and
 * index.html (authored-css.js:71), not test/. */
const FIXTURE_CSS = `
<style>
    .tile {
        display: block;
        min-height: 80px;
        margin: 0;
        padding: 12px 18px;
        border: 1px solid #cbd0d3;
        background: #f8f9f9;
        font: inherit;
        text-align: left;
    }
    .tile:focus-visible {
        outline: var(--ui-focus-w) solid var(--ui-steel);
        outline-offset: var(--_ui-focus-offset, var(--ui-focus-offset));
    }
    .holder { padding: 24px; }
</style>`;

/** Eight tiles: enough for two rows at 1200px, so a row pitch is measurable. Ids are
 *  scoped to their grid — every grid below carries the same eight tiles, and a
 *  duplicated `#t0` would silently hand every measurement to whichever grid comes
 *  first in the document (found the hard way: the 200px case measured the 1200px
 *  grid's 291px tile and reported it as an overflow). */
const tilesFor = (prefix) => Array.from({ length: 8 }, (_, i) =>
    `<button type="button" class="tile" id="${prefix}-t${i}">Tile ${i}</button>`).join('');

const MARKUP = `${FIXTURE_CSS}
<div class="holder" style="inline-size: 1200px"><ui-tile-grid id="g1200">${tilesFor('g1200')}</ui-tile-grid></div>
<div class="holder" style="inline-size: 900px"><ui-tile-grid id="g900">${tilesFor('g900')}</ui-tile-grid></div>
<div class="holder" style="inline-size: 600px"><ui-tile-grid id="g600">${tilesFor('g600')}</ui-tile-grid></div>
<div class="holder" style="inline-size: 300px"><ui-tile-grid id="g300">${tilesFor('g300')}</ui-tile-grid></div>
<div class="holder" style="inline-size: 200px"><ui-tile-grid id="g200">${tilesFor('g200')}</ui-tile-grid></div>
<div class="holder" style="inline-size: 600px">
    <ui-tile-grid id="labelled" label="Display language">${tilesFor('labelled')}</ui-tile-grid>
</div>
<div class="holder" style="inline-size: 600px">
    <ui-tile-grid id="authored" role="radiogroup" aria-label="Written by the screen">${tilesFor('authored')}</ui-tile-grid>
</div>
<div class="holder" style="inline-size: 600px">
    <ui-tile-grid id="selection">
        <button type="button" class="tile" id="picked" aria-checked="true" role="radio">Picked</button>
        <button type="button" class="tile" id="unpicked" aria-checked="false" role="radio">Not picked</button>
    </ui-tile-grid>
</div>
<div class="holder" style="inline-size: 300px; block-size: 500px">
    <ui-tile-grid id="tall" style="block-size: 100%">
        <button type="button" class="tile" id="only">Only tile</button>
    </ui-tile-grid>
</div>
<div class="holder" style="inline-size: 600px">
    <ui-tile-grid id="knob" style="--_ui-tile-grid-min: 200px">${tilesFor('knob')}</ui-tile-grid>
</div>
<div class="holder" style="inline-size: 600px; --_ui-tile-grid-min: 120px">
    <ui-tile-grid id="inherited">${tilesFor('inherited')}</ui-tile-grid>
</div>
`;

/* The oracle's own numbers, named once.
 *   CITE prov_query.py find --cls slate-lang-tile → 30 elements, all 291 x 84, first
 *        row x = 629 / 932 / 1235 / 1538, second row y = 455 against 359. */
const ORACLE = Object.freeze({
    container: 1200,
    columns: 4,
    track: 291,
    pitch: 303,
    gap: 12,
    min: 280,
});

/** At dsf 1.5 lengths snap to device pixels, so compare whole CSS px (CONVENTIONS §10). */
const near = (got, want, what, tol = 0.6) => assert.ok(
    Math.abs(parseFloat(got) - want) <= tol,
    `${what}: expected ~${want}px, rendered ${got}`,
);

/** The used track list, as numbers. Chrome resolves grid-template-columns on a grid
 *  container to its USED track sizes, which is what makes the whole responsive claim
 *  measurable rather than a source grep. */
const tracks = async (page, selector) => {
    const value = await page.prop(selector, 'grid-template-columns');
    return value.trim().split(/\s+/).map(parseFloat);
};

/** Filled in by each geometry block, compared once at the end. */
const acrossGeometries = {};

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`ui-tile-grid @ ${geometry.name} (${geometry.width}×${geometry.height} @ dsf ${geometry.deviceScaleFactor})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(MARKUP, MODULE);
            assert.deepEqual(page.pageErrors, [], 'ui-tile-grid must mount without throwing');
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

        /* -- 0. the fixture is measuring the component, not a collapsed box ---- */

        test('every grid fills the container it was given', () => mounted(async (page) => {
            // A GUARD ON THE FIXTURE. The base puts container-type: inline-size on the
            // host, so a grid in an intrinsically-sized slot resolves to 0 and every
            // assertion below would be made on a 0-wide box that still "passes" a
            // count check. The holders are block containers, so this must hold.
            for (const [id, want] of [['g1200', 1200], ['g900', 900], ['g600', 600], ['g300', 300], ['g200', 200]]) {
                near((await page.box(`#${id}`)).width, want, `#${id} host inline size`);
            }
        }));

        /* -- 1. the oracle, reproduced ---------------------------------------- */

        test('at the 1200px leaf the grid is the oracle: 4 tracks of 291 at a 303 pitch', () => mounted(async (page) => {
            // CITE prov_query.py find --cls slate-lang-tile → 30 elements in
            //      settings-units---language-select-language, all 291 x 84, first row
            //      x = 629 / 932 / 1235 / 1538 → pitch 303, container 1200.
            // The authored rule predicts exactly this: floor((1200 + 12) / (280 + 12))
            // = 4 tracks, (1200 − 3 × 12) / 4 = 291. Rule and pixels agree, and this
            // component has to reproduce both or it has not copied the pattern.
            const t = await tracks(page, '#g1200');
            assert.equal(t.length, ORACLE.columns, `expected 4 tracks, got ${t.join(' ')}`);
            for (const width of t) near(width, ORACLE.track, 'track width');

            const a = await page.box('#g1200-t0');
            const b = await page.box('#g1200-t1');
            near(b.x - a.x, ORACLE.pitch, 'column pitch');
            near(a.width, ORACLE.track, 'tile inline size');

            // The second row starts one tile height plus one gutter below the first —
            // the oracle's 455 − 359 = 96 against a tile height of 84.
            const rowTwo = await page.box('#g1200-t4');
            near(rowTwo.y - a.y, a.height + ORACLE.gap, 'row pitch is tile height + gutter');

            acrossGeometries[geometry.name] = {
                tracks: t.map((n) => Math.round(n)),
                pitch: Math.round(b.x - a.x),
                columns900: (await tracks(page, '#g900')).length,
                columns600: (await tracks(page, '#g600')).length,
                columns300: (await tracks(page, '#g300')).length,
                columns200: (await tracks(page, '#g200')).length,
            };
        }));

        /* -- 2. tokens are consumed, not copied ------------------------------- */

        test('drill: --ui-space-3 is the gutter, on both axes', () => mounted(async (page) => {
            // ORACLE the gutter is 12px on BOTH axes, derived from the tile rects:
            //   column pitch 932 − 629 − 291 = 12 ; row pitch 455 − 359 − 84 = 12.
            // 12px is --slate-space-3 (slate-tokens.css:115-121) → --ui-space-3
            // (styles/tokens.css:267), which is what slate-shell.css:1850 authored.
            for (const property of ['column-gap', 'row-gap']) {
                const drill = await assertTokenDrill(page, {
                    token: '--ui-space-3',
                    value: '37px',
                    selector: '#g1200',
                    property,
                });
                near(drill.before, ORACLE.gap, `resting ${property} is the measured 12px`);
                near(drill.after, 37, `${property} must land on --ui-space-3`);
            }
        }));

        test('drill: the gutter token also moves the LAYOUT, not just the gap property', () => mounted(async (page) => {
            // A gap that computes correctly and does not move the tiles would satisfy
            // the drill above and still be wrong. The tracks are a function of the
            // gutter — floor((W + gap) / (min + gap)) — so moving the token must move
            // the track arithmetic too.
            const before = await tracks(page, '#g1200');
            await page.setToken('--ui-space-3', '60px');
            const after = await tracks(page, '#g1200');
            await page.setToken('--ui-space-3', null);
            const restored = await tracks(page, '#g1200');

            assert.equal(before.length, 4, `resting tracks ${before.join(' ')}`);
            // floor((1200 + 60) / (280 + 60)) = 3 tracks of (1200 − 120) / 3 = 360.
            assert.equal(after.length, 3, `at a 60px gutter the grid must re-track, got ${after.join(' ')}`);
            for (const width of after) near(width, 360, 'track width at a 60px gutter');
            assert.deepEqual(restored.map(Math.round), before.map(Math.round), 'the drill must restore');
        }));

        test('drill: --_ui-tile-grid-min is read, not baked in — from the light tree', () => mounted(async (page) => {
            // The knob is set on the HOST from the light DOM, which wins over this
            // component's :host default because for two normal declarations in
            // different tree contexts the outer tree wins (CSS Scoping §3.3,
            // CONVENTIONS §3a). #knob carries style="--_ui-tile-grid-min: 200px".
            const dflt = await tracks(page, '#g600');
            const knob = await tracks(page, '#knob');

            // 600px, 12px gutter, 280 floor → floor(612/292) = 2 tracks of 294.
            assert.equal(dflt.length, 2, `default min: expected 2 tracks, got ${dflt.join(' ')}`);
            for (const width of dflt) near(width, 294, 'track width at the 280 default');

            // 600px, 12px gutter, 200 floor → floor(612/212) = 2 tracks. Not enough of
            // a move, so the assertion is on the THIRD track appearing at 200: with a
            // 200 floor a 636+ container fits three. Assert the floor itself instead,
            // by squeezing the same grid to a width only the smaller floor survives.
            assert.equal(knob.length, 2, `200 floor at 600px: expected 2 tracks, got ${knob.join(' ')}`);

            // The real proof: at 250px the default floor gives ONE full-width track
            // (min(280,100%) = 250) and the 200 floor gives one 250px track too — so
            // widen to 450px, where 280 gives 1 and 200 gives 2.
            await page.setStyle('#g600', { 'inline-size': '450px' });
            await page.setStyle('#knob', { 'inline-size': '450px' });
            const dfltNarrow = await tracks(page, '#g600');
            const knobNarrow = await tracks(page, '#knob');
            await page.setStyle('#g600', { 'inline-size': null });
            await page.setStyle('#knob', { 'inline-size': null });

            assert.equal(dfltNarrow.length, 1,
                `280 floor at 450px must give one track, got ${dfltNarrow.join(' ')}`);
            assert.equal(knobNarrow.length, 2,
                `200 floor at 450px must give two tracks, got ${knobNarrow.join(' ')}`);
        }));

        test('drill: --_ui-tile-grid-gap is a knob of its own', () => mounted(async (page) => {
            // The gutter has its own private slot so a consumer can widen the gutter
            // without moving --ui-space-3 for the whole skin.
            const before = await page.prop('#g600', 'column-gap');
            await page.setStyle('#g600', { '--_ui-tile-grid-gap': '30px' });
            const after = await page.prop('#g600', 'column-gap');
            await page.setStyle('#g600', { '--_ui-tile-grid-gap': null });
            const restored = await page.prop('#g600', 'column-gap');

            near(before, ORACLE.gap, 'the resting gutter');
            near(after, 30, 'the knob moves the gutter');
            near(restored, ORACLE.gap, 'and it restores');
        }));

        test('the knob is NOT inherited from an ancestor — a :host default beats inheritance', () => mounted(async (page) => {
            // The trap, pinned so the next reader does not rediscover it. #inherited
            // sits inside a holder carrying --_ui-tile-grid-min: 120px. An inherited
            // value loses to a declaration on the element itself, and `:host` IS a
            // declaration on the element — so the grid keeps its 280 default and the
            // consumer must name the HOST.
            const outer = await tracks(page, '#inherited');
            assert.equal(outer.length, 2,
                'setting the knob on an ANCESTOR must not reach the host: expected the '
                + `280 default's 2 tracks at 600px, got ${outer.join(' ')}`);
        }));

        /* -- 3. selection does not exist here, and cannot ---------------------- */

        test('dial drill, inverted: a slotted aria-checked tile takes nothing from the grid', () => mounted(async (page) => {
            // THE WAVE LAW: "No component in this wave may own a private 'selected'
            // look" (DECISIONS.md:244, spec §3.9). Slate's tile grid IS a radiogroup
            // and its 30 children paint themselves from --slate-selected-face /
            // --slate-selected-ink (slate-shell.css:1871-1879) — the selected look
            // belongs to the tile. A container that painted it would be a fourteenth
            // selection idiom.
            //
            // The positive proof: the checked and the unchecked tile are painted
            // identically, because the only thing painting them is the fixture.
            const picked = await page.computed('#picked', ['background-color', 'color', 'box-shadow', 'text-shadow']);
            const unpicked = await page.computed('#unpicked', ['background-color', 'color', 'box-shadow', 'text-shadow']);
            assert.deepEqual(picked, unpicked,
                'the grid contributes paint to a selected child — that is a private selection look');

            // And the four dials move nothing anywhere in the component.
            for (const dial of ['--ui-selected-face', '--ui-selected-ink', '--ui-selected-led', '--ui-selected-glow']) {
                const value = dial === '--ui-selected-glow' ? '60%'
                    : dial === '--ui-selected-led' ? '37px' : DRILL_COLOUR;
                const before = await page.computed('#picked', ['background-color', 'color', 'box-shadow', 'text-shadow']);
                await page.setToken(dial, value);
                const after = await page.computed('#picked', ['background-color', 'color', 'box-shadow', 'text-shadow']);
                await page.setToken(dial, null);
                assert.deepEqual(after, before, `${dial} reached a tile through the grid`);
            }
        }));

        test('the grid declares no colour of its own', () => mounted(async (page) => {
            // A layout primitive with a background is a surface, and a surface is #8's
            // job. Transparent means a tile grid can be dropped on any ground.
            const got = await page.computed('#g1200', ['background-color', 'background-image', 'border-top-width', 'box-shadow']);
            assert.equal(got['background-color'], 'rgba(0, 0, 0, 0)', 'the grid paints no ground');
            assert.equal(got['background-image'], 'none');
            near(got['border-top-width'], 0, 'the grid draws no border');
            assert.equal(got['box-shadow'], 'none');
        }));

        /* -- 4. focus geometry, unclipped ------------------------------------- */

        test('focus-unclipped: a slotted tile keeps the one ring, and nothing clips it', () => mounted(async (page) => {
            // Bug L24's class — "focus rings clipped on all four sides by the
            // components they sit inside". Structurally impossible here (nothing in
            // this component clips), which is exactly why it is worth asserting: the
            // claim is about the rendered chain of clippers, not about the source.
            await assertFocusUnclipped(page, '#g1200-t0');   // first column, left edge
            await assertFocusUnclipped(page, '#g1200-t3');   // last column, right edge
            await assertFocusUnclipped(page, '#g1200-t4');   // second row
        }));

        test('the gutter is wider than a ring, so two rings never touch', () => mounted(async (page) => {
            // 12px of gutter against --ui-focus-w + --ui-focus-offset of ring on each
            // side. If a future gutter token went below that the rings would overlap
            // and read as one selection — a real defect, cheap to catch here.
            const width = parseFloat(await page.resolveValue('var(--ui-focus-w)', 'outline-width'));
            const offset = parseFloat(await page.resolveValue('var(--ui-focus-offset)', 'outline-offset'));
            const gap = parseFloat(await page.prop('#g1200', 'column-gap'));
            assert.ok(gap >= 2 * (width + offset) - 0.5,
                `gutter ${gap}px does not clear two rings of ${width}px at +${offset}px`);
        }));

        test('the grid itself is not a tab stop', () => mounted(async (page) => {
            // A layout box that takes focus puts a stop between every row of tiles.
            const stops = await page.evalFn(() => {
                const g = document.getElementById('g1200');
                return { host: g.getAttribute('tabindex'), inRoot: g.shadowRoot.querySelectorAll('[tabindex]').length };
            });
            assert.equal(stops.host, null);
            assert.equal(stops.inRoot, 0);
        }));

        /* -- 5. the container floor — this component IS its responsive rule ---- */

        test('container floor: the column count is a function of the container, and only of it', () => mounted(async (page) => {
            // spec §2.1 Rule 1: "A component reads its own container, never the
            // viewport." Five containers, one viewport; the counts are arithmetic on
            // the container width alone — floor((W + 12) / (280 + 12)), floored at 1.
            const expected = [
                ['g1200', 4, 291],
                ['g900', 3, 292],
                ['g600', 2, 294],
                ['g300', 1, 300],
                ['g200', 1, 200],   // min(280px, 100%) collapses the floor — DEPARTURE 1
            ];
            for (const [id, columns, width] of expected) {
                const t = await tracks(page, `#${id}`);
                assert.equal(t.length, columns,
                    `#${id}: expected ${columns} track(s), got ${t.length} (${t.join(' ')})`);
                for (const w of t) near(w, width, `#${id} track width`);
            }
        }));

        test('container floor: below the 280px minimum the grid does not overflow its container', () => mounted(async (page) => {
            // DEPARTURE 1, and the behaviour it replaces. A bare minmax(280px, 1fr)
            // cannot go below 280, so at 200px Slate's grid is 280 wide inside a 200
            // wide box — and the language leaf's own wrapper is
            // `w-full max-w-full OVERFLOW-X-HIDDEN` (settings.js:5641), so the excess
            // is silently cut. spec §2.4: "At no point does anything tell the user
            // content was removed."
            //
            // Asserted on the RENDERED boxes, at both geometries: the tiles are inside
            // the grid, the grid is inside the holder, and nothing scrolls sideways.
            for (const id of ['g300', 'g200']) {
                const m = await page.metrics(`#${id}`);
                assert.ok(m.scrollWidth <= m.clientWidth + 0.51,
                    `#${id} overflows itself: scrollWidth ${m.scrollWidth} vs clientWidth ${m.clientWidth}`);
                const host = await page.box(`#${id}`);
                const tile = await page.box(`#${id}-t0`);
                assert.ok(tile.x >= host.x - 0.51 && tile.x + tile.width <= host.x + host.width + 0.51,
                    `#${id}: a tile [${tile.x}, ${tile.width}] escapes the grid [${host.x}, ${host.width}]`);

                // The single track is exactly the container, never the 280px floor —
                // which is the whole of DEPARTURE 1 in one number.
                const t = await tracks(page, `#${id}`);
                assert.equal(t.length, 1, `#${id}: expected one collapsed track, got ${t.join(' ')}`);
                near(t[0], host.width, `#${id}: the collapsed track is the container width`);
            }
        }));

        test('container floor: overflow stays visible — there is no scroll region here', () => mounted(async (page) => {
            // spec §2.4 asks every SCROLL region for a floor and a stated overflow.
            // This is not one: the grid grows in the block axis and the pane above it
            // scrolls. `visible` is the statement, and it is what makes the silent clip
            // above structurally impossible inside this component.
            const m = await page.metrics('#g1200');
            assert.equal(m.overflowX, 'visible');
            assert.equal(m.overflowY, 'visible');
            // Nothing anywhere in this component's own root clips either — the ring
            // assertions above lean on it, and the silent cut of departure 1 needs a
            // clipper to happen at all.
            const clips = await page.evalFn(() => {
                const root = document.getElementById('g1200').shadowRoot;
                return [...root.querySelectorAll('*')]
                    .map((el) => getComputedStyle(el).overflow)
                    .filter((o) => o !== 'visible');
            });
            assert.deepEqual(clips, [], 'something inside the grid clips');
        }));

        test('container floor: surplus block space does not stretch the rows', () => mounted(async (page) => {
            // DEPARTURE 2. A grid's initial align-content behaves as `stretch`, which
            // pours surplus block space into the auto-sized row tracks — one tile in a
            // 500px pane becomes one 500px tile. `align-content: start` keeps the tile
            // its own height. Slate never met the case; a Settings leaf pane will.
            const grid = await page.box('#tall');
            const tile = await page.box('#only');
            near(grid.height, 500, 'the tall grid fills its holder');
            assert.ok(tile.height < 200,
                `the row track stretched: one tile is ${tile.height}px inside a ${grid.height}px grid`);
            assert.equal(await page.prop('#tall', 'align-content'), 'start');
        }));

        test('the slot is display: contents, so the tiles are the grid items', () => mounted(async (page) => {
            // Without this the single <slot> is the one and only grid item and the
            // whole grid renders as one column — the failure looks like "auto-fill did
            // nothing", and every count above would still be 4.
            assert.equal(await page.prop('#g1200 >>> slot', 'display'), 'contents');
            const a = await page.box('#g1200-t0');
            const b = await page.box('#g1200-t1');
            near(b.y, a.y, 'the first two tiles are on one row, so they are grid items');
        }));

        /* -- 6. aria ---------------------------------------------------------- */

        test('aria: a bare grid has no role, a labelled one is a named group', () => mounted(async (page) => {
            // An unnamed generic group is noise in the accessibility tree; a named one
            // is the contract ui-card ships (ui-card.js:325-331) and the shape spec
            // Appendix 15 asks for — the aria state IS the state.
            const bare = await page.evalFn(() => {
                const g = document.getElementById('g1200');
                return { role: g.getAttribute('role'), label: g.getAttribute('aria-label') };
            });
            assert.deepEqual(bare, { role: null, label: null });

            const named = await page.evalFn(() => {
                const g = document.getElementById('labelled');
                return { role: g.getAttribute('role'), label: g.getAttribute('aria-label') };
            });
            assert.deepEqual(named, { role: 'group', label: 'Display language' });
        }));

        test('aria: an author-written role and name survive, and clearing the label restores the name', () => mounted(async (page) => {
            // Slate's instance is role="radiogroup" aria-label="Display language"
            // (settings.js:5657); a wave-5 screen composing real radio tiles needs to
            // keep it. "An attribute written and never removed is state that cannot go
            // back" (ui-chart-legend.js:588-590).
            const kept = await page.evalFn(() => {
                const g = document.getElementById('authored');
                return { role: g.getAttribute('role'), label: g.getAttribute('aria-label') };
            });
            assert.deepEqual(kept, { role: 'radiogroup', label: 'Written by the screen' });

            const cycled = await page.evalFn(async () => {
                const g = document.getElementById('authored');
                g.label = 'Set by the component';
                await g.updateComplete;
                const during = { role: g.getAttribute('role'), label: g.getAttribute('aria-label') };
                g.label = '';
                await g.updateComplete;
                return { during, after: { role: g.getAttribute('role'), label: g.getAttribute('aria-label') } };
            });
            assert.deepEqual(cycled.during, { role: 'radiogroup', label: 'Set by the component' });
            assert.deepEqual(cycled.after, { role: 'radiogroup', label: 'Written by the screen' },
                'clearing this component\'s label must restore the screen\'s, not delete it');
        }));

        test('aria: clearing a label the component set removes the role it set', () => mounted(async (page) => {
            const cycled = await page.evalFn(async () => {
                const g = document.getElementById('labelled');
                g.label = '';
                await g.updateComplete;
                return { role: g.getAttribute('role'), label: g.getAttribute('aria-label') };
            });
            assert.deepEqual(cycled, { role: null, label: null },
                'a group with no name is noise; the component must take both back');
        }));

        /* -- 7. no !important, and no viewport ------------------------------- */

        test('zero !important reaches the rendered result', () => mounted(async (page) => {
            // Spec §2.1 Rule 3 as a RENDERED fact rather than a source grep (Gate C
            // owns the grep): every declaration this component makes is beatable by an
            // ordinary rule in its own root.
            // Every declaration here is on :host, so the honest test is the consumer's
            // own escape hatch: an inline style outranks any author rule that is not
            // !important, and there is no other way to reach a shadow-scoped :host rule
            // from outside.
            const beaten = await page.evalFn(() => {
                const g = document.getElementById('g1200');
                g.style.gap = '41px';
                g.style.alignContent = 'end';
                g.style.display = 'flex';
                const cs = getComputedStyle(g);
                const out = { gap: cs.columnGap, align: cs.alignContent, display: cs.display };
                g.removeAttribute('style');
                return out;
            });
            assert.deepEqual(beaten, { gap: '41px', align: 'end', display: 'flex' },
                'an ordinary declaration must win — no !important anywhere in the component');
        }));

        test('no viewport query decides anything here', () => mounted(async (page) => {
            // The viewport moves by 281×201 between the two geometry blocks and the
            // container does not. Anything keyed on the viewport moves with it; the
            // cross-geometry comparison at the end of this file is where that is
            // proved, and this is its per-geometry half: the same container width
            // gives the same tracks whichever grid it is measured on.
            await page.setStyle('#g1200', { 'inline-size': '600px' });
            const forced = await tracks(page, '#g1200');
            await page.setStyle('#g1200', { 'inline-size': null });
            const native = await tracks(page, '#g600');
            assert.deepEqual(forced.map(Math.round), native.map(Math.round),
                'two grids at the same container width must track identically');
        }));
    });
}

describe('the gallery entry this component ships', () => {
    // The entry lives in its own file (tools/gallery/entries/ui-tile-grid.entry.js)
    // because parallel wave builders cannot all append to one array under a
    // whole-file-write rule; the wave's cross-cutting writer wires it into
    // tools/gallery/entries.js. The entry's own correctness is this builder's problem,
    // so every state's markup is mounted here, at the bench geometry.

    test('every declared state mounts, settles and lays out', async () => {
        const { entry } = await import('../../tools/gallery/entries/ui-tile-grid.entry.js');

        assert.equal(entry.id, 'ui-tile-grid', 'the entry id is the tag name is the file name');
        assert.equal(entry.module, './entries/ui-tile-grid.demo.js',
            'module is relative to tools/gallery/, and it is the sidecar because the '
            + 'states stage real #8 cards as the tiles');
        assert.ok(entry.states.length >= 3);
        assert.equal(new Set(entry.states.map((s) => s.id)).size, entry.states.length,
            'state ids are capture filenames, so they must be unique');

        await browser.withPage({ geometry: GATE_A_GEOMETRIES[0] }, async (page) => {
            for (const state of entry.states) {
                const wrapper = state.hostStyle
                    ? `<div id="stage" style="${Object.entries(state.hostStyle)
                        .map(([k, v]) => `${k}:${v}`).join(';')}">${state.html}</div>`
                    : `<div id="stage">${state.html}</div>`;
                await page.mount(wrapper, GALLERY_MODULE);
                assert.deepEqual(page.pageErrors, [], `${entry.id}--${state.id} threw`);
                assert.ok(await page.exists('ui-tile-grid'), `${entry.id}--${state.id} mounted no grid`);

                // EVERY GALLERY STAGE MUST BE A REAL CONTAINER, and for this component
                // that is not a nicety: the stage width IS the input, so a collapsed
                // stage baselines a grid that was never asked a question.
                const stage = await page.box('#stage');
                const grid = await page.box('ui-tile-grid');
                assert.ok(grid.width > stage.width / 2,
                    `${entry.id}--${state.id} is staged in a collapsed slot: ${grid.width} inside ${stage.width}`);

                const t = await page.prop('ui-tile-grid', 'grid-template-columns');
                assert.ok(/px/.test(t), `${entry.id}--${state.id} resolved no tracks (${t})`);
                assert.ok(grid.height > 0, `${entry.id}--${state.id} rendered ${grid.width}×${grid.height}`);
            }
        });
    });
});

describe('ui-tile-grid across both Gate A geometries', () => {
    test('the same containers give the same columns at 1281×801 and at 1000×600', () => {
        // Two viewports 281×201 apart at two device pixel ratios, five container widths
        // each. THIS IS THE COMPONENT'S WHOLE CLAIM: the only genuinely fluid layout in
        // the old app, re-expressed so that the fluidity reads the container and never
        // the window (spec §2.1 Rule 1, DECISIONS.md:178-181).
        assert.deepEqual(Object.keys(acrossGeometries).sort(), ['bench', 'floor']);
        assert.deepEqual(acrossGeometries.bench, acrossGeometries.floor);
        assert.deepEqual(acrossGeometries.bench.tracks, [291, 291, 291, 291]);
        assert.equal(acrossGeometries.bench.pitch, 303);
        assert.equal(acrossGeometries.bench.columns900, 3);
        assert.equal(acrossGeometries.bench.columns600, 2);
        assert.equal(acrossGeometries.bench.columns300, 1);
        assert.equal(acrossGeometries.bench.columns200, 1);
    });
});
