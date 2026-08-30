/**
 * ui-keycap.entry.js - the gallery entry for component #15 (wave 1, item #15).
 *
 * WHY THIS IS A FILE OF ITS OWN, and not an append to ../entries.js.
 * tools/gallery/README.md:12 says "Edit entries.js. That is the whole procedure",
 * and that procedure is correct for ONE author. Wave 1 runs sixteen builders in
 * parallel under a whole-file-write rule, so sixteen appends to one array clobber
 * each other. Each builder therefore owns one file here and the wave's GATE agent
 * wires them into `entries.js` (import + spread, or a manifest) once, serially:
 *
 *     import { entry as uiKeycap } from './entries/ui-keycap.entry.js';
 *     export const entries = [ ...existing, uiKeycap ];
 *
 * `module` stays relative to tools/gallery/ as the README specifies - gallery.js
 * does the `import(entry.module)`, so the specifier resolves against gallery.js
 * wherever the entry object was authored.
 *
 * STATE IDS ARE CAPTURE FILENAMES (`ui-keycap--<state>`): identifiers, not labels.
 * A rename is a re-baseline.
 *
 * NO RAW COLOUR LITERAL in any `html` below - tools/ is inside Gate C's scan roots,
 * so the stage scaffolding is built from --ui-* tokens like everything else.
 */

export const entry = {
    id: 'ui-keycap',
    title: 'Keycap',
    module: '../../src/components/ui-keycap.js',
    notes:
        'Component #15, the numpad key face (spec §5.1 #15, slate-components.css:780-784). '
        + 'One of the three components where --ui-hit-min is load-bearing (spec §2.3) and '
        + 'the only one of the three that reached the floor in Slate: prov_query.py find '
        + '--cls slate-keycap returns six elements, five at 48x48 and one at 68x48. Width '
        + 'is a minimum and grows with the word; height is exact. Not interactive - #53 '
        + '(Wave 4) owns pressing, this owns the face.',
    states: [
        {
            id: 'default',
            title: 'A binding',
            notes:
                'Slate\'s .slate-keycap exactly, in Decal tokens: 48x48 from --ui-hit-min, '
                + '--ui-key face, --ui-text ink, --ui-line-strong hairline with a 3x skirt on '
                + 'the bottom edge, --ui-radius corners, 17px --ui-text-base at '
                + '--ui-weight-medium. All three theme-varying colours match the oracle exactly '
                + 'in BOTH themes.',
            html: '<ui-keycap>E</ui-keycap>',
        },
        {
            id: 'shortcut-rows',
            title: 'The shortcuts screen, as Slate renders it',
            notes:
                'The six faces the oracle measured, in order: E W S F Space P (settings-help-'
                + 'keyboard-shortcuts, rects [1655,333,48,48] ... [1635,689,68,48]). Space is '
                + 'the wide one - 68px of content over a 48px minimum - and it is the state '
                + 'that proves width is content and height is the floor.',
            html:
                '<div style="display:flex; gap:var(--ui-space-3); align-items:center; flex-wrap:wrap">'
                + '<ui-keycap>E</ui-keycap><ui-keycap>W</ui-keycap><ui-keycap>S</ui-keycap>'
                + '<ui-keycap>F</ui-keycap><ui-keycap>Space</ui-keycap><ui-keycap>P</ui-keycap>'
                + '</div>',
        },
        {
            id: 'numpad-grid',
            title: 'As a numpad face (Wave 4 #53 previews it)',
            notes:
                'Twelve faces on a 3-column grid with a --ui-space-2 gutter. Every one is 48px '
                + 'square before the grid gives it anything, which is the whole point: bug L22 '
                + 'measured Slate\'s rail numpad targets at 32x35 against the same floor. The '
                + 'backspace face carries `label` because its glyph reads as nothing to a '
                + 'screen reader (Wave 4\'s bug O9).',
            html:
                '<div style="display:grid; grid-template-columns:repeat(3, max-content);'
                + ' gap:var(--ui-space-2); justify-content:start">'
                + '<ui-keycap>1</ui-keycap><ui-keycap>2</ui-keycap><ui-keycap>3</ui-keycap>'
                + '<ui-keycap>4</ui-keycap><ui-keycap>5</ui-keycap><ui-keycap>6</ui-keycap>'
                + '<ui-keycap>7</ui-keycap><ui-keycap>8</ui-keycap><ui-keycap>9</ui-keycap>'
                + '<ui-keycap>.</ui-keycap><ui-keycap>0</ui-keycap>'
                + '<ui-keycap label="Backspace">&#9003;</ui-keycap>'
                + '</div>',
        },
        {
            id: 'focusable',
            title: 'Focusable, both ring offsets',
            notes:
                'A consumer that needs the face focusable puts tabindex on the host and gets '
                + 'the ONE ring from the base (spec §3.6 - Slate ships five treatments). The '
                + 'right-hand pair sits in an overflow:hidden band and uses focus-ring="inset", '
                + 'which is bug L24\'s class ("focus rings clipped on all four sides by the '
                + 'components they sit inside"). Tab through this state to see both.',
            html:
                '<div style="display:flex; gap:var(--ui-space-5); align-items:center">'
                + '<ui-keycap tabindex="0">7</ui-keycap>'
                + '<div style="overflow:hidden; display:flex; gap:var(--ui-space-2);'
                + ' padding:0; inline-size:112px">'
                + '<ui-keycap tabindex="0" focus-ring="inset">8</ui-keycap>'
                + '<ui-keycap tabindex="0" focus-ring="inset">9</ui-keycap>'
                + '</div></div>',
        },
        {
            id: 'disabled',
            title: 'Disabled, and hidden',
            notes:
                'Two base behaviours with no code in this component. [disabled] on the host '
                + 'dims once through --ui-opacity-disabled (.38, one dial against Slate\'s '
                + 'three live values) - not twice, because nothing inside the shadow tree '
                + 'carries the attribute. [hidden] really hides, even though this component '
                + 'sets `display` on :host: the base rule is (0,2,0) and wins with zero '
                + '!important, which is slate-components.css:230-239\'s bug fixed by '
                + 'specificity rather than by force.',
            html:
                '<div style="display:flex; gap:var(--ui-space-3); align-items:center">'
                + '<ui-keycap>K</ui-keycap>'
                + '<ui-keycap disabled>K</ui-keycap>'
                + '<ui-keycap hidden>K</ui-keycap>'
                + '<span style="font-size:var(--ui-text-2xs); color:var(--ui-muted)">'
                + 'third one is [hidden]</span>'
                + '</div>',
        },
        {
            id: 'hit-floor',
            title: 'Against bug L22, at scale',
            notes:
                'The face beside the thing it replaces. L22: "five of the nine numpad targets '
                + 'are inline spans whose hit box is the glyphs - measured 32 x 35 against a '
                + '48px floor, on a wall panel operated with a wet hand". The right-hand box '
                + 'is that span at its measured size, drawn here only so the comparison is '
                + 'visible; nothing in the component paints it. The squeeze case - ink forced '
                + 'below the floor while the ::before holds 48px - is not showable from '
                + 'outside a shadow root and lives in the rendering test instead.',
            html:
                '<div style="display:flex; gap:var(--ui-space-6); align-items:center;'
                + ' padding:var(--ui-space-3)">'
                + '<ui-keycap>7</ui-keycap>'
                + '<span style="display:inline-grid; place-items:center; inline-size:32px;'
                + ' block-size:35px; border:var(--ui-hairline) dashed var(--ui-line-strong);'
                + ' color:var(--ui-muted); font-size:var(--ui-text-base)">7</span>'
                + '</div>',
        },
        {
            id: 'narrow-container',
            title: 'In a 36px container',
            notes:
                'Ergonomics is physical (spec §2.2: "Control heights, touch targets, hairlines '
                + '| Fixed token. Never fluid"), so the face overflows its container rather '
                + 'than shrinking below the floor. The oracle has no vote here - Slate is '
                + 'frozen at 1920x1200 and never meets a narrow container - so the layout spec '
                + 'governs, and it says the small window is exactly when a shrunken target '
                + 'hurts most.',
            hostStyle: { 'inline-size': '36px' },
            html: '<ui-keycap>Space</ui-keycap>',
        },
    ],
};

export default entry;
