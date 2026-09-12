/**
 * the boot sequence, assembled, with no DOM in it.
 */

import { createReaTransport, reaBaseUrl, reaSocketBase, DEFAULT_TIMEOUT_MS } from '../data/rea-transport.js';
import { REA_ERROR, ReaError, reaFailure } from '../data/rea-errors.js';
import { createReaRoutes } from '../data/rea-routes.js';
import { createReaSockets } from '../data/rea-sockets.js';
import { createDevicesLink } from '../data/rea-devices.js';
import { createSensorDiscovery } from '../data/rea-sensors.js';
import { createShotSourceSelector } from '../stores/shot-source-selector.js';
import { createLiveStores, FEED } from '../stores/live-stores.js';
import { SHOT_STATE } from '../stores/feed-readers.js';
import { createWeatherStore } from '../stores/weather-store.js';
import { createCapabilitiesStore } from '../stores/capabilities-store.js';
import { createMachineInfoStore } from '../stores/machine-info-store.js';
import { createWorkflowStore } from '../stores/workflow-store.js';
import { createMachineStateStore } from '../stores/machine-state-store.js';
import { createProfileArmStore } from '../stores/profile-arm-store.js';
import { createProfileEditorStore, SAVE_STATUS } from '../stores/profile-editor-store.js';
import { createProfileLibraryStore } from '../stores/profile-library-store.js';
import { createScaleTareStore } from '../stores/scale-tare-store.js';
import { createShotsStore } from '../stores/shots-store.js';
import { createPluginsStore } from '../stores/plugins-store.js';
import { createSettingsStore } from '../stores/settings-store.js';
import { createCupWarmerStore } from '../stores/cup-warmer.js';
import { createAppSettingsStore } from '../stores/app-settings-store.js';
import { createStore } from '../stores/store.js';
import { createReaKvBackend } from '../data/rea-kv-backend.js';
import { createStorageRouter } from './storage-router.js';
import { numericHistory } from './numeric-input-history.js';
import { createMemoryBackend, createWebStorageBackend } from './storage-backends.js';
import { LAYERS, KV_NAMESPACES, STORAGE_PREFIX } from './storage-routes.js';
import { ROUTES, DEFAULT_ROUTE_ID, assertRouteTable, resolveRoute, hashFor } from './app-routes.js';

/** Where the shell is in its own life. Rendered by `<app-root>`, asserted by the suites. */
const SHOTS_PAGE = 25;

const STALENESS_TICK_MS = 500;

/** Whether the record for the shot that has just finished has reached the history yet. */
export const SAVED_SHOT = Object.freeze({
    IDLE: 'idle',
    WAITING: 'waiting',
    READY: 'ready',
    UNAVAILABLE: 'unavailable',
});

export const SAVED_SHOT_ATTEMPTS = 6;
export const SAVED_SHOT_RETRY_MS = 500;

export const BOOT_PHASE = Object.freeze({
    /** Built, nothing opened. Nothing in this layer starts itself. */
    IDLE: 'idle',
    /** `start()` is running: stores opening, capabilities asked, screen module loading. */
    CONNECTING: 'connecting',
    /** The screen module is loaded and the shell can mount it. */
    READY: 'ready',
    /** The SHELL failed — not the machine. See the header. */
    ERROR: 'error',
});

/** Which of the four steps is in flight, for a surface that wants to say more than
 *  "connecting" and for a report that wants to say where a boot stopped. */
export const BOOT_STEP = Object.freeze({
    STORES: 'stores',
    CAPABILITIES: 'capabilities',
    SCREEN: 'screen',
    DONE: null,
});

export function createAppBoot({
    fetch: fetchImpl,
    createSocket,
    location,
    importModule = (specifier) => import(specifier),
    routes: routeTable = ROUTES,
    route: initialRouteId = DEFAULT_ROUTE_ID,
    logger = null,
    clock = () => Date.now(),
    wait = (ms) => new Promise((done) => { setTimeout(done, ms); }),
    repeat = (fn, ms) => {
        const id = setInterval(fn, ms);
        return () => clearInterval(id);
    },
    timeoutMs = undefined,
    backends = null,
    proxyToken = null,
} = {}) {
    assertRouteTable(routeTable);
    const log = logger && logger.scope ? logger.scope('boot') : logger;
    const note = (level, message) => {
        if (log && log[level]) log[level](message);
    };

    /* ONE reading of where we are, turned into the two origins. Both are pure functions
     * of the object the caller passed; nothing below ever looks at ambient state again. */
    const transport = createReaTransport({
        fetch: fetchImpl,
        baseUrl: reaBaseUrl(location),
        socketBaseUrl: reaSocketBase(location),
        logger,
        ...(timeoutMs === undefined ? null : { timeoutMs }),
    });
    const api = createReaRoutes(transport);
    const sockets = createReaSockets({ createSocket, socketBaseUrl: reaSocketBase(location), logger });
    /* The answer path and the connection feed are the SAME socket, not two:
     * `createLiveStores` attaches the connection feed to `devicesLink.channel` when a
     * link is injected (`live-stores.js:212-214`). */
    const devices = createDevicesLink({ sockets, transport, logger });
    const capabilities = createCapabilitiesStore({ routes: api, logger, now: clock });
    const sensors = createSensorDiscovery({
        transport,
        sockets,
        capabilityGate: capabilities.sensorGate,
        logger,
    });
    const sourceSelector = createShotSourceSelector({ now: clock });
    const live = createLiveStores({
        sockets,
        devicesLink: devices,
        sensorDiscovery: sensors,
        sourceSelector,
        clock,
        logger,
    });
    const weather = createWeatherStore({ sockets, logger });
    const machineInfo = createMachineInfoStore({ transport, logger, now: clock });

    const workflow = createWorkflowStore({ transport, logger, now: clock });
    const appSettings = createAppSettingsStore({ transport, logger });
    const arm = createProfileArmStore({ transport, logger, now: clock });
    /* THE WAKE. `<ui-screensaver>` reports the intent and the shell asks; see the store. */
    const machineState = createMachineStateStore({ transport, logger, now: clock });

    const profileEditor = createProfileEditorStore({ transport, logger, now: clock });

    const kvBase = reaBaseUrl(location);
    const kvDeadlineMs = timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : timeoutMs;

    /* The KV backend is handed `fetch` directly, so it is the one read path that does not
     * inherit the transport's deadline. The deadline is disarmed when the body is read,
     * not when the response arrives. */
    const kvFetch = async (target, options = {}) => {
        const controller = new AbortController();
        let timedOut = false;
        let disarmed = false;
        const timer = kvDeadlineMs
            ? setTimeout(() => { timedOut = true; controller.abort(); }, kvDeadlineMs)
            : null;
        const disarm = () => {
            if (disarmed) return;
            disarmed = true;
            if (timer) clearTimeout(timer);
        };
        const failure = (cause) => new ReaError(reaFailure(
            timedOut ? REA_ERROR.TIMEOUT : REA_ERROR.NETWORK,
            {
                message: timedOut
                    ? `timed out after ${kvDeadlineMs} ms`
                    : String((cause && cause.message) || cause),
                method: options.method ?? 'GET',
                url: String(target),
                cause: cause instanceof Error ? cause : null,
            },
        ));
        let response;
        try {
            response = await fetchImpl(target, { ...options, signal: controller.signal });
        } catch (cause) {
            disarm();
            throw failure(cause);
        }
        if (!response || response.ok !== true || (options.method ?? 'GET') !== 'GET') {
            disarm();
            return response;
        }
        return {
            ok: true,
            status: response.status,
            headers: response.headers,
            async json() {
                try {
                    return await response.json();
                } catch (cause) {
                    throw failure(cause);
                } finally {
                    disarm();
                }
            },
        };
    };

    const storage = createStorageRouter({
        backends: {
            [LAYERS.kv]: createReaKvBackend({
                namespace: KV_NAMESPACES[LAYERS.kv], fetch: kvFetch, baseUrl: kvBase, logger,
            }),
            [LAYERS.kvNumpad]: createReaKvBackend({
                namespace: KV_NAMESPACES[LAYERS.kvNumpad], fetch: kvFetch, baseUrl: kvBase, logger,
            }),
            [LAYERS.local]: createMemoryBackend(),
            [LAYERS.session]: createMemoryBackend(),
            ...(backends || null),
        },
        ...(logger ? { logger } : null),
    });

    const detachNumericHistory = numericHistory.attach(storage);

    const scaleTare = createScaleTareStore({
        transport,
        scale: live.feed(FEED.SCALE),
        logger: note ? logger : null,
    });

    const library = createProfileLibraryStore({
        transport, storage, arm, workflow, logger, now: clock,
    });

    let seenSave = profileEditor.get().save;
    const unwatchEditorSave = profileEditor.subscribe((state) => {
        const status = state ? state.save : null;
        const wasSave = seenSave;
        seenSave = status;
        if (status !== SAVE_STATUS.SAVED || wasSave === SAVE_STATUS.SAVED) return;
        const savedId = state.record && typeof state.record === 'object'
            ? state.record.id ?? null : null;
        if (savedId) adoptSavedProfile(savedId);
    });

    /** The half above, performed. Separate so the subscription stays a decision. */
    async function adoptSavedProfile(savedId) {
        try {
            await library.refresh();

            const saved = library.recordFor(savedId);

            if (library.get().selectedId !== savedId && saved) {
                library.select(savedId);
                note('info', `profile editor: the save is now the selected record (${savedId})`);
            }

            if (saved) {
                const slot = library.favouriteSlotHolding(saved.parentId ?? null);
                if (slot !== null) {
                    await library.setFavourite(slot, savedId);
                    note('info', `profile editor: favourite slot ${slot} follows the save `
                        + `(${saved.parentId} -> ${savedId})`);
                }

                const healed = await library.healFavourites();
                for (const change of healed) {
                    note('info', `profile editor: favourite slot ${change.slot} pointed at `
                        + `hidden ${change.from} — healed to ${change.to} (${change.basis})`);
                }

                await library.arm(savedId);
                note('info', `profile editor: the machine now holds the save (${savedId})`);
            }

            if (saved) return;
            note('warn', `profile editor: saved ${savedId}, but the re-read listing does not `
                + 'carry it — the selection is left where it was');
        } catch (error) {
            note('warn', 'profile editor: the listing could not be re-read after a save — '
                + `${error && error.message}`);
        }
    }

    const shots = createShotsStore({ transport, logger });

    /* The shot that has just finished, and the profile it was pulled with. The machine
     * reports FINISHED before the record exists, so both are filled by the shell. */
    const savedShot = createStore({
        shotId: null,
        status: SAVED_SHOT.IDLE,
        attempts: 0,
    }, { label: 'savedShot', logger: log });

    const shotProfile = createStore({
        shotId: null,
        profileName: '',
        record: null,
    }, { label: 'shotProfile', logger: log });

    let finishedShotId = null;
    let unwatchShotState = null;

    const plugins = createPluginsStore({ transport, logger });

    const settings = createSettingsStore({ storage, capabilities, logger: logger ?? undefined });
    const cupWarmer = createCupWarmerStore({
        routes: api,
        readCapabilities: () => capabilities.entries(),
        ...(logger ? { logger } : null),
        ...(clock ? { now: clock } : null),
    });

    const store = createStore({
        phase: BOOT_PHASE.IDLE,
        step: BOOT_STEP.DONE,
        /** `{id, tag, module, match, requested, planned}` — what is mounted, and why. */
        route: null,
        /** The connection feed's own status word, mirrored (never re-derived). */
        connection: null,
        /** The capability store's status word, mirrored. Never a gate — see the header. */
        capabilities: null,
        /** `{message, specifier}` when the SHELL failed. */
        error: null,
    }, { label: 'boot', logger: log });

    let unwatchConnection = null;
    let stopStalenessClock = null;
    let capabilitiesRead = null;
    let sensorsRead = null;
    let machineInfoRead = null;
    let workflowRead = null;
    let appSettingsRead = null;
    let libraryRead = null;
    let shotsRead = null;
    let cupWarmerRead = null;
    /** The id of the connected machine on the last readable devices frame, or null. */
    let machineId = null;
    /** Whether the connection feed's own source was open on the last frame. */
    let sourceLinked = false;
    let destroyed = false;

    const patch = (fields) => store.set({ ...store.get(), ...fields });

    function askCapabilities() {
        capabilitiesRead = capabilities.load()
            .then((state) => {
                if (!destroyed) patch({ capabilities: state && state.status ? state.status : null });
                return state;
            })
            .catch((error) => {
                note('warn', `the capability read threw: ${error && error.message}`);
                if (!destroyed) patch({ capabilities: 'error' });
                return null;
            });
        sensorsRead = capabilitiesRead
            .then(() => (destroyed ? null : sensors.discoverNow()))
            .catch((error) => {
                note('warn', `the sensor discovery pass threw: ${error && error.message}`);
                return null;
            });
        return capabilitiesRead;
    }

    /** Ask for `machine/info` and hand the BODY to the capability store — one store, one
     *  route, on both sides of the line. */
    function askMachineInfo() {
        machineInfoRead = machineInfo.load()
            .then((state) => {
                if (!destroyed) capabilities.applyMachineInfo(state ? state.info : null);
                return state;
            })
            .catch((error) => {
                note('warn', `the machine info read threw: ${error && error.message}`);
                return null;
            });
        return machineInfoRead;
    }

    function askWorkflow() {
        workflowRead = workflow.load()
            .catch((error) => {
                note('warn', `the workflow read threw: ${error && error.message}`);
                return null;
            });
        return workflowRead;
    }

    function refreshWorkflow() {
        workflowRead = workflow.refresh()
            .catch((error) => {
                note('warn', `the workflow re-read threw: ${error && error.message}`);
                return null;
            });
        return workflowRead;
    }

    function askAppSettings() {
        appSettingsRead = appSettings.load()
            .catch((error) => {
                note('warn', `the app settings read threw: ${error && error.message}`);
                return null;
            });
        return appSettingsRead;
    }

    function askLibrary() {
        libraryRead = library.load()
            .catch((error) => {
                note('warn', `the profile library read threw: ${error && error.message}`);
                return null;
            });
        return libraryRead;
    }

    function askShots() {
        shotsRead = shots.readPage({ limit: SHOTS_PAGE, offset: 0 })
            .then((state) => {
                const newest = state && state.items && state.items.length ? state.items[0] : null;
                const id = newest && typeof newest.id === 'string' ? newest.id : null;
                return id ? shots.loadShot(id) : null;
            })
            .catch((error) => {
                note('warn', `the shots read threw: ${error && error.message}`);
                return null;
            });
        return shotsRead;
    }

    function armedProfileName() {
        const document_ = workflow.get().workflow;
        const title = document_ && document_.profile ? document_.profile.title : null;
        return typeof title === 'string' ? title : '';
    }

    /* The armed profile is copied at the moment a shot gets its id, because the document
     * behind it can be rearmed before the record for that shot ever arrives. */
    function watchShotState() {
        if (unwatchShotState) return;
        const feed = live.feed(FEED.SHOT_STATE);
        unwatchShotState = feed.subscribe((state) => {
            const frame = state ? state.value : null;
            if (!frame || frame.ok !== true) return;
            const id = typeof frame.shotId === 'string' && frame.shotId !== '' ? frame.shotId : null;
            if (id !== null && shotProfile.get().shotId !== id) {
                const profileName = armedProfileName();
                const steps = workflow.get().workflow?.profile?.steps;
                const record = Object.freeze({ workflow: Object.freeze({ profile: Object.freeze({
                    title: profileName,
                    steps: Array.isArray(steps) ? Object.freeze(steps.map(step => Object.freeze({
                        name: typeof step?.name === 'string' ? step.name : '',
                    }))) : null,
                }) }) });
                shotProfile.set({ shotId: id, profileName, record });
            }
            if (frame.state !== SHOT_STATE.FINISHED) return;
            if (id === null || id === finishedShotId) return;
            finishedShotId = id;
            collectSavedShot(id);
        });
    }

    async function collectSavedShot(id) {
        for (let attempt = 1; attempt <= SAVED_SHOT_ATTEMPTS; attempt += 1) {
            if (destroyed || finishedShotId !== id) return null;
            savedShot.set({ shotId: id, status: SAVED_SHOT.WAITING, attempts: attempt });
            let state = null;
            try {
                state = await shots.readPage({ limit: SHOTS_PAGE, offset: 0 });
            } catch (error) {
                note('warn', `the shots re-read after shot ${id} threw: ${error && error.message}`);
            }
            if (destroyed || finishedShotId !== id) return null;
            const items = state && state.items ? state.items : [];
            if (items.some((item) => item && item.id === id)) {
                try {
                    await shots.loadShot(id);
                } catch (error) {
                    note('warn', `the record for shot ${id} threw: ${error && error.message}`);
                }
                if (destroyed || finishedShotId !== id) return null;
                savedShot.set({ shotId: id, status: SAVED_SHOT.READY, attempts: attempt });
                return savedShot.get();
            }
            if (attempt < SAVED_SHOT_ATTEMPTS) await wait(SAVED_SHOT_RETRY_MS);
        }
        if (destroyed || finishedShotId !== id) return null;
        note('warn', `shot ${id} finished but its record did not appear in the list`);
        savedShot.set({ shotId: id, status: SAVED_SHOT.UNAVAILABLE, attempts: SAVED_SHOT_ATTEMPTS });
        return savedShot.get();
    }

    function askCupWarmer() {
        cupWarmerRead = Promise.resolve(capabilitiesRead)
            .catch(() => null)
            .then(() => cupWarmer.refresh())
            .catch((error) => {
                note('warn', `the cup-warmer read threw: ${error && error.message}`);
                return null;
            });
        return cupWarmerRead;
    }

    /** Called when the machine is replaced, so a store holding per-machine state drops it. */
    const machineForgetters = new Set();

    function machineChanged(id) {
        capabilities.forget();
        machineInfo.forget();
        workflow.forget();
        cupWarmer.invalidate();
        live.invalidateSensors();
        for (const forget of machineForgetters) {
            try { forget(); } catch (error) { log?.error?.('a machine forgetter threw', error); }
        }
        if (id === null) return;
        askCapabilities();
        /* The rail's targets belong to the machine that is here now. A swap re-reads them
         * for the same reason it re-reads the capabilities: the departed machine's numbers
         * are not this one's. */
        askWorkflow();
        askMachineInfo();
        askCupWarmer();
    }

    /* The same machine, over a link that dropped and came back. Nothing was forgotten, so
     * only the two documents that can have moved meanwhile are re-read. */
    function machineRecovered() {
        note('info', 'the connection came back — re-reading the machine and workflow documents');
        refreshWorkflow();
        askMachineInfo();
        sensorsRead = sensors.invalidate()
            .catch((error) => {
                note('warn', `the sensor re-check threw: ${error && error.message}`);
                return null;
            });
    }

    function watchConnection() {
        if (unwatchConnection) return;
        const feed = live.feed(FEED.CONNECTION);
        unwatchConnection = feed.subscribe((state) => {
            const status = state && state.status ? state.status : null;
            if (store.get().connection !== status) patch({ connection: status });

            const frame = state ? state.value : null;
            const id = frame && frame.machine ? frame.machine.id ?? null : null;
            const linked = state ? state.sourceOpen === true : false;
            const relinked = linked && !sourceLinked;
            sourceLinked = linked;
            if (id !== machineId) {
                machineId = id;
                machineChanged(id);
                return;
            }
            if (relinked && machineId !== null) machineRecovered();
        });
    }

    const boot = {
        /** Register a forgetter for per-machine state. Returns its own removal. */
        onMachineForget(forget) {
            if (typeof forget !== 'function') return () => {};
            machineForgetters.add(forget);
            return () => machineForgetters.delete(forget);
        },

        transport,
        /** The generated client. Named `api` because `routes` is the route TABLE here. */
        api,
        sockets,
        devices,
        live,
        capabilities,
        weather,
        machineInfo,
        workflow,
        arm,
        /** The editor's record: seated by the selector's Edit, read by the editor. */
        profileEditor,
        scaleTare,
        /** The profile listing and the five favourite slots. Two readers: the selector
         *  screen and the Live header's favourites rail. */
        library,
        /** Asking the machine for a state — today, the screensaver's wake. */
        machineState,
        shotHistory: shots,
        shotProfile,
        savedShot,
        plugins,
        proxyToken,
        cupWarmer,
        appSettings,
        /** The storage router. One per app; screens take it, never build one. */
        storage,
        /** The settings store, over that router. One per app, for the same reason —
         *  and the screensaver is the second reader that proves it had to be. */
        settings,
        routes: routeTable,

        get state() { return store.get(); },
        subscribe(listener) { return store.subscribe(listener); },
        watchers() { return store.size(); },
        attachments() { return unwatchConnection ? 1 : 0; },

        async start({ route = initialRouteId } = {}) {
            if (destroyed) throw new Error('appBoot: start() after destroy()');
            patch({ phase: BOOT_PHASE.CONNECTING, step: BOOT_STEP.STORES, error: null });

            live.attachAll();
            if (stopStalenessClock === null) {
                stopStalenessClock = repeat(() => live.refreshStaleness(clock()), STALENESS_TICK_MS);
            }
            weather.attach();
            watchConnection();
            watchShotState();

            /* The plugin listing is read at launch rather than by whichever screen
               happens to want it first. Started, not awaited: the store records its own
               failure and an absent listing draws nothing. */
            if (plugins && typeof plugins.load === 'function') {
                Promise.resolve(plugins.load()).catch(() => {});
            }

            patch({ step: BOOT_STEP.CAPABILITIES });
            askCapabilities();

            askMachineInfo();

            askWorkflow();

            askLibrary();
            askShots();

            askAppSettings();

            askCupWarmer();

            return boot.goto(route);
        },

        async goto(routeIdOrHash = initialRouteId) {
            const resolved = resolveRoute(hashFor(routeIdOrHash), routeTable);
            const { route } = resolved;
            patch({ phase: BOOT_PHASE.CONNECTING, step: BOOT_STEP.SCREEN, error: null });
            try {
                await importModule(route.module);
            } catch (error) {
                note('error', `screen module '${route.module}' failed to load: ${error && error.message}`);
                return patch({
                    phase: BOOT_PHASE.ERROR,
                    step: BOOT_STEP.SCREEN,
                    route: null,
                    error: {
                        message: String((error && error.message) || error),
                        specifier: route.module,
                    },
                });
            }
            if (destroyed) return store.get();
            return patch({
                phase: BOOT_PHASE.READY,
                step: BOOT_STEP.DONE,
                route: {
                    id: route.id,
                    tag: route.tag,
                    module: route.module,
                    label: route.label,
                    match: resolved.match,
                    requested: resolved.requested,
                    planned: resolved.planned,
                },
                error: null,
            });
        },

        /** The capability read's promise — for a test that wants the answer, and for a
         *  diagnostic that wants to know the boot has fully quiesced. */
        capabilitiesSettled() { return capabilitiesRead ?? Promise.resolve(null); },

        /** The machine-info read's promise — the other half of `capabilitiesSettled()`,
         *  and what a test waits on before asking a gate that answers from machineInfo. */
        machineInfoSettled() { return machineInfoRead ?? Promise.resolve(null); },
        /** The discovery pass that follows the capability read. */
        sensorsSettled() { return sensorsRead ?? Promise.resolve(null); },
        /** The rail's document, for a test that wants its numbers before asserting. */
        workflowSettled() { return workflowRead ?? Promise.resolve(null); },
        /** ReaPrime's preferences, for a test that wants the rail's hot-water stop
         *  condition settled before reading the caption it prints. */
        appSettingsSettled() { return appSettingsRead ?? Promise.resolve(null); },
        /** The mat's state, for a test that wants the header's Warmer control settled.
         *  Machine-gated like the two above, so it re-arms on every machine change. */
        cupWarmerSettled() { return cupWarmerRead ?? Promise.resolve(null); },

        stop() {
            if (stopStalenessClock) stopStalenessClock();
            stopStalenessClock = null;
            if (unwatchConnection) unwatchConnection();
            unwatchConnection = null;
            if (unwatchShotState) unwatchShotState();
            unwatchShotState = null;
            live.detachAll();
            weather.detach();
            return boot;
        },

        destroy() {
            destroyed = true;
            detachNumericHistory();
            boot.stop();
            capabilities.stop();
            machineInfo.stop();
            workflow.stop();
            arm.stop();
            machineState.stop();
            appSettings.stop();
            /* The editor's save watcher goes before the store it watches: `stop()` destroys
             * the store, and a subscription outliving its store is S10 with a new name. */
            unwatchEditorSave();
            profileEditor.stop();
            live.destroy();
            savedShot.destroy();
            shotProfile.destroy();
            store.destroy();
        },
    };

    return boot;
}

export function bootFromWindow({ window: win = globalThis, createSocket, ...rest } = {}) {
    const loc = win.location;
    if (!loc || !loc.hostname) {
        throw new Error('bootFromWindow: no location.hostname — this is the one function that reads it');
    }
    const { backends: injected = null, ...others } = rest;
    return createAppBoot({
        fetch: (...args) => win.fetch(...args),
        createSocket,
        location: { hostname: storedHostname(win) ?? loc.hostname, protocol: loc.protocol },
        proxyToken: proxyTokenOf(win),
        backends: { ...browserBackends(win, others.logger), ...(injected || null) },
        ...others,
    });
}

function browserBackends(win, logger) {
    const one = (pick, label) => {
        try {
            return createWebStorageBackend({ storage: pick(), logger, label });
        } catch {
            return createMemoryBackend();
        }
    };
    return {
        [LAYERS.local]: one(() => win.localStorage, 'localStorage'),
        [LAYERS.session]: one(() => win.sessionStorage, 'sessionStorage'),
    };
}

function proxyTokenOf(win) {
    let raw = null;
    try {
        raw = win.__REA_PROXY_TOKEN__ ?? null;
    } catch {
        return null;
    }
    if (typeof raw !== 'string') return null;
    const value = raw.trim();
    return value === '' ? null : value;
}

function storedHostname(win) {
    let raw = null;
    try {
        raw = win.localStorage?.getItem(`${STORAGE_PREFIX}reaHostname`) ?? null;
    } catch {
        return null;                    // private-mode WebView: not an error, just no answer
    }
    if (raw === null) return null;
    let value = null;
    try {
        value = JSON.parse(raw);        // the web backend JSON-encodes, so "host" has quotes
    } catch {
        return null;
    }
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}
