/**
 * The square profile shortcut.
 */

import { css, html, nothing } from 'lit';
import { UiElement, hitArea, visuallyHidden, selectionSurface } from 'src/components/base.js';

export class UiFavouriteSlot extends UiElement {
    static properties = {
        /** The 1-based number the disc shows when nothing is slotted. 0 shows nothing. */
        index: { type: Number },
        /** Accessible name - the profile the slot holds, or "Favourite 3, empty". */
        label: { type: String },
        /** Occupancy: "an outlined slot or a filled one". NOT selection. */
        filled: { type: Boolean, reflect: true },
        /** Selection, painted by the four dials and nothing else. */
        selected: { type: Boolean, reflect: true },
        /** Paint dims (base) and the press is refused (native attribute). */
        disabled: { type: Boolean, reflect: true },
    };

    static styles = [hitArea, visuallyHidden, css`
        :host {
            container-type: normal;
            display: inline-grid;

            border-radius: var(--_ui-fav-slot-radius, var(--ui-radius-pill));

            --_ui-fav-slot-face: transparent;
            --_ui-fav-slot-ink: var(--ui-muted);
            --_ui-fav-slot-edge: var(--ui-line-strong);
        }

        :host([filled]) {
            --_ui-fav-slot-face: var(--ui-primary);
            --_ui-fav-slot-ink: var(--ui-on-primary);
            --_ui-fav-slot-edge: color-mix(in srgb, var(--ui-primary) 72%, var(--ui-steel));
        }

        :host(:is(
            [aria-pressed="true"],
            [aria-selected="true"],
            [aria-checked="true"],
            [aria-current="true"],
            [selected]
        )) {
            --_ui-fav-slot-face: transparent;
            --_ui-fav-slot-ink: var(--ui-selected-ink);
        }

        .slot {
            display: inline-grid;
            place-items: center;

            /* THE BOX IS THE TOKEN. No min-inline-size, no min-block-size: P4 is a
             * dimension with two owners, and this is the only rule that owns it. */
            inline-size: var(--_ui-fav-slot-size, var(--ui-hit-min));
            block-size: var(--_ui-fav-slot-size, var(--ui-hit-min));
            padding: 0;

            border: var(--ui-border-w) solid var(--_ui-fav-slot-edge);
            border-radius: var(--_ui-fav-slot-radius, var(--ui-radius-pill));
            background-color: var(--_ui-fav-slot-face);
            color: var(--_ui-fav-slot-ink);

            font-family: var(--ui-font-family);
            font-size: var(--ui-text-base);
            font-weight: var(--ui-weight-medium);

            cursor: pointer;
        }

        .slot[disabled] {
            opacity: 1;
            cursor: default;
        }

        .mark {
            display: block;
        }
    `, selectionSurface];

    constructor() {
        super();
        this.index = 0;
        this.label = '';
        this.filled = false;
        this.selected = false;
        this.disabled = false;
    }

    render() {
        const named = Boolean(this.label);

        return html`<button id="slot" class="slot hit-overlay" type="button"
            role=${this.inert ? 'presentation' : nothing}
            aria-pressed=${this.selected ? 'true' : 'false'}
            ?disabled=${this.disabled}
            ><span id="mark" class="mark" aria-hidden=${named ? 'true' : nothing}
                ><slot>${this.index > 0 ? this.index : nothing}</slot></span
            >${named ? html`<span id="a11y" class="a11y">${this.label}</span>` : nothing}</button>`;
    }
}

customElements.define('ui-favourite-slot', UiFavouriteSlot);
