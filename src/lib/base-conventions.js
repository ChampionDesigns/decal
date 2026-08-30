/**
 * base-conventions - the DOM-free half of the base-element conventions
 * (.
 *
 * WHY A SECOND FILE. `src/components/base.js` is the readable half: the Lit base
 * class and the shared `css` fragments, where a contributor can SEE the focus ring
 * and the hit-area utility. It imports `lit`, and the vendored Lit bundle throws
 * `HTMLElement is not defined` the moment it is imported under node - measured, not
 * assumed - so nothing in that file is reachable from `node:test`. Everything in
 *... plain ES modules with no DOM access").
 *
 * NO DOM, NO LIT, NO COLOUR. This module names tokens; it never carries a value for
 * one. That is deliberate: a colour literal in here would be invisible to Gate C's
 * guard, which parses `css` tagged templates inside COMPONENT files (Part 8 §2
 * Gate C). The registries below are names only, and the test asserts it.
 */

/** Focus geometry. ONE treatment, three tokens (LAYOUT_SPEC_DRAFT.md §3.6). */
export const FOCUS_TOKENS = Object.freeze([
    '--ui-focus-w',
    '--ui-focus-offset',
    '--ui-focus-offset-inset',
]);

/**
 * The selection dials. FOUR are carried unchanged from `slate-tokens.css:188-191`
 * (LAYOUT_SPEC_DRAFT.md §3.9; DECISIONS.md:239 - "the one genuinely re-themable
 * idea in the codebase"). The FIFTH is parity surface 2's, and it is added for the
 * reason the other four exist rather than against it.
 *
 * WHY A FIFTH, when this list said for two waves that a fifth was "a rule change in
 * disguise". Slate's selected treatment is not four values: it is four values PLUS a
 * weight, and the weight is written in the RULES, three times -
 *     slate-components.css:392  `.slate-bank-item[aria-pressed="true"], [aria-selected
 *                                ="true"], [aria-checked="true"], .is-selected`
 *                               `font-weight: var(--slate-weight-medium)`
 *     slate-components.css:265  `.slate-nav-selected`
 *                               `font-weight: var(--slate-weight-medium) !important`
 *     slate-shell.css:310       the selected profile-list row, `font-weight: 500`
 * so a Radian fork that retargets all four dials still gets Slate's bolder selected
 * label. THAT is the rule change in disguise, and it was in the corpus the whole time.
 * Making the weight the fifth VALUE is what finally makes the claim true: turn five
 * dials off and a selected element is indistinguishable from a resting one.
 *
 * ORACLE, corpus-wide over the 49 baseline states (parity surface 2 census): Slate
 * paints 100 elements with --slate-selected-face and 95 of them render font-weight
 * 500 - the two settings nav columns 38 + 38, `.slate-bank-item` 11, and one each of
 * the language tile, the skin card, the picked button, the primary button, the numpad
 * confirm and the day toggle. The other 5 are `.hv-pick-btn` / `.slate-hv-pick-tag` at
 * 600, which are 600 in their RESTING state too - a component's own resting weight,
 * not a selected treatment, and `--_ui-rest-weight` in src/components/base.js is the
 * slot that keeps it (the same composition idiom `--_ui-rest-shadow` already uses).
 * Decal rendered 400 on all 153 of its selected elements before this landed.
 */
export const SELECTION_DIALS = Object.freeze([
    '--ui-selected-face',
    '--ui-selected-ink',
    '--ui-selected-led',
    '--ui-selected-glow',
    '--ui-selected-weight',
]);

/**
 * The hit floor. Physically justified, not a taste call: "a wet fingertip is about
 * 9mm; at this panel's density that is ~48px" (`slate-tokens.css:99-102`), and it
 * is one of the four cases where a fixed px is permitted at all
 * (LAYOUT_SPEC_DRAFT.md §2.3 case 2).
 */
export const HIT_TOKENS = Object.freeze(['--ui-hit-min']);

/** Everything else the base rules read: the ring's ink, and the disabled dial. */
export const STATE_TOKENS = Object.freeze(['--ui-steel', '--ui-opacity-disabled']);

/** Every `--ui-*` token `src/components/base.js` is allowed to name. */
export const BASE_TOKENS = Object.freeze([
    ...FOCUS_TOKENS,
    ...SELECTION_DIALS,
    ...HIT_TOKENS,
    ...STATE_TOKENS,
]);

export const PUBLIC_TOKEN_PREFIX = '--ui-';
export const PRIVATE_PROPERTY_PREFIX = '--_ui-';

/** True for `--ui-foo`. False for `--_ui-foo`, `--slate-foo`, `foo`. */
export function isPublicToken(name) {
    return typeof name === 'string' && name.startsWith(PUBLIC_TOKEN_PREFIX);
}

/** True for `--_ui-foo`: a component-private property, exempt from the token check. */
export function isPrivateProperty(name) {
    return typeof name === 'string' && name.startsWith(PRIVATE_PROPERTY_PREFIX);
}

export const FOCUS_VARIANTS = Object.freeze(['outset', 'inset']);
export const DEFAULT_FOCUS_VARIANT = 'outset';

export function resolveFocusVariant(value) {
    if (value === null || value === undefined) return DEFAULT_FOCUS_VARIANT;
    const normalised = String(value).trim().toLowerCase();
    return FOCUS_VARIANTS.includes(normalised) ? normalised : DEFAULT_FOCUS_VARIANT;
}

export function mergeAdoptedSheets(existing, incoming, { position = 'before' } = {}) {
    if (position !== 'before' && position !== 'after') {
        throw new RangeError(`mergeAdoptedSheets: position must be 'before' or 'after', got ${position}`);
    }
    const current = existing ? Array.from(existing) : [];
    const additions = (incoming ? Array.from(incoming) : []).filter(
        (sheet, index, all) => sheet != null && !current.includes(sheet) && all.indexOf(sheet) === index,
    );
    if (additions.length === 0) return current;
    return position === 'before' ? [...additions, ...current] : [...current, ...additions];
}

/**
 * `[base, ...own]` with every copy of `base` stripped out of `own` first.
 *
 * Flattens nested arrays the way Lit does, so `[frag, [a, b]]` and `[frag, a, b]`
 * behave identically. Anything nullish in `own` is dropped: Lit tolerates a sparse
 * list and so does this, rather than turning a missing fragment into a throw at
 * class-definition time.
 *
 * @param {*} base    the base styles - one `CSSResult`, or an array of them
 * @param {*} own     whatever the subclass declared in `static styles`
 * @returns {Array}   flat, base-first, no duplicate of base
 */
export function composeStyles(base, own) {
    const flatten = (value) => (
        value === undefined || value === null
            ? []
            : (Array.isArray(value) ? value.flat(Infinity) : [value])
    ).filter((entry) => entry !== undefined && entry !== null);

    const baseList = flatten(base);
    const ownList = flatten(own).filter((entry) => !baseList.includes(entry));
    return [...baseList, ...ownList];
}
