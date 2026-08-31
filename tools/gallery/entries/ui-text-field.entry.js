/**
 * The gallery entry for.
 */

export const entry = {
    id: 'ui-text-field',
    title: 'Text field',
    module: '../../src/components/ui-text-field.js',
    notes:
        'Wave 1 #6. The the reference skin field carried across value-for-value from the oracle '
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
            html: '<ui-text-field label="Scale host" value="192.0.2.42"></ui-text-field>',
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
                'The reference skin writes this as a utility on the element (screensaver-cycle-seconds '
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
            html: '<ui-text-field disabled label="Scale host" value="192.0.2.42"></ui-text-field>',
        },
        {
            id: 'invalid',
            title: 'Invalid',
            notes:
                'No oracle answer - the reference skin has no invalid-field state in the 49. '
                + '--ui-status-danger on the border, aria-invalid on the entry.',
            html: '<ui-text-field invalid label="Scale host" value="not a host"></ui-text-field>',
        },
    ],
};

export default entry;
