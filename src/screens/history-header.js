/**
 * <history-header>, the History screen's header band, and the whole of bug H3.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

export class HistoryHeader extends UiElement {
    static styles = [css`
        :host {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: var(--ui-space-4);
            padding-inline: var(--ui-band-inset);
            background-color: var(--ui-bar);
            min-inline-size: 0;
        }

        .back {
            flex: 0 0 auto;
        }

        .picker {
            flex: 1 1 0;
            min-inline-size: min-content;
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: var(--ui-space-3);
        }

        .tabs {
            flex: 0 1 auto;
            min-inline-size: calc(3 * var(--ui-hit-min) + 2 * var(--ui-space-3));
        }

        :host,
        .back,
        .picker,
        .tabs {
            position: static;
        }
    `];

    render() {
        return html`
            <div class="back" id="back" part="back"><slot name="back"></slot></div>
            <div class="picker" id="picker-a" part="picker-a"><slot name="picker-a"></slot></div>
            <div class="picker" id="picker-b" part="picker-b"><slot name="picker-b"></slot></div>
            <div class="tabs" id="tabs" part="tabs"><slot name="tabs"></slot></div>
        `;
    }
}

customElements.define('history-header', HistoryHeader);
