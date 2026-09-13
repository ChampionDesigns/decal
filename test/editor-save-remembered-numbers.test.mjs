/**
 * The dose, the yield and the grind, across a save.
 *
 * Those three numbers live on the record's `metadata`, not on the profile: the Live rail
 * writes them and arm time reads them back. This suite follows them from the save through
 * to the workflow document the machine is loaded with.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createProfileEditorStore, SAVE_STATUS } from '../src/stores/profile-editor-store.js';
import { createProfileLibraryStore } from '../src/stores/profile-library-store.js';
import { createProfileArmStore } from '../src/stores/profile-arm-store.js';
import { createStorageRouter } from '../src/lib/storage-router.js';
import { createMemoryBackend } from '../src/lib/storage-backends.js';
import { LAYERS } from '../src/lib/storage-routes.js';
import { FAVOURITES_KEY, FAVOURITES_SEEDED_KEY } from '../src/lib/profile-rules.js';
import { workflowApplyBody } from '../src/data/rea-profile.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const WORKFLOW = JSON.parse(readFileSync(
    path.join(REPO, 'tools/rea-fixtures/api__v1__workflow.json'), 'utf8',
));

const DIALLED_IN = Object.freeze({
    targetDoseWeight: 22,
    targetYield: 48,
    grinderSetting: '5.50',
});

const profileAt = (temperature, weight = 36) => ({
    version: 2,
    title: 'Morning ristretto',
    notes: '',
    author: 'bench',
    beverage_type: 'espresso',
    steps: [{ name: 'infuse', pump: 'flow', flow: 4, temperature, seconds: 20 }],
    target_volume: 0,
    target_weight: weight,
    target_volume_count_start: 0,
    tank_temperature: 0,
});

const recordOf = (id, profile, extra = {}) => ({
    id,
    profile,
    parentId: null,
    metadata: null,
    visibility: 'visible',
    isDefault: false,
    metadataHash: `meta-${id}`,
    compoundHash: `compound-${id}`,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...extra,
});

const ok = (data, status = 200) => ({ ok: true, status, data, notModified: false });

function fakeServer(seed = []) {
    const records = seed.map((record) => ({ ...record }));
    const calls = [];
    let minted = 0;
    const find = (id) => records.find((record) => record.id === id) ?? null;
    const transport = {
        calls,
        records,
        async request(reqPath, options = {}) {
            const method = options.method ?? 'GET';
            const body = options.body ?? null;
            calls.push({ path: reqPath, method, body });

            if (method === 'GET' && reqPath === '/profiles') return ok(records.map((r) => ({ ...r })));
            if (method === 'GET' && reqPath === '/workflow') return ok(WORKFLOW);
            if (method === 'POST' && reqPath === '/machine/profile') return ok(null);

            if (method === 'POST' && reqPath === '/profiles') {
                minted += 1;
                const created = recordOf(`profile:v${minted}`, body.profile, {
                    parentId: body.parentId ?? null,
                    metadata: body.metadata ?? null,
                });
                records.push(created);
                return ok({ ...created }, 201);
            }

            const visibility = /^\/profiles\/([^/]+)\/visibility$/.exec(reqPath);
            if (method === 'PUT' && visibility) {
                const record = find(decodeURIComponent(visibility[1]));
                if (!record) return { ok: false, kind: 'http', status: 400, message: 'no such record', problem: null };
                record.visibility = body.visibility;
                return ok({ ...record });
            }

            const update = /^\/profiles\/([^/]+)$/.exec(reqPath);
            if (method === 'PUT' && update) {
                const record = find(decodeURIComponent(update[1]));
                if (!record) return { ok: false, kind: 'http', status: 400, message: 'no such record', problem: null };
                if (body && body.profile) record.profile = body.profile;
                if (body && Object.hasOwn(body, 'metadata')) record.metadata = body.metadata;
                return ok({ ...record });
            }

            return { ok: false, kind: 'http', status: 503, message: `unrouted ${method} ${reqPath}`, problem: null };
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

const lastCreate = (transport) => [...transport.calls]
    .reverse().find((call) => call.method === 'POST' && call.path === '/profiles')?.body ?? null;

describe('an ordinary save carries the numbers the profile was dialled in with', () => {
    test('dose, yield and grind ride on the create — the server inherits none of them', async () => {
        const seated = recordOf('profile:seed', profileAt(90), { metadata: { ...DIALLED_IN } });
        const transport = fakeServer([seated]);
        const store = createProfileEditorStore({ transport });
        store.open(seated);

        await store.saveAsNewVersion(profileAt(91));

        assert.equal(store.get().save, SAVE_STATUS.SAVED);
        assert.deepEqual(lastCreate(transport).metadata, { ...DIALLED_IN });
    });

    test('a record that remembers nothing sends no metadata at all', async () => {
        const seated = recordOf('profile:seed', profileAt(90));
        const transport = fakeServer([seated]);
        const store = createProfileEditorStore({ transport });
        store.open(seated);

        await store.saveAsNewVersion(profileAt(91));

        assert.equal(Object.hasOwn(lastCreate(transport), 'metadata'), false,
            'an absent metadata map is the honest body — there is nothing to remember');
    });

    test('a caller that supplies metadata is not second-guessed', async () => {
        const seated = recordOf('profile:seed', profileAt(90), { metadata: { ...DIALLED_IN } });
        const transport = fakeServer([seated]);
        const store = createProfileEditorStore({ transport });
        store.open(seated);

        await store.saveAsNewVersion(profileAt(91), { metadata: { targetDoseWeight: 15 } });

        assert.deepEqual(lastCreate(transport).metadata, { targetDoseWeight: 15 });
    });

    test('the bundle marks of a factory parent are NOT carried onto the derived record', async () => {
        const seated = recordOf('profile:bundled', profileAt(90), {
            isDefault: true,
            metadata: { ...DIALLED_IN, filename: 'best-practice.json', source: 'bundled' },
        });
        const transport = fakeServer([seated]);
        const store = createProfileEditorStore({ transport });
        store.open(seated);

        await store.saveAsNewVersion(profileAt(91));

        assert.deepEqual(lastCreate(transport).metadata, { ...DIALLED_IN });
    });
});

describe('editing the profile’s own target weight is not overridden by a stale yield', () => {
    test('a changed target_weight drops the remembered yield and keeps dose and grind', async () => {
        const seated = recordOf('profile:seed', profileAt(90, 36), { metadata: { ...DIALLED_IN } });
        const transport = fakeServer([seated]);
        const store = createProfileEditorStore({ transport });
        store.open(seated);

        await store.saveAsNewVersion(profileAt(90, 40));

        assert.deepEqual(lastCreate(transport).metadata,
            { targetDoseWeight: 22, grinderSetting: '5.50' });
    });

    test('and the arm that follows then loads the weight that was typed', () => {
        const saved = recordOf('profile:v1', profileAt(90, 40), {
            metadata: { targetDoseWeight: 22, grinderSetting: '5.50' },
        });
        assert.equal(workflowApplyBody(saved).context.targetYield, 40,
            'with no remembered yield the profile’s own target_weight governs');
    });

    test('an unrelated edit leaves the yield exactly where it was', async () => {
        const seated = recordOf('profile:seed', profileAt(90, 36), { metadata: { ...DIALLED_IN } });
        const transport = fakeServer([seated]);
        const store = createProfileEditorStore({ transport });
        store.open(seated);

        await store.saveAsNewVersion(profileAt(91, 36));

        assert.equal(lastCreate(transport).metadata.targetYield, 48);
    });
});

describe('the numbers survive the walk the shell takes after a save', () => {
    async function walk({ edit }) {
        const seated = recordOf('profile:seed', profileAt(90), { metadata: { ...DIALLED_IN } });
        const transport = fakeServer([seated]);
        const storage = memoryRouter();
        const applied = [];
        const workflow = { async apply(body) { applied.push(body); return body; } };
        const library = createProfileLibraryStore({
            transport, storage, workflow, arm: createProfileArmStore({ transport }),
        });
        const editor = createProfileEditorStore({ transport });

        await storage.set(FAVOURITES_KEY, {
            0: 'profile:seed', 1: null, 2: null, 3: null, 4: null,
        });
        await storage.set(FAVOURITES_SEEDED_KEY, true);
        await library.load();
        library.select('profile:seed');
        editor.open(library.recordFor('profile:seed'));

        await editor.saveAsNewVersion(edit);
        const savedId = editor.get().record.id;

        await library.refresh();
        const saved = library.recordFor(savedId);
        library.select(savedId);
        const slot = library.favouriteSlotHolding(saved.parentId ?? null);
        if (slot !== null) await library.setFavourite(slot, savedId);
        await library.healFavourites();
        await library.arm(savedId);

        return { library, savedId, applied, storage };
    }

    test('an unrelated edit keeps 22 g, 48 g and 5.50 all the way onto the machine', async () => {
        const { library, savedId, applied, storage } = await walk({ edit: profileAt(91) });

        assert.equal(applied.length, 1, 'one arm, one workflow write');
        assert.deepEqual(applied[0].context, {
            targetDoseWeight: 22, targetYield: 48, grinderSetting: '5.50',
        });
        assert.equal(applied[0].profile.steps[0].temperature, 91, 'the edit is what was armed');
        assert.equal(applied[0].profile.target_weight, 48,
            'the remembered yield governs the stop, so it is folded into the profile sent');

        assert.equal(library.get().favourites.assignments[0], savedId,
            'the rail follows the save');
        assert.equal((await storage.get(FAVOURITES_KEY))[0], savedId);
        assert.equal(library.recordFor(savedId).metadata.targetDoseWeight, 22,
            'and the re-read listing carries the numbers, so the next open starts from them');
    });

    test('an edit to the target weight arms the new weight, with dose and grind intact',
        async () => {
            const { applied } = await walk({ edit: profileAt(90, 40) });

            assert.deepEqual(applied[0].context, {
                targetDoseWeight: 22, targetYield: 40, grinderSetting: '5.50',
            });
        });
});
