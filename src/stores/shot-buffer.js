// THE SHOT-SO-FAR BUFFER — required client state, not a cache.
//
// The requirement is transcribed from `chart.js:311-330` and it is a hard one
// (SCOPE Part 3 §2, §4; Part 6, the `chart.js` DROP row):
//
//     ReaPrime's sockets are fire-and-forget with ONE frame of replay. No socket carries
//     history. A subscriber that connects mid-shot HAS MISSED THE SHOT.
//
// So the live series accumulate in exactly ONE place — here — and the live chart, the foot
// band and the post-shot summary all read this one accumulation. That is what kills the
// old tree's three independent walks over the same measurements array (`chart.js:2308`,
// `shot-series.js:93`, `shotData.js scanShotRecord`) and, with them, its worst coupling:
// the chart parsing numbers back out of another module's rendered `textContent`
// (`chart.js:1664-1678`). Nothing here renders and nothing here reads the DOM.
//
// ── SAMPLES ARE IN THE RECORDED SHAPE, AND THAT IS THE POINT ─────────────────────────────
// A sample is `{machine, scale, volume?, sensors?}` — byte-for-byte the shape ReaPrime
// persists (`ShotSnapshot.toJson`) and serves from `GET /api/v1/shots/<id>`. So the SAME
// walk reads a live shot and a recorded one, and Gate 6's one-shot-derivation module is
// written once. If the live shape were bespoke there would be two derivations within a
// week, which is the drift this rewrite exists to remove.
//
// TWO CONSEQUENCES WORTH STATING, both A7:
//
//   * `volume` IS ABSENT ON A LIVE SAMPLE. ReaPrime computes it in its own recorder; the
//     snapshot socket does not carry it. The key is therefore omitted — visibly absent,
//     read as an absence by `readStoredMeasurement` — and NOT integrated locally from
//     flow. A locally-integrated volume would look exactly like the server's and disagree
//     with it, which is the fallback-path defect wearing its most convincing disguise.
//   * A MID-SHOT JOIN IS RECORDED, NEVER BACKFILLED. `joinedLate` says the earlier samples
//     were missed. Nothing reconstructs them; a screen says the trace is partial, and the
//     recorded shot — which ReaPrime built from its own complete stream — is the oracle
//     once the shot is persisted.
//
// ── THE BUFFER IS NOT THE RECORD ─────────────────────────────────────────────────────────
// After `finished`, ReaPrime persists the shot and that record is authoritative. This
// buffer survives the end of the shot ONLY so the post-shot summary has something to paint
// immediately; it is superseded, not merged, when the record is read. It is also not the
// IDB latest-shot mirror, which is a separate, cache-shaped thing with its own item.
//
// ── LIFECYCLE IS THE SERVER'S, NOT INFERRED ──────────────────────────────────────────────
// The shot's boundaries come from `/ws/v1/machine/shotState` — the sequencer's own view —
// not from watching machine substates change. Read at the pin: `ShotState.idle` is not
// published from the state stream, but an idle frame IS published at cleanup with
// `shotId: null` (`De1StateManager._publishIdleFrame`), and every in-shot frame carries the
// uuid. So: a new `shotId` opens a buffer, `finished` closes it, an idle frame closes it.

import { createStore, UNCHANGED } from './store.js';
import { FEED_STATUS } from './feed-store.js';
import { SHOT_STATE, isShotRunning } from './feed-readers.js';
import { ORIGIN_RULE, sampleStampMs } from './time-axis.js';
import { SOURCE } from './shot-source-selector.js';
import { isPouring } from '../data/machine-state.js';

/**
 * The cap. FORTY MINUTES AT 15 Hz, which is Ben's own number and his own reason
 * (25 August 2026): "I sometimes do very long test shots that last 40mins and with a 15Hz
 * sample rate." 40 x 60 x 15 = 36,000. It was 18,000, sized for thirty minutes at the
 * snapshot socket's ~10 Hz, which cuts a 40-minute bench shot at twenty.
 *
 * A cap exists because nothing else bounds this array: a machine left in a state that
 * keeps a shot open would grow it until the tab died. When it is reached the buffer STOPS
 * APPENDING and says so — it does not drop from the front. A ring buffer would silently
 * discard the beginning of the shot, which is the one part a mid-shot subscriber cannot
 * get any other way, and is the exact thing this module exists to keep.
 */
export const DEFAULT_MAX_SAMPLES = 36000;

const EMPTY_ORIGIN = Object.freeze({ originMs: null, rule: ORIGIN_RULE.NONE, index: -1 });

function emptyState() {
    return {
        shotId: null,
        /** The sequencer's phase, verbatim. `null` before anything has been heard. */
        phase: null,
        open: false,
        /** APPEND-ONLY and shared by reference. See the note on `revision` below. */
        samples: [],
        sampleCount: 0,
        /** t=0, decided incrementally as samples arrive (see `time-axis.js`). */
        origin: EMPTY_ORIGIN,
        /** True when accumulation began after the shot had already started. */
        joinedLate: false,
        /** B6: the per-channel source choice, frozen for the whole shot. */
        sources: null,
        openedAt: null,
        closedAt: null,
        capped: false,
        dropped: Object.freeze({ beforeOpen: 0, afterCap: 0, unusable: 0 }),
        lastSample: null,
    };
}

/**
 * @param {object} [options]
 * @param {() => number} [options.clock]          injected; arrival stamps are diagnostic only
 * @param {number} [options.maxSamples]
 * @param {{warn?: Function, info?: Function}} [options.logger]
 * @param {(context: {shotId: string|null, sample: object}) => object} [options.chooseSources]
 *        B6 — the DUPLICATED-CHANNELS SOURCE SELECTOR. Called from the FIRST SAMPLE (not at
 *        open: the decision is made from evidence, and at open there is none), and then on
 *        each further sample only while some quantity still has no evidence either way —
 *        which at a real shot start is all three, because ReaPrime gates every `*Derived`
 *        key below its flow/pressure threshold and the estimator has observed nothing yet.
 *        A quantity that HAS decided is never re-opened: that is B6, and it is why the
 *        answer for it is frozen and held. The selector itself is
 *        `shot-source-selector.js`; `sourceSelectorHooks` in `live-stores.js` adapts it.
 *        Absent, the buffer records `sources: null` and `sourcesPending: true` — a visible
 *        hole, never a guessed default.
 * @param {() => void} [options.releaseSources]
 *        The other half of the selector's lifetime: called when the shot closes, when a new
 *        shot opens and on `clear()`, so a held decision cannot outlive its shot.
 */
export function createShotBuffer({
    clock = () => Date.now(),
    maxSamples = DEFAULT_MAX_SAMPLES,
    logger = null,
    chooseSources = null,
    releaseSources = null,
} = {}) {
    if (!(Number.isInteger(maxSamples) && maxSamples > 0)) {
        throw new Error('createShotBuffer: maxSamples must be a positive integer');
    }
    const store = createStore(Object.freeze(emptyState()), { label: 'shotBuffer', logger });

    const note = (level, message) => {
        if (logger && logger[level]) logger[level](`shotBuffer: ${message}`);
    };

    /**
     * Publish new state.
     *
     * `samples` is the ONE thing not copied: the array is append-only and is shared by
     * reference, so appending a sample costs one push rather than a copy of a
     * four-thousand-element array at 10 Hz. The STATE OBJECT is new every time, which is
     * what Lit compares, and `revision`/`sampleCount` are the change signals a chart reads.
     * A consumer must never sort, splice or reverse this array; `toArray()` hands out a
     * copy for anything that wants to.
     */
    const publish = (patch) => store.update((state) => Object.freeze({
        ...state,
        ...patch,
        dropped: dropSnapshot(),
    }));

    /**
     * DROP COUNTS ARE COUNTED HERE, NOT PUBLISHED FROM HERE.
     *
     * They live outside the published state because a dropped frame is not a state change
     * anything renders, and `publish` builds a new frozen object every time — so counting a
     * drop through it notified every subscriber. With the buffer attached to the machine
     * feed that is one notification per snapshot frame, ~10 Hz, for as long as the machine
     * sits idle: a permanent re-render pump behind a counter nobody is watching. Every real
     * publish carries the current counts, so the state is never out of date; the counting
     * itself is silent. `feed-store.js` solves the same problem with UNCHANGED.
     */
    const drops = { beforeOpen: 0, afterCap: 0, unusable: 0 };
    const dropSnapshot = () => Object.freeze({ ...drops });
    const resetDrops = () => { drops.beforeOpen = 0; drops.afterCap = 0; drops.unusable = 0; };

    /**
     * Whether the B6 selector is currently holding a decision for this shot.
     *
     * Tracked here rather than read off `state.sources`, because the two have different
     * lifetimes on purpose: the SELECTOR's decision ends with the shot, while the RECORD of
     * which source was in force stays in the state for the post-shot summary to label the
     * trace with. Deriving one from the other released the same decision twice.
     */
    let holdingSources = false;

    const releaseHeld = () => {
        if (!holdingSources) return;
        holdingSources = false;
        if (releaseSources) releaseSources();
    };

    /**
     * B6: is any quantity still undecided?
     *
     * `SOURCE.NONE` in a held decision does not mean "this quantity has no source" — at a
     * real shot start it cannot mean that, because ReaPrime omits every `*Derived` key below
     * its own flow/pressure gate and the estimator has observed nothing yet, so the first
     * sample of every espresso carries neither side. Freezing NONE there rendered a
     * permanent gap for all three quantities for the whole shot, even once both instruments
     * were on the wire. So NONE is UNDECIDED, and the selector is asked again on the next
     * sample until every quantity has real evidence. A quantity that HAS decided is never
     * re-opened — that is the whole of B6 and it is untouched.
     */
    const anyUndecided = (sources) => sources === null
        || Object.values(sources).some((source) => source === SOURCE.NONE);

    /** Decide t=0 as samples arrive — O(1) per sample, no pre-pass at derivation time. */
    const originFor = (state, sample, index) => {
        if (state.origin.rule === ORIGIN_RULE.FIRST_POURING) return state.origin;
        const stamp = sampleStampMs(sample);
        if (typeof stamp !== 'number') return state.origin;
        const machineState = sample.machine && sample.machine.state;
        if (machineState && isPouring(machineState.state, machineState.substate)) {
            // The espresso rule, and it can REPLACE an earlier first-sample origin: the
            // preinfusion samples stay in the buffer, at negative t, which is what the
            // recorded-shot renderer does with them too.
            return Object.freeze({ originMs: stamp, rule: ORIGIN_RULE.FIRST_POURING, index });
        }
        if (state.origin.originMs !== null) return state.origin;
        return Object.freeze({ originMs: stamp, rule: ORIGIN_RULE.FIRST_SAMPLE, index });
    };

    const buffer = {
        /* The store surface, delegated — with ONE deliberate gap.
         *
         * `size()` IS NOT ON THIS OBJECT, and its absence is the fix for a silent wrong
         * answer. The store primitive's `size()` is the SUBSCRIBER count (`store.js`'s
         * `listeners.size`), which is the right name on a plain store and a trap on a thing
         * called a buffer: this one also ACCUMULATES, so `size()` is the obvious spelling
         * for the number a chart wants, and delegating it answered 0 on a full buffer and 1
         * on an empty one with a chart attached. Nothing in the tree called it, so no test
         * was ever green over a wrong number — but Gate 6's chart chain is this buffer's
         * first real consumer and would have been the first to ask. Removed rather than
         * re-pointed at `sampleCount`, so a caller who types the old name gets a TypeError
         * at the first call instead of a plausible small integer.
         *
         * The SAMPLE count is `get().sampleCount` — published, and the change signal Lit
         * compares — or `toArray().length`. The SUBSCRIBER count is `subscriberCount()`,
         * named for what it returns. `feed-store.js` keeps its `size()` delegation on
         * purpose: a feed holds one frame and accumulates nothing, so it has no second
         * number to be confused with, and `live-stores.test.mjs:399` reads it as exactly
         * the refcount it is.
         */
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },
        revision() { return store.revision(); },
        /** Subscribers, NOT samples — for a refcount and for tests. See the note above. */
        subscriberCount() { return store.size(); },
        destroy() { store.destroy(); },

        /**
         * Open a shot. Called by `noteShotState`; exposed because a test — and only a test
         * — has a reason to open one directly.
         *
         * @param {string|null} shotId
         * @param {{joinedLate?: boolean, phase?: string|null}} [options]
         */
        open(shotId, { joinedLate = false, phase = null } = {}) {
            // A held decision must not cross into the next shot: a new machine, a new puck,
            // possibly a different set of channels present.
            releaseHeld();
            resetDrops();
            const fresh = emptyState();
            note('info', `shot ${shotId} opened${joinedLate ? ' (joined late)' : ''}`);
            return store.set(Object.freeze({
                ...fresh,
                shotId,
                phase,
                open: true,
                joinedLate,
                /** B6: undecided until the first sample gives the selector something to
                 *  decide FROM. Named while it is pending, never filled with a default. */
                sources: null,
                sourcesPending: true,
                openedAt: clock(),
            }));
        },

        /** Close the shot. The samples STAY — the post-shot summary reads them. */
        close(phase = SHOT_STATE.FINISHED) {
            const closed = store.update((state) => (state.open
                ? Object.freeze({ ...state, open: false, phase, closedAt: clock() })
                : UNCHANGED));
            // The selector's decision ends here; the RECORD of it stays in the state, so
            // the post-shot summary can say which source the trace was drawn from.
            releaseHeld();
            return closed;
        },

        /**
         * Feed the sequencer's view in. Idempotent: the shot-state feed replays its last
         * frame to every late subscriber, so the same reading arrives more than once and
         * must not re-open the shot it already opened.
         *
         * @param {object|null} reading  a `readShotStateFrame` result (the feed's `value`)
         */
        noteShotState(reading) {
            if (!reading || reading.ok !== true) return store.get();
            const state = store.get();
            const shotId = typeof reading.shotId === 'string' ? reading.shotId : null;

            if (shotId !== null && shotId !== state.shotId) {
                // A shot we have not seen before. If its first frame already says pouring
                // or stopping, we joined after it began and every earlier sample is gone.
                return buffer.open(shotId, {
                    joinedLate: reading.state !== SHOT_STATE.PREHEATING,
                    phase: reading.state,
                });
            }
            if (shotId === null && state.open) {
                // The idle frame published at cleanup. The shot is over.
                return buffer.close(reading.state);
            }
            if (shotId !== null && shotId === state.shotId) {
                if (reading.state === SHOT_STATE.FINISHED) return buffer.close(SHOT_STATE.FINISHED);
                if (reading.state === state.phase) return store.get();
                return publish({ phase: reading.state, open: isShotRunning(reading) });
            }
            return store.get();
        },

        /**
         * Append one sample, in the RECORDED shape.
         *
         * @param {{machine: object, scale?: object|null, sensors?: object}} sample
         *        `machine` is the raw `/ws/v1/machine/snapshot` frame; `scale` the raw
         *        scale frame or null; `sensors` a map keyed by SENSOR ID, exactly as a
         *        recorded measurement keys it. `volume` is not written — see the header.
         */
        addSample(sample) {
            const state = store.get();
            if (!state.open) {
                // Frames outside a shot are normal — the snapshot socket never stops — and
                // are counted rather than logged OR PUBLISHED, so an idle machine fills
                // neither the log nor the render loop.
                drops.beforeOpen += 1;
                return state;
            }
            if (!sample || typeof sample !== 'object' || !sample.machine || typeof sample.machine !== 'object') {
                note('warn', 'a sample with no machine frame was offered and dropped');
                drops.unusable += 1;
                return state;
            }
            if (state.samples.length >= maxSamples) {
                drops.afterCap += 1;
                // Reaching the cap IS a state change and publishes once. Every frame after
                // it is not, and does not.
                if (!state.capped) {
                    note('warn', `sample cap reached (${maxSamples}); no longer appending`);
                    return publish({ capped: true });
                }
                return state;
            }

            const entry = Object.freeze({
                machine: sample.machine,
                // `null`, not omitted, when there is no scale: that is how a recorded
                // measurement spells "no scale was attached", and the reader keys on it.
                scale: sample.scale ?? null,
                ...(sample.sensors ? { sensors: sample.sensors } : {}),
            });
            const index = state.samples.length;
            state.samples.push(entry);
            // B6: decided from evidence, then held — asked again only while a quantity has
            // had no evidence at all. See `anyUndecided`.
            let decided = state.sources;
            if (chooseSources && anyUndecided(state.sources)) {
                decided = Object.freeze({ ...chooseSources({ shotId: state.shotId, sample: entry }) });
                holdingSources = true;
            }
            return publish({
                sampleCount: state.samples.length,
                lastSample: entry,
                origin: originFor(state, entry, index),
                sources: decided,
                sourcesPending: anyUndecided(decided),
            });
        },

        /**
         * ONE traversal, many visitors — the mechanism that keeps "three walks over the
         * same array" from coming back. Every per-shot scalar (B5) is a visitor; the full
         * derivation module is Gate 6 and is written against this signature.
         *
         * Each visitor is `{start?(context), sample(entry, position, context), finish?(context)}`
         * and `finish` returns that visitor's result. `position` carries the index, the
         * stamp and the elapsed seconds, so no visitor re-parses a timestamp and none of
         * them re-decides t=0.
         *
         * @param {Array<object>} visitors
         * @returns {{results: unknown[], samples: number, context: object}}
         */
        walk(visitors = []) {
            const state = store.get();
            const list = Array.isArray(visitors) ? visitors : [visitors];
            const context = Object.freeze({
                shotId: state.shotId,
                phase: state.phase,
                open: state.open,
                joinedLate: state.joinedLate,
                sources: state.sources,
                sampleCount: state.sampleCount,
                originMs: state.origin.originMs,
                originRule: state.origin.rule,
            });
            for (const visitor of list) if (visitor.start) visitor.start(context);

            const samples = state.samples;
            const count = state.sampleCount;
            for (let i = 0; i < count; i += 1) {
                const entry = samples[i];
                const stamp = sampleStampMs(entry);
                const stamped = typeof stamp === 'number';
                const position = {
                    index: i,
                    stampMs: stamped ? stamp : null,
                    // null, never zero: a sample we cannot place in time is a gap (B4).
                    seconds: stamped && context.originMs !== null ? (stamp - context.originMs) / 1000 : null,
                };
                for (const visitor of list) visitor.sample(entry, position, context);
            }

            return {
                results: list.map((visitor) => (visitor.finish ? visitor.finish(context) : undefined)),
                samples: count,
                context,
            };
        },

        /**
         * What has been dropped, right now — the diagnostic read, always current.
         *
         * `get().dropped` carries the same counts as of the last PUBLISHED state, which is
         * every state a subscriber ever sees. This is the accessor for a test or a debug
         * pane that wants the count between publishes, and it is why counting a drop no
         * longer has to notify anybody.
         */
        dropped() {
            return dropSnapshot();
        },

        /** A copy of the samples — for anything that wants to sort or slice. */
        toArray() {
            return store.get().samples.slice(0, store.get().sampleCount);
        },

        /** Forget everything. The next shot starts clean. */
        clear() {
            releaseHeld();
            resetDrops();
            return store.set(Object.freeze(emptyState()));
        },
    };

    return buffer;
}

/**
 * Wire the buffer to the live feeds.
 *
 * Kept separate from the buffer itself so the buffer is testable with no sockets, and so
 * this — the part with the policy in it — is readable on its own. Three policies live
 * here and each is a defect avoided:
 *
 *   1. THE MACHINE SNAPSHOT DRIVES SAMPLING. One sample per machine frame, exactly as
 *      ReaPrime's own recorder builds a `ShotSnapshot`. The scale and the sensors are
 *      attached as they stand at that moment, with their own timestamps intact, so the
 *      skew between them is visible rather than averaged away.
 *   2. ONLY A LIVE FEED IS ATTACHED. A scale whose socket has closed contributes `null`
 *      (which is what a recorded shot with no scale contains), and a sensor that is not
 *      currently attached contributes nothing. Attaching the last frame of a dead feed
 *      would present a minutes-old reading as this sample's measurement — the same defect
 *      as a fallback path, arriving by a different door.
 *   3. A NEW FRAME IS DETECTED BY THE FEED'S OWN COUNTER, not by comparing values: two
 *      identical frames are two samples, and a state change that carries no new frame
 *      (a signal, a staleness re-classification) is not a sample at all.
 *
 * @param {object} deps
 * @param {object} deps.buffer
 * @param {object} deps.machine    the machine-snapshot feed store
 * @param {object} deps.shotState  the shot-state feed store
 * @param {object} [deps.scale]    the scale feed store
 * @param {() => object|undefined} [deps.sensors]  current sensors map, keyed by SENSOR ID
 * @returns {() => void} detach
 */
export function attachShotBuffer({ buffer, machine, shotState, scale = null, sensors = null } = {}) {
    if (!buffer || typeof buffer.addSample !== 'function') throw new Error('attachShotBuffer: buffer is required');
    if (!machine || typeof machine.subscribe !== 'function') throw new Error('attachShotBuffer: the machine feed is required');
    if (!shotState || typeof shotState.subscribe !== 'function') throw new Error('attachShotBuffer: the shotState feed is required');

    const offShotState = shotState.subscribe((state) => buffer.noteShotState(state.value));

    let seenFrames = -1;
    const offMachine = machine.subscribe((state) => {
        if (state.frames === seenFrames || state.frame === null) return;
        seenFrames = state.frames;
        const scaleState = scale ? scale.get() : null;
        buffer.addSample({
            machine: state.frame,
            scale: scaleState && scaleState.status === FEED_STATUS.LIVE ? scaleState.frame : null,
            sensors: sensors ? sensors() : undefined,
        });
    });

    return () => {
        offShotState();
        offMachine();
    };
}
