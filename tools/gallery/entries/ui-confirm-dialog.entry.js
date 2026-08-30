/**
 * ui-confirm-dialog.entry.js — gallery entry for component #19, the confirm dialog.
 *
 * Its own file because `tools/gallery/entries.js` is one shared array under a
 * whole-file-write rule: N builders appending to it in parallel is N−1 entries lost.
 * The wave's single cross-cutting writer adds the import line and the array slot,
 * serially, once. `test/ui-confirm-dialog-gallery-entry.test.mjs` asserts the shape
 * before that hand-off, and `test/render/ui-confirm-dialog.render.test.mjs` mounts
 * every state below in a real browser at both Gate A geometries.
 *
 * THE SAME TWO THINGS ui-dialog's ENTRY SAYS, because this is one of its bodies.
 *
 * 1. A MODAL DIALOG DOES NOT SIT IN THE STAGE. It is in the browser's top layer, so
 *    it is centred on the VIEWPORT and its scrim covers the whole gallery. That is
 *    the one component family in the inventory whose geometry is the window's by
 *    design (spec §4.6). `hostStyle` still does its usual job — it sets the custom
 *    property the card's width reads, which is how `wide-card` shows a screen
 *    widening the confirm without touching the viewport (§2.1 Rule 1).
 * 2. THE GALLERY'S OWN NAV IS INERT while one of these is on the stage, and that is
 *    the component working. Move between states with the URL's `?state=`, which is
 *    what `tools/capture_battery.py` does anyway (capture_battery.py:107).
 *
 * The first state is Slate's own confirm, rebuilt: ORACLE profile-selector
 * `.modal-box [i=191]` text "Reset profile? KEEP Reset", whose destructive action is
 * `bg-red-400` — a raw Tailwind literal — and whose whole card lays itself out at
 * 450x205 WHILE CLOSED (that is P13). Here the words are the same and neither of
 * those two things can happen.
 */

export const entry = {
    id: 'ui-confirm-dialog',
    title: 'Confirm dialog',
    module: '../../src/components/ui-confirm-dialog.js',
    notes: 'A question and a destructive/affirmative pair, as the BODY of a #18 instance — '
        + 'no header band, so two tracks and one seam. Tone is the action\'s paint, never the '
        + 'card\'s. Cancel is authored first, so the caret opens on the way out.',
    states: [
        {
            id: 'destructive',
            title: 'Destructive — Slate\'s own confirm, rebuilt',
            notes: 'ORACLE profile-selector .modal-box [i=191] "Reset profile? KEEP Reset". '
                + 'The destructive fill was app.css .bg-red-400 (rgb(248, 113, 113), '
                + 'FROZEN/hardcoded); here it is #1\'s danger variant, from --ui-status-danger.',
            html: `
<ui-confirm-dialog
  id="c"
  open
  tone="destructive"
  question="Reset profile?"
  detail="Extractamundo Dos! goes back to the version that shipped with the machine. Your edits to it are not kept."
  cancel-label="KEEP"
  confirm-label="Reset"></ui-confirm-dialog>`,
        },
        {
            id: 'affirmative',
            title: 'Affirmative — the primary treatment P8 lost',
            notes: 'P8: "the one affirmative action on the screen has no primary treatment; '
                + 'measured transparent, identical to Cancel beside it". Same pair, one property '
                + 'apart from the state above.',
            html: `
<ui-confirm-dialog
  id="c"
  open
  question="Send this profile to the machine?"
  detail="It replaces whatever is loaded now. The shot you are pulling is not affected."
  confirm-label="Send"></ui-confirm-dialog>`,
        },
        {
            id: 'question-only',
            title: 'Question only — the smallest shape',
            notes: 'No detail line: one h2 and the pair, two grid tracks and one seam. The '
                + 'default labels come from src/lib/i18n.js, whose key is its English text.',
            html: `
<ui-confirm-dialog id="c" open tone="destructive" question="Delete this shot?"></ui-confirm-dialog>`,
        },
        {
            id: 'slotted-body',
            title: 'Slotted body — the consequence, itemised',
            notes: 'The default slot lands under the detail line, inside the scroll region. '
                + 'A confirm that lists what it is about to do is still a confirm.',
            html: `
<ui-confirm-dialog
  id="c"
  open
  tone="destructive"
  question="Restore factory profiles?"
  detail="Three profiles you have edited will be replaced."
  cancel-label="Keep mine"
  confirm-label="Restore">
  <ul style="margin: 0; padding-inline-start: 20px; line-height: 1.6">
    <li>Extractamundo Dos!</li>
    <li>Cortado 9 bar</li>
    <li>Blooming espresso — long</li>
  </ul>
</ui-confirm-dialog>`,
        },
        {
            id: 'wide-card',
            title: 'Wide card — a screen opening the knob',
            notes: 'The card states 500px (ORACLE .modal-box max-w-[500px] authored); a screen '
                + 'that needs more writes --_ui-confirm-inline and the prose caps at --ui-measure. '
                + 'Above 720px the shell\'s own container query stops firing and the cell inset '
                + 'goes back to --ui-space-5. The VIEWPORT is untouched.',
            hostStyle: { '--_ui-confirm-inline': '760px' },
            html: `
<ui-confirm-dialog
  id="c"
  open
  question="Overwrite the shot history on this machine?"
  detail="The tablet holds 412 shots that the machine does not. Overwriting replaces the machine's copy with this one, and there is no undo — the shots that only exist on the machine are gone as soon as this finishes."
  cancel-label="Leave it"
  confirm-label="Overwrite"></ui-confirm-dialog>`,
        },
    ],
};
