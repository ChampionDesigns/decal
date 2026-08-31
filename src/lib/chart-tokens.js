/**
 * CSS is the single source for chart colour, and this is the one place that turns a token into a number uPlot can paint with.
 */

export const CHANNELS = Object.freeze([
    'pressure',
    'target-pressure',
    'flow',
    'target-flow',
    'volume',
    'group-temperature',
    'target-group-temperature',
    'weight-flow',
    'weight',
    'power',
    'mix-temperature',
    'target-mix-temperature',
    'resistance',
    'impedance',
    'detector-event',
    'step-boundary',
    'steam-temperature',
    'milk-temperature',
]);

/** The four chart surface parts: the well, its grid, its axis line, its tick labels. */
export const SURFACE_PARTS = Object.freeze(['well', 'grid', 'axis', 'label']);

/** `pressure` -> `--ui-channel-pressure`. The only place that prefix is written. */
export function channelToken(name) {
    return `--ui-channel-${name}`;
}

export const SERIES_KEY_CHANNELS = Object.freeze({
    pressure: 'pressure',
    flow: 'flow',
    weightFlow: 'weight-flow',
    weight: 'weight',
    volume: 'volume',
    groupTemp: 'group-temperature',
    mixTemp: 'mix-temperature',
    targetTemp: 'target-group-temperature',
    targetMixTemp: 'target-mix-temperature',
    resistance: 'resistance',
    impedance: 'impedance',
    power: 'power',
    targetPressure: 'target-pressure',
    targetFlow: 'target-flow',
    steamTemperature: 'steam-temperature',
    milkTemperature: 'milk-temperature',
});

export function channelNameFor(key) {
    return SERIES_KEY_CHANNELS[key] ?? key;
}

export function resolveChannels(keys, channels, { strict = true } = {}) {
    const resolved = [];
    const unresolved = [];
    for (const key of keys) {
        const name = channelNameFor(key);
        const colour = channels?.[name];
        if (colour) resolved.push([name, colour]);
        else { resolved.push([name, undefined]); unresolved.push(`${key} (--ui-channel-${name})`); }
    }
    if (strict && unresolved.length) {
        throw new Error(
            `chart-tokens: ${unresolved.length} channel(s) have no colour — ${unresolved.join(', ')}. `
            + 'Every drawn channel needs a token in styles/chart-channels.css and, if its key is a '
            + 'derivation key, an entry in SERIES_KEY_CHANNELS.',
        );
    }
    return { resolved, unresolved: Object.freeze(unresolved) };
}

/** `well` -> `--ui-chart-well`. */
export function surfaceToken(part) {
    return `--ui-chart-${part}`;
}

/** The single family token. A component may USE the family; never declare it. */
export const FONT_FAMILY_TOKEN = '--ui-font-family';

export const GEOMETRY_TOKENS = Object.freeze({
    strokeMajor: '--ui-chart-stroke',
    strokeMinor: '--ui-chart-stroke-minor',
    tickFontPx: '--ui-chart-tick',
    legendFontPx: '--ui-chart-legend',
    /** The step NAME written up a boundary. See the token for why it is not the tick. */
    stepLabelPx: '--ui-chart-step-label',
    statFontPx: '--ui-chart-stat',
    gutterLeft: '--ui-chart-gutter-l',
    gutterRight: '--ui-chart-gutter-r',
    gutterTop: '--ui-chart-gutter-t',
    gutterBottom: '--ui-chart-gutter-b',
    minHeight: '--ui-chart-min-h',
    minTickGapPx: '--ui-chart-tick-gap',
});

export function parsePx(value, name = 'length') {
    const px = Number.parseFloat(String(value ?? '').trim());
    if (!Number.isFinite(px)) {
        throw new TypeError(`chart-tokens: ${name} did not resolve to a length (got ${JSON.stringify(value)})`);
    }
    return px;
}

function readerFor(element, read) {
    const fn = read ?? globalThis.getComputedStyle;
    if (typeof fn !== 'function') {
        throw new TypeError('chart-tokens: no getComputedStyle available and no `read` provided');
    }
    const declaration = fn(element);
    return (name) => String(declaration.getPropertyValue(name) ?? '').trim();
}

export function readChartTokens(element, { read, strict = true } = {}) {
    const value = readerFor(element, read);
    const missing = [];
    const take = (name) => {
        const found = value(name);
        if (!found) missing.push(name);
        return found;
    };

    const channels = {};
    for (const name of CHANNELS) channels[name] = take(channelToken(name));

    const surface = {};
    for (const part of SURFACE_PARTS) surface[part] = take(surfaceToken(part));

    const fontFamily = take(FONT_FAMILY_TOKEN);

    const rawGeometry = {};
    for (const [key, token] of Object.entries(GEOMETRY_TOKENS)) rawGeometry[key] = take(token);

    if (strict && missing.length) {
        throw new Error(
            `chart-tokens: ${missing.length} token(s) resolved to nothing — ${missing.join(', ')}. `
            + 'styles/tokens.css and styles/chart-channels.css are document-level links '
            + '(index.html); nothing in a component may restate them.',
        );
    }

    const geometry = {};
    for (const [key, raw] of Object.entries(rawGeometry)) {
        geometry[key] = raw ? parsePx(raw, GEOMETRY_TOKENS[key]) : null;
    }

    return Object.freeze({
        channels: Object.freeze(channels),
        surface: Object.freeze(surface),
        geometry: Object.freeze(geometry),
        fontFamily,
        missing: Object.freeze(missing),
    });
}

export function axisFont(sizePx, fontFamily) {
    if (!(sizePx > 0)) throw new TypeError('axisFont: sizePx must be positive');
    if (!fontFamily) throw new TypeError('axisFont: no family — read --ui-font-family');
    return `${sizePx}px ${fontFamily}`;
}

export function primaryFamily(fontFamily) {
    const list = String(fontFamily ?? '').trim();
    if (!list) throw new TypeError('primaryFamily: no family — read --ui-font-family');
    let quote = null;
    for (let i = 0; i < list.length; i += 1) {
        const ch = list[i];
        if (quote) {
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'") { quote = ch; continue; }
        if (ch === ',') {
            const head = list.slice(0, i).trim();
            if (!head) throw new TypeError(`primaryFamily: empty first family in ${JSON.stringify(list)}`);
            return head;
        }
    }
    return list;
}
