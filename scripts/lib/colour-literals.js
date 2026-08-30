/**
 * What counts as a raw colour literal.
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

    const scannable = stripFunctions(stripStrings(value), ['url']);

    for (const m of scannable.matchAll(HEX)) {
        hits.push({ kind: 'hex', text: m[0] });
    }
    for (const m of scannable.matchAll(COLOUR_FN)) {
        hits.push({ kind: 'function', text: `${m[1]}(` });
    }

    if (isColourBearing(property)) {
        const bare = stripFunctions(scannable, ['var', 'attr', 'counter', 'counters', 'env']);
        for (const m of bare.matchAll(WORD)) {
            const word = m[0].toLowerCase();
            if (ALLOWED_KEYWORDS.has(word)) continue;
            if (NAMED_COLOURS.has(word)) hits.push({ kind: 'named', text: m[0] });
        }
    }

    return hits;
}

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
