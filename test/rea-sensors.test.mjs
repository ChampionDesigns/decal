// Sensor discovery: polled, capability-gated, and RE-RUN ON SOCKET CLOSE.
//
// The machine-swap test is the one that matters. `estimator-link.js` fails it today: it
// never re-discovers, so after a swap it dials a dead sensor id for ever while
// sensors_handler answers {"error":"not found"} and closes, and every consumer falls back
// to the derived channel with nothing surfaced.
//
// FIXTURES ARE CONTRACT-CHECKED (Gate B rule 4): the listing is `SensorsHandler.addRoutes`
// GET /api/v1/sensors -> [{id, info}] with `info` = SensorInfo.toJson
// {name, vendor, data: [{key, type, unit}], commands}; the error envelope is
// `_handleSensorSnapshot`'s literal {"error":"not found"} followed by a close.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    createSensorDiscovery,
    readSensorListing,
    SENSOR_KIND,
    SENSORS_ROUTE,
    SENSORS_ROUTE_ID,
    REDISCOVERY_BACKOFF_MS,
    R3_CAPABILITY_GATE,
} from '../src/data/rea-sensors.js';
import { createReaSockets } from '../src/data/rea-sockets.js';

const ESTIMATOR_1 = 'usb:1-4.2-puckestimator';
const ESTIMATOR_2 = 'usb:1-4.3-puckestimator';
const MILK_1 = 'usb:1-4.2-milkprobe';

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
        /** The delays currently armed, in ms — what the backoff assertions read. */
        armedDelays: () => [...pending.values()].map((p) => p.ms),
        /** Fire every armed timer, then let the async discovery pass settle. */
        async fire() {
            const armed = [...pending.entries()];
            pending.clear();
            for (const [, { fn }] of armed) fn();
            await new Promise((resolve) => setImmediate(resolve));
            await new Promise((resolve) => setImmediate(resolve));
        },
    };
}

function harness({ gate = () => true, listing = listingFor(ESTIMATOR_1) } = {}) {
    const calls = [];
    const opened = [];
    let currentListing = listing;
    const transport = {
        calls,
        get: async (path) => {
            calls.push(path);
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
            serverClose() { this.emit('close'); },
        };
        opened.push(socket);
        return socket;
    };
    const sockets = createReaSockets({ createSocket, socketBaseUrl: 'ws://rea.test:8080' });
    const clock = fakeTimers();
    const discovery = createSensorDiscovery({
        transport,
        sockets,
        capabilityGate: gate,
        intervalMs: 15000,
        timers: clock.timers,
    });
    return {
        discovery,
        transport,
        opened,
        clock,
        sockets,
        setListing: (next) => { currentListing = next; },
    };
}

describe('the R3 capability gate is a required injection point', () => {
    test('there is no default gate — a missing one throws, naming R3', () => {
        assert.throws(
            () => createSensorDiscovery({ transport: { get: () => {} }, sockets: { channel: () => {} } }),
            /capabilityGate is required — see R3_CAPABILITY_GATE/,
        );
    });

    test('the seam records the upstream gap it stands in for', () => {
        assert.equal(R3_CAPABILITY_GATE.rNumber, 'R3');
        assert.match(R3_CAPABILITY_GATE.upstreamGap, /no estimator entry/);
        assert.match(R3_CAPABILITY_GATE.handlerSymbol, /capabilities/);
    });

    test('a closed gate means the poll never runs — no forever-poll on a machine with none', async () => {
        const h = harness({ gate: () => false });
        h.discovery.subscribe(SENSOR_KIND.PUCK_ESTIMATOR, () => {});
        h.discovery.start();
        await h.clock.fire();
        assert.deepEqual(h.transport.calls, [], `GET ${SENSORS_ROUTE} must not be issued`);
        assert.equal(h.discovery.status().kinds[0].gateOpen, false);
        h.discovery.stop();
    });

    test('a gate that fails to answer is neither yes nor no', async () => {
        const h = harness({ gate: () => { throw new Error('capabilities unreachable'); } });
        h.discovery.subscribe(SENSOR_KIND.PUCK_ESTIMATOR, () => {});
        h.discovery.start();
        await h.clock.fire();
        assert.deepEqual(h.transport.calls, []);
        const [kind] = h.discovery.status().kinds;
        assert.equal(kind.gateOpen, null, 'null, not false — nothing is assumed on the gate\'s behalf');
        assert.match(kind.lastError, /capabilities unreachable/);
        h.discovery.stop();
    });
});

describe('discovery is explicit, and only for what something wants', () => {
    test('start() with nothing subscribed issues no request and arms no timer', async () => {
        const h = harness();
        h.discovery.start();
        await h.clock.fire();
        assert.deepEqual(h.transport.calls, []);
        assert.equal(h.clock.pendingCount(), 0, 'no poll runs for a sensor nobody reads');
        h.discovery.stop();
    });

    test('subscribing before start() does not poll — the old link started at construction', async () => {
        const h = harness();
        h.discovery.subscribe(SENSOR_KIND.PUCK_ESTIMATOR, () => {});
        assert.equal(h.clock.pendingCount(), 0);
        assert.deepEqual(h.transport.calls, []);
        h.discovery.stop();
    });
});

describe('attach, read, detach', () => {
    test('a found sensor is attached at its own url and its frames are raw', async () => {
        const h = harness();
        const frames = [];
        h.discovery.subscribe(SENSOR_KIND.PUCK_ESTIMATOR, (f) => frames.push(f));
        h.discovery.start();
        await h.clock.fire();

        assert.deepEqual(h.transport.calls, [SENSORS_ROUTE]);
        assert.equal(h.discovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), ESTIMATOR_1);
        assert.equal(h.opened[0].url, `ws://rea.test:8080/ws/v1/sensors/${encodeURIComponent(ESTIMATOR_1)}/snapshot`);

        h.opened[0].open();
        h.opened[0].message({ r1: 1.42, compliance: 0.03 });
        assert.deepEqual(frames, [{ r1: 1.42, compliance: 0.03 }],
            'frames are passed through verbatim — reading them is rea-address.js\'s job');
        h.discovery.stop();
    });

    test('polling stops once attached and resumes when the socket goes', async () => {
        const h = harness();
        h.discovery.subscribe(SENSOR_KIND.PUCK_ESTIMATOR, () => {});
        h.discovery.start();
        await h.clock.fire();
        assert.equal(h.clock.pendingCount(), 0, 'nothing outstanding, so nothing to poll for');

        h.opened[0].open();
        h.opened[0].serverClose();
        assert.equal(h.discovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), null);
        assert.equal(h.clock.pendingCount(), 1, 'the close re-armed discovery');
        h.discovery.stop();
    });

    test('the last unsubscriber detaches, which closes the socket', async () => {
        const h = harness();
        const off = h.discovery.subscribe(SENSOR_KIND.PUCK_ESTIMATOR, () => {});
        h.discovery.start();
        await h.clock.fire();
        assert.equal(h.opened[0].closed, false);
        off();
        assert.equal(h.opened[0].closed, true);
        assert.equal(h.discovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), null);
        h.discovery.stop();
    });

    test('two kinds are two sockets, and each is gated on its own', async () => {
        const h = harness({ listing: listingFor(ESTIMATOR_1, MILK_1) });
        h.discovery.subscribe(SENSOR_KIND.PUCK_ESTIMATOR, () => {});
        h.discovery.subscribe(SENSOR_KIND.MILK_PROBE, () => {});
        h.discovery.start();
        await h.clock.fire();
        assert.equal(h.opened.length, 2);
        assert.equal(h.discovery.attachedId(SENSOR_KIND.MILK_PROBE), MILK_1);
        assert.equal(h.transport.calls.length, 1, 'one listing answers every kind');
        h.discovery.stop();
    });
});

describe('re-discovery — the live defect, not rebuilt', () => {
    test('a machine swap moves the link to the new id, closing the old socket first', async () => {
        const h = harness();
        const frames = [];
        h.discovery.subscribe(SENSOR_KIND.PUCK_ESTIMATOR, (f) => frames.push(f));
        h.discovery.start();
        await h.clock.fire();
        h.opened[0].open();
        h.opened[0].message({ r1: 1.42 });
        assert.deepEqual(h.discovery.last(SENSOR_KIND.PUCK_ESTIMATOR), { r1: 1.42 });

        // The machine is swapped: the old sensor id is gone and the socket closes.
        h.setListing(listingFor(ESTIMATOR_2));
        h.opened[0].serverClose();
        await h.clock.fire();

        assert.equal(h.opened[0].closed, true, 'old socket closed');
        assert.equal(h.discovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), ESTIMATOR_2);
        assert.equal(h.opened[1].url, `ws://rea.test:8080/ws/v1/sensors/${encodeURIComponent(ESTIMATOR_2)}/snapshot`);
        assert.equal(h.discovery.last(SENSOR_KIND.PUCK_ESTIMATOR), null,
            'the previous machine\'s last frame is NOT replayed onto the new one');

        h.opened[1].open();
        h.opened[1].message({ r1: 2.01 });
        assert.deepEqual(frames, [{ r1: 1.42 }, { r1: 2.01 }], 'the same subscriber, uninterrupted');
        h.discovery.stop();
    });

    test('{"error":"not found"} is a signal that detaches and re-discovers', async () => {
        const h = harness();
        const frames = []; const signals = [];
        h.discovery.subscribe(SENSOR_KIND.PUCK_ESTIMATOR, (f) => frames.push(f));
        h.discovery.onSignal(SENSOR_KIND.PUCK_ESTIMATOR, (s) => signals.push(s));
        h.discovery.start();
        await h.clock.fire();
        h.opened[0].open();
        h.opened[0].message({ error: 'not found' });

        assert.deepEqual(frames, [], 'an error envelope is never a frame — it must not read as "no channels"');
        assert.equal(signals.some((s) => s.kind === 'error' && s.error === 'not found'), true);
        assert.equal(h.discovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), null);
        assert.equal(h.clock.pendingCount(), 1, 'and it re-discovers rather than dialling the dead id');
        h.discovery.stop();
    });

    test('a sensor that is not registered yet is simply polled for again', async () => {
        const h = harness({ listing: [] });
        h.discovery.subscribe(SENSOR_KIND.PUCK_ESTIMATOR, () => {});
        h.discovery.start();
        await h.clock.fire();
        assert.equal(h.opened.length, 0);
        assert.equal(h.clock.pendingCount(), 1);

        h.setListing(listingFor(ESTIMATOR_1));
        await h.clock.fire();
        assert.equal(h.discovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), ESTIMATOR_1);
        h.discovery.stop();
    });

    test('a failed listing detaches nothing and invents nothing', async () => {
        const h = harness();
        h.discovery.subscribe(SENSOR_KIND.PUCK_ESTIMATOR, () => {});
        h.discovery.start();
        h.setListing(new Error('connection refused'));
        await h.clock.fire();
        assert.equal(h.discovery.attachedId(SENSOR_KIND.PUCK_ESTIMATOR), null);
        assert.equal(h.clock.pendingCount(), 1, 'it asks again; it does not decide there is no estimator');
        h.discovery.stop();
    });
});

describe('reading the listing', () => {
    test('ids and kinds, with the info block kept verbatim', () => {
        const read = readSensorListing(listingFor(ESTIMATOR_1, MILK_1));
        assert.deepEqual(read.map((s) => s.kind), ['puckEstimator', 'milkProbe']);
        assert.equal(read[0].info.vendor, 'Bengle');
    });

    test('an unrecognised id is listed with a null kind, not dropped', () => {
        const read = readSensorListing([{ id: 'difluid:r2', info: null }]);
        assert.deepEqual(read, [{ id: 'difluid:r2', kind: null, info: null }]);
    });

    test('a shape this build cannot read is null, not an empty list', () => {
        assert.equal(readSensorListing(null), null);
        assert.equal(readSensorListing({}), null);
        assert.equal(readSensorListing([{ noId: true }]), null);
    });
});

describe('stop', () => {
    test('stop closes every socket and cancels the poll', async () => {
        const h = harness();
        h.discovery.subscribe(SENSOR_KIND.PUCK_ESTIMATOR, () => {});
        h.discovery.start();
        await h.clock.fire();
        h.discovery.stop();
        assert.equal(h.opened[0].closed, true);
        assert.equal(h.clock.pendingCount(), 0);
        assert.deepEqual(h.discovery.status().kinds, []);
    });
});

/* ────────────────────────────────────────────────────────────────────────────────────
 * RULE 2 IS BOUNDED NOW.
 *
 * "The close IS the signal. It costs one GET" is right for the case it was written for — a
 * machine swap — and had no bound for the case it was not: the listing and the socket
 * DISAGREEING. `sensors_handler.dart` shares `_controller.sensors` between the listing and
 * the upgrade, so a deregistration mid-flight leaves an id the GET still carries and the
 * socket refuses. Both handlers re-armed at 0 ms and discovery re-attached at once.
 */
describe('re-discovery is bounded when the listing and the socket disagree', () => {
    const attachOnce = async (h) => {
        h.discovery.subscribe(SENSOR_KIND.PUCK_ESTIMATOR, () => {});
        h.discovery.start();
        await new Promise((resolve) => setImmediate(resolve));
        await new Promise((resolve) => setImmediate(resolve));
    };

    test('an id the listing keeps but the socket refuses backs off instead of spinning', async () => {
        const h = harness();
        await attachOnce(h);
        assert.equal(h.opened.length, 1, 'attached once');

        const delays = [];
        for (let round = 0; round < 5; round += 1) {
            // The socket answers the refusal ReaPrime actually sends, then closes.
            h.opened.at(-1).message({ error: 'not found' });
            delays.push(...h.clock.armedDelays());
            await h.clock.fire();
        }
        assert.deepEqual(delays, [0, 1000, 2000, 4000, 8000], 'the first retry is free, the rest widen');
        assert.ok(delays.every((d) => d <= REDISCOVERY_BACKOFF_MS.max));
    });

    test('the backoff is capped at the poll interval — it never grows without limit', async () => {
        const h = harness();
        await attachOnce(h);
        let last = 0;
        for (let round = 0; round < 8; round += 1) {
            h.opened.at(-1).message({ error: 'not found' });
            [last] = h.clock.armedDelays();
            await h.clock.fire();
        }
        assert.equal(last, REDISCOVERY_BACKOFF_MS.max);
        assert.equal(REDISCOVERY_BACKOFF_MS.max, 15000);
    });

    test('a FRAME resets it, so a real machine swap still costs one immediate GET', async () => {
        const h = harness();
        await attachOnce(h);
        h.opened.at(-1).message({ error: 'not found' });
        assert.deepEqual(h.clock.armedDelays(), [0]);
        await h.clock.fire();
        h.opened.at(-1).message({ error: 'not found' });
        assert.deepEqual(h.clock.armedDelays(), [1000], 'widened');
        await h.clock.fire();

        // The sensor starts working: one frame is the evidence the attachment is real.
        h.opened.at(-1).message({ timestamp: '2026-08-17T09:00:00.000', r1: 4.2, r2: 1.9 });
        h.setListing(listingFor(ESTIMATOR_2));
        h.opened.at(-1).serverClose();
        assert.deepEqual(h.clock.armedDelays(), [0], 'the swap is discovered at once, as rule 2 says');
    });

    test('the discovery route is read out of the generated table, not spelled here', () => {
        assert.equal(SENSORS_ROUTE_ID, 'getSensors');
        assert.equal(SENSORS_ROUTE, '/sensors');
    });
});
