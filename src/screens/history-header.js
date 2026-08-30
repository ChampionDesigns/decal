/**
 * history-header.js — <history-header>, the History screen's header band, and the
 * whole of bug H3.
 *
 * ONE JOB: be a 4-part FLEX ROW with a STATED ORDER OF SURRENDER.
 * `LAYOUT_SPEC_DRAFT.md` §4.5's skeleton, verbatim:
 *
 *     <history-header>   back · picker A · picker B · tab bank
 *         flex row; pickers  flex:1 1 0  min-inline-size:0
 *                   tabs     flex:0 1 auto     <- pickers get room first
 *
 * and SCOPE Part 5 §6 states the consequence the numbers have to produce: "The tab
 * bank gives before the pickers collapse — the reverse of today's `flex: 0 0 720px`".
 *
 * H3, AS MEASURED. `slate-live.css:2273-2278` pins 720px of tab bank `flex: 0 0`,
 * three lines below a comment promising the opposite, so the shot pickers (measured at
 * exactly 1014px) collapse before the tabs give up a pixel. There is no 720 in this
 * file and no px pin of any kind: the bank's width is its own contents' and its only
 * declaration is that it may shrink.
 *
 * ------------------------------------------------------------------------------
 * THE ONE DEPARTURE FROM §4.5's LETTER, AND IT IS WHAT MAKES §4.5's SENTENCE TRUE
 * ------------------------------------------------------------------------------
 * §4.5 writes `min-inline-size: 0` on the pickers. Taken literally that is H3 with the
 * labels swapped, and the flex algorithm says why: with `flex: 1 1 0` a picker's flex
 * BASE SIZE is zero, so its scaled shrink factor (shrink × base) is zero and it can
 * never take a share of a squeeze — all it can do is fail to grow. `min-inline-size: 0`
 * removes the automatic minimum that would otherwise stop it, so as the band narrows
 * the pickers give up everything they were given while the bank sits at its content
 * width untouched. MEASURED IN THIS TREE by deleting the line and sweeping four widths
 * (RE-MEASURED at three tabs, fix run 6 — 1150 / 1130 / 1100 / 1050):
 *
 *     pickers   355.81 → 345.81 → 330.81 → 305.81    the pickers are what gives
 *     tab bank  257.56 → 257.56 → 257.56 → 257.56    and the bank never moves at all
 *
 * which is H3's own sentence — the pickers collapse before the tabs give up a pixel —
 * reproduced from §4.5's literal text.
 *
 * `min-inline-size: min-content` is the same rule with the floor put back. The picker's
 * own contents are its floor — the disc, the gap, and the select at the one width it
 * can always honour (`ui-select.js`: "the default is the control's own max-content, the
 * one width it can always honour without lying") — so:
 *
 *   wide      free space goes to the pickers first, exactly as §4.5 asks;
 *   narrower  the pickers give up their SLACK, never their measure;
 *   narrower  the pickers hit their own content and freeze, and every further pixel
 *             comes out of the TAB BANK, monotonically, until it has none left;
 *   narrower  the band overflows rather than shoving — the header family's documented
 *             last resort (`ui-page-header.js`, Appendix 7: "the flanks overflow,
 *             never shove"), and never a control shrinking below its own measure.
 *
 * MEASURED at the same four widths, same label (`13 Aug 14:32 · Extractamundo`), both
 * Gate A geometries, identical readings at each:
 *
 *     pickers   373 → 373 → 373 → 373        frozen on their own measure
 *     tab bank  223.2 → 203.2 → 173.2 → 168  the bank pays, down to ITS floor
 *
 * (At two tabs the same sweep ran 1050 / 1000 / 950 / 900 and read 123.2 → 108 → 108 →
 * 108. The shape is identical; the window moved sixty pixels right when the power page
 * added a third tab, because the bank's content went 147.73 → 257.56 and its floor went
 * 108 → 168. See the `.tabs` rule.)
 *
 * Put the two tables side by side and the line is proven LOAD-BEARING rather than
 * merely present: the same four widths, one declaration apart, and the item that gives
 * swaps over. The suite sweeps both.
 *
 * The bank stopping at 168 rather than running to 2 is the hit-floor minimum argued at
 * the `.tabs` rule below — it gives first and gives most, and then it stops, because a
 * flank that gives until its controls cannot be hit has not surrendered gracefully, it
 * has broken. Below that width the BAND overflows, which is stage four.
 *
 * WHAT DECIDES WHERE THE BANK RUNS OUT is the option text's own width, and that is
 * M10 — "the shot-picker option-text width" — an OPEN measurement for the bench pass.
 * Nothing here freezes it: the picker's floor is the label's measure, whatever the
 * label turns out to be, and a consumer that states short labels gets more give from
 * the bank than one that states long ones. The suite records the number for the
 * morning; it does not pin it.
 *
 * AND M10 IS NOT COSMETIC — IT DECIDES WHETHER THE BAND FITS AT THE DESIGN FLOOR.
 * That is this wave's finding and it is written here because the header is where it
 * lands. Measured at 1000x600, with everything on its measure:
 *
 *     option label                          band overflow   (2 tabs -> 3 tabs)
 *     "13 Aug 14:32 · Extractamundo"        27  ->  77
 *     "13 Aug 14:32 · Extractamundo Dos! (2)"  159  -> 201
 *
 * Both overflow, because back + two pickers at their labels' measure + a tab bank with
 * hittable tabs is more than 1000 for either label.
 *
 * AND THE THIRD TAB MADE IT BITE, which is fix run 6's finding and is written here
 * because the header is still where it lands. The overflow is no longer only a number:
 * at the design floor the last 77px of the band is the DATA TAB, so the control is
 * present, is above --ui-hit-min in size (L22's test still passes), and is off the right
 * edge of the viewport. The rendering suite's `showPage` scrolls it into view before
 * pressing it and says so at the call site. Nothing here is tightened to hide it: M10's
 * budget is the fix and it is Ben's measurement to take. The screen's own docblock already
 * says the labels are the consumer's AND A SHORT FORM; what this measurement adds is
 * that "short" has a budget, that the budget is roughly the difference between those
 * two numbers, and that nobody has taken it yet. Until they have, the band overflows
 * at the design floor rather than putting a control under the hit floor — the choice
 * between the two is not close, and it is recorded as a deferred question rather than
 * settled by a guessed ch measure on the select.
 *
 * ------------------------------------------------------------------------------
 * WHY THIS IS A SCREEN BOX AND NOT #31
 * ------------------------------------------------------------------------------
 * `<ui-page-header>` (#31) is a three-track GRID — `minmax(0,1fr) auto minmax(0,1fr)`,
 * §4.3's editor band — and its regions are content clusters that "overflow, never
 * shove". §4.5 does not ask for that band: it asks for one flex row whose four items
 * have a stated order of surrender, which is a different mechanism, not a different
 * skin. `<live-header>` is the precedent and it is exact: §4.1 names a 3-part flex row
 * with its own priorities, so wave 5.1 wrote `<live-header>` rather than bending #31.
 * A screen's own box is not a library component (Part 10 §9's scope-invention rule is
 * about COMPONENTS — the select, the disc, the bank, the compare bar — and every one of
 * those is composed here, not rebuilt).
 *
 * NOTHING IS POSITIONED and there is no width query: the band reads its own box only by
 * being a flex container in it (§2.1 Rule 1).
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

export class HistoryHeader extends UiElement {
    static styles = [css`
        /* NO BACKTICK IN THIS TEMPLATE, in a comment or out of one: one ends the
         * tagged template where it stands (CONVENTIONS §9).
         *
         * display: flex WINS over the base's display: block because it is the same
         * specificity written later (CONVENTIONS §1: the base is prepended).
         *
         * --ui-bar, NOT --ui-fascia, AND IT IS A RESTORE (parity surface 6). This band
         * is a TOP BAR, which is what the token is for in the token sheet's own words
         * (styles/tokens.css: "--ui-bar: top bars", derived from the editor header),
         * and it was the only band in the tree painted the page body's colour:
         *   ORACLE history-viewer .slate-hv-header [i=1... the overlay's header]
         *     background-color = rgb(17, 22, 26), the same value Slate paints its LIVE
         *     header (live-ready header [i=1] rgb(17, 22, 26)) -- one bar colour on
         *     both screens
         *   live-header.js:55 and ui-page-header.js:397 both already read --ui-bar, and
         *     Decal's Live band renders rgb(17, 22, 26) exactly
         * while this band rendered rgb(14, 19, 23). One screen's band was a different
         * colour from every other screen's AND from the oracle's; now all four agree. */
        :host {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: var(--ui-space-4);
            padding-inline: var(--ui-band-inset);
            background-color: var(--ui-bar);
            min-inline-size: 0;
        }

        /* THE WAY OUT. Content-sized and never gives: a back affordance that shrank
         * would be the first thing to become unhittable, and it is the control the
         * whole route conversion exists to make possible (H9). */
        .back {
            flex: 0 0 auto;
        }

        /* THE TWO PICKERS. flex: 1 1 0 is §4.5's "pickers get room FIRST"; the floor
         * is the header's departure and is argued in full above. Each picker is a row
         * of its own so the disc and the select are spaced by one rule rather than by
         * a margin somewhere else. */
        .picker {
            flex: 1 1 0;
            min-inline-size: min-content;
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: var(--ui-space-3);
        }

        /* THE TAB BANK. flex: 0 1 auto — it never grows (a bank wider than its tabs is
         * empty chrome) and it may shrink, which is the whole of H3's fix.
         *
         * AND IT HAS THE SAME FLOOR THE PICKERS HAVE, which is a CORRECTION made after
         * measuring the frame rather than the intention. Written without one — "where
         * it stops is #32's own min-content rather than a number this file invented" —
         * the bank does not stop at #32's min-content at all: #32 is
         * inline-size: fit-content, a fit-content box shrinks to its MIN-content under
         * pressure, and #32's own tabs shrink with it. Measured at the 1000x600 design
         * floor, both label sets: the bank at 2 wide with a realistic long option label
         * and 73.2 with a short one, and IN BOTH CASES its two tab buttons rendered
         * 36 x 80 — under --ui-hit-min. That is L22 (a 32 x 35 target on a wall panel
         * operated with a wet hand) reproduced on the screen built to kill H3, and it
         * is what "the tab bank gives" turns into when nothing says where giving stops.
         *
         * THE FLOOR IS COMPOSED FROM THE HIT TOKEN, one target per page plus the bank's
         * own chrome, so it moves when the hit floor moves and is not a number this
         * file invented:
         *
         *     calc(3 * var(--ui-hit-min) + 2 * var(--ui-space-3))
         *            ^ HISTORY_PAGES.length -- THREE pages since fix run 6, when Ben
         *              reversed D1 for the power page. The term was written as two with
         *              the note "a third page adds a term here in the same change that
         *              adds the tab", and this is that change: one hit target per page
         *              plus the gaps between them, so the floor still moves when the hit
         *              token moves and is still not a number this file invented.
         *
         * A min-inline-size of min-content WAS TRIED FIRST AND DOES NOTHING, measured:
         * this box wraps a slot and #32 sizes itself inline-size: fit-content, so the
         * wrapper's min-content is the bar's min-content, the bar shrinks its tabs with
         * it, and the reading stays 2 wide with 36 x 80 tabs. The floor has to be
         * stated as a length because the box being floored is in another shadow root.
         *
         * MEASURED AT THE FLOOR GEOMETRY WITH THE FLOOR IN PLACE: the bank sits at 108
         * and its tabs at 48 and up, with a long option label AND a short one -- the
         * hit-floor sweep in the suite comes back empty in both. THE ORDER OF SURRENDER
         * IS UNCHANGED: the bank still gives first and gives most (147.7 -> 108), it
         * just stops before it disappears.
         *
         * WHAT IS LEFT WHEN ALL THREE ARE ON THEIR MEASURES is the band overflowing --
         * stage four below. That is the header family's documented last resort and it
         * is the honest outcome, because the alternative is a control nobody can hit;
         * but it is NOT free, and the size of it is the open M10 measurement rather
         * than anything this file settles. See the note on the option text below. */
        .tabs {
            flex: 0 1 auto;
            min-inline-size: calc(3 * var(--ui-hit-min) + 2 * var(--ui-space-3));
        }

        /* Written as a rule rather than as a comment so that a later edit reaching for
         * position: absolute has to delete a line that says why it must not — bug L1's
         * mechanism, and §4.1's "no absolutely-positioned structure" read one screen
         * across. */
        :host,
        .back,
        .picker,
        .tabs {
            position: static;
        }
    `];

    render() {
        return html`
            <div class="back" id="back" part="back"><slot name="back"></slot></div>
            <div class="picker" id="picker-a" part="picker-a"><slot name="picker-a"></slot></div>
            <div class="picker" id="picker-b" part="picker-b"><slot name="picker-b"></slot></div>
            <div class="tabs" id="tabs" part="tabs"><slot name="tabs"></slot></div>
        `;
    }
}

customElements.define('history-header', HistoryHeader);
