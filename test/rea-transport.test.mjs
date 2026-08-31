
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    createReaTransport,
    reaBaseUrl,
    reaSocketBase,
    reaPath,
    reaQuery,
    REA_PORT,
    API_PREFIX,
} from '../src/data/rea-transport.js';
import { REA_ERROR, isReaFailure, reaMessageOf, unwrapRea, ReaError } from '../src/data/rea-errors.js';
import { createEtagStore } from '../src/data/rea-conditional.js';

const BASE = 'http://machine.local:8080/api/v1';

/** A fetch double. `plan` is a function of (url, init) returning a response-ish object. */
function fakeFetch(plan) {
    const calls = [];
    const impl = async (url, init) => {
        calls.push({ url, init, headers: { ...(init && init.headers) } });
        return plan(url, init, calls.length);
    };
    impl.calls = calls;
    return impl;
}

function jsonResponse(status, body, headers = {}) {
    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    return {
        status,
        ok: status >= 200 && status < 300,
        headers: { get: (name) => lower[name.toLowerCase()] ?? null },
        text: async () => (body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)),
    };
}

const transportWith = (plan, options) => {
    const fetchImpl = fakeFetch(plan);
    return { fetchImpl, transport: createReaTransport({ fetch: fetchImpl, baseUrl: BASE, ...options }) };
};

describe('base URL by injection', () => {
    test('the constructor refuses to invent one', () => {
        assert.throws(() => createReaTransport({ fetch: () => {} }), /baseUrl must be injected/);
        assert.throws(() => createReaTransport({ baseUrl: BASE }), /fetch implementation must be injected/);
    });

    test('reaBaseUrl is pure over values the caller read', () => {
        assert.equal(reaBaseUrl({ hostname: 'de1.local' }), `http://de1.local:${REA_PORT}${API_PREFIX}`);
        assert.equal(reaBaseUrl({ hostname: 'de1.local', protocol: 'https:' }), `https://de1.local:8080${API_PREFIX}`);
        assert.equal(reaBaseUrl({ hostname: 'de1.local', port: '' }), `http://de1.local${API_PREFIX}`);
        assert.throws(() => reaBaseUrl({}), /hostname is required/);
    });

    test('reaSocketBase follows the page protocol, not window', () => {
        assert.equal(reaSocketBase({ hostname: 'de1.local' }), 'ws://de1.local:8080');
        assert.equal(reaSocketBase({ hostname: 'de1.local', protocol: 'https:' }), 'wss://de1.local:8080');
    });

    test('socketUrl needs its base injected too', () => {
        const { transport } = transportWith(() => jsonResponse(200, {}));
        assert.throws(() => transport.socketUrl('/ws/v1/machine/snapshot'), /socketBaseUrl was not injected/);
        const withSocket = createReaTransport({ fetch: async () => {}, baseUrl: BASE, socketBaseUrl: 'ws://machine.local:8080' });
        assert.equal(withSocket.socketUrl('/ws/v1/machine/snapshot'), 'ws://machine.local:8080/ws/v1/machine/snapshot');
    });
});

describe('spelling a request', () => {
    test('reaPath encodes every interpolated segment', () => {
        assert.equal(reaPath`/shots/${'2026-08-17T09:14:22Z'}`, '/shots/2026-08-17T09%3A14%3A22Z');
        assert.equal(reaPath`/store/${'decal/numpad'}/${'a key'}`, '/store/decal%2Fnumpad/a%20key');
        assert.equal(reaPath`/devices/${'AA:BB:CC:DD:EE:FF'}`, '/devices/AA%3ABB%3ACC%3ADD%3AEE%3AFF');
    });

    test('reaQuery omits null and undefined, repeats arrays', () => {
        assert.equal(reaQuery({ limit: 20, offset: 0, search: null, order: undefined }), '?limit=20&offset=0');
        assert.equal(reaQuery({ ids: ['a', 'b'] }), '?ids=a&ids=b');
        assert.equal(reaQuery(null), '');
        assert.equal(reaQuery({}), '');
    });

    test('a body is JSON with the JSON content type; a GET has neither', async () => {
        const { transport, fetchImpl } = transportWith(() => jsonResponse(200, { ok: 1 }));
        await transport.get('/machine/state');
        assert.equal(fetchImpl.calls[0].init.body, undefined);
        assert.equal(fetchImpl.calls[0].headers['Content-Type'], undefined);

        await transport.post('/machine/profile', { title: 'x' });
        assert.equal(fetchImpl.calls[1].init.body, '{"title":"x"}');
        assert.equal(fetchImpl.calls[1].headers['Content-Type'], 'application/json');
    });
});

describe('failures are data, never a manufactured answer', () => {
    test('a non-2xx returns a typed http failure carrying the server envelope', async () => {
        const { transport } = transportWith(() => jsonResponse(400, { error: 'Unsupported profile', message: 'Power steps need firmware >= 3' }));
        const result = await transport.post('/machine/profile', { title: 'p' });

        assert.equal(result.ok, false);
        assert.equal(result.kind, REA_ERROR.HTTP);
        assert.equal(result.status, 400);
        assert.deepEqual(result.problem, { error: 'Unsupported profile', message: 'Power steps need firmware >= 3' });
        assert.equal(reaMessageOf(result), 'Unsupported profile: Power steps need firmware >= 3');
        assert.ok(isReaFailure(result));
        // Not null, not {}, not false, not a stale copy.
        assert.equal(result.data, undefined);
    });

    test('a rejected fetch is a network failure and does not throw', async () => {
        const { transport } = transportWith(() => { throw new Error('connect ECONNREFUSED'); });
        const result = await transport.get('/settings');
        assert.equal(result.kind, REA_ERROR.NETWORK);
        assert.equal(result.status, null);
        assert.match(result.message, /ECONNREFUSED/);
    });

    test('our own abort is a timeout, distinguishable from a network fault', async () => {
        const { transport } = transportWith((url, init) => new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }), { timeoutMs: 5 });
        const result = await transport.get('/machine/settings');
        assert.equal(result.kind, REA_ERROR.TIMEOUT);
        assert.match(result.message, /timed out after 5 ms/);
    });

    test('a 2xx body that is not JSON is a decode failure, not a null', async () => {
        const { transport } = transportWith(() => jsonResponse(200, '<html>proxy</html>'));
        const result = await transport.get('/settings');
        assert.equal(result.kind, REA_ERROR.DECODE);
        assert.equal(result.problem, '<html>proxy</html>');
    });

    test('a bodyless 202 is a success with null data', async () => {
        const { transport } = transportWith(() => jsonResponse(202, undefined));
        const result = await transport.post('/machine/settings', { fan: 40 });
        assert.equal(result.ok, true);
        assert.equal(result.status, 202);
        assert.equal(result.data, null);
    });

    test('unwrapRea is the opt-in throwing form', async () => {
        const { transport } = transportWith(() => jsonResponse(404, { error: 'Shot not found' }));
        const result = await transport.get('/shots/nope');
        assert.throws(() => unwrapRea(result), (e) => e instanceof ReaError && e.status === 404);
        assert.equal(unwrapRea({ ok: true, data: 7 }), 7);
    });
});

describe('expect: text — a verbatim relay is read as what it is', () => {
    test("a body of '0' stays the string it was, instead of becoming the number zero", async () => {
        const { transport } = transportWith(() => jsonResponse(200, '0'));
        const asText = await transport.get('/account/proxy/support/api/email', { expect: 'text' });
        assert.equal(asText.ok, true);
        assert.strictEqual(asText.data, '0');

        /* THE DEFAULT PATH IS UNCHANGED, and this is the half that shows why the option
         * had to exist: the ordinary read turns the same refusal into a number. */
        const asJson = await transport.get('/account/proxy/support/api/email');
        assert.strictEqual(asJson.data, 0);
    });

    test('a body that is not JSON at all is a success, not a DECODE failure', async () => {
        const { transport } = transportWith(() => jsonResponse(200, '[{"subject": ,"body":"hi"}]'));
        const asText = await transport.get('/account/proxy/support/api/emails', { expect: 'text' });
        assert.equal(asText.ok, true);
        assert.equal(asText.data, '[{"subject": ,"body":"hi"}]',
            'the caller repairs the one malformed shape it can cite; it cannot repair 200 characters');

        const asJson = await transport.get('/account/proxy/support/api/emails');
        assert.equal(asJson.kind, REA_ERROR.DECODE);
        assert.equal(asJson.problem.length <= 200, true, 'and the DECODE path keeps only a truncated copy');
    });

    test('a bodyless 200 read as text is the empty string, not null', async () => {
        const { transport } = transportWith(() => jsonResponse(200, undefined));
        const result = await transport.get('/account/proxy/support/api/emails', { expect: 'text' });
        assert.strictEqual(result.data, '');
    });

    /* IT IS NOT A FALLBACK PATH. A failed status is still the typed HTTP failure with
     * the problem body on it — reading as text changes what a SUCCESS carries and nothing
     * else. */
    test('a 403 is still a typed refusal, with the server’s own body', async () => {
        const { transport } = transportWith(() => jsonResponse(403, { error: 'Path not allowed' }));
        const result = await transport.get('/account/proxy/support/api/nope', { expect: 'text' });
        assert.equal(result.ok, false);
        assert.equal(result.kind, REA_ERROR.HTTP);
        assert.equal(result.status, 403);
        assert.deepEqual(result.problem, { error: 'Path not allowed' });
    });

    test('an unknown expect is refused at the call, where the mistake is', async () => {
        const { transport } = transportWith(() => jsonResponse(200, 'x'));
        await assert.rejects(
            () => transport.get('/settings', { expect: 'txt' }),
            /expect must be 'json' or 'text'/,
        );
    });
});

describe('If-None-Match', () => {
    test('a registered list route revalidates on the second read', async () => {
        const etag = '"deadbeefdeadbeef"';
        const { transport, fetchImpl } = transportWith((url, init, n) => (
            n === 1
                ? jsonResponse(200, [{ id: 'p1' }], { ETag: etag })
                : jsonResponse(304, undefined, { ETag: etag })
        ));

        const first = await transport.get('/profiles', { query: { includeHidden: true } });
        assert.equal(first.ok, true);
        assert.equal(first.notModified, false);
        assert.equal(fetchImpl.calls[0].headers['If-None-Match'], undefined);
        assert.equal(fetchImpl.calls[0].init.cache, 'no-store');

        const second = await transport.get('/profiles', { query: { includeHidden: true } });
        assert.equal(fetchImpl.calls[1].headers['If-None-Match'], etag);
        assert.equal(second.ok, true);
        assert.equal(second.notModified, true);
        assert.deepEqual(second.data, [{ id: 'p1' }]);
    });

    test('a non-conditional route is never revalidated, even after an ETag', async () => {
        const { transport, fetchImpl } = transportWith(() => jsonResponse(200, { id: 's1' }, { ETag: '"x"' }));
        await transport.get('/shots/s1');
        await transport.get('/shots/s1');
        assert.equal(fetchImpl.calls[1].headers['If-None-Match'], undefined);
        assert.equal(fetchImpl.calls[1].init.cache, undefined);
    });

    test('the ids= batch form is not conditional; a filtered list is', async () => {
        const { transport, fetchImpl } = transportWith(() => jsonResponse(200, [], { ETag: '"y"' }));
        await transport.get('/shots', { query: { ids: 'a,b' } });
        await transport.get('/shots', { query: { ids: 'a,b' } });
        assert.equal(fetchImpl.calls[1].headers['If-None-Match'], undefined);

        await transport.get('/shots', { query: { ids: 'a,b', search: 'ethiopia' } });
        await transport.get('/shots', { query: { ids: 'a,b', search: 'ethiopia' } });
        assert.equal(fetchImpl.calls[3].headers['If-None-Match'], '"y"');
    });

    test('never sends the wildcard', async () => {
        const store = createEtagStore();
        const { transport, fetchImpl } = transportWith(() => jsonResponse(200, [], { ETag: '"z"' }), { etagStore: store });
        await transport.get('/grinders');
        await transport.get('/grinders');
        assert.equal(fetchImpl.calls[1].headers['If-None-Match'], '"z"');
        assert.notEqual(fetchImpl.calls[1].headers['If-None-Match'], '*');
    });

    test('a 304 with nothing stored is an error, not a silent refetch', async () => {
        const { transport } = transportWith(() => jsonResponse(304, undefined, { ETag: '"q"' }));
        const result = await transport.get('/profiles', { conditional: true });
        assert.equal(result.ok, false);
        assert.equal(result.kind, REA_ERROR.CONDITIONAL);
        assert.equal(result.status, 304);
    });

    test('a successful write drops the whole revalidation store', async () => {
        const { transport } = transportWith((url, init) => (
            init.method === 'GET' ? jsonResponse(200, [1], { ETag: '"w"' }) : jsonResponse(201, { id: 'p' })
        ));
        await transport.get('/profiles');
        assert.equal(transport.etagStore.size, 1);
        await transport.post('/profiles', { profile: {} });
        assert.equal(transport.etagStore.size, 0);
    });

    test('a failed write leaves it alone', async () => {
        const { transport } = transportWith((url, init) => (
            init.method === 'GET' ? jsonResponse(200, [1], { ETag: '"w"' }) : jsonResponse(500, { error: 'boom' })
        ));
        await transport.get('/profiles');
        await transport.post('/profiles', { profile: {} });
        assert.equal(transport.etagStore.size, 1);
    });
});

describe('the data layer cannot reach a screen', () => {
    const DATA_DIR = fileURLToPath(new URL('../src/data/', import.meta.url));
    const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.js'));

    test('src/data has files to scan', () => {
        assert.ok(files.length >= 8, `expected the data layer to have modules, found ${files.length}`);
    });

    for (const file of files) {
        test(`${file} imports no UI and reads no ambient environment`, () => {
            const source = readFileSync(DATA_DIR + file, 'utf8');
            const imports = [...source.matchAll(/^\s*import[^;]*from\s+'([^']+)'/gm)].map((m) => m[1]);
            for (const specifier of imports) {
                assert.ok(
                    !/components|screens|stores|\bui\b/.test(specifier),
                    `${file} imports ${specifier}imported and imported twenty names back`,
                );
            }
            const code = source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
            for (const ambient of ['window.', 'document.', 'localStorage', 'globalThis.fetch']) {
                assert.ok(!code.includes(ambient), `${file} reads ${ambient} — inject it instead`);
            }
        });
    }
});

describe('a body that could not be read is a failure, not an empty body', () => {
    const hangsUpMidBody = (status = 200) => ({
        status,
        ok: status >= 200 && status < 300,
        headers: { get: () => null },
        text: async () => { throw new Error('socket hang up mid-body'); },
    });

    test('a 200 whose body read rejects is a NETWORK failure', async () => {
        const { transport } = transportWith(() => hangsUpMidBody(200));
        const result = await transport.get('/shots/2026-08-17T09%3A14%3A22Z');
        assert.equal(result.ok, false);
        assert.equal(result.kind, REA_ERROR.NETWORK);
        assert.match(result.message, /body could not be read/);
        assert.match(result.message, /socket hang up mid-body/);
    });

    test('and it is DISTINGUISHABLE from the bodyless 202 it used to look like', async () => {
        const { transport } = transportWith(() => jsonResponse(202, undefined));
        const ok = await transport.post('/machine/settings', { fan: 40 });
        assert.equal(ok.ok, true);
        assert.equal(ok.data, null);
        const { transport: broken } = transportWith(() => hangsUpMidBody(202));
        assert.equal((await broken.post('/machine/settings', { fan: 40 })).ok, false);
    });

    test('on a refusal, an unread body is not reported as "no problem body"', async () => {
        const { transport } = transportWith(() => hangsUpMidBody(409));
        const result = await transport.put('/devices/connect', { deviceId: 'x' });
        assert.equal(result.ok, false);
        assert.equal(result.kind, REA_ERROR.NETWORK);
        assert.equal(result.status, 409, 'the status survives; the body is what is missing');
    });
});

describe('the deadline covers the BODY, not just the headers', () => {
    test('a response that stalls after its headers times out', async () => {
        let abortSeen = null;
        const stalls = (url, init) => ({
            status: 200,
            ok: true,
            headers: { get: () => null },
            text: () => new Promise((_, reject) => {
                abortSeen = init.signal;
                init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
            }),
        });
        const { transport } = transportWith(stalls, { timeoutMs: 20 });
        const result = await transport.get('/shots/2026-08-17T09%3A14%3A22Z');
        assert.equal(result.ok, false);
        assert.equal(result.kind, REA_ERROR.TIMEOUT, 'the request deadline reached the body read');
        assert.match(result.message, /timed out after 20 ms/);
        assert.ok(abortSeen.aborted, 'and the abort actually reached the in-flight body');
    });

    test('a normal request still disarms its timer — no handle is left running', async () => {
        const { transport } = transportWith(() => jsonResponse(200, { fan: 40 }), { timeoutMs: 50 });
        const result = await transport.get('/machine/settings');
        assert.equal(result.ok, true);
    });
});

describe('onWrite — one announcement, at the one place every write passes through', () => {
    test('a successful non-GET is announced with its method and path', async () => {
        const { transport } = transportWith(() => jsonResponse(202, undefined));
        const seen = [];
        transport.onWrite((event) => seen.push(event));
        await transport.post('/machine/settings', { fan: 40 });
        await transport.put('/workflow', { rinseData: { flow: 4 } });
        await transport.get('/machine/settings');
        assert.deepEqual(seen.map((e) => `${e.method} ${e.path}`), ['POST /machine/settings', 'PUT /workflow']);
        assert.equal(seen[0].status, 202);
    });

    test('a FAILED write is not announced — it changed nothing on the machine', async () => {
        const { transport } = transportWith(() => jsonResponse(503, { error: 'Machine unavailable' }));
        const seen = [];
        transport.onWrite((e) => seen.push(e));
        await transport.put('/workflow', { rinseData: { flow: 4 } });
        assert.deepEqual(seen, []);
    });

    test('a listener that throws cannot take the request down with it', async () => {
        const warned = [];
        const { transport } = transportWith(() => jsonResponse(202, undefined), {
            logger: { warn: (m) => warned.push(m), debug: () => {} },
        });
        transport.onWrite(() => { throw new Error('boom'); });
        const result = await transport.post('/machine/settings', { fan: 40 });
        assert.equal(result.ok, true);
        assert.equal(warned.length, 1);
    });

    test('unsubscribing is honoured', async () => {
        const { transport } = transportWith(() => jsonResponse(202, undefined));
        const seen = [];
        const off = transport.onWrite((e) => seen.push(e));
        await transport.post('/machine/settings', { fan: 1 });
        off();
        await transport.post('/machine/settings', { fan: 2 });
        assert.equal(seen.length, 1);
        assert.throws(() => transport.onWrite(null), /a listener is required/);
    });
});

describe('a cached body is the SERVER\'s body, for ever', () => {
    test('a 304 replay cannot be edited by a previous caller', async () => {
        const etag = '"deadbeefdeadbeef"';
        let n = 0;
        const { transport } = transportWith(() => {
            n += 1;
            return n === 1
                ? jsonResponse(200, { items: [1, 2, 3] }, { ETag: etag })
                : jsonResponse(304, undefined, { ETag: etag });
        });
        const first = await transport.get('/beans');
        assert.deepEqual(first.data.items, [1, 2, 3]);
        assert.throws(() => first.data.items.push(99), TypeError, 'the stored body is frozen, so the edit is loud');
        const replay = await transport.get('/beans');
        assert.equal(replay.notModified, true);
        assert.deepEqual(replay.data, { items: [1, 2, 3] }, 'ReaPrime\'s body, not a locally-modified one');
    });
});
