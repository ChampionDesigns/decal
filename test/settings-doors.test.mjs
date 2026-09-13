/**
 * The five machine doors, and what each one refuses.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
    createMachineFieldsPort,
    workflowDoorFor,
    waterLevelsDoorFor,
    FIELD_DOORS,
    DOORS,
    WORKFLOW_FIELD_PATHS,
} from '../src/stores/machine-fields-port.js';
import { callRoute } from '../src/data/rea-routes.js';
import { createWorkflowStore } from '../src/stores/workflow-store.js';
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

function doorOf(document_, log) {
    return {
        read: async () => document_,
        write: async (patch) => { log.push(patch); return true; },
    };
}

describe('one field, one door, decided in a table', () => {
    test('every routed field names a door this port has, and no field has two', () => {
        for (const [field, door] of Object.entries(FIELD_DOORS)) {
            assert.ok(DOORS.includes(door), `${field} names an unknown door ${door}`);
        }
        assert.equal(new Set(Object.keys(FIELD_DOORS)).size, Object.keys(FIELD_DOORS).length);
    });

    test('the nine doors are named, and `settings` is the one a field reaches by default', () => {
        assert.deepEqual([...DOORS].sort(), [
            'advanced', 'app', 'calibration', 'cupWarmer', 'machineInfo',
            'presence', 'settings', 'waterLevels', 'workflow',
        ]);
        assert.ok(!Object.hasOwn(FIELD_DOORS, 'tankTemp'));
        for (const field of ['steamFlow', 'flushTemp', 'flushFlow', 'flushTimeout']) {
            assert.equal(FIELD_DOORS[field], 'workflow',
                `${field} is on the Live rail's document — one door, or the two surfaces drift`);
        }
    });

    test('every field both the rail and a settings row read comes through ONE door', () => {
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

describe('the workflow door flattens three fields and merges the smallest patch', () => {
    const DOCUMENT = Object.freeze({
        steamSettings: { targetTemperature: 170, duration: 45, flow: 2.1, stopAtTemperature: 62 },
        hotWaterData: { targetTemperature: 98, duration: 30, volume: 240, flow: 8 },
        rinseData: { targetTemperature: 90, flow: 6, duration: 4 },
    });

    function storeOf({ state = {}, onApply = () => ({ ...state, writeError: null }) } = {}) {
        const applied = [];
        return {
            applied,
            load: async () => state,
            get: () => state,
            apply: async (patch) => { applied.push(patch); return onApply(patch); },
        };
    }

    test('the five paths are declared once, and the door reads them all ways', async () => {

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
        const store = storeOf({ state: { workflow: DOCUMENT } });
        const door = workflowDoorFor(store);
        assert.equal(await door.write({ flushTimeout: 8 }), true);
        assert.deepEqual(store.applied, [{ rinseData: { duration: 8 } }]);
    });

    test('a patch names only the leaves that changed — the handler deep-merges', async () => {
        const store = storeOf({ state: { workflow: DOCUMENT } });
        const door = workflowDoorFor(store);
        assert.equal(await door.write({ hotWaterVolume: 150 }), true);
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
            onApply: () => ({ workflow: DOCUMENT, writeError: { ok: false, status: 500 } }),
        });
        const door = workflowDoorFor(store);
        assert.equal(await door.write({ hotWaterVolume: 150 }), false);
    });

    test('a write the store ABANDONED is not a success, though it recorded no failure', async () => {
        const store = storeOf({
            state: { workflow: DOCUMENT },
            onApply: () => ({ workflow: null, targets: {}, writeError: null }),
        });
        const door = workflowDoorFor(store);
        assert.equal(await door.write({ hotWaterVolume: 150 }), false);
    });

    test('an abandoned write is not saved by the NEXT machine\u2019s document', async () => {
        const DOC_B = { profile: { title: 'B' }, steamSettings: { targetTemperature: 150 } };
        let served = { profile: { title: 'A' }, steamSettings: { targetTemperature: 140 } };
        let releasePut = null;
        const transport = {
            socketUrl: () => 'ws://test',
            url: (path) => `http://test${path}`,
            async request(path, { method = 'GET' } = {}) {
                if (method === 'GET') return ok(served);
                if (releasePut === null) {
                    return new Promise((resolve) => { releasePut = () => resolve(ok(served)); });
                }
                return ok(served);
            },
        };
        const store = createWorkflowStore({ transport });
        const door = workflowDoorFor(store);
        await store.load();
        const press = store.setTarget('steamTemp', 145);
        await Promise.resolve();
        const saving = door.write({ steamTargetTemperature: 151 });
        store.forget();
        served = DOC_B;
        await store.load();
        releasePut?.();
        await press;
        assert.equal(await saving, false, 'a write that never left the tablet reported itself saved');
        assert.equal(store.get().workflow.profile.title, 'B', 'and it was the NEW machine on hand');
        assert.equal(store.get().writeError, null, 'with nothing recorded as a failure');
    });

    test('an ordinary first read does not turn a write the machine took into a refusal', async () => {
        const DOC = { profile: { id: 'p1' }, steamSettings: { flow: 1.2 } };
        let releasePut = null;
        const transport = {
            socketUrl: () => 'ws://test',
            url: (path) => `http://test${path}`,
            async request(path, { method = 'GET', body } = {}) {
                if (method === 'PUT') {
                    await new Promise((resolve) => { releasePut = resolve; });
                    return ok({ ...DOC, ...body });
                }
                return ok({ ...DOC });
            },
        };
        const store = createWorkflowStore({ transport });
        const door = workflowDoorFor(store);
        const saving = door.write({ steamFlow: 1.4 });
        await Promise.resolve();
        const reading = store.load();
        for (let spins = 0; !releasePut && spins < 500; spins += 1) {
            await new Promise((resolve) => { setTimeout(resolve, 2); });
        }
        assert.ok(releasePut, 'the PUT never left, so this case would prove nothing');
        releasePut();
        assert.equal(await saving, true, 'the machine took the write and the door called it abandoned');
        await reading;
        assert.equal(store.get().workflow.steamSettings.flow, 1.4, 'and it is what the machine holds');
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

describe('the app settings client sends sixteen keys and no more', () => {
    test('the write list is the sixteen a control exists for', () => {
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

describe('the tank alert door reports what the machine said, not that it was asked', () => {
    function doorOverTransport(script) {
        const transport = transportOf(script);
        const feed = { get: () => ({ frame: { refillLevel: 5 } }) };
        return {
            transport,
            door: waterLevelsDoorFor({
                feed,
                post: (body) => callRoute(transport, 'postMachineWaterLevels', { body }),
            }),
        };
    }

    test('a 202 is ACCEPTED — the handler answers no body and the value comes back on the feed', async () => {
        const { door, transport } = doorOverTransport(() => reaSuccess({
            status: 202, data: null, method: 'POST', url: 'test',
        }));
        assert.equal(await door.write({ refillLevel: 15 }), true);
        assert.deepEqual(transport.calls.at(-1).body, { refillLevel: 15 });
        assert.deepEqual(await door.read(), { refillLevel: 5 });
    });

    test('a refused write reports false, so the staged threshold stays staged', async () => {
        for (const status of [400, 500, 503]) {
            const { door } = doorOverTransport(() => bad(status));
            assert.equal(await door.write({ refillLevel: 15 }), false,
                `HTTP ${status} resolved as a result and must not read as a success`);
        }
    });

    test('a request that never landed is not a success either', async () => {
        const { door } = doorOverTransport(() => { throw new Error('no route'); });
        assert.equal(await door.write({ refillLevel: 15 }), false);
    });

    test('a value that is not a number never leaves the tablet', async () => {
        const { door, transport } = doorOverTransport(() => reaSuccess({
            status: 202, data: null, method: 'POST', url: 'test',
        }));
        assert.equal(await door.write({ refillLevel: null }), false);
        assert.equal(transport.calls.length, 0);
    });
});
