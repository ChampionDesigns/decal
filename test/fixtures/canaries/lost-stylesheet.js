/**
 * CANARY - deliberately violates "no component whose css template vanished from the
 * scan".
 *
 * A BACKTICK INSIDE A css TAGGED TEMPLATE CLOSES IT. Every rule after that point simply
 * stops applying, so every Gate C rule inside the lost tail has nothing left to violate
 * and the build goes green over a component that is no longer painting. Measured three
 * times in one session on 23 Aug 2026; the third time it produced a passing gate and a
 * broken screen, which is why this canary exists.
 *
 * IT HAS TO PARSE, AND THE FIRST VERSION DID NOT. This file is under `test/`, so
 * `node --test test/` imports it (README, "the node-safe shape") - and a stray backtick
 * usually leaves a SYNTAX ERROR behind it, which is one failing "test" for a file that
 * contains none. So the tail here is arranged to be legal JavaScript: the closing
 * backtick ends the css template, the ` + ` makes what follows a second template
 * concatenated onto it, and the whole expression is a string.
 *
 * THAT IS ALSO THE REAL SHAPE OF THE ACCIDENT rather than a contrivance around it. What
 * happened three times was a backtick inside a COMMENT, in a file that went on parsing -
 * which is exactly why it was invisible: `node --check` was happy, the suite was green,
 * and the glass was broken. A canary that could only be written as a syntax error would
 * be a canary for a defect the compiler already catches.
 */
/* Node-safe shape - see test/fixtures/canaries/README.md, "the node-safe shape". */

export let CanaryLostStylesheet;

if (typeof HTMLElement !== 'undefined') {

const { css, html } = await import('lit');
const { UiElement } = await import('../../../src/components/base.js');

CanaryLostStylesheet = class CanaryLostStylesheet extends UiElement {
    static styles = [
        css`
            .before {
                color: var(--ui-ink);
            }
            /* the stray ` + ` closes the template, and everything below is lost */
            :host {
                display: block;
                padding: var(--ui-space-3);
            }
        `,
    ];

    render() {
        return html`<slot></slot>`;
    }
};

}
