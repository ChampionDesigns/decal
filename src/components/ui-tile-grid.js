/**
 * A grid of equal tiles.
 */

import { css, html } from 'lit';
import { UiElement } from 'src/components/base.js';

export class UiTileGrid extends UiElement {
    static properties = {
        /** Accessible name. With one, the grid becomes a labelled group. */
        label: { type: String },
    };

    static styles = [css`
        :host {
            display: grid;

            grid-template-columns: repeat(auto-fill, minmax(min(var(--_ui-tile-grid-min), 100%), 1fr));
            gap: var(--_ui-tile-grid-gap);

            align-content: start;

            min-inline-size: 0;

            --_ui-tile-grid-min: 280px;
            --_ui-tile-grid-gap: var(--ui-space-3);
        }

        slot {
            display: contents;
        }
    `];

    #authorRole = null;
    #authorLabel = null;
    #captured = false;

    constructor() {
        super();
        this.label = '';
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.#captured) {
            this.#authorRole = this.getAttribute('role');
            this.#authorLabel = this.getAttribute('aria-label');
            this.#captured = true;
        }
    }

    updated(changed) {
        super.updated?.(changed);

        if (this.#authorRole === null) {
            if (this.label) this.setAttribute('role', 'group');
            else this.removeAttribute('role');
        }

        /* NAME. Clearing this component's label restores the author's, and never
         * deletes it. */
        if (this.label) this.setAttribute('aria-label', this.label);
        else if (this.#authorLabel !== null) this.setAttribute('aria-label', this.#authorLabel);
        else this.removeAttribute('aria-label');
    }

    render() {
        /* One element in this root, and it is the slot. No wrapper, no part, no
         * paint: everything visible in a tile grid is a tile, and a tile is the
         * consumer's. */
        return html`<slot></slot>`;
    }
}

customElements.define('ui-tile-grid', UiTileGrid);
