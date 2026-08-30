/**
 * ui-settings-row.demo.js — the gallery's loader for the SETTINGS ROW (wave 4, item #29).
 *
 * IT DEFINES NOTHING AND OVERRIDES NOTHING. The subject is the shipping component, and
 * this file exists for one mechanical reason: `gallery.js` does exactly ONE
 * `import(entry.module)` per entry (gallery.js:46-51), and this entry's states mount the
 * five control archetypes the row exists to hold — #4 stepper, #5 switch, #3 segmented
 * bank, #7 select, #1 button (SCOPE L1641, "depends on #4, #5, #3, #7, #1"). Without
 * their modules those tags stay unknown elements — inline boxes with no shadow root — and
 * the states photograph as a label column with nothing beside it, which is the one thing
 * these pictures exist to show.
 *
 * The ROW imports none of them either, and that is the same decision seen from the other
 * side: a settings row that imported a stepper would be a stepper row, and the ~30 leaves
 * it covers would need five components instead of one.
 */

import '../../../src/components/ui-settings-row.js';
import '../../../src/components/ui-switch.js';
import '../../../src/components/ui-stepper.js';
import '../../../src/components/ui-select.js';
import '../../../src/components/ui-bank.js';
import '../../../src/components/ui-button.js';
