

import { REA_ERROR, reaFailure, reaSuccess } from './rea-errors.js';
import { createEtagStore, isConditionalRoute } from './rea-conditional.js';

/** ReaPrime's HTTP port. Not a URL — the caller composes one. */
export const REA_PORT = 8080;

/** API prefix. Every REST route in the pinned tree begins with it. */
export const API_PREFIX = '/api/v1';

/** Default request deadline. The old module had one 6 s timeout on the LIGHTER of the two
 *  DE1 settings reads and none at all on the heavier one (E2 bug 9). One default, here. */
export const DEFAULT_TIMEOUT_MS = 10000;

export function reaBaseUrl({ hostname, protocol = 'http:', port = REA_PORT } = {}) {
    if (!hostname) throw new Error('reaBaseUrl: hostname is required');
    const scheme = protocol === 'https:' ? 'https:' : 'http:';
    return `${scheme}//${hostname}${port ? `:${port}` : ''}${API_PREFIX}`;
}

export function reaSocketBase({ hostname, protocol = 'http:', port = REA_PORT } = {}) {
    if (!hostname) throw new Error('reaSocketBase: hostname is required');
    const scheme = protocol === 'https:' ? 'wss:' : 'ws:';
    return `${scheme}//${hostname}${port ? `:${port}` : ''}`;
}

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
        throw new Error('createReaTransport: baseUrl must be injected (see reaBaseUrl)');
    }
    const base = baseUrl.replace(/\/+$/, '');
    const log = logger && logger.scope ? logger.scope('rea') : logger;
    /** Subscribers to "a write succeeded". See `onWrite` below. */
    const writeListeners = new Set();

    const url = (path, query) => `${base}${path.startsWith('/') ? path : `/${path}`}${reaQuery(query)}`;

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
        raw = undefined,
        onLine = null,
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
        if (stored) requestHeaders['If-None-Match'] = stored.etag;

        const controller = new AbortController();
        let timedOut = false;
        const timer = perCall ? setTimeout(() => { timedOut = true; controller.abort(); }, perCall) : null;
        const onOuterAbort = () => controller.abort();
        if (signal) {
            if (signal.aborted) controller.abort();
            else signal.addEventListener('abort', onOuterAbort, { once: true });
        }

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
            return reaFailure(REA_ERROR.CONDITIONAL, {
                status: 304,
                message: '304 with no stored body for this URL',
                method,
                url: target,
            });
        }

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
