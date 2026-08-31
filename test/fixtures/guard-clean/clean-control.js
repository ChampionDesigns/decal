/**
 * The NEGATIVE canary. Added item #4, and it is deliberately NOT in
 * test/fixtures/canaries/ — every file in there violates a rule on purpose, and this
 * one violates nothing.
 *
 * A guard that fires on everything is exactly as useless as one that fires on
 * nothing, and it fails in the direction that gets guards switched off. This file is
 * a component written the way the conventions say: colour from tokens, geometry from
 * tokens, a component-private property under the --_ui- prefix, a state treatment
 * from the selection dials, no !important, no @font-face — plus the shapes most
 * likely to trip a careless scanner:
 *
 *   - `color-mix(in srgb, currentColor var(--ui-selected-glow), transparent)`, the
 *     legitimate way to derive a colour, which contains the substring "color" and
 *     three var() references and must not be read as a literal;
 *   - `currentColor` and `transparent`, which are keywords, not palette;
 *   - a `content` string and a `grid-template-areas` value carrying words that are
 *     also CSS colour names ("plum", "linen");
 *   - `--_ui-hit-ink`, a private custom property carrying a LENGTH.
 *
 * guard must report zero violations here.
 */
/* Node-safe shape - see test/fixtures/canaries/README.md, "the node-safe shape". */

export let CleanControl;

if (typeof HTMLElement !== 'undefined') {

const { css, html } = await import('lit');
const { UiElement, hitArea, selectionSurface } = await import('../../../src/components/base.js');

CleanControl = class CleanControl extends UiElement {
    static styles = [
        hitArea,
        css`
            :host {
                --_ui-hit-ink: 8px;
                display: grid;
                grid-template-areas: "plum linen";
                gap: var(--ui-space-2);
            }

            .face {
                min-block-size: var(--ui-control-h);
                padding-inline: var(--ui-space-4);
                border: var(--ui-border-w) solid var(--ui-line);
                border-radius: var(--ui-radius);
                background-color: var(--ui-key);
                color: var(--ui-text);
                box-shadow: 0 0 0 0 currentColor;
                outline-color: transparent;
            }

            .face::after {
                content: "tomato, plum and linen are colour names and this is a string";
                text-shadow: 0 0 6px color-mix(in srgb, currentColor var(--ui-selected-glow), transparent);
            }
        `,
        selectionSurface,
    ];

    render() {
        return html`<button class="face hit-pad" type="button"><slot></slot></button>`;
    }
};

}
