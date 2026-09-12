/**
 * A gallery entry names one module, so an entry whose states mount more than one custom
 * element points at a loader instead of at a component. This one registers the header and
 * the two controls it puts in the trail, and adopts the seam classes, because the rule
 * under the header is the parent's seam rather than a border of its own.
 */

import '../../../src/components/ui-sheet-header.js';
import '../../../src/components/ui-button.js';
import '../../../src/components/ui-icon-button.js';
import { adoptSeams } from '../../../src/components/seams.js';

adoptSeams(document);

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
