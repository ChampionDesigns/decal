/**
 * CANARY — the guard-blindness canary. Added by Wave 0a item #4.
 *
 * It carries TWO opposite traps in one file, because the two ways a guard stops
 * covering its target are opposite:
 *
 *   1. A REAL violation that a naive scan misses: a colour literal inside a `css`
 *      template that is itself inside a `${…}` interpolation of another `css`
 *      template. A scanner that finds the first backtick and searches for the next
 *      one never sees it.
 *
 *   2. FALSE violations a naive scan reports: this file writes #ff0000, rgb(1,2,3)
 *      and the word !important in PROSE — in comments, in a string, and in an
 *      identifier — exactly as src/components/base.js does when it documents why
 *      those things are never used. A guard that greps the raw file fails on the
 *      file that documents the rule, the fix for that is an exemption, and an
 *      exemption is how coverage dies. test/fixtures/canaries/README.md states this
 *      as construction note 1: strip comments before scanning.
 *
 * So the assertion over this file is exact: N violations, at these lines, and no
 * others.
 */
/* Node-safe shape - see test/fixtures/canaries/README.md, "the node-safe shape". */

export let CanaryHiddenLiteral;

/* Prose that must NOT be flagged: the old sheets set `color: #ff0000 !important`
 * and `background: rgb(1, 2, 3)` in 364 places; none of that is authored CSS here. */
const NOTE_ABOUT_IMPORTANT = 'never write display: flex !important; the base rules are :where()-wrapped';
const NOTE_ABOUT_COLOUR = 'the old value was #123456, replaced by var(--ui-steel)';

if (typeof HTMLElement !== 'undefined') {

const { css, html } = await import('lit');
const { UiElement } = await import('../../../src/components/base.js');

const emphasised = true;

CanaryHiddenLiteral = class CanaryHiddenLiteral extends UiElement {
    static styles = [
        css`
            /* A comment inside the template, also carrying #abcdef and !important. */
            :host {
                color: var(--ui-text);
            }

            ${emphasised ? css`
                .emphasis {
                    border-color: #00ff88;
                }
            ` : css``}

            .quoted::after {
                /* A string value that merely looks like a colour is not one. */
                content: "#ff0000";
            }
        `,
    ];

    render() {
        return html`<span class="quoted"><slot></slot></span>`;
    }
};

}

export { NOTE_ABOUT_IMPORTANT, NOTE_ABOUT_COLOUR };
