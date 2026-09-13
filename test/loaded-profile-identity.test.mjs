/**
 * The loaded profile is the record whose recipe the machine is running — a title is not an identity.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    createProfileLibraryStore,
    LOADED_SOURCE,
    LOADED_UNRESOLVED,
} from '../src/stores/profile-library-store.js';
import { createProfileArmStore } from '../src/stores/profile-arm-store.js';
import { createStorageRouter } from '../src/lib/storage-router.js';
import { createMemoryBackend } from '../src/lib/storage-backends.js';
import { LAYERS } from '../src/lib/storage-routes.js';
import { workflowApplyBody } from '../src/data/rea-profile.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const WORKFLOW = JSON.parse(readFileSync(
    path.join(REPO, 'tools/rea-fixtures/api__v1__workflow.json'), 'utf8',
));

const ACTIVE_DEFAULT = Object.freeze({
    version: '1.0',
    title: 'Default',
    notes: 'Default notes',
    author: 'Decent',
    beverage_type: 'espresso',
    steps: [{
        name: 'Free flow',
        pump: 'pressure',
        transition: 'fast',
        exit: null,
        volume: 0,
        seconds: 120,
        weight: 0,
        temperature: 90,
        sensor: 'coffee',
        pressure: 7.5,
        limiter: null,
    }],
    tank_temperature: 0,
    target_weight: 0,
    target_volume: 0,
    target_volume_count_start: 0,
});

const LIBRARY_DEFAULT = Object.freeze({
    ...ACTIVE_DEFAULT,
    version: '2',
    steps: Object.freeze([1, 2, 3, 4, 5, 6].map((n) => ({
        name: `step ${n}`,
        pump: 'flow',
        transition: 'fast',
        exit: null,
        volume: 0,
        seconds: n + 4,
        weight: 0,
        temperature: 92,
        sensor: 'coffee',
        flow: 2,
        limiter: null,
    }))),
});

const recordOf = (id, profile, extra = {}) => ({
    id,
    profile,
    metadataHash: `${id}-meta`,
    compoundHash: `${id}-compound`,
    parentId: null,
    visibility: 'visible',
    isDefault: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    metadata: null,
    ...extra,
});

const workflowServing = (profile) => ({ ...WORKFLOW, profile });

function recordingTransport(script = {}) {
    const calls = [];
    return {
        calls,
        request: async (route, options = {}) => {
            const method = options.method ?? 'GET';
            calls.push({ path: route, method, query: options.query ?? null, body: options.body ?? null });
            const answer = script[`${method} ${route}`] ?? script[route];
            if (typeof answer === 'function') return answer(options);
            if (answer) return answer;
            return { ok: false, kind: 'http', status: 503, message: 'no recording', problem: null };
        },
    };
}

const ok = (data) => ({ ok: true, status: 200, data, notModified: false });

const memoryRouter = () => createStorageRouter({
    backends: {
        [LAYERS.kv]: createMemoryBackend(),
        [LAYERS.kvNumpad]: createMemoryBackend(),
        [LAYERS.local]: createMemoryBackend(),
        [LAYERS.session]: createMemoryBackend(),
    },
});

function build(records, profile, { workflow = null } = {}) {
    const transport = recordingTransport({
        '/profiles': ok(records),
        '/workflow': ok(workflowServing(profile)),
        'POST /machine/profile': ok(null),
        'PUT /profiles/lib-default': ok(recordOf('lib-default', LIBRARY_DEFAULT)),
    });
    const storage = memoryRouter();
    const store = createProfileLibraryStore({
        transport, storage, arm: createProfileArmStore({ transport }), workflow,
    });
    return { transport, storage, store };
}

describe('the loaded profile is the recipe the machine is running', () => {
    test('a record that shares the title and not the steps is NOT the loaded profile', async () => {
        const { store } = build([recordOf('lib-default', LIBRARY_DEFAULT)], ACTIVE_DEFAULT);
        const state = await store.load();

        assert.equal(state.loaded.id, null,
            'one title, two recipes — naming the library row would open six steps the machine is not running');
        assert.equal(state.loaded.known, false);
        assert.equal(state.loaded.confirmed, false);
        assert.equal(state.loaded.reason, LOADED_UNRESOLVED.CONTENT_MISMATCH);
        assert.equal(state.loaded.title, 'Default', 'the title is still reported');
        assert.deepEqual([...state.loaded.candidates], ['lib-default'],
            'and so is the record the title found — as a candidate, not as the answer');
    });

    test('the recipe itself is published, and it is the workflow report\'s own', async () => {
        const { store } = build([recordOf('lib-default', LIBRARY_DEFAULT)], ACTIVE_DEFAULT);
        const state = await store.load();
        assert.deepEqual(state.loaded.profile, ACTIVE_DEFAULT);
    });

    test('with no record to open, the active recipe opens as a draft with no id', async () => {
        const { store } = build([recordOf('lib-default', LIBRARY_DEFAULT)], ACTIVE_DEFAULT);
        await store.load();
        const draft = store.activeDraft();

        assert.equal(draft.id, null, 'no id, so a save stores a new profile rather than a version of another one');
        assert.equal(draft.parentId, null);
        assert.deepEqual(draft.profile.steps, ACTIVE_DEFAULT.steps, 'the exact steps the machine is running');
        assert.deepEqual(draft.profile, ACTIVE_DEFAULT);
        draft.profile.steps[0].seconds = 1;
        assert.equal(store.get().loaded.profile.steps[0].seconds, 120,
            'and editing the draft cannot reach back into the published state');
    });

    test('nothing is armed, highlighted or written against a profile that was not identified', async () => {
        const { transport, store } = build([recordOf('lib-default', LIBRARY_DEFAULT)], ACTIVE_DEFAULT);
        await store.load();
        const before = transport.calls.length;
        await store.rememberContext({ targetDoseWeight: 20 });

        assert.equal(transport.calls.length, before,
            'the rail\'s dose belongs to the loaded profile, and no record is the loaded profile here');
        assert.equal(store.get().selectedId, null, 'and the selector opens on nothing rather than on the wrong row');
    });

    test('a title match whose recipe agrees is still the loaded profile', async () => {
        const { store } = build(
            [recordOf('lib-default', LIBRARY_DEFAULT), recordOf('active', ACTIVE_DEFAULT, { profile: ACTIVE_DEFAULT })],
            ACTIVE_DEFAULT,
        );
        const state = await store.load();
        assert.equal(state.loaded.id, 'active', 'the check is the body, so a right answer stays a right answer');
        assert.equal(state.loaded.known, true);
        assert.equal(state.loaded.confirmed, true);
    });

    test('two saved versions under one title resolve to the one the machine holds', async () => {
        const older = { ...LIBRARY_DEFAULT, title: 'Espresso' };
        const newer = { ...ACTIVE_DEFAULT, title: 'Espresso' };
        const { store } = build(
            [recordOf('v1', older), recordOf('v2', newer, { parentId: 'v1' })],
            newer,
        );
        const state = await store.load();
        assert.equal(state.loaded.id, 'v2');
        assert.equal(state.loaded.confirmed, true);
    });

    test('a remembered drink weight does not cost the profile its identity', async () => {
        const record = recordOf('remembered-yield', LIBRARY_DEFAULT, {
            metadata: { targetDoseWeight: 18, targetYield: 42, grinderSetting: '4' },
        });
        const served = workflowApplyBody(record).profile;
        assert.equal(served.target_weight, 42, 'the document carries the remembered weight');

        const { store } = build([record], served);
        const state = await store.load();
        assert.equal(state.loaded.id, 'remembered-yield');
        assert.equal(state.loaded.confirmed, true);
    });
});

describe('the id this skin armed is a memory, not an identity', () => {
    const fakeWorkflow = () => ({ applied: [], async apply(patch, opts) { this.applied.push({ patch, opts }); } });

    const MINE = recordOf('mine', { ...LIBRARY_DEFAULT, title: 'Espresso' }, {
        metadata: { targetDoseWeight: 18, targetYield: 42, grinderSetting: '4' },
    });
    const SIBLING = recordOf('sibling', {
        ...LIBRARY_DEFAULT, title: 'Espresso', target_weight: 36,
    });
    const ARMED = workflowApplyBody(MINE).profile;

    function armed(storage, servedProfile) {
        const transport = recordingTransport({
            '/profiles': ok([MINE, SIBLING]),
            '/workflow': ok(workflowServing(servedProfile)),
            'POST /machine/profile': ok(null),
        });
        return {
            transport,
            store: createProfileLibraryStore({
                transport,
                storage,
                arm: createProfileArmStore({ transport }),
                workflow: fakeWorkflow(),
            }),
        };
    }

    test('the armed id names the row whose recipe the document is carrying', async () => {
        const storage = memoryRouter();
        const { store } = armed(storage, ARMED);
        await store.load();
        store.select('mine');
        await store.arm();

        const state = store.get();
        assert.equal(state.loaded.id, 'mine', 'the memory breaks a tie the title cannot');
        assert.equal(state.loaded.source, LOADED_SOURCE.REMEMBERED);
        assert.equal(state.loaded.confirmed, true);
    });

    test('a profile another client loaded under that same name is not the one we armed', async () => {
        const storage = memoryRouter();
        const first = armed(storage, ARMED);
        await first.store.load();
        first.store.select('mine');
        await first.store.arm();
        assert.equal(await storage.get('loadedProfileId'), 'mine', 'the id is remembered');

        const elsewhere = { ...ACTIVE_DEFAULT, title: 'Espresso' };
        const { store } = armed(storage, elsewhere);
        const state = await store.load();

        assert.equal(state.loaded.id, null, 'the remembered id names a recipe the machine is not running');
        assert.equal(state.loaded.confirmed, false);
        assert.deepEqual(store.activeDraft().profile.steps, elsewhere.steps,
            'and Edit opens what the machine is actually running');
    });
});
