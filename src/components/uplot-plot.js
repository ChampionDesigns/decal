/**
 * uplot-plot.js — a small chart on top of uPlot, shaped like the charts this app
 * draws. Gate 5, the foundation every chart in the rewrite is built on
 * (CARRY_FORWARD: "the right foundation for every chart in the rewrite").
 *
 * There are nine plot surfaces and they are all the same kind of thing: a few lines
 * against time, on one or two y scales, with vertical rules at the step boundaries,
 * occasional horizontal limits, and — on the expanded and compare views — a legend you
 * can click to isolate a channel. Only the pressure/flow trajectory is different, and
 * that one is handled by drawing coloured segments directly (see `bands`).
 *
 * This module knows nothing about espresso. It takes a spec, returns a handle, and
 * every caller keeps its own data and policy. That separation is what lets a chart move
 * renderers without its meaning moving with it.
 *
 * WHY uPLOT AND NOT PLOTLY — the one number `chart-uplot.js` is kept for (CARRY_FORWARD:
 * "keep the benchmark"). Median frame on the tablet's silicon class, the real
 * seven-series scene: uPLOT 3.9 ms vs PLOTLY 29.3 ms. The file that recorded it was
 * headed "stay on Plotly", which the measurement in its own body contradicts; the header
 * is dropped and the number is carried. Two provenance corrections travel with it:
 * 3.9 ms is a TABLET figure (Galaxy Tab A9+, Chrome 151, 180 frames at a true 15 Hz),
 * not the desk/dpr-1 reading SCOPE.md:3675 and SCOPE.md:5165 call it; and the wave-0a
 * spike's desk numbers are a different measurement entirely (shadow+adopted, 3 series ×
 * 1200 samples, p95 1.4 ms at dsf 1.5 against a 66 ms frame budget). Neither closes
 * Risk 3: the ~4,500-sample shot, the P-Q per-sample loop and M4's 320 ms double-tap are
 * still unmeasured on hardware.
 *
 * WHAT THE PORT CHANGED (CARRY_FORWARD `uplot-plot.js`, 369 lines):
 *   - uPlot is IMPORTED as a module (`vendor/uPlot.esm.js` through the importmap),
 *     never read off a global. The old build installed `window.uPlot`;
 *   - the font family, the label sizes, the gutters and the tick gap are TOKENS the
 *     caller resolves and passes in (§3.8, C9). Nothing here restates a design number;
 *   - the dash table lives in `src/lib/chart-axis.js` and is one constant (§6.2). It
 *     used to be written twice, byte-identical;
 *   - `pixelRatio` is a REQUIRED spec field, read once by the component that owns the
 *     host (bug chart-C12: fifteen call sites multiplied by the GLOBAL
 *     `devicePixelRatio` while uPlot used its own cached value refreshed on
 *     `dppxchange`, and the two can diverge for a frame). The global is not referenced
 *     in this file at all;
 *   - the host is cleared with `replaceChildren()` rather than `innerHTML = ''`, which
 *     is what a host inside a shadow root wants;
 *   - it is a FACTORY with per-instance state and no hard-coded ids. It always was;
 *     the singleton was the other file's, and it is gone.
 *
 * THE CURSOR IS OFF BY DEFAULT, and the re-verify that gates turning it on HAS NOW BEEN
 * RUN. uPlot's cursor is the one place in the vendor build that mixes coordinate spaces —
 * `getBoundingClientRect()` against everything else's `clientWidth` — and
 * LAYOUT_SPEC_DRAFT.md §6.3 forbids enabling it without re-checking that maths. Part 10
 * §12 lists "enabling uPlot's own cursor without the coordinate re-verify" as a MUST NOT,
 * so the check is recorded as an executing test rather than as a paragraph:
 * `plot-surface.render.test.mjs`, "COORDINATE RE-VERIFY", drives five real CDP moves
 * across `.u-over` at BOTH Gate A geometries and asserts `cursor.left` is the pointer's x
 * inside the plotting area, `posToVal` is linear in it, and `cursor.idx` is the nearest
 * sample — the same numbers at dsf 1.5 and dsf 1. The mix of coordinate spaces is real in
 * the source and does not corrupt the result. `spec.cursor` is the seam; production
 * callers still leave it off until one of them (#9) turns it on deliberately.
 *
 * RULE 1 IS NOT THIS FILE'S JOB, but it is this file's failure. `new uPlot(...)` inside a
 * shadow root with no `uPlot.min.css` adopted renders a PIXEL-IDENTICAL canvas — 0 of
 * 648,000 pixels differ at dsf 1.5 — which then lays out at its ATTRIBUTE size,
 * `round(cssSize x pxRatio)`: it overflows its card by 450 px at the bench dpr and
 * computes `.u-cursor-x` to `position: static; height: 0`. It is NOT dead to input. The
 * wave-0a spike first read it that way, the reading was RETRACTED as a harness hit-test
 * artifact (cursor alive at both dpr, idx 743), and the render suite's POSITIVE pointer
 * sweep over both the healthy plot and the unsheeted canary is what keeps it retracted.
 * `createPlot` refuses to build unless the caller has already adopted the sheet — see
 * `assertPlotStyles`.
 */

import uPlot from 'uplot';

import {
    SERIES_ALPHA, SERIES_LINE_CAP, SERIES_LINE_JOIN,
    dashPattern, ruleDash, tickStepFor, tickSplits,
} from '../lib/chart-axis.js';

/**
 * The default rule patterns. A vertical rule with NO dash of its own is dashed; one
 * that states `[]` is SOLID and must stay solid — "a detector event is a thing the puck
 * did, drawn unbroken; `|| default` would have made it dashed like the boundaries it
 * must be told apart from" (`uplot-plot.js:65-68`).
 */
const V_RULE_DASH = Object.freeze([15, 15]);
const H_RULE_DASH = Object.freeze([3, 3]);

/**
 * Vertical rules and horizontal limits, drawn into the plot's own canvas.
 *
 * In the same pass as the series, not as positioned elements over the top: anything
 * overlaid needs its own reflow every frame, which is the cost the move to a canvas
 * renderer exists to avoid.
 */
function rulesPlugin(state) {
    return {
        hooks: {
            draw: (u) => {
                const { vRules, hRules, pixelRatio } = state;
                if (!vRules.length && !hRules.length) return;
                const ctx = u.ctx;
                ctx.save();
                ctx.beginPath();
                ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
                ctx.clip();
                for (const rule of vRules) {
                    const x = u.valToPos(rule.x, 'x', true);
                    if (!Number.isFinite(x)) continue;
                    ctx.strokeStyle = rule.color;
                    /* A RULE MAY FADE, for the same reason a series may (`SERIES_ALPHA`,
                     * chart-axis.js). The old History viewer's `stepRules()` hard-coded
                     * one dash pattern AND dropped opacity, so the second shot's step
                     * boundaries were drawn exactly like the first shot's on a chart
                     * whose entire A/B convention is "same hue, and the dash and the
                     * fade say which shot" — the rules contradicted the curves they
                     * annotate. A rule that states no alpha is fully opaque, so this
                     * changes nothing for every existing caller. */
                    ctx.globalAlpha = rule.alpha === undefined ? SERIES_ALPHA : rule.alpha;
                    ctx.lineWidth = (rule.width || state.strokeMinor) * pixelRatio;
                    const pattern = ruleDash(rule.dash, V_RULE_DASH);
                    ctx.setLineDash(pattern.map((v) => v * pixelRatio));
                    ctx.beginPath();
                    ctx.moveTo(x, u.bbox.top);
                    ctx.lineTo(x, u.bbox.top + u.bbox.height);
                    ctx.stroke();
                }
                for (const rule of hRules) {
                    const y = u.valToPos(rule.y, rule.scale || 'y', true);
                    if (!Number.isFinite(y)) continue;
                    ctx.strokeStyle = rule.color;
                    /* STATED, NOT INHERITED. `globalAlpha` is canvas state and survives
                     * the loop above, so a faded vertical rule would otherwise fade every
                     * horizontal limit after it. */
                    ctx.globalAlpha = rule.alpha === undefined ? SERIES_ALPHA : rule.alpha;
                    ctx.lineWidth = (rule.width || state.strokeMinor) * pixelRatio;
                    ctx.setLineDash(ruleDash(rule.dash, H_RULE_DASH).map((v) => v * pixelRatio));
                    ctx.beginPath();
                    ctx.moveTo(u.bbox.left, y);
                    ctx.lineTo(u.bbox.left + u.bbox.width, y);
                    ctx.stroke();
                }
                ctx.setLineDash([]);
                ctx.restore();
            },
        },
    };
}

/**
 * Rotated labels at the step boundaries.
 *
 * Read UP the boundary, which is what keeps a long step name inside its own column
 * however narrow that step is — the same reason the previous version set its labels
 * vertical.
 */
function stepLabelPlugin(state) {
    return {
        hooks: {
            draw: (u) => {
                if (!state.labels.length) return;
                const ctx = u.ctx;
                const dpr = state.pixelRatio;
                ctx.save();
                ctx.beginPath();
                ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
                ctx.clip();
                const px = state.labelFontPx * dpr;
                ctx.font = `${px}px ${state.fontFamily}`;
                ctx.textBaseline = 'middle';
                for (const label of state.labels) {
                    const x = u.valToPos(label.x, 'x', true);
                    if (!Number.isFinite(x)) continue;
                    ctx.save();
                    ctx.translate(x + 6 * dpr, u.bbox.top + 6 * dpr);
                    ctx.rotate(Math.PI / 2);
                    ctx.textAlign = 'left';
                    // A PLATE UNDER THE NAME. There is 20px of top padding and a
                    // rotated name needs about ninety, so the label has to live inside
                    // the plot — where it was laid straight across whatever the traces
                    // were doing at that second, and a busy first step is exactly where
                    // the marks cluster. The plate is the plot's own surface, so the
                    // name reads as sitting ON the chart rather than tangled in it.
                    if (state.labelPlate) {
                        const w = ctx.measureText(label.text).width;
                        ctx.fillStyle = state.labelPlate;
                        ctx.fillRect(-2 * dpr, -px * 0.62, w + 4 * dpr, px * 1.24);
                    }
                    ctx.fillStyle = label.color;
                    ctx.fillText(label.text, 0, 0);
                    ctx.restore();
                }
                ctx.restore();
            },
        },
    };
}

/**
 * Coloured segments along a path — the pressure/flow trajectory's time key.
 *
 * The old renderer split the path into 24 banded line traces because feeding raw points
 * to a colour scale was too slow. Drawn directly there is no reason to band it at all:
 * each segment takes its own colour, and the key beside it is a gradient strip rather
 * than a chart library's colourbar.
 */
function bandsPlugin(state) {
    return {
        hooks: {
            draw: (u) => {
                const specs = state.bands;
                if (!specs || !specs.length) return;
                const ctx = u.ctx;
                const dpr = state.pixelRatio;
                ctx.save();
                ctx.beginPath();
                ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
                ctx.clip();
                /* THE SAME TWO CONSTANTS EVERY OTHER SERIES IS STROKED WITH (chart-C7).
                 * These used to be the string 'round' written here and nowhere else,
                 * which is the whole defect: the trajectory had the cap the dead Plotly
                 * sheet asked for and no other series did. */
                ctx.lineJoin = SERIES_LINE_JOIN;
                ctx.lineCap = SERIES_LINE_CAP;
                for (const spec of specs) {
                    const pts = spec.points;
                    if (!pts || pts.length < 2) continue;
                    ctx.lineWidth = (spec.width || state.strokeMinor) * dpr;
                    // A dashed path is how the SECOND shot is told from the first. The
                    // compare view draws two trajectories in the same time colours, and
                    // without this they are one line: colour is already carrying time,
                    // so it cannot also carry which shot this is.
                    ctx.setLineDash((spec.dash || []).map((v) => v * dpr));
                    ctx.globalAlpha = spec.alpha === undefined ? SERIES_ALPHA : spec.alpha;
                    for (let i = 1; i < pts.length; i += 1) {
                        const a = pts[i - 1];
                        const b = pts[i];
                        if (!Number.isFinite(a.x) || !Number.isFinite(a.y)
                            || !Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
                        ctx.strokeStyle = spec.colorAt(b.t);
                        ctx.beginPath();
                        ctx.moveTo(u.valToPos(a.x, 'x', true), u.valToPos(a.y, 'y', true));
                        ctx.lineTo(u.valToPos(b.x, 'x', true), u.valToPos(b.y, 'y', true));
                        ctx.stroke();
                    }
                }
                ctx.globalAlpha = 1;
                ctx.setLineDash([]);
                ctx.restore();
            },
        },
    };
}

/**
 * POINT MARKS, and the faint text beside them — the P-Q trajectory's correspondence
 * marks (Q16) and anything else that has to say "this spot, here".
 *
 * Slate drew these as four Plotly MARKER TRACES with `mode: 'markers+text'`
 * (`history-viewer.js:330-402`) and they had zero callers, so the mechanism they needed
 * never existed on this side either: `rulesPlugin` draws a line at an x, `bandsPlugin`
 * draws a path, and neither can put a mark at an (x, y). This is that third thing, in the
 * same pass as the series and the same clip as the rules, because anything overlaid as a
 * positioned element needs its own reflow every frame.
 *
 * `{ x, y, kind, color, size, text, textColor, scale }`:
 *   kind 'dot'   a filled disc      — the reference shot's instants
 *   kind 'ring'  a stroked circle   — the comparison's, hollow so the two never merge
 * `size` is the DIAMETER in CSS px and is the caller's (a token, read once); `scale`
 * names the y scale the mark belongs to, defaulting to 'y' like a series does.
 */
function marksPlugin(state) {
    return {
        hooks: {
            draw: (u) => {
                const marks = state.marks;
                if (!marks || !marks.length) return;
                const ctx = u.ctx;
                const dpr = state.pixelRatio;
                ctx.save();
                ctx.beginPath();
                ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
                ctx.clip();
                ctx.font = `${state.endLabelFontPx * dpr}px ${state.fontFamily}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'alphabetic';
                for (const mark of marks) {
                    const x = u.valToPos(mark.x, 'x', true);
                    const y = u.valToPos(mark.y, mark.scale || 'y', true);
                    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
                    const r = ((mark.size || state.strokeMinor * 3) / 2) * dpr;
                    ctx.beginPath();
                    ctx.arc(x, y, r, 0, Math.PI * 2);
                    if (mark.kind === 'ring') {
                        ctx.lineWidth = (mark.width || state.strokeMinor) * dpr;
                        ctx.setLineDash([]);
                        ctx.strokeStyle = mark.color;
                        ctx.stroke();
                    } else {
                        ctx.fillStyle = mark.color;
                        ctx.fill();
                    }
                    if (mark.text) {
                        ctx.fillStyle = mark.textColor || mark.color;
                        ctx.fillText(mark.text, x, y - r - 4 * dpr);
                    }
                }
                ctx.restore();
            },
        },
    };
}

/**
 * The series name at the end of its own line.
 *
 * The espresso charts drop these — they duplicate the KPI strip above them. The steam
 * view keeps them: it has no legend and no strip, so two lines on two different axes
 * would otherwise be unlabelled. Collisions are resolved by pushing labels apart
 * vertically, the same rule the old renderer used.
 */
function endLabelPlugin(state) {
    return {
        hooks: {
            draw: (u) => {
                if (!state.endLabels || !state.endLabels.length) return;
                const ctx = u.ctx;
                const dpr = state.pixelRatio;
                ctx.save();
                ctx.font = `${state.endLabelFontPx * dpr}px ${state.fontFamily}`;
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'left';
                const placed = [];
                const minGap = state.endLabelFontPx * 1.2 * dpr;
                for (const label of state.endLabels) {
                    let y = u.valToPos(label.y, label.scale || 'y', true);
                    const x = u.valToPos(label.x, 'x', true);
                    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
                    // Push down off anything already placed, so two lines that finish
                    // at the same value do not print over each other.
                    for (const taken of placed) {
                        if (Math.abs(y - taken) < minGap) y = taken + minGap;
                    }
                    placed.push(y);
                    ctx.fillStyle = label.color;
                    ctx.fillText(label.text, x + 6 * dpr, y);
                }
                ctx.restore();
            },
        },
    };
}

/**
 * One y scale, from the caller's `{ range | auto }`.
 *
 * `range` IS uPlot's own range contract and is handed over UNCHANGED — either
 * `[min, max]` or `(self, dataMin, dataMax, key) => [min, max]`. The vendor build
 * normalises it once at construction (`sc.range = fnOrSelf(rn)`, `vendor/uPlot.esm.js`
 * :3063, with `sc.auto = rangeIsArr ? false : sc.auto` at :3068) and then reads the
 * result POSITIONALLY everywhere after that — `wsc.min = minMax[0]` at :4028, :4053,
 * :4109, :4131 and :4936.
 *
 * IT USED TO BE DOUBLE-WRAPPED — `range: () => spec.yScale.range` — so when a caller
 * passed a function (which `PlotSurfaceElement.yScaleSpec()` does, and the spec block
 * below documents) uPlot's `range()` returned THE FUNCTION, and a function has no `[0]`.
 * MEASURED against this vendor build: an array range gives `{min: 0, max: 7}`, the same
 * spec written as `() => [0, 7]` gave `{min: null, max: null}`, with ZERO page errors.
 * The left axis only looked right because `PlotSurfaceElement.#draw()` follows every
 * `setData` with an explicit `setScale('y', …)`; nothing calls `setScale('y2')`, so the
 * first two-scale chart — the steam view, and #9's `y2ScaleSpec` seam — came up with a
 * silently unranged right-hand axis.
 */
function scaleFor(scaleSpec) {
    return scaleSpec?.range ? { auto: false, range: scaleSpec.range } : { auto: true };
}

/** Everything a plot needs that has no sensible default, checked in one place. */
function requireSpec(spec) {
    const problems = [];
    if (!spec) problems.push('no spec');
    if (!spec?.series?.length) problems.push('spec.series is empty');
    if (!spec?.colors) problems.push('spec.colors is missing (read the four --ui-chart-* surface tokens)');
    if (!spec?.padding) problems.push('spec.padding is missing (read the four --ui-chart-gutter-* tokens)');
    if (!(spec?.pixelRatio > 0)) problems.push('spec.pixelRatio is missing — the component owns it (bug chart-C12)');
    if (!spec?.fontFamily) problems.push('spec.fontFamily is missing (read --ui-font-family, C9)');
    if (!(spec?.tickFontPx > 0)) problems.push('spec.tickFontPx is missing (read --ui-chart-tick)');
    if (!(spec?.minTickGapPx > 0)) problems.push('spec.minTickGapPx is missing (read --ui-chart-tick-gap)');
    if (!spec?.yScale) problems.push('spec.yScale is missing');
    if (problems.length) {
        throw new TypeError(`createPlot: ${problems.join('; ')}`);
    }
}

/**
 * RULE 1, enforced at the one moment it can still be enforced.
 *
 * The spike measured what a missing `uPlot.min.css` costs inside a shadow root: the
 * canvas is pixel-identical to the control (0 of 648,000 pixels differ at dsf 1.5), so
 * no screenshot gate can see it, while `.uplot canvas` lays out at its ATTRIBUTE size —
 * `round(cssSize x pxRatio)` — and overflows its card by 450 px to the right at the
 * bench tablet's dpr, with `.u-cursor-x` computing to `position: static; height: 0`.
 * Lit's `static styles` compiles to `adoptedStyleSheets`, and `adoptStyleSheet()` in
 * `base.js` is the fallback for a runtime-fetched sheet; either way the sheet must be
 * in THIS root before the plot is built.
 *
 * `root` is a ShadowRoot or a Document. A light-DOM host is allowed (the document's own
 * `<link>` covers it) — only a shadow root can silently lose the sheet.
 */
export function assertPlotStyles(root) {
    if (!root || typeof root.host === 'undefined' || root.host === undefined) return true;
    const sheets = Array.from(root.adoptedStyleSheets ?? []);
    const hasUplotRule = sheets.some((sheet) => {
        let rules;
        try {
            rules = sheet.cssRules;
        } catch {
            return false;                       // cross-origin sheet: cannot inspect
        }
        for (let i = 0; i < rules.length; i += 1) {
            const selector = rules[i].selectorText;
            if (typeof selector === 'string' && selector.includes('.uplot')) return true;
        }
        return false;
    });
    if (!hasUplotRule) {
        throw new Error(
            'createPlot: uPlot.min.css is not in this shadow root\'s adoptedStyleSheets. '
            + 'Without it the canvas still paints — pixel-identical, 0 of 648,000 pixels differ — '
            + 'while laying out at its ATTRIBUTE size: 1.5x oversized and 450px past its card at '
            + 'the bench dpr, with .u-cursor-x static and height 0 (Part 8 §3 Rule 1). It is still '
            + 'LIVE to input; the wave-0a "dead to input" reading was retracted as a hit-test '
            + 'artifact. Adopt the sheet with adoptStyleSheet(this.renderRoot, sheet) BEFORE '
            + 'building the plot.',
        );
    }
    return true;
}

/**
 * Build a plot.
 *
 * ```
 * spec = {
 *   series:  [{ label, color, width, dash, alpha, scale, show }]  // colour from a token
 *       — `dash` names a pattern in `chart-axis.js`'s one table; `alpha` defaults to
 *         SERIES_ALPHA and carries the A/B "same hue, dashed, faded" convention. The
 *         CAP is not a spec field at all: it is one constant applied to every series
 *         and to the banded path alike (chart-C7).
 *   yScale:  { range | auto, format, splits, keepZeroLabel } // left axis
 *   y2Scale: { range, format }                              // right axis, optional
 *       range = [min, max]  OR  (self, dataMin, dataMax, key) => [min, max]
 *       — uPlot's own contract, passed through unchanged (see `scaleFor`). uPlot
 *         evaluates a function range at CONSTRUCTION and on an auto re-range, not on
 *         every frame; a range that MOVES is driven by `setScale` instead.
 *   xLabel, showXLabels
 *   colors:  { grid, axis, font, plate }                    // the surface tokens
 *   padding: { top, right, bottom, left }                   // the gutter tokens
 *   fontFamily, tickFontPx, labelFontPx, endLabelFontPx     // C9 + §3.8
 *   strokeMinor, minTickGapPx, pixelRatio
 *   cursor:  { show }                                       // OFF unless re-verified
 * }
 * ```
 *
 * `element` is the plot host and must have NO PADDING of its own: uPlot sizes from
 * `clientWidth`/`clientHeight`, which is the padding box, and a padded host overflows
 * by exactly its padding (§6.1 rule 1, measured at 32 px on the profile preview).
 */
export function createPlot(element, spec) {
    requireSpec(spec);
    // `allowMissingStyles` exists for ONE caller: the Rule 1 canary, which has to build
    // an unsheeted plot in order to measure that the mount-C signature still
    // discriminates (Gate C's rule — every guard ships with a canary that fires). No
    // production path may set it.
    if (spec.allowMissingStyles !== true) assertPlotStyles(element.getRootNode?.());

    const state = {
        vRules: [],
        hRules: [],
        labels: [],
        bands: [],
        marks: [],
        endLabels: [],
        pixelRatio: spec.pixelRatio,
        fontFamily: spec.fontFamily,
        labelFontPx: spec.labelFontPx ?? spec.tickFontPx,
        endLabelFontPx: spec.endLabelFontPx ?? spec.tickFontPx,
        strokeMinor: spec.strokeMinor ?? 2,
        // The plot's own ground, for the step-name plates.
        labelPlate: spec.colors.plate ?? null,
    };

    const colors = spec.colors;
    const dpr = spec.pixelRatio;
    const minGap = spec.minTickGapPx;
    const tickFont = `${spec.tickFontPx}px ${spec.fontFamily}`;
    const width = Math.max(1, element.clientWidth);
    const height = Math.max(1, element.clientHeight);

    const axisBase = {
        stroke: colors.label ?? colors.font,
        font: tickFont,
        grid: { stroke: colors.grid, width: 1 },
        ticks: { stroke: colors.axis ?? colors.grid, width: 1, size: 5 },
    };

    /* EVERY SERIES, ONE TREATMENT — bug chart-C7.
     *
     * `dash` was already uniform: it comes from `chart-axis.js`'s one table through
     * `dashPattern`. `cap` and `alpha` were NOT, and that is the defect: the cap was two
     * `ctx` lines inside `bandsPlugin` and nowhere else, so the P-Q trajectory rendered
     * with the rounded ends the (dead) Plotly sheet asked for while every ordinary trace
     * on every chart in the app was stroked butt-ended by uPlot's own default. uPlot
     * reads `series[i].cap` and `series[i].alpha` per series (vendor `setCtxStyle` /
     * `drawSeries`), so the fix is to say it here, once, for all of them.
     *
     * ALPHA CARRIES THE A/B CONVENTION. A comparison draws B in A's hue, dashed and
     * slightly faded; without a per-series alpha the fade has nowhere to live and the
     * distinction collapses onto the dash alone — which is Slate's `stepRules()` defect
     * ("hard-codes one dash pattern and drops opacity") arriving from the other side. A
     * series that states none is `SERIES_ALPHA`, so no existing chart moves. */
    const uSeries = [{}];
    for (const s of spec.series) {
        uSeries.push({
            label: s.label,
            stroke: s.color,
            width: s.width ?? state.strokeMinor,
            dash: dashPattern(s.dash),
            cap: SERIES_LINE_CAP,
            alpha: s.alpha === undefined ? SERIES_ALPHA : s.alpha,
            scale: s.scale || 'y',
            points: { show: false },
            spanGaps: false,
            show: s.show !== false,
        });
    }

    // `range` goes to uPlot untouched, array or function alike — see `scaleFor`.
    const scales = {
        x: { time: false, auto: false },
        y: scaleFor(spec.yScale),
    };
    if (spec.y2Scale) scales.y2 = scaleFor(spec.y2Scale);

    const axes = [
        {
            ...axisBase,
            size: spec.padding.bottom,
            show: spec.showXLabels !== false,
            label: spec.xLabel,
            labelSize: spec.xLabel ? 26 : 0,
            labelFont: tickFont,
            // bbox is in CANVAS px; the ladder is chosen in CSS px, so it is divided by
            // this plot's own ratio and never by the global (bug chart-C12).
            splits: (u, _i, min, max) => tickSplits(min, max, tickStepFor(max - min, u.bbox.width / dpr, minGap)),
            values: (u, splits) => splits.map((v) => String(v)),
        },
        {
            ...axisBase,
            scale: 'y',
            size: spec.padding.left,
            side: 3,
            /* WHERE THE LEFT TICKS GO, when the caller knows better than uPlot does.
             *
             * Unstated, uPlot picks its own ladder from the range, which is right for
             * every linear axis in the app. A LOG axis is the exception and it is not an
             * exception uPlot can see: the values on it are log10 and the range is in
             * log10 units, so uPlot's even ladder lands on 0.1, 0.2, 0.3 of a DECADE and
             * labels them as unrelated real numbers. The caller that transformed the data
             * is the only one that can say where a tick belongs, so it may
             * (`history-power.js`'s `derivedTickValues`). */
            ...(spec.yScale.splits ? { splits: () => spec.yScale.splits } : null),
            // The zero label is DROPPED unless the scale asks for it. It sits on the
            // axis line at the plot's bottom edge, where the chart card's overflow takes
            // its lower half — and the axis line is the zero. A scale that does not
            // start at zero (temperature) never produces one, so this costs those plots
            // nothing.
            values: (u, splits) => splits.map((v) => {
                if (v === 0 && !spec.yScale.keepZeroLabel) return '';
                return spec.yScale.format ? spec.yScale.format(v) : String(v);
            }),
        },
    ];
    if (spec.y2Scale) {
        axes.push({
            ...axisBase,
            scale: 'y2',
            size: spec.padding.right,
            side: 1,
            grid: { show: false },
            values: spec.y2Scale.format
                ? (u, splits) => splits.map(spec.y2Scale.format)
                : undefined,
        });
    }

    const opts = {
        width,
        height,
        padding: [spec.padding.top, spec.y2Scale ? 8 : spec.padding.right, 0, 0],
        // OFF. See the header: enabling it requires re-verifying uPlot's coordinate
        // handling, which mixes getBoundingClientRect() with clientWidth.
        cursor: { show: spec.cursor?.show === true, drag: { x: false, y: false, setScale: false } },
        // The legend is a component of its own (#10) and part of the layout, not a
        // sibling inserted after the plot has measured its host (bug chart-C10).
        legend: { show: false },
        scales,
        axes,
        series: uSeries,
        plugins: [bandsPlugin(state), marksPlugin(state), rulesPlugin(state),
            stepLabelPlugin(state), endLabelPlugin(state)],
    };

    element.replaceChildren();
    const plot = new uPlot(opts, [[], ...spec.series.map(() => [])], element);

    return {
        get raw() { return plot; },
        state,
        /** Replace the data. `data` is `[xs, ...series]`, aligned by index. */
        setData(data, xRange) {
            plot.batch(() => {
                plot.setData(data, false);
                if (xRange) plot.setScale('x', { min: xRange[0], max: xRange[1] });
            });
        },
        /** Move a scale without touching the data — the damped y ceiling's road in. */
        setScale(key, range) {
            plot.batch(() => plot.setScale(key, { min: range[0], max: range[1] }));
        },
        setRules({ vertical = [], horizontal = [], labels = [] } = {}) {
            state.vRules = vertical;
            state.hRules = horizontal;
            state.labels = labels;
        },
        setBands(bands) { state.bands = bands ? [].concat(bands) : []; },
        setMarks(marks) { state.marks = marks ? [].concat(marks) : []; },
        setEndLabels(labels) { state.endLabels = labels || []; },
        setSeriesVisible(index, visible) { plot.setSeries(index + 1, { show: visible }); },
        isSeriesVisible(index) { return plot.series[index + 1].show !== false; },
        ownsElement(el) { return el === element; },
        /** Per-host size. The caller's ResizeObserver decides WHEN; this is only HOW. */
        resize(el) {
            const target = el || element;
            const w = Math.max(1, target.clientWidth);
            const h = Math.max(1, target.clientHeight);
            if (w !== plot.width || h !== plot.height) plot.setSize({ width: w, height: h });
        },
        /** Draw NOW rather than on uPlot's microtask — the spike's timing trap. */
        flush() {
            plot.batch(() => {});
        },
        destroy() { try { plot.destroy(); } catch { /* already gone */ } },
    };
}
