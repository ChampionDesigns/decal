/**
 * The gallery entry for the icon button. Its states are the two sizes alone and shoulder
 * to shoulder, a text glyph in place of an icon, disabled, the inset focus ring a clipping
 * band needs, and a slot smaller than the button's own hit floor.
 */

const GLYPH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    + 'stroke-width="1.6" stroke-linecap="round" aria-hidden="true">'
    + '<path d="M4 7h16M4 12h16M4 17h16"></path></svg>';

export const entry = {
    id: 'ui-icon-button',
    title: 'Icon button',
    module: '../../src/components/ui-icon-button.js',
    notes:
        'Wave 1 item #2. A square press control holding a glyph at --ui-icon / '
        + '--ui-icon-lg. Two sizes and nothing else: 64px (--ui-control-h, the value '
        + 'the reference skin COMPUTES on its modal closes — those three elements are captured at '
        + '58x58 through #scaled-content\'s transform, and no element in the corpus '
        + 'renders a 64x64 box) and 82px (--ui-control-lg, the size its toolbars '
        + 'render). Both clear the 48px hit floor with paint alone, which is the half '
        + 'bug L22 gets wrong; P4 is NOT a floor bug — its box is 64 against a 48px '
        + 'floor, and the defect is a hard-coded 64 standing in for the token, so what '
        + 'this control answers there is the drill, not the measurement. '
        + 'What to look at: the two squares are '
        + 'the same control one token apart, the glyph scales with the square, and '
        + 'the disabled one is dimmed exactly once — .38, not .38 squared.',
    states: [
        {
            id: 'md',
            title: 'Default (64px)',
            notes: 'ORACLE profile-selector #add-profile-modal-close [i=200] width = 64px '
                + 'the old icon button authored the control-height token. '
                + 'That is the COMPUTED value and its winning rule; the same record\'s rect is '
                + '58x58, because those dialogs sit inside #scaled-content (see the component header).',
            html: `<ui-icon-button label="Choose a profile">${GLYPH}</ui-icon-button>`,
        },
        {
            id: 'lg',
            title: 'Large (82px)',
            notes: 'ORACLE editor-review #editor-history-btn [i=11] width = 82px '
                + 'the old large icon button authored the control-lg token.',
            html: `<ui-icon-button size="lg" label="Version history">${GLYPH}</ui-icon-button>`,
        },
        {
            id: 'pair',
            title: 'Both sizes, shoulder to shoulder',
            notes: 'The same component one size token apart — the sheet\'s own claim '
                + ', rendered.',
            html: `<ui-icon-button label="Choose a profile">${GLYPH}</ui-icon-button>`
                + `<ui-icon-button size="lg" label="Version history">${GLYPH}</ui-icon-button>`,
        },
        {
            id: 'text-glyph',
            title: 'Text glyph',
            notes: 'the reference skin\'s three modal closes are a bare ✕ at the browser-default 16px '
                + 'and carry NO accessible name (corpus: aria=""). Here the glyph is drawn '
                + 'at --ui-icon and the name comes from label.',
            html: '<ui-icon-button label="Close">✕</ui-icon-button>',
        },
        {
            id: 'disabled',
            title: 'Disabled',
            notes: '--ui-opacity-disabled (.38, spec §3.7) against the reference skin\'s .3, and applied '
                + 'ONCE: the host dims, the inner control does not dim again.',
            html: `<ui-icon-button label="Add New Profile" disabled>${GLYPH}</ui-icon-button>`,
        },
        {
            id: 'in-a-clipping-band',
            title: 'In a clipping band (focus-ring="inset")',
            notes: 'Bug L24\'s shape — a control inside overflow: hidden. Tab to it: one '
                + 'ring, drawn inside its own box, uncut on all four sides.',
            hostStyle: { 'inline-size': '220px' },
            html: '<div style="overflow:hidden;display:flex;gap:0">'
                + `<ui-icon-button focus-ring="inset" label="Back to main screen">${GLYPH}</ui-icon-button>`
                + `<ui-icon-button focus-ring="inset" label="Toggle Fullscreen">${GLYPH}</ui-icon-button>`
                + '</div>',
        },
        {
            id: 'squeezed',
            title: 'In a 40px slot',
            notes: 'A touch floor a parent can shrink is not a floor (bug T9\'s class). '
                + 'The square holds at 64px and overflows the slot instead.',
            hostStyle: { 'inline-size': '40px' },
            html: '<div style="display:flex;inline-size:40px">'
                + `<ui-icon-button label="Choose a profile">${GLYPH}</ui-icon-button>`
                + '</div>',
        },
    ],
};

export default entry;
