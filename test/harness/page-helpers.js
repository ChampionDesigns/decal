/**
 * page-helpers.js — the code that runs INSIDE the page, as a string.
 *
 * A node module that exports source text rather than a browser module under
 * `test/`, for two reasons. First, `Page.addScriptToEvaluateOnNewDocument` installs
 * it before any of the page's own script runs, so a helper is available even to the
 * first evaluate after a navigation. Second, Node's test runner treats every `.js`
 * file under `test/` as a test file (Node 20 has no `--test-exclude`), so a real
 * browser module here would need the node-safe wrapper the fixtures carry — and a
 * string cannot be run by accident.
 *
 * WRITING RULES for the text below: no backticks and no `${`, because it lives
 * inside a template literal. ES2020 syntax only — it is parsed by Chrome, not by the
 * bundler this tree does not have.
 *
 * THE SELECTOR DIALECT. Shadow DOM means `document.querySelector('#plain')` finds
 * nothing, so every helper takes a piercing path:
 *
 *     'base-fixture >>> #plain'          host, then into its shadow root
 *     'live-screen >>> chart-card >>> canvas'
 *
 * Each `>>>` steps through one shadow boundary. This is the same identity the
 * capture battery's walker records as an anchor path (SCOPE Part 10 §13, adaptation
 * 1) — `anchorPath()` below produces one from an element, which is the inverse.
 */

export const PAGE_HELPERS = String.raw`
(function () {
    'use strict';

    function stepInto(root, part) {
        var el = root.querySelector(part);
        return el;
    }

    function q(sel) {
        var parts = String(sel).split('>>>').map(function (s) { return s.trim(); })
            .filter(function (s) { return s.length; });
        if (!parts.length) throw new Error('empty selector');
        var root = document;
        var el = null;
        for (var i = 0; i < parts.length; i++) {
            el = stepInto(root, parts[i]);
            if (!el) return null;
            root = el.shadowRoot || el;
        }
        return el;
    }

    function need(sel) {
        var el = q(sel);
        if (!el) throw new Error('no element for selector: ' + sel);
        return el;
    }

    function qAll(sel) {
        var parts = String(sel).split('>>>').map(function (s) { return s.trim(); })
            .filter(function (s) { return s.length; });
        var roots = [document];
        var out = [];
        for (var i = 0; i < parts.length; i++) {
            out = [];
            for (var r = 0; r < roots.length; r++) {
                var found = roots[r].querySelectorAll(parts[i]);
                for (var f = 0; f < found.length; f++) out.push(found[f]);
            }
            roots = out.map(function (e) { return e.shadowRoot || e; });
        }
        return out;
    }

    function deepAll(root, acc) {
        root = root || document;
        acc = acc || [];
        var els = root.querySelectorAll('*');
        for (var i = 0; i < els.length; i++) {
            acc.push(els[i]);
            if (els[i].shadowRoot) deepAll(els[i].shadowRoot, acc);
        }
        return acc;
    }

    /* The chain of custom-element hosts down to an element, plus its own tag and a
     * disambiguating index — the capture battery's identity (Part 10 §13). */
    function anchorPath(el) {
        var parts = [];
        var node = el;
        while (node) {
            var label = node.tagName ? node.tagName.toLowerCase() : '?';
            if (node.id) label += '#' + node.id;
            parts.unshift(label);
            var parent = node.parentElement;
            if (!parent) {
                var root = node.getRootNode();
                node = root && root.host ? root.host : null;
            } else {
                node = parent;
            }
        }
        return parts.join(' ▸ ');
    }

    function rect(el) {
        var r = el.getBoundingClientRect();
        return {
            x: r.x, y: r.y, width: r.width, height: r.height,
            top: r.top, right: r.right, bottom: r.bottom, left: r.left
        };
    }

    function computed(sel, props, pseudo) {
        var el = need(sel);
        var cs = getComputedStyle(el, pseudo || null);
        var out = {};
        for (var i = 0; i < props.length; i++) out[props[i]] = cs.getPropertyValue(props[i]);
        return out;
    }

    /* Resolve a raw CSS value (or a var() reference) to the value the engine
     * computes for a given property, so a token can be compared with a rendered
     * colour without reimplementing colour parsing in node. The probe inherits from
     * <html>, so var() chains resolve exactly as they do for real content. */
    /* scope is a SELECTOR the probe is parented to instead of the body, so a token
     * is resolved where the element under test actually reads it. It matters because a
     * dial does not have to be a :root value: styles/tokens.css aims the three
     * selection dials at ui-preset-bank so that one row wears Slate's underlined-
     * number idiom (Ben, 23 Aug 2026). Resolving such a token on a body-parented probe
     * answers the :root value and compares it against an element that never reads it —
     * a mismatch that says "the component paints privately" when the truth is "the
     * theme aimed the dial lower down". Default unchanged: no scope, probe on body. */
    function resolveValue(value, prop, scope) {
        prop = prop || 'color';
        var host = document.body;
        if (scope) {
            var el = need(scope);
            /* INTO THE SHADOW ROOT WHEN THERE IS ONE. A light-DOM child of a shadow
             * host that has no matching slot is never rendered, and an unrendered
             * probe answers initial values rather than inherited ones -- which read
             * back as "the token is empty" when it is not. A child of the shadow root
             * renders and inherits the host's custom properties, which is the scope
             * being asked about. */
            host = el.shadowRoot || el;
        }
        var probe = document.createElement('div');
        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        probe.style.setProperty(prop, value);
        host.appendChild(probe);
        var out = getComputedStyle(probe).getPropertyValue(prop);
        probe.remove();
        return out;
    }

    function resolveToken(name, prop, scope) {
        return resolveValue('var(' + name + ')', prop || 'color', scope);
    }

    function tokenValue(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function setToken(name, value) {
        if (value === null) document.documentElement.style.removeProperty(name);
        else document.documentElement.style.setProperty(name, value);
    }

    function setStyle(sel, props) {
        var el = need(sel);
        for (var k in props) {
            if (props[k] === null) el.style.removeProperty(k);
            else el.style.setProperty(k, props[k]);
        }
        return rect(el);
    }

    function metrics(sel) {
        var el = need(sel);
        var cs = getComputedStyle(el);
        return {
            rect: rect(el),
            clientWidth: el.clientWidth,
            clientHeight: el.clientHeight,
            scrollWidth: el.scrollWidth,
            scrollHeight: el.scrollHeight,
            offsetWidth: el.offsetWidth,
            offsetHeight: el.offsetHeight,
            /* The scrollbar gutter. Classic (non-overlay) scrollbars take layout
             * width, which is how "a visible scrollbar rather than silently
             * clipping" becomes a number. Requires the harness NOT to launch Chrome
             * with --hide-scrollbars; see cdp.js. */
            scrollbarInline: el.offsetWidth - el.clientWidth - parseFloat(cs.borderLeftWidth || '0') - parseFloat(cs.borderRightWidth || '0'),
            scrollbarBlock: el.offsetHeight - el.clientHeight - parseFloat(cs.borderTopWidth || '0') - parseFloat(cs.borderBottomWidth || '0'),
            overflowX: cs.overflowX,
            overflowY: cs.overflowY,
            minHeight: cs.minHeight,
            minWidth: cs.minWidth
        };
    }

    /* Everything the focus-geometry assertion needs, in one round trip: the ring's
     * own numbers, the rectangle it actually occupies, and every ancestor that could
     * clip it — walking THROUGH shadow boundaries, which is where bug L24's class
     * hides. */
    function focusGeometry(sel) {
        var el = need(sel);
        var cs = getComputedStyle(el);
        var width = parseFloat(cs.outlineWidth) || 0;
        var offset = parseFloat(cs.outlineOffset) || 0;
        var r = el.getBoundingClientRect();
        var grow = offset + width;
        var ring = {
            top: r.top - grow, left: r.left - grow,
            bottom: r.bottom + grow, right: r.right + grow
        };

        var clippers = [];
        var node = el.parentElement || hostOf(el);
        while (node) {
            var ncs = getComputedStyle(node);
            var clipped = ncs.overflowX !== 'visible' || ncs.overflowY !== 'visible';
            var contained = (ncs.contain || '').indexOf('paint') !== -1;
            if (clipped || contained) {
                var nr = node.getBoundingClientRect();
                var cb = clipRect(node, ncs, nr);
                clippers.push({
                    anchor: anchorPath(node),
                    overflowX: ncs.overflowX,
                    overflowY: ncs.overflowY,
                    contain: ncs.contain,
                    borderRadius: ncs.borderRadius,
                    /* The border box, kept for a readable failure: "the rect you see in
                     * devtools" versus the rect that actually clips. */
                    borderBox: { top: nr.top, left: nr.left, bottom: nr.bottom, right: nr.right },
                    /* top/left/bottom/right ARE THE CLIP EDGE — what a caller compares a
                     * ring against. See clipRect(). */
                    top: cb.top, left: cb.left, bottom: cb.bottom, right: cb.right
                });
            }
            node = node.parentElement || hostOf(node);
        }

        return {
            anchor: anchorPath(el),
            outlineStyle: cs.outlineStyle,
            outlineWidth: cs.outlineWidth,
            outlineOffset: cs.outlineOffset,
            outlineColor: cs.outlineColor,
            focusVisible: el.matches(':focus-visible'),
            focused: el === deepActiveElement(),
            elementRect: rect(el),
            ringRect: ring,
            clippers: clippers
        };
    }

    /* THE RECTANGLE AN ANCESTOR ACTUALLY CLIPS TO — its scrollport, not its border box.
     * CSS clips overflow at the PADDING edge, so an overflow-hidden ancestor with a 4px
     * border clips 4px inside the rect getBoundingClientRect reports: a 3px ring sitting
     * in that band is entirely invisible on screen, and the old walk (which recorded the
     * border box) reported it unclipped. That is wave 0a review finding rig-4, and it
     * was invisible only because the base fixture's .band has no border.
     *
     * Three corrections, in order:
     *   1. inset by the border widths                       -> the padding box;
     *   2. inset by a classic scrollbar's gutter, on whichever side the engine put it
     *      (clientLeft carries the left-hand gutter in RTL) -> the scrollport, which is
     *      what CSS Overflow says content is clipped to;
     *   3. overflow-clip-margin can push the edge back OUT again, for overflow: clip.
     *
     * DELIBERATELY NOT corrected for border-radius. A rounded clipper does clip its
     * square-cornered children's corners — but that is the base fixture's own intended
     * shape (.band is overflow: hidden plus border-radius: var(--ui-radius) around a
     * flat control), so rejecting corners would report the design as bug L24. The
     * radius is recorded instead, so a human reading a failure can see it.
     */
    function clipRect(node, cs, r) {
        r = r || node.getBoundingClientRect();
        var bt = parseFloat(cs.borderTopWidth) || 0;
        var brr = parseFloat(cs.borderRightWidth) || 0;
        var bb = parseFloat(cs.borderBottomWidth) || 0;
        var bl = parseFloat(cs.borderLeftWidth) || 0;
        var box = { top: r.top + bt, left: r.left + bl, bottom: r.bottom - bb, right: r.right - brr };

        // clientWidth/clientHeight are integers, so a fractional layout can differ from
        // the padding box by up to a pixel; 2px is below any real scrollbar and above
        // any rounding.
        var scrolls = /^(auto|scroll|overlay)$/.test(cs.overflowX) || /^(auto|scroll|overlay)$/.test(cs.overflowY);
        if (scrolls) {
            var gutterInline = (box.right - box.left) - node.clientWidth;
            var gutterBlock = (box.bottom - box.top) - node.clientHeight;
            if (gutterInline > 2) {
                if (node.clientLeft > bl + 1) box.left += gutterInline;
                else box.right -= gutterInline;
            }
            if (gutterBlock > 2) box.bottom -= gutterBlock;
        }

        var margin = parseFloat(cs.overflowClipMargin) || 0;
        if (margin > 0 && (cs.overflowX === 'clip' || cs.overflowY === 'clip')) {
            box.top -= margin; box.left -= margin; box.bottom += margin; box.right += margin;
        }
        return box;
    }

    function hostOf(node) {
        var root = node.getRootNode();
        return root && root.host ? root.host : null;
    }

    function deepActiveElement() {
        var el = document.activeElement;
        while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
        return el;
    }

    function focus(sel) {
        var el = need(sel);
        el.focus();
        return el === deepActiveElement();
    }

    function dispatch(sel, type, init) {
        var el = need(sel);
        var opts = Object.assign({ bubbles: true, composed: true, cancelable: true }, init || {});
        var ev;
        if (/^(pointer)/.test(type) && typeof PointerEvent === 'function') ev = new PointerEvent(type, opts);
        else if (/^(mouse|click|dblclick|contextmenu)/.test(type)) ev = new MouseEvent(type, opts);
        else if (/^key/.test(type)) ev = new KeyboardEvent(type, opts);
        else if (type === 'input' || type === 'change') ev = new Event(type, opts);
        else ev = new CustomEvent(type, opts);
        var notCancelled = el.dispatchEvent(ev);
        return { defaultPrevented: !notCancelled };
    }

    /* Record events dispatched from a component's shadow tree, so a behaviour
     * assertion can look at what a control EMITTED rather than at what it looks
     * like. Composed events cross the boundary and land on the host. */
    function record(sel, types) {
        var el = need(sel);
        if (!window.__recorded) window.__recorded = [];
        for (var i = 0; i < types.length; i++) {
            (function (t) {
                el.addEventListener(t, function (e) {
                    window.__recorded.push({ type: t, detail: safeDetail(e.detail), value: e.target && e.target.value });
                });
            })(types[i]);
        }
        return true;
    }

    function safeDetail(d) {
        try { return JSON.parse(JSON.stringify(d === undefined ? null : d)); }
        catch (err) { return String(d); }
    }

    function recorded() {
        return window.__recorded || [];
    }

    function clearRecorded() {
        window.__recorded = [];
        return true;
    }

    function raf() {
        return new Promise(function (r) { requestAnimationFrame(function () { r(true); }); });
    }

    /* Let the page reach a steady state: Lit's async update cycle (which can cascade
     * through nested components), webfont loading, then two frames. Two frames, not
     * one: the first flushes style/layout, the second lets anything scheduled from a
     * rAF callback land. */
    async function settle(passes) {
        passes = passes || 4;
        for (var p = 0; p < passes; p++) {
            var els = deepAll();
            var waits = [];
            for (var i = 0; i < els.length; i++) {
                if (els[i].updateComplete) waits.push(els[i].updateComplete);
            }
            if (waits.length) await Promise.all(waits);
            if (document.fonts && document.fonts.ready) await document.fonts.ready;
            await raf();
        }
        await raf();
        return true;
    }

    async function mount(markup, modules) {
        modules = modules || [];
        for (var i = 0; i < modules.length; i++) await import(modules[i]);
        var host = document.getElementById('mount');
        host.innerHTML = markup;
        var tags = {};
        var els = deepAll(host);
        for (var j = 0; j < els.length; j++) {
            var t = els[j].tagName.toLowerCase();
            if (t.indexOf('-') !== -1) tags[t] = true;
        }
        var waits = Object.keys(tags).map(function (t) { return customElements.whenDefined(t); });
        if (waits.length) await Promise.all(waits);
        await settle();
        return Object.keys(tags);
    }

    window.__h = {
        q: q, need: need, qAll: qAll, deepAll: deepAll, anchorPath: anchorPath,
        rect: rect, computed: computed, resolveValue: resolveValue,
        resolveToken: resolveToken, tokenValue: tokenValue, setToken: setToken,
        setStyle: setStyle, metrics: metrics, focusGeometry: focusGeometry,
        focus: focus, deepActiveElement: deepActiveElement, dispatch: dispatch,
        record: record, recorded: recorded, clearRecorded: clearRecorded,
        settle: settle, mount: mount, raf: raf
    };
})();
`;
