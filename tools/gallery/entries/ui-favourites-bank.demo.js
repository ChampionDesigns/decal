/**
 * ui-favourites-bank.demo.js — the gallery's loader for the FAVOURITES BANK
 * (wave 4, item #36).
 *
 * WHY A DEMO MODULE AND NOT `module: '../../src/components/ui-favourites-bank.js'`.
 * One mechanical reason, and it is a HANG rather than a cosmetic miss.
 *
 * gallery.js does exactly one `import(entry.module)` per entry (gallery.js:46-51), and
 * then — after writing the state's markup into the stage — it AWAITS every custom tag
 * it finds there:
 *
 *     await Promise.all(tags.map((t) => customElements.whenDefined(t)));   (gallery.js:88)
 *
 * `customElements.whenDefined` for a tag whose module was never imported never settles.
 * The `beside-the-tabs` state puts a real `<ui-tab-bar>` beside the bank — that state IS
 * the L8 comparison, the two rows the audit started from — so without this file the
 * gallery stops before `data-gallery-settled` is set and Gate B's capture battery waits
 * on that flag for ever. The entry's modules are lazy and per-entry: `ui-tab-bar` being
 * registered by ITS entry proves nothing, because that entry's module is only imported
 * when that entry is shown, and the battery navigates straight to `?state=…`.
 *
 * NOTHING IS SUBCLASSED AND NOTHING IS ADDED. This file is two side-effect imports; the
 * subject in every state is the shipping component. The imports are relative because
 * this file is two levels below the gallery page whose importmap defines the bare `src/`
 * prefix, and a relative specifier resolves against this file's own URL either way.
 */

import '../../../src/components/ui-favourites-bank.js';
import '../../../src/components/ui-tab-bar.js';
