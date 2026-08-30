/**
 * live-rail.js - <live-rail>, the Live screen's settings rail. Bug L5 dies here, and
 * it dies STRUCTURALLY rather than by being measured more carefully.
 *
 * WHAT L5 IS. LAYOUT_SPEC_DRAFT.md §7.2: "The rail's rhythm is a solved chain with two
 * EMERGENT alignments; changing one row breaks both" (`slate-live.css:426, 467, 493,
 * 496, 742`; `layout/live.md` V.1). §4.1 spells the chain out: a fractional
 * `--slate-rail-gap: 26.75px` plus four correction margins, producing separator 4
 * landing on 825.5 = --slate-band-top 826 and the last stepper's bottom landing on
 * 1026 = the foot band's buttons. Both verified exact, and both break if one row is
 * added, deleted or hidden. §4.1's instruction is one sentence: "The rewrite gets its
 * alignments from the grid or does without them."
 *
 * SO THIS FILE HAS NO SOLVED NUMBER IN IT AT ALL. One gap token, one distribution rule
 * for the whole column, no correction margins - and the margins are not merely absent,
 * they are ZEROED on the way in: `::slotted(*) { margin: 0 }`. An outer-tree rule beats a
 * component's own `:host` rule for normal declarations (CSS Scoping), so a row that
 * tries to nudge itself into line cannot, and a rhythm that singles one row out is not
 * expressible here. That is the difference between fixing the four margins and removing
 * the mechanism that made them look like a good idea.
 *
 * THE LEFTOVER HEIGHT IS SHARED SINCE 25 AUGUST 2026, AND IT IS STILL NOT A CHAIN. The
 * sentence above used to name `justify-content: flex-start` as the whole of it; Ben asked
 * for the remainder to be divided rather than dropped under the last stepper, and the
 * declaration below carries his words and the measurement. A shared remainder DOES make
 * every row's position depend on the row count - one number, applied identically to every
 * gap, which is the opposite of four numbers each fitted to one row. The suite pins the
 * difference directly: delete a row and every gap must move by the same amount.
 *
 * §4.1's other two rules for this region: "clamp() width" - that is --ui-rail-w on the
 * screen's grid column, not here - and "Rail: floor = sum of its fixed rows, never
 * scrolls, drops nothing". The first half of the second rule NO LONGER HOLDS and the
 * exception is Ben's, ruled on 22 Aug 2026 with the reasoning in the block beside the
 * declaration: the rail now stands Slate's nine rows in every state, a rail that deep
 * has no floor to sum to, and an unreachable row is a DROPPED row whatever the
 * stylesheet says. So the overflow declaration is scrolling rather than visible
 * spill, and each row still keeps its own height (flex: 0 0 auto).
 *
 * The gap is --ui-space-3, a whole pixel from the one spacing scale. 26.75px was not
 * a gap anybody chose; it was the number that made two unrelated things line up.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

export class LiveRail extends UiElement {
    static styles = [css`
        /* container-type: inline-size comes from the base (§4.1 asks for it by name):
         * the rail's controls read the rail, never the window. */
        :host {
            display: flex;
            flex-direction: column;
            /* THE SLACK IS SHARED BETWEEN THE ROWS, NOT LEFT AT THE BOTTOM.
             *
             * Ben, 25 August 2026: "Then space out the other steppers so in a way so that
             * it all looks correct, no big gaps for one stepper compared to the others."
             *
             * flex-start put every row at its own gap and left the remainder — measured
             * at 25px on the reference geometry — in one lump under the last stepper, which
             * is exactly the big gap he is describing and is also why the last stepper did
             * not reach the bottom inset. space-between pins the first row to the top
             * inset and the last to the bottom one, and divides the remainder equally
             * across every gap: about 2px each over the rail's twelve, which is invisible.
             *
             * THE GAP BELOW IS STILL THE RHYTHM AND IS STILL ONE NUMBER. space-between
             * cannot make a gap SMALLER than the declared one, so the 28 stays the floor
             * and the rail can only ever open up, never tighten. A rail whose content is
             * taller than the screen still scrolls, exactly as it did. */
            justify-content: space-between;
            align-items: stretch;

            /* ===============================================================
             * THE RAIL'S RHYTHM IS SLATE'S, AND IT IS STILL ONE NUMBER (it15)
             * ===============================================================
             * It was --ui-space-3 (12px), chosen when this file's whole argument was
             * about DELETING Slate's chain: "26.75px was not a gap anybody chose; it
             * was the number that made two unrelated things line up." That argument is
             * about the MECHANISM and it is untouched — one uniform gap, no correction
             * margins, no emergent alignment, and L5 stays dead. What 12px also did,
             * unintentionally, was make the rail read at a different rhythm from the
             * screen it is a copy of: measured at it14, Decal's row pitch was 76px
             * (64 + 12) against the oracle's 91.
             *   ORACLE live-ready .slate-stepper [i=24] y=234 and [i=31] y=325 — 91px
             *          of pitch around a 64px control, i.e. 27px of gap; the rail's
             *          content runs 143 to 1144, 1001px of it.
             * --ui-space-6 is 28px, the scale's own step nearest that 27, and it is the
             * SAME token this rail already spends on its inset — so the gap between two
             * rows and the space around the whole column are one number, which is a
             * thing Slate's four correction margins could never say.
             *
             * MEASURED, not hoped: 9 standing rows + 2 preset banks at 28px of gap plus
             * the four block openings is ~1012px of content against Slate's 1001, and
             * it still fits the 1920x1200 rail without scrolling (the render suite pins
             * exactly that, per geometry). Below the reference geometry the rail
             * scrolls, as it already did. */
            gap: var(--ui-space-6);

            /* THE INSET IS SLATE'S 28, PARITY SURFACE 1. It was --ui-space-4 (18), which
             * with the old 460px rail bought a 424px interior; Slate's aside#shot-settings
             * is 430 wide with a 28px inset, so its interior is 374 = 88 (name) + 18
             * (gutter) + 268 (well). The rail's three numbers are one arithmetic and this
             * is its first term — see --ui-rail-w's note in styles/tokens.css.
             * ORACLE  state=live-ready element=[17] <aside id="shot-settings"> width=430px
             *         with element=[23] <span id="dose-label"> rect.x=28 and element=[24]
             *         <div class="slate-stepper"> rect x=134 w=268 (134 + 268 + 28 = 430). */
            /* THE BLOCK INSET IS THE CHART CARD'S, AND THE INLINE INSET IS SLATE'S.
             *
             * Ben, 25 August 2026: "the top stepper in the left rail, the Grind stepper,
             * the top of it should align with the top of the chart card", and "the bottom
             * stepper, the Hot water temperature, can the bottom of that align with the
             * bottom of the <, > and All shots button".
             *
             * BOTH ARE ARITHMETIC, NOT A CORRECTION, which is the whole point of doing it
             * this way. The rail and <live-main> begin on the same grid line, so the first
             * stepper's top is rail.top + this inset and the card's top is main.top + its
             * own; make the two tokens the same and the two edges are the same. The same
             * holds at the bottom against <live-foot>. --ui-space-5 is what live-main
             * spends there now.
             *
             * THE 28 STAYS ON THE INLINE AXIS because it is load-bearing arithmetic and
             * not a rhythm: 28 + 88 + 18 + 268 + 28 = 430, the rail's whole width, from
             * the oracle below. Nothing about the top of the rail touches that sum. */
            padding: var(--ui-space-5) var(--ui-space-6);
            background-color: var(--ui-fascia);

            /* The rail spans the screen's two body rows and must not push them
             * around: its own content floor is its business, and a rail taller than
             * the screen scrolls rather than squeezing the chart or the band. */
            min-block-size: 0;

            /* ===============================================================
             * THE ONE EXCEPTION TO §4.1's "NEVER SCROLLS" — BEN'S RULING, 22 AUG 2026
             * ===============================================================
             * §4.1 gives this region three rules: "clamp() width", "floor = sum of its
             * fixed rows", "never scrolls, drops nothing". The third was written when
             * the rail recomposed by mode and its deepest form was six tracks, which
             * the 1000x600 design floor pays for. Ben has ruled the rail STANDING —
             * Slate's nine rows, all of them, in every state — and nine rows is not a
             * number any floor pays for: Slate's own rail is 1082px tall and its last
             * stepper ends at y=1144 on a 1200-row screen.
             *
             * MEASURED, uniform --ui-space-3 gap and no correction margins: the
             * standing rail is 14 tracks at rest (12 x --ui-control-h plus the two
             * preset banks) = 976px of content inside a 28px inset, so it fits the
             * 1081px rail at 1920x1200 with room over, and it does not fit the bench
             * tablet or the floor. The choice there is between rows a hand cannot
             * reach and a rail that scrolls, and "drops nothing" is the half of §4.1's
             * sentence that survives: a row below the fold with no way to reach it IS
             * dropped, whatever the stylesheet says. Scrolling keeps every row.
             *
             * The value is auto, so there is no scrollbar and no scroll container at any size
             * that fits — the 1920 reference geometry included. The rail still states
             * no height of its own and still gives each row its own
             * (flex: 0 0 auto); nothing here is a correction margin and L5 stays
             * dead. Recorded as an expected change, with its DQ, in the pass digest.
             * =============================================================== */
            overflow-y: auto;
            overscroll-behavior: contain;
            /* THIN, BECAUSE THE GUTTER COMES OUT OF THE ROW. A classic 15px scrollbar
             * takes the rail's interior below the stepper's own floor form (208 well +
             * 18 gutter + the name column), so every cap drops under --ui-stepper-cap
             * and the row starts overflowing sideways as well. Thin gives the affordance
             * back most of that width; where it still does not fit — the 1000x600 design
             * floor, where the row's floor form was already 4px wider than the rail —
             * the spill is the same one this rail has always had, and it is DQ-0-A's. */
            scrollbar-width: thin;

            /* AND THE SCROLLABLE CONTENT IS THE RAIL'S OWN BUSINESS. Without this the
             * DOCUMENT grew a scrollbar at the two smaller geometries — measured
             * documentElement.scrollHeight 1095 against a clientHeight of 801, with
             * body.scrollHeight a correct 801 — so the page itself scrolled by the
             * rail's overflow even though the rail clips it. Paint containment is the
             * standard way to say a box's overflow does not reach its ancestors, and it
             * costs nothing here: the rail positions nothing, and the base already puts
             * container-type: inline-size (layout + style + inline-size containment) on
             * it, so this adds the one keyword that was missing. */
            contain: paint;
        }

        /* NO CORRECTION MARGINS - see the header. A row is its own height and stays
         * it; nothing in the rail is stretched to make a total come out right. */
        ::slotted(*) {
            margin: 0;
            flex: 0 0 auto;
        }
    `];

    render() {
        return html`<slot></slot>`;
    }
}

customElements.define('live-rail', LiveRail);
