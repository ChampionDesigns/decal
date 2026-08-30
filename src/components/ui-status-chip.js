/**
 * The machine-state.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';

export class UiStatusChip extends UiElement {
    static properties = {
        /** A shot is happening now: show the pulsing dot. Reflected so a screen can
         *  lay out `ui-status-chip[live]` from outside without piercing anything. */
        live: { type: Boolean, reflect: true },
    };

    static styles = [css`
        :host {
            container-type: normal;
            display: inline-flex;
            max-inline-size: 100%;

            --_ui-dot-size: 10px;
            --_ui-pulse-dur: 1.6s;
            --_ui-pulse-floor: .3;
        }

        .chip {
            display: flex;
            align-items: center;
            gap: var(--ui-space-2);
            min-inline-size: 0;
            background-color: transparent;
            color: var(--ui-muted);

            font-size: var(--_ui-status-chip-size, var(--ui-text-md));
            font-weight: var(--ui-weight-semibold);
            letter-spacing: var(--ui-tracking-cap);
            line-height: 1.2;
            text-transform: uppercase;
        }

        .label {
            min-inline-size: 0;
            overflow-wrap: anywhere;
        }

        .dot {
            flex: none;
            inline-size: var(--_ui-dot-size);
            block-size: var(--_ui-dot-size);
            border-radius: var(--ui-radius-pill);
            background-color: var(--ui-status-danger);
            animation: ui-status-chip-pulse var(--_ui-pulse-dur) ease-in-out infinite;
        }

        @keyframes ui-status-chip-pulse {
            0%, 100% { opacity: 1; }
            50%      { opacity: var(--_ui-pulse-floor); }
        }

        @media (prefers-reduced-motion: reduce) {
            .dot {
                animation: none;
            }
        }
    `];

    constructor() {
        super();
        this.live = false;
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('role')) this.setAttribute('role', 'status');
    }

    render() {
        return html`<span id="chip" class="chip"
            >${this.live
                ? html`<span id="dot" class="dot" aria-hidden="true"></span>`
                : nothing}<span id="label" class="label"><slot></slot></span></span>`;
    }
}

customElements.define('ui-status-chip', UiStatusChip);
