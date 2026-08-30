/**
 * ui-wizard-column.demo.js — the gallery's loader for component #39 (wave 4, item #39).
 *
 * WHY THE ENTRY POINTS HERE RATHER THAN STRAIGHT AT THE COMPONENT. gallery.js does one
 * `import(entry.module)` per entry, and every state below puts three custom elements on
 * the stage: the wizard, the #8 card it slots as its body, and the #1 buttons it slots
 * as its actions. That is the row itself — "#39 … | medium | #3's dials, #1" (SCOPE.md:
 * 1646) plus spec §4.4's "each with a card and an action" — so a wizard photographed
 * with stand-in divs would show the column and hide what it composes.
 *
 * AND IT IS A TRAP, not a preference (the note ui-stop-button.demo.js writes out in
 * full): gallery.js collects every hyphenated tag on the mounted stage and awaits
 * `customElements.whenDefined()` on all of them before it settles, so a state that
 * mounts `<ui-button>` without ui-button's module having been imported does not render a
 * plain box — it waits for ever and the battery records `unsettled`.
 */

import '../../../src/components/ui-wizard-column.js';
import '../../../src/components/ui-card.js';
import '../../../src/components/ui-button.js';

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
