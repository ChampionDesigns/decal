// THE TEN WEBSOCKET CHANNELS — the endpoint table, as data.
//
// SCOPE Part 3 §2. Every row below was read from the handler AS WRITTEN at ReaPrime
// 2b047d02e42e29bf2d96a2aa964ef94e4a4daba3, and the table carries the handler file and
// symbol so the next reader re-checks it in one open rather than re-deriving it. The paths
// are also all nine documented URLs in `assets/api/websocket_v1.yml` (E2/M1: 9/9), plus the
// sensor route's per-id form.
//
// Route knowledge lives HERE, not in the socket engine (rea-sockets.js) and not in the
// consumers. rea-sockets.js knows how to own a socket; it does not know what a socket
// carries. That split is why there is one lifecycle policy instead of four.
//
// ── THE ONE THING THIS TABLE EXISTS TO SAY ────────────────────────────────────────────
//
// NOT EVERY MESSAGE ON A ReaPrime SOCKET IS A FRAME. Three of these ten multiplex
// something else onto the same wire, and reading that something else as a frame produces a
// plausible, wrong value rather than an error:
//
//   * `/ws/v1/scale/snapshot` interleaves `{"status":"connected"|"disconnected"}` with
//     `WeightSnapshot` (`scale_handler.dart` `_handleSnapshot` `sendStatus`). Read as a
//     snapshot, a status envelope has no `weight` and no `weightFlow` — indistinguishable
//     from a scale reporting nothing.
//   * `/ws/v1/devices` interleaves connect/disconnect COMMAND RESULTS
//     (`{deviceId, operation:'connect', outcome, state, connectionError}`) with the
//     aggregator's state snapshots (`devices_handler.dart` `_sendConnectResult` vs
//     `_emitStateNow`). The old skin reads `data.scanning` off whatever arrives; on a
//     command result that key is absent, which reads as "not scanning".
//   * The sensor socket answers an unknown id with `{"error":"not found"}` and closes
//     (`sensors_handler.dart` `_handleSensorSnapshot`); the devices, display and update
//     sockets answer a bad command with `{"error": ...}` on the frame channel.
//
// So classification is part of the contract, `classifyMessage` below is the one
// implementation of it, and an ERROR ENVELOPE IS A SIGNAL, NOT A FRAME.
//
// Read once, worth keeping: the FOUR machine-bound channels below (snapshot, shotSettings,
// shotState, waterLevels) ignore client messages ENTIRELY. `_withDe1Ws`'s stream listener
// returns before anything else when no `onMessage` was supplied, and only
// `/ws/v1/machine/raw` supplies one — so a command sent on those four gets no reply, not
// even a refusal. `websocket_v1.yml` says the same thing from the other side: "no error or
// status frame is emitted on this typed telemetry channel". Nothing here sends on them.
//
// ── DELIBERATELY ABSENT ───────────────────────────────────────────────────────────────
// `/ws/v1/machine/raw`, `/ws/v1/logs`, `/ws/v1/webview/logs` are not consumed. They are
// not in this table because a table of channels is a table of things we open. The reasons
// are written down once, in `EXCLUDED_WS.md`.

/** ReaPrime's WebSocket prefix. Every row's `path` begins with it. */
export const WS_PREFIX = '/ws/v1';

/** What a message off a socket turned out to be. */
export const WS_MESSAGE = Object.freeze({
    /** A state/telemetry frame: the thing the channel exists to carry. */
    FRAME: 'frame',
    /** ReaPrime's `{"error": ...}` envelope. A signal — act on it, never plot it. */
    ERROR: 'error',
    /** The scale's `{"status": ...}` connection envelope. */
    STATUS: 'status',
    /** A reply to a command WE sent (devices connect/disconnect). */
    COMMAND_RESULT: 'commandResult',
    /** Not JSON, or JSON that is not an object. Never guessed at. */
    MALFORMED: 'malformed',
});

/**
 * The ten channels.
 *
 * `key` is the lifecycle identity (see rea-sockets.js): one live socket per key, so a
 * second subscriber joins the first socket instead of opening a second. Templated
 * channels — sensors, plugins — take their key from the caller, because two sensors are
 * two sockets while two subscribers to one sensor are one.
 *
 * `commands` lists the command names the handler's own switch statement accepts. A command
 * this table does not name is a command ReaPrime answers `{"error":"Unknown command"}`.
 */
export const WS_CHANNELS = Object.freeze({
    machineSnapshot: Object.freeze({
        key: 'machineSnapshot',
        path: '/ws/v1/machine/snapshot',
        handlerFile: 'lib/src/services/webserver/de1handler.dart',
        handlerSymbol: 'De1Handler._handleSnapshot',
        carries: 'MachineSnapshot.toJson (machine.dart) — read it through rea-address.js',
        commands: null,
        note: 'The workhorse, ~10 Hz in a shot. The 15 Hz/66 ms figure elsewhere is the '
            + 'render budget, not the socket rate. Derived channels are OMITTED, not null. '
            + 'Survives a machine swap: _withDe1Ws re-attaches (ReaPrime 31ea7c1a), which is '
            + 'why socket-slot.js does not port.',
    }),
    scaleSnapshot: Object.freeze({
        key: 'scaleSnapshot',
        path: '/ws/v1/scale/snapshot',
        handlerFile: 'lib/src/services/webserver/scale_handler.dart',
        handlerSymbol: 'ScaleHandler._handleSnapshot',
        carries: 'WeightSnapshot (scale_controller.dart) — the ONE gravimetric source',
        commands: null,
        statusEnvelope: true,
        note: 'Interleaves {"status":"connected"|"disconnected"}. Status is a SIGNAL: it is '
            + 'the only notice that the scale left, since no further frames is otherwise '
            + 'indistinguishable from a scale that is simply not changing. The socket is '
            + 'held open across scale connect/disconnect cycles and websocket_v1.yml says '
            + 'in as many words that clients should NOT reconnect on a scale disconnect — '
            + 'so a `disconnected` status is never a reason to close this channel.',
    }),
    shotSettings: Object.freeze({
        key: 'shotSettings',
        path: '/ws/v1/machine/shotSettings',
        handlerFile: 'lib/src/services/webserver/de1handler.dart',
        handlerSymbol: 'De1Handler._handleShotSettings',
        carries: 'De1ShotSettings, re-emitted on change',
        commands: null,
        note: 'Read-back channel for the settings surfaces; pairs with '
            + 'POST /api/v1/machine/shotSettings.',
    }),
    shotState: Object.freeze({
        key: 'shotState',
        path: '/ws/v1/machine/shotState',
        handlerFile: 'lib/src/services/webserver/de1handler.dart',
        handlerSymbol: 'De1Handler._handleShotState',
        carries: 'Shot phase and decision frames from the shot sequencer',
        commands: null,
        note: 'One of the two channels the old tree opened with NO lifecycle policy at all — '
            + 'a second call leaked the first socket and doubled every frame.',
    }),
    waterLevels: Object.freeze({
        key: 'waterLevels',
        path: '/ws/v1/machine/waterLevels',
        handlerFile: 'lib/src/services/webserver/de1handler.dart',
        handlerSymbol: 'De1Handler._handleWaterLevels',
        carries: '{currentLevel, refillLevel} in MILLIMETRES',
        commands: null,
        note: 'mm->mL is skin-side (the 68-entry tank table has no ReaPrime counterpart). '
            + 'waterTank.js could not port until this module existed (SCOPE Part 6, gate 3).',
    }),
    devices: Object.freeze({
        key: 'devices',
        path: '/ws/v1/devices',
        handlerFile: 'lib/src/services/webserver/devices_handler.dart',
        handlerSymbol: 'DevicesHandler._handleDevicesSocket',
        carries: 'devices[], scanning, charging?, connectionStatus{} — B8, read it through '
            + 'rea-devices.js',
        commands: Object.freeze(['scan', 'connect', 'disconnect']),
        commandResults: true,
        note: 'The ANSWER path: while connectionStatus.pendingAmbiguity is set, ReaPrime '
            + 'parks in a selection session and suppresses recovery until the choice arrives '
            + '(connection_manager.dart _connectImpl). Commands are serialised server-side '
            + 'through one queue (_handleDevicesSocket commandQueue).',
    }),
    display: Object.freeze({
        key: 'display',
        path: '/ws/v1/display',
        handlerFile: 'lib/src/services/webserver/display_handler.dart',
        handlerSymbol: 'DisplayHandler._handleWebSocket',
        carries: 'DisplayState frames (brightness / dim state)',
        commands: Object.freeze(['setBrightness', 'requestWakeLock', 'releaseWakeLock']),
        /**
         * The one place a command's SHAPE is checked, because this handler's failure mode
         * is silence: `if (brightness is int && 0..100) … else log.warning` — no reply, no
         * error envelope, nothing on the wire. A caller that sends 100.0, "80" or 120 gets
         * exactly what it gets for a value that worked. Named here rather than at the call
         * site so the rule lives beside the handler reference it came from.
         */
        validateCommand(payload) {
            if (payload.command !== 'setBrightness') return null;
            const value = payload.brightness;
            if (!Number.isInteger(value) || value < 0 || value > 100) {
                return 'setBrightness needs an integer 0..100 (display_handler drops anything else silently)';
            }
            return null;
        },
        note: 'setBrightness takes an INT 0..100 and the handler drops anything else with a '
            + 'log line and no reply — validate before sending. D10 gives the skin ownership '
            + 'of blanking; WHICH side backs off on the wake edge is Q13, open, and belongs '
            + 'to the screensaver component. This layer carries the command and holds no '
            + 'brightness policy of its own (SCOPE Part 3 §1: the policy tangled into the '
            + 'old connectors is untangled here).',
    }),
    update: Object.freeze({
        key: 'update',
        path: '/ws/v1/update',
        handlerFile: 'lib/src/services/webserver/update_handler.dart',
        handlerSymbol: 'UpdateHandler._handleSocket',
        carries: 'UpdateState frames (check/download/install progress)',
        commands: Object.freeze(['check', 'install']),
        note: 'Also how a background install is detected, compared against APP_VERSION. '
            + '`install` on an unsupported platform replies {error, url} — an error envelope '
            + 'carrying the fallback URL, which is a signal with a payload, not a frame.',
    }),
    sensorSnapshot: Object.freeze({
        key: null,
        path: '/ws/v1/sensors/<id>/snapshot',
        templated: true,
        handlerFile: 'lib/src/services/webserver/sensors_handler.dart',
        handlerSymbol: 'SensorsHandler._handleSensorSnapshot',
        carries: 'one sensor\'s channel map — read it through rea-address.js',
        commands: null,
        note: 'An unknown id gets {"error":"not found"} AND THE SOCKET CLOSES. That close is '
            + 'the re-discovery trigger (rea-sensors.js): the id derives from the machine\'s '
            + 'deviceId, so a machine swap mints a new one and the old id is dead for good.',
    }),
    pluginEndpoint: Object.freeze({
        key: null,
        path: '/ws/v1/plugins/<id>/<endpoint>',
        templated: true,
        handlerFile: 'lib/src/services/webserver/plugins_handler.dart',
        handlerSymbol: 'PluginsHandler._handlePluginSocketEndpoint',
        carries: 'the plugin event payload, verbatim (data[\'payload\'])',
        commands: null,
        note: 'A plugin that is not loaded, or an endpoint that is not of websocket type, is '
            + 'answered with an HTTP 404/400 BEFORE the upgrade — so the socket never opens '
            + 'and a reconnecting client would dial it for ever. Plugin availability is a '
            + 'capability-shaped question: a missing plugin degrades to feature-absent '
            + '(rea-sockets.js `maxAttempts`), never to an error banner. The skin uses '
            + 'time-to-ready.reaplugin/timeToReady and '
            + 'decent-profile.reaplugin/profileGenerated.',
    }),
});

/** `/ws/v1/sensors/<id>/snapshot` for one sensor id. */
export function sensorSnapshotPath(sensorId) {
    if (typeof sensorId !== 'string' || sensorId === '') {
        throw new Error('sensorSnapshotPath: a sensor id is required');
    }
    return `${WS_PREFIX}/sensors/${encodeURIComponent(sensorId)}/snapshot`;
}

/** `/ws/v1/plugins/<id>/<endpoint>` for one plugin feed. */
export function pluginEndpointPath(pluginId, endpoint) {
    if (typeof pluginId !== 'string' || pluginId === '') {
        throw new Error('pluginEndpointPath: a plugin id is required');
    }
    if (typeof endpoint !== 'string' || endpoint === '') {
        throw new Error('pluginEndpointPath: an endpoint is required');
    }
    return `${WS_PREFIX}/plugins/${encodeURIComponent(pluginId)}/${encodeURIComponent(endpoint)}`;
}

/* ─────────────────────────── the three predicates, once ─────────────────────────────
 *
 * `classifyMessage` is the one implementation of the frame/envelope split, and these are
 * the three tests it is built from. They are EXPORTED because the address layer needs the
 * same three answers about a frame it is handed by some other route — a stored measurement,
 * a `last()` replay, a test fixture — and a second hand-written copy of the rule is how the
 * two layers came to disagree about a JSON array: the classifier called it MALFORMED and
 * the address layer read it as a machine reporting nothing.
 */

/** A JSON object, and not an array. `[]` is not a frame — it has every key absent. */
export function isFrameObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** ReaPrime's refusal envelope: `{"error": …}` (`json_response.dart`). A SIGNAL, never a frame. */
export function isErrorEnvelope(value) {
    return isFrameObject(value) && typeof value.error === 'string';
}

/**
 * The scale channel's connection envelope: `{"status":"connected"|"disconnected"}`.
 *
 * The `timestamp` test is what separates it from a `WeightSnapshot`, which carries one on
 * every frame — `scale_handler.dart` `sendStatus` writes the envelope with no stamp.
 */
export function isStatusEnvelope(value) {
    return isFrameObject(value) && typeof value.status === 'string' && !Object.hasOwn(value, 'timestamp');
}

/**
 * What did this message turn out to be?
 *
 * The ONE implementation of the frame/envelope split described at the top of this file.
 * `channel` is a row of WS_CHANNELS (or undefined for an ad-hoc socket, which gets the
 * conservative default: error envelopes are signals, everything else is a frame).
 *
 * Note the order. `error` is checked FIRST and on every channel, because every handler in
 * the pinned tree spells a refusal the same way (`json_response.dart`) — including the
 * devices socket, whose failed command result carries BOTH `operation` and `error`.
 *
 * @param {unknown} data     the parsed message
 * @param {object} [channel] a WS_CHANNELS row
 * @returns {{kind: string, data: unknown, error?: string, status?: string}}
 */
export function classifyMessage(data, channel = undefined) {
    if (!isFrameObject(data)) {
        return { kind: WS_MESSAGE.MALFORMED, data };
    }
    if (isErrorEnvelope(data)) {
        return { kind: WS_MESSAGE.ERROR, data, error: data.error };
    }
    if (channel && channel.commandResults && typeof data.operation === 'string') {
        return { kind: WS_MESSAGE.COMMAND_RESULT, data };
    }
    if (channel && channel.statusEnvelope && isStatusEnvelope(data)) {
        return { kind: WS_MESSAGE.STATUS, data, status: data.status };
    }
    return { kind: WS_MESSAGE.FRAME, data };
}

/** Look a channel row up by its path. Returns null for a path this table does not name. */
export function channelForPath(path) {
    if (typeof path !== 'string') return null;
    for (const channel of Object.values(WS_CHANNELS)) {
        if (channel.path === path) return channel;
        if (channel.templated && matchesTemplate(channel.path, path)) return channel;
    }
    return null;
}

function matchesTemplate(template, path) {
    const t = template.split('/');
    const p = path.split('/');
    if (t.length !== p.length) return false;
    return t.every((segment, i) => (segment.startsWith('<') && segment.endsWith('>')
        ? p[i].length > 0
        : segment === p[i]));
}
