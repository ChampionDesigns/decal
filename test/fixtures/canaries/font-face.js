/**
 * CANARY - deliberately declares an @font-face inside a component (guard rule 2;
 * Rule 2). Measured, not assumed: a face declared only in
 * a shadow root never registers - measureText('0123456789.') at 20px gave 105.00
 * (the unknown-family fallback) against 118.50 for the same face declared in the
 * document, with document.fonts.size === 0. Canvas text resolves fonts against the
 * DOCUMENT's registry, so this silently mis-measures every chart axis.
 */
/* Node-safe shape - see test/fixtures/canaries/README.md, "the node-safe shape".
 * A no-op under `node --test`, unchanged in the browser, and the css template below
 * stays exactly where a static guard can parse it. */

export let CanaryFontFace;

if (typeof HTMLElement !== 'undefined') {

const { css, html } = await import('lit');
const { UiElement } = await import('../../../src/components/base.js');

CanaryFontFace = class CanaryFontFace extends UiElement {
    static styles = [
        css`
            @font-face {
                font-family: "CanaryFace";
                src: url("../../../fonts/Geist-Variable.ttf") format("truetype");
            }

            :host {
                font-family: "CanaryFace", sans-serif;
            }
        `,
    ];

    render() {
        return html`<slot></slot>`;
    }
};

}
