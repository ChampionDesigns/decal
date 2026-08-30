/**
 * <settings-nav-column>, and it is BOTH nav columns.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';

export class SettingsNavColumn extends UiElement {
    static styles = [seams, css`

        :host {
            display: grid;
            grid-template-rows: minmax(0, 1fr);
            background-color: var(--ui-fascia);
            min-inline-size: 0;
            min-block-size: 0;
        }

        #list {
            grid-row: 1;
            overflow-y: auto;
            min-block-size: var(--ui-settings-nav-min-h);
            min-inline-size: 0;
        }

        /* THE SEAMED GRID. Rows are as tall as they are (align-content: start), the
         * gaps between them are the separators, and the leftover below is the region's
         * fascia rather than a slab of ink. */
        #rows {
            align-content: start;
            min-inline-size: 0;
        }
    `];

    render() {
        return html`
            <div id="list" part="list">
                <div id="rows" part="rows" class="seam-grid seam-rows seam-line">
                    <slot></slot>
                </div>
            </div>
        `;
    }
}

customElements.define('settings-nav-column', SettingsNavColumn);
