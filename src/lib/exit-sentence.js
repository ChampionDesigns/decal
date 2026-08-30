/**
 * exit-sentence.js — the MODEL LAYER for component #41, "Exit chip / sentence"
 * (SCOPE Part 4 Wave 4, `scope/04-components.md:233`; SCOPE.md:1653).
 *
 * DOM-free, node-testable, and deliberately separate from `ui-exit-sentence.js`:
 * this file is where decision **C8** lands.
 *
 * ===========================================================================
 * C8 — WHY THIS FILE EXISTS AT ALL
 * ===========================================================================
 * Slate builds the exit chip's decomposed controls (comparator toggle, −, value,
 * +, ×) and then hides four of the five with `.pe-chip.has-summary`
 * (`profile-editor-v3.css:695-698`). The verifier established that this is
 * documented intent rather than a defect — `profile_editor.js:1716-1729` says the
 * controls *"stay in the DOM as a serialization/test seam"*, and
 * `LAYOUT_SPEC_DRAFT.md:669-676` records it as **OQ-10**, a recorded decision the
 * rewrite argues against.
 *
 * The register settles it (SCOPE.md:2330-2333, `scope/05-screens.md:564`):
 *
 *   "C8 (accepted), folded in — the exit chip: build only the visible sentence
 *    and its ×, and REPLACE THE SERIALIZATION SEAM EXPLICITLY with a plain
 *    function producing the same value. The old hidden-DOM seam was a workaround
 *    for not having a model layer; the rewrite has one. The seam is deliberately
 *    re-provided, not dropped."
 *
 * `serializeExitSlots()` at the bottom of this file IS that function. Every field
 * the hidden DOM carried — comparator direction, value, unit, min, max, step — is
 * on the record it returns, so anything that would have read the hidden controls
 * reads this instead, and the component's shadow tree contains only what is on
 * screen. `test/render/ui-exit-sentence.render.test.mjs` asserts the second half
 * mechanically ("no hidden control set"), which is the shape of assertion the old
 * arrangement could not have.
 *
 * ===========================================================================
 * B2 — ONE RANGES TABLE, AND THIS FILE OWNS NONE OF IT
 * ===========================================================================
 * `CARRY_FORWARD.md` §3d: three disagreeing authoring-range tables inside
 * `profile_modes.js` alone. SCOPE.md:171 — "until that lands, exactly one table
 * (B2)". Wave 4's `port-profile-modes` unified them, so every min / max / step /
 * unit below is read from `AUTHORING_RANGES` through `exitRange()` and
 * `authoringRange()`. There is not one numeric bound authored in this file, and
 * `test/exit-sentence.test.mjs` asserts that by cross-checking every returned
 * range against the table object identity rather than against a literal.
 *
 * ===========================================================================
 * GATE 2 — ADDRESSING
 * ===========================================================================
 * The one server-shaped fact this module needs is *which exit types ReaPrime's
 * model can express*, and it reads it from the address layer:
 * `REA_EXIT_TYPES` (`src/data/rea-profile.js:69`, "`ExitType` at the pinned
 * commit (`profile.dart`)"). No raw key string is typed here.
 *
 * Note what that list does NOT contain: **volume and weight are not exit types**.
 * `sanitizeProfileForRea` (`rea-profile.js:99-104`) folds `{type:'weight'}` into
 * `step.weight`, and ReaPrime models stop-at-volume the same way. So the band's
 * three slots are one *condition* slot backed by `step.exit` and two *scalar*
 * slots backed by plain step fields — which is exactly why the sentence carries a
 * comparator in one slot and the neutral verb in the other two
 * (`profile_editor.js:1725-1729`).
 *
 * ===========================================================================
 * APPENDIX 9 — THE STABLE THREE SLOTS
 * ===========================================================================
 * `LAYOUT_SPEC_DRAFT.md:1414-1416`: "The exit band's stable three slots —
 * Condition, Volume, Weight, occupied first and add-slots below — so the band
 * never changes height (`layout/editor.md` §7.6)." Carried over deliberately, so
 * `exitBand()` always returns exactly three slots in that order, each either
 * occupied or offered, and never a fourth.
 *
 * ===========================================================================
 * O5 — THE UNSATISFIABLE-EXIT WARNING IS NOT REIMPLEMENTED HERE
 * ===========================================================================
 * `deadExitReason` / `exitValueMin` / `remainingExitsNote` come from
 * `exit-validity.js`, PORT-AS-IS (Part 6, 59 lines). This module calls them and
 * adds nothing: its deliberate conservatism — in particular that it declines to
 * flag a TARGET of 0.0 mL/s, a real zero-flow bloom technique — is a property of
 * that file and must not be "improved" from here.
 */

import {
    AUTHORING_RANGES,
    authoringRange,
    exitRange,
    PUMP_MODE_LABEL,
} from './profile-modes.js';
import { deadExitReason, exitValueMin, remainingExitsNote } from './exit-validity.js';
import { REA_EXIT_TYPES } from '../data/rea-profile.js';

/* ===========================================================================
 * The three slots
 * =========================================================================== */

/**
 * Appendix 9's order, and the only order this band is ever rendered in.
 * `layout/editor.md` §7.6, via `LAYOUT_SPEC_DRAFT.md:1414`.
 */
export const EXIT_SLOT_ORDER = Object.freeze(['condition', 'volume', 'weight']);

/**
 * The two scalar slots, each naming the step field it edits and the range-table
 * entry its bounds come from. The condition slot is not in here because its type
 * is chosen at runtime from `REA_EXIT_TYPES`.
 */
const SCALAR_SLOTS = Object.freeze({
    volume: Object.freeze({ field: 'volume', range: 'volume', subject: 'Volume' }),
    weight: Object.freeze({ field: 'weight', range: 'weight', subject: 'Weight' }),
});

/* ===========================================================================
 * The sentence's three words
 * =========================================================================== */

/**
 * The verbs, as English keys (the i18n key IS its own English text —
 * `i18n/source/README.md`), quoted from `profile_editor.js:1744`
 * (`getTranslation(cmp ? (cmp.directionLabel || 'rises past') : 'reaches')`) and
 * `:1849` (`directionLabel: exit.condition === 'under' ? 'falls below' : 'rises past'`).
 *
 * A threshold can be crossed from either side, so it carries a comparator; an
 * accumulator only ever goes up, so its slot holds the neutral verb instead.
 * Slate's own words for the distinction, at `profile_editor.js:1726-1729`.
 */
export const EXIT_VERB = Object.freeze({
    over: 'rises past',
    under: 'falls below',
    accumulate: 'reaches',
});

/** 'over' unless the step says otherwise. Slate's default on seed, `:1857`
 *  (`if (!s.exit) s.exit = { type, condition: 'over', value: v };`). */
const CONDITION_OF = (exit) => (exit && exit.condition === 'under' ? 'under' : 'over');

/**
 * The verb for one slot record. Split out because the component renders it and
 * `serializeExitSlots` reports it, and two spellings of one word is how the
 * Review path drifted from the editor in the first place (`CARRY_FORWARD.md` §3d).
 */
export function exitVerb(slot) {
    if (!slot || slot.slot !== 'condition') return EXIT_VERB.accumulate;
    return slot.condition === 'under' ? EXIT_VERB.under : EXIT_VERB.over;
}

/**
 * The number as the sentence shows it, at the precision its own range's step
 * implies. Slate's `formatControlValue(value, stp)`; the oracle caught all three
 * cases on screen at once —
 *
 *   CITE editor-steps .pe-chip-summary [i=161] text "Pressurerises past4.5 bar"
 *   CITE editor-steps .pe-chip-summary [i=167] text "Volumereaches100 mL"
 *   CITE editor-steps .pe-chip-summary [i=193] text "Flowfalls below0.0 mL/s"
 *
 * — a 0.1-step channel keeping its tenth even when it is zero, and a 1-step
 * accumulator carrying none.
 */
export function formatExitValue(value, step) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '';
    const increment = Number(step);
    const decimals = Number.isFinite(increment) && increment > 0 && increment < 1
        ? String(increment).split('.')[1]?.length ?? 0
        : 0;
    return number.toFixed(decimals);
}

/* ===========================================================================
 * Which conditions may be offered
 * =========================================================================== */

/**
 * The cross-variable exit types this step may take, in `REA_EXIT_TYPES` order.
 *
 * Ported behaviour-identical from `profile_editor.js:1414-1424`, with the literal
 * type list replaced by the address layer's:
 *   • a step never exits on the channel it is already controlling;
 *   • Power is offered only when the caller says the machine offers it;
 *   • a type the step ALREADY carries is always included, so a loaded advanced
 *     profile renders full-fidelity on a machine that would not offer it —
 *     "degrade visibly" (`profile_editor.js:1830`).
 *
 * `powerExitOffered` is Slate's two-gate ALREADY ANDed by the caller — the skin's
 * `profileModesOffered && (caps & PROFILE_MODE_BIT.powerExit)`. It arrives as one
 * decoded boolean because the mask lives behind R3 (`adapters-r.js:300`,
 * `PROFILE_MODE_BIT.powerExit = 0x8`) and decoding it here would be a second
 * reader of a server word. It is a UI-OFFER HINT ONLY: the authority is
 * ReaPrime's arm-time 400 (B9).
 *
 * @param {{pump?: string}|null} step
 * @param {boolean} powerExitOffered
 * @param {string|null} loadedType  the type already on the step, if any
 */
export function exitConditionChoices(step, powerExitOffered = false, loadedType = null) {
    const pump = step ? step.pump : null;
    const choices = [];
    for (const type of REA_EXIT_TYPES) {
        if (type === 'pressure' && (pump === 'pressure' || pump === 'lever')) continue;
        if (type === 'flow' && pump === 'flow') continue;
        if (type === 'power') {
            const eligiblePump = pump === 'pressure' || pump === 'flow' || pump === 'lever';
            if (!powerExitOffered || !eligiblePump) continue;
        }
        choices.push(type);
    }
    if (loadedType && !choices.includes(loadedType)) choices.unshift(loadedType);
    return choices;
}

/**
 * The face for one exit type — the SAME table the sentence's subject reads
 * (`PUMP_MODE_LABEL`, `profile-modes.js:231`). A second capitalisation rule in a
 * component is how "Flow" and "flow" end up one row apart.
 */
export function exitTypeLabel(type) {
    return PUMP_MODE_LABEL[type] || type || '';
}

/**
 * The one exit `step.exit` expresses, or null. A type outside `REA_EXIT_TYPES`
 * reads as no condition rather than as a sentence with a blank subject — B9 again:
 * the server owns the refusal, and the skin does not invent a face for a word it
 * cannot name.
 */
export function loadedConditionType(step) {
    const exit = step ? step.exit : null;
    if (!exit || typeof exit !== 'object') return null;
    return REA_EXIT_TYPES.includes(exit.type) ? exit.type : null;
}

/* ===========================================================================
 * The band
 * =========================================================================== */

/** A finite positive number, or 0. Slate's `Number(x) || 0` with NaN excluded. */
const scalarOf = (raw) => {
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
};

/**
 * One occupied slot, fully described. Every consumer — the sentence, the aria
 * name, the numpad the screen opens, the seam — reads the same record, so the
 * band cannot disagree with itself about a bound the way three range tables did.
 */
function occupiedCondition(step, type) {
    const exit = step.exit;
    const range = exitRange(type);
    const condition = CONDITION_OF(exit);
    const reason = deadExitReason(exit);
    return Object.freeze({
        slot: 'condition',
        type,
        field: 'exit',
        occupied: true,
        subject: PUMP_MODE_LABEL[type] || type,
        condition,
        verb: condition === 'under' ? EXIT_VERB.under : EXIT_VERB.over,
        value: Number(exit.value) || 0,
        unit: range.unit,
        range,
        /* O5: "falls below" floors at one increment so the dead value cannot be
         * dialled in at all; "rises past" keeps its zero (exit-validity.js:38-43). */
        min: exitValueMin(condition, range.step),
        max: range.max,
        step: range.step,
        dead: reason !== null,
        deadReason: reason,
        note: reason ? remainingExitsNote(step) : null,
    });
}

function occupiedScalar(step, slot) {
    const spec = SCALAR_SLOTS[slot];
    const range = authoringRange(spec.range);
    return Object.freeze({
        slot,
        type: slot,
        field: spec.field,
        occupied: true,
        subject: spec.subject,
        condition: null,
        verb: EXIT_VERB.accumulate,
        value: scalarOf(step[spec.field]),
        unit: range.unit,
        range,
        min: range.min,
        max: range.max,
        step: range.step,
        dead: false,
        deadReason: null,
        note: null,
    });
}

function offeredSlot(slot, choices) {
    const spec = SCALAR_SLOTS[slot];
    return Object.freeze({
        slot,
        type: slot === 'condition' ? null : slot,
        field: spec ? spec.field : 'exit',
        occupied: false,
        subject: spec ? spec.subject : 'Condition',
        /* A condition's legal choices depend on the pump and on a capability bit,
         * so its slot offers a MENU; a scalar slot seeds directly
         * (`profile_editor.js:1916-1919`). */
        choices: slot === 'condition' ? Object.freeze([...choices]) : Object.freeze([]),
    });
}

/**
 * The whole band: exactly three slots, always, in Appendix 9's order.
 *
 * Occupied slots carry their value and bounds; unoccupied ones carry what they
 * would offer. The COMPONENT decides that occupied ones render above and offers
 * below — that is the layout half of Appendix 9 and it belongs in the layout.
 *
 * @param {object|null} step
 * @param {{powerExitOffered?: boolean}} opts
 * @returns {ReadonlyArray<object>} three slot records
 */
export function exitBand(step, { powerExitOffered = false } = {}) {
    const source = step && typeof step === 'object' ? step : {};
    const type = loadedConditionType(source);
    const choices = exitConditionChoices(source, powerExitOffered, type);

    return Object.freeze(EXIT_SLOT_ORDER.map((slot) => {
        if (slot === 'condition') {
            return type ? occupiedCondition(source, type) : offeredSlot('condition', choices);
        }
        return scalarOf(source[SCALAR_SLOTS[slot].field]) > 0
            ? occupiedScalar(source, slot)
            : offeredSlot(slot, choices);
    }));
}

/** The occupied slots, in band order — what renders as sentences. */
export function occupiedSlots(step, opts) {
    return exitBand(step, opts).filter((slot) => slot.occupied);
}

/**
 * The offered slots, in band order — what renders as add slots.
 * A condition slot with no legal choice left is not offered at all.
 */
export function offeredSlots(step, opts) {
    return exitBand(step, opts).filter(
        (slot) => !slot.occupied && (slot.slot !== 'condition' || slot.choices.length > 0),
    );
}

/* ===========================================================================
 * C8 — THE SEAM
 * =========================================================================== */

/**
 * THE SERIALISATION SEAM, re-provided as a plain function (C8).
 *
 * This is the explicit replacement for Slate's hidden decomposed controls. It
 * returns, for every occupied slot, exactly the fields those controls encoded:
 *
 *   `.pe-chip-cmp`  the comparator direction   -> `condition` + `verb`
 *   `.pe-chip-val`  the value and its unit     -> `value`, `text`, `unit`
 *   the ± bounds the chip was built with       -> `min`, `max`, `step`
 *   `.pe-chip-summary`'s rendered sentence     -> `sentence`
 *
 * Two properties make it a seam rather than a formatter:
 *
 *  1. **It reads the step, never the DOM.** So it is correct before first paint,
 *     with the component unmounted, and under `node:test` — none of which was
 *     true of a seam made of hidden elements.
 *  2. **It is the same record the sentence renders from.** The component maps
 *     `exitBand()` onto DOM and this maps the same call onto values, so the two
 *     cannot drift. A test that asserts the rendered sentence equals
 *     `serializeExitSlots(step)[i].sentence` is checking one source against
 *     itself, which is the whole point of the old seam and is what makes the
 *     hidden controls unnecessary.
 *
 * @param {object|null} step
 * @param {{powerExitOffered?: boolean}} opts
 */
export function serializeExitSlots(step, opts) {
    return occupiedSlots(step, opts).map((slot) => {
        const text = formatExitValue(slot.value, slot.step);
        return Object.freeze({
            slot: slot.slot,
            type: slot.type,
            field: slot.field,
            subject: slot.subject,
            verb: slot.verb,
            condition: slot.condition,
            value: slot.value,
            text,
            unit: slot.unit,
            min: slot.min,
            max: slot.max,
            step: slot.step,
            dead: slot.dead,
            deadReason: slot.deadReason,
            note: slot.note,
            sentence: `${slot.subject} ${slot.verb} ${text} ${slot.unit}`,
        });
    });
}

/**
 * The band's ranges, by slot name — the B2 assertion in usable form. Anything
 * that needs bounds (the numpad #53 the screen opens, a stepper, a validator)
 * takes them from here, so there is never a second place to get them wrong.
 */
export function exitSlotRanges(step, opts) {
    const ranges = {};
    for (const slot of exitBand(step, opts)) {
        if (slot.occupied) ranges[slot.slot] = slot.range;
    }
    return ranges;
}

/**
 * The range a slot WOULD take if it were seeded with `type` — the same table,
 * reached before the slot exists, for the add path.
 */
export function rangeForSlot(slot, type = null) {
    if (slot === 'condition') return type ? exitRange(type) : null;
    const spec = SCALAR_SLOTS[slot];
    return spec ? authoringRange(spec.range) : null;
}

/** Every range name this module can reach, for the B2 cross-check in the suite. */
export const EXIT_RANGE_NAMES = Object.freeze([
    'exitPressure', 'exitFlow', 'exitPower', 'volume', 'weight',
]);

/** Re-exported so a consumer never needs a second import to check a name. */
export { AUTHORING_RANGES };
