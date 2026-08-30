/**
 * CANARY - deliberately violates "nothing sizes itself from the viewport".
 *
 * src/lib/app-fit.js draws the app at a 1200-unit reference height and scales it onto
 * the screen, so the viewport and the app container stopped being the same number: on
 * the bench tablet a viewport unit resolves against 801 layout units where the design
 * is written in 1200. This is not a style preference. `--ui-live-foot-share: 18dvh`
 * answered 144.2 units where the design says 216 - a whole phase row, lost silently,
 * on the one screen that matters.
 *
 * The four declarations below are the four shapes the mistake takes: a fraction of the
 * viewport height, one of the width, a vmin, and one buried in a calc() where it reads
 * like arithmetic rather than a unit. The `100dvh` inside a var() fallback in the same
 * block is NOT a violation and must not be reported - it is the pre-fit fallback that
 * keeps a script-blocked WebView showing a page, and a guard that fired on it would be
 * a guard nobody could satisfy.
 */
/* Node-safe shape - see test/fixtures/canaries/README.md, "the node-safe shape". */

export let CanaryViewportUnit;

if (typeof HTMLElement !== 'undefined') {

const { css, html } = await import('lit');
const { UiElement } = await import('../../../src/components/base.js');

CanaryViewportUnit = class CanaryViewportUnit extends UiElement {
    static styles = [
        css`
            :host {
                /* the original bug, in its original shape */
                block-size: 18dvh;
                /* the width half of the same mistake */
                inline-size: 40vw;
                /* and the one that picks whichever axis is smaller */
                padding-block: 2vmin;
            }

            .band {
                /* buried in arithmetic, where it reads as a number and not a unit */
                min-block-size: calc(var(--ui-space-3) + 12vh);
                /* NOT a violation: the pre-fit fallback, and the reason a WebView with
                 * the inline script blocked still gets a page rather than a blank one. */
                max-block-size: var(--ui-app-h, 100dvh);
            }
        `,
    ];

    render() {
        return html`<div class="band"><slot></slot></div>`;
    }
};

}
