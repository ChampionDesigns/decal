/**
 * The model layer of.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    AUTHORING_RANGES,
    EXIT_SLOT_ORDER,
    EXIT_VERB,
    EXIT_RANGE_NAMES,
    exitBand,
    exitConditionChoices,
    exitSlotRanges,
    exitTypeLabel,
    exitVerb,
    formatExitValue,
    loadedConditionType,
    occupiedSlots,
    offeredSlots,
    rangeForSlot,
    serializeExitSlots,
} from '../src/lib/exit-sentence.js';
import { REA_EXIT_TYPES } from '../src/data/rea-profile.js';
import { deadExitReason } from '../src/lib/exit-validity.js';

const DEAD_FLOW_STEP = Object.freeze({
    pump: 'pressure',
    exit: { type: 'flow', condition: 'under', value: 0 },
    volume: 100,
});

const PRESSURE_STEP = Object.freeze({
    pump: 'flow',
    exit: { type: 'pressure', condition: 'over', value: 4.5 },
    volume: 100,
});

const EMPTY_STEP = Object.freeze({ pump: 'flow' });

describe('Appendix 9 — the exit band has exactly three slots, always', () => {
    const cases = [
        ['an empty step', EMPTY_STEP],
        ['one threshold and a volume', PRESSURE_STEP],
        ['a dead threshold', DEAD_FLOW_STEP],
        ['every slot occupied', { pump: 'flow', exit: { type: 'pressure', condition: 'over', value: 6 }, volume: 36, weight: 18 }],
        ['null', null],
        ['garbage', { pump: 'nonsense', exit: { type: 'gravity', value: 9.8 }, volume: 'x', weight: -4 }],
    ];

    for (const [name, step] of cases) {
        test(`${name} still gives Condition, Volume, Weight in that order`, () => {
            const band = exitBand(step, { powerExitOffered: true });
            assert.equal(band.length, 3);
            assert.deepEqual(band.map((slot) => slot.slot), [...EXIT_SLOT_ORDER]);
        });
    }

    test('the band and every slot are frozen — a consumer cannot edit the model in place', () => {
        const band = exitBand(PRESSURE_STEP);
        assert.ok(Object.isFrozen(band));
        for (const slot of band) assert.ok(Object.isFrozen(slot));
    });

    test('rendering never mutates the step (a foreign profile round-trips)', () => {
        const step = { pump: 'flow', exit: { type: 'power', condition: 'over', value: 7 }, volume: 0 };
        const before = JSON.stringify(step);
        exitBand(step, { powerExitOffered: true });
        serializeExitSlots(step, { powerExitOffered: true });
        offeredSlots(step, { powerExitOffered: true });
        assert.equal(JSON.stringify(step), before);
    });

    test('occupied and offered partition the three slots and never overlap', () => {
        for (const [, step] of cases) {
            const occupied = occupiedSlots(step, { powerExitOffered: true });
            const offered = offeredSlots(step, { powerExitOffered: true });
            const names = new Set([...occupied, ...offered].map((slot) => slot.slot));
            assert.equal(names.size, occupied.length + offered.length, 'a slot appeared twice');
            assert.ok(occupied.length + offered.length <= EXIT_SLOT_ORDER.length);
        }
    });
});

describe('B2 — every bound is the one table, by object identity', () => {
    test('the condition slot hands out the very AUTHORING_RANGES entry', () => {
        for (const type of REA_EXIT_TYPES) {
            const step = { pump: 'lever', exit: { type, condition: 'over', value: 1 } };
            const [slot] = occupiedSlots(step, { powerExitOffered: true });
            const expected = {
                pressure: AUTHORING_RANGES.exitPressure,
                flow: AUTHORING_RANGES.exitFlow,
                power: AUTHORING_RANGES.exitPower,
            }[type];
            assert.equal(slot.range, expected, `${type} range is a COPY, not the table`);
        }
    });

    test('the scalar slots hand out the very AUTHORING_RANGES entry', () => {
        const step = { pump: 'flow', volume: 100, weight: 36 };
        const ranges = exitSlotRanges(step);
        assert.equal(ranges.volume, AUTHORING_RANGES.volume);
        assert.equal(ranges.weight, AUTHORING_RANGES.weight);
    });

    test('an unoccupied slot can still be priced from the same table', () => {
        assert.equal(rangeForSlot('volume'), AUTHORING_RANGES.volume);
        assert.equal(rangeForSlot('weight'), AUTHORING_RANGES.weight);
        assert.equal(rangeForSlot('condition', 'power'), AUTHORING_RANGES.exitPower);
        assert.equal(rangeForSlot('condition'), null);
        assert.equal(rangeForSlot('nonsense'), null);
    });

    test('every name in EXIT_RANGE_NAMES exists in the one table', () => {
        for (const name of EXIT_RANGE_NAMES) {
            assert.ok(AUTHORING_RANGES[name], `${name} is not a row of AUTHORING_RANGES`);
        }
    });

    test('max and step come from the range, never from the slot', () => {
        const [slot] = occupiedSlots(PRESSURE_STEP);
        assert.equal(slot.max, slot.range.max);
        assert.equal(slot.step, slot.range.step);
        assert.equal(slot.unit, slot.range.unit);
    });
});

describe('Gate 2 — exit types are the address layer\'s, not a typed literal', () => {
    test('only REA_EXIT_TYPES can occupy the condition slot', () => {
        for (const type of REA_EXIT_TYPES) {
            assert.equal(loadedConditionType({ exit: { type, value: 1 } }), type);
        }
        /* ReaPrime models stop-at-weight as step.weight, not as an exit type
         * (rea-profile.js:99-104), so a {type:'weight'} exit is NOT a condition. */
        assert.equal(loadedConditionType({ exit: { type: 'weight', value: 36 } }), null);
        assert.equal(loadedConditionType({ exit: { type: 'off' } }), null);
        assert.equal(loadedConditionType({ exit: null }), null);
        assert.equal(loadedConditionType(null), null);
    });

    test('a type outside the model renders no sentence rather than a blank subject', () => {
        const band = exitBand({ pump: 'flow', exit: { type: 'gravity', value: 9.8 } });
        assert.equal(band[0].occupied, false);
    });

    test('the choices are offered in the address layer\'s own order', () => {
        const choices = exitConditionChoices({ pump: 'lever' }, true);
        const order = choices.map((type) => REA_EXIT_TYPES.indexOf(type));
        assert.deepEqual(order, [...order].sort((a, b) => a - b));
    });
});

describe('exitConditionChoices — ported from profile_editor.js:1414-1424', () => {
    const table = [
        // pump,       powerExitOffered, expected
        ['flow', false, ['pressure']],
        ['flow', true, ['pressure', 'power']],
        ['pressure', false, ['flow']],
        ['pressure', true, ['flow', 'power']],
        ['lever', false, ['flow']],
        ['lever', true, ['flow', 'power']],
        ['power', false, ['pressure', 'flow']],
        ['power', true, ['pressure', 'flow']],
        [undefined, false, ['pressure', 'flow']],
    ];

    for (const [pump, offered, expected] of table) {
        test(`pump=${pump} powerExitOffered=${offered} -> ${expected.join('/')}`, () => {
            assert.deepEqual(exitConditionChoices({ pump }, offered), expected);
        });
    }

    test('a step never exits on the channel it is controlling', () => {
        for (const pump of ['pressure', 'flow']) {
            assert.ok(!exitConditionChoices({ pump }, true).includes(pump));
        }
    });

    test('a loaded type is always included — degrade VISIBLY, never demote', () => {
        // A power exit on a machine that does not offer power exits.
        const step = { pump: 'flow', exit: { type: 'power', condition: 'over', value: 7 } };
        const choices = exitConditionChoices(step, false, 'power');
        assert.ok(choices.includes('power'));
        // …and it renders full fidelity.
        const [slot] = occupiedSlots(step, { powerExitOffered: false });
        assert.equal(slot.type, 'power');
        assert.equal(slot.value, 7);
        assert.equal(slot.range, AUTHORING_RANGES.exitPower);
    });

    test('the offer gate controls only the ADD menu', () => {
        const step = { pump: 'flow' };
        assert.deepEqual(offeredSlots(step, { powerExitOffered: false })[0].choices, ['pressure']);
        assert.deepEqual(offeredSlots(step, { powerExitOffered: true })[0].choices, ['pressure', 'power']);
    });

    test('a condition slot with no legal choice is not offered at all', () => {
        /* A power step on a machine with no power exit: pressure and flow are both
         * legal, so this cannot happen today — construct the empty case directly. */
        assert.deepEqual(exitConditionChoices({ pump: 'power' }, false), ['pressure', 'flow']);
        const band = exitBand({ pump: 'power' }, { powerExitOffered: false });
        assert.equal(band[0].choices.length, 2);
    });
});

describe('the sentence', () => {
    test('a threshold carries a comparator; an accumulator carries the neutral verb', () => {
        const over = occupiedSlots(PRESSURE_STEP)[0];
        assert.equal(over.verb, EXIT_VERB.over);
        assert.equal(exitVerb(over), 'rises past');

        const under = occupiedSlots(DEAD_FLOW_STEP)[0];
        assert.equal(under.verb, EXIT_VERB.under);
        assert.equal(exitVerb(under), 'falls below');

        const volume = occupiedSlots(PRESSURE_STEP)[1];
        assert.equal(volume.verb, EXIT_VERB.accumulate);
        assert.equal(volume.condition, null);
        assert.equal(exitVerb(volume), 'reaches');
    });

    test('an unknown condition word reads as "over", Slate\'s seed default', () => {
        const [slot] = occupiedSlots({ pump: 'flow', exit: { type: 'pressure', value: 3 } });
        assert.equal(slot.condition, 'over');
    });

    test('the subject is the ONE label table', () => {
        assert.equal(exitTypeLabel('pressure'), 'Pressure');
        assert.equal(exitTypeLabel('flow'), 'Flow');
        assert.equal(exitTypeLabel('power'), 'Power');
        assert.equal(exitTypeLabel(null), '');
        assert.equal(occupiedSlots(PRESSURE_STEP)[0].subject, 'Pressure');
        assert.equal(occupiedSlots(PRESSURE_STEP)[1].subject, 'Volume');
    });

    test('the value reads at its own range\'s precision — the three oracle strings', () => {
        assert.equal(formatExitValue(4.5, 0.1), '4.5');
        assert.equal(formatExitValue(0, 0.1), '0.0');
        assert.equal(formatExitValue(100, 1), '100');
    });

    test('a non-number renders nothing rather than NaN', () => {
        assert.equal(formatExitValue(undefined, 0.1), '');
        assert.equal(formatExitValue('x', 1), '');
    });
});

describe('O5 — the dead-exit flag, and its deliberate conservatism', () => {
    test('"flow falls below 0.0" is flagged, and says what will end the step instead', () => {
        const [slot] = occupiedSlots(DEAD_FLOW_STEP);
        assert.equal(slot.dead, true);
        assert.equal(slot.deadReason, 'never fires — cannot fall below zero');
        assert.equal(slot.note, 'ends on 100 mL');
    });

    test('"rises past 0" is flagged the other way — it fires immediately', () => {
        const [slot] = occupiedSlots({ pump: 'flow', exit: { type: 'pressure', condition: 'over', value: 0 } });
        assert.equal(slot.dead, true);
        assert.equal(slot.deadReason, 'fires immediately — already past zero');
        assert.equal(slot.note, 'nothing else ends this step');
    });

    test('a TARGET of 0.0 mL/s is NOT flagged — the zero-flow bloom is a real technique', () => {
        const bloom = { pump: 'flow', flow: 0, exit: { type: 'pressure', condition: 'over', value: 4 }, seconds: 30 };
        const [slot] = occupiedSlots(bloom);
        assert.equal(slot.dead, false, 'the bloom step was flagged — O5 has been "improved" and is now wrong');
        assert.equal(slot.deadReason, null);
    });

    test('a live threshold is not flagged', () => {
        assert.equal(occupiedSlots(PRESSURE_STEP)[0].dead, false);
        assert.equal(deadExitReason(PRESSURE_STEP.exit), null);
    });

    test('"falls below" floors at one increment so the dead value cannot be dialled in', () => {
        const [under] = occupiedSlots(DEAD_FLOW_STEP);
        assert.equal(under.min, AUTHORING_RANGES.exitFlow.step);
        const [over] = occupiedSlots(PRESSURE_STEP);
        assert.equal(over.min, 0);
    });

    test('a scalar slot is never flagged — it has no comparator to be wrong about', () => {
        const volume = occupiedSlots(PRESSURE_STEP)[1];
        assert.equal(volume.dead, false);
        assert.equal(volume.note, null);
    });
});

describe('C8 — the serialisation seam, re-provided as a plain function', () => {
    const REQUIRED = [
        'slot', 'type', 'field', 'subject', 'verb', 'condition',
        'value', 'text', 'unit', 'min', 'max', 'step',
        'dead', 'deadReason', 'note', 'sentence',
    ];

    test('every record carries every field the hidden control set carried', () => {
        for (const record of serializeExitSlots(DEAD_FLOW_STEP)) {
            for (const key of REQUIRED) {
                assert.ok(key in record, `the seam dropped "${key}" — a hidden control encoded it`);
            }
        }
    });

    test('the seam answers with no DOM, no element and no first paint', () => {
        assert.equal(typeof globalThis.document, 'undefined', 'this suite must run without a DOM');
        const records = serializeExitSlots(PRESSURE_STEP);
        assert.equal(records.length, 2);
        assert.equal(records[0].sentence, 'Pressure rises past 4.5 bar');
        assert.equal(records[1].sentence, 'Volume reaches 100 mL');
    });

    test('the seam and the sentence are ONE source — the record IS what renders', () => {
        for (const step of [PRESSURE_STEP, DEAD_FLOW_STEP]) {
            const slots = occupiedSlots(step);
            const records = serializeExitSlots(step);
            assert.equal(records.length, slots.length);
            records.forEach((record, i) => {
                const slot = slots[i];
                assert.equal(record.sentence, `${slot.subject} ${slot.verb} ${record.text} ${slot.unit}`);
                assert.equal(record.text, formatExitValue(slot.value, slot.step));
                assert.equal(record.min, slot.min);
                assert.equal(record.max, slot.max);
                assert.equal(record.step, slot.step);
                assert.equal(record.condition, slot.condition);
            });
        }
    });

    test('the flow sentence the oracle caught, from the model alone', () => {
        const [record] = serializeExitSlots(DEAD_FLOW_STEP);
        assert.equal(record.sentence, 'Flow falls below 0.0 mL/s');
        assert.equal(record.dead, true);
    });

    test('an empty band serialises to an empty list, not to a placeholder', () => {
        assert.deepEqual(serializeExitSlots(EMPTY_STEP), []);
        assert.deepEqual(serializeExitSlots(null), []);
    });

    test('records are frozen — the seam reports, it does not hand out state', () => {
        for (const record of serializeExitSlots(PRESSURE_STEP)) {
            assert.ok(Object.isFrozen(record));
        }
    });
});
