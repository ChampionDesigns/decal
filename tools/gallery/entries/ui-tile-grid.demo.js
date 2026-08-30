/**
 * ui-tile-grid.demo.js — the gallery's loader for component #40.
 *
 * WHY THE ENTRY POINTS HERE RATHER THAN STRAIGHT AT THE COMPONENT. gallery.js does
 * one `import(entry.module)` per entry (gallery.js:48), so an entry needing two
 * modules needs a module that imports two.
 *
 * #40 is a container and nothing else — every visible thing in a tile grid is a tile,
 * and a tile is the consumer's. Staging it with bare divs would photograph the one
 * thing it does not own, so the states use the shipped surface primitive, #8
 * `ui-card` (spec §5.1 #8), as the tile. That makes ui-card.js a GALLERY dependency
 * rather than a component dependency — src/components/ui-tile-grid.js imports
 * nothing but lit and the base — and it is load-bearing rather than cosmetic:
 * gallery.js:86-88 collects every hyphenated tag on the stage and awaits
 * `customElements.whenDefined()` on all of them before settling, so a state carrying
 * `<ui-card>` with no ui-card module never reaches `gallerySettled` — it waits
 * forever rather than failing. The precedent and the full account of the trap are in
 * ui-sheet-header.demo.js.
 *
 * Nothing else happens here. No adoptSeams(): the gap in a tile grid is a GUTTER, not
 * a seam (CONVENTIONS §13, "gutters are --ui-space-*, and one gap cannot be two
 * widths"), so there is no ground to paint and nothing to adopt.
 */

import 'src/components/ui-tile-grid.js';
import 'src/components/ui-card.js';
