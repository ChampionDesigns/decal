/**
 * history-power-page.js — <history-power-page>, the History route's THIRD page and the
 * one surface D1's carve-out was reversed for.
 *
 * ===========================================================================
 * WHY THIS PAGE EXISTS AT ALL, AND WHAT IT IS NOT
 * ===========================================================================
 * D1 keeps the derived/puck channels out of v1, and every other surface still honours
 * that: the Live foot band's derived list stays dead, the fused/detector machinery stays
 * deleted, and the two experimental flags still have no reader. Ben reversed the carve-out
 * for THIS page and only this page — "the power page should still be there, same charts as
 * before are required" (BEN_DECISIONS_2026-08-21.md) — so what lands here is one route
 * with three tabs, not the derived channels coming back everywhere.
 *
 * A7 IS UNTOUCHED BY THE REVERSAL and is the reason the page is small. The skin does not
 * derive R, Z or W: `shot-derivation.js` reads all three through `shot-source-selector`'s
 * B6 choice (the puck estimator's MEASURED channel first, ReaPrime's own recomputed-on-read
 * `*Derived` key second, an absence when neither is served), exactly as it reads pressure.
 * They have been gate-6 SERIES_KEYS since wave 3 with nothing rendering them. This page is
 * the rendering consumer and adds no arithmetic of its own; `history-power.js` holds the
 * shapes and derives nothing either.
 *
 * ===========================================================================
 * THE TWO CHARTS
 * ===========================================================================
 * 1. THE DERIVED-CHANNEL TIME CHART. R and Z against time, on ONE LOG AXIS, and nothing
 *    else on the chart. Ben, 25 August 2026: "Power will be on the Pressure/Flow chart,
 *    not on the resistance / impedance chart. No second axis on these charts."
 *
 *    THE PAGE USED TO DRAW W HERE, ON A REAL RIGHT-HAND AXIS, and that was a fair fix to
 *    a real defect — Slate put Power on `yaxis: 'y2'` and no chart factory it had would
 *    accept a y2 spec, so the trace rendered on an invisible auto-ranged axis
 *    (`history-viewer.js:56-59`), a number on screen with no scale beside it. But the fix
 *    chose the wrong side of the page. W belongs with pressure and flow, where it needs no
 *    axis of its own; the page it was moved OFF is the one whose two channels are a
 *    matched pair. The `y2` property `<ui-chart-card>` grew for it stays — the steam chart
 *    is its other consumer and needs it — and this page now sets it to null.
 *
 *    LOG, AND ALL THREE PARTS OF IT ARE STATED. `uplot-plot.js` builds linear scales only,
 *    so the axis is the DATA in log10 against a range in log10 units with the ticks
 *    formatted back to real numbers. `history-power.js` owns the range, the ladder and the
 *    formatter; this page wires them and applies the same transform to the records.
 *
 * 2. THE P–Q TRAJECTORY. Pressure against flow: the one chart in the skin whose x axis is
 *    not time. Time is the COLOUR, which is what the #11 time key beside it is the axis
 *    for. It is drawn by the plot layer's bands path rather than as a uPlot series, and
 *    that is a mechanism rather than a preference — flow is not monotonic, and a series is
 *    drawn in index order against a sorted scale, so a P–Q "line" is a polyline in data
 *    coordinates and always was ("Only the pressure/flow trajectory is different, and that
 *    one is handled by drawing coloured segments directly", `uplot-plot.js:9-10`).
 *
 * THE CORRESPONDENCE MARKS (Q16) ARE LIVE. A time offset cannot move a P–Q path, so the
 * compare bar would otherwise be a control that visibly does nothing on this page. What it
 * moves is the marks: a handful of round instants on A's clock, marked on both paths and
 * joined by a faint link, answering the question the slider is actually for — when A was
 * 12 seconds in, where was B? `history-power.js` `correspondenceMarks` owns the arithmetic
 * and carries Slate's own reasoning; the LOOK is pinned as a deferred question for Ben's
 * bench pass, because the marks have never been on a screen in either tree.
 *
 * ===========================================================================
 * THE SAME PATTERNS THE FLOW PAGE USES, AND FOR THE SAME REASONS
 * ===========================================================================
 * Two #9 chart cards on RATIO TRACKS with no px height anywhere (H1); the A/B composition
 * laid on the shipped card through `setChannels`/`setRecords` after
 * `await card.updateComplete`, with `setRuleSource` as the seam that survives a retheme. Every one of those is `history-flow-page.js`'s, and the
 * machinery is IMPORTED rather than restated — `history-series.js` builds the specs and the
 * records, `history-compare.js` owns the union clock and the window.
 *
 * ONE ADDITION TO THAT MACHINERY, and it is one word: `abChannelSpecs` now takes a `scales`
 * map, because this is the first page with two y scales and B's copy of a channel must sit
 * on the same axis A's does.
 *
 * ===========================================================================
 * WHAT THIS PAGE DOES NOT DO
 * ===========================================================================
 * No fetch, no store, no endpoint (wave 3's law for anything holding a chart): two
 * derivations and an offset arrive as properties. No smoothing, no resampling, no fallback
 * computation of any of the three channels (A7). Nothing parses a number out of rendered
 * text (chart-C13). No layout computed in JavaScript. D2: every readable string is read
 * through `I18nController` from this file's first commit.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';
import {
    COMPARISON_ALPHA, COMPARISON_DASH,
    abChannelSpecs, abRecords, legendItems,
} from 'src/lib/history-series.js';
import {
    comparisonStepRules,
    compareOnOneClock,
    comparisonWindow,
} from 'src/lib/history-compare.js';
import { failureRefusal } from 'src/lib/history-viewer.js';
import { dashPattern } from 'src/lib/chart-axis.js';
/* THE CURSOR'S OTHER HALF (audit F-032 for the derived chart, F-034 for the trajectory).
 * `chart-readout.js` owns the rounding and the units; this page owns which card a reading
 * belongs to and what its terms are called. */
import {
    readoutLine, readoutTerms, readoutValues, trajectoryTerms,
} from 'src/lib/chart-readout.js';
import { DEFAULT_CHANNELS } from 'src/components/ui-chart-card.js';
import {
    DERIVED_CHANNELS, DERIVED_SCALES,
    correspondenceMarks, derivedLeftRange, derivedTickValues, formatLogTick, logRecords,
    noDerivedChannels, rampColour, trajectoryFrame, trajectoryPoints, trajectorySpan,
} from 'src/lib/history-power.js';

import 'src/components/ui-chart-card.js';
import 'src/components/ui-chart-legend.js';
import 'src/components/ui-time-key.js';
import 'src/components/ui-empty-state.js';

/** The mount contract's own attribute value, so a caller writing the tag gets it. */
export const POWER_PAGE_ID = 'power';

/* `POWER_SINGLE_PLOT_PX` STOOD HERE AND IS RETIRED (Ben, 30 Aug 2026 — F-036), with the
 * single-plot branch it measured and the "Which plot" select that was its only control.
 * It was 468 = (254, the derived card's floor with a legend) + (202, the trajectory
 * card's floor without one) + 12 (--ui-space-3), written as a literal because `var()` is
 * not substituted inside `@container (...)`. The flow page's header carries the whole
 * disposal, and it applies here word for word: the branch was unreachable in the shipped
 * app (`app-fit.js` never yields a design height under 1200), the picker measured
 * `display: none` at all five viewports Wave 3 swept, and the select could not be removed
 * on its own without leaving one card permanently unreachable below the threshold.
 */

/** The two plots, in the order the page draws them. */
export const POWER_PLOTS = Object.freeze([
    Object.freeze({ id: 'derived', label: 'Puck resistance and power' }),
    Object.freeze({ id: 'trajectory', label: 'Pressure against flow' }),
]);

/**
 * The channel labels for the key, by derivation key.
 *
 * Each names a QUANTITY AND ITS UNIT, which is what a key beside a plot is for, and the
 * units are ReaPrime's own from the three `DUPLICATED_QUANTITIES` rows
 * (`shot-source-selector.js:84-105`) rather than units this file decided. Power says which
 * axis it is on, because it is the only trace not on the left one and a key that did not
 * say so would leave the reader to guess which scale to read it against — chart-C14's
 * complaint about an unnamed axis, arriving from the key's side.
 *
 * SHORT, AND MEASURED. The full names live on the CARD (its accessible name is "Puck
 * resistance and load impedance"), because a chip row is one auto track
 * in the card's grid and a row that wraps takes its height out of the plot: at 900px with
 * the long forms the legend measured 96px against the 44px the card reserves, and the
 * card's floor grew with it. The symbol and the unit are what a key has to carry.
 */
const CHANNEL_LABELS = Object.freeze({
    resistance: 'R — resistance (bar·s²/mL²)',
    impedance: 'Z — impedance (bar·s/mL)',
});

/** The ten ramp stops, by custom property name. Read computed; declared in CSS (A6). */
const RAMP_TOKENS = Object.freeze(
    Array.from({ length: 10 }, (_, i) => `--ui-timekey-stop-${i}`),
);

/** No rules at all — the payload `setRules` takes for "this plot annotates nothing". */
const NO_RULES = Object.freeze({ vertical: [], horizontal: [], labels: [] });

/** One frozen empty map, so a resting legend is handed the same object every render. */
const NO_VALUES = Object.freeze({});

/** One frozen empty list, for a legend that has hidden nothing. */
const EMPTY_KEYS = Object.freeze([]);

/**
 * The TRAJECTORY's readout terms, named. `chart-readout.js` answers in keys because it
 * holds no word a person reads (D2); these are the words, and they are translated at the
 * point of use like every other string on this page.
 *
 * THE TIME IS A TERM WITH NO LABEL. "12.3 s" already says what it is, and "Time 12.3 s"
 * in a three-term line is the only one that would need reading twice.
 */
const TRAJECTORY_TERM_LABELS = Object.freeze({
    pressure: 'Pressure',
    flow: 'Flow',
});

export class HistoryPowerPage extends UiElement {
    static properties = {
        /** Shot A's gate-6 derivation — the REFERENCE, the one that does not move. */
        derivationA: { attribute: false },

        /** Shot B's, or null for "no comparison". The one the offset slides. */
        derivationB: { attribute: false },

        /** The store's typed failure, VERBATIM, or null. See the flow page's property. */
        failure: { attribute: false },

        /** The alignment offset in seconds, ALREADY CLAMPED by <ui-compare-bar>. */
        offset: { type: Number },

        /* `plot` STOOD HERE AND IS RETIRED with the branch it selected (Ben, 30 Aug
         * 2026 — F-036). See the flow page's header. */

        /**
         * WHERE THE POINTER IS, PER CARD — `{ derived: detail, trajectory: detail }`.
         *
         * Internal state, held as the card's own frozen `cursor-change` detail; the two
         * things a reader gets are composed from it at render time. See the flow page's
         * property, which this one mirrors — the trajectory's detail additionally carries
         * `point`, because its x is flow and there is no index into a shared clock.
         */
        _cursor: { state: true },

        /** The channels the derived card's legend is hiding — `{ derived: [key] }`. */
        _hidden: { state: true },
    };

    static styles = [css`
        /* NO BACKTICK IN THIS TEMPLATE, comment or not (CONVENTIONS §9).
         *
         * THE HOST IS THE GRID ITEM AND HANDS THE CELL STRAIGHT ON, and #grid exists for
         * the same language limit the flow page records: an element is never its own query
         * container, so the track list that CHANGES has to live one box in. */
        :host {
            display: grid;
            grid-template-rows: minmax(0, 1fr);
            grid-template-columns: minmax(0, 1fr);
            container-type: size;
            min-block-size: 0;
            min-inline-size: 0;
        }

        /* THE TRACK LIST. The trajectory is the taller track because its SHAPE is what is
         * read - a loop flattened into a strip says nothing a reader can use - and Slate
         * sized the same pair 330px and 600px (index.html:514-520), a ratio of 1 : 1.8.
         *
         * 1.4 AND NOT 1.8, AND IT IS A MEASUREMENT RATHER THAN A PREFERENCE. Slate's pair
         * lived in a SCROLLING overlay; this pair lives in a fitted region, and at the
         * bench that region is 591px. At 1 : 1.8 the first track asks for 206.8 while the
         * derived card's own floor is 238, so the floor wins and the rendered split is
         * 238 / 341 - a track list the layout never honours, which is exactly the class of
         * declaration H1 counts (declared 416/344/360/592, rendered 404/334/308.6/507.4).
         * At 1 : 1.4 the split is 241.25 / 337.75, both above their floors, and the ratio
         * is the thing that decides. RATIO TRACKS, NEVER PX (H1): there is not a px length
         * in this rule. */
        #grid {
            display: grid;
            grid-template-rows: 1fr 1.4fr;
            gap: var(--ui-space-3);
            min-block-size: 0;
            min-inline-size: 0;
        }

        ui-chart-card {
            min-inline-size: 0;
        }

        /* THE DERIVED CHART'S ANNOUNCED READING — the flow page's .reading, for the same
         * reason and with the same shape. The numbers a reader SEES are on the legend's
         * chips, in the row the card already reserves; the time is the term no chip can
         * hold, and a visible foot strip would take its height out of the plot the moment
         * a finger touched the well. */
        .reading {
            display: block;
            block-size: 0;
            clip-path: inset(50%);
        }

        /* THE TRAJECTORY'S READING IS VISIBLE, AND IT HAS TO BE. This card carries no
         * legend at all — its key is the colour strip beside it — so there is no chip to
         * put a number on, and F-034's whole complaint is that the scrub names nothing.
         *
         * ITS HEIGHT IS RESERVED WHETHER OR NOT IT HAS WORDS, which is the difference
         * between a readout and a jolt: text appearing on pointerdown would take its own
         * height out of the plot underneath the finger that is reading it. One line of
         * .ui-caption type (--ui-text-note at the 1.5 ratio type-roles.js sets), stated
         * the way tokens.css states every other one-line reserve.
         *
         * IT DOES NOT MOVE THE CARD'S FLOOR. This rule is the PAGE styling a slotted
         * child, so the card's own min-block-size is untouched — which is what decides
         * when #grid begins to scroll now that the threshold constant is retired. */
        .trajectory-reading {
            display: block;
            min-block-size: calc(var(--ui-text-note) * 1.5);
            font-size: var(--ui-text-note);
            line-height: 1.5;
            /* IT STARTS WHERE THE DATA STARTS. uPlot keeps a gutter for the axis labels
             * and this tree states it as a token; a reading that began at the card's edge
             * would sit 70px left of the first gridline, which is the same complaint the
             * legend's own inset answers. */
            padding-inline-start: var(--ui-chart-gutter-l);
            color: var(--ui-muted);
        }

        /* THE TRAJECTORY AND ITS KEY ARE ONE ROW. Slate's .slate-chart-with-key, and its
         * reason carried: "a chart that carries a key beside it, rather than inside its own
         * plot area. The trajectory is the only one: its colour is an axis, so the key has
         * to be read as part of the chart while staying out of the data."
         *
         * align-items: stretch is what makes the strip the chart's own height without any
         * height being stated anywhere: #11 is flex 1 1 auto inside a box this row sizes. */
        #trajectory {
            display: flex;
            flex-direction: row;
            align-items: stretch;
            gap: var(--ui-space-3);
            min-block-size: 0;
            min-inline-size: 0;
        }

        #trajectory ui-chart-card {
            flex: 1 1 auto;
        }

        /* THE SINGLE-PLOT BRANCH STOOD HERE (H1) AND IS RETIRED — Ben, 30 Aug 2026,
         * F-036. It was "@container (block-size < 468px)", and it hid whichever of the two
         * cards "plot" did not name. See the flow page's header for the disposal. */
    `];

    #i18n = new I18nController(this);

    /** The identity of the state last laid down, so an unrelated update costs nothing. */
    #appliedToken = '';

    constructor() {
        super();
        this.derivationA = null;
        this.derivationB = null;
        this.failure = null;
        this.offset = 0;
        this._cursor = {};
        this._hidden = {};
    }

    /** The mount contract, honoured by the page itself — see the flow page. */
    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('slot')) this.setAttribute('slot', 'page');
        if (!this.hasAttribute('data-page')) this.setAttribute('data-page', POWER_PAGE_ID);
    }

    render() {
        const t = this.#i18n.t;
        const a = this.derivationA;
        const hasA = Boolean(a && a.ok);
        const refusal = failureRefusal(this.failure, t);
        const labels = this.#labels();
        /* THE ABSENCE IS ITS OWN SENTENCE (#38). "This machine served no derived channels
         * for this shot" is a different fact from "no shot is selected" and from "the read
         * failed", and a blank chart says all three at once. The gate is ReaPrime's and is
         * named in the body, because a reader who has just watched the trace stop during
         * preinfusion deserves to know that is the server being honest. */
        const noDerived = hasA && noDerivedChannels(a, this.derivationB);
        /* ONE FRAME FOR BOTH SHOTS, computed here so the template and the composition
         * below cannot disagree about the box the trajectory is drawn in. */
        const frame = trajectoryFrame({ a, b: this.derivationB });
        /* THE TWO READINGS, composed from the held cursor details — see `#derivedReading`
         * and `#trajectoryReading`. Both are empty at rest, which is what an un-scrubbed
         * card has always shown. */
        const derivedReading = this.#derivedReading(labels);
        const trajectoryReading = this.#trajectoryReading(t);
        return html`
            <div id="grid">
                <ui-chart-card
                    id="plot-derived"
                    data-plot="derived"
                    label=${t('Puck resistance and load impedance')}
                    scrub-label=${t('{name} scrub', { name: t('Puck resistance and load impedance') })}
                    .derivation=${a ?? null}
                    @cursor-change=${this.#onCursor}
                    @legend-change=${this.#onLegendChange}
                >
                    <ui-chart-legend
                        slot="legend"
                        chart="plot-derived"
                        label=${t('Chart key')}
                        .items=${this.#legendItems()}
                        .values=${derivedReading.values}
                    ></ui-chart-legend>
                    <span
                        slot="foot"
                        class="reading"
                        role="status"
                        aria-live="polite"
                        >${derivedReading.line}</span
                    >
                    ${hasA && !noDerived ? null : html`
                        <ui-empty-state
                            slot="empty"
                            heading=${this.#emptyHeading(hasA, noDerived, refusal, t)}
                            body=${this.#emptyBody(hasA, noDerived, refusal, t)}
                        ></ui-empty-state>`}
                </ui-chart-card>

                <div id="trajectory">
                    <ui-chart-card
                        id="plot-pq"
                        data-plot="trajectory"
                        channels="pressure"
                        x-min="0"
                        x-max=${frame.flowMax}
                        label=${t('Pressure versus flow trajectory')}
                        scrub-label=${t('{name} scrub',
                            { name: t('Pressure versus flow trajectory') })}
                        @cursor-change=${this.#onCursor}
                    >
                        <!-- THE READING, AND THIS CARD HAS NOWHERE ELSE TO PUT ONE (audit
                             F-034). No legend, because its key is the colour strip beside
                             it; no time axis, because its x is flow. So the scrub's answer
                             — the pressure, the flow and the second the point belongs to —
                             is printed in the foot, in a strip whose height is reserved
                             whether or not it has words. -->
                        <span
                            slot="foot"
                            class="trajectory-reading"
                            role="status"
                            aria-live="polite"
                            >${trajectoryReading}</span
                        >
                        ${hasA ? null : html`
                            <ui-empty-state
                                slot="empty"
                                heading=${refusal?.heading ?? t('No shot selected')}
                                body=${refusal?.body
                                    ?? t('Pick a shot in the band above to see how it poured.')}
                            ></ui-empty-state>`}
                    </ui-chart-card>
                    <ui-time-key
                        id="timekey"
                        label=${t('Time key')}
                        caption=${t('seconds')}
                        .seconds=${trajectorySpan({ a, b: this.derivationB, offset: this.offset })}
                    ></ui-time-key>
                </div>
            </div>
        `;
    }

    /** The refusal's heading, the absence's heading, or the resting one. */
    #emptyHeading(hasA, noDerived, refusal, t) {
        if (!hasA) return refusal?.heading ?? t('No shot selected');
        return t('No derived channels in this shot');
    }

    /** The same three cases, said in full. */
    #emptyBody(hasA, noDerived, refusal, t) {
        if (!hasA) {
            return refusal?.body ?? t('Pick a shot in the band above to see how it poured.');
        }
        return t('The machine served no resistance, impedance or power reading for this pour. '
            + 'They are reported only above 0.3 mL/s and 0.3 bar, and a machine without a puck '
            + 'estimator reports them only if its firmware computes them.');
    }

    /**
     * The translated channel names and the legend items built from them — HELD, keyed on
     * the language. The flow page carries the whole argument; the short version is that a
     * fresh `legendItems(...)` array every render is a new identity, so the legend runs
     * its new-series-set path (prune, `#checkChannels`'s `getComputedStyle` read,
     * `#applyToChart`) on every one — and a scrub re-renders this page once per SAMPLE.
     */
    #labelCache = { language: null, labels: null, items: null };

    #labels() {
        return this.#cache().labels;
    }

    #legendItems() {
        return this.#cache().items;
    }

    #cache() {
        const language = this.#i18n.language;
        if (this.#labelCache.language === language) return this.#labelCache;
        const t = this.#i18n.t;
        const labels = {};
        for (const [key, label] of Object.entries(CHANNEL_LABELS)) labels[key] = t(label);
        this.#labelCache = {
            language,
            labels,
            items: legendItems(DERIVED_CHANNELS, labels, DEFAULT_CHANNELS),
        };
        return this.#labelCache;
    }

    updated(changed) {
        super.updated?.(changed);
        this.#syncEmpty();
        this.#applyComposition();
    }

    /**
     * THE DERIVED CARD'S REFUSAL IS THIS PAGE'S TO DECLARE, and it is a different fact
     * from the card's own.
     *
     * `#applyDerivation` sets `empty` from `derivation.ok` alone, which is exactly right
     * for a chart of pressure and flow: the shot derived, so there is something to draw.
     * On THIS chart it is not enough — a shot can derive perfectly and still carry no
     * resistance, impedance or power reading at all, because the machine has no puck
     * estimator and the server's own derived keys were gated away. MEASURED before this
     * ran: a recording served without the keys drew three empty axes with no sentence
     * anywhere, which is the blank chart #38 exists to replace.
     *
     * Outside `#applyComposition`'s token guard on purpose: the token is the DATA's
     * identity, and this has to be re-stated after any update that re-ran the card's own
     * `#applyDerivation`.
     */
    async #syncEmpty() {
        const a = this.derivationA ?? null;
        const b = this.derivationB ?? null;
        const derived = this.renderRoot?.getElementById?.('plot-derived');
        const pq = this.renderRoot?.getElementById?.('plot-pq');
        /* AFTER THE CARD'S OWN UPDATE, for the same reason `#applyComposition` awaits:
         * setting `.derivation` in the template schedules the card's update, and writing
         * `empty` before that update runs only merges into it — `#applyDerivation` then
         * runs `this.empty = !ok` in the same pass and the page's answer is gone.
         * MEASURED before the await was here: a shot served with no derived channel drew
         * three empty axes and the refusal never appeared. */
        if (derived) {
            await derived.updateComplete;
            derived.empty = !(a && a.ok) || noDerivedChannels(a, b);
        }
        if (pq) {
            await pq.updateComplete;
            /* The trajectory is pressure against flow, which are not derived channels: it
             * refuses only when there is no shot. */
            pq.empty = !(a && a.ok);
        }
    }

    /**
     * Lay both shots on both charts, AFTER each card's own update.
     *
     * The await is the flow page's and is not optional: setting `.derivation` in the
     * template schedules the card's update, whose `willUpdate` runs `#applyDerivation` and
     * calls `setChannels`/`setRecords` with A's default five. A composition applied before
     * that is silently replaced a microtask later.
     */
    async #applyComposition() {
        const a = this.derivationA ?? null;
        const b = this.derivationB ?? null;
        const offset = Number.isFinite(this.offset) ? this.offset : 0;
        const token = `${a?.axis?.stampMs ?? 'none'}|${b?.axis?.stampMs ?? 'none'}|${offset}`;
        if (token === this.#appliedToken) return;
        this.#appliedToken = token;

        const hasComparison = Boolean(b && b.ok);
        const derived = this.renderRoot?.getElementById?.('plot-derived');
        const pq = this.renderRoot?.getElementById?.('plot-pq');

        if (derived) {
            await derived.updateComplete;
            if (this.#appliedToken !== token) return;

            /* NO RIGHT-HAND AXIS ANY MORE. Ben, 25 August 2026: "Power will be on the
             * Pressure/Flow chart, not on the resistance / impedance chart. No second axis
             * on these charts." W is on the flow page's top plot, where it shares pressure
             * and flow's own 0-12 band honestly; what is left here is a matched pair.
             *
             * IT IS SET TO null AND NOT LEFT ALONE. The card rebuilds its plot when this
             * property MOVES, and a card that has drawn a y2 keeps it until told otherwise
             * - a page that simply stopped assigning would keep the axis it drew last. */
            derived.y2 = null;
            /* THE LEFT AXIS IS A LOG AXIS, and all three parts of that are stated here:
             * the range in log10 units, the ladder, and the labels. See
             * `derivedLeftRange`; the DATA is transformed a few lines down and the two
             * must move together or the traces draw against the wrong decades. */
            const logRange = derivedLeftRange({ a, b });
            derived.yRange = logRange;
            derived.yAxis = {
                format: formatLogTick,
                splits: derivedTickValues(logRange),
                /* 0 IS A REAL LABEL HERE. Every zero-based axis in the app drops it,
                 * because it sits on the axis line; this axis is in log10 units, where 0
                 * is 10^0 = 1 and dropping it hides the most-read number on the chart. */
                keepZero: true,
            };

            const view = comparisonWindow(compareOnOneClock({
                channels: DERIVED_CHANNELS, a, b, offset,
            }));
            derived.xMin = view.empty ? null : Math.min(view.min, 0);

            derived.setChannels(abChannelSpecs(DERIVED_CHANNELS, {
                hasComparison,
                treatments: DEFAULT_CHANNELS,
                scales: DERIVED_SCALES,
            }));
            /* PLOTTED AS log10 — the other half of the log axis. `logRecords` is applied
             * HERE and nowhere else, so the one transform sits beside the one range. */
            derived.setRecords(logRecords(abRecords(DERIVED_CHANNELS, { a, b, offset })));
            derived.setRuleSource((tokens) => comparisonStepRules({
                a, b, offset,
                paint: {
                    colour: tokens?.channels?.['step-boundary'],
                    ink: tokens?.surface?.label,
                    width: tokens?.geometry?.strokeMinor,
                    dash: dashPattern(COMPARISON_DASH),
                    alpha: COMPARISON_ALPHA,
                },
            }));
        }

        if (pq) {
            await pq.updateComplete;
            if (this.#appliedToken !== token) return;
            /* BOTH AXES ARE STATED, because neither of them is time: x is flow through
             * `x-min`/`x-max` in the template, y is pressure here. A trajectory that
             * autoscaled would redraw the same pour differently depending on its own peak,
             * which is the one thing a shape you are meant to compare must not do. */
            pq.yRange = [0, trajectoryFrame({ a, b }).pressureMax];
            /* THE RETHEME HOOK. `setRuleSource` is asked again on every re-issue the card
             * makes — including the one `refreshPalette` makes on a light/dark flip — so
             * repainting the path from THIS call is what stops the trajectory keeping the
             * previous theme's colours after a rebuild. It annotates nothing: a P–Q plot
             * has no time axis, so a step boundary has no x to be at. */
            pq.setRuleSource(() => {
                this.#paintTrajectory(pq, { a, b, offset });
                return NO_RULES;
            });
        }
    }

    /**
     * The two trajectories, the correspondence marks and the links — every colour read
     * from CSS at the moment of painting (A6), never held.
     */
    #paintTrajectory(card, { a, b, offset }) {
        const stops = this.#ramp();
        const ink = this.#token('--ui-chart-label');
        const span = trajectorySpan({ a, b, offset });
        /* THE ONE CLOCK. Both paths are coloured against the same span, so the key beside
         * them is true for both — see `trajectorySpan`. */
        const colorAt = (seconds) => rampColour(stops, span > 0 ? seconds / span : 0);

        const width = card.chartTokens?.geometry?.strokeMinor;
        const bands = [];
        const pointsA = trajectoryPoints(a);
        if (pointsA.length) bands.push({ points: pointsA, colorAt, width });
        /* WHAT THE SCRUB CAN LAND ON (audit F-034). The card's ordinary cursor walks a
         * shared time axis and this card has none — its x is flow — which is why every
         * gesture on this well used to change nothing at all. `cursorPoints` is the same
         * array the path is drawn from, so the cursor cannot mark a point the plot did
         * not draw.
         *
         * A's PATH ONLY, and that is a choice rather than an omission: the compare bar
         * reaches this chart as the CORRESPONDENCE MARKS, and a cursor that silently
         * jumped between two shots would make "which point is this" unanswerable. The
         * reference shot is the one the readout speaks about. */
        card.cursorPoints = pointsA.length ? pointsA : null;
        const pointsB = trajectoryPoints(b, { offset });
        if (pointsB.length) {
            /* B IS DASHED AND FADED, and here that is a necessity rather than a
             * convention: colour is already carrying time on this chart, so it cannot also
             * carry which shot this is. Slate says the same thing in the same place. */
            bands.push({
                points: pointsB,
                colorAt,
                width,
                dash: dashPattern(COMPARISON_DASH),
                alpha: COMPARISON_ALPHA,
            });
        }
        const { marks } = correspondenceMarks({ a, b, offset });
        const dots = [];
        for (const mark of marks) {
            if (mark.a) {
                dots.push({
                    x: mark.a.x, y: mark.a.y, kind: 'dot', color: ink, size: MARK_SIZE_PX,
                    text: mark.label, textColor: ink,
                });
            }
            if (mark.b) {
                dots.push({
                    x: mark.b.x, y: mark.b.y, kind: 'ring', color: ink, size: MARK_SIZE_PX, width,
                });
            }
            /* THE LINK IS A BAND WITH ONE COLOUR — a two-point path in data coordinates,
             * which is exactly what the bands layer draws. Faint and dotted so it reads as
             * a correspondence rather than as a third trajectory. */
            if (mark.a && mark.b) {
                bands.push({
                    points: [{ x: mark.a.x, y: mark.a.y, t: 0 }, { x: mark.b.x, y: mark.b.y, t: 0 }],
                    colorAt: () => ink,
                    width,
                    dash: dashPattern('dot'),
                    alpha: LINK_ALPHA,
                });
            }
        }
        /* The links go in with the paths and UNDER the marks: the marks are drawn by their
         * own plugin, which runs after the bands one. One `setBands` with everything in
         * it, so the plot is not handed the paths and then handed them again. */
        card.setBands(bands);
        card.setMarks(dots);
    }

    /** The ten ramp stops, computed. One read per paint; the values are the sheet's. */
    #ramp() {
        return RAMP_TOKENS.map((name) => this.#token(name)).filter(Boolean);
    }

    /** One custom property off this host, trimmed. Null when it resolves to nothing. */
    #token(name) {
        if (typeof getComputedStyle !== 'function') return null;
        const value = getComputedStyle(this).getPropertyValue(name).trim();
        return value || null;
    }

    /**
     * THE CURSOR MOVED ON EITHER CARD (audit F-032 / F-034, wiring F-002).
     *
     * ONE HANDLER FOR BOTH, because `cursor-change` is one wire: which card it was comes
     * off `currentTarget.dataset.plot`, and the DETAIL is held verbatim rather than turned
     * into text here — the reading is composed at render time so that hiding a chip while
     * the pointer is down drops that number in the same frame.
     */
    #onCursor = (event) => {
        const id = event.currentTarget?.dataset?.plot;
        if (!POWER_PLOTS.some((entry) => entry.id === id)) return;
        this._cursor = { ...this._cursor, [id]: event.detail };
    };

    /**
     * A CHIP WAS TURNED OFF OR BACK ON (audit F-006 — this is that wire's consumer).
     *
     * The legend has already applied the hide to the plot itself; what it cannot know is
     * that this page is naming numbers beside those chips. A channel the plot is not
     * drawing names no number, or "the same numbers the chart drew" stops being true.
     */
    #onLegendChange = (event) => {
        const id = event.currentTarget?.dataset?.plot;
        if (!POWER_PLOTS.some((entry) => entry.id === id)) return;
        const hidden = Array.isArray(event.detail?.hidden) ? event.detail.hidden : [];
        this._hidden = { ...this._hidden, [id]: hidden };
    };

    /**
     * THE DERIVED CHART'S READING — `{ values, line }`, the flow page's shape exactly.
     *
     * THE NUMBERS ARE THE REAL ONES, NOT THE LOG. The plot is fed `logRecords(...)`
     * because its axis is in log10 units, but the card's cursor reads the DERIVATION's own
     * series — `#applyDerivation` holds them and nothing since has replaced them — so a
     * scrub names 0.46 bar·s²/mL² rather than -0.34. That is not luck to rely on silently:
     * it is why the composition sets records through `setRecords` and the cursor reads
     * `#series`, and it is asserted in the render suite.
     */
    #derivedReading(labels) {
        const detail = this._cursor.derived;
        const hidden = this._hidden.derived ?? EMPTY_KEYS;
        const values = readoutValues(detail, DERIVED_CHANNELS, { hidden });
        if (!Object.keys(values).length) return { values: NO_VALUES, line: '' };
        const terms = readoutTerms(detail, DERIVED_CHANNELS, { hidden, withUnit: false });
        return { values, line: readoutLine(terms, labels) };
    }

    /** The trajectory's reading, as the one line its foot strip prints (audit F-034). */
    #trajectoryReading(t) {
        const detail = this._cursor.trajectory;
        if (!detail || detail.active !== true) return '';
        const words = {};
        for (const [key, label] of Object.entries(TRAJECTORY_TERM_LABELS)) words[key] = t(label);
        return readoutLine(trajectoryTerms(detail.point), words);
    }

    /* `#onPlotChange` STOOD HERE AND IS RETIRED with the select it served (Ben, 30 Aug
     * 2026 — F-036). See the flow page's header. */
}

/**
 * The correspondence mark's diameter and the link's fade.
 *
 * Both are CANVAS values rather than CSS ones — nothing in a canvas reads a custom
 * property — and both are this page's, declared here because there is no token for either
 * and inventing two in `tokens.css` for one chart's marks would be worse. The size is
 * Slate's own 9px marker (`history-viewer.js:387`) and the fade is its 0.7
 * (`history-viewer.js:381`). The LOOK is a pinned deferred question either way: these
 * marks have never been drawn on a screen in either tree.
 */
const MARK_SIZE_PX = 9;
const LINK_ALPHA = 0.7;

customElements.define('history-power-page', HistoryPowerPage);
