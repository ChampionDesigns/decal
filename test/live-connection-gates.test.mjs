/**
 * live-connection-gates.test.mjs — the connection-and-gates cluster, without a browser.
 *
 * Six wave-5.1 rows meet here: `live-connection-states`, `live-refusal-surface`,
 * `live-capability-gates-ghc`, `live-bug-ghc-overlay` (L1's capability half),
 * `live-bug-dimming-owner` (L11's map half) and the cluster's source laws. The rendered
 * halves — a strip that is a grid row, a dim that one token drives — are in
 * `test/render/live-connection-gates.render.test.mjs`; the contract check is in
 * `test/live-contract.test.mjs`.
 *
 * THE LAST DESCRIBE DRIVES THE REAL MOCK. B8 is the one item in this wave whose failure
 * mode is "we consumed the state and never answered it", and that cannot be proved against
 * a hand-written frame: the proof is that a `connect` command sent at a parked server
 * clears the park. `tools/mock_rea.py` grew a WebSocket half tonight, so the whole loop —
 * park, read, answer, unpark — runs over a real handshake here.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { WebSocketClient } from './harness/ws.js';
import { stripComments } from '../scripts/lib/source-scan.js';

import {
    CONNECTION_SURFACE, CHOICE_SURFACES, ERROR_SCOPE, connectionSurface, errorScopeOf,
    surfacesDiffer,
} from '../src/lib/connection-surface.js';
import {
    readDevicesFrame, CONNECTION_PHASE, AMBIGUITY, CONNECTION_ERROR_SEVERITY,
    SCAN_SCOPED_ERROR_KINDS,
} from '../src/data/rea-devices.js';
import { FEED_STATUS } from '../src/stores/feed-store.js';
import { MACHINE_STATES, MACHINE_STATE } from '../src/data/machine-state.generated.js';
import {
    DIM_BLIND_STATUSES, DIM_KEEPS_INPUT, LIVE_DIM, LIVE_DIM_ACTIVE, LIVE_DIM_GROUP,
    LIVE_DIM_GROUPS, dimStateFor, liveDim, groupDimmed, railDimGroup, railKeepsInput,
} from '../src/lib/live-dimming.js';
import {
    GHC_STRIP_SHOWS_WHEN, GHC_POLARITY, ghcStripGate, createLiveGates,
} from '../src/screens/live-gates.js';
import {
    createCapabilitiesStore, CAPABILITY, SERVED_CAPABILITIES,
} from '../src/stores/capabilities-store.js';
import {
    createMachineInfoStore, readMachineInfo, MACHINE_INFO_STATUS,
} from '../src/stores/machine-info-store.js';
import { createProfileArmStore, ARM_STATUS } from '../src/stores/profile-arm-store.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const read = (rel) => readFileSync(path.join(REPO, rel), 'utf8');

/** The cluster's own files — the ones the source laws below are about. */
const CLUSTER_FILES = Object.freeze([
    'src/lib/connection-surface.js',
    'src/lib/live-dimming.js',
    'src/screens/live-dimming.js',
    'src/screens/live-gates.js',
    'src/screens/live-wiring.js',
    'src/screens/live-connection.js',
    'src/screens/live-refusal.js',
    'src/stores/machine-info-store.js',
    'src/stores/profile-arm-store.js',
]);

const CODE = Object.fromEntries(CLUSTER_FILES.map((f) => [f, stripComments(read(f))]));

/* ─────────────────────────────────────────────────────────── frame constructors */

/** A `/ws/v1/devices` frame as `DevicesStateAggregator._buildSnapshot` writes one. */
function frame({ phase = CONNECTION_PHASE.READY, pendingAmbiguity = null, error = null,
    devices = [], foundMachines = [], foundScales = [], scanning = false } = {}) {
    return {
        timestamp: '2026-08-18T00:00:00.000Z',
        devices,
        scanning,
        connectionStatus: { phase, foundMachines, foundScales, pendingAmbiguity, error },
    };
}

const device = (id, type = 'machine', state = 'discovered') => ({ id, name: `${type} ${id}`, type, state });

/** Read a hand-built frame the way the app does, so the tests exercise the real reader. */
const surfaceOf = (raw, feedStatus = FEED_STATUS.LIVE) =>
    connectionSurface(readDevicesFrame(raw), { feedStatus });

/* ═══════════════════════════════════════════════ 1. B8 — DISTINGUISHABLE STATES */

describe('B8: the connection states are distinguishable', () => {
    test('the three states SCOPE names never render as one picture', () => {
        // "'still trying', 'failed', and 'two machines, pick one' must not look
        // identical, because today they do" (SCOPE.md:1854-1856).
        const stillTrying = frame({ phase: CONNECTION_PHASE.CONNECTING_MACHINE });
        const failed = frame({ phase: CONNECTION_PHASE.IDLE, error: { kind: 'bleFailure', message: 'x' } });
        const pickOne = frame({
            phase: CONNECTION_PHASE.CONNECTING_MACHINE,
            pendingAmbiguity: AMBIGUITY.MACHINE_PICKER,
            foundMachines: [device('a'), device('b')],
        });

        assert.equal(surfaceOf(stillTrying).id, CONNECTION_SURFACE.CONNECTING_MACHINE);
        assert.equal(surfaceOf(failed).id, CONNECTION_SURFACE.ERROR);
        assert.equal(surfaceOf(pickOne).id, CONNECTION_SURFACE.MACHINE_PICKER);

        assert.ok(surfacesDiffer(readDevicesFrame(stillTrying), readDevicesFrame(failed)));
        assert.ok(surfacesDiffer(readDevicesFrame(failed), readDevicesFrame(pickOne)));
        assert.ok(surfacesDiffer(readDevicesFrame(stillTrying), readDevicesFrame(pickOne)));
    });

    test('every phase ReaPrime declares has its own surface', () => {
        const seen = new Map();
        for (const phase of Object.values(CONNECTION_PHASE)) {
            const id = surfaceOf(frame({ phase })).id;
            assert.ok(!seen.has(id), `${phase} renders as ${id}, already used by ${seen.get(id)}`);
            seen.set(id, phase);
        }
        assert.equal(seen.size, 5, 'five phases, five surfaces');
    });

    test('a malformed frame is null, and null is not an empty list', () => {
        // rea-devices.js rule 1, carried through: "`null` is 'we do not know what is
        // attached'; `[]` is 'nothing is attached'."
        assert.equal(readDevicesFrame({ devices: [], scanning: false }), null, 'no connectionStatus');
        assert.equal(surfaceOf({ devices: [], scanning: false }).id, CONNECTION_SURFACE.UNREADABLE);

        const empty = frame({ phase: CONNECTION_PHASE.IDLE, devices: [] });
        assert.equal(surfaceOf(empty).id, CONNECTION_SURFACE.IDLE);
        assert.notEqual(surfaceOf(empty).id, surfaceOf({ devices: [], scanning: false }).id);
    });

    test('the three different nulls a feed can hold stay three different pictures', () => {
        assert.equal(connectionSurface(null, { feedStatus: FEED_STATUS.NEVER }).id, CONNECTION_SURFACE.WAITING);
        assert.equal(connectionSurface(null).id, CONNECTION_SURFACE.WAITING, 'no status yet is still waiting');
        assert.equal(connectionSurface(null, { feedStatus: FEED_STATUS.LIVE }).id, CONNECTION_SURFACE.UNREADABLE);
        assert.equal(connectionSurface(null, { feedStatus: FEED_STATUS.STALE }).id, CONNECTION_SURFACE.UNREADABLE);
        assert.equal(connectionSurface(null, { feedStatus: FEED_STATUS.UNAVAILABLE }).id,
            CONNECTION_SURFACE.UNAVAILABLE);
    });

    test('a HELD frame is not a live source — the feed status outranks it', () => {
        // The regression this pins (wave 5.1, c-gates-chart-1): the status was consulted
        // only when there was no value, so a devices socket that died holding a `ready`
        // frame answered `ready` — the one surface that renders NOTHING. "A dead
        // instrument's reading presented as current" (feed-store.js:129-137), about the
        // connection itself. The store keeps the value on both transitions on purpose
        // (feed-store.js:206-212 close -> STALE, :216-220 unavailable), so the marker is
        // the ONLY thing that separates them.
        const ready = frame({ phase: CONNECTION_PHASE.READY, devices: [device('m', 'machine', 'connected')] });
        assert.equal(surfaceOf(ready, FEED_STATUS.LIVE).id, CONNECTION_SURFACE.READY);

        const dropped = surfaceOf(ready, FEED_STATUS.STALE);
        const gone = surfaceOf(ready, FEED_STATUS.UNAVAILABLE);
        assert.equal(dropped.id, CONNECTION_SURFACE.STALE, 'a dead socket rendered as connected');
        assert.equal(gone.id, CONNECTION_SURFACE.UNAVAILABLE, 'a source that gave up rendered as connected');
        assert.notEqual(dropped.id, gone.id, 'reconnecting and gave-up are not one picture');

        for (const state of [dropped, gone]) {
            assert.equal(state.quiet, false, 'a machine that has gone away must not render as nothing');
        }
        // The last-known picture still travels: the marker is added, the frame is not lost.
        assert.equal(dropped.phase, CONNECTION_PHASE.READY);
        assert.equal(dropped.machine?.id, 'm', 'the held frame is still readable under the marker');
    });

    test('a park behind a dead feed is not a question this skin can answer', () => {
        const parked = frame({
            phase: CONNECTION_PHASE.CONNECTING_MACHINE,
            pendingAmbiguity: AMBIGUITY.MACHINE_PICKER,
            foundMachines: [device('a'), device('b')],
        });
        assert.equal(surfaceOf(parked, FEED_STATUS.LIVE).actionable, true, 'live, it is answerable');

        for (const status of [FEED_STATUS.STALE, FEED_STATUS.UNAVAILABLE]) {
            const state = surfaceOf(parked, status);
            assert.equal(state.actionable, false, `${status}: an answer cannot reach a source that has gone`);
            assert.deepEqual([...state.choices], [],
                `${status}: a found-device list as old as the frame is not a live choice`);
        }
    });

    test('the park outranks the error, and the error still travels', () => {
        const both = frame({
            phase: CONNECTION_PHASE.CONNECTING_MACHINE,
            pendingAmbiguity: AMBIGUITY.MACHINE_PICKER,
            error: { kind: 'connectFailed', message: 'the last attempt failed' },
            foundMachines: [device('a'), device('b')],
        });
        const state = surfaceOf(both);
        assert.equal(state.id, CONNECTION_SURFACE.MACHINE_PICKER,
            'a server holding a question open must not render as "failed"');
        assert.equal(state.error.message, 'the last attempt failed', 'the reason is not dropped');
    });

    test('a scale park is its own surface, over the scale list', () => {
        const state = surfaceOf(frame({
            phase: CONNECTION_PHASE.CONNECTING_SCALE,
            pendingAmbiguity: AMBIGUITY.SCALE_PICKER,
            foundMachines: [device('m')],
            foundScales: [device('s1', 'scale'), device('s2', 'scale')],
        }));
        assert.equal(state.id, CONNECTION_SURFACE.SCALE_PICKER);
        assert.deepEqual(state.choices.map((d) => d.id), ['s1', 's2'], 'the scale question offers scales');
    });

    test('an ambiguity this build does not know still parks, rather than reading as ready', () => {
        const state = surfaceOf(frame({
            phase: CONNECTION_PHASE.READY, pendingAmbiguity: 'sensorPicker',
            foundMachines: [device('a')],
        }));
        assert.ok(CHOICE_SURFACES.includes(state.id), 'suppression is what matters, not the reason');
        assert.equal(state.awaitingChoice, true);
    });

    test('a phase this build has never heard of is shown as exactly that', () => {
        const state = surfaceOf(frame({ phase: 'negotiatingFirmware' }));
        assert.equal(state.id, CONNECTION_SURFACE.PHASE_UNKNOWN);
        assert.equal(state.phaseKnown, false);
        assert.equal(state.phase, 'negotiatingFirmware', 'the name survives for a report');
    });

    test('ready is the one quiet surface, and only the two pickers are actionable', () => {
        const ids = Object.values(CONNECTION_SURFACE);
        const quiet = ids.filter((id) => connectionSurface(frame({ phase: id })).quiet);
        assert.deepEqual(quiet, [CONNECTION_SURFACE.READY]);
        assert.deepEqual([...CHOICE_SURFACES],
            [CONNECTION_SURFACE.MACHINE_PICKER, CONNECTION_SURFACE.SCALE_PICKER]);
    });

    test('every surface id is distinct, and the derivation never throws on rubbish', () => {
        const ids = Object.values(CONNECTION_SURFACE);
        assert.equal(new Set(ids).size, ids.length);
        for (const rubbish of [undefined, 0, '', [], 'frame', { connectionStatus: 7 }]) {
            assert.ok(typeof connectionSurface(rubbish).id === 'string');
        }
    });
});

/* ══════════════ 1b. AN ERROR IS NOT AUTOMATICALLY "FAILED" — BEN, 28 AUGUST 2026 */

describe('a published error takes the banner only when it IS a connection failure', () => {
    /**
     * THE FRAME OFF BEN'S TABLET, 28 August 2026, read live from `/ws/v1/devices` while the
     * machine was on USB with Bluetooth switched off and `GET /api/v1/machine/state` was
     * answering `idle` with live pressure. Trimmed to the keys the derivation reads;
     * everything present is verbatim, including the hours-old timestamp.
     *
     * His words: "for some reason now I cannot get rid of the 'could not connect' banner,
     * it says bluetooth is off which it is but Bengle can connect over USB (which it is
     * now) so doesn't need bluetooth turned on."
     *
     * Before the fix this rendered `surface="error"`, headline "Could not connect", in an
     * assertive live region 88.8px tall that nothing could clear. Measured on the tablet.
     */
    const ADAPTER_OFF = Object.freeze({
        kind: 'adapterOff',
        severity: 'error',
        timestamp: '2026-08-27T21:37:16.637241Z',
        message: 'Bluetooth is turned off.',
        suggestion: 'Turn Bluetooth on to scan for Bluetooth devices.',
    });

    /** A machine on the list, connected, as his frame carried one. */
    const connectedMachine = () => ({ ...device('m', 'machine', 'connected'), available: true });

    const benchFrame = (over = {}) => frame({
        phase: CONNECTION_PHASE.READY,
        devices: [connectedMachine()],
        error: ADAPTER_OFF,
        ...over,
    });

    test("Ben's own frame: an adapter error does not say \"could not connect\" about a machine on USB", () => {
        const state = surfaceOf(benchFrame());
        assert.equal(state.id, CONNECTION_SURFACE.READY,
            'a Bluetooth adapter error outranked phase: ready — that IS the bug');
        assert.equal(state.quiet, true, 'the connected machine must cost the Live screen nothing');
        assert.equal(state.machine?.id, 'm', 'and the machine it is quiet about is still reported');
    });

    test('the information is classified rather than discarded', () => {
        const state = surfaceOf(benchFrame());
        assert.deepEqual({ ...state.error }, { ...ADAPTER_OFF },
            "the server's own sentences survive verbatim — a demotion is not a deletion");
        assert.equal(state.errorScope, ERROR_SCOPE.SCAN,
            'a Search button needs to know the scan transport is the thing that is down');
    });

    test('scope: a scan-scoped kind never takes the headline, at ANY phase', () => {
        // "An adapter-off error is a SCAN problem, not a CONNECTION problem." At `idle`
        // nothing tried to connect either, so "Could not connect" is untrue there too —
        // and the honest picture is the phase's own headline with the server's line under it.
        for (const kind of SCAN_SCOPED_ERROR_KINDS) {
            for (const phase of Object.values(CONNECTION_PHASE)) {
                const state = surfaceOf(frame({ phase, error: { ...ADAPTER_OFF, kind } }));
                assert.notEqual(state.id, CONNECTION_SURFACE.ERROR,
                    `${kind} at phase ${phase} claimed a connection failed`);
                assert.equal(state.errorScope, ERROR_SCOPE.SCAN);
                assert.ok(state.error, `${kind} at ${phase} lost the reason`);
            }
        }
    });

    test('severity: upstream marks what it does not consider a failure, and we believe it', () => {
        // Measured at the pin: an unexpected MACHINE disconnect is `error`
        // (disconnect_supervisor.dart:134), the same event for a SCALE is `warning` (:153),
        // and a failed profile upload is `warning` (workflow_device_sync.dart:155). The
        // field has been on the wire the whole time and this layer ignored it until today.
        const warned = surfaceOf(frame({
            phase: CONNECTION_PHASE.IDLE,
            error: {
                kind: 'scaleDisconnected', severity: CONNECTION_ERROR_SEVERITY.WARNING,
                message: 'Scale disconnected unexpectedly.',
            },
        }));
        assert.notEqual(warned.id, CONNECTION_SURFACE.ERROR, 'a warning wore a failure headline');
        assert.equal(warned.errorScope, ERROR_SCOPE.CONNECTION, 'it is still about a connection');
        assert.equal(warned.error.kind, 'scaleDisconnected', 'and it is still on the surface');
    });

    test('a machine that is up contradicts the claim — and BOTH halves of the frame must say so', () => {
        /* THE PHASE ALONE LIES IN A REAL WINDOW. `_handleMachineDisconnected` emits
         * `machineDisconnected` and changes NO phase, so `ready` outlives the machine until
         * a recovery scan moves it. The device list is right immediately. If this rule read
         * the phase alone, the one error that most needs the banner would lose it. */
        const dropped = {
            kind: 'machineDisconnected', severity: CONNECTION_ERROR_SEVERITY.ERROR,
            deviceId: 'm', message: 'Machine disconnected unexpectedly.',
        };
        const stillListed = surfaceOf(frame({
            phase: CONNECTION_PHASE.READY, devices: [connectedMachine()], error: dropped,
        }));
        assert.equal(stillListed.id, CONNECTION_SURFACE.READY,
            'both halves say a machine is up, so the error is not about connecting to it');

        const gone = surfaceOf(frame({
            phase: CONNECTION_PHASE.READY,
            devices: [device('m', 'machine', 'disconnected')],
            error: dropped,
        }));
        assert.equal(gone.id, CONNECTION_SURFACE.ERROR,
            'phase: ready over an empty bench must NOT silence a machine that went away');
        assert.equal(gone.machine, null, 'and the device list is what said so');
    });

    test('connectingScale is a machine-up phase, because the machine is up in it', () => {
        const state = surfaceOf(frame({
            phase: CONNECTION_PHASE.CONNECTING_SCALE,
            devices: [connectedMachine()],
            error: ADAPTER_OFF,
        }));
        assert.equal(state.id, CONNECTION_SURFACE.CONNECTING_SCALE,
            'the machine is connected and only the scale is still being tried');
        assert.equal(state.quiet, false, 'and that is a state worth a banner, unlike ready');
    });

    /* ── THE MUTATION CHECKS. Each of the three demotions has to be the ONLY thing
     *    standing between a real failure and the banner. */

    test('MUTATION: a genuine connection failure STILL reaches the banner', () => {
        // Every axis pointing the other way: a connection-scoped kind, severity error, and
        // a phase with no machine up. Nothing about the fix may reach this frame.
        const real = surfaceOf(frame({
            phase: CONNECTION_PHASE.IDLE,
            error: {
                kind: 'machineConnectFailed', severity: CONNECTION_ERROR_SEVERITY.ERROR,
                deviceId: 'm', message: 'Attached machine failed to connect.',
                suggestion: 'Make sure the machine is powered on.',
            },
        }));
        assert.equal(real.id, CONNECTION_SURFACE.ERROR);
        assert.equal(real.errorScope, ERROR_SCOPE.CONNECTION);
        assert.equal(real.quiet, false);
    });

    test('MUTATION: a kind this build has never heard of keeps the LOUD answer', () => {
        // A7 in the demotion's direction: we only quieten what we can positively identify.
        // `bleFailure` is not a kind the pinned Dart declares, and the suite above has
        // asserted on it as "failed" since B8 was built.
        const unknown = surfaceOf(frame({
            phase: CONNECTION_PHASE.IDLE, error: { kind: 'bleFailure', message: 'x' },
        }));
        assert.equal(unknown.id, CONNECTION_SURFACE.ERROR);
        assert.equal(unknown.errorScope, ERROR_SCOPE.CONNECTION,
            'an unrecognised kind is a connection failure, not a scan note');
    });

    test('MUTATION: an unrecognised severity is not read as a lesser one', () => {
        for (const severity of [undefined, null, 'info', 'critical', '']) {
            const state = surfaceOf(frame({
                phase: CONNECTION_PHASE.IDLE,
                error: { kind: 'machineConnectFailed', severity, message: 'x' },
            }));
            assert.equal(state.id, CONNECTION_SURFACE.ERROR,
                `severity ${JSON.stringify(severity)} was treated as a warning`);
        }
    });

    test('MUTATION: the park still outranks a demoted error, and an error still outranks a phase', () => {
        // The precedence the header records must survive the new rung: rung 1 is the park,
        // rung 2 is the failure, rung 3 is the phase. Adding a test to rung 2 must not
        // reorder them.
        const parked = surfaceOf(frame({
            phase: CONNECTION_PHASE.READY, pendingAmbiguity: AMBIGUITY.MACHINE_PICKER,
            devices: [connectedMachine()], foundMachines: [device('a'), device('b')],
            error: ADAPTER_OFF,
        }));
        assert.equal(parked.id, CONNECTION_SURFACE.MACHINE_PICKER, 'the park still wins');
        assert.equal(parked.errorScope, ERROR_SCOPE.SCAN, 'and the note still travels');

        const failedOverAnUnknownPhase = surfaceOf(frame({
            phase: 'negotiatingFirmware',
            error: { kind: 'machineConnectFailed', severity: 'error', message: 'x' },
        }));
        assert.equal(failedOverAnUnknownPhase.id, CONNECTION_SURFACE.ERROR,
            'a failure over a phase we do not know is still a failure');
    });

    test('errorScopeOf answers null for no error, and agrees with the ladder on what one is', () => {
        // A7: absence is a real answer, and it is not `CONNECTION`.
        for (const absent of [null, undefined, 0, '', 'adapterOff']) {
            assert.equal(errorScopeOf(absent), null, `${JSON.stringify(absent)} is not an error`);
        }
        assert.equal(errorScopeOf({ kind: 'adapterOff' }), ERROR_SCOPE.SCAN);
        // A KIND-LESS OBJECT IS STILL AN ERROR, and it is the one the address layer can
        // actually produce: `readConnectionStatus` accepts any object as `error` and
        // spreads it, so a malformed one arrives here as `{}`. The ladder treats it as a
        // failure (`if (!error)` is false for it), and this must give the same answer —
        // the two disagreeing is how a surface would carry a scope its id contradicts.
        assert.equal(errorScopeOf({}), ERROR_SCOPE.CONNECTION, 'a kind-less error is not a scan note');
        assert.equal(surfaceOf(frame({ phase: CONNECTION_PHASE.IDLE })).errorScope, null);
        // And on every surface that has no frame at all, so the shape is one shape.
        for (const status of [FEED_STATUS.NEVER, FEED_STATUS.LIVE, FEED_STATUS.UNAVAILABLE]) {
            assert.equal(connectionSurface(null, { feedStatus: status }).errorScope, null);
        }
    });

    test('the demotion changes the surface, so surfacesDiffer still sees the difference', () => {
        /* B8's own acceptance function, over the pair rule 3 creates: two frames whose
         * `connectionStatus` blocks are BYTE-IDENTICAL, differing only in whether the
         * device list holds a connected machine. Under the old rule both were `error`;
         * under the new one they are two different pictures, and the guard says so.
         *
         * The error has to be connection-scoped for this to be about rule 3 at all — a
         * scan-scoped one demotes at every phase and both sides would be `ready`, which is
         * the right answer for a different reason and would prove nothing here. */
        const dropped = {
            kind: 'machineDisconnected', severity: CONNECTION_ERROR_SEVERITY.ERROR,
            deviceId: 'm', message: 'Machine disconnected unexpectedly.',
        };
        const status = { phase: CONNECTION_PHASE.READY, error: dropped };
        const up = readDevicesFrame(frame({ ...status, devices: [connectedMachine()] }));
        const bare = readDevicesFrame(frame({ ...status, devices: [] }));
        assert.deepEqual(up.connectionStatus, bare.connectionStatus, 'the statuses are the same');
        assert.ok(surfacesDiffer(up, bare),
            'a connected machine and an empty bench under one status must not be one picture');
    });
});

/* ═══════════════════════════════════════════════════ 2. L11 — ONE DIMMING OWNER */

describe('L11: one dimming owner', () => {
    test('the map is Slate STATE_DIM_MAP, and it is total over every machine state', () => {
        assert.equal(liveDim(MACHINE_STATE.ESPRESSO), LIVE_DIM.ALL);
        assert.equal(liveDim(MACHINE_STATE.STEAM), LIVE_DIM.EXCEPT_STEAM);
        assert.equal(liveDim(MACHINE_STATE.STEAM_RINSE), LIVE_DIM.EXCEPT_STEAM);
        assert.equal(liveDim(MACHINE_STATE.HOT_WATER), LIVE_DIM.EXCEPT_HOTWATER);
        assert.equal(liveDim(MACHINE_STATE.FLUSH), LIVE_DIM.EXCEPT_FLUSH);

        const dimming = MACHINE_STATES.filter((s) => liveDim(s) !== LIVE_DIM.NONE);
        assert.deepEqual(dimming.sort(), ['espresso', 'flush', 'hotWater', 'steam', 'steamRinse']);
    });

    test('an unknown state, and no state at all, recede NOTHING', () => {
        for (const input of [null, undefined, '', 'negotiatingFirmware', 7, {}]) {
            assert.equal(liveDim(input), LIVE_DIM.NONE, `${JSON.stringify(input)} must not dim the rail`);
        }
    });

    test('the mode in use is never the mode that recedes', () => {
        assert.equal(groupDimmed(liveDim(MACHINE_STATE.STEAM), LIVE_DIM_GROUP.STEAM), false);
        assert.equal(groupDimmed(liveDim(MACHINE_STATE.HOT_WATER), LIVE_DIM_GROUP.HOTWATER), false);
        assert.equal(groupDimmed(liveDim(MACHINE_STATE.FLUSH), LIVE_DIM_GROUP.FLUSH), false);
        for (const group of LIVE_DIM_GROUPS) {
            assert.equal(groupDimmed(liveDim(MACHINE_STATE.ESPRESSO), group), true, `${group} during espresso`);
            assert.equal(groupDimmed(liveDim(MACHINE_STATE.IDLE), group), false, `${group} at idle`);
        }
    });

    /* ── the half the map could not see: WHOSE reading it is mapping ──────────────
     *
     * `liveDim` was fail-visible for a state that never arrived and blind to a state that
     * stopped arriving. A feed holding `espresso` behind a source that had gone kept
     * `dim="all"` — every dimmable track at the dim token with `pointer-events: none` —
     * and nothing could ever lift it: a latched STALE is not undone by the clock, and
     * UNAVAILABLE is not either. So after a socket blip mid-espresso the rail stayed
     * receded and stopped answering taps for the rest of the session. */

    test('a reading that is no longer to be believed dims NOTHING, whatever it says', () => {
        for (const status of DIM_BLIND_STATUSES) {
            for (const state of MACHINE_STATES) {
                assert.equal(dimStateFor(state, status), null,
                    `${state} behind a ${status} feed still had something to dim`);
                assert.equal(liveDim(dimStateFor(state, status)), LIVE_DIM.NONE,
                    `${state} behind a ${status} feed still recedes the rail`);
            }
        }
        assert.deepEqual([...DIM_BLIND_STATUSES], [FEED_STATUS.STALE, FEED_STATUS.UNAVAILABLE],
            'the two dead statuses — UNAVAILABLE alone would leave the blip case standing');
    });

    test('a LIVE feed still dims exactly what the map says, and NEVER is not a fault', () => {
        for (const state of MACHINE_STATES) {
            assert.equal(dimStateFor(state, FEED_STATUS.LIVE), state, `${state} while live`);
            // Nothing has arrived: there is no reading to disbelieve, and the map already
            // answers NONE for a null state. The boot state of a feed paints nothing.
            assert.equal(dimStateFor(null, FEED_STATUS.NEVER), null);
            assert.equal(dimStateFor(state, FEED_STATUS.NEVER), state,
                'NEVER is not a verdict about a value — a feed with no value has no state anyway');
        }
        assert.equal(dimStateFor(MACHINE_STATE.ESPRESSO, null), MACHINE_STATE.ESPRESSO,
            'no status known (no boot attached) is not a reason to withdraw the map');
    });

    test('the ONE owner maps from the guarded state, and the STOP target is left alone', () => {
        const wiring = CODE['src/screens/live-wiring.js'];
        assert.match(wiring, /this\.host\.dim = liveDim\(this\.dimState\)/,
            'the dim is computed from something other than the guarded state');
        assert.match(wiring, /get dimState\(\)\s*\{\s*return dimStateFor\(this\.machineState, this\.machineFeedStatus\)/,
            'the guard is spelled a second time here instead of in the lib half');
        // The property the STOP target, the rail's mode and the chip text read is the
        // last-known NAME, status or no status. A feed that stopped talking is not a
        // machine that stopped pulling, and withdrawing the abort target from a machine
        // that may still be pouring is a worse bug than the one above.
        assert.match(wiring, /this\.host\.machineState = this\.machineState \?\? ''/,
            'the state name stopped travelling — that takes the STOP target with it');
    });

    /* ===================================================================
     * THE DYE2 HANDOFF'S TWO HALVES, AS SOURCE
     *
     * The render suite proves the button opens the right page. What only a source rule can
     * hold is WHERE each half lives, and both placements were forced by a pinned law rather
     * than chosen:
     *
     *   the CONTROLLER may name a plugin id (data) and may not build a URL (addressing) —
     *     "there is no path, no verb, no route id and no fetch in this file", which this
     *     suite already asserts over the whole of `src/screens/`;
     *   the SCREEN may build the URL through a store it is handed and may not IMPORT one —
     *     `test/live-screen.test.mjs` asserts no `from '…/stores/…'` in the five skeleton
     *     files, which is why the destination pair sits in `src/lib/plugin-pages.js`.
     *
     * Between them those two rules leave exactly one arrangement, and this pins it: the
     * first draft put the constants in `plugins-store.js` beside `pageUrl`, which is where
     * they read best and is the one place they cannot go.
     * =================================================================== */
    test('the DYE2 gate reads the plugin listing, and the controller never builds an address', () => {
        const wiring = CODE['src/screens/live-wiring.js'];
        assert.match(wiring, /'plugins'/,
            'the listing must be a watched store, or the gate has nothing to read');
        assert.match(wiring, /this\.host\.dye2 = this\.#dye2Loaded/);
        /* `loaded`, NOT `autoLoad`. The Plugins page's SWITCH reads `autoLoad` — the
         * persistent answer, so a control does not flicker off while a plugin restarts.
         * This is a LINK to a page that plugin serves, so the question is "will that URL
         * answer", which is `loaded`. */
        assert.match(wiring, /manifest\.loaded === true/);
        assert.doesNotMatch(wiring, /autoLoad/,
            'a link and a switch want different halves of that pair');
        /* AND THE DESTINATION DOES NOT COME FROM A STORE. `plugin-pages.js` is `src/lib/`,
         * which a screen may read; `plugins-store.js` is not. */
        assert.match(wiring, /from 'src\/lib\/plugin-pages\.js'/);
        assert.doesNotMatch(wiring, /pageUrl/,
            'turning an id into an address is the screen\'s business, not this controller\'s');
    });

    test('the retired dye2Enabled key has no reader, and its retirement says why', () => {
        /* IT WAS THE OBVIOUS GATE AND IT WOULD HAVE BEEN A DEAD ONE. Ben deleted the DYE2
         * settings leaf and its one switch on 26 August ("delete the DYE2 leaf and move
         * what it does into Plugins"), which left the key with NO WRITER — so a button
         * gated on it could never have appeared on any machine. Its retirement row names
         * the owner that actually holds the answer, which is the Plugins page's switch over
         * ReaPrime's own plugin state. */
        const routes = read('src/lib/storage-routes.js');
        assert.match(routes, /dye2Enabled: \{\s*\n\s*layer: LAYERS\.none, scope: SCOPES\.external, status: STATUSES\.retired,/,
            'a provisional key with a reader on one side and no writer on the other is not "made to mean something"');
        /* NOBODY READS IT, and the two files that could plausibly have are the two that
         * were closest to doing so: the controller that gates the button and the screen
         * that draws it. */
        for (const file of ['src/screens/live-wiring.js', ...CLUSTER_FILES]) {
            const code = CODE[file] ?? stripComments(read(file));
            assert.doesNotMatch(code, /dye2Enabled/,
                `${file} reads a retired key — the plugin listing is the answer, not a tablet preference`);
        }
        assert.doesNotMatch(stripComments(read('src/screens/live-screen.js')), /dye2Enabled/);
    });

    /** The paint half, read as text: `lit` cannot be imported under node, so the block is
     *  taken out of the source the way every other source rule in this tree is. */
    const PAINT = (() => {
        const source = read('src/screens/live-dimming.js');
        const m = /export const liveDimming = css`([\s\S]*?)`;/.exec(source);
        assert.ok(m, 'the one declaration block is not where the file says it is');
        return m[1];
    })();

    test('the JS answer and the CSS selectors are the same answer', () => {
        // For every dim value the map can produce, the selector list must carry a rule;
        // and for every exemption, the matching :not().
        for (const dim of LIVE_DIM_ACTIVE) {
            assert.ok(PAINT.includes(`:host([dim='${dim}'])`), `no rule for dim="${dim}"`);
        }
        for (const group of [LIVE_DIM_GROUP.STEAM, LIVE_DIM_GROUP.HOTWATER, LIVE_DIM_GROUP.FLUSH]) {
            assert.ok(PAINT.includes(`[data-dim-group]:not([data-dim-group='${group}'])`),
                `the ${group} exemption is not in the selector list`);
        }
        assert.equal(LIVE_DIM_ACTIVE.length, 4, 'four dim states, four selectors');
    });

    test('ONE OWNER — the dim rule, plus the one named input exemption, and nothing else', () => {
        /* THIS TEST READ `assert.equal(blocks, 1, '… L11 is two owners, so there may be
         * one')` UNTIL 30 AUGUST 2026, and the number changed with F-038. Ben's decision —
         * "A defect — make them pressable" — needs the preset banks to keep their pointer
         * events while they recede, which is a second declaration in this same block.
         *
         * L11 IS NOT REOPENED BY THAT, and the difference is worth being exact about. L11
         * is TWO OWNERS fighting over one state — a stylesheet rule and an inline style,
         * with the inline one winning silently. What is here is ONE owner writing two
         * things: the recede, and the one row-scoped exemption from the half of the recede
         * that was never the paint's business. So the count moves from 1 to 2 and the
         * SHAPE is pinned instead, which is the stronger claim: a third block, or a second
         * block that is not exactly the exemption, still fails.
         *
         * The blocks are counted the same crude way (an opening brace apiece), and the
         * comments in the source carry no brace for the same reason they carry no
         * backtick. */
        const blocks = PAINT.split('{').length - 1;
        assert.equal(blocks, 2, `${blocks} declaration blocks — the dim rule and the exemption, no more`);

        assert.match(PAINT, /opacity: var\(--ui-opacity-dim\)/, 'the theme-aware token, not a number');
        assert.doesNotMatch(PAINT, /opacity:\s*\.?\d/, 'a literal opacity is owner B is 0.25 coming back');
        assert.doesNotMatch(PAINT, /!important/, 'an importance flag is the fight, not the fix');

        /* THE SECOND BLOCK IS THE EXEMPTION, BY NAME. It restores pointer events only, only
         * for rows carrying the attribute, and only while a dim is in force — so it can
         * never un-recede anything and can never reach a row the lib half has not named. */
        /* `split('{')` gives [selectors-1, body-1 + selectors-2, body-2], so the exemption's
         * BODY is the third part. Taking the second would hand back the dim rule's own
         * declarations and the assertions below would be about the wrong block. */
        const exemption = PAINT.split('{')[2];
        assert.match(PAINT, /:host\(\[dim\]\) \[data-dim-group\]\[data-dim-keeps-input\]/,
            'the exemption must be scoped to a dimmed row that asked for it');
        assert.match(exemption, /pointer-events: auto/, 'and it restores the press');
        assert.doesNotMatch(exemption, /opacity/,
            'the exemption may not touch the paint — the bank still reads "not now"');
    });

    test('the two rows that keep their input are a TABLE, and the paint does not name them', () => {
        /* F-038's exemption is data in the lib half, exactly as `RAIL_DIM_GROUP` is, so the
         * paint stays one selector and a component name never appears in a stylesheet. */
        assert.deepEqual([...DIM_KEEPS_INPUT], ['drink-weight-presets', 'steam-flow-presets'],
            'the set Ben ruled on: the two preset banks, and nothing else');
        for (const row of DIM_KEEPS_INPUT) {
            assert.ok(railDimGroup(row), `${row} must still HAVE a dim group — it recedes, it is not exempt`);
            assert.equal(railKeepsInput(row), true);
        }
        assert.equal(railKeepsInput('drink-weight'), false,
            'the drink STEPPER is not in the set — no measurement, no ruling, no change');
        assert.equal(railKeepsInput('grind'), false);
        assert.equal(railKeepsInput(null), false, 'and an id nobody named keeps today\'s behaviour');
        assert.doesNotMatch(PAINT, /ui-preset-bank/,
            'the paint must not name a component — that would be a second place the set is written');
    });

    test('the token the block reads is theme-aware, which is the half owner B threw away', () => {
        const tokens = read('styles/tokens.css');
        assert.match(tokens, /--ui-opacity-dim:\s*\.62/, 'the light value');
        assert.match(tokens, /--ui-opacity-dim-dark:\s*\.42/, 'and the dark one');
        assert.match(tokens, /--ui-opacity-dim: var\(--ui-opacity-dim-dark\)/, 're-pointed in the dark band');
    });

    test('NO INLINE STYLE IS WRITTEN — the mechanism of L11, banned in source', () => {
        const files = [...CLUSTER_FILES, 'src/screens/live-screen.js', 'src/screens/live-rail.js'];
        for (const file of files) {
            const code = file in CODE ? CODE[file] : stripComments(read(file));
            assert.doesNotMatch(code, /\.style\.[A-Za-z]+\s*=/,
                `${file} writes an inline style — "Inline wins", and that IS bug L11`);
            assert.doesNotMatch(code, /setAttribute\(\s*['"]style['"]/, `${file} writes a style attribute`);
        }
    });
});

/* ══════════════════════════════════ 3. A3 — CAPABILITY GATES, NEVER A NAME (GHC) */

describe('A3: the GHC gate reads the R3 adapter, never a machine name', () => {
    const answer = (over = {}) => ({
        capability: CAPABILITY.UNKNOWN, value: null, reason: null, provisional: true,
        tag: 'R3', adapter: 'r3GroupHeadControllerCapability', basis: 'test', ...over,
    });

    test('the premise this item rests on: there is no GHC entry in the served seven', () => {
        assert.equal(SERVED_CAPABILITIES.length, 7);
        assert.ok(!SERVED_CAPABILITIES.some((name) => /ghc|groupHead/i.test(name)),
            'a served GHC entry would retire this whole interim');
    });

    test('the gate is the polarity constant applied to a KNOWN answer, and nothing else', () => {
        for (const capability of [CAPABILITY.PRESENT, CAPABILITY.ABSENT, CAPABILITY.UNKNOWN]) {
            const gate = ghcStripGate(answer({ capability }));
            const known = capability !== CAPABILITY.UNKNOWN;
            assert.equal(gate.render, known && capability === GHC_STRIP_SHOWS_WHEN,
                `${capability} under polarity ${GHC_STRIP_SHOWS_WHEN}`);
        }
    });

    test('UNKNOWN renders nothing under EITHER polarity — fail-closed is not a polarity choice', () => {
        const gate = ghcStripGate(answer({ capability: CAPABILITY.UNKNOWN }));
        assert.equal(gate.render, false);
        assert.equal(gate.known, false);
        for (const polarity of Object.values(GHC_POLARITY)) {
            assert.notEqual(CAPABILITY.UNKNOWN, polarity, 'unknown is never a polarity value');
        }
    });

    test('nothing at all — no store, no answer — is also nothing rendered', () => {
        for (const nothingness of [null, undefined, {}, 'present']) {
            assert.equal(ghcStripGate(nothingness).render, false);
        }
    });

    test('the R3 provenance rides on the answer, so the swap is greppable', () => {
        const gate = ghcStripGate(answer({ capability: CAPABILITY.PRESENT }));
        assert.equal(gate.tag, 'R3');
        assert.equal(gate.adapter, 'r3GroupHeadControllerCapability');
        assert.equal(gate.provisional, true, 'an adapter answer is provisional until R3 lands');
    });

    test('end to end over the REAL capability store and the REAL adapter', () => {
        const store = createCapabilitiesStore({ routes: { capabilities: async () => ({ ok: true, status: 200, data: { capabilities: [] } }) } });
        const gates = createLiveGates({ capabilities: store });

        // No machine info yet: the adapter cannot answer, so the strip is absent.
        assert.equal(gates.ghc().capability, CAPABILITY.UNKNOWN);
        assert.equal(gates.ghc().render, false);

        // AN ABSENT KEY IS NOT A FALSE — the adapter's own rule, proved through the gate.
        store.applyMachineInfo({ version: '1293', serialNumber: '1', extra: {} });
        assert.equal(gates.ghc().capability, CAPABILITY.UNKNOWN, 'an absent GHC key must never read as false');
        assert.match(gates.ghc().basis, /no GHC key/);

        store.applyMachineInfo({ GHC: 'yes' });
        assert.equal(gates.ghc().capability, CAPABILITY.UNKNOWN, 'a non-boolean is not an answer either');

        store.applyMachineInfo({ GHC: true });
        assert.equal(gates.ghc().capability, CAPABILITY.PRESENT);
        assert.equal(gates.ghc().render, GHC_STRIP_SHOWS_WHEN === CAPABILITY.PRESENT);

        store.applyMachineInfo({ GHC: false });
        assert.equal(gates.ghc().capability, CAPABILITY.ABSENT);
        assert.equal(gates.ghc().render, GHC_STRIP_SHOWS_WHEN === CAPABILITY.ABSENT);

        // The machine goes away: the previous machine's flag must not survive it.
        store.forget();
        assert.equal(gates.ghc().capability, CAPABILITY.UNKNOWN);
        assert.equal(gates.ghc().render, false);
    });

    test('the gate refuses to be built without a store, rather than answering false', () => {
        assert.throws(() => createLiveGates({}), /capabilities store must be injected/);
        assert.throws(() => createLiveGates({ capabilities: {} }), /capabilities store must be injected/);
    });
});

/* ════════════════════════════════════════ 4. MACHINE INFO — THE FEED THE GATE NEEDS */

describe('the machine-info store: one store, one route', () => {
    const ok = (data) => ({ ok: true, status: 200, data });
    const fail = (status) => ({ ok: false, kind: 'http', status, message: 'no', problem: { e: 'x', st: 'y' } });

    function transportFor(...answers) {
        const calls = [];
        const queue = [...answers];
        return {
            calls,
            request: async (p, options) => {
                calls.push({ path: p, method: options?.method });
                return queue.length > 1 ? queue.shift() : queue[0];
            },
        };
    }

    test('a body is held verbatim, and the route is reached by id', async () => {
        const body = { version: '1293', model: 'decentDe1', serialNumber: '9', GHC: true, extra: {} };
        const transport = transportFor(ok(body));
        const store = createMachineInfoStore({ transport, now: () => 5 });
        await store.load();
        assert.equal(store.get().status, MACHINE_INFO_STATUS.READY);
        assert.deepEqual(store.info(), body, 'the body reaches the adapters unreshaped');
        assert.deepEqual(transport.calls, [{ path: '/machine/info', method: 'GET' }]);
    });

    test('the documented 500 (no machine connected) is "unavailable", not a retry loop', async () => {
        const transport = transportFor(fail(500));
        const store = createMachineInfoStore({ transport });
        await store.load();
        assert.equal(store.get().status, MACHINE_INFO_STATUS.UNAVAILABLE);
        assert.equal(store.info(), null);
        assert.equal(transport.calls.length, 1, 'one request, no retry');
    });

    test('a body that is not an object is unreadable, and is not held', async () => {
        for (const body of [null, 'info', [1, 2], 7]) {
            const store = createMachineInfoStore({ transport: transportFor(ok(body)) });
            await store.load();
            assert.equal(store.get().status, MACHINE_INFO_STATUS.UNREADABLE, JSON.stringify(body));
            assert.equal(store.info(), null);
        }
        assert.equal(readMachineInfo({ GHC: true }).GHC, true);
    });

    test('concurrent callers join one request', async () => {
        const transport = transportFor(ok({ GHC: true }));
        const store = createMachineInfoStore({ transport });
        await Promise.all([store.load(), store.load(), store.load()]);
        assert.equal(transport.calls.length, 1);
    });

    test('forget() drops the answer AND discards a read already in flight', async () => {
        let release;
        const gate = new Promise((r) => { release = r; });
        const transport = {
            request: async () => { await gate; return ok({ GHC: true }); },
        };
        const store = createMachineInfoStore({ transport });
        const inFlight = store.load();
        store.forget();
        release();
        await inFlight;
        assert.equal(store.info(), null, 'the departed machine came back through a late answer');
        assert.equal(store.get().status, MACHINE_INFO_STATUS.NOT_LOADED);
    });

    test('the store feeds the capability store, which is what makes the GHC gate answer', async () => {
        const capabilities = createCapabilitiesStore({
            routes: { capabilities: async () => ({ ok: true, status: 200, data: { capabilities: [] } }) },
        });
        const gates = createLiveGates({ capabilities });
        const info = createMachineInfoStore({ transport: { request: async () => ok({ GHC: true }) } });

        assert.equal(gates.ghc().capability, CAPABILITY.UNKNOWN);
        await info.load();
        capabilities.applyMachineInfo(info.info());
        assert.equal(gates.ghc().capability, CAPABILITY.PRESENT);
    });

    test('it refuses to be built without a transport', () => {
        assert.throws(() => createMachineInfoStore({}), /transport must be injected/);
    });
});

/* ═══════════════════════════════════ 5. B9 — THE REFUSAL, SURFACED UNCONDITIONALLY */

describe('B9: the arm-time refusal is always sent for, and always published', () => {
    const armed = () => ({ ok: true, status: 200, data: null });
    const refusal = (error, message) => ({
        ok: false, kind: 'http', status: 400, message: `${error}: ${message}`,
        problem: { error, message },
    });

    function armStore(answer) {
        const calls = [];
        const transport = {
            request: async (p, options) => { calls.push({ path: p, method: options?.method, body: options?.body }); return answer; },
        };
        return { store: createProfileArmStore({ transport }), calls };
    }

    const profile = { title: 'Blooming espresso', steps: [{ name: 'preinfusion', pump: 'flow' }] };

    test('a 200 arms, and the route and verb are the contract row', async () => {
        const { store, calls } = armStore(armed());
        await store.arm(profile, { profileId: 'p1' });
        assert.equal(store.get().status, ARM_STATUS.ARMED);
        assert.equal(store.refusal(), null);
        assert.equal(calls[0].path, '/machine/profile');
        assert.equal(calls[0].method, 'POST');
    });

    test('the body is the BARE profile — the row gate "shape-asymmetry"', async () => {
        const { calls } = armStore(armed());
        const store = createProfileArmStore({ transport: { request: async (p, o) => { calls.push(o); return armed(); } } });
        await store.arm(profile);
        assert.equal(calls.at(-1).body.profile, undefined, 'POST /machine/profile takes the bare profile');
        assert.equal(calls.at(-1).body.title, 'Blooming espresso');
    });

    test('the arm-time capability refusal reaches the surface with the server sentence intact', async () => {
        const { store } = armStore(refusal('Unsupported profile', 'This machine cannot run a Lever step.'));
        await store.arm(profile, { profileId: 'p1' });
        const state = store.get();
        assert.equal(state.status, ARM_STATUS.REFUSED);
        assert.deepEqual(state.refusal, {
            kind: 'unsupported',
            error: 'Unsupported profile',
            message: 'This machine cannot run a Lever step.',
        });
        assert.equal(state.error, null, 'a refusal is not a transport error');
    });

    test('the parse refusal is a DIFFERENT kind, because it means something else to a person', async () => {
        const { store } = armStore(refusal('Invalid profile', 'steps[0].pump is not a pump type'));
        await store.arm(profile);
        assert.equal(store.refusal().kind, 'invalid');
    });

    test('a 500 is a failure and NOT a refusal — the row gate that the 400 exists for', async () => {
        const { store } = armStore({ ok: false, kind: 'http', status: 500, message: 'boom', problem: null });
        await store.arm(profile);
        assert.equal(store.get().status, ARM_STATUS.FAILED);
        assert.equal(store.refusal(), null, 'inventing a refusal out of a 500 is worse than showing the fault');
    });

    test('UNCONDITIONAL: no capability is consulted, in code or in the module at all', async () => {
        const code = CODE['src/stores/profile-arm-store.js'];
        assert.doesNotMatch(code, /capabilit/i, 'a capability read here IS the pre-filtering B9 forbids');
        assert.doesNotMatch(code, /profileMode/i);
        assert.doesNotMatch(code, /PROFILE_MODE/);
        // And behaviourally: the request goes out whatever anyone believes about the mode.
        const { store, calls } = armStore(refusal('Unsupported profile', 'no Lever'));
        await store.arm({ steps: [{ pump: 'lever' }] });
        assert.equal(calls.length, 1, 'the profile was sent, and the server got to answer');
        assert.equal(store.refusal().error, 'Unsupported profile');
    });

    /**
     * THE PIN ON B9's TRIGGER — WHICH LANDED IN WAVE 5.3, AND THIS TEST TURNED OVER WITH IT.
     *
     * It used to read "nothing in `src/` arms a profile" and to say of itself: "THIS TEST
     * FAILS WHEN THAT IS FIXED, AND THAT IS ITS JOB." It did not fail, and the reason is
     * worth keeping in front of whoever edits it next: the assertion enumerated FIVE files
     * by hand — app-boot, live-wiring, live-screen, live-refusal, app-root — so the caller
     * that actually arrived, `src/stores/profile-library-store.js`, was outside its reach.
     * A hardcoded deny-list cannot notice a new file. It re-ran 55/55 green while three
     * other records still said B9 had no path at all.
     *
     * SO THE PIN IS INVERTED AND IT IS NO LONGER A LIST OF FILES. What is asserted now:
     * the trigger EXISTS (the selector's library store arms the selected record), it is
     * SINGULAR (no second, ad-hoc call site in a screen or the shell — the body belongs to
     * the store that owns the listing), and the read half stays wired. Written as
     * "search the whole cluster and count the callers" rather than "these five do not",
     * because that is the failure this pin has already had once.
     */
    test("B9's trigger: the selector's library store arms, and it is the ONLY caller in src/", () => {
        const trigger = 'src/stores/profile-library-store.js';
        assert.match(stripComments(read(trigger)), /\barm\.arm\(/,
            `${trigger} no longer arms a profile — B9's end-to-end path is open again, and `
            + 'the reachability notes in profile-arm-store.js, app-boot.js and CONTRACTS.json '
            + 'are written against this call');

        /* ONE CALLER, FOUND BY WALKING src/ RATHER THAN BY LISTING FILES. The whole tree
         * is read, so a second arm() anywhere in the client is a failure here rather than
         * a discovery later — which is the exact way the previous spelling of this pin
         * failed. */
        const walk = (rel) => readdirSync(path.join(REPO, rel), { withFileTypes: true })
            .flatMap((entry) => (entry.isDirectory()
                ? walk(`${rel}/${entry.name}`)
                : (entry.name.endsWith('.js') ? [`${rel}/${entry.name}`] : [])));
        const callers = walk('src')
            .filter((file) => file !== 'src/stores/profile-arm-store.js')
            .filter((file) => /\barm\.arm\(/.test(stripComments(read(file))));
        assert.deepEqual(callers, [trigger],
            `B9 is armed from more than one place: ${JSON.stringify(callers)} — the profile BODY `
            + 'belongs to the store that owns the listing, and a second call site is a second '
            + 'sanitiser waiting to drift (row gate shape-asymmetry)');

        /* THE LIVE SCREEN'S OWN FAVOURITE TAP IS STILL NOT A TRIGGER, and that half of the
         * old record is unchanged: the event is dispatched, nothing listens, `favourites`
         * is never populated. B9 is reachable from the SELECTOR, not from Live. */
        assert.match(stripComments(read('src/screens/live-screen.js')), /favourite-select/,
            'the screen still offers the event a Live-side trigger would listen to');
        assert.doesNotMatch(stripComments(read('src/lib/app-boot.js')), /favourite-select/,
            'the shell listens for the favourite now — that is a SECOND trigger; record it');
        // The read half IS wired, and stays wired: the surface and its dismiss are real.
        assert.match(stripComments(read('src/screens/live-wiring.js')), /arm\.clear\(\)/,
            'the dismiss path is the half that was always reachable');
    });

    /**
     * THE FAVOURITE'S HIGHLIGHT HAS ONE OWNER — Ben, 27 August 2026, machine disconnected:
     * "it highlights but if you then click edit profile it will show the previous one".
     *
     * `<live-screen>` wrote `this.favourite` itself on the press and `live-wiring.js` wrote
     * it from the library store on the next update. Two writers, one property, and the
     * winner was whichever ran last — so the mark and the loaded profile were two
     * different facts wearing one name, and Edit profile (which resolves through the
     * LOADED profile) opened the other one. That is L11's shape in the region.
     *
     * THE OWNER IS THE LIBRARY STORE, because it owns the whole two-write sequence and is
     * therefore the only thing that knows "we are loading this one" before `loaded.id`
     * becomes true. `armingId` is that answer and `test/profile-library-store.test.mjs`
     * holds its lifecycle; what is pinned here is that the SCREEN does not write the
     * property behind the controller's back again.
     */
    test('the favourite mark is written by the wiring, never by the screen', () => {
        const screen = stripComments(read('src/screens/live-screen.js'));
        const writes = [...screen.matchAll(/this\.favourite\s*=\s*([^;]+);/g)].map((m) => m[1].trim());
        assert.deepEqual(writes, ["''"],
            'the only write left must be the constructor\'s empty default — a screen that '
            + 'moves its own highlight on a press is asserting a wish, and the controller '
            + 'overwrites it a microtask later with the profile that is actually loaded');

        const wiring = stripComments(read('src/screens/live-wiring.js'));
        assert.match(wiring, /armingId/,
            'the controller must read the store\'s in-flight answer, or the mark cannot '
            + 'move until the round trip lands and the press looks ignored');
    });

    test('a refusal is cleared by the user, never by the next frame', async () => {
        const { store } = armStore(refusal('Unsupported profile', 'no'));
        await store.arm(profile);
        assert.equal(store.get().status, ARM_STATUS.REFUSED);
        store.clear();
        assert.equal(store.get().status, ARM_STATUS.IDLE);
        assert.equal(store.refusal(), null);
    });
});

/* ══════════════════════════════════════════════ 6. THE CLUSTER'S OWN SCREEN LAWS */

describe('screen laws, over the cluster the skeleton suite does not cover', () => {
    test('no endpoint is spelled in any cluster file', () => {
        for (const file of CLUSTER_FILES) {
            assert.doesNotMatch(CODE[file], /['"`][^'"`]*\/(api|ws)\/v1/,
                `${file} spells a path — routes are reached by id, sockets through WS_CHANNELS`);
        }
    });

    test('the two elements and the controller reach no transport and no route table', () => {
        const screenSide = CLUSTER_FILES.filter((f) => !f.startsWith('src/stores/'));
        for (const file of screenSide) {
            assert.doesNotMatch(CODE[file], /rea-routes|rea-transport|callRoute|fetch\(/,
                `${file} talks to the server — the screen holds stores and the generated client only`);
        }
    });

    test('no machine name is read anywhere in the cluster', () => {
        for (const file of CLUSTER_FILES) {
            assert.doesNotMatch(CODE[file], /\b(bengle|de1|decent)\b/i, `${file} reads a machine name (A3/A1)`);
        }
    });

    test('no steam bound and no chart number is restated in the cluster', () => {
        for (const file of CLUSTER_FILES) {
            assert.doesNotMatch(CODE[file], /\b(130|135|160|165|170)\b/, `${file} writes a bound or a floor`);
        }
    });

    test('the elements write no raw length and no colour of their own', () => {
        for (const file of ['src/screens/live-connection.js', 'src/screens/live-refusal.js', 'src/screens/live-dimming.js']) {
            const lengths = [...CODE[file].matchAll(/(?<![-\w(])(\d+(?:\.\d+)?)(px|rem|em)\b/g)];
            assert.deepEqual(lengths.map((m) => m[0]), [], `${file} writes a raw length`);
            assert.doesNotMatch(CODE[file], /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, `${file} writes a colour`);
            assert.doesNotMatch(CODE[file], /!important/, `${file} uses !important`);
            assert.doesNotMatch(CODE[file], /position:\s*(absolute|fixed)/, `${file} positions something (L1)`);
        }
    });

    test('D2: the two elements render no literal text node', () => {
        for (const file of ['src/screens/live-connection.js', 'src/screens/live-refusal.js']) {
            const code = CODE[file];
            assert.match(code, /new I18nController\(this\)/, `${file} has no i18n controller`);
            const literals = [...code.matchAll(/(?<![=!])>\s*([A-Za-z][^<>{}]*?)\s*</g)]
                .map((m) => m[1].trim()).filter(Boolean);
            assert.deepEqual(literals, [], `literal text in ${file}: ${literals.join(' | ')}`);
        }
    });

    test('the library is composed, not copied — no hand-built banner, dialog or button (L8)', () => {
        const connection = CODE['src/screens/live-connection.js'];
        for (const tag of ['ui-alert-banner', 'ui-dialog', 'ui-button']) {
            assert.ok(connection.includes(`<${tag}`), `${tag} is composed`);
        }
        assert.ok(CODE['src/screens/live-refusal.js'].includes('<ui-alert-banner'));
        // A local <dialog> or <button> would be the copy the L8 class is about.
        for (const file of ['src/screens/live-connection.js', 'src/screens/live-refusal.js']) {
            assert.doesNotMatch(CODE[file], /<(dialog|button)\b/, `${file} hand-builds a control`);
        }
    });

    test('the R3 tag is greppable from the gate module, and the swap is a deletion', () => {
        const gates = CODE['src/screens/live-gates.js'];
        assert.match(read('src/screens/live-gates.js'), /r3GroupHeadControllerCapability/,
            'the adapter is named, so the R3 walk finds this call site');
        assert.doesNotMatch(gates, /machineInfo/, 'the gate reads the store, never the info body');
    });
});

/* ══════════════════════════════════ 7. B8 END TO END, AGAINST THE REAL WS MOCK */

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
    return { port, stop: () => child.kill('SIGKILL') };
}

/** Open /ws/v1/devices, optionally send a command, and return the parsed surfaces. */
async function surfaces(port, ms, { send = [], sendAfter = 0 } = {}) {
    const client = await WebSocketClient.connect(`ws://127.0.0.1:${port}/ws/v1/devices`);
    const frames = [];
    client.on('message', (raw) => {
        let parsed;
        try { parsed = JSON.parse(raw); } catch { return; }
        frames.push(parsed);
    });
    if (send.length) {
        await new Promise((r) => setTimeout(r, sendAfter));
        for (const message of send) client.send(JSON.stringify(message));
    }
    await new Promise((r) => setTimeout(r, ms));
    client.close();
    // A command RESULT has no `devices` key; readDevicesFrame returns null for it, which
    // is why the command replies are filtered out here rather than read as state.
    return frames
        .map((f) => readDevicesFrame(f))
        .filter((f) => f !== null)
        .map((f) => connectionSurface(f, { feedStatus: FEED_STATUS.LIVE }));
}

describe('B8 over the real mock: the park is read AND answered', () => {
    let parked;
    let plain;
    let scriptFile;

    before(async () => {
        const dir = mkdtempSync(path.join(tmpdir(), 'decal-b8-'));
        scriptFile = path.join(dir, 'devices.json');
        writeFileSync(scriptFile, JSON.stringify({
            timeline: [{ phase: 'idle' }],
            devices: { pendingAmbiguity: 'machinePicker', connected: [] },
        }));
        const emptyFile = path.join(dir, 'empty.json');
        writeFileSync(emptyFile, JSON.stringify({
            timeline: [{ phase: 'idle' }], devices: { connected: [] },
        }));
        [parked, plain] = await Promise.all([
            startMock(['--ws-script', scriptFile]),
            startMock(['--ws-script', emptyFile]),
        ]);
    });

    after(() => { parked?.stop(); plain?.stop(); });

    test('a parked server renders as "pick one", with the found machines as the choices', async () => {
        const seen = await surfaces(parked.port, 300);
        assert.ok(seen.length > 0, 'no readable devices frame arrived');
        const first = seen[0];
        assert.equal(first.id, CONNECTION_SURFACE.MACHINE_PICKER);
        assert.equal(first.actionable, true, 'the skin owes ReaPrime an answer');
        assert.ok(first.choices.length >= 1, 'the picker has something to offer');
        assert.ok(first.choices.every((d) => typeof d.id === 'string'));
    });

    test('sending the connect command CLEARS the park — the half that is not free', async () => {
        const before = await surfaces(parked.port, 200);
        const target = before[0].choices[0].id;

        const after = await surfaces(parked.port, 500, {
            send: [{ command: 'connect', deviceId: target }], sendAfter: 120,
        });
        assert.equal(after[0].id, CONNECTION_SURFACE.MACHINE_PICKER, 'it starts parked');
        const last = after.at(-1);
        assert.equal(last.awaitingChoice, false, 'the selection session is still open after the answer');
        assert.equal(last.id, CONNECTION_SURFACE.READY);
        assert.equal(last.machine?.id, target, 'and the machine we chose is the one connected');
    });

    test('scanning is its own surface, distinct from both parking and idle', async () => {
        const idle = await surfaces(plain.port, 200);
        assert.equal(idle[0].id, CONNECTION_SURFACE.IDLE, 'nothing connected, nothing being attempted');

        const scanning = await surfaces(plain.port, 400, { send: [{ command: 'scan' }], sendAfter: 80 });
        const ids = new Set(scanning.map((s) => s.id));
        assert.ok(ids.has(CONNECTION_SURFACE.SCANNING), `never saw scanning: ${[...ids].join(', ')}`);
        assert.ok(!ids.has(CONNECTION_SURFACE.MACHINE_PICKER), 'a scan is not a question');
    });
});
