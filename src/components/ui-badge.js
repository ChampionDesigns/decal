/**
 * The small status marker.
 */

import { css, html, nothing } from 'lit';
import { UiElement, visuallyHidden } from 'src/components/base.js';

export const BADGE_VARIANTS = Object.freeze(['default', 'active', 'attention']);

export class UiBadge extends UiElement {
    static properties = {
        /** 'default' | 'active' | 'attention'. */
        variant: { type: String, reflect: true },
        /** Accessible name, for a badge whose visible content is a bare number. */
        label: { type: String },
    };

    static styles = [visuallyHidden, css`
        :host {
            container-type: normal;
            display: inline-grid;
            max-inline-size: 100%;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            /* Grid items floor at min-content by default, so without this the clamp
             * above would be overflowed rather than obeyed. */
            min-inline-size: 0;
            padding-inline: var(--ui-space-2);
            border-radius: var(--ui-radius);
            background-color: var(--ui-key-on);
            color: var(--ui-text-2);
            font-size: var(--ui-text-2xs);
            font-weight: var(--ui-weight-medium);
            line-height: 1.5;
            white-space: nowrap;
        }

        .text {
            display: block;
            min-inline-size: 0;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        :host([variant="active"]) .badge {
            background-color: var(--ui-primary);
            color: var(--ui-on-primary);
            font-weight: var(--ui-weight-semibold);
            letter-spacing: var(--ui-tracking-cap);
            text-transform: uppercase;
        }

        :host([variant="attention"]) .badge {
            background-color: color-mix(in srgb, var(--ui-tint-power) 18%, transparent);
            color: var(--ui-tint-power);
            font-weight: var(--ui-weight-semibold);
        }

    `];

    constructor() {
        super();
        this.variant = 'default';
        this.label = '';
    }

    /** Normalise before paint, so `variant="Active"` and `variant="nope"` are a
     *  documented fallback rather than an unstyled marker. */
    willUpdate(changed) {
        if (changed.has('variant')) {
            const raw = String(this.variant ?? '').trim().toLowerCase();
            const next = BADGE_VARIANTS.includes(raw) ? raw : 'default';
            if (next !== this.variant) this.variant = next;
        }
    }

    render() {
        const named = Boolean(this.label);
        return html`<span id="badge" class="badge"
            ><span id="text" class="text" aria-hidden=${named ? 'true' : nothing}><slot></slot></span
            >${named ? html`<span id="a11y" class="a11y">${this.label}</span>` : nothing}</span>`;
    }
}

customElements.define('ui-badge', UiBadge);
