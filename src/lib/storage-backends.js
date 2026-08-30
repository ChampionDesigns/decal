

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
