

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    CHANNEL_READOUT,
    READOUT_JOIN,
    readoutLine,
    readoutTerms,
    readoutTime,
    readoutValue,
    readoutValues,
    trajectoryTerms,
} from '../src/lib/chart-readout.js';
import { SERIES_KEYS } from '../src/lib/shot-derivation.js';

/** A live cursor, in the shape `ui-chart-card` freezes and dispatches. */
const cursor = (values, t = 12.34) => ({ active: true, idx: 40, t, values });

describe('chart-readout', () => {
    describe('one channel, as text', () => {
        test('rounds to the channel\'s own precision and can carry its unit', () => {
            assert.equal(readoutValue('pressure', 9.06), '9.1');
            assert.equal(readoutValue('pressure', 9.06, { withUnit: true }), '9.1 bar');
            assert.equal(readoutValue('flow', 2.049, { withUnit: true }), '2.0 mL/s');
            /* Watts have no tenth: a tenth of a watt is noise on a 2 kW heater. */
            assert.equal(readoutValue('power', 1234.6, { withUnit: true }), '1235 W');
            /* R and Z live between 0.01 and 10, so one decimal would round most of a
             * shot to the same number. */
            assert.equal(readoutValue('resistance', 0.4567, { withUnit: true }), '0.46 bar·s²/mL²');
        });

        test('ZERO IS A READING and only an absence is absent', () => {
            assert.equal(readoutValue('flow', 0), '0.0');
            assert.equal(readoutValue('flow', null), null);
            assert.equal(readoutValue('flow', undefined), null);
            assert.equal(readoutValue('flow', NaN), null);
            assert.equal(readoutValue('flow', Infinity), null);
            /* A string is not a number, whatever it parses to. */
            assert.equal(readoutValue('flow', '2.0'), null);
        });

        test('an unlisted key reads as a bare number rather than throwing', () => {
            assert.equal(readoutValue('somethingNew', 1.23), '1.2');
            assert.equal(readoutValue('somethingNew', 1.23, { withUnit: true }), '1.2');
        });

        test('every gate-6 series key has a row, so no drawn channel reads unitless', () => {
            const missing = SERIES_KEYS.filter((key) => !CHANNEL_READOUT[key]);
            assert.deepEqual(missing, [],
                `these channels are drawn and have no readout row: ${missing.join(', ')}`);
        });
    });

    describe('the time', () => {
        test('always carries its unit — a bare number is not a time', () => {
            assert.equal(readoutTime(12.34), '12.3 s');
            assert.equal(readoutTime(0), '0.0 s');
            assert.equal(readoutTime(null), null);
        });
    });

    describe('the legend\'s values map', () => {
        test('names only the keys the legend itself names, with no units', () => {
            const got = readoutValues(
                cursor({ pressure: 9.06, flow: 2.04, weightFlow: 1.5, groupTemp: 92.44 }),
                ['pressure', 'flow'],
            );
            assert.deepEqual(got, { pressure: '9.1', flow: '2.0' });
        });

        test('an absent reading is OMITTED, never a dash', () => {
            const got = readoutValues(cursor({ pressure: 9.06, flow: null }), ['pressure', 'flow']);
            assert.deepEqual(got, { pressure: '9.1' });
            assert.equal(Object.hasOwn(got, 'flow'), false,
                'a dash on a chip reads as "this channel is zero here", which is a '
                + 'different claim from "the chart drew nothing here"');
        });

        test('a resting cursor clears it', () => {
            assert.deepEqual(
                readoutValues({ active: false, idx: null, t: null, values: {} }, ['pressure']), {});
            assert.deepEqual(readoutValues(null, ['pressure']), {});
        });

        test('a chip the reader turned OFF names no number (F-006)', () => {
            const detail = cursor({ pressure: 9.06, flow: 2.04 });
            assert.deepEqual(readoutValues(detail, ['pressure', 'flow'], { hidden: ['flow'] }),
                { pressure: '9.1' },
                'the chart is not drawing that line, so "the same numbers the chart drew" '
                + 'would stop being true');
        });
    });

    describe('the terms a reading is made of', () => {
        test('a card with no legend carries the unit and ends with the time', () => {
            const got = readoutTerms(cursor({ pressure: 9.06, flow: 2.04 }), ['pressure', 'flow']);
            assert.deepEqual(got, [
                { key: 'pressure', value: '9.1 bar' },
                { key: 'flow', value: '2.0 mL/s' },
                { key: 'time', value: '12.3 s' },
            ]);
        });

        test('a card WITH a legend drops the unit — the chip already said it', () => {
            const got = readoutTerms(cursor({ pressure: 9.06, flow: 2.04 }), ['pressure', 'flow'],
                { withUnit: false });
            assert.deepEqual(got, [
                { key: 'pressure', value: '9.1' },
                { key: 'flow', value: '2.0' },
                { key: 'time', value: '12.3 s' },
            ]);
        });

        test('a resting cursor has no terms at all', () => {
            assert.deepEqual(readoutTerms({ active: false, values: {} }, ['pressure']), []);
        });

        test('hidden keys drop out here too', () => {
            const got = readoutTerms(cursor({ pressure: 9.06, flow: 2.04 }), ['pressure', 'flow'],
                { hidden: ['pressure'] });
            assert.deepEqual(got.map((term) => term.key), ['flow', 'time']);
        });
    });

    describe('one point of the trajectory', () => {
        test('names pressure, then flow, then the second it belongs to (F-034)', () => {
            assert.deepEqual(trajectoryTerms({ x: 2.04, y: 9.06, t: 12.34 }), [
                { key: 'pressure', value: '9.1 bar' },
                { key: 'flow', value: '2.0 mL/s' },
                { key: 'time', value: '12.3 s' },
            ]);
        });

        test('a gap point — the two nulls trajectoryPoints emits — names nothing but its time', () => {
            assert.deepEqual(trajectoryTerms({ x: null, y: null, t: 4 }),
                [{ key: 'time', value: '4.0 s' }]);
        });

        test('no point, no terms', () => {
            assert.deepEqual(trajectoryTerms(null), []);
        });
    });

    describe('the line a foot strip prints', () => {
        test('labels come from the caller and a term with no label prints its value alone', () => {
            const terms = [
                { key: 'pressure', value: '9.1 bar' },
                { key: 'time', value: '12.3 s' },
            ];
            assert.equal(readoutLine(terms, { pressure: 'Pressure' }),
                `Pressure 9.1 bar${READOUT_JOIN}12.3 s`);
        });

        test('no terms, no line', () => {
            assert.equal(readoutLine([], { pressure: 'Pressure' }), '');
            assert.equal(readoutLine(null), '');
        });
    });
});
