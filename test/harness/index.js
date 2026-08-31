/**
 * the render harness rendering-test harness.
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

    async reload({ theme } = {}) {
        const url = `${this.browser.origin}${HARNESS_PAGE}${theme ? `?theme=${encodeURIComponent(theme)}` : ''}`;
        const loaded = this.#waitForEvent('Page.loadEventFired');
        await this.send('Page.navigate', { url });
        await loaded;
        this.consoleErrors = [];
        this.pageErrors = [];
        await this.eval('typeof window.__h === "object"');
    }

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

    /** The computed value of a custom property on :root, as authored/substituted. */
    async tokenValue(name) {
        return this.evalFn((n) => window.__h.tokenValue(n), name);
    }

    /** What the engine computes for `prop: var(name)` — comparable with a rendered value. */
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

    async evalFn(fn, ...args) {
        const expr = `(${fn.toString()}).apply(null, ${JSON.stringify(args)})`;
        return this.eval(expr);
    }

    /** A PNG of the emulated viewport, base64. The battery's primitive, not the render harness's. */
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
