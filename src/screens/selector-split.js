/**
 * <selector-split>, the Profile selector's two-pane body.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';

export const SPLIT_COLLAPSE_PX = 900;

export const SPLIT_LIST_TRACK = 'minmax(var(--ui-selector-list-min), var(--ui-selector-list-share))';

export class SelectorSplit extends UiElement {
    static styles = [seams, css`

        :host {
            display: block;
            block-size: 100%;
            min-block-size: 0;
            min-inline-size: 0;
        }

        #grid {
            gap: var(--ui-seam-split);
            block-size: 100%;
            min-block-size: 0;
            grid-template-columns: minmax(var(--ui-selector-list-min), var(--ui-selector-list-share)) minmax(0, 1fr);
            align-items: stretch;
        }

        slot {
            display: contents;
        }

        @container (inline-size < 900px) {
            #grid {
                grid-template-columns: minmax(0, 1fr);
            }
        }
    `];

    render() {
        return html`
            <div id="grid" part="grid" class="seam-grid seam-strong">
                <slot name="list"></slot>
                <slot name="detail"></slot>
            </div>
        `;
    }
}

customElements.define('selector-split', SelectorSplit);
