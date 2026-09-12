/**
 * THE FIT — one number that maps the design onto any landscape screen.
 */

export const MIN_DESIGN_HEIGHT = 1200;

export const MIN_DESIGN_WIDTH = 1280;

export const MAX_DESIGN_WIDTH = 2400;
export const MAX_DESIGN_HEIGHT = 1600;

export const MIN_SCALE = 0.4;
export const MAX_SCALE = 2;

/** The smallest hit target, in rendered px, and the property applyFit publishes it on. */
export const MIN_GLASS_HIT = 48;
export const HIT_FLOOR_PROPERTY = '--_ui-hit-floor';

/**
 * Fired on `window` when the scale changes, so anything holding a number DERIVED from
 * the scale can refresh it. One listener today: ui-chart-card's backing store.
 */
export const FIT_EVENT = 'ui-app-fit';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

const SETTLE_MS = 250;

export function computeFit({ width, height }) {
    if (!(width > 0) || !(height > 0)) {
        /* A viewport with no size is a WebView mid-teardown or a detached test page.
         * Answer the identity fit rather than NaN: unscaled is wrong-looking, NaN is a
         * blank screen. */
        return { scale: 1, designWidth: MIN_DESIGN_WIDTH, designHeight: MIN_DESIGN_HEIGHT };
    }
    const scale = clamp(
        Math.min(height / MIN_DESIGN_HEIGHT, width / MIN_DESIGN_WIDTH),
        MIN_SCALE, MAX_SCALE);
    return {
        scale,
        designWidth: clamp(width / scale, MIN_DESIGN_WIDTH, MAX_DESIGN_WIDTH),
        designHeight: clamp(height / scale, MIN_DESIGN_HEIGHT, MAX_DESIGN_HEIGHT),
    };
}

export function effectivePixelRatio(win = globalThis) {
    const dpr = win?.devicePixelRatio > 0 ? win.devicePixelRatio : 1;
    const scale = readScale(win);
    return dpr * scale;
}

/** The published scale, read back from the document. 1 when the fit has not run. */
export function readScale(win = globalThis) {
    const root = win?.document?.documentElement;
    if (!root) return 1;
    const raw = parseFloat(root.style.getPropertyValue('--ui-app-scale'));
    return raw > 0 ? raw : 1;
}

export function applyFit(doc, fit) {
    const root = doc?.documentElement;
    if (!root) return fit;
    root.style.setProperty('--ui-app-scale', String(fit.scale));
    root.style.setProperty('--ui-app-w', `${fit.designWidth}px`);
    root.style.setProperty('--ui-app-h', `${fit.designHeight}px`);
    root.style.setProperty(HIT_FLOOR_PROPERTY,
        `${MIN_GLASS_HIT / (fit.scale > 0 ? fit.scale : 1)}px`);
    return fit;
}

export function installFit(win = globalThis) {
    const doc = win?.document;
    if (!doc) return () => {};

    let announced = null;
    let lastHeight = null;
    let lastWidth = null;
    /* The viewport a keyboard is covering, or null when none is. The width is half of
     * it: a shrink that also changes the width is not a keyboard. */
    let protectedHeight = null;
    let protectedWidth = null;
    let settleTimer = null;
    let settleHeight = null;

    const typing = () => {
        let node = doc.activeElement;
        while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
        if (!node) return false;
        if (node.isContentEditable) return true;
        const tag = node.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA';
    };

    const cancelSettle = () => {
        if (settleTimer === null) return;
        win.clearTimeout?.(settleTimer);
        settleTimer = null;
        settleHeight = null;
    };

    /* Editing can end while the viewport is still short, with the keyboard's closing
     * animation still running: refit on two equal measurements, not in the handler. */
    const settleLater = () => {
        if (typeof win.setTimeout !== 'function') return;
        settleHeight = win.innerHeight;
        if (settleTimer !== null) return;
        settleTimer = win.setTimeout(() => {
            settleTimer = null;
            if (protectedHeight === null) return;
            if (typing()) return;
            if (win.innerHeight !== settleHeight) { settleLater(); return; }
            protectedHeight = null;
            protectedWidth = null;
            refit();
        }, SETTLE_MS);
    };

    const refit = () => {
        const height = win.innerHeight;
        const width = win.innerWidth;
        if (protectedHeight !== null) {
            if (width === protectedWidth && height < protectedHeight) {
                if (!typing()) settleLater();
                return null;
            }
            protectedHeight = null;
            protectedWidth = null;
        } else if (lastHeight !== null && height < lastHeight && width === lastWidth && typing()) {
            protectedHeight = lastHeight;
            protectedWidth = lastWidth;
            return null;
        }
        cancelSettle();
        lastHeight = height;
        lastWidth = width;
        const fit = applyFit(doc, computeFit({ width, height }));
        if (fit.scale !== announced) {
            announced = fit.scale;
            win.dispatchEvent?.(new CustomEvent(FIT_EVENT, { detail: fit }));
        }
        return fit;
    };
    refit();

    win.addEventListener('resize', refit);
    /* visualViewport is absent in older engines and in the test harness's bare pages. */
    win.visualViewport?.addEventListener('resize', refit);
    /* THE WAY BACK. `focusout` bubbles and `blur` does not, which is the whole reason this
     * is the one on the list — a field inside a shadow root has to reach the window. */
    doc.addEventListener?.('focusout', refit);

    return () => {
        cancelSettle();
        win.removeEventListener('resize', refit);
        win.visualViewport?.removeEventListener('resize', refit);
        doc.removeEventListener?.('focusout', refit);
    };
}
