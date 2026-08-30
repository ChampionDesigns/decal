// The generated enum and the two classifications made from it.
//
// The bugs on trial here are both live in the old skin and both among the 31 contract
// bugs: an invented state (`ready`) that reads like a rule, and a missing one
// (`schedIdle`) that cuts the post-shot review window short every morning.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    MACHINE_STATES,
    MACHINE_STATE,
    MACHINE_SUBSTATES,
    MACHINE_SUBSTATE,
    MACHINE_STATE_SOURCE,
    isMachineState,
    isMachineSubstate,
    POURING_SUBSTATES,
    isPouring,
    REVIEW_NEUTRAL_STATES,
    endsPostShotReview,
    postShotReviewVerdict,
    REVIEW_VERDICT,
} from '../src/data/machine-state.js';
import { readMachineSnapshot } from '../src/data/rea-address.js';

const PINNED_COMMIT = '2b047d02e42e29bf2d96a2aa964ef94e4a4daba3';

describe('the enum comes from ReaPrime', () => {
    test('the artifact stamps the pinned commit and the file it was generated from', () => {
        assert.equal(MACHINE_STATE_SOURCE.commit, PINNED_COMMIT);
        assert.equal(MACHINE_STATE_SOURCE.file, 'lib/src/models/device/machine.dart');
        assert.match(MACHINE_STATE_SOURCE.sha256, /^[0-9a-f]{64}$/);
    });

    test('every member is unique and the symbolic map matches the list', () => {
        for (const [name, members] of [['MachineState', MACHINE_STATES], ['MachineSubstate', MACHINE_SUBSTATES]]) {
            assert.equal(new Set(members).size, members.length, `${name} has a duplicate`);
        }
        assert.deepEqual(Object.values(MACHINE_STATE).sort(), [...MACHINE_STATES].sort());
        assert.deepEqual(Object.values(MACHINE_SUBSTATE).sort(), [...MACHINE_SUBSTATES].sort());
        assert.equal(Object.isFrozen(MACHINE_STATES), true);
        assert.equal(Object.isFrozen(MACHINE_STATE), true);
    });

    test('the states the skin reasons about all exist on the wire', () => {
        for (const name of ['idle', 'schedIdle', 'heating', 'espresso', 'steam', 'sleeping', 'busy']) {
            assert.equal(isMachineState(name), true, `${name} must be a real state`);
        }
        for (const name of ['idle', 'preparingForShot', 'preinfusion', 'pouring', 'pouringDone']) {
            assert.equal(isMachineSubstate(name), true, `${name} must be a real substate`);
        }
    });
});

describe('the names the hand copy invented', () => {
    test("'ready' is not a state in either direction", () => {
        // api.js: `READY: 'ready'` with the comment "Not in the official API doc, but used
        // in app.js for shot completion logic". It never arrives on a frame and cannot be
        // requested. Anything comparing against it is dead weight dressed as a rule.
        assert.equal(isMachineState('ready'), false);
        assert.equal(MACHINE_STATES.includes('ready'), false);
        assert.equal(Object.hasOwn(MACHINE_STATE, 'READY'), false);
    });

    test("'ending' is not a substate, so the old pouring set could never match it", () => {
        assert.equal(isMachineSubstate('ending'), false);
        assert.equal(POURING_SUBSTATES.includes('ending'), false);
    });

    test('every name in the classifications is a generated one', () => {
        for (const name of REVIEW_NEUTRAL_STATES) assert.equal(isMachineState(name), true, name);
        for (const name of POURING_SUBSTATES) assert.equal(isMachineSubstate(name), true, name);
    });
});

describe('the schedIdle busy-classification fix', () => {
    test('a scheduled-idle machine does NOT end the post-shot review window', () => {
        // THE FIX. The old test was `state !== 'idle' && state !== 'ready' && state !==
        // 'heating'`, so schedIdle — the ordinary resting state of a machine on a wake
        // schedule — classified as busy and review ended on the frame after the pour.
        assert.equal(endsPostShotReview(MACHINE_STATE.SCHED_IDLE), false);
        assert.equal(endsPostShotReview('schedIdle'), false);
    });

    test('idle and heating stay neutral, as before', () => {
        assert.equal(endsPostShotReview('idle'), false);
        assert.equal(endsPostShotReview('heating'), false);
    });

    test('asking the machine for something else does end review', () => {
        for (const name of ['steam', 'hotWater', 'flush', 'espresso', 'cleaning', 'sleeping', 'busy', 'error']) {
            assert.equal(endsPostShotReview(name), true, `${name} should interrupt review`);
        }
    });

    test('an UNRECOGNISED state is treated as busy, never as neutral', () => {
        // A7 in miniature: this layer does not invent a state to stand in for one it does
        // not recognise, and it does not default to the harmless-looking answer. A name the
        // server SENT is an answer — a machine doing something this build has no word for
        // is still a machine doing something.
        assert.equal(endsPostShotReview('ready'), true, "the invented name buys nothing now");
        assert.equal(endsPostShotReview('somethingNewUpstream'), true);
        assert.equal(isMachineState('somethingNewUpstream'), false, 'and it is separately visible as unknown');
    });

    test('a MISSING state decides nothing — it does not dismiss the review window', () => {
        // The regression this replaces: `!REVIEW_NEUTRAL.has(state)` answered `true` for an
        // absence, so a dead machine feed ended the post-shot review the user was reading.
        // The old fold got this half right (`slate-live-model.js`'s leading `state &&`).
        for (const nothing of [undefined, null, '', 42, {}]) {
            assert.equal(postShotReviewVerdict(nothing), REVIEW_VERDICT.UNKNOWN, String(nothing));
            assert.equal(endsPostShotReview(nothing), false, String(nothing));
        }
    });

    test('the address layer\'s own absence is an absence here too', () => {
        // readMachineSnapshot(null).state is a NO_READING sentinel — an object, not a name.
        // It reached this predicate and was classified busy.
        const absent = readMachineSnapshot(null).state;
        assert.equal(postShotReviewVerdict(absent), REVIEW_VERDICT.UNKNOWN);
        assert.equal(endsPostShotReview(absent), false);
    });

    test('the three verdicts are distinguishable, which is the point', () => {
        assert.equal(postShotReviewVerdict('schedIdle'), REVIEW_VERDICT.NEUTRAL);
        assert.equal(postShotReviewVerdict('steam'), REVIEW_VERDICT.ENDS);
        assert.equal(postShotReviewVerdict(undefined), REVIEW_VERDICT.UNKNOWN);
    });
});

describe('pouring', () => {
    test('espresso pours only in the pouring substates', () => {
        assert.equal(isPouring('espresso', 'preinfusion'), true);
        assert.equal(isPouring('espresso', 'pouring'), true);
        /* Ben, 25 Aug 2026: "We should copy Slate, shouldn't record pouringDone." The
         * trace ends where the pump does; the settled weight is still read from every
         * sample, so the phase table and the yield are unchanged. */
        assert.equal(isPouring('espresso', 'pouringDone'), false);
    });

    test('preparation is not a pour, and neither is another state in a pouring substate', () => {
        assert.equal(isPouring('espresso', 'preparingForShot'), false);
        assert.equal(isPouring('espresso', 'idle'), false);
        assert.equal(isPouring('hotWater', 'pouring'), false);
        assert.equal(isPouring('espresso', 'ending'), false);
    });
});
