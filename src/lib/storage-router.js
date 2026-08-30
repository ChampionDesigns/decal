// The storage router (B7) — the ONE owner of every persisted key in Decal.
//
// Nothing else in the tree calls localStorage, sessionStorage or the ReaPrime KV routes.
// A call site names a logical key; the router looks its layer up in `storage-routes.js`
// and talks to exactly one backend. The layer is looked up, not chosen at the call site,
// and there is no path on which a value reaches two layers.
//
// SCOPE Part 3 §5: "The rewrite's storage module is a routing table — key -> layer — so
// every key has exactly one home and the layer is looked up, not chosen at each call
// site." And: "two stores plus any read-priority rule equals a path where a failed write
// wins" — so this module has no read-priority rule to have.
//
// Three corrections to the module it replaces (`storage-keys.js`, CARRY_FORWARD entry):
//   1. it is a routing table, not a prefix helper;
//   2. it never throws because a browser store is absent — a private-mode WebView gets an
//      in-memory store and one warning, not an uncaught throw at first read;
//   3. nothing bypasses it. (The one deliberate exception is the pre-paint theme stamp in
//      index.html, which cannot import anything before first paint; a test pins its
//      hand-written copy of the prefix to STORAGE_PREFIX.)
//
// DOM-free: browser globals never appear here. Backends are injected.
//
// Async everywhere, on purpose: the caller must not be able to tell from the shape of the
// call whether a key lives locally or in ReaPrime's KV store. That is what lets a row move
// between layers without touching a single call site.

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

/**
 * @param {object} options
 * @param {object} options.backends   layer id -> backend. A backend is
 *        `{ get(key), set(key, value), remove(key) }`, sync or async, keyed by PHYSICAL
 *        key, dealing in JSON-able values. `undefined` means absent.
 * @param {object} [options.routes]   the routing table (injectable for tests).
 * @param {object} [options.logger]   anything with debug/info/warn/error.
 */
export function createStorageRouter({ backends = {}, routes = STORAGE_ROUTES, logger = NOOP_LOGGER } = {}) {
    const log = logger.scope ? logger.scope('storage') : logger;
    const listeners = new Set();

    function resolve(key, params) {
        if (typeof key !== 'string' || key.length === 0) {
            throw new StorageRouterError(
                ERROR_CODES.UNKNOWN_KEY,
                'storage: key must be a non-empty string',
                { key },
            );
        }
        if (key.startsWith(STORAGE_PREFIX)) {
            // The router owns the prefix. A caller passing a physical key is how the old
            // skin ended up with `slate.profileFoldersOpen` as a *logical* key.
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
                `storage: no route for '${key}' — every persisted key needs a row in storage-routes.js (B7: one owner per setting)`,
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
        /**
         * Read one key. Never throws on a backend failure — a broken read must not take a
         * screen down — but always logs, because a swallowed failure is the bug this
         * module exists to remove. Returns `fallback` (default undefined) when absent.
         */
        async get(key, { params, fallback } = {}) {
            const { row, physical, backend } = resolve(key, params);
            try {
                const value = await backend.get(physical);
                if (value === undefined || value === null) return fallback;
                return value;
            } catch (error) {
                log.error(`read failed for '${key}' on layer '${row.layer}'`, error);
                return fallback;
            }
        },

        /**
         * Write one key to its ONE layer. Resolves true on success, false on a backend
         * failure — and on failure writes NOWHERE ELSE. There is deliberately no
         * "fall back to localStorage": that is precisely the dual-write bug.
         *
         * NULL AND UNDEFINED DELETE, they do not store. `get()` above already collapses
         * both to "absent" (a stored null is unreadable through this router by
         * construction), so storing one could only ever produce a value nothing can
         * read — and on the KV layer it produces something WORSE than unreadable.
         * ReaPrime's handler does `jsonDecode(body) ?? body` (kv_store_handler.dart:41-48),
         * and `jsonDecode('null')` is null, so the `??` falls through to the RAW BODY
         * STRING: `set(key, null)` lands the four-character string 'null' in the store,
         * which reads back as a present, truthy setting. Routing null to remove() closes
         * that for every backend at once rather than per-backend.
         */
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

        /**
         * Notify on every successful write or delete. This is the seam the settings store
         * (Gate 4 / wave 5.4) fans out from — the router itself stays non-reactive.
         */
        onChange(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
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

    /* Shared by remove() and by set()'s null path. A free function, not `this.remove`:
     * the returned object is routinely destructured (`const { set } = storage`), and a
     * `this` reference would turn that into a TypeError at the first null write. */
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
