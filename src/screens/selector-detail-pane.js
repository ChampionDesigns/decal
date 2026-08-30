/**
 * <selector-detail-pane>, column 2 of the Profile selector.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

export class SelectorDetailPane extends UiElement {
    static styles = [css`
        /* NO BACKTICK IN THIS TEMPLATE, comment or not: one ends the tagged template
         * where it stands and the file stops parsing as JavaScript some way further on. */
        :host {
            display: grid;
            grid-template-rows:
                var(--ui-selector-band-h)
                auto
                minmax(0, 1fr)
                var(--ui-selector-notes-share);
            gap: var(--ui-space-3);
            padding: var(--ui-space-5);
            background-color: var(--ui-fascia);
            min-inline-size: 0;
            min-block-size: 0;
        }

        slot[name="title"],
        slot[name="summary"],
        slot[name="chart"] {
            display: contents;
        }

        #notes {
            overflow-y: auto;
            scrollbar-width: thin;
            min-block-size: var(--ui-selector-notes-min-h);
            min-inline-size: 0;
        }
    `];

    render() {
        return html`
            <slot name="title"></slot>
            <slot name="summary"></slot>
            <slot name="chart"></slot>
            <div id="notes" part="notes"><slot name="notes"></slot></div>
        `;
    }
}

customElements.define('selector-detail-pane', SelectorDetailPane);
