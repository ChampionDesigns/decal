/**
 * ui-card-grid.js — component #51 of the 57-component inventory: THE CARD GRID.
 *
 * Wave 4, item #51, settings-screen compounds (SCOPE.md:1643):
 *   "| 51 | Card grid | 2-up card layout (skin picker, update list). | small | #8 |"
 * and LAYOUT_SPEC_DRAFT.md:922 "| 51 | Card grid | skin picker (2-up), update list |".
 *
 * IT IS A LAYOUT AND NOTHING ELSE. No data, no store, no route: the screen slots the
 * cards in and this decides where they sit. That is not a shortcut around Gate 2, it
 * is the reason Gate 2 never comes up here — a component that reads no server data
 * cannot read it around the address layer. The skin list and the update list arrive
 * at the SCREEN (Part 5 / wf-w5, "integrates and proves, it does not construct"), and
 * a screen reads src/stores/. This file contains no key string, no fetch, no adapter.
 *
 * WHY IT IS A COMPONENT RATHER THAN THREE LINES AT EACH CALL SITE — measured.
 * Slate builds the same 2-up card grid twice in one screen and the two disagree:
 *
 *   CITE settings-display-skin .slate-card [i=49] <button class="slate-card
 *        slate-skin-card"> rect x=629 y=479 w=593 h=96
 *   CITE settings-display-skin .slate-card [i=54] <button class="slate-card
 *        slate-skin-card"> rect x=1236 y=479 w=593 h=96
 *   CITE settings-display-skin .slate-card [i=59] rect x=629 y=589 w=593 h=96
 *        -> column gap 1236 - (629 + 593) = 14px; row gap 589 - (479 + 96) = 14px;
 *           593 + 14 + 593 = the 1200 leaf column exactly.
 *
 *   CITE settings-accessories-usb-charger .slate-card [i=44] <button class="slate-card
 *        flex flex-col items-start justify-center gap-[4px] px-[24px] py-[14px]
 *        cursor-pointer text-left "> rect x=629 y=383 w=594 h=84
 *   CITE settings-accessories-usb-charger .slate-card [i=47] rect x=1235 y=383 w=594 h=84
 *   CITE settings-accessories-usb-charger .slate-card [i=50] rect x=629 y=479 w=594 h=84
 *        -> column gap 1235 - (629 + 594) = 12px; row gap 479 - (383 + 84) = 12px;
 *           594 + 12 + 594 = 1200 again.
 *
 * Two 2-up card grids, one screen, one content column, two gap values. That is bug
 * T20's exact shape — "Fourteen distinct gap-[Npx] literals pass through the shell's
 * rhythm rules untouched" (LAYOUT_SPEC_DRAFT.md §7.5 T20, layout/settings.md C7) — and
 * T14's — "Seven contradictory declaration pairs left in place" (§7.5 T14). Neither is
 * on this row's bug list, because neither is a bug ABOUT the card grid: they are the
 * class of defect that exists because there IS no card grid. One component ends both
 * for this shape, and the end is structural rather than disciplinary: there is no
 * per-instance gap on the API, so two uses cannot disagree.
 *
 *   THE ONE GAP IS --ui-space-3 = 12px, and it is not a preference. The spec's own
 *   snapping table settles the 14: "off-scale values snap to the nearest step ...
 *   `14 -> 12`" (LAYOUT_SPEC_DRAFT.md §3.3). Snapping the skin grid's 14 to 12 lands
 *   it on the value the USB-charger grid already measures, and it reproduces that
 *   grid's cell width to the pixel: at a 1200 container, (1200 - 12) / 2 = 594, the
 *   measured w=594 above. What visibly changes is the skin picker's cards, 593 -> 594,
 *   and its gaps, 14 -> 12.
 *
 * THE GEOMETRY CARVE-OUT, stated rather than hidden. prov_query.py's banner: grid
 * placement was "never probed", so there is no oracle answer for the container's own
 * `gap` — every gap above is ARITHMETIC ON QUOTED RECTS, not a quoted property. The
 * rects themselves are citable and quoted verbatim. The banner's other half applies to
 * everything in this file that is a width: "geometry above is Slate (captured at
 * 1920x1200) and is FROZEN — quote it as what Slate does, never as Decal's
 * responsive target (LAYOUT_SPEC_DRAFT.md governs responsive behaviour; the oracle has
 * no vote)".
 *
 * SO WHAT GOVERNS THE RESPONSIVE HALF, and it is the spec, in three lines.
 *   spec §2.1 Rule 1  — a component reads its own container, never the viewport. There
 *                       is no @media in this file and no viewport unit.
 *   spec §2.2         — "Columns, panes, rails: fr + minmax() + clamp(). Never px."
 *   spec §2.3 case 4  — "Minimum floors on a flex/grid track ... These are required,
 *                       not merely permitted."
 *   Appendix 14       — "The auto-fill tile grid (slate-shell.css:1847-1852) — the only
 *                       genuinely fluid layout in the app, and the pattern to copy."
 *
 * THE TRACK EXPRESSION, and why it is one declaration rather than a breakpoint:
 *
 *     repeat(auto-fill, minmax(max(min(100%, MIN), (100% - GAP) / 2), 1fr))
 *
 *   Read it inside out. `(100% - GAP) / 2` is half the container, so while the
 *   container is wide the track minimum IS half of it and exactly two tracks fit — the
 *   2-up the row asks for, and never a third. Once half the container falls below MIN
 *   the floor takes over, and auto-fill fits as many MIN-wide tracks as there is room
 *   for: one. The crossover is therefore 2 x MIN + GAP with no number written twice
 *   and no threshold to keep in step with the floor. `min(100%, MIN)` is the last
 *   clause: below MIN the floor stops applying, so a container narrower than one cell
 *   gets a narrow cell instead of a horizontal scrollbar.
 *
 *   Measured in the rig at both geometries (test/render/ui-card-grid.render.test.mjs):
 *   1200 -> 594|594 · 900 -> 444|444 · 600 -> 294|294 · 572 -> 280|280 · 571 -> 571 ·
 *   260 -> 260, with scrollWidth == clientWidth at every one of them.
 *
 *   AUTO-FILL, NOT AUTO-FIT, and that is the load-bearing letter. auto-fit collapses a
 *   track no item lands in, so a grid holding one card would be 1-up and the same grid
 *   holding two would be 2-up: a layout that changes meaning when somebody adds a
 *   sibling. The spec bans that shape by name for selectors and the reason is identical
 *   — "A positional selector is a rule that changes meaning when somebody adds a
 *   sibling" (spec §2.3, quoting slate-live.css:1354-1358). With auto-fill the column
 *   count is the container's answer and only the container's: one card at a 900px
 *   container still measures 444|444 (pinned).
 *
 * THE FLOOR IS 280px, and it is Appendix 14's own number: slate-shell.css:1847-1852,
 * `repeat(auto-fill, minmax(280px, 1fr))`, the language-tile grid the spec calls "the
 * only genuinely fluid layout in the whole app" and tells the rewrite to copy
 * (LAYOUT_SPEC_DRAFT.md:894 #40). #40 is a different component with its own copy of the
 * pattern, and this is NOT the "same number in two places" §2.3 bans: that ban is about
 * numbers that MUST agree — "If two components must agree, they share a token." A tile
 * of languages and a card of skins are not required to agree, so each states its own
 * floor and each can move without the other. This one moves through
 * `--_ui-card-grid-min` (see the API), the same shape #8 uses for `--_ui-card-min-block`.
 *
 * WHAT THIS COMPONENT DELIBERATELY DOES NOT DO
 *   - NO MEASURE. The leaf measure is the leaf pane's, one value, centred
 *     (spec §4.4: "min(100%, ~84ch) centred"), and bugs T1/T21 are precisely a second
 *     and third measure appearing where nobody declared one. This file computes no
 *     max-inline-size; the host and the grid both compute `none` and that is asserted.
 *   - NO SCROLL REGION. spec §4.4 makes the LEAF PANE the scroller ("overflow-y: auto;
 *     padding: var(--ui-space-6)"). A grid that also scrolled would be a second
 *     scrollport inside the first, which is the shape §2.4 exists to stop. The grid
 *     overflows visibly or not at all.
 *   - NO SURFACE. It paints nothing: no background, no border, no radius, no shadow.
 *     The surface is #8 (SCOPE.md:1643, "small | #8") and a card grid that also painted
 *     a card would be the second surface the definition card's header warns about.
 *   - NO SELECTION. The skin picker's active card carries `is-active`
 *     (CITE settings-display-skin .slate-card [i=88] <button class="slate-card
 *     slate-skin-card is-active">), and selection stays with the CELL, never with the
 *     grid: "no component in this wave may own a private 'selected' look" (wave-4
 *     notes; DECISIONS.md:244, spec §3.9). The four dials inherit straight through this
 *     component to whatever is slotted in, which is asserted both ways — the grid never
 *     takes the face, the slotted cell always sees it.
 *   - NO CARDS. It does not construct a cell, wrap a child, or take an `items` array.
 *     Slotted children ARE the grid items (the slot is display: contents), so the cell
 *     can be a #8, a #50 definition card, a #29 settings row or a plain button, and the
 *     grid never has an opinion about which.
 *
 * API
 *   <ui-card-grid>…</ui-card-grid>              2-up, collapsing to 1-up on its own
 *                                               container (the skin picker)
 *   <ui-card-grid columns="1">…</ui-card-grid>  one full-width column (the update list)
 *   <ui-card-grid label="Installed skins">       role="group" with an accessible name
 *   --_ui-card-grid-min                          the cell floor, if 280px is wrong for
 *                                               a particular cell. Set on the host.
 *
 *   `columns` IS SAFE AS A PROPERTY NAME, checked rather than assumed — the trap #8
 *   documents for `scroll` (a reactive property named after a standard method silently
 *   shadows it). Probed in the rig: `'columns' in HTMLElement.prototype` is false and
 *   `typeof document.createElement('div').columns` is 'undefined', so nothing standard
 *   is being taken. Pinned by a test rather than left as a claim.
 *
 *   THE DEGENERATE CASE IS #8's, inherited with the base: every UiElement host carries
 *   `container-type: inline-size` (CONVENTIONS §2), so in an intrinsic-sizing slot — a
 *   bare flex item, a column flex with align-items: flex-start — there is no container
 *   inline size to fill, the host resolves to 0 and the cells collapse with the content
 *   overflowing VISIBLY (never clipped, spec §2.4). The remedy is one declaration at
 *   the call site: `flex: 1`, `align-self: stretch`, a width, a grid track. Stated here
 *   and pinned in the suite, exactly as ui-card.js:104-125 states it for #8.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';

/** The two the component recognises. Anything else falls back to 2 rather than to a
 *  silent one-column stack — the same documented-fallback shape #8 uses for CARD_PADS
 *  and base.js uses for focus-ring: a wrong-looking layout is recoverable, a layout
 *  that quietly stops being the component's job is not. */
export const CARD_GRID_COLUMNS = Object.freeze([1, 2]);

/** The 2-up default, named so a test and a consumer read the same constant. */
export const CARD_GRID_DEFAULT_COLUMNS = 2;

export class UiCardGrid extends UiElement {
    static properties = {
        /** 1 or 2. 2 is the row's "2-up card layout"; 1 is the update list's stack. */
        columns: { type: Number, reflect: true },

        /** Accessible name. With one, the grid becomes a labelled group; without one
         *  it carries no role at all, because an unnamed group is noise in the
         *  accessibility tree and a layout box is not a landmark. Same contract as #8. */
        label: { type: String },
    };

    static styles = [css`
        /* THE HOST KEEPS THE BASE'S BOX — display: block, container-type: inline-size.
         * The grid is an element inside the root, not the host itself, for the reason
         * #8 and #50 both give: a screen sheet can name the host from outside and can
         * name nothing in here, so the layout cannot be reached and repainted the way
         * slate-shell.css reaches .slate-card on fourteen of Slate's twenty cards.
         *
         * The two numbers this component owns live here, in private slots, so the track
         * expression below reads each of them once. --_ui-card-grid-min is the
         * documented consumer hook (see the API); --_ui-card-grid-gap is NOT a hook and
         * is not documented as one — it exists so the gap declaration and the crossover
         * arithmetic cannot drift apart, which is the whole T20 story in one
         * declaration. (No backticks in here: CONVENTIONS §9, and this comment is where
         * that rule cost its third syntax error.) */
        :host {
            /* spec §2.3 case 4: a minimum floor on a grid track, required rather than
             * merely permitted. The value is Appendix 14's, slate-shell.css:1847-1852. */
            --_ui-card-grid-min: 280px;

            /* ORACLE-DERIVED, via the spec's snapping table: Slate's two 2-up grids
             * measure 14px and 12px between cells (rect arithmetic in the header) and
             * spec §3.3 snaps "14 -> 12". One token, both axes, both column modes. */
            --_ui-card-grid-gap: var(--ui-space-3);
        }

        /* THE GRID. Every declaration is either a token, a fraction or Appendix 14's
         * floor; there is no viewport unit, no @media, and no colour of any kind. */
        .grid {
            display: grid;

            /* One value, both axes. Slate writes the row gap and the column gap as two
             * literals per call site, which is how one screen ends up with 14 and 12.
             *
             * THIS IS A GUTTER, NOT A SEAM, so it is spacing and not the seams utility:
             * CONVENTIONS §13, "Not a spacing utility either: gutters are --ui-space-*,
             * and one gap cannot be two widths." Nothing is painted behind these cells,
             * so no divider is drawn between them — the cards are separate surfaces on
             * the page ground, which is what the oracle measures (ten cards, no rule
             * between them) and what a seam grid would silently change. */
            gap: var(--_ui-card-grid-gap);

            /* Row-major, which is what the oracle measures: [629,479] then [1236,479]
             * then [629,589] — across, then down. Restated rather than left to the
             * initial value because it is the reading order the labels depend on. */
            grid-auto-flow: row;

            /* EQUAL HEIGHT PER ROW, BY CONSTRUCTION. This is grid's initial value and
             * it is restated because it is a contract, not an accident: Slate's ten
             * skin cards are all h=96 only because their content happens to be uniform,
             * and a card whose caption wraps would sit shorter than its neighbour. The
             * cells stretch, so a #8 slotted here fills its row band. */
            align-items: stretch;

            /* THE TRACK EXPRESSION — derived in the header. Two tracks while half the
             * container clears the floor, one below it, never three, and the crossover
             * (2 x MIN + GAP) falls out of the arithmetic instead of being written down
             * a second time as a container-query threshold. */
            grid-template-columns: repeat(auto-fill, minmax(
                max(
                    min(100%, var(--_ui-card-grid-min)),
                    calc((100% - var(--_ui-card-grid-gap)) / 2)
                ),
                1fr
            ));
        }

        /* THE UPDATE LIST (LAYOUT_SPEC_DRAFT.md:922, "skin picker (2-up), update
         * list"): one full-width column, same gap token, same flow. minmax(0, 1fr)
         * rather than 1fr so a cell with an unbreakable string shrinks instead of
         * pushing the track wider than the container. */
        :host([columns="1"]) .grid {
            grid-template-columns: minmax(0, 1fr);
        }

        /* The UA already gives a slot display: contents; restating it is the difference
         * between the assigned cards being grid ITEMS — so the gaps fall between cards
         * and the track expression sizes them — and them being one anonymous item in a
         * single track with no gaps at all. Cheap, and the failure it prevents is
         * silent. (#28 ui-folder-disclosure carried the same line for the same reason on
         * its own .rows grid; that component was deleted 30 Aug 2026 — audit F-005,
         * Ben's D10 — so this is now the only copy.) */
        .grid slot {
            display: contents;
        }
    `];

    constructor() {
        super();
        this.columns = CARD_GRID_DEFAULT_COLUMNS;
        this.label = '';
    }

    /** Normalise before paint, so columns="3", columns="0" and columns="two" are a
     *  documented fallback rather than a layout nobody chose. Number-typed properties
     *  give NaN for the last of those, and NaN is not in the list. */
    willUpdate(changed) {
        if (changed.has('columns')) {
            const raw = Number(this.columns);
            const next = CARD_GRID_COLUMNS.includes(raw) ? raw : CARD_GRID_DEFAULT_COLUMNS;
            if (next !== this.columns) this.columns = next;
        }
    }

    render() {
        const named = Boolean(this.label);
        return html`<div
            id="grid"
            class="grid"
            role=${named ? 'group' : nothing}
            aria-label=${named ? this.label : nothing}
        ><slot></slot></div>`;
    }
}

customElements.define('ui-card-grid', UiCardGrid);
