/**
 * A press that opens the file picker and reports what was chosen.
 */

import { html, css, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import 'src/components/ui-button.js';

export class UiFileButton extends UiElement {
    static properties = {
        /** The `accept` attribute, verbatim. A hint to the picker, never a guarantee. */
        accept: { type: String },
        /** Accessible name, when the slotted label is a glyph. */
        label: { type: String },
        /** Pass-through to the button underneath: 'default' | 'primary' | 'ghost' | 'danger'. */
        variant: { type: String, reflect: true },
        /** Pass-through: the header height. */
        tall: { type: Boolean, reflect: true },
        /** Paint AND refusal, on both the button and the input. */
        disabled: { type: Boolean, reflect: true },

        multiple: { type: Boolean, reflect: true },

        directory: { type: Boolean, reflect: true },
    };

    static styles = [css`
        :host {
            container-type: normal;
            display: inline-grid;
        }

        .picker {
            position: absolute;
            inline-size: 1px;
            block-size: 1px;
            overflow: hidden;
            clip-path: inset(50%);
            white-space: nowrap;
        }
    `];

    constructor() {
        super();
        this.accept = '';
        this.label = '';
        this.variant = 'default';
        this.tall = false;
        this.disabled = false;
        this.multiple = false;
        this.directory = false;
    }

    /** The hidden input, for a test that wants to drive the pick without a picker. */
    get input() {
        return this.renderRoot?.querySelector?.('#picker') ?? null;
    }

    #onPress = () => {
        if (this.disabled) return;
        this.input?.click();
    };

    #onChange = (event) => {
        const files = [...(event.target.files ?? [])];
        const file = files[0];
        /* CLEARED FIRST, so the same file can be chosen again — and cleared even when
         * nothing was chosen, because a dismissed picker can still leave a stale value. */
        event.target.value = '';
        if (!file) return;
        this.dispatchEvent(new CustomEvent('file-pick', {
            detail: { file, files, name: file.name, size: file.size },
            bubbles: true,
            composed: true,
        }));
    };

    render() {
        return html`
            <ui-button
                id="button"
                variant=${this.variant}
                ?tall=${this.tall}
                ?disabled=${this.disabled}
                label=${this.label}
                @click=${this.#onPress}
            ><slot></slot></ui-button>
            <input
                id="picker"
                class="picker"
                type="file"
                tabindex="-1"
                aria-hidden="true"
                accept=${this.accept}
                ?multiple=${this.multiple || this.directory}
                webkitdirectory=${this.directory ? '' : nothing}
                ?disabled=${this.disabled}
                @change=${this.#onChange}
            >`;
    }
}

customElements.define('ui-file-button', UiFileButton);
