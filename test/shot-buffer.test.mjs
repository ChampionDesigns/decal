
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createShotBuffer, attachShotBuffer, DEFAULT_MAX_SAMPLES } from '../src/stores/shot-buffer.js';
import { readShotStateFrame, SHOT_STATE } from '../src/stores/feed-readers.js';
import { createFeedStore, FEED_STATUS } from '../src/stores/feed-store.js';
import { ORIGIN_RULE } from '../src/stores/time-axis.js';
import { readMachineSnapshot, readScaleSnapshot } from '../src/data/rea-address.js';

const SHOT = '7f6f1e2a-0000-4000-8000-000000000001';
const base = Date.parse('2026-08-17T09:15:00.000Z');
const at = (ms) => new Date(base + ms).toISOString();

const shotStateFrame = (state, shotId = SHOT) => readShotStateFrame({
    event: 'state',
    timestamp: at(0),
    shotId,
    state,
    machineState: 'espresso',
    machineSubstate: state === SHOT_STATE.POURING ? 'pouring' : 'preparingForShot',
    profileFrame: 1,
    scaleConnected: true,
    scaleLost: false,
    machineHasAutonomousSAW: true,
    decision: null,
});

const machineFrame = (ms, substate = 'pouring') => ({
    timestamp: at(ms),
    state: { state: 'espresso', substate },
    flow: 2.1,
    pressure: 8.6,
    targetFlow: 2.0,
    targetPressure: 9.0,
    mixTemperature: 92.1,
    groupTemperature: 88.4,
    targetMixTemperature: 92,
    targetGroupTemperature: 88,
    profileFrame: 3,
    steamTemperature: 140,
});

describe('lifecycle comes from the sequencer, not from watching substates', () => {
    test('a new shotId opens a buffer', () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.PREHEATING));
        const state = buffer.get();
        assert.equal(state.open, true);
        assert.equal(state.shotId, SHOT);
        assert.equal(state.phase, SHOT_STATE.PREHEATING);
        assert.equal(state.joinedLate, false, 'we were here from preheating');
        assert.equal(state.sampleCount, 0);
    });

    test('joining at pouring records that the earlier samples are GONE, and backfills nothing', () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        assert.equal(buffer.get().joinedLate, true);
        assert.equal(buffer.get().sampleCount, 0, 'nothing is reconstructed');
    });

    test('the same replayed reading does not re-open the shot it already opened', () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        buffer.addSample({ machine: machineFrame(0) });
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        assert.equal(buffer.get().sampleCount, 1, 'the replay must not clear the shot');
    });

    test('finished closes the buffer and KEEPS the samples for the post-shot summary', () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        buffer.addSample({ machine: machineFrame(0) });
        buffer.noteShotState(shotStateFrame(SHOT_STATE.FINISHED));
        assert.equal(buffer.get().open, false);
        assert.equal(buffer.get().phase, SHOT_STATE.FINISHED);
        assert.equal(buffer.get().sampleCount, 1);
        assert.notEqual(buffer.get().closedAt, null);
    });

    test('the idle frame published at cleanup — no shotId — closes the shot', () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        buffer.noteShotState(shotStateFrame(SHOT_STATE.IDLE, null));
        assert.equal(buffer.get().open, false);
    });

    test('a second shot starts clean rather than appending to the first', () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.PREHEATING));
        buffer.addSample({ machine: machineFrame(0) });
        buffer.noteShotState(shotStateFrame(SHOT_STATE.PREHEATING, 'a-second-shot'));
        assert.equal(buffer.get().sampleCount, 0);
        assert.equal(buffer.get().shotId, 'a-second-shot');
    });

    test('an unreadable shot-state frame changes nothing — it is not read as idle', () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        buffer.noteShotState(readShotStateFrame(null));
        assert.equal(buffer.get().open, true, 'a malformed frame never ends a live shot');
    });
});

describe('samples are in the RECORDED shape, and nothing is added to them', () => {
    test('machine, scale — and no volume, because the wire carries none', () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        buffer.addSample({ machine: machineFrame(0), scale: { timestamp: at(0), weight: 18.2, weightFlow: 1.9, battery: 80, timerValue: 12000 } });
        const sample = buffer.get().lastSample;
        assert.deepEqual(Object.keys(sample), ['machine', 'scale']);
        assert.equal(Object.hasOwn(sample, 'volume'), false,
            'volume is ReaPrime\'s; integrating flow locally would be a fabrication that disagrees with the record');
    });

    test('no scale means `scale: null` — the way a recorded measurement spells it', () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        buffer.addSample({ machine: machineFrame(0) });
        assert.equal(buffer.get().lastSample.scale, null);
    });

    test('a sensors map is keyed by sensor id, and omitted entirely when there is none', () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        buffer.addSample({ machine: machineFrame(0), sensors: { 'de1-abc-puckestimator': { timestamp: at(0), r1: 4.2 } } });
        assert.deepEqual(Object.keys(buffer.get().lastSample.sensors), ['de1-abc-puckestimator']);
        buffer.addSample({ machine: machineFrame(100) });
        assert.equal(Object.hasOwn(buffer.get().lastSample, 'sensors'), false);
    });

    test('the address layer reads a buffered sample exactly as it reads a recorded one', () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        buffer.addSample({ machine: machineFrame(0), scale: { timestamp: at(0), weight: 18.2, weightFlow: 1.9, battery: 80, timerValue: 12000 } });
        const sample = buffer.get().lastSample;
        assert.equal(readMachineSnapshot(sample.machine).pressure, 8.6);
        assert.equal(readScaleSnapshot(sample.scale).weightFlow, 1.9, 'the one gravimetric source');
    });

    test('samples offered outside a shot are counted, not stored, and not logged into noise', () => {
        const buffer = createShotBuffer();
        buffer.addSample({ machine: machineFrame(0) });
        buffer.addSample({ machine: machineFrame(100) });
        assert.equal(buffer.get().sampleCount, 0);
        assert.equal(buffer.dropped().beforeOpen, 2);
    });

    test('and counting them NOTIFIES NOBODY — an idle machine is not a re-render pump', () => {
        const buffer = createShotBuffer();
        let notifications = 0;
        buffer.subscribe(() => { notifications += 1; });
        const replay = notifications;                       // the subscribe-time replay
        for (let i = 0; i < 30; i += 1) buffer.addSample({ machine: machineFrame(i * 100) });
        assert.equal(notifications - replay, 0, 'thirty idle frames, zero notifications');
        assert.equal(buffer.dropped().beforeOpen, 30);
        assert.equal(buffer.revision(), 0);
    });

    test('a sample with no machine frame is unusable and is dropped as such', () => {
        const warned = [];
        const buffer = createShotBuffer({ logger: { warn: (m) => warned.push(m) } });
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        buffer.addSample({ scale: { weight: 1 } });
        assert.equal(buffer.dropped().unusable, 1);
        assert.equal(warned.length, 1);
    });
});

describe('the cap keeps the START of the shot, which is the part that cannot be re-fetched', () => {
    test('appending stops at the cap and says so', () => {
        const buffer = createShotBuffer({ maxSamples: 3 });
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        for (let i = 0; i < 5; i += 1) buffer.addSample({ machine: machineFrame(i * 100) });
        const state = buffer.get();
        assert.equal(state.sampleCount, 3);
        assert.equal(state.capped, true);
        assert.equal(buffer.dropped().afterCap, 2);
        assert.equal(state.dropped.afterCap, 1, 'the publish at the cap transition');
        assert.equal(state.samples[0].machine.timestamp, at(0), 'the first sample survives — no ring buffer');
    });

    test('the default cap is thirty minutes at the snapshot rate', () => {
        assert.equal(DEFAULT_MAX_SAMPLES, 36000);
        assert.throws(() => createShotBuffer({ maxSamples: 0 }), /positive integer/);
    });
});

describe('t=0 is decided as samples arrive, by the same rule history uses', () => {
    test('a preinfusion sample seeds the origin and a pouring sample takes it over', () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.PREHEATING));
        buffer.addSample({ machine: machineFrame(0, 'preparingForShot') });
        assert.equal(buffer.get().origin.rule, ORIGIN_RULE.FIRST_SAMPLE);
        buffer.addSample({ machine: machineFrame(500, 'preinfusion') });
        assert.equal(buffer.get().origin.rule, ORIGIN_RULE.FIRST_POURING);
        assert.equal(buffer.get().origin.originMs, base + 500);
        buffer.addSample({ machine: machineFrame(900, 'pouring') });
        assert.equal(buffer.get().origin.originMs, base + 500, 'the FIRST pouring sample, not the latest');
    });

    test('an unstamped sample does not become the origin', () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.PREHEATING));
        buffer.addSample({ machine: { state: { state: 'espresso', substate: 'preparingForShot' } } });
        assert.equal(buffer.get().origin.originMs, null);
    });
});

describe('ONE walk, many visitors — B5 without a second traversal', () => {
    const filled = () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.PREHEATING));
        buffer.addSample({ machine: machineFrame(0, 'preinfusion') });
        buffer.addSample({ machine: machineFrame(1000, 'pouring') });
        buffer.addSample({ machine: machineFrame(2000, 'pouring') });
        return buffer;
    };

    test('every visitor sees every sample exactly once, in one traversal', () => {
        const buffer = filled();
        const visits = [0, 0];
        const visitors = visits.map((_, i) => ({
            sample: () => { visits[i] += 1; },
            finish: () => visits[i],
        }));
        const walk = buffer.walk(visitors);
        assert.deepEqual(visits, [3, 3]);
        assert.deepEqual(walk.results, [3, 3]);
        assert.equal(walk.samples, 3);
    });

    test('the position carries the stamp and the elapsed seconds, so nobody re-parses time', () => {
        const seen = [];
        filled().walk([{ sample: (_entry, position) => seen.push(position.seconds) }]);
        assert.deepEqual(seen, [0, 1, 2]);
    });

    test('an unstamped sample gets null seconds, never zero', () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        buffer.addSample({ machine: machineFrame(0) });
        buffer.addSample({ machine: { state: { state: 'espresso', substate: 'pouring' } } });
        const seen = [];
        buffer.walk([{ sample: (_e, position) => seen.push(position.seconds) }]);
        assert.deepEqual(seen, [0, null]);
    });

    test('the context carries the shot facts a scalar needs, including B6 sources', () => {
        const buffer = createShotBuffer({ chooseSources: () => ({ puckResistance: 'estimator' }) });
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        buffer.addSample({ machine: machineFrame(0) });
        let context = null;
        buffer.walk([{ start: (c) => { context = c; }, sample: () => {} }]);
        assert.equal(context.shotId, SHOT);
        assert.equal(context.joinedLate, true);
        assert.deepEqual(context.sources, { puckResistance: 'estimator' });
        assert.equal(context.originRule, ORIGIN_RULE.FIRST_POURING);
    });

    test('start and finish are optional', () => {
        const walk = filled().walk([{ sample: () => {} }]);
        assert.deepEqual(walk.results, [undefined]);
    });
});

describe('B6: the source choice is made once, from the FIRST SAMPLE, and held', () => {
    test('the selector is called once, with the shot id and the sample it decides from', () => {
        const calls = [];
        const buffer = createShotBuffer({
            chooseSources: (ctx) => { calls.push(ctx); return { puckResistance: 'estimator' }; },
        });
        buffer.noteShotState(shotStateFrame(SHOT_STATE.PREHEATING));
        assert.equal(calls.length, 0, 'not at open — at open there is no evidence to decide from');
        assert.equal(buffer.get().sourcesPending, true);

        buffer.addSample({ machine: machineFrame(0) });
        buffer.addSample({ machine: machineFrame(100) });
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        assert.equal(calls.length, 1, 'once — a channel cannot change source mid-trace');
        assert.equal(calls[0].shotId, SHOT);
        assert.equal(calls[0].sample.machine.timestamp, at(0), 'the first sample of the shot');
        assert.equal(Object.isFrozen(buffer.get().sources), true);
        assert.equal(buffer.get().sourcesPending, false);
    });

    test('the held decision is released when the shot closes, and again at the next open', () => {
        const released = [];
        const buffer = createShotBuffer({
            chooseSources: () => ({ puckResistance: 'derived' }),
            releaseSources: () => released.push('released'),
        });
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        buffer.addSample({ machine: machineFrame(0) });
        buffer.noteShotState(shotStateFrame(SHOT_STATE.FINISHED));
        assert.deepEqual(released, ['released'], 'a decision cannot outlive its shot');

        buffer.noteShotState(shotStateFrame(SHOT_STATE.PREHEATING, 'shot-2'));
        assert.equal(buffer.get().sourcesPending, true, 'a new shot decides afresh');
        assert.equal(released.length, 1, 'nothing held, nothing to release');
    });

    test('a shot that ends with no samples never decided, so nothing is released', () => {
        const released = [];
        const buffer = createShotBuffer({
            chooseSources: () => ({ puckResistance: 'derived' }),
            releaseSources: () => released.push('released'),
        });
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        buffer.noteShotState(shotStateFrame(SHOT_STATE.IDLE, null));
        assert.deepEqual(released, []);
    });

    test('with no selector injected the hole is NAMED, not filled with a default', () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        buffer.addSample({ machine: machineFrame(0) });
        assert.equal(buffer.get().sources, null);
        assert.equal(buffer.get().sourcesPending, true);
    });
});

describe('the state object changes identity on every sample', () => {
    test('so Lit sees the change, while the array is appended rather than copied', () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        const seen = [];
        buffer.subscribe((state) => seen.push(state));
        buffer.addSample({ machine: machineFrame(0) });
        buffer.addSample({ machine: machineFrame(100) });
        assert.equal(seen.length, 3, 'replay + two samples');
        assert.notEqual(seen[1], seen[2], 'a new state object each time');
        assert.equal(seen[1].samples, seen[2].samples, 'one append-only array, shared by reference');
        assert.deepEqual(seen.map((s) => s.sampleCount), [0, 1, 2], 'sampleCount is the change signal');
    });

    test('toArray hands out a copy for anything that wants to sort or slice', () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        buffer.addSample({ machine: machineFrame(0) });
        const copy = buffer.toArray();
        copy.push('not mine');
        assert.equal(buffer.get().sampleCount, 1);
    });

    test('clear forgets everything', () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        buffer.addSample({ machine: machineFrame(0) });
        buffer.clear();
        assert.deepEqual(
            [buffer.get().shotId, buffer.get().open, buffer.get().sampleCount],
            [null, false, 0],
        );
    });
});

describe('attachShotBuffer: the wiring policies', () => {
    const wire = () => {
        const machine = createFeedStore({ label: 'machineSnapshot', read: readMachineSnapshot });
        const scale = createFeedStore({ label: 'scale', read: readScaleSnapshot });
        const shotState = createFeedStore({ label: 'shotState', read: readShotStateFrame });
        const buffer = createShotBuffer();
        const detach = attachShotBuffer({ buffer, machine, shotState, scale });
        return { machine, scale, shotState, buffer, detach };
    };

    test('one machine frame is one sample; a state change that carries no frame is not', () => {
        const { machine, shotState, buffer } = wire();
        shotState.accept({ event: 'state', timestamp: at(0), shotId: SHOT, state: 'pouring' });
        machine.accept(machineFrame(0));
        machine.refreshStaleness();
        machine.signal({ kind: 'open' });
        assert.equal(buffer.get().sampleCount, 1, 'only frames make samples');
        machine.accept(machineFrame(100));
        assert.equal(buffer.get().sampleCount, 2);
    });

    test('two identical frames are two samples — dedupe by value would drop real samples', () => {
        const { machine, shotState, buffer } = wire();
        shotState.accept({ event: 'state', timestamp: at(0), shotId: SHOT, state: 'pouring' });
        machine.accept(machineFrame(0));
        machine.accept(machineFrame(0));
        assert.equal(buffer.get().sampleCount, 2);
    });

    test('the scale is attached only while its feed is LIVE', () => {
        const { machine, scale, shotState, buffer } = wire();
        shotState.accept({ event: 'state', timestamp: at(0), shotId: SHOT, state: 'pouring' });
        scale.accept({ timestamp: at(0), weight: 18.2, weightFlow: 1.9, battery: 80, timerValue: 12000 });
        machine.accept(machineFrame(0));
        assert.equal(buffer.get().lastSample.scale.weight, 18.2);

        scale.signal({ kind: 'status', status: 'disconnected' });
        machine.accept(machineFrame(100));
        assert.equal(buffer.get().lastSample.scale, null,
            'a scale that left contributes null, not its last weight re-presented as this sample\'s');
        assert.equal(scale.get().status, FEED_STATUS.STALE);
    });

    test('the sensors map comes from the injected supplier, keyed by id', () => {
        const machine = createFeedStore({ label: 'machineSnapshot', read: readMachineSnapshot });
        const shotState = createFeedStore({ label: 'shotState', read: readShotStateFrame });
        const buffer = createShotBuffer();
        attachShotBuffer({
            buffer, machine, shotState,
            sensors: () => ({ 'de1-abc-puckestimator': { timestamp: at(0), r1: 4.2 } }),
        });
        shotState.accept({ event: 'state', timestamp: at(0), shotId: SHOT, state: 'pouring' });
        machine.accept(machineFrame(0));
        assert.equal(buffer.get().lastSample.sensors['de1-abc-puckestimator'].r1, 4.2);
    });

    test('detaching stops sampling and leaves the buffer as it stands', () => {
        const { machine, shotState, buffer, detach } = wire();
        shotState.accept({ event: 'state', timestamp: at(0), shotId: SHOT, state: 'pouring' });
        machine.accept(machineFrame(0));
        detach();
        machine.accept(machineFrame(100));
        assert.equal(buffer.get().sampleCount, 1);
    });

    test('it refuses to be wired without the two feeds it cannot work without', () => {
        const buffer = createShotBuffer();
        assert.throws(() => attachShotBuffer({ buffer }), /machine feed is required/);
        assert.throws(() => attachShotBuffer({ machine: {} }), /buffer is required/);
    });
});

describe('the two counts are not spelled alike — a buffer has samples AND subscribers', () => {
    const filled = (n) => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.POURING));
        for (let i = 0; i < n; i += 1) buffer.addSample({ machine: machineFrame(i * 100) });
        return buffer;
    };

    test('the sample count is on the published state, and only there', () => {
        const buffer = filled(5);
        assert.equal(buffer.get().sampleCount, 5);
        assert.equal(buffer.toArray().length, 5, 'the samples are demonstrably present');
    });

    test('`size` is ABSENT, so the old spelling fails loudly instead of answering 0', () => {
        const buffer = filled(5);
        assert.equal(buffer.size, undefined, 'a plausible small integer is worse than a throw');
        assert.throws(() => buffer.size(), TypeError);
    });

    test('subscriberCount counts subscribers and is unmoved by samples', () => {
        const buffer = filled(5);
        assert.equal(buffer.subscriberCount(), 0, 'five samples, nobody watching');
        const off = buffer.subscribe(() => {});
        assert.equal(buffer.subscriberCount(), 1);
        assert.equal(buffer.get().sampleCount, 5, 'subscribing appends nothing');
        off();
        assert.equal(buffer.subscriberCount(), 0);
    });

    test('an EMPTY buffer with a subscriber reports zero samples, not one', () => {
        const buffer = createShotBuffer();
        buffer.subscribe(() => {});
        assert.equal(buffer.subscriberCount(), 1);
        assert.equal(buffer.get().sampleCount, 0, 'the exact inversion the old name produced');
    });

    test('feed-store KEEPS size(): a feed accumulates nothing, so there is no second number', () => {
        const feed = createFeedStore({ label: 'machineSnapshot', read: readMachineSnapshot });
        assert.equal(feed.size(), 0);
        feed.subscribe(() => {});
        assert.equal(feed.size(), 1, 'read as a refcount by live-stores.test.mjs:399');
    });
});
