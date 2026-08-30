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

export function alignChannels(channels, keys) {
    const list = [...keys];
    const first = channels?.[list[0]];
    const xs = first ? first.x : [];

    let sameLength = list.length > 0;
    for (const key of list) {
        const rec = channels?.[key];
        if (!rec || rec.x.length !== xs.length) { sameLength = false; break; }
    }
    if (sameLength) {
        return [xs, ...list.map((key) => channels[key].y)];
    }

    const union = new Set();
    for (const key of list) {
        const rec = channels?.[key];
        if (rec) for (const value of rec.x) union.add(value);
    }
    const x = [...union].sort((a, b) => a - b);
    const index = new Map(x.map((v, i) => [v, i]));
    const out = [x];
    for (const key of list) {
        const rec = channels?.[key];
        const col = new Array(x.length).fill(null);
        const spoken = new Array(x.length).fill(false);
        if (rec) {
            for (let i = 0; i < rec.x.length; i += 1) {
                const at = index.get(rec.x[i]);
                if (at !== undefined) { col[at] = rec.y[i]; spoken[at] = true; }
            }
        }
        out.push(bridgeUnspoken(x, col, spoken));
    }
    return out;
}

/** Every y column of an aligned set, for the autoscalers. `data[0]` is the x axis. */
export function seriesColumns(data) {
    return data.slice(1);
}
