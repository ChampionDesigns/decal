/**
 * One owner for a chart's y range, on the shipped Live screen and its shipped expanded
 * overlay. Ranges are read off uPlot's own scale object.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, GATE_A_GEOMETRIES, BENCH } from '../harness/index.js';

const MODULE = ['/src/screens/live-screen.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"><live-screen></live-screen></div>';

/** The same recorded shot every other Live suite draws: 426 measurements, 336 in-shot. */
const SHOT_URL = '/tools/rea-fixtures/api__v1__shots__cd020a51-f353-4ffb-8389-72c931640181.json';

const SCREEN = 'live-screen';
const CARD = `${SCREEN} >>> ui-chart-card`;
const PLOT = `${CARD} >>> .plot`;
const OVERLAY = `${SCREEN} >>> live-expanded-chart`;
const TEMP_CARD = `${OVERLAY} >>> ui-chart-card[data-plot="temp"]`;

/**
 * Fill a real shot buffer and hand it to the screen, exactly as the wiring row does.
 * `count` stops short so the rest of the shot can arrive sample by sample afterwards.
 */
const FEED = (count) => `(async () => {
    const { createShotBuffer } = await import('/src/stores/shot-buffer.js');
    const record = await (await fetch('${SHOT_URL}')).json();
    const screen = document.querySelector('live-screen');
    await screen.updateComplete;
    const card = screen.shadowRoot.querySelector('ui-chart-card');
    await card.ready;
    const buffer = createShotBuffer({});
    buffer.open(record.id, {});
    for (let i = 0; i < ${count}; i += 1) buffer.addSample(record.measurements[i]);
    window.__live = { buffer, record, screen, card, fed: ${count} };
    screen.shot = buffer;
    await screen.updateComplete;
    await card.updateComplete;
    card.drawNow();
    return { ok: card.derivation.ok, inShot: card.derivation.counts.inShot };
})()`;

const feed = (page, count = 150) => page.eval(FEED(count));

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

describe(`the y range has one owner @ ${BENCH.name}`, () => {
    const mounted = (fn) => browser.withPage({ geometry: BENCH }, async (page) => {
        await page.mount(STAGE, MODULE);
        await page.settle(4);
        assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
        await fn(page);
        assert.deepEqual(page.pageErrors, [], 'and run without throwing');
    });

    test('every painted frame of a live temperature axis keeps the band it holds', () => mounted(async (page) => {
        await feed(page, 150);
        await page.click(PLOT);
        await page.settle(3);

        const open = await page.evalFn((s) => window.__h.need(s).open === true, OVERLAY);
        assert.equal(open, true, 'the premise: one tap on the Live plot opens the expanded chart');

        const empty = await page.eval(`(async () => {
            const { computeTempRange } = await import('/src/lib/chart-autoscale.js');
            return computeTempRange([], [], [], []);
        })()`);

        const run = await page.evalFn(async (sel, frames) => {
            const card = window.__h.need(sel);
            await card.ready;
            const { buffer, record } = window.__live;
            const raf = () => new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d)));
            const seen = [];
            for (let i = 0; i < frames; i += 1) {
                /* The legend updates after the card, so the visibility write is the frame's last writer. */
                buffer.addSample(record.measurements[window.__live.fed]);
                window.__live.fed += 1;
                await raf();
                await card.updateComplete;
                card.drawNow();
                const drawn = card.plotHandle.raw.scales.y;
                seen.push([drawn.min, drawn.max]);

                /* uPlot queues the re-range and commits it a microtask later, so the read waits a frame. */
                card.plotHandle.setSeriesVisible(0, true);
                await raf();
                const shown = card.plotHandle.raw.scales.y;
                seen.push([shown.min, shown.max]);
            }
            return { seen, draws: card.paintCount ?? null };
        }, TEMP_CARD, 60);

        const first = run.seen[0];
        assert.ok(Number.isFinite(first[0]) && Number.isFinite(first[1]),
            `the axis has a band at all: ${JSON.stringify(first)}`);
        assert.ok(first[0] !== empty[0] || first[1] !== empty[1],
            `the premise: a shot's band is not the empty-data band ${JSON.stringify(empty)}`);

        const reverted = run.seen.filter(([min, max]) => min === empty[0] && max === empty[1]);
        assert.equal(reverted.length, 0,
            `no frame may return to the empty-data band ${JSON.stringify(empty)} — `
            + `${reverted.length} of ${run.seen.length} did`);

        for (let i = 1; i < run.seen.length; i += 1) {
            const [min, max] = run.seen[i];
            const [pMin, pMax] = run.seen[i - 1];
            assert.ok(min <= pMin + 1e-9 && max >= pMax - 1e-9,
                `frame ${i} narrowed the band: ${JSON.stringify(run.seen[i - 1])} -> `
                + `${JSON.stringify(run.seen[i])}`);
        }
    }));

    test('a no-op visibility write cannot move the axis, and a real chip press does not either', () => mounted(async (page) => {
        await feed(page, 200);
        await page.click(PLOT);
        await page.settle(3);

        const before = await page.evalFn(async (sel) => {
            const card = window.__h.need(sel);
            await card.ready;
            card.drawNow();
            const y = card.plotHandle.raw.scales.y;
            return [y.min, y.max];
        }, TEMP_CARD);

        const after = await page.evalFn((sel) => {
            const card = window.__h.need(sel);
            card.plotHandle.setSeriesVisible(0, true);
            const y = card.plotHandle.raw.scales.y;
            return [y.min, y.max];
        }, TEMP_CARD);

        assert.deepEqual(after, before,
            'showing a series that is already shown made uPlot re-range to the band the '
            + `scale was constructed with: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);

        const chip = `${OVERLAY} >>> ui-chart-legend[chart="plot-temp"] >>> #chip-mixTemp`;
        await page.click(chip);
        await page.settle(2);
        const pressed = await page.evalFn((sel) => {
            const card = window.__h.need(sel);
            const y = card.plotHandle.raw.scales.y;
            return [y.min, y.max];
        }, TEMP_CARD);
        assert.deepEqual(pressed, before, 'a legend press is not an axis change');
    }));

    test('the legend rows are one value across live frames, not a fresh array per frame', () => mounted(async (page) => {
        await feed(page, 150);
        await page.click(PLOT);
        await page.settle(3);

        const stable = await page.evalFn(async (sel, frames) => {
            const legend = window.__h.need(sel);
            const first = legend.items;
            const { buffer, record } = window.__live;
            const raf = () => new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d)));
            let same = 0;
            for (let i = 0; i < frames; i += 1) {
                buffer.addSample(record.measurements[window.__live.fed]);
                window.__live.fed += 1;
                await raf();
                await legend.updateComplete;
                if (legend.items === first) same += 1;
            }
            return { same, frames };
        }, `${OVERLAY} >>> ui-chart-legend`, 20);

        assert.equal(stable.same, stable.frames,
            'a new items array on every 15 Hz frame is a visibility rewrite on every '
            + 'frame — the rows are constants and a constant is set once');
    }));

    test('the Live chart rests on its floor, grows past it, stops at its cap and resets', () => mounted(async (page) => {
        const rest = await page.evalFn(async (sel) => {
            const card = window.__h.need(sel);
            await card.ready;
            const y = card.plotHandle.raw.scales.y;
            return { top: y.max, floor: card.yFloor, cap: card.yCap };
        }, CARD);
        assert.equal(rest.top, 12,
            'the chart at rest is 0-12; the behaviour under test is what happens above 12');

        await feed(page, 200);

        const grown = await page.evalFn(async (sel, flow) => {
            const card = window.__h.need(sel);
            const { buffer, record } = window.__live;
            const raw = record.measurements[window.__live.fed];
            const sample = { ...raw, machine: { ...raw.machine, flow } };
            const builds = card.buildCount;
            buffer.addSample(sample);
            window.__live.fed += 1;
            await new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d)));
            await card.updateComplete;
            card.drawNow();
            return { top: card.plotHandle.raw.scales.y.max, builds, after: card.buildCount };
        }, CARD, 12.6);

        assert.ok(grown.top >= 12.6,
            `a 12.6 reading must be inside the plot, not over its top edge: top ${grown.top}`);
        assert.equal(grown.after, grown.builds, 'and growing an axis is DATA, not a rebuild');

        const bumped = await page.evalFn(async (sel, weightFlow) => {
            const card = window.__h.need(sel);
            const { buffer, record } = window.__live;
            const raw = record.measurements[window.__live.fed];
            /* The derivation reads this channel off `scale.weightFlow` and nowhere else. */
            const sample = { ...raw, scale: { ...(raw.scale ?? {}), weightFlow } };
            buffer.addSample(sample);
            window.__live.fed += 1;
            await new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d)));
            await card.updateComplete;
            card.drawNow();
            return card.plotHandle.raw.scales.y.max;
        }, CARD, 600);

        assert.ok(Number.isFinite(rest.cap),
            'a growing axis without a stated ceiling flattens the rest of the pour on one '
            + 'bumped scale');
        assert.equal(bumped, rest.cap,
            `a nonsense reading stops at the cap instead of taking the axis with it: ${bumped}`);

        const fresh = await page.evalFn(async (sel) => {
            const { createShotBuffer } = await import('/src/stores/shot-buffer.js');
            const card = window.__h.need(sel);
            const { screen, record } = window.__live;
            const buffer = createShotBuffer({});
            buffer.open('a-second-shot', {});
            for (let i = 0; i < 40; i += 1) buffer.addSample(record.measurements[i]);
            window.__live.buffer = buffer;
            window.__live.fed = 40;
            screen.shot = buffer;
            await screen.updateComplete;
            await card.updateComplete;
            card.drawNow();
            return card.plotHandle.raw.scales.y.max;
        }, CARD);

        assert.equal(fresh, 12,
            `one shot's peak must not be inherited by the next: ${fresh}`);
    }));
});

for (const geometry of GATE_A_GEOMETRIES) {
    describe(`a chart's refusal has a width @ ${geometry.name}`, () => {
        const mounted = (fn) => browser.withPage({ geometry }, async (page) => {
            await page.mount(STAGE, MODULE);
            await page.settle(4);
            assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
            await fn(page);
        });

        test('the shipped empty-state component fills a chart card it is slotted into', () => mounted(async (page) => {
            /* `<ui-empty-state>` is an inline-size container, so it contributes nothing to its
             * own intrinsic width. */
            await page.evalFn(async () => {
                const { createShotBuffer } = await import('/src/stores/shot-buffer.js');
                const record = await (await fetch(
                    '/tools/rea-fixtures/api__v1__shots__cd020a51-f353-4ffb-8389-72c931640181.json',
                )).json();
                const screen = document.querySelector('live-screen');
                await screen.updateComplete;
                const card = screen.shadowRoot.querySelector('ui-chart-card');
                await card.ready;
                const buffer = createShotBuffer({});
                buffer.open(record.id, {});
                /* The estimator's channels taken out: a machine without the puck estimator. */
                for (let i = 0; i < 200; i += 1) {
                    const raw = record.measurements[i];
                    const machine = { ...raw.machine };
                    delete machine.fusedR1;
                    delete machine.fusedR2;
                    delete machine.fusedC;
                    delete machine.fusedConf;
                    buffer.addSample({ ...raw, machine });
                }
                screen.shot = buffer;
                await screen.updateComplete;
                await card.updateComplete;
                card.drawNow();
            });
            await page.click(PLOT);
            await page.settle(3);
            await page.click(`${OVERLAY} >>> ui-tab-bar >>> ui-bank >>> #item-1`);
            await page.settle(4);

            const geo = await page.evalFn((sel) => {
                const state = window.__h.need(sel);
                const card = state.closest('ui-chart-card');
                const well = card.shadowRoot.querySelector('.well');
                const box = state.getBoundingClientRect();
                const wellBox = well.getBoundingClientRect();
                const block = state.shadowRoot.querySelector('.empty').getBoundingClientRect();
                return {
                    width: box.width,
                    height: box.height,
                    wellWidth: wellBox.width,
                    wellHeight: wellBox.height,
                    blockWidth: block.width,
                };
            }, `${OVERLAY} >>> history-power-page >>> ui-empty-state`);

            assert.ok(geo.width > 0,
                'the slotted empty-state host has a width of its own');
            assert.ok(geo.width >= geo.wellWidth - 1,
                `it takes the region it explains: ${geo.width} of ${geo.wellWidth}`);
            assert.ok(geo.blockWidth >= geo.wellWidth - 1,
                `and so does the block inside it: ${geo.blockWidth}`);
            assert.ok(geo.height <= geo.wellHeight + 1,
                `a message taller than the area it sits in is the narrow column: `
                + `${geo.height} in ${geo.wellHeight}`);
        }));

        test('a slotted empty state fills the well and its text wraps inside it', () => mounted(async (page) => {
            const geo = await page.evalFn(async (sel, long) => {
                const card = window.__h.need(sel);
                await card.ready;
                const well = card.shadowRoot.querySelector('.well');
                const slotted = card.querySelector('[slot="empty"]');
                slotted.textContent = long;
                await card.updateComplete;
                const wellBox = well.getBoundingClientRect();
                const box = slotted.getBoundingClientRect();
                return {
                    empty: card.hasAttribute('empty'),
                    wellWidth: wellBox.width,
                    width: box.width,
                    height: box.height,
                    right: box.right,
                    wellRight: wellBox.right,
                };
            }, CARD,
            'Es gibt noch keinen Bezug: starten Sie einen Bezug und er erscheint hier, '
            + 'waehrend er laeuft.');

            assert.equal(geo.empty, true, 'the premise: the card is showing its refusal');
            assert.ok(geo.width > 0,
                'the slotted host has a width of its own');
            assert.ok(geo.width >= geo.wellWidth - 1,
                `the refusal takes the well it is centred in: ${geo.width} of ${geo.wellWidth}`);
            assert.ok(geo.right <= geo.wellRight + 1,
                'and does not spill out of it');
            assert.ok(geo.height <= geo.wellWidth,
                `a block taller than the well is wide is the narrow column: ${geo.height}`);
        }));
    });
}
