/**
 * <ui-list-row> — a selectable row: a title, an optional provenance chip, and whatever the list slots beside them.
 */

import { css, html, nothing } from 'lit';

import { UiElement, selectionSurface } from 'src/components/base.js';
import 'src/components/ui-badge.js';

/* aria-selected is three-valued and an option carries it in both states, so
   toAttribute never returns null. */
const ARIA_SELECTED = {
    fromAttribute: (value) => value === 'true',
    toAttribute: (value) => (value ? 'true' : 'false'),
};

export class UiListRow extends UiElement {
    static properties = {
        /* Selected, as the ARIA state. Reflected. */
        selected: { reflect: true, attribute: 'aria-selected', converter: ARIA_SELECTED },
        /* The provenance chip's text. Empty renders no chip. */
        provenance: { type: String },

    };

    static styles = [
        css`
            :host {
                display: flex;
                align-items: center;
                gap: var(--ui-space-3);

                min-block-size: var(--ui-list-row);

                padding-inline: var(--ui-space-5);

                background-color: var(--ui-fascia);

                font-size: var(--ui-text-lg);
                font-weight: var(--ui-weight-regular);

                cursor: pointer;
                user-select: none;
            }

            .lead {
                display: flex;
                flex: 1 1 auto;
                align-items: baseline;
                gap: var(--ui-space-2);
                min-inline-size: 0;
            }

            .title {
                min-inline-size: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* The title ellipsises; the chip does not. */
            .provenance {
                flex: none;
            }

            ::slotted(*) {
                flex: none;
            }

        `,
        selectionSurface,
    ];

    constructor() {
        super();
        this.selected = false;
        this.provenance = '';
    }

    /* The row's own accessible name, composed from the title, the chip and the lead
       slot. */
    #composeRowLabel() {
        const root = this.renderRoot;
        if (!root) return '';
        const slotText = (selector) => (root.querySelector(selector)
            ?.assignedNodes?.({ flatten: true }) ?? [])
            .map((node) => node.textContent ?? '')
            .join(' ');
        /* The actions slot is deliberately excluded: a control slotted there carries its own
           name. */
        return [
            slotText('slot:not([name])'),
            root.getElementById('provenance')?.textContent ?? '',
            slotText('slot[name="favourite"]'),
        ].join(' ').replace(/\s+/g, ' ').trim();
    }

    /* Written only for a row whose list has given it a role — a name on a generic is
       announced by nothing. */
    #applyRowLabel() {
        if (this.hasAttribute('aria-labelledby')) return;
        const written = this.getAttribute('aria-label');
        if (written !== null && written !== this.#rowLabel) return;
        const composed = this.hasAttribute('role') ? this.#composeRowLabel() : '';
        if (composed === this.#rowLabel) return;
        this.#rowLabel = composed;
        if (composed) this.setAttribute('aria-label', composed);
        else this.removeAttribute('aria-label');
    }

    #rowLabel = null;

    /* The role is a plain attribute set by the list, so no update fires when it changes
       and the name must be recomposed on every update. */
    #roleWatch = null;

    #onContentChange = () => this.#applyRowLabel();

    /* Set here and never in the constructor: a custom element constructor must not gain
       attributes. */
    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('focus-ring')) this.setAttribute('focus-ring', 'inset');
        if (!this.#roleWatch) {
            this.#roleWatch = new MutationObserver(() => this.#applyRowLabel());
        }
        this.#roleWatch.observe(this, { attributes: true, attributeFilter: ['role'] });
    }

    disconnectedCallback() {
        this.#roleWatch?.disconnect();
        super.disconnectedCallback?.();
    }

    updated(changed) {
        super.updated?.(changed);
        this.#applyRowLabel();
    }

    render() {
        const provenance = String(this.provenance ?? '').trim();
        return html`
            <div id="lead" class="lead">
                <span id="title" class="title"><slot @slotchange=${this.#onContentChange}></slot></span>
                ${provenance
                    ? html`<ui-badge id="provenance" class="provenance">${provenance}</ui-badge>`
                    : nothing}
            </div>
            <slot name="favourite" @slotchange=${this.#onContentChange}></slot>
            <!-- ROW ACTIONS, AND THE ROW BRINGS NONE OF ITS OWN.
                 A screen that wants them brings a control that already knows how to
                 position itself - a menu anchored to its own trigger - and slots it
                 here. That is the arrangement every screen in this skin actually uses,
                 and it is why the row's own built-in affordance was deleted on 30
                 August 2026: see THE AMPUTATION in the header.
                 WHATEVER IS SLOTTED HERE MAY BE NAMED. It does not reach the row's own
                 accessible name - see #composeRowLabel, which is what made naming the
                 selector's menu trigger possible at all. -->
            <slot name="actions"></slot>
        `;
    }
}

customElements.define('ui-list-row', UiListRow);
