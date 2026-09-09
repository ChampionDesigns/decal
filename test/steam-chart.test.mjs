/**
 * What.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    CHART_MODE, STEAM_HOLD_MS, STEAM_CHANNELS, STEAM_CHANNEL_SPECS,
    STEAM_Y_RANGE, STEAM_Y2_RANGE, STEAM_Y2_CHANNELS, STEAM_MIN_X_RANGE,
    STEAM_MIN_FLOW, STEAM_GUARD_DELAY_MS, STEAM_PUFF_SUBSTATE,
    chartModeFor, initialChartMode, initialSteamGuard, isSteamFlowing, isSteamHoldActive,
    isSteamPouring, steamGuardFor, steamGuardRemainingMs, steamHoldRemainingMs,
    steamRangeMaxForTime,
} from '../src/lib/steam-chart.js';
import { createSteamBuffer, STEAM_SAMPLE_CAP } from '../src/stores/steam-buffer.js';
import { AUTO_STOP, MANUAL_STOP } from './fixtures/steam-sessions.js';

const frame = (state, substate, now) => ({ state, substate, now });

describe('the chart boots on the espresso picture', () => {
    test('and stays there through everything that is not a steam', () => {
        let mode = initialChartMode();
        assert.equal(mode.mode, CHART_MODE.ESPRESSO);
        for (const [state, substate] of [['idle', 'idle'], ['hotWater', 'pouring'],
            ['flush', 'pouring'], ['sleeping', 'idle']]) {
            mode = chartModeFor(mode, frame(state, substate, 1000));
            assert.equal(mode.mode, CHART_MODE.ESPRESSO, `${state}/${substate}`);
        }
    });
});

describe('pressing steam takes the canvas before anything is plotted', () => {
    test('the ramp claims it — the empty axes appear at once', () => {
        /* The old skin's own reasoning: the espresso chart lingering through the ~4 s
         * ramp is what this avoids. `poured` is what tells "waiting to start" from
         * "finished, now settling". */
        const mode = chartModeFor(initialChartMode(), frame('steam', 'preparingForShot', 1000));
        assert.equal(mode.mode, CHART_MODE.STEAM);
        assert.equal(mode.poured, false);
        assert.equal(mode.holdUntil, null, 'a ramp is not a settle window');
        assert.equal(mode.changed, true);
    });

    test('and only the pouring substate is steaming', () => {
        assert.equal(isSteamPouring('pouring'), true);
        for (const other of ['preparingForShot', 'pouringDone', 'idle', null]) {
            assert.equal(isSteamPouring(other), false, String(other));
        }
    });

    test('a ramp that never pours goes straight back — nothing was drawn to settle on', () => {
        let mode = chartModeFor(initialChartMode(), frame('steam', 'preparingForShot', 1000));
        mode = chartModeFor(mode, frame('idle', 'idle', 2000));
        assert.equal(mode.mode, CHART_MODE.ESPRESSO);
        assert.equal(mode.holdUntil, null);
    });
});

describe('the settle window', () => {
    const pour = (at) => chartModeFor(
        chartModeFor(initialChartMode(), frame('steam', 'preparingForShot', at - 1000)),
        frame('steam', 'pouring', at),
    );

    /* The hold starts when the machine LEAVES steam, not when the valve shuts. */
    test('the valve closing keeps the graph, and starts NO hold', () => {
        const poured = pour(1000);
        assert.equal(poured.poured, true);
        assert.equal(poured.holdUntil, null, 'pouring cancels any pending hold');
        const closed = chartModeFor(poured, frame('steam', 'pouringDone', 2000));
        assert.equal(closed.mode, CHART_MODE.STEAM);
        assert.equal(closed.holdUntil, null, 'the machine is still in steam');
        assert.equal(isSteamHoldActive(closed), false);
    });

    test('leaving steam starts the hold, and the graph stays for the window', () => {
        const closed = chartModeFor(pour(1000), frame('idle', 'idle', 2000));
        assert.equal(closed.mode, CHART_MODE.STEAM);
        assert.equal(closed.holdUntil, 2000 + STEAM_HOLD_MS);
        assert.equal(isSteamHoldActive(closed), true);
    });

    /* A puff and a pause both report a non-pouring substate, so a session that puffs to
     * hold its pressure reports minute after minute of steam-and-idle. */
    test('a long puff never expires the graph while the machine is in steam', () => {
        let mode = pour(1000);
        for (let at = 2000; at <= 2000 + STEAM_HOLD_MS * 6; at += STEAM_HOLD_MS / 2) {
            mode = chartModeFor(mode, frame('steam', 'idle', at));
            assert.equal(mode.mode, CHART_MODE.STEAM, `still steam at ${at}`);
            assert.equal(mode.holdUntil, null, `no hold armed at ${at}`);
        }
        assert.equal(mode.poured, true, 'and it still knows the session poured');
    });

    test('the automatic purge holds the canvas, and the hold starts after it', () => {
        let mode = chartModeFor(pour(1000), frame('steam', 'idle', 2000));
        mode = chartModeFor(mode, frame('airPurge', 'idle', 3000));
        assert.equal(mode.mode, CHART_MODE.STEAM, 'the purge is part of the session');
        assert.equal(mode.holdUntil, null);

        mode = chartModeFor(mode, frame('idle', 'idle', 4000));
        assert.equal(mode.holdUntil, 4000 + STEAM_HOLD_MS, 'the window opens after it');
    });

    test('a purge that follows anything else does NOT claim the canvas', () => {
        const idle = chartModeFor(initialChartMode(), frame('idle', 'idle', 1000));
        const purge = chartModeFor(idle, frame('airPurge', 'idle', 2000));
        assert.equal(purge.mode, CHART_MODE.ESPRESSO);
    });

    test('it expires on the clock, not on a countdown', () => {
        const closed = chartModeFor(pour(1000), frame('idle', 'idle', 2000));
        assert.equal(steamHoldRemainingMs(closed, 2000), STEAM_HOLD_MS);
        assert.equal(steamHoldRemainingMs(closed, 2000 + STEAM_HOLD_MS / 2), STEAM_HOLD_MS / 2);
        const after = chartModeFor(closed, frame('idle', 'idle', 2000 + STEAM_HOLD_MS));
        assert.equal(after.mode, CHART_MODE.ESPRESSO);
        assert.equal(steamHoldRemainingMs(after, 99999), null);
    });

    test('a NEW SHOT wins the canvas immediately, even mid-hold', () => {
        /* The one asymmetry in the precedence, and the reason for it: a shot must never
         * hide behind the previous steam session. */
        const closed = chartModeFor(pour(1000), frame('idle', 'idle', 2000));
        assert.equal(isSteamHoldActive(closed), true);
        const shot = chartModeFor(closed, frame('espresso', 'preinfusion', 2100));
        assert.equal(shot.mode, CHART_MODE.ESPRESSO);
        assert.equal(shot.holdUntil, null);
        assert.equal(shot.poured, false);
    });

    test('and a second steam mid-hold cancels it rather than stacking', () => {
        const closed = chartModeFor(pour(1000), frame('idle', 'idle', 2000));
        assert.equal(isSteamHoldActive(closed), true);
        const again = chartModeFor(closed, frame('steam', 'pouring', 3000));
        assert.equal(again.holdUntil, null);
        assert.equal(again.poured, true);
    });
});

describe('the two axes are fixed, and the channels know which they are on', () => {
    test('the ranges are the old skin\'s, and their labels share a gridline', () => {
        assert.deepEqual([...STEAM_Y_RANGE], [0, 6.5]);
        assert.deepEqual([...STEAM_Y2_RANGE], [0, 195]);
        /* 6/6.5 === 180/195 is what makes one primary unit exactly 30 °C, so every
         * gridline coincides and one grid reads correctly for both axes. */
        assert.equal(6 / STEAM_Y_RANGE[1], 180 / STEAM_Y2_RANGE[1]);
    });

    test('five channels, actual above its target', () => {
        assert.deepEqual([...STEAM_CHANNELS],
            ['targetFlow', 'pressure', 'flow', 'steamTemperature', 'milkTemperature']);
    });

    test('and the two temperatures carry the RIGHT scale', () => {
        const byKey = Object.fromEntries(STEAM_CHANNEL_SPECS.map((spec) => [spec.key, spec]));
        for (const key of STEAM_Y2_CHANNELS) assert.equal(byKey[key].scale, 'y2', key);
        for (const key of ['pressure', 'flow', 'targetFlow']) {
            assert.equal(byKey[key].scale, undefined, `${key} stays on the left`);
        }
        assert.equal(byKey.targetFlow.dash, true, 'a commanded value is dotted beside its actual');
    });

    test('the x axis glides with the data past a short floor', () => {
        assert.equal(steamRangeMaxForTime(0), STEAM_MIN_X_RANGE);
        assert.equal(steamRangeMaxForTime(2), STEAM_MIN_X_RANGE);
        assert.equal(steamRangeMaxForTime(11), 11, 'an 11 s session ends at 11 s');
        assert.equal(steamRangeMaxForTime(NaN), STEAM_MIN_X_RANGE);
    });
});

describe('the session buffer', () => {
    const machine = (i) => ({ ok: true, pressure: 1 + i * 0.1, flow: 0.5 + i * 0.05,
        targetFlow: 1.2, steamTemperature: 140 + i });

    test('t = 0 is the FIRST POURING sample, and the ramp is dropped', () => {
        const buffer = createSteamBuffer({});
        buffer.take({ mode: CHART_MODE.STEAM, pouring: false, machine: machine(0), at: 1000 });
        buffer.take({ mode: CHART_MODE.STEAM, pouring: false, machine: machine(1), at: 1500 });
        assert.equal(buffer.get().counts.samples, 0, 'nothing is plotted before the valve opens');
        buffer.take({ mode: CHART_MODE.STEAM, pouring: true, machine: machine(2), at: 2000 });
        buffer.take({ mode: CHART_MODE.STEAM, pouring: true, machine: machine(3), at: 2500 });
        const state = buffer.get();
        assert.equal(state.ok, true);
        assert.deepEqual([...state.axis.t], [0, 0.5]);
        assert.equal(state.axis.originMs, 2000);
    });

    test('every channel is on the shared axis, and an absence is a null in place', () => {
        const buffer = createSteamBuffer({});
        buffer.take({ mode: CHART_MODE.STEAM, pouring: true, machine: machine(0), at: 1000, milk: null });
        buffer.take({ mode: CHART_MODE.STEAM, pouring: true, machine: machine(1), at: 1125, milk: 21 });
        const series = buffer.get().series;
        for (const key of STEAM_CHANNELS) {
            assert.equal(series[key].x.length, 2, `${key} shares the axis`);
            assert.equal(series[key].y.length, 2);
        }
        /* A GAP DRAWS AS A GAP. A channel that skipped its null would shift the line
         * left by one sample every time the probe missed a frame. */
        assert.deepEqual([...series.milkTemperature.y], [null, 21]);
    });

    /* The claim is unchanged and the moment has moved: a new session must not append to
     * the finished one, but it is the START of the new session that discards the old. */
    test('a new session starts from zero rather than appending to the finished one', () => {
        const buffer = createSteamBuffer({});
        buffer.take({ mode: CHART_MODE.STEAM, pouring: true, machine: machine(0), at: 1000 });
        assert.equal(buffer.get().counts.samples, 1);

        buffer.take({ mode: CHART_MODE.ESPRESSO, pouring: false, machine: machine(1), at: 60000 });
        buffer.take({ mode: CHART_MODE.STEAM, pouring: false, machine: machine(1), at: 61000 });
        buffer.take({ mode: CHART_MODE.STEAM, pouring: true, machine: machine(2), at: 62000 });
        assert.equal(buffer.get().counts.samples, 1, 'the new session holds only its own sample');
    });

    /* The machine reports puffing and paused steam as `idle`, so a stop arrives as a
     * not-pouring frame while the mode is still steam. */
    test('shutting the valve KEEPS the session, which is what the settle window shows', () => {
        const buffer = createSteamBuffer({});
        buffer.take({ mode: CHART_MODE.STEAM, pouring: true, machine: machine(0), at: 1000 });
        buffer.take({ mode: CHART_MODE.STEAM, pouring: true, machine: machine(1), at: 1100 });
        assert.equal(buffer.get().counts.samples, 2);

        buffer.take({ mode: CHART_MODE.STEAM, pouring: false, machine: machine(2), at: 1200 });
        assert.equal(buffer.get().counts.samples, 2, 'the stop draws nothing away');
    });

    test('pausing and resuming inside a steam session keeps one graph', () => {
        const buffer = createSteamBuffer({});
        buffer.take({ mode: CHART_MODE.STEAM, pouring: true, machine: machine(0), at: 1000 });
        buffer.take({ mode: CHART_MODE.STEAM, pouring: false, machine: machine(1), at: 1100 });
        buffer.take({ mode: CHART_MODE.STEAM, pouring: true, machine: machine(2), at: 1200 });
        assert.equal(buffer.get().counts.samples, 2);
    });

    test('leaving steam KEEPS the samples — the hold exists to show them', () => {
        const buffer = createSteamBuffer({});
        buffer.take({ mode: CHART_MODE.STEAM, pouring: true, machine: machine(0), at: 1000 });
        buffer.take({ mode: CHART_MODE.ESPRESSO, pouring: false, machine: machine(1), at: 2000 });
        assert.equal(buffer.get().counts.samples, 1);
    });

    test('a frame with no reading is not a sample', () => {
        const buffer = createSteamBuffer({});
        buffer.take({ mode: CHART_MODE.STEAM, pouring: true, machine: null, at: 1000 });
        buffer.take({ mode: CHART_MODE.STEAM, pouring: true, machine: { ok: false }, at: 1100 });
        assert.equal(buffer.get().counts.samples, 0);
        assert.equal(buffer.get().ok, false);
    });

    test('and the session is capped rather than growing without bound', () => {
        const buffer = createSteamBuffer({});
        for (let i = 0; i < STEAM_SAMPLE_CAP + 5; i += 1) {
            buffer.take({ mode: CHART_MODE.STEAM, pouring: true, machine: machine(0), at: 1000 + i });
        }
        assert.equal(buffer.get().counts.samples, STEAM_SAMPLE_CAP);
        assert.ok(buffer.get().counts.dropped >= 1, 'the state says samples were dropped');
    });

    test('clear throws the session away', () => {
        const buffer = createSteamBuffer({});
        buffer.take({ mode: CHART_MODE.STEAM, pouring: true, machine: machine(0), at: 1000 });
        buffer.clear();
        assert.equal(buffer.get().counts.samples, 0);
        assert.equal(buffer.get().ok, false);
    });
});

/* THE TWO RECORDED SESSIONS, replayed frame by frame through the same fold and the same
 * buffer the screen uses. Every figure below is read from the recording, never chosen. */
function replay(frames) {
    const buffer = createSteamBuffer({});
    let mode = initialChartMode();
    let guard = initialSteamGuard();
    let guardShownAt = null;
    let puffFrom = null;
    for (const [ms, substate, flow] of frames) {
        mode = chartModeFor(mode, frame('steam', substate, ms));
        guard = steamGuardFor(guard, { state: 'steam', substate, now: ms });
        if (substate === STEAM_PUFF_SUBSTATE && puffFrom === null) puffFrom = ms;
        if (guard.shown && guardShownAt === null) guardShownAt = ms;
        buffer.take({
            mode: mode.mode,
            pouring: substate === 'pouring',
            machine: { ok: true, flow, pressure: 1, targetFlow: 1.2, steamTemperature: 150 },
            at: ms,
        });
    }
    return { buffer, mode, guard, guardShownAt, puffFrom };
}

/** The last moment in the recording that carries real steam flow, in seconds. */
function lastFlowingSecond(frames) {
    const flowing = frames.filter(([, substate, flow]) => substate === 'pouring' && flow >= STEAM_MIN_FLOW);
    return flowing[flowing.length - 1][0] / 1000;
}

describe('the flow rule, against the two recorded sessions', () => {
    test('the threshold is the flow the wand stops making steam below', () => {
        assert.equal(STEAM_MIN_FLOW, 0.2);
        assert.equal(isSteamFlowing(0.2), true);
        assert.equal(isSteamFlowing(0.19), false);
        for (const other of [null, undefined, NaN, 'x']) {
            assert.equal(isSteamFlowing(other), false, String(other));
        }
    });

    test('the machine ends a session about six seconds after the steam stops', () => {
        const pour = AUTO_STOP.filter(([, substate]) => substate === 'pouring');
        const span = (pour[pour.length - 1][0] - pour[0][0]) / 1000;
        const tail = pour[pour.length - 1][0] / 1000 - lastFlowingSecond(AUTO_STOP);
        assert.ok(Math.abs(span - 21.9) < 0.1, `pour span ${span}`);
        assert.ok(Math.abs(tail - 6.5) < 0.1, `dead tail ${tail}`);
    });

    test('and it ends a HAND-STOPPED session with no tail at all', () => {
        const pour = MANUAL_STOP.filter(([, substate]) => substate === 'pouring');
        const tail = pour[pour.length - 1][0] / 1000 - lastFlowingSecond(MANUAL_STOP);
        assert.equal(tail, 0, 'the hand stop is the measurement that says the tail is the machine');
    });

    test('the graph of the automatic session stops where the steam stopped', () => {
        const { buffer } = replay(AUTO_STOP);
        const t = buffer.get().axis.t;
        const origin = AUTO_STOP.find(([, substate]) => substate === 'pouring')[0];
        const last = t[t.length - 1] + origin / 1000;
        assert.ok(Math.abs(last - lastFlowingSecond(AUTO_STOP)) < 0.05,
            `the graph ends at ${last}, the steam at ${lastFlowingSecond(AUTO_STOP)}`);
        /* 329 pour frames arrive and 231 are drawn: the 98 the machine sent after the
         * steam stopped are the six seconds the graph used to hold at zero. */
        const pour = AUTO_STOP.filter(([, substate]) => substate === 'pouring').length;
        assert.equal(pour, 329);
        assert.equal(buffer.get().counts.samples, 231);
    });

    test('the hand-stopped session loses NOTHING — the rule costs a good graph nothing', () => {
        const { buffer } = replay(MANUAL_STOP);
        const drawn = MANUAL_STOP.filter(([, substate]) => substate === 'pouring').length;
        assert.equal(buffer.get().counts.samples, drawn);
    });

    test('a dip inside a session keeps its shape — the wait is flushed, not dropped', () => {
        const buffer = createSteamBuffer({});
        const at = (i, flow) => buffer.take({
            mode: CHART_MODE.STEAM, pouring: true, at: 1000 + i * 100,
            machine: { ok: true, flow, pressure: 1, targetFlow: 1.2, steamTemperature: 150 },
        });
        at(0, 3.9); at(1, 0.0); at(2, 0.1); at(3, 3.8);
        assert.deepEqual([...buffer.get().axis.t], [0, 0.1, 0.2, 0.3], 'the dip is drawn');
        assert.deepEqual([...buffer.get().series.flow.y], [3.9, 0, 0.1, 3.8]);
        at(4, 0.0); at(5, 0.0);
        assert.equal(buffer.get().counts.samples, 4, 'the tail after the last flow is not drawn');
    });
});

describe('the puff guard', () => {
    const puff = (now) => ({ state: 'steam', substate: STEAM_PUFF_SUBSTATE, now });

    test('nothing is armed until the machine enters the puff', () => {
        const guard = initialSteamGuard();
        assert.equal(guard.armedAt, null);
        assert.equal(guard.shown, false);
        assert.equal(steamGuardRemainingMs(guard, 1000), null);
    });

    test('it arms on the puff and appears ten seconds later, not before', () => {
        let guard = steamGuardFor(initialSteamGuard(), puff(1000));
        assert.equal(guard.armedAt, 1000);
        assert.equal(guard.shown, false, 'the user gets the delay to stop it themselves');
        assert.equal(steamGuardRemainingMs(guard, 1000), STEAM_GUARD_DELAY_MS);

        guard = steamGuardFor(guard, puff(1000 + STEAM_GUARD_DELAY_MS - 1));
        assert.equal(guard.shown, false);

        guard = steamGuardFor(guard, puff(1000 + STEAM_GUARD_DELAY_MS));
        assert.equal(guard.shown, true);
        assert.equal(guard.armedAt, 1000, 'the arming moment does not move under it');
        assert.equal(steamGuardRemainingMs(guard, 1000 + STEAM_GUARD_DELAY_MS), null);
    });

    test('leaving the puff clears it, which is the ONLY way it clears', () => {
        let guard = steamGuardFor(initialSteamGuard(), puff(1000));
        guard = steamGuardFor(guard, puff(1000 + STEAM_GUARD_DELAY_MS));
        assert.equal(guard.shown, true);
        for (const [state, substate] of [['steam', 'pouringDone'], ['busy', 'idle'], ['idle', 'idle']]) {
            const cleared = steamGuardFor(guard, { state, substate, now: 99000 });
            assert.equal(cleared.shown, false, `${state}/${substate}`);
            assert.equal(cleared.armedAt, null);
        }
    });

    test('a puff reached from outside the steam state does not arm it', () => {
        const guard = steamGuardFor(initialSteamGuard(),
            { state: 'idle', substate: STEAM_PUFF_SUBSTATE, now: 1000 });
        assert.equal(guard.armedAt, null);
    });

    test('the recorded automatic session shows it, ten seconds into its puff', () => {
        const { guard, guardShownAt, puffFrom } = replay(AUTO_STOP);
        assert.ok(puffFrom !== null, 'the recording has a puff');
        assert.ok(guardShownAt !== null, 'the guard appeared');
        const delay = (guardShownAt - puffFrom) / 1000;
        assert.ok(delay >= 10 && delay < 10.2, `the guard appeared ${delay} s into the puff`);
        assert.equal(guard.shown, false, 'and it is gone by the end, because the puff ended');
    });

    test('the recorded hand-stopped session never shows it — there was no puff', () => {
        const { guardShownAt, puffFrom } = replay(MANUAL_STOP);
        assert.equal(puffFrom, null);
        assert.equal(guardShownAt, null);
    });
});
