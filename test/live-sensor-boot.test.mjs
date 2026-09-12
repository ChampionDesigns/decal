/**
 * The sensor half of the live layer, through the real boot. Every assertion goes through
 * `createAppBoot` rather than a discovery double injected into `createLiveStores`, so the
 * wiring is under test and not only the store. Only `fetch` and the socket factory are
 * doubles.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createAppBoot } from '../src/lib/app-boot.js';
import { FEED } from '../src/stores/live-stores.js';
import { FEED_STATUS } from '../src/stores/feed-store.js';
import { SENSOR_KIND } from '../src/data/rea-sensors.js';
import { sensorSnapshotPath, WS_CHANNELS } from '../src/data/rea-ws-channels.js';

const LOCATION = { hostname: '127.0.0.1', protocol: 'http:' };

const ESTIMATOR_ID = 'de1-abc-puckestimator';
const MILK_ID = 'de1-abc-milkprobe';

/** A WebSocket double. Records the URL; nothing opens by itself. */
function fakeSocketFactory() {
    const sockets = [];
    const factory = (url) => {
        const listeners = new Map();
        const socket = {
            url,
            closed: false,
            addEventListener(type, fn) {
                if (!listeners.has(type)) listeners.set(type, new Set());
                listeners.get(type).add(fn);
            },
            removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
            close() { this.closed = true; this.emit('close', {}); },
            sent: [],
            send(payload) { this.sent.push(payload); },
            emit(type, event) { for (const fn of [...(listeners.get(type) ?? [])]) fn(event); },
        };
        sockets.push(socket);
        return socket;
    };
    factory.sockets = sockets;
    factory.urls = () => sockets.map((s) => s.url);
    factory.forPath = (needle) => [...sockets].reverse().find((s) => String(s.url).includes(needle)) ?? null;
    return factory;
}

/**
 * A fetch double with two answers that matter and a 500 for everything else, which is
 * `withDe1`'s own answer on a machine that is off. `sensors` is a live list: a test
 * replaces it to swap the machine's sensors underneath a running discovery.
 */
function fakeFetch({ capabilities = ['cupWarmer', 'integratedScale'], sensors = [] } = {}) {
    const state = { capabilities, sensors };
    const calls = [];
    const impl = async (url, options = {}) => {
        calls.push({ url, method: options.method ?? 'GET' });
        const answer = (body) => ({
            ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(body),
        });
        if (url.endsWith('/api/v1/machine/capabilities')) {
            return state.capabilities === null
                ? { ok: false, status: 500, headers: { get: () => null }, text: async () => '{}' }
                : answer({ capabilities: state.capabilities });
        }
        if (url.endsWith('/api/v1/sensors')) return answer(state.sensors);
        return { ok: false, status: 500, headers: { get: () => null }, text: async () => JSON.stringify({ e: 'no de1' }) };
    };
    impl.calls = calls;
    impl.state = state;
    impl.sensorReads = () => calls.filter((call) => call.url.endsWith('/api/v1/sensors')).length;
    return impl;
}

const listing = (...ids) => ids.map((id) => ({ id, info: { name: id, vendor: 'bengle', data: [], commands: [] } }));

function bootWith({ fetchImpl = fakeFetch(), createSocket = fakeSocketFactory() } = {}) {
    const boot = createAppBoot({
        fetch: fetchImpl,
        createSocket,
        location: LOCATION,
        importModule: async () => ({}),
    });
    return { boot, fetchImpl, createSocket };
}

/** Start, then wait for the capability answer AND the discovery pass it gates. */
async function started(boot) {
    await boot.start();
    await boot.capabilitiesSettled();
    await boot.sensorsSettled();
    return boot;
}

const open = (socket) => { socket.emit('open', {}); return socket; };
const push = (socket, frame) => socket.emit('message', { data: JSON.stringify(frame) });

/** A devices frame with (or without) a connected machine, as the aggregator writes one. */
const machineFrame = (id) => ({
    devices: id === null ? [] : [{ id, name: 'a machine', type: 'machine', state: 'connected' }],
    scanning: false,
    connectionStatus: {
        phase: id === null ? 'idle' : 'ready',
        foundMachines: [], foundScales: [], pendingAmbiguity: null,
    },
});

describe('the boot builds the sensor discovery it was missing', () => {
    test('a machine serving both sensors gets both feeds, filled, through the normal entry point', async () => {
        const fetchImpl = fakeFetch({ sensors: listing(ESTIMATOR_ID, MILK_ID) });
        const { boot, createSocket } = bootWith({ fetchImpl });
        try {
            await started(boot);

            assert.ok(boot.live.sensorDiscovery, 'the shell builds a discovery and hands it to the live layer');
            assert.equal(boot.live.sensorDiscovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), ESTIMATOR_ID);
            assert.equal(boot.live.sensorDiscovery.attachedId(SENSOR_KIND.MILK_PROBE), MILK_ID);

            const urls = createSocket.urls();
            assert.ok(urls.some((url) => url.endsWith(sensorSnapshotPath(ESTIMATOR_ID))),
                `the estimator socket is dialled: ${urls.join(', ')}`);
            assert.ok(urls.some((url) => url.endsWith(sensorSnapshotPath(MILK_ID))),
                `and the milk probe's: ${urls.join(', ')}`);

            push(open(createSocket.forPath(sensorSnapshotPath(MILK_ID))), { timestamp: 't', temperature: 45.6 });
            const milk = boot.live.feed(FEED.MILK_PROBE).get();
            assert.equal(milk.status, FEED_STATUS.LIVE);
            assert.equal(milk.frames, 1);
            assert.equal(milk.value.channels.temperature, 45.6);

            const status = boot.live.status();
            assert.equal(status.milkProbe.attached, true, 'the feed is attached, not merely built');
            assert.equal(status.estimator.attached, true);
        } finally {
            boot.destroy();
        }
    });

    test('a machine whose capabilities do not answer is never polled — the gate is fail-closed', async () => {
        const fetchImpl = fakeFetch({ capabilities: null, sensors: listing(ESTIMATOR_ID) });
        const { boot, createSocket } = bootWith({ fetchImpl });
        try {
            await started(boot);

            assert.equal(fetchImpl.sensorReads(), 0,
                'no capability answer is not a yes: nothing asks for a listing');
            assert.equal(boot.live.sensorDiscovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), null);
            assert.equal(createSocket.urls().some((url) => url.includes('/ws/v1/sensors/')), false);
            assert.equal(boot.live.feed(FEED.ESTIMATOR).get().status, FEED_STATUS.NEVER);
        } finally {
            boot.destroy();
        }
    });

    test('a machine with no estimator registered yet reads an absence, not an invented channel', async () => {
        const fetchImpl = fakeFetch({ sensors: [] });
        const { boot } = bootWith({ fetchImpl });
        try {
            await started(boot);
            assert.equal(fetchImpl.sensorReads() > 0, true, 'the listing IS asked for — the gate is open');
            assert.equal(boot.live.sensorDiscovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), null);
            assert.equal(boot.live.feed(FEED.ESTIMATOR).get().value, null);
        } finally {
            boot.destroy();
        }
    });
});

describe('a sensor that is replaced or disconnected', () => {
    test('an error envelope detaches the dead id and the next pass takes the new one', async () => {
        const fetchImpl = fakeFetch({ sensors: listing(ESTIMATOR_ID) });
        const { boot, createSocket } = bootWith({ fetchImpl });
        try {
            await started(boot);
            const socket = open(createSocket.forPath(sensorSnapshotPath(ESTIMATOR_ID)));
            push(socket, { timestamp: 't', r2: 4.2 });
            assert.equal(boot.live.feed(FEED.ESTIMATOR).get().frames, 1);

            // The server answers an unknown id with this and closes: the ID is dead,
            // not the reading.
            push(socket, { error: 'not found' });
            assert.equal(boot.live.sensorDiscovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), null,
                'the dead id is let go rather than dialled for ever');
            assert.equal(boot.live.feed(FEED.ESTIMATOR).get().error, 'not found',
                'and the envelope is kept as a fact, never folded into the value');

            // The machine was swapped, so the estimator has a new id under the new device.
            const replaced = 'de1-xyz-puckestimator';
            fetchImpl.state.sensors = listing(replaced);
            await boot.live.sensorDiscovery.discoverNow();

            assert.equal(boot.live.sensorDiscovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), replaced);
            assert.ok(createSocket.urls().some((url) => url.endsWith(sensorSnapshotPath(replaced))));
        } finally {
            boot.destroy();
        }
    });

    test('a machine change drops the departed machine\'s sensor readings', async () => {
        const fetchImpl = fakeFetch({ sensors: listing(MILK_ID) });
        const { boot, createSocket } = bootWith({ fetchImpl });
        try {
            await started(boot);
            push(open(createSocket.forPath(sensorSnapshotPath(MILK_ID))), { timestamp: 't', temperature: 45.6 });
            assert.equal(boot.live.feed(FEED.MILK_PROBE).get().status, FEED_STATUS.LIVE);

            const devices = open(createSocket.forPath(WS_CHANNELS.devices.path));
            push(devices, machineFrame('m-1'));
            await boot.capabilitiesSettled();
            await boot.sensorsSettled();

            const milk = boot.live.feed(FEED.MILK_PROBE).get();
            assert.equal(milk.status, FEED_STATUS.STALE,
                'a reading taken from the machine that just left is not this machine\'s reading');
            assert.equal(milk.value.channels.temperature, 45.6,
                'and it survives, marked — the deletion rule, not a blank');
        } finally {
            boot.destroy();
        }
    });
});

describe('the shot buffer gets its source policy from the boot', () => {
    test('a shot whose samples carry estimator channels reads them from the estimator', async () => {
        const fetchImpl = fakeFetch({ sensors: listing(ESTIMATOR_ID) });
        const { boot, createSocket } = bootWith({ fetchImpl });
        try {
            await started(boot);

            push(open(createSocket.forPath(sensorSnapshotPath(ESTIMATOR_ID))), {
                timestamp: 't', r1: 3.1, r2: 4.2, hydraulicPowerMeasured: 12.5,
            });
            push(open(createSocket.forPath(WS_CHANNELS.shotState.path)), {
                event: 'state', state: 'pouring', shotId: 's-1', timestamp: 't',
            });
            push(open(createSocket.forPath(WS_CHANNELS.machineSnapshot.path)), {
                timestamp: 't', state: { state: 'espresso', substate: 'pouring' }, pressure: 6, flow: 2,
            });

            const shot = boot.live.shot.get();
            assert.equal(shot.sampleCount, 1, 'the sample reached the buffer');
            assert.deepEqual(shot.sources, { resistance: 'estimator', impedance: 'estimator', power: 'estimator' },
                'the source policy is installed by the shell, not only by a test that injects it');
            assert.equal(shot.sourcesPending, false);
        } finally {
            boot.destroy();
        }
    });
});
