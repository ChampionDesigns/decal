import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createSkinsStore } from '../src/stores/skins-store.js';
import { createPluginsStore, VISUALIZER_PLUGIN_ID } from '../src/stores/plugins-store.js';
import { createAppSettingsClient } from '../src/data/rea-app-settings.js';
import { createMachineFieldsPort } from '../src/stores/machine-fields-port.js';
import { createStorageRouter } from '../src/lib/storage-router.js';
import { LAYERS } from '../src/lib/storage-routes.js';
import { createSettingsStore } from '../src/stores/settings-store.js';
import { createSettingsLeafModel } from '../src/stores/settings-leaf-model.js';
import { SETTINGS_ROWS } from '../src/lib/settings-leaves.js';
import { limitsFor } from '../src/lib/machine-limits.js';
import { reaSuccess, reaFailure } from '../src/data/rea-errors.js';

function transportOf(script) {
    const calls = [];
    return {
        calls,
        socketUrl: () => 'ws://test',
        url: (path) => `http://test${path}`,
        async request(path, { method = 'GET', body, query } = {}) {
            calls.push({ path, method, body, query });
            return script({ path, method, body, query, key: `${method} ${path}` });
        },
    };
}

const ok = (data, status = 200) => reaSuccess({ status, data, method: 'GET', url: 'test' });
const bad = (status) => reaFailure('http', { status, message: `test ${status}`, method: 'GET', url: 'test' });

const writes = (transport) => transport.calls.filter((call) => call.method !== 'GET');

const SKINS = [
    { id: 'decal', name: 'Decal', version: '0.0.1', isBundled: false },
    { id: 'other', name: 'Other', version: '1.0.0', isBundled: false },
];

const MANIFEST = Object.freeze({
    id: VISUALIZER_PLUGIN_ID,
    name: 'Visualizer',
    autoLoad: true,
    settings: { Username: { type: 'string', description: 'Visualiser username' } },
});

function skinsServer({ writes: answer = bad(401) } = {}) {
    return transportOf(({ key }) => {
        if (key === 'GET /webui/skins') return ok(SKINS.map((skin) => ({ ...skin })));
        if (key === 'GET /webui/skins/default') return ok({ id: 'decal' });
        return answer;
    });
}

function pluginsServer() {
    return transportOf(({ key }) => {
        if (key === 'GET /plugins') return ok([{ ...MANIFEST }]);
        if (key === `GET /plugins/${VISUALIZER_PLUGIN_ID}/settings`) return ok({ Username: 'ben' });
        return bad(401);
    });
}

describe('a skin store that cannot manage skins sends no write', () => {
    test('the store says it cannot manage skins unless it is told it can', () => {
        assert.equal(createSkinsStore({ transport: skinsServer() }).canManage, false);
        assert.equal(createSkinsStore({ transport: skinsServer(), canManage: true }).canManage, true);
    });

    test('switching the default skin sends no request and changes nothing', async () => {
        const transport = skinsServer();
        const store = createSkinsStore({ transport });
        await store.load();
        const before = store.get();
        assert.equal(await store.switchTo('other'), false);
        assert.deepEqual(writes(transport), []);
        assert.equal(store.get(), before);
        assert.equal(store.get().defaultId, 'decal');
        assert.equal(store.get().switched, null);
    });

    test('no server stop or start goes out for a switch, even from a server that would take it', async () => {
        const transport = skinsServer({ writes: ok({}) });
        const store = createSkinsStore({ transport });
        await store.load();
        await store.switchTo('other');
        assert.ok(!transport.calls.some((call) => call.path.startsWith('/webui/server/')));
    });

    test('update all skins sends no request and reports no run', async () => {
        const transport = skinsServer();
        const store = createSkinsStore({ transport });
        await store.load();
        const before = store.get();
        assert.equal(await store.updateAll(), false);
        assert.deepEqual(writes(transport), []);
        assert.equal(store.get(), before);
        assert.equal(store.get().updateRan, false);
        assert.equal(store.get().updateError, null);
    });

    test('removing a skin sends no request and keeps the list', async () => {
        const transport = skinsServer();
        const store = createSkinsStore({ transport });
        await store.load();
        const before = store.get();
        assert.equal(await store.remove('other'), false);
        assert.deepEqual(writes(transport), []);
        assert.equal(store.get(), before);
        assert.deepEqual(store.skins().map((skin) => skin.id), ['decal', 'other']);
    });

    test('the list and the default are read as before', async () => {
        const transport = skinsServer();
        const store = createSkinsStore({ transport });
        await store.load();
        assert.deepEqual(transport.calls.map((call) => `${call.method} ${call.path}`).sort(),
            ['GET /webui/skins', 'GET /webui/skins/default']);
        assert.equal(store.active().id, 'decal');
    });
});

describe('a plugin store that cannot manage plugins sends no write', () => {
    test('the store says it cannot manage plugins unless it is told it can', () => {
        assert.equal(createPluginsStore({ transport: pluginsServer() }).canManage, false);
        assert.equal(createPluginsStore({ transport: pluginsServer(), canManage: true }).canManage, true);
    });

    test('enable and disable send no request and keep the list', async () => {
        const transport = pluginsServer();
        const store = createPluginsStore({ transport });
        await store.load();
        const before = store.get();
        assert.equal(await store.setEnabled(VISUALIZER_PLUGIN_ID, false), false);
        assert.equal(await store.setEnabled(VISUALIZER_PLUGIN_ID, true), false);
        assert.deepEqual(writes(transport), []);
        assert.equal(store.get(), before);
        assert.equal(store.plugin(VISUALIZER_PLUGIN_ID).autoLoad, true);
        assert.equal(store.get().writeError, null);
    });

    test('saving plugin settings sends no request and keeps the settings read', async () => {
        const transport = pluginsServer();
        const store = createPluginsStore({ transport });
        await store.load();
        await store.loadSettings(VISUALIZER_PLUGIN_ID);
        const before = store.get();
        assert.equal(await store.writeSettings(VISUALIZER_PLUGIN_ID, { Username: 'other' }), false);
        assert.deepEqual(writes(transport), []);
        assert.equal(store.get(), before);
        assert.deepEqual(store.settingsFor(VISUALIZER_PLUGIN_ID), { Username: 'ben' });
    });

    test('a plugin setting cannot be staged, so a Save has nothing to send', async () => {
        const transport = pluginsServer();
        const store = createPluginsStore({ transport });
        await store.load();
        assert.equal(store.stageSetting(VISUALIZER_PLUGIN_ID, 'Username', 'other'), false);
        assert.equal(store.draftFor(VISUALIZER_PLUGIN_ID), null);
        assert.equal(store.get().dirty, false);
        assert.deepEqual(await store.commitDrafts(), { ok: true });
        assert.deepEqual(writes(transport), []);
    });

    test('no method of the store deletes a plugin', async () => {
        const transport = pluginsServer();
        const store = createPluginsStore({ transport, canManage: true });
        await store.load();
        assert.equal(typeof store.remove, 'undefined');
        assert.equal(typeof store.delete, 'undefined');
        assert.deepEqual(transport.calls.filter((call) => call.method === 'DELETE'), []);
    });

    test('the plugin list and the plugin settings are read as before', async () => {
        const transport = pluginsServer();
        const store = createPluginsStore({ transport });
        await store.load();
        assert.deepEqual(await store.loadSettings(VISUALIZER_PLUGIN_ID), { Username: 'ben' });
        assert.deepEqual(transport.calls.map((call) => `${call.method} ${call.path}`),
            ['GET /plugins', `GET /plugins/${VISUALIZER_PLUGIN_ID}/settings`]);
    });
});

const UPDATE_ROW = SETTINGS_ROWS.find((row) => row.id === 'extensions-decent-app-updates');
const UPDATE_LEAF = UPDATE_ROW.leaf;

function memoryBackend() {
    const data = new Map();
    return {
        async get(key) { return data.get(key); },
        async set(key, value) { data.set(key, value); },
        async remove(key) { data.delete(key); },
    };
}

async function updateCheckRig(storedOn) {
    const document_ = { automaticUpdateCheck: storedOn, logLevel: 'INFO' };
    const transport = transportOf(({ key, body }) => {
        if (key === 'GET /settings') return ok({ ...document_ });
        if (key === 'POST /settings') {
            if (body.automaticUpdateCheck === true && document_.automaticUpdateCheck !== true) return bad(401);
            Object.assign(document_, body);
            return ok({ ...document_ });
        }
        return bad(404);
    });
    const storage = createStorageRouter({
        backends: {
            [LAYERS.local]: memoryBackend(),
            [LAYERS.session]: memoryBackend(),
            [LAYERS.kv]: memoryBackend(),
            [LAYERS.kvNumpad]: memoryBackend(),
        },
    });
    const settings = createSettingsStore({ storage, capabilities: { capability: () => 'present' } });
    const machine = createMachineFieldsPort({ app: createAppSettingsClient(transport) });
    const model = createSettingsLeafModel({ settings, machine, limits: limitsFor('bengle'), machineClass: null });
    await model.load(UPDATE_LEAF);
    const view = () => model.allRows(UPDATE_LEAF).find((entry) => entry.id === UPDATE_ROW.id);
    return { transport, model, view, document_ };
}

describe('automatic update checks: a skin may turn them off, never on', () => {
    test('the row is marked as one this skin can only turn off', () => {
        assert.equal(UPDATE_ROW.offOnly, true);
        assert.equal(UPDATE_ROW.offOnlyNote, 'Turn this on in Decaid Lab. This skin can only turn it off.');
    });

    test('while it is off the switch is drawn disabled and says where to turn it on', async () => {
        const { view } = await updateCheckRig(false);
        assert.equal(view().inert, true);
        assert.ok(view().notes.includes(UPDATE_ROW.offOnlyNote));
    });

    test('turning it on is refused here and no request goes out', async () => {
        const { transport, model, view } = await updateCheckRig(false);
        const result = await model.set(UPDATE_ROW, true);
        assert.equal(result.ok, false);
        assert.equal(result.staged, false);
        assert.equal(model.changeCount, 0);
        assert.equal(view().checked, false);
        await model.commit();
        assert.deepEqual(writes(transport), []);
    });

    test('while it is on the switch can be used and carries no note', async () => {
        const { view } = await updateCheckRig(true);
        assert.equal(view().inert, false);
        assert.ok(!view().notes.includes(UPDATE_ROW.offOnlyNote));
        assert.equal(view().checked, true);
    });

    test('turning it off is sent and saved', async () => {
        const { transport, model, view, document_ } = await updateCheckRig(true);
        const result = await model.set(UPDATE_ROW, false);
        assert.equal(result.ok, true);
        assert.equal(result.staged, true);
        const outcome = await model.commit();
        assert.equal(outcome.ok, true);
        assert.deepEqual(writes(transport).map((call) => call.body), [{ automaticUpdateCheck: false }]);
        assert.equal(document_.automaticUpdateCheck, false);
        assert.equal(view().checked, false);
    });

    test('once it is off the switch is disabled', async () => {
        const { model, view } = await updateCheckRig(true);
        await model.set(UPDATE_ROW, false);
        assert.equal(view().inert, false);
        await model.commit();
        assert.equal(view().inert, true);
    });

    test('turning it off and on again before Save sends nothing', async () => {
        const { transport, model, view } = await updateCheckRig(true);
        await model.set(UPDATE_ROW, false);
        const back = await model.set(UPDATE_ROW, true);
        assert.equal(back.ok, true);
        assert.equal(model.changeCount, 0);
        assert.equal(view().checked, true);
        await model.commit();
        assert.deepEqual(writes(transport), []);
    });

    test('the app settings client never sends a body that turns them on', async () => {
        const transport = transportOf(() => ok({}));
        const client = createAppSettingsClient(transport);
        assert.equal(await client.write({ automaticUpdateCheck: true, logLevel: 'INFO' }), false);
        assert.deepEqual(transport.calls, []);
        assert.equal(await client.write({ automaticUpdateCheck: false }), true);
        assert.deepEqual(transport.calls.map((call) => call.body), [{ automaticUpdateCheck: false }]);
    });
});
