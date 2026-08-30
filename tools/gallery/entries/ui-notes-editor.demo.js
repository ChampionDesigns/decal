/**
 * ui-notes-editor.demo.js — the gallery's loader for component #55, the notes editor.
 *
 * gallery.js does one `import(entry.module)` per entry (gallery.js:46-51, :78), so an
 * entry needing more than one module needs a module that imports them. The
 * `with-subject` state slots #7 into `slot="subject"` — the row is a slot precisely so
 * that a screen composes an existing field rather than this component building one —
 * and gallery.js:86-88 waits on `customElements.whenDefined()` for EVERY hyphenated
 * tag it finds on the stage before it settles. A state mounting `<ui-text-field>`
 * without ui-text-field's module having been imported does not fall back to anything:
 * it waits forever on a promise nothing will resolve, and the battery burns its 45s
 * per-state timeout with no page error to show for it (ui-dialog.demo.js records the
 * same measurement for ui-menu).
 *
 * `ui-dialog` is deliberately NOT imported. #55 is a dialog BODY and the gallery shows
 * it in its own container rather than in the top layer — see the entry's header.
 */

import '../../../src/components/ui-notes-editor.js';
import '../../../src/components/ui-text-field.js';

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
