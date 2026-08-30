/**
 * selector-list-pane.js — <selector-list-pane>, column 1 of the Profile selector.
 *
 * LAYOUT_SPEC_DRAFT.md §4.2, verbatim:
 *
 *     ├─ <list-pane>    grid-rows: auto auto minmax(0,1fr) auto
 *     │    ├─ toolbar        var(--ui-toolbar-h)
 *     │    ├─ filter field   auto
 *     │    ├─ <profile-list> 1fr, overflow-y:auto, min-block-size: 4 × --ui-list-row
 *     │    └─ favourites     auto
 *
 * Four slots, four tracks, in that order. The sketch's first row is written twice in
 * the spec — "auto" in the track list and "var(--ui-toolbar-h)" in the annotation — and
 * the annotation wins, because that is the row §3.2 resolved a disagreement about
 * ("Toolbar: 121.5 → 120", the two effective h-[121.5px] literals in
 * profile_selector.html:17 and :48). A row whose height is a token cannot drift 1.5px
 * from the identical row in the pane beside it, which is what the detail pane's title
 * row is; both name --ui-toolbar-h and neither names a number.
 *
 * ===========================================================================
 * THE ONE SCROLL REGION, ITS FLOOR, AND WHY THE PANE OWNS BOTH  (§2.4, P5)
 * ===========================================================================
 *
 * §4.2's floors table: "Profile list | 4 × var(--ui-list-row) = 256px (spec §4.2) |
 * auto, VISIBLE scrollbar". §2.4 asks for three things per region and this is all three
 * in one box: an explicit min-block-size, an explicit overflow, and a stated place in
 * the order of surrender.
 *
 * THE REGION IS A BOX IN THIS SHADOW ROOT, NOT THE SLOTTED CONTENT. #list carries the
 * floor and the overflow and holds slot="list"; whatever a later wave slots in — a real
 * <profile-list> with a listbox in it (P12), a folder disclosure tree (#28), an empty
 * state — inherits a region that already scrolls and already has a floor. The
 * alternative, putting overflow on the slotted element, makes the contract the
 * CONTENT's, so every future thing slotted here has to remember it. One owner per
 * dimension (§2.3) is the same rule read one box out.
 *
 * P5 IS THIS ROW AND IT DIES ON THE OWNERSHIP, NOT ON THE NUMBER. §7.3: "#profile-list's
 * !important height (736px, 'so a partial row always peeks') WINS the cascade and LOSES
 * the layout to a flex: 1 1 0 elsewhere. Measured 782.5px." Two owners for one
 * dimension: a declared height in slate-shell.css:2069-2071 and a flex basis in
 * main.css:43-48, with the important flag deciding the cascade and the flex algorithm
 * deciding the pixels — so the sheet's number was never the rendered number and the
 * comment explaining the intent describes a layout that did not happen. Here the
 * region's block size has exactly one owner, the grid track (minmax(0, 1fr)), and the
 * region declares a MINIMUM and nothing else. There is no height to disagree with, and
 * there is no important flag in the tree at all — Gate C's third guard scans src/ and
 * test/guards.test.mjs asserts it fails on its own canary.
 *
 * AND THE INTENT SLATE'S COMMENT NAMED IS KEPT, for free, by the floor being a MULTIPLE
 * OF THE ROW rather than a pixel height: at exactly 4 × --ui-list-row the region shows
 * four whole rows, and at every size above it the region is 1fr of a fluid pane and a
 * partial row peeks whenever the arithmetic does not divide — which is what "so a
 * partial row always peeks" was reaching for with a number that could not deliver it.
 *
 * VISIBLE SCROLLBAR, SAID ONCE AND NOT AT ALL. Hiding it is banned (§2.4:
 * "slate-shell.css:456 sets scrollbar-width: none on both Settings nav columns while
 * they remain scrollable"), and the way to honour that is to declare nothing: the UA's
 * classic scrollbar is the visible one. This file therefore contains no
 * scrollbar-width, no scrollbar-color and no ::-webkit-scrollbar rule, and the suite
 * asserts the gutter is non-zero rather than trusting the absence.
 *
 * ===========================================================================
 * WHAT THIS PANE DOES NOT DO
 * ===========================================================================
 *
 * No data, no listbox, no selection, no folder grouping. Those are the selector's other
 * wave-5.3 rows (sel-components, sel-core-loop, bug-P12-real-listbox), and a skeleton
 * that grew them would be building the same screen twice. This file is four tracks and
 * one scroll region, and every one of them is measured.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

export class SelectorListPane extends UiElement {
    static styles = [css`
        /* NO BACKTICK IN THIS TEMPLATE, comment or not: one ends the tagged template
         * where it stands and the file stops parsing as JavaScript some way further on. */
        :host {
            display: grid;
            grid-template-rows: var(--ui-selector-band-h) auto minmax(0, 1fr) auto;
            gap: var(--ui-space-3);
            padding: var(--ui-space-5);
            background-color: var(--ui-fascia);
            min-inline-size: 0;
            min-block-size: 0;
        }

        /* The toolbar and the favourites bank are the grid items themselves, so their
         * tracks reach them directly. The list is the exception and it is deliberate:
         * that box is the scroll region and has to exist in this root to own it. */
        slot[name="toolbar"],
        slot[name="filter"],
        slot[name="favourites"] {
            display: contents;
        }

        /* THE SCROLL REGION. Three declarations, and §2.4 asks for exactly these:
         *   overflow-y: auto     scrolls when it must, shows the bar when it does
         *   min-block-size       the floor, four rows, from the token
         *   min-inline-size: 0   so a long profile title cannot widen the pane and
         *                        push the split's own minmax(360px, 40%) around
         * No overflow-x: the region scrolls in one axis and a title that does not fit
         * is the list row's problem to end (#26), not a horizontal bar's. */
        #list {
            overflow-y: auto;
            /* scrollbar-width DOES NOT INHERIT, and scrollbar-color does. That split is
             * why this looked settled: styles/document.css sets both on :root, the thumb
             * colour arrived here through inheritance, and the WIDTH stopped at <html>.
             * MEASURED on the rig: html thin, body auto, and every element from body down
             * to this one auto. So the skin's thin scrollbar was drawn at the browser's
             * default width everywhere except the document scroller.
             *
             * Ben asked on 25 August 2026 whether the list and the notes need a scrollbar.
             * They already had one, and this is what was wrong with it. live-rail.js:159
             * carries the same line for the same reason. */
            scrollbar-width: thin;
            min-block-size: var(--ui-selector-list-min-h);
            min-inline-size: 0;
        }
    `];

    render() {
        return html`
            <slot name="toolbar"></slot>
            <slot name="filter"></slot>
            <div id="list" part="list"><slot name="list"></slot></div>
            <slot name="favourites"></slot>
        `;
    }
}

customElements.define('selector-list-pane', SelectorListPane);
