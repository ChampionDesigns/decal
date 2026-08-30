/**
 * The flat-tree focus walk that makes #18's modality real.
 */

/** Element tags whose subtree never renders, so a walk that entered them would only
 *  ever return elements that are not on screen. Also the list `#applyInert` skips. */
export const NON_RENDERED_TAGS = Object.freeze([
    'SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'HEAD', 'TEMPLATE', 'NOSCRIPT',
]);

export function deepActiveElement(root = globalThis.document) {
    let el = root?.activeElement ?? null;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    return el;
}

export function flatChildren(node) {
    if (!node) return [];
    if (typeof node.assignedElements === 'function') {
        return Array.from(node.assignedElements({ flatten: true }) ?? []);
    }
    if (node.shadowRoot) return Array.from(node.shadowRoot.children ?? []);
    return Array.from(node.children ?? []);
}

/** Is this element rendered? `display`/`visibility` only — see "NOT HERE" above. */
export function isRendered(el) {
    if (!el) return false;
    if (typeof el.checkVisibility === 'function') {
        return el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true }) === true;
    }
    if (typeof el.getClientRects === 'function') return el.getClientRects().length > 0;
    return true;
}

export function isTabbable(el) {
    if (!el || typeof el !== 'object') return false;
    if (el.disabled === true) return false;
    if (el.inert === true) return false;
    if (el.hidden === true) return false;
    if (typeof el.getAttribute === 'function' && el.getAttribute('aria-hidden') === 'true') return false;
    const index = typeof el.tabIndex === 'number' ? el.tabIndex : -1;
    if (index < 0) return false;
    return isRendered(el);
}

export function flatTabbables(root) {
    const found = [];
    const seen = new Set();
    const visit = (node) => {
        for (const child of flatChildren(node)) {
            if (!child || seen.has(child)) continue;
            seen.add(child);
            if (child.inert === true) continue;
            if (NON_RENDERED_TAGS.includes(child.tagName)) continue;
            if (isTabbable(child)) found.push(child);
            visit(child);
        }
    };
    visit(root);
    return found;
}

export function firstAutofocus(root) {
    const found = [];
    const visit = (node) => {
        for (const child of flatChildren(node)) {
            if (child.inert === true) continue;
            if (found.length) return;
            const wants = child.autofocus === true
                || (typeof child.hasAttribute === 'function' && child.hasAttribute('autofocus'));
            if (wants && isTabbable(child)) { found.push(child); return; }
            visit(child);
        }
    };
    visit(root);
    return found[0] ?? null;
}

export function trapTarget(items, active, { backwards = false } = {}) {
    if (!Array.isArray(items) || items.length === 0) return null;
    const at = items.indexOf(active);
    if (at === -1) return backwards ? items[items.length - 1] : items[0];
    if (backwards && at === 0) return items[items.length - 1];
    if (!backwards && at === items.length - 1) return items[0];
    return null;
}
