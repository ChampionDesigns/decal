/**
 * colour-literals.js — what counts as a raw colour literal.
 *
 * Separated from the guard that uses it so the vocabulary can be unit-tested on
 * strings, without a filesystem. The guard decides WHERE to look; this decides WHAT
 * it is looking at.
 *
 * THREE FORMS, and the third is the one a lazier guard misses:
 *   1. hex — `#fff`, `#ff0044`, `#ff004480`
 *   2. colour functions — `rgb()`, `rgba()`, `hsl()`, `hwb()`, `lab()`, `lch()`,
 *      `oklab()`, `oklch()`, `color()`
 *   3. named colours — `red`, `white`, `tomato`. All 148 of them.
 *
 * `color-mix()` and `light-dark()` are deliberately NOT literals: they are the
 * legitimate way to derive from a token (`color-mix(in srgb, currentColor
 * var(--ui-selected-glow), transparent)` is the selection glow, and contains no
 * literal at all). Their ARGUMENTS are still scanned, so a `color-mix` with a hex in
 * it is caught by rule 1.
 *
 * NAMED COLOURS NEED A PROPERTY CONTEXT, and that is a deliberate narrowing rather
 * than a hole. `linen`, `tomato` and `plum` are also ordinary words, and a guard
 * that flags them in `grid-template-areas` or a `content` string produces the false
 * positives that get guards switched off. So a bare name is a violation only when it
 * is the value of a colour-bearing property — or of a custom property, where
 * `--_ui-anything: red` can only be a colour.
 *
 * ALWAYS ALLOWED, everywhere: `transparent`, `currentColor`, and the CSS-wide
 * keywords. They carry no palette information — `currentColor` is in fact how the
 * selection LED gets its colour from the ink dial without a fifth token.
 */

export const NAMED_COLOURS = new Set([
    'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque',
    'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood',
    'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk',
    'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray',
    'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta', 'darkolivegreen',
    'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen',
    'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise',
    'darkviolet', 'deeppink', 'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue',
    'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro', 'ghostwhite',
    'gold', 'goldenrod', 'gray', 'green', 'greenyellow', 'grey', 'honeydew',
    'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender',
    'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral',
    'lightcyan', 'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey',
    'lightpink', 'lightsalmon', 'lightseagreen', 'lightskyblue', 'lightslategray',
    'lightslategrey', 'lightsteelblue', 'lightyellow', 'lime', 'limegreen', 'linen',
    'magenta', 'maroon', 'mediumaquamarine', 'mediumblue', 'mediumorchid',
    'mediumpurple', 'mediumseagreen', 'mediumslateblue', 'mediumspringgreen',
    'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream', 'mistyrose',
    'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange',
    'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise',
    'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink', 'plum',
    'powderblue', 'purple', 'rebeccapurple', 'red', 'rosybrown', 'royalblue',
    'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell', 'sienna',
    'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow',
    'springgreen', 'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise',
    'violet', 'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen',
]);

/** Carry no palette information, so they are never a literal. */
export const ALLOWED_KEYWORDS = new Set([
    'transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'revert',
    'revert-layer', 'none', 'auto',
]);

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const COLOUR_FN = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/gi;
const WORD = /[a-zA-Z][a-zA-Z0-9-]*/g;

/**
 * Does a bare colour name in this property's value mean a colour?
 * Custom properties count: `--x: red` can only be one thing.
 */
export function isColourBearing(property) {
    const p = property.trim().toLowerCase();
    if (p.startsWith('--')) return true;
    if (/(^|-)colou?r$/.test(p)) return true;
    return [
        'background', 'border', 'outline', 'box-shadow', 'text-shadow',
        'text-decoration', 'text-emphasis', 'column-rule', 'fill', 'stroke',
        'background-image', 'stop-color', 'flood-color', 'lighting-color',
        'caret', 'list-style',
    ].some((base) => p === base || p.startsWith(base + '-'));
}

/**
 * Every colour literal in one declaration value.
 * Returns `[{ kind, text }]`; empty means clean.
 */
export function findColourLiterals(property, value) {
    const hits = [];

    // Strings and url() come out first, for every check. `content: "#ff0000"` is a
    // string that looks like a colour and is not one; `url(#gradient)` is an SVG
    // fragment reference. Flagging either is a false positive, and a false positive
    // is what gets an exemption written, and an exemption is how coverage dies.
    const scannable = stripFunctions(stripStrings(value), ['url']);

    for (const m of scannable.matchAll(HEX)) {
        hits.push({ kind: 'hex', text: m[0] });
    }
    for (const m of scannable.matchAll(COLOUR_FN)) {
        hits.push({ kind: 'function', text: `${m[1]}(` });
    }

    if (isColourBearing(property)) {
        // Only words that stand alone as values — not `var(--ui-red-thing)`, not a
        // quoted string, not part of a longer identifier.
        const bare = stripFunctions(scannable, ['var', 'attr', 'counter', 'counters', 'env']);
        for (const m of bare.matchAll(WORD)) {
            const word = m[0].toLowerCase();
            if (ALLOWED_KEYWORDS.has(word)) continue;
            if (NAMED_COLOURS.has(word)) hits.push({ kind: 'named', text: m[0] });
        }
    }

    return hits;
}

/**
 * Blank out `name(...)` spans, honouring nesting — so `var(--ui-x, red)`'s fallback
 * is not read as a literal at the top level. (A named colour as a var() fallback is
 * still a literal, but it is a different, much rarer conversation than a bare
 * `color: red`, and flagging it here would mean flagging every `var(--x, 0)` shape
 * this function cannot type-check. If a fallback palette ever appears, widen this.)
 */
/** Blank out quoted strings, keeping length so nothing else shifts. */
function stripStrings(value) {
    return value.replace(/(["'])(?:\\.|(?!\1).)*\1/g, (m) => ' '.repeat(m.length));
}

function stripFunctions(value, names) {
    let out = value;
    for (const name of names) {
        const re = new RegExp(`\\b${name}\\s*\\(`, 'gi');
        let m;
        while ((m = re.exec(out)) !== null) {
            let depth = 1;
            let i = m.index + m[0].length;
            while (i < out.length && depth > 0) {
                if (out[i] === '(') depth++;
                else if (out[i] === ')') depth--;
                i++;
            }
            out = out.slice(0, m.index) + ' '.repeat(i - m.index) + out.slice(i);
            re.lastIndex = m.index;
        }
    }
    return out;
}
