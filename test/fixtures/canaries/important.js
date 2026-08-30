/**
 * CANARY - deliberately violates "zero !important in component styles"
 * (LAYOUT_SPEC_DRAFT.md §2.1 Rule 3). Nothing can reach into a shadow root, so an
 * !important here can only be beating the component's own base rules - which is the
 * habit the rewrite exists to end (268 in slate-shell.css, 96 in slate-components.css).
 */
/* Node-safe shape - see test/fixtures/canaries/README.md, "the node-safe shape".
 * A no-op under `node --test`, unchanged in the browser, and the css template below
 * stays exactly where a static guard can parse it. */

export let CanaryImportant;

if (typeof HTMLElement !== 'undefined') {

const { css, html } = await import('lit');
const { UiElement } = await import('../../../src/components/base.js');

CanaryImportant = class CanaryImportant extends UiElement {
    static styles = [
        css`
            :host {
                display: flex !important;
            }

            button {
                outline: none !important;
            }
        `,
    ];

    render() {
        return html`<button type="button"><slot></slot></button>`;
    }
};

}
