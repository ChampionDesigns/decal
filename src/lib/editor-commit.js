/**
 * editor-commit.js — SAVE, THEN REPORT WHAT HAPPENED (B10 / R8), and the count D11 asks
 * this screen for.
 *
 * Wave 5.5, item `save-semantics`.
 *
 * ---------------------------------------------------------------------------
 * THE GUESS DIES. THE DIRTY STATE SURVIVES.
 * ---------------------------------------------------------------------------
 *
 * The old editor duplicated ReaPrime's hashing rules to predict, BEFORE saving, whether a
 * save would be a content change or a label change (`profile_editor.js:3267`, `:3330`,
 * `profileManager.js:116`). The authoritative rules live server-side in
 * `profile_hash.dart`, so the duplicate could only ever be right by luck and wrong in
 * silence. B10 removes the prediction entirely: this module hashes NOTHING, compares no
 * content against any hash, and contains no transcription of `profile_hash.dart`. It reads
 * the record the server sent back and says what the record says.
 *
 * What survives is the DIRTY STATE, and it survives with its rule intact: when the answer
 * cannot be told, the screen is CLEAN. A false-dirty Save is worse than no dirty state —
 * it teaches a person that the button lies, and then the one time it matters they do not
 * press it. `changeCountOf()` returns `tell: 'cannot-tell'` with `count: 0` for every input
 * it cannot compare, and the caller does not have to remember which way to round.
 *
 * ---------------------------------------------------------------------------
 * D11 — THIS SCREEN SUPPLIES A COUNT AND NOT A WORD
 * ---------------------------------------------------------------------------
 *
 * `commit-state.js`'s `primaryLabel` is gone and the deletion already shipped:
 * `ui-page-header.js:279` — "A count, and nothing else, crosses the boundary." The header
 * owns the wording (count > 0 -> Cancel + "Save (N)" with the primary filled; count = 0 ->
 * Cancel + "Save", neither filled — the clean state changed on 25 August 2026, on Ben's
 * ruling that both committing screens carry the pair at every count).
 * `headerCommitFor()` below returns exactly the two props that component declares and no
 * string. A save-outcome sentence authored in this screen is the defect.
 *
 * ---------------------------------------------------------------------------
 * R8 DROPS IN AT ONE FUNCTION
 * ---------------------------------------------------------------------------
 *
 * `ProfileRecord` at the pin 2b047d02 carries exactly ten keys — id, profile, metadataHash,
 * compoundHash, parentId, visibility, isDefault, createdAt, updatedAt, metadata — and NONE
 * of them says what the save did. That absence is R8, and it is reported as an absence:
 * `outcome: null` with `outcomeSource: 'absent'`. The reader is INJECTED
 * (`saveReportFrom(record, {readOutcome})`), so when R8 serves the field the day's work is
 * one reader function and the reporting shape, the store, the screen and every test around
 * them are untouched. There is no second code path to write and none to delete.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS MODULE REFUSES TO SAY, AND WHY EACH REFUSAL IS LOAD-BEARING
 * ---------------------------------------------------------------------------
 *
 *  * "Created."  A 201 does not mean created. `ProfileController.create` computes the
 *    content hash, looks it up, and RETURNS THE EXISTING RECORD when it is already stored
 *    (`profile_controller.dart`, the `if (existing != null) return existing;` branch), and
 *    `_handleCreate` answers `jsonCreated` either way. So `stored` is `null` — unknowable
 *    from this response — rather than `true` read off a status code that does not mean it.
 *
 *  * "The content changed" / "the label changed."  Both hashes come back on every record
 *    and comparing two SERVER-ISSUED strings for equality is an observation, not a
 *    prediction — but naming WHICH fields each hash covers is `profile_hash.dart`'s rule,
 *    and transcribing it here is precisely what B10 kills. So `identity` and `metadata`
 *    report `{before, after, same}` and stop. The interpretation is R8's to serve.
 *
 *  * "Nothing changed."  See above. An unchanged id after a POST can mean the content was
 *    identical OR that only the title moved (the title is not in the id's input set) — two
 *    different things this module cannot tell apart without the rule it must not hold.
 *
 * DOM-free, framework-free, pure. No transport, no clock of its own.
 */

/** Where an outcome statement came from. There is no third source. */
export const OUTCOME_SOURCE = Object.freeze({
    /** The server said it. Only reachable once R8 lands and a reader is injected. */
    SERVER: 'server',
    /** The server did not say. The R8 gap, reported as itself. */
    ABSENT: 'absent',
});

/** How much a dirty-state answer is worth. */
export const CHANGE_TELL = Object.freeze({
    /** Draft and baseline were both readable and were compared field by field. */
    COMPARED: 'compared',
    /** They were not comparable. The count is 0 and the screen is CLEAN — the surviving rule. */
    CANNOT_TELL: 'cannot-tell',
});

/**
 * The ten keys `ProfileRecord.toJson` emits at the pin, in the generated client's order.
 * Stated once so the report and its test read the same list, and so R8's eleventh key is a
 * visible addition rather than a silent one.
 */
export const PROFILE_RECORD_KEYS = Object.freeze([
    'id', 'profile', 'metadataHash', 'compoundHash', 'parentId',
    'visibility', 'isDefault', 'createdAt', 'updatedAt', 'metadata',
]);

/**
 * The profile-level keys the editor can change. Compared as scalars; `steps` is compared
 * as a list below. These are the DE1 v2 shape's own keys, as they arrive on
 * `record.profile` — not a re-spelling.
 */
const PROFILE_SCALAR_KEYS = Object.freeze([
    'title', 'notes', 'author', 'beverage_type', 'version',
    'target_volume', 'target_weight', 'target_volume_count_start', 'tank_temperature',
]);

const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/**
 * Deep structural equality over JSON-ish values. Used ONLY to count what a person changed
 * in the draft in front of them; it is never applied to a hash and never stands in for one.
 */
function sameValue(a, b) {
    if (a === b) return true;
    if (a === null || b === null || a === undefined || b === undefined) {
        return (a ?? null) === (b ?? null);
    }
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        return a.every((item, i) => sameValue(item, b[i]));
    }
    if (typeof a === 'object' || typeof b === 'object') {
        if (!isObject(a) || !isObject(b)) return false;
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const key of keys) if (!sameValue(a[key], b[key])) return false;
        return true;
    }
    return false;
}

/**
 * HOW MANY UNSAVED CHANGES, for the shared header's "Save (N)".
 *
 * THE UNIT IS A THING A PERSON DID: one profile-level field, or one step. A step whose
 * pressure and limiter both moved is ONE change, because it is one step the user was
 * working on — counting three would make the number grow while the work stood still, and
 * the number's only job is to say how much is unsaved.
 *
 * @param {object|null} draft     the profile being edited (DE1 v2 shape)
 * @param {object|null} baseline  the profile as the server last served it
 * @returns {{count:number, clean:boolean, tell:string, fields:string[]}} frozen
 */
export function changeCountOf(draft, baseline) {
    const groups = changeGroupsOf(draft, baseline);
    if (!groups.known) {
        // CANNOT TELL -> CLEAN. The rule that survives B10, applied at its one site.
        return Object.freeze({
            count: 0, clean: true, tell: CHANGE_TELL.CANNOT_TELL, fields: Object.freeze([]),
        });
    }

    const fields = fieldNamesOf(groups);
    return Object.freeze({
        count: fields.length,
        clean: fields.length === 0,
        tell: CHANGE_TELL.COMPARED,
        fields: Object.freeze(fields),
    });
}

/**
 * THE SAME COMPARISON, STILL IN ITS PARTS — and the reason this function exists.
 *
 * Ben, 27 August 2026, asking for a version history: "I fill the best would be a diff of
 * the new and old and changes recoreded not full profiles and we can walk back like GitHub
 * does it I assume."
 *
 * A DIFF IS THE RIGHT THING TO SHOW AND THE WRONG THING TO STORE, which is the one place
 * this build parts company with the shape Ben floated. ReaPrime stores whole records and
 * owns that model — `ProfileRecord` carries the profile, the hashes and `parentId`
 * (`profile_record.dart:34-56` at the pin) — so a skin that stored deltas beside it would
 * be a second, disagreeing copy of the same history, and the B10 defect in a new costume.
 * The version list therefore COMPUTES its diff, every time, from two records the server
 * already served. Nothing new is persisted for it and nothing can go stale.
 *
 * WHY THE GROUPS ARE BUILT HERE AND NOT PARSED BACK OUT OF `fields`. `changeCountOf`'s
 * `fields` is a flat list of display-ready names — 'title', 'steps[0]', 'steps[3] added' —
 * and a caller that wanted the step NUMBERS back would have to re-parse a format authored
 * in this file, from another file, with a regex. The producer of a format owns its parse:
 * one traversal answers both shapes, `changeCountOf` derives its `fields` from these
 * groups, and the two therefore cannot drift apart. The `fields` spelling and its ORDER
 * are unchanged by the refactor and `editor-save-semantics.test.mjs` pins them.
 *
 * THE UNIT IS THE SAME UNIT: one profile-level field, or one step. See `changeCountOf`.
 *
 * @param {object|null} draft     the newer profile (DE1 v2 shape)
 * @param {object|null} baseline  the older profile
 * @returns {{known:boolean, scalars:string[], changed:number[], added:number[],
 *            removed:number[], wholesale:boolean, count:number}} frozen
 */
export function changeGroupsOf(draft, baseline) {
    const empty = {
        known: false,
        scalars: Object.freeze([]),
        changed: Object.freeze([]),
        added: Object.freeze([]),
        removed: Object.freeze([]),
        wholesale: false,
        count: 0,
    };
    if (!isObject(draft) || !isObject(baseline)) return Object.freeze(empty);

    const scalars = [];
    for (const key of PROFILE_SCALAR_KEYS) {
        if (!sameValue(draft[key], baseline[key])) scalars.push(key);
    }

    const changed = [];
    const added = [];
    const removed = [];
    let wholesale = false;

    const a = Array.isArray(draft.steps) ? draft.steps : null;
    const b = Array.isArray(baseline.steps) ? baseline.steps : null;
    if (a === null || b === null) {
        /* ONE SIDE HAS NO STEP LIST AT ALL. There are no indexes to name, so the step
         * change is reported WHOLESALE — `changeCountOf` spells it as the bare field
         * 'steps' and has since it was written. It is one change, not a count of steps
         * nobody can enumerate. */
        if (a !== b) wholesale = true;
    } else {
        const shared = Math.min(a.length, b.length);
        for (let i = 0; i < shared; i += 1) {
            if (!sameValue(a[i], b[i])) changed.push(i);
        }
        for (let i = shared; i < a.length; i += 1) added.push(i);
        for (let i = shared; i < b.length; i += 1) removed.push(i);
    }

    const count = scalars.length + changed.length + added.length + removed.length
        + (wholesale ? 1 : 0);

    return Object.freeze({
        known: true,
        scalars: Object.freeze(scalars),
        changed: Object.freeze(changed),
        added: Object.freeze(added),
        removed: Object.freeze(removed),
        wholesale,
        count,
    });
}

/**
 * The groups, spelled the way `changeCountOf` has always spelled them, IN THE SAME ORDER:
 * scalars in `PROFILE_SCALAR_KEYS` order, then changed steps by index, then added, then
 * removed. Kept as one function so the order lives in one place rather than in two loops
 * that have to be remembered to match.
 */
function fieldNamesOf(groups) {
    const fields = [...groups.scalars];
    if (groups.wholesale) fields.push('steps');
    for (const i of groups.changed) fields.push(`steps[${i}]`);
    for (const i of groups.added) fields.push(`steps[${i}] added`);
    for (const i of groups.removed) fields.push(`steps[${i}] removed`);
    return fields;
}

/**
 * The two props `<ui-page-header>` declares, and nothing else. No label, no verb, no
 * punctuation — D11 gives the wording to the component and `ui-page-header.js:279` says
 * only a count crosses the boundary.
 *
 * @param {{count:number}|number} change  a `changeCountOf` answer, or a bare count
 */
export function headerCommitFor(change) {
    const count = typeof change === 'number' ? change : (change && change.count) || 0;
    const n = Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
    return Object.freeze({ commit: n > 0, changeCount: n });
}

/**
 * There is no outcome field on `ProfileRecord` at the pin. This is the default reader and
 * it says so by returning null — the single seam R8 replaces.
 */
export const NO_SERVER_OUTCOME = () => null;

/**
 * READ THE SAVE RESPONSE OUT. Report, never predict.
 *
 * @param {object|null} record  the ProfileRecord the server returned (201 from
 *   `postProfiles`, 200 from `putProfilesById`) — the body, verbatim
 * @param {object} [opts]
 * @param {string|null} [opts.route]    the generated route id the call went through
 * @param {number|null} [opts.status]   the HTTP status, recorded rather than interpreted
 * @param {object|null} [opts.before]   the record the editor was working from, so the two
 *   server-issued ids can be compared for EQUALITY. Nothing is computed from either.
 * @param {(record:object)=>(object|null)} [opts.readOutcome]  R8's seam. Given a record,
 *   return the server's own outcome statement, or null. Default: `NO_SERVER_OUTCOME`.
 * @returns {object} frozen report
 */
export function saveReportFrom(record, {
    route = null, status = null, before = null, readOutcome = NO_SERVER_OUTCOME,
} = {}) {
    if (!isObject(record)) {
        return Object.freeze({
            recorded: false,
            route,
            status,
            reason: 'the save response carried no ProfileRecord',
            outcome: null,
            outcomeSource: OUTCOME_SOURCE.ABSENT,
        });
    }

    const served = typeof readOutcome === 'function' ? readOutcome(record) : null;
    const beforeId = isObject(before) && typeof before.id === 'string' ? before.id : null;
    const beforeMeta = isObject(before) && typeof before.metadataHash === 'string'
        ? before.metadataHash : null;
    const afterId = typeof record.id === 'string' ? record.id : null;
    const afterMeta = typeof record.metadataHash === 'string' ? record.metadataHash : null;

    return Object.freeze({
        recorded: true,
        route,
        status,

        /* THE RECORD, READ OUT. Every value here is the server's own. */
        id: afterId,
        parentId: typeof record.parentId === 'string' && record.parentId ? record.parentId : null,
        metadataHash: afterMeta,
        compoundHash: typeof record.compoundHash === 'string' ? record.compoundHash : null,
        visibility: typeof record.visibility === 'string' ? record.visibility : null,
        isDefault: record.isDefault === true,
        createdAt: record.createdAt ?? null,
        updatedAt: record.updatedAt ?? null,
        title: isObject(record.profile) && typeof record.profile.title === 'string'
            ? record.profile.title : null,

        /* TWO SERVER-ISSUED STRINGS, COMPARED FOR EQUALITY. `same` is null when there was
         * nothing to compare against — an absent answer, not a false one. What each hash
         * covers is profile_hash.dart's rule and is deliberately not named here. */
        identity: Object.freeze({
            before: beforeId, after: afterId,
            same: beforeId && afterId ? beforeId === afterId : null,
        }),
        metadata: Object.freeze({
            before: beforeMeta, after: afterMeta,
            same: beforeMeta && afterMeta ? beforeMeta === afterMeta : null,
        }),

        /* UNKNOWABLE FROM THIS RESPONSE. A 201 is answered whether the record was stored
         * or was already there — see the header. */
        stored: null,

        /* R8. `outcome` is whatever the SERVER said; today nothing says anything. */
        outcome: served ?? null,
        outcomeSource: served ? OUTCOME_SOURCE.SERVER : OUTCOME_SOURCE.ABSENT,
    });
}

/**
 * The same shape for a failure, so a caller renders one object either way and never has to
 * ask which branch it is in. A typed 400 arrives as `refusal` (read by
 * `profileRefusal()` in `rea-profile.js`, which owns that reading and its wording); every
 * other fault arrives as `error`, verbatim.
 */
export function saveFailureFrom(failure, { route = null, refusal = null } = {}) {
    return Object.freeze({
        recorded: false,
        route,
        status: failure && Number.isFinite(failure.status) ? failure.status : null,
        refusal: refusal ?? null,
        error: refusal ? null : (failure ?? null),
        outcome: null,
        outcomeSource: OUTCOME_SOURCE.ABSENT,
    });
}

/* ===========================================================================
 * WHICH SAVE A GESTURE IS — fix run 4, `dec-A-B-1`
 *
 * The store offers three named operations and, until this run, nothing chose between
 * them: `createProfileEditorStore` had no caller in `src/` at all. This is the choice,
 * written once, as a table over the GESTURE the person made.
 *
 * OVER THE GESTURE, AND NEVER OVER A DIFF. Slate chose its route by comparing the draft
 * against the original with the presentation fields stripped out
 * (`profile_editor.js:3267` `executionChanged`, `PRESENTATION_FIELDS = ['title',
 * 'author', 'notes']`) — a transcription of `profile_hash.dart`'s input set into the
 * client, which is precisely the duplication B10 exists to kill, and which could only
 * ever be right by luck. Here the two save paths are two different affordances: the
 * band's Save, and the header's rename. Nothing is predicted, and nothing needs the
 * server's hashing rules to be known.
 * =========================================================================== */

/** What the person did. Two affordances, two gestures. */
export const COMMIT_GESTURE = Object.freeze({
    /** The band's commit control — D11's "Save (N)" / "Close". */
    SAVE: 'save',
    /** The header's rename affordance confirmed a new name. */
    RENAME: 'rename',
});

/** The store methods a plan can name. The spelling is the store's own. */
export const SAVE_OPERATION = Object.freeze({
    NEW_VERSION: 'saveAsNewVersion',
    METADATA: 'saveMetadata',
    IN_PLACE: 'saveInPlace',
});

/**
 * THE PLAN FOR ONE GESTURE.
 *
 * @param {object} opts
 * @param {string} opts.gesture   one of `COMMIT_GESTURE`
 * @param {boolean} [opts.dirty]  does the draft differ from the served record
 *   (`changeCountOf(...).count > 0`, counted — never predicted)
 * @param {string} [opts.tell]    one of `CHANGE_TELL` — HOW MUCH THAT `dirty` IS WORTH.
 *   `changeCountOf` has answered this all along and every caller threw it away by taking
 *   `.count`; see the CANNOT-TELL section inside for why a decision needs it and a label
 *   does not. Defaults to COMPARED, so a caller that genuinely knows says nothing extra.
 * @param {boolean} [opts.seated] is a record open in the editor
 * @returns {{operation:string|null, close:boolean, reason:string}} frozen
 */
export function commitPlan({
    gesture, dirty = false, tell = CHANGE_TELL.COMPARED, seated = true,
} = {}) {
    const plan = (operation, close, reason) => Object.freeze({ operation, close, reason });

    if (gesture === COMMIT_GESTURE.RENAME) {
        if (!seated) return plan(null, false, 'nothing is open to rename');
        /* THE LABEL ROUTE — `PUT /profiles/{id}` CARRYING THE PROFILE, not the metadata map.
         *
         * The brief for this run said "rename-field gestures go through saveMetadata as
         * built", and the evidence at pin 2b047d02 says that operation cannot carry a name:
         * `saveMetadata` sends `profileUpdateBody({metadata})`, and `metadata` is
         * ProfileRecord's own free-form map (`profile_record.dart:53`,
         * `Map<String, dynamic>? metadata`) — a different field from the displayed name,
         * which is `record.profile.title`. A rename routed through it would answer 200,
         * re-seat a record whose title had not moved, and show the user a success for a
         * change that never happened. `saveInPlace` is the same ROUTE with the body the
         * rename needs, and it is one of the three named operations.
         *
         * Its own doc-comment warning — that `ProfileController.update` deletes the previous
         * record when the recomputed hash differs — is answered by the BODY rather than by a
         * hash prediction: `editor-draft.js renameBody` builds it from the record the server
         * served, changing one string, so no content change is being asked for. See that
         * function for the full reasoning.
         *
         * KNOWN REFUSAL, SURFACED RATHER THAN GUARDED: `update` throws
         * `ArgumentError('Cannot modify default profile content')` for
         * `existing.isDefault && profile != null`, so renaming a BUNDLED profile is a typed
         * 400 and the store publishes it as a refusal with ReaPrime's own sentence. There is
         * no client-side pre-filter, because the server is the authority on what it will
         * accept (the same rule B9 states for arming). */
        return plan(SAVE_OPERATION.IN_PLACE, false, 'a rename is a label edit on the open record');
    }

    if (gesture !== COMMIT_GESTURE.SAVE) return plan(null, false, `no plan for gesture '${gesture}'`);
    if (!seated) return plan(null, true, 'nothing is open, so the band can only close');
    if (!dirty) {
        /* =====================================================================
         * CANNOT TELL IS NOT CLEAN — NOT HERE, WHERE THE ANSWER DECIDES SOMETHING
         * =====================================================================
         *
         * `changeCountOf` answers `{count: 0, clean: true, tell: 'cannot-tell'}` for any
         * pair it could not compare, and the header of this file argues that rule at
         * length. THE ARGUMENT IS ABOUT A LABEL, and it is right about a label: the band
         * reads "Save" rather than "Save (N)" when nobody can say what N is, because "a
         * false-dirty Save teaches a person that the button lies, and then the one time it
         * matters they do not press it".
         *
         * IT IS THE WRONG RULE FOR A DECISION, and the difference is what each mistake
         * costs. Rounding an unknown down to CLEAN on a LABEL costs a missing number.
         * Rounding it down HERE turns the press into `close: true` — the editor shuts and
         * the draft is dropped, with no write, no toast and no question. That is the
         * defect class this fork exists to remove: a control that appears to work and does
         * nothing. Ben, 27 August 2026, on the visible half of it: "the save button doesn't
         * seem to be doing anything. I can make a change, hit save exit and go back into
         * the editor and it dosn't seem to have the change."
         *
         * SO AN UNKNOWN DIRTY STATE SAVES. The two mistakes are not symmetrical:
         *
         *   SAVING WHEN THERE WAS NOTHING TO SAVE costs one spare version, and DQ-629's
         *   whole design is built to make that cheap — a content save is POST /profiles
         *   with `parentId`, so the previous record is untouched, the new one is linked to
         *   it, and both are in the versions list. The person can see what happened and
         *   undo it.
         *
         *   CLOSING WHEN THERE WAS SOMETHING TO SAVE destroys work that exists nowhere
         *   else. There is no versions list for a draft that was never written.
         *
         * A recoverable extra write against an unrecoverable silent loss is not a close
         * call. The one thing that is NOT acceptable is the third option — closing quietly
         * — and that is what shipped.
         *
         * IT IS NOT A GUESS ABOUT THE CONTENT, so B10 is untouched: nothing is hashed,
         * nothing is predicted, and the server still decides what the write means. This
         * only decides which of two BUTTON MEANINGS an unanswerable question falls back to.
         * If the write turns out to be a no-op the server says so, and `saveReportFrom`
         * reports what it said.
         * ===================================================================== */
        if (tell === CHANGE_TELL.CANNOT_TELL) {
            return plan(SAVE_OPERATION.NEW_VERSION, true,
                'the dirty state could not be told, and an unknown must not close silently '
                + 'over a draft (DQ-629 keeps the previous version, so the spare write is cheap)');
        }
        /* D11: at a count of zero the band's Save is unfilled and there is nothing to
         * save, so the commit control's press is a request to LEAVE. Saving anyway would
         * write a version nobody asked for. (The band used to render "Close" alone here;
         * it carries Cancel + Save at every count since 25 August 2026. What changes is
         * the WORDING and the FILL, not what the press means.) */
        return plan(null, true, 'nothing is unsaved, so Close closes');
    }
    /* DQ-629, BEN'S RULING, BAKED IN: "KEEP saveAsNewVersion." A content save is
     * `POST /profiles` with `parentId` set to the record the editor opened from, so
     * ReaPrime stores a new record and leaves the previous one alone — B11's path, and the
     * one that makes "editing keeps the old version" true without the client computing
     * anything. The reversal is this one line. */
    /* SAVE CLOSES. Ben, 27 August 2026, after saving on the bench and being left in the
     * editor: "pressing save should close and arm, I shouldn't need to press save twice."
     *
     * It used to return `close: false`, so a Save wrote the version and left you exactly
     * where you were with only a toast — and the way out was to press Save AGAIN, which
     * lands on the `!dirty` branch above and closes. Two presses of one button meaning two
     * different things is what made a working save read as a broken one: he pressed Save,
     * pressed Save again to leave, and understandably read the pair as one gesture that
     * had done nothing. */
    return plan(SAVE_OPERATION.NEW_VERSION, true, 'a content save keeps the old version (DQ-629), and closes');
}
