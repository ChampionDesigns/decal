
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    createFeedStore, FEED_STATUS, DEFAULT_STALE_AFTER_MS,
    isLive, isStale, isBlank, valueOf,
} from '../src/stores/feed-store.js';

function fakeSource() {
    const frames = new Set();
    const signals = new Set();
    return {
        subscribe(listener) { frames.add(listener); return () => frames.delete(listener); },
        onSignal(listener) { signals.add(listener); return () => signals.delete(listener); },
        emit(frame) { for (const l of [...frames]) l(frame); },
        signal(signal) { for (const l of [...signals]) l(signal); },
        frameSubscribers: () => frames.size,
        signalSubscribers: () => signals.size,
    };
}

/** A clock the test drives. Nothing in this layer reads a wall clock of its own. */
function fakeClock(start = 1000) {
    let now = start;
    return { now: () => now, advance: (ms) => { now += ms; return now; } };
}

const identity = (frame) => frame;

describe('construction refuses to guess', () => {
    test('a reader is required — the address layer reads ReaPrime, the store does not', () => {
        assert.throws(() => createFeedStore({ label: 'x' }), /reader is required/);
    });

    test('a label is required', () => {
        assert.throws(() => createFeedStore({ read: identity }), /label is required/);
    });

    test('a nonsense staleness budget is refused rather than rounded', () => {
        assert.throws(() => createFeedStore({ label: 'x', read: identity, staleAfterMs: 0 }), /positive number or null/);
    });
});

describe('the boot state is "never", which is not an error and not a value', () => {
    test('no value, no stamp, no frames', () => {
        const feed = createFeedStore({ label: 'machineSnapshot', read: identity });
        const state = feed.get();
        assert.equal(state.status, FEED_STATUS.NEVER);
        assert.equal(state.value, null);
        assert.equal(state.receivedAt, null);
        assert.equal(state.frames, 0);
        assert.equal(isBlank(state), true);
        assert.equal(feed.ageMs(), null);
    });
});

describe('a frame arrives', () => {
    test('it is read through the injected reader, stamped, counted, and published as NEW state', () => {
        const clock = fakeClock();
        const feed = createFeedStore({
            label: 'machineSnapshot',
            read: (frame) => ({ pressure: frame.pressure }),
            clock: clock.now,
            staleAfterMs: 2000,
        });
        const seen = [];
        feed.subscribe((state) => seen.push(state));
        feed.accept({ pressure: 8.6, extra: 'ignored by the reader' });

        const state = feed.get();
        assert.equal(state.status, FEED_STATUS.LIVE);
        assert.deepEqual(state.value, { pressure: 8.6 });
        assert.equal(state.receivedAt, 1000);
        assert.equal(state.frames, 1);
        assert.equal(state.sourceOpen, true);
        assert.equal(seen.length, 2, 'replay, then the frame');
        assert.notEqual(seen[0], seen[1], 'a new object every time — pattern F');
        assert.equal(Object.isFrozen(state), true);
    });

    test('the raw frame is kept as a diagnostic, and the VALUE is what a screen reads', () => {
        const feed = createFeedStore({ label: 'scale', read: (f) => f.weight });
        feed.accept({ weight: 18.2 });
        assert.equal(valueOf(feed.get()), 18.2);
        assert.deepEqual(feed.get().frame, { weight: 18.2 });
    });
});

describe('staleness is classified, never guessed, and nothing ticks by itself', () => {
    test('inside the budget it is live; past it, stale — but only when someone asks', () => {
        const clock = fakeClock();
        const feed = createFeedStore({ label: 'machineSnapshot', read: identity, clock: clock.now, staleAfterMs: 2000 });
        feed.accept({ n: 1 });
        clock.advance(5000);
        assert.equal(feed.get().status, FEED_STATUS.LIVE, 'no timer changed it behind our back');
        feed.refreshStaleness();
        assert.equal(feed.get().status, FEED_STATUS.STALE);
        assert.equal(feed.ageMs(), 5000);
    });

    test('refreshStaleness publishes only when the answer changed', () => {
        const clock = fakeClock();
        const feed = createFeedStore({ label: 'machineSnapshot', read: identity, clock: clock.now, staleAfterMs: 2000 });
        feed.accept({ n: 1 });
        let deliveries = 0;
        feed.subscribe(() => { deliveries += 1; });
        feed.refreshStaleness();
        feed.refreshStaleness();
        assert.equal(deliveries, 1, 'the replay only — nothing changed');
        clock.advance(3000);
        feed.refreshStaleness();
        feed.refreshStaleness();
        assert.equal(deliveries, 2, 'one publish for the one transition');
    });

    test('a feed with no rate is never stale by the clock — only by its source going', () => {
        const clock = fakeClock();
        const feed = createFeedStore({ label: 'shotState', read: identity, clock: clock.now, staleAfterMs: null });
        feed.accept({ state: 'idle' });
        clock.advance(8 * 60 * 60 * 1000);
        feed.refreshStaleness();
        assert.equal(feed.get().status, FEED_STATUS.LIVE, 'an idle machine overnight is not a fault');
        feed.signal({ kind: 'close' });
        assert.equal(feed.get().status, FEED_STATUS.STALE);
    });

    test('a fresh frame after a close makes it live again', () => {
        const feed = createFeedStore({ label: 'machineSnapshot', read: identity, staleAfterMs: 2000 });
        feed.accept({ n: 1 });
        feed.signal({ kind: 'close' });
        feed.accept({ n: 2 });
        assert.equal(feed.get().status, FEED_STATUS.LIVE);
        assert.equal(feed.get().sourceOpen, true);
    });

    test('the budgets are named once, and only the feeds with a RATE have one', () => {
        assert.equal(DEFAULT_STALE_AFTER_MS.machineSnapshot, 2000);
        assert.equal(DEFAULT_STALE_AFTER_MS.shotState, null);
        assert.equal(DEFAULT_STALE_AFTER_MS.devices, null);
        assert.equal(DEFAULT_STALE_AFTER_MS.display, null);
        assert.equal(DEFAULT_STALE_AFTER_MS.update, null);
    });
});

describe('THE DELETION RULE: a source that goes away does not erase what it said', () => {
    test('close keeps the value, marks it stale, and says the source is shut', () => {
        const feed = createFeedStore({ label: 'machineSnapshot', read: identity });
        feed.accept({ groupTemperature: 92.4 });
        feed.signal({ kind: 'close' });
        const state = feed.get();
        assert.deepEqual(state.value, { groupTemperature: 92.4 }, 'still the last thing the machine said');
        assert.equal(state.status, FEED_STATUS.STALE);
        assert.equal(state.sourceOpen, false);
        assert.equal(isStale(state), true);
    });

    test('a close before any frame leaves "never", not a stale nothing', () => {
        const feed = createFeedStore({ label: 'update', read: identity });
        feed.signal({ kind: 'close' });
        assert.equal(feed.get().status, FEED_STATUS.NEVER);
        assert.equal(feed.get().value, null);
    });

    test('unavailable is a VERDICT and outranks a later staleness refresh', () => {
        const clock = fakeClock();
        const feed = createFeedStore({ label: 'estimator', read: identity, clock: clock.now, staleAfterMs: 3000 });
        feed.signal({ kind: 'unavailable', attempts: 6 });
        clock.advance(10000);
        feed.refreshStaleness();
        assert.equal(feed.get().status, FEED_STATUS.UNAVAILABLE, 'feature-absent, not "old"');
    });

    test('an error envelope is kept as a fact and is never folded into the value', () => {
        const feed = createFeedStore({ label: 'estimator', read: identity });
        feed.accept({ r1: 4.2 });
        feed.signal({ kind: 'error', error: 'not found' });
        const state = feed.get();
        assert.equal(state.error, 'not found');
        assert.deepEqual(state.value, { r1: 4.2 }, 'the last real reading, marked stale');
        assert.equal(state.status, FEED_STATUS.STALE);
        feed.accept({ r1: 4.4 });
        assert.equal(feed.get().error, null, 'a frame proves the feed works again');
    });

    test('the scale status envelope is the only notice that a scale left', () => {
        const feed = createFeedStore({ label: 'scale', read: identity });
        feed.accept({ weight: 18 });
        feed.signal({ kind: 'status', status: 'disconnected' });
        assert.equal(feed.get().deviceStatus, 'disconnected');
        assert.equal(feed.get().status, FEED_STATUS.STALE);
        feed.signal({ kind: 'status', status: 'connected' });
        assert.equal(feed.get().deviceStatus, 'connected');
    });

    test('a malformed message is a signal, not a value', () => {
        const feed = createFeedStore({ label: 'display', read: identity });
        feed.signal({ kind: 'malformed', raw: '<html>' });
        assert.equal(feed.get().value, null);
        assert.equal(feed.get().frames, 0);
        assert.equal(feed.get().signal.kind, 'malformed');
    });

    test('a signal with no kind changes nothing', () => {
        const feed = createFeedStore({ label: 'display', read: identity });
        const before = feed.get();
        feed.signal(null);
        feed.signal({});
        assert.equal(feed.get(), before);
    });
});

describe('attaching to a source', () => {
    test('frames and signals both arrive, and detaching stops both', () => {
        const source = fakeSource();
        const feed = createFeedStore({ label: 'machineSnapshot', read: identity });
        feed.attach(source);
        assert.equal(source.frameSubscribers(), 1);
        assert.equal(source.signalSubscribers(), 1);

        source.emit({ n: 1 });
        source.signal({ kind: 'open' });
        assert.equal(feed.get().frames, 1);
        assert.equal(feed.get().sourceOpen, true);

        feed.detach();
        assert.equal(source.frameSubscribers(), 0);
        assert.equal(source.signalSubscribers(), 0);
        source.emit({ n: 2 });
        assert.equal(feed.get().frames, 1, 'nothing arrives after detach');
    });

    test('detaching marks the value stale — it is last-known, with the source gone', () => {
        const source = fakeSource();
        const feed = createFeedStore({ label: 'machineSnapshot', read: identity });
        feed.attach(source);
        source.emit({ n: 1 });
        feed.detach();
        assert.equal(feed.get().status, FEED_STATUS.STALE);
        assert.deepEqual(feed.get().value, { n: 1 });
        assert.equal(feed.attached(), false);
    });

    test('attaching twice replaces the first binding rather than doubling the frames', () => {
        const first = fakeSource();
        const second = fakeSource();
        const feed = createFeedStore({ label: 'machineSnapshot', read: identity });
        feed.attach(first);
        feed.attach(second);
        assert.equal(first.frameSubscribers(), 0);
        second.emit({ n: 1 });
        assert.equal(feed.get().frames, 1);
    });

    test('a source with no subscribe is refused', () => {
        const feed = createFeedStore({ label: 'x', read: identity });
        assert.throws(() => feed.attach({}), /subscribe/);
    });

    test('a source without onSignal still works — signals are optional, frames are not', () => {
        const feed = createFeedStore({ label: 'x', read: identity });
        const listeners = new Set();
        feed.attach({ subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); } });
        for (const l of listeners) l({ n: 1 });
        assert.equal(feed.get().frames, 1);
    });
});

describe('the predicates read the same way at every call site', () => {
    test('live / stale / blank are mutually exclusive answers', () => {
        const feed = createFeedStore({ label: 'x', read: identity, staleAfterMs: 10 });
        assert.deepEqual([isBlank(feed.get()), isLive(feed.get()), isStale(feed.get())], [true, false, false]);
        feed.accept({ n: 1 });
        assert.deepEqual([isBlank(feed.get()), isLive(feed.get()), isStale(feed.get())], [false, true, false]);
        feed.signal({ kind: 'close' });
        assert.deepEqual([isBlank(feed.get()), isLive(feed.get()), isStale(feed.get())], [false, false, true]);
    });
});

describe('a signal-driven stale is not undone by the clock', () => {
    test('a disconnected scale does not come back LIVE on the next refresh', () => {
        const clock = fakeClock();
        const feed = createFeedStore({ label: 'scale', read: identity, clock: clock.now, staleAfterMs: 4000 });
        feed.accept({ weight: 18.2, weightFlow: 1.7 });
        assert.equal(feed.get().status, FEED_STATUS.LIVE);

        feed.signal({ kind: 'status', status: 'disconnected' });
        assert.equal(feed.get().status, FEED_STATUS.STALE);
        assert.equal(feed.get().sourceOpen, true, 'the socket really is still open — that stays true');

        clock.advance(50);
        feed.refreshStaleness();
        assert.equal(feed.get().status, FEED_STATUS.STALE, 'a dead scale is not live because its reading is new');
        assert.equal(isLive(feed.get()), false);
        assert.deepEqual(valueOf(feed.get()), { weight: 18.2, weightFlow: 1.7 }, 'the last reading survives, marked');
    });

    test('an error envelope latches the same way', () => {
        const clock = fakeClock();
        const feed = createFeedStore({ label: 'estimator', read: identity, clock: clock.now, staleAfterMs: 3000 });
        feed.accept({ r1: 4.2 });
        feed.signal({ kind: 'error', error: 'not found' });
        clock.advance(10);
        feed.refreshStaleness();
        assert.equal(feed.get().status, FEED_STATUS.STALE);
        assert.equal(feed.get().error, 'not found');
    });

    test('and a FRAME is what clears it — the source is demonstrably back', () => {
        const clock = fakeClock();
        const feed = createFeedStore({ label: 'scale', read: identity, clock: clock.now, staleAfterMs: 4000 });
        feed.accept({ weight: 18.2 });
        feed.signal({ kind: 'status', status: 'disconnected' });
        feed.accept({ weight: 0.0 });
        assert.equal(feed.get().status, FEED_STATUS.LIVE);
        assert.equal(feed.get().staleLatched, false);
        clock.advance(50);
        feed.refreshStaleness();
        assert.equal(feed.get().status, FEED_STATUS.LIVE, 'a working scale is live again');
    });

    test('a scale that reconnects but sends nothing is STILL stale — only a reading lifts it', () => {
        const clock = fakeClock();
        const feed = createFeedStore({ label: 'scale', read: identity, clock: clock.now, staleAfterMs: 4000 });
        feed.accept({ weight: 18.2 });
        feed.signal({ kind: 'status', status: 'disconnected' });
        feed.signal({ kind: 'status', status: 'connected' });
        clock.advance(50);
        feed.refreshStaleness();
        assert.equal(feed.get().deviceStatus, 'connected');
        assert.equal(feed.get().status, FEED_STATUS.STALE);
        feed.accept({ weight: 0.0 });
        assert.equal(feed.get().status, FEED_STATUS.LIVE, 'the first frame is what makes it live again');
    });
});
