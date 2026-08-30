/**
 * short-date.js — a served date, written the way a settings row can carry it.
 *
 * WHY THIS IS NOT IN `wall-clock.js`. That module's own first line is "the time of day,
 * spelled ONE way for the whole skin", and every constant in it — `CLOCK_TICK_MS`,
 * `CLOCK_FORMAT`, `DEFAULT_CLOCK_FORMAT` — belongs to a CLOCK: a thing that ticks, that a
 * user has a stored preference about, and that two live surfaces repaint once a minute. A
 * date stamped on a record by the server is none of those. It does not tick, there is no
 * preference to honour, and nothing repaints when it changes. Folding it in would have
 * made that file's header false about half its own contents, which in this tree is a
 * defect rather than untidiness.
 *
 * ===========================================================================
 * WHAT IT IS FOR, AND THE ROW THAT ASKED FOR IT
 * ===========================================================================
 *
 * Updates › Skin / App draws one line per installed skin, and until 27 August 2026 that
 * line reduced a full ISO timestamp to the single word "Checked". The served record
 * carries `reaMetadata.lastChecked` — "2026-08-12T05:59:27.904910" in the recorded
 * fixture — and the row threw all of it away. Worse, the word is CONSTANT once the
 * machine has checked anything at all: press "Update all skins" once and every row says
 * "Checked" for ever after, so the word stops distinguishing the rows from each other and
 * stops distinguishing today's check from one made in March. A control whose output never
 * varies is the defect class this fork exists to remove, and the cure was already on the
 * wire.
 *
 * ===========================================================================
 * A7 — AN UNPARSEABLE STRING IS NOT A DATE, AND NOT A ZERO EITHER
 * ===========================================================================
 *
 * `null` comes back for anything this function cannot honestly turn into a day and a
 * month: a non-string, an empty string, a string `Date` cannot parse, and — the case that
 * matters most — a string `Date` parses into `NaN`. The caller decides what absence looks
 * like, which is how every other reading in this skin works; a fallback invented here
 * would put a plausible date on screen for a value nobody read, which is precisely what
 * A7 forbids.
 *
 * THE LANGUAGE IS AN ARGUMENT, for the same reason `wallClock` takes one: this skin has
 * its own language setting (`storage-routes.js` `language`), and a module that reached for
 * `navigator.language` would be a second answer to a question the user has already been
 * asked. An empty or absent language falls to `Intl`'s own default, which is what the
 * runtime does with `undefined` and is not a value this module chose.
 *
 * DAY AND MONTH, NO YEAR. The quantity being reported is "how recently did the machine
 * look", and on a row beside a version string the year is noise for eleven months out of
 * twelve — Slate's own list carries no year either. A check made last year reads as "12
 * Aug" here, which is a real limitation and the reason `shortDate` is not the right tool
 * for a history record; it is the right tool for a freshness stamp on a settings row.
 *
 * DOM-free, and no clock of its own: the caller supplies the string. That is what lets a
 * test assert the spelling of a fixed instant rather than of "now".
 */

/**
 * One served ISO timestamp, as a day and an abbreviated month — or `null`.
 *
 * @param {unknown} iso        the served string, verbatim
 * @param {string} [language]  the skin's chosen language; empty falls to Intl's default
 * @returns {string|null}      e.g. "12 Aug", or null where there is nothing to say
 */
export function shortDate(iso, language) {
    if (typeof iso !== 'string' || iso.trim() === '') return null;
    const at = new Date(iso);
    /* `new Date('nonsense')` IS AN OBJECT, and it is the trap this line exists for: it is a
     * real Date whose time value is NaN, so every truthiness check passes and the formatter
     * throws a RangeError deep inside Intl. Testing the number is the only test that
     * actually asks whether a date was read. */
    if (Number.isNaN(at.getTime())) return null;
    return new Intl.DateTimeFormat(language || undefined, { day: 'numeric', month: 'short' }).format(at);
}

/**
 * One instant, as a day, an abbreviated month and a time — or `null`.
 *
 * THE SECOND ROW THAT ASKED (27 August 2026): Help › Talk to Decent's message thread.
 * Every message there carries a UNIX-seconds `now`, and a conversation needs the time as
 * well as the day — two messages on one afternoon are otherwise stamped identically, and
 * the whole point of a thread is that it has an order a reader can see.
 *
 * WHY IT LIVES BESIDE `shortDate` RATHER THAN IN THE CALLER. The argument in this module's
 * header is unchanged and covers both: a stamp on a served record is not a clock, so it is
 * not `wall-clock.js`'s; and the alternative — one `Intl.DateTimeFormat` option bag written
 * at each call site — is what Slate does, which is how the same app comes to spell one
 * kind of thing two ways. `shortDate` and this share the day-and-month decision by
 * construction: the option bag below is that one plus two time fields.
 *
 * IT TAKES A NUMBER OF MILLISECONDS, NOT A STRING, AND THAT IS THE ONE DIFFERENCE.
 * `shortDate`'s callers hold ISO strings because that is what ReaPrime serves them;
 * this one's caller holds UNIX seconds because that is what the Decent support backend
 * serves, and the conversion belongs at the call site where the unit is known. Converting
 * to a string first, only to parse it back, would be two chances to lose an hour to a
 * timezone.
 *
 * STILL NO YEAR, for the reason above it: a support conversation is recent by nature, and
 * a message a year old reading "12 Aug 09:14" is a real limitation stated here rather than
 * discovered later.
 *
 * A7 IS THE SAME. A value that is not a finite number, or that does not make a real Date,
 * is `null` and the caller decides what absence looks like. `new Date(NaN)` is an object
 * whose time value is NaN, so the number is what gets tested — see `shortDate`'s own note
 * on that trap.
 *
 * @param {unknown} ms         milliseconds since the epoch
 * @param {string} [language]  the skin's chosen language; empty falls to Intl's default
 * @returns {string|null}      e.g. "12 Aug, 09:14", or null where there is nothing to say
 */
export function shortDateTime(ms, language) {
    if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
    const at = new Date(ms);
    if (Number.isNaN(at.getTime())) return null;
    return new Intl.DateTimeFormat(language || undefined, {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(at);
}
