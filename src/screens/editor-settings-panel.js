/**
 * <editor-settings-panel>, the editor's Settings panel.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

/** The narrowest a settings track may be: one row's widest control. */
export const EDITOR_FIELD_TRACK_MIN_PX = 320;

/**
 * What the second column spends on the divider between them — the line, and the space
 * after it. The caller draws both; see the `.column + .column` rule in editor-screen.js.
 */
export const EDITOR_SETTINGS_COLUMN_INSET_PX = 1 + 40;

/**
 * Below this, `1fr 1fr` becomes `1fr`. The tracks are equal, so both are sized by the
 * column that pays for the divider: 2 * (320 + 41) + 40 + 2 * 28.
 */
export const EDITOR_SETTINGS_COLLAPSE_1UP_PX = 818;

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
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            align-content: start;
            gap: var(--ui-space-7);
            padding: var(--ui-space-6);
            block-size: 100%;
            min-block-size: var(--ui-editor-field-min-h);
            min-inline-size: 0;
            overflow-y: auto;

            /* The screen paints a seam ground and expects every region to cover it. */
            background-color: var(--ui-fascia);
        }

        /* The slot is not the grid item — the slotted row is. See editor-body.js for
         * why that matters to a floor. */
        slot {
            display: contents;
        }

        ::slotted(*) {
            min-inline-size: 0;
        }

        @container (inline-size < 818px) {
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
