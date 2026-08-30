// The validity substrate: key presence in, an absence with a reason out.
//
// Every assertion here is one that the FALLBACK version of the same code would fail — that
// is the point. The old skin's readers returned a plausible number for a missing key, and
// a test that only checked "returns a number" passed on both.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    ABSENCE,
    NO_READING,
    noReading,
    isNoReading,
    hasReading,
    toPlot,
    toText,
    hasKey,
    readNumber,
    readValue,
    readChannels,
    allAbsent,
    presentChannels,
} from '../src/data/reading.js';

describe('absence is a value, not a number', () => {
    test('an absence carries its reason and is never mistaken for a measurement', () => {
        for (const reason of Object.values(ABSENCE)) {
            const absent = noReading(reason);
            assert.equal(absent.reason, reason);
            assert.equal(isNoReading(absent), true);
            assert.equal(hasReading(absent), false);
            assert.equal(Object.isFrozen(absent), true);
            // Identity, so a hot path can compare without allocating.
            assert.equal(noReading(reason), absent);
        }
        assert.equal(NO_READING.reason, ABSENCE.ABSENT);
    });

    test('an unknown reason throws rather than inventing one', () => {
        assert.throws(() => noReading('probably fine'), /unknown absence reason/);
    });

    test('arithmetic on an absence is loud, not plausible', () => {
        // The whole failure mode in one assertion: a fallback returns 0 and the chart
        // draws a flat line that looks like a measurement. NaN cannot be drawn by accident.
        assert.ok(Number.isNaN(Number(NO_READING)));
        assert.ok(Number.isNaN(NO_READING + 1), 'addition');
        assert.ok(Number.isNaN(NO_READING * 2), 'multiplication');
        assert.ok(Number.isNaN(Math.max(NO_READING, 3)), 'and the aggregate a chart would run');
        assert.notEqual(NO_READING, 0);
        assert.equal(JSON.stringify(NO_READING), '{"noReading":true,"reason":"absent"}');
    });

    test('a real reading is a finite number and nothing else', () => {
        assert.equal(hasReading(0), true, 'zero IS a measurement when the server sent it');
        assert.equal(hasReading(-1.5), true);
        assert.equal(hasReading(NaN), false);
        assert.equal(hasReading(Infinity), false);
        assert.equal(hasReading('2.4'), false);
        assert.equal(hasReading(null), false);
        assert.equal(hasReading(undefined), false);
    });

    test('toPlot turns an absence into a gap, never into a zero', () => {
        assert.equal(toPlot(2.4), 2.4);
        assert.equal(toPlot(0), 0);
        for (const reason of Object.values(ABSENCE)) assert.equal(toPlot(noReading(reason)), null);
    });

    test('toText dashes an absence and formats a reading', () => {
        assert.equal(toText(1.234, (v) => v.toFixed(1)), '1.2');
        assert.equal(toText(NO_READING, (v) => v.toFixed(1)), '—');
        assert.equal(toText(NO_READING, (v) => v.toFixed(1), 'n/a'), 'n/a');
    });
});

describe('key presence is the validity test', () => {
    test('hasKey is own-property presence, immune to a polluted prototype', () => {
        const frame = JSON.parse('{"pressure": 6.1}');
        assert.equal(hasKey(frame, 'pressure'), true);
        assert.equal(hasKey(frame, 'puckResistanceDerived'), false);
        assert.equal(hasKey(null, 'pressure'), false);

        Object.prototype.puckResistanceDerived = 42; // eslint-disable-line no-extend-native
        try {
            assert.equal('puckResistanceDerived' in frame, true, 'the `in` operator is fooled');
            assert.equal(hasKey(frame, 'puckResistanceDerived'), false, 'hasKey is not');
        } finally {
            delete Object.prototype.puckResistanceDerived;
        }
    });

    test('an omitted key reads as ABSENT — the gated case, and the normal one', () => {
        const gatedOff = { flow: 0.1, pressure: 0.2 };
        const reading = readNumber(gatedOff, 'puckResistanceDerived');
        assert.equal(isNoReading(reading), true);
        assert.equal(reading.reason, ABSENCE.ABSENT);
    });

    test('a written key reads as its value, gate or no gate', () => {
        assert.equal(readNumber({ puckResistanceDerived: 1.9 }, 'puckResistanceDerived'), 1.9);
        assert.equal(readNumber({ flow: 0 }, 'flow'), 0);
    });

    test('present-but-null and present-but-junk are distinct absences', () => {
        assert.equal(readNumber({ battery: null }, 'battery').reason, ABSENCE.NULL);
        assert.equal(readNumber({ battery: 'full' }, 'battery').reason, ABSENCE.NON_FINITE);
        assert.equal(readNumber({ battery: NaN }, 'battery').reason, ABSENCE.NON_FINITE);
    });

    test('a missing container reports NO_SOURCE, or whatever the caller names', () => {
        assert.equal(readNumber(null, 'weightFlow').reason, ABSENCE.NO_SOURCE);
        assert.equal(readNumber(undefined, 'r2', ABSENCE.PERMANENT).reason, ABSENCE.PERMANENT);
    });

    test('readValue keeps non-numeric channels verbatim under the same rules', () => {
        assert.equal(readValue({ timestamp: '2026-08-17T00:00:00' }, 'timestamp'), '2026-08-17T00:00:00');
        assert.equal(readValue({}, 'timestamp').reason, ABSENCE.ABSENT);
        assert.equal(readValue({ timestamp: null }, 'timestamp').reason, ABSENCE.NULL);
    });
});

describe('channel sets', () => {
    test('readChannels reads each key on its own presence', () => {
        const out = readChannels({ flow: 1, pressure: 6, timestamp: 'T' }, ['flow', 'pressure', 'targetFlow', 'timestamp'], { textKeys: ['timestamp'] });
        assert.equal(out.flow, 1);
        assert.equal(out.pressure, 6);
        assert.equal(out.targetFlow.reason, ABSENCE.ABSENT);
        assert.equal(out.timestamp, 'T');
        assert.equal(Object.isFrozen(out), true);
    });

    test('allAbsent marks a whole set with one reason — the stored-shot rule', () => {
        const out = allAbsent(['r1', 'r2'], ABSENCE.PERMANENT);
        assert.deepEqual(Object.keys(out), ['r1', 'r2']);
        assert.equal(out.r1.reason, ABSENCE.PERMANENT);
        assert.equal(out.r2, out.r1);
    });

    test('presentChannels answers "what does this frame actually carry"', () => {
        const readings = readChannels({ r1: 4.1, flags: 5 }, ['r1', 'r2', 'flags']);
        assert.deepEqual(presentChannels(readings), ['r1', 'flags']);
        assert.deepEqual(presentChannels(readings, ['r2']), []);
    });
});

test('no gate constant is re-implemented anywhere in the data layer', () => {
    // ReaPrime gates the derived channels on flow >= 0.3 mL/s and pressure >= 0.3 bar and
    // OMITS the key when it fails. Key presence is the whole test, so a copy of 0.3 in this
    // skin would be a second thing to drift. There is none, and this is the check.
    const dir = fileURLToPath(new URL('../src/data/', import.meta.url));
    const offenders = readdirSync(dir)
        .filter((f) => f.endsWith('.js'))
        .filter((f) => /0\.3\b/.test(readFileSync(`${dir}${f}`, 'utf8')));
    assert.deepEqual(offenders, []);
});
