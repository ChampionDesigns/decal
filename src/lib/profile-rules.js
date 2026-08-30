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

/** The one listing query. See the note above before adding a second. */
export const PROFILE_LISTING_QUERY = Object.freeze({ includeHidden: true });

/** Is this record allowed in a profile listing? */
export function isListable(record) {
    const visibility = profileVisibilityOf(record);
    return visibility !== PROFILE_VISIBILITY.HIDDEN && visibility !== PROFILE_VISIBILITY.DELETED;
}

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

/** Step 2's pattern: two or more uppercase/digit characters, then a slash. */
export const TAG_PREFIX_PATTERN = /^[A-Z][A-Z0-9]+\s*\/\s*/;

/** i18n key for a profile whose title strips to nothing. The wording is a screen's. */
export const UNTITLED_PROFILE_KEY = 'Untitled';

function boundaryOf(raw) {
    const { folder, leaf } = splitProfileTitle(raw);
    if (!folder) return null;
    const gap = raw.slice(folder.length, raw.length - leaf.length);
    return { folder, leaf, gap, char: gap.trim() };
}

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

export function stripRemainingDelimiter(title) {
    const raw = String(title ?? '').trim();
    const at = boundaryOf(raw);
    return at && at.char === '/' ? at.leaf : raw;
}

export function shortProfileTitle(title) {
    return stripRemainingDelimiter(stripTagPrefix(stripCategoryPrefix(title))).trim();
}

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

/** Logical storage keys. The router resolves them; nothing here knows where they land. */
export const FAVOURITES_KEY = 'favouriteProfiles';
export const FAVOURITES_SEEDED_KEY = 'favouriteProfilesSeeded';

/** Which record this skin last armed. See `storage-routes.js` for why it is stored. */
export const LOADED_PROFILE_KEY = 'loadedProfileId';

export async function saveLoadedProfileId(storage, id) {
    if (typeof id !== 'string' || id === '') return false;
    return storage.set(LOADED_PROFILE_KEY, id);
}

/** The remembered record id, or null. Never trusted on its own — see `matchesRemembered`. */
export async function loadLoadedProfileId(storage) {
    const held = await storage.get(LOADED_PROFILE_KEY);
    return typeof held === 'string' && held !== '' ? held : null;
}

export function rememberedRecord(records, id, title) {
    if (!Array.isArray(records) || typeof id !== 'string' || !id) return null;
    if (typeof title !== 'string' || title === '') return null;
    const record = records.find((r) => r && r.id === id) ?? null;
    if (!record || !record.profile || record.profile.title !== title) return null;
    return record;
}

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
    DESCENDANT: 'descendant',
    /** Hidden dead end — the nearest visible ancestor. The restore/undo shape. */
    ANCESTOR: 'ancestor',
    /** Hidden, and its whole family is hidden too. Left alone. */
    NO_LIVING_RECORD: 'no-living-record',
    /** The id is not in this corpus at all. Left alone — the listing may be partial. */
    NOT_IN_CORPUS: 'not-in-corpus',
});

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
        if (!parentId || parentId === recordId) continue;
        const siblings = childrenOf.get(parentId);
        if (siblings) siblings.push(recordId);
        else childrenOf.set(parentId, [recordId]);
    }

    const held = byId.get(id) ?? null;
    if (!held) return answer(null, FAVOURITE_HEAL_BASIS.NOT_IN_CORPUS);
    if (isListable(held)) return answer(id, FAVOURITE_HEAL_BASIS.VISIBLE);

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
        next[slot] = target.moved ? target.id : id;
        if (target.moved) changes.push(Object.freeze({ slot, from: id, to: target.id, basis: target.basis }));
    }
    return { assignments: next, changes: Object.freeze(changes), healed: changes.length > 0 };
}
