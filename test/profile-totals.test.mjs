/**
 * The editor header's four ceilings (fix run 4, cmp-seh-3).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    profileTotals, profileTotalTerms, formatCeilingDuration, TOTALS_SEPARATOR,
} from '../src/lib/profile-totals.js';

/** A step in the shape ReaPrime serves. VALUES ONLY — no bound is stated here. */
const step = (over = {}) => ({
    name: 'Step',
    pump: 'flow',
    transition: 'fast',
    exit: null,
    volume: 0,
    seconds: 30,
    weight: 0,
    temperature: 92,
    sensor: 'coffee',
    flow: 4,
    limiter: { value: 9, range: 0.6 },
    ...over,
});

const profile = (steps) => ({
    version: 2, title: 'T', notes: '', author: 'a', beverage_type: 'espresso',
    steps, target_volume: 0, target_weight: 36, target_volume_count_start: 0,
    tank_temperature: 0,
});

const sentence = (p) => profileTotalTerms(p)
    .map((term) => term.text.replace(/\{(\w+)\}/g, (_, k) => String(term.params[k])))
    .join(TOTALS_SEPARATOR);

describe('the peak is what the steps COMMAND, not what their limiters allow', () => {
    test('a flow step contributes no pressure at all, however high its limiter', () => {
        const totals = profileTotals(profile([step(), step({ flow: 2 })]));
        assert.equal(totals.peakPressure, null,
            'two flow steps with a 9 bar limiter command no pressure — Slate said 9.0');
    });

    test('a pressure step contributes its own target', () => {
        const totals = profileTotals(profile([step(), step({ pump: 'pressure', pressure: 6 })]));
        assert.equal(totals.peakPressure, 6);
    });

    test('a lever step contributes P0, which is stored in the pressure key', () => {
        const totals = profileTotals(profile([
            step({ pump: 'lever', pressure: 8, leverSpring: 0.4, leverGive: 0.8 }),
        ]));
        assert.equal(totals.peakPressure, 8);
    });

    test('a power step contributes its cap, because that IS its commanded pressure', () => {
        const totals = profileTotals(profile([step({ pump: 'power', power: 40, limiter: { value: 7, range: 0.6 } })]));
        assert.equal(totals.peakPressure, 7);
    });

    test('the peak is the maximum over the steps that command one', () => {
        const totals = profileTotals(profile([
            step({ pump: 'pressure', pressure: 4 }),
            step(),
            step({ pump: 'pressure', pressure: 9 }),
        ]));
        assert.equal(totals.peakPressure, 9);
    });
});

describe('a term the profile does not define is omitted, never zeroed', () => {
    test('one step with no duration makes the whole profile unbounded', () => {
        const totals = profileTotals(profile([step({ seconds: 30 }), step({ seconds: 0 })]));
        assert.equal(totals.maxSeconds, null);
        assert.equal(sentence(profile([step({ seconds: 30 }), step({ seconds: 0 })])), '2 steps');
    });

    test('an empty profile has a step count and nothing else', () => {
        assert.deepEqual({ ...profileTotals(profile([])) }, {
            steps: 0, maxSeconds: null, capVolume: null, peakPressure: null,
        });
        assert.equal(sentence(profile([])), '0 steps');
    });

    test('no positive volume anywhere means no volume ceiling', () => {
        assert.equal(profileTotals(profile([step(), step()])).capVolume, null);
    });

    test('a profile that is not a profile answers, rather than throwing', () => {
        assert.equal(profileTotals(null).steps, 0);
        assert.equal(profileTotals({ steps: 'not a list' }).steps, 0);
    });
});

describe('the terms are the oracle\'s wording, as source strings and their parameters', () => {
    const morning = profile([
        step({ seconds: 40, volume: 100 }),
        step({ seconds: 40, pump: 'pressure', pressure: 6 }),
        step({ seconds: 40 }),
    ]);

    test('the four terms, in Slate\'s order and format', () => {
        assert.equal(sentence(morning), '3 steps · max 2:00 · cap 100 mL · peak 6.0 bar');
    });

    test('every term travels as a STRING and its parameters, never as prose (D2)', () => {
        assert.deepEqual(profileTotalTerms(morning).map((term) => term.text), [
            '{count} steps', 'max {duration}', 'cap {volume} mL', 'peak {pressure} bar',
        ]);
        assert.deepEqual(profileTotalTerms(morning)[0].params, { count: 3 });
    });

    test('one step is singular, and it is a different source string', () => {
        assert.equal(profileTotalTerms(profile([step()]))[0].text, '{count} step');
    });

    test('the duration is m:ss, rounded rather than truncated', () => {
        assert.equal(formatCeilingDuration(0), '0:00');
        assert.equal(formatCeilingDuration(59.6), '1:00');
        assert.equal(formatCeilingDuration(125), '2:05');
        assert.equal(formatCeilingDuration(-5), '0:00');
    });
});
