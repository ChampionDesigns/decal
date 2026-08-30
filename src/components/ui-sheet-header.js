/**
 * The one header a.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';

/** The levels a heading may take. Anything else falls back to DEFAULT_LEVEL rather
 *  than rendering a non-heading — the same fallback shape base.js uses for
 *  focus-ring and ui-card uses for pad. */
export const SHEET_HEADING_LEVELS = Object.freeze([1, 2, 3, 4, 5, 6]);

export const DEFAULT_LEVEL = 2;

export class UiSheetHeader extends UiElement {
    static properties = {
        /** The title, as a string. Not a slot — see "WHAT IS DELIBERATELY NOT HERE". */
        heading: { type: String },
        /** 1…6. Reflected so a screen can see the level it asked for. */
        level: { type: Number, reflect: true },
        _hasTrail: { state: true },
    };

    static styles = [typeRoles, css`
        :host {
            --_ui-sheet-head-min: var(--ui-control-h);
        }

        .head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--ui-space-5);
            min-block-size: var(--_ui-sheet-head-min);
            padding-block-end: var(--ui-space-4);
        }

        .title {
            min-inline-size: 0;
            text-transform: uppercase;
            letter-spacing: var(--ui-tracking-cap);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .trail {
            display: flex;
            align-items: center;
            gap: var(--ui-space-3);
            flex-shrink: 0;
            margin-inline-start: auto;
        }

        .is-empty {
            display: none;
        }
    `];

    constructor() {
        super();
        this.heading = '';
        this.level = DEFAULT_LEVEL;
        this._hasTrail = false;
    }

    /** Normalise before paint, so level="0", level="9" and level="two" are a
     *  documented fallback rather than a heading that is not a heading. */
    willUpdate(changed) {
        if (changed.has('level')) {
            const raw = Number.parseInt(this.level, 10);
            const next = SHEET_HEADING_LEVELS.includes(raw) ? raw : DEFAULT_LEVEL;
            if (next !== this.level) this.level = next;
        }
    }

    #onSlotChange(event) {
        this._hasTrail = event.target.assignedElements({ flatten: true }).length > 0;
    }

    #renderHeading() {
        const text = this.heading ?? '';
        if (!text) return nothing;
        switch (this.level) {
            case 1: return html`<h1 id="title" class="ui-title title"
                >${text}</h1>`;
            case 3: return html`<h3 id="title" class="ui-title title"
                >${text}</h3>`;
            case 4: return html`<h4 id="title" class="ui-title title"
                >${text}</h4>`;
            case 5: return html`<h5 id="title" class="ui-title title"
                >${text}</h5>`;
            case 6: return html`<h6 id="title" class="ui-title title"
                >${text}</h6>`;
            default: return html`<h2 id="title" class="ui-title title"
                >${text}</h2>`;
        }
    }

    render() {
        return html`<div id="head" class="head">
            ${this.#renderHeading()}
            <div id="trail" class=${this._hasTrail ? 'trail' : 'trail is-empty'}
            ><slot name="trail" @slotchange=${this.#onSlotChange}></slot></div>
        </div>`;
    }
}

customElements.define('ui-sheet-header', UiSheetHeader);
