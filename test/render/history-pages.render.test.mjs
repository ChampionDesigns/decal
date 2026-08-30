/**
 * history-pages.render.test.mjs — wave 5.6, the PAGES cluster: `hist-flow-page`,
 * `hist-data-page`, `hist-components`, and bugs H1, H4, H5 and chart-C7.
 *
 * The skeleton suite (`history-skeleton.render.test.mjs`) owns the mount REGION and
 * proves that a page written to its contract gets the box the contract promises, using
 * two stand-ins. This suite owns the two REAL pages: that they fill that box, that the
 * ratio tracks behave as §4.5 says down to the floor and then branch, that the data grid
 * is the shipped compound with real rows, and that the A/B convention survives the port.
 *
 * A8, AND IT IS THE POINT OF THE FILE. Nothing here opens a file. Every assertion is a
 * computed style, a rendered box, an accessibility-tree node, or a live uPlot series
 * object read off the running plot. The ported history-viewer test's INTENT crosses over
 * and its FORM does not: it `readFileSync`'d `history-viewer.js` into a string and matched
 * against it, which is exactly the reading that could not see the bug it was written for —
 * "the previous alignment slider addressed a trace index one past the end, the code looked
 * entirely correct, the renderer threw, a catch swallowed it, and the control did nothing
 * at all". So the alignment assertions here read WHERE THE TRACES MOVED.
 *
 * BOTH GATE A GEOMETRIES: 1281x801 @ dsf 1.5 and the 1000x600 design floor. The mount
 * region measures 591 at the bench and 404.75 at the floor, so the two geometries put the
 * page either side of two card floors plus the gap and the ratio ladder below is measured
 * on both sides of it.
 *
 * THE SINGLE-PLOT BRANCH IS RETIRED (Ben, 30 Aug 2026 — F-036) and this suite changed with
 * it. Four tests used to pin it: the threshold's derivation, "one pixel under the threshold
 * the page shows ONE plot and a selector", "the selector actually changes which plot is
 * drawn", and the crossing-back case. All four asserted a layout Ben has removed for good,
 * and the assertions they made are quoted where they stood. What replaces them is the
 * outcome his decision names — the select is gone from the composed tree and BOTH cards
 * paint at every height, the short ones included.
 *
 * THE PLOTS ARE ARMED BEFORE THEY ARE MEASURED. A chart card with no derivation has no
 * uPlot instance at all (`plot-surface.js`: "no channels yet is an order, not an error"),
 * so every geometric claim below is made about a plot that is drawing two real recorded
 * shots from `tools/rea-fixtures/`.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { accessibleNames } from '../harness/editor.js';
import { FLOW_PLOTS, COMPARISON_ALPHA } from '../../src/lib/history-series.js';
import { HISTORY_COLUMNS } from '../../src/lib/shot-summary.js';

/**
 * HOW MANY COLUMNS THE SHOT LIST ACTUALLY DRAWS.
 *
 * `HISTORY_COLUMNS` is the shared summary table — the columns a shot HAS. The data page
 * appends one of its own, `picks`, holding the A and B discs, because "which two shots is
 * the only question this page exists to answer". It has a heading ("Charts") and a cell in
 * every row, so every count in this suite is one more than the shared table's length. */
const DRAWN_LIST_COLUMNS = HISTORY_COLUMNS.length + 1;

/**
 * What the page module exports, read OUT OF THE PAGE rather than retyped.
 *
 * A component module cannot be imported under `node:test` — its `lit` specifier resolves
 * through index.html's importmap and nowhere else — but the module is already loaded in
 * the page by the time anything is measured, so a dynamic import in the browser hands back
 * what it declares. (`settings-skeleton.render.test.mjs:65-74` established the pattern.)
 *
 * IT USED TO READ ONE NUMBER, `FLOW_SINGLE_PLOT_PX`, and the sweep below derived its
 * heights from it. That constant is retired with the branch it measured (F-036), so this
 * now reports the export LIST — which is how the suite states, as an assertion rather than
 * as a comment, that the threshold is gone and has not come back under another name.
 */
const authored = async (page) => JSON.parse(await page.eval(
    "import('/src/screens/history-flow-page.js').then((m) => JSON.stringify("
    + '{ exports: Object.keys(m).sort() }))',
));

const MODULES = [
    '/src/screens/history-screen.js',
    '/src/screens/history-flow-page.js',
    '/src/screens/history-data-page.js',
];

/**
 * THE SAME-PROFILE PAIR, and it is chosen for the alignment drill rather than for
 * convenience: 5fc3f631 (3.26 s) and d5139a1f (8.54 s) are both "Extractamundo Dos! (2)",
 * which is what an alignment offset is FOR ("grind drift between two pours of the same
 * profile, not lining up arbitrary shots"). Against the ±5 s limit a full-limit slide
 * carries the shorter trace clean past the other's end — the exact condition the old
 * slider threw on.
 */
const SHOT_A = '/tools/rea-fixtures/api__v1__shots__5fc3f631-6b18-471b-9800-00d552dbbecb.json';
const SHOT_B = '/tools/rea-fixtures/api__v1__shots__d5139a1f-c4ee-47e2-bb80-0cbf3e39b6a3.json';
const SHOT_LIST = '/tools/rea-fixtures/api__v1__shots~limit=20~offset=0~order=desc.json';

const near = (got, want, what, tol = 0.6) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: ${got} is not within ${tol} of ${want}`,
);

/**
 * THE MOUNT REGION'S OWN BOX, transcribed rather than borrowed.
 *
 * `#page` is one grid cell — `grid-template-rows: minmax(0,1fr)`,
 * `grid-template-columns: minmax(0,1fr)`, both minimums 0, no overflow — and this stage is
 * that declaration with a stated height, so the ladder below can set the page's height to
 * the pixel. Mounting the whole screen instead would make every rung an arithmetic
 * question about the band and the compare bar; the screen stage below asks that question
 * separately, once.
 */
const pageStage = (h, tag = 'history-flow-page') => `
<div id="stage" style="inline-size: 900px; block-size: ${h}px; display: grid;
     grid-template-rows: minmax(0,1fr); grid-template-columns: minmax(0,1fr)">
  <${tag} id="page-under-test"></${tag}>
</div>`;

/** The real screen with both real pages mounted, as §4.5 draws it. */
const screenStage = () => `
<div id="stage" style="inline-size: 100%; block-size: 100dvh">
  <history-screen>
    <history-flow-page slot="page" data-page="flow"></history-flow-page>
    <history-data-page slot="page" data-page="data"></history-data-page>
  </history-screen>
</div>`;

/** Feed the flow page two real derivations and wait for both plots to be built. */
const FEED_FLOW = (offset = 0) => `(async () => {
  const { deriveFromRecord } = await import('/src/lib/shot-derivation.js');
  const [a, b] = await Promise.all([
    fetch('${SHOT_A}').then((r) => r.json()),
    fetch('${SHOT_B}').then((r) => r.json()),
  ]);
  const page = document.querySelector('history-flow-page');
  page.derivationA = deriveFromRecord(a);
  page.derivationB = deriveFromRecord(b);
  page.offset = ${offset};
  await page.updateComplete;
  const cards = [...page.renderRoot.querySelectorAll('ui-chart-card')];
  await Promise.all(cards.map((c) => c.ready));
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
  return {
    ok: page.derivationA.ok && page.derivationB.ok,
    durations: [page.derivationA.scalars.durationSeconds, page.derivationB.scalars.durationSeconds],
    built: cards.map((c) => c.buildCount),
  };
})()`;

/** Feed the data page: two derivations and twenty real list rows. */
const FEED_DATA = `(async () => {
  const { deriveFromRecord } = await import('/src/lib/shot-derivation.js');
  const { shotRows } = await import('/src/lib/shot-summary.js');
  const [a, b, list] = await Promise.all([
    fetch('${SHOT_A}').then((r) => r.json()),
    fetch('${SHOT_B}').then((r) => r.json()),
    fetch('${SHOT_LIST}').then((r) => r.json()),
  ]);
  const page = document.querySelector('history-data-page');
  page.derivationA = deriveFromRecord(a);
  page.derivationB = deriveFromRecord(b);
  page.rows = shotRows(list.items);
  /* THE SLOT IDS ARE THE RECORDS' OWN, and since cmp-seh-4 they have to be: the caption
   * names the shot from the row whose id the slot holds, so a slot pointing at a
   * different row than the derivation under it would caption the table with the wrong
   * shot. This used to set shotA to list.items[0], which is SHOT_B's record — harmless
   * while the id only marked a row in the list, a visible lie once it is painted. */
  page.shotA = a.id;
  page.shotB = b.id;
  await page.updateComplete;
  await Promise.all([...page.renderRoot.querySelectorAll('ui-data-grid')].map((g) => g.updateComplete));
  await new Promise((r) => requestAnimationFrame(r));
  return { rows: page.rows.length, total: list.total };
})()`;

/** Every measurement the ratio ladder needs, in one round trip. */
const READ_FLOW = `(() => {
  const page = document.querySelector('history-flow-page');
  const box = (el) => { const b = el.getBoundingClientRect(); return { h: +b.height.toFixed(3), w: +b.width.toFixed(3) }; };
  const root = page.renderRoot;
  const grid = root.getElementById('grid');
  const top = root.getElementById('plot-top');
  const temp = root.getElementById('plot-temp');
  const cs = (el) => getComputedStyle(el);
  const plotOf = (c) => (c.plotHandle ? { w: c.plotHandle.raw.width, h: c.plotHandle.raw.height } : null);
  const scrolls = (el) => el.scrollHeight - el.clientHeight > 0.5;
  return {
    host: box(page), grid: box(grid),
    tracks: cs(grid).gridTemplateRows,
    top: box(top), temp: box(temp),
    shown: { top: cs(top).display !== 'none', temp: cs(temp).display !== 'none' },
    cardFloor: parseFloat(cs(top).minBlockSize),
    plots: { top: plotOf(top), temp: plotOf(temp) },
    plotScrolls: scrolls(top) || scrolls(temp),
    gridContent: +(top.getBoundingClientRect().height + temp.getBoundingClientRect().height
      + parseFloat(cs(grid).rowGap)).toFixed(3),
    clips: { grid: cs(grid).overflowY, host: cs(page).overflowY },
    hostOverflow: +(page.scrollHeight - page.clientHeight).toFixed(2),
  };
})()`;

/**
 * The live uPlot series of one plot, with the colour RESOLVED by calling uPlot's own
 * stroke function. Not the authored spec and not a stylesheet: what the canvas is being
 * stroked with, this frame.
 */
const READ_SERIES = (id) => `(() => {
  const card = document.querySelector('history-flow-page').renderRoot.getElementById('${id}');
  const u = card.plotHandle.raw;
  return u.series.slice(1).map((s, i) => ({
    label: s.label,
    dash: s.dash ? [...s.dash] : null,
    cap: s.cap,
    alpha: s.alpha,
    width: s.width,
    stroke: typeof s.stroke === 'function' ? s.stroke(u, i + 1) : s.stroke,
  }));
})()`;

/** The traces' actual x extents, per series — where the alignment offset moved them. */
const READ_TRACE_X = (id) => `(() => {
  const card = document.querySelector('history-flow-page').renderRoot.getElementById('${id}');
  const u = card.plotHandle.raw;
  const xs = u.data[0];
  const out = {};
  u.series.slice(1).forEach((s, i) => {
    const ys = u.data[i + 1] ?? [];
    let lo = null; let hi = null;
    for (let k = 0; k < ys.length; k += 1) {
      if (ys[k] === null || ys[k] === undefined) continue;
      if (lo === null) lo = xs[k];
      hi = xs[k];
    }
    out[s.label] = lo === null ? null : { from: +lo.toFixed(3), to: +hi.toFixed(3) };
  });
  return { axis: { from: +xs[0].toFixed(3), to: +xs[xs.length - 1].toFixed(3) }, series: out };
})()`;

const READ_DATA = `(() => {
  const page = document.querySelector('history-data-page');
  const root = page.renderRoot;
  const columns = getComputedStyle(page).gridTemplateColumns.trim().split(/\\s+/).length;
  const box = (el) => { const b = el.getBoundingClientRect(); return { h: +b.height.toFixed(2), w: +b.width.toFixed(2) }; };
  const metrics = (el) => ({
    scrollH: el.scrollHeight, clientH: el.clientHeight,
    gutter: el.offsetWidth - el.clientWidth,
    overflowY: getComputedStyle(el).overflowY,
  });
  const frameOf = (grid) => grid.renderRoot.getElementById('frame');
  const tableA = root.getElementById('table-a');
  const tableB = root.getElementById('table-b');
  const list = root.getElementById('shot-list');
  /* The GRID ITEMS are the phase sections — caption over table — since cmp-seh-4. */
  const phaseA = root.getElementById('phase-a');
  const phaseB = root.getElementById('phase-b');
  const rect = (el) => { const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(2), y: +b.y.toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2) }; };
  const caption = (slot) => {
    const disc = root.getElementById('disc-' + slot);
    const text = root.getElementById('shot-' + slot);
    return {
      text: (text.textContent || '').trim(),
      letter: (disc.textContent || '').trim(),
      discLabel: disc.getAttribute('label'),
      discSelected: disc.hasAttribute('selected'),
      discRect: rect(disc),
      textRect: rect(text),
      tableRect: rect(root.getElementById('table-' + slot)),
      gridLabel: root.getElementById('table-' + slot).getAttribute('label'),
    };
  };
  return {
    host: box(page),
    tracks: getComputedStyle(page).gridTemplateRows,
    columns: columns,
    gap: getComputedStyle(page).rowGap,
    tableA: box(tableA), tableB: box(tableB), list: box(list),
    phaseA: box(phaseA), phaseB: box(phaseB),
    captionA: caption('a'), captionB: caption('b'),
    tableAFrame: metrics(frameOf(tableA)),
    tableBFrame: metrics(frameOf(tableB)),
    listFrame: metrics(frameOf(list)),
    listFloor: getComputedStyle(list).minBlockSize,
    listColumns: getComputedStyle(list.renderRoot.getElementById('table')).gridTemplateColumns,
    tableAColumns: getComputedStyle(tableA.renderRoot.getElementById('table')).gridTemplateColumns,
    rowCount: list.renderRoot.querySelectorAll('[role="row"]').length,
    cellCount: list.renderRoot.querySelectorAll('[role="cell"]').length,
    headerCellCount: list.renderRoot.querySelectorAll('[role="columnheader"]').length,
    orphanCells: [...list.renderRoot.querySelectorAll('[role="cell"],[role="columnheader"],[role="rowheader"]')]
      .filter((el) => !el.closest('[role="row"]')).length,
    emptyStates: root.querySelectorAll('ui-empty-state').length,
  };
})()`;

/** Every custom-element tag either page renders into its own shadow root. */
const TAGS = (tag) => `(() => {
  const page = document.querySelector('${tag}');
  return [...new Set([...page.renderRoot.querySelectorAll('*')]
    .map((el) => el.tagName.toLowerCase())
    .filter((name) => name.includes('-')))].sort();
})()`;

/**
 * THE 57-ITEM INVENTORY, as far as these two pages reach it. A tag outside this set in
 * either page's shadow root is scope invention (Part 10 §9) — and the point of the row is
 * that by this phase nothing on the screen is architecturally novel, so the honest test is
 * that the set is CLOSED rather than that it is non-empty.
 */
const INVENTORY = Object.freeze({
    'history-flow-page': ['ui-chart-card', 'ui-chart-legend', 'ui-empty-state', 'ui-select'],
    'history-data-page': ['ui-data-grid', 'ui-empty-state', 'ui-pick-disc'],
});

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`History pages @ ${geometry.name}`, () => {
        let browser;
        let page;

        before(async () => {
            browser = await launch({ geometry });
            page = await browser.newPage({ geometry });
        });
        after(async () => { await browser?.close(); });

        /* ===================================================================
         * THE MOUNT CONTRACT — the pages fill the box the region gives them
         * =================================================================== */

        test('both pages take the mount region whole, and overlay rather than stack', async () => {
            await page.mount(screenStage(), MODULES);
            await page.settle(6);

            const region = await page.box('history-screen >>> #page');
            const flow = await page.box('history-flow-page');
            const data = await page.box('history-data-page');

            /* THE REGION'S CELL, NOT ITS BORDER BOX. Parity surface 6 gave #page an
             * inline inset (--ui-space-6 each flank, the oracle's own 28 on all three
             * of its History surfaces), so the CELL a page is placed in is the region's
             * CONTENT box. The claim is unchanged and still exact — the page fills the
             * cell it is given — and it is read off the region's own resolved padding
             * rather than off a number written here, so it holds if the inset moves. */
            const pad = await page.computed('history-screen >>> #page',
                ['padding-left', 'padding-right', 'padding-top', 'padding-bottom']);
            const px = (v) => parseFloat(v);
            const cellWidth = region.width - px(pad['padding-left']) - px(pad['padding-right']);
            const cellHeight = region.height - px(pad['padding-top']) - px(pad['padding-bottom']);
            assert.ok(px(pad['padding-left']) > 0,
                'the inset is real: a zero here would make the two readings the same and '
                + 'this assertion would stop distinguishing them');

            near(flow.height, cellHeight, 'the flow page is the mount region tall');
            near(flow.width, cellWidth, 'the flow page is the mount region wide');
            near(flow.left, region.left + px(pad['padding-left']),
                'the flow page starts one inset inside the region');
            near(flow.top, region.top + px(pad['padding-top']),
                'the flow page starts where the region\'s cell does');
            /* THE OVERLAY CLAIM. Two pages are mounted at once; ::slotted() pins both to
             * row 1 / column 1, so the second must not take an implicit second row. The
             * hidden page has no box at all, which is #32's `hidden` doing its work — so
             * the test is that the SHOWING page still has the region's whole height. */
            assert.equal(data.height, 0, 'the page that is not showing has no box');
            near(flow.height, cellHeight, 'and the showing page still has the whole region');
        });

        test('the flow page hands its cell straight on to the grid it queries', async () => {
            const host = await page.box('history-flow-page');
            const grid = await page.box('history-flow-page >>> #grid');
            near(grid.height, host.height, 'the inner grid is the host tall');
            near(grid.width, host.width, 'the inner grid is the host wide');
        });

        test('the mount contract is filled in by the pages themselves', async () => {
            const attrs = await page.evalFn(() => [...document.querySelectorAll('history-flow-page, history-data-page')]
                .map((el) => ({
                    tag: el.tagName.toLowerCase(),
                    slot: el.getAttribute('slot'),
                    dataPage: el.getAttribute('data-page'),
                })));
            assert.deepEqual(attrs.map((a) => a.slot), ['page', 'page']);
            assert.deepEqual(attrs.map((a) => a.dataPage), ['flow', 'data']);
        });

        /* ===================================================================
         * H1 — RATIO TRACKS WITH FLOORS
         * (and F-036, the branch that used to sit below them)
         * =================================================================== */

        test('the card floor is still the plot floor PLUS the card chrome', async () => {
            await page.mount(pageStage(700), MODULES);
            await page.eval(FEED_FLOW());
            await page.settle(6);
            const read = await page.eval(READ_FLOW);
            const chartMin = parseFloat(await page.tokenValue('--ui-chart-min-h'));

            /* THIS IS WHAT SURVIVES OF THE THRESHOLD TEST. It read:
             *
             *     const { threshold } = await authored(page);
             *     assert.equal(threshold, 2 * read.cardFloor + gap,
             *         'FLOW_SINGLE_PLOT_PX must equal two card floors plus the page gap');
             *
             * — a derivation check on a constant that existed to place `@container
             * (block-size < 520px)`. With the branch retired (F-036) there is no second
             * layout for a threshold to separate, so what is left to assert is the term the
             * page still depends on: a card's own floor, which is what decides when #grid
             * begins to scroll. */
            assert.ok(read.cardFloor > chartMin,
                `the card floor (${read.cardFloor}) is --ui-chart-min-h (${chartMin}) plus chrome`);
        });

        test('F-036 — the "Which plot" select is gone from the composed tree', async () => {
            await page.mount(pageStage(700), MODULES);
            await page.eval(FEED_FLOW());
            await page.settle(6);

            /* BEN, 30 AUGUST 2026: "Remove them for good." The audit found `ui-select#picker`
             * composed on every history state and painted on none — `display: none`, box
             * 0x0, unfocusable, at all five viewports Wave 3 swept — with both cards drawn
             * side by side anyway (F-036, unit L0212).
             *
             * COMPOSED, NOT PAINTED, IS THE CLAIM THAT MATTERS. A test for `display: none`
             * would have passed against the old tree too: the point is that the element is
             * not in the render root at all, so no future container query can bring an
             * unreachable control back. */
            const composed = await page.evalFn(() => {
                const root = document.querySelector('history-flow-page').renderRoot;
                return {
                    picker: root.getElementById('picker') !== null,
                    selects: root.querySelectorAll('ui-select').length,
                    plotAttr: document.querySelector('history-flow-page').hasAttribute('plot'),
                };
            });
            assert.equal(composed.picker, false, '#picker is still in the tree');
            assert.equal(composed.selects, 0, 'a ui-select is still composed on this page');
            assert.equal(composed.plotAttr, false,
                'the reflected `plot` property is retired with the branch it selected');

            const { exports } = await authored(page);
            assert.ok(!exports.includes('FLOW_SINGLE_PLOT_PX'),
                `the retired threshold is exported again: ${exports.join(', ')}`);
        });

        test('F-036 — both cards paint at every height, the short ones included', async () => {
            /* THE HEIGHTS WALK THROUGH WHERE THE BRANCH USED TO BE. 520 was
             * FLOW_SINGLE_PLOT_PX (2 x 254 + 12); 519 and 400 are inside what was the
             * one-plot branch, where the old suite asserted `!under.shown.temp` — "and the
             * other one has no box at all". That is the assertion Ben's decision reverses. */
            for (const h of [700, 591, 521, 519, 400]) {
                await page.mount(pageStage(h), MODULES);
                await page.eval(FEED_FLOW());
                await page.settle(6);
                const read = await page.eval(READ_FLOW);
                assert.ok(read.shown.top, `${h}: the first card must paint`);
                assert.ok(read.shown.temp, `${h}: the second card must paint`);
                assert.ok(read.top.h >= read.cardFloor - 0.6,
                    `${h}: the first card is at or above its floor (${read.top.h})`);
                assert.ok(read.temp.h >= read.cardFloor - 0.6,
                    `${h}: the second card is at or above its floor (${read.temp.h})`);
                assert.equal(read.plotScrolls, false, `${h}: a plot never scrolls — it resizes`);
            }
        });

        test('F-036 — a region too short for both floors SPILLS rather than dropping one',
            async () => {
                /* NOTHING CLIPS SILENTLY (§2.4), which is this tree's standing answer and
                 * the reason the removal needed no new declaration. Below two card floors
                 * plus the gap the grid's content is taller than its box; every box in the
                 * chain declares `overflow: visible`, so the shortfall travels outward to
                 * the document instead of hiding a card behind a fold. The single-plot
                 * branch was the OTHER answer to that question, and Ben retired it.
                 *
                 * A SCROLL CONTAINER ON #grid WAS TRIED AND MEASURED WORSE: `overflow-y:
                 * auto` forces overflow-x from visible to auto, #10's legend hit overlay
                 * overhangs by up to 8px, and the resulting horizontal scrollbar took ~15px
                 * off the block axis — the derived card fell from 286.67 to 280.4 and the
                 * ratio ladder above went red. */
                await page.mount(pageStage(700), MODULES);
                await page.eval(FEED_FLOW());
                await page.settle(6);
                const roomy = await page.eval(READ_FLOW);
                assert.equal(roomy.hostOverflow, 0, 'at a height that fits, nothing overflows');

                await page.mount(pageStage(400), MODULES);
                await page.eval(FEED_FLOW());
                await page.settle(6);
                const tight = await page.eval(READ_FLOW);
                assert.ok(tight.shown.top && tight.shown.temp,
                    'both cards paint even here — this is the assertion Ben\'s decision reverses');
                assert.equal(tight.clips.grid, 'visible', 'the grid does not clip');
                assert.equal(tight.clips.host, 'visible', 'and neither does the page');
                assert.ok(tight.gridContent > tight.grid.h + 0.5,
                    `the content really is taller than the box (${tight.gridContent} in ${tight.grid.h})`);
                assert.equal(tight.plotScrolls, false, 'and the plots still do not scroll');
            });

        test('the two plots hold Slate\'s ratio until the shorter one reaches its floor', async () => {
            /* THE HEIGHTS WERE DERIVED FROM THE BRANCH POINT AND NOW THEY ARE DERIVED FROM
             * THE FLOORS. They used to be `[threshold + 180, +100, +40, +1]`, walking down
             * to `FLOW_SINGLE_PLOT_PX` from above so the sweep could not drift out of the
             * two-plot branch when the constant moved. The constant is retired with the
             * branch (F-036) and the thing the sweep must stay above is what the constant
             * was made of: two card floors plus the page gap, measured here rather than
             * named. The `!read.shown.picker` assertion on each rung — "the selector has no
             * box in this branch" — went with the selector.
             *
             * ONE ASSERTION IS DELIBERATELY NOT CARRIED DOWN. The rung sweep used to end
             * each row with `hostOverflow === 0`; that is now the F-036 scroll test's
             * claim, made at both a roomy and a tight height, where it is the point rather
             * than a side condition. */
            await page.mount(pageStage(700), MODULES);
            await page.eval(FEED_FLOW());
            await page.settle(6);
            const gap = parseFloat(await page.tokenValue('--ui-space-3'));
            const twoFloors = (await page.eval(READ_FLOW)).cardFloor * 2 + gap;
            const heights = [twoFloors + 180, twoFloors + 100, twoFloors + 40, twoFloors + 1];
            const seen = [];
            for (const h of heights) {
                await page.mount(pageStage(h), MODULES);
                await page.eval(FEED_FLOW());
                await page.settle(6);
                const read = await page.eval(READ_FLOW);
                seen.push({ h, top: read.top.h, temp: read.temp.h, floor: read.cardFloor });

                assert.ok(read.shown.top && read.shown.temp, `${h}: both plots show`);
                assert.ok(read.temp.h >= read.cardFloor - 0.6, `${h}: the second plot is at or above its floor`);
                assert.ok(read.top.h >= read.cardFloor - 0.6, `${h}: the first plot is at or above its floor`);
                assert.equal(read.plotScrolls, false, `${h}: a plot never scrolls — it resizes`);
                assert.equal(read.hostOverflow, 0, `${h}: and the page does not overflow`);
            }
            /* THE RATIO ITSELF, while there is room for it. The bottom track hits the floor
             * first, and from there the top keeps the remainder — which is the grid
             * honouring a floor, not the ratio being wrong.
             *
             * 1.209 AND NOT 1.2, AND IT IS READ FROM THE TABLE. 1.2 was the same number
             * rounded before anyone had measured Slate's: hv-flow-chart 416px over
             * hv-temp-chart 344px is 1.2093. `FLOW_PLOTS[0].ratio` is the one place it is
             * written — this page and the expanded overlay both read it — so the assertion
             * reads it too rather than restating it and drifting a third time. */
            const ratio = FLOW_PLOTS.find((plot) => plot.id === 'top').ratio
                / FLOW_PLOTS.find((plot) => plot.id === 'temp').ratio;
            for (const row of seen) {
                if (row.temp > row.floor + 0.6) {
                    near(row.top / row.temp, ratio, `at ${row.h} the tracks are ${ratio} : 1`, 0.005);
                }
            }
            const shrank = seen[0].top > seen[seen.length - 1].top;
            assert.ok(shrank, 'the plots RESIZE with the page — that is what a ratio track is');
        });

        /* THREE TESTS STOOD HERE AND WENT WITH THE BRANCH (F-036, Ben 30 Aug 2026). All
         * three asserted the layout he removed for good, so all three are quoted rather
         * than adapted:
         *
         *   'one pixel under the threshold the page shows ONE plot and a selector'
         *       assert.ok(under.shown.picker, 'below it the selector has a box');
         *       assert.ok(!under.shown.temp, 'and the other one has no box at all');
         *
         *   'the selector actually changes which plot is drawn'
         *       — drove `#picker`'s `change` and asserted the two cards swapped boxes.
         *
         *   'crossing back to two plots restores the hidden plot to its box'
         *       assert.ok(!hidden.shown.temp, 'staged in the one-plot branch');
         *
         * THE ONE CLAIM WORTH KEEPING OUT OF THEM is the last one's real subject: a card
         * whose box changes must bring its canvas with it (chart-C11's ResizeObserver).
         * That is a property of the card at ANY box change, not of a branch, so it is
         * asserted below by resizing the page rather than by crossing a threshold. */

        test('a card that is given a new box brings its canvas with it', async () => {
            await page.mount(pageStage(700), MODULES);
            await page.eval(FEED_FLOW());
            await page.settle(6);
            const tall = await page.eval(READ_FLOW);
            assert.ok(tall.plots.temp.h > 100, 'staged with a real canvas');

            await page.setStyle('#stage', { 'block-size': '560px' });
            await page.settle(8);
            const short = await page.eval(READ_FLOW);
            assert.ok(short.shown.temp, 'the second card still paints at the smaller height');
            assert.ok(short.plots.temp.h > 100,
                `the canvas followed its box down (got ${short.plots.temp.h})`);
            assert.ok(short.plots.temp.h < tall.plots.temp.h,
                'and it is actually smaller — the observer ran, it did not merely survive');

            await page.setStyle('#stage', { 'block-size': '700px' });
            await page.settle(8);
            const back = await page.eval(READ_FLOW);
            assert.ok(back.plots.temp.h > short.plots.temp.h,
                `and back up again (got ${back.plots.temp.h})`);
        });

        test('no plot has a px height anywhere in its chain', async () => {
            await page.mount(pageStage(700), MODULES);
            await page.eval(FEED_FLOW());
            await page.settle(6);
            const declared = await page.evalFn(() => {
                const el = document.querySelector('history-flow-page');
                const cards = [...el.renderRoot.querySelectorAll('ui-chart-card')];
                return cards.map((c) => ({
                    inline: c.getAttribute('style'),
                    blockSize: c.style.blockSize || null,
                    height: c.style.height || null,
                }));
            });
            for (const card of declared) {
                assert.equal(card.blockSize, null, 'no plot host declares a block-size');
                assert.equal(card.height, null, 'and none declares a height');
                assert.ok(!card.inline || !/height/i.test(card.inline),
                    'and nothing wrote one back as an inline style');
            }
        });

        /* ===================================================================
         * chart-C7 — DASH, CAP AND OPACITY, UNIFORMLY
         * =================================================================== */

        test('one cap, A at its OWN two weights, and every pair told apart', async () => {
            await page.mount(pageStage(700), MODULES);
            await page.eval(FEED_FLOW());
            await page.settle(6);
            const series = await page.eval(READ_SERIES('plot-top'));

            assert.ok(series.length >= 10, 'both shots are on the plot');
            const caps = new Set(series.map((s) => s.cap));
            assert.deepEqual([...caps], ['round'],
                'ONE cap across every series — chart-C7 is that this was true only inside '
                + 'bandsPlugin, so the trajectory had round caps and no other series did');

            const a = series.filter((s) => !s.label.startsWith('b:'));
            const b = series.filter((s) => s.label.startsWith('b:'));
            assert.equal(a.length, b.length, 'the two shots draw the same channels');

            for (const trace of a) {
                const mate = b.find((s) => s.label === `b:${trace.label}`);
                assert.ok(mate, `${trace.label} has a comparison mate`);
                assert.equal(mate.stroke, trace.stroke,
                    `${trace.label}: SAME HUE — the comparison names the same channel token`);
                assert.ok(Array.isArray(mate.dash) && mate.dash.length > 0,
                    `${trace.label}: B is dashed`);
                assert.equal(trace.alpha, 1, `${trace.label}: A is drawn at full opacity`);
                assert.equal(mate.alpha, COMPARISON_ALPHA,
                    `${trace.label}: and B keeps its fade — opacity is NOT flattened away`);
                /* THE FADE IS WHAT TELLS EVERY PAIR APART, on every channel. The dash does
                 * it too wherever A is solid; on A's own dashed targets the two patterns
                 * are both [9,9] and the fade is the whole distinction. That is recorded
                 * as an open question rather than settled here — the reversal is one
                 * string, `COMPARISON_DASH` in history-series.js. */
                assert.notEqual(mate.alpha, trace.alpha,
                    `${trace.label}: the pair is told apart on every channel`);
                if (!trace.dash) {
                    assert.notDeepEqual(mate.dash, trace.dash,
                        `${trace.label}: A is solid here, so the dash tells them apart as well`);
                }
            }

            /* AND A IS NOT DRAWN AT ONE WEIGHT. Composing on the surface with
             * `setChannels` bypasses the card's own merge of `CHANNEL_TREATMENTS`, so all
             * five of A's series used to draw solid at the MAJOR stroke here while Live
             * drew the same five, from the same derivation, with its targets dashed and
             * minor — §6.2's swatch-that-lies defect, arriving through the traces. The
             * page hands the table in; these are the two weights it carries. */
            const byKey = Object.fromEntries(a.map((s) => [s.label, s]));
            assert.equal(byKey.pressure.dash, null, 'a measured channel is solid');
            assert.equal(byKey.flow.dash, null, 'both of them');
            assert.ok(byKey.targetPressure.dash?.length > 0, 'and a TARGET is dashed');
            assert.ok(byKey.targetFlow.dash?.length > 0, 'both of those too');
            assert.deepEqual(byKey.targetPressure.dash, byKey.targetFlow.dash,
                'from one table, so the two targets carry one pattern');
            assert.ok(byKey.targetPressure.width < byKey.pressure.width,
                `a target is the MINOR stroke (${byKey.targetPressure.width}) under the major `
                + `one (${byKey.pressure.width}) — §3.8's two tokens, not one`);
            assert.equal(byKey.weightFlow.width, byKey.targetPressure.width,
                'and weight flow is minor as well, without a dash');
            assert.equal(new Set(a.map((s) => s.width)).size, 2,
                'exactly two weights across A — one was the defect');

            const solidA = a.filter((s) => !s.dash);
            assert.ok(solidA.length > 0, 'the reference shot draws solid lines');
        });

        test('a chip is drawn at the weight and the dash of the trace it stands for', async () => {
            /* §6.2 FOR THIS SCREEN, MEASURED BOTH ENDS AT ONCE. The defect the spec names
             * is "a swatch whose weight does not match its trace", and this screen had it
             * on both halves at the same time: the traces lost their treatment because a
             * composition on the surface never runs the card's merge, and `legendItems()`
             * returned `{ key, label }` alone while its own docblock claimed the weight
             * and dash came with them. Every chip rendered 3px solid. The two now come
             * from one derivation, so the only honest assertion is that they agree —
             * read off the rendered SVG and the live uPlot series, never off either file. */
            await page.mount(pageStage(700), MODULES);
            await page.eval(FEED_FLOW());
            await page.settle(6);

            const measured = await page.evalFn(() => {
                const el = document.querySelector('history-flow-page');
                const u = el.renderRoot.getElementById('plot-top').plotHandle.raw;
                const traces = {};
                for (const s of u.series.slice(1)) {
                    if (String(s.label).startsWith('b:')) continue;
                    traces[s.label] = { width: s.width, dash: s.dash ? [...s.dash] : null };
                }
                const legend = el.renderRoot.querySelector('ui-chart-legend');
                const chips = [...legend.renderRoot.querySelectorAll('.chip')].map((chip) => {
                    const style = getComputedStyle(chip.querySelector('.swatch line'));
                    return {
                        key: chip.getAttribute('data-key'),
                        width: parseFloat(style.strokeWidth),
                        dash: style.strokeDasharray === 'none'
                            ? null
                            : style.strokeDasharray.split(',').map((n) => parseFloat(n)),
                    };
                });
                return { traces, chips };
            });

            /* SIX SINCE 24 AUGUST 2026. Ben: "The pressure/Flow chart should also display
             * the Power series on the same axis, single axis." Power was Slate's own sixth
             * trace on this plot and came out because Slate drew it on an INVISIBLE
             * auto-ranged y2; the answer was no second axis rather than a visible one.
             * Hydraulic power is 0.1·P·F watts, which shares the 0-10 band pressure and
             * flow already share. */
            assert.equal(measured.chips.length, 6, 'one chip for each channel A draws');
            for (const chip of measured.chips) {
                const trace = measured.traces[chip.key];
                assert.ok(trace, `${chip.key}: the chip stands for a trace that is on the plot`);
                assert.equal(chip.width, trace.width,
                    `${chip.key}: the swatch is drawn at the trace's own stroke width`);
                assert.deepEqual(chip.dash, trace.dash,
                    `${chip.key}: and with the trace's own dash pattern`);
            }
            assert.equal(new Set(measured.chips.map((c) => c.width)).size, 2,
                'two weights across the key, because there are two across the plot');
        });

        test('the legend names A only — twelve entries is a second chart, not a key', async () => {
            const items = await page.evalFn(() => {
                const el = document.querySelector('history-flow-page');
                const legend = el.renderRoot.querySelector('ui-chart-legend');
                return legend.items.map((i) => i.key);
            });
            assert.ok(items.length > 0, 'the legend has items');
            assert.equal(items.filter((k) => k.startsWith('b:')).length, 0,
                'and none of them is the comparison shot');
        });

        test('the alignment offset moves B and leaves A where it was', async () => {
            await page.mount(pageStage(700), MODULES);
            await page.eval(FEED_FLOW(0));
            await page.settle(6);
            const at0 = await page.eval(READ_TRACE_X('plot-top'));

            await page.mount(pageStage(700), MODULES);
            await page.eval(FEED_FLOW(5));
            await page.settle(6);
            const at5 = await page.eval(READ_TRACE_X('plot-top'));

            near(at5.series.pressure.from, at0.series.pressure.from,
                'A did not move: it is the reference');
            near(at5.series['b:pressure'].from, at0.series['b:pressure'].from + 5,
                'B moved by exactly the offset', 0.01);
            near(at5.series['b:pressure'].to, at0.series['b:pressure'].to + 5,
                'both ends of B moved by the offset', 0.01);
            /* THE PAST-THE-END CONDITION, STAGED RATHER THAN GUARDED AGAINST. A is 3.26 s
             * and B is 8.54 s; at a full-limit slide B ends past A's last sample and the
             * union axis has to carry it. The old renderer threw here and a catch swallowed
             * it, so the assertion is that the axis GREW rather than that nothing broke. */
            assert.ok(at5.axis.to > at0.axis.to,
                `the union axis grew to hold the slid trace (${at0.axis.to} -> ${at5.axis.to})`);
            assert.ok(at5.series['b:pressure'].to > at5.series.pressure.to,
                'and B now ends past A, which is the condition the ported test exists for');
        });

        /* ===================================================================
         * THE DATA PAGE — §4.5's tracks, H4 and H5
         * =================================================================== */

        test('the summaries take their own height, the list takes what is left', async () => {
            await page.mount(pageStage(700, 'history-data-page'), MODULES);
            await page.eval(FEED_DATA);
            await page.settle(6);
            const read = await page.eval(READ_DATA);

            /* TWO SHAPES SINCE 25 AUGUST 2026, AND THE CLAIM IS THE SAME IN BOTH.
             *
             * Ben: "Due to your smaller Phase chart I believe we can fit B to the right of
             * A? If so please do that." Above 1100px the page is two columns — A beside B
             * on one auto row, the list spanning a minmax(0, 1fr) row under them. At or
             * below it they stack, and there are three rows again. The bench geometry is
             * 1281 and the floor is 1000, so this suite meets BOTH branches, one per
             * geometry, which is why the shape is read rather than assumed.
             *
             * WHAT DOES NOT CHANGE is the whole point of the page: the two summaries are
             * their own height and the SHOT LIST is the track that pays. For one release
             * the narrow branch changed the columns and left the rows at two, so phase B
             * took the flexible track and was squeezed below phase A while the list sat in
             * an implicit row at its floor. That is what these assertions catch. */
            const tracks = read.tracks.trim().split(/\s+/).map(parseFloat);
            const stacked = read.columns === 1;
            assert.equal(tracks.length, stacked ? 3 : 2,
                stacked ? 'stacked: A, B, then the list' : 'side by side: the pair, then the list');

            /* THE TRACKS SIZE TO THE SECTIONS, which is caption + table (cmp-seh-4).
             * Track 1 is therefore taller than table A alone, and by exactly the caption
             * and the section's own gap — asserted below rather than assumed. */
            near(tracks[0], read.phaseA.h, 'track 1 is shot A\'s section');
            if (stacked) near(tracks[1], read.phaseB.h, 'track 2 is shot B\'s section');

            /* NEITHER SUMMARY IS SQUEEZED. They hold the same table, so a difference in
             * height is one of them paying for the layout — which is the defect above. */
            near(read.phaseA.h, read.phaseB.h,
                'A and B are the same section and must come out the same height', 1);
            assert.ok(read.phaseA.h > read.tableA.h,
                'and the section is the table plus its caption');

            /* "THE LIST TAKES WHAT IS LEFT" — literally, and it is measured rather than
             * compared. It used to be asserted as `tracks[2] > tracks[0]`, which was true
             * of the shipped page by arithmetic accident and stopped being true the moment
             * cmp-seh-4 put a --ui-control-inner disc above each table: at this 700px stage
             * the budget is now 236.30 + 236.30 sections and 2 x 12px gaps, leaving 203.41
             * for the list. Its size was never the claim — being the track that PAYS is,
             * and that is what the floor test below moves. */
            const rowGap = parseFloat(read.gap);
            const gaps = (tracks.length - 1) * rowGap;
            near(tracks.reduce((a, b) => a + b, 0) + gaps, read.host.h,
                'the tracks and the gaps ARE the page — nothing else has a box', 1);
            const listFloor = parseFloat(
                await page.resolveValue('var(--ui-history-list-min-h)', 'min-block-size'),
            );
            const listTrack = tracks[tracks.length - 1];
            assert.ok(listTrack >= listFloor - 0.6 || read.listFrame.scrollH > read.listFrame.clientH,
                `the list track is on or above its floor (${listTrack} vs ${listFloor})`);

            /* THE TWO FIXED SUMMARIES DO NOT SCROLL. The component's frame is a scroll
             * region by construction; the page's job is to size the instances so its
             * overflow never engages, and this is that claim rather than its mechanism. */
            for (const [name, frame] of [['A', read.tableAFrame], ['B', read.tableBFrame]]) {
                assert.ok(frame.scrollH - frame.clientH <= 0.5,
                    `table ${name} does not scroll (scrollHeight ${frame.scrollH} vs client ${frame.clientH})`);
                assert.equal(frame.gutter, 0, `table ${name} shows no scrollbar`);
            }

            assert.ok(read.listFrame.scrollH > read.listFrame.clientH + 1,
                'the list has more rows than box, so it scrolls');
            assert.equal(read.listFrame.overflowY, 'auto', 'and its overflow is stated');
            assert.ok(read.listFrame.gutter > 0,
                'with a VISIBLE scrollbar — §2.4 bans hiding it');
        });

        /**
         * cmp-seh-4 — THE TWO TABLES SAY WHOSE SHOT THEY ARE.
         *
         * The finding, confirmed at major: "two identical-looking tables with different
         * numbers, distinguishable only by order". The capture held ZERO text records
         * between the page div and the first grid frame while both tables showed different
         * data; the shot's identity reached `label=` and stopped there.
         *
         * WHAT SLATE PAINTS, and every number in it is already a token:
         *   [i=176] the A disc, rect [57, 155, 62, 62] — 62px is --ui-control-inner
         *   [i=177] #hv-data-sub-a "15/08 07:10 · Lever Classic demo", x=137, so the gap
         *           is 137 − (57 + 62) = 18px = --ui-space-4
         *   [i=211] [i=212] the same pair for B.
         *
         * THE STRING IS ASSERTED AGAINST ITS OWNER, not against a date this file formats.
         * `shot-summary.js`'s `shotOptionLabel()` is what the band's pickers offer and what
         * `shotRow()` puts on every row as `label`; the claim is that the caption is THAT
         * string and not a second spelling of the same shot, so the test asks the module.
         */
        test('cmp-seh-4 — each phase table is captioned with its disc and the shot\'s own label',
            async () => {
                await page.mount(pageStage(700, 'history-data-page'), MODULES);
                await page.eval(FEED_DATA);
                await page.settle(6);
                const read = await page.eval(READ_DATA);

                /* THE ONE OWNER OF "HOW A SHOT NAMES ITSELF", asked directly. */
                const expected = await page.evalFn(async (url) => {
                    const { shotOptionLabel } = await import('/src/lib/shot-summary.js');
                    const list = await fetch(url).then((r) => r.json());
                    const page_ = document.querySelector('history-data-page');
                    const of = (id) => shotOptionLabel(list.items.find((i) => i.id === id));
                    return { a: of(page_.shotA), b: of(page_.shotB) };
                }, SHOT_LIST);

                for (const [slot, caption, want] of [
                    ['A', read.captionA, expected.a], ['B', read.captionB, expected.b],
                ]) {
                    assert.equal(caption.letter, slot, `the ${slot} disc carries its letter`);
                    assert.equal(caption.discLabel, `Shot ${slot}`,
                        'and its accessible name is the slot, not the glyph');
                    assert.equal(caption.text, want,
                        `the ${slot} caption is shotOptionLabel's string, not a second spelling`);
                    assert.ok(caption.text.length > 0, 'and it is really painted');
                    assert.equal(caption.gridLabel, `Shot ${slot} by phase, ${want}`,
                        'the grid\'s accessible name carries the SAME string — one spelling, '
                        + 'painted and spoken');
                    assert.equal(caption.discSelected, true,
                        'the disc is filled because this slot has a shot on the charts');
                }
                assert.notEqual(read.captionA.text, read.captionB.text,
                    'THE FINDING: the two tables are now told apart by what they say, not by order');

                /* SLATE'S SHAPE, in tokens: a --ui-control-inner disc, --ui-space-4 from
                 * the words, both above the table they caption. */
                const discSize = parseFloat(await page.resolveValue('var(--ui-control-inner)', 'inline-size'));
                const gapToken = parseFloat(await page.resolveValue('var(--ui-space-4)', 'inline-size'));
                for (const [slot, caption] of [['A', read.captionA], ['B', read.captionB]]) {
                    near(caption.discRect.w, discSize, `the ${slot} disc is --ui-control-inner wide`, 1);
                    near(caption.discRect.h, discSize, `and as tall`, 1);
                    near(caption.textRect.x - (caption.discRect.x + caption.discRect.w), gapToken,
                        `${slot}: the words sit --ui-space-4 from the disc`, 1);
                    assert.ok(caption.discRect.y + caption.discRect.h <= caption.tableRect.y + 1,
                        `${slot}: the caption is above the table it names`);
                }

                /* AN EMPTY SLOT PAINTS NO TEXT AND KEEPS ITS DISC — Slate's own branch
                 * (`history-viewer.js:783`: sub.textContent = ''). The table below already
                 * says "No comparison shot"; a caption saying it again would be the same
                 * sentence twice. */
                await page.evalFn(() => {
                    const el = document.querySelector('history-data-page');
                    el.shotB = '';
                    el.derivationB = null;
                    return el.updateComplete;
                });
                await page.settle(4);
                const cleared = await page.eval(READ_DATA);
                assert.equal(cleared.captionB.text, '', 'no shot in the slot, no words');
                assert.equal(cleared.captionB.letter, 'B', 'but the disc stays, and stays B');
                assert.equal(cleared.captionB.discSelected, false,
                    'unfilled, through the same dials the band\'s discs use');
                assert.equal(cleared.captionB.gridLabel, 'Shot B by phase',
                    'and the grid falls back to the name it always had');
                assert.equal(cleared.captionA.text, read.captionA.text,
                    'A is untouched by B emptying');

                /* PUT BOTH SLOTS BACK. The tests below this one measure the page THIS
                 * test left mounted, and a page with one empty table is a different box. */
                await page.eval(FEED_DATA);
                await page.settle(4);
            });

        test('the list floor is the token, and moving the token moves the box', async () => {
            const before = await page.box('history-data-page >>> #shot-list');
            /* THE COMPUTED value, not the authored one: the token is
             * calc(3 * var(--ui-list-row)) and a calc() survives into the custom
             * property's value, so parsing the declaration would read NaN and prove
             * nothing. `resolveValue` asks the engine what it makes of it. */
            const floor = parseFloat(await page.resolveValue('var(--ui-history-list-min-h)', 'min-block-size'));
            const row = parseFloat(await page.resolveValue('var(--ui-list-row)', 'min-block-size'));
            assert.equal(floor, 3 * row, 'the floor is three list rows, composed from the token');

            /* SHRINK THE PAGE UNTIL THE FLOOR IS WHAT DECIDES, then move the token. */
            await page.setStyle('#stage', { 'block-size': '360px' });
            await page.settle(4);
            const squeezed = await page.box('history-data-page >>> #shot-list');
            near(squeezed.height, floor, 'squeezed, the list sits exactly on its floor');

            await page.setToken('--ui-history-list-min-h', `${floor + 40}px`);
            await page.settle(4);
            const moved = await page.box('history-data-page >>> #shot-list');
            near(moved.height, floor + 40, 'and the box follows the token');
            await page.setToken('--ui-history-list-min-h', null);
            await page.setStyle('#stage', { 'block-size': '700px' });
            await page.settle(4);
            assert.ok(before.height > 0, 'the list had a box to begin with');
        });

        test('H4 — every cell has a row that owns it, read off the accessibility tree', async () => {
            await page.mount(pageStage(700, 'history-data-page'), MODULES);
            await page.eval(FEED_DATA);
            await page.settle(6);

            const nodes = await accessibleNames(page);
            const rows = nodes.filter((n) => n.role === 'row');
            const cells = nodes.filter((n) => ['cell', 'gridcell', 'columnheader', 'rowheader'].includes(n.role));
            assert.ok(rows.length > 0,
                'ROWS EXIST — Slate\'s grid has 28 children, 27 role-bearing, and not one row (H4)');
            assert.ok(cells.length > 0, 'and cells exist');

            const read = await page.eval(READ_DATA);
            assert.equal(read.orphanCells, 0,
                'not one cell, column header or row header is outside a role="row"');
            assert.ok(read.rowCount >= 21,
                `the list renders a header row and twenty shot rows (got ${read.rowCount})`);
            /* THE HEADER ROW'S CELLS ARE columnheaders, so the BODY rows are what carry
             * `cell` — one per column per row, and not one more or fewer, which is what
             * "no API appends a cell without a row" buys. */
            /* HISTORY_COLUMNS PLUS THE PICK COLUMN. The list draws one more column than
             * the shared summary table declares: `picks`, the A/B discs, added by this
             * page and by nothing else — "which two shots is the only question this page
             * exists to answer, and a list you can only read is a list that makes you go
             * back to a dropdown". It is a real column with a real heading ("Charts"), so
             * it counts here like any other. */
            assert.equal(read.cellCount, (read.rowCount - 1) * DRAWN_LIST_COLUMNS,
                'and every body row carries every column — no cell can slip a track');
            assert.equal(read.headerCellCount, DRAWN_LIST_COLUMNS,
                'with exactly one column header per column and no role-less corner');
        });

        test('H5 — the shot list is all fr and the phase table label track is content-sized', async () => {
            const read = await page.eval(READ_DATA);
            const listTracks = read.listColumns.trim().split(/\s+/).map(parseFloat);
            assert.equal(listTracks.length, DRAWN_LIST_COLUMNS,
                'one track per drawn column — not Slate\'s six fixed ones totalling 554px');
            const listWidth = read.list.w;
            const sum = listTracks.reduce((a, b) => a + b, 0);
            assert.ok(sum > listWidth * 0.5,
                'the tracks fill the box, which fixed tracks in a wider box would not');

            /* THE fr CLAIM, MEASURED: widen the box and every track widens with it. A
             * fixed track would not move at all, which is exactly Slate's 554px. */
            await page.setStyle('#stage', { 'inline-size': '1200px' });
            await page.settle(4);
            const wider = await page.eval(READ_DATA);
            const widerTracks = wider.listColumns.trim().split(/\s+/).map(parseFloat);
            /* EVERY TEXT COLUMN GROWS. The last one is `picks`, and it is `grow: 0` on
             * purpose — "two discs are a fixed width, and a pick column that stretched
             * would take room from the profile title, which is the one column on this list
             * that can actually use it". So it is asserted the other way: it must NOT grow,
             * which is a claim about the same declaration read from the other side. */
            for (let i = 0; i < HISTORY_COLUMNS.length; i += 1) {
                assert.ok(widerTracks[i] > listTracks[i],
                    `column ${HISTORY_COLUMNS[i].key} grew with the box (fr, not px)`);
            }
            const picks = listTracks.length - 1;
            near(widerTracks[picks], listTracks[picks],
                'the pick column holds two discs and must not take the title\'s room', 1);

            /* THE ROW-LABEL TRACK IS max-content, NOT A 210px PIN: it is as wide as the
             * longest phase name and NOT a share of the extra 300px. */
            const labelBefore = parseFloat(read.tableAColumns.trim().split(/\s+/)[0]);
            const labelAfter = parseFloat(wider.tableAColumns.trim().split(/\s+/)[0]);

            /* MEASURED AGAINST WHAT A SHARE WOULD HAVE DONE, not against zero movement.
             * The track is minmax(--_ui-data-grid-label-min, max-content), so its size is
             * its longest label — but max-content is a TEXT measurement and it moves a few
             * subpixels as the table's own box changes and glyph positions re-round.
             * Measured 84.86 -> 90.45 across a 300px widening, against the ~33px a ninth
             * of that widening would be. Asserting "it did not move at all" pinned the
             * rounding rather than the claim. */
            const shared = (wider.list.w - read.list.w) / DRAWN_LIST_COLUMNS;
            assert.ok(labelAfter - labelBefore < shared / 2,
                `the row-label track is content-sized: it grew ${(labelAfter - labelBefore).toFixed(2)} `
                + `where a share of the box would have grown it ${shared.toFixed(2)}`);
            assert.ok(labelBefore < 210,
                `and it is its content's width, not Slate's 210px pin (got ${labelBefore})`);
            await page.setStyle('#stage', { 'inline-size': '900px' });
            await page.settle(4);
        });

        test('the empty states are the library\'s, and they say what is missing', async () => {
            await page.mount(pageStage(700, 'history-data-page'), MODULES);
            await page.settle(6);
            const empty = await page.evalFn(() => {
                const el = document.querySelector('history-data-page');
                return [...el.renderRoot.querySelectorAll('ui-empty-state')]
                    .map((e) => ({ tag: e.tagName.toLowerCase(), heading: e.heading }));
            });
            assert.equal(empty.length, 3, 'both tables and the list refuse, each in its own words');
            assert.ok(empty.some((e) => /comparison/i.test(e.heading)),
                'the B table says there is no comparison shot rather than showing zeroes');
            assert.ok(empty.some((e) => /no shots/i.test(e.heading)),
                'and the list says what a fresh machine has');
        });

        /**
         * THE PAGE'S ROW BUDGET, AND WHO CARRIES THE SHORTFALL.
         *
         * Two rulings and one defect have moved through this test since cmp-seh-4 put a
         * --ui-control-inner disc above each table, and all three are recorded here
         * because the number this asserts is different at each geometry for a reason.
         *
         * 1. THE PAIR SHARES A ROW ABOVE 1100px (Ben, 25 August 2026: "Due to your
         *    smaller Phase chart I believe we can fit B to the right of A? If so please
         *    do that."). So the page's budget is NOT the sum of the two sections at every
         *    size any more, and a `need` written as phase-a + phase-b + 2 gaps + the list
         *    floor describes only the narrow branch. It described both when it was
         *    written, and reading it across the ruling is how this test came to demand
         *    55.59px of scroll at a geometry with 216px to spare.
         *
         * 2. THE FLOOR STILL STACKS, so the shortfall it was written for is still real
         *    there, and it is still the document that carries it — §2.4, "nothing clips
         *    silently". Neither the mount region (bug L24) nor the page declares an
         *    overflow, so the page overruns its region and the overrun reaches the
         *    viewport, which scrolls. Both branches are asserted, one per geometry.
         *
         * 3. THE DOCUMENT USED TO SCROLL FOR A THIRD REASON, and that one was a defect
         *    (found and fixed 26 August 2026, ui-pick-disc.js). visuallyHidden gives its
         *    .a11y span position: absolute, the disc was not a positioned ancestor, and
         *    an absolutely positioned box whose containing block lies outside a scrollport
         *    is not clipped by it — so forty one-pixel accessible names, one per pick disc
         *    in the shot list, took their static positions down inside the list's own
         *    scroll region and then contributed that depth to the VIEWPORT's scrollable
         *    overflow instead of the frame's. The rows were clipped correctly; their
         *    labels were not.
         *
         * MEASURED, on the real screen, twenty real shots, after the fix:
         *
         *   bench 1281x801 @ dsf 1.5   two columns, tracks 248.30 / 408.70
         *     have 681.00   need 464.30   room to spare 216.70   document scrolls 0
         *   floor 1000x600 @ dsf 1     one column, tracks 248.30 / 248.30 / 0
         *     have 494.75   need 736.59   shortfall 241.84       document scrolls 242
         *
         * and before the fix, at the same two geometries, the document scrolled 1227 and
         * 1685 — numbers with no layout behind them, because dragging the document through
         * them slid the whole screen off the top and left the shot list exactly where it
         * was. The list's own frame is where those rows live: it measures scrollHeight
         * 1670 in clientHeight 409 at the bench, which is the correct answer and is
         * asserted by the track test above. The page's shortfall and the list's hidden
         * rows are two different overflows and only one of them belongs to the document.
         * The last assertion below is what tells them apart.
         *
         * `need` IS READ OFF THE RESOLVED TRACKS rather than composed from the sections,
         * so it follows the media query instead of restating it: every track but the last
         * is a summary the page cannot shrink, the last is the list's minmax(0, 1fr), and
         * what the list must have there is its floor.
         */
        test('the data page overruns only where it must, and the DOCUMENT carries it', async () => {
            await page.mount(screenStage(), MODULES);
            await page.eval(FEED_DATA);
            await page.evalFn(() => {
                document.querySelector('history-screen').page = 'data';
                return true;
            });
            await page.settle(6);

            const measured = await page.evalFn(() => {
                const root = document.documentElement;
                const pg = document.querySelector('history-data-page');
                const cs = getComputedStyle(pg);
                const gap = parseFloat(cs.rowGap);
                const list = pg.renderRoot.getElementById('shot-list');
                const frame = list.renderRoot.getElementById('frame');
                const tracks = cs.gridTemplateRows.trim().split(/\s+/).map(parseFloat);
                const floor = parseFloat(getComputedStyle(list).minBlockSize);
                /* EVERY TRACK BUT THE LAST IS A SUMMARY, and the last is the list's.
                 * Side by side that is one track holding both sections; stacked it is
                 * two. Either way the page cannot give the summaries less than they
                 * measure, and it cannot give the list less than its floor. */
                const summaries = tracks.slice(0, -1).reduce((a, b) => a + b, 0);
                return {
                    have: +pg.getBoundingClientRect().height.toFixed(2),
                    stacked: cs.gridTemplateColumns.trim().split(/\s+/).length === 1,
                    tracks: tracks.map((t) => +t.toFixed(2)),
                    need: +(summaries + (tracks.length - 1) * gap + floor).toFixed(2),
                    listBox: +list.getBoundingClientRect().height.toFixed(2),
                    listOverflow: frame.scrollHeight - frame.clientHeight,
                    docScroll: +(root.scrollHeight - root.clientHeight).toFixed(2),
                    /* THE TWO SCROLL HEIGHTS, which is the fixed defect's fingerprint.
                     * A box positioned against the initial containing block overflows the
                     * viewport without ever overflowing body, so these two parted by
                     * 1227px while the page itself fitted. In flow they cannot part. */
                    docScrollHeight: root.scrollHeight,
                    bodyScrollHeight: document.body.scrollHeight,
                    regionClips: getComputedStyle(
                        document.querySelector('history-screen').renderRoot.getElementById('page'),
                    ).overflowY,
                    pageClips: cs.overflowY,
                };
            });

            /* THE BRANCH IS PINNED TO THE GEOMETRY, not merely read off the page.
             * The track test above already checks that the columns and the rows agree
             * with each other, which is true of either branch; what is asserted here is
             * the harder thing the docblock's two-line table depends on — that this
             * suite meets BOTH branches, one per Gate A geometry, so neither set of
             * numbers is theoretical. It keys on the geometry rather than on the page's
             * 1100px query because restating that number here would give it a second
             * home; if the threshold moves so that both geometries land on one branch,
             * this fires and says which table above went stale. */
            assert.equal(measured.stacked, geometry.name !== 'bench',
                `${geometry.name} should take the `
                + `${geometry.name === 'bench' ? 'side-by-side' : 'stacked'} branch, and took the `
                + `${measured.stacked ? 'stacked' : 'side-by-side'} one`);
            assert.equal(measured.tracks.length, measured.stacked ? 3 : 2,
                'and the track count is that branch\'s');

            /* THE LIST KEEPS ITS FLOOR EITHER WAY. That is what makes the shortfall a
             * MEASUREMENT of the floor rather than a layout that quietly gave it up. */
            const floor = parseFloat(await page.resolveValue('var(--ui-history-list-min-h)', 'min-block-size'));
            assert.ok(measured.listBox >= floor - 0.6, 'the shot list is never below its floor');

            /* NOTHING CLIPS, at either end of the chain: the region declares no overflow
             * (bug L24) and neither does the page, so a shortfall reaches the document,
             * which scrolls. §2.4: "nothing clips silently". */
            assert.equal(measured.regionClips, 'visible', 'the mount region does not clip');
            assert.equal(measured.pageClips, 'visible', 'and neither does the page');

            if (measured.need > measured.have) {
                near(measured.docScroll, measured.need - measured.have,
                    'the document scroll is exactly the shortfall, so every row is reachable', 1.5);
                assert.ok(measured.docScroll > 0, 'and it really does scroll');
            } else {
                assert.equal(measured.docScroll, 0, 'with room to spare nothing scrolls');
            }

            /* AND THE LIST'S HIDDEN ROWS ARE THE LIST'S. The frame holds well over a
             * thousand pixels the page never has to find room for; if any of it reached
             * the document the assertion above would already have failed, but it would
             * fail as an arithmetic surprise rather than as this sentence. body and the
             * document agree only while everything that overflows does so IN FLOW — the
             * pick discs' absolutely positioned labels parted them by 1227px while the
             * page itself fitted its region exactly. */
            assert.ok(measured.listOverflow > 1000,
                `the shot list really is holding rows out of sight (${measured.listOverflow}px)`);
            assert.equal(measured.docScrollHeight, measured.bodyScrollHeight,
                'and nothing reaches the viewport past body: everything that scrolls is in flow');
        });

        /* ===================================================================
         * THE COMPARE BAR'S PER-PAGE PRESENCE RULE
         * =================================================================== */

        test('the compare bar shows on the flow page and is absent on the data page', async () => {
            await page.mount(screenStage(), MODULES);
            await page.settle(6);
            /* THE COMPARISON IS ASKED FOR FIRST. Since 24 Aug 2026 the screen opens on
             * ONE shot and the bar is absent until then — tapping the Live chart lands
             * here, and a slider with nothing to slide is not what that press was about.
             * The PER-PAGE rule this test is for is unchanged and is measured with the
             * comparison open. */
            await page.evalFn(async () => {
                const screen = document.querySelector('history-screen');
                screen.comparing = true;
                await screen.updateComplete;
            });
            await page.settle(2);

            const onFlow = await page.box('history-screen >>> #compare');
            assert.ok(onFlow.height > 0, 'the flow page has a time axis, so the bar is there');
            /* ASKED OF THE CONTROLS, NOT OF THE CAPTION. The bar's own "Align B" is a
             * <span> and carries no role, so the honest question is whether the thing a
             * person can OPERATE is in the tree: the slider and its reset. */
            const namesOnFlow = await accessibleNames(page);
            assert.ok(namesOnFlow.some((n) => n.role === 'slider' && /Slide shot B/i.test(n.name)),
                'the alignment slider is in the accessibility tree');
            assert.ok(namesOnFlow.some((n) => n.role === 'button' && /^Reset$/i.test(n.name)),
                'and so is its reset');

            await page.evalFn(() => {
                document.querySelector('history-screen').page = 'data';
                return true;
            });
            await page.settle(6);
            const onData = await page.box('history-screen >>> #compare');
            assert.equal(onData.height, 0, 'a table has no time axis, so the bar takes no box');
            const namesOnData = await accessibleNames(page);
            assert.equal(namesOnData.filter((n) => n.role === 'slider').length, 0,
                'the slider is gone from the accessibility tree — not shown dead, absent');
            assert.ok(!namesOnData.some((n) => n.role === 'button' && /^Reset$/i.test(n.name)),
                'and so is its reset');
        });

        /* ===================================================================
         * COMPOSED, NOT CONSTRUCTED
         * =================================================================== */

        for (const [tag, inventory] of Object.entries(INVENTORY)) {
            test(`${tag} composes only library components`, async () => {
                await page.mount(screenStage(), MODULES);
                await page.settle(4);
                const tags = await page.eval(TAGS(tag));
                for (const name of tags) {
                    assert.ok(inventory.includes(name),
                        `${name} is not on this page's slice of the 57-item inventory — a tag `
                        + 'outside it is scope invention (Part 10 §9)');
                }
                assert.ok(tags.length > 0, 'and the page does compose something');
            });
        }

        /* THE CARVE-OUT IS REVERSED FOR ONE SURFACE, AND THIS IS THE OTHER SIDE OF IT.
         * Fix run 6 built the power page, so "the #11 time key is nowhere" is no longer
         * true of the SCREEN. It is still true of these two pages, and that is the claim
         * worth asserting: Ben reversed D1 for the power page and nowhere else, so a time
         * key or a trajectory appearing HERE would be the carve-out leaking rather than
         * being spent. `test/render/history-power.render.test.mjs` owns the positive. */
        test('the time key and the trajectory are on the POWER page and nowhere else', async () => {
            const found = await page.evalFn(() => {
                const deep = (root, acc = []) => {
                    for (const el of root.querySelectorAll('*')) {
                        acc.push(el.tagName.toLowerCase());
                        if (el.shadowRoot) deep(el.shadowRoot, acc);
                    }
                    return acc;
                };
                const all = deep(document);
                return {
                    timeKey: all.filter((t) => t.includes('time-key')).length,
                    pq: all.filter((t) => t.includes('pq') || t.includes('trajectory')).length,
                    power: all.filter((t) => t.includes('power-page')).length,
                };
            });
            assert.deepEqual(found, { timeKey: 0, pq: 0, power: 0 },
                'the flow and data pages carry no time key, no trajectory and no power page: '
                + 'D1 still holds everywhere except the one surface Ben named');
        });

        /* PARITY SURFACE 6 — THE SHOT LIST'S READING ORDER.
         *
         * Slate paints this list in THREE inks over 21 rows and Decal painted it in
         * one, so eight columns of timestamps and dashes read as loudly as the profile
         * name. Restored through the column table's own `ink` field — the mechanism
         * PHASE_COLUMNS already spends on the weight channel — and asserted against
         * RESOLVED TOKENS on RENDERED cells, per column, so a column that lost its ink
         * fails by name. */
        test('parity 6 — the shot list is read in three inks, by column', async () => {
            await page.mount(screenStage(), MODULES);
            await page.settle(6);
            await page.evalFn(() => { document.querySelector('history-screen').page = 'data'; });
            await page.eval(FEED_DATA);
            await page.settle(6);
            const want = {
                date: await page.resolveToken('--ui-muted', 'color'),
                time: await page.resolveToken('--ui-muted', 'color'),
                profile: await page.resolveToken('--ui-text', 'color'),
                duration: await page.resolveToken('--ui-text-2', 'color'),
                yield: await page.resolveToken('--ui-text-2', 'color'),
                peakPressure: await page.resolveToken('--ui-text-2', 'color'),
                averageFlow: await page.resolveToken('--ui-text-2', 'color'),
                enjoyment: await page.resolveToken('--ui-text-2', 'color'),
            };
            assert.notEqual(want.date, want.profile,
                'the three tokens must resolve to three colours, or this proves nothing');
            assert.notEqual(want.duration, want.profile, 'and the outcome ink is its own step');

            const got = await page.evalFn(() => {
                const grid = document.querySelector('history-data-page')
                    .renderRoot.getElementById('shot-list');
                const out = {};
                for (const cell of grid.renderRoot.querySelectorAll('.cell')) {
                    const key = cell.id.slice(cell.id.lastIndexOf('-') + 1);
                    (out[key] ||= []).push(getComputedStyle(cell).color);
                }
                return out;
            });
            for (const [key, colour] of Object.entries(want)) {
                const seen = got[key] || [];
                assert.ok(seen.length >= 20,
                    `the ${key} column paints ${seen.length} cells; the list is twenty rows long`);
                assert.deepEqual([...new Set(seen)], [colour],
                    `CITE history-shotdata: every cell of this column carries one ink, and `
                    + `the ${key} column's is ${colour}`);
            }
        });
    });
}
