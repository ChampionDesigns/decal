/**
 * A small chart on top of uPlot, shaped like the charts this app draws.
 */

import uPlot from 'uplot';

import {
    SERIES_ALPHA, SERIES_LINE_CAP, SERIES_LINE_JOIN,
    dashPattern, ruleDash, tickStepFor, tickSplits,
} from '../lib/chart-axis.js';

const V_RULE_DASH = Object.freeze([15, 15]);
const H_RULE_DASH = Object.freeze([3, 3]);

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
                    if (label.rotate !== false) ctx.rotate(Math.PI / 2);
                    ctx.textAlign = 'left';
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

function bandsPlugin(state) {
    return {
        hooks: {
            draw: (u) => {
                const specs = state.bands;
                if (!specs || !specs.length) return;
                const ctx = u.ctx;
                const dpr = uPlot.pxRatio;
                ctx.save();
                ctx.beginPath();
                ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
                ctx.clip();
                ctx.lineJoin = SERIES_LINE_JOIN;
                ctx.lineCap = SERIES_LINE_CAP;
                for (const spec of specs) {
                    const pts = spec.points;
                    if (!pts || pts.length < 2) continue;
                    ctx.lineWidth = (spec.width || state.strokeMinor) * dpr;
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

function seriesDashPlugin(series) {
    const patterns = series.map((spec) => dashPattern(spec.dash));
    let previousRatio;
    return { hooks: { drawClear: (plot) => {
        const ratio = uPlot.pxRatio;
        if (ratio === previousRatio) return;
        previousRatio = ratio;
        patterns.forEach((pattern, index) => {
            plot.series[index + 1].dash = pattern?.map((length) => length * ratio);
        });
    } } };
}

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
    if (!(spec?.pixelRatio > 0)) problems.push('spec.pixelRatio is missing — the component owns it');
    if (!spec?.fontFamily) problems.push('spec.fontFamily is missing (read --ui-font-family)');
    if (!(spec?.tickFontPx > 0)) problems.push('spec.tickFontPx is missing (read --ui-chart-tick)');
    if (!(spec?.minTickGapPx > 0)) problems.push('spec.minTickGapPx is missing (read --ui-chart-tick-gap)');
    if (!spec?.yScale) problems.push('spec.yScale is missing');
    if (problems.length) {
        throw new TypeError(`createPlot: ${problems.join('; ')}`);
    }
}

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
            + 'the bench dpr, with .u-cursor-x static and height 0. It is still '
            + 'LIVE to input; the wave-0a "dead to input" reading was retracted as a hit-test '
            + 'artifact. Adopt the sheet with adoptStyleSheet(this.renderRoot, sheet) BEFORE '
            + 'building the plot.',
        );
    }
    return true;
}

export function createPlot(element, spec) {
    requireSpec(spec);
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
            splits: (u, _i, min, max) => tickSplits(min, max, tickStepFor(max - min, u.bbox.width / dpr, minGap)),
            values: (u, splits) => splits.map((v) => String(v)),
        },
        {
            ...axisBase,
            scale: 'y',
            size: spec.padding.left,
            side: 3,
            ...(spec.yScale.splits
                ? {
                    splits: typeof spec.yScale.splits === 'function'
                        ? spec.yScale.splits
                        : () => spec.yScale.splits,
                }
                : null),
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
        cursor: { show: spec.cursor?.show === true, drag: { x: false, y: false, setScale: false } },
        legend: { show: false },
        scales,
        axes,
        series: uSeries,
        plugins: [seriesDashPlugin(spec.series), bandsPlugin(state), marksPlugin(state), rulesPlugin(state),
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
