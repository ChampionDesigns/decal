/**
 * The gallery entry for the data grid. Its states are the phase table, a shot with
 * readings missing, a shot list with its controls slotted in, the same list in a track
 * short enough to scroll, a host too narrow for the columns, and an empty grid that keeps
 * its header.
 */

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
                'The reference skin\'s own columns and rows (index.html:359-400). The row-label track '
                + 'is max-content, the three channels are equal fr — "the columns are '
                + 'equal because the channels are peers; none of them is the headline, '
                + 'and sizing one larger would be a claim about which matters that the '
                + 'data does not support". The Volume column '
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
                + 'be read down the column instead of hunted for". '
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
                + 'the reference skin, which never meets a narrow container because its geometry is '
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
                + 'empty state. The reference skin switches its grid to display: block for the same '
                + 'reason.',
            hostStyle: { 'inline-size': '760px' },
            html: '<ui-data-grid-empty>'
                + '<ui-empty-state slot="empty" heading="No shots stored yet"'
                + ' body="Pull a shot and it will appear here."></ui-empty-state>'
                + '</ui-data-grid-empty>',
        },
    ],
};

export default entry;
