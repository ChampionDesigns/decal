/**
 * The time-tick ladder and the dash table.
 */

/**
 * Tick intervals worth landing on, in seconds. A shot is read in seconds and
 * half-minutes, so 7 s and 25 s are not useful even when they would fit
 * (`chart-uplot.js:57-59`).
 */
export const TICK_STEPS = Object.freeze([1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600]);

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

export const DASH_PATTERNS = Object.freeze({
    dot: Object.freeze([3, 3]),
    dash: Object.freeze([9, 9]),
    longdash: Object.freeze([15, 15]),
    dashdot: Object.freeze([9, 3, 3, 3]),
});

export const SERIES_LINE_CAP = 'round';
export const SERIES_LINE_JOIN = 'round';

export const SERIES_ALPHA = 1;

/** The named dash as a pattern, or `undefined` for a solid line. */
export function dashPattern(dash) {
    if (!dash) return undefined;
    const found = DASH_PATTERNS[dash];
    return found ? [...found] : undefined;
}

export function ruleDash(dash, fallback) {
    return dash === undefined ? fallback : dash;
}
