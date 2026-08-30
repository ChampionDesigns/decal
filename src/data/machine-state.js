// Machine state: the generated enum, plus the two classifications the skin makes from it.
//
// The enum itself is GENERATED from ReaPrime's `machine.dart` (see
// scripts/generate-machine-state.js). Nothing in Decal may hand-write a state name;
// every one below is checked against the generated list by test, so a name that stops
// existing upstream turns a test red instead of quietly never matching.
//
// That is not a hypothetical. Three names in the old skin's state handling do not exist
// on the wire:
//   * `'ready'`   — invented in api.js's hand copy, then used as a rule in a live-state
//                   fold (`state !== 'ready'`). Not a MachineState in either direction.
//   * `'ending'`  — in the fold's pouring-substate set. Not a MachineSubstate: the enum
//                   runs idle / preparingForShot / preinfusion / pouring / pouringDone /
//                   cleaning* / error*. A pour has never once matched it.
//   * and the omission that costs the most, `schedIdle` — a real state the copy LACKS,
//     so a scheduled-idle machine classifies as busy.
//
// A name that cannot match is worse than a missing one: it reads like a considered rule.

import {
    MACHINE_STATES,
    MACHINE_STATE,
    MACHINE_SUBSTATES,
    MACHINE_SUBSTATE,
    MACHINE_STATE_SOURCE,
} from './machine-state.generated.js';

export {
    MACHINE_STATES,
    MACHINE_STATE,
    MACHINE_SUBSTATES,
    MACHINE_SUBSTATE,
    MACHINE_STATE_SOURCE,
};

const STATES = new Set(MACHINE_STATES);
const SUBSTATES = new Set(MACHINE_SUBSTATES);

/** Is this a state ReaPrime can actually send or accept? */
export function isMachineState(name) {
    return typeof name === 'string' && STATES.has(name);
}

/** Is this a substate ReaPrime can actually send? */
export function isMachineSubstate(name) {
    return typeof name === 'string' && SUBSTATES.has(name);
}

/**
 * Substates in which espresso is actually POURING, as opposed to preparing.
 *
 * `preparingForShot` is deliberately excluded — preparation is not a pour — and the old
 * set's `'ending'` is deliberately gone: no such substate exists.
 *
 * `pouringDone` IS EXCLUDED TOO, and that is Ben's call of 25 August 2026 on the function
 * audit: "We should copy Slate, shouldn't record pouringDone." Slate's chart filter is
 * `['preinfusion', 'pouring']` and nothing else (`chart.js` `updateChart`), so the trace
 * ends where the pump does.
 *
 * WHAT IT COSTS, STATED RATHER THAN LOST: the drip-down after the pump stops is no longer
 * plotted. It is still WEIGHED — `settledWeight` is taken from every sample and not only
 * the in-shot ones, which is what makes preinfusion + extraction == total — so the yield
 * and the phase table are unchanged. Only the tail of the trace goes.
 */
export const POURING_SUBSTATES = Object.freeze([
    MACHINE_SUBSTATE.PREINFUSION,
    MACHINE_SUBSTATE.POURING,
]);

const POURING = new Set(POURING_SUBSTATES);

/** @returns {boolean} espresso is in the cup, not being prepared. */
export function isPouring(state, substate) {
    return state === MACHINE_STATE.ESPRESSO && POURING.has(substate);
}

/**
 * THE schedIdle FIX.
 *
 * States in which the machine is NOT doing anything that should interrupt the post-shot
 * review window. Everything else ends review early, on the rule that asking the machine to
 * do something means you have finished reading the last shot.
 *
 * The old set was `idle` / `ready` / `heating`. `ready` is not a state, so it contributed
 * nothing; `schedIdle` was missing, so a machine sitting in its scheduled-idle state — the
 * ordinary resting state of a machine on a wake schedule — read as BUSY and cut the review
 * window short. That is one of the 31 live contract bugs, and it is a bug a user meets
 * every morning.
 *
 * `heating` stays: a machine recovering temperature after a shot is not a new request.
 */
export const REVIEW_NEUTRAL_STATES = Object.freeze([
    MACHINE_STATE.IDLE,
    MACHINE_STATE.SCHED_IDLE,
    MACHINE_STATE.HEATING,
]);

const REVIEW_NEUTRAL = new Set(REVIEW_NEUTRAL_STATES);

/**
 * The three answers about the review window. A7 in its plainest form: a MISSING state is
 * not a state, and this layer does not decide from an absence.
 *
 *   'ends'    — the machine is doing something that means you have finished reading.
 *   'neutral' — idle / schedIdle / heating: the review window stands.
 *   'unknown' — NOTHING READABLE ARRIVED. Not a verdict; the caller renders the absence.
 *
 * The distinction that matters is between an absent state and an UNRECOGNISED one. A name
 * the server actually sent is an answer — a machine doing something this build has no name
 * for is still a machine doing something, so it ends review and `isMachineState` reports it
 * as unknown separately. `null`, `undefined`, a NO_READING absence from the address layer,
 * or a non-string is the server saying nothing at all, and deciding "busy" from that
 * dismisses the review window because the feed died. The old fold got this half right
 * (`slate-live-model.js:96`'s leading `state &&`) and this layer had regressed it.
 */
export const REVIEW_VERDICT = Object.freeze({
    ENDS: 'ends',
    NEUTRAL: 'neutral',
    UNKNOWN: 'unknown',
});

/**
 * @param {string|null|undefined|object} state  a state name, or any absence
 * @returns {string} one of REVIEW_VERDICT
 */
export function postShotReviewVerdict(state) {
    if (typeof state !== 'string' || state === '') return REVIEW_VERDICT.UNKNOWN;
    return REVIEW_NEUTRAL.has(state) ? REVIEW_VERDICT.NEUTRAL : REVIEW_VERDICT.ENDS;
}

/**
 * Does this state end the post-shot review window early?
 *
 * An UNRECOGNISED name does (see above). An absence does NOT — `endsPostShotReview` answers
 * only from something the server said, and `postShotReviewVerdict` is the call to make when
 * "we were told nothing" needs rendering as itself.
 *
 * @param {string|null|undefined|object} state
 * @returns {boolean}
 */
export function endsPostShotReview(state) {
    return postShotReviewVerdict(state) === REVIEW_VERDICT.ENDS;
}
