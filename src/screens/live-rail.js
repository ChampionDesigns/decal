/**
 * <live-rail>, the Live screen's settings rail.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

export class LiveRail extends UiElement {
    static styles = [css`
        :host {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: stretch;

            gap: var(--ui-space-6);

            padding: var(--ui-space-5) var(--ui-space-6);
            background-color: var(--ui-fascia);

            min-block-size: 0;

            overflow-y: auto;
            overscroll-behavior: contain;
            scrollbar-width: thin;

            contain: paint;
        }

        /* NO CORRECTION MARGINS - see the header. A row is its own height and stays
         * it; nothing in the rail is stretched to make a total come out right. */
        ::slotted(*) {
            margin: 0;
            flex: 0 0 auto;
        }
    `];

    render() {
        return html`<slot></slot>`;
    }
}

customElements.define('live-rail', LiveRail);
