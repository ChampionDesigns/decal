/**
 * The readings above the Live chart repaint at 5 Hz, and two changes skip the wait: a
 * machine state change, and a channel that appears or disappears. The screen and its
 * wiring are real; the feeds are plain stores, and the clock is held by the test.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH } from '../harness/index.js';

const MODULE = ['/src/screens/live-screen.js'];
const STAGE = '<div id="stage" style="inline-size: 100%; block-size: 100dvh"><live-screen></live-screen></div>';

const wire = (page) => page.evalFn(async () => {
    const { createStore } = await import('/src/stores/store.js');
    const { FEED } = await import('/src/stores/live-stores.js');
    const { FEED_STATUS } = await import('/src/stores/feed-store.js');
    const { readMachineSnapshot } = await import('/src/data/rea-address.js');
    const { READINGS_MIN_MS } = await import('/src/lib/readings-rate.js');

    const clock = { t: 100000 };
    Date.now = () => clock.t;

    const never = { status: FEED_STATUS.NEVER, value: null, receivedAt: null };
    const feeds = Object.fromEntries(Object.values(FEED).map((name) => [name, createStore(never)]));
    const screen = window.__h.q('live-screen');
    screen.boot = { live: { feed: (name) => feeds[name] } };
    await screen.updateComplete;

    const frame = ({ state = 'espresso', pressure = 9, flow = 2 } = {}) => {
        const raw = {
            timestamp: '2026-09-09T10:00:00.000Z',
            state: { state, substate: 'pouring' },
            flow,
            groupTemperature: 93,
            steamTemperature: 150,
        };
        if (pressure !== null) raw.pressure = pressure;
        return raw;
    };

    const tile = (label) => {
        const found = [...screen.shadowRoot.querySelectorAll('.gauges > ui-stat-tile')]
            .find((el) => el.getAttribute('label') === label);
        return found ? found.getAttribute('value') : null;
    };

    window.__rate = {
        minMs: READINGS_MIN_MS,
        advance(ms) { clock.t += ms; },
        async push(options) {
            feeds[FEED.MACHINE].set({
                status: FEED_STATUS.LIVE, value: readMachineSnapshot(frame(options)), receivedAt: clock.t,
            });
            await screen.updateComplete;
            const readings = screen.readings;
            return {
                pressure: readings ? readings.pressure : 'none',
                flow: readings ? readings.flow : 'none',
                pressureTile: tile('Pressure'),
            };
        },
    };
    return true;
});

const push = (page, options) => page.evalFn((o) => window.__rate.push(o), options);
const advance = (page, ms) => page.evalFn((m) => window.__rate.advance(m), ms);

describe('the readings row repaints at 5 Hz, and flushes at once on the two changes', () => {
    let browser;
    before(async () => { browser = await launch(); });
    after(async () => { await browser.close(); });

    const mounted = (fn) => browser.withPage({ geometry: BENCH }, async (page) => {
        await page.mount(STAGE, MODULE);
        await wire(page);
        assert.deepEqual(page.pageErrors, [], 'the screen must mount without throwing');
        await fn(page);
        assert.deepEqual(page.pageErrors, [], 'and run without throwing');
    });

    test('a new value inside the window is held, and lands once the window has passed', () => mounted(async (page) => {
        const first = await push(page, { pressure: 9 });
        assert.equal(first.pressure, 9, 'the first frame publishes at once');

        await advance(page, 50);
        const held = await push(page, { pressure: 3 });
        assert.equal(held.pressure, 9, 'a frame 50 ms later does not repaint the row');

        const minMs = await page.evalFn(() => window.__rate.minMs);
        await advance(page, minMs);
        const due = await push(page, { pressure: 4 });
        assert.equal(due.pressure, 4, 'a frame after the window repaints it');
    }));

    test('a machine state change repaints the row at once', () => mounted(async (page) => {
        await push(page, { state: 'espresso', pressure: 9 });
        await advance(page, 10);
        const held = await push(page, { state: 'espresso', pressure: 8 });
        assert.equal(held.pressure, 9, 'the premise: inside the window the row is held');

        await advance(page, 10);
        const changed = await push(page, { state: 'idle', pressure: 0.1 });
        assert.equal(changed.pressure, 0.1, 'the state change shows the new value without the wait');
    }));

    test('a channel that disappears shows its dash at once, and a channel that returns shows its number at once',
        () => mounted(async (page) => {
            const shown = await push(page, { pressure: 9 });
            assert.notEqual(shown.pressureTile, null, 'the premise: the Pressure tile is drawn');

            await advance(page, 10);
            const gone = await push(page, { pressure: null });
            assert.equal(gone.pressure, null, 'the absent channel is published without the wait');
            assert.notEqual(gone.pressureTile, shown.pressureTile, 'and the tile no longer shows the old number');

            await advance(page, 10);
            const back = await push(page, { pressure: 7 });
            assert.equal(back.pressure, 7, 'the returning channel is published without the wait');
        }));

    test('a moving value with nothing appearing or disappearing is still held', () => mounted(async (page) => {
        await push(page, { pressure: 9, flow: 2 });
        await advance(page, 10);
        const held = await push(page, { pressure: 9, flow: 3.5 });
        assert.equal(held.flow, 2, 'a changed number alone does not skip the wait');
    }));
});
