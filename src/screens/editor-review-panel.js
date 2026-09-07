/**
 * <editor-review-panel>, the editor's Review panel.
 */

import { css, html } from 'lit';

import { UiElement, focusRing } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { PUMP_MODE_CYCLE, revFmt } from 'src/lib/profile-modes.js';

/** Below this the two columns become one. 2 * (2 * 268) + 18 + 2 * 28. */
export const EDITOR_REVIEW_COLLAPSE_PX = 1146;

/** A step key -> the matrix row that owns its keypad. */
const REVIEW_ROW = Object.freeze({
    temperature: 'temperature',
    seconds: 'duration',
    power: 'target',
    pressure: 'target',
    flow: 'target',
    limiter: 'limiter',
    volume: 'exits',
    weight: 'exits',
});

/** The one number slot that is not a step key: it lives at `step.exit.value`. */
const EXIT_NUMBER = 'exitValue';

/** The next value a toggle word takes, or null for a word that toggles nothing. */
function nextToggle(field, value) {
    if (field === 'sensor') return value === 'water' ? 'coffee' : 'water';
    if (field === 'pump') {
        const at = PUMP_MODE_CYCLE.indexOf(value);
        return PUMP_MODE_CYCLE[(at + 1) % PUMP_MODE_CYCLE.length];
    }
    if (field === 'transition') {
        const ring = ['fast', 'smooth'];
        if (!ring.includes(value)) ring.push(value);
        const at = ring.indexOf(value);
        return ring[(at + 1) % ring.length];
    }
    return null;
}

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
            grid-template-rows: minmax(0, 1fr);
            block-size: 100%;
            min-block-size: 0;
            min-inline-size: 0;
        }

        slot[name="chart"] {
            display: contents;
        }

        ::slotted(*) {
            min-inline-size: 0;
        }

        #panel {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: minmax(0, 1fr);
            gap: var(--ui-space-7);
            padding: var(--ui-space-6);
            block-size: 100%;
            min-block-size: 0;
            min-inline-size: 0;

            /* The screen paints a seam ground and expects every region to cover it. */
            background-color: var(--ui-fascia);
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

        .column + .column {
            border-inline-start: var(--ui-hairline) solid var(--ui-line);
            padding-inline-start: var(--ui-space-7);
        }

        /* ONE PROSE BLOCK: a heading line over its sentences, at the gap the floor
         * token is written from. */
        .block {
            display: flex;
            flex-direction: column;
            gap: var(--ui-space-2);
            min-inline-size: 0;
        }

        .block:not(:first-child) > [data-role="heading"] {
            margin-block-start: var(--ui-space-4);
        }

        .line {
            margin: 0;
            min-inline-size: 0;
            overflow-wrap: break-word;
        }

        /* A slot is a BUTTON that reads as running text. Everything a button brings of
         * its own is undone so the sentence keeps one type, one colour and one rhythm. */
        .slot {
            display: inline;
            font: inherit;
            color: inherit;
            letter-spacing: inherit;
            background: none;
            border: 0;
            padding: 0;
            margin: 0;
            cursor: pointer;
        }

        /* A number slot reads as one unit even when its sentence wraps around it. The
         * negative margin gives back what the padding takes, so the words do not move. */
        .seg-num,
        .seg-lev {
            white-space: nowrap;
            background-color: color-mix(in srgb, currentColor 13%, transparent);
            border-radius: var(--ui-radius-sm);
            padding: 0.08em 0.26em;
            margin: 0 -0.18em;
        }

        .seg-tog {
            text-decoration: underline dashed currentColor;
            text-underline-offset: 0.22em;
            text-decoration-thickness: 1px;
        }

        .seg-num:hover,
        .seg-lev:hover {
            background-color: color-mix(in srgb, currentColor 24%, transparent);
        }

        .seg-num:active,
        .seg-lev:active {
            background-color: color-mix(in srgb, currentColor 34%, transparent);
        }

        .seg-tog:hover {
            background-color: color-mix(in srgb, currentColor 14%, transparent);
        }

        .slot:focus-visible {
            ${focusRing}
            --_ui-focus-offset: var(--ui-focus-offset-inset);
        }

        /* A block that names no step renders prose, so its slots carry no paint. */
        .slot[disabled] {
            background: none;
            padding: 0;
            margin: 0;
            text-decoration: none;
            cursor: inherit;
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

        /* A column may claim the chart; if none does it goes in the last, because a slot
           that renders nowhere is a chart that silently disappears. */
        const claimed = columns.findIndex((column) => column?.chart === true);
        const chartColumn = claimed >= 0 ? claimed : columns.length - 1;

        return html`
            <div id="panel" part="panel">
                ${columns.map((column, index) => html`
                    <div
                        class="column"
                        part="column"
                        data-column=${column?.id ?? String(index)}
                        @scroll=${this.#onScroll}
                    >
                        ${index === chartColumn ? html`<slot name="chart"></slot>` : ''}
                        ${(column?.blocks ?? []).map((block, i) => this.#block(block, i))}
                    </div>
                `)}
            </div>
        `;
    }

    /** One prose block: an optional heading over its sentences. */
    #block(block, index) {
        const at = Number.isInteger(block?.step) ? block.step : null;
        return html`
            <div class="block" data-block=${block?.id ?? String(index)}>
                ${block?.heading
                    ? html`<p class="line ui-heading" data-role="heading">${block.heading}</p>`
                    : ''}
                ${(block?.lines ?? []).map((line, i) => html`
                    <p class="line ui-body" data-line=${i}>${this.#line(line, at)}</p>
                `)}
            </div>
        `;
    }

    #line(line, at = null) {
        const live = Number.isInteger(at);
        return (Array.isArray(line) ? line : []).map((seg) => {
            if (!Array.isArray(seg)) return '';
            switch (seg[0]) {
                case 't':
                    return html`<span class="seg-t"
                    >${seg[1]}</span>`;
                case 'num':
                    /* value AND step AND unit AND bounds, all off the segment. The
                     * bounds are carried, never re-typed and never defaulted: the one
                     * table is upstream and this is a courier. */
                    return html`<button
                        type="button"
                        class="slot seg-num"
                        ?disabled=${!live}
                        data-index=${at ?? ''}
                        data-field=${seg[1]}
                        data-value=${seg[2] ?? ''}
                        data-step=${seg[3] ?? ''}
                        data-unit=${seg[4] ?? ''}
                        data-min=${seg[5] ?? ''}
                        data-max=${seg[6] ?? ''}
                        @click=${this.#onNumPress}
                    >${revFmt(seg[2], seg[3])} ${seg[4]}</button>`;
                case 'tog':
                    return html`<button
                        type="button"
                        class="slot seg-tog"
                        ?disabled=${!live}
                        data-index=${at ?? ''}
                        data-kind=${seg[1]}
                        data-field=${seg[3] ?? ''}
                        data-value=${seg[4] ?? ''}
                        @click=${this.#onTogPress}
                    >${seg[2]}</button>`;
                case 'lev':
                    return html`<button
                        type="button"
                        class="slot seg-lev"
                        ?disabled=${!live}
                        data-index=${at ?? ''}
                        @click=${this.#onLevPress}
                    >${seg[1]}</button>`;
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
    #attrNum(el, key) {
        const raw = el?.dataset?.[key];
        if (raw === undefined || raw === '') return null;
        const value = Number(raw);
        return Number.isFinite(value) ? value : null;
    }

    #send(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    /* The bounds the keypad opens with are the ones the words were PRINTED from, carried
     * on the segment. A second lookup at press time would be a second answer. */
    #onNumPress = (event) => {
        const el = event.currentTarget;
        const index = this.#attrNum(el, 'index');
        const field = el?.dataset?.field ?? '';
        if (index === null || field === '') return;

        /* Not a step key — it lives at `step.exit.value`, and the draft writer assigns
         * any field it does not name straight onto the step. It opens the dialog. */
        if (field === EXIT_NUMBER) {
            this.#send('exit-edit', { index, slot: 'condition' });
            return;
        }

        const min = this.#attrNum(el, 'min');
        const max = this.#attrNum(el, 'max');
        if (min === null || max === null) return;
        this.#send('step-edit', {
            index,
            row: REVIEW_ROW[field] ?? field,
            field,
            value: this.#attrNum(el, 'value'),
            range: {
                min,
                max,
                step: this.#attrNum(el, 'step'),
                unit: el.dataset.unit || null,
            },
        });
    };

    #onTogPress = (event) => {
        const el = event.currentTarget;
        const index = this.#attrNum(el, 'index');
        const field = el?.dataset?.field ?? '';
        if (index === null || field === '') return;

        if (field === 'exit') {
            this.#send('exit-edit', { index, slot: 'condition' });
            return;
        }
        const value = nextToggle(field, el.dataset.value ?? '');
        if (value === null) return;
        this.#send('step-change', { index, field, value });
    };

    #onLevPress = (event) => {
        const index = this.#attrNum(event.currentTarget, 'index');
        if (index === null) return;
        this.#send('lever-edit', { index });
    };

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
