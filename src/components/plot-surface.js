/**
 * plot-surface.js — the uPlot mount pattern, as a base class. Gate 5.
 *
 * WHAT THIS IS. Everything a chart in this app needs in order to hold a live uPlot
 * instance inside a shadow root correctly, and nothing that belongs to any particular
 * chart. The chart card (#9) extends it and adds the parts the row gives it — the
 * `ResizeObserver` on its own host, `dppxchange`, touch, the well and its fallback
 * (bug O3), and the legend as part of the layout (bug chart-C10). It ships no tag of
 * its own: the `ui-` namespace belongs to the components, and this is a base class in
 * the same sense as `UiElement`.
 *
 * THE FIVE THINGS IT OWNS
 *
 * 1. RULE 1 — the vendor stylesheet, adopted into THIS shadow root before the first
 *    `new uPlot(...)`, never a document <link>. The spike measured the cost of
 *    forgetting at both device pixel ratios: the canvas is pixel-identical to the
 *    control (0 of 648,000 pixels differ at dsf 1.5), so no screenshot gate can see
 *    it, while `.uplot canvas` lays out at its ATTRIBUTE size — round(css x pxRatio) —
 *    and overflows its card by 450 px to the right at the bench tablet's dpr 1.5, with
 *    `.u-cursor-x` computing to `position: static; height: 0` and the legend collapsing
 *    900x31 -> 80x106. NOTHING HERE PAINTS UNTIL `hasAdoptedSheet()` IS TRUE, and that is
 *    now what the code does: a mount whose sheet does not land FAILS — no plot, no
 *    canvas, `mountError` set and `ready` false — rather than building an unsheeted chart
 *    whose only tell is the `sheetAdopted` property. `createPlot` re-checks independently.
 *    `adoptPlotStyleSheet()` is the ONE seam a subclass may override, and a subclass that
 *    means to run without the sheet must ALSO declare `plotStyleSheetOptional` — the Rule
 *    1 canary does both, which is what keeps the waiver a deliberate act rather than the
 *    default consequence of a failed fetch.
 *
 * 2. RULE 2 — no `@font-face` here or in any component (Gate C bans it by build guard).
 *    uPlot paints axis labels with `ctx.font` and canvas resolves fonts against the
 *    DOCUMENT's registry, so a face declared in a shadow root silently renders as the
 *    unknown-family fallback with different metrics (measured: 105.00 vs 118.50 for
 *    `measureText('0123456789.')` at 20px). The family arrives as the `--ui-font-family`
 *    token (C9) and the face is declared once, in `styles/document.css`. First paint is
 *    gated on an EXPLICIT `document.fonts.load()` of the primary family and then
 *    `document.fonts.ready` (§6.3) — awaiting `ready` alone is not a gate, because CSS
 *    font loading is lazy and a face nobody has rendered with is never requested:
 *    measured with `ready` awaited and nothing else, the axis labels painted in
 *    `system-ui` at 119.76 px while the token asked for Geist. `axisFontProbe()` is the
 *    runtime assertion, and it measures the PRIMARY family alone — a fallback chain
 *    always resolves to something, so measuring the chain reports "registered" even for
 *    a family that does not exist.
 *
 * 3. A6 — CSS is the single source for chart colour. The eighteen channel tokens and the
 *    four surface tokens are read from the computed style of this host at mount and on
 *    every theme change, and NOTHING is published back as an inline style. That is the
 *    whole of what `chart-palette.js:124-156` used to do in reverse.
 *
 * 4. THE RENDER SCHEDULER — `createSingleFlightFrameScheduler` from wave 0a coalesces
 *    the ~10 Hz socket feed onto one paint per frame with at most one draw in flight,
 *    so a slower tablet cannot build an ever-growing draw queue (Part 3 §2: 15 Hz is
 *    the render budget, not the socket rate). Measured headroom at the bench dpr: p95
 *    1.4 ms against a 66 ms frame.
 *
 * 5. THE THREE `chart-uplot.js` SALVAGES, wired: gap bridging with its two meanings of
 *    null (`src/lib/chart-align.js`), the damped live y ceiling — grow instantly, ease
 *    down (`src/lib/chart-autoscale.js`) — and RANGE PERSISTENCE ACROSS REBUILD. The
 *    third is why a theme change does not reset the plot: uPlot bakes its axis and grid
 *    colours in at construction, so a retheme is a rebuild rather than a restyle, and a
 *    rebuild must not lose the range, the ceiling, the rules or the data, which belong
 *    to the shot rather than to the theme.
 *
 * WHAT IT DELIBERATELY DOES NOT OWN: `ResizeObserver` (the host's size is #9's, per its
 * row), `dppxchange`, touch, the legend, the well, and any endpoint. Data arrives
 * through the stores; no component here calls ReaPrime.
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

/**
 * A family nothing can resolve, for the Rule 2 probe. If the real family measures the
 * same as this, the face did not register — which is exactly what a `@font-face`
 * declared inside a shadow root does, silently.
 */
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
        /**
         * Fixed left-hand end of the x axis, or `null` for zero.
         *
         * ZERO IS RIGHT FOR ONE SHOT AND WRONG FOR TWO. A shot has no samples before its
         * own origin, so a live plot opening at 0 is exact. A COMPARISON is not one shot:
         * History slides the second shot along the time axis by up to the ported +/-5 s
         * limit, and at the negative end B runs before zero — so a hard `[0, max]` clips
         * the trace's head off the plot while the slider reports the offset it applied.
         * The control moves, part of the drawing vanishes, and nothing raises, which is
         * the same silence the alignment slider's swallowed throw produced.
         *
         * Null by default, so every existing chart keeps the axis it has; `history-
         * flow-page.js` states it from `comparisonWindow`, which reads the DRAWN data.
         */
        xMin: { type: Number, attribute: 'x-min' },
    };

    /**
     * The plot host and nothing else. NO PADDING on it, ever: uPlot sizes from
     * `clientWidth`/`clientHeight`, which is the padding box, so a padded host
     * overflows by exactly its padding (§6.1 rule 1, measured at 32 px in Slate).
     * The well is painted by whatever card frames this (#9, bug O3) — a plot surface
     * with its own ground would be a second declaration of `--ui-chart-well`.
     */
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

    /* ---- what a subclass and a test read ---------------------------------- */

    /**
     * The mount, as a promise. Resolves TRUE when the sheet is adopted (or a subclass
     * deliberately declined it), the fonts are ready, and the plot has been built from
     * whatever channels were set. FALSE means the mount did not finish: either the
     * element left the document while it was running, or it failed — and then
     * `mountError` carries the reason. It NEVER REJECTS; see #mount.
     *
     * ASKING EARLY IS SAFE, and that is the point of the gate. This used to be
     * `#ready ?? Promise.resolve(false)`, so `stage.appendChild(el); await el.ready`
     * — the ordinary shape, and the one "await ready then draw" is written as —
     * resolved IMMEDIATELY with a value that meant nothing: MEASURED at readyValue
     * false, buildCount 0, sheetAdopted false, one tick before the same element reached
     * sheetAdopted true. A resolved `false` there is indistinguishable from a real Rule
     * 1 failure, and Rule 1's failure is invisible by construction (the canvas is
     * pixel-identical), so the early resolve is exactly how a silently broken chart
     * ships. A caller now gets the promise the mount will settle, whenever it asks.
     */
    get ready() { return this.#gate().promise; }

    /**
     * What the last mount failed with, or null. `ready` resolves false alongside it.
     *
     * A mount cannot throw at its caller — it runs from `firstUpdated` and there is no
     * caller — so the error is HELD here rather than left as an unhandled rejection on
     * a promise nobody has attached to yet.
     */
    get mountError() { return this.#mountError; }

    /** The `createPlot` handle, or `null` before the first build. */
    get plotHandle() { return this.#plot; }

    /** The tokens the current plot was built from (A6). Frozen. */
    get chartTokens() { return this.#tokens; }

    /**
     * Rule 1, as a boolean — what `test/render/plot-surface.render.test.mjs` asserts on,
     * and what the Rule 1 canary in the same suite asserts the FALSE of. It has to be a
     * property rather than a rendering check because Rule 1's failure is invisible to a
     * screenshot: the canvas is pixel-identical with and without the sheet.
     */
    get sheetAdopted() { return Boolean(this.#sheet) && hasAdoptedSheet(this.renderRoot, this.#sheet); }

    /** How many times the plot has been constructed. A retheme increments it. */
    get buildCount() { return this.#buildCount; }

    /**
     * How many times the plot has actually PAINTED — the scheduler's own count, not the
     * number of times it was asked.
     *
     * The two differ by design and the difference is the whole point of the single-flight
     * coalescer: the socket feed arrives at ~10 Hz in bursts, the render budget is 15 Hz
     * (Part 3 §2), and N `setRecords` calls inside one turn must cost ONE paint. Without
     * a count there is no way to assert that from outside — `requestDraw` returns nothing
     * and a canvas that painted twice looks exactly like a canvas that painted once.
     */
    get paintCount() { return this.#paintCount; }

    /**
     * ONE pixel ratio, owned here (bug chart-C12). Fifteen call sites in the old tree
     * multiplied by the global while uPlot used its own cached value refreshed on
     * `dppxchange`, and the two can diverge for a frame. This is the only place the
     * global is read, and #9 sets it from its `dppxchange` handler.
     *
     * THE FALLBACK IS THE FULL FACTOR, NOT `devicePixelRatio`. The app is drawn scaled
     * (src/lib/app-fit.js), so a crisp canvas needs `devicePixelRatio * scale` device
     * pixels per design unit. A surface used bare — a test, a gallery page — would
     * otherwise fall back to a number that is wrong by the scale on every screen except
     * the 1920x1200 gate, where the scale is exactly 1.
     */
    get pixelRatio() { return this.#pixelRatio ?? effectivePixelRatio(globalThis); }

    set pixelRatio(value) {
        const next = Number(value);
        if (!(next > 0) || next === this.#pixelRatio) return;
        this.#pixelRatio = next;
        if (this.#plot) this.rebuildPlot();
    }

    /* ---- the plot host ----------------------------------------------------- */

    render() {
        return html`<div class="plot" part="plot"></div>`;
    }

    get plotHost() { return this.renderRoot?.querySelector('.plot') ?? null; }

    /* ---- lifecycle --------------------------------------------------------- */

    firstUpdated(changed) {
        super.firstUpdated?.(changed);
        this.#beginMount();
    }

    connectedCallback() {
        super.connectedCallback();
        this.#watchTheme();
        if (this.hasUpdated && !this.#plot) this.#beginMount();
    }

    /** Every observer disconnected and every uPlot destroyed (CONVENTIONS §12). */
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

    /**
     * Start a mount and route its answer to the gate. Idempotent while one is in
     * flight, so a reconnect during the fetch cannot build two plots into one host.
     * A remount after a completed one gets a FRESH gate — a caller holding the old
     * promise already has its answer.
     */
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

    /**
     * NEVER THROWS, and that is a contract rather than caution.
     *
     * Nothing awaits this: `firstUpdated` starts it and the promise lands in `#ready`,
     * so a throw here became an UNHANDLED REJECTION — MEASURED, as a page error, for
     * the most ordinary order there is (append the element, set the channels when the
     * shot opens). The element was left mounted with no plot, no adopted sheet and
     * nothing a consumer could read to find out. The failure is now held in
     * `mountError`, reported to the logger, and `ready` resolves false.
     */
    async #mount() {
        this.#mountError = null;
        try {
            const adopted = await this.adoptPlotStyleSheet();
            /* RULE 1 IS MANDATORY, and a failed adoption is a FAILED MOUNT. This used to
             * fall through to `allowMissingStyles: !adopted`, which handed the one flag
             * reserved for the canary to every production path whose fetch or adoption
             * went wrong — `uplot-plot.js` says "No production path may set it" and this
             * was the path that did. The result mounted, reported `ready === true`, and
             * differed from a healthy chart only in `sheetAdopted`, while Rule 1's own
             * failure is invisible by construction (the canvas is pixel-identical). The
             * waiver is now a DECLARATION a subclass makes, not a consequence. */
            if (!adopted && !this.plotStyleSheetOptional) {
                throw new Error(
                    'plot-surface: uPlot.min.css did not reach this shadow root, so the plot '
                    + 'was not built (Part 8 §3 Rule 1). An unsheeted chart paints a '
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

    /**
     * RULE 1's one seam. Fetches `vendor/uPlot.min.css` once per page (the cache in
     * `base.js` makes N charts share one `CSSStyleSheet`) and merges it into this root
     * BEFORE Lit's own sheet, so a component rule wins a tie — which is the direction
     * theming a chart runs in.
     *
     * RETURNING `false` IS NOT ENOUGH TO GET AN UNSHEETED PLOT, and that is the point. A
     * false return from here — a failed fetch, an adoption that did not land, a subclass
     * that overrode this by accident — FAILS THE MOUNT. Only a subclass that ALSO declares
     * `plotStyleSheetOptional` runs without the sheet, and the only one that does is the
     * canary proving the mount-C signature still discriminates. Rule 1's failure is
     * invisible by construction, so it cannot be allowed to arrive as a side effect.
     */
    async adoptPlotStyleSheet() {
        if (this.sheetAdopted) return true;
        this.#sheet = await loadStyleSheet(UPLOT_STYLESHEET_URL);
        adoptStyleSheet(this.renderRoot, this.#sheet, { position: 'before' });
        return this.sheetAdopted;
    }

    /**
     * May this surface run WITHOUT the vendor sheet? NO — and there is exactly one
     * exception, which has to say so out loud.
     *
     * `allowMissingStyles` "exists for ONE caller" (`uplot-plot.js`) and the mount used
     * to hand it to any caller whose adoption merely failed, so the guard was switched
     * off by the very condition it exists to detect. Declaring this `true` is the only
     * way to get the waiver now, and the only subclass that does is the Rule 1 canary —
     * whose whole job is to prove the mount-C signature still discriminates (Gate C: every
     * guard ships with a canary that fires).
     *
     * It does NOT relax anything else. The channel palette reaches this host through
     * `styles/chart-channels.css`, a DOCUMENT sheet with nothing to do with
     * `vendor/uPlot.min.css`, so `resolveChannels` stays strict either way.
     */
    get plotStyleSheetOptional() { return false; }

    /**
     * RULE 2's gate — and awaiting `document.fonts.ready` is NOT ENOUGH, which is the
     * defect this method exists to close.
     *
     * CSS font loading is LAZY: a face nobody has rendered with is never requested, and
     * `fonts.ready` resolves as soon as nothing is pending — including when nothing was
     * ever started. Canvas makes that worse, because `ctx.font` does not trigger a load
     * either; an unloaded family silently falls through to the next entry in the chain
     * and paints. MEASURED here, at both Gate A geometries, with `ready` awaited and
     * nothing else: the Geist face sat at status `loading`, `20px "Geist"` measured
     * 105.00 px for `0123456789.` — the width of a family that does not exist at all —
     * and the axis labels were painted in `system-ui` at 119.76 px. The chart asked for
     * one family and drew in another, with no error anywhere.
     *
     * So the face is LOADED EXPLICITLY, at the sizes this chart paints with, before the
     * first build. After it: 118.50 px for both `20px "Geist"` and the full chain,
     * `document.fonts.check()` true, face status `loaded` — the numbers the wave-0a
     * spike recorded for a registered face. §6.3's reason stands unchanged (the moment a
     * gutter derives from measured text, an unloaded face is a layout bug); this is what
     * actually satisfies it.
     *
     * A family the platform cannot load is not fatal here — `axisFontProbe()` is what
     * reports it, and a chart that draws in the fallback is better than one that does not
     * mount.
     */
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

    /**
     * The sizes to load the axis family at: the tick size, the legend size and the
     * probe's own. One face covers every size today, so this is belt-and-braces against
     * a fork whose family selects a different face per size — cheap, and the failure it
     * prevents is invisible.
     */
    fontLoadSizes(tokens = this.#tokens) {
        const sizes = new Set([FONT_PROBE_PX]);
        const geometry = tokens?.geometry;
        if (geometry?.tickFontPx > 0) sizes.add(geometry.tickFontPx);
        if (geometry?.legendFontPx > 0) sizes.add(geometry.legendFontPx);
        return [...sizes];
    }

    /**
     * The honest Rule 2 assertion, measured rather than asked — and measured on ONE
     * FAMILY, which is the correction.
     *
     * The probe used to measure the whole `--ui-font-family` CHAIN against a bogus
     * family and call the difference "registered". A chain always resolves to something,
     * so that number was a FALSE POSITIVE: measured here, `"Geist", system-ui, sans-serif`
     * and `"Decal No Such Face", system-ui, sans-serif` are both 119.76 px for
     * `0123456789.` at 20px, because both land on `system-ui`. The old probe would have
     * reported `registered: true` with the face permanently absent — Gate C's named
     * failure mode, a guard that has silently stopped covering its target.
     *
     * `width` is now the PRIMARY family alone, where the numbers separate cleanly:
     * 118.50 px loaded, 105.00 px not — and 105.00 px is exactly `fallbackWidth`, what an
     * unresolvable family measures. `chainWidth` is kept beside it because the difference
     * between the two IS the interesting failure: `width !== chainWidth` means uPlot is
     * painting in a fallback while the token says otherwise (`painted: false`).
     *
     * `check` is `document.fonts.check()` on the chain — #9's row names it, and with the
     * load gate in `fontsReady()` it is now true on a healthy mount and false on an
     * unloaded one, so it is an assertion rather than the vacuous pass it was.
     */
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

    /* ---- A6: the palette, and the rebuild a theme change forces ------------ */

    #watchTheme() {
        if (this.#themeObserver || typeof MutationObserver === 'undefined') return;
        const root = globalThis.document?.documentElement;
        if (!root) return;
        // `data-theme` is the theme stamp. `style` and `class` are watched with it
        // because a runtime retheme — and the token drill that proves A6 in the
        // rendering suite — lands on the root's inline style, and a palette that only
        // notices one of the three ways a token can move is a palette that goes stale
        // in the one case nobody tested.
        this.#themeObserver = new MutationObserver(() => this.refreshPalette());
        this.#themeObserver.observe(root, { attributes: true, attributeFilter: [...THEME_ATTRIBUTES] });
    }

    /**
     * Does this surface have a rendered box right now? The ENGINE's answer, not a
     * parent's claim: `checkVisibility()` is false inside a `display: none` subtree,
     * which is what a tab bar's `hidden` produces on the panel that is not showing.
     */
    get hasRenderedBox() {
        if (!this.isConnected) return false;
        if (typeof this.checkVisibility === 'function') return this.checkVisibility();
        return Boolean(this.offsetParent);
    }

    /**
     * True while a palette move has arrived that this surface has NOT applied because it
     * had no box to rebuild into. Read by the box observer, and by the suites that count
     * builds — a deferral has to be visible or it is indistinguishable from a miss.
     */
    get paletteDeferred() { return this.#paletteDeferred; }

    /**
     * Re-read the tokens and, if any moved, rebuild. Coalesced through the same
     * single-flight scheduler as a data frame, so a burst of attribute writes costs one
     * rebuild rather than one per mutation.
     *
     * A SURFACE WITH NO BOX DOES NOT REBUILD (§7.4 E12). A rebuild is a uPlot
     * CONSTRUCTION and uPlot sizes itself from the host it is built into, so running one
     * inside a `display: none` subtree allocates the fresh 1x1 canvas that item is about
     * — arriving down the THEME path rather than the data one, which is the half a data
     * guard cannot see. The move is not dropped: `#tokens` is deliberately left STALE, so
     * the first refresh after a box appears sees the difference and rebuilds then, in the
     * theme that is actually on screen. #9 calls this from its own box observer, which is
     * where "a box appeared" is known.
     */
    refreshPalette() {
        if (!this.isConnected || !this.hasUpdated) return;
        if (!this.hasRenderedBox) { this.#paletteDeferred = true; return; }
        this.#paletteDeferred = false;
        const next = readChartTokens(this, { strict: false });
        if (this.#tokens && !tokensDiffer(this.#tokens, next)) return;
        this.#tokens = next;
        this.rebuildPlot();
    }

    /**
     * SALVAGE 3 — range persistence across rebuild. uPlot bakes its axis and grid
     * colours in at construction, so a theme change is a rebuild rather than a
     * restyle; the range, the damped ceiling, the rules and the data belong to the shot
     * rather than to the theme and are carried across.
     */
    rebuildPlot() {
        if (!this.#tokens || !this.plotHost) return;
        // The waiver is the subclass's declaration, never "the sheet happens to be
        // missing" — see `plotStyleSheetOptional`. A surface that mounted with the sheet
        // and has since lost it gets `createPlot`'s refusal, which is the guard working.
        const waived = !this.sheetAdopted && this.plotStyleSheetOptional;
        this.#destroyPlot();
        this.#buildPlot({ allowMissingStyles: waived });
        this.requestDraw();
    }

    /* ---- data -------------------------------------------------------------- */

    /**
     * The channels this plot draws, in the order they are drawn.
     *
     * `[{ key, label, token?, width?, minor?, dash?, alpha?, scale?, show? }]` — `key` is
     * both the record key and, by default, the channel's name, so a caller never spells
     * `--ui-channel-…` by hand and cannot drift from `chart-channels.css`. Series are a
     * construction-time property of a uPlot instance, so this rebuilds.
     *
     * `minor` IS A SPEC FIELD AND NOT ONLY A CHART-CARD IDEA. §3.8 tokenises the two
     * stroke widths and this is the layer that reads them, so a list composed anywhere
     * gets the minor stroke by saying `minor: true` rather than by resolving a token of
     * its own. It used to be dropped by everything below `ui-chart-card`: the History
     * comparison marked all ten of B's series minor and every one of them drew at the
     * MAJOR width, which is §6.2's defect entered from the composition end.
     *
     * A GATE 6 SERIES KEY IS A LEGAL `key`. `chart-tokens.js`'s `SERIES_KEY_CHANNELS`
     * translates the camelCase derivation keys to their lower-kebab channel names
     * (`weightFlow` -> `weight-flow`), so a chart may pass `SERIES_KEYS` straight
     * through. A key that resolves to no colour throws at build time rather than
     * drawing an invisible trace — see `#buildPlot`.
     *
     * IT IS ALSO WHAT BUILDS THE FIRST PLOT when the channels arrive after the mount —
     * the store-fed order. Setting them to an empty list is the inverse and is
     * honoured: the plot is destroyed rather than left drawing the previous shot's
     * series under a chart that has been told it has none.
     */
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

    /**
     * COLOURED PATHS along arbitrary points — the P-Q trajectory, and the only drawing
     * this surface does that is not a series.
     *
     * `[{ points: [{x, y, t}], colorAt(t), width?, dash?, alpha? }]`, straight through to
     * `uplot-plot.js`'s `bandsPlugin`. A polyline whose x is FLOW is not a uPlot series
     * at all — x is non-monotonic, and a series is drawn in index order against a sorted
     * scale — so the plot layer has always drawn it segment by segment, each segment
     * taking its own colour ("Only the pressure/flow trajectory is different, and that
     * one is handled by drawing coloured segments directly", `uplot-plot.js:9-10`).
     *
     * IT IS HELD, NOT ONLY PASSED, for the same reason `setRules` is: a theme change
     * rebuilds the uPlot instance from scratch (`refreshPalette`), and a path handed only
     * to the old instance would vanish on a light/dark flip with nothing raising. The
     * bands are re-applied at the end of `#buildPlot`, beside the rules.
     */
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

    /**
     * THE LABELS DRAWN AT EACH TRACE'S LAST POINT — `[{ x, y, scale, text, color }]`.
     *
     * `uplot-plot.js` has carried `setEndLabels` and its painter since the port and had no
     * caller: the finished half with no other half, and this is the other half. The one
     * chart that needs it is the steam view, and Slate says why beside its own
     * `steamEndLabels`: "Steam's only key: it has no legend and no KPI strip naming its
     * two axes, so two lines against different scales would otherwise be unlabelled."
     *
     * HELD, NOT ONLY PASSED, for the same reason `setRules` and `setBands` are: a theme
     * change or a channel change destroys and rebuilds the uPlot instance, and a label set
     * that was only pushed would be gone after it.
     */
    setEndLabels(labels) {
        this.#endLabels = this.#paintEndLabels(labels);
        this.#plot?.setEndLabels(this.#endLabels ?? []);
    }

    /**
     * Give each label the ink of the trace it names, resolved AT THE MOMENT OF PAINTING.
     *
     * A6, and it is the rule the whole chart layer follows: a colour is a CSS custom
     * property read now, never a hex held from the last theme. A caller that passed a
     * colour would be holding one across a light/dark flip, which is precisely how the
     * trajectory kept the previous theme's ramp until `setRuleSource` was made to re-ask.
     *
     * `key` NAMES A CHANNEL, and the translation from a derivation key to a token name is
     * `chart-tokens.js`'s single one — the same `resolveChannels` the series go through,
     * so a label and the line under it cannot end up different colours. A label that names
     * no channel keeps whatever colour it was given, which is what a plain annotation is.
     */
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

    /* ---- internals --------------------------------------------------------- */

    #buildPlot({ allowMissingStyles = false } = {}) {
        const host = this.plotHost;
        if (!host || !this.#tokens) return;
        /* NO CHANNELS YET IS AN ORDER, NOT AN ERROR. Series are a construction-time
         * property of a uPlot instance and `requireSpec` refuses an empty list — which
         * is right, because a plot of nothing is a bug when it is meant to be data. But
         * "append the element, set the channels when the shot opens" is the ordinary
         * store-fed order, and it used to throw out of the mount (MEASURED:
         * 'createPlot: spec.series is empty', unhandled). The build simply WAITS: the
         * plot is constructed by `setChannels`, which rebuilds as soon as there is
         * something to draw. `plotHandle` stays null in the meantime and says so. */
        if (!this.#channels.length) return;
        const { channels, surface, geometry, fontFamily } = this.#tokens;

        /* EVERY DRAWN CHANNEL RESOLVES TO A COLOUR, OR THE BUILD FAILS. `key` is a
         * derivation key (`weightFlow`) and a channel name is lower-kebab
         * (`weight-flow`), so twelve of gate 6's fourteen keys are NOT their own token
         * name; `resolveChannels` is the one translation (chart-tokens.js) and it throws
         * naming the misses. Reading the token map directly is what made this silent —
         * `channels['weightFlow']` is `undefined`, uPlot takes `undefined` as "no
         * stroke", and the trace is absent from a plot that raises nothing.
         *
         * IT IS STRICT UNCONDITIONALLY, and that is the correction. `allowMissingStyles`
         * used to flip this too, so a Rule 1 waiver silently switched off an unrelated
         * guard — but `--ui-channel-*` reach this host through `styles/chart-channels.css`,
         * a DOCUMENT sheet, and have nothing whatever to do with `vendor/uPlot.min.css`.
         * An eighteen-channel palette that half-landed is exactly as invisible on the
         * canary as on a production chart, so it is caught on both. */
        const { resolved } = resolveChannels(
            this.#channels.map((channel) => channel.token ?? channel.key),
            channels,
        );

        /* `alpha` travels with `dash` and for the same reason (chart-C7): a comparison
         * draws its second shot in the FIRST one's hue, dashed and faded, so a channel
         * spec that could state a dash but not an alpha would carry half a convention.
         * Undefined here means the plot's own default and no chart moves. */
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

    /**
     * The left scale AT CONSTRUCTION. uPlot evaluates a function range when it builds the
     * plot and on an auto re-range, NOT once a frame, so this sets where the axis starts;
     * `yRangeFor()` is what moves it afterwards. Override BOTH together — a subclass that
     * declares a fixed band here and leaves `yRangeFor()` alone would have the damped
     * ceiling written straight back over it on the next paint, which is precisely the bug
     * this pair was split to fix.
     */
    yScaleSpec() { return { auto: false, range: () => [0, this.#yMax ?? this.yFloor] }; }

    /**
     * The left scale's range for THIS frame, or `null` to leave the axis exactly where
     * `yScaleSpec()` put it. THE FIXED-RANGE ESCAPE, made real.
     *
     * `yScaleSpec()` has documented the escape since the port — "a temperature plot passes
     * a fixed range from `computeTempRange`, and a plot with a fixed range gets no damped
     * ceiling" — and there was no such branch anywhere in the class. `#draw()` ran
     * `computeDampedYMax` and then `setScale('y', [0, yMax])` on EVERY frame, so whatever
     * a subclass declared was overwritten a frame later. `computeTempRange` — the one
     * carried-forward function whose behaviour was decided by watching real shots — had no
     * road into a surface at all, and a temperature plot would have got `[0, dampedMax]`
     * with its 88-95 °C band crushed into the top inch: the same failure `shot-derivation`
     * rule 3 refuses a 0 °C target to avoid.
     *
     * Overriding this is now the one place a subclass owns its y range. Return
     * `computeTempRange(...)` from it and the damped ceiling is never computed and never
     * applied; return `null` and the axis is left to the construction-time range.
     */
    yRangeFor(data) {
        this.#yMax = computeDampedYMax(this.leftScaleData(data), this.#yMax, { floor: this.yFloor });
        return [0, this.#yMax];
    }

    /**
     * A CHANNEL DRAWN AT A FRACTION OF ITS OWN UNITS, and there is exactly one reason to
     * want that: a temperature on an axis of bar and mL/s.
     *
     * Ben, 25 August 2026, on the function audit: "Group temperature on the Live chart,
     * copy slates." Slate's live chart carries seven series, two of them temperatures, on
     * one 0-12 axis, and the way it fits them is a division at the source —
     * `groupTemperatureY = (data.groupTemperature / 100) * 10` (`chart.js` `updateChart`),
     * so 90 C plots at 9.
     *
     * IT IS A HONEST TRICK AND IT IS STATED. The axis beside the plot is bar and mL/s; the
     * temperature line is NOT read against it, and nothing on Slate's screen says so
     * either. What it buys is the shape — a group temperature dipping and recovering
     * across a shot, against the pressure that caused it, on one plot. The gauge cluster
     * directly above carries the real number to a tenth of a degree.
     *
     * APPLIED HERE AND NOT AT THE SOURCE, which is the one difference from Slate. The
     * derivation holds degrees and goes on holding them — the phase table, the temperature
     * plot on the expanded page and the gauge all read the same numbers they always did.
     * Only this plot's copy of the array is divided, and only for a channel whose spec asks.
     */
    #applyFactors(data) {
        this.#channels.forEach((channel, i) => {
            const factor = channel.factor;
            if (typeof factor !== 'number' || !Number.isFinite(factor) || factor === 1) return;
            const ys = data[i + 1];
            if (!Array.isArray(ys)) return;
            data[i + 1] = ys.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v * factor : v));
        });
    }

    /**
     * The y-arrays on the LEFT scale, in channel order — what an autoscaler reads, and
     * what a subclass overriding `yRangeFor` needs in order to read its own. A right-hand
     * axis is a different quantity and must not push the left one up.
     */
    leftScaleData(data) {
        const left = [];
        this.#channels.forEach((channel, i) => {
            if ((channel.scale ?? 'y') === 'y') left.push(data[i + 1]);
        });
        return left;
    }

    /** No right-hand axis by default. */
    y2ScaleSpec() { return undefined; }

    /**
     * uPlot's own cursor, OFF by default — and the re-verify that gates turning it on has
     * now been RUN and RECORDED, so a subclass may.
     *
     * Part 10 §12 lists "enabling uPlot's own cursor without the coordinate re-verify" as
     * a MUST NOT, because uPlot's cursor is the one vendor path that mixes
     * `getBoundingClientRect()` with everything else's `clientWidth` (§6.3). The check is
     * an executing test rather than a paragraph: `plot-surface.render.test.mjs`,
     * "COORDINATE RE-VERIFY", drives five real CDP moves across `.u-over` at BOTH Gate A
     * geometries and asserts `cursor.left` is the pointer's x inside the plotting area,
     * `posToVal` is linear in it, and `cursor.idx` is the nearest sample — the same
     * numbers at dsf 1.5 and dsf 1. The mix is real in the source and does not corrupt the
     * result. The default stays `false` because switching it on for every chart is #9's
     * call, not this base class's; the override is how a chart takes it.
     */
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

        // The damped ceiling by default; `null` from a fixed-range subclass leaves the
        // axis where `yScaleSpec()` put it rather than overwriting it every frame.
        const yRange = this.yRangeFor(data);

        const xs = data[0] ?? [];
        const last = xs.length ? xs[xs.length - 1] : 0;
        const max = this.xMax ?? Math.max(last, 1);
        /* `xMin` states the left edge; unstated it is zero, which is where every plot in
         * the app but a two-shot comparison starts. `min < max` is checked because a
         * caller handing an empty comparison a degenerate window would otherwise ask
         * uPlot for a zero-width scale. */
        const stated = Number.isFinite(this.xMin) ? this.xMin : 0;
        const min = stated < max ? stated : 0;
        this.#xRange = [min, max];

        plot.setData(data, this.#xRange);
        if (yRange) plot.setScale('y', yRange);
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
