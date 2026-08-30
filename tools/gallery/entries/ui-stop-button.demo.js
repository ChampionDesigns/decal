/**
 * ui-stop-button.demo.js — the gallery's loader for component #47 (wave 4, item #47).
 *
 * WHY THE ENTRY POINTS HERE RATHER THAN STRAIGHT AT THE COMPONENT. gallery.js does one
 * `import(entry.module)` per entry, so an entry whose states put two custom elements on
 * the stage needs a module that imports two. The precedent is `seams.demo.js`,
 * `ui-sheet-header.demo.js` and `ui-stat-tile.demo.js`.
 *
 * #47 needs it for the two RAIL states, which are the only honest way to photograph what
 * this control is: an overlay. Slate seats it on the rail's first row on purpose —
 * "Grind is the row you cannot want while the pump is running, so that is the row it
 * takes" (slate-live.css:1778-1782) — so a capture of the button alone shows a red slab
 * and hides the whole design. The pair `rail-idle` / `rail-running` differ by exactly one
 * thing: the control appears, and NOTHING ELSE MOVES. That is Appendix item 3, "state
 * changes weight, never position", which Slate hand-solved with `top: 25px` and the
 * rewrite gets from stacking both children in one grid cell.
 *
 * AND IT IS A TRAP, not a preference: gallery.js collects every hyphenated tag on the
 * mounted stage and awaits `customElements.whenDefined()` on all of them before it
 * settles. A state that puts `<ui-stepper>` on the stage without ui-stepper's module
 * having been imported does not render a plain box — it waits for ever, and the battery
 * records `unsettled` after 45 s per state, per theme, per geometry.
 */

import '../../../src/components/ui-stop-button.js';
import '../../../src/components/ui-stepper.js';

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
