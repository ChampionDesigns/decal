/**
 * Render tests for the History comparison charts.
 *
 * Drives <history-flow-page> and <history-power-page> over a recorded shot and its
 * altered twin, and checks that the canvas, the scrub readout and the legend key all
 * report the same values through offsets, hidden quantities and theme changes.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULES = ['/src/screens/history-flow-page.js'];

const SHOT = '/tools/rea-fixtures/api__v1__shots__5fc3f631-6b18-471b-9800-00d552dbbecb.json';

const COOLER_C = 30;

const SLOWER = 1.37;

const OFFSET_S = 2;

const pageStage = (h = 760) => `
<div id="stage" style="inline-size: 900px; block-size: ${h}px; display: grid;
     grid-template-rows: minmax(0,1fr); grid-template-columns: minmax(0,1fr)">
  <history-flow-page id="page-under-test"></history-flow-page>
</div>`;

const FEED = `(async () => {
  const { deriveFromRecord } = await import('/src/lib/shot-derivation.js');
  const base = await fetch('${SHOT}').then((r) => r.json());
  const n = base.measurements.length;
  const first = Math.floor(n * 0.85);
  const second = Math.floor(n * 0.94);
  const stepped = { ...base, measurements: base.measurements.map((m, i) => {
    const frame = i < first ? 0 : (i < second ? 1 : 2);
    const target = frame === 0 ? 3 : (frame === 1 ? 9 : 6);
    return { ...m, machine: { ...m.machine, profileFrame: frame, targetPressure: target } };
  }) };
  const t0 = Date.parse(base.measurements[0].machine.timestamp + 'Z');
  const cooler = { ...base, id: base.id + '-b', measurements: base.measurements.map((m) => {
    const ms = Date.parse(m.machine.timestamp + 'Z');
    const at = new Date(t0 + (ms - t0) * ${SLOWER}).toISOString().replace('Z', '');
    return { ...m, machine: { ...m.machine, timestamp: at,
      groupTemperature: m.machine.groupTemperature - ${COOLER_C},
      mixTemperature: m.machine.mixTemperature - ${COOLER_C},
      targetGroupTemperature: m.machine.targetGroupTemperature - ${COOLER_C},
      targetMixTemperature: m.machine.targetMixTemperature - ${COOLER_C} } };
  }) };
  const page = document.querySelector('history-flow-page');
  page.derivationA = deriveFromRecord(stepped);
  page.derivationB = deriveFromRecord(cooler);
  page.offset = ${OFFSET_S};
  await page.updateComplete;
  const cards = [...page.renderRoot.querySelectorAll('ui-chart-card')];
  await Promise.all(cards.map((c) => c.ready));
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
  const tp = page.derivationA.series.targetPressure;
  const boundaries = [];
  for (let i = 1; i < tp.x.length; i += 1) if (tp.x[i] === tp.x[i - 1]) boundaries.push(tp.x[i]);
  return {
    ok: page.derivationA.ok && page.derivationB.ok,
    counts: [page.derivationA.axis.t.length, page.derivationB.axis.t.length],
    ends: [page.derivationA.axis.t.at(-1), page.derivationB.axis.t.at(-1)],
    boundaries,
  };
})()`;

const READ_PLOT = (id) => `(() => {
  const page = document.querySelector('history-flow-page');
  const card = page.renderRoot.getElementById('${id}');
  const u = card.plotHandle.raw;
  const xs = u.data[0];
  const series = {};
  u.series.slice(1).forEach((s, i) => {
    const ys = u.data[i + 1] || [];
    let lo = null; let hi = null; let min = null; let max = null;
    for (let k = 0; k < ys.length; k += 1) {
      const y = ys[k];
      if (y === null || y === undefined) continue;
      if (lo === null) lo = xs[k];
      hi = xs[k];
      if (min === null || y < min) min = y;
      if (max === null || y > max) max = y;
    }
    series[s.label] = { from: lo, to: hi, min, max, show: s.show !== false };
  });
  return {
    build: card.buildCount,
    slots: xs.length,
    axis: { from: xs[0], to: xs[xs.length - 1] },
    y: { min: u.scales.y.min, max: u.scales.y.max },
    series,
  };
})()`;

const READ_CURSOR = `(() => {
  const page = document.querySelector('history-flow-page');
  const card = page.renderRoot.getElementById('plot-top');
  const legend = card.querySelector('ui-chart-legend');
  const u = card.plotHandle.raw;
  const xs = u.data[0];
  const t = card.cursor.t;
  const column = u.series.slice(1).findIndex((s) => s.label === 'targetPressure') + 1;
  let slot = -1;
  for (let i = 0; i < xs.length; i += 1) if (xs[i] <= t) slot = i;
  return {
    active: card.cursor.active,
    t,
    named: (legend.values ?? {}).targetPressure ?? null,
    plotted: slot < 0 ? null : u.data[column][slot],
  };
})()`;

const POINT_AT = (t) => `(() => {
  const page = document.querySelector('history-flow-page');
  const card = page.renderRoot.getElementById('plot-top');
  const over = card.plotHandle.raw.over;
  const rect = over.getBoundingClientRect();
  const toPainted = rect.width / over.clientWidth;
  return {
    x: rect.left + card.plotHandle.raw.valToPos(${t}, 'x') * toPainted,
    y: rect.top + rect.height / 2,
  };
})()`;

const TAP = (chip) => `(async () => {
  const page = document.querySelector('history-flow-page');
  const legend = page.renderRoot.querySelector('ui-chart-legend[chart="plot-top"]');
  const button = legend.renderRoot.getElementById('${chip}');
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 1 }));
  await legend.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  return {
    pressed: button.getAttribute('aria-pressed'),
    hidden: [...legend.hiddenKeys],
  };
})()`;

const FEED_POWER = `(async () => {
  const { deriveFromRecord } = await import('/src/lib/shot-derivation.js');
  const gate = (p, f, v) => ((f >= 0.3 && p >= 0.3 && Number.isFinite(v)) ? v : null);
  const upgrade = (record) => ({ ...record, measurements: record.measurements.map((m) => {
    const machine = m.machine; const p = machine && machine.pressure; const f = machine && machine.flow;
    if (typeof p !== 'number' || typeof f !== 'number') return m;
    const next = { ...machine };
    const R = gate(p, f, p / (f * f)); const Z = gate(p, f, p / f);
    if (R !== null) next.puckResistanceDerived = R;
    if (Z !== null) next.loadImpedanceDerived = Z;
    return { ...m, machine: next };
  }) });
  const base = await fetch('${SHOT}').then((r) => r.json());
  const page = document.querySelector('history-power-page');
  page.derivationA = deriveFromRecord(upgrade(base));
  page.derivationB = deriveFromRecord(upgrade({ ...base, id: base.id + '-b' }));
  page.offset = ${OFFSET_S};
  await page.updateComplete;
  const cards = [...page.renderRoot.querySelectorAll('ui-chart-card')];
  await Promise.all(cards.map((c) => c.ready));
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
  return { ok: page.derivationA.ok && page.derivationB.ok };
})()`;

const READ_DERIVED = `(async () => {
  const page = document.querySelector('history-power-page');
  const card = page.renderRoot.getElementById('plot-derived');
  await card.updateComplete;
  const u = card.plotHandle.raw;
  const show = {};
  u.series.slice(1).forEach((s) => { show[s.label] = s.show !== false; });
  const legend = page.renderRoot.querySelector('ui-chart-legend[chart="plot-derived"]');
  return {
    build: card.buildCount,
    show,
    chip: legend.renderRoot.getElementById('chip-resistance').getAttribute('aria-pressed'),
  };
})()`;

describe('History comparison charts — the canvas, the numbers and the key agree', () => {
    let browser;
    before(async () => { browser = await launch({ geometry: BENCH }); });
    after(async () => { await browser?.close(); });

    const mounted = (fn) => browser.withPage({ geometry: BENCH }, async (page) => {
        await page.mount(pageStage(), MODULES);
        const fed = await page.eval(FEED);
        assert.equal(fed.ok, true, 'both records must derive, or nothing below is about a chart');
        assert.deepEqual(fed.counts, [50, 50],
            'the two shots must have the SAME sample count — that is the case under test');
        assert.equal(fed.boundaries.length, 2,
            `A must step its target twice: ${JSON.stringify(fed.boundaries)}`);
        await fn(page, fed);
    });

    test('equal sample counts do not put the comparison on the reference\'s clock', () => mounted(
        async (page, fed) => {
            const plot = await page.eval(READ_PLOT('plot-temp'));

            assert.ok(plot.slots > 50,
                `the axis must carry both shots' instants, not one shot's fifty: ${plot.slots}`);

            const b = plot.series['b:groupTemp'];
            assert.ok(b, 'the comparison is on the plot');
            const bEnd = fed.ends[1] + OFFSET_S;
            assert.ok(Math.abs(b.to - bEnd) < 0.01,
                `B must end at its own last second plus the offset (${bEnd}), not at ${b.to}`);
            assert.ok(Math.abs(b.from - OFFSET_S) < 0.01,
                `and start where the offset put it (${OFFSET_S} s), not at ${b.from}`);
            assert.ok(plot.axis.to >= bEnd - 0.01,
                'one visible clock, long enough for the shot that finishes last');
        },
    ));

    test('a cooler comparison is inside the temperature axis rather than under it', () => mounted(
        async (page) => {
            const plot = await page.eval(READ_PLOT('plot-temp'));
            const a = plot.series.groupTemp;
            const b = plot.series['b:groupTemp'];

            assert.ok(b.min < a.min - 20, 'the drill is only meaningful if B really is cooler');
            assert.ok(plot.y.min <= b.min,
                `B's coolest reading (${b.min}) is below the axis floor (${plot.y.min})`);
            assert.ok(plot.y.max >= a.max,
                `and A's warmest (${a.max}) is still under the ceiling (${plot.y.max})`);
            assert.ok(plot.y.max - plot.y.min < 120,
                'with a band, not the whole thermometer');
        },
    ));

    test('a scrub across two target steps names the value the chart is drawing', () => mounted(
        async (page) => {
            const well = '#page-under-test >>> #plot-top >>> .well';
            const box = await page.box(well);
            const readings = [];
            for (let i = 1; i <= 24; i += 1) {
                await page.mouse('mouseMoved',
                    box.left + (box.width * i) / 25, box.top + box.height / 2);
                readings.push(await page.eval(READ_CURSOR));
            }

            const live = readings.filter((r) => r.active && r.named !== null);
            assert.ok(live.length > 10, `the sweep must land on the plot: ${live.length} readings`);
            for (const r of live) {
                assert.equal(r.named, r.plotted.toFixed(1),
                    `at t=${r.t} the chip says ${r.named} and the canvas draws ${r.plotted}`);
            }

            const named = new Set(live.map((r) => r.named));
            assert.ok(named.size >= 2,
                `the sweep must cross a boundary: ${[...named].join(', ')}`);
        },
    ));

    test('standing ON a boundary reads the target the machine moved TO', () => mounted(
        async (page, fed) => {
            for (const at of fed.boundaries) {
                const spot = await page.eval(POINT_AT(at));
                await page.mouse('mouseMoved', spot.x, spot.y);
                const r = await page.eval(READ_CURSOR);
                assert.equal(r.active, true, `the cursor must be live at the ${at} s boundary`);
                assert.equal(r.t, at,
                    `the cursor must land ON the boundary sample, not beside it: ${r.t}`);
                assert.equal(r.named, r.plotted.toFixed(1),
                    `at the ${at} s boundary the chip says ${r.named} and the canvas draws `
                    + `${r.plotted} — the reading is on the wrong side of the step`);
            }
        },
    ));

    test('hiding a quantity puts BOTH shots\' traces away', () => mounted(async (page) => {
        const before = await page.eval(READ_PLOT('plot-top'));
        assert.equal(before.series.pressure.show, true);
        assert.equal(before.series['b:pressure'].show, true);

        const tapped = await page.eval(TAP('chip-pressure'));
        assert.equal(tapped.pressed, 'false', 'the chip reads off');
        assert.deepEqual(tapped.hidden, ['pressure']);

        const after = await page.eval(READ_PLOT('plot-top'));
        assert.equal(after.series.pressure.show, false, 'A\'s pressure is off the plot');
        assert.equal(after.series['b:pressure'].show, false,
            'and so is the comparison\'s — one chip, one quantity, both shots');
        assert.equal(after.series.flow.show, true, 'and nothing else moved');
        assert.equal(after.series['b:flow'].show, true);
    }));

    test('a hidden trace stays hidden through an offset change and a theme change',
        () => mounted(async (page) => {
            await page.eval(TAP('chip-pressure'));
            const hidden = await page.eval(READ_PLOT('plot-top'));
            assert.equal(hidden.series['b:pressure'].show, false);

            const moved = await page.eval(`(async () => {
                const page = document.querySelector('history-flow-page');
                page.offset = ${OFFSET_S} + 1;
                await page.updateComplete;
                const card = page.renderRoot.getElementById('plot-top');
                await card.updateComplete;
                await new Promise((r) => requestAnimationFrame(r));
                await new Promise((r) => requestAnimationFrame(r));
                return { build: card.buildCount };
            })()`);
            assert.ok(moved.build > hidden.build,
                'the offset must actually rebuild the plot, or this proves nothing');

            const afterOffset = await page.eval(READ_PLOT('plot-top'));
            assert.equal(afterOffset.series.pressure.show, false,
                'the trace the reader hid must not come back when the shots are re-aligned');
            assert.equal(afterOffset.series['b:pressure'].show, false);
            const chip = await page.eval(
                'document.querySelector(\'history-flow-page\').renderRoot'
                + '.querySelector(\'ui-chart-legend[chart="plot-top"]\')'
                + '.renderRoot.getElementById("chip-pressure").getAttribute("aria-pressed")',
            );
            assert.equal(chip, 'false', 'and the chip and the plot still say the same thing');

            await page.setTheme('light');
            await page.eval(`(async () => {
                const page = document.querySelector('history-flow-page');
                const card = page.renderRoot.getElementById('plot-top');
                for (let i = 0; i < 20; i += 1) await new Promise((r) => requestAnimationFrame(r));
                await card.updateComplete;
                return card.buildCount;
            })()`);
            const afterTheme = await page.eval(READ_PLOT('plot-top'));
            assert.ok(afterTheme.build > afterOffset.build,
                'a theme change must rebuild the plot, or this proves nothing');
            assert.equal(afterTheme.series.pressure.show, false,
                'a rebuilt plot opens with every series shown — the key has to state itself again');
            assert.equal(afterTheme.series['b:pressure'].show, false);
        }));

    test('the power page\'s key states itself again after its plot is rebuilt', () => browser
        .withPage({ geometry: BENCH }, async (page) => {
            await page.mount(`
<div id="stage" style="inline-size: 1100px; block-size: 760px; display: grid;
     grid-template-rows: minmax(0,1fr); grid-template-columns: minmax(0,1fr)">
  <history-power-page id="page-under-test"></history-power-page>
</div>`, ['/src/screens/history-power-page.js']);
            const fed = await page.eval(FEED_POWER);
            assert.equal(fed.ok, true, 'both records must derive');

            const before = await page.eval(READ_DERIVED);
            assert.equal(before.show.resistance, true);
            assert.equal(before.show['b:resistance'], true);

            await page.eval(`(async () => {
                const page = document.querySelector('history-power-page');
                const legend = page.renderRoot.querySelector('ui-chart-legend[chart="plot-derived"]');
                legend.renderRoot.getElementById('chip-resistance')
                    .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 1 }));
                await legend.updateComplete;
                await new Promise((r) => requestAnimationFrame(r));
                return true;
            })()`);
            const hidden = await page.eval(READ_DERIVED);
            assert.equal(hidden.show.resistance, false, 'A\'s R is off the plot');
            assert.equal(hidden.show['b:resistance'], false,
                'and so is the comparison\'s — one chip, one quantity, both shots');

            await page.eval(`(async () => {
                const page = document.querySelector('history-power-page');
                page.offset = ${OFFSET_S} + 1;
                await page.updateComplete;
                const card = page.renderRoot.getElementById('plot-derived');
                await card.updateComplete;
                await new Promise((r) => requestAnimationFrame(r));
                await new Promise((r) => requestAnimationFrame(r));
                return true;
            })()`);
            const after = await page.eval(READ_DERIVED);
            assert.ok(after.build > hidden.build,
                'the offset must actually rebuild the plot, or this proves nothing');
            assert.equal(after.show.resistance, false,
                'a rebuilt plot opens with every series shown — the key has to state itself again');
            assert.equal(after.show['b:resistance'], false);
            assert.equal(after.chip, 'false', 'and the chip and the plot still say the same thing');
        }));
});
