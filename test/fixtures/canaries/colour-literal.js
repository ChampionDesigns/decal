/**
 * CANARY - deliberately violates the colour-literal rule (a8, guard guard 3).
 * A guard that does not fail on this file is not covering its target.
 * The violation is inside a `css` tagged template in a .js file, which is where all
 * authored component CSS lives in this tree.
 */
/* Node-safe shape - see test/fixtures/canaries/README.md, "the node-safe shape".
 * A no-op under `node --test`, unchanged in the browser, and the css template below
 * stays exactly where a static guard can parse it. */

export let CanaryColourLiteral;

if (typeof HTMLElement !== 'undefined') {

const { css, html } = await import('lit');
const { UiElement } = await import('../../../src/components/base.js');

CanaryColourLiteral = class CanaryColourLiteral extends UiElement {
    static styles = [
        css`
            :host {
                background-color: #ff0044;
                color: rgb(12 200 90);
                border-color: hsl(200 50% 40%);
            }
        `,
    ];

    render() {
        return html`<slot></slot>`;
    }
};

}
