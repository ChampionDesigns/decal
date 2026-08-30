/**
 * A row of colour swatches, one of them chosen.
 */

import { css, html, nothing } from 'lit';

import { UiElement, selectionSurface, visuallyHidden } from 'src/components/base.js';
import { isNoReading } from 'src/data/reading.js';

const HEX6 = /^#?([0-9a-fA-F]{6})$/;

export function normaliseHex(raw) {
    if (typeof raw !== 'string') return null;
    const match = HEX6.exec(raw.trim());
    return match ? `#${match[1].toLowerCase()}` : null;
}

function normaliseSwatch(raw) {
    const source = raw !== null && typeof raw === 'object' ? raw : { hex: raw };
    const hex = normaliseHex(source.hex);
    if (hex === null) return null;
    return {
        hex,
        label: source.label === undefined || source.label === null ? null : String(source.label),
        disabled: source.disabled === true,
    };
}

/** A swatch's accessible name: what the caller called it, or the colour itself. */
function nameOf(swatch) {
    return swatch.label || swatch.hex.toUpperCase();
}

export class UiColourSwatchRow extends UiElement {
    static properties = {
        swatches: { type: Array },

        columns: { type: Number },

        value: { type: String },

        /** Accessible name for the GROUP — the question the row answers. */
        label: { type: String },

        /** Paint from the base's one disabled dial; behaviour from the real buttons. */
        disabled: { type: Boolean, reflect: true },
    };

    static styles = [
        visuallyHidden,

        css`
            :host {
                --_ui-swatch-size: max(var(--ui-control-h), var(--ui-hit-min));

                /* The gap between the ring and the sample. It is transparent at rest and
                 * becomes --ui-selected-face when pressed, so this length is how much
                 * selected colour there is to see. */
                --_ui-swatch-seat: var(--ui-space-1);
            }

            .row {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: var(--ui-space-3);
            }

            .row[data-columns] {
                display: grid;
                grid-template-columns: repeat(var(--_ui-swatch-columns), auto);
                justify-content: start;
            }

            .swatch {
                display: block;
                position: relative;
                inline-size: var(--_ui-swatch-size);
                block-size: var(--_ui-swatch-size);
                padding: var(--_ui-swatch-seat);
                border: var(--ui-border-w) solid var(--ui-line-strong);
                border-radius: var(--ui-radius-pill);
                background-color: transparent;
                color: var(--ui-text);
                cursor: pointer;
            }

            .swatch[aria-pressed="true"] {
                border-width: var(--ui-border-w-strong);
            }

            .swatch[disabled] {
                cursor: default;
            }

            :host([disabled]) .swatch[disabled] {
                opacity: 1;
            }

            .chip {
                display: block;
                inline-size: 100%;
                block-size: 100%;
                border-radius: inherit;
                background-color: var(--_ui-swatch-fill, transparent);
            }
        `,

        selectionSurface,
    ];

    constructor() {
        super();
        this.swatches = [];
        this.value = null;
        this.label = '';
        this.disabled = false;
        this.columns = 0;
    }

    #hostLabel = null;

    /** The group's accessible name, in the order a caller would expect. */
    get accessibleName() {
        return this.label || this.#hostLabel || '';
    }

    /** The palette, normalised, with unreadable entries dropped. */
    get #swatches() {
        return (Array.isArray(this.swatches) ? this.swatches : [])
            .map(normaliseSwatch)
            .filter((swatch) => swatch !== null);
    }

    /** How many swatches survived normalisation — so a dropped entry is observable. */
    get swatchCount() {
        return this.#swatches.length;
    }

    get activeIndex() {
        if (isNoReading(this.value)) return -1;
        const current = normaliseHex(this.value);
        if (current === null) return -1;
        return this.#swatches.findIndex((swatch) => swatch.hex === current);
    }

    connectedCallback() {
        super.connectedCallback();
        this.#adoptHostLabel();
    }

    render() {
        const swatches = this.#swatches;
        const active = this.activeIndex;
        const name = this.accessibleName;

        return html`
            <div
                id="row"
                class="row"
                role="group"
                aria-label=${name || nothing}
                data-columns=${this.columns > 0 ? String(this.columns) : nothing}
                style=${this.columns > 0 ? `--_ui-swatch-columns: ${this.columns}` : nothing}
            >
                ${swatches.map((swatch, index) => html`
                    <button
                        id="swatch-${index}"
                        class="swatch"
                        type="button"
                        aria-pressed=${index === active ? 'true' : 'false'}
                        ?disabled=${swatch.disabled || this.disabled}
                        @click=${() => this.#press(index)}
                    >
                        <span class="chip" style="--_ui-swatch-fill: ${swatch.hex};"></span>
                        <span class="a11y">${nameOf(swatch)}</span>
                    </button>
                `)}
            </div>
        `;
    }

    updated(changed) {
        super.updated(changed);
        if (this.#adoptHostLabel()) this.requestUpdate();
    }

    /**
     * Move a screen-written `aria-label` onto the group. Returns true only on the update
     * that actually moved one, so the extra render this asks for happens once.
     */
    #adoptHostLabel() {
        const written = this.getAttribute('aria-label');
        if (written === null) return false;
        this.#hostLabel = written;
        this.removeAttribute('aria-label');
        return true;
    }

    #press(index) {
        const swatch = this.#swatches[index];
        if (!swatch || swatch.disabled || this.disabled) return;

        this.dispatchEvent(new CustomEvent('swatch-select', {
            detail: { hex: swatch.hex, label: nameOf(swatch), index },
            bubbles: true,
            composed: true,
        }));
    }
}

customElements.define('ui-colour-swatch-row', UiColourSwatchRow);
