/**
 * ui-data-grid.entry.js — the gallery entry for component #34 (wave 4, item #34).
 *
 * WHY THIS IS A FILE OF ITS OWN, and not an append to ../entries.js.
 * tools/gallery/README.md:12 says "Edit entries.js. That is the whole procedure", and
 * that procedure is correct for ONE author. Wave 1 ran sixteen builders in parallel under
 * a whole-file-write rule and sixteen appends to one array clobbered each other, so the
 * wave adopted the per-entry split (entries.js:30-45). Wave 4 runs the same way: each
 * builder owns one file here and the wave's cross-cutting writer wires them into
 * `entries.js` once, serially:
 *
 *     import { entry as uiDataGrid } from './entries/ui-data-grid.entry.js';
 *     export const entries = [ ...existing, uiDataGrid ];
 *
 * `module` stays relative to tools/gallery/ as the README specifies, and it points at the
 * DEMO sidecar rather than at the component — see ui-data-grid.demo.js for the one
 * mechanical reason (a state's markup is a string, and this component's data are
 * properties).
 *
 * STATE IDS ARE CAPTURE FILENAMES (`ui-data-grid--<state>`): identifiers, not labels. A
 * rename is a re-baseline.
 *
 * WHAT THE STATES ARE FOR. The row's acceptance test is "the defect cannot be expressed",
 * and the two defects are structural — H4 is a role="grid" with no rows, L23 is rows that
 * own nothing — so neither is visible in a photograph. That half is asserted from
 * Chrome's own accessibility tree in test/render/ui-data-grid.render.test.mjs. What these
 * states DO show is the half that is visible: one table where there were three, the fixed
 * tracks gone (§4.5), the header rule continuous instead of segmented, and the emphasis
 * on the Total row alive instead of overridden to nothing.
 */

/** The stage sizes below are the CONTAINER, not the viewport (spec §2.1 Rule 1) —
 *  `hostStyle` sets the stage box and the component reads that, never the window. */
const AB = (key) => '<button slot="cell-' + key + '-ab" style="min-block-size:44px;'
    + ' min-inline-size:44px">A</button>'
    + '<button slot="cell-' + key + '-ab" style="min-block-size:44px;'
    + ' min-inline-size:44px">B</button>';

const LIST_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6'];
const LIST = '<ui-data-grid-list>' + LIST_KEYS.map(AB).join('') + '</ui-data-grid-list>';

export const entry = {
    id: 'ui-data-grid',
    title: 'Data grid / table',
    module: './entries/ui-data-grid.demo.js',
    notes:
        'Component #34, one tabular component behind Live\'s shot-data panel, the '
        + 'History data page and the History shot list — three implementations today with '
        + 'three different grid semantics. The tracks are the whole of spec §4.5: the '
        + 'row-label track is max-content across ALL rows (one grid, not seven inline '
        + 'templates — bug L20) and every value track is fr over a ch floor, so the fixed '
        + '210 / 110 / 84 / 140 / 80 / 88 / 94px tracks are gone. Type is the shared '
        + 'roles: .ui-microcap for both header kinds, .ui-numeric for the cells. It draws '
        + 'NO border — a divider is a gap, not a border (CONVENTIONS §13) — and paints an '
        + 'opaque --ui-fascia ground so it is a legal seam cell rather than a hole. Not '
        + 'selectable: the four dials reach nothing here, and there is a test that proves '
        + 'it.',
    states: [
        {
            id: 'phase-table',
            title: 'Phase table (Live shot data, History data page)',
            notes:
                'Slate\'s own columns and rows (index.html:359-400). The row-label track '
                + 'is max-content, the three channels are equal fr — "the columns are '
                + 'equal because the channels are peers; none of them is the headline, '
                + 'and sizing one larger would be a claim about which matters that the '
                + 'data does not support" (slate-live.css:1895-1897). The Volume column '
                + 'carries channel ink. The Total row is emphasised — on Live that '
                + 'emphasis was authored and DEAD, overridden to font-weight 300 for '
                + 'every cell in the panel.',
            hostStyle: { 'inline-size': '760px' },
            html: '<ui-data-grid-phase></ui-data-grid-phase>',
        },
        {
            id: 'absent-readings',
            title: 'A shot that never left preinfusion',
            notes:
                'Absence is a dash and nothing else ever happens to it (A7). The '
                + 'Extraction row has no cells at all and the Total row\'s volume is an '
                + 'absence from the address layer carrying reason "permanent" — a stored '
                + 'shot recorded before the channel existed. Nothing is recomputed, '
                + 'substituted or zeroed: "an em dash says not applicable here; an empty '
                + 'cell says we forgot" (history-viewer.js:827-830).',
            hostStyle: { 'inline-size': '760px' },
            html: '<ui-data-grid-absent></ui-data-grid-absent>',
        },
        {
            id: 'shot-list',
            title: 'Shot list, with the A/B controls slotted in',
            notes:
                'The second variant: no row-header column, so every track is fr — a '
                + 'grow: 3 profile column beside five peers. The outcome columns are '
                + 'right-aligned under right-aligned headers, "so two shots\' figures can '
                + 'be read down the column instead of hunted for" (slate-live.css:2459). '
                + 'The last column is a control column: the screen slots #45 pick discs '
                + 'into the cells, and they keep their own accessible node inside their '
                + 'row and take the one focus ring at the inset offset the scroll frame '
                + 'carries.',
            hostStyle: { 'inline-size': '900px' },
            html: LIST,
        },
        {
            id: 'scrolling-list',
            title: 'The same list in a 240px track',
            notes:
                'History\'s data page is grid-rows auto auto minmax(0,1fr) with "the '
                + 'list scrolls" (spec §4.5). A percentage maximum against an auto-height '
                + 'parent computes to none, so the same component is simply as tall as '
                + 'its rows in ordinary flow and stops at the track here. The scrollbar '
                + 'is visible on purpose — spec §2.4 bans hiding it, which is bug T16.',
            hostStyle: { 'inline-size': '900px', 'block-size': '240px', display: 'grid', 'grid-template-rows': 'minmax(0, 1fr)' },
            html: LIST,
        },
        {
            id: 'narrow-container',
            title: 'In a 280px container',
            notes:
                'The host is narrow at an unchanged viewport. The tracks shrink to their '
                + 'ch minimums and then stop, and the frame scrolls in the inline axis '
                + 'rather than letting a column collapse to nothing. A departure from '
                + 'Slate, which never meets a narrow container because its geometry is '
                + 'frozen at 1920x1200; the floor is the tracks themselves, which is why '
                + 'there is no fourth hand-derived pixel constant.',
            hostStyle: { 'inline-size': '280px' },
            html: LIST,
        },
        {
            id: 'empty',
            title: 'Empty, with the header kept',
            notes:
                'A table with no rows is still a table with columns, so the header and '
                + 'its rule stay and the space below is a slot — the home for #38\'s '
                + 'empty state. Slate switches its grid to display: block for the same '
                + 'reason (slate-live.css:1905).',
            hostStyle: { 'inline-size': '760px' },
            html: '<ui-data-grid-empty>'
                + '<ui-empty-state slot="empty" heading="No shots stored yet"'
                + ' body="Pull a shot and it will appear here."></ui-empty-state>'
                + '</ui-data-grid-empty>',
        },
    ],
};

export default entry;
