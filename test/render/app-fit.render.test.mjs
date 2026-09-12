/**
 * The fit, in a real engine, on the real page.
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
        const seen = await forcedTo('/test/fixtures/canaries/scalable-viewport.html', 3);
        assert.equal(seen.scale, 3,
            'the canary did not take a page scale of 3, so this rig can no longer observe the '
            + 'trap and the test above proves nothing. Fix the rig, do not delete the canary.');
        assert.ok(seen.visualWidth < seen.layoutWidth,
            'the canary scaled without shrinking its visual viewport — the rig is not measuring page scale');
    });
});

describe('keyboard navigation holds the blur frame and recovers after closure', () => {
    test('focus, keyboard, navigate away — the blur frame holds and closure restores the fit', async () => {
        const page = await browser.newPage({ geometry: BENCH });
        try {
            await page.goto('/index.html');
            await page.evalFn(() => { globalThis.location.hash = '#/selector'; return true; });
            await page.settle(8);

            const zoomNow = () => page.evalFn(() =>
                parseFloat(getComputedStyle(document.querySelector('app-root')).zoom));
            assert.ok(Math.abs(await zoomNow() - 0.6675) < 0.0005, 'the bench fit did not apply');

            /* The selector module arrives asynchronously, and a hidden dialog field
             * cannot establish the keyboard precondition: wait for a focusable filter
             * rather than for a fixed number of frames. */
            const ready = await page.evalFn(async () => {
                const deadline = performance.now() + 5000;
                while (performance.now() < deadline) {
                    const app = document.querySelector('app-root');
                    const selector = app?.shadowRoot?.querySelector('selector-screen');
                    const field = selector?.shadowRoot?.querySelector('#filter')
                        ?.field?.shadowRoot?.querySelector('input');
                    if (app?.phase === 'ready' && field?.isConnected && !field.disabled
                        && field.getBoundingClientRect().height > 0) return true;
                    await new Promise(requestAnimationFrame);
                }
                return false;
            });
            assert.ok(ready, 'the selector filter did not become visible within 5 seconds');
            await page.settle(4);
            const focused = await page.evalFn(() => {
                const field = document.querySelector('app-root')?.shadowRoot
                    ?.querySelector('selector-screen')?.shadowRoot?.querySelector('#filter')
                    ?.field?.shadowRoot?.querySelector('input');
                field?.focus();
                let active = document.activeElement;
                while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
                return Boolean(field && active === field);
            });
            assert.ok(focused, 'the visible profile filter did not accept focus');

            /* The keyboard opens: the layout viewport loses its height. */
            await page.setGeometry({ ...BENCH, height: 430 });
            await page.settle(4);
            assert.ok(Math.abs(await zoomNow() - 0.6675) < 0.0005,
                'the keyboard shrank the whole panel — the refusal in installFit is gone');

            /* The person taps Cancel. Capture the focusout frame itself, before the
             * settled-height release or route loading can elapse. */
            await page.evalFn(() => {
                window.__fitBlur = null;
                document.addEventListener('focusout', (event) => {
                    queueMicrotask(() => {
                        const app = document.querySelector('app-root');
                        window.__fitBlur = {
                            zoom: parseFloat(getComputedStyle(app).zoom),
                            designWidth: app.offsetWidth,
                        };
                    });
                }, { once: true });
                return true;
            });
            await page.click('app-root >>> selector-screen >>> #cancel >>> #btn');
            const blurred = await page.evalFn(() => window.__fitBlur);
            assert.ok(blurred, 'Cancel did not produce a focusout frame');
            assert.ok(Math.abs(blurred.zoom - 0.6675) < 0.0005,
                `focusout immediately collapsed the panel to ${blurred.zoom} at ${blurred.designWidth} design units`);
            const navigated = await page.evalFn(async () => {
                const deadline = performance.now() + 5000;
                while (performance.now() < deadline) {
                    const app = document.querySelector('app-root');
                    if (app?.route === 'live' && app.shadowRoot?.querySelector('live-screen')) return true;
                    await new Promise(requestAnimationFrame);
                }
                return false;
            });
            assert.ok(navigated, 'navigation did not replace the focused selector with Live');
            /* The emulated keyboard closes after navigation. Either ordering against
             * the settled-height release must restore the fit. */
            await page.setGeometry(BENCH);
            await page.settle(4);
            assert.ok(Math.abs(await zoomNow() - 0.6675) < 0.0005,
                'the panel did not come back after the keyboard closed');
        } finally {
            await page.close();
        }
    });
});
