/**
 * The gallery entry for.
 */

const column = (rows, { width = '260px' } = {}) =>
    '<div style="display:grid; gap:var(--ui-seam); background-color:var(--ui-line);'
    + ` align-content:start; inline-size:${width}">` + rows.join('') + '</div>';

const row = (label, attrs = '') => `<ui-nav-row ${attrs}>${label}</ui-nav-row>`;

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
        + '--ui-text-nav in --ui-muted. It never existed as a primitive. '
        + 'Three defects die here: the current row draws NO 4px LED '
        + '(T5 - the reference skin\'s is steel-at-72% on a steel fill, won with !important by a sheet '
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
                'The reference skin\'s own ten categories, with the first one '
                + 'current. Ten cells give nine seams and no sibling selector is involved, '
                + 'so T2 has nothing to fail to match. Ten rows at 88 fill 880 where the reference skin '
                + 'filled 890 and its comment claimed 981 - decision C4 lets the column\'s '
                + 'tail be free rather than tuning the pitch to a row count.',
            html: column(CATEGORIES.map((name, i) => row(name, i === 0 ? 'current' : ''))),
        },
        {
            id: 'current',
            title: 'Current, beside its resting neighbour',
            notes:
                'The whole of the treatment is --ui-selected-face and --ui-selected-ink; '
                + '--ui-selected-led is 0px and --ui-selected-glow is 0% on the reference skin\'s own '
                + 'dials, so nothing else paints. What is deliberately absent is the 4px '
                + 'steel strip the reference skin renders here (T5), the leading bar its shell draws at '
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
                + 'the reference skin\'s three live values (spec §3.7). The host attribute dims; the real '
                + 'button carries the native `disabled`, so it refuses the press and leaves '
                + 'the tab order (CONVENTIONS §4). The reference skin has no disabled nav row - this is '
                + 'the base\'s other painted state, shown because it is reachable.',
            html: column([row('Connections'), row('Scale', 'disabled'), row('Calibration')]),
        },
        {
            id: 'narrow',
            title: 'In a 200px column',
            notes:
                'The label clamps and ellipsises rather than widening the column - a '
                + 'departure from the reference skin, which never meets a narrow container because its '
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
