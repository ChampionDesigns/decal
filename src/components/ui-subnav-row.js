/**
 * A row of sub-navigation tabs within a screen.
 */

import { css, html, nothing } from 'lit';
import { UiElement, selectionSurface } from 'src/components/base.js';

export class UiSubnavRow extends UiElement {
    static properties = {
        /** The current page in the sub-category column. Renders aria-current="true". */
        current: { type: Boolean, reflect: true },
        /** Paint only - the base dims the host; the control refuses the press. */
        disabled: { type: Boolean, reflect: true },
        /** An opaque id the consumer chose, echoed in the navigate event. */
        value: { type: String },
        summary: { type: String },
    };

    static styles = [css`
        :host {
            background-color: var(--ui-fascia);
        }

        .row {
            display: flex;
            align-items: center;

            gap: var(--ui-space-1);

            inline-size: 100%;
            block-size: var(--ui-nav-row);

            padding-block: 0;
            padding-inline: var(--ui-space-5);

            border: 0;

            border-radius: 0;

            background-color: transparent;

            color: var(--ui-muted);

            font-family: inherit;
            line-height: inherit;
            font-size: var(--ui-text-nav);
            font-weight: var(--ui-weight-regular);

            /* A nav row is read left to right; the UA centres button text. */
            text-align: start;

            appearance: none;
            cursor: pointer;
        }

        @media (hover: hover) {
            .row:where(:hover:not(:disabled)) {
                background-color: var(--ui-key);
                color: var(--ui-text);
            }
        }

        .row:where(:active:not(:disabled)) {
            background-color: var(--ui-key-on);
        }

        .row:where(:disabled) {
            opacity: 1;
            cursor: default;
        }

        .label {
            min-inline-size: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .summary {
            flex: none;
            margin-inline-start: auto;
            padding-inline-start: var(--ui-space-3);
            white-space: nowrap;
            opacity: var(--ui-opacity-dim);
            font-variant-numeric: tabular-nums;
        }
    `,
    selectionSurface];

    constructor() {
        super();
        this.current = false;
        this.disabled = false;
        this.value = '';
        this.summary = '';
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('focus-ring')) this.setAttribute('focus-ring', 'inset');
    }

    render() {

        const summary = String(this.summary ?? '').trim();
        return html`<button
            id="row"
            class="row"
            type="button"
            aria-current=${this.current ? 'true' : nothing}
            ?disabled=${this.disabled}
            @click=${this.#activate}
        ><span id="label" class="label"><slot></slot></span>${summary
            ? html`<span id="summary" class="summary">${summary}</span>`
            : nothing}</button>`;
    }

    #activate() {
        if (this.disabled) return;
        this.dispatchEvent(new CustomEvent('navigate', {
            bubbles: true,
            composed: true,
            detail: { value: this.value },
        }));
    }
}

customElements.define('ui-subnav-row', UiSubnavRow);
