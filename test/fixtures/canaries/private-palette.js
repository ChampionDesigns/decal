/**
 * CANARY - deliberately re-declares public --ui-* colour tokens inside a component
 * (guard 4; bug L12, where the Live screen re-declares the public palette three
 * times under private names). The names are public, the values are local: every
 * consumer downstream now reads a colour the token file does not control, and a
 * fork retargeting the template changes nothing here.
 *
 * Note the contrast with a LEGITIMATE private property: `--_ui-hit-ink` in
 * test/fixtures/base-fixture.js is component-internal, carries a LENGTH, and can
 * never be mistaken for a token because the guard scans for `var(--ui-`.
 */
/* Node-safe shape - see test/fixtures/canaries/README.md, "the node-safe shape".
 * A no-op under `node --test`, unchanged in the browser, and the css template below
 * stays exactly where a static guard can parse it. */

export let CanaryPrivatePalette;

if (typeof HTMLElement !== 'undefined') {

const { css, html } = await import('lit');
const { UiElement } = await import('../../../src/components/base.js');

CanaryPrivatePalette = class CanaryPrivatePalette extends UiElement {
    static styles = [
        css`
            :host {
                --ui-steel: #4488cc;
                --ui-selected-face: #223344;
                --ui-text: #ffffff;
            }
        `,
    ];

    render() {
        return html`<slot></slot>`;
    }
};

}
