/**
 * The gallery's loader for.
 */

import '../../../src/components/ui-sheet-header.js';
import '../../../src/components/ui-button.js';
import '../../../src/components/ui-icon-button.js';
import { adoptSeams } from '../../../src/components/seams.js';

adoptSeams(document);

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
