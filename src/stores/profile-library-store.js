// THE PROFILE LIBRARY STORE — the selector screen's one door to the profile routes.
//
// Wave 5.3, `sel-core-loop` / `sel-highlight-by-id` / `sel-restore-to-factory` /
// `sel-versions-entry-point` / `sel-refusal-surfacing` / `sel-contract-table`.
//
// ============================================================================
// WHY A STORE AT ALL, WHEN `profile-rules.js` DELIBERATELY IS NOT ONE
// ============================================================================
//
// The pm-rules row asked exactly this question and answered it for ITSELF (wave 5.3
// digest `pm-rules`, DQ 1): "A DOM-free domain module in src/lib/, with transport and
// storage injected and no subscribe/observable surface. The only stateful piece, the
// metadata write chain, is created and owned by its caller."
//
// This file is that caller. The five transcribed rules are decisions — which records are
// listable, what a favourite slot is called, when a seed may be marked user-initialised —
// and a decision has no state. A SCREEN does: it holds a listing, a selection, a loaded
// id, a rail of five favourites, a refusal and a restore in flight, and it has to publish
// changes in all six to a Lit element that re-renders. That is `createStore`'s job and it
// is the only thing added here on top of `profile-rules.js`.
//
// So the layering is one sentence long: `profile-rules.js` decides, this store remembers
// and calls, `<selector-screen>` renders. The screen imports no route id and no fetch;
// the standing order is "endpoints via the generated client + stores ONLY" and the
// mechanism for it is that this is the only file in the cluster that imports `callRoute`.
//
// ============================================================================
// THE ROUTES, EVERY ONE CHECKED AGAINST THE HANDLER AT THE PIN 2b047d02
// ============================================================================
//
//   getProfiles                     GET  /api/v1/profiles?includeHidden=true
//        Reached through `readProfileListing` (rule 1), never directly. ONE query form,
//        and that is not a convenience: `tools/mock_rea.py` `_resolve` matches the exact
//        path INCLUDING the query string and its endpoint fallback is deleted (A7), so
//        `?visibility=visible` is a 503 naming the path rather than a different page.
//        Filtering client-side is also what the handler forces — row gate
//        `soft-delete-is-served`.
//        ETAG IS THE TRANSPORT'S, NOT THIS FILE'S. `/profiles` is in CONDITIONAL_ROUTES
//        (`rea-conditional.js:63`), so `rea-transport.js:167-311` sends `If-None-Match`,
//        turns a 304 into `{ok:true, data: stored.data, notModified:true}` and CLEARS the
//        store on a write. Nothing here sets a header; what it does do is COUNT the 304s,
//        because "the second read was conditional" is a claim the wave has to prove.
//
//   getWorkflow                     GET  /api/v1/workflow
//        R1's input, and only that. The report is handed to `r1LoadedProfileId` whole and
//        this file reads no field of it — reading `report.id` here would be the very trap
//        `R1_WRONG_KEY` is exported to name (it is the WORKFLOW's uuid).
//
//   postMachineProfile              POST /api/v1/machine/profile
//        Reached through `createProfileArmStore`, which already owns it. `arm()` here is
//        the one line `profile-arm-store.js` says it is waiting for: "the profile-library
//        row that owns picking a profile is the one that closes it, in one line, by
//        calling `arm.arm(profile, {profileId})`." B9's trigger, closed.
//
//   postProfilesRestoreByFilename   POST /api/v1/profiles/restore/{filename}
//        D6's first half. See RESTORE below — the handler's behaviour is not what the
//        route name suggests and the row carries the reading.
//
//   getProfilesByIdLineage          GET  /api/v1/profiles/{id}/lineage
//        B11's entry point (Q7). The 200 body is NEVER empty and this route has no
//        reachable 404; a missing id comes back 500 — see VERSIONS.
//
//   deleteProfilesByIdPurge         DELETE /api/v1/profiles/{id}/purge
//        D6's SECOND half, and it LANDED on 25 August 2026 (Ben: "yes build it behind a
//        confirm that says plainly it cannot be undone"). This header used to open "AND
//        ONE ROUTE THIS FILE MUST NOT CALL, named so the absence is deliberate" — the
//        absence was deliberate and it is over. `purge()` is the caller and
//        `D6_PURGE_IS_LANDED` records the crossing.
//        IT IS THE ONLY ROUTE THAT REMOVES ANYTHING. Every other write on this screen is
//        reversible; this one is not, which is what the confirm in front of it says.
//
// ============================================================================
// RESTORE (D6) — WHAT THE HANDLER ACTUALLY DOES, READ AT THE PIN
// ============================================================================
//
// `ProfileHandler._handleRestoreDefault` -> `ProfileController.restoreDefault(filename)`
// (`profile_controller.dart:390-421`), and it has TWO branches, only one of which
// restores content:
//
//   1. It loads `assets/defaultProfiles/<filename>` and builds a ProfileRecord from it,
//      whose id is derived from the profile's own content.
//   2. IF A RECORD WITH THAT ID ALREADY EXISTS it does NOT rewrite it. It sets
//      `visibility: visible` on the stored one and returns that.
//   3. Only when the id is absent is the bundled content stored.
//
// So "restore to factory" is precisely two things at once: un-hide the factory record if
// it is still there, and re-create it from the bundle if it is not. Both are the same
// call, which is why the screen offers ONE action. The consequence worth knowing is that
// a user's EDIT of a bundled profile is a different record with a different id and is
// untouched by this call — restoring does not delete anyone's work, and the confirm
// dialog must not say that it does.
//
// THE PARAMETER IS A FILENAME, NOT AN ID. It comes off the record's own metadata
// (`{'source':'bundled', 'filename':…}`, written by the same controller), which is why
// `restorableProfiles()` — hidden AND `isDefault` — is the offer list and why a record
// with no filename cannot be offered. 82 of the fixture's 147 records carry one; 10 are
// hidden-and-default, which is the D6 population on this machine.
//
// ============================================================================
// VERSIONS (B11 / Q7)
// ============================================================================
//
// THE ANSWER IS IN THE LIST, NOT IN THE STATUS. `ProfileController.getLineage` checks the
// id FIRST and then ALWAYS adds the profile itself before it walks parents and children
// (`profile_controller.dart:299-303`, then `:308`), so the 200 body can never be empty: a
// profile with no parent and no children answers 200 with exactly ONE entry, and that entry
// IS the profile. `{status:'none'}` is therefore derived from the list — `length <= 1` —
// which is data, not a status code.
//
// AND THERE IS NO 404 HERE TO READ. `_handleGetLineage` (`profile_handler.dart:205-219`)
// carries no `on ArgumentError` clause where four of its siblings do, so the
// `ArgumentError('Profile not found: <id>')` a missing or deleted id throws falls into the
// generic catch and answers 500; the handler's own `if (lineage.isEmpty)` 404 at `:210-211`
// is unreachable in every case. This store transcribed the opposite model until 21 Aug — a
// 404 -> `none` branch nothing could take, while the real missing-id 500 fell through to
// `failed` and was logged as a fault. The branch is DELETED rather than re-pointed: a
// fallback for a status the handler cannot send is the A7 defect, and it hides the day the
// server starts sending one. The upstream ask (give `_handleGetLineage` the sibling clause)
// is recorded on the `getProfilesByIdLineage` contract row, not worked around here.
//
// ============================================================================
// R1 — THE PROVISIONAL PATH, AND WHERE ITS MARKING GOES
// ============================================================================
//
// `r1LoadedProfileId` already carries the marking in code (`adapters-r.js:332-421`:
// the banner-delimited section, `R1_WRONG_KEY`, `R1_UNRESOLVED`, `provisional: true` on
// EVERY answer, and the basis string "title match against the profile listing —
// PROVISIONAL (R1)"). This store's job is to carry that marking OUT of the adapter and
// into the state the screen renders, unaltered and un-summarised — `basis`, `provisional`
// and `reason` travel verbatim — so the screen can mark the highlight rather than having
// to know why. Flattening `known: false` into "no highlight" here would delete exactly the
// information the review is looking for.
//
// NOTHING HERE PICKS A WINNER ON AMBIGUITY. The adapter reports duplicate titles and does
// not resolve them; this file does not resolve them either, and the candidate list rides
// through so the screen can say how many.

import { buildPath, callRoute, routeById } from '../data/rea-routes.js';
import {
    profileRecordIdOf, profileTitleOf, profileMetadataOf,
    profileCreateBody, profileUpdateBody, readProfileFile, workflowApplyBody,
} from '../data/rea-profile.js';
import { r1LoadedProfileId, R1_SOURCE } from '../data/adapters-r.js';
import {
    readProfileListing,
    restorableProfiles,
    autoPopulateFavourites,
    healFavouriteAssignments,
    loadFavouriteAssignments,
    saveFavouriteAssignments,
    loadLoadedProfileId,
    saveLoadedProfileId,
    rememberedRecord,
    shouldAutoPopulate,
    shortProfileTitle,
    FAVOURITE_SLOT_COUNT,
} from '../lib/profile-rules.js';
import { supersededIds } from '../lib/profile-lineage.js';
import { createStore } from './store.js';
import { ARM_STATUS } from './profile-arm-store.js';

export const D6_PURGE_IS_LANDED = Object.freeze({
    decision: 'D6',
    half: 'purge deleted profiles',
    landed: '25 August 2026',
    why: 'Ben: "yes build it behind a confirm that says plainly it cannot be undone."',
    routeId: 'deleteProfilesByIdPurge',
});

/** Where the listing got to. */
export const LIBRARY_STATUS = Object.freeze({
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    FAILED: 'failed',
});

/** Where a restore-to-factory got to. */
export const RESTORE_STATUS = Object.freeze({
    IDLE: 'idle',
    RESTORING: 'restoring',
    RESTORED: 'restored',
    FAILED: 'failed',
});

/** Where a versions read got to. `NONE` is a lineage of ONE — the profile, and no siblings. */
export const ADD_STATUS = Object.freeze({
    IDLE: 'idle',
    ADDING: 'adding',
    ADDED: 'added',
    REFUSED: 'refused',
    FAILED: 'failed',
});

/** The two plugins the add paths reach, by ReaPrime's own ids. */
export const VISUALIZER_PLUGIN = 'visualizer.reaplugin';

export const GENERATOR_PLUGIN = 'decent-profile.reaplugin';

export const VERSIONS_STATUS = Object.freeze({
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    NONE: 'none',
    FAILED: 'failed',
});

const NOOP_LOGGER = Object.freeze({
    debug() {}, info() {}, warn() {}, error() {}, scope() { return NOOP_LOGGER; },
});

const scoped = (logger) => (logger && logger.scope ? logger.scope('profiles') : (logger || NOOP_LOGGER));

const EMPTY_LOADED = Object.freeze({
    id: null,
    title: null,
    known: false,
    /** True while the id came from R1's TITLE MATCH. The screen marks the row off this. */
    provisional: false,
    /** `R1_SOURCE` — 'workflow-id' once R1 lands, 'title-match' until then, else null. */
    source: null,
    /** The R layer's own flag, true on every adapter answer. Not the marking. */
    layerProvisional: false,
    basis: null,
    reason: null,
    candidates: null,
});

const EMPTY_STATE = Object.freeze({
    status: LIBRARY_STATUS.IDLE,
    /** Every record the server served, unfiltered — `restorableProfiles` needs the hidden. */
    records: Object.freeze([]),
    /** Rule 1's answer: what a listing may show. */
    listable: Object.freeze([]),
    /** The records the library is hiding — what the Hidden toggle shows. */
    hidden: Object.freeze([]),
    /** Hidden AND isDefault: D6's offer list. */
    restorable: Object.freeze([]),
    /** The row the user is looking at. */
    selectedId: null,
    /** R1's answer, whole. See the header. */
    loaded: EMPTY_LOADED,
    /** `{0..4: id|null}` plus whether a person has ever chosen (rule 5). */
    favourites: Object.freeze({ assignments: Object.freeze({}), seeded: false }),
    /** The arm-time refusal, as `profileRefusal` reads it. B9's surface reads this. */
    refusal: null,
    /** A non-400 arm fault. Never a refusal. */
    armError: null,
    armingId: null,
    restore: Object.freeze({ status: RESTORE_STATUS.IDLE, filename: null, error: null }),
    versions: Object.freeze({ status: VERSIONS_STATUS.IDLE, id: null, records: Object.freeze([]) }),
    /** The last add attempt — a file, a share code, or nothing yet. */
    add: Object.freeze({ status: ADD_STATUS.IDLE, reason: null, error: null }),
    /** How the listing has been read. `conditional` counts the 304s the transport served. */
    reads: Object.freeze({ listing: 0, conditional: 0, failed: 0 }),
    /** The transport failure behind `status: failed`, verbatim. */
    error: null,
});

export function matchProfiles(records, query) {
    const wanted = String(query ?? '').trim().toLowerCase();
    if (wanted === '') return [...records];
    return records.filter((record) => {
        const title = (profileTitleOf(record) || '').toLowerCase();
        if (title.includes(wanted)) return true;
        const author = record && record.profile && typeof record.profile.author === 'string'
            ? record.profile.author.toLowerCase() : '';
        return author.includes(wanted);
    });
}

/** The bundle filename D6 restores from, or null if this record was not bundled. */
export function restoreFilenameOf(record) {
    const metadata = profileMetadataOf(record);
    const filename = metadata && typeof metadata.filename === 'string' ? metadata.filename : '';
    return filename === '' ? null : filename;
}

function listableLoadedId(listable, loaded) {
    const id = loaded?.id ?? null;
    if (!id) return null;
    return listable.some((record) => record?.id === id) ? id : null;
}

export const LOADED_SOURCE = Object.freeze({
    /** `report.profile.id` — R1 has landed and the machine names the record itself. */
    WORKFLOW_ID: R1_SOURCE.WORKFLOW_ID,
    /** Matched by title against the listing. Right whenever the title is unique. */
    TITLE_MATCH: R1_SOURCE.TITLE_MATCH,
    /** The id this skin armed, still carrying the title the machine is running. */
    REMEMBERED: 'remembered',
});

export function createProfileLibraryStore({
    transport, storage, arm, workflow = null, logger = null, now = () => Date.now(),
} = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createProfileLibraryStore: a transport must be injected (see createReaTransport)');
    }
    if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function') {
        throw new Error('createProfileLibraryStore: a storage router must be injected (see createStorageRouter)');
    }
    if (!arm || typeof arm.arm !== 'function') {
        throw new Error('createProfileLibraryStore: a profile arm store must be injected');
    }
    const log = scoped(logger);
    const store = createStore({ ...EMPTY_STATE }, { label: 'profileLibrary', logger: log });
    let armedId = null;
    const patch = (fields) => store.set({ ...store.get(), ...fields });

    const unwatchArm = arm.subscribe((armState) => {
        patch({ refusal: armState.refusal ?? null, armError: armState.error ?? null });
    });

    /** The listing, partitioned, with R1's answer over it. One read of each route. */
    async function readListing() {
        const listing = await readProfileListing(transport, { logger });
        const reads = store.get().reads;
        if (!listing.ok) {
            log.warn(`profile listing unusable: ${listing.reason}`);
            patch({
                status: LIBRARY_STATUS.FAILED,
                error: listing.failure,
                reads: { ...reads, listing: reads.listing + 1, failed: reads.failed + 1 },
            });
            return store.get();
        }
        return {
            listing,
            reads: {
                listing: reads.listing + 1,
                conditional: reads.conditional + (listing.notModified ? 1 : 0),
                failed: reads.failed,
            },
        };
    }

    async function readLoaded(records) {
        const result = await callRoute(transport, 'getWorkflow');
        const report = result.ok ? result.data : null;
        if (!result.ok) log.debug(`workflow read failed (${result.message}) — no loaded-profile highlight`);
        const answer = r1LoadedProfileId(report, records);
        const value = answer.value || {};

        if (!value.id) {
            const remembered = rememberedRecord(
                records, armedId ?? await loadLoadedProfileId(storage), value.title ?? title(report));
            if (remembered) {
                return Object.freeze({
                    id: remembered.id,
                    title: remembered.profile.title,
                    known: true,
                    provisional: true,
                    source: LOADED_SOURCE.REMEMBERED,
                    layerProvisional: answer.provisional === true,
                    basis: 'the id this skin armed, still carrying the title the machine is running',
                    reason: null,
                    candidates: Array.isArray(value.candidates)
                        ? Object.freeze([...value.candidates]) : null,
                });
            }
        }

        return Object.freeze({
            id: value.id ?? null,
            title: value.title ?? null,
            known: answer.known === true,
            provisional: value.source === R1_SOURCE.TITLE_MATCH,
            source: value.source ?? null,
            /** The adapter's own flag for the whole R layer, kept so nothing is lost. */
            layerProvisional: answer.provisional === true,
            basis: answer.basis ?? null,
            reason: value.reason ?? null,
            candidates: Array.isArray(value.candidates) ? Object.freeze([...value.candidates]) : null,
        });
    }

    /** The workflow report's own profile title, or null. R1 reads the same field. */
    function title(report) {
        const profile = report && typeof report === 'object' && report.profile
            && typeof report.profile === 'object' ? report.profile : null;
        return profile && typeof profile.title === 'string' && profile.title !== ''
            ? profile.title : null;
    }

    async function readFavourites(listable, all) {
        const held = await loadFavouriteAssignments(storage, { count: FAVOURITE_SLOT_COUNT });
        if (!shouldAutoPopulate(held)) {
            const heal = healFavouriteAssignments(held.assignments, all, { count: FAVOURITE_SLOT_COUNT });
            if (heal.healed) {
                for (const change of heal.changes) {
                    log.info(`favourite slot ${change.slot} pointed at hidden ${change.from} — `
                        + `healed to ${change.to} (${change.basis})`);
                }
                const save = await saveFavouriteAssignments(storage, heal.assignments, {
                    markUserInitialized: false, logger,
                });
                if (!save.saved) {
                    log.warn('the healed favourite rail did not persist — it is correct in '
                        + 'this session and the next launch will heal it again');
                }
            }
            return Object.freeze({
                assignments: Object.freeze({ ...heal.assignments }),
                seeded: held.seeded,
            });
        }
        const populated = await autoPopulateFavourites({ storage, records: listable, logger });
        return Object.freeze({
            assignments: Object.freeze({ ...populated.assignments }),
            seeded: false,
        });
    }

    async function armRecord(record, recordId) {
        const armed = await arm.arm(record.profile, { profileId: recordId });
        if (!armed || armed.status === ARM_STATUS.REFUSED) return armed;

        armedId = recordId;
        await saveLoadedProfileId(storage, armedId);

        if (!workflow) return armed;
        const body = workflowApplyBody(record);
        if (body) await workflow.apply(body, { label: `profile '${profileTitleOf(record)}'` });
        await api.load();
        return armed;
    }

    const api = {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },

        /** The record behind an id, or null. The screen never indexes the array itself. */
        recordFor(id) {
            if (!id) return null;
            return store.get().records.find((record) => profileRecordIdOf(record) === id) || null;
        },

        /** The selected record, or null. */
        selected() { return api.recordFor(store.get().selectedId); },

        /** Rule 2's short label for a record — the five fixed-width favourite slots. */
        shortTitle(record) { return shortProfileTitle(profileTitleOf(record) || ''); },

        async load() {
            patch({ status: LIBRARY_STATUS.LOADING, error: null });
            const first = await readListing();
            if (!first.listing) return first;
            const { listing, reads } = first;

            const [loaded, favourites] = await Promise.all([
                readLoaded(listing.all),
                readFavourites(listing.listable, listing.all),
            ]);

            const restorable = restorableProfiles(listing.all).filter((r) => restoreFilenameOf(r) !== null);
            const superseded = supersededIds(listing.all);
            log.info(`profile library: ${listing.listable.length} listable, ${restorable.length} restorable, `
                + `${superseded.size} superseded, `
                + `loaded ${loaded.id ?? `unresolved (${loaded.reason})`}`);

            return patch({
                status: LIBRARY_STATUS.READY,
                records: Object.freeze([...listing.all]),
                listable: Object.freeze([...listing.listable]),
                hidden: Object.freeze(
                    [...listing.hidden, ...listing.deleted]
                        .filter((record) => !superseded.has(profileRecordIdOf(record)))),
                restorable: Object.freeze(restorable),
                loaded,
                selectedId: store.get().selectedId ?? listableLoadedId(listing.listable, loaded) ?? null,
                favourites,
                reads: Object.freeze(reads),
                error: null,
            });
        },

        /** Re-read the listing only. The rail and the highlight are re-derived off it. */
        async refresh() { return api.load(); },

        /** Pick a row. Clears nothing else — a refusal survives until it is acknowledged. */
        select(id) {
            if (store.get().selectedId === id) return store.get();
            return patch({ selectedId: id ?? null });
        },

        async purge(id = store.get().selectedId) {
            const record = api.recordFor(id);
            if (!record) {
                log.warn('purge: no record for that id');
                return store.get();
            }
            const result = await callRoute(transport, 'deleteProfilesByIdPurge', { params: { id } });
            if (!result.ok && result.status !== 404) {
                log.warn(`purge ${id} failed: ${result.message}`);
                return store.get();
            }
            log.info(`purge ${id}: removed`);
            patch({ selectedId: null });
            await api.load();
            return store.get();
        },

        async arm(id = store.get().selectedId) {
            const record = api.recordFor(id);
            if (!record) {
                log.warn('arm: no record for the selected id');
                return null;
            }
            const recordId = profileRecordIdOf(record);
            /* THE HIGHLIGHT MOVES HERE, BEFORE THE FIRST REQUEST, and it is the store's
             * own fact rather than a screen's guess. See `armingId` on EMPTY_STATE. */
            patch({ armingId: recordId });
            try {
                return await armRecord(record, recordId);
            } finally {
                patch({ armingId: null });
            }
        },

        async rememberContext(fields) {
            if (!fields || typeof fields !== 'object') return store.get();
            const id = store.get().loaded ? store.get().loaded.id : null;
            const record = id ? api.recordFor(id) : null;
            if (!record) return store.get();
            const metadata = { ...(profileMetadataOf(record) ?? {}), ...fields };
            const result = await callRoute(transport, 'putProfilesById', {
                params: { id: profileRecordIdOf(record) },
                body: profileUpdateBody({ metadata }),
            });
            if (!result.ok) {
                log.warn(`remembering the profile's numbers failed: ${result.message}`);
                return store.get();
            }
            const recordId = profileRecordIdOf(record);
            const patched = Object.freeze({ ...record, metadata: Object.freeze(metadata) });
            const swap = (list) => Object.freeze(
                list.map((r) => (profileRecordIdOf(r) === recordId ? patched : r)));
            const held = store.get();
            return patch({
                records: swap(held.records),
                listable: swap(held.listable),
                restorable: swap(held.restorable),
            });
        },

        /** The user acknowledged the refusal, or picked something else. */
        clearRefusal() { arm.clear(); return store.get(); },

        async restoreToFactory(id) {
            const record = api.recordFor(id);
            const filename = restoreFilenameOf(record);
            if (!filename) {
                log.warn('restore: this record carries no bundle filename — not a bundled profile');
                return patch({
                    restore: { status: RESTORE_STATUS.FAILED, filename: null, error: null },
                });
            }
            patch({ restore: { status: RESTORE_STATUS.RESTORING, filename, error: null } });
            const result = await callRoute(transport, 'postProfilesRestoreByFilename', {
                params: { filename },
            });
            if (!result.ok) {
                log.warn(`restore ${filename} failed: ${result.message}`);
                return patch({ restore: { status: RESTORE_STATUS.FAILED, filename, error: result } });
            }
            patch({ restore: { status: RESTORE_STATUS.RESTORED, filename, error: null } });
            await api.load();
            return store.get();
        },

        async hide(id = store.get().selectedId) {
            const record = api.recordFor(id);
            if (!record) {
                log.warn('hide: no record for that id');
                return store.get();
            }
            const result = await callRoute(transport, 'deleteProfilesById', { params: { id } });
            if (!result.ok && result.status !== 404) {
                log.warn(`hide ${id} failed: ${result.message}`);
                return store.get();
            }
            patch({ selectedId: null });
            await api.load();
            return store.get();
        },

        async createFromFile(text) {
            let parsed;
            try {
                parsed = JSON.parse(String(text));
            } catch {
                patch({ add: { status: ADD_STATUS.REFUSED, reason: 'not-json', error: null } });
                return store.get();
            }
            const read = readProfileFile(parsed);
            if (!read.ok) {
                patch({ add: { status: ADD_STATUS.REFUSED, reason: read.reason, error: null } });
                return store.get();
            }
            patch({ add: { status: ADD_STATUS.ADDING, reason: null, error: null } });
            const result = await callRoute(transport, 'postProfiles', {
                body: profileCreateBody(read.profile),
            });
            if (!result.ok) {
                log.warn(`profile upload failed: ${result.message}`);
                patch({ add: { status: ADD_STATUS.FAILED, reason: null, error: result } });
                return store.get();
            }
            patch({ add: { status: ADD_STATUS.ADDED, reason: null, error: null } });
            await api.load();
            return store.get();
        },

        async importShareCode(code) {
            const shareCode = String(code ?? '').trim();
            if (!shareCode) {
                patch({ add: { status: ADD_STATUS.REFUSED, reason: 'no-code', error: null } });
                return store.get();
            }
            patch({ add: { status: ADD_STATUS.ADDING, reason: null, error: null } });
            const result = await callRoute(transport, 'postPluginsByIdByEndpoint', {
                params: { id: VISUALIZER_PLUGIN, endpoint: 'import' },
                body: { shareCode },
            });
            if (!result.ok) {
                const reason = result.status === 401 ? 'not-signed-in'
                    : (result.status === 400 ? 'bad-code' : null);
                log.info(`share code not imported (${result.status}): ${result.message}`);
                patch({
                    add: {
                        status: reason ? ADD_STATUS.REFUSED : ADD_STATUS.FAILED,
                        reason,
                        error: result,
                    },
                });
                return store.get();
            }
            patch({ add: { status: ADD_STATUS.ADDED, reason: null, error: null } });
            await api.load();
            return store.get();
        },

        /** Forget the last add — what a dialog's close asks for. */
        clearAdd() {
            if (store.get().add.status === ADD_STATUS.IDLE) return store.get();
            return patch({ add: { status: ADD_STATUS.IDLE, reason: null, error: null } });
        },

        async generatorUrl() {
            const result = await callRoute(transport, 'getPlugins', {});
            if (!result.ok || !Array.isArray(result.data)) return null;
            const plugin = result.data.find((entry) => entry && entry.id === GENERATOR_PLUGIN);
            if (!plugin || plugin.loaded !== true) return null;
            const path = buildPath(routeById('getPluginsByIdByEndpoint'),
                { id: GENERATOR_PLUGIN, endpoint: 'ui' });
            const base = String(transport.baseUrl ?? '').replace(/\/+$/, '');
            return `${base}${path}?layout=baseline`;
        },

        async versionsOf(id) {
            const wanted = id ?? store.get().selectedId;
            if (!wanted) return store.get();
            patch({ versions: { status: VERSIONS_STATUS.LOADING, id: wanted, records: Object.freeze([]) } });
            const result = await callRoute(transport, 'getProfilesByIdLineage', { params: { id: wanted } });
            if (result.ok && Array.isArray(result.data)) {
                return patch({
                    versions: {
                        status: result.data.length > 1 ? VERSIONS_STATUS.READY : VERSIONS_STATUS.NONE,
                        id: wanted,
                        records: Object.freeze([...result.data]),
                    },
                });
            }
            log.warn(`lineage for ${wanted} failed: ${result.message}`);
            return patch({
                versions: { status: VERSIONS_STATUS.FAILED, id: wanted, records: Object.freeze([]) },
            });
        },

        clearVersions() {
            return patch({ versions: { status: VERSIONS_STATUS.IDLE, id: null, records: Object.freeze([]) } });
        },

        async setFavourite(slot, id) {
            const index = Number(slot);
            if (!Number.isInteger(index) || index < 0 || index >= FAVOURITE_SLOT_COUNT) {
                log.warn(`setFavourite: slot ${slot} is outside 0..${FAVOURITE_SLOT_COUNT - 1}`);
                return store.get();
            }
            const held = api.favouriteSlotHolding(id);
            if (held !== null) {
                log.info(`setFavourite: refused — ${id} is already on slot ${held}`);
                return store.get();
            }
            const current = store.get().favourites;
            const heal = healFavouriteAssignments(
                current.assignments, store.get().records, { count: FAVOURITE_SLOT_COUNT },
            );
            const { assignments } = heal;
            for (const change of heal.changes) {
                if (change.slot === index) continue;
                log.info(`favourite slot ${change.slot} pointed at hidden ${change.from} — `
                    + `healed to ${change.to} (${change.basis}) while writing slot ${index}`);
            }
            assignments[index] = id ?? null;
            const save = await saveFavouriteAssignments(storage, assignments, { logger });
            if (!save.saved) {
                log.warn('favourite not persisted — the rail is left as it was');
                return store.get();
            }
            return patch({
                favourites: Object.freeze({ assignments: Object.freeze(assignments), seeded: save.marked }),
            });
        },

        async healFavourites() {
            const current = store.get().favourites;
            const heal = healFavouriteAssignments(
                current.assignments, store.get().records, { count: FAVOURITE_SLOT_COUNT },
            );
            if (!heal.healed) return heal.changes;
            for (const change of heal.changes) {
                log.info(`favourite slot ${change.slot} pointed at hidden ${change.from} — `
                    + `healed to ${change.to} (${change.basis})`);
            }
            /* RULE 5 AGAIN: a repair is not a choice, so it never marks the rail
             * user-initialised. See `readFavourites` for the full argument. */
            const save = await saveFavouriteAssignments(storage, heal.assignments, {
                markUserInitialized: false, logger,
            });
            if (!save.saved) {
                log.warn('the healed favourite rail did not persist — it is correct in this '
                    + 'session and the next launch will heal it again');
            }
            patch({
                favourites: Object.freeze({
                    assignments: Object.freeze({ ...heal.assignments }),
                    seeded: current.seeded,
                }),
            });
            return heal.changes;
        },

        favouriteSlotHolding(id) {
            if (!id) return null;
            const { assignments } = store.get().favourites;
            for (let slot = 0; slot < FAVOURITE_SLOT_COUNT; slot += 1) {
                if (assignments[slot] === id) return slot;
            }
            return null;
        },

        /** The first empty slot, or null when the rail is full. */
        firstEmptySlot() {
            const { assignments } = store.get().favourites;
            for (let slot = 0; slot < FAVOURITE_SLOT_COUNT; slot += 1) {
                if (!assignments[slot]) return slot;
            }
            return null;
        },

        favouriteEntries() {
            const { assignments } = store.get().favourites;
            const out = [];
            for (let slot = 0; slot < FAVOURITE_SLOT_COUNT; slot += 1) {
                const id = assignments[slot] || null;
                const record = id ? api.recordFor(id) : null;
                out.push(record
                    ? { value: id, name: api.shortTitle(record) }
                    : null);
            }
            return out;
        },

        /** The last time anything was published, for a caller that wants to age the view. */
        at() { return now(); },

        stop() {
            unwatchArm();
            store.destroy();
        },
    };

    return api;
}
