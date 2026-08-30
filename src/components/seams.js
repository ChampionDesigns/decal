/**
 * seams.js - THE SEAM UTILITY. Wave 1 item #14, "Hairline / seam".
 *
 * THIS FILE DEFINES NO CUSTOM ELEMENT, AND THAT IS THE DELIVERABLE.
 * SCOPE.md Part 4's Wave 1 table lists sixteen rows so the 57-component inventory
 * stays 57-for-57, and says of this one, verbatim:
 *
 *     "Dissolves likewise: the good pattern is a 1px grid `gap` over a coloured grid
 *      background (spec §2.2), so this becomes a documented layout utility, not an
 *      element."
 *
 * LAYOUT_SPEC_DRAFT.md §5.1 row 14 says the same in four words - "Becomes a grid-gap
 * utility" - against `slate-components.css:27`, 55 uses. So the deliverable is a
 * shared css fragment plus its documentation (CONVENTIONS.md §13), and a
 * `customElements.define` here would be the defect, not the feature. Part 4 also maps
 * spec §4's per-screen "Separator" onto this utility rather than onto a component.
 *
 * ===========================================================================
 * DISQUALIFICATION CHECK, RUN FIRST (Part 10 §4)
 * ===========================================================================
 *
 * A DECISION DOES SETTLE THE SEAM, and it settles it the way this file builds it.
 * DECISIONS register C5, ACCEPTED: "the divider: one 1px grid gap, `var(--ui-seam)`,
 * replacing today's 2px band of two different greys (T19)" (SCOPE.md:2243). The
 * layout spec's OQ-6 is that decision's old number and is NOT open - SCOPE.md:1761,
 * "OQ-1...OQ-13 all map onto accepted register decisions (... OQ-6->C5 ...). Nothing
 * below re-opens any of them." What C5 carries is a RESIDUAL: Ben confirms the LOOK
 * on the C1 prototype, collected as Q3 (SCOPE.md:5142). So ladder step 1 answers the
 * shape, and the oracle below is corroboration, not the authority.
 *
 * The bugs this file names (L9, T2, T19, LAYOUT_SPEC_DRAFT.md §7) are checked against
 * the 140-bug list before any value is matched, and the one genuinely responsive
 * question - which screens become seamed grids - has no Slate answer at all
 * (98.4% frozen; the layout spec governs) and belongs to each screen's own row.
 *
 * ===========================================================================
 * WHAT SLATE DOES, MEASURED - and it already contains the right answer twice
 * ===========================================================================
 *
 * Slate spells a divider three different ways. The oracle was queried mechanically
 * (`prov_query.py`, corpus prov-baseline dark / prov-light light) and every line
 * below is quoted, never paraphrased.
 *
 * 1. AS A BORDER CLASS - the 55 uses, on rows, on standalone rules and on box
 *    enclosures alike. `.slate-hairline` is a border-COLOUR class and the width comes
 *    from somewhere else entirely:
 *
 *      CITE settings-machine-machine-info .flex [i=52] border-top-color =
 *           rgb(58, 72, 82)  <-  slate-components.css  `.slate-hairline`  authored
 *           `(NOT CAPTURED - set via a CSS shorthand)`  !important=yes (token-driven)
 *      CITE settings-machine-machine-info [prov-light] .flex [i=52] border-top-color =
 *           rgb(203, 208, 211)  <-  same rule (token-driven)
 *      CITE settings-machine-machine-info .flex [i=52] border-top-width = 1px  <-
 *           app.css  `.border-t`  authored `1px`  !important=no  (FROZEN/hardcoded)
 *
 *    Read those two together: the divider's INK is a token and moves with the theme,
 *    while its WIDTH is a Tailwind literal in the compiled bundle and is frozen.
 *    That is precisely why spec §3.1 keeps `--ui-hairline` as a token - "Intrinsic.
 *    Kept as a token so it can go to `0.5px`/dpr" - and why this utility takes the
 *    width from `--ui-seam`, never from a literal.
 *
 *    THE 55 USES ARE NOT ALL ONE SHAPE, counted read-only in `settings/settings.js`:
 *      43  `<hr class="border-t slate-hairline w-full" />`, identical, every one -
 *          elements in the DOM whose entire job is to be a line;
 *       5  `<div class="flex items-center justify-between py-[18px] border-t
 *          slate-hairline">` (one of them `pb-[18px] border-b`) - a CONTENT row that
 *          also draws the divider above it. The oracle's [i=52..64] are these, not
 *          the `<hr>`s;
 *       7  `<div class="rounded-[10px] border slate-hairline p-4 ...">` - an
 *          ENCLOSURE, a border on all four sides of a box.
 *
 *    A grid gap deletes the first 48: 43 elements that exist only to be a line, and
 *    5 borders that a row gap draws for free. IT MUST NOT TOUCH THE 7 ENCLOSURES -
 *    that is `--ui-border-w` with `--ui-line` on the box itself, and turning one
 *    into a gap is the mistake CONVENTIONS §13's "What this is not" names.
 *
 * 2. AS A 1px GRID GAP OVER A COLOURED GROUND - Live, the rail's right edge. This is
 *    the pattern the spec adopts, and Slate's own sheet explains it better than the
 *    spec does (`slate-live.css:376-384`, read read-only because the authored value
 *    behind a `background:` shorthand is a corpus carve-out):
 *
 *        "THE RAIL'S RIGHT EDGE: a 1px grid gap with the enclosing grade showing
 *         through it, full height, from the header's underline to the foot of the
 *         screen. Same grade as that underline and as the band's top edge, so the
 *         three lines that close a box are one family and everything lighter is
 *         inside one."
 *
 *      CITE live-ready .flex-grow [i=16] gap = 1px  <-  slate-live.css
 *           `#main-page > .flex-grow.flex`  authored `1px`  !important=no
 *           (FROZEN/hardcoded)
 *      CITE live-ready .flex-grow [i=16] background-color = rgb(82, 97, 107)
 *           [prov-baseline] / rgb(170, 178, 183) [prov-light]  <-  slate-live.css
 *           `#main-page > .flex-grow.flex`  (token-driven)
 *           => #52616b / #aab2b7 = --ui-line-strong in BOTH themes.
 *
 * 3. AS AN AXIS-SELECTIVE GAP - the editor's step matrix, spec Appendix 8 ("Column
 *    gap as the only vertical rule, over a coloured grid background"):
 *
 *      CITE editor-steps .pe-grid [i=17] gap = 0px 1px  <-  (no declaration -
 *           inherited or initial value)  (FROZEN/hardcoded)
 *      CITE editor-steps .pe-grid [i=17] background-color = rgb(58, 72, 82)
 *           [prov-baseline] / rgb(203, 208, 211) [prov-light]  <-
 *           profile-editor-v3.css `.pe-grid`  (token-driven)
 *           => #3a4852 / #cbd0d3 = --ui-line in BOTH themes.
 *
 *    (`gap` is reported as a shorthand with no authored value; the source read is
 *    `profile-editor-v3.css:291-296`, `row-gap: 0; column-gap: 1px; background:
 *    var(--slate-line)`.)
 *
 * AND THE ZONE GROUND, which is a background and not a gap at all:
 *
 *      CITE live-ready #main-page [i=0] background-color = rgb(58, 72, 82)
 *           [prov-baseline] / rgb(203, 208, 211) [prov-light]  <-  slate-live.css
 *           `#main-page`  (token-driven)   -> --ui-zone-seam
 *      CITE live-ready #main-page [i=0] gap = normal  <-  (no declaration -
 *           inherited or initial value)  (FROZEN/hardcoded)
 *
 * The second of those is the honest half: Slate's PAGE is not a seamed grid. The
 * pattern exists in two places (the rail, the editor matrix) and the rewrite
 * generalises it to every divider in the app. Where Decal's screens are seamed
 * grids and Slate's are not, the layout spec governs and the oracle has no vote -
 * responsive structure is exactly the carve-out (98.4% of Slate's geometry is
 * frozen).
 *
 * ===========================================================================
 * THREE WEIGHTS - BUT *NOT* APPENDIX 2's THREE. Read this before quoting it.
 * ===========================================================================
 *
 * Appendix 2 (LAYOUT_SPEC_DRAFT.md:1394-1396), verbatim, is where the IDEA of three
 * weights comes from:
 *
 *     "Seams, edges and zone grounds are three different weights - `--slate-seam`
 *      divides a box, `--slate-line` encloses one, `--slate-zone-seam` is the ground
 *      between zones (`slate-tokens.css:170-179`)."
 *
 * TWO of those three tokens are this utility's - `--slate-line` -> `--ui-line` and
 * `--slate-zone-seam` -> `--ui-zone-seam`. The THIRD IS NOT. Appendix 2's first
 * weight, `--slate-seam`, is an inset box-shadow between the segments of ONE control,
 * and this utility deliberately refuses it (NOT A FOURTH WEIGHT, below). In its place
 * the utility ships `--ui-line-strong`, and the authority for that substitution is
 * the ORACLE and the spec's own screen skeleton, not the appendix:
 *
 *      CITE live-ready .flex-grow [i=16] background-color = rgb(82, 97, 107)
 *           [prov-baseline] / rgb(170, 178, 183) [prov-light]  <-  slate-live.css
 *           `#main-page > .flex-grow.flex`  (token-driven)  = --ui-line-strong
 *
 *      LAYOUT_SPEC_DRAFT.md:524-525, the Live skeleton, writes it into the seamed
 *      grid by name - `gap: var(--ui-seam)`, annotated in the spec "the seam IS the
 *      divider", over `background: var(--ui-line-strong)`, annotated "shows through
 *      the gap".
 *
 * So: three inks, two of them Appendix 2's and one of them measured. ANY SENTENCE
 * THAT SAYS "the three Appendix-2 weights" IS WRONG ABOUT THIS FILE.
 *
 *   .seam-zone    --ui-zone-seam    (Appendix 2, weight 3) the ground BETWEEN ZONES.
 *                                   The default, because a seamed grid is a zone
 *                                   boundary by construction. Same value as --ui-line
 *                                   in both themes today, so the default renders
 *                                   identically to weight 2 and a fork can move them
 *                                   apart (styles/tokens.css splits them for exactly
 *                                   that reason).
 *   .seam-line    --ui-line         (Appendix 2, weight 2) the weight that ENCLOSES a
 *                                   control, used as a divider between controls.
 *                                   Slate's editor matrix and its 55 settings rows
 *                                   both land here.
 *   .seam-strong  --ui-line-strong  (NOT in Appendix 2 - measured, above) the
 *                                   EMPHASISED divider: Slate's rail edge, its header
 *                                   underline and its band top, "the three lines that
 *                                   close a box".
 *
 * NOT A FOURTH WEIGHT: `--ui-seam-ink` (Slate's `--slate-seam`, Appendix 2's FIRST
 * weight, "the seam inside a one-piece bank"). That one is an inset box-shadow
 * between segments of a single control, it is component #3 ui-bank's business, and
 * CONVENTIONS §4 already documents how it survives selection through
 * `--_ui-rest-shadow`. A grid gap between two panes and a shadow inside one control
 * are different mechanisms; giving them one class would be the conflation the token
 * split exists to prevent. That refusal is this file's call, made on the mechanism -
 * the appendix does not authorise it and is not cited for it.
 *
 * ===========================================================================
 * WHAT THIS UTILITY IS NOT
 * ===========================================================================
 *
 * NOT the hairline that ENCLOSES a box. Three of the eight `.slate-hairline`
 * elements in the corpus are `<div class="rounded-[10px] border slate-hairline">` -
 * a border round a card, not a divider between siblings. That is `--ui-border-w`
 * (spec §3.6, itself `var(--ui-hairline)`) with `--ui-line`, declared by whichever
 * component draws the box - #8 Card, #9 Chart card. A gap draws lines BETWEEN cells
 * and never around the outside, which is the whole reason the two cases must not
 * share one class.
 *
 * NOT a spacing utility. `--ui-seam` is a hairline; gutters are `--ui-space-*`. A
 * grid that wants both - panes 18px apart with a rule down the middle - needs the
 * rule drawn by something else, because one gap cannot be two widths.
 *
 * ===========================================================================
 * WHAT IT RETIRES - and one it only half-retires
 * ===========================================================================
 *
 *   T2  "The `> * + *` half of the rule can never match ... the sub-nav has NO row
 *        separators at all (measured `box-shadow: none`)." DEAD: a gap needs no
 *        sibling selector, so N cells give N-1 seams by construction and a separator
 *        cannot silently fail to exist.
 *   T19 "The nav/pane seam is TWO hairlines of two different greys, which is why the
 *        nav container measures 599 rather than 600." DEAD: one gap, one ink, and the
 *        seam comes out of the grid rather than out of a pane: 260 + 1 + 339 = 600.
 *        Spec §4.4 accepts the consequence in advance - "One gap replaces two lines
 *        and the divider WILL look different" - and register decision C5 (ACCEPTED)
 *        settles it that way; its residual is Ben confirming the LOOK on the C1
 *        prototype (Q3, SCOPE.md:5142), not the shape. This file only makes the
 *        single-gap form available; which screens adopt it is each screen's row.
 *
 *   L9  HALF, and the other half is NOT this file's to claim. L9 is "Every rail
 *        stepper draws its seam TWICE (component inset shadow + Live border), and
 *        three of eight draw 1px instead - grind plus the two continuation rows"
 *        (LAYOUT_SPEC_DRAFT.md §7.2 L9, `slate-components.css:588` +
 *        `slate-live.css:610-615`; `layout/live.md` M-2:1489-1499). BOTH drawers sit
 *        outside this file. The component inset shadow is `--ui-seam-ink` INSIDE one
 *        control - NOT A FOURTH WEIGHT above puts it squarely in #3 ui-bank's scope -
 *        and the Live border belongs to the Live screen's own row. What this utility
 *        removes is the STRUCTURE that let two drawers exist: the container draws one
 *        gap per adjacent pair, so a rail built as a seamed grid has no per-cell rule
 *        to get wrong and no second weight to fall out of step with the first.
 *        Retiring L9 takes this utility AND those two rows. Saying "L9 dead" here
 *        would be claiming someone else's work.
 *
 * ===========================================================================
 * USING IT
 * ===========================================================================
 *
 * (a) DESCENDANTS INSIDE A COMPONENT'S SHADOW ROOT - the common path:
 *
 *     import { seams } from 'src/components/seams.js';
 *     static styles = [seams, css`...own rules...`];
 *
 * STRUCTURAL FRAGMENT: it goes FIRST, like `hitArea`, and before
 * `selectionSurface` (CONVENTIONS §4). Its class selectors carry a real (0,1,0)
 * rather than being wrapped in `:where()`, so an own rule at the same specificity
 * written later wins the tie, and a plain element selector does not silently beat
 * the utility in a light-DOM document.
 *
 * (b) WHEN THE COMPONENT ITSELF *IS* THE SEAMED GRID. The spec's own screen
 *     skeletons put the grid on the HOST, not on a wrapper inside it:
 *
 *        LAYOUT_SPEC_DRAFT.md:521-525   <live-screen>   display:grid;
 *                                       gap: var(--ui-seam);
 *                                       background: var(--ui-line-strong)
 *        LAYOUT_SPEC_DRAFT.md:701-703   <master-detail> display:grid;
 *                                       gap: var(--ui-seam)
 *
 *     A `.seam-grid` rule inside that component's own shadow styles CAN NEVER MATCH
 *     ITS HOST, so without the `:host(...)` half below the screen would have to
 *     hand-write display + gap + background - the three-declaration duplication this
 *     utility exists to delete. Put the classes on the host and the same seven rules
 *     apply to it:
 *
 *         static styles = [seams, css`...own rules...`];
 *         connectedCallback() {
 *             super.connectedCallback();
 *             this.classList.add('seam-grid', 'seam-strong');   // NOT in the
 *         }                                                     // constructor: a
 *                                                               // custom element
 *                                                               // constructor must
 *                                                               // not gain attributes
 *
 *     The parent may put them there instead - `<master-detail class="seam-grid
 *     seam-line">` in the parent's template - and then the PARENT's copy of the
 *     fragment paints the host, because the host element lives in the parent's tree.
 *     Both routes are supported and they never disagree, because both sets of
 *     declarations come out of this one fragment. The ordering rule if both apply:
 *     for normal declarations the OUTER tree wins over `:host()` (CSS Scoping), and
 *     since the values are identical that is invisible.
 *
 *     SPECIFICITY ON A HOST IS ONE STEP HIGHER than in the light DOM: `:host(.x)` is
 *     (0,2,0), not (0,1,0). So a bare `:host { display: flex }` in your own styles
 *     will NOT beat `:host(.seam-grid)`; a component that means to override writes
 *     `:host(.seam-grid) { ... }` itself, later in its own list.
 *
 * (c) IN A DOCUMENT OR A HAND-BUILT SHADOW ROOT - the gallery, the capture battery,
 *     any root Lit does not own:
 *
 *     import { adoptSeams } from 'src/components/seams.js';
 *     adoptSeams();            // the document
 *     adoptSeams(shadowRoot);  // one root
 *
 * ===========================================================================
 * THE THREE TRAPS
 * ===========================================================================
 *
 * 1. A CELL THAT DOES NOT PAINT IS A HOLE, NOT A SEAM. The ground shows through
 *    everything that is not painted over it, so a seamed grid whose cells are
 *    transparent is a solid slab of divider colour. Cells that are components paint
 *    their own ground inside their shadow root and need nothing; plain cells take
 *    `.seam-cell` (--ui-fascia, the page body) or paint themselves.
 * 2. LEFTOVER TRACK SPACE IS ALSO GROUND. If the tracks do not fill the container,
 *    the remainder paints as a slab. `profile-editor-v3.css:283-286` documents its
 *    own version of this and settles it by making the leftover the page ground.
 *    Fill the tracks (`1fr`, `align-content: stretch`) or let the ground be right.
 * 3. A NESTED SEAM GRID IS A CELL. If it carries `.seam-cell` as well, the cell
 *    ground would win on source order - so a nested grid always names its weight
 *    (`.seam-zone` / `.seam-line` / `.seam-strong`), which is (0,2,0) and outranks
 *    `.seam-cell`'s (0,1,0) regardless of order. On a host the same pair is (0,3,0)
 *    vs (0,2,0) and lands the same way.
 *
 * TOKENS CONSUMED: --ui-seam (the length, = --ui-hairline), --ui-zone-seam,
 * --ui-line, --ui-line-strong, --ui-fascia. All five exist in styles/tokens.css in
 * BOTH theme blocks; this file declares none of them and adds none.
 */

import { css } from 'lit';
import { adoptStyleSheet } from 'src/components/base.js';

/* ===========================================================================
 * THE FRAGMENT
 *
 * Seven rules, then the same seven again on `:host(...)` for the case where the
 * component IS the grid. Every length and every colour is a token; there is no
 * !important, no id selector, no @media and no viewport anywhere in it.
 * =========================================================================== */

export const seams = css`
    /* THE MECHANISM: a hairline grid gap with a coloured ground showing through it.
     * The gap IS the divider (spec §2.2, §3.9: --ui-seam is "named separately for
     * intent: this is the grid gap that DRAWS a divider").
     * display: grid is set so the class is enough on its own; a component that
     * already declares its own display wins the tie by writing its rule later. */
    .seam-grid {
        display: grid;
        gap: var(--ui-seam);
        background-color: var(--ui-zone-seam);
    }

    /* AXIS-SELECTIVE SEAMS. Slate's editor matrix rules its columns and not its
     * rows (measured gap 0px 1px); a settings list rules its rows and not its
     * columns. Both are one class. */
    .seam-grid.seam-cols {
        row-gap: 0;
        column-gap: var(--ui-seam);
    }

    .seam-grid.seam-rows {
        column-gap: 0;
        row-gap: var(--ui-seam);
    }

    /* THE THREE WEIGHTS - two of them Appendix 2's, --ui-line-strong measured (see
     * the header). Each is (0,2,0) so it outranks both the default ground above and
     * .seam-cell below, whatever the source order. */
    .seam-grid.seam-zone {
        background-color: var(--ui-zone-seam);
    }

    .seam-grid.seam-line {
        background-color: var(--ui-line);
    }

    .seam-grid.seam-strong {
        background-color: var(--ui-line-strong);
    }

    /* THE OPT-IN CELL GROUND, for a plain cell that is not a component with a
     * shadow root of its own. Without a painted cell there is no seam - only
     * ground (trap 1 in the header). */
    .seam-cell {
        background-color: var(--ui-fascia);
    }

    /* =======================================================================
     * THE SAME SEVEN, ON THE HOST.
     *
     * LAYOUT_SPEC_DRAFT.md:521-525 and :701-703 put the seamed grid on the screen
     * component ITSELF - "<live-screen> display:grid; gap: var(--ui-seam);
     * background: var(--ui-line-strong)" - and a class selector inside a shadow
     * root cannot reach that root's host. Without these, every such screen
     * hand-writes the three declarations this utility exists to delete.
     *
     * :host(.x) is (0,2,0) and :host(.x.y) is (0,3,0) - one step above the
     * light-DOM copies - so the weight/default/cell ordering is preserved exactly
     * (trap 3). In a document these match nothing, so adoptSeams(document) is
     * unaffected. See USING IT (b).
     * ======================================================================= */
    :host(.seam-grid) {
        display: grid;
        gap: var(--ui-seam);
        background-color: var(--ui-zone-seam);
    }

    :host(.seam-grid.seam-cols) {
        row-gap: 0;
        column-gap: var(--ui-seam);
    }

    :host(.seam-grid.seam-rows) {
        column-gap: 0;
        row-gap: var(--ui-seam);
    }

    :host(.seam-grid.seam-zone) {
        background-color: var(--ui-zone-seam);
    }

    :host(.seam-grid.seam-line) {
        background-color: var(--ui-line);
    }

    :host(.seam-grid.seam-strong) {
        background-color: var(--ui-line-strong);
    }

    :host(.seam-cell) {
        background-color: var(--ui-fascia);
    }
`;

/**
 * The class names, named once so a test or a screen can refer to them without
 * spelling them again. Same argument as every other "the same number written in two
 * places" rule in spec §2.3.
 */
export const SEAM_CLASSES = Object.freeze({
    grid: 'seam-grid',
    cols: 'seam-cols',
    rows: 'seam-rows',
    zone: 'seam-zone',
    line: 'seam-line',
    strong: 'seam-strong',
    cell: 'seam-cell',
});

/**
 * The fallback sheet, memoised BY the `CSSResult` it was built from.
 *
 * NOT a module-scope `let`. CARRY_FORWARD.md §6 pattern C forbids module-scope
 * mutable state repo-wide - "a module-scope let is a singleton with no owner" - and
 * `test/store.test.mjs:212-222` asserts it over all of `src/`. A `const` Map keyed by
 * its input is the shape base.js already uses for exactly this job
 * (`base.js:587 const sheetCache = new Map()`), so this follows the tree rather than
 * inventing a second spelling.
 */
const fallbackSheets = new WeakMap();

/**
 * The fragment as one constructed `CSSStyleSheet` - so `adoptSeams` is idempotent by
 * object identity in every root it is called on.
 *
 * Lit's `CSSResult.styleSheet` already constructs and caches one where
 * `adoptedStyleSheets` is supported, and that cache is what makes the identity stable
 * on the normal path: `seams.styleSheet === seams.styleSheet`. The WeakMap covers
 * only the engine where the getter yields nothing, rather than handing `undefined` to
 * the merge or minting a fresh sheet on every call.
 */
export function seamStyleSheet() {
    const own = seams.styleSheet;
    if (own) return own;

    let fallback = fallbackSheets.get(seams);
    if (!fallback) {
        fallback = new CSSStyleSheet();
        fallback.replaceSync(seams.cssText);
        fallbackSheets.set(seams, fallback);
    }
    return fallback;
}

/**
 * Adopt the fragment into a root Lit does not own - the document, the gallery, a
 * hand-attached shadow root. A component with `static styles = [seams, ...]` needs
 * none of this.
 *
 * Merges rather than assigns (`adoptStyleSheet` from base.js), so it cannot clobber
 * whatever else is adopted there, and it is safe to call on every update.
 */
export function adoptSeams(root = document) {
    adoptStyleSheet(root, seamStyleSheet());
    return root;
}
