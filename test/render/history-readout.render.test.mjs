/**
 * history-readout.render.test.mjs — the cursor's other half, on the two History pages.
 * Audit F-032 (a scrub names no value), F-034 (the trajectory well swallows the gesture),
 * F-002 / F-006 (the two silent wires that sit exactly here) and F-016 rows 3-6 (the four
 * history plot wells with no accessible name).
 *
 * WHAT FAILED BEFORE. Every assertion in this file was written against the measured
 * tree of 29 August 2026, in which:
 *
 *   - on all three time charts, at five pointer positions, `legend.values` was null, the
 *     card's `.foot` strip was 0px high with empty `textContent`, and the card's whole
 *     shadow root's `textContent` was empty — read RAW, including the aria-hidden nodes,
 *     so the silence was the card's and not the reader's;
 *   - on `plot-pq` the card's ENTIRE shadow markup was byte-identical across hover,
 *     press, two moves and release — same 16 descendants, `div.cursor[hidden]` still
 *     carrying its `hidden` attribute at every step;
 *   - every one of those wells resolved to the empty accessible name.
 *
 * A8. Nothing here opens a file. Every claim is a live property read off a running
 * element, a computed style, a rendered box, or a node from Chrome's own accessibility
 * tree.
 *
 * THE PLOTS ARE ARMED BEFORE THEY ARE SCRUBBED. A chart card with no derivation has no
 * uPlot instance at all, so a pointer on it would be a pointer on nothing; both stages
 * below feed two real recorded shots from `tools/rea-fixtures/` and wait for the cards'
 * `ready` before a mouse moves.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';
import { accessibleNames } from '../harness/editor.js';
import { FLOW_PLOTS } from '../../src/lib/history-series.js';

const SHOT_A = '/tools/rea-fixtures/api__v1__shots__5fc3f631-6b18-471b-9800-00d552dbbecb.json';
const SHOT_B = '/tools/rea-fixtures/api__v1__shots__d5139a1f-c4ee-47e2-bb80-0cbf3e39b6a3.json';

/** One page, at a height that keeps BOTH plots on the glass (above the branch). */
const pageStage = (tag, h = 700) => `
<div id="stage" style="inline-size: 1100px; block-size: ${h}px; display: grid;
     grid-template-rows: minmax(0,1fr); grid-template-columns: minmax(0,1fr)">
  <${tag} id="page-under-test"></${tag}>
</div>`;

/**
 * Feed a page two real derivations and wait for every card it holds to be built.
 *
 * WITH THE SERVER'S OWN DERIVED CHANNELS APPLIED, which is `history-power.render`'s own
 * `FEED` verbatim and for its stated reason: the recordings predate ReaPrime's
 * recompute-on-read getters, so a raw fixture serves no resistance, impedance or power at
 * all and the derived card correctly refuses. Nothing under `src/` computes any of the
 * three — this is the SERVER's arithmetic, applied where a server would apply it.
 */
const FEED = (tag) => `(async () => {
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
  const page = document.querySelector('${tag}');
  page.derivationA = deriveFromRecord(upgrade(a));
  page.derivationB = deriveFromRecord(upgrade(b));
  page.offset = 0;
  await page.updateComplete;
  const cards = [...page.renderRoot.querySelectorAll('ui-chart-card')];
  await Promise.all(cards.map((c) => c.ready));
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
  return { ok: page.derivationA.ok, cards: cards.length };
})()`;

/** Everything one card is SAYING right now, read raw through the shadow boundary. */
const READ = (tag, id) => `(() => {
  const page = document.querySelector('${tag}');
  const card = page.renderRoot.getElementById('${id}');
  const legend = card.querySelector('ui-chart-legend');
  const foot = card.querySelector('[slot="foot"]');
  const cursorEl = card.renderRoot.querySelector('.cursor');
  return {
    values: legend ? { ...(legend.values ?? {}) } : null,
    chips: legend
      ? [...legend.renderRoot.querySelectorAll('.value')].map((n) => n.textContent.trim())
      : null,
    foot: foot ? foot.textContent.trim() : null,
    footBox: foot ? +foot.getBoundingClientRect().height.toFixed(2) : null,
    cursor: { ...card.cursor, values: { ...card.cursor.values } },
    hidden: cursorEl.hidden,
    shape: cursorEl.dataset.shape ?? null,
    x: cursorEl.style.getPropertyValue('--_ui-chart-cursor-x'),
  };
})()`;

let browser;
before(async () => { browser = await launch({ geometry: BENCH }); });
after(async () => { await browser.close(); });

const mounted = (tag, fn, h = 700) => browser.withPage({ geometry: BENCH }, async (page) => {
    await page.mount(pageStage(tag, h), [`/src/screens/${tag}.js`]);
    const fed = await page.eval(FEED(tag));
    assert.equal(fed.ok, true, 'the fixture must derive, or nothing below is about a chart');
    await fn(page);
});

/** Sweep the pointer across a well and read the card at every stop. */
async function sweep(page, wellSelector, readExpr, stops = 5) {
    const box = await page.box(wellSelector);
    const out = [];
    for (let i = 1; i <= stops; i += 1) {
        const x = box.left + (box.width * i) / (stops + 1);
        const y = box.top + box.height / 2;
        await page.mouse('mouseMoved', x, y);
        out.push(await page.eval(readExpr));
    }
    return out;
}

describe('the History cursor readout', () => {
    describe('the flow page\'s two time charts (F-032)', () => {
        for (const plot of FLOW_PLOTS) {
            test(`${plot.id}: a scrub names the numbers the chart drew, and clears on leave`,
                () => mounted('history-flow-page', async (page) => {
                    const card = `#page-under-test >>> #plot-${plot.id}`;
                    const read = READ('history-flow-page', `plot-${plot.id}`);

                    const resting = await page.eval(read);
                    assert.deepEqual(resting.values, {},
                        'before the drag the card names no cursor value');
                    assert.equal(resting.foot, '');

                    const readings = await sweep(page, `${card} >>> .well`, read);

                    assert.ok(readings.every((r) => r.cursor.active),
                        `the cursor must be live at every swept point: ${
                            JSON.stringify(readings.map((r) => r.cursor.idx))}`);

                    /* THE VALUES ARE NAMED — the half F-032 measured as missing. */
                    for (const r of readings) {
                        assert.ok(Object.keys(r.values).length > 0,
                            `legend.values is still empty at idx ${r.cursor.idx}`);
                        assert.ok(r.chips.length > 0,
                            'and the chips must actually print them, not merely hold them');
                        assert.ok(r.foot.length > 0, 'the foot names the reading');
                        assert.match(r.foot, /\d s$/, 'ending in the second it belongs to');
                    }

                    /* AND THEY TRACK. Same claim as the index: a readout that never
                     * changed would be a readout of the first sample, forever. */
                    const printed = readings.map((r) => JSON.stringify(r.values));
                    assert.ok(new Set(printed).size > 1,
                        `the values must change as the pointer moves: ${printed.join(' | ')}`);

                    /* THE ANNOUNCED STRIP COSTS NO LAYOUT — it is a live region, not a
                     * row: a visible foot would take its height out of the plot under
                     * the finger reading it. */
                    assert.equal(readings[0].footBox, 0);

                    /* LIFTING THE POINTER CLEARS IT (the intent's own second half). */
                    const box = await page.box(`${card} >>> .well`);
                    await page.mouse('mouseMoved', box.left - 40, box.top - 40);
                    const after = await page.eval(read);
                    assert.equal(after.cursor.active, false);
                    assert.deepEqual(after.values, {});
                    assert.equal(after.foot, '');
                }));
        }

        test('a chip turned OFF stops naming a number, and turning it back on restores it (F-006)',
            () => mounted('history-flow-page', async (page) => {
                const card = '#page-under-test >>> #plot-top';
                const chip = `${card} ui-chart-legend >>> #chip-pressure`;
                const read = READ('history-flow-page', 'plot-top');
                const box = await page.box(`${card} >>> .well`);
                /* THE POINTER GOES BACK TO THE WELL AFTER EACH PRESS, and it has to: a
                 * real press on a chip moves the mouse off the plot, which is a
                 * `pointerleave` and clears the cursor by design. The sequence a person
                 * performs is press-then-scrub, so that is the sequence asserted. */
                const scrub = async () => {
                    await page.mouse('mouseMoved',
                        box.left + box.width / 2, box.top + box.height / 2);
                    return page.eval(read);
                };

                const before = await scrub();
                assert.ok(Object.hasOwn(before.values, 'pressure'),
                    'the chart draws pressure, so the reading names it');
                const named = Object.keys(before.values).length;
                assert.ok(named > 1, 'and it names more than the one channel');

                /* A REAL PRESS on the chip, through Chrome's own hit test. The legend is
                 * BOUND, so it applies the hide to the plot itself; what `legend-change`
                 * buys is the page dropping that channel from the reading. */
                await page.click(chip);
                await page.settle();
                const off = await scrub();
                assert.equal(Object.hasOwn(off.values, 'pressure'), false,
                    'a channel the plot is no longer drawing must not still be named — '
                    + '"the same numbers the chart drew" would stop being true');
                assert.equal(Object.keys(off.values).length, named - 1,
                    'and ONLY that channel drops out');

                await page.click(chip);
                await page.settle();
                const back = await scrub();
                assert.ok(Object.hasOwn(back.values, 'pressure'),
                    'showing the trace again brings its number back');
            }));
    });

    describe('the power page', () => {
        test('the derived chart names R and Z in their REAL units, not the log the axis is in',
            () => mounted('history-power-page', async (page) => {
                const read = READ('history-power-page', 'plot-derived');
                const readings = await sweep(
                    page, '#page-under-test >>> #plot-derived >>> .well', read);
                const named = readings.filter((r) => Object.keys(r.values).length > 0);
                assert.ok(named.length > 0,
                    `the derived chart named nothing anywhere: ${
                        JSON.stringify(readings.map((r) => r.cursor.idx))}`);
                for (const r of named) {
                    for (const [key, text] of Object.entries(r.values)) {
                        const value = Number(text);
                        assert.ok(Number.isFinite(value), `${key} read as ${text}`);
                        /* THE PLOT IS FED log10 VALUES and the readout must not be. A
                         * log-scale reading of this pair is negative for most of a shot
                         * (the suite's own fixture bottoms at -2.4); a real one cannot
                         * be, because R and Z are ratios of positive quantities. */
                        assert.ok(value >= 0,
                            `${key} read ${text} — that is the log10 the axis is in, not `
                            + 'the number the machine reported');
                    }
                }
            }));

        test('the trajectory well answers the gesture at all, and names three things (F-034)',
            () => mounted('history-power-page', async (page) => {
                const read = READ('history-power-page', 'plot-pq');
                const resting = await page.eval(read);
                assert.equal(resting.hidden, true, 'no pointer, no mark');
                assert.equal(resting.foot, '');
                assert.ok(resting.footBox > 0,
                    'the reading strip reserves its height at rest, so text appearing on '
                    + 'pointerdown does not take it out of the plot under the finger');

                const readings = await sweep(
                    page, '#page-under-test >>> #plot-pq >>> .well', read);

                assert.ok(readings.every((r) => r.cursor.active),
                    'the press used to be swallowed entirely: the card\'s whole shadow '
                    + 'markup was byte-identical across the gesture');
                assert.ok(readings.every((r) => r.hidden === false),
                    'and the cursor must be shown, not merely computed');
                assert.ok(readings.every((r) => r.shape === 'point'),
                    'a chart whose x is flow marks a POINT, not a vertical instant');

                for (const r of readings) {
                    const parts = r.foot.split('·').map((s) => s.trim());
                    assert.equal(parts.length, 3,
                        `pressure, flow and time — got ${JSON.stringify(r.foot)}`);
                    assert.match(parts[0], /^Pressure \d+(\.\d+)? bar$/);
                    assert.match(parts[1], /^Flow \d+(\.\d+)? mL\/s$/);
                    assert.match(parts[2], /^\d+(\.\d+)? s$/);
                }

                const idxs = readings.map((r) => r.cursor.idx);
                assert.ok(new Set(idxs).size > 1,
                    `the mark must follow the pointer, not sit on one point: ${idxs}`);
                const xs = readings.map((r) => r.x);
                assert.ok(new Set(xs).size > 1,
                    `and its painted position must move with it: ${xs.join(' | ')}`);
            }));

        test('the trajectory cursor names A\'s OWN points, not a position it invented',
            () => mounted('history-power-page', async (page) => {
                /* The mark can only land on a point the plot drew: `cursorPoints` is the
                 * same array `setBands` was handed. `#readPoint` is asserted directly, on
                 * a hand-made geometry, in ui-chart-card-scrub.render.test.mjs; what this
                 * asserts is that the page fed the card the RIGHT array. */
                const box = await page.box('#page-under-test >>> #plot-pq >>> .well');
                await page.mouse('mouseMoved',
                    box.left + box.width * 0.5, box.top + box.height * 0.5);
                const got = await page.eval(`(() => {
                  const p = document.querySelector('history-power-page');
                  const card = p.renderRoot.getElementById('plot-pq');
                  const point = card.cursor.point;
                  const source = card.cursorPoints[card.cursor.idx];
                  return { point, source, count: card.cursorPoints.length };
                })()`);
                assert.ok(got.count > 0, 'the page must have fed the card its path');
                assert.deepEqual(got.point, got.source,
                    'the mark stands on the point at that index of the drawn path');
            }));
    });

    describe('the plot wells are named (F-016 rows 3-6)', () => {
        for (const [tag, ids] of [
            ['history-flow-page', ['plot-top', 'plot-temp']],
            ['history-power-page', ['plot-derived', 'plot-pq']],
        ]) {
            test(`${tag}: every well carries a non-empty accessible name`,
                () => mounted(tag, async (page) => {
                    const names = await accessibleNames(page);
                    const groups = names.filter((n) => n.role === 'group').map((n) => n.name);
                    for (const id of ids) {
                        const label = await page.evalFn((sel) => {
                            const el = window.__h.need(sel);
                            return { role: el.getAttribute('role'), name: el.getAttribute('aria-label') };
                        }, `#page-under-test >>> #${id} >>> .well`);
                        assert.equal(label.role, 'group',
                            'a bare div maps to `generic`, a role that takes no name at all');
                        assert.ok(label.name && label.name.length > 0,
                            `${id}'s well has no name`);
                        assert.ok(groups.includes(label.name),
                            `${id}'s name never reached the accessibility tree: `
                            + `${JSON.stringify(groups)}`);
                        /* D16, BEN, 30 AUGUST 2026: the five scrub names were shortened
                         * from "{chart name} — chart scrub" to "{chart name} scrub". This
                         * line read `assert.match(label.name, /chart scrub$/, …)` and
                         * pinned the superseded wording; the claim it makes is unchanged —
                         * the well is named for the CONTROL, not just for the chart — so
                         * the pattern moves and the sentence stays. */
                        assert.match(label.name, / scrub$/,
                            'and it names the CONTROL — the scrub — not just the chart');
                        assert.doesNotMatch(label.name, /— chart scrub$/,
                            'the long form is retired, not merely tolerated');
                    }
                }));
        }
    });
});
