/**
 * The PAGES cluster: hist-flow-page, hist-data-page, hist-components.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { accessibleNames } from '../harness/editor.js';
import { FLOW_PLOTS } from '../../src/lib/history-series.js';
import { HISTORY_COLUMNS } from '../../src/lib/shot-summary.js';

const DRAWN_LIST_COLUMNS = HISTORY_COLUMNS.length + 1;

const authored = async (page) => JSON.parse(await page.eval(
    "import('/src/screens/history-flow-page.js').then((m) => JSON.stringify("
    + '{ exports: Object.keys(m).sort() }))',
));

const MODULES = [
    '/src/screens/history-screen.js',
    '/src/screens/history-flow-page.js',
    '/src/screens/history-data-page.js',
];

const SHOT_A = '/tools/rea-fixtures/api__v1__shots__5fc3f631-6b18-471b-9800-00d552dbbecb.json';
const SHOT_B = '/tools/rea-fixtures/api__v1__shots__d5139a1f-c4ee-47e2-bb80-0cbf3e39b6a3.json';
const SHOT_LIST = '/tools/rea-fixtures/api__v1__shots~limit=20~offset=0~order=desc.json';

const near = (got, want, what, tol = 0.6) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: ${got} is not within ${tol} of ${want}`,
);

const pageStage = (h, tag = 'history-flow-page') => `
<div id="stage" style="inline-size: 900px; block-size: ${h}px; display: grid;
     grid-template-rows: minmax(0,1fr); grid-template-columns: minmax(0,1fr)">
  <${tag} id="page-under-test"></${tag}>
</div>`;

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
 * stroke function. Not the authored value and not a stylesheet: what the canvas is being
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

        test('both pages take the mount region whole, and overlay rather than stack', async () => {
            await page.mount(screenStage(), MODULES);
            await page.settle(6);

            const region = await page.box('history-screen >>> #page');
            const flow = await page.box('history-flow-page');
            const data = await page.box('history-data-page');

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

        test('the card floor is still the plot floor PLUS the card chrome', async () => {
            await page.mount(pageStage(700), MODULES);
            await page.eval(FEED_FLOW());
            await page.settle(6);
            const read = await page.eval(READ_FLOW);
            const chartMin = parseFloat(await page.tokenValue('--ui-chart-min-h'));

            assert.ok(read.cardFloor > chartMin,
                `the card floor (${read.cardFloor}) is --ui-chart-min-h (${chartMin}) plus chrome`);
        });

        test('F-036 — the "Which plot" select is gone from the composed tree', async () => {
            await page.mount(pageStage(700), MODULES);
            await page.eval(FEED_FLOW());
            await page.settle(6);

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
                    'both cards paint even here — this is the assertion the decision reverses');
                assert.equal(tight.clips.grid, 'visible', 'the grid does not clip');
                assert.equal(tight.clips.host, 'visible', 'and neither does the page');
                assert.ok(tight.gridContent > tight.grid.h + 0.5,
                    `the content really is taller than the box (${tight.gridContent} in ${tight.grid.h})`);
                assert.equal(tight.plotScrolls, false, 'and the plots still do not scroll');
            });

        test('the two plots hold Slate\'s ratio until the shorter one reaches its floor', async () => {
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

        test('a card that is given a new box brings its canvas with it', async () => {
            await page.mount(pageStage(900), MODULES);
            await page.eval(FEED_FLOW());
            await page.settle(6);
            const tall = await page.eval(READ_FLOW);
            assert.ok(tall.plots.temp.h > 100, 'staged with a real canvas');

            await page.setStyle('#stage', { 'block-size': '700px' });
            await page.settle(8);
            const short = await page.eval(READ_FLOW);
            assert.ok(short.shown.temp, 'the second card still paints at the smaller height');
            assert.ok(short.plots.temp.h > 100,
                `the canvas followed its box down (got ${short.plots.temp.h})`);
            assert.ok(short.plots.temp.h < tall.plots.temp.h,
                'and it is actually smaller — the observer ran, it did not merely survive');

            await page.setStyle('#stage', { 'block-size': '900px' });
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
                assert.notEqual(mate.stroke, trace.stroke, 'A and B have separate shades');
                assert.equal(trace.alpha, 1);
                assert.equal(mate.alpha, 1);
                const target = trace.label.startsWith('target');
                assert.equal(Boolean(trace.dash?.length), target, 'only targets are dashed');
                assert.equal(Boolean(mate.dash?.length), target, 'including B targets');
                assert.equal(trace.width, target ? 3.5 : 4.5);
                assert.equal(mate.width, target ? 1.05 : 1.35);
                if (target) assert.notDeepEqual(trace.dash, mate.dash, 'target rhythms identify their shot');
            }

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
            assert.equal(byKey.weightFlow.width, byKey.pressure.width,
                'weight flow is measured and keeps the measured width');
            assert.equal(new Set(a.map((s) => s.width)).size, 2,
                'exactly two weights across A — one was the defect');

            const solidA = a.filter((s) => !s.dash);
            assert.ok(solidA.length > 0, 'the reference shot draws solid lines');
        });

        test('a chip is drawn at the weight and the dash of the trace it stands for', async () => {
            await page.mount(pageStage(700), MODULES);
            await page.eval(FEED_FLOW());
            await page.settle(6);
            await page.evalFn(async () => {
                const el = document.querySelector('history-flow-page');
                el.derivationB = null;
                await el.updateComplete;
            });
            await page.settle(6);

            const measured = await page.evalFn(() => {
                const el = document.querySelector('history-flow-page');
                const u = el.renderRoot.getElementById('plot-top').plotHandle.raw;
                const traces = {};
                for (const s of u.series.slice(1)) {
                    if (String(s.label).startsWith('b:')) continue;
                    traces[s.label] = { width: s.width, dash: s.dash ? s.dash.map(v => v / (u.ctx.canvas.width / u.width)) : null };
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

            assert.equal(measured.chips.length, 6, 'one chip for each channel A draws');
            for (const chip of measured.chips) {
                const trace = measured.traces[chip.key];
                assert.ok(trace, `${chip.key}: the chip stands for a trace that is on the plot`);
                assert.equal(chip.width, trace.width,
                    `${chip.key}: the swatch is drawn at the trace's own stroke width`);
                assert.deepEqual(chip.dash, trace.dash?.map(v => Math.round(v * 100) / 100) ?? null,
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
            assert.ok(at5.axis.to > at0.axis.to,
                `the union axis grew to hold the slid trace (${at0.axis.to} -> ${at5.axis.to})`);
            assert.ok(at5.series['b:pressure'].to > at5.series.pressure.to,
                'and B now ends past A, which is the condition the ported test exists for');
        });

        test('the summaries take their own height, the list takes what is left', async () => {
            await page.mount(pageStage(700, 'history-data-page'), MODULES);
            await page.eval(FEED_DATA);
            await page.settle(6);
            const read = await page.eval(READ_DATA);

            const tracks = read.tracks.trim().split(/\s+/).map(parseFloat);
            const stacked = read.columns === 1;
            assert.equal(tracks.length, stacked ? 3 : 2,
                stacked ? 'stacked: A, B, then the list' : 'side by side: the pair, then the list');

            near(tracks[0], read.phaseA.h, 'track 1 is shot A\'s section');
            if (stacked) near(tracks[1], read.phaseB.h, 'track 2 is shot B\'s section');

            /* NEITHER SUMMARY IS SQUEEZED. They hold the same table, so a difference in
             * height is one of them paying for the layout — which is the defect above. */
            near(read.phaseA.h, read.phaseB.h,
                'A and B are the same section and must come out the same height', 1);
            assert.ok(read.phaseA.h > read.tableA.h,
                'and the section is the table plus its caption');

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

            await page.setStyle('#stage', { 'inline-size': '1200px' });
            await page.settle(4);
            const wider = await page.eval(READ_DATA);
            const widerTracks = wider.listColumns.trim().split(/\s+/).map(parseFloat);
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
                const summaries = tracks.slice(0, -1).reduce((a, b) => a + b, 0);
                return {
                    have: +pg.getBoundingClientRect().height.toFixed(2),
                    stacked: cs.gridTemplateColumns.trim().split(/\s+/).length === 1,
                    tracks: tracks.map((t) => +t.toFixed(2)),
                    need: +(summaries + (tracks.length - 1) * gap + floor).toFixed(2),
                    listBox: +list.getBoundingClientRect().height.toFixed(2),
                    listOverflow: frame.scrollHeight - frame.clientHeight,
                    docScroll: +(root.scrollHeight - root.clientHeight).toFixed(2),
                    docScrollHeight: root.scrollHeight,
                    bodyScrollHeight: document.body.scrollHeight,
                    regionClips: getComputedStyle(
                        document.querySelector('history-screen').renderRoot.getElementById('page'),
                    ).overflowY,
                    pageClips: cs.overflowY,
                };
            });

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

            assert.equal(measured.regionClips, 'visible', 'the mount region does not clip');
            assert.equal(measured.pageClips, 'visible', 'and neither does the page');

            if (measured.need > measured.have) {
                near(measured.docScroll, measured.need - measured.have,
                    'the document scroll is exactly the shortfall, so every row is reachable', 1.5);
                assert.ok(measured.docScroll > 0, 'and it really does scroll');
            } else {
                assert.equal(measured.docScroll, 0, 'with room to spare nothing scrolls');
            }

            assert.ok(measured.listOverflow > 1000,
                `the shot list really is holding rows out of sight (${measured.listOverflow}px)`);
            assert.equal(measured.docScrollHeight, measured.bodyScrollHeight,
                'and nothing reaches the viewport past body: everything that scrolls is in flow');
        });

        test('the compare bar shows on the flow page and is absent on the data page', async () => {
            await page.mount(screenStage(), MODULES);
            await page.settle(6);
            await page.evalFn(async (a, b) => {
                const screen = document.querySelector('history-screen');
                screen.comparing = true;
                screen.shotA = a;
                screen.shotB = b;
                await screen.updateComplete;
            }, 'shot-a', 'shot-b');
            await page.settle(2);

            const onFlow = await page.box('history-screen >>> #compare');
            assert.ok(onFlow.height > 0, 'the flow page has a time axis, so the bar is there');
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
                + 'the carve-out still holds everywhere except the one named surface');
        });

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
                    `history-shotdata: every cell of this column carries one ink, and `
                    + `the ${key} column's is ${colour}`);
            }
        });
    });
}
