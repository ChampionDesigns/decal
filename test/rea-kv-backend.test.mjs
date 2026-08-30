// The ReaPrime KV backend. Paths and verbs are transcribed from kv_store_handler.dart;
// w0b's contract table owns verifying them as a build gate (Gate D). What these tests own
// is the client half: one implementation, encoded keys, and no thrown surprises.
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

/* THE SAMPLE KEY IS `waterTankUnit`, AND IT WAS `steamStopMode` UNTIL 27 AUGUST 2026.
 *
 * That row is retired — the Live rail derives the steam stop mode from the machine's own
 * fields now rather than keeping a copy, so the key has no reader and a `layer: 'none'` row
 * makes the router throw on it. Nothing in this file is about steam or about tanks: what it
 * needs is a key the routing table sends to the KV layer, and the tank's display unit is
 * one. The claims are unchanged. */
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
    // The old skin had two implementations of these routes and only one encoded, so a key
    // with '/', '#' or a space broke one path and not the other. There is one here.
    const fetchImpl = fakeFetch(() => ok(null));
    const backend = createReaKvBackend({ namespace: 'decal.numpad', fetch: fetchImpl });
    await backend.get('previous-values-hot water/temp');
    assert.equal(
        fetchImpl.calls[0].url,
        '/api/v1/store/decal.numpad/previous-values-hot%20water%2Ftemp',
    );
});

test('the WRITE side refuses null — ReaPrime would store the string "null"', async () => {
    // The read side's null handling was covered; the request side was not, and it is
    // the one that corrupts. kv_store_handler.dart:40-48:
    //     final maybeJson = jsonDecode(value);  ...  value: maybeJson ?? value
    // jsonDecode('null') is null, so the `??` falls through to the RAW BODY STRING and
    // the store ends up holding 'null' — four characters, truthy, indistinguishable
    // from a real setting on the next read. Nothing must reach the wire.
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
    // Belt and braces, and this is the braces: the router routes null to remove(), so
    // the wire sees a DELETE rather than a POST that the backend would have to refuse.
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
    // kv_store_handler.dart returns jsonOk(store.get(...)) — 200 with a null body — and has
    // no jsonNotFound anywhere (the whole file was read at the pin; test/gate-d.test.mjs
    // asserts it still has none). The 404 branch the old client carried was therefore DEAD,
    // and A7 says a fallback for a status the server does not send is deleted rather than
    // kept "just in case": kept, it hides the day the server starts sending one.
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
    // This test used to assert the opposite, and that is the sharpest thing about it: a
    // suite defending the defect. `return []` on a 503 renders a dead server as "this
    // namespace is empty" — SCOPE Part 3 §7's CB-21 exactly — and coercing a non-array body
    // to [] does the same for a shape this build cannot read. An empty namespace is a real
    // answer; the server spells it `[]` and nothing else may.
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
