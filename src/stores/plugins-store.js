/**
 * plugins-store.js — the installed plugins, their on/off state and their settings.
 *
 * TWO LEAVES, ONE STORE, AND THAT IS THE POINT. `extensions-plugins` lists every plugin;
 * `extensions-visualizer` is ONE of those plugins with its own page. They read the same
 * manifest list and write through the same two routes, so a second store would be two
 * in-memory answers to "is the Visualizer plugin enabled" — the B7 defect, wearing two
 * settings leaves instead of one.
 *
 * ===========================================================================
 * THE FORM IS THE MANIFEST'S, NOT THIS SKIN'S
 * ===========================================================================
 *
 * `GET /api/v1/plugins` returns each plugin's manifest, and the manifest carries a
 * `settings` map: `{[key]: {type, description, default?, secure?}}`. `POST
 * /plugins/<id>/settings` VALIDATES EVERY KEY AGAINST THAT MAP and answers 400 for one it
 * does not know (`_validateSettings`, plugin_loader_service.dart:717-734).
 *
 * So the settings form is GENERATED from the manifest rather than typed out per plugin.
 * That is not cleverness for its own sake: the alternative is a hand-written form per
 * plugin, and the day a plugin adds a field the skin shows the old form and 400s on the
 * new one. Slate hand-writes the Visualizer's four fields and therefore does not show the
 * two this manifest also declares (`BackSync`, `BackSyncIntervalSeconds`).
 *
 * THREE TYPES, AND NOTHING ELSE IS RENDERED. `string`, `number`, `boolean` are what the
 * manifests at the pin declare. A type this skin has no control for is REPORTED by
 * `unsupportedSettings()` rather than skipped in silence — a form that quietly omits a
 * field is a form that cannot be trusted to be the whole of one.
 *
 * ===========================================================================
 * A SECURE FIELD IS A STATE, NOT A VALUE
 * ===========================================================================
 *
 * A setting marked `secure: true` NEVER comes back. `GET .../settings` answers
 * `{"Password": {"isSet": true}}` — an object with exactly one boolean key — and
 * `savePluginSettings` SKIPS any incoming value of that shape (`_isSecureState`, :388).
 * That is the round trip working as designed: re-posting the form does not blank the
 * password, and it also means the skin can never show it.
 *
 * So a secure field renders EMPTY with a "set" or "not set" note beside it, typing a new
 * value replaces it, and clearing it needs an explicit null. `secureState()` reads that
 * shape in one place so no surface has to know what `{isSet}` means.
 *
 * ===========================================================================
 * ENABLE IS TWO THINGS AND THE HANDLER DOES BOTH
 * ===========================================================================
 *
 * `POST /plugins/<id>/enable` sets auto-load AND loads the plugin now; `disable` unloads
 * and clears auto-load. So the list's switch is one call, and `loaded` and `autoLoad` in
 * the listing move together — they are reported separately because a plugin can be loaded
 * without auto-load (someone enabled it, then the manifest changed), and showing one as
 * the other would be a guess.
 *
 * `POST /plugins/install` IS NOT CALLED. The handler answers 501 Not Implemented at the
 * pin — it reads the `url` and returns 'Plugin install from URL not yet implemented'. A
 * button for it would be a control that cannot work.
 *
 * ===========================================================================
 * AND `DELETE /plugins/<id>` IS NOT CALLED EITHER, WHICH IS A CHANGE
 * ===========================================================================
 *
 * There was a `remove()` here until 27 August 2026, behind a confirmation on the Plugins
 * page reading "This skin cannot install it again — ReaPrime does not serve plugin
 * installation yet". That is true of the install ROUTE and FALSE OF THE OUTCOME.
 *
 * ALL SIX PLUGINS THE PIN SERVES ARE REAPRIME'S BUNDLED SIX. `removePlugin` unloads the
 * plugin, deletes its directory, its stored settings, its SECURE settings and its
 * `plugin.autoload.<id>` key (`plugin_loader_service.dart:156-184`). Then, at the next app
 * start, `_copyBundledPlugins()` copies the plugin back out of assets because its directory
 * is absent (`:98`, `:535-616`) and `_ensureBundledPluginsAutoLoadEnabled()` sets auto-load
 * true because the key is missing (`:654-698`). So a DELETE did not remove anything: it
 * wiped the plugin's configuration — the Visualizer password among it — and handed the
 * plugin back, enabled and blank, looking exactly as it had.
 *
 * AND THIS STORE CANNOT TELL THE TWO CASES APART AT THIS PIN. `GET /plugins` answers the
 * manifest plus `loaded` and `autoLoad` and nothing else (`plugins_handler.dart:20-33`) —
 * no `source`, no bundled flag — so there is no field on the wire that would let a surface
 * say "this one really goes" for one plugin and "this one comes back" for another. A
 * control whose consequence cannot be stated truthfully is not one this skin offers, and
 * the need behind it — stop this plugin doing things — is exactly what `setEnabled(id,
 * false)` already does.
 *
 * `deletePluginsById` therefore stands in `CONTRACTS.json` as a RECORDED row: a real route,
 * desk-checked, with no caller and a handler-body gate explaining why there is none.
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

/* DYE2'S DESTINATION IS NOT DECLARED HERE, AND THE REASON IS A PINNED LAW.
 *
 * The Live screen's DYE2 button (Ben, 27 August 2026: "Have the button open the bean
 * picker page for now") needs the plugin's id and the endpoint that is its page. Beside
 * `pageUrl` looks like the right home for that pair — this is the one place a plugin and
 * an endpoint become an address. It cannot be: `test/live-screen.test.mjs` asserts over
 * the source of the five Live skeleton files that none of them imports from `src/stores/`,
 * so a constant a screen must read cannot live in a store.
 *
 * IT IS IN `src/lib/plugin-pages.js`, which is the layer a screen AND a store may both
 * read, and which carries the whole argument for `bean-picker` over the `ui` endpoint that
 * `pluginPage()` looks for. `live-screen.js` reads the pair from there and hands both
 * halves straight back to `pageUrl` below, so the mechanism is still exactly one. */

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

        /** One manifest by id, or null. The listing is the only source. */
        plugin(id) {
            return store.get().plugins.find((entry) => entry.id === id) ?? null;
        },

        /** The last-read settings for one plugin, or null when it has not been read. */
        settingsFor(id) {
            return store.get().settings[id] ?? null;
        },

        /**
         * The absolute URL of one plugin's own page.
         *
         * A NAVIGATION, NOT A REQUEST, which is why this hands back a URL rather than
         * fetching it: the page belongs to the plugin and is served by the machine, so the
         * browser opens it and this skin does not render it.
         *
         * THE PATH IS THE GENERATED TABLE'S, through the transport's own `url`. The route
         * is `GET /api/v1/plugins/{id}/{endpoint}` and the two segments are the plugin's
         * id and the endpoint id its manifest declared — both encoded, because a plugin id
         * is a reverse-domain name and an endpoint id is whatever its author typed.
         */
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

        load() {
            if (inFlight) return inFlight;
            publish({ status: PLUGINS_STATUS.LOADING });
            inFlight = readList().finally(() => { inFlight = null; });
            return inFlight;
        },

        refresh() {
            inFlight = null;
            return this.load();
        },

        /**
         * Read one plugin's settings. Separate from the listing on purpose: the listing
         * carries the SCHEMA and this carries the VALUES, and reading every plugin's
         * values to show a list of names would be six requests for one screen.
         */
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

        /**
         * Write a patch of one plugin's settings, and publish what came back.
         *
         * THE HANDLER ANSWERS WITH THE SETTLED DOCUMENT — it saves, RELOADS THE PLUGIN,
         * then returns `pluginSettings(id)` — so the reply is the new truth and no
         * re-read is needed. A secure field comes back as `{isSet}` and never as what was
         * typed, which is the whole reason the reply is used rather than the request.
         */
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

        /* THERE IS NO `remove()`. It existed until 27 August 2026 and is gone with the
         * surface it served — see the DELETE section at the foot of this header for the
         * whole reason, and `settings-bespoke-leaf.js`'s plugin section for the page's
         * half of it. A store method with no caller is the defect class this fork exists
         * to remove, so the route call goes with the button rather than waiting for one. */

        clearWriteError() {
            if (store.get().writeError === null) return;
            publish({ writeError: null });
        },

        stop() { store.destroy(); },
    };
}

/* ------------------------------------------------------------------ schema */

/**
 * One plugin's settings schema as an ordered list of fields, joined to its values.
 *
 * MANIFEST ORDER IS THE FORM'S ORDER. `Object.entries` preserves the JSON's own key
 * order, which is what the plugin author wrote — sorting it alphabetically would put
 * "AutoUpload" above "Username" and break every author's intended reading.
 *
 * @param {object|null} manifest  one entry of `GET /plugins`
 * @param {object|null} values    the answer from `GET /plugins/<id>/settings`
 * @returns {ReadonlyArray<object>} `{key, type, description, secure, supported, value, isSet}`
 */
/**
 * DOES THIS PLUGIN HAVE ANYTHING TO CONFIGURE?
 *
 * The Plugins list shows a settings control only when this is true. A gear that opens an
 * empty form is a control that does nothing, which is the defect class the August audit
 * spent itself removing — so the question is asked here, beside the generator that
 * answers it, rather than by a screen guessing at the manifest's shape.
 *
 * A schema with only UNSUPPORTED types still counts: the form reports those rather than
 * hiding them, so there is something to see and the person is told why it cannot be
 * edited here.
 */
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
            /* A SECURE FIELD HAS NO VALUE TO SHOW, ever — the server answers `{isSet}`
             * and nothing else. `undefined` here is what the control renders as empty,
             * and `isSet` is what the note beside it says. */
            value: state === null ? raw : undefined,
            isSet: state,
            /** The manifest's own default, for a field the server has never been given. */
            fallback: spec?.default,
        });
    }));
}

/**
 * `{isSet: bool}` -> the bool. Anything else -> null, meaning "this is a plain value".
 *
 * The shape is `_isSecureState`'s, read out: a Map of length one whose `isSet` is a bool.
 * One reader, so no surface has to know that a one-key object means a stored secret.
 */
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
