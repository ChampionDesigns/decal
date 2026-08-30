/**
 * The readers that turn one socket frame into the shape a store holds.
 */

import { ABSENCE, noReading, readNumber, readValue, hasKey } from '../data/reading.js';
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
