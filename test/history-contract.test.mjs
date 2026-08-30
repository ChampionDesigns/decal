/**
 *.6, item hist-contract-check.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createShotsStore, MAX_PAGE_LIMIT, SHOT_ORDER } from '../src/stores/shots-store.js';
import { REST_ROUTES, REST_ROUTE_BY_ID } from '../src/data/rea-routes.generated.js';
import { isConditionalRoute, shotsListIsConditional, NON_CONDITIONAL_SHOT_READS } from '../src/data/rea-conditional.js';
import { createReaTransport } from '../src/data/rea-transport.js';
import { SHOT_RECORD_KEYS, SHOT_ANNOTATION_KEYS } from '../src/data/rea-shot-record.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const TABLE = JSON.parse(readFileSync(path.join(REPO, 'src/data/CONTRACTS.json'), 'utf8'));
const PIN = '2b047d02e42e29bf2d96a2aa964ef94e4a4daba3';
const PAGE = JSON.parse(readFileSync(
    path.join(REPO, 'tools/rea-fixtures/api__v1__shots~limit=20~offset=0~order=desc.json'), 'utf8'));
const RECORD = JSON.parse(readFileSync(
    path.join(REPO, 'tools/rea-fixtures/api__v1__shots__5fc3f631-6b18-471b-9800-00d552dbbecb.json'), 'utf8'));

const ROW = (id) => TABLE.rest.find((r) => r.id === id) ?? null;
const GENERATED = (id) => REST_ROUTE_BY_ID[id] ?? null;

const HISTORY_ROUTES = [
    {
        id: 'getShots', verb: 'GET', path: '/api/v1/shots',
        symbol: 'ShotsHandler._getShots', calls: true, conditional: true,
    },
    {
        id: 'getShotsById', verb: 'GET', path: '/api/v1/shots/{id}',
        symbol: 'ShotsHandler._getShot', calls: true, conditional: false,
    },
    {
        id: 'putShotsById', verb: 'PUT', path: '/api/v1/shots/{id}',
        symbol: 'ShotsHandler._updateShot', calls: true, conditional: false,
    },
    {
        id: 'getShotsLatest', verb: 'GET', path: '/api/v1/shots/latest',
        symbol: 'ShotsHandler._getLatestShot', calls: false, conditional: false,
    },
    {
        id: 'getShotsIds', verb: 'GET', path: '/api/v1/shots/ids',
        symbol: 'ShotsHandler._getIds', calls: false, conditional: false,
    },
];

/** Which generated route a recorded request corresponds to, matched on method + template. */
function routeIdFor({ path: reqPath, method }) {
    const bare = reqPath.split('?')[0];
    for (const route of REST_ROUTES) {
        if (route.method !== method) continue;
        const rx = new RegExp(`^${route.route.replace(/<[^>]+>/g, '[^/]+')}$`);
        if (rx.test(bare)) return route.id;
    }
    return null;
}

/** Every request the shots store makes when every action is exercised once. */
async function exerciseEveryAction() {
    const seen = [];
    const transport = {
        request: async (reqPath, options = {}) => {
            seen.push({
                path: reqPath,
                method: options.method ?? 'GET',
                query: options.query ?? null,
                body: options.body ?? null,
            });
            return {
                ok: true,
                status: 200,
                data: reqPath === '/shots' ? PAGE : RECORD,
                notModified: false,
            };
        },
    };
    const store = createShotsStore({ transport });
    await store.readPage();
    await store.readPage({ offset: 20 });
    await store.loadShot(RECORD.id);
    await store.loadShot(RECORD.id);            // cached: must not call again
    await Promise.all([store.loadShot('shot-second'), store.loadShot('shot-second')]);
    await store.setEnjoyment(RECORD.id, 72);
    await store.setEnjoyment(RECORD.id, null);  // clearing is a value, not an absence
    store.hasMore();
    store.derivationOf(RECORD.id);
    store.recordOf(RECORD.id);
    store.stop();
    return seen;
}

describe('History reaches three routes and every one has a row', () => {
    test('the recorded requests resolve to exactly the expected route ids', async () => {
        const seen = await exerciseEveryAction();
        const ids = [...new Set(seen.map(routeIdFor))];
        assert.ok(!ids.includes(null), `a request matched no generated route: ${JSON.stringify(seen)}`);
        assert.deepEqual(ids.sort(), ['getShots', 'getShotsById', 'putShotsById']);
    });

    test('nothing else is touched — and the two named absences stay absent', async () => {
        const seen = await exerciseEveryAction();
        const ids = new Set(seen.map(routeIdFor));
        for (const route of HISTORY_ROUTES.filter((r) => !r.calls)) {
            assert.ok(!ids.has(route.id),
                `${route.id} was called; the row records that History deliberately does not`);
        }
        assert.ok(!ids.has('deleteShotsById'), 'deletion is not this wave and has no row');
    });

    for (const route of HISTORY_ROUTES) {
        test(`${route.id} — row present, checked at the pin, agreeing with the generated table`, () => {
            const row = ROW(route.id);
            assert.ok(row, `${route.id} has no contract row`);
            assert.equal(row.verb, route.verb);
            assert.equal(row.path, route.path);
            assert.equal(row.handlerSymbol, route.symbol);
            assert.equal(row.handlerFile, 'lib/src/services/webserver/shots_handler.dart');
            assert.equal(row.checkedCommit, PIN);
            assert.ok(row.responseShape.length > 0);

            const generated = GENERATED(route.id);
            assert.ok(generated, `${route.id} is not in the generated table`);
            assert.equal(generated.method, route.verb);
            assert.equal(generated.path, route.path);
        });
    }

    test('the three it calls are `consumed` and name this store', () => {
        for (const route of HISTORY_ROUTES.filter((r) => r.calls)) {
            const row = ROW(route.id);
            assert.equal(row.status, 'consumed', `${route.id} is called and is not marked consumed`);
            assert.ok(row.consumedBy.some((c) => c.includes('shots-store.js')),
                `${route.id}: consumedBy does not name the shots store`);
        }
    });

    test('the two it does not call stay `declared` — a caller nearby is not a caller', () => {
        for (const route of HISTORY_ROUTES.filter((r) => !r.calls)) {
            assert.equal(ROW(route.id).status, 'declared');
        }
    });

    test('the body sent is the body the row declares', async () => {
        const seen = await exerciseEveryAction();
        for (const call of seen) {
            if (call.body === null) continue;
            const row = ROW(routeIdFor(call));
            const declared = Object.keys(row.requestFields.body ?? {});
            for (const key of Object.keys(call.body)) {
                assert.ok(declared.includes(key) || declared.includes(`$${key}`)
                    || declared.some((d) => d.startsWith(`${key}.`)),
                `${row.id}: sent "${key}", which the row does not declare (declared: ${declared.join(', ')})`);
            }
        }
    });
});

describe('the paginated list is the only conditional shots route', () => {
    test('the registry says so, and says it about each of the other three', () => {
        assert.equal(isConditionalRoute('/shots', { limit: 20, offset: 0, order: 'desc' }), true);
        assert.equal(isConditionalRoute('/shots/latest'), false);
        assert.equal(isConditionalRoute('/shots/ids'), false);
        assert.equal(isConditionalRoute('/shots/5fc3f631-6b18-471b-9800-00d552dbbecb'), false);
        // The ids= BATCH branch is plain jsonOk even though the base list is not.
        assert.equal(shotsListIsConditional({ ids: ['a', 'b'] }), false);
        assert.equal(shotsListIsConditional({ ids: ['a'], search: 'x' }), true,
            'with a filter the handler falls through to the paginated branch, which IS conditional');
        assert.deepEqual(NON_CONDITIONAL_SHOT_READS.map((r) => r.path).sort(),
            ['/shots/<id>', '/shots/ids', '/shots/latest', '/shots?ids='].sort());
    });

    test('the transport sends If-None-Match on the list and on nothing else', async () => {
        const sent = [];
        const fetchImpl = async (url, init) => {
            sent.push({ url, headers: init.headers ?? {} });
            const isList = url.includes('/shots?');
            return {
                status: 200,
                ok: true,
                headers: { get: (name) => (name.toLowerCase() === 'etag' && isList ? '"page-1"' : null) },
                text: async () => JSON.stringify(isList ? PAGE : RECORD),
            };
        };
        const transport = createReaTransport({ fetch: fetchImpl, baseUrl: 'http://127.0.0.1:1/api/v1' });
        const store = createShotsStore({ transport });

        await store.readPage();
        assert.equal(sent[0].headers['If-None-Match'], undefined, 'nothing is held yet');

        await store.readPage();
        assert.equal(sent[1].headers['If-None-Match'], '"page-1"',
            'the second read of the same page revalidates — the free win the count found');

        await store.loadShot(RECORD.id);
        const byId = sent.at(-1);
        assert.ok(byId.url.includes(`/shots/${RECORD.id}`));
        assert.equal(byId.headers['If-None-Match'], undefined,
            'GET /shots/<id> is plain jsonOk; a header there is inert, and sending it would '
            + 'claim a revalidation that never happens');
    });

    test('two callers asking for one shot at once cost ONE request', async () => {
        let calls = 0;
        const transport = {
            request: async () => {
                calls += 1;
                await new Promise((r) => setTimeout(r, 5));
                return { ok: true, kind: 'json', status: 200, data: RECORD };
            },
        };
        const store = createShotsStore({ transport });
        const [a, b] = await Promise.all([store.loadShot(RECORD.id), store.loadShot(RECORD.id)]);
        assert.equal(calls, 1, 'one request for one shot');
        assert.equal(a.record, b.record, 'and one record, not two parses of the same bytes');
        assert.equal(store.get().walks, 1, 'and ONE gate-6 walk');

        await store.loadShot(RECORD.id);
        assert.equal(calls, 1, 'and the memo still answers afterwards');
    });

    test('a 304 is a hit, is counted, and hands back the body we hold', async () => {
        let calls = 0;
        const fetchImpl = async () => {
            calls += 1;
            if (calls === 1) {
                return {
                    status: 200, ok: true,
                    headers: { get: (n) => (n.toLowerCase() === 'etag' ? '"page-1"' : null) },
                    text: async () => JSON.stringify(PAGE),
                };
            }
            return { status: 304, ok: false, headers: { get: () => null }, text: async () => '' };
        };
        const transport = createReaTransport({ fetch: fetchImpl, baseUrl: 'http://127.0.0.1:1/api/v1' });
        const store = createShotsStore({ transport });
        await store.readPage();
        await store.readPage();
        const state = store.get();
        assert.equal(state.reads.list, 2);
        assert.equal(state.reads.conditional, 1, 'the second read was a 304');
        assert.equal(state.rows.length, 20, 'a 304 still paints — the held body is the answer');
        assert.equal(state.status, 'ready');
    });
});

describe('the list handler\'s two silent behaviours are handled, not trusted', () => {
    test('the store clamps its own limit, because the handler clamps and lies in the echo', async () => {
        const seen = [];
        const transport = {
            request: async (reqPath, options = {}) => {
                seen.push(options.query);
                // The handler's own shape: 100 items served, `limit: 200` echoed (CB-23).
                return { ok: true, status: 200, data: { ...PAGE, limit: 200, total: 321 }, notModified: false };
            },
        };
        const store = createShotsStore({ transport });
        await store.readPage({ limit: 200 });
        assert.equal(seen[0].limit, MAX_PAGE_LIMIT, 'ask for at most 100');
        assert.equal(store.get().limit, MAX_PAGE_LIMIT,
            'what is published is what was asked after our own clamp — never the echo');
    });

    test('paging runs on total and items.length, never on the echoed limit', async () => {
        const transport = {
            request: async () => ({
                ok: true, status: 200, notModified: false,
                data: { ...PAGE, limit: 999, offset: 0, total: 321 },
            }),
        };
        const store = createShotsStore({ transport });
        await store.readPage();
        assert.equal(store.get().total, 321);
        assert.equal(store.hasMore(), true, '20 of 321');
    });

    test('an unknown order is refused here, because the paginated branch does not check it', async () => {
        const transport = { request: async () => ({ ok: true, status: 200, data: PAGE, notModified: false }) };
        const store = createShotsStore({ transport });
        await assert.rejects(() => store.readPage({ order: 'newest' }), /not one of asc, desc/);
        assert.equal(await store.readPage({ order: SHOT_ORDER.OLDEST_FIRST }).then(() => 'ok'), 'ok');
    });
});

describe('the enjoyment round-trip, as the handler is written', () => {
    test('the patch is the smallest thing that says what changed', async () => {
        const seen = await exerciseEveryAction();
        const put = seen.find((c) => c.method === 'PUT');
        assert.deepEqual(put.body, { annotations: { enjoyment: 72 } });
        assert.equal(put.path, `/shots/${RECORD.id}`);
        assert.equal(put.body.id, undefined,
            'the only 400 on this route is a body id that DISAGREES with the path; omitting it '
            + 'cannot disagree');
        assert.equal(put.body.measurements, undefined,
            'the merge base is the whole stored record, so the samples are never in the body');
    });

    test('null clears the rating and is a value, not an absence', async () => {
        const seen = await exerciseEveryAction();
        const clears = seen.filter((c) => c.method === 'PUT').at(-1);
        assert.deepEqual(clears.body, { annotations: { enjoyment: null } });
    });

    test('anything that is not a finite number or null is refused before it is sent', async () => {
        const transport = { request: async () => { throw new Error('must not be reached'); } };
        const store = createShotsStore({ transport });
        await assert.rejects(() => store.setEnjoyment('id', 'high'), /nullable double/);
        await assert.rejects(() => store.setEnjoyment('id', NaN), /nullable double/);
        await assert.rejects(() => store.setEnjoyment('id', undefined), /nullable double/);
        await assert.rejects(() => store.setEnjoyment('', 1), /needs a shot id/);
    });

    test('the row is updated from what was sent, never from the ~221 KB echo', async () => {
        let bodiesRead = 0;
        const transport = {
            request: async (reqPath, options = {}) => {
                if ((options.method ?? 'GET') === 'PUT') {
                    bodiesRead += 1;
                    // The handler's real success: the WHOLE updated record comes back.
                    return { ok: true, status: 200, notModified: false, data: { ...RECORD, annotations: { enjoyment: 72 } } };
                }
                return { ok: true, status: 200, data: PAGE, notModified: false };
            },
        };
        let walks = 0;
        const store = createShotsStore({ transport, derive: () => { walks += 1; return { ok: false }; } });
        await store.readPage();
        const before = store.get().rows.find((r) => r.id === RECORD.id);
        assert.equal(before.cells.enjoyment.text, '—');
        await store.setEnjoyment(RECORD.id, 72);
        const after = store.get().rows.find((r) => r.id === RECORD.id);
        assert.equal(after.cells.enjoyment.value, 72, 'the list row moves without a second read');
        assert.equal(bodiesRead, 1);
        assert.equal(walks, 0, 'annotations are not measurements — the echo is never re-walked');
        assert.equal(store.get().reads.list, 1, 'and the page is not re-read to learn our own number');
    });

    test('a refused write moves nothing', async () => {
        const transport = {
            request: async (reqPath, options = {}) => ((options.method ?? 'GET') === 'PUT'
                ? { ok: false, status: 500, message: 'PUT /shots/x -> 500', kind: 'http' }
                : { ok: true, status: 200, data: PAGE, notModified: false }),
        };
        const store = createShotsStore({ transport });
        await store.readPage();
        const result = await store.setEnjoyment(RECORD.id, 72);
        assert.equal(result.ok, false);
        assert.equal(store.get().rows.find((r) => r.id === RECORD.id).cells.enjoyment.present, false);
        assert.equal(store.get().reads.failed, 1);
    });
});

describe('the enjoyment round-trip against the mock', () => {
    let server = null;
    let base = null;

    test('start the mock', async () => {
        server = await startMock();
        base = server.base;
    });

    test('the list page is served from ReaPrime\'s own recording', async () => {
        const transport = createReaTransport({ fetch: (...a) => fetch(...a), baseUrl: `${base}/api/v1` });
        const store = createShotsStore({ transport });
        await store.readPage();
        const state = store.get();
        assert.equal(state.status, 'ready');
        assert.equal(state.rows.length, 20);
        assert.equal(state.total, 321);
        // Every row dashes, because no recorded shot carries a yield or a duration.
        assert.equal(state.rows.filter((r) => r.cells.duration.text === '—').length, 20);
        assert.equal(state.rows.filter((r) => r.cells.yield.text === '—').length, 20);
        assert.equal(state.reads.byId, 0, 'twenty rows painted and not one shot downloaded');
    });

    test('a picked shot is one fetch, one walk, and fills its three columns', async () => {
        const transport = createReaTransport({ fetch: (...a) => fetch(...a), baseUrl: `${base}/api/v1` });
        const store = createShotsStore({ transport });
        await store.readPage();
        const loaded = await store.loadShot(RECORD.id);
        assert.equal(loaded.ok, true);
        assert.equal(loaded.derivation.ok, true);
        assert.equal(store.get().walks, 1);
        const row = store.get().rows.find((r) => r.id === RECORD.id);
        assert.equal(row.cells.duration.present, true);
        assert.equal(row.cells.peakPressure.present, true);
        assert.equal(row.cells.averageFlow.present, true);
        // …and the yield stays a dash, because nothing recorded one. Absence is absence.
        assert.equal(row.cells.yield.text, '—');
    });

    test('the enjoyment PUT reaches the route, and the mock refuses to invent a ShotRecord', async () => {
        const transport = createReaTransport({ fetch: (...a) => fetch(...a), baseUrl: `${base}/api/v1` });
        const store = createShotsStore({ transport });
        const result = await store.setEnjoyment(RECORD.id, 72);
        assert.equal(result.ok, false, 'the mock cannot state this success body, and says so');
        const { failure } = result;
        assert.equal(failure.status, 501);
        assert.match(JSON.stringify(failure.problem), /no stateable response/,
            'a canned success here would teach the client a server that does not exist');
        assert.equal(failure.problem.verb, 'PUT');
        assert.equal(failure.problem.path, `/api/v1/shots/${RECORD.id}`);
    });

    test('a shot id is percent-encoded on the way out, as the handler\'s decode requires', async () => {
        const transport = createReaTransport({ fetch: (...a) => fetch(...a), baseUrl: `${base}/api/v1` });
        const store = createShotsStore({ transport });
        const result = await store.loadShot('not/a/real id');
        assert.equal(result.ok, false, 'the mock has no recording for it — which is the point');
        assert.match(result.failure.url, /not%2Fa%2Freal(%20|\+)id/,
            'an unencoded id would address three path segments and reach another route');
        assert.equal(result.failure.status, 503,
            'a miss is 503 — 404 is ReaPrime\'s feature-absent signal and an instrument must '
            + 'never manufacture it');
    });

    test('stop the mock', () => {
        if (server) server.stop();
    });
});

describe('the R5 absence is a finding, not a stub', () => {
    test('the ShotRecord keys are the six the serializer emits, and none is a metric', () => {
        assert.deepEqual([...SHOT_RECORD_KEYS],
            ['id', 'timestamp', 'measurements', 'workflow', 'annotations', 'stopReason']);
        for (const forbidden of ['duration', 'durationSeconds', 'peakPressure', 'averageFlow']) {
            assert.ok(!SHOT_RECORD_KEYS.includes(forbidden));
            assert.ok(!SHOT_ANNOTATION_KEYS.includes(forbidden),
                `${forbidden} would make R5 already landed; re-read shot_annotations.dart`);
        }
    });

    test('the list payload confirms it at the fixture as well as at the schema', () => {
        const keys = new Set(PAGE.items.flatMap((i) => Object.keys(i)));
        assert.ok(!keys.has('measurements'), 'items are toJsonWithoutMeasurements');
        assert.ok(!keys.has('duration'));
        assert.ok([...keys].every((k) => ['annotations', 'id', 'metadata', 'shotNotes',
            'stopReason', 'timestamp', 'workflow'].includes(k)),
        `unexpected list key: ${[...keys].join(', ')}`);
    });

    test('the absence is recorded in the table with its basis and its policy', () => {
        const r5 = TABLE.absentRoutes.find((e) => e.wanted.startsWith('R5'));
        assert.ok(r5, 'R5 has no absentRoutes entry — a stub would have been the alternative');
        assert.equal(r5.servedAt, null);
        assert.equal(r5.checkedCommit, PIN);
        assert.match(r5.basis, /shot_record\.dart:49-59/);
        assert.match(r5.policy, /NO STUB, NO SENTINEL, NO FETCH/);
        assert.match(r5.interim, /dash/i);
    });

    test('the yield correction is on the row, because the scoping note had it too broad', () => {
        const row = ROW('getShots');
        assert.ok(row.notes.some((n) => n.includes('actualYield')),
            'the list DOES carry annotations.actualYield when the shot has one; the R5 gap is '
            + 'duration, peak pressure and average flow');
    });
});

/** Launch tools/mock_rea.py on an ephemeral port and wait for it to report one. */
async function startMock() {
    const { spawn } = await import('node:child_process');
    const child = spawn('python3', ['-u', 'tools/mock_rea.py', '--port', '0'], { cwd: REPO });
    const port = await new Promise((resolve, reject) => {
        let buffer = '';
        const timer = setTimeout(() => reject(new Error(`mock did not start:\n${buffer}`)), 20000);
        const onData = (chunk) => {
            buffer += chunk.toString();
            const match = buffer.match(/mock ReaPrime on 127\.0\.0\.1:(\d+)/);
            if (match) {
                clearTimeout(timer);
                resolve(Number(match[1]));
            }
        };
        child.stdout.on('data', onData);
        child.stderr.on('data', onData);
        child.on('error', reject);
        child.on('exit', (code) => reject(new Error(`mock exited ${code}:\n${buffer}`)));
    });
    return { base: `http://127.0.0.1:${port}`, stop: () => child.kill('SIGKILL') };
}
