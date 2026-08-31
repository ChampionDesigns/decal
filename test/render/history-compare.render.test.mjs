/**
 * The PORT cluster: hist-port-history-viewer, hist-compare-bar, hist-tests-intent.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { ALIGNMENT_OFFSET_LIMIT_S } from '../../src/lib/alignment-offset.js';
import { COMPARISON_ALPHA, FLOW_PLOTS } from '../../src/lib/history-series.js';

const MODULES = [
    '/src/screens/history-screen.js',
    '/src/screens/history-flow-page.js',
    '/src/screens/history-data-page.js',
];

/** The mock's same-profile pair: 3.26 s and 8.54 s, both "Extractamundo Dos! (2)". */
const SHOT_A = '5fc3f631-6b18-471b-9800-00d552dbbecb';
const SHOT_B = 'd5139a1f-c4ee-47e2-bb80-0cbf3e39b6a3';

/** The top plot's channel count, read off the ONE table both pages draw from. */
const TOP_CHANNELS = FLOW_PLOTS.find((plot) => plot.id === 'top').channels.length;

const near = (got, want, what, tol = 0.6) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: ${got} is not within ${tol} of ${want}`,
);

/** The screen, mounted the way the route mounts it: no children, one `boot`. */
const SCREEN_STAGE = `
<div id="stage" style="inline-size: 100%; block-size: 100dvh">
  <history-screen></history-screen>
</div>`;

const BOOT = `(async () => {
  const screen = document.querySelector('history-screen');
  window.__calls = [];
  const key = (route) => (route === '/shots'
    ? 'api__v1__shots~limit=20~offset=0~order=desc.json'
    : 'api__v1__shots__' + route.slice('/shots/'.length) + '.json');
  screen.boot = {
    transport: {
      request: async (route, options = {}) => {
        window.__calls.push({ route, method: (options && options.method) || 'GET' });
        const res = await fetch('/tools/rea-fixtures/' + key(route), { cache: 'no-store' });
        if (!res.ok) return { ok: false, status: 404, message: 'no recording of ' + route, data: null };
        return { ok: true, status: 200, data: await res.json(), notModified: false };
      },
    },
  };
  await screen.updateComplete;
  for (let i = 0; i < 40; i += 1) {
    await new Promise((r) => setTimeout(r, 10));
    if (screen.renderRoot.getElementById('select-a')?.options?.length) break;
  }
  await screen.updateComplete;
  return {
    calls: window.__calls.length,
    options: screen.renderRoot.getElementById('select-a').options.length,
  };
})()`;

/** Choose both shots through the real #7 selects, then let both plots build. */
const PICK_PAIR = `(async () => {
  const screen = document.querySelector('history-screen');
  const pick = async (id, value) => {
    const select = screen.renderRoot.getElementById(id);
    select.value = value;
    select.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true, detail: { value } }));
    await screen.updateComplete;
  };
  await pick('select-a', '${SHOT_A}');
  /* THE COMPARISON IS ASKED FOR. Until it is, B and the alignment bar
     are ABSENT — the screen opens on ONE shot, which is what tapping the Live chart asks
     for. Every assertion below is about the comparison, so the drive opens it first. */
  screen.comparing = true;
  await screen.updateComplete;
  await pick('select-b', '${SHOT_B}');
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 10));
    const flow = screen.renderRoot.querySelector('history-flow-page');
    if (flow && flow.derivationA && flow.derivationB) break;
  }
  const flow = screen.renderRoot.querySelector('history-flow-page');
  await flow.updateComplete;
  const cards = [...flow.renderRoot.querySelectorAll('ui-chart-card')];
  await Promise.all(cards.map((c) => c.ready));
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
  return {
    a: Boolean(flow.derivationA && flow.derivationA.ok),
    b: Boolean(flow.derivationB && flow.derivationB.ok),
    durations: [flow.derivationA.scalars.durationSeconds, flow.derivationB.scalars.durationSeconds],
    byId: window.__calls.filter((c) => c.route !== '/shots').length,
    list: window.__calls.filter((c) => c.route === '/shots').length,
  };
})()`;

const SLIDE = (value) => `(async () => {
  const screen = document.querySelector('history-screen');
  const bar = screen.renderRoot.getElementById('compare');
  const slider = bar.renderRoot.getElementById('slider');
  const input = slider.renderRoot.querySelector('input[type=range]');
  const flow = screen.renderRoot.querySelector('history-flow-page');
  const card = flow.renderRoot.getElementById('plot-top');
  const painted = card.paintCount;
  const started = performance.now();
  input.value = String(${value});
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await screen.updateComplete;
  await flow.updateComplete;
  const rebuilt = performance.now() - started;
  let frames = 0;
  while (card.paintCount === painted && frames < 60) {
    await new Promise((r) => requestAnimationFrame(r));
    frames += 1;
  }
  await new Promise((r) => requestAnimationFrame(r));
  return {
    applied: bar.offset, screen: screen.offset, page: flow.offset,
    ms: +(performance.now() - started).toFixed(2),
    rebuildMs: +rebuilt.toFixed(2),
    frames,
    drew: card.paintCount > painted,
  };
})()`;

/** The traces' real x extents and the plot's real x scale, off the live uPlot instance. */
const READ_PLOT = (id = 'plot-top') => `(() => {
  const screen = document.querySelector('history-screen');
  const flow = screen.renderRoot.querySelector('history-flow-page');
  const card = flow.renderRoot.getElementById('${id}');
  const u = card.plotHandle.raw;
  const xs = u.data[0];
  const series = {};
  u.series.slice(1).forEach((s, i) => {
    const ys = u.data[i + 1] || [];
    let lo = null; let hi = null; let breaks = 0; let seen = 0;
    for (let k = 0; k < ys.length; k += 1) {
      const y = ys[k];
      if (y === null || y === undefined) { if (seen) breaks += 1; continue; }
      if (lo === null) lo = xs[k];
      hi = xs[k]; seen += 1;
    }
    series[s.label] = { from: lo, to: hi, breaks, seen, dash: s.dash ? [...s.dash] : null, alpha: s.alpha, cap: s.cap };
  });
  return {
    axis: { from: xs[0], to: xs[xs.length - 1], slots: xs.length },
    scale: { min: u.scales.x.min, max: u.scales.x.max },
    xMin: card.xMin,
    spanGaps: u.series[1].spanGaps,
    series,
  };
})()`;

/* ═══════════════════════════════════════════════════════════════════════ the suites */

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`History port @ ${geometry.name}`, () => {
        let browser;
        let page;

        before(async () => {
            browser = await launch({ geometry });
            page = await browser.newPage({ geometry });
        });
        after(async () => { await browser?.close(); });

        const staged = async () => {
            await page.mount(SCREEN_STAGE, MODULES);
            const opened = await page.eval(BOOT);
            assert.equal(opened.options, 20, 'the port read one page of twenty shots');
            assert.equal(opened.calls, 2, 'the listing, and the shot it opened on');
            await page.evalFn(async () => {
                const screen = document.querySelector('history-screen');
                screen.comparing = true;
                await screen.updateComplete;
            });
            return opened;
        };

        test('a screen with no children still has all three pages', async () => {
            await staged();
            const pages = await page.evalFn(() => {
                const screen = document.querySelector('history-screen');
                return {
                    light: screen.children.length,
                    mounted: [...screen.renderRoot.querySelectorAll('[data-page]')]
                        .map((el) => el.tagName.toLowerCase()),
                    panels: screen.renderRoot.getElementById('tabs').panels?.size ?? 0,
                };
            });
            assert.equal(pages.light, 0, 'app-root creates the element and appends nothing');
            assert.deepEqual(pages.mounted,
                ['history-flow-page', 'history-power-page', 'history-data-page'],
                'THREE pages, in the decided order: the carve-out was reversed for the power '
                + 'page, and the two chart pages belong together with the table after them');
            assert.equal(pages.panels, 3, 'and #32 adopted all three as tab panels');
        });

        test('opening the screen fetches no shot record at all (B5 / Q17)', async () => {
            await staged();
            const counts = await page.evalFn(() => ({
                total: window.__calls.length,
                byId: window.__calls.filter((c) => c.route !== '/shots').length,
                rows: document.querySelector('history-screen').renderRoot
                    .querySelector('history-data-page').rows.length,
            }));
            assert.equal(counts.rows, 20, 'twenty rows painted');
            assert.equal(counts.byId, 1, 'one record: the shot the screen opened on');
            assert.equal(counts.total, 2, 'the listing, and that one record');
        });

        test('picking two shots costs exactly two records', async () => {
            await staged();
            const picked = await page.eval(PICK_PAIR);
            assert.equal(picked.a, true);
            assert.equal(picked.b, true);
            assert.equal(picked.byId, 2, 'one per shot, and the opening one is not re-fetched');
            assert.equal(picked.list, 1, 'and the list was not re-read');
            near(picked.durations[0], 3.26, 'A is the short one', 0.05);
            near(picked.durations[1], 8.54, 'B is the long one', 0.05);
        });

        test('H8: the screen row 2 is the bar and the bar is its own contents', async () => {
            await staged();
            const measured = await page.evalFn(() => {
                const screen = document.querySelector('history-screen');
                const bar = screen.renderRoot.getElementById('compare');
                const strip = bar.renderRoot.getElementById('bar');
                const cs = getComputedStyle(screen);
                return {
                    tracks: cs.gridTemplateRows.split(' ').map(parseFloat),
                    bar: +bar.getBoundingClientRect().height.toFixed(2),
                    strip: +strip.getBoundingClientRect().height.toFixed(2),
                    region: +screen.renderRoot.getElementById('page').getBoundingClientRect().height.toFixed(2),
                };
            });
            near(measured.tracks[1], measured.bar, 'the auto track is exactly the bar');
            near(measured.strip, measured.bar, 'and the bar is exactly its own strip');
        });

        test('H8: a 200px Reset cannot move the bar, the track, or the page region', async () => {
            await staged();
            const before = await page.evalFn(() => {
                const screen = document.querySelector('history-screen');
                return {
                    bar: +screen.renderRoot.getElementById('compare').getBoundingClientRect().height.toFixed(2),
                    region: +screen.renderRoot.getElementById('page').getBoundingClientRect().height.toFixed(2),
                };
            });
            const varied = await page.evalFn(async (sizes) => {
                const screen = document.querySelector('history-screen');
                const bar = screen.renderRoot.getElementById('compare');
                const sheet = new CSSStyleSheet();
                bar.renderRoot.adoptedStyleSheets = [...bar.renderRoot.adoptedStyleSheets, sheet];
                const out = [];
                for (const size of sizes) {
                    sheet.replaceSync(`#reset { block-size: ${size} } #slider { block-size: ${size} }`);
                    await new Promise((r) => requestAnimationFrame(r));
                    out.push({
                        size,
                        bar: +bar.getBoundingClientRect().height.toFixed(2),
                        region: +screen.renderRoot.getElementById('page').getBoundingClientRect().height.toFixed(2),
                    });
                }
                sheet.replaceSync('');
                return out;
            }, ['200px', '20px', '96px']);
            for (const state of varied) {
                near(state.bar, before.bar,
                    `H8: a ${state.size} control must not size the strip. Slate measured a `
                    + '64px Reset setting the height over a 44px slider beside it '
                    + '.', 0.51);
                near(state.region, before.region,
                    `and the page region must not move either at ${state.size}`, 0.51);
            }
        });

        test('the slider moves B by the offset and never moves A', async () => {
            await staged();
            await page.eval(PICK_PAIR);
            const at0 = await page.eval(READ_PLOT());

            const slid = await page.eval(SLIDE(4));
            assert.equal(slid.applied, 4, 'the bar applied what the input said');
            assert.equal(slid.screen, 4, 'the screen holds what the port applied');
            assert.equal(slid.page, 4, 'and the page was redrawn with it');
            const at4 = await page.eval(READ_PLOT());

            near(at4.series.pressure.from, at0.series.pressure.from, 'A did not move', 0.01);
            near(at4.series.pressure.to, at0.series.pressure.to, 'either end of A', 0.01);
            near(at4.series['b:pressure'].from, at0.series['b:pressure'].from + 4,
                'B moved by exactly the offset', 0.01);
            near(at4.series['b:pressure'].to, at0.series['b:pressure'].to + 4,
                'the WHOLE trace moved, not just its head', 0.01);
        });

        test('driven to BOTH ends, past the shorter trace, with nothing swallowed', async () => {
            await staged();
            await page.eval(PICK_PAIR);
            const limit = ALIGNMENT_OFFSET_LIMIT_S;

            const plus = await page.eval(SLIDE(limit));
            assert.equal(plus.applied, limit);
            const atPlus = await page.eval(READ_PLOT());
            assert.ok(atPlus.series['b:pressure'].to > atPlus.series.pressure.to,
                'B now ends past A — the "trace index one past the end" condition, staged');

            const minus = await page.eval(SLIDE(-limit));
            assert.equal(minus.applied, -limit);
            const atMinus = await page.eval(READ_PLOT());
            assert.ok(atMinus.series['b:pressure'].from < 0,
                'and at the other end B starts before zero');

            near(atMinus.scale.min, atMinus.series['b:pressure'].from, 'the scale carries B\'s head', 0.2);
            assert.ok(atMinus.scale.min <= -limit + 0.2,
                `the x scale opened to ${atMinus.scale.min} rather than clipping at 0`);
            assert.equal(atPlus.xMin, 0, 'and a positive slide leaves the axis at zero');

            const spanAt = (state) => state.series['b:pressure'].to - state.series['b:pressure'].from;
            near(spanAt(atMinus), spanAt(atPlus), 'B keeps its whole length at both ends', 0.01);
            near(atPlus.series['b:pressure'].from - atMinus.series['b:pressure'].from,
                2 * limit, 'and travelled the full width of the control', 0.01);

            const errors = await page.evalFn(() => ({
                pageErrors: (window.__h?.errors ?? []).length,
            })).catch(() => ({ pageErrors: 0 }));
            assert.equal(errors.pageErrors, 0);
            assert.deepEqual(page.pageErrors, [], 'no error escaped the alignment path');
            assert.deepEqual(page.consoleErrors, [], 'and nothing was logged and shrugged off');
        });

        test('every step of the 0.1 s grid redraws, and the redraw is measured', async () => {
            await staged();
            await page.eval(PICK_PAIR);
            const samples = [];
            for (const value of [-5, -2.5, -0.1, 0, 0.1, 1.3, 2.5, 5]) {
                const slid = await page.eval(SLIDE(value));
                near(slid.applied, value, `the slider applied ${value}`, 0.001);
                assert.equal(slid.drew, true, `${value}: the offset reached the canvas`);
                assert.equal(slid.frames, 1, `${value}: one animation frame, not two`);
                samples.push(slid);
            }
            const rebuild = samples.map((s) => s.rebuildMs).sort((a, b) => a - b);
            const toPaint = samples.map((s) => s.ms).sort((a, b) => a - b);
            assert.ok(rebuild.at(-1) < 60,
                `rebuilding the series stayed far under a frame (worst ${rebuild.at(-1)} ms)`);
            assert.ok(toPaint[Math.floor(toPaint.length / 2)] > 0);
            const final = await page.eval(READ_PLOT());
            assert.ok(final.series['b:pressure'].to > final.series.pressure.to);
        });

        test('Reset is an undo, and it puts every trace back', async () => {
            await staged();
            await page.eval(PICK_PAIR);
            const at0 = await page.eval(READ_PLOT());
            await page.eval(SLIDE(3.7));
            const reset = await page.evalFn(async () => {
                const screen = document.querySelector('history-screen');
                const bar = screen.renderRoot.getElementById('compare');
                const button = bar.renderRoot.getElementById('reset');
                const disabledWhileOff = button.disabled;
                button.renderRoot.querySelector('button').click();
                await screen.updateComplete;
                const flow = screen.renderRoot.querySelector('history-flow-page');
                await flow.updateComplete;
                await new Promise((r) => requestAnimationFrame(r));
                await new Promise((r) => requestAnimationFrame(r));
                return { disabledWhileOff, offset: bar.offset, screen: screen.offset };
            });
            assert.equal(reset.disabledWhileOff, false, 'live while there is something to undo');
            assert.equal(reset.offset, 0);
            assert.equal(reset.screen, 0);
            const back = await page.eval(READ_PLOT());
            near(back.series['b:pressure'].from, at0.series['b:pressure'].from, 'B is back', 0.01);
            near(back.series['b:pressure'].to, at0.series['b:pressure'].to, 'both ends', 0.01);
        });

        test('A solid, B dashed and faded, same hue — on the live plot', async () => {
            await staged();
            await page.eval(PICK_PAIR);
            const drawn = await page.evalFn(() => {
                const screen = document.querySelector('history-screen');
                const flow = screen.renderRoot.querySelector('history-flow-page');
                const card = flow.renderRoot.getElementById('plot-top');
                const u = card.plotHandle.raw;
                const read = (s, i) => ({
                    label: s.label,
                    dash: s.dash ? [...s.dash] : null,
                    alpha: s.alpha,
                    cap: s.cap,
                    stroke: typeof s.stroke === 'function' ? s.stroke(u, i + 1) : s.stroke,
                });
                return u.series.slice(1).map(read);
            });
            const a = drawn.filter((s) => !s.label.startsWith('b:'));
            const b = drawn.filter((s) => s.label.startsWith('b:'));
            assert.equal(a.length, b.length, 'one B for every A');
            for (let i = 0; i < a.length; i += 1) {
                assert.equal(b[i].label, `b:${a[i].label}`, 'they line up channel for channel');
                assert.equal(b[i].stroke, a[i].stroke, 'the pair shares a hue');
                assert.deepEqual(b[i].dash, [9, 9], 'B is dashed');
                assert.equal(b[i].alpha, COMPARISON_ALPHA, 'and faded — opacity is not dropped');
                assert.equal(a[i].cap, 'round');
                assert.equal(b[i].cap, 'round', 'chart-C7: one cap constant, every series');
            }
            assert.ok(a.some((s) => !s.dash || s.dash.length === 0), 'A has solid actuals');
        });

        test('a gated null renders as a BREAK, not as a held value', async () => {
            await staged();
            await page.eval(PICK_PAIR);
            const gapped = await page.evalFn(async () => {
                const screen = document.querySelector('history-screen');
                const flow = screen.renderRoot.querySelector('history-flow-page');
                const card = flow.renderRoot.getElementById('plot-top');
                const derivation = flow.derivationA;
                const x = [...derivation.series.pressure.x];
                const y = [...derivation.series.pressure.y];
                const mid = Math.floor(y.length / 2);
                y[mid] = null; y[mid + 1] = null;
                card.setRecords({ pressure: { x, y } });
                card.setChannels([{ key: 'pressure' }]);
                await new Promise((r) => requestAnimationFrame(r));
                await new Promise((r) => requestAnimationFrame(r));
                const u = card.plotHandle.raw;
                const ys = u.data[1];
                return {
                    spanGaps: u.series[1].spanGaps,
                    nulls: ys.filter((v) => v === null).length,
                    heldToTheLeft: ys[mid] === y[mid - 1],
                    survivedAfter: ys[mid + 2] === y[mid + 2],
                };
            });
            assert.equal(gapped.spanGaps, false, 'uPlot draws a surviving null as a break');
            assert.ok(gapped.nulls >= 2, 'the gated slots reached the renderer as nulls');
            assert.equal(gapped.heldToTheLeft, false,
                'holding the last value across a gate is the ported defect');
            assert.equal(gapped.survivedAfter, true,
                'and the first real reading after the gate is not dropped');
        });

        test('B\'s step boundaries are handed to the renderer with B\'s dash and fade', async () => {
            await staged();
            const rules = await page.evalFn(async (shotA, shotB) => {
                const screen = document.querySelector('history-screen');
                const flow = screen.renderRoot.querySelector('history-flow-page');
                await flow.updateComplete;
                const card = flow.renderRoot.getElementById('plot-top');
                await card.ready;
                /* SPY ON THE CALL THE RENDERER RECEIVES. Not a built-and-discarded layout
                 * object ( / ) — the argument the plot is about to stroke from. */
                const seen = [];
                const real = card.setRules.bind(card);
                card.setRules = (value) => { seen.push(value); return real(value); };
                screen.comparing = true;
                await screen.updateComplete;
                const pick = async (id, value) => {
                    const select = screen.renderRoot.getElementById(id);
                    select.value = value;
                    select.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true, detail: { value } }));
                    await screen.updateComplete;
                };
                await pick('select-a', shotA);
                await pick('select-b', shotB);
                for (let i = 0; i < 60; i += 1) {
                    await new Promise((r) => setTimeout(r, 10));
                    if (!flow.derivationA || !flow.derivationB) continue;
                    if (seen.some((v) => (v.vertical ?? []).some((r) => r.alpha !== undefined))) break;
                }
                const last = seen.filter((v) => (v.vertical ?? []).length).at(-1) ?? { vertical: [], labels: [] };
                return {
                    vertical: last.vertical.map((r) => ({
                        x: +r.x.toFixed(4), dash: r.dash ? [...r.dash] : null, alpha: r.alpha ?? null,
                        colour: r.color ?? null, hasBookkeeping: 'reference' in r,
                    })),
                    labels: last.labels.length,
                    marks: {
                        a: flow.derivationA.stepMarks.length,
                        b: flow.derivationB.stepMarks.length,
                    },
                };
            }, SHOT_A, SHOT_B);

            assert.equal(rules.vertical.length, rules.marks.a + rules.marks.b,
                'both shots\' boundaries reach the renderer');
            const aRules = rules.vertical.slice(0, rules.marks.a);
            const bRules = rules.vertical.slice(rules.marks.a);
            for (const rule of aRules) {
                assert.equal(rule.dash, null, 'A takes the renderer\'s own default pattern');
                assert.equal(rule.alpha, null, 'and is fully opaque');
            }
            for (const rule of bRules) {
                assert.deepEqual(rule.dash, [9, 9], 'B\'s dash comes from the one table');
                assert.equal(rule.alpha, COMPARISON_ALPHA,
                    'Slate\'s stepRules() hard-coded one pattern and DROPPED opacity');
            }
            for (const rule of rules.vertical) {
                assert.equal(rule.hasBookkeeping, false, 'nothing internal travels to the plot');
                assert.ok(rule.colour && rule.colour !== 'undefined',
                    'the colour was read from the card\'s own tokens, not named in a module');
            }
            assert.ok(rules.labels <= rules.marks.a, 'the step name is said once, on A');
        });

        /** What the canvas is about to be stroked with, plus what is on it now. */
        const RULES_NOW = `(() => {
          const screen = document.querySelector('history-screen');
          const flow = screen.renderRoot.querySelector('history-flow-page');
          const card = flow.renderRoot.getElementById('plot-top');
          const v = card.plotHandle.state.vRules;
          return {
            vertical: v.length,
            dashed: v.filter((r) => Array.isArray(r.dash) && r.dash.length).length,
            faded: v.filter((r) => r.alpha !== undefined && r.alpha < 1).length,
            colours: [...new Set(v.map((r) => r.color))],
            labels: card.plotHandle.state.labels.length,
            inks: [...new Set(card.plotHandle.state.labels.map((l) => l.color))],
            series: card.plotHandle.raw.series.length - 1,
            boundary: card.chartTokens.channels['step-boundary'],
            ink: card.chartTokens.surface.label,
            build: card.buildCount,
            marks: {
              a: flow.derivationA ? flow.derivationA.stepMarks.length : 0,
              b: flow.derivationB ? flow.derivationB.stepMarks.length : 0,
            },
          };
        })()`;

        test('a theme flip keeps BOTH shots\' boundaries on the plot (chart-C2, composed)', async () => {
            await staged();
            await page.eval(PICK_PAIR);
            const before = await page.eval(RULES_NOW);
            assert.equal(before.vertical, before.marks.a + before.marks.b,
                'the pair is on the plot to begin with');
            assert.equal(before.dashed, before.marks.b, 'and B\'s are the dashed ones');

            const start = await page.evalFn(() => document.documentElement.getAttribute('data-theme'));
            await page.setTheme(start === 'dark' ? 'light' : 'dark');
            await page.evalFn(async () => {
                const screen = document.querySelector('history-screen');
                const flow = screen.renderRoot.querySelector('history-flow-page');
                const card = flow.renderRoot.getElementById('plot-top');
                for (let i = 0; i < 60; i += 1) {
                    await new Promise((r) => requestAnimationFrame(r));
                    if (card.paintCount) break;
                }
                await flow.updateComplete;
                return true;
            });
            const after = await page.eval(RULES_NOW);

            assert.equal(after.build, before.build + 1, 'a retheme is a rebuild — exactly one');
            assert.equal(after.series, before.series,
                'all ten series survived the rebuild, as they always did');
            assert.equal(after.vertical, before.vertical,
                'MEASURED BEFORE THE FIX: dark->light took the plot from four rules to A\'s '
                + 'one while every b:* series stayed drawn — the card re-issued #applyRules '
                + 'from .derivation (A alone) and the page\'s #appliedToken, which a retheme '
                + 'does not move, stopped the composition being re-laid');
            assert.equal(after.dashed, before.dashed, 'B\'s three are still dashed');
            assert.equal(after.faded, before.faded, 'and still faded (chart-C7)');
            assert.equal(after.labels, before.labels, 'the step names came across too');
            assert.deepEqual(after.colours, [after.boundary],
                'in the step-boundary token, read off the card that read it');
            assert.deepEqual(after.inks, [after.ink],
                'the step names took the NEW theme\'s label ink');
            assert.notDeepEqual(after.inks, before.inks,
                'and that ink really did move, so this is not a no-op flip');
            assert.deepEqual(page.pageErrors, []);
            assert.deepEqual(page.consoleErrors, []);

            await page.setTheme(start);
        });

        test('clearing B takes B\'s boundaries off the plot with B\'s curves', async () => {
            await staged();
            await page.eval(PICK_PAIR);
            const before = await page.eval(RULES_NOW);
            assert.equal(before.vertical, before.marks.a + before.marks.b);

            const cleared = await page.evalFn(async () => {
                const screen = document.querySelector('history-screen');
                const select = screen.renderRoot.getElementById('select-b');
                select.value = '';
                select.dispatchEvent(new CustomEvent('change', {
                    bubbles: true, composed: true, detail: { value: '' },
                }));
                await screen.updateComplete;
                const flow = screen.renderRoot.querySelector('history-flow-page');
                for (let i = 0; i < 60; i += 1) {
                    await new Promise((r) => setTimeout(r, 10));
                    if (!flow.derivationB) break;
                }
                await flow.updateComplete;
                await new Promise((r) => requestAnimationFrame(r));
                return { b: screen.shotB, derivationB: Boolean(flow.derivationB) };
            });
            assert.equal(cleared.derivationB, false, 'the comparison really is gone');

            const after = await page.eval(RULES_NOW);
            assert.equal(after.series, before.series - TOP_CHANNELS,
                `B's ${TOP_CHANNELS} series left the plot`);
            assert.equal(after.vertical, before.marks.a,
                'MEASURED BEFORE THE FIX: setRules sat inside `if (hasComparison)`, so '
                + 'nothing re-issued A-only rules and three dashed, faded boundaries stayed '
                + 'stroked over a chart that no longer had the shot they belong to');
            assert.equal(after.dashed, 0, 'nothing on the plot is dashed any more');
            assert.equal(after.faded, 0, 'and nothing is faded');
            assert.equal(after.labels, before.labels, 'A\'s own step names are untouched');
            assert.deepEqual(page.pageErrors, []);
            assert.deepEqual(page.consoleErrors, []);
        });

        test('a machine that answered 500 says so, in its own words, on both pages', async () => {
            await page.mount(SCREEN_STAGE, MODULES);
            const seen = await page.evalFn(async () => {
                const screen = document.querySelector('history-screen');
                window.__calls = [];
                screen.boot = {
                    transport: {
                        request: async (route) => {
                            window.__calls.push(route);
                            return { ok: false, status: 500, message: 'the machine said no', data: null };
                        },
                    },
                };
                await screen.updateComplete;
                for (let i = 0; i < 40; i += 1) {
                    await new Promise((r) => setTimeout(r, 10));
                    if (window.__calls.length) break;
                }
                await new Promise((r) => setTimeout(r, 30));
                await screen.updateComplete;
                const flow = screen.renderRoot.querySelector('history-flow-page');
                const data = screen.renderRoot.querySelector('history-data-page');
                await flow.updateComplete;
                await data.updateComplete;
                /* THE RENDERED WORDS, not the attribute they were passed in: each refusal
                 * is read out of the empty state's OWN shadow tree. */
                const read = (host) => [...host.renderRoot.querySelectorAll('ui-empty-state')]
                    .map((el) => el.renderRoot.textContent.replace(/\s+/g, ' ').trim());
                return {
                    calls: window.__calls.length,
                    options: screen.renderRoot.getElementById('select-a').options.length,
                    flow: read(flow),
                    data: read(data),
                    shown: [...flow.renderRoot.querySelectorAll('ui-empty-state')].map((el) => {
                        const heading = el.renderRoot.getElementById('heading');
                        return Boolean(el.checkVisibility()) && heading.getBoundingClientRect().width > 0;
                    }),
                };
            });

            assert.equal(seen.calls, 1, 'one request was made and it failed');
            assert.equal(seen.options, 0, 'so there is nothing to pick — as before');
            for (const text of seen.flow) {
                assert.match(text, /the machine said no/,
                    'the machine\'s own sentence, verbatim: not re-worded, not swallowed');
                assert.match(text, /answered 500/, 'and what it answered');
                assert.doesNotMatch(text, /No shot selected/,
                    'MEASURED BEFORE THE FIX: this said "No shot selected", which a machine '
                    + 'with an empty database says too');
            }
            assert.ok(seen.shown.filter(Boolean).length >= 1,
                `the refusal has to be readable somewhere: ${JSON.stringify(seen.shown)}`);
            assert.match(seen.data.at(-1), /the machine said no/,
                'the shot list says why it is empty instead of "No shots recorded yet"');
            assert.match(seen.data.at(-1), /answered 500/);
            for (const text of seen.data.slice(0, -1)) {
                assert.doesNotMatch(text, /the machine said no/,
                    'a phase table with no shot PICKED still says so — "No shot selected" is '
                    + 'true there, and a failure is only reported where it is the answer');
            }
            assert.deepEqual(page.pageErrors, [], 'nothing threw');
            assert.deepEqual(page.consoleErrors, [], 'and nothing was logged in place of rendering');
        });

        test('two screens on one page hold independent selections and offsets', async () => {
            await page.mount(`
<div id="stage" style="inline-size: 100%; block-size: 100dvh; display: grid; grid-template-rows: 1fr 1fr">
  <history-screen id="one"></history-screen>
  <history-screen id="two"></history-screen>
</div>`, MODULES);

            const independent = await page.evalFn(async (shotA, shotB) => {
                const key = (route) => (route === '/shots'
                    ? 'api__v1__shots~limit=20~offset=0~order=desc.json'
                    : 'api__v1__shots__' + route.slice('/shots/'.length) + '.json');
                const boot = () => ({
                    transport: {
                        request: async (route) => {
                            const res = await fetch('/tools/rea-fixtures/' + key(route), { cache: 'no-store' });
                            if (!res.ok) return { ok: false, status: 404, message: 'none', data: null };
                            return { ok: true, status: 200, data: await res.json(), notModified: false };
                        },
                    },
                });
                const screens = [...document.querySelectorAll('history-screen')];
                for (const screen of screens) { screen.boot = boot(); await screen.updateComplete; }
                for (let i = 0; i < 60; i += 1) {
                    await new Promise((r) => setTimeout(r, 10));
                    if (screens.every((s) => s.renderRoot.getElementById('select-a')?.options?.length)) break;
                }
                const pick = async (screen, id, value) => {
                    const select = screen.renderRoot.getElementById(id);
                    select.value = value;
                    select.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true, detail: { value } }));
                    await screen.updateComplete;
                };
                /* BOTH SCREENS OPEN THEIR COMPARISON. The claim below is that two
                 * instances hold separate state; that only means anything with the
                 * comparison controls on both. */
                for (const s of screens) { s.comparing = true; }
                await Promise.all(screens.map((s) => s.updateComplete));
                await pick(screens[0], 'select-a', shotA);
                await pick(screens[0], 'select-b', shotB);
                await pick(screens[1], 'select-a', shotB);
                const slide = async (screen, value) => {
                    const bar = screen.renderRoot.getElementById('compare');
                    const input = bar.renderRoot.getElementById('slider').renderRoot.querySelector('input[type=range]');
                    input.value = String(value);
                    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                    await screen.updateComplete;
                };
                await slide(screens[0], 4.2);
                await slide(screens[1], -1.5);
                for (let i = 0; i < 40; i += 1) await new Promise((r) => setTimeout(r, 10));
                return screens.map((s) => ({
                    a: s.shotA, b: s.shotB, offset: s.offset,
                    page: s.renderRoot.querySelector('history-flow-page').offset,
                }));
            }, SHOT_A, SHOT_B);

            assert.equal(independent[0].a, SHOT_A);
            assert.equal(independent[0].b, SHOT_B);
            assert.equal(independent[0].offset, 4.2);
            assert.equal(independent[1].a, SHOT_B);
            assert.equal(independent[1].b, '', 'the second screen has no comparison');
            assert.equal(independent[1].offset, -1.5);
            assert.equal(independent[0].page, 4.2, 'and each page has its own screen\'s offset');
            assert.equal(independent[1].page, -1.5);
        });

        test('the compare bar takes no box on the data page and the page takes the pixels', async () => {
            await staged();
            await page.eval(PICK_PAIR);
            const swapped = await page.evalFn(async () => {
                const screen = document.querySelector('history-screen');
                const read = () => ({
                    bar: +screen.renderRoot.getElementById('compare').getBoundingClientRect().height.toFixed(2),
                    region: +screen.renderRoot.getElementById('page').getBoundingClientRect().height.toFixed(2),
                });
                const flow = read();
                screen.page = 'data';
                await screen.updateComplete;
                await new Promise((r) => requestAnimationFrame(r));
                const data = read();
                return { flow, data };
            });
            assert.ok(swapped.flow.bar > 0, 'the bar is there on the chart page');
            assert.equal(swapped.data.bar, 0,
                'a table has no time axis to slide, so the bar is not shown at all');
            near(swapped.data.region, swapped.flow.region + swapped.flow.bar,
                'and the page took every pixel the bar gave up', 1);
        });

        test('the screen opens on ONE shot: no B picker, no alignment bar', async () => {
            await page.mount(SCREEN_STAGE, MODULES);
            await page.eval(BOOT);
            const seen = await page.evalFn(() => {
                const screen = document.querySelector('history-screen');
                return {
                    comparing: screen.comparing,
                    shotA: Boolean(screen.shotA),
                    shotB: screen.shotB,
                    pickerA: Boolean(screen.renderRoot.getElementById('select-a')),
                    pickerB: Boolean(screen.renderRoot.getElementById('select-b')),
                    bar: Boolean(screen.renderRoot.getElementById('compare')),
                    ask: Boolean(screen.renderRoot.getElementById('compare-open')),
                };
            });
            assert.equal(seen.shotA, true, 'it still opens ON a shot');
            assert.equal(seen.shotB, '');
            assert.equal(seen.pickerA, true, 'and A is still how you change which one');
            assert.equal(seen.pickerB, false, 'B is ABSENT, not disabled');
            assert.equal(seen.bar, false, 'and so is the slider that would have nothing to slide');
            assert.equal(seen.ask, true, 'comparing is one press away');
        });

        test('asking for a comparison brings both back, and clearing B puts them away',
            async () => {
                await page.mount(SCREEN_STAGE, MODULES);
                await page.eval(BOOT);
                const opened = await page.evalFn(async () => {
                    const screen = document.querySelector('history-screen');
                    screen.renderRoot.getElementById('compare-open')
                        .shadowRoot.querySelector('button').click();
                    await screen.updateComplete;
                    return {
                        pickerB: Boolean(screen.renderRoot.getElementById('select-b')),
                        bar: Boolean(screen.renderRoot.getElementById('compare')),
                        ask: Boolean(screen.renderRoot.getElementById('compare-open')),
                    };
                });
                assert.deepEqual(opened, { pickerB: true, bar: true, ask: false });

                const cleared = await page.evalFn(async () => {
                    const screen = document.querySelector('history-screen');
                    const select = screen.renderRoot.getElementById('select-b');
                    select.value = '';
                    select.dispatchEvent(new CustomEvent('change', {
                        bubbles: true, composed: true, detail: { value: '' },
                    }));
                    await screen.updateComplete;
                    return {
                        comparing: screen.comparing,
                        pickerB: Boolean(screen.renderRoot.getElementById('select-b')),
                        bar: Boolean(screen.renderRoot.getElementById('compare')),
                    };
                });
                /* "No comparison" is the way back, and leaving an empty picker beside a
                 * dead slider after it is the state this pair exists to avoid. */
                assert.deepEqual(cleared, { comparing: false, pickerB: false, bar: false });
            });
    });
}
