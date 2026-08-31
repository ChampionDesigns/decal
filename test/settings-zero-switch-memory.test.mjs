/**
 * both halves: what a master switch comes back to, and how its memory can be forgotten.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createStorageRouter } from '../src/lib/storage-router.js';
import { LAYERS } from '../src/lib/storage-routes.js';
import { createSettingsStore } from '../src/stores/settings-store.js';
import { createSettingsLeafModel } from '../src/stores/settings-leaf-model.js';
import { cupWarmerDoorFor } from '../src/stores/machine-fields-port.js';
import { limitsFor } from '../src/lib/machine-limits.js';
import { STORED_DEFAULTS, MACHINE_FALLBACKS } from '../src/lib/settings-defaults.js';

/** A backend that RECORDS, so "nothing was written" is a fact rather than an absence. */
function recordingBackend() {
    const data = new Map();
    const writes = [];
    return {
        data,
        writes,
        async get(key) { return data.get(key); },
        async set(key, value) { writes.push({ key, value }); data.set(key, value); return true; },
        async remove(key) { writes.push({ key, remove: true }); data.delete(key); return true; },
    };
}

const WARMER_OFF_HOLDING_70 = Object.freeze({
    fan: 30, usb: true, flushTemp: 90, flushTimeout: 5, flushFlow: 6,
    hotWaterFlow: 8, steamFlow: 1.2, tankTemp: 44, steamPurgeMode: 0,
    steamTargetTemperature: 150,
    cupWarmerTemperature: 0,
    cupWarmerHeldTarget: 70,
});

const answering = (verdict) => ({ capability: () => verdict });

function harness({ document: served = WARMER_OFF_HOLDING_70, kvSeed = {} } = {}) {
    const kv = recordingBackend();
    const backends = {
        [LAYERS.local]: recordingBackend(),
        [LAYERS.session]: recordingBackend(),
        [LAYERS.kv]: kv,
        [LAYERS.kvNumpad]: recordingBackend(),
    };
    const storage = createStorageRouter({ backends });
    const settings = createSettingsStore({ storage, capabilities: answering('present') });
    return { kv, storage, settings, kvSeed, served };
}

async function opened({ leaf = 'accessories-cup-warmer', ...options } = {}) {
    const rig = harness(options);
    for (const [key, value] of Object.entries(rig.kvSeed)) await rig.storage.set(key, value);
    const written = [];
    const model = createSettingsLeafModel({
        settings: rig.settings,
        machine: {
            read: async () => ({ ...rig.served }),
            write: async (patch) => { written.push(patch); return true; },
        },
        limits: limitsFor('bengle'),
        machineClass: null,
    });
    await model.load(leaf);
    return { ...rig, model, written, leaf };
}

const rowById = (model, leaf, id) => model.allRows(leaf).find((view) => view.id === id);

/** Every kv write and delete the run made — the request log this file asserts on. */
const kvLog = (kv) => kv.writes.map((w) => (w.remove ? `DELETE ${w.key}` : `${w.key}=${w.value}`));

describe('D09 — a master switch comes back to the machine before a shipped default', () => {
    test('THE MEASURED CASE: a warmer holding 70 with the switch off comes back to 70, not 60',
        async () => {
            /* S03 exactly: no memory key stored, the mat holding its own 70. */
            const rig = await opened({});
            assert.equal(rig.kv.data.size, 0, 'no memory key is stored — this is the S03 state');
            assert.equal(STORED_DEFAULTS.cupWarmerTarget, 60,
                'the shipped default that used to answer first');

            const row = rowById(rig.model, rig.leaf, 'accessories-cup-warmer-enabled');
            assert.equal(row.checked, false, 'the warmer starts off');

            const result = await rig.model.set(row.row, true);
            assert.equal(result.ok, true);

            assert.equal(rig.model.pendingPatch.cupWarmerTemperature, 70,
                'the machine\'s own held setpoint. 60 here is the defect: a real 70 '
                + 'overwritten by a shipped default with no word on the glass.');
        });

    test('a STORED memory outranks the machine — the user\'s own last word wins', async () => {
        const rig = await opened({ kvSeed: { cupWarmerTarget: 55 } });
        const row = rowById(rig.model, rig.leaf, 'accessories-cup-warmer-enabled');

        await rig.model.set(row.row, true);
        assert.equal(rig.model.pendingPatch.cupWarmerTemperature, 55);
    });

    test('a STAGED memory outranks a stored one — off-then-on inside one band', async () => {
        const rig = await opened({
            document: { ...WARMER_OFF_HOLDING_70, cupWarmerTemperature: 68 },
            kvSeed: { cupWarmerTarget: 55 },
        });
        const row = () => rowById(rig.model, rig.leaf, 'accessories-cup-warmer-enabled').row;

        await rig.model.set(row(), false);          // remembers 68, stages the field at 0
        await rig.model.set(row(), true);
        assert.equal(rig.model.pendingPatch.cupWarmerTemperature, 68,
            'the number the off remembered, not the one a previous session left');
    });

    test('with no memory and no held setpoint, the shipped default still answers', async () => {
        const rig = await opened({
            document: { ...WARMER_OFF_HOLDING_70, cupWarmerHeldTarget: 0 },
        });
        const row = rowById(rig.model, rig.leaf, 'accessories-cup-warmer-enabled');

        await rig.model.set(row.row, true);
        assert.equal(rig.model.pendingPatch.cupWarmerTemperature, STORED_DEFAULTS.cupWarmerTarget);
    });

    test('a row with no heldField is unchanged — steam and the tank skip that rung', async () => {
        const rig = await opened({
            leaf: 'machine-steam',
            document: { ...WARMER_OFF_HOLDING_70, steamTargetTemperature: 0 },
        });
        const row = rowById(rig.model, rig.leaf, 'machine-steam-enabled');
        assert.equal(row.row.heldField, undefined, 'steam declares none');

        await rig.model.set(row.row, true);
        assert.equal(rig.model.pendingPatch.steamTargetTemperature, STORED_DEFAULTS.steamTempWhenOn);
    });

    test('zero is never a value to come back to, on any rung', () => {
        assert.equal(MACHINE_FALLBACKS.cupWarmerTemperature, 0);
    });
});

describe('D09 — the cup-warmer door publishes the machine\'s held setpoint', () => {
    const doorOver = (warmer) => cupWarmerDoorFor({
        async refresh() { return true; },
        get: () => ({ warmer, preheat: null, preheatSupported: null }),
    });

    test('an OFF warmer reads the SETTING as zero and the HELD target as its real number',
        async () => {
            const out = await doorOver({ temperature: 70, enabled: false, currentTemperature: 41.5 })
                .read();
            assert.equal(out.cupWarmerTemperature, 0, 'the SETTING is off');
            assert.equal(out.cupWarmerHeldTarget, 70, 'and the mat is still holding 70');
            assert.equal(out.cupWarmerCurrentTemperature, 41.5, 'the live plate reading, untouched');
        });

    test('an ON warmer reads the same number twice, which is correct and not a duplication',
        async () => {
            const out = await doorOver({ temperature: 65, enabled: true }).read();
            assert.equal(out.cupWarmerTemperature, 65);
            assert.equal(out.cupWarmerHeldTarget, 65);
        });

    test('a warmer with no setpoint publishes no held target at all', async () => {
        /* ABSENT STAYS ABSENT. A machine that has served no temperature must not gain a
         * zero here — the ladder would then read it as a rung that answered. */
        const out = await doorOver({ temperature: null, enabled: false }).read();
        assert.equal(out.cupWarmerTemperature, 0);
        assert.equal('cupWarmerHeldTarget' in out, false);
    });
});

describe('D09 — Restore defaults forgets what the master switch remembered', () => {
    test('the press stages a forget and sends NOTHING', async () => {
        const rig = await opened({ kvSeed: { cupWarmerTarget: 62 } });
        const before = kvLog(rig.kv).length;

        await rig.model.restoreDefaults(rig.leaf);

        assert.deepEqual(kvLog(rig.kv).slice(before), [],
            'a DELETE on the press would be F-049 in the other direction — a memory '
            + 'destroyed outside the commit band, which Cancel could not bring back');
        assert.equal(rig.kv.data.get('decal.cupWarmerTarget') ?? rig.kv.data.get('cupWarmerTarget'), 62,
            'and the key is untouched until Save');
    });

    test('Cancel takes the forget back, exactly as it takes back a remembered value',
        async () => {
            const rig = await opened({ kvSeed: { cupWarmerTarget: 62 } });
            const before = kvLog(rig.kv).length;

            await rig.model.restoreDefaults(rig.leaf);
            rig.model.discard();
            const commit = await rig.model.commit();

            assert.equal(commit.wrote, 0, 'nothing was staged to commit');
            assert.deepEqual(kvLog(rig.kv).slice(before), [], 'and the memory is still there');
        });

    test('SAVE DELETES IT — the set→absent direction that did not exist anywhere in src/',
        async () => {
            const rig = await opened({ kvSeed: { cupWarmerTarget: 62 } });
            const before = kvLog(rig.kv).length;

            await rig.model.restoreDefaults(rig.leaf);
            const commit = await rig.model.commit();
            assert.equal(commit.ok, true, commit.reason ?? '');

            const log = kvLog(rig.kv).slice(before);
            assert.ok(
                log.some((line) => line.startsWith('DELETE') && line.includes('cupWarmerTarget')),
                `no DELETE reached the kv layer: ${JSON.stringify(log)}`,
            );
            assert.equal(rig.settings.storedValue('cupWarmerTarget'), undefined,
                'and the store no longer holds one');
        });

    test('AND THE DELETE IS A DELETE, not a write of null', async () => {
        const rig = await opened({ kvSeed: { cupWarmerTarget: 62 } });
        await rig.model.restoreDefaults(rig.leaf);
        await rig.model.commit();

        const nulls = rig.kv.writes.filter((w) => !w.remove && w.value === null);
        assert.deepEqual(nulls, [], 'a null was WRITTEN rather than the key removed');
    });

    test('a leaf whose memory key holds nothing stages no forget and makes no DELETE',
        async () => {
            const rig = await opened({});
            const before = kvLog(rig.kv).length;

            await rig.model.restoreDefaults(rig.leaf);
            await rig.model.commit();

            assert.deepEqual(
                kvLog(rig.kv).slice(before).filter((line) => line.startsWith('DELETE')), [],
                'a DELETE for a key that never existed',
            );
        });

    test('the machine restore still happens — forgetting is added, not substituted', async () => {
        const rig = await opened({ kvSeed: { cupWarmerTarget: 62 } });
        await rig.model.restoreDefaults(rig.leaf);
        const commit = await rig.model.commit();

        assert.equal(commit.ok, true);
        assert.ok(rig.written.length > 0, 'the machine patch went out as it always did');
        assert.equal(rig.written[0].cupWarmerTemperature, MACHINE_FALLBACKS.cupWarmerTemperature);
    });

    test('after a forget, switching on falls to the machine — which is the two halves meeting',
        async () => {
            const rig = await opened({ kvSeed: { cupWarmerTarget: 62 } });
            await rig.model.restoreDefaults(rig.leaf);
            await rig.model.commit();

            const row = rowById(rig.model, rig.leaf, 'accessories-cup-warmer-enabled');
            await rig.model.set(row.row, true);
            assert.equal(rig.model.pendingPatch.cupWarmerTemperature, 70);
        });
});
