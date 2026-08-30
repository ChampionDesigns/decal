/**
 * selector-list.js — the profile listbox's STYLESHEET, and only that.
 *
 * Wave 5.3, `bug-P12-real-listbox` / `bug-P4-hit-floor-one-owner`. The pattern's keys,
 * ids, grouping and R1 marking are `src/lib/profile-listbox.js`; they are pure and run
 * under `node:test`, which a module importing `lit` cannot. So the sheet is here and the
 * decisions are there — the same split `seams.js` and `type-roles.js` already are.
 *
 * `<selector-screen>` adopts this alongside `typeRoles` and `seams`.
 */

import { css } from 'lit';

/**
 * THE LISTBOX'S RULES.
 *
 * Adopted by `<selector-screen>` alongside `typeRoles` and `seams`, and written here for
 * the same reason those two are written where they are: the rule and the reason it exists
 * belong in one file with the behaviour it decorates.
 *
 * NO BACKTICK ANYWHERE IN THIS TEMPLATE, comment or not — one inside a tagged template
 * closes it where it stands and the file stops parsing as JavaScript some way further on.
 */
export const listboxStyles = css`
    /* THE LISTBOX. One tab stop; its ring is INSET because the pane scrolls, and an
     * outset ring on the first row is clipped by its own scrollport (bug L24's class).
     *
     * IT IS THE SEAMED GRID, AND UNTIL PARITY SURFACE 5 NOBODY DREW THE SEAM. #26's own
     * file hands the separator to its container in writing -- "Slate draws it per row ...
     * which is the > * + * shape §13 retires ... the ink is unchanged (--ui-line); the
     * drawer moves to [the container]", and "A list of these rows in a .seam-grid
     * .seam-rows .seam-line container is the shape that replaces the separator below" --
     * and then asserts border-top-width stays 0 on every row, first one included. This
     * container did not take the handoff: it was a flex column with a --ui-space-1 gap
     * and NO ground, so the 4px between two --ui-fascia rows showed the pane's own
     * --ui-fascia. MEASURED: pane rgb(14,19,23), row rgb(14,19,23) -- the same colour, so
     * the list had neither Slate's hairline nor §13's coloured gap. Slate draws N-1
     * separators (slate-shell.css:270-273, ORACLE profile-selector .p-3 [i=21]
     * border-top-width = 1px, border-top-color = rgb(58,72,82) = --ui-line), and
     * settings-nav-column.js:200 already renders exactly the class list #26 names, so the
     * one skin was drawing its two lists two ways -- the drift Ben asked the rewrite to
     * end, in the same shape parity surface 1 found on the band's control height.
     *
     * The classes go on the ELEMENT (see selector-screen.js), never restated here, so the
     * declarations are seams.js's and there is exactly one copy of them. What is left in
     * this rule is the one thing the utility does not own. */
    /* THE GROUND IS FOR THE ROW GAPS, AND NOTHING ELSE. Ben, 25 August 2026, pointing at
     * a vertical line 24px inside the pane divider: "The second line is still there, this
     * is the one I am referring to."
     *
     * IT IS THE SEAM TECHNIQUE'S OWN GROUND SHOWING WHERE NO SEAM BELONGS. .seam-grid
     * paints --ui-line across the whole box and every row paints --ui-fascia over it, so
     * what is left is the row gaps. That works when the rows land on whole device pixels.
     * MEASURED here: the box's right edge falls at device x 615.82, so the last column is
     * part row and part ground, and the leftover paints a 222 hairline down the entire
     * list. The left edge happens to land whole, which is why there was one line and not
     * two.
     *
     * background-clip: padding-box STOPS THE GROUND AT THE PADDING EDGE, and a transparent
     * inline border moves that edge one hairline inside the box. The rows are laid out in
     * the same content box either way, so nothing moves: the ground simply stops before
     * the fraction the rows cannot cover. The row gaps are unaffected — they are on the
     * block axis, and the block edges are untouched. */
    .listbox {
        min-inline-size: 0;
        border-inline: var(--ui-hairline) solid transparent;
        margin-inline: calc(-1 * var(--ui-hairline));
        background-clip: padding-box;
    }

    .listbox:focus-visible {
        outline: var(--ui-focus-w) solid var(--ui-steel);
        outline-offset: var(--ui-focus-offset-inset);
    }

    /* A FAMILY. The group role carries the name; this carries only the rhythm between
     * families, which is the one thing the wrapper is on screen for. NO INDENT: an
     * indent would be a second signal for a relationship aria already states, and it
     * would cost every row inline size in the narrow pane.
     *
     * IT IS A SEAMED GRID TOO, and it has to be (seams.js trap 1): a transparent child of
     * a seamed grid is a HOLE -- the divider ink shows through everything the child does
     * not paint over, so a flex group inside the seamed listbox would have painted a
     * --ui-line band behind its own caption and 4px-thick dividers between its rows while
     * the top level drew 1px. Same classes, same utility, one weight everywhere.
     *
     * THE OLD --ui-space-2 MARGIN BETWEEN FAMILIES IS GONE, not forgotten: a margin on a
     * grid item widens the GAP, and the gap is now the divider, so the margin would have
     * drawn an 8px bar of --ui-line between every pair of families. The air it bought
     * moves onto the caption's own padding-block below, where the caption's ground pays
     * for it instead of the seam's. */
    .group {
        min-inline-size: 0;
    }

    /* The family's name, presentational only: the accessible name is the group's
     * aria-label, said once there, so this is aria-hidden in the template.
     *
     * IT ALSO CARRIES .seam-cell in the template, which paints --ui-fascia: a caption
     * that painted nothing would show the seam ink behind its own words (trap 1 again),
     * and the suite goes red on exactly that if the paint is taken away. The block
     * padding is the family rhythm the group's old margin used to buy -- 8px above the
     * words and 4px below, against the 12px and 4px of pane ground it replaces -- and it
     * is paid out of the caption's own ground, so the seam above it stays one pixel. */
    /* THE FAMILY IS A ROW, NOT A CAPTION (Ben, 24 Aug 2026: "Make families collapse").
     * What was here was .family — an aria-hidden span printing the family's name above
     * its members, with no state and nothing to press. It is gone with its rule:
     * a class nobody renders is a rule nobody can find the owner of.
     *
     * The row that replaces it reads as a heading and answers as a control, so it takes
     * the caption's weight and the row's box — and the fold mark is a fixed column, so
     * the names below a shut family and an open one start at the same x. */
    .family-row {
        font-weight: var(--ui-weight-semibold);
    }

    .family-row .fold-mark {
        display: inline-block;
        inline-size: var(--ui-space-5);
        color: var(--ui-muted);
        font-size: var(--ui-text-sm);
    }

    /* A MEMBER IS INDENTED BY THE MARK'S OWN WIDTH, which is what makes the fold read as
     * containment rather than as a divider. The group is the only place this can be
     * stated: an option does not know whether it has a family above it. */
    .group > ui-list-row {
        padding-inline-start: var(--ui-space-5);
    }

    /* THE ACTIVE OPTION — where the keyboard is, which is a different fact from
     * SELECTED. Selected is #26's own paint through the four --ui-selected-* dials;
     * this is a ring, so both can be true at once and still be told apart. It is drawn
     * only while the listbox itself has focus: an activedescendant ring on an unfocused
     * list is a second cursor on screen.
     *
     * NO GEOMETRY HERE (P4). No height, no min-height, no padding on an option. */
    .listbox:focus-visible ui-list-row[data-active] {
        outline: var(--ui-focus-w) solid var(--ui-steel);
        outline-offset: var(--ui-focus-offset-inset);
    }

    /* The empty answer. Not an error: a filter that matches nothing is a real result. */
    .list-empty {
        color: var(--ui-text-2);
        padding: var(--ui-space-4) var(--ui-space-3);
    }
`;
