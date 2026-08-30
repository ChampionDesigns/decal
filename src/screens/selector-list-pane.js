/**
 * <selector-list-pane>, column 1 of the Profile selector.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

export class SelectorListPane extends UiElement {
    static styles = [css`
        /* NO BACKTICK IN THIS TEMPLATE, comment or not: one ends the tagged template
         * where it stands and the file stops parsing as JavaScript some way further on. */
        :host {
            display: grid;
            grid-template-rows: var(--ui-selector-band-h) auto minmax(0, 1fr) auto;
            gap: var(--ui-space-3);
            padding: var(--ui-space-5);
            background-color: var(--ui-fascia);
            min-inline-size: 0;
            min-block-size: 0;
        }

        slot[name="toolbar"],
        slot[name="filter"],
        slot[name="favourites"] {
            display: contents;
        }

        #list {
            overflow-y: auto;
            scrollbar-width: thin;
            min-block-size: var(--ui-selector-list-min-h);
            min-inline-size: 0;
        }
    `];

    render() {
        return html`
            <slot name="toolbar"></slot>
            <slot name="filter"></slot>
            <div id="list" part="list"><slot name="list"></slot></div>
            <slot name="favourites"></slot>
        `;
    }
}

customElements.define('selector-list-pane', SelectorListPane);
