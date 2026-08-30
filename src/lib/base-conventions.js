/**
 * base-conventions - the DOM-free half of the base-element conventions
 * (Wave 0a item #2, SCOPE Part 4 Wave 0 item 2).
 *
 * WHY A SECOND FILE. `src/components/base.js` is the readable half: the Lit base
 * class and the shared `css` fragments, where a contributor can SEE the focus ring
 * and the hit-area utility. It imports `lit`, and the vendored Lit bundle throws
 * `HTMLElement is not defined` the moment it is imported under node - measured, not
 * assumed - so nothing in that file is reachable from `node:test`. Everything in
 * item #2 that is pure logic lives here instead, where it tests without a browser
 * (SCOPE Part 2 §2, "src/lib/ ... plain ES modules with no DOM access").
 *
 * NO DOM, NO LIT, NO COLOUR. This module names tokens; it never carries a value for
 * one. That is deliberate: a colour literal in here would be invisible to Gate C's
 * guard, which parses `css` tagged templates inside COMPONENT files (Part 8 §2
 * Gate C). The registries below are names only, and the test asserts it.
 */

/* ---------------------------------------------------------------------------
 * TOKEN REGISTRIES
 *
 * The base element names exactly these ten tokens and no others. The registry is
 * not documentation: `test/base-conventions.test.mjs` asserts set equality against
 * the `var(--ui-*)` references actually written in `src/components/base.js`, and
 * asserts every one of them is declared in `styles/tokens.css`. A token renamed in
 * item #1's file, or a token quietly added to a base rule, is a red test.
 *
 * (Item #4's guard 4 - the token-integrity check over the whole tree, SCOPE Part 2
 * §7 guard 4 - generalises this. When it lands, this test is subsumed by it and may
 * be retired; until then it is the only thing holding item #1 and item #2 in step.)
 * ------------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------------
 * PRIVATE CUSTOM PROPERTIES
 *
 * A component may define internal custom properties for its own geometry (SCOPE
 * Part 2 §3), but "no private token namespaces shadowing the public ones" - the
 * pattern that produced Live's triple-declared copy of the public palette (bug
 * L12). Those two rules only coexist if the difference is MECHANICAL, so:
 *
 *   --ui-*   public token. Declared in styles/tokens.css. Crosses shadow
 *            boundaries. Theming API.
 *   --_ui-*  private. Declared inside one component (or by these base rules),
 *            read only inside it, never part of any contract, and it may never
 *            carry a colour VALUE - only a reference to a public token.
 *
 * The leading underscore is what keeps the token-integrity check honest: it scans
 * for `var(--ui-`, and `var(--_ui-` does not match, so a private property can never
 * be mistaken for a missing token or vice versa.
 * ------------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------------
 * THE FOCUS-RING VARIANT
 *
 * Two offsets, one treatment (LAYOUT_SPEC_DRAFT.md §3.6):
 *   outset  --ui-focus-offset        (+2px)  the ring sits outside the control
 *   inset   --ui-focus-offset-inset  (-3px)  the ring is drawn INSIDE the control's
 *                                            own box, for a control whose parent
 *                                            clips - which is bug L24's whole class:
 *                                            "focus rings clipped on all four sides
 *                                            by the components they sit inside"
 *                                            (`slate-components.css:549`, `:352`).
 *
 * This is normalisation, not policy: an unrecognised value falls back to `outset`
 * rather than throwing, because a typo in an attribute must not blank a control's
 * focus ring - an invisible ring is an accessibility defect, a wrong offset is a
 * cosmetic one.
 * ------------------------------------------------------------------------- */

export const FOCUS_VARIANTS = Object.freeze(['outset', 'inset']);
export const DEFAULT_FOCUS_VARIANT = 'outset';

export function resolveFocusVariant(value) {
    if (value === null || value === undefined) return DEFAULT_FOCUS_VARIANT;
    const normalised = String(value).trim().toLowerCase();
    return FOCUS_VARIANTS.includes(normalised) ? normalised : DEFAULT_FOCUS_VARIANT;
}

/* ---------------------------------------------------------------------------
 * ADOPTED STYLESHEETS - the merge, without the DOM
 *
 * The chart card must get `vendor/uPlot.min.css` into its shadow root's
 * `adoptedStyleSheets` or the chart renders pixel-perfectly and is COMPLETELY DEAD
 * TO THE TOUCH: `.u-cursor-x` computes `position: static; height: 0`, the legend
 * collapses 900x31 -> 80x106, and real pointer events give `cursor.idx = null`
 * (LAYOUT_SPEC_DRAFT.md §6.3 Rule 1, measured). "A chart that looks right in a
 * screenshot and is dead to the touch is exactly the defect that survives review."
 *
 * Lit owns `renderRoot.adoptedStyleSheets` - it assigns the element's own styles
 * there in `createRenderRoot`. Anything else that wants a sheet in that root must
 * MERGE rather than assign, and must be idempotent: `adoptStyleSheet` may be called
 * on every update, and an array that grows by one sheet per render is a leak the
 * page will not report.
 *
 * `position` decides who wins a specificity tie:
 *   'before'  incoming sheets first  -> the component's own styles win. Default,
 *             because theming the chart means overriding uPlot, never the reverse.
 *   'after'   incoming sheets last   -> only when a vendor sheet must beat the
 *             component's, which so far nothing needs.
 * ------------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------------
 * STYLE ORDER - the second half of the zero-!important mechanism
 *
 * The whole "to override a base rule, just write the rule" argument has two legs:
 * every base rule that reaches INSIDE the shadow tree is wrapped in `:where()` (zero
 * specificity), and the base rules come FIRST so a component's own rule wins every
 * tie on source order. The second leg matters because five base declarations are NOT
 * inside `:where()` and cannot be - they are `:host` rules, and `:host` carries a real
 * (0,1,0): `display`, `box-sizing`, `container-type`, `-webkit-tap-highlight-color`
 * and the private focus-offset. A component's own `:host` rule ties with them, so
 * ORDER is the entire difference between the documented opt-out
 *
 *     static styles = [css`:host { container-type: normal; display: inline-grid; }`];
 *
 * working and silently doing nothing.
 *
 * WHY THIS IS NOT LEFT TO LIT. Lit's `finalizeStyles` dedupes by identity on the
 * REVERSED array, which keeps the LAST occurrence of a repeated sheet:
 *
 *     finalizeStyles([BASE, [ownA, ownB]])         -> [BASE, ownA, ownB]   base first
 *     finalizeStyles([BASE, [ownA, ownB, BASE]])   -> [ownA, ownB, BASE]   base LAST
 *
 * so a subclass that ALSO spreads the base styles - "belt and braces", which the
 * conventions used to describe as harmless - inverts the ordering the argument rests
 * on, and the opt-out above stops working for exactly the author who followed the
 * advice. Measured against the vendored bundle (vendor/lit.js, `finalizeStyles`), not
 * assumed.
 *
 * So the base removes the duplicate BEFORE Lit sees it. The result is
 * position-independent: base first, always, however the subclass spelled its array.
 * ------------------------------------------------------------------------- */

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
