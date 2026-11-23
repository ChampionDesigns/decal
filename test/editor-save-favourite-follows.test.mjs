/**
 * A favourite slot follows an editor save to the record the save returned. The server
 * answers a create whose content it already holds with the existing record, and the
 * favourite must land on that record, not on another visible version of the same profile.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createAppBoot } from '../src/lib/app-boot.js';
import { createMemoryBackend } from '../src/lib/storage-backends.js';
import { LAYERS } from '../src/lib/storage-routes.js';
import { FAVOURITES_KEY, FAVOURITES_SEEDED_KEY } from '../src/lib/profile-rules.js';
import { SAVE_STATUS } from '../src/stores/profile-editor-store.js';

const LOCATION = { hostname: '127.0.0.1', protocol: 'http:' };

const recipe = (title, exitPressure) => ({
    version: '2',
    title,
    author: 'Decal',
    notes: '',
    beverage_type: 'espresso',
    steps: [{
        name: 'preinfusion',
        pump: 'pressure',
        transition: 'fast',
        exit: { type: 'pressure', condition: 'over', value: exitPressure },
        pressure: 4,
        temperature: 93,
        seconds: 10,
    }],
    target_volume: 0,
    target_weight: 36,
    target_volume_count_start: 0,
    tank_temperature: 0,
});

const record = (id, { profile, parentId = null, visibility = 'visible', createdAt }) => ({
    id,
    profile,
    metadataHash: `meta-${id}`,
    compoundHash: `compound-${id}`,
    parentId,
    visibility,
    isDefault: false,
    createdAt,
    updatedAt: createdAt,
    metadata: null,
});

const contentKey = (profile) => JSON.stringify(profile);

function profileServer(records, { failVisibility = [] } = {}) {
    const held = new Map(records.map((r) => [r.id, structuredClone(r)]));
    const calls = [];
    let serial = 0;
    let workflowDoc = { profile: null, context: null };
    const json = (body, status = 200) => new Response(JSON.stringify(body), {
        status, headers: { 'content-type': 'application/json' },
    });
    const impl = async (url, options = {}) => {
        const target = new URL(url);
        const method = (options.method ?? 'GET').toUpperCase();
        calls.push({ method, path: target.pathname });
        const visibility = target.pathname.match(/^\/api\/v1\/profiles\/(.+)\/visibility$/);
        if (visibility && method === 'PUT') {
            const id = decodeURIComponent(visibility[1]);
            if (failVisibility.includes(id)) return json({ error: 'unavailable' }, 500);
            const found = held.get(id);
            if (!found) return json({ error: 'Invalid request' }, 400);
            found.visibility = JSON.parse(options.body).visibility;
            return json(found);
        }
        if (target.pathname === '/api/v1/profiles' && method === 'POST') {
            const body = JSON.parse(options.body);
            const existing = [...held.values()]
                .find((r) => contentKey(r.profile) === contentKey(body.profile));
            if (existing) return json(existing, 201);
            serial += 1;
            const made = record(`new-${serial}`, {
                profile: body.profile,
                parentId: body.parentId ?? null,
                createdAt: '2026-11-22T06:00:00.000Z',
            });
            held.set(made.id, made);
            return json(made, 201);
        }
        if (target.pathname === '/api/v1/profiles' && method === 'GET') {
            return json([...held.values()]);
        }
        if (target.pathname === '/api/v1/machine/profile' && method === 'POST') {
            return new Response(null, { status: 200 });
        }
        if (target.pathname === '/api/v1/workflow' && method === 'GET') return json(workflowDoc);
        if (target.pathname === '/api/v1/workflow' && method === 'PUT') {
            workflowDoc = { ...workflowDoc, ...JSON.parse(options.body) };
            return json(workflowDoc);
        }
        return json({ error: 'no recording' }, 503);
    };
    impl.calls = calls;
    impl.held = held;
    return impl;
}

function countingKv(initial) {
    const backend = createMemoryBackend(initial);
    const writes = [];
    const set = backend.set.bind(backend);
    backend.set = (key, value) => {
        writes.push({ key, value: structuredClone(value) });
        set(key, value);
    };
    backend.writes = writes;
    return backend;
}

const fakeSocket = () => (url) => ({
    url, addEventListener() {}, removeEventListener() {}, send() {}, close() {},
});

async function settle(times = 8) {
    for (let round = 0; round < times; round += 1) {
        await new Promise((done) => { setImmediate(done); });
    }
}

async function until(check, rounds = 200) {
    for (let round = 0; round < rounds; round += 1) {
        if (check()) return true;
        await settle(1);
    }
    return check();
}

async function saveFromEditor({
    records, slot0, slots = null, openId, savedProfile, failVisibility = [], between = null,
}) {
    const fetchImpl = profileServer(records, { failVisibility });
    const kv = countingKv({ [FAVOURITES_KEY]: slots ?? { 0: slot0 }, [FAVOURITES_SEEDED_KEY]: true });
    const boot = createAppBoot({
        fetch: fetchImpl,
        createSocket: fakeSocket(),
        location: LOCATION,
        importModule: async () => ({}),
        wait: async () => {},
        backends: { [LAYERS.kv]: kv },
    });
    await boot.library.load();
    kv.writes.length = 0;

    boot.profileEditor.open(boot.library.recordFor(openId));
    if (between) {
        between(kv);
        kv.writes.length = 0;
    }
    const state = await boot.profileEditor.saveAsNewVersion(savedProfile);
    assert.equal(state.save, SAVE_STATUS.SAVED, 'the save itself succeeded');
    const savedId = state.record.id;

    const armed = await until(() => boot.library.get().loaded?.id === savedId);
    await settle();
    const favouriteWrites = kv.writes.filter((w) => w.key === FAVOURITES_KEY);
    const result = {
        boot, savedId, armed, favouriteWrites, fetchImpl, state,
        assignments: { ...boot.library.get().favourites.assignments },
        storedMap: { ...kv.snapshot()[FAVOURITES_KEY] },
        slot0: boot.library.get().favourites.assignments[0] ?? null,
        stored: kv.snapshot()[FAVOURITES_KEY]?.[0] ?? null,
        loadedId: boot.library.get().loaded?.id ?? null,
    };
    boot.library.stop();
    return result;
}

const PARENT = record('parent-p', {
    profile: recipe('Extractamundo Dos!', 5), createdAt: '2026-11-20T10:00:00.000Z',
});
const OLDER_CHILD = record('child-c', {
    profile: recipe('Extractamundo Dos!', 5.5),
    parentId: 'parent-p',
    visibility: 'hidden',
    createdAt: '2026-11-21T14:24:00.000Z',
});
const NEWER_CHILD = record('child-s', {
    profile: recipe('Extractamundo Dos!', 6),
    parentId: 'parent-p',
    createdAt: '2026-11-22T05:47:00.000Z',
});

describe('a favourite slot follows an editor save', () => {
    test('a save that returns an existing older child moves the slot to that child', async () => {
        const run = await saveFromEditor({
            records: [PARENT, OLDER_CHILD, NEWER_CHILD],
            slot0: 'parent-p',
            openId: 'parent-p',
            savedProfile: recipe('Extractamundo Dos!', 5.5),
        });
        assert.equal(run.savedId, 'child-c', 'the server answered with the record it already held');
        assert.equal(run.fetchImpl.held.get('parent-p').visibility, 'hidden',
            'the save hid the record the slot held');
        assert.equal(run.slot0, 'child-c', 'slot 0 holds the saved record, not its newer sibling');
        assert.equal(run.stored, 'child-c', 'and that is what persisted');
        assert.equal(run.favouriteWrites.length, 1, 'one favourites write');
        assert.ok(run.armed, 'the saved record became the loaded record');
        assert.equal(run.loadedId, 'child-c', 'the loaded record is the saved record');
    });

    test('a save that creates a new record moves the slot to the new record', async () => {
        const run = await saveFromEditor({
            records: [PARENT, OLDER_CHILD, NEWER_CHILD],
            slot0: 'parent-p',
            openId: 'parent-p',
            savedProfile: recipe('Extractamundo Dos!', 7),
        });
        assert.equal(run.savedId, 'new-1', 'the server created a record');
        assert.equal(run.slot0, 'new-1');
        assert.equal(run.stored, 'new-1');
        assert.equal(run.favouriteWrites.length, 1, 'one favourites write');
        assert.equal(run.loadedId, 'new-1');
    });

    test('a save that returns the record the slot holds writes no favourite', async () => {
        const run = await saveFromEditor({
            records: [PARENT, { ...OLDER_CHILD, visibility: 'visible' }, NEWER_CHILD],
            slot0: 'child-c',
            openId: 'child-c',
            savedProfile: recipe('Extractamundo Dos!', 5.5),
        });
        assert.equal(run.savedId, 'child-c');
        assert.equal(run.slot0, 'child-c');
        assert.equal(run.favouriteWrites.length, 0, 'the rail was not written');
        assert.equal(run.loadedId, 'child-c');
    });
});

describe('the favourite follow step writes from the stored rail', () => {
    test('a slot that another client changed during the edit keeps that client\'s value', async () => {
        const run = await saveFromEditor({
            records: [PARENT, OLDER_CHILD, NEWER_CHILD],
            slots: { 0: 'parent-p', 1: null },
            openId: 'parent-p',
            savedProfile: recipe('Extractamundo Dos!', 7),
            between: (kv) => kv.set(FAVOURITES_KEY, { 0: 'parent-p', 1: 'child-s' }),
        });
        assert.equal(run.savedId, 'new-1');
        assert.equal(run.storedMap[1], 'child-s', 'the other client\'s slot is still stored');
        assert.equal(run.assignments[1], 'child-s', 'and it is on the rail');
        assert.equal(run.storedMap[0], 'new-1', 'the edited slot holds the saved record');
        assert.equal(run.assignments[0], 'new-1');
    });

    test('a slot that another client moved off the edited record is not written', async () => {
        const run = await saveFromEditor({
            records: [PARENT, OLDER_CHILD, NEWER_CHILD],
            slots: { 0: 'parent-p' },
            openId: 'parent-p',
            savedProfile: recipe('Extractamundo Dos!', 7),
            between: (kv) => kv.set(FAVOURITES_KEY, { 0: 'child-s' }),
        });
        assert.equal(run.storedMap[0], 'child-s');
        assert.equal(run.favouriteWrites.length, 0, 'the follow step wrote nothing');
    });
});

describe('the favourite follows only to a visible record', () => {
    test('a save that returns a hidden record whose un-hide fails leaves the slot on the edited record',
        async () => {
            const run = await saveFromEditor({
                records: [PARENT, OLDER_CHILD, NEWER_CHILD],
                slot0: 'child-s',
                openId: 'child-s',
                savedProfile: recipe('Extractamundo Dos!', 5.5),
                failVisibility: ['child-c'],
            });
            assert.equal(run.savedId, 'child-c', 'the server answered with the hidden record');
            assert.equal(run.state.savedHidden, true, 'the editor state says the record stayed hidden');
            assert.equal(run.fetchImpl.held.get('child-s').visibility, 'visible',
                'the edited record was not hidden');
            assert.equal(run.slot0, 'child-s', 'the slot stays on the edited record');
            assert.equal(run.stored, 'child-s');
            assert.equal(run.favouriteWrites.length, 0, 'no favourites write');
        });

    test('a save whose un-hide succeeds reports no hidden record', async () => {
        const run = await saveFromEditor({
            records: [PARENT, OLDER_CHILD, NEWER_CHILD],
            slot0: 'parent-p',
            openId: 'parent-p',
            savedProfile: recipe('Extractamundo Dos!', 5.5),
        });
        assert.equal(run.state.savedHidden, false);
        assert.equal(run.state.hidRecordId, 'parent-p');
    });
});

const native = { ...recipe('Native', 4), de1_emulation: false };
const NATIVE = record('native-n', { profile: native, createdAt: '2026-11-20T10:00:00.000Z' });
const EMULATED = record('emulated-e', {
    profile: { ...native, de1_emulation: true },
    parentId: 'native-n',
    createdAt: '2026-11-21T10:00:00.000Z',
});

describe('one record holds at most one favourite slot', () => {
    test('emulation off on a favourited copy of a favourited profile clears the copy\'s slot', async () => {
        const run = await saveFromEditor({
            records: [NATIVE, EMULATED],
            slots: { 0: 'native-n', 1: 'emulated-e' },
            openId: 'emulated-e',
            savedProfile: { ...native, de1_emulation: false },
        });
        assert.equal(run.savedId, 'native-n', 'the content matched the native record');
        assert.equal(run.fetchImpl.held.get('emulated-e').visibility, 'hidden');
        assert.deepEqual([run.assignments[0], run.assignments[1]], ['native-n', null]);
        assert.deepEqual([run.storedMap[0], run.storedMap[1]], ['native-n', null]);
        assert.equal(run.favouriteWrites.length, 1, 'one favourites write');
        const entries = run.boot.library.favouriteEntries();
        assert.equal(entries[0]?.value, 'native-n', 'slot 0 resolves to its own record');
        assert.equal(entries[1], null, 'slot 1 is clear, so a hold on it resolves to nothing');
        assert.equal(run.boot.library.favouriteSlotHolding('native-n'), 0);
    });

    test('a bundled profile that the save keeps on the list keeps its slot', async () => {
        const bundled = {
            ...record('bundled-b', { profile: recipe('Bundled', 3), createdAt: '2026-01-01T00:00:00.000Z' }),
            isDefault: true,
        };
        const copy = record('copy-c', {
            profile: recipe('Bundled', 3.5), parentId: 'bundled-b', createdAt: '2026-11-01T00:00:00.000Z',
        });
        const run = await saveFromEditor({
            records: [bundled, copy],
            slots: { 0: 'copy-c', 1: 'bundled-b' },
            openId: 'bundled-b',
            savedProfile: recipe('Bundled', 3.5),
        });
        assert.equal(run.savedId, 'copy-c');
        assert.equal(run.fetchImpl.held.get('bundled-b').visibility, 'visible');
        assert.deepEqual([run.assignments[0], run.assignments[1]], ['copy-c', 'bundled-b']);
        assert.equal(run.favouriteWrites.length, 0);
    });
});
