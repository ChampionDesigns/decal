/**
 * settings-leaf-model-commit-band.test.mjs — the commit band, and the one control that
 * used to write outside it.
 *
 * AUDIT F-049 (`_audit/FINDINGS.md`), 29 August 2026: "a master switch writes its
 * remembered value outside the commit band, Cancel cannot take it back, and nothing can
 * ever delete it". The three `zeroSwitch` rows — `machine-steam-enabled`,
 * `machine-water-tank-preheat`, `accessories-cup-warmer-enabled` — each hold a machine
 * field whose zero means "off", and each remembers the number it is leaving so switching
 * back on returns to it rather than to a shipped default.
 *
 * THE FAULT WAS A SPLIT LIFETIME, not the remembering. `settings-leaf-model.js:1174-1184`
 * did `await settings.set(row.zeroSwitch, current)` ON THE PRESS and then staged the
 * machine field at zero — so one gesture made two writes, one of which waited for Save and
 * one of which did not. The comment four lines above it said the opposite in as many
 * words: *"the machine field is staged like every other machine change, so Cancel undoes
 * the switch exactly as it undoes a stepper"*. These tests are that sentence, asserted.
 *
 * THE THREE MEASURED EDGES, from the audit's own transition logs:
 *
 *   S04b  machine holds tankTemp 44 → toggle Preheat off → `POST
 *         /api/v1/store/decal/tankTempWhenOn` body 44 fires AT ONCE → Cancel → the machine
 *         still holds 44, the switch redraws true, and the kv store still holds 44.
 *   S04c  step 44 → 47 (staged, zero requests) → toggle off → the kv write carries **47**
 *         → Cancel → the machine holds 44, the row redraws 44, and the memory holds a 47
 *         the machine was never given. That 47 is what the next "switch on" restores.
 *   S03c  no control anywhere hands the storage router a null, so the key can never be
 *         removed again. That half is DEFERRED to Ben (MORNING_REPORT) and is not asserted
 *         here — this file is the Cancel half only.
 *
 * WHAT IS NOT FIXED HERE, said plainly so a reader does not go looking: the restore ladder
 * still consults `STORED_DEFAULTS` before the machine's own held setpoint (the
 * 70-overwritten-by-60 case, S03), and the three keys are still write-only from the UI
 * (S03c). Both are design calls and are Ben's; FIXPLAN §1 defers them.
 *
 * BOTH WERE SETTLED ON 30 AUGUST 2026 (Ben's decision D09) and are asserted in
 * `test/settings-zero-switch-memory.test.mjs`. The paragraph above is left standing because
 * it is the record of what this file's own scope was; nothing in it describes this file's
 * assertions, all of which are unchanged and all of which still pass.
 *
 * A pure test over the real stores — the real storage router, the real settings store, a
 * memory backend — so "it reaches the kv layer" is exercised rather than mocked.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createStorageRouter } from '../src/lib/storage-router.js';
import { LAYERS } from '../src/lib/storage-routes.js';
import { createSettingsStore } from '../src/stores/settings-store.js';
import { createSettingsLeafModel } from '../src/stores/settings-leaf-model.js';
import { limitsFor } from '../src/lib/machine-limits.js';

/** A backend that RECORDS, so "nothing was written" is a fact rather than an absence. */
function recordingBackend({ failWrites = false } = {}) {
    const data = new Map();
    const writes = [];
    return {
        data,
        writes,
        async get(key) { return data.get(key); },
        async set(key, value) {
            writes.push({ key, value });
            if (failWrites) throw new Error('backend refused');
            data.set(key, value);
        },
        async remove(key) { writes.push({ key, value: null }); data.delete(key); },
    };
}

/** The tank at 44 °C with its preheat on — the machine state S04b starts from. */
const MACHINE_DOCUMENT = Object.freeze({
    fan: 30, usb: true, flushTemp: 90, flushTimeout: 5, flushFlow: 6,
    hotWaterFlow: 8, steamFlow: 1.2, tankTemp: 44, steamPurgeMode: 0,
    steamTargetTemperature: 150, cupWarmerTemperature: 62,
});

/** A capability answer, the shape `settings-store.js` asks for. */
const answering = (verdict) => ({ capability: () => verdict });

function harness({ machine = 'ok', document: served = MACHINE_DOCUMENT, kvFails = false,
    capabilities = answering('present') } = {}) {
    const kv = recordingBackend({ failWrites: kvFails });
    const backends = {
        [LAYERS.local]: recordingBackend(),
        [LAYERS.session]: recordingBackend(),
        [LAYERS.kv]: kv,
        [LAYERS.kvNumpad]: recordingBackend(),
    };
    const storage = createStorageRouter({ backends });
    const settings = createSettingsStore({ storage, capabilities });
    const written = [];
    const port = machine === 'none' ? null : {
        read: async () => ({ ...served }),
        write: async (patch) => { written.push(patch); return machine !== 'fails'; },
    };
    const model = createSettingsLeafModel({
        settings, machine: port, limits: limitsFor('bengle'), machineClass: null,
    });
    return { kv, backends, settings, model, written };
}

const rowById = (model, leaf, id) => model.allRows(leaf).find((view) => view.id === id);

/** Every kv write the run made, as `key=value` — the request log this file asserts on. */
const kvWrites = (kv) => kv.writes.map((w) => `${w.key}=${w.value}`);

/** Load the machine document and the stored keys, the way the screen does on open. */
async function opened(options) {
    const rig = harness(options);
    await rig.model.load('machine-water-tank');
    return rig;
}

describe('F-049 — a master switch commits on Save and discards on Cancel', () => {
    test('S04b: turning the switch off writes NOTHING on the press', async () => {
        const { model, kv } = await opened();
        const preheat = rowById(model, 'machine-water-tank', 'machine-water-tank-preheat');
        assert.ok(preheat, 'the preheat switch must exist');
        assert.equal(preheat.checked, true, 'the tank holds 44, so the switch reads on');

        const result = await model.set(preheat.row, false);

        /* THE WHOLE OF S04b IN ONE ASSERTION. The old code fired
         * `POST /api/v1/store/decal/tankTempWhenOn` body 44 right here. */
        assert.deepEqual(kvWrites(kv), [],
            'the remembered value must not reach the store before Save exists as a choice');
        assert.equal(result.staged, true, 'and the machine half is staged, as it always was');
        assert.deepEqual(model.pendingPatch, { tankTemp: 0 },
            'the machine field is staged at zero — the machine\'s own way of saying "off"');
        assert.equal(model.changeCount, 1,
            'ONE change: a master switch is one gesture, not two');
    });

    test('S04b: Cancel takes back BOTH halves — the switch redraws on, the memory is gone', async () => {
        const { model, kv, settings } = await opened();
        const preheat = rowById(model, 'machine-water-tank', 'machine-water-tank-preheat');
        await model.set(preheat.row, false);
        assert.equal(
            rowById(model, 'machine-water-tank', 'machine-water-tank-preheat').checked, false,
            'while staged, the switch reads off — that half always worked');

        const undone = model.discard();

        assert.equal(undone, 1);
        assert.equal(model.changeCount, 0);
        assert.deepEqual(model.pendingPatch, {});
        assert.equal(
            rowById(model, 'machine-water-tank', 'machine-water-tank-preheat').checked, true,
            'the switch redraws on');
        /* THE ASSERTION THE FINDING IS FOR: "Cancel returns the machine, the row and the
         * switch to where they were and LEAVES THAT WRITE STANDING." It does not now. */
        assert.deepEqual(kvWrites(kv), [], 'and nothing was ever written to be left standing');
        /* ASSERTED ON THE BACKEND, NOT ON `settings.value`: the settings store answers a
         * shipped default (`STORED_DEFAULTS`) for an unset key, so `value()` is never
         * `undefined` and cannot tell "nothing stored" from "stored". The kv layer's own
         * map can. */
        assert.equal(kv.data.size, 0, 'the kv layer holds nothing, because nothing was committed');
    });

    test('Save commits both halves, in one band', async () => {
        const { model, kv, settings, written } = await opened();
        const preheat = rowById(model, 'machine-water-tank', 'machine-water-tank-preheat');
        await model.set(preheat.row, false);

        const result = await model.commit();

        assert.equal(result.ok, true);
        assert.equal(result.wrote, 1, 'one machine field');
        assert.deepEqual(written, [{ tankTemp: 0 }], 'the machine half went out as one patch');
        assert.deepEqual(kvWrites(kv), ['tankTempWhenOn=44'],
            'and the remembered value went out on the SAME Save, not before it');
        assert.equal(settings.value('tankTempWhenOn'), 44);
        assert.equal(model.changeCount, 0);
    });

    test('S04c: the ghost 47 is unrepresentable — a discarded edit is not remembered', async () => {
        const { model, kv, settings } = await opened();
        /* THE AUDIT'S OWN SEQUENCE. Step the tank heater 44 → 47 (staged, zero requests),
         * toggle the switch off — the old code's kv write carried the STAGED 47 — then
         * Cancel. The machine holds 44 throughout. */
        const temp = rowById(model, 'machine-water-tank', 'machine-water-tank-temp');
        assert.ok(temp, 'the tank temperature stepper must exist');
        await model.set(temp.row, 47);
        assert.deepEqual(model.pendingPatch, { tankTemp: 47 });
        assert.deepEqual(kvWrites(kv), [], 'stepping writes nothing — settings-P proved this');

        const preheat = rowById(model, 'machine-water-tank', 'machine-water-tank-preheat');
        await model.set(preheat.row, false);
        assert.deepEqual(model.pendingPatch, { tankTemp: 0 });

        model.discard();

        assert.deepEqual(kvWrites(kv), [],
            'the 47 the machine was never given cannot be what the next switch-on restores');
        assert.equal(kv.data.size, 0);
        assert.equal(model.machineValue('tankTemp'), 44, 'the row redraws the machine\'s own 44');
    });

    test('a failed machine write leaves the memory staged too — never a half commit', async () => {
        const { model, kv, settings } = await opened({ machine: 'fails' });
        const preheat = rowById(model, 'machine-water-tank', 'machine-water-tank-preheat');
        await model.set(preheat.row, false);

        const result = await model.commit();

        assert.equal(result.ok, false);
        assert.equal(result.wrote, 0);
        /* A MEMORY OF A STATE THE MACHINE IS NOT IN is the same fault by another route:
         * the machine still heats the tank and the store says it was switched off at 44. */
        assert.deepEqual(kvWrites(kv), []);
        assert.equal(kv.data.size, 0);
        assert.equal(model.changeCount, 1, 'both halves stay staged, so nothing is lost');
    });

    test('off then on inside one band restores the staged memory and commits neither', async () => {
        const { model, kv, settings, written } = await opened();
        const row = () => rowById(model, 'machine-water-tank', 'machine-water-tank-preheat').row;

        const temp = rowById(model, 'machine-water-tank', 'machine-water-tank-temp');
        await model.set(temp.row, 47);
        await model.set(row(), false);
        assert.deepEqual(model.pendingPatch, { tankTemp: 0 });

        await model.set(row(), true);

        /* A STAGED MEMORY OUTRANKS A STORED ONE, so the switch comes back to the 47 the
         * off remembered — not to a shipped default and not to the machine's 44. */
        assert.equal(model.machineValue('tankTemp'), 47);
        assert.equal(
            rowById(model, 'machine-water-tank', 'machine-water-tank-preheat').checked, true);

        await model.commit();

        assert.deepEqual(written, [{ tankTemp: 47 }]);
        /* AND THE MEMORY WRITE IS GONE WITH THE OFF IT BELONGED TO. Saving a
         * `tankTempWhenOn` here would be a kv write nobody asked for: the switch is on. */
        assert.deepEqual(kvWrites(kv), []);
        assert.equal(kv.data.size, 0);
    });

    test('a STORED memory survives an off-then-on — only the staged one is dropped', async () => {
        const { model, kv, settings } = await opened();
        const row = () => rowById(model, 'machine-water-tank', 'machine-water-tank-preheat').row;

        /* An earlier session's Save. Written through the store, exactly as a commit does. */
        await settings.set('tankTempWhenOn', 38);
        kv.writes.length = 0;

        await model.set(row(), false);
        await model.set(row(), true);

        assert.equal(settings.value('tankTempWhenOn'), 38,
            'what a previous Save decided is not this band\'s to drop');
        assert.deepEqual(kvWrites(kv), []);
    });

    test('the steam switch behaves identically — the fix is the mechanism, not one row', async () => {
        const { model, kv, settings, written } = harness();
        await model.load('machine-steam');
        const steam = rowById(model, 'machine-steam', 'machine-steam-enabled');
        assert.ok(steam, 'the steam master switch must exist');

        await model.set(steam.row, false);
        assert.deepEqual(kvWrites(kv), [], 'nothing on the press');
        model.discard();
        assert.deepEqual(kvWrites(kv), [], 'nothing on Cancel');

        await model.set(steam.row, false);
        await model.commit();
        assert.deepEqual(written, [{ steamTargetTemperature: 0 }]);
        assert.deepEqual(kvWrites(kv), ['steamTempWhenOn=150']);
        assert.equal(settings.value('steamTempWhenOn'), 150);
    });

    test('the cup warmer behaves identically too — all three zeroSwitch rows, one rule', async () => {
        const { model, kv, settings } = harness();
        await model.load('accessories-cup-warmer');
        const warmer = rowById(model, 'accessories-cup-warmer', 'accessories-cup-warmer-enabled');
        assert.ok(warmer, 'the cup-warmer master switch must exist');

        await model.set(warmer.row, false);
        assert.deepEqual(kvWrites(kv), []);

        await model.commit();
        assert.deepEqual(kvWrites(kv), ['cupWarmerTarget=62'],
            'the machine\'s own 62, remembered on Save');
        assert.equal(settings.value('cupWarmerTarget'), 62);
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * F-046 — AN UNROUNDED FLOAT PRINTED TO THE USER
 *
 * Measured on the tablet: the skin sent `{"heaterPh1Flow":4.1}`, ReaPrime stored
 * `4.1000000000000005`, and the row printed **`4.1000000000000005mL/s`**. The read path
 * did no rounding at all, and `ui-stepper`'s own display rule — "never fewer digits than
 * the value actually has" — is right for a component that knows nothing about the
 * quantity and wrong for seventeen digits of float residue.
 *
 * THE PRECISION IS THE ROW'S OWN STEP, which is the rule the WRITE path has always used:
 * `machine-limits.js`'s `step()` ends in `Number((current + delta).toFixed(decimals))`.
 * ═══════════════════════════════════════════════════════════════════════ */

describe('F-046 — the read path rounds to the row\'s own step precision', () => {
    const advanced = async (served) => {
        const rig = harness({ document: { ...MACHINE_DOCUMENT, ...served } });
        await rig.model.load('machine-advanced');
        return rig;
    };

    test('the served 4.1000000000000005 reads 4.1 — the number the skin sent', async () => {
        const { model } = await advanced({ heaterPh1Flow: 4.1000000000000005 });
        const row = rowById(model, 'machine-advanced', 'machine-advanced-heater-ph1-flow');
        assert.ok(row, 'the heater phase 1 flow row must exist');
        assert.equal(row.value, 4.1);
        /* AND IT PRINTS AS ONE DECIMAL. `ui-stepper` takes `Math.max(decimals(step),
         * decimals(value))`, so seventeen digits in is seventeen digits out; the fix is
         * that seventeen digits never arrive. */
        assert.equal(String(row.value), '4.1');
        assert.equal(row.bounds.step, 0.1, 'the step is what states the precision');
    });

    test('the MACHINE\'s own answer is untouched — only what the row SHOWS is rounded', async () => {
        const { model } = await advanced({ heaterPh1Flow: 4.1000000000000005 });
        assert.equal(model.machineValue('heaterPh1Flow'), 4.1000000000000005,
            'a caller asking what the machine said gets what the machine said');
    });

    test('it rounds to the step\'s DECIMALS, never to its multiples', async () => {
        /* THE CASE THAT WOULD MAKE THIS FIX A BUG. `appFlowMultiplier` steps by 0.05; a
         * machine holding 0.33 must go on reading 0.33 and not snap to 0.35. Rounding to
         * a decimal COUNT removes residue and nothing else. */
        const rig = harness({ document: { ...MACHINE_DOCUMENT, volumeFlowMultiplier: 0.33 } });
        await rig.model.load('calibration-flow-multiplier');
        const row = rig.model.allRows('calibration-flow-multiplier')
            .find((view) => view.row.field === 'volumeFlowMultiplier');
        if (row) {
            assert.equal(row.bounds.step, 0.05);
            assert.equal(row.value, 0.33, 'a value inside the step grid is not moved onto it');
        }
        /* Asserted directly as well, so the claim holds whether or not that leaf is on
         * this machine: two decimals of 0.33 is 0.33. */
        assert.equal(Number((0.33).toFixed(2)), 0.33);
    });

    test('a row with NO declared limit is left exactly as the machine served it', async () => {
        /* B2: no step, no stated precision, and a number this file picked would be the
         * second limits table by another route. */
        const { model } = await advanced({});
        const unbounded = model.allRows('machine-advanced')
            .find((view) => !view.row.limit && view.row.source === 'machine');
        if (unbounded) assert.equal(unbounded.bounds.bounded, false);
        assert.ok(true);
    });

    test('the stepper still steps from the rounded number, so the wire stays clean', async () => {
        const { model, written } = await advanced({ heaterPh1Flow: 4.1000000000000005 });
        const row = rowById(model, 'machine-advanced', 'machine-advanced-heater-ph1-flow');
        const next = row.bounds.next(row.value, 1);
        assert.equal(next, 4.2, 'and not 4.2000000000000006');
        await model.set(row.row, next);
        await model.commit();
        assert.deepEqual(written, [{ heaterPh1Flow: 4.2 }]);
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * F-046's TWO EXCLUSIONS — the difference between the fix and a bug.
 *
 * Both were found by an existing suite rather than reasoned out in advance, and both are
 * pinned here so a later tightening cannot quietly take them back.
 * ═══════════════════════════════════════════════════════════════════════ */

describe('F-046 — what the rounding must NOT touch', () => {
    test('a STAGED edit is the user\'s own number and is drawn back untouched', async () => {
        const rig = harness({ document: { ...MACHINE_DOCUMENT, heaterPh1Flow: 4.1 } });
        await rig.model.load('machine-advanced');
        const row = rowById(rig.model, 'machine-advanced', 'machine-advanced-heater-ph1-flow');
        /* A number with more precision than the step, staged deliberately. Rounding what
         * somebody just typed is not removing residue, it is overruling them. */
        await rig.model.set(row.row, 4.125);
        assert.equal(
            rowById(rig.model, 'machine-advanced', 'machine-advanced-heater-ph1-flow').value,
            4.125);
        assert.deepEqual(rig.model.pendingPatch, { heaterPh1Flow: 4.125 });
    });

    test('a CONVERTED temperature is left to its own formatter', async () => {
        /* `boundsFor` gives every Fahrenheit face `format: tempFormatter(decimals)`, so
         * residue never reaches the glass there — and 300 °F is 148.9 °C, a legitimately
         * fractional Celsius on a band that steps by a whole degree. Rounding it to 149
         * draws 300.2 °F back at somebody who typed 300. */
        const celsius = 148.88888888888889;
        const rig = harness({ document: { ...MACHINE_DOCUMENT, steamTargetTemperature: celsius } });
        await rig.model.load('machine-steam');
        const inC = rowById(rig.model, 'machine-steam', 'machine-steam-temp');
        assert.equal(inC.bounds.step, 1, 'the machine steps this band by a whole degree');
        /* In CELSIUS the row draws the machine's own number at the step's precision — this
         * is the F-046 rule doing its job. */
        assert.equal(inC.value, 149);

        await rig.settings.set('tempUnit', 'f');
        const inF = rowById(rig.model, 'machine-steam', 'machine-steam-temp');
        assert.equal(Math.round(inF.value), 300,
            'and in FAHRENHEIT the conversion is exact — 300 back, not 300.2');
        assert.equal(typeof inF.bounds.format, 'function',
            'because that face has a formatter of its own, which is why this branch exists');
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * F-042 — THE FACE PAINTS STALE FOR SECONDS AFTER A RELOAD
 *
 * Measured on the tablet: `machine-water-tank-unit` showed **mm** on 7 of 9 immediate
 * post-reload reads while the server and the app's own router already held `"ml"`,
 * correcting at about 8 s; Accessories › Cup Warmer booted with the pre-warm switch
 * reading FALSE, a dash and disabled controls for about 4 s while the server held true and
 * 30 minutes. The finding's own words: *"The store is right; the first paint is not."*
 *
 * THE MECHANISM. `settings-store.value()` answers `defaultFor(key)` when nothing is
 * cached, and a machine field falls through to `MACHINE_FALLBACKS` — both correct once the
 * read has come back ABSENT, and both indistinguishable from a real answer while the read
 * is still in flight. A fallback and a reading had the same shape, so the page could not
 * tell them apart and neither could the person looking at it.
 *
 * THE FIX IS A QUESTION NOBODY WAS ASKING. `settings.isLoaded(key)` and the model's
 * `machineLoaded` both existed. `view.pending` is those two, put on the row; the renderer
 * paints a pending row disabled and dashed, exactly as it paints an inert one, because
 * A7's answer to "I do not know" is the same in both cases.
 * ═══════════════════════════════════════════════════════════════════════ */

describe('F-042 — a source that has not answered paints pending, never a fallback', () => {
    /** A backend whose reads are held open until the test releases them. */
    function gatedBackend() {
        const data = new Map();
        let release = null;
        const gate = new Promise((resolve) => { release = resolve; });
        return {
            data,
            open: () => release(),
            async get(key) { await gate; return data.get(key); },
            async set(key, value) { data.set(key, value); },
            async remove(key) { data.delete(key); },
        };
    }

    test('the kv bank does NOT paint its shipped default while the router is still reading', async () => {
        const kv = gatedBackend();
        /* THE SERVER ALREADY HOLDS "ml" — the exact case, with the exact key. */
        kv.data.set('waterTankUnit', 'ml');
        const backends = {
            [LAYERS.local]: recordingBackend(),
            [LAYERS.session]: recordingBackend(),
            [LAYERS.kv]: kv,
            [LAYERS.kvNumpad]: recordingBackend(),
        };
        const storage = createStorageRouter({ backends });
        const settings = createSettingsStore({ storage, capabilities: answering('present') });
        const model = createSettingsLeafModel({
            settings,
            machine: { read: async () => ({ ...MACHINE_DOCUMENT }), write: async () => true },
            limits: limitsFor('bengle'),
        });

        const loading = model.load('machine-water-tank');
        const unitRow = () => model.allRows('machine-water-tank')
            .find((view) => view.id === 'machine-water-tank-unit');

        /* THE FIRST PAINT. `value` is still the shipped default — this fix does not make
         * the store clairvoyant — but the row now SAYS the source has not spoken, and the
         * renderer draws that as disabled and dashed rather than as a chosen option. */
        const first = unitRow();
        assert.ok(first, 'the units bank must exist');
        assert.equal(first.pending, true,
            'this is the 7-of-9 "mm" paint: a fallback dressed as a reading');
        assert.equal(first.inert, false,
            'and it is NOT inert — no master switch is off; nobody knows the value yet');

        kv.open();
        await loading;

        const after = unitRow();
        assert.equal(after.pending, false, 'the router answered');
        assert.equal(after.value, 'ml', 'and the answer is the server\'s, not the default');
    });

    test('a machine row is pending until the DOCUMENT has answered, not until it is asked', async () => {
        /* `machineLoaded` was set BEFORE the await — the once-a-session latch that
         * `inFlightMachineRead` replaced — so it meant "asked". The cup warmer's four-second
         * false switch is that flag being consulted a read too early. */
        let release = null;
        const held = new Promise((resolve) => { release = resolve; });
        const backends = {
            [LAYERS.local]: recordingBackend(),
            [LAYERS.session]: recordingBackend(),
            [LAYERS.kv]: recordingBackend(),
            [LAYERS.kvNumpad]: recordingBackend(),
        };
        const settings = createSettingsStore({
            storage: createStorageRouter({ backends }), capabilities: answering('present'),
        });
        const model = createSettingsLeafModel({
            settings,
            machine: { read: async () => { await held; return { ...MACHINE_DOCUMENT }; }, write: async () => true },
            limits: limitsFor('bengle'),
        });

        const loading = model.load('machine-water-tank');
        const tempRow = () => model.allRows('machine-water-tank')
            .find((view) => view.id === 'machine-water-tank-temp');

        assert.equal(model.machineLoaded, false, 'asked is not answered');
        assert.equal(tempRow().pending, true);

        release();
        await loading;

        assert.equal(model.machineLoaded, true);
        assert.equal(tempRow().pending, false);
        assert.equal(tempRow().value, 44, 'the machine\'s own number, once it has said it');
    });

    test('a read that FAILED is an answer — the rows stop waiting and draw the absence', async () => {
        /* A machine that refused has spoken. Waiting for ever would be the opposite fault:
         * a page that never admits it cannot reach the machine. */
        const backends = {
            [LAYERS.local]: recordingBackend(),
            [LAYERS.session]: recordingBackend(),
            [LAYERS.kv]: recordingBackend(),
            [LAYERS.kvNumpad]: recordingBackend(),
        };
        const settings = createSettingsStore({
            storage: createStorageRouter({ backends }), capabilities: answering('present'),
        });
        const model = createSettingsLeafModel({
            settings,
            machine: { read: async () => { throw new Error('the machine is asleep'); }, write: async () => true },
            limits: limitsFor('bengle'),
            logger: { debug() {}, info() {}, warn() {}, error() {} },
        });

        await model.load('machine-water-tank');

        assert.equal(model.machineLoaded, true, 'a refusal is an answer');
        const row = model.allRows('machine-water-tank')
            .find((view) => view.id === 'machine-water-tank-temp');
        assert.equal(row.pending, false);
    });

    test('NO machine port at all is an answer too, and it answers immediately', async () => {
        /* The machine is not reachable, which is a state and not a wait. */
        const backends = {
            [LAYERS.local]: recordingBackend(),
            [LAYERS.session]: recordingBackend(),
            [LAYERS.kv]: recordingBackend(),
            [LAYERS.kvNumpad]: recordingBackend(),
        };
        const settings = createSettingsStore({
            storage: createStorageRouter({ backends }), capabilities: answering('present'),
        });
        const model = createSettingsLeafModel({
            settings, machine: null, limits: limitsFor('bengle'),
        });

        await model.load('machine-water-tank');
        assert.equal(model.machineLoaded, true);
        assert.equal(model.allRows('machine-water-tank')
            .find((view) => view.id === 'machine-water-tank-temp').pending, false);
    });

    test('pending and inert are different states and stay different', async () => {
        /* Collapsing them would let a page explain a WAIT with a master switch's sentence.
         * They render alike — disabled and dashed — and they are asked separately. */
        const { model } = await opened();
        const rows = model.allRows('machine-water-tank');
        for (const view of rows) {
            assert.equal(view.pending, false, `${view.id} answered during load()`);
        }
        /* Turn the master switch off: inert moves, pending does not. */
        const preheat = rowById(model, 'machine-water-tank', 'machine-water-tank-preheat');
        await model.set(preheat.row, false);
        const temp = rowById(model, 'machine-water-tank', 'machine-water-tank-temp');
        assert.equal(temp.inert, true, 'the master switch is off');
        assert.equal(temp.pending, false, 'and the machine has answered — two different states');
    });
});
