/**
 * A search field with its clear affordance.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import 'src/components/ui-text-field.js';

export class UiSearchField extends UiElement {
    static properties = {
        /** The entry's text. Owned by the consumer; mirrored on every keystroke. */
        value: { type: String },
        placeholder: { type: String },
        label: { type: String },
        /** Render the label visibly, above the field, with ui-text-field's for/id pair. */
        showLabel: { type: Boolean, attribute: 'show-label' },
        hostLabel: { type: String, attribute: 'aria-label' },
        /** Paint dims and the entry refuses input. Reflected; the base dims the host. */
        disabled: { type: Boolean, reflect: true },
        focusRing: { type: String, attribute: 'focus-ring' },
    };

    static styles = [
        css`
            :host([disabled]) .field {
                opacity: 1;
            }

            .well {
                display: grid;
                place-items: center;
                flex: none;
                inline-size: var(--ui-icon);
                block-size: var(--ui-icon);

                color: var(--ui-text);
            }

            .glyph,
            slot[name="icon"]::slotted(svg),
            slot[name="icon"]::slotted(img) {
                display: block;
                inline-size: 100%;
                block-size: 100%;
            }

            slot[name="trail"]::slotted(*) {
                flex: none;
                margin-inline-start: var(--ui-space-3);
            }
        `,
    ];

    /** The host-written name after it has been taken off the host. */
    #adoptedLabel = null;

    /** True for exactly one update: the aria-label removal below is OURS, not a clear. */
    #adopting = false;

    constructor() {
        super();
        this.value = '';
        this.placeholder = '';
        this.label = '';
        this.showLabel = false;
        this.hostLabel = null;
        this.disabled = false;
        this.focusRing = null;
    }

    get field() {
        return this.renderRoot?.querySelector?.('#field') ?? null;
    }

    get accessibleName() {
        return this.label || this.hostLabel || this.#adoptedLabel || this.placeholder || null;
    }

    render() {
        const name = this.accessibleName;
        const labelVisible = this.showLabel && Boolean(this.label);
        return html`
            <ui-text-field
                id="field"
                class="field"
                type="text"
                inputmode="search"
                .value=${this.value ?? ''}
                .placeholder=${this.placeholder ?? ''}
                .label=${labelVisible ? this.label : (name ?? '')}
                ?hide-label=${!labelVisible}
                ?disabled=${this.disabled}
                focus-ring=${this.focusVariant === 'inset' ? 'inset' : nothing}
                @input=${this.#onInput}
                @keydown=${this.#onKeydown}
            >
                <span class="well" slot="lead" aria-hidden="true">
                    <slot name="icon">
                        <!-- Slate's own path, carried verbatim from settings.html:20.
                             aria-hidden on the WELL, so a consumer's replacement glyph
                             is decorative too without having to remember. -->
                        <svg class="glyph" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2"
                             stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                    </slot>
                </span>
                <slot name="trail" slot="trail"></slot>
            </ui-text-field>
        `;
    }

    updated() {
        if (this.#adoptedLabel && this.hasAttribute('aria-label')) {
            this.#adopting = true;
            this.removeAttribute('aria-label');
        }
    }

    willUpdate(changed) {
        if (!changed.has('hostLabel')) return;
        if (this.hostLabel) this.#adoptedLabel = this.hostLabel;
        else if (!this.#adopting) this.#adoptedLabel = null;
        this.#adopting = false;
    }

    #onInput(event) {
        this.value = event.target?.value ?? '';
    }

    /**
     * ONE EVENT FOR TWO KEYBOARDS. `search` is the native name and this is the native
     * meaning; with type=text nothing else fires it, so there is no double.
     */
    #onKeydown(event) {
        if (event.key !== 'Enter') return;
        this.#emitSearch();
    }

    #emitSearch() {
        this.dispatchEvent(new CustomEvent('search', {
            bubbles: true,
            composed: true,
            detail: { value: this.value ?? '' },
        }));
    }

    clear() {
        if ((this.value ?? '') === '') return;
        this.value = '';
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this.#emitSearch();
    }

    focus(options) {
        const field = this.field;
        if (field) field.focus(options);
        else super.focus(options);
    }

    blur() {
        const field = this.field;
        if (field) field.blur();
        else super.blur();
    }

    select() { this.field?.select(); }
}

customElements.define('ui-search-field', UiSearchField);

export default UiSearchField;
