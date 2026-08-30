/**
 * chart-autoscale.js — how far up the y axis goes, and where the temperature band
 * sits. Gate 5 (PORT-WITH-CHANGES, `chart-autoscale.js` 151 -> this).
 *
 * SALVAGE 2 OF 3 from `chart-uplot.js` is here rather than there: the live y-ceiling
 * policy ("grow instantly, ease down") was the SAME rule the expanded charts already
 * used, reached through `computeExpandedClampedYMax` with a different floor. The port
 * keeps the rule ONCE. Two functions survive:
 *
 *   computeDampedYMax   the damped grow-instantly / ease-down ceiling, floor and
 *                       optional hard cap. This is `computeExpandedTopYMax` and
 *                       `computeExpandedClampedYMax` merged: the first was the second
 *                       with `floor = 12`, no cap and no null-skip, and keeping both
 *                       is how the two drifted (only one of them skipped the gated
 *                       nulls the derived channels push).
 *   computeTempRange    the bench-learned temperature-band rule, carried whole with
 *                       its reasoning — it is the one function here whose behaviour
 *                       was decided by watching real shots.
 *
 * DROPPED, per the row: the three expanded-chart autoscalers `computeExpandedR2Max`,
 * `computeExpandedPowerYMax`, `computeExpandedZMax` and their five constants
 * (`EXP_R2_FLOOR` 2, `EXP_R2_CAP` 10, `EXP_POWER_FLOOR` 4, `EXP_Z_FLOOR` 4,
 * `EXP_Z_CAP` 8). Nothing read them — the expanded charts render R and Z on fixed LOG
 * axes and W on a fixed linear axis — and the old suite pinned their literal values,
 * which is a test asserting that dead code has not changed. The suite is corrected in
 * the same commit as the code (Part 6 'Tests').
 *
 * DOM-free, so `node:test` imports it directly.
 */

/** 5 % of headroom above the highest sample, before rounding to a clean tick. */
export const HEADROOM = 1.05;

/**
 * How far the ceiling may fall in one call, and the hysteresis band that has to be
 * cleared before it falls at all. One number doing both jobs, as it always has: the
 * axis must not chase a spike back down, and it must not jitter around one.
 */
export const EASE_STEP = 2;

/**
 * The resting top of the live plot. 10 is the axis this chart has always shown and it
 * stays the RESTING one: pressure lives inside it and an espresso reads naturally
 * against it. It is a FLOOR rather than the whole range, so a flow spike pushes the
 * ceiling up instead of vanishing over it — before that fix a fast preinfusion's peak
 * left the plot at the top edge and came back, drawing two vertical walls with the
 * peak missing between them (`chart-uplot.js:31-35`).
 */
export const Y_FLOOR_LIVE = 10;

/**
 * THE LIVE SHOT CHART'S WHOLE RANGE, AND IT NO LONGER GROWS. Ben's call, 29 August 2026:
 * "please make it fixed, no point showing if someone bumps the scale and the scale goes
 * to 600..."
 *
 * That is the case `Y_FLOOR_LIVE` above cannot survive, and it is why the floor is not
 * the answer on this one card. `computeDampedYMax` grows INSTANTLY on a peak — by
 * design, so a real spike is never lost — so a knocked scale reporting a nonsense weight
 * takes the ceiling with it, and pressure, flow and every other channel spend the rest of
 * the shot flattened into the bottom of the plot. One bump ruins the whole shot's chart.
 *
 * A FIXED CEILING MAKES THAT IMPOSSIBLE, and the cost is stated rather than hidden: a
 * value above 12 clips. Flow on a fast preinfusion is the one that will do it, and the
 * paragraph above describes exactly how that reads — "two vertical walls with the peak
 * missing between them". 12 rather than 10 makes it rarer, Ben has weighed the two cases
 * against each other, and the bumped scale is the one that happens on a real bench.
 *
 * 12 IS ALSO THE RIGHT NUMBER FOR WHAT IS ACTUALLY DRAWN. The axis is not bar: Slate
 * divides temperature by ten so 90 C plots at 9 (`plot-surface.js`, "an honest trick and
 * it is stated"), and pressure lives well inside 12. It is the expanded plots' resting
 * top too (`Y_FLOOR_EXPANDED`), so the two charts now open on the same axis.
 *
 * THE EXPANDED CHART KEEPS ITS DAMPED CEILING. It is the one a person opens to look at a
 * spike, so there it should grow. This constant is the embedded card's alone.
 */
export const SHOT_Y_RANGE = Object.freeze([0, 12]);

/** The expanded/history plots' own resting top; bar, mL/s and g/s share one axis. */
export const Y_FLOOR_EXPANDED = 12;


/** °C shown below the coolest target (temperature usually sags below target). */
export const TEMP_PAD_BELOW = 10;
/** °C shown above the hottest target. */
export const TEMP_PAD_ABOVE = 5;
/** Hard ceiling for the temp axis, no matter what the data says. */
export const TEMP_MAX = 105;
/** The narrowest band the cap may squeeze the temperature axis to. */
export const TEMP_MIN_SPAN = 5;

/** Round up to a clean axis tick: steps of 2 to 30, then 5 to 80, then 10. */
export function niceCeil(v) {
    if (v <= 0) return 0;
    if (v <= 30) return Math.ceil(v / 2) * 2;
    if (v <= 80) return Math.ceil(v / 5) * 5;
    return Math.ceil(v / 10) * 10;
}

/**
 * The damped top of a y axis.
 *
 * `seriesYs` is a list of y-arrays in real units; `prevYMax` is the previous damped
 * value the caller stored. Grows INSTANTLY so a peak is never lost; eases back down at
 * most `EASE_STEP` per call, and only once the need has dropped by more than
 * `EASE_STEP` (hysteresis against flicker). Data only grows within a shot, so this is
 * effectively monotonic during a pour; it only eases back down across shots.
 *
 * Series may contain nulls — the derived channels push an EXPLICIT null while gated,
 * meaning "no valid value at this instant" — and those are skipped rather than read as
 * zero. `cap` clamps channels that run away as flow approaches zero (R and Z spike
 * toward infinity there); values beyond the cap clip offscreen, which is the intended
 * behaviour on a linear axis.
 */
export function computeDampedYMax(seriesYs, prevYMax, { floor = 0, cap = Infinity } = {}) {
    let peak = 0;
    for (const ys of seriesYs) {
        if (!ys) continue;
        for (let i = 0; i < ys.length; i += 1) {
            const v = ys[i];
            if (typeof v === 'number' && Number.isFinite(v) && v > peak) peak = v;
        }
    }
    let need = Math.max(floor, niceCeil(peak * HEADROOM));
    if (need > cap) need = cap;

    let next = typeof prevYMax === 'number' && Number.isFinite(prevYMax) ? prevYMax : floor;
    if (need > next) {
        next = need;                                   // grow instantly, keep the peak
    } else if (need < next - EASE_STEP) {
        next = Math.max(need, next - EASE_STEP);       // ease down one step
    }
    if (next > cap) next = cap;
    if (next < floor) next = floor;
    return next;
}

/**
 * A BAND THAT MAY ONLY GROW, which is the temperature axis's hysteresis.
 *
 * `computeDampedYMax` above carries its own damping — "the axis must not chase a spike
 * back down, and it must not jitter around one" — and `computeTempRange` below carries
 * NONE, because it is pure and recomputed from scratch on every frame. Live, that is
 * visible as flicker: the band widens to keep every temperature line in view, and the mix
 * target is the DE1's servo setpoint, which the machine slams around and dives to ~37 C
 * with. The floor jumps frame to frame and the axis snaps with it (Ben, 29 August 2026:
 * "when I watch the shot live the temperature chart flickers").
 *
 * The fix is not to damp `computeTempRange` — its numbers were decided by watching real
 * shots and it has its own suite — but to remember what was already drawn and refuse to
 * narrow it. WITHIN ONE SHOT ONLY: the caller drops the held band when the sample buffer
 * restarts, or one shot's band would be inherited by the next.
 *
 * A band that can only grow cannot make a visible line start clipping, which is what makes
 * this safe rather than a compromise. `held` is null on the first frame of a shot and the
 * new band is taken whole.
 *
 * @param {ReadonlyArray<number>|null} held  the band already drawn, or null
 * @param {ReadonlyArray<number>} next       this frame's band from `computeTempRange`
 */
export function widenBand(held, next) {
    if (!Array.isArray(held) || held.length !== 2) return next;
    if (!Array.isArray(next) || next.length !== 2) return held;
    return [Math.min(held[0], next[0]), Math.max(held[1], next[1])];
}

/**
 * The temperature band, in °C: `[min(target) − 10, max(target) + 5]` over every GROUP
 * target seen this shot (target 80 -> 70..85; if it then drops to 70 the band widens to
 * 60..85). With no group target yet, the band anchors on the LAST group-temp sample
 * (default 90). The band then widens so the other temperature lines (group actual, mix
 * actual, mix TARGET) never clip out of view — EXCEPT the hard 105 °C ceiling, which
 * wins over "never clip"; a >= 5 °C span is kept when the cap squeezes the band.
 *
 * ONLY THE GROUP TARGET ANCHORS, and this is the bench-learned half. The mix target is
 * drawn on the chart and is never clipped, but it does NOT drive the band: despite its
 * name it is not a flat goal, it is the DE1's servo SETPOINT — the machine slams it
 * around to steer the group, and on a shot that starts with a hot group it dives to
 * ~37 °C to demand cold water. Anchoring on it would pad a further 10 °C below that
 * dive ([27, 95] on a real bench shot) and squash the group trace to a flat ribbon.
 * Widening-only keeps the line fully visible while the band stays owned by the goal
 * that actually matters (bench replay: hot-group shot [27, 95] -> [37, 95]; normal
 * shots [70, 95] -> [73, 90]).
 */
export function computeTempRange(targetTempYs, groupTempYs = [], mixTempYs = [], targetMixTempYs = []) {
    const targets = targetTempYs ?? [];
    let lo;
    let hi;
    if (targets.length) {                       // ...only the group target anchors
        let tmin = Infinity;
        let tmax = -Infinity;
        for (let i = 0; i < targets.length; i += 1) {
            const v = targets[i];
            if (typeof v !== 'number' || !Number.isFinite(v)) continue;
            if (v < tmin) tmin = v;
            if (v > tmax) tmax = v;
        }
        if (tmin === Infinity) return computeTempRange([], groupTempYs, mixTempYs, targetMixTempYs);
        lo = tmin - TEMP_PAD_BELOW;
        hi = tmax + TEMP_PAD_ABOVE;
    } else {
        const gy = groupTempYs ?? [];
        let last = 90;
        for (let i = gy.length - 1; i >= 0; i -= 1) {
            const v = gy[i];
            if (typeof v === 'number' && Number.isFinite(v)) { last = v; break; }
        }
        lo = last - TEMP_PAD_BELOW;
        hi = last + TEMP_PAD_ABOVE;
    }
    // ...every other line only widens, so none of them ever clips
    for (const ys of [groupTempYs, mixTempYs, targetMixTempYs]) {
        if (!ys) continue;
        for (let i = 0; i < ys.length; i += 1) {
            const v = ys[i];
            if (typeof v !== 'number' || !Number.isFinite(v)) continue;
            if (v < lo) lo = v;
            if (v > hi) hi = v;
        }
    }
    hi = Math.min(TEMP_MAX, hi);                        // ...except the hard ceiling
    if (lo > hi - TEMP_MIN_SPAN) lo = hi - TEMP_MIN_SPAN; // a sane span when capped
    return [Math.floor(lo), Math.ceil(hi)];
}
