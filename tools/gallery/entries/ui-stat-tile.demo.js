/**
 * ui-stat-tile.demo.js — the gallery's loader for component #33 (wave 2, item #33).
 *
 * WHY THE ENTRY POINTS HERE RATHER THAN STRAIGHT AT THE COMPONENT. gallery.js does one
 * `import(entry.module)` per entry (gallery.js:46-51, :78), so an entry that needs two
 * modules loaded needs a module that imports two. The precedent is `seams.demo.js` and
 * `ui-sheet-header.demo.js`, both of which already ship
 * `module: './entries/<id>.demo.js'`.
 *
 * #33 needs exactly that for ONE state, `slotted-action`. Slate paints a button inside
 * the gauge — `.slate-gauge strong > span.slate-gauge-action`, a hairline pill with its
 * own ink and `color: … !important`, "so it stops reading as a weight and starts reading
 * as a button" (slate-live.css:983-996). It IS a button, so in Decal it is #1 ui-button
 * slotted into the value slot, and a private button treatment inside a readout is the
 * founding defect's exact shape in a different family. Showing that state honestly means
 * putting a real `<ui-button>` on the stage.
 *
 * AND THAT IS A TRAP, not a preference: gallery.js:86-88 collects every hyphenated tag in
 * the mounted stage and awaits `customElements.whenDefined()` on all of them before it
 * settles. A state that puts `<ui-button slot="value">` on the stage without ui-button's
 * module having been imported does not render a plain button — it waits forever, and the
 * gallery never reaches `gallerySettled`, which the battery records as `unsettled` after
 * 45 s per state, per theme, per geometry.
 *
 * No `adoptSeams()` here. The tile draws no divider of its own and the cluster states
 * below use `column-gap` for spacing rather than a seam: a gap between gauges is a
 * GUTTER, and "not a spacing utility either: gutters are --ui-space-*, and one gap cannot
 * be two widths" (CONVENTIONS §13, "What this is not").
 */

import '../../../src/components/ui-stat-tile.js';
import '../../../src/components/ui-button.js';

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
