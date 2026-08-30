/**
 * the boot sequence, assembled, with no DOM in it.
 */

import { createReaTransport, reaBaseUrl, reaSocketBase } from '../data/rea-transport.js';
import { createReaRoutes } from '../data/rea-routes.js';
import { createReaSockets } from '../data/rea-sockets.js';
import { createDevicesLink } from '../data/rea-devices.js';
import { createLiveStores, FEED } from '../stores/live-stores.js';
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
import { createMemoryBackend, createWebStorageBackend } from './storage-backends.js';
import { LAYERS, KV_NAMESPACES, STORAGE_PREFIX } from './storage-routes.js';
import { ROUTES, DEFAULT_ROUTE_ID, assertRouteTable, resolveRoute, hashFor } from './app-routes.js';

/** Where the shell is in its own life. Rendered by `<app-root>`, asserted by the suites. */
const SHOTS_PAGE = 25;

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
    /* The B8 answer path and the connection feed are the SAME socket, not two:
     * `createLiveStores` attaches the connection feed to `devicesLink.channel` when a
     * link is injected (`live-stores.js:212-214`). */
    const devices = createDevicesLink({ sockets, transport, logger });
    const live = createLiveStores({ sockets, devicesLink: devices, clock, logger });
    const capabilities = createCapabilitiesStore({ routes: api, logger, now: clock });
    const weather = createWeatherStore({ sockets, logger });
    const machineInfo = createMachineInfoStore({ transport, logger, now: clock });

    const workflow = createWorkflowStore({ transport, logger, now: clock });
    const appSettings = createAppSettingsStore({ transport, logger });
    const arm = createProfileArmStore({ transport, logger, now: clock });
    /* THE WAKE. `<ui-screensaver>` reports the intent and the shell asks; see the store. */
    const machineState = createMachineStateStore({ transport, logger, now: clock });

    const profileEditor = createProfileEditorStore({ transport, logger, now: clock });

    const kvBase = reaBaseUrl(location);
    const storage = createStorageRouter({
        backends: {
            [LAYERS.kv]: createReaKvBackend({
                namespace: KV_NAMESPACES[LAYERS.kv], fetch: fetchImpl, baseUrl: kvBase, logger,
            }),
            [LAYERS.kvNumpad]: createReaKvBackend({
                namespace: KV_NAMESPACES[LAYERS.kvNumpad], fetch: fetchImpl, baseUrl: kvBase, logger,
            }),
            [LAYERS.local]: createMemoryBackend(),
            [LAYERS.session]: createMemoryBackend(),
            ...(backends || null),
        },
        ...(logger ? { logger } : null),
    });

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
    let capabilitiesRead = null;
    let machineInfoRead = null;
    let workflowRead = null;
    let appSettingsRead = null;
    let libraryRead = null;
    let shotsRead = null;
    let cupWarmerRead = null;
    /** The id of the connected machine on the last readable devices frame, or null. */
    let machineId = null;
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

    function machineChanged(id) {
        capabilities.forget();
        machineInfo.forget();
        workflow.forget();
        cupWarmer.invalidate();
        // Nothing to ask. Both stores now answer `unknown`, which is the honest state and
        // the fail-closed one — never the departed machine's answer.
        if (id === null) return;
        askCapabilities();
        /* The rail's targets belong to the machine that is here now. A swap re-reads them
         * for the same reason it re-reads the capabilities: the departed machine's numbers
         * are not this one's. */
        askWorkflow();
        askMachineInfo();
        askCupWarmer();
    }

    function watchConnection() {
        if (unwatchConnection) return;
        const feed = live.feed(FEED.CONNECTION);
        unwatchConnection = feed.subscribe((state) => {
            const status = state && state.status ? state.status : null;
            if (store.get().connection !== status) patch({ connection: status });

            const frame = state ? state.value : null;
            const id = frame && frame.machine ? frame.machine.id ?? null : null;
            if (id === machineId) return;
            machineId = id;
            machineChanged(id);
        });
    }

    const boot = {
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
        plugins,
        proxyToken,
        cupWarmer,
        appSettings,
        /** The B7 storage router. One per app; screens take it, never build one. */
        storage,
        /** The B7 settings store, over that router. One per app, for the same reason —
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
            weather.attach();
            watchConnection();

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
        /** The rail's document, for a test that wants its numbers before asserting. */
        workflowSettled() { return workflowRead ?? Promise.resolve(null); },
        /** ReaPrime's preferences, for a test that wants the rail's hot-water stop
         *  condition settled before reading the caption it prints. */
        appSettingsSettled() { return appSettingsRead ?? Promise.resolve(null); },
        /** The mat's state, for a test that wants the header's Warmer control settled.
         *  Machine-gated like the two above, so it re-arms on every machine change. */
        cupWarmerSettled() { return cupWarmerRead ?? Promise.resolve(null); },

        stop() {
            if (unwatchConnection) unwatchConnection();
            unwatchConnection = null;
            live.detachAll();
            weather.detach();
            return boot;
        },

        destroy() {
            destroyed = true;
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
