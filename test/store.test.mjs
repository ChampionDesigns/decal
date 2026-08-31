
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createStore, StoreController, watchAll, UNCHANGED } from '../src/stores/store.js';
import { stripComments } from '../scripts/lib/source-scan.js';

const REPO = fileURLToPath(new URL('..', import.meta.url));

describe('replay: a late subscriber paints now, not at the next frame', () => {
    test('subscribe delivers the current state synchronously', () => {
        const store = createStore({ n: 1 });
        store.set({ n: 2 });
        const seen = [];
        store.subscribe((state) => seen.push(state));
        assert.deepEqual(seen, [{ n: 2 }], 'exactly one delivery, the current state');
    });

    test('the delivery happens BEFORE subscribe returns', () => {
        const store = createStore('boot');
        let deliveredDuringSubscribe = false;
        let returned = false;
        store.subscribe(() => { deliveredDuringSubscribe = !returned; });
        returned = true;
        assert.equal(deliveredDuringSubscribe, true);
    });

    test('unsubscribe is idempotent — a double release does not remove a later subscriber', () => {
        const store = createStore(0);
        const off = store.subscribe(() => {});
        store.subscribe(() => {});
        off();
        off();
        assert.equal(store.size(), 1);
    });
});

describe('pattern F: in-place mutation is made loud', () => {
    test('set() handed the same object throws, and names the pattern', () => {
        const store = createStore({ events: [] });
        const current = store.get();
        assert.throws(() => store.set(current), /RETURN NEW STATE/);
    });

    test('state objects are frozen, so a fold that mutates throws where it mutates', () => {
        const store = createStore({ fold: { count: 0 } });
        assert.throws(() => { store.get().fold = null; }, TypeError);
    });

    test('the freeze is SHALLOW — a container may document its own append-only array', () => {
        const store = createStore({ samples: [] });
        store.get().samples.push(1);
        assert.equal(store.get().samples.length, 1);
    });

    test('a fold with nothing to change returns UNCHANGED and publishes nothing', () => {
        const store = createStore({ n: 1 });
        let deliveries = 0;
        store.subscribe(() => { deliveries += 1; });
        store.update(() => UNCHANGED);
        assert.equal(deliveries, 1, 'the replay only');
        assert.equal(store.revision(), 0);
    });

    test('an equal PRIMITIVE is a genuine no-op, not a throw', () => {
        const store = createStore(7);
        assert.equal(store.set(7), 7);
        assert.equal(store.revision(), 0);
    });

    test('returning new state publishes, and revision counts it', () => {
        const store = createStore({ n: 1 });
        const seen = [];
        store.subscribe((state) => seen.push(state.n));
        store.update((state) => ({ ...state, n: state.n + 1 }));
        assert.deepEqual(seen, [1, 2]);
        assert.equal(store.revision(), 1);
    });
});

describe('delivery is isolated', () => {
    test('a subscriber that throws does not stop the others, and is reported', () => {
        const warned = [];
        const store = createStore(0, { logger: { warn: (m) => warned.push(m) } });
        store.subscribe(() => { throw new Error('boom'); });
        const seen = [];
        store.subscribe((n) => seen.push(n));
        store.set(1);
        assert.deepEqual(seen, [0, 1]);
        assert.equal(warned.length, 2, 'the throw on replay and the throw on the change');
        assert.match(warned[0], /subscriber threw/);
    });

    test('a subscriber may unsubscribe during delivery without disturbing the one in flight', () => {
        const store = createStore(0);
        const seen = [];
        const off = store.subscribe(() => { off(); });
        store.subscribe((n) => seen.push(n));
        store.set(1);
        assert.deepEqual(seen, [0, 1]);
    });
});

describe('reset and destroy', () => {
    test('reset publishes the initial state again', () => {
        const store = createStore({ n: 0 });
        store.set({ n: 5 });
        const seen = [];
        store.subscribe((s) => seen.push(s.n));
        store.reset();
        assert.deepEqual(seen, [5, 0]);
    });

    test('destroy drops every subscriber', () => {
        const store = createStore(0);
        store.subscribe(() => {});
        store.destroy();
        assert.equal(store.size(), 0);
    });
});

describe('StoreController: the Lit seam, without importing Lit', () => {
    class FakeHost {
        constructor() { this.controllers = []; this.updates = 0; }
        addController(c) { this.controllers.push(c); }
        requestUpdate() { this.updates += 1; }
    }

    test('it subscribes on connect and requests an update per change', () => {
        const store = createStore({ n: 0 });
        const host = new FakeHost();
        const controller = new StoreController(host, store);
        assert.equal(host.controllers.length, 1, 'registered with the host');
        controller.hostConnected();
        assert.equal(host.updates, 1, 'the replay is an update');
        store.set({ n: 1 });
        assert.equal(host.updates, 2);
        assert.deepEqual(controller.state, { n: 1 });
    });

    test('it unsubscribes on disconnect, so a detached component costs the source nothing', () => {
        const store = createStore(0);
        const host = new FakeHost();
        const controller = new StoreController(host, store);
        controller.hostConnected();
        assert.equal(store.size(), 1);
        controller.hostDisconnected();
        assert.equal(store.size(), 0);
        store.set(1);
        assert.equal(host.updates, 1, 'no update after disconnect');
    });

    test('connecting twice does not subscribe twice', () => {
        const store = createStore(0);
        const host = new FakeHost();
        const controller = new StoreController(host, store);
        controller.hostConnected();
        controller.hostConnected();
        assert.equal(store.size(), 1);
    });

    test('it refuses to be built without a store', () => {
        assert.throws(() => new StoreController(new FakeHost(), null), /a store is required/);
    });
});

describe('watchAll', () => {
    test('fires once immediately with every current state, then on any change', () => {
        const a = createStore(1);
        const b = createStore('x');
        const seen = [];
        const off = watchAll([a, b], (av, bv) => seen.push([av, bv]));
        assert.deepEqual(seen, [[1, 'x']], 'one call, not one per store');
        b.set('y');
        assert.deepEqual(seen, [[1, 'x'], [1, 'y']]);
        off();
        a.set(2);
        assert.equal(seen.length, 2);
    });
});

function jsFilesUnder(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) out.push(...jsFilesUnder(path));
        else if (entry.endsWith('.js')) out.push(path);
    }
    return out;
}

describe('pattern C: no module-scope mutable state anywhere in src/', () => {
    test('not one top-level `let` or `var`', () => {
        const offenders = [];
        for (const file of jsFilesUnder(join(REPO, 'src'))) {
            const code = stripComments(readFileSync(file, 'utf8'), { dropStrings: true });
            code.split('\n').forEach((line, i) => {
                if (/^(let|var)\s/.test(line)) offenders.push(`${file.slice(REPO.length)}:${i + 1}`);
            });
        }
        assert.deepEqual(offenders, [], 'a module-scope let is a singleton with no owner pattern C)');
    });
});

describe('pattern E: no document-level CustomEvent buses', () => {
    test('nothing in src/stores dispatches or listens on document', () => {
        const offenders = [];
        for (const file of jsFilesUnder(join(REPO, 'src', 'stores'))) {
            const code = stripComments(readFileSync(file, 'utf8'), { dropStrings: true });
            if (/document\s*\.\s*(addEventListener|dispatchEvent|querySelector)/.test(code)
                || /new\s+CustomEvent/.test(code)) {
                offenders.push(file.slice(REPO.length));
            }
        }
        assert.deepEqual(offenders, [], 'a document bus does not cross a shadow boundary (pattern E)');
    });

    test('and nothing in src/stores touches the DOM or the network at all', () => {
        const offenders = [];
        for (const file of jsFilesUnder(join(REPO, 'src', 'stores'))) {
            const code = stripComments(readFileSync(file, 'utf8'), { dropStrings: true });
            for (const forbidden of ['window.', 'document.', 'localStorage', 'fetch(']) {
                if (code.includes(forbidden)) offenders.push(`${file.slice(REPO.length)}: ${forbidden}`);
            }
        }
        assert.deepEqual(offenders, [], 'the store layer is DOM-free and network-free');
    });
});

const SCHEDULING_CALLS = [
    'setInterval(', 'setTimeout(', 'setImmediate(',
    'requestAnimationFrame(', 'requestIdleCallback(', 'queueMicrotask(',
];

const DECLARED_SCHEDULERS = new Map([
    ['src/stores/shot-mirror.js', ['setTimer = (fn, ms) => setTimeout(fn, ms),']],
    ['src/stores/calibration-store.js', ['setTimer = (fn, ms) => setTimeout(fn, ms),']],
    ['src/stores/scale-tare-store.js', ['setTimer = (fn, ms) => setTimeout(fn, ms),']],
]);

describe('pattern A: the store layer starts nothing on its own clock', () => {
    test('every scheduling call under src/stores is absent, or declared', () => {
        const offenders = [];
        const found = new Set();
        for (const file of jsFilesUnder(join(REPO, 'src', 'stores'))) {
            const name = file.slice(REPO.length);
            const declared = DECLARED_SCHEDULERS.get(name) ?? [];
            const code = stripComments(readFileSync(file, 'utf8'), { dropStrings: true });
            for (const raw of code.split('\n')) {
                const line = raw.trim();
                if (!SCHEDULING_CALLS.some((call) => line.includes(call))) continue;
                if (declared.includes(line)) found.add(`${name} :: ${line}`);
                else offenders.push(`${name}: ${line}`);
            }
        }
        assert.deepEqual(offenders, [],
            'a store that starts its own timer outlives whatever wanted it pattern A)');

        const expected = [];
        for (const [name, lines] of DECLARED_SCHEDULERS) {
            for (const line of lines) expected.push(`${name} :: ${line}`);
        }
        assert.deepEqual([...found].sort(), expected.sort(),
            'a declared scheduler that no longer exists must be struck off the list, not left standing');
    });

    test('the scan can actually see a setTimeout — the hole that let this through', () => {
        const sample = stripComments('const t = () => setTimeout(fn, ms); // schedules\n', { dropStrings: true });
        assert.ok(SCHEDULING_CALLS.some((call) => sample.includes(call)), 'setTimeout must be in the list');
        assert.ok(!SCHEDULING_CALLS.some((call) => 'clearTimeout(id); clearInterval(id);'.includes(call)),
            'clearing is not scheduling — a guard that fires on teardown gets switched off');
    });
});
