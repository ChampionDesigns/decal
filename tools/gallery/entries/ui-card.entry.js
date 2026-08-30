/**
 * ui-card.entry.js - the gallery entry for component #8 (wave 1, item #8).
 *
 * WHY THIS IS A FILE OF ITS OWN, and not an append to ../entries.js.
 * tools/gallery/README.md:12 says "Edit entries.js. That is the whole procedure",
 * and that procedure is correct for ONE author. Wave 1 runs sixteen builders in
 * parallel under a whole-file-write rule, so sixteen appends to one array clobber
 * each other. Each builder therefore owns one file here and the wave's GATE agent
 * wires them into `entries.js` (import + spread, or a manifest) once, serially:
 *
 *     import { entry as uiCard } from './entries/ui-card.entry.js';
 *     export const entries = [ ...existing, uiCard ];
 *
 * `module` stays relative to tools/gallery/ as the README specifies - gallery.js
 * does the `import(entry.module)`, so the specifier resolves against gallery.js
 * wherever the entry object was authored.
 *
 * STATE IDS ARE CAPTURE FILENAMES (`ui-card--<state>`): identifiers, not labels.
 * A rename is a re-baseline.
 */

export const entry = {
    id: 'ui-card',
    title: 'Card',
    module: '../../src/components/ui-card.js',
    notes:
        'Component #8, the plain surface (spec §5.1 #8, 9 uses): one hairline, one '
        + 'radius, --ui-key. Slate declares no padding, so its nine call sites supply '
        + 'four different insets (24 / 16 / 60x30 / 24x14) - here the inset is a token '
        + 'with a tight and a none. Scroll mode is bounded and stated per spec §2.4: a '
        + '--ui-control-h floor, overflow: auto, a visible scrollbar, a tab stop, and '
        + 'the inset focus offset so the card cannot cut its own ring (L24). #50 '
        + 'definition card and #51 card grid are built on this.',
    states: [
        {
            id: 'default',
            title: 'Default',
            notes:
                'The measured surface: background --ui-key (oracle rgb(26, 33, 39) dark '
                + '/ rgb(248, 249, 249) light), border --ui-hairline solid --ui-line, '
                + 'radius --ui-radius (6px), inset --ui-space-5 (24px).',
            hostStyle: { 'inline-size': '520px' },
            html:
                '<ui-card>Machine firmware v282 is installed and up to date.</ui-card>',
        },
        {
            id: 'pads',
            title: 'The three insets',
            notes:
                'regular (--ui-space-5) / tight (--ui-space-4, spec §3.3 snaps Slate\'s '
                + '16px to 18) / none (Slate-identical: the caller owns the inset).',
            hostStyle: { 'inline-size': '520px' },
            html:
                '<div style="display:flex; flex-direction:column; gap:12px">'
                + '<ui-card>Regular - 24px</ui-card>'
                + '<ui-card pad="tight">Tight - 18px</ui-card>'
                + '<ui-card pad="none"><div style="padding:14px 24px">None - the call site insets, as all nine of Slate\'s do</div></ui-card>'
                + '</div>',
        },
        {
            id: 'labelled',
            title: 'Labelled group',
            notes:
                'A label makes the card a group with an accessible name; without one it '
                + 'carries no role at all, which is right for a decorative surface.',
            hostStyle: { 'inline-size': '520px' },
            html:
                '<ui-card label="Machine">'
                + '<div style="display:flex; justify-content:space-between"><span>Model</span><span>Bengle</span></div>'
                + '<div style="display:flex; justify-content:space-between"><span>Firmware</span><span>v282</span></div>'
                + '</ui-card>',
        },
        {
            id: 'scroll-capped',
            title: 'Bounded scroll region (the notes pane shape)',
            notes:
                'SCOPE.md:1702 builds the notes pane as this card plus type roles with a '
                + 'max-block-size cap. The cap is set from outside; the card turns it into '
                + 'a scroll region with a floor and a visible scrollbar (spec §2.4) rather '
                + 'than clipping silently. It also takes a tab stop, so a keyboard can '
                + 'reach what a wheel can.',
            hostStyle: { 'inline-size': '520px' },
            html:
                '<ui-card scroll style="max-block-size: 200px">'
                + '<p style="margin:0 0 12px">First pull after the descale. Grind two clicks finer than the bag suggests.</p>'
                + '<p style="margin:0 0 12px">Second pull channelled on the left; tamp was off level.</p>'
                + '<p style="margin:0 0 12px">Third pull is the keeper - 1:2.3 in 31s, no channelling.</p>'
                + '<p style="margin:0 0 12px">Fourth pull repeated it, so the grind setting is good for this bag.</p>'
                + '<p style="margin:0">Fifth pull ran fast; beans are two weeks older now.</p>'
                + '</ui-card>',
        },
        {
            id: 'narrow-container',
            title: 'In a 260px container',
            notes:
                'The card fills its container and reads nothing else. The inset and the '
                + 'radius are physical tokens, so neither shrinks with the box - the '
                + 'oracle has no vote on responsive behaviour (its 20 cards measure '
                + '593-1200px because the canvas is frozen at 1920x1200).',
            hostStyle: { 'inline-size': '260px' },
            html: '<ui-card>Charge up to 80% - better battery life</ui-card>',
        },
    ],
};

export default entry;
