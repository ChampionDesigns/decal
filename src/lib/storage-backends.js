// Storage backends — the dumb key/value ports the router writes through.
//
// A backend is `{ get(physicalKey), set(physicalKey, value), remove(physicalKey) }`,
// sync or async, dealing in JSON-able values. It knows nothing about routing, prefixes or
// scopes: the router owns all three. Keeping them this dumb is what makes "route by table"
// testable — a fake backend is four lines.
//
// DOM-free by injection: `globalThis.localStorage` never appears; the caller passes the
// store object in. That is what lets the whole set run under node:test with no browser.
//
// The ReaPrime KV backend lives in `src/data/rea-kv-backend.js` — it is the only piece
// that knows an endpoint, and endpoints are the address layer's business.

/** In-memory store. The private-mode fallback, and the tests' double. */
export function createMemoryBackend(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
        kind: 'memory',
        get(key) { return map.has(key) ? map.get(key) : undefined; },
        set(key, value) { map.set(key, value); },
        remove(key) { map.delete(key); },
        // test/diagnostic affordances, not part of the backend contract
        snapshot() { return Object.fromEntries(map); },
        size() { return map.size; },
    };
}

/**
 * A Web Storage backend (localStorage / sessionStorage), with the two failure modes the
 * old module got wrong:
 *
 *   1. ABSENT STORE. `storage-keys.js:20-22` threw `${name} is unavailable` — in a
 *      private-mode WebView that is an uncaught throw at first read. Here an absent or
 *      unusable store degrades to memory, once, with one warning. SCOPE Part 3 §5: "the
 *      replacement degrades to an in-memory store instead."
 *   2. FAILING WRITE. A quota or security failure is logged and reported to the router as
 *      a rejection, so `set()` resolves false. It is never swallowed, and it never
 *      re-routes the value to another layer.
 *
 * Values are JSON — Web Storage only holds strings, so this is where the serialisation
 * lives. A value that will not parse is a corrupt entry: warn and report absent, rather
 * than hand a caller a string where it expects an object.
 *
 * @param {object} options
 * @param {Storage} [options.storage]  the store object; falsy or throwing -> memory
 * @param {object}  [options.logger]
 * @param {string}  [options.label]    'localStorage' | 'sessionStorage', for messages
 */
export function createWebStorageBackend({ storage, logger, label = 'webStorage' } = {}) {
    const log = logger && logger.scope ? logger.scope('storage') : (logger || null);
    const fallback = createMemoryBackend();
    let degraded = false;
    let usable = null; // null = not yet probed

    function warnOnce(reason) {
        if (degraded) return;
        degraded = true;
        if (log) {
            log.warn(
                `${label} is unavailable (${reason}) — falling back to an in-memory store. ` +
                'Settings will not survive a reload on this device.',
            );
        }
    }

    function store() {
        if (usable === null) {
            try {
                // Touching the property can itself throw in a locked-down WebView.
                usable = Boolean(storage) && typeof storage.getItem === 'function';
                if (!usable) warnOnce('absent');
            } catch (error) {
                usable = false;
                warnOnce(error && error.message ? error.message : 'threw on access');
            }
        }
        return usable ? storage : null;
    }

    return {
        kind: label,
        get isDegraded() { return degraded; },

        get(key) {
            const s = store();
            if (!s) return fallback.get(key);
            let raw;
            try {
                raw = s.getItem(key);
            } catch (error) {
                warnOnce(error && error.message ? error.message : 'threw on read');
                return fallback.get(key);
            }
            if (raw === null || raw === undefined) return undefined;
            try {
                return JSON.parse(raw);
            } catch (error) {
                if (log) log.warn(`${label}: '${key}' is not valid JSON — treating it as absent`, error);
                return undefined;
            }
        },

        set(key, value) {
            const s = store();
            if (!s) return fallback.set(key, value);
            // Throws propagate to the router, which logs and reports false. A failed write
            // must be visible; it must NOT be retried into a different layer.
            s.setItem(key, JSON.stringify(value));
            return undefined;
        },

        remove(key) {
            const s = store();
            if (!s) return fallback.remove(key);
            s.removeItem(key);
            return undefined;
        },
    };
}

/**
 * A backend that stores nothing and says so. Use it where a layer is deliberately not
 * wired yet, so the failure is a clear log line rather than a silent no-op.
 */
export function createNullBackend({ logger, label = 'null' } = {}) {
    const log = logger && logger.scope ? logger.scope('storage') : logger;
    return {
        kind: `null:${label}`,
        get() { return undefined; },
        set(key) {
            if (log) log.warn(`${label} backend is not wired — '${key}' was not stored`);
        },
        remove() {},
    };
}
