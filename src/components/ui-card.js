/**
 * The plain surface.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';

/** The three the component recognises; anything else falls back to `regular` rather
 *  than collapsing the inset - the same choice base.js makes for focus-ring, and the
 *  same one ui-button makes for variant. */
export const CARD_PADS = Object.freeze(['regular', 'tight', 'none']);

export class UiCard extends UiElement {
    static properties = {
        /** 'regular' | 'tight' | 'none'. */
        pad: { type: String, reflect: true },
        scrollable: { type: Boolean, reflect: true, attribute: 'scroll' },
        /** Accessible name. With one, the card becomes a labelled group. */
        label: { type: String },
    };

    static styles = [css`
        :host {
            display: grid;
            grid-template-rows: minmax(0, 1fr);

            --_ui-card-pad: var(--ui-space-5);
        }

        :host([pad="tight"]) {
            --_ui-card-pad: var(--ui-space-4);
        }

        :host([pad="none"]) {
            --_ui-card-pad: 0px;
        }

        .card {
            min-inline-size: 0;
            padding: var(--_ui-card-pad);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            background-color: var(--ui-key);
        }

        :host([scroll]) .card {
            overflow: auto;
            min-block-size: var(--_ui-card-min-block, var(--ui-control-h));
        }

        :host([scroll]:not([focus-ring])) {
            --_ui-focus-offset: var(--ui-focus-offset-inset);
        }

        :host([scroll][pad="none"]) ::slotted(:not([focus-ring])) {
            --_ui-focus-offset: var(--ui-focus-offset-inset);
        }
    `];

    constructor() {
        super();
        this.pad = 'regular';
        this.scrollable = false;
        this.label = '';
    }

    /** Normalise before paint, so pad="Tight" and pad="nope" are a documented
     *  fallback rather than a surface with no inset. */
    willUpdate(changed) {
        if (changed.has('pad')) {
            const raw = String(this.pad ?? '').trim().toLowerCase();
            const next = CARD_PADS.includes(raw) ? raw : 'regular';
            if (next !== this.pad) this.pad = next;
        }
    }

    render() {
        const named = Boolean(this.label);
        return html`<div
            id="card"
            class="card"
            role=${named ? 'group' : nothing}
            aria-label=${named ? this.label : nothing}
            tabindex=${this.scrollable ? '0' : nothing}
        ><slot></slot></div>`;
    }
}

customElements.define('ui-card', UiCard);
