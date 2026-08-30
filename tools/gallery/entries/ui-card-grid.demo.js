/**
 * ui-card-grid.demo.js — the gallery's loader for component #51 (wave 4, item #51).
 *
 * WHY A DEMO MODULE AND NOT `module: '../../src/components/ui-card-grid.js'`.
 * gallery.js does exactly one `import(entry.module)` per entry (gallery.js:71), and
 * every state below mounts the grid with REAL #8 cards as its cells — which is the row
 * itself ("| 51 | Card grid | 2-up card layout … | small | #8 |", SCOPE.md:1643). A
 * grid photographed with stand-in divs would show the layout and hide the dependency.
 * Two imports, no behaviour: the states stay strings and the mount stays synchronous.
 */

import '../../../src/components/ui-card.js';
import '../../../src/components/ui-card-grid.js';
