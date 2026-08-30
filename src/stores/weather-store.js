/**
 * The last reading from weather.reaplugin, held for the live screen.
 */

import { createStore } from './store.js';
import { WEATHER_ENDPOINT, WEATHER_PLUGIN_ID } from '../lib/weather-model.js';
import { WS_CHANNELS, pluginEndpointPath } from '../data/rea-ws-channels.js';

export { WEATHER_PLUGIN_ID, WEATHER_ENDPOINT } from '../lib/weather-model.js';

export const WEATHER_MAX_ATTEMPTS = 3;

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
