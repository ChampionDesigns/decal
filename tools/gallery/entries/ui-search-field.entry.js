/**
 * The gallery entry for.
 */

export const entry = {
    id: 'ui-search-field',
    title: 'Search field',
    module: '../../src/components/ui-search-field.js',
    notes:
        'Wave 2 #30, composed from Wave 1 #6. What to look at is the ICON WELL: the reference skin '
        + 'positions the glyph absolutely over a frozen `padding-left: 52px` (18 + 20 + 14, '
        + 'undocumented - CITE settings-machine-steam #settings-search [i=7] padding-left = '
        + '52px, authored as `52px` on the old search field '
        + 'FROZEN/hardcoded). Here the glyph is a box in the field\'s own flex line and the '
        + 'well is --ui-space-4 + --ui-icon + --ui-space-3 = 54px, added up by the layout '
        + 'engine. Retarget any of those three tokens and the entry moves; the 52 could not. '
        + 'No selection state exists on this component - the four dials stay item #3\'s.',
    states: [
        {
            id: 'resting',
            title: 'Resting, with a placeholder',
            notes:
                'The the reference skin original, value-for-value: --ui-control-h tall, --ui-key on '
                + '--ui-line, --ui-radius corners, and the glyph at --ui-text.',
            hostStyle: { 'inline-size': '600px' },
            html: '<ui-search-field placeholder="Search settings..." aria-label="Search settings"></ui-search-field>',
        },
        {
            id: 'filled',
            title: 'Filled',
            notes:
                'No UA clear button, and that is deliberate: with type="search" Chrome draws '
                + 'its own ::-webkit-search-cancel-button inside the field (MEASURED: a click '
                + '10px in from the entry\'s right edge cleared the value), out of reach of '
                + 'every token and every rule this component can write.',
            hostStyle: { 'inline-size': '600px' },
            html: '<ui-search-field value="steam" placeholder="Search settings..." aria-label="Search settings"></ui-search-field>',
        },
        {
            id: 'labelled',
            title: 'With a visible label',
            notes:
                'show-label renders ui-text-field\'s own label, so the for/id pairing lives in '
                + 'one shadow root and cannot come apart - bug E14 is "settings fields have no '
                + 'for/id pairing".',
            hostStyle: { 'inline-size': '600px' },
            html: '<ui-search-field show-label label="Search settings" placeholder="Machine, steam, tank..."></ui-search-field>',
        },
        {
            id: 'trailing-control',
            title: 'With a trailing control slotted in',
            notes:
                'The trail slot is forwarded through to ui-text-field. A forwarded slot is '
                + 'display:contents, so the inner field\'s adornment gap lands on a box-less '
                + 'element and does nothing; the seam is therefore declared on the consumer\'s '
                + 'own nodes here. An empty trail still costs no space. The slotted control is '
                + 'the CONSUMER\'S - this component sizes nothing in the trail, and a bare '
                + 'button still takes the one focus ring through the base\'s ::slotted rule.',
            hostStyle: { 'inline-size': '600px' },
            html:
                '<ui-search-field value="descal" placeholder="Search settings..." aria-label="Search settings">'
                + '<button slot="trail" style="min-inline-size:48px;min-block-size:48px">Clear</button>'
                + '</ui-search-field>',
        },
        {
            id: 'custom-glyph',
            title: 'With the consumer\'s own glyph',
            notes:
                'The well is a square of --ui-icon and the artwork paints itself (spec §2.3 '
                + 'case 3): nothing here touches fill or stroke, and aria-hidden is on the '
                + 'well, so a replacement glyph is decorative without the consumer remembering.',
            hostStyle: { 'inline-size': '600px' },
            html:
                '<ui-search-field placeholder="Filter profiles" aria-label="Filter profiles">'
                + '<svg slot="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
                + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
                + '<path d="M4 6h16M7 12h10M10 18h4"></path></svg>'
                + '</ui-search-field>',
        },
        {
            id: 'narrow-container',
            title: 'In a 320px container',
            notes:
                'The height is a fixed token at every container size (spec §2.2, "Control '
                + 'heights, touch targets, hairlines - Fixed token. Never fluid") and the glyph '
                + 'keeps its square - bug T9\'s class is a floor a parent can shrink.',
            hostStyle: { 'inline-size': '320px' },
            html: '<ui-search-field placeholder="Search" aria-label="Search settings"></ui-search-field>',
        },
        {
            id: 'disabled',
            title: 'Disabled',
            notes:
                'ONE dial, applied once. Three base rules reach a disabled composed field - '
                + 'this host, the inner element in this shadow tree, and the inner component\'s '
                + 'own :host - and .38 cubed is .0548. The host keeps the paint; the inner one '
                + 'is neutralised.',
            hostStyle: { 'inline-size': '600px' },
            html: '<ui-search-field disabled value="steam" placeholder="Search settings..." aria-label="Search settings"></ui-search-field>',
        },
    ],
};

export default entry;
