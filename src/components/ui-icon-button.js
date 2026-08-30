/**
 * An icon-only press. It carries no text, so it must be given a label.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';

export class UiIconButton extends UiElement {
    static properties = {
        size: { type: String, reflect: true },
        /**
         * The accessible name. An icon button has no visible text, so this is not
         * decoration — it is the only thing a screen reader can announce.
         */
        label: { type: String },
        /** Paint dims and input is refused. Reflected; the base dims the host. */
        disabled: { type: Boolean, reflect: true },
        hostLabel: { type: String, attribute: 'aria-label' },
        expanded: { type: String, attribute: 'aria-expanded' },
        haspopup: { type: String, attribute: 'aria-haspopup' },
        controls: { type: String, attribute: 'aria-controls' },
        pressed: { type: String, attribute: 'aria-pressed' },
    };

    static styles = [
        css`
            :host {
                container-type: normal;
                display: inline-grid;
                flex: none;

                --_ui-icon-btn-box: var(--ui-control-h);
                --_ui-icon-btn-glyph: var(--ui-icon);
            }

            :host([size="lg"]) {
                --_ui-icon-btn-box: var(--ui-control-lg);
                --_ui-icon-btn-glyph: var(--ui-icon-lg);
            }

            .btn {
                display: inline-grid;
                place-items: center;

                min-inline-size: var(--_ui-icon-btn-box);
                min-block-size: var(--_ui-icon-btn-box);
                padding: 0;

                border: var(--_ui-icon-btn-border, var(--ui-border-w) solid var(--ui-line));
                border-radius: var(--ui-radius);
                background-color: transparent;
                color: var(--ui-text-2);

                font-family: inherit;
                font-weight: var(--ui-weight-regular);
                font-size: var(--_ui-icon-btn-glyph);
                line-height: 1;

                cursor: pointer;
            }

            ::slotted(svg),
            ::slotted(img) {
                inline-size: var(--_ui-icon-btn-glyph);
                block-size: var(--_ui-icon-btn-glyph);
            }

            @media (hover: hover) {
                .btn:not(:disabled):hover {
                    border-color: var(--ui-line-strong);
                    background-color: var(--ui-key);
                    color: var(--ui-text);
                }
            }

            :host(:is([disabled], [aria-disabled="true"])) .btn {
                opacity: 1;
            }
        `,
    ];

    /**
     * The host-written name after it has been taken off the host. Private, because a
     * consumer reads it back through `.hostLabel` / `.accessibleName`, never here.
     */
    #adoptedLabel = null;

    /** True for exactly one update: the aria-label removal below is OURS, not a clear. */
    #adopting = false;

    constructor() {
        super();
        this.size = 'md';
        this.label = '';
        this.disabled = false;
        this.hostLabel = null;
        this.expanded = null;
        this.haspopup = null;
        this.controls = null;
        this.pressed = null;
    }

    /** The inner control — what focus, clicks and the native disabled belong to. */
    get control() {
        return this.renderRoot?.querySelector?.('button') ?? null;
    }

    focus(options) {
        const control = this.control;
        if (control) control.focus(options);
        else super.focus(options);
    }

    blur() {
        const control = this.control;
        if (control) control.blur();
        else super.blur();
    }

    get accessibleName() {
        return this.label || this.hostLabel || this.#adoptedLabel
            || this.getAttribute('title') || null;
    }

    willUpdate(changed) {
        if (!changed.has('hostLabel')) return;
        if (this.hostLabel) this.#adoptedLabel = this.hostLabel;
        else if (!this.#adopting) this.#adoptedLabel = null;
        this.#adopting = false;
    }

    updated() {
        if (this.#adoptedLabel && this.hasAttribute('aria-label')) {
            this.#adopting = true;
            this.removeAttribute('aria-label');
        }
    }

    render() {
        const name = this.accessibleName;
        return html`
            <button
                id="control"
                class="btn"
                type="button"
                ?disabled=${this.disabled}
                aria-label=${name ?? nothing}
                aria-expanded=${this.expanded ?? nothing}
                aria-haspopup=${this.haspopup ?? nothing}
                aria-controls=${this.controls ?? nothing}
                aria-pressed=${this.pressed ?? nothing}
            ><slot></slot></button>
        `;
    }
}

customElements.define('ui-icon-button', UiIconButton);
