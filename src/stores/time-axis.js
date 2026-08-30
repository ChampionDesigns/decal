

import { ABSENCE, noReading, hasKey } from '../data/reading.js';
import { isPouring } from '../data/machine-state.js';

/** How t=0 was chosen. Reported on every axis, because it changes what the chart means. */
export const ORIGIN_RULE = Object.freeze({
    /** The first sample the machine reported as actually pouring. The espresso rule. */
    FIRST_POURING: 'firstPouringSample',
    /** No pouring sample: the first stamped sample. Steam, water, flush, an aborted shot. */
    FIRST_SAMPLE: 'firstSample',
    GIVEN: 'given',
    /** Nothing carried a readable stamp. There is no axis; there is nothing to draw. */
    NONE: 'none',
});

const ORIGIN_RULES = new Set(Object.values(ORIGIN_RULE));

export function stampMs(source) {
    if (!source || typeof source !== 'object') return noReading(ABSENCE.NO_SOURCE);
    if (!hasKey(source, 'timestamp')) return noReading(ABSENCE.ABSENT);
    const raw = source.timestamp;
    if (raw === null || raw === undefined) return noReading(ABSENCE.NULL);
    if (typeof raw !== 'string') return noReading(ABSENCE.NON_FINITE);
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : noReading(ABSENCE.NON_FINITE);
}

export function sampleStampMs(sample) {
    return stampMs(sample && sample.machine);
}

export function elapsedSeconds(stamp, originMs) {
    if (typeof stamp !== 'number' || !Number.isFinite(stamp)) return null;
    if (typeof originMs !== 'number' || !Number.isFinite(originMs)) return null;
    return (stamp - originMs) / 1000;
}

export function chooseOrigin(samples, { stampOf = sampleStampMs } = {}) {
    const list = Array.isArray(samples) ? samples : [];
    let firstStamped = -1;
    for (let i = 0; i < list.length; i += 1) {
        const stamp = stampOf(list[i]);
        if (typeof stamp !== 'number') continue;
        if (firstStamped === -1) firstStamped = i;
        const machine = list[i] && list[i].machine;
        const state = machine && machine.state;
        if (state && isPouring(state.state, state.substate)) {
            return { originMs: stamp, rule: ORIGIN_RULE.FIRST_POURING, index: i };
        }
    }
    if (firstStamped === -1) return { originMs: null, rule: ORIGIN_RULE.NONE, index: -1 };
    return {
        originMs: stampOf(list[firstStamped]),
        rule: ORIGIN_RULE.FIRST_SAMPLE,
        index: firstStamped,
    };
}

export function buildTimeAxis(samples, { originMs = undefined, originRule = undefined, stampOf = sampleStampMs } = {}) {
    const list = Array.isArray(samples) ? samples : [];
    if (originRule !== undefined && !ORIGIN_RULES.has(originRule)) {
        throw new Error(`buildTimeAxis: "${originRule}" is not an ORIGIN_RULE`);
    }
    const chosen = originMs === undefined
        ? chooseOrigin(list, { stampOf })
        : {
            originMs,
            rule: originMs === null ? ORIGIN_RULE.NONE : (originRule ?? ORIGIN_RULE.GIVEN),
            index: -1,
        };

    const seconds = [];
    const indices = [];
    let unstamped = 0;
    let nonMonotonic = 0;
    let previous = null;

    for (let i = 0; i < list.length; i += 1) {
        const stamp = stampOf(list[i]);
        if (typeof stamp !== 'number') {
            // Counted, not fabricated, not filled. The chart shows a gap here.
            unstamped += 1;
            continue;
        }
        if (previous !== null && stamp < previous) nonMonotonic += 1;
        previous = stamp;
        const t = elapsedSeconds(stamp, chosen.originMs);
        if (t === null) continue;
        seconds.push(t);
        indices.push(i);
    }

    return {
        originMs: chosen.originMs,
        rule: chosen.rule,
        /** Elapsed seconds, in ARRIVAL order — never sorted. */
        seconds,
        /** Which sample each entry came from, so a caller reads channels without guessing. */
        indices,
        /** Samples with no readable stamp. Dropped from the axis, never invented. */
        unstamped,
        /** Stamps that went backwards. Transport jitter made visible; R4 is the fix. */
        nonMonotonic,
        span: seconds.length === 0 ? null : seconds[seconds.length - 1] - seconds[0],
    };
}

export const TIME_SOURCE = Object.freeze({
    /** ReaPrime's own stamp, taken when it decoded the packet. Carries transport jitter. */
    ARRIVAL: 'arrival',
});

export function timeSourceOf() {
    return TIME_SOURCE.ARRIVAL;
}
