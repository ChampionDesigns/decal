/**
 * The gallery entry for.
 */

const SCREEN = 'display:grid; grid-template-rows:var(--ui-band-h) minmax(0,1fr);'
    + ' gap:var(--ui-seam); background:var(--ui-line-strong); block-size:300px';

const BODY = 'background:var(--ui-fascia)';

/* A light-DOM control, so the slots have something to hold that this component did not
 * build. Height is --ui-control-lg, the band's own control size. */
const chip = (label, attrs = '') =>
    '<button ' + attrs + ' style="block-size:var(--ui-control-lg); padding:0 24px;'
    + ' border:0; background:none; font:inherit; color:inherit; font-size:20px">'
    + label + '</button>';

/* The editor tablist, painted BY THE FIXTURE - see the header note. */
const tab = (label, selected) =>
    '<button role="tab" aria-selected="' + (selected ? 'true' : 'false') + '"'
    + ' style="block-size:var(--ui-control-lg); padding:0 28px; border:0; font:inherit;'
    + ' font-size:20px; border-radius:var(--ui-radius);'
    + ' background:' + (selected ? 'var(--ui-selected-face)' : 'transparent') + ';'
    + ' color:' + (selected ? 'var(--ui-selected-ink)' : 'inherit') + '">'
    + label + '</button>';

export const entry = {
    id: 'ui-page-header',
    title: 'Page header bar',
    module: '../../src/components/ui-page-header.js',
    notes:
        'Component #31, the 118px screen band (spec §5.2 row 31). One implementation '
        + 'replacing three - slate-shell.css:134-141, slate-live.css:94-102 and '
        + 'profile-editor-v3.css:95-104 - which is what retires P17, the 2px inset '
        + 'disagreement: the inset is var(--ui-space-6) = 28px, declared once on a class '
        + 'inside the shadow root, so there is no per-screen surface to disagree from. '
        + 'The band height is --ui-band-h and the 18px above and below the controls is '
        + 'DERIVED by centring --ui-control-lg in it, never declared (Appendix 12). It '
        + 'owns one piece of wording and nothing else owns it: D11, "the save button '
        + 'reads Save (3), and the shared component decides the wording - never per '
        + 'screen". A screen hands it a NUMBER; there is no label property, attribute or '
        + 'slot. It paints no selection of any kind - the things that select sit in its '
        + 'slots and are #3.',
    states: [
        {
            id: 'settings-dirty',
            title: 'Settings, three unsaved changes',
            notes:
                'D11 in one photograph: Cancel plus "Save (3)", the save carrying the '
                + 'primary fill because there is something to affirm. The count is a '
                + 'property; the sentence is the component\'s. Slate reached the same '
                + 'shape by hand at settings.js:271-281 and then discarded its own '
                + 'module\'s label to rebuild it locally, which is the defect D11 closes.',
            html: '<ui-page-header heading="Settings" commit change-count="3"></ui-page-header>',
        },
        {
            id: 'settings-clean',
            title: 'Settings, nothing to save',
            notes:
                'The same header at zero: "Close" alone, no Cancel, no primary fill. '
                + 'Slate\'s own S10 note is the authority - "Save was full-primary on '
                + 'untouched pages, so the affirmative treatment said nothing about '
                + 'whether there was anything to affirm". The oracle corroborates it by '
                + 'what is missing: CITE settings-display-skin #save-settings-btn [i=4] '
                + '<button id="save-settings-btn" class="slate-btn slate-btn-tall '
                + 'slate-commit-clean"> text "Close", and cancel-settings-btn matches 0 '
                + 'elements anywhere in the corpus because all 38 settings states are clean.',
            html: '<ui-page-header heading="Settings" commit change-count="0"></ui-page-header>',
        },
        {
            id: 'editor',
            title: 'Profile editor - flanks layout, tablist in the centre',
            notes:
                'The default layout, minmax(0,1fr) auto minmax(0,1fr): the centre track '
                + 'is the tablist\'s own width and the flanks overflow rather than shove '
                + '(LAYOUT_SPEC_DRAFT.md:632-633, Appendix 7). Slate writes 430px there; '
                + 'a px literal three times over is the same defect as the 430px rail '
                + 'written three times. The selected tab is painted BY THIS FIXTURE, not '
                + 'by the band - see the file header.',
            html:
                '<ui-page-header heading="Profile editor">'
                + '<div slot="centre" role="tablist" style="display:flex; gap:8px">'
                + tab('Steps', true) + tab('Settings', false) + tab('Review', false)
                + '</div>'
                + '<div slot="trail">' + chip('Exit') + '</div>'
                + '</ui-page-header>',
        },
        {
            id: 'live',
            title: 'Live - centre layout, banner landmark',
            notes:
                'layout="centre" gives the middle track the free space: "library button, '
                + 'favourites bank (1fr, min-width: 0), action cluster" (spec §4.1). '
                + 'role="banner" is opt-in and Live is the one screen that opts in - the '
                + 'oracle splits 7 states with the role (CITE live-ready '
                + '.slate-live-header [i=1] role="banner") against 39 without it, and the '
                + '39 are right, because a banner landmark inside a dialog is a landmark '
                + 'in the wrong place. The element is a real <header> either way - and '
                + 'when the landmark is off it says role="none" OUT LOUD, because a bare '
                + '<header> outside article/aside/main/nav/section carries the IMPLICIT '
                + 'role banner and role="dialog" does not suppress it, so omitting the '
                + 'attribute would GRANT the landmark rather than withhold it (measured '
                + 'AXROLE "banner"; review finding c3-2).',
            html:
                '<ui-page-header layout="centre" banner>'
                + chip('Profiles', 'slot="lead"')
                + '<div slot="centre" style="display:flex; gap:8px; min-inline-size:0">'
                + chip('Londinium') + chip('Filter') + chip('Espresso')
                + '</div>'
                + '<div slot="trail" style="display:flex; gap:24px">'
                + chip('Settings') + chip('Sleep')
                + '</div>'
                + '</ui-page-header>',
        },
        {
            id: 'three-screens',
            title: 'P17 - three configurations, one inset',
            notes:
                'The bug, made inexpressible. Slate\'s three sheets each write their own '
                + 'inset and two of them disagree with the History Viewer header by 2px '
                + '(CITE settings-display-skin #subpage-header [i=2] padding-left = 30px, '
                + 'FROZEN/hardcoded; CITE editor-steps .slate-editor-header [i=2] '
                + 'padding-left = 30px, FROZEN/hardcoded; against slate-live.css:2210 '
                + 'padding: 0 var(--slate-space-6)). Here the left edges of all three '
                + 'titles and the right edges of all three action clusters line up '
                + 'exactly, because there is one .band and one var(--ui-space-6). Moving '
                + 'it means moving the scale, which moves every 28px in the application '
                + 'together - which is what "on the scale" means (spec §3.3, "30 -> 28").',
            html:
                '<div style="display:grid; gap:var(--ui-seam); background:var(--ui-line-strong)">'
                + '<ui-page-header heading="Settings" commit change-count="3"></ui-page-header>'
                + '<ui-page-header heading="Profile editor">'
                + '<div slot="centre" role="tablist" style="display:flex; gap:8px">'
                + tab('Steps', true) + tab('Review', false)
                + '</div>'
                + '<div slot="trail">' + chip('Exit') + '</div>'
                + '</ui-page-header>'
                + '<ui-page-header layout="centre" banner>'
                + chip('Profiles', 'slot="lead"')
                + '<div slot="centre" style="display:flex; gap:8px; min-inline-size:0">'
                + chip('Londinium') + chip('Filter')
                + '</div>'
                + '<div slot="trail">' + chip('Sleep') + '</div>'
                + '</ui-page-header>'
                + '</div>',
        },
        {
            id: 'screen-grid',
            title: 'Departure 2 - the underline is the screen grid\'s gap',
            notes:
                'Slate\'s three bands each draw their own bottom edge (CITE editor-steps '
                + '.slate-editor-header [i=2] box-shadow = rgb(82, 97, 107) 0px -1px 0px '
                + '0px inset, token-driven, light rgb(170, 178, 183)). This one draws '
                + 'none: CONVENTIONS §13 names the header underline as the seam '
                + 'utility\'s job, and all four screens put the band in row 1 of a grid '
                + 'whose gap is the divider. TOP: in a screen grid, where the line is '
                + 'there and is drawn once. BOTTOM: the same band with no grid under it, '
                + 'where there is deliberately no line - a visible omission rather than a '
                + 'silent one, and never bug L9\'s shape of two drawers for one line.',
            html:
                '<div style="' + SCREEN + '">'
                + '<ui-page-header heading="Settings" commit change-count="3"></ui-page-header>'
                + '<div style="' + BODY + '"></div>'
                + '</div>'
                + '<div style="block-size:24px"></div>'
                + '<ui-page-header heading="Settings" commit change-count="3"></ui-page-header>',
        },
        {
            id: 'narrow-container',
            title: 'In a 520px container - the title gives first',
            notes:
                'The host is narrow at an unchanged viewport: the component reads its own '
                + 'container, never the viewport (spec §2.1 Rule 1), and this state is the '
                + 'only honest way to show that. The title ellipsises; the commit cluster '
                + 'never gives a pixel - flex: 0 0 auto on the actions, min-inline-size: 0 '
                + 'on the title, which is Appendix 7\'s "flanks overflow, never shove" made '
                + 'mechanical. Slate has no answer here at all: its geometry is frozen at '
                + '1920 and the oracle is disqualified on responsive behaviour, so the '
                + 'layout spec governs.',
            hostStyle: { 'inline-size': '520px' },
            html:
                '<ui-page-header commit change-count="12" '
                + 'heading="A profile name long enough that the band has to decide what gives first">'
                + '</ui-page-header>',
        },
    ],
};

export default entry;
