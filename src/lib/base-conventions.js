/**
 * The DOM-free half of the base-element conventions: the token names a component may reach for, and the dials it may not redeclare.
 */

export const FOCUS_TOKENS = Object.freeze([
    '--ui-focus-w',
    '--ui-focus-offset',
    '--ui-focus-offset-inset',
]);

export const SELECTION_DIALS = Object.freeze([
    '--ui-selected-face',
    '--ui-selected-ink',
    '--ui-selected-led',
    '--ui-selected-glow',
    '--ui-selected-weight',
]);

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
