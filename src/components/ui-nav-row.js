/**
 * The nav row.
 */

import { css, html, nothing } from 'lit';

import { UiElement, selectionSurface } from 'src/components/base.js';

export class UiNavRow extends UiElement {
    static properties = {
        current: { type: Boolean, reflect: true },
        disabled: { type: Boolean, reflect: true },
    };

    static styles = [
        css`
            :host {
                display: grid;

                min-block-size: var(--ui-nav-row);

                background-color: var(--ui-fascia);

            }

            .row {
                display: flex;
                align-items: center;
                gap: var(--ui-space-2);
                inline-size: 100%;

                min-inline-size: 0;

                min-block-size: var(--ui-nav-row);

                padding-block: 0;
                padding-inline: var(--ui-space-5);

                border: 0;

                border-radius: 0;

                background-color: var(--ui-fascia);

                color: var(--ui-muted);

                font-family: inherit;
                font-size: var(--ui-text-nav);
                font-weight: var(--ui-weight-regular);
                line-height: inherit;

                /* settings.html:30 text-left, read read-only - outside the corpus's
                 * appearance surface. A UA button centres its label. */
                text-align: start;

                cursor: pointer;
            }

            .row:where(:disabled) {
                opacity: 1;
                cursor: default;
            }

            .label {
                flex: 1 1 auto;
                min-inline-size: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            @media (hover: hover) {
                .row:not([aria-current="true"]):hover {
                    background-color: var(--ui-key);
                    color: var(--ui-text);
                }
            }
        `,
        selectionSurface,
    ];

    constructor() {
        super();
        this.current = false;
        this.disabled = false;
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('focus-ring')) this.setAttribute('focus-ring', 'inset');
    }

    /** The real control - what a test queries and what a column moves focus to. */
    get control() {
        return this.renderRoot?.querySelector?.('#row') ?? null;
    }

    #onPress = () => {
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { current: this.current },
            bubbles: true,
            composed: true,
        }));
    };

    render() {
        return html`
            <button
                id="row"
                class="row"
                type="button"
                aria-current=${this.current ? 'true' : nothing}
                ?disabled=${this.disabled}
                @click=${this.#onPress}
            ><span id="label" class="label"><slot></slot></span></button>
        `;
    }
}

customElements.define('ui-nav-row', UiNavRow);
