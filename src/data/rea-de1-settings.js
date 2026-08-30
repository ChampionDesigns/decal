/**
 * The two DE1 settings reads — the only two cached routes in Decal.
 */

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

    const unsubscribeWrites = transport && typeof transport.onWrite === 'function'
        ? transport.onWrite(({ method, path }) => {
            if (writeInvalidatesDe1Settings(method, path)) invalidate();
        })
        : null;
    if (unsubscribeWrites === null) {
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

function pick(source, keys) {
    const out = {};
    for (const key of keys) if (source && source[key] !== undefined) out[key] = source[key];
    return out;
}

export { specOf as de1CacheSpec };
