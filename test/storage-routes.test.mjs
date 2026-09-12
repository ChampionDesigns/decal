
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

import { createWebStorageBackend } from '../src/lib/storage-backends.js';
import {
    STORAGE_ROUTES,
    STORAGE_PREFIX,
    KV_NAMESPACE,
    KV_NUMPAD_NAMESPACE,
    KV_NAMESPACES,
    IDB_DATABASE_NAME,
    LAYERS,
    SCOPES,
    STATUSES,
    PREFIXED_LAYERS,
    routeFor,
    allKeys,
    expandTemplate,
} from '../src/lib/storage-routes.js';

const repoFile = (rel) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

/** Every .js file under a directory, recursively. */
function walk(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) return walk(path);
        return entry.isFile() && path.endsWith('.js') ? [path] : [];
    });
}

test('every row names exactly one layer, one scope, one status and a reason', () => {
    for (const key of allKeys()) {
        const row = STORAGE_ROUTES[key];
        assert.ok(Object.values(LAYERS).includes(row.layer), `${key}: bad layer ${row.layer}`);
        assert.ok(Object.values(SCOPES).includes(row.scope), `${key}: bad scope ${row.scope}`);
        assert.ok(Object.values(STATUSES).includes(row.status), `${key}: bad status ${row.status}`);
        assert.ok(row.why && row.why.length > 10, `${key}: no reason given`);
    }
});

test('a row that is not ours names the owner instead — that is the whole point of a none row', () => {
    const none = allKeys().filter((key) => STORAGE_ROUTES[key].layer === LAYERS.none);
    assert.ok(none.length > 0, 'the table should record what Decal deliberately does not store');
    for (const key of none) {
        assert.ok(STORAGE_ROUTES[key].owner, `${key}: layer 'none' with no owner`);
    }
});

test('a routed row never carries an owner — one owner per key, and it is us', () => {
    for (const key of allKeys()) {
        const row = STORAGE_ROUTES[key];
        if (row.layer !== LAYERS.none) {
            assert.equal(row.owner, undefined, `${key}: routed to '${row.layer}' but also claims an external owner`);
        }
    }
});

test('no logical key carries the physical prefix — the router owns prefixing', () => {
    for (const key of allKeys()) {
        assert.ok(!key.startsWith(STORAGE_PREFIX), `${key}: logical keys are unprefixed`);
    }
});

test('two rows never collide on one physical key within one layer', () => {
    const seen = new Map();
    for (const key of allKeys()) {
        const row = STORAGE_ROUTES[key];
        if (row.layer === LAYERS.none) continue;
        const physical = `${row.layer}::${row.template || key}`;
        assert.equal(seen.get(physical), undefined, `${key} collides with ${seen.get(physical)} at ${physical}`);
        seen.set(physical, key);
    }
});

test('machine-scoped rows live in ReaPrime KV, device-scoped rows live locally', () => {
    for (const key of allKeys()) {
        const { layer, scope } = STORAGE_ROUTES[key];
        if (layer === LAYERS.kv || layer === LAYERS.kvNumpad) {
            assert.equal(scope, SCOPES.machine, `${key}: in KV but not machine-scoped`);
        }
        if (layer === LAYERS.local) assert.equal(scope, SCOPES.device, `${key}: local but not device-scoped`);
        if (layer === LAYERS.session) assert.equal(scope, SCOPES.ephemeral, `${key}: session but not ephemeral`);
        if (layer === LAYERS.none) assert.equal(scope, SCOPES.external, `${key}: unrouted but not external`);
    }
});

test('the keys named as wrongly local are machine-scoped or gone', () => {
    for (const key of ['waterTankUnit', 'experimentalFusedChannels', 'experimentalCollapseDetection']) {
        assert.equal(STORAGE_ROUTES[key].layer, LAYERS.kv, `${key} should be in the KV store`);
    }
    const retired = STORAGE_ROUTES.steamStopMode;
    assert.equal(retired.layer, LAYERS.none, 'steamStopMode is retired — Decal stores no copy of it');
    assert.ok(retired.owner, 'a retired row names who owns the value instead');
    assert.match(retired.owner, /workflow/, 'and it is ReaPrime\'s workflow document');
});

test('shot-scoped data has no row in any store — it belongs to its shot', () => {
    const row = STORAGE_ROUTES.shotRating;
    assert.equal(row.layer, LAYERS.none);
    assert.match(row.owner, /ShotAnnotations|enjoyment/);
    assert.match(row.owner, /shots/);
});

test('the temperature unit has exactly one home', () => {
    // The dual-write (localStorage + IDB, read IDB first) is the proven silent-revert bug.
    const row = STORAGE_ROUTES.tempUnit;
    assert.equal(row.layer, LAYERS.kv);
    assert.ok(!('layers' in row), 'a row cannot name more than one layer');
});

test('KV namespaces derive from the skin id and are the only two we own', () => {
    assert.equal(KV_NAMESPACE, 'decal');
    assert.equal(KV_NUMPAD_NAMESPACE, 'decal.numpad');
    assert.deepEqual(Object.keys(KV_NAMESPACES).sort(), ['kv', 'kvNumpad']);
    // Another product's namespace is not ours to write.
    assert.equal(STORAGE_ROUTES.dye2Recipes.layer, LAYERS.none);
    assert.match(STORAGE_ROUTES.dye2Recipes.owner, /dye2\.reaplugin/);
});

test('the skin id in the manifest is decal', () => {
    assert.equal(JSON.parse(repoFile('skin-manifest.json')).id, 'decal');
});

test('identity: prefix, KV namespace and IDB name all follow the manifest id (A9/A10)', () => {
    const manifest = JSON.parse(repoFile('skin-manifest.json'));
    assert.equal(manifest.id, 'decal');
    assert.equal(STORAGE_PREFIX, `${manifest.id}.`);
    assert.equal(KV_NAMESPACE, manifest.id);
    assert.equal(KV_NUMPAD_NAMESPACE, `${manifest.id}.numpad`);
    assert.equal(IDB_DATABASE_NAME, `${manifest.id}.shot_history`);
    for (const key of allKeys()) {
        const row = STORAGE_ROUTES[key];
        if (row.layer === LAYERS.none) continue;
        assert.ok(!key.startsWith('slate'), `${key}: carries the old skin's name`);
    }
});

test('the pre-paint theme stamp in index.html uses the same prefix as the router', () => {
    const html = repoFile('index.html');
    const match = html.match(/var\s+PREFIX\s*=\s*'([^']+)'/);
    assert.ok(match, 'index.html should declare the prefix in its pre-paint stamp');
    assert.equal(match[1], STORAGE_PREFIX);
    assert.ok(html.includes("PREFIX + 'theme'"), 'the stamp should read the theme key through the prefix');
    assert.equal(STORAGE_ROUTES.theme.layer, LAYERS.local, 'and the router must agree the theme is local');
});

function preePaintStamp() {
    const html = repoFile('index.html');
    const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
        .map((m) => m[1])
        .filter((source) => source.includes('data-theme'));
    assert.equal(blocks.length, 1,
        'index.html should carry exactly one inline script that stamps data-theme');
    return blocks[0];
}

/** Run the stamp with a given localStorage, and report what it stamped. */
function runStamp(storage) {
    let stamped;
    const context = createContext({
        localStorage: storage,
        document: {
            documentElement: {
                setAttribute(name, value) {
                    assert.equal(name, 'data-theme');
                    stamped = value;
                },
            },
        },
    });
    runInContext(preePaintStamp(), context);
    return stamped;
}

/** A Web Storage double, exactly the shape createWebStorageBackend expects. */
function fakeWebStorage(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, v),
        removeItem: (k) => map.delete(k),
        raw: map,
    };
}

test('the pre-paint stamp reads back what the storage backend actually wrote', () => {
    const storage = fakeWebStorage();
    const backend = createWebStorageBackend({ storage, label: 'localStorage' });
    const physical = STORAGE_PREFIX + 'theme';

    backend.set(physical, 'light');
    assert.equal(storage.raw.get(physical), '"light"', 'the backend serialises — this is the trap');
    assert.equal(runStamp(storage), 'light', 'the stamp must decode the backend\'s encoding');

    backend.set(physical, 'dark');
    assert.equal(runStamp(storage), 'dark');
});

test('the stamp defaults to dark when nothing is stored, and never writes (bug S11)', () => {
    const storage = fakeWebStorage();
    assert.equal(runStamp(storage), 'dark');
    assert.equal(storage.raw.size, 0, 'a first run must stay distinguishable from a deliberate choice');
});

test('the stamp treats a corrupt value as absent, exactly as the backend does', () => {
    for (const corrupt of ['{not json', '"', 'dark', '', '{"a":1}', '17', 'null']) {
        const storage = fakeWebStorage({ [STORAGE_PREFIX + 'theme']: corrupt });
        const backend = createWebStorageBackend({ storage, label: 'localStorage' });
        const read = backend.get(STORAGE_PREFIX + 'theme');
        const stamped = runStamp(storage);
        if (typeof read === 'string' && read !== '') {
            assert.equal(stamped, read, `stamp and backend disagree on ${JSON.stringify(corrupt)}`);
        } else {
            assert.equal(stamped, 'dark', `${JSON.stringify(corrupt)} should stamp the default`);
        }
    }
});

test('a store that throws leaves the stamp on the default rather than unhandled', () => {
    const hostile = { getItem() { throw new Error('SecurityError'); } };
    assert.equal(runStamp(hostile), 'dark');
});

test('the themes the stamp can produce are the themes the sheets define', () => {
    const tokens = repoFile('styles/tokens.css');
    const channels = repoFile('styles/chart-channels.css');
    const storage = fakeWebStorage();
    const backend = createWebStorageBackend({ storage, label: 'localStorage' });
    backend.set(STORAGE_PREFIX + 'theme', 'dark');
    const stamped = runStamp(storage);
    assert.ok(tokens.includes(`[data-theme="${stamped}"]`), `tokens.css has no [data-theme="${stamped}"]`);
    assert.ok(channels.includes(`[data-theme="${stamped}"]`), `chart-channels.css has no [data-theme="${stamped}"]`);
});

test('nothing under src/ hand-writes a prefixed physical key — the table owns them', () => {
    const stripComments = (source) => source
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    const offenders = [];
    for (const file of walk(fileURLToPath(new URL('../src', import.meta.url)))) {
        if (file.endsWith('/storage-routes.js')) continue; // the owner
        const hits = stripComments(readFileSync(file, 'utf8'))
            .match(new RegExp(`['"\`]${STORAGE_PREFIX.replace('.', '\\.')}[A-Za-z]`, 'g'));
        if (hits) offenders.push(`${file}: ${hits.join(', ')}`);
    }
    assert.deepEqual(offenders, [], 'pass the LOGICAL key to the router; it adds the prefix');
});

test('routeFor answers only for rows that exist', () => {
    assert.equal(routeFor('theme').layer, LAYERS.local);
    assert.equal(routeFor('nothingLikeThis'), undefined);
    assert.equal(routeFor(''), undefined);
    assert.equal(routeFor(null), undefined);
});

test('key families interpolate, and refuse to guess a missing parameter', () => {
    assert.equal(expandTemplate('previous-values-{field}', { field: 'temp' }), 'previous-values-temp');
    assert.throws(() => expandTemplate('previous-values-{field}', {}), /missing template parameter 'field'/);
    assert.throws(() => expandTemplate('previous-values-{field}', { field: '' }), /missing template parameter/);
});

test('the table is frozen — a row cannot be edited at runtime', () => {
    assert.throws(() => { STORAGE_ROUTES.theme.layer = LAYERS.kv; }, TypeError);
    assert.throws(() => { STORAGE_ROUTES.newKey = { layer: LAYERS.local }; }, TypeError);
    assert.equal(STORAGE_ROUTES.theme.layer, LAYERS.local);
});

test('prefixed layers are browser storage only — KV identity is the namespace', () => {
    assert.deepEqual([...PREFIXED_LAYERS], [LAYERS.local, LAYERS.session]);
});
