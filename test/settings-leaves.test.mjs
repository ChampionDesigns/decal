

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

/** The three files this cluster owns, plus the sheet had to split. */
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

describe('the registry accounts for every leaf exactly once', () => {
    const leafIds = new Set(allLeaves().map((leaf) => leaf.id));

    test('thirty-two leaves, TWENTY bespoke, twelve classified primitive', () => {

        assert.equal(leafIds.size, 32, 'the nav model holds 32 leaves');

        assert.equal(Object.keys(BESPOKE_LEAVES).length, 20,
            'the spec measured nine; the firmware leaf is the tenth '
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

    test('eighteen leaves compose the settings row — twelve of them primitive', () => {
        const composing = leavesWithRows();
        assert.equal(SETTINGS_ROWS.length, 58, '58 live rows');
        assert.equal(composing.length, 18, 'spread over 18 DISTINCT leaves');

        const bespokeComposing = composing.filter((id) => leafKind(id) === LEAF_KIND.BESPOKE);

        assert.deepEqual([...bespokeComposing].sort(), [
            'accessories-usb-charger',
            'connection-machine',
            'connection-scale',
            'display-screen-saver',
            'display-skin',
            'machine-sleep-wake-schedules',
        ].sort());
        assert.equal(composing.length - bespokeComposing.length, 12, 'so 12 PRIMITIVE leaves render a row');
        /* The rest are declared, not missing — that is what keeps the registry honest. */
        const silent = [...leafIds]
            .filter((id) => leafKind(id) === LEAF_KIND.PRIMITIVE && !composing.includes(id));
        assert.equal(silent.length, 0, '16 classified primitive, and all but the wake-lock pair draw');
        for (const id of silent) {
            if (id === 'calibration-default-load-settings') {
                /* F3/the rule's leaf: zero rows AND zero note, by the screen law. */
                assert.equal(pendingForLeaf(id).length, 0, `${id} must hold no declared row`);
                assert.equal(noteForLeaf(id), null, `${id} must hold no note`);
                continue;
            }
            const declared = pendingForLeaf(id).length > 0 || noteForLeaf(id) !== null;
            assert.ok(declared, `${id} renders nothing and declares nothing — an undeclared hole`);
        }
    });

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
        // the rule's other half: "a second, live Fan implementation". One fan row, one leaf.
        const fan = SETTINGS_ROWS.filter((row) => row.limit === 'fanThreshold');
        assert.equal(fan.length, 1, 'the fan threshold has exactly one row');
    });

    test('every declared-but-not-built row names its owner', () => {
        for (const row of PENDING_ROWS) {
            assert.ok(row.owner && row.owner.length > 20,
                `${row.leaf} / ${row.name} is declared pending with no owner — an absence with no reason`);
        }
    });

    test('a leaf that renders SOMETHING and drops Slate controls declares the drop too', () => {
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

        assert.equal(SETTINGS_ROWS.length, 58, 'live rows');
        assert.equal(leavesWithRows().length, 18, 'leaves carrying at least one live row');
    });
});

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
        const { model, settings } = harness({ kvFails: true });
        const view = rowById(model, 'machine-water-tank', 'machine-water-tank-unit');
        const result = await model.set(view.row, 'ml');
        assert.equal(result.ok, false);
        assert.notEqual(settings.value('waterTankUnit'), 'ml', 'nothing is shown that was not stored');
        assert.equal(settings.value('waterTankUnit'), 'mm', 'the decided default, untouched by the refusal');
        assert.equal(settings.storedValue('waterTankUnit'), undefined, 'and nothing was stored');
    });

    test('the inversion happens once, in the model, and stores the key\'s own polarity', async () => {
        const { model, backends, settings } = harness();
        assert.equal(SETTINGS_ROWS.filter((row) => row.invert).length, 0,
            'no shipped row is inverted; this tests the mechanism, not a page');

        const inverted = Object.freeze({
            id: 'test-inverted', leaf: 'display-screen',
            archetype: ARCHETYPE.SWITCH, source: SOURCE.ROUTE,
            key: 'wakeLockEnabled', invert: true, heading: 'Hide the wake lock',
        });
        await model.set(inverted, true);
        assert.equal(settings.storedValue('wakeLockEnabled'), false, 'the control is inverted, so ON stores false');
        assert.equal(backends[LAYERS.local].data.size, 1, 'one key, one backend');
    });

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
        const { panel } = panelHarness({ served: undefined, refuse: true });
        const { model, settings } = harness({ panel });
        const view = rowById(model, 'display-screen', 'display-wake-lock-enabled');
        const result = await model.set(view.row, true);
        assert.equal(result.ok, false);
        assert.match(result.reason, /display feed/);
        assert.equal(settings.storedValue('wakeLockEnabled'), true);
    });

    test('the SERVED answer outranks the stored one, once there is one', async () => {
        const { panel } = panelHarness({ served: false });
        const { model, settings } = harness({ panel });
        await settings.set('wakeLockEnabled', true);
        const view = rowById(model, 'display-screen', 'display-wake-lock-enabled');
        assert.equal(view.checked, false, 'the machine says the lock is not held, so the row says so');
    });

    test('and before the first frame the row falls back to the stored preference', async () => {
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
        /* the rule's law, applied to a seam rather than to an archetype: a branch nothing
         * dispatches to is the same defect as a row with no branch behind it. */
        const declared = new Set(SETTINGS_ROWS.filter((row) => row.panel).map((row) => row.panel));
        assert.deepEqual([...declared].sort(), [...PANEL_SETTING_NAMES].sort());
    });
});

describe('B2 / R2: no second ranges table, and no leaf-local number', () => {
    test('no file in this cluster writes a range, a unit-bearing number or a limit', () => {
        for (const file of LEAF_FILES) {
            const scanned = CODE[file].replace(/@container\s*\([^)]*\)/g, '@container');
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
        for (const file of LEAF_FILES) {
            assert.doesNotMatch(CODE[file], /\b130\b|\b170\b/, `${file} spells the retired steam envelope`);
        }
    });

    test('the hint is the table\'s sentence, and a hole in the range survives it', () => {
        const { model } = harness();
        const flush = rowById(model, 'machine-flush', 'machine-flush-temp');
        assert.equal(flush.hint, '5–95 °C', 'composed by rangeHint from the one table');
        const duration = rowById(model, 'machine-flush', 'machine-flush-duration');
        assert.equal(duration.hint, '0–60 s', 'the band, with no second job hidden in its floor');
        // The steam band's hole reaches the stepper as a step FUNCTION, not as a number.
        assert.equal(typeof flush.bounds.next, 'function');
        assert.equal(flush.bounds.next(95, 1), 95, 'stepping up at the ceiling stays');
    });

    test('a bounded row states its PRECISION as a number, because the numpad needs one', () => {
        const { model } = harness();
        const flush = rowById(model, 'machine-flush', 'machine-flush-temp');
        assert.equal(flush.bounds.decimals, 0, 'a whole-degree band has no tenths to offer');
        const flow = rowById(model, 'machine-steam', 'machine-steam-flow');
        assert.equal(flow.bounds.decimals, 1, 'and a tenth-of-a-millilitre band does');
        assert.equal(flow.bounds.decimals, String(flow.bounds.step).split('.')[1].length,
            'derived from the declared step, never restated');
    });

    test('a row with no limits row is unbounded and prints no hint', () => {
        const { model } = harness();
        const hotWater = rowById(model, 'machine-hot-water', 'machine-hot-water-flow');
        assert.equal(hotWater.hint, '2–8 mL/s', 'the decided band, composed from the table');
        assert.equal(hotWater.bounds.bounded, true);

        const purge = rowById(model, 'machine-steam', 'machine-steam-purge');
        assert.equal(purge.hint, '', 'nothing invented for a row with no limits entry');
        assert.equal(purge.bounds.bounded, false);
        assert.equal(purge.bounds.min, null);
    });

    test('an unknown machine class carries no steam row, and a steam control cannot appear', () => {
        const { model } = harness({ limits: limitsFor(null) });
        const flow = rowById(model, 'machine-steam', 'machine-steam-flow');
        assert.equal(flow.hint, '0.4–2.5 mL/s', 'the machine-independent row is still there');
        assert.equal(Object.hasOwn(limitsFor(null), 'steamTemp'), false);
    });
});

describe('A3: a gated row is absent, not disabled, and cannot write', () => {
    const answering = (verdict) => ({ capability: () => verdict });

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

describe('a stop mode is read from the machine and written to it', () => {
    const answering = (verdict) => ({ capability: () => verdict });
    const withProbe = { capability: () => 'present', sensorCapability: () => ({ capability: 'present' }) };

    const steamStop = async (options) => {
        const built = harness(options);
        await built.model.load('machine-steam');
        return built;
    };

    test('the three options were ALL FALSE, and the mode is now the two fields it is', async () => {
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
        assert.equal(rowById(model, 'machine-hot-water', 'machine-hot-water-volume').heading, 'Weight');
        assert.equal(rowById(model, 'machine-hot-water', 'machine-hot-water-lookahead').inert, false);

        await model.set(view.row, 'volume');
        assert.equal(rowById(model, 'machine-hot-water', 'machine-hot-water-volume').heading, 'Volume');
        assert.equal(rowById(model, 'machine-hot-water', 'machine-hot-water-lookahead').inert, true,
            'a lookahead is meaningless under a volume stop — the machine is counting millilitres');
    });

    test('night mode is inert while Battery Saver is Off, because it changes nothing then', async () => {
        const off = harness({ document: { ...MACHINE_DOCUMENT, chargingMode: 'disabled' } });
        await off.model.load('accessories-usb-charger');
        assert.equal(rowById(off.model, 'accessories-usb-charger', 'accessories-usb-charger-night').inert, true);

        const on = harness({ document: { ...MACHINE_DOCUMENT, chargingMode: 'balanced' } });
        await on.model.load('accessories-usb-charger');
        assert.equal(rowById(on.model, 'accessories-usb-charger', 'accessories-usb-charger-night').inert, false);
    });

    test('the two times render after their own switch, not below an unrelated one', () => {
        const order = SETTINGS_ROWS
            .filter((row) => row.leaf === 'accessories-usb-charger')
            .map((row) => row.id);
        assert.equal(order[order.length - 1], 'accessories-usb-charger-night',
            'the bespoke night times draw immediately after the last row');
        assert.ok(order.indexOf('accessories-usb-charger-dim') < order.indexOf('accessories-usb-charger-night'));
    });

    test('the pre-warm pair is hidden when the firmware cannot do it', async () => {
        const cannot = harness({ document: { ...MACHINE_DOCUMENT, cupWarmerPreheatSupported: false } });
        await cannot.model.load('accessories-cup-warmer');
        assert.ok(!cannot.model.rows('accessories-cup-warmer').some((view) => view.id.startsWith('accessories-cup-warmer-prewarm')));
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
        const { model } = harness();
        await model.load('accessories-cup-warmer');
        const view = rowById(model, 'accessories-cup-warmer', 'accessories-cup-warmer-prewarm');
        assert.equal(view.inert, false);
        assert.equal(view.checked, false);
        assert.deepEqual(view.notes, []);
    });

    test('every live reading names a channel the snapshot actually carries', async () => {
        const { SNAPSHOT_KEYS } = await import('../src/data/rea-names.js');
        const live = SETTINGS_ROWS.filter((row) => row.live);
        assert.ok(live.length > 0, 'this guard is worth nothing if no row carries one');
        for (const row of live) {
            assert.ok(SNAPSHOT_KEYS.includes(row.live),
                `${row.id} reads ${row.live}, which /ws/v1/machine/snapshot does not carry`);
        }
    });

    test('hot water prints a live reading, which is what earns its longer label', () => {
        const row = SETTINGS_ROWS.find((one) => one.id === 'machine-hot-water-temp');
        assert.equal(row.live, 'groupTemperature');
        assert.equal(row.heading, 'Target temperature');
        const { model } = harness();
        assert.equal(rowById(model, 'machine-hot-water', 'machine-hot-water-temp').live, 'groupTemperature',
            'and the view carries it, so the renderer can print it');
    });

    test('the tank alert caption says what zero does, which its limits row had promised', () => {
        const row = SETTINGS_ROWS.find((one) => one.id === 'machine-water-tank-alert');
        assert.match(row.caption, /\bZero\b/, 'and spelled as a word — this file refuses a bare numeral');
        assert.doesNotMatch(rangeHint(limitsFor('bengle'), 'waterAlertLevel'), /0 =/,
            'the hint stays a range; the sentence belongs to the caption');
    });
});

describe('D11: the model supplies a number and never a sentence', () => {
    test('a stored preference never makes the band dirty', async () => {
        const { model } = harness();
        const view = rowById(model, 'machine-water-tank', 'machine-water-tank-unit');
        await model.set(view.row, 'ml');
        assert.equal(model.changeCount, 0, 'it is already saved; there is nothing to save');
    });

    test('one press on the steam-stop bank is TWO staged fields, and Cancel undoes both', async () => {
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
        assert.deepEqual(CONTROL_ARCHETYPES,
            [ARCHETYPE.STEPPER, ARCHETYPE.SWITCH, ARCHETYPE.BANK, ARCHETYPE.SELECT,
                ARCHETYPE.SLIDER, ARCHETYPE.BUTTON]);
        const counts = archetypeCounts();
        for (const archetype of CONTROL_ARCHETYPES) {
            assert.ok(counts[archetype] > 0,
                `${archetype} is in the vocabulary and no row uses it — T7's own defect`);
        }

        assert.equal(counts[ARCHETYPE.SELECT], 2, 'steam purge mode and the log level');
    });

    test('a bank or select row carries its choices; nothing else does', () => {
        for (const row of SETTINGS_ROWS) {
            const needsItems = row.archetype === ARCHETYPE.BANK || row.archetype === ARCHETYPE.SELECT;
            assert.equal(Boolean(row.items), needsItems, `${row.id} and its items disagree`);
            if (needsItems) {
                for (const item of row.items) {
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

describe('one row component means one padding, one gap and one switch geometry', () => {
    const RENDERER = CODE['src/screens/settings-leaf.js'];

    test('the renderer writes ONE LEAF RHYTHM and one header gap, both tokens (T20, T14)', () => {
        const gaps = [...RENDERER.matchAll(/gap:\s*([^;]+);/g)].map((m) => m[1].trim());

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
            const scanned = CODE[file].replace(/@container\s*\([^)]*\)/g, '@container');
            const lengths = [...scanned.matchAll(/(?<![-\w])(\d+(?:\.\d+)?)(px|rem|em)\b/g)].map((m) => m[0]);
            assert.deepEqual(lengths, [], `${file} writes a raw length: ${lengths.join(', ')}`);
            assert.doesNotMatch(scanned, /#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i, `${file} writes a colour`);
            assert.doesNotMatch(scanned, /!important/, file);
            assert.doesNotMatch(scanned, /@font-face/, file);
        }
    });

    test('the leaf declares no width — the pane owns the measure (T1, T21)', () => {
        const scanned = RENDERER
            .replace(/ui-settings-row\s*>\s*ui-[\w-]+\s*\{[^}]*\}/g, '')
            .replace(/ui-settings-row(?:\[[^\]]*\])?::(?:after|before)\s*\{[^}]*\}/g, '');
        const widths = [...scanned.matchAll(/(?<![-\w])inline-size:\s*([^;]+);/g)].map((m) => m[0]);
        assert.deepEqual(widths, [], `the leaf states a width of its own: ${widths.join(' | ')}`);
        assert.doesNotMatch(RENDERER, /--ui-measure-wide/, 'the FORM measure is the pane\'s');
        assert.match(RENDERER, /max-inline-size: var\(--ui-measure\)/);
    });
});

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
                `${file}carries the mechanism C6 retires `);
        }
    });

    test('the density row persists the BASE, and the routing table says so', () => {
        const route = routeFor('density');
        assert.equal(route.layer, LAYERS.local, 'device-scoped: a property of this screen');
        assert.match(route.why, /BASE, NEVER THE COMPOSED VALUE/);
    });
});

describe('D8: one control, and it is a button on the settings row', () => {
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
    test('D4 reversed: the firmware leaf is bespoke and its controls are real', () => {
        assert.equal(rowsForLeaf('updates-firmware-update').length, 0,
            'it is not a settings ROW — a catalog and a progress track are a bespoke layout');
        assert.equal(leafKind('updates-firmware-update'), LEAF_KIND.BESPOKE);
        assert.equal(LEAF_NOTES['updates-firmware-update'], undefined,
            'and the note that said Decal does not send firmware is gone with the decision');
        assert.ok(SETTINGS_TREE.some((c) => c.leaves.some((l) => l.id === 'updates-firmware-update')),
            'the nav entry survives, as it did through D4');
    });

    test('D5: no backup and no restore leaf', () => {
        for (const file of LEAF_FILES) {
            assert.doesNotMatch(CODE[file], /\bbackup\b/i, `${file} builds D5's deferred feature`);
        }
        assert.equal(SETTINGS_ROWS.filter((row) => /backup/i.test(row.heading)).length, 0);
    });

    test('D6: no action row duplicates the selector\'s surface', () => {
        const actions = SETTINGS_ROWS.filter((row) => row.source === SOURCE.ACTION).map((row) => row.action);
        assert.deepEqual([...actions].sort(), ['leave-skin', 'open-quickstart']);
        for (const action of actions) {
            assert.doesNotMatch(action, /profile|favourite|import|export/i,
                `${action} is a profile surface, and the selector owns those`);
        }
    });

    test('#17 the progress track keeps its one user, and it is not here', () => {
        for (const file of LEAF_FILES) {
            assert.doesNotMatch(CODE[file], /ui-progress-track/, `${file} draws the update bar the bespoke leaf owns`);
        }
        assert.equal(Object.hasOwn(BESPOKE_LEAVES, 'updates-skin-app'), true);
    });
});

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

    test('the machine\'s own flow calibration is DE1-only, on a hardware fact', () => {
        const row = byId('calibration-flow-multiplier-factor');
        assert.deepEqual([...row.machines], ['de1']);
        assert.equal(row.field, 'flowMultiplier');
    });

    test('the VOLUME multiplier is DE1-only, and this half is provable rather than asserted', () => {
        const row = byId('calibration-flow-multiplier-volume');
        assert.deepEqual([...row.machines], ['de1']);
        assert.equal(row.field, 'volumeFlowMultiplier');
    });

    test('the WEIGHT multiplier is on EVERY machine, and that is the load-bearing one', () => {
        const row = byId('calibration-flow-multiplier-weight');
        assert.equal(Object.hasOwn(row, 'machines'), false,
            'the weight flow multiplier is stop-lag lookahead, and it is live on a Bengle');
        assert.equal(rowShownOn(row, 'bengle'), true);
        assert.equal(rowShownOn(row, 'de1'), true);
    });

    test('a Bengle keeps exactly one row here, and it keeps the nav summary with it', () => {
        const onBengle = rows.filter((row) => rowShownOn(row, 'bengle'));
        assert.deepEqual(onBengle.map((row) => row.id), ['calibration-flow-multiplier-weight']);
        assert.equal(onBengle[0].navSummary, true);
        // And a DE1 keeps all three.
        assert.equal(rows.filter((row) => rowShownOn(row, 'de1')).length, 3);
        assert.equal(rows.filter((row) => rowShownOn(row, null)).length, 3);
    });

    test('no OTHER row in the registry carries a machines gate', () => {
        const gated = SETTINGS_ROWS.filter((row) => row.machines).map((row) => row.id);
        assert.deepEqual(gated.sort(), [
            'calibration-flow-multiplier-factor',
            'calibration-flow-multiplier-volume',
        ]);
    });

    test('a machines gate names only classes the limits table has heard of', () => {
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

describe('the leaf model answers the row gate at both ends', () => {
    const LEAF = 'calibration-flow-multiplier';
    const ids = (views) => views.map((view) => view.id);

    test('a Bengle is drawn one row on that page, a DE1 all three', () => {
        assert.deepEqual(ids(harness({ machineClass: 'bengle' }).model.rows(LEAF)),
            ['calibration-flow-multiplier-weight']);
        assert.equal(harness({ machineClass: 'de1' }).model.rows(LEAF).length, 3);
    });

    test('an unknown class draws everything, because the read has not landed yet', () => {
        assert.equal(harness({ machineClass: null }).model.rows(LEAF).length, 3);
    });

    test('THE CLASS IS RE-READ AT EVERY JOIN, so a late answer takes the row away', () => {
        let current = null;
        const { model } = harness({ machineClass: () => current });
        assert.equal(model.rows(LEAF).length, 3, 'before the answer, everything shows');
        current = 'bengle';
        assert.deepEqual(ids(model.rows(LEAF)), ['calibration-flow-multiplier-weight'],
            'the moment the answer lands, the rows that are not this machine\'s go');
    });

    test('allRows hides it too — a machines gate has no verdict to inspect', () => {
        assert.deepEqual(ids(harness({ machineClass: 'bengle' }).model.allRows(LEAF)),
            ['calibration-flow-multiplier-weight']);
    });

    test('the nav summary survives on a Bengle, because the surviving row is the nominated one', async () => {
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
        const { model } = harness({ machineClass: 'de1' });
        const volume = rowsForLeaf(LEAF).find((row) => row.id === 'calibration-flow-multiplier-volume');
        return model.set(volume, 0.5).then((result) => {
            assert.equal(result.ok, true);
            assert.equal(model.changeCount, 1);
        });
    });
});

describe('the cup warmer\'s plate reading is a temperature, in whichever unit the page is in', () => {
    const LEAF = 'accessories-cup-warmer';
    const ROW = 'accessories-cup-warmer-now';
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
        const view = await readingIn('f');
        assert.equal(view.reading, 106.7, '41.5 °C is 106.7 °F');
        assert.equal(view.bounds.unit, '\u00B0F');
    });

    test('it agrees with the Target stepper above it, which is the defect that was visible', async () => {
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
        return readingIn('f').then((view) => {
            assert.equal(view.bounds.bounded, false);
            assert.deepEqual(
                { min: view.bounds.min, max: view.bounds.max, step: view.bounds.step },
                { min: null, max: null, step: null });
            assert.equal(view.row.limit, undefined, 'nothing sets this value, so it has no band');
        });
    });

    test('a plate that is not reporting reads as an absence, not as zero', async () => {
        const { model } = harness({ document: { ...MACHINE_DOCUMENT, cupWarmerCurrentTemperature: null } });
        await model.loadMachine();
        const view = model.allRows(LEAF).find((row) => row.id === ROW);
        assert.equal(view.reading, '');
        assert.notEqual(view.reading, 0);
    });
});
