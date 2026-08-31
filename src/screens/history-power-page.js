/**
 * <history-power-page>, the History route's third page.
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

/** The two plots, in the order the page draws them. */
export const POWER_PLOTS = Object.freeze([
    Object.freeze({ id: 'derived', label: 'Puck resistance and power' }),
    Object.freeze({ id: 'trajectory', label: 'Pressure against flow' }),
]);

const CHANNEL_LABELS = Object.freeze({
    resistance: 'R — resistance (bar·s²/mL²)',
    impedance: 'Z — impedance (bar·s/mL)',
});

/** The ten ramp stops, by custom property name. Read computed; declared in CSS. */
const RAMP_TOKENS = Object.freeze(
    Array.from({ length: 10 }, (_, i) => `--ui-timekey-stop-${i}`),
);

/** No rules at all — the payload `setRules` takes for "this plot annotates nothing". */
const NO_RULES = Object.freeze({ vertical: [], horizontal: [], labels: [] });

/** One frozen empty map, so a resting legend is handed the same object every render. */
const NO_VALUES = Object.freeze({});

/** One frozen empty list, for a legend that has hidden nothing. */
const EMPTY_KEYS = Object.freeze([]);

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

        _cursor: { state: true },

        /** The channels the derived card's legend is hiding — `{ derived: [key] }`. */
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
            grid-template-rows: 1fr 1.4fr;
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

        .trajectory-reading {
            display: block;
            min-block-size: calc(var(--ui-text-note) * 1.5);
            font-size: var(--ui-text-note);
            line-height: 1.5;
            padding-inline-start: var(--ui-chart-gutter-l);
            color: var(--ui-muted);
        }

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

    async #syncEmpty() {
        const a = this.derivationA ?? null;
        const b = this.derivationB ?? null;
        const derived = this.renderRoot?.getElementById?.('plot-derived');
        const pq = this.renderRoot?.getElementById?.('plot-pq');
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

            derived.y2 = null;
            const logRange = derivedLeftRange({ a, b });
            derived.yRange = logRange;
            derived.yAxis = {
                format: formatLogTick,
                splits: derivedTickValues(logRange),
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
            pq.yRange = [0, trajectoryFrame({ a, b }).pressureMax];
            pq.setRuleSource(() => {
                this.#paintTrajectory(pq, { a, b, offset });
                return NO_RULES;
            });
        }
    }

    /**
     * The two trajectories, the correspondence marks and the links — every colour read
     * from CSS at the moment of painting, never held.
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
        card.cursorPoints = pointsA.length ? pointsA : null;
        const pointsB = trajectoryPoints(b, { offset });
        if (pointsB.length) {
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

    #onCursor = (event) => {
        const id = event.currentTarget?.dataset?.plot;
        if (!POWER_PLOTS.some((entry) => entry.id === id)) return;
        this._cursor = { ...this._cursor, [id]: event.detail };
    };

    #onLegendChange = (event) => {
        const id = event.currentTarget?.dataset?.plot;
        if (!POWER_PLOTS.some((entry) => entry.id === id)) return;
        const hidden = Array.isArray(event.detail?.hidden) ? event.detail.hidden : [];
        this._hidden = { ...this._hidden, [id]: hidden };
    };

    #derivedReading(labels) {
        const detail = this._cursor.derived;
        const hidden = this._hidden.derived ?? EMPTY_KEYS;
        const values = readoutValues(detail, DERIVED_CHANNELS, { hidden });
        if (!Object.keys(values).length) return { values: NO_VALUES, line: '' };
        const terms = readoutTerms(detail, DERIVED_CHANNELS, { hidden, withUnit: false });
        return { values, line: readoutLine(terms, labels) };
    }

    #trajectoryReading(t) {
        const detail = this._cursor.trajectory;
        if (!detail || detail.active !== true) return '';
        const words = {};
        for (const [key, label] of Object.entries(TRAJECTORY_TERM_LABELS)) words[key] = t(label);
        return readoutLine(trajectoryTerms(detail.point), words);
    }

}

const MARK_SIZE_PX = 9;
const LINK_ALPHA = 0.7;

customElements.define('history-power-page', HistoryPowerPage);
