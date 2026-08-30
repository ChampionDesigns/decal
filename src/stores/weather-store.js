/**
 * weather-store.js — the last reading from `weather.reaplugin`, held for the live screen.
 *
 * ===========================================================================
 * THE FIRST PLUGIN-SOCKET READER IN THIS SKIN, so it sets the pattern.
 * ===========================================================================
 * `rea-ws-channels.js` has carried the `pluginEndpoint` row since the port — templated,
 * `/ws/v1/plugins/<id>/<endpoint>`, with its own note naming the two plugin feeds the
 * skin "uses". Nothing consumed it. This is the first, and the note's own rule is the one
 * that matters here:
 *
 *   "A plugin that is not loaded, or an endpoint that is not of websocket type, is
 *    answered with an HTTP 404/400 BEFORE the upgrade — so the socket never opens and a
 *    reconnecting client would dial it for ever. Plugin availability is a
 *    capability-shaped question: a missing plugin degrades to feature-absent, never to an
 *    error banner."
 *
 * So the channel is opened with a BOUNDED attempt count. A machine without the weather
 * plugin stops dialling and the corner simply never appears — no banner, no retry storm,
 * no console full of refusals.
 *
 * ===========================================================================
 * WHAT THIS STORE DOES NOT DO
 * ===========================================================================
 * It does not decide what to draw. `weather-model.js` owns that — which state the corner
 * is in, when a reading has aged out, which periods each surface takes — and it is
 * DOM-free so `node:test` can drive it. This file is the wire: a socket in, a frame held,
 * subscribers told.
 *
 * It does not convert units or bucket the forecast either. The plugin does both, where
 * the location's own timezone is known; re-deriving either here would be a second owner
 * of one answer.
 */

import { createStore } from './store.js';
import { WEATHER_ENDPOINT, WEATHER_PLUGIN_ID } from '../lib/weather-model.js';
import { WS_CHANNELS, pluginEndpointPath } from '../data/rea-ws-channels.js';

/**
 * The plugin's id and the channel it emits on, named ONCE — in `weather-model.js`, and
 * re-exported here so this module's own callers keep the name they had. They live there
 * because a SCREEN needs the id too (to write the location back), and a screen may not
 * import a store: `live-targets.test.mjs` §"no endpoint, no store, no adapter and no
 * machine name".
 */
export { WEATHER_PLUGIN_ID, WEATHER_ENDPOINT } from '../lib/weather-model.js';

/**
 * HOW MANY TIMES TO DIAL BEFORE ACCEPTING THE PLUGIN IS NOT THERE.
 *
 * Three is enough to ride out a socket that drops while the app is still starting, and
 * few enough that a machine which will never have this plugin stops quickly. The corner
 * is absent either way; the difference is whether the log fills up.
 */
export const WEATHER_MAX_ATTEMPTS = 3;

/**
 * The socket path, BUILT BY THE ADDRESS LAYER rather than here.
 *
 * `pluginEndpointPath` encodes both segments and is the declared owner of this
 * construction — `CONTRACTS.json constructedRouteBuilders` names it, which is what lets
 * `gate-d`'s scan for assembled paths pass it. Composing the same string in this file
 * would be a second builder of one route, and the gate says so.
 */
export function weatherPath(pluginId = WEATHER_PLUGIN_ID, endpoint = WEATHER_ENDPOINT) {
    return pluginEndpointPath(pluginId, endpoint);
}

/**
 * @param {{sockets: object, logger?: object}} deps
 * @returns {{get: Function, subscribe: Function, attach: Function, detach: Function}}
 */
export function createWeatherStore({ sockets = null, logger = null } = {}) {
    const store = createStore(null, { label: 'weather', logger });
    let detach = null;

    /**
     * A FRAME IS TAKEN WHOLE, NOT MERGED.
     *
     * The plugin republishes its complete reading on every beat, so the newest frame is
     * always the whole truth. Merging would let a field from a stale reading survive
     * beside fresh ones — the failure that makes a widget show yesterday's rain against
     * today's temperature.
     */
    const onFrame = (frame) => {
        if (!frame || typeof frame !== 'object') return;
        store.set(frame);
    };

    return {
        get: store.get,
        subscribe: store.subscribe,

        /** Open the socket. Safe to call twice; the second call is a no-op. */
        attach() {
            if (detach || !sockets || typeof sockets.channel !== 'function') return;
            const handle = sockets.channel({
                key: 'weather',
                path: weatherPath(),
                channel: WS_CHANNELS.pluginEndpoint,
                maxAttempts: WEATHER_MAX_ATTEMPTS,
            });
            detach = handle && typeof handle.subscribe === 'function'
                ? handle.subscribe(onFrame)
                : null;
        },

        detach() {
            if (typeof detach === 'function') detach();
            detach = null;
        },
    };
}
