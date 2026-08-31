/**
 * A responsive grid of cards that reads its own width rather than a breakpoint.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';

export const CARD_GRID_COLUMNS = Object.freeze([1, 2]);

/** The 2-up default, named so a test and a consumer read the same constant. */
export const CARD_GRID_DEFAULT_COLUMNS = 2;

export class UiCardGrid extends UiElement {
    static properties = {
        /** 1 or 2. 2 is the row's "2-up card layout"; 1 is the update list's stack. */
        columns: { type: Number, reflect: true },

        label: { type: String },
    };

    static styles = [css`
        :host {
            --_ui-card-grid-min: 280px;

            --_ui-card-grid-gap: var(--ui-space-3);
        }

        /* THE GRID. Every declaration is a token, a fraction or the column floor; there is
         * no viewport unit, no @media, and no colour of any kind. */
        .grid {
            display: grid;

            gap: var(--_ui-card-grid-gap);

            grid-auto-flow: row;

            align-items: stretch;

            grid-template-columns: repeat(auto-fill, minmax(
                max(
                    min(100%, var(--_ui-card-grid-min)),
                    calc((100% - var(--_ui-card-grid-gap)) / 2)
                ),
                1fr
            ));
        }

        :host([columns="1"]) .grid {
            grid-template-columns: minmax(0, 1fr);
        }

        .grid slot {
            display: contents;
        }
    `];

    constructor() {
        super();
        this.columns = CARD_GRID_DEFAULT_COLUMNS;
        this.label = '';
    }

    willUpdate(changed) {
        if (changed.has('columns')) {
            const raw = Number(this.columns);
            const next = CARD_GRID_COLUMNS.includes(raw) ? raw : CARD_GRID_DEFAULT_COLUMNS;
            if (next !== this.columns) this.columns = next;
        }
    }

    render() {
        const named = Boolean(this.label);
        return html`<div
            id="grid"
            class="grid"
            role=${named ? 'group' : nothing}
            aria-label=${named ? this.label : nothing}
        ><slot></slot></div>`;
    }
}

customElements.define('ui-card-grid', UiCardGrid);
