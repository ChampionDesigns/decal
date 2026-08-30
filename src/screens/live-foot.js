/**
 * <live-foot>, the Live screen's foot band.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

export class LiveFoot extends UiElement {
    static styles = [css`
        :host {
            display: grid;
            grid-template-rows: minmax(0, 1fr);

            min-block-size: max(var(--ui-live-foot-min-h), var(--ui-live-foot-share));

            padding: var(--ui-space-3) var(--ui-space-4) var(--ui-space-5);
            background-color: var(--ui-fascia);
            min-inline-size: 0;
        }

        .band {
            display: grid;
            grid-template-rows: auto;

            align-content: safe end;
            gap: var(--ui-space-2);
            min-block-size: 0;
            overflow: auto;
        }

        ::slotted(*) {
            margin: 0;
        }
    `];

    render() {
        return html`<div class="band" part="band"><slot></slot></div>`;
    }
}

customElements.define('live-foot', LiveFoot);
