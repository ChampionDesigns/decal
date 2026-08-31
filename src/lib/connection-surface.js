/**
 * The connection states, as one pure derivation.
 */

import {
    AMBIGUITY, CONNECTION_PHASE, CONNECTION_ERROR_SEVERITY, SCAN_SCOPED_ERROR_KINDS,
} from '../data/rea-devices.js';
import { FEED_STATUS } from '../stores/feed-store.js';

export const CONNECTION_SURFACE = Object.freeze({
    /** No frame has ever arrived. The socket may still be opening. */
    WAITING: 'waiting',
    /** A frame arrived and could not be read. We do not know what is attached. */
    UNREADABLE: 'unreadable',
    UNAVAILABLE: 'unavailable',
    STALE: 'stale',
    /** Talking to ReaPrime; nothing is attached and nothing is being attempted. */
    IDLE: 'idle',
    /** Looking for devices. */
    SCANNING: 'scanning',
    /** "Still trying" — the machine half. */
    CONNECTING_MACHINE: 'connectingMachine',
    /** "Still trying" — the scale half. Distinct because a machine may already be up. */
    CONNECTING_SCALE: 'connectingScale',
    /** Connected. */
    READY: 'ready',
    /** "Failed" — ReaPrime published a ConnectionError and is not parked on a question. */
    ERROR: 'error',
    /** "Two machines, pick one." ReaPrime is parked and suppressing recovery. */
    MACHINE_PICKER: 'machinePicker',
    /** The same park, for scales. */
    SCALE_PICKER: 'scalePicker',
    /** ReaPrime reported a phase this build has never heard of. Visible, not smoothed. */
    PHASE_UNKNOWN: 'phaseUnknown',
});

export const CHOICE_SURFACES = Object.freeze([
    CONNECTION_SURFACE.MACHINE_PICKER,
    CONNECTION_SURFACE.SCALE_PICKER,
]);

/** Surfaces that mean "everything is fine, say nothing". Exactly one. */
export const QUIET_SURFACES = Object.freeze([CONNECTION_SURFACE.READY]);

const CHOICES = new Set(CHOICE_SURFACES);
const QUIET = new Set(QUIET_SURFACES);

export const ERROR_SCOPE = Object.freeze({
    /** The scan transport itself. Nothing was being connected; nothing connected is hurt. */
    SCAN: 'scan',
    /** A connection, or an operation on one. Also the answer for a kind we do not know. */
    CONNECTION: 'connection',
});

const SCAN_SCOPED = new Set(SCAN_SCOPED_ERROR_KINDS);

const MACHINE_UP_PHASES = new Set([
    CONNECTION_PHASE.READY,
    CONNECTION_PHASE.CONNECTING_SCALE,
]);

/** `phase` → surface id, for the phases this build knows. */
const PHASE_SURFACE = Object.freeze({
    [CONNECTION_PHASE.IDLE]: CONNECTION_SURFACE.IDLE,
    [CONNECTION_PHASE.SCANNING]: CONNECTION_SURFACE.SCANNING,
    [CONNECTION_PHASE.CONNECTING_MACHINE]: CONNECTION_SURFACE.CONNECTING_MACHINE,
    [CONNECTION_PHASE.CONNECTING_SCALE]: CONNECTION_SURFACE.CONNECTING_SCALE,
    [CONNECTION_PHASE.READY]: CONNECTION_SURFACE.READY,
});

/** `pendingAmbiguity` → surface id. An ambiguity this build does not know still parks. */
const AMBIGUITY_SURFACE = Object.freeze({
    [AMBIGUITY.MACHINE_PICKER]: CONNECTION_SURFACE.MACHINE_PICKER,
    [AMBIGUITY.SCALE_PICKER]: CONNECTION_SURFACE.SCALE_PICKER,
});

const SOURCE_VERDICT = Object.freeze({
    [FEED_STATUS.UNAVAILABLE]: CONNECTION_SURFACE.UNAVAILABLE,
    [FEED_STATUS.STALE]: CONNECTION_SURFACE.STALE,
});

const EMPTY = Object.freeze([]);

export function errorScopeOf(error) {
    if (!error || typeof error !== 'object') return null;
    return SCAN_SCOPED.has(error.kind) ? ERROR_SCOPE.SCAN : ERROR_SCOPE.CONNECTION;
}

function machineIsUp(frame, status) {
    return MACHINE_UP_PHASES.has(status.phase) && !!frame.machine;
}

function errorIsAConnectionFailure(frame, status) {
    const error = status.error;
    if (!error) return false;
    if (errorScopeOf(error) === ERROR_SCOPE.SCAN) return false;
    // 2. SEVERITY. Upstream marks the ones it does not consider failures; believe it.
    if (error.severity === CONNECTION_ERROR_SEVERITY.WARNING) return false;
    // 3. A MACHINE THAT IS UP CONTRADICTS THE CLAIM, in the same frame that makes it.
    if (machineIsUp(frame, status)) return false;
    return true;
}

/** The frame's answer to "which list is the question about". */
function choicesFor(status, surface) {
    if (surface === CONNECTION_SURFACE.SCALE_PICKER) return status.foundScales ?? EMPTY;
    if (surface === CONNECTION_SURFACE.MACHINE_PICKER) return status.foundMachines ?? EMPTY;
    return EMPTY;
}

function noFrame(id, feedStatus) {
    return Object.freeze({
        id,
        phase: null,
        phaseKnown: false,
        awaitingChoice: false,
        choices: EMPTY,
        error: null,
        errorScope: null,
        machine: null,
        scale: null,
        scanning: false,
        feedStatus,
        quiet: false,
        actionable: false,
    });
}

export function connectionSurface(frame, { feedStatus = null } = {}) {
    if (!frame || typeof frame !== 'object') {
        if (feedStatus === FEED_STATUS.UNAVAILABLE) {
            return noFrame(CONNECTION_SURFACE.UNAVAILABLE, feedStatus);
        }
        if (feedStatus === null || feedStatus === FEED_STATUS.NEVER) {
            return noFrame(CONNECTION_SURFACE.WAITING, feedStatus);
        }
        return noFrame(CONNECTION_SURFACE.UNREADABLE, feedStatus);
    }

    const status = frame.connectionStatus;
    if (!status || typeof status !== 'object') {
        return noFrame(CONNECTION_SURFACE.UNREADABLE, feedStatus);
    }

    const id = SOURCE_VERDICT[feedStatus] ?? surfaceId(frame, status);
    const choices = choicesFor(status, id);

    return Object.freeze({
        id,
        phase: status.phase,
        phaseKnown: status.phaseKnown === true,
        awaitingChoice: status.awaitingChoice === true,
        choices,
        /** `ConnectionError.toJson` verbatim, whatever the id is — see PRECEDENCE. */
        error: status.error ?? null,
        errorScope: errorScopeOf(status.error),
        machine: frame.machine ?? null,
        scale: frame.scale ?? null,
        scanning: frame.scanning === true,
        feedStatus,
        /** Nothing to say. Exactly `ready`. */
        quiet: QUIET.has(id),
        /** The skin owes ReaPrime an answer. */
        actionable: CHOICES.has(id),
    });
}

function surfaceId(frame, status) {
    // 1. THE PARK WINS. See PRECEDENCE in the header for the argument and the reversal.
    if (status.awaitingChoice === true) {
        return AMBIGUITY_SURFACE[status.pendingAmbiguity]
            ?? CONNECTION_SURFACE.MACHINE_PICKER;
    }
    if (errorIsAConnectionFailure(frame, status)) return CONNECTION_SURFACE.ERROR;
    if (status.phaseKnown === false) return CONNECTION_SURFACE.PHASE_UNKNOWN;
    return PHASE_SURFACE[status.phase] ?? CONNECTION_SURFACE.PHASE_UNKNOWN;
}

export function surfacesDiffer(a, b) {
    return connectionSurface(a).id !== connectionSurface(b).id;
}
