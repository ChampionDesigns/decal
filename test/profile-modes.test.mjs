
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as profileModes from '../src/lib/profile-modes.js';
import {
    AUTHORING_RANGES,
    authoringRangesFor,
    authoringRange,
    MACHINE_DEPENDENT_AUTHORING_RANGES,
    exitRange,
    MODE_TABLE,
    modeRanges,
    PUMP_MODE_CYCLE,
    PUMP_MODE_DISPLAY_ORDER,
    PUMP_MODE_LABEL,
    pumpChipsFor,
    getModeConfig,
    DEFAULT_IMPORTED_PUMP,
    LEVER_PRESETS,
    LEVER_FEEL_WORD,
    inferLeverPreset,
    POWER_CAP_DEFAULT,
    seedStepForPump,
    limiterOnClear,
    normalizeImportedStep,
    describeModeParts,
    segmentGeometry,
    PROPORTIONAL_FROM,
    transitionSegments,
    reviewStepSpec,
    revFmt,
    reviewLineText,
    stepGraphValues,
    stepTargetOverlay,
    leverDeclineP1,
    anyPowerStep,
    NEW_STEP,
    NEW_STEP_NAME_KEY,
    newStep,
} from '../src/lib/profile-modes.js';
import { REA_EXIT_TYPES } from '../src/data/rea-profile.js';
import { LIMIT_KEYS, MACHINE_CLASSES, limitsFor } from '../src/lib/machine-limits.js';

const closeTo = (a, b, eps = 1e-9) =>
    assert.ok(Math.abs(a - b) < eps, `expected ${a} ≈ ${b} (±${eps})`);

const MACHINE_RANGES = { temperature: { min: 70, max: 110, step: 0.5, unit: '°C' } };
const spec = (step) => reviewStepSpec(step, { machineRanges: MACHINE_RANGES });
const sentences = (step) => spec(step).map(reviewLineText);

/** A per-character measurer: the old character-count weighting, made explicit. */
const monoMeasure = (ch) => (label) => label.length * ch;

// ── The one range table (B2) ─────────────────────────────────────────────────

test('the three disagreeing copies collapse to one table — 12 / 12 / 8, never 16 / 16 / 15', () => {
    assert.equal(AUTHORING_RANGES.pressureTarget.max, 12);
    assert.equal(AUTHORING_RANGES.stepPressureLimit.max, 12);
    assert.equal(AUTHORING_RANGES.stepFlowLimit.max, 8);
    // The Review path's old, un-gated ceilings are gone from every surface.
    const pressureStep = { pump: 'pressure', sensor: 'coffee', transition: 'fast', temperature: 93, pressure: 9, limiter: { value: 2 } };
    const slots = spec(pressureStep).flat().filter((seg) => seg[0] === 'num');
    const target = slots.find((s) => s[1] === 'pressure');
    const limiter = slots.find((s) => s[1] === 'limiter');
    assert.equal(target[6], AUTHORING_RANGES.pressureTarget.max);
    assert.equal(limiter[6], AUTHORING_RANGES.stepFlowLimit.max);
    assert.notEqual(target[6], 16);
    assert.notEqual(limiter[6], 15);
});

test('a Bengle authors flow to 20; a DE1 keeps 15 and 8', () => {
    const bengle = authoringRangesFor('bengle');
    const de1 = authoringRangesFor('de1');
    assert.equal(bengle.flowTarget.max, 20, 'a flow step\'s TARGET on a Bengle');
    assert.equal(bengle.stepFlowLimit.max, 20, 'a pressure step\'s FLOW LIMIT on a Bengle');
    assert.equal(de1.flowTarget.max, 15);
    assert.equal(de1.stepFlowLimit.max, 8);
    for (const table of [bengle, de1]) {
        assert.equal(table.flowTarget.min, 0);
        assert.equal(table.stepFlowLimit.min, 0);
        assert.equal(table.flowTarget.unit, 'mL/s');
        assert.equal(table.stepFlowLimit.unit, 'mL/s');
        assert.equal(table.flowTarget.step, 0.1);
        assert.equal(table.stepFlowLimit.step, 0.1);
    }
});

test('an unknown machine class is offered the NARROWER band, and it NESTS inside the other', () => {
    const unknown = authoringRangesFor(null);
    assert.ok(Object.is(unknown, authoringRangesFor('de1')), 'unknown is answered with the DE1 band');
    assert.ok(Object.is(unknown, authoringRangesFor(undefined)), 'and undefined is the same as null');
    assert.ok(Object.is(unknown, AUTHORING_RANGES), 'AUTHORING_RANGES IS the class-unknown table');
    const bengle = authoringRangesFor('bengle');
    for (const name of MACHINE_DEPENDENT_AUTHORING_RANGES) {
        assert.ok(unknown[name].min >= bengle[name].min && unknown[name].max <= bengle[name].max,
            `${name}: the unknown-class band must nest inside every known one`);
    }
});

test('MACHINE_DEPENDENT_AUTHORING_RANGES is exactly the rows that DIFFER, derived not retyped', () => {
    const [a, b] = MACHINE_CLASSES.map(authoringRangesFor);
    const differ = Object.keys(a).filter((name) => !Object.is(a[name], b[name])).sort();
    assert.deepEqual(differ, [...MACHINE_DEPENDENT_AUTHORING_RANGES].sort(),
        'a row that differs between machine classes must be declared machine-dependent');
    assert.deepEqual([...MACHINE_DEPENDENT_AUTHORING_RANGES].sort(), ['flowTarget', 'stepFlowLimit']);
    for (const name of Object.keys(a)) {
        if (MACHINE_DEPENDENT_AUTHORING_RANGES.includes(name)) continue;
        assert.ok(Object.is(a[name], b[name]), `${name} is duplicated per machine class`);
    }
});

test('a machine-dependent row cannot be read without STATING a class — null counts as stating one', () => {
    for (const name of MACHINE_DEPENDENT_AUTHORING_RANGES) {
        assert.throws(() => authoringRange(name), /MACHINE-DEPENDENT/,
            `${name} answered without a machine class`);
        assert.throws(() => authoringRange(name), /A3/, 'and the refusal says where the class comes from');
        assert.ok(authoringRange(name, null), 'null is a stated class: "not known yet"');
        for (const machineClass of MACHINE_CLASSES) assert.ok(authoringRange(name, machineClass));
    }
    // The other fifteen rows are unaffected: a caller with no machine in hand still reads them.
    assert.ok(authoringRange('seconds'));
    assert.ok(authoringRange('powerTarget'));
    assert.ok(authoringRange('leverFlowCap'));
    // And a class the vocabulary does not know is refused, never read as "unknown".
    assert.throws(() => authoringRangesFor('decent'), /unknown machine class/);
    assert.throws(() => authoringRange('flowTarget', 'DE1'), /unknown machine class/);
});

test('the class reaches every surface: grid, mode table and review sentence agree PER MACHINE', () => {
    const cases = [
        { pump: 'flow', field: 'flow', step: { flow: 6, limiter: { value: 5 } } },
        { pump: 'pressure', field: 'pressure', step: { pressure: 9, limiter: { value: 2 } } },
    ];
    for (const machineClass of [...MACHINE_CLASSES, null]) {
        for (const { pump, field, step } of cases) {
            const ranges = modeRanges(pump, machineClass);
            const lines = reviewStepSpec(
                { sensor: 'coffee', transition: 'fast', temperature: 93, pump, ...step },
                { machineRanges: MACHINE_RANGES, machineClass },
            );
            const slots = lines.flat().filter((seg) => seg[0] === 'num');
            const targetSlot = slots.find((s) => s[1] === field);
            const limiterSlot = slots.find((s) => s[1] === 'limiter');
            assert.equal(targetSlot[6], ranges.target.max,
                `${pump} target ceiling disagrees between grid and review on ${machineClass}`);
            assert.equal(limiterSlot[6], ranges.limiter.max,
                `${pump} limiter ceiling disagrees between grid and review on ${machineClass}`);
        }
    }
    // And the numbers themselves, so the agreement above cannot be an agreement on 15.
    assert.equal(modeRanges('flow', 'bengle').target.max, 20);
    assert.equal(modeRanges('pressure', 'bengle').limiter.max, 20);
    assert.equal(modeRanges('flow', 'de1').target.max, 15);
    assert.equal(modeRanges('pressure', 'de1').limiter.max, 8);
    assert.equal(modeRanges('flow').target.max, 15, 'no class stated is the narrow band');
});

test('every per-class table is frozen and well-formed, row by row', () => {
    for (const machineClass of [...MACHINE_CLASSES, null]) {
        const table = authoringRangesFor(machineClass);
        assert.ok(Object.isFrozen(table), `${machineClass} table is not frozen`);
        for (const [name, range] of Object.entries(table)) {
            assert.ok(Object.isFrozen(range), `${machineClass}.${name} is not frozen`);
            assert.ok(range.max > range.min, `${machineClass}.${name} ceiling is not above its floor`);
        }
        assert.deepEqual(Object.keys(table).sort(), Object.keys(AUTHORING_RANGES).sort(),
            'no machine class gets a row another does not — absence is machine-limits\' answer, not this table\'s');
    }
});

test('every mode: grid, review sentence and mode table read the SAME entry', () => {
    const cases = [
        { step: { pump: 'flow', flow: 6, limiter: { value: 5 } }, field: 'flow' },
        { step: { pump: 'pressure', pressure: 9, limiter: { value: 2 } }, field: 'pressure' },
        { step: { pump: 'power', power: 2, limiter: { value: 9 } }, field: 'power' },
        { step: { pump: 'lever', pressure: 9, leverSpring: 0.9, leverGive: 1.5, limiter: { value: 4 } }, field: 'pressure' },
    ];
    for (const { step, field } of cases) {
        const ranges = modeRanges(step.pump);
        const slots = spec({ sensor: 'coffee', transition: 'fast', temperature: 93, ...step })
            .flat().filter((seg) => seg[0] === 'num');
        const targetSlot = slots.find((s) => s[1] === field);
        const limiterSlot = slots.find((s) => s[1] === 'limiter');
        if (targetSlot) {
            assert.deepEqual([targetSlot[3], targetSlot[4], targetSlot[5], targetSlot[6]],
                [ranges.target.step, ranges.target.unit, ranges.target.min, ranges.target.max],
                `${step.pump} target slot disagrees with its table entry`);
        }
        assert.deepEqual([limiterSlot[3], limiterSlot[4], limiterSlot[5], limiterSlot[6]],
            [ranges.limiter.step, ranges.limiter.unit, ranges.limiter.min, ranges.limiter.max],
            `${step.pump} limiter slot disagrees with its table entry`);
    }
});

test('describeModeParts reads the same entries as the review sentence', () => {
    const power = describeModeParts({ pump: 'power', power: 2, limiter: { value: 9 } });
    const powerTarget = power.main.find((s) => s.t === 'num');
    assert.deepEqual([powerTarget.min, powerTarget.max], [AUTHORING_RANGES.powerTarget.min, AUTHORING_RANGES.powerTarget.max]);
    const cap = power.limiter.find((s) => s.t === 'num');
    assert.deepEqual([cap.min, cap.max], [AUTHORING_RANGES.powerPressureCap.min, AUTHORING_RANGES.powerPressureCap.max]);

    const lever = describeModeParts({ pump: 'lever', pressure: 8, leverSpring: 1.1, leverGive: 2, limiter: { value: 6 } });
    const [p0, spring, give] = lever.main.filter((s) => s.t === 'num');
    assert.deepEqual([p0.max, spring.max, give.max],
        [AUTHORING_RANGES.leverP0.max, AUTHORING_RANGES.leverSpring.max, AUTHORING_RANGES.leverGive.max]);
    const flowCap = lever.limiter.find((s) => s.t === 'num');
    assert.deepEqual([flowCap.min, flowCap.max],
        [AUTHORING_RANGES.leverFlowCap.min, AUTHORING_RANGES.leverFlowCap.max]);
    assert.equal(flowCap.max, 20);   // the machine's max flow, one place
});

test('the table declares no MACHINE limit — that is machine-limits.js (B2)', () => {
    for (const machineOwned of ['temperature', 'brewTemp', 'steamTemp', 'hotWaterTemp', 'dose', 'drinkWeight']) {
        assert.equal(AUTHORING_RANGES[machineOwned], undefined,
            `${machineOwned} is a machine limit and must not be declared twice`);
    }
    assert.throws(() => authoringRange('brewTemp'), /no authoring range declared/);
});

test('B2 across the two modules: no field is declared twice, and the brew range IS the machine`s', () => {
    for (const key of LIMIT_KEYS) {
        assert.equal(AUTHORING_RANGES[key], undefined, `${key} is machine-limits.js's to declare`);
    }
    for (const machineClass of MACHINE_CLASSES) {
        assert.deepEqual(MACHINE_RANGES.temperature, limitsFor(machineClass).brewTemp,
            `the injected brew-temperature range must be machine-limits' brewTemp (${machineClass})`);
    }
});

test('B2: both key sets are PINNED, so a new row in either table forces the question', () => {
    assert.deepEqual(Object.keys(AUTHORING_RANGES).sort(), [
        'exitFlow', 'exitPower', 'exitPressure',
        'flowTarget', 'leverFlowCap', 'leverGive', 'leverP0', 'leverSpring',
        'powerPressureCap', 'powerTarget', 'pressureTarget', 'seconds',
        'stepFlowLimit', 'stepPressureLimit', 'volume', 'weight',
    ], 'a new AUTHORING_RANGES row: is this field the machine\'s (machine-limits.js) or the step\'s?');
    assert.deepEqual([...LIMIT_KEYS].sort(), [

        'appFlowMultiplier', 'brewTemp', 'calibrationWeight', 'cupWarmerTarget',
        'dose', 'drinkWeight',
        'fanThreshold', 'flowCalibration', 'flushDuration', 'flushFlow', 'flushTemp',
        'grind',
        'heaterIdleTemp', 'heaterPh1Flow', 'heaterPh2Flow', 'heaterPh2Timeout',
        'hotWaterDuration', 'hotWaterFlow', 'hotWaterLookahead', 'hotWaterTemp',
        'hotWaterVolume',
        'milkStopTemp', 'preWarmLead', 'screenBrightness', 'screensaverCycle', 'sleepAfter',
        'steamDuration', 'steamFlow', 'steamTemp', 'tankTemp', 'waterAlertLevel',
    ], 'a new machine-limits row: does a profile step author this field too?');
    // R2 lands as a REWRITE of the machine-envelope rows below, never as a third table.
    for (const r2Owned of ['pressureTarget', 'flowTarget', 'powerTarget', 'leverFlowCap',
        'stepPressureLimit', 'stepFlowLimit', 'powerPressureCap']) {
        assert.ok(AUTHORING_RANGES[r2Owned], `${r2Owned} is R2's to overwrite in THIS table`);
    }
});

test('every range entry is frozen and well-formed', () => {
    assert.ok(Object.isFrozen(AUTHORING_RANGES));
    for (const [name, range] of Object.entries(AUTHORING_RANGES)) {
        assert.ok(Object.isFrozen(range), `${name} is not frozen`);
        assert.ok(Number.isFinite(range.min) && Number.isFinite(range.max), `${name} has no bounds`);
        assert.ok(range.max > range.min, `${name} ceiling is not above its floor`);
        assert.ok(range.step > 0, `${name} has no step`);
        assert.equal(typeof range.unit, 'string');
    }
});

test('exitRange covers exactly the exit types ReaPrime can express', () => {
    for (const type of REA_EXIT_TYPES) assert.ok(exitRange(type), `no range for the ${type} exit`);
    assert.equal(exitRange('weight'), null);
    assert.equal(exitRange('off'), null);
    assert.equal(exitRange(undefined), null);
    assert.equal(exitRange('power').max, 25.5);   // the wire's own U8D1 ceiling
});

// ── Mode tables and seeds ────────────────────────────────────────────────────

test('MODE_TABLE: seeds and named ranges', () => {
    assert.equal(MODE_TABLE.flow.seed, 6.0);
    assert.equal(MODE_TABLE.pressure.seed, 6.0);
    assert.equal(MODE_TABLE.power.seed, 2.0);
    assert.equal(MODE_TABLE.lever.seed, 9.0);

    // Power target is watts, 0-10 (the shaper's max authored watts), step 0.1.
    const power = modeRanges('power');
    assert.deepEqual([power.target.unit, power.target.min, power.target.max, power.target.step], ['W', 0, 10, 0.1]);
    // Power's limiter IS the mandatory pressure cap: bar, floor 1, never 0.
    assert.deepEqual([power.limiter.unit, power.limiter.min, power.limiter.max], ['bar', 1, 12]);
    assert.equal(MODE_TABLE.power.limiterForced, true);

    // Lever's target is P0, stored in the pressure key; its limiter is an optional flow cap.
    assert.equal(MODE_TABLE.lever.targetKey, 'pressure');
    const lever = modeRanges('lever');
    assert.deepEqual([lever.target.unit, lever.target.max], ['bar', 12]);
    assert.deepEqual([lever.limiter.unit, lever.limiter.min, lever.limiter.max], ['mL/s', 0, 20]);
});

test('target floors: a 0 setpoint is a real step in every mode', () => {
    // A 0-bar PRESSURE setpoint is a valid step (stock pause/flush), same as flow-0.
    for (const pump of PUMP_MODE_CYCLE) assert.equal(modeRanges(pump).target.min, 0);
    // A flow step's PRESSURE LIMIT switches fully off at 0, so − and the numpad reach it.
    assert.equal(modeRanges('flow').limiter.min, 0);
    // Power's cap never does.
    assert.equal(modeRanges('power').limiter.min, 1);
});

test('PUMP_MODE_CYCLE is flow→pressure→power→lever', () => {
    assert.deepEqual([...PUMP_MODE_CYCLE], ['flow', 'pressure', 'power', 'lever']);
});

test('PUMP_MODE_DISPLAY_ORDER is Pressure/Flow/Power/Lever, Title Case faces', () => {
    assert.deepEqual([...PUMP_MODE_DISPLAY_ORDER], ['pressure', 'flow', 'power', 'lever']);
    assert.deepEqual(PUMP_MODE_DISPLAY_ORDER.map((p) => PUMP_MODE_LABEL[p]),
        ['Pressure', 'Flow', 'Power', 'Lever']);
});

// ── Chip gating ──────────────────────────────────────────────────────────────

test('pumpChipsFor OFFERED: the full 4-way row, in display order', () => {
    for (const pump of [...PUMP_MODE_CYCLE, undefined]) {
        assert.deepEqual(pumpChipsFor({ pump }, true), ['pressure', 'flow', 'power', 'lever']);
    }
});

test('pumpChipsFor NOT offered: flow/pressure steps show Pressure/Flow only', () => {
    assert.deepEqual(pumpChipsFor({ pump: 'flow' }, false), ['pressure', 'flow']);
    assert.deepEqual(pumpChipsFor({ pump: 'pressure' }, false), ['pressure', 'flow']);
});

test('pumpChipsFor NOT offered: a loaded Power/Lever step keeps its own chip', () => {
    assert.deepEqual(pumpChipsFor({ pump: 'power' }, false), ['pressure', 'flow', 'power']);
    assert.deepEqual(pumpChipsFor({ pump: 'lever' }, false), ['pressure', 'flow', 'lever']);
});

test('pumpChipsFor: an unknown or absent pump falls to Pressure/Flow when not offered', () => {
    assert.deepEqual(pumpChipsFor(null, false), ['pressure', 'flow']);
    assert.deepEqual(pumpChipsFor({}, false), ['pressure', 'flow']);
});

test('pumpChipsFor: the active chip is always in the returned list', () => {
    for (const pump of PUMP_MODE_CYCLE) {
        for (const offered of [true, false]) {
            assert.ok(pumpChipsFor({ pump }, offered).includes(pump), `${pump}/${offered}`);
        }
    }
});

test('getModeConfig REFUSES an unknown pump — A7, no fallback to flow', () => {
    assert.equal(getModeConfig('lever'), MODE_TABLE.lever);
    assert.throws(() => getModeConfig('weird'), /not a pump mode/);
    assert.throws(() => getModeConfig(undefined), /not a pump mode/);
    // And the refusal reaches every surface that resolves bounds through it.
    assert.throws(() => modeRanges('weird'), /not a pump mode/);
    assert.throws(() => spec({ pump: 'weird', sensor: 'coffee', transition: 'fast', temperature: 93 }),
        /not a pump mode/);
});

test('the import boundary is the ONE place an unknown pump is coerced, and it leaves a mark', () => {
    // A7's shape: tolerate at the boundary, once, visibly — never on every read.
    const legacy = normalizeImportedStep({ pump: 'turbo', flow: 6 });
    assert.equal(legacy.pump, DEFAULT_IMPORTED_PUMP);
    assert.equal(DEFAULT_IMPORTED_PUMP, 'flow');
    assert.equal(normalizeImportedStep({ flow: 6 }).pump, 'flow', 'a step with no mode is coerced too');
    // Power and Lever are still never demoted — the coercion only touches unknowns.
    assert.equal(normalizeImportedStep({ pump: 'power', power: 2 }).pump, 'power');
    assert.equal(normalizeImportedStep({ pump: 'lever', pressure: 9 }).pump, 'lever');
    // And once coerced the step reads cleanly everywhere, with no second guess.
    assert.equal(getModeConfig(legacy.pump), MODE_TABLE.flow);
});

// ── Lever presets ────────────────────────────────────────────────────────────

test('LEVER_PRESETS carry FEEL ONLY — no P0 leg (the preset invariant)', () => {
    for (const [name, preset] of Object.entries(LEVER_PRESETS)) {
        assert.deepEqual(Object.keys(preset).sort(), ['leverGive', 'leverSpring'],
            `${name} must set spring and give and nothing else`);
        assert.equal(preset.pressure, undefined, `${name} must never touch P0`);
        assert.ok(LEVER_FEEL_WORD[name], `${name} has no feel word`);
    }
});

test('inferLeverPreset matches on spring+give regardless of P0', () => {
    for (const p0 of [4, 8, 9, 12]) {
        assert.equal(inferLeverPreset({ pressure: p0, leverSpring: 0.9, leverGive: 1.5 }), 'CLASSIC');
    }
    assert.equal(inferLeverPreset({ pressure: 9, leverSpring: 0.6, leverGive: 2.5 }), 'GENTLE');
    assert.equal(inferLeverPreset({ pressure: 9, leverSpring: 0.4, leverGive: 0.8 }), 'FIRM');
});

test('inferLeverPreset is string-tolerant, and a near-miss on a feel leg is CUSTOM', () => {
    assert.equal(inferLeverPreset({ leverSpring: '0.9', leverGive: '1.5' }), 'CLASSIC');
    assert.equal(inferLeverPreset({ leverSpring: 0.95, leverGive: 1.5 }), 'CUSTOM');
    assert.equal(inferLeverPreset({ leverSpring: 0.9 }), 'CUSTOM');
    assert.equal(inferLeverPreset({}), 'CUSTOM');
    assert.equal(inferLeverPreset(null), 'CUSTOM');
});

// ── Mode-switch seeding ──────────────────────────────────────────────────────

test('seedStepForPump flow→pressure: seeds pressure 6, deletes flow', () => {
    const step = seedStepForPump({ pump: 'flow', flow: 4 }, 'pressure');
    assert.equal(step.pump, 'pressure');
    assert.equal(step.pressure, 6.0);
    assert.equal('flow' in step, false);
});

test('seedStepForPump flow→power: seeds 2.0 W and forces the default cap', () => {
    const step = seedStepForPump({ pump: 'flow', flow: 4 }, 'power');
    assert.equal(step.power, 2.0);
    assert.equal('flow' in step, false);
    assert.deepEqual(step.limiter, { value: POWER_CAP_DEFAULT.value, range: POWER_CAP_DEFAULT.range });
    assert.notEqual(step.limiter, POWER_CAP_DEFAULT, 'the step must own its limiter object');
});

test('seedStepForPump pressure→lever: P0 9.0 + CLASSIC feel, JUMP forced', () => {
    const step = seedStepForPump({ pump: 'pressure', pressure: 6, transition: 'smooth' }, 'lever');
    assert.equal(step.pressure, 9.0);
    assert.equal(step.leverSpring, LEVER_PRESETS.CLASSIC.leverSpring);
    assert.equal(step.leverGive, LEVER_PRESETS.CLASSIC.leverGive);
    assert.equal(step.transition, 'fast');
    assert.equal(inferLeverPreset(step), 'CLASSIC');
});

test('seedStepForPump lever→pressure keeps P0 in the pressure key, drops the feel legs', () => {
    const step = seedStepForPump({ pump: 'lever', pressure: 7.5, leverSpring: 0.9, leverGive: 1.5 }, 'pressure');
    assert.equal(step.pressure, 7.5);
    assert.equal('leverSpring' in step, false);
    assert.equal('leverGive' in step, false);
});

test('seedStepForPump→power re-seeds a {value:0} limiter and clamps a carried one to the cap range', () => {
    const cap = AUTHORING_RANGES.powerPressureCap;
    assert.equal(seedStepForPump({ pump: 'flow', limiter: { value: 0, range: 0.6 } }, 'power').limiter.value, POWER_CAP_DEFAULT.value);
    assert.equal(seedStepForPump({ pump: 'flow', limiter: { value: 0.5, range: 0.6 } }, 'power').limiter.value, cap.min);
    assert.equal(seedStepForPump({ pump: 'flow', limiter: { value: 99, range: 0.6 } }, 'power').limiter.value, cap.max);
    assert.equal(seedStepForPump({ pump: 'flow', limiter: { value: 7, range: 0.6 } }, 'power').limiter.value, 7);
});

test('seedStepForPump: only lever rewrites the transition', () => {
    for (const pump of ['flow', 'pressure', 'power']) {
        assert.equal(seedStepForPump({ pump: 'flow', transition: 'smooth' }, pump).transition, 'smooth');
        assert.equal(seedStepForPump({ pump: 'flow', transition: 'fast' }, pump).transition, 'fast');
    }
    assert.equal(seedStepForPump({ pump: 'flow', transition: 'smooth' }, 'lever').transition, 'fast');
});

test('seedStepForPump ignores an unknown mode and a missing step', () => {
    const step = { pump: 'flow', flow: 4 };
    assert.equal(seedStepForPump(step, 'turbo'), step);
    assert.equal(step.pump, 'flow');
    assert.equal(seedStepForPump(null, 'flow'), null);
});

test('limiterOnClear: power reseeds the mandatory cap, every other mode clears to 0', () => {
    assert.deepEqual(limiterOnClear('power'), { value: POWER_CAP_DEFAULT.value, range: POWER_CAP_DEFAULT.range });
    for (const pump of ['flow', 'pressure', 'lever', undefined]) {
        assert.equal(limiterOnClear(pump).value, 0);
    }
});

// ── Import-boundary normalisation ────────────────────────────────────────────

test('normalizeImportedStep: legacy flow/pressure drop the sibling target', () => {
    const step = normalizeImportedStep({ pump: 'flow', flow: 6, pressure: 9 });
    assert.equal(step.flow, 6);
    assert.equal('pressure' in step, false);
});

test('normalizeImportedStep: a Power step is never demoted and keeps a mandatory cap', () => {
    const kept = normalizeImportedStep({ pump: 'power', power: 2, limiter: { value: 8, range: 0.6 } });
    assert.equal(kept.pump, 'power');
    assert.equal(kept.limiter.value, 8);
    const seeded = normalizeImportedStep({ pump: 'power', power: 2 });
    assert.equal(seeded.limiter.value, POWER_CAP_DEFAULT.value);
    const zeroed = normalizeImportedStep({ pump: 'power', power: 2, limiter: { value: 0, range: 0.6 } });
    assert.equal(zeroed.limiter.value, POWER_CAP_DEFAULT.value);
});

test('normalizeImportedStep: a Lever step keeps P0, spring and give; others lose the feel legs', () => {
    const lever = normalizeImportedStep({ pump: 'lever', pressure: 9, leverSpring: 0.9, leverGive: 1.5 });
    assert.deepEqual([lever.pressure, lever.leverSpring, lever.leverGive], [9, 0.9, 1.5]);
    const flow = normalizeImportedStep({ pump: 'flow', flow: 6, leverSpring: 0.9, leverGive: 1.5 });
    assert.equal('leverSpring' in flow, false);
    assert.equal('leverGive' in flow, false);
});

test('normalizeImportedStep: a zero limiter nulls on every non-power mode', () => {
    assert.equal(normalizeImportedStep({ pump: 'flow', flow: 6, limiter: { value: 0 } }).limiter, null);
    assert.equal(normalizeImportedStep({ pump: 'lever', pressure: 9, limiter: { value: 0 } }).limiter, null);
});

test('normalizeImportedStep keeps exactly the exit types ReaPrime can express', () => {
    for (const type of REA_EXIT_TYPES) {
        const step = normalizeImportedStep({ pump: 'flow', flow: 6, exit: { type, condition: 'over', value: 3 } });
        assert.equal(step.exit.type, type, `a ${type} exit must round-trip on load`);
    }
    for (const type of ['weight', 'off', 'temperature']) {
        assert.equal(normalizeImportedStep({ pump: 'flow', flow: 6, exit: { type, value: 3 } }).exit, null);
    }
});

test('normalizeImportedStep leaves the step`s own stop fields alone', () => {
    const step = normalizeImportedStep({ pump: 'flow', flow: 6, seconds: 20, volume: 100, weight: 36 });
    assert.deepEqual([step.seconds, step.volume, step.weight], [20, 100, 36]);
    assert.equal(normalizeImportedStep(null), null);
    assert.equal(normalizeImportedStep('x'), 'x');
});

test('the pre-port name is gone — normalisation is import-boundary only', () => {
    assert.equal(profileModes.normalizeStep, undefined);
    assert.equal(typeof profileModes.normalizeImportedStep, 'function');
});

// ── Review-sentence parts ────────────────────────────────────────────────────

test('describeModeParts: flow/pressure return null (their sentences are unchanged)', () => {
    assert.equal(describeModeParts({ pump: 'flow', flow: 6 }), null);
    assert.equal(describeModeParts({ pump: 'pressure', pressure: 9 }), null);
});

test('describeModeParts POWER: constant-power template plus the cap clause', () => {
    const parts = describeModeParts({ pump: 'power', power: 2.0, limiter: { value: 9.0, range: 0.6 } });
    const texts = parts.main.filter((s) => s.t === 'text').map((s) => s.text);
    assert.ok(texts.includes('to a constant hydraulic power of'));
    assert.ok(texts.some((t) => t.includes('pressure and flow find their own balance on the puck')));
    const target = parts.main.find((s) => s.t === 'num');
    assert.deepEqual({ field: target.field, value: target.value, unit: target.unit },
        { field: 'power', value: 2.0, unit: 'W' });
    const capTexts = parts.limiter.filter((s) => s.t === 'text').map((s) => s.text);
    assert.ok(capTexts.some((t) => t.includes('Never exceed')));
    assert.ok(capTexts.some((t) => t.includes('hard pressure cap')));
    assert.equal(describeModeParts({ pump: 'power', power: 2.0 }).limiter, null);
});

test('describeModeParts LEVER: preset sentence exposes P0 only, custom exposes the triple', () => {
    const preset = describeModeParts({ pump: 'lever', pressure: 9.0, leverSpring: 0.9, leverGive: 1.5 });
    const presetText = preset.main.filter((s) => s.t === 'text').map((s) => s.text).join(' ');
    assert.ok(presetText.includes('classic spring-lever feel'));
    assert.ok(presetText.includes('easing as the shot pours'));
    assert.deepEqual(preset.main.filter((s) => s.t === 'num').map((s) => s.field), ['pressure']);

    const custom = describeModeParts({ pump: 'lever', pressure: 8.0, leverSpring: 1.1, leverGive: 2.0 });
    assert.ok(custom.main.some((s) => s.t === 'text' && s.text.includes('custom spring-lever source')));
    assert.deepEqual(custom.main.filter((s) => s.t === 'num').map((s) => s.field),
        ['pressure', 'leverSpring', 'leverGive']);
    // The feel units keep their verbatim prose suffixes; only the bounds are shared.
    const [, spring, give] = custom.main.filter((s) => s.t === 'num');
    assert.equal(spring.unit, 'bar per 10 mL delivered');
    assert.equal(give.unit, 'bar per mL/s of give');
});

test('describeModeParts LEVER: the flow-cap clause appears only when the cap is set', () => {
    const withCap = describeModeParts({ pump: 'lever', pressure: 9, leverSpring: 0.9, leverGive: 1.5, limiter: { value: 6 } });
    assert.ok(withCap.limiter.some((s) => s.t === 'text' && s.text.includes('Cap flow at')));
    assert.equal(describeModeParts({ pump: 'lever', pressure: 9, leverSpring: 0.9, leverGive: 1.5 }).limiter, null);
});

// ── Segmented geometry ───────────────────────────────────────────────────────

test('segmentGeometry: 2-3 options are equal slices, and the indicator sits flush', () => {
    for (const labels of [['Jump', 'Ramp'], ['Jump', 'Ramp', 'Hold']]) {
        const g = segmentGeometry(labels, 260, { pad: 4 });
        const first = g.widths[0];
        g.widths.forEach((w) => closeTo(w, first));
        assert.equal(g.tightFont, false);
        assert.equal(g.proportional, false);
        labels.forEach((_, i) => {
            closeTo(g.indicatorLeft(i), 4 + g.offsets[i]);
            closeTo(g.indicatorWidth(i), g.widths[i]);
        });
    }
});

test('segmentGeometry: 4+ options are weighted by MEASURED text plus a gutter', () => {
    const labels = ['Pressure', 'Flow', 'Power', 'Lever'];
    const g = segmentGeometry(labels, 288, { pad: 4, measure: monoMeasure(1), gutter: 2 });
    assert.deepEqual(g.weights, [10, 6, 7, 7]);
    assert.equal(g.tightFont, true);
    assert.equal(g.proportional, true);
    assert.ok(g.widths[0] > g.widths[2], 'Pressure wider than Power');
    assert.ok(g.widths[2] > g.widths[1], 'Power wider than Flow');
    closeTo(g.widths.reduce((a, b) => a + b, 0), g.inner, 1e-6);
    closeTo(g.offsets[3] + g.widths[3], g.inner, 1e-6);
});

test('segmentGeometry: a variable-width face changes the slices, which is the point', () => {
    const labels = ['Pressure', 'Flow', 'Power', 'Lever'];
    const advances = { Pressure: 61, Flow: 27, Power: 38, Lever: 33 };
    const g = segmentGeometry(labels, 288, { pad: 4, measure: (l) => advances[l], gutter: 12 });
    assert.deepEqual(g.weights, [73, 39, 50, 45]);
    assert.ok(g.widths[2] > g.widths[3], 'Power renders wider than Lever');
});

test('segmentGeometry refuses to size 4+ segments without a measurer and a gutter', () => {
    const labels = ['Pressure', 'Flow', 'Power', 'Lever'];
    assert.throws(() => segmentGeometry(labels, 288), /needs a text measurer/);
    assert.throws(() => segmentGeometry(labels, 288, { measure: monoMeasure(1) }), /needs a text measurer/);
    assert.throws(() => segmentGeometry(labels, 288, { gutter: 2 }), /needs a text measurer/);
    assert.throws(() => segmentGeometry(labels, 288, { measure: () => NaN, gutter: 2 }), /expected a pixel width/);
    // `equal` is the lever-preset row: uniform slices need no measurement at all.
    assert.equal(segmentGeometry(labels, 288, { equal: true }).weights.length, PROPORTIONAL_FROM);
    assert.equal(segmentGeometry(labels, 288, { equal: true }).proportional, false);
});

test('segmentGeometry: an empty label list produces no slices and does not divide by zero', () => {
    const g = segmentGeometry([], 260, { pad: 4 });
    assert.deepEqual(g.widths, []);
    assert.equal(g.indicatorLeft(0), 4);
    assert.equal(g.indicatorWidth(0), 0);
});

// ── Transition rules ─────────────────────────────────────────────────────────

test('transitionSegments: HOLD is greyed on step 1 and absent when not offered', () => {
    const offered = transitionSegments({ pump: 'flow', transition: 'fast' }, 1, true);
    assert.deepEqual(offered.options.map((o) => o.value), ['fast', 'smooth', 'hold']);
    assert.equal(offered.options[2].disabled, false);
    assert.equal(offered.readOnly, false);
    assert.equal(offered.active, 'fast');

    const first = transitionSegments({ pump: 'flow', transition: 'fast' }, 0, true);
    assert.equal(first.options[2].disabled, true, 'HOLD cannot be the first step');

    const gated = transitionSegments({ pump: 'flow', transition: 'fast' }, 1, false);
    assert.deepEqual(gated.options.map((o) => o.value), ['fast', 'smooth']);
    assert.equal(gated.readOnly, false);
});

test('transitionSegments: a foreign HOLD is shown read-only, never rewritten', () => {
    const foreign = transitionSegments({ pump: 'flow', transition: 'hold' }, 1, false);
    assert.deepEqual(foreign.options.map((o) => o.value), ['fast', 'smooth', 'hold']);
    assert.equal(foreign.readOnly, true);
    assert.equal(foreign.active, 'hold');
});

test('transitionSegments: LEVER pins JUMP and greys the whole control', () => {
    const lever = transitionSegments({ pump: 'lever', transition: 'smooth' }, 2, true);
    assert.equal(lever.readOnly, true);
    assert.equal(lever.active, 'fast');
});

// ── The review sentence, verbatim ────────────────────────────────────────────

test('reviewStepSpec refuses to run without the machine`s brew-temperature range', () => {
    const step = { pump: 'flow', flow: 6, temperature: 93 };
    assert.throws(() => reviewStepSpec(step), /machineRanges/);
    assert.throws(() => reviewStepSpec(step, {}), /machine-limits/);
    assert.throws(() => reviewStepSpec(step, { machineRanges: { temperature: {} } }), /machineRanges/);
});

test('reviewStepSpec: the temperature slot is the MACHINE range, injected', () => {
    const line = spec({ pump: 'flow', sensor: 'coffee', flow: 6, temperature: 93 })[0];
    const slot = line.find((seg) => seg[0] === 'num');
    assert.deepEqual([slot[1], slot[3], slot[5], slot[6]],
        ['temperature', MACHINE_RANGES.temperature.step, MACHINE_RANGES.temperature.min, MACHINE_RANGES.temperature.max]);
    assert.equal(reviewLineText(line), 'Set coffee temperature to 93 °C');
});

test('review wording is verbatim for every mode', () => {
    assert.deepEqual(sentences({
        pump: 'flow', sensor: 'coffee', transition: 'fast', temperature: 93, flow: 6, seconds: 20,
        limiter: { value: 5 }, exit: { type: 'pressure', condition: 'over', value: 9 }, volume: 100, weight: 36,
    }), [
        'Set coffee temperature to 93 °C',
        'Jump to a flow rate of 6 mL/s for 20 sec. Limit flow if pressure approaches 5 bar',
        'Move on if pressure rises above 9 bar, or if we reach 100 mL or 36 g',
    ]);

    assert.deepEqual(sentences({
        pump: 'pressure', sensor: 'water', transition: 'smooth', temperature: 88, pressure: 9, seconds: 5,
        limiter: { value: 2.5 }, exit: { type: 'flow', condition: 'under', value: 1.5 },
    }), [
        'Set water temperature to 88 °C',
        'Ramp to a pressure of 9 bar over 5 sec. Limit pressure if flow approaches 2.5 mL/s',
        'Move on if flow falls below 1.5 mL/s',
    ]);

    assert.deepEqual(sentences({
        pump: 'power', sensor: 'coffee', transition: 'fast', temperature: 92, power: 2, seconds: 20,
        limiter: { value: 9 },
    }), [
        'Set coffee temperature to 92 °C',
        'Jump to a constant hydraulic power of 2 W — pressure and flow find their own balance on the puck for 20 sec. Never exceed 9 bar (hard pressure cap)',
    ]);

    assert.deepEqual(sentences({
        pump: 'lever', sensor: 'coffee', transition: 'fast', temperature: 88, pressure: 9,
        leverSpring: 0.9, leverGive: 1.5, seconds: 0, limiter: { value: 0 },
        exit: { type: 'pressure', condition: 'under', value: 3 }, weight: 40,
    }), [
        'Set coffee temperature to 88 °C',
        'Engage a classic spring-lever feel, starting near 9 bar and easing as the shot pours',
        'Move on if pressure falls below 3 bar, or if we reach 40 g',
    ]);

    assert.deepEqual(sentences({
        pump: 'lever', sensor: 'coffee', transition: 'fast', temperature: 90, pressure: 9,
        leverSpring: 1.3, leverGive: 3.1, seconds: 15, limiter: { value: 4 },
    }), [
        'Set coffee temperature to 90 °C',
        'Engage a custom spring-lever source: start at 9 bar, dropping 1.3 bar per 10 mL delivered with 3.1 bar per mL/s of give for 15 sec. Cap flow at 4 mL/s',
    ]);

    assert.deepEqual(sentences({
        pump: 'flow', sensor: 'coffee', transition: 'hold', temperature: 80, flow: 6, seconds: 20,
        limiter: { value: 0 },
    }), [
        'Set coffee temperature to 80 °C',
        'Hold the previous flow rate for 20 sec',
    ]);
});

test('review wording: the HOLD-power held word is the DOCUMENTED deviation ("power")', () => {
    const lines = sentences({
        pump: 'power', sensor: 'coffee', transition: 'hold', temperature: 92, power: 2, seconds: 20,
        limiter: { value: 9 },
    });
    assert.ok(lines[1].includes('Hold the previous power'), lines[1]);
    assert.ok(lines[1].includes('Never exceed 9 bar (hard pressure cap)'),
        'a HOLD-power step keeps its mandatory cap clause');
});

test('review: a zero-valued or unrepresentable exit contributes no trigger line', () => {
    const base = { pump: 'flow', sensor: 'coffee', transition: 'fast', temperature: 93, flow: 6 };
    assert.equal(spec(base).length, 2);
    assert.equal(spec({ ...base, exit: { type: 'pressure', condition: 'over', value: 0 } }).length, 2);
    assert.equal(spec({ ...base, exit: { type: 'off', value: 5 } }).length, 2);
    assert.equal(spec({ ...base, exit: { type: 'weight', value: 36 } }).length, 2);
    assert.equal(spec({ ...base, exit: { type: 'power', condition: 'over', value: 4 } }).length, 3);
});

test('review: the exit slot bounds come from the one table', () => {
    for (const type of REA_EXIT_TYPES) {
        const line = spec({ pump: 'flow', sensor: 'coffee', transition: 'fast', temperature: 93, flow: 6, exit: { type, condition: 'over', value: 2 } })[2];
        const slot = line.flat ? line.filter((seg) => seg[0] === 'num')[0] : null;
        assert.deepEqual([slot[4], slot[5], slot[6]],
            [exitRange(type).unit, exitRange(type).min, exitRange(type).max]);
    }
});

test('revFmt: integers bare, fractions to one decimal below a whole step', () => {
    assert.equal(revFmt(9, 0.1), '9');
    assert.equal(revFmt(92.5, 0.5), '92.5');
    assert.equal(revFmt(1.25, 1), '1');
    assert.equal(revFmt(null, 0.1), '');
    assert.equal(revFmt(undefined, 0.1), '');
});

// ── Preview graph and overlay ────────────────────────────────────────────────

test('stepGraphValues: flow/pressure keep the opposite-channel-0 shape', () => {
    assert.deepEqual(stepGraphValues({ pump: 'pressure', pressure: 9 }), { pressure: 9, flow: 0, power: 0 });
    assert.deepEqual(stepGraphValues({ pump: 'flow', flow: 6 }), { pressure: 0, flow: 6, power: 0 });
    assert.deepEqual(stepGraphValues({ pump: 'weird' }), { pressure: 0, flow: 0, power: 0 });
});

test('stepGraphValues POWER/LEVER: pressure at the cap / at P0, flow at the cap', () => {
    assert.deepEqual(stepGraphValues({ pump: 'power', power: 2, limiter: { value: 8 } }),
        { pressure: 8, flow: 0, power: 2 });
    assert.deepEqual(stepGraphValues({ pump: 'lever', pressure: 9, limiter: { value: 5 } }),
        { pressure: 9, flow: 5, power: 0 });
    assert.deepEqual(stepGraphValues({ pump: 'lever', pressure: 9 }),
        { pressure: 9, flow: 0, power: 0 });
});

test('stepTargetOverlay: an uncommanded channel is a GAP, never a commanded zero', () => {
    assert.deepEqual(stepTargetOverlay({ pump: 'pressure', pressure: 9 }), { pressure: 9, flow: null });
    assert.deepEqual(stepTargetOverlay({ pump: 'flow', flow: 6 }), { pressure: null, flow: 6 });
    assert.deepEqual(stepTargetOverlay({ pump: 'power', power: 2, limiter: { value: 8 } }), { pressure: 8, flow: null });
    assert.deepEqual(stepTargetOverlay({ pump: 'lever', pressure: 9 }), { pressure: 9, flow: null });
    assert.deepEqual(stepTargetOverlay({ pump: 'lever', pressure: 9, limiter: { value: 5 } }), { pressure: 9, flow: 5 });
    assert.deepEqual(stepTargetOverlay({ pump: 'weird' }), { pressure: null, flow: null });
});

test('stepTargetOverlay stays consistent with stepGraphValues', () => {
    const power = { pump: 'power', power: 2, limiter: { value: 8 } };
    assert.equal(stepTargetOverlay(power).pressure, stepGraphValues(power).pressure);
    const lever = { pump: 'lever', pressure: 7.5, leverSpring: 0.6, leverGive: 2.5, limiter: { value: 5 } };
    assert.equal(stepTargetOverlay(lever).pressure, stepGraphValues(lever).pressure);
    assert.equal(stepTargetOverlay(lever).flow, stepGraphValues(lever).flow);
});

test('leverDeclineP1: P0 − 3·spring, clamped at 0', () => {
    closeTo(leverDeclineP1({ pressure: 9.0, leverSpring: 0.9 }), 6.3);
    assert.equal(leverDeclineP1({ pressure: 2.0, leverSpring: 1.0 }), 0);
    closeTo(leverDeclineP1({ pressure: 9.5, leverSpring: 0.4 }), 8.3);
    assert.equal(leverDeclineP1(null), 0);
});

test('anyPowerStep detects a Power step anywhere in the list', () => {
    assert.equal(anyPowerStep([{ pump: 'flow' }, { pump: 'power' }]), true);
    assert.equal(anyPowerStep([{ pump: 'flow' }, { pump: 'lever' }]), false);
    assert.equal(anyPowerStep([]), false);
    assert.equal(anyPowerStep(null), false);
});

// ── No paint crosses this boundary ───────────────────────────────────────────

test('the module exports no colour and no dash — both belong to the chart layer', () => {
    assert.equal(profileModes.POWER_TRACE_COLOR, undefined);
    assert.equal(profileModes.LEVER_DECLINE_DASH, undefined);
    for (const [name, value] of Object.entries(profileModes)) {
        if (typeof value !== 'string') continue;
        assert.doesNotMatch(value, /^#|^rgb|^hsl/, `${name} looks like a colour literal`);
    }
});

test('the blank step is Ben\'s six values, in the shape ReaPrime serves', () => {
  assert.equal(NEW_STEP.pump, 'pressure', 'a pressure profile step');
  assert.equal(NEW_STEP.pressure, 8, 'with a target of 8 bar');
  assert.equal(NEW_STEP.limiter.value, 8, 'flow limit of 8 mL/s');
  assert.equal(NEW_STEP.temperature, 85, 'a target temperature of 85 C');
  assert.equal(NEW_STEP.sensor, 'coffee', 'at the coffee ...');
  assert.equal(NEW_STEP.seconds, 30, '... duration of 30 s');
  assert.equal(NEW_STEP.exit, null, 'no exit conditions');
  assert.equal(NEW_STEP.volume, 0, 'and no volume stop, which is the same sentence');
  assert.equal(NEW_STEP.weight, 0, 'nor a weight stop');
});

test('the blank step\'s target key is the one its own mode declares', () => {
  const cfg = getModeConfig(NEW_STEP.pump);
  assert.equal(NEW_STEP[cfg.targetKey], 8);
  assert.equal(cfg.limiterRange, 'stepFlowLimit',
    'and its limiter IS its flow limit, which is why Ben\'s 8 mL/s needs no second name');
});

test('the blank step\'s limiter soft-knee is the ONE declared width, not a fourth 0.6', () => {
  assert.equal(NEW_STEP.limiter.range, POWER_CAP_DEFAULT.range);
  assert.equal(limiterOnClear('flow').range, POWER_CAP_DEFAULT.range,
    'the same width the editor\'s clear gesture already re-uses');
});

test('the blank step\'s 8 bar is ITS OWN number — the mode switch still seeds 6', () => {
  assert.equal(MODE_TABLE.pressure.seed, 6.0, 'a mode SWITCH still seeds 6 bar');
  assert.equal(NEW_STEP.pressure, 8, 'a brand-new step is Ben\'s 8 bar');

  const switched = seedStepForPump({ pump: 'flow', flow: 4 }, 'pressure');
  assert.equal(switched.pressure, 6.0, 'and the switch path is genuinely unaffected');
});

test('newStep() hands back a FRESH step with its own limiter object', () => {
  const a = newStep();
  const b = newStep();
  assert.notEqual(a, b);
  assert.notEqual(a.limiter, b.limiter, 'or two inserted steps would share one limiter');
  assert.notEqual(a.limiter, NEW_STEP.limiter);
  assert.deepEqual({ ...a }, { ...NEW_STEP, limiter: { ...NEW_STEP.limiter } });

  // The frozen declaration cannot be written through by anything that took a copy.
  a.limiter.value = 1;
  assert.equal(NEW_STEP.limiter.value, 8);
});

test('newStep() takes the caller\'s translated name, and defaults to none (D2)', () => {
  assert.equal(newStep().name, '', 'a module with no t() writes no English into a profile');
  assert.equal(newStep({ name: 'Neuer Schritt' }).name, 'Neuer Schritt');
  assert.equal(newStep({ name: 42 }).name, '', 'and a non-string is not a name');
  assert.equal(typeof NEW_STEP_NAME_KEY, 'string');
  assert.ok(NEW_STEP_NAME_KEY.length > 0, 'the word crosses the boundary as a key');
});

test('every value in the blank step sits inside the range that governs it', () => {
  const cfg = getModeConfig(NEW_STEP.pump);
  const within = (value, range, what) => {
    assert.ok(value >= range.min && value <= range.max,
      `${what}: ${value} is outside ${range.min}..${range.max}`);
  };
  for (const machineClass of [...MACHINE_CLASSES, null]) {
    const target = authoringRange(cfg.targetRange, machineClass);
    const limiter = authoringRange(cfg.limiterRange, machineClass);
    const seconds = authoringRange('seconds');

    within(NEW_STEP.pressure, target, `the target (${machineClass})`);
    within(NEW_STEP.limiter.value, limiter, `the flow limit (${machineClass})`);
    within(NEW_STEP.seconds, seconds, 'the duration');
    within(NEW_STEP.volume, authoringRange('volume'), 'volume');
    within(NEW_STEP.weight, authoringRange('weight'), 'weight');
  }
});

test('the blank step describes and graphs without throwing — it is a real step', () => {
  assert.doesNotThrow(() => describeModeParts(newStep()));
  assert.doesNotThrow(() => stepGraphValues(newStep()));
  assert.equal(transitionSegments(newStep(), 0, false).active, NEW_STEP.transition,
    'and its transition is the one a first step is allowed to have');
});
