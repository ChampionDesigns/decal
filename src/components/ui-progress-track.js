/**
 * A determinate progress track.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

/** 0..1, whatever arrives. */
const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** A fraction as a CSS percentage, without float noise. Mirrors ui-slider's. */
const pct = (fraction) => `${Number((clamp01(fraction) * 100).toFixed(3))}%`;

/** Numbers only; anything else is 0. */
const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

export class UiProgressTrack extends UiElement {
    static properties = {
        /** Progress in the author's units. Clamped to 0..max for both paint and aria. */
        value: { type: Number },
        /** Top of the range. Arrives from outside; a primitive never owns a limit. */
        max: { type: Number },
        /** Accessible name. A bar with no visible label MUST carry one. */
        label: { type: String },
        /** Human-readable value for a screen reader: "42%", "3 of 7". */
        valueText: { type: String, attribute: 'value-text' },
    };

    static styles = [
        css`
            :host {
                --_ui-progress-h: calc(var(--ui-space-2) + 2 * var(--ui-hairline));
            }

            .track {
                display: block;
                inline-size: 100%;
                block-size: var(--_ui-progress-h);
                border-radius: var(--ui-radius);

                background-color: var(--ui-key-on);

                overflow: clip;
            }

            .fill {
                display: block;
                block-size: 100%;
                inline-size: var(--_ui-progress-at, 0%);

                background-color: var(--ui-steel);

                transition: inline-size var(--ui-dur-slow) var(--ui-ease);
            }

            @media (prefers-reduced-motion: reduce) {
                .fill {
                    transition-duration: 0s;
                }
            }
        `,
    ];

    constructor() {
        super();
        this.value = 0;
        this.max = 1;
        this.label = '';
        this.valueText = '';
    }

    get #reading() {
        const max = num(this.max);
        const top = max > 0 ? max : 0;
        const value = Math.min(Math.max(num(this.value), 0), top);
        return { top, value, fraction: top > 0 ? clamp01(value / top) : 0 };
    }

    connectedCallback() {
        super.connectedCallback();
        // Set once, and only if the author has not chosen otherwise.
        if (!this.hasAttribute('role')) this.setAttribute('role', 'progressbar');
    }

    /**
     * Appendix 15's contract, written in one place on every update so the aria
     * numbers and the painted width cannot disagree. aria-valuemin is the
     * constant 0 that #reading clamps to.
     */
    updated(changed) {
        super.updated(changed);
        const { top, value } = this.#reading;
        this.setAttribute('aria-valuemin', '0');
        this.setAttribute('aria-valuemax', String(top));
        this.setAttribute('aria-valuenow', String(value));
        if (this.valueText) this.setAttribute('aria-valuetext', this.valueText);
        else this.removeAttribute('aria-valuetext');
        if (this.label) this.setAttribute('aria-label', this.label);
    }

    render() {
        return html`
            <div class="track" aria-hidden="true">
                <div class="fill" style="--_ui-progress-at:${pct(this.#reading.fraction)}"></div>
            </div>
        `;
    }
}

customElements.define('ui-progress-track', UiProgressTrack);
