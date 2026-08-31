/**
 * The gallery entry for.
 */

/** Six rows, so a 240px port has something to scroll under the caption. */
const rows = (label, n) => Array.from({ length: n }, (_, i) =>
    '<div style="block-size:64px; padding:0 24px; display:flex; align-items:center;'
    + ' font-size:20px">' + label + ' ' + (i + 1) + '</div>').join('');

const LIST_STYLE = 'inline-size:420px; block-size:240px; overflow:auto;'
    + ' background:var(--ui-surface)';

export const entry = {
    id: 'ui-section-header',
    title: 'Sticky section header',
    module: '../../src/components/ui-section-header.js',
    notes:
        'Component #27, the sticky caption over a list group (spec §5.2 row 27, '
        + 'the old rule). A --ui-section-head-h band on --ui-fascia, '
        + 'bottom-anchored, with the caption and the count both on the shared '
        + '.ui-microcap type role. It sticks to the top of its scrollport at '
        + '--ui-z-sticky with an opaque ground, so the rows pass under it. It draws NO '
        + 'divider: a divider is a gap, not a border (CONVENTIONS §13) - the list draws '
        + 'the seam. Not selectable, not pressable, no state: the four selection dials '
        + 'reach nothing here, and there is a test that proves it.',
    states: [
        {
            id: 'resting',
            title: 'Resting, with a count',
            notes:
                'The reference skin\'s band exactly: 60px on --ui-fascia, 24px inset, 8px of bottom '
                + 'padding under a flex-end alignment - "the labels are deliberately '
                + 'bottom-anchored above their divider, so they are NOT centred". The '
                + 'count is the same microcap role as the caption, so there is no second '
                + 'ink to drift.',
            html: '<ui-section-header count="6" count-label="6 profiles">Your Profiles</ui-section-header>',
        },
        {
            id: 'no-count',
            title: 'Caption only',
            notes:
                'A header with no count draws no empty box - the flex gap has nothing to '
                + 'gap against. The caption is a real <h2>; the uppercase is paint, so a '
                + 'screen reader still says "Built-In Profiles".',
            html: '<ui-section-header>Built-In Profiles</ui-section-header>',
        },
        {
            id: 'in-a-list',
            title: 'In a scrolling list, at rest',
            notes:
                'The shape wave 3 #34 consumes. Two groups in a 240px port. The seam '
                + 'between rows belongs to the LIST, not to the caption - the reference skin drew a '
                + '1px border on the second header only, from its own `> * + *` rule.',
            html:
                '<div style="' + LIST_STYLE + '">'
                + '<ui-section-header count="6" count-label="6 profiles">Your Profiles</ui-section-header>'
                + rows('Londinium', 6)
                + '<ui-section-header count="72" count-label="72 profiles">Built-In Profiles</ui-section-header>'
                + rows('Decent', 6)
                + '</div>',
        },
        {
            id: 'narrow-container',
            title: 'In a 260px container',
            notes:
                'The host is narrow at an unchanged viewport. The caption ellipsises and '
                + 'the count keeps its whole box - the caption gives first, always. A '
                + 'departure from the reference skin, which never meets a narrow container because its '
                + 'geometry is frozen at 1920x1200; the band is one line at every width.',
            hostStyle: { 'inline-size': '260px' },
            html: '<ui-section-header count="128">A section caption far too long to fit in this band</ui-section-header>',
        },
        {
            id: 'trail-slot',
            title: 'With a control in the trail slot',
            notes:
                'The band accepts no press of its own - a caption with a hit box has '
                + 'nothing behind it. A control that belongs in the band goes in the '
                + '`trail` slot and brings its own hit area; it takes the one focus ring '
                + 'through the base\'s ::slotted rule, at whichever offset the host '
                + 'carries.',
            html:
                '<ui-section-header count="6">Your Profiles'
                + '<button slot="trail" style="min-block-size:48px; min-inline-size:48px">Edit</button>'
                + '</ui-section-header>',
        },
        {
            id: 'levels',
            title: 'Heading levels',
            notes:
                'level moves aria-level and nothing else - a level is semantics, not '
                + 'size, so all three render identically. An out-of-range level falls '
                + 'back to 2 rather than emitting an invalid aria-level on a real '
                + 'heading.',
            html:
                '<div style="display:grid">'
                + '<ui-section-header level="1" count="3">Level one</ui-section-header>'
                + '<ui-section-header level="3" count="3">Level three</ui-section-header>'
                + '<ui-section-header level="9" count="3">Level nine falls back to two</ui-section-header>'
                + '</div>',
        },
    ],
};

export default entry;
