// The three readers Gate 2 did not cover — shot state, display, update.
//
// Half of this file reads the DART at the pinned commit. Every enum member and every JSON
// key below is re-derived from the handler's own source rather than trusted from a
// document, and every behavioural premise the shot buffer stands on (idle is published at
// cleanup with a null shotId; the socket is fed from a seeded BehaviorSubject) is asserted
// against the publisher. A name that stops existing upstream turns this red.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { readReaFile, resolveReaCommit, PINNED_COMMIT } from '../scripts/lib/rea-source.js';
import {
    readShotStateFrame, readDisplayFrame, readUpdateFrame, isShotRunning,
    SHOT_STATES, SHOT_STATE, SHOT_DECISION_KINDS, SHOT_DECISION_REASONS, SHOT_EVENTS,
    UPDATE_PHASES,
} from '../src/stores/feed-readers.js';
import { isNoReading, ABSENCE } from '../src/data/reading.js';

const SHOT_EVENT_DART = 'lib/src/models/data/shot_state_event.dart';
const UPDATE_DART = 'lib/src/services/app_update_state.dart';
const DISPLAY_DART = 'lib/src/controllers/display_controller.dart';
const STATE_MANAGER_DART = 'lib/src/controllers/de1_state_manager.dart';
const DE1_CONTROLLER_DART = 'lib/src/controllers/de1_controller.dart';

/** Read one Dart `enum Name { a, b, c }` body into its member names. */
function dartEnumMembers(text, name) {
    const start = text.indexOf(`enum ${name} {`);
    assert.notEqual(start, -1, `enum ${name} not found`);
    const open = text.indexOf('{', start);
    const close = text.indexOf('}', open);
    return text.slice(open + 1, close)
        .split(',')
        .map((entry) => entry.replace(/\/\/.*$/gm, '').trim())
        .filter((entry) => entry.length > 0);
}

describe('the enums are pinned to ReaPrime, not hand-maintained', () => {
    test('the reference worktree is at the pin', () => {
        assert.equal(resolveReaCommit(), PINNED_COMMIT);
    });

    test('ShotState', () => {
        const { text } = readReaFile(SHOT_EVENT_DART);
        assert.deepEqual([...SHOT_STATES], dartEnumMembers(text, 'ShotState'));
        assert.deepEqual(Object.values(SHOT_STATE).sort(), [...SHOT_STATES].sort());
    });

    test('ShotDecisionKind and ShotDecisionReason', () => {
        const { text } = readReaFile(SHOT_EVENT_DART);
        assert.deepEqual([...SHOT_DECISION_KINDS], dartEnumMembers(text, 'ShotDecisionKind'));
        assert.deepEqual([...SHOT_DECISION_REASONS], dartEnumMembers(text, 'ShotDecisionReason'));
    });

    test('AppUpdatePhase', () => {
        const { text } = readReaFile(UPDATE_DART);
        assert.deepEqual([...UPDATE_PHASES], dartEnumMembers(text, 'AppUpdatePhase'));
    });

    test('the three `event` values are the ones the publishers write, and there is no fourth', () => {
        const { text } = readReaFile(STATE_MANAGER_DART);
        const { text: model } = readReaFile(SHOT_EVENT_DART);
        // Each `event:` argument runs to the next line-ending comma; one of the three is a
        // ternary spanning three lines, so the names are pulled out of the whole chunk.
        const written = new Set();
        for (const [, chunk] of `${text}\n${model}`.matchAll(/event:\s*([^,]*?),\n/g)) {
            for (const [, name] of chunk.matchAll(/'([a-zA-Z]+)'/g)) written.add(name);
        }
        assert.deepEqual([...written].sort(), [...SHOT_EVENTS].sort());
        assert.match(text, /\?\s*'terminal'\s*:\s*'decision'/, 'the terminal/decision ternary');
    });
});

describe('the shot-state premises the buffer stands on', () => {
    test('ShotState.idle is NOT published from the state stream', () => {
        const { text } = readReaFile(STATE_MANAGER_DART);
        assert.match(text, /if \(state != ShotState\.idle\) \{\s*_publishShotStateFrame\(state\);/);
    });

    test('but an idle frame IS published at cleanup, with no shotId', () => {
        const { text } = readReaFile(STATE_MANAGER_DART);
        const start = text.indexOf('void _publishIdleFrame()');
        assert.notEqual(start, -1);
        const body = text.slice(start, text.indexOf('\n  }', start));
        assert.match(body, /state: ShotState\.idle/);
        assert.equal(body.includes('shotId:'), false, 'the idle frame carries no shot id — that is how a shot ends');
    });

    test('the socket replays the current shot state to a late subscriber', () => {
        const { text } = readReaFile(DE1_CONTROLLER_DART);
        assert.match(text, /BehaviorSubject<ShotStateEvent>[^;]*BehaviorSubject\.seeded\(ShotStateEvent\.idle\(\)\)/);
    });
});

describe('readShotStateFrame', () => {
    const frame = {
        event: 'state',
        timestamp: '2026-08-17T09:15:00.000Z',
        shotId: '7f6f1e2a-0000-4000-8000-000000000001',
        state: 'pouring',
        machineState: 'espresso',
        machineSubstate: 'pouring',
        profileFrame: 3,
        scaleConnected: true,
        scaleLost: false,
        machineHasAutonomousSAW: true,
        decision: null,
    };

    test('reads a live frame', () => {
        const reading = readShotStateFrame(frame);
        assert.equal(reading.ok, true);
        assert.equal(reading.state, 'pouring');
        assert.equal(reading.stateKnown, true);
        assert.equal(reading.shotId, frame.shotId);
        assert.equal(reading.machineStateKnown, true);
        assert.equal(reading.machineSubstateKnown, true);
        assert.equal(reading.profileFrame, 3);
        assert.equal(reading.scaleConnected, true);
        assert.equal(reading.machineHasAutonomousSAW, true);
        assert.equal(reading.decision, null);
        assert.equal(Object.isFrozen(reading), true);
    });

    test('the idle frame: no shot id, and that is the end-of-shot signal', () => {
        const reading = readShotStateFrame({ ...frame, state: 'idle', shotId: null });
        assert.equal(reading.ok, true);
        assert.equal(isNoReading(reading.shotId), true);
        assert.equal(reading.shotId.reason, ABSENCE.NULL);
        assert.equal(isShotRunning(reading), false);
    });

    test('a decision frame is read whole, with unknown names flagged rather than dropped', () => {
        const reading = readShotStateFrame({
            ...frame,
            event: 'decision',
            state: 'stopping',
            decision: { kind: 'stop', reason: 'targetWeight', details: '36.2 g', data: { weight: 36.2 } },
        });
        assert.equal(reading.decision.kind, 'stop');
        assert.equal(reading.decision.kindKnown, true);
        assert.equal(reading.decision.reasonKnown, true);
        assert.deepEqual(reading.decision.data, { weight: 36.2 });

        const odd = readShotStateFrame({ ...frame, decision: { kind: 'levitate', reason: 'vibes' } });
        assert.equal(odd.decision.kindKnown, false, 'reported, never mapped to a neighbour');
        assert.equal(odd.decision.reasonKnown, false);
    });

    test('an unknown state name is read and flagged — never rewritten to idle', () => {
        const reading = readShotStateFrame({ ...frame, state: 'brewing' });
        assert.equal(reading.ok, true);
        assert.equal(reading.state, 'brewing');
        assert.equal(reading.stateKnown, false);
        assert.equal(isShotRunning(reading), false);
    });

    test('a frame with no readable state is NOT ok — and is not read as idle', () => {
        for (const bad of [null, undefined, 42, [], {}, { state: null }]) {
            const reading = readShotStateFrame(bad);
            assert.equal(reading.ok, false, `${JSON.stringify(bad)}`);
            assert.equal(isShotRunning(reading), false);
        }
    });

    test('isShotRunning covers exactly the three in-shot states', () => {
        const running = SHOT_STATES.filter((state) => isShotRunning(readShotStateFrame({ ...frame, state })));
        assert.deepEqual(running, ['preheating', 'pouring', 'stopping']);
    });
});

describe('readDisplayFrame', () => {
    const frame = {
        wakeLockEnabled: true,
        wakeLockOverride: false,
        brightness: 80,
        requestedBrightness: 100,
        lowBatteryBrightnessActive: true,
        platformSupported: { brightness: true, wakeLock: false },
    };

    test('every key the handler writes is read', () => {
        const { text } = readReaFile(DISPLAY_DART);
        for (const key of Object.keys(frame)) assert.match(text, new RegExp(`'${key}':`), `${key} in DisplayState.toJson`);
        for (const key of ['brightness', 'wakeLock']) {
            assert.match(text, new RegExp(`'${key}':`), `${key} in DisplayPlatformSupport.toJson`);
        }
    });

    test('reads the frame, and keeps requested apart from actual', () => {
        const reading = readDisplayFrame(frame);
        assert.equal(reading.ok, true);
        assert.equal(reading.brightness, 80);
        assert.equal(reading.requestedBrightness, 100, 'the pair is why the skin need not remember what it sent');
        assert.equal(reading.lowBatteryBrightnessActive, true);
        assert.equal(reading.platformSupported.brightness, true);
        assert.equal(reading.platformSupported.wakeLock, false);
    });

    test('a missing platformSupported block is an absence, not "unsupported"', () => {
        const reading = readDisplayFrame({ ...frame, platformSupported: undefined });
        assert.equal(isNoReading(reading.platformSupported.brightness), true);
        assert.equal(reading.platformSupported.brightness.reason, ABSENCE.NO_SOURCE);
    });

    test('a wrong-typed flag is an absence, not a truthy read', () => {
        const reading = readDisplayFrame({ ...frame, wakeLockEnabled: 'true' });
        assert.equal(isNoReading(reading.wakeLockEnabled), true);
        assert.equal(reading.wakeLockEnabled.reason, ABSENCE.NON_FINITE);
    });

    test('no brightness means the frame is not ok', () => {
        assert.equal(readDisplayFrame({ ...frame, brightness: null }).ok, false);
        assert.equal(readDisplayFrame(null).ok, false);
    });
});

describe('readUpdateFrame', () => {
    const frame = {
        phase: 'available',
        currentVersion: '1.4.2',
        latestVersion: '1.5.0',
        releaseNotes: 'notes',
        releaseUrl: 'https://example.invalid/r/1.5.0',
        installable: true,
        progress: null,
        error: null,
    };

    test('every key the service writes is read', () => {
        const { text } = readReaFile(UPDATE_DART);
        for (const key of Object.keys(frame)) assert.match(text, new RegExp(`'${key}':`), `${key} in AppUpdateState.toJson`);
    });

    test('reads the frame', () => {
        const reading = readUpdateFrame(frame);
        assert.equal(reading.ok, true);
        assert.equal(reading.phase, 'available');
        assert.equal(reading.phaseKnown, true);
        assert.equal(reading.latestVersion, '1.5.0');
        assert.equal(reading.installable, true);
    });

    test('a null progress is NOT zero progress', () => {
        const reading = readUpdateFrame(frame);
        assert.equal(isNoReading(reading.progress), true);
        assert.equal(reading.progress.reason, ABSENCE.NULL);
        assert.equal(Number(reading.progress), Number.NaN, 'arithmetic on an absence is loud');
    });

    test('a null latestVersion means "not checked yet", and is not read as up to date', () => {
        const reading = readUpdateFrame({ ...frame, phase: 'idle', latestVersion: null });
        assert.equal(isNoReading(reading.latestVersion), true);
    });

    test('an unknown phase is flagged, not coerced', () => {
        const reading = readUpdateFrame({ ...frame, phase: 'rebooting' });
        assert.equal(reading.ok, true);
        assert.equal(reading.phaseKnown, false);
    });
});
