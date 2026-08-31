/**
 * The History POWER PAGE, in a real engine at both the render harness geometries.
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

const screenStage = () => `
<div id="stage" style="inline-size: 100%; block-size: 100dvh">
  <history-screen>
    <history-power-page slot="page" data-page="power"></history-power-page>
  </history-screen>
</div>`;

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

            assert.deepEqual(plot.series.map((s) => s.label),
                [...DERIVED_CHANNELS, ...DERIVED_CHANNELS.map((k) => `b:${k}`)],
                'R and Z, then B\'s R and Z, in draw order');
            for (const s of plot.series) assert.equal(s.scale, 'y', `${s.label} is on the one axis`);

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

        test('the derived traces carry the server\'s own gaps rather than a bridged line', async () => {
            const feed = await fed(700);
            assert.equal(feed.sources.resistance, 'derived');
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

        test('the page fills the mount region and never scrolls', async () => {
            await fed(700);
            const read = await page.eval(READ_LAYOUT);
            near(read.host.h, 700, 'the page is the region tall');
            near(read.grid.h, 700, 'and hands the cell straight on');
            assert.deepEqual({ derived: read.per.derived, pq: read.per.pq }, { derived: 0, pq: 0 },
                'NEITHER PLOT SCROLLS. They RESIZE (H1), and below two usable plots the page '
                + 'switches branch — a scrollbar on a chart card would be the third state §4.5 '
                + 'refuses. This is the assertion the whole ratio-track design is for.');
            assert.ok(read.hostOverflow <= 4 && read.gridOverflow.w <= 8,
                `the only overflow is #10's hit overlay (host ${read.hostOverflow}, `
                + `grid ${JSON.stringify(read.gridOverflow)})`);
            assert.equal(read.legend.h, 44,
                'and the key is ONE chip row: a wrapped legend takes its height out of the plot');
        });

        test('the two cards have DIFFERENT floors, and both are the card\'s own', async () => {
            await fed(700);
            const read = await page.eval(READ_LAYOUT);
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
                await fed(700);
                const roomy = await page.eval(READ_LAYOUT);
                assert.ok(roomy.hostOverflow <= 4,
                    `at a height that fits, nothing but the hit overlay overflows (${roomy.hostOverflow})`);

                const tight = roomy.floors.derived + roomy.floors.pq - 40;
                await fed(tight);
                const read = await page.eval(READ_LAYOUT);
                assert.deepEqual(read.shown, { derived: true, trajectory: true },
                    'both cards keep painting — neither is put away');
                assert.equal(read.clips.grid, 'visible', 'the grid does not clip');
                assert.equal(read.clips.host, 'visible', 'and neither does the page');
                assert.ok(read.derived.h >= read.floors.derived - 0.6,
                    `the derived card keeps its floor (${read.derived.h})`);
                assert.ok(read.pq.h >= read.floors.pq - 0.6,
                    `and so does the trajectory card (${read.pq.h})`);
                assert.ok(read.pq.h > read.row.h + 0.5,
                    `which means it overhangs its squeezed row (${read.pq.h} in ${read.row.h})`);

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

        test('focus rings are unclipped on every control the page owns', async () => {
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
