/**
 * A calibration poll never outranks the command it is polling for.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createCalibrationStore, CAL_STEP, CAL_LOAD } from '../src/stores/calibration-store.js';
import { createReaTransport } from '../src/data/rea-transport.js';

const BASE = 'http://machine.local:8080/api/v1';

const state = (step, secondsRemaining = 0, extra = {}) => ({
    step,
    detectedCell: 'none',
    subState: 'settling',
    secondsRemaining,
    status: 'none',
    ...extra,
});

const body = (payload, status = 200) => ({
    status,
    ok: status < 400,
    headers: { get: () => null },
    text: async () => JSON.stringify(payload),
});

function harness() {
    const open = [];
    const fetchImpl = (url, init = {}) => new Promise((resolve) => {
        open.push({
            url,
            method: init.method ?? 'GET',
            sent: init.body ? JSON.parse(init.body) : null,
            answer: (payload, status = 200) => resolve(body(payload, status)),
        });
    });
    const transport = createReaTransport({ fetch: fetchImpl, baseUrl: BASE, timeoutMs: 0 });

    let pending = null;
    let next = 1;
    const setTimer = (fn) => { pending = fn; return next++; };
    const clearTimer = () => { pending = null; };

    const store = createCalibrationStore({ transport, pollMs: 1000, setTimer, clearTimer });

    const waiting = (match) => {
        const found = open.find((call) => match(call) && !call.done);
        assert.ok(found, `no open request matched; saw ${JSON.stringify(open.map((c) => `${c.method} ${c.url}`))}`);
        found.done = true;
        return found;
    };
    const settle = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };
    return {
        store,
        open,
        waiting,
        settle,
        armed: () => pending !== null,
        tick: () => { const fn = pending; pending = null; assert.ok(fn, 'the countdown poll was not armed'); fn(); },
    };
}

const GET = (call) => call.method === 'GET' && call.url.includes('/machine/scaleCalibration');
const PUT = (call) => call.method === 'PUT' && call.url.includes('/machine/scaleCalibration');

describe('the poll cannot outrank the command it is polling for', () => {

    test('a GET answered after the 202 does not stop the countdown', async () => {
        const { store, waiting, settle, armed, tick } = harness();

        const first = store.read();
        await settle();
        waiting(GET).answer(state(CAL_STEP.ZEROING, 12));
        await first;
        assert.ok(armed(), 'the store polls while the machine says it is working');

        tick();
        await settle();
        const stalePoll = waiting(GET);

        const zero = store.zero();
        await settle();
        waiting(PUT).answer({ status: 'accepted', state: state(CAL_STEP.CAL_LATCH, 30) });
        await zero;
        assert.equal(store.state().step, CAL_STEP.CAL_LATCH);
        assert.equal(store.state().secondsRemaining, 30);

        stalePoll.answer(state(CAL_STEP.ZEROING, 1));
        await settle();

        assert.equal(store.state().step, CAL_STEP.CAL_LATCH,
            'the poll republished the step the machine had already left');
        assert.equal(store.state().secondsRemaining, 30);
        assert.ok(armed(), 'the countdown stopped: the stale answer disarmed the poll');
    });

    test('the wizard reaches its end with a poll in flight across every command', async () => {
        const { store, waiting, settle, armed, tick } = harness();

        const first = store.read();
        await settle();
        waiting(GET).answer(state(CAL_STEP.ZEROING, 10));
        await first;

        tick();
        await settle();
        const stalePoll = waiting(GET);

        const zero = store.zero();
        await settle();
        waiting(PUT).answer({ status: 'accepted', state: state(CAL_STEP.CAL_LATCH, 20) });
        await zero;

        const latch = store.latch(500);
        await settle();
        const latchCall = waiting(PUT);
        assert.deepEqual(latchCall.sent, { command: 'latch', weightGrams: 500 });
        latchCall.answer({ status: 'accepted', state: state(CAL_STEP.COMPLETE, 0, { status: 'ok' }) });
        await latch;

        stalePoll.answer(state(CAL_STEP.ZEROING, 9));
        await settle();

        assert.equal(store.state().step, CAL_STEP.COMPLETE, 'the wizard was walked back to zeroing');
        assert.equal(store.state().status, 'ok');
        assert.equal(armed(), false, 'a terminal step stops the poll dead, and it stayed stopped');
    });

    test('a genuinely newer poll result still updates the state', async () => {
        const { store, waiting, settle, tick } = harness();

        const first = store.read();
        await settle();
        waiting(GET).answer(state(CAL_STEP.ZEROING, 10));
        await first;

        const zero = store.zero();
        await settle();
        waiting(PUT).answer({ status: 'accepted', state: state(CAL_STEP.CAL_LATCH, 30) });
        await zero;

        tick();
        await settle();
        waiting(GET).answer(state(CAL_STEP.CAL_LATCH, 27));
        await settle();

        assert.equal(store.state().secondsRemaining, 27, 'the countdown must still count');
    });

    test('a 409 carries a state too, and the poll it raced cannot undo it', async () => {
        const { store, waiting, settle, tick } = harness();

        const first = store.read();
        await settle();
        waiting(GET).answer(state(CAL_STEP.ZEROING, 8));
        await first;

        tick();
        await settle();
        const stalePoll = waiting(GET);

        const zero = store.zero();
        await settle();
        waiting(PUT).answer(
            { status: 'rejected', reason: 'machine busy', state: state(CAL_STEP.ERROR, 0, { status: 'notSettled' }) },
            409,
        );
        const outcome = await zero;
        assert.equal(outcome.ok, false);
        assert.equal(outcome.reason, 'machine busy');

        stalePoll.answer(state(CAL_STEP.ZEROING, 7));
        await settle();

        assert.equal(store.state().step, CAL_STEP.ERROR,
            'the machine described itself in its refusal and the poll overwrote that description');
        assert.equal(store.get().reason, 'machine busy', 'and the refusal is still on the state');
    });

    test('a failed read answered late does not blank a state the command set', async () => {
        const { store, waiting, settle, tick } = harness();

        const first = store.read();
        await settle();
        waiting(GET).answer(state(CAL_STEP.ZEROING, 6));
        await first;

        tick();
        await settle();
        const stalePoll = waiting(GET);

        const zero = store.zero();
        await settle();
        waiting(PUT).answer({ status: 'accepted', state: state(CAL_STEP.CAL_LATCH, 25) });
        await zero;

        stalePoll.answer({ error: 'gone' }, 503);
        await settle();

        assert.equal(store.get().load, CAL_LOAD.READY);
        assert.equal(store.state().step, CAL_STEP.CAL_LATCH,
            'a failure older than the newest answer blanked the state it described');
    });
});

describe('a command is sent against the machine it was pressed on', () => {

    test('a read in flight across forget() cannot re-describe the machine that has gone', async () => {
        const { store, waiting, settle, armed } = harness();

        const first = store.read();
        await settle();
        const inFlight = waiting(GET);

        store.forget();
        assert.equal(store.get().state, null);
        assert.equal(store.get().load, CAL_LOAD.NOT_LOADED);

        inFlight.answer(state(CAL_STEP.ZEROING, 15));
        await first;
        await settle();

        assert.equal(store.get().state, null,
            'the departed machine\'s step was published onto a store that had forgotten it');
        assert.equal(store.get().load, CAL_LOAD.NOT_LOADED);
        assert.equal(armed(), false, 'and it armed a countdown for a machine that is not there');
    });

    test('a command queued behind another is never sent to a machine that has gone', async () => {
        const { store, open, waiting, settle } = harness();

        const zero = store.zero();
        await settle();
        const zeroCall = waiting(PUT);

        const abort = store.abort();
        await settle();
        assert.equal(open.filter((c) => c.method === 'PUT').length, 1,
            'commands go one at a time, in the order they were pressed');

        store.forget();
        zeroCall.answer({ status: 'accepted', state: state(CAL_STEP.ZEROING, 12) });
        await zero;
        const outcome = await abort;
        await settle();

        assert.equal(open.filter((c) => c.method === 'PUT').length, 1,
            'the queued abort went out as a command against a machine it was never pressed on');
        assert.equal(outcome.ok, false);
        assert.equal(store.get().state, null);
    });

    test('two commands are sent in the order they were pressed', async () => {
        const { store, open, waiting, settle } = harness();

        const zero = store.zero();
        await settle();
        const zeroCall = waiting(PUT);
        const abort = store.abort();
        await settle();

        zeroCall.answer({ status: 'accepted', state: state(CAL_STEP.ZEROING, 12) });
        await zero;
        await settle();

        const abortCall = waiting(PUT);
        assert.deepEqual(open.filter((c) => c.method === 'PUT').map((c) => c.sent.command),
            ['zero', 'abort']);
        abortCall.answer({ status: 'accepted', state: state(CAL_STEP.IDLE, 0) });
        await abort;
        assert.equal(store.state().step, CAL_STEP.IDLE);
    });
});

describe('every ending of a read is an answer, and every one can lose', () => {

    test('a body that is not a state, answered late, does not blank the wizard', async () => {
        const { store, waiting, settle, armed, tick } = harness();

        const first = store.read();
        await settle();
        waiting(GET).answer(state(CAL_STEP.ZEROING, 6));
        await first;

        tick();
        await settle();
        const stalePoll = waiting(GET);

        const zero = store.zero();
        await settle();
        waiting(PUT).answer({ status: 'accepted', state: state(CAL_STEP.CAL_LATCH, 25) });
        await zero;

        stalePoll.answer({ hello: 'not a state' });
        await settle();

        assert.equal(store.get().load, CAL_LOAD.READY);
        assert.equal(store.state().step, CAL_STEP.CAL_LATCH,
            'an unreadable body older than the newest answer blanked the state it described');
        assert.ok(armed(), 'and it disarmed the countdown on its way past');
    });

    test('an unreadable body that IS the newest answer still says so', async () => {
        const { store, waiting, settle, armed } = harness();

        const first = store.read();
        await settle();
        waiting(GET).answer(state(CAL_STEP.ZEROING, 6));
        await first;

        const second = store.read();
        await settle();
        waiting(GET).answer({ hello: 'not a state' });
        await second;

        assert.equal(store.get().load, CAL_LOAD.UNAVAILABLE);
        assert.equal(store.get().state, null);
        assert.equal(armed(), false);
    });
});
