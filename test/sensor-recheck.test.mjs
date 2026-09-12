/**
 * A sensor replaced underneath an unchanged machine: the socket stays open, the machine id
 * does not move, and the listing names a different sensor id. Covers the re-check itself
 * and, in the last block, the real boot that asks for it.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createSensorDiscovery, SENSOR_KIND } from '../src/data/rea-sensors.js';
import { createReaSockets } from '../src/data/rea-sockets.js';
import { createAppBoot } from '../src/lib/app-boot.js';
import { sensorSnapshotPath, WS_CHANNELS } from '../src/data/rea-ws-channels.js';

const ESTIMATOR_1 = 'usb:1-4.2-puckestimator';
const ESTIMATOR_2 = 'usb:1-4.3-puckestimator';
const MILK_1 = 'usb:1-4.2-milkprobe';
const MILK_2 = 'usb:1-4.3-milkprobe';

/** `SensorsHandler.addRoutes`: [{id, info}], `info` = `SensorInfo.toJson`. */
const listingFor = (...ids) => ids.map((id) => ({
    id,
    info: {
        name: id.endsWith('-milkprobe') ? 'Milk probe' : 'Puck estimator',
        vendor: 'Bengle',
        data: [{ key: 'r1', type: 'double', unit: null }],
        commands: null,
    },
}));

/** A hand-cranked scheduler: nothing happens until the test says so. */
function fakeTimers() {
    let next = 1;
    const pending = new Map();
    return {
        timers: {
            setTimeout: (fn, ms) => { const id = next++; pending.set(id, { fn, ms }); return id; },
            clearTimeout: (id) => { pending.delete(id); },
        },
        pendingCount: () => pending.size,
        async fire() {
            const armed = [...pending.entries()];
            pending.clear();
            for (const [, { fn }] of armed) fn();
            await new Promise((resolve) => setImmediate(resolve));
            await new Promise((resolve) => setImmediate(resolve));
        },
    };
}

/** The real socket layer over a fake WebSocket, and a listing the test can move. */
function harness({ gate = () => true, listing = listingFor(ESTIMATOR_1) } = {}) {
    const calls = [];
    const opened = [];
    let currentListing = listing;
    let holdGet = null;
    const transport = {
        calls,
        get: async (path) => {
            calls.push(path);
            if (holdGet) await holdGet;
            if (currentListing instanceof Error) {
                return { ok: false, kind: 'network', message: currentListing.message };
            }
            return { ok: true, status: 200, data: currentListing };
        },
    };
    const createSocket = (url) => {
        const listeners = new Map();
        const socket = {
            url,
            closed: false,
            addEventListener(t, f) { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t).add(f); },
            removeEventListener(t, f) { listeners.get(t)?.delete(f); },
            close() { this.closed = true; },
            send() {},
            emit(type, event = {}) { for (const f of [...(listeners.get(type) || [])]) f({ type, ...event }); },
            message(payload) { this.emit('message', { data: JSON.stringify(payload) }); },
            open() { this.emit('open'); },
        };
        opened.push(socket);
        return socket;
    };
    const sockets = createReaSockets({ createSocket, socketBaseUrl: 'ws://rea.test:8080' });
    const clock = fakeTimers();
    const discovery = createSensorDiscovery({
        transport, sockets, capabilityGate: gate, intervalMs: 15000, timers: clock.timers,
    });
    return {
        discovery,
        transport,
        opened,
        clock,
        setListing: (next) => { currentListing = next; },
        /** Hold the NEXT listing open, so a re-check can be asked for mid-pass. */
        hold: () => {
            let release = null;
            holdGet = new Promise((resolve) => { release = resolve; });
            return () => { holdGet = null; release(); };
        },
        /** One live sensor, attached, with a frame delivered on an OPEN socket. */
        async attached(...kinds) {
            for (const kind of kinds) this.discovery.subscribe(kind, () => {});
            this.discovery.start();
            await clock.fire();
            for (const socket of opened) { socket.open(); socket.message({ r1: 1.42 }); }
        },
    };
}

describe('a sensor replaced under a machine that never changed', () => {
    test('an already-attached kind is NEVER re-checked by the poll on its own', async () => {
        /* With the socket open and the kind attached, no amount of polling looks at the
         * listing again. */
        const h = harness();
        await h.attached(SENSOR_KIND.PUCK_ESTIMATOR);
        assert.equal(h.discovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), ESTIMATOR_1);
        const asked = h.transport.calls.length;

        h.setListing(listingFor(ESTIMATOR_2));
        await h.clock.fire();
        await h.clock.fire();

        assert.equal(h.transport.calls.length, asked, 'nothing asks for a listing once every kind is attached');
        assert.equal(h.discovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), ESTIMATOR_1,
            'and the id it holds is the one the machine has stopped listing');
        h.discovery.stop();
    });

    test('invalidate() moves the link to the id the listing names now, and lets the old one go', async () => {
        const h = harness();
        const frames = [];
        h.discovery.subscribe(SENSOR_KIND.PUCK_ESTIMATOR, (f) => frames.push(f));
        h.discovery.start();
        await h.clock.fire();
        h.opened[0].open();
        h.opened[0].message({ r1: 1.42 });
        assert.equal(h.opened[0].closed, false, 'the server leaves this socket open — there is no signal');

        h.setListing(listingFor(ESTIMATOR_2));
        await h.discovery.invalidate();

        assert.equal(h.discovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), ESTIMATOR_2);
        assert.equal(h.opened[0].closed, true, 'the sensor that left keeps its socket');
        assert.equal(h.opened[1].url,
            `ws://rea.test:8080${sensorSnapshotPath(ESTIMATOR_2)}`);
        assert.equal(h.discovery.last(SENSOR_KIND.PUCK_ESTIMATOR), null,
            'the previous sensor\'s last frame is not replayed onto the new one');

        h.opened[1].open();
        h.opened[1].message({ r1: 2.01 });
        assert.deepEqual(frames, [{ r1: 1.42 }, { r1: 2.01 }], 'the same subscriber, uninterrupted');
        h.discovery.stop();
    });

    test('an unchanged listing changes nothing and costs no reconnection', async () => {
        const h = harness();
        await h.attached(SENSOR_KIND.PUCK_ESTIMATOR);
        const asked = h.transport.calls.length;

        await h.discovery.invalidate();

        assert.equal(h.transport.calls.length, asked + 1, 'one GET, which is the whole cost');
        assert.equal(h.opened.length, 1, 'no second socket was dialled');
        assert.equal(h.opened[0].closed, false, 'and the working one was not closed and re-opened');
        assert.equal(h.discovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), ESTIMATOR_1);
        assert.deepEqual(h.discovery.last(SENSOR_KIND.PUCK_ESTIMATOR), { r1: 1.42 },
            'the replay value survives, because the socket did');
        assert.equal(h.clock.pendingCount(), 0, 'and the poll goes quiet again rather than running for ever');
        h.discovery.stop();
    });

    test('with no kind, every kind re-checks', async () => {
        const h = harness({ listing: listingFor(ESTIMATOR_1, MILK_1) });
        await h.attached(SENSOR_KIND.PUCK_ESTIMATOR, SENSOR_KIND.MILK_PROBE);

        h.setListing(listingFor(ESTIMATOR_2, MILK_2));
        await h.discovery.invalidate();

        assert.equal(h.discovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), ESTIMATOR_2);
        assert.equal(h.discovery.attachedId(SENSOR_KIND.MILK_PROBE), MILK_2);
        h.discovery.stop();
    });

    test('with a kind, only that kind re-checks', async () => {
        const h = harness({ listing: listingFor(ESTIMATOR_1, MILK_1) });
        await h.attached(SENSOR_KIND.PUCK_ESTIMATOR, SENSOR_KIND.MILK_PROBE);

        h.setListing(listingFor(ESTIMATOR_2, MILK_2));
        await h.discovery.invalidate(SENSOR_KIND.MILK_PROBE);

        assert.equal(h.discovery.attachedId(SENSOR_KIND.MILK_PROBE), MILK_2);
        assert.equal(h.discovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), ESTIMATOR_1,
            'a kind nobody asked about is not dropped for free');
        h.discovery.stop();
    });

    test('an unknown kind is a mistake at the call site, not a silent no-op', () => {
        const h = harness();
        assert.throws(() => h.discovery.invalidate('flowMeter'), /unknown kind/);
        h.discovery.stop();
    });

    test('a kind nothing reads is not made wanted by invalidating it', async () => {
        const h = harness();
        await h.discovery.invalidate(SENSOR_KIND.MILK_PROBE);
        assert.deepEqual(h.transport.calls, [], 'no listing is asked for on behalf of a sensor nobody reads');
        assert.deepEqual(h.discovery.status().kinds, [], 'and no state is minted for one');
        h.discovery.stop();
    });
});

describe('the re-check is not lost, and does not run away', () => {
    test('a re-check asked for DURING a pass is served by a pass that started after it', async () => {
        /* The pass in flight computed its wanted set before the mark existed, so being
         * answered by it would be being ignored by it. */
        const h = harness();
        await h.attached(SENSOR_KIND.PUCK_ESTIMATOR);
        h.discovery.subscribe(SENSOR_KIND.MILK_PROBE, () => {});   // makes a pass wanted
        const release = h.hold();

        const pass = h.discovery.discoverNow();
        h.setListing(listingFor(ESTIMATOR_2, MILK_1));
        const rechecked = h.discovery.invalidate(SENSOR_KIND.PUCK_ESTIMATOR);
        release();
        await pass;
        await rechecked;

        assert.equal(h.discovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), ESTIMATOR_2,
            'the mark was spent by the pass that could not have seen it');
        h.discovery.stop();
    });

    test('a listing that never arrives leaves the re-check outstanding, not spent', async () => {
        const h = harness();
        await h.attached(SENSOR_KIND.PUCK_ESTIMATOR);
        h.setListing(new Error('connection refused'));

        await h.discovery.invalidate();
        assert.equal(h.discovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), ESTIMATOR_1,
            'a failed GET detaches nothing and invents nothing');
        assert.equal(h.clock.pendingCount(), 1, 'the question is still open, so a pass is still armed');

        h.setListing(listingFor(ESTIMATOR_2));
        await h.clock.fire();
        assert.equal(h.discovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), ESTIMATOR_2,
            'and the next listing answers it');
        assert.equal(h.clock.pendingCount(), 0, 'then the poll goes quiet');
        h.discovery.stop();
    });

    test('a closed gate answers the re-check rather than leaving it asking for ever', async () => {
        let open = true;
        const h = harness({ gate: () => open });
        await h.attached(SENSOR_KIND.PUCK_ESTIMATOR);
        open = false;

        await h.discovery.invalidate();
        assert.equal(h.transport.calls.length, 1, 'a closed gate means no listing is asked for');
        await h.clock.fire();
        await h.clock.fire();
        assert.equal(h.clock.pendingCount(), 0,
            'and the mark is spent by the NO, so nothing polls a machine that says it has none');
        h.discovery.stop();
    });
});

/* The caller is pinned through `createAppBoot`: the real transport, socket layer,
 * capability gate and discovery, with only `fetch` and the socket factory faked. */
describe('the shell re-checks the sensors when the connection comes back', () => {
    const LOCATION = { hostname: '127.0.0.1', protocol: 'http:' };

    function bootHarness(sensors) {
        const state = { sensors };
        const calls = [];
        const fetchImpl = async (url, options = {}) => {
            calls.push({ url, method: options.method ?? 'GET' });
            const answer = (body) => ({
                ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(body),
            });
            if (url.endsWith('/api/v1/machine/capabilities')) return answer({ capabilities: ['integratedScale'] });
            if (url.endsWith('/api/v1/sensors')) return answer(state.sensors);
            return { ok: false, status: 500, headers: { get: () => null }, text: async () => '{"e":"no de1"}' };
        };
        const sockets = [];
        const createSocket = (url) => {
            const listeners = new Map();
            const socket = {
                url,
                closed: false,
                addEventListener(t, f) { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t).add(f); },
                removeEventListener(t, f) { listeners.get(t)?.delete(f); },
                close() { this.closed = true; },
                send() {},
                emit(type, event = {}) { for (const f of [...(listeners.get(type) ?? [])]) f({ type, ...event }); },
            };
            sockets.push(socket);
            return socket;
        };
        createSocket.sockets = sockets;
        createSocket.urls = () => sockets.map((s) => s.url);
        createSocket.forPath = (needle) => [...sockets].reverse().find((s) => String(s.url).includes(needle)) ?? null;
        const boot = createAppBoot({
            fetch: fetchImpl, createSocket, location: LOCATION, importModule: async () => ({}),
        });
        return { boot, createSocket, state };
    }

    const machineFrame = (id) => ({
        devices: [{ id, name: 'a machine', type: 'machine', state: 'connected' }],
        scanning: false,
        connectionStatus: { phase: 'ready', foundMachines: [], foundScales: [], pendingAmbiguity: null },
    });

    test('a socket that came back over the SAME machine moves a sensor that was replaced', async () => {
        const { boot, createSocket, state } = bootHarness(listingFor(ESTIMATOR_1));
        try {
            await boot.start();
            await boot.capabilitiesSettled();
            await boot.sensorsSettled();

            const devices = createSocket.forPath(WS_CHANNELS.devices.path);
            devices.emit('open', {});
            devices.emit('message', { data: JSON.stringify(machineFrame('m-1')) });
            await boot.capabilitiesSettled();
            await boot.sensorsSettled();
            await boot.sensorsSettled();
            assert.equal(boot.live.sensorDiscovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), ESTIMATOR_1);

            /* The estimator socket stays OPEN throughout: the outage is on the devices
             * feed, and the machine on the other end of it never changed. */
            const before = createSocket.forPath(sensorSnapshotPath(ESTIMATOR_1));
            state.sensors = listingFor(ESTIMATOR_2);
            devices.emit('close', {});
            devices.emit('open', {});
            await boot.sensorsSettled();
            await boot.sensorsSettled();

            assert.equal(boot.live.sensorDiscovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), ESTIMATOR_2,
                'the shell never asked the discovery to look at the listing again');
            assert.equal(before.closed, true, 'and the replaced sensor kept its socket');
            assert.ok(createSocket.urls().some((url) => url.endsWith(sensorSnapshotPath(ESTIMATOR_2))));
        } finally {
            boot.destroy();
        }
    });
});
