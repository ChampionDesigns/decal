
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createEstimatorLinkStore, ESTIMATOR_LINK_CHANNELS, LINK_STATE } from '../src/stores/estimator-link-store.js';
import { createSensorDiscovery, SENSOR_KIND } from '../src/data/rea-sensors.js';
import { createReaSockets } from '../src/data/rea-sockets.js';
import { hasReading, isNoReading } from '../src/data/reading.js';
import { DEAD_NAMES_GLOBAL, ESTIMATOR_CHANNELS } from '../src/data/rea-names.js';
import { stripComments } from '../scripts/lib/source-scan.js';

const MACHINE_1 = 'usb:1-4.2';
const MACHINE_2 = 'usb:1-4.3';
const estimatorId = (machine) => `${machine}-puckestimator`;

const listingFor = (...ids) => ids.map((id) => ({
    id,
    info: { name: 'Bengle Puck Estimator', vendor: 'DecentEspresso', data: [{ key: 'r1', type: 'number', unit: 'bar·s/mL' }], commands: [] },
}));

/** `encodeSample` with everything observed. The always-present six are unconditional. */
const fullFrame = (over = {}) => ({
    timestamp: '2026-08-17T00:00:00.000Z',
    rev: 3,
    flags: 0x08,
    r1: 4.5,
    r2: 1.8,
    compliance: 1.48,
    confidence: 0.9,
    lag: 0.4,
    lagConfidence: 0.8,
    sigmaQ: 0.05,
    absorbedVolume: 3.2,
    lastPauseTau: 1.1,
    collapseEventCount: 2,
    collapseLastEventT: 12.5,
    collapseLastEventMagnitude: 0.3,
    collapseLastEventConcavity: -0.2,
    hydraulicPowerMeasured: 2.4,
    ...over,
});

/** Pre-rev-3 firmware: measured power is simply not on the wire. */
const rev2Frame = () => {
    const frame = fullFrame({ rev: 2 });
    delete frame.hydraulicPowerMeasured;
    delete frame.r2;
    return frame;
};

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

function harness({ gate = () => true, listing = listingFor(estimatorId(MACHINE_1)) } = {}) {
    const calls = [];
    const opened = [];
    let currentListing = listing;
    const transport = {
        get: async (path) => {
            calls.push(path);
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
        transport, sockets, capabilityGate: gate, intervalMs: 15000, timers: clock.timers,
    });
    const store = createEstimatorLinkStore({ discovery, now: () => 42 });
    const settle = () => new Promise((resolve) => setImmediate(resolve));
    return {
        store, discovery, sockets, opened, clock, calls, settle,
        setListing: (next) => { currentListing = next; },
        live: () => opened.filter((s) => !s.closed),
    };
}

describe('starting is explicit', () => {
    test('construction discovers nothing and opens nothing', async () => {
        const h = harness();
        await h.settle();
        assert.deepEqual(h.calls, []);
        assert.equal(h.opened.length, 0);
        assert.equal(h.store.state.status, LINK_STATE.STOPPED);
    });

    test('discovery must be injected', () => {
        assert.throws(() => createEstimatorLinkStore({}), /sensor discovery must be injected/);
    });

    test('start() is idempotent', async () => {
        const h = harness();
        h.store.start(); h.store.start(); h.store.start();
        await h.settle(); await h.settle();
        assert.equal(h.live().length, 1);
    });
});

describe('the poll is capability-gated (R3)', () => {
    test('a closed gate polls the listing not at all', async () => {
        const h = harness({ gate: () => false });
        h.store.start();
        await h.settle(); await h.settle();
        assert.deepEqual(h.calls, []);
        assert.equal(h.store.state.sensorId, null);
    });

    test('an open gate discovers and attaches', async () => {
        const h = harness();
        h.store.start();
        await h.settle(); await h.settle();
        assert.deepEqual(h.calls, ['/sensors']);
        assert.equal(h.store.sensorId(), estimatorId(MACHINE_1));
    });
});

describe('frames arrive as readings, and absence stays absence', () => {
    async function attached(opts) {
        const h = harness(opts);
        h.store.start();
        await h.settle(); await h.settle();
        return h;
    }

    test('a full frame lands with every channel present', async () => {
        const h = await attached();
        h.live()[0].message(fullFrame());
        assert.equal(h.store.state.status, LINK_STATE.ATTACHED);
        assert.equal(h.store.state.frames, 1);
        assert.equal(h.store.state.rev, 3);
        for (const channel of ESTIMATOR_LINK_CHANNELS) {
            assert.ok(h.store.has(channel), `${channel} should be present`);
        }
    });

    test('an omitted channel is an ABSENCE, never a zero', async () => {
        const h = await attached();
        h.live()[0].message(rev2Frame());
        assert.equal(h.store.has('hydraulicPowerMeasured'), false);
        assert.equal(h.store.has('r2'), false);
        assert.equal(h.store.has('r1'), true);
        const folded = h.store.apply({}).estimator.channels;
        assert.ok(isNoReading(folded.hydraulicPowerMeasured));
        assert.notEqual(folded.hydraulicPowerMeasured, 0);
        assert.ok(hasReading(folded.r1));
    });

    test('a channel reading zero is PRESENT — 0 is a measurement', async () => {
        const h = await attached();
        h.live()[0].message(fullFrame({ r2: 0 }));
        assert.equal(h.store.has('r2'), true);
        assert.equal(h.store.apply({}).estimator.channels.r2, 0);
    });
});

describe('apply returns new state and translates nothing', () => {
    test('the sample is not mutated and the estimator keeps its own namespace', async () => {
        const h = harness();
        h.store.start();
        await h.settle(); await h.settle();
        h.live()[0].message(fullFrame());
        const sample = { machine: { pressure: 9 } };
        const applied = h.store.apply(sample);
        assert.notEqual(applied, sample);
        assert.equal(sample.estimator, undefined, 'apply mutated its argument');
        assert.equal(applied.machine, sample.machine);
        assert.equal(applied.estimator.ok, true);
        assert.equal(applied.estimator.sensorId, estimatorId(MACHINE_1));
        assert.ok(Object.isFrozen(applied));
    });

    test('NO legacy back-translation: not one dead name in the applied shape', async () => {
        const h = harness();
        h.store.start();
        await h.settle(); await h.settle();
        h.live()[0].message(fullFrame());
        const applied = h.store.apply({ machine: {} });
        const keys = Object.keys(applied.estimator.channels);
        for (const dead of DEAD_NAMES_GLOBAL) {
            assert.ok(!keys.includes(dead), `apply() emits the dead name ${dead}`);
        }
        assert.deepEqual(keys.sort(), [...ESTIMATOR_LINK_CHANNELS].sort());
    });

    test('with no frame held the shape is the same and every channel is absent', () => {
        const h = harness();
        const applied = h.store.apply({ machine: {} });
        assert.equal(applied.estimator.ok, false);
        assert.deepEqual(Object.keys(applied.estimator.channels).sort(), [...ESTIMATOR_LINK_CHANNELS].sort());
        for (const channel of ESTIMATOR_LINK_CHANNELS) {
            assert.ok(isNoReading(applied.estimator.channels[channel]));
        }
    });
});

describe('RE-DISCOVERY — the machine swap', () => {
    test('close, re-discover, retarget: the id changes and the old frame goes', async () => {
        const h = harness();
        h.store.start();
        await h.settle(); await h.settle();
        h.live()[0].message(fullFrame());
        assert.equal(h.store.sensorId(), estimatorId(MACHINE_1));
        assert.equal(h.store.has('r1'), true);

        h.setListing(listingFor(estimatorId(MACHINE_2)));
        h.live()[0].serverClose();
        await h.settle();

        assert.equal(h.store.sensorId(), null);
        assert.equal(h.store.has('r1'), false);
        assert.equal(h.store.state.status, LINK_STATE.DISCOVERING);

        await h.clock.fire();
        await h.settle();
        assert.equal(h.store.sensorId(), estimatorId(MACHINE_2), 'discovery did not re-run after the close');
        assert.equal(h.calls.length, 2);

        h.live()[0].message(fullFrame({ r1: 7.7 }));
        assert.equal(h.store.apply({}).estimator.channels.r1, 7.7);
        assert.equal(h.store.apply({}).estimator.sensorId, estimatorId(MACHINE_2));
    });

    test('an error envelope is a signal: the link clears and re-discovers', async () => {
        const h = harness();
        h.store.start();
        await h.settle(); await h.settle();
        h.live()[0].message(fullFrame());
        h.live()[0].message({ error: 'not found' });
        await h.settle();
        assert.equal(h.store.has('r1'), false);
        assert.equal(h.store.state.lastError, 'not found');
        assert.equal(h.store.state.sensorId, null);
        await h.clock.fire();
        await h.settle();
        assert.equal(h.calls.length, 2, 'an error envelope did not trigger re-discovery');
    });

    test('a late subscriber never sees a frame from the previous sensor', async () => {
        const h = harness();
        h.store.start();
        await h.settle(); await h.settle();
        h.live()[0].message(fullFrame());
        h.setListing(listingFor(estimatorId(MACHINE_2)));
        h.live()[0].serverClose();
        await h.settle();
        const seen = [];
        h.store.subscribe((state) => seen.push(state.sensorId));
        assert.deepEqual(seen, [null]);
    });

    test('stop() closes the socket and empties the state', async () => {
        const h = harness();
        h.store.start();
        await h.settle(); await h.settle();
        h.live()[0].message(fullFrame());
        h.store.stop();
        assert.equal(h.live().length, 0);
        assert.equal(h.store.state.status, LINK_STATE.STOPPED);
        assert.equal(h.store.state.channels, null);
    });
});

describe('the module reads no name of its own', () => {
    const SOURCE = readFileSync(fileURLToPath(new URL('../src/stores/estimator-link-store.js', import.meta.url)), 'utf8');
    const CODE = stripComments(SOURCE);

    test('the nine folded channels are the nine, and all three B6 quantities are inside them', () => {
        assert.equal(ESTIMATOR_LINK_CHANNELS.length, 9);
        for (const channel of ['r1', 'r2', 'hydraulicPowerMeasured']) {
            assert.ok(ESTIMATOR_LINK_CHANNELS.includes(channel), channel);
        }
    });

    test('AND THEY ARE A SUBSET of the checked-against-Dart channel list', () => {
        for (const channel of ESTIMATOR_LINK_CHANNELS) {
            assert.ok(ESTIMATOR_CHANNELS.includes(channel),
                `${channel} is not one of the estimator's own channels`);
        }
    });

    test('no route is spelled here — the listing GET and the socket belong to rea-sensors', () => {
        assert.ok(!/\/api\/v1|\/ws\/v1|\/sensors/.test(CODE), 'the estimator store spells a route');
    });
});
