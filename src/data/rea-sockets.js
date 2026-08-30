/**
 * The socket layer: one reconnecting channel per feed, opened by key and handed to a store as a subscription.
 */

import { createFanout } from './rea-fanout.js';
import { WS_MESSAGE, classifyMessage, channelForPath } from './rea-ws-channels.js';
import ReconnectingWebSocket from '../../vendor/reconnecting-websocket.js';

/** Channel lifecycle states. `unavailable` is a verdict, not an error. */
export const WS_STATE = Object.freeze({
    IDLE: 'idle',
    CONNECTING: 'connecting',
    OPEN: 'open',
    UNAVAILABLE: 'unavailable',
});

/** Signal kinds this layer raises, alongside the WS_MESSAGE kinds it forwards. */
export const WS_SIGNAL = Object.freeze({
    OPEN: 'open',
    CLOSE: 'close',
    CONNECTING: 'connecting',
    UNAVAILABLE: 'unavailable',
    TRANSPORT_ERROR: 'transportError',
});

export function reconnectingSocketFactory(options = {}) {
    return (url) => new ReconnectingWebSocket(url, [], { reconnectInterval: 5000, ...options });
}

export function createReaSockets({ createSocket, socketBaseUrl, logger = null } = {}) {
    if (typeof createSocket !== 'function') {
        throw new Error('createReaSockets: a socket factory must be injected (see reconnectingSocketFactory)');
    }
    if (typeof socketBaseUrl !== 'string' || !socketBaseUrl) {
        throw new Error('createReaSockets: socketBaseUrl must be injected (see reaSocketBase)');
    }
    const base = socketBaseUrl.replace(/\/+$/, '');
    const log = logger && logger.scope ? logger.scope('ws') : logger;
    const channels = new Map();

    const urlFor = (path) => `${base}${path.startsWith('/') ? path : `/${path}`}`;

    function channel({ key, path, channel: row = undefined, maxAttempts = null, retain = false }) {
        if (typeof key !== 'string' || !key) throw new Error('sockets.channel: key is required');
        if (typeof path !== 'string' || !path) throw new Error('sockets.channel: path is required');
        const existing = channels.get(key);
        if (existing) {
            if (existing.path !== path) {
                throw new Error(
                    `sockets.channel: key "${key}" is already bound to ${existing.path}; `
                    + 'use retarget() to move it',
                );
            }
            return existing.handle;
        }
        const created = createChannel({ key, path, row: row || channelForPath(path), maxAttempts, retain });
        channels.set(key, created);
        return created.handle;
    }

    function createChannel({ key, path, row, maxAttempts, retain }) {
        const fanout = createFanout({ logger: log, label: key });
        const state = {
            path,
            url: urlFor(path),
            socket: null,
            listeners: null,
            status: WS_STATE.IDLE,
            attempts: 0,
            opens: 0,
        };

        const note = (level, message) => {
            if (log && log[level]) log[level](`${key}: ${message}`);
        };

        /** Rule C: remove OUR listeners, then close. Never the other way round. */
        function silenceAndClose(socket, listeners) {
            if (!socket) return;
            if (listeners) {
                for (const [type, fn] of listeners) {
                    try {
                        socket.removeEventListener(type, fn);
                    } catch (err) {
                        note('warn', `removeEventListener failed: ${err && err.message}`);
                    }
                }
            }
            try {
                socket.close();
            } catch (err) {
                note('warn', `close failed: ${err && err.message}`);
            }
        }

        function handleMessage(raw) {
            let parsed;
            try {
                parsed = JSON.parse(typeof raw === 'string' ? raw : String(raw));
            } catch {
                // Not JSON at all. Reported, never guessed at.
                fanout.signal({ kind: WS_MESSAGE.MALFORMED, raw });
                note('warn', 'message was not JSON');
                return;
            }
            const classified = classifyMessage(parsed, row);
            if (classified.kind === WS_MESSAGE.FRAME) {
                fanout.emit(parsed);
                return;
            }
            // Rule F. Everything else is a signal: it is never stored and never replayed.
            fanout.signal({ ...classified, kind: classified.kind, data: parsed });
            if (classified.kind === WS_MESSAGE.ERROR) note('info', `error envelope: ${classified.error}`);
        }

        function open(force = false) {
            if (state.socket) return;
            if (state.status === WS_STATE.UNAVAILABLE && !force) {
                fanout.signal({ kind: WS_SIGNAL.UNAVAILABLE, attempts: state.attempts, latched: true });
                return;
            }
            state.status = WS_STATE.CONNECTING;
            state.attempts = 0;
            if (force) state.opens = 0;

            const socket = createSocket(state.url);
            const listeners = [
                ['open', () => {
                    state.status = WS_STATE.OPEN;
                    state.attempts = 0;
                    state.opens += 1;
                    fanout.signal({ kind: WS_SIGNAL.OPEN, url: state.url });
                }],
                ['message', (event) => handleMessage(event && event.data)],
                ['connecting', () => {
                    state.status = WS_STATE.CONNECTING;
                    state.attempts += 1;
                    fanout.signal({ kind: WS_SIGNAL.CONNECTING, attempt: state.attempts });
                    if (maxAttempts !== null && state.opens === 0 && state.attempts >= maxAttempts) {
                        note('info', `unavailable after ${state.attempts} attempts`);
                        closeNow(WS_STATE.UNAVAILABLE);
                        fanout.signal({ kind: WS_SIGNAL.UNAVAILABLE, attempts: state.attempts });
                    }
                }],
                ['close', () => {
                    if (state.status === WS_STATE.OPEN) state.status = WS_STATE.IDLE;
                    fanout.clear();
                    fanout.signal({ kind: WS_SIGNAL.CLOSE, url: state.url });
                }],
                ['error', () => {
                    fanout.signal({ kind: WS_SIGNAL.TRANSPORT_ERROR, url: state.url });
                }],
            ];
            for (const [type, fn] of listeners) socket.addEventListener(type, fn);
            state.socket = socket;
            state.listeners = listeners;
            note('debug', `opened ${state.url}`);
        }

        function closeNow(nextStatus = (state.status === WS_STATE.UNAVAILABLE ? WS_STATE.UNAVAILABLE : WS_STATE.IDLE)) {
            const socket = state.socket;
            const listeners = state.listeners;
            state.socket = null;
            state.listeners = null;
            state.status = nextStatus;
            silenceAndClose(socket, listeners);
            // Rule D. The replay value dies with the socket that produced it.
            fanout.clear();
        }

        const handle = {
            key,
            get path() { return state.path; },
            get url() { return state.url; },

            subscribe(listener) {
                const off = fanout.subscribe(listener);
                open();
                let released = false;
                return () => {
                    if (released) return;      // idempotent: a double-unsubscribe must not
                    released = true;           // close a socket someone else still holds
                    off();
                    if (!retain && fanout.size() === 0) closeNow();
                };
            },

            /** Observe signals. Does NOT open the socket on its own — a signal listener
             *  with no frame subscriber would be watching a channel nobody wants. */
            onSignal(listener) {
                return fanout.onSignal(listener);
            },

            /** The latest frame, or null. Null while closed, always. */
            last() {
                return fanout.last();
            },

            send(payload) {
                if (row && row.commands && payload && typeof payload === 'object'
                    && typeof payload.command === 'string') {
                    if (!row.commands.includes(payload.command)) {
                        return { ok: false, reason: `unknown command "${payload.command}" for ${key}` };
                    }
                    const invalid = row.validateCommand ? row.validateCommand(payload) : null;
                    if (invalid) return { ok: false, reason: invalid };
                }
                if (!state.socket || state.status !== WS_STATE.OPEN) {
                    return { ok: false, reason: 'socket is not open' };
                }
                try {
                    state.socket.send(JSON.stringify(payload));
                    return { ok: true };
                } catch (err) {
                    return { ok: false, reason: String(err && err.message || err) };
                }
            },

            retarget(nextPath) {
                if (typeof nextPath !== 'string' || !nextPath) {
                    throw new Error(`sockets.retarget(${key}): a path is required`);
                }
                if (nextPath === state.path && state.socket) return;
                const wanted = state.socket !== null || fanout.size() > 0;
                closeNow();
                state.path = nextPath;
                state.url = urlFor(nextPath);
                state.opens = 0;
                if (wanted) open(true);
            },

            /** Close and forget. Subscribers remain attached and will re-open on demand
             *  only if something calls open() again — an explicit act. */
            close() {
                closeNow();
            },

            /** Open with no subscriber — a channel a store wants live from boot — and the
             *  one way back from UNAVAILABLE. */
            open() {
                open(true);
            },

            /** What is true right now. There is no derived "connected" boolean — a screen
             *  that wants one decides what it means. */
            status() {
                return {
                    key,
                    path: state.path,
                    url: state.url,
                    state: state.status,
                    attempts: state.attempts,
                    opens: state.opens,
                    subscribers: fanout.size(),
                    frames: fanout.frameCount(),
                    hasFrame: fanout.hasFrame(),
                };
            },
        };

        return { key, get path() { return state.path; }, handle, closeNow, fanout };
    }

    return Object.freeze({
        socketBaseUrl: base,
        urlFor,
        channel,
        /** The channel for a key, or null. Never creates one. */
        get(key) {
            const found = channels.get(key);
            return found ? found.handle : null;
        },
        /** Every live channel's status. The diagnostic that would have made the doubled
         *  frame rate obvious the first time it happened. */
        statuses() {
            return [...channels.values()].map((entry) => entry.handle.status());
        },
        /** Close everything. App teardown, and the end of every test. */
        closeAll() {
            for (const entry of channels.values()) entry.closeNow();
            channels.clear();
        },
    });
}
