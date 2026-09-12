/**
 * A gallery entry names one module, so an entry whose states mount more than one custom
 * element points at a loader instead of at a component. This one registers the column and
 * the card and button the pane beside it is built from.
 */

import '../../../src/components/ui-wizard-column.js';
import '../../../src/components/ui-card.js';
import '../../../src/components/ui-button.js';

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
