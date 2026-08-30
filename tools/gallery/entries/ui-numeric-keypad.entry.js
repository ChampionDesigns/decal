/**
 * ui-numeric-keypad.entry.js — gallery entry for component #53, the numeric keypad.
 *
 * Its own file because `tools/gallery/entries.js` is one shared array under a
 * whole-file-write rule: N builders appending to it in parallel is N−1 entries lost.
 * The wave's single cross-cutting writer adds the import line and the array slot,
 * serially, once.
 *
 * `module` points at the DEMO sidecar, not at the component — the limits table is a
 * property and a gallery state is a string of HTML, so the states mount thin
 * subclasses that carry the port's own table. See `ui-numeric-keypad.demo.js`.
 *
 * THE SAME TWO THINGS ui-dialog's AND #19's ENTRIES SAY, because this is one of its
 * bodies.
 *
 * 1. A MODAL DIALOG DOES NOT SIT IN THE STAGE. It is in the browser's top layer, so it
 *    is centred on the VIEWPORT and its scrim covers the whole gallery — the one
 *    component family whose geometry is the window's by design (spec §4.6).
 *    `hostStyle` still does its usual job: `stacked` sets `--_ui-numpad-inline`, which
 *    is what the card's width reads, so the carried breakpoint can be shown without
 *    touching the viewport (§2.1 Rule 1).
 * 2. THE GALLERY'S OWN NAV IS INERT while one of these is on the stage, and that is
 *    the component working. Move between states with the URL's `?state=`, which is
 *    what `tools/capture_battery.py` does anyway (capture_battery.py:107).
 *
 * WHAT TO LOOK AT, in Slate's own numbers:
 *   CITE modal-numpad .numpad-modal-container [i=166] rect x=550 y=284 w=820 h=545
 *   CITE modal-numpad .numpad-modal-numpad-btn "distinct geometries (w x h), all
 *        matched elements: 107 x 88 x12"
 *   CITE modal-numpad #numpad-modal-title [i=167] font-size = 28px <- <inline>
 *        authored `28px` (FROZEN/hardcoded)  ← bug O10, and there is no inline size
 *        anywhere in these states: the heading is #16's, through .ui-title.
 */

export const entry = {
    id: 'ui-numeric-keypad',
    title: 'Numeric keypad',
    module: './entries/ui-numeric-keypad.demo.js',
    notes:
        'Component #53, the BODY of a #18 instance — the shell owns modality, Escape and '
        + 'the scroll region (spec Appendix 13). Every bound on screen comes from the ONE '
        + 'limits table behind R2 (B2); the steam states are B3\'s corrected row, floor 135 '
        + 'with a machine-dependent ceiling, against Slate\'s 130 which sat in the dead band '
        + 'where the heater is off. Key faces are #15 unchanged; the pressable is a real '
        + 'button, and the backspace one has a name (O9).',
    states: [
        {
            id: 'dose',
            title: 'Dose in — an integer field, with recents',
            notes:
                'The pad is 3 x 4 with a --ui-space-3 gutter, which is the oracle\'s own '
                + 'geometry (rects [1000,416,107,88] [1119,416,...] [1000,516,...]); the key '
                + 'WIDTH is a 1fr share, exactly as numpad-modal.css:302 has it. The decimal '
                + 'key is disabled because the table declares step 1 for dose — Slate accepted '
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
                + 'value is the bottom of the working band. Slate\'s table said 130–170 and its '
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
                'spec §4.6: Slate\'s one real breakpoint is correct and is carried "as a '
                + 'container query on the dialog\'s own box". hostStyle narrows the card '
                + 'through --_ui-numpad-inline rather than the viewport, so the entry column '
                + 'and the pad stack and the seam becomes a row rule. Neither of Slate\'s '
                + 'window queries fires on the bench tablet, so this layout has never been '
                + 'seen on the target hardware.',
            hostStyle: { '--_ui-numpad-inline': '520px' },
            html: '<ui-numeric-keypad-dose id="np" open></ui-numeric-keypad-dose>',
        },
    ],
};

export default entry;
