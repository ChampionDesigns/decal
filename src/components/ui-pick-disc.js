/**
 * Ui-pick-disc.
 */

import { css, html, nothing } from 'lit';

import { UiElement, selectionSurface, visuallyHidden } from 'src/components/base.js';

export class UiPickDisc extends UiElement {
    static properties = {
        selected: { type: Boolean, reflect: true },
        interactive: { type: Boolean, reflect: true },
        form: { type: String, reflect: true },
        /** Paint dims and input is refused. Reflected; the base dims the host. */
        disabled: { type: Boolean, reflect: true },
        /** Accessible name, for a disc whose visible content is a bare letter. */
        label: { type: String },
    };

    static styles = [
        visuallyHidden,
        css`
            :host {
                container-type: normal;
                display: inline-grid;
                flex: none;
                inline-size: var(--ui-control-inner);
                block-size: var(--ui-control-inner);

                border-radius: var(--ui-radius-pill);
            }

            :host([interactive]) {
                cursor: pointer;
            }

            :host(:is([disabled], [aria-disabled="true"])) {
                cursor: not-allowed;
            }

            .disc {
                display: grid;
                place-items: center;
                inline-size: 100%;
                block-size: 100%;

                position: relative;
                margin: 0;
                padding: 0;
                border: var(--ui-border-w) solid var(--ui-line-strong);
                border-radius: var(--ui-radius-pill);
                background-color: var(--ui-key);
                color: var(--ui-text);
                font-family: inherit;
                font-size: var(--ui-text-2xs);
                --_ui-rest-weight: var(--ui-weight-semibold);
                font-weight: var(--_ui-rest-weight);
            }

            .pick {
                border-color: var(--ui-line);
                background-color: transparent;
                color: var(--ui-muted);
            }

        `,
        selectionSurface,
    ];

    constructor() {
        super();
        this.selected = false;
        this.interactive = false;
        this.form = 'tag';
        this.disabled = false;
        this.label = '';
    }

    render() {
        const named = Boolean(this.label);
        const glyph = html`<span id="glyph" class="glyph"
            aria-hidden=${named ? 'true' : nothing}><slot></slot></span>`;
        const name = named
            ? html`<span id="a11y" class="a11y"
                >${this.label}</span>`
            : nothing;

        /* The resting-paint class is the FORM's; the element is `interactive`'s. */
        const paint = this.form === 'pick' ? 'pick' : 'tag';
        return this.interactive
            ? html`<button id="disc" class="disc ${paint}" type="button"
                    aria-pressed=${this.selected ? 'true' : 'false'}
                    ?disabled=${this.disabled}
                    @click=${this.#onActivate}
                >${glyph}${name}</button>`
            : html`<span id="disc" class="disc ${paint}"
                    aria-current=${this.selected ? 'true' : nothing}
                >${glyph}${name}</span>`;
    }

    updated(changed) {
        super.updated(changed);
        if (this.disabled) this.setAttribute('aria-disabled', 'true');
        else this.removeAttribute('aria-disabled');
    }

    #onActivate = () => {
        if (!this.interactive || this.disabled) return;
        this.dispatchEvent(new CustomEvent('pick', {
            detail: { selected: !this.selected, label: this.label },
            bubbles: true,
            composed: true,
        }));
    };
}

customElements.define('ui-pick-disc', UiPickDisc);
