// The conditional-route registry, re-derived from ReaPrime's handlers.
//
// Same discipline as test/rea-names.test.mjs: the registry is not trusted because it was
// written carefully, it is checked against the source it claims to describe. If upstream
// adds a `jsonOkConditional` call site — or removes one — this turns red on the next run
// rather than quietly costing bandwidth on every list read for months, which is exactly
// what happened the other way round (the server has served ETags all along and the skin
// never sent a single If-None-Match).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
    CONDITIONAL_ROUTES,
    NON_CONDITIONAL_SHOT_READS,
    isConditionalRoute,
    shotsListIsConditional,
    createEtagStore,
} from '../src/data/rea-conditional.js';
import { REA_ROOT, PINNED_COMMIT, resolveCommit } from '../scripts/generate-machine-state.js';

const read = (rel) => {
    const path = join(REA_ROOT, rel);
    assert.ok(existsSync(path), `ReaPrime source missing: ${path} (set REA_ROOT)`);
    return readFileSync(path, 'utf8');
};

const WEBSERVER = 'lib/src/services/webserver';

describe('the registry matches ReaPrime at the pinned commit', () => {
    test('the pinned worktree is the one every contract entry stamps', () => {
        assert.equal(resolveCommit({ require: true }), PINNED_COMMIT);
    });

    test('jsonOkConditional still does what the registry assumes', () => {
        const source = read(`${WEBSERVER}/json_response.dart`);
        assert.match(source, /Response jsonOkConditional\(Request request, Object\? data\)/);
        // Strong ETag, quoted, content-hashed; verbatim comparison; '*' always matches.
        assert.match(source, /final etag = '"\$digest"';/);
        assert.match(source, /ifNoneMatch == '\*' \|\| ifNoneMatch == etag/);
        assert.match(source, /Response\.notModified\(headers: \{'ETag': etag\}\)/);
        assert.ok(!source.includes("'W/"), 'a weak ETag would change the comparison rules');
    });

    test('every jsonOkConditional call site is a registry row, and vice versa', () => {
        const files = [...new Set(CONDITIONAL_ROUTES.map((r) => r.handlerFile))];
        const expected = new Map();
        for (const route of CONDITIONAL_ROUTES) {
            expected.set(route.handlerFile, (expected.get(route.handlerFile) || 0) + route.callSites);
        }

        // Every handler in the directory, so a NEW conditional handler cannot hide.
        const all = read(`${WEBSERVER}/json_response.dart`);
        assert.ok(all.includes('jsonOkConditional'), 'sanity: the helper exists');

        const found = new Map();
        for (const rel of handlerFiles()) {
            const source = read(rel);
            const count = (source.match(/jsonOkConditional\(/g) || []).length
                - (rel.endsWith('json_response.dart') ? 1 : 0); // the definition itself
            if (count > 0) found.set(rel, count);
        }

        assert.deepEqual(
            [...found.entries()].sort(),
            [...expected.entries()].sort(),
            'conditional handlers drifted — re-derive CONDITIONAL_ROUTES from the handlers',
        );
        assert.equal([...found.values()].reduce((a, b) => a + b, 0), 7);
        assert.equal(files.length, 5);
    });

    test('the three non-conditional shots reads are still plain jsonOk', () => {
        const source = read(`${WEBSERVER}/shots_handler.dart`);
        for (const symbol of ['_getShot(', '_getLatestShot(', '_getIds(']) {
            const body = methodBody(source, `Future<Response> ${symbol}`);
            assert.ok(body.includes('jsonOk('), `${symbol} should answer with jsonOk`);
            assert.ok(!body.includes('jsonOkConditional('), `${symbol} became conditional — the IDB mirror's justification moved`);
        }
        assert.equal(NON_CONDITIONAL_SHOT_READS.length, 4);
    });

    test('the shots filter list is the handler\'s own', () => {
        const source = read(`${WEBSERVER}/shots_handler.dart`);
        const body = methodBody(source, 'Future<Response> _getShots(');
        const hasFilters = body.slice(body.indexOf('final hasFilters ='), body.indexOf('if (ids != null'));
        for (const param of ['grinderId', 'grinderModel', 'beanId', 'beanBatchId', 'coffeeName', 'coffeeRoaster', 'profileTitle', 'search']) {
            assert.ok(hasFilters.includes(param), `hasFilters no longer includes ${param}`);
        }
    });

    test('the KV list is conditional only with full=1', () => {
        const source = read(`${WEBSERVER}/kv_store_handler.dart`);
        assert.match(source, /queryParameters\['full'\] == '1'\)\s*\{\s*return jsonOkConditional/);
    });
});

function handlerFiles() {
    // The five cited files plus every other handler that could gain a call site.
    return [
        'json_response.dart', 'shots_handler.dart', 'profile_handler.dart', 'beans_handler.dart',
        'grinders_handler.dart', 'kv_store_handler.dart', 'de1handler.dart', 'settings_handler.dart',
        'workflow_handler.dart', 'devices_handler.dart', 'sensors_handler.dart', 'scale_handler.dart',
        'steams_handler.dart', 'presence_handler.dart', 'display_handler.dart', 'update_handler.dart',
        'plugins_handler.dart', 'info_handler.dart',
    ].map((f) => `${WEBSERVER}/${f}`);
}

/** Body of a Dart method by brace matching. */
function methodBody(source, signature) {
    const at = source.indexOf(signature);
    assert.ok(at >= 0, `signature not found: ${signature}`);
    const open = source.indexOf('{', at);
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
        if (source[i] === '{') depth += 1;
        else if (source[i] === '}') {
            depth -= 1;
            if (depth === 0) return source.slice(open + 1, i);
        }
    }
    throw new Error(`unbalanced braces after ${signature}`);
}

describe('isConditionalRoute', () => {
    test('the five plain list routes', () => {
        assert.equal(isConditionalRoute('/profiles'), true);
        assert.equal(isConditionalRoute('/beans'), true);
        assert.equal(isConditionalRoute('/beans/kenya-2026/batches'), true);
        assert.equal(isConditionalRoute('/grinders'), true);
        assert.equal(isConditionalRoute('/shots'), true);
    });

    test('the asymmetric shots reads are not', () => {
        assert.equal(isConditionalRoute('/shots/2026-08-17T09:14:22Z'), false);
        assert.equal(isConditionalRoute('/shots/latest'), false);
        assert.equal(isConditionalRoute('/shots/ids'), false);
    });

    test('KV only with full=1', () => {
        assert.equal(isConditionalRoute('/store/decal'), false);
        assert.equal(isConditionalRoute('/store/decal', { full: '1' }), true);
        assert.equal(isConditionalRoute('/store/decal', { full: 1 }), true);
        assert.equal(isConditionalRoute('/store/decal/a-key', { full: '1' }), false);
    });

    test('unregistered routes are not', () => {
        assert.equal(isConditionalRoute('/machine/settings'), false);
        assert.equal(isConditionalRoute('/settings'), false);
        assert.equal(isConditionalRoute('/workflow'), false);
    });

    test('shotsListIsConditional follows the handler\'s branch', () => {
        assert.equal(shotsListIsConditional({}), true);
        assert.equal(shotsListIsConditional({ limit: 20, offset: 40 }), true);
        assert.equal(shotsListIsConditional({ ids: 'a,b' }), false);
        assert.equal(shotsListIsConditional({ ids: ['a', 'b'] }), false);
        assert.equal(shotsListIsConditional({ ids: '' }), true, 'an empty ids list falls through to the paginated branch');
        assert.equal(shotsListIsConditional({ ids: 'a', search: 'x' }), true, 'a filter takes the paginated branch');
    });
});

describe('the ETag store', () => {
    test('stores, returns and forgets', () => {
        const store = createEtagStore();
        store.set('GET /profiles', '"a"', [1]);
        assert.deepEqual(store.get('GET /profiles'), { etag: '"a"', data: [1] });
        store.forget('GET /profiles');
        assert.equal(store.get('GET /profiles'), null);
    });

    test('ignores an empty etag rather than storing a body it cannot revalidate', () => {
        const store = createEtagStore();
        store.set('GET /profiles', '', [1]);
        store.set('GET /beans', null, [2]);
        assert.equal(store.size, 0);
    });

    test('is bounded, evicting least-recently-read first', () => {
        const store = createEtagStore({ max: 2 });
        store.set('a', '"1"', 1);
        store.set('b', '"2"', 2);
        store.get('a');            // a is now the most recent
        store.set('c', '"3"', 3);  // evicts b
        assert.deepEqual(store.keys(), ['a', 'c']);
        assert.equal(store.get('b'), null);
    });

    test('clear drops everything', () => {
        const store = createEtagStore();
        store.set('a', '"1"', 1);
        store.clear();
        assert.equal(store.size, 0);
    });
});
