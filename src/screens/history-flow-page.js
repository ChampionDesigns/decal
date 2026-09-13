/**
 * <history-flow-page>, the History route's first page.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';
import {
    COMPARISON_ALPHA, COMPARISON_DASH, COMPARISON_KEY_PREFIX,
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
import {
    readoutLine, readoutTerms, readoutValues, valuesAtTime,
} from 'src/lib/chart-readout.js';
import { comparisonTempBand } from 'src/lib/chart-autoscale.js';
import {
    DEFAULT_TEMP_UNIT, TEMP_UNIT, boundToDisplay, normaliseUnit, toDisplayTemp, unitSymbol,
} from 'src/lib/temperature.js';

import { CHANNEL_TREATMENTS } from 'src/components/ui-chart-card.js';
import 'src/components/ui-chart-legend.js';
import 'src/components/ui-empty-state.js';

/** The mount contract's own two attributes, so a caller writing the tag gets them. */
export const FLOW_PAGE_ID = 'flow';

const labelsFor = (unit) => Object.freeze({
    pressure: 'Pressure (bar)',
    targetPressure: 'Target Pressure (bar)',
    flow: 'Flow (mL/s)',
    targetFlow: 'Target Flow (mL/s)',
    weightFlow: 'GFlow (g/s)',
    power: 'Hydraulic power (W)',
    groupTemp: `Group ${unitSymbol(unit)}`,
    targetTemp: `Group Target ${unitSymbol(unit)}`,
    mixTemp: `Mix ${unitSymbol(unit)}`,
    targetMixTemp: `Mix Target ${unitSymbol(unit)}`,
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
        tempUnit: { type: String, attribute: 'temp-unit' },
    };

    static styles = [css`
        :host {
            display: grid;
            grid-template-rows: minmax(0, 1fr) auto;
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

    #records = {};
    constructor() {
        super();
        this.derivationA = null;
        this.derivationB = null;
        this.failure = null;
        this.offset = 0;
        this._cursor = {};
        this._hidden = {};
        this.tempUnit = DEFAULT_TEMP_UNIT;
    }
    get #unit() {
        return normaliseUnit(this.tempUnit) ?? DEFAULT_TEMP_UNIT;
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
                        temp-unit=${this.#unit}
                        .derivation=${this.derivationA ?? null}
                        @cursor-change=${this.#onCursor}
                        @legend-change=${this.#onLegendChange}
                    >
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

    #labelCache = { language: null, unit: null, labels: null, items: null };

    #labels() {
        return this.#cache().labels;
    }

    #legendItems(plot) {
        return this.#cache().items.get(plot.id);
    }

    #cache() {
        const language = this.#i18n.language;
        const unit = this.#unit;
        if (this.#labelCache.language === language && this.#labelCache.unit === unit) {
            return this.#labelCache;
        }
        const t = this.#i18n.t;
        const labels = {};
        for (const [key, label] of Object.entries(labelsFor(unit))) labels[key] = t(label);
        const items = new Map();
        for (const plot of FLOW_PLOTS) {
            items.set(plot.id, legendItems(plot.channels, labels, CHANNEL_TREATMENTS));
        }
        this.#labelCache = { language, unit, labels, items };
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
        const unit = this.#unit;
        const previous = this.#appliedToken;
        if (previous?.a === a && previous?.b === b && previous?.offset === offset && previous?.unit === unit) return;
        const token = { a, b, offset, unit };
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

            const celsius = abRecords(plot.channels, { a, b, offset });
            const records = this.#drawn(celsius, plot, unit);
            this.#records = { ...this.#records, [plot.id]: records };
            if (plot.yPolicy === 'temp') {
                const band = this.#band(celsius, unit);
                const held = card.yRange;
                if (!Array.isArray(held) || held[0] !== band[0] || held[1] !== band[1]) {
                    card.yRange = band;
                    await card.updateComplete;
                    if (this.#appliedToken !== token) return;
                }
            }
            card.setChannels(abChannelSpecs(plot.channels, {
                hasComparison,
                treatments: CHANNEL_TREATMENTS,
            }));
            card.setRecords(records);

            card.setRuleSource((tokens) => {
                this.#legendFor(plot.id)?.reapply();
                const rules = comparisonStepRules({
                    a, b, offset,
                    paint: {
                        colour: tokens?.channels?.['step-boundary'],
                        ink: tokens?.surface?.label,
                        width: tokens?.geometry?.strokeMinor,
                        dash: dashPattern(COMPARISON_DASH),
                        alpha: COMPARISON_ALPHA,
                    },
                });
                rules.labels = rules.labels.map((label, index) => ({ ...label, text: String(index + 1), rotate: false }));
                return rules;
            });
        }
        if (Object.values(this._cursor).some((detail) => detail?.active === true)) {
            this.requestUpdate();
        }
    }

    #drawn(records, plot, unit) {
        if (plot.yPolicy !== 'temp' || unit === TEMP_UNIT.CELSIUS) return records;
        const out = { ...records };
        for (const channel of plot.channels) {
            for (const prefix of ['', COMPARISON_KEY_PREFIX]) {
                const key = `${prefix}${channel}`;
                const ys = records?.[key]?.y;
                if (!Array.isArray(ys)) continue;
                out[key] = {
                    ...records[key],
                    y: ys.map((v) => (typeof v === 'number' && Number.isFinite(v)
                        ? toDisplayTemp(v, unit) : v)),
                };
            }
        }
        return out;
    }
    #band(celsius, unit) {
        const band = comparisonTempBand(celsius, ['', COMPARISON_KEY_PREFIX]);
        if (unit === TEMP_UNIT.CELSIUS) return band;
        return band.map((end) => boundToDisplay(end, unit));
    }
    #legendFor(id) {
        return this.renderRoot?.querySelector(`ui-chart-legend[chart="plot-${id}"]`) ?? null;
    }
    #onCursor = (event) => {
        const id = event.currentTarget?.dataset?.plot;
        if (!FLOW_PLOTS.some((entry) => entry.id === id)) return;
        const detail = event.detail;
        this._cursor = Object.fromEntries(FLOW_PLOTS.map(plot => [plot.id, detail]));
        for (const plot of FLOW_PLOTS) {
            if (plot.id !== id) this.renderRoot?.getElementById(`plot-${plot.id}`)
                ?.setInspectionTime(detail?.active ? detail.t : null);
        }
    };

    #onLegendChange = (event) => {
        const id = event.currentTarget?.dataset?.plot;
        if (!FLOW_PLOTS.some((entry) => entry.id === id)) return;
        const hidden = Array.isArray(event.detail?.hidden) ? event.detail.hidden : [];
        this._hidden = { ...this._hidden, [id]: hidden };
    };

    #reading(plot, labels) {
        const detail = this.#resolved(plot);
        const hidden = this._hidden[plot.id] ?? EMPTY_KEYS;
        const values = readoutValues(detail, plot.channels, { hidden });
        if (!Object.keys(values).length) return { values: NO_VALUES, line: '' };
        const terms = readoutTerms(detail, plot.channels, { hidden, withUnit: false });
        return { values, line: readoutLine(terms, labels) };
    }
    #resolved(plot) {
        const detail = this._cursor[plot.id];
        if (!detail || detail.active !== true) return detail;
        return {
            ...detail,
            values: valuesAtTime(this.#records[plot.id], plot.channels, detail.t),
        };
    }

}

customElements.define('history-flow-page', HistoryFlowPage);
