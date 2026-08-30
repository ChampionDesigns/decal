/**
 * ui-button.entry.js - the gallery entry for component #1 (wave 1, item #1).
 *
 * WHY THIS IS A FILE OF ITS OWN, and not an append to ../entries.js.
 * tools/gallery/README.md:12 says "Edit entries.js. That is the whole procedure",
 * and that procedure is correct for ONE author. Wave 1 runs sixteen builders in
 * parallel under a whole-file-write rule, so sixteen appends to one array clobber
 * each other. Each builder therefore owns one file here and the wave's GATE agent
 * wires them into `entries.js` (import + spread, or a manifest) once, serially.
 * The shape below is exactly the documented one, so the wiring is mechanical:
 *
 *     import { entry as uiButton } from './entries/ui-button.entry.js';
 *     export const entries = [ ...existing, uiButton ];
 *
 * `module` stays relative to tools/gallery/ as the README specifies - gallery.js
 * does the `import(entry.module)`, so the specifier resolves against gallery.js
 * wherever the entry object was authored.
 *
 * STATE IDS ARE CAPTURE FILENAMES (`ui-button--<state>`): identifiers, not labels.
 * A rename is a re-baseline.
 */

export const entry = {
    id: 'ui-button',
    title: 'Button',
    module: '../../src/components/ui-button.js',
    notes:
        'Component #1, the one press control (spec §5.1 #1, 135 uses). The primary '
        + 'variant actually paints --ui-primary: bug P8 is a screen sheet flattening it '
        + 'to transparent so the affirmative action rendered identical to Cancel. '
        + 'Default height --ui-control-h (64px), tall --ui-control-lg (82px). Disabled '
        + 'is ONE dial (--ui-opacity-disabled) applied once, on the host.',
    states: [
        {
            id: 'default',
            title: 'Default',
            html: '<ui-button>Start over</ui-button>',
        },
        {
            id: 'variants',
            title: 'The four variants',
            notes:
                'default / primary / ghost / danger, side by side. Primary against '
                + 'default is P8\'s exact comparison: in Slate these two paint the same.',
            html:
                '<div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap">'
                + '<ui-button>Cancel</ui-button>'
                + '<ui-button variant="primary">Confirm</ui-button>'
                + '<ui-button variant="ghost">Descaling instructions</ui-button>'
                + '<ui-button variant="danger">Delete</ui-button>'
                + '</div>',
        },
        {
            id: 'tall',
            title: 'Tall (header height)',
            notes:
                'min-block-size moves from --ui-control-h to --ui-control-lg. Orthogonal '
                + 'to variant, exactly as .slate-btn-tall is orthogonal to .slate-btn-danger.',
            html:
                '<div style="display:flex; gap:12px; align-items:center">'
                + '<ui-button tall>Close</ui-button>'
                + '<ui-button tall variant="primary">Save</ui-button>'
                + '<ui-button tall variant="danger">Delete</ui-button>'
                + '</div>',
        },
        {
            id: 'disabled',
            title: 'Disabled',
            notes:
                'One dial at .38, applied once. Slate re-paints a disabled button to a '
                + 'transparent face with muted ink; spec §3.7 settles a single opacity '
                + 'token, so a disabled primary stays navy and simply dims.',
            html:
                '<div style="display:flex; gap:12px; align-items:center">'
                + '<ui-button disabled>Start over</ui-button>'
                + '<ui-button disabled variant="primary">Zero</ui-button>'
                + '</div>',
        },
        {
            id: 'narrow-container',
            title: 'In a 260px container',
            notes:
                'The host is narrow at an unchanged viewport. The label wraps and the '
                + 'button stays inside its container; the height floor does not move, '
                + 'because ergonomics is physical (spec §2.2).',
            hostStyle: { 'inline-size': '260px' },
            html: '<ui-button variant="primary">Load factory calibration settings</ui-button>',
        },
    ],
};

export default entry;
