/**
 * A banner that states a condition and, when it can be acted on, offers the action beside it.
 */

import { css, html } from 'lit';
import { UiElement } from 'src/components/base.js';

export class UiAlertBanner extends UiElement {
    static properties = {
        /* Whether anything is slotted into each part. Internal reactive state, not an
         * API: the consumer says what it has by slotting it, never by setting a flag. */
        _hasHeadline: { state: true },
        _hasRemedy: { state: true },
        _hasActions: { state: true },
    };

    static styles = [css`
        :host {
            --_ui-headline-leading: 1.05;
        }

        .banner {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: var(--ui-space-5);
            min-inline-size: 0;
            min-block-size: 100%;
            padding-block: var(--ui-space-4);
            padding-inline: var(--ui-space-6);
            background-color: var(--ui-fascia);
        }

        .headline {
            display: block;
            min-inline-size: 0;
            color: var(--ui-status-danger);
            font-size: var(--ui-display-xl);
            font-weight: var(--ui-weight-medium);
            line-height: var(--_ui-headline-leading);
            overflow-wrap: anywhere;
        }

        .remedy {
            display: block;
            min-inline-size: 0;
            color: var(--ui-text-2);
            font-size: var(--ui-text-lg);
            overflow-wrap: anywhere;
        }

        .text {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: var(--ui-space-1);
            min-inline-size: 0;
            flex: 1 1 auto;
        }

        .actions {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: var(--ui-space-3);
            flex: 0 0 auto;
        }

        .is-empty {
            display: none;
        }
    `];

    constructor() {
        super();
        this._hasHeadline = false;
        this._hasRemedy = false;
        this._hasActions = false;
    }

    #readSlot(slot) {
        const filled = slot.assignedNodes({ flatten: true })
            .map((node) => node.textContent || '')
            .join('')
            .trim() !== '';
        if (slot.name === 'remedy') this._hasRemedy = filled;
        else if (slot.name === 'actions') this._hasActions = filled;
        else this._hasHeadline = filled;
    }

    #onSlotChange(event) {
        this.#readSlot(event.target);
    }

    #syncParts = () => {
        for (const slot of this.renderRoot?.querySelectorAll?.('slot') ?? []) this.#readSlot(slot);
    };

    #observer = new MutationObserver(this.#syncParts);

    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('role')) this.setAttribute('role', 'alert');
        this.#observer.observe(this, { childList: true, subtree: true, characterData: true });
    }

    disconnectedCallback() {
        this.#observer.disconnect();
        super.disconnectedCallback();
    }

    render() {
        const headline = this._hasHeadline ? 'headline' : 'headline is-empty';
        const remedy = this._hasRemedy ? 'remedy' : 'remedy is-empty';
        const actions = this._hasActions ? 'actions' : 'actions is-empty';
        return html`<div id="banner" class="banner"
            ><div id="text" class="text"
                ><strong id="headline" class="${headline}"
                    ><slot @slotchange=${this.#onSlotChange}></slot
                ></strong
                ><span id="remedy" class="${remedy}"
                    ><slot name="remedy" @slotchange=${this.#onSlotChange}></slot
                ></span
            ></div
            ><div id="actions" class="${actions}"
                ><slot name="actions" @slotchange=${this.#onSlotChange}></slot
            ></div
        ></div>`;
    }
}

customElements.define('ui-alert-banner', UiAlertBanner);
