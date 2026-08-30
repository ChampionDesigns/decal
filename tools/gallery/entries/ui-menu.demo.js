/**
 * ui-menu.demo.js — the gallery's loader for component #21, the menu / popover.
 *
 * WHY THE ENTRY POINTS HERE RATHER THAN STRAIGHT AT THE COMPONENT. gallery.js does one
 * `import(entry.module)` per entry (gallery.js:46-51, :78), so an entry that needs two
 * modules loaded needs a module that imports two. The precedent is `seams.demo.js`,
 * `ui-sheet-header.demo.js` and `ui-stat-tile.demo.js`, all of which already ship
 * `module: './entries/<id>.demo.js'` for exactly this reason.
 *
 * #21 needs it for SIX of its seven states. The trigger is a slot and the row's subject
 * is "composes #1" — five states slot a real `<ui-button slot="trigger">` and the sixth
 * (`popover-content`) slots one too, because a popover's trigger is a button like any
 * other. Only `plain-trigger` uses a bare `<button>`, and that state is the control
 * showing the slot takes whatever the screen already has.
 *
 * AND THAT IS A TRAP, not a preference: gallery.js:86-88 collects every hyphenated tag
 * in the mounted stage and awaits `customElements.whenDefined()` on all of them before
 * it settles. A state that puts `<ui-button slot="trigger">` on the stage without
 * ui-button's module having been imported does not render a plain button — it waits
 * forever on a promise nothing will resolve, `show()` never sets `gallerySettled`, and
 * the battery burns its full 45 s per-state timeout and records `unsettled`. It throws
 * NOTHING while it does so: the page has zero errors and the stage is populated, which
 * is why a passing per-component render suite cannot see it (that suite mounts its own
 * page with both modules named, `ui-menu.render.test.mjs:50`).
 *
 * MEASURED, before this file existed, driving the real gallery page over CDP at BENCH
 * dark: `ui-menu--closed` and `ui-menu--open-below` both sat at
 * `document.body.dataset.gallerySettled === undefined` for the full 8,000 ms probe with
 * `galleryState` never set and `pageErrors` empty, while `ui-menu--plain-trigger`
 * settled in 146 ms and `ui-tab-bar--editor-tabs` in 147 ms in the same run.
 *
 * No `adoptSeams()` here. The menu's separator is "a seam: a 1px grid gap over
 * --ui-line" drawn INSIDE the component's own shadow root (the entry's `row-states`
 * notes), not the parent's row-seam utility, so there is nothing to adopt into the
 * gallery document.
 */

import '../../../src/components/ui-menu.js';
import '../../../src/components/ui-button.js';

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
