/**
 * The two tokens item #57 reads, pinned where they live (Wave 4, #57).
 *
 * `src/components/ui-screensaver.js` imports `lit` and cannot be imported under node at
 * all, so everything about the ELEMENT is asserted in `test/render/ui-screensaver.render.test.mjs`
 * against a real engine. What is testable here is the other half of the deliverable:
 * the two declarations in `styles/tokens.css` that the component reads by name.
 *
 * WHY THIS FILE EXISTS AT ALL, and it is not defensive programming. `styles/tokens.css`
 * is a SHARED file: twenty builders run in parallel under a whole-file-write rule, and a
 * token another builder's rewrite drops is exactly the kind of thing no test goes red
 * for. The failure that would follow is the worst shape a screensaver has:
 * `background-color: var(--ui-blackout)` with no declaration behind it computes to
 * `transparent`, so the blank goes UP, reports itself active, blocks every press
 * underneath it — and paints nothing. A transparent screensaver looks like a frozen
 * screen.
 *
 * The render suite cannot catch that on its own either: it asserts `rgb(0, 0, 0)`, which
 * is right, but a reader of a red render test learns "the blank is not black", not "your
 * merge dropped a token". This says which file and which line.
 *
 * Both are read as PRODUCED ARTIFACTS — the declarations in the shipped sheet — which is
 * the same shape as `test/base-conventions.test.mjs`'s two cross-checks, and is not a
 * source-text assertion about behaviour.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const tokensCss = readFileSync(
    fileURLToPath(new URL('../styles/tokens.css', import.meta.url)),
    'utf8',
);

/** Comments stripped first: tokens.css quotes selectors and values inside its prose. */
const stripBlockComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const declaration = (token) => new RegExp(`^\\s*${token}\\s*:\\s*([^;]+);`, 'm');

test('--ui-blackout is declared, and it is the same value in BOTH theme blocks', () => {
    /* D10 — "fully black, one owner: the skin" (SCOPE.md:218). The sameness is the
     * decision, not an oversight: a blanked screen does not follow the theme, which is
     * why the blank cannot be --ui-canvas (#e8eaeb in light, #090d10 in dark) and why
     * this token is the one colour in the sheet that is deliberately identical on both
     * sides of the seam. */
    const css = stripBlockComments(tokensCss);
    const darkIndex = css.indexOf('[data-theme="dark"]');
    assert.ok(darkIndex > 0, 'tokens.css has no dark block');

    const light = css.slice(0, darkIndex).match(declaration('--ui-blackout'));
    const dark = css.slice(darkIndex).match(declaration('--ui-blackout'));

    assert.ok(light, '--ui-blackout is missing from the light block — ui-screensaver would paint transparent');
    assert.ok(dark, '--ui-blackout is missing from the dark block — ui-screensaver would paint transparent');
    assert.equal(light[1].trim(), dark[1].trim(),
        'D10 is "fully black" in both themes; a theme-varying blank is a different decision');
});

test('--ui-z-blackout is on the z scale and sits above every other layer on it', () => {
    /* Slate's own numbers, read read-only: the screensaver div is z-index 10000
     * (ui.js:1412), the fullscreen prompt is 10000 (index.html:645) and the app toast is
     * 10001 (index.html:657) — so on those numbers a toast paints ON a blanked screen.
     * The top layer is the real mechanism; this number is what orders the box in a
     * WebView with no popover support, and it only means anything if it is the largest. */
    const css = stripBlockComments(tokensCss);
    const value = (token) => {
        const match = css.match(declaration(token));
        assert.ok(match, `${token} is not declared in styles/tokens.css`);
        return Number.parseInt(match[1].trim(), 10);
    };

    const blackout = value('--ui-z-blackout');
    for (const other of ['--ui-z-sticky', '--ui-z-overlay', '--ui-z-menu', '--ui-z-toast']) {
        assert.ok(blackout > value(other),
            `${other} is at or above --ui-z-blackout: something can paint on a blanked screen`);
    }
});

test('the z scale is theme-invariant — the blackout layer is declared exactly once', () => {
    /* Geometry, type, motion, z-index and density appear once in this sheet by design
     * (tokens.css's own dark-block header). A second declaration would be a theme-varying
     * stacking order, which is not a thing. */
    const css = stripBlockComments(tokensCss);
    const hits = css.match(/^\s*--ui-z-blackout\s*:/gm) || [];
    assert.equal(hits.length, 1, `--ui-z-blackout declared ${hits.length} times`);
});
