/**
 * Ui-tab-bar.
 */

import { css, html } from 'lit';
import { UiElement } from 'src/components/base.js';
import 'src/components/ui-bank.js';

const MANAGED_ATTRIBUTES = ['role', 'tabindex', 'aria-label', 'hidden', 'inert'];

const SUPPORTS_ARIA_ELEMENT_REFLECTION = typeof Element !== 'undefined'
    && 'ariaControlsElements' in Element.prototype;

/** Strings or objects in, one shape out — the same normalisation ui-bank does. */
function normaliseTab(raw, index) {
    if (raw !== null && typeof raw === 'object') {
        const value = String(raw.value ?? raw.label ?? index);
        return {
            value,
            label: String(raw.label ?? raw.value ?? ''),
            disabled: raw.disabled === true,
        };
    }
    const value = String(raw);
    return { value, label: value, disabled: false };
}

/** Duck-typed rather than `instanceof Element`: a panel may come from another realm. */
function isElement(node) {
    return Boolean(node) && typeof node.setAttribute === 'function'
        && typeof node.getAttribute === 'function';
}

export class UiTabBar extends UiElement {
    static properties = {
        tabs: { type: Array },

        /** The selected tab's value. Reflected: it is the state, and tests read it. */
        value: { type: String, reflect: true },

        /**
         * The accessible name of the TABLIST. Lands on ui-bank's host, which is the
         * element carrying `role="tablist"`, so the name is on the thing it names.
         */
        label: { type: String },

        hostLabel: { type: String, attribute: 'aria-label' },

        /** Paint dims and every tab refuses input. Reflected; the base dims the host. */
        disabled: { type: Boolean, reflect: true },

        stretch: { type: Boolean, reflect: true },

        panels: { attribute: false },
    };

    static styles = [
        css`
            :host {
                display: grid;
                grid-template-rows: auto minmax(0, 1fr);
                min-block-size: 0;

                container-type: normal;
            }

            .tabs {
                block-size: var(--ui-control-lg);
                inline-size: fit-content;
                max-inline-size: 100%;

            }

            :host([stretch]) .tabs {
                inline-size: 100%;
            }

            .panels {
                min-block-size: 0;
            }

            :host([disabled]) .tabs {
                opacity: 1;
            }
        `,
    ];

    #managed = new Map();

    /** The host `aria-label` this component has taken over; see `updated()`. */
    #adoptedLabel = null;

    /** True for exactly one update: the one where WE removed the host's aria-label. */
    #adopting = false;

    get #tabs() {
        return (Array.isArray(this.tabs) ? this.tabs : []).map(normaliseTab);
    }

    /** The tablist's accessible name, in the order a caller would expect. */
    get accessibleName() {
        return this.label || this.hostLabel || this.#adoptedLabel || '';
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.hasUpdated) this.#syncPanels();
    }

    disconnectedCallback() {
        super.disconnectedCallback?.();
        this.#dropControls();
        for (const el of [...this.#managed.keys()]) this.#release(el);
    }

    render() {
        return html`
            <ui-bank
                id="tablist"
                class="tabs"
                exportparts="item"
                mode="tablist"
                .items=${this.#tabs}
                .value=${this.value ?? ''}
                .label=${this.accessibleName}
                ?disabled=${this.disabled}
                @change=${this.#onBankChange}
            ></ui-bank>
            <div class="panels">
                <slot @slotchange=${this.#onSlotChange}></slot>
            </div>
        `;
    }

    willUpdate(changed) {
        super.willUpdate?.(changed);
        if (!changed.has('hostLabel')) return;
        if (this.hostLabel) this.#adoptedLabel = this.hostLabel;
        else if (!this.#adopting) this.#adoptedLabel = null;
        this.#adopting = false;
    }

    updated(changed) {
        super.updated(changed);
        if (this.#adoptedLabel && this.hasAttribute('aria-label')) {
            this.#adopting = true;
            this.removeAttribute('aria-label');
        }
        this.#syncPanels();
        this.#bank?.updateComplete?.then(() => this.#syncControls(), () => {});
    }

    /**
     * `[value, element]` pairs from whichever hand-over the screen used. Explicit
     * `panels` wins outright — see the property's note on why they never merge.
     */
    #panelPairs() {
        const explicit = this.panels;
        if (explicit) {
            const raw = explicit instanceof Map
                ? [...explicit.entries()]
                : (typeof explicit === 'object' ? Object.entries(explicit) : []);
            return raw
                .filter(([, el]) => isElement(el))
                .map(([value, el]) => [String(value), el]);
        }
        const slot = this.renderRoot?.querySelector?.('slot');
        if (!slot) return [];
        return slot.assignedElements({ flatten: true })
            .filter((el) => isElement(el) && typeof el.dataset?.tab === 'string')
            .map((el) => [el.dataset.tab, el]);
    }

    #capture(el) {
        const prior = {};
        for (const name of MANAGED_ATTRIBUTES) prior[name] = el.getAttribute(name);
        return { prior, mine: {} };
    }

    #write(el, record, name, value) {
        if (value === null) el.removeAttribute(name);
        else el.setAttribute(name, value);
        record.mine[name] = value;
    }

    #reconcile(el, record) {
        for (const name of MANAGED_ATTRIBUTES) {
            const written = record.mine[name];
            if (written === undefined) continue;
            const current = el.getAttribute(name);
            if (current === written) continue;
            record.prior[name] = current;
            delete record.mine[name];
        }
    }

    #release(el) {
        const record = this.#managed.get(el);
        this.#managed.delete(el);
        if (!record) return;
        /* Reconcile on the way out too: the last write a screen made may have landed
         * after the last sync, and it is still the screen's, not ours to discard. */
        this.#reconcile(el, record);
        for (const name of MANAGED_ATTRIBUTES) {
            const value = record.prior[name];
            if (value === null) el.removeAttribute(name);
            else el.setAttribute(name, value);
        }
    }

    #syncPanels() {
        const labels = new Map(this.#tabs.map((tab) => [tab.value, tab.label]));
        const seen = new Set();

        for (const [value, el] of this.#panelPairs()) {
            if (!labels.has(value)) continue;
            seen.add(el);
            if (!this.#managed.has(el)) this.#managed.set(el, this.#capture(el));
            const record = this.#managed.get(el);

            this.#reconcile(el, record);

            this.#write(el, record, 'role', 'tabpanel');

            this.#write(el, record, 'tabindex', '0');

            const label = labels.get(value);
            if (label && record.prior['aria-label'] === null && !el.hasAttribute('aria-labelledby')) {
                this.#write(el, record, 'aria-label', label);
            }

            const active = value === this.value;
            this.#write(el, record, 'hidden', active ? null : '');
            this.#write(el, record, 'inert', active ? null : '');
        }

        for (const el of [...this.#managed.keys()]) {
            if (!seen.has(el)) this.#release(el);
        }

        this.#syncControls();
    }

    #syncControls() {
        if (!SUPPORTS_ARIA_ELEMENT_REFLECTION || !this.isConnected) return;
        const buttons = this.#bank?.renderRoot?.querySelectorAll?.('button');
        if (!buttons?.length) return;

        const panels = new Map(this.#panelPairs());
        this.#tabs.forEach((tab, index) => {
            const button = buttons[index];
            if (!button) return;
            const panel = panels.get(tab.value);
            button.ariaControlsElements = panel ? [panel] : null;
        });
    }

    /** Every reference this component made, dropped. */
    #dropControls() {
        if (!SUPPORTS_ARIA_ELEMENT_REFLECTION) return;
        for (const button of this.#bank?.renderRoot?.querySelectorAll?.('button') ?? []) {
            button.ariaControlsElements = null;
        }
    }

    /** The one ui-bank this component renders. */
    get #bank() {
        return this.renderRoot?.querySelector?.('#tablist') ?? null;
    }

    #onSlotChange() {
        this.#syncPanels();
    }

    #onBankChange(event) {
        const next = event.detail?.value;
        if (next === undefined || next === this.value) return;
        this.value = next;
        this.#syncPanels();
    }
}

customElements.define('ui-tab-bar', UiTabBar);
