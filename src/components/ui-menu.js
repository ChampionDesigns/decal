/**
 * A menu of actions, opened from a control and closed by choosing or by leaving.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';

/** Requested placement. The RESOLVED one is published on the host as `placed`. */
const PLACEMENTS = ['auto', 'below', 'above'];

const clamp = (min, value, max) => Math.min(Math.max(value, min), Math.max(min, max));

/** A computed custom property as a number. Unset or unparseable reads as 0. */
const lengthOf = (style, name) => {
    const raw = parseFloat(style.getPropertyValue(name));
    return Number.isFinite(raw) ? raw : 0;
};

export class UiMenu extends UiElement {
    static properties = {
        items: { type: Array },
        open: { type: Boolean, reflect: true },
        /** Accessible name for the list, when the trigger's own name is not enough. */
        label: { type: String },
        /** 'auto' (default) | 'below' | 'above'. A request, not the outcome. */
        placement: { type: String, reflect: true },
        /** The trigger refuses to open. The base dims the host. */
        disabled: { type: Boolean, reflect: true },
    };

    static styles = [
        seams,
        css`
            :host {
                container-type: normal;
                display: inline-block;

                --_ui-menu-gap: var(--ui-space-2);
                --_ui-menu-edge: var(--ui-space-3);

                --_ui-menu-min-block: calc(2 * var(--ui-control-h));

                --_ui-menu-min-inline: 220px;
                --_ui-menu-max-inline: 320px;

                --_ui-menu-arrow-size: 12px;
            }

            :host(:is([disabled], [aria-disabled="true"])) {
                cursor: not-allowed;
            }

            .backdrop {
                position: fixed;
                inset: 0;
                z-index: var(--ui-z-menu);
                background-color: transparent;
            }

            .surface {
                position: fixed;
                inset-block-start: var(--_ui-menu-top, 0px);
                inset-inline-start: var(--_ui-menu-left, 0px);
                z-index: var(--ui-z-menu);

                display: flex;
                flex-direction: column;
                inline-size: max-content;
                min-inline-size: var(--_ui-menu-min-inline);
                max-inline-size: min(
                    var(--_ui-menu-max-inline),
                    calc(100% - 2 * var(--_ui-menu-edge))
                );
                max-block-size: var(--_ui-menu-max-block, none);

                padding: var(--ui-space-1);
                border: var(--ui-border-w) solid var(--ui-line);
                border-radius: var(--ui-radius-xl);
                background-color: var(--ui-surface);
                color: var(--ui-text);

                box-shadow: var(--ui-elev-2);
            }

            .surface::before {
                content: "";
                position: absolute;
                inset-inline-start: var(--_ui-menu-arrow, 50%);
                inline-size: var(--_ui-menu-arrow-size);
                block-size: var(--_ui-menu-arrow-size);
                border: var(--ui-border-w) solid var(--ui-line);
                background-color: var(--ui-surface);
                transform: translateX(-50%) rotate(45deg);
            }

            .surface.below::before {
                inset-block-start: calc(var(--_ui-menu-arrow-size) / -2 - var(--ui-border-w));
                border-inline-end-width: 0;
                border-block-end-width: 0;
            }

            .surface.above::before {
                inset-block-end: calc(var(--_ui-menu-arrow-size) / -2 - var(--ui-border-w));
                border-inline-start-width: 0;
                border-block-start-width: 0;
            }

            .list {
                --_ui-focus-offset: var(--ui-focus-offset-inset);
                min-block-size: var(--ui-control-h);
                overflow-y: auto;
            }

            .group {
                display: grid;
                background-color: var(--ui-surface);
            }

            .item {
                display: flex;
                align-items: center;
                gap: var(--ui-space-3);
                inline-size: 100%;
                min-block-size: var(--ui-control-h);
                margin: 0;
                padding: var(--ui-space-3);
                border: 0;
                border-radius: var(--ui-radius);
                background-color: transparent;
                color: inherit;
                font-family: inherit;
                font-size: var(--ui-text-base);
                font-weight: var(--ui-weight-regular);
                text-align: start;
                cursor: pointer;
            }

            .item:is(:hover, :focus-visible) {
                background-color: var(--ui-key-on);
            }

            .item.danger {
                color: var(--ui-status-danger);
            }

            .item.danger:is(:hover, :focus-visible) {
                background-color: color-mix(in srgb, var(--ui-status-danger) 12%, transparent);
            }

            /* Paint is the base's one disabled dial; this is only the pointer. */
            .item:disabled {
                cursor: not-allowed;
            }

            .icon {
                flex: none;
                display: inline-grid;
                place-items: center;
                inline-size: var(--ui-icon);
                block-size: var(--ui-icon);
            }

            /* min-inline-size: 0 or a long label refuses to wrap inside the flex row
             * and pushes the surface past its own max-inline-size. */
            .label {
                flex: 1 1 auto;
                min-inline-size: 0;
            }
        `,
    ];

    constructor() {
        super();
        this.items = [];
        this.open = false;
        this.label = '';
        this.placement = 'auto';
        this.disabled = false;

        /** Set by an interaction; null for a declarative open. See #focusOnOpen. */
        this.#pendingFocus = null;
        this.#returnFocusTo = null;
        this.#triggerRefs = [];
        /** An anchor other than the slotted trigger — a list row that long-pressed. */
        this.anchorElement = null;
    }

    #pendingFocus;

    #returnFocusTo;

    #triggerRefs;

    #onWindowChange = () => {
        if (this.open) this.#position();
    };

    /** The first element assigned to the trigger slot, or null. */
    get triggerElement() {
        const slot = this.renderRoot?.querySelector?.('slot[name="trigger"]');
        return slot?.assignedElements?.({ flatten: true })?.[0] ?? null;
    }

    /** What the surface is positioned against: an explicit anchor, else the trigger. */
    get anchor() {
        return this.anchorElement ?? this.triggerElement;
    }

    get #surface() {
        return this.renderRoot?.querySelector?.('#surface') ?? null;
    }

    get #enabledItems() {
        return [...(this.renderRoot?.querySelectorAll?.('.item') ?? [])]
            .filter((el) => !el.disabled);
    }

    /** Items split on separators. Empty groups are dropped, so a leading, trailing or
     *  doubled separator cannot draw a seam against nothing. */
    get #groups() {
        const groups = [];
        let current = [];
        (Array.isArray(this.items) ? this.items : []).forEach((item, index) => {
            if (item && item.separator) {
                if (current.length) groups.push(current);
                current = [];
                return;
            }
            if (item) current.push({ item, index });
        });
        if (current.length) groups.push(current);
        return groups;
    }

    /** Open and take focus, as a press would. */
    show({ focus = 'first', reason = 'api' } = {}) {
        if (this.open || this.disabled) return;
        this.#pendingFocus = focus;
        this.#returnFocusTo = deepActiveElement();
        this.open = true;
        this.#announce(reason);
    }

    hide(reason = 'api') {
        if (!this.open) return;
        if (!this.#returnFocusTo && this.#hasFocusInside()) {
            this.#returnFocusTo = this.triggerElement;
        }
        this.open = false;
        this.#restoreFocus();
        this.#announce(reason);
    }

    /** True when the caret is on the surface or on one of its rows. */
    #hasFocusInside() {
        const active = this.renderRoot?.activeElement ?? null;
        return Boolean(active && this.#surface?.contains(active));
    }

    #closeAndReturn(reason) {
        this.hide(reason);
    }

    toggle(reason = 'api') {
        if (this.open) this.hide(reason);
        else this.show({ reason });
    }

    willUpdate(changed) {
        if (changed.has('placement')) {
            const raw = String(this.placement ?? '').trim().toLowerCase();
            const next = PLACEMENTS.includes(raw) ? raw : 'auto';
            if (next !== this.placement) this.placement = next;
        }
    }

    updated(changed) {
        super.updated(changed);

        if (this.disabled) this.setAttribute('aria-disabled', 'true');
        else this.removeAttribute('aria-disabled');

        if (changed.has('open')) {
            if (this.open) {
                this.#attach();
                this.#position();
                this.#focusOnOpen();
            } else {
                this.#detach();
                this.#restoreFocus();
            }
        } else if (this.open) {
            /* Items or placement changed under an open menu: the cap and the flip are
             * both functions of the content, so they are recomputed, not kept. */
            this.#position();
        }

        this.#syncTrigger();
    }

    disconnectedCallback() {
        this.#detach();
        this.#clearTrigger();
        super.disconnectedCallback();
    }

    render() {
        return html`
            <slot
                name="trigger"
                @click=${this.#onTriggerClick}
                @keydown=${this.#onTriggerKeydown}
                @slotchange=${this.#onTriggerSlotChange}
            ></slot>
            ${this.open ? this.#renderSurface() : nothing}
        `;
    }

    #renderSurface() {
        const groups = this.#groups;
        return html`
            <div
                id="backdrop"
                class="backdrop"
                @click=${this.#onBackdropClick}
            ></div>
            <div
                id="surface"
                class="surface"
                tabindex="-1"
                @keydown=${this.#onSurfaceKeydown}
            >
                ${groups.length ? html`
                    <div
                        id="list"
                        class="list seam-grid seam-rows seam-line"
                        role="menu"
                        aria-label=${this.label ? this.label : nothing}
                    >${groups.map((group) => html`
                        <div class="group" role="group">${group.map((entry) => this.#renderItem(entry))}</div>
                    `)}</div>
                ` : nothing}
                <slot></slot>
            </div>
        `;
    }

    #renderItem({ item, index }) {
        const disabled = Boolean(item.disabled);
        return html`
            <button
                class="item ${item.danger ? 'danger' : ''}"
                type="button"
                role="menuitem"
                tabindex="-1"
                data-index=${String(index)}
                ?disabled=${disabled}
                aria-disabled=${disabled ? 'true' : nothing}
                @click=${this.#onItemClick}
            >
                ${item.icon ? html`
                    <span class="icon" aria-hidden="true">${item.icon}</span>
                ` : nothing}
                <span class="label">${item.label ?? ''}</span>
            </button>
        `;
    }

    #position() {
        const surface = this.#surface;
        const anchor = this.anchor;
        if (!surface || !anchor || !anchor.getBoundingClientRect) return;

        const style = getComputedStyle(this);

        surface.style.setProperty('--_ui-menu-max-block', 'none');
        surface.style.setProperty('--_ui-menu-top', '0px');
        surface.style.setProperty('--_ui-menu-left', '0px');
        const origin = surface.getBoundingClientRect();
        const originX = origin.left;
        const originY = origin.top;
        const naturalBlock = origin.height;
        const inlineSize = origin.width;

        const toPainted = surface.offsetWidth > 0 ? origin.width / surface.offsetWidth : 1;
        const toLayout = toPainted > 0 ? 1 / toPainted : 1;

        const gap = lengthOf(style, '--_ui-menu-gap') * toPainted;
        const edge = lengthOf(style, '--_ui-menu-edge') * toPainted;
        const minBlock = lengthOf(style, '--_ui-menu-min-block') * toPainted;
        const arrowSize = lengthOf(style, '--_ui-menu-arrow-size') * toPainted;
        const radius = lengthOf(getComputedStyle(surface), 'border-top-left-radius') * toPainted;

        surface.style.setProperty('--_ui-menu-top', '100%');
        surface.style.setProperty('--_ui-menu-left', '100%');
        const far = surface.getBoundingClientRect();
        const box = { left: originX, top: originY, right: far.left, bottom: far.top };

        const a = anchor.getBoundingClientRect();

        const spaceBelow = box.bottom - a.bottom - gap - edge;
        const spaceAbove = a.top - box.top - gap - edge;

        let place = this.placement;
        if (place !== 'below' && place !== 'above') {
            place = (spaceBelow >= naturalBlock || spaceBelow >= spaceAbove) ? 'below' : 'above';
        }

        let available = place === 'below' ? spaceBelow : spaceAbove;
        if (available < Math.min(naturalBlock, minBlock)) {
            /* Step 3 of the order of surrender: the anchor gap yields, not the items. */
            available = box.bottom - box.top - 2 * edge;
        }
        const maxBlock = Math.max(0, available);
        const blockSize = Math.min(naturalBlock, maxBlock);

        let top = place === 'below' ? a.bottom + gap : a.top - gap - blockSize;
        top = clamp(box.top + edge, top, box.bottom - edge - blockSize);

        let left = a.left + a.width / 2 - inlineSize / 2;
        left = clamp(box.left + edge, left, box.right - edge - inlineSize);

        /* The arrow points at the anchor's centre wherever the clamp put the box, and
         * stops short of the corners so it never straddles the radius. */
        const arrowReach = radius + arrowSize;
        const arrow = clamp(
            arrowReach,
            a.left + a.width / 2 - left,
            Math.max(arrowReach, inlineSize - arrowReach),
        );

        surface.classList.toggle('below', place === 'below');
        surface.classList.toggle('above', place === 'above');
        this.setAttribute('placed', place);

        surface.style.setProperty('--_ui-menu-max-block', `${maxBlock * toLayout}px`);
        surface.style.setProperty('--_ui-menu-arrow', `${arrow * toLayout}px`);
        surface.style.setProperty('--_ui-menu-top', `${(top - originY) * toLayout}px`);
        surface.style.setProperty('--_ui-menu-left', `${(left - originX) * toLayout}px`);
    }

    #attach() {
        window.addEventListener('resize', this.#onWindowChange);
        window.addEventListener('scroll', this.#onWindowChange, true);
    }

    #detach() {
        window.removeEventListener('resize', this.#onWindowChange);
        window.removeEventListener('scroll', this.#onWindowChange, true);
    }

    #focusOnOpen() {
        const want = this.#pendingFocus;
        this.#pendingFocus = null;
        if (!want) return;

        const items = this.#enabledItems;
        if (!items.length) {
            this.#surface?.focus();
            return;
        }
        (want === 'last' ? items[items.length - 1] : items[0]).focus();
    }

    #restoreFocus() {
        const target = this.#returnFocusTo;
        this.#returnFocusTo = null;
        if (!target || !target.isConnected || typeof target.focus !== 'function') return;
        target.focus();
    }

    #focusStep(delta) {
        const items = this.#enabledItems;
        if (!items.length) return;
        const active = this.renderRoot?.activeElement ?? null;
        const at = items.indexOf(active);
        const next = at === -1
            ? (delta > 0 ? 0 : items.length - 1)
            : (at + delta + items.length) % items.length;
        items[next].focus();
    }

    #onTriggerClick = () => {
        if (this.disabled) return;
        if (this.open) this.#closeAndReturn('trigger');
        else this.show({ focus: 'first', reason: 'trigger' });
    };

    #onTriggerKeydown = (event) => {
        if (this.disabled) return;
        if (event.key === 'Escape' && this.open) {
            event.preventDefault();
            event.stopPropagation();
            this.#closeAndReturn('escape');
            return;
        }
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        const focus = event.key === 'ArrowUp' ? 'last' : 'first';
        if (this.open) this.#focusStep(focus === 'last' ? -1 : 1);
        else this.show({ focus, reason: 'keyboard' });
    };

    #onTriggerSlotChange = () => {
        this.#clearTrigger();
        this.#syncTrigger();
    };

    #onBackdropClick = (event) => {
        event.stopPropagation();
        this.#closeAndReturn(this.#pressWasOnTrigger(event) ? 'trigger' : 'outside');
    };

    #pressWasOnTrigger(event) {
        const trigger = this.triggerElement;
        if (!trigger || typeof event.clientX !== 'number') return false;
        /* Both zero is the synthetic click, not the top-left pixel. */
        if (event.clientX === 0 && event.clientY === 0) return false;
        const r = trigger.getBoundingClientRect();
        return event.clientX >= r.left && event.clientX <= r.right
            && event.clientY >= r.top && event.clientY <= r.bottom;
    }

    #onSurfaceKeydown = (event) => {
        switch (event.key) {
            case 'Escape':
                event.preventDefault();
                event.stopPropagation();
                this.#closeAndReturn('escape');
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.#focusStep(1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.#focusStep(-1);
                break;
            case 'Home': {
                event.preventDefault();
                const items = this.#enabledItems;
                if (items.length) items[0].focus();
                break;
            }
            case 'End': {
                event.preventDefault();
                const items = this.#enabledItems;
                if (items.length) items[items.length - 1].focus();
                break;
            }
            case 'Tab':
                this.#closeAndReturn('tab');
                break;
            default:
                break;
        }
    };

    #onItemClick = (event) => {
        const button = event.currentTarget;
        if (button.disabled) return;
        const index = Number(button.dataset.index);
        const item = (Array.isArray(this.items) ? this.items : [])[index];
        if (!item) return;

        this.#closeAndReturn('select');
        this.dispatchEvent(new CustomEvent('select', {
            detail: { id: item.id ?? null, index, item },
            bubbles: true,
            composed: true,
        }));
    };

    #announce(reason) {
        this.dispatchEvent(new CustomEvent('open-change', {
            detail: { open: this.open, reason },
            bubbles: true,
            composed: true,
        }));
    }

    #syncTrigger() {
        const el = this.triggerElement;
        if (!el) return;
        const control = el.control instanceof HTMLElement ? el.control : null;
        const next = control ? [control] : [el];

        for (const old of this.#triggerRefs) {
            if (next.includes(old)) continue;
            old.removeAttribute('aria-haspopup');
            old.removeAttribute('aria-expanded');
        }

        this.#triggerRefs = next;
        for (const target of this.#triggerRefs) {
            target.setAttribute('aria-haspopup', 'menu');
            target.setAttribute('aria-expanded', this.open ? 'true' : 'false');
        }
    }

    #clearTrigger() {
        for (const target of this.#triggerRefs) {
            target.removeAttribute('aria-haspopup');
            target.removeAttribute('aria-expanded');
        }
        this.#triggerRefs = [];
    }
}

/** activeElement through shadow roots — what "the element that had focus" means here. */
function deepActiveElement() {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    return el;
}

customElements.define('ui-menu', UiMenu);
