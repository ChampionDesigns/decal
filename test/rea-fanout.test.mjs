
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createFanout } from '../src/data/rea-fanout.js';

describe('replay: the shareReplay(1) mirror', () => {
    test('a late subscriber gets the latest frame immediately', () => {
        const fanout = createFanout();
        fanout.emit({ pressure: 6.1 });
        fanout.emit({ pressure: 8.6 });
        const seen = [];
        fanout.subscribe((f) => seen.push(f));
        assert.deepEqual(seen, [{ pressure: 8.6 }], 'exactly one frame, the newest');
    });

    test('an early subscriber is not replayed to twice', () => {
        const fanout = createFanout();
        const seen = [];
        fanout.subscribe((f) => seen.push(f));
        fanout.emit({ n: 1 });
        assert.deepEqual(seen, [{ n: 1 }]);
    });

    test('before the first frame there is nothing to replay', () => {
        const fanout = createFanout();
        const seen = [];
        fanout.subscribe((f) => seen.push(f));
        assert.deepEqual(seen, []);
        assert.equal(fanout.last(), null);
        assert.equal(fanout.hasFrame(), false);
    });

    test('null is a frame like any other — an emitted null replays as null', () => {
        const fanout = createFanout();
        fanout.emit(null);
        const seen = [];
        fanout.subscribe((f) => seen.push(f));
        assert.deepEqual(seen, [null]);
        assert.equal(fanout.hasFrame(), true);
    });

    test('clear() forgets the replay value — a socket that closed has nothing current', () => {
        const fanout = createFanout();
        fanout.emit({ n: 1 });
        fanout.clear();
        const seen = [];
        fanout.subscribe((f) => seen.push(f));
        assert.deepEqual(seen, []);
        assert.equal(fanout.last(), null);
    });
});

describe('fan-out', () => {
    test('every observer gets every frame, and unsubscribe is per-observer', () => {
        const fanout = createFanout();
        const a = []; const b = [];
        const offA = fanout.subscribe((f) => a.push(f));
        fanout.subscribe((f) => b.push(f));
        fanout.emit(1);
        offA();
        fanout.emit(2);
        assert.deepEqual(a, [1]);
        assert.deepEqual(b, [1, 2]);
        assert.equal(fanout.size(), 1);
    });

    test('a listener that throws does not stop the delivery', () => {
        const warned = [];
        const fanout = createFanout({ logger: { warn: (m) => warned.push(m) }, label: 'snap' });
        const seen = [];
        fanout.subscribe(() => { throw new Error('render blew up'); });
        fanout.subscribe((f) => seen.push(f));
        fanout.emit('frame');
        assert.deepEqual(seen, ['frame']);
        assert.equal(warned.length, 1);
        assert.match(warned[0], /^snap: frame listener threw/);
    });

    test('unsubscribing during a delivery does not disturb it', () => {
        const fanout = createFanout();
        const seen = [];
        let off;
        fanout.subscribe(() => { off(); });
        off = fanout.subscribe((f) => seen.push(f));
        fanout.emit('one');
        assert.deepEqual(seen, ['one'], 'the second listener was still delivered to');
        fanout.emit('two');
        assert.deepEqual(seen, ['one'], 'and is gone from the next delivery');
    });

    test('subscribe refuses a non-function rather than silently observing nothing', () => {
        const fanout = createFanout({ label: 'x' });
        assert.throws(() => fanout.subscribe(null), /x: subscribe needs a function/);
        assert.throws(() => fanout.onSignal('nope'), /x: onSignal needs a function/);
    });
});

describe('signals are not frames', () => {
    test('a signal never reaches a frame subscriber, and is never replayed', () => {
        const fanout = createFanout();
        const frames = []; const signals = [];
        fanout.subscribe((f) => frames.push(f));
        fanout.onSignal((s) => signals.push(s));
        fanout.signal({ kind: 'error', error: 'not found' });
        assert.deepEqual(frames, []);
        assert.deepEqual(signals, [{ kind: 'error', error: 'not found' }]);
        assert.equal(fanout.last(), null, 'an error envelope must never become the replay value');

        const late = [];
        fanout.onSignal((s) => late.push(s));
        assert.deepEqual(late, [], 'signals are not replayed — the failure was already handled');
    });
});

describe('counters and teardown', () => {
    test('frameCount is the doubled-rate tell', () => {
        const fanout = createFanout();
        fanout.emit(1); fanout.emit(2); fanout.emit(3);
        assert.equal(fanout.frameCount(), 3);
    });

    test('reset drops listeners and replay together', () => {
        const fanout = createFanout();
        fanout.subscribe(() => {});
        fanout.onSignal(() => {});
        fanout.emit(1);
        fanout.reset();
        assert.equal(fanout.size(), 0);
        assert.equal(fanout.signalSize(), 0);
        assert.equal(fanout.last(), null);
    });
});
