/**
 * settings-nav-column.js — <settings-nav-column>, and it is BOTH nav columns.
 *
 * `LAYOUT_SPEC_DRAFT.md` §4.4, verbatim:
 *
 *     ├─ <nav-column>      search field (auto) + list (1fr, overflow-y:auto, VISIBLE scrollbar)
 *     ├─ <subnav-column>   list (1fr, overflow-y:auto, VISIBLE scrollbar)
 *
 * ===========================================================================
 * ONE COMPONENT, TWO INSTANCES — WHICH IS T2's REMEDY READ ONE BOX OUT
 * ===========================================================================
 *
 * §7.5 T2: "The sub-category column does not align with the category column: the
 * `> * + *` half of the rule can never match, because renderSubcategories() returns a
 * single <ul>. Measured pitch 89 vs 93, 24px out by row 7 — and the same mistake means
 * the sub-nav has no row separators at all (measured box-shadow: none)."
 * (`slate-shell.css:417-424, 430-434`; `settings.js:6426`.)
 *
 * MEASURED, from the corpus, in ONE capture — this is the defect, not a reading of it:
 *   CITE settings-machine-machine-info .settings-nav-btn rows [i=9,11,13,15,17,19,21,23,25,27]
 *        rect y = 219, 308, 397, 486, 575, 664, 753, 842, 931, 1020   (pitch 89)
 *   CITE settings-machine-machine-info .settings-subnav-btn rows [i=30,32,34,36,38,40,42]
 *        rect y = 219, 312, 405, 498, 591, 684, 777                   (pitch 93)
 *   Row 7: 753 against 777. Twenty-four pixels, in one screenshot.
 *
 * SCOPE Part 5 §4 asks for the remedy in one clause: "the two nav columns must share one
 * pitch **by construction** (same component, same token), not by two rules hoping to
 * agree". So:
 *
 *   THE ROWS are #24 `ui-nav-row` and #25 `ui-subnav-row`, and both take their pitch
 *   from ONE token — `--ui-nav-row` (`ui-nav-row.js` min-block-size, `ui-subnav-row.js`
 *   block-size). Neither reaches for a number.
 *
 *   THE COLUMNS are this file, used twice. Not two files with matching rules: two
 *   instances of one element. The floor, the scroll behaviour, the separator weight and
 *   the row rhythm are therefore the same declarations, not the same intentions, and
 *   "89 vs 93" has no way to be written down.
 *
 * The search field is a SLOT, which is what lets one component be both: the sub-nav
 * instance leaves it empty and the head track is simply blank fascia. There is
 * deliberately NO row-gap on this grid — a gap applies between tracks whether or not
 * the first has an item, so a gap would put the sub-nav's first row 12px below the
 * nav's for exactly no reason. The field carries its own margin instead, which exists
 * only when the field does.
 *
 * ===========================================================================
 * BOTH LISTS START AT THE SAME y — AND THE 1px THAT PROVED THEY DID NOT
 * ===========================================================================
 *
 * This header used to end with a declared departure: "§4.4 puts the field inside
 * <nav-column>, so here the sub-nav list starts higher than the nav list. PITCH is what
 * T2 is about and pitch is identical; the OFFSET differs, on the layout spec's
 * instruction."
 *
 * The offset was 88px — the `auto` head track collapsed to zero in the sub-nav
 * instance — and the pitch is 89 (--ui-nav-row plus one seam). 88 is not a whole number
 * of pitches, so every separator in one column landed exactly ONE PIXEL from its
 * neighbour in the other, all the way down. MEASURED at the bench, 21 Aug 2026, and
 * reported by eye before it was measured: nav separators at y = 384 / 473 / 562 / 651
 * against sub-nav 385 / 474 / 563 / 652.
 *
 * A one-pixel stagger is the worst version of this: too small to read as a design and
 * too visible to ignore, on two lists whose whole claim is that they share a rhythm.
 *
 * SO THE HEAD TRACK IS DEFINITE AND IT IS ONE ROW TALL, in both instances.
 * `--ui-nav-row` is `(--ui-control-h + 2 * --ui-space-3) * --ui-density`, which is
 * exactly what the field's own box already came to: the control height plus the margin
 * it carries on each side. So the nav column's head does not move, the sub-nav column
 * gains a head of the same height, and the two lists start at the same y — by
 * construction and from the SAME token the rows take their pitch from, which is the
 * form T2's remedy asks for ("not two rules hoping to agree").
 *
 * It also puts the two lists back where Slate had them. Slate's search spans BOTH
 * columns (`#settings-search` is a child of `#left-panel`, above
 * `#settings-navigation-container`), so its two lists start at the same y — 219 in the
 * corpus, for both. The declared departure is therefore withdrawn rather than
 * reinterpreted: §4.4 still puts the FIELD inside <nav-column>, and the ALIGNMENT is
 * Slate's again.
 *
 * ===========================================================================
 * THE SEPARATORS — T2's second clause, and seams.js trap 2
 * ===========================================================================
 *
 * The sub-nav lost its separators to the same broken selector that lost it its pitch. A
 * grid gap needs no sibling selector: N rows give N-1 seams by construction, from the
 * container, and a separator cannot silently fail to exist (CONVENTIONS §13; the seam
 * utility's own header records T2 as dead for this reason).
 *
 * THE SEAM GRID IS #rows, NOT #list, and that is seams.js trap 2 — "leftover track space
 * is also ground". A short list inside a tall scroll region would paint the whole
 * remainder in divider ink if the region itself were the seamed grid. So the region
 * (#list) is fascia and scrolls; the seamed grid (#rows) is exactly as tall as its rows;
 * the leftover below it is page ground. `align-content: start` is the other half — an
 * auto-track grid stretches its tracks to fill by default, which would make three rows
 * in a tall column 300px tall each and destroy the very pitch this file exists to hold.
 *
 * The weight is `.seam-line` (--ui-line, Appendix 2's weight 2, "the weight that encloses
 * a control, used as a divider between controls"), not `.seam-strong`: strong is the
 * rail edge and the header underline, and these are rows inside one surface.
 *
 * ===========================================================================
 * THE FLOOR AND THE SCROLLBAR  (§2.4, T16, M18)
 * ===========================================================================
 *
 * §2.4 asks three things of a scroll region and #list is all three in one box: an
 * explicit min-block-size, an explicit overflow, and a stated place in the order of
 * surrender (this column gives before the leaf pane does — the leaf pane is the elastic
 * one, §4.4 "Flexes / does not").
 *
 * The floor is `--ui-settings-nav-min-h`, three rows, and it is A PROPOSAL CARRIED AS A
 * TOKEN (M18): Part 5 §4's table says "3 x var(--ui-nav-row) (proposal — confirm on
 * prototype)", and Part 10 §9's review check is that every floor marked "proposal —
 * confirm" is a token with an M18 note rather than a frozen number. `styles/tokens.css`
 * carries the note. ONE token for both instances, so confirming it moves both columns.
 *
 * §7.5 T16: "Both nav columns hide their scrollbars while remaining scrollable — the
 * category column starts scrolling below ~1137 rows with no affordance."
 * (`slate-shell.css:456`.) The remedy is to DECLARE NOTHING: the UA's classic scrollbar
 * is the visible one. This file contains no `scrollbar-width`, no `scrollbar-color` and
 * no `::-webkit-scrollbar` rule, and the suite asserts the gutter is non-zero under
 * squeeze rather than trusting the absence.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';

export class SettingsNavColumn extends UiElement {
    static styles = [seams, css`
        /* NO BACKTICK IN THIS TEMPLATE, comment or not: one ends the tagged template
         * where it stands and the file stops parsing as JavaScript some way further on.
         *
         * TWO TRACKS AND NO GAP. --ui-nav-row for the search field — ONE ROW TALL, in
         * both instances, which is what makes the two lists start at the same y (see
         * the header: an auto track that collapsed in the sub-nav instance put every
         * separator 1px from its opposite number) — and minmax(0,1fr) for the list,
         * whose 0 floor lets the region shrink to its own declared minimum instead of
         * to its content's. The ground is fascia so the seamed grid inside shows a line
         * between rows and nothing anywhere else.
         *   CITE settings-machine-machine-info #left-panel [i=6] background-color =
         *        rgb(14, 19, 23)  <-  slate-shell.css  winning rule
         *        (hash)subpage-host (hash)settings-body > (hash)left-panel
         *        (token-driven) = --ui-fascia, exact in both themes.
         *        NO BACKTICK: the quoting a citation normally takes would end this
         *        tagged template where it stands. */
        /* ONE TRACK NOW, AND THE SPACER IS GONE (26 August 2026).
         *
         * This was two rows: a head as tall as --ui-nav-row for the search field, and the
         * list. The head existed in BOTH instances even though only one of them ever held
         * a field — a blank track in the sub-nav column whose whole job was to keep the
         * two lists starting at the same y, because the field was inside one column.
         *
         * Ben moved the field over both columns, so it is the master-detail's grid item
         * and the row above BOTH lists. There is nothing to leave room for and nothing to
         * compensate for: the lists line up because the row above them is one row. */
        :host {
            display: grid;
            grid-template-rows: minmax(0, 1fr);
            background-color: var(--ui-fascia);
            min-inline-size: 0;
            min-block-size: 0;
        }

        /* THE SCROLL REGION. §2.4's three declarations and nothing else; the floor is
         * a token and the visible scrollbar is an absence. */
        #list {
            grid-row: 1;
            overflow-y: auto;
            min-block-size: var(--ui-settings-nav-min-h);
            min-inline-size: 0;
        }

        /* THE SEAMED GRID. Rows are as tall as they are (align-content: start), the
         * gaps between them are the separators, and the leftover below is the region's
         * fascia rather than a slab of ink. */
        #rows {
            align-content: start;
            min-inline-size: 0;
        }
    `];

    render() {
        return html`
            <div id="list" part="list">
                <div id="rows" part="rows" class="seam-grid seam-rows seam-line">
                    <slot></slot>
                </div>
            </div>
        `;
    }
}

customElements.define('settings-nav-column', SettingsNavColumn);
