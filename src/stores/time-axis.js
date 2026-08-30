// THE TIME AXIS (B4) — the skin plots what ReaPrime stamps, and invents no correction.
//
// SCOPE Part 3 §4, "Time axis (B4)":
//
//     "The skin plots what ReaPrime stamps. Today that is arrival time — both wire formats
//      carry a machine-side sample clock and ReaPrime discards both — so every chart
//      carries transport jitter. R4 asks for the decoded machine clock as its own field.
//      Until it lands the skin does not try to reconstruct it; deferral is PERMANENT for
//      recorded shots, which is why R4 is sequenced early."
//
// VERIFIED AT THE PIN (`2b047d02`), because a rule this consequential should not rest on a
// document alone:
//
//   * `unified_de1.parsing.dart:_parseStateAndShotSample` and
//     `:_parseStateAndBengleShotSample` both build their `MachineSnapshot` with
//     `timestamp: DateTime.now()` — the stamp is taken when ReaPrime DECODES the packet.
//   * The Bengle wire format does carry a sample clock: `bengle_shot_sample.dart` decodes
//     `sampleTime` (uint16, big-endian, offset 0) — and `_parseStateAndBengleShotSample`
//     never passes it on. It is decoded and dropped. That is the field R4 asks for.
//   * `WeightSnapshot`s are stamped `DateTime.now()` in each scale driver, at BLE notify.
//
// So the axis this module builds is an arrival axis, and it says so. What it must never do
// is make that fact invisible:
//
//   * NO RESAMPLING onto a uniform grid. A grid would look like a machine clock and would
//     be a fabrication — the exact defect class A7 names.
//   * NO INTERPOLATION and no gap filling. A missing sample is a gap.
//   * NO MONOTONIC CLAMP and no sorting. If stamps arrive out of order that is a fact
//     about the transport; it is COUNTED (`nonMonotonic`) and rendered as it came, because
//     a clamp would silently repair evidence of the thing R4 exists to fix.
//   * NO LOCAL SUBSTITUTE. A sample with no readable stamp is not plottable and is
//     dropped, counted, and reported. It is never given `Date.now()`: the store's own
//     arrival stamp (`feed-store.js` `receivedAt`) exists for staleness and is not an axis.
//
// WHEN R4 LANDS, the change is one function: `stampOf` gains the machine-clock field where
// present, and this file's diagnostics tell you immediately whether the shots you are
// looking at have it. Recorded shots from before R4 keep the arrival axis for ever, which
// is why the deferral is permanent and why the rule is worth writing down once, here.

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
    // `Date.parse` answers NaN for a string it cannot read. A frame whose stamp we cannot
    // read is a frame we cannot place in time — say so, do not place it anyway.
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
            // Never `firstSample` by assumption. The caller's rule if it gave one, `none`
            // when there is no origin at all, and otherwise `given` — which says exactly
            // what is known: an origin arrived from outside and its rule was not stated.
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
