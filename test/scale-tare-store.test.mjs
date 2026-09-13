/**
 * The tare, and the two ways a machine says no.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    createScaleTareStore, TARE_STATUS, TARE_ZERO_G,
} from '../src/stores/scale-tare-store.js';
import { FEED_STATUS } from '../src/stores/feed-store.js';

/** A transport whose one answer a test scripts, recording what was asked. */
function scriptedTransport(answer) {
    const calls = [];
    return {
        calls,
        request: async (path, options = {}) => {
            calls.push({ path, method: options.method ?? 'GET' });
            return answer;
        },
    };
}

/** The scale feed, as this store uses it: a value and a subscription. */
function fakeScale(initialWeight = 18.4, { status = FEED_STATUS.LIVE, frames = 1 } = {}) {
    const listeners = new Set();
    let state = { status, value: { weight: initialWeight }, frames };
    const publish = () => { for (const fn of [...listeners]) fn(state); };
    return {
        get: () => state,
        subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        /** Publish a new reading, as the websocket would. */
        emit(weight) {
            state = { status: FEED_STATUS.LIVE, value: { weight }, frames: state.frames + 1 };
            publish();
        },
        goStale() {
            state = { ...state, status: FEED_STATUS.STALE };
            publish();
        },
    };
}

const OK = { ok: true, kind: 'json', status: 200, data: null };

test('a tare is a PUT, and the route is addressed by id', async () => {
    const transport = scriptedTransport(OK);
    const scale = fakeScale(0);
    const store = createScaleTareStore({ transport, scale });
    await store.tare();
    assert.equal(transport.calls.length, 1);
    assert.equal(transport.calls[0].method, 'PUT');
    assert.match(transport.calls[0].path, /\/scale\/tare$/);
});

test('the weight settling near zero is what makes it DONE', async () => {
    const transport = scriptedTransport(OK);
    const scale = fakeScale(18.4);
    const store = createScaleTareStore({ transport, scale });

    const pending = store.tare();
    /* The scale answers a moment later, as a websocket does. */
    setTimeout(() => scale.emit(0.02), 5);
    await pending;

    assert.equal(store.get().status, TARE_STATUS.DONE);
    assert.equal(store.get().weight, 0.02);
});

test('A 200 OVER A SILENT REFUSAL IS NOT A TARE — the weight never moved', async () => {
    const transport = scriptedTransport(OK);
    const scale = fakeScale(18.4);
    const store = createScaleTareStore({ transport, scale, now: fakeClock() });

    await store.tare();

    assert.equal(store.get().status, TARE_STATUS.UNCONFIRMED,
        'a route that answered 200 was reported as a successful tare');
    assert.equal(store.get().weight, 18.4, 'and the reading it settled at is kept, to say so with');
});

test('A STALE ZERO CANNOT CONFIRM A NEW TARE — it is a memory, not an observation', async () => {
    const transport = scriptedTransport(OK);
    const scale = fakeScale(0);
    scale.goStale();
    const store = createScaleTareStore({ transport, scale, now: fakeClock() });
    await store.tare();
    assert.equal(store.get().status, TARE_STATUS.UNCONFIRMED,
        'an old zero was read as evidence about a request that had not been sent when it arrived');
});

test('a scale ALREADY at zero says so, and does not claim a tare it could not have seen', async () => {
    const transport = scriptedTransport(OK);
    const scale = fakeScale(0.01);
    const store = createScaleTareStore({ transport, scale });
    const pending = store.tare();
    setTimeout(() => scale.emit(0.01), 5);
    await pending;
    assert.equal(store.get().status, TARE_STATUS.ALREADY_ZERO);
    assert.notEqual(store.get().status, TARE_STATUS.DONE,
        'a no-op was reported as a confirmed operation');
});

test('a zero that lands WHILE the request is in flight still confirms it', async () => {
    const scale = fakeScale(18.4);
    const transport = {
        calls: [],
        request: async (path, options = {}) => {
            transport.calls.push({ path, method: options.method ?? 'GET' });
            scale.emit(0.0);
            return OK;
        },
    };
    const store = createScaleTareStore({ transport, scale });
    await store.tare();
    assert.equal(store.get().status, TARE_STATUS.DONE);
    assert.equal(store.get().weight, 0);
});

test('a REPEAT tare does not inherit the zero the FIRST one earned', async () => {
    const scale = fakeScale(18.4);
    let answerTares = true;
    const transport = {
        request: async () => {
            if (answerTares) scale.emit(0.0);
            return OK;
        },
    };
    const store = createScaleTareStore({
        transport, scale, setTimer: (fn) => setTimeout(fn, 0), clearTimer: (id) => clearTimeout(id),
    });
    await store.tare();
    assert.equal(store.get().status, TARE_STATUS.DONE, 'the first tare is the one with evidence');
    answerTares = false;
    await store.tare();
    assert.equal(store.get().status, TARE_STATUS.UNCONFIRMED,
        'the second tare confirmed itself on the frame the first one earned');
});

test('ReaPrime\'s own refusal is quoted, not guessed at', async () => {
    /* The VISIBLE half: scale_handler.dart returns 400 with its own type when
     * blockTareDuringShot is set, a shot is active and the gateway is not full. */
    const transport = scriptedTransport({
        ok: false,
        kind: 'http',
        status: 400,
        message: 'Bad Request',
        problem: { details: 'Tare blocked: a shot is in progress', type: 'block_tare_during_shot' },
    });
    const store = createScaleTareStore({ transport, scale: fakeScale(18.4) });

    await store.tare();

    assert.equal(store.get().status, TARE_STATUS.REFUSED);
    assert.equal(store.get().refusal.type, 'block_tare_during_shot');
    assert.equal(store.get().refusal.message, 'Tare blocked: a shot is in progress');
    assert.equal(store.get().error, null, 'a refusal is an answer, not a fault');
});

test('a route failure is a fault, and is not dressed as a refusal', async () => {
    const transport = scriptedTransport({ ok: false, kind: 'http', status: 500, message: 'no scale' });
    const store = createScaleTareStore({ transport, scale: fakeScale(18.4) });
    await store.tare();
    assert.equal(store.get().status, TARE_STATUS.ERROR);
    assert.equal(store.get().refusal, null);
    assert.ok(store.get().error, 'the failure left nothing for a surface to report');
});

test('two presses join one attempt', async () => {
    /* A second tare on top of a first tells the machine nothing new and would race its
     * own confirmation. */
    const transport = scriptedTransport(OK);
    const scale = fakeScale(0);
    const store = createScaleTareStore({ transport, scale });
    await Promise.all([store.tare(), store.tare(), store.tare()]);
    assert.equal(transport.calls.length, 1);
});

test('the store refuses to exist without the evidence it needs', () => {
    assert.throws(() => createScaleTareStore({ transport: scriptedTransport(OK) }),
        /scale feed must be injected/);
    assert.throws(() => createScaleTareStore({ scale: fakeScale() }), /transport must be injected/);
});

test('the near-zero window is a token of this file, not a magic number', () => {
    /* A settled platform reads a few hundredths; a cup that has not moved reads its own
     * mass. Half a gram is well inside the first and nowhere near the second. */
    assert.ok(TARE_ZERO_G > 0.05 && TARE_ZERO_G < 5);
});

/** A clock that jumps straight past the confirm budget, so the timeout path is instant. */
function fakeClock() {
    let t = 0;
    return () => { t += 10_000; return t; };
}
