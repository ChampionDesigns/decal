
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createReaKvBackend, DEFAULT_API_BASE } from '../src/data/rea-kv-backend.js';
import { createStorageRouter } from '../src/lib/storage-router.js';
import { createMemoryBackend } from '../src/lib/storage-backends.js';

function fakeFetch(handler) {
    const calls = [];
    const fetchImpl = async (url, init = {}) => {
        calls.push({ url, method: init.method, body: init.body, headers: init.headers });
        return handler(url, init);
    };
    fetchImpl.calls = calls;
    return fetchImpl;
}

const ok = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

test('reads GET the namespaced key path', async () => {
    const fetchImpl = fakeFetch(() => ok('mL'));
    const backend = createReaKvBackend({ namespace: 'decal', fetch: fetchImpl });
    assert.equal(await backend.get('waterTankUnit'), 'mL');
    assert.deepEqual(fetchImpl.calls[0].url, '/api/v1/store/decal/waterTankUnit');
    assert.equal(fetchImpl.calls[0].method, 'GET');
});

test('writes POST the value as a JSON body', async () => {
    const fetchImpl = fakeFetch(() => ok({}));
    const backend = createReaKvBackend({ namespace: 'decal', fetch: fetchImpl });
    await backend.set('favouriteProfiles', [{ slot: 1 }]);
    const call = fetchImpl.calls[0];
    assert.equal(call.method, 'POST');
    assert.equal(call.url, '/api/v1/store/decal/favouriteProfiles');
    assert.equal(call.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(call.body), [{ slot: 1 }]);
});

test('deletes use DELETE on the same path', async () => {
    const fetchImpl = fakeFetch(() => ok({}));
    const backend = createReaKvBackend({ namespace: 'decal', fetch: fetchImpl });
    await backend.remove('tempUnit');
    assert.equal(fetchImpl.calls[0].method, 'DELETE');
    assert.equal(fetchImpl.calls[0].url, '/api/v1/store/decal/tempUnit');
});

test('namespace and key are BOTH percent-encoded', async () => {
    const fetchImpl = fakeFetch(() => ok(null));
    const backend = createReaKvBackend({ namespace: 'decal.numpad', fetch: fetchImpl });
    await backend.get('previous-values-hot water/temp');
    assert.equal(
        fetchImpl.calls[0].url,
        '/api/v1/store/decal.numpad/previous-values-hot%20water%2Ftemp',
    );
});

test('the WRITE side refuses null — ReaPrime would store the string "null"', async () => {
    const fetchImpl = fakeFetch(() => ok({}));
    const backend = createReaKvBackend({ namespace: 'decal', fetch: fetchImpl });
    for (const absent of [null, undefined]) {
        await assert.rejects(() => backend.set('tempUnit', absent), (error) => {
            assert.ok(error instanceof TypeError);
            assert.match(error.message, /literal string "null"|refusing to store/);
            return true;
        });
    }
    assert.deepEqual(fetchImpl.calls, [], 'a refused write must not touch the network');
});

test('the router never lets a null reach the KV backend at all', async () => {
    const fetchImpl = fakeFetch(() => ok({}));
    const router = createStorageRouter({
        backends: {
            kv: createReaKvBackend({ namespace: 'decal', fetch: fetchImpl }),
            local: createMemoryBackend(),
        },
    });
    assert.equal(await router.set('waterTankUnit', null), true);
    assert.deepEqual(fetchImpl.calls.map((c) => c.method), ['DELETE']);
    assert.equal(fetchImpl.calls[0].body, undefined);
});

test('a never-written key reads as absent — the 200-with-null the handler actually sends', async () => {
    const nullBody = createReaKvBackend({ namespace: 'decal', fetch: fakeFetch(() => ok(null)) });
    assert.equal(await nullBody.get('never-written'), undefined);
});

test('a 404 is now a FAILURE, not a quiet absence — the dead branch is gone', async () => {
    const notFound = createReaKvBackend({ namespace: 'decal', fetch: fakeFetch(() => ok(null, 404)) });
    await assert.rejects(() => notFound.get('never-written'), /KV read failed: 404/);
});

test('a transport failure surfaces to the router as a false, never as a silent success', async () => {
    const backend = createReaKvBackend({ namespace: 'decal', fetch: fakeFetch(() => ok('boom', 500)) });
    const router = createStorageRouter({ backends: { kv: backend, local: createMemoryBackend() } });
    assert.equal(await router.set('waterTankUnit', 'mL'), false);
    assert.equal(await router.get('waterTankUnit', { fallback: 'mm' }), 'mm');
});

test('the router drives the real KV client end to end, and the local layer stays empty', async () => {
    const store = new Map();
    const fetchImpl = fakeFetch(async (url, init) => {
        const key = url.split('/').pop();
        if (init.method === 'POST') { store.set(key, JSON.parse(init.body)); return ok({}); }
        if (init.method === 'DELETE') { store.delete(key); return ok({}); }
        return ok(store.has(key) ? store.get(key) : null);
    });
    const local = createMemoryBackend();
    const router = createStorageRouter({
        backends: {
            local,
            kv: createReaKvBackend({ namespace: 'decal', fetch: fetchImpl }),
            kvNumpad: createReaKvBackend({ namespace: 'decal.numpad', fetch: fetchImpl }),
        },
    });

    await router.set('waterTankUnit', 'ml');
    await router.set('numpadRecents', [92, 93], { params: { field: 'brewTemp' } });

    assert.equal(await router.get('waterTankUnit'), 'ml');
    assert.deepEqual(await router.get('numpadRecents', { params: { field: 'brewTemp' } }), [92, 93]);
    assert.equal(local.size(), 0, 'a machine-scoped setting must not touch this device');
    assert.deepEqual([...store.keys()].sort(), ['previous-values-brewTemp', 'waterTankUnit']);
});

test('key enumeration returns an array, and a failure is a FAILURE — never an empty one', async () => {
    const listing = createReaKvBackend({ namespace: 'decal', fetch: fakeFetch(() => ok(['a', 'b'])) });
    assert.deepEqual(await listing.keys(), ['a', 'b']);
    const empty = createReaKvBackend({ namespace: 'decal', fetch: fakeFetch(() => ok([])) });
    assert.deepEqual(await empty.keys(), [], 'and the real empty answer still reads as empty');
    const broken = createReaKvBackend({ namespace: 'decal', fetch: fakeFetch(() => ok(null, 503)) });
    await assert.rejects(() => broken.keys(), /KV key enumeration failed: 503/);
    const wrongShape = createReaKvBackend({ namespace: 'decal', fetch: fakeFetch(() => ok({ not: 'an array' })) });
    await assert.rejects(() => wrongShape.keys(), /shape this build cannot read/);
});

test('base URL is injected, and trailing slashes do not double up', async () => {
    const fetchImpl = fakeFetch(() => ok(null));
    const backend = createReaKvBackend({
        namespace: 'decal', fetch: fetchImpl, baseUrl: 'http://bengle.local:3000/api/v1/',
    });
    await backend.get('theme');
    assert.equal(fetchImpl.calls[0].url, 'http://bengle.local:3000/api/v1/store/decal/theme');
    assert.equal(DEFAULT_API_BASE, '/api/v1');
});

test('the backend refuses to be built without a namespace or a fetch', () => {
    assert.throws(() => createReaKvBackend({ fetch: () => {} }), /namespace is required/);
    assert.throws(() => createReaKvBackend({ namespace: 'decal' }), /fetch implementation is required/);
});
