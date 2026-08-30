/**
 * ui-icon-button.entry.js — the gallery entry for Wave 1 item #2.
 *
 * WHY THIS IS A FILE OF ITS OWN, and not a block appended to `entries.js`:
 * `tools/gallery/entries.js` is ONE shared array in ONE file, and sixteen Wave 1
 * builders writing whole files into it at the same time clobber each other. So each
 * builder owns a file here, exporting the documented entry shape unchanged, and the
 * wave's GATE agent wires them into `entries.js` (import + spread, or a manifest).
 * Nothing else about the gallery changes: `tools/gallery/README.md:12` — "Edit
 * entries.js. That is the whole procedure" — still describes the registration, only
 * with the edit made once by the gate rather than sixteen times in parallel.
 *
 * STATE IDS ARE CAPTURE FILENAMES (`<entry.id>--<state.id>`), so they are
 * identifiers, not labels: renaming one is a re-baseline.
 *
 * `hostStyle` sizes the STAGE, never the viewport. It is how the squeeze state says
 * "in a 40px slot", which is the only honest way to show that a fixed control does
 * not shrink to fit a parent that is too small for it (spec §2.1 Rule 1, §2.3 case 2).
 */

/**
 * The glyph, inline, so the gallery needs no asset pipeline. Stroke and fill stay
 * ON THE ARTWORK (spec §2.3 case 3: "icon and glyph geometry intrinsic to the
 * artwork"); the component only sizes it, to --ui-icon / --ui-icon-lg. `currentColor`
 * is how it takes the button's ink, which is --ui-text-2 in both themes.
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
        + 'Slate COMPUTES on its modal closes — those three elements are captured at '
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
                + '<- slate-components.css .slate-icon-btn authored var(--slate-control-height). '
                + 'That is the COMPUTED value and its winning rule; the same record\'s rect is '
                + '58x58, because those dialogs sit inside #scaled-content (see the component header).',
            html: `<ui-icon-button label="Choose a profile">${GLYPH}</ui-icon-button>`,
        },
        {
            id: 'lg',
            title: 'Large (82px)',
            notes: 'ORACLE editor-review #editor-history-btn [i=11] width = 82px '
                + '<- slate-components.css .slate-icon-btn-lg authored var(--slate-control-lg).',
            html: `<ui-icon-button size="lg" label="Version history">${GLYPH}</ui-icon-button>`,
        },
        {
            id: 'pair',
            title: 'Both sizes, shoulder to shoulder',
            notes: 'The same component one size token apart — the sheet\'s own claim '
                + '(slate-components.css:227-231), rendered.',
            html: `<ui-icon-button label="Choose a profile">${GLYPH}</ui-icon-button>`
                + `<ui-icon-button size="lg" label="Version history">${GLYPH}</ui-icon-button>`,
        },
        {
            id: 'text-glyph',
            title: 'Text glyph',
            notes: 'Slate\'s three modal closes are a bare ✕ at the browser-default 16px '
                + 'and carry NO accessible name (corpus: aria=""). Here the glyph is drawn '
                + 'at --ui-icon and the name comes from label.',
            html: '<ui-icon-button label="Close">✕</ui-icon-button>',
        },
        {
            id: 'disabled',
            title: 'Disabled',
            notes: '--ui-opacity-disabled (.38, spec §3.7) against Slate\'s .3, and applied '
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
