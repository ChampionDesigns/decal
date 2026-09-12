/**
 * The shot just pulled becomes the shot the app is talking about, and an expanded chart's
 * header names the shot it is drawing rather than the profile the machine has armed. The
 * machine publishes the finished state before it persists the record, so the only way to
 * learn the record landed is to ask for the list again.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    createAppBoot, SAVED_SHOT, SAVED_SHOT_ATTEMPTS,
} from '../src/lib/app-boot.js';
import { WS_CHANNELS } from '../src/data/rea-ws-channels.js';
import { shotIdentity } from '../src/lib/expanded-summary.js';

const LOCATION = { hostname: '127.0.0.1', protocol: 'http:' };

/** A WebSocket double. Nothing dials; the test drives every frame. */
function fakeSocketFactory() {
    const sockets = [];
    const factory = (url) => {
        const listeners = new Map();
        const socket = {
            url,
            addEventListener(type, fn) {
                if (!listeners.has(type)) listeners.set(type, new Set());
                listeners.get(type).add(fn);
            },
            removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
            close() {},
            send() {},
            emit(type, event) { for (const fn of [...(listeners.get(type) ?? [])]) fn(event); },
        };
        sockets.push(socket);
        return socket;
    };
    factory.sockets = sockets;
    factory.forPath = (path) => sockets.find((s) => String(s.url).endsWith(path)) ?? null;
    return factory;
}

const shotRow = (id, timestamp, title) => ({
    id,
    timestamp,
    workflow: { profile: { title } },
    annotations: {},
    stopReason: 'weight',
});

/**
 * A server holding a list of shots, which answers the two shots routes and 503 for
 * everything else the boot asks for. `landAfter` is the persistence lag: the pending shot
 * joins the list only once the page has been asked for that many times, and the boot's own
 * read is the first.
 */
function stagedServer({ shots = [], pending = null, landAfter = 1 } = {}) {
    const state = { shots: shots.slice(), pending, landAfter, pageReads: 0 };
    const json = (body) => ({
        ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(body),
    });
    const impl = async (url) => {
        const at = new URL(url, 'http://127.0.0.1:8080');
        if (at.pathname === '/api/v1/shots') {
            state.pageReads += 1;
            if (state.pending && state.pageReads > state.landAfter) {
                state.shots = [state.pending, ...state.shots];
                state.pending = null;
            }
            const limit = Number.parseInt(at.searchParams.get('limit') ?? '20', 10);
            const offset = Number.parseInt(at.searchParams.get('offset') ?? '0', 10);
            return json({
                items: state.shots.slice(offset, offset + limit),
                total: state.shots.length,
                limit,
                offset,
            });
        }
        const one = /^\/api\/v1\/shots\/(.+)$/.exec(at.pathname);
        if (one) {
            const id = decodeURIComponent(one[1]);
            const held = state.shots.find((shot) => shot.id === id);
            if (!held) {
                return {
                    ok: false, status: 404, headers: { get: () => null },
                    text: async () => JSON.stringify({ error: 'Shot not found' }),
                };
            }
            return json({ ...held, measurements: [] });
        }
        /* Everything else the boot asks for answers as an honest miss: none of those
         * reads is this subject. */
        return {
            ok: false, status: 503, headers: { get: () => null },
            text: async () => JSON.stringify({ error: 'no recording' }),
        };
    };
    impl.state = state;
    return impl;
}

/** A shot-state frame as `ShotStateEvent.toJson` writes one. Every key is written. */
const shotStateFrame = ({ state, shotId }) => ({
    event: 'state',
    timestamp: '2026-09-09T08:00:00.000Z',
    shotId,
    state,
    machineState: 'espresso',
    machineSubstate: 'pouring',
    profileFrame: 2,
    scaleConnected: true,
    scaleLost: false,
    machineHasAutonomousSAW: false,
    decision: null,
});

/**
 * Build a boot over the staged server, with the wait between re-reads collapsed. The
 * injected `wait` resolves at once; what the test asserts on is how many times the page
 * was asked for, which the server counts.
 */
function bootOver(fetchImpl) {
    const createSocket = fakeSocketFactory();
    const waits = [];
    const boot = createAppBoot({
        fetch: fetchImpl,
        createSocket,
        location: LOCATION,
        importModule: async () => ({}),
        wait: async (ms) => { waits.push(ms); },
    });
    return { boot, createSocket, waits };
}

/** Let every started promise in the shell settle. The reads are chained, never awaited. */
async function settle(times = 12) {
    for (let i = 0; i < times; i += 1) await Promise.resolve();
    await new Promise((done) => { setImmediate(done); });
    for (let i = 0; i < times; i += 1) await Promise.resolve();
}

/** Tell the app the machine has finished a shot, exactly as the sequencer does. */
function finishShot(createSocket, shotId) {
    const socket = createSocket.forPath(WS_CHANNELS.shotState.path);
    assert.ok(socket, 'the shot-state socket is open');
    socket.emit('open', {});
    socket.emit('message', {
        data: JSON.stringify(shotStateFrame({ state: 'finished', shotId })),
    });
    return socket;
}

const OLD = shotRow('shot-old', '2026-09-09T07:48:00.000', 'Extractamundo Dos!');
const NEW = shotRow('shot-new', '2026-09-09T08:00:00.000', 'Gentle and sweet');

describe('a finished shot becomes the shot Live is about', () => {
    test('the page is re-read and the newest row is the shot that just finished', async () => {
        const fetchImpl = stagedServer({ shots: [OLD], pending: NEW });
        const { boot, createSocket } = bootOver(fetchImpl);
        await boot.start();
        await settle();

        assert.deepEqual(boot.shotHistory.get().items.map((s) => s.id), ['shot-old'],
            'the boot read a page that could not contain a shot nobody had pulled yet');

        finishShot(createSocket, 'shot-new');
        await settle();

        const saved = boot.savedShot.get();
        assert.equal(saved.shotId, 'shot-new');
        assert.equal(saved.status, SAVED_SHOT.READY);
        assert.deepEqual(boot.shotHistory.get().items.map((s) => s.id), ['shot-new', 'shot-old'],
            'the list carries the shot that was just pulled, at its head');
        assert.ok(boot.shotHistory.recordOf('shot-new'),
            'and its record was fetched, which is what the chart draws from');
        boot.destroy();
    });

    test('the first shot on a machine with no history at all becomes the record', async () => {
        const fetchImpl = stagedServer({ shots: [], pending: NEW });
        const { boot, createSocket } = bootOver(fetchImpl);
        await boot.start();
        await settle();
        assert.deepEqual(boot.shotHistory.get().items, []);

        finishShot(createSocket, 'shot-new');
        await settle();

        assert.equal(boot.savedShot.get().status, SAVED_SHOT.READY);
        assert.deepEqual(boot.shotHistory.get().items.map((s) => s.id), ['shot-new']);
        boot.destroy();
    });

    test('persistence lags: the state says waiting, and says ready only when the row is there', async () => {
        /* The record lands on the THIRD look. Between the finished frame and that look
         * the newest row on the server is still the previous shot. */
        const fetchImpl = stagedServer({ shots: [OLD], pending: NEW, landAfter: 3 });
        const { boot, createSocket } = bootOver(fetchImpl);
        await boot.start();
        await settle();

        const seen = [];
        const stop = boot.savedShot.subscribe((state) => seen.push(`${state.status}:${state.attempts}`));
        finishShot(createSocket, 'shot-new');
        await settle();
        stop();

        assert.ok(seen.includes('waiting:1'), `waiting was reported first: ${seen.join(' ')}`);
        assert.ok(seen.includes('waiting:2'), `and again while the record was still missing: ${seen.join(' ')}`);
        assert.equal(boot.savedShot.get().status, SAVED_SHOT.READY);
        assert.equal(boot.savedShot.get().attempts, 3, 'ready on the look that found it');
        assert.deepEqual(boot.shotHistory.get().items.map((s) => s.id), ['shot-new', 'shot-old']);
        boot.destroy();
    });

    test('a record that never lands is UNAVAILABLE — never the previous shot wearing its name', async () => {
        const fetchImpl = stagedServer({ shots: [OLD] });
        const { boot, createSocket, waits } = bootOver(fetchImpl);
        await boot.start();
        await settle();

        finishShot(createSocket, 'shot-never');
        await settle(40);

        const saved = boot.savedShot.get();
        assert.equal(saved.status, SAVED_SHOT.UNAVAILABLE);
        assert.equal(saved.shotId, 'shot-never', 'the shell still names the shot the machine pulled');
        assert.equal(saved.attempts, SAVED_SHOT_ATTEMPTS, 'the window is bounded');
        assert.equal(waits.length, SAVED_SHOT_ATTEMPTS - 1, 'one wait between each pair of looks');
        assert.deepEqual(boot.shotHistory.get().items.map((s) => s.id), ['shot-old'],
            'and the previous shot is still just the previous shot');
        boot.destroy();
    });

    test('one shot causes one refresh, however many times its frame is republished', async () => {
        // The feed replays its held frame to every late subscriber and on every staleness
        // pass, so the edge has to be the shot's ID rather than the arrival of a frame.
        const fetchImpl = stagedServer({ shots: [OLD], pending: NEW });
        const { boot, createSocket } = bootOver(fetchImpl);
        await boot.start();
        await settle();
        const before = fetchImpl.state.pageReads;

        const socket = finishShot(createSocket, 'shot-new');
        await settle();
        const after = fetchImpl.state.pageReads;
        socket.emit('message', { data: JSON.stringify(shotStateFrame({ state: 'finished', shotId: 'shot-new' })) });
        socket.emit('message', { data: JSON.stringify(shotStateFrame({ state: 'finished', shotId: 'shot-new' })) });
        await settle();

        assert.equal(after - before, 1, 'exactly one re-read for the shot');
        assert.equal(fetchImpl.state.pageReads, after, 'and none for its repeats');
        boot.destroy();
    });

    test('a shot that is still pouring is not a shot to go looking for', async () => {
        const fetchImpl = stagedServer({ shots: [OLD], pending: NEW });
        const { boot, createSocket } = bootOver(fetchImpl);
        await boot.start();
        await settle();
        const before = fetchImpl.state.pageReads;

        const socket = createSocket.forPath(WS_CHANNELS.shotState.path);
        socket.emit('open', {});
        for (const state of ['preheating', 'pouring', 'stopping']) {
            socket.emit('message', { data: JSON.stringify(shotStateFrame({ state, shotId: 'shot-new' })) });
        }
        await settle();

        assert.equal(fetchImpl.state.pageReads, before, 'nothing is read until the shot is over');
        assert.equal(boot.savedShot.get().status, SAVED_SHOT.IDLE);
        boot.destroy();
    });

    test('stop() takes the watcher with it', async () => {
        const fetchImpl = stagedServer({ shots: [OLD], pending: NEW });
        const { boot, createSocket } = bootOver(fetchImpl);
        await boot.start();
        await settle();
        const socket = createSocket.forPath(WS_CHANNELS.shotState.path);
        socket.emit('open', {});
        const before = fetchImpl.state.pageReads;

        boot.stop();
        socket.emit('message', { data: JSON.stringify(shotStateFrame({ state: 'finished', shotId: 'shot-new' })) });
        await settle();

        assert.equal(fetchImpl.state.pageReads, before,
            'a stopped shell asks nothing — a subscription outlived the shell that made it');
        boot.destroy();
    });
});

describe('the expanded chart identity', () => {
    /** The shape the overlay is handed: enough of it for the one line under test. */
    const drawn = (shotId) => ({ ok: true, reason: null, shotId, scalars: { durationSeconds: 28 } });

    test('it prints the name it is given for the shot it is drawing', () => {
        assert.equal(shotIdentity(drawn('shot-a'), { profileName: 'Extractamundo Dos!' }),
            'Extractamundo Dos!');
    });

    test('with no shot to draw it names nothing', () => {
        // A profile name over the overlay's own "no shot" face would title the empty
        // chart as that profile's shot.
        assert.equal(shotIdentity(null, { profileName: 'Gentle and sweet' }), '');
    });

    test('a derivation that refused names nothing either', () => {
        assert.equal(
            shotIdentity({ ok: false, reason: 'noPouringSample', shotId: 'shot-a' },
                { profileName: 'Gentle and sweet' }),
            '',
        );
    });

    test('an absent name is absent, never a placeholder', () => {
        assert.equal(shotIdentity(drawn('shot-a'), {}), '');
        assert.equal(shotIdentity(drawn('shot-a'), { profileName: '   ' }), '');
    });
});
