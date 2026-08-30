/**
 * ui-slider.entry.js — the gallery entry for Wave 1 item #23 (Slider).
 *
 * A PER-ENTRY FILE, not an edit to `tools/gallery/entries.js`. That file is one
 * shared array and sixteen wave-1 builders write whole files, so sixteen appends to
 * it are fifteen lost entries. The GATE agent wires these in (import + spread, or a
 * manifest); the shape below is exactly what `entries.js` documents, so wiring is
 * mechanical and `test/render/gallery.render.test.mjs` fails loudly if it is not.
 *
 * `module` is resolved by `tools/gallery/gallery.js` (`import(entry.module)`), so it
 * is relative to `tools/gallery/`, not to this directory.
 *
 * STATE IDS ARE CAPTURE FILENAMES (`<entry.id>--<state.id>`), so they are
 * identifiers rather than labels. The five below are the five things worth looking
 * at: the resting control, the fill at both ends of its travel, the origin-anchored
 * variant the HV align slider needs, the disabled dim, and the control in a narrow
 * container — which is the only honest way to show something that reads its own
 * container rather than the viewport (spec §2.1 Rule 1).
 */

export const entry = {
    id: 'ui-slider',
    title: 'Slider',
    module: '../../src/components/ui-slider.js',
    notes:
        'The primitive Slate never had (DECISIONS.md:251) — one thumb spec for both '
        + 'engines (bug T22), a 48px hit box around an 8px track through the shared '
        + 'hit-area utility, and the fill in --ui-steel over --ui-line, which is what '
        + 'the oracle measures in both themes.',
    states: [
        {
            id: 'resting',
            title: 'Resting (40 of 100)',
            html: '<ui-slider value="40" label="Rating"></ui-slider>',
        },
        {
            id: 'rating',
            title: 'Rating, 1–5',
            notes:
                'Live\'s rating slider, as a primitive: 147x32 in Slate, 48px tall here '
                + 'because 32px is bug-adjacent (CONVENTIONS §5, spec §2.3 case 2).',
            hostStyle: { 'inline-size': '340px' },
            html: '<ui-slider min="1" max="5" step="1" value="4" label="Rating" value-text="4 of 5"></ui-slider>',
        },
        {
            id: 'origin-centre',
            title: 'Centre-zero (align, −5…+5 s)',
            notes:
                'The History align slider\'s fill, which runs from the MIDPOINT so a '
                + 'slider sitting at 0.0 s reads as centred rather than as 60% of '
                + 'something (slate-live.css:2350-2356). One property, not a second gradient.',
            hostStyle: { 'inline-size': '520px' },
            html: '<ui-slider min="-5" max="5" step=".1" origin="0" value="-1.8" label="Align B" value-text="-1.8 s"></ui-slider>',
        },
        {
            id: 'disabled',
            title: 'Disabled',
            notes:
                'One dim, not two: --ui-opacity-disabled is painted on the host, and the '
                + 'inner input carries the native attribute that actually refuses input.',
            html: '<ui-slider value="40" label="Rating" disabled></ui-slider>',
        },
        {
            id: 'narrow-container',
            title: 'Narrow container (200px)',
            notes:
                'The viewport has not moved; the HOST has. The track follows its container '
                + 'and the 48px hit box does not shrink with it.',
            hostStyle: { 'inline-size': '200px' },
            html: '<ui-slider value="70" label="Rating"></ui-slider>',
        },
        {
            id: 'flex-row',
            title: 'In a flex row, beside a label',
            notes:
                'The shape both of Slate\'s own consumers have (slate-live.css:1551 and '
                + ':2348 each state their own flex), and the one that used to render 0px '
                + 'wide: container-type: inline-size gives the host a zero max-content '
                + 'size, so an unsized slider in a flex row vanished while still eating a '
                + '48px line. The host opts out (CONVENTIONS §2); the row states flex: 1.',
            hostStyle: { 'inline-size': '560px' },
            html:
                '<div style="display:flex;align-items:center;gap:18px">'
                + '<span>Align B</span>'
                + '<ui-slider style="flex:1 1 auto;min-inline-size:0" min="-5" max="5" step="any" '
                + 'origin="0" value="1.2" label="Align B" value-text="+1.2 s"></ui-slider>'
                + '<span>+1.2 s</span></div>',
        },
    ],
};

export default entry;
