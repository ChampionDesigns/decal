/**
 * A profile step's exit condition, as the sentence the editor shows and the slots it is composed from.
 */

import {
    AUTHORING_RANGES,
    authoringRange,
    exitRange,
    PUMP_MODE_LABEL,
} from './profile-modes.js';
import { deadExitReason, exitValueMin, remainingExitsNote } from './exit-validity.js';
import { REA_EXIT_TYPES } from '../data/rea-profile.js';

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

export const EXIT_VERB = Object.freeze({
    over: 'rises past',
    under: 'falls below',
    accumulate: 'reaches',
});

const CONDITION_OF = (exit) => (exit && exit.condition === 'under' ? 'under' : 'over');

export function exitVerb(slot) {
    if (!slot || slot.slot !== 'condition') return EXIT_VERB.accumulate;
    return slot.condition === 'under' ? EXIT_VERB.under : EXIT_VERB.over;
}

export function formatExitValue(value, step) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '';
    const increment = Number(step);
    const decimals = Number.isFinite(increment) && increment > 0 && increment < 1
        ? String(increment).split('.')[1]?.length ?? 0
        : 0;
    return number.toFixed(decimals);
}

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

export function exitTypeLabel(type) {
    return PUMP_MODE_LABEL[type] || type || '';
}

export function loadedConditionType(step) {
    const exit = step ? step.exit : null;
    if (!exit || typeof exit !== 'object') return null;
    return REA_EXIT_TYPES.includes(exit.type) ? exit.type : null;
}

const scalarOf = (raw) => {
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
};

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
