/**
 * The full-screen chart, live, opened by tapping the Live plot.
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

export const EXPANDED_PAGE = Object.freeze({ FLOW: 'flow', POWER: 'power' });

const PAGE_TABS = Object.freeze([
    Object.freeze({ value: EXPANDED_PAGE.FLOW, label: 'Pressure / Flow' }),
    Object.freeze({ value: EXPANDED_PAGE.POWER, label: 'Resistance / Impedance' }),
]);

export class LiveExpandedChart extends UiElement {
    static properties = {
        /** Open. The Live screen's own state; there is no route behind it. */
        open: { type: Boolean, reflect: true },

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
        :host {
            display: none;
        }

        :host([open]) {
            display: grid;
            position: absolute;
            inset: 0;
            z-index: var(--ui-z-overlay);
            grid-template-rows: auto minmax(0, 1fr);
            background-color: var(--ui-fascia);
            min-block-size: 0;
        }

        #head {
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

        /* THE BACK BUTTON KEEPS ITS OWN WIDTH. A flex item stretches to its line by
         * default, and the line is as tall as the two-line name beside it. */
        #back {
            flex: 0 0 auto;
        }

        #identity {
            min-inline-size: 0;
            color: var(--ui-text-2);
            font-size: 20px;
            line-height: 1.25;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
        }

        #badges {
            display: flex;
            justify-content: flex-end;
            align-items: baseline;
            gap: var(--ui-space-5);
            min-inline-size: 0;
        }

        #summary [data-term="compliance"] dd {
            color: var(--ui-muted);
        }

        #summary [data-term="compliance"].observed dd {
            color: var(--ui-text);
        }

        #page {
            display: grid;
            grid-template-rows: minmax(0, 1fr);
            grid-template-columns: minmax(0, 1fr);
            padding: var(--ui-space-4) var(--ui-space-5) var(--ui-space-5);
            min-block-size: 0;
            min-inline-size: 0;
        }

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

        #summary {
            display: flex;
            align-items: baseline;
            gap: var(--ui-space-5);
            margin: 0;
            min-inline-size: 0;
        }

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

    #summary() {
        const t = this.#i18n.t;
        const derivation = this.derivation ?? null;
        const badge = complianceBadge(this.compliance ?? {});
        const measured = derivation && derivation.ok === true
            ? summaryTerms(derivation, badge) : [];

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

    #close = () => {
        if (!this.open) return;
        this.open = false;
        this.page = EXPANDED_PAGE.FLOW;
        this.dispatchEvent(new CustomEvent('expanded-close', { bubbles: true, composed: true }));
    };
}

customElements.define('live-expanded-chart', LiveExpandedChart);
