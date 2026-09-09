
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
    REST_ROUTES,
    REST_ROUTE_BY_ID,
    SOCKET_CHANNELS,
    REA_ROUTE_EXCEPTIONS,
    REA_ROUTES_SOURCE,
    HELPER_DEMAND,
    RETIRED_HELPERS,
    ReaRouteError,
    routeById,
    routeFor,
    findRoute,
    isDocumentedRoute,
    channelFor,
    buildPath,
    buildQuery,
    callRoute,
    socketUrl,
    createReaRoutes,
    pathMatchesTemplate,
} from '../src/data/rea-routes.js';
import { CONDITIONAL_ROUTES } from '../src/data/rea-conditional.js';
import { reaPath } from '../src/data/rea-transport.js';
import { MACHINE_STATES } from '../src/data/machine-state.generated.js';
import { REA_ROOT, PINNED_COMMIT } from '../scripts/lib/rea-source.js';
import { parseYaml } from '../scripts/lib/yaml-subset.js';
import { REST_REL, WS_REL } from '../scripts/generate-rea-routes.js';

const WEBSERVER = 'lib/src/services/webserver';

const read = (rel) => {
    const path = join(REA_ROOT, rel);
    assert.ok(existsSync(path), `ReaPrime source missing: ${path} (set REA_ROOT)`);
    return readFileSync(path, 'utf8');
};

const handler = (name) => read(`${WEBSERVER}/${name}`);

const walkDart = (dir) => readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walkDart(join(dir, e.name)) : (e.name.endsWith('.dart') ? [join(dir, e.name)] : [])));

/** Every `app.<verb>('/api/v1/…')` registration in ReaPrime, as `METHOD path`. */
const registrations = (() => {
    const text = walkDart(join(REA_ROOT, 'lib/src')).map((f) => readFileSync(f, 'utf8')).join('\n');
    const exact = new Set();
    const wildcards = new Set();
    for (const m of text.matchAll(/app\.(get|put|post|delete|all|head|patch)\(\s*['"]((?:\/(?:api|ws)\/v1)[^'"]*)['"]/g)) {
        const [, verb, path] = m;
        if (verb === 'all') for (const v of ['GET', 'PUT', 'POST', 'DELETE']) exact.add(`${v} ${path}`);
        else exact.add(`${verb.toUpperCase()} ${path}`);
        if (/<[^>]*\|/.test(path) || /<command>/.test(path)) wildcards.add(`${verb.toUpperCase()} ${path}`);
    }
    return { exact, wildcards };
})();

describe('the four exceptions, justified at the handler', () => {
    test('there are exactly four, each with handler evidence and an upstream ask', () => {
        assert.equal(REA_ROUTE_EXCEPTIONS.length, 4);
        assert.deepEqual(REA_ROUTE_EXCEPTIONS.map((e) => e.id), [
            'shots-orderBy-not-read',
            'plugins-passthrough-any-method',
            'sensors-list-key-is-id',
            'account-proxy-query-passthrough',
        ]);
        for (const e of REA_ROUTE_EXCEPTIONS) {
            assert.ok(e.handlerFile && e.handlerSymbol && e.handlerEvidence && e.why && e.upstreamAsk, e.id);
            assert.ok(existsSync(join(REA_ROOT, e.handlerFile)), `${e.id}: ${e.handlerFile}`);
        }
    });

    describe('1 — orderBy is documented and never read', () => {
        test('the handler reads `order` and no handler mentions `orderBy`', () => {
            const shots = handler('shots_handler.dart');
            assert.match(shots, /final order = params\['order'\]/);
            assert.match(shots, /params\['order'\] \?\? 'desc'/);
            const all = readdirSync(join(REA_ROOT, WEBSERVER))
                .filter((f) => f.endsWith('.dart'))
                .map((f) => handler(f))
                .join('\n');
            assert.ok(!all.includes('orderBy'), 'no handler reads orderBy');
        });

        test('the spec still documents it — which is why the exception exists', () => {
            const spec = parseYaml(read(REST_REL), { file: REST_REL });
            const names = spec.paths['/api/v1/shots'].get.parameters.map((p) => p.name);
            assert.ok(names.includes('orderBy'), 'the upstream defect is still present');
            assert.ok(names.includes('order'));
        });

        test('the table emits order and not orderBy', () => {
            const shots = routeById('getShots');
            const names = shots.query.map((q) => q.name);
            assert.ok(!names.includes('orderBy'));
            const order = shots.query.find((q) => q.name === 'order');
            assert.deepEqual(order.enum, ['asc', 'desc']);
            assert.equal(order.default, 'desc');
            assert.equal(shots.exception, 'shots-orderBy-not-read');
        });

        test('no route anywhere in the table emits an orderBy parameter', () => {
            for (const r of REST_ROUTES) {
                assert.ok(!r.query.some((q) => q.name === 'orderBy'), `${r.id} emits orderBy`);
            }
        });
    });

    describe('2 — the plugin passthrough is app.all, not GET-only', () => {
        test('the handler registers app.all and dispatches on req.method', () => {
            const plugins = handler('plugins_handler.dart');
            assert.match(plugins, /app\.all\('\/api\/v1\/plugins\/<id>\/<endpoint>'/);
            assert.match(plugins, /final method = req\.method;/);
            assert.match(plugins, /'method': method,/);
        });

        test('the spec still documents GET only — which is why the exception exists', () => {
            const spec = parseYaml(read(REST_REL), { file: REST_REL });
            assert.deepEqual(Object.keys(spec.paths['/api/v1/plugins/{id}/{endpoint}']), ['get']);
        });

        test('the table carries GET and POST, both marked as an any-method passthrough', () => {
            const get = routeById('getPluginsByIdByEndpoint');
            const post = routeById('postPluginsByIdByEndpoint');
            assert.equal(post.route, '/plugins/<id>/<endpoint>');
            assert.deepEqual(post.pathParams, ['id', 'endpoint']);
            for (const r of [get, post]) {
                assert.equal(r.anyMethod, true);
                assert.equal(r.exception, 'plugins-passthrough-any-method');
                assert.equal(r.json, false);
            }
        });

        test('PUT and DELETE are deliberately not emitted, though the handler would take them', () => {
            assert.equal(REST_ROUTE_BY_ID.putPluginsByIdByEndpoint, undefined);
            assert.equal(REST_ROUTE_BY_ID.deletePluginsByIdByEndpoint, undefined);
            assert.ok(registrations.exact.has('PUT /api/v1/plugins/<id>/<endpoint>'), 'app.all covers PUT upstream');
        });
    });

    describe('3 — the sensors list is keyed by id, not name', () => {
        test('the handler emits id', () => {
            const sensors = handler('sensors_handler.dart');
            assert.match(sensors, /'id': s\.deviceId/);
            assert.match(sensors, /'info': info\.toJson\(\)/);
        });

        test('the spec still documents name — which is why the exception exists', () => {
            const spec = parseYaml(read(REST_REL), { file: REST_REL });
            const props = spec.paths['/api/v1/sensors'].get.responses['200']
                .content['application/json'].schema.items.properties;
            assert.ok(props.name, 'the upstream defect is still present');
            assert.equal(props.id, undefined);
        });

        test('the table describes the served shape', () => {
            const sensors = routeById('getSensors');
            assert.deepEqual(sensors.successSchema.items.keys, ['id', 'info']);
            assert.equal(sensors.exception, 'sensors-list-key-is-id');
        });
    });

    describe('4 — the account proxy forwards a query string the spec does not declare', () => {
        test('the handler forwards the raw query and the service puts it on the upstream URI', () => {
            const proxyHandler = handler('account_proxy_handler.dart');
            assert.match(proxyHandler, /rawQuery: request\.requestedUri\.query/,
                'the handler must take the query off the request wholesale, not by name');
            const service = read('lib/src/services/account/decent_proxy_service.dart');
            assert.match(service, /final query = rawQuery == null \|\| rawQuery\.isEmpty \? null : rawQuery;/);
            assert.match(service, /query: query,/, 'and put it on the outbound URI untouched');
        });

        test('subject and body are the names ReaPrime itself sends to that upstream endpoint', () => {
            const account = read('lib/src/services/account/decent_account_service.dart');
            /* The evidence moved at the 42f67f69 re-pin, the names did not: emailSerialMismatch no
             * longer builds the URL itself, it calls the new sendSupportMessage, which builds the
             * query from the same two names and GETs the same /support/api/email. */
            assert.match(account, /Future<void> emailSerialMismatch\(String serial\) async \{\s*\n\s*await sendSupportMessage\(/,
                'emailSerialMismatch is still the in-tree caller');
            assert.match(account, /queryParameters: \{'subject': subject, 'body': body\},/,
                'and sendSupportMessage is the in-tree evidence for both names');
            assert.match(account, /'\/support\/api\/email\?\$query'/,
                'on the same /support/api/email endpoint the proxy relays');
            const all = walkDart(join(REA_ROOT, 'lib/src'))
                .map((f) => readFileSync(f, 'utf8')).join('\n');
            assert.ok(!/support\/api\/emails/.test(all),
                'no ReaPrime source names the emails endpoint or its `since` parameter — that is Slate-only evidence, '
                + 'and it is why neither reaches this table');
        });

        /* THE SKIN TOKEN IS READ-ONLY, which is what makes a GET with a query the only
         * shape available. If this ever stops being true the exception should be re-argued,
         * not merely kept. */
        test('the injected skin token is scoped for reads only, so POST is not an option', () => {
            const tokens = read('lib/src/services/account/proxy_token_service.dart');
            assert.match(tokens, /id: 'skin',\s*\n\s*scopes: \{scopeAccountProxy\},/,
                'the skin caller is registered with the read scope alone');
            /* At the 42f67f69 re-pin the fixed token became a per-skin minted one: main.dart sets
             * skinProxyTokenProvider, which rotates a token for the requesting skin. The scope it
             * mints with is still the read scope alone, and webui_service.dart still injects the
             * result as skinProxyToken into every served page. */
            const main = read('lib/main.dart');
            assert.match(main, /webUIService\.skinProxyTokenProvider = \(path\) \{/,
                'the served skin page takes its token from this provider');
            assert.match(main, /rotateSkinToken\(\s*\n\s*ProxyCaller\(\s*\n\s*id: skin\.key,\s*\n\s*scopes: const \{ProxyTokenService\.scopeAccountProxy\},/,
                'and the provider mints it with the read scope alone');
            assert.ok(!main.includes('scopeAccountProxyWrite'),
                'nothing in main hands a skin the write scope');
            assert.match(read('lib/src/webui_support/webui_service.dart'),
                /if \(tokenProvider != null\) skinProxyToken = tokenProvider\(path\);/,
                'and that is the token injected into every served skin page');
            const middleware = read('lib/src/services/webserver/proxy_auth_middleware.dart');
            assert.match(middleware, /case 'POST':/);
            assert.match(middleware, /return ProxyTokenService\.scopeAccountProxyWrite;/,
                'and a POST through the proxy demands the write scope');
        });

        test('the spec still documents no query parameter — which is why the exception exists', () => {
            const spec = parseYaml(read(REST_REL), { file: REST_REL });
            const op = spec.paths['/api/v1/account/proxy/support/api/{endpoint}'].get;
            const query = (op.parameters || []).filter((p) => p.in === 'query');
            assert.deepEqual(query, [], 'the upstream gap is still present');
        });

        test('the table emits subject and body on the GET row, and on that row only', () => {
            const get = routeById('getAccountProxySupportApiByEndpoint');
            assert.deepEqual(get.query.map((q) => q.name), ['subject', 'body']);
            assert.ok(get.query.every((q) => q.required === false),
                'neither is required — the same relay answers `sn` with no query at all');
            assert.equal(get.exception, 'account-proxy-query-passthrough');

            for (const id of ['postAccountProxySupportApiByEndpoint', 'putAccountProxySupportApiByEndpoint']) {
                assert.deepEqual(REST_ROUTE_BY_ID[id].query, [], `${id} must stay as the spec has it`);
                assert.equal(REST_ROUTE_BY_ID[id].exception, null);
            }
        });
    });
});

describe('the spec is not the authority — pinned divergences that do NOT reach the table', () => {
    test('neither spec knows schedIdle, and they disagree with each other', () => {
        const rest = parseYaml(read(REST_REL), { file: REST_REL });
        const ws = parseYaml(read(WS_REL), { file: WS_REL });
        const restStates = rest.components.schemas.MachineState.enum;
        const wsStates = ws.components.schemas.MachineState.enum;

        assert.ok(!restStates.includes('schedIdle'));
        assert.ok(!wsStates.includes('schedIdle'));
        assert.ok(MACHINE_STATES.includes('schedIdle'), 'machine.dart, the authority, has it');
        assert.notDeepEqual(restStates, wsStates, 'the two specs list different states');
        assert.ok(restStates.includes('steamRinse') && !wsStates.includes('steamRinse'));
        assert.ok(wsStates.includes('transportMode') && !restStates.includes('transportMode'));
    });

    test('no route in the table carries a machine-state list', () => {
        for (const r of REST_ROUTES) {
            for (const q of r.query) {
                if (!q.enum) continue;
                assert.ok(!q.enum.includes('espresso'), `${r.id}.${q.name} carries a state list`);
            }
        }
    });
});

describe('the table agrees with ReaPrime elsewhere in the tree', () => {
    test('the conditional routes derived from the spec are the ones derived from the handlers', () => {
        const fromSpec = REST_ROUTES.filter((r) => r.conditional).map((r) => r.route).sort();
        const fromHandlers = CONDITIONAL_ROUTES.map((r) => r.path).sort();
        assert.deepEqual(fromSpec, fromHandlers);
        // 6 -> 7 at the 42f67f69 re-pin: BeansHandler._getAllBatches serves
        // GET /api/v1/bean-batches with jsonOkConditional, and rest_v1.yml documents its 304.
        assert.equal(fromSpec.length, 7);
    });

    test('every conditional route also documents the ETag response header', () => {
        for (const r of REST_ROUTES.filter((x) => x.conditional)) {
            assert.equal(r.etagHeader, true, `${r.id} documents 304 without an ETag header`);
        }
    });

    test('the shots reads that are NOT conditional stay that way', () => {
        for (const id of ['getShotsById', 'getShotsLatest', 'getShotsIds']) {
            assert.equal(routeById(id).conditional, false, id);
        }
    });

    test('every socket channel in the table is registered in the Dart', () => {
        for (const c of SOCKET_CHANNELS) {
            assert.ok(registrations.exact.has(`GET ${c.route}`), `${c.route} is documented but not registered`);
        }
    });

    test('the bidirectional channels are the ones B8 and the display policy rely on', () => {
        const both = SOCKET_CHANNELS.filter((c) => c.bidirectional).map((c) => c.id).sort();
        assert.deepEqual(both, ['Devices', 'Display', 'MachineRaw', 'Update']);
        const devices = SOCKET_CHANNELS.find((c) => c.id === 'Devices');
        assert.deepEqual(devices.receives, ['DevicesState', 'DeviceConnectResult']);
        assert.deepEqual(devices.sends, ['DevicesCommand']);
    });

    test('the documented rows with no exact registration are the known wildcard handlers', () => {
        const unregistered = REST_ROUTES
            .map((r) => `${r.method} /api/v1${r.route}`)
            .filter((key) => !registrations.exact.has(key))
            .sort();
        assert.deepEqual(unregistered, [
            'GET /api/v1/account/proxy/support/api/<endpoint>',
            'GET /api/v1/webui/skin-assets/<id>/<filepath>',
            'POST /api/v1/account/proxy/support/api/<endpoint>',
            'PUT /api/v1/account/proxy/support/api/<endpoint>',
            'PUT /api/v1/scale/tare',
            'PUT /api/v1/scale/timer/reset',
            'PUT /api/v1/scale/timer/start',
            'PUT /api/v1/scale/timer/stop',
        ]);
        assert.ok(registrations.wildcards.has('PUT /api/v1/scale/<command>'));
        assert.ok(registrations.wildcards.has('PUT /api/v1/scale/timer/<command>'));
    });
});

describe('the demand surface — every helper names its consumer', () => {
    const client = createReaRoutes({ request: async () => ({ ok: true }) });

    test('the exported helpers and HELPER_DEMAND are the same set', () => {
        assert.deepEqual(Object.keys(client).sort(), HELPER_DEMAND.map((d) => d.helper).sort());
    });

    test('every helper points at a real row and names the item that asked for it', () => {
        for (const d of HELPER_DEMAND) {
            assert.ok(REST_ROUTE_BY_ID[d.routeId], `${d.helper} -> ${d.routeId}`);
            assert.match(d.wantedBy, /gate[234]-/);
        }
    });

    test('EVERY HELPER HAS A LIVE CONSUMER — the guard the demand rule was missing', () => {
        const root = join(import.meta.dirname, '..');
        for (const d of HELPER_DEMAND) {
            assert.ok(d.consumer, `${d.helper}: a demand row must name its consumer file`);
            const path = join(root, d.consumer);
            assert.ok(existsSync(path), `${d.helper}: ${d.consumer} does not exist`);
            const source = readFileSync(path, 'utf8');
            assert.match(
                source,
                new RegExp(`\\.${d.helper}\\s*\\(`),
                `${d.helper}: ${d.consumer} never calls it — "a wrapper with no caller is not ready"`,
            );
        }
    });

    test('a retired helper is not quietly still exported', () => {
        for (const r of RETIRED_HELPERS) {
            assert.equal(client[r.helper], undefined, `${r.helper} came back without a consumer`);
            assert.ok(REST_ROUTE_BY_ID[r.id], `${r.helper} -> ${r.id} is still a real row`);
        }
    });

    test('the helper surface is a small fraction of the table — that is the point', () => {
        assert.equal(HELPER_DEMAND.length, 5);
        assert.equal(RETIRED_HELPERS.length, 5);
        assert.ok(REST_ROUTES.length > 100);
    });

    test('every demand-set route is registered in the Dart at the pinned commit', () => {
        for (const d of HELPER_DEMAND) {
            const r = routeById(d.routeId);
            assert.ok(
                registrations.exact.has(`${r.method} /api/v1${r.route}`),
                `${d.helper}: ${r.method} /api/v1${r.route} is not registered`,
            );
        }
    });

    test('the demand-set response shapes are the ones the handlers build', () => {
        const de1 = handler('de1handler.dart');
        assert.match(de1, /jsonOk\(\{'capabilities': caps\}\)/);
        assert.deepEqual(routeById('getMachineCapabilities').successSchema.keys, ['capabilities']);
        for (const cap of ['cupWarmer', 'integratedScale', 'stopAtWeight', 'ledStrip', 'scaleCalibration', 'preheat', 'wakeSchedule']) {
            assert.ok(de1.includes(`'${cap}'`), `capability ${cap}`);
        }
        assert.deepEqual(routeById('getMachineCupWarmer').successSchema.keys,
            ['temperature', 'enabled', 'currentTemperature']);
        assert.match(de1, /'currentTemperature': await bengle\.getCupWarmerCurrentTemperature\(\)/);

        const shots = handler('shots_handler.dart');
        assert.deepEqual(routeById('getShots').successSchema.keys, ['items', 'total', 'limit', 'offset']);
        assert.match(shots, /limit: limit\.clamp\(1, 100\)/);
        assert.match(shots, /'limit': limit,/);
        // /shots/latest answers 200 with a body of null when nothing is stored.
        assert.match(shots, /jsonOk\(shot\?\.toJsonWithoutMeasurements\(\)\)/);

        const devices = handler('devices_handler.dart');
        assert.match(devices, /app\.put\('\/api\/v1\/devices\/connect', _handleConnect\)/);
        assert.deepEqual(routeById('putDevicesConnect').body.schema.requiredKeys, ['deviceId']);
    });
});

describe('spelling', () => {
    test('buildPath encodes exactly as the transport tag does', () => {
        const id = '2026-08-17T09:14:22Z';
        assert.equal(buildPath(routeById('getShotsById'), { id }), reaPath`/shots/${id}`);
        const weird = 'a/b#c d';
        assert.equal(buildPath(routeById('getShotsById'), { id: weird }), reaPath`/shots/${weird}`);
    });

    test('a missing or unknown path parameter throws', () => {
        assert.throws(() => buildPath(routeById('getShotsById'), {}), ReaRouteError);
        assert.throws(() => buildPath(routeById('getShotsById'), { id: '' }), ReaRouteError);
        assert.throws(() => buildPath(routeById('getShotsById'), { id: 'x', extra: 1 }), /unknown path parameter/);
    });

    test('an undocumented query key throws, and the dead one names its exception', () => {
        const shots = routeById('getShots');
        assert.deepEqual(buildQuery(shots, { limit: 20, order: 'asc' }), { limit: 20, order: 'asc' });
        assert.equal(buildQuery(shots, null), null);
        assert.throws(() => buildQuery(shots, { orderBy: 'timestamp' }), /shots-orderBy-not-read/);
        assert.throws(() => buildQuery(shots, { nope: 1 }), /not a documented query parameter/);
    });

    test('templates match concrete paths in either spelling', () => {
        assert.ok(pathMatchesTemplate('/shots/<id>', '/shots/abc'));
        assert.ok(pathMatchesTemplate('/api/v1/shots/{id}', '/api/v1/shots/abc'));
        assert.ok(!pathMatchesTemplate('/shots/<id>', '/shots'));
        assert.ok(!pathMatchesTemplate('/shots/<id>', '/shots/a/b'));
    });
});

describe('lookup is the Gate D coverage primitive', () => {
    test('a documented route resolves, with or without the prefix', () => {
        assert.equal(findRoute('GET', '/shots/2026-08-17').id, 'getShotsById');
        assert.equal(findRoute('get', '/api/v1/shots/2026-08-17').id, 'getShotsById');
        assert.equal(routeFor('GET', '/machine/capabilities').id, 'getMachineCapabilities');
        assert.ok(isDocumentedRoute('PUT', '/devices/connect'));
    });

    test('a route ReaPrime has never served does not resolve', () => {
        assert.equal(findRoute('POST', '/machine/scale/calibrate'), null);
        assert.equal(isDocumentedRoute('POST', '/machine/scale/calibrate'), false);
        assert.ok(isDocumentedRoute('PUT', '/machine/scaleCalibration'));
        assert.throws(() => routeById('postMachineScaleCalibrate'), /never existed/);
    });

    test('the wrong verb on a real path does not resolve', () => {
        assert.equal(findRoute('POST', '/shots/abc'), null);
        assert.throws(() => routeFor('POST', '/shots/<id>'), ReaRouteError);
    });

    test('an unknown socket channel throws', () => {
        assert.equal(channelFor('/ws/v1/machine/snapshot').id, 'MachineSnapshot');
        assert.throws(() => channelFor('/ws/v1/nope'), ReaRouteError);
    });
});

describe('calling, through an injected transport and nothing else', () => {
    const spy = () => {
        const calls = [];
        const transport = {
            request: async (path, options) => { calls.push({ path, options }); return { ok: true, status: 200, data: null }; },
            socketUrl: (path) => `ws://tablet:8080${path}`,
        };
        return { calls, transport };
    };

    test('callRoute spells the request from the table', async () => {
        const { calls, transport } = spy();
        await callRoute(transport, 'getShots', { query: { limit: 5 } });
        assert.equal(calls[0].path, '/shots');
        assert.equal(calls[0].options.method, 'GET');
        assert.deepEqual(calls[0].options.query, { limit: 5 });
    });

    test('a body goes through untouched, and a GET may not carry one', async () => {
        const { calls, transport } = spy();
        await callRoute(transport, 'putMachineCupWarmer', { body: { temperature: 60 } });
        assert.equal(calls[0].options.method, 'PUT');
        assert.deepEqual(calls[0].options.body, { temperature: 60 });
        await assert.rejects(
            async () => callRoute(transport, 'getShots', { body: { x: 1 } }),
            /GET takes no request body/,
        );
    });

    test('the helpers hit the routes their demand rows name', async () => {
        const { calls, transport } = spy();
        const rea = createReaRoutes(transport);
        await rea.capabilities();
        await rea.cupWarmer();
        await rea.setCupWarmer({ enabled: true });
        await rea.cupWarmerPreheat();
        await rea.setCupWarmerPreheat({ enabled: false });

        assert.deepEqual(calls.map((c) => `${c.options.method} ${c.path}`), [
            'GET /machine/capabilities',
            'GET /machine/cupWarmer',
            'PUT /machine/cupWarmer',
            'GET /machine/cupWarmer/preheat',
            'PUT /machine/cupWarmer/preheat',
        ]);
        assert.deepEqual(calls[2].options.body, { enabled: true });
    });

    test('the retired helpers are reachable by id, which is why deleting them cost nothing', async () => {
        const { calls, transport } = spy();
        for (const retired of RETIRED_HELPERS) {
            const options = {};
            if (routeById(retired.id).pathParams.length) options.params = { id: '2026-08-17T09:14:22Z' };
            if (routeById(retired.id).method !== 'GET') options.body = { deviceId: 'BLE:aa:bb' };
            await callRoute(transport, retired.id, options);
        }
        assert.deepEqual(calls.map((c) => `${c.options.method} ${c.path}`), [
            'GET /sensors',
            'PUT /devices/connect',
            'GET /shots',
            'GET /shots/latest',
            'GET /shots/2026-08-17T09%3A14%3A22Z',
        ]);
    });

    test('the result is returned verbatim — no unwrapping, no default', async () => {
        const failure = { ok: false, kind: 'network', message: 'boom' };
        const rea = createReaRoutes({ request: async () => failure });
        assert.equal(await rea.capabilities(), failure);
    });

    test('a transport is required — there is no ambient one', () => {
        assert.throws(() => createReaRoutes(), ReaRouteError);
        assert.throws(() => createReaRoutes({}), ReaRouteError);
        assert.throws(() => callRoute(null, 'getShots'), ReaRouteError);
    });

    test('socket URLs come from the channel table, with encoding', () => {
        const { transport } = spy();
        assert.equal(socketUrl(transport, '/ws/v1/machine/snapshot'), 'ws://tablet:8080/ws/v1/machine/snapshot');
        assert.equal(
            socketUrl(transport, '/ws/v1/sensors/<id>/snapshot', { id: 'sensor:acme:001' }),
            'ws://tablet:8080/ws/v1/sensors/sensor%3Aacme%3A001/snapshot',
        );
        assert.throws(() => socketUrl(transport, '/ws/v1/sensors/<id>/snapshot', {}), /is required/);
    });
});

describe('A7 — the module has no fallback path to port', () => {
    const source = readFileSync(new URL('../src/data/rea-routes.js', import.meta.url), 'utf8');
    const code = source.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

    test('no catch block, no nullish default, no manufactured answer', () => {
        assert.ok(!/\bcatch\b/.test(code), 'a caught error here would become a value');
        assert.ok(!/\?\?/.test(code), 'a ?? default is how an absence stops being visible');
        assert.ok(!/\|\|\s*(\{\}|\[\])/.test(code), 'no empty-object or empty-array stand-in');
    });

    test('no ambient state and no UI', () => {
        for (const forbidden of ['window.', 'document.', 'localStorage', 'globalThis.fetch']) {
            assert.ok(!code.includes(forbidden), `rea-routes.js reads ${forbidden}`);
        }
        assert.ok(!/from '\.\.\/(components|screens|stores)\//.test(source));
    });

    test('the generated table is data only — it defines no request machinery', () => {
        const artifact = readFileSync(new URL('../src/data/rea-routes.generated.js', import.meta.url), 'utf8');
        for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket(', 'localStorage', 'window.']) {
            assert.ok(!artifact.includes(forbidden), `the generated table contains ${forbidden}`);
        }
        assert.equal(REA_ROUTES_SOURCE.commit, PINNED_COMMIT);
    });
});
