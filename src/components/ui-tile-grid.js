/**
 * ui-tile-grid.js - component #40 of the 57-component inventory: THE AUTO-FILL TILE GRID.
 *
 * Wave 4, item #40 (SCOPE Part 4, "Wave 4 - dialog bodies and screen compounds",
 * Settings-screen compounds, SCOPE.md:1644):
 *   "| 40 | Auto-fill tile grid | `repeat(auto-fill, minmax(280px, 1fr))` - the only
 *    genuinely fluid layout in the old app, carried as the pattern to copy
 *    (spec §5.2 #40, Appendix 14). | small | tokens |"
 *
 * Token-only, exactly as the row says: no data layer, no store, no adapter, no
 * endpoint. It reads styles/tokens.css and its own container and nothing else. It is
 * therefore Gate 2 by construction - there is no server value anywhere in this file
 * to address correctly or incorrectly.
 *
 * WHY IT EXISTS AS A COMPONENT AT ALL, in the spec's own words.
 *   spec §5.2 #40: "Auto-fill tile grid | slate-shell.css:1847-1852
 *   `repeat(auto-fill, minmax(280px, 1fr))` | THE ONLY GENUINELY FLUID LAYOUT IN THE
 *   WHOLE APP. Copy the pattern."
 *   spec Appendix 14 (the fourteen ideas the rewrite deliberately carries over):
 *   "The auto-fill tile grid (slate-shell.css:1847-1852) - the only genuinely fluid
 *   layout in the app, and the pattern to copy."
 *   spec §4.4 names the leaf it serves: "Nine leaves need their own layout, not seven:
 *   ... select-language (tile grid) ...".
 *   DECISIONS.md:51, the landscape-only decision, is where the pattern is asked for by
 *   name: "the responsive problem becomes one landscape layout that tolerates aspect
 *   ratio ~1.5-1.8 and a range of heights, not a layout system. Height is the scarce
 *   dimension. FLUID GRID COLUMNS, two or three height breakpoints, clamp() on the
 *   type scale."
 *
 * So this file is one declaration's worth of idea, owned once, so that every later
 * grid of same-sized things copies it by USING it rather than by retyping it. That is
 * the whole justification for a component whose body is four properties: spec §2.3
 * bans "the same number written in two places", and 280 is a number two Settings
 * leaves and a future skin picker would each write for themselves.
 *
 * ==========================================================================
 * THE SOURCE, READ-ONLY, AND WHY THE ORACLE COULD NOT BE ASKED DIRECTLY
 * ==========================================================================
 *
 * Part 10 §4's disqualification check was run FIRST (prov_query.py --help), and two
 * of its clauses bite here:
 *
 *   * "The question is RESPONSIVE BEHAVIOUR. Slate has no answer: 98.4% of its
 *     geometry is frozen. LAYOUT_SPEC_DRAFT.md governs." Everything about how many
 *     columns appear at what width is responsive behaviour, so the spec governs and
 *     the corpus is evidence about the frozen canvas, never a target.
 *   * "Properties outside the 18-property appearance surface (margins, flex/grid
 *     placement, z-index, transforms) were never probed." grid-template-columns is
 *     grid placement.
 *
 * And the container element is not in the corpus at all:
 *
 *   CITE prov_query.py find --cls slate-lang-grid -> "searched 49 state(s) / found 0
 *        element(s) in 0 state(s) ... The corpus has no answer for this element: read
 *        the Slate source read-only".
 *
 * Read read-only, then, `slate-shell.css:1847-1852` in full - the whole component:
 *
 *     #subpage-host .slate-lang-grid {
 *         display: grid;
 *         grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
 *         gap: var(--slate-space-3);
 *         width: 100%;
 *     }
 *
 * THE GAP AND THE TRACK WIDTH ARE STILL MEASURED, because the grid's CHILDREN are in
 * the corpus and 30 rectangles pin the container exactly:
 *
 *   CITE prov_query.py find --cls slate-lang-tile -> "found 30 element(s) in 1
 *        state(s)"; settings-units---language-select-language,
 *        rects [629,359,291,84] [932,359,291,84] [1235,359,291,84] [1538,359,291,84]
 *              [629,455,291,84] ... "distinct geometries (w x h), all matched
 *        elements: 291 x 84 x30"
 *
 *   Column pitch  932 - 629 = 303, track 291  ->  COLUMN GAP = 12px
 *   Row pitch     455 - 359 =  96, tile  84   ->  ROW GAP    = 12px
 *   Container     (1538 + 291) - 629 = 1200   ->  the leaf cap, slate-shell.css:1287
 *
 *   12px is --slate-space-3 (slate-tokens.css:115-121, carried unchanged to
 *   --ui-space-3 = 12px, styles/tokens.css:267), which is what the authored rule says
 *   it is. And the authored track function reproduces the measured 291 exactly:
 *   floor((1200 + 12) / (280 + 12)) = 4 tracks, (1200 - 3 x 12) / 4 = 291. The rule
 *   and the rendering agree, which is rarer in this codebase than it sounds - so this
 *   component's default gap and default minimum are both MEASURED values, not taste.
 *
 * ==========================================================================
 * ONE DELIBERATE DEPARTURE, AND IT IS THE REASON THE PATTERN NEEDS AN OWNER
 * ==========================================================================
 *
 * DEPARTURE 1 - THE MINIMUM IS `min(280px, 100%)`, NOT A BARE `280px`.
 *
 *     grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
 *
 * A bare 280px floor cannot go below 280px, so in any container narrower than that
 * the single track is 280px wide and the grid OVERFLOWS ITS OWN CONTAINER. In Slate
 * that overflow is then eaten: the language leaf's own wrapper is
 * `class="... w-full max-w-full OVERFLOW-X-HIDDEN"` (settings.js:5641), so a tile
 * whose right edge runs past the leaf is silently cut. That is precisely the
 * inherited behaviour spec §2.4 exists to end - "In the old app hidden is the default
 * answer everywhere except the numpad ... At no point does anything tell the user
 * content was removed" - and it is reachable now in a way it was not on a frozen
 * 1920 canvas: the design floor is ~1000 x 600 (DECISIONS.md:178) and spec §4.4
 * collapses Settings to two columns below 1100px, so the leaf pane genuinely gets
 * narrow.
 *
 * `min(280px, 100%)` keeps the 280 floor wherever there is room for it - every
 * measurement above is unchanged, 4 tracks of 291 at 1200 - and collapses to exactly
 * one full-width track when there is not. The pattern Appendix 14 asks to copy is
 * auto-fill + minmax + fr, and all three survive; what is removed is a horizontal
 * overflow that only ever had one destination, a clip nobody sees. Pinned by
 * `test/render/ui-tile-grid.render.test.mjs` at a 200px container, at BOTH Gate A
 * geometries.
 *
 * Recorded as a decision (not a bug-not-reproduced: §7.5's twenty-two Settings
 * defects do not file this one) in
 * `_skinlab/realine-run/waves/4/ledger-src/40-expected-changes.json`. The reversal is
 * one `min(` and its matching paren.
 *
 * DEPARTURE 2 - `align-content: start`. Slate's grid sits in an auto-height flex
 * column and never meets a taller container. This one will: a Settings leaf pane is a
 * scroll region with a definite height (spec §4.4, "the leaf pane is the elastic
 * one"). A grid's initial `align-content: normal` behaves as `stretch`, which
 * distributes surplus block space INTO the auto-sized row tracks - one row of tiles in
 * a 600px pane becomes one row of 600px tiles. `start` packs the rows at the top and
 * leaves the surplus where it belongs. No measurement contradicts it, because Slate
 * never rendered the case.
 *
 * ==========================================================================
 * WHAT THIS COMPONENT IS NOT
 * ==========================================================================
 *
 * NOT A SELECTION COMPONENT, and the wave law is explicit: "No component in this wave
 * may own a private 'selected' look - #36/#37/#39's chips/#52 all express selection
 * through #3 or its four --slate-selected-* dials" (DECISIONS.md:244, spec §3.9).
 * Slate's tile grid is a `role="radiogroup"` whose 30 children paint themselves from
 * --slate-selected-face / --slate-selected-ink (slate-shell.css:1871-1879), and that
 * is right: the SELECTED LOOK BELONGS TO THE TILE, never to the container it happens
 * to sit in. This file declares no colour of any kind, so the treatment is inexpressible
 * here rather than merely absent - asserted by mounting a slotted `aria-checked="true"`
 * child and proving the grid contributes nothing to it, and by drilling
 * --ui-selected-face and proving nothing in the grid moves.
 *
 * NOT A SEAM GRID. CONVENTIONS §13 settles which of the two a 12px gap is, in one
 * sentence: "Not a spacing utility either: gutters are --ui-space-*, and one gap
 * cannot be two widths." This gap is a GUTTER - it separates tiles that each paint
 * their own border - so it is --ui-space-3 and not --ui-seam over a coloured ground.
 * A consumer that wants hairline seams instead composes seams.js on its own wrapper;
 * that is a different component's job (#51 card grid is the nearest neighbour) and
 * this one refuses to be both.
 *
 * NOT #51, AND THE TWO ARE NOT A DUPLICATE. `ui-card-grid` (#51, "Card grid | skin
 * picker (2-up), update list", spec §5.2 #51) is a BOUNDED layout: `columns` is 1 or 2
 * and its track expression exists to hold two cells until they will not fit. This one
 * is UNBOUNDED - as many tracks as the container has room for, which is what
 * "auto-fill" means and what the language leaf's 30 tiles need. #51's own header
 * settles the relationship in advance and this file agrees with it: "#40 is a
 * different component with its own copy of the pattern, and this is NOT the 'same
 * number in two places' §2.3 bans" (ui-card-grid.js:96-102). The two agree on the two
 * things they must - 280px and --ui-space-3 - because both read the same measurement,
 * and they use the same private-knob shape (--_ui-card-grid-min / --_ui-tile-grid-min)
 * so a reader who has seen one recognises the other.
 *
 * NOT A SCROLL REGION, so spec §2.4's floor-and-stated-overflow pair resolves the
 * other way: the grid grows in the block axis and its ancestor pane scrolls. Overflow
 * is left `visible` and that is the STATEMENT, not an omission - it is what makes the
 * silent clip of departure 1 structurally impossible here. Asserted.
 *
 * NOT A CONTAINER-QUERY COMPONENT EITHER, and that is the point of it. Every other
 * component in the library reads its own container with an `@container` rule; this
 * one reads it through the track function itself, which is why the audit calls it the
 * only genuinely fluid layout in the app. There is no breakpoint to get wrong and no
 * viewport anywhere in this file (spec §2.1 Rule 1) - the same container yields the
 * same columns at 1281x801 and at 1000x600, asserted at both.
 *
 * ==========================================================================
 * THE TWO KNOBS, AND HOW A CONSUMER TURNS THEM
 * ==========================================================================
 *
 *   --_ui-tile-grid-min   the track minimum. Default 280px (Slate's, measured above).
 *   --_ui-tile-grid-gap   the gutter.       Default var(--ui-space-3) = 12px.
 *
 * Private (--_ui-) because CONVENTIONS §7 and Gate C's private-palette guard forbid a
 * component declaring a public --ui-* name (guards.js:150-177, written for bug L12);
 * the same shape ui-dialog uses for --_ui-dialog-inline (ui-dialog.js:364). They are
 * set FROM THE LIGHT TREE, on the host:
 *
 *     ui-tile-grid { --_ui-tile-grid-min: 320px; }
 *     <ui-tile-grid style="--_ui-tile-grid-min: 200px">
 *
 * and that works for the reason CONVENTIONS §3a gives: for two normal declarations in
 * different tree contexts the OUTER tree wins whatever the specificity (CSS Scoping
 * §3.3), so a document rule naming the host beats this file's `:host` default. The one
 * thing that does NOT work is setting it on an ANCESTOR and relying on inheritance -
 * a declaration on the element itself always beats an inherited value, and `:host` is
 * a declaration on the element. Both halves are measured in the render suite so the
 * next reader does not have to rediscover which.
 *
 * 280px IS ALLOWED TO BE A LITERAL. Spec §2.3 lists four cases and this is the fourth:
 * "Minimum floors on a flex/grid track - a min-height that stops a pane collapsing.
 * These are REQUIRED, not merely permitted." It is the floor that keeps a tile
 * readable; without it the grid would happily render eight 150px columns.
 *
 * ==========================================================================
 * ARIA
 * ==========================================================================
 *
 * A bare layout box gets no role, because an unnamed generic group is noise in the
 * accessibility tree. Give it a `label` and it becomes `role="group"` with that
 * accessible name - the same contract ui-card ships for the same reason
 * (ui-card.js:325-331), and the shape spec Appendix 15 asks for: the aria state IS the
 * state, on a reflected property.
 *
 * AN AUTHOR-SUPPLIED ROLE IS NEVER OVERWRITTEN. Slate's instance is
 * `role="radiogroup" aria-label="Display language"` (settings.js:5657) and a wave-5
 * screen that composes real radio tiles will want exactly that - so a role written on
 * the host in the light DOM wins, and only the name is managed. The capture-once
 * pattern is ui-chart-legend's (ui-chart-legend.js:536-537, :563-566) and it exists
 * because "an attribute written and never removed is state that cannot go back".
 *
 * WHAT THIS COMPONENT DELIBERATELY DOES NOT DO IS ROVING TABINDEX. Slate's radiogroup
 * has none - `settings.js:5613-5636` builds 30 plain buttons, each its own tab stop,
 * and the selected one gets no click handler at all - and fixing that is real
 * keyboard-selection machinery, which is #3's (spec §5.1 #3, "the one component with a
 * real state model") and not a "small" layout box's. This row is `small`: "Paint and
 * tokens plus at most hover/disabled/focus state. No internal model" (SCOPE.md:1432).
 * Recorded in 40-deferred-questions.json; the reversal is composing #3 or #26 inside
 * this grid at the screen, with no change to this file.
 */

import { css, html } from 'lit';
import { UiElement } from 'src/components/base.js';

export class UiTileGrid extends UiElement {
    static properties = {
        /** Accessible name. With one, the grid becomes a labelled group. */
        label: { type: String },
    };

    static styles = [css`
        /* THE HOST IS THE GRID. Not an inner wrapper: the tiles arrive from the light
         * tree, and a grid whose items are slotted needs the slot to be
         * display: contents so the assigned elements become the grid's own items
         * rather than one anonymous item wrapping all of them. With the grid on the
         * host there is exactly one box, which is what a layout primitive should cost.
         *
         * container-type stays as the base set it (inline-size). It is right here and
         * not merely tolerated: this component's entire behaviour is a function of its
         * own inline size, and containment is the guarantee that the size it reads
         * cannot be a function of the tiles it is laying out. The documented cost is
         * the same one ui-card records - an intrinsically-sized slot (a bare flex item,
         * a justify-items-start grid cell) offers nothing to fill, so the host
         * resolves to 0 and the grid collapses. The remedy is one declaration at the
         * call site; the failure is visible rather than silent, because nothing here
         * clips. */
        :host {
            display: grid;

            /* THE PATTERN, spec §5.2 #40 and Appendix 14, carried verbatim except for
             * the min() - see DEPARTURE 1 in the header. auto-fill and not auto-fit:
             * auto-fit collapses the empty tracks, so four tiles in a six-track grid
             * would spread to a quarter of the width each and the tile size would
             * depend on how many languages happen to be installed. Slate wrote
             * auto-fill and it is the right one. */
            grid-template-columns: repeat(auto-fill, minmax(min(var(--_ui-tile-grid-min), 100%), 1fr));
            gap: var(--_ui-tile-grid-gap);

            /* DEPARTURE 2 - see the header. Surplus block space stays surplus. */
            align-content: start;

            /* The grid is frequently a track in someone else's grid or flex line, and
             * min-width: auto on such an item refuses to shrink below its content. The
             * tiles must be allowed to reach their own 280px floor and then stop, which
             * is the min() above; this is what lets that happen. */
            min-inline-size: 0;

            /* The two knobs. Private by Gate C's private-palette rule; set from the
             * light tree, where the outer tree wins (header, "THE TWO KNOBS").
             *
             * ORACLE 280px: slate-shell.css:1849, and cross-checked against the 30
             * measured tiles - floor((1200 + 12) / (280 + 12)) = 4 tracks of exactly
             * the 291px those tiles rendered at.
             * ORACLE 12px: --slate-space-3, and the measured column pitch 932 - 629 -
             * 291 = 12 with the identical row pitch 455 - 359 - 84 = 12. */
            --_ui-tile-grid-min: 280px;
            --_ui-tile-grid-gap: var(--ui-space-3);
        }

        /* The slotted tiles ARE the grid items. Without this the single <slot> element
         * is the one and only item and the whole grid is one column of stacked tiles -
         * the failure looks like "auto-fill did nothing". */
        slot {
            display: contents;
        }
    `];

    /** The author's own role/name, captured once so this component can never delete
     *  what the screen wrote (ui-chart-legend.js:536-537's reason, verbatim: "an
     *  attribute written and never removed is state that cannot go back"). */
    #authorRole = null;
    #authorLabel = null;
    #captured = false;

    constructor() {
        super();
        this.label = '';
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.#captured) {
            this.#authorRole = this.getAttribute('role');
            this.#authorLabel = this.getAttribute('aria-label');
            this.#captured = true;
        }
    }

    updated(changed) {
        super.updated?.(changed);

        /* ROLE. An author's role always wins - Slate's instance is a radiogroup
         * (settings.js:5657) and a screen composing real radio tiles must keep it.
         * With no author role, a NAME is what makes a group worth announcing: an
         * unnamed generic group is noise, so no label means no role (ui-card's
         * contract, ui-card.js:325-331). */
        if (this.#authorRole === null) {
            if (this.label) this.setAttribute('role', 'group');
            else this.removeAttribute('role');
        }

        /* NAME. Clearing this component's label restores the author's, and never
         * deletes it. */
        if (this.label) this.setAttribute('aria-label', this.label);
        else if (this.#authorLabel !== null) this.setAttribute('aria-label', this.#authorLabel);
        else this.removeAttribute('aria-label');
    }

    /**
     * NOTHING TO CLEAN UP ON DISCONNECT (CONVENTIONS §12) and it is a choice, not an
     * oversight: no observer, no timer, no host listener, no vendor instance. The
     * responsive behaviour is the track function, which the engine owns.
     */

    render() {
        /* One element in this root, and it is the slot. No wrapper, no part, no
         * paint: everything visible in a tile grid is a tile, and a tile is the
         * consumer's. */
        return html`<slot></slot>`;
    }
}

customElements.define('ui-tile-grid', UiTileGrid);
