/**
 * The gallery entry for.
 */

const MACHINE_INFO = JSON.stringify([
    { term: 'Model', value: 'Bengle' },
    { term: 'Firmware version', value: '282' },
    { term: 'Serial number', value: '888888' },
    { term: 'Group head controller', value: 'Enabled' },
    { term: 'Refill Kit', value: 'Enabled' },
    { term: 'Voltage', value: '245 V' },
]);

const WITH_ABSENCE = JSON.stringify([
    { term: 'Model', value: 'Bengle' },
    { term: 'Firmware version', value: null },
    { term: 'Serial number', value: '' },
    { term: 'Group head controller', value: { noReading: true, reason: 'absent' } },
    { term: 'Refill Kit', value: { noReading: true, reason: 'permanent' } },
    { term: 'Voltage', value: 0 },
]);

const LONG = JSON.stringify([
    { term: 'Model', value: 'Bengle' },
    { term: 'Serial number', value: 'BNG-8888880000000111112222233333444445555' },
    { term: 'Source', value: 'port/rea-bench-v3' },
]);

export const entry = {
    id: 'ui-definition-card',
    title: 'Definition card',
    module: './entries/ui-definition-card.demo.js',
    notes:
        'Component #50, the settings screen\'s label/value info card — the '
        + '`machine-machine-info` leaf (spec §5.2 row 50). A compound of #8: the card '
        + 'paints, owns the inset and owns bounded scroll; this adds the term/value '
        + 'rows and the header. THE DIVIDERS ARE GRID GAPS, not per-row borders '
        + '(CONVENTIONS §13, which names these five rows): N rows give N−1 seams with '
        + 'no sibling selector to get wrong, which is why T2\'s mechanism cannot be '
        + 'expressed here. The reference skin draws 5 hairlines for 7 rows — the header and the '
        + 'first data row have none — and this draws 6 for 7; that departure is the '
        + 'one visible difference from the oracle and it is deliberate. Terms are '
        + '.ui-heading (20/500, measured), values .ui-body.ui-numeric (17/400, '
        + 'measured). An absent value is the em dash plus a screen-reader sentence, '
        + 'never a recomputed number (A7).',
    states: [
        {
            id: 'machine-info',
            title: 'The machine-info leaf, at the reference skin\'s own column width',
            notes:
                'The oracle record rebuilt: CITE settings-machine-machine-info '
                + '.slate-card [i=47] rect x=629 y=273 w=1200 h=492, seven rows, and '
                + 'CITE .slate-btn [i=49] "Copy all" rect w=114 h=64 in the header. '
                + 'The 1200px is the CONTAINER\'s, not the card\'s: the reference skin\'s geometry '
                + 'is frozen at 1920×1200 and has no vote on any other width.',
            hostStyle: { 'inline-size': '1200px' },
            html:
                '<ui-definition-card heading="Machine" items=\'' + MACHINE_INFO + '\'>'
                + '<ui-button slot="actions">Copy all</ui-button>'
                + '</ui-definition-card>',
        },
        {
            id: 'no-heading',
            title: 'Rows only — no heading, no action',
            notes:
                'The header row is removed from the grid entirely rather than left '
                + 'empty, so it draws no phantom seam: six rows, five seams.',
            hostStyle: { 'inline-size': '760px' },
            html: '<ui-definition-card items=\'' + MACHINE_INFO + '\'></ui-definition-card>',
        },
        {
            id: 'heading-only',
            title: 'A heading with no action',
            notes:
                'Departure 3: the header row states its own floor, --ui-control-h, '
                + 'instead of borrowing 64px from whichever control happens to be '
                + 'slotted into it. Compare the rhythm with `machine-info`.',
            hostStyle: { 'inline-size': '760px' },
            html:
                '<ui-definition-card heading="Machine" items=\'' + MACHINE_INFO + '\'>'
                + '</ui-definition-card>',
        },
        {
            id: 'absent',
            title: 'Absence renders as the dash, and zero does not',
            notes:
                'A7 (`src/data/reading.js`:12): "A missing channel renders as a gap '
                + 'or a dash, never as … a zero that reads as a measurement." Four '
                + 'shapes here — null, the empty string, and two NO_READING objects '
                + 'straight from the address layer — all render the em dash with the '
                + '"no reading" sentence exposed beside it; Voltage is 0 and renders '
                + 'as 0, because a zero IS a reading.',
            hostStyle: { 'inline-size': '760px' },
            html:
                '<ui-definition-card heading="Machine" items=\'' + WITH_ABSENCE + '\'>'
                + '</ui-definition-card>',
        },
        {
            id: 'narrow',
            title: 'In a 320px container',
            notes:
                'The question the reference skin cannot answer (departure 4). Term and value wrap '
                + 'onto separate lines and the value keeps its end alignment; nothing '
                + 'is clipped and the card never scrolls sideways.',
            hostStyle: { 'inline-size': '320px' },
            html:
                '<ui-definition-card heading="Machine" items=\'' + MACHINE_INFO + '\'>'
                + '<ui-button slot="actions">Copy all</ui-button>'
                + '</ui-definition-card>',
        },
        {
            id: 'unbreakable',
            title: 'A value with no break opportunity',
            notes:
                '§2.4\'s no-silent-clip rule at the level of one word: a 40-character '
                + 'serial breaks rather than spilling out of the surface.',
            hostStyle: { 'inline-size': '360px' },
            html: '<ui-definition-card heading="Machine" items=\'' + LONG + '\'></ui-definition-card>',
        },
        {
            id: 'tight',
            title: 'pad="tight" — #8\'s second inset',
            notes:
                'The inset is forwarded, never re-declared: --ui-space-4 (18px), '
                + 'which is spec §3.3\'s own snap for the reference skin\'s 16px ("16 → 18").',
            hostStyle: { 'inline-size': '760px' },
            html:
                '<ui-definition-card pad="tight" heading="Machine" items=\''
                + MACHINE_INFO + '\'></ui-definition-card>',
        },
        {
            id: 'scrolling',
            title: 'Capped from outside, scrolling inside',
            notes:
                'The cap arrives as `max-block-size` on the host, exactly as '
                + 'The notes pane is asked for, and #8\'s bounded '
                + 'scroll does the rest: a stated overflow, a VISIBLE scrollbar and '
                + 'the §2.4 floor. The card takes a tab stop in this mode and the '
                + 'ring is drawn INSIDE its own box so the scrollport cannot clip it '
                + '(bug L24).',
            hostStyle: { 'inline-size': '760px' },
            html:
                '<ui-definition-card scroll style="max-block-size: 260px" '
                + 'heading="Machine" items=\'' + MACHINE_INFO + '\'>'
                + '<ui-button slot="actions">Copy all</ui-button>'
                + '</ui-definition-card>',
        },
        {
            id: 'wide',
            title: 'In a 1000px container',
            notes:
                'The other end of the same proof as `narrow`. Nothing in the '
                + 'component pins a width; the container owns the dimension, once '
                + '(spec §2.3, "One owner per dimension").',
            hostStyle: { 'inline-size': '1000px' },
            html:
                '<ui-definition-card heading="Machine" items=\'' + MACHINE_INFO + '\'>'
                + '<ui-button slot="actions">Copy all</ui-button>'
                + '</ui-definition-card>',
        },
    ],
};

export default entry;
