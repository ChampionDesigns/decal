/**
 * The gallery entry for the rail of keys under a step column. Its states walk a profile
 * from the first step to the last, so the two arrows are seen both live and out; then a
 * one-step profile with neither arrow, the whole rail unavailable, and the rail in a
 * narrow and a wide host. Each state carries its own markup and the note beside it.
 */

export const entry = {
    id: 'ui-action-key-rail',
    title: 'Action key rail',
    module: '../../src/components/ui-action-key-rail.js',
    notes:
        'Wave 4 #42, the editor footer\'s key row: move-left / delete / insert-after / '
        + 'duplicate / move-right, in the reference skin\'s own footer order. Five buttons and no '
        + 'drag, per C7 — "drag works with a mouse, not a tablet", and OQ-9 says do not '
        + 'add it without asking. Composed of five #1 ui-buttons on the ghost variant '
        + 'inside the seam utility: the 1px gaps and the enclosing 1px are one ink '
        + '(--ui-line, the oracle\'s .pe-action-cell background in both themes) and each '
        + 'key face is --ui-fascia (the oracle\'s .pe-action-btn, both themes). The two '
        + 'coloured keys are the reference skin\'s: --ui-steel for add, and for delete the reference skin\'s own '
        + 'arithmetic color-mix(in srgb, --ui-status-danger 72%, --ui-muted), which '
        + 'reproduces the corpus value to six decimal places in both themes. Three '
        + 'departures, all deliberate: the key is --ui-control-h tall rather than '
        + 'the reference skin\'s literal 62 (E11 counts 18 of those in that sheet), the glyph is '
        + '--ui-icon rather than a bare 23px, and the neutral ink is --ui-muted in BOTH '
        + 'themes rather than the old hardcoded #959595 (E13, live today). The '
        + 'rank does not stretch — spec §2.2, touch targets are fixed tokens, so a wider '
        + 'editor column gets the same five keys, not five wider ones.',
    states: [
        {
            id: 'first-step',
            title: 'Step 1 of 4 — cannot move left',
            notes: 'The back arrow is inert: dimmed by the one dial (--ui-opacity-disabled, '
                + '.38) on the glyph ONLY, over a face identical to its live siblings\'. '
                + 'That is the reference skin\'s own stated intent — "a dimmed glyph on the same ground '
                + 'is the whole disabled state" — which its shell defeated with an '
                + '!important 1000 lines away. Here the face belongs to the seam cell '
                + 'under the button, so the dial cannot reach it.',
            html: '<ui-action-key-rail index="0" count="4" label="Step 1 actions"></ui-action-key-rail>',
        },
        {
            id: 'middle-step',
            title: 'Step 2 of 4 — every key live',
            notes: 'The resting rank. Five keys, one seam apart, one slab: the gap IS the '
                + 'divider (CONVENTIONS §13) rather than five borders, so there is exactly '
                + '1px of line between neighbours instead of L9\'s doubled seam.',
            html: '<ui-action-key-rail index="1" count="4" label="Step 2 actions"></ui-action-key-rail>',
        },
        {
            id: 'last-step',
            title: 'Step 4 of 4 — cannot move right',
            notes: 'The mirror of the first state. Read the two together: the inert key '
                + 'must be the FAINT one at both ends, never the filled one.',
            html: '<ui-action-key-rail index="3" count="4" label="Step 4 actions"></ui-action-key-rail>',
        },
        {
            id: 'walking-the-profile',
            title: 'A four-step profile, all four rails',
            notes: 'What the editor footer actually shows: one rail per step column, and '
                + 'the arrows switching off only at the two ends. Stacked here because the '
                + 'gallery stage is not the step matrix; Wave 5 assembles them across.',
            hostStyle: { 'inline-size': '520px' },
            html: '<ui-action-key-rail index="0" count="4" label="Step 1 actions"></ui-action-key-rail>'
                + '<ui-action-key-rail index="1" count="4" label="Step 2 actions"></ui-action-key-rail>'
                + '<ui-action-key-rail index="2" count="4" label="Step 3 actions"></ui-action-key-rail>'
                + '<ui-action-key-rail index="3" count="4" label="Step 4 actions"></ui-action-key-rail>',
        },
        {
            id: 'single-step',
            title: 'A one-step profile — both arrows out',
            notes: 'Nothing to reorder, so both ends are inert at once, and delete stays '
                + 'live: removing the only step is the reference skin\'s behaviour and is the screen\'s '
                + 'call, not the rail\'s. The default state of a new rail, too '
                + '(index 0, count 1).',
            html: '<ui-action-key-rail></ui-action-key-rail>',
        },
        {
            id: 'rail-disabled',
            title: 'The whole rail unavailable',
            notes: 'One attribute, five dimmed glyphs, five untouched grounds — the same '
                + 'dial doing the same job five times rather than a second disabled look. '
                + 'spec §3.7 settles one --ui-opacity-disabled at .38 against the reference skin\'s '
                + 'three live values; the reference skin\'s rail adds a fourth (color-mix 44% muted '
                + 'into fascia) that never renders anyway.',
            html: '<ui-action-key-rail index="1" count="4" disabled></ui-action-key-rail>',
        },
        {
            id: 'narrow-container',
            title: 'In a 220px container',
            notes: 'The rank holds its floor and OVERFLOWS where a reader can see. That is '
                + 'the honest opposite of E1, where ten fixed row tracks summing to exactly '
                + 'the canvas height meant a scrollbar pushed the grid over and '
                + 'overflow-y: hidden CUT THE ACTION ROW — this row — with no scrollbar to '
                + 'say so. The slab still clips (square keys, round corners), but by '
                + 'construction it never has anything to clip.',
            hostStyle: { 'inline-size': '220px' },
            html: '<ui-action-key-rail index="1" count="4"></ui-action-key-rail>',
        },
        {
            id: 'wide-container',
            title: 'In a 900px container',
            notes: 'Unchanged. spec §2.2: "Control heights, touch targets, hairlines | '
                + 'Fixed token. Never fluid." A rank of five touch targets is sized by the '
                + 'targets, which is also what the reference skin does — .pe-action-cell is a fixed '
                + '316px, "approved five-key footer rail" — but here with no literal in it.',
            hostStyle: { 'inline-size': '900px' },
            html: '<ui-action-key-rail index="1" count="4"></ui-action-key-rail>',
        },
    ],
};

export default entry;
