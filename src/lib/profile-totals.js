/**
 * profile-totals.js — a PROFILE's ceilings, as terms a header can say out loud.
 *
 * Fix run 4 (the editor), finding `cmp-seh-3` — Ben: RESTORE THE FULL SETUP. Slate's
 * editor header carries the profile's identity on every tab, and the fourth line of it is
 * a totals sentence:
 *
 *   CITE prov-baseline/editor-steps.json [i=6]
 *        <p id="editor-profile-totals" class="pe-profile-totals" aria-live="polite">
 *        text "3 steps · max 2:00 · cap 100 mL · peak 6…" (the walker truncates at 40
 *        characters; the full sentence is Ben's roster wording, "3 steps · max 2:00 ·
 *        cap 100 mL · peak 6.0 bar"), rect [30, 91, 430, 23], font-size 15px, weight 600,
 *        colour rgb(148, 161, 169) — the muted register, under the title.
 *
 * ===========================================================================
 * WHY IT IS A MODULE AND NOT FOUR LINES IN THE SCREEN
 * ===========================================================================
 * Three surfaces want these four numbers and two of them are not this wave's: the editor
 * header (here, now), the selector's summary tiles (`cmp-seh-1`, Ben's roster — Temp ·
 * Peak · Steps · Stop At), and any later place that wants to say how long a profile can
 * run. Slate had exactly one module for it (`app/src/modules/profile-totals.js`, whose
 * `profileTotals` feeds BOTH the header terms and the selector tiles) and that is the one
 * structural thing about the original worth carrying: one reading of a profile's
 * ceilings, so two surfaces cannot disagree about the same profile.
 *
 * DOM-free, store-free, i18n-free — `src/lib/` is "plain ES modules with no DOM access",
 * so every line here runs under `node:test`. The terms leave as SOURCE STRINGS with their
 * parameters (D2), never as sentences: the caller's own `t()` renders them, which is what
 * makes the header re-render on a language change rather than caching English.
 *
 * ===========================================================================
 * THEY ARE CEILINGS, AND THE WORDING SAYS SO
 * ===========================================================================
 * Slate's own note, kept because it is right: "The four terms are CEILINGS, not
 * predictions. A step normally exits early on its own condition, so the duration and
 * volume a shot actually reaches are almost always lower. Wording them as ceilings
 * ('MAX', 'CAP') is the whole point: a predicted duration that the machine then beats
 * reads as a bug."
 *
 * A TERM THE PROFILE DOES NOT OWN IS OMITTED, never zeroed. A profile with an unbounded
 * step has no duration ceiling at all, and "max 0:00" would be a limit that does not
 * exist. Same rule as `profile-preview.js`'s refusals and `shot-summary.js`'s nulls: the
 * absence is reported as an absence.
 *
 * ===========================================================================
 * THE PEAK TRAP, WHICH IS WHY THIS IS A PORT AND NOT A COPY
 * ===========================================================================
 * Slate computed the peak like this (`profile-totals.js:33-35`, read-only):
 *
 *     const pressures = steps
 *         .map(s => (s?.pump === 'pressure' ? Number(s.pressure) : Number(s?.limiter?.value)))
 *
 * — so for every step that is NOT a pressure step it reports the step's LIMITER, which is
 * a ceiling the pump may never reach and, on a flow step, is usually the machine's
 * default 9.0 bar. A gentle 2 mL/s flow profile therefore reported "peak 9.0 bar" on
 * Slate's own screen. That is the misreport named in the final review's `cmp-seh-1`
 * evidence and in Ben's roster answer ("PEAK MUST BE COMPUTED CORRECTLY").
 *
 * THE FIX IS TO COMPOSE THE OWNER RATHER THAN TO WRITE A SECOND RULE. `profile-modes.js`
 * `stepTargetOverlay(step)` already answers "what pressure does this step COMMAND?" for
 * every one of the four pump modes, and it is the answer the live chart's target trace and
 * the editor's preview graph both draw:
 *
 *     pressure -> the step's pressure          flow  -> null (it commands no pressure)
 *     power    -> the limiter cap (the mode's commanded pressure, by that module's own
 *                 model: "Power draws flow 0 and pressure AT THE CAP")
 *     lever    -> P0
 *
 * So the peak here is the maximum of what the profile's steps command, and a flow step
 * contributes nothing — which is the whole of the correction. If the model of what a
 * Power step commands ever changes, it changes in one file and this term follows.
 */

import { stepTargetOverlay } from './profile-modes.js';

/** The separator Slate sets between the terms. Punctuation, not a translatable string. */
export const TOTALS_SEPARATOR = ' · ';

const stepsOf = (profile) => (Array.isArray(profile?.steps) ? profile.steps : []);
const positive = (value) => (Number.isFinite(value) && value > 0 ? value : null);

/**
 * m:ss — the shot-clock format the rest of the skin uses, and Slate's own
 * `formatCeilingDuration`. Seconds are rounded, never truncated.
 */
export function formatCeilingDuration(totalSeconds) {
    const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The profile's four ceilings, or `null` for any the profile does not define.
 *
 * @param {object|null} profile  a DE1 v2 profile (the `record.profile` shape)
 * @returns {{steps:number, maxSeconds:number|null, capVolume:number|null,
 *            peakPressure:number|null}} frozen
 */
export function profileTotals(profile) {
    const steps = stepsOf(profile);

    /* A STEP WITH NO POSITIVE DURATION IS UNBOUNDED IN TIME, so the profile is too and
     * there is no ceiling to state. An empty profile has none either — zero steps is not
     * a zero-second shot. */
    const seconds = steps.reduce((sum, step) => sum + (Number(step?.seconds) || 0), 0);
    const unbounded = steps.length === 0 || steps.some((step) => positive(Number(step?.seconds)) === null);

    const volumes = steps.map((step) => positive(Number(step?.volume))).filter((v) => v !== null);

    /* THE PEAK, FROM THE ONE OWNER OF "WHAT DOES THIS STEP COMMAND" — see the header for
     * what Slate did instead and what it cost. A step whose commanded pressure is null
     * contributes nothing; it is not a zero. */
    const pressures = steps
        .map((step) => positive(Number(stepTargetOverlay(step)?.pressure)))
        .filter((v) => v !== null);

    return Object.freeze({
        steps: steps.length,
        maxSeconds: unbounded ? null : seconds,
        capVolume: volumes.length ? Math.max(...volumes) : null,
        peakPressure: pressures.length ? Math.max(...pressures) : null,
    });
}

/**
 * THE HEADER'S TERMS, as `{text, params}` pairs in Slate's own order and wording.
 *
 * `text` is the SOURCE STRING, so the caller renders it through its own `t()` and the
 * catalogue picks it up from this file (D2 — a value, never a baked sentence). The
 * numbers are already formatted, because their format is a fact about the value (one
 * decimal on bar, m:ss on a duration) and not something a translation should own.
 *
 * A term the profile does not define is absent from the list rather than empty, so a
 * caller joins whatever it is handed and never renders a dangling separator.
 *
 * @param {object|null} profile
 * @returns {ReadonlyArray<{text:string, params:object}>}
 */
export function profileTotalTerms(profile) {
    const totals = profileTotals(profile);
    const terms = [
        totals.steps === 1
            ? { text: '{count} step', params: { count: totals.steps } }
            : { text: '{count} steps', params: { count: totals.steps } },
    ];
    if (totals.maxSeconds !== null) {
        terms.push({ text: 'max {duration}', params: { duration: formatCeilingDuration(totals.maxSeconds) } });
    }
    if (totals.capVolume !== null) {
        terms.push({ text: 'cap {volume} mL', params: { volume: String(totals.capVolume) } });
    }
    if (totals.peakPressure !== null) {
        terms.push({ text: 'peak {pressure} bar', params: { pressure: totals.peakPressure.toFixed(1) } });
    }
    return Object.freeze(terms.map((term) => Object.freeze(term)));
}
