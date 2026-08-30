/**
 * ui-sheet-header.demo.js — the gallery's loader for component #16.
 *
 * WHY THE ENTRY POINTS HERE RATHER THAN STRAIGHT AT THE COMPONENT. gallery.js does
 * one `import(entry.module)` per entry (gallery.js:46-51, :78), so an entry that
 * needs two modules loaded needs a module that imports two. #16 needs exactly that,
 * for one reason: DEPARTURE 1 — the line under a sheet header is the PARENT's row
 * seam (CONVENTIONS §13, `.seam-strong`: "the emphasised divider: rail edge, header
 * underline, band top"), not a border this component draws. A state that shows the
 * header the way a dialog will use it therefore needs the seam utility adopted into
 * the gallery document, and `adoptSeams()` is the documented door for "any root Lit
 * does not own" (CONVENTIONS §13, last section).
 *
 * The precedent is `seams.demo.js`, whose entry already ships
 * `module: './entries/seams.demo.js'` — one fragment, one source, and no copy of the
 * seam CSS written into a state's markup, which would be the exact anti-pattern the
 * utility exists to end.
 *
 * `adoptSeams()` merges and is idempotent, so loading this and the seams entry in
 * either order, or both, is safe.
 *
 * THE SECOND REASON IS LOAD-BEARING TOO, and it is a trap rather than a preference:
 * gallery.js:86-88 collects every hyphenated tag in the mounted stage and awaits
 * `customElements.whenDefined()` on all of them before it settles. A state that puts
 * `<ui-button slot="trail">` on the stage without ui-button's module having been
 * imported does not render a plain button — it waits forever, and the gallery never
 * reaches `gallerySettled`. #16's dependencies are #1 and #2 (SCOPE.md:1550,
 * "Depends on: #1, #2"), and its whole subject is what they look like in a header
 * row, so both are imported here rather than faked with bare `<button>`s.
 */

import '../../../src/components/ui-sheet-header.js';
import '../../../src/components/ui-button.js';
import '../../../src/components/ui-icon-button.js';
import { adoptSeams } from '../../../src/components/seams.js';

adoptSeams(document);

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
