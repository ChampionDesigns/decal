/**
 * THE FIT — one number that maps the design onto any landscape screen.
 *
 * WHY THIS EXISTS AT ALL. The skin is an instrument panel, not a document. A bigger
 * screen must show the SAME panel larger, never more content: the operator finds the
 * same control in the same place on every machine. That is the "reference resolution"
 * model — Unity's CanvasScaler match-height, Godot's `canvas_items` + `expand`, every
 * automotive HMI — and it is what Slate already did by hand with a 1920 canvas and a
 * 0.667 CSS transform. The rewrite dropped the transform hack and kept nothing in its
 * place, so the design reflowed instead of scaling. On Ben's tablet that is the whole
 * bug: the WebView's CSS viewport is 1281x801 at devicePixelRatio 1.5, so a responsive
 * layout put 17px text on glass at 25.5 physical pixels — one and a half times Slate,
 * in the same room. Labels wrapped letter by letter, readouts collided, three rail
 * rows fell off the bottom. Nothing was wrong with the design; it was measured at a
 * size the tablet never shows.
 *
 * THE RULE, IN ONE LINE:
 *
 *     S = min(viewportHeight / MIN_DESIGN_HEIGHT, viewportWidth / MIN_DESIGN_WIDTH)
 *
 * and then BOTH design dimensions come back out of S:
 *
 *     designHeight = viewportHeight / S      designWidth = viewportWidth / S
 *
 * So the tighter axis sets the scale and the other axis is free above its minimum.
 * Height wins on every landscape aspect at or above 1280/1200 = 1.067 — which is all
 * of them, 4:3 included — so in practice the design height is exactly 1200 and only
 * the width moves. That is the promise: the rails keep their design widths, the centre
 * column absorbs whatever the screen has spare.
 *
 * MEASURED, at four geometries, before a line of this was written:
 *
 *     1281x801 @1.5 (Ben's tablet)  S 0.6675   design 1919x1200   fills, no scroll
 *     1920x1200 @1  (the gate)      S 1.0000   design 1920x1200   fills, no scroll
 *     1920x1080 @1  (16:9 desk)     S 0.9000   design 2133x1200   fills, no scroll
 *     2560x1440 @1  (16:9 UHD)      S 1.2000   design 2133x1200   fills, no scroll
 *
 * 1919 against the oracle's 1920 is a one-unit difference, which is why the parity
 * work done at 1920 lands true on the tablet without being re-gated.
 *
 * THE TRAP THIS MODULE EXISTS TO AVOID. `zoom` on `:root` does NOT expand the layout
 * viewport: the initial containing block stayed 1281 layout units and the page painted
 * 855x535 inside a 1281x801 screen, with a blank band on two sides. The zoom must sit
 * on an element that carries EXPLICIT design-unit dimensions — app-root, which already
 * owns the ground in styles/document.css and is already the container-query root. That
 * is why this module publishes three properties and not one.
 *
 * WHAT `zoom` DOES AND DOES NOT TOUCH, all measured in the same session:
 *
 *   - container queries read DESIGN units. A `@container app (min-width: 1900px)` rule
 *     matched at S = 0.6675, because the container is 1919 design units wide. Every
 *     `@container` breakpoint in the tree keeps its meaning unchanged.
 *   - `position: fixed`, modal `<dialog>` and `popover` all INHERIT the zoom, top layer
 *     included. Nothing escapes the scale, which was the one real risk.
 *   - `offsetWidth` and computed `font-size` report DESIGN units — a 17px token still
 *     reads "17px" at every scale, so token comparisons and the parity probe's style
 *     reads are unaffected.
 *   - `getBoundingClientRect()` reports PAINTED units — a 100-unit box reads 66.75 at
 *     S = 0.6675. The 1920 gate is untouched because S is exactly 1 there; any gate run
 *     at another geometry must divide rects by S to compare against the oracle.
 *   - a canvas needs `devicePixelRatio * S` backing pixels, not `devicePixelRatio`.
 *     That is `effectivePixelRatio()` below, and ui-chart-card is its one owner.
 *
 * VIEWPORT UNITS ARE NOW WRONG INSIDE THE APP. `100vh` resolves against the layout
 * viewport in LAYOUT units — 801 on the tablet, not the 1200 design units the screen
 * is written in. Anything that wants a share of the app must take it from
 * `--ui-app-h`/`--ui-app-w` or from a container query. styles/tokens.css's
 * `--ui-live-foot-share` was the one live case and moved with this change.
 */

/**
 * The design's minimum height in CSS units, and the height every landscape screen
 * actually gets. 1200 because that is the geometry the whole Slate oracle was
 * photographed at: `slate-audit-2026-08-16/prov-baseline/` is 49 states at 1920x1200.
 * Changing this number invalidates every parity measurement in the tree.
 */
export const MIN_DESIGN_HEIGHT = 1200;

/* WHAT THIS NUMBER COSTS ON THE GLASS, MEASURED 27 AUGUST 2026 — open, and Ben's to
 * close.
 *
 * A 1200-unit design on the bench tablet's 801-unit screen is a scale of 0.6675, so the
 * type role every field and control uses — --ui-text-base, 17 design units — lands at
 * 11.35 CSS px in front of the person using it. Chromium treats anything under about 16
 * as illegible: that is why focusing a text field made the WebView zoom the whole panel,
 * which is the fault index.html's viewport meta now forecloses.
 *
 * SO THE ZOOM IS SHUT, AND THE REASON IT FIRED IS NOT. The browser was reporting
 * something true. Raising it has three possible homes and they are not equivalent:
 *   - Settings > Display > Display size, which already steps the type scale by 1.2 and
 *     persists — a per-tablet answer, reflowing rather than magnifying;
 *   - --ui-text-base itself, which moves one role against a scale built around it;
 *   - THIS constant, which moves everything at once and, per the note above, invalidates
 *     every parity measurement in the tree.
 *
 * Ben, 27 August 2026: "Keep the lock, I'll use it more to decide on text size." So the
 * measurement is recorded here rather than acted on, and whoever picks it up should start
 * from Display size — it is the only one of the three that costs nothing to try. */

/**
 * The design's minimum width. Below this the two 260-unit rails leave the centre
 * column too little to hold its content, so the scale gives up width instead: S drops
 * and the design gets TALLER rather than narrower. Landscape only is a DECIDED
 * constraint (audit DECISIONS.md), and 1280 is the narrowest landscape screen worth
 * supporting; it only ever binds on a portrait or near-square viewport.
 */
export const MIN_DESIGN_WIDTH = 1280;

/**
 * Caps, so an extreme viewport cannot stretch one axis without limit. Past these the
 * app stops growing in design units and is centred, with the body ground showing as a
 * band — deliberate letterboxing rather than a centre column four thousand units wide
 * with the rails marooned at the edges. 2400 is 21:9 at 1200 rounded down; 1600 only
 * ever binds on portrait.
 */
export const MAX_DESIGN_WIDTH = 2400;
export const MAX_DESIGN_HEIGHT = 1600;

/**
 * Scale floor and ceiling. The floor stops a 480-high panel rendering text nobody can
 * read; the ceiling stops an 8K screen from scaling a 17px label to 51px of glass.
 * Neither binds on any screen in the table above.
 */
export const MIN_SCALE = 0.4;
export const MAX_SCALE = 2;

/**
 * Fired on `window` when the scale changes, so anything holding a number DERIVED from
 * the scale can refresh it. One listener today: ui-chart-card's backing store.
 */
export const FIT_EVENT = 'ui-app-fit';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/**
 * The whole fit, as arithmetic — no DOM, so a test can hold every geometry at once.
 *
 * Returns the scale and the two design dimensions. `width`/`height` are the CSS
 * viewport, NOT physical pixels: on Ben's tablet that is 1281x801, and the panel's
 * 1920x1200 physical pixels never enter the calculation. devicePixelRatio is the
 * browser's business everywhere except the canvas backing store.
 */
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

/**
 * The canvas backing factor. A canvas under the fit is painted at `scale`, so it needs
 * `devicePixelRatio * scale` device pixels per design unit to stay crisp. On the tablet
 * that is 1.5 * 0.6675 = 1.0 — the panel is 1920 physical pixels wide and the design is
 * 1920 units wide, so one unit is one pixel and the old `dpr` alone oversampled by half.
 * On a 2560x1440 screen it is 1.2, where `dpr` alone would UNDERSAMPLE and blur.
 */
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

/**
 * Publish a fit onto the document. Written as inline style on `:root` rather than into
 * a stylesheet so that the pre-paint copy in index.html and this module write the SAME
 * three properties to the same place, and the second write simply replaces the first.
 */
export function applyFit(doc, fit) {
    const root = doc?.documentElement;
    if (!root) return fit;
    root.style.setProperty('--ui-app-scale', String(fit.scale));
    root.style.setProperty('--ui-app-w', `${fit.designWidth}px`);
    root.style.setProperty('--ui-app-h', `${fit.designHeight}px`);
    return fit;
}

/**
 * Wire the fit to the window and keep it wired. Returns a stop function.
 *
 * `resize` alone is not enough on a tablet: an on-screen keyboard or a system bar
 * changes the VISUAL viewport without a layout resize in some WebViews, and a fit
 * computed from a stale height letterboxes the panel. Both sources feed the same
 * idempotent write, so a double notification costs one style write and no reflow.
 */
export function installFit(win = globalThis) {
    const doc = win?.document;
    if (!doc) return () => {};

    /* WHY THE EVENT. A canvas needs `devicePixelRatio * scale` backing pixels, and the
     * scale can change with NO change to the canvas's own box: 1920x1200 and Ben's
     * 1281x801 give design widths of 1920 and 1919 at scales of 1 and 0.6675, so a
     * ResizeObserver on the chart sees a one-unit move and the backing store would stay
     * half a pixel per unit wrong. `dppxchange` does not fire either — the device's
     * ratio did not move, the app's scale did. So the fit announces itself, exactly as
     * the platform announces the other half of the same number. */
    let announced = null;
    let lastHeight = null;
    /* The height the keyboard rule below is protecting, or null when no keyboard is up.
     * See "THE LATCH" there — this is the whole of its state. */
    let protectedHeight = null;

    /**
     * IS SOMETHING BEING TYPED INTO?
     *
     * The one question that separates a keyboard from a window resize, and it is asked of
     * the DEEPEST active element: this app is shadow DOM throughout, so
     * `document.activeElement` answers `<app-root>` for every field on every screen and
     * the walk is what reaches the input the user is actually in.
     */
    const typing = () => {
        let node = doc.activeElement;
        while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
        if (!node) return false;
        if (node.isContentEditable) return true;
        const tag = node.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA';
    };

    /**
     * A KEYBOARD IS NOT A SMALLER SCREEN.
     *
     * Ben, 25 August 2026, of the selector's filter: "with decal when the keyboard
     * appears the whole screen gets smaller. That shouldn't happen."
     *
     * WHAT WAS HAPPENING, exactly. The on-screen keyboard shrinks the layout viewport, so
     * `innerHeight` drops by the keyboard's own height; `computeFit` divides the design
     * canvas into what is left; and the WHOLE SCREEN scales down to fit above the
     * keyboard. Every element gets smaller — the list, the chart, the header — for as long
     * as a field has focus. The `visualViewport` listener below makes it prompt rather
     * than making it happen: that event fires precisely when a keyboard opens.
     *
     * THE RULE IS ONE LINE AND IT IS DELIBERATELY NARROW: ignore a SHRINK while something
     * is being typed into. Not every resize during typing — a genuine one that makes the
     * window BIGGER is still honoured, and so is every resize when nothing has focus, so
     * a rotation, a window drag and a display change all still refit. What is refused is
     * the one shape a keyboard has.
     *
     * AND IT IS REFUSED, NOT DEFERRED — there is no queued fit waiting to be applied, so
     * the panel simply keeps the size it had. Blur runs the fit again and so does the
     * keyboard's own close, which is a resize and a GROW; either brings the screen back
     * to the window's real size. (Read the latch below before trusting the blur half of
     * that on its own: a blur that arrives while the viewport is STILL keyboard-shrunk no
     * longer refits, because on 27 August 2026 that was measured collapsing the panel.)
     *
     * ---------------------------------------------------------------------------
     * THE LATCH, and why "is something being typed into RIGHT NOW" was not enough.
     * ---------------------------------------------------------------------------
     *
     * MEASURED 27 August 2026, through CDP at the bench geometry, while hunting a
     * different bug. Focus the selector's filter; shrink the viewport to 1281x430, which
     * is what Ben's WebView does when the keyboard opens; then NAVIGATE AWAY, which is
     * what a person does when they tap Save, Cancel or a nav row with the keyboard still
     * up. The shrink itself was refused correctly — the panel held 0.6675. The `focusout`
     * that the navigation fired was not: by the time it ran, the field was gone, `typing()`
     * answered false, and the still-keyboard-shrunk 430 was taken for the size of the
     * screen. The panel collapsed to
     *
     *     scale 0.4 (the MIN_SCALE floor), design 2400x1200 (the MAX_DESIGN_WIDTH cap),
     *     painted 960x480 inside a 1281x801 window
     *
     * — a third of the glass in use, letterboxed on two sides, and the document scrolling
     * because 1200 x 0.4 = 480 is taller than the 430 it was fitted into. It recovers only
     * if the keyboard's own close delivers a resize; a WebView that closes the keyboard
     * without one leaves the panel like that indefinitely.
     *
     * The same hole was reachable without `focusout` at all: any resize event arriving at
     * the shrunken height after focus had left would have been honoured for the same
     * reason. So the fix is not "don't refit on focusout" — it is that THE SHRINK, ONCE
     * REFUSED, STAYS REFUSED UNTIL THE HEIGHT COMES BACK. `protectedHeight` remembers the
     * height the refusal preserved; every refit below it is refused whether or not
     * anything has focus; the first height at or above it clears the latch and refits.
     * There is no timer and no deferred work: the state is one number.
     *
     * WHAT IT COSTS, stated rather than hidden. A genuine window shrink that BEGINS while
     * a field has focus is now not honoured until the window grows again — on a desk
     * browser you can drag a window smaller mid-type and the panel keeps its old scale
     * until you let go and it grows, or until anything else makes it bigger. That is a
     * desk case; this ships to a wall panel whose screen cannot change size. The
     * alternative is the measured collapse above, on the one machine that matters.
     *
     * OPTIONAL CALLS ON `doc`, like `win.visualViewport?.` one line up and for the same
     * reason: this function takes its document and window as arguments so the suite can
     * hand it a plain object, and that object carries the two properties the fit reads and
     * no listener machinery. A stub is not a defect to guard against; it is the seam.
     */
    const refit = () => {
        const height = win.innerHeight;
        if (protectedHeight !== null) {
            if (height < protectedHeight) return null;
            protectedHeight = null;
        } else if (lastHeight !== null && height < lastHeight && typing()) {
            protectedHeight = lastHeight;
            return null;
        }
        lastHeight = height;
        const fit = applyFit(doc, computeFit({ width: win.innerWidth, height }));
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
        win.removeEventListener('resize', refit);
        win.visualViewport?.removeEventListener('resize', refit);
        doc.removeEventListener?.('focusout', refit);
    };
}
