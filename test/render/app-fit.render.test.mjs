/**
 * app-fit.render.test.mjs — the fit, in a real engine, on the real page.
 *
 * WHAT ONLY A BROWSER CAN SAY. test/app-fit.test.mjs holds the arithmetic and holds the
 * pre-paint copy in index.html to the module, both without a DOM. Neither can say the
 * thing the fit exists for: that the app FILLS THE SCREEN at the right scale, with
 * nothing scrolling and the design laid out in the units the oracle was measured in.
 *
 * IT ALSO REPLACES A TEST THAT SHOULD NOT HAVE EXISTED. The first draft asserted that
 * styles/document.css contains `zoom: var(--ui-app-scale, 1)` and that `:root` does not.
 * A8 rejected it — "a test that matches source text makes the defect it describes
 * unremovable" — and A8 was right twice over, because the source text is not the claim.
 * The claim is that zoom on `:root` DOES NOT WORK, and that is observable: measured
 * before any of this was written, a zoomed `:root` left the initial containing block at
 * 1281 layout units and painted 855x535 inside a 1281x801 screen, blank on two sides.
 * `fills the screen exactly` below is that same measurement, kept as the assertion.
 *
 * FOUR GEOMETRIES, and the two that are not Gate A's earn their place:
 *   BENCH   1281x801 @1.5   Ben's tablet, the only screen that matters today
 *   DESKTOP 1920x1200 @1    the oracle's geometry, where the scale is exactly 1
 *   C1      1920x1080 @1    a 16:9 screen, where the design gets WIDER and not shorter
 *   FLOOR   1000x600  @1    the small end
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { launch, BENCH, DESKTOP, C1, FLOOR } from '../harness/index.js';
import { computeFit } from '../../src/lib/app-fit.js';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const GEOMETRIES = [BENCH, DESKTOP, C1, FLOOR];

/** Load the REAL document at a geometry and report what the fit did to it. */
async function fitted(geometry, body) {
    const page = await browser.newPage({ geometry });
    try {
        await page.goto('/index.html');
        await page.settle();
        const seen = await page.evalFn(() => {
            const app = document.querySelector('app-root');
            const rect = app.getBoundingClientRect();
            const de = document.documentElement;
            return {
                /* PAINTED units — what the eye gets. */
                paintedWidth: rect.width,
                paintedHeight: rect.height,
                /* DESIGN units — what the stylesheets are written in. */
                designWidth: app.offsetWidth,
                designHeight: app.offsetHeight,
                zoom: parseFloat(getComputedStyle(app).zoom),
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                docScrollWidth: de.scrollWidth,
                docClientWidth: de.clientWidth,
                docScrollHeight: de.scrollHeight,
                docClientHeight: de.clientHeight,
                /* THE ONE TOKEN THAT USED TO READ THE VIEWPORT, MEASURED AS A LENGTH.
                 * `getComputedStyle().getPropertyValue()` on a custom property answers
                 * the SUBSTITUTED TEXT — `calc(0.18 * 1200px)` — not the used length, so
                 * reading it that way asserts on a string and would pass just as happily
                 * on `calc(0.18 * 100dvh)`, which is the bug. A real box in a real length
                 * context is what resolves it.
                 *
                 * ON THE BODY, NOT INSIDE app-root: the shell renders a shadow root with
                 * no slot, so a light-DOM child of it is never laid out and answers 0.
                 * The body is the right place anyway — both --ui-app-h and the token are
                 * declared on :root, and `offsetHeight` reports unzoomed layout units on
                 * either side of the zoom, so the number is the same design 216 in both
                 * places. What would NOT be the same is a viewport unit, which is the
                 * whole point. */
                footShare: (() => {
                    const probe = document.createElement('div');
                    probe.style.cssText = 'position:absolute;visibility:hidden;'
                        + 'block-size:var(--ui-live-foot-share)';
                    document.body.append(probe);
                    const used = probe.offsetHeight;
                    probe.remove();
                    return used;
                })(),
            };
        });
        await body(seen, page);
    } finally {
        await page.close();
    }
}

for (const geometry of GEOMETRIES) {
    describe(`the fit at ${geometry.name} (${geometry.width}x${geometry.height} @${geometry.deviceScaleFactor})`, () => {
        test('the app fills the screen exactly', () => fitted(geometry, (seen) => {
            /* THE 855x535 ASSERTION. A zoom that does not expand the layout viewport
             * paints the app at scale INSIDE a full-size viewport and leaves a blank
             * band on two sides. One number each way catches it. */
            assert.ok(Math.abs(seen.paintedWidth - seen.viewportWidth) < 1.5,
                `the app paints ${seen.paintedWidth} wide in a ${seen.viewportWidth} viewport`);
            assert.ok(Math.abs(seen.paintedHeight - seen.viewportHeight) < 1.5,
                `the app paints ${seen.paintedHeight} tall in a ${seen.viewportHeight} viewport`);
        }));

        test('the scale is the one the module computes', () => fitted(geometry, (seen) => {
            const expected = computeFit({ width: geometry.width, height: geometry.height });
            assert.ok(Math.abs(seen.zoom - expected.scale) < 0.0005,
                `the page is drawn at ${seen.zoom} where the module says ${expected.scale}`);
            assert.ok(Math.abs(seen.designWidth - expected.designWidth) < 1.5,
                `the page lays out at ${seen.designWidth} design units, not ${expected.designWidth}`);
            assert.equal(seen.designHeight, expected.designHeight,
                'the design height is not the reference height — no oracle exists for this size');
        }));

        test('nothing scrolls, in either axis', () => fitted(geometry, (seen) => {
            /* Both axes, because the tablet had BOTH before the fit: the design was
             * 1.5x too large for the room in every direction. */
            assert.ok(seen.docScrollWidth <= seen.docClientWidth + 1,
                `the document scrolls sideways: ${seen.docScrollWidth} > ${seen.docClientWidth}`);
            assert.ok(seen.docScrollHeight <= seen.docClientHeight + 1,
                `the document scrolls: ${seen.docScrollHeight} > ${seen.docClientHeight}`);
        }));

        test('the foot share is a share of the DESIGN height, not of the viewport',
            () => fitted(geometry, (seen) => {
                /* 18% of 1200 = 216 design units, at every geometry. Before the fit this
                 * token read `18dvh` and would answer 144.2 here on the bench tablet and
                 * 108 at the floor — a phase row lost, silently, on the one screen that
                 * matters. */
                assert.ok(Math.abs(seen.footShare - 216) < 1,
                    `--ui-live-foot-share used ${seen.footShare}px, not 216px of design`);
            }));
    });
}

describe('the fit follows a resize', () => {
    test('a window that changes shape is re-fitted, not left at the old scale', async () => {
        const page = await browser.newPage({ geometry: DESKTOP });
        try {
            await page.goto('/index.html');
            await page.settle();
            const before = await page.evalFn(() =>
                parseFloat(getComputedStyle(document.querySelector('app-root')).zoom));
            assert.equal(before, 1, 'the oracle geometry is where the scale is exactly 1');

            /* A rotate, a window drag, a system bar appearing — all arrive as this. */
            await page.setGeometry(BENCH);
            await page.settle();
            const after = await page.evalFn(() => {
                const app = document.querySelector('app-root');
                const rect = app.getBoundingClientRect();
                return {
                    zoom: parseFloat(getComputedStyle(app).zoom),
                    paintedWidth: rect.width,
                    viewportWidth: window.innerWidth,
                };
            });
            assert.ok(Math.abs(after.zoom - 0.6675) < 0.0005,
                `the app stayed at ${after.zoom} after the window changed shape`);
            assert.ok(Math.abs(after.paintedWidth - after.viewportWidth) < 1.5,
                'the app no longer fills the screen after a resize');
        } finally {
            await page.close();
        }
    });
});

/* ===========================================================================
 * THE ZOOM TRAP — the browser's page scale, which is a layer above the fit
 * ===========================================================================
 *
 * Ben, 27 August 2026: "after going into the editor and other pages, the page zoom good
 * odd and I zoom in a lot and have to drage the view around to see the rest of the page
 * with no way to zoom out."
 *
 * WHICH ZOOM. Not `app-fit`'s. Measured first, before anything was changed: at BENCH,
 * `app-root`'s zoom is 0.6675 and the app paints 1281x801 on every one of the five routes
 * — live, selector, settings, editor, history — so nothing about navigating moves the
 * fit. What moves is the BROWSER'S page scale, the visual viewport: forced to 3 it leaves
 * a 427x267 window onto a 1281x801 layout viewport, which is the report exactly, and on a
 * full-screen wall-panel WebView there is no chrome to undo it and no script that can
 * (page scale has no setter; a viewport meta rewritten after the fact does not clamp a
 * scale already applied — measured).
 *
 * MOBILE VIEWPORT MODE IS LOAD-BEARING HERE and it is why these two tests carry their own
 * geometry. A viewport meta's scale constraints are honoured only when the engine is in
 * mobile viewport mode; measured in this rig at `mobile: false`, the same forced scale of
 * 3 sticks whatever index.html says, because desktop Blink ignores `user-scalable` and
 * `maximum-scale` outright. Gate A's BENCH is `mobile: false` — right for laying
 * components out, useless for asking this question — and the tablet's WebView is mobile.
 * One field differs, and it is named rather than assumed.
 *
 * WHAT THIS PAIR CAN AND CANNOT SAY. It cannot reproduce the TRIGGER: a synthesized pinch
 * (`Input.synthesizePinchGesture`) does not move page scale in this headless build at all
 * — not on the app and not on a bare scalable page with a 3000px body, which was run as
 * the control — and Chromium's other likely trigger, Android WebView's
 * `setAutoZoomFocusedEditableToLegibleScale`, is off in desktop Blink. So neither test
 * below claims the gesture is reachable on Ben's glass. What they claim is narrower and
 * is the thing that was actually wrong: THE PAGE PERMITTED THE STATE, and now refuses it.
 * The canary is what makes that a measurement — same rig, same force, one difference.
 *
 * WHICH TRIGGER IT ACTUALLY IS was settled by reading the host rather than the rig, and
 * the argument lives beside the declaration in index.html: ReaPrime's WebView already
 * runs `supportZoom: false, builtInZoomControls: false`, so pinch is off both ways — the
 * way in AND the way out — and the engine's focus-autozoom is what is left. Read that
 * comment before changing the meta; this file only holds the consequence.
 */
describe('the browser cannot leave the panel zoomed with no way back', () => {
    /* The bench tablet as the WebView actually presents it. See the note above. */
    const MOBILE_BENCH = { ...BENCH, name: 'bench (mobile viewport)', mobile: true };

    /** Force a page scale and report what the page was left holding. */
    async function forcedTo(pathname, pageScaleFactor) {
        const page = await browser.newPage({ geometry: MOBILE_BENCH });
        try {
            await page.goto(pathname);
            await page.settle();
            await page.send('Emulation.setPageScaleFactor', { pageScaleFactor });
            await page.settle();
            return page.evalFn(() => ({
                scale: window.visualViewport ? window.visualViewport.scale : null,
                visualWidth: Math.round(window.visualViewport?.width ?? 0),
                visualHeight: Math.round(window.visualViewport?.height ?? 0),
                layoutWidth: window.innerWidth,
                layoutHeight: window.innerHeight,
            }));
        } finally {
            await page.close();
        }
    }

    test('the app refuses a page scale it could never undo', async () => {
        const seen = await forcedTo('/index.html', 3);
        assert.equal(seen.scale, 1,
            `the page held a browser zoom of ${seen.scale} — a ${seen.visualWidth}x${seen.visualHeight} `
            + `window onto a ${seen.layoutWidth}x${seen.layoutHeight} panel, with no chrome to escape it `
            + 'and no script that can. index.html\'s viewport meta is what refuses this; read the '
            + 'comment above that line before changing it.');
        /* The visual viewport is the whole layout viewport: nothing to pan to. */
        assert.equal(seen.visualWidth, seen.layoutWidth);
        assert.equal(seen.visualHeight, seen.layoutHeight);
    });

    test('and the canary proves the rig can still see the trap', async () => {
        /* WITHOUT THIS, a rig that had quietly lost the ability to change page scale at
         * all would report the trap as fixed for ever. The canary is index.html's own
         * pre-27-August viewport meta and nothing else. */
        const seen = await forcedTo('/test/fixtures/canaries/scalable-viewport.html', 3);
        assert.equal(seen.scale, 3,
            'the canary did not take a page scale of 3, so this rig can no longer observe the '
            + 'trap and the test above proves nothing. Fix the rig, do not delete the canary.');
        assert.ok(seen.visualWidth < seen.layoutWidth,
            'the canary scaled without shrinking its visual viewport — the rig is not measuring page scale');
    });
});

/* ===========================================================================
 * THE KEYBOARD, AND THE WAY IT USED TO LEAVE THE PANEL COLLAPSED
 * =========================================================================== */
describe('a keyboard that is dismissed by navigating does not resize the panel', () => {
    /* FOUND 27 August 2026 while measuring the zoom trap, and it is a different bug in
     * the opposite direction — the panel got SMALLER, not bigger, so it is not what Ben
     * reported. It is real all the same, and reachable on his tablet by the most ordinary
     * gesture there is: type in a field, then tap Save.
     *
     * `app-fit` already refuses a SHRINK while something is being typed into, because an
     * on-screen keyboard shrinks the layout viewport and a keyboard is not a smaller
     * screen. What it did not survive was the shrink outliving the focus. Navigating away
     * fires `focusout` with the keyboard still up; `typing()` answers false because the
     * field has gone; and the fit took the keyboard-shrunk height for the size of the
     * screen. Measured, at BENCH with the height dropped to 430: scale 0.4 (the MIN_SCALE
     * floor), design 2400x1200 (the MAX_DESIGN_WIDTH cap), painted 960x480 inside
     * 1281x801 — a third of the glass, letterboxed on two sides, and recovering only if
     * the WebView's keyboard-close happens to deliver a resize.
     *
     * The latch in `installFit` is the fix and this is its pin. `test/app-fit.test.mjs`
     * holds the same rule as arithmetic; this holds it as a rendered fact, because the
     * `focusout` half only exists in a real document. */
    test('focus, keyboard, navigate away — the fit holds', async () => {
        const page = await browser.newPage({ geometry: BENCH });
        try {
            await page.goto('/index.html');
            await page.evalFn(() => { globalThis.location.hash = '#/selector'; return true; });
            await page.settle(8);

            const zoomNow = () => page.evalFn(() =>
                parseFloat(getComputedStyle(document.querySelector('app-root')).zoom));
            assert.ok(Math.abs(await zoomNow() - 0.6675) < 0.0005, 'the bench fit did not apply');

            /* A field, wherever the selector keeps it — reached through the shadow roots,
             * because `document.activeElement` cannot see past `<app-root>`. */
            const focused = await page.evalFn(() => {
                const found = [];
                const walk = (root) => {
                    for (const el of root.querySelectorAll('*')) {
                        if (el.tagName === 'INPUT' && el.type === 'text') found.push(el);
                        if (el.shadowRoot) walk(el.shadowRoot);
                    }
                };
                walk(document);
                if (!found.length) return false;
                found[0].focus();
                return true;
            });
            assert.ok(focused, 'the selector has no text field to type into — this test needs one');

            /* The keyboard opens: the layout viewport loses its height. */
            await page.setGeometry({ ...BENCH, height: 430 });
            await page.settle(4);
            assert.ok(Math.abs(await zoomNow() - 0.6675) < 0.0005,
                'the keyboard shrank the whole panel — the refusal in installFit is gone');

            /* And the person taps Save. `focusout`, with the keyboard still up. */
            await page.evalFn(() => { globalThis.location.hash = '#/live'; return true; });
            await page.settle(8);
            const after = await page.evalFn(() => {
                const app = document.querySelector('app-root');
                return { zoom: parseFloat(getComputedStyle(app).zoom), designWidth: app.offsetWidth };
            });
            assert.ok(Math.abs(after.zoom - 0.6675) < 0.0005,
                `navigating away with the keyboard up collapsed the panel to ${after.zoom} `
                + `at ${after.designWidth} design units (0.4 / 2400 is the measured failure)`);

            /* The keyboard closes. The fit is still the screen's, and still announced. */
            await page.setGeometry(BENCH);
            await page.settle(4);
            assert.ok(Math.abs(await zoomNow() - 0.6675) < 0.0005,
                'the panel did not come back after the keyboard closed');
        } finally {
            await page.close();
        }
    });
});
