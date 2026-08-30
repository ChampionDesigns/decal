/**
 * <editor-body>, row 2 of the profile editor.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

export const EDITOR_PANEL_SLOTS = Object.freeze(['steps', 'settings', 'review']);

export class EditorBody extends UiElement {
    static styles = [css`
        :host {
            display: block;
            block-size: 100%;
            min-block-size: 0;
            min-inline-size: 0;
        }

        #stack {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: minmax(0, 1fr);
            block-size: 100%;
            min-block-size: 0;
            min-inline-size: 0;
        }

        slot {
            display: contents;
        }

        slot[name="steps"]::slotted(*),
        slot[name="settings"]::slotted(*),
        slot[name="review"]::slotted(*) {
            grid-column: 1;
            grid-row: 1;
            min-inline-size: 0;
            min-block-size: 0;
        }
    `];

    render() {
        return html`
            <div id="stack">
                <slot name="steps"></slot>
                <slot name="settings"></slot>
                <slot name="review"></slot>
            </div>
        `;
    }
}

customElements.define('editor-body', EditorBody);
