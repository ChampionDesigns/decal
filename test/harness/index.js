/**
 * index.js — the Gate A rendering-test harness. This is the file a test imports.
 *
 * GATE A, in one sentence (SCOPE Part 8 §2): "A rendering test mounts a component in
 * headless Chrome, lets the real engine lay it out, and asserts on getComputedStyle,
 * box geometry and behaviour — never on source text." The harness decision is
 * headless Chrome over CDP (Part 9 Q12, recorded in DEFERRED_QUESTIONS.md), fixed before
 * the first component's tests are written because a harness swap invalidates the
 * mechanics of every rendering test after it.
 *
 * WHAT IT IS NOT. It cannot assert on source text and does not want to: no method
 * here takes a file path or returns markup. Logic tests stay `node:test` with no
 * browser (Part 2 §2, "test/ — executing tests only").
 *
 * SHAPE OF A SUITE:
 *
 *     import { test, before, after } from 'node:test';
 *     import assert from 'node:assert/strict';
 *     import { launch, BENCH, FLOOR } from './harness/index.js';
 *
 *     let browser;
 *     before(async () => { browser = await launch(); });
 *     after(async () => { await browser.close(); });
 *
 *     test('the ring comes from the token', async () => {
 *         const page = await browser.newPage({ geometry: BENCH });
 *         try {
 *             await page.mount('<ui-button>go</ui-button>', ['/src/components/ui-button.js']);
 *             const { 'outline-width': w } = await page.computed('ui-button >>> button', ['outline-width']);
 *             assert.equal(w, '3px');
 *         } finally {
 *             await page.close();
 *         }
 *     });
 *
 * `withPage()` wraps the try/finally when a test only needs one page.
 *
 * PARALLEL SAFETY. Every `launch()` gets its own Chrome on a kernel-assigned debug
 * port with a fresh user-data-dir, and its own static server on a kernel-assigned
 * port. Ten concurrent builders cannot collide, which is a rig requirement of
 * wf-w0a, not a builder discipline (Part 10 §1, BUILD). `harness-selftest.test.mjs`
 * proves it by running two instances concurrently and comparing their ports.
 */

import { launchChrome, sleep } from './cdp.js';
import { startServer, HARNESS_PAGE, REPO_ROOT } from './server.js';
import { PAGE_HELPERS } from './page-helpers.js';
import { BENCH, FLOOR, DESKTOP, C1, CAPTURE_MATRIX, GATE_A_GEOMETRIES, GEOMETRIES } from './geometry.js';

export { BENCH, FLOOR, DESKTOP, C1, CAPTURE_MATRIX, GATE_A_GEOMETRIES, GEOMETRIES, REPO_ROOT };

/** Virtual key codes for the keys a control test actually needs. */
const KEYS = {
    Tab: { code: 'Tab', keyCode: 9, text: '\t' },
    Enter: { code: 'Enter', keyCode: 13, text: '\r' },
    Escape: { code: 'Escape', keyCode: 27 },
    ' ': { code: 'Space', keyCode: 32, text: ' ' },
    ArrowLeft: { code: 'ArrowLeft', keyCode: 37 },
    ArrowUp: { code: 'ArrowUp', keyCode: 38 },
    ArrowRight: { code: 'ArrowRight', keyCode: 39 },
    ArrowDown: { code: 'ArrowDown', keyCode: 40 },
    Home: { code: 'Home', keyCode: 36 },
    End: { code: 'End', keyCode: 35 },
    Backspace: { code: 'Backspace', keyCode: 8 },
    Delete: { code: 'Delete', keyCode: 46 },
};

export class Page {
    constructor(browser, sessionId, targetId) {
        this.browser = browser;
        this.sessionId = sessionId;
        this.targetId = targetId;
        this.geometry = null;
        this.consoleErrors = [];
        this.pageErrors = [];
    }

    send(method, params) {
        return this.browser.connection.send(method, params, this.sessionId);
    }

    /* ---- navigation and mounting ------------------------------------------ */

    async setGeometry(geometry) {
        this.geometry = geometry;
        await this.send('Emulation.setDeviceMetricsOverride', {
            width: geometry.width,
            height: geometry.height,
            deviceScaleFactor: geometry.deviceScaleFactor,
            mobile: !!geometry.mobile,
            screenWidth: geometry.width,
            screenHeight: geometry.height,
        });
    }

    async setTheme(theme) {
        await this.eval(`document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)}), true`);
        await this.settle();
    }

    /** Load the mount document. Called by newPage(); re-call it to get a clean slate. */
    async reload({ theme } = {}) {
        const url = `${this.browser.origin}${HARNESS_PAGE}${theme ? `?theme=${encodeURIComponent(theme)}` : ''}`;
        const loaded = this.#waitForEvent('Page.loadEventFired');
        await this.send('Page.navigate', { url });
        await loaded;
        this.consoleErrors = [];
        this.pageErrors = [];
        await this.eval('typeof window.__h === "object"');
    }

    /**
     * Navigate to any path on the harness's own server — the whole repo root is
     * served, so '/tools/gallery/index.html' and '/index.html' are both reachable.
     * The page helpers survive the navigation (they are installed with
     * Page.addScriptToEvaluateOnNewDocument), so `computed()`, `box()` and the rest
     * work on a real page, not only on a mounted fragment.
     */
    async goto(pathOrUrl) {
        const url = /^https?:/.test(pathOrUrl) ? pathOrUrl : `${this.browser.origin}${pathOrUrl}`;
        const loaded = this.#waitForEvent('Page.loadEventFired');
        await this.send('Page.navigate', { url });
        await loaded;
        this.consoleErrors = [];
        this.pageErrors = [];
        await this.settle();
        return url;
    }

    /**
     * Put markup in the page and wait for it to be laid out.
     * `modules` are absolute, server-root-relative URLs — '/src/components/x.js'.
     * Bare specifiers inside those modules resolve through index.html's own
     * importmap, because the mount document carries it verbatim (server.js).
     */
    async mount(markup, modules = []) {
        const tags = await this.evalFn(
            (m, mods) => window.__h.mount(m, mods),
            markup,
            modules,
        );
        this.#assertNoPageErrors('mount');
        return tags;
    }

    async settle(passes = 4) {
        return this.evalFn((p) => window.__h.settle(p), passes);
    }

    /* ---- reading the rendered result -------------------------------------- */

    /** getComputedStyle for one element (deep selector), optionally a pseudo. */
    async computed(selector, props, { pseudo = null } = {}) {
        return this.evalFn(
            (s, p, pe) => window.__h.computed(s, p, pe),
            selector, props, pseudo,
        );
    }

    /** One property, unwrapped — the common case. */
    async prop(selector, property, opts) {
        const got = await this.computed(selector, [property], opts);
        return got[property];
    }

    /** getBoundingClientRect, in CSS pixels. */
    async box(selector) {
        return this.evalFn((s) => window.__h.rect(window.__h.need(s)), selector);
    }

    /** Scroll/overflow numbers, including the scrollbar gutter. */
    async metrics(selector) {
        return this.evalFn((s) => window.__h.metrics(s), selector);
    }

    /** Everything the focus-ring assertion needs, clipping ancestors included. */
    async focusGeometry(selector) {
        return this.evalFn((s) => window.__h.focusGeometry(s), selector);
    }

    async exists(selector) {
        return this.evalFn((s) => window.__h.q(s) !== null, selector);
    }

    async count(selector) {
        return this.evalFn((s) => window.__h.qAll(s).length, selector);
    }

    async anchorPath(selector) {
        return this.evalFn((s) => window.__h.anchorPath(window.__h.need(s)), selector);
    }

    /* ---- tokens ------------------------------------------------------------ */

    /** The computed value of a custom property on :root, as authored/substituted. */
    async tokenValue(name) {
        return this.evalFn((n) => window.__h.tokenValue(n), name);
    }

    /** What the engine computes for `prop: var(name)` — comparable with a rendered value. */
    /** `scope` parents the probe to that element, so a dial aimed below :root
     *  resolves where the element under test reads it. See page-helpers.js. */
    async resolveToken(name, prop = 'color', scope = null) {
        return this.evalFn((n, p, sc) => window.__h.resolveToken(n, p, sc), name, prop, scope);
    }

    async resolveValue(value, prop = 'color', scope = null) {
        return this.evalFn((v, p, sc) => window.__h.resolveValue(v, p, sc), value, prop, scope);
    }

    /** Set a token on :root — half of the token drill. `null` removes the override. */
    async setToken(name, value) {
        await this.evalFn((n, v) => (window.__h.setToken(n, v), true), name, value);
        await this.settle(1);
    }

    /* ---- poking at the page ------------------------------------------------ */

    /** Inline styles on an element — how a container is shrunk for a floor test. */
    async setStyle(selector, props) {
        const r = await this.evalFn((s, p) => window.__h.setStyle(s, p), selector, props);
        await this.settle(1);
        return r;
    }

    /** A synthetic in-page event. For real hit-tested input use click()/press(). */
    async dispatch(selector, type, init = {}) {
        const r = await this.evalFn((s, t, i) => window.__h.dispatch(s, t, i), selector, type, init);
        await this.settle(1);
        return r;
    }

    /**
     * A real click, through the browser's own hit test: CDP dispatches at viewport
     * coordinates and Chrome decides what is under them. This is the half a
     * screenshot gate cannot see — the uPlot mount-C failure is pixel-identical and
     * completely dead to input (Part 8 §3 Rule 1).
     */
    async click(selector, { button = 'left', clickCount = 1, offset = null } = {}) {
        const r = await this.box(selector);
        const x = offset ? r.left + offset.x : r.left + r.width / 2;
        const y = offset ? r.top + offset.y : r.top + r.height / 2;
        await this.mouse('mousePressed', x, y, { button, clickCount });
        await this.mouse('mouseReleased', x, y, { button, clickCount });
        await this.settle(1);
        return { x, y };
    }

    async mouse(type, x, y, { button = 'left', clickCount = 0, modifiers = 0 } = {}) {
        await this.send('Input.dispatchMouseEvent', {
            type, x, y, button, clickCount, modifiers, buttons: type === 'mousePressed' ? 1 : 0,
        });
    }

    /** A real key press. Also what puts the page into keyboard focus modality. */
    async press(key, { modifiers = 0 } = {}) {
        const spec = KEYS[key] ?? { code: `Key${key.toUpperCase()}`, keyCode: key.toUpperCase().charCodeAt(0), text: key };
        const base = {
            key,
            code: spec.code,
            windowsVirtualKeyCode: spec.keyCode,
            nativeVirtualKeyCode: spec.keyCode,
            modifiers,
        };
        await this.send('Input.dispatchKeyEvent', { ...base, type: spec.text ? 'keyDown' : 'rawKeyDown', text: spec.text ?? '' });
        await this.send('Input.dispatchKeyEvent', { ...base, type: 'keyUp' });
        await this.settle(1);
    }

    /**
     * Focus an element so that `:focus-visible` matches — which is what a focus-ring
     * assertion has to test, and what `el.focus()` alone does NOT give you on a
     * button: Chrome only paints the visible ring when the last interaction was
     * keyboard. So: send one real Tab through CDP to put the page in keyboard
     * modality, then focus the element we actually want.
     *
     * THE SECOND HALF, and the one that cost a wave-0a review finding (rig-1). Keyboard
     * modality is not enough: an element in a document that does not have focus is
     * `:focus` but never `:focus-visible`, and Chrome paints `outline-style: none`. A
     * page opened through `Target.createTarget` is NOT reliably the focused target —
     * MEASURED at 8 failures in 10 isolated runs of base-fixture.render.test.mjs, always
     * the second geometry block, with `document.hasFocus()` flipping to false partway
     * through the test. `newPage()` therefore turns focus emulation on for every page
     * (see there); this method then VERIFIES the modality rather than assuming it, so
     * the failure surfaces here — named — instead of as a bare `does not match
     * :focus-visible` inside whichever assertion happened to run next.
     */
    async focusVisible(selector) {
        await this.press('Tab');
        const ok = await this.evalFn((s) => window.__h.focus(s), selector);
        await this.settle(1);
        if (!ok) throw new Error(`focusVisible: ${selector} did not take focus (is it focusable?)`);

        const state = await this.evalFn(
            (s) => ({
                visible: window.__h.need(s).matches(':focus-visible'),
                documentFocused: document.hasFocus(),
            }),
            selector,
        );
        if (!state.visible) {
            throw new Error(
                `focusVisible: ${selector} took focus but does not match :focus-visible ` +
                `(document.hasFocus() === ${state.documentFocused}).\n` +
                '  If documentFocused is false the page lost the browser\'s focus — ' +
                'Emulation.setFocusEmulationEnabled should have prevented that; see newPage().',
            );
        }
        return ok;
    }

    async recordEvents(selector, types) {
        await this.evalFn((s, t) => window.__h.record(s, t), selector, types);
        await this.evalFn(() => window.__h.clearRecorded());
    }

    async recordedEvents() {
        return this.evalFn(() => window.__h.recorded());
    }

    /* ---- raw evaluation ---------------------------------------------------- */

    /**
     * Evaluate an expression string in the page and return it by value.
     *
     * THE ONE RETRY IN THE HARNESS, and it is scoped to a single CDP error string
     * (parity surface 2). `Runtime.evaluate` with `awaitPromise: true` makes the
     * BROWSER hold the pending promise as a remote object and answer when it settles;
     * if that object goes away first, CDP answers with the protocol error
     * "Promise was collected". It is a fault in the round trip, not in the page —
     * a page exception comes back as `exceptionDetails` and never as a protocol
     * error — so there is no state to be confused about and re-asking is honest.
     *
     * MEASURED, on test/render/step-matrix.render.test.mjs's C8 case, which was the
     * only place in the suite set that ever hit it: 6 red in 9 runs (parity surface
     * 1's review), 2 red in 6 after parking the promise on `window` as that review
     * proposed, 2 red in 6 again after removing `awaitPromise` from the test's own
     * expression — which is what ruled out both "the page collected it" theories and
     * left the round trip itself. With this retry: 0 red in 6.
     *
     * IT RETRIES ONCE AND ONLY ON THAT STRING. Anything else — a page exception, a
     * detached context, a closed connection — propagates on the first answer, so a
     * real failure still fails on the first run and a flake does not become a way to
     * paper over one. The expression rides on the error either way, so a second
     * failure names what was being read.
     *
     * AND IT IS LOGGED (parity surface 2's review): a retry that recovers silently
     * makes the flake's rate unobservable, and an unobservable rate is how a pinned
     * flake grows back unnoticed. One stderr line per firing, so any run's log says
     * how often the round trip actually lost the object.
     */
    async eval(expression) {
        for (let attempt = 0; ; attempt += 1) {
            try {
                const res = await this.send('Runtime.evaluate', {
                    expression,
                    awaitPromise: true,
                    returnByValue: true,
                    userGesture: true,
                });
                if (res.exceptionDetails) throw pageError(res.exceptionDetails, expression);
                return res.result?.value;
            } catch (err) {
                const collected = err?.cdp?.message === 'Promise was collected';
                if (!collected || attempt >= 1) {
                    if (collected) err.expression = expression.slice(0, 400);
                    throw err;
                }
                console.warn('[harness] Page.eval retrying once — CDP "Promise was '
                    + `collected" on: ${expression.slice(0, 80)}`);
            }
        }
    }

    /**
     * Evaluate a function in the page with JSON-serialisable arguments.
     * The function is serialised by `toString()`, so it may not close over anything
     * in the node process — arguments are the whole channel.
     */
    async evalFn(fn, ...args) {
        const expr = `(${fn.toString()}).apply(null, ${JSON.stringify(args)})`;
        return this.eval(expr);
    }

    /** A PNG of the emulated viewport, base64. The battery's primitive, not Gate A's. */
    async screenshot({ format = 'png', fullPage = false } = {}) {
        const params = { format, captureBeyondViewport: fullPage };
        const res = await this.send('Page.captureScreenshot', params);
        return Buffer.from(res.data, 'base64');
    }

    async close() {
        this.browser._pages.delete(this);
        try {
            await this.browser.connection.send('Target.closeTarget', { targetId: this.targetId });
        } catch { /* browser already gone */ }
    }

    /* ---- internals --------------------------------------------------------- */

    #assertNoPageErrors(what) {
        if (this.pageErrors.length) {
            const first = this.pageErrors[0];
            const err = new Error(`${what}: the page threw — ${first}`);
            err.pageErrors = [...this.pageErrors];
            throw err;
        }
    }

    #waitForEvent(method, timeout = 30000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.browser.connection.off('event', onEvent);
                reject(new Error(`timed out waiting for ${method}`));
            }, timeout);
            const onEvent = (msg) => {
                if (msg.method === method && msg.sessionId === this.sessionId) {
                    clearTimeout(timer);
                    this.browser.connection.off('event', onEvent);
                    resolve(msg.params);
                }
            };
            this.browser.connection.on('event', onEvent);
        });
    }
}

function pageError(details, expression) {
    const text = details.exception?.description ?? details.text ?? 'unknown page exception';
    const err = new Error(`page threw: ${text}`);
    err.expression = expression.slice(0, 400);
    return err;
}

export class Browser {
    constructor(connection, server) {
        this.connection = connection;
        this.server = server;
        this.origin = server.origin;
        this._pages = new Set();
        this._closed = false;

        connection.on('event', (msg) => this.#onEvent(msg));
    }

    #onEvent(msg) {
        if (msg.method !== 'Runtime.consoleAPICalled' && msg.method !== 'Runtime.exceptionThrown') return;
        for (const page of this._pages) {
            if (page.sessionId !== msg.sessionId) continue;
            if (msg.method === 'Runtime.exceptionThrown') {
                const d = msg.params.exceptionDetails;
                page.pageErrors.push(d.exception?.description ?? d.text ?? 'exception');
            } else if (msg.params.type === 'error') {
                page.consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
            }
        }
    }

    /** A fresh tab at a geometry, with helpers installed and the mount document loaded. */
    async newPage({ geometry = BENCH, theme = null } = {}) {
        // No width/height here: Chrome rejects a size on a tab target ("Target
        // position can only be set for new windows"), and the size that matters is
        // the emulated one set below — the same override the dsf-1.5 spike used, and
        // the only one that makes deviceScaleFactor: 1.5 real.
        const { targetId } = await this.connection.send('Target.createTarget', {
            url: 'about:blank',
        });
        const { sessionId } = await this.connection.send('Target.attachToTarget', {
            targetId,
            flatten: true,
        });

        const page = new Page(this, sessionId, targetId);
        this._pages.add(page);

        await page.send('Runtime.enable');
        await page.send('Page.enable');
        await page.send('DOM.enable');
        await page.send('CSS.enable');
        // A tab opened through Target.createTarget is not reliably the browser's FOCUSED
        // target, and an unfocused document is `:focus` but never `:focus-visible` —
        // Chrome computes `outline-style: none` and the ring assertions fail with no
        // hint as to why. Focus emulation makes every page behave as the focused one,
        // which is what makes focusVisible() deterministic instead of 8-in-10 (finding
        // rig-1). Tolerated if a build lacks the command: focusVisible() then reports
        // the real state rather than silently measuring an unfocused page.
        try {
            await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });
        } catch { /* older Chrome: focusVisible()'s own check is the backstop */ }
        await page.setGeometry(geometry);
        await page.send('Page.addScriptToEvaluateOnNewDocument', { source: PAGE_HELPERS });
        await page.reload({ theme });
        return page;
    }

    /** Open a page, run `fn`, and close the page whatever happens. */
    async withPage(opts, fn) {
        if (typeof opts === 'function') { fn = opts; opts = {}; }
        const page = await this.newPage(opts);
        try {
            return await fn(page);
        } finally {
            await page.close();
        }
    }

    async close() {
        if (this._closed) return;
        this._closed = true;
        for (const page of [...this._pages]) {
            try { await page.close(); } catch { /* browser may be gone */ }
        }
        await this.connection.browser.kill();
        await this.server.close();
    }
}

/**
 * Launch a browser plus its own static server. One per test file is the intended
 * grain: the process cost is a few hundred milliseconds, and a browser per test
 * would multiply that by the suite.
 *
 * `extraArgs` are appended to Chrome's command line, and the default `[]` is the
 * only behaviour any existing suite sees. It exists for ONE measured reason: headless
 * Chrome has no pointing device, so `matchMedia('(hover: hover)')` is FALSE here and
 * `(hover: none)` is true. Any component rule inside `@media (hover: hover)` is
 * therefore dead in this rig and its paint is unassertable — a blind spot, not a
 * pass. A suite that needs to assert such a rule launches a device that hovers:
 *
 *     launch({ extraArgs: ['--blink-settings=primaryHoverType=2,availableHoverTypes=2,'
 *                          + 'primaryPointerType=4,availablePointerTypes=4'] })
 *
 * MEASURED, both directions: with the flag, (hover: hover), (any-hover: hover) and
 * (pointer: fine) all match; without it, none do. The touch-panel side is emulated
 * per test from there with `page.send('Emulation.setEmulatedMedia', { features: [
 * { name: 'hover', value: 'none' } ] })`, which DOES work — CDP can take the feature
 * away and cannot hand it over, which is why the flag is the half that has to be a
 * launch argument.
 */
export async function launch({ root, geometry = BENCH, theme = null, extraArgs = [] } = {}) {
    const server = await startServer({ root, theme });
    let connection;
    try {
        connection = await launchChrome({
            windowSize: { width: geometry.width, height: geometry.height },
            extraArgs,
        });
    } catch (err) {
        await server.close();
        throw err;
    }
    return new Browser(connection, server);
}

/**
 * Launch, open one page, run `fn`, tear everything down. Convenient for a one-shot
 * check; a suite should `launch()` once and open pages per test instead.
 */
export async function withPage(opts, fn) {
    if (typeof opts === 'function') { fn = opts; opts = {}; }
    const browser = await launch(opts);
    try {
        return await browser.withPage(opts, fn);
    } finally {
        await browser.close();
    }
}

export { sleep };
