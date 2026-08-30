/**
 * The base element every ui-* component extends, with the shared style fragments: the focus ring, the visually-hidden treatment and the selection surface.
 */

import { LitElement, css } from 'lit';

import {
    DEFAULT_FOCUS_VARIANT,
    composeStyles,
    mergeAdoptedSheets,
    resolveFocusVariant,
} from '../lib/base-conventions.js';

export const focusRing = css`
    outline: var(--ui-focus-w) solid var(--ui-steel);
    outline-offset: var(--_ui-focus-offset, var(--ui-focus-offset));
`;

export const hitArea = css`
    :where(.hit-overlay) {
        position: relative;
    }

    /* Transparent by construction: no colour, no paint, nothing to theme. */
    :where(.hit-overlay)::before {
        content: "";
        position: absolute;
        inset-block-start: 50%;
        inset-inline-start: 50%;
        inline-size: var(--_ui-hit-inline, max(100%, var(--ui-hit-min)));
        block-size: var(--_ui-hit-block, max(100%, var(--ui-hit-min)));
        transform: translate(-50%, -50%);
    }

    :where(.hit-pad) {
        --_ui-hit-box-resolved: var(--_ui-hit-box, var(--ui-hit-min));
        box-sizing: border-box;
        block-size: var(--_ui-hit-box-resolved);
        padding-block: max(0px, calc(
            (var(--_ui-hit-box-resolved) - var(--_ui-hit-ink, var(--_ui-hit-box-resolved))) / 2));
        background-clip: content-box;
    }
`;

export const visuallyHidden = css`
    /* Visually hidden, still in the accessibility tree. No colour, no theme surface,
     * nothing to drift. */
    .a11y {
        position: absolute;

        inset-block-start: 0;
        inset-inline-start: 0;

        inline-size: 1px;
        block-size: 1px;
        padding: 0;
        border: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
    }
`;

export const selectionSurface = css`
    [aria-pressed="true"],
    [aria-selected="true"],
    [aria-checked="true"],
    [aria-current="true"],
    .is-selected {
        background-color: var(--ui-selected-face);
        color: var(--ui-selected-ink);
        font-weight: var(--_ui-rest-weight, var(--ui-selected-weight));
        box-shadow:
            var(--_ui-rest-shadow, 0 0 transparent),
            inset 0 calc(-1 * var(--ui-selected-led)) 0 0 currentColor;
        text-shadow:
            var(--_ui-rest-text-shadow, 0 0 transparent),
            0 0 6px color-mix(in srgb, currentColor var(--ui-selected-glow), transparent);
    }

    :host(:is(
        [aria-pressed="true"],
        [aria-selected="true"],
        [aria-checked="true"],
        [aria-current="true"],
        [selected]
    )) {
        background-color: var(--ui-selected-face);
        color: var(--ui-selected-ink);
        font-weight: var(--_ui-rest-weight, var(--ui-selected-weight));
        box-shadow:
            var(--_ui-rest-shadow, 0 0 transparent),
            inset 0 calc(-1 * var(--ui-selected-led)) 0 0 currentColor;
        text-shadow:
            var(--_ui-rest-text-shadow, 0 0 transparent),
            0 0 6px color-mix(in srgb, currentColor var(--ui-selected-glow), transparent);
    }
`;

const baseStyles = css`
    :host {
        display: block;
        box-sizing: border-box;
        container-type: inline-size;

        -webkit-tap-highlight-color: transparent;

        --_ui-focus-offset: var(--ui-focus-offset);
    }

    :host([focus-ring="inset"]) {
        --_ui-focus-offset: var(--ui-focus-offset-inset);
    }

    :host([hidden]) {
        display: none;
    }

    :where(*),
    :where(*)::before,
    :where(*)::after {
        box-sizing: inherit;
    }

    /* THE ring, on the host when the host is the focusable thing. */
    :host(:focus-visible) {
        ${focusRing}
    }

    :where(:any-link, button, input, select, textarea, summary, [tabindex]):focus-visible {
        ${focusRing}
    }

    ::slotted(:focus-visible) {
        ${focusRing}
    }

    :where([disabled], [aria-disabled="true"]) {
        opacity: var(--ui-opacity-disabled);
    }

    :host(:is([disabled], [aria-disabled="true"])) {
        opacity: var(--ui-opacity-disabled);
    }
`;

export class UiElement extends LitElement {
    static finalizeStyles(styles) {
        return super.finalizeStyles(composeStyles(baseStyles, styles));
    }

    /** The base rules, exported for a component that cannot extend this class. */
    static get baseStyles() {
        return baseStyles;
    }

    get focusVariant() {
        return this.hasAttribute?.('focus-ring')
            ? resolveFocusVariant(this.getAttribute('focus-ring'))
            : DEFAULT_FOCUS_VARIANT;
    }
}

/** Resolved against this module, so it does not care what the served root is. */
export const UPLOT_STYLESHEET_URL = new URL('../../vendor/uPlot.min.css', import.meta.url).href;

const sheetCache = new Map();

/**
 * Fetch a stylesheet once per URL and hand back a constructed `CSSStyleSheet`.
 * Cached by URL: N chart cards share one sheet object, which is also what makes
 * `adoptStyleSheet` idempotent across components.
 */
export function loadStyleSheet(url, { fetch: fetchImpl = globalThis.fetch } = {}) {
    const href = String(url);
    let pending = sheetCache.get(href);
    if (pending === undefined) {
        pending = Promise.resolve(fetchImpl(href))
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`loadStyleSheet: ${response.status} for ${href}`);
                }
                return response.text();
            })
            .then((cssText) => {
                const sheet = new CSSStyleSheet();
                sheet.replaceSync(cssText);
                return sheet;
            })
            .catch((error) => {
                sheetCache.delete(href);
                throw error;
            });
        sheetCache.set(href, pending);
    }
    return pending;
}

/**
 * Merge a constructed sheet into a shadow root's `adoptedStyleSheets` without
 * disturbing the ones Lit put there. Idempotent - safe to call on every update.
 */
export function adoptStyleSheet(root, sheet, { position = 'before' } = {}) {
    if (!root) throw new TypeError('adoptStyleSheet: no render root');
    if (!sheet) throw new TypeError('adoptStyleSheet: no stylesheet');
    root.adoptedStyleSheets = mergeAdoptedSheets(root.adoptedStyleSheets, [sheet], { position });
    return root.adoptedStyleSheets;
}

/** Is this sheet actually in that root? The assertion a chart test should make. */
export function hasAdoptedSheet(root, sheet) {
    const sheets = root?.adoptedStyleSheets;
    return Array.isArray(sheets) ? sheets.includes(sheet) : Array.from(sheets ?? []).includes(sheet);
}
