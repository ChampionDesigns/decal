/**
 * An allowlist sanitizer for rendered Markdown. A tag named in ALLOWED_ATTRIBUTES keeps
 * only the attributes named for it; one in DROPPED_SUBTREES or another namespace goes
 * WITH its subtree; anything else is unwrapped. Widen it by adding a row, never by
 * relaxing a rule below.
 */

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';

/** A base for resolving relative references. Never fetched — only its protocol is read. */
const RELATIVE_BASE = 'https://notes.invalid/';

const ALLOWED_PROTOCOLS = Object.freeze(['http:', 'https:', 'mailto:']);

const URL_ATTRIBUTES = Object.freeze({ a: 'href', img: 'src' });

/** Removed WITH their subtrees: unwrapping one hands its payload to the next parser. */
const DROPPED_SUBTREES = Object.freeze([
    'script', 'style', 'iframe', 'object', 'embed', 'form', 'link', 'meta', 'base',
    'svg', 'math', 'template', 'noscript', 'noembed', 'noframes', 'xmp', 'plaintext',
    'title', 'textarea', 'select', 'option', 'optgroup', 'button', 'applet',
    'frame', 'frameset', 'audio', 'video', 'source', 'track', 'param', 'canvas',
]);

/** No `style`, and no `id` — the preview renders in the editor's own shadow root. */
const ALLOWED_ATTRIBUTES = Object.freeze({
    a: Object.freeze(['href', 'title', 'target', 'rel']),
    abbr: Object.freeze(['title']),
    b: Object.freeze([]),
    blockquote: Object.freeze([]),
    br: Object.freeze([]),
    caption: Object.freeze([]),
    cite: Object.freeze([]),
    code: Object.freeze(['class']),
    dd: Object.freeze([]),
    del: Object.freeze([]),
    div: Object.freeze([]),
    dl: Object.freeze([]),
    dt: Object.freeze([]),
    em: Object.freeze([]),
    figcaption: Object.freeze([]),
    figure: Object.freeze([]),
    h1: Object.freeze([]),
    h2: Object.freeze([]),
    h3: Object.freeze([]),
    h4: Object.freeze([]),
    h5: Object.freeze([]),
    h6: Object.freeze([]),
    hr: Object.freeze([]),
    i: Object.freeze([]),
    img: Object.freeze(['src', 'alt', 'title', 'width', 'height']),
    input: Object.freeze(['type', 'checked', 'disabled']),
    ins: Object.freeze([]),
    kbd: Object.freeze([]),
    li: Object.freeze([]),
    mark: Object.freeze([]),
    ol: Object.freeze(['start', 'reversed']),
    p: Object.freeze([]),
    pre: Object.freeze(['class']),
    q: Object.freeze([]),
    s: Object.freeze([]),
    samp: Object.freeze([]),
    small: Object.freeze([]),
    span: Object.freeze([]),
    strong: Object.freeze([]),
    sub: Object.freeze([]),
    sup: Object.freeze([]),
    table: Object.freeze([]),
    tbody: Object.freeze([]),
    td: Object.freeze(['colspan', 'rowspan', 'align']),
    tfoot: Object.freeze([]),
    th: Object.freeze(['colspan', 'rowspan', 'align', 'scope']),
    thead: Object.freeze([]),
    tr: Object.freeze([]),
    u: Object.freeze([]),
    ul: Object.freeze([]),
    var: Object.freeze([]),
    wbr: Object.freeze([]),
});

/** True when `value` resolves to an allowed protocol. The URL parser does the work: it
 *  strips what a scheme can be written around and reads it as the browser would. */
function hasAllowedProtocol(value) {
    try {
        return ALLOWED_PROTOCOLS.includes(new URL(String(value), RELATIVE_BASE).protocol);
    } catch {
        /* Not a URL at all — an attribute the browser could still interpret. Refuse. */
        return false;
    }
}

function unwrap(el) {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
}

/** The one `input` that survives: a task list's checkbox, with `disabled` asserted. */
function keepAsTaskCheckbox(el) {
    if ((el.getAttribute('type') || '').trim().toLowerCase() !== 'checkbox') return false;
    el.setAttribute('disabled', '');
    return true;
}

function sanitizeChildren(node) {
    /* A snapshot: the walk removes as it goes, so the live list moves underneath it. */
    for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) sanitizeElement(child);
        else if (child.nodeType !== Node.TEXT_NODE) child.remove();
    }
}

function sanitizeElement(el) {
    const tag = el.localName;

    if (el.namespaceURI !== HTML_NAMESPACE || DROPPED_SUBTREES.includes(tag)) {
        el.remove();
        return;
    }

    const allowed = ALLOWED_ATTRIBUTES[tag];
    if (!allowed) {
        sanitizeChildren(el);
        unwrap(el);
        return;
    }

    if (tag === 'input' && !keepAsTaskCheckbox(el)) {
        el.remove();
        return;
    }

    /* Attributes first, so an element about to be walked into cannot act on its own. */
    const urlAttribute = URL_ATTRIBUTES[tag];
    for (const name of el.getAttributeNames()) {
        const lower = name.toLowerCase();
        if (lower.startsWith('on') || !allowed.includes(lower)) {
            el.removeAttribute(name);
            continue;
        }
        if (lower === urlAttribute && !hasAllowedProtocol(el.getAttribute(name))) {
            el.removeAttribute(name);
        }
    }

    if (tag === 'a' && el.hasAttribute('href')) el.setAttribute('rel', 'noopener noreferrer');

    sanitizeChildren(el);
}

/** The safe subset of `html`, shaped for EasyMDE's `renderingConfig.sanitizerFunction`. */
export function sanitizeHtml(html) {
    if (typeof html !== 'string' || html === '') return '';
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    sanitizeChildren(parsed.body);
    return parsed.body.innerHTML;
}
