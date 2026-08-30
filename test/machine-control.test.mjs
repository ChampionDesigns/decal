/**
 * RUNNING THE MACHINE, and the gesture that opens a second action on a bank.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    MACHINE_KEYS, STOP_STATE, DEFAULT_KEY_BINDINGS, machineKeyGate, stateForKey,
} from '../src/lib/live-targets.js';
import { MACHINE_STATE } from '../src/data/machine-state.js';
import { gestureOf, HOLD_MS, HOLD_SLOP } from '../src/lib/press-hold.js';

describe('the machine keys are Slate\'s four, by the generated enum\'s names', () => {
    test('four keys, in Slate\'s own column order', () => {
        assert.deepEqual(MACHINE_KEYS.map((key) => key.id),
            ['espresso', 'hot-water', 'steam', 'flush'],
            'Slate\'s #ghc-controls is Coffee / Water / Steam / Flush, then Stop');
        assert.deepEqual(MACHINE_KEYS.map((key) => key.state), [
            MACHINE_STATE.ESPRESSO, MACHINE_STATE.HOT_WATER,
            MACHINE_STATE.STEAM, MACHINE_STATE.FLUSH,
        ]);
    });

    test('every state name is the generated enum\'s, never a literal', () => {
        const known = new Set(Object.values(MACHINE_STATE));
        for (const key of MACHINE_KEYS) assert.ok(known.has(key.state), `${key.state} is not in the enum`);
        assert.ok(known.has(STOP_STATE));
        for (const state of Object.values(DEFAULT_KEY_BINDINGS)) assert.ok(known.has(state));
    });

    test('the abort names IDLE, and the space bar names the same state', () => {
        assert.equal(STOP_STATE, MACHINE_STATE.IDLE);
        assert.equal(stateForKey(' '), STOP_STATE,
            'the rail\'s STOP and the space bar must not name two different states');
    });

    test('Slate\'s six bindings, and SLEEP is a key with no button', () => {
        assert.deepEqual(DEFAULT_KEY_BINDINGS, {
            e: MACHINE_STATE.ESPRESSO,
            w: MACHINE_STATE.HOT_WATER,
            s: MACHINE_STATE.STEAM,
            f: MACHINE_STATE.FLUSH,
            ' ': MACHINE_STATE.IDLE,
            p: MACHINE_STATE.SLEEPING,
        });
        assert.ok(!MACHINE_KEYS.some((key) => key.state === MACHINE_STATE.SLEEPING),
            'Ben removed the Sleep button from this band on 23 Aug 2026; the KEY stays');
    });

    test('a key lookup is case-insensitive, and an unbound key is null', () => {
        assert.equal(stateForKey('E'), MACHINE_STATE.ESPRESSO, 'caps lock still stops the machine');
        assert.equal(stateForKey('z'), null);
        assert.equal(stateForKey(''), null);
        assert.equal(stateForKey(undefined), null);
    });
});

describe('one half of the strip at a time, and it is Slate\'s rule', () => {
    test('at rest the four act and the abort is absent', () => {
        const gate = machineKeyGate(MACHINE_STATE.IDLE);
        assert.deepEqual({ ...gate }, { actions: true, stop: false });
    });

    test('while the machine runs the four refuse and the abort is live', () => {
        for (const state of [MACHINE_STATE.ESPRESSO, MACHINE_STATE.STEAM,
            MACHINE_STATE.HOT_WATER, MACHINE_STATE.FLUSH]) {
            const gate = machineKeyGate(state);
            assert.deepEqual({ ...gate }, { actions: false, stop: true }, `at ${state}`);
        }
    });

    test('a state nobody is running is at rest — sleeping, heating, unknown', () => {
        for (const state of [MACHINE_STATE.SLEEPING, '', null, 'somethingNew']) {
            assert.equal(machineKeyGate(state).actions, true, `at ${String(state)}`);
        }
    });
});

describe('press and hold, as a decision over two timestamps', () => {
    test('long enough and still is a hold', () => {
        assert.equal(gestureOf({ at: 0, x: 10, y: 10 }, { at: HOLD_MS, x: 10, y: 10 }), 'hold');
    });

    test('one millisecond short is a tap', () => {
        assert.equal(gestureOf({ at: 0, x: 10, y: 10 }, { at: HOLD_MS - 1, x: 10, y: 10 }), 'tap');
    });

    test('a drag is neither, which is the rule Slate does not have', () => {
        assert.equal(gestureOf({ at: 0, x: 0, y: 0 }, { at: HOLD_MS + 50, x: HOLD_SLOP + 1, y: 0 }),
            'cancel');
        assert.equal(gestureOf({ at: 0, x: 0, y: 0 }, { at: 10, x: 0, y: HOLD_SLOP + 1 }), 'cancel');
    });

    test('inside the slop is still a press', () => {
        assert.equal(gestureOf({ at: 0, x: 0, y: 0 }, { at: HOLD_MS, x: HOLD_SLOP - 1, y: 0 }), 'hold');
    });

    test('a sequence that never started is a cancel, not a tap', () => {
        assert.equal(gestureOf(null, { at: 1, x: 0, y: 0 }), 'cancel');
        assert.equal(gestureOf({ at: 0, x: 0, y: 0 }, null), 'cancel');
    });
});
