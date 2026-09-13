/**
 * settings-shell-fixture — the Settings screen, mounted and driven, for the contract check.
 *
 * the skeleton-and-navigation cluster.
 *
 * WHY THIS ONE IS SO MUCH SMALLER THAN `selector-loop-fixture`, and it is not an
 * omission: the Settings SKELETON has no data layer. It imports nothing from `src/data/`
 * or `src/stores/`, opens no socket, makes no request, and reads no storage key — every
 * one of those has its own row (`b7-storage-routing` resolves reads and
 * writes through `src/lib/storage-routes.js`; the leaves' rows own their endpoints). So
 * there is no transport to wrap and no boot to build: the fixture creates the element,
 * hands it attributes, and lets Lit render.
 *
 * IT DRIVES WHAT THE RENDER SUITE DRIVES. `test/render/settings-skeleton.render.test.mjs`
 * mounts `<settings-screen>` into a `#stage` and moves it with the same four levers this
 * exposes — the selected category, the selected leaf, the search text, and the stage's
 * inline size (which is the ONLY input the body's container query has). A capture that
 * was posed by some other means would be a picture of a state no test asserts.
 *
 * THE MOCK IS INDIFFERENT AND THE STATE ROWS SAY SO. The battery starts a mock per state
 * because Live and the selector need one; this screen would render identically against a
 * dead port. `park` is named because the Live states already start it, which keeps the
 * walk at two mock processes rather than three.
 *
 * NODE-SAFE SHAPE, as every browser-only file under test/ must be: `node --test test/`
 * imports every .js under this directory.
 */

export let ready;

if (typeof HTMLElement !== 'undefined') {

await import('../../src/screens/settings-screen.js');

/* ---------------------------------------------------------------------------
 * THE LEAVES' HALF (the one-primitive cluster).
 *
 * The skeleton needed no data layer; the leaves are the thing that connects one. So the
 * fixture now BUILDS THE MODEL — not a boot, and not a transport: a memory-backed
 * storage router, the real settings store over it, the real capability store (which has
 * asked nothing, so every gate reads UNKNOWN and every gated row is hidden
 * fail-closed, and the honest picture against a mock that answers 503 by design), the
 * real limits table through the R2 door, and a SCRIPTED machine document so the machine
 * rows have values to draw.
 *
 * ARMED BEFORE IT IS MEASURED (the 5.2 carry-forward): `mount()` awaits the model's load
 * for the leaf it is about to show, so a capture is never of a leaf mid-read.
 * ------------------------------------------------------------------------- */
const [
    { createStorageRouter },
    { createMemoryBackend },
    { LAYERS },
    { createSettingsStore },
    { createSettingsLeafModel },
    { createCapabilitiesStore, SERVED_CAPABILITIES },
    { createMachineInfoStore },
    { createLedStripStore },
    { createCalibrationStore },
    { createSkinsStore },
    { createMachineFieldsPort, presenceDoorFor, cupWarmerDoorFor, machineInfoDoorFor },
    { createThemeController },
    { reaSuccess, reaFailure },
    /* THE EIGHT STORES THE 24 AUG 2026 LEAVES READ. Same shape as the four above them:
     * imported here so the fixture builds the REAL store over its own fake server. */
    { createPresenceStore },
    { createPluginsStore },
    { createDecentAccountStore },
    { createDecentSupportStore },
    { createFeedbackStore },
    { createScaleConnectStore },
    { createMachineStateStore },
    { createAppSettingsStore },
    { createCupWarmerStore },
    { createFirmwareStore },
    { createAppInfoStore },
    { readUpdateFrame },
    { createReaRoutes },
    { createDe1SettingsClient },
    { readScaleSnapshot },
    { FEED_STATUS },
] = await Promise.all([
    import('../../src/lib/storage-router.js'),
    import('../../src/lib/storage-backends.js'),
    import('../../src/lib/storage-routes.js'),
    import('../../src/stores/settings-store.js'),
    import('../../src/stores/settings-leaf-model.js'),
    import('../../src/stores/capabilities-store.js'),
    import('../../src/stores/machine-info-store.js'),
    import('../../src/stores/led-strip-store.js'),
    import('../../src/stores/calibration-store.js'),
    import('../../src/stores/skins-store.js'),
    import('../../src/stores/machine-fields-port.js'),
    import('../../src/lib/theme.js'),
    import('../../src/data/rea-errors.js'),
    import('../../src/stores/presence-store.js'),
    import('../../src/stores/plugins-store.js'),
    import('../../src/stores/decent-account-store.js'),
    import('../../src/stores/decent-support-store.js'),
    import('../../src/stores/feedback-store.js'),
    import('../../src/stores/scale-connect-store.js'),
    import('../../src/stores/machine-state-store.js'),
    import('../../src/stores/app-settings-store.js'),
    import('../../src/stores/cup-warmer.js'),
    import('../../src/stores/firmware-store.js'),
    import('../../src/stores/app-info-store.js'),
    import('../../src/stores/feed-readers.js'),
    import('../../src/data/rea-routes.js'),
    import('../../src/data/rea-de1-settings.js'),
    import('../../src/data/rea-address.js'),
    import('../../src/stores/feed-store.js'),
]);

/** What the machine says its settings are. A recording, not a guess: the nine keys
 *  `GET /api/v1/machine/settings` returns, at values inside the declared ranges. */
const MACHINE_SETTINGS = {
    fan: 30, usb: true, flushTemp: 90, flushTimeout: 5, flushFlow: 6,
    hotWaterFlow: 8, steamFlow: 1.2, tankTemp: 20, steamPurgeMode: 0,
};

/** `GET /machine/settings/advanced`'s six — the SECOND DE1 document, and the door that
 *  had a client and no caller. */
const MACHINE_ADVANCED = {
    heaterPh1Flow: 4, heaterPh2Flow: 6, heaterIdleTemp: 20, heaterPh2Timeout: 10,
    heaterVoltage: 230, refillKitSetting: 2,
};

/**
 * `GET /workflow`'s flat view — the THIRD document a settings row reads, scripted like the
 * two above and for the same reason.
 *
 * IT WAS DELIBERATELY ABSENT AND THE REASON EXPIRED. The paragraph at the port below used
 * to say the workflow door "stays out: the Live rail's own suite owns that document, and a
 * second workflow store here would be two answers to one question in one page." That was
 * true while the only rows behind it were the steam and hot-water TARGETS, which this suite
 * renders as absent on purpose. Four more rows moved onto it — steam flow
 * and all three flush values — because the Live rail was reading them off the workflow while
 * the settings page read them off `/machine/settings`, one setting through two doors. With
 * no door here those four rows would render their fallbacks and this suite would be
 * measuring the fallbacks, which is exactly the failure the `presence`, `cupWarmer` and
 * `machineInfo` doors were added to avoid on 26 August.
 *
 * SCRIPTED, NOT A STORE. `settings` and `advanced` are scripted here too; a real workflow
 * store over the fixture transport is the Live suite's business and would be the second
 * answer that paragraph warned about. The flat names are the door's own — see
 * `WORKFLOW_FIELD_PATHS` — so nothing here restates a nested path.
 */
const MACHINE_WORKFLOW = {
    steamTargetTemperature: 160, steamFlow: 1.2, steamDuration: 45,
    hotWaterTargetTemperature: 90, hotWaterDuration: 30, hotWaterVolume: 100,
    flushTemp: 90, flushFlow: 6, flushTimeout: 5,
};

let capabilities = null;
let bespoke = null;
let settingsStore = null;
/* THE FIXTURE'S TRANSPORT, HELD SO ONE STORE CAN BE REBUILT OVER IT.
 *
 * `supportToken()` is the only lever that rebuilds a store, and it has to: the account
 * proxy's bearer is fixed at construction in the app too — `bootFromWindow` reads
 * `window.__REA_PROXY_TOKEN__` once — so taking it away means a NEW store, exactly as
 * re-serving the page from a different origin would. A lever that mutated a live store
 * would be modelling something that cannot happen. */
let fixtureTransport = null;
let fixtureStorage = null;
let theme = null;
let themeRoot = null;

/* ---- the machine snapshot feed, faked at the shape the leaf reads ----------
 *
 * WHAT THE LEAF READS OFF A FEED IS `state.value.state` — the address layer's reading of
 * one `/ws/v1/machine/snapshot` frame (`readMachineSnapshot`), which is a `{ok, state,
 * substate, …ten channels}` object. Not one of those channels is drawn on a maintenance
 * page, so what is modelled here is the state NAME and the `ok` flag beside it, and
 * nothing else is invented: a fixture frame carrying ten fabricated readings would be a
 * machine nobody has, on a page that never shows one.
 *
 * `null` WHEN THE MACHINE HAS SAID NOTHING, which is what a feed with no frame answers and
 * is a different thing from a machine reporting `idle`. */
const machineFeedListeners = new Set();
const machineFeedState = () => (SERVER.machineFrame === null
    ? null
    : { value: { ok: true, state: SERVER.machineFrame } });
const publishMachineFeed = () => {
    for (const listener of [...machineFeedListeners]) {
        try { listener(machineFeedState()); } catch { /* a subscriber's own problem */ }
    }
};

/* ---- the app-update feed, through the REAL reader -------------------------
 *
 * WHAT ARRIVES ON `/ws/v1/update` IS A RAW `AppUpdateState.toJson`, and what the leaf
 * reads is `readUpdateFrame`'s output — a record in which every absent field is a
 * no-reading OBJECT rather than a null. That distinction is the whole reason this fixture
 * pushes RAW frames through the real reader instead of handing the leaf a hand-shaped
 * record: a fake that answered `latestVersion: null` would let a leaf pass that tests
 * `latestVersion` for truthiness, and then fail in the app, where the value is an object.
 *
 * `null` WHEN NOTHING HAS BEEN PUSHED, which is what a feed with no frame answers and is
 * what a tablet whose update socket has said nothing looks like. */
const updateFeedListeners = new Set();
const updateFeedState = () => (SERVER.updateFrame === null
    ? null
    : { value: readUpdateFrame(SERVER.updateFrame) });
const publishUpdateFeed = () => {
    for (const listener of [...updateFeedListeners]) {
        try { listener(updateFeedState()); } catch { /* a subscriber's own problem */ }
    }
};

const displayFeedListeners = new Set();
const displayFeedState = () => (SERVER.displayFrame ? { value: { ...SERVER.displayFrame } } : null);
const publishDisplayFeed = () => {
    const state = displayFeedState();
    for (const listener of displayFeedListeners) listener(state);
};

/* ---- the scale feed, through the REAL reader ------------------------------
 *
 * THE CALIBRATION WALK IS THE ONLY SETTINGS SURFACE THAT DRAWS A LIVE NUMBER, and until
 * this fixture had no scale at all — so `_scaleWeight` was null in every
 * run and the walk's reading rendered the absence dash whatever the case did. The check step's
 * "What the scale reads" line was, in this suite, untestable; an earlier run's point 103 put
 * the same line on three more steps, which made an unexercised path three times wider.
 *
 * A RAW FRAME THROUGH THE REAL READER, exactly as the update feed above and for the same
 * argument. `readScaleSnapshot` applies the absence semantics — a channel with no reading
 * is an ABSENCE object, not a null — and a hand-shaped `{weight: 0.4}` would let the leaf
 * pass here while failing in the app, where the value is not a bare number.
 *
 * AND IT CARRIES A STATUS, because staleness is half of what the leaf now tests: a held
 * weight whose socket has gone is not a current reading, and `scaleStale()` below is how a
 * case drives that. `frame` IS DELIBERATELY NOT SET on this state: the leaf used to read
 * it and must not again, so the fixture gives it nothing to read. */
const scaleFeedListeners = new Set();
const scaleFeedState = () => (SERVER.scaleFrame === null
    ? null
    : {
        status: SERVER.scaleStatus
            ?? (SERVER.scaleStale ? FEED_STATUS.STALE : FEED_STATUS.LIVE),
        receivedAt: 1,
        value: readScaleSnapshot(SERVER.scaleFrame),
    });
const publishScaleFeed = () => {
    for (const listener of [...scaleFeedListeners]) {
        try { listener(scaleFeedState()); } catch { /* a subscriber's own problem */ }
    }
};

const refusable = (backend) => Object.freeze({
    ...backend,
    async get(key) {
        if (SERVER.readRefuse) throw new Error('this tablet could not be read');
        return backend.get(key);
    },
    async set(key, value) {
        if (SERVER.rememberRefuse) throw new Error('this tablet refused the write');
        await heldWrite();
        return backend.set(key, value);
    },
    async remove(key) {
        if (SERVER.rememberRefuse) throw new Error('this tablet refused the delete');
        await heldWrite();
        return backend.remove(key);
    },
});
const heldWrites = [];
const heldWrite = () => (SERVER.rememberHold
    ? new Promise((resolve) => { heldWrites.push(resolve); })
    : Promise.resolve());

function buildModel() {
    const imageStorage = createMemoryBackend();
    const storage = createStorageRouter({
        backends: {
            [LAYERS.local]: { ...imageStorage, set: async (...args) => {
                if (SERVER.localWriteRefuse) throw new Error('The local store refused the write');
                return imageStorage.set(...args);
            } },
            [LAYERS.session]: createMemoryBackend(),
            [LAYERS.kv]: refusable(createMemoryBackend()),
            [LAYERS.kvNumpad]: createMemoryBackend(),
        },
    });
    /* NEVER LOADED, WHICH IS THE POINT. The store is real and its `entries` stay null,
     * so every gate answers UNKNOWN and every gated row is hidden — the same verdict the
     * mock produces by answering /machine/capabilities 503 by design. The route stub
     * exists because the store refuses to be built without one, not because anything
     * calls it. */
    capabilities = createCapabilitiesStore({
        routes: {
            capabilities: async () => (SERVER.capabilitiesFail
                ? fail(503, { error: 'no recording' })
                : ok({ capabilities: [...SERVER.capabilities] })),
        },
    });
    const settings = createSettingsStore({ storage, capabilities });
    settingsStore = settings;
    fixtureStorage = storage;

    /* THE DE1 SETTINGS DOOR, scripted. The OTHER door is real: `flowMultiplier` goes
     * through the calibration store over the fixture transport, which is what makes
     * the rule's two-door split a thing this fixture exercises rather than describes. */
    const settingsPort = {
        read: async () => ({ ...MACHINE_SETTINGS }),
        /* A REFUSABLE WRITE. `SERVER.settingsRefuse` makes this door answer false, which is
         * how `commit()` reaches `WRITE_FAILED` — and a refused save is the one case where
         * Save must NOT leave the screen, so a fixture that always says yes cannot express
         * the difference between the two outcomes. */
        write: async (patch) => {
            if (SERVER.settingsRefuse) return false;
            Object.assign(MACHINE_SETTINGS, patch);
            return true;
        },
    };

    const transport = createFixtureTransport();
    fixtureTransport = transport;
    /* THE TABLE, RE-READ. `machineLimits()` carries no steam row while the machine class
     * is unknown, and the class comes from the served capability array — which this
     * fixture's `capabilities()` lever changes at will. A value captured here would pin
     * the leaf model to the empty-class table for the life of the fixture, so a suite
     * that serves a capability and then asks for the steam envelope would measure the
     * capture rather than the store. Same shape the app passes (`settings-model.js`). */
    const limitsNow = () => capabilities.machineLimits().value;
    const limits = limitsNow();
    const led = createLedStripStore({ transport });
    const calibration = createCalibrationStore({ transport, pollMs: 20 });
    const skins = createSkinsStore({ transport });
    const machineInfo = createMachineInfoStore({ transport });
    /* THE EIGHT THAT CAME WITH THE 24 AUG 2026 SETTINGS PASS. Real stores over the same
     * fixture transport, exactly as the four above — a fixture that faked them would
     * prove the fixture renders rather than that the leaves read. */
    const presence = createPresenceStore({ transport });
    const plugins = createPluginsStore({ transport });
    const account = createDecentAccountStore({ transport });
    /* THE MESSAGE BOX'S STORE, WITH A BEARER, because a fixture without one could only
     * ever exercise the "this page was not served by ReaPrime" branch. The app reads the
     * token off `window.__REA_PROXY_TOKEN__` in `bootFromWindow` and parks it on
     * `boot.proxyToken`; here it is a scripted value the fixture can also take AWAY, so
     * both sides of `hasToken` are reachable. */
    const support = createDecentSupportStore({ transport, token: SERVER.proxyToken });
    const feedback = createFeedbackStore({ transport });
    const scaleConnect = createScaleConnectStore({ transport });
    const machineState = createMachineStateStore({ transport });
    const app = createAppSettingsStore({ transport });
    /* THE DE1 CLIENT, for the reset leaf alone. The two DE1 documents themselves are
     * still scripted below — this fixture has always answered them by hand — so what
     * this adds is the third route that CHANGES them, and a real invalidation behind it. */
    const de1Settings = createDe1SettingsClient(transport);
    /* THE FIRMWARE STORE, real over the same fixture transport. It was absent, so
     * `deps.firmware` was undefined and the update leaf drew its empty state whatever the
     * server said — which made the leaf's actual behaviour untestable. */
    const firmware = createFirmwareStore({ transport });
    /* THE APP-INFO STORE, real over the same fixture transport. Same rule as the twelve
     * above it: a fake store would prove the fixture renders rather than that the leaf
     * reads, and the one thing worth proving here is that an ABSENT field draws a dash. */
    const appInfo = createAppInfoStore({ transport });
    const cupWarmer = createCupWarmerStore({
        routes: createReaRoutes(transport),
        readCapabilities: () => capabilities.entries(),
        readSchedules: () => presence.get().schedules,
    });

    /* THE THEME CONTROLLER, on a root of its own.
     *
     * In the app <app-root> builds this over `document.documentElement` and hands it to
     * the screen (app-root.js, beside `boot`). Here it gets a DETACHED element: a fixture
     * that stamped `data-theme` on the real documentElement would repaint the whole
     * harness page — including every other suite's assertions — the first time a test
     * pressed Light. The storage is the same memory-backed router the rest of this
     * fixture uses, so the write path is real; only the element being stamped is not the
     * page's.
     *
     * NO `media`, so the panel's preference is "not asked" and `resolveTheme` falls to
     * the stamp; NO `followSystem()`, because nothing here has a media query to follow. */
    themeRoot = document.createElement('div');
    themeRoot.setAttribute('data-theme', 'dark');
    theme = createThemeController({ root: themeRoot, storage });

    bespoke = {
        settings,
        machineInfo,
        led,
        calibration,
        skins,
        presence,
        plugins,
        account,
        support,
        feedback,
        scaleConnect,
        machineState,
        app,
        cupWarmer,
        de1Settings,
        firmware,
        appInfo,
        /* THE APP-UPDATE BLOCK — the same shape `settings-model.js` hands the leaf: a live
         * FEED plus the two commands that ride its socket. The commands are recorded
         * rather than executed, because what a test needs to prove is that the button
         * reaches the channel — `live-stores.js` owns what the channel does with it, and a
         * second implementation of that here would be a fixture testing itself. */
        appUpdate: {
            feed: {
                get: () => updateFeedState(),
                subscribe: (listener) => {
                    updateFeedListeners.add(listener);
                    try {
                        listener(updateFeedState());
                    } catch { /* a subscriber that throws on replay is the subscriber's problem */ }
                    return () => updateFeedListeners.delete(listener);
                },
            },
            /* AND THE ANSWER IS THE CHANNEL'S OWN SHAPE, `{ok}` or `{ok, reason}` — added
             * for audit F-035. `rea-sockets.js`'s `send()` answers
             * `{ok: false, reason: 'socket is not open'}` when the socket is down and
             * `live-stores.checkAppUpdate` answers `{ok: false, reason: 'the update feed is
             * not attached'}` when `attachAll()` has not run; a fixture that only ever
             * answered `{ok: true}` could not exercise the leaf's handling of either, which
             * is why the discarded refusal survived every suite. */
            check: () => {
                SERVER.updateCommands.push('check');
                return SERVER.updateRefusal === null
                    ? { ok: true }
                    : { ok: false, reason: SERVER.updateRefusal };
            },
            install: () => {
                SERVER.updateCommands.push('install');
                return SERVER.updateRefusal === null
                    ? { ok: true }
                    : { ok: false, reason: SERVER.updateRefusal };
            },
        },
        limits,
        /* THE PANEL — the tablet's own display, which is neither the machine nor this skin.
         *
         * A SHAPE, NOT A SOCKET. `settings-model.js` hands the leaf `{setBrightness, feed}`
         * over the live layer, and this fixture has no live layer at all — so the two halves
         * are modelled here: what was SENT (so a case can assert the panel was commanded)
         * and what is SERVED (so a case can assert the slider reads the panel rather than
         * the stored preference). `displayFrame(...)` below arms the second half. */
        display: {
            setBrightness: (value) => { SERVER.brightnessSent.push(value); return { ok: true }; },
            feed: {
                get: () => displayFeedState(),
                subscribe: (listener) => {
                    displayFeedListeners.add(listener);
                    listener(displayFeedState());
                    return () => displayFeedListeners.delete(listener);
                },
            },
        },
        /* THE MACHINE'S OWN STATE, for the two maintenance pages.
         *
         * A REAL SUBSCRIBE, WHICH THE DISPLAY FEED ABOVE DOES NOT NEED AND THIS ONE DOES.
         * The brightness slider READS its feed during render, so a driver that changed the
         * served frame and called `requestUpdate` was enough. The maintenance pages do not
         * read during render: the leaf subscribes once and keeps the state STRING, because
         * the snapshot feed publishes at ~10 Hz and a page that re-rendered on every frame
         * would rebuild a four-step checklist thirty times a second. So the only path from
         * this fixture to that page is a delivered notification, and a `subscribe` that
         * returned a no-op would prove nothing at all.
         *
         * AND IT REPLAYS ON SUBSCRIBE, exactly as `store.js` does ("a component that mounts
         * between frames must paint immediately, so `subscribe` delivers the current state
         * synchronously before returning"). A leaf shown AFTER the machine entered a state
         * has to see that state, which is the ordinary case: the purge is running and the
         * user navigates to the page. */
        /* THE SCALE, FOR THE CALIBRATION WALK. Same real-subscribe shape as the machine
         * feed beside it and for the same reason: the leaf subscribes once and keeps a
         * rounded gram figure, so a `subscribe` that returned a no-op would prove nothing.
         * It replays on subscribe too — a page opened while a scale is already reporting
         * has to see the weight, which is the ordinary case here. */
        scaleFeed: {
            get: () => scaleFeedState(),
            subscribe: (listener) => {
                scaleFeedListeners.add(listener);
                try {
                    listener(scaleFeedState());
                } catch { /* a subscriber that throws on replay is the subscriber's problem */ }
                return () => scaleFeedListeners.delete(listener);
            },
        },
        machineFeed: {
            get: () => machineFeedState(),
            subscribe: (listener) => {
                machineFeedListeners.add(listener);
                try {
                    listener(machineFeedState());
                } catch { /* a subscriber that throws on replay is the subscriber's problem */ }
                return () => machineFeedListeners.delete(listener);
            },
        },
        languages: [{ code: 'en', endonym: 'English', english: 'English', partial: false }],
        defaultLanguage: 'en',
        capability: (name) => capabilities.capability(name),
        allowed: (name) => capabilities.capability(name) === 'present',
        /* THE SAME EDGE THE APP HANDS THE LEAF (`settings-model.js`): the capability
         * answer is asynchronous, so "may I render" has to be re-askable. The fixture
         * wires the REAL store's subscribe, because a fixture that faked this would prove
         * the fixture re-renders rather than that the leaf listens. */
        watchAllowed: (listener) => capabilities.subscribe(listener),
        /* WHICH MACHINE THIS IS, through the REAL store — the same shape the app hands the
         * leaf. The Default load settings page names OTHER pages in two places, and both
         * have to resolve against this machine or a Bengle is told to go and look at a leaf
         * its own nav does not carry. Reading the real store means `capabilities([...])`
         * moves it, so a case can drive both classes without a second lever. */
        machineClass: () => capabilities.machineClass(),
        /* FILLED IN BELOW, ONCE THE MODEL EXISTS. It is declared here so the shape of
         * this bundle matches `settings-model.js`'s at a glance; the value has to wait,
         * because it reads THROUGH the model this call is about to build. */
        machineValue: () => undefined,
        reloadMachine: () => undefined,
    };

    const model = createSettingsLeafModel({
        settings,
        /* EIGHT DOORS HERE, NOT FIVE. `settings`, `advanced` and `workflow` are scripted
         * objects; the rest are real stores over the fixture transport, which is what makes
         * this suite prove that the leaves READ rather than that the fixture renders.
         *
         * THE WORKFLOW DOOR ARRIVED ON 26 AUGUST 2026 and used to be absent — see
         * `MACHINE_WORKFLOW` for why the old reason expired. It is a scripted object rather
         * than a real store for the half of that reason which still holds: a second workflow
         * STORE here would be two answers to one question in one page.
         *
         * THREE ARRIVED ON 26 AUGUST 2026 with the pages that needed them — `presence`
         * (the sleep policy), `cupWarmer` (the whole cup-warmer page) and `machineInfo`
         * (the measured mains, on the Voltage page). Each replaced hand-drawn controls
         * with registry rows, so without the doors here those rows would render their
         * fallbacks and this suite would be measuring the fallbacks. */
        machine: createMachineFieldsPort({
            settings: settingsPort,
            calibration,
            advanced: {
                read: async () => ({ ...MACHINE_ADVANCED }),
                write: async (patch) => { Object.assign(MACHINE_ADVANCED, patch); return true; },
            },
            app,
            workflow: {
                read: async () => ({ ...MACHINE_WORKFLOW }),
                /* REFUSABLE TOO, on the same lever as the DE1 settings door: a save the
                 * machine refuses has to be reachable whichever door the staged field takes,
                 * or the refusal case silently stops being tested the day a row moves. */
                write: async (patch) => {
                    if (SERVER.settingsRefuse) return false;
                    SERVER.workflowWrites += 1;
                    Object.assign(MACHINE_WORKFLOW, patch);
                    return true;
                },
            },
            presence: presenceDoorFor(presence),
            cupWarmer: cupWarmerDoorFor(cupWarmer),
            machineInfo: machineInfoDoorFor(machineInfo),
        }),
        limits: limitsNow,
        /* THE PANEL, which the row model reads for a served value and commands on a write.
         *
         * IT WAS ABSENT UNTIL 28 AUGUST 2026 and nothing missed it, because the only two
         * panel rows were the wake lock — covered by a unit harness — and the brightness
         * slider, which was a BESPOKE leaf reading `display` above. `ARCHETYPE.SLIDER`
         * made brightness a registry row, and a registry row reads the panel. Without this
         * the row falls back to its stored key and the suite would be measuring the
         * fallback, which is precisely the defect its own tests exist to catch.
         *
         * ONE FOR BOTH HALVES: `SERVER.displayFrame` is what `displayFrame(...)`
         * arms and `SERVER.brightnessSent` is what a case asserts a command against, so
         * the bespoke `display` door above and this panel cannot disagree. */
        panel: {
            setBrightness: (value) => {
                SERVER.brightnessSent.push(value);
                return { ok: true };
            },
            brightnessServed: () => {
                const frame = SERVER.displayFrame;
                if (Number.isFinite(frame?.brightness)) return frame.brightness;
                if (Number.isFinite(frame?.requestedBrightness)) return frame.requestedBrightness;
                return undefined;
            },
            setWakeLock: (on) => {
                SERVER.wakeLockSent = on;
                return { ok: true };
            },
            wakeLockOverride: () => {
                const held = SERVER.displayFrame?.wakeLockOverride;
                return typeof held === 'boolean' ? held : undefined;
            },
        },
    });

    /* THE HALF THAT WAS MISSING, and the page it left blank. `settings-model.js` hands
     * the bespoke leaf a `machineValue(field)` reader for the one surface that reports
     * values it does not own — the Default load settings table, whose NOW column says
     * whether a reset would change anything on this machine. This fixture's bundle had
     * no such key, so `deps.machineValue` was undefined, the leaf's own fallback
     * returned undefined for all eight fields, and every NOW cell drew the absence dash.
     * A suite that renders that page could assert nothing about the column, and a
     * screenshot of it photographed a page that looked broken and was not.
     *
     * IT READS THROUGH THE MODEL, exactly as the app's does. A second reader over the
     * same document is how two surfaces come to disagree about one machine. */
    bespoke.machineValue = (field) => model.machineValue(field);
    /* THE RESET PAGE'S RE-READ. Its NOW column is the values the reset is about to move,
     * and the model holds the document those come from — so after a reset the page has to
     * ask the model again or it goes on printing the pre-reset numbers under a button that
     * says it worked. The fixture wires the same function the app does. */
    bespoke.reloadMachine = () => model.loadMachine();

    return model;
}


/* ---------------------------------------------------------------------------
 * THE BESPOKE CLUSTER'S HALF (`bespoke-leaves-nine`).
 *
 * A FAKE SERVER, NOT FAKE STORES. The nine bespoke leaves read four real stores
 * (`machine-info-store`, `led-strip-store`, `calibration-store`, `skins-store`) and every
 * one of them is constructed here FOR REAL, over a transport whose `request()` answers
 * from the table below. That is deliberate and it is what makes the drill possible:
 * a hand-rolled fake store would prove that the fake store coalesces writes, which is
 * not the claim. The claim is about `led-strip-store.js`, so the suite drives
 * `led-strip-store.js` and counts what reaches the wire.
 *
 * THE DEFAULT IS THE MOCK'S OWN VERDICT. `capabilitiesFail` starts TRUE, so
 * `/machine/capabilities` fails exactly as `tools/mock_rea.py` makes it fail (503, by
 * design, no fixture), `entries` stays null and every gate reads UNKNOWN — which
 * means lighting, load cells and sleep/wake render NOTHING until a driver says otherwise.
 * A fixture whose default was "everything present" would photograph a machine nobody has.
 * ------------------------------------------------------------------------- */

/** The served LED strip, byte-for-byte the shape `api__v1__machine__ledStrip.json` has. */
const LED_START = {
    frontStrip: { sleeping: '4A4A2B2B0000', awake: 'FFFFC1C18080' },
    backStrip: { sleeping: '4A4A2B2B0000', awake: 'FFFFC1C18080' },
    frontSwitch: { sleeping: '4A4A2B2B0000', awake: 'FFFFC1C18080' },
};

/** `GET /api/v1/info`, verbatim from the recorded fixture `api__v1__info.json`. A real
 *  capture off a bench tablet: every one of the nine fields is a value the running
 *  ReaPrime actually served, rather than nine plausible strings written here. */
const INFO_START = {
    commit: 'e3313d840e52ecc334d705078cca48ae05e0283a',
    commitShort: 'e3313d84',
    branch: 'port/rea-bench-v2',
    buildTime: '2026-08-11T19:56:05Z',
    version: '1.0.0-bengle.1',
    buildNumber: '2259',
    appStore: false,
    fullVersion: '1.0.0-bengle.1+2259',
    localIp: '192.0.2.10',
};

/** `ScaleCalibrationState.toJson`'s five fields, at the machine's resting state. */
const CAL_IDLE = {
    step: 'idle', detectedCell: 'none', subState: 'settling',
    secondsRemaining: 0, status: 'none',
};

const SERVER = {
    capabilitiesFail: true,
    capabilities: [...SERVED_CAPABILITIES],
    machineInfo: { version: '282', model: 'Bengle', serialNumber: '888888', GHC: true },
    led: JSON.parse(JSON.stringify(LED_START)),
    calibration: { ...CAL_IDLE },
    flowMultiplier: 1,
    skins: [
        { id: 'decal', name: 'Decal', version: '0.0.1', isBundled: false, reaMetadata: { lastChecked: '2026-08-19T00:00:00Z' } },
        { id: 'beanie', name: 'Beanie', version: '0.3.5', isBundled: true, reaMetadata: { lastChecked: null } },
        { id: 'NSX-skin', name: 'NSX', version: '0.4.0', isBundled: true, reaMetadata: { lastChecked: '2026-08-12T05:59:29Z' } },
    ],
    skinDefault: 'decal',
    /* WHAT THE SERVER IS SERVING. `POST /webui/server/start` reads the DEFAULT and serves
     * its folder, so a switch that only set the default would change nothing — which is
     * the exact behaviour `skins-store.switchTo` exists to get right, and the only way to
     * prove it is to model both. */
    skinServing: 'decal',
    skinUpdates: 0,
    /* WHAT THE NEXT UPDATE RUN WILL ACTUALLY INSTALL, as `{id: version}` — or null for a
     * run that finds nothing newer, which is the ordinary case and the one whose sentence
     * is easiest to get wrong. `POST /webui/skins/update` applies it, so the re-read the
     * store does afterwards sees exactly what a real machine's would: new version strings
     * on the records that moved and untouched ones everywhere else. */
    skinUpdateResult: null,
    /* NO FIRMWARE CATALOG BY DEFAULT, and that is a state worth keeping: a machine that
     * has not answered is what this leaf draws its empty state for, and one suite asserts
     * exactly that. `api.firmwareCatalog(...)` serves one for the cases that need it.
     *
     * THE WRITE COUNT IS THE POINT of those cases: "choosing a file is not flashing it" is
     * only provable against a server that would have noticed. */
    firmware: null,
    firmwareWrites: 0,

    /* THE DEVICE LIST — the same shape the socket sends, remembered devices included.
     * `available: false` is a device ReaPrime knows about and cannot see right now, which
     * is what "previously connected" means and is the state both connection pages are
     * mostly about. */
    devices: [
        { id: 'DA:BA:AF:20:7A:03', name: 'Bengle', type: 'machine', state: 'connected', available: true },
        { id: 'usb-2e8a-a-854962', name: 'Bengle', type: 'machine', state: 'disconnected', available: false },
        { id: 'scale-01', name: 'Bengle scale', type: 'scale', state: 'disconnected', available: false },
    ],

    /* THE TEN LEAVES THAT LANDED ON 24 AUG 2026. Every one of them is a route ReaPrime
     * already served with no client behind it, so the fixture server grows with them
     * fake server, real stores, which is this file's whole rule. */
    presence: {
        userPresenceEnabled: true,
        sleepTimeoutMinutes: 30,
        keepAwakeUntil: null,
        schedules: [{ id: 'sched-1', time: '05:30', daysOfWeek: [], enabled: true, keepAwakeFor: 60 }],
    },
    /* THREE MANIFESTS, AND EACH ONE IS A CASE THE PLUGIN ROW HAS TO GET RIGHT.
     *
     * `api` USED TO BE ABSENT FROM ALL OF THEM, which is why no test could see the Open
     * button's rule at all — `pluginPage()` reads that array and every fixture plugin
     * answered "no endpoints". The three arrays below are the three shapes the real six
     * carry (`tools/rea-fixtures/api__v1__plugins.json`):
     *
     *   visualizer     http endpoints, none of them `ui`. Its FIRST http endpoint is
     *                  `status`, which answers JSON — the exact manifest that used to draw
     *                  an Open button onto a page of raw JSON.
     *   time-to-ready  a websocket and nothing else. No button, and never had one.
     *   settings       one http endpoint whose id is `ui`. The convention both HTML-serving
     *                  plugins use and the one the previous skin hard-codes. This is the button's row.
     *
     * AND TWO OF THE THREE CARRY A SECOND CASE. The settings plugin's description ends in a
     * raw localhost URL, exactly as the real one does, so the blurb's stripping is provable;
     * and its version already spells its own "v", which is the manifest that used to render
     * "vv2.0.0". */
    plugins: [
        {
            id: 'visualizer.reaplugin',
            name: 'Visualizer upload',
            author: 'Decent Espresso',
            description: 'Uploads shots to Visualizer',
            version: '1.5.5',
            loaded: true,
            autoLoad: true,
            api: [
                { id: 'status', type: 'http', data: {} },
                { id: 'upload', type: 'http', data: {} },
            ],
            /* THE SIX THE REAL MANIFEST DECLARES, verbatim from
             * `tools/rea-fixtures/api__v1__plugins.json` (a capture off the bench tablet).
             * It carried only the first three, which is why audit
             * F-045 — "a numeric plugin setting opens a text keyboard" — could not be
             * driven here: the fixture had no `type: "number"` field for the leaf that
             * renders one. Three added, none changed. */
            settings: {
                Username: { type: 'string', description: 'Visualiser username' },
                Password: { type: 'string', secure: true, description: 'Visualiser password' },
                AutoUpload: { type: 'boolean', description: 'Upload shots automatically', default: true },
                LengthThreshold: {
                    type: 'number', default: 5,
                    description: 'Only upload shots that are longer than the threshold (in seconds)',
                },
                BackSync: {
                    type: 'boolean', default: false,
                    description: 'Sync metadata you edit on Visualizer back onto your local shots.',
                },
                BackSyncIntervalSeconds: {
                    type: 'number', default: 300,
                    description: 'How often to check Visualizer for back-sync changes (in seconds, minimum 60)',
                },
            },
        },
        {
            id: 'time-to-ready.reaplugin',
            name: 'Time To Ready',
            author: 'Decent Espresso',
            description: 'Estimates when the machine is ready',
            version: '1.0.3',
            loaded: true,
            autoLoad: false,
            api: [{ id: 'timeToReady', type: 'websocket', data: {} }],
            settings: {},
        },
        {
            id: 'settings.reaplugin',
            name: 'Settings Viewer',
            author: 'Decent Espresso',
            description: 'Displays settings. http://localhost:8080/api/v1/plugins/settings.reaplugin/ui',
            /* ALREADY SPELLED WITH ITS OWN v, which the real manifest does not do today and
             * a third-party manifest is free to do tomorrow — `version` is free-form text.
             * The row wrote `v${version}` outright, so this is the
             * manifest that rendered "vv2.0.0". */
            version: 'v2.0.0',
            loaded: true,
            autoLoad: true,
            api: [{ id: 'ui', type: 'http', data: {} }],
            settings: {},
        },
    ],
    pluginSettings: {
        'visualizer.reaplugin': { Username: 'ben', Password: { isSet: true }, AutoUpload: true },
        'time-to-ready.reaplugin': {},
        'settings.reaplugin': {},
    },
    account: { loggedIn: false },
    /* ---- Help > Talk to Decent, the message box -----------------------------
     *
     * THE BEARER REAPRIME WOULD HAVE INJECTED. `null` reproduces every page this skin is
     * served from that is NOT ReaPrime's own skin server — the dev harness, the capture
     * battery — where `window.__REA_PROXY_TOKEN__` is undefined because nothing injected a
     * meta tag. Both cases are real and both have a branch. */
    proxyToken: 'fixture-bearer',
    /**
     * WHAT `support/api/emails` RELAYS, AS A STRING.
     *
     * A STRING AND NOT AN ARRAY, deliberately. The account proxy relays the upstream body
     * VERBATIM and the transport reads it with `expect: 'text'`, so the thing the store
     * actually receives is text — and the one property most worth proving is that the
     * store survives the MALFORMED shape the previous skin had to write a regex for (`"subject": ,`).
     * A fixture that handed over a parsed array could not express that at all, and the
     * repair would be untested code guarding against a case the suite could not produce.
     */
    supportThread: JSON.stringify([
        { from_user: 'Support', now: 1756200000, subject: 'Re: grinder', body: 'Try 1.2 finer.', automsg: 0 },
        { now: 1756100000, subject: 'grinder', body: 'The grind seems coarse.' },
    ]),
    /** Every message the fixture accepted, as `{subject, body}`. */
    supportSent: [],
    /** The Authorization header each proxied call carried, in order. */
    supportBearers: [],
    /** When set, the send endpoint answers this instead of its success token. */
    supportSendAnswer: null,
    /**
     * WHAT `POST /feedback` ANSWERS, or null for the ordinary 201 with no issue named.
     *
     * THE THREE OUTCOMES ARE THREE DIFFERENT SCREENS and this fixture
     * could only produce one of them: a 201 with `{success:true}` and nothing else. So the
     * store's handling of the issue it filed, and its handling of a refusal's REASON, were
     * both untestable — which is how both came to be missing. `{status, body}`.
     */
    feedbackResult: null,
    /** How many feedback reports actually reached the wire. A refusal must not. */
    feedbackPosts: 0,
    appSettings: {
        scalePowerMode: 'disconnect',
        blockOnNoScale: false,
        weightFlowMultiplier: 1,
        volumeFlowMultiplier: 0.3,
        chargingMode: 'balanced',
        nightModeEnabled: true,
        nightModeSleepTime: 1320,
        nightModeMorningTime: 420,
        lowBatteryBrightnessLimit: true,
        /* THE DECAID PAGE'S FOUR, AND THEY WERE MISSING. The page went from an apology to
         * four controls, and this payload never grew the keys behind
         * them — so all four rows read ABSENT in every test and every capture, and nothing
         * could tell a row that works from a row that does not. Same shape as the reset
         * table's NOW column, found the same way.
         *
         * `webUiPath` is here as a READING: the page shows it and never offers to change
         * it, because writing it re-points the server at another folder. */
        gatewayMode: 'tracking',
        logLevel: 'INFO',
        automaticUpdateCheck: false,
        webUiPath: '/data/user/0/net.tadel.reaprime/app_flutter/webui/decal',
        chargingState: {
            mode: 'balanced', nightModeEnabled: true, currentPhase: 'inactive',
            batteryPercent: 100, usbChargerOn: false, isEmergency: false,
        },
    },
    wifiEndpoints: [],

    /** Every brightness the leaf asked the panel for, in order. */
    brightnessSent: [],
    /** The last wake-lock command, declared beside its sibling rather than sprung
     *  into existence by the first write. `null` = never commanded. */
    wakeLockSent: null,
    /**
     * The display feed's parsed frame, or null for "no frame yet".
     *
     * NULL IS THE DEFAULT AND IT IS A REAL STATE: the socket has not answered, and the
     * slider must fall back to the stored preference rather than to a number typed into
     * the leaf. `displayFrame(...)` arms it.
     */
    displayFrame: null,
    /**
     * WHAT THE MACHINE ITSELF REPORTS IT IS DOING, or null for "it has not said".
     *
     * NULL IS THE DEFAULT AND IT IS A REAL STATE, exactly as `displayFrame` above is: no
     * snapshot frame has reached the leaf, so the two maintenance pages can report what
     * they ASKED for and must not claim anything about what the machine is doing. A
     * fixture that started at `idle` would be answering a question nobody has asked the
     * machine yet, and it would hide the difference between "not purging" and "not
     * known". `machineState(...)` arms it.
     */
    machineFrame: null,
    /**
     * THE LAST `/ws/v1/update` FRAME, RAW, or null for "the socket has said nothing".
     *
     * Null is the default and it is a real state: `readUpdateFrame` of nothing is not a
     * record of nulls, and the Decaid block draws its facts with no update line rather
     * than claiming the build is current. `appUpdateFrame(...)` arms it.
     */
    updateFrame: null,
    /**
     * THE LAST `/ws/v1/scale/snapshot` FRAME, RAW, or null for "the scale has said nothing".
     *
     * Null is the default and it is a real state — a settings page opened with no scale
     * paired, which is most of them — and the calibration walk must draw the absence dash for
     * it rather than a zero nobody weighed. `scaleWeight(...)` arms it.
     */
    scaleFrame: null,
    /**
     * Has the scale's source gone, holding its last frame? The feed's own STALE.
     *
     * A SEPARATE FLAG FROM AN ABSENT FRAME, because the two are different states and the
     * leaf must draw them the same way for opposite reasons: no frame is "nothing has been
     * said", stale is "what was said is no longer to be believed". A frozen last weight
     * under the zero step's "take the platform off" is the specific lie this guards.
     */
    scaleStale: false,
    scaleStatus: null,
    rememberRefuse: false,
    localWriteRefuse: false,
    readRefuse: false,
    rememberHold: false,
    /**
     * `GET /api/v1/info`, at the shape `tools/rea-fixtures/api__v1__info.json` records
     * which is a REAL capture off a bench tablet, branch and commit included.
     *
     * `appInfo(null)` makes the route fail, which is what a ReaPrime too old to serve this
     * route looks like and is the state every fact row must draw as a dash.
     */
    info: { ...INFO_START },
    /* WHAT A SEARCH TURNS UP — one of each type, because the Machine
     * page renders the found list now and a fixture with only scales in it could not tell
     * "no machine found" from "the list is not rendered". */
    scanResults: [
        { id: 'scale-1', name: 'Decent Scale', type: 'scale', state: 'discovered', available: true },
        { id: 'machine-1', name: 'Another Bengle', type: 'machine', state: 'discovered', available: true },
    ],

    /**
     * ROUTES THE SERVER SHOULD REFUSE, by `METHOD /path`.
     *
     * A fixture that answered `ok` unconditionally could not test a refusal, and four
     * device routes shared one `writeError` slot precisely because nobody had ever seen one
     * arrive. `failRoute('PUT /devices/forget')` makes the server say no, with the shape
     * `devices_handler.dart` actually uses.
     */
    failing: new Set(),
    cupWarmer: { temperature: 45, enabled: false, currentTemperature: null },
    cupWarmerPreheat: { enabled: false, leadMinutes: 20, active: false },
    /** Every machine state the leaves asked for, in order. Descaling reads it. */
    stateRequests: [],
    /** Every command the Decaid block sent on the update socket, in order. */
    updateCommands: [],
    /** What the update channel answers a command with — null is `{ok: true}`. F-035. */
    updateRefusal: null,
    /** Every plugin this skin asked the machine to DELETE. It must stay empty — see the
     *  DELETE branch of the fixture transport for why. */
    pluginDeletes: [],
    /** How many times the reset leaf has asked for the seven defaults. */
    resets: 0,
    /** Make the machine settings door refuse, so a commit can fail. */
    settingsRefuse: false,
    workflowWrites: 0,
    wire: [],

    /** Every PUT /machine/ledStrip the store has issued, in order. The drill reads it. */
    ledWrites: [],
    /* THE LIVE WRITES, AND THEY ARE A DIFFERENT ROUTE SINCE THE RE-PIN. The app gained
     * `POST /machine/ledStrip/preview` and `.../preview/clear` (de1handler.dart:261, :302)
     * and the store moved onto them, so a drag no longer PUTs the four STORED registers on
     * every frame. They are recorded separately from `ledWrites` for the reason the two
     * routes exist: a preview must leave the stored palette alone, and a fixture that fed
     * both into one list could not tell a preview from a save. The body is the route's own
     * flat shape — `{frontStrip, backStrip}`, 12 hex each — not the nested strip state. */
    ledPreviews: [],
    ledPreviewClears: 0,
    /* THE TWO THAT PERSIST, COUNTED SEPARATELY FROM THE ONES THAT DO NOT. A PUT writes the
     * stored registers and nothing durable; only the commit route reaches NVM, and the
     * reset route reloads it. Counting all three together would have hidden the defect this
     * pair exists to pin — a header Save that closed the page without committing anything. */
    ledCommits: 0,
    ledResets: 0,
    /** When true, a live write parks until `releaseLed()` — "a slow mock", the rule's own condition. */
    ledHeld: false,
    ledParked: [],
};

const ok = (data, status = 200) => reaSuccess({ status, data, method: 'GET', url: 'fixture' });
const fail = (status, problem = null) => reaFailure('http', {
    status, message: `fixture ${status}`, problem, method: 'GET', url: 'fixture',
});

/**
 * The transport the four bespoke stores are built over. One function, one switch, no
 * network — and every path here is the one the GENERATED TABLE produced, because
 * `callRoute` built it. Nothing in this fixture spells a route id.
 */
function createFixtureTransport() {
    /* `createDe1SettingsClient` REFUSES a transport with no `onWrite` — it is what
     * invalidates its caches when a workflow write moves five of the nine values GET
     * /machine/settings returns. The fixture answers the two DE1 documents by hand, so
     * nothing here has a cache to drop; the subscription exists so the client can be
     * built at all, which is the point of a refusal rather than a soft degrade. */
    const writeListeners = [];
    return {
        socketUrl: () => 'ws://fixture',
        /* THE ABSOLUTE URL OF A PATH, and it was missing.
         *
         * `plugins-store.pageUrl()` is the one caller: a plugin's own page is a NAVIGATION
         * rather than a request, so the store hands back a URL and the browser opens it.
         * With no `url` here that call threw inside the Open button's click handler, and
         * because nothing in `test/` had ever rendered the Plugins leaf, the throw was
         * invisible. A fixture transport missing a method the real one has is a fixture
         * that can only test the half it happens to implement.
         *
         * The base is spelled the way `createReaTransport` composes one, so a path that
         * arrives with no leading slash still produces a URL with exactly one. NO QUERY
         * PARAMETER: the real signature takes one and its single caller here passes none,
         * and a fixture that accepted a query it encoded differently from `reaQuery` would
         * be modelling a shape rather than the behaviour. */
        url: (path) => `http://fixture${String(path).startsWith('/') ? path : `/${path}`}`,
        onWrite(listener) {
            writeListeners.push(listener);
            return () => {
                const at = writeListeners.indexOf(listener);
                if (at >= 0) writeListeners.splice(at, 1);
            };
        },
        async request(path, { method = 'GET', body, query = null, headers = null, expect = 'json' } = {}) {
            const key = `${method} ${path}`;
            SERVER.wire.push(key);
            if (method !== 'GET') {
                for (const listener of writeListeners) listener({ method, path });
            }
            /* A ROUTE THE CASE ASKED THE SERVER TO REFUSE. Before this the fixture answered
             * ok for everything, which is why a refusal path could go four months without a
             * reader: nothing in the suite had ever produced one. The body is ReaPrime's own
             * shape for a refused device operation. */
            if (SERVER.failing.has(key)) {
                return fail(503, { outcome: 'failed', error: 'the fixture was told to refuse this' });
            }
            switch (key) {
                case 'GET /machine/info':
                    return ok({ ...SERVER.machineInfo });

                /* ---- which build of Decaid this tablet runs --------------- */
                case 'GET /info':
                    return SERVER.info
                        ? ok({ ...SERVER.info })
                        : fail(503, { error: 'this build does not serve /info' });

                case 'GET /machine/ledStrip':
                    return ok(JSON.parse(JSON.stringify(SERVER.led)));

                case 'PUT /machine/ledStrip': {
                    SERVER.ledWrites.push(JSON.parse(JSON.stringify(body)));
                    SERVER.led = JSON.parse(JSON.stringify(body));
                    if (!SERVER.ledHeld) return ok({ status: 'accepted' });
                    /* PARKED. The write is on the wire and has not answered, which is
                     * exactly the state the pattern is about: everything the user does
                     * from here lands in `pendingColour` and all but the last is dropped. */
                    return new Promise((resolve) => {
                        SERVER.ledParked.push(() => resolve(ok({ status: 'accepted' })));
                    });
                }

                /* THE LIVE PREVIEW. Accepted, recorded, and it does NOT touch `SERVER.led`
                 * — the stored palette is what `GET /machine/ledStrip` answers and what a
                 * reload gets back, and the whole point of this route is that a preview
                 * does not reach it. The real handler answers `jsonAccepted()` with no
                 * body (de1handler.dart:295), which is what 202/null is here.
                 *
                 * IT PARKS UNDER `holdLed()`, because this is the route the one-write-in-
                 * flight rule now governs; the PUT it replaced used to be. */
                case 'POST /machine/ledStrip/preview': {
                    SERVER.ledPreviews.push(JSON.parse(JSON.stringify(body)));
                    const accepted = () => reaSuccess({ status: 202, data: null, method, url: 'fixture' });
                    if (!SERVER.ledHeld) return accepted();
                    return new Promise((resolve) => {
                        SERVER.ledParked.push(() => resolve(accepted()));
                    });
                }

                case 'POST /machine/ledStrip/preview/clear':
                    SERVER.ledPreviewClears += 1;
                    return reaSuccess({ status: 202, data: null, method, url: 'fixture' });

                case 'POST /machine/ledStrip/commit':
                    SERVER.ledCommits += 1;
                    return reaSuccess({ status: 202, data: null, method, url: 'fixture' });

                case 'POST /machine/ledStrip/reset':
                    SERVER.ledResets += 1;
                    SERVER.led = JSON.parse(JSON.stringify(LED_START));
                    return ok(JSON.parse(JSON.stringify(SERVER.led)));

                case 'GET /machine/scaleCalibration':
                    return ok({ ...SERVER.calibration });

                case 'PUT /machine/scaleCalibration': {
                    const command = body && body.command;
                    if (command === 'zero') SERVER.calibration = { ...CAL_IDLE, step: 'zeroing', secondsRemaining: 15 };
                    else if (command === 'latch') SERVER.calibration = { ...CAL_IDLE, step: 'calLatch', secondsRemaining: 15 };
                    else SERVER.calibration = { ...CAL_IDLE };
                    return reaSuccess({
                        status: 202,
                        data: { status: 'accepted', state: { ...SERVER.calibration } },
                        method, url: 'fixture',
                    });
                }

                case 'GET /machine/calibration':
                    return ok({ flowMultiplier: SERVER.flowMultiplier });

                case 'POST /machine/calibration':
                    if (body && Number.isFinite(body.flowMultiplier)) SERVER.flowMultiplier = body.flowMultiplier;
                    return reaSuccess({ status: 202, data: null, method, url: 'fixture' });

                /* ---- firmware ------------------------------------------- */
                case 'GET /machine/firmware':
                    return SERVER.firmware
                        ? ok({ ...SERVER.firmware })
                        : fail(503, { error: 'no machine' });

                case 'POST /machine/firmware':
                case 'POST /machine/firmware/apply':
                    SERVER.firmwareWrites += 1;
                    return ok({ status: 'started' });

                case 'GET /webui/skins':
                    return ok(SERVER.skins.map((skin) => ({ ...skin })));

                case 'GET /webui/skins/default': {
                    const chosen = SERVER.skins.find((skin) => skin.id === SERVER.skinDefault);
                    return chosen ? ok({ ...chosen }) : fail(404, { error: 'No default skin available' });
                }

                /* ---- presence -------------------------------------------- */
                case 'GET /presence/settings':
                    return ok(JSON.parse(JSON.stringify(SERVER.presence)));

                case 'POST /presence/settings': {
                    if (typeof body?.userPresenceEnabled === 'boolean') {
                        SERVER.presence.userPresenceEnabled = body.userPresenceEnabled;
                    }
                    if (Number.isInteger(body?.sleepTimeoutMinutes)) {
                        /* THE HANDLER CLAMPS RATHER THAN REFUSING, which is the whole
                         * reason the store re-reads after every write. */
                        SERVER.presence.sleepTimeoutMinutes = Math.min(240, Math.max(0, body.sleepTimeoutMinutes));
                    }
                    return ok({ ...SERVER.presence });
                }

                case 'POST /presence/schedules': {
                    const created = {
                        id: `sched-${SERVER.presence.schedules.length + 1}`,
                        time: body.time,
                        daysOfWeek: body.daysOfWeek ?? [],
                        enabled: body.enabled !== false,
                        ...(Number.isFinite(body.keepAwakeFor) ? { keepAwakeFor: body.keepAwakeFor } : {}),
                    };
                    SERVER.presence.schedules.push(created);
                    return reaSuccess({ status: 201, data: created, method, url: 'fixture' });
                }

                /* ---- plugins --------------------------------------------- */
                case 'GET /plugins':
                    return ok(JSON.parse(JSON.stringify(SERVER.plugins)));

                /* ---- the app settings document --------------------------- */
                case 'GET /settings':
                    return ok(JSON.parse(JSON.stringify(SERVER.appSettings)));

                case 'POST /settings':
                    Object.assign(SERVER.appSettings, body ?? {});
                    return ok({ ...SERVER.appSettings });

                /* ---- the Decent account ---------------------------------- */
                case 'GET /account/decent':
                    return ok({ ...SERVER.account });

                /* ---- Help > Talk to Decent, through the account proxy ------
                 *
                 * BOTH ANSWER TEXT, WHICH IS WHAT THE REAL ROUTE DOES. The handler relays
                 * the upstream status and body verbatim and the document types the success
                 * content `application/octet-stream`; the store therefore reads with
                 * `expect: 'text'` and gets a string. A fixture that answered a parsed
                 * object would be modelling a route this one is not.
                 *
                 * THE BEARER IS RECORDED RATHER THAN ENFORCED. What the suite needs to
                 * prove is that the header REACHES the wire — the middleware's 401 is
                 * ReaPrime's behaviour and re-implementing it here would be the fixture
                 * testing itself. `supportBearers` is the evidence. */
                case 'GET /account/proxy/support/api/emails':
                    SERVER.supportBearers.push(headers?.Authorization ?? null);
                    return reaSuccess({ status: 200, data: SERVER.supportThread, method, url: 'fixture' });

                case 'GET /account/proxy/support/api/email': {
                    SERVER.supportBearers.push(headers?.Authorization ?? null);
                    /* THE MESSAGE ARRIVES ON THE QUERY STRING and nowhere else — the skin
                     * token is read-scoped, so a POST body is not an option. Recording the
                     * pair is how a test proves the attachment block was appended to the
                     * BODY rather than sent as some fourth field. */
                    SERVER.supportSent.push({ subject: query?.subject ?? null, body: query?.body ?? null });
                    /* '1' IS A SUCCESS TOKEN AND '0' IS THE REFUSAL, which is the only
                     * thing anybody knows about this endpoint's replies: ReaPrime's own
                     * `emailSerialMismatch` tests `body.trim() == '0'` for failure and says
                     * nothing about the success shape. So the fixture answers a non-zero
                     * token and a test that wants the refusal scripts one. */
                    return reaSuccess({ status: 200, data: SERVER.supportSendAnswer ?? '1', method, url: 'fixture' });
                }

                /* ---- feedback -------------------------------------------- */
                case 'POST /feedback': {
                    SERVER.feedbackPosts += 1;
                    const scripted = SERVER.feedbackResult;
                    if (!scripted) {
                        return reaSuccess({ status: 201, data: { success: true }, method, url: 'fixture' });
                    }
                    return scripted.status >= 400
                        ? fail(scripted.status, scripted.body ?? null)
                        : reaSuccess({ status: scripted.status, data: scripted.body ?? null, method, url: 'fixture' });
                }

                /* ---- the scale connection surface ------------------------ */
                case 'GET /devices/wifi':
                    return ok({ endpoints: [...SERVER.wifiEndpoints] });

                case 'POST /devices/wifi':
                    SERVER.wifiEndpoints.push(String(body.host));
                    return ok({ endpoints: [...SERVER.wifiEndpoints] });

                case 'DELETE /devices/wifi':
                    return ok({ endpoints: [...SERVER.wifiEndpoints] });

                /* A SCAN CHANGES WHAT IS REACHABLE, which is the whole reason the store
                 * re-reads after one. Any remembered device whose id the sweep turned up
                 * becomes `available` — the sequence a person performs on a recovery page
                 * (switch the machine on, press Search) modelled rather than assumed. */
                case 'GET /devices/scan': {
                    const seen = new Set(SERVER.scanResults.map((device) => device.id));
                    for (const device of SERVER.devices) {
                        if (seen.has(device.id)) device.available = true;
                    }
                    return ok(SERVER.scanResults.map((device) => ({ ...device })));
                }

                /* ---- the device list, and the three things you can do to one ---- */
                case 'GET /devices':
                    return ok(SERVER.devices.map((device) => ({ ...device })));

                /* THE HANDLER LOOKS THE ID UP IN THE LIVE LIST, and a REMEMBERED device is
                 * by construction not in it (`devices_handler.dart:315` against
                 * `buildAvailabilityDeviceList` at `:641-655`). The fixture answered `ok`
                 * for any id at all, which is exactly why the Reconnect button could ship
                 * calling a route that answers 404 every time for the rows it was built
                 * for. It says no now, the way the machine does. */
                case 'PUT /devices/connect': {
                    const found = SERVER.devices.find((device) => device.id === body.deviceId);
                    if (!found || found.available === false) {
                        return fail(404, { error: 'Device not found' });
                    }
                    found.state = 'connected';
                    found.available = true;
                    return ok({ outcome: 'connected' });
                }

                case 'PUT /devices/disconnect': {
                    const found = SERVER.devices.find((device) => device.id === body.deviceId);
                    if (found) found.state = 'disconnected';
                    return ok({ outcome: 'disconnected' });
                }

                case 'PUT /devices/forget':
                    SERVER.devices = SERVER.devices.filter((device) => device.id !== body.deviceId);
                    return ok(null);

                /* ---- the skin writes. THE SERVER MODELS BOTH HALVES: the default is a
                 * preference, and starting the server is what re-points it. ---- */
                case 'PUT /webui/skins/default':
                    SERVER.skinDefault = String(body.skinId);
                    return ok({ success: true, skinId: SERVER.skinDefault });

                case 'POST /webui/server/stop':
                    SERVER.skinServing = null;
                    return ok({ message: 'stopped' });

                case 'POST /webui/server/start':
                    SERVER.skinServing = SERVER.skinDefault;
                    return ok({ message: 'serving' });

                case 'POST /webui/skins/update':
                    SERVER.skinUpdates += 1;
                    if (SERVER.skinUpdateResult) {
                        for (const skin of SERVER.skins) {
                            const next = SERVER.skinUpdateResult[skin.id];
                            if (typeof next === 'string') skin.version = next;
                        }
                    }
                    return ok({ message: 'Skin update check completed' });


                /* ---- the cup warmer -------------------------------------- */
                case 'DELETE /machine/settings/reset':
                    /* SEVEN VALUES, NOT A FACTORY RESET. The fixture applies exactly what
                     * `De1Controller.applySettingsDefaults` writes, so a leaf that
                     * re-reads afterwards sees what the machine would show. */
                    SERVER.resets += 1;
                    MACHINE_SETTINGS.fan = 55;
                    MACHINE_SETTINGS.steamPurgeMode = 0;
                    MACHINE_ADVANCED.heaterIdleTemp = 95;
                    MACHINE_ADVANCED.heaterPh1Flow = 2;
                    MACHINE_ADVANCED.heaterPh2Flow = 4;
                    MACHINE_ADVANCED.heaterPh2Timeout = 4;
                    MACHINE_ADVANCED.refillKitSetting = 2;
                    SERVER.flowMultiplier = 1;
                    return reaSuccess({ status: 202, data: null, method, url: 'fixture' });

                case 'GET /machine/cupWarmer':
                    return ok({ ...SERVER.cupWarmer });

                case 'PUT /machine/cupWarmer': {
                    if (typeof body?.enabled === 'boolean') SERVER.cupWarmer.enabled = body.enabled;
                    if (Number.isFinite(body?.temperature)) SERVER.cupWarmer.temperature = body.temperature;
                    return ok({ status: 'accepted' });
                }

                case 'GET /machine/cupWarmer/preheat':
                    return ok({ ...SERVER.cupWarmerPreheat });

                case 'PUT /machine/cupWarmer/preheat': {
                    if (typeof body?.enabled === 'boolean') SERVER.cupWarmerPreheat.enabled = body.enabled;
                    if (Number.isFinite(body?.leadMinutes)) SERVER.cupWarmerPreheat.leadMinutes = body.leadMinutes;
                    return ok({ status: 'accepted' });
                }

                default:
                    /* THE STATE REQUEST IS THE ONE ROUTE WITH A PARAMETER IN ITS PATH,
                     * so it cannot be a `case` — descaling and the air purge both land
                     * here, and the fixture records what was asked for. */
                    if (method === 'PUT' && path.startsWith('/machine/state/')) {
                        SERVER.stateRequests.push(path.slice('/machine/state/'.length));
                        return ok(null);
                    }
                    if (method === 'GET' && /^\/plugins\/[^/]+\/settings$/.test(path)) {
                        const id = path.split('/')[2];
                        return ok({ ...(SERVER.pluginSettings[id] ?? {}) });
                    }
                    if (method === 'POST' && /^\/plugins\/[^/]+\/settings$/.test(path)) {
                        const id = path.split('/')[2];
                        const settled = { ...(SERVER.pluginSettings[id] ?? {}) };
                        for (const [key_, value] of Object.entries(body ?? {})) {
                            /* A SECURE FIELD COMES BACK AS ITS STATE, never as the value
                             * that went up — the round trip the real handler performs. */
                            settled[key_] = key_ === 'Password' ? { isSet: value !== null } : value;
                        }
                        SERVER.pluginSettings[id] = settled;
                        return ok({ ...settled });
                    }
                    /* REMOVING A SKIN. Its id is in the path, so it cannot be a `case`.
                     * THE HANDLER DOES NOT REFUSE THE ACTIVE SKIN and this does not
                     * either — the guard is `skins-store.remove`'s, and a fixture that
                     * refused it would hide a missing guard rather than prove one. */
                    if (method === 'DELETE' && /^\/webui\/skins\/[^/]+$/.test(path)) {
                        const id = decodeURIComponent(path.split('/')[3]);
                        SERVER.skins = SERVER.skins.filter((skin) => skin.id !== id);
                        return ok({ message: 'removed' });
                    }
                    if (method === 'POST' && /^\/plugins\/[^/]+\/(enable|disable)$/.test(path)) {
                        const id = path.split('/')[2];
                        const plugin = SERVER.plugins.find((entry) => entry.id === id);
                        if (plugin) plugin.autoLoad = path.endsWith('/enable');
                        return ok({ message: 'ok', id });
                    }
                    /* A SERVER THAT WOULD NOTICE A DELETE, so "this skin does not remove
                     * plugins" is a measurement rather than a claim.
                     *
                     * The Plugins page had a Remove button and its
                     * confirmation said the plugin could never come back. On the pin's
                     * bundled six that is false — `_copyBundledPlugins()` restores every
                     * one of them at the next app start, with auto-load set true again
                     * so what Remove actually did was wipe the plugin's stored settings
                     * and its SECURE settings, the Visualizer password among them. The
                     * button, the dialog and the store's `remove()` are gone; this counter
                     * is what fails if any of them comes back without the pin moving. It
                     * still answers the handler's own 200, because a fixture that refused
                     * would prove the refusal rather than the absence of the call. */
                    if (method === 'DELETE' && /^\/plugins\/[^/]+$/.test(path)) {
                        SERVER.pluginDeletes.push(decodeURIComponent(path.split('/')[2]));
                        return ok({ message: 'removed', id: path.split('/')[2] });
                    }
                    /* THE MOCK'S OWN ANSWER FOR A MISS: 503 with a body, never 404
                     * 404 is ReaPrime's feature-absent signal (tools/mock_rea.py:63-65). */
                    return fail(503, { error: `fixture has no recording for ${key}` });
            }
        },
    };
}

/**
 * The mount host, created on demand — the same id and the same reason as the selector's:
 * `#stage` is what the render suite's stage carries, and the fixture must not have two
 * mount protocols. Created inside `#mount` rather than shipped in the page, because an
 * always-present sibling with a viewport block-size would push every other capture down.
 */
function stage() {
    let host = document.getElementById('stage');
    if (!host) {
        host = document.createElement('div');
        host.id = 'stage';
        document.getElementById('mount').append(host);
    }
    return host;
}

let screen = null;
let model = null;

/**
 * Settle the screen AND the leaf, and give the write path a macrotask.
 *
 * A row write is asynchronous all the way down (the router awaits its backend), so the
 * chain is: control event -> model.set -> backend -> beacon -> re-render. A `rAF` alone
 * lands before the tail of that on a slow frame; the timeout is what makes "the value is
 * stored" and "the screen shows it" the same moment for anything that reads afterwards.
 */
const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await screen?.updateComplete;
    const leaf = screen?.shadowRoot?.getElementById('leaf');
    await leaf?.updateComplete;
    /* The bespoke half settles too, or a capture lands between the primitive rows and
     * the section  says the leaf needs. */
    await screen?.shadowRoot?.getElementById('bespoke')?.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
};

const api = {
    /** Create the screen inside `#stage`. Idempotent: a second call reuses the first. */
    async mount() {
        const host = stage();
        if (!screen) {
            model = buildModel();
            screen = document.createElement('settings-screen');
            screen.boot = Object.freeze({ settings: settingsStore });
            screen.model = model;
            screen.bespoke = bespoke;
            screen.theme = theme;
            host.append(screen);
        }
        /* ARMED, THEN SETTLED. The machine document and the leaf's own keys are read
         * before anything is photographed; without this a capture can catch the leaf
         * between "no value yet" and "value", which is a frame no test asserts. */
        await model.load(screen.getAttribute('leaf-id') ?? 'machine-steam');
        await settle();
        return screen;
    },

    /** The leaf model, for a driver that wants to stage a change or read the count. */
    model: () => model,

    /** The element, for a driver that wants to reach past this surface. */
    screen: () => screen,

    /** The stage, so a state can narrow it and reach the collapsed branch. */
    stage,

    /** Select a category by id. The first leaf of that category comes with it. */
    async selectCategory(id) {
        screen.setAttribute('category-id', id);
        const category = (await import('../../src/lib/settings-nav.js')).categoryFor(id);
        if (category) screen.setAttribute('leaf-id', category.leaves[0].id);
        await settle();
    },

    /** Select a leaf by id, and read what that leaf needs before settling. */
    async selectLeaf(id) {
        screen.setAttribute('leaf-id', id);
        await model.load(id);
        await settle();
    },

    /**
     * Change one row THROUGH ITS CONTROL, which is the whole point: the control announces,
     * the leaf writes, the leaf announces, and the screen reacts. Calling `model.set()`
     * directly would write the value and skip everything downstream of it — and one row
     * (the rule's display size) has an effect that lives precisely there, so a fixture that took
     * the short cut would photograph a preference that never applied.
     *
     * The event is the control's own `change`, in the control's own vocabulary; the only
     * thing not simulated is the finger that would have moved the control first, so the
     * property is set to match what the event announces.
     */
    async change(rowId, value) {
        const leaf = screen.shadowRoot.getElementById('leaf');
        const row = leaf?.shadowRoot?.querySelector(`[data-row="${rowId}"]`);
        const control = row?.control?.[0];
        if (!control) return false;
        if (control.localName === 'ui-switch') {
            control.checked = value;
            control.dispatchEvent(new CustomEvent('change', {
                detail: { checked: value }, bubbles: true, composed: true,
            }));
        } else {
            control.value = value;
            control.dispatchEvent(new CustomEvent('change', {
                detail: { value }, bubbles: true, composed: true,
            }));
        }
        await settle();
        return true;
    },

    /**
     * Type into the search field and let it announce — the same path a finger takes,
     * so what is photographed is the screen's own reaction and not a state poked into it.
     */
    async search(text) {
        const field = screen.shadowRoot.getElementById('search');
        field.value = text;
        field.dispatchEvent(new CustomEvent('search', { bubbles: true, composed: true }));
        await settle();
    },


    /* ---- the bespoke cluster's levers  ---------------------------
     * Every one of these moves the SERVER and then re-reads through the real store, so a
     * driver never pokes a store's state directly. A fixture that could set a store's
     * value would let a test assert a state the store cannot actually reach. */

    /**
     * Serve, or refuse to serve, the capability array — the rule's whole input.
     *
     * `null` restores the mock's own behaviour (the read FAILS, `entries` stays null,
     * every gate reads UNKNOWN and the three gated leaves render nothing). An array is
     * served verbatim, so a test can hand `[]` — a real answer meaning "a DE1" — and see
     * ABSENT rather than UNKNOWN.
     */
    async capabilities(entries) {
        SERVER.capabilitiesFail = entries === null || entries === undefined;
        if (!SERVER.capabilitiesFail) SERVER.capabilities = [...entries];
        capabilities.forget();
        await capabilities.load();
        /* THE SERVER AND THE STORE, AND NOTHING ELSE. This lever used to re-select the
         * current leaf afterwards, on the grounds that "a gate that has just opened has to
         * be told to look" — which is exactly the defect it was hiding, and it did not
         * even work (re-selecting the SAME leaf changes no property, so the leaf never
         * re-read). The leaf subscribes to the capability answer itself now, so a driver
         * that serves a capability while a gated leaf is already on screen sees what a
         * user sees. */
        screen?.requestUpdate?.();
        await settle();
    },

    /** The bespoke element, for a driver that wants to reach past this surface. */
    bespokeEl: () => screen?.shadowRoot?.getElementById('bespoke') ?? null,

    /* THE PRIMITIVE HALF, for the same reason. A leaf draws BOTH halves — the registry
     * rows and, for a bespoke leaf, its own section — and several
     * settings moved from the second half to the first (the cup warmer's four, the sleep
     * policy's two). A driver asserting where a control ended up needs to see both. */
    leafEl: () => screen?.shadowRoot?.getElementById('leaf') ?? null,

    /** The stores, for an assertion about what reached the wire. */
    stores: () => bespoke,

    /** The theme controller and the element it stamps — cmp-ss-3's two halves. */
    theme: () => theme,
    themeStamp: () => themeRoot?.getAttribute('data-theme') ?? null,

    /** What the fake server has been told. Numbers and payloads only. */
    server: () => ({
        ledWrites: SERVER.ledWrites.length,
        ledCommits: SERVER.ledCommits,
        ledResets: SERVER.ledResets,
        ledLast: SERVER.ledWrites.length
            ? SERVER.ledWrites[SERVER.ledWrites.length - 1]
            : null,
        /** The live half: what a drag put on the wire, and what ended it. */
        ledPreviews: SERVER.ledPreviews.length,
        ledPreviewClears: SERVER.ledPreviewClears,
        ledPreviewLast: SERVER.ledPreviews.length
            ? SERVER.ledPreviews[SERVER.ledPreviews.length - 1]
            : null,
        flowMultiplier: SERVER.flowMultiplier,
        calibration: { ...SERVER.calibration },
        /* THE 24 AUG 2026 LEAVES. Each one is what a press on a new surface is supposed
         * to have changed on the server — the half a screenshot cannot show. */
        presence: JSON.parse(JSON.stringify(SERVER.presence)),
        plugins: SERVER.plugins.map((plugin) => ({ id: plugin.id, autoLoad: plugin.autoLoad })),
        pluginSettings: JSON.parse(JSON.stringify(SERVER.pluginSettings)),
        appSettings: JSON.parse(JSON.stringify(SERVER.appSettings)),
        wifiEndpoints: [...SERVER.wifiEndpoints],
        stateRequests: [...SERVER.stateRequests],
        pluginDeletes: [...SERVER.pluginDeletes],
        cupWarmer: { ...SERVER.cupWarmer },
        cupWarmerPreheat: { ...SERVER.cupWarmerPreheat },
        machineAdvanced: { ...MACHINE_ADVANCED },
        workflowWrites: SERVER.workflowWrites,
        machineWorkflow: { ...MACHINE_WORKFLOW },
        resets: SERVER.resets,
        /* THE 26 AUG 2026 SURFACES. The device list, the two halves of a skin switch, and
         * the count of firmware writes — which is the one that proves "choosing a file is
         * not flashing it". */
        devices: SERVER.devices.map((device) => ({ ...device })),
        skinDefault: SERVER.skinDefault,
        skinServing: SERVER.skinServing,
        skinUpdates: SERVER.skinUpdates,
        /** How many feedback reports actually reached the wire. A refusal must not. */
        feedbackPosts: SERVER.feedbackPosts,
        firmwareWrites: SERVER.firmwareWrites,
    }),

    /**
     * Serve a firmware catalog, so a case can drive the update page.
     *
     * OFF BY DEFAULT — see `SERVER.firmware`. A machine that has not answered is the state
     * this leaf's empty state is for, and it is asserted elsewhere.
     */
    async firmwareCatalog(catalog) {
        SERVER.firmware = catalog === null ? null : {
            machine: { build: 336, model: 'Bengle' },
            artifacts: [{ id: 'de1-336', build: 336 }, { id: 'de1-337', build: 337 }],
            recommendedArtifactId: 'de1-337',
            updateAvailable: true,
            operation: null,
            ...(catalog ?? {}),
        };
        await bespoke.firmware?.load?.();
        await settle();
        return true;
    },

    /**
     * Make one route refuse, or stop it refusing. `METHOD /path`, as the switch spells it.
     *
     * A REFUSAL IS A STATE THE SURFACE HAS TO DRAW, and this fixture
     * could not produce one — so `writeError` was written by five operations and read by
     * one, and nothing failed. Pass `false` to clear.
     */
    failRoute(key, on = true) {
        if (on) SERVER.failing.add(key);
        else SERVER.failing.delete(key);
        return true;
    },

    /**
     * Serve one `/ws/v1/display` frame to the brightness slider, or `null` for none.
     *
     * The pair `{brightness, requestedBrightness}` is the one the slider reads: `brightness`
     * is what the panel is ACTUALLY at, which ReaPrime caps while its low-battery limit is
     * active, and `requestedBrightness` is what was last asked for.
     */
    async displayFrame(frame) {
        SERVER.displayFrame = frame === null ? null : { ...frame };
        publishDisplayFeed();
        api.bespokeEl()?.requestUpdate?.();
        await settle();
        return true;
    },

    /** What the leaf asked the panel for. The half a screenshot cannot show. */
    brightnessSent: () => [...SERVER.brightnessSent],

    /** the rule's drill needs A SLOW MOCK: park every live write until `releaseLed` lets them go. */
    holdLed() { SERVER.ledHeld = true; },

    /** Let the parked writes answer, one round at a time. */
    releaseLed() {
        const parked = SERVER.ledParked.splice(0, SERVER.ledParked.length);
        for (const release of parked) release();
        return parked.length;
    },

    /**
     * THE OTHER HALF OF `holdLed()`, and it was missing.
     *
     * `holdLed()` sets a flag nothing ever cleared, so a suite that parked a write left
     * every LATER test in the same page talking to a server that never answers a write.
     * That is invisible while no other test awaits one and is an unkillable hang the
     * moment one does — which is exactly how it surfaced (cmp-ss-1's power drill, the
     * next test to await `settled()`).
     */
    freeLed() {
        SERVER.ledHeld = false;
        return api.releaseLed();
    },

    /** How many live writes are parked on the wire right now. Must never exceed 1. */
    ledParked: () => SERVER.ledParked.length,

    wire: () => [...SERVER.wire],
    clearWire() { SERVER.wire.length = 0; return true; },

    /** The store's own counters: intents, sent, peak in flight, dropped. */
    ledCounters: () => bespoke.led.counters(),

    /** Press a preset swatch, through the component, the way a finger does. */
    async pickSwatch(index) {
        const row = api.bespokeEl()?.shadowRoot?.getElementById('led-presets');
        if (!row) return false;
        const button = row.shadowRoot.getElementById(`swatch-${index}`);
        if (!button) return false;
        button.click();
        await settle();
        return true;
    },

    /** Press the wizard's ONE button, whatever it currently says. */
    async pressWizard() {
        const button = api.bespokeEl()?.shadowRoot?.getElementById('cal-primary');
        if (!button) return false;
        button.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await settle();
        return true;
    },

    /** Put the machine in one calibration state and let the leaf read it. */
    async calibrationState(patch) {
        Object.assign(SERVER.calibration, patch);
        await bespoke.calibration.read();
        await settle();
    },

    /**
     * Say what the MACHINE reports it is doing, and let the feed carry it to the leaf.
     *
     * `null` puts it back to "it has not said", which is the fixture's default and is a
     * real state: with no frame the two maintenance pages report the REQUEST they made and
     * claim nothing about the machine. Pass a `MACHINE_STATE` member — the same spelling
     * the generated enum carries and the same one `PUT /machine/state/<newState>` parses.
     *
     * THIS IS THE ONLY WAY TO REACH THAT PAGE'S STATUS LINE. The line is not derived from
     * the 200 that started the cycle — `machine-state-store.js` is emphatic that a 200 is
     * not a state change — so a driver that only pressed Start could never see a running
     * or a finished sentence, which is exactly how both went missing.
     */
    async machineState(state) {
        SERVER.machineFrame = state === null || state === undefined ? null : String(state);
        publishMachineFeed();
        await settle();
        return true;
    },

    /**
     * Put a weight on the scale, or `null` to take the scale away entirely.
     *
     * `null` IS "NO FRAME HAS ARRIVED" and is the fixture's default: a settings page opened
     * with no scale paired. It is a different state from a scale reporting zero, and the
     * calibration walk has to draw the first as the absence dash and the second as `0.0 g` —
     * which is the whole of on the one settings surface that shows a live reading.
     *
     * `stale` HOLDS THE LAST FRAME AND MARKS THE SOURCE GONE, which is the feed's own STALE
     * and the third state. It is not a fourth kind of absence: the leaf must render it
     * exactly as it renders no frame at all, because a weight nobody is still measuring is
     * not a reading. Passing a weight with `stale: true` is how a case proves the leaf does
     * not go on printing it.
     *
     * THE FRAME IS RAW, at `WeightSnapshot.toJson`'s shape, and goes through the real
     * `readScaleSnapshot`. See `scaleFeedState`.
     */
    async flowCalibration(value) {
        SERVER.flowMultiplier = value;
        await model.loadMachine();
        await settle();
        return true;
    },

    /**
     * Put one field of `GET /machine/settings/advanced` at a value, and re-read.
     *
     * THE THIRD VOLTAGE STATE IS ONLY REACHABLE THIS WAY. `De1HeaterVoltage` has a member
     * the bank deliberately does not offer — `unset(-1)` — and a machine nobody has told
     * answers exactly that. The fixture's machine ships at 230, which is the happy case and
     * the one every existing assertion measures; without a lever, the unset case could not
     * be driven and the row's `emptyNote` would have no test at all.
     *
     * A WRITE TO THE DOCUMENT, NOT TO THE MODEL, so the value takes the same path a real
     * machine's would — through the advanced door on the next read — rather than being
     * poked into the leaf model where the read is the thing under test.
     */
    async machineAdvancedField(field, value) {
        MACHINE_ADVANCED[String(field)] = value;
        await model.loadMachine();
        await settle();
        return true;
    },

    async scaleWeight(grams, { stale = false, status = null } = {}) {
        SERVER.scaleStale = Boolean(stale);
        SERVER.scaleStatus = status === null || status === undefined ? null : String(status);
        SERVER.scaleFrame = grams === null || grams === undefined
            ? null
            : { weight: Number(grams), weightFlow: 0, battery: 100, timestamp: new Date(0).toISOString() };
        publishScaleFeed();
        await settle();
        return true;
    },

    /**
     * Push one RAW `/ws/v1/update` frame at the Decaid block, or `null` for none.
     *
     * RAW, AND THROUGH THE REAL READER. See `updateFeedState` — an absent field on this
     * route arrives at the leaf as a no-reading OBJECT, and a fixture that handed over a
     * pre-shaped record would let a leaf that tests for truthiness pass here and fail in
     * the app. Pass what `AppUpdateState.toJson` writes and nothing else.
     */
    async appUpdateFrame(frame) {
        SERVER.updateFrame = frame === null || frame === undefined ? null : { ...frame };
        publishUpdateFeed();
        await settle();
        return true;
    },

    /** What the Decaid block sent on the update socket. The half a screenshot cannot show. */
    updateCommands: () => [...SERVER.updateCommands],

    /**
     * Make the update channel REFUSE, the way a closed socket does (audit F-035).
     *
     * `null` restores the ordinary answer. The string is passed straight through as the
     * channel's `reason`, so a driver states the real one — 'socket is not open' — rather
     * than a stand-in the leaf might be treating specially.
     */
    async updateSendRefusal(reason) {
        SERVER.updateRefusal = reason === undefined ? null : reason;
        await settle();
        return true;
    },

    /**
     * Arm what the next "Update all skins" run will install, as `{id: version}`.
     *
     * `null` is a run that finds nothing newer — the ordinary case, and the one whose
     * sentence is easiest to get wrong, so it is the default and a driver has to ask for
     * anything else.
     */
    armSkinUpdate(map) {
        SERVER.skinUpdateResult = map === null || map === undefined ? null : { ...map };
        return true;
    },

    /**
     * Say what `GET /account/decent` answers, and re-read through the real store.
     *
     * `{loggedIn: null}` is the third state and not a degraded one: a machine that has not
     * answered is different from a machine that answered "no account", and the page has to
     * say so rather than guessing the commoner of the two.
     */
    async accountState(state) {
        SERVER.account = { ...(state ?? {}) };
        await bespoke.account?.load?.();
        await settle();
        return true;
    },

    /* ---- Help > Talk to Decent, the message box ---------------------------- */

    /**
     * Say what `support/api/emails` relays, AS THE STRING IT RELAYS.
     *
     * A STRING, NOT AN ARRAY, and that is the whole reason this lever takes one: the
     * account proxy passes the upstream body through verbatim and the store reads it as
     * text, so a malformed thread is a thing the fixture can actually produce. `''` is a
     * bodyless 200 (an empty conversation, which is a real answer) and `'0'` is the
     * upstream's own refusal token.
     */
    async supportThread(text) {
        SERVER.supportThread = text;
        await bespoke.support?.refresh?.();
        await settle();
        return true;
    },

    /** Script what the SEND endpoint answers. `'0'` is the upstream refusing on a 200. */
    supportSendAnswer(text) {
        SERVER.supportSendAnswer = text ?? null;
        return true;
    },

    /** What actually reached the wire: `[{subject, body}]`, and the bearers that carried it. */
    supportSent: () => SERVER.supportSent.map((entry) => ({ ...entry })),
    supportBearers: () => [...SERVER.supportBearers],

    /**
     * Rebuild the support store with or without a bearer, and re-seat it on the leaf.
     *
     * THE TOKEN IS FIXED AT CONSTRUCTION in the real app too — `bootFromWindow` reads the
     * global once — so taking it away means building another store, exactly as re-serving
     * the page from a different origin would. A lever that mutated a live store would be
     * modelling something that cannot happen.
     */
    async supportToken(present) {
        SERVER.proxyToken = present ? 'fixture-bearer' : null;
        bespoke.support?.stop?.();
        bespoke = {
            ...bespoke,
            support: createDecentSupportStore({ transport: fixtureTransport, token: SERVER.proxyToken }),
        };
        /* THE SCREEN OWNS THE HANDOVER. `<settings-screen>.bespoke` is what reaches
         * `<settings-bespoke-leaf>.deps`; assigning the element's `deps` directly would be
         * a second path into a property the screen already writes, and the next render
         * would put the old bundle back. */
        if (screen) screen.bespoke = bespoke;
        await settle();
        return true;
    },

    /**
     * Script what `POST /feedback` answers: `{status, body}`, or `null` for the plain 201.
     *
     * THE THREE OUTCOMES ARE THREE DIFFERENT SCREENS — a 201 naming the issue it filed, a
     * 201 naming nothing, and a refusal carrying the server's own reason — and this
     * fixture could produce only the middle one. Which is how the
     * store came to drop the body of its own 201 and to read a refusal's reason out of a
     * field that does not exist on a failure.
     */
    async feedbackResult(result) {
        SERVER.feedbackResult = result === null || result === undefined ? null : { ...result };
        bespoke.feedback?.reset?.();
        await settle();
        return true;
    },

    /** Set one skin record's served `reaMetadata.lastChecked`, and re-read. */
    async skinChecked(id, iso) {
        const skin = SERVER.skins.find((entry) => entry.id === id);
        if (!skin) return false;
        skin.reaMetadata = { ...(skin.reaMetadata ?? {}), lastChecked: iso };
        await bespoke.skins?.refresh?.();
        await settle();
        return true;
    },

    /**
     * Serve, or refuse to serve, `GET /api/v1/info`.
     *
     * `null` makes the route fail, which is what a ReaPrime too old to carry it looks
     * like — and the state in which every fact row on the Decaid block must draw a dash
     * rather than a plausible-looking zero. A partial object is merged over the recorded
     * capture, so a case can knock out ONE field and assert only that row moved.
     */
    async appInfo(info) {
        SERVER.info = info === null ? null : { ...INFO_START, ...(info ?? {}) };
        await bespoke.appInfo?.reload?.();
        await settle();
        return true;
    },

    /**
     * Move the warmer the machine is reporting, and re-read the leaf.
     *
     * THE TWO NUMBERS HAVE TO BE SETTABLE SEPARATELY. `GET /machine/cupWarmer` serves both
     * `temperature` (the setpoint) and `currentTemperature` (the live plate reading), and
     * the door confused the two for a fortnight — the Target stepper displayed the live
     * reading. A fixture whose two numbers are always the same, or always absent, cannot
     * express the difference, so nothing could have caught it.
     */
    /** Make the next machine write fail, or let it succeed again. */
    refuseWrites(on = true) { SERVER.settingsRefuse = Boolean(on); },
    refuseRemembered(on = true) { SERVER.rememberRefuse = Boolean(on); },
    refuseLocalWrites(on = true) { SERVER.localWriteRefuse = Boolean(on); },
    refuseReads(on = true) { SERVER.readRefuse = Boolean(on); },
    reread(key) { return settingsStore.load(key); },
    seedStored(key, value) { return fixtureStorage.set(key, value); },
    settingValue(key) { return settingsStore.value(key); },
    holdRemembered(on = true) { SERVER.rememberHold = Boolean(on); },
    heldRemembered: () => heldWrites.length,
    releaseRemembered() {
        while (heldWrites.length) heldWrites.pop()();
        return true;
    },

    async cupWarmerState(patch) {
        Object.assign(SERVER.cupWarmer, patch);
        await model.load(screen?.getAttribute('leaf-id') ?? 'accessories-cup-warmer');
        await settle();
    },

    /** Hand the language grid a longer list — the manifest's job in the app. */
    async languages(list) {
        bespoke.languages = list;
        const el = api.bespokeEl();
        if (el) { el.requestUpdate(); await el.updateComplete; }
        await settle();
    },

    /** Which nav column column 1 holds while collapsed. Inert in the wide branch. */
    async navLevel(level) {
        screen.shadowRoot.getElementById('body').setAttribute('nav-level', level);
        await settle();
    },

    /** A readback, so a driver can assert it drove what it meant to. */
    state() {
        const root = screen.shadowRoot;
        return {
            category: screen.getAttribute('category-id'),
            leaf: screen.getAttribute('leaf-id'),
            navRows: [...root.querySelectorAll('#nav ui-nav-row')].map((r) => r.textContent.trim()),
            subnavRows: [...root.querySelectorAll('#subnav ui-subnav-row')].map((r) => r.textContent.trim()),
            columns: getComputedStyle(root.getElementById('body').shadowRoot.getElementById('grid'))
                .gridTemplateColumns.trim().split(/\s+/).length,
        };
    },
};

globalThis.__settings = api;
ready = Promise.resolve(true);

}
