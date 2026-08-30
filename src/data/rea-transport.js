// THE TRANSPORT CORE — one client, injected, DOM-free, UI-free.
//
// SCOPE Part 3 §1 "The API client" / Part 6 gate 3. This is the skeleton the generated
// client and the socket connectors are built on; it owns four things and nothing else:
// where the server is, how a request is spelled, what a failure looks like, and when a
// GET may be conditional. Route knowledge lives above it. Frame knowledge lives beside it
// in rea-address.js. Painting lives nowhere near it.
//
// THREE DEFECTS IT IS SHAPED AGAINST, all verified at source in the old module:
//
//  1. THE CYCLE. `api.js:1` is `import * as ui from './ui.js'` and `ui.js:1` imports
//     twenty names back. The transport painted the machine-status label itself
//     (`api.js:273,:320,:330`) and raised toasts from inside upload failures. A transport
//     that can reach a screen grows a screen dependency, and then cannot be tested,
//     replaced or reasoned about. THIS MODULE IMPORTS NOTHING FROM src/components,
//     src/screens OR src/stores, and never will — test/rea-transport.test.mjs asserts it
//     over the source text of the whole src/data directory.
//
//  2. THE FROZEN BASE URL. `api.js:10-12` computed `API_BASE_URL` from
//     `localStorage.getItem('reaHostname')` and `window.location.hostname` AT IMPORT
//     TIME, into a module constant with no injection path. That is why the old API layer
//     needed an ESM loader hook to be testable at all. Here the base URL is a constructor
//     argument, the constructor throws without it, and `reaBaseUrl()` below is a pure
//     function over values the caller read — it does not read them itself. There is no
//     `window` and no `localStorage` in this file.
//
//  3. THE MANUFACTURED ANSWER. Five catch blocks in the old module turned a transport
//     failure into a plausible value (rea-errors.js lists them). A7: NEVER PORT A
//     FALLBACK PATH. There is no retry, no stale-cache-on-error, no `?? null`, no
//     `catch { return {} }`. A failure is returned as a failure and the caller decides.
//     A stale answer nobody asked for is exactly the defect class this wave exists to
//     kill.
//
// Contract discipline: every route this file itself addresses is declared in the wave's
// contract table, checked against the ReaPrime handler AS WRITTEN at
// 2b047d02e42e29bf2d96a2aa964ef94e4a4daba3. This module hard-codes no route at all — the
// only paths it knows are the conditional-route registry's, and that registry is
// re-derived from the handlers by test.

import { REA_ERROR, reaFailure, reaSuccess } from './rea-errors.js';
import { createEtagStore, isConditionalRoute } from './rea-conditional.js';

/** ReaPrime's HTTP port. Not a URL — the caller composes one. */
export const REA_PORT = 8080;

/** API prefix. Every REST route in the pinned tree begins with it. */
export const API_PREFIX = '/api/v1';

/** Default request deadline. The old module had one 6 s timeout on the LIGHTER of the two
 *  DE1 settings reads and none at all on the heavier one (E2 bug 9). One default, here. */
export const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Compose the REST base URL from values the CALLER read.
 *
 * Pure. Takes a hostname and protocol as arguments and reads no ambient state, which is
 * the whole point — the app shell reads `window.location` once, at startup, in a file
 * that is allowed to; tests pass a fake; nothing here changes behaviour by environment.
 *
 * @param {{hostname: string, protocol?: string, port?: number|string}} location
 */
export function reaBaseUrl({ hostname, protocol = 'http:', port = REA_PORT } = {}) {
    if (!hostname) throw new Error('reaBaseUrl: hostname is required');
    const scheme = protocol === 'https:' ? 'https:' : 'http:';
    return `${scheme}//${hostname}${port ? `:${port}` : ''}${API_PREFIX}`;
}

/**
 * Compose the WebSocket origin. ReaPrime serves `/ws/v1/...` from the same host and port.
 *
 * `wss:` for an https page, per the old module's `WS_PROTOCOL` — the one line of :13
 * worth keeping, minus the `window.location` read.
 */
export function reaSocketBase({ hostname, protocol = 'http:', port = REA_PORT } = {}) {
    if (!hostname) throw new Error('reaSocketBase: hostname is required');
    const scheme = protocol === 'https:' ? 'wss:' : 'ws:';
    return `${scheme}//${hostname}${port ? `:${port}` : ''}`;
}

/**
 * Template tag that percent-encodes every interpolated segment.
 *
 *     reaPath`/shots/${id}`          -> '/shots/2026-08-17T09%3A14%3A22Z'
 *     reaPath`/store/${ns}/${key}`   -> both encoded
 *
 * It exists because the old module had this bug twice over, in opposite directions:
 * `reconnectDevice` interpolated a device id into a query string raw (`api.js:123`) even
 * though `rest_v1.yml` warns in prose that device ids contain colons and slashes; and
 * there were TWO implementations of the same two KV routes, `getKVValue`/`setKVValue`
 * (encoded) and `getValueFromStore`/`setValueInStore` (NOT encoded), both live from
 * different callers, so a key containing '/', '#' or a space broke one and not the other.
 * A tag makes the safe spelling the short one.
 */
export function reaPath(strings, ...values) {
    return strings.reduce(
        (acc, literal, i) => acc + literal + (i < values.length ? encodeURIComponent(String(values[i])) : ''),
        '',
    );
}

/** Query string from an object; null/undefined are omitted, arrays repeat the key. */
export function reaQuery(query) {
    if (!query) return '';
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value === null || value === undefined) continue;
        if (Array.isArray(value)) {
            for (const item of value) if (item !== null && item !== undefined) params.append(key, String(item));
        } else {
            params.append(key, String(value));
        }
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}

const JSON_HEADERS = Object.freeze({ 'Content-Type': 'application/json' });

/**
 * Build the transport.
 *
 * @param {object} options
 * @param {Function} options.fetch          injected; never reaches for globalThis.fetch
 * @param {string} options.baseUrl          e.g. reaBaseUrl({hostname})
 * @param {string} [options.socketBaseUrl]  e.g. reaSocketBase({hostname})
 * @param {object} [options.logger]         optional; a diagnostic sink, never a UI
 * @param {number} [options.timeoutMs]
 * @param {object} [options.etagStore]      injected for tests; one per transport
 */
export function createReaTransport({
    fetch: fetchImpl,
    baseUrl,
    socketBaseUrl = null,
    logger = null,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    etagStore = createEtagStore(),
} = {}) {
    if (typeof fetchImpl !== 'function') {
        throw new Error('createReaTransport: a fetch implementation must be injected');
    }
    if (typeof baseUrl !== 'string' || !baseUrl) {
        // Deliberately fatal. The old module's silent default — window.location.hostname
        // at import time — is how the client became untestable.
        throw new Error('createReaTransport: baseUrl must be injected (see reaBaseUrl)');
    }
    const base = baseUrl.replace(/\/+$/, '');
    const log = logger && logger.scope ? logger.scope('rea') : logger;
    /** Subscribers to "a write succeeded". See `onWrite` below. */
    const writeListeners = new Set();

    const url = (path, query) => `${base}${path.startsWith('/') ? path : `/${path}`}${reaQuery(query)}`;

    /**
     * Tell every write listener a write landed.
     *
     * The SAME fact, offered to caches this module does not own. The etag store is not the
     * only cache a write can invalidate — the two DE1 settings TTL caches are the others —
     * and a write route that forgets to tell them is exactly how `reatsettingscache`
     * served pre-change values for 40 s. One announcement, at the one place every write
     * passes through, so no route can be forgotten.
     *
     * A FUNCTION SINCE THE STREAMED PATH ARRIVED: two returns now pass through here, and a
     * loop written twice is one of them quietly losing a listener.
     */
    function announceWrite({ method, path, status = 200, target }) {
        for (const listener of writeListeners) {
            try {
                listener(Object.freeze({ method, path, status, url: target }));
            } catch (err) {
                if (log && log.warn) log.warn(`write listener threw: ${err && err.message}`);
            }
        }
    }

    async function request(path, {
        method = 'GET',
        query = null,
        body = undefined,
        headers = null,
        conditional = 'auto',
        timeoutMs: perCall = timeoutMs,
        signal = null,
        /**
         * A BODY THAT IS NOT JSON, sent verbatim.
         *
         * ONE ROUTE NEEDS IT AND IT IS FIRMWARE. `POST /api/v1/machine/firmware` takes
         * `application/octet-stream` — the image itself — and JSON.stringify of a
         * Uint8Array is an object of numbered keys, which the machine would accept as a
         * body and flash as nonsense. Passing `raw` sends the value untouched and sets no
         * JSON content type; the caller states the type in `headers`.
         */
        raw = undefined,
        /**
         * A STREAMED ANSWER, LINE BY LINE.
         *
         * WHY THE TRANSPORT AND NOT THE CALLER. `POST /machine/firmware` and its `apply`
         * twin answer `application/x-ndjson` — one JSON object per line, from `erasing`
         * through `uploading` to `done`, held open for the whole flash. `JSON.parse` of
         * that whole body throws, so before this the only way to read it was a second
         * fetch somewhere else, which is a second transport with none of this one's
         * timeout, abort and write-invalidation behaviour.
         *
         * `onLine` IS CALLED PER OBJECT and the LAST object is what `data` carries, so a
         * caller that only wants the outcome ignores the callback and reads the result the
         * way it reads every other one. A line that is not JSON is skipped rather than
         * failing the whole read: the stream's contract is per line, and one malformed
         * progress tick must not lose the `done` behind it.
         */
        onLine = null,
        /**
         * WHAT THE BODY IS. `'json'` (the default) parses it; `'text'` hands it back as
         * the string it arrived as, and `data` is that string.
         *
         * ONE ROUTE FAMILY NEEDS IT AND IT IS THE ACCOUNT PROXY.
         * `GET /api/v1/account/proxy/support/api/<endpoint>` "relays the upstream status
         * code and body verbatim" (rest_v1.yml's own words) and documents its success
         * content as `application/octet-stream`, `format: binary`. It is a PASS-THROUGH:
         * whatever decentespresso.com answers is what arrives, and this skin cannot decide
         * what that is. Two of those answers are known and neither is JSON this parser can
         * take:
         *
         *   `support/api/email` answers a bare token, "0" for a refusal — which ReaPrime's
         *       own `emailSerialMismatch` tests as a STRING (`decent_account_service.dart`,
         *       `responseBody == '0'`). `JSON.parse('0')` happens to succeed and give the
         *       number zero, which is worse than failing: it silently turns "the mail was
         *       not sent" into a value a caller has to know to re-stringify.
         *
         *   `support/api/emails` answers JSON that is sometimes MALFORMED — an empty value
         *       after a key, `"subject": ,`. Slate repairs it with a regex before parsing
         *       (`settings.js` `talkDecentFetchEmails`), which is the only evidence anyone
         *       has of that endpoint's shape. `JSON.parse` throws on it, and the DECODE
         *       failure this module would return carries only `text.slice(0, 200)` — so
         *       the body is gone and the thread cannot be recovered from the error.
         *
         * WHY IT IS A TRANSPORT OPTION AND NOT A SECOND CLIENT. The alternative was for the
         * support store to `fetch` for itself, which would be a second transport with none
         * of this one's base URL, deadline, abort, conditional handling or write
         * announcement — the exact duplication this module's header refuses ("THIS MODULE
         * IMPORTS NOTHING FROM src/components, src/screens OR src/stores"). Reading a body
         * as text is transport work; deciding what the text MEANS is the caller's, and the
         * caller does it.
         *
         * IT IS NOT A FALLBACK PATH (A7). Nothing here retries, swallows or substitutes: a
         * `'text'` read of a failed response still returns the typed HTTP failure below,
         * and a body that cannot be READ is still a transport failure. The only thing that
         * changes is whether a successful body is handed over parsed or verbatim.
         */
        expect = 'json',
    } = {}) {
        if (expect !== 'json' && expect !== 'text') {
            throw new Error(`transport.request: expect must be 'json' or 'text', got ${String(expect)}`);
        }
        const target = url(path, query);
        const cacheKey = `${method} ${target}`;

        const wantsConditional = method === 'GET'
            && (conditional === true || (conditional === 'auto' && isConditionalRoute(path, query || {})));
        const stored = wantsConditional ? etagStore.get(cacheKey) : null;

        const sendsJson = body !== undefined && raw === undefined;
        const requestHeaders = { ...(sendsJson ? JSON_HEADERS : null), ...(headers || {}) };
        // Never '*': the server matches '*' unconditionally and would report "unchanged"
        // against a body we do not hold (json_response.dart).
        if (stored) requestHeaders['If-None-Match'] = stored.etag;

        const controller = new AbortController();
        let timedOut = false;
        const timer = perCall ? setTimeout(() => { timedOut = true; controller.abort(); }, perCall) : null;
        const onOuterAbort = () => controller.abort();
        if (signal) {
            if (signal.aborted) controller.abort();
            else signal.addEventListener('abort', onOuterAbort, { once: true });
        }

        // THE DEADLINE COVERS THE BODY, NOT JUST THE HEADERS. `fetch` resolves as soon as
        // the response head arrives; the body is streamed afterwards. Disarming the timer in
        // a `finally` on the fetch — which is what this did — left `await readBody(response)`
        // running under no deadline at all, with the AbortController out of scope: a server
        // that stalled after its headers hung the caller for ever despite `timeoutMs`. The
        // read that matters most is the one this wave singles out, GET /shots/<id> at ~221 KB
        // on tablet WiFi. So `disarm()` is called once, AFTER the body, on every path.
        let disarmed = false;
        const disarm = () => {
            if (disarmed) return;
            disarmed = true;
            if (timer) clearTimeout(timer);
            if (signal) signal.removeEventListener('abort', onOuterAbort);
        };

        let response;
        try {
            response = await fetchImpl(target, {
                method,
                headers: requestHeaders,
                body: raw !== undefined ? raw : (body === undefined ? undefined : JSON.stringify(body)),
                signal: controller.signal,
                // Manual revalidation only works if our own If-None-Match reaches the
                // wire and the 304 reaches us, rather than the browser HTTP cache
                // answering from its own copy. BENCH ITEM: confirmed by reading the fetch
                // spec, not yet observed on the tablet's WebView.
                ...(wantsConditional ? { cache: 'no-store' } : null),
            });
        } catch (cause) {
            disarm();
            return reaFailure(timedOut ? REA_ERROR.TIMEOUT : REA_ERROR.NETWORK, {
                message: timedOut ? `timed out after ${perCall} ms` : String(cause && cause.message || cause),
                method,
                url: target,
                cause: cause instanceof Error ? cause : null,
            });
        }

        if (response.status === 304) {
            disarm();
            if (stored) {
                return reaSuccess({ status: 304, data: stored.data, etag: stored.etag, notModified: true, method, url: target });
            }
            // Cannot happen while we only send If-None-Match from a stored etag. If it
            // does, something cleared the store mid-flight and the server has told us
            // nothing. It is an error, not a silent refetch: a silent refetch here is a
            // fallback path, and a fallback path is what hides the defect.
            return reaFailure(REA_ERROR.CONDITIONAL, {
                status: 304,
                message: '304 with no stored body for this URL',
                method,
                url: target,
            });
        }

        /* THE STREAM IS READ BEFORE THE ORDINARY BODY PATH, because it IS the body: a
         * caller asking for lines gets them as they arrive and gets the last one back as
         * `data`. Everything after this point — the failure shapes, the etag store, the
         * write announcement — is the same for both. */
        if (onLine && response.ok && response.body && typeof response.body.getReader === 'function') {
            const streamed = await readLines(response, onLine);
            disarm();
            if (!streamed.ok) {
                return reaFailure(timedOut ? REA_ERROR.TIMEOUT : REA_ERROR.NETWORK, {
                    status: response.status,
                    message: `stream could not be read: ${String(streamed.cause && streamed.cause.message || streamed.cause)}`,
                    method,
                    url: target,
                    cause: streamed.cause instanceof Error ? streamed.cause : null,
                });
            }
            if (method !== 'GET') {
                etagStore.clear();
                announceWrite({ method, path, status: response.status, target });
            }
            return reaSuccess({ status: response.status, data: streamed.last, method, url: target });
        }

        const read = await readBody(response);
        disarm();

        if (!read.ok) {
            // A BODY THAT COULD NOT BE READ IS NOT AN EMPTY BODY. The old spelling here was
            // `catch { return '' }`, which turned a socket that hung up mid-body into
            // `{ok: true, status: 200, data: null}` — a manufactured answer, indistinguishable
            // at the call site from the bodyless 202 the write routes really do return. It is
            // reported as the transport failure it is, on a 2xx and on a 4xx/5xx alike: on a
            // failed status the `problem` body is precisely what we do NOT have, and inventing
            // a null one would lose the fact that the refusal's reason went unread.
            return reaFailure(timedOut ? REA_ERROR.TIMEOUT : REA_ERROR.NETWORK, {
                status: response.status,
                message: timedOut
                    ? `timed out after ${perCall} ms reading the response body`
                    : `response body could not be read: ${String(read.cause && read.cause.message || read.cause)}`,
                method,
                url: target,
                cause: read.cause instanceof Error ? read.cause : null,
            });
        }
        const text = read.text;

        if (!response.ok) {
            return reaFailure(REA_ERROR.HTTP, {
                status: response.status,
                message: `${method} ${path} -> ${response.status}`,
                problem: parseProblem(text),
                method,
                url: target,
            });
        }

        let data = null;
        if (expect === 'text') {
            /* VERBATIM, INCLUDING AN EMPTY ONE. `''` is what a bodyless 200 reads as and it
             * is a real answer for a relay — the caller is the only thing that knows
             * whether an empty upstream body means anything. It is deliberately NOT
             * collapsed to `null` the way the JSON branch leaves an empty body: `null` and
             * `''` are different facts and only the caller can tell them apart. */
            data = text;
        } else if (text !== '' && text !== null) {
            try {
                data = JSON.parse(text);
            } catch (cause) {
                return reaFailure(REA_ERROR.DECODE, {
                    status: response.status,
                    message: 'response body was not JSON',
                    problem: typeof text === 'string' ? text.slice(0, 200) : null,
                    method,
                    url: target,
                    cause: cause instanceof Error ? cause : null,
                });
            }
        }

        const etag = headerOf(response, 'etag');
        if (wantsConditional && etag) etagStore.set(cacheKey, etag, data);

        // A write can change any list. Rather than guess which — guessing is how the old
        // module ended up invalidating one cache in one code path and none anywhere else
        // (E2 bug 4) — every successful write drops the whole revalidation store. It costs
        // one full body on the next read of each list and cannot be wrong.
        if (method !== 'GET') {
            etagStore.clear();
            announceWrite({ method, path, status: response.status, target });
        }

        if (log && log.debug) log.debug(`${method} ${path} ${response.status}`);
        return reaSuccess({ status: response.status, data, etag, method, url: target });
    }

    return Object.freeze({
        baseUrl: base,
        socketBaseUrl,
        etagStore,
        url,
        request,
        /**
         * Observe every SUCCESSFUL non-GET, as `{method, path, status, url}`.
         *
         * Not an event bus in waiting: it has exactly one subscriber (the DE1 settings
         * caches) and exists because cache invalidation must not be a thing a call site can
         * forget. Failed writes are not announced — they changed nothing on the machine.
         *
         * @returns {() => void} unsubscribe
         */
        onWrite(listener) {
            if (typeof listener !== 'function') throw new Error('transport.onWrite: a listener is required');
            writeListeners.add(listener);
            return () => writeListeners.delete(listener);
        },
        get: (path, options) => request(path, { ...options, method: 'GET' }),
        post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
        put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
        del: (path, options) => request(path, { ...options, method: 'DELETE' }),
        /** Compose a socket URL. Throws if no socket base was injected. */
        socketUrl(path) {
            if (!socketBaseUrl) throw new Error('createReaTransport: socketBaseUrl was not injected');
            return `${socketBaseUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
        },
    });
}

/**
 * `response.text()` if there is one; a bodyless response reads as ''.
 *
 * Returns an OUTCOME, never a value with the failure erased. A response object with no
 * `text` method genuinely carries no body (the injected fakes, and a 204/202); a `text()`
 * that REJECTS is a transport failure mid-body and is handed back as one.
 *
 * @returns {{ok: true, text: string}|{ok: false, cause: unknown}}
 */
/**
 * Read an `application/x-ndjson` body line by line.
 *
 * ONE JSON OBJECT PER LINE, and the stream stays open for as long as the operation runs —
 * a firmware flash holds it for a minute or more, emitting `erasing`, then `uploading`
 * with a progress fraction, then `done` or `error`. There is no other route in ReaPrime
 * shaped like this, and that is why the reader is here rather than generalised.
 *
 * A MALFORMED LINE IS SKIPPED, NOT FATAL. The contract is per line; losing the `done`
 * behind one bad progress tick would turn a finished flash into a hung one. A body that
 * cannot be READ at all is a different thing and is reported.
 *
 * THE LAST OBJECT IS THE ANSWER, so a caller that wants only the outcome ignores `onLine`.
 *
 * @returns {{ok: true, last: object|null, count: number}|{ok: false, cause: unknown}}
 */
async function readLines(response, onLine) {
    const reader = response.body.getReader();
    const decode = new TextDecoder();
    let buffer = '';
    let last = null;
    let count = 0;
    const take = (line) => {
        const text = line.trim();
        if (!text) return;
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            return;
        }
        last = parsed;
        count += 1;
        try {
            onLine(parsed);
        } catch {
            /* A listener that throws must not end the stream it is watching. */
        }
    };
    try {
        for (;;) {
            // eslint-disable-next-line no-await-in-loop
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decode.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) take(line);
        }
    } catch (cause) {
        return { ok: false, cause };
    }
    /* THE TAIL. A stream that ended without a trailing newline still has one object in
     * the buffer, and on this route that object is `done` — the one that matters most. */
    take(buffer);
    return { ok: true, last, count };
}

async function readBody(response) {
    if (typeof response.text !== 'function') return { ok: true, text: '' };
    try {
        return { ok: true, text: await response.text() };
    } catch (cause) {
        return { ok: false, cause };
    }
}

/** ReaPrime answers client errors as {"error": ..., "message"?: ...}. Keep it verbatim. */
function parseProblem(text) {
    if (typeof text !== 'string' || text === '') return null;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function headerOf(response, name) {
    const headers = response.headers;
    if (!headers) return null;
    if (typeof headers.get === 'function') return headers.get(name);
    return headers[name] ?? headers[name.toLowerCase()] ?? null;
}
