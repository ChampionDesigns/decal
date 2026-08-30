/**
 * history-power.render.test.mjs — the History POWER PAGE, in a real engine at both Gate A
 * geometries. Fix run 6: Ben's reversal of D1 for this one surface, Q16's correspondence
 * marks, H2 retired FIXED rather than deferred, and the first consumers of
 * `--ui-timekey-w` / `--ui-timekey-strip-w`.
 *
 * WHAT ONLY A BROWSER CAN SAY, and it is why the DOM-free half is a separate suite
 * (`test/history-power.test.mjs` owns the points, the marks and the axes as arithmetic):
 *
 *   - THERE IS NO SECOND AXIS, AND THE ONE AXIS IS A LOG AXIS. Slate's defect was that
 *     Power was DRAWN on an axis nobody could see (`history-viewer.js:56-59` — "uplot-plot
 *     builds a y2 only if the spec asks for one and neither chart factory accepts one, so
 *     Power drew on an invisible auto-ranged axis"). This page's first answer was to build
 *     that right-hand axis for real, and Ben overruled it on 25 August 2026: "Power will be
 *     on the Pressure/Flow chart, not on the resistance / impedance chart. No second axis
 *     on these charts." So W moved to the flow page, R and Z became a matched pair, and the
 *     pair went onto ONE LOG axis — which `uplot-plot.js` has no scale type for, so it is
 *     the data in log10 against a range in log10 with the ticks formatted back. Only a
 *     rendered plot can say whether all three halves of that arrived together: the scale
 *     the traces are on, the numbers the range is in, and the text on the ticks.
 *   - THE TRAJECTORY IS DRAWN AT ALL. Its x is FLOW, which is non-monotonic, so it is not
 *     a uPlot series and no spec assertion can stand in for the canvas having a path on it.
 *   - THE TIME KEY CONSUMES ITS TOKENS. A token with no consumer and a token whose
 *     consumer ignores it are indistinguishable in source; the drill moves the value and
 *     reads the box back.
 *   - AND THE PAGE FITS. H1's branch is a container query on a height, and 436 is a number
 *     this file CHECKS against two measured card floors rather than trusts.
 *
 * A8: nothing here opens a file. Every assertion is a computed style, a rendered box, an
 * accessibility node, or a live uPlot/plot-handle object read off the running page.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { assertFocusUnclipped, assertTokenDrill } from '../harness/assertions.js';
import { accessibleNames } from '../harness/editor.js';
import {
    DERIVED_CHANNELS, DERIVED_LOG_CEIL, DERIVED_LOG_FLOOR, DERIVED_LOG_PAD,
    PQ_FLOW_MAX, PQ_PRESSURE_MAX,
} from '../../src/lib/history-power.js';

/**
 * What the page module exports, read OUT OF THE PAGE rather than retyped.
 *
 * IT USED TO READ `POWER_SINGLE_PLOT_PX`, the height at which the single-plot branch took
 * over. Ben retired the branch and its "Which plot" select on 30 August 2026 (F-036), so
 * the constant is gone and this reports the export LIST instead — which lets the suite
 * ASSERT the retirement rather than merely stop mentioning it.
 */
const authored = async (page) => JSON.parse(await page.eval(
    "import('/src/screens/history-power-page.js').then((m) => JSON.stringify("
    + '{ exports: Object.keys(m).sort(), plots: m.POWER_PLOTS.map((p) => p.id) }))',
));

const MODULES = [
    '/src/screens/history-screen.js',
    '/src/screens/history-power-page.js',
];

/** The same-profile pair the flow page's suite uses, for the same reason. */
const SHOT_A = '/tools/rea-fixtures/api__v1__shots__5fc3f631-6b18-471b-9800-00d552dbbecb.json';
const SHOT_B = '/tools/rea-fixtures/api__v1__shots__d5139a1f-c4ee-47e2-bb80-0cbf3e39b6a3.json';

const near = (got, want, what, tol = 0.6) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: ${got} is not within ${tol} of ${want}`,
);

/** The mount region's own box, with a stated height so the ladder can be exact. */
const pageStage = (h) => `
<div id="stage" style="inline-size: 900px; block-size: ${h}px; display: grid;
     grid-template-rows: minmax(0,1fr); grid-template-columns: minmax(0,1fr)">
  <history-power-page id="page-under-test"></history-power-page>
</div>`;

/** The real screen with all three real pages, as §4.5 draws it. */
const screenStage = () => `
<div id="stage" style="inline-size: 100%; block-size: 100dvh">
  <history-screen>
    <history-power-page slot="page" data-page="power"></history-power-page>
  </history-screen>
</div>`;

/**
 * Feed the page two real recorded shots — WITH the derived channels ReaPrime recomputes
 * on read, because the recordings predate the getters (see the route fixture's docblock
 * and `tools/mock-fixture-ledger.json`'s `upgraded` section). Nothing under `src/`
 * computes any of the three; this is the SERVER's arithmetic, applied where a server
 * would apply it.
 */
const FEED = (offset = 0, { second = true } = {}) => `(async () => {
  const { deriveFromRecord } = await import('/src/lib/shot-derivation.js');
  const gate = (p, f, v) => ((f >= 0.3 && p >= 0.3 && Number.isFinite(v)) ? v : null);
  const upgrade = (record) => ({ ...record, measurements: record.measurements.map((m) => {
    const machine = m.machine; const p = machine && machine.pressure; const f = machine && machine.flow;
    if (typeof p !== 'number' || typeof f !== 'number') return m;
    const next = { ...machine };
    const R = gate(p, f, p / (f * f)); const Z = gate(p, f, p / f); const W = gate(p, f, 0.1 * p * f);
    if (R !== null) next.puckResistanceDerived = R;
    if (Z !== null) next.loadImpedanceDerived = Z;
    if (W !== null) next.hydraulicPowerDerived = W;
    return { ...m, machine: next };
  }) });
  const [a, b] = await Promise.all([
    fetch('${SHOT_A}').then((r) => r.json()),
    fetch('${SHOT_B}').then((r) => r.json()),
  ]);
  const page = document.querySelector('history-power-page');
  page.derivationA = deriveFromRecord(upgrade(a));
  page.derivationB = ${second} ? deriveFromRecord(upgrade(b)) : null;
  page.offset = ${offset};
  await page.updateComplete;
  const cards = [...page.renderRoot.querySelectorAll('ui-chart-card')];
  await Promise.all(cards.map((c) => c.ready));
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
  return {
    ok: page.derivationA.ok,
    sources: page.derivationA.sources,
    built: cards.map((c) => c.buildCount),
  };
})()`;

/** The same feed, with a derivation the server served NO derived channel for. */
const FEED_RAW = `(async () => {
  const { deriveFromRecord } = await import('/src/lib/shot-derivation.js');
  const a = await fetch('${SHOT_A}').then((r) => r.json());
  const page = document.querySelector('history-power-page');
  page.derivationA = deriveFromRecord(a);
  page.derivationB = null;
  await page.updateComplete;
  const cards = [...page.renderRoot.querySelectorAll('ui-chart-card')];
  await Promise.all(cards.map((c) => c.ready));
  await new Promise((r) => requestAnimationFrame(r));
  return { sources: page.derivationA.sources };
})()`;

/** Every measurement the layout ladder needs, in one round trip. */
const READ_LAYOUT = `(() => {
  const page = document.querySelector('history-power-page');
  const root = page.renderRoot;
  const box = (el) => { const b = el.getBoundingClientRect(); return { h: +b.height.toFixed(3), w: +b.width.toFixed(3), x: +b.x.toFixed(3), y: +b.y.toFixed(3) }; };
  const cs = (el) => getComputedStyle(el);
  const grid = root.getElementById('grid');
  const derived = root.getElementById('plot-derived');
  const pq = root.getElementById('plot-pq');
  const row = root.getElementById('trajectory');
  const key = root.getElementById('timekey');
  const scrolls = (el) => el.scrollHeight - el.clientHeight > 0.5;
  return {
    host: box(page), grid: box(grid),
    tracks: cs(grid).gridTemplateRows,
    derived: box(derived), pq: box(pq), row: box(row), key: box(key),
    shown: {
      derived: cs(derived).display !== 'none',
      trajectory: cs(row).display !== 'none',
    },
    pickerComposed: root.getElementById('picker') !== null,
    selects: root.querySelectorAll('ui-select').length,
    clips: { grid: cs(grid).overflowY, host: cs(page).overflowY },
    floors: {
      derived: parseFloat(cs(derived).minBlockSize),
      pq: parseFloat(cs(pq).minBlockSize),
    },
    keyWidth: cs(key).inlineSize,
    gap: cs(grid).rowGap,
    scrolls: scrolls(page) || scrolls(derived) || scrolls(pq),
    per: { page: +(page.scrollHeight - page.clientHeight).toFixed(2), derived: +(derived.scrollHeight - derived.clientHeight).toFixed(2), pq: +(pq.scrollHeight - pq.clientHeight).toFixed(2) },
    gridOverflow: { h: +(grid.scrollHeight - grid.clientHeight).toFixed(2), w: +(grid.scrollWidth - grid.clientWidth).toFixed(2) },
    legend: (() => { const l = derived.querySelector('ui-chart-legend'); const b = l.getBoundingClientRect(); return { h: +b.height.toFixed(2), w: +b.width.toFixed(2) }; })(),
    hostOverflow: +(page.scrollHeight - page.clientHeight).toFixed(2),
  };
})()`;

/** The derived plot's live series and scales — what the canvas is actually drawing. */
const READ_DERIVED = `(() => {
  const card = document.querySelector('history-power-page').renderRoot.getElementById('plot-derived');
  const u = card.plotHandle.raw;
  const holes = (i) => (u.data[i] ?? []).reduce((n, v) => n + (v === null || v === undefined ? 1 : 0), 0);
  const span = (i) => {
    let lo = null; let hi = null;
    for (const v of (u.data[i] ?? [])) {
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      if (lo === null || v < lo) lo = v;
      if (hi === null || v > hi) hi = v;
    }
    return [lo, hi];
  };
  return {
    series: u.series.slice(1).map((s, i) => ({
      label: s.label,
      scale: s.scale,
      dash: s.dash ? [...s.dash] : null,
      alpha: s.alpha,
      width: s.width,
      stroke: typeof s.stroke === 'function' ? s.stroke(u, i + 1) : s.stroke,
      holes: holes(i + 1),
      points: (u.data[i + 1] ?? []).length,
      /* THE TRACE'S OWN EXTENT, in the units it is PLOTTED in. On this page that is
       * log10, and it is read here rather than recomputed in node because the whole
       * question the log assertions ask is whether the data and the range are in the
       * same units — a test that transformed the data itself could not see them part. */
      lo: span(i + 1)[0], hi: span(i + 1)[1],
    })),
    scales: Object.fromEntries(Object.entries(u.scales).map(([k, v]) => [k, [v.min, v.max]])),
    axes: u.axes.map((a) => ({ scale: a.scale, side: a.side, show: a.show, size: a._size ?? null })),
    splits: u.axes.map((a) => (a._splits ? [...a._splits] : null)),
    /* WHAT IS ACTUALLY PRINTED BESIDE THE TICKS. uPlot's own values() for the axis,
     * called on the splits it laid out — the other half of a log axis built out of a
     * linear scale, and the half a range assertion cannot see. */
    tickText: u.axes.map((a) => (a._splits ? a.values(u, [...a._splits], 0, 0, 0) : null)),
  };
})()`;

/** The trajectory plot's frame, its paths and its marks. */
const READ_PQ = `(() => {
  const card = document.querySelector('history-power-page').renderRoot.getElementById('plot-pq');
  const u = card.plotHandle.raw;
  const state = card.plotHandle.state;
  const real = (b) => b.points.filter((p) => p.x !== null).length;
  return {
    scales: Object.fromEntries(Object.entries(u.scales).map(([k, v]) => [k, [v.min, v.max]])),
    seriesCount: u.series.length - 1,
    seriesData: (u.data[1] ?? []).length,
    bands: state.bands.map((b) => ({
      n: real(b), dash: b.dash ? [...b.dash] : null, alpha: b.alpha ?? null,
      first: b.points.find((p) => p.x !== null) ?? null,
      colourFirst: b.colorAt(b.points.find((p) => p.x !== null)?.t ?? 0),
      colourLast: b.colorAt(b.points.filter((p) => p.x !== null).slice(-1)[0]?.t ?? 0),
    })),
    marks: state.marks.map((m) => ({ x: m.x, y: m.y, kind: m.kind, text: m.text ?? null, color: m.color })),
    empty: card.empty,
  };
})()`;

/** Every custom-element tag the page renders into its own shadow root. */
const TAGS = `(() => {
  const page = document.querySelector('history-power-page');
  return [...new Set([...page.renderRoot.querySelectorAll('*')]
    .map((el) => el.tagName.toLowerCase())
    .filter((name) => name.includes('-')))].sort();
})()`;

/** This page's slice of the 57-item inventory. A tag outside it is scope invention. */
const INVENTORY = ['ui-chart-card', 'ui-chart-legend', 'ui-empty-state', 'ui-select', 'ui-time-key'];

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`History power page @ ${geometry.name}`, () => {
        let browser;
        let page;

        before(async () => {
            browser = await launch({ geometry });
            page = await browser.newPage({ geometry });
        });
        after(async () => { await browser?.close(); });

        /** Mount the page alone at a stated height and feed it. */
        const fed = async (h, offset = 0, feed = null) => {
            await page.mount(pageStage(h), MODULES);
            await page.settle(4);
            const result = await page.eval(feed ?? FEED(offset));
            await page.settle(4);
            return result;
        };

        /* ===================================================================
         * 1. ONE AXIS, AND IT IS A LOG AXIS — Ben's 25 August 2026 reversal
         * =================================================================== */

        /**
         * THIS TEST USED TO ASSERT THE OPPOSITE, AND IT WAS RIGHT TO, ONCE.
         *
         * The page's first answer to Slate's defect was to build the right-hand axis Slate
         * had declared a scale for and never drawn, put W on it and range it 0-15 W. That
         * fixed a real thing: a number on screen with no scale beside it. Ben overruled the
         * SIDE of the page it was fixed on, 25 August 2026: "Power will be on the
         * Pressure/Flow chart, not on the resistance / impedance chart. No second axis on
         * these charts." `POWER_AXIS_MAX` was deleted from `chart-autoscale.js` in the same
         * commit, which is why the stale form of this suite could not even be imported.
         *
         * SO THE CLAIM INVERTS AND GETS SHARPER. "No y2" is not a claim a page can make by
         * omission — `<ui-chart-card>` rebuilds its plot when `y2` MOVES, and a page that
         * simply stopped assigning would keep the axis it drew last, which is why
         * `history-power-page.js` sets it to null out loud. The three things asserted below
         * are that there is no y2 SCALE (Slate had exactly that and no axis), no y2 AXIS,
         * and no power TRACE anywhere on this canvas.
         *
         * AND THE AXIS THAT IS LEFT IS A LOG AXIS BUILT OUT OF A LINEAR ONE, because
         * `uplot-plot.js` builds linear scales only. That mechanism has three halves and
         * they can part silently: the DATA in log10, the RANGE in log10 units, and the TICK
         * TEXT back in real numbers. Two of the three would draw a chart that looks
         * plausible and is a decade wrong, so all three are read off the running plot.
         *
         *   MEASURED on the same-profile pair, both Gate A geometries, identical at each:
         *     scale keys      x, y        — there is no y2 at all
         *     y range         -1.30103 to -0.42651 in log10 units = 0.05 to 0.3745
         *     y splits        -1.30103, -1, -0.69897
         *     tick text       "0.05", "0.10", "0.20"
         *     series          resistance, impedance, b:resistance, b:impedance
         */
        test('there is no second axis: R and Z share ONE log axis and W is not on this chart', async () => {
            await fed(700);
            const plot = await page.eval(READ_DERIVED);

            assert.ok(!('y2' in plot.scales),
                `no y2 SCALE — Slate's defect was a scale with no axis (${Object.keys(plot.scales)})`);
            assert.equal(plot.axes.filter((a) => a.scale === 'y2').length, 0,
                'and no y2 axis either');
            assert.ok(!plot.series.some((s) => /power/i.test(s.label)),
                `and no power trace: W is on the flow page now (${plot.series.map((s) => s.label)})`);

            const y = plot.axes.find((a) => a.scale === 'y');
            assert.ok(y, 'the one value axis exists');
            assert.equal(y.side, 3, 'and it is the LEFT-hand side');
            assert.notEqual(y.show, false, 'and it is shown, not built and hidden');

            /* EVERY TRACE IS ON IT, A's AND B's ALIKE. Two ratios of the same kind on one
             * axis is the whole of the reversal; a channel quietly left on another scale
             * would be the second axis arriving under a different name. */
            assert.deepEqual(plot.series.map((s) => s.label),
                [...DERIVED_CHANNELS, ...DERIVED_CHANNELS.map((k) => `b:${k}`)],
                'R and Z, then B\'s R and Z, in draw order');
            for (const s of plot.series) assert.equal(s.scale, 'y', `${s.label} is on the one axis`);

            /* THE TICKS ARE LAID OUT AND THEY ARE PRINTED AS REAL NUMBERS. `formatLogTick`
             * is what turns -1 into "0.10"; a split list with the log10 numbers still on it
             * is the failure this half exists to catch. */
            const splits = plot.splits[plot.axes.indexOf(y)];
            const text = plot.tickText[plot.axes.indexOf(y)];
            assert.ok(Array.isArray(splits) && splits.length >= 2,
                `the axis laid out ticks (${JSON.stringify(splits)})`);
            assert.deepEqual(text.map(Number).map((v) => +v.toFixed(6)),
                splits.map((v) => +(10 ** v).toFixed(6)),
                `each tick is printed as its real number, not its log10 (${JSON.stringify(text)})`);
            for (const v of splits) {
                assert.ok(v >= plot.scales.y[0] - 1e-9 && v <= plot.scales.y[1] + 1e-9,
                    `tick ${v} is inside the range — a log range narrower than a decade can `
                    + 'put every decade tick outside it, which draws an axis with no labels');
            }
        });

        /**
         * THE RANGE IS THE RATIOS' OWN, AND NOTHING ELSE CAN MOVE IT.
         *
         * The old form of this test asserted `0 <= y <= 1` and that W, which peaks above the
         * ratios, was on the other axis. Half of that claim no longer has an other axis to
         * point at and the other half was a LINEAR bound — the axis is in log10 units now,
         * where 0 means 1 and the old `lo === 0` would have been the range starting at a
         * resistance of 1.
         *
         * WHAT SURVIVES IS THE POINT OF IT: this axis is framed by the two channels drawn on
         * it and by Slate's own two bounds, and by nothing else. `derivedLeftRange` hugs the
         * data by DERIVED_LOG_PAD either side and clamps to DERIVED_LOG_FLOOR / _CEIL, from
         * BOTH shots at once so the pair share one frame. All three of those are measured
         * here against the traces the canvas is actually holding.
         *
         *   MEASURED: B's impedance is the highest sample at log10 -0.67653 (0.2106), and
         *   the range's top is -0.42651 — exactly that plus the 0.25 pad. The lowest sample
         *   is B's resistance at -2.40632 (0.0039), which is below Slate's 0.05 floor, so
         *   the bottom is the floor itself at -1.30103 rather than the data minus a pad.
         *   That is the floor doing its stated job, and it means this fixture's resistance
         *   trace runs below the visible axis — a property of the recording, not of the
         *   page: `derivedLeftRange` clamps on purpose so one gate-corner outlier cannot own
         *   the axis, and the clamp cuts both ways.
         */
        test('the left axis is the two ratios\' own frame, padded and clamped to Slate\'s bounds', async () => {
            await fed(700);
            const plot = await page.eval(READ_DERIVED);
            const [lo, hi] = plot.scales.y;

            /* IN LOG10 UNITS, which is the first thing that can go wrong: a range left in
             * real units against data in log10 draws every trace off the bottom. */
            assert.ok(10 ** lo >= DERIVED_LOG_FLOOR - 1e-9 && 10 ** hi <= DERIVED_LOG_CEIL + 1e-9,
                `the range is in log10 units inside Slate's ${DERIVED_LOG_FLOOR}-${DERIVED_LOG_CEIL} `
                + `frame (10^${lo.toFixed(5)} to 10^${hi.toFixed(5)})`);

            /* THE TOP IS THE HIGHEST SAMPLE PLUS THE PAD — read off the traces themselves,
             * so a channel that stopped being drawn would take its own claim with it. */
            const highest = Math.max(...plot.series.map((s) => s.hi));
            near(hi, Math.min(Math.log10(DERIVED_LOG_CEIL), highest + DERIVED_LOG_PAD),
                'the top is the highest ratio either shot reached, plus Slate\'s quarter-decade pad',
                0.001);

            /* THE BOTTOM IS THE FLOOR, and it is the floor BECAUSE the lowest sample is
             * under it. Asserted as the conditional it is, so this stays true of a pair
             * whose ratios all sit above 0.05. */
            const lowest = Math.min(...plot.series.map((s) => s.lo));
            near(lo, Math.max(Math.log10(DERIVED_LOG_FLOOR), lowest - DERIVED_LOG_PAD),
                'and the bottom is the lower of the floor and the data less the pad', 0.001);
            assert.ok(lowest < Math.log10(DERIVED_LOG_FLOOR),
                'on this pair the floor is the one that binds, which is what makes the clamp '
                + 'above a measurement rather than an arithmetic identity');

            /* AND IT IS ONE FRAME FOR BOTH SHOTS. A range computed per shot would redraw
             * the axis when the other one is picked, and two shots could not be compared. */
            const fromB = plot.series.filter((s) => s.label.startsWith('b:'));
            assert.ok(fromB.some((s) => s.hi > Math.max(
                ...plot.series.filter((s2) => !s2.label.startsWith('b:')).map((s2) => s2.hi),
            )), 'B reaches higher than A here, so the shared frame is B\'s to set');
        });

        /* ===================================================================
         * 2. THE THREE CHANNELS ARE DRAWN, WITH THEIR HOLES
         * =================================================================== */

        test('the derived traces carry the server\'s own gaps rather than a bridged line', async () => {
            const feed = await fed(700);
            assert.equal(feed.sources.resistance, 'derived');
            /* POWER IS STILL SERVED, and this line stays for that reason. The 25 August
             * reversal moved W to the flow page; it did not stop ReaPrime deriving it, and
             * a derivation that quietly lost the channel would look identical on THIS page
             * to one that has it. So the source is asserted here and the trace is not. */
            assert.equal(feed.sources.power, 'derived');
            const plot = await page.eval(READ_DERIVED);
            for (const label of DERIVED_CHANNELS) {
                const s = plot.series.find((x) => x.label === label);
                assert.ok(s.points > 0, `${label} is on the plot`);
                assert.ok(s.holes > 0,
                    `${label} has holes — ReaPrime gates at 0.3 mL/s and 0.3 bar and OMITS the key, `
                    + 'and bridgeUnspoken deliberately does not bridge an explicit null');
                assert.ok(s.holes < s.points, `${label} is not ALL holes either`);
            }
        });

        test('A/B: same hue, B dashed and faded, and on the SAME axis as A', async () => {
            await fed(700);
            const plot = await page.eval(READ_DERIVED);
            for (const key of DERIVED_CHANNELS) {
                const a = plot.series.find((s) => s.label === key);
                const b = plot.series.find((s) => s.label === `b:${key}`);
                assert.ok(b, `B's ${key} is drawn`);
                assert.equal(b.stroke, a.stroke, 'same hue — only the record key differs');
                assert.deepEqual(b.dash, [9, 9], 'B is dashed');
                assert.equal(b.alpha, 0.72, 'and faded — the fade is not dropped (chart-C7)');
                assert.equal(b.scale, a.scale,
                    'and on A\'s own axis: the same colour at two heights meaning one number '
                    + 'is exactly what a second scale must not produce');
            }
        });

        /* ===================================================================
         * 3. THE P–Q TRAJECTORY
         * =================================================================== */

        test('the trajectory\'s x is FLOW, its y is PRESSURE, and the frame holds the data', async () => {
            await fed(700);
            const pq = await page.eval(READ_PQ);
            assert.equal(pq.scales.x[0], 0);
            assert.ok(pq.scales.x[1] >= PQ_FLOW_MAX,
                'the flow frame never shrinks below Slate\'s 8');
            assert.deepEqual(pq.scales.y, [0, PQ_PRESSURE_MAX],
                'and pressure keeps Slate\'s own 0-12 on an espresso-shaped pour');
            /* THE FIXTURE PAIR REACHES 12.64 mL/s, which is exactly the case a literal
             * port of the fixed 8 would have cropped a third of both paths off. */
            assert.ok(pq.scales.x[1] > PQ_FLOW_MAX,
                `this pair runs past 8 mL/s, so the frame extended to ${pq.scales.x[1]}`);
            const inside = pq.bands.flatMap((b) => (b.first ? [b.first] : []));
            for (const p of inside) {
                assert.ok(p.x <= pq.scales.x[1] && p.y <= pq.scales.y[1],
                    `a path point (${p.x}, ${p.y}) is inside the frame`);
            }
        });

        test('the path is drawn as coloured segments, not as a series', async () => {
            await fed(700);
            const pq = await page.eval(READ_PQ);
            assert.equal(pq.seriesData, 0,
                'the plot\'s one scaffold series carries NO data: flow is non-monotonic and a '
                + 'uPlot series is drawn in index order against a sorted scale');
            const paths = pq.bands.filter((b) => b.n > 10);
            assert.equal(paths.length, 2, 'two trajectories: A and B');
            assert.equal(paths[0].dash, null, 'A is solid');
            assert.deepEqual(paths[1].dash, [9, 9], 'B is dashed');
            assert.equal(paths[1].alpha, 0.72,
                'and faded: colour is already carrying TIME here, so it cannot also say which shot');
            /* THE COLOUR IS THE TIME AXIS: the first segment and the last are different
             * ends of the ramp, and the ramp is the stylesheet's. */
            assert.notEqual(paths[0].colourFirst, paths[0].colourLast);
            assert.match(paths[0].colourFirst, /^rgb\(/);
        });

        test('Q16: the correspondence marks exist, and the alignment MOVES them', async () => {
            await fed(700, 0);
            const at0 = await page.eval(READ_PQ);
            const dots = at0.marks.filter((m) => m.kind === 'dot');
            const rings = at0.marks.filter((m) => m.kind === 'ring');
            assert.ok(dots.length > 0, 'A\'s instants are marked');
            assert.ok(rings.length > 0, 'B\'s corresponding instants are marked, hollow');
            assert.ok(dots.every((m) => /^\d+s$/.test(m.text)), 'and A\'s marks are labelled in seconds');
            assert.ok(rings.every((m) => m.text === null), 'B\'s are not labelled twice');

            await fed(700, 3);
            const at3 = await page.eval(READ_PQ);
            assert.deepEqual(at3.marks.filter((m) => m.kind === 'dot').map((m) => [m.x, m.y]),
                dots.map((m) => [m.x, m.y]), 'A does not move: it is the reference');
            assert.notDeepEqual(at3.marks.filter((m) => m.kind === 'ring').map((m) => [m.x, m.y]),
                rings.map((m) => [m.x, m.y]),
                'B\'s ends walk along B\'s path — "when A was 12 seconds in, where was B?"');
            const links = at3.bands.filter((b) => b.n === 2);
            assert.ok(links.length > 0, 'and each pair is joined by a link');
        });

        /* ===================================================================
         * 4. THE #11 TIME KEY — H2, chart-C14, and two orphaned tokens
         * =================================================================== */

        test('the key is an ANNOUNCED axis, not an aria-hidden decoration', async () => {
            await fed(700);
            const names = await accessibleNames(page);
            assert.ok(names.some((n) => n.role === 'group' && /Time key/i.test(n.name)),
                'chart-C14: Slate\'s gradient key was aria-hidden while being the trajectory\'s '
                + 'ONLY axis legend — here it is a group with a name');
            const read = await page.evalFn(() => {
                const key = document.querySelector('history-power-page').renderRoot.getElementById('timekey');
                const strip = key.shadowRoot.querySelector('.strip');
                return {
                    top: key.shadowRoot.querySelector('[part="value-top"]').textContent.trim(),
                    bottom: key.shadowRoot.querySelector('[part="value-bottom"]').textContent.trim(),
                    caption: key.shadowRoot.querySelector('[part="caption"]').textContent.trim(),
                    stripHidden: strip.getAttribute('aria-hidden'),
                    gradient: getComputedStyle(strip).backgroundImage,
                    stripW: getComputedStyle(strip).inlineSize,
                    keyW: getComputedStyle(key).inlineSize,
                };
            });
            assert.equal(read.bottom, '0', 'the bottom of the strip is zero seconds');
            assert.ok(Number(read.top) > 0, `the top is the end of the shot (${read.top})`);
            assert.equal(read.caption, 'seconds');
            assert.equal(read.stripHidden, 'true', 'the STRIP is the decoration; the numbers are the name');
            assert.match(read.gradient, /linear-gradient/);
            assert.equal((read.gradient.match(/rgb\(/g) ?? []).length, 10,
                'ten stops, the ramp\'s own count, and every one of them a CSS value (A6)');
        });

        test('--ui-timekey-w and --ui-timekey-strip-w get their first consumers', async () => {
            await fed(700);
            const KEY = 'history-power-page >>> #timekey';
            await assertTokenDrill(page, {
                token: '--ui-timekey-w', value: '37px', selector: KEY, property: 'inline-size',
            });
            await assertTokenDrill(page, {
                token: '--ui-timekey-strip-w',
                value: '37px',
                selector: `${KEY} >>> .strip`,
                property: 'inline-size',
            });
        });

        /* ===================================================================
         * 5. A6 — THE RAMP IS THE STYLESHEET'S, AND THE PATH READS THE SAME ONE
         * =================================================================== */

        test('the strip and the path are painted from the same ten declared stops', async () => {
            await fed(700);
            const both = await page.evalFn(() => {
                const pageEl = document.querySelector('history-power-page');
                const key = pageEl.renderRoot.getElementById('timekey');
                const card = pageEl.renderRoot.getElementById('plot-pq');
                const stops = [];
                for (let i = 0; i < 10; i += 1) {
                    stops.push(getComputedStyle(pageEl).getPropertyValue(`--ui-timekey-stop-${i}`).trim());
                }
                const gradient = getComputedStyle(key.shadowRoot.querySelector('.strip')).backgroundImage;
                const band = card.plotHandle.state.bands.find((b) => b.points.length > 10);
                const pts = band.points.filter((p) => p.x !== null);
                return {
                    stops,
                    gradient,
                    ends: [band.colorAt(pts[0].t), band.colorAt(pts[pts.length - 1].t)],
                };
            });
            assert.equal(both.stops.length, 10);
            assert.ok(both.stops.every((s) => /^#|^rgb/.test(s)), 'every stop resolves to a colour');
            /* The strip's first stop and the path's first colour are the same declared
             * value, read two ways: a gradient in CSS, a blend in the canvas. */
            const first = both.stops[0].replace(/^#(\w\w)(\w\w)(\w\w)$/, (_, r, g, b) => `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)})`);
            assert.equal(both.ends[0], first, 'the path starts on stop 0');
            assert.ok(both.gradient.includes(first), 'and so does the strip');
        });

        /* ===================================================================
         * 6. THE LAYOUT — H1's ratio tracks and its branch
         * =================================================================== */

        test('the page fills the mount region and never scrolls', async () => {
            await fed(700);
            const read = await page.eval(READ_LAYOUT);
            near(read.host.h, 700, 'the page is the region tall');
            near(read.grid.h, 700, 'and hands the cell straight on');
            assert.deepEqual({ derived: read.per.derived, pq: read.per.pq }, { derived: 0, pq: 0 },
                'NEITHER PLOT SCROLLS. They RESIZE (H1), and below two usable plots the page '
                + 'switches branch — a scrollbar on a chart card would be the third state §4.5 '
                + 'refuses. This is the assertion the whole ratio-track design is for.');
            /* THE PAGE'S OWN SCROLL BOX IS ~1px TALLER THAN ITS CONTENT BOX, and that is
             * #10's HIT OVERLAY rather than this page: `hitArea`'s overlay mode expands a
             * chip's target with a pseudo-element OUTSIDE the chip, so it adds to every
             * ancestor's scroll size — on the flow page too, which is why that suite reads
             * the cards rather than the grid. Bounded rather than asserted away: a real
             * layout overflow would be an order larger than an overlay's inset. */
            assert.ok(read.hostOverflow <= 4 && read.gridOverflow.w <= 8,
                `the only overflow is #10's hit overlay (host ${read.hostOverflow}, `
                + `grid ${JSON.stringify(read.gridOverflow)})`);
            assert.equal(read.legend.h, 44,
                'and the key is ONE chip row: a wrapped legend takes its height out of the plot');
        });

        test('the two cards have DIFFERENT floors, and both are the card\'s own', async () => {
            await fed(700);
            const read = await page.eval(READ_LAYOUT);
            /* THIS IS WHAT SURVIVES OF THE THRESHOLD TEST. It read:
             *
             *     assert.equal(threshold, read.floors.derived + read.floors.pq + gap,
             *         `POWER_SINGLE_PLOT_PX (${threshold}) must equal the derived card's
             *          floor … plus the trajectory card's … plus the gap`);
             *
             * — a derivation check on the constant that placed `@container (block-size <
             * 468px)`. The branch is retired (F-036) and so is the constant; what the page
             * still leans on is the two floors themselves, which are what decide when #grid
             * starts to scroll. */
            assert.notEqual(read.floors.derived, read.floors.pq,
                'the derived card carries a legend row and the trajectory card does not, so '
                + 'their floors differ — which is why this page never shared the flow page\'s '
                + 'arithmetic');
            assert.ok(read.floors.derived > read.floors.pq,
                `the card WITH a legend has the taller floor (${read.floors.derived} vs ${read.floors.pq})`);
        });

        test('F-036 — the "Which plot" select is gone from the composed tree', async () => {
            await fed(700);
            const read = await page.eval(READ_LAYOUT);
            /* BEN, 30 AUGUST 2026: "Remove them for good." Wave 3 measured this page's
             * picker at `display: none`, box 0x0, unfocusable, at all five viewports —
             * while BOTH power cards painted side by side (F-036, unit L0227). The claim
             * here is COMPOSED, not painted: a `display: none` assertion would have passed
             * against the old tree too. */
            assert.equal(read.pickerComposed, false, '#picker is still in the tree');
            assert.equal(read.selects, 0, 'a ui-select is still composed on this page');
            assert.equal(
                await page.evalFn(() => document.querySelector('history-power-page').hasAttribute('plot')),
                false, 'the reflected `plot` property is retired with the branch it selected');

            const { exports } = await authored(page);
            assert.ok(!exports.includes('POWER_SINGLE_PLOT_PX'),
                `the retired threshold is exported again: ${exports.join(', ')}`);
        });

        test('both plots show, and the RATIO is what decides', async () => {
            await fed(700);
            const read = await page.eval(READ_LAYOUT);
            assert.deepEqual(read.shown, { derived: true, trajectory: true });
            const gap = parseFloat(read.gap);
            const usable = read.grid.h - gap;
            near(read.derived.h, usable / 2.4, 'the derived card is 1fr of 1fr + 1.4fr');
            near(read.row.h, (usable / 2.4) * 1.4, 'and the trajectory row is 1.4fr');
            assert.ok(read.derived.h > read.floors.derived,
                'the ratio decides rather than the floor — at 1 : 1.8 the floor would win '
                + 'and the declared track list would be one the layout never honours (H1)');
        });

        test('F-036 — a short region keeps BOTH cards and spills, rather than hiding one',
            async () => {
                /* THE TEST THAT STOOD HERE was 'below the threshold the page shows ONE plot
                 * and a selector', and its central assertion was
                 *
                 *     assert.deepEqual(read.shown,
                 *         { derived: true, trajectory: false, picker: true },
                 *         'the default plot and the selector, rather than two unusable strips');
                 *
                 * followed by setting `el.plot = 'trajectory'` and asserting the two cards
                 * swapped boxes. That is the layout Ben removed for good. The answer for a
                 * region too short for both floors is this tree's standing §2.4 rule —
                 * "nothing clips silently": no box in the chain declares an overflow, so
                 * the shortfall travels outward to the document rather than putting a card
                 * behind a fold. (A scroll container on #grid was tried and measured worse:
                 * `overflow-y: auto` forces overflow-x to auto, #10's legend hit overlay
                 * overhangs by 8px, and the horizontal scrollbar took 15px off the block
                 * axis and broke the ratio ladder above.)
                 *
                 * THE E12 CLAIM IS CARRIED ACROSS, because it is the one thing in the old
                 * test that was not about the branch: a surface with no box does not rebuild,
                 * so the trajectory canvas has to be populated wherever it has a box. Here it
                 * always has one, which is a stronger version of the same statement. */
                await fed(700);
                const roomy = await page.eval(READ_LAYOUT);
                /* <= 4, NOT 0, and the tolerance is this suite's own: #10's legend hit
                 * overlay overhangs the grid by a pixel or two at every height, which the
                 * layout test above states in the same words. */
                assert.ok(roomy.hostOverflow <= 4,
                    `at a height that fits, nothing but the hit overlay overflows (${roomy.hostOverflow})`);

                const tight = roomy.floors.derived + roomy.floors.pq - 40;
                await fed(tight);
                const read = await page.eval(READ_LAYOUT);
                assert.deepEqual(read.shown, { derived: true, trajectory: true },
                    'both cards keep painting — neither is put away');
                assert.equal(read.clips.grid, 'visible', 'the grid does not clip');
                assert.equal(read.clips.host, 'visible', 'and neither does the page');
                /* AND NEITHER CARD IS SHRUNK BELOW ITS OWN FLOOR TO BUY THE FIT. The
                 * derived card takes its 254; #trajectory is a flex row with
                 * `min-block-size: 0`, so the GRID squeezes the row and the card inside it
                 * keeps its own 202 and overhangs — visibly, into a page that clips
                 * nothing, which is the whole difference from putting a card behind a
                 * fold. */
                assert.ok(read.derived.h >= read.floors.derived - 0.6,
                    `the derived card keeps its floor (${read.derived.h})`);
                assert.ok(read.pq.h >= read.floors.pq - 0.6,
                    `and so does the trajectory card (${read.pq.h})`);
                assert.ok(read.pq.h > read.row.h + 0.5,
                    `which means it overhangs its squeezed row (${read.pq.h} in ${read.row.h})`);

                /* WHAT IS NOT ASSERTED HERE, AND IT IS RECORDED RATHER THAN HIDDEN. At this
                 * height the derived card reports ~11px of its own internal scroll at its
                 * floor, and the trajectory card overhangs its row by ~52. Both are
                 * properties of the cards at and below their floors, not of this removal:
                 * the old suite never measured them because at this height the page used to
                 * switch to the one-plot branch, where the chosen card had a whole track to
                 * itself. Neither is reachable in the shipped app — `app-fit.js` never
                 * yields a design height under 1200, so this region is never shorter than
                 * 591 — and they belong to whoever next looks at the floor arithmetic. The
                 * ratio test above pins the honest behaviour at every height the page
                 * really gets. */

                const pq = await page.eval(READ_PQ);
                assert.ok(pq.bands.filter((b) => b.n > 10).length === 2,
                    'both trajectories are on the canvas at the short height too');
                assert.ok(pq.marks.length > 0, 'and so are the correspondence marks');
            });

        test('the key sits BESIDE the plot and is the row\'s own height', async () => {
            await fed(700);
            const read = await page.eval(READ_LAYOUT);
            assert.ok(read.key.x > read.pq.x + read.pq.w - 1,
                'the key is to the right of the plot, not inside its plotting area');
            near(read.key.h, read.row.h, 'and it stretches to the row: no px height anywhere');
            near(read.key.h, read.pq.h, 'the same height as the chart it is the axis for');
            near(read.key.x + read.key.w, read.row.x + read.row.w, 'and it ends where the row does');
        });

        /* ===================================================================
         * 7. THE HONEST ABSENCE (#38)
         * =================================================================== */

        test('a shot the server served no derived channel for SAYS SO', async () => {
            const feed = await fed(700, 0, FEED_RAW);
            assert.equal(feed.sources.power, 'none', 'the derivation reports no source (A7)');
            const state = await page.evalFn(() => {
                const el = document.querySelector('history-power-page');
                const derived = el.renderRoot.getElementById('plot-derived');
                const empty = el.querySelector('ui-empty-state') ?? derived.querySelector('ui-empty-state');
                return {
                    empty: derived.empty,
                    heading: empty ? empty.getAttribute('heading') : null,
                    body: empty ? empty.getAttribute('body') : null,
                    pqEmpty: el.renderRoot.getElementById('plot-pq').empty,
                };
            });
            assert.equal(state.empty, true, 'the card reflects empty, so the refusal has somewhere to be');
            assert.match(state.heading, /No derived channels/i,
                'and it is its OWN sentence, not "no shot selected" and not a blank chart');
            assert.match(state.body, /0\.3 mL\/s and 0\.3 bar/,
                'naming ReaPrime\'s own gate, so a reader knows the silence is the server being honest');
            assert.equal(state.pqEmpty, false,
                'the trajectory still draws: pressure and flow are not derived channels');
        });

        test('no shot at all is a different sentence again', async () => {
            await page.mount(pageStage(700), MODULES);
            await page.settle(4);
            const headings = await page.evalFn(() => [...document.querySelector('history-power-page')
                .renderRoot.querySelectorAll('ui-empty-state')].map((e) => e.getAttribute('heading')));
            assert.equal(headings.length, 2, 'both cards refuse');
            assert.ok(headings.every((h) => /No shot selected/i.test(h)));
        });

        /* ===================================================================
         * 8. THE STANDING CLASSES, AND THE PAGE IN ITS SCREEN
         * =================================================================== */

        test('focus rings are unclipped on every control the page owns', async () => {
            /* THE FIRST HALF OF THIS TEST WENT WITH THE SELECT (F-036). It read:
             *
             *     await fed(threshold - 40);
             *     await assertFocusUnclipped(page, 'history-power-page >>> #picker >>> #control');
             *
             * — staged the one-plot branch and focused the native select #7 renders inside
             * its own shadow root. There is no such control on this page any more, and the
             * legend chip below is now the only control the page owns. */
            await fed(700);
            await assertFocusUnclipped(page,
                'history-power-page >>> ui-chart-legend >>> [part="item"]');
        });

        test('the legend is the CHANNEL TOGGLE, and it drives this page\'s plot', async () => {
            await fed(700);
            const toggled = await page.evalFn(() => {
                const el = document.querySelector('history-power-page');
                const legend = el.renderRoot.querySelector('ui-chart-legend');
                const card = el.renderRoot.getElementById('plot-derived');
                const before = card.plotHandle.raw.series.map((s) => s.show !== false);
                /* THE CHIP PRESSED IS ONE THIS PAGE ACTUALLY HAS. It used to be 'power',
                 * which stopped being a chip here on 25 August 2026 when W moved to the flow
                 * page — and setVisible on a key the legend does not carry is a call that
                 * silently does nothing, so the drill would have gone on "passing" by
                 * comparing two identical arrays if the assertion below were any weaker. */
                legend.setVisible('resistance', false, 'test');
                const after = card.plotHandle.raw.series.map((s) => s.show !== false);
                legend.setVisible('resistance', true, 'test');
                return { before, after, bound: legend.getAttribute('chart') };
            });
            assert.equal(toggled.bound, 'plot-derived', 'the key is bound to the plot beside it');
            assert.notDeepEqual(toggled.after, toggled.before,
                'a chip press reaches the canvas — the key is a control, not a caption');
        });

        test('the page composes only library components', async () => {
            await fed(700);
            const tags = await page.eval(TAGS);
            for (const name of tags) {
                assert.ok(INVENTORY.includes(name),
                    `${name} is not on this page's slice of the 57-item inventory (Part 10 §9)`);
            }
            assert.ok(tags.includes('ui-time-key'), 'including #11, built by this run');
            assert.ok(tags.includes('ui-chart-card') && tags.includes('ui-chart-legend'));
        });

        test('in its screen it is the third tab, and the band still fits its three', async () => {
            await page.mount(screenStage(), MODULES);
            await page.settle(6);
            const read = await page.evalFn(() => {
                const screen = document.querySelector('history-screen');
                const bar = screen.renderRoot.getElementById('tabs');
                const bank = screen.renderRoot.getElementById('band').shadowRoot.getElementById('tabs');
                const hit = parseFloat(getComputedStyle(screen).getPropertyValue('--ui-hit-min'));
                const space = parseFloat(getComputedStyle(screen).getPropertyValue('--ui-space-3'));
                return {
                    tabs: bar.tabs.map((t) => t.value),
                    floor: getComputedStyle(bank).minInlineSize,
                    expected: `${3 * hit + 2 * space}px`,
                    bankWidth: +bank.getBoundingClientRect().width.toFixed(2),
                    panels: bar.panels ? bar.panels.size : 0,
                };
            });
            assert.deepEqual(read.tabs, ['flow', 'power', 'data'],
                'three tabs, and Power is where §4.5 draws it — between the two chart pages');
            assert.equal(read.floor, read.expected,
                'the tab bank\'s floor is one hit target per page plus the gaps, as its own '
                + 'comment promised the third page would make it');
            assert.ok(read.bankWidth >= parseFloat(read.floor) - 0.5,
                'and the bank is on or above that floor');
        });

        test('the compare bar is SHOWN on this page — the offset has somewhere to land', async () => {
            await page.mount(screenStage(), MODULES);
            await page.settle(6);
            const heights = await page.evalFn(async () => {
                const screen = document.querySelector('history-screen');
                /* THE COMPARISON IS ASKED FOR FIRST (24 Aug 2026): the screen opens on one
                 * shot and the bar is absent until then. The claim below — that the POWER
                 * page keeps the bar while the data page does not — is about the per-page
                 * rule and is measured with the comparison open. */
                screen.comparing = true;
                await screen.updateComplete;
                const bar = screen.renderRoot.getElementById('compare');
                const at = async (name) => {
                    screen.page = name;
                    await screen.updateComplete;
                    await new Promise((r) => requestAnimationFrame(r));
                    return +bar.getBoundingClientRect().height.toFixed(2);
                };
                screen.shotA = 'a';
                screen.shotB = 'b';
                await screen.updateComplete;
                return { flow: await at('flow'), power: await at('power'), data: await at('data') };
            });
            assert.ok(heights.power > 0,
                'a time offset cannot move a P-Q path, but it moves Q16\'s marks — so the '
                + 'control is live here rather than shown dead or hidden');
            assert.equal(heights.data, 0, 'and a table still has no time axis to slide');
            assert.equal(heights.power, heights.flow, 'the same bar, the same row');
        });
    });
}
