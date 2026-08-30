// MIT License:
//
// Copyright (c) 2010-2012, Joe Walnes
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// ---------------------------------------------------------------------------
// VENDORED FORK — Joe Walnes' ReconnectingWebSocket (2012), + 2 local patches
// + 3 mechanical changes made when it became an ES module (A11, wave 0b).
// The full provenance and the reasoning for each is in vendor/README.md; the
// short form is below, and both PATCHES are marked `LOCAL PATCH` in the body.
//
//   PATCH 1 (`open`)  — a close()d socket must STAY closed.
//   PATCH 2 (`close`) — readyState must not report CONNECTING for ever.
//
// THE PATCHES ARE THE VALUE. A stock library drops both silently and the
// failure surfaces as an occasional dead socket after a power cycle. If this
// file is ever swapped for a maintained library, re-apply both behaviours as
// tests FIRST (test/reconnecting-websocket.test.mjs already holds them).
//
//   MECHANICAL 1 — the UMD wrapper (`global.ReconnectingWebSocket = factory()`)
//     becomes `export default`. As UMD this file THREW on import in an ES
//     module: top-level `this` is undefined, so the global assignment assigned
//     to undefined (measured, vendor/README.md).
//   MECHANICAL 2 — DOM-FREE. `document.createElement('div')` as an event target
//     and `document.createEvent('CustomEvent')` are gone, replaced by a 20-line
//     listener registry over plain event objects. Nothing here touches a
//     document, so it imports under `node --test` and inside a shadow root
//     alike. The public surface (addEventListener / removeEventListener /
//     dispatchEvent / the on* properties) is unchanged.
//   MECHANICAL 3 — the WebSocket implementation is injectable
//     (`options.WebSocket`), defaulting to `globalThis.WebSocket`. Required by
//     mechanical 2: with no DOM there is no global to monkey-patch, and the
//     tests drive this file with a fake socket. It is also what makes the
//     no-WebSocket case a THROW instead of the original's silent
//     `return undefined` from the factory — a factory that returns undefined
//     makes `new ReconnectingWebSocket(...)` a TypeError at some later,
//     unrelated line.
// ---------------------------------------------------------------------------

/**
 * This behaves like a WebSocket in every way, except if it fails to connect,
 * or it gets disconnected, it will repeatedly poll until it successfully connects
 * again.
 *
 * The event stream will typically look like:
 *  onconnecting
 *  onopen
 *  onmessage
 *  onmessage
 *  onclose // lost connection
 *  onconnecting
 *  onopen  // sometime later...
 *  onmessage
 *  etc...
 *
 * It is API compatible with the standard WebSocket API, apart from the following members:
 *
 * - `bufferedAmount`
 * - `extensions`
 * - `binaryType`
 *
 * Latest upstream version: https://github.com/joewalnes/reconnecting-websocket/
 * - Joe Walnes
 *
 * Syntax
 * ======
 * const socket = new ReconnectingWebSocket(url, protocols, options);
 *
 * Options
 * =======
 * debug                 log debug messages. Default: false.
 * automaticOpen         connect immediately upon instantiation. Default: true.
 * reconnectInterval     ms to delay before reconnecting. Default: 1000.
 * maxReconnectInterval  ms ceiling on that delay. Default: 30000.
 * reconnectDecay        back-off multiplier. Default: 1.5.
 * timeoutInterval       ms to wait for a connection to succeed. Default: 2000.
 * maxReconnectAttempts  attempt cap. Unlimited if null. Default: null.
 * binaryType            'blob' or 'arraybuffer'. Default: 'blob'.
 * WebSocket             the constructor to use. Default: globalThis.WebSocket.
 */

/** Spec-fixed readyState values, written out so this module needs no global at load. */
const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

/**
 * MECHANICAL 2: the DOM-free replacement for `document.createElement('div')`.
 *
 * The original used a detached <div> purely as an EventTarget, and
 * `document.createEvent('CustomEvent')` purely to construct events that IE9-11
 * would accept. Neither browser nor DOM is a dependency of reconnect logic.
 * A listener that throws must not abort the dispatch loop — the original
 * inherited that from the DOM's own dispatch, so it is reproduced here rather
 * than quietly lost.
 */
function createEventTarget(onListenerError) {
    const listeners = new Map();
    return {
        addEventListener(type, listener) {
            if (typeof listener !== 'function') return;
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(listener);
        },
        removeEventListener(type, listener) {
            const set = listeners.get(type);
            if (set) set.delete(listener);
        },
        dispatchEvent(event) {
            const set = listeners.get(event.type);
            if (!set) return true;
            for (const listener of [...set]) {
                try {
                    listener(event);
                } catch (err) {
                    onListenerError(err);
                }
            }
            return true;
        },
    };
}

function ReconnectingWebSocket(url, protocols, options) {
    // Default settings
    const settings = {
        /** Whether this instance should log debug messages. */
        debug: false,

        /** Whether or not the websocket should attempt to connect immediately upon instantiation. */
        automaticOpen: true,

        /** The number of milliseconds to delay before attempting to reconnect. */
        reconnectInterval: 1000,
        /** The maximum number of milliseconds to delay a reconnection attempt. */
        maxReconnectInterval: 30000,
        /** The rate of increase of the reconnect delay. */
        reconnectDecay: 1.5,

        /** The maximum time in milliseconds to wait for a connection to succeed. */
        timeoutInterval: 2000,

        /** The maximum number of reconnection attempts to make. Unlimited if null. */
        maxReconnectAttempts: null,

        /** The binary type, possible values 'blob' or 'arraybuffer', default 'blob'. */
        binaryType: 'blob',
    };
    if (!options) { options = {}; }

    // Overwrite and define settings with options if they exist.
    for (const key in settings) {
        this[key] = typeof options[key] !== 'undefined' ? options[key] : settings[key];
    }

    // MECHANICAL 3. The original's guard was, at module scope:
    //     if (!('WebSocket' in window)) { return; }
    // — the factory returned undefined, so `new ReconnectingWebSocket(url)`
    // failed later, somewhere else, as "X is not a constructor". Fail here,
    // named, with the reason.
    const Socket = options.WebSocket || globalThis.WebSocket;
    if (typeof Socket !== 'function') {
        throw new Error(
            'ReconnectingWebSocket: no WebSocket implementation — pass options.WebSocket '
            + 'or run somewhere globalThis.WebSocket exists',
        );
    }

    // These should be treated as read-only properties

    /** The URL as resolved by the constructor. This is always an absolute URL. Read only. */
    this.url = url;

    /** The number of attempted reconnects since starting, or the last successful connection. */
    this.reconnectAttempts = 0;

    /**
     * The current state of the connection.
     * Can be one of: CONNECTING, OPEN, CLOSING, CLOSED. Read only.
     */
    this.readyState = CONNECTING;

    /** The sub-protocol the server selected. Read only. */
    this.protocol = null;

    // Private state variables

    const self = this;
    let ws;
    let forcedClose = false;
    let timedOut = false;
    const eventTarget = createEventTarget((err) => {
        if (self.debug || ReconnectingWebSocket.debugAll) {
            console.debug('ReconnectingWebSocket', 'listener-error', self.url, err);
        }
    });

    // Wire up "on*" properties as event handlers

    eventTarget.addEventListener('open', (event) => { self.onopen(event); });
    eventTarget.addEventListener('close', (event) => { self.onclose(event); });
    eventTarget.addEventListener('connecting', (event) => { self.onconnecting(event); });
    eventTarget.addEventListener('message', (event) => { self.onmessage(event); });
    eventTarget.addEventListener('error', (event) => { self.onerror(event); });

    // Expose the API required by EventTarget

    this.addEventListener = eventTarget.addEventListener;
    this.removeEventListener = eventTarget.removeEventListener;
    this.dispatchEvent = eventTarget.dispatchEvent;

    /** A plain event object. Was `document.createEvent('CustomEvent')` (MECHANICAL 2). */
    function generateEvent(type, args) {
        return Object.assign({ type, target: self }, args);
    }

    this.open = function (reconnectAttempt) {
        // LOCAL PATCH 1: a close()d socket must STAY closed.
        //
        // close() sets forcedClose, but only calls ws.close() `if (ws)`. Between
        // reconnect attempts ws is null (onclose nulls it and arms a setTimeout
        // -> self.open(true)), so a close() landing in that window closed
        // nothing and cancelled nothing — and open() never consulted
        // forcedClose. The pending timer then opened a brand-new WebSocket on
        // behalf of an instance its owner had already discarded and can no
        // longer reach: a permanently-open socket, silenced and unownable.
        //
        // Decal's ONE socket lifecycle policy (src/data/rea-sockets.js) is
        // close-before-open on every channel, and it relies on close() being
        // final. It is: the pending reconnect timer still fires, but it is a
        // no-op.
        if (forcedClose) {
            return;
        }

        ws = new Socket(self.url, protocols || []);
        ws.binaryType = this.binaryType;

        if (reconnectAttempt) {
            if (this.maxReconnectAttempts && this.reconnectAttempts > this.maxReconnectAttempts) {
                return;
            }
        } else {
            eventTarget.dispatchEvent(generateEvent('connecting'));
            this.reconnectAttempts = 0;
        }

        if (self.debug || ReconnectingWebSocket.debugAll) {
            console.debug('ReconnectingWebSocket', 'attempt-connect', self.url);
        }

        const localWs = ws;
        const timeout = setTimeout(() => {
            if (self.debug || ReconnectingWebSocket.debugAll) {
                console.debug('ReconnectingWebSocket', 'connection-timeout', self.url);
            }
            timedOut = true;
            localWs.close();
            timedOut = false;
        }, self.timeoutInterval);

        ws.onopen = function () {
            clearTimeout(timeout);
            if (self.debug || ReconnectingWebSocket.debugAll) {
                console.debug('ReconnectingWebSocket', 'onopen', self.url);
            }
            self.protocol = ws.protocol;
            self.readyState = OPEN;
            self.reconnectAttempts = 0;
            const e = generateEvent('open');
            e.isReconnect = reconnectAttempt;
            reconnectAttempt = false;
            eventTarget.dispatchEvent(e);
        };

        ws.onclose = function (event) {
            clearTimeout(timeout);
            ws = null;
            if (forcedClose) {
                self.readyState = CLOSED;
                eventTarget.dispatchEvent(generateEvent('close'));
            } else {
                self.readyState = CONNECTING;
                const e = generateEvent('connecting');
                e.code = event && event.code;
                e.reason = event && event.reason;
                e.wasClean = event && event.wasClean;
                eventTarget.dispatchEvent(e);
                if (!reconnectAttempt && !timedOut) {
                    if (self.debug || ReconnectingWebSocket.debugAll) {
                        console.debug('ReconnectingWebSocket', 'onclose', self.url);
                    }
                    eventTarget.dispatchEvent(generateEvent('close'));
                }

                const delay = self.reconnectInterval * Math.pow(self.reconnectDecay, self.reconnectAttempts);
                setTimeout(() => {
                    self.reconnectAttempts++;
                    self.open(true);
                }, delay > self.maxReconnectInterval ? self.maxReconnectInterval : delay);
            }
        };
        ws.onmessage = function (event) {
            if (self.debug || ReconnectingWebSocket.debugAll) {
                console.debug('ReconnectingWebSocket', 'onmessage', self.url, event.data);
            }
            const e = generateEvent('message');
            e.data = event.data;
            eventTarget.dispatchEvent(e);
        };
        ws.onerror = function (event) {
            if (self.debug || ReconnectingWebSocket.debugAll) {
                console.debug('ReconnectingWebSocket', 'onerror', self.url, event);
            }
            eventTarget.dispatchEvent(generateEvent('error'));
        };
    };

    // Whether or not to create a websocket upon instantiation
    if (this.automaticOpen === true) {
        this.open(false);
    }

    /**
     * Transmits data to the server over the WebSocket connection.
     *
     * @param data a text string, ArrayBuffer or Blob to send to the server.
     */
    this.send = function (data) {
        if (ws) {
            if (self.debug || ReconnectingWebSocket.debugAll) {
                console.debug('ReconnectingWebSocket', 'send', self.url, data);
            }
            return ws.send(data);
        }
        throw new Error('INVALID_STATE_ERR : Pausing to reconnect websocket');
    };

    /**
     * Closes the WebSocket connection or connection attempt, if any.
     * If the connection is already CLOSED, this method does nothing.
     */
    this.close = function (code, reason) {
        // Default CLOSE_NORMAL code
        if (typeof code === 'undefined') {
            code = 1000;
        }
        forcedClose = true;
        if (ws) {
            ws.close(code, reason);
        } else {
            // LOCAL PATCH 2: closed between reconnect attempts. There is no
            // underlying socket whose onclose can move us to CLOSED, so without
            // this the instance would report CONNECTING for ever — a lie, now
            // that PATCH 1 means open() will refuse to reconnect it. Callers
            // that gate on `readyState === OPEN` already treat it as not
            // sendable; this just stops it claiming it is on its way back.
            self.readyState = CLOSED;
        }
    };

    /**
     * Additional public API method to refresh the connection if still open (close, re-open).
     * For example, if the app suspects bad data / missed heart beats, it can try to refresh.
     */
    this.refresh = function () {
        if (ws) {
            ws.close();
        }
    };
}

/**
 * An event listener to be called when the WebSocket connection's readyState changes to OPEN.
 */
ReconnectingWebSocket.prototype.onopen = function () {};
/** An event listener to be called when the WebSocket connection's readyState changes to CLOSED. */
ReconnectingWebSocket.prototype.onclose = function () {};
/** An event listener to be called when a connection begins being attempted. */
ReconnectingWebSocket.prototype.onconnecting = function () {};
/** An event listener to be called when a message is received from the server. */
ReconnectingWebSocket.prototype.onmessage = function () {};
/** An event listener to be called when an error occurs. */
ReconnectingWebSocket.prototype.onerror = function () {};

/**
 * Whether all instances of ReconnectingWebSocket should log debug messages.
 */
ReconnectingWebSocket.debugAll = false;

ReconnectingWebSocket.CONNECTING = CONNECTING;
ReconnectingWebSocket.OPEN = OPEN;
ReconnectingWebSocket.CLOSING = CLOSING;
ReconnectingWebSocket.CLOSED = CLOSED;

export default ReconnectingWebSocket;
export { ReconnectingWebSocket, CONNECTING, OPEN, CLOSING, CLOSED };
