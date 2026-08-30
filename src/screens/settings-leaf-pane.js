/**
 * <settings-leaf-pane>, column 3 of the Settings body.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

export class SettingsLeafPane extends UiElement {
    static styles = [css`
        :host {
            display: block;
            overflow-y: auto;
            padding-block: var(--ui-space-6);
            padding-inline-start: var(--ui-settings-pane-inset-start);
            padding-inline-end: var(--ui-settings-pane-inset-end);
            background-color: var(--ui-fascia);
            min-block-size: var(--ui-settings-leaf-min-h);
            min-inline-size: 0;
        }

        #leaf {
            inline-size: 100%;
        }
    `];

    render() {
        return html`<div id="leaf" part="leaf"><slot></slot></div>`;
    }
}

customElements.define('settings-leaf-pane', SettingsLeafPane);
