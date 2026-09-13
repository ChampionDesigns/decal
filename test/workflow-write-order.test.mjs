/**
 * Writes leave in the order they were made, and a late answer cannot undo a newer press.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createWorkflowStore, WORKFLOW_STATUS } from '../src/stores/workflow-store.js';

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

function scriptedMachine({ verdict = () => 'ok', mergeOnRelease = false } = {}) {
    let held = structuredClone(WORKFLOW);
    const calls = [];
    const waiting = [];

    const transport = {
        request(routePath, options = {}) {
            const method = options.method ?? 'GET';
            const body = options.body ?? null;
            calls.push({ path: routePath, method, body });
            const arrivedAt = calls.length;
            const answer = () => {
                if (method !== 'PUT') {
                    return { ok: true, kind: 'json', status: 200, data: structuredClone(held) };
                }
                if (verdict(body, arrivedAt) === 'refuse') {
                    return { ok: false, kind: 'http', status: 500, message: 'no machine' };
                }
                held = deepMerge(held, body);
                return { ok: true, kind: 'json', status: 200, data: structuredClone(held) };
            };
            const ready = mergeOnRelease ? null : answer();
            return new Promise((resolve) => {
                waiting.push({ method, release: () => resolve(ready ?? answer()) });
            });
        },
    };

    const drain = async (pick) => {
        for (let guard = 0; guard < 32; guard += 1) {
            await flush();
            if (waiting.length === 0) return;
            waiting.splice(pick(), 1)[0].release();
        }
        throw new Error('a request was never answered');
    };

    return {
        transport,
        calls,
        waiting,
        get document() { return held; },
        release(index) { waiting.splice(index, 1)[0].release(); },
        settle: () => drain(() => 0),
        settleNewestFirst: () => drain(() => waiting.length - 1),
    };
}

const loadedStore = async (machine) => {
    const store = createWorkflowStore({ transport: machine.transport });
    const loading = store.load();
    await machine.settle();
    await loading;
    return store;
};

describe('two presses inside one response time', () => {
    test('editing dose and drink weight together leaves the machine holding BOTH', async () => {
        const machine = scriptedMachine();
        const store = await loadedStore(machine);

        const dose = store.setTarget('dose', 20);
        const weight = store.setTarget('drinkWeight', 44);
        await machine.settle();
        await Promise.all([dose, weight]);

        assert.equal(machine.document.context.targetDoseWeight, 20,
            'the second press wrote the dose back to the value it read before the first');
        assert.equal(machine.document.context.targetYield, 44);
        assert.equal(store.get().targets.dose, 20);
        assert.equal(store.get().targets.drinkWeight, 44);
    });

    test('a press sends the leaf it changed and nothing else', async () => {
        const machine = scriptedMachine();
        const store = await loadedStore(machine);

        const dose = store.setTarget('dose', 20);
        const weight = store.setTarget('drinkWeight', 44);
        await machine.settle();
        await Promise.all([dose, weight]);

        const writes = machine.calls.filter((call) => call.method === 'PUT');
        assert.equal(writes.length, 2);
        assert.deepEqual(writes[0].body, { context: { targetDoseWeight: 20 } });
        assert.deepEqual(writes[1].body, { context: { targetYield: 44 } },
            'the drink weight press carried a dose the person did not touch');
    });

    test('the rail shows both presses while the first is still unanswered', async () => {
        const machine = scriptedMachine();
        const store = await loadedStore(machine);

        const dose = store.setTarget('dose', 20);
        const weight = store.setTarget('drinkWeight', 44);
        assert.equal(store.get().targets.dose, 20, 'the press was not shown at once');
        assert.equal(store.get().targets.drinkWeight, 44, 'the press was not shown at once');

        await machine.settle();
        await Promise.all([dose, weight]);
    });
});

describe('answers that come back out of order', () => {
    test('the same target pressed twice keeps the LAST value when the first reply is slow', async () => {
        const machine = scriptedMachine();
        const store = await loadedStore(machine);

        const first = store.setTarget('dose', 19);
        const second = store.setTarget('dose', 20);
        await machine.settleNewestFirst();
        await Promise.all([first, second]);

        assert.equal(machine.document.context.targetDoseWeight, 20);
        assert.equal(store.get().targets.dose, 20,
            'an answer to a press that has been superseded put its number back on the rail');
    });

    test('a refused press is not rolled back over the press that replaced it', async () => {
        const machine = scriptedMachine({ verdict: (body, n) => (n === 2 ? 'refuse' : 'ok') });
        const store = await loadedStore(machine);

        const first = store.setTarget('dose', 19);
        const second = store.setTarget('dose', 20);
        await machine.settleNewestFirst();
        await Promise.all([first, second]);

        assert.equal(machine.document.context.targetDoseWeight, 20);
        assert.equal(store.get().targets.dose, 20,
            'the refusal of a value nobody is asking for any more reverted the one they are');
        assert.equal(store.get().writeError, null,
            'the rail is reporting a failure that a later write already made irrelevant');
    });

    test('a read asked for before a write does not undo the write', async () => {
        const machine = scriptedMachine();
        const store = await loadedStore(machine);

        const reading = store.refresh();
        const writing = store.setTarget('dose', 20);
        await machine.settleNewestFirst();
        await Promise.all([reading, writing]);

        assert.equal(machine.document.context.targetDoseWeight, 20);
        assert.equal(store.get().targets.dose, 20,
            'a read that left before the write landed after it, and described the machine as it was');
    });
});

describe('one press, which is the case that always worked', () => {
    test('it is shown at once, sent as a leaf, and corrected by the answer', async () => {
        const machine = scriptedMachine();
        const store = await loadedStore(machine);

        const press = store.setTarget('steamFlow', 1.6);
        assert.equal(store.get().targets.steamFlow, 1.6, 'the press was not shown at once');
        await machine.settle();
        await press;

        const writes = machine.calls.filter((call) => call.method === 'PUT');
        assert.equal(writes.length, 1);
        assert.deepEqual(writes[0].body, { steamSettings: { flow: 1.6 } });
        assert.equal(machine.document.steamSettings.flow, 1.6);
        assert.equal(machine.document.steamSettings.duration, WORKFLOW.steamSettings.duration,
            'the press carried a sibling of the field it changed');
        assert.equal(store.get().targets.steamFlow, 1.6);
        assert.equal(store.get().writeError, null);
    });

    test('a refused press with nothing after it still reverts, and says so', async () => {
        const machine = scriptedMachine({ verdict: () => 'refuse' });
        const store = await loadedStore(machine);

        const press = store.setTarget('dose', 20);
        await machine.settle();
        await press;

        assert.equal(store.get().targets.dose, WORKFLOW.context.targetDoseWeight,
            'the rail is showing a value the machine refused to hold');
        assert.equal(store.get().writeError.status, 500);
    });
});

describe('a machine that goes away with a write still queued', () => {
    test('a press waiting behind a slow one is never sent to the machine that replaces it', async () => {
        const machine = scriptedMachine();
        const store = await loadedStore(machine);

        const first = store.setTarget('dose', 20);
        const second = store.setTarget('dose', 21);
        await flush();
        assert.equal(machine.calls.filter((call) => call.method === 'PUT').length, 1,
            'the second press left before the first was answered — there is no queue');

        store.forget();
        await machine.settle();
        await Promise.all([first, second]);

        const writes = machine.calls.filter((call) => call.method === 'PUT');
        assert.equal(writes.length, 1,
            'a press made against the machine that left was written to the one after it');
        assert.deepEqual(store.get().targets, {},
            'the departed machine\'s numbers are back on the rail');
        assert.equal(store.get().status, WORKFLOW_STATUS.IDLE);
    });

    test('the answer to the write that was already in flight is discarded too', async () => {
        const machine = scriptedMachine();
        const store = await loadedStore(machine);

        const press = store.setTarget('dose', 20);
        await flush();
        store.forget();
        await machine.settle();
        await press;

        assert.deepEqual(store.get().targets, {});
        assert.equal(store.get().workflow, null,
            'a document for a machine that is gone was published as the current one');
        assert.equal(store.get().writeError, null);
    });
});

describe('a press and an arm inside one response time', () => {
    const armedProfile = () => ({
        ...structuredClone(WORKFLOW.profile),
        title: 'Gentle and sweet',
        steps: [{ ...structuredClone(WORKFLOW.profile.steps[0]), temperature: 80 }],
    });

    test('stepping the brew temperature while a profile is arming leaves the ARMED profile on the machine', async () => {
        const machine = scriptedMachine();
        const store = await loadedStore(machine);

        const arming = store.apply({ profile: armedProfile() });
        const stepping = store.setTarget('brewTemp', 92);
        await machine.settle();
        await Promise.all([arming, stepping]);

        assert.equal(machine.document.profile.title, 'Gentle and sweet',
            'the queued temperature press put the profile the arm replaced back on the machine');
        assert.equal(machine.document.profile.steps.length, 1,
            'the machine is holding the steps of the profile that was replaced');
        assert.deepEqual(machine.document.profile.steps.map((step) => step.temperature), [92]);
        assert.equal(store.get().targets.brewTemp, 92);
    });

    test('the temperature is written onto the profile the machine holds when the write leaves', async () => {
        const machine = scriptedMachine();
        const store = await loadedStore(machine);

        const arming = store.apply({ profile: armedProfile() });
        const stepping = store.setTarget('brewTemp', 92);
        await machine.settle();
        await Promise.all([arming, stepping]);

        const writes = machine.calls.filter((call) => call.method === 'PUT');
        assert.equal(writes.length, 2);
        assert.equal(writes[0].body.profile.title, 'Gentle and sweet');
        assert.equal(writes[1].body.profile.title, 'Gentle and sweet',
            'the press carried the profile as the document had it when the press was made');
        assert.deepEqual(writes[1].body.profile.steps.map((step) => step.temperature), [92]);
    });

    test('an arm queued behind a press still lands, and lands last', async () => {
        const machine = scriptedMachine();
        const store = await loadedStore(machine);

        const stepping = store.setTarget('brewTemp', 92);
        const arming = store.apply({ profile: armedProfile() });
        await machine.settle();
        await Promise.all([stepping, arming]);

        assert.equal(machine.document.profile.title, 'Gentle and sweet');
        assert.deepEqual(machine.document.profile.steps.map((step) => step.temperature), [80],
            'the arm was overwritten by the press that went before it');
    });
});

describe('a read that answers before a write asked for earlier', () => {
    test('the write\'s own document wins, because it is the machine after the merge', async () => {
        const machine = scriptedMachine({ mergeOnRelease: true });
        const store = await loadedStore(machine);

        const writing = store.setTarget('dose', 20);
        await flush();
        const reading = store.refresh();
        await flush();
        assert.equal(machine.waiting.length, 2, 'the read never reached the machine');

        machine.release(1);
        await flush();
        machine.release(0);
        await machine.settle();
        await Promise.all([writing, reading]);

        assert.equal(machine.document.context.targetDoseWeight, 20);
        assert.equal(store.get().targets.dose, 20,
            'the rail kept the number a read answered before the write that replaced it');
    });
});

describe('a transport that throws instead of answering', () => {
    test('a write that never lands leaves nothing pinned to the rail', async () => {
        const transport = {
            request(routePath, options = {}) {
                if ((options.method ?? 'GET') === 'PUT') {
                    return Promise.reject(new Error('the socket went away'));
                }
                return Promise.resolve({
                    ok: true, kind: 'json', status: 200, data: structuredClone(WORKFLOW),
                });
            },
        };
        const store = createWorkflowStore({ transport });
        await store.load();

        await store.setTarget('dose', 20);

        assert.equal(store.get().targets.dose, WORKFLOW.context.targetDoseWeight,
            'the rail is showing a number no write ever delivered');
        assert.ok(store.get().writeError, 'a write that never landed was reported as nothing at all');

        await store.refresh();
        assert.equal(store.get().targets.dose, WORKFLOW.context.targetDoseWeight,
            'the served document could not get past a press that never settled');
    });
});

describe('a refusal that a newer answer outranks', () => {
    const heldTransport = (putAnswer) => {
        const waiting = [];
        const transport = {
            request(routePath, options = {}) {
                const method = options.method ?? 'GET';
                return new Promise((resolve) => {
                    waiting.push({
                        method,
                        release: () => resolve(method === 'PUT' ? putAnswer : {
                            ok: true, kind: 'json', status: 200, data: structuredClone(WORKFLOW),
                        }),
                    });
                });
            },
        };
        return { transport, waiting };
    };

    const REFUSED = { ok: false, kind: 'http', status: 503, message: 'machine unavailable' };

    const loadedOverHeld = async () => {
        const { transport, waiting } = heldTransport(REFUSED);
        const store = createWorkflowStore({ transport });
        const loading = store.load();
        await flush();
        waiting.shift().release();
        await loading;
        return { store, waiting };
    };

    test('the refusal is still reported, even though its document is not published', async () => {
        const { store, waiting } = await loadedOverHeld();

        const press = store.setTarget('dose', 20);
        await flush();
        const reading = store.refresh();
        await flush();
        waiting[1].release();
        await flush();
        waiting[0].release();
        await flush();
        await Promise.allSettled([press, reading]);

        assert.equal(store.get().targets.dose, WORKFLOW.context.targetDoseWeight,
            'the press was reverted');
        assert.ok(store.get().writeError,
            'a machine that refused the press said so, and the rail carried it');
    });

    test('a refused apply answers a state its caller cannot read as a success', async () => {
        const { store, waiting } = await loadedOverHeld();

        const applying = store.apply({ context: { targetDoseWeight: 20 } });
        await flush();
        const reading = store.refresh();
        await flush();
        waiting[1].release();
        await flush();
        waiting[0].release();
        await flush();
        const [state] = await Promise.all([applying, reading]);

        assert.ok(state.writeError,
            'the settings door reads writeError === null as written, so a refusal must set it');
    });
});
