/**
 * live-main.js - <live-main>, column 2 of the Live skeleton: gauges, chart, GHC strip.
 *
 * LAYOUT_SPEC_DRAFT.md §4.1, verbatim:
 *
 *     <live-main>   col 2, row 2   display:grid; rows: auto minmax(0,1fr) auto
 *       ├─ <stat-cluster>   auto      (heading + gauges)
 *       ├─ <chart-card>     1fr       min-block-size: var(--ui-chart-min-h)
 *       └─ <ghc-strip>      auto      IN FLOW - never absolute
 *
 * THE FIRST ROW IS NO LONGER THIS FILE'S (Ben, 23 Aug 2026). The stat cluster moved
 * INSIDE the chart card, as its `legend` slot, so the card's border and well enclose
 * the title and the seven readouts: "Should look like this is a screen with these
 * values on it." What is left here is one 1fr row and the strip's implicit one.
 *
 * THREE THINGS THIS FILE DOES DIFFERENTLY FROM THAT SKETCH, each on purpose:
 *
 * 1. THE ROWS ARE `auto minmax(0, 1fr)` - the sketch's own spelling, kept after the
 *    obvious improvement was built and measured. `minmax(auto, 1fr)` looks like the
 *    L2 / L4 / L18 cure (take the item's own minimum as the track's floor, so no box
 *    is smaller than its content) and it PINS the row: `auto` is the item's
 *    min-content contribution, and a chart card's min-content is whatever pixel
 *    height uPlot last wrote onto its canvas. Measured on this screen: the row froze
 *    at 804px and the chart stayed 690px from a 1080-row window down to a 480-row
 *    one. `ui-chart-card.js` records the same trap for its own inner track. The floor
 *    that matters is therefore the CARD's, declared on the card
 *    (--ui-chart-min-h plus its chrome), and below it the card overflows its row
 *    visibly rather than the row lying about how small it can be (§2.4).
 *
 * 2. THE THIRD ROW IS IMPLICIT, not a declared `auto` track. A declared third track
 *    would still lay down a `gap` above it while it is empty, so a machine with no
 *    group-head controller would carry an 18px hole where the strip is not. The strip
 *    lands in an implicit auto row when - and only when - something is slotted into
 *    `ghc`, which is also what makes the capability gate a CONTENT decision (one
 *    element slotted or not) rather than a layout one.
 *
 * 3. THE SLOTS ARE THE GRID ITEMS. `slot` is `display: contents`, so the slotted
 *    element is itself the grid item: the chart card gets the `1fr` row directly,
 *    which is the sizing contract its own file was written against ("Live gives it
 *    the single 1fr row", §6.1). A wrapper div with `min-block-size: 0` around it -
 *    the reflex - would defeat the card's floor from the outside and put the canvas
 *    back outside its own border, which that file records as measured behaviour.
 *
 * BUG L1 IS WHY THE STRIP IS A ROW. "The GHC strip covers the chart's entire time axis
 * - measured 855...933 against a chart bottom of 900, over a 40px axis gutter. It is
 * position: absolute inside #main-row, so resizeLiveChart cannot give the space back.
 * Shown on every machine WITHOUT GHC hardware" (§7.2 L1). In flow, an overlap is not a
 * state this layout can reach, and the chart's box shrinks by exactly the strip's
 * height the moment the strip exists. WHETHER it exists is `live-capability-gates-ghc`'s
 * row and goes through r3GroupHeadControllerCapability, which can answer "not known";
 * this file neither reads a capability nor sniffs a machine name.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

export class LiveMain extends UiElement {
    static styles = [css`
        :host {
            display: grid;
            /* ONE EXPLICIT ROW SINCE 23 Aug, AND THE CHART CARD IS IT. Ben: "The chart
             * card need to iverlap the values and the chart title above it including the
             * Time etc. Should look like this is a screen with these values on it."
             *
             * The identity line, the notices, the seven readouts and the clock used to
             * be this grid's first row, ABOVE the card, so the framed dark panel held
             * only the plot and the numbers floated on the page beside it. They are the
             * card's legend slot now — inside its border, on its own well — which is
             * what makes the whole thing read as one instrument screen.
             *
             * THE SECOND TRACK IS GONE RATHER THAN LEFT EMPTY, for the reason the GHC
             * strip's own note gives one paragraph down: a declared track lays down a
             * gap while it is empty, so an unused stats row would have been an 18px
             * hole above the card on every machine. The GHC strip still lands in an
             * implicit auto row when something is slotted into it. */
            grid-template-rows: minmax(0, 1fr);
            gap: var(--ui-space-4);

            /* THE INSET IS SLATE'S, MEASURED RATHER THAN INHERITED (parity
             * 7-live-polish, it19). It was --ui-space-4 (18px), which is this file's
             * own gap doing double duty as its margin — a reasonable default and 39px
             * short of the reference:
             *   ORACLE live-ready <main> [i=89] begins at x=431 and everything inside
             *          it starts at 488 — #profile-name [i=92] x=488, the readout
             *          cluster's first label [i=96] x=488, #chart-wrap [i=115] x=488
             *          — and the chart's right edge is 488+1375 = 1863 against the
             *          band's own 1920, i.e. 57px of inset on both sides. (Slate
             *          spends it as 28 on an inner column plus 29 inside that; the
             *          rendered result is one 57px inset and that is what this is.)
             * MEASURED BEFORE: Decal's heading sat at 449 and its chart ran to 1902,
             * so the whole right-hand column read 39px left of the oracle's and the
             * plot was 78px wider than Slate's.
             * --ui-space-8 is 56px, the scale's own nearest step to 57, and one pixel
             * is not worth a literal — the rail's inset note above makes the same
             * trade for the same reason. */
            /* BACK TO SLATE'S MEASURED INSET, AND THE AIR MOVED INSIDE THE CARD.
             *
             * This was --ui-space-8 + --ui-space-3 (68) for one round, after Ben asked
             * for "a bit more martih to the top left and right" — and the round after
             * that he asked for the opposite: "increase margn between the profile name
             * and the top edge of the card. Reduce the margin around the outside of the
             * card." The two readings are the same complaint from two sides. The card
             * encloses the title, the status, the clock and seven readouts now, and its
             * own frame held them 13px from its edge; widening the page inset made the
             * panel look padded while its content stayed crammed against the border.
             *
             * So the air is spent where the crowding is — ui-chart-card's own
             * --_ui-chart-card-pad-top — and this came back off the page.
             *
             * --ui-space-7 IS BEN'S NUMBER AND IT LEAVES THE ORACLE BEHIND, which is
             * worth saying plainly. Slate's own inset measures 57 (ORACLE live-ready
             * <main> [i=89] begins at x=431 with everything inside it starting at 488)
             * and --ui-space-8 is the scale's nearest step to it, which is what this was
             * for every round until now. He asked for 40 with the card's head already
             * padded — "Page inset around the card could be dropped to like 40 or so" —
             * and --ui-space-7 was exactly 40. The precedence chain puts his decisions
             * above Slate-as-photographed; the departure is recorded here rather than
             * left to be rediscovered as a parity miss.
             *
             * AND NOW 24, WHICH IS THE THIRD ROUND OF THE SAME COMPLAINT. Ben, 25 August
             * 2026: "The margin around the outside of the chart, can you make it the same
             * as slate, looks like its 50-60% of what it is currently."
             *
             * THE TWO HALVES OF THAT SENTENCE DISAGREE AND THE NUMBER WINS. Slate's inset
             * is 57 (the ORACLE above), which is LARGER than the 40 this replaces, not
             * 50-60% of it; 50-60% of 40 is 20 to 24. He has now asked for this inset to
             * come down twice — 56 to 40, and 40 to this — so the reading that returns it
             * to Slate's 57 is the one reading he cannot mean. --ui-space-5 is 24, the top
             * of his range and the scale's own step.
             *
             * IT IS ALSO WHAT MAKES THE RAIL LINE UP. The card's top edge is this padding,
             * and the rail's first stepper is the rail's; Ben asked in the same message for
             * "the top of it should align with the top of the chart card", so live-rail
             * spends the same token on its block inset. Two elements, one number, and the
             * alignment is arithmetic rather than a correction. */
            padding: var(--ui-space-5);
            background-color: var(--ui-fascia);
            min-inline-size: 0;
        }

        /* Stated rather than inherited from the UA sheet: these slots are transparent
         * on purpose, because the grid items are what is slotted INTO them. */
        slot {
            display: contents;
        }

        /* No correction margins here either (see <live-rail>): the gap is the gap.
         *
         * NOT position: static on ::slotted(*), which is the reflex for "bug L1
         * cannot come back". An outer-tree declaration beats a component's own
         * :host rule, and plot-surface.js:126 sets :host { position: relative }
         * because the crosshair and the refusal overlay are positioned inside it -
         * so that reflex would quietly break the chart from the outside. L1 dies
         * because the strip is a GRID ROW, which the suite asserts on the rendered
         * strip, not because this file forbids a keyword. */
        ::slotted(*) {
            margin: 0;
        }
    `];

    render() {
        return html`
            <slot name="chart"></slot>
            <slot name="ghc"></slot>
        `;
    }
}

customElements.define('live-main', LiveMain);
