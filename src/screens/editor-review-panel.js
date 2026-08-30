/**
 * <editor-review-panel>, the editor's Review panel.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { revFmt } from 'src/lib/profile-modes.js';

/** Below this the two columns become one. 2 * (2 * 268) + 18 + 2 * 28. */
export const EDITOR_REVIEW_COLLAPSE_PX = 1146;

const EMPTY_COLUMNS = Object.freeze([
    Object.freeze({ id: 'a', blocks: Object.freeze([]) }),
    Object.freeze({ id: 'b', blocks: Object.freeze([]) }),
]);

export class EditorReviewPanel extends UiElement {
    static properties = {
        columns: { attribute: false },
    };

    static styles = [typeRoles, css`
        :host {
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
            block-size: 100%;
            min-block-size: 0;
            min-inline-size: 0;
        }

        slot[name="chart"] {
            display: contents;
        }

        ::slotted(*) {
            margin: var(--ui-space-6) var(--ui-space-6) 0;
            min-inline-size: 0;
        }

        #panel {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: minmax(0, 1fr);
            gap: var(--ui-space-4);
            padding: var(--ui-space-6);
            block-size: 100%;
            min-block-size: 0;
            min-inline-size: 0;
        }

        /* THE SCROLL REGIONS. One per column, and the class the overflow is declared on
         * is the same class the restore queries for (see the header, E6). */
        .column {
            display: flex;
            flex-direction: column;
            gap: var(--ui-space-4);
            min-block-size: var(--ui-editor-review-min-h);
            min-inline-size: 0;
            overflow-y: auto;
        }

        /* ONE PROSE BLOCK: a heading line over its sentences, at the gap the floor
         * token is written from. */
        .block {
            display: flex;
            flex-direction: column;
            gap: var(--ui-space-2);
            min-inline-size: 0;
        }

        .line {
            margin: 0;
            min-inline-size: 0;
            overflow-wrap: break-word;
        }

        /* A number slot reads as one unit even when its sentence wraps around it. No
         * paint of its own: whoever upgrades it into a control brings the control's. */
        .seg-num,
        .seg-lev {
            white-space: nowrap;
        }

        @container (inline-size < 1146px) {
            #panel {
                grid-template-columns: 1fr;
                grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
            }
        }
    `];

    /** value -> scrollTop, keyed by column id. The whole of the restore's state. */
    #offsets = new Map();

    /** Watches ONE attribute — see the header on why `hidden` is not a property here. */
    #watch = null;

    constructor() {
        super();
        this.columns = null;
    }

    connectedCallback() {
        super.connectedCallback();
        if (typeof MutationObserver !== 'undefined' && !this.#watch) {
            this.#watch = new MutationObserver(() => this.#onHiddenChanged());
            this.#watch.observe(this, { attributes: true, attributeFilter: ['hidden'] });
        }
    }

    disconnectedCallback() {
        this.#watch?.disconnect();
        this.#watch = null;
        super.disconnectedCallback?.();
    }

    /** The scrolling elements, found by the class the overflow is declared on. */
    get scrollers() {
        return [...(this.renderRoot?.querySelectorAll?.('.column') ?? [])];
    }

    render() {
        const columns = Array.isArray(this.columns) && this.columns.length
            ? this.columns
            : EMPTY_COLUMNS;

        return html`
            <slot name="chart"></slot>
            <div id="panel" part="panel">
                ${columns.map((column, index) => html`
                    <div
                        class="column"
                        part="column"
                        data-column=${column?.id ?? String(index)}
                        @scroll=${this.#onScroll}
                    >${(column?.blocks ?? []).map((block, i) => this.#block(block, i))}</div>
                `)}
            </div>
        `;
    }

    /** One prose block: an optional heading over its sentences. */
    #block(block, index) {
        return html`
            <div class="block" data-block=${block?.id ?? String(index)}>
                ${block?.heading
                    ? html`<p class="line ui-caption" data-role="heading">${block.heading}</p>`
                    : ''}
                ${(block?.lines ?? []).map((line, i) => html`
                    <p class="line ui-body" data-line=${i}>${this.#line(line)}</p>
                `)}
            </div>
        `;
    }

    #line(line) {
        return (Array.isArray(line) ? line : []).map((seg) => {
            if (!Array.isArray(seg)) return '';
            switch (seg[0]) {
                case 't':
                    return html`<span class="seg-t"
                    >${seg[1]}</span>`;
                case 'num':
                    /* value AND step AND unit AND bounds, all off the segment. The
                     * bounds are carried, never re-typed and never defaulted: B2's one
                     * table is upstream and this is a courier. */
                    return html`<span
                        class="seg-num"
                        data-field=${seg[1]}
                        data-step=${seg[3] ?? ''}
                        data-min=${seg[5] ?? ''}
                        data-max=${seg[6] ?? ''}
                    >${revFmt(seg[2], seg[3])} ${seg[4]}</span>`;
                case 'tog':
                    return html`<span
                        class="seg-tog"
                        data-kind=${seg[1]}
                    >${seg[2]}</span>`;
                case 'lev':
                    return html`<span class="seg-lev"
                    >${seg[1]}</span>`;
                default:
                    return '';
            }
        });
    }

    /**
     * Record where a column is. Ignored while the panel is hidden: an element with no
     * box reports 0, and recording that 0 would erase the offset the restore exists to
     * put back.
     */
    #onScroll = (event) => {
        if (this.hasAttribute('hidden')) return;
        const column = event.currentTarget;
        const id = column?.dataset?.column;
        if (typeof id === 'string') this.#offsets.set(id, column.scrollTop);
    };

    #onHiddenChanged() {
        if (this.hasAttribute('hidden')) return;
        for (const column of this.scrollers) {
            const saved = this.#offsets.get(column.dataset.column);
            if (typeof saved === 'number' && saved > 0) column.scrollTop = saved;
        }
    }
}

customElements.define('editor-review-panel', EditorReviewPanel);
