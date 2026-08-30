/**
 * The label/value info card.
 */

import { css, html, nothing } from 'lit';
import { UiElement, visuallyHidden } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import { isNoReading } from 'src/data/reading.js';
import { SHEET_HEADING_LEVELS, DEFAULT_LEVEL } from 'src/components/ui-sheet-header.js';
import { CARD_PADS } from 'src/components/ui-card.js';

const NO_READING_MARK = '—';

const ABSENT_KEY = 'no reading';

export function normaliseDefinition(raw, index) {
    if (raw === null || raw === undefined) {
        return { term: '', value: undefined, index };
    }
    if (typeof raw === 'object') {
        const term = raw.term ?? raw.label ?? raw.name;
        return {
            term: term === null || term === undefined ? '' : String(term),
            value: raw.value,
            index,
        };
    }
    return { term: String(raw), value: undefined, index };
}

export function isAbsentDefinition(value) {
    return value === null || value === undefined || value === '' || isNoReading(value);
}

export class UiDefinitionCard extends UiElement {
    static properties = {
        items: { type: Array },

        /** Optional card title. No heading, no heading element - #16's own rule. */
        heading: { type: String },

        /** 1..6. The list is imported from #16, never restated. */
        level: { type: Number, reflect: true },

        /** Accessible name for the card's group. Falls back to `heading`. */
        label: { type: String },

        /** 'regular' | 'tight' | 'none'. #8's inset, forwarded. */
        pad: { type: String, reflect: true },

        /** #8's bounded scroll region. Attribute `scroll`, property `scrollable`. */
        scrollable: { type: Boolean, reflect: true, attribute: 'scroll' },

        /** The absent mark. A property so the screen can hand units.js's own in. */
        dash: { type: String },

        /** Whether anything is assigned to the actions slot. Internal. */
        _hasActions: { state: true },
    };

    static styles = [
        seams,
        typeRoles,
        visuallyHidden,
        css`
        :host {
            display: grid;
            grid-template-rows: minmax(0, 1fr);
        }

        /* THE CARD FILLS THE HOST. #8 is a grid too, so this is one declaration. */
        .surface {
            min-inline-size: 0;
        }

        .stack {
            grid-template-columns: minmax(0, 1fr);
            align-content: start;
        }

        .list {
            grid-template-columns: minmax(0, 1fr);
            align-content: start;
            margin: 0;
        }

        .cell {
            background-color: var(--ui-key);
            min-inline-size: 0;
        }

        .row,
        .head {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            column-gap: var(--ui-space-5);
        }

        .row {
            padding-block: var(--ui-space-4);
        }

        .head {
            min-block-size: var(--ui-control-h);
        }

        .head.is-empty {
            display: none;
        }

        .heading,
        .term {
            min-inline-size: 0;
            overflow-wrap: anywhere;
        }

        /* THE TRAILING CLUSTER. An auto margin rather than justify-content, so the
         * cluster stays at the end on a wrapped line too. */
        .actions {
            display: flex;
            align-items: center;
            gap: var(--ui-space-3);
            margin-inline-start: auto;
        }

        .value {
            min-inline-size: 0;
            margin-inline-start: auto;
            margin-inline-end: 0;
            text-align: end;
            overflow-wrap: anywhere;
        }
    `];

    constructor() {
        super();
        this.items = [];
        this.heading = '';
        this.level = DEFAULT_LEVEL;
        this.label = '';
        this.pad = 'regular';
        this.scrollable = false;
        this.dash = NO_READING_MARK;
        this._hasActions = false;
        this.i18n = new I18nController(this);
    }

    willUpdate(changed) {
        if (changed.has('level')) {
            const raw = Number.parseInt(this.level, 10);
            const next = SHEET_HEADING_LEVELS.includes(raw) ? raw : DEFAULT_LEVEL;
            if (next !== this.level) this.level = next;
        }
        if (changed.has('pad')) {
            const raw = String(this.pad ?? '').trim().toLowerCase();
            const next = CARD_PADS.includes(raw) ? raw : 'regular';
            if (next !== this.pad) this.pad = next;
        }
    }

    /** The rows, normalised. Never fewer than were handed in. */
    get #rows() {
        const raw = Array.isArray(this.items) ? this.items : [];
        return raw.map((row, i) => normaliseDefinition(row, i));
    }

    get #groupName() {
        return this.label || this.heading || '';
    }

    #onActionsSlotChange(event) {
        const assigned = event.target.assignedNodes({ flatten: true });
        this._hasActions = assigned.some(
            (node) => node.nodeType === Node.ELEMENT_NODE
                || (node.textContent || '').trim() !== '',
        );
    }

    /**
     * NO HEADING, NO HEADING ELEMENT - #16's rule (ui-sheet-header.js:440-447),
     * because an empty announced heading is worse than none.
     */
    #renderHeading() {
        const text = this.heading ?? '';
        if (!text) return nothing;
        switch (this.level) {
            case 1: return html`<h1 id="heading" class="ui-heading heading"
                >${text}</h1>`;
            case 3: return html`<h3 id="heading" class="ui-heading heading"
                >${text}</h3>`;
            case 4: return html`<h4 id="heading" class="ui-heading heading"
                >${text}</h4>`;
            case 5: return html`<h5 id="heading" class="ui-heading heading"
                >${text}</h5>`;
            case 6: return html`<h6 id="heading" class="ui-heading heading"
                >${text}</h6>`;
            default: return html`<h2 id="heading" class="ui-heading heading"
                >${text}</h2>`;
        }
    }

    /**
     * The dash is a glyph standing for a sentence, so it is hidden from the
     * accessibility tree and the sentence is exposed instead (ui-stat-tile's shape).
     */
    #renderValue(value) {
        if (!isAbsentDefinition(value)) {
            return html`<span class="text"
                >${value}</span>`;
        }
        return html`<span class="text" aria-hidden="true">${this.dash}</span
            ><span class="a11y">${this.i18n.t(ABSENT_KEY)}</span>`;
    }

    #renderRow(row) {
        return html`<div class="cell row" id="row-${row.index}">
            <dt class="ui-heading term" id="term-${row.index}">${row.term}</dt>
            <dd class="ui-body ui-numeric value" id="value-${row.index}">${this.#renderValue(row.value)}</dd>
        </div>`;
    }

    render() {
        const rows = this.#rows;
        const name = this.#groupName;
        const headEmpty = !this.heading && !this._hasActions;
        return html`<ui-card
            id="surface"
            class="surface"
            .pad=${this.pad}
            .scrollable=${this.scrollable}
            .label=${name}
        ><div id="stack" class="stack seam-grid seam-rows seam-line">
            <div id="head" class="cell head ${headEmpty ? 'is-empty' : ''}">
                ${this.#renderHeading()}
                <span id="actions" class="actions"><slot
                    name="actions" @slotchange=${this.#onActionsSlotChange}></slot></span>
            </div>
            <dl id="list" class="list seam-grid seam-rows seam-line"
                >${rows.map((row) => this.#renderRow(row))}</dl>
        </div></ui-card>`;
    }
}

customElements.define('ui-definition-card', UiDefinitionCard);
