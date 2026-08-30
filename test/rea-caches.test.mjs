// The two caches that pay, and the one that lies.
//
// The interesting assertions here are the negative ones: that only two caches exist, that
// neither answers from an expired entry, and that neither answers at all on the error
// path. The old module's `getDe1Settings` did the opposite — "return cached data if
// available, even if expired, to avoid breaking functionality" — which is a stale value
// standing in for a dead server, indistinguishable on screen from a live one (A7).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTtlCache, DE1_CACHE_SPECS, freezeDeep } from '../src/data/rea-cache.js';
import {
    createDe1SettingsClient,
    DE1_SETTINGS_PATH,
    DE1_ADVANCED_SETTINGS_PATH,
    DE1_SETTINGS_WRITE_KEYS,
    DE1_ADVANCED_WRITE_KEYS,
    DE1_SETTINGS_INVALIDATING_WRITES,
    writeInvalidatesDe1Settings,
} from '../src/data/rea-de1-settings.js';
import { createReaTransport } from '../src/data/rea-transport.js';
import { REA_ROOT } from '../scripts/generate-machine-state.js';
import { stripComments } from '../scripts/lib/source-scan.js';

const BASE = 'http://machine.local:8080/api/v1';

function clock(start = 1000) {
    let t = start;
    const now = () => t;
    now.advance = (ms) => { t += ms; };
    return now;
}

function harness({ plan, now }) {
    const calls = [];
    const fetchImpl = async (url, init) => {
        calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
        return plan(url, init, calls.length);
    };
    const transport = createReaTransport({ fetch: fetchImpl, baseUrl: BASE });
    // The transport is returned as well, because the third route that invalidates these
    // caches — PUT /workflow — is deliberately NOT this client's to call: it is written by
    // whoever owns the workflow screen, over the same transport.
    return { calls, transport, client: createDe1SettingsClient(transport, { now }) };
}

const ok = (body, status = 200) => ({
    status,
    ok: true,
    headers: { get: () => null },
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
});
const fail = (status, body) => ({
    status,
    ok: false,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
});

describe('createTtlCache demands a payoff', () => {
    test('a cache without a named payoff cannot be built', () => {
        assert.throws(() => createTtlCache({ name: 'x', ttlMs: 1000 }), /named payoff is required/);
        assert.throws(() => createTtlCache({ name: 'x', ttlMs: 1000, payoff: 'fast' }), /named payoff is required/);
        assert.throws(() => createTtlCache({ name: 'x', ttlMs: 0, payoff: 'a real reason here' }), /positive number/);
    });

    test('an expired entry yields no value at all, not an old one', () => {
        const now = clock();
        const cache = createTtlCache({ name: 'c', ttlMs: 100, payoff: 'a real reason, stated', now });
        cache.write({ fan: 40 });
        assert.deepEqual(cache.read(), { fresh: true, value: { fan: 40 }, ageMs: 0 });
        now.advance(100);
        const stale = cache.read();
        assert.equal(stale.fresh, false);
        assert.equal(stale.value, null, 'an expired read must not carry the old value');
    });

    test('invalidate is immediate', () => {
        const now = clock();
        const cache = createTtlCache({ name: 'c', ttlMs: 100, payoff: 'a real reason, stated', now });
        cache.write(1);
        cache.invalidate();
        assert.equal(cache.read().fresh, false);
    });
});

describe('exactly two caches exist', () => {
    test('the register has two entries and they are the two named in SCOPE', () => {
        assert.equal(DE1_CACHE_SPECS.length, 2);
        assert.deepEqual(DE1_CACHE_SPECS.map((s) => s.name), ['de1SettingsCache', 'de1AdvancedSettingsCache']);
        assert.deepEqual(DE1_CACHE_SPECS.map((s) => s.ttlMs), [60000, 40000]);
        assert.deepEqual(DE1_CACHE_SPECS.map((s) => s.route), ['/machine/settings', '/machine/settings/advanced']);
    });

    test('createTtlCache is called from exactly one module', () => {
        // Not style policing: a third TTL cache appearing anywhere in src/ is the failure
        // this register exists to make visible.
        const dir = new URL('../src/', import.meta.url);
        const hits = grep(dir, /createTtlCache\(/);
        assert.deepEqual(hits, ['data/rea-cache.js', 'data/rea-de1-settings.js']);
    });

    test('reatsettingscache is nowhere in the tree as code', () => {
        // Prose and provenance strings may name it — src/lib/storage-routes.js records
        // "delete reatsettingscache" as the trace for a storage row, and that record is
        // the point. What must not exist is the identifier in an executable position.
        assert.deepEqual(
            grep(new URL('../src/', import.meta.url), /reatsettingscache/i, { dropStrings: true }),
            [],
        );
    });
});

describe('the payoff is structural, and the handlers still say so', () => {
    const de1 = join(REA_ROOT, 'lib/src/services/webserver/de1handler.dart');

    test('neither settings GET is conditional', () => {
        assert.ok(existsSync(de1), `ReaPrime source missing: ${de1} (set REA_ROOT)`);
        const source = readFileSync(de1, 'utf8');
        for (const route of ["app.get('/api/v1/machine/settings'", "app.get('/api/v1/machine/settings/advanced'"]) {
            const at = source.indexOf(route);
            assert.ok(at > 0, `route missing: ${route}`);
            const body = source.slice(at, at + 900);
            assert.ok(body.includes('jsonOk('), `${route} should answer with plain jsonOk`);
            assert.ok(!body.includes('jsonOkConditional('), `${route} became conditional — revalidate instead of caching`);
        }
    });

    test('the device-read counts in the register are the handler\'s', () => {
        const source = readFileSync(de1, 'utf8');
        const count = (route) => {
            const at = source.indexOf(route);
            const body = source.slice(at, source.indexOf('});', source.indexOf('return jsonOk(json);', at)));
            return (body.match(/await de1\.get/g) || []).length;
        };
        assert.equal(count("app.get('/api/v1/machine/settings'"), 9);
        assert.equal(count("app.get('/api/v1/machine/settings/advanced'"), 6);
        assert.deepEqual(DE1_CACHE_SPECS.map((s) => s.deviceReads), [9, 6]);
        assert.equal(DE1_CACHE_SPECS.reduce((a, s) => a + s.deviceReads, 0), 15, 'the "15 serialized MMR reads" of the scope');
    });
});

describe('read-through and write-through', () => {
    test('a fresh read does not reach the machine; an expired one does', async () => {
        const now = clock();
        const { calls, client } = harness({ now, plan: () => ok({ fan: 40 }) });

        const first = await client.readSettings();
        assert.equal(first.ok, true);
        assert.equal(first.fromCache, undefined);
        assert.equal(calls.length, 1);

        const second = await client.readSettings();
        assert.equal(second.fromCache, true);
        assert.equal(second.notModified, false, 'a cache hit is not a 304 — the server said nothing');
        assert.deepEqual(second.data, { fan: 40 });
        assert.equal(calls.length, 1);

        now.advance(60000);
        await client.readSettings();
        assert.equal(calls.length, 2);
    });

    test('the two caches have their own TTLs', async () => {
        const now = clock();
        const { calls, client } = harness({ now, plan: () => ok({ x: 1 }) });
        await client.readSettings();
        await client.readAdvancedSettings();
        assert.equal(calls.length, 2);

        now.advance(45000); // past 40 s, inside 60 s
        await client.readSettings();
        await client.readAdvancedSettings();
        assert.equal(calls.length, 3, 'only the 40 s advanced cache should have expired');
        assert.equal(calls[2].url, `${BASE}${DE1_ADVANCED_SETTINGS_PATH}`);
    });

    test('a successful write invalidates BOTH caches', async () => {
        const now = clock();
        const { calls, client } = harness({ now, plan: (url, init) => (init.method === 'GET' ? ok({ x: 1 }) : ok(undefined, 202)) });
        await client.readSettings();
        await client.readAdvancedSettings();
        await client.writeAdvancedSettings({ heaterIdleTemp: 88 });

        await client.readSettings();
        await client.readAdvancedSettings();
        assert.equal(calls.length, 5, 'both reads should have gone back to the machine');
    });

    test('a rejected write does not spend fifteen device reads re-learning nothing', async () => {
        const now = clock();
        const { calls, client } = harness({ now, plan: (url, init) => (init.method === 'GET' ? ok({ x: 1 }) : fail(503, { error: 'Machine unavailable' })) });
        await client.readSettings();
        const written = await client.writeSettings({ fan: 40 });
        assert.equal(written.ok, false);
        await client.readSettings();
        assert.equal(calls.length, 2, 'the read after a failed write should still be cached');
    });

    test('a failed read returns the failure and never a stale copy', async () => {
        const now = clock();
        let mode = 'ok';
        const { client } = harness({ now, plan: () => (mode === 'ok' ? ok({ fan: 40 }) : fail(500, { error: 'de1 gone' })) });
        await client.readSettings();
        now.advance(60000);
        mode = 'fail';
        const result = await client.readSettings();
        assert.equal(result.ok, false);
        assert.equal(result.status, 500);
        assert.equal(result.data, undefined, 'no expired-cache fallback');
    });

    test('usb reads as a bool and writes as the string the handler tests for', async () => {
        const now = clock();
        const { calls, client } = harness({ now, plan: (url, init) => (init.method === 'GET' ? ok({ usb: true }) : ok(undefined, 202)) });
        await client.writeSettings({ usb: true });
        assert.deepEqual(calls[0].body, { usb: 'enable' });
        await client.writeSettings({ usb: false });
        assert.deepEqual(calls[1].body, { usb: 'disable' });
    });

    test('only the keys the handler reads are sent', async () => {
        const now = clock();
        const { calls, client } = harness({ now, plan: () => ok(undefined, 202) });
        await client.writeSettings({ fan: 40, notAThing: 1 });
        assert.deepEqual(calls[0].body, { fan: 40 });
        assert.deepEqual([...DE1_SETTINGS_WRITE_KEYS].sort(), ['fan', 'flushFlow', 'flushTemp', 'flushTimeout', 'hotWaterFlow', 'steamFlow', 'steamPurgeMode', 'tankTemp', 'usb'].sort());
        assert.equal(DE1_ADVANCED_WRITE_KEYS.length, 6);
        assert.equal(DE1_SETTINGS_PATH, '/machine/settings');
    });

    test('the settings reads never send If-None-Match — there is no ETag to send', async () => {
        const now = clock();
        const headers = [];
        const transport = createReaTransport({
            fetch: async (url, init) => { headers.push(init.headers); return ok({ fan: 40 }); },
            baseUrl: BASE,
        });
        const client = createDe1SettingsClient(transport, { now });
        await client.readSettings();
        assert.equal(headers[0]['If-None-Match'], undefined);
    });
});

/**
 * Every path under `dir` (recursively, .js only) whose CODE matches `re`.
 *
 * Comments are stripped first, and deliberately so: rea-cache.js names
 * `reatsettingscache` in prose to record why it does not exist, and a scanner that cannot
 * tell prose from code produces a false positive, a false positive earns an exemption,
 * and an exemption is how coverage dies (the same rule as test/rea-dead-names.test.mjs).
 */
function grep(dir, re, { dropStrings = false } = {}) {
    const root = fileURLToPath(dir);
    const out = [];
    const walk = (rel) => {
        for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
            const next = rel ? `${rel}/${entry.name}` : entry.name;
            if (entry.isDirectory()) walk(next);
            else if (entry.name.endsWith('.js')) {
                const code = stripComments(readFileSync(join(root, next), 'utf8'), { dropStrings });
                if (re.test(code)) out.push(next);
            }
        }
    };
    walk('');
    return out.sort();
}


/* ────────────────────────────────────────────────────────────────────────────────────
 * THE THIRD INVALIDATING ROUTE.
 *
 * This module reasoned carefully about invalidating BOTH settings caches on either
 * settings write, and did not mention `PUT /api/v1/workflow` at all — which changes five of
 * the nine values `GET /machine/settings` returns. Kept, the 60 s cache reproduced exactly
 * the staleness defect `reatsettingscache` was deleted for.
 */
describe('PUT /workflow invalidates the settings caches', () => {
    test('a workflow write drops both caches, so the next read goes to the machine', async () => {
        const now = clock();
        const settings = { fan: 40, flushFlow: 4.0, steamFlow: 1.2, hotWaterFlow: 3.0 };
        const { calls, transport, client } = harness({
            plan: (url, init) => (init.method === 'GET' ? ok(settings) : ok(undefined, 202)),
            now,
        });
        const reads = () => calls.filter((c) => c.method === 'GET').length;
        await client.readSettings();
        await client.readAdvancedSettings();
        assert.equal(reads(), 2);

        // Read again inside the TTL: served from cache, no request.
        await client.readSettings();
        assert.equal(reads(), 2, 'the cache is doing its job');

        // The workflow write, on the SAME transport, from somewhere else entirely — the
        // workflow screen, which has no reason to know these caches exist.
        await transport.put('/workflow', { rinseData: { flow: 4.5, targetTemperature: 92, duration: 5 } });

        await client.readSettings();
        await client.readAdvancedSettings();
        assert.equal(reads(), 4, 'both caches were dropped by a route this client does not own');
    });

    test('a REJECTED workflow write leaves the caches alone', async () => {
        const now = clock();
        const { calls, transport, client } = harness({
            plan: (url, init) => (init.method === 'GET' ? ok({ fan: 40 }) : fail(503, { error: 'Machine unavailable' })),
            now,
        });
        await client.readSettings();
        await transport.put('/workflow', { rinseData: { flow: 4.5 } });
        await client.readSettings();
        assert.equal(calls.filter((c) => c.method === 'GET').length, 1, 'nothing changed on the machine');
    });

    test('the invalidating set is data, and names every route with its handler', () => {
        const routes = DE1_SETTINGS_INVALIDATING_WRITES.map((r) => `${r.method} ${r.route}`);
        /* THREE BECAME FOUR ON 24 AUG 2026. `DELETE /machine/settings/reset` is the
         * fourth, and it belongs here for the reason the third does: it changes values
         * these caches hold and it is not this client's own write path. F3/Q1 had
         * excluded the route entirely; the reset leaf adopted it when every one of the
         * SEVEN values `applySettingsDefaults` writes became a control on a page. */
        assert.deepEqual(routes, [
            'POST /machine/settings',
            'POST /machine/settings/advanced',
            'DELETE /machine/settings/reset',
            'PUT /workflow',
        ]);

        const reset = DE1_SETTINGS_INVALIDATING_WRITES.find((r) => r.route === '/machine/settings/reset');
        assert.equal(reset.handlerFile, 'lib/src/services/webserver/de1handler.dart');
        /* SEVEN VALUES, AND THE ROUTE'S NAME OVERSTATES IT: this is not a factory reset.
         * Five of the seven are keys of the two documents these caches hold; the other
         * two — `flowEstimation` and the fan — reach the machine by their own routes and
         * are named in the row so the next reader does not have to open the handler. */
        assert.deepEqual(reset.changes, [
            'fan', 'steamPurgeMode',
            'heaterIdleTemp', 'heaterPh1Flow', 'heaterPh2Flow', 'heaterPh2Timeout',
            'refillKitSetting',
        ]);
        for (const key of ['heaterIdleTemp', 'heaterPh1Flow', 'heaterPh2Flow', 'heaterPh2Timeout', 'refillKitSetting']) {
            assert.ok(DE1_ADVANCED_WRITE_KEYS.includes(key), `${key} is one of the advanced route's own keys`);
        }
        for (const key of ['fan', 'steamPurgeMode']) {
            assert.ok(DE1_SETTINGS_WRITE_KEYS.includes(key), `${key} is one of the settings route's own keys`);
        }

        const workflow = DE1_SETTINGS_INVALIDATING_WRITES.find((r) => r.route === '/workflow');
        assert.equal(workflow.handlerFile, 'lib/src/services/webserver/workflow_handler.dart');
        assert.deepEqual(workflow.changes, ['flushTemp', 'flushTimeout', 'flushFlow', 'steamFlow', 'hotWaterFlow']);
        // Five of the nine reads GET /machine/settings performs.
        for (const key of workflow.changes) {
            assert.ok(DE1_SETTINGS_WRITE_KEYS.includes(key), `${key} is one of the settings route's own keys`);
        }
    });

    test('the predicate accepts both spellings of a path and refuses everything else', () => {
        assert.equal(writeInvalidatesDe1Settings('DELETE', '/machine/settings/reset'), true);
        assert.equal(writeInvalidatesDe1Settings('GET', '/machine/settings/reset'), false);
        assert.equal(writeInvalidatesDe1Settings('PUT', '/workflow'), true);
        assert.equal(writeInvalidatesDe1Settings('put', '/api/v1/workflow'), true);
        assert.equal(writeInvalidatesDe1Settings('GET', '/workflow'), false, 'a read changes nothing');
        assert.equal(writeInvalidatesDe1Settings('POST', '/profiles'), false);
        assert.equal(writeInvalidatesDe1Settings('PUT', '/workflows'), false);
    });

    test('the DE1 controller really does write those five setters from the workflow path', () => {
        // Read at the pin, not assumed: _applyUpdate -> updateWorkflowSettings -> the three
        // _write*Settings helpers, whose setters back five of the nine GET reads.
        const handler = readFileSync(join(REA_ROOT, 'lib/src/services/webserver/workflow_handler.dart'), 'utf8');
        assert.match(handler, /_de1controller\.updateWorkflowSettings\(/);
        const controller = readFileSync(join(REA_ROOT, 'lib/src/controllers/de1_controller.dart'), 'utf8');
        const body = controller.slice(controller.indexOf('Future<void> updateWorkflowSettings('));
        for (const call of ['_writeFlushSettings', '_writeSteamSettings', '_writeHotWaterSettings']) {
            assert.ok(body.slice(0, 2000).includes(call), `updateWorkflowSettings dispatches ${call}`);
        }
        for (const setter of ['setFlushTimeout', 'setFlushFlow', 'setFlushTemperature', 'setSteamFlow', 'setHotWaterFlow']) {
            assert.ok(controller.includes(setter), `de1_controller writes ${setter}`);
        }
    });

    test('a client cannot be built on a transport that cannot announce writes', () => {
        assert.throws(
            () => createDe1SettingsClient({ get: async () => ({ ok: true }), post: async () => ({ ok: true }), url: () => '' }),
            /must expose onWrite/,
        );
    });
});

describe('a cached body is handed out frozen', () => {
    test('a caller cannot edit what the next cache hit reports as the server\'s answer', async () => {
        const now = clock();
        const { client } = harness({ plan: () => ok({ fan: 40, flushFlow: 4.0 }), now });
        const first = await client.readSettings();
        assert.equal(first.data.fan, 40);
        assert.throws(() => { first.data.fan = 999; }, TypeError, 'the edit is loud, not silent');
        const second = await client.readSettings();
        assert.equal(second.fromCache, true);
        assert.equal(second.data.fan, 40, 'ReaPrime\'s value, not a locally-modified one');
    });

    test('freezeDeep reaches nested objects and arrays, and tolerates a cycle', () => {
        const value = { a: { b: [1, { c: 2 }] } };
        freezeDeep(value);
        assert.throws(() => { value.a.b[1].c = 3; }, TypeError);
        assert.throws(() => value.a.b.push(4), TypeError);
        const cyclic = { name: 'x' };
        cyclic.self = cyclic;
        assert.equal(freezeDeep(cyclic), cyclic, 'a cycle terminates rather than hanging the cache');
    });
});
