import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createAppBoot } from '../src/lib/app-boot.js';
import { FEED } from '../src/stores/live-stores.js';
import { FEED_STATUS } from '../src/stores/feed-store.js';
import { READING_FRESHNESS, freshnessOf } from '../src/lib/feed-freshness.js';

const LOCATION = { hostname: '127.0.0.1', protocol: 'http:' };

function fakeSocketFactory() {
    const sockets = [];
    const factory = (url) => {
        const listeners = new Map();
        const socket = {
            url,
            addEventListener(type, fn) {
                if (!listeners.has(type)) listeners.set(type, new Set());
                listeners.get(type).add(fn);
            },
            removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
            close() { socket.emit('close', {}); },
            send() {},
            emit(type, event) { for (const fn of [...(listeners.get(type) ?? [])]) fn(event); },
        };
        sockets.push(socket);
        return socket;
    };
    factory.forPath = (needle) => sockets.find((s) => String(s.url).includes(needle)) ?? null;
    return factory;
}

const answer = () => ({
    ok: false, status: 503, headers: { get: () => null }, text: async () => 'null',
});

function bootWith() {
    const createSocket = fakeSocketFactory();
    const ticks = [];
    let now = 1_000_000;
    const boot = createAppBoot({
        fetch: async () => answer(),
        createSocket,
        location: LOCATION,
        clock: () => now,
        repeat: (fn, ms) => { ticks.push({ fn, ms }); return () => ticks.splice(ticks.indexOf(ticks.find((t) => t.fn === fn)), 1); },
    });
    return {
        boot,
        createSocket,
        ticks,
        advance(ms) { now += ms; },
        tick() { for (const entry of [...ticks]) entry.fn(); },
    };
}

const MACHINE_FRAME = Object.freeze({
    state: 'idle', substate: 'ready', profileFrame: 0, timestamp: 1,
    targetGroupTemperature: 92, groupTemperature: 90, mixTemperature: 90,
    targetMixTemperature: 92, targetGroupFlow: 0, groupFlow: 0,
    targetGroupPressure: 0, groupPressure: 0, steamTemperature: 150,
});

describe('the shell ages the feeds, whichever page is open', () => {
    test('nothing ticks until start(), and the tick stops with stop()', async () => {
        const rig = bootWith();
        assert.deepEqual(rig.ticks, [], 'nothing in this layer starts itself');

        await rig.boot.start();
        assert.equal(rig.ticks.length, 1, 'exactly one clock, for the life of the open feeds');
        assert.ok(rig.ticks[0].ms > 0 && rig.ticks[0].ms < 2000,
            'and it ticks well inside the machine feed\'s own two-second budget');

        rig.boot.stop();
        assert.deepEqual(rig.ticks, [], 'a shell that leaves a timer behind per boot is a leak');
        rig.boot.destroy();
    });

    test('a machine feed that goes quiet is marked stale with no screen mounted', async () => {
        const rig = bootWith();
        await rig.boot.start();
        const socket = rig.createSocket.forPath('/ws/v1/machine/snapshot');
        assert.ok(socket, 'the boot opened the snapshot channel');

        socket.emit('message', { data: JSON.stringify(MACHINE_FRAME) });
        const feed = rig.boot.live.feed(FEED.MACHINE);
        assert.equal(feed.get().status, FEED_STATUS.LIVE, 'a frame that has just arrived is live');

        rig.advance(5000);
        rig.tick();

        assert.equal(feed.get().status, FEED_STATUS.STALE,
            'the reading is older than its budget and nothing but the shell was there to say so');
        assert.equal(freshnessOf(feed.get()), READING_FRESHNESS.STALE,
            'so a surface that prints a channel is told to withhold it');
        rig.boot.destroy();
    });

    test('an explicit socket close is stale at once, and no clock undoes it', async () => {
        const rig = bootWith();
        await rig.boot.start();
        const socket = rig.createSocket.forPath('/ws/v1/machine/snapshot');
        socket.emit('message', { data: JSON.stringify(MACHINE_FRAME) });
        const feed = rig.boot.live.feed(FEED.MACHINE);

        socket.emit('close', {});
        assert.equal(freshnessOf(feed.get()), READING_FRESHNESS.STALE,
            'a source that said it went is a fact, not an age');

        rig.tick();
        assert.equal(freshnessOf(feed.get()), READING_FRESHNESS.STALE);
        rig.boot.destroy();
    });

    test('a feed that has never spoken is absent, not stale', async () => {
        const rig = bootWith();
        await rig.boot.start();
        const feed = rig.boot.live.feed(FEED.MACHINE);

        assert.equal(freshnessOf(feed.get()), READING_FRESHNESS.ABSENT,
            'nothing has arrived, so there is no last-known value to be old');
        rig.tick();
        assert.equal(freshnessOf(feed.get()), READING_FRESHNESS.ABSENT,
            'and a tick must not turn a boot state into a fault');
        rig.boot.destroy();
    });
});

describe('the freshness selector', () => {
    test('no feed at all is absent, which is a page with no live layer', () => {
        assert.equal(freshnessOf(null), READING_FRESHNESS.ABSENT);
        assert.equal(freshnessOf(undefined), READING_FRESHNESS.ABSENT);
    });

    test('a source that gave up is stale while it holds a value, and absent while it does not', () => {
        assert.equal(
            freshnessOf({ status: FEED_STATUS.UNAVAILABLE, receivedAt: 10, frame: {} }),
            READING_FRESHNESS.STALE,
        );
        assert.equal(
            freshnessOf({ status: FEED_STATUS.UNAVAILABLE, receivedAt: null, frame: null }),
            READING_FRESHNESS.ABSENT,
        );
    });

    test('only a live feed is fresh', () => {
        assert.equal(freshnessOf({ status: FEED_STATUS.LIVE, receivedAt: 1 }), READING_FRESHNESS.FRESH);
        assert.equal(freshnessOf({ status: FEED_STATUS.STALE, receivedAt: 1 }), READING_FRESHNESS.STALE);
    });
});
