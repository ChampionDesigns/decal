/**
 * ui-dialog.demo.js — the gallery's loader for component #18, the dialog shell.
 *
 * gallery.js does one `import(entry.module)` per entry (gallery.js:46-51, :78), so an
 * entry needing more than one module needs a module that imports them. Every state
 * here holds a footer of `ui-button`s and four of the five hold an `ui-icon-button` as
 * the way out, and gallery.js:86-88 waits on `customElements.whenDefined()` for EVERY
 * hyphenated tag it finds on the stage before it settles. A state that mounts
 * `<ui-button>` without ui-button's module having been imported does not fall back to
 * a plain button — it waits forever on a promise nothing will resolve, `show()` never
 * sets `gallerySettled`, and the battery burns its 45s per-state timeout with zero page
 * errors to show for it (measured for ui-menu, `ui-menu.demo.js`).
 *
 * ui-sheet-header is NOT imported here: `ui-dialog.js` imports it itself, because #16
 * is the header it renders rather than something a consumer slots in.
 */

import '../../../src/components/ui-dialog.js';
import '../../../src/components/ui-button.js';
import '../../../src/components/ui-icon-button.js';

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
