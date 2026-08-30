/**
 * live-gates-fixture — the rendering subject for the connection-and-gates cluster.
 *
 * WHAT IS REAL HERE, and it is nearly everything: `<live-screen>`, `<live-connection>`,
 * `<live-refusal>`, `LiveWiring`, the capability store, the machine-info store, the arm
 * store and both R3 adapters are the shipping modules, wired the way `app-boot.js` wires
 * them. What is faked is exactly two things, and both are transports:
 *
 *   THE HTTP TRANSPORT is a scripted `request()`. That is what lets a suite ask for a
 *   400 `Unsupported profile` — B9's whole subject — without a machine that refuses one.
 *   The BODIES are the contract table's response shapes, not invented ones.
 *
 *   THE FEEDS are plain stores in the shape `feed-store.js` publishes, `{status, value}`,
 *   pushed by the test. The devices FRAMES a suite pushes are captured from
 *   `tools/mock_rea.py`'s real WebSocket half by the node side of this item's suite and
 *   handed in — so the picture on screen is drawn from a frame that came off a socket,
 *   and the transport step it skips is the step `test/live-connection-gates.test.mjs`
 *   proves end to end against the same server.
 *
 * NODE-SAFE SHAPE, as every browser-only file under test/ must be: `node --test test/`
 * imports every .js under this directory.
 */

export let ready;

if (typeof HTMLElement !== 'undefined') {

const { createStore } = await import('../../src/stores/store.js');
const { createCapabilitiesStore } = await import('../../src/stores/capabilities-store.js');
const { createMachineInfoStore } = await import('../../src/stores/machine-info-store.js');
const { createProfileArmStore } = await import('../../src/stores/profile-arm-store.js');
const { createWorkflowStore } = await import('../../src/stores/workflow-store.js');
const { createProfileLibraryStore } = await import('../../src/stores/profile-library-store.js');
const { createShotsStore } = await import('../../src/stores/shots-store.js');
const { createAppSettingsStore } = await import('../../src/stores/app-settings-store.js');
const { createPluginsStore } = await import('../../src/stores/plugins-store.js');
const { createStorageRouter } = await import('../../src/lib/storage-router.js');
const { createMemoryBackend } = await import('../../src/lib/storage-backends.js');
const { LAYERS } = await import('../../src/lib/storage-routes.js');
const { FAVOURITES_KEY } = await import('../../src/lib/profile-rules.js');
const { FEED } = await import('../../src/stores/live-stores.js');
const { FEED_STATUS } = await import('../../src/stores/feed-store.js');
const { readDevicesFrame } = await import('../../src/data/rea-devices.js');
const { readMachineSnapshot } = await import('../../src/data/rea-address.js');
await import('../../src/screens/live-screen.js');

/* ---------------------------------------------------------------------------
 * THE SCRIPTED TRANSPORT. One handler per route id's PATH, set by the test.
 * ------------------------------------------------------------------------- */

const answers = new Map();
const calls = [];

const transport = {
    /* THE ABSOLUTE URL OF A PATH, which `plugins-store.pageUrl()` needs and nothing else
     * here does. A plugin's own page is a NAVIGATION rather than a request — the store
     * hands back a URL and the browser opens it — so a transport without this method
     * throws inside the Live screen's DYE2 handler, and the throw would be invisible
     * because nothing would have rendered the button. The settings fixture learned exactly
     * this on 27 August 2026 and its own note says so.
     *
     * THE BASE CARRIES `/api/v1`, WHICH IS NOT DECORATION. `reaBaseUrl` composes
     * `<scheme>//<host>:8080/api/v1` and the real `transport.url()` appends the
     * transport-relative path to THAT, so an address a person is sent to genuinely contains
     * the prefix. A fixture that dropped it would let a suite assert a URL shape the app
     * never produces — and the one assertion this method exists for is exactly about the
     * shape of the address the DYE2 button navigates to. */
    url: (path) => `http://fixture:8080/api/v1${String(path).startsWith('/') ? path : `/${path}`}`,
    request: async (path, options = {}) => {
        calls.push({ path, method: options.method ?? 'GET', body: options.body ?? null });
        const answer = answers.get(path);
        if (typeof answer === 'function') return answer(options);
        if (answer) return answer;
        // A miss is an ANSWER, and the honest one for this route family: `withDe1`
        // answers 500 when no machine is connected, which is the ordinary state of a
        // machine that is off — not a fault to retry.
        return { ok: false, kind: 'http', status: 500, message: 'no machine', problem: { e: 'no de1' } };
    },
};

/**
 * The feeds the cluster reads, in `feed-store.js`'s published shape.
 *
 * THE SCALE JOINED THEM with the gauge cluster's wiring (parity 7-live-polish): the
 * WEIGHT tile is the one reading that does not come off the machine snapshot, and a
 * fixture holding two of the three feeds would photograph it as an absence on every
 * state — indistinguishable from a scale that is not there, which is the one thing
 * that tile has to be able to say.
 */
const feeds = {
    [FEED.CONNECTION]: createStore({ status: FEED_STATUS.NEVER, value: null }, { label: 'connection' }),
    [FEED.MACHINE]: createStore({ status: FEED_STATUS.NEVER, value: null }, { label: 'machine' }),
    [FEED.SCALE]: createStore({ status: FEED_STATUS.NEVER, value: null }, { label: 'scale' }),
};

const connects = [];

/** The screen this fixture mounted, for the one property below that it stands in for. */
let mounted = null;

const capabilities = createCapabilitiesStore({
    routes: { capabilities: () => transport.request('/machine/capabilities', { method: 'GET' }) },
});
const machineInfo = createMachineInfoStore({ transport });
const arm = createProfileArmStore({ transport });
/* THE RAIL'S OWN DOCUMENT. The screen reads `targets` off this store and writes one back
 * through it. Without it every rail stepper, every preset cell and the keypad's Confirm
 * render disabled — which is precisely the defect the store was built to end, so a
 * fixture that omits it would keep reproducing the bug it is meant to catch. */
const workflow = createWorkflowStore({ transport });

/* THE TWO STORES BEN'S 22 AUG RULING PUT ON THIS SCREEN (parity 7-live-polish).
 *
 * `<live-screen>` now shows profile NAMES in the five favourite slots and draws the
 * LAST STORED SHOT in the chart and the foot band, and `app-boot.js` builds both stores
 * for it. A fixture that omitted them would render the screen exactly as the defect
 * rendered it — five numbered blanks and "No shot yet" on a machine with 321 shots —
 * and every assertion about a live composition would pass against a dead one, which is
 * the same reason the workflow store above is here.
 *
 * THE ROUTER'S LAYERS ARE MEMORY and the favourite slots are SEEDED FROM THE RECORDED
 * KV ROW below, for the same reason the workflow document is: the recorded bytes are
 * what the machine serves, so the fixture and `tools/mock_rea.py` cannot disagree about
 * which three profiles are on the rail. */
const storage = createStorageRouter({
    backends: {
        [LAYERS.kv]: createMemoryBackend(),
        [LAYERS.kvNumpad]: createMemoryBackend(),
        [LAYERS.local]: createMemoryBackend(),
        [LAYERS.session]: createMemoryBackend(),
    },
});
const library = createProfileLibraryStore({ transport, storage, arm });
const shots = createShotsStore({ transport });
/* REAPRIME'S OWN PREFERENCES, for the SAME reason the workflow store above is here: the
 * Live rail reads one field of this document — `stopHotWaterAtWeight` — to say what ends a
 * hot-water pour, and writes it back when the caption is pressed. A fixture without it
 * would render the rail's hot-water caption as an eternal dash and let every assertion
 * about that control pass against a control that could not work, which is exactly the
 * failure mode the workflow store's own note describes. `app-boot.js` builds this store for
 * the same two readers. */
const appSettings = createAppSettingsStore({ transport });

/* THE RECORDED WORKFLOW, SERVED FROM THE SAME BYTES THE MOCK SERVES.
 *
 * A miss on this transport answers 500, which is the honest default for the machine
 * routes — but it would leave the rail dashed in every state this fixture drives, which
 * is indistinguishable from the defect the store exists to end. So the recorded document
 * is the DEFAULT answer here, read from `tools/rea-fixtures/` rather than typed, so the
 * two instruments cannot disagree about what a machine serves. A test that wants a
 * refusal, or a different document, scripts the path itself and wins — `answer()` writes
 * the same map and is applied after this. */
/* The route table's `route`, which is what `buildPath` hands the transport — the
 * `/api/v1` prefix is the transport's own base, not part of the key. */
const WORKFLOW_PATH = '/workflow';
try {
    const recorded = await fetch('/tools/rea-fixtures/api__v1__workflow.json');
    if (recorded.ok) {
        const document_ = await recorded.json();
        answers.set(WORKFLOW_PATH, (options = {}) => (
            (options.method ?? 'GET') === 'GET'
                ? { ok: true, kind: 'json', status: 200, data: document_ }
                /* A write answers the document back, which is what the real route does and
                 * what lets the store publish the machine's own number rather than the
                 * one the rail asked for. */
                : { ok: true, kind: 'json', status: 200, data: { ...document_, ...(options.body ?? {}) } }
        ));
    }
} catch {
    /* No fixture reachable: the miss-answers-500 default stands and the rail dashes,
     * which is the honest rendering of a document nobody could read. */
}

/* AND THE SAME MECHANISM FOR REAPRIME'S PREFERENCES, whose one interesting field is
 * `stopHotWaterAtWeight`. A write answers the merged document back, as `POST /settings`
 * does, so the store's re-read publishes what the server now holds and the rail's caption
 * follows a press rather than a local guess. */
const SETTINGS_PATH = '/settings';
try {
    const response = await fetch('/tools/rea-fixtures/api__v1__settings.json');
    if (response.ok) {
        let held = await response.json();
        answers.set(SETTINGS_PATH, (options = {}) => {
            if ((options.method ?? 'GET') !== 'GET') held = { ...held, ...(options.body ?? {}) };
            return { ok: true, kind: 'json', status: 200, data: held };
        });
    }
} catch {
    /* No fixture reachable: the miss-answers-500 default stands, the store lands on
     * `unavailable`, and the hot-water caption draws its dash — which is the honest
     * rendering of a document nobody could read. */
}

/* THE SAME MECHANISM FOR THE THREE ROUTES THE COMPOSITION READS — the recorded bodies,
 * read from `tools/rea-fixtures/` rather than typed. `recorded()` answers null on a
 * miss so the default 500 stands, which is what a machine that will not answer gives. */
const recorded = async (name) => {
    try {
        const response = await fetch(`/tools/rea-fixtures/${name}`);
        return response.ok ? await response.json() : null;
    } catch { return null; }
};
const served = (data) => ({ ok: true, kind: 'json', status: 200, data });

/* ---- ReaPrime's installed plugins ------------------------------------------
 *
 * THE RECORDED LISTING, because the DYE2 button's whole gate is one field of it: the Live
 * screen offers the handoff only when a manifest with id `dye2.reaplugin` reports
 * `loaded: true`. A typed stand-in would prove the fixture renders rather than that the
 * wiring reads — and the recorded body is where the plugin's four http endpoints, and
 * therefore the absence of a `ui` one, can actually be seen.
 *
 * THE STORE IS REAL AND THE SHELL BUILDS ONE, so this fixture does too: `app-boot.js`
 * constructs it and deliberately does NOT read it, and `live-wiring.js` calls `load()` when
 * the screen mounts. `mount()` below starts that read the same way it starts the others. */
const plugins = createPluginsStore({ transport });
const pluginList = await recorded('api__v1__plugins.json');
if (pluginList) answers.set('/plugins', () => served(pluginList));

/* The listing, at the ONE query form rule 1 sends (`includeHidden=true`). */
const profiles = await recorded('api__v1__profiles~includeHidden=true.json');
if (profiles) answers.set('/profiles', () => served(profiles));

/* The five slots as the machine holds them, seeded into the router's KV layer so the
 * store reads them rather than auto-populating from the listing's first three. */
const favourites = await recorded('api__v1__store__slate__favorite-profiles.json');
if (favourites) await storage.set(FAVOURITES_KEY, favourites);

/* The newest page, and the newest shot's full record — the only two shots calls the
 * shell makes on boot. `getShots` clamps and pages itself; the recorded page is what
 * `order=desc` answers, so `items[0]` is the newest shot whatever limit was asked. */
let newestShotId = null;
const shotPage = await recorded('api__v1__shots~limit=20~offset=0~order=desc.json');
if (shotPage) {
    answers.set('/shots', () => served(shotPage));
    const newest = Array.isArray(shotPage.items) && shotPage.items.length ? shotPage.items[0] : null;
    newestShotId = newest && typeof newest.id === 'string' ? newest.id : null;
    if (newestShotId) {
        const record = await recorded(`api__v1__shots__${newestShotId}.json`);
        if (record) answers.set(`/shots/${newestShotId}`, () => served(record));
    }
}

const boot = {
    live: { feed: (name) => feeds[name] },
    devices: {
        connect: async (deviceId) => { connects.push(deviceId); return { ok: true, result: null, failure: null }; },
    },
    capabilities,
    machineInfo,
    arm,
    workflow,
    library,
    /* CB-21's spelling again — the boot object's field is `shotHistory` everywhere,
     * because Gate D refuses `.shots` in client code and this fixture stands in for
     * `app-boot.js`. */
    shotHistory: shots,
    appSettings,
    /* THE PLUGIN LISTING. One reader on this screen and it is one pixel — whether the DYE2
     * handoff is drawn — which is exactly why `app-boot.js` builds this store and does not
     * read it: the screen that wants the answer asks. */
    plugins,
    storage,
};

/* ---------------------------------------------------------------------------
 * THE TEST'S HANDLE
 * ------------------------------------------------------------------------- */

const api = {
    boot,
    calls,
    connects,

    /** Script one route's answer, by the path the generated table builds. */
    answer(path, value) { answers.set(path, value); },

    /* ---- the plugin listing, and the DYE2 handoff it gates ------------------
     *
     * `live-wiring.js` calls `load()` on mount and the store's in-flight guard makes a
     * second caller free, so this is what a test awaits rather than a second read. */
    async loadPlugins() {
        await plugins.load();
        return plugins.get().plugins.length;
    },

    /**
     * Move ONE manifest's `loaded` flag and re-read, leaving `autoLoad` alone.
     *
     * THE TWO REALLY DO DIFFER, AND THAT IS THE POINT OF THE LEVER. The Plugins page's
     * switch reads `autoLoad` — the persistent answer, so a control does not flicker off
     * while a plugin restarts — and the Live handoff reads `loaded`, because it is a LINK
     * to a page that plugin serves and the question is whether that URL will answer. A
     * fixture that moved both together could not tell the two gates apart, which is
     * exactly the mistake the gate is written against.
     */
    async pluginsLoaded(id, loaded) {
        const listing = (pluginList ?? []).map((entry) => (
            entry.id === id ? { ...entry, loaded } : entry));
        answers.set('/plugins', () => served(listing));
        await plugins.refresh();
        return plugins.get().plugins.find((entry) => entry.id === id)?.loaded ?? null;
    },

    /** One manifest's `autoLoad`, so a test can show the two flags disagreeing. */
    pluginAutoLoad(id) {
        return plugins.get().plugins.find((entry) => entry.id === id)?.autoLoad ?? null;
    },

    /* EVERY METHOD ANSWERS A PLAIN, SMALL VALUE — never a store state and never an
     * element. CDP's `returnByValue` walks whatever it is handed and answers "Object
     * reference chain is too long" on a frozen frame graph or a DOM node, which reads
     * like a test failure and is a serialisation failure. Learned once, the hard way. */

    /** Push a raw `/ws/v1/devices` frame through the REAL reader, as a feed would. */
    pushDevices(rawFrame, status = FEED_STATUS.LIVE) {
        feeds[FEED.CONNECTION].set({ status, value: readDevicesFrame(rawFrame) });
        return true;
    },

    /** Push a feed state directly — for the three "no readable frame" pictures. */
    pushDevicesState(state) { feeds[FEED.CONNECTION].set(state); return true; },

    /**
     * Push a RAW `/ws/v1/machine/snapshot` frame down the real road — through gate 2's
     * own `readMachineSnapshot`, exactly as `live-stores.js` publishes one.
     *
     * WHY THIS EXISTS BESIDE `pushMachineState`. That one publishes a state NAME and no
     * channels, which is all the dimming owner ever needed. Since Ben's 22 Aug ruling
     * the gauge cluster reads the snapshot's channels too, and a state-only frame
     * photographs five dashes on a machine the state calls connected — the defect the
     * wiring exists to end, wearing the fixture's clothes.
     */
    pushMachineFrame(raw, status = FEED_STATUS.LIVE) {
        const snapshot = readMachineSnapshot(raw);
        feeds[FEED.MACHINE].set({ status, value: snapshot });
        if (mounted) mounted.machineState = snapshot.state;
        return true;
    },

    /**
     * The machine AT REST, as this fixture can honestly build one.
     *
     * THE CHANNELS ARE THE RECORDING'S OWN BYTES — `measurements[0].machine` of the
     * stored shot this same fixture serves, which is the frame the machine sent as it
     * was preparing (flow 0, pressure 0.12, the group and steam temperatures it was
     * actually holding). Nothing is edited and nothing is added.
     *
     * THE STATE IS CONSTRUCTED, and that is declared rather than hidden: no recorded
     * frame carries state `idle` — `live-loop-fixture.js` says the same thing in the
     * same words for `live--idle` — so the one field the recording cannot supply is
     * built, and it is the field that decides whether the screen thinks a shot is
     * running. Everything else on the frame came off a machine.
     */
    async pushRestingMachine() {
        const record = await recorded(`api__v1__shots__${newestShotId ?? ''}.json`);
        const first = record && Array.isArray(record.measurements) && record.measurements.length
            ? record.measurements[0].machine : null;
        if (!first) return false;
        return api.pushMachineFrame({ ...first, state: { state: 'idle', substate: 'idle' } });
    },

    /**
     * Push a machine snapshot, as `readMachineSnapshot` publishes one. The dimming owner
     * reads `state` off it and nothing else.
     *
     * IT ALSO SETS `<live-screen>.machineState`, WHICH IS NOW BELT AND BRACES. When this
     * fixture was written nothing in `src/` wrote that property and the gap was reported
     * here rather than papered over; the loop row then claimed it, so `LiveWiring` writes
     * it from this same feed (`live-wiring.js` `hostUpdate`) and overwrites what this line
     * sets with the identical value. It stays because the rail recomposes by mode from the
     * property, and a fixture that leaves it unset would prove the rail through a path the
     * app does not use.
     */
    pushMachineState(state) {
        feeds[FEED.MACHINE].set({ status: FEED_STATUS.LIVE, value: { ok: true, state, substate: 'idle' } });
        if (mounted) mounted.machineState = state;
        return true;
    },

    /**
     * Mark the machine feed dead WITHOUT clearing what it holds — the deletion rule, which
     * is what `feed-store.js` itself does on a socket close (`stale`, latched) and on the
     * source's own `unavailable` verdict: "a source that closes does NOT clear the value".
     * The last reading stays on the feed; only its status says it is not to be believed.
     */
    setMachineFeedStatus(status) {
        feeds[FEED.MACHINE].set({ ...feeds[FEED.MACHINE].get(), status });
        return true;
    },

    /** What the machine feed holds right now, flattened. */
    machineFeed() {
        const state = feeds[FEED.MACHINE].get();
        return { status: state.status, state: state.value ? state.value.state : null };
    },

    /** Read the capability set, then the machine info, exactly as the shell does. */
    async loadGates() {
        await capabilities.load();
        const info = await machineInfo.load();
        capabilities.applyMachineInfo(info ? info.info : null);
        /* AND THE RAIL'S DOCUMENT, because the shell reads it on the same path
         * (`app-boot.js` askWorkflow, beside askCapabilities and askMachineInfo). A
         * fixture that loaded the gates but not the targets would render the rail exactly
         * as the defect rendered it, and every assertion about a live control would pass
         * against a dead one. */
        await workflow.load();
        /* AND REAPRIME'S PREFERENCES, for the same reason: the hot-water stop caption reads
         * `stopHotWaterAtWeight` off this document, so a test that asserted on that control
         * before this landed would be asserting on a dash. */
        await appSettings.load();
        return true;
    },

    /** The rail's values as the store holds them — a plain object, never the store state. */
    targets() { return { ...workflow.targets() }; },

    /**
     * Read the two stores the Live composition runs on, exactly as `mount()` starts
     * them — awaited, for a test (or the screen walk) that needs the favourites and the
     * last shot on screen before it measures.
     */
    async loadComposition() {
        await library.load();
        const state = await shots.readPage({ limit: 1, offset: 0 });
        const newest = state && state.items && state.items.length ? state.items[0] : null;
        if (newest && newest.id) await shots.loadShot(newest.id);
        return true;
    },

    /** The five slots as the bank takes them — names only, never a record. */
    favourites() { return library.favouriteEntries().map((e) => (e ? e.name : null)); },

    /** Write one target the way the rail does, and answer with what the store then holds. */
    async setTarget(key, value) {
        await workflow.setTarget(key, value);
        return { ...workflow.targets() };
    },

    /** Hand the capability store a machine-info body without a transport round trip. */
    applyMachineInfo(body) { capabilities.applyMachineInfo(body); return true; },

    /** Try to arm a profile. The answer is whatever `/machine/profile` was scripted with. */
    async armProfile(profile = { title: 'Test profile', steps: [] }) {
        const state = await arm.arm(profile);
        return state.status;
    },

    /** The arm state, flattened — the refusal is three strings, so it travels as three. */
    armState() {
        const state = arm.get();
        return {
            status: state.status,
            kind: state.refusal ? state.refusal.kind : null,
            error: state.refusal ? state.refusal.error : null,
            message: state.refusal ? state.refusal.message : null,
        };
    },

    /**
     * Mount the screen with the boot attached, as `<app-root>` does it.
     *
     * AND START THE WORKFLOW READ HERE, because that is where the shell starts it:
     * `app-boot.js` calls `askWorkflow()` on the start path beside `askCapabilities()`
     * and `askMachineInfo()`, gated on nothing. Started rather than awaited, for the
     * reason the shell gives — the rail renders its dashes until it lands, which is what
     * it renders when there is nothing to say — and `loadGates()` awaits the same store
     * for a test that needs the numbers before it asserts.
     */
    mount(host = document.getElementById('stage')) {
        const screen = document.createElement('live-screen');
        screen.boot = boot;
        host.append(screen);
        mounted = screen;
        workflow.load().catch(() => {});
        /* AND REAPRIME'S PREFERENCES, where `app-boot.js` starts them: on the start path,
         * gated on nothing and not awaited. */
        appSettings.load().catch(() => {});
        /* AND THE COMPOSITION'S TWO, where `app-boot.js` starts them — beside the
         * workflow read, gated on nothing, started rather than awaited. */
        library.load().catch(() => {});
        /* AND THE PLUGIN LISTING, where `live-wiring.js` starts it — on the screen's own
         * mount rather than on the shell's start path, because the listing reaches exactly
         * one pixel and a boot-time read would be a cost with no reader on most machines. */
        plugins.load().catch(() => {});
        shots.readPage({ limit: 1, offset: 0 })
            .then((state) => {
                const newest = state && state.items && state.items.length ? state.items[0] : null;
                return newest && newest.id ? shots.loadShot(newest.id) : null;
            })
            .catch(() => {});
        return true;
    },
};

globalThis.__live = api;
ready = Promise.resolve(api);

}
