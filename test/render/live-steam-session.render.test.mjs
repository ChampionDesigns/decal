/**
 * One steaming is one graph, and it is drawn once: what a restart inside the ten-second
 * hold does, what a pause inside a session does, and how often a sustained session
 * rebuilds the plot.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULE = ['/src/screens/live-screen.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"><live-screen></live-screen></div>';

/** The feed rate the machine publishes at, and the sustained-session sample count. */
const HZ = 15;
const SUSTAINED = 450;

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

/**
 * A mounted Live screen with the real stores behind it. The connection frame is supplied
 * so the chart is really laid out — a card with no box paints nothing.
 */
const stand = (fn) => browser.withPage({ geometry: BENCH }, async (page) => {
    await page.mount(STAGE, MODULE);
    await page.evalFn(async () => {
        const { createLiveStores, FEED } = await import('/src/stores/live-stores.js');
        const live = createLiveStores({
            sockets: { channel() { throw new Error('no channels in this fixture'); } },
        });
        live.feed(FEED.CONNECTION).accept({
            devices: [{ id: 'bench', name: 'Bench', type: 'machine', state: 'connected', available: true }],
            scanning: false,
            connectionStatus: { phase: 'ready', foundMachines: [], foundScales: [], pendingAmbiguity: null },
        });
        const screen = document.querySelector('live-screen');
        screen.boot = { live };
        screen.shot = live.shot;
        await screen.updateComplete;
        const card = screen.renderRoot.getElementById('live-chart');
        await card.ready;
        window.__steam = { live, FEED, screen, card };
    });
    await page.settle(4);
    assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
    await fn(page);
    assert.deepEqual(page.pageErrors, [], 'and run without throwing');
});

/**
 * Push `count` machine frames at the feed, spaced at the real rate. `substate` tells a
 * pour from a pause: every bracketing phase reports `idle` with the state left at `steam`.
 */
const frames = (page, { state, substate, count, hz = HZ }) => page.evalFn(
    async (state, substate, count, hz) => {
        const { live, FEED } = window.__steam;
        const machine = live.feed(FEED.MACHINE);
        const started = performance.now();
        const epoch = Date.now();
        for (let i = 0; i < count; i += 1) {
            const due = started + (i * 1000) / hz;
            const wait = due - performance.now();
            if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
            machine.accept({
                timestamp: new Date(epoch + (i * 1000) / hz).toISOString(),
                state: { state, substate },
                pressure: substate === 'pouring' ? 1.6 : 0,
                flow: substate === 'pouring' ? 1.8 : 0,
                targetFlow: 1.8,
                groupTemperature: 92,
                mixTemperature: 93,
                targetGroupTemperature: 93,
                targetMixTemperature: 93,
                steamTemperature: 140 + i / 100,
            });
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    },
    state, substate, count, hz,
);

/** What the screen is publishing about the session on the canvas right now. */
const session = (page) => page.evalFn(() => {
    const { screen, card } = window.__steam;
    const derivation = screen.steamDerivation;
    const t = derivation && derivation.ok ? derivation.axis.t : [];
    return {
        mode: screen.chartMode,
        settled: screen.steamSettled,
        samples: derivation && derivation.ok ? derivation.counts.samples : 0,
        originMs: derivation && derivation.ok ? derivation.axis.originMs : null,
        first: t.length ? t[0] : null,
        last: t.length ? t[t.length - 1] : null,
        plotted: card.plotHandle?.raw?.data?.[0]?.length ?? null,
    };
});

describe('the Live steam session', () => {

    test('restarting inside the ten-second hold starts a new graph at zero',
        () => stand(async (page) => {
            await frames(page, { state: 'steam', substate: 'pouring', count: 30 });
            const steamed = await session(page);
            assert.equal(steamed.mode, 'steam', 'the canvas is the steam graph');
            assert.equal(steamed.samples, 30, 'and it holds the session that was poured');

            await frames(page, { state: 'idle', substate: 'idle', count: 3 });
            const held = await session(page);
            assert.equal(held.mode, 'steam', 'the hold keeps the steam canvas');
            assert.equal(held.settled, true, 'and the screen knows it is settling');
            assert.equal(held.samples, 30, 'with the finished session still drawn');

            await frames(page, { state: 'steam', substate: 'pouring', count: 15 });
            const restarted = await session(page);
            assert.equal(restarted.settled, false, 'a running session is not settling');
            assert.equal(restarted.samples, 15,
                `the second steaming carried ${restarted.samples - 15} samples of the first`);
            assert.equal(restarted.first, 0, 'and the new axis begins at zero');
            assert.ok(restarted.last < 5,
                `the new session's clock reads ${restarted.last}s, so it kept the old origin`);
            assert.ok(restarted.originMs > held.originMs,
                'the origin is the first pouring sample of THIS session');
            assert.equal(restarted.plotted, 15, 'and the plot draws the new session alone');
        }));

    test('a pause inside one session stays in the same graph',
        () => stand(async (page) => {
            await frames(page, { state: 'steam', substate: 'pouring', count: 15 });
            const poured = await session(page);
            assert.equal(poured.samples, 15);

            await frames(page, { state: 'steam', substate: 'idle', count: 15 });
            const paused = await session(page);
            assert.equal(paused.samples, 15, 'a pause must not empty the graph');
            assert.equal(paused.originMs, poured.originMs, 'nor restart its clock');
            assert.equal(paused.settled, false, 'the machine is still steaming, so nothing is settling');

            await frames(page, { state: 'steam', substate: 'pouring', count: 15 });
            const resumed = await session(page);
            assert.equal(resumed.samples, 30, 'and the second half joins the first');
            assert.equal(resumed.originMs, poured.originMs, 'on the clock the session started on');
            assert.ok(resumed.last > paused.last,
                'with the pause spent, so the gap is visible on the axis');
        }));

    test('a sustained session keeps every sample and rebuilds the plot for neither',
        () => stand(async (page) => {
            /* `y2` and a fixed `yRange` are construction-time properties in uPlot, so the plot is
               built again on entering steam. The measurement below starts after that. */
            await frames(page, { state: 'steam', substate: 'pouring', count: 10 });
            const entered = await session(page);
            assert.equal(entered.mode, 'steam');

            const measured = await page.evalFn(async (count, hz) => {
                const { live, FEED, screen, card } = window.__steam;
                const machine = live.feed(FEED.MACHINE);
                const base = { builds: card.buildCount, paints: card.paintCount };
                const before = screen.steamDerivation.counts.samples;
                const started = performance.now();
                const epoch = Date.now();
                for (let i = 0; i < count; i += 1) {
                    const due = started + (i * 1000) / hz;
                    const wait = due - performance.now();
                    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
                    machine.accept({
                        timestamp: new Date(epoch + (i * 1000) / hz).toISOString(),
                        state: { state: 'steam', substate: 'pouring' },
                        pressure: 1.6, flow: 1.8, targetFlow: 1.8,
                        groupTemperature: 92, mixTemperature: 93,
                        targetGroupTemperature: 93, targetMixTemperature: 93,
                        steamTemperature: 140 + i / 100,
                    });
                }
                await new Promise((resolve) => setTimeout(resolve, 250));
                return {
                    sent: count,
                    retained: screen.steamDerivation.counts.samples - before,
                    dropped: screen.steamDerivation.counts.dropped ?? 0,
                    builds: card.buildCount - base.builds,
                    paints: card.paintCount - base.paints,
                    plotted: card.plotHandle?.raw?.data?.[0]?.length ?? null,
                };
            }, SUSTAINED, HZ);

            assert.equal(measured.retained, SUSTAINED,
                `${SUSTAINED} frames in, ${measured.retained} kept`);
            assert.equal(measured.dropped, 0, 'and none dropped');
            assert.equal(measured.builds, 0,
                `the plot was reconstructed ${measured.builds} times for ${SUSTAINED} samples`);
            assert.ok(measured.paints > 0, 'while still repainting, which is the point of it');
            assert.equal(measured.plotted, SUSTAINED + 10,
                'and the whole session is on the canvas');
        }));
});
