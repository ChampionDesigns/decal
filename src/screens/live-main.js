/**
 * <live-main>, column 2 of the Live skeleton: gauges, chart, GHC strip.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

export class LiveMain extends UiElement {
    static styles = [css`
        :host {
            display: grid;
            grid-template-rows: minmax(0, 1fr);
            gap: var(--ui-space-4);

            padding: var(--ui-space-5);
            background-color: var(--ui-fascia);
            min-inline-size: 0;
        }

        /* Stated rather than inherited from the UA sheet: these slots are transparent
         * on purpose, because the grid items are what is slotted INTO them. */
        slot {
            display: contents;
        }

        ::slotted(*) {
            margin: 0;
        }
    `];

    render() {
        return html`
            <slot name="chart"></slot>
            <slot name="ghc"></slot>
        `;
    }
}

customElements.define('live-main', LiveMain);
