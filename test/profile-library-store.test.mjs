/**
 *.3, the selector's one door to the profile routes, plus the listbox's pure key arithmetic.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    createProfileLibraryStore,
    matchProfiles,
    restoreFilenameOf,
    D6_PURGE_IS_LANDED,
    LIBRARY_STATUS,
    RESTORE_STATUS,
    VERSIONS_STATUS,
} from '../src/stores/profile-library-store.js';
import { createProfileArmStore } from '../src/stores/profile-arm-store.js';
import { createStorageRouter } from '../src/lib/storage-router.js';
import { FAVOURITES_KEY, FAVOURITES_SEEDED_KEY } from '../src/lib/profile-rules.js';
import { createMemoryBackend } from '../src/lib/storage-backends.js';
import { LAYERS } from '../src/lib/storage-routes.js';
import { nextActiveIndex, optionIdFor, recordIdFromOptionId, PAGE_STEP, listboxGroups, R1_PROVISIONAL_HIGHLIGHT }
    from '../src/lib/profile-listbox.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const FIXTURE = JSON.parse(readFileSync(
    path.join(REPO, 'tools/rea-fixtures/api__v1__profiles~includeHidden=true.json'), 'utf8',
));
const WORKFLOW = JSON.parse(readFileSync(
    path.join(REPO, 'tools/rea-fixtures/api__v1__workflow.json'), 'utf8',
));

const LISTABLE = FIXTURE.filter((r) => r.visibility !== 'hidden' && r.visibility !== 'deleted');
const RESTORABLE = FIXTURE.filter(
    (r) => r.visibility === 'hidden' && r.isDefault && r.metadata && r.metadata.filename,
);

/** A transport that records every call and answers from a scripted map. */
function recordingTransport(script = {}) {
    const calls = [];
    return {
        calls,
        request: async (path, options = {}) => {
            const method = options.method ?? 'GET';
            calls.push({ path, method, query: options.query ?? null, body: options.body ?? null });
            const answer = script[`${method} ${path}`] ?? script[path];
            if (typeof answer === 'function') return answer(options);
            if (answer) return answer;
            return { ok: false, kind: 'http', status: 503, message: 'no recording', problem: null };
        },
    };
}

const ok = (data, extra = {}) => ({ ok: true, status: 200, data, notModified: false, ...extra });

/** `buildPath` percent-encodes a path parameter, and a record id carries a colon. */
const LINEAGE = (id) => `/profiles/${encodeURIComponent(id)}/lineage`;

const memoryRouter = () => createStorageRouter({
    backends: {
        [LAYERS.kv]: createMemoryBackend(),
        [LAYERS.kvNumpad]: createMemoryBackend(),
        [LAYERS.local]: createMemoryBackend(),
        [LAYERS.session]: createMemoryBackend(),
    },
});

function build(script = {}) {
    const transport = recordingTransport({
        '/profiles': ok(FIXTURE),
        '/workflow': ok(WORKFLOW),
        'POST /machine/profile': ok(null),
        ...script,
    });
    const arm = createProfileArmStore({ transport });
    const storage = memoryRouter();
    const store = createProfileLibraryStore({ transport, storage, arm });
    return { transport, arm, storage, store };
}

describe('the store refuses to be built half-wired', () => {
    test('a transport, a storage router and an arm store are all required', () => {
        assert.throws(() => createProfileLibraryStore({}), /transport must be injected/);
        assert.throws(
            () => createProfileLibraryStore({ transport: recordingTransport() }),
            /storage router must be injected/,
        );
        assert.throws(
            () => createProfileLibraryStore({ transport: recordingTransport(), storage: memoryRouter() }),
            /arm store must be injected/,
        );
    });
});

describe('load — one listing read feeds the list, the highlight and the rail', () => {
    test('rule 1 partitions what the server served, and D6 keeps the hidden bundled set', async () => {
        const { store } = build();
        const state = await store.load();
        assert.equal(state.status, LIBRARY_STATUS.READY);
        assert.equal(state.records.length, FIXTURE.length);
        assert.equal(state.listable.length, LISTABLE.length);
        assert.equal(state.restorable.length, RESTORABLE.length);
    });

    test('ONE call to /profiles, with the ONE query form the mock serves', async () => {
        const { store, transport } = build();
        await store.load();
        const listings = transport.calls.filter((c) => c.path === '/profiles');
        assert.equal(listings.length, 1, 'reading the listing twice for two consumers is how they disagree');
        assert.deepEqual(listings[0].query, { includeHidden: true });
        assert.equal(listings[0].method, 'GET');
    });

    test('the 304 count is the transport\'s answer, mirrored not re-derived', async () => {
        const { store } = build({ '/profiles': ok(FIXTURE, { notModified: true }) });
        const state = await store.load();
        assert.equal(state.reads.listing, 1);
        assert.equal(state.reads.conditional, 1);
        assert.equal(state.listable.length, LISTABLE.length, 'a 304 carries the stored body');
    });

    test('a transport failure is a failed listing, with the envelope intact', async () => {
        const { store } = build({
            '/profiles': { ok: false, kind: 'http', status: 500, message: 'boom', problem: null },
        });
        const state = await store.load();
        assert.equal(state.status, LIBRARY_STATUS.FAILED);
        assert.equal(state.error.status, 500);
        assert.equal(state.listable.length, 0, 'and no rows are invented to fill the box');
        assert.equal(state.reads.failed, 1);
    });

    test('a failed workflow read costs the highlight, never the listing', async () => {
        const { store } = build({
            '/workflow': { ok: false, kind: 'http', status: 500, message: 'no machine', problem: null },
        });
        const state = await store.load();
        assert.equal(state.status, LIBRARY_STATUS.READY, 'the list is the screen');
        assert.equal(state.listable.length, LISTABLE.length);
        assert.equal(state.loaded.id, null);
        assert.equal(state.loaded.reason, 'noWorkflow');
    });
});

describe('R1 — the loaded profile, by id, marked while it is a title match', () => {
    test('the recorded report has no profile.id, so the answer is the marked title match', async () => {
        assert.equal(Object.hasOwn(WORKFLOW.profile, 'id'), false, 'R1 has not landed upstream');
        const { store } = build();
        const state = await store.load();
        const matches = FIXTURE.filter((r) => r.profile.title === WORKFLOW.profile.title);
        assert.equal(matches.length, 1);
        assert.equal(state.loaded.id, matches[0].id);
        assert.equal(state.loaded.known, true);
        assert.equal(state.loaded.provisional, true);
        assert.equal(state.loaded.source, 'title-match');
        assert.match(state.loaded.basis, /PROVISIONAL \(R1\)/);
    });

    test('THE TRAP: the report\'s top-level id is never read', async () => {
        const { store } = build();
        const state = await store.load();
        assert.notEqual(state.loaded.id, WORKFLOW.id,
            'workflow.dart:87 — the top-level id is the WORKFLOW\'s uuid, not the profile\'s');
    });

    test('a report carrying profile.id is R1 landing: by id, and no longer marked', async () => {
        const target = LISTABLE[7];
        const { store } = build({
            '/workflow': ok({
                ...WORKFLOW,
                profile: { ...WORKFLOW.profile, id: target.id, title: 'a title no record carries' },
            }),
        });
        const state = await store.load();
        assert.equal(state.loaded.id, target.id, 'read off the report, not matched by title');
        assert.equal(state.loaded.provisional, false);
        assert.equal(state.loaded.source, 'workflow-id');
        assert.match(state.loaded.basis, /R1 HAS LANDED/);
    });

    test('a duplicate title is reported with its candidates, never resolved', async () => {
        const counts = new Map();
        for (const r of FIXTURE) counts.set(r.profile.title, (counts.get(r.profile.title) ?? 0) + 1);
        const [title, n] = [...counts.entries()].find(([, count]) => count > 1);
        const { store } = build({
            '/workflow': ok({ ...WORKFLOW, profile: { ...WORKFLOW.profile, title } }),
        });
        const state = await store.load();
        assert.equal(state.loaded.id, null, 'never the first match');
        assert.equal(state.loaded.reason, 'ambiguous');
        assert.equal(state.loaded.candidates.length, n);
        assert.equal(state.loaded.provisional, false, 'an unresolved answer marks nothing');
    });

    test('the marking constant names the ask, the attribute and the swap', () => {
        assert.equal(R1_PROVISIONAL_HIGHLIGHT.ask, 'R1');
        assert.equal(R1_PROVISIONAL_HIGHLIGHT.marking, 'data-r1-provisional');
        assert.match(R1_PROVISIONAL_HIGHLIGHT.mustNotSurvive, /v1 sign-off/);
        assert.match(R1_PROVISIONAL_HIGHLIGHT.swapWhen, /profile\.id/);
    });
});

function fakeWorkflow() {
    const applied = [];
    return { applied, apply: async (patch, opts) => { applied.push({ patch, opts }); } };
}

describe('LOADING a profile is two writes, and the document is the second', () => {
    test('a 200 from the arm is followed by the workflow write that names the profile', async () => {
        const workflow = fakeWorkflow();
        const transport = recordingTransport({
            '/profiles': ok(FIXTURE), '/workflow': ok(WORKFLOW), 'POST /machine/profile': ok(null),
        });
        const store = createProfileLibraryStore({
            transport, storage: memoryRouter(), arm: createProfileArmStore({ transport }), workflow,
        });
        await store.load();
        const target = LISTABLE[0];
        store.select(target.id);
        await store.arm();

        assert.equal(workflow.applied.length, 1, 'the document is written exactly once');
        const { patch } = workflow.applied[0];
        assert.equal(patch.profile.title, target.profile.title,
            'POST /machine/profile arms the machine and touches no document — this is what '
            + 'makes GET /workflow, the rail and every recorded shot name the new profile');
        assert.deepEqual(Object.keys(patch).sort(), ['context', 'profile']);
    });

    test('A REFUSED PROFILE IS NOT WRITTEN INTO THE DOCUMENT', async () => {
        /* The machine cannot run it, so a document naming it would be the same lie in the
         * other direction — and it is the document every stored shot is stamped from. */
        const workflow = fakeWorkflow();
        const transport = recordingTransport({
            '/profiles': ok(FIXTURE),
            '/workflow': ok(WORKFLOW),
            'POST /machine/profile': {
                ok: false, kind: 'http', status: 400, message: 'Unsupported profile',
                problem: { error: 'Unsupported profile', message: 'no lever' },
            },
        });
        const store = createProfileLibraryStore({
            transport, storage: memoryRouter(), arm: createProfileArmStore({ transport }), workflow,
        });
        await store.load();
        store.select(LISTABLE[0].id);
        await store.arm();
        assert.deepEqual(workflow.applied, []);
    });

    test('the armed id is REMEMBERED, and it is what resolves a duplicated title', async () => {
        const storage = memoryRouter();
        const transport = recordingTransport({
            '/profiles': ok(FIXTURE), '/workflow': ok(WORKFLOW), 'POST /machine/profile': ok(null),
        });
        const store = createProfileLibraryStore({
            transport, storage, arm: createProfileArmStore({ transport }), workflow: fakeWorkflow(),
        });
        await store.load();
        const target = LISTABLE[0];
        store.select(target.id);
        await store.arm();
        assert.equal(await storage.get('loadedProfileId'), target.id,
            'the one moment the record id is known for certain');
    });

    const NO_MACHINE = {
        ok: false,
        kind: 'http',
        status: 500,
        message: 'POST /machine/profile -> 500',
        problem: { error: 'DeviceNotConnectedException: machine not connected' },
    };

    test('NO MACHINE STILL LOADS THE PROFILE — the document is written and the id remembered', async () => {
        const workflow = fakeWorkflow();
        const storage = memoryRouter();
        const transport = recordingTransport({
            '/profiles': ok(FIXTURE), '/workflow': ok(WORKFLOW), 'POST /machine/profile': NO_MACHINE,
        });
        const store = createProfileLibraryStore({
            transport, storage, arm: createProfileArmStore({ transport }), workflow,
        });
        await store.load();
        const target = LISTABLE[0];
        store.select(target.id);
        const armed = await store.arm();

        assert.equal(armed.status, 'failed', 'the transport fault is reported, not swallowed');
        assert.equal(store.get().refusal, null, 'and it is NOT dressed up as a refusal');
        assert.equal(workflow.applied.length, 1,
            'the document is what records "this is the profile we are on", and a machine '
            + 'that is not in the room has no opinion about it');
        assert.equal(workflow.applied[0].patch.profile.title, target.profile.title);
        assert.equal(await storage.get('loadedProfileId'), target.id,
            'the record id is remembered too — without it a duplicated title has nothing '
            + 'to break the tie with, which is the other half of the same bug');
    });

    test('the POST is still SENT first, and it is still the only thing that can refuse', async () => {
        const workflow = fakeWorkflow();
        const transport = recordingTransport({
            '/profiles': ok(FIXTURE), '/workflow': ok(WORKFLOW), 'POST /machine/profile': NO_MACHINE,
        });
        const store = createProfileLibraryStore({
            transport, storage: memoryRouter(), arm: createProfileArmStore({ transport }), workflow,
        });
        await store.load();
        store.select(LISTABLE[0].id);
        const before = transport.calls.length;
        await store.arm();
        const after = transport.calls.slice(before).map((c) => `${c.method} ${c.path}`);
        assert.equal(after[0], 'POST /machine/profile',
            'the machine is asked before anything else, so B9 can still see a refusal');
    });

    test('a store built with no workflow arms and writes nothing — the demo path', async () => {
        const { store, transport } = build();
        await store.load();
        store.select(LISTABLE[0].id);
        const armed = await store.arm();
        assert.equal(armed.status, 'armed');
        assert.equal(transport.calls.filter((c) => c.method === 'PUT').length, 0);
    });
});

describe('arm — the confirm half, and the refusal it can come back with', () => {
    test('arming sends the BARE profile to /machine/profile, once', async () => {
        const { store, transport } = build();
        await store.load();
        const target = LISTABLE[0];
        store.select(target.id);
        await store.arm();
        const armCalls = transport.calls.filter((c) => c.path === '/machine/profile');
        assert.equal(armCalls.length, 1);
        assert.equal(armCalls[0].method, 'POST');
        assert.equal(armCalls[0].body.title, target.profile.title,
            'the bare profile — POST /profiles takes it WRAPPED, and that asymmetry is real');
        assert.equal(armCalls[0].body.profile, undefined);
    });

    test('a typed 400 becomes a refusal on the store, with the server\'s own message', async () => {
        const message = 'This machine cannot run a Lever step.';
        const { store } = build({
            'POST /machine/profile': {
                ok: false,
                kind: 'http',
                status: 400,
                message: 'Unsupported profile',
                problem: { error: 'Unsupported profile', message },
            },
        });
        await store.load();
        store.select(LISTABLE[0].id);
        await store.arm();
        const state = store.get();
        assert.equal(state.refusal.kind, 'unsupported');
        assert.equal(state.refusal.message, message, 'verbatim — nothing here words a refusal');
        store.clearRefusal();
        assert.equal(store.get().refusal, null);
    });

    test('a 500 is a failure, not a refusal', async () => {
        const { store } = build({
            'POST /machine/profile': { ok: false, kind: 'http', status: 500, message: 'boom', problem: null },
        });
        await store.load();
        store.select(LISTABLE[0].id);
        await store.arm();
        assert.equal(store.get().refusal, null);
        assert.equal(store.get().armError.status, 500);
    });

    /* ═══════════════════════════════════ the highlight, which now asserts the truth */

    test('armingId names the record from before the first request until after the re-read', async () => {
        const workflow = fakeWorkflow();
        const transport = recordingTransport({
            '/profiles': ok(FIXTURE), '/workflow': ok(WORKFLOW), 'POST /machine/profile': ok(null),
        });
        const store = createProfileLibraryStore({
            transport, storage: memoryRouter(), arm: createProfileArmStore({ transport }), workflow,
        });
        await store.load();
        const target = LISTABLE[0];
        store.select(target.id);

        const seen = [];
        const stop = store.subscribe((state) => seen.push(state.armingId));
        assert.equal(seen[0], null, 'nothing is being loaded before the press');

        const inFlight = store.arm();
        assert.equal(store.get().armingId, target.id,
            'SYNCHRONOUSLY, before the first request — the mark moves on the press, not on '
            + 'the round trip, so nothing is lost by taking it off the screen');
        await inFlight;
        stop();

        assert.equal(store.get().armingId, null, 'and it hands over rather than sticking');
        assert.ok(seen.includes(target.id), 'the id was published, not merely held');
        assert.equal(seen[seen.length - 1], null);
    });

    test('A REFUSAL PUTS THE HIGHLIGHT BACK, and that is the one time it should', async () => {
        const workflow = fakeWorkflow();
        const transport = recordingTransport({
            '/profiles': ok(FIXTURE),
            '/workflow': ok(WORKFLOW),
            'POST /machine/profile': {
                ok: false, kind: 'http', status: 400, message: 'Unsupported profile',
                problem: { error: 'Unsupported profile', message: 'no lever' },
            },
        });
        const store = createProfileLibraryStore({
            transport, storage: memoryRouter(), arm: createProfileArmStore({ transport }), workflow,
        });
        await store.load();
        const held = store.get().loaded.id;
        store.select(LISTABLE[0].id);
        await store.arm();

        assert.deepEqual(workflow.applied, [], 'a refused profile is never written down');
        assert.equal(store.get().armingId, null);
        assert.equal(store.get().loaded.id, held, 'the loaded profile did not move');
        assert.equal(store.get().refusal.kind, 'unsupported', 'and the surface has its sentence');
    });

    test('arming without a selection calls nothing', async () => {
        const { store, transport } = build();
        await store.load();
        store.select(null);
        assert.equal(store.get().selectedId, null, 'the fixture cleared its selection');
        assert.equal(await store.arm(), null);
        assert.equal(transport.calls.filter((c) => c.path === '/machine/profile').length, 0);
    });
});

describe('hide — the action the restore loop was built around', () => {
    test('it reaches DELETE /profiles/<id>, which is a SOFT delete on the server', async () => {
        const target = LISTABLE[1];
        const encoded = encodeURIComponent(target.id);
        const { store, transport } = build({ [`DELETE /profiles/${encoded}`]: ok({ success: true }) });
        await store.load();
        await store.hide(target.id);
        const call = transport.calls.find((c) => c.method === 'DELETE');
        assert.ok(call, 'the route was reached');
        assert.equal(call.path, `/profiles/${encoded}`,
            'the id is percent-encoded by the route builder, and the handler decodes it');
    });

    test('and re-reads the listing, because the answer is the re-read and never the 200',
        async () => {
            const target = LISTABLE[1];
        const encoded = encodeURIComponent(target.id);
            const { store, transport } = build({ [`DELETE /profiles/${encoded}`]: ok({ success: true }) });
            await store.load();
            const before = transport.calls.filter((c) => c.path === '/profiles').length;
            await store.hide(target.id);
            assert.equal(transport.calls.filter((c) => c.path === '/profiles').length, before + 1);
        });

    test('a 404 is "already gone" and still re-reads', async () => {
        const target = LISTABLE[1];
        const encoded = encodeURIComponent(target.id);
        const { store, transport } = build({
            [`DELETE /profiles/${encoded}`]:
                { ok: false, kind: 'http', status: 404, message: 'Not found', problem: null },
        });
        await store.load();
        const before = transport.calls.filter((c) => c.path === '/profiles').length;
        await store.hide(target.id);
        assert.equal(transport.calls.filter((c) => c.path === '/profiles').length, before + 1,
            'a profile that is already gone is not a fault');
    });

    test('any other failure holds the listing where it was', async () => {
        const target = LISTABLE[1];
        const encoded = encodeURIComponent(target.id);
        const { store, transport } = build({
            [`DELETE /profiles/${encoded}`]:
                { ok: false, kind: 'http', status: 500, message: 'boom', problem: null },
        });
        await store.load();
        const before = transport.calls.filter((c) => c.path === '/profiles').length;
        await store.hide(target.id);
        assert.equal(transport.calls.filter((c) => c.path === '/profiles').length, before,
            'a 500 must not be reported as a hide by re-reading over it');
    });

    test('an id the store does not know reaches no route at all', async () => {
        const { store, transport } = build();
        await store.load();
        await store.hide('profile:nothing-like-this');
        assert.equal(transport.calls.filter((c) => c.method === 'DELETE').length, 0);
    });

    test('the selection goes with it', async () => {
        const target = LISTABLE[1];
        const encoded = encodeURIComponent(target.id);
        const { store } = build({ [`DELETE /profiles/${encoded}`]: ok({ success: true }) });
        await store.load();
        store.select(target.id);
        await store.hide(target.id);
        const after = store.get().selectedId;
        assert.notEqual(after, target.id, 'the hidden profile must not still be selected');
        if (after !== null) {
            assert.ok(store.get().listable.some((r) => r.id === after),
                'whatever is selected has to be on the list beside the pane');
        }
    });
});

describe('D6 — restore to factory, and the half that is deferred', () => {
    test('the path parameter is the BUNDLE FILENAME off the record\'s metadata', async () => {
        const first = RESTORABLE[0];
        const restored = { ...first, visibility: 'visible' };
        const { store, transport } = build({
            [`POST /profiles/restore/${first.metadata.filename}`]: ok(restored),
        });
        await store.load();
        await store.restoreToFactory(first.id);
        const call = transport.calls.find((c) => c.path.startsWith('/profiles/restore/'));
        assert.ok(call, 'the route was reached');
        assert.equal(call.method, 'POST');
        assert.equal(call.path, `/profiles/restore/${first.metadata.filename}`);
        assert.equal(store.get().restore.status, RESTORE_STATUS.RESTORED);
    });

    test('a restore re-reads the listing, because the server\'s answer changed', async () => {
        const first = RESTORABLE[0];
        const { store, transport } = build({
            [`POST /profiles/restore/${first.metadata.filename}`]: ok({ ...first, visibility: 'visible' }),
        });
        await store.load();
        const before = transport.calls.filter((c) => c.path === '/profiles').length;
        await store.restoreToFactory(first.id);
        const after = transport.calls.filter((c) => c.path === '/profiles').length;
        assert.equal(after, before + 1);
    });

    test('a record with no bundle filename cannot reach the route at all', async () => {
        const notBundled = LISTABLE.find((r) => !restoreFilenameOf(r));
        assert.ok(notBundled, 'the fixture has profiles that were never bundled');
        const { store, transport } = build();
        await store.load();
        await store.restoreToFactory(notBundled.id);
        assert.equal(store.get().restore.status, RESTORE_STATUS.FAILED);
        assert.equal(transport.calls.filter((c) => c.path.startsWith('/profiles/restore/')).length, 0,
            'no call is made that could only fail');
    });

    test('a failed restore is held, and the listing is not re-read', async () => {
        const first = RESTORABLE[0];
        const { store, transport } = build({
            [`POST /profiles/restore/${first.metadata.filename}`]:
                { ok: false, kind: 'http', status: 404, message: 'Not found', problem: null },
        });
        await store.load();
        const before = transport.calls.filter((c) => c.path === '/profiles').length;
        await store.restoreToFactory(first.id);
        assert.equal(store.get().restore.status, RESTORE_STATUS.FAILED);
        assert.equal(store.get().restore.error.status, 404);
        assert.equal(transport.calls.filter((c) => c.path === '/profiles').length, before);
    });

    test('THE PURGE HALF LANDED, AND IT IS THE ONE IRREVERSIBLE ROUTE', async () => {
        assert.equal(D6_PURGE_IS_LANDED.decision, 'D6');
        assert.equal(D6_PURGE_IS_LANDED.routeId, 'deleteProfilesByIdPurge');

        const target = LISTABLE[1];
        const encoded = encodeURIComponent(target.id);
        const { store, transport } = build({ [`DELETE /profiles/${encoded}/purge`]: ok({ success: true }) });
        await store.load();
        store.select(target.id);
        await store.purge(target.id);

        const purges = transport.calls.filter((c) => c.path.endsWith('/purge'));
        assert.equal(purges.length, 1, 'exactly one call, and no retry');
        assert.equal(purges[0].method, 'DELETE');
        assert.notEqual(store.get().selectedId, target.id, 'the removed profile is not selected');
    });

    test('a purge of something already gone is not a failure', async () => {
        const target = LISTABLE[1];
        const encoded = encodeURIComponent(target.id);
        const { store } = build({
            [`DELETE /profiles/${encoded}/purge`]: { status: 404, body: { message: 'gone' } },
        });
        await store.load();
        store.select(target.id);
        await store.purge(target.id);
        assert.notEqual(store.get().selectedId, target.id);
    });

    test('the screen asks before it calls, and the question says what it costs', () => {
        const screen = readFileSync(path.join(REPO, 'src/screens/selector-screen.js'), 'utf8');
        assert.match(screen, /id="confirm-remove"/,
            'the purge is behind its own confirm, not the hide one');
        assert.match(screen, /It cannot be undone/,
            'and the confirm says plainly that it cannot be undone');
        assert.match(screen, /Restore will not bring a bundled profile back/,
            'and that Restore is not a way back from it');
        assert.match(screen, /confirm-label=\$\{t\('Delete'\)\}/,
            'and the button says the plain word, now that Hide is the other one');
        assert.match(screen, /tone="destructive"/);
    });
});

describe('B11 / Q7 — the versions surface', () => {
    test('the lineage route is reached with the selected id', async () => {
        const subject = LISTABLE[2];
        const lineage = [LISTABLE[2], LISTABLE[3]];
        const { store, transport } = build({ [LINEAGE(subject.id)]: ok(lineage) });
        await store.load();
        await store.versionsOf(subject.id);
        assert.equal(store.get().versions.status, VERSIONS_STATUS.READY);
        assert.equal(store.get().versions.records.length, 2);
        assert.ok(transport.calls.some((c) => c.path === LINEAGE(subject.id)));
    });

    test('a ONE-ENTRY lineage is "no other versions" — the entry is the profile itself', async () => {
        const subject = LISTABLE[2];
        const { store } = build({ [LINEAGE(subject.id)]: ok([subject]) });
        await store.load();
        await store.versionsOf(subject.id);
        assert.equal(store.get().versions.status, VERSIONS_STATUS.NONE,
            'getLineage always adds the profile itself, so length 1 IS the empty answer');
        assert.equal(store.get().versions.records.length, 1,
            'and the served list is published as it came, not blanked to prove a point');
    });

    test('a fault is a failure, and a MISSING id arrives as one — a 500, not a 404', async () => {
        const subject = LISTABLE[2];
        const { store } = build({
            [LINEAGE(subject.id)]: {
                ok: false, kind: 'http', status: 500,
                message: 'Invalid argument(s): Profile not found: x', problem: null,
            },
        });
        await store.load();
        await store.versionsOf(subject.id);
        assert.equal(store.get().versions.status, VERSIONS_STATUS.FAILED,
            'the handler has no `on ArgumentError` clause, so an unknown id is a server fault');
    });

    test('and a 404 would be a fault too — the branch that made one mean NONE is gone', async () => {
        const subject = LISTABLE[2];
        const { store } = build({
            [LINEAGE(subject.id)]:
                { ok: false, kind: 'http', status: 404, message: 'Profile not found', problem: null },
        });
        await store.load();
        await store.versionsOf(subject.id);
        assert.equal(store.get().versions.status, VERSIONS_STATUS.FAILED,
            'the route cannot answer 404 at the pin; special-casing one is A7 surface');
    });

    test('an empty 200 is also "no other versions"', async () => {
        const subject = LISTABLE[2];
        const { store } = build({ [LINEAGE(subject.id)]: ok([]) });
        await store.load();
        await store.versionsOf(subject.id);
        assert.equal(store.get().versions.status, VERSIONS_STATUS.NONE);
    });
});

describe('the favourite rail — rules 4 and 5 through the store', () => {
    test('a first launch seeds the rail and does NOT mark it user-initialised', async () => {
        const { store } = build();
        const state = await store.load();
        const filled = Object.values(state.favourites.assignments).filter(Boolean);
        assert.ok(filled.length > 0, 'rule 4 seeded it');
        assert.equal(state.favourites.seeded, false,
            'rule 5: auto-populate leaves the run retryable');
    });

    test('a user-driven save marks it, so clearing every slot is remembered as a choice', async () => {
        const { store } = build();
        await store.load();
        await store.setFavourite(0, LISTABLE[0].id);
        assert.equal(store.get().favourites.seeded, true);
        assert.equal(store.get().favourites.assignments[0], LISTABLE[0].id);
    });

    test('a slot can be cleared, and the first free slot is then that one', async () => {
        const { store } = build();
        await store.load();
        const before = store.firstEmptySlot();
        await store.setFavourite(2, null);
        assert.equal(store.get().favourites.assignments[2], null);
        assert.equal(store.firstEmptySlot(), before === null ? 2 : Math.min(before, 2));
    });

    test('a slot outside 0..4 is refused rather than written', async () => {
        const { store } = build();
        await store.load();
        const before = { ...store.get().favourites.assignments };
        await store.setFavourite(9, LISTABLE[0].id);
        assert.deepEqual(store.get().favourites.assignments, before);
    });

    test('favouriteEntries is five long and an EMPTY SLOT IS A VALUE', async () => {
        const { store } = build();
        await store.load();
        await store.setFavourite(3, null);
        const entries = store.favouriteEntries();
        assert.equal(entries.length, 5);
        assert.equal(entries[3], null,
            'profileManager.js:450 threw a ReferenceError on exactly this input');
        assert.ok(entries.filter(Boolean).every((e) => typeof e.name === 'string' && e.name.length > 0),
            'and a filled slot carries rule 2\'s short label');
    });
});

describe('the favourite rail — rule 6 heals a slot pointing at a hidden record', () => {
    /* A corpus with both shapes in it, laid over the fixture so the rest of the store
     * behaves normally. `hid` is hidden; `tip` is the visible row that replaced it. */
    const HEAL_FIXTURE = [
        ...FIXTURE,
        {
            id: 'profile:healtest-hid', profile: { title: 'Heal Test', version: '2', steps: [] },
            visibility: 'hidden', isDefault: false, parentId: null, metadata: null,
            createdAt: '2026-08-27T10:00:00', updatedAt: '2026-08-27T11:00:00',
        },
        {
            id: 'profile:healtest-tip', profile: { title: 'Heal Test', version: '2', steps: [] },
            visibility: 'visible', isDefault: false, parentId: 'profile:healtest-hid', metadata: null,
            createdAt: '2026-08-27T11:00:00', updatedAt: '2026-08-27T11:00:00',
        },
    ];

    const buildHealer = () => {
        const transport = recordingTransport({
            '/profiles': ok(HEAL_FIXTURE),
            '/workflow': ok(WORKFLOW),
            'POST /machine/profile': ok(null),
        });
        const storage = memoryRouter();
        const store = createProfileLibraryStore({
            transport, storage, arm: createProfileArmStore({ transport }),
        });
        return { store, storage };
    };

    test('load() heals a stale slot AND persists the repair', async () => {
        const { store, storage } = buildHealer();
        await storage.set(FAVOURITES_KEY, {
            0: 'profile:healtest-hid', 1: null, 2: null, 3: null, 4: null,
        });
        await storage.set(FAVOURITES_SEEDED_KEY, true);

        const state = await store.load();
        assert.equal(state.favourites.assignments[0], 'profile:healtest-tip',
            'the rail in memory names the living record');
        const stored = await storage.get(FAVOURITES_KEY);
        assert.equal(stored[0], 'profile:healtest-tip',
            'and so does storage — a repair only in memory is repeated every launch, and '
            + 'every other reader of the key goes on seeing the stale id');
    });

    test('the repair does NOT claim the user chose — rule 5 survives rule 6', async () => {
        const { store, storage } = buildHealer();
        await storage.set(FAVOURITES_KEY, { 0: 'profile:healtest-hid', 1: null, 2: null, 3: null, 4: null });
        // Deliberately NOT seeded: this rail was auto-populated, not chosen.
        const state = await store.load();
        assert.equal(state.favourites.assignments[0], 'profile:healtest-tip');
        assert.equal(state.favourites.seeded, false,
            'housekeeping must not mark a rail user-initialised');
        assert.equal(await storage.get(FAVOURITES_SEEDED_KEY), undefined);
    });

    test('a healthy rail is not rewritten — the ordinary launch writes nothing', async () => {
        const { store, storage } = buildHealer();
        await storage.set(FAVOURITES_KEY, { 0: 'profile:healtest-tip', 1: null, 2: null, 3: null, 4: null });
        await storage.set(FAVOURITES_SEEDED_KEY, true);
        let writes = 0;
        const inner = storage.set.bind(storage);
        storage.set = (...args) => { if (args[0] === FAVOURITES_KEY) writes += 1; return inner(...args); };
        await store.load();
        assert.equal(writes, 0, 'nothing moved, so nothing was written');
    });

    test('healFavourites() repairs on demand and reports what it moved', async () => {
        const { store, storage } = buildHealer();
        await storage.set(FAVOURITES_KEY, { 0: 'profile:healtest-tip', 1: null, 2: null, 3: null, 4: null });
        await storage.set(FAVOURITES_SEEDED_KEY, true);
        await store.load();
        const staleRail = { 0: 'profile:healtest-hid', 1: null, 2: null, 3: null, 4: null };
        await storage.set(FAVOURITES_KEY, staleRail);
        await store.setFavourite(0, 'profile:healtest-hid');

        const changes = await store.healFavourites();
        assert.equal(changes.length, 1);
        assert.deepEqual(
            { slot: changes[0].slot, from: changes[0].from, to: changes[0].to },
            { slot: 0, from: 'profile:healtest-hid', to: 'profile:healtest-tip' },
        );
        assert.equal(store.get().favourites.assignments[0], 'profile:healtest-tip');
        assert.equal((await storage.get(FAVOURITES_KEY))[0], 'profile:healtest-tip');
    });

    test('healFavourites() on a clean rail is silent and writes nothing', async () => {
        const { store, storage } = buildHealer();
        await storage.set(FAVOURITES_KEY, { 0: 'profile:healtest-tip', 1: null, 2: null, 3: null, 4: null });
        await storage.set(FAVOURITES_SEEDED_KEY, true);
        await store.load();
        let writes = 0;
        const inner = storage.set.bind(storage);
        storage.set = (...args) => { if (args[0] === FAVOURITES_KEY) writes += 1; return inner(...args); };
        assert.deepEqual(await store.healFavourites(), []);
        assert.equal(writes, 0);
    });

    test('setFavourite BEFORE the first load still writes five slots, not one', async () => {
        const { store, storage } = buildHealer();
        await store.setFavourite(2, 'profile:healtest-tip');   // no load() first, on purpose
        const stored = await storage.get(FAVOURITES_KEY);
        assert.deepEqual(Object.keys(stored).sort(), ['0', '1', '2', '3', '4'],
            'a write is a whole rail, whatever state the store is in');
        assert.equal(stored[2], 'profile:healtest-tip');
    });

    test('setFavourite on a full rail leaves the other four alone', async () => {
        const { store, storage } = buildHealer();
        await storage.set(FAVOURITES_KEY, {
            0: LISTABLE[0].id, 1: LISTABLE[1].id, 2: LISTABLE[2].id, 3: LISTABLE[3].id, 4: null,
        });
        await storage.set(FAVOURITES_SEEDED_KEY, true);
        await store.load();
        await store.setFavourite(4, LISTABLE[4].id);
        const stored = await storage.get(FAVOURITES_KEY);
        assert.deepEqual(Object.keys(stored).sort(), ['0', '1', '2', '3', '4']);
        assert.equal(stored[0], LISTABLE[0].id, 'and the other four survived it');
        assert.equal(stored[4], LISTABLE[4].id);
    });

    test('an id the listing cannot resolve is left in its slot, never cleared', async () => {
        const { store, storage } = buildHealer();
        await storage.set(FAVOURITES_KEY, { 0: 'profile:gone-from-the-server', 1: null, 2: null, 3: null, 4: null });
        await storage.set(FAVOURITES_SEEDED_KEY, true);
        const state = await store.load();
        assert.equal(state.favourites.assignments[0], 'profile:gone-from-the-server',
            'A7 — a listing that failed must not cost the user a favourite');
    });
});

describe('matchProfiles — the one filter both the screen and the store use', () => {
    test('an empty query is everything, and the array is a copy', () => {
        const out = matchProfiles(LISTABLE, '   ');
        assert.equal(out.length, LISTABLE.length);
        assert.notEqual(out, LISTABLE);
    });

    test('the match is on the WHOLE title, so a family prefix finds the family', () => {
        const family = LISTABLE.filter((r) => (r.profile.title || '').startsWith('Tea portafilter'));
        assert.ok(family.length > 1, 'the fixture carries the family');
        assert.equal(matchProfiles(LISTABLE, 'Tea portafilter').length, family.length);
    });

    test('it is case-insensitive and matches the author too', () => {
        const byAuthor = LISTABLE.filter((r) => (r.profile.author || '').toLowerCase().includes('decent'));
        assert.ok(byAuthor.length > 0);
        assert.ok(matchProfiles(LISTABLE, 'DECENT').length >= byAuthor.length);
    });

    test('a miss is an empty list, not a failure', () => {
        assert.deepEqual(matchProfiles(LISTABLE, 'zzz-no-such-profile'), []);
    });
});

describe('P12 — the keyboard, as arithmetic', () => {
    test('Down and Up move by one and CLAMP at both ends', () => {
        assert.equal(nextActiveIndex('ArrowDown', 0, 10), 1);
        assert.equal(nextActiveIndex('ArrowUp', 5, 10), 4);
        assert.equal(nextActiveIndex('ArrowDown', 9, 10), 9, 'no wrap to the top');
        assert.equal(nextActiveIndex('ArrowUp', 0, 10), 0, 'no wrap to the bottom');
    });

    test('Home and End go to the ends', () => {
        assert.equal(nextActiveIndex('Home', 5, 10), 0);
        assert.equal(nextActiveIndex('End', 5, 10), 9);
    });

    test('Page moves by the page step, clamped', () => {
        assert.equal(nextActiveIndex('PageDown', 0, 100), PAGE_STEP);
        assert.equal(nextActiveIndex('PageUp', 3, 100), 0);
        assert.equal(nextActiveIndex('PageDown', 95, 100), 99);
    });

    test('Enter and Space choose; everything else travels', () => {
        assert.equal(nextActiveIndex('Enter', 3, 10), 'choose');
        assert.equal(nextActiveIndex(' ', 3, 10), 'choose');
        assert.equal(nextActiveIndex('Tab', 3, 10), null, 'Tab must leave the listbox');
        assert.equal(nextActiveIndex('a', 3, 10), null, 'no typeahead — the search field owns letters');
        assert.equal(nextActiveIndex('Escape', 3, 10), null);
    });

    test('an empty list answers null to every key', () => {
        for (const key of ['ArrowDown', 'Home', 'End', 'Enter', ' ']) {
            assert.equal(nextActiveIndex(key, 0, 0), null);
        }
    });

    test('an out-of-range index is treated as the first row rather than throwing', () => {
        assert.equal(nextActiveIndex('ArrowDown', -1, 10), 1);
        assert.equal(nextActiveIndex('ArrowDown', undefined, 10), 1);
    });
});

describe('option ids round-trip, in one spelling', () => {
    test('there and back', () => {
        const id = LISTABLE[0].id;
        assert.equal(recordIdFromOptionId(optionIdFor(id)), id);
        assert.equal(recordIdFromOptionId('not-an-option-id'), null);
    });
});

describe('listboxGroups is profile-folders.js, called once, over a title sort', () => {
    test('the recorded families come back as groups, in TITLE order', () => {
        const groups = listboxGroups(LISTABLE);
        const flat = groups.flatMap((g) => g.entries);
        assert.equal(flat.length, LISTABLE.length, 'every record is in exactly one group');
        assert.equal(new Set(flat.map((r) => r.id)).size, LISTABLE.length, 'and in exactly one');
        assert.ok(groups.some((g) => g.folder), 'the fixture really does carry families');

        const sorted = [...LISTABLE].sort((a, b) => {
            const left = a.profile?.title || '';
            const right = b.profile?.title || '';
            if (!left || !right) return 0;
            return left.localeCompare(right);
        });
        const firstSeen = groups.map((g) => sorted.findIndex((r) => r.id === g.entries[0].id));
        assert.deepEqual(firstSeen, [...firstSeen].sort((a, b) => a - b),
            'the groups are in the order their first members SORT');
        assert.equal(flat[0].id, sorted[0].id,
            'and the first row is the first title, not the first record served');

        /* AND THE MEMBERS INSIDE A FAMILY ARE SORTED TOO, which the group order alone
         * would not catch: a folder whose members arrived out of order would still have
         * its first member in the right place. */
        for (const group of groups.filter((g) => g.folder && g.entries.length > 1)) {
            const titles = group.entries.map((r) => r.profile?.title || '');
            assert.deepEqual(titles, [...titles].sort((a, b) => a.localeCompare(b)),
                `the members of "${group.folder}" are in title order`);
        }
    });

    test('folders off is one ungrouped run', () => {
        const groups = listboxGroups(LISTABLE, { folders: false });
        assert.equal(groups.length, 1);
        assert.equal(groups[0].folder, null);
    });
});
