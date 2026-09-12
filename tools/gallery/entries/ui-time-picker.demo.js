/**
 * A gallery entry names one module, so an entry whose states mount more than one custom
 * element points at a loader instead of at a component. This one registers the picker face
 * and the dialog and button that carry it where it is actually used.
 */

import '../../../src/components/ui-time-picker.js';
import '../../../src/components/ui-dialog.js';
import '../../../src/components/ui-button.js';

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
