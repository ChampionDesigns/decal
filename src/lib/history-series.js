/**
 * history-series.js — the A/B comparison, as channel specs and records. Wave 5.6,
 * rows `hist-flow-page` and `bug-chart-C7-dash-cap-uniform`.
 *
 * DOM-FREE, so `node:test` imports it directly (`src/lib/README.md`). It builds two
 * things and nothing else: the channel list a plot is constructed from, and the record
 * map it is drawn from. It walks no measurements, opens no endpoint and knows nothing
 * about a component.
 *
 * ===========================================================================
 * WHY THE TWO SHOTS SHARE ONE PLOT
 * ===========================================================================
 * `<ui-chart-card>` takes ONE derivation — `#applyDerivation` overwrites its series from
 * it — so "A and B on one card" is not the card's present API. What the card DOES expose,
 * inherited from `PlotSurfaceElement`, is the surface itself: `setChannels(specs)` and
 * `setRecords(records)` take an arbitrary spec list and record map. A comparison is
 * therefore composed ON the shipped card rather than by giving the card a second
 * derivation or by building a second chart component (Part 10 §9).
 *
 * The record keys are what keep the two apart. A channel spec's `key` indexes the record
 * map AND, by default, names the palette channel; `token` splits the two
 * (`plot-surface.js`: `resolveChannels(channels.map(c => c.token ?? c.key))`). So B's
 * pressure is stored under `b:pressure` and painted from `--ui-channel-pressure` — the
 * SAME HUE as A's, which is half of the ported convention.
 *
 * ===========================================================================
 * THE CONVENTION, PORTED (`history-viewer.js:213-239`)
 * ===========================================================================
 * "B's traces: same hue, dashed, thinner, and OUT of the legend." Three of those four are
 * here (`token`, `dash`, `alpha` + the minor width); the fourth is the legend's, and it
 * is why `legendItems()` below lists A's channels only. Slate states the reason in place
 * and it is carried unchanged: "Twelve legend entries on one chart is not a key, it is a
 * second chart. The A-solid / B-dashed convention is stated once in the align bar."
 *
 * OPACITY IS NOT DROPPED. `stepRules()` hard-codes one dash pattern and drops opacity,
 * flattening the very distinction its own docblock argues for — one of the six counted
 * defects §6 hands over as specification input. Here the fade is `COMPARISON_ALPHA`,
 * carried through the channel spec to `series[i].alpha`, which uPlot reads per series.
 * The cap is NOT here at all: it is one constant in `chart-axis.js` applied to every
 * series by the plot layer, which is chart-C7's fix and the reason this file states no
 * cap of its own.
 *
 * ===========================================================================
 * THE UNION AXIS IS `alignChannels`'s, AND THAT IS THE PORT'S REAL CONTENT
 * ===========================================================================
 * Two shots do not share an x array — different lengths, different sample instants, and B
 * slid by the offset on top. `drawCompareData`'s union-axis interpolation is one of the
 * two subtlest things in the old file, and the Decal side already has it:
 * `alignChannels` takes the union of every channel's x, indexes it once, and bridges only
 * the slots a channel did not SPEAK about (`bridgeUnspoken`). A slot the channel gated
 * null stays null and renders as a gap. That is `resampleOnto`'s hold-the-last-value
 * defect already fixed upstream of this file, and nothing here may reintroduce it: this
 * module hands whole `{x, y}` bundles across and resamples nothing.
 *
 * B's slide is `shiftSeriesX`, which returns a NEW x array — "both shots in a comparison
 * are re-read on every redraw and an in-place shift would compound every time the slider
 * moved". Past the end of A is a legitimate result and not an error: the mock's
 * same-profile pair is 3.26 s and 8.54 s against a ±5 s limit, so a full-limit slide
 * carries the shorter trace clean past the other's end. That is the exact condition the
 * old alignment slider threw on, behind a catch that swallowed it — so it is staged, not
 * guarded against.
 */

import { ALIGNMENT_SLOT } from './alignment-offset.js';
import { SERIES_KEYS, shiftSeriesX } from './shot-derivation.js';
import { Y_FLOOR_EXPANDED } from './chart-autoscale.js';

/**
 * The prefix a comparison series' record key carries.
 *
 * A COLON, so it cannot be mistaken for a derivation key: `SERIES_KEYS` are camelCase
 * identifiers and none of them can contain one. A test asserts that.
 */
export const COMPARISON_KEY_PREFIX = 'b:';

/** B's dash. A name in `chart-axis.js`'s one table, never a pattern spelled here. */
export const COMPARISON_DASH = 'dash';

/** B's opacity — Slate's own 0.72 (`history-viewer.js:233`), carried. */
export const COMPARISON_ALPHA = 0.72;

/**
 * THE FLOW PAGE'S TWO PLOTS, as channel lists.
 *
 * TOP is `ui-chart-card`'s own `DEFAULT_CHANNELS` set by content — pressure, its target,
 * flow, its target, and weight flow — so the History chart and the Live chart draw the
 * same five things in the same order, which is gate 6's "one derivation renders a live
 * shot and a recorded one" arriving at the page.
 *
 * WHAT IS NOT HERE, and neither is an omission. `power` was FLOW_TOP's sixth trace
 * (`history-viewer.js:184`) drawn on `yaxis: 'y2'` — and the right-hand y2 axis is one of
 * the four features the old file documents and does not render (`uplot-plot.js` builds a
 * y2 only if the spec asks for one and neither chart factory accepts one, so Power drew
 * on an invisible auto-ranged axis).
 *
 * IT CAME BACK ON 24 AUGUST 2026, ON THE LEFT AXIS. Ben: "The pressure/Flow chart should
 * also display the Power series on the same axis, single axis." That settles the half the
 * paragraph below was stuck on — the answer to an invisible second axis was not a visible
 * second axis, it was NO second axis:
 *
 *   "Power drew on an invisible auto-ranged axis … Putting it back on the flow page's top
 *   plot would be the invisible axis again on the one page that has no second axis to
 *   give it."
 *
 * True of a y2 and not of the y. Hydraulic power is 0.1·P·F watts — 1.8 W at 9 bar and
 * 2 mL/s, 2.4 W at 6 bar and 4 mL/s — which is the same 0-10 band pressure (bar) and flow
 * (mL/s) already share, so one axis carries all three honestly. It is NOT true on the
 * POWER page, which keeps its second axis: W against bar·s/mL are quantities with no ratio
 * between them, and the taller one flattens the other. Two pages, two answers, and the
 * difference is what is beside the watts.
 *
 * THERE IS NO `scales` ENTRY FOR IT, and that is the whole mechanism: a channel the map
 * does not name draws on the left. See `DERIVED_SCALES` for the other page's.
 */
export const FLOW_TOP_CHANNELS = Object.freeze([
    'pressure', 'targetPressure', 'flow', 'targetFlow', 'weightFlow', 'power',
]);

/** The second plot: the temperatures, Slate's FLOW_TEMP (`history-viewer.js:187-192`). */
export const FLOW_TEMP_CHANNELS = Object.freeze([
    'groupTemp', 'targetTemp', 'mixTemp', 'targetMixTemp',
]);

/**
 * The two plots of the flow page, in §4.5's order.
 *
 * `ratio` is what a page's track list is written from, and it is stated here so a page and
 * its selector cannot disagree about which plot is the tall one.
 *
 * TWO RATIOS, BECAUSE SLATE HAS TWO. Ben, 25 August 2026: "Make sure the chart sizes match
 * slate, like the ratios of the available height it takes up." Slate sizes the same pair
 * differently on the two surfaces, and the difference is not an accident — the expanded
 * page carries a summary strip above the plots and the history page does not, so the
 * expanded pair is given a taller top plot to keep the strip from eating it:
 *
 *   history   `hv-flow-chart` 416px over `hv-temp-chart` 344px   (index.html) -> 1.209
 *   expanded  `expanded-flow-chart` 470px over 335px            (index.html) -> 1.403
 *
 * RATIOS AND NOT THOSE PIXELS. Slate's numbers are fixed heights inside a scrolling
 * overlay; these are fr tracks in a fitted region, and H1 counts a declared px height that
 * the layout then does not honour (Slate declares 416/344/360/592 and renders
 * 404/334/308.6/507.4). The RATIO is the part that survives the difference.
 *
 * `yFloor` AND `yPolicy` ARE THE AXIS, and they are here for the same one-source reason:
 * the history page and the expanded overlay draw these two plots from this table, and an
 * axis stated at one call site is an axis the other surface silently gets wrong.
 */
export const FLOW_PLOTS = Object.freeze([
    Object.freeze({
        id: 'top',
        label: 'Pressure and flow',
        channels: FLOW_TOP_CHANNELS,
        ratio: 1.209,
        expandedRatio: 1.403,
        /* SLATE'S EXPANDED FLOOR, NOT THE LIVE ONE. `EXP_TOP_FLOOR` is 12 against the
         * live chart's 10, and Slate says why in `chart-uplot.js:30-34`: "The expanded
         * view's own floor is 12; using that here would have changed the look of the
         * screen at rest, which is not what the defect was." Bar, mL/s and g/s share this
         * axis and so does W, so the resting top is a little higher than the one the
         * embedded card opens on. */
        yFloor: Y_FLOOR_EXPANDED,
    }),
    Object.freeze({
        id: 'temp',
        label: 'Temperature',
        channels: FLOW_TEMP_CHANNELS,
        ratio: 1,
        expandedRatio: 1,
        /* A BAND, NOT A CEILING — `ui-chart-card`'s `y-policy` and the reason it exists.
         * A temperature plot drawn from zero puts its whole 70-95 range in the top inch.
         * Slate bands it (`chart.js:1749`) and so does this. */
        yPolicy: 'temp',
    }),
]);

/** The plot the page shows when it can only show one. §4.5 lists it first and it is the point. */
export const DEFAULT_FLOW_PLOT = 'top';

/** `pressure` -> `b:pressure`. The one place the prefix is applied. */
export function comparisonKey(key) {
    return `${COMPARISON_KEY_PREFIX}${key}`;
}

/** True for a record key that belongs to the comparison shot. */
export function isComparisonKey(key) {
    return typeof key === 'string' && key.startsWith(COMPARISON_KEY_PREFIX);
}

/**
 * The treatment one key carries, out of a table this module is HANDED.
 *
 * `ui-chart-card`'s exported `DEFAULT_CHANNELS` is the one declaration of which of gate
 * 6's keys are minor and which are dashed (`ui-chart-card.js:147-168`: "the per-key
 * treatment lives here, keyed, and DEFAULT_CHANNELS is one ORDERING of it"). This module
 * is DOM-free and cannot import a component, so the table arrives as an argument —
 * an array of `{ key, minor?, dash? }`, a `Map` of them, or a plain object. Nothing here
 * declares a treatment of its own: restating the widths or the patterns in this file is
 * the §6.2 defect it exists on the other side of.
 */
function treatmentFor(treatments, key) {
    if (!treatments) return null;
    if (typeof treatments.get === 'function') return treatments.get(key) ?? null;
    if (Array.isArray(treatments)) return treatments.find((entry) => entry?.key === key) ?? null;
    return treatments[key] ?? null;
}

/**
 * A's channel specs: each key, carrying the treatment the ONE table holds for it.
 *
 * MEASURED, AND THIS IS THE CORRECTION. `setChannels` is the SURFACE's API and it does not
 * pass through the card's own `#specs()`, which is where the treatments are merged — so
 * A's five series drew `dash: null` at width 3 here while the same five channels drew
 * `target-pressure` dashed [9,9] at width 2 on Live. One derivation, two paints, and the
 * chart key flattened with them. The table is still declared in exactly one place; this
 * READS it, which is the difference between single-sourcing and restating.
 *
 * THE `scales` MAP IS THE ONE ADDITION A SECOND Y AXIS NEEDED (fix run 6, the power
 * page). `{ power: 'y2' }` puts one channel on the right-hand scale; a channel the map
 * does not name stays on 'y', which is `plot-surface`'s own default, so every existing
 * caller is unchanged by construction. It is a MAP rather than a per-spec field because
 * the comparison must not be able to put B's copy of a channel on a different axis from
 * A's — same hue, same dash policy, same SCALE, and the only difference is the record key.
 *
 * @param {string[]} channels  derivation SERIES_KEYS, in draw order
 * @param {Array|Map|object|null} treatments  the per-key table, from its one declaration
 * @param {{scales?: object|null}} [options]  `{ [key]: 'y' | 'y2' }`
 */
export function referenceSpecs(channels, treatments = null, { scales = null } = {}) {
    return channels.map((key) => {
        const treatment = treatmentFor(treatments, key);
        const spec = { key, minor: treatment?.minor === true, dash: treatment?.dash ?? null };
        const scale = scales ? scales[key] : null;
        if (scale) spec.scale = scale;
        return spec;
    });
}

/**
 * The channel specs for one plot: A's channels, then B's when there is a B.
 *
 * B's entries are A's, plus the three things that say "this is the other shot" and
 * NOTHING ELSE about colour: the same hue under a different record key (`token`), the
 * comparison dash, and the fade.
 *
 * @param {string[]} channels  derivation SERIES_KEYS, in draw order
 * @param {boolean}  hasComparison
 * @param {Array|Map|object|null} treatments  the per-key table — see `referenceSpecs`
 * @param {object|null} scales  `{ [key]: 'y' | 'y2' }` — see `referenceSpecs`
 */
export function abChannelSpecs(channels, {
    hasComparison = false, treatments = null, scales = null,
} = {}) {
    const a = referenceSpecs(channels, treatments, { scales });
    if (!hasComparison) return a;
    const b = a.map((spec) => ({
        ...spec,
        key: comparisonKey(spec.key),
        /* SAME HUE, AND THE SAME AXIS. The token is A's channel and `scale` rides along in
         * the spread; only the record key differs. B's power on the left axis while A's is
         * on the right would be two lines of the same colour at different heights meaning
         * the same number. */
        token: spec.key,
        dash: COMPARISON_DASH,
        alpha: COMPARISON_ALPHA,
        minor: true,
    }));
    return [...a, ...b];
}

/**
 * The record map for one plot: A's series under their own keys, B's under prefixed ones
 * with the offset already applied.
 *
 * A DERIVATION THAT REFUSED CONTRIBUTES NOTHING rather than an empty series: a key absent
 * from the map reaches `alignChannels` as `undefined` and comes back as a column of
 * nulls, which draws no line. An empty `{x: [], y: []}` would reach the same place by a
 * different road; leaving it out says what happened.
 *
 * @param {string[]} channels
 * @param {object|null} a  a gate-6 derivation
 * @param {object|null} b  a gate-6 derivation, or null for "no comparison"
 * @param {number} offset  seconds, already clamped by the compare bar
 */
export function abRecords(channels, { a = null, b = null, offset = 0 } = {}) {
    const records = {};
    const aSeries = a && a.ok === true ? a.series : null;
    const bSeries = b && b.ok === true ? b.series : null;
    for (const key of channels) {
        if (aSeries && aSeries[key]) records[key] = aSeries[key];
        if (bSeries && bSeries[key]) {
            records[comparisonKey(key)] = shiftSeriesX(bSeries[key], offset);
        }
    }
    return records;
}

/**
 * The legend's items for one plot — A's channels only, at the weight they are drawn.
 *
 * `minor` and `dash` come from the SAME `referenceSpecs` the traces are built from, so
 * the chip's weight matches the trace it stands for (§6.2, and `ui-chart-legend.js:59-60`:
 * "a minor channel's swatch is 2px here and a major one's is 3px"). This function used to
 * return `{ key, label }` alone while this docblock claimed otherwise, and all five chips
 * rendered 3px with no dash — the swatch-that-lies defect, one component further on from
 * the traces that had lost their dash for the same reason.
 *
 * The labels are the consumer's already-translated words (D2): this module holds no
 * string a person reads.
 */
export function legendItems(channels, labels = {}, treatments = null) {
    return referenceSpecs(channels, treatments).map(({ key, minor, dash }) => ({
        key,
        label: labels[key] ?? key,
        minor,
        dash,
    }));
}

/**
 * Which slot a record key belongs to. Exported for the suite, which asserts the two sets
 * partition the plot's series exactly.
 */
export function slotOfKey(key) {
    return isComparisonKey(key) ? ALIGNMENT_SLOT.MOVING : ALIGNMENT_SLOT.REFERENCE;
}

/** Every derivation key this module may be asked for. A guard, not a list to iterate. */
export const KNOWN_SERIES_KEYS = SERIES_KEYS;
