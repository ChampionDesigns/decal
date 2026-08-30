// The backends, and specifically the two failure modes the module they replace got wrong:
// an absent store threw at first read, and a failing write was invisible.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    createMemoryBackend,
    createWebStorageBackend,
    createNullBackend,
} from '../src/lib/storage-backends.js';
import { createStorageRouter } from '../src/lib/storage-router.js';

/** A Web Storage double. `fail` makes writes throw the way a quota failure does. */
function fakeWebStorage({ fail = false, initial = {} } = {}) {
    const map = new Map(Object.entries(initial));
    return {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => {
            if (fail) throw new Error('QuotaExceededError');
            map.set(k, v);
        },
        removeItem: (k) => map.delete(k),
        raw: map,
    };
}

function recordingLogger() {
    const lines = [];
    const self = {
        debug: (...a) => lines.push(['debug', ...a]),
        info: (...a) => lines.push(['info', ...a]),
        warn: (...a) => lines.push(['warn', ...a]),
        error: (...a) => lines.push(['error', ...a]),
        scope: () => self,
        lines,
    };
    return self;
}

test('memory backend round-trips and reports absent as undefined', () => {
    const backend = createMemoryBackend();
    assert.equal(backend.get('a'), undefined);
    backend.set('a', { x: 1 });
    assert.deepEqual(backend.get('a'), { x: 1 });
    backend.remove('a');
    assert.equal(backend.get('a'), undefined);
});

test('web storage round-trips through JSON', () => {
    const storage = fakeWebStorage();
    const backend = createWebStorageBackend({ storage, label: 'localStorage' });
    backend.set('decal.theme', 'dark');
    assert.equal(storage.raw.get('decal.theme'), '"dark"');
    assert.equal(backend.get('decal.theme'), 'dark');
    backend.set('decal.presets', [1, 2, 3]);
    assert.deepEqual(backend.get('decal.presets'), [1, 2, 3]);
});

test('an ABSENT store degrades to memory with one warning — it does not throw', () => {
    // storage-keys.js:20-22 threw `${name} is unavailable`; in a private-mode WebView that
    // was an uncaught throw at first read. SCOPE Part 3 §5: degrade to in-memory instead.
    const logger = recordingLogger();
    const backend = createWebStorageBackend({ storage: undefined, logger, label: 'localStorage' });
    assert.doesNotThrow(() => backend.get('decal.theme'));
    backend.set('decal.theme', 'light');
    assert.equal(backend.get('decal.theme'), 'light', 'the in-memory fallback still works within the session');
    assert.equal(backend.isDegraded, true);
    const warnings = logger.lines.filter(([level]) => level === 'warn');
    assert.equal(warnings.length, 1, 'exactly one warning, not one per call');
    assert.match(warnings[0][1], /localStorage is unavailable/);
    assert.match(warnings[0][1], /will not survive a reload/);
});

test('a store that THROWS on access degrades the same way', () => {
    const logger = recordingLogger();
    const hostile = { get getItem() { throw new Error('SecurityError'); } };
    const backend = createWebStorageBackend({ storage: hostile, logger, label: 'localStorage' });
    assert.doesNotThrow(() => backend.get('decal.theme'));
    assert.equal(backend.isDegraded, true);
    assert.match(logger.lines[0][1], /SecurityError/);
});

test('a failing write reaches the router as a failure, not as success', async () => {
    const logger = recordingLogger();
    const backend = createWebStorageBackend({ storage: fakeWebStorage({ fail: true }), logger, label: 'localStorage' });
    const router = createStorageRouter({ backends: { local: backend }, logger });
    assert.equal(await router.set('theme', 'light'), false);
    assert.ok(logger.lines.some(([level, message]) => level === 'error' && /NOT stored anywhere/.test(message)));
});

test('corrupt JSON reads as absent, with a warning — never as a raw string', () => {
    const logger = recordingLogger();
    const storage = fakeWebStorage({ initial: { 'decal.theme': '{not json' } });
    const backend = createWebStorageBackend({ storage, logger, label: 'localStorage' });
    assert.equal(backend.get('decal.theme'), undefined);
    assert.ok(logger.lines.some(([level, message]) => level === 'warn' && /not valid JSON/.test(message)));
});

test('a missing key is undefined, not null — null is a value the router would store', () => {
    const backend = createWebStorageBackend({ storage: fakeWebStorage(), label: 'localStorage' });
    assert.equal(backend.get('decal.nothing'), undefined);
});

test('the null backend stores nothing and says so', () => {
    const logger = recordingLogger();
    const backend = createNullBackend({ logger, label: 'idb' });
    backend.set('anything', 1);
    assert.equal(backend.get('anything'), undefined);
    assert.ok(logger.lines.some(([level, message]) => level === 'warn' && /not wired/.test(message)));
});

test('backends are DOM-free: nothing here reads a global', () => {
    // The proof is that this whole file runs under node:test with no browser and no shim.
    assert.equal(typeof globalThis.localStorage, 'undefined');
    const backend = createWebStorageBackend({ storage: fakeWebStorage(), label: 'localStorage' });
    backend.set('decal.k', 1);
    assert.equal(backend.get('decal.k'), 1);
});
