/**
 * <editor-settings-panel>, the editor's Settings panel.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

export const EDITOR_FIELD_TRACK_MIN_PX = 268;

/** Below this, `1fr 1fr 2fr` becomes `1fr 1fr`. 4 * 268 + 2 * 18 + 2 * 28. */
export const EDITOR_SETTINGS_COLLAPSE_2UP_PX = 1164;

/** Below this, `1fr 1fr` becomes `1fr`. 2 * 268 + 18 + 2 * 28. */
export const EDITOR_SETTINGS_COLLAPSE_1UP_PX = 610;

export class EditorSettingsPanel extends UiElement {
    static styles = [css`
        :host {
            display: block;
            block-size: 100%;
            min-block-size: 0;
            min-inline-size: 0;
        }

        #panel {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 2fr);
            align-content: start;
            gap: var(--ui-space-4);
            padding: var(--ui-space-6);
            block-size: 100%;
            min-block-size: var(--ui-editor-field-min-h);
            min-inline-size: 0;
            overflow-y: auto;
        }

        /* The slot is not the grid item — the slotted row is. See editor-body.js for
         * why that matters to a floor. */
        slot {
            display: contents;
        }

        ::slotted(*) {
            min-inline-size: 0;
        }

        @container (inline-size < 1164px) {
            #panel {
                grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            }
        }

        @container (inline-size < 610px) {
            #panel {
                grid-template-columns: minmax(0, 1fr);
            }
        }
    `];

    render() {
        return html`
            <div id="panel" part="panel">
                <slot></slot>
            </div>
        `;
    }
}

customElements.define('editor-settings-panel', EditorSettingsPanel);
