/**
 * chart-tokens.js — A6's reader: CSS is the single source for chart colour, and this
 * is the one place that turns a token into a number uPlot can paint with. Gate 5.
 *
 * WHAT IT REPLACES. `chart-palette.js` held all twenty chart colours as frozen JS
 * objects and `installChartPaletteCssVariables()` (`chart-palette.js:124-156`) wrote
 * them back out as INLINE STYLES on <html> plus a <style> appended to <head>. No
 * stylesheet can override an inline style on the root element, so a fork could not
 * retheme a chart without editing code, and `.slate-chart-card { background:
 * var(--slate-chart-well) }` had no fallback (bug O3). A6 deletes the mechanism:
 * `styles/chart-channels.css` is the declaration, and the chart reads its computed
 * tokens once per build and per theme change. uPlot needs numbers; it gets them from
 * CSS, at a cost of one style read per chart build — negligible against a redraw.
 *
 * NO INLINE-STYLE PUBLISHING HAPPENS HERE OR ANYWHERE DOWNSTREAM. This module only
 * reads.
 *
 * DOM-FREE BY INJECTION. `read` defaults to the platform's `getComputedStyle`, so the
 * browser needs no argument and `node:test` passes a fake declaration. That keeps the
 * token list, the naming rule and the px parsing — the parts that go wrong silently —
 * under a plain node suite (src/lib/README.md).
 *
 * NAMING (chart-channels.css:33-42): channels are `--ui-channel-<name>` in lower-kebab,
 * chart SURFACE is `--ui-chart-<part>`, and the chart's GEOMETRY tokens live in
 * tokens.css §3.8. The family is the single `--ui-font-family` (C9 — Geist ships behind
 * it; Plex belongs to Radian, not the base).
 */

/**
 * The eighteen data channels, in the order chart-channels.css declares them. The names
 * are the token suffixes, and they are also the keys a chart uses for a channel, so a
 * caller never spells a token by hand.
 *
 * `volume` and `weight` are gate 6's two ADDED channels (Part 6 gate 6: "where the
 * missing `weight` and `volume` channels are added"), and they are declared next to the
 * rate each one is the running total of. Slate has neither: its palette is sixteen
 * channels and its chart never drew a cumulative total, so these two have no oracle
 * answer and no source to port — see chart-channels.css for the two colours and the
 * rule they were chosen by.
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

/**
 * THE ONE SEAM BETWEEN GATE 6'S CHANNEL KEYS AND GATE 5'S CHANNEL NAMES.
 *
 * `shot-derivation.js`'s `SERIES_KEYS` are camelCase property names on a derivation
 * bundle (`series.weightFlow`); channel tokens are lower-kebab because CSS custom
 * properties are (`--ui-channel-weight-flow`). Twelve of the fourteen keys therefore do
 * NOT equal their channel name, and the failure when they are used as one is silent:
 * `readChartTokens` returns a map keyed by channel NAME, so `channels['weightFlow']` is
 * `undefined`, uPlot takes `undefined` as "no stroke", and the trace is simply not
 * painted. Nothing throws and `missing` stays empty, because the reader only ever
 * validated its own sixteen names — never the caller's keys.
 *
 * MEASURED before this map existed: a plot built from `SERIES_KEYS.map(k => ({ key: k }))`
 * resolved 5 of 14 channels — pressure, flow, resistance, impedance and power, the five
 * whose key happens to be spelled the same as the token — and read back `null` strokes
 * for the other nine.
 *
 * Slate carried the same table (`chart-palette.js:102-119`, `CSS_CHANNEL_NAMES`) for the
 * same reason and the port dropped it. This is it, restored, with the two channels gate 6
 * adds. `test/chart-channel-keys.test.mjs` pins it against `SERIES_KEYS` in both
 * directions, so a new derivation channel cannot ship without a colour and a renamed one
 * cannot leave a dead entry behind.
 */
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
    /* THE STEAM CHART'S TWO TEMPERATURES, added 24 Aug 2026 with that chart. The note
     * below already anticipated them by name — "a caller may name a channel this table
     * has never heard of (the steam chart's own keys)" — and what that produced when the
     * chart actually arrived was the loud refusal it promised: `--ui-channel-
     * steamTemperature` has no token, and both traces failed the build rather than
     * drawing uncoloured. The tokens themselves have existed in chart-channels.css since
     * the eighteen-channel palette; only the translation was missing. */
    steamTemperature: 'steam-temperature',
    milkTemperature: 'milk-temperature',
});

/**
 * A derivation series key, or a channel name, as a channel name. Unknown strings pass
 * through unchanged so a caller may name a channel this table has never heard of (the
 * steam chart's own keys, a fork's extra trace) — what must not happen is a caller
 * silently getting no colour, and `readChartTokens` + `resolveChannels` are what make
 * that loud.
 */
export function channelNameFor(key) {
    return SERIES_KEY_CHANNELS[key] ?? key;
}

/**
 * Resolve a caller's channel list against a token map, and refuse to guess.
 *
 * Returns `[name, colour]` pairs in the caller's order. `strict` (the default) throws
 * naming every key that resolved to nothing — the same stance `readChartTokens` takes
 * for a missing token, for the same reason: an unpainted trace looks exactly like a
 * quantity the machine never reported, and no screenshot gate can tell the two apart.
 */
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
            + 'derivation key, an entry in SERIES_KEY_CHANNELS (A6).',
        );
    }
    return { resolved, unresolved: Object.freeze(unresolved) };
}

/** `well` -> `--ui-chart-well`. */
export function surfaceToken(part) {
    return `--ui-chart-${part}`;
}

/** The single family token (C9). A component may USE the family; never declare it. */
export const FONT_FAMILY_TOKEN = '--ui-font-family';

/**
 * The chart's geometry tokens (tokens.css §3.8), by the name the plot spec uses.
 * Gutters are here because "nothing else may state them" (LAYOUT_SPEC_DRAFT.md §6.2) —
 * a chart that hand-matched a gutter across a file boundary is bug A3.
 */
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

/**
 * A length token as a number of CSS px. Tokens in §3.8 are authored in px and computed
 * as px; a value that is not parseable is a broken chain, not a zero, so it throws
 * rather than silently drawing a plot with no gutter.
 */
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

/**
 * Every token the plot needs, resolved against `element` — which is the chart
 * component's own host, so the values it gets are the ones that reached it through the
 * shadow boundary (custom properties inherit; that is the whole A6 mechanism, and it is
 * why chart-channels.css is a DOCUMENT sheet and not an adopted one).
 *
 * `strict` (the default) throws with the full list of names that resolved to nothing.
 * A chart whose palette did not arrive should fail on its first build, loudly, rather
 * than paint eighteen invisible traces: an empty stroke string draws nothing and the
 * screenshot looks like an empty plot, which is the same class of defect as Rule 1's.
 *
 * IT VALIDATES ITS OWN NAMES, NOT THE CALLER'S KEYS — `missing` being empty says the
 * SHEET arrived, never that the channels a particular chart asked for resolved. That
 * second question is `resolveChannels`'s, and every chart must ask it.
 */
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
            + '(index.html); nothing in a component may restate them (A6).',
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

/**
 * The `font` shorthand uPlot writes into `ctx.font`, in CSS px. The caller multiplies
 * by ITS OWN pixel ratio when it paints into a canvas (bug chart-C12) — this returns
 * the CSS-space string, so the two spaces never get mixed here.
 */
export function axisFont(sizePx, fontFamily) {
    if (!(sizePx > 0)) throw new TypeError('axisFont: sizePx must be positive');
    if (!fontFamily) throw new TypeError('axisFont: no family — read --ui-font-family (C9)');
    return `${sizePx}px ${fontFamily}`;
}

/**
 * The FIRST family in a font list, quotes intact — `"Geist", system-ui, sans-serif`
 * -> `"Geist"`.
 *
 * WHY A ONE-FAMILY STRING IS NEEDED AT ALL, and this is Rule 2's whole mechanism.
 * `--ui-font-family` is a fallback CHAIN, and a chain always resolves to something:
 * measured in this tree at 20px, `0123456789.` is 119.76 px wide under
 * `"Geist", system-ui, sans-serif` and 119.76 px wide under
 * `"Decal No Such Face", system-ui, sans-serif` — identical, because both land on
 * `system-ui`. So a probe that measures the CHAIN cannot tell a registered face from an
 * absent one; it reports "registered" either way. The same sample under the primary
 * family ALONE is 118.50 px when Geist has loaded and 105.00 px when it has not — and
 * 105.00 px is exactly what an unresolvable family measures. One family, no fallback, is
 * therefore the only string that discriminates.
 *
 * It is also the string `document.fonts.load()` wants: loading the chain would ask the
 * platform for `system-ui` and `sans-serif` as well, which are not loadable faces.
 *
 * Quote-aware, because a quoted family name may legally contain a comma.
 */
export function primaryFamily(fontFamily) {
    const list = String(fontFamily ?? '').trim();
    if (!list) throw new TypeError('primaryFamily: no family — read --ui-font-family (C9)');
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
