/**
 * ui-section-header.entry.js - the gallery entry for component #27 (wave 2, item #27).
 *
 * WHY THIS IS A FILE OF ITS OWN, and not an append to ../entries.js.
 * tools/gallery/README.md:12 says "Edit entries.js. That is the whole procedure", and
 * that procedure is correct for ONE author. Wave 1 ran sixteen builders in parallel
 * under a whole-file-write rule and sixteen appends to one array clobbered each other,
 * so the wave adopted the per-entry split (entries.js:30-45). Wave 2 runs twelve
 * builders, so the same rule binds: each builder owns one file here and the wave's
 * cross-cutting writer wires them into `entries.js` once, serially:
 *
 *     import { entry as uiSectionHeader } from './entries/ui-section-header.entry.js';
 *     export const entries = [ ...existing, uiSectionHeader ];
 *
 * `module` stays relative to tools/gallery/ as the README specifies - gallery.js does
 * the `import(entry.module)`, so the specifier resolves against gallery.js wherever
 * the entry object was authored.
 *
 * STATE IDS ARE CAPTURE FILENAMES (`ui-section-header--<state>`): identifiers, not
 * labels. A rename is a re-baseline.
 *
 * ONE STATE DELIBERATELY SHOWS A LIST AROUND THE COMPONENT, not the component alone:
 * the stick is the whole point of #27 and a caption photographed on a blank stage
 * cannot show its context. THE STUCK STATE ITSELF IS NOT A GALLERY STATE, and that is
 * a measured limitation rather than an omission - `gallery.js:84` mounts a state with
 * `stageHost.innerHTML`, and innerHTML never executes a `<script>`, so a state cannot
 * pre-scroll its own port. A state that carried one would photograph the RESTING list
 * while claiming to be the scrolled one, which is worse than not shipping it. The
 * stick is asserted mechanically instead - test/render/ui-section-header.render.test.mjs
 * scrolls the port over CDP and checks the band's top against the port's, the ground's
 * opacity, and `elementFromPoint` through the stuck band - which is the same question
 * a screenshot asks, answered where the answer can be checked.
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
        + 'slate-shell.css:2044-2049). A --ui-section-head-h band on --ui-fascia, '
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
                'Slate\'s band exactly: 60px on --ui-fascia, 24px inset, 8px of bottom '
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
                + 'between rows belongs to the LIST, not to the caption - Slate drew a '
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
                + 'departure from Slate, which never meets a narrow container because its '
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
