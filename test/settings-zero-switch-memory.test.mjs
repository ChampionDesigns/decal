/**
 * settings-zero-switch-memory.test.mjs — D09, both halves: what a master switch comes back
 * to, and how its memory can be forgotten.
 *
 * AUDIT F-049 had three faces. Round 1 fixed the first — the remembered value is staged
 * with the machine field, so Cancel takes back both — and `settings-leaf-model-commit-band
 * .test.mjs` is that half. It left the other two to Ben, in its own words: *"the restore
 * ladder still consults `STORED_DEFAULTS` before the machine's own held setpoint (the
 * 70-overwritten-by-60 case, S03), and the three keys are still write-only from the UI
 * (S03c)."* Ben's decision D09 (30 August 2026) settled both. This file is that decision,
 * asserted.
 *
 * ═══ HALF ONE — THE LADDER ═══
 *
 * S03, measured on the device: a warmer holding `{"temperature":70,"enabled":false}` — the
 * real tablet's own closing state — switched **on** from the glass was written
 * `{"temperature":60,"enabled":true}`. The ladder read the memory key first, and an absent
 * kv key is not absent to the settings store: `STORED_DEFAULTS.cupWarmerTarget = 60`
 * answered for it, in the same shape a real memory would have. **A real 70 overwritten by
 * a shipped 60 with no word on the glass.**
 *
 * TWO THINGS HAD TO CHANGE AND EITHER ALONE IS NOT ENOUGH, which is why the cases below
 * are split rather than folded into one end-to-end check:
 *   the LADDER now reads `storedValue()` (the stored number ALONE) before it reaches the
 *   decided default, and consults the machine in between; and the PORT now publishes the
 *   machine's held setpoint at all — `machine-fields-port.js` collapses `enabled:false` to
 *   `cupWarmerTemperature: 0`, correctly, so before D09 there was no held 70 anywhere
 *   above that door for a ladder to consult.
 *
 * ═══ HALF TWO — THE FORGETTING ═══
 *
 * S03c: `steamTempWhenOn`, `tankTempWhenOn` and `cupWarmerTarget` were WRITE-ONLY from the
 * UI — absent→set existed, set→absent did not, anywhere in `src/`. The audit checked the
 * one plausible candidate on the real tablet: **"Restore defaults" made 0 DELETEs and 0 kv
 * writes, and `cupWarmerTarget` was still 62 and `tankTempWhenOn` still 47 afterwards.**
 * D09 gives that button the job, because a restore that leaves a private memory behind is
 * the restore lying — the page reads as shipped and the next switch-on resurrects a number
 * from a session nobody remembers.
 *
 * AND THE FORGETTING IS STAGED, which is F-049's own lesson applied in the other
 * direction: a DELETE fired on the press would destroy a memory outside the commit band
 * and Cancel could not bring it back.
 *
 * A pure test over the real stores — the real storage router, the real settings store, a
 * recording memory backend — so "it reaches the kv layer" is exercised rather than mocked.
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
        /* A REMOVE IS RECORDED AS ITS OWN KIND, not as a write of null: half two's whole
         * claim is that a DELETE happens, and a log that spelled both the same could not
         * tell a delete from a write of an empty value. */
        async remove(key) { writes.push({ key, remove: true }); data.delete(key); return true; },
    };
}

/**
 * The warmer OFF with its setpoint still held — S03's exact starting state.
 *
 * `cupWarmerTemperature: 0` is what the door publishes for `enabled:false`, and
 * `cupWarmerHeldTarget: 70` is the number the mat is still holding. Both, together, are
 * the state the old ladder could not see the second half of.
 */
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
    /* SEEDED THROUGH THE ROUTER, because a backend is keyed by the PHYSICAL name and the
     * router is what derives it. Seeding the Map directly puts the value under a name the
     * router never asks for, and every read then falls through to the default — which is
     * the very confusion this file is about. */
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

/* ═══════════════════════════════════════════════════════════════════════════
 * HALF ONE — THE RESTORE LADDER
 * ═══════════════════════════════════════════════════════════════════════ */

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
        /* The rung order is not arbitrary. A memory is what this skin was ASKED to
         * remember; the machine's number is what it happens to be holding. Where both
         * exist the memory is the more recent statement of intent. */
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
        /* RUNG 4 IS STILL THERE. D09 reordered the ladder; it did not remove a rung. On a
         * machine that has never had its warmer switched on there is no memory and no held
         * number, and `STORED_DEFAULTS` is the only value anybody has decided. */
        const rig = await opened({
            document: { ...WARMER_OFF_HOLDING_70, cupWarmerHeldTarget: 0 },
        });
        const row = rowById(rig.model, rig.leaf, 'accessories-cup-warmer-enabled');

        await rig.model.set(row.row, true);
        assert.equal(rig.model.pendingPatch.cupWarmerTemperature, STORED_DEFAULTS.cupWarmerTarget);
    });

    test('a row with no heldField is unchanged — steam and the tank skip that rung', async () => {
        /* THE OTHER TWO `zeroSwitch` ROWS SAY "OFF" BY PUTTING A ZERO IN THE FIELD, so
         * there is no held number to consult and the ladder must behave exactly as it did.
         * This is the regression half of the reorder. */
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
        /* Restoring a zero would turn the switch straight back off, which is why every
         * rung is filtered for a POSITIVE number rather than merely a defined one. The
         * machine fallback at the foot of the ladder is 0 for this field — so a leaf that
         * reached it would produce exactly that non-restore. */
        assert.equal(MACHINE_FALLBACKS.cupWarmerTemperature, 0);
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * THE PORT HALF — the held setpoint has to EXIST above the door
 * ═══════════════════════════════════════════════════════════════════════ */

describe('D09 — the cup-warmer door publishes the machine\'s held setpoint', () => {
    const doorOver = (warmer) => cupWarmerDoorFor({
        async refresh() { return true; },
        get: () => ({ warmer, preheat: null, preheatSupported: null }),
    });

    test('an OFF warmer reads the SETTING as zero and the HELD target as its real number',
        async () => {
            /* BOTH CLAIMS AT ONCE, because the first is what made the second necessary. The
             * setting must be 0 — that is what the switch and every gated row below it act
             * on — and the held number must survive somewhere, or the ladder has nothing to
             * ask. Before D09 only the first existed. */
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

/* ═══════════════════════════════════════════════════════════════════════════
 * HALF TWO — FORGETTING, AND IT IS INSIDE THE COMMIT BAND
 * ═══════════════════════════════════════════════════════════════════════ */

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
        /* ReaPrime's kv handler does `jsonDecode(body) ?? body`, and `jsonDecode("null")`
         * is null — so a written null lands the four-character STRING 'null' in the store
         * and reads back as a present, truthy setting. The router routes a null write to
         * remove() for exactly this reason; asserting the shape here means a later
         * refactor that "simplifies" the forget into `set(key, null)` goes red. */
        const rig = await opened({ kvSeed: { cupWarmerTarget: 62 } });
        await rig.model.restoreDefaults(rig.leaf);
        await rig.model.commit();

        const nulls = rig.kv.writes.filter((w) => !w.remove && w.value === null);
        assert.deepEqual(nulls, [], 'a null was WRITTEN rather than the key removed');
    });

    test('a leaf whose memory key holds nothing stages no forget and makes no DELETE',
        async () => {
            /* Otherwise every press of this button on every machine posts a DELETE for a
             * key that was never there. `storedValue()` is the read that can tell "absent"
             * from "shipped default" — `value()` cannot, and using it here would stage a
             * forget on every leaf for ever. */
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
            /* THE POINT OF THE WHOLE DECISION, in one run: the stale 62 is gone, so the
             * ladder reaches the machine's held 70 instead of resurrecting a number from a
             * session nobody remembers. Before D09 the memory could not be removed AND the
             * ladder would have preferred a shipped 60 to the machine anyway. */
            const rig = await opened({ kvSeed: { cupWarmerTarget: 62 } });
            await rig.model.restoreDefaults(rig.leaf);
            await rig.model.commit();

            const row = rowById(rig.model, rig.leaf, 'accessories-cup-warmer-enabled');
            await rig.model.set(row.row, true);
            assert.equal(rig.model.pendingPatch.cupWarmerTemperature, 70);
        });
});
