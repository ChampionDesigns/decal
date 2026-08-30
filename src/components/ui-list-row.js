/**
 * <ui-list-row> — a selectable row: a title, an optional provenance chip, and
 * whatever the list slots beside them.
 *
 * The row paints and reports. It owns no affordance of its own: a control belongs to
 * the list that slots it.
 */

import { css, html, nothing } from 'lit';

import { UiElement, selectionSurface } from 'src/components/base.js';
import 'src/components/ui-badge.js';

/* aria-selected is three-valued and a listbox option carries it in both states, so
   toAttribute never returns null — an absent attribute is a different thing. */
const ARIA_SELECTED = {
    fromAttribute: (value) => value === 'true',
    toAttribute: (value) => (value ? 'true' : 'false'),
};

export class UiListRow extends UiElement {
    static properties = {
        /* Selected, as the ARIA state. Reflected, so the paint and the announcement cannot
           disagree. */
        selected: { reflect: true, attribute: 'aria-selected', converter: ARIA_SELECTED },
        /* The provenance chip's text. Empty renders no chip. */
        provenance: { type: String },

    };

    static styles = [
        css`
            /* The host is the row and keeps the base's container-type: a row fills its column,
               so there is nothing to opt out of. */
            :host {
                display: flex;
                align-items: center;
                gap: var(--ui-space-3);

                /* A floor, not a height: a row with a two-line title grows rather than clipping. */
                min-block-size: var(--ui-list-row);

                padding-inline: var(--ui-space-5);

                background-color: var(--ui-fascia);

                /* The type is set on the row rather than on the title, so a slotted control
                   inherits it. */
                font-size: var(--ui-text-lg);
                font-weight: var(--ui-weight-regular);

                cursor: pointer;
                user-select: none;
            }

            /* Title and chip share a baseline. */
            .lead {
                display: flex;
                flex: 1 1 auto;
                align-items: baseline;
                gap: var(--ui-space-2);
                min-inline-size: 0;
            }

            /* The title declares no type: it takes the row's. */
            .title {
                min-inline-size: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* The chip is not squeezed by a long title — the title ellipsises, the provenance
               does not. */
            .provenance {
                flex: none;
            }

            /* Nor is a slotted control. Every non-lead child holds its own width, so the title
               is the only thing that gives. */
            ::slotted(*) {
                flex: none;
            }

        `,
        /* The selection fragment comes last so it beats the resting paint above it, and is
           deliberately not wrapped in :where(). */
        selectionSurface,
    ];

    constructor() {
        super();
        this.selected = false;
        this.provenance = '';
    }

    /* The row's own accessible name, composed from the three places a name-from-content
       walk would reach: the title, the chip and the lead slot. */
    #composeRowLabel() {
        const root = this.renderRoot;
        if (!root) return '';
        const slotText = (selector) => (root.querySelector(selector)
            ?.assignedNodes?.({ flatten: true }) ?? [])
            .map((node) => node.textContent ?? '')
            .join(' ');
        /* The actions slot is deliberately excluded. A control slotted there carries its
           own name and must not be folded into the row's. */
        return [
            slotText('slot:not([name])'),
            root.getElementById('provenance')?.textContent ?? '',
            slotText('slot[name="favourite"]'),
        ].join(' ').replace(/\s+/g, ' ').trim();
    }

    /* Written only for a row whose list has given it a role. A row with no role is a
       generic element, and naming one is noise in the tree. */
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

    /* The last name this element wrote for itself. */
    #rowLabel = null;

    /* The role is a plain attribute set by the list, so no update fires when it
       changes and the name has to be recomposed on every update. */
    #roleWatch = null;

    #onContentChange = () => this.#applyRowLabel();

    /* Set here and never in the constructor: a custom element constructor must not gain
       attributes. No role is set — the list owns that. */
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
        /* The chip is rendered here, so a change to it fires no slotchange and the label
           must be recomposed on update as well as on slot change. */
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
