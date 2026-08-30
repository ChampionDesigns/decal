// The time axis (B4): plot what ReaPrime stamps, invent no correction.
//
// The first suite is evidence, not behaviour. B4's whole justification is a fact about
// ReaPrime — that it stamps at decode and discards the machine's own sample clock — and
// that fact is checked against the parser at the pinned commit, so the day R4 lands this
// test goes red and the rule is REVISITED rather than quietly outlived.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { readReaFile } from '../scripts/lib/rea-source.js';
import {
    stampMs, sampleStampMs, elapsedSeconds, chooseOrigin, buildTimeAxis,
    ORIGIN_RULE, TIME_SOURCE, timeSourceOf,
} from '../src/stores/time-axis.js';
import { isNoReading, ABSENCE } from '../src/data/reading.js';

const PARSING_DART = 'lib/src/models/device/impl/de1/unified_de1/unified_de1.parsing.dart';
const BENGLE_SAMPLE_DART = 'lib/src/models/device/impl/de1/unified_de1/bengle_shot_sample.dart';

/** One buffered sample in the recorded shape. */
const sampleAt = (timestamp, state = 'espresso', substate = 'pouring') => ({
    machine: { timestamp, state: { state, substate }, pressure: 8.6, flow: 2.1 },
    scale: null,
});

describe('R4 evidence: ReaPrime stamps on arrival and drops the machine clock', () => {
    test('both wire formats are stamped with DateTime.now() at decode', () => {
        const { text } = readReaFile(PARSING_DART);
        for (const parser of ['_parseStateAndShotSample', '_parseStateAndBengleShotSample']) {
            const start = text.indexOf(parser);
            assert.notEqual(start, -1, `${parser} not found`);
            const body = text.slice(start, text.indexOf('\n  }', start));
            assert.match(body, /timestamp: DateTime\.now\(\)/, `${parser} stamps at decode`);
        }
    });

    test('the Bengle format DOES carry a sample clock — decoded, then dropped', () => {
        const { text: sample } = readReaFile(BENGLE_SAMPLE_DART);
        assert.match(sample, /sampleTime: data\.getUint16\(0, Endian\.big\)/, 'decoded off the wire');
        const { text: parsing } = readReaFile(PARSING_DART);
        const start = parsing.indexOf('_parseStateAndBengleShotSample');
        const body = parsing.slice(start, parsing.indexOf('\n  }', start));
        assert.equal(body.includes('sampleTime'), false,
            'sampleTime is decoded and never passed on — this is exactly what R4 asks for');
    });

    test('and the axis says what it is, in one place', () => {
        assert.equal(timeSourceOf(), TIME_SOURCE.ARRIVAL);
        assert.deepEqual(Object.values(TIME_SOURCE), ['arrival'], 'one source until R4 lands');
    });
});

describe('stampMs: an unreadable stamp is an absence, never a substitute', () => {
    test('an ISO stamp becomes epoch milliseconds', () => {
        assert.equal(stampMs({ timestamp: '2026-08-17T09:15:00.000Z' }), Date.parse('2026-08-17T09:15:00.000Z'));
    });

    test('absent, null, wrong-typed and unparseable are four distinguishable absences', () => {
        assert.equal(stampMs({}).reason, ABSENCE.ABSENT);
        assert.equal(stampMs({ timestamp: null }).reason, ABSENCE.NULL);
        assert.equal(stampMs({ timestamp: 1712345678 }).reason, ABSENCE.NON_FINITE);
        assert.equal(stampMs({ timestamp: 'yesterday-ish' }).reason, ABSENCE.NON_FINITE);
        assert.equal(stampMs(null).reason, ABSENCE.NO_SOURCE);
    });

    test('an absence is not a number — arithmetic on it is loud, not plausible', () => {
        const absent = stampMs({});
        assert.equal(isNoReading(absent), true);
        assert.equal(Number.isNaN(Number(absent)), true);
    });

    test('a sample is stamped by its MACHINE frame; the scale keeps its own stamp', () => {
        const sample = {
            machine: { timestamp: '2026-08-17T09:15:00.000Z' },
            scale: { timestamp: '2026-08-17T09:15:00.180Z', weight: 18.2 },
        };
        assert.equal(sampleStampMs(sample), Date.parse('2026-08-17T09:15:00.000Z'));
        assert.equal(stampMs(sample.scale) - sampleStampMs(sample), 180, 'the skew stays visible');
    });
});

describe('elapsedSeconds is the whole arithmetic', () => {
    test('a plain difference in seconds', () => {
        assert.equal(elapsedSeconds(1500, 1000), 0.5);
        assert.equal(elapsedSeconds(1000, 1000), 0);
        assert.equal(elapsedSeconds(500, 1000), -0.5, 'preinfusion before t=0 is negative, not clamped');
    });

    test('an unreadable end is null — a gap, not a zero', () => {
        assert.equal(elapsedSeconds(stampMs({}), 1000), null);
        assert.equal(elapsedSeconds(1000, null), null);
    });
});

describe('chooseOrigin', () => {
    const t = (ms) => new Date(Date.parse('2026-08-17T09:15:00.000Z') + ms).toISOString();

    test('the espresso rule: the first sample the machine reported as pouring', () => {
        const samples = [
            sampleAt(t(0), 'espresso', 'preparingForShot'),
            sampleAt(t(100), 'espresso', 'preinfusion'),
            sampleAt(t(200), 'espresso', 'pouring'),
        ];
        const origin = chooseOrigin(samples);
        assert.equal(origin.rule, ORIGIN_RULE.FIRST_POURING);
        assert.equal(origin.index, 1, 'preinfusion IS pouring for this purpose — it is in the cup');
        assert.equal(origin.originMs, Date.parse(t(100)));
    });

    test('a session that never pours takes the first stamped sample, and SAYS SO', () => {
        const samples = [sampleAt(t(0), 'steam', 'pouring'), sampleAt(t(100), 'steam', 'pouring')];
        const origin = chooseOrigin(samples);
        assert.equal(origin.rule, ORIGIN_RULE.FIRST_SAMPLE, 'steam is not espresso, so isPouring is false');
        assert.equal(origin.index, 0);
    });

    test('unstamped leading samples do not become the origin', () => {
        const samples = [sampleAt(undefined, 'steam'), sampleAt(t(50), 'steam')];
        const origin = chooseOrigin(samples);
        assert.equal(origin.originMs, Date.parse(t(50)));
        assert.equal(origin.index, 1);
    });

    test('nothing stamped means there is no axis — not an axis at zero', () => {
        const origin = chooseOrigin([sampleAt(undefined), {}, null].map((s) => s || {}));
        assert.equal(origin.originMs, null);
        assert.equal(origin.rule, ORIGIN_RULE.NONE);
    });

    test('an empty run answers the same way', () => {
        assert.equal(chooseOrigin([]).rule, ORIGIN_RULE.NONE);
        assert.equal(chooseOrigin(null).rule, ORIGIN_RULE.NONE);
    });
});

describe('buildTimeAxis: nothing is resampled, filled, sorted or clamped', () => {
    const base = Date.parse('2026-08-17T09:15:00.000Z');
    const at = (ms) => new Date(base + ms).toISOString();

    test('elapsed seconds come out in ARRIVAL order, with the real jitter in them', () => {
        // 0 / 97 / 213 / 300 ms — the uneven spacing IS the transport jitter B4 describes.
        const samples = [0, 97, 213, 300].map((ms) => sampleAt(at(ms)));
        const axis = buildTimeAxis(samples);
        assert.equal(axis.rule, ORIGIN_RULE.FIRST_POURING);
        assert.deepEqual(axis.seconds, [0, 0.097, 0.213, 0.3]);
        assert.deepEqual(axis.indices, [0, 1, 2, 3]);
        assert.equal(axis.span, 0.3);
        assert.equal(axis.unstamped, 0);
        assert.equal(axis.nonMonotonic, 0);
    });

    test('a sample with no stamp is DROPPED and counted — never given one', () => {
        const samples = [sampleAt(at(0)), sampleAt(undefined), sampleAt(at(200))];
        const axis = buildTimeAxis(samples);
        assert.deepEqual(axis.seconds, [0, 0.2]);
        assert.deepEqual(axis.indices, [0, 2], 'the gap is visible in the indices');
        assert.equal(axis.unstamped, 1);
    });

    test('stamps that go backwards are counted and left exactly as they came', () => {
        const samples = [0, 200, 150, 300].map((ms) => sampleAt(at(ms)));
        const axis = buildTimeAxis(samples);
        assert.deepEqual(axis.seconds, [0, 0.2, 0.15, 0.3], 'not sorted, not clamped');
        assert.equal(axis.nonMonotonic, 1);
    });

    test('an explicit origin is honoured, so live and history share one t=0', () => {
        const samples = [100, 200].map((ms) => sampleAt(at(ms)));
        const axis = buildTimeAxis(samples, { originMs: base });
        assert.deepEqual(axis.seconds, [0.1, 0.2]);
    });

    test('no origin at all yields an empty axis rather than an axis of zeros', () => {
        const axis = buildTimeAxis([sampleAt(undefined), sampleAt(undefined)]);
        assert.deepEqual(axis.seconds, []);
        assert.equal(axis.originMs, null);
        assert.equal(axis.span, null);
        assert.equal(axis.unstamped, 2);
    });

    test('the number of points equals the number of stamped samples — nothing is added', () => {
        const samples = [0, 97, 213].map((ms) => sampleAt(at(ms)));
        const axis = buildTimeAxis(samples);
        assert.equal(axis.seconds.length, samples.length, 'no interpolation onto a uniform grid');
    });
});

/* ────────────────────────────────────────────────────────────────────────────────────
 * THE RULE TRAVELS WITH THE ORIGIN.
 *
 * "An explicit origin is honoured" above asserts the seconds and never the rule, which is
 * where it went wrong: a supplied origin was hard-labelled `firstSample`, and the ONE
 * caller that will ever supply one is the shot buffer — whose held origin is
 * `firstPouringSample` for every espresso shot. The header of this module says the rule
 * "changes what the chart means", so reporting the wrong one is not cosmetic.
 */
describe('a supplied origin never invents the rule that chose it', () => {
    const base = Date.parse('2026-08-17T09:15:00.000Z');
    const at = (ms) => new Date(base + ms).toISOString();
    const pouring = (ms) => sampleAt(at(ms), 'espresso', 'pouring');

    test('the rule the caller states is the rule reported', () => {
        const samples = [pouring(100), pouring(200)];
        const origin = chooseOrigin(samples);
        assert.equal(origin.rule, ORIGIN_RULE.FIRST_POURING);
        const axis = buildTimeAxis(samples, { originMs: origin.originMs, originRule: origin.rule });
        assert.equal(axis.rule, ORIGIN_RULE.FIRST_POURING, 'not firstSample');
        assert.deepEqual(axis.seconds, [0, 0.1]);
    });

    test('an origin with no stated rule reads as `given`, which claims nothing', () => {
        const axis = buildTimeAxis([sampleAt(at(100))], { originMs: base });
        assert.equal(axis.rule, ORIGIN_RULE.GIVEN);
        assert.notEqual(axis.rule, ORIGIN_RULE.FIRST_SAMPLE, 'the claim it used to make');
    });

    test('a null origin is still NONE, and a rule this module does not know throws', () => {
        assert.equal(buildTimeAxis([sampleAt(at(100))], { originMs: null }).rule, ORIGIN_RULE.NONE);
        assert.throws(
            () => buildTimeAxis([], { originMs: base, originRule: 'firstPour' }),
            /is not an ORIGIN_RULE/,
        );
    });

    test('choosing here, rather than being told, still reports the real rule', () => {
        assert.equal(buildTimeAxis([pouring(100)]).rule, ORIGIN_RULE.FIRST_POURING);
        // A steam session never pours, so the second rule fires — and is reported as itself.
        assert.equal(buildTimeAxis([sampleAt(at(100), 'steam', 'pouring')]).rule, ORIGIN_RULE.FIRST_SAMPLE);
    });
});
