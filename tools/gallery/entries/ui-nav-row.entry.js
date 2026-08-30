/**
 * ui-nav-row.entry.js - the gallery entry for component #24 (wave 2, item #24).
 *
 * WHY THIS IS A FILE OF ITS OWN, and not an append to ../entries.js.
 * tools/gallery/README.md:12 says "Edit entries.js. That is the whole procedure", and
 * that procedure is correct for ONE author. Wave 2 runs twelve builders in parallel under
 * a whole-file-write rule, so twelve appends to one array clobber each other - which is
 * exactly what wave 1 hit and recorded at entries.js:30-45. Each builder therefore owns
 * one file here and the wave's single cross-cutting writer wires them into entries.js,
 * serially, once:
 *
 *     import { entry as uiNavRow } from './entries/ui-nav-row.entry.js';
 *     export const entries = [ ...existing, uiNavRow ];
 *
 * `module` stays relative to tools/gallery/ as the README specifies - gallery.js does the
 * `import(entry.module)`, so the specifier resolves against gallery.js wherever the entry
 * object was authored.
 *
 * STATE IDS ARE CAPTURE FILENAMES (`ui-nav-row--<state>`): identifiers, not labels. A
 * rename is a re-baseline.
 *
 * `hostStyle` sizes the CONTAINER, never the viewport - the row reads its own container
 * (spec §2.1 Rule 1) and the viewport is the capture battery's business.
 */

/* THE COLUMN IS THE SEAM DRAWER, not the row (CONVENTIONS §13): a 1px grid gap over
 * --ui-line, which replaces Slate's per-row
 * `#main-categories-panel ul > li + li .settings-nav-btn { box-shadow: inset 0
 * var(--slate-hairline) 0 var(--slate-line) }` - the rule whose sub-nav twin cannot match
 * and leaves that column with zero separators (T2). Written out here rather than imported
 * because a gallery state is light-DOM markup; the real consumer uses the `seams`
 * fragment. The ink is the measured one:
 * CITE settings-machine-machine-info #accessories-btn [i=11] box-shadow = rgb(58, 72, 82)
 *      0px 1px 0px 0px inset / [prov-light] the --ui-line twin  <-  slate-shell.css
 *      authored `inset 0 var(--slate-hairline) 0 var(--slate-line)`  = --ui-line.
 * The width is Slate's own 260, measured:
 * CITE settings-machine-machine-info .settings-nav-btn rects [0,219,260,89] ... */
const column = (rows, { width = '260px' } = {}) =>
    '<div style="display:grid; gap:var(--ui-seam); background-color:var(--ui-line);'
    + ` align-content:start; inline-size:${width}">` + rows.join('') + '</div>';

const row = (label, attrs = '') => `<ui-nav-row ${attrs}>${label}</ui-nav-row>`;

/* Slate's ten Settings categories, in order, read read-only from settings.html:30-39.
 * Ten and not eleven is half of bug T18 - "--slate-nav-row: 89px justifies itself with a
 * derivation that is wrong on both halves ... there are 10 categories, not 11". */
const CATEGORIES = [
    'Machine', 'Accessories', 'Connections', 'Calibration', 'Maintenance',
    'Display', 'Units &amp; Language', 'Extensions', 'Updates', 'Help',
];

export const entry = {
    id: 'ui-nav-row',
    title: 'Nav row',
    module: '../../src/components/ui-nav-row.js',
    notes:
        'Component #24: the Settings category row, at --ui-nav-row (88px, DERIVED from '
        + '--ui-control-h + 2 x --ui-space-3 x --ui-density) with a 24px inset and 22px '
        + '--ui-text-nav in --ui-muted. It never existed as a primitive '
        + '(DECISIONS.md:251). Three defects die here: the current row draws NO 4px LED '
        + '(T5 - Slate\'s is steel-at-72% on a steel fill, won with !important by a sheet '
        + 'the shell spent two declarations trying to overrule), the corners are square '
        + '(T3 - authored 0 twice, rendered 6px), and the pitch is a token rather than a '
        + 'per-column rule (T2 - 89 against 93, and a separator rule that never matched). '
        + 'Selection is the four dials and nothing else: no leading bar, no LED, no weight '
        + 'change. The seam between rows is the COLUMN\'s 1px gap (CONVENTIONS §13), which '
        + 'is why every state below wraps its rows in a seamed grid.',
    states: [
        {
            id: 'resting',
            title: 'Resting',
            notes:
                'The measured row: 88px pitch, 24px inset, 22px --ui-text-nav at '
                + '--ui-weight-regular in --ui-muted, on a --ui-fascia ground. Square '
                + 'corners, no border, no shadow. CITE #accessories-btn [i=11] font-size = '
                + '22px, font-weight = 400, color = rgb(148, 161, 169), padding-left = 24px.',
            html: column([row('Accessories')]),
        },
        {
            id: 'column',
            title: 'The category column, ten rows',
            notes:
                'Slate\'s own ten categories (settings.html:30-39), with the first one '
                + 'current. Ten cells give nine seams and no sibling selector is involved, '
                + 'so T2 has nothing to fail to match. Ten rows at 88 fill 880 where Slate '
                + 'filled 890 and its comment claimed 981 - decision C4 lets the column\'s '
                + 'tail be free rather than tuning the pitch to a row count.',
            html: column(CATEGORIES.map((name, i) => row(name, i === 0 ? 'current' : ''))),
        },
        {
            id: 'current',
            title: 'Current, beside its resting neighbour',
            notes:
                'The whole of the treatment is --ui-selected-face and --ui-selected-ink; '
                + '--ui-selected-led is 0px and --ui-selected-glow is 0% on Slate\'s own '
                + 'dials, so nothing else paints. What is deliberately absent is the 4px '
                + 'steel strip Slate renders here (T5), the leading bar its shell draws at '
                + '--slate-selected-led, and the jump to weight 500. The state is '
                + 'aria-current="true" on the button - the element a screen reader '
                + 'announces - so the paint and the announcement are one attribute.',
            html: column([row('Machine', 'current'), row('Accessories')]),
        },
        {
            id: 'two-columns',
            title: 'Category and sub-category, side by side',
            notes:
                'T2 is "the sub-category column does not align with the category column ... '
                + 'measured pitch 89 vs 93, 24px out by row 7". Both columns here are the '
                + 'same component reading the same --ui-nav-row, so they cannot disagree: '
                + 'there is no per-column selector to get right. The second column is wider '
                + '(338px, the measured sub-nav width) and still aligns row for row.',
            html:
                '<div style="display:flex; gap:var(--ui-seam); background-color:var(--ui-line)">'
                + column([
                    row('Machine', 'current'),
                    row('Accessories'),
                    row('Connections'),
                    row('Calibration'),
                ])
                + column([
                    row('Water tank', 'current'),
                    row('Steam'),
                    row('Hot water'),
                    row('Flush'),
                ], { width: '338px' })
                + '</div>',
        },
        {
            id: 'disabled',
            title: 'A category that is not available',
            notes:
                'The base paints disabled from --ui-opacity-disabled, one dial settling '
                + 'Slate\'s three live values (spec §3.7). The host attribute dims; the real '
                + 'button carries the native `disabled`, so it refuses the press and leaves '
                + 'the tab order (CONVENTIONS §4). Slate has no disabled nav row - this is '
                + 'the base\'s other painted state, shown because it is reachable.',
            html: column([row('Connections'), row('Scale', 'disabled'), row('Calibration')]),
        },
        {
            id: 'narrow',
            title: 'In a 200px column',
            notes:
                'The label clamps and ellipsises rather than widening the column - a '
                + 'departure from Slate, which never meets a narrow container because its '
                + 'geometry is frozen at 1920x1200 (the oracle is disqualified for '
                + 'responsive behaviour). The 88px pitch and the 48px hit floor both hold, '
                + 'and the row is still one line.',
            hostStyle: { 'inline-size': '200px' },
            html: column([
                row('Sleep &amp; wake schedules, and the rest of the machine group', 'current'),
                row('Units &amp; Language'),
                row('Machine'),
            ], { width: '200px' }),
        },
    ],
};

export default entry;
