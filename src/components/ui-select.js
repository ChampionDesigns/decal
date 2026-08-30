/**
 * Ui-select.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';

class UiSelect extends UiElement {
    static properties = {
        options: { type: Array },

        /** The chosen option's value. Adopted from the control at first render. */
        value: { type: String },

        label: { type: String },

        /**
         * Paint AND behaviour. The base dims the host from --ui-opacity-disabled; the
         * native attribute below is what actually stops input.
         */
        disabled: { type: Boolean, reflect: true },
    };

    static styles = [css`
        :host {
            container-type: normal;
            display: inline-grid;

            flex: none;
            inline-size: max-content;

            max-inline-size: 100%;

            --_ui-caret: 7px;
            --_ui-caret-overlap: 1px;
            --_ui-caret-inset: var(--ui-space-4);
            --_ui-caret-band: calc(
                var(--_ui-caret-inset) + 2 * var(--_ui-caret) - var(--_ui-caret-overlap));
        }

        .field {
            /* Suppress the platform chrome so the caret below is the only one. Chrome
             * 123 is the stated WebView floor (spec section 1.1), so no -webkit- twin. */
            appearance: none;

            min-inline-size: 0;
            min-block-size: var(--ui-control-h);

            font-family: inherit;
            font-size: var(--ui-text-base);
            font-weight: var(--ui-weight-regular);
            line-height: normal;

            padding-block: 0;
            padding-inline-start: var(--ui-space-4);
            padding-inline-end: calc(var(--_ui-caret-band) + var(--ui-space-4));

            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            color: var(--ui-text);

            background-color: var(--ui-key);
            background-image:
                linear-gradient(45deg, transparent 50%, var(--ui-muted) 50%),
                linear-gradient(135deg, var(--ui-muted) 50%, transparent 50%);
            background-position:
                right calc(var(--_ui-caret-band) - var(--_ui-caret)) center,
                right var(--_ui-caret-inset) center;
            background-size:
                var(--_ui-caret) var(--_ui-caret),
                var(--_ui-caret) var(--_ui-caret);
            background-repeat: no-repeat;
        }

        .field:disabled {
            opacity: 1;
        }
    `];

    constructor() {
        super();
        this.options = [];
        this.value = '';
        this.label = '';
        this.disabled = false;
    }

    /** The control, for the value sync and for focus(). */
    get #control() {
        return this.renderRoot?.querySelector('#control') ?? null;
    }

    /** Focus lands on the control, not on the wrapper - one ring, on the real thing. */
    focus(options) {
        const control = this.#control;
        if (control) control.focus(options);
        else super.focus(options);
    }

    /**
     * Strings or objects, in; one shape, out. A number is accepted because a JSON
     * attribute of numeric choices is the obvious way to write one.
     */
    static #choices(list) {
        if (!Array.isArray(list)) return [];
        return list.map((item) => {
            if (item === null || typeof item !== 'object') {
                const text = String(item ?? '');
                return { value: text, label: text, disabled: false };
            }
            const value = String(item.value ?? item.label ?? '');
            return {
                value,
                label: String(item.label ?? item.value ?? ''),
                disabled: Boolean(item.disabled),
            };
        });
    }

    render() {
        return html`
            <select
                id="control"
                class="field"
                aria-label=${this.label || nothing}
                ?disabled=${this.disabled}
                @change=${this.#onChange}
            >${UiSelect.#choices(this.options).map((choice) => html`<option
                    value=${choice.value}
                    ?disabled=${choice.disabled}
                >${choice.label}</option>`)}</select>
        `;
    }

    updated() {
        const control = this.#control;
        if (!control) return;
        if (this.value) {
            if (control.value !== this.value) control.value = this.value;
        } else if (control.value) {
            this.value = control.value;
        }
    }

    #onChange(event) {
        event.stopPropagation();
        this.value = event.target.value;
        this.dispatchEvent(new CustomEvent('change', {
            bubbles: true,
            composed: true,
            detail: { value: this.value },
        }));
    }
}

customElements.define('ui-select', UiSelect);

export { UiSelect };
