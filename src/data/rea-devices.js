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

/**
 * `ConnectionErrorSeverity` (connection_error.dart) — the two levels ReaPrime stamps on
 * every `ConnectionError`, and it USES the difference rather than writing `error` twice.
 * Measured at the pin: a machine disconnecting unexpectedly is `error`
 * (`disconnect_supervisor.dart:134`), the SAME event for a scale is `warning` (`:153`),
 * and a profile that failed to upload is `warning` (`workflow_device_sync.dart:155`).
 *
 * So this is upstream's own answer to "does this deserve the alarm", published on the wire
 * and, until 28 August 2026, read by nothing here. `connection-surface.js` reads it now.
 */
export const CONNECTION_ERROR_SEVERITY = Object.freeze({
    WARNING: 'warning',
    ERROR: 'error',
});

/**
 * THE ERROR KINDS THAT ARE ABOUT THE SCAN TRANSPORT AND NOT ABOUT A CONNECTION.
 *
 * This is `ConnectionErrorKind.sticky` (connection_error.dart:13-17) copied verbatim, and
 * the two names describe one set for one reason. Upstream calls it `sticky` for its
 * MECHANISM: `StatusPublisher.publish` clears an ordinary error when the phase moves into
 * scanning/connectingMachine/connectingScale/ready, and deliberately does NOT clear these
 * three (`status_publisher.dart:30-45`) — it even re-attaches them to a later status that
 * carries no error of its own. It is named here for what makes that correct: every member
 * is a statement about the RADIO, not about a device or an attempt.
 *
 *   adapterOff                  the Bluetooth adapter is switched off
 *   bluetoothPermissionDenied   the app may not use it
 *   scanFailed                  the sweep itself would not start
 *
 * None of the three is reachable by connecting to something, and none of them stops
 * anything that is ALREADY connected — which is exactly why upstream lets them outlive a
 * phase change, and exactly why they must not be read as "could not connect". See
 * `connection-surface.js`'s ERROR_SCOPE for the rule this feeds and Ben's bug of
 * 28 August 2026 for why it exists.
 *
 * WHY A PINNED SET AND NOT A FIELD ON THE WIRE. There is no `scope` on `ConnectionError`.
 * The nearest structural proxy is `deviceId`, which the connection kinds carry
 * (`connection_manager.dart:370`, `disconnect_supervisor.dart:136`) and the scan kinds do
 * not (`connection_manager.dart:447-467`, `scan_orchestrator.dart:130-141`) — but it is an
 * OPTIONAL key, so its absence is "no device was named", never "this is about the radio".
 * Reading a scope out of a missing key would be the invention A7 forbids. A hand-placed
 * copy of upstream's own set, pinned by `test/rea-dart-freshness.test.mjs` against the
 * Dart that declares it, is the honest form: a fourth member upstream adds fails a test
 * here, where a person decides what it is, instead of arriving silently on a bench frame.
 */
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

/**
 * THE TWO REST PATHS THIS MODULE CALLS — TAKEN FROM THE GENERATED TABLE, NOT SPELLED HERE.
 *
 * This was a five-row literal table, three rows of which were never called at all, sitting
 * beside a generated table carrying every path ReaPrime documents. Two copies of one
 * server truth is two things to drift, and `routeById` fails loudly on an id the pinned
 * spec does not carry, where a string literal fails silently by 404ing at runtime.
 *
 * The three uncalled rows (`/devices`, `/devices/scan`, `/devices/forget`) are gone: the
 * connection state arrives on the socket, and a caller that later needs one of them reaches
 * it with `callRoute(transport, 'getDevices')` — same table, no new addressing.
 */
export const DEVICES_ROUTES = Object.freeze({
    connect: routeById('putDevicesConnect').route,
    disconnect: routeById('putDevicesDisconnect').route,
});

/**
 * Read one device list entry (`DeviceListEntry.toJson`).
 *
 * `available: false` is a REMEMBERED device — one ReaPrime knows about but cannot see
 * right now. It is a real, useful third state between "connected" and "not there", and it
 * is the reason a picker can offer a machine that is asleep.
 */
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

/**
 * Read `connectionStatus` (`DevicesStateAggregator._buildSnapshot`).
 *
 * ReaPrime writes all five keys unconditionally, `pendingAmbiguity` and `error` as null
 * when there is none, so here NULL is the absence signal and an ABSENT key is a malformed
 * frame — the opposite of the machine snapshot's rule, and true of this frame because the
 * handler builds the map literally rather than conditionally.
 *
 * @returns {object|null} null if the block is malformed
 */
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

/**
 * Read a connect/disconnect result — from the socket, or out of the REST response.
 *
 * The two transports answer with the SAME body; only the envelope differs. Over REST the
 * outcome is also encoded in the status (200 connected/alreadyConnected, 409 conflict,
 * 503 failed, 504 timedOut), so a failure result still carries a readable body, and
 * `connectResult` reads it from `problem` — that is reading the server's own answer, not
 * manufacturing one.
 */
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

/**
 * The devices link: the socket, parsed, plus the answer path.
 *
 * @param {object} deps
 * @param {object} deps.sockets    createReaSockets(...)
 * @param {object} deps.transport  createReaTransport(...) — the answer goes over REST
 * @param {object} [deps.logger]
 */
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

        /**
         * Observe the parsed connection state. A malformed frame delivers `null` — the
         * subscriber is told "unknown", which is a state it can render, rather than being
         * told a lie it cannot detect.
         */
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

        /**
         * ANSWER the pending choice, or connect on purpose. Same route either way:
         * `_connectDevice` checks `pendingAmbiguity` itself and routes to
         * `selectMachine`/`selectScale` when a selection session is open, `connectMachine`/
         * `connectScale` when it is not. So the skin does not need to know which it is —
         * and cannot get it wrong.
         *
         * PUT /api/v1/devices/connect  {deviceId}  -> DevicesHandler._handleConnect
         *   200 connected|alreadyConnected · 409 conflict · 503 failed · 504 timedOut
         *   400 {'error': 'Missing deviceId'} · 404 {'error': 'Device not found: <id>'}
         *
         * @returns {{ok: boolean, result: object|null, failure: object|null}}
         */
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

        /**
         * The same answer over the socket: `{"command":"connect","deviceId":…}`
         * (`DevicesHandler._handleCommand`). Offered because the spec names both
         * transports, and because commands on this socket are serialised server-side
         * through one queue. The REST route above is the primary path: it returns a status
         * the caller can await, where the socket reply arrives later as a signal.
         */
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
