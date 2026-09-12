/**
 * A gallery entry names one module, and the seam is not an element: it is a sheet of
 * shared classes a document has to adopt before any cell can draw one. This loader does
 * that adoption for the gallery page, so every seam state renders against the same rules
 * a screen gets.
 */

import { adoptSeams } from '../../../src/components/seams.js';

adoptSeams(document);

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
