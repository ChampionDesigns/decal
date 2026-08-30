// The B7 routing table, checked as data. If a row is malformed the router cannot enforce
// "one owner per setting", so these run before any behaviour test.
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

test('every row names exactly one layer, one scope, one status and a trace', () => {
    for (const key of allKeys()) {
        const row = STORAGE_ROUTES[key];
        assert.ok(Object.values(LAYERS).includes(row.layer), `${key}: bad layer ${row.layer}`);
        assert.ok(Object.values(SCOPES).includes(row.scope), `${key}: bad scope ${row.scope}`);
        assert.ok(Object.values(STATUSES).includes(row.status), `${key}: bad status ${row.status}`);
        assert.ok(row.why && row.why.length > 10, `${key}: no reason given`);
        assert.ok(row.trace && row.trace.length > 10, `${key}: no trace`);
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
    // The old skin had `PROFILE_FOLDER_PREF = 'slate.profileFoldersOpen'`: a physical key
    // used as a logical one, which is exactly how a prefix change desyncs half a tree.
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
    // SCOPE Part 3 §5: "Machine-scoped settings live in ReaPrime's KV store. Device-scoped
    // preferences live locally." The scope field is the reason; this asserts the reason
    // and the layer cannot drift apart.
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

test('the keys SCOPE Part 3 §5 names as wrongly local are machine-scoped or gone', () => {
    /* WHAT THE OLD SKIN GOT WRONG, AND WHAT THIS STILL HAS TO PROVE. SCOPE Part 3 §5 names
     * four keys the old skin kept in localStorage that describe the MACHINE, not the tablet,
     * so a tablet swap lost them. Three are in the KV store and the claim is unchanged.
     *
     * `steamStopMode` IS THE FOURTH AND IT IS RETIRED (27 August 2026), which is a stronger
     * answer than the one this test was written to check rather than a weaker one. The
     * finding was "this value survives the wrong thing"; the fix a year of work later is that
     * the skin does not store the value at all — how a machine stops steaming is derived from
     * the machine's own two fields by both surfaces that show it, so there is nothing to lose
     * on a tablet swap and nothing to disagree about either. The row still exists and still
     * carries the story; what it must NOT do is quietly come back as a local key, which is
     * what the second assertion pins. */
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

test('identity: prefix, KV namespace and IDB name all follow the manifest id (A9/A10)', () => {
    const manifest = JSON.parse(repoFile('skin-manifest.json'));
    assert.equal(manifest.id, 'decal');
    assert.equal(STORAGE_PREFIX, `${manifest.id}.`);
    assert.equal(KV_NAMESPACE, manifest.id);
    assert.equal(KV_NUMPAD_NAMESPACE, `${manifest.id}.numpad`);
    assert.equal(IDB_DATABASE_NAME, `${manifest.id}.shot_history`);
    // No migration (A10): the old skin's names must not appear anywhere in the table's
    // live half. `was:` fields record them for reviewers and are not physical keys.
    for (const key of allKeys()) {
        const row = STORAGE_ROUTES[key];
        if (row.layer === LAYERS.none) continue;
        assert.ok(!key.startsWith('slate'), `${key}: carries the old skin's name`);
    }
});

test('the pre-paint theme stamp in index.html uses the same prefix as the router', () => {
    // index.html hand-writes the prefix because nothing can be imported before first
    // paint (SCOPE Part 2 §6). It is the ONE copy, and this is its only enforcement:
    // in the old skin the same script bypassed the storage module entirely, so a prefix
    // change would silently desync the theme from everything else.
    const html = repoFile('index.html');
    const match = html.match(/var\s+PREFIX\s*=\s*'([^']+)'/);
    assert.ok(match, 'index.html should declare the prefix in its pre-paint stamp');
    assert.equal(match[1], STORAGE_PREFIX);
    assert.ok(html.includes("PREFIX + 'theme'"), 'the stamp should read the theme key through the prefix');
    assert.equal(STORAGE_ROUTES.theme.layer, LAYERS.local, 'and the router must agree the theme is local');
});

/* ---------------------------------------------------------------------- *
 * The stamp's OTHER end of the contract: the value encoding.
 *
 * The prefix is not the only thing the hand-written stamp has to keep in step with
 * the router. Web Storage holds strings, so the web-storage backend JSON-serialises
 * every value: after one theme write localStorage holds `"dark"` WITH the quotes. A
 * stamp that read it raw set data-theme='"dark"', matched no [data-theme="dark"]
 * selector, and the theme silently reverted on every boot — the exact desync the
 * stamp's own comment warns about. So this runs the REAL script text from index.html
 * against a store the REAL backend wrote, rather than restating either half.
 * ---------------------------------------------------------------------- */

/**
 * The theme stamp, out of index.html.
 *
 * SELECTED BY WHAT IT WRITES, not by being the only one. index.html carries a second
 * pre-paint script since the fit landed (src/lib/app-fit.js — it has the same "nothing
 * can be imported before first paint" reason and the same inline-copy hazard, and
 * test/app-fit.test.mjs pins it the same way). A count of one was the right assertion
 * while there was one; picking the block that stamps `data-theme` stays right however
 * many pre-paint scripts the file grows, and still fails loudly if the stamp is
 * deleted or split in two.
 */
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
    // createWebStorageBackend.get() warns and reports undefined for unparseable JSON.
    // Anything else here and the two ends disagree about what "no stored choice" is.
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
    // A stamp that emits a value no sheet selects is the same failure as emitting a
    // quoted one: the palette silently falls back to the bare :root block.
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
    // B7, one owner per key. `PROFILE_FOLDER_PREF = 'decal.profileFoldersOpen'` in
    // profile-folders.js was a second, hand-maintained copy of a key the table already
    // owned — and the router REJECTS a prefixed key, so a component importing it would
    // either throw or bypass the router entirely. Exactly the shape the old skin had.
    // index.html is the one sanctioned copy of the prefix and has its own test above.
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
