/**
 * focus-trap.js — the flat-tree focus walk that makes #18's modality real.
 *
 * Wave 3, item #18 (dialog / modal shell). Extracted from the component for two
 * reasons, both of them stated by the run's own rules rather than by taste:
 *
 *   1. `src/components/*.js` cannot be imported under node at all — they import
 *      `lit`, which is resolved by the served document's importmap, not by node
 *      (CONVENTIONS §10). Anything in there is testable only through the browser
 *      rig. The ORDER a Tab walk visits controls in is pure logic over a tree, and
 *      pure logic belongs where `node --test` can reach it: this file duck-types
 *      every node it touches (`assignedElements`, `shadowRoot`, `children`,
 *      `tabIndex`), so `test/focus-trap.test.mjs` drives it over plain objects with
 *      no DOM at all, and `test/render/ui-dialog.render.test.mjs` drives the same
 *      code over a real one.
 *   2. `cross-11` (wave 3's review) parks the question of whether `ui-menu` adopts
 *      the dialog's top-layer/`inert` path or stays a second overlay implementation.
 *      Whichever way that lands, the WALK is the part both would share, and two
 *      copies of a focus walk is the O6 shape one layer down.
 *
 * ---------------------------------------------------------------------------
 * WHY A HAND-WRITTEN WALK AT ALL, WHEN `<dialog>.showModal()` ALREADY TRAPS
 *
 * It very nearly does, and the gap is measured. Driving real CDP Tab presses around
 * a modal `<dialog>` living in a shadow root, with three controls in the shadow tree
 * and two slotted from the light DOM (probe, both Gate A geometries, this run):
 *
 *     inner-first -> slotted-a -> slotted-b -> inner-last -> BODY -> inner-first
 *
 * Five controls, six steps. The wrap goes THROUGH `document.body`: for one press the
 * caret is on an element that is not in the dialog, paints no ring, and answers no
 * key. That is a dead step in the cycle of every keyboard user, and it is exactly the
 * shape of the defect §4.6 names from the other side ("no focus trap, no focus
 * restore ... Escape is not the gap; isolation and focus are"). Shift+Tab, measured
 * in the same run, wraps first -> last with NO body step, so the browser's own cycle
 * is not even symmetric.
 *
 * So the trap here does one thing: it takes the two WRAP steps (last -> first,
 * first -> last) and nothing else. Every interior step is still the browser's own
 * sequential navigation, which is the only thing that knows about writing modes,
 * `tabindex` order and controls this walk has never heard of. `trapTarget()` returns
 * `null` for every step that is not a wrap, and `null` means "do not preventDefault".
 *
 * ---------------------------------------------------------------------------
 * THE FLAT TREE, NOT THE DOM TREE
 *
 * A dialog with `header`/`body`/`actions` slots holds almost none of its own content:
 * the body of every one of the seven dialogs §4.6 replaces arrives as slotted light
 * DOM, which is a child of the HOST and not a descendant of the `<dialog>` element.
 * A `querySelectorAll` on the dialog would find the header and the footer and miss
 * the entire body — a trap that traps everything except the thing the user came for.
 *
 * MEASURED, and worth writing down because it decided the whole architecture: Chrome
 * blocks input on the flat tree, not the DOM tree. With the dialog in a shadow root
 * and the body slotted from the light DOM, under `showModal()`:
 *
 *     focus(slotted button)  -> lands                 (both geometries)
 *     click(slotted button)  -> handler runs          (both geometries)
 *     focus(outside button)  -> refused, caret unmoved
 *     click(outside button)  -> no handler runs
 *
 * So `flatChildren()` descends: a slot yields its assigned elements, a shadow host
 * yields its shadow root's children (its light children are reached through the slots
 * that assign them, never twice), and anything else yields its element children.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY NOT HERE
 *
 *   - NO positive-tabindex support. `flatTabbables()` returns flat-tree order, which
 *     is the browser's order only while every tabbable is at `tabindex` 0 or its
 *     native default. Nothing in the inventory uses a positive tabindex and the one
 *     roving-tabindex pattern in the spec (Appendix 13 item 10) puts exactly one
 *     control of a group at 0 — which this walk handles correctly, because it reads
 *     `tabIndex` per element. A positive tabindex would reorder the WRAP only, which
 *     is a bug worth having loudly rather than a reimplementation of the UA's order.
 *   - NO opacity check. `checkVisibility()` is asked about `display` and `visibility`
 *     and NOT about opacity, deliberately: #18 fades its dialog in over `--ui-dur`,
 *     and a trap that went blind for 120ms would be a trap with a door in it.
 *   - NO `document` reference at module scope. This file must import cleanly under
 *     node; every DOM touch is inside a function and duck-typed.
 */

/** Element tags whose subtree never renders, so a walk that entered them would only
 *  ever return elements that are not on screen. Also the list `#applyInert` skips. */
export const NON_RENDERED_TAGS = Object.freeze([
    'SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'HEAD', 'TEMPLATE', 'NOSCRIPT',
]);

/**
 * The active element, through every shadow boundary.
 *
 * `document.activeElement` stops at the outermost host: with the caret on a button
 * inside `ui-button` inside a dialog, it answers `ui-dialog`. Every focus assertion
 * in this run wants the leaf. Same five lines as `ui-menu.js:1070`, which is the
 * other component that has to answer this question; when `cross-11` decides whether
 * the menu adopts this path, that copy goes and this one stays.
 */
export function deepActiveElement(root = globalThis.document) {
    let el = root?.activeElement ?? null;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    return el;
}

/**
 * The children of `node` in the FLAT tree — what is actually rendered under it.
 *
 * Three cases, in the order they must be tested:
 *   a slot   -> its assigned elements, `flatten: true` so an empty slot yields its
 *               own fallback content (which is where #18 keeps its default header)
 *               and a slot assigned to another slot resolves through;
 *   a host   -> its shadow root's children. NOT its light children: those are
 *               rendered wherever a slot assigns them, and yielding both would visit
 *               every slotted control twice and put the duplicate at the wrong place
 *               in the order;
 *   anything -> its element children.
 */
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

/**
 * Can the sequential walk land on this element?
 *
 * `tabIndex` is the whole discriminator and it is the browser's own answer: a
 * `<div>` with no attribute reports -1, a `<button>` reports 0, a disabled button
 * still reports 0 (hence the explicit `disabled` test), and a custom element host
 * without `delegatesFocus` reports -1 — which is why `ui-button`'s host is skipped
 * and the real `<button>` inside its shadow root is found by descending.
 */
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

/**
 * Every tabbable element under `root`, in flat-tree order.
 *
 * An `inert` subtree is not entered at all — that is what makes a background pane
 * `#applyInert` marked disappear from the walk rather than merely fail to focus.
 */
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

/**
 * The first element asking for focus on open, in flat-tree order — `autofocus`, as
 * the platform spells it. `showModal()` honours `autofocus` only on its own
 * descendants, so a slotted body's autofocus is invisible to it; this finds both.
 */
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

/**
 * Where a Tab press must be redirected to, or `null` to leave it to the browser.
 *
 * PURE, and the reason this file exists as a module: the cycle is four cases and
 * `test/focus-trap.test.mjs` states all four over plain arrays.
 *
 *   forward from the last  -> the first     (the step that would otherwise hit body)
 *   backward from the first-> the last
 *   from outside the list  -> the first, or the last going backwards
 *   anything else          -> null: the browser's own step is the right one
 */
export function trapTarget(items, active, { backwards = false } = {}) {
    if (!Array.isArray(items) || items.length === 0) return null;
    const at = items.indexOf(active);
    if (at === -1) return backwards ? items[items.length - 1] : items[0];
    if (backwards && at === 0) return items[items.length - 1];
    if (!backwards && at === items.length - 1) return items[0];
    return null;
}
