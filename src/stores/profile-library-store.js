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

/**
 * D6's deferred half, written down so the boundary is a fact in the build rather than an
 * omission someone later reads as an oversight.
 *
 * Part 1's deferred table: "Purging deleted profiles | D6 (second half)". The route exists
 * (`deleteProfilesByIdPurge`), the handler is read, and this build does not call it. When
 * the deferred half lands, this constant is what a grep for "purge" finds.
 */
export const D6_PURGE_IS_LANDED = Object.freeze({
    decision: 'D6',
    half: 'purge deleted profiles',
    landed: '25 August 2026',
    why: 'Ben: "yes build it behind a confirm that says plainly it cannot be undone."',
    /**
     * WHAT WAS DEFERRED, AND WHAT MADE IT SAFE TO LAND.
     *
     * Part 1's deferred table read "Purging deleted profiles | D6 (second half)", and this
     * constant used to say `deferredRouteId` with a note explaining that gate D reads
     * `routeId` as an ADDRESS, so a route nothing called had to be spelled a different way
     * or the table would claim a caller that did not exist.
     *
     * It exists now. `purge` below is the caller, the contract row moves from `recorded` to
     * `consumed`, and the field is spelled `routeId` because that is what it is.
     *
     * IT IS THE ONLY ROUTE THAT REMOVES ANYTHING. The contract's own words: "this is the
     * ONLY route that actually removes a profile record — DELETE /profiles/<id> is a soft
     * delete (Visibility.deleted / .hidden), which is why the listing has to filter
     * client-side". Everything else this screen does is reversible: a hidden bundled
     * profile comes back through Restore, and a hidden user profile is still on the server.
     * This one is not, which is why the confirm says so in those words rather than in the
     * word "permanently" — and why it is reachable only from the Hidden list, where a user
     * has already decided once.
     */
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
/**
 * Where an ADD got to. One state for three doors (a file, a share code, the generator),
 * because a person adding a profile is doing one thing and the surface reporting it is
 * one dialog.
 *
 * REFUSED CARRIES A REASON AND FAILED DOES NOT. A refusal is the server or this store
 * saying no to something specific — a file that is not a profile, a code that is wrong,
 * an account that is not signed in — and the screen has a sentence for each. A failure
 * is everything else, and its sentence is the same one every failure gets.
 */
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
    /**
     * THE RECORD THIS STORE IS LOADING RIGHT NOW, or null. Not optimism — a fact.
     *
     * Ben, 27 August 2026, machine disconnected: "now I cannot seem to select a favorite,
     * do I need a machine connected to pick one" / "it highlights but if you then click
     * edit profile it will show the previous one". Reproduced on his tablet: the slot
     * highlights, about six seconds later it snaps back, Edit profile opens the profile
     * from before, and nothing is said anywhere.
     *
     * Half of that was the gate in `arm()` below. The other half was WHO OWNS THE
     * HIGHLIGHT. `<live-screen>`'s `#onFavourite` used to set `this.favourite` itself and
     * `live-wiring.js` overwrote it from `loaded.id` on the next update, so two owners
     * wrote one property and the loser was whichever ran last. That is L11's shape, and
     * the visible symptom is a highlight that moves and then un-moves for no reason a
     * person can see.
     *
     * ONE OWNER, AND IT IS THIS STORE, because this store owns the whole two-write
     * sequence — POST the profile, PUT the document, re-read the listing. `loaded.id` is
     * only true at the END of it; for the second or two it is running, "the profile this
     * app is loading" is the honest answer and there is nowhere else that knows it. It is
     * set before the first request goes out and cleared in a `finally`, by which time
     * `loaded` has been re-read and carries the same id — so the highlight crosses from
     * the intent to the fact with no gap and no flicker.
     *
     * A REFUSED PROFILE CLEARS IT AND THE HIGHLIGHT GOES BACK, which is correct and is
     * the one case where it should: the machine will not run it, the document was not
     * written, and `<live-refusal>` is on screen saying so.
     */
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

/**
 * Which records a query matches. A PURE function, exported so the screen's filter and the
 * store's own state cannot drift apart, and so the rule is testable without a browser.
 *
 * The match is on the WHOLE title, not the short one: a person who types "Tea" expects the
 * Tea portafilter family, and `shortProfileTitle` deliberately throws the family away
 * (that is rule 2, and it is for the five favourite slots where the width is fixed).
 * Author is matched too — 82 of the fixture's records carry one and "Decent" is a real
 * thing to search for.
 */
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

/**
 * @param {object} deps
 * @param {object} deps.transport  `createReaTransport(...)`
 * @param {object} deps.storage    `createStorageRouter(...)` — the favourites rail's home
 * @param {object} deps.arm        `createProfileArmStore(...)`; the arm route has ONE owner
 * @param {object} [deps.logger]
 * @param {() => number} [deps.now]
 */

/**
 * The loaded profile's id, but only when the LIST can show it.
 *
 * A profile can be loaded on the machine and hidden in the library — hiding the profile
 * you are pulling is an ordinary thing to do — and seeding the selection with it would
 * leave the detail pane naming a profile that is not on the list beside it. That is the
 * exact sentence `profile-library-store.test.mjs` uses for the same failure reached from
 * the other side, when a hide left `selectedId` on the record it had just removed.
 */
function listableLoadedId(listable, loaded) {
    const id = loaded?.id ?? null;
    if (!id) return null;
    return listable.some((record) => record?.id === id) ? id : null;
}

/**
 * WHERE THE LOADED-PROFILE ID CAME FROM. Two of the three are R1's own vocabulary,
 * re-exported so a consumer reads one table; the third is this store's and could not be
 * R1's, because R1 answers about the WORKFLOW REPORT and this is a fact about what this
 * skin did.
 */
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
    /* OPTIONAL, AND ITS ABSENCE IS A REAL STATE: the selector's own layout demo builds
     * this store with no shell behind it. A load then arms the machine and leaves the
     * document alone, which is what this store did before the workflow half existed. */

    const log = scoped(logger);
    const store = createStore({ ...EMPTY_STATE }, { label: 'profileLibrary', logger: log });
    /* THE ID THIS SESSION ARMED, held here as well as stored. The store is the faster and
     * the more certain of the two: `saveLoadedProfileId` is a KV write over the network
     * and it can fail, and a highlight that waits for a round trip to come back is a
     * highlight that flickers. The stored copy is what survives a reload. */
    let armedId = null;
    const patch = (fields) => store.set({ ...store.get(), ...fields });

    /* THE ARM STORE IS MIRRORED, NOT RE-IMPLEMENTED. One subscription, dropped by stop().
     * B9's surface reads `refusal` off THIS store so the screen has one thing to render,
     * and the arm store stays the only owner of the route and of the refusal's wording. */
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

    /**
     * R1. The workflow report is fetched here and handed to the adapter WHOLE.
     *
     * A failed workflow read is not a failed load: the listing is the screen, and a
     * missing highlight is a smaller loss than a blank list. The adapter answers
     * `noWorkflow` for a null report, which is exactly the state to publish.
     */
    async function readLoaded(records) {
        const result = await callRoute(transport, 'getWorkflow');
        const report = result.ok ? result.data : null;
        if (!result.ok) log.debug(`workflow read failed (${result.message}) — no loaded-profile highlight`);
        const answer = r1LoadedProfileId(report, records);
        const value = answer.value || {};

        /* WHEN THE TITLE CANNOT DECIDE, THE MEMORY CAN. R1 matches the workflow's profile
         * title against the listing because the workflow carries no record id, and on the
         * bench machine ELEVEN records share the title "Extractamundo Dos!" — so the honest
         * answer is `ambiguous`, the highlight goes blank, and "Edit profile" has no record
         * to open. It reported the state correctly and left the app unable to act on it.
         *
         * `loadedProfileId` is the id this skin armed, remembered at the one moment it was
         * known for certain. `rememberedRecord` only returns it while its TITLE still
         * matches the workflow's, so a profile loaded by something else since cannot be
         * mistaken for this one.
         *
         * IT DOES NOT OVERRIDE A RESOLVED ANSWER. A unique title is a fact about the
         * machine; the memory is a fact about this skin, and the machine wins. */
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
            /* THE MARKING, AND IT IS A VALUE RATHER THAN A STRING MATCH. Every R-adapter
             * answer carries `answer.provisional: true` — that flag is about the LAYER,
             * not about this answer — so the screen's marking reads `value.source`:
             * `title-match` is the interim and `workflow-id` is R1 having landed. `basis`
             * rides along verbatim ("title match against the profile listing —
             * PROVISIONAL (R1)") because it is the sentence a reviewer wants to see. */
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

    /**
     * Rules 4, 5 and 6: read the rail, seed it on a first launch, never mark a failed
     * seed — and heal any slot left pointing at a record the library is hiding.
     *
     * ===========================================================================
     * HEALING HAPPENS ON READ, AND THE ARGUMENT FOR THAT IS BEN'S OWN RAIL
     * ===========================================================================
     *
     * The alternative was healing on WRITE — repair a slot at the moment the save that
     * stranded it lands, in `adoptSavedProfile`. That is where the 27 August
     * follow-through already lives, and it is genuinely the more responsive of the two:
     * it fixes the rail inside the session, without waiting for a reload, which matters
     * because Ben saves an edit and then looks straight at the Live rail.
     *
     * IT CANNOT BE THE ONLY PLACE, AND SLOT 4 IS THE PROOF. `profile:0546347d…` has been
     * hidden on his bench since 27 August — stranded by a save that happened BEFORE the
     * follow-through was written. No future save of that profile is coming to rescue it;
     * a write-time repair only ever fixes writes it is present for. Decal is at 0.1.41
     * and has been on his tablet for days, so damaged state already exists in the field,
     * and a fix that cannot reach state written by an older build is a fix that leaves
     * the reported fault on the reporter's machine.
     *
     * AND IT IS THE ONLY FORM THAT SURVIVES THE NEXT HOLE. Slot 0 was stranded by a save
     * path the follow-through did not know existed — the backward, idempotent-create
     * shape that rule 6's header sets out. There is no reason to believe that was the
     * last one. A read-time rule asks "does this slot name a hidden record?" and never
     * asks how it came to, so a save path nobody has thought of yet cannot strand a slot
     * for longer than one launch. That is the difference between a fix and a patch.
     *
     * SO IT IS BOTH, AND THEY COMPOSE IN ONE DIRECTION ONLY. The follow-through advances
     * the slot to the record that was just saved, which is visible by construction —
     * `settleToOneRow` makes the saved record visible before it hides anything. Healing
     * then looks at a visible id and leaves it alone (rule 6 branch 1). The reverse order
     * would be just as safe; there is simply nothing for the second one to do.
     *
     * -----------------------------------------------------------------------
     * THE WRITE-BACK IS CONDITIONAL, AND IT DOES NOT CLAIM THE USER CHOSE
     * -----------------------------------------------------------------------
     * Persisting the repair matters: a rail healed only in memory is healed again on
     * every launch, and every OTHER reader of `favouriteProfiles` — another skin, a REST
     * client, ReaPrime itself — goes on seeing the stale ids. But it is written ONLY when
     * `healed` is true, so an ordinary launch performs no write at all.
     *
     * `markUserInitialized: false` is rule 5, and it is load-bearing rather than
     * defensive. The flag means "somebody chose this", and a repair is not a choice; a
     * heal that set it would mark an auto-populated rail user-initialised on the strength
     * of housekeeping the user never did, which is precisely the masquerade rule 5's own
     * comment is about. The held flag rides through untouched, so a rail Ben HAS chosen
     * stays chosen and a rail he has not stays retryable. Nothing is re-seeded either
     * way: `shouldAutoPopulate` needs an EMPTY rail, and a healed rail is not empty.
     *
     * @param {object[]} listable  rule 1's answer — what a seed may draw from.
     * @param {object[]} all       the SAME listing including hidden records. Rule 6 cannot
     *        run on `listable`: the record it is asked about is the hidden one.
     */
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
                /* A7 — A FAILED REPAIR IS REPORTED, NOT SWALLOWED, and the rail still
                 * shows the healed ids for this session. Publishing the stale ones
                 * because a write failed would put the wrong profile back under the
                 * right name, which is the fault being fixed. The next launch retries. */
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
            /* `autoPopulateFavourites` passes markUserInitialized:false — rule 5 — so the
             * rail is populated and the launch STAYS retryable. `seeded` is the user's
             * flag and an auto-populate never sets it. */
            seeded: false,
        });
    }

    /**
     * ===========================================================================
     * LOADING A PROFILE IS TWO WRITES, AND THE MACHINE GATES NEITHER OF THEM
     * ===========================================================================
     *
     * Ben, 27 August 2026, with the machine disconnected: "now I cannot seem to select a
     * favorite, do I need a machine connected to pick one" — and, in the same breath,
     * "it highlights but if you then click edit profile it will show the previous one".
     *
     * He does not. THE ANSWER HE GAVE IS THE DESIGN: "allow it to work with the machine
     * connected, when the machine does connect we should send it the profile we are on,
     * is that right?" Yes, and ReaPrime already implements the delivery half of it —
     * `lib/src/controllers/workflow_device_sync.dart`, read at the pin on 27 Aug 2026:
     *
     *   - `_onChange` listens to the WorkflowController. Every change to the document
     *     sets `_desiredProfile` and drains it to the DE1.
     *   - `_drain` catches `DeviceNotConnectedException` and logs "DE1 not connected;
     *     skipping profile push". It SKIPS. It does not discard the document and it does
     *     not report a fault.
     *   - `_onInitSettled` is the push-on-connect: when a freshly connected DE1 finishes
     *     initialising it clears `_lastPushedProfile`, RE-READS
     *     `_workflow.currentWorkflow.profile` and drains again — so whatever the document
     *     says at that moment is what the machine is given, whoever wrote it and whenever.
     *   - Any other upload failure retries on a 3 s / 10 s / 30 s ladder and surfaces
     *     `profileUploadFailed` on ReaPrime's own connection-error channel.
     *
     * And the document survives the wait: `main.dart:364` subscribes to the controller and
     * calls `persistenceController.saveWorkflow(...)` on every change, so a profile picked
     * with no machine in the room is still the profile after a restart.
     *
     * MEASURED, NOT ASSUMED: `PUT /api/v1/workflow` answers 200 on a machine with no DE1
     * connected. `_applyUpdate` only touches the device through
     * `De1Controller.updateWorkflowSettings`, and that returns immediately unless the
     * RINSE, STEAM or HOT-WATER blocks changed (`de1_controller.dart:588-595`) — a
     * profile-and-context write changes none of them.
     *
     * WHAT WAS WRONG. This method used to write the document ONLY after a 200 from
     * `POST /machine/profile`, and that route is the one thing that cannot work while
     * disconnected: `withDe1` calls `connectedDe1()`, which throws
     * `DeviceNotConnectedException`, and `de1handler.dart:608` maps it to a 500. So the
     * skin gated the write that works on the write that cannot, the document never moved,
     * `loaded` never moved, the highlight snapped back, and Edit profile — which resolves
     * through the loaded profile — opened the one from before. Exactly what Ben saw.
     *
     * WHAT IS RIGHT. The POST stays, FIRST, and it is still B9's trigger and still the
     * fast path to the machine: it is the only thing that can produce the arm-time
     * refusal, and asking is the only way to find out (see `profile-arm-store.js`,
     * UNCONDITIONAL). What changed is that its ANSWER no longer gates the document.
     *
     * ONE DISTINCTION SURVIVES, AND IT IS THE WHOLE OF THE CARE HERE:
     *
     *   A REFUSAL (a typed 400 with a problem body — a profile the machine understood and
     *   rejected) STILL BLOCKS THE WRITE. The old comment's argument stands word for word:
     *   "the machine cannot run it, and a document naming a profile the machine refused is
     *   the same lie in the other direction." It is also the document every stored shot is
     *   stamped from, so the lie would outlive the session.
     *
     *   ANYTHING ELSE — a 500 because nothing is connected, a timeout, a network failure —
     *   IS NOT AN ANSWER ABOUT THE PROFILE. It is an answer about the transport, and the
     *   user's choice is untouched by it. The document is written, ReaPrime delivers it on
     *   connect, and the highlight is then asserting something true.
     *
     * WHY "NOT REFUSED" AND NOT "500 MEANS TRANSPORT": because the disconnected case IS a
     * 500. `withDe1`'s catch-all turns `DeviceNotConnectedException` into
     * `jsonError` (`de1handler.dart:595-611`), so status alone cannot tell a dead machine
     * from a dead write. The typed 400 is the only shape that carries a statement about
     * the profile, and `profileRefusal()` is the one reader of it.
     *
     * AN ABSENT ANSWER DOES NOT WRITE. `arm.arm()` always publishes a state, so `!armed`
     * is unreachable through the real store — but a caller that injected a stub and got
     * nothing back has told us nothing, and "we do not know" is not a licence to write the
     * document (A7).
     *
     * THE COST IS STILL ONE EXTRA PROFILE UPLOAD ON THE HAPPY PATH, said out loud as it
     * was before: the POST uploads, then `WorkflowDeviceSync` sees the document change and
     * uploads again. The old app avoids it by making the PUT alone — and pays by never
     * seeing the refusal, because the sync catches `ProfileModeUnsupportedException` and
     * parks silently. A second BLE upload on an idle machine costs about a second; a shot
     * that silently is not running the profile you picked is the register's own "worst
     * failure shape".
     */
    async function armRecord(record, recordId) {
        const armed = await arm.arm(record.profile, { profileId: recordId });
        if (!armed || armed.status === ARM_STATUS.REFUSED) return armed;

        /* THE ID, REMEMBERED AT THE MOMENT THE CHOICE BECOMES REAL. It used to be
         * remembered only on a 200, which was the same gate in miniature: with no machine
         * the document names the profile and nothing remembered which RECORD it was, so
         * `readLoaded`'s tie-break had nothing to break a duplicated title with. The
         * memory is only ever consulted while the workflow's title still matches
         * (`rememberedRecord`), so it cannot outlive the document it belongs to. */
        armedId = recordId;
        await saveLoadedProfileId(storage, armedId);

        /* AND THE DOCUMENT, which is what records "this is the profile we are on".
         *
         * `POST /machine/profile` sends the steps to the DE1 and touches nothing else, so
         * on its own it leaves `GET /workflow` serving the PREVIOUS profile — the old
         * title on the Live header, the old dose and drink weight on the rail, and the old
         * name stamped into every shot ReaPrime records from then on. `workflow-store.js`
         * `apply` carries the two-route reading.
         *
         * THE LISTING IS RE-READ because R1's loaded-profile highlight is derived from the
         * workflow, and the five favourite marks are derived from the listing. */
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

        /**
         * Read everything the screen opens with: the listing, the loaded id, the rail.
         *
         * ONE listing read feeds all three — `r1LoadedProfileId` matches against the SAME
         * rows the list shows, and the rail is seeded from the filtered ones. Reading
         * `/profiles` twice for two consumers is how the two get different answers.
         */

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
            /* WHICH RECORDS SOMETHING ELSE HAS SUPERSEDED — one pass over the listing that
             * is already in hand, no request, no hashing. It is read by `hidden` below and
             * nothing else; see the long note there for what it is for and why
             * `restorable` deliberately does not use it. */
            const superseded = supersededIds(listing.all);
            log.info(`profile library: ${listing.listable.length} listable, ${restorable.length} restorable, `
                + `${superseded.size} superseded, `
                + `loaded ${loaded.id ?? `unresolved (${loaded.reason})`}`);

            return patch({
                status: LIBRARY_STATUS.READY,
                records: Object.freeze([...listing.all]),
                listable: Object.freeze([...listing.listable]),
                /**
                 * THE HIDDEN SET, PUBLISHED — Ben, 25 August 2026, on the selector audit's
                 * finding 8: "Add the hidden toggle."
                 *
                 * IT WAS ALREADY BEING COMPUTED and thrown away. `partitionProfiles` splits
                 * the listing three ways and this store kept two of them: `listable` for
                 * the list, and `restorable` (hidden AND bundled) for the restore offer.
                 * The hidden set itself — which includes the user profiles a hide has
                 * soft-deleted, the ones `restorable` deliberately excludes — reached
                 * nobody, so there was no way to browse what the library is holding back.
                 *
                 * BOTH BUCKETS, BECAUSE ONE HIDE PRODUCES EITHER. The contract is explicit:
                 * DELETE /profiles/<id> "sets Visibility.hidden on an isDefault record and
                 * Visibility.deleted on a user one". Two words for one gesture, so a toggle
                 * that showed only `hidden` would show the bundled profiles a user hid and
                 * not the ones they wrote — the half they are most likely to be looking for.
                 *
                 * MINUS THE SUPERSEDED VERSIONS — Ben, 27 August 2026. Since a content save
                 * hides the record it superseded, `hidden` is no longer only "profiles you
                 * put away": it is also every older version of every profile that has ever
                 * been edited. Left in, this toggle would fill with near-duplicates exactly
                 * as the main list used to, and Ben's complaint would have been MOVED
                 * rather than fixed. A superseded version belongs in Previous versions,
                 * where it is one row of one profile's history, and nowhere else.
                 *
                 * THE DISCRIMINATOR COSTS NOTHING AND NEEDS NO NEW FIELD: this listing is
                 * read with `?includeHidden=true`, so every record and every `parentId` is
                 * already in `listing.all`, and a record another record names as its parent
                 * has been superseded. `supersededIds` is that one pass. See
                 * `src/lib/profile-lineage.js` for why the ambiguity between "superseded"
                 * and "removed" is avoided at the source as well as resolved here.
                 *
                 * `restorable` IS DELIBERATELY NOT FILTERED. It is `hidden AND isDefault`,
                 * and the save path never hides an `isDefault` record — so no superseded
                 * version can reach it and its meaning is exactly what it always was.
                 * Filtering it too would be a guard against something that cannot happen,
                 * and would break D6 the day a user hides a bundled profile they had once
                 * derived from: that record has a child, so a superseded-filter would drop
                 * it from the restore offer and the user could never get it back.
                 */
                hidden: Object.freeze(
                    [...listing.hidden, ...listing.deleted]
                        .filter((record) => !superseded.has(profileRecordIdOf(record)))),
                restorable: Object.freeze(restorable),
                loaded,
                /**
                 * THE SELECTOR OPENS ON THE PROFILE THE MACHINE IS HOLDING.
                 *
                 * Ben, 25 August 2026, on the selector audit's finding 1: "Match Slate,
                 * have it load the currently used profile." The audit's own words for the
                 * defect: "Half the screen says nothing on entry, and the profile the
                 * machine is holding is the one answer that is always available."
                 *
                 * SEEDED HERE AND NOT IN THE SCREEN, because the screen would have to wait
                 * for the listing and then guess whether an empty selection is "nothing
                 * chosen yet" or "the user cleared it". The load is the one moment those
                 * two are distinguishable: there has been no chance to choose.
                 *
                 * AND ONLY WHEN NOTHING IS CHOSEN. A reload that happens while the screen
                 * is open — a hide, a restore, an assignment — runs `load()` again, and
                 * putting the loaded profile back under the user's own pick would undo a
                 * choice they made. `?? current` keeps it.
                 *
                 * AN UNRESOLVED LOADED PROFILE LEAVES IT NULL, which is the empty pane the
                 * audit photographed and is the honest answer when the machine's workflow
                 * names nothing this library can find.
                 */
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

        /**
         * REMOVE A PROFILE FOR GOOD — D6's second half, and the one irreversible thing on
         * this screen.
         *
         * Ben, 25 August 2026: "yes build it behind a confirm that says plainly it cannot
         * be undone." The confirm is the SCREEN's; what this owes is the honesty underneath
         * it — one route, no retry, and a re-read that is the answer.
         *
         * A 404 IS SUCCESS, which is `hide`'s rule one method up and for the same reason:
         * a record another client purged while this one held a stale list is the ordinary
         * way to reach this call, and reporting it as a fault would ask the user to do
         * something about a job that is already done.
         *
         * THE SELECTION GOES WITH IT. There is nothing left to name.
         */
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

        /**
         * ARM THE SELECTED PROFILE — the confirm half of the core loop, and B9's trigger.
         *
         * The BARE profile goes to the machine (`profileArmBody`, row gate
         * `shape-asymmetry`), and the arm store owns the route, the body and the reading
         * of the refusal. This is the one line `profile-arm-store.js` named.
         */
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
                /* CLEARED LAST, AFTER THE DOCUMENT AND THE RE-READ. `loaded` now carries
                 * the same id on every path that wrote, so the highlight hands over
                 * without a frame in between; on the refused path it goes back to the
                 * profile the machine is actually holding, which is the truth. */
                patch({ armingId: null });
            }
        },

        /**
         * REMEMBER THE THREE NUMBERS THAT BELONG TO THE LOADED PROFILE.
         *
         * Dose, drink weight and grind are per-profile settings, and the rail writes them
         * to the WORKFLOW, which holds exactly one of each. Without this, changing the
         * dose and then loading a different profile silently discards it, and coming back
         * to the first profile brings back 18 g.
         *
         * A METADATA-ONLY PUT. `_handleUpdate` parses `profile` only
         * `if (json.containsKey('profile'))`, so this write touches no step, does not move
         * the execution hash and therefore does not change the record's id — which is what
         * makes it safe to run on every rail press. The old app's note for the same call:
         * "Metadata-only PUT — the profile (execution) hash is untouched, so the id stays
         * stable; no favorite remap needed" (`profileManager.js:338-339`).
         *
         * MERGED, NOT REPLACED: `metadata` is one map on the record, so the fields this
         * write does not name have to be carried or they are dropped.
         *
         * @param {object} fields  any of `targetDoseWeight`, `targetYield`, `grinderSetting`
         */
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
            /* THE RECORD IS PATCHED IN PLACE, NOT RE-READ. Every other write here ends in
             * `api.load()`, and this one must not: it runs on every press of three rail
             * steppers, and the listing is the whole profile collection — 186 records on
             * the bench machine. A press that costs a full listing read is a rail that
             * stutters under a finger held on +.
             *
             * WHAT IS PATCHED IS EXACTLY WHAT WAS SENT, and the server's own answer is not
             * needed to know it: `_handleUpdate` stores the metadata map as given, and the
             * one field that could come back different — the record id — cannot move,
             * because a metadata-only body leaves the execution hash alone. */
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

        /**
         * D6, first half. Restore a bundled profile to factory.
         *
         * The offer list is `state.restorable`; a record with no bundle filename is not on
         * it and cannot reach this call. After a 200 the listing is re-read, because the
         * record's visibility changed on the server and the transport has already cleared
         * the ETag for `/profiles` (a write invalidates the conditional store), so the
         * re-read is a real 200 rather than a 304 of the pre-restore body.
         */
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

        /**
         * HIDE A PROFILE — the action the whole restore loop was built around and nobody
         * could reach.
         *
         * IT IS CALLED HIDE AND NOT DELETE, and the route's own contract row says why:
         * `DELETE /profiles/<id>` is a SOFT delete. `ProfileController.delete` sets
         * `Visibility.hidden` on a bundled record and `Visibility.deleted` on a user one,
         * and neither removes anything — the only route that removes a record is
         * `deleteProfilesByIdPurge`, which v1 does not call (D6's second half). The old
         * skin's own word for this control is "Hide" (`profile_selector.js:624`).
         *
         * WHAT MADE IT REACHABLE IS THAT EVERYTHING ELSE WAS ALREADY HERE. The listing
         * asks for `?includeHidden=true` and `profile-rules.js` filters visibility on this
         * side; `restorable` is exactly the bundled records that are hidden; and
         * `restoreToFactory` brings one back. So the library could show you what had been
         * hidden and put it back, and could not hide anything — which meant the restore
         * list was empty on any machine where no OTHER client had ever hidden a profile.
         *
         * A 404 IS "ALREADY GONE", NOT A FAULT. `_handleDelete` has an `on ArgumentError`
         * clause, so an id this store no longer knows about answers 404 — which is what a
         * stale listing produces, and the right response to it is the re-read that follows
         * either way.
         *
         * THE ANSWER IS THE RE-READ, NEVER THE 200. The record's visibility changed on the
         * server, and a write clears the conditional store's ETag for `/profiles`, so the
         * reload is a real 200 rather than a 304 of the pre-hide body.
         */
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
            /* THE SELECTION GOES WITH IT. Leaving `selectedId` on a record the listing no
             * longer carries leaves the detail pane naming a profile that is not on the
             * list beside it, and the actions menu offering to edit it. */
            patch({ selectedId: null });
            await api.load();
            return store.get();
        },

        /**
         * ADD A PROFILE FROM A FILE — Ben, 24 August 2026.
         *
         * THE FILE IS READ AND CHECKED BEFORE ANYTHING IS SENT. `readProfileFile` is
         * Slate's own ten-key shape check; what it refuses never reaches the wire, so the
         * person who picked the wrong file is told that rather than shown a 500.
         *
         * IT IS A CREATE AND NOT AN IMPORT. `POST /api/v1/profiles/import` exists and
         * takes an ARRAY OF ProfileRecords — server-shaped rows with ids, hashes and
         * timestamps, which a profile FILE is not. The route for "here is a profile, make
         * a record of it" is `postProfiles`, which is what the editor's own Save-as-new
         * already uses; this is its second caller and it goes through the same body
         * builder, so one sanitiser still owns what leaves.
         *
         * NO parentId. A file is not a version of anything this library holds — giving it
         * one would put an unrelated profile into somebody's lineage.
         */
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

        /**
         * ADD A PROFILE FROM A VISUALIZER SHARE CODE.
         *
         * THROUGH THE PLUGIN, WHICH IS WHERE THE FEATURE LIVES. ReaPrime's own profile
         * routes know nothing about share codes; the Visualizer plugin does, and
         * `POST /api/v1/plugins/<id>/<endpoint>` is the passthrough ReaPrime registers
         * for exactly this (`plugins_handler.dart` `app.all`). Slate calls the same
         * endpoint with the same body (`profile_selector.js handleShareCodeImport`).
         *
         * A 401 IS "NOT SIGNED IN", NOT A FAULT. The plugin answers 401 when the
         * Visualizer credentials are missing and 400 when the code is wrong, and the two
         * need different words in front of a person — Slate shows a whole "login
         * required" modal for the first. Both are REFUSED with a reason here, and the
         * screen picks the sentence.
         *
         * THE PLUGIN UPLOADS THE PROFILE ITSELF, so the answer is the re-read.
         */
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
                /* TWO STATUSES ARE ANSWERS AND THE REST ARE FAULTS. The plugin answers
                 * 401 with no credentials and 400 for a code it could not use
                 * (`plugin.js`: `error.message.includes('credentials') ? 401 : 400`);
                 * everything else — a plugin that is not loaded (404), a permission it
                 * lacks (403), a server that fell over — is a failure, and telling a
                 * person their share code is wrong when the plugin is not even running
                 * sends them to fix the one thing that was fine. */
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

        /**
         * IS THE PROFILE GENERATOR INSTALLED, and where does it live?
         *
         * THE ANSWER IS A URL OR NULL, and null is the whole gate: Slate hides its own
         * link when the plugin is absent or unloaded (`profile_selector.js:1770-1775`),
         * because a link to a plugin that is not there is a dead affordance.
         *
         * THE URL IS ReaPrime'S OWN. Slate learned this the hard way and wrote it down:
         * pointing the link at localhost sends the plugin's "upload to Decent" POST to a
         * DIFFERENT server than the skin lists from, so the profile is created somewhere
         * nobody is looking. The transport knows the base this app is talking to.
         */
        async generatorUrl() {
            const result = await callRoute(transport, 'getPlugins', {});
            if (!result.ok || !Array.isArray(result.data)) return null;
            const plugin = result.data.find((entry) => entry && entry.id === GENERATOR_PLUGIN);
            if (!plugin || plugin.loaded !== true) return null;
            /* THROUGH THE ROUTE TABLE, and the id is the passthrough's. The generator's
             * page is `/plugins/<id>/ui` — the same shape `postPluginsByIdByEndpoint`
             * addresses, with `ui` as the endpoint — so the PATH is the table's to spell.
             * Assembling it from fragments here is what Gate D refuses, and rightly: a
             * hand-built path is a route nobody can find the row for.
             *
             * THE BASE IS THE TRANSPORT'S. Slate learned this one the hard way and wrote
             * it down: a link pointed at localhost sends the plugin's own "upload to
             * Decent" POST to a DIFFERENT server than the skin lists from, so the profile
             * is created somewhere nobody is looking. */
            const path = buildPath(routeById('getPluginsByIdByEndpoint'),
                { id: GENERATOR_PLUGIN, endpoint: 'ui' });
            const base = String(transport.baseUrl ?? '').replace(/\/+$/, '');
            return `${base}${path}?layout=baseline`;
        },

        /**
         * B11 / Q7. The other versions of a profile.
         *
         * `NONE` IS DERIVED FROM THE LIST. The lineage always contains the profile itself,
         * so a one-entry answer means "no other versions" and the menu shows that sentence.
         * Anything that is not a 200 array is a fault, including the 500 a missing id
         * produces — see VERSIONS in the header for why there is no 404 branch.
         */
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

        /** Close the versions surface without forgetting which profile it was about. */
        clearVersions() {
            return patch({ versions: { status: VERSIONS_STATUS.IDLE, id: null, records: Object.freeze([]) } });
        },

        /**
         * Put a profile in a favourite slot — or clear one with `id = null`.
         *
         * Rule 5's default applies: a user-driven save DOES mark the rail
         * user-initialised, so clearing all five is remembered as a choice and the next
         * launch does not re-seed. That is the whole difference between "nobody has chosen
         * yet" and "somebody chose nothing", and it is why this takes the default rather
         * than passing a flag.
         */
        async setFavourite(slot, id) {
            const index = Number(slot);
            if (!Number.isInteger(index) || index < 0 || index >= FAVOURITE_SLOT_COUNT) {
                log.warn(`setFavourite: slot ${slot} is outside 0..${FAVOURITE_SLOT_COUNT - 1}`);
                return store.get();
            }
            /* THE DUPLICATE GUARD. Ben's call, 25 August 2026, on the behaviour audit's
             * "Assigning a profile already on a slot": "Copy Slate."
             *
             * SLATE'S RULE EXACTLY - profileManager.js:619-629. Refuse if the profile is
             * already on ANY slot, THE PRESSED ONE INCLUDED, and its own comment says why
             * the pressed one counts: "Re-assigning to the same button is a no-op, but
             * staying silent there reads as 'nothing happened'." A press that changes
             * nothing and says nothing is indistinguishable from a press that missed.
             *
             * CLEARING IS NOT ASSIGNING, so a null id passes straight through. Slate
             * spells this `if (profileKey)`; the Live rail's slot menu is the caller that
             * depends on it (live-wiring.js:929 and :950 both clear).
             *
             * THE GUARD IS HERE AND NOT ON THE SCREEN because there are three callers -
             * the assign row, the row menu, and the detail pane's mark - and a rule that
             * lives on one of them is a rule the other two do not have. The screen still
             * reads `favouriteSlotHolding` for itself, but only to write the message; the
             * refusal itself cannot be routed around. */
            const held = api.favouriteSlotHolding(id);
            if (held !== null) {
                log.info(`setFavourite: refused — ${id} is already on slot ${held}`);
                return store.get();
            }
            /* THE WRITE IS A WHOLE RAIL, NEVER A SPREAD OF WHATEVER IS IN HAND.
             *
             * This used to be `{...current.assignments, [index]: id ?? null}`, and that
             * spread is a way to lose four slots at once. `current.assignments` is this
             * store's state, and its INITIAL value is `{}` — an empty object, held from
             * construction until the first `load()` resolves. Every caller today happens
             * to be a user gesture on a screen that has already loaded, so the empty map
             * is not reachable in this build; but "not reachable today" is the whole of
             * the guarantee, and what it guarantees is that a `setFavourite` racing or
             * preceding the first load persists a ONE-KEY map and silently deletes the
             * other four slots from storage.
             *
             * `healFavouriteAssignments` normalises to a complete five-slot map as its
             * first act, so routing the write through it makes a short map impossible by
             * construction rather than by call-site discipline. It costs one pass over
             * five slots and it removes a whole class of "a slot was silently cleared".
             *
             * THE RECORDS ARE PASSED TOO, so the same call heals any OTHER slot that has
             * gone stale since the listing was read. The slot being written is immune to
             * that: it is overwritten below with exactly what the caller asked for, after
             * the heal, so a deliberate assignment is never second-guessed by rule 6. */
            const current = store.get().favourites;
            const heal = healFavouriteAssignments(
                current.assignments, store.get().records, { count: FAVOURITE_SLOT_COUNT },
            );
            const { assignments } = heal;
            /* SAY SO WHEN THIS WRITE ALSO REPAIRED SOMETHING. The repair is a side effect
             * of normalising, and a side effect nobody can see is how a rail comes to
             * differ from what the person thinks they set. The slot being assigned is
             * excluded because it is overwritten on the next line — reporting a heal that
             * is about to be discarded would be a claim about a value nothing ever used. */
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

        /**
         * RULE 6 OVER THE RAIL THIS STORE IS HOLDING, ON DEMAND.
         *
         * `readFavourites` already runs this on every `load()`; this is the same rule
         * called at a moment that is NOT a load, and it exists because a save changes
         * visibility without changing the rail. `adoptSavedProfile` re-reads the listing
         * and then calls this, so a slot stranded by the save it just watched is repaired
         * inside the session rather than at the next launch.
         *
         * IT RUNS AGAINST `records`, WHICH INCLUDES HIDDEN ROWS. Rule 6 cannot be asked
         * on `listable`: the record it is asked about is the hidden one, and a visible-only
         * corpus would answer `not-in-corpus` for every slot that actually needs healing —
         * a rule that reports "I cannot see it" for precisely its own subject matter.
         *
         * SILENT WHEN THERE IS NOTHING TO DO. An empty array is the ordinary answer and
         * costs no write and no request; the caller logs per change, so a quiet rail
         * produces no noise.
         *
         * @returns {Promise<Array<object>>} the changes made — `{slot, from, to, basis}`
         *   each, frozen. Empty when the rail was already correct, and empty when the
         *   repair could not be persisted is NOT what happens: the state is published
         *   either way and the failure is logged, because a rail that is right in memory
         *   and stale on disk is still better than one that is stale in both.
         */
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

        /**
         * The 0-based slot already holding `id`, or null.
         *
         * ONE RULE, TWO READERS: `setFavourite` refuses on it, and the selector screen
         * reads it to name the slot in the words it shows. Slate names the slot too -
         * "'<title>' already assigned to favourite <n>" - and a refusal that would not say
         * which slot is the silence its own comment warns about.
         *
         * A NULL OR EMPTY id IS HELD BY NOTHING, which is what makes clearing a slot pass
         * the guard rather than trip over the four other empty ones.
         */
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

        /**
         * The rail as `<ui-favourites-bank>` takes it: five entries, `null` for empty.
         *
         * THE EMPTY SLOT IS THE ORDINARY CASE HERE, not a branch — which is the shape that
         * makes `profileManager.js:450`'s `ReferenceError` (a loop that reads `index` where
         * it declared `i`, aborting the repaint on the FIRST empty slot) unwriteable. The
         * fixture's own rail is 3 filled and 2 null, so the bug's exact input is the
         * ordinary input.
         */
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
