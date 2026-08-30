// /ws/v1/devices — READ THE WHOLE CONNECTION STATE, AND ANSWER IT (B8).
//
// SCOPE Part 3 §2, devices row; Part 6, `machine-link.js` DROP row. ReaPrime publishes a
// complete connection state machine on this socket and the old skin reads ONE BOOLEAN off
// it — `data.scanning` — so "connecting to the wrong machine", "failed to connect" and
// "still trying" are the same picture. Everything below is already on the wire; reading it
// is free.
//
// THE PART THAT IS NOT FREE, AND IS THE WHOLE OF B8: WHILE `pendingAmbiguity` IS SET,
// ReaPrime IS WAITING FOR THE SKIN. `ConnectionManager` parks in a selection session and
// actively suppresses scale recovery until the choice arrives ("Skipping scale recovery
// while device selection is pending", `connection_manager.dart` `_connectImpl`). A skin
// that only reads sees a machine that never connects and a phase that never advances, with
// nothing anywhere saying it was asked a question. So this module SENDS the answer, over
// the contract-checked route.
//
// Two rules carried from `machine-link.js`, both cheap and both load-bearing:
//
//  1. A MALFORMED FRAME MAPS TO null, DISTINCT FROM AN EMPTY LIST. `null` is "we do not
//     know what is attached"; `[]` is "nothing is attached". Collapsing them reads a
//     partial frame as "the machine went away" and tears down a live session.
//  2. THE USB DEVICE ID IS BYTE-IDENTICAL ACROSS A POWER CYCLE (bench-proven). Any logic
//     built on "the id changed" would silently never fire. Nothing here diffs ids: the
//     phase, the connection state and the error field are the signals.
//
// AND ONE THIS SOCKET TEACHES BY ITSELF: it multiplexes COMMAND RESULTS with state frames.
// `_sendConnectResult` writes `{deviceId, operation, outcome, state, connectionError}` down
// the same wire as `_emitStateNow`'s snapshot. Read as a state frame, a command result has
// no `devices` key and no `scanning` key — which, under rule 1, is exactly a malformed
// frame and reads as null. rea-ws-channels.js classifies it as a COMMAND_RESULT first, so
// it arrives as a signal and never as "we do not know what is attached".
//
// Checked against `devices_handler.dart` AS WRITTEN at 2b047d02.

import { WS_CHANNELS, isFrameObject } from './rea-ws-channels.js';
import { routeById } from './rea-routes.js';

/** `ConnectionPhase` (connection_manager.dart). Ordered as ReaPrime declares them. */
export const CONNECTION_PHASE = Object.freeze({
    IDLE: 'idle',
    SCANNING: 'scanning',
    CONNECTING_MACHINE: 'connectingMachine',
    CONNECTING_SCALE: 'connectingScale',
    READY: 'ready',
});

/** `AmbiguityReason` (connection_manager.dart). The two questions ReaPrime can ask. */
export const AMBIGUITY = Object.freeze({
    MACHINE_PICKER: 'machinePicker',
    SCALE_PICKER: 'scalePicker',
});

export const CONNECTION_ERROR_SEVERITY = Object.freeze({
    WARNING: 'warning',
    ERROR: 'error',
});

export const SCAN_SCOPED_ERROR_KINDS = Object.freeze([
    'adapterOff',
    'bluetoothPermissionDenied',
    'scanFailed',
]);

/** `ConnectionOutcome` (scan_report.dart) — the answer to a connect command. */
export const CONNECT_OUTCOME = Object.freeze({
    CONNECTED: 'connected',
    ALREADY_CONNECTED: 'alreadyConnected',
    CONFLICT: 'conflict',
    FAILED: 'failed',
    TIMED_OUT: 'timedOut',
});

/** `ConnectionState` (device.dart) — per-device, on every list entry. */
export const DEVICE_STATE = Object.freeze({
    DISCOVERED: 'discovered',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTING: 'disconnecting',
    DISCONNECTED: 'disconnected',
});

/** `DeviceType` (device.dart). */
export const DEVICE_TYPE = Object.freeze({
    MACHINE: 'machine',
    SCALE: 'scale',
    SENSOR: 'sensor',
});

const PHASES = new Set(Object.values(CONNECTION_PHASE));
const AMBIGUITIES = new Set(Object.values(AMBIGUITY));

export const DEVICES_ROUTES = Object.freeze({
    connect: routeById('putDevicesConnect').route,
    disconnect: routeById('putDevicesDisconnect').route,
});

function readDevice(entry) {
    if (!entry || typeof entry !== 'object') return null;
    if (typeof entry.id !== 'string') return null;
    return Object.freeze({
        id: entry.id,
        name: typeof entry.name === 'string' ? entry.name : null,
        type: typeof entry.type === 'string' ? entry.type : null,
        state: typeof entry.state === 'string' ? entry.state : null,
        // Present on the list route and the socket's `devices`, absent on the
        // `foundMachines`/`foundScales` entries, which the handler builds by hand.
        available: typeof entry.available === 'boolean' ? entry.available : null,
    });
}

function readDeviceList(value) {
    if (!Array.isArray(value)) return null;
    const read = value.map(readDevice);
    // One unreadable entry makes the LIST unreadable. Silently dropping it would report a
    // shorter list as fact, which is the "the machine went away" failure by another route.
    if (read.some((device) => device === null)) return null;
    return Object.freeze(read);
}

export function readConnectionStatus(status) {
    if (!status || typeof status !== 'object') return null;
    if (typeof status.phase !== 'string') return null;
    const foundMachines = readDeviceList(status.foundMachines);
    const foundScales = readDeviceList(status.foundScales);
    if (foundMachines === null || foundScales === null) return null;

    const pendingAmbiguity = status.pendingAmbiguity ?? null;
    if (pendingAmbiguity !== null && typeof pendingAmbiguity !== 'string') return null;

    return Object.freeze({
        phase: status.phase,
        // An unrecognised phase means ReaPrime knows a state this build does not. Visible,
        // never smoothed over — the same rule the address layer applies to MachineState.
        phaseKnown: PHASES.has(status.phase),
        foundMachines,
        foundScales,
        pendingAmbiguity,
        ambiguityKnown: pendingAmbiguity === null || AMBIGUITIES.has(pendingAmbiguity),
        /** ReaPrime is waiting for a choice, and is suppressing recovery until it comes. */
        awaitingChoice: pendingAmbiguity !== null,
        /** `ConnectionError.toJson`, verbatim: {kind, severity, timestamp, message,
         *  deviceId?, deviceName?, suggestion?, details?}. Rendered by a screen, not here. */
        error: status.error && typeof status.error === 'object' ? Object.freeze({ ...status.error }) : null,
    });
}

/**
 * Read one `/ws/v1/devices` state frame.
 *
 * @param {unknown} frame
 * @returns {object|null} null for a malformed or partial frame — NEVER an empty list
 */
export function readDevicesFrame(frame) {
    // The tree's ONE frame predicate — the same one the classifier and the address layer
    // ask. This guard was already right; it is imported rather than restated so there is
    // one place to be right in.
    if (!isFrameObject(frame)) return null;
    // A command result is not a state frame. It reaches here only if a caller bypassed the
    // classifier; named explicitly so the null it returns has a reason.
    if (typeof frame.operation === 'string') return null;

    const devices = readDeviceList(frame.devices);
    if (devices === null) return null;
    if (typeof frame.scanning !== 'boolean') return null;

    const connectionStatus = readConnectionStatus(frame.connectionStatus);
    if (connectionStatus === null) return null;

    return Object.freeze({
        timestamp: typeof frame.timestamp === 'string' ? frame.timestamp : null,
        devices,
        scanning: frame.scanning,
        // Optional by construction: the handler omits it when there is no battery
        // controller or no charging state. Absent is normal; null means "no such thing
        // here", which is different from a charging state of false.
        charging: Object.hasOwn(frame, 'charging') && frame.charging && typeof frame.charging === 'object'
            ? Object.freeze({ ...frame.charging })
            : null,
        connectionStatus,
        /** The connected machine, or null. No name-sniffing, no id-diffing (rule 2). */
        machine: devices.find((d) => d.type === DEVICE_TYPE.MACHINE && d.state === DEVICE_STATE.CONNECTED) || null,
        scale: devices.find((d) => d.type === DEVICE_TYPE.SCALE && d.state === DEVICE_STATE.CONNECTED) || null,
    });
}

export function readConnectResult(body) {
    if (!body || typeof body !== 'object') return null;
    const outcome = typeof body.outcome === 'string' ? body.outcome : null;
    return Object.freeze({
        deviceId: typeof body.deviceId === 'string' ? body.deviceId : null,
        operation: typeof body.operation === 'string' ? body.operation : null,
        outcome,
        succeeded: outcome === CONNECT_OUTCOME.CONNECTED || outcome === CONNECT_OUTCOME.ALREADY_CONNECTED,
        state: typeof body.state === 'string' ? body.state : null,
        connectionError: body.connectionError && typeof body.connectionError === 'object'
            ? Object.freeze({ ...body.connectionError })
            : null,
        /** Set only on the socket reply, where a failure is flagged with a top-level
         *  `error` string as well as the body (`_sendConnectResult`). */
        error: typeof body.error === 'string' ? body.error : null,
    });
}

export function createDevicesLink({ sockets, transport, logger = null } = {}) {
    if (!sockets || typeof sockets.channel !== 'function') {
        throw new Error('createDevicesLink: sockets must be injected');
    }
    if (!transport || typeof transport.put !== 'function') {
        throw new Error('createDevicesLink: transport must be injected');
    }
    const log = logger && logger.scope ? logger.scope('devices') : logger;
    const row = WS_CHANNELS.devices;
    const channel = sockets.channel({ key: row.key, path: row.path, channel: row });

    return {
        channel,

        subscribe(listener) {
            return channel.subscribe((frame) => {
                const state = readDevicesFrame(frame);
                if (state === null && log && log.warn) log.warn('malformed devices frame');
                listener(state);
            });
        },

        /** Signals: command results, error envelopes, open/close. */
        onSignal(listener) {
            return channel.onSignal(listener);
        },

        /** The latest parsed state, or null. */
        last() {
            return readDevicesFrame(channel.last());
        },

        async connect(deviceId) {
            return this._deviceCommand(DEVICES_ROUTES.connect, deviceId);
        },

        /** PUT /api/v1/devices/disconnect {deviceId} -> DevicesHandler._handleDisconnect.
         *  Answers `jsonOk(null)`, so there is no result body to read — only a status. */
        async disconnect(deviceId) {
            return this._deviceCommand(DEVICES_ROUTES.disconnect, deviceId);
        },

        async _deviceCommand(path, deviceId) {
            if (typeof deviceId !== 'string' || !deviceId) {
                throw new Error('devices: deviceId is required');
            }
            const response = await transport.put(path, { deviceId });
            if (response.ok) {
                return { ok: true, result: readConnectResult(response.data), failure: null };
            }
            // The refusal bodies ARE the answer here; keep them, do not translate them
            // into a boolean (that translation is what B8 is undoing).
            return { ok: false, result: readConnectResult(response.problem), failure: response };
        },

        connectOverSocket(deviceId) {
            if (typeof deviceId !== 'string' || !deviceId) {
                throw new Error('devices: deviceId is required');
            }
            return channel.send({ command: 'connect', deviceId });
        },

        /** `{"command":"scan", connect, quick}`. `connect` defaults to TRUE server-side. */
        scanOverSocket({ connect = true, quick = false } = {}) {
            return channel.send({ command: 'scan', connect, quick });
        },
    };
}
