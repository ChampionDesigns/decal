/**
 * ui-text-field.entry.js - the gallery entry for Wave 1 item #6.
 *
 * WHY THIS IS ITS OWN FILE. `tools/gallery/entries.js` is ONE shared `export const
 * entries = [...]` array and the only documented registration point, and sixteen
 * Wave 1 builders writing whole files into it would clobber each other. Each builder
 * therefore owns one file here; the GATE agent wires them into `entries.js` (import
 * + spread, or a manifest). The exported object is in exactly the shape `entries.js`
 * documents - id / title / module / notes / states[{ id, title, html, hostStyle }] -
 * so wiring it in is a spread and nothing else.
 *
 * STATE IDS ARE CAPTURE FILENAMES (`tools/gallery/README.md`): the full id is
 * `ui-text-field--<state.id>`, so these are identifiers, not labels.
 */

export const entry = {
    id: 'ui-text-field',
    title: 'Text field',
    module: '../../src/components/ui-text-field.js',
    notes:
        'Wave 1 #6. The Slate field carried across value-for-value from the oracle '
        + '(profile-selector #profile-filter: 64px tall, 18px inset, 6px radius, 17px/400 '
        + 'Geist, --ui-key on --ui-line) and re-hung on tokens. Form-associated. The ring '
        + 'is drawn on the field WRAPPER so a field with a leading icon rings as one box.',
    states: [
        {
            id: 'resting',
            title: 'Resting, with a placeholder',
            html: '<ui-text-field placeholder="Search profiles"></ui-text-field>',
        },
        {
            id: 'filled',
            title: 'Filled',
            html: '<ui-text-field value="Londinium Reserve"></ui-text-field>',
        },
        {
            id: 'labelled',
            title: 'Labelled',
            notes:
                'The label is part of the component, so the for/id pairing cannot come '
                + 'apart - bug E14 is "settings fields have no for/id pairing".',
            html: '<ui-text-field label="Scale host" value="10.0.0.42"></ui-text-field>',
        },
        {
            id: 'lead-adornment',
            title: 'With a leading glyph',
            notes: 'The shape Wave 2 #30 (Search field) is built on. Glyph inherits currentColor.',
            html:
                '<ui-text-field placeholder="Search settings">'
                + '<svg slot="lead" width="24" height="24" viewBox="0 0 24 24" fill="none" '
                + 'stroke="currentColor" stroke-width="2" aria-hidden="true">'
                + '<circle cx="11" cy="11" r="7"></circle><path d="M16 16l5 5"></path>'
                + '</svg></ui-text-field>',
        },
        {
            id: 'centred-narrow',
            title: 'Centred, in a 140px container',
            notes:
                'Slate writes this as a utility on the element (screensaver-cycle-seconds '
                + 'is `slate-field w-[140px] text-center`); here it is a reflected attribute '
                + 'and the width belongs to the container, not to the component.',
            hostStyle: { 'inline-size': '140px' },
            html: '<ui-text-field align="center" value="30"></ui-text-field>',
        },
        {
            id: 'narrow-container',
            title: 'In a 240px container',
            notes:
                'The height is a fixed token at every container size (spec §2.2, "Control '
                + 'heights ... Never fluid"); only the inline size follows the container.',
            hostStyle: { 'inline-size': '240px' },
            html: '<ui-text-field label="Tank" value="Refill kit installed"></ui-text-field>',
        },
        {
            id: 'disabled',
            title: 'Disabled',
            notes: 'One dial: --ui-opacity-disabled, painted by the base on the host.',
            html: '<ui-text-field disabled label="Scale host" value="10.0.0.42"></ui-text-field>',
        },
        {
            id: 'invalid',
            title: 'Invalid',
            notes:
                'No oracle answer - Slate has no invalid-field state in the 49. '
                + '--ui-status-danger on the border, aria-invalid on the entry.',
            html: '<ui-text-field invalid label="Scale host" value="not a host"></ui-text-field>',
        },
    ],
};

export default entry;
