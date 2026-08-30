// GATE 6 — ONE SHOT DERIVATION.
//
// A single parse of the measurements array, serving the live chart, the Live foot band and
// the post-shot summary alike. It replaces THREE independent walks over the same array
// (`chart.js:2308`, `shot-series.js:93`, `shotData.js scanShotRecord`) and, with them, the
// single worst coupling in the old tree: the chart parsing numbers back out of another
// module's rendered `textContent` (`chart.js:1664-1678`). That is chart-C13 — the chart never
// reads another component's rendered DOM — and this module is the thing that makes it true,
// because a chart fed from the model has no reason to scrape one.
//
// THE SAME WALK READS A LIVE SHOT AND A RECORDED ONE. The shot-so-far buffer accumulates
// samples in ReaPrime's own persisted shape (`{machine, scale, volume?, sensors?}`), so
// `deriveFromBuffer` and `deriveFromRecord` differ only in where the samples come from and
// share every line of derivation. `test/shot-derivation.test.mjs` proves it — "THE ONE
// DERIVATION: the buffer path and the record path agree" — by feeding one set of samples
// through both and asserting the derived parts equal: the axis and its origin rule, every
// channel's x AND y, the scalars, the phases and the step marks. Two things are deliberately
// outside that equality and each has its own test beside it — `sourcesHeldBy`, because a
// buffer HOLDS the B6 decision and a record has no live selector to hold one, and `volume`,
// which the recorder persists and the snapshot socket does not carry, so the equality is fed
// the live-shaped samples both paths can hold. If any of the derivation itself ever diverges,
// that assertion is what says so.
//
// AND IT IS RUN OVER RECORDED SHOTS, NOT ONLY BUILT ONES. The suite's second arm walks the
// three real bodies in `tools/rea-fixtures/api__v1__shots__*.json` — 266, 426 and 231 rows off
// the bench, contract-checked by `tools/check_mock_contract.py` — because a hand-built sample
// can only contain what its author already believed. Those recordings predate `633f6f68` and
// carry `machine.weight` at 1033.9 g and `machine.weightFlow` on every row: a derivation that
// took the deleted machine gravimetric branch would report a 1,033 g yield off a real file, and
// the fixture arm is what asserts it reports nothing at all. That is the A7 rule proved by
// behaviour rather than by reading this file's imports.
//
// ── WHAT IT PRODUCES ─────────────────────────────────────────────────────────────────────
//   * `series`   — every plottable channel, on a shared time axis (`axis.t`).
//   * `phases`   — the foot band's phase table: preinfusion / extraction / total, as NUMBERS.
//   * `scalars`  — the per-shot scalars (B5), computed in the skin for v1 because ReaPrime
//                  serves none of them; R5 is the upstream ask that would let this read a
//                  field instead. Nothing working is displaced: the old metrics block renders
//                  blank on screen and its unit test hides that.
//   * `stepMarks`— the profile-frame boundaries, for the phase marks on the time charts.
//
// ── THE RULES CARRIED FORWARD, EACH FOR A NAMED REASON ───────────────────────────────────
//
//  1. THE VERTICAL-STEP ANCHOR. At a profile-frame boundary the OUTGOING target is repeated
//     at the boundary's x before the incoming one is written, so a pump-mode swap renders as
//     a vertical step rather than a diagonal ramp between two setpoints the machine never
//     passed through. The two target channels are therefore the only ones with their own x.
//
//  2. X ADVANCES WHILE Y MAY BE NULL. Every measured channel gets one y per in-shot sample,
//     aligned to `axis.t`; an absence is `null`, which is uPlot's gap. A gated stretch renders
//     as a HOLE, not as a line drawn through it and not as a run of zeroes. `toPlot` is the
//     one sanctioned absence-to-null conversion and it is the only one used here.
//
//  3. A REPORTED 0 °C TARGET IS REFUSED. Zero means "no target", not a setpoint of freezing;
//     recorded, it drags the temperature band down by ninety degrees and squashes every real
//     line into the top inch. Refusing it yields a gap — it does not substitute a value.
//
//  4. NEAREST, NOT FLOOR. `indexAtTime`'s binary search returns the closer of the two
//     bracketing samples: a correspondence marker half a sample early reads as a
//     misalignment, which is the exact thing the alignment control exists to show.
//
// ── AND THE FALLBACKS THAT DO NOT COME WITH THEM (A7) ────────────────────────────────────
//
//   * NO `?? computeW(pressure, flow)`. Hydraulic power is read through the B6 source choice
//     and is absent when neither side reports it. The skin consumes these channels; it does
//     not compute them (SCOPE Part 3, the derived/puck-channels row).
//   * NO LOCAL SMOOTHING. The old builder ran a tau-0.5 s EMA over the estimator's R and Z.
//     ReaPrime does no smoothing of any machine channel and the firmware's r1/r2 are already
//     a fit; a second filter in the skin is a second thing to drift, and it makes a
//     server-side value and a locally-massaged one indistinguishable on screen.
//   * NO MACHINE-VS-SCALE GRAVIMETRIC BRANCH. `633f6f68` deleted `machine.weightFlow`; there
//     is one gravimetric source for every machine and it is the scale's. The old
//     `useMachineGFlow` branch, its delta-plus-EMA scale-flow resolver and the SECOND loop
//     over the measurements array all go with it.
//   * VOLUME IS THE SERVER'S WHERE THE SERVER SENDS ONE, AND INTEGRATED WHERE IT DOES NOT.
//     This used to say "no local volume integration" and refuse the second half, on the
//     grounds that a locally integrated volume would look like the server's and disagree
//     with it. MEASURED, THE PREMISE IS WRONG IN BOTH DIRECTIONS. ReaPrime persists
//     `volume` per stored measurement and its live `MachineSnapshot` carries no such field
//     at all, so the refusal did not produce a cautious number — it produced NO VOLUME
//     COLUMN ON A LIVE SHOT, ever, which is the reported bug. And the two numbers do not
//     disagree: on the recorded shot the server's own last volume is 79.07 mL and the
//     integral of the same recording's flow is 79.9 mL, which is one part in a hundred and
//     invisible at the zero decimals the column shows. The old app integrates
//     unconditionally, live and stored alike (`shotData.js:376-382,:305-311`), which is
//     also why its live and history figures agree with each other.
//     SERVED WINS, so a stored shot still reads what ReaPrime counted from the profile's
//     own `target_volume_count_start`; the integral only fills a sample that carries none.
//     `availability.volume` goes on reporting whether the SERVER sent one, so a reader can
//     still tell the two apart.
//   * NO DOSE FROM `profile.dose_weight`. That field does not exist; see `rea-shot-record.js`.
//
// ── ADDRESSING ───────────────────────────────────────────────────────────────────────────
// There is not one ReaPrime key string in this file. Frames are read through
// `rea-address.js`, the record shell through `rea-shot-record.js`, the three duplicated
// quantities through `shot-source-selector.js` (B6: chosen at shot start, held for the shot),
// and t=0 through `time-axis.js` (B4: the skin plots what ReaPrime stamps). Every one of the
// old builder's reads was mis-addressed — `hydraulicPower`, the fused pair, the machine
// gravimetric branch, the detector fold — and going through the layer is what stops that
// class of defect recurring silently.
//
// DOM-free, module-state-free, and it returns rather than assigns: the History viewer draws
// TWO shots at once and neither of them is the live one.

import {
    readStoredMeasurement,
    storedShotSensors,
    hasReading,
    toPlot,
} from '../data/rea-address.js';
import { readStoredShot, shotDose } from '../data/rea-shot-record.js';
import {
    SOURCE,
    DUPLICATED_QUANTITIES,
    chooseSource,
    readThroughSource,
} from '../stores/shot-source-selector.js';
import { chooseOrigin, sampleStampMs, ORIGIN_RULE } from '../stores/time-axis.js';
import { isPouring, MACHINE_SUBSTATE } from '../data/machine-state.js';

export const FIRST_DROP_G = 0.5;

/**
 * Flow below this is not pouring. It bounds the averages: a shot that spends eight seconds at
 * zero flow during preinfusion would otherwise report an average describing the pause rather
 * than the extraction.
 */
export const POURING_ML_S = 0.2;

/** The substates that mean espresso is being poured rather than prepared. */
const POURED = new Set([MACHINE_SUBSTATE.POURING, MACHINE_SUBSTATE.POURING_DONE]);

function refuseZeroTarget(reading) {
    return hasReading(reading) && reading > 0 ? reading : null;
}

const MEASURED_CHANNELS = Object.freeze([
    Object.freeze({ key: 'pressure', read: (s) => s.machine.pressure }),
    Object.freeze({ key: 'flow', read: (s) => s.machine.flow }),
    /** The ONE gravimetric channel, server-smoothed, identical on Bengle and DE1. */
    Object.freeze({ key: 'weightFlow', read: (s) => s.scale.weightFlow }),
    /** ADDED. Cumulative weight — without it yield, ratio and time-to-first-drop cannot exist. */
    Object.freeze({ key: 'weight', read: (s) => s.scale.weight }),
    /** ADDED. ReaPrime's per-measurement volume where it sends one, else the integral of
     *  flow over the samples plotted so far — see the header for the measurement. */
    Object.freeze({ key: 'volume', read: (s) => s.volume }),
    /** Group over mix: mix is the pre-group mid-mix sensor and reads 2–5 °C off brew temp. */
    Object.freeze({ key: 'groupTemp', read: (s) => s.machine.groupTemperature }),
    Object.freeze({ key: 'mixTemp', read: (s) => s.machine.mixTemperature }),
    Object.freeze({ key: 'targetTemp', read: (s) => refuseZeroTarget(s.machine.targetGroupTemperature) }),
    Object.freeze({ key: 'targetMixTemp', read: (s) => refuseZeroTarget(s.machine.targetMixTemperature) }),
    ...DUPLICATED_QUANTITIES.map((row) => Object.freeze({
        key: row.quantity,
        read: (s, held) => readThroughSource(s, row.quantity, held[row.quantity]),
        duplicated: true,
        quantity: row.quantity,
    })),
]);

/**
 * The two channels that carry the vertical-step anchor, and therefore the only two with an x
 * array of their own. Everything else is aligned to `axis.t`.
 */
const STEPPED_CHANNELS = Object.freeze([
    Object.freeze({ key: 'targetPressure', read: (s) => s.machine.targetPressure }),
    Object.freeze({ key: 'targetFlow', read: (s) => s.machine.targetFlow }),
]);

/** Every channel a derivation carries, in a fixed order so callers can iterate. */
export const SERIES_KEYS = Object.freeze([
    ...MEASURED_CHANNELS.map((row) => row.key),
    ...STEPPED_CHANNELS.map((row) => row.key),
]);

const QUANTITY_KEYS = Object.freeze(DUPLICATED_QUANTITIES.map((row) => row.quantity));

/** Every quantity still undecided, so the B6 choice is made from evidence and then held. */
function anyUndecided(held) {
    return QUANTITY_KEYS.some((quantity) => held[quantity] === SOURCE.NONE);
}

export function chooseByCoverage({ estimator = 0, derived = 0 } = {}) {
    if (estimator === 0 && derived === 0) return SOURCE.NONE;
    return estimator >= derived ? SOURCE.ESTIMATOR : SOURCE.DERIVED;
}

function noSources() {
    return Object.fromEntries(QUANTITY_KEYS.map((quantity) => [quantity, SOURCE.NONE]));
}

function emptySeries() {
    const series = {};
    for (const key of SERIES_KEYS) series[key] = { x: [], y: [] };
    return series;
}

function frozenEmptySeries() {
    const series = emptySeries();
    for (const key of SERIES_KEYS) {
        series[key] = Object.freeze({ x: Object.freeze([]), y: Object.freeze([]) });
    }
    return Object.freeze(series);
}

/** The shape a caller gets for a record with no shot in it. Never a chart of zeroes. */
export function emptyShotDerivation(reason = 'noSamples') {
    return Object.freeze({
        ok: false,
        reason,
        shotId: null,
        phase: null,
        open: false,
        joinedLate: false,
        sources: Object.freeze(noSources()),
        sourcesHeldBy: null,
        axis: Object.freeze({
            t: Object.freeze([]),
            stampMs: Object.freeze([]),
            originMs: null,
            originRule: ORIGIN_RULE.NONE,
        }),
        counts: Object.freeze({ samples: 0, inShot: 0, unplaceable: 0, beforeOrigin: 0 }),
        availability: Object.freeze({ scale: false, volume: false, sensors: false, weightRebased: false }),
        series: frozenEmptySeries(),
        stepMarks: Object.freeze([]),
        phases: Object.freeze({ preinfusion: null, extraction: null, total: null }),
        scalars: Object.freeze({
            durationSeconds: null,
            dose: null,
            doseSource: null,
            yield: null,
            yieldSource: null,
            ratio: null,
            timeToFirstDrop: null,
            averageFlow: null,
            peakFlowAfterFirstDrop: null,
            peakPressure: null,
            averagePressure: null,
            enjoyment: null,
        }),
        lastSample: null,
    });
}

/* ═════════════════════════════════════════════════════════════════ series arithmetic */

const finite = (value) => typeof value === 'number' && Number.isFinite(value);

/** Mean of the plottable values in `[from, to]` that pass `keep`. Null when there are none. */
function meanOver(ys, from, to, keep) {
    let sum = 0;
    let n = 0;
    for (let i = from; i <= to; i += 1) {
        const y = ys[i];
        if (!finite(y)) continue;
        if (keep && !keep(y, i)) continue;
        sum += y;
        n += 1;
    }
    return n ? sum / n : null;
}

/** Largest plottable value in `[from, to]`, or null. */
function maxOver(ys, from, to, keep) {
    let best = null;
    for (let i = from; i <= to; i += 1) {
        const y = ys[i];
        if (!finite(y)) continue;
        if (keep && !keep(y, i)) continue;
        if (best === null || y > best) best = y;
    }
    return best;
}

function minMaxOver(ys, from, to) {
    let min = null;
    let max = null;
    for (let i = from; i <= to; i += 1) {
        const y = ys[i];
        if (!finite(y)) continue;
        if (min === null || y < min) min = y;
        if (max === null || y > max) max = y;
    }
    return min === null ? null : { min, max };
}

function firstReading(ys, from, to) {
    for (let i = from; i <= to; i += 1) if (finite(ys[i])) return ys[i];
    return null;
}

function lastReading(ys, from, to) {
    for (let i = to; i >= from; i -= 1) if (finite(ys[i])) return ys[i];
    return null;
}

const cumulativeAt = (ys, index) => (index < 0 ? null : lastReading(ys, 0, index));

/* ═══════════════════════════════════════════════════════════════════════ the one walk */

export function createShotDerivationVisitor({ record = null } = {}) {
    const stored = readStoredShot(record);
    const sensorIds = record ? storedShotSensors(record) : null;
    const ids = sensorIds
        ? { estimatorId: sensorIds.estimatorId, milkProbeId: sensorIds.milkProbeId }
        : {};

    const series = emptySeries();
    const t = [];
    const stampMs = [];
    const stepMarks = [];
    const measuredY = MEASURED_CHANNELS.map((row) => series[row.key].y);
    const twins = MEASURED_CHANNELS
        .map((row, index) => (row.duplicated
            ? { index, quantity: row.quantity, estimator: [], derived: [], counts: { estimator: 0, derived: 0 } }
            : null))
        .filter(Boolean);
    const stepped = STEPPED_CHANNELS.map((row) => ({ row, out: series[row.key], last: null }));

    let held = noSources();
    let heldBy = null;
    let ctx = null;
    let frame = null;
    let firstPourIndex = -1;
    let sawScale = false;
    let sawVolume = false;
    let sawSensors = false;
    let settledWeight = null;
    let lastAddressed = null;
    let volumeAccum = 0;
    let volumeAtSeconds = null;
    let volumeLastFlow = null;
    const counts = { samples: 0, inShot: 0, unplaceable: 0, beforeOrigin: 0 };

    return {
        start(context) {
            ctx = context;
            // B6: the buffer's held decision wins where there is one. The derivation makes the
            // decision itself ONLY when nothing else did — a recorded shot has no selector —
            // and it uses the same `chooseSource`, held once, so there are not two rules.
            if (context && context.sources) {
                held = { ...noSources(), ...context.sources };
                heldBy = 'buffer';
            } else {
                heldBy = 'derivation';
            }
        },

        sample(entry, position) {
            counts.samples += 1;
            const addressed = readStoredMeasurement(entry, ids);
            lastAddressed = addressed;

            if (hasReading(addressed.scale.weight)) {
                sawScale = true;
                settledWeight = addressed.scale.weight;
            } else if (addressed.scale.ok) {
                sawScale = true;
            }
            if (addressed.sensorsRecorded) sawSensors = true;
            if (hasReading(addressed.volume)) sawVolume = true;

            const machine = addressed.machine;
            if (!isPouring(machine.state, machine.substate)) return;
            if (position.seconds === null) {
                // No readable stamp: not plottable, and never given a made-up one (B4).
                counts.unplaceable += 1;
                return;
            }
            if (position.seconds < 0) {
                counts.beforeOrigin += 1;
                return;
            }

            if (heldBy === 'derivation' && anyUndecided(held)) {
                for (const quantity of QUANTITY_KEYS) {
                    if (held[quantity] !== SOURCE.NONE) continue;
                    held[quantity] = chooseSource(addressed, quantity);
                }
            }

            const index = t.length;
            const seconds = position.seconds;
            t.push(seconds);
            stampMs.push(position.stampMs);
            counts.inShot += 1;

            if (firstPourIndex === -1 && POURED.has(machine.substate)) firstPourIndex = index;

            const atBoundary = hasReading(machine.profileFrame) && machine.profileFrame !== frame;
            if (atBoundary) {
                frame = machine.profileFrame;
                stepMarks.push(Object.freeze({
                    t: seconds,
                    frame,
                    name: stored.workflow.stepNames && frame >= 0
                        && frame < stored.workflow.stepNames.length
                        ? stored.workflow.stepNames[frame]
                        : null,
                }));
            }

            for (let i = 0; i < stepped.length; i += 1) {
                const slot = stepped[i];
                // Rule 1: repeat the OUTGOING target at the boundary's x, then write the
                // incoming one at the same x. Guarded per channel — the old builder gated both
                // on the pressure target alone, so a flow-only step never stepped.
                if (atBoundary && slot.last !== null) {
                    slot.out.x.push(seconds);
                    slot.out.y.push(slot.last);
                }
                const value = toPlot(slot.row.read(addressed));
                slot.out.x.push(seconds);
                slot.out.y.push(value);
                slot.last = value;
            }

            let forChannels = addressed;
            if (hasReading(addressed.volume)) {
                volumeAccum = addressed.volume;
            } else {
                if (volumeAtSeconds !== null && hasReading(volumeLastFlow)) {
                    volumeAccum += volumeLastFlow * (seconds - volumeAtSeconds);
                }
                forChannels = { ...addressed, volume: volumeAccum };
            }
            volumeAtSeconds = seconds;
            volumeLastFlow = machine.flow;

            for (let i = 0; i < MEASURED_CHANNELS.length; i += 1) {
                measuredY[i].push(toPlot(MEASURED_CHANNELS[i].read(forChannels, held)));
            }

            for (const twin of twins) {
                const fromEstimator = readThroughSource(forChannels, twin.quantity, SOURCE.ESTIMATOR);
                const fromDerived = readThroughSource(forChannels, twin.quantity, SOURCE.DERIVED);
                if (hasReading(fromEstimator)) twin.counts.estimator += 1;
                if (hasReading(fromDerived)) twin.counts.derived += 1;
                twin.estimator.push(toPlot(fromEstimator));
                twin.derived.push(toPlot(fromDerived));
            }
        },

        finish() {
            const inShot = t.length;
            if (!inShot) return emptyShotDerivation(counts.samples ? 'noPouringSample' : 'noSamples');

            if (heldBy === 'derivation') {
                for (const twin of twins) {
                    const chosen = chooseByCoverage(twin.counts);
                    held[twin.quantity] = chosen;
                    if (chosen === SOURCE.NONE) continue;
                    const source = chosen === SOURCE.ESTIMATOR ? twin.estimator : twin.derived;
                    const out = measuredY[twin.index];
                    for (let i = 0; i < out.length; i += 1) out[i] = source[i];
                }
            }

            const last = inShot - 1;
            for (const key of SERIES_KEYS) series[key].y = Object.freeze(series[key].y);
            for (const row of MEASURED_CHANNELS) series[row.key].x = t;
            for (const slot of stepped) slot.out.x = Object.freeze(slot.out.x);

            const weightY = series.weight.y;
            const volumeY = series.volume.y;
            const flowY = series.flow.y;
            const pressureY = series.pressure.y;
            const tempY = series.groupTemp.y;

            // The preinfusion / extraction split. `piEnd` is the sample BEFORE the first
            // pouring tick, so preinfusion metrics do not include it.
            //   * no pouring sample at all  -> the whole shot is preinfusion (an aborted pour).
            //   * pouring from sample zero  -> there was no preinfusion; extraction is the shot.
            const piEnd = firstPourIndex === -1 ? last : firstPourIndex - 1;
            const exStart = firstPourIndex === -1 ? -1 : firstPourIndex;

            const annotatedYield = stored.annotations.actualYield;
            const finalWeight = hasReading(annotatedYield) ? annotatedYield : settledWeight;
            const yieldSource = hasReading(annotatedYield)
                ? 'annotation'
                : (finite(settledWeight) ? 'observed' : null);

            const phaseRow = (from, to) => Object.freeze({
                fromIndex: from,
                toIndex: to,
                seconds: t[to] - t[from],
                weight: cumulativeAt(weightY, to),
                volume: cumulativeAt(volumeY, to),
                groupTemp: Object.freeze(minMaxOver(tempY, from, to)),
                flow: Object.freeze({
                    start: firstReading(flowY, from, to),
                    peak: maxOver(flowY, from, to),
                    end: lastReading(flowY, from, to),
                }),
                pressure: Object.freeze({
                    start: firstReading(pressureY, from, to),
                    peak: maxOver(pressureY, from, to),
                    end: lastReading(pressureY, from, to),
                }),
            });

            const piRow = piEnd >= 0 ? phaseRow(0, piEnd) : null;
            const extraction = exStart >= 0 ? phaseRow(exStart, last) : null;
            const totalVolume = cumulativeAt(volumeY, last);
            const piVolume = piRow ? piRow.volume : null;

            // The settled-final-weight rule: attribute drip-down after pump stop to extraction,
            // so preinfusion + extraction == total exactly.
            const piWeight = piRow ? piRow.weight : null;

            const peakFromLow = (ys, endIndex) => {
                const stop = Math.min(endIndex, ys.length - 1);
                let loIdx = -1;
                let lo = null;
                for (let i = 0; i <= stop; i += 1) {
                    if (finite(ys[i]) && (lo === null || ys[i] <= lo)) { lo = ys[i]; loIdx = i; }
                }
                if (loIdx === -1) return null;
                let peak = null;
                for (let i = loIdx; i <= stop; i += 1) {
                    if (finite(ys[i]) && (peak === null || ys[i] > peak)) peak = ys[i];
                }
                return peak;
            };

            const minFrom = (ys, startIndex) => {
                let lo = null;
                for (let i = startIndex; i < ys.length; i += 1) {
                    if (finite(ys[i]) && (lo === null || ys[i] < lo)) lo = ys[i];
                }
                return lo;
            };

            const BOUNDARY_TARE_DROP_G = 0.5;

            const piPeak = piEnd >= 0 ? peakFromLow(weightY, piEnd) : null;
            const exMin = exStart >= 0 ? minFrom(weightY, exStart) : null;
            const boundaryTare = finite(piPeak) && finite(exMin)
                && (piPeak - exMin) > BOUNDARY_TARE_DROP_G;

            const weightRebased = boundaryTare;

            let preinfusion = piRow;
            let exWeight;

            if (exStart < 0) {
                /* Still inside the ignored frames: there is no extraction yet, and the
                 * preinfusion figure is the live climb. Total tracks it, because that is
                 * what is in the cup. */
                preinfusion = piRow ? Object.freeze({ ...piRow, weight: piPeak }) : null;
                exWeight = null;
            } else if (boundaryTare) {
                preinfusion = piRow ? Object.freeze({ ...piRow, weight: piPeak }) : null;
                exWeight = finite(finalWeight) ? finalWeight : null;
            } else {
                /* No tare (N = 0): one reference frame throughout, so the original split
                 * stands and pi + ex == total still holds. */
                exWeight = finite(finalWeight)
                    ? (preinfusion ? (finite(piWeight) ? finalWeight - piWeight : null) : finalWeight)
                    : null;
            }

            const exVolume = finite(totalVolume)
                ? (preinfusion ? (finite(piVolume) ? totalVolume - piVolume : null) : totalVolume)
                : null;

            const totalWeight = boundaryTare
                ? (finite(piPeak) ? piPeak : 0) + (finite(exWeight) ? exWeight : 0)
                : (finite(finalWeight) ? finalWeight : null);

            const total = Object.freeze({
                ...phaseRow(0, last),
                weight: totalWeight,
                volume: totalVolume,
            });

            let firstDrop = null;
            for (let i = 0; i <= last; i += 1) {
                if (finite(weightY[i]) && weightY[i] >= FIRST_DROP_G) { firstDrop = t[i]; break; }
            }
            const afterFirstDrop = (_y, i) => firstDrop === null || t[i] >= firstDrop;

            const dose = shotDose(stored);
            const doseValue = finite(dose.value) ? dose.value : null;
            const yieldValue = finite(finalWeight) ? finalWeight : null;
            const enjoyment = stored.annotations.enjoyment;

            return Object.freeze({
                ok: true,
                reason: null,
                shotId: ctx && ctx.shotId !== undefined ? ctx.shotId
                    : (typeof stored.id === 'string' ? stored.id : null),
                phase: ctx ? ctx.phase ?? null : null,
                open: ctx ? !!ctx.open : false,
                joinedLate: ctx ? !!ctx.joinedLate : false,
                sources: Object.freeze({ ...held }),
                sourcesHeldBy: heldBy,
                axis: Object.freeze({
                    t: Object.freeze(t),
                    stampMs: Object.freeze(stampMs),
                    originMs: ctx ? ctx.originMs ?? null : null,
                    originRule: ctx ? ctx.originRule ?? ORIGIN_RULE.NONE : ORIGIN_RULE.NONE,
                }),
                counts: Object.freeze({ ...counts }),
                availability: Object.freeze({
                    scale: sawScale,
                    volume: sawVolume,
                    sensors: sawSensors,
                    /** The scale was re-zeroed inside this buffer, so the phase weights are
                     *  absent even though the channel is present. See the split above. */
                    weightRebased,
                }),
                series: Object.freeze(Object.fromEntries(
                    SERIES_KEYS.map((key) => [key, Object.freeze(series[key])]),
                )),
                stepMarks: Object.freeze(stepMarks),
                phases: Object.freeze({
                    preinfusion,
                    extraction: extraction
                        ? Object.freeze({ ...extraction, weight: exWeight, volume: exVolume })
                        : null,
                    total,
                }),
                scalars: Object.freeze({
                    durationSeconds: t[last] - t[0],
                    dose: doseValue,
                    doseSource: dose.source,
                    yield: yieldValue,
                    yieldSource,
                    ratio: doseValue !== null && yieldValue !== null && doseValue > 0
                        ? yieldValue / doseValue
                        : null,
                    timeToFirstDrop: firstDrop,
                    // Bounded to the part of the shot that was actually pouring.
                    averageFlow: meanOver(flowY, 0, last, (y, i) => afterFirstDrop(y, i) && y >= POURING_ML_S),
                    // Peak flow AFTER first drop: the raw peak is usually the pump filling an
                    // empty puck, which says nothing about the extraction.
                    peakFlowAfterFirstDrop: maxOver(flowY, 0, last, afterFirstDrop),
                    peakPressure: maxOver(pressureY, 0, last),
                    averagePressure: meanOver(pressureY, 0, last, afterFirstDrop),
                    /** ReaPrime's own rating, not a skin-local key-value orphan. */
                    enjoyment: hasReading(enjoyment) ? enjoyment : null,
                }),
                lastSample: lastAddressed,
            });
        },
    };
}

function runVisitors(samples, visitors, context) {
    const list = Array.isArray(visitors) ? visitors : [visitors];
    for (const visitor of list) if (visitor.start) visitor.start(context);
    for (let i = 0; i < samples.length; i += 1) {
        const entry = samples[i];
        const stamp = sampleStampMs(entry);
        const stamped = typeof stamp === 'number';
        for (const visitor of list) {
            visitor.sample(entry, {
                index: i,
                stampMs: stamped ? stamp : null,
                seconds: stamped && context.originMs !== null ? (stamp - context.originMs) / 1000 : null,
            }, context);
        }
    }
    return list.map((visitor) => (visitor.finish ? visitor.finish(context) : undefined));
}

export function deriveFromBuffer(buffer, { record = null, visitors = [] } = {}) {
    if (!buffer || typeof buffer.walk !== 'function') {
        throw new Error('shot-derivation: deriveFromBuffer needs a shot buffer');
    }
    const derivation = createShotDerivationVisitor({ record });
    const { results } = buffer.walk([derivation, ...visitors]);
    return results[0];
}

export function deriveFromRecord(record, { visitors = [] } = {}) {
    const stored = readStoredShot(record);
    if (!stored.ok) return emptyShotDerivation('notAShotRecord');
    if (!stored.hasMeasurements) return emptyShotDerivation('measurementsNotServed');
    const samples = stored.measurements;
    const origin = chooseOrigin(samples);
    const derivation = createShotDerivationVisitor({ record });
    const results = runVisitors(samples, [derivation, ...visitors], Object.freeze({
        shotId: typeof stored.id === 'string' ? stored.id : null,
        phase: null,
        open: false,
        joinedLate: false,
        // A recorded shot has no live selector; the derivation makes the B6 choice from the
        // shot's own first evidence and holds it, which is the same rule the buffer applies.
        sources: null,
        sampleCount: samples.length,
        originMs: origin.originMs,
        originRule: origin.rule,
    }));
    return results[0];
}

/* ═════════════════════════════════════════════════════════════════════ series helpers */

export function shiftSeriesX(series, offset) {
    if (!offset) return series;
    return { x: series.x.map((value) => value + offset), y: series.y };
}

export function indexAtTime(xs, t) {
    if (!xs || !xs.length) return -1;
    let lo = 0;
    let hi = xs.length - 1;
    if (t <= xs[lo]) return lo;
    if (t >= xs[hi]) return hi;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (xs[mid] <= t) lo = mid; else hi = mid;
    }
    return (t - xs[lo] <= xs[hi] - t) ? lo : hi;
}
