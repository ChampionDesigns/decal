/**
 * settings-routing.test.mjs — B7 at Settings volume (wave 5.4, item b7-storage-routing).
 *
 * The screen law this suite enforces, verbatim: "ONE STORE PER SETTING, NEVER TWO. Every
 * leaf's read/write path resolves through the routing table (key -> layer); a per-call-site
 * choice is a block, and a dual write is the proven units.js silent-revert defect.
 * Machine-scoped -> ReaPrime KV; device-scoped -> local; shot-scoped NEVER to KV."
 *
 * `storage-routes.test.mjs` already tests the table's shape row by row. This suite tests
 * the thing that only becomes testable at volume: TOTALITY over the enumerated settings
 * keys, and the absence of any second write path.
 *
 * Four checks, and the order is the order they would fail in a real regression:
 *
 *  1. TOTALITY — every settings key resolves to exactly one layer. Two is a failure. Zero
 *     is a failure. The enumeration is derived from the table (`settingsKeys()`), so
 *     "enumerated but unrouted" is unrepresentable; the failure this catches is a row that
 *     grows a second home, or a leaf key that loses its row.
 *  2. THE DUAL-WRITE DRILL — both backends instrumented, one write, one backend touched.
 *     This is the units.js defect (`units.js:52-58,:106-115`) as an executable assertion.
 *  3. SCOPE DECIDES LAYER — machine-scoped keys land in KV, device-scoped ones stay local,
 *     and nothing shot-scoped reaches KV at all.
 *  4. THE NAMESPACE IS THE NEW SKIN'S (A9/A10) — asserted on the EFFECTIVE values the
 *     router mints, not on a grep that a comment could satisfy, plus a scan of the shipped
 *     tree for a live old-prefix literal.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    STORAGE_ROUTES,
    STORAGE_PREFIX,
    KV_NAMESPACE,
    KV_NUMPAD_NAMESPACE,
    IDB_DATABASE_NAME,
    LAYERS,
    SCOPES,
    allKeys,
    settingsKeys,
    settingsLeaves,
    keysForLeaf,
    gatedSettingsKeys,
} from '../src/lib/storage-routes.js';
import { createStorageRouter, ERROR_CODES } from '../src/lib/storage-router.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));

/** A backend that records every call, so a second write cannot hide. */
function spy(label) {
    const calls = [];
    const data = new Map();
    return {
        label,
        calls,
        get touched() { return calls.length > 0; },
        get writes() { return calls.filter((c) => c.op === 'set' || c.op === 'remove'); },
        async get(key) { calls.push({ op: 'get', key }); return data.get(key); },
        async set(key, value) { calls.push({ op: 'set', key, value }); data.set(key, value); },
        async remove(key) { calls.push({ op: 'remove', key }); data.delete(key); },
    };
}

/** All four layers, every one instrumented. Nothing is left unwatched. */
function allBackends() {
    return {
        [LAYERS.local]: spy('local'),
        [LAYERS.session]: spy('session'),
        [LAYERS.kv]: spy('kv'),
        [LAYERS.kvNumpad]: spy('kvNumpad'),
    };
}

const SETTINGS_KEYS = settingsKeys();

describe('1. totality — every settings key has exactly one layer', () => {
    test('the enumeration is non-empty and every entry has a row', () => {
        assert.ok(SETTINGS_KEYS.length > 0, 'no settings keys enumerated at all');
        for (const key of SETTINGS_KEYS) {
            assert.ok(STORAGE_ROUTES[key], `${key}: enumerated with no row`);
        }
    });

    test('exactly one layer per key — two is a failure, zero is a failure', () => {
        for (const key of SETTINGS_KEYS) {
            const row = STORAGE_ROUTES[key];
            const layers = Object.values(LAYERS).filter((layer) => row.layer === layer);
            assert.equal(layers.length, 1, `${key}: resolves to ${layers.length} layers (${layers.join(', ')}), must be exactly 1`);
            assert.notEqual(row.layer, LAYERS.none, `${key}: is enumerated as a settings key but layer is 'none'`);
        }
    });

    test('one resolved backend per key — the router agrees with the table', async () => {
        const backends = allBackends();
        const router = createStorageRouter({ backends });
        for (const key of SETTINGS_KEYS) {
            for (const backend of Object.values(backends)) backend.calls.length = 0;
            await router.get(key);
            const touched = Object.entries(backends).filter(([, b]) => b.touched).map(([layer]) => layer);
            assert.deepEqual(touched, [STORAGE_ROUTES[key].layer], `${key}: read touched ${touched.join('+') || 'nothing'}`);
        }
    });

    test('every key belongs to a named leaf, and every leaf owns at least one key', () => {
        for (const key of SETTINGS_KEYS) {
            assert.equal(typeof STORAGE_ROUTES[key].leaf, 'string', `${key}: no leaf`);
            assert.ok(STORAGE_ROUTES[key].leaf.length > 0, `${key}: empty leaf`);
        }
        for (const leaf of settingsLeaves()) {
            assert.ok(keysForLeaf(leaf).length > 0, `${leaf}: named by a row but owns no key`);
        }
    });

    test('an unknown key is REFUSED, never defaulted to a layer', async () => {
        const backends = allBackends();
        const router = createStorageRouter({ backends });
        await assert.rejects(
            () => router.set('aSettingNobodyTabled', 1),
            (error) => error.code === ERROR_CODES.UNKNOWN_KEY,
            'an untabled key must throw UNKNOWN_KEY',
        );
        for (const [layer, backend] of Object.entries(backends)) {
            assert.equal(backend.touched, false, `${layer}: an unknown key reached a backend`);
        }
    });

    test('the enumeration excludes keys Decal does not store', () => {
        for (const key of allKeys()) {
            if (STORAGE_ROUTES[key].layer !== LAYERS.none) continue;
            assert.ok(!SETTINGS_KEYS.includes(key), `${key}: layer 'none' must not be enumerated as a settings key`);
        }
    });
});

describe('2. the dual-write drill — one write, one backend', () => {
    test('a machine-scoped write touches KV and NOTHING else', async () => {
        const machineScoped = SETTINGS_KEYS.filter((k) => STORAGE_ROUTES[k].scope === SCOPES.machine);
        assert.ok(machineScoped.length > 0, 'no machine-scoped settings keys to drill');
        for (const key of machineScoped) {
            const backends = allBackends();
            const router = createStorageRouter({ backends });
            await router.set(key, 'a value');
            const wrote = Object.entries(backends).filter(([, b]) => b.writes.length > 0).map(([layer]) => layer);
            assert.equal(wrote.length, 1, `${key}: ${wrote.length} backends written (${wrote.join('+')}) — a dual write`);
            assert.ok(wrote[0] === LAYERS.kv || wrote[0] === LAYERS.kvNumpad, `${key}: machine-scoped but written to '${wrote[0]}'`);
            assert.equal(backends[LAYERS.local].writes.length, 0, `${key}: also written locally — this is the units.js defect`);
        }
    });

    test('a device-scoped write touches local and NOTHING else', async () => {
        const deviceScoped = SETTINGS_KEYS.filter((k) => STORAGE_ROUTES[k].scope === SCOPES.device);
        assert.ok(deviceScoped.length > 0, 'no device-scoped settings keys to drill');
        for (const key of deviceScoped) {
            const backends = allBackends();
            const router = createStorageRouter({ backends });
            await router.set(key, 'a value');
            const wrote = Object.entries(backends).filter(([, b]) => b.writes.length > 0).map(([layer]) => layer);
            assert.deepEqual(wrote, [LAYERS.local], `${key}: written to ${wrote.join('+') || 'nothing'}`);
            assert.equal(backends[LAYERS.kv].writes.length, 0, `${key}: a device preference reached the machine's store`);
        }
    });

    test('a FAILED write reaches no second layer — no fallback store', async () => {
        // The exact shape of the old defect: the first store rejects, and the value must
        // NOT quietly land somewhere else. `set` reports false; nothing is written.
        const backends = allBackends();
        backends[LAYERS.kv].set = async () => { throw new Error('KV is down'); };
        const router = createStorageRouter({ backends });
        /* `waterTankUnit` since 27 August 2026: `steamStopMode` was retired when the Live
         * rail stopped keeping a copy of the steam stop mode, and a retired row makes the
         * router throw rather than reach a backend. Any machine-scoped KV key proves this
         * claim — that a rejected first store does not quietly land in a second. */
        const ok = await router.set('waterTankUnit', 'mL');
        assert.equal(ok, false, 'a rejected write must report false, not true');
        assert.equal(backends[LAYERS.local].writes.length, 0, 'the value fell back to localStorage');
        assert.equal(backends[LAYERS.session].writes.length, 0, 'the value fell back to sessionStorage');
    });

    test('a read consults ONE layer — there is no read-priority rule to invert', async () => {
        const backends = allBackends();
        // Both stores hold a value for the same logical key's physical spelling. Only the
        // routed one may be consulted: "two stores plus any read-priority rule equals a
        // path where a failed write wins".
        await backends[LAYERS.local].set(`${STORAGE_PREFIX}tempUnit`, 'F');
        await backends[LAYERS.kv].set('tempUnit', 'C');
        backends[LAYERS.local].calls.length = 0;
        backends[LAYERS.kv].calls.length = 0;
        const router = createStorageRouter({ backends });
        const value = await router.get('tempUnit');
        assert.equal(value, 'C', 'the routed layer must win — and be the only one read');
        assert.equal(backends[LAYERS.local].calls.length, 0, 'the unrouted layer was read');
    });
});

describe('3. scope decides layer', () => {
    test('machine-scoped settings live in ReaPrime KV', () => {
        for (const key of SETTINGS_KEYS) {
            const row = STORAGE_ROUTES[key];
            if (row.scope !== SCOPES.machine) continue;
            assert.ok([LAYERS.kv, LAYERS.kvNumpad].includes(row.layer), `${key}: machine-scoped but layer '${row.layer}'`);
        }
    });

    test('device-scoped preferences stay on the device', () => {
        for (const key of SETTINGS_KEYS) {
            const row = STORAGE_ROUTES[key];
            if (row.scope !== SCOPES.device) continue;
            assert.ok([LAYERS.local, LAYERS.session].includes(row.layer), `${key}: device-scoped but layer '${row.layer}'`);
        }
    });

    test('nothing shot-scoped reaches KV — a rating key would orphan forever', () => {
        // CB-11: deleting a shot does not cascade to its KV rating key. The row that
        // encodes the rule is `shotRating`, and it must stay unstored by Decal.
        for (const key of allKeys()) {
            const row = STORAGE_ROUTES[key];
            const shotShaped = /rating|shot/i.test(key);
            if (!shotShaped) continue;
            assert.notEqual(row.layer, LAYERS.kv, `${key}: shot-scoped data must never go to KV`);
            assert.notEqual(row.layer, LAYERS.kvNumpad, `${key}: shot-scoped data must never go to KV`);
        }
    });

    test('every gated key names a capability, and gating is declared not inferred', () => {
        const gated = gatedSettingsKeys();
        assert.ok(gated.size > 0, 'no capability-gated settings keys — A3 has nothing to gate');
        for (const [capability, keys] of gated) {
            assert.equal(typeof capability, 'string');
            assert.ok(keys.length > 0);
        }
    });
});

describe('4. A9/A10 — the namespace is the new skin\'s and nothing migrates', () => {
    test('the constants derive from the new skin id', () => {
        assert.equal(STORAGE_PREFIX, 'decal.');
        assert.equal(KV_NAMESPACE, 'decal');
        assert.equal(KV_NUMPAD_NAMESPACE, 'decal.numpad');
        assert.ok(IDB_DATABASE_NAME.startsWith('decal.'), IDB_DATABASE_NAME);
    });

    test('every physical key the router mints carries the new prefix, never the old', () => {
        const backends = allBackends();
        const router = createStorageRouter({ backends });
        for (const key of allKeys()) {
            const row = STORAGE_ROUTES[key];
            if (row.layer === LAYERS.none) continue;
            const physical = router.physicalKey(key, { field: 'dose' });
            assert.ok(!physical.startsWith('slate'), `${key} -> '${physical}' carries the old skin's namespace`);
            if ([LAYERS.local, LAYERS.session].includes(row.layer)) {
                assert.ok(physical.startsWith(STORAGE_PREFIX), `${key} -> '${physical}' is missing the '${STORAGE_PREFIX}' prefix`);
            } else {
                // KV identity is the NAMESPACE, so KV keys are deliberately unprefixed.
                assert.ok(!physical.startsWith(STORAGE_PREFIX), `${key} -> '${physical}' should not be prefixed on a KV layer`);
            }
        }
    });

    test('a caller passing an already-prefixed physical key is refused', async () => {
        const router = createStorageRouter({ backends: allBackends() });
        await assert.rejects(
            () => router.get(`${STORAGE_PREFIX}theme`),
            (error) => error.code === ERROR_CODES.PREFIXED_KEY,
        );
    });

    test('no live old-namespace literal survives anywhere in the shipped tree', () => {
        // Comments and the table's own `was:` / `trace:` fields name the old namespaces on
        // purpose — the record IS the deliverable (see scripts/lib/source-scan.js). So the
        // scan removes documentary text FIRST and asserts on what is left, rather than
        // grepping raw source and earning an exemption. An exemption is how coverage dies.
        const offenders = [];
        for (const file of shippedSources()) {
            const source = readFileSync(file, 'utf8');
            const code = stripDocumentary(source);
            const hit = code.match(/(['"`])slate(\.[A-Za-z0-9_.-]+)?\1/);
            if (hit) offenders.push(`${path.relative(REPO, file)}: ${hit[0]}`);
        }
        assert.deepEqual(offenders, [], `old-skin storage namespace reachable in code:\n${offenders.join('\n')}`);
    });

    test('the documentary-stripper actually strips — the canary for the check above', () => {
        // A scan that silently stops matching is this project's most expensive recurring
        // failure. Prove both directions on strings.
        assert.match(stripDocumentary("const NS = 'slate';"), /'slate'/, 'live code must survive the strip');
        assert.doesNotMatch(stripDocumentary("// the old 'slate' namespace"), /'slate'/, 'a comment must not');
        assert.doesNotMatch(stripDocumentary("    was: 'slate.theme',"), /'slate\.theme'/, 'a `was:` value must not');
        assert.doesNotMatch(stripDocumentary("    trace: 'old skin used \\'slate\\' here',"), /slate/, 'a `trace:` value must not');
    });
});

/** Remove comments and the two documentary row fields, leaving executable text. */
function stripDocumentary(source) {
    return source
        // `was:` / `trace:` values, single or double quoted, escaped quotes allowed.
        .replace(/\b(?:was|trace|why|meaning|action|note|notes|summary)\s*:\s*(['"])(?:\\.|(?!\1)[^\\])*\1/g, '$1$1')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')   // block comments
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments (not a protocol-relative URL)
}

/** Every JS/HTML file the browser actually loads. */
function shippedSources() {
    const out = [];
    const walk = (dir) => {
        for (const entry of readdirSync(dir)) {
            if (entry === 'node_modules' || entry.startsWith('.')) continue;
            const full = path.join(dir, entry);
            if (statSync(full).isDirectory()) walk(full);
            else if (/\.(js|mjs|html)$/.test(entry)) out.push(full);
        }
    };
    walk(path.join(REPO, 'src'));
    const index = path.join(REPO, 'index.html');
    try { statSync(index); out.push(index); } catch { /* no index.html yet */ }
    return out;
}
