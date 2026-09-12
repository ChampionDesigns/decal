/**
 * A gallery entry names one module, so an entry whose states mount more than one custom
 * element points at a loader instead of at a component. This one registers the editor and
 * the text field a subject row is slotted from.
 */

import '../../../src/components/ui-notes-editor.js';
import '../../../src/components/ui-text-field.js';

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
