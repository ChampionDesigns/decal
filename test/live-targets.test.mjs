/**
 * live-targets.test.mjs — the Live bands' policy, and the source rules that keep the
 * bands a COMPOSITION. No browser: everything here is either arithmetic over the one
 * limits table or a rule about what the two files may contain.
 *
 * The geometry — that the rail's tracks do not move when the mode changes, that the
 * hit floor is met, that focus rings are not clipped, that exactly one selection
 * treatment is painted — is in `test/render/live-bands.render.test.mjs`, at both Gate A
 * geometries.
 *
 * WHAT THIS SUITE IS FOR, one line each:
 *   the mode is the MACHINE's while the machine names one (Appendix item 3);
 *   the rail's tracks are the mode's, in a fixed order, and never more than the
 *       design floor pays for;
 *   B3's steam envelope arrives from the port and NOTHING here or in the screen knows
 *       a bound — 135 / 165 / 160 are asserted as the table's answers, and 130 / 170
 *       are asserted to be unreachable through the same door;
 *   L25's two toggles exist as real rows, fail-closed on their capability answers;
 *   D1 — the phase table's columns are the three, and no derived channel is named;
 *   L8 / L7 — neither file paints selection or hand-builds a control.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
    bandDerivationFor,
    DEFAULT_MODE, DEFAULT_PRESETS, LIVE_MODES, PHASE_COLUMNS, RAIL_ROW, STEAM_STOP, WATER_STOP,
    isRunning, modeFor, modeIsMachines, phaseRows, railRows, stepFor, stopModeRow,
    steamStopFrom, waterStopFrom, armValueFor, numpadBandFor,
} from '../src/lib/live-targets.js';
/* THE SETTINGS SIDE, IMPORTED SO THE TWO SURFACES CAN BE HELD AGAINST EACH OTHER. This
 * suite is about the Live rail, and it reaches across to the settings leaf model for one
 * section only — §3b, the pin that stops the two derivations parting again. See its own
 * header for why an equality test between two surfaces belongs in a suite rather than in a
 * comment. */
import { SETTINGS_ROWS } from '../src/lib/settings-leaves.js';
import { createSettingsLeafModel } from '../src/stores/settings-leaf-model.js';
import { createSettingsStore } from '../src/stores/settings-store.js';
import { createStorageRouter } from '../src/lib/storage-router.js';
import { createMemoryBackend } from '../src/lib/storage-backends.js';
import { LAYERS } from '../src/lib/storage-routes.js';
import { limitsFor, hasLimit } from '../src/lib/machine-limits.js';
import { machineFallbackFor } from '../src/lib/settings-defaults.js';
import { MACHINE_STATE } from '../src/data/machine-state.js';
import { r2MachineLimits } from '../src/data/adapters-r.js';
import { clamp } from '../src/lib/machine-limits.js';
/* THE CONVERSION, FROM THE MODULE THAT OWNS IT. `numpadBandFor`'s claim is about what
 * reaches the MACHINE after a display-unit clamp, and the only honest way to state that is
 * to convert back with the same function the screen converts back with. */
import { fromDisplayTemp, toDisplayTemp, TEMP_UNIT } from '../src/lib/temperature.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(REPO, rel), 'utf8');
const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const FILES = Object.freeze(['src/lib/live-targets.js', 'src/screens/live-screen.js']);
const CODE = Object.fromEntries(FILES.map((f) => [f, stripComments(read(f))]));

/* The two answers the R2 adapter gives for the two machine classes, reached the ONE
 * legal way — through the adapter, from a served capability answer, never a name.
 * `de1handler` emits its seven entries only for a Bengle, so a non-empty set is
 * ReaPrime's own "this is a Bengle" and `[]` is its own "this is not". */
const BENGLE = r2MachineLimits(['cupWarmer']).value;
const DE1 = r2MachineLimits([]).value;
const UNKNOWN = r2MachineLimits(null).value;

const MODES = LIVE_MODES.map((mode) => mode.id);
const rowsFor = (mode, extra = {}) => railRows({ mode, limits: BENGLE, ...extra });
const ids = (rows) => rows.map((row) => row.id);

/* ===========================================================================
 * 1. THE MODE — the machine's, then the choice
 * =========================================================================== */

describe('the mode', () => {
    test('the four modes are ReaPrime\'s own state names, not strings this tree made up', () => {
        assert.deepEqual(MODES, [
            MACHINE_STATE.ESPRESSO, MACHINE_STATE.STEAM, MACHINE_STATE.HOT_WATER, MACHINE_STATE.FLUSH,
        ]);
        // The generated enum is the source; a hand copy is how the old skin shipped
        // `READY: 'ready'`, a state in neither direction.
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
});

/* ===========================================================================
 * 2. THE RAIL'S TRACKS
 * =========================================================================== */

describe('the rail stands: Slate\'s nine rows, in every state', () => {
    /* BEN'S RULING, 22 Aug 2026 (ECM-772): "THE RAIL = SLATE'S RAIL. All rows standing,
     * dimmed per mode exactly as the oracle shows, top-down: GRIND, DOSE, DRINK
     * (+preset row 30/36/40/50), BREW, STEAM (its stop-mode + 45s), FLOW (+presets),
     * FLUSH, HOT WATER (volume stop), TEMPERATURE — with Slate's own SHORT labels."
     *
     * WHAT THESE TESTS USED TO ASSERT, and why it went. `railRows` returned ONE mode's
     * tracks and this block proved four things about that: the mode bank was track 1,
     * no mode wanted more than six tracks, each mode filled top-down, and a mode change
     * slid nothing. Recomposition was the answer to a floor constraint the ruling
     * reverses — the rail is Slate's nine rows now and `<live-rail>` scrolls when they
     * outrun it — so the six-track ceiling and the per-mode row lists are gone with the
     * thing they measured. What survives unchanged is the part that was never about
     * recomposition: a track names a LIMIT KEY, and an unserved key is unavailable
     * rather than invented.
     *
     * THE TWO STOP-MODE TOGGLES ARE NO LONGER TRACKS (it14). They were banks of their
     * own above steam and hot water; the descriptor rides the target row it governs
     * now, because Ben's enumeration is nine rows and Slate paints the condition
     * inside the label cell. Where each stop mode's CONTROL lives after that — and the
     * one place it does not — is recorded in live-screen.js's #renderStopCaption. */
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
        /* it14. The two stop-mode toggles had TRACKS of their own — a full-width bank
         * above steam and another above hot water — and eleven tracks is not Ben's
         * enumeration: "GRIND, DOSE, DRINK (+preset row), BREW, STEAM (its stop-mode
         * + 45s), FLOW (+presets), FLUSH, HOT WATER (volume stop), TEMPERATURE" names
         * NINE, with each stop mode named as part of its row rather than as a row.
         * The descriptor now rides the target row it governs, which is also where
         * Slate paints it (#steam-capability [i=49] is inside the steam label cell).
         *
         * The count is the claim: nine standing rows plus the two preset banks. */
        const standing = rows().filter((row) => row.kind !== RAIL_ROW.PRESETS);
        assert.equal(standing.length, 9, standing.map((r) => r.id).join(', '));
        const carrying = rows().filter((row) => row.stopMode).map((row) => row.id);
        assert.deepEqual(carrying, ['steam-stop-target', 'water-stop-target']);
        assert.equal(rows().filter((row) => row.kind === RAIL_ROW.STOP_MODE).length, 0,
            'a stop mode is not a track of its own any more');
    });

    test('the stop-mode descriptor keeps its id, its options and its gate', () => {
        /* Nothing about the MODEL changed with the composition: the same id the dim
         * map and the event handlers address, the same two options, and the same
         * fail-closed gate — only where it is rendered moved. */
        const steam = rows().find((row) => row.id === 'steam-stop-target').stopMode;
        assert.equal(steam.id, 'steam-stop');
        assert.deepEqual(steam.items.map((item) => item.value), ['time', 'milk']);
        assert.equal(steam.items[1].disabled, true, 'no milk probe offered — fail closed');
        /* AND THE VALUE IS NULL, WHICH IS THE ONE THING THAT DID CHANGE (27 August 2026).
         *
         * This line read `assert.equal(steam.value, 'time')` — over a `rows()` helper that
         * passes no stop mode at all. It was asserting that a rail told NOTHING about the
         * machine says the machine stops its steam on a timer, and that was the shape of the
         * defect the whole pass is about: `stopModeRow` coerced anything that was not Milk
         * onto Time, so "we have not been told" and "the machine stops on nothing" both came
         * out as "Timed stop" on screen. Absence is a real answer (A7) and this is where the
         * model says so; the caption renders the dash for it, which
         * `test/render/live-bands.render.test.mjs` measures. */
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
        /* ORACLE live-ready: [i=18] "Grind", [i=23] "Dose", [i=30] "Drink", [i=41]
         * "Brew", [i=48] "Steam", [i=56] "Flow", [i=67] "Flush", [i=74] "Hot Water",
         * [i=82] "Temperature". Decal's own inventions — "Drink weight", "Brew
         * temperature", "Water temperature" — wrapped mid-word in an 88px name column
         * and took DQ-735 with them when they went. */
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
        /* The one property recomposition traded away and this ruling buys back: a state
         * change moves no row. `railRows` takes no mode at all now, so the proof is that
         * the only inputs that CAN move a row are the two stop conditions, and they move
         * a row's value rather than its position. */
        const both = [
            railRows({ limits: BENGLE }),
            railRows({ limits: BENGLE, steamStop: STEAM_STOP.MILK, waterStop: WATER_STOP.WEIGHT }),
        ];
        assert.deepEqual(ids(both[0]), ids(both[1]));
        assert.equal(both[0].find((r) => r.id === 'steam-stop-target').limitKey, 'steamDuration');
        assert.equal(both[1].find((r) => r.id === 'steam-stop-target').limitKey, 'milkStopTemp');
    });

    test('track 0 carries the abort target, and it is GRIND\'s own track', () => {
        /* There used to be a `mode` track above the rail holding the PICKER and, beside
         * it, `<ui-stop-button>`. The picker went with the ruling — nine rows standing
         * leaves nothing to pick between, and Slate has no such control on Live — and an
         * empty track in its place is either a hole above GRIND at rest or a rail that
         * slides down when a shot starts. So the abort target rides the FIRST STANDING
         * ROW's track, which the model says with `abortSlot` rather than with an id, and
         * `RAIL_DIM_GROUP.grind` is the exemption that keeps it lit (a dimmed abort
         * target is the one dimming bug worse than L11). */
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
        /* ORACLE live-ready #drink-out-preset-1..4 [i=37..40] "30" "36" "40" "50" and
         * #steam-flow-preset-1..4 [i=63..66] "0.6" "0.8" "1.0" "1.2". They are shipped
         * defaults, not machine readings: `storage-routes.js` already declares where an
         * edited bank lives (drinkOutPresets / steamFlowPresets, KV, machine-scoped) and
         * no store reads those rows yet. */
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
        /* The lines fall after the drink presets, after brew, after the steam-flow
         * presets and after flush — four, for five blocks. `sectionStart` is derived
         * from each row's own section rather than counted, so a row added to a block
         * cannot silently become a block. */
        const starts = rows().filter((row) => row.sectionStart).map((row) => row.id);
        assert.deepEqual(starts,
            ['brew-temp', 'steam-stop-target', 'flush-duration', 'water-stop-target']);
        const sections = [...new Set(rows().map((row) => row.section).filter(Boolean))];
        assert.deepEqual(sections, ['espresso', 'brew', 'steam', 'flush', 'hotwater']);
    });

    test('the two continuation rows are the two Slate draws quietly, and no others', () => {
        // ORACLE [i=56] "Flow" and [i=82] "Temperature" render 12px against the block
        // headings' 17px.
        assert.deepEqual(rows().filter((row) => row.continuation).map((row) => row.id),
            ['steam-flow', 'water-temp']);
    });

    test('GRIND IS A LIVE CONTROL — the workflow does carry one after all', () => {
        /* THIS TEST USED TO PIN THE OPPOSITE, and the premise it rested on was wrong.
         * It read "no workflow field carries a grind setting", so the row was declared
         * unavailable with no range and the rail's FIRST control was dead on every
         * machine — Ben, 23 Aug 2026: "Grind seems to be grayed out for some reason".
         *
         * `WorkflowContext.grinderSetting` (`workflow_context.dart:9`) is the field, the
         * old app reads and writes exactly it (`ui.js:210-215`), and the shot record
         * carries it too. So the row has a range now, and the value's own absence is
         * still the dash — which is what A7 asked for and what the old pin confused with
         * a disabled control. */
        const grind = rows().find((row) => row.id === 'grind');
        assert.equal(grind.kind, RAIL_ROW.TARGET);
        assert.equal(grind.range, BENGLE.grind);
        assert.equal(grind.unavailable, null);
        const next = stepFor(BENGLE, 'grind');
        assert.equal(typeof next, 'function', 'there is something to step inside');
        /* The old app's own two steps: a whole number steps by 1, a fractional one by
         * 0.1 (`ui.js:93,:2152`). Grinders are marked both ways. */
        assert.equal(next(8, 1), 9);
        assert.equal(next(8.5, 1), 8.6);
        assert.equal(next(0, -1), 0, 'and the floor holds');
    });

    test('the three rows Slate\'s Live rail does not carry are not here either', () => {
        /* Steam temperature, flush temperature and flush flow were Decal's per-mode
         * lists paying for tracks recomposition made free. Ben's enumeration is closed
         * ("top-down: … TEMPERATURE") and each of the three has a home on the Settings
         * machine leaves — the drop is a composition change, recorded, not a loss. */
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

/* ===========================================================================
 * 3. L25 — THE TWO TOGGLES COME BACK
 * =========================================================================== */

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
            // Disabled, never removed: L25 is a bug about an invisible control.
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

/* ===========================================================================
 * 3b. ONE FACT, ONE SOURCE — THE RAIL AND THE SETTINGS BANK, HELD TOGETHER
 * ===========================================================================
 *
 * WHY THIS SECTION EXISTS, and it is the only place in this suite that imports the
 * settings side. Until 27 August 2026 the Live rail and Settings › Machine answered "what
 * ends a steam session" and "what ends a hot-water pour" from DIFFERENT STORES: Settings
 * read the machine, the rail read two KV rows of its own (`steamStopMode`,
 * `hotWaterStopMode`). Two sources for one fact, and they disagreed in both directions —
 * choose Off in Settings and the rail still said "Timed stop"; set hot water to stop at
 * weight and the rail's caption never knew; press the rail's water toggle and the machine
 * never heard. Measured on the recorded mock, whose machine holds
 * `stopHotWaterAtWeight: true` while the rail printed "Volume stop" and "240 mL" over it.
 *
 * WHAT A COMMENT CANNOT DO. The fix is that both surfaces now derive from the same machine
 * fields, and the rail says so in a paragraph — but a paragraph does not fail when someone
 * adds a fourth steam state to one side, or flips a boolean mapping on the other. These
 * tests run BOTH derivations over the same inputs and compare the answers, so the two can
 * only part by turning this file red.
 *
 * THE COMPARISON IS OF ANSWERS, NOT OF SPELLINGS. The bank's option ids are `off` /
 * `time` / `milk-temp` and the rail's switch positions are `off` / `time` / `milk`; that
 * difference is deliberate and is documented at `STEAM_STOP`. What must agree is WHICH
 * STATE each surface reports for a given machine, so the ids are mapped once, here, and
 * everything else is asserted equal.
 */

/** The bank's option id for the rail's switch position. One map, in one direction. */
const BANK_ID_FOR = Object.freeze({
    [STEAM_STOP.OFF]: 'off',
    [STEAM_STOP.TIME]: 'time',
    [STEAM_STOP.MILK]: 'milk-temp',
    [WATER_STOP.VOLUME]: 'volume',
    [WATER_STOP.WEIGHT]: 'weight',
});

/**
 * A machine with every offer PRESENT.
 *
 * WHY THE OFFERS ARE OPENED FOR THIS COMPARISON. Both banks carry an `unavailable` option
 * — "a machine with no milk probe cannot be in Milk Temp, so it reads as Time" — and that
 * is a GATE, not a derivation. Comparing the two surfaces with the gates shut would be
 * comparing what each does about a missing probe, which is a different question and is
 * pinned separately below. With the offers open, what is left to compare is the reading of
 * the machine's own fields, which is what this section is for.
 */
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
    /* SIX MACHINES, COVERING EVERY BRANCH OF THE DERIVATION: both fields zero (Off, and it
     * is a real state rather than an absence), each field positive alone, both positive
     * (the milk probe wins, because the list is ORDERED), and a document carrying neither
     * field (nothing known — an absence, and not Off). */
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
        /* A7. The bank draws no selection and the rail draws its dash; neither claims Off,
         * which is a state a machine is IN rather than a state we have not been told about.
         * The machine document is empty and `MACHINE_FALLBACKS` deliberately holds no
         * `milkStopTemp`, so the only field with a fallback is the duration — which is why
         * the bank is asked for `undefined` here through a port that serves nothing. */
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
        /* THIS TEST EXISTS SO THE DIFFERENCES ARE DELIBERATE. The section above proves the
         * two surfaces read one source and agree about every machine that has answered. They
         * do NOT agree about two other things, both of them about what to draw when
         * something is missing, and both of them differences of SURFACE LANGUAGE rather than
         * of source. Written down here so that neither is "fixed" by accident, and so the
         * day Ben rules on either there is one place to change.
         *
         * ONE — A MACHINE THAT HAS NOT ANSWERED. The settings model falls back to
         * `MACHINE_FALLBACKS`, so a Settings page opened against an unreachable machine
         * shows Ben's decided answer as selected (O3: "the current option should always be
         * shown as selected"). The rail shows the dash. The rail is not free to do
         * otherwise: it draws the dash for every unanswered NUMBER — `steamDuration` shows
         * "—", not "60 s" — so a caption reading "Timed stop" above a well reading "—" would
         * be the rail contradicting itself, which is the defect class this pass removed.
         *
         * TWO — AN OPTION THE MACHINE CANNOT HONOUR. Both banks carry `unavailable`, and
         * the settings model substitutes it for a disabled selection: a machine holding a
         * positive `stopAtTemperature` but with no milk probe reads as "Time" on the
         * Settings page. The rail reports the configuration and disables the option it
         * cannot arm. Neither is obviously right — Settings describes what the machine will
         * DO, the rail describes what it is SET to — and the state is unreachable from
         * either surface, because both refuse to arm a gated option. */
        assert.equal(waterStopFrom(undefined), null, 'the rail: an unserved field is an absence');
        assert.equal(await bankValue({}, 'machine-water-stop', 'machine-hot-water'), 'weight',
            'the bank: Ben\'s decided fallback, shown as selected');
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
        /* THE FIELD NAMES ARE THE JOIN. The tests above compare ANSWERS; this compares the
         * addresses those answers come from, so a rail that started deriving from some other
         * field would fail here even if its answers happened to match on the four machines
         * above. The registry is the authority and this reads it rather than restating it. */
        const steam = SETTINGS_ROWS.find((row) => row.id === 'machine-steam-stop');
        assert.deepEqual(steam.derivedFrom.map((entry) => entry.field), ['milkStopTemp', 'steamDuration'],
            'the bank derives the steam stop from two fields, in that order');
        assert.equal(steam.whenNone, 'off', 'and both at zero is Off, which is a state');
        /* The rail's own derivation, exercised through the two fields the registry names —
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
        /* THE OTHER HALF OF "ONE FACT, ONE SOURCE", and the half a value comparison cannot
         * catch: a rail that derived correctly AND went on writing a copy would pass every
         * test above and still be the defect. Both keys are retired in `storage-routes.js`,
         * so the router throws on them — this asserts that the two files that used to hold
         * the copy no longer name either key in CODE. Comments still discuss them, and must:
         * the retirement is the story. `stripComments` is why that is not a contradiction. */
        const wiring = stripComments(read('src/screens/live-wiring.js'));
        for (const key of ['steamStopMode', 'hotWaterStopMode']) {
            assert.doesNotMatch(wiring, new RegExp(`['"\`]${key}['"\`]`),
                `live-wiring.js still names the retired ${key} key in code`);
            assert.doesNotMatch(CODE['src/screens/live-screen.js'], new RegExp(`['"\`]${key}['"\`]`),
                `live-screen.js names the retired ${key} key in code`);
        }
    });

    test('the rail SHOWS three steam states and ARMS only two — Off is never written back', () => {
        /* THE ONE RULE THAT PROTECTS A DELIBERATE DECISION. Reading Off is required — the
         * machine can be in it and the caption has to say so. WRITING it is refused: coming
         * back out of Off needs a duration the machine no longer holds, and the rail commits
         * on the press with no Cancel, so a caption tap that zeroed both fields would be a
         * destructive setting hidden in a two-word microcap. The refusal is STRUCTURAL —
         * `next` is the only thing a press can name, and no state answers `off`. */
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

        /* AND OFF IS SHOWN, which is the half that makes the refusal honest rather than a
         * gap: the state reaches the descriptor and the row beneath it is the duration —
         * the control that gets the machine back out of Off. */
        const off = stopModeRow(MACHINE_STATE.STEAM, { steamStop: STEAM_STOP.OFF, offers: { milkProbe: true } });
        assert.equal(off.value, STEAM_STOP.OFF);
        assert.equal(off.next, STEAM_STOP.TIME, 'a press from Off arms the stop the row below already shows');
        const rows = railRows({ limits: BENGLE, steamStop: STEAM_STOP.OFF });
        assert.equal(rows.find((row) => row.id === 'steam-stop-target').limitKey, 'steamDuration');
    });

    test('arming a stop writes the number the settings model would restore', () => {
        /* `armValueFor` IS `restoreValueFor` FOR A SURFACE THAT HAS NO STAGING, and this
         * pins the ladder rather than the numbers: what the machine holds, else Ben's
         * decided fallback, else the floor of the band the control offers. The expected
         * values are COMPOSED from those two tables, so a change to either moves this test
         * with it instead of failing it. */
        assert.equal(armValueFor('steamDuration', 90, BENGLE), 90, 'what the machine holds wins');
        assert.equal(armValueFor('steamDuration', 0, BENGLE), machineFallbackFor('steamDuration'),
            "zero is not a value to come back to — Ben's decided duration is");
        assert.equal(machineFallbackFor('milkStopTemp'), undefined,
            'A7: nobody ever decided a milk temperature, and inventing one here would be the defect');
        assert.ok(hasLimit(BENGLE, 'milkStopTemp'));
        assert.equal(armValueFor('milkStopTemp', 0, BENGLE), BENGLE.milkStopTemp.min,
            'so arming the probe writes the lowest temperature the control itself offers');

        /* AND WITH NEITHER A FALLBACK NOR A BAND THERE IS NOTHING HONEST TO WRITE. Zero is
         * the DISARMED spelling, so the answer is zero and the caller's rule is to refuse
         * the press — never to send it, which would spell the opposite of what was pressed. */
        assert.equal(armValueFor('milkStopTemp', 0, null), 0);
    });
});

/* ===========================================================================
 * 4. B3 — THE STEAM ENVELOPE, THROUGH THE PORT
 * =========================================================================== */

describe('the steam envelope is the port\'s answer and nobody else\'s', () => {
    /* THE ROW MOVED, THE ENVELOPE DID NOT. `steam-temp` left the Live rail with Ben's
     * standing-rail ruling (Slate's rail carries no steam temperature; Settings >
     * machine-steam does, `settings-leaves.js:692`, naming this same limit key), so the
     * envelope is asserted where it actually lives — the R2 table and the step/clamp
     * functions every consumer of it goes through. B3's defect was never about which
     * screen drew the control; it was a 130..170 table that clamped users into the dead
     * band where the heater is off. */
    const steamRange = (table) => table.steamTemp ?? null;

    /* THE CEILING IS 170 ON A BENGLE SINCE 26 AUGUST 2026 and the FLOOR AND THE HOLE ARE
     * UNCHANGED — which is the half B3 was really about. The bench serves a Bengle holding
     * exactly 170, so a 165 ceiling was a skin refusing the machine's own value; 130 is
     * still inside the dead band where the heater is off, and is still unreachable.
     *
     * THE DE1 WENT BACK TO 160 ON 26 AUGUST 2026 AND THE BENGLE DID NOT — a correction made
     * in `machine-limits.js` by the pass that re-read the evidence, and this assertion had
     * pinned the one-day state where both classes carried 170. That reading was taken on a
     * BENGLE and is evidence about a Bengle; `doc/Skins.md:573` states 135-160 for a DE1,
     * nothing has been measured against one, and `adapters-r.js` returns that class for real
     * users. A ceiling is a safety band, and evidence for one machine is not evidence for
     * another. `test/machine-limits.test.mjs` carries the full argument at the row. */
    test('135 floor, a 170 ceiling on a Bengle and 160 on a DE1 — off the R2 table itself', () => {
        assert.equal(steamRange(BENGLE).floor, 135);
        assert.equal(steamRange(BENGLE).max, 170);
        assert.equal(steamRange(DE1).floor, 135);
        assert.equal(steamRange(DE1).max, 160);
        assert.notEqual(steamRange(BENGLE).max, steamRange(DE1).max,
            'two classes with one ceiling would make machineClass a parameter that changes nothing');
    });

    test('130 is unreachable: the clamp the numpad uses refuses the dead band', () => {
        // B3's defect in one line — Slate's table was 130..170 and 130 °C is inside the
        // dead band where the heater is off, so the clamp snapped users into a
        // temperature the machine does not hold. THAT half is unchanged.
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

    /* ═══════════════════════════════════════════════════════════════════════
     * `numpadBandFor` — THE BAND THE NUMPAD IS TOLD (27 August 2026)
     *
     * `live-screen.js`'s `unitForRow` comment named two shipping defects and said they
     * wanted one fix: the numpad's hint "reads the RAW R2 row and says '0-255 mL' under a
     * weight stop while the well beside it says g … the louder instance is temperature: in
     * Fahrenheit the same hint reads '70-110 °C' beside a well reading °F, on every
     * temperature row". Both were the numpad DERIVING a band from the machine's own table
     * while the stepper on the same row drew the display's. This is the rail's half.
     * ═══════════════════════════════════════════════════════════════════════ */

    test('a converted target hands over its DISPLAY band, and a clamp that speaks it', () => {
        const rows = railRows({ limits: BENGLE, tempUnit: 'F' });
        const row = rows.find((r) => r.limitKey === 'hotWaterTemp');
        const band = numpadBandFor(row, BENGLE, 'F');

        /* THE ROW'S OWN RANGE, WHICH IS THE STEPPER'S. Asserted as an equality between the
         * two controls rather than against numbers written here, because the claim is that
         * they cannot disagree — not that either matches this file. */
        assert.equal(band.min, row.range.min);
        assert.equal(band.max, row.range.max);
        assert.equal(band.unit, row.range.unit);
        assert.equal(band.label, `${row.range.min}–${row.range.max} ${row.range.unit}`);
        assert.match(band.label, /°F/);

        /* THE CLAMP CONVERTS IN, LETS THE PORT DECIDE, AND CONVERTS OUT. A value inside
         * the shown band comes back untouched; the raw table would have clamped it to the
         * machine's own ceiling, which is the number the defect produced. */
        assert.equal(band.clamp(150), 150, '150 °F is 65.6 °C and is inside the band');
        assert.notEqual(band.clamp(150), clamp(BENGLE, 'hotWaterTemp', 150));

        /* AND ABOVE THE BAND IT LANDS ON THE MACHINE'S OWN CEILING, WHICH IS THE CLAIM
         * THAT MATTERS — stated as what reaches the wire rather than as what is printed.
         *
         * THE TWO ARE NOT THE SAME NUMBER AND THAT IS POLICY 3, not a defect here. 99 °C
         * is 210.2 °F, and `displayRange` ROUNDS a printed bound to whole display units
         * because "a bound that shows a fraction invites a value the machine will refuse".
         * The clamp does not round: rounding it would put the ceiling at 210 °F, which
         * converts back to 98.9 °C and would make the machine's own top value unreachable
         * from a Fahrenheit tablet. So the pad prints 210, hands back 210.2, and the
         * machine gets 99 — and the drawn value rounds to the bound that was printed.
         * `boundsFor()` on the settings side has behaved this way since the conversion
         * landed; this states it rather than introducing a second rule. */
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
        /* 1 °C is 1.8 °F. A band whose every reachable value is a whole machine degree
         * must not look fractional to the numpad, or the decimal key lights up and can
         * only produce a number the clamp rounds away. */
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
        /* ONE MACHINE FIELD, TWO STOPS. `hotWaterVolume` is a volume cap in millilitres or
         * a weight cap in grams; the numbers do not move between them, because a millilitre
         * of water weighs a gram, and only the word does. */
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
        /* ABSENCE IS SPECIFIC, and `steamTemp` is the ONE key the unknown table
         * withholds — every other key the Live rail names is machine-independent and is
         * still there. GRIND used to be the second name on this list and is not any
         * more: it is machine-independent too (see the grind row's own test), so an
         * unresolved machine class leaves the rail with NO unavailable row at all in
         * this mode, because `steamTemp` is only a row under STEAM_STOP.MILK's
         * sibling. */
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

/* ===========================================================================
 * 5. D1 — THE FOOT BAND SHOWS WHAT THE DERIVATION SERVES, AND NO DERIVED CHANNEL
 * =========================================================================== */

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
        /* One decimal, from the model, AND SPELLED WITH IT: `Number(15.02.toFixed(1))` is
         * 15, which the grid renders as "15" in a column reading "15.0 / 30.0 / 45.0". The
         * cell is the rounded STRING so a decimal column stays a decimal column — the loop
         * proof rendered "8" beside "8.7" before this. Rounding still happens once. */
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

/* ===========================================================================
 * 6. L8 / L7 — THE BANDS COMPOSE, AND NOTHING IS HAND-BUILT
 * =========================================================================== */

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
        /* IT USED TO BE RENDERED DIRECTLY and this list held it with the rest. The
         * screen's two bare banks were the mode picker (gone with Ben's standing-rail
         * ruling) and the two stop-mode toggles (gone with it14's caption), so the tag
         * no longer appears in the template — and asserting that it does would have
         * forced a bank back onto a screen whose composition has no place for one.
         *
         * WHAT THE ROW STILL HAS TO PROVE is L8's actual claim: the four
         * --ui-selected-* dials are reached through ONE component. The screen composes
         * #36 and #37, both of which ARE uses of <ui-bank>, and it keeps the import so
         * the element is defined before either child upgrades. Nothing here is a local
         * copy of a bank, which is what the next two tests measure. */
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

/* ===========================================================================
 * 7. THE SCREEN LAWS, over the two files this row added or changed
 * =========================================================================== */

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
        /* AND SINCE 27 AUGUST 2026 IT IS ALSO GIVEN THE FACE THE SCREEN IS DRAWING.
         *
         * The table alone was the defect, not the fix: it is always in the MACHINE's
         * units, so the numpad's hint and its clamp were the machine's while every other
         * control on the row drew the display's. `numpadBandFor` composes the band from
         * the row's own range — which is `machine-limits.js`'s row, converted or not —
         * so this screen still passes a DERIVED band and never a written one. The table
         * stays wired because it is #53's fallback, which is why the two lines above are
         * still assertions rather than history. */
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
        /* The buffer holds the last shot until the next one starts, so `live.ok` stays
         * true for as long as the machine sits idle after a pull. Preferring it
         * unconditionally moved the date and the title with the arrows and changed
         * nothing else. Ben, 23 Aug 2026. */
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
