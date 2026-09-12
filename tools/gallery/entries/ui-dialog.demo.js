/**
 * A gallery entry names one module, so an entry whose states mount more than one custom
 * element points at a loader instead of at a component. This one registers the dialog
 * shell and the two controls its footers and headers put inside it.
 */

import '../../../src/components/ui-dialog.js';
import '../../../src/components/ui-button.js';
import '../../../src/components/ui-icon-button.js';

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
