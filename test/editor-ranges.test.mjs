/**
 * editor-ranges.test.mjs — wave 5.5, item `one-ranges-table` (B2/B3).
 *
 * THE CLAIM UNDER TEST IS TOTALITY, NOT PLAUSIBILITY: every ranged field the profile
 * editor has resolves to exactly ONE entry of the two wave-4 tables, and the check is by
 * OBJECT IDENTITY, not by value. That distinction is the whole point. A second table
 * written by hand would produce ranges that look right and compare equal on min/max while
 * being different objects — which is exactly how `profile_editor.js:489-495` lived
 * alongside `profile_modes.js` for years. `Object.is` cannot be fooled that way: a copied
 * range fails, an invented range fails, a widened range fails.
 *
 * A8: not one assertion here reads a file's text. Every claim is about a VALUE returned by
 * a function, which is the only kind of claim that survives the file being rewritten.
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

/**
 * THE DOOR TAKES THE CLASS AS WELL AS THE TABLE, since 27 August 2026 — the authoring
 * half has two machine-dependent rows of its own now (a flow step's target, a pressure
 * step's flow limit), so a door built with a limits table for one machine and no class at
 * all would resolve half its answers for a machine it was not told about. The default is
 * null on purpose: that is a real state ("the capability read has not landed") and the
 * tests that do not care about the machine keep exercising it.
 */
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
        assert.equal(EDITOR_RANGE_FIELDS.length, 13, 'the editor has thirteen ranged fields');
        assert.equal(new Set(requests.map((r) => r.field)).size, EDITOR_RANGE_FIELD_IDS.length);
        assert.equal(requests.length, 21, 'thirteen fields, four pump modes and three exit types');
        for (const { field, ctx } of requests) {
            assert.ok(door.rangeFor(field, ctx), `${field} resolved nothing`);
        }
    });

    /* THE TOTALITY SWEEP RUNS ON EVERY MACHINE CLASS, AND ON A MACHINE WHOSE CLASS IS NOT
     * KNOWN (27 August 2026). It used to run on one table, which was enough while every
     * authoring row was the same on every machine. Two of them are not any more, and the
     * failure that would slip past a single-class sweep is precisely the one this file
     * exists to catch: a surface holding its own 20 for a Bengle, identical in value to
     * the table's and a different object. `Object.is` against the table FOR THAT CLASS is
     * the only check that can tell those apart. */
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
        // The point of a door: one entry, reached by more than one field. The failure it
        // prevents is the inverse — one field reaching two entries.
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

    /* THE ASSERTION IS INVERTED AND THE POINT IS UNCHANGED (24 Aug 2026).
     *
     * It used to read "tankTemperature has no machine row to fall back to either" and
     * checked that `tankTemp` was absent from the limits table. The table now carries it,
     * because the SETTINGS page needed the machine's tank threshold and hiding a control
     * does not improve the machine's behaviour.
     *
     * THE EDITOR FIELD IS STILL UNRANGED, and that is what this file is about. The two
     * are opposite sides of one MMR write: the machine row is the threshold, the profile
     * field is the value that OVERWRITES it on every load. A range here would be a second
     * surface writing one register through two doors. So the assertion becomes: the
     * machine row exists, and the editor door still refuses. */
    test('tankTemperature refuses even though the machine row now exists', () => {
        assert.ok(LIMIT_KEYS.includes('tankTemp'), 'the settings page needs the machine row');
        assert.ok(Object.hasOwn(BENGLE, 'tankTemp'));
        assert.ok(!door.has('tankTemperature'), 'the PROFILE field is still unranged');
        assert.throws(() => door.rangeFor('tankTemperature'), /has no range ON PURPOSE/);
    });

    test('a mode-dependent field without a pump refuses rather than picking one', () => {
        assert.throws(() => door.rangeFor('stepTarget'), /mode-dependent/);
        assert.throws(() => door.rangeFor('stepLimiter'), /mode-dependent/);
        // A7: an unrecognised mode is refused, never read as flow.
        assert.throws(() => door.rangeFor('stepTarget', { pump: 'auger' }), /not a pump mode/);
    });

    test('the exit condition without a type refuses rather than picking pressure', () => {
        assert.throws(() => door.rangeFor('exitCondition'), /exit-type dependent/);
    });

    test('the door itself refuses to exist without an injected machine table', () => {
        assert.throws(() => createEditorRanges(), /must be injected/);
        assert.throws(() => createEditorRanges({}), /second table B2 forbids/);
    });

    test('an absent machine row is an absence, not a stand-in', () => {
        // limitsFor(null) is the unknown-machine-class table. brewTemp survives (it is
        // machine-independent); a row that were absent would refuse.
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

    /* THE CEILING WENT BACK TO 170 ON BOTH (Ben, 26 August 2026). B3 lowered it to
     * 165/160 from a reading of the machine's band; the bench answered the other way — the
     * live rig serves `steamTargetTemperature` 170 on a Bengle, so 165 was a skin refusing
     * to show the machine's own value, with the plus already greyed at a number ABOVE the
     * one printed beside the label.
     *
     * THE FLOOR AND THE HOLE ARE UNCHANGED, and they are what B3 was really about: the
     * machine enables the steam heater at 135, so 130 is a dead band and stepping down
     * from 135 lands on 0. */
    test('the ceiling is 170 on a Bengle and 160 on a DE1 — the class decides', () => {
        /* THE DE1 WENT BACK TO 160 ON 26 AUGUST 2026 AND THE BENGLE DID NOT — a correction
         * made in `machine-limits.js` by the pass that re-read the evidence, and this
         * assertion had pinned the one-day state where both classes carried 170. That
         * reading was taken on a BENGLE and is evidence about a Bengle; `doc/Skins.md:573`
         * states 135-160 for a DE1, nothing has been measured against one, and
         * `adapters-r.js` returns that class for real users. A ceiling is a safety band, and
         * evidence for one machine is not evidence for another.
         * `test/machine-limits.test.mjs` carries the full argument at the row. */
        assert.equal(BENGLE.steamTemp.max, 170);
        assert.equal(DE1.steamTemp.max, 160);
    });

    test('zero is reachable and means the heater is off — the band has a hole, not a floor of 135', () => {
        /* THE MECHANISM IS UNCHANGED AND THE SENTENCE IS GONE (26 August 2026). `min: 0` and
         * `floor: 135` both stay, so the clamp, the step and the numpad all still work the
         * hole, and the steam page's master switch still writes the zero. What went is
         * `zeroMeans`, which is what `rangeHint` printed as "0 or 135-170 °C" — the page
         * teaching a second way to switch the heater off, directly under a switch that does
         * it. Ben: "no need to have <130 = off, the new toggle has that now."
         *
         * SO THE ZERO IS ASSERTED WHERE IT LIVES, on the band, rather than through the
         * sentence that used to describe it. */
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
                /* 130 STAYS FORBIDDEN — it is the DEAD BAND, and a control that offered
                 * it would write a disabled heater under a number that looks live. 170 is
                 * no longer forbidden: it is the machine's own value (see above). */
                assert.notEqual(value, 130, `${name}.${key} is 130 — the retired dead-band floor`);
            }
        }
        assert.ok(seen.length >= 60, `expected a real sweep, walked ${seen.length} ranges`);
    });
});

describe('the Bengle flow-ceiling lift, through the door (27 August 2026)', () => {
    /* Ben, in the profile editor: "why is flow limited to 15ml/s". Told that the old
     * editor gave a Bengle 20 and that the lift had been dropped on the way into the port:
     * "flow limit goes with it to 20 as well."
     *
     * IT WAS DROPPED BECAUSE THE OLD EDITOR GATED IT ON THE MACHINE'S NAME, which A3
     * forbids, and `profile-modes.js` recorded the shape it would have to return in: "a
     * capability answer applied to THIS table, never a second table". These tests are
     * about that shape as much as about the two numbers — the class enters the editor
     * once, from the served capability answer, and both surfaces read it from there. */

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
        // Nothing the unknown band permits can be refused by a Bengle either, which is the
        // whole justification for choosing a band here rather than going absent as steam does.
        assert.ok(flowTarget(unknownDoor).max <= flowTarget(bengleDoor).max);
        assert.ok(flowLimit(unknownDoor).max <= flowLimit(bengleDoor).max);
        assert.ok(!Object.hasOwn(limitsFor(null), 'steamTemp'),
            'and the machine table still answers ITS unknown class with absence — two rules, both stated');
    });

    test('nothing else moves with them — the other bounds are the same object on both machines', () => {
        // A ceiling that moved a field nobody asked about would be inventing an answer.
        // Identity, not equality: a copy that happens to agree is the second table.
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
        // The flow EXIT threshold is deliberately NOT one of them: Ben named the step's
        // target and the step's flow limit and no third field.
        assert.ok(Object.is(bengleDoor.rangeFor('exitCondition', { exitType: 'flow' }),
            de1Door.rangeFor('exitCondition', { exitType: 'flow' })));
        assert.equal(bengleDoor.rangeFor('exitCondition', { exitType: 'flow' }).max, 8);
    });

    test('the numpad takes the SAME ceiling as the stepper, per machine', () => {
        // The numpad is the surface Ben would actually type 20 into. It takes its bounds
        // as data from this one door, so it cannot be offered a different band.
        for (const door of [bengleDoor, de1Door, unknownDoor]) {
            assert.equal(door.numpadLimitsFor('stepTarget', { pump: 'flow' }).max,
                flowTarget(door).max);
            assert.equal(door.numpadLimitsFor('stepLimiter', { pump: 'pressure' }).max,
                flowLimit(door).max);
        }
        assert.equal(bengleDoor.numpadLimitsFor('stepTarget', { pump: 'flow' }).max, 20);
    });

    test('the review sentence prints the ceiling the stepper offers, on the same machine', () => {
        // The one thing this whole table exists to make impossible is one field with two
        // maxima depending on the surface. The review path resolves its own ranges, so it
        // takes the class from the door — `editor-screen.js` reads it from nowhere else.
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
        // The route matters as much as the number: `machineClassFromServedSet` over
        // ReaPrime's capability array is the only producer, and the door will not take a
        // string it does not know rather than reading it as "unknown".
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
        // Derived from the module, not retyped here: a third row becoming machine-dependent
        // without this file noticing is the drift worth catching.
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
        assert.equal(R2_INTERIM.decision, 'B2');
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
