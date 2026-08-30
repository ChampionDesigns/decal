/**
 * The one press control. Variants and sizes are attributes; there is no second button.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';

/** The four the spec names. Anything else falls back to `default` rather than blanking
 *  the control - the same choice base.js makes for an unrecognised focus-ring value. */
export const BUTTON_VARIANTS = Object.freeze(['default', 'primary', 'ghost', 'danger']);

export class UiButton extends UiElement {
    static properties = {
        /** 'default' | 'primary' | 'ghost' | 'danger'. */
        variant: { type: String, reflect: true },
        tall: { type: Boolean, reflect: true },
        bare: { type: Boolean, reflect: true },
        /** Paint AND refusal: the base dims the host, the inner control refuses. */
        disabled: { type: Boolean, reflect: true },
        /** Accessible name, for a slot that holds a glyph rather than words. */
        label: { type: String },
    };

    static styles = [css`
        :host {
            container-type: normal;
            display: inline-grid;

        }

        .btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--ui-space-2);
            min-block-size: var(--ui-control-h);

            min-inline-size: 0;

            padding-inline: var(--ui-space-5);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            background-color: transparent;
            color: var(--ui-text-2);
            font-family: inherit;
            font-size: var(--ui-text-base);
            font-weight: var(--ui-weight-medium);
            cursor: pointer;
            box-shadow: none;
        }

        :host([tall]) .btn {
            min-block-size: var(--ui-control-lg);
        }

        :host([bare]) .btn {
            min-block-size: 0;
            padding-inline: 0;
            border-width: 0;
            /* The UA sheet's own padding of 1px 6px on a button: the inline half is
             * covered above, and the block half is two more pixels of row. */
            padding-block: 0;
            font-size: inherit;
            font-weight: inherit;
            line-height: inherit;
            letter-spacing: inherit;
            text-transform: inherit;
        }

        :host([variant="primary"]) .btn {
            border-color: color-mix(in srgb, var(--ui-primary) 72%, var(--ui-steel));
            background-color: var(--ui-primary);
            color: var(--ui-on-primary);
        }

        :host([variant="ghost"]) .btn {
            border-color: transparent;
            background-color: transparent;
        }

        :host([variant="danger"]) .btn {
            border-color: color-mix(in srgb, var(--ui-status-danger) 72%, var(--ui-line));
            background-color: color-mix(in srgb, var(--ui-status-danger) 14%, transparent);
            color: var(--ui-status-danger);
        }

        .btn[disabled] {
            opacity: 1;
            cursor: default;
        }
    `];

    constructor() {
        super();
        this.variant = 'default';
        this.tall = false;
        this.bare = false;
        this.disabled = false;
        this.label = '';
    }

    /** The inner control - what focus, the press and the native `disabled` belong to. */
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

    /** Normalise before paint, so `variant="Primary"` and `variant="nope"` are a
     *  documented fallback rather than an unstyled control. */
    willUpdate(changed) {
        if (changed.has('variant')) {
            const raw = String(this.variant ?? '').trim().toLowerCase();
            const next = BUTTON_VARIANTS.includes(raw) ? raw : 'default';
            if (next !== this.variant) this.variant = next;
        }
    }

    render() {
        return html`<button
            id="btn"
            class="btn"
            type="button"
            ?disabled=${this.disabled}
            aria-label=${this.label ? this.label : nothing}
        ><slot></slot></button>`;
    }
}

customElements.define('ui-button', UiButton);
