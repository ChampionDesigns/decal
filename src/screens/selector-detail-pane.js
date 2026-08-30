/**
 * selector-detail-pane.js — <selector-detail-pane>, column 2 of the Profile selector.
 *
 * LAYOUT_SPEC_DRAFT.md §4.2, verbatim:
 *
 *     └─ <detail-pane>  grid-rows: auto auto minmax(0,1fr) auto
 *          ├─ title row      var(--ui-toolbar-h)
 *          ├─ summary strip  auto
 *          ├─ <chart-card>   1fr, min-block-size: var(--ui-chart-min-h)
 *          └─ <notes-pane>   auto, max-block-size: 32%, overflow-y:auto
 *
 * ===========================================================================
 * THE TWO ELASTIC BOXES, AND THE ORDERING THE OLD APP HAS BACKWARDS
 * ===========================================================================
 *
 * §4.2: "The list and the chart are the two elastic boxes. The notes pane is auto with
 * a cap — NOT the unconditional 275px it is today." And the verifier's correction, which
 * is the part worth building against: "275px is unconditional only while free space
 * remains; once the chart is squeezed to zero the notes shrink too, because
 * #profile-chart-wrap has flex-basis: 0 and contributes zero shrink weight —
 * layout/selector.md V.2. EITHER WAY THE ORDERING IS WRONG: notes should give before
 * the chart is destroyed."
 *
 * So the defect is not that the notes are 275px. It is that the notes are sized FIRST
 * and the chart gets what is left, which in a flex row with a zero basis is nothing.
 * The cure is to reverse which box is the flexible one:
 *
 *   row 3  minmax(0, 1fr)                    the chart. The only 1fr.
 *   row 4  var(--ui-selector-notes-share)    the notes. A SHARE, not content-sized —
 *                                            25% of the pane's CONTENT box, whatever
 *                                            the note is — see below.
 *
 * Now the notes can never take space the chart needs, because the notes take a fixed
 * fraction and the chart takes everything else. §4.2's order of surrender falls out of
 * the two track functions rather than being enforced anywhere: "list and chart share the
 * loss until the chart hits --ui-chart-min-h; then the notes cap tightens; then the list
 * scrolls harder". Phase one is the 1fr giving. Phase two is 25% OF A SMALLER PANE being
 * a smaller number — a share cannot outlive the box it is a share of, which is the whole
 * reason it is a percentage and not a length.
 *
 * WHAT THE 25% IS 25% OF: THE CONTENT BOX, NOT THE PANE. §4.2 writes the old cap as
 * "max-block-size: 32%" and it is natural to read a figure like that as a fraction of the
 * pane's height. It is not, and the difference is this pane's own padding. The share is a
 * TRACK function, and a track percentage resolves against the grid container's CONTENT
 * box — here paneH - 2 * var(--ui-space-5), i.e. paneH - 48px. Measured, both geometries:
 *
 *   BENCH  pane 682px      0.25 * (682 - 48)    = 158.50   region 158.500px
 *   FLOOR  pane 495.75px   0.25 * (495.75 - 48) = 111.94   region 111.938px
 *
 * So the region measures 23.2% / 22.6% OF THE PANE, and those two numbers are not slack —
 * they are the padding term, exactly. Reading the share against the border box gives
 * 0.25 * 495.75 = 123.9px at the design floor, 12px more than the screen actually
 * delivers. The suite asserts against the content box for that reason; a guard written as
 * pane.height * 0.25 is loose by 2 * --ui-space-5 and would not catch a regression to the
 * border-box reading.
 *
 * BOTH NUMBERS IN THAT ARITHMETIC MOVED ON 25 AUGUST 2026 AND EACH HAS ITS OWN REASON.
 * The share is 25% and not 32% because a cap was the wrong instrument — the block below
 * on fit-content() carries Ben's sentence and the measurement. The inset is --ui-space-5
 * and not --ui-space-4 because version 0.1.23 brought the picker's band down to the Live
 * page's shape: the band's buttons are "64, not 82" and "the panes take the Live page's
 * inset". They are unrelated changes that land in the same expression, which is exactly
 * why the expression is written out here rather than left as a remembered number.
 *
 * THE CHART'S FLOOR IS NOT DECLARED HERE, ON PURPOSE, AND THE ROW IS minmax(0, 1fr).
 * <ui-chart-card> carries it: min-block-size: calc(var(--ui-chart-min-h) +
 * var(--_ui-chart-card-chrome)), because 160px is the PLOT's floor and a CARD is that
 * plot plus a legend row, an inset and a hairline (ui-chart-card.js:220-250, measured —
 * a card at 200px drew its canvas 17px below its own border). Restating the floor on
 * this track would restate a number this pane cannot see the chrome half of, which is
 * §2.3's "the same number written in two places" with the second copy wrong. And
 * minmax(auto, 1fr) — the reflex, the L2/L4/L18 cure — is the trap live-screen.js and
 * ui-chart-card.js both record: auto resolves to min-content, and a chart card's
 * min-content is whatever pixel height uPlot last wrote onto its canvas, so the row
 * freezes at its first layout and never shrinks again.
 *
 * Squeezed below the card's own floor the CARD overflows this pane, visibly, with its
 * border still around its plot (§2.4) — which is the arrangement §4.2 describes and
 * live-screen.js measured. The suite records the pane height at which that begins at
 * both geometries, because that number is what "the chart is never reduced to a strip"
 * costs, and the morning should have it.
 *
 * THE NOTES ROW IS A SHARE NOW, AND fit-content() IS GONE WITH ITS PROBLEM. Ben asked on
 * 25 August 2026 to "reduce the chart height and make more space for the description",
 * and MEASURED the cap was never the thing holding the notes down: a fit-content row
 * takes its CONTENT's height, so a short note left the box at its floor (164 against
 * Slate's 275) and the chart kept everything else. The cap only ever stopped a long note
 * eating the chart. A flat 25 % is what Slate has and it holds whatever the note is.
 *
 * WHAT IS LOST WITH fit-content IS ITS TRAP, and it was a real one worth keeping written
 * down: fit-content() IS NOT ALLOWED INSIDE minmax(), so the obvious spelling —
 * minmax(var(--ui-selector-notes-min-h), fit-content(32%)) — is INVALID CSS. Chrome drops
 * the whole grid-template-rows declaration, the rows fall back to auto, and everything
 * still looks plausible while the toolbar row has silently stopped being --ui-toolbar-h.
 * live-screen.js caught exactly this on the Live foot band by measuring the used track
 * list (82.23px against a 118px band), and the suite here still reads back the USED track
 * list rather than the authored one.
 *
 * ===========================================================================
 * REGISTER: ONE INSET, ONE RHYTHM, FOUR ROWS  (bugs P7, P16)
 * ===========================================================================
 *
 * P7, §7.3: "The summary strip and the chart card are 24px OUT OF REGISTER (28 vs 52
 * measured), and the strip's own 18px inset paints nothing."
 * P16, §7.3: "Dead markup utilities: p-4's horizontal halves on both right-pane boxes
 * (measured 24 and 28), and space-y-1.5 on the list."
 *
 * Both are the same shape: more than one thing declaring the same edge. Here the pane's
 * padding is the ONLY horizontal inset in this box and the pane's row-gap is the ONLY
 * vertical rhythm; no child declares either, so no child can disagree by 24px, by 4px,
 * or at all. Every item in a single-column grid starts at the same x by construction —
 * the register is not maintained, it is unavailable to break. The suite measures it as
 * one number (all four items share a left edge) rather than as four assertions.
 *
 * Both values are on the seven-step scale (§3.3): --ui-space-5 = 24px inset,
 * --ui-space-3 = 12px gap. Nothing here is 26, 30, 32 or 9.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

export class SelectorDetailPane extends UiElement {
    static styles = [css`
        /* NO BACKTICK IN THIS TEMPLATE, comment or not: one ends the tagged template
         * where it stands and the file stops parsing as JavaScript some way further on. */
        :host {
            display: grid;
            grid-template-rows:
                var(--ui-selector-band-h)
                auto
                minmax(0, 1fr)
                var(--ui-selector-notes-share);
            gap: var(--ui-space-3);
            padding: var(--ui-space-5);
            background-color: var(--ui-fascia);
            min-inline-size: 0;
            min-block-size: 0;
        }

        /* The title row, the summary strip and the chart card are the grid items
         * themselves. The chart card in particular MUST be, and ui-chart-card.js says
         * why in its own words: it is written against getting the single 1fr row
         * directly (§6.1), and a wrapper with min-block-size: 0 around it would defeat
         * the card's own floor from the outside and put the canvas back outside its
         * border. slot is display: contents, so the slotted element is the item. */
        slot[name="title"],
        slot[name="summary"],
        slot[name="chart"] {
            display: contents;
        }

        /* THE NOTES REGION. The CAP is the track above; this is the other three things
         * §2.4 asks for.
         *
         * min-block-size is the M18 PROPOSAL: §4.2's floors table says "one line of its
         * own type (proposal — confirm on prototype)", so the token is one line of
         * --ui-text-base at the 1.5 ratio and nothing else. It is the floor of the
         * REGION, and it GOVERNS: swept to a 160px stage the region holds 25.5px at both
         * geometries, reached from a 380px stage at BENCH and a 340px stage at FLOOR.
         *
         * <ui-notes-editor> (#55) BRINGS NO FLOOR OF ITS OWN, and that is deliberate on
         * the component's side: ui-notes-editor.js:355-359 is
         * ":host { block-size: 100%; min-block-size: 0 }" so a dialog body can compress
         * (§4.6). Its --_ui-notes-min-h sits on .CodeMirror INSIDE that zero-floor host,
         * so it overflows within the editor rather than pushing this region. Nothing
         * slotted here can raise the region's minimum unless it declares a floor on its
         * own host; the "larger of the two minimums wins" reading was measured wrong —
         * the two intermediate readings it rested on (63px at BENCH, 89.5px at FLOOR,
         * both at a 420px stage) are the leftover space in the pane and the 32% cap
         * respectively, not minimums. M10 owns the measurement that freezes the token
         * (SCOPE Part 9: "whether #profile_notes' 275px is ever exceeded"); until it is
         * taken the token stays a proposal and the suite prints the swept number.
         *
         * overflow-y: auto, and no scrollbar-width anywhere in this file — the visible
         * bar is the UA's and hiding it is banned (§2.4). */
        #notes {
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
            min-block-size: var(--ui-selector-notes-min-h);
            min-inline-size: 0;
        }
    `];

    render() {
        return html`
            <slot name="title"></slot>
            <slot name="summary"></slot>
            <slot name="chart"></slot>
            <div id="notes" part="notes"><slot name="notes"></slot></div>
        `;
    }
}

customElements.define('selector-detail-pane', SelectorDetailPane);
