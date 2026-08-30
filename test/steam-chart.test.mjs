/**
 * What.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    CHART_MODE, STEAM_HOLD_MS, STEAM_CHANNELS, STEAM_CHANNEL_SPECS,
    STEAM_Y_RANGE, STEAM_Y2_RANGE, STEAM_Y2_CHANNELS, STEAM_MIN_X_RANGE,
    chartModeFor, initialChartMode, isSteamHoldActive, isSteamPouring,
    steamHoldRemainingMs, steamRangeMaxForTime,
} from '../src/lib/steam-chart.js';
import { createSteamBuffer, STEAM_SAMPLE_CAP } from '../src/stores/steam-buffer.js';

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

    test('the valve closing starts a hold, and the graph stays', () => {
        const poured = pour(1000);
        assert.equal(poured.poured, true);
        assert.equal(poured.holdUntil, null, 'pouring cancels any pending hold');
        const closed = chartModeFor(poured, frame('steam', 'pouringDone', 2000));
        assert.equal(closed.mode, CHART_MODE.STEAM);
        assert.equal(closed.holdUntil, 2000 + STEAM_HOLD_MS);
        assert.equal(isSteamHoldActive(closed), true);
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
        const closed = chartModeFor(pour(1000), frame('steam', 'pouringDone', 2000));
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

    test('a new ramp clears the finished session rather than appending to it', () => {
        const buffer = createSteamBuffer({});
        buffer.take({ mode: CHART_MODE.STEAM, pouring: true, machine: machine(0), at: 1000 });
        assert.equal(buffer.get().counts.samples, 1);
        buffer.take({ mode: CHART_MODE.STEAM, pouring: false, machine: machine(1), at: 60000 });
        assert.equal(buffer.get().counts.samples, 0, 'the next session starts from zero');
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
