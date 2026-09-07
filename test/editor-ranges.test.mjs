/**
 *.5, item one-ranges-table.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    createEditorRanges,
    enumerateEditorRangeRequests,
    EDITOR_RANGE_FIELDS,
    EDITOR_RANGE_FIELD_IDS,
    UNRANGED_EDITOR_FIELDS,
    RANGE_SOURCES,
    R2_INTERIM,
} from '../src/lib/editor-ranges.js';
import { limitsFor, MACHINE_CLASSES, LIMIT_KEYS } from '../src/lib/machine-limits.js';
import {
    AUTHORING_RANGES, authoringRangesFor, MACHINE_DEPENDENT_AUTHORING_RANGES,
    PUMP_MODE_CYCLE, modeRanges, reviewStepSpec,
} from '../src/lib/profile-modes.js';
import { r2MachineLimits, machineClassFromServedSet } from '../src/data/adapters-r.js';

const BENGLE = limitsFor('bengle');
const DE1 = limitsFor('de1');

const doorFor = (limits, machineClass = null) => createEditorRanges({
    machineLimits: limits, machineClass,
});

/** Every entry of both tables, as REFERENCES, so identity can be counted. */
function tableEntries(machineLimits, machineClass = null) {
    const out = [];
    for (const [name, range] of Object.entries(authoringRangesFor(machineClass))) {
        out.push({ table: `AUTHORING_RANGES[${machineClass ?? 'class unknown'}]`, name, range });
    }
    for (const [name, range] of Object.entries(machineLimits)) {
        out.push({ table: 'machine-limits', name, range });
    }
    return out;
}

describe('B2 — every editor field resolves to exactly one table entry', () => {
    const door = doorFor(BENGLE, 'bengle');
    const requests = enumerateEditorRangeRequests();

    test('the enumeration covers every declared field, and every request resolves', () => {
        assert.equal(EDITOR_RANGE_FIELDS.length, 16, 'the editor has sixteen ranged fields');
        assert.equal(new Set(requests.map((r) => r.field)).size, EDITOR_RANGE_FIELD_IDS.length);
        assert.equal(requests.length, 24, 'sixteen fields, four pump modes and three exit types');
        for (const { field, ctx } of requests) {
            assert.ok(door.rangeFor(field, ctx), `${field} resolved nothing`);
        }
    });

    for (const machineClass of [...MACHINE_CLASSES, null]) {
        const forClass = doorFor(limitsFor(machineClass), machineClass);
        const entries = tableEntries(limitsFor(machineClass), machineClass);
        const who = machineClass ?? 'class unknown';
        for (const { field, ctx } of enumerateEditorRangeRequests()) {
            const label = Object.keys(ctx).length ? `${field} ${JSON.stringify(ctx)}` : field;
            test(`${label} is exactly one entry of one table (${who})`, () => {
                const range = forClass.rangeFor(field, ctx);
                const hits = entries.filter((e) => Object.is(e.range, range));
                assert.equal(hits.length, 1,
                    `${label} matched ${hits.length} table entries by identity `
                    + `(${hits.map((h) => `${h.table}.${h.name}`).join(', ') || 'none — it is a COPY or an invention'})`);
                assert.ok(Number.isFinite(range.min) && Number.isFinite(range.max),
                    `${label} resolved a range with no numeric bounds`);
                assert.ok(range.max > range.min, `${label} resolved an inverted range`);
                assert.ok(Object.isFrozen(range), `${label} resolved a mutable range`);
            });
        }
    }

    test('the two tables are disjoint by field — no LIMIT_KEY is an AUTHORING_RANGES name', () => {
        for (const key of LIMIT_KEYS) {
            assert.ok(!Object.hasOwn(AUTHORING_RANGES, key),
                `${key} is declared in both tables — that is the B2 defect itself`);
        }
    });

    test('each source in a row is one this module actually implements', () => {
        for (const row of EDITOR_RANGE_FIELDS) {
            assert.ok(RANGE_SOURCES.includes(row.source), `${row.field}: unknown source ${row.source}`);
        }
    });

    test('a field is declared once — a second row for the same field is the defect', () => {
        assert.equal(new Set(EDITOR_RANGE_FIELD_IDS).size, EDITOR_RANGE_FIELDS.length);
    });

    test('two fields may share one entry, and volume is that case', () => {
        assert.ok(Object.is(door.rangeFor('stepVolume'), door.rangeFor('targetVolume')));
        assert.ok(Object.is(door.rangeFor('stepVolume'), door.rangeFor('exitVolume')));
        assert.ok(Object.is(door.rangeFor('stepWeight'), door.rangeFor('exitWeight')));
    });
});

describe('a field with no entry is refused, never defaulted', () => {
    const door = doorFor(BENGLE);

    test('an undeclared field throws and names the declared set', () => {
        assert.throws(() => door.rangeFor('grindSetting'), /not an editor field with a range/);
        assert.throws(() => door.rangeFor('grindSetting'), /never a number/);
    });

    for (const row of UNRANGED_EDITOR_FIELDS) {
        test(`${row.field} is declared unranged and throws with its reason`, () => {
            assert.ok(!door.has(row.field));
            assert.throws(() => door.rangeFor(row.field), /has no range ON PURPOSE/);
            assert.throws(() => door.rangeFor(row.field), /Do not give it a literal/);
        });
    }

    test('tankTemperature reads the machine\'s own tankTemp row, not a literal', () => {
        assert.ok(LIMIT_KEYS.includes('tankTemp'), 'the settings page needs the machine row');
        assert.ok(Object.hasOwn(BENGLE, 'tankTemp'));
        assert.ok(door.has('tankTemperature'), 'the profile field is ranged now');
        assert.deepEqual(door.rangeFor('tankTemperature'), BENGLE.tankTemp,
            'the editor reads the machine row itself, never a second table');
    });

    test('a mode-dependent field without a pump refuses rather than picking one', () => {
        assert.throws(() => door.rangeFor('stepTarget'), /mode-dependent/);
        assert.throws(() => door.rangeFor('stepLimiter'), /mode-dependent/);
        //: an unrecognised mode is refused, never read as flow.
        assert.throws(() => door.rangeFor('stepTarget', { pump: 'auger' }), /not a pump mode/);
    });

    test('the exit condition without a type refuses rather than picking pressure', () => {
        assert.throws(() => door.rangeFor('exitCondition'), /exit-type dependent/);
    });

    test('the door itself refuses to exist without an injected machine table', () => {
        assert.throws(() => createEditorRanges(), /must be injected/);
        assert.throws(() => createEditorRanges({}), /second table, which is forbidden/);
    });

    test('an absent machine row is an absence, not a stand-in', () => {
        const unknown = doorFor(limitsFor(null));
        assert.ok(unknown.rangeFor('stepTemperature'));
        assert.ok(!Object.hasOwn(limitsFor(null), 'steamTemp'), 'no steam row without a class');
        const hollow = doorFor(Object.freeze({ brewTemp: BENGLE.brewTemp }));
        assert.throws(() => hollow.rangeFor('targetWeight'), /carries no "drinkWeight" row/);
        assert.throws(() => hollow.rangeFor('targetWeight'), /Never stand a plausible band in/);
    });
});

describe('B3 — the steam numbers, and the two that must appear nowhere', () => {
    test('the floor is 135 on both machine classes', () => {
        assert.equal(BENGLE.steamTemp.floor, 135);
        assert.equal(DE1.steamTemp.floor, 135);
    });

    test('the ceiling is 170 on a Bengle and 160 on a DE1 — the class decides', () => {
        assert.equal(BENGLE.steamTemp.max, 170);
        assert.equal(DE1.steamTemp.max, 160);
    });

    test('zero is reachable and means the heater is off — the band has a hole, not a floor of 135', () => {
        assert.equal(BENGLE.steamTemp.min, 0);
        assert.equal(BENGLE.steamTemp.floor, 135);
        assert.equal(BENGLE.steamTemp.zeroMeans, undefined,
            'the toggle says it now; a hint that says it too is the page saying it twice');
    });

    test('130 is not a bound of any range on the editor’s path', () => {
        const seen = [];
        for (const machineClass of [...MACHINE_CLASSES, null]) {
            const limits = limitsFor(machineClass);
            const door = doorFor(limits);
            for (const { field, ctx } of enumerateEditorRangeRequests()) {
                seen.push([`door.${field}`, door.rangeFor(field, ctx)]);
            }
            for (const [name, range] of Object.entries(limits)) seen.push([`machine.${name}`, range]);
        }
        for (const [name, range] of Object.entries(AUTHORING_RANGES)) seen.push([`authoring.${name}`, range]);

        for (const [name, range] of seen) {
            for (const key of ['min', 'max', 'step', 'floor']) {
                const value = range[key];
                if (value === undefined) continue;
                assert.notEqual(value, 130, `${name}.${key} is 130 — the retired dead-band floor`);
            }
        }
        assert.ok(seen.length >= 60, `expected a real sweep, walked ${seen.length} ranges`);
    });
});

describe('the Bengle flow-ceiling lift, through the door (27 August 2026)', () => {
    const bengleDoor = doorFor(BENGLE, 'bengle');
    const de1Door = doorFor(DE1, 'de1');
    const unknownDoor = doorFor(limitsFor(null), null);

    const flowTarget = (door) => door.rangeFor('stepTarget', { pump: 'flow' });
    const flowLimit = (door) => door.rangeFor('stepLimiter', { pump: 'pressure' });

    test('a flow step reaches 20 mL/s on a Bengle, 15 on a DE1', () => {
        assert.equal(flowTarget(bengleDoor).max, 20);
        assert.equal(flowTarget(de1Door).max, 15);
    });

    test("a pressure step's FLOW LIMIT reaches 20 mL/s on a Bengle, 8 on a DE1", () => {
        assert.equal(flowLimit(bengleDoor).max, 20);
        assert.equal(flowLimit(de1Door).max, 8);
    });

    test('an unresolved machine gets the DE1 numbers — the narrower band, which nests', () => {
        assert.equal(flowTarget(unknownDoor).max, 15);
        assert.equal(flowLimit(unknownDoor).max, 8);
        assert.ok(flowTarget(unknownDoor).max <= flowTarget(bengleDoor).max);
        assert.ok(flowLimit(unknownDoor).max <= flowLimit(bengleDoor).max);
        assert.ok(!Object.hasOwn(limitsFor(null), 'steamTemp'),
            'and the machine table still answers ITS unknown class with absence — two rules, both stated');
    });

    test('nothing else moves with them — the other bounds are the same object on both machines', () => {
        for (const { field, ctx } of enumerateEditorRangeRequests()) {
            const a = bengleDoor.rangeFor(field, ctx);
            const b = de1Door.rangeFor(field, ctx);
            const machineDependent =
                (field === 'stepTarget' && ctx.pump === 'flow')
                || (field === 'stepLimiter' && ctx.pump === 'pressure')
                // the machine table's own rows differ by class too; brewTemp does not
                || field === 'stepTemperature' || field === 'targetWeight';
            if (machineDependent) continue;
            assert.ok(Object.is(a, b), `${field} ${JSON.stringify(ctx)} differs by machine class`);
        }
        assert.ok(Object.is(bengleDoor.rangeFor('exitCondition', { exitType: 'flow' }),
            de1Door.rangeFor('exitCondition', { exitType: 'flow' })));
        assert.equal(bengleDoor.rangeFor('exitCondition', { exitType: 'flow' }).max, 8);
    });

    test('the numpad takes the SAME ceiling as the stepper, per machine', () => {
        for (const door of [bengleDoor, de1Door, unknownDoor]) {
            assert.equal(door.numpadLimitsFor('stepTarget', { pump: 'flow' }).max,
                flowTarget(door).max);
            assert.equal(door.numpadLimitsFor('stepLimiter', { pump: 'pressure' }).max,
                flowLimit(door).max);
        }
        assert.equal(bengleDoor.numpadLimitsFor('stepTarget', { pump: 'flow' }).max, 20);
    });

    test('the review sentence prints the ceiling the stepper offers, on the same machine', () => {
        for (const door of [bengleDoor, de1Door, unknownDoor]) {
            const machineClass = door.machineClass();
            const step = {
                name: 'infuse', pump: 'flow', flow: 4, seconds: 30, temperature: 92,
                transition: 'fast', sensor: 'coffee', limiter: { value: 6 },
            };
            const slots = reviewStepSpec(step, {
                machineRanges: door.machineRangesForReview(), machineClass,
            }).flat().filter((seg) => seg[0] === 'num');
            const target = slots.find((seg) => seg[1] === 'flow');
            assert.equal(target[6], flowTarget(door).max,
                `the review's flow ceiling disagrees with the stepper on ${machineClass ?? 'an unknown machine'}`);
            assert.equal(target[6], modeRanges('flow', machineClass).target.max);
        }
    });

    test('the class is the SERVED capability answer, never a machine name (A3)', () => {
        assert.equal(machineClassFromServedSet([{ id: 'machine' }]), 'bengle');
        assert.equal(machineClassFromServedSet([]), 'de1');
        assert.equal(machineClassFromServedSet(null), null);
        const served = [{ id: 'machine' }];
        const door = doorFor(r2MachineLimits(served).value, machineClassFromServedSet(served));
        assert.equal(flowTarget(door).max, 20, 'a served Bengle answer reaches the flow ceiling');
        assert.equal(door.machineClass(), 'bengle');
        assert.throws(() => doorFor(BENGLE, 'Bengle'), /not a machine class/);
        assert.throws(() => doorFor(BENGLE, 'DE1 v1.3'), /never a model name/);
    });

    test('the door reports the class it resolved against, and defaults to not-known', () => {
        assert.equal(bengleDoor.machineClass(), 'bengle');
        assert.equal(de1Door.machineClass(), 'de1');
        assert.equal(unknownDoor.machineClass(), null);
        assert.equal(doorFor(BENGLE).machineClass(), null, 'no class stated is not-known, not Bengle');
    });

    test('the two moved rows are the ones profile-modes declares machine-dependent', () => {
        assert.deepEqual([...MACHINE_DEPENDENT_AUTHORING_RANGES].sort(),
            ['flowTarget', 'stepFlowLimit']);
        assert.ok(Object.is(flowTarget(bengleDoor), authoringRangesFor('bengle').flowTarget));
        assert.ok(Object.is(flowLimit(bengleDoor), authoringRangesFor('bengle').stepFlowLimit));
        assert.ok(Object.is(flowTarget(unknownDoor), AUTHORING_RANGES.flowTarget));
    });
});

describe('the R2 door is the only way in, and the gap is declared', () => {
    test('the adapter’s answer feeds the door unchanged', () => {
        const answer = r2MachineLimits([{ name: 'bengle-thing' }]);
        assert.equal(answer.known, true);
        const door = doorFor(answer.value);
        assert.ok(Object.is(door.rangeFor('stepTemperature'), answer.value.brewTemp));
        assert.equal(answer.value.steamTemp.max, 170);
    });

    test('an unknown machine class still yields a usable editor table', () => {
        const answer = r2MachineLimits(null);
        assert.equal(answer.known, false);
        const door = doorFor(answer.value);
        assert.ok(door.rangeFor('stepTemperature'));
        assert.ok(door.rangeFor('targetWeight'));
    });

    test('R2 has not landed and the module says so as data', () => {
        assert.equal(R2_INTERIM.landed, false);
        assert.equal(R2_INTERIM.upstream, 'R2');
        assert.equal(R2_INTERIM.checkedCommit, '2b047d02e42e29bf2d96a2aa964ef94e4a4daba3');
        assert.match(R2_INTERIM.note, /interim single table pending R2/);
        assert.equal(doorFor(BENGLE).provenance(), R2_INTERIM);
    });
});

describe('the door hands its answers to the components that take ranges as data', () => {
    const door = doorFor(BENGLE);

    test('reviewStepSpec takes its machine range by injection and accepts this one', () => {
        const step = {
            name: 'infuse', pump: 'flow', flow: 4, seconds: 30, temperature: 92,
            transition: 'fast', sensor: 'coffee', limiter: { value: 6 },
        };
        assert.throws(() => reviewStepSpec(step), /machineRanges/);
        const lines = reviewStepSpec(step, { machineRanges: door.machineRangesForReview() });
        assert.ok(Array.isArray(lines) && lines.length > 0);
    });

    test('the review injection IS the machine table entry, not a copy of it', () => {
        assert.ok(Object.is(door.machineRangesForReview().temperature, BENGLE.brewTemp));
    });

    test('the numpad limits object carries the entry’s own numbers and nothing invented', () => {
        for (const pump of PUMP_MODE_CYCLE) {
            const range = door.rangeFor('stepTarget', { pump });
            const limits = door.numpadLimitsFor('stepTarget', { pump });
            assert.equal(limits.min, range.min);
            assert.equal(limits.max, range.max);
            assert.equal(limits.step, range.step);
            assert.equal(limits.unit, range.unit);
            assert.ok(Object.isFrozen(limits));
        }
    });

    test('a power step’s cap keeps its floor of 1 through the numpad shape', () => {
        // ProfileStepPower.fromJson throws for a null OR zero limiter, so 1 is not a taste.
        const limits = door.numpadLimitsFor('stepLimiter', { pump: 'power' });
        assert.equal(limits.min, 1);
        assert.equal(door.rangeFor('stepLimiter', { pump: 'power' }).mandatory, true);
    });

    test('a flow step’s pressure limit keeps its load-bearing zero', () => {
        assert.equal(door.rangeFor('stepLimiter', { pump: 'flow' }).min, 0);
        assert.equal(door.rangeFor('stepLimiter', { pump: 'pressure' }).min, 0);
    });
});
