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

/* THE TWO ENUM VOCABULARIES ARE NOT HERE, AND THAT IS THE POINT.
 *
 * `scalePowerMode` and `chargingMode` are Dart enums whose wire value is the enum's own
 * `.name` (`ScalePowerModeFromString.fromString`, `ChargingModeFromString.fromString` —
 * both are a `firstWhere` over `values` by name, and both answer 400 on a miss). A list
 * of those names needs a LABEL beside each one to be a control, and a label is the
 * skin's; so the pair lives once, as the `items` of the registry rows that offer them
 * (`settings-leaves.js`, `connection-scale-power-mode` and
 * `accessories-usb-charger-mode`), each citing the Dart file it was read from.
 *
 * A second copy here would be a vocabulary with no reader — this client posts whatever
 * string the row hands it and the handler is the authority on whether it is a word.
 */

/**
 * The minute-of-day band the handler enforces on both night-mode times.
 *
 * `value is int && value >= 0 && value < 1440` — an exclusive top, so the last valid
 * minute is 1439 and this is `max`, not the count. It is NOT in `machine-limits.js`: that
 * table is the MACHINE's ranges (B2/R2), and this is a server-side validation on an app
 * preference. Putting it there would be the second ranges table by another route.
 */
export const NIGHT_MODE_MINUTE_RANGE = Object.freeze({ min: 0, max: 1439 });

/** Keys `POST /settings` reads AND this skin offers a control for. See the header. */
export const APP_SETTINGS_WRITE_KEYS = Object.freeze([
    'weightFlowMultiplier', 'volumeFlowMultiplier',
    /* THE THIRD MULTIPLIER, added 26 August 2026 with the Hot Water page's "Stop lookahead"
     * row. `hot_water_sequencer.dart:117-118` reads it as `lookaheadSeconds` — how far ahead
     * of the target weight the pour is cut, to allow for water still in flight — and the
     * handler validates only `is num`, so the band the control offers is this skin's and is
     * declared in `machine-limits.js` beside its two siblings. */
    'hotWaterFlowMultiplier',
    'scalePowerMode', 'blockOnNoScale',
    /* THE HOT-WATER STOP POLICY. `hot_water_sequencer.dart:106` reads it; the Hot water stop
     * bank writes it. It was on the served document all along and no client wrote it. */
    'stopHotWaterAtWeight',
    'chargingMode', 'nightModeEnabled', 'nightModeSleepTime', 'nightModeMorningTime',
    'lowBatteryBrightnessLimit',
    /* THE TWO PREFERRED DEVICES, added 26 August 2026 with the connection pages.
     *
     * The handler takes `String or null` for each and answers a typed 400 for anything
     * else, so NULL IS A REAL VALUE here — it is how "no preferred device" is said, and it
     * is what un-preferring one sends. That is worth naming, because the pick helper drops
     * `undefined` and keeps `null`, and the difference is the whole of clearing it. */
    'preferredMachineId', 'preferredScaleId',
    /* THE DECAID PAGE'S THREE, added 26 August 2026 when that page stopped being an
     * apology and became four controls.
     *
     * `gatewayMode` IS AN ENUM AND THE HANDLER REFUSES A STRANGER: it resolves the string
     * against `GatewayMode.values` and answers `"<x> is not a gateway mode"` with a 400,
     * so the three names are the whole vocabulary.
     *
     * `logLevel` IS SILENTLY IGNORED WHEN UNKNOWN, which is the sharper case:
     * `updateLogLevel` looks the name up in `Level.LEVELS` and RETURNS if it does not find
     * it — no error, no change, and a client that offered a name outside that list would
     * write nothing and report success. The ten names are the logger's own.
     *
     * `webUiPath` IS DELIBERATELY NOT HERE. It is writable, and writing it re-points the
     * server at another folder — which is how a skin removes itself from the screen. The
     * page shows it and does not offer to change it. */
    'gatewayMode', 'logLevel', 'automaticUpdateCheck',
]);

export const APP_SETTINGS_PATH = '/settings';

/**
 * A `{read, write}` door over ReaPrime's settings document.
 *
 * NO CACHE, DELIBERATELY, AND THE REASON IS NOT SIZE. The two DE1 documents are cached
 * because reading them costs BLE round trips to the machine; this one is a controller
 * field read out of memory in the same process that serves it. A TTL here would buy
 * nothing and would need its own invalidation table — which is the half of `rea-cache.js`
 * that has already cost a wave.
 *
 * @param {object} transport  from `createReaTransport`
 */
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

        /**
         * Any subset of `APP_SETTINGS_WRITE_KEYS`. Reports the handler's verdict.
         *
         * A body the handler rejects comes back 400 with a sentence naming the key, and
         * `false` here leaves the model's staged intent staged — the user's change is
         * still on screen and still uncommitted, which is the honest state.
         */
        async write(patch) {
            const body = pick(patch, APP_SETTINGS_WRITE_KEYS);
            if (Object.keys(body).length === 0) return false;
            const result = await callRoute(transport, 'postSettings', { body });
            return Boolean(result && result.ok);
        },
    });
}

/**
 * Send only the keys this skin has a control for.
 *
 * Unlike the DE1 client's `pick`, this one CHANGES WHAT REACHES THE WIRE: the handler
 * acts on every key it recognises, so an unknown extra in the body is not ignored — it is
 * applied. A patch that accidentally carried `gatewayMode` would re-point how the whole
 * app talks to the machine.
 */
function pick(source, keys) {
    const out = {};
    for (const key of keys) if (source && source[key] !== undefined) out[key] = source[key];
    return out;
}
