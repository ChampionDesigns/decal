

/** Path segment of the KV store, relative to the API base. */
export const KV_STORE_PATH = 'store';

/** Default API base. Injected in the app; a constant only so tests do not invent one. */
export const DEFAULT_API_BASE = '/api/v1';

export function createReaKvBackend({ namespace, fetch: fetchImpl, baseUrl = DEFAULT_API_BASE, logger } = {}) {
    if (!namespace) throw new Error('rea-kv-backend: a namespace is required');
    if (typeof fetchImpl !== 'function') throw new Error('rea-kv-backend: a fetch implementation is required');
    const log = logger && logger.scope ? logger.scope('kv') : logger;

    const base = baseUrl.replace(/\/+$/, '');
    const nsPath = `${base}/${KV_STORE_PATH}/${encodeURIComponent(namespace)}`;
    const keyPath = (key) => `${nsPath}/${encodeURIComponent(key)}`;

    return {
        kind: `rea-kv:${namespace}`,
        namespace,

        async get(key) {
            const response = await fetchImpl(keyPath(key), { method: 'GET' });
            if (!response.ok) {
                throw new Error(`KV read failed: ${response.status} ${nsPath}/${key}`);
            }
            const value = await response.json();
            return value === null ? undefined : value;
        },

        async set(key, value) {
            if (value === undefined || value === null) {
                throw new TypeError(
                    `rea-kv-backend: refusing to store ${value} at '${key}' — ReaPrime's handler `
                    + 'turns a JSON null body into the literal string "null". Delete the key instead.',
                );
            }
            const response = await fetchImpl(keyPath(key), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(value),
            });
            // The handler answers jsonOk({}) — a body, not 204. Nothing here reads it.
            if (!response.ok) {
                throw new Error(`KV write failed: ${response.status} ${nsPath}/${key}`);
            }
        },

        async remove(key) {
            const response = await fetchImpl(keyPath(key), { method: 'DELETE' });
            if (!response.ok) {
                throw new Error(`KV delete failed: ${response.status} ${nsPath}/${key}`);
            }
        },

        async keys() {
            const response = await fetchImpl(nsPath, { method: 'GET' });
            if (!response.ok) {
                if (log) log.warn(`KV key enumeration failed: ${response.status} ${nsPath}`);
                throw new Error(`KV key enumeration failed: ${response.status} ${nsPath}`);
            }
            const body = await response.json();
            if (!Array.isArray(body)) {
                if (log) log.warn(`KV key enumeration answered a non-array body: ${nsPath}`);
                throw new TypeError(
                    `KV key enumeration answered a shape this build cannot read at ${nsPath} — `
                    + 'the handler returns `jsonOk(await store.keys(...))`, an array of strings.',
                );
            }
            return body;
        },
    };
}
