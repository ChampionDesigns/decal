/**
 * editor-draft.js — THE DRAFT WRITER. Every editing event, applied to a profile: the four
 * that move a VALUE inside a step, and the one that changes WHICH STEPS THERE ARE.
 *
 * Fix run 4 (the editor), finding `dec-A-B-1`. The structural half (`applyStepAction`, at
 * the bottom of this file) was added 27 August 2026 for the same finding wearing a second
 * face — see its own section for Ben's report and for why five live buttons had no
 * listener anywhere in `src/`.
 *
 * ===========================================================================
 * WHY THIS EXISTS, AND WHY IT IS HERE RATHER THAN IN THE SCREEN
 * ===========================================================================
 * Every editing surface in this cluster states the same contract in its own header, and
 * they all state the same half of it: "the draft is the screen's". `<step-matrix>` reads
 * `steps` and never writes one; `<editor-overlays>` and both dialogs "write no draft";
 * `<ui-exit-sentence>` says it outright ("editor draft state, NEVER mutated; every change
 * leaves as an event and the screen owns the draft"). Four elements dispatch four events,
 * and until this run NOTHING in `src/` closed the loop — the only writer in the tree was
 * the ten-line `root.apply()` inside `test/harness/editor.js`'s composition root, which is
 * why `dec-A-B-1` could say the machinery "is complete and tested" and still be unreachable
 * from the app.
 *
 * It is a MODULE and not a method on the screen for the reason `src/lib/` exists: this is
 * string-and-object work with no DOM in it, so it runs under `node:test` against the event
 * shapes themselves, and the screen keeps its one job (layout, and holding the draft it is
 * handed). The screen's listeners are four lines each; every rule about what an edit MEANS
 * is here.
 *
 * ===========================================================================
 * THE FIVE EVENTS, AS THEIR OWN FILES DECLARE THEM
 * ===========================================================================
 *   `step-change`            step-matrix.js:672   {index, row, field, value, previous}
 *   `value-commit`           editor-overlays.js:510 {origin, field, index, row, limitKey,
 *                                                   value, raw} — the numpad's confirm
 *   `exit-condition-change`  editor-exit-dialog.js:390 {index, slot, type, condition, value}
 *   `lever-change`           editor-lever-dialog.js:357 {index, leverSpring, leverGive}
 *   `step-action`            ui-action-key-rail.js:256 {action, index, count} — the five
 *                                                   keys under a step column
 *
 * The first two carry the SAME coordinates ({index, field, value}) and are applied by one
 * function, because they are one gesture arriving by two routes: a cell's own control
 * moved, or the keypad that cell opened confirmed. Treating them differently is how the
 * two would drift.
 *
 * The fifth is the odd one and it has its own door (`applyStepAction`) rather than a fifth
 * case in `applyEditorEdit`: the first four change a value INSIDE a step and answer
 * {draft, applied, reason}; the fifth changes the step LIST and has to answer one thing
 * more — where the person now is, once the list has moved under their finger.
 *
 * ===========================================================================
 * THREE STEP KEYS ARE NOT PLAIN ASSIGNMENTS, AND EACH IS SOMEBODY ELSE'S RULE
 * ===========================================================================
 *  1. `limiter` — the row's value lives at `step.limiter.value` and the event carries the
 *     NUMBER. `step-matrix-rows.js:122-125` names this file's job in as many words: "a
 *     step-change event for this row therefore carries the limiter's VALUE, and the draft
 *     owner writes {...step, limiter: {...step.limiter, value}}". The `range` beside it is
 *     the step's own and is preserved.
 *
 *  2. `pump` — a mode switch is not an assignment, it is a RESEED: stale target keys go,
 *     the new target is seeded, Power's cap is forced and Lever's triple is applied.
 *     `profile-modes.js seedStepForPump` owns every one of those rules (and throws none of
 *     them away silently), so this module calls it. It MUTATES its argument, which is why
 *     it is handed a fresh copy of the step and never the one in the draft.
 *
 *  3. `exit` — the exit dialog sends the three parts of a condition, not an object, so the
 *     object is assembled here in the shape the fixture's 890 steps carry
 *     (`{type, condition, value}`).
 *
 * ===========================================================================
 * IMMUTABLE, AND THAT IS LOAD-BEARING FOR LIT
 * ===========================================================================
 * Every function returns a NEW profile with new step objects on the path that changed;
 * nothing is written in place. The surfaces take the draft as a property, and Lit's
 * `changed` check is identity — a mutated array is the same array, so the matrix would not
 * re-render and the preview would not re-derive. The harness's root has the same rule for
 * the same reason.
 *
 * AN EDIT THAT CANNOT BE APPLIED IS REPORTED, NOT SWALLOWED. `applied: false` with a
 * `reason` is the answer for an index that is not in the draft, a field nobody named, or a
 * profile that is not a profile — the caller can log it, and a silent no-op cannot hide a
 * wiring mistake the way `dec-A-B-1`'s missing listener hid for a whole wave.
 */

import { newStep, seedStepForPump, limiterOnClear } from './profile-modes.js';
import { exitBand } from './exit-sentence.js';

/** The four event names this module applies. Spelled once, imported by the screen. */
export const EDITOR_EDIT = Object.freeze({
    STEP_CHANGE: 'step-change',
    VALUE_COMMIT: 'value-commit',
    EXIT_CONDITION_CHANGE: 'exit-condition-change',
    LEVER_CHANGE: 'lever-change',
    EXIT_REMOVE: 'exit-remove',
});

/** The step key whose event value is the inner `.value` of an object. */
const LIMITER_FIELD = 'limiter';

/** The step key whose assignment is a mode reseed rather than a write. */
const PUMP_FIELD = 'pump';

const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

const refuse = (draft, reason) => Object.freeze({ draft, applied: false, reason });

/**
 * Replace one step, returning a new profile. The only place a draft is rebuilt.
 *
 * @param {object} draft
 * @param {number} index
 * @param {(step:object) => object} change  given a COPY of the step, returns the new one
 */
function withStep(draft, index, change) {
    if (!isObject(draft)) return refuse(draft, 'the draft is not a profile object');
    const steps = Array.isArray(draft.steps) ? draft.steps : null;
    if (!steps) return refuse(draft, 'the draft carries no steps array');
    if (!Number.isInteger(index) || index < 0 || index >= steps.length) {
        return refuse(draft, `no step at index ${index}`);
    }
    const next = change({ ...steps[index] });
    if (!isObject(next)) return refuse(draft, 'the edit produced no step');
    return Object.freeze({
        draft: { ...draft, steps: steps.map((step, i) => (i === index ? next : step)) },
        applied: true,
        reason: null,
    });
}

/**
 * `step-change` and `value-commit` — one cell's value moved.
 *
 * @param {object|null} draft
 * @param {{index:number, field:string, value:*}} detail
 */
export function applyStepValue(draft, { index, field, value } = {}) {
    if (typeof field !== 'string' || field === '') {
        return refuse(draft, 'the edit named no field');
    }
    return withStep(draft, index, (step) => {
        if (field === LIMITER_FIELD) {
            /* The row's value is the limiter's `value`; its `range` is the step's own and
             * survives. See rule 1 in the header.
             *
             * A STEP WITH NO LIMITER OBJECT IS SEEDED FROM ITS MODE'S FACTORY, NOT FROM
             * `{}` — audit F-048, reported by Ben on 29 August 2026 ("add a limiter...
             * press save... an error, something about null").
             *
             * `{}` was the whole bug. 64 of the 147 fixture profiles carry at least one
             * step stored `limiter: null`, its cell draws `OFF`, and arming it produced
             * `{"value": 0.1}` WITH NO `range`. ReaPrime's `StepLimiter.fromJson` reads
             * `range` through `parseDouble(String)`, so a null throws
             * `type 'Null' is not a subtype of type 'String'` before any handler sees the
             * body — a 500 on `POST /profiles` and a 400 on `PUT /profiles/<id>`, the two
             * routes not sharing a catch ladder. And the draft stayed poisoned: stepping
             * back to OFF left a rangeless `{"value": 0}`, the cell looked restored, and
             * the next save failed identically, taking every other unsaved edit with it.
             *
             * ZERO AND ABSENT ARE ONE STATE ON THE GLASS AND TWO ON THE WIRE. A limiter
             * stored `{value: 0, range: 0.6}` draws the same OFF and always armed cleanly,
             * which is why this survived a whole e2e suite: its limiter test edited an
             * already-set limiter, and a NEW profile's steps always seed a range.
             *
             * `limiterOnClear(step.pump)` IS THE FACTORY AND NOT A LITERAL HERE. It is
             * `profile-modes.js`'s own answer to "what is a complete limiter for this
             * mode" — the power cap for Power, a zero at the shared soft-knee width for
             * everything else — and the width has exactly one declaration in this tree
             * (`POWER_CAP_DEFAULT.range`). Writing `range: 0.6` at this call site would be
             * the second copy, and B2's whole argument is about second copies.
             *
             * THE VALUE STILL WINS. The factory supplies the SHAPE; the row's number is
             * spread over it, so arming from null and arming from `{value: 0, range}` end
             * on the same object. THIS IS THE ONLY SITE IN THE SKIN THAT CAN MAKE A
             * LIMITER OBJECT, so with the seed complete here, no rangeless limiter can
             * reach the wire by any route — including the two the transition sweep found
             * (a pressure/flow flip, which does not touch the limiter at all, and a flip
             * to Power, which takes `seedStepForPump`'s CLAMP arm rather than its rebuild
             * arm whenever the value is above zero) and `copyStep`, which copies faithfully
             * and so used to copy the poison. */
            const held = isObject(step.limiter) ? step.limiter : limiterOnClear(step.pump);
            return { ...step, limiter: { ...held, value } };
        }
        if (field === PUMP_FIELD) {
            /* A RESEED, and `seedStepForPump` mutates — so it is given the copy `withStep`
             * already made, never the draft's own object. See rule 2.
             *
             * THE LIMITER IS COPIED TOO, because `withStep`'s copy is shallow and the
             * reseed's power branch writes THROUGH it (`step.limiter.value = clamp(...)`,
             * profile-modes.js) — a nested write that would otherwise land in the previous
             * draft's step and, on a first edit of a seated step, in the BASELINE record
             * the rename body is built from. A corrupted baseline is how a rename comes to
             * carry content the server never served, which moves the hash and deletes the
             * prior version — the exact hazard `renameBody` exists to avoid. */
            if (isObject(step.limiter)) step.limiter = { ...step.limiter };
            return seedStepForPump(step, value);
        }
        return { ...step, [field]: value };
    });
}

/**
 * `exit-condition-change` — the exit dialog confirmed a condition for one step.
 *
 * @param {object|null} draft
 * @param {{index:number, type:string, condition:string, value:number}} detail
 */
export function applyExitCondition(draft, { index, type, condition, value } = {}) {
    return withStep(draft, index, (step) => ({
        ...step,
        exit: { type, condition, value },
    }));
}

/**
 * `exit-remove` — the × on an occupied exit slot.
 *
 * THE BAND'S OWN OCCUPANCY RULE DECIDES WHAT "GONE" MEANS, so this clears exactly what
 * that rule reads and nothing else: a condition is `step.exit`, and a scalar slot is its
 * field at 0, because `exit-sentence.js scalarOf` counts only a finite value above zero
 * as occupied. Writing `undefined` instead would leave the key in the profile with no
 * value, which is not a shape ReaPrime ever sent.
 *
 * `exit: null` IS THE SERVER'S OWN SHAPE for a step that does not exit — a loaded
 * profile carries it verbatim — so a removed condition saves as it arrived.
 *
 * The field comes from the band record rather than a second table: `exitBand` already
 * answers which key each slot owns, and a copy here would be a third place to disagree.
 *
 * @param {object|null} draft
 * @param {{index:number, slot:string}} detail
 */
export function applyExitRemove(draft, { index, slot } = {}) {
    if (slot === 'condition') {
        return withStep(draft, index, (step) => ({ ...step, exit: null }));
    }
    const record = exitBand(null).find((entry) => entry.slot === slot) ?? null;
    if (!record || record.field === 'exit') {
        return refuse(draft, `no draft rule for exit slot '${slot}'`);
    }
    return withStep(draft, index, (step) => ({ ...step, [record.field]: 0 }));
}

/**
 * `lever-change` — the lever dialog confirmed a spring and a give for one step.
 *
 * P0 IS NOT HERE, and that is the dialog's own rule rather than an omission: the lever
 * dialog edits P0 through the ordinary target cell (`pressure`), and its confirm carries
 * only the two parameters that have no cell of their own.
 *
 * @param {object|null} draft
 * @param {{index:number, leverSpring:number, leverGive:number}} detail
 */
export function applyLeverChange(draft, { index, leverSpring, leverGive } = {}) {
    return withStep(draft, index, (step) => ({ ...step, leverSpring, leverGive }));
}

/**
 * ONE DOOR FOR THE SCREEN: an event name and its detail, applied.
 *
 * @param {object|null} draft
 * @param {string} name    one of `EDITOR_EDIT`
 * @param {object} detail  the event's own detail, verbatim
 * @returns {{draft:object|null, applied:boolean, reason:string|null}}
 */
export function applyEditorEdit(draft, name, detail = {}) {
    switch (name) {
        case EDITOR_EDIT.STEP_CHANGE:
        case EDITOR_EDIT.VALUE_COMMIT:
            return applyStepValue(draft, detail);
        case EDITOR_EDIT.EXIT_CONDITION_CHANGE:
            return applyExitCondition(draft, detail);
        case EDITOR_EDIT.LEVER_CHANGE:
            return applyLeverChange(draft, detail);
        case EDITOR_EDIT.EXIT_REMOVE:
            return applyExitRemove(draft, detail);
        default:
            return refuse(draft, `no draft rule for '${name}'`);
    }
}


/* ===========================================================================
 * THE STEP LIST ITSELF — the five keys under every step column
 * ===========================================================================
 *
 * WHY THIS SECTION EXISTS, AND IT IS `dec-A-B-1` ALL OVER AGAIN. `ui-action-key-rail.js`
 * ships five buttons — move-left, delete, insert-after, duplicate, move-right — declares
 * the event they leave as ("@fires step-action - {action, index, count}, bubbles,
 * composed, cancelable"), dispatches it correctly, and is proven in isolation by a
 * 700-line render suite. `step-matrix.js` mounts one rail per step column and its own
 * comment says the event "is composed and carries {action, index, count}, so it crosses
 * this boundary as it is" — and then the sentence stops. NOTHING IN `src/` LISTENED. Five
 * buttons, a documented contract, a passing suite, and a person pressing them and watching
 * nothing happen.
 *
 * Ben, 27 August 2026: "IN the profile editor page, the 5 buttons down the bottom dont
 * seem to do anything, like if I try to make a new step of copy one etc it does noting."
 *
 * IT IS HERE FOR THE REASON THE FOUR VALUE EVENTS ARE HERE, stated at the top of this
 * file: the matrix announces, the screen decides, the draft is the screen's, and every
 * rule about what an edit MEANS is written in this module where `node:test` can reach it
 * without a browser. A structural edit is still an edit. The screen's listener is four
 * lines; the rules are these.
 *
 * IT IS ITS OWN DOOR AND NOT A FIFTH CASE OF `applyEditorEdit`, and that is the only
 * shape difference worth arguing about. The four value events all answer
 * `{draft, applied, reason}` and a caller has nothing else to do with the answer. A
 * structural edit answers one thing more — WHERE THE PERSON NOW IS — because a list that
 * reordered under the caret is a list whose caret is now on somebody else's button. So
 * this function's result carries `index`, and `applyEditorEdit`'s cannot without giving
 * four callers a field that means nothing to them.
 *
 * ===========================================================================
 * THREE RULES THAT ARE NOT IN THE FIVE BUTTON NAMES
 * ===========================================================================
 *
 * 1. A PROFILE KEEPS AT LEAST ONE STEP, so `delete` refuses on the last one.
 *
 *    THIS IS NOT A NEW OPINION — it is this tree's own written rule, waiting for its
 *    other half. `step-matrix.js render()` says, verbatim: "A matrix with no steps
 *    renders NOTHING — not an invented empty state, and not a grid with a phantom
 *    column. A profile with zero steps is not an editing surface, and 'never delete the
 *    last step' is the DRAFT OWNER'S RULE TO KEEP, not a shape for this file to guess
 *    at." This module is the draft owner. The rule was assigned and never written.
 *
 *    AND BEN MET THE OTHER END OF IT THE SAME MORNING: a profile with no steps has no
 *    step columns, no action rails and therefore no way back — "wich means there is not
 *    + button to add a new step etc, ie I cannot add any steps". Deleting the only step
 *    would put a person in exactly the dead end he had just reported, one button press
 *    after the seed that fixed it.
 *
 *    SLATE DELETES IT (`profile_editor.js deleteStep` splices unconditionally) and its
 *    per-step footer is its only insert route too, so Slate has the same dead end and
 *    has simply never been driven into it — its own new-profile seed is a four-step
 *    worked example. This is a declared departure: Decal follows Slate except where
 *    Slate is wrong, and a control whose only outcome is an unrecoverable state is
 *    wrong. `ui-action-key-rail.js` DISABLES the key rather than letting it be pressed
 *    for nothing (its `minCount`), so the refusal below is the second line of defence
 *    and not the user-visible one — a live button that quietly does nothing is the exact
 *    defect this whole section exists to remove.
 *
 * 2. THE PREINFUSION MARKER TRAVELS WITH ITS STEP.
 *
 *    `target_volume_count_start` is part of the profile document (`rea-profile.js
 *    PROFILE_FILE_KEYS`, and one of the seven inputs to ReaPrime's CONTENT hash — see
 *    `renameBody` below), and it is a 1-BASED STEP INDEX where 0 means None. Slate's own
 *    `moveStepTo` says why it has to be carried: "Reordering steps under it would
 *    otherwise silently re-point preinfusion at whichever step happened to land in that
 *    slot." Nothing in Decal EDITS this field yet, which makes it more dangerous rather
 *    than less: a value nobody can see and nobody can fix is a value that must not be
 *    silently corrupted by a button press.
 *
 *    Decal carries it through DELETE as well, and Slate does not — `deleteStep` splices
 *    the array and leaves the marker pointing one step to the right of where it was, or
 *    at a step that no longer exists. Same reasoning, same field, one path Slate missed.
 *
 * 3. A HOLD STEP MAY NOT BE PROMOTED TO FIRST.
 *
 *    HOLD latches the PREVIOUS step's target, so it means nothing at index 0 — which is
 *    why `profile-modes.js transitionSegments` already marks the HOLD chip
 *    `disabled: index === 0`. That gate stops a person AUTHORING one there; it cannot
 *    stop a MOVE or a DELETE from promoting one that was authored legally at index 3.
 *    Slate keeps the two halves together (`resetLeadingHold`, called from its delete and
 *    its move, "so the leading frame is a benign authored setpoint") and so does this.
 */

/**
 * The five actions this module can apply, spelled once.
 *
 * THEY MUST EQUAL `ui-action-key-rail.js ACTION_KEYS`' ids and the equality is PINNED, in
 * `test/render/editor-step-actions.render.test.mjs`, by importing both modules in the page
 * and comparing the two lists. It is a test rather than an import because the direction an
 * import would have to take is the wrong one: this module is DOM-free and runs under
 * `node:test`, and a leaf key rail should not have to pull the profile draft writer (and
 * `profile-modes.js` behind it) into its own module graph to know what its buttons are
 * called. A sixth key added to the rail with no rule here fails that pin.
 */
export const STEP_ACTIONS = Object.freeze([
    'move-left', 'delete', 'insert-after', 'duplicate', 'move-right',
]);

/** Rule 1 above, as the number it is: a profile is never left with fewer steps than this. */
export const MIN_PROFILE_STEPS = 1;

/** The profile key that points at the preinfusion step. Rule 2 above. */
const VOLUME_COUNT_KEY = 'target_volume_count_start';

/** The transition that has no meaning on step 1. Rule 3 above. */
const HOLD_TRANSITION = 'hold';

/** A refusal that still answers "where is the person" — see the door's shape note. */
const refuseAction = (draft, index, reason) => Object.freeze({
    draft, applied: false, reason, index,
});

/**
 * The preinfusion marker as a 0-BASED step index, or -1 for None.
 * A profile that does not carry the key at all also answers -1, and `withMarker` then
 * declines to invent one.
 */
function markerIndex(draft) {
    const raw = draft[VOLUME_COUNT_KEY];
    return Number.isInteger(raw) && raw > 0 ? raw - 1 : -1;
}

/**
 * Write the marker back, 1-based, ONLY onto a profile that already carried it. A profile
 * with no `target_volume_count_start` is not given one here: adding a key a document did
 * not have changes what the server hashes, and this function's job is to stop a reorder
 * changing that field, not to start writing it.
 */
function withMarker(profile, source, marker) {
    if (!Object.prototype.hasOwnProperty.call(source, VOLUME_COUNT_KEY)) return profile;
    return { ...profile, [VOLUME_COUNT_KEY]: marker < 0 ? 0 : marker + 1 };
}

/**
 * Rule 3, applied to a step list this function already owns. Returns the same array, with
 * a NEW step 0 object when it had to change one — the immutability rule at the top of this
 * file is about the objects the surfaces hold, and the caller's step 0 is one of them.
 *
 * IT ONLY LOOKS WHEN STEP 0 ACTUALLY CHANGED, which is `was` for. A move-left onto the
 * first column, a move-right off it and a delete of it are the three ways a HOLD step can
 * be PROMOTED to first; an insert or a duplicate further along cannot be (they land at
 * index + 1, which is never 0 — Slate makes the same observation and skips the check on
 * those two paths for the same reason). Running it unconditionally would let an unrelated
 * press quietly rewrite a leading HOLD that arrived in a foreign profile, and a press that
 * silently edits a step nobody touched is its own small bug.
 */
function withoutLeadingHold(steps, was) {
    if (steps[0] === was) return steps;
    if (steps[0] && steps[0].transition === HOLD_TRANSITION) {
        steps[0] = { ...steps[0], transition: 'fast' };
    }
    return steps;
}

/**
 * A DUPLICATE IS AN INDEPENDENT STEP, not a second reference to the same one.
 *
 * A shallow spread would leave the copy sharing its `limiter` and `exit` objects with the
 * original, and today that would survive by luck: `applyStepValue` rebuilds the limiter
 * (`{...held, value}`) rather than writing into it. It would stop surviving the moment
 * anything wrote through one — and `seedStepForPump` DOES (`step.limiter.value =
 * clamp(...)`, which is why `applyStepValue`'s pump branch copies the limiter before
 * calling it). Two steps that silently edit each other is a bug nobody would look for.
 * Slate copies with `JSON.parse(JSON.stringify(...))` for the same reason; this copies the
 * two keys a step actually nests, which keeps `undefined` and a Date-free document intact.
 */
function copyStep(step) {
    const copy = { ...step };
    if (isObject(step.limiter)) copy.limiter = { ...step.limiter };
    if (isObject(step.exit)) copy.exit = { ...step.exit };
    return copy;
}

/**
 * `step-action` — one of the five keys under a step column was pressed.
 *
 * @param {object|null} draft
 * @param {{action:string, index:number}} detail  the rail's own detail (its `count` is the
 *        rail's view of the list and is deliberately NOT trusted here: the draft's own
 *        length is the fact, and the two can differ for one frame after any other edit)
 * @param {{stepName?: string}} words  the caller's TRANSLATED name for a brand-new step.
 *        D2 — this module has no `t()` and must not grow one; see `profile-modes.js`
 *        NEW_STEP_NAME_KEY for why the word crosses the boundary rather than the key.
 * @returns {{draft:object|null, applied:boolean, reason:string|null, index:number}}
 *        `index` is WHERE THE PERSON NOW IS: the step that moved, the step that took a
 *        deleted one's place, or the step that was just created. On a refusal it is the
 *        index that was asked for, unchanged, so a caller can leave the caret alone.
 */
export function applyStepAction(draft, { action, index } = {}, { stepName = '' } = {}) {
    if (!STEP_ACTIONS.includes(action)) {
        return refuseAction(draft, index, `no draft rule for the step action '${action}'`);
    }
    if (!isObject(draft)) return refuseAction(draft, index, 'the draft is not a profile object');
    const steps = Array.isArray(draft.steps) ? draft.steps : null;
    if (!steps) return refuseAction(draft, index, 'the draft carries no steps array');
    /* `insert-after` ALONE MAY BE ASKED FROM −1, AND THAT IS THE ZERO-STEP DOOR (F-033).
     *
     * Every other action names a step that has to exist: you cannot move, delete or
     * duplicate one that is not there. An insert names the GAP AFTER a step, and the gap
     * before the first one is a real place — `at = index + 1` makes −1 mean "at 0" with no
     * second branch. That is what the matrix's empty-area plus asks for on a profile with
     * no steps at all, where "Insert step after" cannot exist because there is no column to
     * hang a key rail on. Ben, 29 August 2026 (intent review, L0129): "a tap in the panel's
     * empty step area creates a new step there — including on a profile with no steps at
     * all." Before this, that profile was a dead end: rule 1 below stops a person DELETING
     * their way into it, but a profile that ARRIVES with no steps had no way back out. */
    const floor = action === 'insert-after' ? -1 : 0;
    if (!Number.isInteger(index) || index < floor || index >= steps.length) {
        return refuseAction(draft, index, `no step at index ${index}`);
    }

    const next = steps.slice();
    let marker = markerIndex(draft);
    let here = index;

    if (action === 'move-left' || action === 'move-right') {
        const to = action === 'move-left' ? index - 1 : index + 1;
        if (to < 0 || to >= next.length) {
            return refuseAction(draft, index,
                `step ${index + 1} is already at that end, so '${action}' has nowhere to go`);
        }
        const moved = next[index];
        next[index] = next[to];
        next[to] = moved;
        if (marker === index) marker = to;
        else if (marker === to) marker = index;
        here = to;
    } else if (action === 'delete') {
        if (next.length <= MIN_PROFILE_STEPS) {
            return refuseAction(draft, index,
                'the last step cannot be deleted — a profile with no steps has no step '
                + 'columns, so it has no action rail either and there is no way back');
        }
        next.splice(index, 1);
        if (marker === index) marker = -1;
        else if (marker > index) marker -= 1;
        /* THE CARET LANDS ON WHATEVER TOOK THIS COLUMN'S PLACE — the step that shifted
         * left into it, or the new last step when the deleted one was the last. */
        here = Math.min(index, next.length - 1);
    } else {
        /* insert-after and duplicate: the same slot, two different steps to put in it.
         * INSERT SEEDS rather than copying its neighbour, which is Slate's own choice
         * (`insertStep` calls `makeNewStep()`), and the seed is the one `profile-modes.js`
         * declares — the same object a brand-new profile opens with, so there is exactly
         * one answer to "what does a fresh step look like". */
        const at = index + 1;
        next.splice(at, 0, action === 'duplicate'
            ? copyStep(steps[index])
            : newStep({ name: stepName }));
        if (marker >= at) marker += 1;
        here = at;
    }

    const withSteps = { ...draft, steps: withoutLeadingHold(next, steps[0]) };
    return Object.freeze({
        draft: withMarker(withSteps, draft, marker),
        applied: true,
        reason: null,
        index: here,
    });
}

/**
 * THE RENAME'S BODY, and the one place the reasoning behind it is written down.
 *
 * A rename is a metadata-class edit: `profile_hash.dart calculateProfileHash`'s input set
 * at pin 2b047d02 is {version, beverage_type, steps, tank_temperature, target_weight,
 * target_volume, target_volume_count_start} and `calculateMetadataHash`'s is {title,
 * author, notes} — so a PUT carrying a profile whose ONLY difference from the served one
 * is its title recomputes to the same record id and `ProfileController.update` takes its
 * `_storage.update` branch (the branch that keeps the record). THAT IS NOT WHAT IS RELIED
 * ON HERE, because relying on it would be exactly the B10 defect — the client predicting a
 * server-side hash rule. What is relied on is a fact about the BYTES: the body is the
 * record the server itself served, with one string changed, so the client is not asking
 * for a content change at all. The server's answer is then reported rather than assumed
 * (`editor-commit.js saveReportFrom`).
 *
 * BUILT FROM THE BASELINE, NOT FROM THE WORKING DRAFT, for the same reason: a rename must
 * not smuggle a half-finished step edit onto the server under a label edit's name. The
 * unsaved content changes stay unsaved and stay counted.
 *
 * @param {object|null} baseline  `record.profile` as the server last served it
 * @param {string} title
 * @returns {object|null} the body's profile, or null when there is nothing to rename
 */
export function renameBody(baseline, title) {
    if (!isObject(baseline)) return null;
    const wanted = typeof title === 'string' ? title.trim() : '';
    if (wanted === '') return null;
    return { ...baseline, title: wanted };
}
