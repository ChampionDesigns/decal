

import { callRoute } from './rea-routes.js';

export const NIGHT_MODE_MINUTE_RANGE = Object.freeze({ min: 0, max: 1439 });

/** Keys `POST /settings` reads AND this skin offers a control for. See the header. */
export const APP_SETTINGS_WRITE_KEYS = Object.freeze([
    'weightFlowMultiplier', 'volumeFlowMultiplier',
    'hotWaterFlowMultiplier',
    'scalePowerMode', 'blockOnNoScale',
    'stopHotWaterAtWeight',
    'chargingMode', 'nightModeEnabled', 'nightModeSleepTime', 'nightModeMorningTime',
    'lowBatteryBrightnessLimit',
    'preferredMachineId', 'preferredScaleId',
    'gatewayMode', 'logLevel', 'automaticUpdateCheck',
]);

export const APP_SETTINGS_PATH = '/settings';

export function createAppSettingsClient(transport) {
    if (!transport || typeof transport.request !== 'function') {
        throw new Error('createAppSettingsClient: a transport must be injected (see createReaTransport)');
    }

    return Object.freeze({
        /** The document, or null. A failed read is a failure and never an empty document. */
        async read() {
            const result = await callRoute(transport, 'getSettings');
            return result.ok && result.data && typeof result.data === 'object' ? result.data : null;
        },

        async write(patch) {
            const body = pick(patch, APP_SETTINGS_WRITE_KEYS);
            if (Object.keys(body).length === 0) return false;
            const result = await callRoute(transport, 'postSettings', { body });
            return Boolean(result && result.ok);
        },
    });
}

function pick(source, keys) {
    const out = {};
    for (const key of keys) if (source && source[key] !== undefined) out[key] = source[key];
    return out;
}
