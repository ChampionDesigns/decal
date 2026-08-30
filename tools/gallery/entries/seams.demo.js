/**
 * seams.demo.js — the gallery's subject for wave 1 item #14, "Hairline / seam".
 *
 * It is a module rather than a component because item #14 SHIPS no component:
 * SCOPE Part 4 says the row "becomes a documented layout utility, not an element".
 * `gallery.js` does `await loadModule(entry)` before it fills the stage, so a module
 * whose one job is to adopt the utility into the gallery document is exactly the
 * hook the documented entry shape already provides — and every state's markup is
 * then plain light-DOM HTML with the utility's classes on it, which is precisely how
 * a screen will use it.
 *
 * This is also the second consumption path being exercised for real: a component
 * writes `static styles = [seams, ...]`, and any root Lit does not own — this page,
 * the capture battery, a hand-attached shadow root — calls `adoptSeams()`. One
 * fragment, one source, two doors.
 */

import { adoptSeams } from '../../../src/components/seams.js';

adoptSeams(document);

/** Exported so the import is not dead weight to a bundler or a reader. */
export const adopted = true;
