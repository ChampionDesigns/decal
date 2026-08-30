/**
 * Machine state: the generated enum, plus the two classifications the skin makes from it.
 */

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

export const POURING_SUBSTATES = Object.freeze([
    MACHINE_SUBSTATE.PREINFUSION,
    MACHINE_SUBSTATE.POURING,
]);

const POURING = new Set(POURING_SUBSTATES);

/** @returns {boolean} espresso is in the cup, not being prepared. */
export function isPouring(state, substate) {
    return state === MACHINE_STATE.ESPRESSO && POURING.has(substate);
}

export const REVIEW_NEUTRAL_STATES = Object.freeze([
    MACHINE_STATE.IDLE,
    MACHINE_STATE.SCHED_IDLE,
    MACHINE_STATE.HEATING,
]);

const REVIEW_NEUTRAL = new Set(REVIEW_NEUTRAL_STATES);

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

export function endsPostShotReview(state) {
    return postShotReviewVerdict(state) === REVIEW_VERDICT.ENDS;
}
