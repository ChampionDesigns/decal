/**
 * THE SHOT-SO-FAR BUFFER — required client state, not a cache.
 */

import { createStore, UNCHANGED } from './store.js';
import { FEED_STATUS } from './feed-store.js';
import { SHOT_STATE, isShotRunning } from './feed-readers.js';
import { ORIGIN_RULE, sampleStampMs } from './time-axis.js';
import { SOURCE } from './shot-source-selector.js';
import { isPouring } from '../data/machine-state.js';

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
        sources: null,
        openedAt: null,
        closedAt: null,
        capped: false,
        dropped: Object.freeze({ beforeOpen: 0, afterCap: 0, unusable: 0 }),
        lastSample: null,
    };
}

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

    const publish = (patch) => store.update((state) => Object.freeze({
        ...state,
        ...patch,
        dropped: dropSnapshot(),
    }));

    const drops = { beforeOpen: 0, afterCap: 0, unusable: 0 };
    const dropSnapshot = () => Object.freeze({ ...drops });
    const resetDrops = () => { drops.beforeOpen = 0; drops.afterCap = 0; drops.unusable = 0; };

    let holdingSources = false;

    const releaseHeld = () => {
        if (!holdingSources) return;
        holdingSources = false;
        if (releaseSources) releaseSources();
    };

    const anyUndecided = (sources) => sources === null
        || Object.values(sources).some((source) => source === SOURCE.NONE);

    /** Decide t=0 as samples arrive — O(1) per sample, no pre-pass at derivation time. */
    const originFor = (state, sample, index) => {
        if (state.origin.rule === ORIGIN_RULE.FIRST_POURING) return state.origin;
        const stamp = sampleStampMs(sample);
        if (typeof stamp !== 'number') return state.origin;
        const machineState = sample.machine && sample.machine.state;
        if (machineState && isPouring(machineState.state, machineState.substate)) {
            return Object.freeze({ originMs: stamp, rule: ORIGIN_RULE.FIRST_POURING, index });
        }
        if (state.origin.originMs !== null) return state.origin;
        return Object.freeze({ originMs: stamp, rule: ORIGIN_RULE.FIRST_SAMPLE, index });
    };

    const buffer = {
        subscribe(listener) { return store.subscribe(listener); },
        get() { return store.get(); },
        revision() { return store.revision(); },
        /** Subscribers, NOT samples — for a refcount and for tests. See the note above. */
        subscriberCount() { return store.size(); },
        destroy() { store.destroy(); },

        open(shotId, { joinedLate = false, phase = null } = {}) {
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
                /** Undecided until the first sample gives the selector something to
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
            releaseHeld();
            return closed;
        },

        noteShotState(reading) {
            if (!reading || reading.ok !== true) return store.get();
            const state = store.get();
            const shotId = typeof reading.shotId === 'string' ? reading.shotId : null;

            if (shotId !== null && shotId !== state.shotId) {
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

        addSample(sample) {
            const state = store.get();
            if (!state.open) {
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
                if (!state.capped) {
                    note('warn', `sample cap reached (${maxSamples}); no longer appending`);
                    return publish({ capped: true });
                }
                return state;
            }

            const entry = Object.freeze({
                machine: sample.machine,
                scale: sample.scale ?? null,
                ...(sample.sensors ? { sensors: sample.sensors } : {}),
            });
            const index = state.samples.length;
            state.samples.push(entry);
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
                    // null, never zero: a sample we cannot place in time is a gap.
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
