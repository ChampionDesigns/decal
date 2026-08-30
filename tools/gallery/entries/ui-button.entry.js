/**
 * The gallery entry for.
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
