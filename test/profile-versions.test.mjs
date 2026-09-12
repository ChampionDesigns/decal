/**
 * `supersededIds` — which records in a list have been replaced by another in the same list.
 *
 * One pass over records already in hand: a record another names as its parent is
 * superseded, order is irrelevant because the answer is a set, and a record naming itself
 * as its own parent is not superseded by anything.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    createProfileEditorStore, SAVE_STATUS,
} from '../src/stores/profile-editor-store.js';
import { createProfileLibraryStore } from '../src/stores/profile-library-store.js';
import { createProfileArmStore } from '../src/stores/profile-arm-store.js';
import { createStorageRouter } from '../src/lib/storage-router.js';
import { createMemoryBackend } from '../src/lib/storage-backends.js';
import { LAYERS } from '../src/lib/storage-routes.js';
import {
    supersededIds, versionChangeFacts, parentRecordOf,
    versionKeptBy, versionNoteFacts, VERSION_KEPT, SAVE_INTENT,
} from '../src/lib/profile-lineage.js';
import { changeCountOf, changeGroupsOf } from '../src/lib/editor-commit.js';
import { restorableProfiles, partitionProfiles } from '../src/lib/profile-rules.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const FIXTURE = JSON.parse(readFileSync(
    path.join(REPO, 'tools/rea-fixtures/api__v1__profiles~includeHidden=true.json'), 'utf8',
));
const WORKFLOW = JSON.parse(readFileSync(
    path.join(REPO, 'tools/rea-fixtures/api__v1__workflow.json'), 'utf8',
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
const fault = (message = 'no recording') => ({
    ok: false, kind: 'http', status: 503, message, problem: null,
});

/** `buildPath` percent-encodes a path parameter, and a record id carries a colon. */
const VISIBILITY = (id) => `/profiles/${encodeURIComponent(id)}/visibility`;

/** A minimal DE1 v2 profile. The content is irrelevant; only that it can differ. */
const profileAt = (temperature) => ({
    title: 'Subject', steps: [{ name: 'a', temperature }], target_weight: 36,
});

/** The record the editor is seated on before a save. */
const seatedRecord = (overrides = {}) => ({
    id: 'profile:old',
    profile: profileAt(90),
    metadataHash: 'm', compoundHash: 'c',
    parentId: null, visibility: 'visible', isDefault: false,
    createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
    metadata: null,
    ...overrides,
});

/** What the server answers a save with. */
const savedRecord = (overrides = {}) => ({
    ...seatedRecord(), id: 'profile:new', parentId: 'profile:old', ...overrides,
});

/** Only the visibility writes, in the order they were made. */
const visibilityWrites = (transport) => transport.calls
    .filter((call) => call.method === 'PUT' && call.path.endsWith('/visibility'))
    .map((call) => ({ path: call.path, visibility: call.body.visibility }));

describe('supersededIds — the discriminator, and it costs one pass over a list in hand', () => {
    test('a record another record names as its parent is superseded', () => {
        const ids = supersededIds([
            { id: 'a' }, { id: 'b', parentId: 'a' }, { id: 'c', parentId: 'b' },
        ]);
        assert.deepEqual([...ids].sort(), ['a', 'b'],
            'the two with children — the tip is not superseded by anything');
    });

    test('order does not matter, because a set is not a walk', () => {
        const forward = supersededIds([{ id: 'a' }, { id: 'b', parentId: 'a' }]);
        const backward = supersededIds([{ id: 'b', parentId: 'a' }, { id: 'a' }]);
        assert.deepEqual([...forward], [...backward]);
    });

    test('a record that claims to be its own parent is NOT reported superseded', () => {
        assert.deepEqual([...supersededIds([{ id: 'loop', parentId: 'loop' }])], []);
    });

    test('absence is an answer, not a crash (A7)', () => {
        assert.deepEqual([...supersededIds(null)], []);
        assert.deepEqual([...supersededIds([])], []);
        assert.deepEqual([...supersededIds([null, undefined, 7, { id: 'x' }])], []);
        assert.deepEqual([...supersededIds([{ id: 'x', parentId: '' }])], [],
            'an empty-string parentId is no parent, not a parent called ""');
    });

    test('MEASURED on the recorded listing: most of what is hidden is version history', () => {
        const superseded = supersededIds(FIXTURE);
        const parts = partitionProfiles(FIXTURE);
        const hiddenish = [...parts.hidden, ...parts.deleted];
        const kept = hiddenish.filter((record) => !superseded.has(record.id));
        assert.equal(FIXTURE.length, 147);
        assert.equal(hiddenish.length, 69);
        assert.equal(kept.length, 13,
            '56 of the 69 records the library was holding back are superseded versions — '
            + 'the Hidden toggle was 84% version noise before this filter');
    });

    test('and `restorable` is deliberately NOT filtered by it — one record proves why', () => {
        const superseded = supersededIds(FIXTURE);
        const restorable = restorableProfiles(FIXTURE).filter((r) => r.metadata && r.metadata.filename);
        assert.equal(restorable.length, 10);
        const alsoSuperseded = restorable.filter((record) => superseded.has(record.id));
        assert.equal(alsoSuperseded.length, 1,
            'filtering the restore offer by this rule would make one bundled profile '
            + 'permanently unrestorable');
    });
});

describe('versionChangeFacts — the diff, computed and never persisted', () => {
    const record = (profile, parentId = 'profile:parent') => ({ id: 'profile:child', parentId, profile });

    test('a moved step is named by index, and a moved field by key', () => {
        const facts = versionChangeFacts(
            record({ title: 'New', steps: [{ t: 1 }, { t: 9 }] }),
            { id: 'profile:parent', profile: { title: 'Old', steps: [{ t: 1 }, { t: 2 }] } },
        );
        assert.equal(facts.known, true);
        assert.deepEqual(facts.scalars, ['title']);
        assert.deepEqual(facts.changed, [1], 'zero-based here; the screen adds the 1');
        assert.deepEqual(facts.added, []);
        assert.deepEqual(facts.removed, []);
        assert.equal(facts.count, 2);
    });

    test('added and removed steps are counted apart from changed ones', () => {
        const grew = versionChangeFacts(
            record({ steps: [{ t: 1 }, { t: 2 }, { t: 3 }] }),
            { profile: { steps: [{ t: 1 }] } },
        );
        assert.deepEqual(grew.added, [1, 2]);
        assert.deepEqual(grew.removed, []);
        const shrank = versionChangeFacts(
            record({ steps: [{ t: 1 }] }),
            { profile: { steps: [{ t: 1 }, { t: 2 }] } },
        );
        assert.deepEqual(shrank.removed, [1]);
        assert.deepEqual(shrank.added, []);
    });

    test('NO PARENT IS NOT NO CHANGES — the root says it cannot be compared (A7)', () => {
        const facts = versionChangeFacts(record({ steps: [] }, null), null);
        assert.equal(facts.known, false,
            '"0 changes" would be a claim about a comparison that never happened');
        assert.equal(facts.count, 0);
    });

    test('a step list on one side only is reported WHOLESALE, with no indexes invented', () => {
        const facts = versionChangeFacts(record({ steps: [{ t: 1 }] }), { profile: { steps: null } });
        assert.equal(facts.wholesale, true);
        assert.deepEqual(facts.changed, []);
        assert.equal(facts.count, 1, 'one change, not a count of steps nobody can enumerate');
    });

    test('parentRecordOf finds the parent in a lineage, and answers null rather than guessing', () => {
        const chain = [{ id: 'a' }, { id: 'b', parentId: 'a' }];
        assert.equal(parentRecordOf(chain[1], chain).id, 'a');
        assert.equal(parentRecordOf(chain[0], chain), null, 'the root has no parent');
        assert.equal(parentRecordOf({ id: 'x', parentId: 'gone' }, chain), null,
            'a parent that is not in the corpus is absent, not the nearest thing to it');
    });
});

describe('changeGroupsOf and changeCountOf cannot drift, because one builds the other', () => {
    test('the field names and their order survive the refactor exactly', () => {
        const answer = changeCountOf(
            { title: 'N', tank_temperature: 3, steps: [{ a: 2 }, { b: 1 }, { c: 1 }] },
            { title: 'O', tank_temperature: 1, steps: [{ a: 1 }] },
        );
        assert.deepEqual(answer.fields,
            ['title', 'tank_temperature', 'steps[0]', 'steps[1] added', 'steps[2] added'],
            'scalars in PROFILE_SCALAR_KEYS order, then changed, then added, then removed');
        assert.equal(answer.count, 5);
        assert.equal(answer.count, changeGroupsOf(
            { title: 'N', tank_temperature: 3, steps: [{ a: 2 }, { b: 1 }, { c: 1 }] },
            { title: 'O', tank_temperature: 1, steps: [{ a: 1 }] },
        ).count, 'and the two answer the same number');
    });

    test('a removed step keeps its old spelling too', () => {
        const answer = changeCountOf({ steps: [{ a: 1 }] }, { steps: [{ a: 1 }, { b: 1 }] });
        assert.deepEqual(answer.fields, ['steps[1] removed']);
    });

    test('an uncomparable pair is still CLEAN with tell cannot-tell', () => {
        const answer = changeCountOf(null, { steps: [] });
        assert.equal(answer.clean, true);
        assert.equal(answer.tell, 'cannot-tell');
        assert.deepEqual(answer.fields, []);
    });
});

describe('a content save leaves ONE row: the superseded parent is hidden', () => {
    test('the parent is hidden, and the saved record is not touched', async () => {
        const transport = recordingTransport({
            'POST /profiles': ok(savedRecord(), 201),
            [`PUT ${VISIBILITY('profile:old')}`]: ok(seatedRecord({ visibility: 'hidden' })),
        });
        const store = createProfileEditorStore({ transport });
        store.open(seatedRecord());
        await store.saveAsNewVersion(profileAt(91));

        assert.deepEqual(visibilityWrites(transport),
            [{ path: VISIBILITY('profile:old'), visibility: 'hidden' }],
            'exactly one visibility write, on the record the save superseded');
        assert.equal(store.get().save, SAVE_STATUS.SAVED);
        assert.equal(store.get().record.id, 'profile:new', 'and the editor is seated on the save');
        store.stop();
    });

    test('the body is the bare {visibility} field — this route is NOT wrapped', async () => {
        const transport = recordingTransport({
            'POST /profiles': ok(savedRecord(), 201),
            [`PUT ${VISIBILITY('profile:old')}`]: ok(seatedRecord({ visibility: 'hidden' })),
        });
        const store = createProfileEditorStore({ transport });
        store.open(seatedRecord());
        await store.saveAsNewVersion(profileAt(91));
        const write = transport.calls.find((c) => c.path === VISIBILITY('profile:old'));
        assert.deepEqual(Object.keys(write.body), ['visibility'],
            'postProfiles and putProfilesById wrap their bodies; this one does not');
        store.stop();
    });

    test('an id-stable save hides NOTHING — there is no second row to take away', async () => {
        const transport = recordingTransport({
            'POST /profiles': ok(seatedRecord(), 201),
        });
        const store = createProfileEditorStore({ transport });
        store.open(seatedRecord());
        await store.saveAsNewVersion(profileAt(90));
        assert.deepEqual(visibilityWrites(transport), []);
        assert.equal(store.version().kept, VERSION_KEPT.SAME_RECORD);
        store.stop();
    });

    test('a BUNDLED parent is never hidden — a template is not superseded by being copied',
        async () => {
            const transport = recordingTransport({
                'POST /profiles': ok(savedRecord(), 201),
                [`PUT ${VISIBILITY('profile:old')}`]: ok(seatedRecord({ visibility: 'hidden' })),
            });
            const store = createProfileEditorStore({ transport });
            store.open(seatedRecord({ isDefault: true }));
            await store.saveAsNewVersion(profileAt(91));
            assert.deepEqual(visibilityWrites(transport), [],
                'no visibility write at all for a bundled parent');
            assert.equal(store.get().save, SAVE_STATUS.SAVED);
            store.stop();
        });

    test('a failed hide does NOT fail the save — the record is safely stored either way',
        async () => {
            const transport = recordingTransport({
                'POST /profiles': ok(savedRecord(), 201),
                [`PUT ${VISIBILITY('profile:old')}`]: fault('the machine went away'),
            });
            const store = createProfileEditorStore({ transport });
            store.open(seatedRecord());
            await store.saveAsNewVersion(profileAt(91));
            assert.equal(store.get().save, SAVE_STATUS.SAVED,
                'telling somebody their save failed because a tidy-up did not land is a lie '
                + 'about the thing they care about');
            assert.equal(store.get().refusal, null);
            assert.equal(store.get().record.id, 'profile:new');
            store.stop();
        });
});

describe('restoring an older version — the idempotent branch, and the trap in it', () => {
    const restoredRecord = (overrides = {}) => savedRecord({
        id: 'profile:older', parentId: null, visibility: 'hidden', ...overrides,
    });

    test('the restored record is made VISIBLE, and only then is the tip hidden', async () => {
        const transport = recordingTransport({
            'POST /profiles': ok(restoredRecord(), 201),
            [`PUT ${VISIBILITY('profile:older')}`]: ok(restoredRecord({ visibility: 'visible' })),
            [`PUT ${VISIBILITY('profile:old')}`]: ok(seatedRecord({ visibility: 'hidden' })),
        });
        const store = createProfileEditorStore({ transport });
        store.open(seatedRecord());
        await store.saveAsNewVersion(profileAt(88));

        assert.deepEqual(visibilityWrites(transport), [
            { path: VISIBILITY('profile:older'), visibility: 'visible' },
            { path: VISIBILITY('profile:old'), visibility: 'hidden' },
        ], 'the ORDER is the safety argument: worst case here is two rows, never zero');
        store.stop();
    });

    test('the seated record carries the visibility the un-hide returned, not the stale one',
        async () => {
            const transport = recordingTransport({
                'POST /profiles': ok(restoredRecord(), 201),
                [`PUT ${VISIBILITY('profile:older')}`]: ok(restoredRecord({ visibility: 'visible' })),
                [`PUT ${VISIBILITY('profile:old')}`]: ok(seatedRecord({ visibility: 'hidden' })),
            });
            const store = createProfileEditorStore({ transport });
            store.open(seatedRecord());
            await store.saveAsNewVersion(profileAt(88));
            assert.equal(store.get().record.id, 'profile:older');
            assert.equal(store.get().record.visibility, 'visible',
                'the POST answered `hidden`; the server\'s latest answer is what is seated');
            store.stop();
        });

    test('IF THE UN-HIDE FAILS THE TIP IS NOT HIDDEN — a profile must never lose every row',
        async () => {
            const transport = recordingTransport({
                'POST /profiles': ok(restoredRecord(), 201),
                [`PUT ${VISIBILITY('profile:older')}`]: fault('the machine went away'),
                [`PUT ${VISIBILITY('profile:old')}`]: ok(seatedRecord({ visibility: 'hidden' })),
            });
            const store = createProfileEditorStore({ transport });
            store.open(seatedRecord());
            await store.saveAsNewVersion(profileAt(88));

            assert.deepEqual(visibilityWrites(transport),
                [{ path: VISIBILITY('profile:older'), visibility: 'visible' }],
                'the un-hide was attempted and the hide was NOT — two rows beats none');
            assert.equal(store.get().save, SAVE_STATUS.SAVED);
            store.stop();
        });

    test('the version answer is RESTORED, and it does not claim the old version was lost',
        async () => {
            const transport = recordingTransport({
                'POST /profiles': ok(restoredRecord(), 201),
                [`PUT ${VISIBILITY('profile:older')}`]: ok(restoredRecord({ visibility: 'visible' })),
                [`PUT ${VISIBILITY('profile:old')}`]: ok(seatedRecord({ visibility: 'hidden' })),
            });
            const store = createProfileEditorStore({ transport });
            store.open(seatedRecord());
            await store.saveAsNewVersion(profileAt(88));
            assert.equal(store.version().kept, VERSION_KEPT.RESTORED,
                'before this existed the case fell through to NOT_LINKED and told the '
                + 'person their previous version was not kept — wrong, and frightening');
            assert.equal(store.version().saysOldVersionKept, true,
                'hiding takes a record off the LIST, not out of the HISTORY');
            store.stop();
        });
});

describe('versionKeptBy — RESTORED is inferred from two server-issued ids, never guessed', () => {
    const previous = { id: 'profile:tip' };

    test('a parentId that was sent and did not come back means the server had it already', () => {
        const answer = versionKeptBy(
            { id: 'profile:older', parentId: null },
            { previous, intent: SAVE_INTENT.NEW_VERSION, requestedParentId: 'profile:tip' },
        );
        assert.equal(answer.kept, VERSION_KEPT.RESTORED);
        assert.match(answer.basis, /returned a record it already held/);
    });

    test('a parentId that DID come back is still LINKED, and takes precedence', () => {
        const answer = versionKeptBy(
            { id: 'profile:new', parentId: 'profile:tip' },
            { previous, intent: SAVE_INTENT.NEW_VERSION, requestedParentId: 'profile:tip' },
        );
        assert.equal(answer.kept, VERSION_KEPT.LINKED);
    });

    test('the PUT routes cannot reach RESTORED — they send no parent to be ignored', () => {
        for (const intent of [SAVE_INTENT.IN_PLACE, SAVE_INTENT.METADATA_ONLY]) {
            const answer = versionKeptBy({ id: 'profile:moved' }, { previous, intent });
            assert.equal(answer.kept, VERSION_KEPT.NOT_LINKED);
            assert.equal(versionNoteFacts({ id: 'profile:moved' }, { previous, intent })
                .saysOldVersionKept, false,
            'a PUT that moved the id deleted the old record — that IS a loss');
        }
    });

    test('a NEW_VERSION save whose parent was NOT the seated record stays NOT_LINKED', () => {
        /* `createFromFile` posts with no parentId at all, and a caller may pass one that is
         * not the record the editor is on. Neither is a restore, and neither may be worded
         * as one. */
        assert.equal(versionKeptBy(
            { id: 'profile:other', parentId: null },
            { previous, intent: SAVE_INTENT.NEW_VERSION, requestedParentId: null },
        ).kept, VERSION_KEPT.NOT_LINKED);
        assert.equal(versionKeptBy(
            { id: 'profile:other', parentId: null },
            { previous, intent: SAVE_INTENT.NEW_VERSION, requestedParentId: 'profile:elsewhere' },
        ).kept, VERSION_KEPT.NOT_LINKED);
    });
});

describe('the Hidden set is profiles you put away, not every version you ever saved', () => {
    const memoryRouter = () => createStorageRouter({
        backends: {
            [LAYERS.kv]: createMemoryBackend(),
            [LAYERS.kvNumpad]: createMemoryBackend(),
            [LAYERS.local]: createMemoryBackend(),
            [LAYERS.session]: createMemoryBackend(),
        },
    });

    function build(records) {
        const transport = recordingTransport({
            '/profiles': ok(records),
            '/workflow': ok(WORKFLOW),
        });
        const arm = createProfileArmStore({ transport });
        return createProfileLibraryStore({ transport, storage: memoryRouter(), arm });
    }

    test('a superseded version is not in `hidden`, and the tip is not in it either', async () => {
        const store = build([
            { ...seatedRecord({ id: 'profile:v1', visibility: 'hidden' }) },
            { ...seatedRecord({ id: 'profile:v2', parentId: 'profile:v1', visibility: 'visible' }) },
            { ...seatedRecord({ id: 'profile:putaway', visibility: 'deleted' }) },
        ]);
        const state = await store.load();
        assert.deepEqual(state.hidden.map((r) => r.id), ['profile:putaway'],
            'the version belongs to the history; only the record a person hid is here');
        assert.deepEqual(state.listable.map((r) => r.id), ['profile:v2'], 'and the list has ONE row');
        store.stop();
    });

    test('MEASURED on the recording: the Hidden toggle drops from 69 rows to 13', async () => {
        const store = build(FIXTURE);
        const state = await store.load();
        assert.equal(state.records.length, 147, 'every record is still held — nothing was dropped');
        assert.equal(state.hidden.length, 13);
        assert.equal(state.restorable.length, 10,
            'and D6\'s restore offer is untouched, superseded members included');
        store.stop();
    });
});
