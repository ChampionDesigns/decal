
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createStorageRouter, StorageRouterError, ERROR_CODES } from '../src/lib/storage-router.js';
import { createMemoryBackend } from '../src/lib/storage-backends.js';
import {
    STORAGE_ROUTES,
    STORAGE_PREFIX,
    LAYERS,
    PREFIXED_LAYERS,
    allKeys,
} from '../src/lib/storage-routes.js';

const LIVE_LAYERS = [LAYERS.local, LAYERS.session, LAYERS.kv, LAYERS.kvNumpad];

function fixture(logger) {
    const backends = Object.fromEntries(LIVE_LAYERS.map((layer) => [layer, createMemoryBackend()]));
    return { backends, router: createStorageRouter({ backends, logger }) };
}

function recordingLogger() {
    const lines = [];
    const self = {
        debug: (...a) => lines.push(['debug', ...a]),
        info: (...a) => lines.push(['info', ...a]),
        warn: (...a) => lines.push(['warn', ...a]),
        error: (...a) => lines.push(['error', ...a]),
        scope: () => self,
        lines,
    };
    return self;
}

const paramsFor = (row) => (row.template ? { field: 'espressoTemp' } : undefined);

test('every routed row writes to its layer and to NO other layer', async () => {
    for (const key of allKeys()) {
        const row = STORAGE_ROUTES[key];
        if (row.layer === LAYERS.none) continue;

        const { router, backends } = fixture();
        const params = paramsFor(row);
        const value = { marker: key };

        assert.equal(await router.set(key, value, { params }), true, `${key}: set failed`);

        const expectedPhysical = PREFIXED_LAYERS.includes(row.layer)
            ? STORAGE_PREFIX + (row.template ? `previous-values-espressoTemp` : key)
            : (row.template ? `previous-values-espressoTemp` : key);

        assert.deepEqual(
            backends[row.layer].snapshot(),
            { [expectedPhysical]: value },
            `${key}: wrong physical key or wrong layer`,
        );
        for (const other of LIVE_LAYERS.filter((l) => l !== row.layer)) {
            assert.equal(backends[other].size(), 0, `${key}: leaked into '${other}' — that is the dual-write bug`);
        }

        assert.deepEqual(await router.get(key, { params }), value, `${key}: read back wrong`);
        assert.equal(await router.remove(key, { params }), true);
        assert.equal(backends[row.layer].size(), 0, `${key}: remove left something behind`);
    }
});

test('every unrouted row refuses the call and names the owner', async () => {
    const { router } = fixture();
    const none = allKeys().filter((key) => STORAGE_ROUTES[key].layer === LAYERS.none);
    for (const key of none) {
        await assert.rejects(
            () => router.set(key, 'x'),
            (error) => {
                assert.ok(error instanceof StorageRouterError, `${key}: wrong error type`);
                assert.equal(error.code, ERROR_CODES.NOT_ROUTED);
                assert.equal(error.owner, STORAGE_ROUTES[key].owner);
                assert.match(error.message, /is not Decal's to store/);
                return true;
            },
            `${key}: an unrouted key must be refused, not quietly written`,
        );
        await assert.rejects(() => router.get(key), /is not Decal's to store/);
    }
});

test('a shot rating cannot be persisted through the router at all', async () => {
    const { router } = fixture();
    await assert.rejects(() => router.set('shotRating', 80), /PUT \/api\/v1\/shots/);
});

test('an unknown key is an error, never a silent write', async () => {
    const { router, backends } = fixture();
    await assert.rejects(
        () => router.set('someKeyNobodyRouted', 1),
        (error) => error.code === ERROR_CODES.UNKNOWN_KEY && /needs a row in storage-routes.js/.test(error.message),
    );
    for (const layer of LIVE_LAYERS) assert.equal(backends[layer].size(), 0);
});

test('passing a physical key is rejected with the logical key in the message', async () => {
    const { router } = fixture();
    await assert.rejects(
        () => router.get(`${STORAGE_PREFIX}theme`),
        (error) => {
            assert.equal(error.code, ERROR_CODES.PREFIXED_KEY);
            assert.match(error.message, /pass the logical key \('theme'\)/);
            return true;
        },
    );
});

test('prefix enforcement: browser keys are prefixed, KV keys are not', () => {
    const { router } = fixture();
    assert.equal(router.physicalKey('theme'), 'decal.theme');
    assert.equal(router.physicalKey('pendingAssignmentIndex'), 'decal.pendingAssignmentIndex');
    assert.equal(router.physicalKey('waterTankUnit'), 'waterTankUnit');
    assert.equal(router.physicalKey('numpadRecents', { field: 'flow' }), 'previous-values-flow');
});

test('the old skin key name does not resolve — nothing migrates (A10)', async () => {
    const { router } = fixture();
    await assert.rejects(
        () => router.get('slate.profileFoldersOpen'),
        (error) => error.code === ERROR_CODES.UNKNOWN_KEY,
    );
    assert.equal(router.physicalKey('profileFoldersOpen'), 'decal.profileFoldersOpen');
});

test('a key family without its parameter fails loudly', async () => {
    const { router } = fixture();
    await assert.rejects(
        () => router.set('numpadRecents', [1, 2]),
        (error) => error.code === ERROR_CODES.BAD_TEMPLATE && /key family/.test(error.message),
    );
});

test('a layer with no backend is a wiring error, surfaced not swallowed', async () => {
    const router = createStorageRouter({ backends: { local: createMemoryBackend() } });
    await assert.rejects(
        () => router.set('waterTankUnit', 'x'),
        (error) => error.code === ERROR_CODES.NO_BACKEND && /layer 'kv'/.test(error.message),
    );
    assert.deepEqual(router.missingLayers(), ['kv', 'kvNumpad', 'session']);
});

test('missingLayers is empty once every layer is wired', () => {
    const { router } = fixture();
    assert.deepEqual(router.missingLayers(), []);
});

test('a failed write reports false, logs, and writes nowhere else', async () => {
    const logger = recordingLogger();
    const backends = Object.fromEntries(LIVE_LAYERS.map((layer) => [layer, createMemoryBackend()]));
    backends.kv = {
        get() { return undefined; },
        set() { throw new Error('quota exceeded'); },
        remove() {},
    };
    const router = createStorageRouter({ backends, logger });

    assert.equal(await router.set('waterTankUnit', 'mL'), false);
    assert.equal(backends.local.size(), 0, 'a failed KV write must not land in localStorage');
    assert.equal(backends.session.size(), 0);
    assert.ok(logger.lines.some(([level, message]) => level === 'error' && /NOT stored anywhere/.test(message)));
});

test('a failed read reports the fallback and logs — it never takes the caller down', async () => {
    const logger = recordingLogger();
    const backends = Object.fromEntries(LIVE_LAYERS.map((layer) => [layer, createMemoryBackend()]));
    backends.kv = {
        get() { throw new Error('network down'); },
        set() {}, remove() {},
    };
    const router = createStorageRouter({ backends, logger });
    assert.equal(await router.get('waterTankUnit', { fallback: 'mm' }), 'mm');
    assert.ok(logger.lines.some(([level, message]) => level === 'error' && /read failed/.test(message)));
});

test('absent means absent: a missing key returns the fallback, and null is not a value', async () => {
    const { router, backends } = fixture();
    assert.equal(await router.get('theme'), undefined);
    assert.equal(await router.get('theme', { fallback: 'dark' }), 'dark');
    backends.local.set('decal.theme', null);
    assert.equal(await router.get('theme', { fallback: 'dark' }), 'dark');
});

test('writing null or undefined DELETES — the router cannot store an absent value', async () => {
    for (const absent of [null, undefined]) {
        const { router, backends } = fixture();
        assert.equal(await router.set('theme', 'light'), true);
        assert.deepEqual(backends.local.snapshot(), { 'decal.theme': 'light' });

        assert.equal(await router.set('theme', absent), true, `set(${absent}) should report success`);
        assert.equal(backends.local.size(), 0, `set(${absent}) must leave nothing behind`);
        assert.equal(await router.get('theme', { fallback: 'dark' }), 'dark');
    }
});

test('a null write fans out as a delete, and still refuses an unrouted key', async () => {
    const { router } = fixture();
    const seen = [];
    router.onChange((event) => seen.push(event));
    await router.set('theme', null);
    assert.deepEqual(seen.map((e) => [e.key, e.layer, e.value]), [['theme', 'local', undefined]]);
    // The null path must not become a way around the table's `none` half.
    await assert.rejects(() => router.set('shotRating', null), /is not Decal's to store/);
    await assert.rejects(() => router.set('nobodyRoutedThis', null), /needs a row in storage-routes.js/);
});

test('a null write survives being destructured off the router', async () => {
    const { router, backends } = fixture();
    const { set } = router;
    await set('theme', 'light');
    assert.equal(await set('theme', null), true);
    assert.equal(backends.local.size(), 0);
});

test('onChange fans out successful writes and deletes, and survives a throwing listener', async () => {
    const logger = recordingLogger();
    const { router } = fixture(logger);
    const seen = [];
    const off = router.onChange((event) => seen.push(event));
    router.onChange(() => { throw new Error('listener exploded'); });

    await router.set('theme', 'light');
    await router.remove('theme');
    off();
    await router.set('theme', 'dark');

    assert.deepEqual(seen.map((e) => [e.key, e.layer, e.value]), [
        ['theme', 'local', 'light'],
        ['theme', 'local', undefined],
    ]);
    assert.equal(seen[0].physical, 'decal.theme');
    assert.ok(logger.lines.some(([level, message]) => level === 'error' && /listener threw/.test(message)));
});

test('a failed write does not fan out', async () => {
    const backends = Object.fromEntries(LIVE_LAYERS.map((layer) => [layer, createMemoryBackend()]));
    backends.local = { get() {}, set() { throw new Error('nope'); }, remove() {} };
    const router = createStorageRouter({ backends });
    const seen = [];
    router.onChange((e) => seen.push(e));
    assert.equal(await router.set('theme', 'light'), false);
    assert.deepEqual(seen, []);
});

test('describe() reports the whole table, layer and physical key included', () => {
    const { router } = fixture();
    const rows = router.describe();
    assert.equal(rows.length, allKeys().length);
    const theme = rows.find((row) => row.key === 'theme');
    assert.deepEqual(theme, {
        key: 'theme', layer: 'local', scope: 'device', status: 'v1',
        namespace: undefined, physical: 'decal.theme', owner: undefined,
    });
    const numpad = rows.find((row) => row.key === 'numpadRecents');
    assert.equal(numpad.namespace, 'decal.numpad');
    assert.equal(numpad.physical, 'previous-values-{field}');
    const rating = rows.find((row) => row.key === 'shotRating');
    assert.equal(rating.physical, null);
    assert.ok(rating.owner);
});

test('the router can be pointed at a different table — the mechanism is not the data', async () => {
    const backends = { local: createMemoryBackend() };
    const router = createStorageRouter({
        backends,
        routes: { probe: { layer: 'local', scope: 'device', status: 'v1', why: 'test', trace: 'test' } },
    });
    await router.set('probe', 7);
    assert.deepEqual(backends.local.snapshot(), { 'decal.probe': 7 });
    await assert.rejects(() => router.get('theme'), /no route for 'theme'/);
});
