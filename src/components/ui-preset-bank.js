/**
 * Ui-preset-bank.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';
import 'src/components/ui-bank.js';

import { hasReading } from 'src/data/reading.js';
import { decimalsForStep, formatToStep } from 'src/stores/units.js';

const MAX_DECIMALS = 3;

/** Numbers or objects in, one shape out — the same normalisation ui-bank does. */
function normalisePreset(raw) {
    if (raw !== null && typeof raw === 'object') {
        return {
            value: Number(raw.value),
            label: raw.label === undefined || raw.label === null ? null : String(raw.label),
            disabled: raw.disabled === true,
        };
    }
    return { value: Number(raw), label: null, disabled: false };
}

function inferStep(presets) {
    let decimals = 0;
    for (const preset of presets) {
        if (!hasReading(preset.value)) continue;
        decimals = Math.max(decimals, decimalsForStep(preset.value));
    }
    return decimals > 0 ? Number(`1e-${Math.min(decimals, MAX_DECIMALS)}`) : 1;
}

export class UiPresetBank extends UiElement {
    static properties = {
        presets: { type: Array },

        value: { type: Number },

        step: { type: Number },

        /** Accessible name for the GROUP — the question the row answers. */
        label: { type: String },

        /** Paint AND behaviour, both inherited from the bank underneath. */
        disabled: { type: Boolean, reflect: true },

        hold: { type: Boolean, reflect: true },
    };

    static styles = [
        css`
            :host {
                --ui-selected-face: var(--ui-preset-selected-face);
                --ui-selected-ink: var(--ui-preset-selected-ink);
                --ui-selected-led: var(--ui-preset-selected-led);
            }

            .presets {
                background-color: transparent;
                border-color: transparent;

            }

            :host([disabled]) .presets {
                opacity: 1;
            }
        `,
    ];

    constructor() {
        super();
        this.presets = [];
        this.value = null;
        this.step = null;
        this.label = '';
        this.disabled = false;
        this.hold = false;
    }

    #hostLabel = null;

    /** The bank's accessible name, in the order a caller would expect. */
    get accessibleName() {
        return this.label || this.#hostLabel || '';
    }

    /** The presets, normalised. */
    get #presets() {
        return (Array.isArray(this.presets) ? this.presets : []).map(normalisePreset);
    }

    /** The precision both the labels and the match are read at. */
    get #step() {
        const stated = Number(this.step);
        return Number.isFinite(stated) && stated > 0 ? stated : inferStep(this.#presets);
    }

    get activeIndex() {
        if (!hasReading(this.value)) return -1;
        const step = this.#step;
        const target = formatToStep(this.value, step);
        return this.#presets.findIndex(
            (preset) => hasReading(preset.value) && formatToStep(preset.value, step) === target,
        );
    }

    /** The bank's item key for the active preset, or the empty key for none. */
    get #activeKey() {
        const index = this.activeIndex;
        return index >= 0 ? String(index) : '';
    }

    get #items() {
        const step = this.#step;
        return this.#presets.map((preset, index) => ({
            value: String(index),
            label: preset.label ?? formatToStep(preset.value, step),
            disabled: preset.disabled,
        }));
    }

    /** The one bank this component renders. */
    get #bank() {
        return this.shadowRoot?.getElementById('presets') ?? null;
    }

    connectedCallback() {
        super.connectedCallback();
        this.#adoptHostLabel();
    }

    render() {
        return html`
            <ui-bank
                id="presets"
                class="presets"
                mode="toolbar"
                density="compact"
                plain
                .items=${this.#items}
                .value=${this.#activeKey}
                .label=${this.accessibleName}
                ?disabled=${this.disabled}
                ?hold=${this.hold}
                @change=${this.#onBankChange}
                @item-hold=${this.#onBankHold}
            ></ui-bank>
        `;
    }

    updated(changed) {
        super.updated(changed);
        if (this.#adoptHostLabel()) this.requestUpdate();
        this.#holdHighlight();
    }

    /**
     * Move a screen-written `aria-label` onto the bank. Returns true only on the update
     * that actually moved one, so the extra render this asks for happens once.
     */
    #adoptHostLabel() {
        const written = this.getAttribute('aria-label');
        if (written === null) return false;
        this.#hostLabel = written;
        this.removeAttribute('aria-label');
        return true;
    }

    #holdHighlight() {
        const bank = this.#bank;
        if (!bank) return;
        const key = this.#activeKey;
        if (bank.value !== key) bank.value = key;
    }

    #onBankHold(event) {
        event.stopPropagation();
        const index = Number(event.detail?.value);
        const preset = this.#presets[index];
        if (!preset || this.disabled) return;
        this.dispatchEvent(new CustomEvent('preset-hold', {
            detail: { value: preset.value, label: this.#items[index].label, index },
            bubbles: true,
            composed: true,
        }));
    }

    #onBankChange(event) {
        event.stopPropagation();
        const index = Number(event.detail?.value);
        this.#holdHighlight();

        const preset = this.#presets[index];
        if (!preset || preset.disabled || this.disabled) return;

        this.dispatchEvent(new CustomEvent('preset-select', {
            detail: { value: preset.value, label: this.#items[index].label, index },
            bubbles: true,
            composed: true,
        }));
    }
}

customElements.define('ui-preset-bank', UiPresetBank);
