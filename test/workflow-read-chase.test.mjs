/**
 * A workflow read a newer answer discarded is asked for again, exactly once.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createWorkflowStore } from '../src/stores/workflow-store.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = JSON.parse(
    readFileSync(path.join(REPO, 'tools/rea-fixtures/api__v1__workflow.json'), 'utf8'));

const flush = () => new Promise((resolve) => { setImmediate(resolve); });

function deepMerge(base, updates) {
    const out = { ...base };
    for (const [key, value] of Object.entries(updates)) {
        const held = out[key];
        out[key] = (held && typeof held === 'object' && !Array.isArray(held)
            && value && typeof value === 'object' && !Array.isArray(value))
            ? deepMerge(held, value) : value;
    }
    return out;
}

function scriptedMachine({ refusePut = false } = {}) {
    let held = structuredClone(WORKFLOW);
    const calls = [];
    const waiting = [];
    const state = { failGet: false };

    const transport = {
        request(routePath, options = {}) {
            const method = options.method ?? 'GET';
            calls.push({ path: routePath, method, body: options.body ?? null });
            let answer;
            if (method !== 'PUT') {
                answer = state.failGet
                    ? { ok: false, kind: 'http', status: 503, message: 'down' }
                    : { ok: true, kind: 'json', status: 200, data: structuredClone(held) };
            } else if (refusePut) {
                answer = { ok: false, kind: 'http', status: 500, message: 'no machine' };
            } else {
                held = deepMerge(held, options.body);
                answer = { ok: true, kind: 'json', status: 200, data: structuredClone(held) };
            }
            return new Promise((resolve) => {
                waiting.push({ method, release: () => resolve(answer) });
            });
        },
    };

    return {
        transport,
        calls,
        waiting,
        state,
        gets: () => calls.filter((call) => call.method === 'GET').length,
        get document() { return held; },
        setYield(value) { held = deepMerge(held, { context: { targetYield: value } }); },
        release(index = 0) { waiting.splice(index, 1)[0].release(); },
        async settle() {
            for (let guard = 0; guard < 32; guard += 1) {
                await flush();
                if (waiting.length === 0) return;
                waiting.shift().release();
            }
            throw new Error('a request was never answered');
        },
    };
}

const loadedStore = async (machine) => {
    const store = createWorkflowStore({ transport: machine.transport });
    const loading = store.load();
    await machine.settle();
    await loading;
    return store;
};

describe('a read a write outranked', () => {
    test('is asked again, and the rail ends on what the MACHINE holds', async () => {
        const machine = scriptedMachine();
        const store = await loadedStore(machine);
        assert.equal(store.get().targets.drinkWeight, WORKFLOW.context.targetYield);

        const reading = store.refresh();
        await flush();
        assert.equal(machine.waiting.length, 1, 'the read never left');

        const pressed = store.setTarget('dose', 20);
        await flush();
        machine.release(1);
        await pressed;
        machine.setYield(48);

        machine.release(0);
        await reading;
        await machine.settle();

        assert.equal(store.get().targets.dose, 20, 'the press the write confirmed');
        assert.equal(store.get().targets.drinkWeight, 48,
            'the rail kept a number the machine stopped holding, because the read that '
            + 'carried the new one was discarded and nothing asked again');
        assert.equal(store.get().workflow.context.targetYield, machine.document.context.targetYield,
            'and the document behind the rail is the machine\'s own');
    });

    test('it costs exactly one extra request', async () => {
        const machine = scriptedMachine();
        const store = await loadedStore(machine);
        const before = machine.gets();

        const reading = store.refresh();
        await flush();
        const pressed = store.setTarget('dose', 20);
        await flush();
        machine.release(1);
        await pressed;
        machine.release(0);
        await reading;
        await machine.settle();

        assert.equal(machine.gets() - before, 2, 'the discarded read, and the one that replaces it');
    });

    test('a read that LANDS chases nothing', async () => {
        const machine = scriptedMachine();
        const store = await loadedStore(machine);
        const before = machine.gets();

        const reading = store.refresh();
        await machine.settle();
        await reading;

        assert.equal(machine.gets() - before, 1, 'an ordinary read asked for a second one');
    });

    test('a read that FAILED is not chased — the store does not retry a refusal', async () => {
        const machine = scriptedMachine();
        const store = await loadedStore(machine);
        const before = machine.gets();

        machine.state.failGet = true;
        const reading = store.refresh();
        await flush();
        const pressed = store.setTarget('dose', 20);
        await flush();
        machine.release(1);
        await pressed;
        machine.release(0);
        await reading;
        await flush();
        await flush();

        assert.equal(machine.gets() - before, 1, 'a refusal was retried behind the rail\'s back');
        assert.equal(machine.waiting.length, 0);
    });
});

describe('two discards in a row', () => {
    test('do not become a request loop — one chase per landed read', async () => {
        const machine = scriptedMachine();
        const store = await loadedStore(machine);
        const before = machine.gets();

        const reading = store.refresh();
        await flush();
        const first = store.setTarget('dose', 20);
        await flush();
        machine.release(1);
        await first;
        machine.release(0);
        await reading;
        await flush();
        assert.equal(machine.waiting.length, 1, 'the chase was not asked for');

        const second = store.setTarget('dose', 21);
        await flush();
        machine.release(1);
        await second;
        machine.release(0);
        await machine.settle();

        assert.equal(machine.gets() - before, 2, 'the chase chased itself');
        assert.equal(machine.document.context.targetDoseWeight, 21);
        assert.equal(store.get().targets.dose, 21,
            'and the rail is on the machine\'s own answer, which is what the write carried');
    });

    test('the budget comes back the moment a read lands', async () => {
        const machine = scriptedMachine();
        const store = await loadedStore(machine);

        const overlap = async () => {
            const reading = store.refresh();
            await flush();
            const pressed = store.setTarget('dose', 20);
            await flush();
            machine.release(1);
            await pressed;
            machine.release(0);
            await reading;
            await machine.settle();
        };

        const before = machine.gets();
        await overlap();
        assert.equal(machine.gets() - before, 2, 'the first overlap was chased');
        const middle = machine.gets();
        await overlap();
        assert.equal(machine.gets() - middle, 2,
            'a later overlap went unchased — the bound is per landed read, not per store');
    });
});

describe('a read discarded because the machine went away', () => {
    test('schedules nothing at all', async () => {
        const machine = scriptedMachine();
        const store = await loadedStore(machine);
        const before = machine.gets();

        const reading = store.refresh();
        await flush();
        store.forget();
        machine.release(0);
        await reading;
        await flush();
        await flush();

        assert.equal(machine.gets() - before, 1,
            'a read for a departed machine put another request on the wire for it');
        assert.equal(machine.waiting.length, 0);
        assert.deepEqual(store.get().targets, {}, 'and the rail is blank, as forget() left it');
    });

    test('and neither does a write abandoned with it', async () => {
        const machine = scriptedMachine();
        const store = await loadedStore(machine);
        const before = machine.gets();

        const pressed = store.setTarget('dose', 20);
        await flush();
        store.forget();
        await machine.settle();
        await pressed;
        await flush();

        assert.equal(machine.gets() - before, 0);
        assert.equal(store.get().workflow, null);
    });
});
