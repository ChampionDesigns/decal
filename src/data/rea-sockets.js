// ONE SOCKET LIFECYCLE POLICY, FOR ALL TEN CONNECTORS.
//
// SCOPE Part 6, `api.js` row: "the real port cost is the 813 port-with-changes lines,
// overwhelmingly the ten socket connectors and the display/brightness policy tangled into
// them, where FOUR DIFFERENT LIFECYCLE POLICIES COEXIST and must become one. That
// unification, not the wrapper count, is where the time goes."
//
// The four, verified in the old tree, are the counter-example this module is written
// against:
//
//   1. SLOT-MANAGED — `socket-slot.js`: close-before-open, silence-before-close, one
//      socket per named slot. The right policy, applied to two channels.
//   2. HAND-ROLLED close-then-reassign — `api.js`'s scale and devices connectors do the
//      same thing again, inline, without the silencing half.
//   3. DEDUPE-ON-SECOND-CALL — `if (estimatorLink) return;`: the second caller silently
//      gets nothing back and believes it subscribed.
//   4. NONE AT ALL — `shotState` and the `timeToReady` plugin feed. A second call opens a
//      second socket and leaks the first: both stay connected, both deliver, and the
//      symptom is a DOUBLED FRAME RATE, which looks like the machine got faster.
//
// THE POLICY, stated once, applied to all ten:
//
//   A. ONE LIVE SOCKET PER KEY. A second subscriber joins the existing socket. Nobody
//      opens a second one, and nobody is silently refused. (Kills 1, 3 and 4.)
//   B. CLOSE BEFORE OPEN. Re-targeting a channel — a new sensor id — closes the old socket
//      first and only then opens the new one. Without this, every machine swap leaks a
//      socket and double-delivers every frame.
//   C. SILENCE THE SUPERSEDED. A socket being discarded has OUR listeners removed BEFORE
//      it is closed, so it cannot deliver a late frame and cannot narrate its own funeral:
//      the close is ours, not the machine's, and the user must not see a disconnect flash
//      on every resync. (This module never assigns the `on*` properties at all, so
//      removing our listeners is total — no no-op-handler dance required.)
//   D. REPLAY DIES WITH THE SOCKET. `clear()` on close and on retarget. A frame replayed
//      from a closed socket, or from the previous sensor id, is a stale value presented as
//      current — the A7 defect class in miniature.
//   E. REFCOUNTED. First subscriber opens, last unsubscribe closes. There is no idle
//      socket kept alive "in case", because that is how the old tree ended up with sockets
//      nobody could name. `retain: true` opts a channel out for its whole lifetime, which
//      is an explicit choice at one call site rather than a default nobody chose.
//   F. AN ERROR ENVELOPE IS A SIGNAL, NOT A FRAME. Classification is
//      rea-ws-channels.js's `classifyMessage`; this module only routes the result.
//   G. BOUNDED ATTEMPTS WHERE ABSENCE IS NORMAL. A plugin socket whose plugin is not
//      loaded is refused before the upgrade, so it can never open; `maxAttempts` turns
//      that into one `unavailable` signal — feature-absent — instead of a reconnect loop
//      until the tablet is rebooted.
//
// A7: THERE IS NO FALLBACK PATH HERE. No send queue that replays on reconnect (a command
// applied minutes after the user asked for it is worse than one that failed), no
// last-good-frame served after a close, no synthesised "disconnected" frame. Absence is
// visible: `status()` says what is true and `last()` returns null.
//
// RECONNECT ITSELF IS NOT THIS MODULE'S JOB — it belongs to the vendored
// ReconnectingWebSocket and its two local patches (A11, vendor/README.md). This module
// depends on exactly one thing from it: that `close()` is FINAL. Patch 1 is what makes
// rule B true.
//
// DOM-free and injected, like the transport beside it: no `window`, no `document`, no
// `globalThis.WebSocket`. The socket factory is a constructor argument, and the tests
// drive the whole layer with a fake socket.

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
            // Rule A. A second caller with a different path for the same key is a
            // programming error, not a retarget — retargeting is explicit and says so.
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
                // A socket that refuses to close must never block the re-open: being stuck
                // with no live socket is the failure we are preventing, not the one we are
                // risking.
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
            // Rule G's other half: once a channel is UNAVAILABLE it STAYS absent. A
            // further subscriber must not silently restart the reconnect loop — absence
            // that re-hides itself is how the old tree's dead plugin feed went unnoticed.
            // Coming back is an explicit act: handle.open() or retarget().
            if (state.status === WS_STATE.UNAVAILABLE && !force) {
                // And the new subscriber is TOLD. It arrived after the verdict, so the
                // replay is empty and no signal would otherwise reach it: it would sit at
                // "nothing yet" for ever, which is the absence re-hiding itself one level up.
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
                    // Rule G. `maxAttempts` counts attempts that never reached OPEN, so a
                    // socket that opened once and dropped reconnects for ever, as it must —
                    // this cap is for the endpoint that CANNOT open, not for a flaky link.
                    if (maxAttempts !== null && state.opens === 0 && state.attempts >= maxAttempts) {
                        note('info', `unavailable after ${state.attempts} attempts`);
                        closeNow(WS_STATE.UNAVAILABLE);
                        fanout.signal({ kind: WS_SIGNAL.UNAVAILABLE, attempts: state.attempts });
                    }
                }],
                ['close', () => {
                    // Only a close we did NOT cause reaches here: rule C removed these
                    // listeners before any close of ours.
                    //
                    // AND IT MOVES THE STATUS OFF `open`. It did not, so `status()` went on
                    // reporting `open` for a socket the server had closed and `send()`
                    // answered `{ok: true}` on it — the one place this module's own A7 line
                    // ("status() says what is true") was untrue. It was masked in production
                    // only by the vendored wrapper dispatching `connecting` BEFORE `close`
                    // on a reconnect, which is another module's event order and no basis for
                    // this one's correctness.
                    //
                    // ONLY from OPEN. A CONNECTING set by that same `connecting` event is
                    // the truth during a reconnect — the wrapper does NOT re-raise it on
                    // subsequent attempts (`open(reconnectAttempt=true)` skips the dispatch),
                    // so overwriting it here would report a reconnecting channel as idle.
                    // UNAVAILABLE is a verdict and outranks both.
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
                        // ReaPrime answers an unknown command with an error envelope;
                        // catching it here names the mistake at the call site instead.
                        return { ok: false, reason: `unknown command "${payload.command}" for ${key}` };
                    }
                    // And where the handler's failure mode is SILENCE rather than an
                    // envelope, the table's own shape check runs (display's brightness).
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
