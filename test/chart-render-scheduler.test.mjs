import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createSingleFlightFrameScheduler } from '../src/lib/chart-render-scheduler.js';

function deferred() {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
}

async function settle() {
    await Promise.resolve();
    await Promise.resolve();
}

test('chart scheduler coalesces requests before one animation frame', async () => {
    const frames = [];
    let draws = 0;
    const scheduler = createSingleFlightFrameScheduler(() => { draws += 1; }, {
        requestFrame: callback => { frames.push(callback); return frames.length; },
        cancelFrame() {},
    });

    scheduler.request();
    scheduler.request();
    scheduler.request();
    assert.equal(frames.length, 1);
    frames.shift()();
    await settle();
    assert.equal(draws, 1);
    assert.deepEqual(scheduler.state(), { framePending: false, inFlight: false, dirty: false });
});

test('chart scheduler never overlaps draw work and performs one trailing draw', async () => {
    const frames = [];
    const first = deferred();
    const second = deferred();
    let draws = 0;
    const scheduler = createSingleFlightFrameScheduler(() => {
        draws += 1;
        return draws === 1 ? first.promise : second.promise;
    }, {
        requestFrame: callback => { frames.push(callback); return frames.length; },
        cancelFrame() {},
    });

    scheduler.request();
    frames.shift()();
    assert.equal(draws, 1);
    assert.equal(scheduler.state().inFlight, true);

    scheduler.request();
    scheduler.request();
    scheduler.request();
    assert.equal(frames.length, 0, 'no overlapping draw is queued');

    first.resolve();
    await settle();
    assert.equal(frames.length, 1, 'one trailing frame paints the newest arrays');
    frames.shift()();
    assert.equal(draws, 2);
    second.resolve();
    await settle();
    assert.deepEqual(scheduler.state(), { framePending: false, inFlight: false, dirty: false });
});

test('chart scheduler can cancel a not-yet-started frame at shot reset', () => {
    const frames = new Map();
    let nextHandle = 1;
    const scheduler = createSingleFlightFrameScheduler(() => assert.fail('cancelled draw ran'), {
        requestFrame: callback => { const id = nextHandle++; frames.set(id, callback); return id; },
        cancelFrame: handle => frames.delete(handle),
    });

    scheduler.request();
    assert.equal(frames.size, 1);
    scheduler.cancelPending();
    assert.equal(frames.size, 0);
    assert.deepEqual(scheduler.state(), { framePending: false, inFlight: false, dirty: false });
});
