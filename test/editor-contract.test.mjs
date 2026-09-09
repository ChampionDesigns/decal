/**
 *.5, item contract-check-editor.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createProfileEditorStore } from '../src/stores/profile-editor-store.js';
import { REST_ROUTES, REST_ROUTE_BY_ID } from '../src/data/rea-routes.generated.js';
import { R2_INTERIM } from '../src/lib/editor-ranges.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const TABLE = JSON.parse(readFileSync(path.join(REPO, 'src/data/CONTRACTS.json'), 'utf8'));
/* THE PIN IS READ, NEVER RESTATED. A literal here is a second authority, and a
 * re-pin then leaves it asserting the commit the tree has moved off. */
import { PINNED_COMMIT as PIN } from '../scripts/lib/rea-source.js';

const ROW = (id) => TABLE.rest.find((r) => r.id === id) ?? null;
const GENERATED = (id) => REST_ROUTE_BY_ID[id] ?? null;

/** Every request the editor store makes, when every action is exercised once. */
async function exerciseEveryAction() {
    const seen = [];
    const record = {
        id: 'profile:seed', profile: { title: 'seed', steps: [] }, metadataHash: 'm',
        compoundHash: 'c', parentId: null, visibility: 'visible', isDefault: false,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', metadata: null,
    };
    const transport = {
        request: async (reqPath, options = {}) => {
            seen.push({ path: reqPath, method: options.method ?? 'GET', body: options.body ?? null });
            return { ok: true, status: 200, data: record, notModified: false };
        },
    };
    const store = createProfileEditorStore({ transport });
    store.open(record);
    await store.loadById('profile:seed');
    await store.saveAsNewVersion({ title: 'x', steps: [] });
    await store.saveMetadata({ folder: 'f' });
    await store.saveInPlace({ title: 'y', steps: [] });
    store.changeCount({ title: 'y', steps: [] });
    store.lineage();
    store.report();
    store.version();
    store.clearSave();
    store.close();
    store.stop();
    return seen;
}

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

describe('the editor touches four routes and every one has a row', () => {
    test('the recorded requests resolve to exactly the expected route ids', async () => {
        const seen = await exerciseEveryAction();
        const ids = [...new Set(seen.map(routeIdFor))];
        assert.ok(!ids.includes(null), `a request matched no generated route: ${JSON.stringify(seen)}`);
        assert.deepEqual(ids.sort(), ['getProfilesById', 'postProfiles', 'putProfilesById']);
    });

    const EDITOR_ROUTES = [
        ['getProfilesById', 'GET', '/api/v1/profiles/{id}', 'ProfileHandler._handleGetById'],
        ['postProfiles', 'POST', '/api/v1/profiles', 'ProfileHandler._handleCreate'],
        ['putProfilesById', 'PUT', '/api/v1/profiles/{id}', 'ProfileHandler._handleUpdate'],
        ['getProfilesByIdLineage', 'GET', '/api/v1/profiles/{id}/lineage', 'ProfileHandler._handleGetLineage'],
        ['getProfiles', 'GET', '/api/v1/profiles', 'ProfileHandler._handleGetAll'],
        ['postMachineProfile', 'POST', '/api/v1/machine/profile', 'De1Handler._profileHandler'],
    ];

    for (const [id, verb, routePath, symbol] of EDITOR_ROUTES) {
        test(`${id} — row present, checked at the pin, agreeing with the generated table`, () => {
            const row = ROW(id);
            assert.ok(row, `${id} has no contract row`);
            assert.equal(row.verb, verb);
            assert.equal(row.path, routePath);
            assert.equal(row.handlerSymbol, symbol);
            assert.equal(row.handlerFile.endsWith('.dart'), true);
            assert.equal(row.checkedCommit, PIN);
            assert.ok(row.responseShape.length > 0);

            const generated = GENERATED(id);
            assert.ok(generated, `${id} is not in the generated table`);
            assert.equal(generated.method, verb);
            assert.equal(generated.path, routePath);
        });
    }

    test('the three the editor calls name this store as a consumer', () => {
        for (const id of ['getProfilesById', 'postProfiles', 'putProfilesById']) {
            const row = ROW(id);
            assert.equal(row.status, 'consumed');
            assert.ok(row.consumedBy.some((c) => c.includes('profile-editor-store.js')),
                `${id}: consumedBy does not name the editor store`);
        }
    });

    test('the request body fields the editor sends are the fields the row declares', async () => {
        const seen = await exerciseEveryAction();
        for (const call of seen) {
            const id = routeIdFor(call);
            if (call.body === null) continue;
            const declared = Object.keys(ROW(id).requestFields.body ?? {});
            for (const key of Object.keys(call.body)) {
                assert.ok(declared.includes(key),
                    `${id}: sent "${key}", which the row does not declare (declared: ${declared.join(', ')})`);
            }
        }
    });

    test('the wrapped/bare asymmetry holds — POST /profiles wraps, the arm route does not', async () => {
        const seen = await exerciseEveryAction();
        const create = seen.find((c) => routeIdFor(c) === 'postProfiles');
        assert.ok(create.body.profile, 'the create body must wrap the profile');
        assert.ok(!create.body.steps, 'a bare profile here would be the shape-asymmetry bug');
    });
});

describe('B10/B11 — the gates the editor was built against are on the rows', () => {
    const gatesOf = (id) => (ROW(id).gates ?? []).map((g) => g.kind);

    test('postProfiles carries the four save gates', () => {
        const kinds = gatesOf('postProfiles');
        for (const kind of ['wrapped-body', 'parent-must-exist',
            'content-addressed-idempotent-create', 'id-covers-content-only']) {
            assert.ok(kinds.includes(kind), `postProfiles is missing the "${kind}" gate`);
        }
    });

    test('the idempotent-create gate says a 201 does not mean created', () => {
        const gate = ROW('postProfiles').gates.find((g) => g.kind === 'content-addressed-idempotent-create');
        assert.match(gate.action, /201 DOES NOT MEAN CREATED/);
        assert.match(gate.meaning, /RETURNS THE EXISTING RECORD/);
    });

    test('putProfilesById carries the gate that a hash change deletes the old record', () => {
        const kinds = gatesOf('putProfilesById');
        assert.ok(kinds.includes('hash-change-deletes-the-old-record'));
        const gate = ROW('putProfilesById').gates.find((g) => g.kind === 'hash-change-deletes-the-old-record');
        assert.match(gate.action, /DOES NOT KEEP THE OLD VERSION/);
    });

    test('getProfilesById carries the only reachable profile 404 — the lineage 404 is dead', () => {
        assert.ok(gatesOf('getProfilesById').includes('404-means-missing-here'));
        assert.ok(gatesOf('getProfilesByIdLineage').includes('missing-id-is-500-not-404'));
        assert.ok(!gatesOf('getProfilesByIdLineage').includes('404-means-empty-not-missing'),
            'the gate that told a caller to read a lineage 404 as “no other versions” is back');
        assert.match(ROW('getProfilesByIdLineage').responseShape, /NEVER EMPTY/);
        assert.match(ROW('getProfilesByIdLineage').responseShape, /NO REACHABLE 404/);
    });

    test('the id-covers-content-only gate is a FACT about the server, not a rule in the client', () => {
        const gate = ROW('postProfiles').gates.find((g) => g.kind === 'id-covers-content-only');
        assert.match(gate.action, /never transcribed into the client/);
        // No module under the editor's save path re-implements the split.
        assert.match(gate.action, /duplicating this split is the defect/);
    });
});

describe('R2’s route does not exist and the table records the absence', () => {
    test('no rest row claims a limits endpoint', () => {
        for (const row of TABLE.rest) {
            assert.ok(!/limit|envelope|constraint/i.test(row.path),
                `${row.id} claims a limits route that ReaPrime does not serve at the pin`);
        }
    });

    test('the absence is an entry with a basis and a pin, not a stub', () => {
        assert.ok(Array.isArray(TABLE.absentRoutes));
        const r2 = TABLE.absentRoutes.find((e) => e.wanted.startsWith('R2'));
        assert.ok(r2, 'R2 is not recorded as an absent route');
        assert.equal(r2.servedAt, null);
        assert.equal(r2.checkedCommit, PIN);
        /* THE SWEEP'S RESULT, RE-ATTESTED AT THE RE-PIN. The basis used to read "ZERO
         * whose path matches"; the re-count says the same thing in the app's own terms
         * and the terms are what is pinned here, not the sentence. Reproduced against
         * the worktree while re-pinning: 149 registrations (140 at the old pin) —
         * 62 GET / 46 POST / 24 PUT / 16 DELETE / 1 OPTIONS over 106 distinct paths —
         * and still not one that serves a bound. Both halves of the claim are asserted,
         * so a basis that quietly drops the /ws/v1 sweep fails here. */
        assert.match(r2.basis, /NONE matches limit\|range\|bound\|envelope\|constraint/);
        assert.match(r2.basis, /no \/api\/v1 or \/ws\/v1 string literal anywhere in lib\/ does either/);
        assert.match(r2.basis, /149 app\.get\|put\|post\|delete\|options/);
        assert.match(r2.policy, /NO STUB, NO ROW/);
    });

    test('the module and the table agree that R2 has not landed', () => {
        assert.equal(R2_INTERIM.landed, false);
        assert.equal(R2_INTERIM.checkedCommit, TABLE.absentRoutes.find((e) => e.wanted.startsWith('R2')).checkedCommit);
    });

    test('the table is still pinned where the rows say it is', () => {
        assert.equal(TABLE.pinnedCommit, PIN);
        for (const row of TABLE.rest) assert.equal(row.checkedCommit, PIN, `${row.id} drifted off the pin`);
    });
});
