/**
 * settings-leaves.test.mjs — wave 5.4's one-primitive cluster at source and model level:
 * `settings-row-thirty-leaves`, `c6-density-type-scale`, `d8-way-out-of-the-skin`,
 * `d11-save-count`, `d4-d5-d6-scope-boundary`.
 *
 * WHAT IS HERE AND WHAT IS IN THE RENDER SUITE. Anything about a rendered box is measured
 * off the engine in `test/render/settings-leaves.render.test.mjs`. What is here is the
 * class of claim a measurement cannot make: that a number exists in exactly ONE place,
 * that a range is never typed twice, that a renderer has no branch nothing reaches, that
 * a leaf cannot read a store directly, and that the count crossing to the band is the
 * model's own rather than a second tally.
 *
 * THE REGISTRY IS UNDER TEST AS DATA. Every assertion below quantifies over the whole of
 * it, so a row added next month is covered by the same tests without anyone remembering
 * to extend them — which is the only kind of totality test worth writing over 37 leaves.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../scripts/lib/source-scan.js';

import { SETTINGS_TREE, allLeaves, rowShownOn } from '../src/lib/settings-nav.js';
import { MACHINE_CLASSES } from '../src/lib/machine-limits.js';
import { LEAF_DESCRIPTION } from '../src/lib/settings-leaf-copy.js';
import {
    SETTINGS_ROWS,
    PENDING_ROWS,
    BESPOKE_LEAVES,
    LEAF_NOTES,
    LEAF_KIND,
    ARCHETYPE,
    CONTROL_ARCHETYPES,
    SOURCE,
    DENSITY_ROW,
    leafKind,
    rowsForLeaf,
    pendingForLeaf,
    noteForLeaf,
    registryKeys,
    machineFields,
    archetypeCounts,
    leavesWithRows,
} from '../src/lib/settings-leaves.js';
import {
    DENSITY_STEPS,
    DENSITY_VALUES,
    DEFAULT_DENSITY_STEP,
    DENSITY_BASE_PROPERTY,
    TYPE_SCALE_PROPERTY,
    applyDensity,
    clearDensity,
    normaliseDensity,
} from '../src/lib/density.js';
import { createStorageRouter } from '../src/lib/storage-router.js';
import { LAYERS, settingsKeys, routeFor } from '../src/lib/storage-routes.js';
import { createSettingsStore } from '../src/stores/settings-store.js';
import {
    createSettingsLeafModel, machinePortFor, COMMIT_REFUSAL, PANEL_SETTING_NAMES,
} from '../src/stores/settings-leaf-model.js';
import { limitsFor, rangeHint } from '../src/lib/machine-limits.js';
import { DE1_SETTINGS_WRITE_KEYS } from '../src/data/rea-de1-settings.js';
import { FIELD_DOORS, DOORS } from '../src/stores/machine-fields-port.js';

const read = (rel) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

/** The three files this cluster owns, plus the sheet C6 had to split. */
const LEAF_FILES = [
    'src/lib/settings-leaves.js',
    'src/lib/density.js',
    'src/screens/settings-leaf.js',
    'src/stores/settings-leaf-model.js',
    'src/screens/settings-model.js',
];
const SOURCE_TEXT = Object.fromEntries(LEAF_FILES.map((f) => [f, read(f)]));

/** CSS comments are template CONTENT, so both passes run — a comment quoting a defect
 *  ("gap-[14px]", "130–170") must never read as committing it. */
const stripCssComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, ' ');
const CODE = Object.fromEntries(
    LEAF_FILES.map((f) => [f, stripCssComments(stripComments(SOURCE_TEXT[f]))]),
);
const TOKENS = read('styles/tokens.css');

/* ---------------------------------------------------------------------------
 * A model over real stores. Memory backends, the real router, the real settings
 * store — so "resolves through the routing table" is exercised rather than mocked.
 * ------------------------------------------------------------------------- */

function memoryBackend({ failWrites = false } = {}) {
    const data = new Map();
    return {
        data,
        async get(key) { return data.get(key); },
        async set(key, value) {
            if (failWrites) throw new Error('backend refused');
            data.set(key, value);
        },
        async remove(key) { data.delete(key); },
    };
}

const MACHINE_DOCUMENT = Object.freeze({
    fan: 30, usb: true, flushTemp: 90, flushTimeout: 5, flushFlow: 6,
    hotWaterFlow: 8, steamFlow: 1.2, tankTemp: 20, steamPurgeMode: 0,
});

/* `machineClass` DEFAULTS TO null, WHICH SHOWS EVERY ROW, and that keeps every test written
 * before the row gate existed answering exactly what it did. A test that cares which machine
 * is connected passes one; everything else is asking a question the class does not change. */
function harness({ capabilities = null, kvFails = false, machine = 'ok', limits = limitsFor('bengle'),
    machineClass = null, document: served = MACHINE_DOCUMENT, panel = null } = {}) {
    const backends = {
        [LAYERS.local]: memoryBackend(),
        [LAYERS.session]: memoryBackend(),
        [LAYERS.kv]: memoryBackend({ failWrites: kvFails }),
        [LAYERS.kvNumpad]: memoryBackend(),
    };
    const storage = createStorageRouter({ backends });
    const settings = createSettingsStore({ storage, capabilities });
    const written = [];
    const port = machine === 'none' ? null : {
        read: async () => ({ ...served }),
        write: async (patch) => { written.push(patch); return machine !== 'fails'; },
    };
    const model = createSettingsLeafModel({ settings, machine: port, limits, machineClass, panel });
    return { backends, settings, model, written };
}

const rowById = (model, leaf, id) => model.allRows(leaf).find((view) => view.id === id);

/* ===========================================================================
 * 1. TOTALITY — 37 leaves, 9 bespoke, 28 CLASSIFIED primitive, 19 COMPOSING #29
 * =========================================================================== */

describe('the registry accounts for every leaf exactly once', () => {
    const leafIds = new Set(allLeaves().map((leaf) => leaf.id));

    test('thirty-two leaves, TWENTY bespoke, twelve classified primitive', () => {
        /* THIRTY-EIGHT SINCE 24 AUG 2026. The thirty-eighth is `units-language-time`
         * (Ben: "For the screen saver clock or clock in general we should give the option
         * to show 24hr or 12hr with am/pm added to 12 hr") — a leaf rather than a row on
         * `Temperature`, whose NAME is the quantity it sets, so a clock format there is a
         * control nobody would look for. */
        /* 37 SINCE 26 AUGUST 2026. `extensions-dye2` is deleted: its ONE switch had a
         * control, a routing row and a store, and nothing in `src/` read it — a whole leaf
         * in the sub-nav for a preference that changed nothing. Ben: "delete the DYE2 leaf
         * and move what it does into Plugins", where DYE2 is already listed with the
         * enable switch every other plugin gets. */
        /* 37 -> 32 ON 28 AUGUST 2026, Ben: three merges, five pages removed. Fifteen of
         * the thirty-seven carried two controls or fewer, and three groups of them were
         * asking one question each: `display-screen` (brightness, size, wake lock),
         * `calibration-hardware` (refill kit, voltage, fan threshold) and
         * `units-language-units` (temperature, time). NO ROW MOVED AND NO ROW ID CHANGED —
         * only each row's `leaf`, which is why the row count below is untouched at 57.
         * Ben kept Select Language, Default Load Settings and both Maintenance pages
         * separate, and that is what keeps every category at two leaves or more. */
        assert.equal(leafIds.size, 32, 'the nav model holds 32 leaves');
        /* TEN SINCE 24 AUGUST 2026. §4.4 measured nine; the tenth is
         * `updates-firmware-update`, which D4 had reduced to a sentence and Ben reversed
         * — "I should be able to pick a file, but it should also have a 'latest' button
         * that pulls it". A leaf with a catalog, two install paths and a progress track
         * is not a settings row, so it is bespoke by the same rule the other nine are. */
        /* TWENTY-ONE BECAME TWENTY ON 26 AUGUST 2026, and a bespoke leaf going away is
         * the direction this number is supposed to move. `accessories-cup-warmer` drew
         * four controls by hand because their values were on two routes the leaf model
         * could not reach; a DOOR (`cupWarmerDoorFor`) made them four ordinary registry
         * rows, in the order Ben asked for, and the hand-drawn section went with them. A
         * leaf is bespoke because it needs a LAYOUT nothing else has — never because its
         * data was awkward to fetch. */
        /* 21 -> 20 on 28 Aug 2026: ARCHETYPE.SLIDER retired `display-screen`'s bespoke
         * half, which was the brightness slider and nothing else. */
        assert.equal(Object.keys(BESPOKE_LEAVES).length, 20,
            'LAYOUT_SPEC §4.4 measured nine; the firmware leaf is the tenth (Ben, 24 Aug 2026) '
            + 'and ten more landed the same day on "lets fix all the settings pages then now" — '
            + 'every one of them a door with nobody walking through it, not one needing a route '
            + 'the generated table did not already carry; the twenty-first reversed the F3/Q1 '
            + 'screen law, and the cup warmer left again on 26 Aug when a door turned its four '
            + 'hand-drawn controls into four registry rows');
        const primitive = [...leafIds].filter((id) => leafKind(id) === LEAF_KIND.PRIMITIVE);
        assert.equal(primitive.length, 12,
            'the CLASSIFICATION, as a number: leafKind() is NOT-in-BESPOKE_LEAVES, so this counts '
            + 'leaves by exclusion — it is NOT the count of leaves that compose #29 (see the next test)');
        assert.equal(primitive.length + Object.keys(BESPOKE_LEAVES).length, leafIds.size);
    });

    /* The number the wave's headline actually meant, pinned separately so it can never be
     * reported as the classification again. §4.4 projects ~30; as built it is 19. */
    test('eighteen leaves compose the settings row — twelve of them primitive', () => {
        const composing = leavesWithRows();
        /* 56 THEN 55 THEN 56, ALL ON 26 AUGUST 2026. In: the cup warmer's plate reading,
         * which Slate prints and this skin had dropped. Out: 'Last scale used', a READING
         * over a key nothing ever wrote — it printed the absence dash on every machine for
         * ever, and the device list beside it now names every remembered scale. In again:
         * the steam milk target, because the Steam stop bank offered a Milk Temp mode with
         * no control anywhere to set the temperature it stops at. And once more for the
         * hot-water stop lookahead, which Slate renders as a full row and this registry had
         * recorded as "no control to match" — a reason that was not true of Slate's page. */
        assert.equal(SETTINGS_ROWS.length, 58, '58 live rows');
        assert.equal(composing.length, 18, 'spread over 18 DISTINCT leaves');

        /* SIX BESPOKE LEAVES ALSO CARRY #29 ROWS, and the rule always allowed it: "A leaf
         * may still carry registry ROWS — its bespoke half is a layout, not an exemption
         * from the row vocabulary." The screen renders both halves for every bespoke leaf,
         * so `connection-scale`'s power-mode bank is a row and its scan list is bespoke,
         * on one page. */
        const bespokeComposing = composing.filter((id) => leafKind(id) === LEAF_KIND.BESPOKE);
        /* FOUR, NOT FIVE, SINCE 26 AUGUST 2026: `accessories-cup-warmer` stopped being
         * bespoke at all when a door turned its four hand-drawn controls into four
         * registry rows. It still composes; it just composes ONLY rows now. */
        /* SIX SINCE 28 AUGUST 2026: `display-screen` joined when its page merged and left
         * again when ARCHETYPE.SLIDER made it primitive. */
        assert.deepEqual([...bespokeComposing].sort(), [
            'accessories-usb-charger',
            'connection-machine',
            'connection-scale',
            /* `display-screen` LEFT THIS LIST THE SAME DAY IT JOINED IT. It arrived when
             * the page merge gave Brightness two registry rows, on the reasoning "the
             * slider stays bespoke because there is no SLIDER in ARCHETYPE". Adding the
             * archetype removed that reason, so the leaf is primitive and its slider is a
             * row like any other. The shape it demonstrated — a bespoke half over registry
             * rows — is still covered by the five below. */
            'display-screen-saver',
            'display-skin',
            /* `help-keyboard-shortcuts` LEFT THIS LIST on 26 August 2026: its one registry
             * row printed the NUMBER of stored overrides above a list that names every
             * binding, and with none stored it printed a bare dash under a heading. The
             * leaf is still bespoke — it has the binding table — and it now composes rows
             * from nowhere. */
            'machine-sleep-wake-schedules',
        ].sort());
        assert.equal(composing.length - bespokeComposing.length, 12, 'so 12 PRIMITIVE leaves render a row');
        /* THE FIFTH BESPOKE COMPOSER ARRIVED 26 AUG 2026: `machine-sleep-wake-schedules`
         * kept its schedule LIST and gave up its two hand-drawn settings, which are now
         * registry rows through `presenceDoorFor`. It is the shape the rule always
         * allowed — "a leaf may still carry registry ROWS; its bespoke half is a layout,
         * not an exemption from the row vocabulary" — and it is the shape the cup warmer
         * left by, from the other side. */

        /* The rest are declared, not missing — that is what keeps the registry honest. */
        const silent = [...leafIds]
            .filter((id) => leafKind(id) === LEAF_KIND.PRIMITIVE && !composing.includes(id));
        /* ZERO. It was NINE before 24 August 2026, and the last of them —
         * `calibration-default-load-settings` — became the twenty-first bespoke leaf when
         * F3/Q1 was reversed. Every leaf this skin has now draws something. */
        assert.equal(silent.length, 0, '16 classified primitive, and all but the wake-lock pair draw');
        for (const id of silent) {
            if (id === 'calibration-default-load-settings') {
                /* F3/Q1's leaf: zero rows AND zero note, by the screen law. */
                assert.equal(pendingForLeaf(id).length, 0, `${id} must hold no declared row`);
                assert.equal(noteForLeaf(id), null, `${id} must hold no note`);
                continue;
            }
            const declared = pendingForLeaf(id).length > 0 || noteForLeaf(id) !== null;
            assert.ok(declared, `${id} renders nothing and declares nothing — an undeclared hole`);
        }
    });

    /* A SENTENCE WITH NO LEAF IS THE SAME DRIFT AS A LEAF WITH NO SENTENCE, and only one
     * of the two was visible. `settings-leaf-copy.js` says the point of a table is that "a
     * leaf without a sentence is visible as a hole in this file" — true, and it is a hole a
     * READER sees. The inverse is invisible: `extensions-dye2` was deleted from the tree on
     * 26 August 2026 and its description sat in the copy table for a day afterwards,
     * describing a page nobody could reach. `storage-routes.js` refused exactly this when
     * it gave the surviving DYE2 keys no `leaf` field — "a key naming a leaf that does not
     * exist is how a routing table starts describing a tree it no longer matches" — and
     * this is that rule, applied to the copy table by code rather than by eye. */
    test('every sentence in the copy table names a leaf the tree has', () => {
        for (const id of Object.keys(LEAF_DESCRIPTION)) {
            assert.ok(leafIds.has(id),
                `settings-leaf-copy.js describes "${id}", which is not a leaf in settings-nav.js`);
        }
    });

    test('every bespoke id and every row id names a leaf that exists', () => {
        for (const id of Object.keys(BESPOKE_LEAVES)) {
            assert.ok(leafIds.has(id), `${id} is not a leaf in settings-nav.js`);
            assert.ok(BESPOKE_LEAVES[id].length > 0, `${id} does not say WHY it is bespoke`);
        }
        for (const row of SETTINGS_ROWS) {
            assert.ok(leafIds.has(row.leaf), `row ${row.id} belongs to no leaf`);
        }
        for (const row of PENDING_ROWS) {
            assert.ok(leafIds.has(row.leaf), `pending row for ${row.leaf} belongs to no leaf`);
        }
        for (const id of Object.keys(LEAF_NOTES)) {
            assert.ok(leafIds.has(id), `a note names ${id}, which is not a leaf`);
        }
    });

    test('row ids are unique, so a second implementation of one row cannot exist (T7)', () => {
        const ids = SETTINGS_ROWS.map((row) => row.id);
        assert.equal(new Set(ids).size, ids.length, 'duplicate row id');
        // T7's other half: "a second, live Fan implementation". One fan row, one leaf.
        const fan = SETTINGS_ROWS.filter((row) => row.limit === 'fanThreshold');
        assert.equal(fan.length, 1, 'the fan threshold has exactly one row');
    });

    test('every declared-but-not-built row names its owner', () => {
        for (const row of PENDING_ROWS) {
            assert.ok(row.owner && row.owner.length > 20,
                `${row.leaf} / ${row.name} is declared pending with no owner — an absence with no reason`);
        }
    });

    /* The gap this closes (wave 5.4, cross-2): the test above only walks the SILENT
     * leaves, so a leaf that drew one row and dropped four Slate controls satisfied every
     * assertion in this file while declaring nothing. Six such leaves are now declared;
     * the seventh, `display-display-size`, is deliberately absent — its dropped control is
     * queued for Ben (c-leaves-volume-7) and nothing here decides it. */
    test('a leaf that renders SOMETHING and drops Slate controls declares the drop too', () => {
        /* SIX BECAME ONE ON 24 AUGUST 2026, and the list shrinking is the point of the
         * whole pass: `machine-advanced`, `connection-scale`, `accessories-usb-charger`,
         * `accessories-cup-warmer`, `help-keyboard-shortcuts` and
         * `calibration-flow-multiplier` were each a leaf that drew a row and dropped a
         * Slate control. All six are complete now, so none of them is a partial leaf and
         * none of them holds a declaration any more.
         *
         * THE ONE THAT REMAINS IS NOT A CONTROL AT ALL. `help-quickstart-guide` declares
         * `helpLaunches`, the counter behind the button's default, which exists so
         * "never chose" stays distinguishable from "chose to show". It is a partial leaf
         * in the arithmetic and a complete one on screen. */
        const partial = ['help-quickstart-guide'];
        const composing = leavesWithRows();
        for (const id of partial) {
            assert.ok(composing.includes(id),
                `${id} is in this list because it CARRIES a live row — if it stopped, the `
                + 'list is wrong, not the assertion');
            assert.ok(pendingForLeaf(id).length > 0,
                `${id} renders a row and drops a Slate control with no declaration — the `
                + 'undeclared-partial-leaf hole cross-2 measured');
        }
        /* Not a subset of the silent ten: these are the second KIND of entry. */
        for (const id of partial) {
            assert.ok(rowsForLeaf(id).length > 0 && pendingForLeaf(id).length > 0,
                `${id} must hold both a live row and a pending declaration`);
        }
    });

    test('the headline arithmetic, reported so the digest cannot drift from the tree', () => {
        /* 22 -> 23 in wave 5.4's bespoke cluster: D9's flow-calibration factor became a
         * live stepper row on `calibration-flow-multiplier`, retiring the pending row that
         * had named the wrong route as its owner.
         * 23 -> 25 on 21 Aug 2026 (cmp-sm-1): machine-steam gained the Duration stepper
         * and the steam-purge-mode select. Both were UNDECLARED drops — no pending row,
         * no manifest entry — and the leaf count does not move, because machine-steam
         * was already composing.
         * 25 -> 26 on 22 Aug 2026 (7-live-polish review): machine-hot-water gained the
         * stop-mode bank — L25's hot-water half, the regression the live-polish pass
         * declared when the Live rail's bank became Slate's caption. The leaf count
         * does not move: machine-hot-water was already composing.
         * 26 -> 43 on 24 Aug 2026, on Ben's "lets fix all the settings pages then now".
         * SEVENTEEN ROWS AND FOUR DOORS: the machine port grew from two doors to five
         * (`/machine/settings/advanced`, `/api/v1/settings` and `/workflow` joined
         * `/machine/settings` and `/machine/calibration`), and every one of those doors
         * was a route the generated table already carried with no client behind it. The
         * leaf count moves 19 -> 21: `calibration-voltage` and `calibration-refill-kit`
         * were EMPTY leaves and now draw, while the other fifteen rows landed on leaves
         * that were already composing.
         * 43 -> 44 on 24 Aug 2026: the screen saver gained the faint clock (Ben, "In
         * settings I want an option for this black screen to have a faint clock showing
         * the time in the same font the skin uses"). The leaf count does not move —
         * `display-screen-saver` was already composing — and the row beside it,
         * `screensaverEnabled`, turned out to be DEAD: it had a switch, a routing row and
         * a store, and `attachScreensaver` never read it.
         * 44 -> 45 on 24 Aug 2026: the clock format, on the new `units-language-time`
         * leaf, which is why the LEAF count moves with it.
         * 45 -> 47 on 26 Aug 2026, working Ben's page-by-page feedback: FOUR rows arrived
         * and TWO left. In: the steam master switch, the water-tank preheat switch, the
         * hot-water duration limiter and the tank's low-water alert level. Out: the two
         * experimental switches on Pre Shot ("remove the fused channels and collapse
         * detection but keep these settings on and hidden") — the keys stay in the routing
         * table, the CONTROLS are gone, and a deleted row is the only honest way to say
         * "not a control". The leaf count does not move: all four new rows landed on
         * leaves that were already composing, and Pre Shot still carries four.
         * 55 -> 56 on 26 Aug 2026, from the audit recapture rather than from a request:
         * `accessories-cup-warmer-now`, the plate's live temperature. Slate prints it as
         * its own row and this skin had dropped it, which also hid a WIRE fault — the cup
         * warmer door was reading that same `currentTemperature` and serving it as the
         * SETPOINT, so the Target stepper had been showing however warm the mat happened
         * to be. One row absent and one row wrong, off one value. The leaf count does not
         * move: `accessories-cup-warmer` was already composing.
         * 56 -> 55 the same day, from the same sweep and the other way round:
         * `connection-scale-last` was a READING over `scaleDeviceId`, and nothing in src/
         * has ever WRITTEN that key — so it printed the absence dash on every machine, for
         * ever. A reading whose value has no writer is the same finished half as a control
         * whose value has no reader, seen from the other side. The device list on that leaf
         * names every remembered scale, so making the key work would have put a fourth
         * answer above a list that answers it better. The leaf count does not move:
         * `connection-scale` still carries the power-mode bank and Scale required.
         * 55 -> 56 the same day, from the audit's steam-stop finding:
         * `machine-steam-milk-target`, the temperature the milk probe stops at. The bank
         * above it offered a Milk Temp option whose caption promises the machine stops "when
         * the milk reaches the target temperature", and there was NO CONTROL on the page for
         * that target — Slate shows a stepper and a live probe reading whenever the mode is
         * chosen. The same fix made all three of that bank's options reach the machine at
         * all; before it, the bank wrote a string to the tablet and nothing else. The leaf
         * count does not move: `machine-steam` was already composing.
         * 56 -> 57 the same day, from the same audit's hot-water finding:
         * `machine-hot-water-lookahead`. The registry's recorded reason for not building it
         * — "Slate has a numpad field for it and no settings row that renders one" — was
         * false: Slate draws a complete stepper row on this page (settings.js:4551-4578),
         * and `hot_water_sequencer.dart:117-118` reads the value as `lookaheadSeconds`. So a
         * Bengle stopped hot water at weight using a lead time nobody could see, while the
         * two sibling multipliers already had rows on Calibration. The leaf count does not
         * move: `machine-hot-water` was already composing. */
        /* 57 -> 58 on 28 Aug 2026: the brightness slider stopped being hand-written and
         * became a registry row. No page gained a control — one moved vocabulary. */
        assert.equal(SETTINGS_ROWS.length, 58, 'live rows');
        /* 22 -> 18 on 28 Aug 2026: three merges took eight leaves to three. The ROW
         * count above does not move, because no row was added or removed — each one
         * kept its id and changed only the `leaf` it names. */
        assert.equal(leavesWithRows().length, 18, 'leaves carrying at least one live row');
    });
});

/* ===========================================================================
 * 2. B7 — EVERY KEY RESOLVES THROUGH THE ROUTING TABLE, AND NO LEAF STORES
 * =========================================================================== */

describe('B7: one store per setting, and the leaf never picks one', () => {
    test('every route row names a key the table routes', () => {
        const routed = new Set(settingsKeys());
        for (const key of registryKeys()) {
            assert.ok(routed.has(key), `${key} has no row in storage-routes.js — the router would throw UNKNOWN_KEY`);
            assert.ok(routeFor(key).leaf, `${key} is routed but names no leaf`);
        }
    });

    test('a row and its route row agree about which leaf owns the key', () => {
        for (const row of SETTINGS_ROWS.filter((r) => r.source === SOURCE.ROUTE)) {
            assert.equal(routeFor(row.key).leaf, row.leaf,
                `${row.id} claims ${row.key}, whose route row gives it to ${routeFor(row.key).leaf}`);
        }
    });

    /**
     * EVERY MACHINE FIELD HAS EXACTLY ONE DOOR, AND THE DOOR IS IN A TABLE.
     *
     * This started as "every machine field is one POST /machine/settings actually reads",
     * which was the whole truth while there was one machine document. D9 added a second:
     * `flowMultiplier` lives behind GET/POST /api/v1/machine/calibration, and
     * `src/stores/machine-fields-port.js` holds the field -> door map so the registry, the
     * model and the renderer all still see one port.
     *
     * The claim is therefore sharpened rather than weakened: a field is either a key the
     * settings handler reads, or it is named in `FIELD_DOORS` with a door this port has.
     * A field that is NEITHER is the wire-silence bug this test was written to catch.
     *
     * AND FOUR FIELDS ARE ON TWO HANDLERS, WHICH IS NOT TWO OWNERS. Steam flow and the
     * three flush values are readable and writable through BOTH `/machine/settings` and
     * `/workflow`, because `updateWorkflowSettings` calls `setFlushTimeout` / `setFlushFlow`
     * / `setFlushTemperature` — the same MMR writes the settings handler makes. What is not
     * symmetrical is the AFTERMATH: `POST /machine/settings` does not update the cached
     * workflow document, so a value changed there leaves every workflow reader — the Live
     * rail — showing the old number until something re-syncs. Both doors exist on the
     * server; this skin picks one, and it picks the one the rail already reads. The four are
     * named below so the choice is asserted rather than assumed, and so a fifth cannot join
     * them silently.
     */
    const ALSO_ON_THE_DE1_SETTINGS_HANDLER = Object.freeze({
        steamFlow: 'the Live rail reads steamSettings.flow; both doors write the same register',
        flushTemp: 'the Live rail reads rinseData.targetTemperature',
        flushFlow: 'the Live rail reads rinseData.flow',
        flushTimeout: 'the Live rail reads rinseData.duration',
    });

    test('every machine field has exactly one door, named in a table', () => {
        for (const field of machineFields()) {
            const door = FIELD_DOORS[field] ?? 'settings';
            assert.ok(DOORS.includes(door), `${field} names a door this port does not have`);
            if (door === 'settings') {
                assert.ok(DE1_SETTINGS_WRITE_KEYS.includes(field),
                    `${field} is not among the keys the handler reads; anything else is ignored on the wire`);
            } else if (Object.hasOwn(ALSO_ON_THE_DE1_SETTINGS_HANDLER, field)) {
                assert.equal(door, 'workflow',
                    `${field} is served by both handlers, so it takes the one the rail reads`);
            } else {
                assert.ok(!DE1_SETTINGS_WRITE_KEYS.includes(field),
                    `${field} is routed away from /machine/settings but that handler also reads it — `
                    + 'either it has two owners, or it belongs in ALSO_ON_THE_DE1_SETTINGS_HANDLER with the reason');
            }
        }
    });

    test('the two-handler list has not rotted — each name is still on both', () => {
        /* AN EXEMPTION THAT POINTS AT NOTHING has stopped protecting what it was written
         * for. Each of the four must still be a key the DE1 settings handler reads, or the
         * exemption is shadowing a rename rather than describing an overlap. */
        for (const field of Object.keys(ALSO_ON_THE_DE1_SETTINGS_HANDLER)) {
            assert.ok(DE1_SETTINGS_WRITE_KEYS.includes(field),
                `${field} is no longer a DE1 settings key — drop it from the list`);
            assert.equal(FIELD_DOORS[field], 'workflow');
        }
    });

    test('no file in this cluster touches a backend, a namespace or a prefix', () => {
        for (const file of LEAF_FILES) {
            for (const pattern of [/localStorage/, /sessionStorage/, /indexedDB/, /\bfetch\(/, /decal\./]) {
                assert.doesNotMatch(CODE[file], pattern, `${file} reaches a store directly (${pattern})`);
            }
        }
    });

    /* THE SUBJECT OF THESE TWO USED TO BE `machine-steam-stop`, and it stopped being a
     * route row on 26 August 2026: the steam stop mode is derived from the two machine
     * fields that ARE the mode. `machine-water-tank-unit` is the replacement and is a
     * better subject anyway — mm vs mL is a genuine display preference with no machine
     * field behind it at all, so a route row is what it will stay. */
    test('a route write goes to exactly one backend and shows what was stored', async () => {
        const { model, backends } = harness();
        const view = rowById(model, 'machine-water-tank', 'machine-water-tank-unit');
        const result = await model.set(view.row, 'ml');
        assert.equal(result.ok, true);
        assert.equal(result.staged, false, 'a stored preference is written now, not staged');
        assert.equal(backends[LAYERS.kv].data.get('waterTankUnit'), 'ml');
        assert.equal(backends[LAYERS.local].data.size, 0, 'the second store the dual write would have used');
    });

    test('a failed write leaves the shown value alone (the units.js revert)', async () => {
        /* THE ASSERTION MOVED FROM `undefined` TO THE DEFAULT (26 Aug 2026, O3) and the
         * claim is unchanged: a refused write must not leave the refused value on screen.
         * What changed underneath is that an unset key is no longer empty — Ben decided a
         * default for every one of them ("the current option should always be shown as
         * selected"), so `value()` answers 'mm' where it used to answer nothing.
         *
         * The test that matters is that it does NOT answer 'ml'. Asserting the default by
         * name as well pins the other half: a failed write must not quietly become a write
         * of the default either. */
        const { model, settings } = harness({ kvFails: true });
        const view = rowById(model, 'machine-water-tank', 'machine-water-tank-unit');
        const result = await model.set(view.row, 'ml');
        assert.equal(result.ok, false);
        assert.notEqual(settings.value('waterTankUnit'), 'ml', 'nothing is shown that was not stored');
        assert.equal(settings.value('waterTankUnit'), 'mm', 'the decided default, untouched by the refusal');
        assert.equal(settings.storedValue('waterTankUnit'), undefined, 'and nothing was stored');
    });

    /* THE INVERSION HAS NO ROW TODAY, and the claim is tested against a HAND-BUILT one.
     *
     * Its only user was "Show help button" over `helpHidden`, deleted on 26 August 2026
     * with the floating button this skin never had (Ben: "Decal has no help button or
     * overlay, so the toggle goes"). The MECHANISM survives — see `checkedFor` — because
     * the alternative when the next inverted key arrives is a per-leaf branch, which is how
     * two leaves come to disagree about what true means.
     *
     * A ROW OBJECT RATHER THAN A REGISTRY ROW is the honest way to test a mechanism with no
     * user: it says plainly that nothing ships inverted, and it still fails the day the
     * inversion moves out of the model into a leaf. */
    test('the inversion happens once, in the model, and stores the key\'s own polarity', async () => {
        const { model, backends, settings } = harness();
        assert.equal(SETTINGS_ROWS.filter((row) => row.invert).length, 0,
            'no shipped row is inverted; this tests the mechanism, not a page');

        /* A LIVE ROUTE KEY, because `set()` refuses a key with no row — B7's own rule, and
         * the retired `helpHidden` has none any more. `wakeLockEnabled` is a device-scoped
         * boolean whose real row is NOT inverted, which is what makes it a clean subject:
         * whatever this stores can only have come from the inversion. */
        const inverted = Object.freeze({
            id: 'test-inverted', leaf: 'display-screen',
            archetype: ARCHETYPE.SWITCH, source: SOURCE.ROUTE,
            key: 'wakeLockEnabled', invert: true, heading: 'Hide the wake lock',
        });
        await model.set(inverted, true);
        // THE PHYSICAL KEY CARRIES THE PREFIX AND THE LOGICAL ONE DOES NOT — the router
        // owns that boundary, which is why the assertion reads the stored value back
        // through it rather than guessing at a backend key.
        assert.equal(settings.storedValue('wakeLockEnabled'), false, 'the control is inverted, so ON stores false');
        assert.equal(backends[LAYERS.local].data.size, 1, 'one key, one backend');
    });

    /* ── THE PANEL SEAM — a stored key that ALSO commands the tablet ─────────
     *
     * `wakeLockEnabled` was declared in `storage-routes.js`, given a row in the registry
     * and a default of true, and a sweep of `src/` on 26 August 2026 found those three
     * declarations and NOTHING else: no writer of the lock, no reader of the key, no
     * command. The page promised to keep the screen on and the screen slept whenever the
     * operating system said so — the exact "finished half with no other half" this fork
     * exists to remove. The row now declares `panel: 'wakeLock'`, and these four tests are
     * what make that declaration a behaviour rather than a second declaration. */
    const panelHarness = ({ served, refuse = false } = {}) => {
        const sent = [];
        return {
            sent,
            panel: {
                setWakeLock(on) {
                    sent.push(on);
                    return refuse ? { ok: false, reason: 'the display feed is not attached' } : { ok: true };
                },
                wakeLockOverride: () => served,
            },
        };
    };

    test('the wake-lock row COMMANDS the tablet as well as storing the preference', async () => {
        const { sent, panel } = panelHarness({ served: undefined });
        const { model, settings } = harness({ panel });
        const view = rowById(model, 'display-screen', 'display-wake-lock-enabled');

        assert.equal((await model.set(view.row, false)).ok, true);
        assert.equal((await model.set(view.row, true)).ok, true);
        assert.deepEqual(sent, [false, true], 'both directions leave, in order');
        assert.equal(settings.storedValue('wakeLockEnabled'), true, 'and the preference survives a reload');
    });

    test('a refused command is REPORTED, even though the preference is kept', async () => {
        /* A lock that could not be taken because the socket is shut is still what the
         * person asked for, and it is taken on the next connect — but answering `ok` for a
         * command that never left would be the silent failure `live-stores.js` refuses to
         * swallow. */
        const { panel } = panelHarness({ served: undefined, refuse: true });
        const { model, settings } = harness({ panel });
        const view = rowById(model, 'display-screen', 'display-wake-lock-enabled');
        const result = await model.set(view.row, true);
        assert.equal(result.ok, false);
        assert.match(result.reason, /display feed/);
        assert.equal(settings.storedValue('wakeLockEnabled'), true);
    });

    test('the SERVED answer outranks the stored one, once there is one', async () => {
        /* O2: where a setting configures something outside this skin, that thing is the
         * truth teller. `wakeLockOverride` is ReaPrime's own record of whether THIS client
         * asked for the lock, which is exactly what the switch means. */
        const { panel } = panelHarness({ served: false });
        const { model, settings } = harness({ panel });
        await settings.set('wakeLockEnabled', true);
        const view = rowById(model, 'display-screen', 'display-wake-lock-enabled');
        assert.equal(view.checked, false, 'the machine says the lock is not held, so the row says so');
    });

    test('and before the first frame the row falls back to the stored preference', async () => {
        /* `undefined` is "no frame yet", which is not `false`. A switch that rendered from
         * nothing until the socket connected would flicker on every boot, and inventing a
         * `false` for an unread value is what A7 forbids. */
        const { panel } = panelHarness({ served: undefined });
        const { model, settings } = harness({ panel });
        await settings.set('wakeLockEnabled', true);
        const view = rowById(model, 'display-screen', 'display-wake-lock-enabled');
        assert.equal(view.checked, true);
    });

    test('with NO live layer the row still stores, and says the command did not go', async () => {
        const { model, settings } = harness({ panel: null });
        const view = rowById(model, 'display-screen', 'display-wake-lock-enabled');
        const result = await model.set(view.row, true);
        assert.equal(result.ok, false, 'a boot with no sockets cannot take a lock and does not pretend to');
        assert.equal(settings.storedValue('wakeLockEnabled'), true);
    });

    test('every PANEL_SETTINGS entry is named by a row, and every panel row by an entry', () => {
        /* T7's law, applied to a seam rather than to an archetype: a branch nothing
         * dispatches to is the same defect as a row with no branch behind it. */
        const declared = new Set(SETTINGS_ROWS.filter((row) => row.panel).map((row) => row.panel));
        assert.deepEqual([...declared].sort(), [...PANEL_SETTING_NAMES].sort());
    });
});

/* ===========================================================================
 * 3. RANGES — ONE TABLE, THROUGH THE R2 DOOR, AS AN ARGUMENT
 * =========================================================================== */

describe('B2 / R2: no second ranges table, and no leaf-local number', () => {
    test('no file in this cluster writes a range, a unit-bearing number or a limit', () => {
        for (const file of LEAF_FILES) {
            /* A CONTAINER QUERY'S THRESHOLD IS NOT A RANGE, and it is the one length CSS
             * will not take from a token: var() does not resolve inside an @container
             * condition. settings-master-detail.js:71-79 records the same for its 1100.
             * Nothing in this cluster declares one today; the strip is kept so that adding
             * a breakpoint does not read as a leaf inventing a setting's bounds. */
            const scanned = CODE[file].replace(/@container\s*\([^)]*\)/g, '@container');
            /* TWO PERCENTAGES ARE ALLOWED AND THEY ARE THE BATTERY SAVER'S LABELS.
             *
             * Ben, 26 August 2026: "Battery Saver ... three settings, Off, 80% and 55%."
             * They are not a RANGE — they are the names of two of ReaPrime's charging
             * modes, chosen because "Balanced" told the reader nothing they could act on.
             * The row's own paragraph carries the risk this guard exists for: the numbers
             * are the top of a server-side hysteresis pair and this table is what needs
             * the edit if ReaPrime retunes one.
             *
             * NARROWLY EXEMPTED, BY VALUE, so the guard still catches a third percentage
             * and every temperature, volume and pixel. */
            const BATTERY_SAVER_LABELS = ['80%', '55%'];
            const numbers = [...scanned.matchAll(/(?<![-\w.])\d+(?:\.\d+)?\s*(?:°C|mL|px|%)/g)]
                .map((m) => m[0])
                .filter((found) => !BATTERY_SAVER_LABELS.includes(found));
            assert.deepEqual(numbers, [], `${file} writes a value with a unit: ${numbers.join(', ')}`);
            assert.doesNotMatch(scanned, /\bmin:\s*\d/, `${file} declares a minimum`);
            assert.doesNotMatch(scanned, /\bmax:\s*\d/, `${file} declares a maximum`);
        }
    });

    test('a ranges table anywhere else in src/ has a reader, or it is not a table', () => {
        /* THE GUARD WIDENED ON 26 AUGUST 2026, because the defect it was written for turned
         * up one directory over. `cup-warmer.js` exported `PREHEAT_LEAD_RANGE = {min: 0,
         * max: 120, step: 5}` under a paragraph arguing it had to exist so "the leaf's
         * stepper and the leaf's keypad must read the same one (B2: one ranges table)" — and
         * NOTHING read it, while the live band in `machine-limits.js` disagreed with it on
         * two of its three numbers. A dead range contradicting the real one, under a comment
         * claiming the opposite.
         *
         * WHY IT IS A READER TEST AND NOT A BAN. Three range-shaped constants outside the
         * limits table are legitimate and each says why at its declaration: they are
         * VALIDATIONS a store or a handler enforces, not bands a control offers.
         * `SLEEP_TIMEOUT_RANGE` and `KEEP_AWAKE_RANGE` are what `presence-store.js` refuses
         * on, `NIGHT_MODE_MINUTE_RANGE` is the one numeric range `POST /settings` enforces.
         * Banning them would push the refusal into the caller. What must not exist is one
         * with nobody on the other end — that is not a second table, it is a claim. */
        const src = fileURLToPath(new URL('../src/', import.meta.url));
        const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
            entry.isDirectory()
                ? walk(`${dir}${entry.name}/`)
                : (entry.name.endsWith('.js') ? [`${dir}${entry.name}`] : [])
        ));
        const files = walk(src).filter((f) => !f.endsWith('machine-limits.js'));
        const corpus = files.map((f) => readFileSync(f, 'utf8'));
        for (const [index, text] of corpus.entries()) {
            const declared = [...stripComments(text)
                .matchAll(/export const ([A-Z_0-9]+)\s*=\s*Object\.freeze\(\{[^}]*min:\s*[0-9]/g)]
                .map((match) => match[1]);
            for (const name of declared) {
                const readers = corpus.filter((other, at) => at !== index
                    && new RegExp(`\b${name}\b`).test(other)).length;
                assert.ok(readers > 0,
                    `${files[index].slice(src.length)} exports the range ${name} and nothing in src/ reads it — `
                    + 'either wire it up, or delete it and let machine-limits.js be the one table');
            }
        }
    });

    test('the retired steam envelope has no spelling anywhere in this cluster', () => {
        // The screen law: "Steam 135 / 165-160 — 130/170 anywhere is a block." The hint is
        // COMPOSED from the table, so neither the decided numbers nor the retired ones are
        // typed here — asserting the absence of the wrong pair is the half that matters.
        for (const file of LEAF_FILES) {
            assert.doesNotMatch(CODE[file], /\b130\b|\b170\b/, `${file} spells the retired steam envelope`);
        }
    });

    test('the hint is the table\'s sentence, and a hole in the range survives it', () => {
        const { model } = harness();
        const flush = rowById(model, 'machine-flush', 'machine-flush-temp');
        assert.equal(flush.hint, '5–95 °C', 'composed by rangeHint from the one table');
        const duration = rowById(model, 'machine-flush', 'machine-flush-duration');
        // NO ZERO CLAUSE since 26 Aug 2026 — Ben retired the "0 = no flush" meaning ("it's
        // a button the user needs to press"). The hint is the band and nothing else.
        assert.equal(duration.hint, '0–60 s', 'the band, with no second job hidden in its floor');
        // The steam band's hole reaches the stepper as a step FUNCTION, not as a number.
        assert.equal(typeof flush.bounds.next, 'function');
        assert.equal(flush.bounds.next(95, 1), 95, 'stepping up at the ceiling stays');
    });

    test('a bounded row states its PRECISION as a number, because the numpad needs one', () => {
        /* THE STEPPER TAKES A FORMATTER AND THE NUMPAD TAKES A COUNT. `<ui-numeric-keypad>`
         * decides two things off the precision — whether the decimal key is live, and how
         * many characters the buffer may hold — and it cannot ask a closure either
         * question. Before 27 August 2026 `bounds` carried the formatter alone, so the pad
         * inferred the count from the STEP; on a converted band that is 1.8 for a whole
         * machine degree, and the decimal key lit up on a band with no tenths in it. */
        const { model } = harness();
        const flush = rowById(model, 'machine-flush', 'machine-flush-temp');
        assert.equal(flush.bounds.decimals, 0, 'a whole-degree band has no tenths to offer');
        const flow = rowById(model, 'machine-steam', 'machine-steam-flow');
        assert.equal(flow.bounds.decimals, 1, 'and a tenth-of-a-millilitre band does');
        assert.equal(flow.bounds.decimals, String(flow.bounds.step).split('.')[1].length,
            'derived from the declared step, never restated');
    });

    test('a row with no limits row is unbounded and prints no hint', () => {
        /* HOT-WATER FLOW WAS THIS TEST'S EXAMPLE AND IS NO LONGER UNBOUNDED. Ben gave it a
         * band on 26 Aug 2026 ("2 to 8ml/s"), so the claim needs a row that genuinely has
         * no limits entry — `machine-info` carries none, and the heater voltage bank is
         * not a stepper, so the honest example today is the row the registry itself leaves
         * unranged. The CLAIM is unchanged: an unstated range is unbounded and prints
         * nothing, rather than a number this skin picked. */
        const { model } = harness();
        const hotWater = rowById(model, 'machine-hot-water', 'machine-hot-water-flow');
        assert.equal(hotWater.hint, '2–8 mL/s', 'the band Ben decided, composed from the table');
        assert.equal(hotWater.bounds.bounded, true);

        const purge = rowById(model, 'machine-steam', 'machine-steam-purge');
        assert.equal(purge.hint, '', 'nothing invented for a row with no limits entry');
        assert.equal(purge.bounds.bounded, false);
        assert.equal(purge.bounds.min, null);
    });

    test('an unknown machine class carries no steam row, and a steam control cannot appear', () => {
        // A7: "no honest stand-in" for a machine-dependent ceiling. limitsFor(null) is what
        // r2MachineLimits returns when the capability array has not arrived.
        const { model } = harness({ limits: limitsFor(null) });
        const flow = rowById(model, 'machine-steam', 'machine-steam-flow');
        assert.equal(flow.hint, '0.4–2.5 mL/s', 'the machine-independent row is still there');
        assert.equal(Object.hasOwn(limitsFor(null), 'steamTemp'), false);
    });
});

/* ===========================================================================
 * 4. A3 — FAIL CLOSED, INCLUDING UNKNOWN
 * =========================================================================== */

describe('A3: a gated row is absent, not disabled, and cannot write', () => {
    const answering = (verdict) => ({ capability: () => verdict });

    /* THE SUBJECT MOVED OFF THE CUP WARMER ON 26 AUGUST 2026, and the move is the finding.
     *
     * This block used to quantify over `accessories-cup-warmer`, where THREE of five rows
     * carried `capability: 'cupWarmer'` and two did not — and it pinned that split as
     * intended. It was not intended. `gateCapability` fails closed on UNKNOWN as well as
     * ABSENT, so on any machine whose capability list had not landed that leaf rendered ONLY
     * "Pre-warm before wake-up" and "Start this long before": a page about a warmer with no
     * warmer on it, and a test asserting it. ReaPrime settles it — `GET
     * /machine/capabilities` returns `cupWarmer` and `preheat` together for any
     * `BengleInterface` and 404s both routes together for anything else
     * (`de1handler.dart:38-54, :632-637`) — so there is no machine on which three of those
     * rows belong and two do not. One leaf, one verdict.
     *
     * SLEEP AND WAKE IS THE SUBJECT NOW, and it is a better one: BOTH of its registry rows
     * carry `capability: 'wakeSchedule'`, so the leaf has one verdict, and the leaf also has
     * a bespoke half that is not a registry row at all — which is what lets these cases tell
     * "the gate works" from "the leaf is gated". */
    const SLEEP_GATED = ['machine-sleep-auto', 'machine-sleep-after'];

    test('UNKNOWN hides the gated rows — which is what the mock produces', () => {
        const { model } = harness({ capabilities: answering('unknown') });
        assert.deepEqual(model.rows('machine-sleep-wake-schedules').map((view) => view.id), [],
            'no surface at all for a capability nobody has answered for');
        const all = model.allRows('machine-sleep-wake-schedules');
        assert.deepEqual(all.map((view) => view.id), SLEEP_GATED,
            'the rows exist in the registry; they are hidden, not deleted');
        for (const view of all) assert.equal(view.surface, 'hidden', view.id);
    });

    test('ABSENT hides them too, and PRESENT shows both', () => {
        const absent = harness({ capabilities: answering('absent') }).model
            .rows('machine-sleep-wake-schedules').map((view) => view.id);
        assert.deepEqual(absent, []);
        const shown = harness({ capabilities: answering('present') }).model.rows('machine-sleep-wake-schedules');
        assert.deepEqual(shown.map((view) => view.id), SLEEP_GATED);
        assert.equal(shown[0].archetype, ARCHETYPE.SWITCH);
        assert.equal(shown[1].archetype, ARCHETYPE.STEPPER);
    });

    test('no capabilities store at all is UNKNOWN, so the gated surface is still hidden', () => {
        assert.deepEqual(harness().model.rows('machine-sleep-wake-schedules').map((view) => view.id), []);
    });

    test('a hidden row refuses the write as well as the paint', async () => {
        /* THE ROW IS A MACHINE ROW, so the refusal has to happen in the leaf model rather
         * than in the settings store: a machine write STAGES, and a staged field goes out on
         * the next commit. Nothing is stored either way, which is what the backend assertion
         * still checks. */
        const { model, backends } = harness({ capabilities: answering('unknown') });
        const row = model.allRows('machine-sleep-wake-schedules')
            .find((view) => view.id === 'machine-sleep-after').row;
        const result = await model.set(row, 60);
        assert.equal(result.ok, false);
        assert.equal(result.reason, 'capability');
        assert.equal(model.changeCount, 0, 'and nothing is staged for the next commit');
        assert.equal(backends[LAYERS.kv].data.size, 0, 'a control that should not exist cannot post');
    });

    test('one leaf, one verdict — the cup warmer draws five rows or none, never two', () => {
        /* THE DEFECT THIS PINS, measured on 26 August 2026 and asserted the other way round
         * by the test that used to stand here. With the gate split three-and-two, a machine
         * whose capability list was slow or unreadable drew a Cup Warmer page consisting of
         * "Pre-warm before wake-up" and "Start this long before" — no enable, no target, no
         * plate reading. The mock produces exactly that state by design (503 on
         * /machine/capabilities), so it was the ordinary case rather than an edge one. */
        const EVERY_WARMER_ROW = [
            'accessories-cup-warmer-enabled',
            'accessories-cup-warmer-target',
            'accessories-cup-warmer-now',
            'accessories-cup-warmer-prewarm',
            'accessories-cup-warmer-prewarm-lead',
        ];
        for (const verdict of ['unknown', 'absent', 'present']) {
            const rows = harness({ capabilities: answering(verdict) }).model
                .rows('accessories-cup-warmer').map((view) => view.id);
            assert.deepEqual(rows, EVERY_WARMER_ROW,
                `the capability list must not decide this leaf (${verdict})`);
        }
        for (const row of SETTINGS_ROWS.filter((r) => r.leaf === 'accessories-cup-warmer')) {
            assert.equal(row.capability, undefined,
                `${row.id} names a capability — the route's own 404 is what gates this leaf`);
        }
    });

    test('every leaf gates all of its rows or none of them', () => {
        /* THE STATIC FORM OF THE SAME RULE, so the split cannot come back on another leaf.
         * A capability is a fact about the machine, and a fact cannot be true of three rows
         * on a page and untrue of the two beside them. A leaf that genuinely needs a
         * per-CONTROL answer has the per-ITEM gate (`capability` / `sensor` on a bank item)
         * or `supportedBy`, both of which draw a disabled control rather than an absent one
         * — which is the honest shape for "this one thing is not available here". */
        const byLeaf = new Map();
        for (const row of SETTINGS_ROWS) {
            if (!byLeaf.has(row.leaf)) byLeaf.set(row.leaf, new Set());
            byLeaf.get(row.leaf).add(row.capability ?? null);
        }
        for (const [leaf, verdicts] of byLeaf) {
            assert.equal(verdicts.size, 1,
                `${leaf} gates some of its rows and not others: ${[...verdicts].join(', ')}`);
        }
    });
});

/* ===========================================================================
 * 4b. A CHOICE THE MACHINE HOLDS AS SEVERAL NUMBERS
 * =========================================================================== */

describe('a stop mode is read from the machine and written to it', () => {
    const answering = (verdict) => ({ capability: () => verdict });
    const withProbe = { capability: () => 'present', sensorCapability: () => ({ capability: 'present' }) };

    const steamStop = async (options) => {
        const built = harness(options);
        await built.model.load('machine-steam');
        return built;
    };

    test('the three options were ALL FALSE, and the mode is now the two fields it is', async () => {
        /* THE DEFECT. `machine-steam-stop` was `source: ROUTE` over a local key, so choosing
         * an option wrote a string to the tablet and NOTHING reached the machine. "Off",
         * whose caption promises "Steam runs until you stop it", left the machine stopping
         * on whatever timer it held; "Milk Temp" did not arm the probe, which ReaPrime reads
         * as `stopAtTemperature <= 0` and ignores (`steam_sequencer.dart:134-140`).
         *
         * The mode is now DERIVED from those two fields, which is Ben's O3 read literally —
         * "the current option should always be shown as selected, read from the machine". */
        const armed = await steamStop({
            capabilities: withProbe,
            document: { ...MACHINE_DOCUMENT, steamDuration: 45, milkStopTemp: 62 },
        });
        assert.equal(rowById(armed.model, 'machine-steam', 'machine-steam-stop').value, 'milk-temp',
            'an armed probe wins over a timer, which is what the sequencer does');

        const timed = await steamStop({ document: { ...MACHINE_DOCUMENT, steamDuration: 45, milkStopTemp: 0 } });
        assert.equal(rowById(timed.model, 'machine-steam', 'machine-steam-stop').value, 'time');

        const neither = await steamStop({ document: { ...MACHINE_DOCUMENT, steamDuration: 0, milkStopTemp: 0 } });
        assert.equal(rowById(neither.model, 'machine-steam', 'machine-steam-stop').value, 'off',
            'all zero is a real state, not an absence');
    });

    test('Off stages a zero on BOTH fields, so the machine really stops stopping', async () => {
        const { model } = await steamStop({
            document: { ...MACHINE_DOCUMENT, steamDuration: 45, milkStopTemp: 62 },
            capabilities: withProbe,
        });
        const row = rowById(model, 'machine-steam', 'machine-steam-stop').row;
        assert.equal((await model.set(row, 'off')).ok, true);
        assert.deepEqual(model.pendingPatch, { steamDuration: 0, milkStopTemp: 0 });
        assert.equal(rowById(model, 'machine-steam', 'machine-steam-stop').value, 'off',
            'and the bank reads back what it just staged');
    });

    test('Time disarms the probe and puts back the duration the machine already had', async () => {
        /* RESTORE MEANS "what the machine holds", not a shipped number: somebody who set a
         * 90 s steam and switched to Off gets 90 s back, not the default. */
        const { model } = await steamStop({
            document: { ...MACHINE_DOCUMENT, steamDuration: 90, milkStopTemp: 62 },
            capabilities: withProbe,
        });
        const row = rowById(model, 'machine-steam', 'machine-steam-stop').row;
        await model.set(row, 'time');
        assert.deepEqual(model.pendingPatch, { milkStopTemp: 0, steamDuration: 90 });
    });

    test('Milk Temp arms the probe, and with nothing remembered it takes the band floor', async () => {
        /* THE MACHINE MAY NEVER HAVE CARRIED A MILK TEMPERATURE, and there is no fallback
         * for one: Ben was never asked, so A7 says the stepper shows the dash. Arming still
         * has to write a NUMBER — zero is exactly what "not armed" means — and the honest
         * one is the bottom of the band the control offers, which the person then changes on
         * the stepper directly below. No literal is typed into the registry or the model. */
        const { model } = await steamStop({
            document: { ...MACHINE_DOCUMENT, steamDuration: 45 },
            capabilities: withProbe,
        });
        const row = rowById(model, 'machine-steam', 'machine-steam-stop').row;
        await model.set(row, 'milk-temp');
        assert.deepEqual(model.pendingPatch, { milkStopTemp: limitsFor('bengle').milkStopTemp.min });
        assert.equal(rowById(model, 'machine-steam', 'machine-steam-stop').value, 'milk-temp');
    });

    test('the Milk Temp option needs the probe, and the write is refused without it', async () => {
        /* THE GATE THE REGISTRY ADMITTED BY NAME (R3 `r3MilkProbeCapability`) and never
         * applied. `settings.gateSensor` asks the R3 adapter — the same door
         * `live-wiring.js` asks for the rail's identical Milk option — and fails closed on
         * UNKNOWN as well as ABSENT: a machine that has not answered is not a machine with a
         * probe. */
        const { model } = await steamStop({
            capabilities: { capability: () => 'present', sensorCapability: () => ({ capability: 'absent' }) },
            document: { ...MACHINE_DOCUMENT, steamDuration: 45, milkStopTemp: 62 },
        });
        const view = rowById(model, 'machine-steam', 'machine-steam-stop');
        assert.deepEqual(view.items.map((item) => Boolean(item.disabled)), [false, false, true],
            'Off and Time live, Milk Temp greyed');
        assert.equal(view.value, 'time',
            'a machine with no probe cannot be in Milk Temp, so the bank falls back');
        const result = await model.set(view.row, 'milk-temp');
        assert.equal(result.ok, false);
        assert.equal(result.reason, 'capability');
        assert.equal(model.changeCount, 0, 'greying is the paint; refusing the write is what makes it true');
    });

    test('Duration is inert unless the mode is Time, and the milk target unless it is Milk Temp', async () => {
        /* TWO GATES ON ONE ROW, both required: the heater has to be ON and the mode has to
         * be Time, because a duration under an Off or a Milk Temp stop is a number the
         * machine will not use. */
        const { model } = await steamStop({
            capabilities: withProbe,
            document: { ...MACHINE_DOCUMENT, steamTargetTemperature: 160, steamDuration: 45, milkStopTemp: 0 },
        });
        const inertOf = (id) => rowById(model, 'machine-steam', id).inert;
        assert.equal(inertOf('machine-steam-duration'), false, 'the mode is Time');
        assert.equal(inertOf('machine-steam-milk-target'), true, 'and Milk Temp is not chosen');

        const row = rowById(model, 'machine-steam', 'machine-steam-stop').row;
        await model.set(row, 'milk-temp');
        assert.equal(inertOf('machine-steam-duration'), true);
        assert.equal(inertOf('machine-steam-milk-target'), false);

        await model.set(rowById(model, 'machine-steam', 'machine-steam-enabled').row, false);
        assert.equal(inertOf('machine-steam-milk-target'), true,
            'the heater switch still gates it — a row is inert if ANY of its gates says so');
    });

    test('the hot-water stop is one boolean the machine holds, spelled as two words', async () => {
        const { model } = harness({ capabilities: answering('present') });
        await model.load('machine-hot-water');
        const view = rowById(model, 'machine-hot-water', 'machine-water-stop');
        const result = await model.set(view.row, 'weight');
        assert.equal(result.ok, true);
        assert.deepEqual(model.pendingPatch, { stopHotWaterAtWeight: true },
            '`hot_water_sequencer.dart:106` reads this field; the bank used to write a local string');
        assert.equal(rowById(model, 'machine-hot-water', 'machine-water-stop').value, 'weight');
        /* AND THE VOLUME ROW FOLLOWS IT BY ROW ID, not through a storage key it no longer
         * has: one machine field read two ways, and the words move with the mode. */
        assert.equal(rowById(model, 'machine-hot-water', 'machine-hot-water-volume').heading, 'Weight');
        assert.equal(rowById(model, 'machine-hot-water', 'machine-hot-water-lookahead').inert, false);

        await model.set(view.row, 'volume');
        assert.equal(rowById(model, 'machine-hot-water', 'machine-hot-water-volume').heading, 'Volume');
        assert.equal(rowById(model, 'machine-hot-water', 'machine-hot-water-lookahead').inert, true,
            'a lookahead is meaningless under a volume stop — the machine is counting millilitres');
    });

    test('night mode is inert while Battery Saver is Off, because it changes nothing then', async () => {
        /* ReaPrime's `charging_logic.dart:123-129` returns early on `ChargingMode.disabled`
         * with `nightPhase: inactive` BEFORE it reads the night-mode config at all. A
         * setting that does nothing is the defect this fork exists to remove; Slate hides
         * the whole section on the same test and this greys it, which is Ben's own rule for
         * a gated setting ("grey out and read '−'"). */
        const off = harness({ document: { ...MACHINE_DOCUMENT, chargingMode: 'disabled' } });
        await off.model.load('accessories-usb-charger');
        assert.equal(rowById(off.model, 'accessories-usb-charger', 'accessories-usb-charger-night').inert, true);

        const on = harness({ document: { ...MACHINE_DOCUMENT, chargingMode: 'balanced' } });
        await on.model.load('accessories-usb-charger');
        assert.equal(rowById(on.model, 'accessories-usb-charger', 'accessories-usb-charger-night').inert, false);
    });

    test('the two times render after their own switch, not below an unrelated one', () => {
        /* REGISTRY ROWS DRAW FIRST AND THE BESPOKE HALF DRAWS AFTER ALL OF THEM, so the only
         * way to nest the Sleep and Morning buttons under Night mode — which is where Slate
         * puts them (`settings.js:1663-1667`) — is for Night mode to be the LAST registry row
         * on the leaf. It was third of four, with the Dim switch between. */
        const order = SETTINGS_ROWS
            .filter((row) => row.leaf === 'accessories-usb-charger')
            .map((row) => row.id);
        assert.equal(order[order.length - 1], 'accessories-usb-charger-night',
            'the bespoke night times draw immediately after the last row');
        assert.ok(order.indexOf('accessories-usb-charger-dim') < order.indexOf('accessories-usb-charger-night'));
    });

    test('the pre-warm pair goes inert with a sentence when the firmware cannot do it', async () => {
        /* THE STORE HAD THE ANSWER AND NOTHING READ IT. `cup-warmer.js` sets
         * `preheatSupported` from the pre-heat route's OWN 404, and `MACHINE_FALLBACKS`
         * carried `cupWarmerPreheatEnabled: true` — so on a machine that 404'd that route the
         * switch painted ON, its lead stepper was live, and no caveat appeared anywhere. */
        const cannot = harness({ document: { ...MACHINE_DOCUMENT, cupWarmerPreheatSupported: false } });
        await cannot.model.load('accessories-cup-warmer');
        const view = rowById(cannot.model, 'accessories-cup-warmer', 'accessories-cup-warmer-prewarm');
        assert.equal(view.inert, true);
        assert.equal(view.checked, false, 'and it does not paint ON for a machine that cannot');
        assert.match(view.notes.join(' '), /firmware/i, "Slate's own sentence, which names the remedy");
        assert.equal(rowById(cannot.model, 'accessories-cup-warmer', 'accessories-cup-warmer-prewarm-lead').inert, true);
        assert.deepEqual(
            rowById(cannot.model, 'accessories-cup-warmer', 'accessories-cup-warmer-prewarm-lead').notes, [],
            'the caveat is printed once on the page, not under every row it applies to',
        );

        const can = harness({
            document: { ...MACHINE_DOCUMENT, cupWarmerPreheatSupported: true, cupWarmerPreheatEnabled: true },
        });
        await can.model.load('accessories-cup-warmer');
        const live = rowById(can.model, 'accessories-cup-warmer', 'accessories-cup-warmer-prewarm');
        assert.equal(live.inert, false);
        assert.equal(live.checked, true);
        assert.deepEqual(live.notes, []);
    });

    test('an unanswered pre-heat route leaves the rows live and the switch off', async () => {
        /* NULL IS NOT `false`. A route nobody has asked yet must not make the page accuse
         * the machine of a fault — and the switch must not paint ON either, which is why the
         * fallback was deleted rather than moved. */
        const { model } = harness();
        await model.load('accessories-cup-warmer');
        const view = rowById(model, 'accessories-cup-warmer', 'accessories-cup-warmer-prewarm');
        assert.equal(view.inert, false);
        assert.equal(view.checked, false);
        assert.deepEqual(view.notes, []);
    });

    test('every live reading names a channel the snapshot actually carries', async () => {
        /* A `live` KEY IS A PROMISE ABOUT A WIRE, and a misspelled one keeps it silently:
         * `#reading` reads `this._snapshot?.[view.live]`, so a channel that does not exist
         * is `undefined`, which renders as "no reading" — indistinguishable from a machine
         * that is simply not reporting. `SNAPSHOT_KEYS` is the served list, so the two are
         * checked against each other rather than against a memory of the field names. */
        const { SNAPSHOT_KEYS } = await import('../src/data/rea-names.js');
        const live = SETTINGS_ROWS.filter((row) => row.live);
        assert.ok(live.length > 0, 'this guard is worth nothing if no row carries one');
        for (const row of live) {
            assert.ok(SNAPSHOT_KEYS.includes(row.live),
                `${row.id} reads ${row.live}, which /ws/v1/machine/snapshot does not carry`);
        }
    });

    test('hot water prints a live reading, which is what earns its longer label', () => {
        /* STEAM GOT ITS LIVE READING ON 24 AUGUST AND HOT WATER DID NOT, and the steam row's
         * own note quotes Slate's rule as the reason the reading belongs there — a rule that
         * applies here word for word. It also settles the label: this skin adopted Slate's
         * "Target temperature" on Ben's ruling, and the extra word earns its place precisely
         * because a live reading sits beside it. The two belong together.
         *
         * THE CHANNEL IS THE GROUP'S, which is Slate's own mapping (`settings.js:1016-1018`
         * maps `hotWaterTempNow` to `groupTemperature`). The DE1 reports no separate
         * hot-water outlet probe, and inventing one would be worse than the silence. */
        const row = SETTINGS_ROWS.find((one) => one.id === 'machine-hot-water-temp');
        assert.equal(row.live, 'groupTemperature');
        assert.equal(row.heading, 'Target temperature');
        const { model } = harness();
        assert.equal(rowById(model, 'machine-hot-water', 'machine-hot-water-temp').live, 'groupTemperature',
            'and the view carries it, so the renderer can print it');
    });

    test('the tank alert caption says what zero does, which its limits row had promised', () => {
        /* `machine-limits.js` argues that zero here is a real setting meaning "no alert" and
         * that "the caption says so rather than the range hint" — and the caption did not say
         * so. A comment asserting copy that does not exist is the same broken half as a
         * control with no reader. */
        const row = SETTINGS_ROWS.find((one) => one.id === 'machine-water-tank-alert');
        assert.match(row.caption, /\bZero\b/, 'and spelled as a word — this file refuses a bare numeral');
        assert.doesNotMatch(rangeHint(limitsFor('bengle'), 'waterAlertLevel'), /0 =/,
            'the hint stays a range; the sentence belongs to the caption');
    });
});

/* ===========================================================================
 * 5. D11 — THE COUNT, AND WHAT IS BEHIND IT
 * =========================================================================== */

describe('D11: the model supplies a number and never a sentence', () => {
    test('a stored preference never makes the band dirty', async () => {
        /* THE SUBJECT MOVED OFF `machine-steam-stop` on 26 August 2026 and the claim is
         * unchanged. That row used to be a stored preference and is now a view over two
         * machine fields, because a stop mode nobody sent to the machine was a stop mode
         * that did not happen. `machine-water-tank-unit` is a preference that will stay one:
         * mm vs mL is how this tablet DRAWS the tank, and no machine holds it. */
        const { model } = harness();
        const view = rowById(model, 'machine-water-tank', 'machine-water-tank-unit');
        await model.set(view.row, 'ml');
        assert.equal(model.changeCount, 0, 'it is already saved; there is nothing to save');
    });

    test('one press on the steam-stop bank is TWO staged fields, and Cancel undoes both', async () => {
        /* THE OTHER SIDE OF THE SAME MOVE. A stop mode is two machine numbers — the timer
         * and the milk-probe target — and choosing Off has to zero both or the machine goes
         * on stopping by whichever one is left. They stage together, so the count reflects
         * what will be sent and Cancel drops the pair. */
        const { model } = harness();
        await model.load('machine-steam');
        const view = rowById(model, 'machine-steam', 'machine-steam-stop');
        const result = await model.set(view.row, 'off');
        assert.equal(result.staged, true);
        assert.deepEqual(model.pendingPatch, { steamDuration: 0, milkStopTemp: 0 });
        assert.equal(model.changeCount, 2);
    });

    test('a machine field stages, and the count is the number of staged fields', async () => {
        const { model } = harness();
        await model.load('machine-flush');
        await model.set(rowById(model, 'machine-flush', 'machine-flush-temp').row, 88);
        assert.equal(model.changeCount, 1);
        await model.set(rowById(model, 'machine-flush', 'machine-flush-flow').row, 4);
        assert.equal(model.changeCount, 2);
        await model.set(rowById(model, 'machine-flush', 'machine-flush-temp').row, 89);
        assert.equal(model.changeCount, 2, 'changing one field twice is one unsaved change');
    });

    /* BOTH API MEMBERS EXIST AND MEAN DIFFERENT THINGS. `get pending()` and
     * `pending: (leafId) => …` were once duplicate keys in one object literal, so the
     * getter lost and the staged patch was unreadable off the model — silently, because
     * nothing read either one. The staged patch is now `pendingPatch`. */
    test('pendingPatch is the staged patch; pending(leafId) is the declared-not-built list', async () => {
        const { model } = harness();
        await model.load('machine-flush');

        assert.deepEqual(model.pendingPatch, {}, 'nothing staged yet');
        assert.equal(typeof model.pending, 'function', 'pending(leafId) survives as a function');

        await model.set(rowById(model, 'machine-flush', 'machine-flush-temp').row, 88);
        assert.deepEqual(model.pendingPatch, { flushTemp: 88 }, 'the staged patch is readable as data');
        assert.equal(Object.isFrozen(model.pendingPatch), true, 'and is handed out frozen');

        const declared = model.pending('help-quickstart-guide');
        assert.ok(Array.isArray(declared) && declared.length > 0, 'the other member still lists declared rows');
        assert.ok(declared.every((row) => typeof row.owner === 'string' && row.owner.length > 0),
            'each declared row still names its owner');

        /* The two are different quantities and must never collapse onto one name again. */
        assert.notDeepEqual(Object.keys(model.pendingPatch), Object.keys(declared));
    });

    test('a staged row shows the value you asked for, not the one the machine holds', async () => {
        const { model } = harness();
        await model.load('machine-flush');
        await model.set(rowById(model, 'machine-flush', 'machine-flush-temp').row, 88);
        const view = rowById(model, 'machine-flush', 'machine-flush-temp');
        assert.equal(view.value, 88);
        assert.equal(view.staged, true);
    });

    test('Save sends ONE write carrying the subset, then re-reads', async () => {
        const { model, written } = harness();
        await model.load('machine-flush');
        await model.set(rowById(model, 'machine-flush', 'machine-flush-temp').row, 88);
        await model.set(rowById(model, 'machine-flush', 'machine-flush-flow').row, 4);
        const result = await model.commit();
        assert.equal(result.ok, true);
        assert.equal(result.wrote, 2);
        assert.equal(written.length, 1, 'two changes, one request');
        assert.deepEqual(written[0], { flushTemp: 88, flushFlow: 4 });
        assert.equal(model.changeCount, 0);
    });

    test('a failed Save keeps the changes staged and the count non-zero', async () => {
        const { model } = harness({ machine: 'fails' });
        await model.load('machine-flush');
        await model.set(rowById(model, 'machine-flush', 'machine-flush-temp').row, 88);
        const result = await model.commit();
        assert.equal(result.ok, false);
        assert.equal(result.reason, COMMIT_REFUSAL.WRITE_FAILED);
        assert.equal(model.changeCount, 1, 'nothing is silently lost');
    });

    test('with no machine port a Save refuses and says so', async () => {
        const { model } = harness({ machine: 'none' });
        await model.load('machine-flush');
        await model.set(rowById(model, 'machine-flush', 'machine-flush-temp').row, 88);
        const result = await model.commit();
        assert.equal(result.reason, COMMIT_REFUSAL.NO_MACHINE_PORT);
    });

    test('Cancel drops the staged changes and touches nothing stored', async () => {
        const { model, backends } = harness();
        await model.load('machine-flush');
        await model.set(rowById(model, 'machine-flush', 'machine-flush-temp').row, 88);
        assert.equal(model.discard(), 1);
        assert.equal(model.changeCount, 0);
        assert.equal(backends[LAYERS.kv].data.size, 0);
    });

    test('the machine port is the DE1 settings client and nothing else', () => {
        assert.equal(machinePortFor(null), null);
        assert.equal(machinePortFor({}), null);
        const port = machinePortFor({ readSettings: async () => ({ ok: true, data: { fan: 1 } }), writeSettings: async () => ({ ok: true }) });
        assert.equal(typeof port.read, 'function');
        assert.equal(typeof port.write, 'function');
    });

    test('no file in this cluster words the Save button', () => {
        for (const file of LEAF_FILES) {
            assert.doesNotMatch(CODE[file], /'Save|"Save|Save \(/, `${file} writes D11's sentence, which is #31's`);
            assert.doesNotMatch(CODE[file], /primaryLabel|commitView/, `${file} revives a name D11 deleted`);
        }
    });
});

/* ===========================================================================
 * 6. THE ARCHETYPES — BOTH DIRECTIONS (T7)
 * =========================================================================== */

describe('the six archetypes, and no renderer for a case nothing reaches', () => {
    const RENDERER = CODE['src/screens/settings-leaf.js'];
    const branches = new Set(
        [...RENDERER.matchAll(/case ARCHETYPE\.([A-Z]+):/g)].map((m) => ARCHETYPE[m[1]]),
    );

    test('every archetype a row declares has a branch that draws it', () => {
        for (const row of SETTINGS_ROWS) {
            if (row.archetype === ARCHETYPE.READING) continue;   // the no-control shape
            assert.ok(branches.has(row.archetype), `${row.archetype} is declared by ${row.id} and drawn by nothing`);
        }
    });

    test('every branch is reached by at least one row — T7, in the other direction', () => {
        const used = new Set(SETTINGS_ROWS.map((row) => row.archetype));
        for (const branch of branches) {
            assert.ok(used.has(branch),
                `the renderer dispatches ${branch}, which no registry row uses — T7's "renderer dispatched for cases no settingsTree entry uses"`);
        }
    });

    test('the vocabulary is the spec\'s five plus one, and two shapes that are not controls', () => {
        /* SIX SINCE 28 AUGUST 2026. SLIDER is the first archetype added since the cut,
         * and it was added for a reason the tree could state: `display-brightness` was a
         * bespoke page holding ONE control, and it was bespoke only because a slider had
         * no way to be declared. The archetype removed the reason and the page became
         * primitive. An archetype earns its place by retiring hand-written code, which
         * is why `procedure` was considered on the same day and REFUSED: 84 lines,
         * fourteen declaration fields and five states, serving two pages. */
        assert.deepEqual(CONTROL_ARCHETYPES,
            [ARCHETYPE.STEPPER, ARCHETYPE.SWITCH, ARCHETYPE.BANK, ARCHETYPE.SELECT,
                ARCHETYPE.SLIDER, ARCHETYPE.BUTTON]);
        const counts = archetypeCounts();
        for (const archetype of CONTROL_ARCHETYPES) {
            assert.ok(counts[archetype] > 0,
                `${archetype} is in the vocabulary and no row uses it — T7's own defect`);
        }
        /* SELECT WAS 0 UNTIL 21 AUG 2026, and the line that asserted it read
         * "declared and unused: every live choice is two to four options, which is the
         * bank's job". cmp-sm-1 landed the first one: Slate renders steam purge mode as
         * a <select> and the registry now declares that row, so the assertion above is
         * the stronger one — every archetype in the vocabulary is dispatched, in both
         * directions, with no archetype exempt from the rule by name. */
        /* BACK TO ONE ON 26 AUG 2026. The charging mode was the second — four options
         * whose labels were a phrase each, which is what separates #7 from the bank's
         * two-to-four short choices. Ben cut it to three short labels ("Off, 80%, 55%"),
         * and three short labels are a BANK: a select was hiding two of the three choices
         * behind a tap on a page whose whole subject is which one is in force. */
        /* TWO AGAIN ON 26 AUG 2026, and the second is Decaid's LOG LEVEL: ten options,
         * each label a word plus the logger's own bracketed name. Ten is what #7 is for;
         * a ten-cell bank would be a row of buttons nobody could read. */
        assert.equal(counts[ARCHETYPE.SELECT], 2, 'steam purge mode and the log level');
    });

    test('a bank or select row carries its choices; nothing else does', () => {
        for (const row of SETTINGS_ROWS) {
            const needsItems = row.archetype === ARCHETYPE.BANK || row.archetype === ARCHETYPE.SELECT;
            assert.equal(Boolean(row.items), needsItems, `${row.id} and its items disagree`);
            if (needsItems) {
                for (const item of row.items) {
                    /* NOT `item.value &&`. steamPurgeMode's Normal IS 0 — the number the
                     * wire carries — and a truthiness test calls that "no value", which
                     * is the class of bug the register's absence contract exists to
                     * kill. An item's value may be any non-nullish primitive. */
                    assert.ok(item.value !== undefined && item.value !== null,
                        `${row.id} has an item with no value`);
                    assert.ok(item.label, `${row.id} has an item with no label`);
                }
            }
        }
    });

    test('a row declares exactly one source, and the field it needs for it', () => {
        for (const row of SETTINGS_ROWS) {
            assert.ok(Object.values(SOURCE).includes(row.source), `${row.id} has no source`);
            if (row.source === SOURCE.ROUTE) assert.ok(row.key, `${row.id} routes nothing`);
            /* A MACHINE ROW NAMES ONE FIELD OR SEVERAL, and the second form arrived on
             * 26 August 2026 with the steam stop mode. The mode is not a field ReaPrime
             * holds: the machine stops steaming on a timer, or on the milk probe, or on
             * neither, and WHICH NUMBER IS NON-ZERO is the mode. `derivedFrom` reads it and
             * `stages` writes it, both naming their fields, so the row still says exactly
             * which machine values it owns — it just owns two. */
            if (row.source === SOURCE.MACHINE) {
                assert.ok(row.field || (row.derivedFrom && row.stages),
                    `${row.id} names no machine field and derives none`);
                if (row.derivedFrom) {
                    assert.ok(!row.field, `${row.id} both derives a value and names one field`);
                    assert.ok(row.whenNone !== undefined,
                        `${row.id} derives a mode and does not say what all-zero means`);
                    for (const option of Object.keys(row.stages)) {
                        assert.ok((row.items ?? []).some((item) => item.value === option),
                            `${row.id} stages an option '${option}' the bank does not offer`);
                    }
                    for (const item of row.items ?? []) {
                        assert.ok(Object.hasOwn(row.stages, item.value),
                            `${row.id} offers '${item.value}' and stages nothing for it — an inert option`);
                    }
                }
            }
            if (row.source === SOURCE.ACTION) assert.ok(row.action, `${row.id} asks for nothing`);
            assert.equal(Boolean(row.key) && Boolean(row.field), false, `${row.id} claims two sources`);
        }
    });
});

/* ===========================================================================
 * 7. T13 / T14 / T17 / T20 — THE RHYTHM CLASS, KILLED BY CONSTRUCTION
 * =========================================================================== */

describe('one row component means one padding, one gap and one switch geometry', () => {
    const RENDERER = CODE['src/screens/settings-leaf.js'];

    test('the renderer writes ONE LEAF RHYTHM and one header gap, both tokens (T20, T14)', () => {
        const gaps = [...RENDERER.matchAll(/gap:\s*([^;]+);/g)].map((m) => m[1].trim());
        /* THE LEAF'S OWN RHYTHM IS STILL ONE VALUE — that is T14 (a leaf gap
         * contradicting itself, 32/18 against 24) and T20 (fourteen gap literals).
         * The second entry arrived with cmp-sm-3 on 21 Aug 2026: the category eyebrow
         * and the leaf title are ONE header block, and the space INSIDE it is not the
         * space BETWEEN blocks (ORACLE settings-calibration-load-cells: 4px inside the
         * pair, 44px to the next block). It is the same token ui-settings-row uses
         * between a heading and its caption.
         *
         * WHAT THE ASSERTION STILL FORBIDS is the thing both bugs were made of: a
         * literal, and a third owner of the leaf's rhythm. */
        /* THE LEAF GAP GAINED A SECOND AXIS on 26 August 2026, and it is still ONE
         * declaration. Ben's O1 — "have all text be to the left of [the widest input] by
         * some margin" — made the leaf a two-column grid, and a grid needs a gap per axis:
         * --ui-space-4 between rows, which is the rhythm this pin has always been about,
         * and --ui-space-5 between a label and its control, which is the gap
         * ui-settings-row used to declare on its own host and cannot any more (it is
         * display: contents and has no box).
         *
         * WHAT T14 IS ABOUT is a leaf's rhythm contradicting itself — 32 in one place and
         * 18 in another. Two axes of one declaration cannot contradict; a SECOND gap
         * declaration still can, and that is what the count below still catches. */
        /* A THIRD ENTRY ARRIVED WITH O7's RESTORE BUTTON (26 Aug 2026): the page's name
         * and its one page-level action share a row, and the space between them is
         * neither the leaf's rhythm nor the header block's inside space. It is a token,
         * it is one declaration, and it owns one gap in one place — which is everything
         * T14 and T20 ask of it. */
        assert.deepEqual(gaps, ['var(--ui-space-4)', 'var(--ui-space-1)', 'var(--ui-space-5)'],
            `gaps declared: ${gaps.join(' | ')}`);
        for (const gap of gaps) {
            assert.match(gap, /^var\(--ui-space-\d\)$/, `${gap} is not a token`);
        }
    });

    test('the renderer writes no padding — the pane pads and the row pads (T13)', () => {
        assert.doesNotMatch(RENDERER, /padding(-\w+)?:/, 'a third owner of one edge');
        assert.doesNotMatch(RENDERER, /margin-block|padding-block/, 'T13 is a leaf inheriting a row\'s padding-block');
    });

    test('no switch geometry anywhere in the cluster (T17)', () => {
        for (const file of LEAF_FILES) {
            assert.doesNotMatch(CODE[file], /--ui-switch-|translate|inset:/,
                `${file} restates the switch geometry #5 owns as four tokens plus a derived throw`);
        }
    });

    test('no length, no colour, no important, no font-face in the cluster', () => {
        for (const file of LEAF_FILES) {
            /* Same exemption as the B2 pin above and for the same reason: a container
             * query's threshold cannot be a token, and it is not a length this cluster
             * chose to write — it is the only way to express a breakpoint at all. */
            const scanned = CODE[file].replace(/@container\s*\([^)]*\)/g, '@container');
            const lengths = [...scanned.matchAll(/(?<![-\w])(\d+(?:\.\d+)?)(px|rem|em)\b/g)].map((m) => m[0]);
            assert.deepEqual(lengths, [], `${file} writes a raw length: ${lengths.join(', ')}`);
            assert.doesNotMatch(scanned, /#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i, `${file} writes a colour`);
            assert.doesNotMatch(scanned, /!important/, file);
            assert.doesNotMatch(scanned, /@font-face/, file);
        }
    });

    test('the leaf declares no width — the pane owns the measure (T1, T21)', () => {
        /* A CONTROL'S OWN SIZE IS NOT THE LEAF'S MEASURE, and conflating the two made
         * this guard block a fix on 26 August 2026.
         *
         * T1/T21 is about the LEAF BOX: the pane declares `min(100%, --ui-measure-wide)`
         * once, and a leaf that states a width of its own is a second declaration and the
         * defect. A rule that sizes a CONTROL slotted into a row is a different subject —
         * every control in the skin states its own size, and `ui-settings-row`'s control
         * track is `flex: none` precisely so that it can.
         *
         * WHY ONE WAS NEEDED. ui-text-field declares no host block at all and lays out as
         * a block, so in that shrink-to-fit track it computed ZERO and the ReaPrime
         * address field drew outside the pane. The fix gives it the same
         * --ui-form-control-w the bespoke form rows use.
         *
         * AND A MARKER ON A ROW IS NOT THE LEAF'S MEASURE EITHER, which is the same
         * distinction reached a second time on 27 August 2026. The unsaved-edit dot
         * (`ui-settings-row[data-staged]::after`, settings-leaf.js) is a generated box
         * beside the row, two space-2 units square; it states its own size because a
         * `content: ""` pseudo-element has no intrinsic one, exactly as the text field
         * below states its own because it has none either. The two fixes arrived from
         * different directions on the same day and only the first widened this guard, so
         * the second was blocked by a rule written about a subject it has nothing to do
         * with.
         *
         * THE EXEMPTION IS THE SELECTOR, not the property: only rules that address a
         * control inside a row, or a marker generated on one, are dropped. A width on the
         * leaf, on a container, or on a bare element still fails exactly as before — and
         * so does one on `ui-settings-row` itself, which WOULD be a leaf-local measure
         * since a row is as wide as the leaf that holds it. */
        const scanned = RENDERER
            .replace(/ui-settings-row\s*>\s*ui-[\w-]+\s*\{[^}]*\}/g, '')
            .replace(/ui-settings-row(?:\[[^\]]*\])?::(?:after|before)\s*\{[^}]*\}/g, '');
        const widths = [...scanned.matchAll(/(?<![-\w])inline-size:\s*([^;]+);/g)].map((m) => m[0]);
        assert.deepEqual(widths, [], `the leaf states a width of its own: ${widths.join(' | ')}`);
        assert.doesNotMatch(RENDERER, /--ui-measure-wide/, 'the FORM measure is the pane\'s');
        // The one cap this file does state is the PROSE measure on a paragraph, which is
        // what --ui-measure is for and is not a leaf width.
        assert.match(RENDERER, /max-inline-size: var\(--ui-measure\)/);
    });
});

/* ===========================================================================
 * 8. C6 — THE FOUR LABELS, THE BASE, AND THE BAND THAT MULTIPLIES IT
 * =========================================================================== */

describe('C6: density and type scale replace the canvas transform', () => {
    const declaration = (name) => {
        const m = new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm').exec(TOKENS);
        assert.ok(m, `${name} is not declared in styles/tokens.css`);
        return m[1].trim();
    };

    test('the same four labels, and the values are names rather than numbers', () => {
        assert.deepEqual(DENSITY_STEPS.map((step) => step.label),
            ['Small', 'Fit screen', 'Larger', 'Largest'], 'C6: "the same four labels"');
        const row = SETTINGS_ROWS.find((r) => r.id === DENSITY_ROW);
        assert.equal(row.archetype, ARCHETYPE.BANK);
        assert.equal(row.key, 'density');
        assert.deepEqual(row.items.map((item) => item.value), DENSITY_VALUES);
        assert.deepEqual(row.items.map((item) => item.label), DENSITY_STEPS.map((s) => s.label));
    });

    test('the default step is the ladder\'s identity element', () => {
        assert.equal(normaliseDensity(DEFAULT_DENSITY_STEP).factor, 1);
        assert.equal(normaliseDensity('not-a-step'), null, 'an unknown value is no choice at all');
        assert.equal(normaliseDensity(undefined), null);
    });

    test('applying a step writes both tokens on the injected root and computes nothing', () => {
        const written = new Map();
        const root = {
            style: {
                setProperty: (name, value) => written.set(name, value),
                removeProperty: (name) => written.delete(name),
            },
        };
        applyDensity(root, 'larger');
        assert.equal(written.get(DENSITY_BASE_PROPERTY), '1.1');
        assert.equal(written.get(TYPE_SCALE_PROPERTY), '1.1');
        clearDensity(root);
        assert.equal(written.size, 0);
    });

    test('the sheet composes base x band, and the height band no longer overwrites', () => {
        assert.equal(declaration('--ui-density-base'), '1');
        assert.equal(declaration('--ui-density-band'), '1');
        assert.equal(declaration('--ui-density'), 'calc(var(--ui-density-base) * var(--ui-density-band))');
        const band = TOKENS.slice(TOKENS.indexOf('@media (height < 700px)'));
        assert.match(band, /--ui-density-band:\s*0\.875/, 'the band writes the FACTOR');
        assert.doesNotMatch(band.slice(0, band.indexOf('}')), /--ui-density:/,
            'Part 2 §5 rule 2: the band multiplies the base, it does not replace it');
    });

    test('--ui-density is registered, so it computes to a number', () => {
        const block = TOKENS.slice(TOKENS.indexOf('@property --ui-density'));
        assert.match(block, /syntax:\s*"<number>"/);
        assert.match(block, /inherits:\s*true/);
        assert.match(block, /initial-value:\s*1/);
    });

    test('the type scale multiplies the ten UI steps and not the fluid display ones', () => {
        for (const token of ['--ui-text-xs', '--ui-text-base', '--ui-text-nav', '--ui-text-xl']) {
            assert.match(declaration(token), /^calc\(\d+px \* var\(--ui-type-scale\)\)$/, token);
        }
        assert.doesNotMatch(declaration('--ui-display-lg'), /--ui-type-scale/,
            'a clamp against the container plus a preference multiplier is two elastic behaviours');
    });

    test('nothing in this cluster multiplies a canvas', () => {
        for (const file of LEAF_FILES) {
            assert.doesNotMatch(CODE[file], /transform|scale\(|zoom/i,
                `${file} carries the mechanism C6 retires (settings.js:2765-2769)`);
        }
    });

    test('the density row persists the BASE, and the routing table says so', () => {
        const route = routeFor('density');
        assert.equal(route.layer, LAYERS.local, 'device-scoped: a property of this screen');
        assert.match(route.why, /BASE, NEVER THE COMPOSED VALUE/);
    });
});

/* ===========================================================================
 * 9. D8 / D4 / D5 / D6 — THE BOUNDARY
 * =========================================================================== */

describe('D8: one control, and it is a button on the settings row', () => {
    /* TWO ACTION ROWS SINCE 26 AUGUST 2026, and D8's claim is unchanged.
     *
     * D8 is "a full-screen app with no exit is a trap; the cost is a single button" — a
     * statement about LEAVING THE SKIN, and there is still exactly one of those. The
     * second action opens Decent's quick-start guide in a new window (Ben: "show a Quick
     * start guide row with a View button that opens the guide"), which is the same SHAPE —
     * a button that asks the screen to navigate — for a different destination.
     *
     * WHAT IS PINNED IS THE SHAPE, not the count: every action row is a BUTTON, carries its
     * own visible text, and names an intent the screen answers. A third that opened a
     * dialog or wrote a setting would fail here. */
    test('every action row is a button that asks the screen, and D8 has exactly one exit', () => {
        const actions = SETTINGS_ROWS.filter((row) => row.source === SOURCE.ACTION);
        assert.deepEqual(actions.map((row) => row.action).sort(), ['leave-skin', 'open-quickstart']);
        for (const row of actions) {
            assert.equal(row.archetype, ARCHETYPE.BUTTON, 'the button archetype, not a new one');
            assert.ok(row.control, 'the button carries its own visible text, which is its accessible name');
            assert.equal(row.key, undefined, 'an action stores nothing');
        }
        assert.equal(actions.filter((row) => row.action === 'leave-skin').length, 1,
            'D8 is "one control in settings"; a second way out is a second feature');
    });

    test('leaving the skin opens no dialog and adds no archetype', () => {
        const renderer = CODE['src/screens/settings-leaf.js'];
        assert.doesNotMatch(renderer, /ui-dialog|ui-confirm-dialog|ui-sheet/, 'no new dialog shape');
        assert.doesNotMatch(renderer, /location|window\./, 'the leaf asks; the screen navigates');
    });
});

describe('D4 / D5 / D6: what Settings deliberately does not gain', () => {
    /* D4 IS REVERSED, AND WHAT IT WAS PROTECTING AGAINST IS NOT.
     *
     * The decision was "no firmware-update feature, and the hand-picked file upload is
     * removed, not carried. A control that flashes firmware from an arbitrary file is
     * worse than no control." Ben reversed it on 24 August 2026: "I should be able to
     * pick a file, but it should also have a 'latest' button that pulls it."
     *
     * So the two tests that pinned the ABSENCE are gone, and what replaces them pins the
     * part of D4 that still holds: nothing in this app sends `force`, the one flag that
     * would flash an image the machine's own validator says is not for it. A Latest
     * button that overrode the eligibility check would be D4's own sentence, arrived at
     * from the other side. */
    test('D4 reversed: the firmware leaf is bespoke and its controls are real', () => {
        assert.equal(rowsForLeaf('updates-firmware-update').length, 0,
            'it is not a settings ROW — a catalog and a progress track are a bespoke layout');
        assert.equal(leafKind('updates-firmware-update'), LEAF_KIND.BESPOKE);
        assert.equal(LEAF_NOTES['updates-firmware-update'], undefined,
            'and the note that said Decal does not send firmware is gone with the decision');
        assert.ok(SETTINGS_TREE.some((c) => c.leaves.some((l) => l.id === 'updates-firmware-update')),
            'the nav entry survives, as it did through D4');
    });

    /* D4's SURVIVING HALF — that nothing forces a firmware the machine says is not for it
     * — is proved by BEHAVIOUR in test/firmware.test.mjs, where the apply call's whole
     * body is asserted. A8 refuses the source-text spelling of it here, and A8 is right:
     * a store that never writes the word `force` and a store that never sends it are two
     * different claims, and only the second one matters. */

    test('D5: no backup and no restore leaf', () => {
        for (const file of LEAF_FILES) {
            assert.doesNotMatch(CODE[file], /\bbackup\b/i, `${file} builds D5's deferred feature`);
        }
        assert.equal(SETTINGS_ROWS.filter((row) => /backup/i.test(row.heading)).length, 0);
    });

    test('D6: no action row duplicates the selector\'s surface', () => {
        /* D6's surface was decided under the selector (wave 5.3, profile-library-store) and
         * a settings entry was conditional on the design putting one here; it did not.
         *
         * WHAT ENFORCES IT is that no action row touches a PROFILE. The registry carried
         * exactly one action for a while and this test asserted the count, which read as
         * "one action, ever" — a rule nobody made. It has two now (D8's exit and the
         * quick-start guide), and neither is a profile surface, which is the claim. */
        const actions = SETTINGS_ROWS.filter((row) => row.source === SOURCE.ACTION).map((row) => row.action);
        assert.deepEqual([...actions].sort(), ['leave-skin', 'open-quickstart']);
        for (const action of actions) {
            assert.doesNotMatch(action, /profile|favourite|import|export/i,
                `${action} is a profile surface, and the selector owns those`);
        }
    });

    test('#17 the progress track keeps its one user, and it is not here', () => {
        // "One use today — the app-update download bar; the firmware file-upload user is
        // removed, not carried (D4)." The bar lives in the Skin / App leaf, which §4.4
        // makes bespoke, so this cluster must not draw one.
        for (const file of LEAF_FILES) {
            assert.doesNotMatch(CODE[file], /ui-progress-track/, `${file} draws the update bar the bespoke leaf owns`);
        }
        assert.equal(Object.hasOwn(BESPOKE_LEAVES, 'updates-skin-app'), true);
    });
});


/* ═══════════════════════════════════════════════════════════════════════════════════════
 * THE ROW-LEVEL MACHINE GATE — the Flow Multiplier page, which is three rows and two
 * different questions
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Ben, 27 August 2026: "Bengle's pumps dont have any need for flow calibration, its
 * delievers perfect accurate flow, the DE1 didn't and needed these calibration values to
 * get it running. That is why I wanted it to be removed."
 *
 * THE PAGE WAS GATED WHOLE (`machines: ['de1']` on the nav leaf) AND THAT WAS TOO COARSE.
 * His sentence is about flow CALIBRATION and covers two of the three controls on that page.
 * The third — the weight flow multiplier — is not a flow calibration at all: it is stop-lag
 * lookahead, and `shot_sequencer.dart` runs it on every machine. Hiding the page took a live
 * Bengle setting away with it.
 *
 * SO THE ASSERTIONS BELOW ARE ABOUT THE SPLIT, one row at a time, each with the reason it
 * falls on the side it does. A test that only counted the gated rows would go green on the
 * wrong two.
 */
describe('the Flow Multiplier page is gated per ROW, not per page', () => {
    const rows = rowsForLeaf('calibration-flow-multiplier');
    const byId = (id) => rows.find((row) => row.id === id);

    test('all three rows are still declared — this is a gate, not a deletion', () => {
        assert.deepEqual(rows.map((row) => row.id), [
            'calibration-flow-multiplier-factor',
            'calibration-flow-multiplier-weight',
            'calibration-flow-multiplier-volume',
        ]);
    });

    test('the machine\'s own flow calibration is DE1-only, on Ben\'s hardware fact', () => {
        // `flowMultiplier` is the machine's `calFlowEst` on GET/POST /machine/calibration —
        // a correction applied to a flow the machine measures badly. Ben owns the Bengle
        // and says its pumps do not need one; there is nothing here to check that against
        // and nothing that should try.
        const row = byId('calibration-flow-multiplier-factor');
        assert.deepEqual([...row.machines], ['de1']);
        assert.equal(row.field, 'flowMultiplier');
    });

    test('the VOLUME multiplier is DE1-only, and this half is provable rather than asserted', () => {
        /* Read at the pin, `lib/src/controllers/shot_sequencer.dart`:
         *
         *   :75-77    _machineHasAutonomousSAW =
         *                 de1controller.connectedDe1() is BengleInterface
         *   :456-461  if (!_bypassSAW && !_machineHasAutonomousSAW && ... ) {
         *               final projectedVolume =
         *                   _accumulatedVolume + (machine.flow * _volumeFlowMultiplier);
         *
         * `Bengle implements BengleInterface` (bengle.dart:14-21), so the flag is true on
         * every Bengle and the ONLY expression that reads this field sits inside a branch
         * that can never be entered there. The control had no other half. */
        const row = byId('calibration-flow-multiplier-volume');
        assert.deepEqual([...row.machines], ['de1']);
        assert.equal(row.field, 'volumeFlowMultiplier');
    });

    test('the WEIGHT multiplier is on EVERY machine, and that is the load-bearing one', () => {
        /* `_handleStepWeightExit(machine.profileFrame, projectedWeight, machine)` is
         * shot_sequencer.dart:435 and the autonomous-SAW gate is :436. Line 435 is ABOVE
         * line 436, so per-step weight exits inside a profile project through this
         * multiplier on a Bengle exactly as on a DE1. What the gate below removes on a
         * Bengle is the SHOT-level stop at target yield, which the machine does itself.
         *
         * IF THIS ASSERTION EVER FAILS, re-read line 435 before changing it. Gating this row
         * would leave a setting that still moves a Bengle unreachable from a Bengle — a
         * value with a live reader and no control, which is the same defect as a control
         * with no reader wearing the other face. */
        const row = byId('calibration-flow-multiplier-weight');
        assert.equal(Object.hasOwn(row, 'machines'), false,
            'the weight flow multiplier is stop-lag lookahead, and it is live on a Bengle');
        assert.equal(rowShownOn(row, 'bengle'), true);
        assert.equal(rowShownOn(row, 'de1'), true);
    });

    test('a Bengle keeps exactly one row here, and it keeps the nav summary with it', () => {
        const onBengle = rows.filter((row) => rowShownOn(row, 'bengle'));
        assert.deepEqual(onBengle.map((row) => row.id), ['calibration-flow-multiplier-weight']);
        // THE LEAF IS NOT LEFT WITHOUT A HEADLINE. `navSummary` nominates one row per leaf
        // and it is the row that survives — so the nav entry still shows a number on a
        // Bengle instead of going blank, which is what would have happened had the split
        // fallen the other way.
        assert.equal(onBengle[0].navSummary, true);
        // And a DE1 keeps all three.
        assert.equal(rows.filter((row) => rowShownOn(row, 'de1')).length, 3);
        // An unknown class shows everything — see `shownOnMachine`. One asynchronous read
        // of a control that then goes away, rather than a control never drawn.
        assert.equal(rows.filter((row) => rowShownOn(row, null)).length, 3);
    });

    test('no OTHER row in the registry carries a machines gate', () => {
        /* THE COUNT IS THE POINT. `machines` is the wrong instrument for almost everything
         * that looks like it wants one: a row whose BAND differs by machine belongs to the
         * limits table (`fanThreshold`, `steamTemp`), a row whose HARDWARE may be missing
         * belongs to `capability` or `sensor`, and a row the FIRMWARE may be too old for
         * belongs to `supportedBy`. Only `machines` can hide a control from a machine that
         * genuinely has the setting, so its instances are worth enumerating by name. */
        const gated = SETTINGS_ROWS.filter((row) => row.machines).map((row) => row.id);
        assert.deepEqual(gated.sort(), [
            'calibration-flow-multiplier-factor',
            'calibration-flow-multiplier-volume',
        ]);
    });

    test('a machines gate names only classes the limits table has heard of', () => {
        // A typo would read as "shown on no machine at all", silently, which is the one
        // failure mode a gate like this has.
        for (const row of SETTINGS_ROWS.filter((r) => r.machines)) {
            assert.ok(Array.isArray(row.machines) && row.machines.length > 0,
                `${row.id} declares an empty machines list, which hides it everywhere`);
            for (const name of row.machines) {
                assert.ok(MACHINE_CLASSES.includes(name),
                    `${row.id} names "${name}", which is not a machine class`);
            }
        }
    });
});


/* ═══════════════════════════════════════════════════════════════════════════════════════
 * THE MODEL HONOURS THE ROW GATE — on the page, in the nav summary, and on the WIRE
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * The registry declares which rows belong to which machine; this is the half that makes the
 * declaration mean something. Both halves are needed and the second is the one that is easy
 * to leave out: filtering the read side stops a control being DRAWN, and only the write
 * check stops a stale one POSTING. `settings-store.js` states the rule for capability gates
 * in as many words — "a hidden surface does not write ... a stale control left on screen can
 * still post to a machine that never advertised the feature" — and a machine-class gate has
 * exactly the same exposure, because a caller holds a `view.row` object rather than an index
 * into a list.
 */
describe('the leaf model answers the row gate at both ends', () => {
    const LEAF = 'calibration-flow-multiplier';
    const ids = (views) => views.map((view) => view.id);

    test('a Bengle is drawn one row on that page, a DE1 all three', () => {
        assert.deepEqual(ids(harness({ machineClass: 'bengle' }).model.rows(LEAF)),
            ['calibration-flow-multiplier-weight']);
        assert.equal(harness({ machineClass: 'de1' }).model.rows(LEAF).length, 3);
    });

    test('an unknown class draws everything, because the read has not landed yet', () => {
        // Not fail-closed, and `shownOnMachine` carries the argument: the capability read
        // is asynchronous, so hiding on null would hide the control on EVERY machine for as
        // long as it takes — including on the DE1 it belongs to.
        assert.equal(harness({ machineClass: null }).model.rows(LEAF).length, 3);
    });

    test('THE CLASS IS RE-READ AT EVERY JOIN, so a late answer takes the row away', () => {
        /* THE REASON THE OPTION TAKES A FUNCTION AT ALL, and the failure it prevents is
         * worse than the one `limits` prevents. A class captured at construction is null on
         * every normal boot — the served capability array has not arrived when the model is
         * built — and null means "show everything", so a captured value would leave the two
         * DE1-only steppers drawn, live and writable on a Bengle for the whole session and
         * never take them away. That is not a band arriving late; it is a control that
         * should not exist. */
        let current = null;
        const { model } = harness({ machineClass: () => current });
        assert.equal(model.rows(LEAF).length, 3, 'before the answer, everything shows');
        current = 'bengle';
        assert.deepEqual(ids(model.rows(LEAF)), ['calibration-flow-multiplier-weight'],
            'the moment the answer lands, the rows that are not this machine\'s go');
    });

    test('allRows hides it too — a machines gate has no verdict to inspect', () => {
        /* `allRows` exists so the A3 suite can see what a CAPABILITY hid and which verdict
         * hid it. A machine-class gate is a different statement — the setting does not exist
         * on this hardware — with no capability to name and nothing for anyone to fix, so
         * the row is filtered at the source and never reaches a view. */
        assert.deepEqual(ids(harness({ machineClass: 'bengle' }).model.allRows(LEAF)),
            ['calibration-flow-multiplier-weight']);
    });

    test('the nav summary survives on a Bengle, because the surviving row is the nominated one', async () => {
        /* `navSummary` picks the ONE row per leaf the registry nominates, and on this leaf
         * that row is the weight multiplier — the one that stays. Had the split fallen the
         * other way, the nav entry for this page would have gone blank on a Bengle, which
         * nobody asked for and nobody would have noticed until they looked at the list.
         *
         * THE DOCUMENT HAS TO CARRY THE FIELD OR THE ANSWER IS NULL FOR AN HONEST REASON.
         * `weightFlowMultiplier` lives on ReaPrime's own settings document and has no
         * `MACHINE_FALLBACKS` entry, deliberately — so an unanswered machine has no headline
         * and A7 draws no summary element rather than a dash. That is a different null from
         * the one this test is about, and serving the field is what separates them. */
        const served = { ...MACHINE_DOCUMENT, weightFlowMultiplier: 1 };
        const { model } = harness({ machineClass: 'bengle', document: served });
        await model.loadMachine();
        assert.equal(model.navSummary(LEAF), '1 s');

        // AND THE NULL IT IS NOT: the same leaf on the same machine with nothing served.
        const silent = harness({ machineClass: 'bengle' });
        await silent.model.loadMachine();
        assert.equal(silent.model.navSummary(LEAF), null,
            'an unanswered machine has no headline, and that is A7 rather than the gate');
    });

    test('A HIDDEN ROW CANNOT WRITE, and it is refused as `machine`, not as `capability`', () => {
        /* The refusal reason matters as much as the refusal. Reporting this as a capability
         * failure would tell a DE1 owner their machine had not advertised a feature, when in
         * fact the row simply is not theirs — two different conversations with support. */
        const { model, written } = harness({ machineClass: 'bengle' });
        const volume = rowsForLeaf(LEAF).find((row) => row.id === 'calibration-flow-multiplier-volume');
        return model.set(volume, 0.5).then((result) => {
            assert.deepEqual(result, {
                ok: false, staged: false, key: 'volumeFlowMultiplier', reason: 'machine',
            });
            assert.equal(model.changeCount, 0, 'a refused write must not stage');
            assert.deepEqual(written, [], 'and nothing reaches the port');
        });
    });

    test('the SAME row on a DE1 stages normally — the gate is the only thing refusing it', () => {
        // The control assertion. Without it, a `set` broken for some unrelated reason would
        // make the test above pass for the wrong reason.
        const { model } = harness({ machineClass: 'de1' });
        const volume = rowsForLeaf(LEAF).find((row) => row.id === 'calibration-flow-multiplier-volume');
        return model.set(volume, 0.5).then((result) => {
            assert.equal(result.ok, true);
            assert.equal(model.changeCount, 1);
        });
    });
});


/* ═══════════════════════════════════════════════════════════════════════════════════════
 * THE CUP WARMER'S LIVE PLATE READING — KEPT, AND CONVERTED LIKE EVERY OTHER TEMPERATURE
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Ben, 27 August 2026: keep the row. It was proposed for deletion because it appeared to
 * duplicate the Target stepper above it — and it did, but only because the cup-warmer DOOR
 * was reading `currentTemperature` and handing it over as the SETPOINT. That wire is fixed;
 * the two rows show different quantities, and Slate prints both.
 *
 * WHAT WAS ACTUALLY WRONG WITH THE ROW is what these assertions are about. It shipped with
 * no `limit` and no `unit`, and three things followed from that one absence:
 *
 *   - `isTemperatureRow` decides temperature-ness FROM THE LIMITS ROW and answered false,
 *     so the reading was NEVER CONVERTED while the Target stepper directly above it drew
 *     Fahrenheit. Two numbers on one page, on the same plate, in two different units.
 *   - `boundsFor` carried no unit, so the number printed BARE — no degree sign at all.
 *   - Slate's 0.1 °C resolution was kept or lost by accident, depending on what the
 *     machine happened to send.
 *
 * A `limit` WOULD HAVE BEEN THE WRONG FIX AND IS WORTH SAYING SO HERE. Nothing sets this
 * value, so it has no band to clamp against, and inventing one would be a second ranges
 * table reached by another route — B2's whole point. The row declares `unit: '°C'` instead,
 * which is what `isTemperatureRow` falls through to, and `boundsFor` has an unbounded branch
 * that carries a converted unit with null min/max/step. This leaf is the only row of that
 * shape, so it is the only exercise those two lines get.
 */
describe('the cup warmer\'s plate reading is a temperature, in whichever unit the page is in', () => {
    const LEAF = 'accessories-cup-warmer';
    const ROW = 'accessories-cup-warmer-now';
    /* 41.5 °C IS CHOSEN, NOT ARBITRARY: it has a tenth, so a reading that silently rounded
     * to whole degrees would fail here, and its Fahrenheit face (106.7) has one too — which
     * a conversion that rounded on the way out would lose. A plate creeping to setpoint is
     * exactly the reading where the tenth is the information. */
    const PLATE = { ...MACHINE_DOCUMENT, cupWarmerTemperature: 60, cupWarmerCurrentTemperature: 41.5 };

    const readingIn = async (unit) => {
        const { settings, model } = harness({ document: PLATE });
        if (unit) await settings.set('tempUnit', unit);
        await model.loadMachine();
        return model.allRows(LEAF).find((view) => view.id === ROW);
    };

    test('in Celsius it is the machine\'s own number, with a degree sign', async () => {
        const view = await readingIn('c');
        assert.equal(view.reading, 41.5);
        assert.equal(view.bounds.unit, '\u00B0C');
    });

    test('in Fahrenheit it converts, and the unit moves with it', async () => {
        /* BOTH HALVES OR NEITHER. A converted number under a Celsius sign, or a Fahrenheit
         * sign over an unconverted number, are each worse than the bare number this row
         * used to print — a reader can tell a missing unit from a wrong one. */
        const view = await readingIn('f');
        assert.equal(view.reading, 106.7, '41.5 °C is 106.7 °F');
        assert.equal(view.bounds.unit, '\u00B0F');
    });

    test('it agrees with the Target stepper above it, which is the defect that was visible', async () => {
        // The two rows were in different units on one page. Whatever the preference, they
        // are now in the same one — asserted through the rows rather than through the
        // preference, because agreeing is the claim.
        for (const unit of ['c', 'f']) {
            const { settings, model } = harness({ document: PLATE });
            await settings.set('tempUnit', unit);
            await model.loadMachine();
            const rows = model.allRows(LEAF);
            const now = rows.find((view) => view.id === ROW);
            const target = rows.find((view) => view.id === 'accessories-cup-warmer-target');
            assert.equal(now.bounds.unit, target.bounds.unit, `the two disagree in ${unit}`);
        }
    });

    test('NO BAND IS INVENTED to have something to convert (B2)', () => {
        // The unbounded branch of `boundsFor`: a unit, and nulls everywhere a number would
        // be a number this file picked.
        return readingIn('f').then((view) => {
            assert.equal(view.bounds.bounded, false);
            assert.deepEqual(
                { min: view.bounds.min, max: view.bounds.max, step: view.bounds.step },
                { min: null, max: null, step: null });
            assert.equal(view.row.limit, undefined, 'nothing sets this value, so it has no band');
        });
    });

    test('a plate that is not reporting reads as an absence, not as zero', async () => {
        /* The machine types it `Future<double?>` and answers null whenever the warmer is
         * off. A cold plate and a plate that is not reporting are different states, and the
         * empty string is the attribute form of an absence — #29 draws the dash. A zero here
         * would be a temperature nobody measured. */
        const { model } = harness({ document: { ...MACHINE_DOCUMENT, cupWarmerCurrentTemperature: null } });
        await model.loadMachine();
        const view = model.allRows(LEAF).find((row) => row.id === ROW);
        assert.equal(view.reading, '');
        assert.notEqual(view.reading, 0);
    });
});
