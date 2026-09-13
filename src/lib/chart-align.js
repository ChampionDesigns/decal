/**
 * One x axis for N channels, and the two meanings of null.
 */

export function bridgeUnspoken(x, col, spoken) {
    let prev = -1;
    for (let i = 0; i < col.length; i += 1) {
        if (!spoken[i]) continue;
        if (col[i] === null || col[i] === undefined) { prev = -1; continue; }
        if (prev >= 0 && i - prev > 1) {
            const x0 = x[prev], x1 = x[i], y0 = col[prev], y1 = col[i];
            const span = x1 - x0;
            for (let k = prev + 1; k < i; k += 1) {
                col[k] = span > 0 ? y0 + (y1 - y0) * ((x[k] - x0) / span) : y0;
            }
        }
        prev = i;
    }
    return col;
}

function sharesOneAxis(channels, keys, xs) {
    if (!keys.length) return false;
    for (const key of keys) {
        const rec = channels?.[key];
        if (!rec) return false;
        if (rec.x === xs) continue;
        if (rec.x.length !== xs.length) return false;
        for (let i = 0; i < rec.x.length; i += 1) if (rec.x[i] !== xs[i]) return false;
    }
    return true;
}

/** Slots one instant needs: the longest CONSECUTIVE run of it in any one channel. */
function slotCounts(channels, keys) {
    const counts = new Map();
    for (const key of keys) {
        const rec = channels?.[key];
        if (!rec) continue;
        let run = 0;
        for (let i = 0; i < rec.x.length; i += 1) {
            run = i > 0 && rec.x[i] === rec.x[i - 1] ? run + 1 : 1;
            const at = rec.x[i];
            if (run > (counts.get(at) ?? 0)) counts.set(at, run);
        }
    }
    return counts;
}

export function alignChannels(channels, keys) {
    const list = [...keys];
    const first = channels?.[list[0]];
    const xs = first ? first.x : [];

    if (sharesOneAxis(channels, list, xs)) {
        return [xs, ...list.map((key) => channels[key].y)];
    }

    const counts = slotCounts(channels, list);
    const instants = [...counts.keys()].sort((a, b) => a - b);
    const x = [];
    const base = new Map();
    for (const at of instants) {
        base.set(at, x.length);
        for (let k = 0; k < counts.get(at); k += 1) x.push(at);
    }

    const out = [x];
    for (const key of list) {
        const rec = channels?.[key];
        const col = new Array(x.length).fill(null);
        const spoken = new Array(x.length).fill(false);
        if (rec) {
            const filled = new Map();
            let run = 0;
            for (let i = 0; i < rec.x.length; i += 1) {
                const at = rec.x[i];
                run = i > 0 && at === rec.x[i - 1] ? run + 1 : 1;
                const start = base.get(at);
                if (start === undefined) continue;
                const slot = start + Math.min(run - 1, counts.get(at) - 1);
                col[slot] = rec.y[i];
                spoken[slot] = true;
                filled.set(at, run);
            }
            /* Fewer values than slots: the last one is stated in the rest, not bridged. */
            for (const [at, n] of filled) {
                const start = base.get(at);
                const need = counts.get(at);
                for (let k = n; k < need; k += 1) {
                    col[start + k] = col[start + n - 1];
                    spoken[start + k] = true;
                }
            }
        }
        out.push(bridgeUnspoken(x, col, spoken));
    }
    return out;
}

/** The latest sample at or before `t` on the record's own x axis, or null outside it. */
export function valueAtTime(record, t) {
    const xsOwn = record?.x;
    const ys = record?.y;
    if (!Array.isArray(xsOwn) || !Array.isArray(ys) || !xsOwn.length) return null;
    if (typeof t !== 'number' || !Number.isFinite(t)) return null;
    if (t < xsOwn[0] || t > xsOwn[xsOwn.length - 1]) return null;
    let lo = 0;
    let hi = xsOwn.length - 1;
    let best = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (xsOwn[mid] <= t) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    if (best < 0) return null;
    const value = ys[best];
    return value === undefined ? null : value;
}

/** Every y column of an aligned set, for the autoscalers. `data[0]` is the x axis. */
export function seriesColumns(data) {
    return data.slice(1);
}
