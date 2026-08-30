// The ReaPrime KV backend — one namespace of `/api/v1/store`, in the shape the storage
// router expects (`{ get, set, remove }` over physical keys, JSON-able values).
//
// This is the only file in the storage substrate that knows an endpoint exists, which is
// why it sits in src/data/ (the ReaPrime address layer) and not in src/lib/ with the
// router. Paths and verbs below are transcribed from ReaPrime's handler:
//
//   GET    /api/v1/store/<namespace>          -> array of key strings (?full=1 -> values)
//   GET    /api/v1/store/<namespace>/<key>    -> the stored JSON value
//   POST   /api/v1/store/<namespace>/<key>    -> body is the JSON value
//   DELETE /api/v1/store/<namespace>/<key>
//     (kv_store_handler.dart:7-51, read 17 Aug 2026)
//
// CONTRACT OWNERSHIP: w0b's contract table owns verifying these against the handler as a
// build gate (SCOPE Part 3 §7; Part 8 Gate D). Nothing here hard-codes a RESPONSE SHAPE
// beyond "the body is the value" — the router passes values through opaquely — so the
// only things w0b has to confirm are the four path/verb rows above and the three
// behaviours noted inline (missing-key encoding, 204-vs-body on write, and the REQUEST
// side's null hole below: the handler's `jsonDecode(body) ?? body` turns a JSON null into
// the literal string 'null', so "opaque passthrough" does not hold in that one direction).
//
// Two defects from the old skin are deliberately not repeated:
//   * it had TWO implementations of these routes, `getKVValue`/`setKVValue` (encoded) and
//     `getValueFromStore`/`setValueInStore` (NOT encoded), both live — so a key containing
//     '/', '#' or a space broke one path and not the other. There is one here, and it
//     encodes.
//   * a transport failure was thrown from some paths and swallowed in others. Here a
//     failure is logged and surfaced: reads report absent, writes reject so the router
//     resolves false.

/** Path segment of the KV store, relative to the API base. */
export const KV_STORE_PATH = 'store';

/** Default API base. Injected in the app; a constant only so tests do not invent one. */
export const DEFAULT_API_BASE = '/api/v1';

/**
 * @param {object} options
 * @param {string} options.namespace       e.g. 'decal' or 'decal.numpad'
 * @param {Function} options.fetch         injected — never reaches for globalThis.fetch
 * @param {string} [options.baseUrl]       e.g. 'http://machine:3000/api/v1'
 * @param {object} [options.logger]
 */
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
            // A key that was never written: ReaPrime answers 200 with a NULL BODY
            // (`jsonOk(await store.get(...))`, kv_store_handler.dart) — the null below is
            // the whole absence signal. The 404 branch that used to sit here was ported
            // from the old skin's expectation and was DEAD: the handler was read in full at
            // the pin and spells no `jsonNotFound` anywhere, so nothing could ever take it.
            // A7 — a fallback for a status the server does not send hides the day it starts
            // sending one. `test/gate-d.test.mjs` asserts the handler still has no 404 path.
            if (!response.ok) {
                throw new Error(`KV read failed: ${response.status} ${nsPath}/${key}`);
            }
            const value = await response.json();
            return value === null ? undefined : value;
        },

        async set(key, value) {
            // A NULL BODY IS NOT STORABLE THROUGH THIS HANDLER, and it does not fail
            // loudly on its own — which is why this refuses rather than sends.
            // kv_store_handler.dart:40-48 does `final maybeJson = jsonDecode(value);
            // ... value: maybeJson ?? value`, and `jsonDecode('null')` is null, so the
            // `??` falls through to the RAW BODY STRING and the store ends up holding
            // the four characters 'null'. The next get() returns that string, and the
            // router only treats undefined/null as absent — so a deleted setting comes
            // back as a present, truthy one. The router routes null to remove() before
            // reaching this, so this is the belt for anyone using the backend directly.
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

        /**
         * Enumerate this namespace's keys. Not used by the router; kept because the route
         * exists and a settings/debug view wants it.
         *
         * IT THROWS, like every other method here. It used to log a failure at warn and
         * return `[]`, and a non-array body was coerced to `[]` too — a dead server and a
         * shape this build cannot read both rendering as "the namespace is empty", which is
         * SCOPE Part 3 §7's CB-21 verbatim and contradicts this module's own header ("a
         * failure is logged and surfaced"). An empty namespace is a real answer and the
         * server gives it as `[]`; nothing else may spell it.
         *
         * CAVEAT, verified ReaPrime-side and NOT worked around here (SCOPE Part 3 §5):
         * namespace enumeration only sees namespaces touched since boot, so a backup can
         * omit a namespace that exists on disk. That is upstream work, not a skin fix.
         */
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
