/**
 * ui-dialog.entry.js — gallery entry for component #18, the dialog / modal shell.
 *
 * Written as its own file because `tools/gallery/entries.js` is one shared array under
 * a whole-file-write rule: N builders appending to it in parallel is N−1 entries lost,
 * which is why wave 1 moved to per-entry files. The wave's reviewer wires the import
 * line and the array slot in serially. `test/ui-dialog-gallery-entry.test.mjs` asserts
 * the shape before that hand-off, and `test/render/ui-dialog.render.test.mjs` mounts
 * every state below in a real browser at both Gate A geometries.
 *
 * TWO THINGS TO KNOW BEFORE READING THE SCREENSHOTS.
 *
 * 1. A MODAL DIALOG DOES NOT SIT IN THE STAGE. It is in the browser's top layer, so it
 *    is centred on the VIEWPORT and its scrim covers the whole gallery, stage frame and
 *    all. That is not the stage failing to contain it — it is the one component in the
 *    inventory whose geometry is the window's by design (spec §4.6: "One real
 *    breakpoint survives here ... query the real window, which for a top-layer dialog is
 *    the only query that means anything"). `hostStyle` still does its usual job: it sets
 *    the custom properties the dialog inherits, which is how `narrow-card` shows the
 *    720px container query firing without touching the viewport.
 *
 * 2. THE GALLERY'S OWN NAV IS INERT WHILE ONE OF THESE STATES IS ON THE STAGE, and that
 *    is the component working. Real modality means every sibling on the composed path
 *    is marked `inert` (the H9/O8 half of the row). Move between these states with the
 *    URL's `?state=` parameter — which is exactly what `tools/capture_battery.py` does
 *    (it navigates per state, capture_battery.py:107), so the battery is unaffected.
 */

export const entry = {
    id: 'ui-dialog',
    title: 'Dialog / modal shell',
    module: './entries/ui-dialog.demo.js',
    notes: 'One native <dialog> with header / body / actions. Real modality: inert page, '
        + 'focus trap, focus restore. Scrim from --ui-scrim + --ui-scrim-blur on the true '
        + '::backdrop; the seam under the header is a 1px grid gap, not a border.',
    states: [
        {
            id: 'confirm',
            title: 'Confirm — the smallest shape',
            notes: 'DECISIONS.md:251 names the confirm dialog as a primitive that never existed. '
                + 'Header, one line of body, two buttons: three grid tracks and two seams.',
            html: `
<ui-dialog id="d" open heading="Delete profile">
  <p slot="body" style="margin: 0">Cortado 9 bar will be removed from this machine. This cannot be undone.</p>
  <ui-button slot="actions">Cancel</ui-button>
  <ui-button slot="actions" variant="danger">Delete</ui-button>
</ui-dialog>`,
        },
        {
            id: 'sheet-with-trail',
            title: 'Sheet header with a way out',
            notes: 'The header is #16, and the close control rides in its `trail` cluster — O13\'s '
                + 'repair finished: the header cluster is `trail`, the footer is `actions`.',
            html: `
<ui-dialog id="d" open heading="Wake schedule">
  <ui-icon-button slot="header-trail" label="Close">✕</ui-icon-button>
  <div slot="body">
    <p style="margin: 0 0 18px">The machine wakes at the first scheduled time each day it is left on standby.</p>
    <button style="block-size: 64px; inline-size: 100%">06:30 — weekdays</button>
  </div>
  <ui-button slot="actions">Cancel</ui-button>
  <ui-button slot="actions" variant="primary">Save</ui-button>
</ui-dialog>`,
        },
        {
            id: 'scrolling-body',
            title: 'Bounded and scrollable',
            notes: '§4.6: "Bounded and scrollable is mandatory. Only the numpad does this today." '
                + 'The card stops at 100% − 2 × --ui-space-5 and the BODY is the only track that '
                + 'gives way; the header and the way out never move.',
            html: `
<ui-dialog id="d" open heading="Shot notes">
  <ui-icon-button slot="header-trail" label="Close">✕</ui-icon-button>
  <div slot="body">
    <p style="margin: 0 0 18px">Grind 4.2 · 18.0 g in · 36.4 g out · 29 s</p>
    <p style="margin: 0 0 18px">The first two thirds of the pull ran fast and the flow never settled; the puck
      was probably under-tamped on the right. Pressure peaked at 9.1 bar and fell away from second 14.</p>
    <p style="margin: 0 0 18px">Second attempt with the same dose and a finer setting held 8.6 bar to the
      end and tasted noticeably sweeter, so the grind is the variable to move.</p>
    <p style="margin: 0 0 18px">Water temperature was 93.2 °C at the group and drifted 0.4 °C over the shot.</p>
    <p style="margin: 0 0 18px">Basket: 18 g VST. Distribution by needle, no WDT.</p>
    <p style="margin: 0 0 18px">Beans rested nine days; the bag says twelve is the peak for this roast.</p>
    <p style="margin: 0">Next: 18.5 g in, same profile, and hold the ratio at 1:2.</p>
  </div>
  <ui-button slot="actions">Discard</ui-button>
  <ui-button slot="actions" variant="primary">Save note</ui-button>
</ui-dialog>`,
        },
        {
            id: 'body-only',
            title: 'Body only — one track',
            notes: 'No heading, no trail, no actions. The empty cells are not grid items at all, so '
                + 'there is no 0px track and no hairline drawn against nothing.',
            html: `
<ui-dialog id="d" open label="Waiting for the machine">
  <p slot="body" style="margin: 0; text-align: center">Reconnecting to the machine…</p>
</ui-dialog>`,
        },
        {
            id: 'narrow-card',
            title: 'Narrow card — the 720px container query',
            notes: 'The dialog is asked for 560px, so its own container query fires and every cell '
                + 'inset drops --ui-space-5 → --ui-space-4 (SOURCE numpad-modal.css:416). The '
                + 'VIEWPORT is untouched: this is the component reading its own box, spec §2.1 Rule 1.',
            hostStyle: { '--_ui-dialog-inline': '560px' },
            html: `
<ui-dialog id="d" open heading="Exit condition">
  <ui-icon-button slot="header-trail" label="Close">✕</ui-icon-button>
  <div slot="body">
    <p style="margin: 0 0 18px">Stop this step when the shot reaches the weight below.</p>
    <button style="block-size: 64px; inline-size: 100%">36.0 g</button>
  </div>
  <ui-button slot="actions">Cancel</ui-button>
  <ui-button slot="actions" variant="primary">Set</ui-button>
</ui-dialog>`,
        },
    ],
};
