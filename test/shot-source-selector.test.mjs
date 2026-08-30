// B6: the duplicated channels — chosen once at shot start, held for the whole shot.
//
// The gap-position test is the one that encodes the defect. `fused.js` re-picks per
// sample, and the two sources go absent at different moments: the derived channels gate on
// the current operating point, the estimator's sentinel means "not yet observed". A
// per-sample pick therefore produces a trace whose gap lands somewhere different every
// shot, which reads as a machine glitch rather than a data state. Here the same sample
// sequence must produce the SAME gaps under the held decision, whichever source was
// chosen — and never a value silently borrowed from the other instrument.
//
// FIXTURES ARE CONTRACT-CHECKED (Gate B rule 4) against ReaPrime at
// 2b047d02e42e29bf2d96a2aa964ef94e4a4daba3: `MachineSnapshot.toJson` OMITS a `*Derived`
// key when `_derivedOrNull` returns null (never nulls it); `encodeSample` OMITS an
// estimator channel it has not observed; the measured/derived pairing is the one stated in
// each getter's doc comment — `r2` <-> `puckResistanceDerived`, `r1` <->
// `loadImpedanceDerived`, `hydraulicPowerMeasured` <-> `hydraulicPowerDerived`.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    createShotSourceSelector,
    chooseSource,
    chooseSources,
    readThroughSource,
    quantityRow,
    DUPLICATED_QUANTITIES,
    SOURCE,
} from '../src/stores/shot-source-selector.js';
import { readMachineSnapshot, readEstimatorFrame } from '../src/data/rea-address.js';
import { hasReading, isNoReading } from '../src/data/reading.js';
import { stripComments } from '../scripts/lib/source-scan.js';

/**
 * One addressed sample. `machine` keys and `estimator` channels are passed as the SERVER
 * would write them: present or simply absent. Nothing here nulls a channel.
 */
function sample({ machine = {}, estimator = null } = {}) {
    return {
        machine: readMachineSnapshot({
            timestamp: '2026-08-17T00:00:00.000Z',
            state: { state: 'espresso', substate: 'pouring' },
            flow: 2.1, pressure: 8.8, targetFlow: 2, targetPressure: 9,
            mixTemperature: 92, groupTemperature: 90,
            targetMixTemperature: 92, targetGroupTemperature: 90,
            profileFrame: 3, steamTemperature: 140,
            ...machine,
        }),
        estimator: readEstimatorFrame(estimator === null ? null : {
            timestamp: '2026-08-17T00:00:00.000Z',
            rev: 3, flags: 8, confidence: 0.9, lagConfidence: 0.8, sigmaQ: 0.05,
            ...estimator,
        }),
    };
}

const DERIVED_ALL = { puckResistanceDerived: 2.0, loadImpedanceDerived: 4.2, hydraulicPowerDerived: 1.8 };
const ESTIMATOR_ALL = { r1: 4.5, r2: 1.9, hydraulicPowerMeasured: 2.4 };

describe('all three quantities are duplicated, and the pairing is ReaPrime\'s', () => {
    test('three rows, paired as each getter\'s doc comment states', () => {
        assert.equal(DUPLICATED_QUANTITIES.length, 3);
        assert.deepEqual(
            DUPLICATED_QUANTITIES.map((row) => [row.quantity, row.estimatorChannel, row.derivedKey]),
            [
                ['resistance', 'r2', 'puckResistanceDerived'],
                ['impedance', 'r1', 'loadImpedanceDerived'],
                ['power', 'hydraulicPowerMeasured', 'hydraulicPowerDerived'],
            ],
        );
    });

    test('an unknown quantity throws rather than answering `none`', () => {
        assert.throws(() => quantityRow('temperature'), /unknown quantity/);
    });
});

describe('the decision', () => {
    test('estimator wins when present', () => {
        const s = sample({ machine: DERIVED_ALL, estimator: ESTIMATOR_ALL });
        assert.deepEqual(chooseSources(s), {
            resistance: SOURCE.ESTIMATOR, impedance: SOURCE.ESTIMATOR, power: SOURCE.ESTIMATOR,
        });
    });

    test('derived when the estimator is absent', () => {
        const s = sample({ machine: DERIVED_ALL });
        assert.deepEqual(chooseSources(s), {
            resistance: SOURCE.DERIVED, impedance: SOURCE.DERIVED, power: SOURCE.DERIVED,
        });
    });

    test('none when neither is there — a real outcome, not an error', () => {
        const s = sample({});
        assert.deepEqual(chooseSources(s), {
            resistance: SOURCE.NONE, impedance: SOURCE.NONE, power: SOURCE.NONE,
        });
    });

    test('per quantity, not per sample: rev-2 firmware takes derived power only', () => {
        // `hydraulicPowerMeasured` needs BengleEstSample rev >= 3 and is absent below it.
        const s = sample({ machine: DERIVED_ALL, estimator: { r1: 4.5, r2: 1.9 } });
        assert.equal(chooseSource(s, 'resistance'), SOURCE.ESTIMATOR);
        assert.equal(chooseSource(s, 'power'), SOURCE.DERIVED);
    });

    test('PRESENCE IS KEY-PRESENCE: a channel reading 0 is present', () => {
        const s = sample({ machine: DERIVED_ALL, estimator: { r2: 0 } });
        assert.equal(chooseSource(s, 'resistance'), SOURCE.ESTIMATOR);
        assert.equal(readThroughSource(s, 'resistance', SOURCE.ESTIMATOR), 0);
    });

    test('a gated-away derived key is absent, and so is the whole shape when there is none', () => {
        const s = sample({});  // the three derived keys are simply not on the frame
        assert.ok(isNoReading(readThroughSource(s, 'resistance', SOURCE.DERIVED)));
        assert.ok(isNoReading(readThroughSource(s, 'resistance', SOURCE.NONE)));
    });
});

describe('the choice is made ONCE and HELD', () => {
    test('a mid-shot estimator arrival does not switch the source', () => {
        const selector = createShotSourceSelector({ now: () => 1 });
        selector.beginShot(sample({ machine: DERIVED_ALL }));
        assert.equal(selector.sourceOf('resistance'), SOURCE.DERIVED);

        // The estimator registers lazily, on the first decoded frame — mid-shot arrival is
        // the NORMAL case, and it must not move the trace onto another instrument.
        const later = sample({ machine: DERIVED_ALL, estimator: ESTIMATOR_ALL });
        assert.equal(selector.sourceOf('resistance'), SOURCE.DERIVED);
        assert.equal(selector.read(later, 'resistance'), 2.0);
        assert.notEqual(selector.read(later, 'resistance'), 1.9);
    });

    test('a mid-shot estimator DROPOUT is a gap, never a silent fall-through', () => {
        const selector = createShotSourceSelector();
        selector.beginShot(sample({ machine: DERIVED_ALL, estimator: ESTIMATOR_ALL }));
        const dropped = sample({ machine: DERIVED_ALL });
        const value = selector.read(dropped, 'resistance');
        assert.ok(isNoReading(value), 'the selector borrowed the derived channel mid-shot');
        assert.equal(selector.sourceOf('resistance'), SOURCE.ESTIMATOR);
    });

    test('a second beginShot while a shot is live does not re-open the choice', () => {
        const selector = createShotSourceSelector();
        const first = selector.beginShot(sample({ machine: DERIVED_ALL }), { shotId: 'a' });
        const again = selector.beginShot(sample({ machine: DERIVED_ALL, estimator: ESTIMATOR_ALL }), { shotId: 'a' });
        assert.equal(again, first);
        assert.equal(selector.sourceOf('resistance'), SOURCE.DERIVED);
    });

    test('the next shot decides afresh', () => {
        const selector = createShotSourceSelector();
        selector.beginShot(sample({ machine: DERIVED_ALL }));
        selector.endShot();
        assert.equal(selector.active, false);
        selector.beginShot(sample({ machine: DERIVED_ALL, estimator: ESTIMATOR_ALL }), { shotId: 'b' });
        assert.equal(selector.sourceOf('resistance'), SOURCE.ESTIMATOR);
        assert.equal(selector.selection.shotId, 'b');
    });

    test('before a shot starts nothing is read — no per-sample pick anywhere', () => {
        const selector = createShotSourceSelector();
        assert.equal(selector.sourceOf('resistance'), SOURCE.NONE);
        assert.ok(isNoReading(selector.read(sample({ machine: DERIVED_ALL }), 'resistance')));
    });

    test('the source is MARKED on every read', () => {
        const selector = createShotSourceSelector();
        selector.beginShot(sample({ machine: DERIVED_ALL, estimator: ESTIMATOR_ALL }));
        const all = selector.readAll(sample({ machine: DERIVED_ALL, estimator: ESTIMATOR_ALL }));
        assert.deepEqual(Object.keys(all).sort(), ['impedance', 'power', 'resistance']);
        assert.equal(all.resistance.source, SOURCE.ESTIMATOR);
        assert.equal(all.resistance.value, 1.9);
        assert.ok(Object.isFrozen(all));
    });

    test('the selection is frozen and carries when it was decided', () => {
        const selector = createShotSourceSelector({ now: () => 99 });
        const selection = selector.beginShot(sample({ machine: DERIVED_ALL }), { shotId: 'c' });
        assert.ok(Object.isFrozen(selection));
        assert.equal(selection.decidedAt, 99);
    });
});

describe('the gap lands in the same place every time', () => {
    /** A shot in which each source goes absent at a DIFFERENT sample. */
    const series = () => [
        sample({ machine: DERIVED_ALL, estimator: ESTIMATOR_ALL }),
        sample({ machine: DERIVED_ALL, estimator: { r1: 4.6 } }),                 // estimator r2 gone
        sample({ machine: { loadImpedanceDerived: 4.2 }, estimator: ESTIMATOR_ALL }), // derived gone
        sample({ machine: DERIVED_ALL, estimator: ESTIMATOR_ALL }),
    ];

    const gaps = (selector, samples) => samples
        .map((s, index) => (hasReading(selector.read(s, 'resistance')) ? null : index))
        .filter((index) => index !== null);

    test('under the held decision the gaps are a property of the SOURCE, not of the sample', () => {
        const samples = series();

        const estimatorRun = createShotSourceSelector();
        estimatorRun.beginShot(samples[0]);
        assert.equal(estimatorRun.sourceOf('resistance'), SOURCE.ESTIMATOR);
        assert.deepEqual(gaps(estimatorRun, samples), [1]);

        // The same series read through the derived channel gaps at a different sample —
        // which is exactly why re-picking per sample makes the gap wander.
        const derivedRun = createShotSourceSelector();
        derivedRun.beginShot(sample({ machine: DERIVED_ALL }));
        assert.equal(derivedRun.sourceOf('resistance'), SOURCE.DERIVED);
        assert.deepEqual(gaps(derivedRun, samples), [2]);
    });

    test('the same shot replayed gives the same gaps — the decision is deterministic', () => {
        const first = createShotSourceSelector();
        const second = createShotSourceSelector();
        const samples = series();
        first.beginShot(samples[0]);
        second.beginShot(samples[0]);
        assert.deepEqual(gaps(first, samples), gaps(second, samples));
    });

    test('a per-sample pick would have NO gap at all — the behaviour being deleted', () => {
        const samples = series();
        const wandering = samples
            .map((s, index) => (chooseSource(s, 'resistance') === SOURCE.NONE ? index : null))
            .filter((index) => index !== null);
        assert.deepEqual(wandering, [], 'the fixture must be one where a per-sample pick hides both gaps');
    });
});

describe('what this module must not contain', () => {
    const SOURCE_TEXT = readFileSync(fileURLToPath(new URL('../src/stores/shot-source-selector.js', import.meta.url)), 'utf8');
    const CODE = stripComments(SOURCE_TEXT);

    test('no copy of ReaPrime\'s gate constant', () => {
        assert.ok(!/0\.3/.test(CODE), 'the 0.3 gate is copied into the selector — it lives in ReaPrime');
    });

    test('no computation of the quantities it selects between', () => {
        for (const forbidden of ['Math.pow', 'pressure /', 'pressure*', '* flow', '/ flow']) {
            assert.ok(!CODE.includes(forbidden), `the selector computes a channel (${forbidden}) — it selects, never computes`);
        }
    });

    test('presence is never tested with != null', () => {
        assert.ok(!/!=\s*null/.test(CODE), 'a `!= null` presence test is back');
        assert.ok(!/!==\s*null/.test(CODE) || /selection !== null/.test(CODE), 'null-testing a reading');
    });
});

/* ────────────────────────────────────────────────────────────────────────────────────
 * `none` IS UNDECIDED, NOT DECIDED.
 *
 * At t=0 of a real espresso NEITHER twin can be present: `machine.dart`'s `_derivedOrNull`
 * returns null — and `toJson` omits the key — whenever `flow < 0.3 || pressure < 0.3`, and
 * the estimator has observed nothing yet. `beginShot` used to freeze that as the shot's
 * answer, so all three B6 quantities rendered a permanent gap for the WHOLE shot, even
 * after both instruments came on the wire, with `endShot` the only exit.
 */
describe('the first sample of a real shot carries neither twin', () => {
    /** t=0: both under ReaPrime's own gate, so it omits all three derived keys. */
    const shotStart = () => sample({ machine: { flow: 0.0, pressure: 0.1 } });

    test('deciding from it holds nothing, and says so', () => {
        const selector = createShotSourceSelector({ now: () => 1 });
        const decision = selector.beginShot(shotStart(), { shotId: 'a' });
        assert.deepEqual(decision.sources, {
            resistance: SOURCE.NONE, impedance: SOURCE.NONE, power: SOURCE.NONE,
        });
        assert.deepEqual([...decision.undecided], ['resistance', 'impedance', 'power']);
        assert.equal(decision.settled, false);
        assert.equal(decision.settledAt, null);
    });

    test('and the next sample that carries evidence decides it', () => {
        const selector = createShotSourceSelector({ now: () => 1 });
        selector.beginShot(shotStart(), { shotId: 'a' });
        assert.equal(selector.sourceOf('resistance'), SOURCE.NONE);

        // Flow and pressure come up; both instruments are now reporting.
        const flowing = sample({ machine: DERIVED_ALL, estimator: ESTIMATOR_ALL });
        const settled = selector.beginShot(flowing, { shotId: 'a' });
        assert.equal(settled.sources.resistance, SOURCE.ESTIMATOR, 'the better number, as machine.dart asks');
        assert.equal(settled.settled, true);
        assert.equal(settled.shotId, 'a', 'still the same shot');
        assert.equal(hasReading(selector.read(flowing, 'resistance')), true);
        assert.equal(selector.read(flowing, 'resistance'), 1.9);
    });

    test('a quantity that HAS decided is never re-opened — that is all of B6', () => {
        const selector = createShotSourceSelector();
        // Joined mid-shot: the derived keys are there, the estimator is not yet.
        selector.beginShot(sample({ machine: DERIVED_ALL }), { shotId: 'a' });
        assert.equal(selector.sourceOf('resistance'), SOURCE.DERIVED);
        // The estimator registers a beat later. The trace does NOT move onto it.
        selector.beginShot(sample({ machine: DERIVED_ALL, estimator: ESTIMATOR_ALL }), { shotId: 'a' });
        assert.equal(selector.sourceOf('resistance'), SOURCE.DERIVED);
        assert.equal(selector.sourceOf('power'), SOURCE.DERIVED);
    });

    test('per quantity: rev-2 firmware settles R and Z on the estimator and W stays open', () => {
        const selector = createShotSourceSelector();
        // No hydraulicPowerMeasured: rev < 3. Its twin is gated away at this operating point.
        const rev2 = sample({ machine: { flow: 0.0, pressure: 0.1 }, estimator: { r1: 4.5, r2: 1.9 } });
        const first = selector.beginShot(rev2, { shotId: 'a' });
        assert.equal(first.sources.resistance, SOURCE.ESTIMATOR);
        assert.equal(first.sources.power, SOURCE.NONE);
        assert.deepEqual([...first.undecided], ['power']);

        // Pressure and flow come up: the derived power key appears and settles that one.
        const flowing = selector.beginShot(sample({ machine: DERIVED_ALL, estimator: { r1: 4.5, r2: 1.9 } }), { shotId: 'a' });
        assert.equal(flowing.sources.power, SOURCE.DERIVED);
        assert.equal(flowing.sources.resistance, SOURCE.ESTIMATOR, 'unmoved');
        assert.equal(flowing.settled, true);
    });

    test('once settled, beginShot is a no-op by identity', () => {
        const selector = createShotSourceSelector();
        const first = selector.beginShot(sample({ machine: DERIVED_ALL, estimator: ESTIMATOR_ALL }), { shotId: 'a' });
        assert.equal(selector.beginShot(sample({}), { shotId: 'a' }), first);
    });

    test('endShot is still the only thing that re-opens a shot\'s answer', () => {
        const selector = createShotSourceSelector();
        selector.beginShot(sample({ machine: DERIVED_ALL, estimator: ESTIMATOR_ALL }), { shotId: 'a' });
        selector.endShot();
        assert.equal(selector.active, false);
        const next = selector.beginShot(sample({ machine: DERIVED_ALL }), { shotId: 'b' });
        assert.equal(next.sources.resistance, SOURCE.DERIVED);
        assert.equal(next.shotId, 'b');
    });
});

describe('the pairing table names keys ReaPrime actually serves', () => {
    test('every estimatorChannel and derivedKey is one rea-names.js carries', async () => {
        // The six wire keys in this file were the only copy of a server truth in the tree
        // with nothing derived behind them. They cannot be generated — the pairing is a
        // physical claim from machine.dart's doc comments — but they can be required to
        // name keys that exist, at import.
        const { ESTIMATOR_CHANNELS, SNAPSHOT_DERIVED_KEYS } = await import('../src/data/rea-names.js');
        for (const row of DUPLICATED_QUANTITIES) {
            assert.ok(ESTIMATOR_CHANNELS.includes(row.estimatorChannel), row.estimatorChannel);
            assert.ok(SNAPSHOT_DERIVED_KEYS.includes(row.derivedKey), row.derivedKey);
        }
    });
});
