/**
 * The gallery entry for.
 */

export const entry = {
    id: 'ui-sheet-header',
    title: 'Sheet header',
    module: './entries/ui-sheet-header.demo.js',
    notes:
        'Component #16 (spec §5.1 #16): the title-and-cluster row every dialog and '
        + 'sheet wears. Slate\'s version is "the library\'s one real win in the overlay '
        + 'group" and leaked twice — all three consumers re-declare the title type and '
        + 'the time picker\'s is 20px/800 against the component\'s 28px/500 '
        + '(layout/overlays.md A10), and `.slate-sheet-actions` means a header cluster '
        + 'in the library and a dialog FOOTER in the shell (O13). Here the row, the '
        + 'inset and the type are declared on classes inside the shadow root where no '
        + 'screen sheet can name them, the cluster is the `trail` slot, and `actions` '
        + 'is left free for the dialog footer it already means in #18. The title is a '
        + 'string, not a slot, so there is nothing for a document rule to hang a '
        + 'second title treatment on.',
    states: [
        {
            id: 'title-and-actions',
            title: 'Title and a two-button cluster (the numpad / notes shape)',
            notes:
                'numpad-modal.js:176-180 and notes-modal.js:52-72 both build exactly '
                + 'this: title on the left, Cancel and Confirm on the right. ORACLE '
                + 'settings-machine-sleep---wake-schedules .slate-heading [i=74] '
                + 'font-size 28px (--ui-text-xl) / font-weight 500 (--ui-weight-medium) '
                + '/ text-transform uppercase / letter-spacing 1.12px '
                + '(--ui-tracking-cap x 28px). Gap to the cluster 24px (--ui-space-5), '
                + 'inside the cluster 12px (--ui-space-3), bottom inset 18px '
                + '(--ui-space-4), row floor 64px (--ui-control-h) — all four read from '
                + 'slate-components.css:664-695, which the provenance corpus has no '
                + 'record of at all.',
            hostStyle: { 'inline-size': '680px' },
            html:
                '<ui-sheet-header heading="Drink out">'
                + '<ui-button slot="trail">Cancel</ui-button>'
                + '<ui-button slot="trail" variant="primary">Confirm</ui-button>'
                + '</ui-sheet-header>',
        },
        {
            id: 'title-only',
            title: 'Title only — and no 24px hole where the cluster would be',
            notes:
                'Departure 4: an empty cluster is removed from the layout instead of '
                + 'sitting in it eating the flex gap. The row is still --ui-control-h '
                + 'tall, so a header with nothing in its trail is the same height as '
                + 'one with two 64px buttons\' worth of nothing to do.',
            hostStyle: { 'inline-size': '680px' },
            html: '<ui-sheet-header heading="Add schedule" level="3"></ui-sheet-header>',
        },
        {
            id: 'icon-way-out',
            title: 'The way out as an icon button',
            notes:
                'Slate\'s own comment on the original: "A sheet\'s header: its title, '
                + 'and the way out." The three modal closes in the corpus carry '
                + 'aria-label="" and text "x", so their accessible name IS the glyph; '
                + '#2 takes the name from `label` instead, and the hit floor and the '
                + 'focus ring are the button\'s, not this component\'s.',
            hostStyle: { 'inline-size': '520px' },
            html:
                '<ui-sheet-header heading="Set time">'
                + '<ui-icon-button slot="trail" label="Close">'
                + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
                + ' stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
                + '</ui-icon-button>'
                + '</ui-sheet-header>',
        },
        {
            id: 'no-title',
            title: 'No title — and no empty heading in the accessibility tree',
            notes:
                'Wave-2 review c3-7. `heading` defaults to \'\', and every level used to '
                + 'render anyway, so a header built without a title announced an EMPTY '
                + '<h2>. The test is #31\'s, byte for byte (ui-page-header.js:463, '
                + '`const titled = Boolean(this.heading)`), so the wave\'s two headers '
                + 'answer the empty string identically. The state is here because a '
                + 'cluster-only row is a REAL shape — a sheet whose one control is the '
                + 'way out — not only a misuse guard: the row still sits on its 64px '
                + 'floor (--ui-control-h) and the trail keeps its own hit floor and '
                + 'focus ring. The cluster stays at the TRAILING edge on '
                + '`margin-inline-start: auto`, because `justify-content: space-between` '
                + 'separates two items and puts a lone one at the start — the empty '
                + '<h2> had been doing that job by accident.',
            hostStyle: { 'inline-size': '520px' },
            html:
                '<ui-sheet-header>'
                + '<ui-icon-button slot="trail" label="Close">'
                + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
                + ' stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
                + '</ui-icon-button>'
                + '</ui-sheet-header>',
        },
        {
            id: 'in-a-sheet',
            title: 'In a sheet — the rule is the parent\'s seam, not a border',
            notes:
                'DEPARTURE 1, and the contract wave 3\'s #18 implements. Slate ends '
                + '.slate-sheet-header with `border-bottom: var(--slate-hairline) solid '
                + 'var(--slate-line)`; CONVENTIONS §13 gives that line to the seam '
                + 'utility — ".seam-strong | the emphasised divider: rail edge, header '
                + 'underline, band top" — because a line between a header and a body is '
                + 'a line between two CELLS. The stage here is a `seam-grid seam-rows '
                + 'seam-line` with the header as its first cell: N cells, N-1 seams, no '
                + 'sibling selector to get wrong (bug T2). The header keeps its own '
                + '18px bottom inset, which is the space above the line.',
            hostStyle: { 'inline-size': '680px' },
            html:
                '<div class="seam-grid seam-rows seam-line"'
                + ' style="border-radius: var(--ui-radius-xl); overflow: hidden">'
                + '<ui-sheet-header class="seam-cell" heading="Notes"'
                + ' style="padding: var(--ui-space-6) var(--ui-space-6) 0">'
                + '<ui-button slot="trail">Cancel</ui-button>'
                + '<ui-button slot="trail" variant="primary">Confirm</ui-button>'
                + '</ui-sheet-header>'
                + '<div class="seam-cell" style="padding: var(--ui-space-6);'
                + ' min-block-size: 180px">The sheet body. #18 owns the box, the'
                + ' backdrop, the bounded scroll and the modality; #16 owns this row'
                + ' and nothing else.</div>'
                + '</div>',
        },
        {
            id: 'long-title',
            title: 'A title longer than the row — the way out is never squeezed off',
            notes:
                'Carried from slate-components.css:676-687: min-width 0 + nowrap + '
                + 'overflow hidden + text-overflow ellipsis on the title, flex-shrink 0 '
                + 'on the cluster. The ellipsis is paint only — the whole string stays '
                + 'in the accessibility tree, so a screen reader still reads the title '
                + 'a sighted user cannot finish.',
            hostStyle: { 'inline-size': '520px' },
            html:
                '<ui-sheet-header heading="Sleep and wake schedules for this machine">'
                + '<ui-button slot="trail">Cancel</ui-button>'
                + '<ui-button slot="trail" variant="primary">Save</ui-button>'
                + '</ui-sheet-header>',
        },
        {
            id: 'narrow-container',
            title: 'In a 320px container',
            notes:
                'The header reads its own container and nothing else — no @media '
                + 'anywhere in the component, and the base gives every host '
                + 'container-type: inline-size. The oracle has no vote on this state: '
                + 'its geometry is frozen at 1920x1200, which is what makes the two '
                + 'measured titles 159x31 and 538x33 (Part 10 §4 disqualification 2).',
            hostStyle: { 'inline-size': '320px' },
            html:
                '<ui-sheet-header heading="Exit condition">'
                + '<ui-icon-button slot="trail" label="Close">'
                + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
                + ' stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
                + '</ui-icon-button>'
                + '</ui-sheet-header>',
        },
        {
            id: 'o13-under-the-shell-rules',
            title: 'O13 + O1 + A10: under the three rules that break Slate\'s header',
            notes:
                'The stage carries the exact declarations that make the three defects, '
                + 'aimed at every name they use in Slate — the shell\'s footer rule '
                + '(justify-content: flex-end; margin-top: 40px; gap: 18px) that turns '
                + 'a header cluster into a footer (O13, slate-shell.css:2227-2232), the '
                + 'shell\'s notes-header rule (height: 118px; padding: 0) that kills the '
                + 'shared inset (O1, slate-shell.css:961-965), and the time picker\'s '
                + '20px/800 title (A10, time-picker-modal.css:74-75). None of them can '
                + 'name anything inside the root, so this state must be '
                + 'pixel-identical to `title-and-actions` apart from the host box the '
                + 'height rule legitimately owns.',
            hostStyle: { 'inline-size': '680px' },
            html:
                '<style>'
                + '.slate-sheet-actions, .trail, ui-sheet-header .trail {'
                + ' justify-content: flex-end; margin-top: 40px; gap: 18px }'
                + '.slate-sheet-header, .head, ui-sheet-header .head { padding: 0 }'
                + '.slate-sheet-title, .title, ui-sheet-header .title {'
                + ' font-size: 20px; font-weight: 800; letter-spacing: 0.01em }'
                + '</style>'
                + '<ui-sheet-header heading="Drink out">'
                + '<ui-button slot="trail">Cancel</ui-button>'
                + '<ui-button slot="trail" variant="primary">Confirm</ui-button>'
                + '</ui-sheet-header>',
        },
    ],
};

export default entry;
