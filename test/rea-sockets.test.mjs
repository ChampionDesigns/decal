
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createReaSockets, WS_STATE, WS_SIGNAL } from '../src/data/rea-sockets.js';
import { WS_CHANNELS, WS_MESSAGE, classifyMessage, channelForPath, sensorSnapshotPath, pluginEndpointPath } from '../src/data/rea-ws-channels.js';
import { SOCKET_CHANNELS } from '../src/data/rea-routes.js';

const BASE = 'ws://rea.test:8080';

/** A socket double with the same event surface the vendored wrapper exposes. */
function fakeSocket(url) {
    const listeners = new Map();
    return {
        url,
        closed: false,
        sent: [],
        /** Listener count AT THE MOMENT OF CLOSE — the silence-before-close assertion. */
        listenersAtClose: null,
        addEventListener(type, fn) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(fn);
        },
        removeEventListener(type, fn) {
            const set = listeners.get(type);
            if (set) set.delete(fn);
        },
        close() {
            this.listenersAtClose = [...listeners.values()].reduce((n, set) => n + set.size, 0);
            this.closed = true;
        },
        send(data) { this.sent.push(data); },
        // --- server side ---
        emit(type, event = {}) {
            for (const fn of [...(listeners.get(type) || [])]) fn({ type, ...event });
        },
        message(payload) {
            this.emit('message', { data: typeof payload === 'string' ? payload : JSON.stringify(payload) });
        },
        open() { this.emit('open'); },
    };
}

function makeSockets() {
    const opened = [];
    const createSocket = (url) => {
        const socket = fakeSocket(url);
        opened.push(socket);
        return socket;
    };
    const sockets = createReaSockets({ createSocket, socketBaseUrl: BASE });
    return { sockets, opened };
}

const snapshot = () => WS_CHANNELS.machineSnapshot;

describe('construction is injected, like the transport', () => {
    test('it refuses to invent a socket factory or a base url', () => {
        assert.throws(() => createReaSockets({ socketBaseUrl: BASE }), /socket factory must be injected/);
        assert.throws(() => createReaSockets({ createSocket: () => {} }), /socketBaseUrl must be injected/);
    });

    test('urls compose off the injected base', () => {
        const { sockets } = makeSockets();
        assert.equal(sockets.urlFor('/ws/v1/machine/snapshot'), `${BASE}/ws/v1/machine/snapshot`);
    });
});

describe('policy A — one live socket per key (dedupe)', () => {
    test('a second subscriber joins the first socket instead of opening another', () => {
        const { sockets, opened } = makeSockets();
        const row = snapshot();
        const channel = sockets.channel({ key: row.key, path: row.path, channel: row });
        const a = []; const b = [];
        channel.subscribe((f) => a.push(f));
        channel.subscribe((f) => b.push(f));
        assert.equal(opened.length, 1, 'ONE socket — the shotState defect opened two');
        opened[0].open();
        opened[0].message({ pressure: 8.6 });
        assert.deepEqual(a, [{ pressure: 8.6 }]);
        assert.deepEqual(b, [{ pressure: 8.6 }], 'and the second subscriber is not silently refused');
    });

    test('the same key with a different path is refused, not silently rebound', () => {
        const { sockets } = makeSockets();
        sockets.channel({ key: 'devices', path: '/ws/v1/devices' });
        assert.throws(
            () => sockets.channel({ key: 'devices', path: '/ws/v1/display' }),
            /already bound to \/ws\/v1\/devices/,
        );
    });
});

describe('policy E — refcounted: first subscriber opens, last closes', () => {
    test('no socket exists until something subscribes', () => {
        const { sockets, opened } = makeSockets();
        sockets.channel({ key: 'update', path: '/ws/v1/update' });
        assert.equal(opened.length, 0);
    });

    test('the first unsubscribe does not close a socket someone else is using', () => {
        const { sockets, opened } = makeSockets();
        const channel = sockets.channel({ key: 'x', path: '/ws/v1/machine/shotState' });
        const offA = channel.subscribe(() => {});
        const offB = channel.subscribe(() => {});
        offA();
        assert.equal(opened[0].closed, false);
        offB();
        assert.equal(opened[0].closed, true);
        assert.equal(channel.status().state, WS_STATE.IDLE);
    });

    test('a double unsubscribe cannot close a socket a later subscriber opened', () => {
        const { sockets, opened } = makeSockets();
        const channel = sockets.channel({ key: 'x', path: '/ws/v1/machine/shotState' });
        const offA = channel.subscribe(() => {});
        offA();
        assert.equal(opened[0].closed, true);
        channel.subscribe(() => {});
        assert.equal(opened.length, 2);
        offA();
        assert.equal(opened[1].closed, false, 'a stale unsubscribe must be inert');
    });

    test('retain:true keeps a channel open with no subscribers', () => {
        const { sockets, opened } = makeSockets();
        const channel = sockets.channel({ key: 'x', path: '/ws/v1/display', retain: true });
        const off = channel.subscribe(() => {});
        off();
        assert.equal(opened[0].closed, false);
        channel.close();
        assert.equal(opened[0].closed, true);
    });
});

describe('policies B, C, D — close before open, silenced, replay dropped', () => {
    test('retarget closes the old socket BEFORE opening the new one, and silences it first', () => {
        const { sockets, opened } = makeSockets();
        const row = WS_CHANNELS.sensorSnapshot;
        const first = sensorSnapshotPath('bengle-1-puckestimator');
        const second = sensorSnapshotPath('bengle-2-puckestimator');
        const channel = sockets.channel({ key: 'sensor:puckEstimator', path: first, channel: row });
        const seen = [];
        channel.subscribe((f) => seen.push(f));
        opened[0].open();
        opened[0].message({ r1: 1.4 });

        channel.retarget(second);

        assert.equal(opened[0].closed, true, 'old socket closed');
        assert.equal(opened[0].listenersAtClose, 0, 'and SILENCED before the close, not after');
        assert.equal(opened.length, 2, 'exactly one replacement');
        assert.equal(opened[1].url, `${BASE}${second}`);
        assert.equal(channel.last(), null, 'the previous sensor id\'s frame is NOT replayed onto the new one');
    });

    test('a superseded socket cannot deliver a late frame', () => {
        const { sockets, opened } = makeSockets();
        const channel = sockets.channel({ key: 'sensor:puckEstimator', path: '/ws/v1/sensors/a/snapshot' });
        const seen = [];
        channel.subscribe((f) => seen.push(f));
        opened[0].open();
        channel.retarget('/ws/v1/sensors/b/snapshot');
        opened[0].message({ r1: 99 });
        assert.deepEqual(seen, [], 'the discarded socket is silent — no frame, no funeral');
    });

    test('a close during a reconnect delivers nothing afterwards', () => {
        const { sockets, opened } = makeSockets();
        const channel = sockets.channel({ key: 'snap', path: '/ws/v1/machine/snapshot', channel: snapshot() });
        const seen = []; const signals = [];
        const off = channel.subscribe((f) => seen.push(f));
        channel.onSignal((s) => signals.push(s));
        opened[0].open();
        opened[0].emit('connecting', {});          // the machine power-cycled
        off();                                     // the owner lets go mid-reconnect
        opened[0].open();                          // the wrapper's socket comes back anyway
        opened[0].message({ pressure: 3 });
        assert.deepEqual(seen, []);
        assert.equal(signals.filter((s) => s.kind === WS_SIGNAL.OPEN).length, 1, 'only the first open counted');
        assert.equal(opened[0].closed, true);
    });

    test('replay dies with the socket', () => {
        const { sockets, opened } = makeSockets();
        const channel = sockets.channel({ key: 'snap', path: '/ws/v1/machine/snapshot', channel: snapshot() });
        const off = channel.subscribe(() => {});
        opened[0].open();
        opened[0].message({ pressure: 8.6 });
        assert.deepEqual(channel.last(), { pressure: 8.6 });
        off();
        assert.equal(channel.last(), null, 'a closed channel holds no current value');
    });

    test('a close we did not cause clears the replay and raises a signal', () => {
        const { sockets, opened } = makeSockets();
        const channel = sockets.channel({ key: 'snap', path: '/ws/v1/machine/snapshot', channel: snapshot() });
        const signals = [];
        channel.subscribe(() => {});
        channel.onSignal((s) => signals.push(s.kind));
        opened[0].open();
        opened[0].message({ pressure: 8.6 });
        opened[0].emit('close', {});
        assert.equal(channel.last(), null);
        assert.deepEqual(signals, [WS_SIGNAL.OPEN, WS_SIGNAL.CLOSE]);
    });
});

describe('policy F — an error envelope is a signal, not a frame', () => {
    test('an error envelope never becomes a frame or a replay value', () => {
        const { sockets, opened } = makeSockets();
        const channel = sockets.channel({ key: 'snap', path: '/ws/v1/machine/snapshot', channel: snapshot() });
        const frames = []; const signals = [];
        channel.subscribe((f) => frames.push(f));
        channel.onSignal((s) => signals.push(s));
        opened[0].open();
        opened[0].message({ pressure: 8.6 });
        opened[0].message({ error: 'No machine connected' });
        assert.deepEqual(frames, [{ pressure: 8.6 }]);
        assert.deepEqual(channel.last(), { pressure: 8.6 }, 'the last real frame is untouched by a refusal');
        assert.equal(signals.at(-1).kind, WS_MESSAGE.ERROR);
        assert.equal(signals.at(-1).error, 'No machine connected');
    });

    test('the scale\'s {"status":...} envelope is a signal, not a snapshot with no weight', () => {
        const { sockets, opened } = makeSockets();
        const row = WS_CHANNELS.scaleSnapshot;
        const channel = sockets.channel({ key: row.key, path: row.path, channel: row });
        const frames = []; const signals = [];
        channel.subscribe((f) => frames.push(f));
        channel.onSignal((s) => signals.push(s));
        opened[0].open();
        opened[0].message({ status: 'connected' });
        opened[0].message({ timestamp: '2026-08-17T00:00:00Z', weight: 18.2, weightFlow: 1.9, battery: null, timerValue: 0 });
        opened[0].message({ status: 'disconnected' });
        assert.equal(frames.length, 1, 'two status envelopes must not read as two empty weighings');
        assert.deepEqual(signals.filter((s) => s.kind === WS_MESSAGE.STATUS).map((s) => s.status),
            ['connected', 'disconnected']);
    });

    test('a message that is not JSON is reported, never guessed at', () => {
        const { sockets, opened } = makeSockets();
        const channel = sockets.channel({ key: 'snap', path: '/ws/v1/machine/snapshot', channel: snapshot() });
        const frames = []; const signals = [];
        channel.subscribe((f) => frames.push(f));
        channel.onSignal((s) => signals.push(s));
        opened[0].open();
        opened[0].emit('message', { data: '<html>proxy error</html>' });
        assert.deepEqual(frames, []);
        assert.equal(signals.at(-1).kind, WS_MESSAGE.MALFORMED);
    });
});

describe('policy G — bounded attempts where absence is normal (plugins)', () => {
    test('a plugin that is not loaded becomes feature-absent, not a reconnect loop', () => {
        const { sockets, opened } = makeSockets();
        const row = WS_CHANNELS.pluginEndpoint;
        const path = pluginEndpointPath('time-to-ready.reaplugin', 'timeToReady');
        const channel = sockets.channel({ key: 'plugin:timeToReady', path, channel: row, maxAttempts: 3 });
        const signals = [];
        channel.subscribe(() => {});
        channel.onSignal((s) => signals.push(s.kind));
        // The upgrade is refused before it happens, so the wrapper only ever re-attempts.
        opened[0].emit('connecting', {});
        opened[0].emit('connecting', {});
        assert.equal(opened[0].closed, false);
        opened[0].emit('connecting', {});
        assert.equal(opened[0].closed, true, 'stopped dialling');
        assert.equal(signals.at(-1), WS_SIGNAL.UNAVAILABLE);
        assert.equal(channel.status().state, WS_STATE.UNAVAILABLE);
    });

    test('unavailable stays unavailable until something asks explicitly', () => {
        const { sockets, opened } = makeSockets();
        const channel = sockets.channel({ key: 'plugin:x', path: '/ws/v1/plugins/p/e', maxAttempts: 1 });
        channel.subscribe(() => {});
        opened[0].emit('connecting', {});
        assert.equal(channel.status().state, WS_STATE.UNAVAILABLE);
        channel.subscribe(() => {});
        assert.equal(opened.length, 1, 'a further subscriber must not restart the loop silently');
        channel.open();
        assert.equal(opened.length, 2, 'and an explicit open() is the way back');
    });

    test('a socket that opened once reconnects for ever — the cap is for what cannot open', () => {
        const { sockets, opened } = makeSockets();
        const channel = sockets.channel({ key: 'plugin:x', path: '/ws/v1/plugins/p/e', maxAttempts: 2 });
        channel.subscribe(() => {});
        opened[0].open();
        opened[0].emit('connecting', {});
        opened[0].emit('connecting', {});
        opened[0].emit('connecting', {});
        assert.equal(opened[0].closed, false);
        assert.equal(channel.status().state, WS_STATE.CONNECTING);
    });
});

describe('send: no queue, no invented delivery', () => {
    test('a command on a closed socket fails rather than waiting for a reconnect', () => {
        const { sockets } = makeSockets();
        const row = WS_CHANNELS.display;
        const channel = sockets.channel({ key: row.key, path: row.path, channel: row });
        assert.deepEqual(channel.send({ command: 'setBrightness', brightness: 40 }),
            { ok: false, reason: 'socket is not open' });
    });

    test('an open socket sends JSON', () => {
        const { sockets, opened } = makeSockets();
        const row = WS_CHANNELS.display;
        const channel = sockets.channel({ key: row.key, path: row.path, channel: row });
        channel.subscribe(() => {});
        opened[0].open();
        assert.deepEqual(channel.send({ command: 'setBrightness', brightness: 40 }), { ok: true });
        assert.deepEqual(opened[0].sent, ['{"command":"setBrightness","brightness":40}']);
    });

    test('a brightness the handler would drop SILENTLY is refused instead', () => {
        const { sockets, opened } = makeSockets();
        const row = WS_CHANNELS.display;
        const channel = sockets.channel({ key: row.key, path: row.path, channel: row });
        channel.subscribe(() => {});
        opened[0].open();
        for (const brightness of [101, -1, 80.5, '80', null]) {
            const result = channel.send({ command: 'setBrightness', brightness });
            assert.equal(result.ok, false, `brightness ${brightness} must be refused`);
            assert.match(result.reason, /integer 0\.\.100/);
        }
        assert.deepEqual(opened[0].sent, [], 'nothing reached the wire');
        assert.deepEqual(channel.send({ command: 'requestWakeLock' }), { ok: true });
        assert.deepEqual(channel.send({ command: 'setBrightness', brightness: 0 }), { ok: true });
        assert.deepEqual(channel.send({ command: 'setBrightness', brightness: 100 }), { ok: true });
    });

    test('a command the handler does not implement is refused at the call site', () => {
        const { sockets, opened } = makeSockets();
        const row = WS_CHANNELS.update;
        const channel = sockets.channel({ key: row.key, path: row.path, channel: row });
        channel.subscribe(() => {});
        opened[0].open();
        const result = channel.send({ command: 'reboot' });
        assert.equal(result.ok, false);
        assert.match(result.reason, /unknown command "reboot"/);
        assert.deepEqual(opened[0].sent, []);
    });
});

describe('the channel table', () => {
    test('there are ten channels and the three unconsumed ones are absent', () => {
        const paths = Object.values(WS_CHANNELS).map((c) => c.path);
        assert.equal(paths.length, 10);
        for (const excluded of ['/ws/v1/machine/raw', '/ws/v1/logs', '/ws/v1/webview/logs']) {
            assert.equal(paths.includes(excluded), false, `${excluded} is deliberately not consumed`);
        }
    });

    test('it agrees with the GENERATED spec table — two tables that could drift, guarded', () => {
        const documented = SOCKET_CHANNELS.map((c) => c.route).sort();
        const consumed = Object.values(WS_CHANNELS).map((c) => c.path).sort();
        const excluded = ['/ws/v1/logs', '/ws/v1/machine/raw', '/ws/v1/webview/logs'];
        assert.deepEqual(documented, [...consumed, ...excluded].sort());
        for (const path of consumed) {
            assert.ok(documented.includes(path), `${path} is not in the generated spec table`);
        }
    });

    test('every row names the handler it was checked against', () => {
        for (const row of Object.values(WS_CHANNELS)) {
            assert.match(row.handlerFile, /^lib\/src\/services\/webserver\/.*\.dart$/);
            assert.ok(row.handlerSymbol.length > 0);
            assert.ok(row.path.startsWith('/ws/v1/'));
        }
    });

    test('templated paths encode their segments', () => {
        assert.equal(sensorSnapshotPath('bengle 1-puckestimator'), '/ws/v1/sensors/bengle%201-puckestimator/snapshot');
        assert.equal(pluginEndpointPath('decent-profile.reaplugin', 'profileGenerated'),
            '/ws/v1/plugins/decent-profile.reaplugin/profileGenerated');
        assert.throws(() => sensorSnapshotPath(''), /sensor id is required/);
        assert.throws(() => pluginEndpointPath('p', ''), /endpoint is required/);
    });

    test('channelForPath resolves plain and templated paths', () => {
        assert.equal(channelForPath('/ws/v1/machine/snapshot'), WS_CHANNELS.machineSnapshot);
        assert.equal(channelForPath('/ws/v1/sensors/x-puckestimator/snapshot'), WS_CHANNELS.sensorSnapshot);
        assert.equal(channelForPath('/ws/v1/plugins/a/b'), WS_CHANNELS.pluginEndpoint);
        assert.equal(channelForPath('/ws/v1/logs'), null);
    });

    test('classification order: error beats operation, on the devices socket', () => {
        const failed = { deviceId: 'x', operation: 'connect', outcome: 'failed', error: 'boom' };
        assert.equal(classifyMessage(failed, WS_CHANNELS.devices).kind, WS_MESSAGE.ERROR);
        const ok = { deviceId: 'x', operation: 'connect', outcome: 'connected', state: 'connected' };
        assert.equal(classifyMessage(ok, WS_CHANNELS.devices).kind, WS_MESSAGE.COMMAND_RESULT);
        assert.equal(classifyMessage([1, 2], WS_CHANNELS.devices).kind, WS_MESSAGE.MALFORMED);
        assert.equal(classifyMessage(null).kind, WS_MESSAGE.MALFORMED);
    });
});

describe('diagnostics', () => {
    test('statuses() reports every live channel, including its frame count', () => {
        const { sockets, opened } = makeSockets();
        const channel = sockets.channel({ key: 'snap', path: '/ws/v1/machine/snapshot', channel: snapshot() });
        channel.subscribe(() => {});
        opened[0].open();
        opened[0].message({ pressure: 1 });
        const [status] = sockets.statuses();
        assert.equal(status.key, 'snap');
        assert.equal(status.state, WS_STATE.OPEN);
        assert.equal(status.frames, 1);
        assert.equal(status.subscribers, 1);
    });

    test('closeAll closes everything — app teardown, and the end of every test', () => {
        const { sockets, opened } = makeSockets();
        for (const key of ['a', 'b']) {
            sockets.channel({ key, path: `/ws/v1/machine/${key}` }).subscribe(() => {});
        }
        sockets.closeAll();
        assert.deepEqual(opened.map((s) => s.closed), [true, true]);
        assert.deepEqual(sockets.statuses(), []);
        assert.equal(sockets.get('a'), null);
    });
});

describe('rule G outranks rule E — a verdict is not undone by an unmount', () => {
    test('unsubscribing does not un-latch UNAVAILABLE', () => {
        const { sockets, opened } = makeSockets();
        const channel = sockets.channel({ key: 'plugin:x', path: '/ws/v1/plugins/p/e', maxAttempts: 2 });
        const off = channel.subscribe(() => {});
        opened[0].emit('connecting', {});
        opened[0].emit('connecting', {});
        assert.equal(channel.status().state, WS_STATE.UNAVAILABLE);

        off();                                  // the screen unmounts
        assert.equal(channel.status().state, WS_STATE.UNAVAILABLE, 'the feature is still absent');

        channel.subscribe(() => {});            // the screen comes back
        assert.equal(opened.length, 1, 'no second socket, and no restarted reconnect loop');
        assert.equal(channel.status().state, WS_STATE.UNAVAILABLE);

        channel.open();                         // coming back is still an explicit act
        assert.equal(opened.length, 2);
    });

    test('a subscriber that arrives after the verdict is TOLD, not left waiting', () => {
        const { sockets, opened } = makeSockets();
        const channel = sockets.channel({ key: 'plugin:x', path: '/ws/v1/plugins/p/e', maxAttempts: 1 });
        const off = channel.subscribe(() => {});
        opened[0].emit('connecting', {});
        off();

        const signals = [];
        channel.onSignal((s) => signals.push(s.kind));
        channel.subscribe(() => {});
        assert.deepEqual(signals, [WS_SIGNAL.UNAVAILABLE], 'absence is visible to the newcomer');
    });

    test('an ordinary channel still goes back to idle when the last subscriber leaves', () => {
        const { sockets, opened } = makeSockets();
        const channel = sockets.channel({ key: 'snap', path: '/ws/v1/machine/snapshot', channel: snapshot() });
        const off = channel.subscribe(() => {});
        opened[0].open();
        assert.equal(channel.status().state, WS_STATE.OPEN);
        off();
        assert.equal(channel.status().state, WS_STATE.IDLE);
        assert.equal(opened[0].closed, true);
    });
});

describe('status() says what is true, including after a close', () => {
    test('a socket the server closed is not reported open, and send() refuses on it', () => {
        const { sockets, opened } = makeSockets();
        const channel = sockets.channel({ key: 'devices', path: '/ws/v1/devices', channel: WS_CHANNELS.devices });
        channel.subscribe(() => {});
        opened[0].open();
        assert.equal(channel.status().state, WS_STATE.OPEN);
        assert.deepEqual(channel.send({ command: 'scan', connect: true, quick: false }), { ok: true });

        opened[0].emit('close', {});
        assert.equal(channel.status().state, WS_STATE.IDLE, 'not "open"');
        assert.equal(channel.last(), null);
        assert.deepEqual(
            channel.send({ command: 'scan', connect: true, quick: false }),
            { ok: false, reason: 'socket is not open' },
        );
    });

    test('a reconnect in progress still reads as connecting, not idle', () => {
        const { sockets, opened } = makeSockets();
        const channel = sockets.channel({ key: 'snap', path: '/ws/v1/machine/snapshot', channel: snapshot() });
        channel.subscribe(() => {});
        opened[0].open();
        opened[0].emit('connecting', {});
        opened[0].emit('close', {});
        assert.equal(channel.status().state, WS_STATE.CONNECTING);
    });
});
