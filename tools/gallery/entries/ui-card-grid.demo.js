/**
 * A gallery entry names one module, so an entry whose states mount more than one custom
 * element points at a loader instead of at a component. This one registers the grid and
 * the cards it lays out, which is the smallest set its states can be built from.
 */

import '../../../src/components/ui-card.js';
import '../../../src/components/ui-card-grid.js';
