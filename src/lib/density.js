/**
 * density.js — C6, the preference half. Wave 5.4, row `c6-density-type-scale`.
 *
 * SCOPE Part 5 §4: "**C6 (accepted), folded in — what replaces Display Size:** a density
 * and type-scale control with the same four labels. Keep the setting, change what it
 * drives: the old one multiplied the canvas transform (`settings.js:2765-2769` per the
 * spec), and above 1.0 turned the viewport into a scroller. The new control drives
 * `--ui-density` and the type scale — as the *base* value the global height band
 * multiplies; the composition rule for the token's three writers is stated once, in Part
 * 2 §5 rule 2. The people who turned it up did so because text was too small; that need
 * survives the canvas."
 *
 * ===========================================================================
 * WHAT MOVED, AND WHY THE OLD ONE PRODUCED A SCROLLER
 * ===========================================================================
 *
 * The old control scaled the whole CANVAS. A transform of 1.1 makes a 1280-wide layout
 * 1408 wide inside a 1280 window, so the window gains scrollbars on both axes and every
 * fixed thing — the band, the rail — leaves the screen. Nothing about that is a
 * legibility control; it is a magnifying glass held over a fixed picture, and it is why
 * "Fit screen" had to exist as one of the four labels.
 *
 * This one moves TWO CUSTOM PROPERTIES on the document root and nothing else:
 *
 *   --ui-density-base   the BASE the height band multiplies (Part 2 §5 rule 2)
 *   --ui-type-scale     the multiplier on the ten UI type steps
 *
 * The layout re-flows at the new rhythm instead of being photographed and stretched, so
 * nothing overflows the viewport that did not overflow it before, and the leaf measure —
 * `84ch`, in `ch` — follows the type it is a measure OF rather than narrowing in
 * characters as the type grows.
 *
 * ===========================================================================
 * THE COMPOSITION, AND WHERE EACH HALF LIVES  (Part 2 §5 rule 2)
 * ===========================================================================
 *
 * --ui-density has three writers and one composition. AFTER THIS ROW:
 *
 *   styles/tokens.css   --ui-density-base: 1            <- this module writes it
 *                       --ui-density-band: 1            <- the height band writes it
 *                       --ui-density: calc(base * band) <- the composition, ONCE
 *                       @media (height < 700px) { --ui-density-band: 0.875 }
 *
 * BEFORE, the band OVERWROTE --ui-density, which is the defect `tokens.css` recorded
 * against itself: "SCOPE Part 2 §5 rule 2 says the height band MULTIPLIES the C6 'Display
 * Size' base rather than overwriting it, 'so a user choice survives a short window'. This
 * block overwrites … when C6 lands, split into a base token and a band factor whose
 * product is --ui-density." That split is this row's, and it is made in the sheet, not
 * here: CONVENTIONS §11 keeps density arithmetic out of every file but that one.
 *
 * THE WRITE HAS TO LAND ON THE DOCUMENT ROOT, and that is mechanical rather than
 * stylistic. `tokens.css` states it: "var() substitutes at computed-value time on the
 * element that DECLARES the custom property, so --ui-band-h is already resolved on :root
 * and a descendant's --ui-density does not re-derive it." A base written on a subtree
 * would change nothing at all — silently. So this module takes a ROOT ELEMENT by
 * injection, exactly as `theme.js` does for the `data-theme` stamp, and `settings-screen`
 * hands it `document.documentElement`.
 *
 * NO DOM REACHED FOR HERE. No `document`, no `window`. The root is an argument, which is
 * what lets this file run under `node:test` against a two-line fake.
 */

/** The LOGICAL storage key. The router owns the layer and the prefix (B7). */
export const DENSITY_KEY = 'density';

/** The two custom properties C6 writes. Declared in `styles/tokens.css`. */
export const DENSITY_BASE_PROPERTY = '--ui-density-base';
export const TYPE_SCALE_PROPERTY = '--ui-type-scale';

/**
 * THE FOUR STEPS, AND THE LABELS ARE SLATE'S OWN.
 *
 *   CITE settings-display-display-size [1310,286,130,62] text = "Small"
 *        [1440,286,130,62] "Fit screen"  [1569,286,130,62] "Larger"
 *        [1699,286,130,62] "Largest"
 *
 * The labels are carried verbatim because C6 says so ("the same four labels") and because
 * the people who turned it up will look for the word they turned up to. The FACTORS are
 * new and could not be carried: Slate's were canvas transform multipliers, the mechanism
 * C6 retires, and the corpus's geometry for this leaf is on §7.5 and disqualified anyway.
 *
 * ONE FACTOR PER STEP, DRIVING BOTH TOKENS. Density and type move together because the
 * complaint they answer is one complaint ("the text is too small") and because two
 * ladders would let a row's height and its text drift apart — the rhythm bug this wave
 * kills everywhere else. `fit-screen` is 1: the ladder's identity element is the default,
 * so a first run and a deliberate "Fit screen" render identically and only `source` can
 * tell them apart.
 *
 * NEITHER FACTOR TOUCHES --ui-control-h OR --ui-hit-min, and that is the rule the token
 * sheet states rather than one this module could break: "density multiplies band heights
 * and row gaps ONLY; never --ui-control-h and never --ui-hit-min, because ergonomics is
 * physical". A step therefore changes rhythm and type, never the size of a target.
 */
export const DENSITY_STEPS = Object.freeze([
    Object.freeze({ value: 'small', label: 'Small', factor: 0.9 }),
    Object.freeze({ value: 'fit-screen', label: 'Fit screen', factor: 1 }),
    Object.freeze({ value: 'larger', label: 'Larger', factor: 1.1 }),
    Object.freeze({ value: 'largest', label: 'Largest', factor: 1.2 }),
]);

/** The step a machine with no stored choice renders at. The ladder's identity element. */
export const DEFAULT_DENSITY_STEP = 'fit-screen';

/** Every step value, for a bank's items and for the totality test. */
export const DENSITY_VALUES = Object.freeze(DENSITY_STEPS.map((step) => step.value));

/**
 * A stored value -> a step, or null. ABSENT AND UNREADABLE ARE THE SAME ANSWER HERE and
 * that is deliberate: the four steps are the whole domain, so a value outside it is not
 * a preference this control ever set, and treating it as one would paint a rhythm nobody
 * chose. `null` means "no choice", which the caller renders as the default.
 */
export function normaliseDensity(value) {
    if (typeof value !== 'string') return null;
    return DENSITY_STEPS.find((step) => step.value === value) ?? null;
}

/** The factor for a step value; the default step's factor for anything else. */
export function densityFactor(value) {
    const step = normaliseDensity(value) ?? normaliseDensity(DEFAULT_DENSITY_STEP);
    return step.factor;
}

/**
 * Write the base onto a root element. Returns the factor applied.
 *
 * TWO PROPERTIES, ONE NUMBER, NO ARITHMETIC. The multiplication by the height band is the
 * sheet's (`--ui-density: calc(var(--ui-density-base) * var(--ui-density-band))`), and
 * this function never reads a computed style — so it cannot accidentally persist a
 * composed value, which is the defect `storage-routes.js` names on the `density` row:
 * "Persisting the composed number would make a choice made on a short window permanent."
 *
 * @param {{style: {setProperty: Function}}} root  `document.documentElement` in the app
 * @param {string|null} value  a step value, or null for "no choice"
 */
export function applyDensity(root, value) {
    const factor = densityFactor(value);
    if (root && root.style && typeof root.style.setProperty === 'function') {
        root.style.setProperty(DENSITY_BASE_PROPERTY, String(factor));
        root.style.setProperty(TYPE_SCALE_PROPERTY, String(factor));
    }
    return factor;
}

/**
 * Undo `applyDensity` — the sheet's own declarations take over again.
 *
 * NOT CALLED ON DISCONNECT, and that is the decision rather than an omission. A display
 * preference is device-scoped and applies to the whole app, so leaving Settings must not
 * take it away: the write stays on the root exactly as `data-theme` does. What this
 * exists for is the other direction — a test that has to put the root back, and whichever
 * row eventually applies the stored choice AT BOOT (the theme stamp's neighbour, and
 * `app-root`'s to own; recorded as a deferred question by this wave, since a preference
 * that only applies while its own screen is open is a preference nobody keeps).
 */
export function clearDensity(root) {
    if (root && root.style && typeof root.style.removeProperty === 'function') {
        root.style.removeProperty(DENSITY_BASE_PROPERTY);
        root.style.removeProperty(TYPE_SCALE_PROPERTY);
    }
}
