/**
 * The uPlot mount pattern, as a base class.
 */

import { css, html } from 'lit';

import {
    UPLOT_STYLESHEET_URL,
    UiElement,
    adoptStyleSheet,
    hasAdoptedSheet,
    loadStyleSheet,
} from './base.js';
import { createPlot } from './uplot-plot.js';
import { alignChannels } from '../lib/chart-align.js';
import { Y_FLOOR_LIVE, computeDampedYMax } from '../lib/chart-autoscale.js';
import { createSingleFlightFrameScheduler } from '../lib/chart-render-scheduler.js';
import { effectivePixelRatio } from '../lib/app-fit.js';
import {
    axisFont,
    channelToken,
    primaryFamily,
    readChartTokens,
    resolveChannels,
} from '../lib/chart-tokens.js';
import { logger } from '../lib/logger.js';

/** Provenance for the one thing this file reports: a mount that did not finish. */
const log = logger.scope('chart');

const BOGUS_FAMILY = '"Decal No Such Face"';

/** The probe's sample and size. 20px is the size the wave-0a spike measured at. */
const FONT_PROBE_SAMPLE = '0123456789.';
const FONT_PROBE_PX = 20;

/** The document attributes a theme change lands on. */
const THEME_ATTRIBUTES = Object.freeze(['data-theme', 'class', 'style']);

export class PlotSurfaceElement extends UiElement {
    static properties = {
        /** Resting top of the y axis; the damped ceiling never goes below it. */
        yFloor: { type: Number, attribute: 'y-floor' },
        /** Fixed right-hand end of the x axis, or `null` to follow the data. */
        xMax: { type: Number, attribute: 'x-max' },
        xMin: { type: Number, attribute: 'x-min' },
    };

    static styles = [css`
        :host {
            display: block;
            position: relative;
            min-block-size: var(--ui-chart-min-h);
        }

        .plot {
            padding: 0;
            inline-size: 100%;
            block-size: 100%;
            min-block-size: var(--ui-chart-min-h);
        }
    `];

    #plot = null;
    #tokens = null;
    #sheet = null;
    #channels = [];
    #records = {};
    #rules = null;
    #bands = null;
    #marks = null;
    #endLabels = null;
    #yMax = null;
    #xRange = null;
    #pixelRatio = null;
    #themeObserver = null;
    #scheduler = null;
    #ready = null;
    #readyGate = null;
    #mounting = false;
    #mountError = null;
    #buildCount = 0;
    #paintCount = 0;
    #paletteDeferred = false;

    constructor() {
        super();
        this.yFloor = Y_FLOOR_LIVE;
        this.xMax = null;
        this.xMin = null;
        this.#scheduler = createSingleFlightFrameScheduler(() => this.#draw());
    }

    get ready() { return this.#gate().promise; }

    get mountError() { return this.#mountError; }

    /** The `createPlot` handle, or `null` before the first build. */
    get plotHandle() { return this.#plot; }

    /** The tokens the current plot was built from. Frozen. */
    get chartTokens() { return this.#tokens; }

    get sheetAdopted() { return Boolean(this.#sheet) && hasAdoptedSheet(this.renderRoot, this.#sheet); }

    /** How many times the plot has been constructed. A retheme increments it. */
    get buildCount() { return this.#buildCount; }

    get paintCount() { return this.#paintCount; }

    get pixelRatio() { return this.#pixelRatio ?? effectivePixelRatio(globalThis); }

    set pixelRatio(value) {
        const next = Number(value);
        if (!(next > 0) || next === this.#pixelRatio) return;
        this.#pixelRatio = next;
        if (this.#plot) this.rebuildPlot();
    }

    render() {
        return html`<div class="plot" part="plot"></div>`;
    }

    get plotHost() { return this.renderRoot?.querySelector('.plot') ?? null; }

    firstUpdated(changed) {
        super.firstUpdated?.(changed);
        this.#beginMount();
    }

    connectedCallback() {
        super.connectedCallback();
        this.#watchTheme();
        if (this.hasUpdated && !this.#plot) this.#beginMount();
    }

    disconnectedCallback() {
        this.#scheduler.cancelPending();
        this.#themeObserver?.disconnect();
        this.#themeObserver = null;
        this.#destroyPlot();
        super.disconnectedCallback();
    }

    /** The one promise `ready` hands out, created on demand and settled by #beginMount. */
    #gate() {
        if (!this.#readyGate) {
            let resolve;
            const promise = new Promise((r) => { resolve = r; });
            this.#readyGate = { promise, resolve, settled: false };
        }
        return this.#readyGate;
    }

    #beginMount() {
        if (this.#mounting) return this.#ready;
        if (this.#readyGate?.settled) this.#readyGate = null;
        const gate = this.#gate();
        this.#mounting = true;
        this.#ready = this.#mount().then((ok) => {
            this.#mounting = false;
            gate.settled = true;
            gate.resolve(ok);
            return ok;
        });
        return this.#ready;
    }

    async #mount() {
        this.#mountError = null;
        try {
            const adopted = await this.adoptPlotStyleSheet();
            if (!adopted && !this.plotStyleSheetOptional) {
                throw new Error(
                    'plot-surface: uPlot.min.css did not reach this shadow root, so the plot '
                    + 'was not built. An unsheeted chart paints a '
                    + 'pixel-identical canvas that lays out at its attribute size — 450px past '
                    + 'its card at the bench dpr — so it cannot be allowed to mount silently. '
                    + 'A subclass that means to run without the sheet declares '
                    + 'plotStyleSheetOptional; everything else must fix the adoption.',
                );
            }
            await this.fontsReady();
            if (!this.isConnected) return false;
            this.#tokens = readChartTokens(this);
            this.#buildPlot({ allowMissingStyles: !adopted });
            this.#watchTheme();
            this.requestDraw();
            return true;
        } catch (error) {
            this.#mountError = error;
            log.error('plot-surface: mount failed', error);
            return false;
        }
    }

    async adoptPlotStyleSheet() {
        if (this.sheetAdopted) return true;
        this.#sheet = await loadStyleSheet(UPLOT_STYLESHEET_URL);
        adoptStyleSheet(this.renderRoot, this.#sheet, { position: 'before' });
        return this.sheetAdopted;
    }

    get plotStyleSheetOptional() { return false; }

    async fontsReady() {
        const fonts = globalThis.document?.fonts;
        if (!fonts) return true;
        const tokens = this.#tokens ?? readChartTokens(this, { strict: false });
        const family = tokens?.fontFamily;
        if (family && typeof fonts.load === 'function') {
            const primary = primaryFamily(family);
            for (const sizePx of this.fontLoadSizes(tokens)) {
                try {
                    await fonts.load(axisFont(sizePx, primary));
                } catch (error) {
                    log.warn('plot-surface: the axis family could not be loaded', family, error);
                }
            }
        }
        if (fonts.ready) await fonts.ready;
        return true;
    }

    fontLoadSizes(tokens = this.#tokens) {
        const sizes = new Set([FONT_PROBE_PX]);
        const geometry = tokens?.geometry;
        if (geometry?.tickFontPx > 0) sizes.add(geometry.tickFontPx);
        if (geometry?.legendFontPx > 0) sizes.add(geometry.legendFontPx);
        return [...sizes];
    }

    axisFontProbe(sample = FONT_PROBE_SAMPLE, sizePx = FONT_PROBE_PX) {
        const family = this.#tokens?.fontFamily ?? readChartTokens(this).fontFamily;
        const primary = primaryFamily(family);
        const canvas = globalThis.document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const measure = (font) => { ctx.font = font; return ctx.measureText(sample).width; };
        const font = axisFont(sizePx, primary);
        const chainFont = axisFont(sizePx, family);
        const width = measure(font);
        const chainWidth = measure(chainFont);
        const fallbackWidth = measure(axisFont(sizePx, BOGUS_FAMILY));
        const fonts = globalThis.document.fonts;
        return {
            family,
            primary,
            font,
            chainFont,
            width,
            chainWidth,
            fallbackWidth,
            registered: width !== fallbackWidth,
            /** Is the family in the token the family uPlot will actually paint with? */
            painted: width === chainWidth,
            check: Boolean(fonts?.check?.(chainFont)),
            checkPrimary: Boolean(fonts?.check?.(font)),
            status: fonts?.status ?? null,
            faceCount: fonts?.size ?? 0,
        };
    }

    #watchTheme() {
        if (this.#themeObserver || typeof MutationObserver === 'undefined') return;
        const root = globalThis.document?.documentElement;
        if (!root) return;
        this.#themeObserver = new MutationObserver(() => this.refreshPalette());
        this.#themeObserver.observe(root, { attributes: true, attributeFilter: [...THEME_ATTRIBUTES] });
    }

    get hasRenderedBox() {
        if (!this.isConnected) return false;
        if (typeof this.checkVisibility === 'function') return this.checkVisibility();
        return Boolean(this.offsetParent);
    }

    get paletteDeferred() { return this.#paletteDeferred; }

    refreshPalette() {
        if (!this.isConnected || !this.hasUpdated) return;
        if (!this.hasRenderedBox) { this.#paletteDeferred = true; return; }
        this.#paletteDeferred = false;
        const next = readChartTokens(this, { strict: false });
        if (this.#tokens && !tokensDiffer(this.#tokens, next)) return;
        this.#tokens = next;
        this.rebuildPlot();
    }

    rebuildPlot() {
        if (!this.#tokens || !this.plotHost) return;
        const waived = !this.sheetAdopted && this.plotStyleSheetOptional;
        this.#destroyPlot();
        this.#buildPlot({ allowMissingStyles: waived });
        this.requestDraw();
    }

    setChannels(channels) {
        this.#channels = [...channels];
        if (this.#tokens) this.rebuildPlot();
    }

    get channels() { return [...this.#channels]; }

    /** `{ [key]: { x: number[], y: (number|null)[] } }`. Append-safe: nothing is copied. */
    setRecords(records) {
        this.#records = records ?? {};
        this.requestDraw();
    }

    /** Vertical rules, horizontal limits and step labels — drawn into the canvas. */
    setRules(rules) {
        this.#rules = rules ?? null;
        this.#plot?.setRules(rules ?? {});
        this.requestDraw();
    }

    setBands(bands) {
        this.#bands = bands ?? null;
        this.#plot?.setBands(bands ?? []);
        this.requestDraw();
    }

    /**
     * POINT MARKS — `[{ x, y, kind, color, size, text, scale }]`, through to `marksPlugin`.
     * Held across a rebuild, exactly as the bands and the rules are.
     */
    setMarks(marks) {
        this.#marks = marks ?? null;
        this.#plot?.setMarks(marks ?? []);
        this.requestDraw();
    }

    setEndLabels(labels) {
        this.#endLabels = this.#paintEndLabels(labels);
        this.#plot?.setEndLabels(this.#endLabels ?? []);
    }

    #paintEndLabels(labels) {
        if (!Array.isArray(labels) || !labels.length) return null;
        const palette = this.#tokens?.channels ?? null;
        return labels.map((label) => {
            if (!label || !label.key || !palette) return label;
            const { resolved } = resolveChannels([label.key], palette, { strict: false });
            const colour = resolved?.[0]?.[1];
            return colour ? { ...label, color: colour } : label;
        });
    }

    requestDraw() { this.#scheduler.request(); }

    /** Draw synchronously, bypassing the frame coalescer. Tests and teardown only. */
    drawNow() {
        this.#draw();
        this.#plot?.flush();
    }

    get schedulerState() { return this.#scheduler.state(); }

    #buildPlot({ allowMissingStyles = false } = {}) {
        const host = this.plotHost;
        if (!host || !this.#tokens) return;
        if (!this.#channels.length) return;
        const { channels, surface, geometry, fontFamily } = this.#tokens;

        const { resolved } = resolveChannels(
            this.#channels.map((channel) => channel.token ?? channel.key),
            channels,
        );

        const series = this.#channels.map((channel, i) => ({
            label: channel.label ?? channel.key,
            color: resolved[i][1],
            width: channel.width ?? (channel.minor ? geometry.strokeMinor : geometry.strokeMajor),
            dash: channel.dash,
            alpha: channel.alpha,
            scale: channel.scale ?? 'y',
            show: channel.show,
        }));

        this.#plot = createPlot(host, {
            series,
            yScale: this.yScaleSpec(),
            y2Scale: this.y2ScaleSpec(),
            colors: {
                grid: surface.grid,
                axis: surface.axis,
                label: surface.label,
                font: surface.label,
                plate: surface.well,
            },
            padding: {
                top: geometry.gutterTop,
                right: geometry.gutterRight,
                bottom: geometry.gutterBottom,
                left: geometry.gutterLeft,
            },
            fontFamily,
            tickFontPx: geometry.tickFontPx,
            labelFontPx: geometry.stepLabelPx ?? geometry.tickFontPx,
            endLabelFontPx: geometry.legendFontPx,
            strokeMinor: geometry.strokeMinor,
            minTickGapPx: geometry.minTickGapPx,
            pixelRatio: this.pixelRatio,
            cursor: this.cursorSpec(),
            allowMissingStyles,
        });
        this.#buildCount += 1;
        if (this.#rules) this.#plot.setRules(this.#rules);
        if (this.#bands) this.#plot.setBands(this.#bands);
        if (this.#marks) this.#plot.setMarks(this.#marks);
        if (this.#endLabels) this.#plot.setEndLabels(this.#endLabels);
    }

    yScaleSpec() { return { auto: false, range: () => [0, this.#yMax ?? this.yFloor] }; }

    yRangeFor(data) {
        this.#yMax = computeDampedYMax(this.leftScaleData(data), this.#yMax, { floor: this.yFloor });
        return [0, this.#yMax];
    }

    #applyFactors(data) {
        this.#channels.forEach((channel, i) => {
            const factor = channel.factor;
            if (typeof factor !== 'number' || !Number.isFinite(factor) || factor === 1) return;
            const ys = data[i + 1];
            if (!Array.isArray(ys)) return;
            data[i + 1] = ys.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v * factor : v));
        });
    }

    leftScaleData(data) {
        const left = [];
        this.#channels.forEach((channel, i) => {
            if ((channel.scale ?? 'y') === 'y') left.push(data[i + 1]);
        });
        return left;
    }

    /** No right-hand axis by default. */
    y2ScaleSpec() { return undefined; }

    y2RangeFor(_data) { return null; }

    cursorSpec() { return { show: false }; }

    #destroyPlot() {
        this.#plot?.destroy();
        this.#plot = null;
    }

    #draw() {
        const plot = this.#plot;
        if (!plot) return;
        const keys = this.#channels.map((c) => c.key);
        const data = alignChannels(this.#records, keys);
        this.#applyFactors(data);

        const yRange = this.yRangeFor(data);
        const y2Range = this.y2RangeFor(data);

        const xs = data[0] ?? [];
        const last = xs.length ? xs[xs.length - 1] : 0;
        const max = this.xMax ?? Math.max(last, 1);
        const stated = Number.isFinite(this.xMin) ? this.xMin : 0;
        const min = stated < max ? stated : 0;
        this.#xRange = [min, max];

        plot.setData(data, this.#xRange);
        if (yRange) plot.setScale('y', yRange);
        if (y2Range) plot.setScale('y2', y2Range);
        this.#paintCount += 1;
    }

    /** The x range currently on screen — carried across a rebuild (salvage 3). */
    get xRange() { return this.#xRange ? [...this.#xRange] : null; }

    /** The damped y ceiling currently on screen — carried across a rebuild. */
    get yMax() { return this.#yMax; }
}

/** Did any token this plot was built from move? Colours and geometry both count. */
function tokensDiffer(a, b) {
    if (a.fontFamily !== b.fontFamily) return true;
    for (const [key, value] of Object.entries(a.channels)) if (b.channels[key] !== value) return true;
    for (const [key, value] of Object.entries(a.surface)) if (b.surface[key] !== value) return true;
    for (const [key, value] of Object.entries(a.geometry)) if (b.geometry[key] !== value) return true;
    return false;
}

/** `pressure` -> `--ui-channel-pressure`, re-exported so a chart needs one import. */
export { channelToken };
