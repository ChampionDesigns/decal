/**
 * settings-master-detail.js — <settings-master-detail>, the Settings screen's body.
 *
 * `LAYOUT_SPEC_DRAFT.md` §4.4 and SCOPE Part 5 §4, verbatim:
 *
 *     └─ <master-detail>   display:grid; gap: var(--ui-seam)
 *          grid-template-columns: minmax(200px,16%) minmax(220px,22%) minmax(0,1fr)
 *          @container (inline-size < 1100px) -> two columns (nav collapses to one,
 *                                               breadcrumbed)
 *
 *          ├─ <nav-column>      search field (auto) + list (1fr, VISIBLE scrollbar)
 *          ├─ <subnav-column>   list (1fr, VISIBLE scrollbar)
 *          └─ <leaf-pane>       overflow-y:auto; padding: var(--ui-space-6)
 *
 * Four slots — crumb, nav, subnav, leaf — and one grid. Same construction as
 * `selector-split.js` one screen over, and deliberately so: three column-split screens
 * (Settings master/detail, the selector, Live rail/main) each collapse on their own
 * container at their own threshold (spec §2.1 Rule 2), and the selector proved the
 * pattern this file reuses.
 *
 * ===========================================================================
 * C5, AND WHY THERE IS NO SEPARATOR ELEMENT IN THIS FILE  (T19, T4)
 * ===========================================================================
 *
 * DECISIONS register C5, ACCEPTED (SCOPE.md:2243): "the divider: one 1px grid gap,
 * var(--ui-seam), replacing today's 2px band of two different greys (T19)". Built to the
 * decided answer, not waited on — C5 carries a RESIDUAL, which is Ben confirming the
 * LOOK on the C1 prototype (Q3, SCOPE.md:5142). Q3 was not collected before this run, so
 * per Part 9's standard handling the shell ships the single gap, the item is recorded as
 * a DQ, and the confirmation moves to the morning review with rework accepted.
 *
 * §7.5 T19: "The nav/pane seam is two hairlines of two different greys, which is why the
 * nav container measures 599 rather than 600." (`settings.html:16` + `slate-shell.css:385`,
 * `:389-393`.) Measured in the corpus at 1920x1200: `#left-panel` [0,118,600,1082] and
 * `#right-panel` [601,118,1319,1082] — a border-right coloured by one rule plus a
 * separate `#separator` element in another grey.
 *
 * DEAD HERE BECAUSE THERE IS NOTHING TO COLOUR TWICE. The gap is the divider: display,
 * gap and ground all come from the seam utility (`src/components/seams.js`,
 * CONVENTIONS §13) via the two classes on #grid, so this file writes no border, no
 * background and no width for a divider. N cells give N-1 seams, one ink, from the
 * container.
 *
 * T4 GOES WITH IT, and by the same mechanism `selector-split.js` records for P10. §7.5
 * T4: "The sub-nav drag handle is dead — an inline width cannot beat width: 260px
 * !important — while the separator thickens and the cursor changes, so it looks live."
 * Every clause of T4 needs a separator ELEMENT to be false of, and there is no separator
 * element: no div with `cursor: col-resize`, no `aria-hidden` node, nothing. A dead
 * affordance is not fixed, it is absent. Whether a draggable split exists at all is a
 * SELECTOR-screen question (Q8), not a settings one — the selector answered it "no" and
 * this screen does not re-open it.
 *
 * ===========================================================================
 * THE TRAP: AN ELEMENT IS NOT ITS OWN CONTAINER
 * ===========================================================================
 *
 * The obvious build is `:host { grid-template-columns: ... }` with the query rewriting
 * it. It is wrong silently: a container query resolves against the nearest ANCESTOR
 * query container of the element being styled, and an element is never its own
 * container, so a rule whose subject is `:host` asks <settings-screen> instead — the
 * collapse would be approximately right and occasionally wrong.
 *
 * So the grid is an inner element, #grid, and the host is the container the base already
 * made it (`container-type: inline-size`, `src/components/base.js`). Every subject
 * inside the query below is #grid, a slot inside it, or a `::slotted()` element whose
 * parent is the host — all three resolve against THIS component's own box. Spec §2.1
 * Rule 1 in the strict sense, and never the viewport: there is no `@media (width...)`
 * anywhere in this file and the suite reads that off the parsed CSSOM, not off source.
 *
 * ===========================================================================
 * 1100 IS A LITERAL, AND IT HAS TO BE
 * ===========================================================================
 *
 * A container query's condition is not a declaration: `var()` is not substituted inside
 * `@container (...)`, so `@container (inline-size < var(--ui-...))` never matches and
 * fails silently. The number is therefore written ONCE, here, in the file that owns the
 * query, and exported so a suite can sweep across it without spelling it again — §2.3's
 * rule is "the same number written in two places", and this one is written in one.
 * `styles/tokens.css` carries the same note for the selector's 900.
 *
 * ONE BRANCH FIRES ON THE BENCH AND THE OTHER FIRES AT THE FLOOR, which is different
 * from the selector and worth knowing before reading the suite. The body spans the
 * screen, so its inline size is 1281 at BENCH (wide, three columns) and 1000 at FLOOR
 * (narrow, two columns). Gate A therefore exercises both branches without a sweep; the
 * suite sweeps anyway, because a threshold that is only ever observed from one side is a
 * threshold nobody has checked.
 *
 * ===========================================================================
 * WHAT "NAV COLLAPSES TO ONE, BREADCRUMBED" IS, MECHANICALLY
 * ===========================================================================
 *
 * Narrow: two columns. Column 1 holds ONE of the two nav columns at a time and a crumb
 * row above it; column 2 is the leaf pane, spanning both rows. Which nav column shows is
 * `navLevel`, rendered onto #grid as a data attribute — so the STATE is read by rules
 * INSIDE the query, whose subjects are all inside this shadow root, and the wide branch
 * never mentions it. That is what makes the state inert above 1100px: at three columns
 * both nav columns are always visible and `navLevel` selects nothing.
 *
 * THE CRUMB IS A SLOT, NOT CONTENT. This component owns the BOX and its visibility; the
 * screen owns the label (the current category's name, through the same `navName`
 * everything else uses) and the handler. Same division as every other pane here, and it
 * keeps this file free of a string.
 *
 * NO JS READS THE BRANCH. There is no ResizeObserver, no matchMedia and no
 * `container-query fired` flag: the crumb is always rendered and the query decides
 * whether it has a box. A screen that had to be told which branch it was in would be a
 * second owner of the threshold.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';

/**
 * The collapse threshold in CSS pixels — §4.4's `@container (inline-size < 1100px)`.
 * Exported so the suite sweeps the number the CSS was written beside.
 */
export const MASTER_DETAIL_COLLAPSE_PX = 1100;

/* THE TRACK LIST IS NOT EXPORTED, deliberately. The threshold above has to be a
 * constant because CSS cannot read one; the tracks do not, and a JS copy of
 * "minmax(200px, 16%)" would be §2.3's "same number written in two places" with no
 * language limit to excuse it. The suite reads the USED track sizes off
 * getComputedStyle and checks them against the panes' own boxes, which is a stronger
 * claim than the authored string anyway. */

/** Which nav column column 1 holds while collapsed. Inert in the wide branch. */
export const NAV_LEVEL = Object.freeze({ CATEGORIES: 'categories', LEAVES: 'leaves' });

export class SettingsMasterDetail extends UiElement {
    static properties = {
        /**
         * `categories` | `leaves`. Only the collapsed branch reads it, and only to
         * choose which of the two nav columns occupies column 1. Reflected onto #grid
         * in render() rather than onto the host, because a rule whose subject is the
         * host would ask the wrong container (see THE TRAP).
         */
        navLevel: { type: String, attribute: 'nav-level' },
    };

    static styles = [seams, css`
        /* NO BACKTICK ANYWHERE IN THIS TEMPLATE, comment or not: one ends the tagged
         * template where it stands and the file then fails to parse as JavaScript
         * several hundred characters later, at whatever the CSS happens to look like.
         *
         * THE HOST IS THE CONTAINER, NOT THE GRID. container-type: inline-size comes
         * from the base; what is added here is a box that fills its grid area in both
         * axes with both minimums at 0, so the screen's row-2 track decides the room. */
        :host {
            display: block;

            /* THE WIDTH OF EACH NAV COLUMN. Private, defaulted, and MEASURED rather than
             * chosen: 303px is the widest leaf name ("Sleep & Wake Schedules", 255 at the
             * rendered type) plus the row's own 24px of padding on each side. A pixel less
             * and that name ellipsises; the same number on both columns is Ben's ask, and
             * two of them is 606 against the 730 the old percentage pair took. */
            --_ui-settings-nav-col: 262px;
            block-size: 100%;
            min-block-size: 0;
            min-inline-size: 0;
        }

        /* THE GRID. display / gap / ground are the seam utility's, via the classes on
         * this element in render(); this rule adds the tracks to them. C5 is that gap
         * and nothing else: one 1px var(--ui-seam) over var(--ui-line-strong).
         *
         * THE TWO NAV COLUMNS ARE ONE WIDTH NOW, AND THE WIDTH IS MEASURED.
         *
         * Ben, 26 August 2026: "Can we make the two menu columns the same width and
         * reduce the overall width the two take up … Make it around 580? Or does one leaf
         * column have a wide text?"
         *
         * ONE DOES, AND IT DECIDED THE NUMBER. Measured at both Gate A geometries, with a
         * Range over each name at the rendered type:
         *
         *     widest category   "Units & Language"        181 + 48 padding = 229
         *     widest leaf       "Default load settings"   214 + 48 padding = 262
         *
         * IT WAS 303, AND ONE NAME SET IT. "Sleep & Wake Schedules" measured 255 — 41px
         * wider than anything else in the tree — so a single leaf was deciding how much of
         * the screen the navigation took. Ben asked what it could be called instead; it is
         * "Sleep & Wake" now, and the column is the next name's width.
         *
         * 262 is the smallest EQUAL column where nothing clips, and two of them is 524 —
         * under the 580 he asked for, and 206px back from the 730 the unequal pair took
         * (307 + 422).
         *
         * THEY WERE §4.4's minmax(200px,16%) and minmax(220px,22%), which made them
         * percentages of the screen (NO BACKTICK IN THIS COMMENT: one ends the template): 307 and 422 at 1920, 205 and 282 at the bench, so the
         * pair was a different shape on every panel and the leaf name clipped on the small
         * one. A fixed pair is the same shape everywhere, and what flexes is the leaf pane
         * — which is the track that should, because it holds the content.
         *
         * The leaf pane's 0 floor is unchanged and deliberate: an auto floor would be its
         * content's min-content contribution, and a leaf is whatever is slotted into it. */
        #grid {
            block-size: 100%;
            min-block-size: 0;
            grid-template-columns: var(--_ui-settings-nav-col) var(--_ui-settings-nav-col) minmax(0, 1fr);
            /* TWO ROWS: the search field, then the lists. The field is ONE NAV ROW tall,
             * from the same token the rows take their pitch from, so the two lists start
             * at the same y by construction rather than by a spacer. */
            grid-template-rows: var(--ui-nav-row) minmax(0, 1fr);
            align-items: stretch;
        }

        /* THE SLOTS ARE NOT THE GRID ITEMS - THE SLOTTED PANES ARE. display: contents
         * on a slot hands the track straight to the pane, so a floor declared on a pane
         * still binds (a wrapper box would take the track and then have to hand its
         * height on, which is how a floor stops binding). */
        slot {
            display: contents;
        }

        /* PLACEMENT IS EXPLICIT IN BOTH BRANCHES. Auto-placement gives the right answer
         * in the wide branch and the WRONG one in the narrow branch (the crumb takes
         * cell 1 and everything after it shifts), so both are written out rather than
         * one being written and the other trusted. */
        /* THE SEARCH FIELD SPANS BOTH NAV COLUMNS, WHICH IS SLATE'S OWN STRUCTURE.
         *
         * Ben, 26 August 2026: "The search field, Box width should spread over both
         * columns." Slate does the same and this file's own header already said so —
         * #settings-search is a child of #left-panel, ABOVE
         * #settings-navigation-container, so it sits over both lists.
         * (NO BACKTICK IN THIS COMMENT: one ends the tagged template where it stands.)
         *
         * IT USED TO LIVE INSIDE THE NAV COLUMN, because §4.4 put it there, and that cost
         * two things. The field was the width of ONE column, half what Slate gives it. And
         * the sub-nav column had to carry a BLANK head track of the same height purely so
         * the two lists would start at the same y — a spacer whose only job was to
         * compensate for the field being in the wrong box. Both are gone: the field is a
         * grid item here, the two columns are one track each, and the lists line up
         * because the row above them is one row. */
        /* THE HEAD IS A BOX, NOT A BARE SLOT, and it is a box for one reason: the GROUND.
         * The two columns under it paint --ui-fascia, and Slate's field sits inside that
         * same panel. A slot with display: contents would hand the track to the field
         * itself, so the strip either side of the field would show the grid's ground and
         * the navigation would read as two surfaces with a seam through it. */
        #search-head {
            grid-column: 1 / span 2;
            grid-row: 1;
            display: grid;
            align-items: center;
            background-color: var(--ui-fascia);
            min-inline-size: 0;
        }

        /* The field's breathing room belongs to the field, not to the box around it. */
        slot[name="search"]::slotted(*) {
            min-inline-size: 0;
            margin: var(--ui-space-3);
        }

        slot[name="nav"]::slotted(*) {
            grid-column: 1;
            grid-row: 2;
            min-inline-size: 0;
        }

        slot[name="subnav"]::slotted(*) {
            grid-column: 2;
            grid-row: 2;
            min-inline-size: 0;
        }

        /* THE LEAF PANE TAKES BOTH ROWS. The search belongs to the navigation, not to the
         * page beside it, so the pane starts where the columns' heads do. */
        slot[name="leaf"]::slotted(*) {
            grid-column: 3;
            grid-row: 1 / span 2;
            min-inline-size: 0;
        }

        /* THE CRUMB HAS NO BOX IN THE WIDE BRANCH. Three columns are all visible, so
         * there is nowhere to have come from and nothing to say. */
        #crumb {
            display: none;
        }

        /* =======================================================================
         * THE COLLAPSE. §4.4: two columns, nav collapses to one, breadcrumbed.
         *
         * < 1100px, exclusive as the spec writes it, so 1100 belongs to the wide
         * branch; the suite pins the flip at 1099/1100 rather than assuming.
         * ======================================================================= */
        @container (inline-size < 1100px) {
            #grid {
                grid-template-columns: minmax(220px, 30%) minmax(0, 1fr);
                /* THREE ROWS: the search field, the crumb, then the list. */
                grid-template-rows: var(--ui-nav-row) auto minmax(0, 1fr);
            }

            /* AND THE RECORDED HOLE CLOSES WITH IT. The note under the crumb rule below
             * said search was unreachable at the shipping floor: the field lived inside
             * the nav column, this branch hides that column by default, and the Gate A
             * floor (1000x600) is under the collapse — so a person there had to press
             * "All categories" before they could type. The field is a grid item on this
             * element now, so it is on screen at BOTH levels and neither placement nor
             * focus has to move with the level. */
            #search-head {
                grid-column: 1;
                grid-row: 1;
            }

            /* THE CRUMB ROW IS ONE NAV ROW TALL, from the same token the rows use, so
             * the column reads as the same navigation surface with a heading rather
             * than as two stacked lists at two rhythms. */
            #crumb {
                display: flex;
                align-items: center;
                grid-column: 1;
                grid-row: 2;
                min-block-size: var(--ui-nav-row);
                min-inline-size: 0;
                padding-inline: var(--ui-space-4);
            }

            /* DEFAULT: the leaves. The category list is the level you came from.
             *
             * THE HOLE THIS USED TO CARRY IS CLOSED (26 August 2026). It read: "§4.4 slots
             * the SEARCH FIELD inside the nav column, so this rule hides the field and the
             * results with the column, and the Gate A floor is below the collapse — at the
             * shipping floor search is reachable only by pressing All categories first."
             * The field is no longer in that column, so hiding the column no longer hides
             * the field, and the deferred question about focus and level-switching does not
             * arise: nothing about the field moves with the level. */
            slot[name="nav"] {
                display: none;
            }

            slot[name="subnav"]::slotted(*) {
                grid-column: 1;
                grid-row: 3;
            }

            slot[name="leaf"]::slotted(*) {
                grid-column: 2;
                grid-row: 1 / span 3;
            }

            /* STEPPED BACK UP. The attribute is on #grid, inside this root, so the
             * subject of every one of these rules resolves against the host's box —
             * the same container the query above asked. */
            #grid[data-nav-level="categories"] slot[name="nav"] {
                display: contents;
            }

            #grid[data-nav-level="categories"] slot[name="nav"]::slotted(*) {
                grid-column: 1;
                grid-row: 3;
            }

            #grid[data-nav-level="categories"] slot[name="subnav"] {
                display: none;
            }
        }
    `];

    constructor() {
        super();
        this.navLevel = NAV_LEVEL.LEAVES;
    }

    render() {
        /* .seam-cell on the crumb is trap 1 in seams.js: a cell that paints nothing is
         * a hole, and the ground shows through everything not painted over it. */
        return html`
            <div
                id="grid"
                part="grid"
                class="seam-grid seam-strong"
                data-nav-level=${this.navLevel}
            >
                <div id="search-head" part="search-head" class="seam-cell">
                    <slot name="search"></slot>
                </div>
                <div id="crumb" part="crumb" class="seam-cell"><slot name="crumb"></slot></div>
                <slot name="nav"></slot>
                <slot name="subnav"></slot>
                <slot name="leaf"></slot>
            </div>
        `;
    }
}

customElements.define('settings-master-detail', SettingsMasterDetail);
