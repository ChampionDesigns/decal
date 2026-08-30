/**
 * One spelling of the time, for the two surfaces that show it.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    CLOCK_FORMAT, CLOCK_TICK_MS, DEFAULT_CLOCK_FORMAT, normaliseClockFormat, wallClock,
    clockTime, clockTimeFromMinutes,
} from '../src/lib/wall-clock.js';
import { STORED_DEFAULTS } from '../src/lib/settings-defaults.js';

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

describe('the time is spelled one way', () => {
    test('24-hour with a leading zero, at every hour', () => {
        /* THE LEADING ZERO IS THE POINT, not a preference: a machine panel reads a
         * fixed-width time, and a locale answering "9:40 AM" changes the WIDTH of the
         * field between morning and evening. */
        assert.equal(wallClock(new Date('2026-08-24T09:05:00'), 'en'), '09:05');
        assert.equal(wallClock(new Date('2026-08-24T21:40:00'), 'en'), '21:40');
        assert.equal(wallClock(new Date('2026-08-24T00:00:00'), 'en'), '00:00');
        assert.equal(wallClock(new Date('2026-08-24T23:59:00'), 'en'), '23:59');
    });

    test('midnight is 00, never 24, on every locale this skin offers', () => {
        /* `h23` and `h24` differ by exactly this, and `h24` answers "24:00" for midnight.
         * A clock that says 24:00 for one minute a day is the kind of thing nobody sees
         * until a photograph of it arrives. */
        for (const language of ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'pt', 'sv']) {
            assert.match(wallClock(new Date('2026-08-24T00:30:00'), language), /^0?0/,
                `${language} spells midnight with an hour that starts at zero`);
        }
    });

    test('an absent language is the platform default, never a throw', () => {
        assert.match(wallClock(new Date('2026-08-24T09:05:00'), ''), /09/);
        assert.match(wallClock(new Date('2026-08-24T09:05:00'), undefined), /09/);
        assert.match(wallClock(new Date('2026-08-24T09:05:00'), null), /09/);
    });

    test('the tick is a SECOND, and the reason is written where it is used', () => {
        assert.equal(CLOCK_TICK_MS, 1000);
    });

    test('the module reads no clock and no locale of its own', () => {
        const source = read('src/lib/wall-clock.js');
        const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
        assert.doesNotMatch(code, /Date\.now|new Date\(\)/);
        assert.doesNotMatch(code, /navigator/);
        assert.doesNotMatch(code, /document|window|localStorage/);
    });

    test('the shipped default is the one in the decisions table, not a second copy of it', () => {
        assert.equal(DEFAULT_CLOCK_FORMAT, STORED_DEFAULTS.clockFormat);
        assert.equal(DEFAULT_CLOCK_FORMAT, CLOCK_FORMAT.H12,
            "Ben's ruling, 26 August 2026: 12-hour everywhere");
    });

    test('an unnamed format is still 24-hour, which is the module\'s own contract', () => {
        assert.equal(wallClock(new Date('2026-08-24T21:40:00'), 'en'), '21:40');
        assert.equal(wallClock(new Date('2026-08-24T21:40:00'), 'en', 'nonsense'), '21:40');
        assert.match(wallClock(new Date('2026-08-24T21:40:00'), 'en', CLOCK_FORMAT.H12), /pm/i);
    });

    test('a stored 24-hour survives the read, which it did not for one afternoon', () => {
        assert.equal(normaliseClockFormat(CLOCK_FORMAT.H24), CLOCK_FORMAT.H24, 'a chosen 24-hour is kept');
        assert.equal(normaliseClockFormat(CLOCK_FORMAT.H12), CLOCK_FORMAT.H12);
        for (const unknown of [undefined, null, '', 'h23', '12', 12, {}]) {
            assert.equal(normaliseClockFormat(unknown), DEFAULT_CLOCK_FORMAT,
                `an unrecognised ${JSON.stringify(unknown)} is the shipped default, never a throw`);
        }
    });

    test('nobody keeps a second copy of the option bag', () => {
        for (const path of ['src/screens/live-screen.js', 'src/components/ui-screensaver.js']) {
            const code = read(path).replace(/\/\*[\s\S]*?\*\//g, ' ');
            assert.doesNotMatch(code, /hourCycle/, `${path} spells the option bag again`);
            assert.match(code, /wall-clock\.js/, `${path} must read the one formatter`);
        }
        for (const path of ['src/screens/live-wiring.js', 'src/components/ui-screensaver.js']) {
            const code = read(path).replace(/\/\*[\s\S]*?\*\//g, ' ');
            assert.doesNotMatch(code, /=== CLOCK_FORMAT\.H12 \?/,
                `${path} decides for itself what an unknown clock format is`);
            assert.match(code, /normaliseClockFormat/, `${path} must read the one normaliser`);
        }
    });
});

describe('F-043 — the same spelling for a time that is not an instant', () => {
    test('clockTime is wallClock, not a second option bag', () => {
        /* ASSERTED AS AN IDENTITY rather than against literal strings, so this holds in
         * every locale: the two functions must answer the same for the same time. */
        for (const format of [CLOCK_FORMAT.H24, CLOCK_FORMAT.H12]) {
            for (const [h, m] of [[0, 0], [7, 0], [11, 59], [12, 0], [13, 5], [23, 0]]) {
                assert.equal(
                    clockTime(h, m, format, 'en-US'),
                    wallClock(new Date(2000, 0, 1, h, m), 'en-US', format),
                    `${h}:${m} in ${format}`,
                );
            }
        }
    });

    test('the two faces of the measured case agree, in both formats', () => {
        for (const format of [CLOCK_FORMAT.H24, CLOCK_FORMAT.H12]) {
            assert.equal(
                clockTimeFromMinutes(23 * 60, format, 'en-US'),
                clockTime(23, 0, format, 'en-US'),
                `the opener and the picker disagree in ${format}`,
            );
        }
        /* AND THE TWO FORMATS ARE ACTUALLY DIFFERENT, so the test above cannot pass by
         * both faces being wrong in the same way. */
        assert.equal(clockTimeFromMinutes(23 * 60, CLOCK_FORMAT.H24, 'en-US'), '23:00');
        assert.equal(clockTimeFromMinutes(23 * 60, CLOCK_FORMAT.H12, 'en-US'), '11:00 PM');
        /* The schedule row's own case, 07:00. */
        assert.equal(clockTime(7, 0, CLOCK_FORMAT.H24, 'en-US'), '07:00');
        assert.equal(clockTime(7, 0, CLOCK_FORMAT.H12, 'en-US'), '7:00 AM');
    });

    test('midnight and noon, which are where a 12-hour clock goes wrong', () => {
        /* `h12` RATHER THAN `h11` — the module's own decision, and this is the pair that
         * proves it: `h11` writes midnight as 0:00 AM. */
        assert.equal(clockTime(0, 0, CLOCK_FORMAT.H12, 'en-US'), '12:00 AM');
        assert.equal(clockTime(12, 0, CLOCK_FORMAT.H12, 'en-US'), '12:00 PM');
        assert.equal(clockTime(0, 0, CLOCK_FORMAT.H24, 'en-US'), '00:00');
        assert.equal(clockTime(12, 0, CLOCK_FORMAT.H24, 'en-US'), '12:00');
    });

    test('an out-of-band time is the em dash, and zero is not', () => {
        /* `minutesToTime`'s own rule, kept: 0 is a real, settable time and must not be
         * what "not answered" looks like. */
        assert.equal(clockTimeFromMinutes(0, CLOCK_FORMAT.H24, 'en-US'), '00:00');
        for (const bad of [undefined, null, NaN, -1, 1440, '7', 7.5]) {
            assert.equal(clockTimeFromMinutes(bad, CLOCK_FORMAT.H24, 'en-US'), '\u2014', String(bad));
        }
        for (const [h, m] of [[24, 0], [-1, 0], [7, 60], [7, -1]]) {
            assert.equal(clockTime(h, m, CLOCK_FORMAT.H24, 'en-US'), '\u2014', `${h}:${m}`);
        }
    });

    test('an unrecognised format is 24-hour, the same answer wallClock gives', () => {
        assert.equal(clockTime(23, 0, 'nonsense', 'en-US'), '23:00');
        assert.equal(clockTime(23, 0, undefined, 'en-US'), '23:00');
    });

    test('the settings surfaces read the one formatter and keep no copy of their own', () => {
        for (const path of ['src/components/ui-time-picker.js', 'src/screens/settings-bespoke-leaf.js']) {
            const code = read(path).replace(/\/\*[\s\S]*?\*\//g, ' ');
            assert.match(code, /wall-clock\.js/, `${path} must read the one formatter`);
            assert.doesNotMatch(code, /hourCycle/, `${path} spells the option bag again`);
            assert.doesNotMatch(code, /hour12/, `${path} spells the option bag again`);
        }
    });
});
