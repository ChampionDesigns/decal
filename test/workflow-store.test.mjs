/**
 * The workflow store — the Live rail's owner.
 *
 * The rail's failure was not a wrong number, it was NO number: nothing set `targets`, so
 * every control rendered disabled, and the one handler that writes `targets` sat behind
 * the controls being unwritten had disabled. These tests hold the read, the write, and —
 * the part that matters most on a machine that clamps — what the rail is left holding when
 * a write is refused or adjusted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createWorkflowStore, WORKFLOW_STATUS } from '../src/stores/workflow-store.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = JSON.parse(
    readFileSync(path.join(REPO, 'tools/rea-fixtures/api__v1__workflow.json'), 'utf8'));

/** A transport whose answers a test scripts, recording every call in order. */
function scriptedTransport(handler) {
    const calls = [];
    return {
        calls,
        request: async (routePath, options = {}) => {
            calls.push({ path: routePath, method: options.method ?? 'GET', body: options.body ?? null });
            return handler(routePath, options, calls.length);
        },
    };
}

const served = () => ({ ok: true, kind: 'json', status: 200, data: structuredClone(WORKFLOW) });
const refused = () => ({ ok: false, kind: 'http', status: 500, message: 'no machine' });

test('a load publishes the document and the rail\'s numbers', async () => {
    const transport = scriptedTransport(() => served());
    const store = createWorkflowStore({ transport });

    assert.equal(store.get().status, WORKFLOW_STATUS.IDLE);
    await store.load();

    const state = store.get();
    assert.equal(state.status, WORKFLOW_STATUS.READY);
    assert.equal(state.targets.dose, 17);
    assert.equal(state.targets.brewTemp, 83.5);
    assert.ok(state.workflow, 'the document is kept whole — patchFor needs the steps');
    assert.equal(transport.calls[0].method, 'GET');
});

test('concurrent callers join one request', async () => {
    const transport = scriptedTransport(() => served());
    const store = createWorkflowStore({ transport });
    await Promise.all([store.load(), store.load(), store.load()]);
    assert.equal(transport.calls.length, 1, 'a screen and the shell asking on connect is one call');
});

test('a refused read leaves NO targets — the rail dashes, it does not invent', async () => {
    const transport = scriptedTransport(() => refused());
    const store = createWorkflowStore({ transport });
    await store.load();

    assert.equal(store.get().status, WORKFLOW_STATUS.UNAVAILABLE);
    assert.deepEqual(store.get().targets, {});
    assert.equal(store.get().workflow, null);
});

test('a write sends the PARTIAL body and publishes what the SERVER answers', async () => {
    /* The machine clamps: `hotWaterVolume` is packed into one byte upstream and truncates
     * rather than clamps. So the number the rail ends up holding must be the server's, not
     * the one the press asked for. Scripted here as the real route behaves — the write
     * answers the document the machine now holds. */
    const clamped = structuredClone(WORKFLOW);
    clamped.hotWaterData = { ...clamped.hotWaterData, volume: 144 };
    const transport = scriptedTransport((p, options, n) => (n === 1 ? served()
        : { ok: true, kind: 'json', status: 200, data: clamped }));
    const store = createWorkflowStore({ transport });
    await store.load();

    await store.setTarget('hotWaterVolume', 400);

    const write = transport.calls[1];
    assert.equal(write.method, 'PUT');
    assert.deepEqual(Object.keys(write.body), ['hotWaterData'], 'the write carried a block it did not change');
    assert.equal(write.body.hotWaterData.volume, 400, 'the press asked for 400');
    assert.equal(store.get().targets.hotWaterVolume, 144,
        'the rail kept the number it asked for instead of the one the machine holds');
});

test('a refused write REVERTS, and says so', async () => {
    const transport = scriptedTransport((p, options, n) => (n === 1 ? served() : refused()));
    const store = createWorkflowStore({ transport });
    await store.load();
    assert.equal(store.get().targets.dose, 17);

    await store.setTarget('dose', 19);

    assert.equal(store.get().targets.dose, 17,
        'the rail is showing a value the machine refused to hold');
    assert.ok(store.get().writeError, 'the failure left no trace for a surface to report');
    assert.equal(store.get().status, WORKFLOW_STATUS.READY, 'a refused write is not a lost document');
});

test('a write nothing can be built from is not sent at all', async () => {
    const transport = scriptedTransport(() => served());
    const store = createWorkflowStore({ transport });
    await store.load();

    await store.setTarget('fanThreshold', 40);
    await store.setTarget('dose', null);

    assert.equal(transport.calls.length, 1, 'an unmappable target reached the machine');
});

test('a machine that went away takes its numbers with it', async () => {
    const transport = scriptedTransport(() => served());
    const store = createWorkflowStore({ transport });
    await store.load();
    assert.equal(store.get().targets.dose, 17);

    store.forget();

    assert.deepEqual(store.get().targets, {}, 'the departed machine\'s numbers are still on the rail');
    assert.equal(store.get().status, WORKFLOW_STATUS.IDLE);
});

test('a read in flight across a forget does not land afterwards', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const transport = scriptedTransport(async () => { await gate; return served(); });
    const store = createWorkflowStore({ transport });

    const inFlight = store.load();
    store.forget();
    release();
    await inFlight;

    assert.deepEqual(store.get().targets, {},
        'a read for a machine that is gone re-described the one that replaced it');
});

test('subscribers see the rail change', async () => {
    const transport = scriptedTransport(() => served());
    const store = createWorkflowStore({ transport });
    const seen = [];
    const stop = store.subscribe((state) => seen.push(state.status));
    await store.load();
    stop();

    assert.ok(seen.includes(WORKFLOW_STATUS.READY), 'the screen was never told the numbers arrived');
});

test('a store without a transport refuses to exist', () => {
    assert.throws(() => createWorkflowStore({}), /transport must be injected/);
});

/* ══════════════════════════════════ apply — the road a PROFILE takes onto the machine ═ */

test('apply PUTs the partial it is given and publishes the served document', async () => {
    /* `POST /machine/profile` arms the DE1 and touches nothing else, so on its own it
     * leaves GET /workflow serving the previous profile — the old title on the header, the
     * old dose and drink weight on the rail, and the old name stamped into every shot
     * ReaPrime records from then on. This is the write that makes the document true. */
    const loaded = structuredClone(WORKFLOW);
    loaded.profile = { ...loaded.profile, title: 'Lever Classic' };
    loaded.context = { targetDoseWeight: 18, targetYield: 40, grinderSetting: null };
    const transport = scriptedTransport((routePath, options, n) => (n === 1 ? served()
        : { ok: true, kind: 'json', status: 200, data: loaded }));
    const store = createWorkflowStore({ transport });
    await store.load();

    const body = { profile: loaded.profile, context: loaded.context };
    await store.apply(body, { label: 'profile' });

    assert.equal(transport.calls[1].method, 'PUT');
    assert.deepEqual(transport.calls[1].body, body, 'partial, and exactly what it was given');
    assert.equal(store.get().workflow.profile.title, 'Lever Classic');
    assert.equal(store.get().targets.drinkWeight, 40, 'and the rail follows the new profile');
    assert.equal(store.get().writeError, null);
});

test('a refused apply reverts and records the failure, like every other write here', async () => {
    const transport = scriptedTransport((routePath, options, n) => (n === 1 ? served()
        : { ok: false, kind: 'http', status: 400, message: 'Invalid request' }));
    const store = createWorkflowStore({ transport });
    await store.load();
    const before = store.get().workflow.profile.title;
    await store.apply({ profile: { title: 'nope' } });
    assert.equal(store.get().workflow.profile.title, before, 'the document is the machine\'s');
    assert.equal(store.get().writeError.status, 400);
});

test('apply with nothing to apply asks the machine for nothing', async () => {
    const transport = scriptedTransport(() => served());
    const store = createWorkflowStore({ transport });
    await store.load();
    await store.apply(null);
    await store.apply('profile');
    assert.equal(transport.calls.length, 1, 'the load, and no write');
});
