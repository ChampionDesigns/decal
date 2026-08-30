// THE ONE PROFILE SANITIZER — and the refusal philosophy it exists to express (B9).
//
// SCOPE Part 3 §1: "Keeps `sanitizeProfileForRea`'s refusal philosophy: the `power` exit
// is deliberately SENT so ReaPrime rejects it with a typed 400, rather than the skin
// pre-stripping it into a silent behaviour change. Let the server refuse; surface the
// refusal."
//
// This function and its rationale are the entire PORT-AS-IS bucket of api.js — 38 of
// 2,406 lines, the one pure, tested, DOM-free thing in the module. It is here because a
// schema cannot derive it: it adapts the skin's DE1 v2 profile shape to ReaPrime's
// `Profile` model, and the two disagree about how "stop at weight" is spelled.
//
// THERE IS EXACTLY ONE OF IT, and that is a bug fix. The old skin had two, and they had
// drifted (scope/e2-api.md, new bug 1): the shared `sanitizeProfileForRea` folds a weight
// exit into `step.weight` before deleting it; the inline copy inside `updateWorkflow`
// does not — it nulls any non-pressure/flow/power exit, weight included, and never writes
// `step.weight`. So the same profile KEPT its stop-at-weight target when saved via
// `POST /profiles` and SILENTLY LOST it when armed via `PUT /workflow`. One sanitizer,
// used on every write path, makes that divergence inexpressible rather than fixed.
//
// TWO RULES FROM THE INLINE COPY ARE DELIBERATELY NOT CARRIED, because their stated
// premises are refuted at ReaPrime 2b047d02e42e29bf2d96a2aa964ef94e4a4daba3:
//
//  * PUMP-FIELD PRUNING (`if (step.pump === 'flow') delete step.pressure`). The comment
//    claimed mixed pump fields trip an ArgumentError. `ProfileStep.fromJson`
//    (`profile.dart`) dispatches on `pump` alone and each subclass reads only its own
//    target — `ProfileStepFlow.fromJson` reads `json['flow']` and never looks at
//    `pressure`. A stray field is ignored, not fatal.
//  * ZERO-LIMITER NULLING (`if (step.limiter.value === 0) step.limiter = null`). On a
//    pressure or flow step ReaPrime already treats `limiter.value == 0` as "no cap"
//    (`unified_de1.profile.dart`: `hasFlowCap = limiter != null && limiter.value != 0`),
//    so nulling it changes nothing. On a POWER step it changes everything in the wrong
//    direction: `ProfileStepPower.fromJson` throws `FormatException('power step requires
//    a pressure limiter')` for a null OR zero limiter, which the handlers map to a 400.
//    Nulling it converts one typed refusal into a different typed refusal for no gain;
//    sending it unaltered is what B9 asks for.
//
// The hang the inline comment feared is also gone: `workflow_handler.dart` `_applyUpdate`
// catches `ArgumentError` and `FormatException` and answers 400, with a 30 s queue
// timeout answering 503 behind it. There is no path where a bad profile leaves a
// completer unresolved. A workaround for a fixed server bug is a fallback path with a
// long fuse — A7 — so it does not come along.
//
// WHAT THE SERVER REFUSES, and what a screen therefore has to be ready to show:
//
//   POST /api/v1/machine/profile   400 {"error":"Unsupported profile","message": ...}
//     — `de1handler.dart` `_profileHandler` catches `ProfileModeUnsupportedException`
//       and maps it, explicitly to avoid the opaque 500 the withDe1 catch-all gives.
//       This is the arm-time capability gate: a Power or Lever step, or a HOLD
//       transition, on a machine that cannot run it.
//   POST /api/v1/machine/profile   400 {"error":"Invalid profile","message": ...}
//     — parse failure, deliberately OUTSIDE withDe1 so it is a clean 400.
//   POST/PUT /api/v1/profiles      400 {"error":"Invalid request","message": ...}
//   PUT  /api/v1/workflow          400 {"error":"Invalid request","message": ...}
//
// All four carry the server's own message. `profileRefusal()` below reads it out; nothing
// in this module decides how it is worded or where it is shown.
//
// Also NOT here: the three `alert()`s inside the old `isValidProfile`. Validation is the
// server's, the answer is data, and a transport module does not open a modal.

// THE ONE IMPORT. `newStep` is the blank step's single declaration and it lives in
// `src/lib/profile-modes.js` beside the other step seeds (`seedStepForPump`,
// `POWER_CAP_DEFAULT`), because what a STEP looks like is that module's fact and what a
// profile DOCUMENT looks like is this one's. `src/data/adapters-r.js` already reaches into
// `src/lib/` the same way for the same reason (`limitsFor`), so the direction is the
// tree's, not a new one. Re-declaring the step here instead would be the second copy that
// `newProfile()`'s own note is about.
import { newStep } from '../lib/profile-modes.js';

// ============================================================================
// READING A ProfileRecord — the address rule, applied to the profile collection
// ============================================================================
//
// `rea-address.js` is "the one reader in Decal that speaks ReaPrime's current names",
// and it is scoped to telemetry FRAMES (snapshots, sensors, stored measurements) — it
// says so in its own header and declares no routes. A `ProfileRecord` is the other thing
// the server sends, and it needs the same treatment for the same reason: one file to
// change the day ReaPrime renames a field, instead of `record.visibility` spelled out at
// twenty call sites. This module already owns the profile WRITE bodies and the refusal
// reading, so the record readers live here rather than in a second profile module.
//
// Shapes read from `ProfileRecord` (`lib/src/models/data/profile_record.dart`) at the pin
// 2b047d02: `id`, `profile`, `metadataHash`, `compoundHash`, `parentId`, `visibility`,
// `isDefault`, `createdAt`, `updatedAt`, `metadata`.
//
// A7 — nothing here invents a value. An absent field reads as `null`, never as a
// plausible default, and `profileVisibilityOf` returns exactly what the server said even
// when that is a spelling this build has never heard of, so a fourth visibility state
// announces itself at the filter instead of being silently listed or silently dropped.

/** `enum Visibility { visible, hidden, deleted }` (`profile_record.dart:6`). */
export const PROFILE_VISIBILITY = Object.freeze({
    VISIBLE: 'visible',
    /** A superseded editor version, kept for revert history. Also where `DELETE` puts a
     *  BUNDLED profile: `ProfileController.delete` hides an `isDefault` record and only
     *  soft-deletes a user one. */
    HIDDEN: 'hidden',
    /** A soft delete. The record is still served by `GET /profiles?includeHidden=true`. */
    DELETED: 'deleted',
});

const isRecord = (value) => Boolean(value) && typeof value === 'object';

/** The record's own id — the profile content hash, `profile:<hex>`. Never the workflow's. */
export function profileRecordIdOf(record) {
    return isRecord(record) && typeof record.id === 'string' && record.id ? record.id : null;
}

/** `record.profile.title`. The Profile carries the title; the record does not. */
export function profileTitleOf(record) {
    if (!isRecord(record) || !isRecord(record.profile)) return null;
    const title = record.profile.title;
    return typeof title === 'string' ? title : null;
}

/** Verbatim. An unrecognised value is returned as-is — see A7 above. */
export function profileVisibilityOf(record) {
    return isRecord(record) && typeof record.visibility === 'string' ? record.visibility : null;
}

/** The metadata map, or `null` when the record carries none. Never `{}` standing in. */
export function profileMetadataOf(record) {
    return isRecord(record) && isRecord(record.metadata) ? record.metadata : null;
}

/** True only for a bundled profile. `isDefault` content cannot be modified by `PUT`. */
export function isDefaultProfile(record) {
    return isRecord(record) && record.isDefault === true;
}

/** The version link ReaPrime already stores (B11's raw material). */
export function profileParentIdOf(record) {
    return isRecord(record) && typeof record.parentId === 'string' && record.parentId
        ? record.parentId
        : null;
}

/** Legacy TCL fields ReaPrime's Profile model has no home for. */
export const LEGACY_PROFILE_KEYS = Object.freeze([
    'type', 'legacy_profile_type', 'lang', 'hidden',
    'reference_file', 'changes_since_last_espresso',
]);

/** `ExitType` at the pinned commit (`profile.dart`). Sent through untouched. */
export const REA_EXIT_TYPES = Object.freeze(['pressure', 'flow', 'power']);

/**
 * Adapt one profile to ReaPrime's `Profile` model. Returns a clone; the caller's object
 * is untouched.
 *
 * Exactly three transformations, each a genuine shape difference between the two models:
 *
 *  1. `version` defaults to '2' — the skin's shape is DE1 v2 and ReaPrime reads version
 *     as an optional string.
 *  2. The six legacy TCL keys are dropped. ReaPrime tolerates them; they bloat every
 *     stored record.
 *  3. A step's `exit` is translated ONLY where the two models spell the same thing
 *     differently:
 *       * `{type:'weight'}` -> `step.weight`. ReaPrime has no weight exit type; it
 *         models stop-at-weight as the step's `weight` field. Dropping the exit without
 *         folding the threshold is the drift bug above.
 *       * `{type:'off'}` -> `null`. 'off' is the skin's spelling of "this step has no
 *         exit"; ReaPrime's spelling is a missing exit.
 *     EVERYTHING ELSE PASSES THROUGH, including `power` and including a type neither
 *     model knows. That is B9: the server owns the refusal, and an unrecognised exit
 *     comes back as a typed 400 naming the offending value instead of vanishing here.
 */
export function sanitizeProfileForRea(profileData) {
    const profile = structuredClone(profileData);

    profile.version = profile.version || '2';
    for (const key of LEGACY_PROFILE_KEYS) delete profile[key];

    if (Array.isArray(profile.steps)) {
        for (const step of profile.steps) {
            const exit = step && step.exit;
            if (!exit || typeof exit !== 'object') continue;
            if (exit.type === 'weight') {
                if (step.weight === undefined || step.weight === null || step.weight === 0) {
                    step.weight = exit.value;
                }
                delete step.exit;
            } else if (exit.type === 'off') {
                step.exit = null;
            }
        }
    }
    return profile;
}

/**
 * THE SHAPE A PROFILE FILE MUST HAVE before this app will send it anywhere.
 *
 * WHY VALIDATE AT ALL, when the server validates too. Because the FILE came off a
 * tablet's filesystem and the person who picked it will be told either "that is not a
 * profile" or "500". Slate makes the same check for the same reason
 * (`profileManager.js validateProfileStructure`) and its ten required keys are the ten
 * here — read off its list rather than re-derived, so a file Slate accepts is a file
 * Decal accepts.
 *
 * IT IS A SHAPE CHECK AND NOT A SEMANTIC ONE. Nothing here asks whether the steps make
 * espresso; `sanitizeProfileForRea` still runs on the way out, and the machine still
 * refuses what it cannot run (B9's arm-time 400). What this closes is the case where a
 * shopping list gets POSTed as a profile.
 *
 * @param {unknown} parsed  whatever `JSON.parse` produced
 * @returns {{ok: true, profile: object} | {ok: false, reason: string, missing: string[]}}
 */
export function readProfileFile(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return Object.freeze({ ok: false, reason: 'not-a-profile', missing: Object.freeze([]) });
    }
    const missing = PROFILE_FILE_KEYS.filter(
        (key) => !Object.prototype.hasOwnProperty.call(parsed, key),
    );
    if (missing.length) {
        return Object.freeze({ ok: false, reason: 'missing-fields', missing: Object.freeze(missing) });
    }
    if (!Array.isArray(parsed.steps)) {
        return Object.freeze({ ok: false, reason: 'steps-not-an-array', missing: Object.freeze([]) });
    }
    return Object.freeze({ ok: true, profile: parsed });
}

/**
 * The ten keys a profile file must carry — Slate's own list, in its own order
 * (`profileManager.js:748-759`).
 */
export const PROFILE_FILE_KEYS = Object.freeze([
    'title',
    'author',
    'notes',
    'beverage_type',
    'steps',
    'version',
    'target_volume',
    'target_weight',
    'target_volume_count_start',
    'tank_temperature',
]);

/**
 * A BRAND-NEW, UNSAVED PROFILE — the ten keys above, filled, with ONE step in it.
 *
 * WHY IT IS HERE. `PROFILE_FILE_KEYS` is the list of what a profile document must carry,
 * and this module already owns both write bodies (`profileCreateBody`,
 * `profileUpdateBody`) and the reader that judges a document complete (`readProfileFile`).
 * "What a blank profile document is" is the same fact as "what a profile document is", so
 * it has the same owner. `test/profile-add.test.mjs` puts the two together and asserts
 * `readProfileFile(newProfile())` answers ok — this module's own reader, judging this
 * module's own seed, so a key added to the list can never leave the seed behind.
 *
 * WHAT IT REPLACED, AND WHY THAT WAS TWO BUGS RATHER THAN ONE. `selector-screen.js`
 * seated `{ title, steps: [] }` — an object literal inside the + menu's click handler.
 *
 *   1. NO STEPS. Ben, 27 August 2026: "in profile selector, if I press the button to make
 *      a new profile it loads the profile editor but there is no steps, wich means there
 *      is not + button to add a new step etc, ie I cannot add any steps." The editor's
 *      only route to a new step is the per-step action rail, and with no steps there is no
 *      rail — a profile that could be opened and never edited. The comment three lines
 *      above that literal already said "ONE STEP, ONE NAME"; the step half was never
 *      written. Slate seeds a whole worked example there (`profile_selector.js:1550`, a
 *      Preinfusion/Ramp/... profile); Ben asked for one step, so one step it is, and
 *      `profile-modes.js NEW_STEP` carries the values he named.
 *   2. EIGHT MISSING KEYS. `POST /api/v1/profiles` declares
 *      `requiredKeys: ["title", "steps", "target_volume_count_start", "tank_temperature"]`
 *      (`rea-routes.generated.js`, the pinned spec), so a two-key literal could not have
 *      been SAVED either — the editor's Save would have gone out incomplete and come back
 *      a typed 400. Nobody had reached that far, because nobody could add a step. The
 *      second half of the same defect, and it is fixed by the same object.
 *
 * THE NINE NON-STEP VALUES ARE THE EMPTY ONES, and each is the state the server and the
 * fixtures already spell for "nothing chosen": `target_volume`, `target_weight` and
 * `tank_temperature` at 0 (unset, not a target), `target_volume_count_start` at 0 (its own
 * "None" — a 1-based step index where 0 means no preinfusion marker,
 * `profile_editor.js moveStepTo`), `author` and `notes` empty, `beverage_type` 'espresso'
 * and `version` '2' — the DE1 v2 profile format, spelled as a STRING because that is what
 * every recorded ReaPrime document carries (`tools/rea-fixtures/api__v1__workflow.json`)
 * and what Slate writes. None of these is a bound and none is a limit; B2 is untouched.
 *
 * THE TITLE AND THE STEP NAME COME FROM THE CALLER, both for D2's reason: this module is
 * DOM-free and has no `t()`, and both strings are read by a person. The caller passes
 * translated text or passes nothing.
 *
 * @param {{title?: string, stepName?: string}} seed  the caller's translated words
 * @returns {object} a fresh, mutable profile — never a shared frozen one
 */
export function newProfile({ title = '', stepName = '' } = {}) {
    return {
        title: typeof title === 'string' ? title : '',
        author: '',
        notes: '',
        beverage_type: 'espresso',
        steps: [newStep({ name: stepName })],
        version: '2',
        target_volume: 0,
        target_weight: 0,
        target_volume_count_start: 0,
        tank_temperature: 0,
    };
}

/**
 * Body for `POST /api/v1/profiles` — the profile is WRAPPED.
 * `profile_handler.dart` `_handleCreate` reads `json['profile']`, `json['parentId']`,
 * `json['metadata']`.
 */
export function profileCreateBody(profile, { parentId = null, metadata = null } = {}) {
    const body = { profile: sanitizeProfileForRea(profile) };
    if (parentId) body.parentId = parentId;
    if (metadata) body.metadata = metadata;
    return body;
}

/**
 * Body for `PUT /api/v1/profiles/<id>` — wrapped, and `profile` is OPTIONAL there:
 * `_handleUpdate` only parses it `if (json.containsKey('profile'))`, so a metadata-only
 * update is a legal request that touches no steps.
 */
export function profileUpdateBody({ profile = null, metadata = null } = {}) {
    const body = {};
    if (profile) body.profile = sanitizeProfileForRea(profile);
    if (metadata) body.metadata = metadata;
    return body;
}

/**
 * THE NUMBERS A PROFILE CARRIES ONTO THE MACHINE, and where each one comes from.
 *
 * A profile is not only its steps. The dose you weigh, the drink weight you stop at and
 * the number on the grinder are per-profile settings a person keeps, and the old app
 * keeps them in the profile RECORD's `metadata` — a metadata-only `PUT /profiles/<id>`
 * that leaves the execution hash, and therefore the id, untouched
 * (`profileManager.js:334-345`). This reads them back out.
 *
 *   targetDoseWeight   the record's own remembered dose, else 18 g. ReaPrime's `Profile`
 *                      model has NO dose field (`profile.dart` — the old app reads
 *                      `profile.dose_weight`, a legacy TCL key that survives only on
 *                      records imported from the TCL app), so 18 is the floor the old app
 *                      falls to as well (`profileManager.js:524`).
 *   targetYield        the record's remembered yield, else the profile's OWN
 *                      `target_weight`. This is the one that has to be right: on a machine
 *                      without autonomous stop-at-weight ReaPrime stops the shot on
 *                      `profile.target_weight`, so a yield held only in `context` would be
 *                      shown on the rail and never reached by the machine. That is why the
 *                      profile is sent with `target_weight` folded to the same number.
 *   grinderSetting     the record's remembered grind, or null to CLEAR the field. Null and
 *                      not absent: `deepMergeJson` only overwrites keys the body carries,
 *                      so an absent key would leave the last profile's grind standing
 *                      against this one.
 *
 * @param {object} record  a ProfileRecord
 * @returns {object|null}  the `PUT /api/v1/workflow` body, or null for a record with no
 *                         profile on it.
 */
export function workflowApplyBody(record) {
    const profile = isRecord(record) && isRecord(record.profile) ? record.profile : null;
    if (!profile) return null;
    const meta = profileMetadataOf(record) ?? {};

    const dose = finiteNumber(meta.targetDoseWeight) ?? DEFAULT_DOSE_G;
    const target = finiteNumber(meta.targetYield) ?? finiteNumber(profile.target_weight);
    const yielded = target ?? 0;
    const grinderSetting = meta.grinderSetting === undefined || meta.grinderSetting === null
        ? null : String(meta.grinderSetting);

    const sent = yielded > 0 ? { ...profile, target_weight: yielded } : profile;
    return {
        profile: sanitizeProfileForRea(sent),
        context: { targetDoseWeight: dose, targetYield: yielded, grinderSetting },
    };
}

/** The dose a record that remembers none is loaded with. The old app's own floor. */
export const DEFAULT_DOSE_G = 18;

/** A finite number, or undefined — `target_weight` can arrive as a numeric string. */
function finiteNumber(value) {
    if (value === null || value === undefined || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}

/**
 * Body for `POST /api/v1/machine/profile` — the arm path. NOT wrapped.
 * `_profileHandler` does `Profile.fromJson(jsonDecode(payload))` on the whole body. The
 * asymmetry with `POST /profiles` is real and is the sort of thing a hand-written wrapper
 * gets right once and a second hand-written wrapper gets wrong.
 */
export function profileArmBody(profile) {
    return sanitizeProfileForRea(profile);
}

/**
 * Read a refusal out of a transport failure, or null if it is not one.
 *
 * `kind` distinguishes the arm-time capability refusal ('unsupported') from a parse or
 * request rejection ('invalid'), because they mean different things to a person: the
 * first says "this machine cannot run this profile", the second says "this profile is
 * malformed". Both carry `message` verbatim from ReaPrime. Neither is worded here.
 */
/**
 * WHAT THE SERVER SAID WENT WRONG, for a failure that is NOT a typed refusal.
 *
 * `profileRefusal` above answers only for a 400 carrying `{error, message}` — the shape
 * that makes a statement about the profile. This answers for everything else, and it
 * exists because ReaPrime's create path reports CLIENT errors as 500s: `_handleCreate`
 * maps `ArgumentError` and `FormatException` to 400 and lets everything else fall to a
 * generic catch, so a profile it cannot parse comes back "Internal server error" with the
 * real reason in `message`. Measured against the bench machine on 28 August 2026: an
 * unknown step type answered 500 `Exception: Invalid step type. Must include either
 * "pressure" or "flow".`, and a step missing a required field answered 500 `type 'Null'
 * is not a subtype of type 'String'`. Both name the fault exactly; both were discarded.
 *
 * NOT A SECOND REFUSAL PATH. A refusal blocks the write and is the machine's verdict on
 * the profile; this is only ever the words shown to a person, so it never decides
 * anything. `problem` is whatever `parseProblem` made of the body: the parsed object when
 * it was JSON, the raw text when it was not, and null when there was no body to read.
 *
 * @param {object|null} failure  a `{ok: false}` transport result
 * @returns {string|null} the server's sentence, or null when it said nothing usable
 */
export function profileFailureSentence(failure) {
    if (!failure || failure.ok !== false) return null;
    const problem = failure.problem;
    if (typeof problem === 'string') {
        const text = problem.trim();
        return text === '' ? null : text;
    }
    if (!problem || typeof problem !== 'object') return null;
    const message = typeof problem.message === 'string' ? problem.message.trim() : '';
    if (message !== '') return message;
    const error = typeof problem.error === 'string' ? problem.error.trim() : '';
    return error === '' ? null : error;
}

export function profileRefusal(failure) {
    if (!failure || failure.ok !== false || failure.status !== 400) return null;
    const problem = failure.problem;
    if (!problem || typeof problem !== 'object') return null;
    const error = typeof problem.error === 'string' ? problem.error : '';
    if (!error) return null;
    const kind = error === 'Unsupported profile' ? 'unsupported' : 'invalid';
    return Object.freeze({
        kind,
        error,
        message: typeof problem.message === 'string' ? problem.message : '',
    });
}
