/**
 * editor-review-panel.js — <editor-review-panel>, the editor's Review panel.
 * `LAYOUT_SPEC_DRAFT.md` §4.3 ("review: grid 1fr 1fr -> @container collapses to 1-up;
 * each column overflow-y: auto"); SCOPE Part 5 §5 "Skeleton and what flexes",
 * "Scroll regions and floors" and "Components"; wave 5.5, row `review-panel`.
 *
 * ===========================================================================
 * THIS PANEL RENDERS COPY. IT DOES NOT AUTHOR COPY.
 * ===========================================================================
 * There is no "review prose list" component on the 57-item inventory, and there is no
 * need for one: the sentences travel AS DATA out of the wave-4 port. `reviewStepSpec`
 * (`profile-modes.js:693`) emits token arrays per line —
 *
 *     ['t',   text]                                   a run of words
 *     ['num', field, value, step, unit, min, max]     an editable number slot
 *     ['tog', kind, label]                            a toggle word
 *     ['lev', label]                                  a lever value routed to the modal
 *
 * — with the value AND its bounds AND its unit all sourced from the range, so "a slot
 * cannot disagree with the control beside it" (`profile-modes.js:511`). This file maps
 * those segments onto spans and formats the numbers with the module's OWN formatter,
 * `revFmt`. It types no sentence, holds no wording, and — B2 — declares no range: the
 * bounds ride along on the segment and are handed to the DOM as data attributes for
 * whoever upgrades a slot into a control.
 *
 * NOT `reviewLineText`. That export flattens a line to plain text and says of itself
 * "for the wording pin; never for app rendering" — a flattened line has no slots left
 * to upgrade. The suite uses it; this file does not.
 *
 * D2, and the one honest thing to say about it: the wording in these lines is the
 * PORT's, verbatim per surface (`profile-modes.js:140-143`), and translating a
 * generated sentence segment-by-segment at the render site would produce neither the
 * source wording nor a translatable string. So this component reads no catalogue: the
 * strings it paints are values it was handed, which is D2's mechanism, and the
 * catalogue entry for a review sentence belongs to the module that composes it.
 *
 * ===========================================================================
 * E6 — SCROLL RESTORE TARGETS THE ELEMENT THAT ACTUALLY SCROLLS
 * ===========================================================================
 * §7.4 E6: "Review-tab scroll restoration writes `scrollTop` to a NON-scrolling
 * element, so the fix labelled E2 does nothing and the bug it describes is still live"
 * (`profile_editor.js:3110-3135`; the scroller is `.slate-review-steps`, `:1194`).
 *
 * The defect is not the idea, it is the target. So the restore here is written the only
 * way that cannot repeat it: the elements that are saved and restored are THE SAME
 * ELEMENTS that carry `overflow-y: auto` — `#panel .column`, found by querying for the
 * class the overflow is declared on, never by naming a wrapper. There is exactly one
 * scrolling element per column and this file writes to exactly those.
 *
 * WHY A RESTORE IS NEEDED AT ALL. #32 ui-tab-bar marks a panel that is not showing
 * `hidden` + `inert`, and `hidden` is `display: none` (base.js). An element with no box
 * has no scroll position: the browser resets it to 0 and re-shows the column at the top.
 * That is the bug a user sees, and it is why the offsets are held here rather than
 * trusted to the engine.
 *
 * THE VISIBILITY SIGNAL IS THE `hidden` ATTRIBUTE, WATCHED, NOT MIRRORED. `hidden` is a
 * native HTMLElement property; declaring it as a Lit reactive property would replace the
 * native accessor and quietly break `el.hidden = true` for everyone else. A
 * MutationObserver on this one attribute observes the state without owning it — the tab
 * bar stays the single owner of which panel is showing (§2.3, one owner per dimension).
 *
 * ===========================================================================
 * THE COLLAPSE, AND ITS THRESHOLD
 * ===========================================================================
 * Part 2 §5 rule 1: this is a container query on the panel's own inline size. No
 * `@media (width…)`, and no JavaScript reads a width. §4.3 says "collapses to 1-up" and
 * gives no number; every §7.4 id disqualifies an oracle match, so the number is DERIVED
 * and recorded as a deferred question — one literal, in one file.
 *
 * THE DERIVATION. A review column holds a SENTENCE with an editable slot inside it. The
 * slot is a #4 ui-stepper band, 268px (`ui-stepper.js:289`, and the same quantity
 * `editor-settings-panel.js` derives its thresholds from); a column that is only as wide
 * as its slot is a stack, not a sentence, so the stated minimum gives the words either
 * side as much again:
 *
 *     column min = 2 * 268 = 536
 *     two of them + 1 gap (--ui-space-4 = 18) + 2 pads (2 * --ui-space-6 = 56) = 1146
 *
 * A container query condition cannot contain `var()`, which is why this is a literal and
 * not a token; it is written once, here, and exported so the suite sweeps the number the
 * CSS was written beside.
 *
 * ===========================================================================
 * THE SCROLL REGIONS AND THEIR FLOOR  (§2.4, M18)
 * ===========================================================================
 * §4.3 gives the overflow to EACH COLUMN, not to the panel, and that is what is built:
 * `#panel` scrolls nothing. Each column carries §2.4's three together — a stated
 * `overflow-y: auto`, a floor of one prose block (`--ui-editor-review-min-h`, arithmetic
 * over existing type tokens, not a frozen number), and no `scrollbar-width` anywhere, so
 * the scrollbar stays visible (T16 is two nav columns hiding a live one).
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { revFmt } from 'src/lib/profile-modes.js';

/** Below this the two columns become one. 2 * (2 * 268) + 18 + 2 * 28. */
export const EDITOR_REVIEW_COLLAPSE_PX = 1146;

/**
 * The shape §4.3 names, present before any data arrives: two columns, so the panel has
 * its layout — and its two scroll regions — from the first paint rather than acquiring
 * them when a profile loads. Ids only; no copy.
 */
const EMPTY_COLUMNS = Object.freeze([
    Object.freeze({ id: 'a', blocks: Object.freeze([]) }),
    Object.freeze({ id: 'b', blocks: Object.freeze([]) }),
]);

export class EditorReviewPanel extends UiElement {
    static properties = {
        /**
         * The review, as data. An array of columns:
         *
         *     [{ id, heading?, blocks: [{ id, heading?, lines }] }]
         *
         * where `lines` is `reviewStepSpec(step, { machineRanges })` output — an array
         * of lines, each an array of segments. WHICH BLOCK GOES IN WHICH COLUMN IS THE
         * CALLER'S: a split decided here would be this file having an opinion about
         * content, and §4.3 gives it an opinion about tracks only.
         *
         * `null` renders the two empty columns above.
         */
        columns: { attribute: false },
    };

    static styles = [typeRoles, css`
        /* NO BACKTICK ANYWHERE IN THIS TEMPLATE, comment or not: one ends the tagged
         * template where it stands and the file then fails to parse as JavaScript some
         * way further on.
         *
         * THE HOST IS THE CONTAINER, NOT THE GRID — an element is never its own
         * container, so the query below governs #panel and never :host.
         *
         * TWO ROWS, AND THE FIRST IS USUALLY NOT THERE. §7.4 E12 calls the preview "the
         * Review chart", so the panel carries a "chart" slot above its columns. The row
         * is "auto": with nothing slotted it is 0px and every measurement of #panel and
         * of .column is exactly what it was before the slot existed. The chart's own
         * floor is #9's (--ui-chart-min-h + the card's chrome) and this file states
         * none — §2.3, one owner per dimension. */
        :host {
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
            block-size: 100%;
            min-block-size: 0;
            min-inline-size: 0;
        }

        /* The slot is not the grid item — the slotted chart is. Its inset matches
         * #panel's own padding so the card and the columns share a left edge; margin
         * rather than a wrapper box, because a box here would take the row and then have
         * to hand its size on (the same reason editor-body.js gives). */
        slot[name="chart"] {
            display: contents;
        }

        ::slotted(*) {
            margin: var(--ui-space-6) var(--ui-space-6) 0;
            min-inline-size: 0;
        }

        /* THE PANEL SCROLLS NOTHING. §4.3 gives the overflow to each column, and a
         * second scroll region wrapped around two scroll regions is how a page ends up
         * with two scrollbars and one of them doing nothing. */
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

        /* Prose wraps; it never nowraps into a neighbour's cell. E19 is
         * white-space: nowrap on the totals line in a 430px column with no overflow,
         * and rail labels spilling onto the first data cell for the same reason. */
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

        /* =======================================================================
         * THE COLLAPSE. < is exclusive, so 1146 belongs to the two-column branch
         * and the suite pins the flip at 1146/1145 rather than assuming.
         * ======================================================================= */
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

    /**
     * One line, segment by segment. The branches are `reviewStepSpec`'s four token
     * kinds and nothing else; an unrecognised kind renders NOTHING rather than
     * guessing at a shape, because a plausible-looking sentence is how a wrong reading
     * survives review (A7).
     */
    #line(line) {
        return (Array.isArray(line) ? line : []).map((seg) => {
            if (!Array.isArray(seg)) return '';
            /* EVERY BRANCH IS WRITTEN OVER SEVERAL LINES, and that is not only taste:
             * Gate D's `coverage-constructed-path` check reads a single-line
             * INTERPOLATED template containing a slash as a route assembled from
             * fragments, and a closing tag has a slash in it. A markup template is not a
             * route; spreading it is how the rest of the tree already says so. */
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

    /**
     * Shown again: put each column back where it was. Written to `.column`, which is
     * the element `overflow-y: auto` is declared on — E6's whole point.
     */
    #onHiddenChanged() {
        if (this.hasAttribute('hidden')) return;
        for (const column of this.scrollers) {
            const saved = this.#offsets.get(column.dataset.column);
            if (typeof saved === 'number' && saved > 0) column.scrollTop = saved;
        }
    }
}

customElements.define('editor-review-panel', EditorReviewPanel);
