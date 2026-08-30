/**
 * chart-feed.test.mjs — the shot buffer's road to the chart card, without a browser.
 *
 * `ChartFeed` (src/lib/chart-feed.js) is the whole of what the Live screen owns in
 * order to put a live shot on `<ui-chart-card>`: watch a buffer, run gate 6's
 * derivation over it at most once per frame, hand the bundle over. Three of the
 * fourteen chart defects are decided here rather than in a browser, so they are
 * asserted here:
 *
 *   chart-C9   coalescing. Twenty publishes inside one frame are ONE derivation, and a
 *              run whose buffer revision has not moved does nothing at all.
 *   chart-C13  fed from the model. The file is scanned for every route back into the
 *              DOM — the defect is `chart.js` scraping five element ids with a regex,
 *              and the cure is a module with no way to do it.
 *   B4         the axis is ReaPrime's arrival stamps and nothing on this road touches
 *              it: t is stamp minus origin, the intervals stay jittery, and no
 *              unplaceable sample is given a made-up time.
 *
 * The samples are the real recorded shot (426 measurements, 336 in-shot), pushed
 * through `createShotBuffer` the way `attachShotBuffer` pushes a live one.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ChartFeed } from '../src/lib/chart-feed.js';
import { createShotBuffer } from '../src/stores/shot-buffer.js';
import { logger as sharedLogger } from '../src/lib/logger.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT = JSON.parse(readFileSync(join(REPO,
    'tools/rea-fixtures/api__v1__shots__cd020a51-f353-4ffb-8389-72c931640181.json'), 'utf8'));

/** A Lit-shaped host, counting the updates a controller asks for. */
function fakeHost() {
    const host = {
        controllers: [],
        updates: 0,
        addController(controller) { host.controllers.push(controller); },
        requestUpdate() { host.updates += 1; },
    };
    return host;
}

/** A frame queue under the test's control — no rAF, no timers, no waiting. */
function frames() {
    const queued = new Map();
    let next = 1;
    return {
        requestFrame(callback) { queued.set(next, callback); return next++; },
        cancelFrame(handle) { queued.delete(handle); },
        /** Run every frame currently queued. Returns how many ran. */
        run() {
            const now = [...queued.entries()];
            queued.clear();
            for (const [, callback] of now) callback();
            return now.length;
        },
        get size() { return queued.size; },
    };
}

/** A buffer with `count` of the recorded samples in it, opened as the shot they are. */
function bufferWith(count = SHOT.measurements.length) {
    const buffer = createShotBuffer({});
    buffer.open(SHOT.id, {});
    for (let i = 0; i < count; i += 1) buffer.addSample(SHOT.measurements[i]);
    return buffer;
}

const feedOn = (host, clock, options = {}) => new ChartFeed(host, {
    requestFrame: clock.requestFrame,
    cancelFrame: clock.cancelFrame,
    ...options,
});

/* ===========================================================================
 * 1. WATCHING — a screen mounted mid-shot sees the shot so far
 * =========================================================================== */

describe('watching a buffer', () => {
    test('the first derivation runs at once, so a mid-shot mount is not an empty chart', () => {
        const host = fakeHost();
        const clock = frames();
        const feed = feedOn(host, clock);
        const buffer = bufferWith();

        assert.equal(feed.derivation, null, 'nothing before a buffer');
        feed.watch(buffer);

        assert.equal(feed.derivations, 1, 'one derivation, without waiting for a frame');
        assert.equal(clock.size, 0, 'and no frame was queued for it');
        assert.equal(feed.derivation.ok, true);
        assert.equal(feed.derivation.counts.inShot, 336);
        assert.equal(host.updates, 1, 'the host was told to render exactly once');
        buffer.destroy();
    });

    test('the controller registers itself with its host', () => {
        const host = fakeHost();
        const feed = feedOn(host, frames());
        assert.equal(host.controllers.length, 1);
        assert.equal(host.controllers[0], feed);
    });

    test('watching the same buffer twice is one subscription and one derivation', () => {
        const host = fakeHost();
        const feed = feedOn(host, frames());
        const buffer = bufferWith(50);
        feed.watch(buffer);
        feed.watch(buffer);
        assert.equal(feed.derivations, 1);
        assert.equal(buffer.subscriberCount(), 1);
        buffer.destroy();
    });

    test('switching buffers drops the first subscription BEFORE taking the second', () => {
        const host = fakeHost();
        const clock = frames();
        const feed = feedOn(host, clock);
        const first = bufferWith(120);
        const second = bufferWith();

        feed.watch(first);
        const firstShot = feed.derivation.counts.inShot;
        feed.watch(second);

        assert.equal(first.subscriberCount(), 0, 'the old buffer is let go of');
        assert.equal(second.subscriberCount(), 1);
        assert.ok(feed.derivation.counts.inShot > firstShot,
            'and the chart is the new shot, not the two interleaved');

        // The abandoned buffer must not be able to reach the chart again.
        const before = feed.derivations;
        first.addSample(SHOT.measurements[200]);
        clock.run();
        assert.equal(feed.derivations, before);
        first.destroy();
        second.destroy();
    });

    test('watch(null) lets go, and the chart has nothing rather than a stale shot', () => {
        const host = fakeHost();
        const feed = feedOn(host, frames());
        const buffer = bufferWith(50);
        feed.watch(buffer);
        feed.watch(null);
        assert.equal(feed.derivation, null);
        assert.equal(feed.buffer, null);
        assert.equal(buffer.subscriberCount(), 0);
        buffer.destroy();
    });
});

/* ===========================================================================
 * 2. BUG chart-C9 — NO DEAD WEIGHT ON THE 15 Hz PATH
 * =========================================================================== */

describe('chart-C9: the 15 Hz path costs one derivation per frame at most', () => {
    test('twenty samples inside one frame are ONE derivation', () => {
        const host = fakeHost();
        const clock = frames();
        const feed = feedOn(host, clock);
        const buffer = bufferWith(100);
        feed.watch(buffer);
        const baseline = feed.derivations;

        for (let i = 100; i < 120; i += 1) buffer.addSample(SHOT.measurements[i]);
        assert.equal(feed.derivations, baseline, 'a publish does not derive; it marks dirty');
        assert.equal(feed.pending, true);

        assert.equal(clock.run(), 1, 'and it queued exactly one frame, not twenty');
        assert.equal(feed.derivations, baseline + 1);
        assert.equal(feed.pending, false);
        buffer.destroy();
    });

    test('a frame with nothing new does not derive at all', () => {
        const host = fakeHost();
        const clock = frames();
        const feed = feedOn(host, clock);
        const buffer = bufferWith(100);
        feed.watch(buffer);
        const baseline = feed.derivations;

        feed.refresh();
        feed.refresh();
        assert.equal(feed.derivations, baseline,
            'the buffer revision has not moved, so there is nothing to derive');

        buffer.addSample(SHOT.measurements[100]);
        assert.equal(feed.refresh().counts.inShot > 0, true);
        assert.equal(feed.derivations, baseline + 1, 'and a real sample derives once');
        buffer.destroy();
    });

    test('the derivation is handed over WHOLE — the same object gate 6 returned', () => {
        const host = fakeHost();
        const sentinel = Object.freeze({ ok: true, marker: 'gate-6' });
        const feed = feedOn(host, frames(), { derive: () => sentinel });
        const buffer = bufferWith(10);
        feed.watch(buffer);
        assert.equal(feed.derivation, sentinel,
            'nothing on this road copies, reshapes or re-labels the bundle');
        buffer.destroy();
    });

    test('a derivation that throws leaves the last good shot on screen', () => {
        const host = fakeHost();
        const clock = frames();
        let boom = false;
        const feed = feedOn(host, clock, {
            derive: (buffer) => {
                if (boom) throw new Error('derivation exploded');
                return { ok: true, samples: buffer.get().sampleCount };
            },
        });
        const buffer = bufferWith(100);
        feed.watch(buffer);
        const good = feed.derivation;

        boom = true;
        buffer.addSample(SHOT.measurements[100]);
        assert.doesNotThrow(() => clock.run(), 'a failed derivation must not take the screen down');
        assert.equal(feed.derivation, good, 'and the chart keeps the shot it had');
        buffer.destroy();
    });

    /* The rule above held on the SCHEDULED path only, because the guard was the
     * scheduler's own try/catch and half the callers never go through the scheduler:
     * `watch()` (called from the host's `willUpdate`), the `record` setter, `refresh()`
     * and `hostConnected()` all call the run directly. A throw on the FIRST buffer
     * therefore propagated into Lit's update and took the screen down — the mount path
     * being the one that matters most, since it is the one a broken shot reaches first. */
    const OFF_FRAME_PATHS = [
        ['watch() — the mount path, from the host\'s willUpdate', (feed, buffer) => feed.watch(buffer)],
        ['refresh()', (feed, buffer) => { feed.watch(buffer); feed.refresh(); }],
        ['the record setter', (feed, buffer) => { feed.watch(buffer); feed.record = { id: 'r1' }; }],
        ['hostConnected()', (feed, buffer) => {
            feed.watch(buffer);
            feed.hostDisconnected();
            feed.hostConnected();
        }],
    ];

    for (const [name, drive] of OFF_FRAME_PATHS) {
        test(`a derivation that throws off the frame does not take the screen down: ${name}`, () => {
            const host = fakeHost();
            const feed = feedOn(host, frames(), {
                derive: () => { throw new Error('derivation exploded'); },
            });
            const buffer = bufferWith(50);
            const sink = [];
            const off = sharedLogger.addSink((record) => sink.push(record));
            try {
                assert.doesNotThrow(() => drive(feed, buffer),
                    `${name} propagates the derivation's throw into the host's update`);
            } finally {
                off();
            }
            assert.equal(feed.derivation, null, 'and nothing half-derived is handed to the card');
            assert.ok(sink.length >= 1, 'the failure must not be silent either');
            assert.equal(sink[0].level, 'error');
            assert.match(String(sink[0].args[0]), /derivation failed: derivation exploded/);
            buffer.destroy();
        });
    }

    test('a shot that fails to derive is retried, not cached as the failure', () => {
        const host = fakeHost();
        let boom = true;
        const feed = feedOn(host, frames(), {
            derive: (buffer) => {
                if (boom) throw new Error('derivation exploded');
                return { ok: true, samples: buffer.get().sampleCount };
            },
        });
        const buffer = bufferWith(50);
        const off = sharedLogger.addSink(() => {});
        try {
            feed.watch(buffer);
            assert.equal(feed.derivation, null);
            assert.equal(feed.revision, null,
                'a failed derivation is not a cached one — the revision must not advance');
            boom = false;
            assert.equal(feed.refresh().ok, true,
                'so the very next run over the SAME buffer derives rather than skipping');
        } finally {
            off();
        }
        buffer.destroy();
    });

    test('switching buffers still clears the chart — a failure never shows the PREVIOUS shot', () => {
        const host = fakeHost();
        let boom = false;
        const feed = feedOn(host, frames(), {
            derive: (buffer) => {
                if (boom) throw new Error('derivation exploded');
                return { ok: true, samples: buffer.get().sampleCount };
            },
        });
        const first = bufferWith(50);
        feed.watch(first);
        assert.equal(feed.derivation.samples, 50);

        boom = true;
        const second = bufferWith(20);
        const off = sharedLogger.addSink(() => {});
        try {
            assert.doesNotThrow(() => feed.watch(second));
        } finally {
            off();
        }
        /* "keeps the last good shot" is bounded by WHICH SHOT is being watched: holding
         * the first buffer's derivation while the second is on screen would draw one shot
         * under another shot's name, which is worse than an empty card. `watch()` clears,
         * and that is deliberate. */
        assert.equal(feed.derivation, null,
            'a new buffer with a failing derivation shows nothing, never the old shot');
        first.destroy();
        second.destroy();
    });
});

/* ===========================================================================
 * 3. B4 — THE AXIS IS ReaPrime's ARRIVAL STAMPS, UNTOUCHED
 * =========================================================================== */

describe('B4: the time axis is passed through, never reconstructed', () => {
    const derivationOf = (count) => {
        const host = fakeHost();
        const feed = feedOn(host, frames());
        const buffer = bufferWith(count);
        feed.watch(buffer);
        const derivation = feed.derivation;
        buffer.destroy();
        return derivation;
    };

    test('every plotted t is a recorded stamp minus the chosen origin, to the millisecond', () => {
        const { axis } = derivationOf();
        assert.equal(axis.t.length, 336);
        assert.equal(axis.stampMs.length, axis.t.length);
        assert.equal(axis.originRule, 'firstPouringSample');
        for (let i = 0; i < axis.t.length; i += 1) {
            assert.equal(Math.round(axis.t[i] * 1000), axis.stampMs[i] - axis.originMs,
                `sample ${i} is not its own arrival stamp`);
        }
    });

    test('the intervals stay JITTERY — a uniform grid would be the fabrication A7 names', () => {
        const { axis } = derivationOf();
        const gaps = [];
        for (let i = 1; i < axis.t.length; i += 1) gaps.push(+(axis.t[i] - axis.t[i - 1]).toFixed(4));
        const distinct = new Set(gaps);
        assert.ok(distinct.size > 5,
            `the recorded transport jitter is gone: ${distinct.size} distinct intervals — `
            + 'resampling onto a grid is exactly what B4 forbids until R4 lands');
        const min = Math.min(...gaps);
        const max = Math.max(...gaps);
        assert.ok(max - min > 0.001, `intervals ${min}..${max} are suspiciously even`);
    });

    test('the axis is the derivation\'s, and the feed holds no clock of its own', () => {
        const source = readFileSync(join(REPO, 'src/lib/chart-feed.js'), 'utf8');
        const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
        for (const pattern of [/Date\.now/, /performance\.now/, /setInterval/, /setTimeout/]) {
            assert.doesNotMatch(code, pattern,
                `chart-feed.js holds a clock (${pattern}) — the shot's clock is ReaPrime's stamps`);
        }
    });
});

/* ===========================================================================
 * 4. BUG chart-C13 — FED FROM THE MODEL: NO ROUTE BACK INTO THE DOM
 * =========================================================================== */

describe('chart-C13: the chart road cannot read another component\'s rendered DOM', () => {
    const source = readFileSync(join(REPO, 'src/lib/chart-feed.js'), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

    test('it touches no document, no element and no rendered text', () => {
        for (const pattern of [
            /\bdocument\b/, /\bwindow\b/, /querySelector/, /getElementById/,
            /textContent/, /innerHTML/, /getBoundingClientRect/, /shadowRoot/,
        ]) {
            assert.doesNotMatch(code, pattern, `chart-feed.js reaches into the DOM (${pattern})`);
        }
    });

    test('it calls no endpoint and imports no store', () => {
        assert.doesNotMatch(code, /['"`][^'"`]*\/(api|ws)\/v1/);
        assert.doesNotMatch(code, /\bfetch\b/);
        assert.doesNotMatch(code, /from '[^']*\/stores\//,
            'the buffer arrives as an argument — importing one would make this a second wiring');
    });

    test('its only inputs are the buffer it was handed and the record it was given', () => {
        const imports = [...code.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort();
        assert.deepEqual(imports, ['./chart-render-scheduler.js', './logger.js', './shot-derivation.js']);
    });
});

/* ===========================================================================
 * 5. THE RECORD, THE REFUSAL, AND LETTING GO
 * =========================================================================== */

describe('the record, the refusal and the lifecycle', () => {
    test('a record arriving re-derives, and names the step boundaries', () => {
        const host = fakeHost();
        const feed = feedOn(host, frames());
        const buffer = bufferWith();
        feed.watch(buffer);

        const unnamed = feed.derivation.stepMarks;
        assert.ok(unnamed.length > 0, 'the shot has step boundaries either way');
        assert.deepEqual(unnamed.map((m) => m.name), unnamed.map(() => null),
            'with no record the boundaries have no names — an absence, not a guess');

        const before = feed.derivations;
        feed.record = SHOT;
        assert.equal(feed.derivations, before + 1,
            'the names live in the record, so a record arriving must re-derive');
        const named = feed.derivation.stepMarks.map((m) => m.name);
        assert.deepEqual(named, ['PI', 'Lever']);
        buffer.destroy();
    });

    test('an empty buffer refuses with a reason rather than drawing zeroes', () => {
        const host = fakeHost();
        const feed = feedOn(host, frames());
        const buffer = createShotBuffer({});
        feed.watch(buffer);
        assert.equal(feed.derivation.ok, false);
        assert.equal(feed.derivation.reason, 'noSamples');
        assert.deepEqual([...feed.derivation.axis.t], []);
        buffer.destroy();
    });

    test('disconnecting releases the subscription; reconnecting takes it back and catches up', () => {
        const host = fakeHost();
        const clock = frames();
        const feed = feedOn(host, clock);
        const buffer = bufferWith(100);
        feed.watch(buffer);

        feed.hostDisconnected();
        assert.equal(buffer.subscriberCount(), 0, 'a screen off the page holds no subscription');
        const asleep = feed.derivations;
        for (let i = 100; i < 140; i += 1) buffer.addSample(SHOT.measurements[i]);
        clock.run();
        assert.equal(feed.derivations, asleep, 'and derives nothing while it is away');

        feed.hostConnected();
        assert.equal(buffer.subscriberCount(), 1);
        assert.equal(feed.derivations, asleep + 1, 'coming back catches up in one derivation');
        assert.ok(feed.derivation.counts.inShot > 0);
        buffer.destroy();
    });

    test('destroy() leaves nothing subscribed and nothing pending', () => {
        const host = fakeHost();
        const clock = frames();
        const feed = feedOn(host, clock);
        const buffer = bufferWith(100);
        feed.watch(buffer);
        buffer.addSample(SHOT.measurements[100]);
        assert.equal(feed.pending, true);

        feed.destroy();
        assert.equal(buffer.subscriberCount(), 0);
        assert.equal(feed.pending, false);
        assert.equal(feed.buffer, null);
        assert.equal(feed.derivation, null);
        buffer.destroy();
    });
});
