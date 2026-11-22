import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createProfileLibraryStore } from '../src/stores/profile-library-store.js';
import { createProfileArmStore } from '../src/stores/profile-arm-store.js';
import { createWorkflowStore } from '../src/stores/workflow-store.js';
import { createStorageRouter } from '../src/lib/storage-router.js';
import { createMemoryBackend } from '../src/lib/storage-backends.js';
import { LAYERS } from '../src/lib/storage-routes.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const WORKFLOW = JSON.parse(readFileSync(
    path.join(REPO, 'tools/rea-fixtures/api__v1__workflow.json'), 'utf8',
));

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function deepMerge(base, update) {
    const out = { ...base };
    for (const [key, value] of Object.entries(update)) {
        out[key] = isObject(value) && isObject(base[key]) ? deepMerge(base[key], value) : value;
    }
    return out;
}

function servedProfile(profile) {
    const out = { ...profile };
    if (out.de1_emulation !== true) delete out.de1_emulation;
    return out;
}

const steps = (temperature) => [{
    name: 'pour', pump: 'flow', transition: 'fast', exit: null, volume: 0, seconds: 30,
    weight: 0, temperature, sensor: 'coffee', flow: 2, limiter: null,
}];

const PLAIN = Object.freeze({
    version: '2', title: 'Plain', notes: '', author: 'Decent', beverage_type: 'espresso',
    steps: steps(92), tank_temperature: 0, target_weight: 36, target_volume: 0,
    target_volume_count_start: 0,
});

const EMULATED = Object.freeze({
    ...PLAIN, title: 'Emulated', steps: steps(93), de1_emulation: true,
});

const OWN_YIELD = Object.freeze({ ...PLAIN, title: 'Own yield', steps: steps(91) });

const recordOf = (id, profile, metadata = null) => ({
    id, profile, metadataHash: `${id}-meta`, compoundHash: `${id}-compound`, parentId: null,
    visibility: 'visible', isDefault: false, createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', metadata,
});

const ok = (data) => ({ ok: true, status: 200, data, notModified: false });

function mergingMachine(startProfile) {
    let current = { ...WORKFLOW, profile: servedProfile(startProfile) };
    const puts = [];
    const records = [
        recordOf('emulated', EMULATED),
        recordOf('plain', PLAIN),
        recordOf('own-yield', OWN_YIELD, { targetYield: 40 }),
    ];
    const transport = {
        puts,
        current: () => current,
        request: async (route, options = {}) => {
            const method = options.method ?? 'GET';
            if (route === '/profiles' && method === 'GET') {
                return ok(records.map((r) => ({ ...r, profile: servedProfile(r.profile) })));
            }
            if (route === '/machine/profile' && method === 'POST') return ok(null);
            if (route === '/workflow' && method === 'GET') return ok(structuredClone(current));
            if (route === '/workflow' && method === 'PUT') {
                puts.push(structuredClone(options.body));
                const merged = deepMerge(current, options.body);
                current = { ...merged, profile: servedProfile(merged.profile) };
                return ok(structuredClone(current));
            }
            return { ok: false, kind: 'http', status: 503, message: 'no recording', problem: null };
        },
    };
    return transport;
}

const memoryRouter = () => createStorageRouter({
    backends: {
        [LAYERS.kv]: createMemoryBackend(),
        [LAYERS.kvNumpad]: createMemoryBackend(),
        [LAYERS.local]: createMemoryBackend(),
        [LAYERS.session]: createMemoryBackend(),
    },
});

function build(startProfile) {
    const transport = mergingMachine(startProfile);
    const workflow = createWorkflowStore({ transport });
    const library = createProfileLibraryStore({
        transport, storage: memoryRouter(), arm: createProfileArmStore({ transport }), workflow,
    });
    return { transport, workflow, library };
}

describe('a profile load over a workflow that runs as a DE1', () => {
    test('a profile without the key turns DE1 emulation off on the merged workflow', async () => {
        const { transport, workflow, library } = build(EMULATED);
        await workflow.load();
        await library.load();
        assert.equal(transport.current().profile.de1_emulation, true);

        await library.arm('plain');

        const merged = transport.current().profile;
        assert.equal(merged.title, 'Plain');
        assert.equal(merged.de1_emulation === true, false);
        assert.equal(workflow.get().workflow.profile.de1_emulation === true, false);
    });

    test('the loaded profile after the load is the record without emulation', async () => {
        const { library, workflow } = build(EMULATED);
        await workflow.load();
        await library.load();

        const state = await library.arm('plain');
        assert.ok(state);
        assert.equal(library.get().loaded.id, 'plain');
    });

    test('a record whose own yield goes on the workflow is still the loaded profile', async () => {
        const { transport, library, workflow } = build(EMULATED);
        await workflow.load();
        await library.load();

        await library.arm('own-yield');
        assert.equal(transport.current().profile.target_weight, 40);
        assert.equal('de1_emulation' in transport.current().profile, false);
        assert.equal(library.get().loaded.id, 'own-yield');
    });

    test('every workflow body with a profile carries a boolean DE1 emulation value', async () => {
        const { transport, workflow, library } = build(EMULATED);
        await workflow.load();
        await library.load();
        await library.arm('plain');
        await library.arm('emulated');
        await library.arm('plain');

        const withProfile = transport.puts.filter((body) => isObject(body.profile));
        assert.equal(withProfile.length, 3);
        assert.deepEqual(withProfile.map((body) => body.profile.de1_emulation), [false, true, false]);
    });

    test('a profile with the key turns DE1 emulation on', async () => {
        const { transport, workflow, library } = build(PLAIN);
        await workflow.load();
        await library.load();
        await library.arm('emulated');
        assert.equal(transport.current().profile.de1_emulation, true);
        assert.equal(library.get().loaded.id, 'emulated');
    });
});
