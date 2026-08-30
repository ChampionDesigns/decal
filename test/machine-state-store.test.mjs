/**
 * Asking the machine for a state — and what a 200 does NOT mean.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createMachineStateStore, REQUEST_STATUS } from '../src/stores/machine-state-store.js';
import { MACHINE_STATE } from '../src/data/machine-state.js';

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

const OK = { ok: true, kind: 'json', status: 200, data: null };

test('the store refuses to be built without a transport', () => {
    assert.throws(() => createMachineStateStore({}), /transport must be injected/);
});

test('a wake is a PUT, and the state name is in the path', async () => {
    const transport = scriptedTransport(OK);
    const store = createMachineStateStore({ transport });
    await store.request(MACHINE_STATE.IDLE);
    assert.equal(transport.calls.length, 1);
    assert.equal(transport.calls[0].method, 'PUT');
    assert.match(transport.calls[0].path, /\/machine\/state\/idle$/);
});

test('a 200 publishes WHAT WAS ASKED FOR, never what the machine now is', async () => {
    const store = createMachineStateStore({ transport: scriptedTransport(OK) });
    const state = await store.request(MACHINE_STATE.IDLE);
    assert.equal(state.status, REQUEST_STATUS.SENT);
    assert.equal(state.requested, MACHINE_STATE.IDLE);
    assert.equal(state.error, null);
    assert.equal(state.problem, null);
});

test('a typed 400 is a refusal and carries the server\'s own body', async () => {
    /* The one the handler can send today: espresso with blockOnNoScale on and no scale. */
    const problem = { details: 'No scale detected, blocking espresso request', type: 'block_no_scale' };
    const store = createMachineStateStore({
        transport: scriptedTransport({ ok: false, kind: 'http', status: 400, message: 'no scale', problem }),
    });
    const state = await store.request(MACHINE_STATE.ESPRESSO);
    assert.equal(state.status, REQUEST_STATUS.REFUSED);
    assert.deepEqual(state.problem, problem);
    assert.equal(state.error, null, 'a refusal is the server working, not a fault');
});

test('anything else is a failure, and the transport result is kept whole', async () => {
    const result = { ok: false, kind: 'http', status: 500, message: 'boom', problem: null };
    const store = createMachineStateStore({ transport: scriptedTransport(result) });
    const state = await store.request(MACHINE_STATE.IDLE);
    assert.equal(state.status, REQUEST_STATUS.FAILED);
    assert.deepEqual(state.error, result);
});

test('an empty state name asks for nothing at all', async () => {
    /* `MachineState.values.byName` throws on an unknown name and `withDe1`'s catch-all
     * turns that into a 500, so a caller passes the generated enum and never a literal.
     * An empty one is not sent. */
    const transport = scriptedTransport(OK);
    const store = createMachineStateStore({ transport });
    await store.request('');
    await store.request(null);
    assert.deepEqual(transport.calls, []);
});

test('the state it publishes is the whole state, every time', async () => {
    /* No field survives from the previous attempt: a refusal followed by a success must
     * not leave the refusal's body standing beside a SENT. */
    const problem = { details: 'No scale detected, blocking espresso request', type: 'block_no_scale' };
    const store = createMachineStateStore({
        transport: {
            calls: [],
            request: async (path) => (path.endsWith('espresso')
                ? { ok: false, kind: 'http', status: 400, message: 'no scale', problem }
                : OK),
        },
    });
    await store.request(MACHINE_STATE.ESPRESSO);
    assert.equal(store.get().problem, problem);
    await store.request(MACHINE_STATE.IDLE);
    assert.equal(store.get().problem, null);
    assert.equal(store.get().status, REQUEST_STATUS.SENT);
});
