/**
 * A two-state switch, with a pending state for a write the machine has not confirmed.
 */

import { css, html } from 'lit';

import { UiElement, visuallyHidden } from 'src/components/base.js';

export class UiSwitch extends UiElement {
    static properties = {
        /** ON when true. Reflected, because the paint is keyed on the attribute. */
        checked: { type: Boolean, reflect: true },
        /** Paint dims and input is refused. Reflected; the base dims the host. */
        disabled: { type: Boolean, reflect: true },
        shape: { type: String, reflect: true },

        pending: { type: Boolean, reflect: true },

        pendingLabel: { type: String, attribute: 'pending-label' },
    };

    static styles = [
        visuallyHidden,
        css`
            :host {
                position: relative;
                display: inline-block;
                flex: none;
                inline-size: var(--ui-switch-track-w);
                block-size: var(--ui-switch-track-h);
                cursor: pointer;

                --_ui-switch-throw: calc(
                    var(--ui-switch-track-w)
                    - var(--ui-switch-knob)
                    - 2 * var(--ui-switch-inset)
                    - 2 * var(--ui-border-w-strong)
                );
            }

            :host(:is([disabled], [aria-disabled="true"])) {
                cursor: not-allowed;
            }

            :host([shape="pill"]) {
                --_ui-switch-radius: var(--ui-radius-pill);
                --_ui-switch-knob-radius: var(--ui-radius-pill);
            }

            .track {
                position: absolute;
                inset: 0;
                border: var(--ui-border-w) solid var(--ui-line);
                border-radius: var(--_ui-switch-radius, var(--ui-radius));
                background-color: var(--ui-key);
                transition:
                    background-color var(--ui-dur-slow) var(--ui-ease),
                    border-color var(--ui-dur-slow) var(--ui-ease);
            }

            .knob {
                position: absolute;
                inset-block-start: 50%;
                inset-inline-start: var(--ui-switch-inset);
                inline-size: var(--ui-switch-knob);
                block-size: var(--ui-switch-knob);
                border-radius: var(--_ui-switch-knob-radius, var(--ui-radius-sm));
                background-color: var(--ui-line-strong);
                translate: 0 -50%;
                transition:
                    translate var(--ui-dur-slow) var(--ui-ease),
                    background-color var(--ui-dur-slow) var(--ui-ease);
            }

            :host([checked]) .track {
                background-color: var(--ui-primary);
                border-color: color-mix(in srgb, var(--ui-primary) 72%, var(--ui-steel));
            }

            :host([checked]) .knob {
                background-color: var(--ui-on-primary);
                translate: var(--_ui-switch-throw) -50%;
            }

            :host([pending]) .pending-track {
                background-color: var(--ui-muted);
                border-color: var(--ui-line);
            }

            :host([pending]) {
                cursor: default;
            }

            @media (prefers-reduced-motion: reduce) {
                .track,
                .knob {
                    transition-duration: 0s;
                }
            }
        `,
    ];

    constructor() {
        super();
        this.checked = false;
        this.disabled = false;
        this.shape = '';
        this.pending = false;
        this.pendingLabel = '';
    }

    #ownsRole = false;

    #authorTabIndex = null;

    /** Has the author's value been captured at least once? `null` is a real value. */
    #captured = false;

    /** The last `tabindex` this component wrote, so an outside write is visible. */
    #ownTabIndex = null;

    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('role')) {
            this.#ownsRole = true;
            if (!this.pending) this.setAttribute('role', 'switch');
        }
        /* FIRST connect only. A re-parent must not re-read an attribute this
         * component wrote itself. */
        if (!this.#captured) {
            this.#authorTabIndex = this.getAttribute('tabindex');
            this.#captured = true;
        }
        this.addEventListener('click', this.#onClick);
        this.addEventListener('keydown', this.#onKeydown);
    }

    disconnectedCallback() {
        this.removeEventListener('click', this.#onClick);
        this.removeEventListener('keydown', this.#onKeydown);
        super.disconnectedCallback();
    }

    /** Write `tabindex` and remember that WE wrote it. */
    #setTabIndex(value) {
        this.#ownTabIndex = value;
        this.setAttribute('tabindex', value);
    }

    updated(changed) {
        super.updated(changed);

        if (this.pending) {
            if (this.#ownsRole) this.removeAttribute('role');
            this.removeAttribute('aria-checked');
            this.removeAttribute('aria-disabled');
            const livePending = this.getAttribute('tabindex');
            if (livePending !== this.#ownTabIndex) this.#authorTabIndex = livePending;
            this.#setTabIndex('-1');
            return;
        }

        if (this.#ownsRole && !this.hasAttribute('role')) this.setAttribute('role', 'switch');

        this.setAttribute('aria-checked', this.checked ? 'true' : 'false');

        const live = this.getAttribute('tabindex');
        if (live !== this.#ownTabIndex) this.#authorTabIndex = live;

        if (this.disabled) {
            this.setAttribute('aria-disabled', 'true');
            /* Out of the tab order, still programmatically focusable — the state a
             * screen reader user can reach and be told about. */
            this.#setTabIndex('-1');
        } else {
            this.removeAttribute('aria-disabled');
            this.#setTabIndex(this.#authorTabIndex ?? '0');
        }
    }

    render() {
        if (this.pending) {
            return html`
                <span class="track pending-track" aria-hidden="true"></span>
                ${this.pendingLabel ? html`<span class="a11y">${this.pendingLabel}</span>` : ''}
            `;
        }

        return html`
            <span class="track" aria-hidden="true"></span>
            <span class="knob" aria-hidden="true"></span>
        `;
    }

    /** Toggle and announce. The only way `checked` changes from inside. */
    #toggle() {
        if (this.pending) return;
        if (this.disabled) return;
        this.checked = !this.checked;
        this.dispatchEvent(new CustomEvent('change', {
            detail: { checked: this.checked },
            bubbles: true,
            composed: true,
        }));
    }

    #onClick = () => {
        this.#toggle();
    };

    #onKeydown = (event) => {
        /* Space is the required key for role="switch"; Enter is accepted too, which
         * is what a user arriving from a native checkbox or a button expects. */
        if (event.key !== ' ' && event.key !== 'Spacebar' && event.key !== 'Enter') return;
        /* Space scrolls the page otherwise, and the page is a wall panel. */
        event.preventDefault();
        this.#toggle();
    };
}

customElements.define('ui-switch', UiSwitch);
