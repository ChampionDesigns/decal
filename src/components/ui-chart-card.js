/**
 * The chart surface: an uPlot canvas with its legend, scrubber and axis, fed by the chart feed.
 */

import { css, html, nothing } from 'lit';

import { PlotSurfaceElement } from './plot-surface.js';
import { channelNameFor, readChartTokens } from '../lib/chart-tokens.js';
import { SERIES_KEYS, indexAtTime } from '../lib/shot-derivation.js';
import { effectivePixelRatio, FIT_EVENT } from '../lib/app-fit.js';
import { computeTempRange, widenBand } from '../lib/chart-autoscale.js';

export const DEFAULT_CHANNELS = Object.freeze([
    Object.freeze({ key: 'pressure' }),
    Object.freeze({ key: 'targetPressure', minor: true, dash: 'dash' }),
    Object.freeze({ key: 'flow' }),
    Object.freeze({ key: 'targetFlow', minor: true, dash: 'dash' }),
    Object.freeze({ key: 'weightFlow', minor: true }),
    Object.freeze({ key: 'groupTemp', factor: 0.1 }),
    Object.freeze({ key: 'targetTemp', minor: true, dash: 'dash', factor: 0.1 }),
]);

const EXTRA_TREATMENTS = Object.freeze([
    Object.freeze({ key: 'groupTemp' }),
    Object.freeze({ key: 'targetTemp', minor: true, dash: 'dash' }),
    Object.freeze({ key: 'targetMixTemp', minor: true, dash: 'dash' }),
    Object.freeze({ key: 'power', minor: true }),
]);

export const CHANNEL_TREATMENTS = new Map([...DEFAULT_CHANNELS, ...EXTRA_TREATMENTS]
    .map((channel) => [channel.key, channel]));

/** The cursor at rest. Frozen, and the same shape as an active one. */
const NO_CURSOR = Object.freeze({ active: false, idx: null, t: null, values: Object.freeze({}) });

/** Parse `channels="pressure flow"` — space or comma separated, order preserved. */
function parseChannelKeys(value) {
    return String(value ?? '')
        .split(/[\s,]+/)
        .map((key) => key.trim())
        .filter(Boolean);
}

export class UiChartCard extends PlotSurfaceElement {
    static properties = {
        legendGutter: { type: Boolean, reflect: true, attribute: 'legend-gutter' },
        derivation: { attribute: false },

        channelKeys: { attribute: 'channels', converter: { fromAttribute: parseChannelKeys } },

        /** The plot region's accessible name. Consumer-supplied and already translated. */
        label: { type: String },

        scrubLabel: { type: String, attribute: 'scrub-label' },

        activate: { type: Boolean, reflect: true },

        /** The activation control's accessible name. Already translated. */
        activateLabel: { type: String, attribute: 'activate-label' },

        /** Reflected so a screen can style the refusal. Set from the derivation. */
        empty: { type: Boolean, reflect: true },

        y2: { attribute: false },

        yRange: { attribute: false },

        yAxis: { attribute: false },

        cursorPoints: { attribute: false },

        yPolicy: { type: String, attribute: 'y-policy' },
    };

    static styles = [
        ...PlotSurfaceElement.styles,
        css`
            :host {
                display: block;

                --_ui-chart-card-pad-top: var(--ui-space-6);

                --_ui-chart-card-chrome: calc(
                    var(--_ui-chart-card-pad-top) + var(--ui-space-3) + 2 * var(--ui-border-w));

                min-block-size: calc(var(--ui-chart-min-h) + var(--_ui-chart-card-chrome));
            }

            :host([has-legend]) {
                --_ui-chart-card-chrome: calc(
                    var(--_ui-chart-card-pad-top) + var(--ui-space-3) + 2 * var(--ui-border-w)
                    + var(--ui-legend-chip-h) + var(--ui-space-2));
            }

            .frame {
                display: grid;
                grid-template-rows: auto minmax(var(--ui-chart-min-h), 1fr) auto;

                block-size: 100%;
                min-block-size: calc(var(--ui-chart-min-h) + var(--_ui-chart-card-chrome));
                padding: var(--_ui-chart-card-pad-top) var(--ui-space-2) var(--ui-space-3);
                border: var(--ui-border-w) solid var(--ui-line);
                border-radius: var(--ui-radius-lg);

                background-color: var(--ui-chart-well, var(--ui-key));
            }

            .legend {
                display: block;
                min-inline-size: 0;
            }

            :host([has-legend]) .legend {
                min-block-size: var(--ui-legend-chip-h);

                padding-block-end: var(--ui-space-2);

                padding-inline-start: calc(var(--ui-chart-gutter-l) - var(--ui-chart-label-l));

            }

            :host([legend-gutter]) .legend {
                padding-inline-start: calc(var(--ui-chart-gutter-l) - var(--ui-chart-label-l));
                padding-inline-end: calc(var(--ui-chart-gutter-r) - var(--ui-chart-label-r));
                padding-block-end: var(--ui-space-4);
            }

            .well {
                position: relative;
                min-inline-size: 0;
                min-block-size: 0;

                touch-action: pan-y;
            }

            .cursor {
                position: absolute;
                inset-inline-start: 0;
                inset-block-start: var(--_ui-chart-cursor-top, 0px);
                inline-size: var(--ui-border-w);
                block-size: var(--_ui-chart-cursor-h, 0px);
                transform: translateX(var(--_ui-chart-cursor-x, 0px));
                background-color: var(--ui-chart-label);
                pointer-events: none;
            }

            .cursor[hidden] {
                display: none;
            }

            .cursor[data-shape="point"] {
                --_ui-chart-cursor-dot: var(--ui-space-2);

                inline-size: var(--_ui-chart-cursor-dot);
                block-size: var(--_ui-chart-cursor-dot);
                border-radius: 50%;
                transform: translateX(calc(
                    var(--_ui-chart-cursor-x, 0px) - var(--_ui-chart-cursor-dot) / 2));
            }

            /* THE REFUSAL. Centred over the well; the words are the consumer's. */
            .empty {
                position: absolute;
                inset: 0;
                display: grid;
                place-items: center;
                pointer-events: none;
                color: var(--ui-muted);
            }

            .foot {
                display: block;
                min-inline-size: 0;
            }
        `,
    ];

    /** The derivation's shared x axis (`axis.t`) — what the cursor indexes into. */
    #xs = [];

    /** The derivation's series, for the cursor's readout. Never copied. */
    #series = {};

    #cursor = NO_CURSOR;

    /** A composer's own answer to "what are this card's rules?" — see `setRuleSource`. */
    #ruleSource = null;

    #tempBandHeld = null;

    #tempBandSamples = 0;

    #resizeObserver = null;

    #pointerBound = false;

    #onDppxChange = () => {
        this.pixelRatio = effectivePixelRatio(globalThis);
        this.#placeCursor();
    };

    constructor() {
        super();
        this.derivation = null;
        this.channelKeys = null;
        this.label = '';
        this.scrubLabel = '';
        this.empty = true;
        this.y2 = null;
        this.yRange = null;
        this.yAxis = null;
        this.yPolicy = 'damped';
        this.cursorPoints = null;
    }

    /** `{ active, idx, t, values }` — the crosshair's current reading. Frozen. */
    get cursor() { return this.#cursor; }

    /** The channel specs actually handed to the plot, resolved from tokens. */
    get channelSpecs() { return this.#specs(); }

    plotCoordinateCheck() {
        const over = this.plotHandle?.raw?.over;
        if (!over) return null;
        const rect = over.getBoundingClientRect();
        return {
            rectWidth: rect.width,
            clientWidth: over.clientWidth,
            rectHeight: rect.height,
            clientHeight: over.clientHeight,
            scaleX: rect.width ? over.clientWidth / rect.width : 1,
            scaleY: rect.height ? over.clientHeight / rect.height : 1,
            pixelRatio: this.pixelRatio,
        };
    }

    render() {
        return html`<div class="frame" part="frame">
            <div class="legend" part="legend"><slot name="legend" @slotchange=${this.#onLegendSlot}></slot></div>
            <div class="well" part="well"
                role=${this.activate ? 'button' : 'group'}
                tabindex=${this.activate ? '0' : nothing}
                aria-label=${this.activate
                    ? (this.activateLabel || this.label || nothing)
                    : (this.scrubLabel || this.label || nothing)}
            >
                <div
                    class="plot"
                    part="plot"
                    role="img"
                    aria-label=${this.label || nothing}
                ></div>
                <div class="cursor" part="cursor" aria-hidden="true" hidden></div>
                ${this.empty
                    ? html`<div class="empty" part="empty"><slot name="empty"></slot></div>`
                    : nothing}
            </div>
            <div class="foot" part="foot"><slot name="foot"></slot></div>
        </div>`;
    }

    firstUpdated(changed) {
        super.firstUpdated(changed);
        this.#observeBoxes();
        this.#bindPointer();
    }

    connectedCallback() {
        super.connectedCallback();
        globalThis.addEventListener?.('dppxchange', this.#onDppxChange);
        globalThis.addEventListener?.(FIT_EVENT, this.#onDppxChange);
        this.pixelRatio = effectivePixelRatio(globalThis);
        if (this.hasUpdated) {
            this.#observeBoxes();
            this.#bindPointer();
        }
    }

    disconnectedCallback() {
        globalThis.removeEventListener?.('dppxchange', this.#onDppxChange);
        globalThis.removeEventListener?.(FIT_EVENT, this.#onDppxChange);
        this.#resizeObserver?.disconnect();
        this.#resizeObserver = null;
        this.#clearCursor();
        super.disconnectedCallback();
    }

    /**
     * The derivation and the channel list both land here, BEFORE the first render, so a
     * card handed a shot at construction builds its plot once — not once empty and once
     * again with data.
     */
    willUpdate(changed) {
        super.willUpdate?.(changed);
        if (changed.has('derivation') || changed.has('channelKeys')) this.#applyDerivation();
        if ((changed.has('y2') || changed.has('yRange') || changed.has('yAxis')) && this.plotHandle) this.rebuildPlot();
    }

    /** The right-hand axis the caller stated, in `createPlot`'s own shape. */
    y2ScaleSpec() {
        const spec = this.y2;
        if (!spec || !Array.isArray(spec.range) || spec.range.length !== 2) return undefined;
        return { range: spec.range, format: spec.format };
    }

    yScaleSpec() {
        const fixed = this.#fixedRange();
        const base = fixed
            ? { range: fixed }
            : (this.yPolicy === 'temp' ? { range: computeTempRange([], [], [], []) } : super.yScaleSpec());
        const axis = this.yAxis;
        if (!axis) return base;
        return {
            ...base,
            ...(axis.format ? { format: axis.format } : null),
            ...(axis.splits ? { splits: axis.splits } : null),
            ...(axis.keepZero ? { keepZeroLabel: true } : null),
        };
    }

    yRangeFor(data) {
        const fixed = this.#fixedRange();
        if (fixed) return fixed;
        if (this.yPolicy === 'temp') return this.#tempBand(data);
        return super.yRangeFor(data);
    }

    #tempBand(data) {
        const column = (key) => {
            const i = this.channels.findIndex((channel) => channel.key === key);
            return i < 0 ? [] : (data[i + 1] ?? []);
        };
        const next = computeTempRange(
            column('targetTemp'), column('groupTemp'), column('mixTemp'), column('targetMixTemp'),
        );

        const samples = Array.isArray(data?.[0]) ? data[0].length : 0;
        if (samples < this.#tempBandSamples) this.#tempBandHeld = null;
        this.#tempBandSamples = samples;

        const band = widenBand(this.#tempBandHeld, next);
        this.#tempBandHeld = band;
        return band;
    }

    /** `yRange` if it is a usable pair, else null. One reading, two callers. */
    #fixedRange() {
        const fixed = this.yRange;
        if (Array.isArray(fixed) && fixed.length === 2
            && Number.isFinite(fixed[0]) && Number.isFinite(fixed[1])) return [fixed[0], fixed[1]];
        return null;
    }

    /**
     * Feed the card. Identical to setting `.derivation`, and named for the screens that
     * read better as a verb: `card.showDerivation(deriveFromBuffer(buffer))`.
     */
    showDerivation(derivation) {
        this.derivation = derivation ?? null;
    }

    #applyDerivation() {
        const derivation = this.derivation;
        const ok = Boolean(derivation && derivation.ok);
        this.empty = !ok;

        const specs = this.#specs();
        if (!sameSpecs(specs, this.channels)) this.setChannels(specs);

        this.#series = ok ? derivation.series : {};
        this.#xs = ok && derivation.axis ? (derivation.axis.t ?? []) : [];
        this.setRecords(this.#series);
        this.#applyRules(derivation, ok);
        this.#placeCursor();
    }

    setRuleSource(source) {
        this.#ruleSource = typeof source === 'function' ? source : null;
        this.#applyRules();
    }

    #applyRules(derivation = this.derivation, ok = Boolean(derivation && derivation.ok)) {
        if (this.#ruleSource) {
            this.setRules(this.#ruleSource(this.#tokens()) ?? {});
            return;
        }
        if (!ok || !derivation.stepMarks?.length) {
            this.setRules({});
            return;
        }
        const tokens = this.#tokens();
        const colour = tokens?.channels?.['step-boundary'];
        const ink = tokens?.surface?.label;
        const width = tokens?.geometry?.strokeMinor;
        const vertical = [];
        const labels = [];
        for (const mark of derivation.stepMarks) {
            if (!Number.isFinite(mark.t)) continue;
            vertical.push({ x: mark.t, color: colour, width });
            if (mark.name) labels.push({ x: mark.t, text: mark.name, color: ink });
        }
        this.setRules({ vertical, labels });
    }

    #specs() {
        const geometry = this.#tokens()?.geometry;
        const listed = this.channelKeys?.length ? this.channelKeys : DEFAULT_CHANNELS;
        return listed.map((entry) => {
            const named = typeof entry === 'string' ? { key: entry } : (entry ?? {});
            const channel = { ...CHANNEL_TREATMENTS.get(named.key), ...named };
            return {
                key: channel.key,
                label: channel.label ?? channelNameFor(channel.key),
                dash: channel.dash,
                width: channel.minor ? geometry?.strokeMinor : geometry?.strokeMajor,
                scale: channel.scale,
                factor: channel.factor,
            };
        });
    }

    /** The tokens this element can see right now — the built set, or a fresh read. */
    #tokens() {
        if (this.chartTokens) return this.chartTokens;
        try {
            return readChartTokens(this, { strict: false });
        } catch {
            return null;                  // no getComputedStyle: not connected yet
        }
    }

    refreshPalette() {
        if (!this.hasRenderedBox) { super.refreshPalette(); return; }
        const before = this.chartTokens?.geometry;
        super.refreshPalette();
        const after = this.chartTokens?.geometry;
        this.#applyRules();
        if (before && after
            && (before.strokeMajor !== after.strokeMajor || before.strokeMinor !== after.strokeMinor)) {
            const specs = this.#specs();
            if (!sameSpecs(specs, this.channels)) this.setChannels(specs);
        }
        this.#placeCursor();
    }

    #observeBoxes() {
        if (typeof ResizeObserver === 'undefined') return;
        if (!this.#resizeObserver) {
            this.#resizeObserver = new ResizeObserver(() => this.#resized());
        }
        this.#resizeObserver.observe(this);
        const host = this.plotHost;
        if (host) this.#resizeObserver.observe(host);
    }

    #resized() {
        if (this.paletteDeferred) this.refreshPalette();
        const handle = this.plotHandle;
        const host = this.plotHost;
        if (!handle || !host) return;
        handle.resize(host);
        this.#placeCursor();
        this.requestDraw();
    }

    /** The legend arriving or leaving changes the plot's row; say so out loud. */
    #onLegendSlot(event) {
        const filled = event.target.assignedNodes({ flatten: true })
            .some((node) => node.nodeType !== Node.TEXT_NODE || node.textContent.trim());
        this.toggleAttribute('has-legend', filled);
    }

    #bindPointer() {
        if (this.#pointerBound) return;
        const well = this.renderRoot?.querySelector('.well');
        if (!well) return;
        this.#pointerBound = true;
        well.addEventListener('pointermove', (event) => {
            if (this.activate) return;
            this.#readCursor(event);
        });
        well.addEventListener('pointerdown', (event) => {
            if (this.activate) return;
            this.#readCursor(event);
        });
        well.addEventListener('pointerleave', () => this.#clearCursor());
        well.addEventListener('pointercancel', () => this.#clearCursor());
        well.addEventListener('click', () => this.#activate('pointer'));
        well.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            this.#activate('keyboard');
        });
    }

    /** Report the gesture. Silent unless the consumer asked for it. */
    #activate(how) {
        if (!this.activate) return;
        this.dispatchEvent(new CustomEvent('plot-activate', {
            detail: { how },
            bubbles: true,
            composed: true,
        }));
    }

    #readCursor(event) {
        const plot = this.plotHandle;
        const over = plot?.raw?.over;
        if (!over) return;
        const points = Array.isArray(this.cursorPoints) ? this.cursorPoints : null;
        if (!points?.length && !this.#xs.length) return;
        const rect = over.getBoundingClientRect();
        if (!(rect.width > 0)) return;
        const scaleX = over.clientWidth / rect.width;
        const local = (event.clientX - rect.left) * scaleX;
        if (local < 0 || local > over.clientWidth) { this.#clearCursor(); return; }
        if (points?.length) {
            const scaleY = rect.height ? over.clientHeight / rect.height : 1;
            this.#readPoint(plot, points, local, (event.clientY - rect.top) * scaleY);
            return;
        }

        const t = plot.raw.posToVal(local, 'x');
        const idx = indexAtTime(this.#xs, t);
        if (idx < 0) { this.#clearCursor(); return; }

        const values = {};
        for (const channel of this.channels) {
            const series = this.#series?.[channel.key];
            values[channel.key] = series && idx < series.y.length ? series.y[idx] : null;
        }
        const previous = this.#cursor;
        this.#cursor = Object.freeze({
            active: true,
            idx,
            t: this.#xs[idx],
            values: Object.freeze(values),
        });
        this.#placeCursor();
        if (!previous.active || previous.idx !== idx) this.#emitCursor();
    }

    #readPoint(plot, points, x, y) {
        let best = -1;
        let bestDistance = Infinity;
        for (let i = 0; i < points.length; i += 1) {
            const point = points[i];
            if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) continue;
            const px = plot.raw.valToPos(point.x, 'x');
            const py = plot.raw.valToPos(point.y, 'y');
            if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
            const distance = (px - x) ** 2 + (py - y) ** 2;
            if (distance < bestDistance) { bestDistance = distance; best = i; }
        }
        if (best < 0) { this.#clearCursor(); return; }
        const point = points[best];
        const previous = this.#cursor;
        this.#cursor = Object.freeze({
            active: true,
            idx: best,
            t: point.t ?? null,
            values: Object.freeze({}),
            point: Object.freeze({ x: point.x, y: point.y, t: point.t ?? null }),
        });
        this.#placeCursor();
        if (!previous.active || previous.idx !== best) this.#emitCursor();
    }

    #clearCursor() {
        const had = this.#cursor.active;
        this.#cursor = NO_CURSOR;
        this.#placeCursor();
        if (had) this.#emitCursor();
    }

    #placeCursor() {
        const line = this.renderRoot?.querySelector('.cursor');
        if (!line) return;
        const plot = this.plotHandle;
        const over = plot?.raw?.over;
        const well = this.renderRoot.querySelector('.well');
        if (!over || !well || !this.#cursor.active) {
            line.hidden = true;
            delete line.dataset.shape;
            return;
        }
        const overRect = over.getBoundingClientRect();
        const wellRect = well.getBoundingClientRect();
        const point = this.#cursor.point ?? null;
        const pos = plot.raw.valToPos(point ? point.x : this.#cursor.t, 'x');
        if (!Number.isFinite(pos) || !(overRect.width > 0)) { line.hidden = true; return; }
        /* Layout px per painted px — 1 unless an ancestor is scaled, and measured rather
         * than read off the fit, so a transformed ancestor or a browser zoom counts too. */
        const toLayout = over.clientWidth / overRect.width;
        line.hidden = false;
        line.style.setProperty('--_ui-chart-cursor-x',
            `${(overRect.left - wellRect.left) * toLayout + pos}px`);
        if (point) {
            const yPos = plot.raw.valToPos(point.y, 'y');
            if (!Number.isFinite(yPos)) { line.hidden = true; return; }
            line.dataset.shape = 'point';
            line.style.setProperty('--_ui-chart-cursor-top',
                `calc(${(overRect.top - wellRect.top) * toLayout + yPos}px `
                + '- var(--_ui-chart-cursor-dot) / 2)');
            line.style.removeProperty('--_ui-chart-cursor-h');
            return;
        }
        delete line.dataset.shape;
        line.style.setProperty('--_ui-chart-cursor-top',
            `${(overRect.top - wellRect.top) * toLayout}px`);
        line.style.setProperty('--_ui-chart-cursor-h', `${over.clientHeight}px`);
    }

    /** For #10, the legend readout — the same numbers the chart drew, at the same index. */
    #emitCursor() {
        this.dispatchEvent(new CustomEvent('cursor-change', {
            bubbles: true,
            composed: true,
            detail: this.#cursor,
        }));
    }
}

/** Same keys, same widths, same dashes, same order — or the plot has to be rebuilt. */
function sameSpecs(next, current) {
    if (next.length !== current.length) return false;
    for (let i = 0; i < next.length; i += 1) {
        const a = next[i];
        const b = current[i];
        if (a.key !== b.key || a.width !== b.width || a.dash !== b.dash
            || a.label !== b.label || a.scale !== b.scale) {
            return false;
        }
    }
    return true;
}

/** Re-exported so a consumer naming channels does not import two modules. */
export { SERIES_KEYS };

customElements.define('ui-chart-card', UiChartCard);
