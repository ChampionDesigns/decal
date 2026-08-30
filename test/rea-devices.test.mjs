// /ws/v1/devices — B8: read the whole connection state, and answer it.
//
// FIXTURES ARE CONTRACT-CHECKED, NOT INVENTED (Gate B rule 4). Every frame below is the
// literal shape ReaPrime writes at 2b047d02:
//   * the state frame       — DevicesStateAggregator._buildSnapshot
//   * each device entry     — DeviceListEntry.toJson  {name, id, state, type, available}
//   * foundMachines/Scales  — built inline by _buildSnapshot: {name, id, state, type},
//                             WITHOUT `available` (that asymmetry is real, and is why
//                             `available` reads as null rather than false there)
//   * connectionStatus      — {phase, foundMachines, foundScales, pendingAmbiguity, error}
//   * error                 — ConnectionError.toJson
//   * connect result        — DevicesHandler._connectResultBody
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    readDevicesFrame,
    readConnectionStatus,
    readConnectResult,
    createDevicesLink,
    CONNECTION_PHASE,
    AMBIGUITY,
    CONNECT_OUTCOME,
    DEVICES_ROUTES,
} from '../src/data/rea-devices.js';
import { createReaSockets } from '../src/data/rea-sockets.js';
import { WS_CHANNELS } from '../src/data/rea-ws-channels.js';

const machineEntry = {
    name: 'Bengle 1', id: 'usb:1-4.2', state: 'connected', type: 'machine', available: true,
};
const scaleEntry = {
    name: 'Decent Scale', id: 'ble:CF:12', state: 'disconnected', type: 'scale', available: false,
};

/** The steady state: one machine connected, one remembered scale, nothing pending. */
const READY_FRAME = Object.freeze({
    timestamp: '2026-08-17T09:14:22.000Z',
    devices: [machineEntry, scaleEntry],
    scanning: false,
    connectionStatus: {
        phase: 'ready',
        foundMachines: [],
        foundScales: [],
        pendingAmbiguity: null,
        error: null,
    },
});

/** The frame B8 exists for: two machines visible, ReaPrime parked, waiting for a choice. */
const AMBIGUOUS_FRAME = Object.freeze({
    timestamp: '2026-08-17T09:14:25.000Z',
    devices: [],
    scanning: true,
    connectionStatus: {
        phase: 'scanning',
        foundMachines: [
            { name: 'Bengle 1', id: 'usb:1-4.2', state: 'discovered', type: 'machine' },
            { name: 'Bengle 2', id: 'usb:1-4.3', state: 'discovered', type: 'machine' },
        ],
        foundScales: [],
        pendingAmbiguity: 'machinePicker',
        error: null,
    },
});

describe('reading the frame', () => {
    test('the whole connection state, not one boolean', () => {
        const state = readDevicesFrame(READY_FRAME);
        assert.equal(state.scanning, false);
        assert.equal(state.connectionStatus.phase, CONNECTION_PHASE.READY);
        assert.equal(state.connectionStatus.phaseKnown, true);
        assert.equal(state.connectionStatus.awaitingChoice, false);
        assert.equal(state.machine.id, 'usb:1-4.2');
        assert.equal(state.scale, null, 'a remembered scale is not a connected one');
        assert.equal(state.devices[1].available, false);
        assert.equal(state.charging, null, 'absent charging is normal, not false');
    });

    test('pendingAmbiguity is read, so "pick one" is distinguishable from "still trying"', () => {
        const state = readDevicesFrame(AMBIGUOUS_FRAME);
        assert.equal(state.connectionStatus.pendingAmbiguity, AMBIGUITY.MACHINE_PICKER);
        assert.equal(state.connectionStatus.awaitingChoice, true);
        assert.equal(state.connectionStatus.foundMachines.length, 2);
        assert.equal(state.connectionStatus.foundMachines[0].available, null,
            'foundMachines entries carry no `available` key — absent, not false');
    });

    test('the error field is carried verbatim, so "failed" is not "still trying"', () => {
        const frame = {
            ...READY_FRAME,
            connectionStatus: {
                ...READY_FRAME.connectionStatus,
                phase: 'idle',
                error: {
                    kind: 'machineConnectFailed',
                    severity: 'error',
                    timestamp: '2026-08-17T09:14:20.000Z',
                    message: 'Bengle 1 failed to connect.',
                    deviceId: 'usb:1-4.2',
                    deviceName: 'Bengle 1',
                    suggestion: 'Check that the device is available and try again.',
                },
            },
        };
        const state = readDevicesFrame(frame);
        assert.equal(state.connectionStatus.error.kind, 'machineConnectFailed');
        assert.equal(state.connectionStatus.error.message, 'Bengle 1 failed to connect.');
    });

    test('an unknown phase is visible rather than smoothed over', () => {
        const state = readDevicesFrame({
            ...READY_FRAME,
            connectionStatus: { ...READY_FRAME.connectionStatus, phase: 'connectingSensor' },
        });
        assert.equal(state.connectionStatus.phase, 'connectingSensor');
        assert.equal(state.connectionStatus.phaseKnown, false);
    });
});

describe('malformed maps to null, and null is not an empty list', () => {
    test('an empty device list is a fact, not an absence', () => {
        const state = readDevicesFrame({ ...READY_FRAME, devices: [] });
        assert.deepEqual(state.devices, []);
        assert.equal(state.machine, null);
    });

    for (const [what, frame] of [
        ['null', null],
        ['a string', 'scanning'],
        ['an array', [1, 2]],
        ['no devices key', { timestamp: 'x', scanning: false, connectionStatus: READY_FRAME.connectionStatus }],
        ['devices not an array', { ...READY_FRAME, devices: {} }],
        ['a device with no id', { ...READY_FRAME, devices: [{ name: 'x', type: 'machine' }] }],
        ['no scanning key', { timestamp: 'x', devices: [], connectionStatus: READY_FRAME.connectionStatus }],
        ['no connectionStatus', { timestamp: 'x', devices: [], scanning: false }],
        ['connectionStatus with no phase', { ...READY_FRAME, connectionStatus: { foundMachines: [], foundScales: [] } }],
        ['foundMachines not an array', {
            ...READY_FRAME,
            connectionStatus: { ...READY_FRAME.connectionStatus, foundMachines: null },
        }],
    ]) {
        test(`${what} reads as null`, () => {
            assert.equal(readDevicesFrame(frame), null);
        });
    }

    test('a partial frame never reads as "the machine went away"', () => {
        // The distinction machine-link.js was built on: null is "unknown", [] is "none".
        const unknown = readDevicesFrame({ ...READY_FRAME, devices: undefined });
        assert.equal(unknown, null);
        assert.notDeepEqual(unknown, []);
    });

    test('a command result is not a state frame', () => {
        const result = { deviceId: 'usb:1-4.2', operation: 'connect', outcome: 'connected', state: 'connected' };
        assert.equal(readDevicesFrame(result), null, 'it has no devices key — reading it as state is the defect');
    });

    test('readConnectionStatus rejects a non-string pendingAmbiguity', () => {
        assert.equal(readConnectionStatus({ phase: 'idle', foundMachines: [], foundScales: [], pendingAmbiguity: 3 }), null);
        assert.equal(readConnectionStatus(null), null);
    });
});

describe('the answer path', () => {
    /** A transport double recording every call. */
    function fakeTransport(plan = () => ({ ok: true, status: 200, data: null })) {
        const calls = [];
        const request = async (method, path, body) => {
            calls.push({ method, path, body });
            return plan(method, path, body, calls.length);
        };
        return {
            calls,
            get: (path) => request('GET', path),
            put: (path, body) => request('PUT', path, body),
            post: (path, body) => request('POST', path, body),
        };
    }

    function linkWith(transport) {
        const opened = [];
        const createSocket = (url) => {
            const listeners = new Map();
            const socket = {
                url,
                sent: [],
                closed: false,
                addEventListener(t, f) { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t).add(f); },
                removeEventListener(t, f) { listeners.get(t)?.delete(f); },
                close() { this.closed = true; },
                send(d) { this.sent.push(d); },
                emit(type, event = {}) { for (const f of [...(listeners.get(type) || [])]) f({ type, ...event }); },
                message(payload) { this.emit('message', { data: JSON.stringify(payload) }); },
                open() { this.emit('open'); },
            };
            opened.push(socket);
            return socket;
        };
        const sockets = createReaSockets({ createSocket, socketBaseUrl: 'ws://rea.test:8080' });
        return { link: createDevicesLink({ sockets, transport }), sockets, opened };
    }

    test('connect PUTs {deviceId} to /devices/connect and reads the outcome', async () => {
        const transport = fakeTransport(() => ({
            ok: true,
            status: 200,
            data: {
                deviceId: 'usb:1-4.2',
                operation: 'connect',
                outcome: 'connected',
                state: 'connected',
                connectionError: null,
            },
        }));
        const { link } = linkWith(transport);
        const answer = await link.connect('usb:1-4.2');
        assert.deepEqual(transport.calls, [{ method: 'PUT', path: DEVICES_ROUTES.connect, body: { deviceId: 'usb:1-4.2' } }]);
        assert.equal(answer.ok, true);
        assert.equal(answer.result.outcome, CONNECT_OUTCOME.CONNECTED);
        assert.equal(answer.result.succeeded, true);
    });

    test('a 409 conflict is read out of the refusal body, not turned into a boolean', async () => {
        const transport = fakeTransport(() => ({
            ok: false,
            kind: 'http',
            status: 409,
            message: 'PUT /devices/connect -> 409',
            problem: {
                deviceId: 'usb:1-4.3',
                operation: 'connect',
                outcome: 'conflict',
                state: 'disconnected',
                connectionError: null,
            },
        }));
        const { link } = linkWith(transport);
        const answer = await link.connect('usb:1-4.3');
        assert.equal(answer.ok, false);
        assert.equal(answer.result.outcome, CONNECT_OUTCOME.CONFLICT);
        assert.equal(answer.result.succeeded, false);
        assert.equal(answer.failure.status, 409, 'the failure itself is still available to the caller');
    });

    test('a 504 timeout keeps ReaPrime\'s own message for the screen', async () => {
        const transport = fakeTransport(() => ({
            ok: false,
            kind: 'http',
            status: 504,
            message: 'PUT /devices/connect -> 504',
            problem: {
                deviceId: 'usb:1-4.2',
                operation: 'connect',
                outcome: 'timedOut',
                state: 'disconnected',
                connectionError: {
                    kind: 'machineConnectFailed',
                    severity: 'error',
                    timestamp: '2026-08-17T09:14:30.000Z',
                    message: 'Bengle 1 did not respond before the connection timed out.',
                    suggestion: 'Check that the device is available and try again.',
                },
            },
        }));
        const { link } = linkWith(transport);
        const answer = await link.connect('usb:1-4.2');
        assert.equal(answer.result.outcome, CONNECT_OUTCOME.TIMED_OUT);
        assert.match(answer.result.connectionError.message, /did not respond/);
    });

    test('disconnect uses its own route', async () => {
        const transport = fakeTransport();
        const { link } = linkWith(transport);
        await link.disconnect('ble:CF:12');
        assert.deepEqual(transport.calls[0], {
            method: 'PUT', path: DEVICES_ROUTES.disconnect, body: { deviceId: 'ble:CF:12' },
        });
    });

    test('a missing deviceId is refused here rather than 400ing at the server', async () => {
        const { link } = linkWith(fakeTransport());
        await assert.rejects(() => link.connect(''), /deviceId is required/);
        assert.throws(() => link.connectOverSocket(null), /deviceId is required/);
    });

    test('the same answer can go over the socket', () => {
        const { link, opened } = linkWith(fakeTransport());
        link.subscribe(() => {});
        opened[0].open();
        assert.deepEqual(link.connectOverSocket('usb:1-4.3'), { ok: true });
        assert.deepEqual(opened[0].sent, ['{"command":"connect","deviceId":"usb:1-4.3"}']);
        assert.deepEqual(link.scanOverSocket({ quick: true }), { ok: true });
        assert.deepEqual(JSON.parse(opened[0].sent[1]), { command: 'scan', connect: true, quick: true });
    });

    test('the socket answer fails cleanly when the socket is not open', () => {
        const { link } = linkWith(fakeTransport());
        assert.deepEqual(link.connectOverSocket('usb:1-4.3'), { ok: false, reason: 'socket is not open' });
    });
});

describe('the link on the wire', () => {
    function linkOnSocket() {
        const opened = [];
        const createSocket = (url) => {
            const listeners = new Map();
            const socket = {
                url,
                sent: [],
                closed: false,
                addEventListener(t, f) { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t).add(f); },
                removeEventListener(t, f) { listeners.get(t)?.delete(f); },
                close() { this.closed = true; },
                send(d) { this.sent.push(d); },
                emit(type, event = {}) { for (const f of [...(listeners.get(type) || [])]) f({ type, ...event }); },
                message(payload) { this.emit('message', { data: JSON.stringify(payload) }); },
                open() { this.emit('open'); },
            };
            opened.push(socket);
            return socket;
        };
        const sockets = createReaSockets({ createSocket, socketBaseUrl: 'ws://rea.test:8080' });
        const transport = { put: async () => ({ ok: true, data: null }), get: async () => ({ ok: true, data: null }) };
        return { link: createDevicesLink({ sockets, transport }), opened };
    }

    test('it dials the documented path and parses each frame', () => {
        const { link, opened } = linkOnSocket();
        const states = [];
        link.subscribe((s) => states.push(s));
        assert.equal(opened[0].url, `ws://rea.test:8080${WS_CHANNELS.devices.path}`);
        opened[0].open();
        opened[0].message(READY_FRAME);
        opened[0].message(AMBIGUOUS_FRAME);
        assert.equal(states[0].connectionStatus.phase, 'ready');
        assert.equal(states[1].connectionStatus.awaitingChoice, true);
        assert.equal(link.last().connectionStatus.pendingAmbiguity, 'machinePicker');
    });

    test('a malformed frame delivers null — a state the screen can render', () => {
        const { link, opened } = linkOnSocket();
        const states = [];
        link.subscribe((s) => states.push(s));
        opened[0].open();
        opened[0].message({ scanning: true });
        assert.deepEqual(states, [null]);
    });

    test('a connect reply arrives as a signal, never as "we do not know what is attached"', () => {
        const { link, opened } = linkOnSocket();
        const states = []; const signals = [];
        link.subscribe((s) => states.push(s));
        link.onSignal((s) => signals.push(s));
        opened[0].open();
        opened[0].message(READY_FRAME);
        opened[0].message({ deviceId: 'usb:1-4.2', operation: 'connect', outcome: 'connected', state: 'connected' });
        assert.equal(states.length, 1, 'the command result must not reach the state subscriber');
        assert.equal(signals.at(-1).kind, 'commandResult');
        assert.equal(readConnectResult(signals.at(-1).data).succeeded, true);
        assert.equal(link.last().connectionStatus.phase, 'ready', 'and must not clobber the last known state');
    });
});
