/**
 * <history-flow-page>, the History route's first page.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';
import {
    COMPARISON_ALPHA, COMPARISON_DASH,
    FLOW_PLOTS, abChannelSpecs, abRecords, legendItems,
} from 'src/lib/history-series.js';

import {
    comparisonStepRules,
    compareOnOneClock,
    comparisonWindow,
} from 'src/lib/history-compare.js';
/* The port's reader for the port's typed failure — one place turns a failure into the
 * two sentences a refusal shows, so both pages say the same thing about the same fault. */
import { failureRefusal } from 'src/lib/history-viewer.js';
import { dashPattern } from 'src/lib/chart-axis.js';
import { readoutLine, readoutTerms, readoutValues } from 'src/lib/chart-readout.js';

import { CHANNEL_TREATMENTS } from 'src/components/ui-chart-card.js';
import 'src/components/ui-chart-legend.js';
import 'src/components/ui-empty-state.js';

/** The mount contract's own two attributes, so a caller writing the tag gets them. */
export const FLOW_PAGE_ID = 'flow';

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

        failure: { attribute: false },

        offset: { type: Number },

        _cursor: { state: true },

        _hidden: { state: true },
    };

    static styles = [css`
        :host {
            display: grid;
            grid-template-rows: minmax(0, 1fr);
            grid-template-columns: minmax(0, 1fr);
            container-type: size;
            min-block-size: 0;
            min-inline-size: 0;
        }

        #grid {
            display: grid;
            grid-template-rows: 1.209fr 1fr;
            gap: var(--ui-space-3);
            min-block-size: 0;
            min-inline-size: 0;
        }

        ui-chart-card {
            min-inline-size: 0;
        }

        .reading {
            display: block;
            block-size: 0;
            clip-path: inset(50%);
        }

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

    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('slot')) this.setAttribute('slot', 'page');
        if (!this.hasAttribute('data-page')) this.setAttribute('data-page', FLOW_PAGE_ID);
    }

    render() {
        const t = this.#i18n.t;
        const hasA = Boolean(this.derivationA && this.derivationA.ok);
        const labels = this.#labels();
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
            const view = comparisonWindow(compareOnOneClock({
                channels: plot.channels, a, b, offset,
            }));
            card.xMin = view.empty ? null : Math.min(view.min, 0);

            card.setChannels(abChannelSpecs(plot.channels, {
                hasComparison,
                treatments: CHANNEL_TREATMENTS,
            }));
            card.setRecords(abRecords(plot.channels, { a, b, offset }));

            card.setRuleSource((tokens) => comparisonStepRules({
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
    }

    #onCursor = (event) => {
        const id = event.currentTarget?.dataset?.plot;
        if (!FLOW_PLOTS.some((entry) => entry.id === id)) return;
        this._cursor = { ...this._cursor, [id]: event.detail };
    };

    #onLegendChange = (event) => {
        const id = event.currentTarget?.dataset?.plot;
        if (!FLOW_PLOTS.some((entry) => entry.id === id)) return;
        const hidden = Array.isArray(event.detail?.hidden) ? event.detail.hidden : [];
        this._hidden = { ...this._hidden, [id]: hidden };
    };

    #reading(plot, labels) {
        const detail = this._cursor[plot.id];
        const hidden = this._hidden[plot.id] ?? EMPTY_KEYS;
        const values = readoutValues(detail, plot.channels, { hidden });
        if (!Object.keys(values).length) return { values: NO_VALUES, line: '' };
        const terms = readoutTerms(detail, plot.channels, { hidden, withUnit: false });
        return { values, line: readoutLine(terms, labels) };
    }

}

customElements.define('history-flow-page', HistoryFlowPage);
