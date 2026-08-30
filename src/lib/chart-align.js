/**
 * chart-align.js — one x axis for N channels, and the two meanings of null. Gate 5.
 *
 * SALVAGE 1 OF 3 from `chart-uplot.js` (CARRY_FORWARD: "salvage three things then
 * delete the file"). `bridgeUnspoken` is carried with its policy comment intact and
 * with the test that pins it (Part 6 'Tests': "carry the gap-meaning test that pins
 * `bridgeUnspoken` with the function"). The singleton lifecycle, the duplicated
 * tick/dash tables and the hard-coded seven-key `SERIES_ORDER` did NOT come with it:
 * the channel list is now the caller's, because the chart card, the steam chart and
 * the history view draw different sets.
 *
 * DOM-free, so `node:test` imports it directly.
 */

/**
 * Fill the slots a channel never spoke about, and only those.
 *
 * The union in `alignChannels` puts every channel on every other channel's timestamps,
 * and the empty slots that creates used to be left as null — which uPlot draws as a
 * BREAK IN THE LINE. Live it never showed, because every channel is sampled from the
 * same machine frame and the fast path runs. Replayed from a record it showed on every
 * channel at once: each pushes only its finite samples, so the channels have different
 * x arrays, and the union gave every one of them a null at every other one's
 * timestamps — a row of vertical cuts running through all series at the same instants.
 *
 * A null has TWO meanings here and they must not be conflated:
 *   - the derived channels (R, W, Z) push an EXPLICIT null while gated, meaning "no
 *     valid value at this instant". That is a real gap and is preserved: those slots
 *     are `spoken`, and `spanGaps: false` still draws them as a break.
 *   - a slot the channel simply did not sample means "no reading at this instant", and
 *     the quantity still existed between the readings either side. Those are bridged.
 *
 * Only slots strictly BETWEEN two real readings are bridged. Before a channel's first
 * sample and after its last there is nothing to interpolate from, so they stay null and
 * the line stays absent rather than being invented.
 *
 * Exported for `test/chart-align.test.mjs`, which pins both meanings directly rather than
 * through `alignChannels`: the two meanings of null are a policy, not an implementation
 * detail, and a regression here is invisible until someone looks at a finished shot on
 * the machine.
 *
 * Mutates and returns `col`, as the original did — the caller owns a freshly built
 * array and nothing else holds a reference to it.
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

/**
 * One x axis for N channels, in uPlot's `[xs, ...ys]` shape.
 *
 * `channels` is `{ [key]: { x: number[], y: (number|null)[] } }` and `keys` fixes the
 * ORDER of the returned columns — uPlot's data array and the series array are aligned
 * by index, so the caller passes the same key order to both and the two cannot drift.
 *
 * THE FAST PATH is the one that happens every live frame: every channel is sampled from
 * the same machine frame, so their x arrays are the same length and can be used as-is.
 * The slow path exists because that is a property of the live feed, not a guarantee — a
 * rebuilt historical shot can hold channels of different lengths, and quietly plotting
 * those against the wrong x is the kind of error that looks like a plausible chart.
 *
 * A key with no record at all yields a column of nulls of the right length, so a
 * channel that has not started yet does not shorten the data array.
 */
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
        // Which slots the channel actually SPOKE ABOUT — including the ones it spoke
        // about by pushing an explicit null.
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
