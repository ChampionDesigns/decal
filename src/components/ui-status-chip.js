/**
 * The machine's state, as one word, with a dot in the machine's own colour.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';

export class UiStatusChip extends UiElement {
    static properties = {
        /** The machine's colour: ok, active, attention, busy, asleep or error. The dot
         *  is drawn when one is named and absent when none is. Reflected so a screen can
         *  lay out `ui-status-chip[tone]` from outside without piercing anything. */
        tone: { type: String, reflect: true },
    };

    static styles = [css`
        :host {
            container-type: normal;
            display: inline-flex;
            max-inline-size: 100%;

            --_ui-dot-size: 10px;
            --_ui-pulse-dur: 1.6s;
            --_ui-pulse-floor: .3;
            --_ui-alarm-dur: .5s;
        }

        .chip {
            display: flex;
            align-items: baseline;
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
            background-color: var(--_ui-dot-ink);
            animation: ui-status-chip-pulse var(--_ui-pulse-dur) ease-in-out infinite;
            /* A transform, not align-self: the dot must stay in the baseline group. */
            transform: translateY(calc((var(--_ui-dot-size) - 1cap) / 2));
        }

        :host([tone="ok"])        { --_ui-dot-ink: var(--ui-status-ok); }
        :host([tone="active"])    { --_ui-dot-ink: var(--ui-status-danger); }
        :host([tone="attention"]) { --_ui-dot-ink: var(--ui-status-attention); }
        :host([tone="busy"])      { --_ui-dot-ink: var(--ui-status-busy); }
        :host([tone="asleep"])    { --_ui-dot-ink: var(--ui-status-asleep); }
        :host([tone="error"])     { --_ui-dot-ink: var(--ui-status-danger); }

        :host([tone="error"]) .dot {
            animation: ui-status-chip-alarm var(--_ui-alarm-dur) step-end infinite;
            outline: var(--ui-border-w) solid var(--_ui-dot-ink);
            outline-offset: var(--ui-border-w-strong);
        }

        @keyframes ui-status-chip-pulse {
            0%, 100% { opacity: 1; }
            50%      { opacity: var(--_ui-pulse-floor); }
        }

        @keyframes ui-status-chip-alarm {
            0%   { opacity: 1; }
            50%  { opacity: 0; }
            100% { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
            .dot,
            :host([tone="error"]) .dot {
                animation: none;
            }
        }
    `];

    constructor() {
        super();
        this.tone = null;
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('role')) this.setAttribute('role', 'status');
    }

    render() {
        return html`<span id="chip" class="chip"
            >${this.tone
                ? html`<span id="dot" class="dot" aria-hidden="true"></span>`
                : nothing}<span id="label" class="label"><slot></slot></span></span>`;
    }
}

customElements.define('ui-status-chip', UiStatusChip);
