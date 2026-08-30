/**
 * settings-doors.test.mjs — the five machine doors, and what each one refuses.
 *
 * WHAT THIS FILE IS ABOUT. On 24 August 2026 Ben said "lets fix all the settings pages
 * then now", and the answer to almost every missing control was the same: the route was
 * already in the generated table and nobody had ever called it. `machine-fields-port.js`
 * went from two doors to five, and this file is what keeps the split honest — a field
 * reaching the wrong door is the failure mode a table exists to prevent, and it is
 * invisible on screen because the control looks the same either way.
 *
 * THE FOUR CLAIMS WORTH ASSERTING, none of which a rendering test can see:
 *   1. a patch is split by the TABLE, and no door ever sees another door's fields;
 *   2. a patch naming a door this port does not have FAILS rather than silently skipping
 *      — `commit()` clears the staged intents on true;
 *   3. the workflow door sends the smallest nested merge, because the handler deep-merges
 *      and a whole group would overwrite what nobody touched;
 *   4. the app-settings client sends only the nine keys a control writes, because the
 *      handler ACTS on every key it recognises.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
    createMachineFieldsPort,
    workflowDoorFor,
    FIELD_DOORS,
    DOORS,
    WORKFLOW_FIELD_PATHS,
} from '../src/stores/machine-fields-port.js';
import { createAppSettingsClient, APP_SETTINGS_WRITE_KEYS } from '../src/data/rea-app-settings.js';
import { SETTINGS_ROWS } from '../src/lib/settings-leaves.js';
import { WORKFLOW_TARGET_KEYS } from '../src/lib/workflow-targets.js';
import { reaSuccess, reaFailure } from '../src/data/rea-errors.js';

function transportOf(script) {
    const calls = [];
    return {
        calls,
        socketUrl: () => 'ws://test',
        url: (path) => `http://test${path}`,
        async request(path, { method = 'GET', body, query } = {}) {
            calls.push({ path, method, body, query });
            return script({ path, method, body, query, key: `${method} ${path}` });
        },
    };
}

const ok = (data, status = 200) => reaSuccess({ status, data, method: 'GET', url: 'test' });
const bad = (status) => reaFailure('http', { status, message: `test ${status}`, method: 'GET', url: 'test' });

/** A door in the uniform shape, recording what it was handed. */
function doorOf(document_, log) {
    return {
        read: async () => document_,
        write: async (patch) => { log.push(patch); return true; },
    };
}

/* ===========================================================================
 * 1. THE TABLE
 * =========================================================================== */

describe('one field, one door, decided in a table', () => {
    test('every routed field names a door this port has, and no field has two', () => {
        for (const [field, door] of Object.entries(FIELD_DOORS)) {
            assert.ok(DOORS.includes(door), `${field} names an unknown door ${door}`);
        }
        assert.equal(new Set(Object.keys(FIELD_DOORS)).size, Object.keys(FIELD_DOORS).length);
    });

    test('the nine doors are named, and `settings` is the one a field reaches by default', () => {
        /* FIVE BECAME NINE on 26 August 2026, and each of the four arrived with the page
         * that needed it: `presence` (the sleep policy), `cupWarmer` (the whole cup-warmer
         * page), `machineInfo` (the measured mains on Voltage) and `waterLevels` (the tank
         * level, which has no REST read at all — it comes off the live socket frame).
         *
         * THE LIST IS PINNED RATHER THAN COUNTED so a door added without a page to open it
         * fails here. A door is a document this skin can write to; growing the set quietly
         * is how one field comes to have two owners. */
        assert.deepEqual([...DOORS].sort(), [
            'advanced', 'app', 'calibration', 'cupWarmer', 'machineInfo',
            'presence', 'settings', 'waterLevels', 'workflow',
        ]);
        /* NOT IN THE TABLE means the DE1 settings document, which is where the nine keys
         * `DE1_SETTINGS_WRITE_KEYS` names live. `tankTemp` is one of them and is
         * deliberately absent from FIELD_DOORS for that reason. */
        assert.ok(!Object.hasOwn(FIELD_DOORS, 'tankTemp'));
        /* AND `steamFlow` IS NO LONGER ONE OF THEM (26 August 2026). It used to be listed
         * here as an example of a field that reaches the settings document by falling
         * through — and that fall-through was the defect: the Live rail read steam flow and
         * all three flush values off the WORKFLOW (`workflow-targets.js` SCALAR_FIELDS)
         * while the settings page read them off `/machine/settings`. Both doors write the
         * same MMR registers, but `POST /machine/settings` does not update the cached
         * workflow document, so a change made on the Settings page left the rail showing the
         * old number until something re-synced. One setting, two stores, one level down. */
        for (const field of ['steamFlow', 'flushTemp', 'flushFlow', 'flushTimeout']) {
            assert.equal(FIELD_DOORS[field], 'workflow',
                `${field} is on the Live rail's document — one door, or the two surfaces drift`);
        }
    });

    test('every field both the rail and a settings row read comes through ONE door', () => {
        /* THE STATIC FORM OF THE SAME RULE, over the two tables rather than over four
         * example names — so a key added to `workflow-targets.js` tomorrow cannot quietly
         * acquire a second door here. A field the rail sources from the workflow and a
         * settings row also names must be declared `workflow`, and no transport is needed
         * to ask the question. */
        for (const row of SETTINGS_ROWS) {
            if (!row.field || !WORKFLOW_TARGET_KEYS.includes(row.field)) continue;
            assert.equal(FIELD_DOORS[row.field], 'workflow',
                `${row.id} reads ${row.field}, which the Live rail reads off the workflow`);
        }
    });

    test('a patch is split by the table, and no door sees another door’s fields', async () => {
        const wrote = { settings: [], advanced: [], app: [], workflow: [] };
        const port = createMachineFieldsPort({
            settings: doorOf({ fan: 30, tankTemp: 20 }, wrote.settings),
            advanced: doorOf({ heaterPh1Flow: 4 }, wrote.advanced),
            app: doorOf({ scalePowerMode: 'disconnect' }, wrote.app),
            workflow: doorOf({ steamTargetTemperature: 150 }, wrote.workflow),
        });

        assert.deepEqual(port.open, ['advanced', 'app', 'settings', 'workflow']);

        const document_ = await port.read();
        assert.deepEqual(document_, {
            fan: 30, tankTemp: 20, heaterPh1Flow: 4,
            scalePowerMode: 'disconnect', steamTargetTemperature: 150,
        }, 'one document to the model, assembled from four');

        assert.equal(await port.write({
            tankTemp: 22,
            heaterVoltage: 230,
            blockOnNoScale: true,
            hotWaterVolume: 120,
        }), true);
        assert.deepEqual(wrote.settings, [{ tankTemp: 22 }]);
        assert.deepEqual(wrote.advanced, [{ heaterVoltage: 230 }]);
        assert.deepEqual(wrote.app, [{ blockOnNoScale: true }]);
        assert.deepEqual(wrote.workflow, [{ hotWaterVolume: 120 }]);
    });

    test('a patch naming a door this port does NOT have fails, and never partly succeeds', async () => {
        const wrote = [];
        const port = createMachineFieldsPort({ settings: doorOf({ fan: 30 }, wrote) });
        /* THE POINT: `commit()` clears the staged intents on `true`, so a `true` here for
         * a value that never left the tablet is the silent-revert class this whole layer
         * exists to stop. */
        assert.equal(await port.write({ fan: 20, heaterVoltage: 230 }), false);
    });

    test('a door that throws contributes nothing, and the read still returns the rest', async () => {
        const port = createMachineFieldsPort({
            settings: doorOf({ fan: 30 }, []),
            advanced: { read: async () => { throw new Error('no machine'); }, write: async () => true },
        });
        assert.deepEqual(await port.read(), { fan: 30 });
    });
});

/* ===========================================================================
 * 2. THE WORKFLOW DOOR — flat names, a nested document, a deep merge
 * =========================================================================== */

describe('the workflow door flattens three fields and merges the smallest patch', () => {
    const DOCUMENT = Object.freeze({
        steamSettings: { targetTemperature: 170, duration: 45, flow: 2.1, stopAtTemperature: 62 },
        hotWaterData: { targetTemperature: 98, duration: 30, volume: 240, flow: 8 },
        rinseData: { targetTemperature: 90, flow: 6, duration: 4 },
    });

    function storeOf({ state = {}, onApply = () => ({ writeError: null }) } = {}) {
        const applied = [];
        return {
            applied,
            load: async () => state,
            get: () => state,
            apply: async (patch) => { applied.push(patch); return onApply(patch); },
        };
    }

    test('the five paths are declared once, and the door reads them all ways', async () => {
        /* THREE BECAME FIVE on 26 August 2026, and both new ones are durations. Steam
         * duration and hot-water duration were app-side stored keys; they are the
         * MACHINE's, on the same workflow document as the temperatures beside them, and a
         * stop time the machine does not know is a stop time that does not happen. */
        /* FIVE BECAME NINE on 26 August 2026 and the four are the ones the LIVE RAIL was
         * already reading here: steam flow and the three flush values. The settings page
         * read them off `/machine/settings` instead, which is B7's two stores for one
         * setting with the stores one level down — same registers, different cache, and the
         * rail showed the old number after a settings write. `milkStopTemp` joined them with
         * the Steam stop bank that arms it (`steamSettings.stopAtTemperature`). */
        assert.deepEqual(Object.keys(WORKFLOW_FIELD_PATHS).sort(), [
            'flushFlow', 'flushTemp', 'flushTimeout',
            'hotWaterDuration', 'hotWaterTargetTemperature', 'hotWaterVolume',
            'milkStopTemp', 'steamDuration', 'steamFlow', 'steamTargetTemperature',
        ]);
        const door = workflowDoorFor(storeOf({ state: { workflow: DOCUMENT } }));
        assert.deepEqual(await door.read(), {
            steamTargetTemperature: 170,
            steamFlow: 2.1,
            steamDuration: 45,
            milkStopTemp: 62,
            hotWaterTargetTemperature: 98,
            hotWaterDuration: 30,
            hotWaterVolume: 240,
            flushTemp: 90,
            flushFlow: 6,
            flushTimeout: 4,
        });
    });

    test('the flush block is `rinseData`, and the flat name the registry uses is kept', async () => {
        /* TWO VOCABULARIES MEETING IN ONE TABLE, which is the whole job of
         * `WORKFLOW_FIELD_PATHS`: ReaPrime calls the group `rinseData` and this skin's
         * settings row has called its duration `flushTimeout` since the DE1 settings
         * document was the door. Renaming the row would move its `field`, its fallback and
         * every mirror with it; mapping it here costs one line. */
        const store = storeOf({ state: { workflow: DOCUMENT } });
        const door = workflowDoorFor(store);
        assert.equal(await door.write({ flushTimeout: 8 }), true);
        assert.deepEqual(store.applied, [{ rinseData: { duration: 8 } }]);
    });

    test('a patch names only the leaves that changed — the handler deep-merges', async () => {
        const store = storeOf({ state: { workflow: DOCUMENT } });
        const door = workflowDoorFor(store);
        assert.equal(await door.write({ hotWaterVolume: 150 }), true);
        /* NOT `{hotWaterData: {...whole group}}`: `deepMergeJson` merges maps, so a whole
         * group would carry the flow and duration nobody touched — and would overwrite a
         * change somebody else made between the read and the write. */
        assert.deepEqual(store.applied, [{ hotWaterData: { volume: 150 } }]);
    });

    test('two leaves of one group become one nested object, not two writes', async () => {
        const store = storeOf({ state: { workflow: DOCUMENT } });
        const door = workflowDoorFor(store);
        await door.write({ hotWaterVolume: 150, hotWaterTargetTemperature: 90 });
        assert.equal(store.applied.length, 1);
        assert.deepEqual(store.applied[0], { hotWaterData: { volume: 150, targetTemperature: 90 } });
    });

    test('a refused write reports false, read off the state the store publishes', async () => {
        const store = storeOf({
            state: { workflow: DOCUMENT },
            onApply: () => ({ writeError: { ok: false, status: 500 } }),
        });
        const door = workflowDoorFor(store);
        assert.equal(await door.write({ hotWaterVolume: 150 }), false);
    });

    test('an absent value stays absent — a machine that has not answered is not holding zero', async () => {
        const door = workflowDoorFor(storeOf({ state: { workflow: { steamSettings: {} } } }));
        assert.deepEqual(await door.read(), {});
    });

    test('a field the paths table does not carry is refused, never sent as a top-level key', async () => {
        const store = storeOf({ state: { workflow: DOCUMENT } });
        const door = workflowDoorFor(store);
        assert.equal(await door.write({ someOtherField: 1 }), false);
        assert.deepEqual(store.applied, []);
    });
});

/* ===========================================================================
 * 3. THE APP-SETTINGS CLIENT — the third owner
 * =========================================================================== */

describe('the app settings client sends sixteen keys and no more', () => {
    test('the write list is the sixteen a control exists for', () => {
        /* NINE BECAME FOURTEEN on 26 August 2026, and every one of the five arrived with
         * a control: `preferredMachineId` and `preferredScaleId` with the two connection
         * pages, and `gatewayMode`, `logLevel` and `automaticUpdateCheck` when the Decaid
         * page stopped being an apology and became four controls.
         *
         * FOURTEEN BECAME SIXTEEN the same day, and both are hot-water halves that ReaPrime
         * had been serving all along with nothing writing them.
         * `stopHotWaterAtWeight` is read by `hot_water_sequencer.dart:106` — the Hot water
         * stop bank wrote a local string instead, so the machine went on stopping by
         * whatever it already held. `hotWaterFlowMultiplier` is read as `lookaheadSeconds`
         * at `:117-118`, so a Bengle stopped hot water at weight using an invisible 0.3 s
         * lead nobody could see or tune, while the two SIBLING multipliers already had rows
         * on Calibration.
         *
         * `webUiPath` IS STILL NOT HERE, and that is the point of pinning the list rather
         * than counting it: it is writable, and writing it re-points the server at another
         * folder — which is how a skin removes itself from the screen. The Decaid page
         * SHOWS it, as a reading row, and does not offer to change it. */
        assert.deepEqual([...APP_SETTINGS_WRITE_KEYS].sort(), [
            'automaticUpdateCheck', 'blockOnNoScale', 'chargingMode', 'gatewayMode',
            'hotWaterFlowMultiplier',
            'logLevel', 'lowBatteryBrightnessLimit', 'nightModeEnabled',
            'nightModeMorningTime', 'nightModeSleepTime', 'preferredMachineId',
            'preferredScaleId', 'scalePowerMode', 'stopHotWaterAtWeight',
            'volumeFlowMultiplier', 'weightFlowMultiplier',
        ]);
        assert.ok(!APP_SETTINGS_WRITE_KEYS.includes('webUiPath'),
            'shown on the Decaid page, never offered — writing it unloads this skin');
    });

    test('a key with no control never reaches the wire, even inside a patch that has one', async () => {
        const transport = transportOf(({ key }) => (key === 'POST /settings' ? ok(null, 200) : bad(503)));
        const client = createAppSettingsClient(transport);
        /* THE REASON THIS MATTERS: unlike the DE1 client's `pick`, this one CHANGES what
         * the server does. The handler acts on every key it recognises, so `webUiPath` in
         * a body would re-point the served skin folder. */
        /* THE STRANGER USED TO BE `gatewayMode`. It is on the list now — the Decaid page
         * has a control for it — so the example moved to a key that is still genuinely
         * off it. `webUiPath` is the sharpest one available and always will be: it is
         * writable, the handler acts on it, and what it does is unload this skin. */
        assert.equal(await client.write({ blockOnNoScale: true, webUiPath: '/tmp/evil', notAKey: 1 }), true);
        assert.deepEqual(transport.calls.at(-1).body, { blockOnNoScale: true });
    });

    test('an empty patch is not a write, and never leaves the tablet', async () => {
        const transport = transportOf(() => ok(null));
        const client = createAppSettingsClient(transport);
        assert.equal(await client.write({ webUiPath: '/tmp/evil' }), false);
        assert.equal(transport.calls.length, 0);
    });

    test('a failed read is a failure and never an empty document', async () => {
        const transport = transportOf(() => bad(503));
        assert.equal(await createAppSettingsClient(transport).read(), null);
    });

    test('a refused write reports false, so a staged intent stays staged', async () => {
        const transport = transportOf(() => bad(400));
        assert.equal(await createAppSettingsClient(transport).write({ chargingMode: 'nonsense' }), false);
    });
});
