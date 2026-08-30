/**
 * ui-notes-editor.entry.js — gallery entry for component #55, the notes editor host.
 *
 * Its own file because `tools/gallery/entries.js` is one shared array under a
 * whole-file-write rule: N builders appending to it in parallel is N−1 entries lost.
 * The wave's single cross-cutting writer adds the import line and the array slot,
 * serially, once. `test/ui-notes-editor-gallery-entry.test.mjs` asserts the shape
 * before that hand-off, and `test/render/ui-notes-editor.render.test.mjs` mounts the
 * component in a real <ui-dialog> at both Gate A geometries.
 *
 * WHY THESE STATES ARE NOT INSIDE A DIALOG, unlike #19's.
 *
 * #55 is a BODY — "NO BODY. Not the numpad's keys (#53), NOT THE NOTES EDITOR (#55)"
 * (ui-dialog.js:190-193) — so it registers no `ui-dialog`, and an entry declares one
 * module (here `ui-notes-editor.demo.js`, which also registers the #7 the subject
 * state slots in). Two consequences, and both are the right way round for a gallery:
 *
 *   1. the stage shows the component in ITS OWN CONTAINER, which is the only honest
 *      way to photograph something that reads its container and never the viewport
 *      (spec §2.1 Rule 1). `hostStyle` gives it a block size, exactly as a dialog's
 *      body cell would;
 *   2. the capture battery gets a stable rect. A modal is in the top layer, centred on
 *      the VIEWPORT, with its scrim over the whole gallery — fine for #18 and #19,
 *      where that IS the subject, and pure noise for a body.
 *
 * The dialog integration is proved where it can be driven rather than photographed:
 * the render suite mounts this inside a real #18 and reads the 28:18 type ratio, the
 * key-against-#1 box ratio, Escape, and the absence of `aria-modal` — none of which a
 * screenshot can see.
 *
 * THE KEY BANK IS THE THING TO LOOK AT. Slate's toolbar keys were 64x62 REAL pixels
 * against 42.7 real px controls everywhere else (O7), because an inverse-scale
 * transform put them in a different coordinate space from the rest of the app. There
 * is no transform here, so a key is `--ui-control-h` square and photographs as the
 * same box as any other 64px control in the battery.
 */

export const entry = {
    id: 'ui-notes-editor',
    title: 'Notes editor',
    module: './entries/ui-notes-editor.demo.js',
    notes: 'EasyMDE hosted in a shadow root: the vendor sheet is adopted into a cascade layer, '
        + 'so every rule here wins without one !important against the 40 notes-modal.css needed. '
        + 'Keys are --ui-control-h square with a --ui-seam-ink seam; the active key is the four '
        + 'selection dials through aria-pressed, never a private look.',
    states: [
        {
            id: 'seeded',
            title: 'Seeded — text, bank and the 18px editing step',
            notes: 'The editing surface is --ui-text-md (18px), the step notes-modal.css:249 '
                + 'asked for, against a 28px dialog heading. Slate delivered that ratio as 1.04.',
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
            notes: 'notes-modal.js:199 shipped this prompt and this ellipsis; what changes is '
                + 'that the colour is a token rather than CodeMirror\'s own grey.',
            hostStyle: { 'inline-size': '772px', 'block-size': '380px' },
            html: '<ui-notes-editor id="notes" label="Notes"></ui-notes-editor>',
        },
        {
            id: 'with-subject',
            title: 'With a subject row — a slot, not an <input> this component builds',
            notes: 'notes-modal.js:79-88 built its own subject field. Here the row is a slot: a '
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
