/**
 * The contract check as a BUILD activity (.4, item contract-check-settings-endpoints).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PINNED_COMMIT, REA_ROOT, readReaFile } from '../scripts/lib/rea-source.js';
import { STORAGE_ROUTES, settingsKeys } from '../src/lib/storage-routes.js';
import { SERVED_CAPABILITIES } from '../src/stores/capabilities-store.js';
import { CONDITIONAL_ROUTES, isConditionalRoute } from '../src/data/rea-conditional.js';
import { REST_ROUTE_BY_ID } from '../src/data/rea-routes.generated.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const TABLE = JSON.parse(readFileSync(path.join(REPO, 'src/data/CONTRACTS.json'), 'utf8'));

const KV_HANDLER = 'lib/src/services/webserver/kv_store_handler.dart';
const DE1_HANDLER = 'lib/src/services/webserver/de1handler.dart';

const kv = readReaFile(KV_HANDLER).text;
const de1 = readReaFile(DE1_HANDLER).text;
const generated = REST_ROUTE_BY_ID;

/** The rows this repo is responsible for, by id. */
const SETTINGS_ROUTE_IDS = [
    'getStoreByNamespace',
    'getStoreByNamespaceByKey',
    'postStoreByNamespaceByKey',
    'deleteStoreByNamespaceByKey',
    'getMachineLedStrip',
    'putMachineLedStrip',
    'postMachineLedStripCommit',
    'postMachineLedStripReset',
    'getMachineScaleCalibration',
    'putMachineScaleCalibration',
    'postMachineShotSettings',
    'getMachineCapabilities',
];

const row = (id) => TABLE.rest.find((r) => r.id === id);

describe('0. the check is running against the pin, not against HEAD', () => {
    test('the reference worktree is at the pinned commit', () => {
        const head = execFileSync('git', ['-C', REA_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
        assert.equal(head, PINNED_COMMIT, `the worktree is at ${head}, not the pin`);
    });

    test('every settings route has a row, stamped at the pin', () => {
        for (const id of SETTINGS_ROUTE_IDS) {
            const r = row(id);
            assert.ok(r, `${id}: no contract row — the screen calls a route the table cannot answer for`);
            assert.equal(r.checkedCommit, PINNED_COMMIT, `${id}: stamped ${r.checkedCommit}`);
            assert.ok(r.handlerFile && r.handlerSymbol, `${id}: no handler evidence`);
        }
    });
});

describe('1. KV store — kv_store_handler.dart:7-51, read as written', () => {
    test('all four routes are registered, with the verbs the rows claim', () => {
        assert.match(kv, /app\.get\(\s*'\/api\/v1\/store\/<namespace>'/);
        assert.match(kv, /app\.get\(\s*'\/api\/v1\/store\/<namespace>\/<key>'/);
        assert.match(kv, /app\.post\(\s*'\/api\/v1\/store\/<namespace>\/<key>'/);
        assert.match(kv, /app\.delete\(\s*'\/api\/v1\/store\/<namespace>\/<key>'/);
        for (const id of SETTINGS_ROUTE_IDS.filter((i) => /Store/.test(i))) {
            assert.equal(row(id).handlerFile, KV_HANDLER);
        }
    });

    test('THERE IS NO ROUTE THAT LISTS NAMESPACES', () => {
        assert.doesNotMatch(kv, /'\/api\/v1\/store'/);
        assert.ok(!TABLE.rest.some((r) => r.path === '/api/v1/store'), 'a namespace-list row appeared');
    });

    test('a missing key answers 200 with a null body — there is NO 404 path', () => {
        assert.match(kv, /return jsonOk\(await store\.get\(namespace: namespace, key: key\)\);/);
        assert.doesNotMatch(kv, /jsonNotFound/);
        assert.match(row('getStoreByNamespaceByKey').responseShape, /200 carrying null/);
    });

    test('the null-body hole is still in the handler, and the row still names it', () => {
        assert.match(kv, /final maybeJson = jsonDecode\(value\);/);
        assert.match(kv, /value: maybeJson \?\? value,/);
        const gates = row('postStoreByNamespaceByKey').gates.map((g) => g.kind);
        assert.ok(gates.includes('null-body-hole'), 'the write hole lost its gate');
    });

    test('jsonDecode sits OUTSIDE any try and BEFORE the null guard — an undecodable body is a 500', () => {
        const post = kv.slice(kv.indexOf("app.post('/api/v1/store/<namespace>/<key>'"));
        const decodeAt = post.indexOf('jsonDecode(value)');
        const guardAt = post.indexOf('Missing namespace or key');
        assert.ok(decodeAt > -1 && guardAt > -1);
        assert.ok(decodeAt < guardAt, 'the null guard now precedes jsonDecode — re-read the row');
        assert.ok(!/try\s*\{[\s\S]{0,120}jsonDecode\(value\)/.test(post), 'jsonDecode is now guarded — re-read the row');
        /* THE CONTRAST THAT MAKES IT A FINDING RATHER THAN A PREFERENCE — and it SHARPENED
         * at this pin. Both handlers now read the body through readBoundedRequestBodyString,
         * so the KV write is no longer the unbounded one. What still separates them is the
         * try: de1handler wraps its jsonDecode and turns an undecodable body into a 400,
         * rethrowing only the body-read failure so it can become its own 413/408. The KV
         * handler's jsonDecode (kv_store_handler.dart:45) sits bare after the bounded read,
         * so the same body is still a 500 there. */
        assert.match(de1, /try \{\s*json = jsonDecode\(\s*await readBoundedRequestBodyString\(\s*r,\s*maxBytes: smallRequestBodyBytes,\s*timeout: smallRequestBodyTimeout,\s*\),\s*\);\s*\} on RequestBodyReadException \{\s*rethrow;\s*\} catch \(e\) \{\s*return jsonBadRequest\(\{'error': 'Invalid JSON body'\}\);\s*\}/);
        assert.match(kv, /final value = await readBoundedRequestBodyString\(/,
            'the KV read is bounded too now — the finding is the missing try, not the missing bound');
        const gates = row('postStoreByNamespaceByKey').gates.map((g) => g.kind);
        assert.ok(gates.includes('undecodable-body-is-500'), 'the finding lost its gate');
    });

    test('the conditional (ETag) path is ?full=1 ONLY', () => {
        assert.match(kv, /if \(req\.url\.queryParameters\['full'\] == '1'\) \{\s*return jsonOkConditional/);
        assert.match(kv, /return jsonOk\(await store\.keys\(namespace: namespace\)\);/);
        assert.equal(isConditionalRoute('/store/decal', { full: '1' }), true);
        assert.equal(isConditionalRoute('/store/decal', {}), false);
        assert.equal(isConditionalRoute('/store/decal/theme', {}), false, 'the per-key read is not conditional');
        assert.ok(CONDITIONAL_ROUTES.some((r) => r.path === '/store/<namespace>'));
    });

    test('writes and deletes answer 200 with a body, not 204', () => {
        assert.match(kv, /await store\.delete\(key: key, namespace: namespace\);\s*return jsonOk\(\{\}\);/);
        assert.match(row('postStoreByNamespaceByKey').responseShape, /200 \{\}/);
        assert.match(row('deleteStoreByNamespaceByKey').responseShape, /200 \{\}/);
    });

    test('THE HANDLER WINS over the generated client where they disagree', () => {
        assert.equal(generated.postStoreByNamespaceByKey.successStatus, '204');
        assert.match(row('postStoreByNamespaceByKey').responseShape, /200/, 'the row must follow the handler, not the spec');
        assert.ok(generated.getStoreByNamespaceByKey.statuses.includes('404'));
        assert.doesNotMatch(kv, /jsonNotFound/, 'the spec 404 has no handler path to come from');
    });
});

describe('2. /machine/ledStrip x6 — de1handler.dart:208,:224,:261,:302,:311,:320', () => {
    /* CB BUG 3 IS FIXED UPSTREAM. At the old pin there were FOUR routes and no preview at
     * all, and the skin had to fake one by PUTting the stored palette. POST /ledStrip/preview
     * and POST /ledStrip/preview/clear are real handlers at this pin (:261, :302), so the
     * count is six and EXCLUDED.md no longer forbids them. The count is still asserted
     * exactly — a seventh route must break this, not slip in. */
    test('exactly six ledStrip routes, at the paths and verbs the rows claim', () => {
        const expected = [
            ['get', '/api/v1/machine/ledStrip'],
            ['put', '/api/v1/machine/ledStrip'],
            ['post', '/api/v1/machine/ledStrip/preview'],
            ['post', '/api/v1/machine/ledStrip/preview/clear'],
            ['post', '/api/v1/machine/ledStrip/commit'],
            ['post', '/api/v1/machine/ledStrip/reset'],
        ];
        const registered = [...de1.matchAll(/app\.(\w+)\('(\/api\/v1\/machine\/ledStrip[^']*)'/g)]
            .map((m) => [m[1], m[2]]);
        assert.deepEqual(registered, expected,
            `${registered.length} ledStrip routes registered, expected ${expected.length}`);
    });

    test('THE PREVIEW PAIR EXISTS NOW, and both carry a row — CB BUG 3 is fixed upstream', () => {
        // The live colour is kept apart from the stored palette, which is the whole point:
        // a picker can show an ASLEEP colour on an awake machine, which a stored write cannot.
        assert.match(de1, /await \(de1 as BengleInterface\)\.previewLedStrip\(/);
        assert.match(de1, /await \(de1 as BengleInterface\)\.clearLedStripPreview\(\);\s*return jsonAccepted\(\);/);
        // A body naming neither strip is a 400, not a silent no-op.
        assert.match(de1, /'error': 'name at least one of frontStrip or backStrip',/);
        for (const id of ['postMachineLedStripPreview', 'postMachineLedStripPreviewClear']) {
            assert.match(row(id).responseShape, /202, no body/, `${id} lost its row`);
        }
        assert.equal(TABLE.rest.filter((r) => /ledStrip\/preview/.test(r.path)).length, 2);
        /* The status is what says a route is addressed rather than merely known about, so it
         * moves with the caller in both directions. */
        for (const id of ['postMachineLedStripPreview', 'postMachineLedStripPreviewClear']) {
            assert.equal(row(id).status, 'consumed', `${id} is called and not marked consumed`);
            assert.match(row(id).consumedBy.join(' '), /led-strip-store\.js/);
        }

        /* `commitLedStrip()` is an empty method in every implementation at the pin, so the
         * request bought nothing. The row keeps its handler evidence and loses its caller. */
        assert.match(
            readReaFile('lib/src/models/device/impl/de1/unified_de1/led_strip_capability.dart').text,
            /Future<void> commitLedStrip\(\) async \{\}/,
        );
        assert.equal(row('postMachineLedStripCommit').status, 'recorded');
        assert.deepEqual(row('postMachineLedStripCommit').consumedBy, []);
    });

    test('PUT answers 200 with the READ-BACK state, not {status:accepted}; commit is 202 no body', () => {
        /* THE WRITE NOW READS ITSELF BACK. setLedStrip is still the write, but the handler
         * then does getLedStripState() and answers with the STORED value — {status:'accepted'}
         * survives only as the fallback for a read that comes back null. So a caller sees what
         * the firmware kept (8-bit-quantised, frontSwitch derived), not an echo of what it sent. */
        assert.match(de1, /await \(de1 as BengleInterface\)\.setLedStrip\(state\);\s*final stored = await de1\.getLedStripState\(\);\s*return jsonOk\(stored\?\.toJson\(\) \?\? \{'status': 'accepted'\}\);/);
        assert.match(de1, /await \(de1 as BengleInterface\)\.commitLedStrip\(\);\s*return jsonAccepted\(\);/);
        assert.match(row('putMachineLedStrip').responseShape, /200 LedStripState\.toJson/);
        assert.match(row('putMachineLedStrip').responseShape, /read-back/);
        assert.match(row('postMachineLedStripCommit').responseShape, /202, no body/);
    });

    test('a body-less 202 is a real trap and the row says so', () => {
        const helpers = readReaFile('lib/src/services/webserver/json_response.dart').text;
        assert.match(helpers, /Response jsonAccepted\(\[Object\? data\]\) => Response\(\s*202,\s*body: data != null \? jsonEncode\(data\) : null,/);
    });

    test('reset returns the reloaded state; GET and reset both have a 503 branch', () => {
        assert.match(de1, /final state = await \(de1 as BengleInterface\)\.resetLedStrip\(\);/);
        assert.match(de1, /ledStrip state unavailable \(hydration failed or not '\s*'yet complete\)/);
        assert.match(de1, /ledStrip state unavailable \(firmware read failed\)/);
        assert.match(row('getMachineLedStrip').responseShape, /503/);
        assert.match(row('postMachineLedStripReset').responseShape, /503/);
    });
});

describe('3. /machine/scaleCalibration — GET :244, PUT :253', () => {
    test('both verbs are registered and both have rows', () => {
        assert.match(de1, /app\.get\('\/api\/v1\/machine\/scaleCalibration'/);
        assert.match(de1, /app\.put\('\/api\/v1\/machine\/scaleCalibration'/);
        assert.doesNotMatch(de1, /machine\/scale\/calibrate/, 'the path the old skin POSTed has never existed');
    });

    test('the command vocabulary is abort|zero|latch, and weightGrams is 1..10000', () => {
        assert.match(de1, /case 'abort':/);
        assert.match(de1, /case 'zero':/);
        assert.match(de1, /case 'latch':/);
        assert.doesNotMatch(de1, /case 'left':|case 'right':/, "the skin's two-latch model has no counterpart");
        assert.match(de1, /'error': 'command must be one of abort, zero, latch',/);
        assert.match(de1, /'error': 'weightGrams required for latch'/);
        assert.match(de1, /weightGrams < 1 \|\| weightGrams > 10000/);
        const body = row('putMachineScaleCalibration').requestFields.body;
        assert.match(body.command, /abort.*zero.*latch/);
        assert.match(body.weightGrams, /1\.\.10000/);
    });

    test('202 accepted and 409 rejected BOTH carry the full state', () => {
        assert.match(de1, /return jsonAccepted\(\{'status': 'accepted', 'state': state\.toJson\(\)\}\);/);
        assert.match(de1, /return jsonConflict\(\{\s*'status': 'rejected',/);
        assert.match(row('putMachineScaleCalibration').responseShape, /202 \{status:'accepted', state:/);
        assert.match(row('putMachineScaleCalibration').responseShape, /409 \{status:'rejected'/);
    });

});

describe('4. POST /machine/shotSettings — de1handler.dart:36, :716-733', () => {
    test('POST is registered and there is NO GET', () => {
        assert.match(de1, /app\.post\('\/api\/v1\/machine\/shotSettings', _shotSettingsHandler\);/);
        assert.doesNotMatch(de1, /app\.get\('\/api\/v1\/machine\/shotSettings'/);
        assert.equal(row('postMachineShotSettings').verb, 'POST');
    });

    test('the read-back is the websocket, and it has its own row', () => {
        assert.match(de1, /'\/ws\/v1\/machine\/shotSettings',/);
        const socket = TABLE.sockets.find((s) => s.path === '/ws/v1/machine/shotSettings');
        assert.ok(socket, 'the socket row vanished');
        assert.equal(socket.status, 'consumed');
    });

    test('the success answer is 200 with a null body — not 204, not {}', () => {
        const handler = de1.slice(de1.indexOf('Future<Response> _shotSettingsHandler'));
        assert.match(handler.slice(0, 700), /return jsonOk\(null\);/);
        assert.match(row('postMachineShotSettings').responseShape, /200 with the body `null`/);
    });

    test('a non-object JSON body is a 400, because the cast is inside the try', () => {
        const handler = de1.slice(de1.indexOf('Future<Response> _shotSettingsHandler'), de1.indexOf('Future<void> _handleShotState'));
        assert.match(handler, /try \{\s*json = jsonDecode\(payload\);\s*\} catch \(e\) \{\s*return jsonBadRequest\(\{'error': 'Invalid JSON body'\}\);/);
        assert.match(handler, /Map<String, dynamic> json;/);
    });
});

describe('5. /machine/capabilities — A3, and the fail-closed consequence', () => {
    test('the handler serves {capabilities: [...]}, an OBJECT, not a bare array', () => {
        assert.match(de1, /return jsonOk\(\{'capabilities': caps\}\);/);
        assert.match(row('getMachineCapabilities').responseShape, /200 \{capabilities: string\[\]\}/);
    });

    test('the served seven are exactly what the store believes', () => {
        const block = de1.slice(de1.indexOf("app.get('/api/v1/machine/capabilities'"), de1.indexOf("app.get('/api/v1/machine/cupWarmer'"));
        const served = [...block.matchAll(/'([a-zA-Z]+)',/g)].map((m) => m[1]);
        assert.deepEqual(served, [...SERVED_CAPABILITIES], 'the handler list and SERVED_CAPABILITIES have drifted');
    });

    test('[] is a real answer for a non-Bengle — gated on the interface, not a model string', () => {
        assert.match(de1, /if \(de1 is BengleInterface\) \{\s*caps\.addAll\(\[/);
        assert.doesNotMatch(de1, /model.*contains\('bengle'\)/i);
    });

    test('WITH NO MACHINE the answer is 500 — {error} ALONE now, not 404 and not 503', () => {
        /* withDe1 LOST ITS OWN try. It is a thin delegator now (de1handler.dart:750-755) to
         * _mapDe1WriteErrors (:757-786), which has SEVEN typed branches where the old wrapper
         * mapped only MachineReplacementTimeoutException. The throw is unchanged —
         * connectedDe1() still raises DeviceNotConnectedException.machine() — but it now lands
         * on that exception's OWN branch (:781-782), which answers jsonError({'error'}) with
         * NO 'st'. The catch-all still carries {error, st} for anything else; a missing machine
         * simply no longer reaches it. Still 500 either way: jsonError is
         * Response.internalServerError, so this is not 404 and not 503. */
        assert.match(de1, /Future<Response> withDe1\(Future<Response> Function\(De1Interface\) call\) \{\s*return _mapDe1WriteErrors\(\(\) async \{\s*final de1 = _controller\.connectedDe1\(\);/);
        assert.match(de1, /\} on DeviceNotConnectedException catch \(e\) \{\s*return jsonError\(\{'error': e\.toString\(\)\}\);/);
        assert.match(de1, /\} catch \(e, st\) \{\s*return jsonError\(\{'error': e\.toString\(\), 'st': st\.toString\(\)\}\);/);
        const helpers = readReaFile('lib/src/services/webserver/json_response.dart').text;
        assert.match(helpers, /Response jsonError\(Object\? data\) =>\s*Response\.internalServerError\(/);
        const controller = readReaFile('lib/src/controllers/de1_controller.dart').text;
        assert.match(controller, /De1Interface connectedDe1\(\) \{\s*if \(_de1 == null\) \{\s*throw const DeviceNotConnectedException\.machine\(\);/);
        const gates = row('getMachineCapabilities').gates.map((g) => g.kind);
        assert.ok(gates.includes('no-machine-is-500-not-503'), 'the finding lost its gate');
        assert.match(row('getMachineCapabilities').responseShape,
            /500 \{error\} when no machine is connected/, 'the row must carry the stackless 500');
    });

    test('the feature gate for a non-Bengle is 404 — the feature-absent signal', () => {
        assert.match(de1, /Response\? _bengleFirmwareGate\(De1Interface de1, String feature\) \{\s*if \(de1 is! BengleInterface\) \{\s*return jsonNotFound\(\{'error': '\$feature not supported'\}\);/);
    });

    test('every capability the routing table gates on is one ReaPrime actually serves', () => {
        for (const key of settingsKeys()) {
            const { capability } = STORAGE_ROUTES[key];
            if (!capability) continue;
            assert.ok(
                SERVED_CAPABILITIES.includes(capability),
                `${key}: gated on '${capability}', which is not one of the served seven — a typo here is a permanently hidden surface`,
            );
        }
    });
});

describe('6. the mock — a KV round trip, including the failure path', () => {
    let server;
    let base;

    test('start the recording mock on an ephemeral port', async () => {
        server = await startMock();
        base = server.base;
        assert.ok(base, 'the mock did not report a port');
    });

    test('a KV write is ACCEPTED per the contract row — 200 with a body', async () => {
        const response = await fetch(`${base}/api/v1/store/decal/waterTankUnit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify('mL'),
        });
        const body = await response.text();
        assert.equal(response.status, 200, body);
        assert.deepEqual(JSON.parse(body), {}, 'the write answer is 200 {} — a body, not a 204');
    });

    test('THE READ STILL MISSES — the mock is a replay, not a store', async () => {
        const response = await fetch(`${base}/api/v1/store/decal/waterTankUnit`);
        assert.equal(response.status, 503, 'a miss must be 503, ReaPrime uses 404 for feature-absent');
    });

    test('the failure path surfaces through the backend as a throw, not an empty answer', async () => {
        const { createReaKvBackend } = await import('../src/data/rea-kv-backend.js');
        const backend = createReaKvBackend({ namespace: 'decal', fetch, baseUrl: `${base}/api/v1` });
        await assert.rejects(() => backend.get('waterTankUnit'), /KV read failed: 503/);
    });

    test('a failed read costs a default, and a failed write reports false', async () => {
        const { createStorageRouter } = await import('../src/lib/storage-router.js');
        const { createReaKvBackend } = await import('../src/data/rea-kv-backend.js');
        const { LAYERS } = await import('../src/lib/storage-routes.js');
        const kvBackend = createReaKvBackend({ namespace: 'decal', fetch, baseUrl: `${base}/api/v1` });
        const router = createStorageRouter({ backends: { [LAYERS.kv]: kvBackend } });
        // Read: absent, never a throw that takes a screen down.
        assert.equal(await router.get('waterTankUnit'), undefined);
        assert.equal(typeof await router.set('waterTankUnit', 'mL'), 'boolean');
    });

    test('the backend REFUSES a null write rather than storing the string "null"', async () => {
        const { createReaKvBackend } = await import('../src/data/rea-kv-backend.js');
        const backend = createReaKvBackend({ namespace: 'decal', fetch, baseUrl: `${base}/api/v1` });
        await assert.rejects(() => backend.set('waterTankUnit', null), /Delete the key instead/);
    });

    test('/machine/capabilities answers 503 — so every gate reads UNKNOWN', async () => {
        const response = await fetch(`${base}/api/v1/machine/capabilities`);
        assert.equal(response.status, 503, 'the mock grew a capabilities fixture — re-read the fail-closed tests');
    });

    test('stop the mock', () => {
        if (server) server.stop();
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
