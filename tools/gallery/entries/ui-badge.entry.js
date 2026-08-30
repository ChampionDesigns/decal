/**
 * ui-badge.entry.js - the gallery entry for component #12 (wave 1, item #12).
 *
 * WHY THIS IS A FILE OF ITS OWN, and not an append to ../entries.js.
 * tools/gallery/README.md:12 says "Edit entries.js. That is the whole procedure",
 * and that procedure is correct for ONE author. Wave 1 runs sixteen builders in
 * parallel under a whole-file-write rule, so sixteen appends to one array clobber
 * each other. Each builder therefore owns one file here and the wave's GATE agent
 * wires them into `entries.js` (import + spread, or a manifest) once, serially.
 * The shape below is exactly the documented one, so the wiring is mechanical:
 *
 *     import { entry as uiBadge } from './entries/ui-badge.entry.js';
 *     export const entries = [ ...existing, uiBadge ];
 *
 * `module` stays relative to tools/gallery/ as the README specifies - gallery.js
 * does the `import(entry.module)`, so the specifier resolves against gallery.js
 * wherever the entry object was authored.
 *
 * STATE IDS ARE CAPTURE FILENAMES (`ui-badge--<state>`): identifiers, not labels.
 * A rename is a re-baseline.
 */

export const entry = {
    id: 'ui-badge',
    title: 'Badge',
    module: '../../src/components/ui-badge.js',
    notes:
        'Component #12, the small status marker on rows and headers (spec §5.1 #12, '
        + '9/2/1 uses). Three variants and one size: neutral --ui-key-on, active '
        + '--ui-primary, attention an 18% --ui-tint-power wash. The two states exist '
        + 'because they are exceptional - one marks the single active item, the other '
        + 'the single one needing attention. Not interactive, not a selection surface, '
        + 'and deliberately below the 48px hit floor: the ROW is the target.',
    states: [
        {
            id: 'default',
            title: 'Default (a count)',
            notes:
                'Slate\'s .slate-badge exactly: --ui-key-on face, --ui-text-2 ink, 14px '
                + '--ui-text-2xs at --ui-weight-medium, --ui-radius corners, --ui-space-2 '
                + 'inline padding. No declared height - the box IS the line box.',
            html: '<ui-badge>2</ui-badge>',
        },
        {
            id: 'variants',
            title: 'The three variants',
            notes:
                'default / active / attention side by side, which is the comparison that '
                + 'matters: a badge that says the same thing on every row says nothing. '
                + 'Active and attention carry --ui-weight-semibold where Slate carried 600 '
                + '(styles/tokens.css:369-371 - three weights, not five).',
            html:
                '<div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap">'
                + '<ui-badge>2</ui-badge>'
                + '<ui-badge variant="active">Active</ui-badge>'
                + '<ui-badge variant="attention">Update available</ui-badge>'
                + '</div>',
        },
        {
            id: 'on-a-row',
            title: 'On a row, as it is actually used',
            notes:
                'The shape wave 2 #26 (List row) consumes: a title with a marker at the '
                + 'far end. The badge is 21px in a 64px row and takes no focus - the row '
                + 'is the hit target, not the marker.',
            html:
                '<div style="display:flex; align-items:center; justify-content:space-between;'
                + ' gap:16px; min-block-size:64px; padding:0 24px">'
                + '<span>Londinium Espresso</span><ui-badge variant="active">Active</ui-badge>'
                + '</div>',
        },
        {
            id: 'counts',
            title: 'Counts, one to three digits',
            notes:
                'Slate\'s own set: 24.83px at one digit and 30px at two (folder counts on '
                + 'the profile selector). The marker is sized by its text, not by a track.',
            html:
                '<div style="display:flex; gap:12px; align-items:center">'
                + '<ui-badge label="2 profiles">2</ui-badge>'
                + '<ui-badge label="12 profiles">12</ui-badge>'
                + '<ui-badge label="128 profiles">128</ui-badge>'
                + '</div>',
        },
        {
            id: 'narrow-container',
            title: 'In a 96px container',
            notes:
                'The host is narrow at an unchanged viewport. The marker clamps to its '
                + 'container and ellipsises rather than escaping the row it belongs to - '
                + 'a departure from Slate, which never meets a narrow container because '
                + 'its geometry is frozen at 1920x1200. It never wraps to two lines.',
            hostStyle: { 'inline-size': '96px' },
            html: '<ui-badge variant="attention">Update available</ui-badge>',
        },
    ],
};

export default entry;
