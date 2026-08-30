// The two DE1 settings reads — the only two cached routes in Decal.
//
// This is where `DE1_CACHE_SPECS` becomes behaviour: read through a TTL cache, write
// straight through and invalidate BOTH caches on any successful write of any of the THREE
// routes that change what they hold — see `DE1_SETTINGS_INVALIDATING_WRITES`, whose third
// row is `PUT /api/v1/workflow` and is the one an earlier reading of this file missed.
//
// WHY BOTH ON EITHER WRITE. The old module's `invalidateDe1Caches` cleared both, and it
// was right to: the two routes are two views of one device. `POST /machine/settings` runs
// `updateMachineSettings`, `POST /machine/settings/advanced` runs six `setHeater*` writes,
// and the machine — not the skin — decides what else moves as a consequence. Guessing
// that a heater-voltage write cannot change a flush temperature is the kind of assumption
// that costs a stale screen and buys one avoided round trip. Both, always.
//
// THE BUG THE INVALIDATION EXISTS FOR, in the old module's own words: "Without it,
// Reset-to-defaults repainted the PRE-reset values under a toast that said it had
// worked." Reset-to-default is now HERE (`resetSettings`, 24 Aug 2026) and it is the
// caller `invalidate()` was left public for — "so that whoever builds it later has the
// correct hook and does not invent a second one".
//
// WHY THE F3/Q1 EXCLUSION NO LONGER HOLDS, stated rather than quietly dropped. That rule
// said "no work of any kind on reset-to-default", and it was written when the values a
// reset moves were mostly invisible in this skin. Read at the pin,
// `De1Controller.applySettingsDefaults` (`de1_controller.defaults.dart:110-122`) writes
// SEVEN values and nothing else:
//
//   fanThreshold 55 · heaterIdleTemp 95 · heaterPh1Flow 2.0 · heaterPh2Flow 4.0
//   heaterPh2Timeout 4.0 · refillKitSetting auto · flowEstimation 1.0 · steamPurgeMode 0
//
// Every one of those is a CONTROL on a page in this skin as of 24 August, and none of
// them is a profile, a calibration latch or anything a user cannot simply set again. It
// is not a factory reset of the machine; it is a reset of exactly the pages this pass
// built, and it is recoverable by hand from those same pages.
//
// AND WHAT IS NOT PORTED: the old `getDe1Settings` answered a failed request with EXPIRED
// cached data. A7 — that path does not exist here. A failed read returns the failure.
//
// CONTRACT, read at ReaPrime 2b047d02e42e29bf2d96a2aa964ef94e4a4daba3
// (`lib/src/services/webserver/de1handler.dart`, `De1Handler.addRoutes`):
//
//   GET  /api/v1/machine/settings           -> 200 {fan:int, usb:bool, flushTemp:double,
//                                              flushTimeout:double, flushFlow:double,
//                                              hotWaterFlow:double, steamFlow:double,
//                                              tankTemp:int, steamPurgeMode:int}
//   POST /api/v1/machine/settings           -> 202, no body. Any subset of the same keys.
//   GET  /api/v1/machine/settings/advanced  -> 200 {heaterPh1Flow, heaterPh2Flow,
//                                              heaterIdleTemp, heaterPh2Timeout,
//                                              heaterVoltage:int, refillKitSetting:int}
//   POST /api/v1/machine/settings/advanced  -> 202, no body. Any subset.
//
// ONE ASYMMETRY WORTH THE WORDS, because a schema-generated client gets it wrong: `usb`
// READS as a bool (`Future<bool> getUsbChargerMode()`, `de1_interface.dart`) and WRITES
// as the string 'enable' — the handler's test is `json['usb'] == 'enable'`, so any other
// string, and `true` itself, mean disable. `writeSettings` below encodes it; nothing
// above this module should ever spell 'enable'.

import { DE1_CACHE_SPECS, createTtlCache } from './rea-cache.js';

export const DE1_SETTINGS_PATH = '/machine/settings';
export const DE1_ADVANCED_SETTINGS_PATH = '/machine/settings/advanced';
export const DE1_SETTINGS_RESET_PATH = '/machine/settings/reset';

/** Keys `POST /machine/settings` reads. Anything else in the body is ignored by the handler. */
export const DE1_SETTINGS_WRITE_KEYS = Object.freeze([
    'usb', 'fan', 'flushTemp', 'flushFlow', 'flushTimeout',
    'hotWaterFlow', 'steamFlow', 'tankTemp', 'steamPurgeMode',
]);

/** Keys `POST /machine/settings/advanced` reads. */
export const DE1_ADVANCED_WRITE_KEYS = Object.freeze([
    'heaterPh1Flow', 'heaterPh2Flow', 'heaterIdleTemp',
    'heaterPh2Timeout', 'heaterVoltage', 'refillKitSetting',
]);

/**
 * EVERY ROUTE IN THE PINNED TREE WHOSE WRITE CHANGES A VALUE THESE CACHES HOLD.
 *
 * There are THREE, not two, and the third is the one the module header above did not
 * mention. `PUT /api/v1/workflow` (`workflow_handler.dart` `_applyUpdate`) calls
 * `De1Controller.updateWorkflowSettings`, which dispatches `_writeFlushSettings`
 * (`setFlushTimeout` / `setFlushFlow` / `setFlushTemperature`), `_writeSteamSettings`
 * (`setSteamFlow`) and `_writeHotWaterSettings` (`setHotWaterFlow`) — the backing values of
 * `flushTimeout`, `flushFlow`, `flushTemp`, `steamFlow` and `hotWaterFlow`, five of the
 * nine reads `GET /machine/settings` performs (`de1handler.dart`). So a workflow write with
 * no invalidation here reproduces `reatsettingscache` exactly: the settings screen reads
 * back PRE-CHANGE values for up to 60 s, under a UI that says the write worked.
 *
 * A grep of `lib/src/services/webserver` for those five setters at the pin returns exactly
 * these three writers. The list is data so the next reader re-checks it in one open, and it
 * is consulted from `transport.onWrite`, so no call site can forget to invalidate.
 */
export const DE1_SETTINGS_INVALIDATING_WRITES = Object.freeze([
    Object.freeze({
        method: 'POST',
        route: DE1_SETTINGS_PATH,
        handlerFile: 'lib/src/services/webserver/de1handler.dart',
        handlerSymbol: 'De1Handler.addRoutes (POST /api/v1/machine/settings)',
        changes: [...DE1_SETTINGS_WRITE_KEYS],
    }),
    Object.freeze({
        method: 'POST',
        route: DE1_ADVANCED_SETTINGS_PATH,
        handlerFile: 'lib/src/services/webserver/de1handler.dart',
        handlerSymbol: 'De1Handler.addRoutes (POST /api/v1/machine/settings/advanced)',
        changes: [...DE1_ADVANCED_WRITE_KEYS],
    }),
    Object.freeze({
        method: 'DELETE',
        route: DE1_SETTINGS_RESET_PATH,
        handlerFile: 'lib/src/services/webserver/de1handler.dart',
        handlerSymbol: 'De1Handler.addRoutes (DELETE /api/v1/machine/settings/reset) -> De1Controller.applySettingsDefaults',
        /* SEVEN VALUES, SPREAD OVER BOTH DOCUMENTS AND THE CALIBRATION ROUTE. That is
         * why the reset invalidates BOTH caches rather than one, and why it is in this
         * table at all: it is the third route whose success changes what they hold. */
        changes: [
            'fan', 'steamPurgeMode',
            'heaterIdleTemp', 'heaterPh1Flow', 'heaterPh2Flow', 'heaterPh2Timeout',
            'refillKitSetting',
        ],
    }),
    Object.freeze({
        method: 'PUT',
        route: '/workflow',
        handlerFile: 'lib/src/services/webserver/workflow_handler.dart',
        handlerSymbol: 'WorkflowHandler._applyUpdate -> De1Controller.updateWorkflowSettings',
        changes: ['flushTemp', 'flushTimeout', 'flushFlow', 'steamFlow', 'hotWaterFlow'],
    }),
]);

/** Does a successful write of this method+path change what these caches hold? */
export function writeInvalidatesDe1Settings(method, path) {
    if (typeof method !== 'string' || typeof path !== 'string') return false;
    const verb = method.toUpperCase();
    const clean = path.split('?')[0].replace(/\/+$/, '') || '/';
    const bare = clean.startsWith('/api/v1') ? clean.slice('/api/v1'.length) : clean;
    return DE1_SETTINGS_INVALIDATING_WRITES.some((row) => row.method === verb && row.route === bare);
}

const specOf = (key) => DE1_CACHE_SPECS.find((spec) => spec.key === key);

/**
 * @param {object} transport  from createReaTransport
 * @param {{now?: Function}} [options]
 */
export function createDe1SettingsClient(transport, { now = Date.now } = {}) {
    const caches = Object.freeze(Object.fromEntries(
        DE1_CACHE_SPECS.map((spec) => [spec.key, createTtlCache({ ...spec, now })]),
    ));

    const invalidate = () => {
        for (const cache of Object.values(caches)) cache.invalidate();
    };

    // Subscribed, not called from `write()` below, because the third invalidating route is
    // not this module's to call: whoever builds the workflow screen writes PUT /workflow
    // through the same transport and must not have to remember these caches exist.
    const unsubscribeWrites = transport && typeof transport.onWrite === 'function'
        ? transport.onWrite(({ method, path }) => {
            if (writeInvalidatesDe1Settings(method, path)) invalidate();
        })
        : null;
    if (unsubscribeWrites === null) {
        // Not a soft degrade: without the announcement a workflow write leaves these caches
        // stale for a minute and nothing says so. Refuse at construction instead.
        throw new Error(
            'createDe1SettingsClient: the transport must expose onWrite (see createReaTransport) — '
            + 'it is what invalidates these caches when PUT /workflow writes five of the nine '
            + 'values GET /machine/settings returns.',
        );
    }

    async function readThrough(cacheKey, path) {
        const cache = caches[cacheKey];
        const hit = cache.read();
        // Fresh only. `fresh: false` never carries a value — see rea-cache.js.
        if (hit.fresh) {
            // `fromCache` rather than `notModified`: 304 is a statement the SERVER made,
            // and conflating the two would let a screen report "checked, unchanged" for a
            // read that never left the tablet.
            return Object.freeze({
                ok: true,
                status: 200,
                data: hit.value,
                etag: null,
                notModified: false,
                fromCache: true,
                ageMs: hit.ageMs,
                method: 'GET',
                url: transport.url(path),
            });
        }
        const result = await transport.get(path, { conditional: false });
        if (result.ok) cache.write(result.data);
        return result;
    }

    async function write(path, body, keys) {
        const payload = pick(body, keys);
        const result = await transport.post(path, payload);
        // Write-through: only a SUCCESSFUL write invalidates. A rejected write changed
        // nothing on the machine, so dropping the cache would spend fifteen device reads
        // to re-learn what we already know.
        if (result.ok) invalidate();
        return result;
    }

    return Object.freeze({
        caches,
        invalidate,
        specs: DE1_CACHE_SPECS,
        invalidatingWrites: DE1_SETTINGS_INVALIDATING_WRITES,
        /** Drop the transport subscription. App teardown, and the end of every test. */
        stop() {
            unsubscribeWrites();
            invalidate();
        },
        readSettings: () => readThrough('machineSettings', DE1_SETTINGS_PATH),
        readAdvancedSettings: () => readThrough('machineSettingsAdvanced', DE1_ADVANCED_SETTINGS_PATH),
        /**
         * @param {object} settings  any subset of DE1_SETTINGS_WRITE_KEYS. `usb` is a
         *                           BOOLEAN here and is encoded for the handler.
         */
        writeSettings(settings) {
            const body = { ...settings };
            if ('usb' in body) body.usb = body.usb ? 'enable' : 'disable';
            return write(DE1_SETTINGS_PATH, body, DE1_SETTINGS_WRITE_KEYS);
        },
        writeAdvancedSettings(settings) {
            return write(DE1_ADVANCED_SETTINGS_PATH, settings, DE1_ADVANCED_WRITE_KEYS);
        },
        /**
         * `DELETE /api/v1/machine/settings/reset` — restore the seven the handler names.
         *
         * IT INVALIDATES ON SUCCESS, and that is the whole reason this belongs here
         * rather than at a call site: the old skin's reset "repainted the PRE-reset
         * values under a toast that said it had worked", because nothing dropped the
         * caches the reset had just made wrong. The write path above does the same for
         * every other write; this is the third route that changes what they hold.
         */
        async resetSettings() {
            const result = await transport.request(DE1_SETTINGS_RESET_PATH, { method: 'DELETE' });
            if (result.ok) invalidate();
            return result;
        },
        /** Diagnostics for the settings screen's own debug pane. Never a read path. */
        get cacheState() {
            return Object.freeze(Object.fromEntries(
                Object.entries(caches).map(([key, cache]) => [key, cache.state]),
            ));
        },
    });
}

/**
 * Send only the keys the handler reads. Not defensive scaffolding — the handler ignores
 * unknown keys, so this changes nothing on the wire; it keeps the request legible in a
 * capture and makes a typo in a caller visible as a missing effect rather than an
 * accepted no-op.
 */
function pick(source, keys) {
    const out = {};
    for (const key of keys) if (source && source[key] !== undefined) out[key] = source[key];
    return out;
}

export { specOf as de1CacheSpec };
