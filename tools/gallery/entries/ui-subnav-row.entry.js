/**
 * ui-subnav-row.entry.js — the gallery entry for component #25 (wave 2, item #25).
 *
 * WHY THIS IS A FILE OF ITS OWN, and not an append to ../entries.js.
 * tools/gallery/README.md:12 says "Edit entries.js. That is the whole procedure", and that
 * procedure is correct for ONE author. Wave 2 runs twelve builders in parallel under a
 * whole-file-write rule, so twelve appends to one array clobber each other — which is
 * exactly what wave 1 hit and recorded at entries.js:30-45. Each builder therefore owns one
 * file here and the wave's single cross-cutting writer wires them into entries.js, serially,
 * once:
 *
 *     import { entry as uiSubnavRow } from './entries/ui-subnav-row.entry.js';
 *     export const entries = [ ...existing, uiSubnavRow ];
 *
 * `module` stays relative to tools/gallery/ as the README specifies — gallery.js does the
 * `import(entry.module)`, so the specifier resolves against gallery.js wherever the entry
 * object was authored.
 *
 * STATE IDS ARE CAPTURE FILENAMES (`ui-subnav-row--<state>`): identifiers, not labels. A
 * rename is a re-baseline.
 *
 * `hostStyle` sizes the CONTAINER, never the viewport — the row reads its own container
 * (spec §2.1 Rule 1) and the viewport is the capture battery's business.
 *
 * ORACLE PROVENANCE for every number quoted below, obtained mechanically with the
 * disqualification check run first (no DECISIONS.md decision touches the sub-nav row;
 * responsive behaviour has NO Slate answer; the element is on the 140-bug list at T2, T3
 * and T5, so its pitch, separators, radius and selected box-shadow are DISQUALIFIED and only
 * its paint is reproduced):
 *   CITE  prov_query.py find --cls settings-subnav-btn → "found 173 element(s) in 38
 *         state(s)"; settings-accessories-cup-warmer rects [261,219,338,89] [261,312,338,89]
 *         [261,405,338,89] — width 338, height 89, pitch 93. THIS IS T2.
 *   CITE  settings-accessories-cup-warmer .settings-subnav-btn [i=32] color =
 *         rgb(148, 161, 169) / [prov-light] rgb(90, 101, 108) ← slate-shell.css
 *         `#subpage-host .settings-subnav-btn` authored `var(--slate-muted)`
 *         !important=yes (token-driven)
 *   CITE  settings-accessories-cup-warmer .settings-subnav-btn [i=32] background-color =
 *         rgba(0, 0, 0, 0) ← same rule, authored `transparent` !important=no
 *         (FROZEN/hardcoded)
 *   CITE  settings-accessories-cup-warmer .settings-subnav-btn [i=32] font-size = 22px
 *         authored `var(--slate-text-nav)`; font-weight = 400 authored
 *         `var(--slate-weight-regular)`; [i=34] padding-left = 24px (shorthand
 *         `padding: 0 var(--slate-space-5)`)
 *   CITE  settings-accessories-cup-warmer .settings-subnav-btn [i=30] background-color =
 *         rgb(176, 196, 206) / [prov-light] rgb(49, 92, 112) ← slate-shell.css
 *         `… .slate-nav-selected, … [aria-current="true"], … [aria-selected` authored
 *         (NOT CAPTURED — set via a CSS shorthand) !important=yes (token-driven)
 *         = --ui-selected-face
 *   CITE  settings-accessories-cup-warmer .settings-subnav-btn [i=30] color = rgb(18, 24, 28)
 *         / [prov-light] rgb(248, 252, 253) ← same rule, authored `var(--slate-selected-ink)`
 *         !important=yes (token-driven) = --ui-selected-ink
 */

/* THE COLUMN IS THE SEAM DRAWER, not the row (CONVENTIONS §13): a 1px grid gap over
 * --ui-line. This is the whole of T2's second half. Slate tried to draw the separator from
 * the row itself —
 *     #subpage-host #sub-categories-panel > * + * .settings-subnav-btn,
 *     #subpage-host #sub-categories-panel > * + *.settings-subnav-btn
 *         { box-shadow: inset 0 var(--slate-hairline) 0 var(--slate-line); }
 * (slate-shell.css:430-434) — and `> * + *` never matches, because settings.js:6426 returns
 * a single <ul> and there is no second child. Measured result:
 *   CITE settings-accessories-cup-warmer .settings-subnav-btn [i=34] box-shadow = none
 *        ← (no declaration — inherited or initial value) (FROZEN/hardcoded)
 * A gap needs no sibling selector, so N cells give N-1 seams and the rule cannot half-match.
 * Written out here rather than imported because a gallery state is light-DOM markup; the real
 * consumer uses the `seams` fragment from src/components/seams.js.
 *
 * 338px is Slate's own measured sub-nav width (the rects above). */
const column = (rows, { width = '338px' } = {}) =>
    '<div style="display:grid; gap:var(--ui-seam); background-color:var(--ui-line);'
    + ` align-content:start; inline-size:${width}">` + rows.join('') + '</div>';

const row = (label, attrs = '') => `<ui-subnav-row ${attrs}>${label}</ui-subnav-row>`;

/* A plain cell of the SAME token, standing in for the category column (#24). It is a bare
 * div rather than a <ui-nav-row> so this entry never depends on another builder's file
 * loading — and because that IS T2's fix stated as markup: neither column holds a number, so
 * neither can drift. */
const catRow = () =>
    '<div style="block-size:var(--ui-nav-row); background-color:var(--ui-fascia)"></div>';

/* Slate's own sub-categories, read read-only from the corpus state ids: the Calibration
 * category is the six-row column (settings-calibration-*), Accessories the three-row one. */
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
