/**
 * How far up the y axis goes, and where the temperature band sits.
 */

/** 5 % of headroom above the highest sample, before rounding to a clean tick. */
export const HEADROOM = 1.05;

export const EASE_STEP = 2;

export const Y_FLOOR_LIVE = 10;

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

export function comparisonTempBand(records, prefixes = ['']) {
    const column = (key) => {
        const out = [];
        for (const prefix of prefixes) {
            const ys = records?.[`${prefix}${key}`]?.y;
            if (Array.isArray(ys)) out.push(...ys);
        }
        return out;
    };
    return computeTempRange(
        column('targetTemp'), column('groupTemp'), column('mixTemp'), column('targetMixTemp'),
    );
}

export function widenBand(held, next) {
    if (!Array.isArray(held) || held.length !== 2) return next;
    if (!Array.isArray(next) || next.length !== 2) return held;
    return [Math.min(held[0], next[0]), Math.max(held[1], next[1])];
}

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
