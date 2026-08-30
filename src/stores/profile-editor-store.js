// THE PROFILE EDITOR'S ONE DOOR TO THE PROFILE ROUTES — save (B10/R8) and versions (B11).
//
// Wave 5.5, items `save-semantics`, `profile-versions`, `contract-check-editor`.
//
// ============================================================================
// WHAT THIS FILE IS FOR, AND WHAT IT DELIBERATELY IS NOT
// ============================================================================
//
// The standing order is "endpoints via the generated client + stores ONLY", and the
// mechanism for it is that this is the one file in the editor cluster that imports
// `callRoute`. `<editor-screen>` and every panel under it hold a DRAFT and dispatch
// events; none of them names a path, a route id or a fetch.
//
// It does NOT hold the draft. The draft belongs to the screen — the same rule
// `ui-exit-sentence.js` states for the step it is handed ("editor draft state, NEVER
// mutated; every change leaves as an event and the screen owns the draft"). What this
// store holds is what the SERVER said: the record the editor opened from, the report from
// the last save, and the lineage facts read off both.
//
// It does NOT own the arm route. `postMachineProfile` has exactly one caller in src/
// (`profile-arm-store.js`, reached through `profile-library-store.js arm()`), pinned by
// "B9's trigger" in `test/live-connection-gates.test.mjs`, which walks src/ and fails if a
// SECOND one appears. Arming from the editor goes through that store or not at all.
//
// It does NOT call the lineage route. `getProfilesByIdLineage` belongs to
// `profile-library-store.js versionsOf()` and its entry point is the selector's overflow
// menu (Q7, wave 5.3). B11's job here is a SENTENCE, and the sentence's inputs — parentId
// and the two hashes — ride on every ProfileRecord this store already has.
//
// ============================================================================
// THE ROUTES, EACH CHECKED AGAINST THE HANDLER BODY AS WRITTEN AT 2b047d02
// ============================================================================
//
//   getProfilesById       GET /api/v1/profiles/{id}
//        `ProfileHandler._handleGetById`. The id is `Uri.decodeComponent`d, the controller
//        `get`s it, and a null record is 404 {'error':'Profile not found','id'}. Success is
//        `jsonOk(profile.toJson())` — the whole ProfileRecord, not the inner Profile.
//        Used for the DEEP-LINK open, where the editor has an id and no listing in hand.
//        When the caller already holds the record (the selector handed it over), `open()`
//        takes it directly and this route is not touched: a re-read that returns what the
//        caller just gave us is a request nobody needed.
//        OFFLINE GAP, recorded rather than papered over: `tools/mock_rea.py` resolves
//        fixtures by EXACT path and its endpoint fallback is deleted (A7), so with no
//        `api__v1__profiles~<id>.json` recording this route answers 503 naming the path
//        against the mock. The battery opens the editor through `open(record)`.
//
//   postProfiles          POST /api/v1/profiles
//        `ProfileHandler._handleCreate`. Body is WRAPPED: `json['profile']` (required, else
//        400 {'error':'Missing required field'}), `json['parentId']`, `json['metadata']`.
//        201 `jsonCreated(record.toJson())`.
//        THIS IS B11's PATH. `ProfileController.create` validates the parent exists first
//        (ArgumentError -> 400 "Parent profile not found: <id>"), then stores a NEW record
//        carrying `parentId`. The previous record is untouched — which is the whole of
//        "editing keeps the old version", implemented by the server and merely reported here.
//        TWO GATES WORTH KNOWING, both read off the controller body:
//          * CONTENT-ADDRESSED AND IDEMPOTENT. `create` computes the record id from the
//            profile, looks it up, and RETURNS THE EXISTING RECORD if it is already stored,
//            without storing anything and without applying the `parentId` that was sent.
//            The handler answers 201 either way, so a 201 does not mean "created" and this
//            store never says it did (`saveReportFrom` answers `stored: null`).
//          * THE ID'S INPUT SET IS CONTENT ONLY. A change that leaves the content identical
//            resolves to the same id and therefore to that same existing-record branch.
//            Which changes those are is `profile_hash.dart`'s rule, this store does not
//            hold it (B10), and the consequence is recorded as a deferred question rather
//            than worked around with a local hash.
//
//   putProfilesById       PUT /api/v1/profiles/{id}
//        `ProfileHandler._handleUpdate`. Body wrapped, `profile` OPTIONAL — parsed only
//        `if (json.containsKey('profile'))`, so a metadata-only update is a legal request
//        that touches no steps and is id-stable. 200 `jsonOk(record.toJson())`.
//        `saveMetadata()` is that path and it is the one this store offers by default for a
//        label edit. `saveInPlace()` is the other and it carries a WARNING in its own
//        doc: when the content hash moves, `ProfileController.update` DELETES the previous
//        record before storing the new one. The old version is not kept on that path.
//        Also live here, from the existing row: `existing.isDefault && profile != null`
//        throws -> 400, so a bundled profile takes metadata edits and refuses content ones.
//
//   putProfilesByIdVisibility   PUT /api/v1/profiles/{id}/visibility
//        `ProfileHandler._handleSetVisibility` (`profile_handler.dart:23` registers it,
//        `:178-203` is the body, at the pin `2b047d02`). The body is the BARE field —
//        `{visibility}`, not wrapped in `profile` — and a missing key is 400 {'error':
//        'Missing required field'}. The value is one of visible | hidden | deleted;
//        anything else is an ArgumentError and therefore a 400. 200 returns the whole
//        updated ProfileRecord, so THE ANSWER STATES THE NEW STATE.
//        TWO CALLERS, TWO READINGS. The supersede path (`settleToOneRow`) treats a failure
//        as advisory — the save it follows already succeeded. D20's `setVisibility()` is
//        a person pressing a switch, so its ending becomes published state instead.
//        `existing.isDefault && visibility == deleted` is refused; `hidden` on a bundled
//        record is ALLOWED and is exactly what `ProfileController.delete` does to one.
//
//   NOT HERE, AND THE ABSENCE IS THE FINDING: `isDefault` HAS NO ROUTE.
//        D20 asked for a "Machine default" switch alongside the visibility one. At the pin
//        NOTHING in `lib/src/services/webserver/` so much as names `isDefault` (grepped:
//        zero hits), it is absent from `assets/api/rest_v1.yml`, and `_handleUpdate` takes
//        only `profile` and `metadata`. The flag is written in exactly two places, both
//        server-internal: `_loadDefaultProfiles` and `restoreDefault`, each stamping a
//        record built from `assets/defaultProfiles/` with `metadata: {'source':'bundled'}`.
//        So `isDefault` does not mean "the profile the machine comes up on" — it means
//        "this record is a BUNDLED profile" — and it is a GUARD: a record carrying it
//        cannot have its content updated, cannot be purged, and cannot be soft-deleted.
//        There is no writer to expose. See the fix log entry RB-2.
//
// ONE SANITIZER, ON EVERY WRITE PATH. Bodies are built by `profileCreateBody` /
// `profileUpdateBody` in `rea-profile.js`, which are the only two wrappers in the tree and
// both run `sanitizeProfileForRea`. The old skin's second, inline copy inside
// `updateWorkflow` nulled a weight exit and wrote nothing, so the same profile kept its
// stop-at-weight target when saved and silently lost it when armed. Nothing in this file
// reshapes a profile, which is what makes that divergence inexpressible rather than fixed.

import { callRoute } from '../data/rea-routes.js';
import {
    profileCreateBody, profileUpdateBody, profileRefusal,
    profileRecordIdOf, profileVisibilityOf, isDefaultProfile, PROFILE_VISIBILITY,
} from '../data/rea-profile.js';
import { saveReportFrom, saveFailureFrom, changeCountOf, headerCommitFor } from '../lib/editor-commit.js';
import { lineageFactsOf, versionNoteFacts, SAVE_INTENT } from '../lib/profile-lineage.js';
import { createStore } from './store.js';

/** Where the editor's copy of the record got to. */
export const EDITOR_LOAD_STATUS = Object.freeze({
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    /** 404 — `_handleGetById` could not find the id. Distinct from a fault. */
    MISSING: 'missing',
    FAILED: 'failed',
});

/** Where the last save got to. */
export const SAVE_STATUS = Object.freeze({
    IDLE: 'idle',
    SAVING: 'saving',
    /** The server answered with a record. What it MEANS is in `report`, from the server. */
    SAVED: 'saved',
    /** A typed 400. `refusal` carries ReaPrime's own {kind, error, message}. */
    REFUSED: 'refused',
    /** Anything else. Never a refusal. */
    FAILED: 'failed',
});

export const VISIBILITY_WRITE = Object.freeze({
    /** Nothing has been written this session — the RECORD is what the switch reads. */
    IDLE: 'idle',
    WRITING: 'writing',
    /** `value` is the visibility the SERVER answered with, not the one that was asked for. */
    DONE: 'done',
    FAILED: 'failed',
});

/** No visibility write has happened. `value: null` means "ask the record". */
const NO_VISIBILITY_WRITE = Object.freeze({
    status: VISIBILITY_WRITE.IDLE,
    /** The last SERVER-CONFIRMED visibility from this session. Never a prediction. */
    value: null,
    /** What is in flight, while one is. Null otherwise. */
    wanted: null,
    /** `profileRefusal()`'s reading of a typed 400, worded by nobody in this layer. */
    refusal: null,
    /** Anything else, verbatim. */
    error: null,
    at: null,
});

const NOOP_LOGGER = Object.freeze({
    debug() {}, info() {}, warn() {}, error() {}, scope() { return NOOP_LOGGER; },
});

const EMPTY_STATE = Object.freeze({
    load: EDITOR_LOAD_STATUS.IDLE,
    /** The ProfileRecord the editor is editing, as the server last served it. */
    record: null,
    /** `record.profile` — the baseline every dirty-state answer is measured against. */
    baseline: null,
    /** B11's facts off the current record. Consumed, never computed. */
    lineage: lineageFactsOf(null),
    save: SAVE_STATUS.IDLE,
    /** `saveReportFrom()` — what the server said, or the absence of it. */
    report: null,
    /** `profileRefusal()`'s reading of a typed 400. Worded by nobody in this layer. */
    refusal: null,
    /** A non-400 fault, verbatim. */
    error: null,
    /** The last version answer, so a surface reads one object. */
    version: null,
    /** D20's library-visibility write. Reset with the record — see `seat`. */
    visibility: NO_VISIBILITY_WRITE,
    at: null,
});

export function createProfileEditorStore({
    transport, logger = null, now = () => Date.now(), readOutcome = undefined,
} = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createProfileEditorStore: a transport must be injected (see createReaTransport)');
    }
    const log = logger && logger.scope ? logger.scope('editor') : (logger || NOOP_LOGGER);
    const store = createStore({ ...EMPTY_STATE }, { label: 'profileEditor', logger: log });
    const patch = (fields) => store.set({ ...store.get(), ...fields });

    const outcomeReader = typeof readOutcome === 'function' ? { readOutcome } : {};

    function seat(record) {
        return patch({
            load: EDITOR_LOAD_STATUS.READY,
            record,
            baseline: record && typeof record === 'object' ? record.profile ?? null : null,
            lineage: lineageFactsOf(record),
            visibility: NO_VISIBILITY_WRITE,
            at: now(),
        });
    }

    /** One place that turns a transport failure into published state. */
    function publishFailure(result, route) {
        const refusal = profileRefusal(result);
        if (refusal) {
            // A refusal is the server working correctly, so it is info, never error.
            log.info(`profile save refused: ${refusal.error}`);
            return patch({
                save: SAVE_STATUS.REFUSED,
                report: saveFailureFrom(result, { route, refusal }),
                refusal,
                error: null,
                at: now(),
            });
        }
        log.warn(`profile save failed on ${route}: ${result && result.message}`);
        return patch({
            save: SAVE_STATUS.FAILED,
            report: saveFailureFrom(result, { route }),
            refusal: null,
            error: result ?? null,
            at: now(),
        });
    }

    async function settleToOneRow(result, before) {
        const saved = result && typeof result.data === 'object' ? result.data : null;
        const savedId = profileRecordIdOf(saved);
        const beforeId = profileRecordIdOf(before);
        if (!saved || !savedId || !beforeId || savedId === beforeId) return result;

        let latest = saved;

        if (profileVisibilityOf(saved) !== PROFILE_VISIBILITY.VISIBLE) {
            const shown = await setVisibility(savedId, PROFILE_VISIBILITY.VISIBLE);
            if (shown) latest = shown;
            else {
                /* THE UN-HIDE FAILED, SO THE HIDE MUST NOT RUN. Hiding the parent now
                 * would leave the profile with no visible row. Two rows is the old
                 * behaviour; none is a disappearance. */
                log.warn(`the saved version ${savedId} could not be made visible — `
                    + `leaving ${beforeId} on the list so the profile still has a row`);
                return { ...result, data: latest };
            }
        }

        if (isDefaultProfile(before)) {
            log.info(`${beforeId} is a bundled profile — kept on the list; `
                + `${savedId} is a new profile derived from it, not a version that replaces it`);
            return { ...result, data: latest };
        }

        const hidden = await setVisibility(beforeId, PROFILE_VISIBILITY.HIDDEN);
        if (!hidden) {
            log.warn(`the superseded version ${beforeId} could not be hidden — `
                + 'the save stands and the library will show both rows until it is retried');
        }
        return { ...result, data: latest };
    }

    async function setVisibility(id, visibility) {
        const result = await writeVisibility(id, visibility);
        if (result.ok && result.data && typeof result.data === 'object') return result.data;
        log.warn(`visibility '${visibility}' for ${id} failed: ${result && result.message}`);
        return null;
    }

    function writeVisibility(id, visibility) {
        return callRoute(transport, 'putProfilesByIdVisibility', {
            params: { id },
            body: { visibility },
        });
    }

    /** One place that turns a success into published state. */
    function publishSaved(result, { route, intent, before, requestedParentId = null }) {
        const record = result.data;
        const report = saveReportFrom(record, {
            route, status: result.status ?? null, before, ...outcomeReader,
        });
        const version = versionNoteFacts(report, { previous: before, intent, requestedParentId });
        // The saved record becomes the new baseline: the server's answer is what the next
        // dirty-state comparison is measured against, so an unsaved-changes count can never
        // be carried over a save.
        return patch({
            load: EDITOR_LOAD_STATUS.READY,
            record,
            baseline: record && typeof record === 'object' ? record.profile ?? null : null,
            lineage: lineageFactsOf(record),
            save: SAVE_STATUS.SAVED,
            report,
            refusal: null,
            error: null,
            version,
            at: now(),
        });
    }

    const api = {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },

        open(record) { return seat(record ?? null); },

        async loadById(id) {
            const wanted = typeof id === 'string' && id ? id : null;
            if (!wanted) return store.get();
            patch({ load: EDITOR_LOAD_STATUS.LOADING, at: now() });
            const result = await callRoute(transport, 'getProfilesById', { params: { id: wanted } });
            if (result.ok && result.data && typeof result.data === 'object') return seat(result.data);
            if (result.status === 404) {
                return patch({ load: EDITOR_LOAD_STATUS.MISSING, record: null, baseline: null, at: now() });
            }
            log.warn(`profile ${wanted} unreadable: ${result.message}`);
            return patch({ load: EDITOR_LOAD_STATUS.FAILED, error: result, at: now() });
        },

        async saveAsNewVersion(profile, { metadata = null, parentId = undefined } = {}) {
            const before = store.get().record;
            const parent = parentId === undefined
                ? (before && typeof before === 'object' ? before.id ?? null : null)
                : parentId;
            patch({ save: SAVE_STATUS.SAVING, refusal: null, error: null, at: now() });
            const result = await callRoute(transport, 'postProfiles', {
                body: profileCreateBody(profile, { parentId: parent, metadata }),
            });
            if (!result.ok) return publishFailure(result, 'postProfiles');
            const settled = await settleToOneRow(result, before);
            return publishSaved(settled, {
                route: 'postProfiles',
                intent: SAVE_INTENT.NEW_VERSION,
                before,
                requestedParentId: parent,
            });
        },

        async saveMetadata(metadata, { id = undefined } = {}) {
            const before = store.get().record;
            const wanted = id === undefined
                ? (before && typeof before === 'object' ? before.id ?? null : null)
                : id;
            if (!wanted) return store.get();
            patch({ save: SAVE_STATUS.SAVING, refusal: null, error: null, at: now() });
            const result = await callRoute(transport, 'putProfilesById', {
                params: { id: wanted },
                body: profileUpdateBody({ metadata }),
            });
            if (!result.ok) return publishFailure(result, 'putProfilesById');
            return publishSaved(result, {
                route: 'putProfilesById', intent: SAVE_INTENT.METADATA_ONLY, before,
            });
        },

        async saveInPlace(profile, { metadata = null, id = undefined } = {}) {
            const before = store.get().record;
            const wanted = id === undefined
                ? (before && typeof before === 'object' ? before.id ?? null : null)
                : id;
            if (!wanted) return store.get();
            patch({ save: SAVE_STATUS.SAVING, refusal: null, error: null, at: now() });
            const result = await callRoute(transport, 'putProfilesById', {
                params: { id: wanted },
                body: profileUpdateBody({ profile, metadata }),
            });
            if (!result.ok) return publishFailure(result, 'putProfilesById');
            return publishSaved(result, {
                route: 'putProfilesById', intent: SAVE_INTENT.IN_PLACE, before,
            });
        },

        async setVisibility(visibility, { id = undefined } = {}) {
            const before = store.get();
            const wanted = id === undefined ? profileRecordIdOf(before.record) : id;
            if (!wanted) {
                log.warn('a visibility write was asked for with no record seated — ignored');
                return before;
            }
            if (!Object.values(PROFILE_VISIBILITY).includes(visibility)) {
                log.warn(`'${visibility}' is not a visibility this build knows — ignored`);
                return before;
            }
            patch({
                visibility: {
                    ...before.visibility,
                    status: VISIBILITY_WRITE.WRITING,
                    wanted: visibility,
                    refusal: null,
                    error: null,
                    at: now(),
                },
            });
            const result = await writeVisibility(wanted, visibility);
            if (!result.ok) {
                const refusal = profileRefusal(result);
                if (refusal) log.info(`visibility refused: ${refusal.error}`);
                else log.warn(`visibility '${visibility}' for ${wanted} failed: ${result && result.message}`);
                return patch({
                    visibility: {
                        ...store.get().visibility,
                        status: VISIBILITY_WRITE.FAILED,
                        wanted: null,
                        refusal,
                        error: refusal ? null : (result ?? null),
                        at: now(),
                    },
                });
            }
            const served = profileVisibilityOf(result.data);
            return patch({
                visibility: {
                    status: VISIBILITY_WRITE.DONE,
                    value: served,
                    wanted: null,
                    refusal: null,
                    error: null,
                    at: now(),
                },
            });
        },

        /**
         * How many unsaved changes, against the record the server last served. The rule that
         * survives B10: when it cannot be told, the answer is CLEAN.
         */
        changeCount(draft) { return changeCountOf(draft, store.get().baseline); },

        /** The two props `<ui-page-header>` takes. A count crosses the boundary, not a word. */
        headerCommit(draft) { return headerCommitFor(api.changeCount(draft)); },

        /** B11's facts for the current record — parentId and the hashes, verbatim. */
        lineage() { return store.get().lineage; },

        /** The last save's version answer, or null before a save. */
        version() { return store.get().version; },

        /** The last save's report. `outcomeSource:'absent'` until R8 serves one. */
        report() { return store.get().report; },

        /** Clear the save surface — the user acknowledged it, or moved on. */
        clearSave() {
            return patch({
                save: SAVE_STATUS.IDLE, report: null, refusal: null, error: null, version: null,
            });
        },

        /** Forget the record entirely. Leaving the editor. */
        close() { return store.set({ ...EMPTY_STATE }); },

        stop() { store.destroy(); },
    };

    return api;
}
