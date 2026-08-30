/**
 * live-expanded-chart.js — the full-screen chart, live, opened by tapping the Live plot.
 *
 * ===========================================================================
 * WHAT IT IS FOR, AND WHY IT IS NOT THE HISTORY SCREEN
 * ===========================================================================
 *
 * Ben, 24 August 2026: "it should NOT load the history viewer, it should load the
 * expanded chart that does show live tracking etc. The History view is only accessible
 * through the 'all shots' button in the history tab."
 *
 * THE LIVE SCREEN USED TO ROUTE THE TAP TO HISTORY, and its own comment said why:
 * "Decal has no overlay and does not need one: the History screen IS those two plots,
 * at full size". That was wrong in the one way that matters — the History screen plots a
 * STORED shot. Tapping the chart during a pour to see it bigger handed you a picker and a
 * finished shot instead of the one running in front of you.
 *
 * ===========================================================================
 * IT IS A FULL SCREEN NOW, AND THAT IS WHAT MAKES IT READ AS ITSELF
 * ===========================================================================
 *
 * Ben, 25 August 2026: "When I click the chart on the live view it STILL loads the history
 * charts page, not the expanded charts page." MEASURED on the tablet at 0.1.21: the tap
 * DID open this element and did not touch the route. What it opened was a centred dialog
 * over a dimmed page, drawing the same two plots the History flow page draws, with a
 * Close button at the bottom — which is a fair description of the history charts page, so
 * the report was about what was on screen rather than about which element drew it.
 *
 * So the fix is the shape, and Ben chose it in the same message: "Full screen with the
 * back button BUT also make it so tapping a chart closes it back to the Live view page."
 * A back arrow, the shot's identity, two tabs, a compliance badge, the stats strip and
 * two pages — every one of them a thing the History viewer does not have, which is what
 * makes the two surfaces tell themselves apart at a glance.
 *
 * ===========================================================================
 * STILL AN OVERLAY AND NOT A ROUTE, WHICH IS ALSO WHY IT NEEDS NO WIRING
 * ===========================================================================
 *
 * A route would mount a second screen, which would need its own feed subscriptions, its
 * own derivation and its own copy of the rule that picks between a running shot and the
 * band's browsed one — three things `live-wiring.js` already owns and none of which can
 * be built twice without the two disagreeing about which shot is on screen.
 *
 * As an overlay INSIDE the Live screen it is handed the derivation the card beside it is
 * already drawing. Live tracking is then not a feature: it is the same object arriving at
 * 15 Hz, and a plot that stopped updating would be the bug.
 *
 * IT ALSO KEEPS THE ADDRESS OUT OF IT. A route pushes a history entry, and this session's
 * own navigation bug — a stale `#/settings` under a pushed `#/history` — was exactly that
 * shape. There is nothing to pop here: closing is a property going false.
 *
 * FULL SCREEN IS A PAINTED LAYER, NOT A ROUTE AND NOT A `<dialog>`. The element it used to
 * lean on, `<ui-dialog>`, is a real top-layer modal, and its geometry comes from the
 * viewport by design. This draws inside the Live screen's own box instead, which is what
 * lets `app-fit.js`'s scale reach it like every other surface — the dialog was the one
 * thing on screen the design canvas did not own.
 *
 * ===========================================================================
 * TWO PAGES, AND THE SECOND ONE IS THE HISTORY POWER PAGE ITSELF
 * ===========================================================================
 *
 * Ben, 25 August 2026: "Have two charts on the expanded charts." Slate's page 2 is
 * resistance and impedance over time with the pressure-flow trajectory under it
 * (`index.html:508-520`), and `<history-power-page>` already draws exactly that pair from
 * two properties and opens no endpoint of its own. Mounted here with `derivationA` set to
 * the live derivation and no comparison, it is live for the same reason page 1 is: the
 * object arrives at 15 Hz and the page redraws.
 *
 * PAGE 1 IS BUILT HERE rather than reusing `<history-flow-page>`, and the strip is why:
 * this page carries the shot stats above its plots and the history page does not, and the
 * two therefore give their plots different shares of the height. `FLOW_PLOTS` carries both
 * ratios so neither surface writes the other's.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import { FLOW_PLOTS, abChannelSpecs, legendItems } from 'src/lib/history-series.js';
import { CHANNEL_TREATMENTS } from 'src/components/ui-chart-card.js';
import { complianceBadge, shotIdentity, summaryTerms } from 'src/lib/expanded-summary.js';
import { backIcon } from 'src/lib/icons.js';

import 'src/components/ui-chart-card.js';
import 'src/components/ui-chart-legend.js';
import 'src/components/ui-icon-button.js';
import 'src/components/ui-tab-bar.js';
import 'src/components/ui-empty-state.js';
import 'src/screens/history-power-page.js';

/**
 * The channel labels. The SAME table `history-flow-page.js` carries, because the two
 * surfaces draw the same channels and a key that named them differently on one screen
 * would be the drift the shared plot table exists to prevent.
 */
const CHANNEL_LABELS = Object.freeze({
    pressure: 'Pressure (bar)',
    targetPressure: 'Target Pressure',
    flow: 'Flow (mL/s)',
    targetFlow: 'Target Flow',
    weightFlow: 'GFlow (g/s)',
    power: 'Power (W)',
    groupTemp: 'Group °C',
    targetTemp: 'Group Target °C',
    mixTemp: 'Mix °C',
    targetMixTemp: 'Mix Target °C',
});

/**
 * THE TWO PAGES, and their ids are Slate's own.
 *
 * `flow` and `power` — the second keeps its historical suffix for the reason Slate's
 * markup states beside the same two ids: "The tab id keeps its historical 'power' suffix
 * so no wiring/storage churns." It is the resistance page and has been since W moved off
 * it; renaming it would be a rename with no reader.
 */
export const EXPANDED_PAGE = Object.freeze({ FLOW: 'flow', POWER: 'power' });

const PAGE_TABS = Object.freeze([
    Object.freeze({ value: EXPANDED_PAGE.FLOW, label: 'Pressure / Flow' }),
    Object.freeze({ value: EXPANDED_PAGE.POWER, label: 'Resistance / Impedance' }),
]);

export class LiveExpandedChart extends UiElement {
    static properties = {
        /** Open. The Live screen's own state; there is no route behind it. */
        open: { type: Boolean, reflect: true },

        /**
         * The derivation the Live card is drawing — handed straight over, never copied
         * and never re-derived. This is what makes the plots live: the same object
         * arrives here at the same 15 Hz it arrives at the card.
         */
        derivation: { attribute: false },

        /** The profile's name, for the identity line. Absent is a legal state. */
        profileName: { type: String, attribute: 'profile-name' },

        /**
         * The puck estimator's `{ compliance, flags }`, or null. `expanded-summary.js`
         * owns the rule; this element only draws the answer.
         */
        compliance: { attribute: false },

        /** Which page is on screen. Reflected, so a test and a stylesheet can both read it. */
        page: { type: String, reflect: true },
    };

    static styles = [typeRoles, css`
        /* NO BACKTICK IN THIS TEMPLATE, comment or not - the rule this file's own
         * header states, broken once already. One backtick ends the css tag mid-comment
         * and the module stops parsing as JavaScript, which the browser reports as
         * "Unexpected identifier" some way further down.
         *
         * THE HOST IS THE WHOLE SCREEN. absolute, not fixed: this is painted inside
         * <live-screen>, which is inside the scaled design canvas, so a viewport-anchored
         * box would be the one surface app-fit.js does not scale (S2.1 Rule 1 - a
         * component reads its own container, never the viewport). Closed it has no box at
         * all rather than a hidden one, so it costs the screen's grid nothing. */
        :host {
            display: none;
        }

        :host([open]) {
            display: grid;
            position: absolute;
            inset: 0;
            /* --ui-z-overlay IS SLATE'S OWN LAYER FOR THIS SURFACE. Its token records
             * the source: index.html:455 (60) -> --ui-z-overlay, and :455 is the
             * expanded-chart overlay itself. */
            z-index: var(--ui-z-overlay);
            grid-template-rows: auto minmax(0, 1fr);
            /* THE GROUND IS PAINTED, and that is not decoration. A full-screen surface
             * with a transparent ground is the Live screen showing through its own
             * expansion - two headers on one row and two charts in one box. --ui-fascia
             * is the page body, which is what Slate's overlay paints
             * (background: var(--bgmain-color)). */
            background-color: var(--ui-fascia);
            min-block-size: 0;
        }

        /* THE HEADER, and its four cells are Slate's own
         * (index.html:456-489): back, identity, tabs, badges.
         *
         * THE TABS ARE CENTRED ON THE SCREEN AND NOT ON WHAT IS LEFT OF IT, which is why
         * the two side cells are a MATCHED PAIR of fixed tracks rather than auto ones. An
         * auto track sized to its content would move the tablist every time the identity
         * line changed length - a shot with a long profile name would centre its tabs
         * somewhere else from the same shot with a short one. Slate reaches the same place
         * with a "fixed 140px + flex-end so the tablist stays centred". */
        #head {
            /* THREE CELLS, AND THE TABS ARE THE MIDDLE ONE.
             *
             * Ben, 25 August 2026: "The top header, center the tab buttons, ie move them to
             * the right."
             *
             * TWO WRONG ANSWERS FIRST, both recorded because each looked right in a
             * different way. Five cells with the tabs in the middle centres them only when
             * the FIXED cells either end are equal, and they are not: a back arrow against a
             * five-term readings strip. Measuring the strip and matching it on the left made
             * the sum 492 + 451 + 492 of 1871 and collapsed the title's track. Taking the
             * tabs out of the flow and centring them absolutely put them on the screen's
             * centre exactly - and left the strip, still in the flow, running underneath
             * them, because nothing in the grid knew they were there.
             *
             * THE ANSWER IS TO STOP TREATING THE BACK ARROW AND THE TITLE AS SEPARATE
             * CELLS. They are one thing - what this shot is - so they share cell 1, the
             * strip has cell 3, and both cells are 1fr. Equal by declaration and equal in
             * effect, because neither holds a fixed box the other has to match. The tabs
             * are then centred by the grid itself, with no measurement and nothing out of
             * the flow.
             *
             * IT FITS, AND THAT IS ARITHMETIC RATHER THAN HOPE: the header's interior is
             * 1871, the tablist 451 and the two gaps 36, so each 1fr cell is 692 - against
             * a strip that measures 492 at its widest, five terms and all. */
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
            align-items: center;
            gap: var(--ui-space-4);
            padding: var(--ui-space-4) var(--ui-space-5);
            border-block-end: var(--ui-border-w) solid var(--ui-line);
        }

        /* CELL 1: the way out and the name, on one line. */
        #lead {
            display: flex;
            align-items: center;
            gap: var(--ui-space-4);
            min-inline-size: 0;
        }

        /* THE BACK BUTTON KEEPS ITS OWN WIDTH. A grid item stretches to its track by
         * default, and the track is a fixed one sized for the badge on the other side -
         * so without this the arrow sits in the middle of a button two and a half controls
         * wide, which reads as a panel rather than as a control. */
        /* THE BACK BUTTON KEEPS ITS OWN WIDTH. A flex item stretches to its line by
         * default, and the line is as tall as the two-line name beside it. */
        #back {
            flex: 0 0 auto;
        }

        /* THE PROFILE'S NAME, ALLOWED TO WRAP AND SET LARGER.
         *
         * Ben, 25 August 2026: "The profile name, allow it to wrap, remove the time and
         * weight that is added to the end, those are now on the right. Make the text a
         * little bigger as well."
         *
         * IT WAS ELLIPSISED AT 17px because it was not only the name: it carried the
         * seconds and the yield joined onto the end, so the line was long by construction
         * and had to be cut. expanded-summary.js takes those away, and a name on its own
         * fits in two lines of a wider type. 20px is one step up the scale from where it
         * was and matches the strip's own values, which is what it now sits beside. */
        #identity {
            min-inline-size: 0;
            color: var(--ui-text-2);
            font-size: 20px;
            line-height: 1.25;
            /* TWO LINES AND THEN THE ELLIPSIS. A name is allowed to wrap; it is not allowed
             * to grow the header, because the header's height is height the plots do not
             * get. Three-line names exist and this is where they stop. */
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
        }

        /* THE SHOT'S NUMBERS MOVED UP HERE, and the plots got the height back.
         *
         * Ben, 25 August 2026: "In the Pressure/Flow tab, can we move the shot data up to
         * the right side of the tabs, where the little compliance is. This way we can have
         * more space for the charts."
         *
         * Slate puts the strip above the plots as its own band, and on Slate's expanded
         * page that band costs the two charts about 60px of the 1200 they share. Here the
         * header row already exists, already has a right-hand cell, and had one 33px badge
         * in it - so the strip costs nothing at all and page 1 stops being the page with
         * less chart on it than page 2.
         *
         * THE TABS STAY CENTRED ON THE SCREEN. The two flexible cells either side of the
         * tablist are what centre it, and they are still there; what changed is that the
         * right-hand FIXED cell is now auto rather than a matched pair with the left.
         * A strip whose width follows its content cannot be balanced by a constant, and
         * balancing it against the back arrow would put the tabs off-centre by the width
         * of whatever the shot happened to measure. */
        #badges {
            display: flex;
            justify-content: flex-end;
            align-items: baseline;
            gap: var(--ui-space-5);
            min-inline-size: 0;
        }

        /* COMPLIANCE IS A TERM OF THE STRIP NOW, NOT A BADGE BESIDE IT.
         *
         * Ben, 25 August 2026: "The compliance value will be below the C, and dont call it
         * C, call it compliance."
         *
         * BOTH HALVES OF THAT ARE THE STRIP'S OWN SHAPE. Every term there is its cap over
         * its value, and every cap is a word; the badge was the one reading on this header
         * set as a letter and a number on one line. So it stops being a special case:
         * summaryTerms grows a compliance term, this rule paints the absent one muted,
         * and the separate #compliance span is gone.
         *
         * SLATE HAD IT BOTH WAYS AND SAID SO — the badge kept the letter, the strip spelled
         * the word out ("C 1.47 mL/bar is unreadable as an abbreviation on a screen someone
         * reaches once a month"). With the strip in the header there is only one place for
         * it, and Ben picked the word. */
        #summary [data-term="compliance"] dd {
            color: var(--ui-muted);
        }

        #summary [data-term="compliance"].observed dd {
            color: var(--ui-text);
        }

        /* THE PAGE. One grid cell, and only the selected page is in it - the other is not
         * rendered at all rather than hidden. A hidden chart is a chart that still holds a
         * uPlot instance, still gets every 15 Hz frame and still redraws into a box of no
         * size, which is the "draws into a 0x0 canvas and comes back blank" failure the
         * card's own resize handling exists to avoid. */
        #page {
            display: grid;
            grid-template-rows: minmax(0, 1fr);
            grid-template-columns: minmax(0, 1fr);
            padding: var(--ui-space-4) var(--ui-space-5) var(--ui-space-5);
            min-block-size: 0;
            min-inline-size: 0;
        }

        /* PAGE 1: the strip, then the two plots.
         *
         * THE STRIP IS AN auto TRACK AND THE PLOTS SHARE WHAT IS LEFT, which is the whole
         * reason this page has its own ratio: Slate gives the expanded pair 470 over 335
         * (1.403) against the history pair's 416 over 344 (1.209), and the difference is
         * the strip. FLOW_PLOTS.expandedRatio carries the number so this file states no
         * ratio of its own. */
        #plots {
            display: grid;
            grid-template-rows: var(--_ui-plot-ratio, 1.403fr) 1fr;
            gap: var(--ui-space-4);
            min-block-size: 0;
            min-inline-size: 0;
        }

        #plots > * {
            min-block-size: 0;
            min-inline-size: 0;
        }

        /* THE STATS STRIP. A definition list, because that is what it is: four terms and
         * their values. Slate's .slate-summary-strip, in the header rather than under it. */
        #summary {
            display: flex;
            align-items: baseline;
            gap: var(--ui-space-5);
            margin: 0;
            min-inline-size: 0;
        }

        /* A TERM IS ITS LABEL OVER ITS VALUE, and it does not wrap. The header is one row
         * and a term that wrapped would take the row's height with it, which is the height
         * this whole move exists to give back. */
        #summary > div {
            display: flex;
            flex-direction: column;
            gap: var(--ui-space-1);
            min-inline-size: 0;
            white-space: nowrap;
        }

        #summary dt,
        #summary dd {
            margin: 0;
        }

        /* SLATE'S OWN TWO NUMBERS FOR THE VALUE — 20 / 500 against Decal's 16 / 400,
         * which the type audit measured as the largest difference on this surface. It is
         * the first reading above the plots and it was set as body text. */
        #summary dd {
            font-size: 20px;
            font-weight: var(--ui-weight-medium);
        }

        history-power-page {
            min-block-size: 0;
            min-inline-size: 0;
        }
    `];

    #i18n = new I18nController(this);

    constructor() {
        super();
        this.open = false;
        this.derivation = null;
        this.profileName = '';
        this.compliance = null;
        this.page = EXPANDED_PAGE.FLOW;
    }

    render() {
        if (!this.open) return nothing;
        const t = this.#i18n.t;

        return html`
            <div id="head">
                <div id="lead">
                    <ui-icon-button
                        id="back"
                        size="lg"
                        label=${t('Back to the Live screen')}
                        @click=${this.#close}
                    >${backIcon()}</ui-icon-button>

                    <p id="identity" class="ui-body" aria-live="polite"
                        >${shotIdentity(this.derivation, { profileName: this.profileName })}</p>
                </div>

                <ui-tab-bar
                    id="tabs"
                    label=${t('Expanded chart pages')}
                    .tabs=${PAGE_TABS.map(({ value, label }) => ({ value, label: t(label) }))}
                    .value=${this.page}
                    @change=${this.#onPage}
                ></ui-tab-bar>

                <div id="badges">${this.#summary()}</div>
            </div>

            <div id="page">${this.#page()}</div>
        `;
    }

    /**
     * The page on screen.
     *
     * THERE IS NO STEAM BRANCH ANY MORE, and its absence is the feature. Ben, 25 August
     * 2026: "The expanded chart: Copy Slate, no expanded chart for Steam." The refusal is
     * one line in `<live-screen>`'s `#openExpanded` — Slate's single choke point, carried —
     * so this element is never opened on a steam session and the three steam properties it
     * used to take went with the branch that read them.
     *
     * WHAT WAS HERE: one enlarged steam plot, no tabs, no strip, no second page. Both pages
     * of this surface are espresso-shot channels — R and Z are pressure over flow through a
     * puck, and a steam wand has no puck — so an expansion of a steam chart is a bigger
     * chart on a surface built to be something else.
     */
    #page() {
        const t = this.#i18n.t;
        const derivation = this.derivation ?? null;

        if (!derivation || derivation.ok !== true) {
            return html`<ui-empty-state
                id="empty"
                heading=${t('No shot to draw')}
                body=${t('Start a shot and it appears here as it pours.')}
            ></ui-empty-state>`;
        }

        if (this.page === EXPANDED_PAGE.POWER) {
            /* THE HISTORY POWER PAGE, DRIVEN LIVE. One shot, no comparison, no offset —
             * `abChannelSpecs` returns the reference specs alone when it is given no B, so
             * the page draws a single trace per channel without knowing it is not in the
             * History viewer. */
            return html`<history-power-page
                id="power-page"
                .derivationA=${derivation}
                .derivationB=${null}
                .failure=${null}
                offset="0"
            ></history-power-page>`;
        }

        return html`
                <div id="plots" style="--_ui-plot-ratio: ${FLOW_PLOTS[0].expandedRatio}fr">
                    ${FLOW_PLOTS.map((plot) => html`
                        <ui-chart-card
                            id="plot-${plot.id}"
                            data-plot=${plot.id}
                            activate
                            label=${t(plot.label)}
                            activate-label=${t('Close the expanded chart')}
                            y-floor=${plot.yFloor ?? nothing}
                            y-policy=${plot.yPolicy ?? nothing}
                            .channelKeys=${abChannelSpecs(plot.channels, { treatments: CHANNEL_TREATMENTS })}
                            .derivation=${derivation}
                            @plot-activate=${this.#close}
                        >
                            <!-- BOUND, because an unbound legend is a row of chips that
                                 light and do nothing - the defect Ben found on the History
                                 page the same day. The id resolves because a slotted
                                 element belongs to the tree it was AUTHORED in, which is
                                 this shadow root. -->
                            <ui-chart-legend
                                slot="legend"
                                chart="plot-${plot.id}"
                                label=${t('Chart key')}
                                .items=${legendItems(plot.channels, CHANNEL_LABELS, CHANNEL_TREATMENTS)}
                            ></ui-chart-legend>
                        </ui-chart-card>`)}
                </div>
        `;
    }

    /**
     * The stats strip, in the header's right-hand cell.
     *
     * IT IS NOT ON A PAGE, which is what Ben asked for and is also why it is built here
     * rather than inside `#page()`. The numbers describe the SHOT, not the page: time, peak
     * and average pressure, peak and average flow, compliance. Drawing them on page 1 only
     * made page 1 shorter than page 2 and said, wrongly, that they were about the plots
     * underneath.
     *
     * COMPLIANCE IS NOT REPEATED. The strip's fourth term is the same number the badge
     * beside it carries, and Slate could print both because they were on different bands.
     * On one row it would be the same reading twice, eight pixels apart, so `summaryTerms`
     * is called with no badge and the C keeps its own cell.
     */
    #summary() {
        const t = this.#i18n.t;
        const derivation = this.derivation ?? null;
        const badge = complianceBadge(this.compliance ?? {});
        const measured = derivation && derivation.ok === true
            ? summaryTerms(derivation, badge) : [];

        /* COMPLIANCE IS ALWAYS A TERM, even when nothing observed it.
         *
         * `summaryTerms` drops a term whose source is absent, which is right for every
         * other reading here - a shot with no scale has no Weight out, and a zero in its
         * place is a measurement that never happened. Compliance is the exception because
         * it is the one term whose ABSENCE is a fact about the machine rather than about
         * the shot: the estimator either observed C or it did not, and the em dash says
         * which. Dropping it would make the header change width between two shots on the
         * same machine.
         *
         * SO THE STRIP IS BUILT IN TWO HALVES and the join is here rather than inside the
         * pure module: `summaryTerms` keeps its one rule (a term is dropped when its source
         * is absent) and this call site states the one exception it wants. */
        const terms = badge.observed
            ? measured
            : [...measured, { key: 'compliance', label: 'Compliance', value: badge.text }];
        if (!terms.length) return nothing;

        return html`<dl id="summary" aria-label=${t('Shot summary')}>
            ${terms.map((term) => html`
                <div data-term=${term.key} class=${term.key === 'compliance' && badge.observed ? 'observed' : ''}>
                    <dt class="ui-microcap">${t(term.label)}</dt>
                    <dd class="ui-numeric">${term.value}</dd>
                </div>`)}
        </dl>`;
    }


    #onPage = (event) => {
        const value = event?.detail?.value ?? event?.target?.value;
        if (value === EXPANDED_PAGE.FLOW || value === EXPANDED_PAGE.POWER) this.page = value;
    };

    /**
     * TAPPING A CHART CLOSES IT. Ben, 25 August 2026: "Full screen with the back button
     * BUT also make it so tapping a chart closes it back to the Live view page."
     *
     * The same gesture that opened it, on the same kind of surface, which is what makes it
     * discoverable without a hint: `<ui-chart-card>`'s `activate` turns the plot well into
     * a button and announces `plot-activate`, and the Live card uses it to open this one.
     *
     * THE LEGEND STILL WORKS. The chips are slotted OUTSIDE the well, so a press on one
     * toggles its series and never reaches the well's own listener.
     */
    #close = () => {
        if (!this.open) return;
        this.open = false;
        /* THE PAGE GOES BACK TO THE FIRST ONE. Reopening on the resistance page because
         * that is where it was last closed would be a surface that opens somewhere other
         * than where its own tab bar says it starts - and the flow page is what the tap
         * on the Live chart is an expansion OF. */
        this.page = EXPANDED_PAGE.FLOW;
        this.dispatchEvent(new CustomEvent('expanded-close', { bubbles: true, composed: true }));
    };
}

customElements.define('live-expanded-chart', LiveExpandedChart);
