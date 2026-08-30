/**
 * The gallery entry for.
 */

const column = (rows, { width = '338px' } = {}) =>
    '<div style="display:grid; gap:var(--ui-seam); background-color:var(--ui-line);'
    + ` align-content:start; inline-size:${width}">` + rows.join('') + '</div>';

const row = (label, attrs = '') => `<ui-subnav-row ${attrs}>${label}</ui-subnav-row>`;

const catRow = () =>
    '<div style="block-size:var(--ui-nav-row); background-color:var(--ui-fascia)"></div>';

const CALIBRATION = [
    'Voltage', 'Load cells', 'Flow multiplier', 'Fan', 'Refill kit', 'Default load settings',
];

/* SEVEN rows, because seven is the length T2 names: "measured pitch 89 vs 93, 24px out by
 * row 7". Six gaps x 4px of leftover Tailwind space-y-1 margin = the 24px. */
const SEVEN = ['Cup Warmer', 'Lighting', 'USB Charger', 'Steam', 'Hot Water', 'Flush', 'Advanced'];

export const entry = {
    id: 'ui-subnav-row',
    title: 'Sub-nav row',
    module: '../../src/components/ui-subnav-row.js',
    notes:
        'Component #25: the Settings SUB-category row — the right-hand column of the two-'
        + 'column settings nav. Same pitch and same type as #24 on purpose, so the two read '
        + 'as one navigation surface: --ui-nav-row (88px, DERIVED from --ui-control-h + '
        + '2 x --ui-space-3, scaled by --ui-density), a 24px inset, 22px --ui-text-nav at '
        + '--ui-weight-regular in --ui-muted, on --ui-fascia. Three defects die here. '
        + 'T2: Slate\'s sub-nav pitch is 93 against the category column\'s 89 and it renders '
        + 'ZERO separators, both from one `> * + *` selector that can never match a single '
        + '<ul> — here the row\'s outer box IS the pitch (one owner per dimension) and the '
        + 'seam is the COLUMN\'s gap, so neither half has a selector to get wrong. '
        + 'T3: authored `border-radius: 0 !important` and rendered 6px, because a substring '
        + 'attribute selector 500 lines away matched the Tailwind class in the markup — here '
        + 'the corner is declared once inside a shadow root no document rule can reach. '
        + 'T5: the current row draws a 4px steel LED the shell spent a `box-shadow: none` '
        + 'trying to remove, bypassing the --slate-selected-led dial entirely — this file '
        + 'declares no box-shadow at ANY state, so the only thing that can draw an LED is '
        + '--ui-selected-led. Selection is the four dials and nothing else: no bar, no LED, '
        + 'no glow, and NOT the 400→500 weight lift Slate applies (weight is not a dial; that '
        + 'rule stays in #3, the one selection component). Clicking emits `navigate` and does '
        + 'not make the row current — "current" is the router\'s fact, not the row\'s opinion.',
    states: [
        {
            id: 'resting',
            title: 'Resting',
            notes:
                'The measured paint, in a seamed column at Slate\'s own 338px width: 22px '
                + '--ui-text-nav at --ui-weight-regular in --ui-muted, 24px inset, --ui-fascia '
                + 'ground. Square corners, no border, no shadow. '
                + 'CITE .settings-subnav-btn [i=32] color = rgb(148, 161, 169) / [prov-light] '
                + 'rgb(90, 101, 108), font-size = 22px, font-weight = 400, [i=34] '
                + 'padding-left = 24px, box-shadow = none.',
            html: column([row('Cup Warmer')]),
        },
        {
            id: 'column',
            title: 'The sub-category column, six rows',
            notes:
                'Slate\'s Calibration sub-categories — the corpus\' six-row column '
                + '(settings-calibration-*, rects [261,219,338,89] … [261,684,338,89]), with '
                + 'the first one current. Six cells give five seams and no sibling selector is '
                + 'involved, so T2\'s separator half has nothing to fail to match. Slate '
                + 'renders this column with NO separators at all; every line you see here is '
                + 'one the running app does not draw.',
            html: column(CALIBRATION.map((name, i) => row(name, i === 0 ? 'current' : ''))),
        },
        {
            id: 'current',
            title: 'Current, beside its resting neighbours',
            notes:
                'The whole of the treatment is --ui-selected-face and --ui-selected-ink; '
                + '--ui-selected-led is 0px and --ui-selected-glow is 0% on Slate\'s own dials, '
                + 'so nothing else paints. '
                + 'CITE [i=30] background-color = rgb(176, 196, 206) / [prov-light] '
                + 'rgb(49, 92, 112) (= --ui-selected-face), color = rgb(18, 24, 28) / '
                + '[prov-light] rgb(248, 252, 253) (= --ui-selected-ink). '
                + 'DELIBERATELY ABSENT: the 4px inset steel-at-72% LED Slate actually renders '
                + 'here (T5 — CITE [i=30] box-shadow = rgba(0,0,0,0) 0px -4px 0px 0px inset, '
                + 'color(srgb 0.690196 0.768627 0.807843 / 0.72) 0px -4px 0px 0px inset ← '
                + 'slate-components.css `.slate-nav-selected` !important=yes), the 6px corner '
                + '(T3), and the jump to weight 500 (CITE [i=30] font-weight = 500 vs [i=32] '
                + '400) — the row is the same 400 whether current or not. The state is '
                + 'aria-current="true" on the button, so the paint and what a screen reader '
                + 'announces are one attribute and cannot drift.',
            html: column([row('Lighting'), row('Cup Warmer', 'current'), row('USB Charger')]),
        },
        {
            id: 'aligned',
            title: 'T2: seven rows, category beside sub-category',
            notes:
                'T2 verbatim: "the sub-category column does not align with the category '
                + 'column … measured pitch 89 vs 93, 24px out by row 7". Seven rows is the '
                + 'length that names the bug — six gaps of leftover 4px Tailwind margin. Both '
                + 'columns here read the same --ui-nav-row and hold no number of their own, so '
                + 'the seventh rows start on the same pixel. The left column is plain cells of '
                + 'the token rather than <ui-nav-row>, which is the point: alignment is a '
                + 'property of the token, not of the two components agreeing.',
            html:
                '<div style="display:flex; gap:var(--ui-seam); background-color:var(--ui-line)">'
                + column(SEVEN.map(() => catRow()), { width: '260px' })
                + column(SEVEN.map((name, i) => row(name, i === 1 ? 'current' : '')))
                + '</div>',
        },
        {
            id: 'disabled',
            title: 'A sub-category that is not available',
            notes:
                'The base paints disabled from --ui-opacity-disabled, ONE dial settling '
                + 'Slate\'s three live values (spec §3.7). The host attribute dims and the real '
                + 'button carries the native `disabled`, so the press is refused and the row '
                + 'leaves the tab order — but the dim is applied once, on the host, not '
                + 'multiplied by a second rule on the control (0.38 x 0.38 = 0.14 is the trap). '
                + 'Slate has no disabled sub-nav row; this is the base\'s other painted state, '
                + 'shown because it is reachable.',
            html: column([row('Steam'), row('Transport Mode', 'disabled'), row('Flush')]),
        },
        {
            id: 'narrow',
            title: 'In a 200px column',
            notes:
                'The label clips with an ellipsis rather than wrapping — a row whose height '
                + 'depends on its text is a row whose column has no pitch, which is the family '
                + 'T2 belongs to. A departure from Slate, which never meets a narrow container '
                + 'because its geometry is frozen at 1920x1200 (the oracle is DISQUALIFIED for '
                + 'responsive behaviour; LAYOUT_SPEC_DRAFT.md governs). The 88px pitch holds, '
                + 'the row stays one line, and the text node is untouched so the accessible '
                + 'name stays whole when the ink does not.',
            hostStyle: { 'inline-size': '200px' },
            html: column([
                row('Default load settings and the rest of the calibration group', 'current'),
                row('Flow multiplier'),
                row('Fan'),
            ], { width: '200px' }),
        },
    ],
};

export default entry;
