/**
 * history-flow-page.js — <history-flow-page>, the History route's first page.
 * Wave 5.6 (wf-w5p6-history), rows `hist-flow-page`, `hist-components`, and bugs
 * H1 (ratio tracks with floors) and chart-C7 (dash/cap/opacity, uniformly).
 *
 * ===========================================================================
 * H1 — RATIO TRACKS, NEVER PX, AND A FLOOR THE RATIO GIVES WAY TO
 * ===========================================================================
 * The measurement this page exists to answer: Slate's four plot hosts DECLARE
 * 416/344/360/592 and RENDER 404/334/308.6/507.4, both page cards clamp to 932, and the
 * power page loses 136px across its two plots — "has never fitted" (§7.6 H1). A declared
 * pixel height is not a rendered one, so this page declares none, anywhere: the two plots
 * are `1.2fr 1fr` of whatever the mount region gives (§4.5), and their floor is the chart
 * card's own, which is `--ui-chart-min-h` plus the card's chrome.
 *
 * THE PLOTS NEVER SCROLL. They RESIZE — `<ui-chart-card>`'s mandatory ResizeObserver
 * (chart-C11) is what makes a ratio track safe to put a canvas in, and it is what keeps a
 * canvas honest at whatever box the ratio and the floors leave it.
 *
 * ===========================================================================
 * THE SINGLE-PLOT BRANCH IS RETIRED — BEN, 30 AUGUST 2026 (F-036)
 * ===========================================================================
 * This page used to carry a second layout: below `FLOW_SINGLE_PLOT_PX` it showed ONE plot
 * and a `<ui-select id="picker">` labelled "Which plot" for choosing between them, on
 * §4.5's line "below that the page switches to a single plot with a selector rather than
 * showing two unusable strips". Ben's ruling on F-036: **"Remove them for good."**
 *
 * WHY THE BRANCH WENT WITH THE SELECT, rather than the select alone. The picker was the
 * branch's only control. Delete it and leave the branch, and the `plot` attribute freezes
 * at its default with `:host([plot="top"]) #plot-temp { display: none }` still in force —
 * one card permanently unreachable, which is a worse fault than the one being closed. So
 * "cleanly" means the whole mechanism: the select, its `change` handler, the `plot`
 * property, the `@container` block and the threshold constant. **Both cards paint at every
 * height now**, which is the outcome Ben's decision names.
 *
 * AND THE BRANCH WAS ALREADY UNREACHABLE IN THE SHIPPED APP, which is what made this a
 * disposal rather than a design change. `app-fit.js` maps the design onto the glass with
 * `S = min(vh/1200, vw/1280)` and hands both dimensions back divided by S, so the DESIGN
 * height is 1200 on every landscape screen and never less on any other — the region this
 * page mounts in is 591 design units and cannot become smaller by resizing a window.
 * Wave 3 measured exactly that from the other end: `ui-select#picker` computed
 * `display: none`, box 0x0, at all five viewports it swept — 1281x801, 1024x768, 820x1180,
 * 600x900 and 1920x1080 — with `sel.focus()` leaving it unfocused, so there was no pointer
 * gesture and no keyboard gesture to it anywhere (F-036, `DEAD`, units L0212/L0227). The
 * only heights at which the branch ever fired were the ones a render suite staged by
 * mounting this page in a short `#stage`, outside the fit.
 *
 * WHAT ANSWERS FOR A SHORT REGION NOW, AND IT IS A RULE THIS TREE ALREADY HAD. Nothing
 * new is declared here. Each card keeps its own floor (`--ui-chart-min-h` plus its
 * chrome), so below two floors plus the gap the grid's content is taller than its box —
 * and every box in the chain declares NO overflow, so the shortfall travels outward to the
 * document, which scrolls. §2.4: "nothing clips silently"; the skeleton suite already pins
 * the region and the page at `overflow: visible` (bug L24) for exactly this reason. So
 * what used to be the branch point is now simply where the page begins to need the
 * document's scroll: both cards paint, neither is squeezed under its floor, every card is
 * reachable, and the plots still RESIZE rather than scrolling themselves.
 *
 * A SCROLL CONTAINER ON `#grid` WAS TRIED FIRST AND MEASURED WORSE. `overflow-y: auto`
 * forces the other axis from `visible` to `auto` (CSS Overflow 3), and #10's legend hit
 * overlay overhangs this grid by up to 8px — so the page grew a HORIZONTAL scrollbar and
 * that scrollbar's ~15px came off the block axis, dropping the derived card from 286.67 to
 * 280.4 and breaking the ratio the tracks exist to hold. The rule above costs nothing and
 * breaks nothing.
 *
 * H1 IS NOT REOPENED BY THIS. H1 is "a declared pixel height is not a rendered one", and
 * this file still declares none: the two plots are `1.209fr 1fr` of whatever the mount
 * region gives, and their floor is the card's own. What is gone is the second layout, not
 * the ratio tracks.
 *
 * NO JS READS THE LAYOUT. There is no ResizeObserver here, no matchMedia and no "narrow"
 * flag — there is now only one arrangement, so there is nothing for JavaScript to be told.
 *
 * ===========================================================================
 * THE A/B COMPARISON, AND WHY IT IS COMPOSED RATHER THAN GIVEN
 * ===========================================================================
 * `<ui-chart-card>` takes ONE derivation and `#applyDerivation` overwrites its series from
 * it, so A+B on one card is not the card's present API. Its INHERITED surface is public —
 * `setChannels(specs)` / `setRecords(records)` (`plot-surface.js`) — so the comparison is
 * composed on the shipped component. The specs and the records are `history-series.js`'s,
 * DOM-free and unit-tested; this file only hands them over.
 *
 * THE DERIVATION IS STILL SET, and that is deliberate rather than redundant. It buys two
 * things the composition cannot: the card's `empty` reflection (so the refusal has
 * somewhere to be styled) and the RE-ISSUE machinery itself — the card re-applies its
 * rules on a theme change, because a rule carries its colour and a rebuild would
 * otherwise redraw the previous theme's boundaries. So: derivation in, then the second
 * shot laid on top, after the card's own update has run — which is what the
 * `await card.updateComplete` below is for, and it is not optional. Applying the
 * composition first would have it overwritten by the card's own willUpdate a microtask
 * later.
 *
 * BUT THE RULES ARE THIS PAGE'S ANSWER, NOT THE DERIVATION'S, and that is the correction
 * this file needed. Re-issuing them FROM `this.derivation` is A alone, so a theme flip
 * silently dropped B's three faded boundaries off a chart still drawing B's five series —
 * the exact failure this paragraph used to claim setting the derivation prevented, with
 * A's half fixed and B's half introduced. `setRuleSource` (ui-chart-card.js) is the seam:
 * the card asks THIS page for the rules every time it re-issues them, with its own freshly
 * read tokens, so the composition survives the rebuild instead of being replaced by it.
 * `#applyComparison` below carries the two measurements.
 *
 * A-SOLID / B-DASHED / SAME HUE, and the fade survives (chart-C7). The convention ports
 * from `history-viewer.js:213-239` with its reasoning: B is out of the legend, because
 * "twelve legend entries on one chart is not a key, it is a second chart", and the
 * convention is stated once in the align bar instead. What this file adds is that the CAP
 * is no longer a plugin's private business — `chart-axis.js` holds one cap constant and
 * `uplot-plot.js` applies it to every series and to the banded path alike.
 *
 * ===========================================================================
 * WHAT THIS PAGE DOES NOT DO
 * ===========================================================================
 * No fetch, no store, no endpoint (wave 3's law for anything holding a chart): two
 * derivations and an offset arrive as properties. No P-Q trajectory and no #11 time key:
 * both are the POWER page's (`history-power-page.js`, fix run 6), which is also where the
 * derived channels render now that Ben has reversed D1 for that one surface. No `y2` axis
 * HERE either, and that is the same decision rather than a leftover: `power` rode on
 * Slate's invisible auto-ranged y2 on this plot, and the fix is a real second axis on the
 * page that has one to give, not a sixth trace on a plot with a single scale.
 * No `buildExpandedLayout` lineage and no shape tests (chart-C8 / H7). Nothing here parses a number out of rendered text (chart-C13). D2: every readable
 * string is read through `I18nController` from this file's first commit.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';
import {
    COMPARISON_ALPHA, COMPARISON_DASH,
    FLOW_PLOTS, abChannelSpecs, abRecords, legendItems,
} from 'src/lib/history-series.js';

/* THE PORT'S OWN TWO PIECES, and both of them are logic rather than layout: the union
 * clock the comparison sits on (so the x scale carries a shot slid before zero) and both
 * shots' step boundaries (so B's rules follow B's curves). Neither is declared here —
 * this page reads tokens and draws; `history-compare.js` decides. */
import {
    comparisonStepRules,
    compareOnOneClock,
    comparisonWindow,
} from 'src/lib/history-compare.js';
/* The port's reader for the port's typed failure — one place turns a failure into the
 * two sentences a refusal shows, so both pages say the same thing about the same fault. */
import { failureRefusal } from 'src/lib/history-viewer.js';
import { dashPattern } from 'src/lib/chart-axis.js';
/* THE CURSOR'S OTHER HALF (audit F-032). The card has emitted `cursor-change` since wave
 * 3 and the legend has declared `values` for just as long; nothing ever joined them, so a
 * scrub moved a crosshair and named no number. `chart-readout.js` owns the arithmetic —
 * the rounding, the units and which keys a hidden chip drops — and this page owns which
 * card the reading belongs to and what its channels are called. */
import { readoutLine, readoutTerms, readoutValues } from 'src/lib/chart-readout.js';

/* COMPOSED, NOT CONSTRUCTED (Part 10 §9). #9 the chart card (wave 3), #10 the chart key
 * (wave 3), #7 the select (wave 1) and the empty state (wave 2). Every tag this page
 * renders was built by an earlier wave.
 *
 * `CHANNEL_TREATMENTS` comes across WITH the card, because it is the one place a key's
 * weight and dash are declared (§6.2). Composing on the surface with `setChannels`
 * deliberately bypasses the card's own derivation — that is how two shots share one
 * plot — and it bypassed that table with it, so A's five series drew solid at 3px here
 * and dashed at 2px on Live from the SAME derivation. The page hands the table to
 * `history-series` rather than letting the treatment go missing on one screen, and
 * rather than restating it in a second file.
 *
 * IT IS THE KEYED TABLE NOW, NOT THE PRESSURE PLOT'S ORDERING. Ben, 24 August 2026:
 * "The Temp chart has no dashed lines for targets, they are using the same line as the
 * measurment." The ordering names `targetPressure` and `targetFlow` and not the two
 * temperature targets — and `referenceSpecs` writes `dash: treatment?.dash ?? null` for
 * a key it cannot find, so the temp targets arrived carrying an explicit null that beat
 * the card's own entry for them. The keyed table names all four. */
import { CHANNEL_TREATMENTS } from 'src/components/ui-chart-card.js';
import 'src/components/ui-chart-legend.js';
import 'src/components/ui-empty-state.js';

/** The mount contract's own two attributes, so a caller writing the tag gets them. */
export const FLOW_PAGE_ID = 'flow';

/* `FLOW_SINGLE_PLOT_PX` STOOD HERE AND IS RETIRED (Ben, 30 Aug 2026 — F-036). It was the
 * page height at which the single-plot branch took over, written as a literal because
 * `var()` is not substituted inside `@container (...)`, and exported so the suite could
 * check the derivation `2 x (card floor) + --ui-space-3 = 2 x 254 + 12 = 520` against the
 * card's measured floor. With the branch gone there is no second layout for a threshold to
 * separate, and a constant no rule reads is a number waiting to drift. The derivation
 * itself is not lost — it is the same arithmetic `ui-chart-card` states for its own
 * min-block-size, which is where the suite reads a card floor from now.
 */

/**
 * The channel labels, by derivation key. Slate's own legend names, carried unchanged
 * (`history-viewer.js:178-192`) — they name a quantity and its unit, which is what a key
 * beside a plot is for. Translated at the call site, never here (D2).
 */
const CHANNEL_LABELS = Object.freeze({
    pressure: 'Pressure (bar)',
    targetPressure: 'Target Pressure',
    flow: 'Flow (mL/s)',
    targetFlow: 'Target Flow',
    weightFlow: 'GFlow (g/s)',
    /* Slate's own name for it on this plot (`history-viewer.js:184`), and the unit is in
     * the label for the same reason every other one here carries theirs: a key beside a
     * plot names a quantity AND what it is measured in. */
    power: 'Power (W)',
    groupTemp: 'Group °C',
    targetTemp: 'Group Target °C',
    mixTemp: 'Mix °C',
    targetMixTemp: 'Mix Target °C',
});

/** One frozen empty map, so a resting legend is handed the same object every render. */
const NO_VALUES = Object.freeze({});

/** One frozen empty list, for a legend that has hidden nothing. */
const EMPTY_KEYS = Object.freeze([]);

export class HistoryFlowPage extends UiElement {
    static properties = {
        /** Shot A's gate-6 derivation — the REFERENCE, the one that does not move. */
        derivationA: { attribute: false },

        /** Shot B's, or null for "no comparison". The one the offset slides. */
        derivationB: { attribute: false },

        /**
         * The store's typed failure, VERBATIM, or null — `history-viewer.js`'s `failure`.
         *
         * A PROPERTY, NOT A FETCH. This page still reads no store and no endpoint; the
         * screen that owns the viewer hands the failure down exactly as it hands the
         * derivations down. What it buys is that a machine which ANSWERED 500 stops being
         * indistinguishable from a machine with no recorded shots: measured with a
         * transport failing every request, the screen rendered "No shot selected" and
         * nothing else, which is the swallowing catch's silence without its catch.
         *
         * IT SPEAKS ONLY WHERE THE PAGE HAS NOTHING TO SHOW. The refusal lands in the
         * card's `empty` slot — the surface a refusal already has — so a failed read of B
         * never writes over a chart of A that is drawing perfectly well.
         */
        failure: { attribute: false },

        /**
         * The alignment offset in force, in seconds, ALREADY CLAMPED by `<ui-compare-bar>`
         * to `alignment-offset.js`'s ±5 s. This page applies it and does not re-state the
         * policy — "no two controls can disagree" means there is one clamp, and it is the
         * bar's.
         */
        offset: { type: Number },

        /* `plot` STOOD HERE AND IS RETIRED (Ben, 30 Aug 2026 — F-036). It named which of
         * the two plots the single-plot branch showed, and it was reflected so a harness
         * could stage the branch with one attribute. There is no branch and no chooser
         * now: both cards paint at every height, so there is no such state to hold. */

        /**
         * WHERE THE POINTER IS, PER CARD — `{ [plotId]: cursorDetail }`.
         *
         * Internal state (`state: true`), because it is not something a caller sets: it
         * is the answer to a pointer that is on the plot right now. The DETAIL is held
         * verbatim — `{ active, idx, t, values }`, the card's own frozen shape — and the
         * two things a reader sees are composed from it at render time by `#reading`.
         */
        _cursor: { state: true },

        /**
         * The channels each card's legend is currently HIDING — `{ [plotId]: [key] }`.
         *
         * Held rather than folded into the reading for one reason: hiding a chip while
         * the pointer is still down has to drop that channel's number in the same frame,
         * and it can only do that if the reading is composed from the two together.
         */
        _hidden: { state: true },
    };

    static styles = [css`
        /* NO BACKTICK IN THIS TEMPLATE, comment or not (CONVENTIONS §9): one of them ends
         * the tagged template and the screen answers "the module could not be loaded".
         *
         * THE HOST IS THE GRID ITEM AND IT HANDS THE CELL STRAIGHT ON. The mount region's
         * slot is display: contents, so this element IS the cell (#page pins it to row 1 /
         * column 1). One row, one column, both minmax(0,1fr) and both minimums 0: #grid
         * receives exactly the box #page gave the host, and the suite asserts the two
         * rects are equal at every height it tests. The shell's contract warns that a
         * wrapper "would take the cell and then have to hand its size on, which is how a
         * floor stops binding" — so this one is measured rather than asserted.
         *
         * WHY THERE IS A #grid AT ALL, and it is a language limit, not a preference. The
         * single-plot branch below is a container query on THIS page's own height, and an
         * element is never its own query container: a rule whose subject is :host would be
         * evaluated against some ancestor container instead — here <history-screen>, which
         * the base makes an INLINE-size container, so a block-size query against it would
         * never match and would fail silently. settings-master-detail.js:56-68 hit the
         * same wall from the inline side and answered it the same way. So the track list
         * that CHANGES lives on #grid, whose nearest ancestor container is this host.
         *
         * container-type: SIZE, not the base's inline-size, because the branch is a
         * block-size question. Safe here precisely because the cell is definite in both
         * axes (minmax(0,1fr) both ways, on a screen whose host is block-size: 100% of a
         * definite track), so nothing about this box was ever going to come from its
         * contents. */
        :host {
            display: grid;
            grid-template-rows: minmax(0, 1fr);
            grid-template-columns: minmax(0, 1fr);
            container-type: size;
            min-block-size: 0;
            min-inline-size: 0;
        }

        /* §4.5's track list for the flow page, and the only place it is written.
         * RATIO TRACKS, NEVER PX (H1) — there is not a px length in this rule.
         *
         * 1.209 IS SLATE'S OWN PAIR, read back as a ratio: hv-flow-chart 416px over
         * hv-temp-chart 344px (index.html). It was 1.2, which was the same number rounded
         * before anyone had measured Slate's; FLOW_PLOTS.ratio now carries it so this page
         * and the expanded overlay cannot drift apart. */
        #grid {
            display: grid;
            grid-template-rows: 1.209fr 1fr;
            gap: var(--ui-space-3);
            min-block-size: 0;
            min-inline-size: 0;
        }

        /* Each card takes its whole track. NO BLOCK SIZE AND NO BLOCK MINIMUM IS STATED,
         * and the second half of that is a MEASURED correction rather than a preference:
         * min-block-size: 0 written here computes to 0 on the card, because a rule in the
         * OUTER tree beats the component's own :host rule for the same element — so the
         * one line meant to let the track shrink silently deleted the card's floor
         * (measured: the card reported min-block-size 0px with its own
         * calc(160px + 78px) in force nowhere). The card's rule is "THE HOST IS THE SIZE"
         * and its floor is --ui-chart-min-h plus its chrome; that floor IS what this
         * page's ratio absorbs down to, and the branch below is what happens next. */
        ui-chart-card {
            min-inline-size: 0;
        }

        /* THE ANNOUNCED READING, AND IT COSTS NO LAYOUT AT ALL.
         *
         * The VISIBLE readout on these two cards is the legend: #10's chips carry a
         * value beside each label, in a row the card's grid has always reserved
         * (--ui-legend-chip-h), so naming the numbers there moves nothing. What a chip
         * cannot carry is the TIME — it is not a channel — and F-032's intent names it
         * ("the card names a time and a value").
         *
         * SO THE TIME GOES IN THE FOOT, CLIPPED. live-screen.js's .chart-summary is the
         * same idiom for the same reason: a live region that announces the reading
         * without taking a row. A VISIBLE foot here would take its height out of the
         * plot the moment a finger touched the well — the data moving under the finger
         * that is reading it — and at the single-plot threshold it would push the card
         * past its own floor. The cursor already stands on the x axis's own time ticks,
         * so the second is on the glass; what it was not, until this, is ANNOUNCED. */
        .reading {
            display: block;
            block-size: 0;
            clip-path: inset(50%);
        }

        /* THE SINGLE-PLOT BRANCH STOOD HERE (H1) AND IS RETIRED — Ben, 30 Aug 2026,
         * F-036. It was "@container (block-size < 520px)", which re-tracked #grid to
         * "auto minmax(0,1fr)", gave #picker a box, and hid whichever card "plot" did not
         * name. The header carries the whole disposal and why the branch could not survive
         * its own chooser's removal. NOTE THE HOST STILL DECLARES "container-type: size":
         * it is the base's contract for this cell and the thing that made the query
         * evaluable, and taking it away is a separate question about #grid's box that no
         * finding has asked. */
    `];

    #i18n = new I18nController(this);

    /** The cards whose composition has already been applied for this state. */
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

    /**
     * THE MOUNT CONTRACT, HONOURED BY THE PAGE ITSELF.
     *
     * `<history-screen>` wants a light-DOM child carrying `slot="page"` and a `data-page`
     * naming which page it is — the second is what `<ui-tab-bar>` builds its panel map
     * from, so a page mounted without it is simply never shown and nothing raises. The
     * page knows both answers about itself, so it fills them in when the caller has not.
     *
     * IN connectedCallback AND NOT THE CONSTRUCTOR: a custom element constructor must not
     * gain attributes (CONVENTIONS §13 (b)). A caller that states its own wins.
     */
    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('slot')) this.setAttribute('slot', 'page');
        if (!this.hasAttribute('data-page')) this.setAttribute('data-page', FLOW_PAGE_ID);
    }

    render() {
        const t = this.#i18n.t;
        const hasA = Boolean(this.derivationA && this.derivationA.ok);
        const labels = this.#labels();
        /* THE REFUSAL SAYS WHICH REFUSAL IT IS. `failureRefusal` is null unless the store
         * reported one, so with no failure this is the "nothing picked yet" wording it
         * always was, and with one it is the machine's own sentence plus what it
         * answered. The page still asks nothing and knows nothing — the failure arrives
         * as a property like the derivations do. */
        const refusal = failureRefusal(this.failure, t);
        return html`
            <div id="grid">
                ${FLOW_PLOTS.map((plot) => {
                    /* THE READING FOR THIS CARD, composed from the cursor and the hidden
                     * list together — see `#reading`. Empty at rest, which is what an
                     * un-scrubbed card has always shown. */
                    const reading = this.#reading(plot, labels);
                    return html`
                    <ui-chart-card
                        id="plot-${plot.id}"
                        data-plot=${plot.id}
                        label=${t(plot.label)}
                        scrub-label=${t('{name} scrub', { name: t(plot.label) })}
                        y-floor=${plot.yFloor ?? nothing}
                        y-policy=${plot.yPolicy ?? nothing}
                        .derivation=${this.derivationA ?? null}
                        @cursor-change=${this.#onCursor}
                        @legend-change=${this.#onLegendChange}
                    >
                        <!-- BOUND, AND IT WAS NOT (Ben, 24 Aug 2026: "The buttons/legend
                             should toggle the series on and off, at the moment the buttons
                             are not doing anything").

                             #10's own contract is one line: "Bound, a press applies itself;
                             unbound, the chip still shows its state and legend-change is
                             the consumer's road in." This page passed no chart and
                             listened for no legend-change, so every chip lit, dimmed, and
                             changed nothing on the plot beside it. The POWER page one
                             screen over has bound its legend since it was built, which is
                             what makes this an omission rather than a missing feature.

                             THE ID RESOLVES BECAUSE THE LEGEND IS SLOTTED. #chartElement
                             asks getRootNode().getElementById(...), and a slotted element
                             belongs to the tree it was AUTHORED in — this page's shadow
                             root, where the card carries that id. -->
                        <ui-chart-legend
                            slot="legend"
                            chart="plot-${plot.id}"
                            label=${t('Chart key')}
                            .items=${this.#legendItems(plot)}
                            .values=${reading.values}
                        ></ui-chart-legend>
                        <span
                            slot="foot"
                            class="reading"
                            role="status"
                            aria-live="polite"
                            >${reading.line}</span
                        >
                        ${hasA ? null : html`
                            <ui-empty-state
                                slot="empty"
                                heading=${refusal?.heading ?? t('No shot selected')}
                                body=${refusal?.body
                                    ?? t('Pick a shot in the band above to see how it poured.')}
                            ></ui-empty-state>`}
                    </ui-chart-card>`;
                })}
            </div>
        `;
    }

    /**
     * The translated channel names, and the legend items built from them — HELD, not
     * rebuilt per render, and keyed on the language.
     *
     * IT USED TO BE "built once per render" AND THAT WAS FINE UNTIL THE CURSOR HAD A
     * READOUT. A fresh `legendItems(...)` array every render is a new object identity, so
     * Lit reports `items` as CHANGED on the legend, and `ui-chart-legend.willUpdate` runs
     * its whole new-series-set path on a change: pruning the hidden set, `#checkChannels`
     * (a `getComputedStyle` read through `readChartTokens`) and `#applyToChart` (a
     * `setSeriesVisible` per channel). That cost nothing while this page only re-rendered
     * when a shot or the offset moved. A scrub re-renders once per SAMPLE — fifty times a
     * second across a plot — and paying a computed-style read for each of them would be
     * this page making the chart layer's per-frame budget its own.
     *
     * The language is the only thing either answer depends on, so it is the whole key.
     */
    #labelCache = { language: null, labels: null, items: null };

    #labels() {
        return this.#cache().labels;
    }

    #legendItems(plot) {
        return this.#cache().items.get(plot.id);
    }

    #cache() {
        const language = this.#i18n.language;
        if (this.#labelCache.language === language) return this.#labelCache;
        const t = this.#i18n.t;
        const labels = {};
        for (const [key, label] of Object.entries(CHANNEL_LABELS)) labels[key] = t(label);
        const items = new Map();
        for (const plot of FLOW_PLOTS) {
            items.set(plot.id, legendItems(plot.channels, labels, CHANNEL_TREATMENTS));
        }
        this.#labelCache = { language, labels, items };
        return this.#labelCache;
    }

    updated(changed) {
        super.updated?.(changed);
        this.#applyComparison();
    }

    /**
     * Lay the second shot over the first, on both cards.
     *
     * AFTER THE CARD'S OWN UPDATE, and that is the whole reason this is async. Setting
     * `.derivation` in the template schedules the card's update; its `willUpdate` runs
     * `#applyDerivation`, which calls `setChannels`/`setRecords` with A's series alone. A
     * composition applied before that would be silently replaced a microtask later —
     * measured, before the await was here: the plot drew A twice and B never.
     *
     * IT IS ALSO IDEMPOTENT. `#appliedToken` is the identity of the state that was last
     * laid down, so an update that changed something else (the plot selector, a
     * re-render) costs nothing. Without it every update would call `setChannels`, whose
     * spec list is rebuilt each time and therefore never `sameSpecs`, and every one of
     * them would REBUILD the uPlot instance — series are a construction-time property.
     */
    async #applyComparison() {
        const a = this.derivationA ?? null;
        const b = this.derivationB ?? null;
        const offset = Number.isFinite(this.offset) ? this.offset : 0;
        const token = `${a?.axis?.stampMs ?? 'none'}|${b?.axis?.stampMs ?? 'none'}|${offset}`;
        if (token === this.#appliedToken) return;
        this.#appliedToken = token;

        const hasComparison = Boolean(b && b.ok);
        for (const plot of FLOW_PLOTS) {
            const card = this.renderRoot?.getElementById?.(`plot-${plot.id}`);
            if (!card) continue;
            await card.updateComplete;
            /* A LATER STATE OVERTOOK THIS ONE while we awaited: drop this pass rather than
             * writing a stale composition over a fresh one. */
            if (this.#appliedToken !== token) return;
            /* THE X WINDOW FIRST, and the order is load-bearing. `plot-surface` opens the
             * x scale at zero unless told otherwise, which is exact for one shot and
             * clips a comparison whose second shot is slid to the negative end of the
             * +/-5 s limit. `xMin` is read at DRAW time and setting it schedules no draw
             * of its own, so it is stated before `setRecords`, whose own `requestDraw` is
             * the frame that reads it. Never above zero: a comparison must not crop A. */
            const view = comparisonWindow(compareOnOneClock({
                channels: plot.channels, a, b, offset,
            }));
            card.xMin = view.empty ? null : Math.min(view.min, 0);

            card.setChannels(abChannelSpecs(plot.channels, {
                hasComparison,
                treatments: CHANNEL_TREATMENTS,
            }));
            card.setRecords(abRecords(plot.channels, { a, b, offset }));

            /* BOTH SHOTS' BOUNDARIES, AND B's MOVE. The card's own `#applyRules` ran a
             * microtask ago with A's derivation alone, which is right for one shot and
             * silent for two: lining a pair up on the instant preinfusion ended is the
             * alignment most people are reaching for, and rules that did not follow the
             * curves would contradict them. `comparisonStepRules` owns the arithmetic;
             * the colour, the ink and the width are read off the card that has them (A6
             * — a page that named a colour would be a private palette).
             *
             * A SOURCE, NOT A SET, AND THE TWO SILENCES THAT FORCED IT — both measured on
             * this page, both with no error anywhere:
             *
             *   A THEME FLIP DROPPED B's RULES. `refreshPalette` re-issues the card's own
             *   `#applyRules` from `.derivation` (A alone) and `#appliedToken` is not
             *   moved by a retheme, so nothing re-laid the composition: dark->light took
             *   the plot from four rules (three dashed and faded at 0.72) to A's one,
             *   with all ten series still drawn. The card's rule SOURCE is asked again on
             *   every re-issue the card makes, so the pair survives the rebuild.
             *
             *   CLEARING B LEFT B's RULES DRAWN. `setRules` used to sit inside
             *   `if (hasComparison)`, and nothing re-issued A-only rules when the second
             *   shot went away — B's series dropped from the plot and its three
             *   boundaries stayed stroked over a chart that no longer had it.
             *   `comparisonStepRules` with `b = null` already yields A's rules alone
             *   (`test/history-viewer.test.mjs`), so the answer is to state it every
             *   time rather than to guard the statement.
             *
             * `hasComparison` therefore no longer decides whether rules are issued — only
             * `abChannelSpecs` still asks it, for the b:* series themselves. */
            card.setRuleSource((tokens) => comparisonStepRules({
                a, b, offset,
                paint: {
                    colour: tokens?.channels?.['step-boundary'],
                    ink: tokens?.surface?.label,
                    width: tokens?.geometry?.strokeMinor,
                    /* B's rules take B's marks: the dash is a NAME resolved by the one
                     * table, and the fade is the same 0.72 its traces carry. Slate's
                     * `stepRules()` hard-coded one pattern and dropped opacity. */
                    dash: dashPattern(COMPARISON_DASH),
                    alpha: COMPARISON_ALPHA,
                },
            }));
        }
    }

    /**
     * THE CURSOR MOVED ON ONE OF THE TWO CARDS (audit F-032, wiring F-002).
     *
     * `cursor-change` carries `{ active, idx, t, values }` — "the same numbers the chart
     * drew, at the same index" (`ui-chart-card.js`) — and it fires only when the INDEX
     * moves, so a pointer sweep across 1200px of plot costs one update per sample rather
     * than one per pixel.
     *
     * WHICH CARD IT WAS is read off `currentTarget`: the listener is bound on the card,
     * and the card carries its plot id in `data-plot`. Reading `target` instead would
     * answer the same element today and the wrong one the moment anything else in the
     * card composes a chart of its own.
     *
     * THE DETAIL IS HELD, NOT THE TEXT. `#reading` composes the two shapes at render
     * time from the cursor AND the hidden list together, so a chip turned off while the
     * pointer is still down drops its number in the same frame — a readout built here
     * would have to be rewritten by the legend listener, in a second place, from a
     * string it had already thrown the numbers away to make.
     *
     * `active: false` — the pointer left the well — is held like any other detail, and
     * `#reading` answers the empty readout for it.
     */
    #onCursor = (event) => {
        const id = event.currentTarget?.dataset?.plot;
        if (!FLOW_PLOTS.some((entry) => entry.id === id)) return;
        this._cursor = { ...this._cursor, [id]: event.detail };
    };

    /**
     * A CHIP WAS TURNED OFF OR BACK ON (audit F-006 — this is that wire's consumer).
     *
     * The legend is BOUND to its card, so it has already applied the hide to the plot
     * itself; what it cannot know is that this page is naming numbers beside those chips.
     * A hidden channel's number is dropped from both halves of the reading, because the
     * plot is not drawing that line and "the same numbers the chart drew" would stop
     * being a true sentence about it.
     */
    #onLegendChange = (event) => {
        const id = event.currentTarget?.dataset?.plot;
        if (!FLOW_PLOTS.some((entry) => entry.id === id)) return;
        const hidden = Array.isArray(event.detail?.hidden) ? event.detail.hidden : [];
        this._hidden = { ...this._hidden, [id]: hidden };
    };

    /**
     * ONE PLOT'S READING — `{ values, line }`, composed rather than stored.
     *
     * `values` is the map #10 takes, in the channels' own order and without units (the
     * chip's label carries one already). `line` is the same reading as a sentence for the
     * foot's live region, with the time on the end, which is the term no chip can hold.
     */
    #reading(plot, labels) {
        const detail = this._cursor[plot.id];
        const hidden = this._hidden[plot.id] ?? EMPTY_KEYS;
        const values = readoutValues(detail, plot.channels, { hidden });
        if (!Object.keys(values).length) return { values: NO_VALUES, line: '' };
        const terms = readoutTerms(detail, plot.channels, { hidden, withUnit: false });
        return { values, line: readoutLine(terms, labels) };
    }

    /* `#onPlotChange` STOOD HERE AND IS RETIRED with the select it served (Ben, 30 Aug
     * 2026 — F-036). It was #7's `change` handler and the one owner of the selection. */
}

customElements.define('history-flow-page', HistoryFlowPage);
