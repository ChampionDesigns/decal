/**
 * The milk probe and the puck estimator, read the way the screen reads them: whether a
 * value survives the road from a socket frame to a painted tile. The sockets and the
 * discovery are fakes; everything above them is the app.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULE = ['/src/screens/live-screen.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"><live-screen></live-screen></div>';

/** A milk-probe frame as `sensors_handler.dart` serves one: the channel at the top. */
const MILK_FRAME = { timestamp: '2026-09-09T10:00:00.000Z', temperature: 45.6 };

/** An estimator frame with C observed — bit 0x08 set, and a finite compliance with it. */
const ESTIMATOR_FRAME = { timestamp: '2026-09-09T10:00:00.000Z', flags: 8, compliance: 0.5 };

/**
 * Build the real live layer over fake sockets, hand it to a real `<live-screen>`, and
 * push one frame per sensor. `clock` is injected so staleness is a value this test sets.
 */
const wire = (page, { milk = null, estimator = null } = {}) => page.evalFn(async (milkFrame, estimatorFrame) => {
    const { createLiveStores } = await import('/src/stores/live-stores.js');
    const { SENSOR_KIND } = await import('/src/data/rea-sensors.js');

    const listeners = () => {
        const frames = new Set();
        const signals = new Set();
        return {
            frames,
            signals,
            subscribe(fn) { frames.add(fn); return () => frames.delete(fn); },
            onSignal(fn) { signals.add(fn); return () => signals.delete(fn); },
            last() { return null; },
            send() { return { ok: true }; },
        };
    };

    const made = new Map();
    const sockets = {
        channel({ key }) {
            if (!made.has(key)) made.set(key, listeners());
            return made.get(key);
        },
        get(key) { return made.get(key) ?? null; },
    };

    const kinds = new Map();
    const kind = (name) => {
        if (!kinds.has(name)) kinds.set(name, listeners());
        return kinds.get(name);
    };
    const discovery = {
        start() { return this; },
        stop() {},
        subscribe(name, fn) { return kind(name).subscribe(fn); },
        onSignal(name, fn) { return kind(name).onSignal(fn); },
        last() { return null; },
        attachedId(name) { return `de1-abc-${name}`; },
    };

    const time = { now: 1000 };
    const live = createLiveStores({
        sockets,
        sensorDiscovery: discovery,
        clock: () => time.now,
    }).attachAll();

    const screen = window.__h.q('live-screen');
    screen.boot = { live };
    await screen.updateComplete;

    const push = (name, frame) => {
        for (const fn of [...kind(name).frames]) fn(frame);
    };
    if (milkFrame) push(SENSOR_KIND.MILK_PROBE, milkFrame);
    if (estimatorFrame) push(SENSOR_KIND.PUCK_ESTIMATOR, estimatorFrame);
    await screen.updateComplete;

    window.__sensors = {
        advance: async (ms) => {
            time.now += ms;
            live.refreshStaleness();
            screen.requestUpdate();
            await screen.updateComplete;
        },
    };
    return true;
}, milk, estimator);

/** The gauge cluster as it is painted: one entry per tile, in order. */
const GAUGES = `(() => {
    const screen = window.__h.q('live-screen');
    return [...screen.shadowRoot.querySelectorAll('.gauges > ui-stat-tile')].map((tile) => ({
        label: tile.getAttribute('label'),
        value: tile.getAttribute('value'),
        unit: tile.getAttribute('unit'),
    }));
})()`;

const gauges = (page) => page.eval(`JSON.stringify(${GAUGES})`).then(JSON.parse);

const properties = (page) => page.eval(`JSON.stringify((() => {
    const screen = window.__h.q('live-screen');
    return { milkPresent: screen.milkPresent, compliance: screen.compliance };
})())`).then(JSON.parse);

const advance = (page, ms) => page.eval(`window.__sensors.advance(${ms})`);

describe('the milk probe reaches the gauge cluster', () => {
    let browser;
    before(async () => { browser = await launch(); });
    after(async () => { await browser.close(); });

    test('a served milk temperature draws the Milk tile with that value', async () => {
        const page = await browser.newPage({ geometry: BENCH });
        try {
            await page.mount(STAGE, MODULE);
            await wire(page, { milk: MILK_FRAME });

            const tiles = await gauges(page);
            const milk = tiles.find((tile) => tile.label === 'Milk');
            assert.ok(milk, `the Milk tile is drawn when the probe reports: ${tiles.map((t) => t.label).join(', ')}`);
            assert.equal(milk.value, '45.6', 'and it draws the temperature the probe served');

            const { milkPresent } = await properties(page);
            assert.equal(milkPresent, true, 'so the steam chart is told to include the milk curve');
        } finally {
            await page.close();
        }
    });

    test('a probe that stops reporting withdraws the tile and the curve', async () => {
        const page = await browser.newPage({ geometry: BENCH });
        try {
            await page.mount(STAGE, MODULE);
            await wire(page, { milk: MILK_FRAME });
            // Past the sensor budget.
            await advance(page, 10000);

            const tiles = await gauges(page);
            assert.equal(tiles.some((tile) => tile.label === 'Milk'), false,
                'a stale probe reading is an absence, not a number that stopped moving');
            const { milkPresent } = await properties(page);
            assert.equal(milkPresent, false);
        } finally {
            await page.close();
        }
    });

    test('no probe at all leaves the cluster as it was', async () => {
        const page = await browser.newPage({ geometry: BENCH });
        try {
            await page.mount(STAGE, MODULE);
            await wire(page);

            const tiles = await gauges(page);
            assert.equal(tiles.some((tile) => tile.label === 'Milk'), false);
            const { milkPresent } = await properties(page);
            assert.equal(milkPresent, false);
        } finally {
            await page.close();
        }
    });
});

describe('the puck estimator reaches the compliance badge', () => {
    let browser;
    before(async () => { browser = await launch(); });
    after(async () => { await browser.close(); });

    test('a finite compliance with the observed bit set is handed to the badge', async () => {
        const page = await browser.newPage({ geometry: BENCH });
        try {
            await page.mount(STAGE, MODULE);
            await wire(page, { estimator: ESTIMATOR_FRAME });

            const { compliance } = await properties(page);
            assert.deepEqual(compliance, { compliance: 0.5, flags: 8 },
                'both channels come off the estimator frame, and both are read');

            const { complianceBadge } = await import('../../src/lib/expanded-summary.js');
            const badge = complianceBadge(compliance ?? {});
            assert.equal(badge.observed, true,
                'which is what the badge needs to print a value rather than a dash');
            assert.equal(badge.value, 0.5);
            assert.match(badge.text, /^0\.50 /);
        } finally {
            await page.close();
        }
    });

    test('a frame the firmware has not observed still shows absence', async () => {
        const page = await browser.newPage({ geometry: BENCH });
        try {
            await page.mount(STAGE, MODULE);
            await wire(page, { estimator: { timestamp: '2026-09-09T10:00:00.000Z', compliance: 0.5 } });

            const { compliance } = await properties(page);
            const { complianceBadge } = await import('../../src/lib/expanded-summary.js');
            assert.equal(complianceBadge(compliance ?? {}).observed, false,
                'no observed flag, no claim — the value alone is not the badge');
        } finally {
            await page.close();
        }
    });
});
