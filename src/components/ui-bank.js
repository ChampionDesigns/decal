/**
 * <ui-bank> — a segmented bank: a row of equal cells, one of them chosen.
 */

import { css, html, nothing } from 'lit';

import { UiElement, selectionSurface } from 'src/components/base.js';
import { bindPressHold } from 'src/lib/press-hold.js';

const MODES = {
    radio: { host: 'radiogroup', item: 'radio', state: 'aria-checked' },
    tablist: { host: 'tablist', item: 'tab', state: 'aria-selected' },
    toolbar: { host: 'group', item: null, state: 'aria-pressed' },
};

const DEFAULT_MODE = 'radio';

function normaliseItem(raw, index) {
    if (raw !== null && typeof raw === 'object') {
        const value = String(raw.value ?? raw.label ?? index);
        return {
            value,
            label: String(raw.label ?? raw.value ?? ''),
            disabled: raw.disabled === true,
            controls: raw.controls ? String(raw.controls) : null,
        };
    }
    const value = String(raw);
    return { value, label: value, disabled: false, controls: null };
}

export class UiBank extends UiElement {
    static properties = {
        /* Strings, or { value, label, disabled, controls }. Parsed from a JSON attribute so
           a bank can be stated in markup. */
        items: { type: Array },

        /* The chosen value. Reflected. */
        value: { type: String, reflect: true },

        /* Which ARIA spelling this bank speaks: radio, tablist or toolbar. */
        mode: { type: String, reflect: true },

        /* Accessible name for the group. */
        label: { type: String },

        density: { type: String, reflect: true },

        /* Offer a second action per cell on hold. Off by default: a hidden gesture on a
           control with no second action is a trap. */
        hold: { type: Boolean, reflect: true },

        tall: { type: Boolean, reflect: true },

        plain: { type: Boolean, reflect: true },

        disabled: { type: Boolean, reflect: true },
    };

    static styles = [
        css`
            :host {
                --_ui-item-inset: var(--ui-space-4);

                --_ui-bank-row: var(--ui-control-h);
                --_ui-bank-item: var(--ui-control-inner);

                display: grid;
                grid-auto-flow: column;
                grid-auto-columns: 1fr;
                align-items: stretch;

                container-type: normal;

                border: var(--ui-border-w) solid var(--ui-line);
                border-radius: var(--ui-radius);

                background-color: var(--ui-key);

                min-block-size: var(--_ui-bank-row);

                overflow: hidden;
                --_ui-focus-offset: var(--ui-focus-offset-inset);
            }

            :host([density="compact"]) {
                --_ui-item-inset: var(--ui-space-2);
            }

            :host([tall]) {
                --_ui-bank-row: var(--ui-control-lg);
                --_ui-bank-item: calc(var(--ui-control-lg) - 2 * var(--ui-hairline));
            }

            :host([plain]) {
                --_ui-bank-item: var(--ui-hit-min);
                --_ui-bank-row: calc(var(--ui-hit-min) + 2 * var(--ui-hairline));
            }

            .item {
                min-inline-size: var(--_ui-bank-item-min, 0);

                min-block-size: var(--_ui-bank-item);

                display: flex;
                align-items: center;
                justify-content: center;

                padding-block: 0;
                padding-inline: var(--_ui-item-inset);

                border: 0;
                border-radius: 0;

                background-color: transparent;

                color: var(--ui-muted);

                /* A button does not inherit its font: the browser sets the font shorthand on it,
                   resetting family, size, weight and line-height together. */
                font-family: inherit;
                line-height: inherit;
                font-size: var(--ui-text-base);
                font-weight: var(--ui-weight-regular);

                cursor: pointer;
            }

            /* No selected-state rule here — the shared selection surface paints it, so every
               selection in the app moves together. */

            .label {
                min-inline-size: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            :where(.item + .item) {
                --_ui-rest-shadow: inset var(--ui-seam) 0 0 0 var(--ui-seam-ink);
                box-shadow: var(--_ui-rest-shadow);
            }

            .item:where(:hover) {
                color: var(--ui-text-2);
            }

            .item:where(:disabled) {
                cursor: default;
            }

            :host([disabled]) .item:disabled {
                opacity: 1;
            }
        `,
        selectionSurface,
    ];

    constructor() {
        super();
        this.items = [];
        this.value = '';
        this.mode = DEFAULT_MODE;
        this.label = '';
        this.density = 'regular';
        this.disabled = false;
        this.hold = false;
    }

    /* The root's gesture binding, or null while hold is off. */
    #holdOff = null;

    /* The author's role and label, captured once so mode never overwrites what a
       screen stated deliberately. */
    #authorRole = null;

    #authorLabel = null;

    #captured = false;

    /* Which item is the tab stop when that is not the selected one. null means
       "follow the selection". */
    #roving = null;

    get #mode() {
        return Object.prototype.hasOwnProperty.call(MODES, this.mode) ? this.mode : DEFAULT_MODE;
    }

    get #items() {
        return (Array.isArray(this.items) ? this.items : []).map(normaliseItem);
    }

    /* Nothing to clean up on disconnect: every listener is on this element or its own
       root. */
    connectedCallback() {
        super.connectedCallback();
        if (!this.#captured) {
            this.#authorRole = this.getAttribute('role');
            this.#authorLabel = this.getAttribute('aria-label');
            this.#captured = true;
        }
    }

    willUpdate(changed) {
        super.willUpdate?.(changed);
        if (changed.has('value') || changed.has('items') || changed.has('mode')) {
            this.#roving = null;
        }
    }

    updated(changed) {
        super.updated(changed);
        this.#bindHold();
        if (this.#authorRole === null) this.setAttribute('role', MODES[this.#mode].host);
        if (this.label) this.setAttribute('aria-label', this.label);
        else if (this.#authorLabel !== null) this.setAttribute('aria-label', this.#authorLabel);
        else this.removeAttribute('aria-label');
        if (this.disabled) this.setAttribute('aria-disabled', 'true');
        else this.removeAttribute('aria-disabled');
    }

    /* Bound once to the root; binding every cell would rebind on every render. */
    #bindHold() {
        const wanted = !!this.hold;
        if (wanted === (this.#holdOff !== null)) return;
        if (!wanted) {
            this.#holdOff();
            this.#holdOff = null;
            return;
        }
        this.#holdOff = bindPressHold(this.renderRoot, {
            onHold: ({ path }) => {
                if (this.disabled) return;
                /* The path is the pointerdown's, captured at press time — reading it off the event
                   here answers empty, because the hold completes after the pointer has moved on. */
                const button = path.find((node) => node instanceof Element
                    && node.classList?.contains('item'));
                if (!button) return;
                const index = [...this.renderRoot.querySelectorAll('.item')].indexOf(button);
                const item = this.#items[index];
                if (!item) return;
                /* A disabled cell still holds: an empty favourite slot refuses the press and is
                   exactly the slot a person holds to fill. */
                this.dispatchEvent(new CustomEvent('item-hold', {
                    detail: { value: item.value, index },
                    bubbles: true,
                    composed: true,
                }));
            },
        });
    }

    disconnectedCallback() {
        if (this.#holdOff) { this.#holdOff(); this.#holdOff = null; }
        super.disconnectedCallback();
    }

    #tabStop(items) {
        if (this.#roving !== null && items[this.#roving] && !items[this.#roving].disabled) {
            return this.#roving;
        }
        const selected = items.findIndex((item) => item.value === this.value && !item.disabled);
        if (selected >= 0) return selected;
        return items.findIndex((item) => !item.disabled);
    }

    render() {
        const items = this.#items;
        const mode = MODES[this.#mode];
        const stop = this.#tabStop(items);

        return items.map((item, index) => {
            const on = item.value === this.value;
            return html`
                <button
                    id="item-${index}"
                    part="item"
                    class="item"
                    type="button"
                    role=${mode.item ?? nothing}
                    aria-controls=${item.controls ?? nothing}
                    aria-checked=${mode.state === 'aria-checked' ? String(on) : nothing}
                    aria-selected=${mode.state === 'aria-selected' ? String(on) : nothing}
                    aria-pressed=${mode.state === 'aria-pressed' ? String(on) : nothing}
                    tabindex=${index === stop ? '0' : '-1'}
                    ?disabled=${this.disabled || item.disabled}
                    @click=${() => this.#choose(index)}
                    @keydown=${(event) => this.#onKeydown(event, index)}
                >
                    <span class="label"><slot name="item-${item.value}">${item.label}</slot></span>
                </button>
            `;
        });
    }

    /* Choose an item. The only place change is fired, and never for a programmatic
       write. */
    #choose(index) {
        const items = this.#items;
        const item = items[index];
        if (!item || item.disabled || this.disabled) return;
        if (item.value === this.value) return;
        this.value = item.value;
        this.dispatchEvent(new CustomEvent('change', {
            detail: { value: item.value, index },
            bubbles: true,
            composed: true,
        }));
    }

    /* The next enabled index in dir, wrapping; null if there is none. */
    #step(from, dir) {
        const items = this.#items;
        const n = items.length;
        for (let k = 1; k <= n; k++) {
            const i = ((from + dir * k) % n + n) % n;
            if (!items[i].disabled) return i;
        }
        return null;
    }

    #edge(dir) {
        const items = this.#items;
        for (let k = 0; k < items.length; k++) {
            const i = dir > 0 ? k : items.length - 1 - k;
            if (!items[i].disabled) return i;
        }
        return null;
    }

    async #focusItem(index) {
        await this.updateComplete;
        this.shadowRoot?.getElementById(`item-${index}`)?.focus();
    }

    #onKeydown(event, index) {
        let next = null;
        switch (event.key) {
            case 'ArrowRight': next = this.#step(index, 1); break;
            case 'ArrowLeft': next = this.#step(index, -1); break;
            case 'Home': next = this.#edge(1); break;
            case 'End': next = this.#edge(-1); break;
            case ' ':
            case 'Spacebar':
            case 'Enter':
                /* Space would scroll the page otherwise. */
                event.preventDefault();
                this.#choose(index);
                return;
            default:
                return;
        }
        if (next === null) return;
        event.preventDefault();
        if (this.#mode === 'toolbar') {
            this.#roving = next;
            this.requestUpdate();
        } else {
            this.#choose(next);
        }
        this.#focusItem(next);
    }
}

customElements.define('ui-bank', UiBank);
