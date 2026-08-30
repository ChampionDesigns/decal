/**
 * editor-save-semantics.test.mjs — wave 5.5, items `save-semantics` (B10/R8) and
 * `profile-versions` (B11).
 *
 * THE DATA IS THE RECORDED LISTING. 147 real ProfileRecords, every one carrying
 * `metadataHash` and `compoundHash`, and a real parent chain among them — so "the lineage
 * fields surface unmodified" is a claim about what the machine actually serves rather than
 * about a pair of rows a test wrote.
 *
 * TWO TRANSPORTS, ON PURPOSE:
 *   * the OFFLINE MOCK proves the REQUEST and the REFUSAL. `tools/mock_rea.py` answers
 *     every mutating verb from the contract table and never forwards; both save routes
 *     return a typed ProfileRecord document, which is not synthesizable, so both are 501.
 *     That is a property worth pinning — a mock that invented a ProfileRecord would teach
 *     the client a server that does not exist.
 *   * a STUBBED transport proves the success path, because there is no offline success
 *     path to prove it against.
 *
 * A8: every assertion is about a returned value. Nothing reads a source file.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    createProfileEditorStore, SAVE_STATUS, EDITOR_LOAD_STATUS,
} from '../src/stores/profile-editor-store.js';
import {
    changeCountOf, headerCommitFor, saveReportFrom, saveFailureFrom,
    CHANGE_TELL, OUTCOME_SOURCE, PROFILE_RECORD_KEYS,
    commitPlan, COMMIT_GESTURE, SAVE_OPERATION,
} from '../src/lib/editor-commit.js';
import {
    lineageFactsOf, versionKeptBy, versionNoteFacts, VERSION_KEPT, SAVE_INTENT,
} from '../src/lib/profile-lineage.js';
import { sanitizeProfileForRea, profileCreateBody, profileUpdateBody, profileArmBody }
    from '../src/data/rea-profile.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const FIXTURE = JSON.parse(readFileSync(
    path.join(REPO, 'tools/rea-fixtures/api__v1__profiles~includeHidden=true.json'), 'utf8',
));

/** A transport that records every call and answers from a scripted map. */
function recordingTransport(script = {}) {
    const calls = [];
    return {
        calls,
        request: async (reqPath, options = {}) => {
            const method = options.method ?? 'GET';
            calls.push({ path: reqPath, method, body: options.body ?? null });
            const answer = script[`${method} ${reqPath}`] ?? script[reqPath];
            if (typeof answer === 'function') return answer(options);
            if (answer) return answer;
            return { ok: false, kind: 'http', status: 503, message: 'no recording', problem: null };
        },
    };
}

const ok = (data, status = 200) => ({ ok: true, status, data, notModified: false });
const refused = (message) => ({
    ok: false, kind: 'http', status: 400, message,
    problem: { error: 'Invalid request', message },
});

const PARENTED = FIXTURE.find((r) => typeof r.parentId === 'string' && r.parentId);
const PLAIN = FIXTURE.find((r) => !r.parentId);
const PATH_OF = (id) => `/profiles/${encodeURIComponent(id)}`;

/** A record built from a fixture one, so every key is a real server-issued shape. */
function recordLike(base, overrides = {}) {
    return { ...structuredClone(base), ...overrides };
}

describe('the fixture carries B11’s raw material already', () => {
    test('every one of the 147 records carries both hashes', () => {
        assert.equal(FIXTURE.length, 147);
        for (const record of FIXTURE) {
            assert.equal(typeof record.metadataHash, 'string');
            assert.equal(typeof record.compoundHash, 'string');
        }
    });

    test('a real parent chain exists — no lineage needs inventing', () => {
        const parented = FIXTURE.filter((r) => typeof r.parentId === 'string' && r.parentId);
        assert.ok(parented.length > 0, 'no record carries a parentId');
        assert.ok(PARENTED && PLAIN);
    });

    test('the record shape is the ten keys the report reads', () => {
        for (const key of PROFILE_RECORD_KEYS) {
            assert.ok(Object.hasOwn(FIXTURE[0], key), `served record has no "${key}"`);
        }
    });

    test('and NOT an eleventh saying what a save did — that absence is R8', () => {
        const extra = Object.keys(FIXTURE[0]).filter((k) => !PROFILE_RECORD_KEYS.includes(k));
        assert.deepEqual(extra, [], `the served record grew ${extra.join(', ')} — R8 may have landed`);
    });
});

describe('B11 — the lineage fields surface unmodified', () => {
    test('every field comes back exactly as the server issued it', () => {
        const facts = lineageFactsOf(PARENTED);
        assert.equal(facts.known, true);
        assert.equal(facts.id, PARENTED.id);
        assert.equal(facts.parentId, PARENTED.parentId);
        assert.equal(facts.hasParent, true);
        assert.equal(facts.metadataHash, PARENTED.metadataHash);
        assert.equal(facts.compoundHash, PARENTED.compoundHash);
        assert.equal(facts.createdAt, PARENTED.createdAt);
        assert.equal(facts.updatedAt, PARENTED.updatedAt);
    });

    test('a record with no parent says so rather than inventing one', () => {
        const facts = lineageFactsOf(PLAIN);
        assert.equal(facts.parentId, null);
        assert.equal(facts.hasParent, false);
    });

    test('nothing readable at all is `known: false`, not an empty-looking record', () => {
        assert.equal(lineageFactsOf(null).known, false);
        assert.equal(lineageFactsOf('profile:abc').known, false);
    });

    test('the facts are frozen — a surface cannot edit the server’s answer', () => {
        assert.ok(Object.isFrozen(lineageFactsOf(PARENTED)));
    });
});

describe('B11 — what became of the previous version, and on which route', () => {
    const previous = recordLike(PLAIN, { id: 'profile:old' });

    test('a parentId pointing at the loaded record IS the server keeping it', () => {
        const saved = recordLike(PLAIN, { id: 'profile:new', parentId: 'profile:old' });
        const answer = versionKeptBy(saved, { previous, intent: SAVE_INTENT.NEW_VERSION });
        assert.equal(answer.kept, VERSION_KEPT.LINKED);
        assert.equal(answer.previousId, 'profile:old');
        assert.equal(answer.savedId, 'profile:new');
        assert.match(answer.basis, /ReaPrime stored the link itself/);
    });

    test('an unchanged id is one record updated in place, not a kept version', () => {
        const saved = recordLike(PLAIN, { id: 'profile:old', parentId: null });
        const answer = versionKeptBy(saved, { previous, intent: SAVE_INTENT.METADATA_ONLY });
        assert.equal(answer.kept, VERSION_KEPT.SAME_RECORD);
        assert.match(answer.basis, /no second version to keep/);
    });

    test('a PUT that moved the id did NOT keep the old version, and says which handler', () => {
        const saved = recordLike(PLAIN, { id: 'profile:moved', parentId: null });
        const answer = versionKeptBy(saved, { previous, intent: SAVE_INTENT.IN_PLACE });
        assert.equal(answer.kept, VERSION_KEPT.NOT_LINKED);
        assert.match(answer.basis, /deletes the previous record/);
    });

    test('no pair of ids to compare is UNKNOWN — the editor says it does not know', () => {
        assert.equal(versionKeptBy(null, { previous }).kept, VERSION_KEPT.UNKNOWN);
        assert.equal(versionKeptBy(recordLike(PLAIN), {}).kept, VERSION_KEPT.UNKNOWN);
    });

    test('only the linked case lets the editor say the old version is kept', () => {
        const linked = versionNoteFacts(
            recordLike(PLAIN, { id: 'profile:new', parentId: 'profile:old' }),
            { previous, intent: SAVE_INTENT.NEW_VERSION },
        );
        assert.equal(linked.saysOldVersionKept, true);
        for (const intent of [SAVE_INTENT.IN_PLACE, SAVE_INTENT.METADATA_ONLY]) {
            const other = versionNoteFacts(recordLike(PLAIN, { id: 'profile:moved' }), { previous, intent });
            assert.equal(other.saysOldVersionKept, false);
        }
    });

    test('the versions ENTRY POINT stays the selector’s — no second one here', () => {
        const facts = versionNoteFacts(recordLike(PLAIN), { previous });
        assert.match(facts.entryPoint.owner, /selector/);
        assert.equal(facts.entryPoint.route, 'getProfilesByIdLineage');
        assert.equal(facts.entryPoint.store, 'src/stores/profile-library-store.js versionsOf()');
    });
});

describe('B10 — the dirty-state truth table, including cannot-tell', () => {
    const baseline = Object.freeze({
        title: 'Londinium', notes: '', author: 'Decent', beverage_type: 'espresso', version: '2',
        target_volume: 36, target_weight: 36, target_volume_count_start: 0, tank_temperature: 0,
        steps: [{ name: 'fill', pump: 'flow', flow: 8, seconds: 4 },
            { name: 'infuse', pump: 'pressure', pressure: 3, seconds: 30 }],
    });
    const draft = (over) => ({ ...structuredClone(baseline), ...over });

    const CASES = [
        ['identical draft', draft({}), 0, CHANGE_TELL.COMPARED],
        ['one title change', draft({ title: 'Londinium II' }), 1, CHANGE_TELL.COMPARED],
        ['one target change', draft({ target_weight: 40 }), 1, CHANGE_TELL.COMPARED],
        ['title and target', draft({ title: 'x', target_weight: 40 }), 2, CHANGE_TELL.COMPARED],
        ['one step edited', draft({
            steps: [baseline.steps[0], { ...baseline.steps[1], pressure: 6 }],
        }), 1, CHANGE_TELL.COMPARED],
        ['one step edited in two fields is still ONE change', draft({
            steps: [baseline.steps[0], { ...baseline.steps[1], pressure: 6, seconds: 20 }],
        }), 1, CHANGE_TELL.COMPARED],
        ['a step added', draft({ steps: [...baseline.steps, { name: 'pour', pump: 'flow', flow: 2 }] }),
            1, CHANGE_TELL.COMPARED],
        ['a step removed', draft({ steps: [baseline.steps[0]] }), 1, CHANGE_TELL.COMPARED],
        ['no baseline at all', draft({}), 0, CHANGE_TELL.CANNOT_TELL],
    ];

    for (const [label, value, count, tell] of CASES) {
        test(`${label} -> ${count}, ${tell}`, () => {
            const against = tell === CHANGE_TELL.CANNOT_TELL ? null : baseline;
            const answer = changeCountOf(value, against);
            assert.equal(answer.count, count, `fields: ${answer.fields.join(', ')}`);
            assert.equal(answer.tell, tell);
            assert.equal(answer.clean, count === 0);
        });
    }

    test('CANNOT TELL IS CLEAN, in every unreadable shape', () => {
        for (const bad of [null, undefined, 'a profile', 42, []]) {
            const a = changeCountOf(bad, baseline);
            const b = changeCountOf(baseline, bad);
            for (const answer of [a, b]) {
                assert.equal(answer.tell, CHANGE_TELL.CANNOT_TELL);
                assert.equal(answer.count, 0);
                assert.equal(answer.clean, true, 'a false-dirty Save is worse than no dirty state');
            }
        }
    });

    test('the count crosses the boundary and no wording does (D11)', () => {
        assert.deepEqual(headerCommitFor(changeCountOf(draft({ title: 'x' }), baseline)),
            { commit: true, changeCount: 1 });
        assert.deepEqual(headerCommitFor(changeCountOf(draft({}), baseline)),
            { commit: false, changeCount: 0 });
        assert.deepEqual(Object.keys(headerCommitFor(3)), ['commit', 'changeCount']);
        for (const value of Object.values(headerCommitFor(3))) {
            assert.notEqual(typeof value, 'string', 'a label crossed the boundary');
        }
    });
});

describe('B10 — the save report says what the record said, and nothing more', () => {
    const before = recordLike(PLAIN, { id: 'profile:old', metadataHash: 'meta-old' });
    const saved = recordLike(PLAIN, {
        id: 'profile:new', parentId: 'profile:old', metadataHash: 'meta-new',
        compoundHash: 'compound-new',
    });

    test('every reported value is one the server issued', () => {
        const report = saveReportFrom(saved, { route: 'postProfiles', status: 201, before });
        assert.equal(report.recorded, true);
        assert.equal(report.id, 'profile:new');
        assert.equal(report.parentId, 'profile:old');
        assert.equal(report.metadataHash, 'meta-new');
        assert.equal(report.compoundHash, 'compound-new');
        assert.equal(report.status, 201);
        assert.equal(report.route, 'postProfiles');
    });

    test('a 201 does NOT report that anything was stored', () => {
        const report = saveReportFrom(saved, { route: 'postProfiles', status: 201, before });
        assert.equal(report.stored, null,
            'create returns the EXISTING record on a hash hit and the handler answers 201 anyway');
    });

    test('two server-issued ids are compared for equality and left uninterpreted', () => {
        const report = saveReportFrom(saved, { before });
        assert.deepEqual({ ...report.identity }, { before: 'profile:old', after: 'profile:new', same: false });
        assert.deepEqual({ ...report.metadata }, { before: 'meta-old', after: 'meta-new', same: false });
        // No content-vs-label verdict anywhere in the report.
        const words = JSON.stringify(report).toLowerCase();
        for (const forbidden of ['content change', 'label change', 'contentchange', 'labelchange']) {
            assert.ok(!words.includes(forbidden), `the report predicted "${forbidden}"`);
        }
    });

    test('nothing to compare against reports an absence, not a false answer', () => {
        const report = saveReportFrom(saved, {});
        assert.equal(report.identity.same, null);
        assert.equal(report.metadata.same, null);
    });

    test('NO OUTCOME today, and the absence is named', () => {
        const report = saveReportFrom(saved, { route: 'postProfiles', status: 201, before });
        assert.equal(report.outcome, null);
        assert.equal(report.outcomeSource, OUTCOME_SOURCE.ABSENT);
    });

    test('R8’s richer body drops in at one reader, with no second shape', () => {
        const withOutcome = { ...saved, savedChange: { kind: 'content', fields: ['steps'] } };
        const report = saveReportFrom(withOutcome, {
            route: 'postProfiles', status: 201, before,
            readOutcome: (record) => record.savedChange ?? null,
        });
        assert.deepEqual(report.outcome, { kind: 'content', fields: ['steps'] });
        assert.equal(report.outcomeSource, OUTCOME_SOURCE.SERVER);
        // The SAME keys either way — one shape, one code path.
        const without = saveReportFrom(saved, { route: 'postProfiles', status: 201, before });
        assert.deepEqual(Object.keys(report).sort(), Object.keys(without).sort());
    });

    test('a bodyless answer is reported as unrecorded rather than as an empty record', () => {
        const report = saveReportFrom(null, { route: 'postProfiles', status: 201 });
        assert.equal(report.recorded, false);
        assert.match(report.reason, /carried no ProfileRecord/);
        assert.equal(report.outcomeSource, OUTCOME_SOURCE.ABSENT);
    });

    test('a failure takes the same shape so a caller renders one object', () => {
        const failure = saveFailureFrom(refused('Parent profile not found: profile:gone'), {
            route: 'postProfiles', refusal: { kind: 'invalid', error: 'Invalid request', message: 'x' },
        });
        assert.equal(failure.recorded, false);
        assert.equal(failure.status, 400);
        assert.equal(failure.refusal.kind, 'invalid');
        assert.equal(failure.error, null);
        assert.equal(failure.outcomeSource, OUTCOME_SOURCE.ABSENT);
    });
});

describe('the editor store reaches the routes it says it reaches', () => {
    const seed = recordLike(PLAIN, { id: 'profile:seed' });

    test('open() seats a record and touches no route', async () => {
        const transport = recordingTransport();
        const store = createProfileEditorStore({ transport });
        store.open(seed);
        assert.equal(store.get().load, EDITOR_LOAD_STATUS.READY);
        assert.equal(store.get().record.id, 'profile:seed');
        assert.equal(store.lineage().id, 'profile:seed');
        assert.equal(transport.calls.length, 0, 're-reading a record we were handed is a wasted request');
        store.stop();
    });

    test('loadById() is GET /profiles/{id}, percent-encoded', async () => {
        const transport = recordingTransport({ [`GET ${PATH_OF('profile:seed')}`]: ok(seed) });
        const store = createProfileEditorStore({ transport });
        await store.loadById('profile:seed');
        assert.equal(transport.calls.length, 1);
        assert.equal(transport.calls[0].method, 'GET');
        assert.equal(transport.calls[0].path, '/profiles/profile%3Aseed');
        assert.equal(store.get().load, EDITOR_LOAD_STATUS.READY);
        store.stop();
    });

    test('a 404 from _handleGetById is MISSING, not FAILED', async () => {
        const transport = recordingTransport({
            [`GET ${PATH_OF('profile:gone')}`]: { ok: false, status: 404, message: 'Profile not found' },
        });
        const store = createProfileEditorStore({ transport });
        await store.loadById('profile:gone');
        assert.equal(store.get().load, EDITOR_LOAD_STATUS.MISSING);
        store.stop();
    });

    test('saveAsNewVersion() POSTs a WRAPPED body carrying parentId', async () => {
        const saved = recordLike(PLAIN, { id: 'profile:v2', parentId: 'profile:seed' });
        const transport = recordingTransport({ 'POST /profiles': ok(saved, 201) });
        const store = createProfileEditorStore({ transport });
        store.open(seed);
        await store.saveAsNewVersion({ title: 'Draft', steps: [] });
        const call = transport.calls[0];
        assert.equal(call.method, 'POST');
        assert.equal(call.path, '/profiles');
        assert.ok(call.body.profile, 'the profile is WRAPPED — _handleCreate reads json["profile"]');
        assert.equal(call.body.parentId, 'profile:seed');
        assert.equal(store.get().save, SAVE_STATUS.SAVED);
        assert.equal(store.version().kept, VERSION_KEPT.LINKED);
        assert.equal(store.report().outcomeSource, OUTCOME_SOURCE.ABSENT);
        store.stop();
    });

    test('the saved record becomes the new baseline, so a save cannot leave the screen dirty', async () => {
        const profile = { title: 'Draft', notes: '', steps: [{ name: 'a', pump: 'flow', flow: 4 }] };
        const saved = recordLike(PLAIN, { id: 'profile:v2', parentId: 'profile:seed', profile });
        const transport = recordingTransport({ 'POST /profiles': ok(saved, 201) });
        const store = createProfileEditorStore({ transport });
        store.open(recordLike(PLAIN, { id: 'profile:seed', profile: { ...profile, title: 'Old' } }));
        assert.equal(store.changeCount(profile).count, 1);
        await store.saveAsNewVersion(profile);
        assert.equal(store.changeCount(profile).count, 0);
        assert.deepEqual(store.headerCommit(profile), { commit: false, changeCount: 0 });
        store.stop();
    });

    test('saveMetadata() PUTs metadata only — no `profile` key, so the id is stable', async () => {
        const saved = recordLike(PLAIN, { id: 'profile:seed' });
        const transport = recordingTransport({ [`PUT ${PATH_OF('profile:seed')}`]: ok(saved) });
        const store = createProfileEditorStore({ transport });
        store.open(seed);
        await store.saveMetadata({ folder: 'favourites' });
        const call = transport.calls[0];
        assert.equal(call.method, 'PUT');
        assert.equal(call.path, '/profiles/profile%3Aseed');
        assert.deepEqual(Object.keys(call.body), ['metadata']);
        assert.equal(store.version().kept, VERSION_KEPT.SAME_RECORD);
        store.stop();
    });

    test('saveInPlace() PUTs the profile, and the version answer does not claim a keep', async () => {
        const saved = recordLike(PLAIN, { id: 'profile:moved' });
        const transport = recordingTransport({ [`PUT ${PATH_OF('profile:seed')}`]: ok(saved) });
        const store = createProfileEditorStore({ transport });
        store.open(seed);
        await store.saveInPlace({ title: 'Draft', steps: [] });
        assert.ok(transport.calls[0].body.profile);
        assert.equal(store.version().kept, VERSION_KEPT.NOT_LINKED);
        assert.equal(store.version().saysOldVersionKept, false,
            'a PUT that moved the id deleted the old record — the editor must not say it is kept');
        store.stop();
    });

    test('a typed 400 is a REFUSAL carrying ReaPrime’s own message, not a fault', async () => {
        const transport = recordingTransport({
            'POST /profiles': refused('Invalid argument(s): Parent profile not found: profile:gone'),
        });
        const store = createProfileEditorStore({ transport });
        store.open(seed);
        await store.saveAsNewVersion({ title: 'Draft', steps: [] }, { parentId: 'profile:gone' });
        assert.equal(store.get().save, SAVE_STATUS.REFUSED);
        assert.equal(store.get().refusal.kind, 'invalid');
        assert.match(store.get().refusal.message, /Parent profile not found/);
        assert.equal(store.get().error, null);
        store.stop();
    });

    test('a 500 is a fault, never a refusal', async () => {
        const transport = recordingTransport({
            'POST /profiles': { ok: false, status: 500, message: 'Internal server error', problem: null },
        });
        const store = createProfileEditorStore({ transport });
        store.open(seed);
        await store.saveAsNewVersion({ title: 'Draft', steps: [] });
        assert.equal(store.get().save, SAVE_STATUS.FAILED);
        assert.equal(store.get().refusal, null);
        assert.equal(store.get().error.status, 500);
        store.stop();
    });

    test('the store never reaches the arm route or the lineage route', async () => {
        const transport = recordingTransport({ 'POST /profiles': ok(recordLike(PLAIN), 201) });
        const store = createProfileEditorStore({ transport });
        store.open(seed);
        await store.saveAsNewVersion({ title: 'x', steps: [] });
        await store.saveMetadata({ a: 1 }).catch(() => {});
        for (const call of transport.calls) {
            assert.ok(!call.path.includes('/machine/profile'), 'B9 has ONE caller and it is not here');
            assert.ok(!call.path.includes('/lineage'), 'Q7 is the selector’s entry point');
        }
        store.stop();
    });

    test('a transport is required — no ambient fetch', () => {
        assert.throws(() => createProfileEditorStore(), /transport must be injected/);
    });
});

describe('ONE SANITIZER — the saved-vs-armed stop-at-weight drift is inexpressible', () => {
    /** The exact input the old drift bug turned on: a weight EXIT and no step.weight. */
    const withWeightExit = Object.freeze({
        title: 'Stop at weight', version: '2',
        steps: [Object.freeze({
            name: 'pour', pump: 'flow', flow: 2, seconds: 40,
            exit: Object.freeze({ type: 'weight', value: 36 }),
        })],
    });

    test('the SAVE path keeps the stop-at-weight target', () => {
        const body = profileCreateBody(withWeightExit, { parentId: 'profile:old' });
        assert.equal(body.profile.steps[0].weight, 36);
        assert.equal(body.profile.steps[0].exit, undefined);
    });

    test('the UPDATE path keeps it too', () => {
        const body = profileUpdateBody({ profile: withWeightExit });
        assert.equal(body.profile.steps[0].weight, 36);
        assert.equal(body.profile.steps[0].exit, undefined);
    });

    test('the ARM path keeps it — and this is the pair that had drifted', () => {
        const armed = profileArmBody(withWeightExit);
        assert.equal(armed.steps[0].weight, 36);
        assert.equal(armed.steps[0].exit, undefined);
    });

    test('SAME PROFILE, ALL THREE PATHS, SAME TARGET — the drill', () => {
        const saved = profileCreateBody(withWeightExit).profile;
        const updated = profileUpdateBody({ profile: withWeightExit }).profile;
        const armed = profileArmBody(withWeightExit);
        assert.deepEqual(saved, updated);
        assert.deepEqual(saved, armed,
            'the old skin nulled the weight exit on the arm path and wrote nothing, so the '
            + 'same profile kept its target when saved and lost it when armed');
        assert.equal(new Set([saved, updated, armed].map((p) => p.steps[0].weight)).size, 1);
    });

    test('an unsupported exit type is SENT, so the server refuses it with a typed 400 (B9)', () => {
        const powerExit = { steps: [{ name: 's', exit: { type: 'power', value: 5 } }] };
        for (const path of [profileCreateBody(powerExit).profile,
            profileUpdateBody({ profile: powerExit }).profile, profileArmBody(powerExit)]) {
            assert.deepEqual(path.steps[0].exit, { type: 'power', value: 5 },
                'pre-stripping it here would make the refusal a silent behaviour change');
        }
    });

    test('the one sanitizer does not mutate its caller’s object', () => {
        const source = structuredClone(withWeightExit);
        sanitizeProfileForRea(source);
        assert.deepEqual(source.steps[0].exit, { type: 'weight', value: 36 });
    });
});

describe('the offline mock proves the REQUEST and the REFUSAL, never a success', () => {
    /** Ask mock_rea what it answers a mutating verb, the way its own server does. */
    function writeResponse(routePath, verb) {
        const out = execFileSync('python3', ['-c',
            'import json,sys; sys.path.insert(0,"tools"); import mock_rea;'
            + 'status, body, ctype = mock_rea.write_response(sys.argv[1], sys.argv[2]);'
            + 'print(json.dumps({"status": status, "body": json.loads(body or b"null")}))',
            routePath, verb], { cwd: REPO, encoding: 'utf8' });
        return JSON.parse(out);
    }

    test('POST /api/v1/profiles is 501 offline — a ProfileRecord is not synthesizable', () => {
        const answer = writeResponse('/api/v1/profiles', 'POST');
        assert.equal(answer.status, 501);
        assert.match(answer.body.why, /typed document/);
        assert.equal(answer.body.verb, 'POST');
    });

    test('PUT /api/v1/profiles/{id} is 501 offline for the same reason', () => {
        const answer = writeResponse('/api/v1/profiles/profile:abc', 'PUT');
        assert.equal(answer.status, 501);
        assert.equal(answer.body.path, '/api/v1/profiles/profile:abc');
    });

    test('so the success path is proven against a stub, and that is recorded here', () => {
        // Stated as a test so the reason travels with the suite rather than in a comment
        // somebody deletes: a mock that invented a ProfileRecord would teach the client a
        // server that does not exist, which is the A7 defect the endpoint fallback was
        // deleted for.
        assert.equal(writeResponse('/api/v1/profiles', 'POST').status, 501);
    });
});

/* ===========================================================================
 * WHICH SAVE A GESTURE IS  (fix run 4, `dec-A-B-1`)
 *
 * The three operations existed from wave 5.5 and nothing chose between them: the store
 * had no caller in `src/` at all. `commitPlan` is that choice, and every case below is
 * one of the reasons it is a table over GESTURES rather than a diff.
 * =========================================================================== */

describe('commitPlan: the route follows the gesture, never a diff', () => {
    /* -----------------------------------------------------------------
     * A CONTENT SAVE WRITES AND CLOSES — 27 August 2026, and this test asserted
     * `close: false` until that evening.
     *
     * Ben saved on the bench, was left standing in the editor with a toast, pressed Save a
     * SECOND time to get out (that press lands on the clean branch below, which closes),
     * re-opened and read the old value — because the record he was looking at was not the
     * one he had just written. His words: "pressing save should close and arm, I shouldn't
     * need to press save twice."
     *
     * ONE BUTTON, ONE MEANING. `close: false` here made the band's Save mean "write" on a
     * dirty draft and "leave" on a clean one, and a person pressing it twice in a row got
     * both — which is indistinguishable, from the outside, from one press that did
     * nothing. The two branches now differ in the OPERATION and not in the exit, and that
     * is the difference the assertions below name.
     * ----------------------------------------------------------------- */
    test('the band\'s Save on a dirty draft is B11\'s path, and it closes — DQ-629, Ben\'s ruling', () => {
        const plan = commitPlan({ gesture: COMMIT_GESTURE.SAVE, dirty: true, seated: true });
        assert.equal(plan.operation, SAVE_OPERATION.NEW_VERSION);
        assert.equal(plan.close, true,
            'Ben, 27 August 2026: "pressing save should close and arm, I shouldn\'t need '
            + 'to press save twice"');
    });

    test('at a clean count the band says Close, and Close closes — with nothing written', () => {
        const plan = commitPlan({ gesture: COMMIT_GESTURE.SAVE, dirty: false, seated: true });
        assert.equal(plan.operation, null, 'nothing is saved');
        assert.equal(plan.close, true);
    });

    /* -----------------------------------------------------------------
     * CANNOT TELL IS NOT CLEAN — not where the answer decides something.
     *
     * `changeCountOf` has always reported `{count: 0, clean: true, tell: 'cannot-tell'}`
     * for a pair it could not compare, and every caller flattened it by taking `.count`.
     * At `dirty: false` a Save means LEAVE, so an unanswerable question closed the editor
     * over the draft with no write, no toast and no question — the defect class this fork
     * exists to remove, and the shape of what Ben reported on 27 August 2026.
     *
     * The two mistakes are not symmetrical. An unnecessary write costs one spare version
     * and DQ-629's whole design keeps the previous one, so it is visible and undoable. A
     * silent close destroys work that exists nowhere else. See the block inside
     * `commitPlan` for the argument in full.
     *
     * THE WORD "SILENT" IS DOING ALL THE WORK, and it is worth saying so because this test
     * also asserted `close: false` until 27 August 2026 and no longer does. The cannot-tell
     * branch went with the content-save branch when Ben ruled that a save closes, so an
     * unanswerable dirty state now WRITES AND LEAVES. Nothing about the argument above
     * changes: the draft is on the wire before the screen goes, so there is no draft left
     * to destroy, and the version it wrote is in the list where a person can see it and
     * undo it. What is refused is still exactly what was always refused — closing with
     * nothing written.
     * ----------------------------------------------------------------- */
    test('an UNKNOWN dirty state saves rather than closing over the draft', () => {
        const plan = commitPlan({
            gesture: COMMIT_GESTURE.SAVE, dirty: false, tell: CHANGE_TELL.CANNOT_TELL, seated: true,
        });
        assert.equal(plan.operation, SAVE_OPERATION.NEW_VERSION,
            'an unknown must not be rounded down to "nothing to save"');
        assert.equal(plan.close, true,
            'and it leaves like any other save — the draft is written on the way out, '
            + 'which is the whole difference from the silent close this branch exists for');
    });

    test('the tell is exactly what changeCountOf answers — no second vocabulary', () => {
        /* THE REAL ANSWER, PASSED STRAIGHT THROUGH, so the two modules cannot drift: an
         * unreadable baseline is what produces cannot-tell, and it is what produces the
         * save. Nothing in this test names the string. */
        const draft = { title: 'Londinium', steps: [] };
        const unreadable = changeCountOf(draft, null);
        assert.equal(unreadable.count, 0, 'still counted as clean, as B10 requires of a LABEL');
        const plan = commitPlan({
            gesture: COMMIT_GESTURE.SAVE,
            dirty: unreadable.count > 0,
            tell: unreadable.tell,
            seated: true,
        });
        assert.equal(plan.operation, SAVE_OPERATION.NEW_VERSION);

        /* THE OTHER SIDE OF THE SAME QUESTION, AND SINCE 27 AUGUST 2026 THE DIFFERENCE IS
         * THE OPERATION RATHER THAN THE EXIT. This used to read `.close === true` against
         * an unknown state's `close: false`, and that comparison stopped separating
         * anything the moment a save started closing too. What still separates them —
         * and what this test is actually about — is that an unreadable baseline WRITES and
         * a genuinely clean one does not. Asserting the operation is the stronger claim,
         * and it is the one a caller acts on. */
        const readable = changeCountOf(draft, draft);
        const clean = commitPlan({
            gesture: COMMIT_GESTURE.SAVE,
            dirty: readable.count > 0,
            tell: readable.tell,
            seated: true,
        });
        assert.equal(clean.operation, null,
            'a genuinely clean draft writes NOTHING — that, and not the exit, is what '
            + 'tells the two answers apart');
        assert.equal(clean.close, true, 'and it closes, as it always did');
    });

    test('an unknown dirty state with NOTHING OPEN still only closes', () => {
        /* Seating comes first: there is no draft to protect when no record is open, and
         * inventing a POST out of nothing would be a worse answer than leaving. */
        const plan = commitPlan({
            gesture: COMMIT_GESTURE.SAVE, dirty: false, tell: CHANGE_TELL.CANNOT_TELL, seated: false,
        });
        assert.equal(plan.operation, null);
        assert.equal(plan.close, true);
    });

    test('a rename takes the PUT, because metadata cannot carry a name', () => {
        /* `saveMetadata` sends `profileUpdateBody({metadata})` and `metadata` is
         * ProfileRecord's free-form map; the displayed name is `record.profile.title`. A
         * rename routed through it would answer 200 and change nothing on screen. */
        const plan = commitPlan({ gesture: COMMIT_GESTURE.RENAME, seated: true });
        assert.equal(plan.operation, SAVE_OPERATION.IN_PLACE);
        assert.equal(plan.close, false);
    });

    test('with nothing open there is nothing to save and nothing to rename', () => {
        assert.equal(commitPlan({ gesture: COMMIT_GESTURE.SAVE, dirty: true, seated: false }).operation, null);
        assert.equal(commitPlan({ gesture: COMMIT_GESTURE.SAVE, dirty: true, seated: false }).close, true);
        assert.equal(commitPlan({ gesture: COMMIT_GESTURE.RENAME, seated: false }).operation, null);
    });

    test('an unknown gesture plans nothing and says so', () => {
        const plan = commitPlan({ gesture: 'shrug' });
        assert.equal(plan.operation, null);
        assert.equal(plan.close, false);
        assert.match(plan.reason, /no plan for gesture/);
    });

    test('every operation a plan can name is a method the store actually has', () => {
        const store = createProfileEditorStore({ transport: { request: async () => ({ ok: true }) } });
        for (const name of Object.values(SAVE_OPERATION)) {
            assert.equal(typeof store[name], 'function', `the store has no ${name}()`);
        }
    });

    test('the plan is frozen — a caller cannot edit the decision it was handed', () => {
        const plan = commitPlan({ gesture: COMMIT_GESTURE.SAVE, dirty: true, seated: true });
        assert.equal(Object.isFrozen(plan), true);
    });
});
