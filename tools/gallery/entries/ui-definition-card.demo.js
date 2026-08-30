/**
 * ui-definition-card.demo.js — the gallery's loader for component #50.
 *
 * WHY THE ENTRY POINTS HERE RATHER THAN STRAIGHT AT THE COMPONENT. gallery.js does
 * one `import(entry.module)` per entry (gallery.js:48), so an entry needing two
 * modules needs a module that imports two. #50's header carries a slotted action —
 * Slate's is `Copy all`, `CITE settings-machine-machine-info .slate-btn [i=49] rect
 * x=1690 y=298 w=114 h=64` — and the component deliberately does NOT build one: the
 * action is the screen's, and it arrives through `slot="actions"`.
 *
 * That makes ui-button.js a GALLERY dependency rather than a component dependency,
 * and it is load-bearing rather than cosmetic: gallery.js:86-88 collects every
 * hyphenated tag on the stage and awaits `customElements.whenDefined()` on all of
 * them before settling, so a state with `<ui-button slot="actions">` and no
 * ui-button module never reaches `gallerySettled` — it waits forever. The precedent
 * and the full account of the trap are in ui-sheet-header.demo.js.
 *
 * Nothing else happens here. No adoptSeams(): #50 draws its own dividers inside its
 * own shadow root from the `seams` fragment, which is where they belong.
 */

import 'src/components/ui-definition-card.js';
import 'src/components/ui-button.js';
