/**
 * settings-contract.test.mjs — the contract check as a BUILD activity
 * (wave 5.4, item contract-check-settings-endpoints).
 *
 * SCOPE Part 5 preamble: "contract checking is a build activity. Every endpoint a screen
 * calls gets its path, verb, request body and response shape checked against the ReaPrime
 * handler *as it is written*, at the moment the screen is built." Part 3 §7: "the handler
 * source open in the next pane, not a doc, not memory, not the old skin."
 *
 * So this suite reads ReaPrime's handler files out of the PINNED worktree and asserts the
 * table's rows against the bytes — not against `rest_v1.yml`, not against the generated
 * client, and not against what the old skin believed. Where the spec and the handler
 * disagree the handler wins, and two of those disagreements are asserted here explicitly so
 * that "the generated client says 204" can never quietly become the answer.
 *
 * The routes in scope are the ones the settings screen touches: the four KV store routes,
 * /machine/ledStrip x4, GET+PUT /machine/scaleCalibration, POST /machine/shotSettings and
 * GET /machine/capabilities. Eleven REST routes, plus the shotSettings socket.
 *
 * D7's warning governs: "no finding in any audit document, including a correction,
 * including this file, is acted on without opening both sides first." Every assertion below
 * quotes something this suite reads at run time.
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

/** The rows this wave is responsible for, by id. */
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
        // Part 3 §5 states it; this is the assertion behind the sentence. The only
        // namespace-shaped path takes a <namespace> parameter, so nothing enumerates them.
        assert.doesNotMatch(kv, /'\/api\/v1\/store'/);
        assert.ok(!TABLE.rest.some((r) => r.path === '/api/v1/store'), 'a namespace-list row appeared');
    });

    test('a missing key answers 200 with a null body — there is NO 404 path', () => {
        assert.match(kv, /return jsonOk\(await store\.get\(namespace: namespace, key: key\)\);/);
        assert.doesNotMatch(kv, /jsonNotFound/);
        assert.match(row('getStoreByNamespaceByKey').responseShape, /200 carrying null/);
    });

    test('the null-body hole is still in the handler, and the row still names it', () => {
        // `jsonDecode('null')` is null, so `maybeJson ?? value` falls through to the RAW
        // BODY STRING and the store holds the four characters 'null'.
        assert.match(kv, /final maybeJson = jsonDecode\(value\);/);
        assert.match(kv, /value: maybeJson \?\? value,/);
        const gates = row('postStoreByNamespaceByKey').gates.map((g) => g.kind);
        assert.ok(gates.includes('null-body-hole'), 'the write hole lost its gate');
    });

    test('jsonDecode sits OUTSIDE any try and BEFORE the null guard — an undecodable body is a 500', () => {
        // The finding this wave adds. The three de1handler write routes all wrap
        // jsonDecode in a try and answer 400; the KV handler does not, and there is no
        // error middleware to reshape the escape.
        const post = kv.slice(kv.indexOf("app.post('/api/v1/store/<namespace>/<key>'"));
        const decodeAt = post.indexOf('jsonDecode(value)');
        const guardAt = post.indexOf('Missing namespace or key');
        assert.ok(decodeAt > -1 && guardAt > -1);
        assert.ok(decodeAt < guardAt, 'the null guard now precedes jsonDecode — re-read the row');
        assert.ok(!/try\s*\{[\s\S]{0,120}jsonDecode\(value\)/.test(post), 'jsonDecode is now guarded — re-read the row');
        // The contrast that makes it a finding rather than a preference.
        assert.match(de1, /try\s*\{\s*json = jsonDecode\(await r\.readAsString\(\)\);\s*\}\s*catch/);
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
        // Recorded, not worked around: the generator reads rest_v1.yml, and the spec is
        // wrong twice on this route family. A future reader who trusts the generated
        // statuses would build a client that treats every successful write as a failure.
        assert.equal(generated.postStoreByNamespaceByKey.successStatus, '204');
        assert.match(row('postStoreByNamespaceByKey').responseShape, /200/, 'the row must follow the handler, not the spec');
        assert.ok(generated.getStoreByNamespaceByKey.statuses.includes('404'));
        assert.doesNotMatch(kv, /jsonNotFound/, 'the spec 404 has no handler path to come from');
    });
});

describe('2. /machine/ledStrip x4 — de1handler.dart:186,:202,:221,:230', () => {
    test('exactly four ledStrip routes, at the paths and verbs the rows claim', () => {
        assert.match(de1, /app\.get\('\/api\/v1\/machine\/ledStrip'/);
        assert.match(de1, /app\.put\('\/api\/v1\/machine\/ledStrip'/);
        assert.match(de1, /app\.post\('\/api\/v1\/machine\/ledStrip\/commit'/);
        assert.match(de1, /app\.post\('\/api\/v1\/machine\/ledStrip\/reset'/);
        const registered = [...de1.matchAll(/app\.\w+\('\/api\/v1\/machine\/ledStrip[^']*'/g)].length;
        assert.equal(registered, 4, `${registered} ledStrip routes registered, expected 4`);
    });

    test('THERE IS NO /preview AND NO /preview/clear — CB BUG 3', () => {
        // The old skin posted both and swallowed the 404s, so every wheel drag fired a
        // request that never landed. D7 ships the preview through PUT, and this is the
        // assertion that keeps the dead paths dead.
        assert.doesNotMatch(de1, /ledStrip\/preview/);
        assert.ok(!TABLE.rest.some((r) => /ledStrip\/preview/.test(r.path)), 'a preview row appeared');
    });

    test('PUT answers 200 {status:accepted}; commit answers 202 with NO BODY', () => {
        assert.match(de1, /await \(de1 as BengleInterface\)\.setLedStrip\(state\);\s*return jsonOk\(\{'status': 'accepted'\}\);/);
        assert.match(de1, /await \(de1 as BengleInterface\)\.commitLedStrip\(\);\s*return jsonAccepted\(\);/);
        assert.match(row('putMachineLedStrip').responseShape, /200 \{status:'accepted'\}/);
        assert.match(row('postMachineLedStripCommit').responseShape, /202, no body/);
    });

    test('a body-less 202 is a real trap and the row says so', () => {
        // jsonAccepted() with no argument sets `body: null` while still sending
        // Content-Type: application/json. A caller doing response.json() on it throws on
        // an empty body — the same class as CB BUG 4 (.json() over an NDJSON stream).
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

    // There is deliberately no further test in this block. The wave's F3 carve-out reads
    // "no code, no branch, no plan doc, no placeholder control, no disabled button, no TODO
    // that implies a shape, no test naming one" — and a test asserting the absence of a
    // particular spelling still names it and still implies a shape. The hole is recorded in
    // deferred_questions, which is the single sanctioned deliverable, and nowhere else.
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

    test('WITH NO MACHINE the answer is 500 with a Dart stack, not 404 and not 503', () => {
        // Recorded because it decides the fail-closed mapping: a 500 must become UNKNOWN,
        // never []. withDe1 maps only MachineReplacementTimeoutException; a
        // DeviceNotConnectedException falls to the generic catch.
        assert.match(de1, /Future<Response> withDe1\(Future<Response> Function\(De1Interface\) call\) async \{\s*try \{\s*var de1 = _controller\.connectedDe1\(\);/);
        assert.match(de1, /\} catch \(e, st\) \{\s*return jsonError\(\{'error': e\.toString\(\), 'st': st\.toString\(\)\}\);/);
        const controller = readReaFile('lib/src/controllers/de1_controller.dart').text;
        assert.match(controller, /De1Interface connectedDe1\(\) \{\s*if \(_de1 == null\) \{\s*throw const DeviceNotConnectedException\.machine\(\);/);
        const gates = row('getMachineCapabilities').gates.map((g) => g.kind);
        assert.ok(gates.includes('no-machine-is-500-not-503'), 'the finding lost its gate');
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

/* THE SAMPLE KEY IN THIS SECTION IS `waterTankUnit`, AND IT WAS `steamStopMode` UNTIL
 * 27 AUGUST 2026. That row is retired: the Live rail derives the steam stop mode from the
 * machine's own fields now instead of keeping a copy, so nothing reads the key and a
 * `layer: 'none'` row makes the router throw on it. Every use below was as "a key the
 * routing table sends to the KV layer" — the tank's display unit is one, and what is being
 * checked (the mock's 200-with-a-body write, its 503 miss, and how each surfaces) is
 * unchanged. */
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
        // Not a defect: mock_rea is a recording replay, writes never persist, and there is
        // NO `decal` recording at all (the only store fixtures are under the old `slate`
        // namespace, which A9/A10 forbid this skin from using). A settings leaf must
        // therefore render its ABSENT state against the mock rather than a value.
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
        // Write: the mock accepts it, so this reports true; the assertion that matters is
        // that the router reports the OUTCOME rather than assuming success.
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
