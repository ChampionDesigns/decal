/**
 * ui-sheet.demo.js — the gallery's loader for component #20, the sheet body.
 *
 * gallery.js does one `import(entry.module)` per entry (gallery.js:46-51, :78), so an
 * entry needing more than one module needs a module that imports them. Half of #20's
 * states are the real composition — a sheet inside a #18 dialog with a #1 footer —
 * and gallery.js waits on `customElements.whenDefined()` for EVERY hyphenated tag it
 * finds on the stage before it settles. A state that mounts `<ui-dialog>` without
 * ui-dialog's module having been imported does not fall back to anything: it waits
 * forever on a promise nothing will resolve, `show()` never sets `gallerySettled`,
 * and the battery burns its 45s per-state timeout with zero page errors to show for
 * it (measured for ui-menu, `ui-menu.demo.js`).
 *
 * ui-sheet-header is NOT imported here: ui-dialog.js imports it itself. ui-bank is,
 * because the schedule editor's "Days of Week" row is a segmented bank and the point
 * of the state is that a real selection control sits in a field slot and keeps the
 * four dials through it.
 */

import '../../../src/components/ui-sheet.js';
import '../../../src/components/ui-dialog.js';
import '../../../src/components/ui-button.js';
import '../../../src/components/ui-bank.js';
import '../../../src/components/ui-text-field.js';

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
