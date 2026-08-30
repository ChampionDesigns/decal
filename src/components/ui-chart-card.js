/**
 * ui-chart-card.js — component #9 of the 57-component inventory: THE CHART CARD.
 * Wave 3, the stack's one stated risk, built on gate 5's mount and gate 6's derivation.
 *
 * §5.1 #9: "Chart card | slate-components.css:47-55 — 7 uses | Must gain a
 * `var(…, fallback)` on its background (§6)." That one line is the whole of what the
 * old library owned: a flex column with a hairline, a radius and a background. Every
 * other thing a chart needs — the plot, its size, its pixel ratio, its legend's place in
 * the layout, its cursor — lived in `chart.js`, `chart-components.js` and
 * `uplot-legend.js`, which is why four of the fourteen chart defects are defects of
 * ownership rather than of drawing.
 *
 * WHAT IT IS. A `PlotSurfaceElement` (gate 5) with a frame around it, fed EXCLUSIVELY by
 * a gate-6 derivation. It calls no endpoint and reads no store: a screen hands it
 * `deriveFromBuffer(buffer)` or `deriveFromRecord(record)` and the card draws that, so
 * ONE derivation renders a live shot and a recorded one (gate 6's own contract).
 *
 * ─── WHAT GATE 5 ALREADY OWNS AND THIS FILE DOES NOT RE-IMPLEMENT ────────────────
 * Rule 1 (the vendor sheet in THIS root's `adoptedStyleSheets` before `new uPlot`),
 * Rule 2 (the axis face loaded from the document registry before first paint), A6 (the
 * eighteen channel tokens and four surface tokens read from this host), the
 * single-flight frame scheduler, the damped y ceiling, gap bridging with its two
 * meanings of null, and range persistence across the rebuild a retheme forces. See
 * `plot-surface.js`. This file adds the five things item #9's row names, and each one
 * kills a numbered defect.
 *
 * ─── THE FIVE, AND THE DEFECT EACH RETIRES ───────────────────────────────────────
 *
 * 1. BUG O3 — THE BACKGROUND READS ITS TOKEN WITH A FALLBACK.
 *    `.slate-chart-card { background: var(--slate-chart-well) }`
 *    (`slate-components.css:54`) reads a token that exists ONLY in JavaScript, injected
 *    into a <style> appended to <head> last (`chart-palette.js:124-156` from
 *    `app.js:39`). With no `var(…, fallback)` a broken chain is invalid at computed-value
 *    time and EVERY chart card renders transparent. Two halves of the fix: A6 moved the
 *    declaration into `styles/chart-channels.css` where a stylesheet can own it, and this
 *    card names a fallback — `var(--ui-chart-well, var(--ui-key))`. The fallback is
 *    another TOKEN, never a literal (CONVENTIONS §12), so a fork that retheres --ui-key
 *    moves the degraded case with it. Pinned by a test that makes the token
 *    guaranteed-invalid and asserts the card still paints an opaque surface.
 *
 * 2. BUG chart-C10 — THE LEGEND IS PART OF THE LAYOUT.
 *    `chart-components.js:73-121` inserts a 78px legend host as the plot's PRECEDING
 *    SIBLING *after* `createPlot` has measured the host, so every plot is born sized to a
 *    box it no longer occupies — invisible only because the callers schedule a
 *    compensating resize a frame later. Here the legend is a slot in the card's own grid,
 *    laid out before the plot is built (the mount is async and runs after the first
 *    render), and the plot's row is the `1fr` that absorbs what is left. Killed twice: the
 *    `ResizeObserver` below also corrects a legend that arrives late, so the same defect
 *    cannot come back through a consumer that fills the slot after mount.
 *
 * 3. BUG chart-C11 — A `ResizeObserver` ON THE COMPONENT'S OWN HOST, MANDATORY.
 *    "The overlays have no ResizeObserver at all" (`chart.js:2937-2985`): a window resize
 *    with the expanded overlay open resized only the embedded chart. §6.1 rule 2 says
 *    drive size from an observer on the component's own host, not `window.resize` +
 *    `getElementById`. TWO TARGETS, one observer: the HOST (the row the screen sizes) and
 *    the PLOT BOX (which also moves when the legend row changes). `handle.resize()`
 *    compares before it calls `setSize`, so an observation that changes nothing costs
 *    nothing and cannot loop.
 *
 * 4. BUG chart-C12 — ONE `pixelRatio`, OWNED HERE.
 *    Fifteen call sites multiplied by the GLOBAL `devicePixelRatio` while uPlot used its
 *    own cached value refreshed on `dppxchange`, and the two can diverge for a frame. The
 *    surface owns the number (`plot-surface.js`'s `pixelRatio`); this card is what feeds
 *    it, from the ONE event uPlot itself dispatches on `window` when the ratio moves
 *    (`vendor/uPlot.esm.js:81`, from a `matchMedia` on the resolution). The bench tablet
 *    runs at dpr 1.5, so this is not hypothetical, and Part 8 §3 names `dppxchange`
 *    redraw as one of the three things the spike did not cover and the chart's own suite
 *    owns.
 *
 * 5. §6.1 RULE 1 — THE HOST OWNS THE SIZE AND THE PLOT HOST HAS NO PADDING.
 *    uPlot sizes from `clientWidth`/`clientHeight` — the PADDING box — so a padded plot
 *    host overflows by exactly its padding (`#profile-preview-chart`, measured 32px,
 *    bug chart-C3). The card's inset lives on the frame; the plot host inside it carries
 *    none, inherited from gate 5 and re-asserted here because the unpadded-preview host
 *    is the consumer this rule exists for.
 *
 * ─── THE CURSOR: THE CUSTOM PATH, BECAUSE THE RE-VERIFY HAS NOT RUN ──────────────
 *
 * uPlot's own cursor stays OFF (`cursorSpec()` is inherited unchanged). §6.3 and Part 8
 * §3 forbid enabling it without re-checking uPlot's coordinate handling — it is the one
 * vendor path that mixes `getBoundingClientRect()` with `clientWidth`
 * (`chart-uplot.js:181`, `uplot-plot.js:333`), and MUST NOT (Part 10 §12) lists
 * "enabling uPlot's own cursor without the coordinate re-verify" by name.
 *
 * So the card carries its own crosshair, and it is written so that the mixing cannot
 * happen: `#readCursor` takes the pointer's `clientX` and the `.u-over` element's
 * `getBoundingClientRect()` — ONE space, both from the same API — and then converts to
 * the element's own CSS-px space with an EXPLICIT correction factor,
 * `over.clientWidth / rect.width`. That factor is the re-verify, computed at runtime
 * rather than assumed: it is 1 when nothing is scaled, and when it is not 1 (a page
 * zoom, a transformed ancestor, the old app's scaled canvas) the maths still lands on the
 * right sample instead of drifting by the scale. `plotCoordinateCheck()` exposes it so
 * the suite asserts the number rather than trusting the sentence.
 *
 * The crosshair itself is a DOM element positioned over the plot, NOT a canvas redraw: a
 * pointer move must not cost a repaint of 4,500 samples on a tablet at 15 Hz. Values are
 * read at the derivation's own index (`indexAtTime`, gate 6, NEAREST not floor), so the
 * readout the legend (#10) will show is the same number the chart drew.
 *
 * TOUCH IS THE SAME PATH. Pointer events unify mouse and touch, so the bench tablet's
 * finger and the desk's mouse produce one cursor with one set of maths. Part 8 §3 names
 * touch (`Input.dispatchTouchEvent`) as the second thing the spike did not cover; the
 * suite dispatches real touch events and asserts the cursor tracks.
 *
 * ─── WHAT IT DELIBERATELY DOES NOT DO ────────────────────────────────────────────
 *   - NO ENDPOINT, NO STORE. Data arrives as a derivation. Wave 3's law.
 *   - NO STRINGS. The card authors no word: the accessible name and every slotted
 *     caption arrive already translated (the same law as ui-toast and ui-alert-banner).
 *   - NO `overflow: hidden`. Slate's card clips (`slate-components.css:51`) and that is
 *     exactly what hid chart-C3's 32px overflow for years — and it would hide Rule 1's
 *     450px overflow at the bench dpr too. §2.4's rule is that nothing clips silently;
 *     an overflowing canvas here is a VISIBLE fault, which is the point.
 *   - NO LEGEND, NO TIME KEY. #10 and #11 are their own components (#11 arrived with the
 *     power page, fix run 6, and sits BESIDE the plot rather than in it: its colour is an
 *     axis). The card gives the legend a slot and a row in the grid, and nothing else.
 *   - NO A11Y TABLE FALLBACK (bug chart-C14's third clause). The plot region takes
 *     `role="img"` and a consumer-supplied name; the numeric summary belongs with the
 *     stat cluster and the legend, which are not this component.
 *
 * API
 *   card.derivation = deriveFromBuffer(buffer)      the live shot so far
 *   card.derivation = deriveFromRecord(record)      the same card, a recorded shot
 *   <ui-chart-card channels="pressure flow weightFlow">    derivation SERIES_KEYS
 *   card.channelKeys = [{ key: 'flow', minor: true }]      or spelt out, per instance
 *   card.setRuleSource((tokens) => rules)           a composer owns the rules (A/B)
 *   <ui-chart-card label="Shot chart">              the plot region's accessible name
 *   <ui-chart-card scrub-label="Shot chart scrub">           the WELL's, when it scrubs
 *   <ui-chart-card><ui-chart-legend slot="legend">  the legend's row (chart-C10)
 *   <span slot="empty">…</span>                     shown when the derivation refuses
 *   card.cursor                                     { active, idx, t, values, point? }
 *   card.cursorPoints = [{ x, y, t }]               a chart whose x is not time (F-034)
 *   'cursor-change'                                 fired when the index moves
 *   card.plotCoordinateCheck()                      the re-verify, as a number
 */

import { css, html, nothing } from 'lit';

import { PlotSurfaceElement } from './plot-surface.js';
import { channelNameFor, readChartTokens } from '../lib/chart-tokens.js';
import { SERIES_KEYS, indexAtTime } from '../lib/shot-derivation.js';
import { effectivePixelRatio, FIT_EVENT } from '../lib/app-fit.js';
import { computeTempRange, widenBand } from '../lib/chart-autoscale.js';

/**
 * The Live set, in draw order: the measured channel first and its target under it, so a
 * target line never hides the thing it is a target for. Keys are gate 6's SERIES_KEYS —
 * `chart-tokens.js`'s SERIES_KEY_CHANNELS is the one translation to a colour token, and a
 * key with no colour throws at build time rather than drawing an invisible trace.
 *
 * `minor` picks --ui-chart-stroke-minor over --ui-chart-stroke; both are §3.8 tokens and
 * neither number is written here.
 */
export const DEFAULT_CHANNELS = Object.freeze([
    Object.freeze({ key: 'pressure' }),
    Object.freeze({ key: 'targetPressure', minor: true, dash: 'dash' }),
    Object.freeze({ key: 'flow' }),
    Object.freeze({ key: 'targetFlow', minor: true, dash: 'dash' }),
    Object.freeze({ key: 'weightFlow', minor: true }),
    /* THE TWO TEMPERATURES, AT A TENTH OF THEMSELVES — Slate's own seventh and sixth
     * series, and Slate's own way of fitting them.
     *
     * Ben, 25 August 2026, on the function audit: "Group temperature on the Live chart,
     * copy slates." Slate's `SERIES_ORDER` is pressure, flow, targetPressure, targetFlow,
     * groupTemperature, targetTemperature, weight — seven against Decal's five — and
     * `updateChart` divides the temperature by ten on the way in so 90 C plots at 9 on an
     * axis of bar and mL/s.
     *
     * `factor: 0.1` IS THAT DIVISION, moved to the one place it belongs: the plot. The
     * derivation goes on holding degrees, so the gauge above this chart, the phase table
     * below it and the expanded page's temperature band all read the real numbers.
     * `plot-surface.js` `#applyFactors` carries the whole argument.
     *
     * THE TARGET IS DASHED AND MINOR like every other target here, and it is divided by
     * the same tenth — a target drawn against a different scale from the thing it commands
     * would be worse than not drawing it. */
    Object.freeze({ key: 'groupTemp', factor: 0.1 }),
    Object.freeze({ key: 'targetTemp', minor: true, dash: 'dash', factor: 0.1 }),
]);

/**
 * THE WEIGHT AND DASH A KEY CARRIES, WHOEVER NAMES IT.
 *
 * §6.2's defect is a swatch whose weight does not match its trace, and a channel list is
 * where the two can part. `DEFAULT_CHANNELS` used to be the only place a target could be
 * marked minor/dashed, so a screen writing `channels="pressure targetPressure flow"` —
 * the same keys, named rather than defaulted — drew targetPressure as a 3px SOLID line
 * while #10's legend, whose `items` do carry `minor` and `dash`, described it as a 2px
 * dashed one. Same defect as Slate's fixed 3px swatch, entered from the other end.
 *
 * So the per-key treatment lives here, keyed, and `DEFAULT_CHANNELS` is one ORDERING of
 * it. A caller may still override per instance by passing objects rather than keys.
 */
/**
 * THE TREATMENTS THAT ARE NOT IN ANY ORDERING, and the temperature targets are why.
 *
 * Ben, 24 Aug 2026: "The Temp chart has no dashed lines for targets, they are using the
 * same line as the measurment." Exactly so — `CHANNEL_TREATMENTS` was built from
 * `DEFAULT_CHANNELS` alone, which is the PRESSURE plot's five, so `targetTemp` and
 * `targetMixTemp` had no entry at all and fell to the default: a 3px solid major line,
 * indistinguishable from the measurement it is the target of.
 *
 * The paragraph below already had the shape of this bug written down — "a screen writing
 * `channels="pressure targetPressure flow"` drew targetPressure as a 3px SOLID line" —
 * and the fix then was to key the treatment rather than order it. This is the same fix
 * finished: the KEYED table is the authority, and `DEFAULT_CHANNELS` is one ordering OF
 * it rather than the whole of it.
 *
 * THE STEAM TARGETS COME WITH THEM. `steam-chart.js` declares its own specs and carries
 * `dash` on `targetFlow` already; the two temperature keys it plots are the same two
 * names, so an entry here costs nothing there and closes the same hole if that page ever
 * stops declaring its own.
 */
const EXTRA_TREATMENTS = Object.freeze([
    /* THE TENTH STAYS ON THE LIVE CHART AND NOWHERE ELSE, and these two entries are what
     * keep it there.
     *
     * `CHANNEL_TREATMENTS` is `[...DEFAULT_CHANNELS, ...EXTRA_TREATMENTS]` into a Map, so
     * the LAST entry for a key wins. `DEFAULT_CHANNELS` — the Live card's own ordering —
     * now carries `factor: 0.1` on the two temperatures, and every other surface reads its
     * channels through this table. Without a no-factor entry here the expanded page's
     * temperature plot and the History flow page's would divide by ten as well, and
     * `computeTempRange` would band them at 8.0-9.5 with an axis reading single digits.
     *
     * MEASURED IN A COMMENT RATHER THAN ON A SCREEN, deliberately: this is the shape of a
     * bug that would have looked like a working chart. */
    Object.freeze({ key: 'groupTemp' }),
    Object.freeze({ key: 'targetTemp', minor: true, dash: 'dash' }),
    Object.freeze({ key: 'targetMixTemp', minor: true, dash: 'dash' }),
    /* POWER'S TREATMENT LIVES HERE, NOT IN THE DEFAULT LIST, AND THE DIFFERENCE IS WHICH
     * SURFACE DRAWS IT.
     *
     * Ben, 25 August 2026: "Live chart is on the main page and shouldnt show power." He
     * is right and Slate agrees: its main-page series are pressure, flow, the two
     * targets, group temperature, target temperature and weight - seven, and no watts.
     * Power is a trace of the EXPANDED chart's top plot (`expandedTopSeriesSpec`, six
     * series) and of the history flow page, which is where `FLOW_TOP_CHANNELS` puts it.
     *
     * `DEFAULT_CHANNELS` IS THE LIVE CARD'S LIST. A card given no `channelKeys` draws
     * it, and the Live screen gives none - so an entry there is an entry on the main
     * page. It had one from 24 August, which was my reading of "the pressure/Flow chart"
     * as this card rather than as the expanded one.
     *
     * THE TREATMENT STILL HAS TO EXIST. `CHANNEL_TREATMENTS` is what gives a key its
     * weight and dash wherever it IS drawn, and the expanded chart and the history page
     * both ask for power by name. Moving the entry rather than deleting it keeps one
     * table for the treatment and takes the channel off one surface. */
    Object.freeze({ key: 'power', minor: true }),
]);

/**
 * THE KEYED TABLE, AND IT IS EXPORTED BECAUSE THE LEGEND CANNOT SEE IT OTHERWISE.
 *
 * `#specs()` merges this per key on the way to the surface, so a card asked for
 * `targetTemp` draws it dashed whatever the caller said. The CHART KEY does not go
 * through `#specs()` — `legendItems()` builds it from the treatments the CALLER passes —
 * so a page that passed `DEFAULT_CHANNELS` got a dashed line on the plot and a solid
 * swatch beside it, which is the same disagreement one table exists to prevent.
 *
 * MEASURED 24 AUGUST 2026, and it is why Ben's temp-target note survived its first fix:
 * `referenceSpecs` writes `dash: treatment?.dash ?? null`, so a key the CALLER'S table
 * does not name arrives carrying an explicit null, and `{...CHANNEL_TREATMENTS.get(key),
 * ...named}` lets that null win. Passing THIS table is what makes the two agree; nothing
 * downstream had to learn a special case.
 */
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
        /**
         * ALIGN THE LEGEND WITH THE PLOT'S DATA AREA rather than with the card's edge.
         *
         * A plot does not start at its host's edge: uPlot keeps a gutter each side for
         * the axis labels, and this tree states those four gutters as tokens because
         * nothing else may. A legend that is a HEADING AND READOUTS should begin and end
         * on the same two edges as the data it describes — Ben, 23 Aug 2026: "the profile
         * name, and live values should align to the chart edges".
         *
         * A LEGEND THAT IS A CHIP ROW SHOULD NOT. #10's chips have nothing to line up
         * with and want the whole width; insetting them by 134px wraps the row and takes
         * its height out of the plot, which is what the History power page's suite caught
         * when this was applied to every card that had a legend at all.
         */
        legendGutter: { type: Boolean, reflect: true, attribute: 'legend-gutter' },
        /**
         * A gate-6 derivation, whole. `attribute: false` because it is an object graph:
         * there is no honest string form of a shot, and a chart that took its data
         * through an attribute would be a chart a screen could feed by hand.
         */
        derivation: { attribute: false },

        /**
         * The channels to draw, in draw order — gate 6 SERIES_KEYS as strings, or
         * `{ key, label?, minor?, dash? }` objects when an instance wants its own
         * treatment. A bare key takes the treatment `CHANNEL_TREATMENTS` holds for it, so
         * naming a series does not silently change how it is drawn (§6.2).
         *
         * THE ATTRIBUTE IS `channels` AND THE
         * PROPERTY IS `channelKeys`, and they are the same state: `PlotSurfaceElement`
         * already owns `channels` as a getter over the built channel list, and a
         * reactive property of that name would be defined by Lit as an accessor on this
         * prototype and SHADOW it — the same trap `ui-card` documents for `scroll`.
         */
        channelKeys: { attribute: 'channels', converter: { fromAttribute: parseChannelKeys } },

        /** The plot region's accessible name. Consumer-supplied and already translated. */
        label: { type: String },

        /**
         * THE PLOT WELL'S OWN NAME, and the control it names is the SCRUB (audit F-016).
         *
         * Wave 1 rowed five of these wells — the editor preview's, both flow-page plots,
         * both power-page plots — as controls whose accessible name resolved to the empty
         * string, and they are the whole of the `drag` gesture on those cards. The name
         * was empty because a bare `div` maps to `generic`, a role that takes no name at
         * all, so even an `aria-label` on it would have been announced by nothing.
         *
         * SO THE WELL TAKES `role="group"` WHEN IT IS A SCRUB SURFACE, which is what it
         * is: a box holding the plot image and the crosshair that reads it. When
         * `activate` is set the well is a BUTTON instead and this property is not
         * consulted — a card you can open is not a card you scrub (see `#bindPointer`).
         *
         * CONSUMER-SUPPLIED AND ALREADY TRANSLATED, falling back to `label`, exactly as
         * `activateLabel` does. The card authors no word (its own NO STRINGS law), so
         * "Temperature scrub" is composed by the screen through its own `t`; a card given
         * none is still named, by the name it already had.
         *
         * THE FORM IS "{name} scrub", SHORTENED FROM "{name} — chart scrub" (Ben, 30 Aug
         * 2026, decision D16). The card is not the owner of either spelling — the four
         * call sites are — but the example above is the one place a reader looks for the
         * shape, so it moves with them rather than becoming the stale copy.
         */
        scrubLabel: { type: String, attribute: 'scrub-label' },

        /**
         * THE PLOT IS A WAY THROUGH TO SOMETHING BIGGER — off by default.
         *
         * Slate opens a full-screen pair of plots when its live chart is tapped
         * (`chart.js:181-183`), which is the one gesture a small chart on a tablet
         * really wants. The card does not know where that leads, so it reports the
         * gesture as `plot-activate` and the screen decides.
         *
         * OPT-IN, because most cards ARE the destination: the History pages' own plots
         * would otherwise offer a way out of the screen they are on. Setting it makes
         * the well a real control — focusable, in the tab order, Enter and Space — and
         * `activate-label` is what a screen reader reads, falling back to `label`.
         */
        activate: { type: Boolean, reflect: true },

        /** The activation control's accessible name. Already translated. */
        activateLabel: { type: String, attribute: 'activate-label' },

        /** Reflected so a screen can style the refusal. Set from the derivation. */
        empty: { type: Boolean, reflect: true },

        /**
         * THE RIGHT-HAND AXIS, and it is #9's own seam finally taken.
         *
         * `{ range: [min, max], format?: (v) => string }`, or null for the card's normal
         * one-axis shape. Handed to `y2ScaleSpec()` below, which `PlotSurfaceElement`
         * declares and answers `undefined` for by default, so every existing card is
         * unchanged by construction.
         *
         * WHY IT IS A DECLARED RANGE AND NOT AN AUTOSCALE. `#draw()` follows every
         * `setData` with `setScale('y', ...)` and NOTHING calls `setScale('y2')` — the
         * defect `uplot-plot.js:307-311` records ("the first two-scale chart came up with
         * a silently unranged right-hand axis"). A y2 with `auto: true` would be that
         * again: an axis whose numbers nothing owns. So the caller states the range, and
         * `scaleFor` passes it to uPlot unchanged.
         *
         * A CHANGE REBUILDS. Series and scales are construction-time properties of a
         * uPlot instance, so `willUpdate` rebuilds the plot when this moves — the same
         * thing `setChannels` does for the same reason.
         */
        y2: { attribute: false },

        /**
         * A FIXED LEFT RANGE — `[min, max]`, or null for the damped ceiling.
         *
         * `PlotSurfaceElement.yRangeFor()` documents this escape and makes a SUBCLASS the
         * only way to take it ("a temperature plot passes a fixed range from
         * `computeTempRange`, and a plot with a fixed range gets no damped ceiling").
         * A COMPOSED card — one a screen drives with `setChannels`/`setRecords` rather
         * than with a derivation — cannot subclass, and the P-Q trajectory needs both
         * axes stated because neither of them is time. So the escape is a property too:
         * stated, `yRangeFor` returns it verbatim and the damped ceiling is never
         * computed; null, nothing changes for any existing chart.
         */
        yRange: { attribute: false },

        /**
         * THE LEFT AXIS'S OWN TICK LADDER AND LABELS — `{ format?, splits?, keepZero? }`.
         *
         * The card has always let a caller state the left RANGE; this states how that
         * range is READ. It exists for one chart and its shape says so: the derived-channel
         * plot draws log10 values against a range in log10 units, so uPlot's even ladder
         * lands between decades and its labels are the log, not the number.
         *
         * `format` turns a tick value into its label, `splits` says where the ticks are,
         * and `keepZero` keeps the label at 0 that every zero-based axis drops (on a log
         * axis 0 is 10^0 = 1, which is a number a reader needs).
         *
         * A CHANGE REBUILDS, for the same reason `y2` does: axes are a construction-time
         * property of a uPlot instance.
         */
        yAxis: { attribute: false },

        /**
         * THE POINTS A CURSOR CAN LAND ON WHEN THE X AXIS IS NOT TIME — `[{ x, y, t }]`,
         * or null for the ordinary index cursor.
         *
         * AUDIT F-034. The pressure-against-flow trajectory is drawn by `setBands`, not by
         * `setRecords`: flow is not monotonic, so the path is a polyline in data
         * coordinates rather than a uPlot series (`uplot-plot.js:9-10`). That is also why
         * its well swallowed every gesture — `#readCursor` walks the derivation's shared x
         * axis, and a card fed only bands has none, so the pointer reached the well and
         * the card had nothing to look the sample up in. Measured across hover, press and
         * three moves: the card's entire shadow markup byte-identical, cursor still
         * hidden.
         *
         * SO THE NEAREST POINT IS FOUND BY xy DISTANCE, IN PIXELS. Not by x alone — on a
         * trajectory the same flow occurs at several pressures, so an x-only search picks
         * whichever of them happens to be first. And not in DATA units: bar and mL/s are
         * not comparable, so "nearest" would mean whichever axis has the larger numbers.
         * The comparison happens in the plot's own pixel space, where the reader's idea of
         * near is the one that applies.
         *
         * THE DETAIL CARRIES THE POINT. `cursor-change` gains `point` on this path — the
         * `{ x, y, t }` the card landed on — because a trajectory's reading is not a
         * column of channel values: `values` stays empty and the consumer names pressure,
         * flow and the second from the point itself.
         */
        cursorPoints: { attribute: false },

        /**
         * HOW THE LEFT AXIS DECIDES ITS RANGE — `"damped"` (the default) or `"temp"`.
         *
         * `plot-surface.js` has documented the temperature escape since the port and named
         * the one function that takes it: "a temperature plot passes a fixed range from
         * `computeTempRange`, and a plot with a fixed range gets no damped ceiling". The
         * function has been in the tree since gate 5 with its bench reasoning intact and
         * NO CALLER — the finished half with no other half, and the visible cost is a
         * temperature plot drawn from zero with its 70-95 band crushed into the top inch.
         * Slate's expanded and history temperature charts are BANDS
         * (`chart.js:1749` -> `computeExpandedTempRange`); this is that road.
         *
         * IT IS A POLICY AND NOT A RANGE because the band moves with the data: a live
         * shot's targets arrive as it pours, so a range computed once at bind time would
         * be the wrong band from the second frame on. `yRangeFor` recomputes it per frame
         * from the same aligned data the damped ceiling reads.
         *
         * `yRange` STILL WINS. A caller that states an explicit pair means it.
         */
        yPolicy: { type: String, attribute: 'y-policy' },
    };

    static styles = [
        ...PlotSurfaceElement.styles,
        css`
            /* THE HOST IS THE SIZE. §6.1 rule 3: declared px heights are not rendered
             * heights, so the card declares none — Live gives it the one "1fr" row and
             * it absorbs what is there, down to the §6.1 rule 7 floor, which the card
             * restates below because gate 5's is the PLOT's and this box is bigger than
             * its plot. The card reads its own box and never the viewport
             * (spec §2.1 Rule 1); there is not one width query in this file. */
            :host {
                display: block;

                /* THE CARD'S FLOOR IS THE PLOT'S FLOOR PLUS THE CARD'S OWN CHROME.
                 *
                 * Gate 5 puts "min-block-size: var(--ui-chart-min-h)" on :host, and for a
                 * bare surface that is right — 160px is the PLOT AREA's floor (§6.1 rule
                 * 7, tokens.css:511). A CARD is that plot plus a legend row, an inset and
                 * a hairline, so a host that stops at 160px advertises a minimum it cannot
                 * honour. MEASURED at both Gate A geometries with a 44px legend slotted: a
                 * card at 200px — comfortably above the advertised floor — drew its canvas
                 * 17px BELOW its own background and border, and 57px at 160px, with the
                 * frame's own content minimum at 216px against a 158px client box.
                 *
                 * So the floor is the plot's floor PLUS this card's own chrome, and the
                 * chrome is one private property built from the same tokens the frame is
                 * laid out with — no number is written here and none is written twice.
                 * Squeezed below it the CARD overflows its container, visibly and with its
                 * border still around the plot (§2.4), instead of the canvas escaping the
                 * card. The plot still never shrinks past its own floor: that is the
                 * recorded choice on the grid-template-rows below and it is untouched.
                 *
                 * NOT "min-content", which reads as the honest form of the same idea and
                 * is a TRAP here: uPlot writes a pixel height onto its canvas, so the
                 * plot host's content-based minimum is whatever the canvas measured LAST
                 * time — MEASURED, the card then pinned itself at its first layout (340px)
                 * and would not shrink at any asked height, at both geometries. */
                /* THE HEAD'S OWN AIR, NAMED ONCE. Ben, 23 Aug 2026: "increase margn
                 * between the profile name and the top edge of the card." The frame's
                 * padding was --ui-space-3 on all four sides, which is right beside a
                 * plot and tight above a title, a status chip, a clock and seven
                 * readouts — measured, the profile name sat 13px from the card's edge.
                 *
                 * BLOCK-START ONLY, because that is what he asked for and because the
                 * inline sides are not free: every pixel added there is a pixel off the
                 * plot's width. The bottom keeps --ui-space-3 for the same reason — the
                 * plot's own axis gutter already holds the space under it.
                 *
                 * NAMED RATHER THAN WRITTEN TWICE: the card's floor counts its own
                 * chrome, so the derivation below has to read the same number. A literal
                 * in one of the two places is how a floor stops matching its frame. */
                --_ui-chart-card-pad-top: var(--ui-space-6);

                --_ui-chart-card-chrome: calc(
                    var(--_ui-chart-card-pad-top) + var(--ui-space-3) + 2 * var(--ui-border-w));

                min-block-size: calc(var(--ui-chart-min-h) + var(--_ui-chart-card-chrome));
            }

            /* WITH A LEGEND THE CHROME INCLUDES ITS ROW — exactly the reserve the .legend
             * rule below asks for, so the floor and the layout cannot disagree. A legend
             * TALLER than a chip row costs nothing at the floor: the row is an auto track
             * and its own minimum is that reserve, so the grid takes the height back from
             * the legend before the plot's 160px track gives up anything. MEASURED with a
             * 96px legend at 80px asked: card 238, legend row 52, plot 160, nothing past
             * the frame at either geometry. */
            :host([has-legend]) {
                --_ui-chart-card-chrome: calc(
                    var(--_ui-chart-card-pad-top) + var(--ui-space-3) + 2 * var(--ui-border-w)
                    + var(--ui-legend-chip-h) + var(--ui-space-2));
            }

            /* THE FRAME: the three declarations Slate's library owned, plus the fallback
             * it lacked (bug O3) and the inset it left to seven call sites.
             *
             * NO "overflow: hidden". Slate clips here (slate-components.css:51) and that
             * is what made chart-C3's 32px overflow invisible; at the bench dpr it would
             * hide Rule 1's 450px overflow too. §2.4: nothing clips silently. */
            .frame {
                display: grid;
                grid-template-rows: auto minmax(var(--ui-chart-min-h), 1fr) auto;

                /* THE FRAME FILLS THE HOST, AND CARRIES THE HOST'S OWN FLOOR. The height
                 * stays a definite 100% — that is what keeps the tracks resolving against
                 * a known box instead of against the canvas uPlot last sized (see :host).
                 * The min repeats the host's floor so that a host squeezed by something
                 * this file cannot see still has its background, border and radius drawn
                 * around the whole plot rather than behind part of it. */
                block-size: 100%;
                min-block-size: calc(var(--ui-chart-min-h) + var(--_ui-chart-card-chrome));
                /* THE INLINE SIDES ARE --ui-space-2 — Ben, 23 Aug 2026: "To gap to the
                 * left and right of the chart, to th ecard boarder, could reduce by
                 * around 30%." 12 -> 8 is a third off, and it is the scale's own step
                 * rather than 8.4 written down. Every pixel taken here is a pixel given
                 * to the plot, which is why this side is the one that gives.
                 *
                 * THE BLOCK ENDS ARE UNCHANGED: the head keeps the air he asked for in
                 * the round before, and the bottom keeps --ui-space-3 because the plot's
                 * own axis gutter already sits under it. */
                padding: var(--_ui-chart-card-pad-top) var(--ui-space-2) var(--ui-space-3);
                border: var(--ui-border-w) solid var(--ui-line);
                border-radius: var(--ui-radius-lg);

                /* BUG O3, in one declaration. The chain is
                 * styles/chart-channels.css -> this host -> here; if it ever fails, the
                 * card paints --ui-key rather than turning transparent. A token, never a
                 * literal. */
                background-color: var(--ui-chart-well, var(--ui-key));
            }

            /* THE LEGEND'S ROW (bug chart-C10). It exists in the grid whether or not it
             * is filled, so the plot is never born measuring a box the legend is about
             * to take. Filled, it reserves at least a chip's height — --ui-legend-chip-h
             * is §3.8's own token and the legend component (#10) paints inside it. */
            .legend {
                display: block;
                min-inline-size: 0;
            }

            :host([has-legend]) .legend {
                min-block-size: var(--ui-legend-chip-h);

                /* THE GAP BETWEEN THE LEGEND AND THE PLOT, AND IT BELONGS TO EVERY CARD
                 * THAT HAS A LEGEND. It briefly did not: when the inline gutters below
                 * were made opt-in, this declaration went into the opt-in block with
                 * them, and a card without the legend-gutter attribute — every History
                 * page, every
                 * gallery stage — lost its separation entirely. The chip's own 48px hit
                 * overlay then spilled 2px into the plot well and stole the crosshair's
                 * top two rows, which no screenshot can show. The suite reads the cost of
                 * one legend row and found 44 where 52 is right.
                 *
                 * The INLINE gutters are a call site's opinion about its own legend; the
                 * BLOCK separation is not — a legend that touches the plot is wrong
                 * whatever the legend is made of. */
                padding-block-end: var(--ui-space-2);

                /* AND A CHIP ROW STARTS WHERE THE AXIS NUMBERS START.
                 *
                 * Ben, 25 August 2026: "This theme carries on to the legends in the
                 * Expanded and History chart pages with the left side of the legend button
                 * aligned with the left side of the text in the Y axis labels."
                 *
                 * ONLY THE LEFT. The paragraph below this one is why a chip row does not
                 * take the gutter on both sides — it wraps, and a wrapped row takes its
                 * height out of the plot. One inset does not: a legend that starts 43px in
                 * and runs to the card's edge has 43px less room than before, against the
                 * 134px the two-sided version cost. */
                padding-inline-start: calc(var(--ui-chart-gutter-l) - var(--ui-chart-label-l));

                /* THE LEGEND LINES UP WITH THE PLOT AREA, NOT WITH THE CARD'S EDGE.
                 * Ben, 23 Aug 2026: "the profile name, and live values should align to
                 * the chart edges (Time and profile should align wht the Y axis numbers,
                 * likewise for the time etc)."
                 *
                 * A plot does not start at its host's edge: uPlot keeps a gutter on each
                 * side for the axis labels and their ticks, and this tree states those
                 * four gutters as tokens because nothing else may
                 * (styles/tokens.css §6.2, --ui-chart-gutter-*). MEASURED at 1920 design
                 * units: the card's content ran 500..1851 while the plot's data area ran
                 * 570..1787, so every readout above the chart was 70px left of the first
                 * gridline and the clock 64px right of the last.
                 *
                 * SLATE ALIGNS THE SAME WAY AND WITH THE SAME NUMBER — slate-live.css:
                 * 1817 hand-writes padding-left: 70px to match this gutter across a
                 * file boundary, which the gutter token's own note records. Reading the
                 * token instead is the whole of the difference: the two cannot drift.
                 *
                 * SO THE AXIS NUMBERS SIT OUTSIDE THE CONTENT COLUMN, in the gutter they
                 * own, and the title, the seven readouts and the clock all begin and end
                 * on the plot's own edges. That is one reading of Ben's sentence; the
                 * other is the numbers' own left edge, which is not a stable number — it
                 * moves with how many digits the scale happens to need. */
            }

            /* AND IT IS OPT-IN, WHICH THE HISTORY PAGES TAUGHT ME. The first version of
             * this put the two gutters on every card that carries a legend — and the
             * legend most cards carry is component #10's chip row, not a heading and
             * seven readouts. On the History power page that took 134px of width out of
             * a row of chips and wrapped it to two, which takes its height out of the
             * plot: the suite read a 96px key where one chip row is 44 and said so.
             *
             * So the alignment is a CALL SITE'S opinion about its own legend. Live's card
             * asks for it because its legend is a heading and a row of readouts that
             * should line up with the data underneath them; a chip row has nothing to
             * line up with and wants the whole width. */
            :host([legend-gutter]) .legend {
                /* THE GUTTER LESS WHAT THE NUMBERS THEMSELVES TAKE — see the two
                 * --ui-chart-label-* tokens, which carry the whole argument and the
                 * measurement. The paragraph above chose the plot's own edge; Ben chose
                 * the axis numbers' outer edge on 25 August 2026, and these two calcs are
                 * the difference between the two readings. */
                padding-inline-start: calc(var(--ui-chart-gutter-l) - var(--ui-chart-label-l));
                padding-inline-end: calc(var(--ui-chart-gutter-r) - var(--ui-chart-label-r));
                /* --ui-space-4, OVERRIDING THE 8px EVERY LEGEND GETS. 8px is enough
                 * under a chip row and not under a legend that carries readings: when
                 * Ben moved the Live band's title, status and seven readouts into this
                 * slot (23 Aug 2026), the separation they used to get was live-main's own
                 * grid gap — --ui-space-4 — and 8px in its place put the gauge cluster's
                 * ink 1px INTO the plot at +10% type. Measured, both before and after;
                 * the suite's own clearance assertion is what found it. */
                padding-block-end: var(--ui-space-4);
            }

            /* THE PLOT'S WELL. "position: relative" so the crosshair and the refusal
             * message can be placed over the plot without either becoming a child of the
             * plot host — createPlot calls replaceChildren() on that host, so anything
             * inside it is destroyed at the first build. */
            .well {
                position: relative;
                min-inline-size: 0;
                min-block-size: 0;

                /* THE ONE touch-action IN THE LIBRARY, and it is measured rather than
                 * assumed. The base deliberately declares none (base.js) — and note the
                 * reason there is no longer "pinch-zoom is an open measurement": that
                 * question was closed on 27 August 2026 and browser scaling is settled in
                 * index.html's viewport meta, not by any touch-action. This declaration
                 * was never about zoom and is unaffected.
                 * With the default, a horizontal drag across the plot is claimed by the
                 * browser as a pan gesture and the pointer stream ends in pointercancel:
                 * MEASURED here through CDP touch events — touchStart placed the cursor at
                 * idx 29 and the touchMove that followed cleared it to null. "pan-y" hands
                 * the horizontal axis to the chart, which is the axis a scrub reads, and
                 * leaves vertical panning to whatever is scrolling — so a chart inside a
                 * scroll region does not become a scroll trap. */
                touch-action: pan-y;
            }

            /* THE CROSSHAIR. A positioned element, not a canvas redraw: a pointer move
             * must not cost a repaint of the whole shot. Geometry arrives as three
             * private properties set by #placeCursor, so nothing here is a number. */
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

            /* THE CURSOR ON A CHART WHOSE X IS NOT TIME (audit F-034). A vertical rule
             * answers "which instant" and there is no instant here to answer with — the
             * trajectory's x is FLOW — so the mark is the point itself. Same element,
             * same three private properties, one attribute: the diameter rides in
             * --_ui-chart-cursor-h, which is the height on the other path.
             *
             * THE DIAMETER IS A TOKEN AT ONE REMOVE. --ui-space-2 is the scale's own
             * small step and the same one the legend and the plot gutter are built from;
             * a literal here would be the one number in this file nothing else moves. */
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

    /**
     * THE TEMPERATURE BAND THIS CARD LAST DREW, AND THE SAMPLE COUNT IT DREW IT AT.
     *
     * The pair is one mechanism: the band is what `#tempBand` widens into, and the count
     * is the only honest signal that a NEW shot has started and the widening should begin
     * again. See `#tempBand` for why a band with no memory flickers.
     */
    #tempBandHeld = null;

    #tempBandSamples = 0;

    #resizeObserver = null;

    #pointerBound = false;

    /**
     * One bound handler, so add/remove pair up across reconnects. Serves BOTH sources
     * of the backing factor, because the factor is a product of two numbers that move
     * independently: the device's `devicePixelRatio` (fires `dppxchange`) and the app's
     * own scale (fires `FIT_EVENT`, src/lib/app-fit.js). Multiplying them is not an
     * optimisation — on Ben's tablet dpr is 1.5 and the scale is 0.6675, so the true
     * factor is 1.0 and `dpr` alone oversampled every chart by half; on a 2560x1440
     * screen the scale is 1.2 and `dpr` alone would UNDERSAMPLE and blur it.
     */
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

    /* ---- what a screen, a legend and a test read --------------------------- */

    /** `{ active, idx, t, values }` — the crosshair's current reading. Frozen. */
    get cursor() { return this.#cursor; }

    /** The channel specs actually handed to the plot, resolved from tokens. */
    get channelSpecs() { return this.#specs(); }

    /**
     * THE COORDINATE RE-VERIFY, as a number rather than a promise.
     *
     * uPlot's own cursor is the one vendor path that mixes `getBoundingClientRect()` with
     * `clientWidth` (§6.3), and it stays off until that maths is re-checked. This card's
     * cursor does not mix them: it measures the ratio between the two spaces and applies
     * it. `scaleX`/`scaleY` are 1 when nothing is transformed — which is what the suite
     * asserts at both Gate A geometries, INCLUDING dsf 1.5, where a naive reading would
     * be wrong by the device pixel ratio if the two spaces really disagreed.
     */
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

    /* ---- the frame --------------------------------------------------------- */

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

    /* ---- lifecycle --------------------------------------------------------- */

    firstUpdated(changed) {
        super.firstUpdated(changed);
        this.#observeBoxes();
        this.#bindPointer();
    }

    connectedCallback() {
        super.connectedCallback();
        globalThis.addEventListener?.('dppxchange', this.#onDppxChange);
        globalThis.addEventListener?.(FIT_EVENT, this.#onDppxChange);
        /* Take the factor NOW rather than wait for a change: a card mounted after the
         * fit ran — every card, on every route — would otherwise hold the constructor's
         * `dpr` alone until the window happened to resize. */
        this.pixelRatio = effectivePixelRatio(globalThis);
        if (this.hasUpdated) {
            this.#observeBoxes();
            this.#bindPointer();
        }
    }

    /** CONVENTIONS §12: observers disconnected, listeners removed, uPlot destroyed. */
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
        /* A SCALE IS A CONSTRUCTION-TIME PROPERTY, so a second axis arriving after the
         * plot was built has to rebuild it — the same rule `setChannels` follows. Guarded
         * on the plot existing: before the mount there is nothing to rebuild and
         * `#buildPlot` will read the new value anyway. */
        if ((changed.has('y2') || changed.has('yRange') || changed.has('yAxis')) && this.plotHandle) this.rebuildPlot();
    }

    /** The right-hand axis the caller stated, in `createPlot`'s own shape. */
    y2ScaleSpec() {
        const spec = this.y2;
        if (!spec || !Array.isArray(spec.range) || spec.range.length !== 2) return undefined;
        return { range: spec.range, format: spec.format };
    }

    /**
     * THE LEFT SCALE AT CONSTRUCTION, and it is the half a fixed range cannot skip.
     *
     * `PlotSurfaceElement` says it in capitals — "Override BOTH together" — and the
     * mechanism is uPlot's: the range a scale is CONSTRUCTED with is a function, and
     * `setScale` re-evaluates it rather than taking the min/max it was handed
     * (`vendor/uPlot.esm.js` :4028 and its siblings). The damped ceiling only moves the
     * axis because that function is a closure over `#yMax`. MEASURED before this override
     * existed: a card with `yRange = [0, 12]` and `yRangeFor` alone came up at [0, 10] —
     * the resting floor — and every `setScale` put it straight back there.
     */
    yScaleSpec() {
        const fixed = this.#fixedRange();
        /* A TEMPERATURE PLOT OPENS ON ITS BAND'S FLOOR, not on zero. uPlot evaluates a
         * function range at construction, so a plot built with the damped closure and
         * moved by `setScale` a frame later flashes the wrong axis on its first paint —
         * and a card with no data yet never gets that second frame at all. `null` for the
         * arrays gives `computeTempRange` its documented no-target answer, a band around
         * the default 90. */
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

    /**
     * The fixed left range when one was stated, and the damped ceiling otherwise.
     *
     * `super.yRangeFor(data)` is what computes and STORES the damped max, so it is not
     * called at all on the fixed path — calling it and discarding the result would move
     * `#yMax` under an axis that does not use it, and the next flip back to the damped
     * path would open on a stale ceiling.
     */
    yRangeFor(data) {
        const fixed = this.#fixedRange();
        if (fixed) return fixed;
        if (this.yPolicy === 'temp') return this.#tempBand(data);
        return super.yRangeFor(data);
    }

    /**
     * The temperature band for THIS frame — `computeTempRange`, fed by channel key.
     *
     * BY KEY AND NOT BY POSITION, which is the whole reason this is a method on the card
     * rather than four indices at the call site. `computeTempRange` takes its four arrays
     * in a fixed order and anchors the band on the GROUP TARGET alone; the other three
     * only widen it. A caller that reordered its channel list — or drew three of the four
     * — would silently hand the anchor's slot to another series, and the failure is a band
     * that looks plausible and is wrong. So the four are looked up by name and a missing
     * one is an empty array, which is exactly what the function's own signature defaults
     * them to.
     *
     * `super.yRangeFor` IS NOT CALLED on this path. It computes and STORES the damped max,
     * and moving that under an axis which does not use it would leave a stale ceiling for
     * whatever flips back — the same rule the fixed-range path above follows.
     */
    #tempBand(data) {
        const column = (key) => {
            const i = this.channels.findIndex((channel) => channel.key === key);
            return i < 0 ? [] : (data[i + 1] ?? []);
        };
        const next = computeTempRange(
            column('targetTemp'), column('groupTemp'), column('mixTemp'), column('targetMixTemp'),
        );

        /* THE HYSTERESIS THE OTHER AXIS HAS AND THIS ONE DID NOT. Ben, 29 August 2026:
         * "when I watch the shot live the temperature chart flickers."
         *
         * `computeDampedYMax` — the ceiling every non-temperature plot uses — states the
         * rule this band was missing: "the axis must not chase a spike back down, and it
         * must not jitter around one." The band had no such memory. It was recomputed from
         * scratch on EVERY frame, and it is the axis most likely to move: it widens to keep
         * every temperature line in view, and the mix target is not a flat goal but the
         * DE1's servo SETPOINT, which `computeTempRange`'s own header says the machine
         * "slams around", diving to ~37 C on a hot-group shot. So the floor jumped frame to
         * frame and the axis snapped with it. That is the flicker.
         *
         * WIDEN ONLY, WITHIN ONE SHOT. This is what `computeTempRange` already claims
         * conceptually — "widening-only keeps the line fully visible" — it simply never
         * persisted across frames. A band that can only grow cannot make a line that was
         * visible start clipping, which is what makes this safe rather than a compromise.
         *
         * DAMPED HERE, NOT IN `computeTempRange`. That function is carried forward, its
         * numbers were decided by watching real shots, and it has its own suite. Adding
         * state to it would make a pure function stateful for one caller's benefit.
         *
         * THE RESET IS THE SAMPLE COUNT FALLING, and it has to be: a new shot restarts the
         * buffer, so the count drops. Derivation identity cannot serve — the expanded chart
         * hands over the SAME object for the life of the page, deliberately
         * (`live-expanded-chart.js`: "never re-derived… this is what makes the plots
         * live"), so it never changes and a band widened by one shot would be inherited by
         * the next. */
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

    /* ---- the data road: one derivation in, nothing else -------------------- */

    /**
     * Feed the card. Identical to setting `.derivation`, and named for the screens that
     * read better as a verb: `card.showDerivation(deriveFromBuffer(buffer))`.
     */
    showDerivation(derivation) {
        this.derivation = derivation ?? null;
    }

    /**
     * The whole data path, and it is the only one: a derivation in, series + step rules
     * out. Nothing here reads a socket, a store or an endpoint.
     *
     * A REFUSAL IS NOT AN EMPTY CHART. `emptyShotDerivation` carries a `reason` and its
     * series are empty, so the card keeps its axes and shows the slotted refusal over
     * them rather than destroying the plot — a chart that vanishes when a shot has no
     * pouring sample reads as a broken chart, which is the failure gate 6's `reason`
     * exists to avoid.
     */
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

    /**
     * WHO ANSWERS "WHAT ARE THIS CARD'S RULES?" WHEN THE CARD IS NOT THE ONLY WRITER.
     *
     * A card takes ONE derivation, so a screen laying a second shot over the first
     * composes on the inherited `setChannels`/`setRecords` surface and states the pair's
     * rules with `setRules` (`history-flow-page.js`). That composition used to be
     * DESTROYED BY A THEME CHANGE, measured: `refreshPalette` re-issues `#applyRules`
     * from `this.derivation` — shot A alone — so the light frame of a comparison drew ten
     * series and only A's one boundary, while B's three faded ones vanished with no error
     * anywhere. The card was doing exactly what its own header says it does; what was
     * missing was a way for the composer to be the one asked.
     *
     * So: hand the card a FUNCTION rather than a rule set. It is called with this card's
     * tokens (`chartTokens` once mounted, a fresh computed read before that — the same
     * fallback `#specs` uses) and returns a `setRules` payload. It is called immediately,
     * and again on every re-issue the card makes for itself: a palette change, a new
     * derivation, a channel-list change. `null` gives the card its own answer back.
     *
     * IT IS NOT AN A/B API. The card still knows nothing about a second shot — it knows
     * that somebody else owns this answer, which is the smallest seam that keeps the
     * composition and the retheme from overwriting each other.
     *
     * @param {((tokens: object|null) => object|null)|null} source
     */
    setRuleSource(source) {
        this.#ruleSource = typeof source === 'function' ? source : null;
        this.#applyRules();
    }

    /**
     * The step boundaries, as vertical rules with their names.
     *
     * Colours come from the tokens this build read (A6) — `step-boundary` is one of the
     * eighteen channels and the label ink is the chart's own label token, so a retheme
     * moves both. The rules are RE-APPLIED on a palette change (see `refreshPalette`),
     * because a rule object carries its colour and a rebuild would otherwise redraw the
     * previous theme's boundaries.
     */
    #applyRules(derivation = this.derivation, ok = Boolean(derivation && derivation.ok)) {
        /* A COMPOSED CARD ANSWERS FOR ITSELF (see `setRuleSource`). The source is asked
         * with THIS card's tokens, freshly read, so the re-issue below is a re-issue of
         * the composition rather than a silent replacement of it. */
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

    /**
     * The channel list the plot is built from, resolved against the geometry tokens.
     *
     * Read through `#tokens()` rather than `chartTokens` alone: `chartTokens` is null
     * until the mount has run, and the ordinary order is "set the derivation, then the
     * element mounts". A computed style is readable the moment the element is connected,
     * so the widths are right on the FIRST build and the card does not have to rebuild
     * itself once the mount catches up.
     */
    #specs() {
        const geometry = this.#tokens()?.geometry;
        const listed = this.channelKeys?.length ? this.channelKeys : DEFAULT_CHANNELS;
        return listed.map((entry) => {
            /* A LIST ENTRY IS A KEY OR A CHANNEL. `channels="pressure targetPressure"`
             * parses to strings and the property may be handed objects; an object used to
             * reach `resolveChannels` as its own key and KILL THE MOUNT ("--ui-channel-
             * [object Object]", ready false, hasPlot false), which is not a shape a public
             * property may refuse by crashing. */
            const named = typeof entry === 'string' ? { key: entry } : (entry ?? {});
            /* The key's own treatment first, the caller's word over it — so a named set
             * keeps the minor/dash the default set gives the same series (§6.2), and a
             * caller that means something else still says so. */
            const channel = { ...CHANNEL_TREATMENTS.get(named.key), ...named };
            return {
                key: channel.key,
                label: channel.label ?? channelNameFor(channel.key),
                dash: channel.dash,
                width: channel.minor ? geometry?.strokeMinor : geometry?.strokeMajor,
                /* THE SCALE TRAVELS, and until 24 Aug 2026 it did not.
                 *
                 * This card declares a `y2` property and draws the right-hand axis from
                 * it, and NOTHING COULD EVER BE PUT ON THAT AXIS through this path: the
                 * spec built here dropped `scale`, so every series went to `y` whatever
                 * the caller said. The one existing two-axis page works around it by
                 * calling `setChannels` itself with its own specs — a composition seam
                 * that should not have been the only way to reach a declared property.
                 *
                 * FOUND BY THE STEAM CHART, whose temperatures belong on 0..195 while its
                 * hydraulics belong on 0..6.5: with the scale dropped, 150 °C drew against
                 * a 6.5 bar axis and pinned to the top of the plot for the whole session,
                 * which looks exactly like a chart with no temperature on it. */
                scale: channel.scale,
                /* AND SO DOES THE FACTOR, for exactly the reason the scale does. This spec
                 * is an explicit field list, so a field the list forgets is a property the
                 * caller can set and nothing reads — the shape of the bug the paragraph
                 * above records, one field along. MEASURED before this line existed: the
                 * Live chart drew group temperature at 88 against a 0-12 axis, took the
                 * axis to 100, and crushed pressure and flow into the bottom tenth. */
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

    /**
     * A palette change rebuilds the plot (gate 5) — WHEN THERE IS A BOX to rebuild into;
     * the base defers it otherwise and `#resized` brings it back. Two things ride on top
     * of it here:
     * the step rules carry their colours and have to be re-issued, and the stroke WIDTHS
     * are baked into the channel specs — so if §3.8's stroke tokens move, the specs are
     * rebuilt too. Colour alone does not trigger that second rebuild, which is why a
     * theme flip still costs exactly one.
     */
    refreshPalette() {
        /* AND NOTHING IS APPLIED WITHOUT A BOX. When the base defers the rebuild, the two
         * things riding on top of it defer with it: re-issuing the rules is a DRAW, and
         * drawing into a canvas that is not on screen is the paint half of E12 — measured
         * at buildCount 0 but paintCount +1 before this returned early. `#resized` runs
         * the whole of it when a box appears. */
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

    /* ---- bug chart-C11: the observer, on this host and on the plot box ------ */

    #observeBoxes() {
        if (typeof ResizeObserver === 'undefined') return;
        if (!this.#resizeObserver) {
            this.#resizeObserver = new ResizeObserver(() => this.#resized());
        }
        // Both targets, and `observe` is idempotent per target. The HOST is what a screen
        // sizes; the PLOT BOX is what the legend row moves (bug chart-C10's second half).
        this.#resizeObserver.observe(this);
        const host = this.plotHost;
        if (host) this.#resizeObserver.observe(host);
    }

    #resized() {
        /* A BOX APPEARED — which is also when a palette move that was DEFERRED for want
         * of one can finally land (see `plot-surface.refreshPalette`). It runs before the
         * handle is read, because applying it replaces the handle. */
        if (this.paletteDeferred) this.refreshPalette();
        const handle = this.plotHandle;
        const host = this.plotHost;
        if (!handle || !host) return;
        // `resize` compares before it calls setSize, so an observation that changes
        // nothing costs nothing — and cannot feed itself a new observation.
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

    /* ---- the custom cursor ------------------------------------------------- */

    #bindPointer() {
        if (this.#pointerBound) return;
        const well = this.renderRoot?.querySelector('.well');
        if (!well) return;
        this.#pointerBound = true;
        // Pointer events unify mouse and touch, so the tablet's finger and the desk's
        // mouse take one path with one set of maths (Part 8 §3's touch clause).
        /* A CARD THAT OPENS SOMETHING IS A BUTTON, NOT A SCRUBBER (Ben, 24 Aug 2026:
         * "when I click on it initially I get a vertical line with circle for 500ms or
         * so ... it shouldn't have any vertical line or delay just launch the full screen
         * chart").
         *
         * The cursor and the activation were bound together and they are two different
         * gestures. On a plot you can OPEN, a press is a press: the vertical rule and the
         * dot painted under the finger on the way to the tap, and then the surface
         * changed under them. On a plot you cannot open — the History pages — the cursor
         * IS the affordance and is untouched.
         *
         * ASKED AT THE MOMENT OF THE GESTURE, not at bind time: `activate` is a property
         * that can arrive after the first paint, and these listeners are bound once. */
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
        /* THE WAY THROUGH — see the `activate` property. Bound once with the pointer
         * listeners rather than gated on the property, because `activate` can arrive
         * after the first paint and a listener that only asks at the moment of the
         * gesture cannot be bound late or twice. */
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

    /**
     * Pointer -> sample, in ONE coordinate space.
     *
     * `clientX` and `rect.left` are both viewport CSS px from the same API. The only
     * conversion is into the element's own layout space, and it is EXPLICIT:
     * `over.clientWidth / rect.width` is 1 unless something between here and the viewport
     * is scaled, and applying it is what keeps the reading right when something is —
     * which is precisely the check §6.3 demands before anyone enables uPlot's cursor.
     */
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

    /**
     * THE NEAREST PLOTTED POINT TO THE POINTER, BY xy DISTANCE (audit F-034).
     *
     * The search happens in the plot's own layout px — `valToPos` for both axes — and the
     * pointer's position is already converted into that space by the caller. Comparing in
     * DATA units would mean "nearest" was decided by whichever axis has the larger
     * numbers; comparing on x alone would pick an arbitrary one of the several pressures a
     * trajectory visits at the same flow, which is the whole reason this chart needs its
     * own cursor rather than the index one.
     *
     * SQUARED DISTANCE, NEVER A SQUARE ROOT. The comparison is the only thing wanted and
     * the root is monotone in it, so 336 `Math.hypot` calls per pointer move are 336
     * calls that change nothing.
     *
     * THE GAP POINTS ARE SKIPPED. `trajectoryPoints` emits `{ x: null, y: null, t }` to
     * break the path where a reading was gated away; there is nothing drawn there, so
     * there is nothing to land on.
     */
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

    /**
     * Put the crosshair where the sample is.
     *
     * TWO SPACES, AND THE CONVERSION IS EXPLICIT — the same discipline as `#readCursor`
     * above, for the same reason, but this one was WRONG until the fit landed and made
     * the two spaces differ. `valToPos(…, 'x')` answers the plotting area's own LAYOUT
     * px, and `getBoundingClientRect()` answers PAINTED px. While the app was drawn at
     * scale 1 those were the same number, so adding them was harmless and this comment
     * used to claim "nothing here mixes spaces either". src/lib/app-fit.js draws the app
     * at a scale — 0.6675 on the bench tablet — and the sum became a crosshair a third
     * of the way off the sample it names.
     *
     * The written value is consumed as a length INSIDE the scaled subtree, so everything
     * here has to end up in layout px: the painted offsets are converted, and the height
     * is taken from `clientHeight`, which is already layout px and needs no conversion.
     */
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
            /* A MARK, NOT A RULE (audit F-034). The dot's own diameter is the sheet's, so
             * the top is set to the point's y and the CSS shifts it by half a diameter on
             * both axes — the length is written once, in the rule, not twice. */
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
        /* `scale` JOINED THE COMPARISON with the steam chart. A spec list that differs
         * only by which axis a channel sits on IS a different plot — series scales are a
         * construction-time property — and comparing without it left the card believing
         * nothing had changed while every temperature was on the wrong axis. */
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
