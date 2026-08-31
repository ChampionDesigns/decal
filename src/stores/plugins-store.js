/**
 * The installed plugins, their on/off state and their settings.
 */

import { buildPath, callRoute, routeById } from '../data/rea-routes.js';
import { createStore } from './store.js';

export const PLUGINS_STATUS = Object.freeze({
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    UNAVAILABLE: 'unavailable',
});

/** Setting types this skin renders a control for. Anything else is reported, not hidden. */
export const SETTING_TYPES = Object.freeze(['string', 'number', 'boolean']);

/** The Visualizer plugin's id, as the manifest spells it. One leaf addresses it by name. */
export const VISUALIZER_PLUGIN_ID = 'visualizer.reaplugin';

const EMPTY_STATE = Object.freeze({
    status: PLUGINS_STATUS.IDLE,
    /** The manifests as served, in the handler's order. */
    plugins: Object.freeze([]),
    /** `{[pluginId]: settingsObject}` for every plugin whose settings were read. */
    settings: Object.freeze({}),
    error: null,
    writeError: null,
});

export function createPluginsStore({ transport, logger = null } = {}) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createPluginsStore: a transport must be injected (see createReaTransport)');
    }
    const log = logger && logger.scope ? logger.scope('plugins') : logger;
    const store = createStore({ ...EMPTY_STATE }, { label: 'plugins', logger: log });
    let inFlight = null;

    const publish = (patch) => {
        store.set({ ...store.get(), ...patch });
        return store.get();
    };

    function start() {
        publish({ status: PLUGINS_STATUS.LOADING });
        inFlight = readList().finally(() => { inFlight = null; });
        return inFlight;
    }

    async function readList() {
        const result = await callRoute(transport, 'getPlugins');
        if (!result.ok || !Array.isArray(result.data)) {
            return publish({ status: PLUGINS_STATUS.UNAVAILABLE, error: result });
        }
        return publish({
            status: PLUGINS_STATUS.READY,
            plugins: Object.freeze(result.data.map((plugin) => Object.freeze({ ...plugin }))),
            error: null,
        });
    }

    return {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },

        plugin(id) {
            return store.get().plugins.find((entry) => entry.id === id) ?? null;
        },

        /** The last-read settings for one plugin, or null when it has not been read. */
        settingsFor(id) {
            return store.get().settings[id] ?? null;
        },

        pageUrl(pluginId, endpointId) {
            if (typeof pluginId !== 'string' || typeof endpointId !== 'string') return null;
            if (pluginId === '' || endpointId === '') return null;
            /* `buildPath` IS THE ONE PLACE A TEMPLATE IS FILLED, and it refuses a missing
             * or empty parameter rather than producing a path with a hole in it. */
            return transport.url(buildPath(routeById('getPluginsByIdByEndpoint'), {
                id: pluginId,
                endpoint: endpointId,
            }));
        },

        /**
         * Ensure the listing is loaded. A listing already READY is the answer; an
         * UNAVAILABLE one is not, so a machine that failed once is asked again.
         */
        load() {
            if (inFlight) return inFlight;
            if (store.get().status === PLUGINS_STATUS.READY) return Promise.resolve(store.get());
            return start();
        },

        /** Read the listing again, whatever is held. */
        refresh() {
            inFlight = null;
            return start();
        },

        async loadSettings(id) {
            if (typeof id !== 'string' || !id) return null;
            const result = await callRoute(transport, 'getPluginsByIdSettings', { params: { id } });
            if (!result.ok || !result.data || typeof result.data !== 'object') {
                publish({ error: result });
                return null;
            }
            const settings = Object.freeze({ ...result.data });
            publish({ settings: Object.freeze({ ...store.get().settings, [id]: settings }), error: null });
            return settings;
        },

        async writeSettings(id, patch) {
            if (typeof id !== 'string' || !id) return false;
            if (!patch || typeof patch !== 'object') return false;
            const result = await callRoute(transport, 'postPluginsByIdSettings', { params: { id }, body: patch });
            if (!result.ok) {
                if (log && log.warn) log.warn(`plugin settings write refused for ${id}`);
                publish({ writeError: result });
                return false;
            }
            const settled = result.data && typeof result.data === 'object' ? Object.freeze({ ...result.data }) : null;
            publish({
                writeError: null,
                settings: settled
                    ? Object.freeze({ ...store.get().settings, [id]: settled })
                    : store.get().settings,
            });
            /* THE LISTING MOVES TOO. `savePluginSettings` reloads the plugin, so `loaded`
             * in the manifest list can change as a consequence of a settings write. */
            await this.refresh();
            return true;
        },

        /** Turn one on or off. One call — the handler does both the flag and the load. */
        async setEnabled(id, enabled) {
            if (typeof id !== 'string' || !id) return false;
            if (typeof enabled !== 'boolean') return false;
            const result = await callRoute(
                transport,
                enabled ? 'postPluginsByIdEnable' : 'postPluginsByIdDisable',
                { params: { id }, body: {} },
            );
            if (!result.ok) {
                if (log && log.warn) log.warn(`plugin ${enabled ? 'enable' : 'disable'} refused for ${id}`);
                publish({ writeError: result });
                return false;
            }
            publish({ writeError: null });
            await this.refresh();
            return true;
        },

        clearWriteError() {
            if (store.get().writeError === null) return;
            publish({ writeError: null });
        },

        stop() { store.destroy(); },
    };
}

export function pluginHasSettings(manifest) {
    const schema = manifest && typeof manifest.settings === 'object' ? manifest.settings : null;
    return Boolean(schema) && Object.keys(schema).length > 0;
}

export function settingFields(manifest, values) {
    const schema = manifest && typeof manifest.settings === 'object' ? manifest.settings : null;
    if (!schema) return Object.freeze([]);
    return Object.freeze(Object.entries(schema).map(([key, spec]) => {
        const secure = spec?.secure === true;
        const raw = values ? values[key] : undefined;
        const state = secureState(raw);
        return Object.freeze({
            key,
            type: spec?.type ?? null,
            description: typeof spec?.description === 'string' ? spec.description : '',
            secure,
            supported: SETTING_TYPES.includes(spec?.type),
            value: state === null ? raw : undefined,
            isSet: state,
            /** The manifest's own default, for a field the server has never been given. */
            fallback: spec?.default,
        });
    }));
}

export function secureState(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const keys = Object.keys(value);
    if (keys.length !== 1 || keys[0] !== 'isSet') return null;
    return typeof value.isSet === 'boolean' ? value.isSet : null;
}

/** Fields whose declared type this skin has no control for. Reported, never hidden. */
export function unsupportedSettings(manifest) {
    return settingFields(manifest, null).filter((field) => !field.supported);
}
