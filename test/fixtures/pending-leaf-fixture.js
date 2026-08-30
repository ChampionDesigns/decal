/**
 * pending-leaf-fixture — one settings leaf, held in the window audit F-042 measured.
 *
 * WHY THIS EXISTS AND `settings-shell-fixture.js` COULD NOT BE USED. The pending state has
 * to be a state a test can STAND IN, not a race it has to catch — and in the shell fixture
 * it is neither, for one reason per source:
 *
 *   MACHINE rows cannot go pending twice. `machineLoaded` is set once the document has
 *   answered and never returns to false (settings-leaf-model.js `loadMachine`), so by the
 *   time the shell has booted a machine page every machine row in that model is settled
 *   for the life of the page. That is correct — a document that has answered has answered
 *   — and it means the shell cannot re-enter the window.
 *
 *   ROUTE rows can, but only before their key is read: `pendingFor` asks
 *   `settings.isLoaded(key)`, and `loadedKeys` in `settings-store.js` is add-only. So the
 *   gate has to be in place BEFORE the store's first read of that key, which means before
 *   the leaf is mounted — a fixture, not a lever on a booted one.
 *
 * SO THE GATE IS A BACKEND, and it is the same shape as the one the model suite uses
 * (`settings-leaf-model-commit-band.test.mjs`, `gatedBackend`): reads hang on a promise the
 * test resolves. The value is IN the backend the whole time — this is the exact defect
 * shape, a store that will answer `true` holding a page that is drawing `false`.
 *
 * WHAT IS REAL: `<settings-leaf>`, `<ui-settings-row>`, `<ui-switch>`, the real storage
 * router over the real route table, the real settings store, the real leaf model, the real
 * limits table and the real registry row. What is faked is one thing, and it is a
 * transport: the local layer's backend, gated.
 *
 * THE LEAF IS `display-screen-saver` BECAUSE ITS SWITCH IS ROUTE-SOURCED.
 * `display-screen-saver-enabled` reads `screensaverEnabled`, which `storage-routes.js`
 * puts on `LAYERS.local` — the layer this fixture gates. The registry ships that key's
 * default as `true` (`settings-defaults.js`), and the gated backend holds `false`, so the
 * two disagree: a leaf that painted the fallback while waiting would paint the switch ON,
 * and the answer is OFF. Either way round the pending face must assert NEITHER.
 *
 * NODE-SAFE SHAPE, as every browser-only file under test/ must be: `node --test test/`
 * imports every .js under this directory.
 */

export let ready;

if (typeof HTMLElement !== 'undefined') {

const { createStorageRouter } = await import('../../src/lib/storage-router.js');
const { createMemoryBackend } = await import('../../src/lib/storage-backends.js');
const { LAYERS } = await import('../../src/lib/storage-routes.js');
const { createSettingsStore } = await import('../../src/stores/settings-store.js');
const { createSettingsLeafModel } = await import('../../src/stores/settings-leaf-model.js');
const { limitsFor } = await import('../../src/lib/machine-limits.js');
await import('../../src/screens/settings-leaf.js');

/* ---------------------------------------------------------------------------
 * THE GATE. One backend, reads held until the test opens it.
 *
 * `set` and `remove` are NOT gated: a write is not the thing under test, and gating it
 * would make the settled half of the suite wait on the same promise for no reason. It is
 * also what lets the value be SEEDED below, which is the only way to put it in the right
 * place — see the note on the seed.
 * ------------------------------------------------------------------------- */

const held = new Map();
let open = null;
const gate = new Promise((resolve) => { open = resolve; });

const gatedLocal = {
    async get(key) { await gate; return held.get(key); },
    async set(key, value) { held.set(key, value); return true; },
    async remove(key) { held.delete(key); return true; },
};

const storage = createStorageRouter({
    backends: {
        [LAYERS.local]: gatedLocal,
        [LAYERS.session]: createMemoryBackend(),
        [LAYERS.kv]: createMemoryBackend(),
        [LAYERS.kvNumpad]: createMemoryBackend(),
    },
});

/* THE SEED GOES THROUGH THE ROUTER, NOT INTO THE MAP, AND THAT COST A DEBUG ROUND.
 *
 * A backend is keyed by the PHYSICAL name, which `storage-router.js` derives from the
 * logical one (`resolve(key, params)` — the skin-id prefix). Seeding
 * `held.set('screensaverEnabled', false)` puts the value under a name the router never
 * asks for, so every read fell through to the fallback and the settled half of the suite
 * measured `true` — the shipped default — while believing it had measured the backend.
 * That is the fixture reproducing the very defect it exists to test, which is a good way
 * to ship a green suite that proves nothing.
 *
 * Writing through the router lets the router name the key. It must happen BEFORE the
 * settings store exists, because `settings.set()` would call `loadedKeys.add(key)` and the
 * row would never be pending at all. */
await storage.set('screensaverEnabled', false);

const settings = createSettingsStore({
    storage,
    /* EVERY GATE PRESENT, so no row is hidden for a reason that has nothing to do with
     * this suite. A capability store that has asked nothing hides gated rows, and a hidden
     * row cannot be measured pending or settled. */
    capabilities: { capability: () => 'present', subscribe: () => () => {}, machineClass: () => 'bengle' },
});

/* NO MACHINE PORT AT ALL, deliberately. `loadMachine` treats an absent port as an ANSWER
 * ("not reachable is a state, not a wait") and latches `machineLoaded` immediately, so
 * every machine row on any leaf reads settled and the only pending row in this fixture is
 * the ROUTE-sourced one this suite is about. A half-gated fixture would leave the reader
 * guessing which source a pending face came from. */
const model = createSettingsLeafModel({ settings, limits: limitsFor('bengle') });

const stage = document.getElementById('stage') ?? document.body;
const leaf = document.createElement('settings-leaf');
leaf.id = 'leaf';
leaf.leafId = 'display-screen-saver';
leaf.heading = 'Screen saver';
leaf.model = model;
stage.appendChild(leaf);

/** Let lit finish, then let the model's own microtasks land. */
async function settle() {
    await leaf.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
    await leaf.updateComplete;
}

globalThis.__pendingLeaf = {
    /** Open the gate and wait for the answer to reach the glass. */
    async release() {
        open();
        /* The leaf kicked `model.load()` off itself on first render; awaiting the model's
         * own promise here would be a second read. Two turns is enough for the store's
         * read to resolve and the model's `bump()` to repaint. */
        await settle();
        await settle();
        return true;
    },

    /** What the model says, so a case can pin the flag and the face together. */
    rows() {
        return model.rows('display-screen-saver').map((view) => ({
            id: view.id, archetype: view.archetype,
            pending: view.pending, inert: view.inert, checked: view.checked,
        }));
    },

    settle,
};

await settle();
ready = Promise.resolve(true);

}
