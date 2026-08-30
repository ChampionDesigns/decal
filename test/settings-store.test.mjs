/**
 * The spine every settings leaf reads and writes through (.4, item b7-storage-routing).
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
        const { settings } = harness({ kvFails: true });
        await settings.load(KV_KEY);
        const outcome = await settings.set(KV_KEY, 'weight');
        assert.equal(outcome.ok, false);
        assert.equal(outcome.reason, WRITE_REFUSAL.BACKEND_FAILED);
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
