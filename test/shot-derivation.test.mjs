// GATE 6 — the ONE derivation, over the live buffer and over a stored record.
//
// The gate's whole claim is that there is one walk and one set of rules, reached by two
// entry points: `deriveFromBuffer` rides the buffer's own single traversal, and
// `deriveFromRecord` mirrors that loop over `GET /api/v1/shots/<id>`. The test that both
// paths agree is what keeps that honest, and it is the centrepiece here.
//
// What else is pinned, all of it a rule the bench or the contract taught:
//
//   * A7 — nothing is substituted, integrated or guessed. A refused record says WHY
//     ('notAShotRecord', 'measurementsNotServed', 'noPouringSample'), and a meta-only
//     payload is never drawn as an empty shot.
//   * The preinfusion / extraction split, and the SETTLED-WEIGHT rule that makes
//     preinfusion + extraction == total exactly — drip-down after the pump stops is
//     attributed to extraction, which is why the settled weight is taken from EVERY
//     sample and not only the in-shot ones.
//   * The scalars are bounded to the part of the shot that was actually pouring: peak
//     flow AFTER first drop, because the raw peak is usually the pump filling an empty
//     puck and says nothing about the extraction.
//   * A target of ZERO is not a target (the firmware sentinel), and a stamp that cannot
//     be read is UNPLACEABLE — counted, never given a made-up one (B4).
//
// AND THE FIXTURES ARE RECORDINGS. The second half of this file walks the three real shot
// bodies in `tools/rea-fixtures/` rather than more samples of my own construction: a
// hand-built row can only contain what its author already believed, and every one of those
// recordings carries `machine.weight` — the key `633f6f68` deleted — at a couple of hundred
// grams. A derivation that kept the old machine-vs-scale gravimetric branch would report that
// as a yield off a real file, and nothing built by hand here would ever have shown it.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    FIRST_DROP_G,
    POURING_ML_S,
    SERIES_KEYS,
    deriveFromBuffer,
    deriveFromRecord,
    emptyShotDerivation,
    indexAtTime,
    shiftSeriesX,
} from '../src/lib/shot-derivation.js';
import { createShotBuffer } from '../src/stores/shot-buffer.js';
import { readShotStateFrame, SHOT_STATE } from '../src/stores/feed-readers.js';
import { ORIGIN_RULE } from '../src/stores/time-axis.js';
import {
    SOURCE,
    DUPLICATED_QUANTITIES,
    chooseSources,
} from '../src/stores/shot-source-selector.js';
import { readStoredMeasurement } from '../src/data/rea-address.js';
import { SENSOR_ID_SUFFIX } from '../src/data/rea-names.js';

const SHOT = '7f6f1e2a-0000-4000-8000-0000000000aa';
const base = Date.parse('2026-08-17T09:15:00.000Z');
const at = (ms) => new Date(base + ms).toISOString();

/** One `measurements[]` row, in the shape `MachineSnapshot.toJson` writes. */
function sample(ms, {
    substate = 'pouring',
    pressure = 9,
    flow = 2,
    weight = null,
    frame = 0,
    targetGroupTemperature = 88,
    groupTemperature = 92,
    volume,
    stamped = true,
} = {}) {
    const row = {
        machine: {
            timestamp: stamped ? at(ms) : undefined,
            state: { state: 'espresso', substate },
            flow,
            pressure,
            targetFlow: 2,
            targetPressure: 9,
            mixTemperature: 90,
            groupTemperature,
            targetMixTemperature: 92,
            targetGroupTemperature,
            profileFrame: frame,
            steamTemperature: 140,
        },
        scale: {
            timestamp: stamped ? at(ms) : null,
            weight,
            weightFlow: weight === null ? null : 1.4,
            battery: 80,
            timerValue: ms,
        },
    };
    if (volume !== undefined) row.volume = volume;
    return row;
}

/**
 * A shot: two preparing samples the filter must drop, two preinfusion samples, four
 * pouring samples with a step boundary in the middle, and a settled weight after the
 * pump stops.
 */
const MEASUREMENTS = [
    sample(-2000, { substate: 'preparingForShot', pressure: 0, flow: 0 }),
    sample(-1000, { substate: 'preparingForShot', pressure: 1, flow: 0.1 }),
    sample(0, { substate: 'preinfusion', pressure: 2, flow: 0.1, weight: 0, frame: 0, volume: 0 }),
    sample(1000, { substate: 'preinfusion', pressure: 4, flow: 0.1, weight: 0.2, frame: 0, volume: 1 }),
    sample(2000, { substate: 'pouring', pressure: 9, flow: 2.4, weight: 0.9, frame: 1, volume: 4 }),
    sample(3000, { substate: 'pouring', pressure: 8.6, flow: 2.1, weight: 12, frame: 1, volume: 12 }),
    sample(4000, { substate: 'pouring', pressure: 8.2, flow: 1.9, weight: 24, frame: 1, volume: 24 }),
    sample(5000, { substate: 'pouring', pressure: 2, flow: 0.1, weight: 35, frame: 1, volume: 35 }),
];

const RECORD = {
    id: SHOT,
    timestamp: at(0),
    stopReason: 'weight',
    workflow: {
        context: { targetDoseWeight: 18, targetYield: 36 },
        profile: { title: 'Bench', steps: [{ name: 'Preinfuse' }, { name: 'Extract' }] },
    },
    annotations: { actualDoseWeight: 18.2, actualYield: 36.4, enjoyment: 80 },
    measurements: MEASUREMENTS,
};

const shotStateFrame = (state) => readShotStateFrame({
    event: 'state',
    timestamp: at(0),
    shotId: SHOT,
    state,
    machineState: 'espresso',
    machineSubstate: 'preinfusion',
    profileFrame: 0,
    scaleConnected: true,
    scaleLost: false,
    machineHasAutonomousSAW: true,
    decision: null,
});

describe('a record that is not a shot is REFUSED, and says why', () => {
    test('the three refusals are distinct reasons, never an empty chart', () => {
        assert.equal(deriveFromRecord(null).reason, 'notAShotRecord');
        assert.equal(deriveFromRecord('nope').reason, 'notAShotRecord');
        assert.equal(deriveFromRecord({ id: SHOT }).reason, 'measurementsNotServed',
            'a meta-only payload — a list row, /shots/latest — is a record whose samples were '
            + 'never sent, which is not the same thing as a shot with no samples');
        assert.equal(deriveFromRecord({ id: SHOT, measurements: [] }).reason, 'noSamples');
        assert.equal(
            deriveFromRecord({ id: SHOT, measurements: [sample(0, { substate: 'preparingForShot' })] }).reason,
            'noPouringSample',
        );
    });

    test('a refusal carries the whole shape, so a screen never reads undefined', () => {
        const empty = deriveFromRecord(null);
        assert.equal(empty.ok, false);
        assert.deepEqual([...empty.axis.t], []);
        assert.equal(empty.axis.originRule, ORIGIN_RULE.NONE);
        assert.equal(empty.scalars.yield, null);
        assert.deepEqual(Object.keys(empty.series).sort(), [...SERIES_KEYS].sort());
        assert.deepEqual(empty, emptyShotDerivation('notAShotRecord'));
    });
});

describe('the trace ends where the pump does (Ben, 25 August 2026)', () => {
    /* "We should copy Slate, shouldn't record pouringDone." Slate's chart filter is
     * ['preinfusion', 'pouring'] and nothing else, so the drip-down after the pump stops is
     * not plotted. What it must NOT change is the weight: `settledWeight` is read from
     * every sample and not only the in-shot ones, which is what makes
     * preinfusion + extraction == total. */
    const withTail = [
        sample(0, { substate: 'preinfusion', pressure: 1, flow: 1, weight: 0, frame: 0, volume: 0 }),
        sample(1000, { substate: 'pouring', pressure: 6, flow: 2, weight: 10, frame: 1, volume: 10 }),
        sample(2000, { substate: 'pouring', pressure: 6, flow: 2, weight: 30, frame: 1, volume: 30 }),
        sample(3000, { substate: 'pouringDone', pressure: 2, flow: 0.1, weight: 36, frame: 1, volume: 36 }),
        sample(4000, { substate: 'pouringDone', pressure: 0, flow: 0, weight: 36.4, frame: 1, volume: 36 }),
    ];

    test('a pouringDone sample is walked and not plotted', () => {
        const d = deriveFromRecord({ ...RECORD, measurements: withTail });
        assert.equal(d.counts.samples, 5, 'every sample is still walked');
        assert.equal(d.counts.inShot, 3, 'three are recorded — the two tail samples are not');
        assert.equal(d.axis.t.length, 3);
        assert.equal(d.axis.t[d.axis.t.length - 1], 2, 'the trace ends at the last pouring sample');
    });

    test('and the settled weight is still read from the tail', () => {
        const d = deriveFromRecord({ ...RECORD, measurements: withTail });
        /* 36.4 arrives on a sample the chart does not draw. Dropping the substate from the
         * PLOT must not drop it from the WEIGHT — the yield is the settled number, and the
         * settling happens after the pump stops. */
        assert.equal(d.phases.total.weight, 36.4);
        const parts = d.phases.preinfusion.weight + d.phases.extraction.weight;
        assert.ok(Math.abs(parts - d.phases.total.weight) < 1e-9,
            `preinfusion + extraction (${parts}) must equal total (${d.phases.total.weight})`);
    });
});

describe('the axis: the origin is the first POURING sample, and only in-shot samples land', () => {
    const got = deriveFromRecord(RECORD);

    test('preparation is dropped and the clock starts at the first pouring substate', () => {
        assert.equal(got.ok, true);
        assert.equal(got.axis.originRule, ORIGIN_RULE.FIRST_POURING);
        assert.equal(got.counts.samples, 8, 'every sample is visited exactly once');
        assert.equal(got.counts.inShot, 6, 'the two preparingForShot rows are not in the shot');
        assert.deepEqual([...got.axis.t], [0, 1, 2, 3, 4, 5],
            'preinfusion IS pouring for the filter, and it is where t=0 sits');
    });

    test('every measured channel shares the axis, by reference', () => {
        assert.equal(got.series.pressure.x, got.axis.t);
        assert.equal(got.series.flow.y.length, got.axis.t.length);
    });

    test('an unreadable stamp is UNPLACEABLE — counted, never given a made-up one (B4)', () => {
        const withNoStamp = deriveFromRecord({
            ...RECORD,
            measurements: [...MEASUREMENTS, sample(6000, { stamped: false })],
        });
        assert.equal(withNoStamp.counts.unplaceable, 1);
        assert.equal(withNoStamp.counts.inShot, 6, 'and it does not reach the series');
    });
});

describe('the stepped channels carry the vertical boundary', () => {
    const got = deriveFromRecord(RECORD);

    test('a step mark is named from the workflow, and only the profile can name it', () => {
        assert.deepEqual(got.stepMarks.map((m) => [m.t, m.frame, m.name]), [
            [0, 0, 'Preinfuse'],
            [2, 1, 'Extract'],
        ]);
        const unnamed = deriveFromRecord({ ...RECORD, workflow: { context: {} } });
        assert.deepEqual(unnamed.stepMarks.map((m) => m.name), [null, null],
            'a record with no profile still produces marks — the boundary is a fact about the '
            + 'machine\'s profileFrame — they simply have no name');
    });

    test('the OUTGOING target is repeated at the boundary\'s x, so the step is vertical', () => {
        const target = got.series.targetPressure;
        assert.equal(target.x.length, target.y.length);
        assert.equal(target.x.filter((v) => v === 2).length, 2,
            'two points at t=2: the outgoing value and the incoming one');
        assert.ok(target.x.length > got.axis.t.length,
            'which is why the stepped channels are the only two with an x array of their own');
    });

    test('the guard is PER CHANNEL — a flow-only step still steps', () => {
        assert.equal(
            got.series.targetFlow.x.filter((v) => v === 2).length, 2,
            'the old builder gated both on the pressure target alone, so a flow-only step never stepped',
        );
    });
});

describe('the phase table and the settled-weight rule', () => {
    const { phases, scalars } = deriveFromRecord(RECORD);

    test('preinfusion ends at the sample BEFORE the first pouring tick', () => {
        assert.equal(phases.preinfusion.fromIndex, 0);
        assert.equal(phases.preinfusion.toIndex, 1);
        assert.equal(phases.extraction.fromIndex, 2);
        assert.equal(phases.total.seconds, 5);
    });

    test('preinfusion + extraction == total, exactly', () => {
        assert.equal(phases.preinfusion.weight + phases.extraction.weight, phases.total.weight);
        assert.equal(phases.total.weight, 36.4, 'the annotated yield wins over the last observation');
        assert.equal(phases.preinfusion.volume + phases.extraction.volume, phases.total.volume);
    });

    test('a phase reports start / peak / end for the two instantaneous channels', () => {
        assert.deepEqual(phases.extraction.pressure, { start: 9, peak: 9, end: 2 });
        assert.deepEqual(phases.extraction.flow, { start: 2.4, peak: 2.4, end: 0.1 });
        assert.deepEqual(phases.preinfusion.groupTemp, { min: 92, max: 92 });
    });

    test('with no annotated yield the OBSERVED settled weight is used, and it says which', () => {
        const observed = deriveFromRecord({ ...RECORD, annotations: { actualDoseWeight: 18.2 } });
        assert.equal(observed.scalars.yieldSource, 'observed');
        assert.equal(observed.scalars.yield, 35, 'the last weight the scale reported');
        assert.equal(scalars.yieldSource, 'annotation', 'and the annotated one is NOT the same source');
    });

    /**
     * THE TARE, AND THE NUMBER THAT CANNOT EXIST.
     *
     * The ordinary workflow is cup on the platform, tare, pull — so a buffer that opened
     * before the tare holds the CUP's weight in its early samples, and `piEnd` (the sample
     * before the first pouring tick) lands on the wrong side of the re-zero. Measured on
     * the 15 Hz loop proof over the 2026-08-15 recording: preinfusion 181.6 g, extraction
     * −159.9 g, total 21.7 g — rendered in the foot band at both geometries, with the
     * suite green because the rendered cells and gate 6 agreed. They agreed on a negative
     * mass of coffee. The subtraction is only meaningful inside one reference frame, and
     * a tare is a new one.
     */
    test('a boundary tare splits the weights across two reference frames, never negative', () => {
        const tared = deriveFromRecord({
            ...RECORD,
            // No annotated yield: the settled observation is the reference the guard uses.
            annotations: { actualDoseWeight: 18.2 },
            measurements: [
                // The cup, on the platform, before anyone pressed Tare.
                sample(0, { substate: 'preinfusion', pressure: 2, flow: 0.1, weight: 181.6875, volume: 0 }),
                sample(1000, { substate: 'preinfusion', pressure: 4, flow: 0.1, weight: 181.6875, volume: 1 }),
                // Tare, then the pour.
                sample(2000, { substate: 'pouring', pressure: 9, flow: 2.4, weight: 0, frame: 1, volume: 4 }),
                sample(3000, { substate: 'pouring', pressure: 8.6, flow: 2.1, weight: 12, frame: 1, volume: 12 }),
                sample(4000, { substate: 'pouring', pressure: 2, flow: 0.1, weight: 21.7, frame: 1, volume: 24 }),
            ],
        });

        assert.equal(tared.availability.scale, true, 'the channel is present — this is not "no scale"');
        assert.equal(tared.availability.weightRebased, true,
            'the derivation saw the boundary tare');

        /* IT USED TO BLANK BOTH ROWS, and Ben saw the result on the glass: "The Weight
         * values are not populating correctly." A dash is not an answer when the machine
         * measured something. The rows are now Slate's own three (2c4fb42): preinfusion
         * is the peak before the tare, extraction is the tracked stop-at-weight with
         * nothing subtracted from it, and Total is the sum — what is physically in the
         * cup.
         *
         * THIS FIXTURE IS THE CASE SLATE ANSWERS IN FIRMWARE, and the number says so.
         * The tare lands at the BOUNDARY, so every preinfusion sample carries the
         * untared cup and there is no low point inside the window to measure the pour
         * from. 181.7 g is the cup, reported as preinfusion, and no arithmetic here can
         * tell it from 181.7 g of water — the two series are identical. Slate's answer
         * is `ben/scale-weight-signed`: a tare at the espresso button (S_HeaterUp entry)
         * so the cup is zeroed BEFORE heat-up. Three tares per shot, each earning its
         * place: button, preinfusion start, frame-N boundary. With that firmware this
         * window carries water and this number is the pour.
         *
         * WHAT THE ALGORITHM DOES DEFEND AGAINST is the tare landing INSIDE the window,
         * which is the ordinary case on the two websockets: the machine snapshot and the
         * scale snapshot are separate feeds, so the first preinfusion frames commonly
         * still carry the pre-tare reading. `peakFromLow` measures from the series' low
         * point, which IS the tare, and discards that head however long it is. */
        assert.equal(tared.phases.preinfusion.weight, 181.6875,
            'preinfusion is the peak reached before the tare, latched');
        assert.equal(tared.phases.extraction.weight, 21.7,
            'extraction is the tracked stop-at-weight — nothing is subtracted from it, so '
            + 'it can never be the -5.0 g this test was written about');
        assert.equal(tared.phases.total.weight, 181.6875 + 21.7,
            'and Total is the sum, so it does not collapse the instant the tare lands');
        // Everything that is not the weight column is untouched by the guard.
        assert.equal(tared.phases.preinfusion.volume + tared.phases.extraction.volume,
            tared.phases.total.volume);
        assert.equal(tared.phases.total.seconds, 4);
    });

    test('the stale pre-tare head is discarded when the tare lands INSIDE preinfusion', () => {
        /* THE CASE THE ALGORITHM IS FOR, and the one the two websockets produce. The
         * firmware tares on entry to PreInfuse, but the machine snapshot and the scale
         * snapshot arrive on SEPARATE sockets, so the first preinfusion frames still
         * carry the PRE-tare reading — the whole cup. Slate measured a ~40 g pour as over
         * 200 g this way (30d394b).
         *
         * The series is [stale-high…, ~0 at the tare, climbing…]. Measuring the peak only
         * from the LOW POINT discards the head without needing to know how many samples
         * it spans, and it is still a peak, so it rides out skew at the far end too. */
        const skewed = deriveFromRecord({
            ...RECORD,
            annotations: { actualDoseWeight: 18.2 },
            measurements: [
                // The cup, still on the pre-tare reading — two frames of skew.
                sample(0, { substate: 'preinfusion', pressure: 2, flow: 0.1, weight: 214.3, volume: 0 }),
                sample(500, { substate: 'preinfusion', pressure: 3, flow: 0.1, weight: 214.3, volume: 1 }),
                // The tare lands, and the real preinfusion pour begins.
                sample(1000, { substate: 'preinfusion', pressure: 4, flow: 0.4, weight: 0.1, volume: 2 }),
                sample(1500, { substate: 'preinfusion', pressure: 4, flow: 0.6, weight: 3.9, volume: 4 }),
                // The boundary tare, then the tracked extraction.
                sample(2000, { substate: 'pouring', pressure: 9, flow: 2.4, weight: 0, frame: 1, volume: 6 }),
                sample(3000, { substate: 'pouring', pressure: 8.6, flow: 2.1, weight: 18, frame: 1, volume: 20 }),
                sample(4000, { substate: 'pouring', pressure: 2, flow: 0.1, weight: 36.2, frame: 1, volume: 30 }),
            ],
        });

        assert.equal(skewed.availability.weightRebased, true, 'the boundary tare was seen');
        assert.equal(skewed.phases.preinfusion.weight, 3.9,
            'the 214.3 g cup is the stale head and is discarded — the pour is 3.9 g');
        assert.equal(skewed.phases.extraction.weight, 36.2,
            'extraction is the stop-at-weight the shot ran to');
        assert.equal(skewed.phases.total.weight, 3.9 + 36.2,
            'and Total is what is in the cup');
    });

    test('an ordinary shot keeps its split: the guard is arithmetic, not a heuristic', () => {
        const observed = deriveFromRecord({ ...RECORD, annotations: { actualDoseWeight: 18.2 } });
        assert.equal(observed.availability.weightRebased, false);
        assert.equal(observed.phases.preinfusion.weight, 0.2);
        assert.equal(observed.phases.extraction.weight, 34.8);
        assert.equal(observed.phases.preinfusion.weight + observed.phases.extraction.weight,
            observed.phases.total.weight);
    });

    test('a shot that never poured is all preinfusion, and one that poured at once has none', () => {
        const aborted = deriveFromRecord({
            ...RECORD,
            measurements: MEASUREMENTS.slice(2, 4),
        });
        assert.equal(aborted.phases.extraction, null, 'an aborted pour is preinfusion end to end');
        assert.ok(aborted.phases.preinfusion);

        const straight = deriveFromRecord({ ...RECORD, measurements: MEASUREMENTS.slice(4) });
        assert.equal(straight.phases.preinfusion, null);
        assert.ok(straight.phases.extraction);
    });
});

describe('the scalars are bounded to the part of the shot that was pouring', () => {
    const { scalars } = deriveFromRecord(RECORD);

    test('dose prefers what went IN over what was asked for, and says which', () => {
        assert.equal(scalars.dose, 18.2);
        assert.equal(scalars.doseSource, 'actual');
        const target = deriveFromRecord({ ...RECORD, annotations: { actualYield: 36.4 } });
        assert.equal(target.scalars.dose, 18);
        assert.equal(target.scalars.doseSource, 'target', 'a ratio from the target is a ratio for a '
            + 'shot nobody pulled — so the caller can SEE which one it got');
    });

    test('the ratio is yield over dose, and absent when either is', () => {
        assert.equal(scalars.ratio, 36.4 / 18.2);
        const noDose = deriveFromRecord({ ...RECORD, annotations: { actualYield: 36.4 }, workflow: {} });
        assert.equal(noDose.scalars.ratio, null, 'never a number computed from a missing half');
    });

    test('time to first drop is the first sample at or over FIRST_DROP_G', () => {
        assert.equal(FIRST_DROP_G, 0.5);
        assert.equal(scalars.timeToFirstDrop, 2, 'weight 0.2 at t=1 is scale noise; 0.9 at t=2 is a drop');
    });

    test('peak flow is taken AFTER first drop, so a pump filling an empty puck is not the peak', () => {
        const spiked = deriveFromRecord({
            ...RECORD,
            measurements: [
                sample(0, { substate: 'preinfusion', flow: 8, pressure: 1, weight: 0 }),
                ...MEASUREMENTS.slice(4),
            ],
        });
        assert.equal(spiked.scalars.peakFlowAfterFirstDrop, 2.4,
            'the 8 mL/s spike before the first drop is the pump, not the extraction');
        assert.ok(spiked.scalars.peakFlowAfterFirstDrop < 8);
    });

    test('the average flow ignores the pause: only samples at or above POURING_ML_S count', () => {
        assert.equal(POURING_ML_S, 0.2);
        const flows = [2.4, 2.1, 1.9];      // 0.1 at t=5 is not pouring
        assert.equal(scalars.averageFlow, flows.reduce((a, b) => a + b) / flows.length,
            'eight seconds at zero flow during preinfusion would otherwise describe the pause');
    });

    test('peak pressure is the whole shot; average pressure starts at first drop', () => {
        assert.equal(scalars.peakPressure, 9);
        assert.equal(scalars.averagePressure, (9 + 8.6 + 8.2 + 2) / 4);
    });

    test('enjoyment is ReaPrime\'s own rating, read through, not a skin-local orphan', () => {
        assert.equal(scalars.enjoyment, 80);
        assert.equal(deriveFromRecord({ ...RECORD, annotations: {} }).scalars.enjoyment, null);
    });
});

describe('a target of ZERO is not a target', () => {
    test('the firmware sentinel is refused on BOTH temperature targets', () => {
        const zeroed = deriveFromRecord({
            ...RECORD,
            measurements: MEASUREMENTS.map((row) => ({
                ...row,
                machine: { ...row.machine, targetGroupTemperature: 0, targetMixTemperature: 0 },
            })),
        });
        assert.ok(zeroed.series.targetTemp.y.every((v) => v === null),
            'a group target of 0 °C would drag the temperature band exactly as far as the mix one');
        assert.ok(zeroed.series.targetMixTemp.y.every((v) => v === null));
    });
});

describe('availability says WHY a channel is empty', () => {
    test('a shot pulled with no scale reports scale: false rather than a flat zero line', () => {
        const noScale = deriveFromRecord({
            ...RECORD,
            measurements: MEASUREMENTS.map((row) => ({ ...row, scale: null })),
        });
        assert.equal(noScale.availability.scale, false);
        assert.equal(noScale.scalars.yield, 36.4, 'the annotation still stands on its own');
        assert.ok(noScale.series.weight.y.every((v) => v === null), 'and the series is a gap, not zeroes');
    });

    test('volume absent live is normal and permanent — the snapshot socket does not carry it', () => {
        const live = deriveFromRecord({
            ...RECORD,
            measurements: MEASUREMENTS.map(({ volume, ...row }) => row),
        });
        assert.equal(live.availability.volume, false);
        assert.equal(live.availability.sensors, false, 'and no sample carried a sensors map');
        assert.equal(deriveFromRecord(RECORD).availability.volume, true);
    });
});

describe('THE ONE DERIVATION: the buffer path and the record path agree', () => {
    /**
     * THE LIVE SHAPE. `addSample` deliberately does not write `volume` — ReaPrime computes
     * it in its recorder and the snapshot socket does not carry it — so the comparison is
     * run over samples in the shape the live path can actually hold. That is not a
     * weakening: `availability.volume` is the channel that says so, and it is asserted
     * below in both directions.
     */
    const LIVE = MEASUREMENTS.map(({ volume, ...row }) => row);
    const LIVE_RECORD = { ...RECORD, measurements: LIVE };

    test('the ONE channel the server does not send live is INTEGRATED, and says which it is', () => {
        /* THIS TEST USED TO PIN AN EMPTY COLUMN. `volume` is a recorder field: the
         * snapshot socket carries none, so the live series was all nulls and the Live
         * band's VOLUME column was blank on every running shot and stayed blank until the
         * shot was stored — Ben, 23 Aug 2026: "the phase is tracking weight well but not
         * tracking volume at all".
         *
         * The old app integrates flow over the samples, live and stored alike
         * (`shotData.js:376-382`), and the two numbers agree to about one part in a
         * hundred on the recorded shot. So the integral fills a sample that carries no
         * volume, the SERVER'S value still wins where there is one, and `availability`
         * goes on reporting which of the two a reader is looking at. */
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.PREHEATING));
        for (const row of MEASUREMENTS) buffer.addSample(row);   // volume offered...

        const live = deriveFromBuffer(buffer, { record: RECORD });
        assert.equal(live.availability.volume, false, '...and not stored: `volume` is a recorder field');
        assert.ok(live.series.volume.y.some((v) => typeof v === 'number'),
            'the live column is drawn from the integral, not left null');
        assert.ok(live.series.volume.y.every((v) => v === null || v >= 0),
            'a volume never goes backwards');

        const stored = deriveFromRecord(RECORD);
        assert.equal(stored.availability.volume, true, 'the stored shot has the server\'s own');
    });

    test('same samples, same answer — series, axis and scalars', () => {
        const buffer = createShotBuffer();
        buffer.noteShotState(shotStateFrame(SHOT_STATE.PREHEATING));
        for (const row of LIVE) buffer.addSample(row);

        const live = deriveFromBuffer(buffer, { record: LIVE_RECORD });
        const stored = deriveFromRecord(LIVE_RECORD);

        assert.equal(live.ok, true);
        assert.deepEqual([...live.axis.t], [...stored.axis.t], 'one time axis, one origin rule');
        assert.equal(live.axis.originRule, stored.axis.originRule);

        /* Both sides are fed LIVE — the same measurements with `volume` removed — because
         * `volume` is the one channel that CANNOT agree: the recorder persists it, the
         * snapshot socket does not carry it, and the buffer stores what it saw rather than
         * integrating flow to fill the gap in (A7). The asymmetry has its own test above;
         * this one is about the derivation, so it is given samples both paths can hold. */
        for (const key of SERIES_KEYS) {
            assert.deepEqual([...live.series[key].y], [...stored.series[key].y], `series ${key} diverged`);
            assert.deepEqual([...live.series[key].x], [...stored.series[key].x], `series ${key} x diverged`);
        }
        assert.deepEqual(live.scalars, stored.scalars, 'the scalars are the same arithmetic');
        assert.deepEqual(live.phases, stored.phases);
        assert.deepEqual(live.stepMarks, stored.stepMarks);
    });

    test('the two paths report their SOURCE decision differently, and that is the point', () => {
        const buffer = createShotBuffer({
            // B6's hook, wired the way live-stores.js wires it: the selector reads an
            // ADDRESSED sample, and the buffer holds what it decided.
            chooseSources: ({ sample }) => chooseSources(readStoredMeasurement(sample)),
        });
        buffer.noteShotState(shotStateFrame(SHOT_STATE.PREHEATING));
        for (const row of LIVE) buffer.addSample(row);

        assert.equal(deriveFromBuffer(buffer).sources.resistance, SOURCE.NONE,
            'neither the estimator nor the gated derived key spoke, and `none` is a real outcome');
        assert.equal(deriveFromBuffer(buffer).sourcesHeldBy, 'buffer',
            'B6: the buffer\'s held decision wins where there is one');
        const unwired = createShotBuffer();
        unwired.noteShotState(shotStateFrame(SHOT_STATE.PREHEATING));
        for (const row of LIVE) unwired.addSample(row);
        assert.equal(deriveFromBuffer(unwired).sourcesHeldBy, 'derivation',
            'and with no selector wired the buffer records a visible hole (sources: null), so the '
            + 'derivation makes the call itself rather than reading a guessed default');
        assert.equal(deriveFromRecord(RECORD).sourcesHeldBy, 'derivation',
            'a recorded shot has no live selector, so the derivation decides from the shot\'s own '
            + 'first evidence — with the same chooseSource, so there are not two rules');
    });

    test('a further visitor rides the SAME pass rather than opening a fourth walk', () => {
        const seen = [];
        const spy = {
            start: (ctx) => seen.push(['start', ctx.originRule]),
            sample: (_entry, position) => seen.push(['sample', position.index, position.seconds]),
            finish: () => 'spy-result',
        };
        const stored = deriveFromRecord(RECORD, { visitors: [spy] });

        assert.equal(stored.ok, true, 'the derivation is still results[0]');
        assert.equal(seen.length, 1 + MEASUREMENTS.length, 'one start and one visit per sample');
        assert.deepEqual(seen[0], ['start', ORIGIN_RULE.FIRST_POURING]);
        assert.deepEqual(seen[3], ['sample', 2, 0], 'and the position carries the shot clock');
    });

    test('deriveFromBuffer refuses anything that is not a buffer', () => {
        assert.throws(() => deriveFromBuffer(null), /needs a shot buffer/);
        assert.throws(() => deriveFromBuffer({}), /needs a shot buffer/);
    });
});

describe('the series helpers a comparison view needs', () => {
    test('shiftSeriesX returns a NEW x array and never mutates the bundle', () => {
        const series = { x: [0, 1, 2], y: [5, 6, 7] };
        const moved = shiftSeriesX(series, 1.5);
        assert.deepEqual(moved.x, [1.5, 2.5, 3.5]);
        assert.deepEqual(series.x, [0, 1, 2], 'both shots are re-read on every redraw — an in-place '
            + 'shift would compound every time the slider moved');
        assert.equal(moved.y, series.y, 'the y column is shared, not copied');
        assert.equal(shiftSeriesX(series, 0), series, 'a zero shift is not a copy at all');
    });

    test('indexAtTime is NEAREST, not floor', () => {
        const xs = [0, 1, 2, 3, 4];
        assert.equal(indexAtTime(xs, 2.4), 2);
        assert.equal(indexAtTime(xs, 2.6), 3, 'a marker half a sample early reads as a misalignment, '
            + 'which is precisely what the alignment control exists to show');
        assert.equal(indexAtTime(xs, 2.5), 2, 'a tie takes the earlier sample');
    });

    test('it clamps at both ends and answers -1 for an empty series', () => {
        const xs = [10, 20, 30];
        assert.equal(indexAtTime(xs, -5), 0);
        assert.equal(indexAtTime(xs, 999), 2);
        assert.equal(indexAtTime([], 1), -1);
        assert.equal(indexAtTime(null, 1), -1);
    });
});

/* ═══════════════════════════════════════════ the recorded corpus, not more built samples */

const FIXTURE_DIR = fileURLToPath(new URL('../tools/rea-fixtures/', import.meta.url));

/**
 * The by-id shot bodies. `/shots/latest` sits in the same directory and is deliberately NOT
 * in this list — `ShotsHandler._getLatestShot` answers `toJsonWithoutMeasurements()`, so a
 * body with no measurements is that route's correct shape rather than a short recording, and
 * it is asserted on its own terms below.
 */
const RECORDED = readdirSync(FIXTURE_DIR)
    .filter((name) => name.startsWith('api__v1__shots__') && !name.includes('latest') && !name.includes('~'))
    .sort()
    .map((name) => ({ name, body: JSON.parse(readFileSync(FIXTURE_DIR + name, 'utf8')) }));

describe('the recorded shots, walked as they came off the bench', () => {
    test('there are recordings to walk, and they are real shots', () => {
        assert.equal(RECORDED.length, 3, 'three by-id shot bodies; a fixture set that shrank to '
            + 'nothing would leave every assertion below vacuously true');
        for (const { name, body } of RECORDED) {
            assert.ok(Array.isArray(body.measurements) && body.measurements.length > 200,
                `${name} should be a recording, not a stub`);
        }
    });

    for (const { name, body } of RECORDED) {
        describe(name, () => {
            const got = deriveFromRecord(body);

            test('derives, on one axis, with every measured channel the same length as it', () => {
                assert.equal(got.ok, true, got.reason);
                assert.equal(got.axis.originRule, ORIGIN_RULE.FIRST_POURING);
                assert.equal(got.axis.t[0], 0, 't=0 is the origin, not the first row of the file');
                assert.equal(got.counts.samples, body.measurements.length,
                    'ONE walk: every sample visited exactly once');
                assert.ok(got.counts.inShot > 0 && got.counts.inShot < got.counts.samples,
                    'preparation is dropped and a shot survives it');
                assert.equal(got.counts.unplaceable, 0, 'every recorded row carries a stamp');

                for (let i = 1; i < got.axis.t.length; i += 1) {
                    assert.ok(got.axis.t[i] >= got.axis.t[i - 1], `axis went backwards at ${i}`);
                }
                for (const key of SERIES_KEYS) {
                    assert.equal(got.series[key].y.length, got.series[key].x.length,
                        `${key}: a y with no x is not plottable`);
                }
                for (const key of ['pressure', 'flow', 'groupTemp', 'weight', 'volume']) {
                    assert.equal(got.series[key].y.length, got.axis.t.length,
                        `${key} must be aligned to the shared axis`);
                }
            });

            test('THE DELETED MACHINE GRAVIMETRIC BRANCH: a legacy row still reports NOTHING', () => {
                // These recordings predate 633f6f68, so the machine object carries `weight`.
                const machineWeights = body.measurements
                    .map((row) => row.machine && row.machine.weight)
                    .filter((value) => typeof value === 'number');
                assert.ok(machineWeights.length > 0,
                    'this fixture is only evidence while it still carries the dead key');
                assert.ok(Math.max(...machineWeights) > 0,
                    'and it carries readings, not a column of zeroes');

                assert.equal(got.availability.scale, false, 'every row has `scale: null`');
                assert.ok(got.series.weight.y.every((v) => v === null),
                    'a hundreds-of-grams machine weight must not reach the weight channel');
                assert.ok(got.series.weightFlow.y.every((v) => v === null));
                assert.equal(got.scalars.yield, null, 'and it must not become a yield');
                assert.equal(got.scalars.yieldSource, null);
                assert.equal(got.scalars.timeToFirstDrop, null, 'nor a first drop at t=0');
            });

            test('the stepped channels carry exactly one anchor per boundary after the first', () => {
                const boundaries = got.stepMarks.length;
                const extra = got.series.targetPressure.x.length - got.axis.t.length;
                assert.equal(extra, Math.max(0, boundaries - 1),
                    'the first frame has no outgoing target to repeat, so it gets no anchor');
                assert.equal(got.series.targetFlow.x.length, got.series.targetPressure.x.length,
                    'the anchor is emitted per channel, so both stepped channels agree');
            });

            test('every step mark names a step of the profile that was actually run', () => {
                const steps = (body.workflow && body.workflow.profile && body.workflow.profile.steps) || [];
                assert.ok(got.stepMarks.length > 0);
                for (const mark of got.stepMarks) {
                    assert.equal(mark.name, steps[mark.frame] ? steps[mark.frame].name : null);
                    assert.ok(mark.t >= 0 && mark.t <= got.axis.t.at(-1));
                }
            });

            test('THE METRICS BLOCK CANNOT RENDER BLANK: the scalars ARE the series it sits under', () => {
                // The old tree's shot-metrics.js took a flat channel map, the app passed it a
                // series bundle, and the whole block rendered blank while the chart above it drew
                // correctly — a caller-contract mismatch its own unit test hid by hand-building
                // the shape the app never passed. There is no shape to pass here: one walk
                // produces both, so the only thing left to assert is that they agree.
                const finite = (v) => typeof v === 'number' && Number.isFinite(v);
                const pressures = got.series.pressure.y.filter(finite);
                assert.ok(pressures.length > 0, 'a recorded espresso shot has pressure readings');
                assert.equal(got.scalars.peakPressure, Math.max(...pressures),
                    'peak pressure is the peak OF THE SERIES beside it, not of another array');
                assert.equal(got.phases.total.pressure.peak, got.scalars.peakPressure);
                assert.ok(got.scalars.averagePressure <= got.scalars.peakPressure);
                assert.equal(got.scalars.durationSeconds, got.axis.t.at(-1),
                    'and the duration is the axis it plots on');
                assert.equal(got.phases.total.seconds, got.scalars.durationSeconds);
            });

            test('the phase table adds up, and the buffer path derives the same shot', () => {
                const { preinfusion, extraction, total } = got.phases;
                assert.ok(preinfusion || extraction, 'a shot is at least one phase');
                if (preinfusion && extraction) {
                    assert.equal(preinfusion.fromIndex, 0);
                    assert.equal(extraction.fromIndex, preinfusion.toIndex + 1,
                        'extraction starts at the first pouring tick, with no sample between');
                    assert.equal(extraction.toIndex, total.toIndex);
                    assert.equal(preinfusion.volume + extraction.volume, total.volume);
                }

                // The same recording through the LIVE path. `addSample` does not write
                // `volume`, so both sides are fed the shape the live path can hold.
                const live = body.measurements.map(({ volume, ...row }) => row);
                const asRecord = { ...body, measurements: live };
                const buffer = createShotBuffer();
                buffer.noteShotState(readShotStateFrame({
                    event: 'state',
                    timestamp: body.timestamp,
                    shotId: body.id,
                    state: SHOT_STATE.PREHEATING,
                    machineState: 'espresso',
                    machineSubstate: 'preparingForShot',
                    profileFrame: 0,
                    scaleConnected: false,
                    scaleLost: false,
                    machineHasAutonomousSAW: true,
                    decision: null,
                }));
                for (const row of live) buffer.addSample(row);

                const fromBuffer = deriveFromBuffer(buffer, { record: asRecord });
                const fromRecord = deriveFromRecord(asRecord);
                assert.equal(fromBuffer.counts.inShot, fromRecord.counts.inShot);
                assert.deepEqual([...fromBuffer.axis.t], [...fromRecord.axis.t]);
                for (const key of SERIES_KEYS) {
                    assert.deepEqual([...fromBuffer.series[key].y], [...fromRecord.series[key].y],
                        `${key} diverged between the live and the stored path`);
                }
                assert.deepEqual(fromBuffer.scalars, fromRecord.scalars);
                assert.deepEqual(fromBuffer.phases, fromRecord.phases);
                assert.deepEqual(fromBuffer.stepMarks, fromRecord.stepMarks);
            });
        });
    }

    test('/shots/latest is a record whose samples were never sent, and says exactly that', () => {
        const latest = JSON.parse(readFileSync(FIXTURE_DIR + 'api__v1__shots__latest.json', 'utf8'));
        assert.equal(Object.hasOwn(latest, 'measurements'), false,
            'the route answers toJsonWithoutMeasurements — this is its CORRECT shape');
        const got = deriveFromRecord(latest);
        assert.equal(got.reason, 'measurementsNotServed',
            'which is not the same thing as a shot with no samples, and a list row must not '
            + 'be drawn as an empty chart');
        assert.equal(got.ok, false);
    });

    test('the dead key spans LOUD and QUIET across the corpus, and the quiet one is the risk', () => {
        const peaks = RECORDED.map(({ body }) => Math.max(
            ...body.measurements
                .map((row) => (row.machine && typeof row.machine.weight === 'number' ? row.machine.weight : 0)),
        ));
        assert.ok(peaks.some((peak) => peak > 100),
            'one recording peaks near 1 kg — a machine-gravimetric read there is obvious on sight');
        assert.ok(peaks.some((peak) => peak > 0 && peak < 10),
            'and another peaks under 2 g, which would read as a PLAUSIBLE yield and be believed. '
            + 'That is why the rule is addressed reads rather than a number that looks wrong.');
    });

    test('the recorded shots exercise the three shapes the phase split has to survive', () => {
        const shapes = RECORDED.map(({ body }) => {
            const got = deriveFromRecord(body);
            return [!!got.phases.preinfusion, !!got.phases.extraction];
        });
        assert.ok(shapes.some(([pi, ex]) => pi && !ex),
            'a shot that never reached `pouring` is preinfusion end to end');
        assert.ok(shapes.some(([pi, ex]) => pi && ex), 'and one that did has both');
    });
});

describe('A7, proved by behaviour: a dead name is never a fallback', () => {
    const t0 = Date.parse('2026-08-17T09:15:00.000Z');
    const stamp = (ms) => new Date(t0 + ms).toISOString();
    const machineRow = (ms, machineExtra = {}, sensors = null) => {
        const row = {
            machine: {
                timestamp: stamp(ms),
                state: { state: 'espresso', substate: 'pouring' },
                flow: 2, pressure: 9, targetFlow: 2, targetPressure: 9,
                mixTemperature: 90, groupTemperature: 92,
                targetMixTemperature: 92, targetGroupTemperature: 88,
                profileFrame: 0, steamTemperature: 140,
                ...machineExtra,
            },
            scale: null,
        };
        if (sensors) row.sensors = sensors;
        return row;
    };
    const recordOf = (rows) => ({ id: 'a7', measurements: rows, workflow: {}, annotations: {} });

    test('the SEVEN-RENAME table\'s left-hand side reads as absent; the right-hand side reads', () => {
        const dead = deriveFromRecord(recordOf([0, 1000, 2000].map((ms) => machineRow(ms, {
            hydraulicPower: 99, puckResistance: 88, loadImpedance: 77,
        }))));
        assert.deepEqual([...dead.series.power.y], [null, null, null],
            '`hydraulicPower` is the name the old builder read and the name ReaPrime deleted');
        assert.deepEqual([...dead.series.resistance.y], [null, null, null]);
        assert.deepEqual([...dead.series.impedance.y], [null, null, null]);
        assert.equal(dead.sources.power, SOURCE.NONE, 'and `none` is reported, not guessed at');

        const live = deriveFromRecord(recordOf([0, 1000, 2000].map((ms) => machineRow(ms, {
            hydraulicPowerDerived: 4.5, puckResistanceDerived: 1.2, loadImpedanceDerived: 0.7,
            hydraulicPower: 99,
        }))));
        assert.deepEqual([...live.series.power.y], [4.5, 4.5, 4.5],
            'the SAME row carrying both names takes the live one');
        assert.equal(live.sources.power, SOURCE.DERIVED);
        assert.equal(live.sources.resistance, SOURCE.DERIVED);
    });

    test('the estimator side is reached through the sensor id, not through a fused pair', () => {
        const id = `de1-0001${SENSOR_ID_SUFFIX.puckEstimator}`;
        const frame = {
            timestamp: stamp(0), rev: 3, flags: 0,
            r1: 0.8, r2: 1.5, hydraulicPowerMeasured: 5.5,
            fusedR1: 111, fusedR2: 222,
        };
        const got = deriveFromRecord(recordOf(
            [0, 1000, 2000].map((ms) => machineRow(ms, {}, { [id]: { ...frame, timestamp: stamp(ms) } })),
        ));
        assert.equal(got.availability.sensors, true);
        assert.equal(got.sources.impedance, SOURCE.ESTIMATOR);
        assert.deepEqual([...got.series.impedance.y], [0.8, 0.8, 0.8], 'r1, not fusedR1');
        assert.deepEqual([...got.series.resistance.y], [1.5, 1.5, 1.5], 'r2, not fusedR2');
        assert.deepEqual([...got.series.power.y], [5.5, 5.5, 5.5]);
    });

    test('HYDRAULIC POWER is never computed here, and the volume that is says so', () => {
        const bare = deriveFromRecord(recordOf([0, 1000].map((ms) => machineRow(ms))));
        assert.ok(bare.series.power.y.every((v) => v === null),
            'pressure 9 and flow 2 are both present and 0.1·P·F is still not computed here');
        /* VOLUME IS THE ONE EXCEPTION AND IT IS A DELIBERATE ONE. The rule this test
         * states — the skin consumes channels, it does not compute them — still governs
         * power, the fused pair and the estimator's channels, none of which the skin can
         * derive from what it is served. Flow integrated over time IS a volume, the old
         * app has always drawn it that way, and the alternative measured out as an empty
         * column on every live shot. `availability.volume` is what keeps the two apart. */
        assert.ok(bare.series.volume.y.some((v) => typeof v === 'number'),
            'flow IS integrated, because a served flow makes a volume');
        assert.equal(bare.availability.volume, false,
            'and the reader is told the server sent none');
    });
});

describe('x advances while y may be null — a gated stretch is a HOLE', () => {
    const gated = deriveFromRecord({
        ...RECORD,
        measurements: MEASUREMENTS.map((row, i) => (
            i === 5
                ? { ...row, machine: { ...row.machine, pressure: undefined, groupTemperature: null } }
                : row
        )),
    });

    test('the axis does not skip the sample the channel could not answer for', () => {
        assert.deepEqual([...gated.axis.t], [0, 1, 2, 3, 4, 5],
            'the clock is a fact about the machine, not about any one channel');
        assert.equal(gated.series.pressure.y.length, gated.axis.t.length);
    });

    test('the hole is null — not a zero, and not the neighbour held across it', () => {
        assert.equal(gated.series.pressure.y[3], null, 'a gap in the middle of a run');
        assert.equal(gated.series.pressure.y[2], 9, 'with its neighbours untouched');
        assert.equal(gated.series.pressure.y[4], 8.2);
        assert.equal(gated.series.groupTemp.y[3], null, 'an explicit null reads the same as absent');
        assert.ok(!gated.series.pressure.y.includes(0),
            'a run of zeroes is a line drawn along the floor, which is a claim about the machine');
    });

    test('the scalars step over the hole rather than counting it', () => {
        assert.equal(gated.scalars.peakPressure, 9);
        assert.equal(gated.phases.extraction.pressure.end, 2,
            'the last READING, which is not the last sample');
    });
});

describe('the channel vocabulary is the layer\'s, not a copy of it', () => {
    test('the three duplicated quantities are whatever the B6 table pairs', () => {
        const quantities = DUPLICATED_QUANTITIES.map((row) => row.quantity);
        for (const quantity of quantities) {
            assert.ok(SERIES_KEYS.includes(quantity),
                `${quantity} is paired by shot-source-selector.js and must be a channel`);
        }
        assert.deepEqual(SERIES_KEYS.filter((key) => quantities.includes(key)), quantities,
            'in the table\'s own order — a second hand-written copy could drift from it, and a '
            + 'drifted copy does not render a gap: readThroughSource throws on the first sample');
    });

    test('the two ADDED channels are present, because the gate exists to add them', () => {
        assert.ok(SERIES_KEYS.includes('weight'), 'without it yield, ratio and first drop cannot exist');
        assert.ok(SERIES_KEYS.includes('volume'));
        assert.equal(SERIES_KEYS.length, 14);
    });
});

describe('without a scale the pour bound cannot be applied, and the window WIDENS', () => {
    const noScale = deriveFromRecord({
        ...RECORD,
        annotations: {},
        measurements: MEASUREMENTS.map((row) => ({ ...row, scale: null })),
    });

    test('a scale-less shot still gets its pressure summary, over the whole in-shot span', () => {
        assert.equal(noScale.scalars.timeToFirstDrop, null, 'there is no first drop to bound by');
        assert.equal(noScale.scalars.averagePressure, (2 + 4 + 9 + 8.6 + 8.2 + 2) / 6,
            'the window widens to every in-shot sample — a WIDER window, never a substituted '
            + 'number, and returning null would delete the only summary a DE1 without a scale '
            + 'can have');
        assert.equal(noScale.scalars.peakFlowAfterFirstDrop, 2.4);
    });

    test('and the caller can SEE which window it got, from timeToFirstDrop beside it', () => {
        const withScale = deriveFromRecord({ ...RECORD, annotations: {} });
        assert.equal(withScale.scalars.timeToFirstDrop, 2);
        assert.equal(withScale.scalars.averagePressure, (9 + 8.6 + 8.2 + 2) / 4,
            'the same shot, bounded, is a different and narrower number');
        assert.notEqual(withScale.scalars.averagePressure, noScale.scalars.averagePressure);
    });
});

describe('a refusal is frozen the whole way down', () => {
    test('the empty series are as immutable as a derived one\'s', () => {
        const empty = emptyShotDerivation('noSamples');
        assert.ok(Object.isFrozen(empty.series));
        for (const key of SERIES_KEYS) {
            assert.ok(Object.isFrozen(empty.series[key]), `${key} object`);
            assert.ok(Object.isFrozen(empty.series[key].x), `${key}.x`);
            assert.ok(Object.isFrozen(empty.series[key].y), `${key}.y`);
            assert.throws(() => { empty.series[key].y.push(0); });
        }
        const derived = deriveFromRecord(RECORD);
        assert.ok(Object.isFrozen(derived.series.pressure.y),
            'so a caller cannot tell the two shapes apart by what it can mutate');
    });

    test('and so is the AXIS — the arrays, not just the object around them', () => {
        /* `Object.freeze` is one level deep, and "the whole way down" was true of
         * `series` and false of `axis` one field away: `axis.t.push(99)` on a refusal
         * SUCCEEDED and yielded [99], while the same array on an accepted derivation
         * throws. `axis.t` is what every chart indexes into (the card's `#xs`), so it is
         * the last field that may differ between the two shapes. */
        const empty = emptyShotDerivation('noSamples');
        assert.ok(Object.isFrozen(empty.axis), 'the axis object');
        assert.ok(Object.isFrozen(empty.axis.t), 'axis.t');
        assert.ok(Object.isFrozen(empty.axis.stampMs), 'axis.stampMs');
        assert.throws(() => { empty.axis.t.push(99); });
        assert.throws(() => { empty.axis.stampMs.push(99); });

        const derived = deriveFromRecord(RECORD);
        assert.ok(Object.isFrozen(derived.axis.t), 'the accepted shape freezes it');
        assert.ok(Object.isFrozen(derived.axis.stampMs));
        assert.throws(() => { derived.axis.t.push(99); });
    });

    test('every array a refusal carries is frozen, whichever field it hangs off', () => {
        /* Field by field rather than by name, so the next array added to the shape is
         * covered by this test on the day it is added rather than the day it is noticed. */
        const empty = emptyShotDerivation('noSamples');
        const loose = [];
        const walk = (value, path) => {
            if (Array.isArray(value)) {
                if (!Object.isFrozen(value)) loose.push(path);
                return;
            }
            if (!value || typeof value !== 'object') return;
            if (!Object.isFrozen(value)) loose.push(path);
            for (const [key, inner] of Object.entries(value)) walk(inner, `${path}.${key}`);
        };
        walk(empty, 'refusal');
        assert.deepEqual(loose, [], 'a refusal must expose nothing a caller can write to');
    });
});
