/**
 * history-compare.js — two shots on one clock. Wave 5.6, row `hist-port-history-viewer`.
 *
 * THE TWO SUBTLEST THINGS IN THE OLD MODULE LIVE HERE, and they are the reason the
 * History carry was estimated 1.75x low: `drawCompareData`'s UNION-AXIS INTERPOLATION
 * over two shots with different sample clocks, and `resampleOnto`, the function that
 * put a channel onto that axis.
 *
 * DOM-free, so `node:test` imports it directly (`src/lib/README.md`). It opens no
 * endpoint, holds no state, and knows nothing about a component.
 *
 * ===========================================================================
 * COMPARISON IS BUILT OUTSIDE THE RENDERER, AND THAT IS THE ARCHITECTURE PORTED
 * ===========================================================================
 * The old viewer's own note is the one thing about it worth keeping verbatim in spirit:
 * everything built INSIDE the live renderer failed silently. The alignment slider is the
 * proof — it reached into the live plot, found B's traces by a `meta.slot === 'b'` tag,
 * rewrote their x arrays in place, addressed one index past the end, threw, and a catch
 * swallowed the throw. The control did nothing at all and nothing said so.
 *
 * So: nothing in this file touches a plot, a card or a canvas. It answers questions
 * about two derivations and a number, and a caller draws the answer. `ui-chart-card` is
 * not imported here and must not be — folding the comparison path into the chart
 * component is the block this row exists to avoid.
 *
 * ===========================================================================
 * ONE INTERPOLATION POLICY, AND IT IS NOT DECLARED HERE
 * ===========================================================================
 * `resampleOnto` below is the port's replacement for the defective function of that
 * name, and it is written in the DEFECTIVE FUNCTION'S OWN SIGNATURE — `resample(axis,
 * srcX, srcY)` returning one column — because that is the shape `gap-contract.js`'s
 * `checkResampler` holds a port to, so the replacement is checkable as it is written
 * rather than after it has been wrapped in something.
 *
 * What it does NOT do is decide the policy. The interpolation is `chart-align.js`'s
 * `bridgeUnspoken`, called once, because the two meanings of null are a policy and a
 * second implementation of a policy is two policies that agree until they do not. Gate
 * 5 already ships it, `test/chart-align.test.mjs` already pins it, and the gap contract
 * proves the same seven claims against BOTH this function and `alignChannels` — which
 * is what "one policy" means when it is checkable rather than asserted.
 *
 * THE DEFECT THIS REPLACES, named so the drop reads as a removal:
 * Slate's `resampleOnto` (`history-viewer.js:627`) HOLDS THE LAST VALUE ACROSS A GAP.
 * When the next source sample carries a non-number it writes the PREVIOUS reading into
 * the slot, so (a) a gated instant inherits the value from before the gate and the line
 * runs flat through a stretch the channel had nothing to say about, and (b) the first
 * real reading AFTER a gate is dropped, because by then the walk's left edge sits on the
 * null and the "y0 is not a number" branch skips the slot. The same defect invents data
 * and loses it. Here a gated null is a break, `uplot-plot.js` sets `spanGaps: false`,
 * and the gap renders.
 *
 * ===========================================================================
 * THE UNION CLOCK
 * ===========================================================================
 * Two recorded shots do not share an x array: different lengths, different sample
 * instants, and B slid by the alignment offset on top. The union clock is every instant
 * either shot spoke at, sorted once; every reading then lands ON a slot, so putting a
 * channel on it loses nothing and invents nothing. That property is what makes the
 * resampler's job honest — it is never asked for an instant nobody sampled — and
 * `resampleOnto` handles the general case anyway rather than assuming it.
 *
 * WHAT IS NOT HERE, AND WHERE IT WENT. The P-Q trajectory and the correspondence marks
 * are `history-power.js`'s (fix run 6), not this module's — the trajectory is
 * D1's later phase and the marks are Q16, open and explicitly not a v1 blocker. Slate
 * paired flow against pressure BY INDEX to build them (`trajectoryPoints`,
 * `history-viewer.js:748`) while the DEAD path beside it used `pairSeriesByX` correctly
 * — one of the six counted defects handed over as specification input. It dies by
 * construction: this module has exactly one way to put two series in correspondence and
 * it is the union clock, which is pairing BY X. There is no index pairing to get wrong
 * because there is no index pairing.
 */

import { bridgeUnspoken } from './chart-align.js';
import { shiftSeriesX } from './shot-derivation.js';

/** An empty column is answered with this, so a caller never has to test for null. */
const EMPTY = Object.freeze([]);

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/* ───────────────────────────────────────────────────────────── the resampler */

/**
 * One channel onto one clock — the port's replacement for `resampleOnto`.
 *
 * @param {number[]} axis  the instants a column is wanted at, ascending
 * @param {number[]} srcX  the channel's own instants, ascending
 * @param {Array<number|null>} srcY  what it said at each of them; `null` means it SPOKE
 *        and said nothing was there, which is a break and never a value to hold
 * @returns {Array<number|null>} one entry per axis slot
 *
 * HOW A SOURCE INSTANT THAT IS NOT ON THE AXIS IS HANDLED, and it is not a special case.
 * The column is built on the axis UNION the source's own instants, bridged there, and
 * then read back at the requested slots. On the union clock — the only clock this module
 * ever forms — the two are the same array and the extra work is one `Set` that finds
 * nothing to add. Off it, the answer is still the policy's: a slot strictly between two
 * real readings is interpolated from THOSE READINGS, whether or not they happen to be
 * axis slots, and a slot outside the channel's span stays null. Placing an off-grid
 * reading on its nearest slot would move a measurement to an instant it was not taken
 * at, which is the same class of lie as holding a value across a gate.
 */
export function resampleOnto(axis, srcX, srcY) {
    const wanted = Array.isArray(axis) ? axis : EMPTY;
    if (!wanted.length) return [];
    const xs = Array.isArray(srcX) ? srcX : EMPTY;
    const ys = Array.isArray(srcY) ? srcY : EMPTY;
    if (!xs.length) return new Array(wanted.length).fill(null);

    /* The clock the bridge runs on: every wanted instant plus every instant the channel
     * spoke at, so no reading is dropped for want of a slot to sit in. */
    const merged = new Set(wanted);
    let offGrid = false;
    for (const at of xs) {
        if (!merged.has(at)) { merged.add(at); offGrid = true; }
    }
    const clock = offGrid ? [...merged].sort((a, b) => a - b) : wanted;

    const index = new Map();
    for (let i = 0; i < clock.length; i += 1) index.set(clock[i], i);

    const column = new Array(clock.length).fill(null);
    /* Which slots the channel SPOKE ABOUT — including the ones it spoke about by saying
     * null. That distinction is the whole policy and it is why `spoken` is a second
     * array rather than a test on the value. */
    const spoken = new Array(clock.length).fill(false);
    for (let i = 0; i < xs.length && i < ys.length; i += 1) {
        const at = index.get(xs[i]);
        if (at === undefined) continue;
        column[at] = isNumber(ys[i]) ? ys[i] : null;
        spoken[at] = true;
    }

    bridgeUnspoken(clock, column, spoken);
    if (!offGrid) return column;
    return wanted.map((at) => {
        const found = index.get(at);
        return found === undefined ? null : column[found];
    });
}

/* ───────────────────────────────────────────────────────── the union clock */

/**
 * Every instant any of these bundles spoke at, once, ascending.
 *
 * @param {Array<{x: number[]}|null|undefined>} bundles
 * @returns {number[]}
 */
export function unionClock(bundles) {
    const union = new Set();
    for (const bundle of bundles ?? EMPTY) {
        if (!bundle || !Array.isArray(bundle.x)) continue;
        for (const at of bundle.x) if (isNumber(at)) union.add(at);
    }
    return [...union].sort((a, b) => a - b);
}

/**
 * The comparison, on one clock — `drawCompareData`'s content, outside the renderer.
 *
 * A's series are taken AS THEY ARE; B's are slid by the offset first, through
 * `shiftSeriesX`, which returns a new x array and never mutates the bundle ("both shots
 * in a comparison are re-read on every redraw and an in-place shift would compound every
 * time the slider moved"). A does not move. That is not a convention, it is the
 * definition of the reference slot.
 *
 * @param {object} options
 * @param {string[]} options.channels  derivation SERIES_KEYS, in draw order
 * @param {object|null} options.a      a gate-6 derivation, or null
 * @param {object|null} options.b      a gate-6 derivation, or null for "no comparison"
 * @param {number} options.offset      seconds, already clamped by the compare bar
 * @returns {{axis: number[], columns: object, keys: string[], slots: object}}
 *   `columns` is keyed by channel for A and by `<channel>` under `slots.b` for B; every
 *   column has one entry per axis slot.
 */
export function compareOnOneClock({ channels = EMPTY, a = null, b = null, offset = 0 } = {}) {
    const aSeries = a && a.ok === true ? a.series : null;
    const bSeries = b && b.ok === true ? b.series : null;
    const shift = Number.isFinite(offset) ? offset : 0;

    const bundles = [];
    const sources = [];
    for (const key of channels) {
        const fromA = aSeries?.[key] ?? null;
        const fromB = bSeries?.[key] ? shiftSeriesX(bSeries[key], shift) : null;
        if (fromA) bundles.push(fromA);
        if (fromB) bundles.push(fromB);
        sources.push({ key, a: fromA, b: fromB });
    }

    const axis = unionClock(bundles);
    const columns = {};
    const bColumns = {};
    for (const source of sources) {
        if (source.a) columns[source.key] = resampleOnto(axis, source.a.x, source.a.y);
        if (source.b) bColumns[source.key] = resampleOnto(axis, source.b.x, source.b.y);
    }
    return {
        axis,
        columns,
        keys: sources.filter((s) => s.a || s.b).map((s) => s.key),
        slots: { a: columns, b: bColumns },
    };
}

/**
 * The x window a comparison actually occupies — bug-shaped, and the reason it exists.
 *
 * `plot-surface.js` used to open the x scale at a hard `[0, max]`. A shot has no samples
 * before its own origin, so for one shot that is exactly right; for a COMPARISON it is
 * not, because B slid to the negative end of the +/-5 s limit runs to -5 s and everything
 * left of zero is clipped off the plot. The slider moves, part of the trace vanishes, and
 * nothing raises — the same shape of silence the ported test exists for. So the window is
 * computed here, from the drawn data, and handed to the plot as `x-min` / `x-max`.
 *
 * FROM THE COLUMNS, NOT FROM THE RAW x ARRAYS: a channel's leading and trailing slots can
 * be null (there is nothing to interpolate from outside its own span), and a window that
 * spanned an instant where nothing is drawn would open empty space at one end.
 *
 * @returns {{min: number, max: number, span: number, empty: boolean}}
 */
export function comparisonWindow(compared) {
    const axis = compared?.axis ?? EMPTY;
    const columns = compared?.columns ?? {};
    const bColumns = compared?.slots?.b ?? {};
    let min = null;
    let max = null;
    for (let i = 0; i < axis.length; i += 1) {
        let drawn = false;
        for (const column of Object.values(columns)) {
            if (isNumber(column[i])) { drawn = true; break; }
        }
        if (!drawn) {
            for (const column of Object.values(bColumns)) {
                if (isNumber(column[i])) { drawn = true; break; }
            }
        }
        if (!drawn) continue;
        if (min === null) min = axis[i];
        max = axis[i];
    }
    if (min === null) return { min: 0, max: 0, span: 0, empty: true };
    return { min, max, span: max - min, empty: false };
}

/* ─────────────────────────────────────────────────── the step boundaries */

/**
 * The step boundaries of both shots, as vertical rules and their labels.
 *
 * THE THIRD COUNTED DEFECT DIES HERE. Slate's `stepRules()` (`history-viewer.js:458`)
 * maps `stepShapes()` and HARD-CODES ONE DASH PATTERN while dropping opacity altogether,
 * so A's boundaries and B's are drawn identically on a chart whose entire A/B convention
 * is "same hue, and the dash says which shot". The rules contradicted the curves they
 * were meant to annotate.
 *
 * Here the dash is a NAME resolved by the one table (`chart-axis.js` `DASH_PATTERNS` via
 * `dashPattern`), A takes the renderer's own default by stating none, and B takes the
 * same dash and the same alpha as B's traces — so a boundary is told from its shot by
 * exactly the two marks its curves are told apart by, and nothing here restates either.
 *
 * B'S RULES MOVE WITH B AND A'S DO NOT, which is the alignment most people are reaching
 * for: two pours of one profile, lined up on the instant preinfusion ended.
 *
 * @param {object} options
 * @param {object|null} options.a
 * @param {object|null} options.b
 * @param {number} options.offset
 * @param {object} options.paint  `{colour, ink, width, dash, alpha}` — every value the
 *        caller read from tokens. This module holds no colour and no width.
 * @returns {{vertical: object[], labels: object[]}} `setRules`'s own shape
 */
export function comparisonStepRules({ a = null, b = null, offset = 0, paint = {} } = {}) {
    const { colour, ink, width, dash, alpha } = paint;
    const shift = Number.isFinite(offset) ? offset : 0;
    const vertical = [];
    const labels = [];

    const add = (derivation, at, style) => {
        if (!derivation || derivation.ok !== true) return;
        for (const mark of derivation.stepMarks ?? EMPTY) {
            if (!isNumber(mark?.t)) continue;
            vertical.push({ x: mark.t + at, color: colour, width, ...style });
            /* THE LABEL IS A's ALONE. Two shots of one profile carry the same step
             * names, so labelling both writes every name twice a few pixels apart —
             * which is the collision the label plugin then spends a pass resolving. The
             * rule still moves; only the word is not repeated. */
            if (style.reference && mark.name) labels.push({ x: mark.t, text: mark.name, color: ink });
        }
    };

    add(a, 0, { reference: true });
    add(b, shift, { dash, alpha });

    /* `reference` is this function's own bookkeeping and is not part of `setRules`'s
     * shape, so it does not travel to the plot. */
    for (const rule of vertical) delete rule.reference;
    return { vertical, labels };
}
