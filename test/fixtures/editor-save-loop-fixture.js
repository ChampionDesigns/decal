/**
 * editor-save-loop-fixture — THE WHOLE APP, DRIVEN THROUGH ONE SAVE AND BACK.
 *
 * Written 27 August 2026 for Ben's report: "the profile editor, the save button doesn't
 * seem to be doing anything. I can make a change, hit save exit and go back into the
 * editor and it dosn't seem to have the change."
 *
 * ===========================================================================
 * WHY A SECOND FULL-APP FIXTURE, AND NOT A THIRD TEST ON THE EDITOR HARNESS
 * ===========================================================================
 * `test/harness/editor.js seatProfile()` mounts the editor over a REAL
 * `createProfileEditorStore` and a transport the suite controls, and it already proves —
 * green, since fix run 4 — that a real control press counts, that the band reads
 * "Save (1)", that the press POSTs /profiles with the edit on the wire, and that the
 * server's answer is re-seated. Every one of those assertions is true and the bug shipped
 * anyway, because the bug is not IN the editor. It is in what the rest of the app does
 * with the record the editor just created — and an editor mounted alone has no rest of
 * the app to get that wrong.
 *
 * So this fixture builds the shipping shell: `createAppBoot` (the real transport, the real
 * library store, the real editor store and the ONE subscription that now joins them),
 * `<app-root>` with the real route table, and the real `<selector-screen>` and
 * `<editor-screen>` loaded through `index.html`'s importmap. The trip a test takes is the
 * trip Ben took: pick a row, press Edit, press the matrix's own +, press Save, press
 * Cancel to leave, press Edit again.
 *
 * ===========================================================================
 * THE SERVER HAS TO REMEMBER, WHICH IS THE ONE THING THE CORPUS CANNOT DO
 * ===========================================================================
 * `tools/mock_rea.py` answers 501 to `POST /api/v1/profiles`, deliberately and correctly:
 * the route's success body is a typed `ProfileRecord` and "a mock that invents one teaches
 * the client a server that does not exist". `app-shell-fixture.js` serves the same corpus
 * read-only for the same reason.
 *
 * A save loop cannot be measured against either. The defect lives in the SECOND read of
 * `/profiles` — whether the listing the app comes back to carries the record the save
 * created, and whether the app is still pointing at the parent — so the fixture needs a
 * server with a memory. It is the smallest one that is still honest:
 *
 *   * `GET /api/v1/profiles` answers the RECORDED 147-record listing plus whatever this
 *     session created. The recording is untouched; the additions are appended.
 *   * `POST /api/v1/profiles` is `ProfileController.create` as this tree already documents
 *     it (`profile-editor-store.js`, read off the handler at pin 2b047d02): the body is
 *     wrapped, a NEW record is stored, `parentId` is carried through, the answer is 201
 *     with the whole ProfileRecord. That is B11's path and DQ-629's default.
 *   * Everything else falls through to the corpus, and a path with no recording answers
 *     503 with the mock's own sentence — the miss IS an answer and the shell must survive
 *     it (`app-shell-fixture.js` states the same rule).
 *
 * WHAT IT DELIBERATELY DOES NOT MODEL is content addressing: a real `create` computes the
 * id from the profile and returns the EXISTING record when that content is already stored,
 * without applying the parentId. Modelling it would mean transcribing `profile_hash.dart`
 * into a test fixture, which is the B10 defect wearing a lab coat — the client is not
 * allowed to know that rule, so neither is the thing that stands in for the server. The
 * ids here are serial, which is enough for every question this suite asks: does the app
 * follow the record the server named.
 *
 * THE SOCKETS ARE FAKE AND NOTHING IS PUSHED THROUGH THEM. This suite is about REST and a
 * route swap; the machine feed is not part of the trip.
 *
 * NODE-SAFE SHAPE, as every browser-only file under test/ must be.
 */

export let ready;

if (typeof HTMLElement !== 'undefined') {

const { createAppBoot } = await import('../../src/lib/app-boot.js');
await import('../../src/components/app-root.js');

/** `mock_rea.py`'s `_key`, transcribed — the same rule `app-shell-fixture.js` transcribes. */
function fixtureKey(pathWithQuery) {
    const safe = pathWithQuery.replace(/^\/+|\/+$/g, '').replace(/\//g, '__')
        .replace(/\?/g, '~').replace(/&/g, '~');
    return `${(safe || 'root').slice(0, 180)}.json`;
}

const LISTING_KEY = 'api__v1__profiles~includeHidden=true.json';
const WORKFLOW_KEY = 'api__v1__workflow.json';

const calls = [];
/** What this session's POSTs stored, in order. The server's memory. */
const created = [];
/**
 * `id -> {visibility}`. What this session's visibility writes changed, applied over BOTH
 * the recording and this session's own records — the recording is a file and stays one.
 */
const overrides = new Map();
let recorded = null;
let serial = 0;

/**
 * ===========================================================================
 * THE MACHINE'S HALF, ADDED 27 AUGUST 2026 — WHY THIS FIXTURE GREW A DOCUMENT
 * ===========================================================================
 * Until today this server answered `/api/v1/profiles` and let everything else fall through
 * to the recording, which was enough while every question in the suite was about the
 * LIBRARY: does the listing carry the saved record, and is the app pointing at it.
 *
 * Ben's bug turned out to have a second half that the library alone cannot see.
 * `<app-root>` resolves the Live band's "Edit profile" through `library.get().loaded` — the
 * profile THE MACHINE IS HOLDING, not the one the selector has highlighted — and a save
 * deliberately did not move that. So every edit started from the same fixed point and the
 * versions came out as SIBLINGS off one ancestor rather than as a chain. Measured on Ben's
 * tablet over ADB, 27 August 2026: three of the five visible "Pressure Tuning" rows shared
 * one parent, `profile:ea352e2e…`, which was the record the machine was holding. His words:
 * "I can make a change, hit save exit and go back into the editor and it dosn't seem to
 * have the change."
 *
 * A fixture with no armed profile cannot state that premise, let alone fail on it. What
 * `app-boot.js adoptSavedProfile()` now decides is a comparison between the saved record
 * and the HELD one, so the held one has to be a real, settable, readable fact of this
 * server. Three things make it one:
 *
 *   * `GET /api/v1/workflow` serves a document this session can move, seeded from the
 *     recording so every assertion written against this fixture before today still means
 *     what it meant. It was already being served — by the fallthrough, straight off disk —
 *     so intercepting it changes nothing until somebody writes to it.
 *   * `PUT /api/v1/workflow` merges the patch and answers 200 with the WHOLE document,
 *     which is what `workflow-store.js write()` reads ("a 200 publishes the SERVER'S OWN
 *     document, because the machine clamps"). The fallthrough used to answer this with a
 *     GET of the recording — a 200 carrying the document as it was BEFORE the write, which
 *     is the one answer a write must never give.
 *   * `POST /api/v1/machine/profile` — the arm route — records the bare profile it was
 *     handed and answers 200 with no body, which is the contract row verbatim
 *     (`postMachineProfile`: 200 body null = armed). Before today it fell through to a
 *     503 MISS, so an arm could not succeed here at all and a test asserting one would
 *     have been asserting against a broken server rather than against the app.
 *
 * THE TWO RECORDED LISTS ARE THE ORACLE. `armCalls` and `workflowWrites` are what a test
 * reads to say "the machine was told" or "the machine was left alone" — the second being
 * the more important claim, and one that can only be made against a server that would have
 * noticed. The app's own belief (`library.get().loaded`) is read separately, through
 * `held()`, precisely so a test can catch the app and the machine disagreeing.
 */

/** Every body `POST /api/v1/machine/profile` was handed, in order. The machine's ear. */
const armCalls = [];
/** Every body `PUT /api/v1/workflow` was handed, in order. The document's ear. */
const workflowWrites = [];
/** The served workflow document. Null until the first read seeds it from the recording. */
let workflowDoc = null;
/** Which record `hold()` seated, so a reader can report the premise beside the belief. */
let heldSeatedId = null;
/** The recording, read once and never mutated — `workflowDoc` is the copy that moves. */
let recordedWorkflow = null;

async function recordedListing() {
    if (!recorded) {
        const res = await fetch(`${location.origin}/tools/rea-fixtures/${LISTING_KEY}`, { cache: 'no-store' });
        recorded = await res.json();
    }
    return recorded;
}

/**
 * The workflow document as the server would serve it.
 *
 * SEEDED FROM THE RECORDING, ON FIRST READ. The capture's document names
 * "Extractamundo Dos! (2)", whose title is UNIQUE in the recorded 147 — see `hold()` for
 * why that matters — so the default state of this server is a machine holding a profile
 * that R1 can resolve, which is what the bench machine was doing when the capture was
 * taken. Nothing here invents a held profile; `hold()` is how a test changes which one.
 */
async function workflowDocument() {
    if (!recordedWorkflow) {
        const res = await fetch(`${location.origin}/tools/rea-fixtures/${WORKFLOW_KEY}`, { cache: 'no-store' });
        recordedWorkflow = await res.json();
    }
    if (!workflowDoc) workflowDoc = structuredClone(recordedWorkflow);
    return workflowDoc;
}

/** The whole store as the server would serve it: recording + session writes + overrides. */
async function allRecords() {
    const override = (record) => (overrides.has(record.id)
        ? { ...record, ...overrides.get(record.id) }
        : record);
    return [...(await recordedListing()), ...created].map(override);
}

/**
 * ===========================================================================
 * CONTENT ADDRESSING, ADDED 27 AUGUST 2026 — AND THE RULE THIS FIXTURE CHANGED
 * ===========================================================================
 * This file used to say it deliberately did NOT model content addressing, because
 * "transcribing `profile_hash.dart` into a test fixture is the B10 defect wearing a lab
 * coat". THE HALF OF THAT WHICH IS RIGHT still stands and is the whole of B10: THE CLIENT
 * may not know ReaPrime's hashing rule. The half that was wrong is that the same
 * prohibition applied to the thing STANDING IN FOR THE SERVER — a server's stand-in
 * knowing the server's rules is what makes it a stand-in rather than a prop.
 *
 * IT HAD TO CHANGE BECAUSE THE FEATURE RUNS THROUGH THIS BRANCH. Restoring an older
 * version loads its steps into the draft and Save posts them back, so the content the
 * server receives is content it already has: `ProfileController.create` returns the
 * EXISTING record, hidden, and applies no parentId (`profile_controller.dart:200-206`).
 * A fixture with serial ids cannot produce that answer, so against it the restore path
 * looks like an ordinary create and the one bug that path can have — the profile
 * disappearing from the list because both records end up hidden — is invisible. A fixture
 * that cannot fail the way production fails is not measuring anything.
 *
 * NO HASH IS TRANSCRIBED, only the INPUT SET, which `profile-editor-store.js`'s own header
 * has stated in prose since it was written: the id's inputs are version, beverage_type,
 * steps, tank_temperature, target_weight, target_volume and target_volume_count_start
 * (`profile_hash.dart calculateProfileHash`). Title, author and notes are NOT among them —
 * they are the metadata hash — so two records differing only in title collide here exactly
 * as they collide on the machine. Equality stands in for the sha256: same inputs, same
 * record, which is the only property any test here asks about.
 *
 * IDS STAY SERIAL for content the store has never seen, so every assertion written against
 * this fixture before today means what it meant.
 */
const CONTENT_KEYS = Object.freeze([
    'version', 'beverage_type', 'steps',
    'tank_temperature', 'target_weight', 'target_volume', 'target_volume_count_start',
]);

const contentKey = (profile) => JSON.stringify(
    CONTENT_KEYS.map((key) => (profile ? profile[key] ?? null : null)));

async function mockFetch(url, options = {}) {
    const target = new URL(url);
    const pathWithQuery = `${target.pathname}${target.search}`;
    const method = (options.method ?? 'GET').toUpperCase();
    calls.push({ path: pathWithQuery, method });

    /* PUT /api/v1/profiles/<id>/visibility — `_handleSetVisibility` (profile_handler.dart:
     * 178-203 at the pin). The body is NOT wrapped: the bare {visibility} field, required.
     * The answer is 200 with THE WHOLE UPDATED RECORD, which is what lets the client read
     * the new state off the response rather than assuming it.
     *
     * THE ONE REFUSAL MODELLED is the one the controller actually has:
     * `existing.isDefault && visibility == deleted` throws, and the handler's
     * `on ArgumentError` clause answers 400 (profile_controller.dart:287-289). `hidden` on
     * a default is ALLOWED — that is what ProfileController.delete does to one — so a
     * fixture that refused it would be inventing a rule the server does not have. An
     * unknown id is also a 400 here and NOT a 404; this handler has no jsonNotFound at all. */
    const visibilityPath = target.pathname.match(/^\/api\/v1\/profiles\/(.+)\/visibility$/);
    if (visibilityPath && method === 'PUT') {
        const id = decodeURIComponent(visibilityPath[1]);
        const body = JSON.parse(options.body);
        const record = (await allRecords()).find((candidate) => candidate.id === id) ?? null;
        const refuse = (message) => new Response(
            JSON.stringify({ error: 'Invalid request', message }),
            { status: 400, headers: { 'content-type': 'application/json' } });
        if (!record) return refuse(`Invalid argument(s): Profile not found: ${id}`);
        if (record.isDefault === true && body.visibility === 'deleted') {
            return refuse('Invalid argument(s): Cannot delete default profiles, only hide them');
        }
        overrides.set(id, { visibility: body.visibility });
        return new Response(JSON.stringify({ ...record, visibility: body.visibility }), {
            status: 200, headers: { 'content-type': 'application/json' },
        });
    }

    /* GET /api/v1/profiles/<id>/lineage — `ProfileController.getLineage`
     * (profile_controller.dart:299-327 at the pin), walked the same way it walks: UP to the
     * root by parentId, then recursively DOWN through children, the profile itself included
     * so the list is never empty.
     *
     * VISIBILITY IS NOT CONSULTED, and that is the load-bearing part. The Dart reaches
     * children through `_storage.getByParentId`, whose query is
     * `where((p) => p.parentId.equals(parentId))` and nothing else (profile_dao.dart:48-52)
     * — no visibility clause. A hidden version stays in its own lineage, which is the fact
     * that lets a save hide the record it superseded without costing any history. A fixture
     * that filtered here would quietly prove the opposite of what production does. */
    const lineagePath = target.pathname.match(/^\/api\/v1\/profiles\/(.+)\/lineage$/);
    if (lineagePath && method === 'GET') {
        const id = decodeURIComponent(lineagePath[1]);
        const store = await allRecords();
        const byId = (wanted) => store.find((candidate) => candidate.id === wanted) ?? null;
        const self = byId(id);
        if (!self) {
            /* AN UNKNOWN ID IS A 500 HERE, not a 404: getLineage throws ArgumentError and
             * _handleGetLineage carries no `on ArgumentError` clause, so it falls into the
             * generic catch. The handler's own `if (lineage.isEmpty)` 404 is dead code. */
            return new Response(
                JSON.stringify({ error: 'Internal server error', message: `Invalid argument(s): Profile not found: ${id}` }),
                { status: 500, headers: { 'content-type': 'application/json' } });
        }
        const lineage = [self];
        for (let current = self; current.parentId;) {
            const parent = byId(current.parentId);
            if (!parent) break;
            lineage.unshift(parent);
            current = parent;
        }
        const addChildren = (parentId) => {
            for (const child of store.filter((c) => c.parentId === parentId)) {
                lineage.push(child);
                addChildren(child.id);
            }
        };
        addChildren(id);
        return new Response(JSON.stringify(lineage), {
            status: 200, headers: { 'content-type': 'application/json' },
        });
    }

    if (target.pathname === '/api/v1/profiles' && method === 'POST') {
        /* `_handleCreate`: the body is WRAPPED — json['profile'] required, json['parentId']
         * and json['metadata'] optional — and the answer is 201 with the whole record. */
        const body = JSON.parse(options.body);
        /* THE IDEMPOTENT BRANCH FIRST, because the controller does it first: a record whose
         * content is already stored is RETURNED AS IT STANDS — its own visibility, its own
         * parentId, none of the parentId that was just sent — and the handler still answers
         * 201. `jsonCreated` does not mean "created". */
        const existing = (await allRecords())
            .find((candidate) => contentKey(candidate.profile) === contentKey(body.profile));
        if (existing) {
            return new Response(JSON.stringify(existing), {
                status: 201, headers: { 'content-type': 'application/json' },
            });
        }
        serial += 1;
        const record = {
            id: `saved:${serial}`,
            profile: body.profile,
            metadataHash: `meta-${serial}`,
            compoundHash: `compound-${serial}`,
            parentId: body.parentId ?? null,
            visibility: 'visible',
            isDefault: false,
            createdAt: '2026-08-27T00:00:00.000Z',
            updatedAt: '2026-08-27T00:00:00.000Z',
            metadata: body.metadata ?? null,
        };
        created.push(record);
        return new Response(JSON.stringify(record), {
            status: 201, headers: { 'content-type': 'application/json' },
        });
    }

    if (target.pathname === '/api/v1/profiles' && method === 'GET') {
        /* THE RECORDING PLUS THIS SESSION'S WRITES, WITH THIS SESSION'S VISIBILITY APPLIED.
         * No ETag: the listing really does move here, and answering 304 would be the
         * fixture lying about its own state.
         *
         * EVERY RECORD, WHATEVER ITS VISIBILITY, because the skin asks for
         * `?includeHidden=true` and filters client-side (profile-rules.js
         * PROFILE_LISTING_QUERY). Serving a pre-filtered list would hide the client's own
         * filter from every test that runs through here. */
        return new Response(JSON.stringify(await allRecords()), {
            status: 200, headers: { 'content-type': 'application/json' },
        });
    }

    /* POST /api/v1/machine/profile — THE ARM ROUTE, and the one this suite exists to
     * count. Contract row `postMachineProfile`: the body is the BARE profile (the
     * asymmetry `rea-profile.js` calls `shape-asymmetry` — POST /profiles takes it
     * WRAPPED), and a successful arm is 200 WITH NO BODY. `rea-transport.js` reads a
     * bodyless 200 as `{ok: true, data: null}` and `profile-arm-store.js` looks at nothing
     * but `result.ok`, so this is the whole of the happy path.
     *
     * NO REFUSAL IS MODELLED HERE and that is deliberate. The typed 400s
     * (`Unsupported profile` / `Invalid profile`) are B9's surface and belong to the
     * suites that test B9; what this fixture is asked is only WHETHER the machine was
     * told, and a refusal branch nothing exercises would be a second, untested rule
     * standing in for a server. */
    if (target.pathname === '/api/v1/machine/profile' && method === 'POST') {
        armCalls.push(JSON.parse(options.body));
        return new Response(null, { status: 200 });
    }

    /* GET /api/v1/workflow — the document, from this session's copy rather than straight
     * off disk. Identical to the fallthrough until something writes. */
    if (target.pathname === '/api/v1/workflow' && method === 'GET') {
        return new Response(JSON.stringify(await workflowDocument()), {
            status: 200, headers: { 'content-type': 'application/json' },
        });
    }

    /* PUT /api/v1/workflow — `_applyUpdate`, as `workflow-store.js` reads it: MERGED into
     * the held document (the patch names only the keys it moves — `workflowApplyBody`
     * sends `profile` and `context` and nothing else) and answered 200 with the WHOLE
     * updated document.
     *
     * THE FALLTHROUGH USED TO ANSWER THIS, and answered it wrongly in the one way that
     * matters: it re-served the RECORDING, so a write came back 200 carrying the document
     * as it was before the write. `write()` publishes a served document verbatim, so the
     * app would have adopted the pre-write state as the post-write truth — a green arm
     * that left `loaded` pointing at the old profile, which is Ben's bug wearing the
     * fixture's clothes. */
    if (target.pathname === '/api/v1/workflow' && method === 'PUT') {
        const patch = JSON.parse(options.body);
        workflowWrites.push(patch);
        workflowDoc = { ...(await workflowDocument()), ...patch };
        return new Response(JSON.stringify(workflowDoc), {
            status: 200, headers: { 'content-type': 'application/json' },
        });
    }

    const response = await fetch(`${location.origin}/tools/rea-fixtures/${fixtureKey(pathWithQuery)}`, {
        method: 'GET', cache: 'no-store',
    });
    if (response.ok) return response;
    return new Response(
        JSON.stringify({ error: 'this instrument has no recording of that page', path: pathWithQuery }),
        { status: 503, headers: { 'content-type': 'application/json' } },
    );
}

const fakeSocketFactory = () => (url) => ({
    url,
    addEventListener() {}, removeEventListener() {}, send() {}, close() {},
});

let boot = null;
let root = null;

/** One piercing path, `>>>` per shadow boundary — the harness's own dialect. */
const deep = (selector) => {
    let node = document;
    for (const part of selector.split('>>>').map((s) => s.trim())) {
        const found = (node.shadowRoot ?? node).querySelector(part);
        if (!found) return null;
        node = found;
    }
    return node;
};

const settle = async (frames = 6) => {
    for (let i = 0; i < frames; i += 1) await new Promise((r) => requestAnimationFrame(r));
    await root?.updateComplete;
};

const screenTag = () => {
    const el = root?.shadowRoot?.querySelector('selector-screen, editor-screen') ?? null;
    return el ? el.tagName.toLowerCase() : null;
};

/** Wait for the mounted screen to be `want`, or give up. A route swap loads a module. */
async function waitForScreen(want, timeoutMs = 15000) {
    const stop = performance.now() + timeoutMs;
    while (screenTag() !== want && performance.now() < stop) {
        await new Promise((r) => setTimeout(r, 5));
    }
    await settle(8);
    return screenTag();
}

/**
 * ===========================================================================
 * WAIT UNTIL THE APP STOPS TALKING, added 27 August 2026 with Ben's "save closes".
 * ===========================================================================
 * A press used to be followed by a fixed 150 ms, which was long enough while a Save did
 * exactly one thing and left the screen standing. It is not long enough now: one press of
 * Save writes the profile, writes the superseded row's visibility, re-reads the listing,
 * arms the machine and writes the workflow document, and swaps the route on the way past.
 * A fixed sleep tuned to that chain is a flake generator on a loaded box — and the box
 * running this is the one driving Ben's tablet.
 *
 * SO IT WAITS ON A FACT RATHER THAN ON A CLOCK: the call log stops growing. That is
 * deliberately NOT the shape of anything a test asserts — it does not wait for an arm, or
 * for a selection to move, or for any other thing a test is about to claim, so it cannot
 * manufacture the answer. It waits for the app to fall silent and then lets the DOM catch
 * up, and gives up after `timeoutMs` so a broken build fails on the assertion rather than
 * hanging.
 */
async function quiet({ quietMs = 250, timeoutMs = 8000 } = {}) {
    const stop = performance.now() + timeoutMs;
    let seen = calls.length;
    let since = performance.now();
    while (performance.now() < stop) {
        await new Promise((r) => setTimeout(r, 20));
        if (calls.length !== seen) { seen = calls.length; since = performance.now(); continue; }
        if (performance.now() - since >= quietMs) break;
    }
    await settle(8);
    return calls.length;
}

globalThis.__saveLoop = {
    /**
     * ===========================================================================
     * SEAT WHICH PROFILE THE MACHINE IS HOLDING. CALL IT BEFORE `mount()`.
     * ===========================================================================
     * The whole of `adoptSavedProfile`'s new decision is a comparison against the HELD
     * record, so a test that does not state which record that is is not testing the
     * decision — it is inheriting whatever the capture happened to be pointing at. This is
     * how a test says its own premise out loud.
     *
     * IT TAKES A TITLE AND REFUSES A DUPLICATE ONE, WHICH IS THE POINT OF TAKING A TITLE.
     * `readLoaded()` hands the document to `r1LoadedProfileId`, and R1's whole difficulty
     * is that ReaPrime's workflow carries the profile BODY and not the record id
     * (`workflow.dart` emits `profile.toJson()`, and `Profile.toJson` has no id), so the
     * only route from "what the machine is running" back to "which row that is" is a TITLE
     * MATCH against the listing. This corpus is exactly the population where that breaks:
     * of 147 records, 14 titles are shared — 35 rows called "Temp Test", 11 called
     * "Extractamundo Dos!", 10 called "Power". R1 answers `ambiguous` for every one of
     * them and refuses to guess, which is correct and leaves `loaded.id` NULL. Seat one of
     * those and the premise "the machine holds X" is unobservable to the app, both tests
     * pass for the wrong reason, and neither would go red on a broken guard.
     *
     * So a duplicate title is refused here, at the moment the test states its premise,
     * rather than silently producing an unresolved `loaded` fifty lines later. `null` back
     * means "this corpus cannot seat that profile honestly", and a test asserts on it.
     *
     * THE DEFAULT — no `hold()` call at all — is the recording: "Extractamundo Dos! (2)",
     * which is UNIQUE in the 147 and is what the bench machine was actually holding when
     * the capture was taken. That is why the four assertions this file carried before
     * today still mean what they meant.
     *
     * `id` IS STRIPPED OFF THE SERVED PROFILE. R1 reads `hasOwn(profile, 'id')` as "R1 HAS
     * LANDED, delete this adapter" and resolves straight off it. ReaPrime does not serve
     * that field; a fixture that did would quietly test the world after the upstream fix
     * rather than the one the skin ships into. (The recorded document has no `id` on its
     * profile either — this keeps it that way for a profile copied out of the listing.)
     *
     * THE CONTEXT MOVES WITH THE PROFILE because on the machine it does: an arm is
     * `POST /machine/profile` followed by `PUT /workflow` carrying `{profile, context}`,
     * and the context's three fields come off the record's metadata. Seating a profile
     * with somebody else's dose and yield would be a state the machine cannot be in.
     *
     * @returns {Promise<string|null>} the record id seated, or null if the title is not
     *   unique in the corpus (or is not in it at all).
     */
    async hold(title) {
        const matches = (await allRecords())
            .filter((record) => (record.profile?.title ?? null) === title);
        if (matches.length !== 1) return null;
        const record = matches[0];
        const profile = { ...record.profile };
        delete profile.id;
        const metadata = record.metadata ?? {};
        workflowDoc = {
            ...(await workflowDocument()),
            profile,
            context: {
                targetDoseWeight: metadata.targetDoseWeight ?? null,
                targetYield: metadata.targetYield ?? null,
                grinderSetting: metadata.grinderSetting ?? null,
            },
        };
        heldSeatedId = record.id;
        return record.id;
    },

    /** Build the shell against the fixture server and let the boot settle. */
    async mount() {
        boot = createAppBoot({
            fetch: mockFetch,
            createSocket: fakeSocketFactory(),
            location: { hostname: '127.0.0.1', protocol: 'http:' },
            importModule: (specifier) => import(specifier),
        });
        root = document.createElement('app-root');
        root.boot = boot;
        document.getElementById('mount').appendChild(root);
        await root.updateComplete;
        const stop = performance.now() + 15000;
        while (boot.state.phase === 'connecting' && performance.now() < stop) {
            await new Promise((r) => setTimeout(r, 5));
        }
        await root.updateComplete;
        return boot.state.phase;
    },

    /** Change route the way the app does — through the address. */
    async goto(id) {
        location.hash = `#/${id}`;
        return waitForScreen(id === 'editor' ? 'editor-screen' : 'selector-screen');
    },

    /** Wait for the library's listing to have landed, however it landed. */
    async librarySettled(timeoutMs = 15000) {
        const stop = performance.now() + timeoutMs;
        for (;;) {
            const state = boot?.library?.get?.();
            if (state && state.status !== 'idle' && state.status !== 'loading') break;
            if (performance.now() > stop) return false;
            await new Promise((r) => setTimeout(r, 20));
        }
        await settle(6);
        return true;
    },

    /** A small, plain snapshot — CDP cannot serialise a state object. */
    library() {
        const state = boot.library.get();
        return {
            status: state.status,
            records: state.records.length,
            listable: state.listable.length,
            selectedId: state.selectedId,
            selectedTitle: boot.library.selected()?.profile?.title ?? null,
        };
    },

    /** Click the Nth PROFILE row. Family rows fold rather than select, so they are skipped. */
    async clickRow(index = 0) {
        const screen = root.shadowRoot.querySelector('selector-screen');
        const rows = [...screen.shadowRoot.querySelectorAll('#rows ui-list-row')]
            .filter((el) => !el.classList.contains('family-row'));
        if (!rows[index]) return null;
        rows[index].click();
        await settle(6);
        return rows[index].dataset.id ?? null;
    },

    /**
     * TYPE IN THE FILTER AND PRESS ENTER — the selector's own search, driven the way a
     * person drives it.
     *
     * THE SCREEN LISTENS FOR `search`, NOT `input` (`selector-screen.js #onSearch`), and
     * `ui-search-field` emits `search` on Enter and on its clear affordance and at no other
     * time. So setting the value alone filters nothing — the keypress is not decoration
     * here, it is the event that does the work.
     */
    async filterList(text) {
        const screen = root.shadowRoot.querySelector('selector-screen');
        const input = screen?.shadowRoot.querySelector('#filter')?.shadowRoot?.querySelector('#field');
        if (!input) return false;
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
        await settle(8);
        return true;
    },

    /**
     * Click the row for a NAMED profile, wherever the list has put it.
     *
     * `clickRow(index)` is fine for "any profile will do", and wrong the moment a test
     * needs the same profile twice: hiding a superseded version RE-ORDERS the list under
     * it, so index 0 before a save and index 0 after it are not the same row.
     *
     * IT FILTERS FIRST BECAUSE THE ROW MAY NOT BE RENDERED AT ALL. Measured against this
     * fixture's own corpus: 78 listable profiles render as 42 rows, because 14 of them are
     * FAMILY rows and a folded family's members are not in the DOM — deliberately, and
     * `selector-screen.js` says why ("the whole point of folding 186 profiles is that the
     * ones you folded away stop being there"). "Temp test 2" is inside one of them, so a
     * bare `querySelectorAll` finds nothing and a test written on one would fail with
     * "the row was not found" and no clue that the profile was simply folded away.
     * Filtering is what a person does about that, and it flattens the family too: one
     * match is not a family.
     *
     * The id lookup only says WHICH rendered row to press. The press itself is a real
     * click on a real row through Chrome's hit test, exactly as `clickRow` does it.
     */
    async clickRowTitled(title) {
        const record = boot.library.get().listable
            .find((candidate) => (candidate.profile?.title ?? null) === title);
        if (!record) return null;
        const screen = root.shadowRoot.querySelector('selector-screen');
        const rowFor = () => [...screen.shadowRoot.querySelectorAll('#rows ui-list-row')]
            .find((el) => el.dataset.id === record.id);
        let row = rowFor();
        if (!row) {
            await globalThis.__saveLoop.filterList(title);
            row = rowFor();
        }
        if (!row) return null;
        row.click();
        await settle(6);
        return row.dataset.id ?? null;
    },

    /** The selector's own Edit button. It seats the record and then asks for the route. */
    async pressEdit() {
        const button = deep('app-root >>> selector-screen >>> #act-edit');
        if (!button) return null;
        button.click();
        return waitForScreen('editor-screen');
    },

    /** What the editor has open, as the person sees it. */
    editor() {
        const screen = root.shadowRoot.querySelector('editor-screen');
        if (!screen) return null;
        const state = boot.profileEditor.get();
        const draft = screen._draft;
        const band = screen.renderRoot.querySelector('#band');
        return JSON.parse(JSON.stringify({
            recordId: state.record ? state.record.id ?? null : null,
            save: state.save,
            title: draft ? draft.title ?? null : null,
            temperatures: draft && Array.isArray(draft.steps)
                ? draft.steps.map((step) => step.temperature ?? null) : null,
            saveLabel: (band?.shadowRoot?.querySelector('#save')?.textContent ?? '').trim(),
        }));
    },

    /** Press the real + on one temperature cell of the editor's own matrix. */
    async bumpTemperature(index = 0) {
        const button = deep(`app-root >>> editor-screen >>> #matrix >>> `
            + `[data-cell="temperature-${index}"] > ui-stepper >>> #increment`);
        if (!button) return false;
        button.click();
        await settle(6);
        return true;
    },

    /**
     * Press the real Save in the editor's band, and let everything it starts land.
     *
     * SINCE 27 AUGUST 2026 THAT INCLUDES THE ROUTE SWAP. Ben: "pressing save should close
     * and arm, I shouldn't need to press save twice." One press now writes the profile,
     * hides the row it supersedes, re-reads the listing, arms the machine, writes the
     * workflow document AND leaves the editor — so this waits for the app to fall silent
     * (see `quiet()`) rather than for a fixed 150 ms tuned to the old, shorter chain.
     *
     * IT STILL RETURNS `true` FOR "THE BUTTON WAS THERE AND WAS PRESSED", and nothing
     * more. Which screen the press left you on is a CLAIM, so a test reads it for itself
     * through `settledScreen()` — folding the answer into the presser would hand every
     * test the conclusion it is supposed to be checking.
     */
    async pressSave() {
        const button = deep('app-root >>> editor-screen >>> #band >>> #save');
        if (!button) return false;
        button.click();
        await settle(8);
        await quiet();
        return true;
    },

    /**
     * Which screen is mounted, after giving it until `timeoutMs` to become `want`.
     *
     * IT REPORTS WHAT IS ACTUALLY THERE, never `want` — the wait is a wait and not an
     * assertion, so a screen that never arrives comes back as itself and the test fails
     * on a readable diff instead of on a timeout with no subject.
     */
    async settledScreen(want, timeoutMs = 6000) {
        return waitForScreen(want, timeoutMs);
    },

    /** Press the real Cancel, which is the way out of the editor with nothing to save. */
    async pressCancel() {
        const button = deep('app-root >>> editor-screen >>> #band >>> #cancel');
        if (!button) return null;
        button.click();
        return waitForScreen('selector-screen');
    },

    /** What the editor's notice surface is showing. */
    notices() {
        const toast = root.shadowRoot.querySelector('editor-screen')?.renderRoot.querySelector('#notice');
        if (!toast) return null;
        return [...toast.children].map((n) => ({ tone: n.getAttribute('tone'), text: n.textContent.trim() }));
    },

    /** Every record this session's writes created — the server's side of the story. */
    created() {
        return created.map((r) => ({
            id: r.id, parentId: r.parentId, title: r.profile.title,
            temperatures: (r.profile.steps ?? []).map((s) => s.temperature ?? null),
        }));
    },

    /**
     * ===========================================================================
     * THE THREE READERS AN ARM ASSERTION NEEDS, AND WHY THEY ARE THREE
     * ===========================================================================
     * "The machine holds X" is two different facts and they can disagree, which is the
     * whole failure mode this fixture was extended to catch:
     *
     *   * WHAT THE MACHINE WAS TOLD — `armCalls()` and `workflowWrites()`, the bodies this
     *     server actually received. A call that never happened cannot be argued with, so
     *     this is the only honest way to assert the NEGATIVE ("editing something else left
     *     the machine alone"), which is the more important of the two tests: an app that
     *     believed the right thing while quietly re-arming the machine would pass every
     *     assertion made against the app's own state.
     *   * WHAT THE APP BELIEVES — `held()`, off `library.get().loaded`. That is what
     *     `<app-root>` resolves the Live band's "Edit profile" through, so it is the value
     *     Ben's bug was actually about.
     *   * WHAT THE DOCUMENT SAYS — `machineHolds()`, off the served workflow. The
     *     tie-breaker: it is the server's own answer, unmediated by any store, and it is
     *     what a reboot would read back.
     *
     * `held()` CARRIES `source` AND `reason` AND NOT JUST AN ID, because a null id has two
     * completely different meanings — "nothing is loaded" and "R1 could not tell which of
     * eleven same-titled records it is" — and a test that could not tell them apart would
     * report a broken premise as a broken app. `source` also says HOW the id was reached:
     * `title-match` is R1 resolving cleanly, `body-match` is R1 breaking the tie on the
     * served profile body, and `remembered` is the library's own memory of the id it
     * armed. All three are legitimate; a test that pins one is pinning R1's internals
     * rather than the behaviour, so the tests below assert the ID and report the source.
     */
    held() {
        const loaded = boot?.library?.get?.().loaded ?? null;
        return {
            seatedId: heldSeatedId,
            id: loaded ? loaded.id ?? null : null,
            title: loaded ? loaded.title ?? null : null,
            known: loaded ? loaded.known === true : false,
            source: loaded ? loaded.source ?? null : null,
            reason: loaded ? loaded.reason ?? null : null,
        };
    },

    /** The served workflow document's profile — the server's own answer, no store between. */
    async machineHolds() {
        const doc = await workflowDocument();
        const profile = doc && typeof doc.profile === 'object' ? doc.profile : null;
        return {
            title: profile ? profile.title ?? null : null,
            temperatures: profile && Array.isArray(profile.steps)
                ? profile.steps.map((step) => step.temperature ?? null) : null,
        };
    },

    /** Every body the ARM route was handed, in order. Empty is the assertion, usually. */
    armCalls() {
        return armCalls.map((profile) => ({
            title: profile ? profile.title ?? null : null,
            temperatures: profile && Array.isArray(profile.steps)
                ? profile.steps.map((step) => step.temperature ?? null) : null,
        }));
    },

    /** Every body `PUT /workflow` was handed, in order. Arming writes the document too. */
    workflowWrites() {
        return workflowWrites.map((patch) => ({
            title: patch && patch.profile ? patch.profile.title ?? null : null,
            temperatures: patch && patch.profile && Array.isArray(patch.profile.steps)
                ? patch.profile.steps.map((step) => step.temperature ?? null) : null,
        }));
    },

    /**
     * HOW MANY ROWS THIS PROFILE HAS IN THE LIST — the whole of Ben's complaint, counted.
     *
     * `listable` is what the selector renders, after `profile-rules.js` has filtered the
     * `?includeHidden=true` listing. Counting by TITLE rather than by id is deliberate: the
     * defect was near-DUPLICATE rows, which is a thing a person sees by name, and an id
     * count could not tell one profile's two versions from two different profiles.
     */
    listableRowsTitled(title) {
        return boot.library.get().listable
            .filter((record) => (record.profile?.title ?? null) === title).length;
    },

    /** The same count over the Hidden set, so a test can prove the pile did not just move. */
    hiddenRowsTitled(title) {
        return boot.library.get().hidden
            .filter((record) => (record.profile?.title ?? null) === title).length;
    },

    /** What the server is holding for this title, whatever its visibility. The oracle. */
    async storedTitled(title) {
        return (await allRecords())
            .filter((record) => (record.profile?.title ?? null) === title)
            .map((record) => ({ id: record.id, parentId: record.parentId, visibility: record.visibility }));
    },

    /** Press the editor's own Previous versions control and let the lineage land. */
    async openVersions() {
        const button = deep('app-root >>> editor-screen >>> #versions-open');
        if (!button) return null;
        button.click();
        await settle(8);
        await new Promise((r) => setTimeout(r, 150));
        await settle(6);
        return boot.library.get().versions.status;
    },

    /** The rows of the versions dialog, as a person reads them. */
    versionRows() {
        const screen = root.shadowRoot.querySelector('editor-screen');
        const body = screen?.renderRoot.querySelector('#versions .versions');
        if (!body) return null;
        return [...body.querySelectorAll('ui-button')].map((el) => ({
            id: el.dataset.id ?? null,
            text: el.textContent.trim(),
        }));
    },

    /** The dialog's sentence when it has no list to show. */
    versionsSentence() {
        const screen = root.shadowRoot.querySelector('editor-screen');
        const p = screen?.renderRoot.querySelector('#versions .versions p');
        return p ? p.textContent.trim() : null;
    },

    /** Press one version row. Restoring loads it into the draft and writes nothing. */
    async pickVersion(id) {
        const screen = root.shadowRoot.querySelector('editor-screen');
        const body = screen?.renderRoot.querySelector('#versions .versions');
        const button = [...(body?.querySelectorAll('ui-button') ?? [])]
            .find((el) => el.dataset.id === id);
        if (!button) return false;
        button.click();
        await settle(8);
        return true;
    },

    /** Every REST call, in order, so a test asserts the route a gesture took. */
    calls() { return calls.slice(); },

    /** How many times the listing has been read — the request-volume oracle. */
    listingReads() {
        return calls.filter((c) => c.method === 'GET' && c.path.startsWith('/api/v1/profiles')).length;
    },

    screenTag,
};

ready = true;

}
