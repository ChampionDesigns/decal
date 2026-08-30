// The store primitive — Gate 4's mechanism, pinned before anything is built on it.
//
// Four of these tests are about a DEFECT, not a feature: pattern A (a store that starts its
// own timer), pattern C (module-scope singletons), pattern E (document CustomEvent buses)
// and pattern F (in-place mutation). The last one is enforced rather than documented, so a
// fold that mutates fails a test instead of rendering a stale screen.
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
        assert.throws(() => store.set(current), /pattern F/);
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

/* ===========================================================================
 * The coupling patterns that must not come back — checked over the tree,
 * not asserted in prose.
 *
 * A NOTE ON LINE NUMBERS, which the pattern-A scan deliberately does not report:
 * `stripComments` preserves the newlines inside line comments but NOT the ones inside
 * block comments, so its line numbering drifts from the file's as soon as a doc block
 * sits above the hit — measured, not assumed: `shot-mirror.js`'s scheduling line is 173
 * in the file and 137 in the stripped text. So pattern A quotes the offending SOURCE
 * TEXT, which cannot be off by thirty-six lines the way a number can.
 * =========================================================================== */

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
        assert.deepEqual(offenders, [], 'a module-scope let is a singleton with no owner (CARRY_FORWARD.md §6 pattern C)');
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
        // Says only what it checks. Timers are pattern A below, on their own scan, because
        // this list said "starts no timers" while checking for one spelling of one of them.
        assert.deepEqual(offenders, [], 'the store layer is DOM-free and network-free');
    });
});

/* --------------------------------------------------------------- pattern A: scheduling
 *
 * This scan exists because the one above it OVERCLAIMED. Its forbidden list named
 * `setInterval(` and stopped there, while `shot-mirror.js` schedules with `setTimeout` —
 * so the guard ran green while its own message asserted the layer "starts no timers",
 * which it had no way to see either way. A guard that claims more than it checks is worse
 * than no guard, because it is the reason nobody looks again.
 *
 * Both halves are repaired here. Every spelling of "schedule something later" is
 * forbidden, and the one real scheduling site is DECLARED verbatim rather than waved
 * through by a pattern: a second one fails, and deleting the first one ALSO fails until
 * this list is edited. An allowlist nobody has to maintain is how coverage dies.
 *
 * The declaration is only honest because the seam it names is exercised — see
 * `test/shot-mirror.test.mjs`, "the deadline is an injected seam": the mirror is built
 * with a `setTimer` of the caller's, the platform clock is never reached, and nothing is
 * left scheduled once the open settles. That is what makes this a bounded deadline rather
 * than the ticker pattern A is about (`estimator-link.js:120-121`, `setInterval` at
 * construction with no lazy start and no stop).
 */
const SCHEDULING_CALLS = [
    'setInterval(', 'setTimeout(', 'setImmediate(',
    'requestAnimationFrame(', 'requestIdleCallback(', 'queueMicrotask(',
];

/**
 * repo-relative file → the exact trimmed source lines permitted to schedule.
 *
 * THE SECOND ENTRY, WAVE 5.4 (D9). `calibration-store.js` polls
 * `GET /api/v1/machine/scaleCalibration` so the wizard's countdown is LIVE:
 * `secondsRemaining` counts down inside the machine and a client that only re-read on a
 * command would show a frozen number. It qualifies for a declaration on the same three
 * grounds `shot-mirror.js` does, and each one is checked by
 * `test/settings-bespoke.test.mjs`:
 *
 *   INJECTED     `setTimer`/`clearTimer` are constructor options; the suite builds the
 *                store with its own pair and the platform clock is never reached.
 *   ONE-SHOT     `setTimer`, never `setInterval`, and the read it schedules re-arms —
 *                so a slow read cannot stack requests behind itself.
 *   BOUNDED      it arms ONLY while the machine reports `zeroing` or `calLatch`
 *                (`isCalibrationInProgress`), and any terminal or idle step, `forget()`
 *                and `stop()` all disarm it. There is no ticker at construction.
 *
 * NOT THE LED PATH. D7's write pattern has NO clock at all —
 * `test/settings-bespoke.test.mjs` greps `led-strip-store.js`, `led-colour.js` and the
 * leaf for every spelling below, and the render suite greps the files the page actually
 * served. A timer there is a block; this is a read poll on a different route.
 */
const DECLARED_SCHEDULERS = new Map([
    ['src/stores/shot-mirror.js', ['setTimer = (fn, ms) => setTimeout(fn, ms),']],
    ['src/stores/calibration-store.js', ['setTimer = (fn, ms) => setTimeout(fn, ms),']],
    /* THE THIRD ENTRY, 23 Aug 2026. `scale-tare-store.js` watches the weight to find out
     * whether a tare actually happened — a 200 does not say, because the firmware refuses
     * a mid-shot tare silently while the MMR write still succeeds. That watch needs a
     * deadline, or a scale that never answers leaves the surface stuck on WORKING. Its
     * cancel is injected beside it and is NOT declared here: clearing is not scheduling,
     * so the scan never sees that line and a declaration for it would be struck off as
     * one that no longer exists — which is the other half of this test. */
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
            'a store that starts its own timer outlives whatever wanted it (CARRY_FORWARD.md §6 pattern A)');

        const expected = [];
        for (const [name, lines] of DECLARED_SCHEDULERS) {
            for (const line of lines) expected.push(`${name} :: ${line}`);
        }
        assert.deepEqual([...found].sort(), expected.sort(),
            'a declared scheduler that no longer exists must be struck off the list, not left standing');
    });

    test('the scan can actually see a setTimeout — the hole that let this through', () => {
        // The guard this replaced was green against exactly this input. If someone trims
        // SCHEDULING_CALLS back to `setInterval(`, this fails before the tree scan can go
        // quietly green again.
        const sample = stripComments('const t = () => setTimeout(fn, ms); // schedules\n', { dropStrings: true });
        assert.ok(SCHEDULING_CALLS.some((call) => sample.includes(call)), 'setTimeout must be in the list');
        assert.ok(!SCHEDULING_CALLS.some((call) => 'clearTimeout(id); clearInterval(id);'.includes(call)),
            'clearing is not scheduling — a guard that fires on teardown gets switched off');
    });
});
