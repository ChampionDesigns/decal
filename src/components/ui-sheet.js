/**
 * The sheet body.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';

export const SHEET_DIALOG_INLINE = '680px';

/** The two arrangements a field's control area can take. */
export const SHEET_FIELD_LAYOUTS = Object.freeze(['stack', 'inline']);

/**
 * One shape out, whatever went in — the same normalisation ui-tab-bar does for its
 * tabs (ui-tab-bar.js:184-196). A bare string is a field with that slot name and no
 * label, which is the "control only" row.
 */
function normaliseField(raw, index) {
    if (raw !== null && typeof raw === 'object') {
        return {
            name: String(raw.name ?? index),
            label: String(raw.label ?? ''),
            caption: String(raw.caption ?? ''),
            layout: raw.layout === 'inline' ? 'inline' : 'stack',
        };
    }
    return { name: String(raw ?? index), label: '', caption: '', layout: 'stack' };
}

export class UiSheet extends UiElement {
    static properties = {
        fields: { type: Array },
    };

    static styles = [typeRoles, css`
        :host {
            --_ui-sheet-gap: var(--ui-space-6);
            --_ui-sheet-field-gap: var(--ui-space-3);
        }

        .stack {
            display: flex;
            flex-direction: column;
            gap: var(--_ui-sheet-gap);

            min-inline-size: 0;
        }

        .field {
            display: flex;
            flex-direction: column;
            gap: var(--_ui-sheet-field-gap);
            min-inline-size: 0;
        }

        .control {
            min-inline-size: 0;
        }

        .control-inline {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: var(--_ui-sheet-field-gap);
        }

        /* The caption's measure is #13's --ui-measure; nothing is restated. The one
         * addition is the flex minimum again, so a long caption wraps inside the
         * field instead of setting the stack's width. */
        .caption {
            min-inline-size: 0;
        }
    `];

    constructor() {
        super();
        this.fields = [];
    }

    /** Normalised, in render order. Never null: a malformed attribute renders empty. */
    get #fields() {
        return (Array.isArray(this.fields) ? this.fields : []).map(normaliseField);
    }

    #field(field, index) {
        const labelId = `lbl-${index}`;
        const captionId = `cap-${index}`;
        const named = field.label !== '';
        const described = named && field.caption !== '';

        return html`
            <div
                class="field"
                id="field-${index}"
                data-name=${field.name}
                role=${named ? 'group' : nothing}
                aria-labelledby=${named ? labelId : nothing}
                aria-describedby=${described ? captionId : nothing}
            >
                ${named
                    ? html`<span class="ui-microcap label" id=${labelId}>${field.label}</span>`
                    : nothing}
                <div class="control ${field.layout === 'inline' ? 'control-inline' : ''}"
                     id="control-${index}">
                    <slot name=${field.name}></slot>
                </div>
                ${field.caption !== ''
                    ? html`<p class="ui-caption caption" id=${captionId}>${field.caption}</p>`
                    : nothing}
            </div>
        `;
    }

    render() {
        return html`
            <div class="stack" id="stack">
                ${this.#fields.map((field, index) => this.#field(field, index))}
                <slot></slot>
            </div>
        `;
    }
}

customElements.define('ui-sheet', UiSheet);
