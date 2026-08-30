/**
 * history-power.js — the POWER PAGE's own logic: the derived-channel plot's channel
 * list, the P–Q trajectory's points, and the correspondence marks that tie the
 * trajectory back to the clock. Fix run 6 (the History power page), Q16, H2, #11.
 *
 * DOM-FREE, so `node:test` imports it directly (`src/lib/README.md`). It builds point
 * lists and mark lists; it opens no endpoint, touches no component, and — this is the
 * one that matters — DERIVES NOTHING (A7).
 *
 * ===========================================================================
 * A7 — THE THREE CHANNELS ARE READ, NEVER COMPUTED
 * ===========================================================================
 * `resistance` (R = P/F²), `impedance` (Z = P/F) and `power` (W = 0.1·P·F) are gate 6
 * SERIES_KEYS like `pressure` is: `shot-derivation.js` generates them from
 * `DUPLICATED_QUANTITIES` and reads each one through `shot-source-selector.js`'s B6
 * choice — the puck-estimator's MEASURED channel when the machine offers it, ReaPrime's
 * own `*Derived` key otherwise, and an absence when neither is there. There is no
 * `?? 0.1 * pressure * flow` in this file or anywhere behind it, and there must never
 * be one: a locally computed W would look exactly like a served one and disagree with
 * it. This module reads `derivation.series[key]` and plots what it finds.
 *
 * WHERE THE HOLES COME FROM, so a gap is never mistaken for a bug. ReaPrime gates all
 * three at `flow >= 0.3 mL/s && pressure >= 0.3 bar` and OMITS the key below it
 * (`machine.dart:70-76` at the pin) — the ratios are numerically meaningless there and
 * `jsonEncode` throws on the infinities. Omitted reaches the skin as an absence, becomes
 * an explicit null in the derivation, and `bridgeUnspoken` deliberately does NOT bridge
 * it (`chart-align.js:28-31`: "that is a real gap and is preserved"). So a trace that
 * stops during a low-flow preinfusion is the server telling the truth, and the page must
 * not paper over it.
 *
 * ===========================================================================
 * PAIRING IS BY THE SHARED CLOCK, NOT BY INDEX
 * ===========================================================================
 * Slate's `trajectoryPoints` pairs flow against pressure BY INDEX (`history-viewer.js`
 * :748-760), which is one of the six counted defects: two channels that pushed different
 * numbers of samples would be silently paired to the wrong instants. In gate 6 the
 * question does not arise, because it is answered upstream — every MEASURED channel gets
 * one y per in-shot sample and they all share ONE x array, `axis.t`, assigned by
 * identity (`shot-derivation.js:470`). So index IS x here, by construction. This module
 * therefore ASSERTS the construction rather than assuming it: a derivation whose flow,
 * pressure and axis lengths disagree yields no trajectory at all instead of a plausible
 * wrong one.
 */

import { indexAtTime } from './shot-derivation.js';
import { TICK_STEPS } from './chart-axis.js';
import { HEADROOM, niceCeil } from './chart-autoscale.js';

/**
 * THE DERIVED-CHANNEL PLOT'S CHANNELS: R AND Z, ON ONE LOG AXIS, AND NOTHING ELSE.
 *
 * Ben, 25 August 2026: "Power will be on the Pressure/Flow chart, not on the resistance /
 * impedance chart. No second axis on these charts." That settles the deferred question
 * this file has carried since the port, and it settles it Slate's way.
 *
 * THE OLD SPLIT AND WHY IT IS GONE. This page used to draw R and Z on a linear left axis
 * and W on a real, labelled right one, which was a fair answer to a real defect: Slate
 * put W on the flow chart's y2 without ever building that axis, so power drew against an
 * invisible auto-ranged scale and read about 2x high. But the fix chose the wrong side.
 * W belongs with pressure and flow, where 0.1 x P x F sits inside the same 0-12 band they
 * do and needs no axis of its own; putting it here forced a second axis onto a page whose
 * two remaining channels are a matched pair.
 *
 * WHY LOG, WHICH IS THE OTHER HALF OF THE SAME DECISION. Both ratios run away as flow
 * approaches ReaPrime's gate: at the gate's own corner (F = 0.3, P = 9) R is
 * 100 bar.s^2/mL^2 and Z is 30 bar.s/mL, and one such sample takes a linear axis with it
 * and flattens everything else. The linear pair was shipped with that recorded as a
 * deferred question and the measured numbers beside it; the answer is Slate's log axis,
 * which is what let it hold both ratios on ONE axis in the first place.
 *
 * A RATIO IS A DIFFERENT QUANTITY FROM A WATT, and that has not stopped being true - it
 * is why W is not here. What has changed is that R and Z are the SAME KIND of quantity as
 * each other: both are pressure over a power of flow, both span decades within one pour,
 * and a log axis is the scale on which "the same kind" becomes "the same axis".
 */
export const DERIVED_LEFT_CHANNELS = Object.freeze(['resistance', 'impedance']);

/**
 * Every channel the derived-channel plot draws. The two left channels ARE the list now;
 * the name is kept because the page and its suite address the plot by it.
 */
export const DERIVED_CHANNELS = DERIVED_LEFT_CHANNELS;

/**
 * No channel is drawn against a second scale. Kept as an empty table rather than deleted:
 * `abChannelSpecs` takes `scales` and a page that passed nothing would read as a page that
 * forgot to, which is the defect class this file is written against.
 */
export const DERIVED_SCALES = Object.freeze({});

/**
 * THE LOG AXIS'S BOUNDS, and they are Slate's two numbers
 * (`chart.js:220-221` — `EXP_POWER_LOG_FLOOR` / `EXP_POWER_LOG_CEIL`).
 *
 * 0.05 is below any resistance a pouring shot produces and 100 is the gate corner named
 * above, so the pair frames every sample the machine can legally report without letting
 * one outlier own the axis.
 */
export const DERIVED_LOG_FLOOR = 0.05;
export const DERIVED_LOG_CEIL = 100;

/** How much of a decade to leave above and below the data, in log10 units. Slate's PAD. */
export const DERIVED_LOG_PAD = 0.25;

/**
 * THE LEFT AXIS'S RANGE, IN LOG10 UNITS — Slate's `logRangeFor`, carried whole.
 *
 * A log axis whose range is narrower than a decade can have every decade tick land
 * outside it, which draws an axis with no labels at all and reads as a broken chart
 * rather than a tight one. So the range hugs the data by a quarter-decade either side and
 * is clamped to the two bounds above; `derivedTickValues` is what then guarantees labels
 * inside it.
 *
 * Computed ONCE from BOTH shots, as the linear version was, so the pair share one frame
 * and neither redraws when the other is picked.
 */
export function derivedLeftRange({ a = null, b = null } = {}) {
    const positive = [];
    for (const derivation of [a, b]) {
        if (!derivation || derivation.ok !== true) continue;
        for (const key of DERIVED_LEFT_CHANNELS) {
            for (const value of derivation.series?.[key]?.y ?? []) {
                if (typeof value === 'number' && Number.isFinite(value) && value > 0) positive.push(value);
            }
        }
    }
    if (positive.length < 2) return [Math.log10(DERIVED_LOG_FLOOR), Math.log10(DERIVED_LOG_CEIL)];
    const lo = Math.max(DERIVED_LOG_FLOOR, Math.min(...positive));
    const hi = Math.min(DERIVED_LOG_CEIL, Math.max(...positive));
    return [
        Math.max(Math.log10(DERIVED_LOG_FLOOR), Math.log10(lo) - DERIVED_LOG_PAD),
        Math.min(Math.log10(DERIVED_LOG_CEIL), Math.log10(hi) + DERIVED_LOG_PAD),
    ];
}

/**
 * PLOTTED AS log10, LABELLED AS THE REAL NUMBER — the whole mechanism, in two functions.
 *
 * `uplot-plot.js` builds linear scales only, so a log axis here is not a scale type: it is
 * the DATA in log10 against a linear range in log10 units, with the tick formatter putting
 * the real number back. Slate reached the same place from Plotly's `type: 'log'`, whose
 * range is also given in log10 — which is why its floor and its pad transfer unchanged.
 *
 * A NON-POSITIVE SAMPLE BECOMES A GAP, never -Infinity. The gate upstream already omits
 * the meaningless ones (see this file's header); this catches the zero a bridged sample
 * can still carry, and a gap is the honest drawing of a value a log axis cannot hold.
 */
export function toLog10(values) {
    return (values ?? []).map((v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.log10(v) : null));
}

/** Every record's y in log10, x untouched. The one place the transform is applied. */
export function logRecords(records) {
    const out = {};
    for (const [key, record] of Object.entries(records ?? {})) {
        out[key] = { ...record, y: toLog10(record?.y) };
    }
    return out;
}

/**
 * A log10 tick printed as the number it stands for — Slate's `formatLogTick`.
 *
 * The span is 0.05 to 100, so the labels need two decimals at the bottom and none at the
 * top: "0.05" and "100", not "-1.3" and "2".
 */
export function formatLogTick(v) {
    const real = 10 ** v;
    if (real >= 10) return String(Math.round(real));
    if (real >= 1) return real.toFixed(1);
    return real.toFixed(2);
}

/**
 * WHERE THE TICKS GO, which Plotly decided for Slate and nothing decides here.
 *
 * Slate set `dtick: 1` on a range of a decade or more and `'D2'` below it — Plotly's name
 * for "subdivide each decade at 1, 2 and 5". uPlot has no such word, so the splits are
 * built: whole decades on a wide range, and the 1/2/5 ladder on a narrow one. The reason
 * is Slate's own and it is the reason the range pads by a quarter decade: a decade tick on
 * a range narrower than a decade can land entirely outside it, leaving an axis with no
 * labels.
 */
export function derivedTickValues([lo, hi]) {
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || !(hi > lo)) return [];
    const wide = hi - lo >= 2;
    const out = [];
    for (let decade = Math.floor(lo); decade <= Math.ceil(hi); decade += 1) {
        for (const step of wide ? [1] : [1, 2, 5]) {
            const v = decade + Math.log10(step);
            if (v >= lo && v <= hi) out.push(v);
        }
    }
    return out;
}


/**
 * THE TRAJECTORY'S AXES, both FIXED — Slate's `HV_PQ_FLOW_MAX` / `HV_PQ_PRESSURE_MAX`
 * (`history-viewer.js:707-708`), carried unchanged.
 *
 * A P–Q plot is read by its SHAPE — where the path turns, how tightly it loops — and a
 * shape is only comparable between two shots if both are drawn against the same frame.
 * An autoscaled trajectory would redraw the same pour differently depending on its own
 * peak, which is the one thing this chart must not do.
 */
export const PQ_FLOW_MAX = 8;
export const PQ_PRESSURE_MAX = 12;

/**
 * The frame the trajectory is actually drawn in: Slate's two maxima, EXTENDED when the
 * data runs past them.
 *
 * A fixed frame that crops is worse than an autoscaled one, because the part that is
 * missing looks exactly like a part that never happened. MEASURED on the fixture pair,
 * which is why this exists: those pours reach 12.64 mL/s against Slate's flow ceiling of
 * 8, so a literal port would have drawn a third of both trajectories off the right-hand
 * edge with nothing saying so. Slate's 8 and 12 frame an ESPRESSO; a flush is not one.
 *
 * The extension keeps everything the fixed frame was for: it is computed ONCE from BOTH
 * shots, so the two paths share a frame and neither moves when the other is picked, and
 * it never shrinks below Slate's numbers, so an ordinary espresso is drawn in exactly the
 * frame it always was. `niceCeil` is the right ladder here — flow and pressure are the
 * quantities its 2-step was built for.
 */
export function trajectoryFrame({ a = null, b = null } = {}) {
    let flow = 0;
    let pressure = 0;
    for (const derivation of [a, b]) {
        if (!derivation || derivation.ok !== true) continue;
        for (const [key, current] of [['flow', flow], ['pressure', pressure]]) {
            let max = current;
            for (const value of derivation.series?.[key]?.y ?? []) {
                if (typeof value === 'number' && Number.isFinite(value) && value > max) max = value;
            }
            if (key === 'flow') flow = max; else pressure = max;
        }
    }
    return Object.freeze({
        flowMax: Math.max(PQ_FLOW_MAX, niceCeil(flow * HEADROOM)),
        pressureMax: Math.max(PQ_PRESSURE_MAX, niceCeil(pressure * HEADROOM)),
    });
}

/**
 * A jump larger than this between two consecutive plotted samples is a GAP, and the path
 * BREAKS rather than running a straight line across it (Slate's `PQ_GAP_SECONDS`,
 * `derived-channels.js:120`). Carried with its reason: a bridged gap is a line the shot
 * never travelled, drawn in the same ink as the lines it did.
 */
export const PQ_GAP_SECONDS = 0.75;

/** At most this many correspondence marks on the path (Slate's `PQ_MARK_TARGET`). */
export const PQ_MARK_TARGET = 6;

/**
 * Which of the three derived channels this derivation actually carries.
 *
 * PRESENCE IS A COUNT OF REAL READINGS, not the presence of a key: every derivation has
 * all fourteen SERIES_KEYS and a channel the server never spoke about is a column of
 * nulls. The page's empty state asks this, so "no derived channels in this shot" and
 * "this shot refused" are different sentences (#38).
 */
export function derivedPresence(derivation) {
    const series = derivation && derivation.ok === true ? derivation.series : null;
    const out = {};
    let any = false;
    for (const key of DERIVED_CHANNELS) {
        const ys = series && series[key] ? series[key].y : null;
        const n = Array.isArray(ys) ? ys.reduce((acc, v) => acc + (typeof v === 'number' ? 1 : 0), 0) : 0;
        out[key] = n;
        if (n > 0) any = true;
    }
    return Object.freeze({ ...out, any });
}

/** True when the two derivations between them carry no derived reading at all. */
export function noDerivedChannels(a, b) {
    return !derivedPresence(a).any && !derivedPresence(b).any;
}

/**
 * The derivation's flow/pressure pair as ONE ordered point list, or an empty one.
 *
 * Each point is `{x: flow, y: pressure, t: seconds}` — `t` is REAL SECONDS on the page's
 * clock, which is the correction to Slate's shape: its points carried a pre-normalised
 * 0..1 in a field called `t`, so the colour scale and the key each had to know that. Here
 * the colour scale is handed the span and does its own normalising, and every consumer of
 * a point reads the same units the rest of the page uses.
 *
 * A point whose flow or pressure is absent is emitted as a NULL PAIR rather than skipped:
 * `bandsPlugin` skips a segment with a non-finite end, so a null point breaks the path on
 * both sides of itself — which is the gap, drawn as a gap. The same null is what a
 * `PQ_GAP_SECONDS` jump inserts.
 *
 * @param {object|null} derivation  a gate-6 derivation
 * @param {{offset?: number}} options  seconds to add to `t` (B's slide; A never moves)
 */
export function trajectoryPoints(derivation, { offset = 0 } = {}) {
    if (!derivation || derivation.ok !== true) return [];
    const t = derivation.axis && Array.isArray(derivation.axis.t) ? derivation.axis.t : [];
    const flow = derivation.series && derivation.series.flow;
    const pressure = derivation.series && derivation.series.pressure;
    if (!flow || !pressure) return [];
    /* THE SHARED-CLOCK ASSERTION (see the header). Gate 6 assigns `axis.t` to every
     * measured channel by identity, so these three lengths are equal by construction; a
     * derivation where they are not is not one this module can pair, and a wrong pairing
     * is worse than no trajectory. */
    if (flow.y.length !== t.length || pressure.y.length !== t.length) return [];

    const shift = Number.isFinite(offset) ? offset : 0;
    const points = [];
    let lastReal = null;
    for (let i = 0; i < t.length; i += 1) {
        const x = flow.y[i];
        const y = pressure.y[i];
        const seconds = t[i] + shift;
        const real = typeof x === 'number' && typeof y === 'number'
            && Number.isFinite(x) && Number.isFinite(y);
        if (real && lastReal !== null && seconds - lastReal > PQ_GAP_SECONDS) {
            points.push({ x: null, y: null, t: seconds });
        }
        points.push(real ? { x, y, t: seconds } : { x: null, y: null, t: seconds });
        /* A GATED SAMPLE HAS ALREADY BROKEN THE RUN, so the next real point needs no
         * second break: `lastReal` is cleared rather than left stale. Without this a
         * single omitted reading emitted TWO nulls — one for itself and one for the time
         * jump it appeared to create — which draws the same gap and says it twice. */
        lastReal = real ? seconds : null;
    }
    return points;
}

/**
 * The end of the page's ONE clock, in seconds — what the time key's top number reads and
 * what the colour ramp is normalised against.
 *
 * ONE CLOCK FOR BOTH SHOTS, and that is a departure from Slate with a reason. Slate
 * normalised each trajectory against ITS OWN duration (`tMax` per bundle), so on a
 * comparison the same colour meant 3.3 s on one path and 8.5 s on the other while the key
 * beside them showed one set of numbers. Here both paths are coloured against the same
 * span — the later end of the two, B's slide included — so the key is true for whatever
 * is drawn under it.
 */
export function trajectorySpan({ a = null, b = null, offset = 0 } = {}) {
    let span = 0;
    for (const [derivation, shift] of [[a, 0], [b, Number.isFinite(offset) ? offset : 0]]) {
        if (!derivation || derivation.ok !== true) continue;
        const t = derivation.axis && Array.isArray(derivation.axis.t) ? derivation.axis.t : [];
        if (!t.length) continue;
        const end = t[t.length - 1] + shift;
        if (end > span) span = end;
    }
    return span;
}

/**
 * THE CORRESPONDENCE MARKS — Q16, live at last, and the port of Slate's `pqAlignmentMarks`
 * (`history-viewer.js:330-402`, zero callers there) with its argument intact:
 *
 *   "A time offset cannot move a P–Q path — its axes are pressure and flow, and time is
 *    only the colour — so the two shots are drawn as two paths and the correspondence
 *    marks say which point of one matches which point of the other. … It answers the
 *    question the slider is actually for: when A was 12 seconds in, where was B?"
 *
 * A handful of round instants on A's clock, marked on A's path, marked again on B's at
 * the instant the offset says corresponds, and joined by a faint link. Slide the
 * alignment and the B ends walk along B's trajectory — which is the only thing on this
 * page the compare bar can move, and the reason the bar is shown here at all.
 *
 * THE STEP COMES OUT OF THE ONE TICK TABLE. Slate wrote `[1, 2, 5, 10, 15, 20, 30, 60]`
 * here and `chart-axis.js` already exports exactly that ladder (plus three longer steps)
 * as `TICK_STEPS`, for the x axis of every time chart in the app. A second copy is a
 * second thing to drift, and the marks are read against the same axis those ticks label.
 *
 * @param {{a: object|null, b: object|null, offset: number}} shots
 * @returns {{step: number, marks: Array, links: Array}}
 *   `marks` is `[{ t, label, a: {x, y}|null, b: {x, y}|null }]`; `links` is the subset
 *   with both ends, as `[{ from, to }]`.
 */
export function correspondenceMarks({ a = null, b = null, offset = 0 } = {}) {
    const none = Object.freeze({ step: 0, marks: Object.freeze([]), links: Object.freeze([]) });
    const aPoints = trajectoryPoints(a);
    if (!aPoints.length) return none;
    const aT = aPoints.map((p) => p.t);
    const span = aT[aT.length - 1];
    if (!(span > 0)) return none;

    const raw = span / PQ_MARK_TARGET;
    const step = TICK_STEPS.find((s) => s >= raw) ?? TICK_STEPS[TICK_STEPS.length - 1];

    const shift = Number.isFinite(offset) ? offset : 0;
    const bPoints = trajectoryPoints(b, { offset: shift });
    const bT = bPoints.map((p) => p.t);

    const marks = [];
    const links = [];
    for (let t = step; t < span; t += step) {
        const ai = indexAtTime(aT, t);
        const aAt = ai >= 0 && aPoints[ai] && aPoints[ai].x !== null ? aPoints[ai] : null;
        let bAt = null;
        /* B's own clock. A's instant T corresponds to B's T, because B is DRAWN at its
         * own time PLUS the offset and `bPoints` already carries the slide — the same
         * arithmetic Slate wrote as `ticks[k] - state.offset` against unshifted points. */
        if (bT.length && t >= bT[0] && t <= bT[bT.length - 1]) {
            const bi = indexAtTime(bT, t);
            if (bi >= 0 && bPoints[bi] && bPoints[bi].x !== null) bAt = bPoints[bi];
        }
        if (!aAt && !bAt) continue;
        const mark = {
            t,
            label: `${t}s`,
            a: aAt ? { x: aAt.x, y: aAt.y } : null,
            b: bAt ? { x: bAt.x, y: bAt.y } : null,
        };
        marks.push(mark);
        if (mark.a && mark.b) links.push({ from: mark.a, to: mark.b });
    }
    return { step, marks, links };
}

/**
 * A colour ramp reader: `stops` are CSS colour strings, `u` is 0..1, and the result is
 * the linear sRGB blend between the two stops it falls between.
 *
 * A6 — THE STOPS ARE THE STYLESHEET'S. This function takes them as an argument and
 * declares none: `styles/chart-channels.css` holds the ten `--ui-timekey-stop-*` values
 * and the page reads them computed, exactly as every trace colour is read. Slate's
 * `viridisColor` carried the same ten stops as a JS constant, which is the A6 defect
 * ("all 16 channel colours exist ONLY in JavaScript") in its smallest form.
 *
 * Stops are parsed as `rgb(r, g, b)` or `#rrggbb`; anything else is handed back whole for
 * the nearest stop, so a fork's ramp in another colour space still draws — banded rather
 * than blended, and never invisible.
 */
export function rampColour(stops, u) {
    const list = Array.isArray(stops) ? stops.filter(Boolean) : [];
    if (!list.length) return null;
    if (list.length === 1) return list[0];
    const x = Number.isFinite(u) ? Math.min(1, Math.max(0, u)) : 0;
    const last = list.length - 1;
    const pos = x * last;
    const i = Math.min(last - 1, Math.floor(pos));
    const f = pos - i;
    const from = parseRgb(list[i]);
    const to = parseRgb(list[i + 1]);
    if (!from || !to) return list[f < 0.5 ? i : i + 1];
    const mix = (k) => Math.round(from[k] + (to[k] - from[k]) * f);
    return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
}

/** `#rrggbb` or `rgb(r, g, b)` as `[r, g, b]`, or null for anything else. */
function parseRgb(value) {
    const text = String(value ?? '').trim();
    const hex = /^#([0-9a-f]{6})$/i.exec(text);
    if (hex) {
        const n = parseInt(hex[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const rgb = /^rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)/i.exec(text);
    if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    return null;
}
