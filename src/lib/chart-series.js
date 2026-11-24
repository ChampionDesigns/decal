export const GFLOW_HALF_S = 0.5;

export const POOR_FIT_RMS_BAR = 0.5;

export const GRIND_RANGE = Object.freeze({ min: -1, max: 1, step: 0.01 });

export const MEASURED_SERIES = Object.freeze(['P', 'Q', 'G']);

export const TARGET_SERIES = 'targets';

export const CHART_Y_FLOOR = 12;

export const RUN_END = Object.freeze({ STOP: 'stop', END: 'end', LIMIT: 'limit' });

const EPS = 1e-9;

export function centredRate(t, w, half = GFLOW_HALF_S) {
    const n = Array.isArray(t) ? t.length : 0;
    const out = new Array(n);
    let lo = 0;
    let hi = 0;
    for (let i = 0; i < n; i++) {
        while (lo < i && t[lo] < t[i] - half - EPS) lo++;
        if (hi < i) hi = i;
        while (hi + 1 < n && t[hi + 1] <= t[i] + half + EPS) hi++;
        const a = nearestWeight(w, lo, i, 1);
        const b = nearestWeight(w, hi, i, -1);
        const dt = a !== null && b !== null ? t[b] - t[a] : 0;
        out[i] = dt > 1e-6 ? Math.max(0, (w[b] - w[a]) / dt) : 0;
    }
    return out;
}

function nearestWeight(w, from, to, step) {
    for (let j = from; step > 0 ? j <= to : j >= to; j += step) {
        if (typeof w[j] === 'number' && Number.isFinite(w[j])) return j;
    }
    return null;
}

export function grindFactor(value) {
    const v = Number.isFinite(value) ? Math.min(GRIND_RANGE.max, Math.max(GRIND_RANGE.min, value)) : 0;
    return 2 ** -v;
}

export function isPoorFit(rms) {
    return typeof rms === 'number' && Number.isFinite(rms) && rms >= POOR_FIT_RMS_BAR;
}

export function seriesToggle(show, key) {
    const next = { ...show };
    if (key === TARGET_SERIES) {
        next[key] = !show[key];
        return { show: next, refused: false };
    }
    if (!MEASURED_SERIES.includes(key)) return { show: { ...show }, refused: false };
    if (show[key] && MEASURED_SERIES.filter((k) => show[k]).length <= 1) {
        return { show: { ...show }, refused: true };
    }
    next[key] = !show[key];
    return { show: next, refused: false };
}

export function maxOf(values) {
    let m = 0;
    if (!Array.isArray(values)) return m;
    for (const v of values) if (typeof v === 'number' && Number.isFinite(v) && v > m) m = v;
    return m;
}

export function chartYMax(parts) {
    let m = 0;
    for (const values of parts) m = Math.max(m, maxOf(values));
    return Math.max(CHART_Y_FLOOR, Math.ceil(m / 2) * 2);
}

export function chartXMax(times) {
    const end = Math.max(10, ...times.filter((v) => Number.isFinite(v)));
    return Math.ceil((end + 0.5) / 5) * 5;
}

export function lastValue(values) {
    if (!Array.isArray(values)) return null;
    for (let i = values.length - 1; i >= 0; i--) {
        if (typeof values[i] === 'number' && Number.isFinite(values[i])) return values[i];
    }
    return null;
}

export function valueAt(t, values, at, tolerance = 0.06) {
    const n = Array.isArray(t) ? t.length : 0;
    if (!n || at < t[0] - tolerance || at > t[n - 1] + tolerance) return null;
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (t[mid] < at) lo = mid;
        else hi = mid;
    }
    const i = Math.abs(t[lo] - at) <= Math.abs(t[hi] - at) ? lo : hi;
    const v = values[i];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function mainStepOf(shot) {
    if (!shot || !Array.isArray(shot.t) || !Array.isArray(shot.frame)) return null;
    const time = new Map();
    for (let i = 0; i + 1 < shot.t.length; i++) {
        const k = shot.frame[i];
        if (!Number.isInteger(k)) continue;
        time.set(k, (time.get(k) ?? 0) + (shot.t[i + 1] - shot.t[i]));
    }
    let best = null;
    let bestTime = 0;
    for (const [k, s] of time) {
        if (s > bestTime || (s === bestTime && best !== null && k < best)) {
            best = k;
            bestTime = s;
        }
    }
    return best;
}

function meanWhere(values, keys, k) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < values.length; i++) {
        if (keys[i] === k && typeof values[i] === 'number' && Number.isFinite(values[i])) {
            sum += values[i];
            n++;
        }
    }
    return n > 2 ? sum / n : null;
}

export function shotResults(shot, flow, { dose, mainStep }) {
    const time = shot.t.length ? shot.t[shot.t.length - 1] : null;
    const weight = lastValue(shot.W);
    return {
        time,
        peakP: maxOf(shot.P),
        meanQ: mainStep === null || !flow ? null : meanWhere(flow.Q, shot.frame, mainStep),
        W: weight,
        ratio: dose > 0 && weight !== null ? weight / dose : null,
        why: null,
    };
}

export function runResults(run, { dose, mainStep }) {
    const out = run.out;
    return {
        time: run.end.t,
        peakP: maxOf(out.P),
        meanQ: mainStep === null ? null : meanWhere(out.Q, out.k, mainStep),
        W: run.W,
        ratio: dose > 0 ? run.W / dose : null,
        why: run.end.why,
    };
}

export function resultChange(a, b, digits) {
    if (a === null || b === null || a === undefined || b === undefined) return null;
    const v = b - a;
    return Math.abs(v) < 0.5 * 10 ** -digits ? 0 : v;
}
