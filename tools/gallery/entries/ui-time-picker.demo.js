/**
 * ui-time-picker.demo.js — the gallery's loader for Wave 4 item #54.
 *
 * gallery.js does ONE `import(entry.module)` per entry (gallery.js:46-51, :78), so an
 * entry whose states mount more than one tag needs a module that imports them all.
 * gallery.js:86-88 then waits on `customElements.whenDefined()` for EVERY hyphenated
 * tag it finds on the stage before it settles: a state that mounts `<ui-dialog>`
 * without ui-dialog's module having been imported does not fall back to a plain div,
 * it waits forever on a promise nothing will resolve, `show()` never sets
 * `gallerySettled`, and the capture battery burns its 45s per-state timeout with zero
 * page errors to show for it (measured for ui-menu, `ui-menu.demo.js`).
 *
 * `ui-bank` is NOT imported here: `ui-time-picker.js` imports #3 itself, because the
 * readout and the AM/PM pair are banks it composes rather than something a consumer
 * slots in.
 */

import '../../../src/components/ui-time-picker.js';
import '../../../src/components/ui-dialog.js';
import '../../../src/components/ui-button.js';

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
