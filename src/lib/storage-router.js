/**
 * The storage router — the ONE owner of every persisted key in Decal.
 */

import {
    STORAGE_ROUTES,
    STORAGE_PREFIX,
    LAYERS,
    PREFIXED_LAYERS,
    KV_NAMESPACES,
    routeFor,
    allKeys,
    expandTemplate,
} from './storage-routes.js';

export const ERROR_CODES = Object.freeze({
    UNKNOWN_KEY: 'UNKNOWN_KEY',
    PREFIXED_KEY: 'PREFIXED_KEY',
    NOT_ROUTED: 'NOT_ROUTED',
    NO_BACKEND: 'NO_BACKEND',
    BAD_TEMPLATE: 'BAD_TEMPLATE',
});

export class StorageRouterError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.name = 'StorageRouterError';
        this.code = code;
        Object.assign(this, details);
    }
}

const NOOP_LOGGER = Object.freeze({
    debug() {}, info() {}, warn() {}, error() {},
});

export function createStorageRouter({ backends = {}, routes = STORAGE_ROUTES, logger = NOOP_LOGGER } = {}) {
    const log = logger.scope ? logger.scope('storage') : logger;
    const listeners = new Set();
    const readFailureListeners = new Set();

    function resolve(key, params) {
        if (typeof key !== 'string' || key.length === 0) {
            throw new StorageRouterError(
                ERROR_CODES.UNKNOWN_KEY,
                'storage: key must be a non-empty string',
                { key },
            );
        }
        if (key.startsWith(STORAGE_PREFIX)) {
            throw new StorageRouterError(
                ERROR_CODES.PREFIXED_KEY,
                `storage: '${key}' already carries the '${STORAGE_PREFIX}' prefix — pass the logical key ('${key.slice(STORAGE_PREFIX.length)}'); the router adds the prefix`,
                { key },
            );
        }
        const row = routeFor(key, routes);
        if (!row) {
            throw new StorageRouterError(
                ERROR_CODES.UNKNOWN_KEY,
                `storage: no route for '${key}' — every persisted key needs a row in storage-routes.js (one owner per setting)`,
                { key },
            );
        }
        if (row.layer === LAYERS.none) {
            throw new StorageRouterError(
                ERROR_CODES.NOT_ROUTED,
                `storage: '${key}' is not Decal's to store. Owner: ${row.owner}`,
                { key, owner: row.owner, row },
            );
        }
        let physical;
        try {
            physical = row.template ? expandTemplate(row.template, params) : key;
        } catch (error) {
            throw new StorageRouterError(
                ERROR_CODES.BAD_TEMPLATE,
                `storage: '${key}' is a key family ('${row.template}') — ${error.message}`,
                { key, template: row.template },
            );
        }
        if (PREFIXED_LAYERS.includes(row.layer)) physical = STORAGE_PREFIX + physical;

        const backend = backends[row.layer];
        if (!backend) {
            throw new StorageRouterError(
                ERROR_CODES.NO_BACKEND,
                `storage: no backend wired for layer '${row.layer}' (key '${key}')`,
                { key, layer: row.layer },
            );
        }
        return { row, physical, backend };
    }

    return {
        async get(key, { params, fallback } = {}) {
            const { row, physical, backend } = resolve(key, params);
            const scope = params ? Object.freeze({ ...params }) : null;
            try {
                const value = await backend.get(physical);
                if (value === undefined || value === null) return fallback;
                return value;
            } catch (error) {
                log.error(`read failed for '${key}' on layer '${row.layer}'`, error);
                for (const listener of readFailureListeners) {
                    try {
                        listener(Object.freeze({ key, layer: row.layer, error,
                            ...(scope ? { params: scope, physical } : null) }));
                    } catch (own) {
                        log.error('a read-failure listener threw', own);
                    }
                }
                return fallback;
            }
        },

        async set(key, value, { params } = {}) {
            if (value === undefined || value === null) {
                log.debug(`'${key}' was set to ${value}; the router cannot store an absent value, so it is removed instead`);
                return removeKey(key, params);
            }
            const { row, physical, backend } = resolve(key, params);
            try {
                await backend.set(physical, value);
                emit({ key, layer: row.layer, physical, value });
                return true;
            } catch (error) {
                log.error(`write failed for '${key}' on layer '${row.layer}' — the value is NOT stored anywhere`, error);
                return false;
            }
        },

        /** Delete one key. Same failure contract as set(). */
        async remove(key, { params } = {}) {
            return removeKey(key, params);
        },

        onChange(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },

        /** Called with {key, layer, error} — and {params, physical} when the route takes them. */
        onReadFailure(listener) {
            readFailureListeners.add(listener);
            return () => readFailureListeners.delete(listener);
        },

        /** The row behind a key, for diagnostics. Undefined for an unknown key. */
        routeFor: (key) => routeFor(key, routes),

        /** The physical key a logical key resolves to. Throws exactly as get/set do. */
        physicalKey(key, params) {
            return resolve(key, params).physical;
        },

        /** The whole table, flattened — for a settings debug panel and for tests. */
        describe() {
            return allKeys(routes).map((key) => {
                const row = routes[key];
                return {
                    key,
                    layer: row.layer,
                    scope: row.scope,
                    status: row.status,
                    namespace: KV_NAMESPACES[row.layer],
                    physical: PREFIXED_LAYERS.includes(row.layer)
                        ? STORAGE_PREFIX + (row.template || key)
                        : (row.layer === LAYERS.none ? null : (row.template || key)),
                    owner: row.owner,
                };
            });
        },

        /**
         * Layers this table needs that nobody wired. Call it once at boot and log loudly:
         * a missing backend should be a startup finding, not a mystery at the first write.
         */
        missingLayers() {
            const needed = new Set();
            for (const key of allKeys(routes)) {
                const { layer } = routes[key];
                if (layer !== LAYERS.none && !backends[layer]) needed.add(layer);
            }
            return [...needed].sort();
        },
    };

    function emit(event) {
        for (const listener of listeners) {
            try {
                listener(event);
            } catch (error) {
                log.error('a storage change listener threw', error);
            }
        }
    }

    async function removeKey(key, params) {
        const { row, physical, backend } = resolve(key, params);
        try {
            await backend.remove(physical);
            emit({ key, layer: row.layer, physical, value: undefined });
            return true;
        } catch (error) {
            log.error(`delete failed for '${key}' on layer '${row.layer}'`, error);
            return false;
        }
    }
}
