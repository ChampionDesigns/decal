/**
 * chart-axis.js — the time-tick ladder and the dash table. Gate 5.
 *
 * PORTED FROM two files that each held a copy: `uplot-plot.js:20-40` and
 * `chart-uplot.js:56-103`. The dash table was byte-identical in both
 * (LAYOUT_SPEC_DRAFT.md §6.2: "the dash table ... is one exported constant. It is
 * currently written twice, byte-identical"); `tickStepFor` was NOT — `uplot-plot.js:24`
 * took a third `minGap` parameter the other lacked, "so a naive de-duplication would
 * drop the wrong copy" (`layout/charts.md` AV-10). The parameterised one survives, and
 * the parameter is now REQUIRED (see below).
 *
 * DOM-FREE, so `node:test` imports it directly (src/lib/README.md).
 *
 * WHY `minGap` HAS NO DEFAULT HERE. 170 is declared once, in CSS, as
 * `--ui-chart-tick-gap` (tokens.css §3.8, sourced from `chart-uplot.js:63` /
 * `uplot-plot.js:21` — "the 170px minimum gap between time ticks, written twice
 * today"). A default in this file would be a third declaration of the same number and
 * would go stale silently the first time the token moved, which is the exact defect
 * §3.8's header names ("Never two declarations of one number"). So the caller reads the
 * token and passes it, and a caller that forgets throws rather than quietly drawing a
 * ladder nobody chose.
 */

/**
 * Tick intervals worth landing on, in seconds. A shot is read in seconds and
 * half-minutes, so 7 s and 25 s are not useful even when they would fit
 * (`chart-uplot.js:57-59`).
 */
export const TICK_STEPS = Object.freeze([1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600]);

/**
 * The coarsest interval that keeps every tick at least `minGap` CSS px apart.
 *
 * A 20 s shot and a 2 minute shot then get a comparable NUMBER of ticks rather than a
 * comparable interval, which is what a fixed `dtick` could not do: 10 s ticks gave a
 * short shot two labels and a long one twelve (`chart-uplot.js:60-63`).
 *
 * `plotWidthPx` is in CSS pixels, NOT canvas pixels: the caller divides the uPlot bbox
 * by its own pixel ratio before calling (bug chart-C12 — one pixelRatio, owned by the
 * component; never the global).
 */
export function tickStepFor(span, plotWidthPx, minGap) {
    if (!(typeof minGap === 'number' && minGap > 0)) {
        throw new TypeError(
            'tickStepFor: minGap is required and must be a positive number of CSS px — '
            + 'read it from --ui-chart-tick-gap; this module does not restate the token',
        );
    }
    if (!(span > 0) || !(plotWidthPx > 0)) return TICK_STEPS[0];
    const maxTicks = Math.max(2, Math.floor(plotWidthPx / minGap));
    for (const step of TICK_STEPS) if (span / step <= maxTicks) return step;
    return TICK_STEPS[TICK_STEPS.length - 1];
}

/**
 * Every tick between `min` and `max` on that ladder, inclusive of the ends that land
 * on it. Lifted out of the axis `splits` closure so it can be tested without a plot.
 */
export function tickSplits(min, max, step) {
    const out = [];
    if (!(step > 0) || !(max >= min)) return out;
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) {
        out.push(+v.toFixed(6));
    }
    return out;
}

/**
 * THE dash table. One exported constant, per LAYOUT_SPEC_DRAFT.md §6.2.
 *
 * "The old renderer named its dashes; uPlot wants the pattern. Values measured from its
 * own rendered SVG so nothing changed rhythm in the swap" (`uplot-plot.js:31-32`).
 *
 * Numbers, not tokens: a dash pattern is a rhythm in the same space as the stroke
 * width, and §3.8 tokenises the STROKE (`--ui-chart-stroke`, `-minor`) rather than the
 * pattern. A fork retargeting the rhythm edits this one object.
 */
export const DASH_PATTERNS = Object.freeze({
    dot: Object.freeze([3, 3]),
    dash: Object.freeze([9, 9]),
    longdash: Object.freeze([15, 15]),
    dashdot: Object.freeze([9, 3, 3, 3]),
});

/**
 * THE STROKE CAP AND JOIN, ONCE — bug chart-C7's other half.
 *
 * §7.8 C7: "the rounded-cap intent behind it is real, and uPlot applies it ONLY inside
 * `bandsPlugin`, so the trajectory has round caps and no other series does". The old
 * skin expressed the intent as `stroke-linecap: round` in Plotly CSS that no longer
 * renders anything, and the port carried the plugin's two `ctx` lines across without the
 * series path — so a trajectory that was not even in v1 at the time was the one thing
 * drawn with the cap the sheet asked for. (The trajectory ships now, on the power page,
 * and it is stroked with these two constants like everything else — which is the whole
 * point of them being here rather than in the plugin.)
 *
 * So the cap lives HERE, beside the dash table, for the reason the dash table is here:
 * both are the same decision about how a stroke ends, and a chart that hand-matched one
 * of them across a file boundary is exactly the defect. `uplot-plot.js` reads these two
 * constants in BOTH places it strokes — the series it builds for every plot, and the
 * banded trajectory path — so "uniformly across every series" is a property of there
 * being one declaration rather than of two of them agreeing.
 *
 * Not tokens: a cap is a rhythm in the same space as the stroke width and the dash
 * pattern, and §3.8 tokenises the WIDTH (`--ui-chart-stroke`) and not the rhythm.
 */
export const SERIES_LINE_CAP = 'round';
export const SERIES_LINE_JOIN = 'round';

/**
 * The alpha a series is stroked at when it states none.
 *
 * OPACITY IS PART OF THE A/B CONVENTION AND IS NOT TO BE FLATTENED. The old viewer drew
 * B at `opacity: 0.72` (`history-viewer.js:233`) while `stepRules()` hard-coded one dash
 * pattern and dropped opacity altogether — the counted defect that flattens the very
 * distinction its own docblock argues for. A series that states no alpha is fully
 * opaque, so naming the default here changes nothing for a plot that never asks.
 */
export const SERIES_ALPHA = 1;

/** The named dash as a pattern, or `undefined` for a solid line. */
export function dashPattern(dash) {
    if (!dash) return undefined;
    const found = DASH_PATTERNS[dash];
    return found ? [...found] : undefined;
}

/**
 * The DEFAULT vertical-rule pattern, used when a rule states no dash of its own.
 *
 * An EMPTY array means SOLID and must survive: "a detector event is a thing the puck
 * did, drawn unbroken; `|| default` would have made it dashed like the boundaries it
 * must be told apart from" (`uplot-plot.js:65-68`). So callers test for `undefined`,
 * never for falsiness — `ruleDash` below is that test, written once.
 */
export function ruleDash(dash, fallback) {
    return dash === undefined ? fallback : dash;
}
