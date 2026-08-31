/**
 * Gallery entry for.
 */

export const entry = {
    id: 'ui-notes-editor',
    title: 'Notes editor',
    module: './entries/ui-notes-editor.demo.js',
    notes: 'EasyMDE hosted in a shadow root: the vendor sheet is adopted into a cascade layer, '
        + 'so every rule here wins without one !important against the 40 the old modal needed. '
        + 'Keys are --ui-control-h square with a --ui-seam-ink seam; the active key is the four '
        + 'selection dials through aria-pressed, never a private look.',
    states: [
        {
            id: 'seeded',
            title: 'Seeded — text, bank and the 18px editing step',
            notes: 'The editing surface is --ui-text-md (18px), the step the old modal '
                + 'asked for, against a 28px dialog heading. The reference skin delivered that ratio as 1.04.',
            hostStyle: { 'inline-size': '772px', 'block-size': '380px' },
            html: `
<ui-notes-editor
  id="notes"
  label="Notes"
  value="Ethiopia Guji, 17.5 g in.

Ground two clicks finer than last week and the **first drop** came at 9 s rather than 13.

- puck prep: WDT, then a light tamp
- basket: 18 g VST
- water: 60 ppm

Next: hold the pre-infusion a second longer."></ui-notes-editor>`,
        },
        {
            id: 'empty',
            title: 'Empty — the placeholder, in --ui-muted',
            notes: 'The old modal shipped this prompt and this ellipsis; what changes is '
                + 'that the colour is a token rather than CodeMirror\'s own grey.',
            hostStyle: { 'inline-size': '772px', 'block-size': '380px' },
            html: '<ui-notes-editor id="notes" label="Notes"></ui-notes-editor>',
        },
        {
            id: 'with-subject',
            title: 'With a subject row — a slot, not an <input> this component builds',
            notes: 'The old modal built its own subject field. Here the row is a slot: a '
                + 'screen that needs one composes #7. Empty slot, no row and no gap (T13\'s family).',
            hostStyle: { 'inline-size': '772px', 'block-size': '380px' },
            html: `
<ui-notes-editor id="notes" label="Notes" value="Second cut of the same shot.">
  <ui-text-field slot="subject" label="Subject" value="Guji — grind change"></ui-text-field>
</ui-notes-editor>`,
        },
        {
            id: 'narrow-card',
            title: 'Narrow container — the bank scrolls, it does not truncate',
            notes: 'O11 one component over: a bank that runs out of room and hides the overflow '
                + 'loses its LAST items. --ui-space-2 gutters, overflow-x: auto, nine keys kept.',
            hostStyle: { 'inline-size': '420px', 'block-size': '380px' },
            html: '<ui-notes-editor id="notes" label="Notes" value="A narrow card."></ui-notes-editor>',
        },
        {
            id: 'disabled',
            title: 'Disabled — one dial, --ui-opacity-disabled, and a read-only document',
            notes: 'Paint is the base\'s (CONVENTIONS §4); whether the control still accepts '
                + 'input is the component\'s, and here it is CodeMirror\'s own readOnly.',
            hostStyle: { 'inline-size': '772px', 'block-size': '380px' },
            html: '<ui-notes-editor id="notes" label="Notes" disabled value="Read only."></ui-notes-editor>',
        },
    ],
};

export default entry;
