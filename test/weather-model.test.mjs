/**
 * The corner's presentation rules, driven without a browser.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    MAX_AGE_MINUTES, CORNER_PERIODS, MODAL_PERIODS, WEATHER_STATE, WET_THRESHOLD,
    weatherState, windowOf, wetIndex, unitsOf, markFor, conditionWord, hoursOf, rangeOf,
} from '../src/lib/weather-model.js';

const period = (over = {}) => ({
    id: 'am', label: 'AM', fromHour: 6, toHour: 12, tomorrow: false,
    probability: 20, amount: 0.2, ...over,
});

const reading = (over = {}) => ({
    ok: true, place: 'Brunswick, Victoria, Australia', ageMinutes: 3,
    isDay: true, code: 2, temperature: 21.4, apparent: 20.8, humidity: 63,
    dewPoint: 14.1, wind: 11, windFrom: 'NW', pressure: 1014, units: 'metric',
    periods: [period(), period({ id: 'pm', label: 'PM', probability: 70, amount: 4.2 }),
              period({ id: 'night', label: 'NIGHT', probability: 35, amount: 1.1 })],
    ...over,
});

describe('the three states, and why two of them are not one', () => {
    test('a fresh reading shows', () => {
        assert.equal(weatherState(reading()), WEATHER_STATE.READING);
    });

    test('NO LOCATION PROMPTS rather than hides — the picker is behind the widget', () => {
        assert.equal(weatherState({ ok: false, reason: 'no_location' }), WEATHER_STATE.PROMPT);
    });

    test('every other failure hides', () => {
        for (const reason of ['offline', 'unknown_place', 'stale']) {
            assert.equal(weatherState({ ok: false, reason }), WEATHER_STATE.HIDDEN, reason);
        }
    });

    test('no reading at all hides — a plugin that is not installed is feature-absent', () => {
        assert.equal(weatherState(null), WEATHER_STATE.HIDDEN);
        assert.equal(weatherState(undefined), WEATHER_STATE.HIDDEN);
    });

    test('a reading with no temperature hides rather than drawing a blank number', () => {
        assert.equal(weatherState(reading({ temperature: null })), WEATHER_STATE.HIDDEN);
    });
});

describe('two hours, then hide', () => {
    test('inside the window it still shows', () => {
        assert.equal(weatherState(reading({ ageMinutes: MAX_AGE_MINUTES })), WEATHER_STATE.READING);
    });

    test('one minute past it hides', () => {
        assert.equal(weatherState(reading({ ageMinutes: MAX_AGE_MINUTES + 1 })), WEATHER_STATE.HIDDEN);
    });

    test('an unknown age is not treated as old — the plugin may not have said', () => {
        assert.equal(weatherState(reading({ ageMinutes: null })), WEATHER_STATE.READING);
    });

    test('the window is two hours', () => assert.equal(MAX_AGE_MINUTES, 120));
});

describe('the rolling window is TAKEN from the plugin, never re-sorted', () => {
    test('the corner takes two and the modal three', () => {
        assert.equal(windowOf(reading(), CORNER_PERIODS).length, 2);
        assert.equal(windowOf(reading(), MODAL_PERIODS).length, 3);
    });

    test('the order is the plugin\'s — first out is the one running', () => {
        const r = reading({ periods: [period({ label: 'NIGHT' }), period({ label: 'AM', tomorrow: true })] });
        assert.deepEqual(windowOf(r).map((p) => p.label), ['NIGHT', 'AM']);
    });

    test('fewer periods than asked for is not padded', () => {
        assert.equal(windowOf(reading({ periods: [period()] }), MODAL_PERIODS).length, 1);
    });

    test('no periods is an empty window, not a throw', () => {
        assert.deepEqual(windowOf(reading({ periods: undefined })), []);
        assert.deepEqual(windowOf(null), []);
    });
});

describe('exactly one cell carries the colour, and only when it is worth pointing at', () => {
    test('the wetter half wins', () => {
        assert.equal(wetIndex([period({ probability: 20 }), period({ probability: 70 })]), 1);
        assert.equal(wetIndex([period({ probability: 80 }), period({ probability: 35 })]), 0);
    });

    test('a dry day colours nothing — colouring the driest half says nothing', () => {
        assert.equal(wetIndex([period({ probability: 5 }), period({ probability: 0 })]), -1);
    });

    test('the threshold is inclusive', () => {
        assert.equal(wetIndex([period({ probability: WET_THRESHOLD })]), 0);
        assert.equal(wetIndex([period({ probability: WET_THRESHOLD - 1 })]), -1);
    });

    test('a missing probability is not a wet half', () => {
        assert.equal(wetIndex([period({ probability: null })]), -1);
    });
});

describe('units follow the plugin rather than being converted twice', () => {
    test('metric', () => assert.deepEqual({ ...unitsOf(reading()) },
        { temperature: '°C', rain: 'mm', wind: 'km/h' }));
    test('imperial', () => assert.deepEqual({ ...unitsOf(reading({ units: 'imperial' })) },
        { temperature: '°F', rain: 'in', wind: 'mph' }));
    test('an unstated unit set is metric', () => assert.equal(unitsOf({}).temperature, '°C'));
});

describe('WMO codes reach a mark this skin can draw', () => {
    test('the sky changes at night, the weather does not', () => {
        assert.equal(markFor(0, true), 'clear');
        assert.equal(markFor(0, false), 'clearNight');
        assert.equal(markFor(2, false), 'partlyNight');
        assert.equal(markFor(3, false), 'overcast', 'overcast looks the same at midnight');
        assert.equal(markFor(63, false), 'rain');
    });

    test('each group lands on its mark', () => {
        assert.equal(markFor(45), 'fog');
        assert.equal(markFor(53), 'drizzle');
        assert.equal(markFor(65), 'rain');
        assert.equal(markFor(73), 'snow');
        assert.equal(markFor(81), 'rain', 'showers are rain');
        assert.equal(markFor(85), 'snow', 'snow showers are snow');
        assert.equal(markFor(95), 'thunder');
    });

    test('an unknown or absent code does not throw', () => {
        assert.equal(markFor(null), 'overcast');
        assert.equal(markFor(1000), 'overcast');
    });

    test('the modal gets words the corner has no room for', () => {
        assert.equal(conditionWord(2), 'Partly cloudy');
        assert.equal(conditionWord(95), 'Thunderstorm');
    });
});

describe('the modal spells out the hours', () => {
    test('a daytime period', () => assert.equal(hoursOf(period()), '06:00 – 12:00'));
    test('the night wraps to 06', () => assert.equal(
        hoursOf(period({ fromHour: 18, toHour: 6 })), '18:00 – 06:00'));
    test('no period is an empty string, not a throw', () => assert.equal(hoursOf(null), ''));
});

describe('rangeOf — today\'s high and low', () => {
    test('a real pair comes back as numbers', () => {
        assert.deepEqual(rangeOf({ high: 23.4, low: 14.1 }), { high: 23.4, low: 14.1 });
    });

    test('a MISSING half is not half a pair', () => {
        /* One number under a MAX label is a claim the forecast did not make. */
        assert.equal(rangeOf({ high: 23, low: null }), null);
        assert.equal(rangeOf({ high: undefined, low: 14 }), null);
        assert.equal(rangeOf({}), null);
    });

    test('ZERO IS A TEMPERATURE, and null is not zero', () => {
        /* The trap this module keeps hitting: Number(null) is 0 and 0 is finite, so a
           truthiness test draws a missing high as a real zero degrees. */
        assert.deepEqual(rangeOf({ high: 0, low: -4 }), { high: 0, low: -4 });
        assert.equal(rangeOf({ high: null, low: 0 }), null);
    });

    test('a plugin too old to send them makes the pair absent, not an error', () => {
        /* weather.reaplugin 1.0.x asked Open-Meteo for `current` and `hourly` only. */
        assert.equal(rangeOf({ temperature: 21, code: 3, periods: [] }), null);
    });

    test('nothing at all is null, not a throw', () => {
        assert.equal(rangeOf(null), null);
        assert.equal(rangeOf(undefined), null);
        assert.equal(rangeOf('21'), null);
    });
});
