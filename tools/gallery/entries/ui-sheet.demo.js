/**
 * A gallery entry names one module, so an entry whose states mount more than one custom
 * element points at a loader instead of at a component. This one registers the sheet body,
 * the dialog it sits inside, and the three controls its field stack is built from.
 */

import '../../../src/components/ui-sheet.js';
import '../../../src/components/ui-dialog.js';
import '../../../src/components/ui-button.js';
import '../../../src/components/ui-bank.js';
import '../../../src/components/ui-text-field.js';

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
