/**
 * The press that stops whatever the machine is doing.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';

/** The event a screen listens for. Exported so no caller spells it by hand. */
export const STOP_REQUEST = 'stop-request';

/** The visible word, as an i18n KEY (keys are English text - src/lib/i18n.js). */
export const STOP_LABEL_KEY = 'STOP';

export const STOP_NAME_KEY = 'Stop the machine';

export class UiStopButton extends UiElement {
    static properties = {
        /** Is something running? The control exists only while this is true. */
        running: { type: Boolean, reflect: true },
        /** Accessible name. Empty string = fall back to the visible words. */
        label: { type: String },
    };

    static styles = [css`
        :host {
            display: grid;
        }

        :host(:not([running])) {
            display: none;
        }

        .stop {
            display: flex;
            align-items: center;
            justify-content: center;
            min-block-size: var(--ui-control-h);
            padding-inline: var(--ui-space-5);
            border: 0;
            border-radius: 0;
            background-color: var(--ui-status-danger);
            color: var(--ui-on-primary);
            font-family: inherit;
            font-size: var(--ui-display-xs);
            font-weight: var(--ui-weight-medium);
            letter-spacing: var(--ui-tracking-cap);
            text-align: center;
            cursor: pointer;
        }
    `];

    #hostLabel = null;

    constructor() {
        super();
        this.running = false;
        this.label = '';
        this.i18n = new I18nController(this);
    }

    /** The inner control - what focus and the press belong to. Null while absent. */
    get control() {
        return this.renderRoot?.querySelector?.('button') ?? null;
    }

    get accessibleName() {
        if (this.label) return this.label;
        if (this.hasAttribute('label')) return '';
        return this.#hostLabel ?? this.i18n.t(STOP_NAME_KEY);
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

    updated(changed) {
        super.updated(changed);
        if (this.#adoptHostLabel()) this.requestUpdate();
    }

    /** Move a screen-written aria-label onto the button. Returns true only on the update
     *  that actually moved one, so the extra render this asks for happens once. */
    #adoptHostLabel() {
        const written = this.getAttribute('aria-label');
        if (written === null) return false;
        this.#hostLabel = written;
        this.removeAttribute('aria-label');
        return true;
    }

    #onPress = () => {
        this.dispatchEvent(new CustomEvent(STOP_REQUEST, {
            detail: { reason: 'press' },
            bubbles: true,
            composed: true,
        }));
    };

    render() {
        if (!this.running) return nothing;

        const name = this.accessibleName;
        return html`<button
            id="stop"
            class="stop"
            type="button"
            aria-label=${name ? name : nothing}
            @click=${this.#onPress}
        ><slot>${this.i18n.t(STOP_LABEL_KEY)}</slot></button>`;
    }
}

customElements.define('ui-stop-button', UiStopButton);
