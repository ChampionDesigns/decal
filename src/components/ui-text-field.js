/**
 * A single-line text field.
 */

import { css, html, nothing } from 'lit';

import { UiElement, focusRing } from 'src/components/base.js';

const TEXT_TYPES = new Set(['text', 'search', 'email', 'tel', 'url', 'password']);

/** Every flag `ElementInternals.setValidity()` accepts, mirrored from the input. */
const VALIDITY_FLAGS = [
    'valueMissing', 'typeMismatch', 'patternMismatch', 'tooLong', 'tooShort',
    'rangeUnderflow', 'rangeOverflow', 'stepMismatch', 'badInput', 'customError',
];

class UiTextField extends UiElement {
    /** Forms need `formAssociated`. This is that. */
    static formAssociated = true;

    static properties = {
        value: { type: String },
        name: {
            type: String,
            reflect: true,
            converter: {
                fromAttribute: (value) => value ?? '',
                toAttribute: (value) => (value || null),
            },
        },
        type: { type: String },
        placeholder: { type: String },
        label: { type: String },
        hideLabel: { type: Boolean, attribute: 'hide-label' },
        /** Render a textarea instead of an input. `type` and `pattern` do not apply. */
        multiline: { type: Boolean, reflect: true },
        /** Visible lines when `multiline`. */
        rows: { type: Number },

        align: { type: String, reflect: true },
        disabled: { type: Boolean, reflect: true },
        readonly: { type: Boolean, reflect: true },
        required: { type: Boolean, reflect: true },
        invalid: { type: Boolean, reflect: true },
        autocomplete: { type: String },
        inputmode: { type: String },
        pattern: { type: String },
        maxlength: { type: Number },
    };

    static styles = [
        css`
            .label {
                display: block;
                margin-block-end: var(--ui-space-2);
                color: var(--ui-text-2);
                font-family: var(--ui-font-family);
                font-size: var(--ui-text-note);
                font-weight: var(--ui-weight-regular);
            }

            .field {
                display: flex;
                align-items: center;
                inline-size: 100%;
                block-size: var(--ui-control-h);
                min-block-size: var(--ui-control-h);
                padding-inline: var(--ui-space-4);
                border: var(--ui-border-w) solid var(--ui-line);
                border-radius: var(--ui-radius);
                background-color: var(--ui-key);
                color: var(--ui-text);
                cursor: text;
            }

            .field:has(:focus-visible) {
                ${focusRing}
            }

            /* The other half of the same section: a plain higher-specificity
             * selector beats the base's zero-specificity :where() rule. There is
             * no second ring and no !important anywhere in the file. */
            .input:focus-visible {
                outline: none;
            }

            :host([invalid]) .field {
                border-color: var(--ui-status-danger);
            }

            .input {
                flex: 1 1 auto;
                align-self: stretch;
                min-inline-size: 0;
                margin: 0;
                padding: 0;
                border: 0;
                background-color: transparent;
                color: inherit;
                font-family: var(--ui-font-family);
                font-size: var(--ui-text-base);
                font-weight: var(--ui-weight-regular);
                text-align: start;
            }

            :host([multiline]) .field {
                align-items: stretch;
                block-size: auto;
                padding-block: var(--ui-space-3);
            }

            :host([multiline]) .input {
                resize: none;
                line-height: 1.5;
            }

            .input::placeholder {
                color: var(--ui-muted);
                opacity: 1;
            }

            :host([align="center"]) .input {
                text-align: center;
            }

            :host([align="end"]) .input {
                text-align: end;
            }

            ::slotted(*) {
                flex: 0 0 auto;
                color: var(--ui-muted);
            }

            slot[name="lead"]::slotted(*) {
                margin-inline-end: var(--ui-space-3);
            }

            slot[name="trail"]::slotted(*) {
                margin-inline-start: var(--ui-space-3);
            }

            ::slotted(:focus-visible) {
                ${focusRing}
            }
        `,
    ];

    #internals = null;

    #defaultValue = null;

    constructor() {
        super();
        this.value = '';
        this.name = '';
        this.type = 'text';
        this.placeholder = '';
        this.label = '';
        this.hideLabel = false;
        this.multiline = false;
        this.rows = 4;
        this.disabled = false;
        this.readonly = false;
        this.required = false;
        this.invalid = false;
        this.autocomplete = '';
        this.inputmode = '';
        this.pattern = '';
        this.maxlength = undefined;
        this.#internals = this.attachInternals();
    }

    get #control() {
        return this.renderRoot?.querySelector('#control') ?? null;
    }

    /** An unrecognised `type` is cosmetic damage, not a dead control. */
    get #inputType() {
        return TEXT_TYPES.has(this.type) ? this.type : 'text';
    }

    render() {
        const showLabel = Boolean(this.label) && !this.hideLabel;
        return html`
            ${showLabel
                ? html`<label id="label" class="label" for="control">${this.label}</label>`
                : nothing}
            <div id="field" class="field" @click=${this.#onFieldClick}>
                <slot name="lead"></slot>
                ${this.multiline
                    ? html`<textarea
                        id="control"
                        class="input"
                        rows=${Number.isFinite(this.rows) ? this.rows : 4}
                        .value=${this.value ?? ''}
                        name=${this.name || nothing}
                        placeholder=${this.placeholder || nothing}
                        autocomplete=${this.autocomplete || nothing}
                        inputmode=${this.inputmode || nothing}
                        maxlength=${Number.isFinite(this.maxlength) ? this.maxlength : nothing}
                        aria-label=${showLabel ? nothing : (this.label || nothing)}
                        aria-invalid=${this.invalid ? 'true' : nothing}
                        ?disabled=${this.disabled}
                        ?readonly=${this.readonly}
                        ?required=${this.required}
                        @input=${this.#onInput}
                        @change=${this.#onChange}></textarea>`
                    : html`<input
                        id="control"
                        class="input"
                        type=${this.#inputType}
                        .value=${this.value ?? ''}
                        name=${this.name || nothing}
                        placeholder=${this.placeholder || nothing}
                        autocomplete=${this.autocomplete || nothing}
                        inputmode=${this.inputmode || nothing}
                        pattern=${this.pattern || nothing}
                        maxlength=${Number.isFinite(this.maxlength) ? this.maxlength : nothing}
                        aria-label=${showLabel ? nothing : (this.label || nothing)}
                        aria-invalid=${this.invalid ? 'true' : nothing}
                        ?disabled=${this.disabled}
                        ?readonly=${this.readonly}
                        ?required=${this.required}
                        @input=${this.#onInput}
                        @change=${this.#onChange}>`}
                <slot name="trail"></slot>
            </div>
        `;
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.#defaultValue === null) this.#defaultValue = this.getAttribute('value') ?? '';
    }

    firstUpdated() {
        this.#syncForm();
    }

    updated(changed) {
        if (changed.has('value') || changed.has('required') || changed.has('pattern')
            || changed.has('type') || changed.has('maxlength') || changed.has('disabled')) {
            this.#syncForm();
        }
    }

    #onInput(event) {
        this.value = event.target.value;
        this.#syncForm();
    }

    #onChange() {
        this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }

    /** A press on the field's padding is a press on the entry. */
    #onFieldClick(event) {
        if (event.target === event.currentTarget) this.#control?.focus();
    }

    #syncForm() {
        const internals = this.#internals;
        if (!internals) return;
        internals.setFormValue(this.value ?? '');

        const input = this.#control;
        if (!input) return;
        const flags = {};
        for (const flag of VALIDITY_FLAGS) {
            if (input.validity[flag]) flags[flag] = true;
        }
        internals.setValidity(flags, input.validationMessage, input);
    }

    formResetCallback() {
        this.value = this.#defaultValue ?? '';
        this.#syncForm();
    }

    formDisabledCallback(disabled) {
        this.disabled = disabled;
    }

    formStateRestoreCallback(state) {
        this.value = typeof state === 'string' ? state : '';
        this.#syncForm();
    }

    get form() { return this.#internals?.form ?? null; }

    get validity() { return this.#internals?.validity ?? null; }

    get validationMessage() { return this.#internals?.validationMessage ?? ''; }

    get willValidate() { return this.#internals?.willValidate ?? false; }

    checkValidity() { return this.#internals?.checkValidity() ?? true; }

    reportValidity() { return this.#internals?.reportValidity() ?? true; }

    focus(options) {
        const input = this.#control;
        if (input) input.focus(options);
        else super.focus(options);
    }

    blur() {
        const input = this.#control;
        if (input) input.blur();
        else super.blur();
    }

    select() { this.#control?.select(); }
}

customElements.define('ui-text-field', UiTextField);

export { UiTextField };
