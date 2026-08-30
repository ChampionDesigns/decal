/**
 * A heading inside a page, above a group of rows.
 */

import { css, html, nothing } from 'lit';
import { UiElement, visuallyHidden } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';

export const SECTION_HEADER_LEVELS = Object.freeze([1, 2, 3, 4, 5, 6]);
export const DEFAULT_SECTION_HEADER_LEVEL = 2;

export class UiSectionHeader extends UiElement {
    static properties = {
        count: { type: String },
        /** Accessible name for the count, whose visible glyph is a bare number. */
        countLabel: { type: String, attribute: 'count-label' },
        /** Heading level, 1-6. Paint does not move; only aria-level does. */
        level: { type: Number, reflect: true },
    };

    static styles = [typeRoles, visuallyHidden, css`
        :host {
            position: sticky;
            inset-block-start: 0;
            z-index: var(--ui-z-sticky);
            block-size: var(--ui-section-head-h);
            min-block-size: var(--ui-section-head-h);
        }

        .band {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: var(--ui-space-3);
            block-size: 100%;
            padding-inline: var(--ui-space-5);
            padding-block: 0 var(--ui-space-2);
            background-color: var(--ui-fascia);
            user-select: none;
        }

        .caption {
            flex: 1 1 auto;
            margin-block: 0;
            min-inline-size: 0;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        .count {
            flex: 0 0 auto;
        }
    `];

    constructor() {
        super();
        this.count = '';
        this.countLabel = '';
        this.level = DEFAULT_SECTION_HEADER_LEVEL;
    }

    /** Normalise before paint, so level="9" and level="banana" are a documented
     *  fallback rather than an invalid aria-level on a real heading. */
    willUpdate(changed) {
        if (changed.has('level')) {
            const raw = Number.parseInt(this.level, 10);
            const next = SECTION_HEADER_LEVELS.includes(raw) ? raw : DEFAULT_SECTION_HEADER_LEVEL;
            if (next !== this.level) this.level = next;
        }
    }

    /** True when there is a count to draw. `0` is a count; '' and null are not. */
    get hasCount() {
        return this.count !== null && this.count !== undefined && String(this.count) !== '';
    }

    render() {
        const named = Boolean(this.countLabel);
        return html`
            <div id="band" class="band">
                <h2 id="caption" class="ui-microcap caption" aria-level=${this.level}><slot></slot></h2>
                ${this.hasCount
                    ? html`<span id="count" class="ui-microcap count"
                        aria-hidden=${named ? 'true' : nothing}>${this.count}</span>`
                    : nothing}
                ${this.hasCount && named
                    ? html`<span id="a11y" class="a11y">${this.countLabel}</span>`
                    : nothing}
                <slot name="trail"></slot>
            </div>`;
    }
}

customElements.define('ui-section-header', UiSectionHeader);
