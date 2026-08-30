/**
 * The locked value box.
 */

import { css, html, nothing } from 'lit';
import { UiElement, visuallyHidden } from 'src/components/base.js';

export class UiLockedValue extends UiElement {
    static properties = {
        /** Accessible name, for a box whose visible content is a bare reading. */
        label: { type: String },
    };

    static styles = [visuallyHidden, css`
        .box {
            display: flex;
            align-items: center;
            justify-content: center;

            min-block-size: var(--ui-control-h);

            padding-inline: var(--ui-space-3);

            border-width: var(--ui-border-w);
            border-style: dashed;
            border-color: var(--ui-line-strong);
            border-radius: var(--ui-radius);

            background-color: var(--ui-surface);
            color: var(--ui-muted);

            font-family: var(--ui-font-family);
            font-size: var(--ui-text-note);
            font-weight: var(--ui-weight-regular);

            letter-spacing: normal;
            text-align: center;
        }

        .text {
            display: block;
            min-inline-size: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

    `];

    constructor() {
        super();
        this.label = '';
    }

    render() {
        const named = Boolean(this.label);
        return html`<div id="box" class="box"
            ><span id="text" class="text" aria-hidden=${named ? 'true' : nothing}><slot></slot></span
            >${named ? html`<span id="a11y" class="a11y">${this.label}</span>` : nothing}</div>`;
    }
}

customElements.define('ui-locked-value', UiLockedValue);
