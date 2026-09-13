

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
    bandDerivationFor,
    DEFAULT_MODE, DEFAULT_PRESETS, LIVE_MODES, PHASE_COLUMNS, RAIL_ROW, STEAM_STOP, WATER_STOP,
    isRunning, machineTone, modeFor, modeIsMachines, phaseRows, railRows, stepFor, stopModeRow,
    steamStopFrom, waterStopFrom, armValueFor, numpadBandFor,
} from '../src/lib/live-targets.js';
import { SETTINGS_ROWS } from '../src/lib/settings-leaves.js';
import { createSettingsLeafModel } from '../src/stores/settings-leaf-model.js';
import { createSettingsStore } from '../src/stores/settings-store.js';
import { createStorageRouter } from '../src/lib/storage-router.js';
import { createMemoryBackend } from '../src/lib/storage-backends.js';
import { LAYERS } from '../src/lib/storage-routes.js';
import { limitsFor, hasLimit } from '../src/lib/machine-limits.js';
import { machineFallbackFor } from '../src/lib/settings-defaults.js';
import { MACHINE_STATE, MACHINE_STATES } from '../src/data/machine-state.js';
import { r2MachineLimits } from '../src/data/adapters-r.js';
import { clamp } from '../src/lib/machine-limits.js';
import { fromDisplayTemp, toDisplayTemp, TEMP_UNIT } from '../src/lib/temperature.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(REPO, rel), 'utf8');
const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const FILES = Object.freeze(['src/lib/live-targets.js', 'src/screens/live-screen.js']);
const CODE = Object.fromEntries(FILES.map((f) => [f, stripComments(read(f))]));

const BENGLE = r2MachineLimits(['cupWarmer']).value;
const DE1 = r2MachineLimits([]).value;
const UNKNOWN = r2MachineLimits(null).value;

const MODES = LIVE_MODES.map((mode) => mode.id);
const rowsFor = (mode, extra = {}) => railRows({ mode, limits: BENGLE, ...extra });
const ids = (rows) => rows.map((row) => row.id);

describe('the mode', () => {
    test('the four modes are ReaPrime\'s own state names, not strings this tree made up', () => {
        assert.deepEqual(MODES, [
            MACHINE_STATE.ESPRESSO, MACHINE_STATE.STEAM, MACHINE_STATE.HOT_WATER, MACHINE_STATE.FLUSH,
        ]);
        assert.match(read('src/lib/live-targets.js'), /from '\.\.\/data\/machine-state\.js'/);
    });

    test('the machine wins while it names a mode — Appendix item 3', () => {
        for (const state of MODES) {
            assert.equal(modeFor(state, MACHINE_STATE.FLUSH), state, `${state} did not win`);
            assert.equal(modeIsMachines(state), true);
        }
    });

    test('and the chosen mode is used when the machine is doing something else', () => {
        for (const state of ['idle', 'heating', 'sleeping', 'cleaning', '', null, undefined]) {
            assert.equal(modeFor(state, MACHINE_STATE.STEAM), MACHINE_STATE.STEAM);
            assert.equal(modeIsMachines(state), false);
        }
        assert.equal(modeFor('idle', 'nonsense'), DEFAULT_MODE, 'an unknown choice falls to the default');
    });

    test('every working state is abortable — the STOP target is told, it does not decide', () => {
        for (const state of MODES) assert.equal(isRunning(state), true);
        for (const state of ['idle', 'heating', 'sleeping', '']) assert.equal(isRunning(state), false);
    });

    const TONES = new Set(['ok', 'active', 'attention', 'busy', 'asleep', 'error']);

    test('every machine state has a tone, and it is one of the six', () => {
        for (const state of MACHINE_STATES) {
            const tone = machineTone(state);
            assert.ok(tone, `${state} has no tone — the dot would be missing for it`);
            assert.ok(TONES.has(tone), `${state} asks for a tone the chip does not have: ${tone}`);
        }
    });

    test('the mapping, state by state', () => {
        assert.deepEqual(
            Object.fromEntries(MACHINE_STATES.map((s) => [s, machineTone(s)])),
            {
                idle: 'ok', schedIdle: 'ok',
                heating: 'active', preheating: 'active', espresso: 'active',
                hotWater: 'active', flush: 'active', steam: 'active', steamRinse: 'active',
                airPurge: 'active', cleaning: 'active', descaling: 'active',
                calibration: 'active', selfTest: 'active', fwUpgrade: 'active',
                skipStep: 'active',
                error: 'error',
                needsWater: 'attention',
                busy: 'busy', booting: 'busy',
                sleeping: 'asleep',
            },
        );
    });

    test('anything that is not a machine state has no tone at all', () => {
        for (const state of ['', null, undefined, 'ready', 'nonsense']) {
            assert.equal(machineTone(state), null,
                'a machine that has said nothing yet has no colour to show');
        }
    });
});

describe('the rail stands: Slate\'s nine rows, in every state', () => {
    const rows = () => railRows({ limits: BENGLE });

    test('the whole rail, in the oracle\'s own order', () => {
        assert.deepEqual(ids(rows()), [
            'grind',
            'dose',
            'drink-weight', 'drink-weight-presets',
            'brew-temp',
            'steam-stop-target',
            'steam-flow', 'steam-flow-presets',
            'flush-duration',
            'water-stop-target',
            'water-temp',
        ]);
    });

    test('NINE rows, and the two stop conditions ride the rows they belong to', () => {
        const standing = rows().filter((row) => row.kind !== RAIL_ROW.PRESETS);
        assert.equal(standing.length, 9, standing.map((r) => r.id).join(', '));
        const carrying = rows().filter((row) => row.stopMode).map((row) => row.id);
        assert.deepEqual(carrying, ['steam-stop-target', 'water-stop-target']);
        assert.equal(rows().filter((row) => row.kind === RAIL_ROW.STOP_MODE).length, 0,
            'a stop mode is not a track of its own any more');
    });

    test('the stop-mode descriptor keeps its id, its options and its gate', () => {
        const steam = rows().find((row) => row.id === 'steam-stop-target').stopMode;
        assert.equal(steam.id, 'steam-stop');
        assert.deepEqual(steam.items.map((item) => item.value), ['time', 'milk']);
        assert.equal(steam.items[1].disabled, true, 'no milk probe offered — fail closed');
        assert.equal(steam.value, null, 'a rail told nothing must not name a stop condition');
        assert.equal(steam.next, null, 'and a press cannot mean "the other one" when there is no this one');

        const water = rows().find((row) => row.id === 'water-stop-target').stopMode;
        assert.equal(water.id, 'water-stop');
        assert.deepEqual(water.items.map((item) => item.value), ['volume', 'weight']);
        assert.equal(water.value, null);
        assert.equal(water.next, null);

        /* And the gate still opens when the machine offers the option. */
        const offered = railRows({ limits: BENGLE, offers: { milkProbe: true } });
        assert.equal(offered.find((row) => row.id === 'steam-stop-target').stopMode.items[1].disabled,
            false);
    });

    test('the labels are Slate\'s SHORT ones, read off the oracle and not invented', () => {
        const labels = Object.fromEntries(rows().filter((r) => r.label).map((r) => [r.id, r.label]));
        assert.equal(labels.grind, 'Grind');
        assert.equal(labels.dose, 'Dose');
        assert.equal(labels['drink-weight'], 'Drink');
        assert.equal(labels['brew-temp'], 'Brew');
        assert.equal(labels['steam-stop-target'], 'Steam');
        assert.equal(labels['steam-flow'], 'Flow');
        assert.equal(labels['flush-duration'], 'Flush');
        assert.equal(labels['water-stop-target'], 'Hot Water');
        assert.equal(labels['water-temp'], 'Temperature');
    });

    test('the rail does not change with the mode — that is what "standing" means', () => {
        const both = [
            railRows({ limits: BENGLE }),
            railRows({ limits: BENGLE, steamStop: STEAM_STOP.MILK, waterStop: WATER_STOP.WEIGHT }),
        ];
        assert.deepEqual(ids(both[0]), ids(both[1]));
        assert.equal(both[0].find((r) => r.id === 'steam-stop-target').limitKey, 'steamDuration');
        assert.equal(both[1].find((r) => r.id === 'steam-stop-target').limitKey, 'milkStopTemp');
    });

    test('track 0 carries the abort target, and it is GRIND\'s own track', () => {
        const [first] = rows();
        assert.equal(first.id, 'grind');
        assert.equal(first.abortSlot, true, 'the first standing row carries the stop button');
        assert.equal(rows().filter((r) => r.abortSlot).length, 1, 'exactly one abort slot');
        assert.equal(RAIL_ROW.MODE, undefined, 'the picker kind is gone, not merely unused');
        for (const row of rows()) {
            if (row.kind === RAIL_ROW.TARGET) assert.ok(row.limitKey, `${row.id} has no limit key`);
        }
    });

    test('the two preset banks are Slate\'s own, and a caller\'s list still wins', () => {
        const banks = Object.fromEntries(rows()
            .filter((row) => row.kind === RAIL_ROW.PRESETS)
            .map((row) => [row.limitKey, [...row.presets]]));
        assert.deepEqual(banks.drinkWeight, [30, 36, 40, 50]);
        assert.deepEqual(banks.steamFlow, [0.6, 0.8, 1.0, 1.2]);
        assert.deepEqual(DEFAULT_PRESETS.drinkWeight, [30, 36, 40, 50]);

        const mine = railRows({ limits: BENGLE, presets: { drinkWeight: [18, 36] } });
        assert.deepEqual([...mine.find((r) => r.id === 'drink-weight-presets').presets], [18, 36]);
        // Per key: overriding one bank does not remove the other.
        assert.ok(mine.some((r) => r.id === 'steam-flow-presets'));
        // An empty list is not a row.
        const none = railRows({ limits: BENGLE, presets: { drinkWeight: [], steamFlow: [] } });
        assert.deepEqual(ids(none).filter((id) => id.endsWith('presets')), []);
    });

    test('every section but the first opens with a hairline, and the sections are Slate\'s five', () => {
        const starts = rows().filter((row) => row.sectionStart).map((row) => row.id);
        assert.deepEqual(starts,
            ['brew-temp', 'steam-stop-target', 'flush-duration', 'water-stop-target']);
        const sections = [...new Set(rows().map((row) => row.section).filter(Boolean))];
        assert.deepEqual(sections, ['espresso', 'brew', 'steam', 'flush', 'hotwater']);
    });

    test('the two continuation rows are the two Slate draws quietly, and no others', () => {
        assert.deepEqual(rows().filter((row) => row.continuation).map((row) => row.id),
            ['steam-flow', 'water-temp']);
    });

    test('GRIND IS A LIVE CONTROL — the workflow does carry one after all', () => {
        const grind = rows().find((row) => row.id === 'grind');
        assert.equal(grind.kind, RAIL_ROW.TARGET);
        assert.equal(grind.range, BENGLE.grind);
        assert.equal(grind.unavailable, null);
        const next = stepFor(BENGLE, 'grind');
        assert.equal(typeof next, 'function', 'there is something to step inside');
        /* The old app's own two steps: a whole number steps by 1, a fractional one by
         * 0.1. Grinders are marked both ways. */
        assert.equal(next(8, 1), 9);
        assert.equal(next(8.5, 1), 8.6);
        assert.equal(next(0, -1), 0, 'and the floor holds');
    });

    test('the three rows Slate\'s Live rail does not carry are not here either', () => {
        for (const id of ['steam-temp', 'flush-temp', 'flush-flow']) {
            assert.ok(!ids(rows()).includes(id), `${id} is still on the Live rail`);
        }
    });

    test('every target row names a limit KEY and carries the table\'s own range', () => {
        for (const row of rows().filter((r) => r.kind === RAIL_ROW.TARGET)) {
            assert.ok(row.limitKey, `${row.id} has no limit key`);

            assert.equal(row.range, BENGLE[row.limitKey],
                `${row.id}'s range is not the table's own object`);
            assert.equal(row.unavailable, null);
        }
    });
});

describe('L25: the steam and hot-water mode toggles are visible controls again', () => {
    test('steam offers Time and Milk, and the toggle governs the row under it', () => {
        const time = rowsFor(MACHINE_STATE.STEAM, { steamStop: STEAM_STOP.TIME });
        const milk = rowsFor(MACHINE_STATE.STEAM, { steamStop: STEAM_STOP.MILK, offers: { milkProbe: true } });
        assert.equal(time.find((r) => r.id === 'steam-stop-target').limitKey, 'steamDuration');
        assert.equal(milk.find((r) => r.id === 'steam-stop-target').limitKey, 'milkStopTemp');
        // The toggle stays in the same track either way — the value changes, not the layout.
        assert.deepEqual(ids(time), ids(milk));
    });

    test('hot water offers Volume and Weight, and both arm the same served field', () => {
        const volume = rowsFor(MACHINE_STATE.HOT_WATER, { waterStop: WATER_STOP.VOLUME });
        const weight = rowsFor(MACHINE_STATE.HOT_WATER, { waterStop: WATER_STOP.WEIGHT, offers: { stopAtWeight: true } });
        assert.equal(volume.find((r) => r.id === 'water-stop-target').limitKey, 'hotWaterVolume');
        assert.equal(weight.find((r) => r.id === 'water-stop-target').limitKey, 'hotWaterVolume');
        assert.deepEqual(ids(volume), ids(weight));
    });

    test('the second option is FAIL-CLOSED: only a true opens it, and null is not a false', () => {
        for (const answer of [false, null, undefined]) {
            const steam = stopModeRow(MACHINE_STATE.STEAM, { offers: { milkProbe: answer } });
            const water = stopModeRow(MACHINE_STATE.HOT_WATER, { offers: { stopAtWeight: answer } });
            assert.equal(steam.items[1].disabled, true, `milk was offered on ${answer}`);
            assert.equal(water.items[1].disabled, true, `weight was offered on ${answer}`);
            // Disabled, never removed: the rule is a bug about an invisible control.
            assert.equal(steam.items.length, 2);
            assert.equal(water.items.length, 2);
        }
        assert.equal(stopModeRow(MACHINE_STATE.STEAM, { offers: { milkProbe: true } }).items[1].disabled, false);
    });

    test('espresso and flush have no stop-mode choice, and none is invented for them', () => {
        assert.equal(stopModeRow(MACHINE_STATE.ESPRESSO, {}), null);
        assert.equal(stopModeRow(MACHINE_STATE.FLUSH, {}), null);
    });
});

/** The bank's option id for the rail's switch position. One map, in one direction. */
const BANK_ID_FOR = Object.freeze({
    [STEAM_STOP.OFF]: 'off',
    [STEAM_STOP.TIME]: 'time',
    [STEAM_STOP.MILK]: 'milk-temp',
    [WATER_STOP.VOLUME]: 'volume',
    [WATER_STOP.WEIGHT]: 'weight',
});

const EVERYTHING_OFFERED = Object.freeze({
    capability: () => 'present',
    sensorCapability: () => Object.freeze({ capability: 'present' }),
});

/** A leaf model over a machine document, with nothing else attached. */
function leafModel(document_, capabilities = EVERYTHING_OFFERED) {
    const backends = Object.fromEntries(
        [LAYERS.local, LAYERS.session, LAYERS.kv, LAYERS.kvNumpad]
            .map((layer) => [layer, createMemoryBackend()]),
    );
    const settings = createSettingsStore({ storage: createStorageRouter({ backends }), capabilities });
    const machine = { read: async () => ({ ...document_ }), write: async () => true };
    return createSettingsLeafModel({ settings, machine, limits: limitsFor('bengle') });
}

/** What the settings BANK shows as selected, for a machine holding `document_`. */
async function bankValue(document_, rowId, leaf, capabilities = EVERYTHING_OFFERED) {
    const model = leafModel(document_, capabilities);
    await model.loadMachine();
    const row = model.allRows(leaf).find((view) => view.id === rowId);
    return row ? row.value : undefined;
}

describe('the rail and the settings bank read ONE source per stop mode', () => {
    const STEAM_MACHINES = Object.freeze([
        Object.freeze({ name: 'both zero', doc: { steamDuration: 0, milkStopTemp: 0 }, rail: STEAM_STOP.OFF }),
        Object.freeze({ name: 'a duration only', doc: { steamDuration: 45, milkStopTemp: 0 }, rail: STEAM_STOP.TIME }),
        Object.freeze({ name: 'a milk temperature only', doc: { steamDuration: 0, milkStopTemp: 62 }, rail: STEAM_STOP.MILK }),
        Object.freeze({ name: 'both positive', doc: { steamDuration: 45, milkStopTemp: 62 }, rail: STEAM_STOP.MILK }),
    ]);

    for (const machine of STEAM_MACHINES) {
        test(`steam, ${machine.name}: the rail and the bank agree`, async () => {
            const rail = steamStopFrom(machine.doc);
            assert.equal(rail, machine.rail, 'the rail read the machine wrongly');
            const bank = await bankValue(machine.doc, 'machine-steam-stop', 'machine-steam');
            assert.equal(bank, BANK_ID_FOR[rail],
                `the Live rail says ${rail} and Settings says ${bank} about one machine`);
        });
    }

    test('steam: a machine that has answered NEITHER field is an absence on both surfaces', async () => {
        assert.equal(steamStopFrom({}), null);
        assert.equal(steamStopFrom(null), null);
        assert.equal(steamStopFrom({ steamDuration: undefined, milkStopTemp: null }), null);
    });

    for (const [held, rail] of [[false, WATER_STOP.VOLUME], [true, WATER_STOP.WEIGHT]]) {
        test(`hot water, stopHotWaterAtWeight = ${held}: the rail and the bank agree`, async () => {
            assert.equal(waterStopFrom(held), rail);
            const bank = await bankValue({ stopHotWaterAtWeight: held }, 'machine-water-stop', 'machine-hot-water');
            assert.equal(bank, BANK_ID_FOR[rail],
                `the Live rail says ${rail} and Settings says ${bank} about one machine`);
        });
    }

    test('hot water: an unserved boolean is an absence to the rail, never a false', async () => {
        assert.equal(waterStopFrom(undefined), null);
        assert.equal(waterStopFrom(null), null);
    });

    test('the two surfaces differ in exactly TWO places, and neither is the source', async () => {
        assert.equal(waterStopFrom(undefined), null, 'the rail: an unserved field is an absence');
        assert.equal(await bankValue({}, 'machine-water-stop', 'machine-hot-water'), 'weight',
            'the bank: the decided fallback, shown as selected');
        assert.equal(steamStopFrom({}), null);
        assert.equal(await bankValue({}, 'machine-steam-stop', 'machine-steam'), 'time',
            'the bank: a decided steam duration of 60 makes the fallback a timed stop');

        const noProbe = Object.freeze({
            capability: () => 'present',
            sensorCapability: () => Object.freeze({ capability: 'absent' }),
        });
        const armed = { steamDuration: 0, milkStopTemp: 62 };
        assert.equal(steamStopFrom(armed), STEAM_STOP.MILK, 'the rail: what the machine is SET to');
        assert.equal(await bankValue(armed, 'machine-steam-stop', 'machine-steam', noProbe), 'time',
            'the bank: `unavailable` substitutes the option a probe-less machine can honour');
    });

    test('both surfaces name the SAME machine fields, read off the registry', () => {
        const steam = SETTINGS_ROWS.find((row) => row.id === 'machine-steam-stop');
        assert.deepEqual(steam.derivedFrom.map((entry) => entry.field), ['milkStopTemp', 'steamDuration'],
            'the bank derives the steam stop from two fields, in that order');
        assert.equal(steam.whenNone, 'off', 'and both at zero is Off, which is a state');
        /* The rail's own derivation, exercised through the two fields the registry names
         * one at a time, so a rail reading only one of them cannot pass. */
        for (const [index, { field, is }] of steam.derivedFrom.entries()) {
            const only = { milkStopTemp: 0, steamDuration: 0, [field]: 7 };
            const answer = steamStopFrom(only);
            assert.equal(BANK_ID_FOR[answer], is,
                `the rail does not read ${field} as ${is} (precedence position ${index})`);
        }

        const water = SETTINGS_ROWS.find((row) => row.id === 'machine-water-stop');
        assert.equal(water.field, 'stopHotWaterAtWeight');
        for (const [option, held] of Object.entries(water.fieldValues)) {
            assert.equal(BANK_ID_FOR[waterStopFrom(held)], option,
                `the rail maps ${held} to something other than ${option}`);
        }
    });

    test('the rail keeps NO store of its own for either stop mode', () => {
        const wiring = stripComments(read('src/screens/live-wiring.js'));
        for (const key of ['steamStopMode', 'hotWaterStopMode']) {
            assert.doesNotMatch(wiring, new RegExp(`['"\`]${key}['"\`]`),
                `live-wiring.js still names the retired ${key} key in code`);
            assert.doesNotMatch(CODE['src/screens/live-screen.js'], new RegExp(`['"\`]${key}['"\`]`),
                `live-screen.js names the retired ${key} key in code`);
        }
    });

    test('the rail SHOWS three steam states and ARMS only two — Off is never written back', () => {
        const offered = new Set();
        for (const value of [STEAM_STOP.OFF, STEAM_STOP.TIME, STEAM_STOP.MILK, null, undefined, 'nonsense']) {
            const row = stopModeRow(MACHINE_STATE.STEAM, { steamStop: value, offers: { milkProbe: true } });
            if (row.next !== null) offered.add(row.next);
            assert.notEqual(row.next, STEAM_STOP.OFF, `a press from ${value} would have written Off`);
            assert.equal(row.items.some((item) => item.value === STEAM_STOP.OFF), false,
                'Off is not one of the options the rail can arm');
        }
        assert.deepEqual([...offered].sort(), [STEAM_STOP.MILK, STEAM_STOP.TIME].sort(),
            'the rail arms exactly the two working modes');

        const off = stopModeRow(MACHINE_STATE.STEAM, { steamStop: STEAM_STOP.OFF, offers: { milkProbe: true } });
        assert.equal(off.value, STEAM_STOP.OFF);
        assert.equal(off.next, STEAM_STOP.TIME, 'a press from Off arms the stop the row below already shows');
        const rows = railRows({ limits: BENGLE, steamStop: STEAM_STOP.OFF });
        assert.equal(rows.find((row) => row.id === 'steam-stop-target').limitKey, 'steamDuration');
    });

    test('arming a stop writes the number the settings model would restore', () => {
        assert.equal(armValueFor('steamDuration', 90, BENGLE), 90, 'what the machine holds wins');
        assert.equal(armValueFor('steamDuration', 0, BENGLE), machineFallbackFor('steamDuration'),
            "zero is not a value to come back to — the decided duration is");
        assert.equal(machineFallbackFor('milkStopTemp'), undefined,
            'A7: nobody ever decided a milk temperature, and inventing one here would be the defect');
        assert.ok(hasLimit(BENGLE, 'milkStopTemp'));
        assert.equal(armValueFor('milkStopTemp', 0, BENGLE), BENGLE.milkStopTemp.min,
            'so arming the probe writes the lowest temperature the control itself offers');

        assert.equal(armValueFor('milkStopTemp', 0, null), 0);
    });
});

describe('the steam envelope is the port\'s answer and nobody else\'s', () => {
    const steamRange = (table) => table.steamTemp ?? null;

    test('135 floor, a 170 ceiling on a Bengle and 160 on a DE1 — off the R2 table itself', () => {
        assert.equal(steamRange(BENGLE).floor, 135);
        assert.equal(steamRange(BENGLE).max, 170);
        assert.equal(steamRange(DE1).floor, 135);
        assert.equal(steamRange(DE1).max, 160);
        assert.notEqual(steamRange(BENGLE).max, steamRange(DE1).max,
            'two classes with one ceiling would make machineClass a parameter that changes nothing');
    });

    test('130 is unreachable: the clamp the numpad uses refuses the dead band', () => {
        assert.equal(clamp(BENGLE, 'steamTemp', 130), 135, '130 must not be settable');
        assert.equal(clamp(BENGLE, 'steamTemp', 170), 170, 'and 170 is the machine\'s own value');
        assert.equal(clamp(BENGLE, 'steamTemp', 200), 170, 'with nothing above it');
        assert.equal(clamp(BENGLE, 'steamTemp', 60), 0, 'the hole snaps to the nearer end');
    });

    test('the step function skips the hole in both directions', () => {
        const next = stepFor(BENGLE, 'steamTemp');
        assert.equal(next(0, 1), 135, 'stepping up from off lands on the floor');
        assert.equal(next(135, -1), 0, 'stepping down from the floor lands on off');
        assert.equal(next(170, 1), 170, 'and the ceiling holds');
    });

    test('a converted target hands over its DISPLAY band, and a clamp that speaks it', () => {
        const rows = railRows({ limits: BENGLE, tempUnit: 'F' });
        const row = rows.find((r) => r.limitKey === 'hotWaterTemp');
        const band = numpadBandFor(row, BENGLE, 'F');

        assert.equal(band.min, row.range.min);
        assert.equal(band.max, row.range.max);
        assert.equal(band.unit, row.range.unit);
        assert.equal(band.label, `${row.range.min}–${row.range.max} ${row.range.unit}`);
        assert.match(band.label, /°F/);

        assert.equal(band.clamp(150), 150, '150 °F is 65.6 °C and is inside the band');
        assert.notEqual(band.clamp(150), clamp(BENGLE, 'hotWaterTemp', 150));

        assert.equal(fromDisplayTemp(band.clamp(999), TEMP_UNIT.FAHRENHEIT),
            clamp(BENGLE, 'hotWaterTemp', 999),
            'whatever the pad hands back, the machine gets its own ceiling');
        assert.equal(Math.round(band.clamp(999)), band.max,
            'and it draws as the bound the hint printed');
        assert.equal(band.clamp(-999), band.min);
        assert.equal(toDisplayTemp(clamp(BENGLE, 'hotWaterTemp', -999), TEMP_UNIT.FAHRENHEIT),
            band.min, 'the floor has no rounding error to carry');
    });

    test('the precision is the MACHINE\'s, so a converted step does not invent a decimal', () => {
        const rows = railRows({ limits: BENGLE, tempUnit: 'F' });
        const water = numpadBandFor(rows.find((r) => r.limitKey === 'hotWaterTemp'), BENGLE, 'F');
        assert.equal(water.step, BENGLE.hotWaterTemp.step * 9 / 5, 'the step IS converted');
        assert.equal(water.decimals, 0, 'and the precision is not');

        /* AND A BAND THAT REALLY DOES CARRY A TENTH KEEPS IT. `brewTemp` steps by half a
         * machine degree, so the decimal key belongs there in either unit. */
        const brew = numpadBandFor(rows.find((r) => r.limitKey === 'brewTemp'), BENGLE, 'F');
        assert.equal(brew.decimals, 1);
    });

    test('an unconverted target is the table\'s own band, and the ROW may restate the word', () => {
        const volume = railRows({ limits: BENGLE, waterStop: WATER_STOP.VOLUME })
            .find((r) => r.limitKey === 'hotWaterVolume');
        const weight = railRows({
            limits: BENGLE, waterStop: WATER_STOP.WEIGHT, offers: { stopAtWeight: true },
        }).find((r) => r.limitKey === 'hotWaterVolume');

        const asVolume = numpadBandFor(volume, BENGLE);
        const asWeight = numpadBandFor(weight, BENGLE);
        assert.equal(asVolume.unit, 'mL');
        assert.equal(asWeight.unit, 'g');
        assert.equal(asWeight.max, asVolume.max, 'one field, one ceiling');
        assert.match(asWeight.label, /\bg\b/);
        assert.doesNotMatch(asWeight.label, /mL/,
            'the hint under a weight stop must not be written in millilitres');
        /* THE ZERO MEANING SURVIVES THE RESTATEMENT, because it is the range's and the row
         * overrides only the word. */
        assert.match(asVolume.label, /0 = /);
        assert.match(asWeight.label, /0 = /);
    });

    test('no row for the key is NO BAND — A7, not a stand-in ceiling', () => {
        const row = railRows({ limits: UNKNOWN, steamStop: STEAM_STOP.TIME })
            .find((r) => r.limitKey === 'steamDuration');
        assert.notEqual(numpadBandFor(row, UNKNOWN), null, 'a machine-independent row still has one');
        assert.equal(numpadBandFor({ limitKey: 'steamTemp' }, UNKNOWN), null);
        assert.equal(numpadBandFor(null, BENGLE), null);
        assert.equal(numpadBandFor({ limitKey: '' }, BENGLE), null);
    });

    test('with the machine class unknown the steam envelope is ABSENT, never a stand-in', () => {
        assert.equal(steamRange(UNKNOWN), undefined ?? null);
        assert.equal(stepFor(UNKNOWN, 'steamTemp'), null, 'nothing to step inside');
        const rows = railRows({ limits: UNKNOWN, steamStop: STEAM_STOP.MILK });
        const unavailable = rows.filter((r) => r.unavailable !== null && r.unavailable !== undefined);
        assert.deepEqual(unavailable.map((r) => r.id), []);
        assert.equal(rows.find((r) => r.id === 'steam-stop-target').limitKey, 'milkStopTemp');
        assert.notEqual(UNKNOWN.milkStopTemp, undefined, 'the milk probe band is not machine-class gated');
    });

    test('neither file writes a bound of its own', () => {
        for (const file of FILES) {
            assert.doesNotMatch(CODE[file], /\b(130|135|160|165|170)\b/, `${file} writes a steam bound`);
            assert.doesNotMatch(CODE[file], /limitsFor/, `${file} reaches past r2MachineLimits for the table`);
        }
    });
});

describe('the foot band\'s phase table', () => {
    const derivation = (phases) => ({ ok: true, phases });

    test('three columns, and they are the derivation\'s — no R / Z / W, no estimator (D1)', () => {
        assert.deepEqual(PHASE_COLUMNS.map((column) => column.key), ['time', 'weight', 'volume']);
        for (const file of FILES) {
            assert.doesNotMatch(CODE[file], /resistance|impedance|estimator|puck/i,
                `${file} names a derived channel — D1 keeps them out of v1 entirely`);
        }
    });

    test('the three phases are rows, and Total is the emphasised one', () => {
        const rows = phaseRows(derivation({
            preinfusion: { seconds: 15.02, weight: 10.04, volume: 17 },
            extraction: { seconds: 30, weight: 29, volume: 30 },
            total: { seconds: 45, weight: 39, volume: 47 },
        }));
        assert.deepEqual(rows.map((row) => row.key), ['preinfusion', 'extraction', 'total']);
        assert.equal(rows[2].emphasis, true);
        assert.deepEqual(rows[0].cells, { time: '15.0', weight: '10.0', volume: '17.0' });
        assert.deepEqual(rows[2].cells, { time: '45.0', weight: '39.0', volume: '47.0' });
    });

    test('an absent phase is a row with no cells — nothing is computed to fill it', () => {
        const rows = phaseRows(derivation({
            preinfusion: { seconds: 15, weight: 10, volume: null },
            extraction: null,
            total: { seconds: 15, weight: 10, volume: null },
        }));
        assert.deepEqual(rows[1].cells, {}, 'a shot that never left preinfusion has no extraction numbers');
        assert.equal('volume' in rows[0].cells, false, 'a null reading is absent, not zero');
    });

    test('no derivation, or a refused one, is three empty rows and not a table of zeroes', () => {
        for (const input of [null, undefined, { ok: false, reason: 'noSamples' }]) {
            const rows = phaseRows(input);
            assert.equal(rows.length, 3);
            for (const row of rows) assert.deepEqual(row.cells, {});
        }
    });
});

describe('L8 / L7: one selection component, and no local copy of anything', () => {
    const SCREEN = CODE['src/screens/live-screen.js'];

    test('the screen composes the library tags the inventory names', () => {
        for (const tag of [
            'ui-favourites-bank', 'ui-preset-bank', 'ui-stepper', 'ui-numeric-keypad',
            'ui-stop-button', 'ui-data-grid', 'ui-rating-control', 'ui-status-chip',
            'ui-button', 'ui-icon-button', 'ui-chart-card', 'ui-stat-tile',
        ]) {
            assert.ok(SCREEN.includes(`<${tag}`), `the screen does not compose <${tag}>`);
            assert.ok(SCREEN.includes(`src/components/${tag}.js`), `<${tag}> is used without being imported`);
        }
    });

    test('<ui-bank> is reached THROUGH its two uses, and is still the only selection', () => {
        assert.ok(!SCREEN.includes('<ui-bank'),
            'a bare bank is back on this screen — the composition has no track for one');
        assert.ok(SCREEN.includes('src/components/ui-bank.js'),
            '<ui-bank> must stay imported: #36 and #37 are uses of it');
        for (const use of ['<ui-favourites-bank', '<ui-preset-bank']) {
            assert.ok(SCREEN.includes(use), `the screen must still compose ${use}>`);
        }
    });

    test('the screen authors no control element of its own', () => {
        for (const element of ['<button', '<input', '<select', '<textarea', '<a ', '<table']) {
            assert.ok(!SCREEN.includes(element),
                `the screen hand-builds ${element} — a copy of a library control is the L8 defect class`);
        }
    });

    test('the screen paints no selection and writes no selection state', () => {
        assert.doesNotMatch(SCREEN, /--ui-selected-/,
            'a selected look outside <ui-bank> is L8 recreated one shadow root out');
        assert.doesNotMatch(SCREEN, /aria-(selected|checked|pressed)/,
            'the aria state of a selection is the bank\'s (Appendix 15), never a screen\'s');
    });

    test('and it declares no colour, no font-face and no !important', () => {
        assert.doesNotMatch(SCREEN, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
        assert.doesNotMatch(SCREEN, /@font-face|!important/);
    });
});

describe('screen laws', () => {
    test('no endpoint, no store, no adapter and no machine name', () => {
        for (const file of FILES) {
            assert.doesNotMatch(CODE[file], /['"`][^'"`]*\/(api|ws)\/v1/, `${file} spells a path`);
            assert.doesNotMatch(CODE[file], /from '[^']*\/stores\//, `${file} reads a store`);
            assert.doesNotMatch(CODE[file], /adapters-r/, `${file} imports the R module directly`);
            assert.doesNotMatch(CODE[file], /\b(bengle|de1|decent)\b/i, `${file} reads a machine name`);
        }
    });

    test('the model module is pure: no DOM, no Lit, no timer', () => {
        const model = CODE['src/lib/live-targets.js'];
        assert.doesNotMatch(model, /document|window|customElements|from 'lit'/);
        assert.doesNotMatch(model, /setTimeout|setInterval|fetch\(/);
    });

    test('the numpad is the ONE typed path, and it is given the table rather than a range', () => {
        assert.match(CODE['src/screens/live-screen.js'], /\.limits=\$\{this\.limits/);
        assert.match(CODE['src/screens/live-screen.js'], /\.limitKey=/);
        assert.match(CODE['src/screens/live-screen.js'], /\.band=\$\{numpadBandFor\(/);
        assert.doesNotMatch(CODE['src/screens/live-screen.js'], /\bmin\s*:\s*\d/,
            'the screen composes no band of its own');
    });
});

/* ═══════════════════════════════════ which shot the band and the plot are about ══ */

describe('bandDerivationFor — the arrows, the buffer and a running shot', () => {
    const live = { ok: true, id: 'live' };
    const stored = { ok: true, id: 'stored' };
    const empty = { ok: false, reason: 'noSamples' };

    test('at rest with no browsing, the buffer\'s shot wins', () => {
        assert.equal(bandDerivationFor(live, stored), live);
    });

    test('BROWSING WINS OVER A SHOT THAT IS OVER — the arrows\' whole effect', () => {
        assert.equal(bandDerivationFor(live, stored, { browsing: true }), stored);
    });

    test('A RUNNING SHOT WINS OVER BROWSING — the pour is what the screen is for', () => {
        assert.equal(bandDerivationFor(live, stored, { browsing: true, running: true }), live);
    });

    test('with nothing in the buffer, the stored shot is what there is', () => {
        assert.equal(bandDerivationFor(null, stored), stored);
        assert.equal(bandDerivationFor(empty, stored), stored);
    });

    test('browsing with nothing stored is NOTHING, not the shot the arrows left', () => {
        /* The band is about the row the arrows are on. A row whose record has not landed
         * yet shows the empty plot, which is true, rather than the previous shot's
         * numbers under the new shot\'s date. */
        assert.equal(bandDerivationFor(live, null, { browsing: true }), null);
    });

    test('with neither, the live side\'s own refusal is what the plot prints', () => {
        assert.equal(bandDerivationFor(empty, null), empty, 'its reason is the message');
        assert.equal(bandDerivationFor(null, null), null);
    });

    test('a running machine with no samples yet still shows the buffer\'s answer', () => {
        assert.equal(bandDerivationFor(empty, stored, { running: true }), empty);
    });
});
