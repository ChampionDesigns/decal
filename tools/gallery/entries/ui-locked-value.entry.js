/**
 * The gallery entry for.
 */

export const entry = {
    id: 'ui-locked-value',
    title: 'Locked value box',
    module: '../../src/components/ui-locked-value.js',
    notes:
        'Component #43, the editor\'s read-only value cell - "a stepper with no caps" '
        + '(SCOPE L1528). Dashed --ui-line-strong edge on --ui-surface, --ui-muted ink at '
        + '--ui-text-note, floored at --ui-control-h. Intentionally NON-INTERACTIVE '
        + '(profile_editor.js:1097): no caps, no numpad, no focus of its own. It does NOT '
        + 'own its width - Slate pinned 346px with an !important that discarded its own '
        + 'call site\'s computed width (spec §2.3 "One owner per dimension"), so here the '
        + 'container owns the inline size and the box fills it.',
    states: [
        {
            id: 'default',
            title: 'Default, at the editor column width',
            notes:
                'The Slate record at the one width the oracle can vouch for: '
                + 'CITE editor-steps .pe-stepper [i=33] rect w=346 h=64. The box matches '
                + 'the stepper it replaces because the CONTAINER is 346px, not because '
                + 'the box says so.',
            hostStyle: { 'inline-size': '346px' },
            html: '<ui-locked-value>Holds previous target</ui-locked-value>',
        },
        {
            id: 'held-target',
            title: 'The sentence it actually carries',
            notes:
                'heldTargetCopy() output (profile_editor.js:1110-1121): "Holds", the step '
                + 'ordinal, its name, the reading and the unit. Same 346px column.',
            hostStyle: { 'inline-size': '346px' },
            html: '<ui-locked-value>Holds 02 Preinfusion 84.0 &deg;C</ui-locked-value>',
        },
        {
            id: 'beside-a-stepper',
            title: 'In the column it belongs to',
            notes:
                'A HOLD step\'s cell next to two authored ones, which is the comparison '
                + 'that matters: same box, same floor, same radius, dashed instead of '
                + 'solid and muted instead of live. The two neighbours are plain markup, '
                + 'not #4 Stepper - that is a wave-2 component.',
            hostStyle: { 'inline-size': '760px' },
            html:
                '<div style="display:grid; grid-template-columns:repeat(2, 346px); gap:18px">'
                + '<div style="display:flex; align-items:center; justify-content:center;'
                + ' min-block-size:var(--ui-control-h); border:var(--ui-border-w) solid'
                + ' var(--ui-line); border-radius:var(--ui-radius);'
                + ' background:var(--ui-surface); color:var(--ui-text);'
                + ' font-size:var(--ui-text-note)">84.0 &deg;C</div>'
                + '<ui-locked-value>Holds 02 Preinfusion 84.0 &deg;C</ui-locked-value>'
                + '</div>',
        },
        {
            id: 'narrow-container',
            title: 'In a 200px container',
            notes:
                'The host is narrow at an unchanged viewport - the box tracks it exactly '
                + 'and the sentence ellipsises on one line. Slate never meets this: its '
                + 'geometry is frozen at 1920x1200 and its rule states no overflow at all, '
                + 'so the copy would spill out of a fixed 64px box (bug E19\'s class). '
                + 'The treatment is the same sheet\'s own value cell, '
                + 'profile-editor-v3.css:568-578.',
            hostStyle: { 'inline-size': '200px' },
            html: '<ui-locked-value>Holds 02 Preinfusion 84.0 &deg;C</ui-locked-value>',
        },
        {
            id: 'wide-container',
            title: 'In a 640px container',
            notes:
                'The other end of the same proof. Nothing in the component pins 346px, so '
                + 'the box is 640px here - the container owns the dimension, once.',
            hostStyle: { 'inline-size': '640px' },
            html: '<ui-locked-value>Holds previous target</ui-locked-value>',
        },
        {
            id: 'named',
            title: 'A bare reading, named for a screen reader',
            notes:
                'The `label` escape hatch, ui-badge\'s spelling exactly: the visible '
                + 'glyphs go aria-hidden and the label is exposed as visually hidden text. '
                + 'For the shape where the column header carries the meaning and "84.0 '
                + '&deg;C" alone does not.',
            hostStyle: { 'inline-size': '346px' },
            html:
                '<ui-locked-value label="Held target, 84.0 degrees Celsius">'
                + '84.0 &deg;C</ui-locked-value>',
        },
        {
            id: 'focusable-in-a-band',
            title: 'Made focusable inside a clipping band',
            notes:
                'The box takes no focus of its own. When a consumer gives it one - a '
                + 'wave-4 grid with a roving tabindex - it gets THE ring from --ui-focus-*, '
                + 'and focus-ring="inset" keeps it unclipped inside an overflow:hidden '
                + 'parent. Bug L24 is rings clipped on all four sides, and its named '
                + 'mechanism is .slate-stepper { overflow: hidden } - the very component '
                + 'this box is a stepper-with-no-caps of.',
            hostStyle: { 'inline-size': '420px' },
            html:
                '<div style="overflow:hidden; inline-size:360px; display:flex; padding:8px">'
                + '<ui-locked-value tabindex="0" focus-ring="inset" style="flex:1 1 auto">'
                + 'Holds previous target</ui-locked-value>'
                + '</div>',
        },
        {
            id: 'disabled',
            title: 'Dimmed by the one disabled dial',
            notes:
                'Paint only, from the base: --ui-opacity-disabled (.38), settling Slate\'s '
                + 'three live values. Nothing here accepts input in either state.',
            hostStyle: { 'inline-size': '346px' },
            html: '<ui-locked-value disabled>Holds previous target</ui-locked-value>',
        },
    ],
};

export default entry;
