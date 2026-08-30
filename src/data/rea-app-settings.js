// The APP settings document — `GET`/`POST /api/v1/settings`, and the third kind of
// "setting" in this skin.
//
// THREE OWNERS, NOT TWO, AND THE DIFFERENCE IS WHO CAN LOSE THE VALUE.
//
//   the SKIN's       a preference this tablet keeps. `storage-routes.js` decides the
//                    layer; reinstalling the skin loses it.
//   the MACHINE's    `/machine/settings` and `/machine/settings/advanced`. The DE1 holds
//                    it in an MMR; a new tablet finds it already set.
//   REAPRIME's       THIS FILE. Not the machine's — the DE1 has never heard of a charging
//                    mode — and not the skin's, because a second skin on the same tablet
//                    reads the same answer and because ReaPrime ACTS on these itself.
//                    `blockOnNoScale` is enforced in `_requestStateHandler`, so it refuses
//                    a shot whether or not any skin remembers asking for it.
//
// That third owner is why nine of the values Slate shows had no door here: the skin had a
// route table row (`getSettings` / `postSettings`, generated from ReaPrime's own spec) and
// no client, so every one of them read as absent.
//
// CONTRACT, read at ReaPrime 2b047d02e42e29bf2d96a2aa964ef94e4a4daba3
// (`lib/src/services/webserver/settings_handler.dart`, `SettingsHandler.addRoutes`):
//
//   GET  /api/v1/settings -> 200 {gatewayMode, webUiPath, logLevel, weightFlowMultiplier,
//                            volumeFlowMultiplier, hotWaterFlowMultiplier, scalePowerMode,
//                            blockOnNoScale, blockTareDuringShot, stopHotWaterAtWeight,
//                            preferredMachineId, preferredScaleId, defaultSkinId,
//                            automaticUpdateCheck, chargingMode, nightModeEnabled,
//                            nightModeSleepTime, nightModeMorningTime,
//                            lowBatteryBrightnessLimit, keepAwake, simulatedDevices,
//                            themeMode} + `chargingState` ONLY when a battery controller
//                            exists. An absent `chargingState` is a tablet with no battery
//                            reporting, not an error.
//   POST /api/v1/settings -> 200. Every key is `if (json.containsKey(...))`, so ANY SUBSET
//                            is a valid body and an absent key is untouched.
//
// THE HANDLER VALIDATES, AND IT ANSWERS 400 RATHER THAN CLAMPING. Three shapes of refusal
// are worth knowing before a control is built on top of them:
//
//   an unknown enum        `'${json["chargingMode"]} is not a valid charging mode'`. The
//                          vocabularies are the Dart enums' own `.name` values and live
//                          at the rows that offer them, so a control cannot offer a word
//                          the handler will reject. See the note below the import.
//   a wrong type           `'blockOnNoScale must be a boolean'`, and the same sentence for
//                          every other bool and number. There is no coercion.
//   an out-of-range int    `'nightModeSleepTime must be an integer 0-1439'` — the ONE
//                          numeric range this handler enforces, and it enforces it on both
//                          night-mode times. It is a MINUTE OF THE DAY, not a duration.
//
// WHAT IS DELIBERATELY NOT WRITABLE FROM HERE. `webUiPath` re-points the served skin
// folder, `gatewayMode` changes how the whole app talks to the machine, `defaultSkinId`
// decides which skin boots, and `simulatedDevices` fabricates hardware. None of the four
// is a settings ROW in this skin, and a write key with no control is surface that reads
// like a promise (`rea-routes.js`, the demand-driven half). `APP_SETTINGS_WRITE_KEYS` is
// therefore the nine keys a row actually writes, and `pick` drops everything else.

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
