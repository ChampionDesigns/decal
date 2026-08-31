/**
 * One key of the time picker.
 */

import { css, html } from 'lit';

import { UiElement } from './base.js';
import { typeRoles } from './type-roles.js';

/** How many gradient stops the strip paints. The ramp's own count; see the CSS. */
export const TIMEKEY_STOPS = 10;

export class UiTimeKey extends UiElement {
    static properties = {
        /**
         * The value at the TOP of the strip, in the caption's unit. The bottom is
         * `from`. Rounded to whole units for display and never otherwise touched.
         */
        seconds: { type: Number },

        /** The value at the bottom of the strip. Zero on every caller today. */
        from: { type: Number },

        /** The unit, under the strip — already translated. */
        caption: { type: String },

        /** The GROUP's accessible name, on the host as `aria-label`. */
        label: { type: String },
    };

    static styles = [typeRoles, css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--ui-space-1);
            inline-size: var(--ui-timekey-w);
            flex: 0 0 auto;
            color: var(--ui-text-2);
        }

        .strip {
            inline-size: var(--ui-timekey-strip-w);
            flex: 1 1 auto;
            min-block-size: 0;
            border: var(--ui-hairline) solid var(--ui-line);
            border-radius: var(--ui-radius-sm);
            background-image: linear-gradient(
                to top,
                var(--ui-timekey-stop-0) 0%,
                var(--ui-timekey-stop-1) 11.111%,
                var(--ui-timekey-stop-2) 22.222%,
                var(--ui-timekey-stop-3) 33.333%,
                var(--ui-timekey-stop-4) 44.444%,
                var(--ui-timekey-stop-5) 55.556%,
                var(--ui-timekey-stop-6) 66.667%,
                var(--ui-timekey-stop-7) 77.778%,
                var(--ui-timekey-stop-8) 88.889%,
                var(--ui-timekey-stop-9) 100%
            );
        }

        .value,
        .caption {
            font-size: var(--ui-chart-legend);
            line-height: 1.2;
            text-align: center;
        }
    `];

    constructor() {
        super();
        this.seconds = 0;
        this.from = 0;
        this.caption = '';
        this.label = '';
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('role')) this.setAttribute('role', 'group');
    }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('label')) {
            if (this.label) this.setAttribute('aria-label', this.label);
            else this.removeAttribute('aria-label');
        }
    }

    render() {
        const top = Number.isFinite(this.seconds) ? Math.round(this.seconds) : 0;
        const bottom = Number.isFinite(this.from) ? Math.round(this.from) : 0;
        return html`
            <span class="value ui-numeric" part="value-top">${top}</span>
            <div class="strip" part="strip" aria-hidden="true"></div>
            <span class="value ui-numeric" part="value-bottom">${bottom}</span>
            ${this.caption
                ? html`<span class="caption ui-caption" part="caption">${this.caption}</span>`
                : null}
        `;
    }
}

customElements.define('ui-time-key', UiTimeKey);
