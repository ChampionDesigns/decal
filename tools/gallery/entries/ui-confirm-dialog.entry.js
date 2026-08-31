/**
 * Gallery entry for.
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
            title: 'Destructive — the reference skin\'s own confirm, rebuilt',
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
