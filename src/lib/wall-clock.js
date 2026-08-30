/**
 * wall-clock.js — the time of day, spelled ONE way for the whole skin.
 *
 * TWO SURFACES SHOW A CLOCK and they must not disagree about what a time looks like.
 * The Live header has had one since the band was built; the screensaver gained one on
 * 24 August 2026 (Ben: "I want an option for this black screen to have a faint clock
 * showing the time in the same font the skin uses"). Two copies of an `Intl` option bag
 * is two places for `hourCycle` to drift, and the failure is silent — one screen says
 * 21:40 and the other says 9:40 PM, and each looks right on its own.
 *
 * So the formatter moved here, verbatim, and `live-screen.js` imports it.
 *
 * ===========================================================================
 * WHY h23, AND WHY THE LANGUAGE IS AN ARGUMENT
 * ===========================================================================
 *
 * `hourCycle: 'h23'` is 24-hour with a leading zero, and it is stated rather than left to
 * the locale: a machine panel reads a fixed-width time, and a locale that answers "9:40 AM"
 * changes the WIDTH of the field between morning and evening. The locale still decides the
 * separator and the digits, which is what makes it a translation rather than a rewrite.
 *
 * The language is passed in and never read from `navigator` here: this skin has its own
 * language setting (`storage-routes.js` `language`, the Units & Language leaf), and a
 * module that reached for the browser's would be a second answer to a question the user
 * has already been asked.
 *
 * DOM-free, and no clock of its own: the caller supplies the `Date`. That is what lets a
 * test assert the spelling of a fixed instant rather than of "now".
 */

import { defaultFor } from './settings-defaults.js';

/**
 * The tick that drives a clock display.
 *
 * A SECOND, NOT A MINUTE, and `live-screen.js`'s own paragraph is why: "a minute-long
 * interval displays the wrong minute for up to 59 seconds of every one, and re-arming to
 * the next boundary would be two mechanisms where one will do". The caller writes its
 * property only when the SPELLING changes, so the screen re-renders once a minute and not
 * sixty times.
 */
export const CLOCK_TICK_MS = 1000;

/**
 * The two ways a clock may be written, and the values the preference stores.
 *
 * Ben, 24 Aug 2026: "For the screen saver clock or clock in general we should give the
 * option to show 24hr or 12hr with am/pm added to 12 hr."
 *
 * `h23` is 24-hour with a leading zero. `h12` is 1-12 with the day period, and it is
 * `h12` rather than `h11` because `h11` writes midnight as 0:00 AM.
 */
export const CLOCK_FORMAT = Object.freeze({ H24: '24h', H12: '12h' });

/**
 * The shipped default — READ FROM THE DECISION TABLE, not stated a second time here.
 *
 * THIS CONSTANT USED TO SAY `CLOCK_FORMAT.H24`, with the comment "24-hour, which is what
 * the skin drew before the option existed". That sentence described the PAST, and it was
 * written before Ben decided anything: on 26 August 2026 he picked the defaults for every
 * setting the skin stores and `settings-defaults.js` records his answer as
 * `clockFormat: '12h'`. So the two halves of one preference disagreed, and the disagreement
 * was invisible from either side.
 *
 * WHAT IT COST, measured before the fix: on a tablet where nobody had touched the setting,
 * Settings › Units & Language › Time drew 12-hour selected — `settings.value('clockFormat')`
 * falls through to the table — while BOTH surfaces that actually write a time seeded
 * themselves from this constant and drew 21:40. `live-wiring.js` reads the router directly
 * and coerces anything that is not '12h' to this value; `ui-screensaver.js` subscribes to
 * the settings store, whose `subscribe` publishes the STORED value only and never
 * `defaultFor`, so an unwritten key arrives as `undefined` and is coerced the same way. A
 * control and its readers disagreeing about the same preference is the defect class this
 * fork exists to remove, and it was on the skin's primary screen.
 *
 * IMPORTING THE DECISION RATHER THAN COPYING IT is what makes that unrepeatable. Both files
 * are DOM-free `src/lib` modules and `settings-defaults.js` imports nothing, so there is no
 * cycle; and a test pins the two together so they cannot drift apart again.
 */
export const DEFAULT_CLOCK_FORMAT = defaultFor('clockFormat');

/**
 * A STORED VALUE, TURNED INTO ONE OF THE TWO — or into the shipped default.
 *
 * WHY THIS IS A FUNCTION AND NOT A TERNARY AT EACH READER, and it is the second half of
 * the 26 August bug rather than tidiness. Both surfaces that show a clock coerced the
 * stored value themselves, and both wrote the same line:
 *
 *     value === CLOCK_FORMAT.H12 ? CLOCK_FORMAT.H12 : DEFAULT_CLOCK_FORMAT
 *
 * That is "recognise 12-hour, and treat everything else as the default" — correct only
 * while the default WAS the other branch. The moment `DEFAULT_CLOCK_FORMAT` became Ben's
 * '12h', an explicitly chosen '24h' fell into the else and came back as 12-hour: the
 * setting could be moved on the Time page and neither clock would ever draw 24-hour again.
 * The ternary was right about the shape and wrong about which values are KNOWN, and the
 * only cure that stays right through the next change of default is to name the known set
 * once.
 *
 * AN UNRECOGNISED VALUE IS THE DEFAULT, not a throw: this comes out of stored preferences,
 * and a clock is not the surface on which to fail closed.
 */
export function normaliseClockFormat(value) {
    return value === CLOCK_FORMAT.H12 || value === CLOCK_FORMAT.H24
        ? value
        : DEFAULT_CLOCK_FORMAT;
}

/**
 * The time, in the given language and the given format.
 *
 * 24-HOUR IS FIXED-WIDTH AND 12-HOUR IS NOT, and that is the whole difference between
 * the two branches. `h23` gives a leading zero, so the string is five characters at every
 * hour; `h12` gives 1-12 and a day period, so it is "9:05 am" at one hour and "12:45 pm"
 * at another. Both are what the user asked for when they chose them, and the surfaces
 * that show a clock use tabular figures so only the LENGTH moves, never the digits.
 *
 * THE DAY PERIOD IS THE LOCALE'S, not a string this module appends. `hour12: true` makes
 * `Intl` write it, so it is "am/pm" in English and whatever the language uses elsewhere —
 * and it is placed where that language puts it, which a concatenation cannot do.
 *
 * AN UNKNOWN FORMAT IS 24-HOUR rather than a throw: this value comes out of stored
 * preferences, and a clock is not the surface on which to fail closed.
 *
 * AND `format` HAS NO PARAMETER DEFAULT, which is deliberate rather than an omission. It
 * used to default to `DEFAULT_CLOCK_FORMAT`, which was harmless while that constant was the
 * 24-hour branch's own value and became a hidden second policy the moment it became Ben's
 * 12-hour decision. A caller that has an opinion states it — all six do, by name — and a
 * caller with none gets the unknown-format branch above, which is 24-hour and is the same
 * answer this function has always given for an argument it does not recognise.
 */
export function wallClock(date, language, format) {
    const twelve = format === CLOCK_FORMAT.H12;
    return new Intl.DateTimeFormat(language || undefined, twelve
        ? { hour: 'numeric', minute: '2-digit', hour12: true }
        : { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

/**
 * A TIME OF DAY THAT IS NOT AN INSTANT — the same spelling, for the surfaces that hold an
 * hour and a minute rather than a `Date`. (Audit F-043, 29 August 2026.)
 *
 * THE DEFECT THIS CLOSES. Two settings surfaces write a time of day and neither went
 * through this module, so each invented its own rule and they disagreed with each other on
 * screen: `minutesToTime()` in `settings-bespoke-leaf.js` was unconditionally 24-hour and
 * `ui-time-picker`'s readout was unconditionally 12-hour, so the USB-Charger Sleep opener
 * read **23:00** and the dialog it opens read **11:00 PM** — one value, two spellings, one
 * press apart. A schedule row read `07:00` and its editor `07:00 AM`. And `clockFormat`, the
 * preference that decides this, was consumed by exactly two files, neither of them these.
 *
 * ONE FORMATTER, LITERALLY. This does not re-implement `wallClock`'s option bag or add a
 * second `Intl` call: it builds a carrier `Date` at the given hour and minute and hands it
 * to the function above. So the day period is still the LOCALE's and still placed where
 * that language puts it, the 24-hour face still has its leading zero, and there is still
 * exactly one place `hourCycle` is stated.
 *
 * THE DATE IS A CARRIER AND NOTHING ELSE — 1 January 2000, local time, because only the
 * hour and minute fields are ever read out of it. It is NOT `new Date()` with the time
 * replaced: a real "today" drags a date and a timezone into a function whose whole job is a
 * time of day, and would make this untestable across a DST boundary.
 *
 * AN OUT-OF-RANGE TIME IS THE EM DASH, not midnight. Zero is a real, settable time and must
 * not be what "not answered" looks like — `minutesToTime`'s own rule, kept.
 *
 * @param {number} h24     the hour, 0-23
 * @param {number} minute  the minute, 0-59
 * @param {string} format  `CLOCK_FORMAT.H12` / `.H24`; anything else is 24-hour
 * @param {string} [language] the skin's language setting. Never read from `navigator`.
 */
export function clockTime(h24, minute, format, language) {
    /* A NUMBER, NOT SOMETHING NUMBER() WOULD ACCEPT. `Number(null)` is 0 and `Number('7')`
     * is 7, so a coercing guard would turn "the machine has not answered" and a stray wire
     * string into midnight and seven o'clock — the exact substitution the em dash exists
     * to prevent. */
    if (!Number.isInteger(h24) || !Number.isInteger(minute)) return '—';
    if (h24 < 0 || h24 > 23 || minute < 0 || minute > 59) return '—';
    return wallClock(new Date(2000, 0, 1, h24, minute, 0, 0), language, format);
}

/** The same, from minutes since midnight (0-1439) — what ReaPrime stores a night time as. */
export function clockTimeFromMinutes(minutes, format, language) {
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1439) return '—';
    return clockTime(Math.floor(minutes / 60), minutes % 60, format, language);
}
