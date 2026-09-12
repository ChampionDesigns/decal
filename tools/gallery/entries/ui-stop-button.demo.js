/**
 * A gallery entry names one module, so an entry whose states mount more than one custom
 * element points at a loader instead of at a component. This one registers the button and
 * the stepper that shares the rail with it.
 */

import '../../../src/components/ui-stop-button.js';
import '../../../src/components/ui-stepper.js';

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
