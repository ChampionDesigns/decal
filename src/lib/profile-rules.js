// THE FIVE `profileManager.js` RULES — TRANSCRIBED, NOT PORTED.
//
// `CARRY_FORWARD.md` Gate 7, verbatim: "Domain modules — now plain copies. Everything in
// §2 and §3a–§3c, plus the five `profileManager.js` rules transcribed rather than ported:
// (1) filter `visibility === 'deleted' || 'hidden'` from `GET /profiles?includeHidden` …
// (2) the title-prefix stripping ladder … (3) `metadataWriteChain` … (4)
// `FALLBACK_PROFILE_TITLES` and the two-stage fallback … (5)
// `saveAssignments({markUserInitialized})`".
//
// The source is `slate/app/src/modules/profileManager.js` (1,065 lines) — a god module:
// profile CRUD, favourite slots, workflow→UI application and Tailwind class painting in
// one file, importing `ui.js`, `router.js` and `context-menu.js`, with no executing test.
// TRANSCRIBED means the five behaviours arrive; the module does not. What is left behind:
//
//   * THE DOM. Nothing in this file touches a document, and that is what makes every rule
//     below assertable under `node:test` — which is the whole reason the two live bugs
//     lasted as long as they did (`CARRY_FORWARD.md`: "both the kind any executing test
//     would have caught").
//   * MODULE-SCOPE MUTABLE STATE. The source keeps `availableProfiles`,
//     `favoriteAssignments`, `activeProfileId` and `metadataWriteChain` as file globals.
//     Gate 4: "Nothing above this gate may keep module-scope mutable state." The write
//     chain here is created, owned and disposed by its caller.
//   * THE TWO LIVE BUGS, neither of which is a rule:
//       - `updateButtonUI` (`:450`) reads `index` in a loop that declares `i`, so a
//         `ReferenceError` on the FIRST empty favourite slot aborts the repaint and every
//         later slot keeps a stale label. There is no per-slot painting here at all, and
//         `emptyAssignments()` makes the empty slot the ordinary case rather than a branch.
//       - `renameProfile` (`:21`) hands a whole ProfileRecord where a Profile belongs and
//         has 400'd on every call it has ever made. Bodies are built in one place
//         (`rea-profile.js`), and `PUT /profiles/<id>` is reached from here only through
//         `profileUpdateBody`, which cannot express that shape.
//   * THE IDB PROFILE MIRROR (`PROFILES_CACHE_KEY`) — ~70 full records written after
//     every load and five more sites, read only inside an API catch block that cannot
//     happen while ReaPrime serves both the skin and the API from one origin. A7: a
//     fallback path with a long fuse does not come along.
//   * THE DUAL WRITE. Favourites were written to KV *and* IDB in every branch. B7 gives
//     each key one owner; `favouriteProfiles` is a `kv` row in `storage-routes.js` and
//     the router will not write it anywhere else.
//
// WHERE THE SOURCE AND THE TRANSCRIPTION DIFFER, THE TRANSCRIPTION IS THE SPEC. Both were
// read side by side; the three places they part company are marked `TRANSCRIPTION:` below.
//
// EVERY SERVER READ GOES THROUGH THE ADDRESS LAYER and every route through the generated
// client: record fields are read with `rea-profile.js`'s readers, requests are made with
// `callRoute(transport, '<id>')` against `rea-routes.generated.js`, and both routes this
// module addresses — `getProfiles`, `putProfilesById` — are `consumed` rows in
// `CONTRACTS.json` naming this file. `getProfiles` is a conditional route
// (`rea-conditional.js:63`), so `If-None-Match` and the 304-with-stored-body are the
// transport's, not this module's: a 304 arrives here as an ordinary `{ok:true}` result
// carrying `notModified: true`.

import { splitProfileTitle } from './profile-folders.js';
import { callRoute } from '../data/rea-routes.js';
import {
    PROFILE_VISIBILITY,
    isDefaultProfile,
    profileMetadataOf,
    profileRecordIdOf,
    profileTitleOf,
    profileUpdateBody,
    profileVisibilityOf,
} from '../data/rea-profile.js';

/** A caller mistake — a missing id, a transform that cannot be sent. Never a server fault. */
export class ProfileRulesError extends Error {
    constructor(message, detail = null) {
        super(message);
        this.name = 'ProfileRulesError';
        this.detail = detail;
    }
}

const NOOP_LOGGER = Object.freeze({
    debug() {}, info() {}, warn() {}, error() {}, scope() { return NOOP_LOGGER; },
});
const scoped = (logger) => (logger && logger.scope ? logger.scope('profiles') : (logger || NOOP_LOGGER));

/* ======================================================================= rule 1
 * SOFT-DELETED AND HIDDEN PROFILES ARE FILTERED OUT OF LISTINGS.
 *
 * `profileManager.js:135-142`, verbatim:
 *     // DELETE is a soft delete (visibility='deleted'); includeHidden=true
 *     // still returns those records, so drop them or they reappear on reload.
 *     // 'hidden' is a superseded version kept for the editor's revert history
 *     // (see saveProfile) — it must stay out of the visible list too.
 *     if (profileRecord.visibility === 'deleted' || profileRecord.visibility === 'hidden') continue;
 *
 * CHECKED AGAINST THE HANDLER AT THE PIN, which is why the filter is CLIENT-side and the
 * query still asks for everything:
 *
 *   * `ProfileController.delete` (`profile_controller.dart:246-262`) sets
 *     `Visibility.deleted` on a user profile and `Visibility.hidden` on an `isDefault`
 *     one. Nothing is erased; `purge` is the only route that erases, and D6 ships
 *     restore-to-factory WITHOUT the purge half.
 *   * So the records this rule hides are exactly the records restore-to-factory (D6) and
 *     the editor's revert history need. `partitionProfiles` returns them in their own
 *     bucket instead of dropping them on the floor — one read serves both.
 *   * `includeHidden=true` is also the ONLY listing form the recorded fixture set answers
 *     (`tools/mock_rea.py` `_resolve` matches the exact path including query string and
 *     the endpoint fallback is deleted — A7; any other query form is a 503 naming the
 *     path). Asking for one query form and filtering here keeps the mock honest.
 *   * `parentId` is deliberately NOT sent with it: the row's `query-precedence` gate says
 *     `parentId` WINS — the handler then reads all profiles with `includeHidden:true` and
 *     filters, ignoring `visibility` and `includeHidden` entirely.
 *
 * MEASURED on `tools/rea-fixtures/api__v1__profiles~includeHidden=true.json`: 147 records,
 * 78 visible / 69 hidden / 0 deleted. Without this rule the list is 88% longer and every
 * superseded editor draft is in it.
 */

/** The one listing query. See the note above before adding a second. */
export const PROFILE_LISTING_QUERY = Object.freeze({ includeHidden: true });

/** Is this record allowed in a profile listing? */
export function isListable(record) {
    const visibility = profileVisibilityOf(record);
    return visibility !== PROFILE_VISIBILITY.HIDDEN && visibility !== PROFILE_VISIBILITY.DELETED;
}

/**
 * Split a raw listing into the four buckets a screen actually needs.
 *
 * `unknown` exists so a fourth visibility state cannot arrive unnoticed: it is counted
 * and named rather than quietly listed. Its members are still `listable` — the
 * transcription filters two named states, not "everything except visible" — but a caller
 * that finds `unknown.length > 0` is looking at a server this build has not been read
 * against.
 */
export function partitionProfiles(records) {
    const all = Array.isArray(records) ? records.filter(Boolean) : [];
    const listable = [];
    const hidden = [];
    const deleted = [];
    const unknown = [];
    for (const record of all) {
        const visibility = profileVisibilityOf(record);
        if (visibility === PROFILE_VISIBILITY.HIDDEN) hidden.push(record);
        else if (visibility === PROFILE_VISIBILITY.DELETED) deleted.push(record);
        else {
            listable.push(record);
            if (visibility !== PROFILE_VISIBILITY.VISIBLE) unknown.push(record);
        }
    }
    return { all, listable, hidden, deleted, unknown };
}

/** The bundled profiles a restore-to-factory (D6) offers back — hidden AND `isDefault`. */
export function restorableProfiles(records) {
    return partitionProfiles(records).hidden.filter(isDefaultProfile);
}

/**
 * Read the profile listing and partition it.
 *
 * Returns a plain result, never throws on a server fault and never manufactures one: a
 * transport failure comes back as `{ok:false, reason:'transport', failure}` with the
 * envelope intact, and a 200 whose body is not an array as `{ok:false, reason:'shape'}` —
 * an empty list is a real answer and must not be spelled the same way as a broken one.
 *
 * @param {object} transport  `createReaTransport(...)`
 */
export async function readProfileListing(transport, { logger = null } = {}) {
    const log = scoped(logger);
    const result = await callRoute(transport, 'getProfiles', { query: { ...PROFILE_LISTING_QUERY } });
    const empty = { all: [], listable: [], hidden: [], deleted: [], unknown: [] };

    if (!result.ok) {
        log.warn(`profile listing failed: ${result.message}`);
        return { ok: false, reason: 'transport', failure: result, notModified: false, ...empty };
    }
    if (!Array.isArray(result.data)) {
        log.error('profile listing: 200 with a body that is not an array of ProfileRecord');
        return { ok: false, reason: 'shape', failure: null, notModified: false, ...empty };
    }

    const parts = partitionProfiles(result.data);
    if (parts.unknown.length) {
        log.warn(`profile listing: ${parts.unknown.length} record(s) carry a visibility this build has not been read against`);
    }
    log.debug(`profile listing: ${parts.listable.length} listable of ${parts.all.length}${result.notModified ? ' (304)' : ''}`);
    return { ok: true, reason: null, failure: null, notModified: result.notModified === true, ...parts };
}

/* ======================================================================= rule 2
 * THE THREE-STEP TITLE-PREFIX STRIPPING LADDER.
 *
 * `profileManager.js:415-431`. The transcription (`CARRY_FORWARD.md:582-584`): "the
 * title-prefix stripping ladder (`" / "` category delimiter → tail; a 2+ uppercase/digit
 * tag prefix like `GHC/` or `DE1/` but never `A/B testing` or `Light/Medium`; then any
 * remaining `/` → tail — three rules with three worked counterexamples)".
 *
 * WHAT THIS IS FOR. It is the SHORT label — the five favourite slots, where a fixed-width
 * button has to say which profile it holds. It is not the list row: inside a folder the
 * list uses `folderLeaf()`, and outside one it uses the whole title. A profile is never
 * renamed by either.
 *
 * THE LADDER COMPOSES `profile-folders.js` AND DOES NOT RESTATE IT. That module is
 * PORT-AS-IS and already owns the hard half of this question — where a title's family
 * ends and its leaf begins, which characters are delimiters, that both halves have to be
 * real ("Trailing/" and "/Leading" are not a family), and that only the FIRST delimiter
 * splits ("Baseline • Medium Contact • 6 Bar" is one family and one leaf, not a
 * three-level tree). Steps 1 and 3 ask `splitProfileTitle` and read the answer; only step
 * 2's tag-prefix pattern is new, because it is the one rule about a delimiter that is NOT
 * a family marker.
 *
 * TRANSCRIPTION 1 — first delimiter, not last. The source does `.split(' / ').pop()` and
 * `.split('/').pop()`, i.e. the tail after the LAST delimiter. `splitProfileTitle` splits
 * at the first, and says why. MEASURED on the 77 unique fixture titles: 0 carry two
 * slashes, so for `/` the two readings are indistinguishable on the real library — but
 * one title carries two BULLETS, where last-delimiter turns "Baseline • Medium Contact •
 * 6 Bar" into "6 Bar" and first-delimiter into "Medium Contact • 6 Bar". The ported
 * module's rule wins the tie.
 *
 * TRANSCRIPTION 2 — a SPACED delimiter, not the literal " / ". Step 1's job is "the
 * author wrote a category here"; the bullet form arrived with the Baseline set after the
 * old skin stopped being edited, and `profile-folders.js` already treats `•` and `·` as
 * the same convention. Step 1 accepts any single delimiter with whitespace on both sides;
 * on the fixture set this is " / " on 6 titles and " • " on 4.
 *
 * TRANSCRIPTION 3 — step 2 is kept although it changes no outcome, and this is the one
 * place the source contradicts its own comment. Step 2 declines `A/B testing` and
 * `Light/Medium`, and then step 3 takes the tail of both anyway ("B testing", "Medium").
 * Anything step 2 strips, step 3 would also strip. MEASURED: the pattern matches exactly 2
 * of 77 fixture titles (`GHC/manual pressure control`, `GHC/manual flow control`) and both
 * reach the same label either way, so on the real library step 2 has NO unique effect.
 * It is transcribed because the transcription names it, it is exported so its two
 * counterexamples are asserted where they are actually true, and the question of whether
 * step 3 should decline a head that does not name a family is recorded, not decided here.
 */

/** Step 2's pattern: two or more uppercase/digit characters, then a slash. */
export const TAG_PREFIX_PATTERN = /^[A-Z][A-Z0-9]+\s*\/\s*/;

/** i18n key for a profile whose title strips to nothing. The wording is a screen's. */
export const UNTITLED_PROFILE_KEY = 'Untitled';

/**
 * Where `profile-folders.js` puts the boundary, plus which character it used.
 *
 * `splitProfileTitle` answers "is there a family here, and where does it end" — the
 * delimiter set, the first-delimiter rule and the both-halves-must-be-real guard. It does
 * not report WHICH delimiter, and steps 1 and 3 admit different ones, so this recovers it
 * without restating any of the above: both halves are trimmed and `raw` is trimmed, so
 * what lies between them in the original is exactly the delimiter and its whitespace.
 */
function boundaryOf(raw) {
    const { folder, leaf } = splitProfileTitle(raw);
    if (!folder) return null;
    const gap = raw.slice(folder.length, raw.length - leaf.length);
    return { folder, leaf, gap, char: gap.trim() };
}

/**
 * Step 1 — a SPACED delimiter is the author naming a category; keep the tail.
 * Any of the three delimiters counts here: " / " is what the old skin knew, and " • "
 * is the same convention, arriving with the Baseline set after it stopped being edited.
 */
export function stripCategoryPrefix(title) {
    const raw = String(title ?? '').trim();
    const at = boundaryOf(raw);
    return at && /^\s+\S\s+$/.test(at.gap) ? at.leaf : raw;
}

/**
 * Step 2 — a short uppercase tag prefix (`GHC/`, `DE1/`) is a label, not a family.
 * Two or more uppercase/digit characters are required, so `A/B testing` and
 * `Light/Medium` are declined.
 */
export function stripTagPrefix(title) {
    return String(title ?? '').trim().replace(TAG_PREFIX_PATTERN, '');
}

/**
 * Step 3 — "any remaining `/` → tail". A SLASH only, which is the source's own reading
 * and the one that keeps `profile-folders.js` intact: the ladder runs step 1 and then
 * step 3, so a step 3 that admitted bullets would peel "Baseline • Medium Contact • 6 Bar"
 * twice and leave "6 Bar", against that module's stated rule that the second bullet is
 * part of the leaf's own name.
 */
export function stripRemainingDelimiter(title) {
    const raw = String(title ?? '').trim();
    const at = boundaryOf(raw);
    return at && at.char === '/' ? at.leaf : raw;
}

/**
 * The ladder, in order. Returns `''` for a title that strips to nothing — the caller
 * words that with `t(UNTITLED_PROFILE_KEY)`, because a domain module does not hold UI
 * strings (D2: English only in v1, and the mechanism designed in from day one).
 */
export function shortProfileTitle(title) {
    return stripRemainingDelimiter(stripTagPrefix(stripCategoryPrefix(title))).trim();
}

/* ======================================================================= rule 3
 * METADATA WRITES SERIALIZE THROUGH ONE CHAIN.
 *
 * `profileManager.js:306-332`, verbatim: "Serialize metadata read-modify-write so
 * concurrent edits and resets can't clobber each other. Without this, two writers read the
 * same base metadata and the last PUT to resolve wins — silently dropping the other's
 * user-entered values. Each task re-reads metadata inside the chain, after the prior
 * write."
 *
 * THE PREMISE, RE-CHECKED AT THE PIN 2b047d02 RATHER THAN BELIEVED:
 * `ProfileHandler._handleUpdate` reads `json['metadata']` and hands it to
 * `ProfileController.update`, which calls `existing.copyWith(metadata: metadata)`, and
 * `ProfileRecord.copyWith` ends `metadata: metadata ?? this.metadata`. So a supplied map
 * REPLACES the stored one WHOLESALE — there is no server-side merge, and the last writer
 * to resolve wins with whatever base it happened to read. The rule is load-bearing.
 *
 * TWO CONSEQUENCES THE SAME READING GIVES, both enforced below:
 *   * `metadata: null` DOES NOT CLEAR. The Dart `??` falls through to the existing map, so
 *     a null transform result is a silent no-op. The spelling for "clear" is `{}`, and a
 *     transform returning null or undefined is refused here by name.
 *   * A METADATA-ONLY PUT KEEPS THE ID. `copyWith` recomputes the hashes from
 *     `profile ?? this.profile`, so an untouched profile hashes to the same id and no
 *     favourite needs remapping. `profileUpdateBody({metadata})` sends no `profile` key at
 *     all, which `_handleUpdate` only parses `if (json.containsKey('profile'))`.
 *
 * WHAT IS TRANSCRIBED AND WHAT IS NOT: one chain, tasks run in order, each reads the
 * freshest record (the previous task's own 200 response), and the queue survives a
 * failure — the source's `.catch(() => {})` is "keep the queue alive past failures", and a
 * chain that dies on the first rejected write is a worse bug than the one it fixes. What
 * is not transcribed is the FILE-GLOBAL. The source's `let metadataWriteChain` is one queue
 * for the whole app, created at import time and unreachable from a test; this is one queue
 * per instance, created and owned by its caller (Gate 4: nothing above it keeps
 * module-scope mutable state). It is still ONE queue, deliberately — the source's
 * `ponytail:` note reads "single global chain; fine because all writes target the one
 * active profile. Per-id queues only if multiple profiles ever mutate concurrently", and
 * that is a change to make when a screen needs it, not while transcribing. What IS keyed
 * by id is the freshest-record map, so interleaved writes to two different profiles each
 * read their own base rather than the other's response.
 */

/**
 * One serialized metadata writer.
 *
 * @param {object} deps
 * @param {object} deps.transport  `createReaTransport(...)`
 * @param {object} [deps.logger]
 */
export function createMetadataWriteChain({ transport, logger = null } = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new ProfileRulesError('createMetadataWriteChain: a transport must be injected (see createReaTransport)');
    }
    const log = scoped(logger);
    /** id -> the freshest ProfileRecord this chain has seen. */
    const latest = new Map();
    let chain = Promise.resolve();
    let queued = 0;
    let running = 0;
    let maxConcurrent = 0;

    function queue(task) {
        queued += 1;
        // `.then(task, task)` — the next task runs whether or not the previous one
        // settled happily. The source's shape, and the reason a failed write cannot
        // wedge the queue.
        const run = chain.then(task, task);
        chain = run.then(() => { queued -= 1; }, () => { queued -= 1; });
        return run;
    }

    return {
        /** Put any read-modify-write behind the same queue — a reset is not a special case. */
        queue,

        /** How many tasks are still in the queue, for a caller that needs to wait. */
        pending() { return queued; },

        /** Resolves when everything queued SO FAR has settled. Never rejects. */
        settled() { return chain.then(() => undefined, () => undefined); },

        /** The freshest record this chain holds for `id`, or null. */
        latest(id) { return latest.get(id) || null; },

        /**
         * Replace one record's metadata, computed from the freshest metadata there is.
         *
         * @param {object} record     a ProfileRecord — the caller's copy, used only as
         *                            the base if this chain has nothing newer.
         * @param {(metadata: object) => object} transform  receives the current metadata
         *                            (`{}` when the record carries none) and returns the
         *                            WHOLE new map. Spread to add, rebuild to remove.
         * @returns {Promise<object>} the transport result, verbatim.
         */
        mutate(record, transform) {
            const id = profileRecordIdOf(record);
            if (!id) {
                return Promise.reject(new ProfileRulesError(
                    'mutate: the record has no id — a ProfileRecord is required, not a Profile', { record },
                ));
            }
            if (typeof transform !== 'function') {
                return Promise.reject(new ProfileRulesError('mutate: transform must be a function', { id }));
            }
            return queue(async () => {
                running += 1;
                maxConcurrent = Math.max(maxConcurrent, running);
                try {
                    const base = latest.get(id) || record;
                    const next = transform(profileMetadataOf(base) || {});
                    if (!next || typeof next !== 'object' || Array.isArray(next)) {
                        throw new ProfileRulesError(
                            'mutate: transform must return the whole metadata map; `null` does NOT clear it '
                            + '(ProfileRecord.copyWith ends `metadata ?? this.metadata`, so null keeps the stored map) '
                            + '— return {} to clear',
                            { id },
                        );
                    }
                    const result = await callRoute(transport, 'putProfilesById', {
                        params: { id },
                        body: profileUpdateBody({ metadata: next }),
                    });
                    if (result.ok && result.data) latest.set(id, result.data);
                    else if (!result.ok) log.warn(`metadata write failed for ${id}: ${result.message}`);
                    return result;
                } finally {
                    running -= 1;
                }
            });
        },

        /** Test seam: the highest number of tasks ever in flight at once. Must stay 1. */
        peakConcurrency() { return maxConcurrent; },
    };
}

/* ======================================================================= rule 4
 * FALLBACK TITLES, SO FIRST LAUNCH IS NEVER AN EMPTY RAIL.
 *
 * `profileManager.js:864-870` and the two-stage fallback at `:891-932`: named titles by
 * position, and if NONE of them resolved, the first N profiles alphabetically.
 *
 * The five titles are ReaPrime's own bundled profile titles — DATA, matched against the
 * listing, not wording shown to anyone — so they are not translated and not localised.
 *
 * SEEDING RUNS ON THE RULE-1 LISTING, and the fixture says why. Over all 147 records two
 * of the five titles are ambiguous ("Default" ×2, "Gentle and sweet" ×2, both a visible
 * record and a superseded hidden one). Over the 78 LISTABLE records all five resolve to
 * exactly one record each. Seeding the rail from the unfiltered set would have put a
 * superseded editor draft in a favourite slot two times in five.
 *
 * THE FIRST MATCH IS TAKEN, and this is NOT the R1 fallback. R1's title match makes an
 * identity claim about the loaded profile and therefore refuses on ambiguity — duplicate
 * titles yield no id and the reason 'ambiguous', never the first match (`adapters-r.js`).
 * A seed makes no claim: it proposes five starting points a person can change, and
 * refusing one would produce exactly the empty rail this rule exists to prevent. The
 * seeded ids are reported so a caller can say where they came from.
 */

/** The bundled titles the old skin seeds by position (`profileManager.js:864-870`). */
export const FALLBACK_PROFILE_TITLES = Object.freeze([
    'Default',
    'Best practice (light roast)',
    "80's Espresso",
    'Rao Allongé',
    'Gentle and sweet',
]);

/** Five slots — the bank ReaPrime's KV `favorite-profiles` map has always had. */
export const FAVOURITE_SLOT_COUNT = 5;

/** `{0: null, 1: null, …}` — an empty rail, spelled once. */
export function emptyAssignments(count = FAVOURITE_SLOT_COUNT) {
    const assignments = {};
    for (let slot = 0; slot < count; slot += 1) assignments[slot] = null;
    return assignments;
}

/** Is every slot empty? An absent slot counts as empty; a stored `null` is not a value. */
export function isEmptyAssignments(assignments) {
    if (!assignments || typeof assignments !== 'object') return true;
    const values = Object.values(assignments);
    if (values.length === 0) return true;
    return values.every((value) => value === null || value === undefined);
}

/** First record whose title matches, case-insensitively. Listing order decides. */
function findByTitle(records, title) {
    const wanted = String(title).toLowerCase();
    return records.find((record) => (profileTitleOf(record) || '').toLowerCase() === wanted) || null;
}

/**
 * The two-stage fallback.
 *
 * @param {object[]} records  ALREADY filtered by rule 1.
 * @param {object} [options]
 * @param {number} [options.count]
 * @param {(records: object[]) => string[]} [options.rank]  optional first stage — the
 *        history-frequency ranker the old skin ran before the fallbacks. Absent by
 *        default; see the deferred question. Ids it returns that are not in `records` are
 *        ignored, so a stale ranking cannot put a dead id in a slot.
 * @returns {{assignments: object, stage: string, filled: number}}
 */
export function seedFavouriteSlots(records, { count = FAVOURITE_SLOT_COUNT, rank = null } = {}) {
    const listing = Array.isArray(records) ? records.filter(Boolean) : [];
    const assignments = emptyAssignments(count);
    const byId = new Map(listing.map((record) => [profileRecordIdOf(record), record]).filter(([id]) => id));

    if (typeof rank === 'function') {
        const ranked = (rank(listing) || []).filter((id) => byId.has(id));
        for (let slot = 0; slot < count; slot += 1) assignments[slot] = ranked[slot] || null;
        if (!isEmptyAssignments(assignments)) {
            return { assignments, stage: 'ranked', filled: Object.values(assignments).filter(Boolean).length };
        }
    }

    // Stage 1 — the named titles, BY POSITION. A title that does not resolve leaves its
    // own slot empty; it does not shuffle the others up.
    for (let slot = 0; slot < count; slot += 1) {
        const title = FALLBACK_PROFILE_TITLES[slot];
        assignments[slot] = title ? profileRecordIdOf(findByTitle(listing, title)) : null;
    }
    if (!isEmptyAssignments(assignments)) {
        return { assignments, stage: 'named', filled: Object.values(assignments).filter(Boolean).length };
    }

    // Stage 2 — not one named title is on this machine. First N alphabetically, so the
    // rail is populated with something a person recognises rather than nothing.
    const sorted = listing
        .filter((record) => profileTitleOf(record) && profileRecordIdOf(record))
        .sort((a, b) => profileTitleOf(a).localeCompare(profileTitleOf(b)));
    for (let slot = 0; slot < count; slot += 1) assignments[slot] = profileRecordIdOf(sorted[slot]) || null;
    return {
        assignments,
        stage: isEmptyAssignments(assignments) ? 'empty' : 'alphabetical',
        filled: Object.values(assignments).filter(Boolean).length,
    };
}

/* ======================================================================= rule 5
 * AUTO-POPULATE MARKS ITSELF RETRYABLE.
 *
 * `profileManager.js:261-274`, verbatim: "markUserInitialized: when true, persist a flag
 * indicating user has intentionally set assignments (even an all-empty state via clearing
 * slots). init() reads this to decide whether to auto-populate defaults. autoPopulate
 * passes false so a failed first-run populate can retry on the next launch."
 * `autoPopulateFavoritesFromHistory` ends `await saveAssignments({ markUserInitialized: false })`
 * (`:934`); every user-driven save takes the default, `true`.
 *
 * THE FLAG IS THE DIFFERENCE BETWEEN "NOBODY HAS CHOSEN YET" AND "SOMEBODY CHOSE
 * NOTHING", and both look like an empty rail. Without it, a user who clears all five slots
 * gets them re-seeded on the next launch, for ever.
 *
 * TRANSCRIBED WITH ONE ADDITION THE ROUTER MAKES POSSIBLE: the source fires both writes
 * through `Promise.allSettled` and logs each outcome, so the flag lands even when the
 * assignments themselves did not — which marks a launch "user-initialized" on the strength
 * of a write that failed, and is exactly the masquerade the rule is about. `storage.set`
 * resolves `true`/`false` (B7: "on failure writes NOWHERE ELSE"), so the flag is written
 * only after the slots actually persisted. That makes "retryable" mechanical instead of
 * aspirational, and it is why rule 5's test is a failing-then-recovering backend.
 *
 * Both keys are `kv` rows in `storage-routes.js` — `favouriteProfiles` (machine-scoped;
 * the old KV+IDB dual write is gone by construction) and `favouriteProfilesSeeded`. This
 * module never names a physical key or a namespace; the router owns both.
 */

/** Logical storage keys. The router resolves them; nothing here knows where they land. */
export const FAVOURITES_KEY = 'favouriteProfiles';
export const FAVOURITES_SEEDED_KEY = 'favouriteProfilesSeeded';

/** Which record this skin last armed. See `storage-routes.js` for why it is stored. */
export const LOADED_PROFILE_KEY = 'loadedProfileId';

/**
 * REMEMBER WHICH RECORD WAS ARMED.
 *
 * The workflow document carries the profile and not the record id, so after a reload the
 * only route from "what the machine is running" back to "which row in the library that
 * is" is the title — and titles are not unique. This is the fact recorded at the one
 * moment it is known for certain: the moment this skin sent it.
 *
 * @returns {Promise<boolean>} whether it persisted. A failure is not fatal: the title
 *   match is still there behind it, and it is still right whenever the title is unique.
 */
export async function saveLoadedProfileId(storage, id) {
    if (typeof id !== 'string' || id === '') return false;
    return storage.set(LOADED_PROFILE_KEY, id);
}

/** The remembered record id, or null. Never trusted on its own — see `matchesRemembered`. */
export async function loadLoadedProfileId(storage) {
    const held = await storage.get(LOADED_PROFILE_KEY);
    return typeof held === 'string' && held !== '' ? held : null;
}

/**
 * Is the remembered id still the profile the machine is running?
 *
 * THE TITLE IS THE CHECK, and that is deliberate: something else may have loaded a
 * different profile since (another skin, the tablet's own app, a REST call), and then the
 * remembered id names a record the machine is NOT running. Comparing the remembered
 * record's title against the workflow's own title costs nothing and closes that whole
 * class — a stale id can only survive when it names a profile with the same title as the
 * one loaded, which is the case where it does not matter which of them is marked.
 *
 * @param {Array<object>} records  the listing
 * @param {string|null} id         the remembered record id
 * @param {string|null} title      the workflow's own profile title
 * @returns {object|null} the record, or null
 */
export function rememberedRecord(records, id, title) {
    if (!Array.isArray(records) || typeof id !== 'string' || !id) return null;
    if (typeof title !== 'string' || title === '') return null;
    const record = records.find((r) => r && r.id === id) ?? null;
    if (!record || !record.profile || record.profile.title !== title) return null;
    return record;
}

/**
 * Persist the rail, and mark it user-initialised only if that actually worked.
 *
 * @param {object} storage  `createStorageRouter(...)`
 * @param {object} assignments
 * @param {object} [options]
 * @param {boolean} [options.markUserInitialized]  `false` from auto-populate — the whole
 *        of rule 5. A run that does not set the flag is a run that will happen again.
 * @returns {Promise<{ok:boolean, saved:boolean, marked:boolean, retryable:boolean}>}
 */
export async function saveFavouriteAssignments(storage, assignments, {
    markUserInitialized = true, logger = null,
} = {}) {
    const log = scoped(logger);
    const saved = await storage.set(FAVOURITES_KEY, assignments);
    if (!markUserInitialized) {
        // Deliberately unmarked. Not a failure, and not logged as one.
        log.debug('favourites saved without the user-initialised marker — this run stays retryable');
        return { ok: saved, saved, marked: false, retryable: true };
    }
    if (!saved) {
        log.warn('favourites did not persist — NOT marking user-initialised, so the next launch can still seed');
        return { ok: false, saved: false, marked: false, retryable: true };
    }
    const marked = await storage.set(FAVOURITES_SEEDED_KEY, true);
    if (!marked) log.warn('favourites persisted but the user-initialised marker did not');
    return { ok: marked, saved: true, marked, retryable: !marked };
}

/** Read the rail and the marker. Absent is absent — neither is invented. */
export async function loadFavouriteAssignments(storage, { count = FAVOURITE_SLOT_COUNT } = {}) {
    const stored = await storage.get(FAVOURITES_KEY);
    const seeded = await storage.get(FAVOURITES_SEEDED_KEY);
    const usable = stored && typeof stored === 'object' && !Array.isArray(stored);
    return {
        assignments: usable ? stored : emptyAssignments(count),
        stored: usable ? stored : null,
        seeded: seeded === true,
    };
}

/**
 * Should first launch seed the rail? Empty AND never chosen.
 * `profileManager.js:1006-1015` — "If user has previously saved assignments (even
 * all-empty via clearing slots), respect that choice and skip auto-populate."
 */
export function shouldAutoPopulate({ assignments, seeded } = {}) {
    return isEmptyAssignments(assignments) && seeded !== true;
}

/**
 * Seed the rail and save it retryably. Rules 4 and 5, in the order first launch runs them.
 *
 * @returns {Promise<{ran:boolean, stage:string|null, assignments:object, save:object|null, retryable:boolean}>}
 */
export async function autoPopulateFavourites({
    storage, records, count = FAVOURITE_SLOT_COUNT, rank = null, logger = null,
} = {}) {
    const log = scoped(logger);
    const listable = partitionProfiles(records).listable;
    const { assignments, stage, filled } = seedFavouriteSlots(listable, { count, rank });
    if (stage === 'empty') {
        // Nothing to seed FROM — a listing that failed, or a machine with no profiles.
        // Writing an empty rail here would persist "seeded to nothing" and, with the
        // marker deliberately unwritten, buy nothing at all.
        log.warn('auto-populate found no profile to seed from — nothing written, the next launch retries');
        return { ran: false, stage, assignments, save: null, retryable: true };
    }
    log.info(`auto-populating ${filled} favourite slot(s) from the ${stage} fallback`);
    const save = await saveFavouriteAssignments(storage, assignments, {
        markUserInitialized: false, logger,
    });
    return { ran: true, stage, assignments, save, retryable: true };
}

/* ======================================================================= rule 6
 * A FAVOURITE SLOT MUST NEVER POINT AT A RECORD THE LIBRARY IS HIDING.
 *
 * Ben, 28 August 2026, having found his rail wrong on the bench: "You can test adding a
 * new profile there and replacing it with another to ensure it's working and using the
 * latest profile after a change."
 *
 * WHAT WAS MEASURED, on his tablet, 28 August 2026, before any of this was written.
 * `GET /api/v1/store/decal/favouriteProfiles` answered
 * `{0:"profile:fa35f1ee…", 1:"profile:39e38bfa…", 2:"profile:c656d7fe…", 3:null,
 *   4:"profile:0546347d…"}`, and against `GET /api/v1/profiles?includeHidden=true`
 * (221 records, 118 of them hidden) two of the four filled slots named a HIDDEN record:
 *
 *   slot 0  profile:fa35f1ee…  "Extractamundo Dos! (2)"  hidden, and it has NO children
 *   slot 4  profile:0546347d…  "Pressure Tuning"         hidden, and it has 20 descendants
 *
 * Both drew a perfectly ordinary name on the rail. That is the defect this fork exists to
 * remove, in its purest form: a value that makes its own feature invisible. The rail said
 * "Pressure Tuning" and would have armed the version from 10:59 while the library, the
 * editor and the machine were all four hours further on.
 *
 * -----------------------------------------------------------------------
 * WHY A SLOT GOES STALE AT ALL, AND WHY "FOLLOW THE SAVE" WAS NOT ENOUGH
 * -----------------------------------------------------------------------
 * A slot stores a RECORD id and a record id is a content hash, so every content save mints
 * a new one. `settleToOneRow` (`profile-editor-store.js`) then hides the record that was
 * superseded, which is what gives Ben one row per profile. So the ordinary save leaves the
 * slot on a record that has just been taken off the list.
 *
 * `adoptSavedProfile` (`app-boot.js`) already answered the ordinary case on 27 August:
 * find the slot holding `saved.parentId` and move it to the saved id. That rule walks
 * FORWARD — parent to child — and slot 0 is the proof that forward is not the only
 * direction a save moves in.
 *
 * SLOT 0 IS THE BACKWARD CASE, and its timestamps say so exactly. `profile:fa35f1ee…` was
 * created at 20:28:17 and updated at 20:28:48; its PARENT `profile:f239e4b0…` was created
 * five days earlier and updated at 20:28:48 too — the same second. Two visibility flips in
 * one transaction, and they went in the direction nothing expected: the CHILD was hidden
 * and the PARENT was made visible.
 *
 * That is `settleToOneRow`'s restore path, working correctly. `ProfileController.create`
 * is content-addressed and idempotent, so saving content the server already holds returns
 * the EXISTING record rather than storing a new one. Ben edited `fa35f1ee…`, undid the
 * edit, and saved; the content hashed back to `f239e4b0…`, the settle un-hid it and hid
 * `fa35f1ee…`. Everything about that is right.
 *
 * The follow-through could not see it. It asked for the slot holding `saved.parentId` —
 * and `saved` was `f239e4b0…`, whose parent is `79661405…`, the GRANDPARENT. No slot held
 * that. So the slot holding `fa35f1ee…`, the record the very same save had just hidden,
 * was not touched. A rule that only walks down cannot follow a save that goes up.
 *
 * -----------------------------------------------------------------------
 * SO THE RULE IS STATED OVER THE LIBRARY, NOT OVER THE SAVE
 * -----------------------------------------------------------------------
 * "This slot names a hidden record; which living record is that profile now?" needs no
 * knowledge of which save did it, in which direction, or whether a save did it at all —
 * slot 4 predates the follow-through entirely and is stale for no reason but age. One
 * rule, stated over the listing that is already in hand, answers all three and cannot
 * develop a hole of this shape, because it never asks how the record got hidden.
 *
 *   1. The record is VISIBLE — leave it. It is a row its owner can see and point at, and
 *      moving a favourite nobody asked to move is the side effect this file exists to
 *      refuse. This is also what keeps a bundled template safe: `settleToOneRow` refuses
 *      to hide an `isDefault` parent on purpose ("a new profile derived from it, not a
 *      version that replaces it"), so a favourite on the factory "Rao Allongé" stays on
 *      the factory "Rao Allongé" however many profiles are derived from it.
 *
 *   2. The record is HIDDEN and its subtree contains a visible record — take the NEWEST,
 *      by `createdAt`. This is Ben's ruling of 27 August in the general case: "favourite
 *      should show the most recent version". `createdAt` and not `updatedAt` is the
 *      measure, and slot 0 is why: these records are immutable and content-addressed, so
 *      `createdAt` is when a version was BORN, while `updatedAt` moves on a bare
 *      visibility flip. Ranking by `updatedAt` would let a record that was merely re-shown
 *      outrank a genuinely newer version. On Ben's own slot-4 chain the two measures agree
 *      (`profile:e20f7695…` is both the newest born and the most recently touched), so the
 *      repair does not turn on the tie-break — but the rule has to hold on data where they
 *      disagree, and it is written for that.
 *
 *   3. The record is HIDDEN and NOTHING in its subtree is visible — walk UP to the nearest
 *      visible ancestor. This is slot 0: a dead-end hidden leaf whose living row is its
 *      own parent. Without this branch the backward case has no answer at all.
 *
 *   4. Neither exists, or the id is not in the corpus — ANSWER NOTHING, and mean it. A7:
 *      absence is a real answer. A slot naming an id this build cannot resolve is left
 *      exactly as it is and reported, because the alternatives are both worse than a
 *      stale slot: clearing it destroys a choice on the strength of a listing that may
 *      simply have failed, and guessing by title puts an unrelated profile under a name
 *      the owner trusts. `basis` says which of the four branches answered, so a caller
 *      can log the difference between "healed" and "could not".
 *
 * THE WALK IS BREADTH-FIRST OVER A CHILD INDEX BUILT ONCE PER CALL, and it is cycle-safe
 * in both directions. Nothing ReaPrime writes contains a parent cycle, but the corpus is
 * server data and a self-link or a loop in it must not hang the rail on a launch; the
 * `seen` set costs one Set and removes the possibility.
 */

/* A plain object, and not an array. `profile-lineage.js` spells the same guard the same
 * way; this module had never needed one until rule 6 started reading raw record fields
 * (`parentId`, `createdAt`) instead of going through an accessor for every one. */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Read a record's birth stamp as a comparable string. Absent sorts before anything. */
function createdAtOf(record) {
    return isObject(record) && typeof record.createdAt === 'string' ? record.createdAt : '';
}

/** Read a record's last-touched stamp. Only ever a tie-break — see rule 6 branch 2. */
function updatedAtOf(record) {
    return isObject(record) && typeof record.updatedAt === 'string' ? record.updatedAt : '';
}

/** Which branch of rule 6 answered. Reported, never collapsed into a boolean. */
export const FAVOURITE_HEAL_BASIS = Object.freeze({
    /** The slot's record is visible. Nothing to do, and nothing was done. */
    VISIBLE: 'visible',
    /** Hidden, superseded — the newest visible record in its subtree. */
    DESCENDANT: 'descendant',
    /** Hidden dead end — the nearest visible ancestor. The restore/undo shape. */
    ANCESTOR: 'ancestor',
    /** Hidden, and its whole family is hidden too. Left alone. */
    NO_LIVING_RECORD: 'no-living-record',
    /** The id is not in this corpus at all. Left alone — the listing may be partial. */
    NOT_IN_CORPUS: 'not-in-corpus',
});

/**
 * The living record for a favourite slot's id. Rule 6, performed.
 *
 * @param {Array<object>} records  the listing INCLUDING hidden records. A visible-only
 *        listing cannot answer this: the record being asked about is the hidden one.
 * @param {string|null} id  the id a slot is holding
 * @returns {{id: string|null, basis: string, moved: boolean}} frozen. `id` is null only
 *          when nothing living was found, and then `moved` is false and the caller must
 *          leave the slot exactly as it is.
 */
export function livingFavouriteTarget(records, id) {
    const answer = (nextId, basis) => Object.freeze({
        id: nextId,
        basis,
        moved: Boolean(nextId) && nextId !== id,
    });
    if (typeof id !== 'string' || id === '' || !Array.isArray(records)) {
        return answer(null, FAVOURITE_HEAL_BASIS.NOT_IN_CORPUS);
    }

    const byId = new Map();
    const childrenOf = new Map();
    for (const record of records) {
        if (!isObject(record)) continue;
        const recordId = profileRecordIdOf(record);
        if (!recordId) continue;
        byId.set(recordId, record);
        const parentId = typeof record.parentId === 'string' ? record.parentId : null;
        /* A SELF-LINK IS DROPPED HERE for the same reason `supersededIds` drops it: a row
         * that names itself as its own parent would otherwise make a one-record cycle and
         * put a live tip in its own subtree. */
        if (!parentId || parentId === recordId) continue;
        const siblings = childrenOf.get(parentId);
        if (siblings) siblings.push(recordId);
        else childrenOf.set(parentId, [recordId]);
    }

    const held = byId.get(id) ?? null;
    if (!held) return answer(null, FAVOURITE_HEAL_BASIS.NOT_IN_CORPUS);
    /* RULE 1 DECIDES WHAT "LIVING" MEANS, and it is asked rather than re-stated. This was
     * once `profileVisibilityOf(...) !== HIDDEN`, which is rule 1 with one of its two
     * clauses missing: a SOFT-DELETED record (`visibility: 'deleted'`) is not hidden, so
     * that test called it living and would both leave a slot sitting on a deleted record
     * and heal other slots ONTO one. `isListable` is the same predicate the listing
     * filters by, so a slot can only ever name a record the library would actually show,
     * and a fourth visibility state moves both together instead of only one. */
    if (isListable(held)) return answer(id, FAVOURITE_HEAL_BASIS.VISIBLE);

    /* Branch 2 — the newest listable record anywhere below it.
     *
     * THE ORDER IS TOTAL AND DETERMINISTIC, three keys deep, because the answer is
     * PERSISTED: two launches reading the same corpus must heal a slot to the same record
     * or the rail rewrites itself for ever. `createdAt` is the version's birth and decides
     * (see rule 6 branch 2); `updatedAt` breaks a tie; the id breaks a tie in that, which
     * can only happen for two records stamped in the same instant and is there so the
     * comparison never depends on listing order. */
    const newer = (a, b) => {
        if (b === null) return true;
        const ra = byId.get(a);
        const rb = byId.get(b);
        if (createdAtOf(ra) !== createdAtOf(rb)) return createdAtOf(ra) > createdAtOf(rb);
        if (updatedAtOf(ra) !== updatedAtOf(rb)) return updatedAtOf(ra) > updatedAtOf(rb);
        return a > b;
    };

    const seen = new Set([id]);
    const queue = [...(childrenOf.get(id) ?? [])];
    let best = null;
    while (queue.length > 0) {
        const nextId = queue.shift();
        if (seen.has(nextId)) continue;
        seen.add(nextId);
        const record = byId.get(nextId);
        if (!record) continue;
        if (isListable(record) && newer(nextId, best)) best = nextId;
        for (const child of childrenOf.get(nextId) ?? []) queue.push(child);
    }
    if (best !== null) return answer(best, FAVOURITE_HEAL_BASIS.DESCENDANT);

    // Branch 3 — the nearest listable ancestor.
    const walked = new Set([id]);
    let cursor = typeof held.parentId === 'string' ? held.parentId : null;
    while (cursor && !walked.has(cursor)) {
        walked.add(cursor);
        const record = byId.get(cursor);
        if (!record) break;
        if (isListable(record)) return answer(cursor, FAVOURITE_HEAL_BASIS.ANCESTOR);
        cursor = typeof record.parentId === 'string' ? record.parentId : null;
    }

    // Branch 4 — nothing living. Say so; change nothing.
    return answer(null, FAVOURITE_HEAL_BASIS.NO_LIVING_RECORD);
}

/**
 * Rule 6 over a whole rail.
 *
 * ALWAYS RETURNS A COMPLETE FIVE-SLOT MAP, whatever shape went in. That is not tidiness:
 * a partial map is how the rail loses a slot. `setFavourite` writes
 * `{...current.assignments, [index]: id}`, so if `current.assignments` is ever short of a
 * key — the store's own initial state is `{}` until the first `load()` resolves — the
 * write that follows persists a map with THAT MANY KEYS and every absent slot is gone
 * from storage. Normalising here and in `setFavourite` closes it at both ends.
 *
 * TWO SLOTS CAN HEAL TO THE SAME RECORD, AND THAT IS ALLOWED. If somebody put version 1
 * of a profile on slot 0 and version 3 of it on slot 2 — legal at the time, because
 * `setFavourite`'s duplicate guard compares IDS and those were two different ids — then
 * once both are superseded they both resolve to the same living record and the rail shows
 * one profile twice.
 *
 * Nothing here breaks the tie, and refusing to would cost a slot. The only ways to avoid
 * the duplicate are to clear one of the two, or to leave one pointing at a hidden record;
 * the first destroys a choice its owner made and the second is the fault this rule exists
 * to remove. A duplicate is also the honest reading of Ben's own ruling — "a favourite
 * means THIS PROFILE, not this version of it" — because under that rule the two slots
 * really do now mean the same thing. It is visible, it is harmless, and one press fixes
 * it. `setFavourite`'s guard still stops anyone creating the state by hand.
 *
 * @param {object} assignments  `{0..4: id|null}`, or anything at all
 * @param {Array<object>} records  the listing INCLUDING hidden records
 * @param {object} [options]
 * @param {number} [options.count]
 * @returns {{assignments: object, changes: Array<object>, healed: boolean}}
 */
export function healFavouriteAssignments(assignments, records, { count = FAVOURITE_SLOT_COUNT } = {}) {
    const next = emptyAssignments(count);
    const changes = [];
    const held = isObject(assignments) ? assignments : {};
    for (let slot = 0; slot < count; slot += 1) {
        const id = typeof held[slot] === 'string' && held[slot] !== '' ? held[slot] : null;
        if (id === null) {
            next[slot] = null;
            continue;
        }
        const target = livingFavouriteTarget(records, id);
        /* NOTHING LIVING FOUND MEANS THE SLOT IS LEFT AS IT WAS — branch 4. The id rides
         * through unchanged so a listing that failed, or a record this build has not seen,
         * costs the user nothing. */
        next[slot] = target.moved ? target.id : id;
        if (target.moved) changes.push(Object.freeze({ slot, from: id, to: target.id, basis: target.basis }));
    }
    return { assignments: next, changes: Object.freeze(changes), healed: changes.length > 0 };
}
