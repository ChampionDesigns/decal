/**
 * A settings-leaf page whose rows print a live machine reading, over one snapshot frame.
 *
 * Real: `<settings-leaf>`, `<ui-settings-row>`, the storage router, the settings store,
 * the leaf model, the limits table and the registry rows. Faked: the machine snapshot
 * feed, so a test can publish the frame its rows read.
 */
export let ready;

if (typeof HTMLElement !== 'undefined') {

const { createStorageRouter } = await import('../../src/lib/storage-router.js');
const { createMemoryBackend } = await import('../../src/lib/storage-backends.js');
const { LAYERS } = await import('../../src/lib/storage-routes.js');
const { createSettingsStore } = await import('../../src/stores/settings-store.js');
const { createSettingsLeafModel } = await import('../../src/stores/settings-leaf-model.js');
const { limitsFor } = await import('../../src/lib/machine-limits.js');
const { ARCHETYPE, SETTINGS_ROWS } = await import('../../src/lib/settings-leaves.js');
await import('../../src/screens/settings-leaf.js');

const storage = createStorageRouter({
    backends: {
        [LAYERS.local]: createMemoryBackend(),
        [LAYERS.session]: createMemoryBackend(),
        [LAYERS.kv]: createMemoryBackend(),
        [LAYERS.kvNumpad]: createMemoryBackend(),
    },
});

const settings = createSettingsStore({
    storage,
    capabilities: {
        capability: () => 'present',
        subscribe: () => () => {},
        machineClass: () => 'bengle',
    },
});

const model = createSettingsLeafModel({ settings, limits: limitsFor('bengle') });

const CELSIUS_FRAME = Object.freeze({ steamTemperature: 150, groupTemperature: 90, pressure: 9 });

let frame = CELSIUS_FRAME;
const feedListeners = new Set();
const feed = {
    subscribe(listener) {
        feedListeners.add(listener);
        listener({ frame });
        return () => feedListeners.delete(listener);
    },
};
const publish = () => {
    for (const listener of [...feedListeners]) {
        try { listener({ frame }); } catch {  }
    }
};

const stubView = (id, heading, live, unit) => Object.freeze({
    row: Object.freeze({ id }),
    id,
    archetype: ARCHETYPE.READING,
    heading,
    caption: '',
    hint: '',
    bounds: Object.freeze({ unit, bounded: false, min: null, max: null, step: null }),
    value: undefined,
    reading: undefined,
    items: [],
    notes: [],
    inert: false,
    pending: false,
    live,
    staged: false,
    surface: 'shown',
});

const STUB_ROWS = Object.freeze([
    stubView('stub-steam-temp', 'Steam temperature', 'steamTemperature', '°F'),
    stubView('stub-pressure', 'Pressure', 'pressure', 'bar'),
]);

const stubModel = {
    subscribe: () => () => {},
    rows: () => STUB_ROWS,
    note: () => null,
    restorableRows: () => [],
    load: () => Promise.resolve(true),
};

const stage = document.getElementById('stage') ?? document.body;

const mountLeaf = (id, leafId, heading, leafModel) => {
    const leaf = document.createElement('settings-leaf');
    leaf.id = id;
    leaf.leafId = leafId;
    leaf.heading = heading;
    leaf.model = leafModel;
    leaf.liveFeed = feed;
    stage.appendChild(leaf);
    return leaf;
};

const leaves = Object.freeze({
    steam: mountLeaf('steam', 'machine-steam', 'Steam', model),
    hotWater: mountLeaf('hot-water', 'machine-hot-water', 'Hot water', model),
    mixed: mountLeaf('mixed', 'machine-steam', 'Mixed units', stubModel),
});

async function settle() {
    for (const leaf of Object.values(leaves)) await leaf.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (const leaf of Object.values(leaves)) await leaf.updateComplete;
}

function readingOf(leafKey, rowId) {
    const leaf = leaves[leafKey];
    const row = leaf?.shadowRoot?.querySelector(`ui-settings-row[data-row="${rowId}"]`);
    if (!row) return null;
    const view = leaf.model.rows(leaf.leafId).find((row2) => row2.id === rowId) ?? null;
    return {
        text: row.readingText,
        reading: row.reading,
        dash: row.dash,
        unit: view?.bounds?.unit ?? null,
    };
}

const UNIT_ROW = SETTINGS_ROWS.find((row) => row.id === 'units-language-temperature-unit');

globalThis.__liveReadingLeaf = {

    async chooseUnit(value) {
        await model.set(UNIT_ROW, value);
        await settle();
        await settle();
        return true;
    },

    async frame(next) {
        frame = next === null ? {} : next;
        publish();
        await settle();
        return true;
    },

    readingOf,
    settle,
};

await settle();
ready = Promise.resolve(true);

}
