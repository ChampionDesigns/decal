/**
 * The bank of profile shortcuts, and the hold gesture that assigns one.
 */

import { css, html, nothing } from 'lit';

import { UiElement, visuallyHidden } from 'src/components/base.js';
import 'src/components/ui-bank.js';
import 'src/components/ui-favourite-slot.js';

const DEFAULT_CAPACITY = 5;

const EMPTY_VALUE_PREFIX = '#empty-';

/** Strings, objects, holes — one shape out. `slot` is the 1-based position. */
function normaliseFavourite(raw, index) {
    const slot = index + 1;
    const blank = {
        value: `${EMPTY_VALUE_PREFIX}${slot}`,
        name: '',
        a11y: String(slot),
        filled: false,
        slot,
    };

    if (raw === null || raw === undefined || raw === '') return blank;

    if (typeof raw === 'object') {
        const filled = raw.filled !== false;
        const name = String(raw.name ?? raw.label ?? '');
        const value = raw.value === undefined || raw.value === null
            ? (filled && name ? name : blank.value)
            : String(raw.value);
        return {
            value,
            /* An empty slot holds no profile, so it has no visible name. */
            name: filled ? name : '',
            /* Named for a screen reader either way: the profile, or the position. */
            a11y: name || String(slot),
            filled,
            slot,
        };
    }

    const value = String(raw);
    return { value, name: value, a11y: value, filled: true, slot };
}

export class UiFavouritesBank extends UiElement {
    static properties = {
        favourites: { type: Array },

        /** How many cells the row shows, regardless of how many are filled. */
        capacity: { type: Number },

        /** The current favourite's value. Reflected: it is the state tests read. */
        value: { type: String, reflect: true },

        /** Accessible name for the GROUP. Lands on ui-bank's host, which has the role. */
        label: { type: String },

        /** Paint AND behaviour — both are ui-bank's, passed straight through. */
        disabled: { type: Boolean, reflect: true },

        hold: { type: Boolean, reflect: true },

        tall: { type: Boolean, reflect: true },

        plain: { type: Boolean, reflect: true },

        manage: { type: Boolean, reflect: true },
    };

    static styles = [
        visuallyHidden,
        css`

            :host {
                min-inline-size: calc(
                    var(--_ui-fav-cells, 5) * (var(--ui-hit-min) + 2 * var(--ui-space-4))
                );
            }

            /* The bank fills the row. Nothing else here is a box. */
            .bank {
                inline-size: 100%;
            }

            .cell {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: var(--ui-space-3);
                /* Shrink with the cell rather than forcing it wider — the bank's
                 * items are flex: 1 1 0 and this is what lets them mean it. */
                min-inline-size: 0;
            }

            .mark {
                flex: 0 0 auto;
                pointer-events: none;

                --_ui-rest-shadow: 0 0 transparent;
            }

            .name {
                flex: 0 1 auto;
                min-inline-size: 0;
                overflow: hidden;

                font-size: var(--ui-text-lg);
                line-height: 1.2;

                white-space: normal;
                overflow-wrap: anywhere;
                text-wrap: balance;

                max-block-size: calc(2 * 1.2em);
            }

        `,
    ];

    constructor() {
        super();
        this.favourites = [];
        this.capacity = DEFAULT_CAPACITY;
        this.value = '';
        this.label = '';
        this.disabled = false;
        this.hold = false;
        this.plain = false;
    }

    #authorLabel = null;

    #captured = false;

    connectedCallback() {
        super.connectedCallback();
        if (!this.#captured) {
            this.#authorLabel = this.getAttribute('aria-label');
            this.#captured = true;
        }
    }

    /** The group's accessible name — the property first, then what the screen wrote. */
    get #groupName() {
        return this.label || this.#authorLabel || '';
    }

    /** `capacity` cells, or as many as there are favourites if that is more. */
    get #cells() {
        const raw = Array.isArray(this.favourites) ? this.favourites : [];
        const capacity = Number.isFinite(this.capacity) && this.capacity > 0
            ? Math.trunc(this.capacity)
            : DEFAULT_CAPACITY;
        const n = Math.max(capacity, raw.length);
        const out = [];
        for (let i = 0; i < n; i++) out.push(normaliseFavourite(raw[i], i));
        return out;
    }

    updated(changed) {
        super.updated(changed);

        if (this.#authorLabel !== null && this.hasAttribute('aria-label')) {
            this.removeAttribute('aria-label');
        }

        /* The floor's one unknown (see :host). A count, not a length. */
        this.style.setProperty('--_ui-fav-cells', String(this.#cells.length));
    }

    render() {
        const cells = this.#cells;

        const items = cells.map((cell) => ({
            value: cell.value,
            label: cell.a11y,
            disabled: this.manage ? false : !cell.filled,
        }));

        return html`
            <ui-bank
                id="bank"
                class="bank"
                mode="toolbar"
                ?tall=${this.tall}
                .items=${items}
                .value=${this.value ?? ''}
                .label=${this.#groupName}
                ?disabled=${this.disabled}
                ?hold=${this.hold}
                @change=${this.#onBankChange}
                @item-hold=${this.#onBankHold}
            >
                ${cells.map((cell) => html`
                    <span class="cell" slot="item-${cell.value}">
                        ${this.plain ? nothing : html`<ui-favourite-slot
                            class="mark"
                            inert
                            index=${cell.slot}
                            ?filled=${cell.filled}
                            ?selected=${cell.filled && cell.value === this.value}
                        ></ui-favourite-slot>`}
                        ${cell.name && !this.manage
                            ? html`<span class="name" aria-hidden="true">${cell.name}</span>`
                            : nothing}
                        <span class="a11y">${cell.a11y}</span>
                    </span>
                `)}
            </ui-bank>
        `;
    }

    /** A slot was held. Answered with the SLOT, filled or not — see the `hold` property. */
    #onBankHold(event) {
        const value = event.detail?.value;
        event.stopPropagation();
        const cell = this.#cells.find((c) => c.value === value) ?? null;
        this.dispatchEvent(new CustomEvent('favourite-hold', {
            detail: { value: cell && cell.filled ? cell.value : null, slot: cell ? cell.slot : null,
                filled: cell ? cell.filled : false },
            bubbles: true,
            composed: true,
        }));
    }

    #onBankChange(event) {
        const next = event.detail?.value;
        if (next === undefined) return;
        event.stopPropagation();
        const cell = this.#cells.find((c) => c.value === next) ?? null;
        if (next !== this.value) this.value = next;
        this.dispatchEvent(new CustomEvent('change', {
            detail: {
                ...event.detail,
                slot: cell ? cell.slot : null,
                filled: cell ? cell.filled : false,
            },
            bubbles: true,
            composed: true,
        }));
    }
}

customElements.define('ui-favourites-bank', UiFavouritesBank);
