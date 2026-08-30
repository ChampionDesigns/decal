// READERS FOR THE THREE FEEDS THE ADDRESS LAYER DOES NOT COVER.
//
// Gate 2 (`src/data/rea-address.js`) reads the machine snapshot, the scale snapshot, the
// sensor frames and stored measurements; `src/data/rea-devices.js` reads the devices
// frame. Three of Gate 4's seven feeds — shot state, display, update — had no reader at
// the pinned commit, so they get one here, built on the SAME primitives
// (`src/data/reading.js`), obeying the same rules:
//
//   * key presence / null is the validity signal, decided per frame by how the HANDLER
//     writes it, never by a threshold or a default invented here;
//   * an unrecognised enum name is reported as unrecognised, never silently mapped to a
//     neighbour;
//   * A7 — no fallback path. A missing field is an absence, not a zero and not a guess.
//
// WHY THE SPLIT IS WHERE IT IS: these three frames are read by nothing but their stores,
// and putting them in `rea-address.js` would mean two builders editing one file in the
// same wave. If a second consumer appears, or Gate 2 grows these readers, this file's
// contents move there and this file is DELETED — not left behind re-exporting, which is
// how two readers of one wire format start to drift.
//
// THE SHAPES ARE READ FROM THE HANDLERS AT THE PIN, `2b047d02`:
//   * shot state — `ShotStateEvent.toJson`, `lib/src/models/data/shot_state_event.dart`,
//     published by `De1StateManager._publishShotStateFrame` / `_publishShotDecisionFrame`
//     / `_publishIdleFrame`, served by `De1Handler._handleShotState`.
//   * display    — `DisplayState.toJson`, `lib/src/controllers/display_controller.dart`,
//     served by `DisplayHandler._handleWebSocket`.
//   * update     — `AppUpdateState.toJson`, `lib/src/services/app_update_state.dart`,
//     served by `UpdateHandler._handleSocket`.
//
// ALL THREE WRITE EVERY KEY UNCONDITIONALLY (each `toJson` is a map literal, not a
// conditional build), so on these frames NULL is the absence signal and an ABSENT key
// means a malformed frame — the opposite of the machine snapshot's rule, and true for the
// same reason it is true of the devices frame. That difference is not a style choice; it
// is read off the handler, per frame, and it is why `ok` is false rather than a shrug.

import { ABSENCE, noReading, readNumber, readValue, hasKey } from '../data/reading.js';
// THE frame predicate, not a fourth spelling of it. Four `is this a frame` guards existed
// across the tree and they disagreed about a JSON array; there is one implementation now,
// beside the classifier that routes a socket message, and every layer imports it.
import { isFrameObject } from '../data/rea-ws-channels.js';
import { isMachineState, isMachineSubstate } from '../data/machine-state.js';

export const SHOT_STATES = Object.freeze(['idle', 'preheating', 'pouring', 'stopping', 'finished']);

export const SHOT_STATE = Object.freeze({
    IDLE: 'idle',
    PREHEATING: 'preheating',
    POURING: 'pouring',
    STOPPING: 'stopping',
    FINISHED: 'finished',
});

/** `enum ShotDecisionKind`. `terminal` is also an `event` value; the two are different
 *  fields and mean different things — the kind describes the decision, the event
 *  describes the frame. */
export const SHOT_DECISION_KINDS = Object.freeze(['advance', 'stop', 'abort', 'terminal', 'finalize']);

/** `enum ShotDecisionReason`. Rendered as text by a screen; never branched on here. */
export const SHOT_DECISION_REASONS = Object.freeze([
    'noScale', 'targetWeight', 'targetVolume', 'apiStop', 'appStop', 'machineEnded',
    'profileAdvance', 'profileSkip', 'error', 'disconnected', 'stoppingBackstop',
]);

/**
 * The three `event` values the publishers actually write: `'state'` for a state
 * transition, `'decision'` for a decision, `'terminal'` for the decision whose kind is
 * terminal. There is no fourth.
 */
export const SHOT_EVENTS = Object.freeze(['state', 'decision', 'terminal']);

/** `enum AppUpdatePhase` — `app_update_state.dart`. */
export const UPDATE_PHASES = Object.freeze([
    'idle', 'checking', 'available', 'downloading', 'installing', 'error',
]);

const SHOT_STATE_SET = new Set(SHOT_STATES);
const SHOT_EVENT_SET = new Set(SHOT_EVENTS);
const SHOT_DECISION_KIND_SET = new Set(SHOT_DECISION_KINDS);
const SHOT_DECISION_REASON_SET = new Set(SHOT_DECISION_REASONS);
const UPDATE_PHASE_SET = new Set(UPDATE_PHASES);

function readFlag(source, key) {
    if (!source || typeof source !== 'object') return noReading(ABSENCE.NO_SOURCE);
    if (!hasKey(source, key)) return noReading(ABSENCE.ABSENT);
    const value = source[key];
    if (value === null || value === undefined) return noReading(ABSENCE.NULL);
    if (typeof value !== 'boolean') return noReading(ABSENCE.NON_FINITE);
    return value;
}

/** Read a string channel and say whether the name is one this build knows. */
function readName(source, key, known) {
    const value = readValue(source, key);
    return {
        value,
        known: typeof value === 'string' && known.has(value),
    };
}

export function readShotStateFrame(frame) {
    const present = isFrameObject(frame);
    const state = readName(frame, 'state', SHOT_STATE_SET);
    const event = readName(frame, 'event', SHOT_EVENT_SET);
    // Validated against the GENERATED machine enums, not against a set spelled here.
    const machineState = readValue(frame, 'machineState');
    const machineSubstate = readValue(frame, 'machineSubstate');
    const decision = present && frame.decision && typeof frame.decision === 'object'
        ? frame.decision
        : null;

    return Object.freeze({
        // A frame that does not carry a readable `state` is malformed. Told as "unknown",
        // never as idle — an invented idle would end a live shot's accumulation.
        ok: present && typeof state.value === 'string',
        event: event.value,
        eventKnown: event.known,
        /** ReaPrime's own stamp. The plot axis reads this; the store's arrival stamp does
         *  not replace it (B4 — see time-axis.js). */
        timestamp: readValue(frame, 'timestamp'),
        /** Null on the idle frame published at cleanup, a uuid during a shot. */
        shotId: readValue(frame, 'shotId'),
        state: state.value,
        stateKnown: state.known,
        machineState,
        machineStateKnown: isMachineState(machineState),
        machineSubstate,
        machineSubstateKnown: isMachineSubstate(machineSubstate),
        profileFrame: readNumber(frame, 'profileFrame'),
        scaleConnected: readFlag(frame, 'scaleConnected'),
        /** The scale went away DURING the shot. A shot fact, distinct from "no scale". */
        scaleLost: readFlag(frame, 'scaleLost'),
        machineHasAutonomousSAW: readFlag(frame, 'machineHasAutonomousSAW'),
        decision: decision === null ? null : Object.freeze({
            kind: readValue(decision, 'kind'),
            kindKnown: SHOT_DECISION_KIND_SET.has(decision.kind),
            reason: readValue(decision, 'reason'),
            reasonKnown: SHOT_DECISION_REASON_SET.has(decision.reason),
            details: readValue(decision, 'details'),
            /** Free-form payload, kept verbatim: reading it is the screen's business. */
            data: decision.data && typeof decision.data === 'object' ? decision.data : null,
        }),
    });
}

/** Is this shot-state reading one in which a shot is running? `finished` is NOT: the shot
 *  is over and its record is being persisted. */
export function isShotRunning(reading) {
    return !!reading && reading.ok
        && (reading.state === SHOT_STATE.PREHEATING
            || reading.state === SHOT_STATE.POURING
            || reading.state === SHOT_STATE.STOPPING);
}

export function readDisplayFrame(frame) {
    const present = isFrameObject(frame);
    const platform = present && isFrameObject(frame.platformSupported) ? frame.platformSupported : null;
    const brightness = readNumber(frame, 'brightness');
    return Object.freeze({
        ok: present && typeof brightness === 'number',
        brightness,
        /** What was ASKED for, which differs from `brightness` while a low-battery clamp
         *  is active — the pair is why the skin does not need to remember what it sent. */
        requestedBrightness: readNumber(frame, 'requestedBrightness'),
        wakeLockEnabled: readFlag(frame, 'wakeLockEnabled'),
        wakeLockOverride: readFlag(frame, 'wakeLockOverride'),
        lowBatteryBrightnessActive: readFlag(frame, 'lowBatteryBrightnessActive'),
        platformSupported: Object.freeze({
            brightness: readFlag(platform, 'brightness'),
            wakeLock: readFlag(platform, 'wakeLock'),
        }),
    });
}

export function readUpdateFrame(frame) {
    const phase = readName(frame, 'phase', UPDATE_PHASE_SET);
    return Object.freeze({
        ok: isFrameObject(frame) && typeof phase.value === 'string',
        phase: phase.value,
        phaseKnown: phase.known,
        currentVersion: readValue(frame, 'currentVersion'),
        /** Null until a check has answered. Null is "not known yet", not "up to date". */
        latestVersion: readValue(frame, 'latestVersion'),
        releaseNotes: readValue(frame, 'releaseNotes'),
        releaseUrl: readValue(frame, 'releaseUrl'),
        installable: readFlag(frame, 'installable'),
        /** 0..1 while downloading, null otherwise. A null progress is not zero progress. */
        progress: readNumber(frame, 'progress'),
        error: readValue(frame, 'error'),
    });
}
