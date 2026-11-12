/**
 * The last reading from weather.reaplugin, held for the live screen.
 */

import { createStore } from './store.js';
import { MAX_AGE_MINUTES, WEATHER_ENDPOINT, WEATHER_PLUGIN_ID } from '../lib/weather-model.js';
import { WS_CHANNELS, pluginEndpointPath } from '../data/rea-ws-channels.js';

export { WEATHER_PLUGIN_ID, WEATHER_ENDPOINT } from '../lib/weather-model.js';

export const WEATHER_MAX_ATTEMPTS = 3;

const MINUTE_MS = 60000;

export function weatherPath(pluginId = WEATHER_PLUGIN_ID, endpoint = WEATHER_ENDPOINT) {
    return pluginEndpointPath(pluginId, endpoint);
}

/**
 * @param {{sockets: object, logger?: object, now?: Function, setTimer?: Function, clearTimer?: Function}} deps
 * @returns {{get: Function, subscribe: Function, attach: Function, detach: Function}}
 */
export function createWeatherStore({
    sockets = null,
    logger = null,
    now = Date.now,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
} = {}) {
    const store = createStore(null, { label: 'weather', logger });
    let detach = null;
    let expiry = null;

    const stopExpiry = () => {
        if (expiry !== null) clearTimer(expiry);
        expiry = null;
    };

    let held = null;

    const armExpiry = () => {
        stopExpiry();
        if (!held) return;
        const { frame, age, arrived } = held;
        const wait = (MAX_AGE_MINUTES - age + 1) * MINUTE_MS - (now() - arrived);
        expiry = setTimer(() => {
            expiry = null;
            held = null;
            const waited = Math.round((now() - arrived) / MINUTE_MS);
            store.set({ ...frame, ageMinutes: age + waited });
        }, Math.max(0, wait));
    };

    const onFrame = (frame) => {
        if (!frame || typeof frame !== 'object') return;
        store.set(frame);
        const stated = frame.ageMinutes;
        const age = typeof stated === 'number' && Number.isFinite(stated) ? stated : 0;
        held = frame.ok === true && age <= MAX_AGE_MINUTES ? { frame, age, arrived: now() } : null;
        armExpiry();
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
            armExpiry();
        },

        detach() {
            if (typeof detach === 'function') detach();
            detach = null;
            stopExpiry();
        },
    };
}
