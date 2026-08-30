/**
 * connection-surface.js — B8's connection states, as one pure derivation.
 *
 * ITEM `live-connection-states`. SCOPE.md:1854-1860, verbatim: "Distinguishable
 * connection states (B8): 'still trying', 'failed', and 'two machines, pick one' must not
 * look identical, because today they do. The full `connectionStatus` payload is already
 * published by ReaPrime; consuming it is free. And the 'pick one' state must be
 * ANSWERABLE, not just rendered."
 *
 * WHY A PURE FUNCTION AND NOT A COMPONENT METHOD. The distinction this item exists to
 * make is a DERIVATION — which of eight states a frame is — and a derivation written
 * inside a render method can only be tested by rendering it. Here it is `node --test`
 * material, exhaustively, including the two states no mock can produce (a
 * `connectionStatus.error`, and a phase this build has never heard of).
 *
 * ===========================================================================
 * THE INPUT IS ALREADY PARSED, AND THE TWO NULLS ARE NOT THE SAME NULL
 * ===========================================================================
 *
 * The frame comes from `readDevicesFrame` (src/data/rea-devices.js), which carries
 * `machine-link.js`'s rule forward: "A MALFORMED FRAME MAPS TO null, DISTINCT FROM AN
 * EMPTY LIST. `null` is 'we do not know what is attached'; `[]` is 'nothing is attached'."
 * A feed store holds that null as its `value`, so by the time a screen reads it, THREE
 * different situations have collapsed into `value === null`:
 *
 *   1. nothing has ever arrived              — the boot state of every feed
 *   2. a frame arrived and was unreadable    — the malformed case rule 1 is about
 *   3. the source gave up                    — FEED_STATUS.UNAVAILABLE
 *
 * Rendering all three as one picture is the same mistake as rendering "still trying" and
 * "failed" as one picture, one layer down. So this function takes the feed's STATUS beside
 * its value and separates them: WAITING, UNREADABLE, UNAVAILABLE. An empty device list
 * with `phase: idle` is a fourth, entirely different answer — the server is talking and
 * says nothing is attached — and it is IDLE.
 *
 * ===========================================================================
 * A HELD FRAME IS NOT A LIVE SOURCE — THE STATUS OUTRANKS IT
 * ===========================================================================
 *
 * The status matters just as much when there IS a value, and for a while this function only
 * consulted it when there was not. A feed store does not clear its value when the source
 * goes: "a source that closes does NOT clear the value … The value stays, marked stale"
 * (`feed-store.js:19-26`), and `valueOf` hands that held value back whatever the status is.
 * So a devices socket that had reached `phase: ready` and then DIED still held a `ready`
 * frame — and this function copied the status onto the surface without testing it and
 * answered `ready`, whose whole job is to render NOTHING. A machine that has gone away
 * looked exactly like a machine that is connected: "a dead instrument's reading presented
 * as current, which is the one thing this layer exists to prevent" (`feed-store.js:129-137`),
 * one layer up and about the connection itself.
 *
 * So the feed's own verdict is read FIRST, and it names the surface:
 *
 *   FEED_STATUS.UNAVAILABLE  -> UNAVAILABLE. The socket layer gave up and is NOT retrying;
 *                               `rea-sockets.js:44` folds that into "feature-absent …
 *                               instead of a reconnect loop".
 *   FEED_STATUS.STALE        -> STALE. The source closed or errored and the value is
 *                               latched old (`feed-store.js:206-212`), while the
 *                               ReconnectingWebSocket keeps trying. Different from
 *                               UNAVAILABLE by exactly that: one is coming back, one is not.
 *                               Collapsing the two would be this file's own mistake.
 *
 * The frame is still read and still travels — `machine`, `scale`, `phase` and `error` are
 * the LAST-KNOWN picture and a screen may show them under the marker. What does not travel
 * is `quiet` and `actionable`: a dead feed says something, and a park behind a dead feed is
 * not a question this skin can answer, because the found-device list it would offer is as
 * old as the frame. THE VERDICT THEREFORE OUTRANKS THE PARK. REVERSAL, one line: drop the
 * `SOURCE_VERDICT[feedStatus] ??` from the `id` in `connectionSurface` and the frame decides
 * again. Recorded in `waves/5.1/DEFERRED_QUESTIONS_fix-2.md`.
 *
 * WITH NO VALUE AT ALL, `STALE` STAYS `UNREADABLE` and that is not an inconsistency: the
 * store only reaches STALE once a frame has arrived (`receivedAt !== null`), so a null value
 * beside it means the frame that arrived could not be read — "we do not know what is
 * attached" is the stronger and more honest answer there.
 *
 * ===========================================================================
 * PRECEDENCE, AND THE ONE ORDERING DECISION IN THE FILE
 * ===========================================================================
 *
 * `pendingAmbiguity` OUTRANKS `error`. Both can be set on one frame. The park is the state
 * where ReaPrime is WAITING FOR THIS SKIN — "Skipping scale recovery while device
 * selection is pending" (`connection_manager.dart` `_connectImpl`, quoted at
 * SCOPE.md:1084) — so it is the only one of the two that the person in front of the screen
 * can act on, and the error alongside it is usually the failed attempt that CAUSED the
 * park. Showing "failed" over a server that is holding a question open is precisely the
 * old failure this item retires, one rung up.
 *
 * The error is not dropped: it travels on the surface as `error` whatever the id is, so a
 * picker surface can carry the reason underneath the choice. REVERSAL, one line: move the
 * `awaitingChoice` test below the `error` test in `connectionSurface`.
 *
 * ===========================================================================
 * AN ERROR IS NOT AUTOMATICALLY "FAILED" — THE BANNER IS A CLAIM, AND IT MUST BE TRUE
 * ===========================================================================
 *
 * Ben, 28 August 2026, at the bench: "for some reason now I cannot get rid of the 'could
 * not connect' banner, it says bluetooth is off which it is but Bengle can connect over USB
 * (which it is now) so doesn't need bluetooth turned on."
 *
 * MEASURED ON HIS TABLET THE SAME MORNING, one frame off `/ws/v1/devices`, trimmed to the
 * parts that matter and otherwise verbatim:
 *
 *     "devices": [{"name": …, "id": "DA:BA:AF:20:7A:03",
 *                  "state": "connected", "type": "machine", "available": true}, …],
 *     "connectionStatus": {
 *       "phase": "ready",
 *       "foundMachines": [], "foundScales": [], "pendingAmbiguity": null,
 *       "error": {"kind": "adapterOff", "severity": "error",
 *                 "timestamp": "2026-08-27T21:37:16.637241Z",
 *                 "message": "Bluetooth is turned off.",
 *                 "suggestion": "Turn Bluetooth on to scan for Bluetooth devices."}}
 *
 * `GET /api/v1/machine/state` answered `idle` with live pressure at the same moment. The
 * machine was up. This file answered `ERROR`, and `live-connection.js` drew the headline
 * "Could not connect" in an assertive live region, 88.8px tall, that no action could clear.
 * The whole of the old rule was one line: `if (status.error) return CONNECTION_SURFACE.ERROR`,
 * placed above the phase so that ANY published error outranked `phase: "ready"` for ever.
 *
 * THE HEADLINE IS A CLAIM ABOUT THE MACHINE, AND THE PAYLOAD WAS CONTRADICTING IT IN THE
 * SAME FRAME. That is the same defect B8 exists to retire, running the other way: B8 was
 * three states collapsing into one picture; this is one picture asserted over a state that
 * says the opposite. So `status.error` no longer names the surface by existing. It names
 * the surface only when it is a report that connecting FAILED, and three tests off the
 * payload decide that. Each demotes, each is a POSITIVE identification, and anything not
 * positively identified keeps the loud answer — an unknown kind, an unknown severity, a
 * phase this build does not know all still reach the banner.
 *
 *   1. SCOPE — is it about a connection at all? `SCAN_SCOPED_ERROR_KINDS` (rea-devices.js)
 *      is ReaPrime's own `ConnectionErrorKind.sticky`: adapterOff, bluetoothPermissionDenied,
 *      scanFailed. Every one is a statement about the RADIO. Nothing was being connected
 *      when one is raised and nothing that IS connected is affected by it, which is why
 *      upstream lets them outlive a phase change while it clears the others. An adapter
 *      that is off is a SCAN problem, not a CONNECTION problem, and that is the distinction
 *      Ben was pointing at. A scan-scoped error never takes the headline at ANY phase —
 *      "Could not connect" is untrue at `ready` and it is untrue at `idle` too, where
 *      nothing tried.
 *
 *   2. SEVERITY — does upstream itself call it a failure? `severity` is on every
 *      `ConnectionError`, it has been on the wire the whole time, and until today this
 *      layer ignored it. ReaPrime uses the difference deliberately: an unexpected MACHINE
 *      disconnect is `error`, the same event for a SCALE is `warning`, and a profile upload
 *      that failed is `warning` (`disconnect_supervisor.dart:134/153`,
 *      `workflow_device_sync.dart:155`). A warning is not a failure and must not wear a
 *      failure's headline. Only the literal `warning` demotes; an unrecognised severity is
 *      not read as a lesser one.
 *
 *   3. IS A MACHINE UP? Not "does the phase say so" — BOTH halves of the frame have to say
 *      so, and the conjunction is the point. The phase alone lies in a real window: when a
 *      machine drops unexpectedly `DisconnectSupervisor._handleMachineDisconnect` publishes
 *      `machineDisconnected` (severity `error`), and the manager's own
 *      `_handleMachineDisconnected` callback cancels timers and MOVES NO PHASE — so `ready`
 *      can outlive the machine by however long the recovery scan takes to start. Upstream's
 *      `StatusPublisher` will not clear it either: it clears a non-sticky error only when
 *      the phase CHANGES into a clearing phase, and here it does not change at all. The
 *      DEVICE LIST tells the truth there — the entry goes
 *      to `state: "disconnected"` and `frame.machine` is null — so a machine is "up" only
 *      when the phase is one of the two that mean a machine is connected (READY, and
 *      CONNECTING_SCALE, where the machine is up and only the scale is still being tried)
 *      AND the device list holds a connected machine. On Ben's frame both agree, and it
 *      demotes. On a machine that has just dropped they disagree, and it does not: the
 *      banner still says "Could not connect", because that is then true.
 *
 * WHAT HAPPENS TO THE INFORMATION, WHICH IS NOT DISCARDED. Three things, and the choice
 * between them is per surface rather than one policy:
 *
 *   * IT IS CLASSIFIED. The surface gains `errorScope`, so a consumer can tell "the scan
 *     transport is unavailable" from "a connection failed" without matching a string. The
 *     person who presses Search on the connection page is the reader this is for: a scan
 *     genuinely will not find anything over Bluetooth while the adapter is off, and
 *     `errorScope === ERROR_SCOPE.SCAN` beside the server's own two sentences is that
 *     answer, held ready for whoever offers the button.
 *   * IT IS PRINTED, AS A NOTE UNDER THE STATE. `error` travels on the surface whatever the
 *     id is, and `live-connection.js` renders it beneath the headline the phase earned
 *     rather than as one. At `idle` the person reads "No machine" and then "Bluetooth is
 *     turned off. Turn Bluetooth on to scan for Bluetooth devices." — the state, then the
 *     reason. That is the quiet note, and it costs no new surface and no invented sentence.
 *   * AT `ready` IT IS SILENT, AND THAT IS A DECISION AND NOT AN OVERSIGHT. `ready` renders
 *     nothing at all (C1: the Live screen's answer to about 120 missing rows), so a note
 *     there would mean giving the connected case a row it does not have. An adapter that is
 *     off has NO consequence for a machine on USB — Ben's "doesn't need bluetooth turned
 *     on" is the whole of it — so a permanent strip about a radio he is not using is the
 *     same defect at lower volume. The fact stays on the surface object for the page where
 *     it is actionable, and the brew screen says nothing.
 *
 * AND THE THREE THAT ARE NOT SCAN-SCOPED, SILENCED AT `ready` BY RULES 2 AND 3, ARE EACH
 * OWNED SOMEWHERE ELSE: `scaleDisconnected` is a `warning` and the scale's absence already
 * shows as a no-reading on the weight readout, whose feed owns it; `profileUploadFailed` is
 * a `warning` and this screen has a whole second banner for it (`live-refusal.js` and the
 * arm store); `machineDisconnected` is severity `error` and is NOT silenced, because the
 * device list contradicts the phase the moment it happens. Nothing is dropped on the floor.
 *
 * REVERSAL, one line: make `surfaceId`'s error test `if (status.error)` again and every
 * published error names the surface as it did before.
 *
 * THE UPSTREAM HALF IS A SEPARATE BUG AND IS NOT FIXED HERE. ReaPrime latches the adapter
 * error and clears it only on a poweredOff -> poweredOn transition of the adapter
 * (`connection_manager.dart:466-474`), so with the adapter off from before the app started
 * there is no transition to clear it and the timestamp on Ben's frame was hours old. That
 * is being written up separately. Nothing in this file waits for it: a skin that renders a
 * true payload wrongly is this side's defect whatever the other side does.
 *
 * NO ORACLE ANSWER EXISTS FOR ANY OF THIS, and the disqualification check is why: Slate
 * collapses the whole payload to `data.scanning`, so the corpus can only show the picture
 * B8 is retiring. The 49 captured states contain no picker and no connection error.
 */

import {
    AMBIGUITY, CONNECTION_PHASE, CONNECTION_ERROR_SEVERITY, SCAN_SCOPED_ERROR_KINDS,
} from '../data/rea-devices.js';
import { FEED_STATUS } from '../stores/feed-store.js';

/**
 * The eight distinguishable surfaces, plus the two "no readable frame" ones.
 *
 * Every id is a state a person could be looking at and describe differently from every
 * other one. That is the whole test for whether a member belongs here.
 */
export const CONNECTION_SURFACE = Object.freeze({
    /** No frame has ever arrived. The socket may still be opening. */
    WAITING: 'waiting',
    /** A frame arrived and could not be read. We do not know what is attached. */
    UNREADABLE: 'unreadable',
    /** The source gave up and is not retrying. A verdict (FEED_STATUS.UNAVAILABLE). */
    UNAVAILABLE: 'unavailable',
    /**
     * The source went, and what we hold is the last thing it said (FEED_STATUS.STALE).
     * Distinct from UNAVAILABLE because the socket is still reconnecting, and distinct from
     * READY because a held frame is not a live source — see the header.
     */
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

/**
 * Which surfaces are a question the skin must ANSWER, rather than a state to look at.
 *
 * This set is the difference between B8 done and B8 half-done: "Rendering the park with
 * better wording, without the answer path, would preserve the old failure" (SCOPE.md:1859).
 */
export const CHOICE_SURFACES = Object.freeze([
    CONNECTION_SURFACE.MACHINE_PICKER,
    CONNECTION_SURFACE.SCALE_PICKER,
]);

/** Surfaces that mean "everything is fine, say nothing". Exactly one. */
export const QUIET_SURFACES = Object.freeze([CONNECTION_SURFACE.READY]);

const CHOICES = new Set(CHOICE_SURFACES);
const QUIET = new Set(QUIET_SURFACES);

/**
 * WHAT A PUBLISHED ERROR IS ABOUT. Two answers, and the difference decides whether it may
 * wear the "Could not connect" headline. See the header section on the banner as a claim.
 *
 * There is no `scope` key on `ConnectionError`; this is derived from `kind` against
 * ReaPrime's own `SCAN_SCOPED_ERROR_KINDS` set, and CONNECTION is the fallback on purpose.
 * A kind this build has never heard of is treated as a connection failure and keeps the
 * banner: the loud answer is the safe one to be wrong with, and A7's rule is that we do
 * not invent a gentler state than the one we were told about.
 */
export const ERROR_SCOPE = Object.freeze({
    /** The scan transport itself. Nothing was being connected; nothing connected is hurt. */
    SCAN: 'scan',
    /** A connection, or an operation on one. Also the answer for a kind we do not know. */
    CONNECTION: 'connection',
});

const SCAN_SCOPED = new Set(SCAN_SCOPED_ERROR_KINDS);

/**
 * THE PHASES THAT MEAN A MACHINE IS CONNECTED — half of test 3, never the whole of it.
 *
 * `CONNECTING_SCALE` belongs here beside `READY` because it is reached only after the
 * machine is up; `live-connection.js` has said so in words since it was written ("The
 * machine is connected. Still trying the scale."). The other half is the device list, and
 * the conjunction is what makes this safe — see `machineIsUp`.
 */
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

/**
 * THE FEED'S OWN VERDICT -> surface id, and it outranks the frame. See the header: a held
 * frame is not a live source, and `ready` is the surface that renders nothing at all.
 */
const SOURCE_VERDICT = Object.freeze({
    [FEED_STATUS.UNAVAILABLE]: CONNECTION_SURFACE.UNAVAILABLE,
    [FEED_STATUS.STALE]: CONNECTION_SURFACE.STALE,
});

const EMPTY = Object.freeze([]);

/**
 * Which thing is this error about? `null` when there is no error at all.
 *
 * @param {object|null|undefined} error  `ConnectionError.toJson`, verbatim
 * @returns {string|null} an `ERROR_SCOPE` member, or null
 */
export function errorScopeOf(error) {
    if (!error || typeof error !== 'object') return null;
    return SCAN_SCOPED.has(error.kind) ? ERROR_SCOPE.SCAN : ERROR_SCOPE.CONNECTION;
}

/**
 * IS A MACHINE CONNECTED, ACCORDING TO BOTH HALVES OF THE FRAME?
 *
 * The phase alone is not enough and the reason is read off the pinned source, not guessed:
 * `DisconnectSupervisor._handleMachineDisconnect` publishes `machineDisconnected`, and the
 * manager's `_handleMachineDisconnected` callback (connection_manager.dart) cancels timers
 * and MOVES NO PHASE — so `ready` outlives the machine until a recovery scan moves it. The
 * device list is right immediately — the entry goes to `state: "disconnected"` and
 * `readDevicesFrame` stops finding a connected machine.
 *
 * So both must agree, and disagreement is NOT "up". That direction is the conservative
 * one: it demotes an error only when the payload says twice that there is a machine, and
 * it leaves the banner intact for the case where the machine really did go away.
 *
 * @param {object} frame   `readDevicesFrame(...)` output
 * @param {object} status  its `connectionStatus`
 */
function machineIsUp(frame, status) {
    return MACHINE_UP_PHASES.has(status.phase) && !!frame.machine;
}

/**
 * MAY THIS ERROR NAME THE SURFACE — i.e. may the screen say "Could not connect"?
 *
 * Three demotions, all off the payload, all POSITIVE identifications. See the header for
 * the argument behind each. Anything not positively identified falls through to `true`
 * and keeps the banner, which is why an unknown `kind` and an unknown `severity` are both
 * still failures here.
 */
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
        /* No frame, so no error, so no scope. Null is the "there is no error" answer and
         * is deliberately NOT `CONNECTION` — see `errorScopeOf`. */
        errorScope: null,
        machine: null,
        scale: null,
        scanning: false,
        feedStatus,
        quiet: false,
        actionable: false,
    });
}

/**
 * Which surface is this frame?
 *
 * @param {object|null} frame       `readDevicesFrame(...)` output, or the feed's `value`
 * @param {object} [options]
 * @param {string|null} [options.feedStatus]  a `FEED_STATUS` member, when one is known
 * @returns {object} frozen `{id, phase, phaseKnown, awaitingChoice, choices, error,
 *                            errorScope, machine, scale, scanning, feedStatus, quiet,
 *                            actionable}`
 */
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
        /**
         * WHAT THE ERROR IS ABOUT, so a reader does not have to match a string: an
         * `ERROR_SCOPE` member, or null when there is no error. `SCAN` beside a non-null
         * `error` is "a scan will not find anything over that transport, and here is the
         * server's own sentence saying why" — the answer held ready for whoever offers a
         * Search button. Null is a real answer and is not the same as `CONNECTION`.
         */
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

/**
 * The id, and only the id. Split out so the precedence is one readable ladder.
 *
 * IT TAKES THE FRAME AS WELL AS THE STATUS SINCE 28 AUGUST 2026, and that is not an
 * abstraction leak: rung 2 asks whether a machine is connected, and the device list is
 * half of that answer. Reading only `connectionStatus` is what let a `phase: "ready"`
 * frame render as "Could not connect".
 */
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

/**
 * Would these two frames look the same on screen?
 *
 * The item's acceptance test in one function: B8 exists because three different situations
 * rendered as one picture. A suite can now ask that question directly instead of comparing
 * screenshots — and so can a later screen.
 *
 * TWO FRAMES AT THE SAME FEED STATUS is what this compares, because it takes frames and
 * nothing else. Whether a LIVE frame and the same frame held past its source look the same
 * is the other axis, and it is answered by calling `connectionSurface` with each status.
 *
 * IT TAKES WHOLE FRAMES AND ALWAYS DID, which is why the error demotion — which reads the
 * device list as well as `connectionStatus` — needed no change here. Two frames whose
 * `connectionStatus` blocks are identical can now differ legitimately, when one holds a
 * connected machine and the other does not; that is a real difference on screen and this
 * function reports it because it was never given only the status.
 */
export function surfacesDiffer(a, b) {
    return connectionSurface(a).id !== connectionSurface(b).id;
}
