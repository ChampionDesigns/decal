
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createLiveStores, FEED, sensorSource, sourceSelectorHooks } from '../src/stores/live-stores.js';
import { FEED_STATUS } from '../src/stores/feed-store.js';
import { createShotSourceSelector, SOURCE } from '../src/stores/shot-source-selector.js';
import { WS_CHANNELS } from '../src/data/rea-ws-channels.js';
import { SENSOR_KIND } from '../src/data/rea-sensors.js';

const base = Date.parse('2026-08-17T09:15:00.000Z');
const at = (ms) => new Date(base + ms).toISOString();

/** A fake socket layer with the same surface `createReaSockets` returns. */
function fakeSockets() {
    const channels = new Map();
    const make = (key, path) => {
        const frames = new Set();
        const signals = new Set();
        let last = null;
        return {
            key,
            path,
            subscribe(listener) { frames.add(listener); return () => frames.delete(listener); },
            onSignal(listener) { signals.add(listener); return () => signals.delete(listener); },
            last: () => last,
            emit(frame) { last = frame; for (const l of [...frames]) l(frame); },
            signal(signal) { for (const l of [...signals]) l(signal); },
            subscribers: () => frames.size,
        };
    };
    return {
        channel({ key, path }) {
            if (!channels.has(key)) channels.set(key, make(key, path));
            return channels.get(key);
        },
        get: (key) => channels.get(key) || null,
        opened: () => [...channels.keys()],
        chan: (key) => channels.get(key),
    };
}

function fakeSensorDiscovery(ids = {}) {
    const kinds = new Map();
    const entry = (kind) => {
        if (!kinds.has(kind)) kinds.set(kind, { frames: new Set(), signals: new Set(), last: null });
        return kinds.get(kind);
    };
    return {
        started: 0,
        stopped: 0,
        subscribe(kind, listener) { entry(kind).frames.add(listener); return () => entry(kind).frames.delete(listener); },
        onSignal(kind, listener) { entry(kind).signals.add(listener); return () => entry(kind).signals.delete(listener); },
        last: (kind) => entry(kind).last,
        attachedId: (kind) => ids[kind] ?? null,
        start() { this.started += 1; return this; },
        stop() { this.stopped += 1; },
        emit(kind, frame) { const e = entry(kind); e.last = frame; for (const l of [...e.frames]) l(frame); },
        signal(kind, signal) { for (const l of [...entry(kind).signals]) l(signal); },
        subscribers: (kind) => entry(kind).frames.size,
    };
}

const machineFrame = (ms) => ({
    timestamp: at(ms),
    state: { state: 'espresso', substate: 'pouring' },
    flow: 2.1,
    pressure: 8.6,
    targetFlow: 2,
    targetPressure: 9,
    mixTemperature: 92,
    groupTemperature: 88,
    targetMixTemperature: 92,
    targetGroupTemperature: 88,
    profileFrame: 3,
    steamTemperature: 140,
    // Gated derived channels: OMITTED, not null — key presence is the validity signal.
    puckResistanceDerived: 4.2,
});

describe('construction', () => {
    test('sockets must be injected', () => {
        assert.throws(() => createLiveStores({}), /sockets must be injected/);
    });

    test('the seven named feeds all exist, plus the sensors and the tank', () => {
        const live = createLiveStores({ sockets: fakeSockets() });
        assert.deepEqual(Object.keys(live.feeds).sort(), [
            'connection', 'display', 'estimator', 'machineSnapshot', 'milkProbe', 'scale',
            'shotState', 'update', 'waterLevels',
        ]);
        assert.equal(live.feed(FEED.MACHINE).get().status, FEED_STATUS.NEVER);
    });

    test('an unknown feed name throws rather than answering undefined', () => {
        const live = createLiveStores({ sockets: fakeSockets() });
        assert.throws(() => live.feed('milkTemperature'), /no feed named/);
    });

    test('nothing opens until attachAll — no socket dialled at construction', () => {
        const sockets = fakeSockets();
        createLiveStores({ sockets });
        assert.deepEqual(sockets.opened(), []);
    });
});

describe('attachAll opens exactly the channels the socket table names', () => {
    test('seven channels, by their table keys and paths', () => {
        const sockets = fakeSockets();
        createLiveStores({ sockets }).attachAll();
        assert.deepEqual(sockets.opened().sort(), [
            'devices', 'display', 'machineSnapshot', 'scaleSnapshot', 'shotState', 'update',
            'waterLevels',
        ]);
        assert.equal(sockets.chan('waterLevels').path, WS_CHANNELS.waterLevels.path);
        assert.equal(sockets.chan('machineSnapshot').path, WS_CHANNELS.machineSnapshot.path);
        assert.equal(sockets.chan('devices').path, WS_CHANNELS.devices.path);
    });

    test('attaching twice does not double-subscribe', () => {
        const sockets = fakeSockets();
        const live = createLiveStores({ sockets }).attachAll();
        live.attachAll();
        assert.equal(sockets.chan('machineSnapshot').subscribers(), 1);
    });

    test('detachAll releases every subscription and leaves the values behind, stale', () => {
        const sockets = fakeSockets();
        const live = createLiveStores({ sockets }).attachAll();
        sockets.chan('machineSnapshot').emit(machineFrame(0));
        live.detachAll();
        assert.equal(sockets.chan('machineSnapshot').subscribers(), 0);
        const state = live.feed(FEED.MACHINE).get();
        assert.equal(state.status, FEED_STATUS.STALE);
        assert.equal(state.value.pressure, 8.6);
        assert.equal(live.attached(), false);
    });
});

describe('each feed is read by the address layer, and by nothing else', () => {
    test('the machine snapshot arrives read, with key-presence validity intact', () => {
        const sockets = fakeSockets();
        const live = createLiveStores({ sockets }).attachAll();
        sockets.chan('machineSnapshot').emit(machineFrame(0));
        const value = live.feed(FEED.MACHINE).get().value;
        assert.equal(value.pressure, 8.6);
        assert.equal(value.puckResistanceDerived, 4.2, 'written -> valid');
        assert.equal(value.loadImpedanceDerived.noReading, true, 'omitted -> gated, not zero');
        assert.equal(value.stateKnown, true);
    });

    test('the scale feed carries the one gravimetric channel', () => {
        const sockets = fakeSockets();
        const live = createLiveStores({ sockets }).attachAll();
        sockets.chan('scaleSnapshot').emit({ timestamp: at(0), weight: 18.2, weightFlow: 1.9, battery: 80, timerValue: 12000 });
        assert.equal(live.feed(FEED.SCALE).get().value.weightFlow, 1.9);
    });

    test('the connection feed is the FULL B8 state, and a malformed frame reads as null', () => {
        const sockets = fakeSockets();
        const live = createLiveStores({ sockets }).attachAll();
        sockets.chan('devices').emit({
            timestamp: at(0),
            devices: [{ id: 'de1-abc', name: 'Bengle', type: 'machine', state: 'connected', available: true }],
            scanning: false,
            connectionStatus: {
                phase: 'connectingMachine',
                foundMachines: [{ id: 'de1-abc', name: 'Bengle', type: 'machine', state: 'disconnected' }],
                foundScales: [],
                pendingAmbiguity: 'machinePicker',
                error: null,
            },
        });
        const value = live.feed(FEED.CONNECTION).get().value;
        assert.equal(value.connectionStatus.phase, 'connectingMachine');
        assert.equal(value.connectionStatus.awaitingChoice, true, 'ReaPrime is parked waiting for the answer');
        assert.equal(value.machine.id, 'de1-abc');

        sockets.chan('devices').emit({ devices: 'not a list', scanning: false });
        assert.equal(live.feed(FEED.CONNECTION).get().value, null, 'null is "unknown", which is not an empty list');
    });

    test('display and update are read as their handlers write them', () => {
        const sockets = fakeSockets();
        const live = createLiveStores({ sockets }).attachAll();
        sockets.chan('display').emit({
            wakeLockEnabled: true, wakeLockOverride: false, brightness: 70,
            requestedBrightness: 100, lowBatteryBrightnessActive: true,
            platformSupported: { brightness: true, wakeLock: true },
        });
        sockets.chan('update').emit({
            phase: 'downloading', currentVersion: '1.4.2', latestVersion: '1.5.0',
            releaseNotes: null, releaseUrl: 'https://example.invalid', installable: true,
            progress: 0.42, error: null,
        });
        assert.equal(live.feed(FEED.DISPLAY).get().value.brightness, 70);
        assert.equal(live.feed(FEED.UPDATE).get().value.progress, 0.42);
    });
});

describe('the devices link owns the devices socket when one is injected', () => {
    test('the feed attaches to the LINK\'s channel — one socket, state and answer together', () => {
        const sockets = fakeSockets();
        const linkChannel = sockets.channel({ key: 'devices', path: WS_CHANNELS.devices.path });
        const devicesLink = { channel: linkChannel, connect: async () => ({ ok: true }) };
        const live = createLiveStores({ sockets, devicesLink }).attachAll();
        assert.equal(linkChannel.subscribers(), 1);
        assert.equal(live.devices, devicesLink, 'the B8 answer path is re-exposed, never re-implemented');
    });
});

describe('sensors', () => {
    test('the two sensor feeds attach through discovery, which is started explicitly', () => {
        const discovery = fakeSensorDiscovery({ puckEstimator: 'de1-abc-puckestimator' });
        const live = createLiveStores({ sockets: fakeSockets(), sensorDiscovery: discovery }).attachAll();
        assert.equal(discovery.started, 1);
        assert.equal(discovery.subscribers(SENSOR_KIND.PUCK_ESTIMATOR), 1);
        discovery.emit(SENSOR_KIND.PUCK_ESTIMATOR, { timestamp: at(0), r1: 4.2, r2: 1.1, compliance: 0.3, flags: 0 });
        assert.equal(live.feed(FEED.ESTIMATOR).get().value.channels.r1, 4.2);
    });

    test('an error envelope on a sensor is a signal — the value is kept and marked, never emptied', () => {
        const discovery = fakeSensorDiscovery({ puckEstimator: 'de1-abc-puckestimator' });
        const live = createLiveStores({ sockets: fakeSockets(), sensorDiscovery: discovery }).attachAll();
        discovery.emit(SENSOR_KIND.PUCK_ESTIMATOR, { timestamp: at(0), r1: 4.2, r2: 1.1, compliance: 0.3, flags: 0 });
        discovery.signal(SENSOR_KIND.PUCK_ESTIMATOR, { kind: 'error', error: 'not found' });
        const state = live.feed(FEED.ESTIMATOR).get();
        assert.equal(state.error, 'not found');
        assert.equal(state.value.channels.r1, 4.2, 'the last real reading, now stale');
        assert.equal(state.status, FEED_STATUS.STALE);
    });

    test('detachAll stops discovery too', () => {
        const discovery = fakeSensorDiscovery();
        createLiveStores({ sockets: fakeSockets(), sensorDiscovery: discovery }).attachAll().detachAll();
        assert.equal(discovery.stopped, 1);
    });

    test('with no discovery injected the sensor feeds simply never fill — no invented channels', () => {
        const live = createLiveStores({ sockets: fakeSockets() }).attachAll();
        assert.equal(live.feed(FEED.ESTIMATOR).get().status, FEED_STATUS.NEVER);
        assert.equal(live.feed(FEED.ESTIMATOR).attached(), false);
    });

    test('sensorSource refuses a discovery it cannot use', () => {
        assert.throws(() => sensorSource(null, SENSOR_KIND.MILK_PROBE), /discovery is required/);
    });
});

describe('the shot buffer is fed from the same feeds, in the recorded shape', () => {
    test('a shot accumulates once, with the scale and the estimator attached at each sample', () => {
        const sockets = fakeSockets();
        const discovery = fakeSensorDiscovery({ puckEstimator: 'de1-abc-puckestimator' });
        const live = createLiveStores({ sockets, sensorDiscovery: discovery }).attachAll();

        sockets.chan('scaleSnapshot').emit({ timestamp: at(0), weight: 0, weightFlow: 0, battery: 80, timerValue: 0 });
        discovery.emit(SENSOR_KIND.PUCK_ESTIMATOR, { timestamp: at(0), r1: 4.2, r2: 1.1, compliance: 0.3, flags: 0 });
        sockets.chan('shotState').emit({ event: 'state', timestamp: at(0), shotId: 'shot-1', state: 'preheating' });
        sockets.chan('machineSnapshot').emit(machineFrame(0));
        sockets.chan('machineSnapshot').emit(machineFrame(100));

        const shot = live.shot.get();
        assert.equal(shot.shotId, 'shot-1');
        assert.equal(shot.joinedLate, false);
        assert.equal(shot.sampleCount, 2);
        assert.equal(shot.lastSample.scale.weight, 0);
        assert.equal(shot.lastSample.sensors['de1-abc-puckestimator'].r1, 4.2);
        assert.equal(Object.hasOwn(shot.lastSample, 'volume'), false);
    });

    test('a stale sensor contributes NOTHING to a sample rather than a stale reading', () => {
        const sockets = fakeSockets();
        const discovery = fakeSensorDiscovery({ puckEstimator: 'de1-abc-puckestimator' });
        const live = createLiveStores({ sockets, sensorDiscovery: discovery }).attachAll();
        discovery.emit(SENSOR_KIND.PUCK_ESTIMATOR, { timestamp: at(0), r1: 4.2, r2: 1.1, compliance: 0.3, flags: 0 });
        discovery.signal(SENSOR_KIND.PUCK_ESTIMATOR, { kind: 'close' });
        sockets.chan('shotState').emit({ event: 'state', timestamp: at(0), shotId: 'shot-1', state: 'pouring' });
        sockets.chan('machineSnapshot').emit(machineFrame(0));
        assert.equal(Object.hasOwn(live.shot.get().lastSample, 'sensors'), false);
    });

    test('the shot ends where the sequencer says, and the samples stay for the summary', () => {
        const sockets = fakeSockets();
        const live = createLiveStores({ sockets }).attachAll();
        sockets.chan('shotState').emit({ event: 'state', timestamp: at(0), shotId: 'shot-1', state: 'pouring' });
        sockets.chan('machineSnapshot').emit(machineFrame(0));
        sockets.chan('shotState').emit({ event: 'state', timestamp: at(200), shotId: 'shot-1', state: 'finished' });
        assert.equal(live.shot.get().open, false);
        assert.equal(live.shot.get().sampleCount, 1);
    });
});

describe('B6: the real source selector, decided at the first sample and held', () => {
    const withSelector = (sensorId) => {
        const sockets = fakeSockets();
        const discovery = fakeSensorDiscovery(sensorId ? { puckEstimator: sensorId } : {});
        const selector = createShotSourceSelector({ now: () => 1000 });
        const live = createLiveStores({ sockets, sensorDiscovery: discovery, sourceSelector: selector }).attachAll();
        return { sockets, discovery, selector, live };
    };

    test('the estimator wins when its channels are on the first sample', () => {
        const { sockets, discovery, live } = withSelector('de1-abc-puckestimator');
        discovery.emit(SENSOR_KIND.PUCK_ESTIMATOR, { timestamp: at(0), r1: 4.2, r2: 8.1, compliance: 0.3, flags: 0, hydraulicPowerMeasured: 5.5 });
        sockets.chan('shotState').emit({ event: 'state', timestamp: at(0), shotId: 'shot-1', state: 'preheating' });
        sockets.chan('machineSnapshot').emit(machineFrame(0));
        assert.deepEqual(live.shot.get().sources, {
            resistance: SOURCE.ESTIMATOR, impedance: SOURCE.ESTIMATOR, power: SOURCE.ESTIMATOR,
        });
    });

    test('with no estimator attached it holds the derived channel the frame actually carries', () => {
        const { sockets, live } = withSelector(null);
        sockets.chan('shotState').emit({ event: 'state', timestamp: at(0), shotId: 'shot-1', state: 'preheating' });
        sockets.chan('machineSnapshot').emit(machineFrame(0));   // carries puckResistanceDerived only
        assert.deepEqual(live.shot.get().sources, {
            resistance: SOURCE.DERIVED,
            impedance: SOURCE.NONE,
            power: SOURCE.NONE,
        }, 'a gated-away key is not a source, and `none` is a real answer');
    });

    test('a later sample cannot change the choice — that is the whole rule', () => {
        const { sockets, discovery, live } = withSelector('de1-abc-puckestimator');
        sockets.chan('shotState').emit({ event: 'state', timestamp: at(0), shotId: 'shot-1', state: 'preheating' });
        sockets.chan('machineSnapshot').emit(machineFrame(0));
        assert.equal(live.shot.get().sources.resistance, SOURCE.DERIVED);
        discovery.emit(SENSOR_KIND.PUCK_ESTIMATOR, { timestamp: at(100), r1: 4.2, r2: 8.1, compliance: 0.3, flags: 0 });
        sockets.chan('machineSnapshot').emit(machineFrame(100));
        assert.equal(live.shot.get().sources.resistance, SOURCE.DERIVED, 'held for the shot');
    });

    test('the decision is released at the end of the shot, so the next one decides afresh', () => {
        const { sockets, discovery, selector, live } = withSelector('de1-abc-puckestimator');
        sockets.chan('shotState').emit({ event: 'state', timestamp: at(0), shotId: 'shot-1', state: 'pouring' });
        sockets.chan('machineSnapshot').emit(machineFrame(0));
        assert.equal(selector.active, true);
        sockets.chan('shotState').emit({ event: 'state', timestamp: at(200), shotId: 'shot-1', state: 'finished' });
        assert.equal(selector.active, false, 'no decision outlives its shot');
        assert.equal(live.shot.get().sources.resistance, SOURCE.DERIVED, 'the RECORD stays, for the summary');

        discovery.emit(SENSOR_KIND.PUCK_ESTIMATOR, { timestamp: at(300), r1: 4.2, r2: 8.1, compliance: 0.3, flags: 0 });
        sockets.chan('shotState').emit({ event: 'state', timestamp: at(400), shotId: 'shot-2', state: 'pouring' });
        sockets.chan('machineSnapshot').emit(machineFrame(400));
        assert.equal(live.shot.get().sources.resistance, SOURCE.ESTIMATOR, 'a new shot, a new decision');
    });

    test('two B6 wirings at once are refused rather than silently ranked', () => {
        assert.throws(
            () => createLiveStores({ sockets: fakeSockets(), sourceSelector: createShotSourceSelector(), chooseSources: () => ({}) }),
            /not both/,
        );
    });

    test('the adapter refuses anything that is not a selector', () => {
        assert.throws(() => sourceSelectorHooks({}), /selector is required/);
    });
});

describe('staleness and status are driven, not timed', () => {
    test('refreshStaleness re-classifies every feed at an injected instant', () => {
        const sockets = fakeSockets();
        let now = 1000;
        const live = createLiveStores({ sockets, clock: () => now }).attachAll();
        sockets.chan('machineSnapshot').emit(machineFrame(0));
        now += 5000;
        assert.equal(live.feed(FEED.MACHINE).get().status, FEED_STATUS.LIVE, 'nothing ticks by itself');
        live.refreshStaleness();
        assert.equal(live.feed(FEED.MACHINE).get().status, FEED_STATUS.STALE);
    });

    test('status() is the one diagnostic a bench session reads', () => {
        const sockets = fakeSockets();
        let now = 1000;
        const live = createLiveStores({ sockets, clock: () => now }).attachAll();
        sockets.chan('machineSnapshot').emit(machineFrame(0));
        now += 250;
        const status = live.status();
        assert.equal(status[FEED.MACHINE].frames, 1);
        assert.equal(status[FEED.MACHINE].ageMs, 250);
        assert.equal(status[FEED.MACHINE].attached, true);
        assert.equal(status[FEED.SHOT_STATE].frames, 0);
    });

    test('per-feed budgets can be overridden without touching the defaults', () => {
        const sockets = fakeSockets();
        let now = 1000;
        const live = createLiveStores({ sockets, clock: () => now, staleAfterMs: { machineSnapshot: 500 } }).attachAll();
        sockets.chan('machineSnapshot').emit(machineFrame(0));
        now += 600;
        live.refreshStaleness();
        assert.equal(live.feed(FEED.MACHINE).get().status, FEED_STATUS.STALE);
    });

    test('destroy tears the whole layer down', () => {
        const sockets = fakeSockets();
        const live = createLiveStores({ sockets }).attachAll();
        live.feed(FEED.MACHINE).subscribe(() => {});
        live.destroy();
        assert.equal(live.feed(FEED.MACHINE).size(), 0);
        assert.equal(sockets.chan('machineSnapshot').subscribers(), 0);
    });
});
