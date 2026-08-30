/**
 * The key face.
 */

import { css, html, nothing } from 'lit';
import { UiElement, hitArea, visuallyHidden } from 'src/components/base.js';

export class UiKeycap extends UiElement {
    static properties = {
        /** Accessible name, for a face whose visible content is a bare glyph. */
        label: { type: String },
    };

    static styles = [hitArea, visuallyHidden, css`
        :host {
            container-type: normal;
            display: inline-grid;
        }

        .cap {
            display: inline-grid;
            place-items: center;

            min-inline-size: var(--ui-hit-min);
            block-size: var(--_ui-keycap-block, var(--ui-hit-min));
            padding-inline: var(--ui-space-2);

            border: var(--ui-border-w) solid var(--ui-line-strong);
            border-block-end-width: var(--_ui-keycap-skirt, calc(3 * var(--ui-border-w)));
            border-radius: var(--ui-radius);

            background-color: var(--ui-key);
            color: var(--ui-text);

            font-family: var(--ui-font-family);
            font-size: var(--_ui-keycap-size, var(--ui-text-base));
            font-weight: var(--_ui-keycap-weight, var(--ui-weight-medium));

            line-height: 1;
            white-space: nowrap;
        }

        /* The glyph's own box, so the label property has something to hide and
         * something stable to query. Not a paint surface. */
        .glyph {
            display: block;
        }

    `];

    constructor() {
        super();
        this.label = '';
    }

    render() {
        const named = Boolean(this.label);
        return html`<kbd id="cap" class="cap hit-overlay"
            ><span id="glyph" class="glyph" aria-hidden=${named ? 'true' : nothing}><slot></slot></span
            >${named ? html`<span id="a11y" class="a11y">${this.label}</span>` : nothing}</kbd>`;
    }
}

customElements.define('ui-keycap', UiKeycap);
