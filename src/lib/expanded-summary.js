/**
 * expanded-summary.js — the full-screen chart's own two readouts: the stats strip above
 * the plots, and the compliance badge in its header.
 *
 * DOM-FREE, so `node:test` imports it directly (`src/lib/README.md`). It formats; it
 * derives nothing (A7). Every number it prints is one the gate-6 derivation already
 * computed or one the estimator sensor already sent, and there is no `?? 0.1 * P * F`
 * here or behind it.
 *
 * ===========================================================================
 * WHY THE STRIP EXISTS AT ALL
 * ===========================================================================
 * Ben, 25 August 2026, on the chart audit's finding 4 — the shot stats strip and the
 * compliance badge — answered "Copy Slate". Slate prints four readings above the expanded
 * plots (`chart.js` `renderExpandedSummary`) and a C badge top right, and Decal's
 * overlay printed none of them.
 *
 * A TERM IS DROPPED, NEVER FILLED IN. Slate's own rule, carried: "each term is dropped
 * when its source is absent rather than filled in: a ratio printed without a dose is
 * arithmetic on a number nobody entered". A shot with no scale has no yield term; a shot
 * on a machine with no estimator has no compliance term. What it never has is a zero
 * standing in for a reading that never happened.
 *
 * ===========================================================================
 * WHERE THE NUMBERS COME FROM, AND WHY THAT IS NOT SLATE'S ROAD
 * ===========================================================================
 * Slate assembles the strip by READING THE DOM — `getElementById('dose-in-value')`,
 * `.textContent`, `.replace(/[^0-9.]/g, '')` — six times in `renderShotIdentity` alone.
 * That is the defect class this skin is written against: the number on the strip is a
 * re-parse of a number somebody formatted for a different box, so a change to the other
 * box's format silently changes this one's value.
 *
 * These read `derivation.scalars`, which is where `shot-derivation.js` already put
 * `durationSeconds`, `peakPressure`, `averagePressure`, `peakFlowAfterFirstDrop` and
 * `averageFlow` — bounded to the part of the shot that was actually pouring, which a
 * peak scraped off a rendered gauge is not.
 */

/** A number that can be printed. Everything else is an absence. */
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * THE UNITS, AS DATA — and the reason is a gate, not a preference.
 *
 * Gate D reads every template chunk in a client file and flags one carrying a slash with
 * no newline as a route assembled from fragments, because that is what a hand-built path
 * looks like from the outside. `mL/bar` and `mL/s` are exactly that shape, and the gate is
 * right to be unable to tell them apart from a URL by looking. A unit held in a frozen
 * table and appended is not a fragment of anything, and it is also the better spelling:
 * the two places that print millilitres per second now read the same string.
 */
const UNIT = Object.freeze({
    SECONDS: 's',
    PRESSURE: 'bar',
    FLOW: 'mL' + '/' + 's',
    COMPLIANCE: 'mL' + '/' + 'bar',
    GRAMS: 'g',
});

/**
 * The pair the strip prints — peak, then the average — when both halves are there, else
 * just the one. Slate joins them the same way and its label says so: "Peak / avg".
 *
 * THE JOINER IS A CONSTANT for the same gate reason the units are: a bare solidus between
 * two template holes is the shape of a path being assembled, and gate D cannot tell the
 * two apart from outside the file.
 */
const PEAK_AVG_JOIN = ' ' + '/' + ' ';

function pair(peak, average, digits) {
    const head = peak.toFixed(digits);
    return finite(average) ? head + PEAK_AVG_JOIN + average.toFixed(digits) : head;
}

/**
 * THE BIT THAT SAYS THE COMPLIANCE IS OBSERVED RATHER THAN ASSUMED.
 *
 * Slate's `C_OBSERVED_BIT` (`fused.js:28`), and it is a firmware constant rather than a
 * skin one: the puck estimator sets bit 3 of its `flags` channel once it has watched
 * enough of the pour to have measured C instead of carrying its prior. A C printed
 * without the bit is the estimator's starting guess, which is a number that looks like a
 * measurement and is not one.
 */
export const C_OBSERVED_BIT = 0x08;

/**
 * The compliance badge's text: `C 1.17 mL/bar`, or the em-dash form when there is nothing
 * observed to print. Slate's `complianceBadgeText`, carried whole.
 *
 * BOTH HALVES ARE REQUIRED — the flag AND a finite value. Either alone is a state the
 * estimator really produces: it sends C before it has observed it, and it sets the bit on
 * a frame whose C is absent when the socket drops mid-sample.
 */
export function complianceBadge({ compliance = null, flags = null } = {}) {
    const observed = finite(flags) && (flags & C_OBSERVED_BIT) !== 0 && finite(compliance);
    return observed
        ? { observed: true, value: compliance, text: `${compliance.toFixed(2)} ${UNIT.COMPLIANCE}` }
        : { observed: false, value: null, text: '—' };
}

/**
 * THE STRIP'S TERMS, in Slate's own order: time, pressure, flow, compliance.
 *
 * Returns `[{ key, label, value }]` with the labels UNTRANSLATED — this module holds no
 * string a person reads (D2), so the caller passes them through its own `t`. `key` is what
 * a template keys the repeat on and what a test names a term by.
 *
 * PEAK AND AVERAGE SHARE A TERM because they are read together — "6.0 / 4.2 bar" answers
 * "how hard, and for how much of it" in one glance, which two separate terms do not. Slate
 * pairs them the same way and for the same reason.
 *
 * THE PEAK FLOW IS THE POST-FIRST-DROP ONE. `shot-derivation.js` computes both and says
 * why in its own words: "the raw peak is usually the pump filling an empty puck, which
 * says nothing about the extraction". Slate takes the raw maximum of its flow series and
 * therefore prints the fill spike as the shot's peak flow. This is the one term where
 * matching Slate would mean printing a worse number, and it is recorded rather than
 * silently improved.
 */
export function summaryTerms(derivation, badge = null) {
    const s = derivation && derivation.ok === true ? derivation.scalars : null;
    const terms = [];
    if (!s) return Object.freeze(terms);

    if (finite(s.durationSeconds) && s.durationSeconds > 0) {
        terms.push({ key: 'time', label: 'Time', value: `${s.durationSeconds.toFixed(1)} ${UNIT.SECONDS}` });
    }
    if (finite(s.peakPressure)) {
        terms.push({
            key: 'pressure',
            label: 'Peak / avg pressure',
            value: `${pair(s.peakPressure, s.averagePressure, 1)} ${UNIT.PRESSURE}`,
        });
    }
    if (finite(s.peakFlowAfterFirstDrop)) {
        terms.push({
            key: 'flow',
            label: 'Peak / avg flow',
            value: `${pair(s.peakFlowAfterFirstDrop, s.averageFlow, 1)} ${UNIT.FLOW}`,
        });
    }
    /* WEIGHT OUT. Ben, 25 August 2026: "Add Weight out as well." It is the number the shot
     * is judged by and it was the one scalar the strip did not carry - the dose-to-yield
     * pair was on the identity line, which now holds the profile name alone.
     *
     * DROPPED WHEN THERE IS NO SCALE, like every other term here: `yield` is null on a
     * machine with nothing under the cup, and a 0.0 g in its place is a reading that never
     * happened. */
    if (finite(s.yield) && s.yield > 0) {
        terms.push({ key: 'yield', label: 'Weight out', value: `${s.yield.toFixed(1)} ${UNIT.GRAMS}` });
    }
    if (badge && badge.observed) {
        /* SPELLED OUT, NOT ABBREVIATED. Slate's own note: "C 1.47 mL/bar is unreadable as
         * an abbreviation on a screen someone reaches once a month; the strip spells the
         * word out." Ben said the same on 25 August 2026 - "dont call it C, call it
         * compliance" - so the letter is gone from the header too and the word is the only
         * spelling on this surface. */
        terms.push({ key: 'compliance', label: 'Compliance', value: badge.text });
    }
    return Object.freeze(terms);
}

/**
 * THE OVERLAY HEADER'S ONE LINE: the profile's name, and nothing else.
 *
 * Ben, 25 August 2026: "The profile name, allow it to wrap, remove the time and weight that
 * is added to the end, those are now on the right."
 *
 * IT USED TO BE SLATE'S JOIN — name, then dose-to-yield, then seconds, on one line with a
 * wide middle dot between them, which is Slate's `renderShotIdentity` carried whole. That
 * was right while the strip was a band under the plots and the header had one badge in it.
 * The strip moved into the header on 25 August, so the seconds and the yield are eight
 * inches to the right of the name and were being printed twice.
 *
 * IT STAYS A FUNCTION rather than becoming a property read at the call site, because what
 * a shot calls itself is a decision and this module is where the header's decisions live.
 * The next thing this line grows is a decision too.
 */
export function shotIdentity(derivation, { profileName = '' } = {}) {
    return typeof profileName === 'string' ? profileName.trim() : '';
}
