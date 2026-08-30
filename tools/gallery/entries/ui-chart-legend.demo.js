/**
 * ui-chart-legend.demo.js — the gallery's loader for the CHART LEGEND (wave 3, item #10).
 *
 * IT DEFINES NOTHING AND OVERRIDES NOTHING. The subject is the shipping component, and
 * this file exists for one mechanical reason: `gallery.js` does exactly ONE
 * `import(entry.module)` per entry (gallery.js:46-51), and the `in-the-cards-row` state
 * mounts `<ui-chart-card>` as well as `<ui-chart-legend>`. Without the card's module the
 * tag stays an unknown element — an inline box with no shadow root — and the state
 * photographs as a legend floating on the page rather than as the layout contract it is
 * there to show. Two imports, no subclass.
 *
 * WHY THE CARD IS IN THE GALLERY AT ALL FOR THIS ENTRY. Item #10's own row says its
 * "78px height cost is part of #9's layout contract" (SCOPE.md:1597), and that cost is
 * not visible in a legend on its own: what you have to be able to SEE is the chip row
 * sitting in the card's reserved grid row with the plot below it (bug chart-C10). The
 * card draws no traces without a derivation, which is honest here — this state is about
 * the row, and `ui-chart-card`'s own entry owns the picture with a shot in it.
 */

import '../../../src/components/ui-chart-legend.js';
import '../../../src/components/ui-chart-card.js';
