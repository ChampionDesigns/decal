/**
 * settings-store.test.mjs — the spine every settings leaf reads and writes through
 * (wave 5.4, item b7-storage-routing).
 *
 * Two laws are under test here and they pull in opposite directions, which is why they get
 * one suite:
 *
 *   B7  — one store per setting. A write goes to exactly one layer, and a FAILED write
 *         surfaces instead of silently losing the setting. That is the units.js defect
 *         (`units.js:52-58,:106-115`): two stores, a swallowed catch, and a boot read of
 *         the other one first, so a rejected put lost the preference AND overwrote the
 *         good copy next boot.
 *   A3  — capability gating through the served array, FAILING CLOSED. Both ABSENT and
 *         UNKNOWN hide a surface. UNKNOWN is the one that bites: the mock answers
 *         /api/v1/machine/capabilities with 503 by design (wave 5.1 REPORT), so `entries`
 *         stays null and every gate reads UNKNOWN, not ABSENT. A gate written against
 *         ABSENT alone renders every machine page against the mock.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createStorageRouter } from '../src/lib/storage-router.js';
import { STORAGE_ROUTES, LAYERS, SCOPES, settingsKeys } from '../src/lib/storage-routes.js';
import { CAPABILITY } from '../src/stores/capabilities-store.js';
import {
    createSettingsStore,
    SURFACE,
    WRITE_REFUSAL,
    VALUE_SOURCE,
} from '../src/stores/settings-store.js';

function memoryBackend() {
    const data = new Map();
    const writes = [];
    return {
        writes,
        data,
        async get(key) { return data.get(key); },
        async set(key, value) { writes.push(key); data.set(key, value); },
        async remove(key) { writes.push(key); data.delete(key); },
    };
}

function harness({ kvFails = false, capabilities = null } = {}) {
    const backends = {
        [LAYERS.local]: memoryBackend(),
        [LAYERS.session]: memoryBackend(),
        [LAYERS.kv]: memoryBackend(),
        [LAYERS.kvNumpad]: memoryBackend(),
    };
    if (kvFails) {
        backends[LAYERS.kv].set = async () => { throw new Error('KV write rejected'); };
    }
    const storage = createStorageRouter({ backends });
    const settings = createSettingsStore({ storage, capabilities });
    return { backends, storage, settings };
}

/** A capabilities stand-in with the store's own tri-state vocabulary. */
const capabilitiesAnswering = (verdict) => ({ capability: () => verdict });

const GATED_KEY = 'cupWarmerTarget';   // capability: 'cupWarmer'
/* A machine-scoped, ungated KV row — the sample machine-scoped KV key.
 *
 * IT WAS `steamStopMode` UNTIL 27 AUGUST 2026, when that row was RETIRED: the Live rail
 * stopped keeping a copy of the steam stop mode and started deriving it from the machine,
 * so the key had no reader left and a `layer: 'none'` row makes the router throw. Nothing
 * in this file was ever about steam — what it needs is one machine-scoped ungated key, and
 * the tank's display unit is one. */
const KV_KEY = 'waterTankUnit';        // machine-scoped, ungated
const LOCAL_KEY = 'theme';             // device-scoped

describe('the enumeration is the table\'s, not a second list', () => {
    test('keys, leaves and rows come from storage-routes', () => {
        const { settings } = harness();
        assert.deepEqual([...settings.keys], settingsKeys());
        assert.ok(settings.leaves.length > 0);
        assert.equal(settings.rowFor(KV_KEY).layer, LAYERS.kv);
        assert.equal(settings.rowFor(LOCAL_KEY).scope, SCOPES.device);
    });

    test('an unknown key is refused by every method, never defaulted', () => {
        const { settings } = harness();
        for (const call of [
            () => settings.rowFor('notASetting'),
            () => settings.value('notASetting'),
            () => settings.gate('notASetting'),
            () => settings.subscribe('notASetting', () => {}),
        ]) {
            assert.throws(call, /is not a settings key/);
        }
    });

    test('an unknown key is refused on the write path too', async () => {
        const { settings } = harness();
        await assert.rejects(() => settings.set('notASetting', 1), /is not a settings key/);
        await assert.rejects(() => settings.load('notASetting'), /is not a settings key/);
    });
});

describe('reads — absent is a real answer', () => {
    test('an unread key is undefined and NOT loaded', () => {
        const { settings } = harness();
        assert.equal(settings.value(LOCAL_KEY), undefined);
        assert.equal(settings.isLoaded(LOCAL_KEY), false);
    });

    test('a read absence is loaded, and distinguishable from never-read', async () => {
        const { settings } = harness();
        const result = await settings.load(LOCAL_KEY);
        assert.equal(result.source, VALUE_SOURCE.ABSENT);
        assert.equal(result.value, undefined);
        assert.equal(settings.isLoaded(LOCAL_KEY), true);
    });

    test('a stored value reads back and publishes to subscribers', async () => {
        const { settings, backends } = harness();
        await backends[LAYERS.local].set('decal.theme', 'dark');
        const seen = [];
        settings.subscribe(LOCAL_KEY, (v) => seen.push(v));
        const result = await settings.load(LOCAL_KEY);
        assert.equal(result.source, VALUE_SOURCE.STORED);
        assert.equal(result.value, 'dark');
        assert.deepEqual(seen, [undefined, 'dark']);
    });

    /* THE REGRESSION THIS FILE DID NOT HAVE, found on 24 Aug 2026 by a render test that
     * visited a leaf twice.
     *
     * `store.set` THROWS when it is handed the object it already holds — that is pattern
     * F wearing a disguise, and the guard is right. A backend that answers with the SAME
     * REFERENCE it was given (the memory backend does, and so would any cache) makes an
     * ordinary re-read look exactly like that mistake, so `load()` blew up on the second
     * visit to the leaf.
     *
     * IT HAD NEVER FIRED because every routed key held a PRIMITIVE, and `set` treats an
     * equal primitive as a genuine no-op. `keyboardBindings` is the first object-valued
     * routed key; it arrived with the rebinding editor. */
    test('re-reading an OBJECT value is a no-op, not the pattern-F throw', async () => {
        const { settings, backends } = harness();
        const bindings = Object.freeze({ espresso: 'x' });
        await backends[LAYERS.local].set('decal.keyboardBindings', bindings);

        const seen = [];
        settings.subscribe('keyboardBindings', (v) => seen.push(v));
        await settings.load('keyboardBindings');
        await settings.load('keyboardBindings');
        await settings.load('keyboardBindings');

        assert.deepEqual(settings.value('keyboardBindings'), bindings);
        /* ONE publish for the value, plus the immediate one every subscribe makes. Three
         * reads of an unchanged object are one change. */
        assert.deepEqual(seen, [undefined, bindings]);
    });

    test('load NEVER writes — the boot path that made a bad copy permanent', async () => {
        const { settings, backends } = harness();
        await settings.loadAll();
        for (const [layer, backend] of Object.entries(backends)) {
            assert.deepEqual(backend.writes, [], `${layer}: load() wrote`);
        }
    });

    test('loadLeaf reads exactly the keys that leaf owns', async () => {
        const { settings } = harness();
        const results = await settings.loadLeaf('display-screen-saver');
        /* FOUR SINCE 26 AUG 2026, and three of the four changed name or shape.
         *
         * `screensaverClock` WAS A SWITCH AND IS NOW A CHOICE. It went in on 24 August as
         * "a faint clock on the black screen", a second boolean beside `screensaverEnabled`
         * — and two booleans for one question is how a screen ends up in a state neither of
         * them describes. It is `screensaverType` now: black, image or clock, one value.
         *
         * `screensaverCycleSeconds` BECAME MINUTES, on Ben's band: "Make that a stepper, 1
         * to 10 minutes." Slate's own control is 2-600 SECONDS, which answers a different
         * question — two seconds is a slideshow, and this is a screen saver.
         *
         * `screensaverImages` IS LIVE AGAIN. D10 made this skin's screensaver fully black
         * and retired the list; the type choice brings the picture back, so the images the
         * person chose are a key this leaf owns once more. */
        assert.deepEqual(
            results.map((r) => r.key).sort(),
            ['screensaverCycleMinutes', 'screensaverEnabled', 'screensaverImages', 'screensaverType'],
        );
    });
});

describe('writes — one layer, and a failure that surfaces', () => {
    test('a successful write lands in one backend and publishes', async () => {
        const { settings, backends } = harness();
        const outcome = await settings.set(KV_KEY, 'weight');
        assert.equal(outcome.ok, true);
        assert.equal(outcome.layer, LAYERS.kv);
        assert.deepEqual(backends[LAYERS.kv].writes, [KV_KEY]);
        assert.deepEqual(backends[LAYERS.local].writes, []);
        assert.equal(settings.value(KV_KEY), 'weight');
    });

    test('A FAILED WRITE DOES NOT CHANGE THE SHOWN VALUE', async () => {
        // The whole point. A settings row that shows a value it did not persist is the
        // silent revert wearing a new coat.
        const { settings } = harness({ kvFails: true });
        await settings.load(KV_KEY);
        const outcome = await settings.set(KV_KEY, 'weight');
        assert.equal(outcome.ok, false);
        assert.equal(outcome.reason, WRITE_REFUSAL.BACKEND_FAILED);
        /* THE ASSERTION IS "NOT THE REFUSED VALUE", NOT "EMPTY". Since O3 (26 Aug 2026)
         * every key Ben decided has a default, so an unset key reads as that default
         * rather than as nothing — which is the point of O3 and does not weaken this
         * test's claim. `storedValue` is the raw read, and it is what proves nothing was
         * persisted. */
        assert.notEqual(settings.value(KV_KEY), 'weight', 'the store showed a value it never stored');
        assert.equal(settings.storedValue(KV_KEY), undefined, 'and nothing reached a backend');
    });

    test('a failed write fires onWriteFailure — it is not swallowed', async () => {
        const { settings } = harness({ kvFails: true });
        const failures = [];
        settings.onWriteFailure((event) => failures.push(event));
        await settings.set(KV_KEY, 'weight');
        assert.equal(failures.length, 1);
        assert.equal(failures[0].key, KV_KEY);
        assert.equal(failures[0].reason, WRITE_REFUSAL.BACKEND_FAILED);
    });

    test('a failed write reaches no other layer', async () => {
        const { settings, backends } = harness({ kvFails: true });
        await settings.set(KV_KEY, 'weight');
        assert.deepEqual(backends[LAYERS.local].writes, [], 'fell back to localStorage');
        assert.deepEqual(backends[LAYERS.session].writes, [], 'fell back to sessionStorage');
    });

    test('unsubscribing from write failures actually stops delivery', async () => {
        const { settings } = harness({ kvFails: true });
        const failures = [];
        const off = settings.onWriteFailure((e) => failures.push(e));
        await settings.set(KV_KEY, 'a');
        off();
        await settings.set(KV_KEY, 'b');
        assert.equal(failures.length, 1);
    });

    test('a null write DELETES rather than storing the string "null"', async () => {
        // ReaPrime's handler does `jsonDecode(body) ?? body` (kv_store_handler.dart:41,:47)
        // and jsonDecode('null') is null, so a null body lands the four characters 'null'
        // in the store and reads back present and truthy. The router routes null to
        // remove(); this proves the settings store rides that path rather than around it.
        const { settings, backends } = harness();
        await settings.set(KV_KEY, 'weight');
        const outcome = await settings.set(KV_KEY, null);
        assert.equal(outcome.ok, true);
        assert.equal(backends[LAYERS.kv].data.has(KV_KEY), false, 'the key survived a null write');
        assert.notEqual(backends[LAYERS.kv].data.get(KV_KEY), 'null');
    });

    test('remove clears the value and reports the outcome', async () => {
        const { settings, backends } = harness();
        await settings.set(LOCAL_KEY, 'dark');
        const outcome = await settings.remove(LOCAL_KEY);
        assert.equal(outcome.ok, true);
        assert.equal(settings.value(LOCAL_KEY), undefined);
        assert.equal(backends[LAYERS.local].data.has('decal.theme'), false);
    });
});

describe('A3 capability gating — fail CLOSED', () => {
    test('an ungated key is always shown', () => {
        const { settings } = harness({ capabilities: capabilitiesAnswering(CAPABILITY.ABSENT) });
        assert.equal(settings.gate(KV_KEY).surface, SURFACE.SHOWN);
        assert.equal(settings.gate(KV_KEY).capability, null);
    });

    test('PRESENT shows the gated surface', () => {
        const { settings } = harness({ capabilities: capabilitiesAnswering(CAPABILITY.PRESENT) });
        const verdict = settings.gate(GATED_KEY);
        assert.equal(verdict.surface, SURFACE.SHOWN);
        assert.equal(verdict.capability, 'cupWarmer');
    });

    test('ABSENT hides it', () => {
        const { settings } = harness({ capabilities: capabilitiesAnswering(CAPABILITY.ABSENT) });
        assert.equal(settings.gate(GATED_KEY).surface, SURFACE.HIDDEN);
    });

    test('UNKNOWN hides it too — the mock answers 503 and entries stays null', () => {
        const { settings } = harness({ capabilities: capabilitiesAnswering(CAPABILITY.UNKNOWN) });
        const verdict = settings.gate(GATED_KEY);
        assert.equal(verdict.surface, SURFACE.HIDDEN, 'an unknown capability rendered its surface');
        assert.equal(verdict.verdict, CAPABILITY.UNKNOWN);
    });

    test('NO capabilities store at all is UNKNOWN, not "allow"', () => {
        const { settings } = harness({ capabilities: null });
        assert.equal(settings.gate(GATED_KEY).surface, SURFACE.HIDDEN);
        assert.equal(settings.gate(GATED_KEY).verdict, CAPABILITY.UNKNOWN);
    });

    test('a hidden surface CANNOT write — fail-closed covers the write direction', async () => {
        for (const verdict of [CAPABILITY.ABSENT, CAPABILITY.UNKNOWN]) {
            const { settings, backends } = harness({ capabilities: capabilitiesAnswering(verdict) });
            const outcome = await settings.set(GATED_KEY, 60);
            assert.equal(outcome.ok, false, `${verdict}: the write was allowed`);
            assert.equal(outcome.reason, WRITE_REFUSAL.CAPABILITY_NOT_PRESENT);
            assert.deepEqual(backends[LAYERS.kv].writes, [], `${verdict}: the write reached the machine`);
        }
    });

    test('a hidden surface cannot DELETE either — remove() takes the same gate', async () => {
        // remove() is a write. Against the mock the capabilities endpoint answers 503 by
        // design (wave 5.1 REPORT), so every gated key reads UNKNOWN, and an ungated
        // remove() would send DELETE /api/v1/store/decal/cupWarmerTarget to a machine
        // that never advertised cupWarmer — the exact case claim 5 is written against.
        for (const verdict of [CAPABILITY.ABSENT, CAPABILITY.UNKNOWN]) {
            const { settings, backends } = harness({ capabilities: capabilitiesAnswering(verdict) });
            const outcome = await settings.remove(GATED_KEY);
            assert.equal(outcome.ok, false, `${verdict}: the delete was allowed`);
            assert.equal(outcome.reason, WRITE_REFUSAL.CAPABILITY_NOT_PRESENT);
            assert.equal(outcome.capability, 'cupWarmer');
            assert.equal(outcome.verdict, verdict);
            assert.deepEqual(backends[LAYERS.kv].writes, [], `${verdict}: the delete reached the machine`);
        }
    });

    test('a refused delete surfaces on the same seam as a refused set', async () => {
        const { settings } = harness({ capabilities: capabilitiesAnswering(CAPABILITY.UNKNOWN) });
        const failures = [];
        settings.onWriteFailure((e) => failures.push(e));
        await settings.remove(GATED_KEY);
        assert.equal(failures.length, 1);
        assert.equal(failures[0].reason, WRITE_REFUSAL.CAPABILITY_NOT_PRESENT);
    });

    test('a PRESENT capability lets the delete through', async () => {
        const { settings, backends } = harness({ capabilities: capabilitiesAnswering(CAPABILITY.PRESENT) });
        await settings.set(GATED_KEY, 55);
        const outcome = await settings.remove(GATED_KEY);
        assert.equal(outcome.ok, true);
        assert.equal(outcome.verdict, CAPABILITY.PRESENT);
        assert.equal(settings.storedValue(GATED_KEY), undefined, 'the stored value is gone');
        assert.equal(backends[LAYERS.kv].data.has('cupWarmerTarget'), false);
    });

    test('a refused write also surfaces — it is not a silent no-op', async () => {
        const { settings } = harness({ capabilities: capabilitiesAnswering(CAPABILITY.UNKNOWN) });
        const failures = [];
        settings.onWriteFailure((e) => failures.push(e));
        await settings.set(GATED_KEY, 60);
        assert.equal(failures.length, 1);
        assert.equal(failures[0].reason, WRITE_REFUSAL.CAPABILITY_NOT_PRESENT);
    });

    test('gating reads the served array only — no model string anywhere in the module', async () => {
        const source = await import('node:fs').then((fs) => fs.readFileSync(
            new URL('../src/stores/settings-store.js', import.meta.url), 'utf8',
        ));
        const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
        assert.doesNotMatch(code, /isBengle|machineModel|\bmodel\b/i, 'a model-name sniff reached the gate');
    });

    test('describe() reports the gate verdict per key', () => {
        const { settings } = harness({ capabilities: capabilitiesAnswering(CAPABILITY.UNKNOWN) });
        const rows = settings.describe();
        assert.equal(rows.length, settingsKeys().length);
        const gated = rows.find((r) => r.key === GATED_KEY);
        assert.equal(gated.surface, SURFACE.HIDDEN);
        assert.equal(gated.capability, 'cupWarmer');
        assert.equal(rows.find((r) => r.key === LOCAL_KEY).surface, SURFACE.SHOWN);
    });
});

describe('construction refuses to be useless', () => {
    test('no storage router is fatal, not a no-op store', () => {
        assert.throws(() => createSettingsStore({}), /storage router must be injected/);
        assert.throws(() => createSettingsStore({ storage: {} }), /storage router must be injected/);
    });

    test('the module declares no timers — D7\'s pattern is timer-free and so is this', async () => {
        const source = await import('node:fs').then((fs) => fs.readFileSync(
            new URL('../src/stores/settings-store.js', import.meta.url), 'utf8',
        ));
        const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
        assert.doesNotMatch(code, /setTimeout|setInterval|requestAnimationFrame|debounce|throttle/);
    });

    test('the module is DOM-free', async () => {
        const source = await import('node:fs').then((fs) => fs.readFileSync(
            new URL('../src/stores/settings-store.js', import.meta.url), 'utf8',
        ));
        const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
        for (const global of ['document', 'window', 'localStorage', 'sessionStorage', 'fetch(']) {
            assert.ok(!code.includes(global), `${global} appears in the settings store`);
        }
    });
});
