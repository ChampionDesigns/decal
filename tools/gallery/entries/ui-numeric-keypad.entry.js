/**
 * Gallery entry for.
 */

export const entry = {
    id: 'ui-numeric-keypad',
    title: 'Numeric keypad',
    module: './entries/ui-numeric-keypad.demo.js',
    notes:
        'Component #53, the BODY of a #18 instance — the shell owns modality, Escape and '
        + 'the scroll region (spec Appendix 13). Every bound on screen comes from the ONE '
        + 'limits table behind R2 (B2); the steam states are B3\'s corrected row, floor 135 '
        + 'with a machine-dependent ceiling, against the reference skin\'s 130 which sat in the dead band '
        + 'where the heater is off. Key faces are #15 unchanged; the pressable is a real '
        + 'button, and the backspace one has a name (O9).',
    states: [
        {
            id: 'dose',
            title: 'Dose in — an integer field, with recents',
            notes:
                'The pad is 3 x 4 with a --ui-space-3 gutter, which is the oracle\'s own '
                + 'geometry (rects [1000,416,107,88] [1119,416,...] [1000,516,...]); the key '
                + 'WIDTH is a 1fr share, exactly as the old modal has it. The decimal '
                + 'key is disabled because the table declares step 1 for dose — the reference skin accepted '
                + '18.5 here and let it be rounded downstream.',
            html: '<ui-numeric-keypad-dose id="np" open></ui-numeric-keypad-dose>',
        },
        {
            id: 'drink-out',
            title: 'Drink out — the state the oracle photographed',
            notes:
                'ORACLE modal-numpad #numpad-display-value [i=173] text "40g" rect '
                + 'x=575 y=574 w=376 h=104. Same field, same value, no recents — and the '
                + 'readout is a live region announcing each press (O9), not an innerHTML write.',
            html: '<ui-numeric-keypad-drink id="np" open></ui-numeric-keypad-drink>',
        },
        {
            id: 'steam-bengle',
            title: 'Steam temperature, Bengle — 0 or 135–165',
            notes:
                'B3 on screen. The hint is the port\'s own sentence, hole included, because '
                + 'the range has a HOLE: zero means the steam heater is off and the next valid '
                + 'value is the bottom of the working band. The reference skin\'s table said 130–170 and its '
                + 'clamp would happily leave you at 130, where the heater is off.',
            html: '<ui-numeric-keypad-steam-bengle id="np" open></ui-numeric-keypad-steam-bengle>',
        },
        {
            id: 'steam-de1',
            title: 'The same field on a DE1 — 0 or 135–160',
            notes:
                'One number apart from the state above, and the difference arrives entirely '
                + 'from the table (doc/Skins.md:573, "135–160 °C for DE1 and 135–165 °C for '
                + 'Bengle"). Nothing in the component knows what a DE1 is.',
            html: '<ui-numeric-keypad-steam-de1 id="np" open></ui-numeric-keypad-steam-de1>',
        },
        {
            id: 'steam-unknown',
            title: 'No machine class yet — A7, rendered',
            notes:
                'The table carries no steam row until the machine class resolves, so there is '
                + 'nothing to bound and nothing is invented: no pad, no ceiling, a disabled '
                + 'Confirm and a sentence saying why. This is the state a fallback would have '
                + 'hidden.',
            html: '<ui-numeric-keypad-steam-unknown id="np" open></ui-numeric-keypad-steam-unknown>',
        },
        {
            id: 'steam-flow',
            title: 'Steam flow — a fractional step, so the decimal key is live',
            notes:
                'Every affordance follows the declaration: step 0.1 turns the decimal key on '
                + 'and lets the buffer hold one decimal place. The same component with the same '
                + 'markup and a different row.',
            html: '<ui-numeric-keypad-flow id="np" open></ui-numeric-keypad-flow>',
        },
        {
            id: 'stacked',
            title: 'The carried breakpoint, as a container query',
            notes:
                'spec §4.6: the reference skin\'s one real breakpoint is correct and is carried "as a '
                + 'container query on the dialog\'s own box". hostStyle narrows the card '
                + 'through --_ui-numpad-inline rather than the viewport, so the entry column '
                + 'and the pad stack and the seam becomes a row rule. Neither of the reference skin\'s '
                + 'window queries fires on the bench tablet, so this layout has never been '
                + 'seen on the target hardware.',
            hostStyle: { '--_ui-numpad-inline': '520px' },
            html: '<ui-numeric-keypad-dose id="np" open></ui-numeric-keypad-dose>',
        },
    ],
};

export default entry;
