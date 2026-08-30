/**
 * selector-split.js — <selector-split>, the Profile selector's two-pane body.
 *
 * LAYOUT_SPEC_DRAFT.md §4.2, verbatim:
 *
 *     └─ <split>         display:grid; gap: var(--ui-seam)
 *          grid-template-columns: minmax(360px, 40%) minmax(0, 1fr)
 *          @container (inline-size < 900px) → single column, list over detail
 *
 * Two slots, `list` and `detail`, in that source order — so the collapsed branch is
 * "list over detail" for free, with no `order` and no second template. One element,
 * one grid, one threshold.
 *
 * ===========================================================================
 * THE TRAP THIS FILE IS SHAPED AROUND: AN ELEMENT IS NOT ITS OWN CONTAINER
 * ===========================================================================
 *
 * The obvious build is `:host { container-type: inline-size; grid-template-columns: … }`
 * with `@container (inline-size < 900px) { :host { … } }`. It is wrong, silently, and
 * in the direction that looks like it works: a container query resolves against the
 * nearest ANCESTOR query container of the elements being styled, and an element can
 * never be its own container. A rule whose subject is `:host` therefore asks the
 * container OUTSIDE this component — `<selector-screen>`, which the base also makes a
 * container — so the query would read the screen's width and the collapse would be
 * approximately right and occasionally wrong, which is worse than either.
 *
 * So the grid is an INNER element, `#grid`, and the host is the container the base
 * already made it (`container-type: inline-size`, `src/components/base.js`). `#grid`'s
 * nearest container ancestor IS the host, the query reads this component's own box,
 * and spec §2.1 Rule 1 ("a component reads its own container, never the viewport") is
 * true in the strict sense rather than the approximate one.
 *
 * NO `@media (width…)` ANYWHERE. `src/screens/selector-skeleton` ships zero of them and
 * the suite reads that off the parsed CSSOM of the live shadow root rather than off
 * source text. The three column-split screens — Settings master/detail, this one, Live
 * rail/main — each collapse on their own container at their own threshold (§2.1 Rule 2);
 * this screen is the one that proves the pattern Settings then reuses.
 *
 * ===========================================================================
 * WHY 900 IS THE RIGHT NUMBER AND NOT A ROUND ONE
 * ===========================================================================
 *
 * `minmax(360px, 40%)` and the 900px threshold are the same fact written twice, and
 * they meet exactly: 40% of 900 is 360. Above 900 the percentage governs and the list
 * pane grows with the window; at 900 the two clauses cross; below 900 the `360px`
 * minimum would govern, and a minimum that governs is a track that has stopped
 * responding — the detail pane would take every pixel of the loss until it too hit
 * `minmax(0, 1fr)`'s floor and the panes started overlapping their content. The
 * threshold is placed at the crossing, so the two-column layout is abandoned at
 * precisely the width at which it stops being a two-column layout.
 *
 * THE THRESHOLD IS A LITERAL AND IT HAS TO BE. A container query's condition is not a
 * declaration: `var()` is not substituted inside `@container (…)`, so
 * `@container (inline-size < var(--ui-selector-split-collapse))` never matches anything
 * and fails silently — the collapse simply never fires. The number is therefore written
 * once, here, in the file that owns the query, which is what §2.3's rule actually asks
 * ("the same number written in two places"). `styles/tokens.css` carries the note.
 *
 * NEITHER BRANCH FIRES ON THE BENCH, BY CONSTRUCTION, and that is the reason the suite
 * drives it rather than photographing it. The screen fills its window, so the split's
 * inline size is 1281 at BENCH and 1000 at FLOOR — both above 900, both the wide
 * branch. The narrow branch is unreachable on this hardware at any window this app
 * supports, exactly as the numpad's carried breakpoint is (`layout/overlays.md` §6.8,
 * and `test/render/numpad-container-query.render.test.mjs` for the same argument at a
 * different threshold). `test/render/selector-skeleton.render.test.mjs` section 2
 * sweeps the screen's inline size across 900 at both geometries and pins the flip.
 *
 * ===========================================================================
 * THE DIVIDER IS A GAP, AND THAT IS Q8's ANSWER  (bug P10)
 * ===========================================================================
 *
 * P10, §7.3, in full: "The pane separator's drag is dead twice over — an inline
 * `gridTemplateColumns` against `!important`, and a `w-px`→`w-2` class swap against a
 * 3-ID rule — while the cursor and hover still say it is live. `aria-hidden="true"`, no
 * role, no keyboard path."
 *
 * Q8 (SCOPE Part 9) is whether the rewrite offers a draggable split AT ALL. Under the
 * overnight rule the answer built is the MOST EASILY REVERSED one: it does not. The
 * divider is `gap: var(--ui-seam)` over `background-color: var(--ui-line-strong)` —
 * the seam utility, `src/components/seams.js`, `.seam-grid.seam-strong` — which means
 * there is no separator ELEMENT at all. Not a div with `cursor: col-resize` and no
 * handler; not an `aria-hidden` node in the tree; nothing. Every clause of P10 needs a
 * separator element to be false of, so every clause of P10 is unreachable here: there
 * is no cursor to lie, no hover to promise, no role to omit and no keyboard path to be
 * missing from. A dead affordance is not fixed, it is absent.
 *
 * WHAT REVERSING IT COSTS, so the morning has a size and not an argument: a real drag
 * is one element in this template, one `--_ui-selector-split-fraction` custom property
 * in the `grid-template-columns` above, pointer handlers on the element, and
 * `role="separator"` + `aria-valuenow` + arrow keys — Appendix 15's window-splitter
 * pattern. It is additive and it touches this file only. Recorded as DQ in
 * `realine-run/waves/5.3/DEFERRED_QUESTIONS_skeleton.md`.
 *
 * ===========================================================================
 * WHY THE SEAM CLASSES ARE ON `#grid` AND NOT ON THE HOST
 * ===========================================================================
 *
 * CONVENTIONS §13 gives two routes: the classes go on the host (and the fragment's
 * `:host(.seam-grid)` copies paint it), or the grid is an ordinary element inside the
 * shadow root (and the fragment's light-DOM copies paint it). The host cannot be the
 * grid here — see the container trap above — so `#grid` carries them, which is the
 * plain route the utility was written for.
 *
 * One class list serves BOTH branches, which is the point of a gap divider. Wide: one
 * column gap draws one vertical rule. Collapsed: one row gap draws one horizontal rule.
 * `.seam-grid` sets both gaps to `--ui-seam`, and an axis with no adjacent pair draws
 * nothing, so neither branch needs a rule the other does not.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';

/**
 * The collapse threshold, in CSS pixels, exported so a suite can sweep across it
 * without spelling it a second time. The CSS below cannot read this — a container
 * condition takes no `var()` and no JS — so this constant and that literal are checked
 * against each other by the suite rather than trusted to stay in step.
 */
export const SPLIT_COLLAPSE_PX = 900;

/**
 * The list pane's track, as authored. Exported for the same reason.
 *
 * BOTH CLAUSES ARE TOKENS NOW, so the literals live in tokens.css where the arithmetic
 * that ties them to SPLIT_COLLAPSE_PX is written down. The share went 40% -> 33.3% on
 * 25 August 2026 (Ben: "could make the list more narrow making the chart bigger"), which
 * is Slate's fixed 640 expressed against 1920, and the minimum went 360 -> 300 with it so
 * the crossing stays on the 900 threshold.
 */
export const SPLIT_LIST_TRACK = 'minmax(var(--ui-selector-list-min), var(--ui-selector-list-share))';

export class SelectorSplit extends UiElement {
    static styles = [seams, css`
        /* THE HOST IS THE CONTAINER, NOT THE GRID. container-type: inline-size comes
         * from the base; what is added here is a box that fills its own grid area in
         * both axes, with both minimums at 0 so the screen's row-2 track — and not this
         * element's contents — decides how much room there is.
         *
         * NO BACKTICK APPEARS ANYWHERE BELOW, in a comment or out of one. A backtick
         * inside a css tagged template ends the template wherever it sits, comment or
         * not, and the file then fails to parse hundreds of characters later at
         * whatever the CSS happens to look like as JavaScript. */
        /* THE SEAM IS THE STRONGER LINE, and it was the weaker one. Ben, 25 August 2026:
         * "There seems to be two vertical lines now on the left side of the list, one is a
         * devider between the list and the chart the other seems to be the edge of the
         * list, but do we need the that last one, looks a bit odd."
         *
         * THERE ARE TWO, AND SLATE HAS TWO AS WELL — the pane divider, and the chart
         * card's own left border 24px inside it. What differs is WHICH READS AS THE
         * DIVIDER. MEASURED off the captures, light theme, on a 242 ground:
         *
         *     Slate    separator 196   card border 223     divider dominant
         *     Decal  seam      224   card border 203     card dominant
         *
         * So the eye took Decal's card edge for the pane boundary and the real boundary
         * for a stray hairline beside it. That is the odd part, not the count.
         *
         * WHY IT WASHED OUT: the seam is a 1px grid GAP, and this screen renders inside
         * zoom 0.6675 at dsf 1.5, so a 1px gap lands on a quarter of a device pixel and
         * antialiases to 224 from a #aab2b7 line. The card's border is 1px of --ui-line
         * on an element, which the compositor snaps to a whole device column and paints at
         * its full 203. Two hairlines, one honoured and one not.
         *
         * TWO HAIRLINES SURVIVE THE ZOOM. --ui-seam-split carries the arithmetic and the
         * measurement; --ui-seam stays one hairline for every seam that is not inside a
         * zoomed pane split. The card border is untouched — in
         * the DARK theme it is the only thing marking the card at all, since the card's
         * fill and the pane's ground are the same value there. */
        :host {
            display: block;
            block-size: 100%;
            min-block-size: 0;
            min-inline-size: 0;
        }

        /* THE GRID. display / gap / ground are the seam utility's, via the classes on
         * this element in render(); this rule adds the tracks to them.
         *
         * minmax(360px, 40%) — §4.2 verbatim. The 360px is a pane minimum, which is
         * §2.3 case 4 ("a min-height that stops a pane collapsing", the inline twin);
         * the 40% is what makes it a pane and not a rail.
         * minmax(0, 1fr) — the 0 floor is deliberate and is the same choice
         * live-screen.js records for its chart row: an auto floor here would be the
         * detail pane's min-content contribution, and the detail pane holds a chart card
         * whose min-content is whatever pixel width uPlot last wrote onto its canvas. */
        #grid {
            /* THE PANE DIVIDER ONLY. Set on the grid and not on :host, because --ui-seam
             * is inherited and the panes inside draw their OWN seams from it — the list's
             * 53 row dividers among them. Widening the token for the subtree widened every
             * one of those too, which is a slab where a hairline belongs. */
            gap: var(--ui-seam-split);
            block-size: 100%;
            min-block-size: 0;
            grid-template-columns: minmax(var(--ui-selector-list-min), var(--ui-selector-list-share)) minmax(0, 1fr);
            align-items: stretch;
        }

        /* THE SLOTS ARE THE GRID ITEMS. display: contents on a slot makes the SLOTTED
         * element the item, so each pane gets its track directly. A wrapper box around a
         * pane would take the track and then have to hand its height on, which is how a
         * floor declared on a pane stops binding (live-main.js records the same choice
         * for the chart card). */
        slot {
            display: contents;
        }

        /* THE COLLAPSE. §4.2: "@container (inline-size < 900px) → single column, list
         * over detail". One declaration: one column. The slots are in source order, so
         * "list over detail" is what the grid does with them and nothing states it.
         *
         * < 900px, exclusive, as the spec writes it — at exactly 900 the two-column
         * layout is still the two-column layout (40% is still 360, the minimum has not
         * begun to govern), so 900 belongs to the wide branch. The suite pins the flip
         * at 899/900 rather than assuming an inclusive reading. */
        @container (inline-size < 900px) {
            #grid {
                grid-template-columns: minmax(0, 1fr);
            }
        }
    `];

    render() {
        return html`
            <div id="grid" part="grid" class="seam-grid seam-strong">
                <slot name="list"></slot>
                <slot name="detail"></slot>
            </div>
        `;
    }
}

customElements.define('selector-split', SelectorSplit);
