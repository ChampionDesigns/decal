
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import ReconnectingWebSocket, { CLOSED, CONNECTING, OPEN } from '../vendor/reconnecting-websocket.js';

const SOURCE = readFileSync(fileURLToPath(new URL('../vendor/reconnecting-websocket.js', import.meta.url)), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** A WebSocket double. The server side is driven by hand. */
function fakeSocketClass(instances) {
    return class FakeSocket {
        constructor(url, protocols) {
            this.url = url;
            this.protocols = protocols;
            this.readyState = 0;
            this.sent = [];
            this.closedWith = null;
            instances.push(this);
        }

        send(data) { this.sent.push(data); }

        close(code, reason) {
            this.closedWith = { code, reason };
            this.readyState = 3;
            if (this.onclose) this.onclose({ code: code ?? 1000, reason, wasClean: true });
        }

        // --- server side ---
        serverOpen() { this.readyState = 1; if (this.onopen) this.onopen({}); }

        serverMessage(data) { if (this.onmessage) this.onmessage({ data }); }

        serverDrop() { this.readyState = 3; if (this.onclose) this.onclose({ code: 1006, wasClean: false }); }
    };
}

/** Long timeoutInterval so the library's own connection timeout never fires under a tick. */
const OPTIONS = { reconnectInterval: 10, maxReconnectInterval: 10, timeoutInterval: 1e7, reconnectDecay: 1 };

function connect(t, options = {}) {
    const instances = [];
    const socket = new ReconnectingWebSocket('ws://rea.test/ws/v1/machine/snapshot', [], {
        ...OPTIONS,
        WebSocket: fakeSocketClass(instances),
        ...options,
    });
    t.after(() => { try { socket.close(); } catch { /* already closed */ } });
    return { socket, instances };
}

describe('mechanical: it is an ES module, and DOM-free', () => {
    test('it exports a constructor as default', () => {
        assert.equal(typeof ReconnectingWebSocket, 'function');
        assert.deepEqual(
            [ReconnectingWebSocket.CONNECTING, ReconnectingWebSocket.OPEN, ReconnectingWebSocket.CLOSED],
            [0, 1, 3],
        );
    });

    test('the source touches no document and no window', () => {
        assert.equal(/\bdocument\s*\./.test(CODE), false, 'document. appears in the vendored code');
        assert.equal(/\bwindow\s*\./.test(CODE), false, 'window. appears in the vendored code');
        assert.equal(CODE.includes('createElement('), false);
        assert.equal(CODE.includes('createEvent('), false);
        assert.equal(CODE.split('options.WebSocket || globalThis.WebSocket').length - 1, 1);
    });

    test('both LOCAL PATCH markers survive in the source', () => {
        assert.match(SOURCE, /LOCAL PATCH 1/);
        assert.match(SOURCE, /LOCAL PATCH 2/);
    });
});

describe('no WebSocket implementation is an explicit error', () => {
    test('it throws by name instead of returning undefined', () => {
        const saved = globalThis.WebSocket;
        try {
            globalThis.WebSocket = undefined;
            assert.throws(
                () => new ReconnectingWebSocket('ws://rea.test/x'),
                /no WebSocket implementation/,
            );
        } finally {
            globalThis.WebSocket = saved;
        }
    });
});

describe('LOCAL PATCH 1 — a close()d socket stays closed', () => {
    test('a close() landing between reconnect attempts cancels the reconnect', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const { socket, instances } = connect(t);
        instances[0].serverOpen();
        assert.equal(socket.readyState, OPEN);

        // The machine power-cycles: the socket drops and a reconnect is armed.
        instances[0].serverDrop();
        assert.equal(instances.length, 1);

        socket.close();
        t.mock.timers.tick(1000);

        assert.equal(instances.length, 1, 'the pending timer opened a socket for a discarded instance');
    });

    test('without a close(), the reconnect still happens', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const { socket, instances } = connect(t);
        instances[0].serverOpen();
        instances[0].serverDrop();
        t.mock.timers.tick(1000);
        assert.equal(instances.length, 2, 'reconnect must still work — the patch only blocks a CLOSED instance');
        assert.equal(socket.readyState, CONNECTING);
    });
});

describe('LOCAL PATCH 2 — readyState must not lie', () => {
    test('closing between attempts reports CLOSED, not CONNECTING', (t) => {
        const { socket, instances } = connect(t);
        instances[0].serverOpen();
        instances[0].serverDrop();
        assert.equal(socket.readyState, CONNECTING, 'mid-reconnect it is genuinely connecting');
        socket.close();
        assert.equal(socket.readyState, CLOSED, 'after close() it will never reconnect, so it must say so');
    });

    test('closing an open socket reports CLOSED too', (t) => {
        const { socket, instances } = connect(t);
        instances[0].serverOpen();
        socket.close();
        assert.equal(socket.readyState, CLOSED);
        assert.deepEqual(instances[0].closedWith, { code: 1000, reason: undefined });
    });
});

describe('the event surface, DOM-free', () => {
    test('addEventListener and the on* properties both fire', (t) => {
        const seen = [];
        const { socket, instances } = connect(t);
        socket.addEventListener('message', (e) => seen.push(['listener', e.data]));
        socket.onmessage = (e) => seen.push(['handler', e.data]);
        instances[0].serverOpen();
        instances[0].serverMessage('{"pressure":8.6}');
        assert.deepEqual(seen, [['handler', '{"pressure":8.6}'], ['listener', '{"pressure":8.6}']]);
    });

    test('removeEventListener detaches — this is how a superseded socket is silenced', (t) => {
        const seen = [];
        const { socket, instances } = connect(t);
        const listener = (e) => seen.push(e.data);
        socket.addEventListener('message', listener);
        instances[0].serverOpen();
        instances[0].serverMessage('one');
        socket.removeEventListener('message', listener);
        instances[0].serverMessage('two');
        assert.deepEqual(seen, ['one']);
    });

    test('a listener that throws does not stop the others', (t) => {
        const seen = [];
        const { socket, instances } = connect(t);
        socket.addEventListener('message', () => { throw new Error('boom'); });
        socket.addEventListener('message', (e) => seen.push(e.data));
        instances[0].serverOpen();
        instances[0].serverMessage('still delivered');
        assert.deepEqual(seen, ['still delivered']);
    });

    test('open carries isReconnect, so a resubscribe can tell a first connect from a return', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const flags = [];
        const { socket, instances } = connect(t);
        socket.addEventListener('open', (e) => flags.push(e.isReconnect));
        instances[0].serverOpen();
        instances[0].serverDrop();
        t.mock.timers.tick(1000);
        instances[1].serverOpen();
        assert.deepEqual(flags, [false, true]);
    });
});

describe('send', () => {
    test('sends on an open socket and refuses loudly while reconnecting', (t) => {
        const { socket, instances } = connect(t);
        instances[0].serverOpen();
        socket.send('{"command":"check"}');
        assert.deepEqual(instances[0].sent, ['{"command":"check"}']);
        instances[0].serverDrop();
        assert.throws(() => socket.send('{"command":"check"}'), /INVALID_STATE_ERR/);
    });
});
