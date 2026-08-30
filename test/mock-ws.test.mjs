/**
 * mock-ws.test.mjs — the WebSocket half of the offline mock, inside `npm test`.
 *
 * WHAT THIS CLOSES. Wave 0b, `waves/0b/REPORT.md:255-261`, verbatim: "The biggest
 * remaining hole, stated not papered over … Gate B rule 4 is closed for REST and open for
 * sockets." `tools/mock_rea.py` spoke no WebSocket — two verbs, no 101 — so the ten socket
 * rows of `src/data/CONTRACTS.json` had no instrument, and nothing in the tree could push
 * a frame at the stores. The 15 Hz render loop could not be proved against a live feed
 * because there was no live feed to prove it against.
 *
 * `tools/ws_frames.py` is the other half and `tools/WS_FRAMES.md` is where every value it
 * sends comes from. This suite asks the server, over a real handshake, using the tree's
 * own client (`test/harness/ws.js`):
 *
 *   * every socket row is served — nine upgrade, the plugin template answers 404 BEFORE
 *     the upgrade, which is the contract, not a gap;
 *   * the machine frames ARE the recording, key for key and value for value, minus the
 *     names the handler stopped sending (CB-03, CB-08) — the one reshape, checked against
 *     the fixture rather than described;
 *   * the cadence is what was asked for, at the 15 Hz the loop proof runs;
 *   * the phases play in the scripted order and the shot-state channel follows them;
 *   * fire and forget: no backlog at connect, and a second client gets its own clock;
 *   * the commands answer as the handlers answer, silence included — `setBrightness`
 *     drops a non-int with no reply, and a mock that helpfully replied would teach the
 *     skin a server that does not exist;
 *   * the checker's socket canaries each bite, one rule apiece.
 *
 * Python by design, like `mock-contract.test.mjs`: the instrument lives beside the mock it
 * drives, and a green suite that quietly stopped covering the capture rig is the decay the
 * canary rule exists to prevent.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketClient } from './harness/ws.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const TABLE = JSON.parse(readFileSync(path.join(REPO, 'src/data/CONTRACTS.json'), 'utf8'));
const SHOT = JSON.parse(readFileSync(path.join(REPO,
    'tools/rea-fixtures/api__v1__shots__cd020a51-f353-4ffb-8389-72c931640181.json'), 'utf8'));
const DEVICES = JSON.parse(readFileSync(path.join(REPO, 'tools/rea-fixtures/api__v1__devices.json'), 'utf8'));

/** `SNAPSHOT_KEYS` and friends, from the client's own table — never restated here. */
const { SNAPSHOT_KEYS, SNAPSHOT_DERIVED_KEYS, SCALE_KEYS } =
    await import('../src/data/rea-names.js');

const RATE = 15;                 // the loop proof's rate; the recording's own is 15 too

function freePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

/** Start a mock on its own port and wait until it answers. */
async function startMock(args = []) {
    const port = await freePort();
    const child = spawn('python3', ['tools/mock_rea.py', '--port', String(port), ...args],
        { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (b) => { stderr += b; });
    child.stdout.resume();
    const deadline = Date.now() + 15000;
    for (;;) {
        if (child.exitCode !== null) throw new Error(`mock exited ${child.exitCode}: ${stderr}`);
        try {
            const res = await fetch(`http://127.0.0.1:${port}/api/v1/info`);
            if (res.ok) { await res.arrayBuffer(); break; }
        } catch { /* not up yet */ }
        if (Date.now() > deadline) throw new Error(`mock never came up: ${stderr}`);
        await new Promise((r) => setTimeout(r, 60));
    }
    return { port, child, stop: () => child.kill('SIGKILL') };
}

/** Open one channel and read what arrives, each message stamped on arrival. */
async function listen(port, channelPath, ms, { send = [], sendAfter = 0 } = {}) {
    const client = await WebSocketClient.connect(`ws://127.0.0.1:${port}${channelPath}`);
    const opened = performance.now();
    const got = [];
    let closed = null;
    client.on('message', (text) => got.push({ at: performance.now(), data: JSON.parse(text) }));
    client.on('close', (code) => { closed = code; });
    if (send.length) {
        setTimeout(() => { for (const m of send) client.send(JSON.stringify(m)); }, sendAfter);
    }
    await new Promise((r) => setTimeout(r, ms));
    client.close();
    return { opened, got, closed, frames: got.map((m) => m.data) };
}

/** The recorded machine block, minus the names the handler stopped sending. */
function expectedMachineFrame(index) {
    const raw = SHOT.measurements[index].machine;
    const out = {};
    for (const key of [...SNAPSHOT_KEYS, ...SNAPSHOT_DERIVED_KEYS]) {
        if (Object.hasOwn(raw, key)) out[key] = raw[key];
    }
    return out;
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

// A script for the channels whose values no recording carries, plus the B8 picker state.
const SCRIPT = {
    rate: RATE,
    timeline: [{ phase: 'pre-shot', frames: 4 }, { phase: 'in-shot', frames: 8 },
        { phase: 'post-shot', seconds: 1 }],
    waterLevels: { currentLevel: 62.5, refillLevel: 5.0 },
    shotSettings: {
        steamSetting: 0, targetSteamTemp: 160, targetSteamDuration: 45,
        targetHotWaterTemp: 98, targetHotWaterVolume: 240, targetHotWaterDuration: 30,
        targetShotVolume: 0, groupTemp: 92.0,
    },
    devices: { pendingAmbiguity: 'machinePicker', connected: [] },
    sensors: 'derived',
};

let plain;      // defaults: 15 Hz, the natural pre-shot -> in-shot -> post-shot arc
let scripted;   // the same, plus the values no recording carries

before(async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'decal-ws-'));
    const file = path.join(dir, 'script.json');
    writeFileSync(file, JSON.stringify(SCRIPT));
    [plain, scripted] = await Promise.all([
        startMock(['--ws-rate', String(RATE)]),
        startMock(['--ws-script', file]),
    ]);
});

after(() => { plain?.stop(); scripted?.stop(); });

// --------------------------------------------------------------------------- //
// The ten rows
// --------------------------------------------------------------------------- //

test('every socket row in the table is served — nine upgrade, the plugin row does not', async () => {
    const rows = TABLE.sockets;
    assert.equal(rows.length, 10);
    for (const row of rows) {
        const target = row.path
            .replace('<id>', 'bengle-1-puckestimator')
            .replace('<endpoint>', 'timeToReady');
        if (row.id === 'pluginEndpoint') {
            // Not a gap: ReaPrime answers an unloaded plugin 404 BEFORE the upgrade, so
            // the socket never opens and plugin absence degrades to feature-absent. No
            // plugin payload is recorded anywhere, so that is every plugin endpoint here.
            await assert.rejects(
                WebSocketClient.connect(`ws://127.0.0.1:${plain.port}${target}`),
                /handshake failed: HTTP\/1\.[01] 404/,
                'the plugin endpoint must refuse the upgrade, not open and invent events');
            continue;
        }
        const client = await WebSocketClient.connect(`ws://127.0.0.1:${plain.port}${target}`);
        client.close();
    }
});

test('a plain GET of a socket path still answers the recorded 404 page', async () => {
    // The nine ws__*.json fixtures are recordings of "Only WebSocket connections are
    // supported." Serving one as anything else is the instrument rewriting a recording,
    // and the upgrade headers are the whole difference.
    const res = await fetch(`http://127.0.0.1:${plain.port}/ws/v1/machine/snapshot`);
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(await res.text(), /Only WebSocket connections are supported/);
});

test('a /ws/v1 path with no row is refused, not invented', async () => {
    // machine/raw, logs and webview/logs are deliberately absent (src/data/EXCLUDED_WS.md).
    await assert.rejects(
        WebSocketClient.connect(`ws://127.0.0.1:${plain.port}/ws/v1/machine/raw`),
        /handshake failed: HTTP\/1\.[01] 404/);
});

// --------------------------------------------------------------------------- //
// The frames, against the recording and against the table
// --------------------------------------------------------------------------- //

test('machine frames ARE the recording, minus the names the handler stopped sending', async () => {
    const { frames } = await listen(plain.port, '/ws/v1/machine/snapshot', 700);
    assert.ok(frames.length >= 6, `only ${frames.length} frames in 700 ms at ${RATE} Hz`);
    // Value for value against the fixture — the reshape is a key DROP and nothing else.
    frames.forEach((frame, i) => assert.deepEqual(frame, expectedMachineFrame(i)));

    const vouched = new Set([...SNAPSHOT_KEYS, ...SNAPSHOT_DERIVED_KEYS]);
    for (const frame of frames) {
        for (const key of Object.keys(frame)) assert.ok(vouched.has(key), `unvouched key ${key}`);
        for (const key of SNAPSHOT_KEYS) assert.ok(Object.hasOwn(frame, key), `missing ${key}`);
        // CB-03 and CB-08: deleted from this frame in 633f6f68. The recording predates it.
        for (const dead of ['weight', 'weightFlow', 'milkTemperature', 'fusedConf', 'vAbs',
            'estFlags', 'detEventCount', 'estLag', 'fusedR1', 'fusedR2', 'fusedC']) {
            assert.ok(!Object.hasOwn(frame, dead), `the frame carries the dead name ${dead}`);
        }
        // "Derived channels are OMITTED, not null" — key presence IS the validity signal.
        for (const key of SNAPSHOT_DERIVED_KEYS) {
            if (Object.hasOwn(frame, key)) assert.notEqual(frame[key], null);
        }
    }
});

test('the cadence is the one that was asked for — the 15 Hz loop proof reads it as truth', async () => {
    const { got } = await listen(plain.port, '/ws/v1/machine/snapshot', 1200);
    assert.ok(got.length >= 12, `only ${got.length} frames in 1.2 s at ${RATE} Hz`);
    const gaps = got.slice(1).map((m, i) => m.at - got[i].at);
    const want = 1000 / RATE;
    const mid = median(gaps);
    assert.ok(Math.abs(mid - want) < want * 0.35,
        `median gap ${mid.toFixed(1)} ms, wanted ~${want.toFixed(1)} ms`);
});

test('fire and forget: no backlog at connect, and a late client gets its own clock', async () => {
    const first = await listen(plain.port, '/ws/v1/machine/snapshot', 400);
    const early = first.got.filter((m) => m.at - first.opened < (1000 / RATE) / 2);
    assert.ok(early.length <= 1,
        `${early.length} frames inside half a step of connect — that is a handed-over backlog`);

    // A second subscriber is not handed the first one's history: it starts at the
    // recording's own first sample, on its own clock. What the chart draws is what THIS
    // client buffered, which is the thing the loop proof is measuring.
    const second = await listen(plain.port, '/ws/v1/machine/snapshot', 300);
    assert.deepEqual(second.frames[0], expectedMachineFrame(0));
});

test('the scale channel: a status envelope, then gravimetric frames off the same recording', async () => {
    const { frames } = await listen(plain.port, '/ws/v1/scale/snapshot', 700);
    // `sendStatus` writes {"status":…} with NO timestamp — that absence is what separates
    // it from a WeightSnapshot (isStatusEnvelope), and it is a signal, never a weight.
    assert.deepEqual(frames[0], { status: 'connected' });
    assert.ok(!Object.hasOwn(frames[0], 'timestamp'));

    const weights = frames.slice(1);
    assert.ok(weights.length >= 5);
    weights.forEach((frame, i) => {
        assert.deepEqual(Object.keys(frame).sort(), [...SCALE_KEYS].sort());
        const recorded = SHOT.measurements[i].machine;
        // The two `on: 'scale'` rows of the rename table, and nothing else touched.
        assert.equal(frame.weight, recorded.weight);
        assert.equal(frame.weightFlow, recorded.weightFlow);
        assert.equal(frame.timestamp, recorded.timestamp);
        // Written unconditionally by toJson, so here NULL is the absence signal.
        assert.equal(frame.battery, null);
        assert.equal(frame.timerValue, null);
    });
});

// --------------------------------------------------------------------------- //
// Phases
// --------------------------------------------------------------------------- //

test('the phases play in the scripted order, off the recording\'s own substates', async () => {
    const { frames } = await listen(scripted.port, '/ws/v1/machine/snapshot', 1200);
    const substates = frames.map((f) => f.state.substate);
    // 4 recorded preparingForShot frames, then the pour, then the last frame held.
    assert.deepEqual(substates.slice(0, 4), Array(4).fill('preparingForShot'));
    assert.ok(substates.slice(4).every((s) => s !== 'preparingForShot'), substates.join(','));
    assert.equal(frames[4].state.state, 'espresso');
});

test('shot state follows the playback, and the terminal decision is the recording\'s own', async () => {
    const { frames } = await listen(scripted.port, '/ws/v1/machine/shotState', 1500);
    const states = frames.map((f) => f.state);
    assert.deepEqual(states, ['preheating', 'pouring', 'finished']);
    for (const frame of frames) {
        assert.equal(frame.shotId, SHOT.id);
        assert.ok(['state', 'terminal'].includes(frame.event));
        for (const key of ['machineState', 'machineSubstate', 'profileFrame', 'scaleConnected',
            'scaleLost', 'machineHasAutonomousSAW', 'timestamp']) {
            assert.ok(Object.hasOwn(frame, key), `shotState frame has no ${key}`);
        }
    }
    const terminal = frames.at(-1);
    assert.equal(terminal.event, 'terminal');
    assert.equal(terminal.decision.kind, 'terminal');
    // `stopReason` off the recorded shot, which is a ShotDecisionReason name.
    assert.equal(terminal.decision.reason, SHOT.stopReason);
    assert.equal(terminal.decision.reason, 'machineEnded');
});

// --------------------------------------------------------------------------- //
// The state channels and their commands
// --------------------------------------------------------------------------- //

test('the devices frame carries the recorded list and the B8 connectionStatus', async () => {
    const { frames } = await listen(scripted.port, '/ws/v1/devices', 250);
    assert.equal(frames.length, 1, 'one current state on connect, not a backlog');
    const frame = frames[0];
    assert.deepEqual(frame.devices.map((d) => d.id), DEVICES.map((d) => d.id));
    assert.equal(typeof frame.scanning, 'boolean');
    const status = frame.connectionStatus;
    // All five keys unconditionally: the handler builds the map literally, so an ABSENT
    // key is malformed here — the opposite of the machine snapshot's rule.
    assert.deepEqual(Object.keys(status).sort(),
        ['error', 'foundMachines', 'foundScales', 'pendingAmbiguity', 'phase']);
    assert.equal(status.pendingAmbiguity, 'machinePicker');
    assert.ok(status.foundMachines.length >= 2, 'the picker needs machines to pick between');
});

test('B8: the connect command IS the answer — it clears the ambiguity and reports the result', async () => {
    const target = DEVICES.find((d) => d.type === 'machine').id;
    const { frames } = await listen(scripted.port, '/ws/v1/devices', 500,
        { send: [{ command: 'connect', deviceId: target }], sendAfter: 60 });
    const result = frames.find((f) => f.operation === 'connect');
    assert.ok(result, 'no command result came back');
    assert.deepEqual(Object.keys(result).sort(),
        ['connectionError', 'deviceId', 'operation', 'outcome', 'state']);
    assert.equal(result.deviceId, target);
    assert.equal(result.outcome, 'connected');
    const after_ = frames.filter((f) => f.connectionStatus).at(-1);
    assert.equal(after_.connectionStatus.pendingAmbiguity, null,
        'consuming the state without the answer arriving is half the contract');
    assert.equal(after_.devices.find((d) => d.id === target).state, 'connected');
});

test('the devices errors are the handler\'s own, and an unknown command is silence', async () => {
    const missing = await listen(scripted.port, '/ws/v1/devices', 300,
        { send: [{ deviceId: 'x' }], sendAfter: 40 });
    assert.ok(missing.frames.some((f) => f.error === 'Missing "command" field'));

    const unknown = await listen(scripted.port, '/ws/v1/devices', 300,
        { send: [{ command: 'connect', deviceId: 'no-such-device' }], sendAfter: 40 });
    assert.ok(unknown.frames.some((f) => f.error === 'Device not found: no-such-device'));

    // The Dart switch has no default: an unknown command gets nothing at all. Reproducing
    // the silence is the point — an invented refusal is a field the client could learn
    // from its instrument and never see from its server.
    const silent = await listen(scripted.port, '/ws/v1/devices', 300,
        { send: [{ command: 'teleport' }], sendAfter: 40 });
    assert.equal(silent.frames.filter((f) => f.error).length, 0);
});

test('display: an int 0..100 moves the state, anything else is dropped in silence', async () => {
    const ok = await listen(scripted.port, '/ws/v1/display', 400,
        { send: [{ command: 'setBrightness', brightness: 42 }], sendAfter: 60 });
    assert.equal(ok.frames.length, 2, 'the state on connect, then the state after the command');
    assert.equal(ok.frames[0].brightness, 100);
    assert.equal(ok.frames[1].brightness, 42);
    assert.equal(ok.frames[1].requestedBrightness, 42);
    assert.deepEqual(Object.keys(ok.frames[0].platformSupported).sort(), ['brightness', 'wakeLock']);

    // display_handler.dart: `if (brightness is int && 0..100) … else log.warning` — no
    // reply, no error envelope. Silence is indistinguishable from success, which is why
    // rea-ws-channels.js validates the command before sending it.
    const dropped = await listen(scripted.port, '/ws/v1/display', 400,
        { send: [{ command: 'setBrightness', brightness: 42.5 },
            { command: 'setBrightness', brightness: 120 },
            { command: 'setBrightness', brightness: '80' }], sendAfter: 60 });
    assert.equal(dropped.frames.length, 1, 'a dropped command must not move the state');
});

test('update: the version is the recorded one, and install answers the platform envelope', async () => {
    const info = JSON.parse(readFileSync(path.join(REPO, 'tools/rea-fixtures/api__v1__info.json'), 'utf8'));
    const { frames } = await listen(scripted.port, '/ws/v1/update', 400,
        { send: [{ command: 'install' }], sendAfter: 60 });
    assert.equal(frames[0].phase, 'idle');
    assert.equal(frames[0].currentVersion, info.fullVersion);
    // Null until a check has answered — "not known yet", never "up to date".
    assert.equal(frames[0].latestVersion, null);
    const refusal = frames.find((f) => typeof f.error === 'string');
    assert.equal(refusal.error, 'In-app install is not supported on this platform');
    assert.ok(Object.hasOwn(refusal, 'url'), 'the unsupported-platform reply carries the URL key');
});

test('an unknown sensor id gets {"error":"not found"} and the socket CLOSES', async () => {
    // That close is the client's re-discovery trigger (CB-07): the id derives from the
    // machine's deviceId, so a machine swap mints a new one and the old id is dead for
    // good. A socket that stayed open and silent would suppress the re-discovery.
    const { frames, closed } = await listen(plain.port,
        '/ws/v1/sensors/no-such-sensor-puckestimator/snapshot', 400);
    assert.deepEqual(frames, [{ error: 'not found' }]);
    assert.ok(closed !== null, 'the socket must close after the error');
});

test('the estimator id streams the recorded channels under their live names', async () => {
    const { frames } = await listen(scripted.port,
        '/ws/v1/sensors/bengle-1-puckestimator/snapshot', 500);
    assert.ok(frames.length >= 3);
    for (const frame of frames) {
        for (const dead of ['fusedConf', 'vAbs', 'estFlags', 'detEventCount', 'estLag',
            'fusedR1', 'fusedR2', 'fusedC']) {
            assert.ok(!Object.hasOwn(frame, dead), `dead estimator name ${dead}`);
        }
        assert.ok(Object.hasOwn(frame, 'confidence'), 'fusedConf -> confidence');
        assert.ok(Object.hasOwn(frame, 'flags'), 'estFlags -> flags');
        assert.ok(Object.hasOwn(frame, 'timestamp'));
        // rev, sigmaQ and lagConfidence are ABSENT on purpose: encodeSample always writes
        // them today and this recording predates that. An invented always-present channel
        // is exactly the lie the instrument exists to stop.
        assert.ok(!Object.hasOwn(frame, 'rev'));
    }
});

// --------------------------------------------------------------------------- //
// The channels no recording carries
// --------------------------------------------------------------------------- //

test('waterLevels and shotSettings are SILENT by default — nothing records them', async () => {
    for (const channel of ['/ws/v1/machine/waterLevels', '/ws/v1/machine/shotSettings']) {
        const { frames } = await listen(plain.port, channel, 350);
        assert.deepEqual(frames, [],
            `${channel} invented a frame; no fixture in the set records one, and a mock `
            + 'that answers anyway is a plausible lie standing where an absence belongs');
    }
});

test('a run script supplies them, in the units the row states', async () => {
    const levels = await listen(scripted.port, '/ws/v1/machine/waterLevels', 300);
    assert.deepEqual(levels.frames, [SCRIPT.waterLevels]);          // MILLIMETRES; mm->mL is skin-side
    const settings = await listen(scripted.port, '/ws/v1/machine/shotSettings', 300);
    assert.deepEqual(settings.frames, [SCRIPT.shotSettings]);
});

// --------------------------------------------------------------------------- //
// The checker, and its canaries
// --------------------------------------------------------------------------- //

function check(args = []) {
    try {
        return JSON.parse(execFileSync('python3', ['tools/check_mock_contract.py', '--json', ...args],
            { cwd: REPO, encoding: 'utf8' }));
    } catch (err) {
        if (err.stdout) return JSON.parse(err.stdout);
        throw new Error(`the checker failed to run:\n${err.stderr ?? err.message}`);
    }
}

const blockingRules = (report) => [...new Set(report.findings.filter((f) => f.blocking).map((f) => f.rule))];

test('the checker opens all ten rows and the control passes', () => {
    const report = check();
    assert.equal(report.ok, true,
        JSON.stringify(report.findings.filter((f) => f.blocking), null, 1));
    const c = report.counts;
    assert.equal(c.socketRows, TABLE.sockets.length);
    assert.equal(c.socketRowsServed, TABLE.sockets.length, 'every row is served or refused on purpose');
    assert.equal(c.socketChannels, 9, 'nine upgrade; the plugin row answers before the upgrade');
    assert.ok(c.socketFrames >= 30, `only ${c.socketFrames} frames read off the wire`);
    assert.ok(c.socketFramesRecorded > 0 && c.socketFramesDerived > 0);
});

const WS_CANARIES = [
    ['dead-key', 'socket-shape', 'CB-08\'s weightFlow alive again on the machine frame'],
    ['null-derived', 'socket-shape', 'a derived channel written null instead of omitted'],
    ['history-on-connect', 'socket-history', 'a backlog handed over at connect'],
    ['cadence', 'socket-cadence', 'a third of the rate that was asked for'],
    ['key-drift', 'socket-key-drift', 'a key the spec names and no client reader mentions'],
];

for (const [canary, rule, why] of WS_CANARIES) {
    test(`canary: ${canary} — ${why}`, () => {
        const report = check(['--ws-canary', canary]);
        assert.equal(report.ok, false, `the ${canary} canary did not fail the check`);
        assert.deepEqual(blockingRules(report), [rule],
            `the ${canary} canary fired ${JSON.stringify(blockingRules(report))} — a canary `
            + 'that fires someone else\'s rule proves nothing about its own');
    });
}
