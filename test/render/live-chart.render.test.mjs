/**
 * live-chart.render.test.mjs — the chart card ON THE LIVE SCREEN, in a real engine, at
 * both Gate A geometries (BENCH 1281×801 @ dsf 1.5, FLOOR 1000×600 @ dsf 1).
 *
 * WHAT THIS SUITE OWNS THAT `ui-chart-card.render.test.mjs` DOES NOT. That one proves
 * the COMPONENT, in a stage sized by the test. This one proves the INTEGRATION: the
 * same card in the box the Live skeleton gives it (§4.1's single `1fr` row), fed by a
 * shot buffer through gate 6's derivation, with the screen's own additions around it —
 * the refusal words, the aria-live summary, and the fact that the screen states no
 * channel and no colour of its own.
 *
 * The distinction is not academic. The spike's finding is that a chart which has lost
 * the vendor stylesheet renders PIXEL-IDENTICALLY and is dead to the touch, and a card
 * that mounts correctly on a bench stage can still meet a screen that pads its host,
 * wraps it in a box with a min-height, or hands it a derivation a frame too late. So
 * every assertion here is made on the MOUNTED SCREEN: computed style, measured
 * geometry, painted canvas pixels, or behaviour under real CDP input.
 *
 * THE CHART-C ITEMS THIS SCREEN CLOSES (SCOPE.md:1997-2003, §7.8):
 *   chart-C1   the y ceiling is component state and grows with the shot
 *   chart-C2   a theme switch mid-shot keeps every step boundary
 *   chart-C9   no dead weight on the 15 Hz path: N samples in a turn, one paint
 *   chart-C10  the legend is part of the layout — measured after it exists, not before
 *   chart-C11  a ResizeObserver on the component's own host, mandatory
 *   chart-C12  ONE pixelRatio, owned by the component
 *   chart-C13  the chart never reads another component's rendered DOM
 *   chart-C14  the canvas gets a text alternative and an aria-live summary
 * (chart-C4 was closed before this screen existed — under A6 a chart token with zero
 * consumers cannot recur; it is listed in the digest, not asserted here.)
 *
 * THE LAST DESCRIBE IS DRIVEN BY THE WEBSOCKET MOCK, end to end: `tools/mock_rea.py`
 * streams the recorded shot over `/ws/v1/machine/snapshot`, the real socket layer and
 * the real stores carry it, and the SCALE goes away mid-shot. What must appear on the
 * canvas is a GAP — the one thing a chart must never invent its way across.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { launch, GATE_A_GEOMETRIES } from '../harness/index.js';
import { assertTokenDrill, DRILL_COLOUR } from '../harness/assertions.js';
import { channelNameFor, channelToken } from '../../src/lib/chart-tokens.js';

const REPO = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const MODULE = ['/src/screens/live-screen.js'];

/**
 * THE CARD'S OWN LIST, READ OUT OF THE ENGINE RATHER THAN RETYPED HERE.
 *
 * `ui-chart-card.js` imports `lit`, so node cannot import it the way this file imports
 * `chart-tokens.js`; the module only resolves inside the page, against index.html's
 * importmap. `history-series.test.mjs` says exactly what follows from that — "this module
 * is DOM-free and cannot import a component, so the test states the same shape
 * `DEFAULT_CHANNELS` has rather than importing it ... Reading the card's own export is the
 * render suite's job, in an engine (A8)."
 *
 * This is that job. A second copy of the channel list living in a test is the same defect
 * as a second copy living in a screen — §6.2's "the legend and the trace part company",
 * entered from the test end — and it has already cost this file once: the list was retyped
 * as five keys, Ben's 25 August group-temperature ruling took it to seven, and the suite
 * failed describing a chart that was drawing exactly what he asked for.
 */
const DEFAULT_CHANNELS_IN_PAGE = `(async () => {
    const { DEFAULT_CHANNELS } = await import('/src/components/ui-chart-card.js');
    return DEFAULT_CHANNELS.map((c) => ({ key: c.key, factor: c.factor ?? null }));
})()`;

const defaultChannels = (page) => page.eval(DEFAULT_CHANNELS_IN_PAGE);

/** The stage the skeleton's own suite uses: a definite height, so §4.1's `100%` means
 *  something and a geometry change moves the screen the way a window resize does. */
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"><live-screen></live-screen></div>';

/** The same real recorded shot the card's suite draws: 426 measurements, 336 in-shot,
 *  22.3 s, two profile steps. A hand-built sample can only contain what its author
 *  already believed. */
const SHOT_URL = '/tools/rea-fixtures/api__v1__shots__cd020a51-f353-4ffb-8389-72c931640181.json';

const SCREEN = 'live-screen';
const CARD = `${SCREEN} >>> ui-chart-card`;
const PLOT = `${CARD} >>> .plot`;
const CANVAS = `${CARD} >>> canvas`;
const SUMMARY = `${SCREEN} >>> [slot="foot"]`;

const near = (got, want, what, tol = 1.01) => assert.ok(
    Math.abs(got - want) <= tol,
    `${what}: expected ${want}, got ${got}`,
);

/**
 * Feed the screen the way the wiring row will: ONE shot buffer on `screen.shot`.
 *
 * The buffer is filled by hand here — `open()` is the seam that exists for exactly this
 * — because the socket road is the last describe's job and everything before it is
 * about the chart's box, its colours and its behaviour rather than about transport.
 */
const FEED = (count = null) => `(async () => {
    const { createShotBuffer } = await import('/src/stores/shot-buffer.js');
    const record = await (await fetch('${SHOT_URL}')).json();
    const screen = document.querySelector('live-screen');
    await screen.updateComplete;
    const card = screen.shadowRoot.querySelector('ui-chart-card');
    await card.ready;
    const buffer = createShotBuffer({});
    buffer.open(record.id, {});
    const n = ${count === null ? 'record.measurements.length' : count};
    for (let i = 0; i < n; i += 1) buffer.addSample(record.measurements[i]);
    window.__live = { buffer, record, screen, card, fed: n };
    screen.shot = buffer;
    await screen.updateComplete;
    await card.updateComplete;
    card.drawNow();
    return {
        ok: card.derivation.ok,
        inShot: card.derivation.counts.inShot,
        steps: card.derivation.stepMarks.length,
        channels: card.channels.map((c) => c.key),
        sheetAdopted: card.sheetAdopted,
        hasPlot: Boolean(card.plotHandle),
        mountError: card.mountError ? String(card.mountError.message ?? card.mountError) : null,
        empty: card.hasAttribute('empty'),
        hasLegend: card.hasAttribute('has-legend'),
        derivationIsScreens: screen.derivation === card.derivation,
    };
})()`;

const feed = (page, count = null) => page.eval(FEED(count));

/** Add more of the recorded shot, then let one frame pass. */
const GROW = (to) => `(async () => {
    const { buffer, record, card, fed } = window.__live;
    for (let i = fed; i < ${to}; i += 1) buffer.addSample(record.measurements[i]);
    window.__live.fed = ${to};
    const frame = () => new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d)));
    await frame();
    await card.updateComplete;
    card.drawNow();
    return { inShot: card.derivation.counts.inShot, yMax: card.yMax, xRange: card.xRange };
})()`;

/** Drill pixels currently on the canvas — the A6 instrument, counted rather than seen. */
const countDrill = (page, selector = CANVAS) => page.evalFn((s) => {
    const canvas = window.__h.need(s);
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 170 && data[i + 3] > 200) n += 1;
    }
    return n;
}, selector);

const cursor = (page) => page.evalFn((s) => {
    const el = window.__h.need(s);
    return { ...el.cursor, values: { ...el.cursor.values } };
}, CARD);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const geometry of GATE_A_GEOMETRIES) {
    const dsf = geometry.deviceScaleFactor;

    describe(`Live's chart in situ @ ${geometry.name} (${geometry.width}x${geometry.height} @ dsf ${dsf})`, () => {

        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(STAGE, MODULE);
            await page.settle(4);
            assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
            return fn(page);
        });

        /* ================================================================
         * 1. THE MOUNT, IN THE SCREEN — the two spike rules, in situ
         * ============================================================== */

        test('the shot reaches the canvas: sheet adopted in the CARD\'s own root, plot built', () => mounted(async (page) => {
            const got = await feed(page);
            assert.equal(got.mountError, null);
            assert.equal(got.sheetAdopted, true,
                'Rule 1: the vendor sheet is in the shadow root that holds the plot — without it '
                + 'the chart renders perfectly and is dead to the touch');
            assert.equal(got.hasPlot, true);
            assert.equal(got.ok, true);
            assert.equal(got.inShot, 336, 'the whole recorded shot, through gate 6');
            assert.equal(got.empty, false, 'and the refusal is gone the moment there is a shot');
            /* THE SET IS THE CARD'S, AND IT IS READ RATHER THAN RETYPED — see
             * DEFAULT_CHANNELS_IN_PAGE at the top of this file for why that is the
             * assertion and not a spelt-out list.
             *
             * What this pins is a claim about the SCREEN, not about the card: live-screen
             * names no channel of its own, so whatever the card's own ordering says is
             * what reaches the canvas. It would fail the moment the screen started passing
             * `channelKeys` — which is the second copy §6.2 exists to prevent — and it
             * cannot fail merely because Ben changed his mind about which traces belong. */
            const defaults = await defaultChannels(page);
            assert.deepEqual(got.channels, defaults.map((c) => c.key),
                'the Live set is the CARD\'s DEFAULT_CHANNELS — the screen names no channel, '
                + 'because a second copy of the list is where the legend and the trace part company (§6.2)');

            /* AND THE TWO RULINGS THAT ORDERING CARRIES, stated as claims rather than as a
             * transcript of the array, because these are the things a future edit could
             * break without anyone noticing.
             *
             * NO WATTS — Ben, 25 August 2026: "Live chart is on the main page and shouldnt
             * show power." Power is the EXPANDED chart's and the history flow page's, where
             * `FLOW_TOP_CHANNELS` carries it; the treatment still lives in the card's keyed
             * CHANNEL_TREATMENTS so those surfaces draw it right, and only the ORDERING
             * dropped it. Slate's main page has no watts either.
             *
             * BOTH TEMPERATURES, AT A TENTH — Ben, same day: "Group temperature on the Live
             * chart, copy slates." Slate's SERIES_ORDER carries groupTemperature and
             * targetTemperature as its fifth and sixth series and `updateChart` divides
             * them by ten on the way in, so 90 C plots at 9 against an axis of bar and
             * mL/s. `factor: 0.1` is that division, and it is applied at the PLOT: assert
             * it here and the derivation is free to go on holding degrees for the gauge
             * above this chart and the phase table below it. A temperature that arrived
             * WITHOUT the factor would draw 88 against a 0-12 axis and take the shared
             * ceiling with it — the exact fault the 0.3.0 commit records finding. */
            assert.ok(!got.channels.includes('power'),
                'the Live card draws no power trace: it is the expanded chart\'s and the '
                + 'history flow page\'s, not the main page\'s');
            const factorOf = Object.fromEntries(defaults.map((c) => [c.key, c.factor]));
            assert.deepEqual(
                ['groupTemp', 'targetTemp'].map((k) => [k, got.channels.includes(k), factorOf[k]]),
                [['groupTemp', true, 0.1], ['targetTemp', true, 0.1]],
                'both temperatures are drawn, and both at Slate\'s own tenth');
            assert.equal(got.derivationIsScreens, true,
                'and the card is drawing the same bundle the screen holds, not a copy of it');
            assert.deepEqual(page.pageErrors, []);
        }));

        test('MOUNT SIGNATURE in situ: cssOverAsked is 1.0 and nothing leaves the card', (t) => mounted(async (page) => {
            await feed(page);
            const host = await page.box(PLOT);
            const canvas = await page.box(CANVAS);
            const frame = await page.box(`${CARD} >>> .frame`);
            const attrs = await page.evalFn((s) => {
                const c = window.__h.need(s);
                return { w: c.width, h: c.height };
            }, CANVAS);

            near(canvas.width / host.width, 1, 'cssOverAsked — the spike\'s strongest single number', 0.01);
            near(canvas.right - host.right, 0,
                'a healthy canvas overflows its host by 0px; the mount-C reading at this dpr would be '
                + `${(host.width * (dsf - 1)).toFixed(0)}px`, 1.5);
            near(attrs.w, host.width * dsf, 'the backing store is css × THIS plot\'s ratio', 2);
            assert.ok(canvas.bottom <= frame.bottom + 1,
                `the canvas is ${(canvas.bottom - frame.bottom).toFixed(1)}px below the frame drawn around it`);

            const card = await page.box(CARD);
            t.diagnostic(`${geometry.name}: card ${card.height.toFixed(2)}px · plot `
                + `${host.width.toFixed(2)}x${host.height.toFixed(2)} · canvas attr `
                + `${attrs.w}x${attrs.h} @ dsf ${dsf}`);

            const sheetReach = await page.computed(CANVAS, ['display', 'position']);
            assert.deepEqual(sheetReach, { display: 'block', position: 'relative' },
                'the document-sheet rule that cannot cross a shadow boundary — reading it here '
                + 'is reading Rule 1, and it discriminates at dsf 1 as well as 1.5');
        }));

        test('§6.1 rule 1: the plot host is unpadded, and the SCREEN adds nothing around the card', () => mounted(async (page) => {
            await feed(page);
            const pad = await page.computed(PLOT, [
                'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
            ]);
            assert.deepEqual(pad, {
                'padding-top': '0px', 'padding-right': '0px', 'padding-bottom': '0px', 'padding-left': '0px',
            }, 'uPlot sizes from the PADDING box, so a padded plot host overflows by exactly its padding');

            /* The screen's half of the same rule: <live-main>'s slot is `display: contents`,
             * so the CARD is the grid item and takes the 1fr row directly. A wrapper — the
             * reflex — would defeat the card's own floor from the outside. */
            const outer = await page.computed(CARD, [
                'padding-top', 'padding-left', 'margin-top', 'margin-left', 'display',
            ]);
            assert.deepEqual(outer, {
                'padding-top': '0px', 'padding-left': '0px', 'margin-top': '0px', 'margin-left': '0px',
                display: 'block',
            }, 'the screen gives the card a bare row: no inset, no correction margin');

            const parentTag = await page.evalFn((s) => {
                const card = window.__h.need(s);
                const slot = card.assignedSlot;
                return {
                    parent: card.parentElement.tagName.toLowerCase(),
                    slot: slot ? slot.name : null,
                    slotDisplay: slot ? getComputedStyle(slot).display : null,
                };
            }, CARD);
            assert.equal(parentTag.parent, 'live-main', 'the card is <live-main>\'s own child');
            assert.equal(parentTag.slot, 'chart');
            assert.equal(parentTag.slotDisplay, 'contents',
                'so the card itself is the grid item that owns the 1fr row');
        }));

        test('Rule 2: the axis face is the DOCUMENT\'s, measured rather than asked', () => mounted(async (page) => {
            await feed(page);
            const probe = await page.evalFn((s) => window.__h.need(s).axisFontProbe(), CARD);
            assert.equal(probe.registered, true,
                'a face declared only in a shadow root measures the same as a family that does '
                + 'not exist (105.00 vs 118.50 in the spike) — canvas resolves against the '
                + `DOCUMENT registry, so this is Rule 2 in one number: ${JSON.stringify(probe)}`);
            assert.notEqual(probe.width, probe.fallbackWidth,
                'the primary family measures differently from a family nothing can resolve');
            assert.equal(probe.painted, true,
                'and the family the token asks for is the family uPlot actually paints with');
        }));

        /* ================================================================
         * 2. B4 — THE AXIS IS ReaPrime's ARRIVAL STAMPS, ON THE CANVAS
         * ============================================================== */

        test('B4: the x axis plotted is arrival stamps minus the origin — no reconstruction', () => mounted(async (page) => {
            await feed(page);
            const got = await page.eval(`(async () => {
                const { card } = window.__live;
                const axis = card.derivation.axis;
                const data = card.plotHandle.raw.data[0];
                const gaps = [];
                for (let i = 1; i < axis.t.length; i += 1) gaps.push(+(axis.t[i] - axis.t[i - 1]).toFixed(4));
                let mismatched = 0;
                for (let i = 0; i < axis.t.length; i += 1) {
                    if (Math.round(axis.t[i] * 1000) !== axis.stampMs[i] - axis.originMs) mismatched += 1;
                }
                return {
                    originRule: axis.originRule,
                    points: axis.t.length,
                    plotted: data.length,
                    firstPlotted: data[0],
                    lastPlotted: data[data.length - 1],
                    lastT: axis.t[axis.t.length - 1],
                    distinctGaps: new Set(gaps).size,
                    minGap: Math.min(...gaps),
                    maxGap: Math.max(...gaps),
                    mismatched,
                    unplaceable: card.derivation.counts.unplaceable,
                    xRange: card.xRange,
                };
            })()`);

            assert.equal(got.originRule, 'firstPouringSample',
                'the origin is the machine\'s own first pouring sample, and the axis says which rule it used');
            assert.equal(got.mismatched, 0,
                'every plotted t is its own arrival stamp minus the origin, to the millisecond');
            assert.equal(got.plotted, got.points, 'and the plot draws exactly the stamped samples');
            assert.equal(got.unplaceable, 0);
            assert.ok(got.distinctGaps > 5,
                `the transport jitter is still there (${got.distinctGaps} distinct intervals) — a `
                + 'uniform grid on this axis would be the fabrication A7 names, and R4 is what '
                + 'replaces it with a machine clock');
            assert.ok(got.maxGap - got.minGap > 0.001,
                `intervals ${got.minGap}..${got.maxGap} are suspiciously even`);
            near(got.xRange[1], got.lastT, 'the visible range ends at the last real sample', 0.001);
        }));

        test('B6: the duplicated quantities are decided at shot start and HELD', () => mounted(async (page) => {
            await feed(page, 120);
            const early = await page.evalFn(() => ({
                sources: { ...window.__live.card.derivation.sources },
                heldBy: window.__live.card.derivation.sourcesHeldBy,
            }));
            await page.eval(GROW(426));
            const late = await page.evalFn(() => ({
                sources: { ...window.__live.card.derivation.sources },
                heldBy: window.__live.card.derivation.sourcesHeldBy,
            }));
            /* WHO holds the choice is a fact about the wiring, and today it is the
             * derivation: `createLiveStores` takes an optional B6 `sourceSelector` and the
             * app shell injects none, so `context.sources` is null and gate 6 makes the
             * choice itself "from the shot's own first evidence and holds it, which is the
             * same rule the buffer applies". One rule either way — what must never happen
             * is the answer MOVING mid-shot, which is the half this asserts. */
            assert.equal(early.heldBy, 'derivation',
                'with no selector injected, gate 6 decides from the first evidence and holds it');
            assert.ok(Object.keys(early.sources).length > 0, 'and it decided something');
            assert.deepEqual(late.sources, early.sources,
                'the choice does not move mid-shot — a switched source reads as a machine glitch (B6/R6)');
            assert.equal(late.heldBy, early.heldBy, 'and neither does who made it');
        }));

        /* ================================================================
         * 3. A6 / A5 — COLOUR AND IDENTITY COME FROM THE TOKENS
         * ============================================================== */

        test('a channel token drill reaches painted pixels ON THE MOUNTED SCREEN', () => mounted(async (page) => {
            await feed(page);
            assert.equal(await countDrill(page), 0, 'the drill colour must not already be on the canvas');

            await assertTokenDrill(page, {
                token: '--ui-channel-pressure',
                value: DRILL_COLOUR,
                read: async (p) => {
                    await p.evalFn((s) => { window.__h.need(s).drawNow(); return true; }, CARD);
                    return String(await countDrill(p) > 0);
                },
                expected: 'true',
            });
        }));

        test('every drawn channel takes its colour from the sheet, and the screen states none', () => mounted(async (page) => {
            await feed(page);
            const tokens = await page.evalFn((s) => {
                const card = window.__h.need(s);
                return {
                    channels: { ...card.chartTokens.channels },
                    surface: { ...card.chartTokens.surface },
                    drawn: card.channels.map((c) => c.key),
                };
            }, CARD);

            /* EVERY CHANNEL THE CARD ACTUALLY DREW, whichever ones those are.
             *
             * This loop used to walk a retyped list of five kebab-case token names, which
             * made it a THIRD copy of the channel set — after the card's DEFAULT_CHANNELS
             * and after this file's own retyped list further up — and the least honest of
             * the three, because a channel added to the ordering would still have been
             * absent here and the test would have gone on passing while saying "every
             * drawn channel". Ben's 25 August group-temperature ruling took the set to
             * seven and this assertion failed on the count alone, never reaching the
             * question it exists to ask.
             *
             * So the drawn keys come from the mounted card and `channelNameFor` does the
             * one translation there is — `chart-tokens.js`'s SERIES_KEY_CHANNELS, the seam
             * between gate 6's camelCase keys and CSS's lower-kebab names, whose own note
             * records that using a key as a name resolves to `undefined`, which uPlot
             * takes as "no stroke", which paints nothing and throws nothing. That module
             * is DOM-free, so unlike the card it imports here in node.
             *
             * The count is still pinned, against the card's own list rather than a
             * literal, because "every drawn channel" is only worth asserting if something
             * says how many that is. */
            const defaults = await defaultChannels(page);
            assert.deepEqual(tokens.drawn, defaults.map((c) => c.key),
                'the screen draws the card\'s own ordering and states no channel of its own');
            for (const name of tokens.drawn.map(channelNameFor)) {
                const declared = (await page.tokenValue(channelToken(name))).trim();
                assert.ok(declared.length > 0,
                    `every Live channel has a token in styles/chart-channels.css (A6): ${name}`);
                assert.equal(tokens.channels[name].trim(), declared,
                    'and the card READ it off this host\'s computed style rather than carrying a copy '
                    + '— which is the whole of A6, and the reverse of chart-palette.js injecting a '
                    + '<style> into <head> from JavaScript');
            }
            for (const part of ['well', 'grid', 'axis', 'label']) {
                assert.ok(tokens.surface[part], `the four surface tokens are read the same way: ${part}`);
            }
        }));

        /* ================================================================
         * 4. LIVENESS IN SITU — the pointer, on the screen
         * ============================================================== */

        test('POINTER SWEEP over the MOUNTED SCREEN: an ACTIVATING card runs no cursor', () => mounted(async (page) => {
            /* THIS ASSERTION INVERTED ON 24 AUGUST 2026, and it inverted on a report.
             *
             * Ben: "when I click on it initially I get a vertical line with circle for
             * 500ms or so, then it loads the history chart viewer. Two issues, it
             * shouldn't have any veryical line or delay just launch the full screen
             * chart."
             *
             * THE LINE AND THE DELAY WERE ONE DEFECT. The Live card is an ACTIVATOR — a
             * tap opens the expanded chart — and it was also running uPlot's cursor. So
             * the pointer-down drew the rule and its dot under the finger, and they sat
             * there for the length of the tap; the overlay then arrived on the click.
             * Nothing was actually slow. What read as a delay was a cursor drawn in the
             * gap between the two events.
             *
             * THE COVERAGE DID NOT GO AWAY, IT SWAPPED SIDES. `activate` gates the
             * listeners, so a card that does NOT activate still runs the cursor and is
             * still swept — on the History page, which is where a cursor is the point.
             * What this test protects now is that the Live card carries none.
             */
            await feed(page);
            const host = await page.box(PLOT);
            /* SWEEP THE PLOT AREA, NOT THE HOST BOX. The host includes uPlot's own axis
             * gutters — the y-axis labels down the left and the x-axis under the plot —
             * and a pointer in a gutter is outside the cursor's range by design, which
             * reads as `active: false` and is correct.
             *
             * IT ONLY BIT AT THE FLOOR, and only once the Live band's inset became
             * Slate's 57px (parity 7-live-polish, it19): the plot got narrower while the
             * y-axis gutter stayed the width its labels need, so the first of eight
             * samples — host.left + width/8 — moved from just inside the plot to just
             * inside the gutter. The sweep was measuring the wrong box the whole time
             * and the geometry change is what made that visible.
             *
             * `.u-over` IS that box, in CSS pixels, and it is uPlot's own name for it —
             * this component's own header already points at it ("a sweep across
             * `.u-over` at BOTH Gate A geometries"), so the sweep now reads the element
             * the cursor is actually bound to instead of the host that contains it. */
            const area = await page.evalFn((s) => {
                const el = window.__h.need(s);
                const over = el.shadowRoot
                    ? el.shadowRoot.querySelector('.u-over')
                    : el.querySelector('.u-over');
                const box = (over ?? el).getBoundingClientRect();
                return { left: box.left, top: box.top, width: box.width, height: box.height };
            }, PLOT);
            const readings = [];
            for (let i = 1; i <= 7; i += 1) {
                const x = area.left + (area.width * i) / 8;
                const y = area.top + area.height / 2;
                await page.mouse('mouseMoved', x, y);
                readings.push(await cursor(page));
            }

            assert.equal(await page.evalFn((s) => window.__h.need(s).activate === true, CARD), true,
                'the premise: the Live card is the one that activates');
            assert.ok(readings.every((r) => !r.active && r.idx === null),
                `an activating card must run NO cursor: ${JSON.stringify(readings.map((r) => r.idx))}`);

            /* AND THE GESTURE THE CURSOR WAS IN THE WAY OF STILL LANDS — on the click,
             * with no route change. The overlay is a property going true inside this
             * screen; a pushed `#/history` is the thing it exists not to do. */
            const hashBefore = await page.evalFn(() => location.hash);
            /* A REAL CLICK, not two raw events: `clickCount` is what makes Chrome
             * synthesise the `click` the card listens on (harness `click`, and the
             * pointer pair alone leaves clickCount at 0). */
            await page.click(PLOT);
            await page.settle(2);
            const opened = await page.evalFn((s) => {
                const screen = window.__h.need(s);
                const overlay = screen.renderRoot.querySelector('live-expanded-chart');
                return { open: overlay?.open === true, hash: location.hash };
            }, SCREEN);
            assert.equal(opened.open, true, 'one tap opens the expanded chart');
            assert.equal(opened.hash, hashBefore, 'and it is an overlay, not a route');

            const check = await page.evalFn((s) => window.__h.need(s).plotCoordinateCheck(), CARD);
            near(check.scaleX, 1, 'the two coordinate spaces uPlot\'s cursor mixes agree here', 0.01);
            near(check.scaleY, 1, 'in both axes', 0.01);
            assert.equal(check.pixelRatio, dsf);
        }));

        /* ================================================================
         * 5. THE CHART-C ITEMS, ON THIS SCREEN
         * ============================================================== */

        test('chart-C1: the y ceiling is COMPONENT STATE and grows with the shot', () => mounted(async (page) => {
            /* "The expanded chart's Y axis is frozen at build time — `range: () =>
             * spec.yScale.range` returns the same array forever, so a shot opened live
             * builds at [0, 12] and stays there for the whole pour, clipping any flow peak
             * above 12" (§7.8 C1). Here the ceiling is the surface's damped `yMax`, and the
             * proof is that a growing shot moves it without rebuilding the plot. */
            const early = await feed(page, 140);
            assert.ok(early.inShot > 0);
            const before = await page.evalFn(() => ({
                yMax: window.__live.card.yMax,
                build: window.__live.card.buildCount,
                peak: window.__live.card.derivation.scalars.peakPressure,
            }));
            const after = await page.eval(GROW(426));
            const state = await page.evalFn(() => ({
                yMax: window.__live.card.yMax,
                build: window.__live.card.buildCount,
                peak: window.__live.card.derivation.scalars.peakPressure,
                top: window.__live.card.plotHandle.raw.scales.y.max,
            }));

            assert.ok(after.inShot > early.inShot, 'the shot really grew');
            assert.ok(state.yMax >= before.yMax,
                `a frozen ceiling cannot follow a shot: ${before.yMax} -> ${state.yMax}`);
            assert.ok(state.top >= state.peak,
                `the drawn ceiling (${state.top}) clips the shot's own peak (${state.peak})`);
            assert.equal(state.build, before.build,
                'and none of that is a rebuild — a growing shot is DATA');
        }));

        test('chart-C2: a theme switch mid-shot keeps every step boundary', () => mounted(async (page) => {
            const got = await feed(page);
            assert.equal(got.steps, 2, 'the recorded shot has two profile steps');
            const before = await page.evalFn((s) => {
                const card = window.__h.need(s);
                return {
                    rules: card.plotHandle.state.vRules.map((r) => ({ x: r.x, color: r.color })),
                    labels: card.plotHandle.state.labels.map((l) => l.text),
                    build: card.buildCount,
                };
            }, CARD);
            const start = await page.evalFn(() => document.documentElement.getAttribute('data-theme'));

            await page.setTheme(start === 'dark' ? 'light' : 'dark');
            const after = await page.evalFn((s) => {
                const card = window.__h.need(s);
                return {
                    rules: card.plotHandle.state.vRules.map((r) => ({ x: r.x, color: r.color })),
                    labels: card.plotHandle.state.labels.map((l) => l.text),
                    build: card.buildCount,
                    inShot: card.derivation.counts.inShot,
                };
            }, CARD);

            assert.equal(after.rules.length, before.rules.length,
                'the boundaries survive the rebuild a retheme forces — Slate lost them because '
                + 'each theme owned its own shapes array (§7.8 C2)');
            assert.deepEqual(after.rules.map((r) => r.x), before.rules.map((r) => r.x),
                'at the same times');
            assert.deepEqual(after.labels, before.labels, 'with the same names');
            assert.equal(after.build, before.build + 1, 'exactly one rebuild');
            assert.equal(after.inShot, 336, 'and the shot is still on screen');
            assert.deepEqual(page.pageErrors, []);
        }));

        test('chart-C9: twenty samples inside one turn cost ONE derivation and ONE paint', () => mounted(async (page) => {
            /* MEASURED AGAINST A CONTROL WINDOW, BECAUSE THE CLAIM IS A MARGINAL COST.
             *
             * chart-C9 is "twenty samples cost ONE paint" — what the SAMPLES cost, not what
             * the card does in the same stretch of wall time for other reasons. A card on a
             * live screen has other invalidators: a ResizeObserver on its own host (C11), a
             * theme change, a scrollbar appearing somewhere above it. Counting every paint
             * in the window charges those to the samples.
             *
             * That is not hypothetical. This assertion failed roughly one run in three under
             * CPU contention on 27 August 2026 — two paints where it wanted one — and passed
             * every time on an idle box. A stolen timeslice lets an ambient invalidation land
             * inside the two-frame window, and the test then reports a coalescing failure
             * that did not happen.
             *
             * So the same window is run TWICE: once adding nothing, once adding twenty
             * samples, and what is asserted is the DIFFERENCE. Ambient paints appear in both
             * and cancel; a card that painted per sample would show twenty in the second and
             * none in the first. That is a strictly stronger claim than the old one, because
             * it can no longer be satisfied by an ambient paint being miscounted as the
             * sample's — and it is deterministic, because it no longer depends on the box
             * being quiet. */
            await feed(page, 200);
            const got = await page.eval(`(async () => {
                const { buffer, record, card, screen } = window.__live;
                const frame = () => new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d)));

                /* THE CONTROL: the identical wait, feeding nothing. */
                const idleFrom = card.paintCount;
                await frame();
                await card.updateComplete;
                await frame();
                const idlePaints = card.paintCount - idleFrom;

                const paints = card.paintCount;
                const before = screen.chartDerivations;
                for (let i = 200; i < 220; i += 1) buffer.addSample(record.measurements[i]);
                const dirty = { derivations: screen.chartDerivations, paints: card.paintCount };
                await frame();
                await card.updateComplete;
                await frame();
                window.__live.fed = 220;
                return {
                    before,
                    dirty,
                    idlePaints,
                    after: screen.chartDerivations,
                    paintsBefore: paints,
                    paintsAfter: card.paintCount,
                    inShot: card.derivation.counts.inShot,
                };
            })()`);

            assert.equal(got.dirty.derivations, got.before,
                'a publish marks the feed dirty; it does not derive — that is the 15 Hz path\'s whole cost');
            assert.equal(got.after, got.before + 1,
                `twenty samples became ${got.after - got.before} derivations`);
            const cost = (got.paintsAfter - got.paintsBefore) - got.idlePaints;
            assert.ok(cost <= 1,
                `and twenty samples cost ${cost} paints above an identical idle window `
                + `(${got.paintsAfter - got.paintsBefore} in the window, ${got.idlePaints} ambient) `
                + '— §7.8 C9: dead weight on the 15 Hz path');
            /* AND THE SAMPLES DID COST A PAINT, so the subtraction above cannot pass by the
             * card having stopped painting altogether. */
            assert.ok(got.paintsAfter > got.paintsBefore,
                'twenty samples must reach the canvas — a coalescing test that passes on a dead card proves nothing');
            assert.ok(got.inShot > 0);
        }));

        test('the 15 Hz budget: derive the whole shot AND paint it, inside one frame', (t) => mounted(async (page) => {
            /* chart-C9 is about work that does not need doing; this is about the work that
             * does. The live path is derive-then-paint, and gate 6's derivation walks the
             * whole buffer every frame, so the honest budget question is the PAIR, not the
             * paint alone. 66 ms is the 15 Hz frame (Part 3 §2). The bench tablet at dpr
             * 1.5 is M4's measurement, in the post-run pass — this is the desk number,
             * taken on the shot the fixtures actually contain. */
            await feed(page);
            const timing = await page.eval(`(async () => {
                const { deriveFromBuffer } = await import('/src/lib/shot-derivation.js');
                const { buffer, card } = window.__live;
                const once = () => {
                    const t0 = performance.now();
                    card.derivation = deriveFromBuffer(buffer);
                    card.performUpdate();
                    card.drawNow();
                    return performance.now() - t0;
                };
                for (let i = 0; i < 8; i += 1) once();
                const samples = [];
                for (let i = 0; i < 60; i += 1) samples.push(once());
                samples.sort((a, b) => a - b);
                return {
                    n: samples.length,
                    p50: samples[Math.floor(samples.length * 0.5)],
                    p95: samples[Math.floor(samples.length * 0.95)],
                    max: samples[samples.length - 1],
                    inShot: card.derivation.counts.inShot,
                };
            })()`);

            t.diagnostic(`derive+paint @ ${geometry.name}: p50 ${timing.p50.toFixed(2)} ms · `
                + `p95 ${timing.p95.toFixed(2)} ms · max ${timing.max.toFixed(2)} ms `
                + `(${timing.n} frames, ${timing.inShot} samples x 5 channels)`);
            assert.equal(timing.inShot, 336);
            assert.ok(timing.p95 < 66,
                `p95 ${timing.p95.toFixed(2)} ms must fit the 15 Hz frame budget of 66 ms`);
        }));

        test('the card\'s heading and readouts line up with the AXIS NUMBERS, not its host',
            () => mounted(async (page) => {
                /* Ben, 23 Aug 2026: "the profile name, and live values should align to
                 * the chart edges (Time and profile should align wht the Y axis numbers,
                 * likewise for the time etc)."
                 *
                 * A plot does not start at its host's edge — uPlot keeps a gutter each
                 * side for the axis labels, and this tree states those four gutters as
                 * tokens because nothing else may. MEASURED before any of this, at 1920
                 * design units: the card's content ran 500..1851 while the data area ran
                 * 570..1787, so every readout sat 70px left of the first gridline and the
                 * clock 64px right of the last.
                 *
                 * THE SENTENCE HAD TWO READINGS AND BEN PICKED THE SECOND ONE. This test
                 * asserted the first until 25 August 2026: align to the AXIS — the plot's
                 * own data edge — on the argument, which ui-chart-card.js had written down
                 * and this test repeated, that the numbers' own left edge "is not a stable
                 * number, it moves with how many digits the scale happens to need".
                 *
                 * Ben, 25 August 2026: "the gauge cluster, shot description etc are all too
                 * far to the right, need to reduce the left margin so that the text is
                 * basically aligned with the left side of the 1 in the 14 of the Y axis
                 * label ... Likewise the right margin should be reduced." He knew what he
                 * was buying — "this I know will not be perfect but should be able to get
                 * close" — so the instability is accepted, not refuted, and it is bounded:
                 * a three-digit scale overruns the left allowance by 12px and a one-digit
                 * scale falls short by 6, and a label can never be wider than the gutter it
                 * lives in, so nothing clips either way.
                 *
                 * SO THE TARGET IS THE GUTTER LESS WHAT THE NUMBERS THEMSELVES TAKE, and
                 * the two --ui-chart-label-* tokens are that allowance: on the left uPlot's
                 * 5px tick plus its 5px label gap plus a two-digit label measured at 16.6px
                 * in Geist at --ui-chart-tick; on the right half a two-digit label, because
                 * an x label is centred on its tick and only its right half escapes the plot
                 * area. Those tokens are read here rather than restated — 27 and 8 are the
                 * numbers today and the point is that the card and the test take them from
                 * one place. `ui-chart-card.js` spends them in the matching direction:
                 * `padding-inline-start: calc(var(--ui-chart-gutter-l) - var(--ui-chart-label-l))`.
                 *
                 * MEASURED AFTER, at both Gate A geometries: the profile name and the first
                 * readout land exactly --ui-chart-label-l left of the data area (floor
                 * 397 against an area starting at 424; bench 410.05 against 437.05) and the
                 * clock exactly --ui-chart-label-r right of it. The offset is the token to
                 * the pixel at both, which is what tells you it is the calc and not a
                 * coincidence of one layout. */
                await feed(page);
                const gutterL = parseFloat(await page.resolveValue('var(--ui-chart-gutter-l)', 'inline-size'));
                const gutterR = parseFloat(await page.resolveValue('var(--ui-chart-gutter-r)', 'inline-size'));
                const labelL = parseFloat(await page.resolveValue('var(--ui-chart-label-l)', 'inline-size'));
                const labelR = parseFloat(await page.resolveValue('var(--ui-chart-label-r)', 'inline-size'));
                const host = await page.box(`${CARD} >>> .plot`);
                /* The data area's own edges, and then the axis numbers' outer edges, which
                 * are what the content column is aligned to. */
                const areaLeft = host.left + gutterL - labelL;
                const areaRight = host.right - gutterR + labelR;

                /* The heading is conditional — it renders only once a profile is named,
                 * and this suite feeds a chart rather than a machine — so it is asserted
                 * when present and skipped when not. The readouts and the clock are
                 * unconditional and carry the claim either way. */
                await page.evalFn(async () => {
                    const screen = window.__h.q('live-screen');
                    screen.profileName = 'Extractamundo Dos! (2)';
                    await screen.updateComplete;
                    return true;
                });
                await page.settle(3);

                for (const [what, selector] of [
                    ['the profile name', 'live-screen >>> #profile-name'],
                    ['the first readout', 'live-screen >>> .gauges ui-stat-tile'],
                ]) {
                    const box = await page.box(selector);
                    near(box.left, areaLeft,
                        `${what} does not start where the y axis numbers start`, 1.5);
                }
                const clock = await page.box('live-screen >>> #clock');
                near(clock.right, areaRight,
                    'the clock does not end where the last x axis number ends', 1.5);
            }));

        test('chart-C10: Live slots no legend, and the plot is born at the size it keeps', () => mounted(async (page) => {
            /* "createPlot measures its host BEFORE its own 78px legend is inserted as a
             * preceding sibling, so every plot is born sized to a box it no longer occupies
             * — invisible only because the callers schedule a compensating resize a frame
             * later." Here the legend is a row in the card's own grid and Live fills none of
             * it, so the assertion is that the FIRST paint's size is the final size: no
             * compensating resize, and no reserved row for a legend that is not there. */
            const got = await feed(page);
            /* LIVE SLOTS A LEGEND NOW, AND IT IS NOT COMPONENT #10. Ben, 23 Aug 2026:
             * "The chart card need to iverlap the values and the chart title above it
             * including the Time etc. Should look like this is a screen with these
             * values on it." The band's identity line, status chip, clock and seven
             * readouts moved into the card's `legend` slot, so the card's frame encloses
             * them. What the original claim was about is untouched — #10, the chart
             * legend component, is still not Live furniture — and what this test exists
             * to prove is the sentence after it: the plot is born at the size it keeps,
             * which is chart-C10 and is asserted below whatever the slot holds. */
            assert.equal(got.hasLegend, true,
                'the Live card no longer carries the readouts in its legend slot');
            const legendTag = await page.evalFn((s) => {
                const slotted = window.__h.need(s)
                    .querySelector('[slot="legend"]');
                return slotted ? slotted.className : null;
            }, CARD);
            assert.equal(legendTag, 'stats-block',
                'the legend slot holds something other than the band\'s readouts — if that is '
                + 'component #10 arriving, chart-C10\'s claim needs rewriting, not this line');

            const first = await page.evalFn((s) => {
                const card = window.__h.need(s);
                return { plot: card.plotHandle.raw.width, height: card.plotHandle.raw.height };
            }, CARD);
            await page.settle(4);
            const settled = await page.evalFn((s) => {
                const card = window.__h.need(s);
                const host = card.shadowRoot.querySelector('.plot').getBoundingClientRect();
                return { plot: card.plotHandle.raw.width, height: card.plotHandle.raw.height, host: host.width, hostH: host.height };
            }, CARD);

            near(settled.plot, first.plot, 'the plot did not have to be resized after its first paint', 1.5);
            near(settled.height, first.height, 'in either axis', 1.5);
            near(settled.plot, settled.host, 'and it is the size of its own host', 1.5);

            /* THE LEGEND ROW IS FILLED NOW, so "it costs the plot nothing" is the wrong
             * question — it costs the plot exactly what the readouts need, which is the
             * point of putting them there. The claim that still matters, and the one
             * chart-C10 is about, is that the plot is BORN at the size it keeps: the
             * three `near` assertions above already hold it, and they hold it against a
             * legend that is present at first paint rather than inserted after it, which
             * is the defect's exact shape.
             *
             * WHAT IS ASSERTED INSTEAD: the row is a real box that the plot's own host
             * sits below, with nothing overlapping. A zero-height legend would now mean
             * the readouts had failed to slot. */
            const legendRow = await page.box(`${CARD} >>> .legend`);
            assert.ok(legendRow.height > 1,
                `the legend row is ${legendRow.height}px — the readouts did not reach the slot`);
            const plotBox = await page.box(`${CARD} >>> .plot`);
            assert.ok(plotBox.top >= legendRow.bottom - 0.51,
                `the plot starts ${plotBox.top} against a legend ending at ${legendRow.bottom} — `
                + 'the two overlap, which is chart-C10 arriving from the other side');
        }));

        test('chart-C11: the plot follows the WINDOW through the screen\'s own grid', () => mounted(async (page) => {
            /* THE AXIS IS WIDTH, and that is measured rather than preferred. The card is
             * the screen's only `1fr` row, so its HEIGHT is whatever the other rows leave
             * — and with the bands' real content in place there is very little of that:
             * at the 1000x600 design floor the card measured 190.45 against its own 186px
             * floor, four pixels of slack. A resize test that asserted on height would be
             * asserting on how tall the foot band happens to be this week. Width has room
             * at both geometries and exercises exactly the same observer. */
            await feed(page);
            const before = await page.evalFn(() => {
                const { card } = window.__live;
                const canvas = card.shadowRoot.querySelector('canvas');
                return {
                    width: canvas.getBoundingClientRect().width,
                    height: canvas.getBoundingClientRect().height,
                };
            });
            const narrower = { ...geometry, width: Math.round(geometry.width * 0.75) };
            await page.setGeometry(narrower);
            const after = await page.eval(`(async () => {
                const frame = () => new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d)));
                await frame(); await frame();
                const { card } = window.__live;
                const host = card.shadowRoot.querySelector('.plot').getBoundingClientRect();
                const canvas = card.shadowRoot.querySelector('canvas');
                return {
                    host: host.width,
                    hostHeight: host.height,
                    canvasCss: canvas.getBoundingClientRect().width,
                    canvasAttr: canvas.width,
                    plot: card.plotHandle.raw.width,
                    ratio: card.pixelRatio,
                };
            })()`);
            await page.setGeometry(geometry);

            assert.ok(after.canvasCss < before.width - 20,
                `the chart really followed the window: ${before.width} -> ${after.canvasCss}`);
            near(after.plot, after.host, 'the plot followed its own host, not a window listener', 1.5);
            near(after.canvasCss, after.host, 'and so did the canvas\'s CSS box', 1.5);
            near(after.canvasAttr, after.host * dsf, 'with the backing store at css × the ratio', 3);

            const floor = Number.parseFloat(await page.tokenValue('--ui-chart-min-h'));
            assert.ok(after.hostHeight >= floor - 1,
                `and the plot never goes below its own floor (${floor}), got ${after.hostHeight}`);
        }));

        test('chart-C12: ONE pixelRatio, and a real dpr change moves the card and uPlot together', () => mounted(async (page) => {
            await feed(page);
            const next = dsf === 1 ? 2 : 1;
            const before = await page.evalFn(() => ({
                ratio: window.__live.card.pixelRatio,
                build: window.__live.card.buildCount,
            }));
            assert.equal(before.ratio, dsf, 'the card starts at the page\'s ratio');

            await page.setGeometry({ ...geometry, deviceScaleFactor: next });
            const after = await page.eval(`(async () => {
                const frame = () => new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d)));
                await frame(); await frame();
                const uPlot = (await import('/vendor/uPlot.esm.js')).default;
                const { card } = window.__live;
                const canvas = card.shadowRoot.querySelector('canvas');
                const host = card.shadowRoot.querySelector('.plot').getBoundingClientRect();
                return {
                    ratio: card.pixelRatio,
                    vendor: uPlot.pxRatio,
                    platform: window.devicePixelRatio,
                    attr: canvas.width,
                    host: host.width,
                };
            })()`);
            await page.setGeometry(geometry);

            assert.equal(after.platform, next, 'the page really changed ratio');
            assert.equal(after.ratio, next, 'the card adopted it from uPlot\'s own dppxchange event');
            assert.equal(after.vendor, next, 'and uPlot is on the same number — they cannot be a frame apart');
            near(after.attr, after.host * next, 'the backing store follows', 3);
        }));

        test('chart-C13: garbling the gauge cluster\'s rendered DOM changes nothing the chart drew', () => mounted(async (page) => {
            /* "chart.js reads other modules' RENDERED DOM as an input — scraping numbers back
             * out of #profile-name, #history-date, #dose-in-value, #shot-data-total-weight and
             * #shot-data-total-time with a regex." The chart here is fed from the model, so
             * rewriting every number the screen displays must move nothing. */
            await feed(page);
            const got = await page.eval(`(async () => {
                const { card, screen } = window.__live;
                const summaryOf = () => screen.shadowRoot.querySelector('[slot="foot"]').textContent.trim();
                const before = {
                    derivation: card.derivation,
                    data: card.plotHandle.raw.data[1].slice(-3),
                    summary: summaryOf(),
                    yMax: card.yMax,
                };
                for (const tile of screen.shadowRoot.querySelectorAll('ui-stat-tile')) {
                    tile.setAttribute('value', '999.9');
                    tile.setAttribute('label', 'GARBLED');
                }
                await screen.updateComplete;
                card.drawNow();
                const after = {
                    same: card.derivation === before.derivation,
                    data: card.plotHandle.raw.data[1].slice(-3),
                    summary: summaryOf(),
                    yMax: card.yMax,
                    tiles: screen.shadowRoot.querySelectorAll('ui-stat-tile').length,
                };
                return { before: { data: before.data, summary: before.summary, yMax: before.yMax }, after };
            })()`);

            assert.ok(got.after.tiles > 0, 'the gauges really were there to garble');
            assert.equal(got.after.same, true, 'the chart is still drawing the same derivation object');
            assert.deepEqual(got.after.data, got.before.data, 'the same numbers');
            assert.equal(got.after.yMax, got.before.yMax, 'at the same ceiling');
            assert.equal(got.after.summary, got.before.summary,
                'and the aria summary is built from the model, not scraped off the tiles');
            assert.doesNotMatch(got.after.summary, /999\.9|GARBLED/);
        }));

        test('chart-C14: the canvas has a text alternative and a POLITE summary that says something', () => mounted(async (page) => {
            await feed(page);
            const plotRole = await page.evalFn((s) => {
                const el = window.__h.need(s);
                return { role: el.getAttribute('role'), name: el.getAttribute('aria-label') };
            }, PLOT);
            assert.equal(plotRole.role, 'img', 'canvas content is an image with a name, not an unlabelled canvas');
            assert.ok(plotRole.name && plotRole.name.length > 0, 'and the name is the screen\'s, already translated');

            const summary = await page.evalFn((s) => {
                const el = window.__h.need(s);
                const box = el.getBoundingClientRect();
                const style = getComputedStyle(el);
                return {
                    text: el.textContent.trim(),
                    role: el.getAttribute('role'),
                    live: el.getAttribute('aria-live'),
                    height: box.height,
                    clip: style.clipPath,
                    position: style.position,
                    overflow: style.overflowY,
                    display: style.display,
                    hidden: style.display === 'none' || el.hasAttribute('aria-hidden'),
                };
            }, SUMMARY);

            assert.equal(summary.role, 'status');
            assert.equal(summary.live, 'polite',
                'a chart summary that interrupts is worse than none — chart-C14 asks for a live region, '
                + 'and polite is the only kind a 15 Hz surface may have');
            assert.equal(summary.hidden, false);
            assert.equal(summary.height, 0, 'the summary costs the chart no height');
            assert.notEqual(summary.clip, 'none', 'it is hidden by clipping the PAINT');
            assert.equal(summary.position, 'static',
                'and not by positioning it — §4.1 allows no absolutely-positioned box in this tree');
            assert.equal(summary.overflow, 'visible',
                'nor by hiding overflow, which the L2 / L4 / L18 filter reads as a box clipping its content');
            assert.match(summary.text, /\d/, `the summary carries numbers: "${summary.text}"`);
            assert.match(summary.text, /2[0-9]\.\d/, `and the shot's own duration: "${summary.text}"`);

            /* THE ASSERTION THAT MATTERS: not that the element is styled a particular
             * way, but that a screen reader would find it. A zero-height box is exactly
             * the shape an engine might prune, so the real accessibility tree is read
             * rather than reasoned about. */
            await page.send('Accessibility.enable');
            const ax = await page.send('Accessibility.getFullAXTree');
            const nodes = (ax.nodes ?? []).filter((n) => !n.ignored);
            const status = nodes.filter((n) => n.role?.value === 'status');
            assert.ok(status.length >= 1,
                'the live region must be IN the accessibility tree, not merely in the DOM');
            /* A live region's own name is empty — its text is a StaticText child, which is
             * exactly what an announcement is made of. A zero-height box could have had
             * that child pruned; it does not. */
            const spoken = nodes
                .filter((n) => n.role?.value === 'StaticText')
                .map((n) => n.name?.value ?? '')
                .filter((name) => name === summary.text);
            assert.ok(spoken.length >= 1,
                `the summary's words must be in the tree, verbatim: "${summary.text}" — `
                + `found ${nodes.filter((n) => n.role?.value === 'StaticText').length} text nodes, none matching`);
            const plot = nodes.filter((n) => n.role?.value === 'image' || n.role?.value === 'img');
            assert.ok(plot.some((n) => (n.name?.value ?? '').length > 0),
                'and the canvas region is an image with a name — chart-C14\'s text alternative');
        }));

        test('chart-C14: the summary re-announces on the SHOT\'s clock, not once per frame', () => mounted(async (page) => {
            await feed(page, 100);
            const got = await page.eval(`(async () => {
                /* The shot arrives the way it arrives live: a handful of samples, a frame,
                 * a handful more. Every frame is a derivation and therefore a render, so
                 * the count below is renders-with-new-data against announcements. */
                const { buffer, record, card, screen } = window.__live;
                const read = () => screen.shadowRoot.querySelector('[slot="foot"]').textContent.trim();
                const frame = () => new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d)));
                const seen = [read()];
                const start = seen[0];
                const derivationsBefore = screen.chartDerivations;
                for (let batch = 100; batch < 426; batch += 16) {
                    for (let i = batch; i < Math.min(batch + 16, 426); i += 1) {
                        buffer.addSample(record.measurements[i]);
                    }
                    await frame();
                    await screen.updateComplete;
                    const text = read();
                    if (text !== seen[seen.length - 1]) seen.push(text);
                }
                window.__live.fed = 426;
                await card.updateComplete;
                return {
                    start,
                    end: read(),
                    announcements: seen.length - 1,
                    derivations: screen.chartDerivations - derivationsBefore,
                    seconds: card.derivation.scalars.durationSeconds,
                };
            })()`);

            assert.ok(got.derivations >= 8,
                `the shot really arrived in pieces: ${got.derivations} derivations`);
            assert.ok(got.announcements >= 2,
                `a summary that never changes is not a live summary: ${got.announcements}`);
            assert.ok(got.announcements <= Math.ceil(got.seconds / 5) + 2,
                `${got.announcements} announcements for ${got.seconds.toFixed(1)} shot-seconds across `
                + `${got.derivations} derivations — the cadence is five seconds OF THE SHOT, so a `
                + 'render with new data must not be an announcement');
            assert.ok(got.announcements < got.derivations,
                'and there are fewer announcements than renders, which is the whole point');
            assert.notEqual(got.end, got.start, 'while the summary does follow the shot');
        }));

        /* ================================================================
         * 6. THE REFUSAL — a chart with no shot is not a chart of zeroes
         * ============================================================== */

        test('with no buffer the card keeps its axes and shows the screen\'s own words', () => mounted(async (page) => {
            const got = await page.eval(`(async () => {
                const screen = document.querySelector('live-screen');
                await screen.updateComplete;
                const card = screen.shadowRoot.querySelector('ui-chart-card');
                await card.ready;
                await card.updateComplete;
                const message = screen.shadowRoot.querySelector('[slot="empty"]');
                return {
                    empty: card.hasAttribute('empty'),
                    hasPlot: Boolean(card.plotHandle),
                    derivation: card.derivation,
                    text: message ? message.textContent.trim() : null,
                    shown: message ? message.getBoundingClientRect().width > 0 : false,
                    cursor: card.cursor.active,
                };
            })()`);

            assert.equal(got.hasPlot, true,
                'a chart that vanishes when there is no shot reads as a broken chart');
            assert.equal(got.empty, true, 'and the refusal reflects to an attribute the screen can style');
            assert.equal(got.derivation, null, 'no buffer is no derivation — never an empty one invented here');
            assert.ok(got.text && got.text.length > 0, `the words are the screen's: "${got.text}"`);
            assert.equal(got.shown, true, 'and they are on screen, over the axes');
            assert.equal(got.cursor, false);
        }));
    });
}

/* ===========================================================================
 * 7. THE WHOLE ROAD — socket -> store -> derivation -> canvas, and a GAP
 *
 * Everything above fills the buffer by hand. This describe does not: `mock_rea.py`
 * serves the ten socket rows, `createReaSockets` + `createLiveStores` are the app's own,
 * and the screen is handed `live.shot`. Mid-shot the SCALE channel is closed and its
 * feed goes stale, so `attachShotBuffer` contributes `null` for the samples that follow
 * — "a scale whose socket has closed contributes null... attaching the last frame of a
 * dead feed would present a minutes-old reading as this sample's measurement".
 *
 * What must then appear is a GAP: the weight-flow trace stops, and starts again when the
 * scale comes back, with nothing drawn across the hole. `bridgeUnspoken` distinguishes
 * the two meanings of null precisely so this case is preserved — a slot a channel SPOKE
 * about (an explicit null) is a real gap; only slots it never sampled are bridged.
 * =========================================================================== */

function freePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

async function startMock(args = []) {
    const port = await freePort();
    const child = spawn('python3', ['tools/mock_rea.py', '--port', String(port), ...args],
        { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (b) => { stderr += b; });
    child.stdout.resume();
    const deadline = Date.now() + 20000;
    for (;;) {
        if (child.exitCode !== null) throw new Error(`mock exited ${child.exitCode}: ${stderr}`);
        try {
            const res = await fetch(`http://127.0.0.1:${port}/api/v1/info`);
            if (res.ok) { await res.arrayBuffer(); break; }
        } catch { /* not up yet */ }
        if (Date.now() > deadline) throw new Error(`mock never came up: ${stderr}`);
        await new Promise((r) => setTimeout(r, 60));
    }
    return { port, stop: () => child.kill('SIGKILL') };
}

/** The playback: fast enough for a test, slow enough that a gap is many samples wide. */
const RATE_HZ = 50;

describe('the live road: the WS mock drives the screen, and an absent channel is a GAP', () => {
    let mock;

    before(async () => { mock = await startMock(['--ws-rate', String(RATE_HZ)]); });
    after(() => { mock?.stop(); });

    for (const geometry of GATE_A_GEOMETRIES) {
        test(`socket -> store -> derivation -> canvas @ ${geometry.name}, with the scale leaving mid-shot`, (t) => {
            return browser.withPage({ geometry }, async (page) => {
                await page.mount(STAGE, MODULE);
                await page.settle(4);

                const got = await page.eval(`(async () => {
                    const { createReaSockets } = await import('/src/data/rea-sockets.js');
                    const { reaSocketBase } = await import('/src/data/rea-transport.js');
                    const { createLiveStores } = await import('/src/stores/live-stores.js');
                    const { WS_CHANNELS } = await import('/src/data/rea-ws-channels.js');

                    const screen = document.querySelector('live-screen');
                    await screen.updateComplete;
                    const card = screen.shadowRoot.querySelector('ui-chart-card');
                    await card.ready;

                    const sockets = createReaSockets({
                        createSocket: (url) => new WebSocket(url),
                        socketBaseUrl: reaSocketBase({ hostname: '127.0.0.1', port: ${mock.port} }),
                    });
                    /* The scale's staleness budget, shortened for a test that cannot wait
                     * four seconds: the POLICY is unchanged, only the number, and it is
                     * injected exactly where live-stores.js says it may be. */
                    const live = createLiveStores({ sockets, staleAfterMs: { scale: 250 } });
                    live.attachAll();
                    /* Staleness is re-classified by whatever already ticks; on the screen
                     * that is the render loop, here it is this interval. */
                    const tick = setInterval(() => live.refreshStaleness(Date.now()), 40);
                    screen.shot = live.shot;

                    const until = async (predicate, ms, what) => {
                        const deadline = performance.now() + ms;
                        for (;;) {
                            if (predicate()) return true;
                            if (performance.now() > deadline) throw new Error('timed out waiting for ' + what);
                            await new Promise((d) => setTimeout(d, 20));
                        }
                    };
                    const inShot = () => (card.derivation && card.derivation.ok ? card.derivation.counts.inShot : 0);

                    await until(() => inShot() >= 25, 25000, 'the first samples of the shot');
                    const beforeGap = inShot();

                    // The scale leaves. Its socket is closed and its feed goes stale by its
                    // own budget, which is what makes every following sample scale-less.
                    sockets.get(WS_CHANNELS.scaleSnapshot.key).close();
                    await until(() => live.status().scale.status === 'stale', 5000, 'the scale to go stale');
                    const goneAt = inShot();
                    await until(() => inShot() >= goneAt + 35, 25000, 'samples without a scale');
                    const backAt = inShot();

                    // And it comes back.
                    sockets.get(WS_CHANNELS.scaleSnapshot.key).open();
                    await until(() => live.status().scale.status === 'live', 8000, 'the scale to come back');
                    await until(() => inShot() >= backAt + 35, 25000, 'samples with the scale again');

                    clearInterval(tick);
                    live.detachAll();
                    await card.updateComplete;
                    card.drawNow();

                    const series = card.derivation.series.weightFlow;
                    const ys = series.y;
                    const xs = card.derivation.axis.t;
                    const finite = (v) => typeof v === 'number' && Number.isFinite(v);
                    const first = ys.findIndex(finite);
                    let last = -1;
                    for (let i = ys.length - 1; i >= 0; i -= 1) if (finite(ys[i])) { last = i; break; }
                    const holes = [];
                    for (let i = first; i <= last; i += 1) if (!finite(ys[i])) holes.push(i);

                    window.__live = { screen, card, live, sockets, holes, xs };
                    return {
                        beforeGap,
                        goneAt,
                        inShot: inShot(),
                        samples: ys.length,
                        firstFinite: first,
                        lastFinite: last,
                        holes: holes.length,
                        holeStartIdx: holes[0] ?? null,
                        holeEndIdx: holes[holes.length - 1] ?? null,
                        contiguous: holes.length > 0
                            && holes[holes.length - 1] - holes[0] === holes.length - 1,
                        pressureFiniteInHole: holes.length
                            ? holes.every((i) => finite(card.derivation.series.pressure.y[i]))
                            : false,
                        originRule: card.derivation.axis.originRule,
                        machineFrames: live.status().machineSnapshot.frames,
                        scaleFrames: live.status().scale.frames,
                        shotId: card.derivation.shotId,
                    };
                })()`);

                t.diagnostic(`${geometry.name}: ${got.machineFrames} machine frames @ ${RATE_HZ} Hz · `
                    + `${got.scaleFrames} scale frames · ${got.inShot} in-shot samples · `
                    + `gap ${got.holeStartIdx}..${got.holeEndIdx} (${got.holes} samples with no scale)`);

                assert.ok(got.machineFrames > 60,
                    `the machine channel really streamed: ${got.machineFrames} frames`);
                assert.ok(got.scaleFrames > 20, `and so did the scale: ${got.scaleFrames} frames`);
                assert.ok(got.shotId, 'the shot buffer opened on the mock\'s own shot id');
                assert.equal(got.originRule, 'firstPouringSample',
                    'and t=0 is the machine\'s first pouring sample, off its own arrival stamps');

                assert.ok(got.holes >= 10,
                    `the scale's absence must reach the series as nulls, got ${got.holes}`);
                assert.equal(got.contiguous, true,
                    `the hole is one stretch, not scattered dropouts: ${got.holeStartIdx}..${got.holeEndIdx}`);
                assert.ok(got.holeStartIdx > got.firstFinite,
                    'and it is MID-shot — a gap with a reading either side, not a missing tail');
                assert.ok(got.holeEndIdx < got.lastFinite,
                    `the trace resumes when the scale comes back: hole ends ${got.holeEndIdx}, `
                    + `last reading ${got.lastFinite}`);
                assert.equal(got.pressureFiniteInHole, true,
                    'while the machine\'s own channels kept reading throughout — one channel left, not the shot');

                /* AND IT IS DRAWN AS A GAP. The weight-flow token is drilled so the trace is
                 * unmistakable on the canvas, and the drill colour is counted column by
                 * column: present either side of the hole, absent inside it. A bridged gap
                 * would paint straight through. */
                await page.setToken('--ui-channel-weight-flow', DRILL_COLOUR);
                const pixels = await page.eval(`(async () => {
                    const { card, holes, xs } = window.__live;
                    card.drawNow();
                    const canvas = card.shadowRoot.querySelector('canvas');
                    const over = card.plotHandle.raw.over;
                    const canvasRect = canvas.getBoundingClientRect();
                    const overRect = over.getBoundingClientRect();
                    const ratio = canvas.width / canvasRect.width;
                    const at = (t) => Math.round(
                        (overRect.left - canvasRect.left + card.plotHandle.raw.valToPos(t, 'x')) * ratio);
                    const ctx = canvas.getContext('2d');
                    const count = (x0, x1) => {
                        const left = Math.max(0, Math.min(x0, x1));
                        const width = Math.max(1, Math.abs(x1 - x0));
                        if (left + width > canvas.width) return -1;
                        const { data } = ctx.getImageData(left, 0, width, canvas.height);
                        let n = 0;
                        for (let i = 0; i < data.length; i += 4) {
                            if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 170 && data[i + 3] > 200) n += 1;
                        }
                        return n;
                    };
                    const holeStart = holes[0];
                    const holeEnd = holes[holes.length - 1];
                    // Inset by one sample on each side so the last drawn point's own stroke
                    // width is not counted as ink inside the hole.
                    const inside = [at(xs[holeStart + 1]), at(xs[holeEnd - 1])];
                    const before = [at(xs[Math.max(0, holeStart - 12)]), at(xs[holeStart - 2])];
                    const after = [at(xs[holeEnd + 2]), at(xs[Math.min(xs.length - 1, holeEnd + 12)])];
                    return {
                        inside: count(inside[0], inside[1]),
                        before: count(before[0], before[1]),
                        after: count(after[0], after[1]),
                        insideWidth: Math.abs(inside[1] - inside[0]),
                    };
                })()`);
                await page.setToken('--ui-channel-weight-flow', null);

                assert.ok(pixels.insideWidth > 4,
                    `the hole is wide enough to look inside: ${pixels.insideWidth}px`);
                assert.ok(pixels.before > 0,
                    `the weight-flow trace is painted before the gap (${pixels.before} drilled pixels)`);
                assert.ok(pixels.after > 0, `and after it (${pixels.after})`);
                assert.equal(pixels.inside, 0,
                    `but NOT across it (${pixels.inside} drilled pixels inside the gap) — a bridged `
                    + 'gap would draw a straight line through a measurement that never happened');

                assert.deepEqual(page.pageErrors, []);
            });
        });
    }
});
