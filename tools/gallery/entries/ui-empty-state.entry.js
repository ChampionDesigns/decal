/**
 * ui-empty-state.entry.js - the gallery entry for component #38 (wave 1, item #38).
 *
 * WHY THIS IS A FILE OF ITS OWN, and not an append to ../entries.js.
 * tools/gallery/README.md:12 says "Edit entries.js. That is the whole procedure",
 * and that procedure is correct for ONE author. Wave 1 runs sixteen builders in
 * parallel under a whole-file-write rule, so sixteen appends to one array clobber
 * each other. Each builder therefore owns one file here and the wave's GATE agent
 * wires them into `entries.js` (import + spread, or a manifest) once, serially:
 *
 *     import { entry as uiEmptyState } from './entries/ui-empty-state.entry.js';
 *     export const entries = [ ...existing, uiEmptyState ];
 *
 * `module` stays relative to tools/gallery/ as the README specifies - gallery.js
 * does the `import(entry.module)`, so the specifier resolves against gallery.js
 * wherever the entry object was authored.
 *
 * STATE IDS ARE CAPTURE FILENAMES (`ui-empty-state--<state>`): identifiers, not
 * labels. A rename is a re-baseline.
 *
 * The `left-pressure` state exists so the capture battery photographs T11's exact
 * hostile environment: the three shell rules that left-align Slate's four call
 * sites are applied to the stage, and the block is still centred. Those rules carry
 * the loud override this file is not allowed to spell; they live in
 * test/render/ui-empty-state.render.test.mjs, where they belong.
 */

export const entry = {
    id: 'ui-empty-state',
    title: 'Empty state',
    module: '../../src/components/ui-empty-state.js',
    notes:
        'Component #38 (spec §5.2 #38): the "nothing here" block for lists and panes. '
        + 'Slate authors it centred and renders it LEFT-ALIGNED at four call sites '
        + '(bug T11, slate-shell.css:1304-1306, 1326-1328, 1244-1250, plus '
        + '.slate-caption text-align: left) - here the centring is declared inside the '
        + 'shadow root where no screen sheet can reach it. Two shapes: the plain block '
        + 'the four settings call sites use, and the dashed well the one measured state '
        + '(settings-help-talk-to-decent) draws. The 64px disc is not painted at all '
        + 'without a glyph, which is what slate-shell.css:1605-1612 needs a loud '
        + 'override to achieve (P21).',
    states: [
        {
            id: 'plain',
            title: 'Plain block (the four settings call sites)',
            notes:
                'settings.js:6851 / :8251 / :8424 / :8443 all render exactly this one '
                + 'line. Inset --ui-space-6 (Slate p-8 = 32px, spec §3.3 snaps 32 to 28); '
                + 'heading --ui-text-md / --ui-weight-medium / --ui-text, the oracle\'s '
                + 'measured 18px / 500.',
            hostStyle: { 'inline-size': '620px' },
            html: '<ui-empty-state heading="No settings match your search"></ui-empty-state>',
        },
        {
            id: 'boxed',
            title: 'Dashed well with glyph and prose',
            notes:
                'The one empty state in the provenance corpus, rebuilt: ORACLE '
                + 'background --ui-key (dark rgb(26, 33, 39) / light rgb(248, 249, 249)), '
                + 'edge --ui-line at --ui-border-w-strong dashed, gap 18px = '
                + '--ui-space-4, disc 64x64 on --ui-key-on with --ui-muted ink. Radius '
                + 'is --ui-radius-lg: 20px is not a step in spec §3.4\'s vocabulary.',
            hostStyle: { 'inline-size': '760px' },
            html:
                '<ui-empty-state boxed heading="No Decent account linked">'
                + '<svg slot="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
                + ' stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
                + '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>'
                + '</svg>'
                + 'Messages to support are sent from your Decent account. Linking happens'
                + ' in the Decent phone app, not here.'
                + '</ui-empty-state>',
        },
        {
            id: 'with-action',
            title: 'With an action in the slot',
            notes:
                'The action is a real control supplied by the screen (#1 ui-button), not '
                + 'something this primitive owns - so the hit floor and the focus ring '
                + 'are the button\'s, and the empty state takes no focus of its own.',
            hostStyle: { 'inline-size': '620px' },
            html:
                '<ui-empty-state boxed heading="No shots recorded yet">'
                + 'Pull a shot and it will appear here with its chart.'
                + '<button slot="actions" type="button">Pull a shot</button>'
                + '</ui-empty-state>',
        },
        {
            id: 'no-glyph',
            title: 'No glyph - and no grey disc (P21)',
            notes:
                'slate-shell.css:1605-1612 exists because a failed mask URL left "a '
                + 'featureless grey rounded square ... a grey block pretending to be '
                + 'art". With the disc rendered only when its slot is filled, the block '
                + 'cannot exist, and the loud override that suppresses it is not needed.',
            hostStyle: { 'inline-size': '620px' },
            html:
                '<ui-empty-state boxed heading="No sub-categories">'
                + 'Select a sub-category from the menu.'
                + '</ui-empty-state>',
        },
        {
            id: 'left-pressure',
            title: 'T11: under the three shell rules that left-align Slate',
            notes:
                'The stage sets text-align: left and align-items: flex-start on the host '
                + 'and on every descendant it can name - the shape of '
                + 'slate-shell.css:1304-1306, 1326-1328 and 1244-1250, which turn Slate\'s '
                + 'four authored-centred call sites left-aligned. Nothing outside can name '
                + '.empty inside the root, and text-align is DECLARED there rather than '
                + 'inherited, so the block is still centred.',
            hostStyle: {
                'inline-size': '620px',
                'text-align': 'left',
                'align-items': 'flex-start',
            },
            html:
                '<ui-empty-state boxed heading="No settings match your search"'
                + ' style="text-align: left; align-items: flex-start">'
                + 'Try a shorter search, or clear it to see every category.'
                + '</ui-empty-state>',
        },
        {
            id: 'narrow-container',
            title: 'In a 260px container',
            notes:
                'The block reads its own container and nothing else - no viewport query '
                + 'anywhere in the component. The disc, the inset and the type are '
                + 'physical tokens, so none of them shrinks with the box; the prose wraps '
                + 'and the actions row wraps. The oracle has no vote here: its geometry '
                + 'is frozen at 1920x1200.',
            hostStyle: { 'inline-size': '260px' },
            html:
                '<ui-empty-state heading="Nothing here">'
                + 'This pane fills once the machine reports a shot.'
                + '</ui-empty-state>',
        },
    ],
};

export default entry;
