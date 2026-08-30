/**
 * profile-lineage.js — B11: EDITING KEEPS THE OLD VERSION, AND THE EDITOR SAYS SO.
 *
 * Wave 5.5, item `profile-versions`.
 *
 * ---------------------------------------------------------------------------
 * CONSUME, NEVER COMPUTE
 * ---------------------------------------------------------------------------
 *
 * Parent ids and content hashes already exist server-side, so the history is essentially
 * free — that is B11's own wording and it is also the whole design. Every value this module
 * returns was issued by ReaPrime and read off a `ProfileRecord`. Nothing is hashed here,
 * no chain is walked here, and no ancestry is inferred from titles, timestamps or content.
 * The server's chain is `GET /api/v1/profiles/{id}/lineage` and it belongs to
 * `profile-library-store.js versionsOf()`, which the SELECTOR owns (Q7, wave 5.3). This
 * module adds no second caller and no second entry point.
 *
 * ---------------------------------------------------------------------------
 * WHAT "KEPT" ACTUALLY DEPENDS ON — read at the pin, and it is not symmetric
 * ---------------------------------------------------------------------------
 *
 * The two save routes treat the previous version very differently, and the editor cannot
 * say "the old version is kept" without knowing which one it took. Both were read as
 * written at 2b047d02:
 *
 *   POST /api/v1/profiles  with `parentId`
 *     `ProfileController.create` validates the parent exists (400 "Parent profile not
 *     found: <id>" if not), builds a NEW record whose `parentId` is the old id, and stores
 *     it alongside. THE OLD RECORD IS UNTOUCHED. This is the path B11 describes, and the
 *     saved record's own `parentId` is the server saying so.
 *
 *   PUT /api/v1/profiles/{id}  carrying `profile`
 *     `ProfileController.update` recomputes the record's hashes, and when the id changes it
 *     runs `_storage.delete(existing.id)` and then `_storage.store(updated)` — it DELETES
 *     the previous record. Its own log line calls this out: "Profile hash changed … This
 *     creates a new profile. Consider using parentId for versioning." So a content edit
 *     pushed through PUT does NOT keep the old version, whatever the skin says underneath
 *     the button.
 *
 * A metadata-only PUT is the third case and it is the benign one: `copyWith` recomputes the
 * hashes from `profile ?? this.profile`, so a body with no `profile` key hashes to the same
 * id and the record is updated in place. There is no second version because there is no
 * second record, and saying "the old version is kept" would be worse than saying nothing.
 *
 * `versionKeptBy()` therefore answers with WHICH of those happened, sourced from the route
 * the caller took plus two server-issued ids — never from a guess about the content.
 */

/* THE COMPARISON IS `editor-commit.js`'s, NOT A SECOND ONE. That module authors the
 * change-unit rule ("one profile-level field, or one step") and the dirty count the Save
 * band reads; a version list that counted differently from the button would be two answers
 * to one question. Both files are DOM-free leaves and `editor-commit.js` imports nothing,
 * so there is no cycle to create here. */
import { changeGroupsOf } from './editor-commit.js';

/*
 * ---------------------------------------------------------------------------
 * ONE ROW PER PROFILE — Ben, 27 August 2026
 * ---------------------------------------------------------------------------
 *
 * Told that every content save added a near-duplicate row to his profile list, Ben said
 * what he actually wanted:
 *
 *   "the 'Every content save adds a near-duplicate row to your profile list' is not what I
 *    wanted. The idea is to have a history list so I can undo changes etc. After each save
 *    there should still only be one profie, but we should be able to go back to a previous
 *    version"
 *
 * WHAT WAS ALREADY TRUE, and it is nearly all of it. `POST /profiles` with `parentId`
 * writes a real chain; `GET /profiles/{id}/lineage` serves the whole family; the skin's
 * `versionsOf()` reads it and the editor's "Previous versions" dialog lists it. The one
 * missing move was that NOTHING EVER HID THE SUPERSEDED PARENT, so both records stayed
 * `visible` and the list grew by one on every save. That is the whole of Ben's complaint,
 * and `PUT /profiles/{id}/visibility` — a route ReaPrime has always served and this skin
 * had never called — is the whole of the fix.
 *
 * WHY HIDING DOES NOT COST THE HISTORY, which is the fact the design rests on:
 * `ProfileController.getLineage` walks children through `_storage.getByParentId`, and that
 * query filters on `parentId` ALONE — `profile_dao.dart:48-52` at the pin,
 * `(select(profileRecords)..where((p) => p.parentId.equals(parentId))).get()`, with no
 * visibility clause anywhere in it. A hidden version is therefore still in its own
 * lineage. Hiding takes a record off the LIST without taking it out of the HISTORY, which
 * is exactly the distinction Ben drew.
 *
 * ---------------------------------------------------------------------------
 * A SUPERSEDED VERSION AND A REMOVED PROFILE ARE BOTH `hidden`. TELLING THEM APART.
 * ---------------------------------------------------------------------------
 *
 * `hidden` was already spoken for before this work, and by two different meanings:
 *
 *   * `ProfileController.delete` (`profile_controller.dart:247-264`) sets
 *     `Visibility.hidden` on an `isDefault` record and `Visibility.deleted` on a user one.
 *     So a BUNDLED profile the user removed is `hidden`, and D6's restore-to-factory offer
 *     list is exactly `hidden AND isDefault` (`profile-rules.js restorableProfiles`).
 *   * From this change on, a SUPERSEDED VERSION is also `hidden`.
 *
 * THE DISCRIMINATOR IS THE CHILD LINK, AND IT NEEDS NO NEW FIELD AND NO NEW REQUEST: a
 * record that some OTHER record in the same listing names as its `parentId` has been
 * superseded, and one that nothing names has not. The listing the library already reads
 * (`?includeHidden=true`) carries every record and every `parentId`, so the whole answer is
 * one pass over a list that is already in hand. That is `supersededIds()` below.
 *
 * AND THE AMBIGUITY IS ALSO AVOIDED AT THE SOURCE, which is better than resolving it: the
 * save path REFUSES TO HIDE A BUNDLED PARENT (`isDefault === true`). Two reasons, and the
 * second is the one that decided it.
 *
 *   1. A bundled profile is a factory template, not a draft of the user's own. Editing
 *      "Best Practice" and saving DERIVES from it; it does not supersede it. Every app
 *      that has templates keeps the template.
 *   2. Hiding it would put a factory profile into D6's restore-to-factory offer list — a
 *      list that means "profiles you removed" — without the user having removed anything.
 *      The discriminator above could dig it back out, but a design that first creates an
 *      ambiguity and then resolves it is worse than one that never creates it. Because no
 *      bundled record is ever hidden by this path, `restorableProfiles` keeps its old
 *      meaning EXACTLY and needed no change at all.
 *
 * The cost of rule 1, said out loud: the first save of an edited bundled profile leaves TWO
 * rows — the factory one and yours. It never leaves three. Every save after that supersedes
 * a record of the user's own and the count stays at two.
 */

/**
 * WHICH RECORDS SOMETHING ELSE IN THIS LISTING HAS SUPERSEDED.
 *
 * One pass, no requests, no hashing: a record is superseded when another record in the same
 * corpus names it as `parentId`. Order does not matter and neither does visibility — a
 * chain three deep answers with its first two ids whichever way the listing is sorted.
 *
 * A RECORD IS NEVER ITS OWN PARENT in anything ReaPrime writes, but a corpus that claimed
 * so would put an id in this set and the callers would then treat a live tip as superseded.
 * Self-links are dropped for that reason — it costs one comparison and removes a way for a
 * bad row to hide a profile from its owner.
 *
 * @param {Array<object>} records  a profile listing, hidden records included
 * @returns {Set<string>} the ids that have at least one child
 */
export function supersededIds(records) {
    const ids = new Set();
    if (!Array.isArray(records)) return ids;
    for (const record of records) {
        if (!isObject(record)) continue;
        const parentId = str(record.parentId);
        if (parentId && parentId !== str(record.id)) ids.add(parentId);
    }
    return ids;
}

/**
 * WHAT THIS VERSION CHANGED, against the version it came from.
 *
 * Ben asked for "a diff of the new and old and changes recoreded". This is the diff; the
 * recording is the part that is deliberately not done, and `changeGroupsOf`'s own header
 * says why — ReaPrime stores whole records, so a stored delta beside them would be a
 * second copy of one history, free to disagree. Computing it costs one comparison of two
 * profiles the version list is already holding.
 *
 * FACTS, NOT PROSE. D2 puts wording behind `i18n.js`, so this answers in the same register
 * as everything else in this file: a frozen record of what moved, which a surface turns
 * into a sentence. `versionChangeSentenceParts()` in the editor screen is the one that
 * words it, and it is the only place the words live.
 *
 * NO PARENT IS NOT NO CHANGES. The root of a chain has nothing to be compared against, and
 * `known: false` is that answer — A7, and the difference between "this version changed
 * nothing" and "there is nothing to compare it to". A surface prints nothing for it rather
 * than "0 changes", which would be a claim about a comparison that never happened.
 *
 * @param {object|null} record  the newer ProfileRecord
 * @param {object|null} parent  the ProfileRecord it names as `parentId`, if it is in hand
 * @returns {{known:boolean, count:number, scalars:string[], changed:number[],
 *            added:number[], removed:number[], wholesale:boolean}} frozen
 */
export function versionChangeFacts(record, parent) {
    const groups = changeGroupsOf(
        isObject(record) ? record.profile ?? null : null,
        isObject(parent) ? parent.profile ?? null : null,
    );
    return groups;
}

/**
 * The parent of `record`, found in a listing the caller already holds. Null when the
 * record has no parent, or when the parent is not in the corpus that was passed —
 * a lineage read answers with the whole family, but a plain listing need not.
 */
export function parentRecordOf(record, records) {
    const parentId = isObject(record) ? str(record.parentId) : null;
    if (!parentId || !Array.isArray(records)) return null;
    return records.find((candidate) => isObject(candidate) && str(candidate.id) === parentId) ?? null;
}

/** The three save shapes, named so a call site cannot mean one and send another. */
export const SAVE_INTENT = Object.freeze({
    /** POST /profiles with parentId. Keeps the previous record. B11's path. */
    NEW_VERSION: 'new-version',
    /** PUT /profiles/{id} carrying `profile`. Replaces; a hash change DELETES the old. */
    IN_PLACE: 'in-place',
    /** PUT /profiles/{id} with metadata only. Id-stable, no second record. */
    METADATA_ONLY: 'metadata-only',
});

/** What became of the previous version. Every value is evidenced; none is inferred. */
export const VERSION_KEPT = Object.freeze({
    /** The saved record's `parentId` IS the id the editor loaded from. The server linked them. */
    LINKED: 'linked',
    /** The saved id equals the previous id — one record, updated in place. */
    SAME_RECORD: 'same-record',
    /**
     * THE SERVER ALREADY HELD THIS CONTENT, so `create` returned its existing record
     * rather than storing a new one — and that record is now the one on the list.
     *
     * This is what RESTORING AN OLDER VERSION looks like from here, and it is the ordinary
     * outcome of the feature Ben asked for on 27 August 2026, not a corner case: the
     * restore loads an old version's steps into the draft, Save posts content the server
     * already has, and `ProfileController.create` answers with the old record
     * (`profile_controller.dart:200-206` at the pin — it also ignores the `parentId` that
     * was sent, which is exactly how this case is detected).
     *
     * IT IS NOT `NOT_LINKED`, and the difference is what the person is told. `NOT_LINKED`
     * means the previous version was lost; here nothing was lost at all — the previous
     * version is hidden, still in its own lineage, and still one press away in Previous
     * versions. Wording this as a loss would frighten somebody out of using undo.
     */
    RESTORED: 'restored',
    /** The id moved and no parent link came back. On the PUT path the old record was deleted. */
    NOT_LINKED: 'not-linked',
    /** Nothing to compare against, or nothing came back. The editor says it does not know. */
    UNKNOWN: 'unknown',
});

const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' && v ? v : null);

/**
 * B11's raw material, read off one `ProfileRecord`. Ten keys arrive; these are the four
 * that carry version identity, plus the two timestamps that order them.
 *
 * `profileParentIdOf` in `rea-profile.js` reads the same field and is the address-layer's
 * accessor; this returns the whole set as one frozen record so a surface takes one object
 * rather than five calls.
 */
export function lineageFactsOf(record) {
    if (!isObject(record)) {
        return Object.freeze({
            known: false, id: null, parentId: null, hasParent: false,
            metadataHash: null, compoundHash: null, createdAt: null, updatedAt: null,
        });
    }
    const parentId = str(record.parentId);
    return Object.freeze({
        known: true,
        id: str(record.id),
        parentId,
        hasParent: parentId !== null,
        metadataHash: str(record.metadataHash),
        compoundHash: str(record.compoundHash),
        createdAt: record.createdAt ?? null,
        updatedAt: record.updatedAt ?? null,
    });
}

/**
 * WHAT BECAME OF THE PREVIOUS VERSION, after a save.
 *
 * @param {object|null} saved     the `saveReportFrom()` report, or a bare ProfileRecord
 * @param {object} [opts]
 * @param {object|string|null} [opts.previous]  the record (or id) the editor loaded from
 * @param {string|null} [opts.intent]  a `SAVE_INTENT` value — which route was taken
 * @param {string|null} [opts.requestedParentId]  the `parentId` that was actually SENT on
 *   the NEW_VERSION path. It is what separates a create from the idempotent branch: the
 *   server applies it when it stores a new record and ignores it when it hands back one it
 *   already had, so an answer whose `parentId` is not the one we sent is a record the
 *   server did not just create. Absent for the two PUT routes, which send no parent.
 * @returns {object} frozen `{kept, previousId, savedId, parentId, basis}`
 */
export function versionKeptBy(saved, { previous = null, intent = null, requestedParentId = null } = {}) {
    const savedId = isObject(saved) ? str(saved.id) : null;
    const parentId = isObject(saved) ? str(saved.parentId) : null;
    const previousId = typeof previous === 'string'
        ? (previous || null)
        : (isObject(previous) ? str(previous.id) : null);

    const answer = (kept, basis) => Object.freeze({
        kept, previousId, savedId, parentId, intent: intent ?? null, basis,
    });

    if (!savedId || !previousId) {
        return answer(VERSION_KEPT.UNKNOWN,
            'no pair of server-issued ids to compare — the editor says it does not know '
            + 'rather than claiming either way');
    }
    if (parentId && parentId === previousId) {
        return answer(VERSION_KEPT.LINKED,
            'the saved record carries parentId = the id the editor loaded from, so ReaPrime '
            + 'stored the link itself; the previous record is untouched and reachable through '
            + 'GET /profiles/{id}/lineage');
    }
    if (savedId === previousId) {
        return answer(VERSION_KEPT.SAME_RECORD,
            'the id came back unchanged — one record, updated in place. There is no second '
            + 'version to keep, and no lineage entry is created');
    }
    /* THE IDEMPOTENT BRANCH, PROVEN BY THE PARENT LINK THE SERVER DID NOT APPLY.
     *
     * We are past the LINKED test, so `parentId !== previousId`. If a parent WAS sent and
     * it was the record the editor loaded from — which is what `saveAsNewVersion` always
     * sends — then the server has answered with a record that does not carry the link we
     * asked for, and `ProfileController.create` does that in exactly one case: the content
     * was already stored, so it returned the existing record and applied nothing
     * (`profile_controller.dart:200-206`). Restoring an older version is that case.
     *
     * IT IS AN INFERENCE FROM TWO SERVER-ISSUED IDS, which is this module's whole rule. No
     * content is hashed and no id is predicted; we compare what we sent against what came
     * back. */
    if (intent === SAVE_INTENT.NEW_VERSION
        && requestedParentId && requestedParentId === previousId) {
        return answer(VERSION_KEPT.RESTORED,
            'a parentId was sent and the saved record does not carry it, so ReaPrime '
            + 'returned a record it already held rather than storing a new one — the '
            + 'content was already in the history. Nothing was lost: the version the editor '
            + 'was on is still in the lineage, and this older one is now the visible row');
    }
    if (intent === SAVE_INTENT.IN_PLACE) {
        return answer(VERSION_KEPT.NOT_LINKED,
            'the id moved on a PUT carrying `profile`: ProfileController.update deletes the '
            + 'previous record and stores the new one, and logs "Consider using parentId for '
            + 'versioning". The old version is NOT kept on this path');
    }
    return answer(VERSION_KEPT.NOT_LINKED,
        'the id moved and no parentId came back, so nothing links the two records');
}

/**
 * THE SENTENCE'S INPUTS, never the sentence.
 *
 * D2 puts wording behind `i18n.js` and the register puts refusal wording on the server;
 * this returns the facts a surface words. `kept` is the vocabulary above, so a caller
 * switches on a value rather than parsing prose.
 */
export function versionNoteFacts(saved, opts = {}) {
    const kept = versionKeptBy(saved, opts);
    return Object.freeze({
        ...kept,
        /**
         * True only where the editor can honestly say the old version is still there.
         *
         * RESTORED JOINS LINKED HERE, and the test is the same one: is the record the
         * editor was on still reachable? On the restore path it is hidden rather than
         * listed, and hiding takes a record off the LIST without taking it out of the
         * HISTORY — `getLineage` walks children through a query that filters on `parentId`
         * alone (`profile_dao.dart:48-52`). So the version that was just superseded is one
         * press of Previous versions away, which is precisely what this flag claims.
         * NOT_LINKED stays false because there the record really is gone.
         */
        saysOldVersionKept: kept.kept === VERSION_KEPT.LINKED || kept.kept === VERSION_KEPT.RESTORED,
        /** Where the other versions are found. The SELECTOR owns the entry point (Q7). */
        entryPoint: Object.freeze({
            owner: 'selector detail-pane overflow menu (Q7, wave 5.3)',
            route: 'getProfilesByIdLineage',
            store: 'src/stores/profile-library-store.js versionsOf()',
            note: 'the editor states the fact; it does not open a second versions surface',
        }),
    });
}
