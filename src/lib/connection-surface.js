/**
 * B8's connection states, as one pure derivation.
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
    // 1. SCOPE. An adapter that is off is a scan problem, not a connection problem.
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
        // THE THREE NULLS, kept apart. `never` is the boot state and is not a fault;
        // `unavailable` is the source's own verdict; anything else with no value is a
        // frame that arrived and could not be read.
        if (feedStatus === FEED_STATUS.UNAVAILABLE) {
            return noFrame(CONNECTION_SURFACE.UNAVAILABLE, feedStatus);
        }
        if (feedStatus === null || feedStatus === FEED_STATUS.NEVER) {
            return noFrame(CONNECTION_SURFACE.WAITING, feedStatus);
        }
        return noFrame(CONNECTION_SURFACE.UNREADABLE, feedStatus);
    }

    const status = frame.connectionStatus;
    // `readDevicesFrame` returns null unless `connectionStatus` read cleanly, so this
    // guard is unreachable through the address layer. It is here because the function
    // takes a plain object and must not throw on one a test hands it by hand.
    if (!status || typeof status !== 'object') {
        return noFrame(CONNECTION_SURFACE.UNREADABLE, feedStatus);
    }

    // THE STATUS FIRST. A frame that is still held says what the source LAST said, not that
    // the source is there; `SOURCE_VERDICT` is the feed's own answer to that question and
    // there is no arrangement of `connectionStatus` that can overrule it.
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
            // A park whose reason this build does not recognise is still a park: it is
            // the SUPPRESSION that matters, and `ambiguityKnown: false` carries the rest.
            ?? CONNECTION_SURFACE.MACHINE_PICKER;
    }
    // 2. A published error is "failed" — WHEN IT IS ONE — and is why a failure must not
    //    look like "still trying". `status.error` alone is not that test: scope, severity
    //    and a machine that is demonstrably up each demote it to a note under the state.
    //    The whole argument, and Ben's frame, are in the header.
    if (errorIsAConnectionFailure(frame, status)) return CONNECTION_SURFACE.ERROR;
    // 3. A phase this build has never heard of is shown as exactly that. The address
    //    layer already marks it (`phaseKnown: false`); collapsing it to `idle` here would
    //    be the smoothing rea-devices.js refuses one layer down.
    if (status.phaseKnown === false) return CONNECTION_SURFACE.PHASE_UNKNOWN;
    return PHASE_SURFACE[status.phase] ?? CONNECTION_SURFACE.PHASE_UNKNOWN;
}

export function surfacesDiffer(a, b) {
    return connectionSurface(a).id !== connectionSurface(b).id;
}
