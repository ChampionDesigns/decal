/**
 * ui-nav-row.js - component #24 of the 57-component inventory: THE NAV ROW.
 *
 * Wave 2, item #24 (SCOPE Part 4, "Wave 2 - controls with a state model, and small
 * compounds of Wave 1", L1547). No data layer, no endpoint, no import from src/data/
 * or src/stores/: the label arrives as slotted content, the current flag arrives as an
 * attribute, and the row emits one event back. It decides nothing about routing.
 *
 * WHAT THE ROW SAYS, verbatim
 *   SCOPE L1547: "Nav row | Settings category row. Must consume the real selection
 *   treatment - today the selected row draws a 4px LED it is explicitly not supposed
 *   to, because the removal loses a specificity fight (T5). | small | #3's selection
 *   treatment".  DECISIONS.md:250-251 lists it among the "component library primitives
 *   that never existed: slider, tile, confirm dialog, nav row, list row, toast".
 *
 *   It depends on "#3's selection treatment", NOT on #3 the element. That treatment is
 *   the shared `selectionSurface` fragment in base.js - the same four dials ui-bank
 *   paints from - so this file consumes the fragment directly and imports no sibling
 *   builder's work. Item #25 (the sub-nav row) depends in turn on THIS row, and what it
 *   depends on is the pair of tokens below: --ui-nav-row and --ui-text-nav. Slate's own
 *   comment at slate-shell.css:530-532 is the reason - "Same row height and type size as
 *   the category column - the two read as one navigation surface rather than two lists
 *   that happen to sit side by side."
 *
 * ============================================================================
 * THE THREE BUGS THIS COMPONENT EXISTS TO KILL
 * ============================================================================
 *
 * T5 - LAYOUT_SPEC_DRAFT.md:1181, and this row's headline defect.
 *   "The selected nav row still draws a 4px LED it is explicitly not supposed to,
 *    because the `box-shadow: none` that removes it is not `!important` and the
 *    component's is. The fork dial `--slate-selected-led` is bypassed entirely."
 *    (slate-shell.css:496, :558 vs slate-components.css:262-268)
 *
 *   MEASURED, on this element, so the defect is not a reading of the source:
 *     CITE settings-machine-machine-info #machine-btn [i=9] box-shadow =
 *          rgba(0, 0, 0, 0) 0px -4px 0px 0px inset, color(srgb 0.690196 0.768627
 *          0.807843 / 0.72) 0px -4px 0px 0px inset  <-  slate-components.css
 *          `.slate-nav-selected`  authored `inset 0 calc(-1 *
 *          var(--slate-toggle-indicator-height)) 0 calc(-1 *
 *          var(--slate-toggle-indicator-height) + var(--slate-toggle-indicator-height))
 *          transparent, inset 0 calc(-1 * var(--slate-toggle-indicator-height))
 *          color-mix(in srgb, var(--slate-steel) 72%, transparent)`  !important=yes
 *          (token-driven)
 *   Four pixels of steel-at-72% drawn ON a --slate-selected-face that IS steel: a strip
 *   nobody can see, produced by a rule the sheet next door spent two declarations trying
 *   to remove. styles/tokens.css:129-138 carries that exact reading as the provenance of
 *   --ui-toggle-led, so the 4px survives as a NAMED geometry token and reaches this row
 *   through nothing at all.
 *
 *   HOW IT BECOMES INEXPRESSIBLE HERE, and it is structural rather than careful. T5 is a
 *   specificity fight, and a specificity fight needs two sheets able to reach one
 *   element. Nothing can reach into a shadow root (CONVENTIONS §6), so there is no
 *   fight: the ONE box-shadow on a current nav row is the one `selectionSurface` writes,
 *   and its length is `var(--ui-selected-led)` and nothing else. The suite proves both
 *   halves - moving --ui-selected-led moves the strip, and moving --ui-toggle-led (the
 *   4px, still a token, still 4px) moves NOTHING - and injects the `.slate-nav-selected`
 *   rule itself, at higher specificity with !important on top, to show it cannot land.
 *
 * T3 - LAYOUT_SPEC_DRAFT.md:1179.
 *   "Nav rows are rounded despite `border-radius: 0` in two places - an attribute-
 *    selector rule later in the same file wins. Measured 6px."
 *    (slate-shell.css:1027-1033 vs :464, :534)
 *
 *   MEASURED:
 *     CITE settings-machine-machine-info #machine-btn [i=9] border-top-left-radius =
 *          6px  <-  slate-shell.css  `#subpage-host [class*="rounded-[67.5px]"],
 *          #subpage-host [class*="rounded-[54px]"], #subpage-host
 *          [class*="rounded-full"]:not(.slate-keep-round):not([class*="si` authored
 *          `(NOT CAPTURED - set via a CSS shorthand)`  !important=yes  (token-driven)
 *   The nav button carries Tailwind's `rounded-lg` in the markup (settings.html:30-39,
 *   read read-only), the pill-flattening rule at :1027-1033 matches `[class*="rounded-
 *   lg"]` with !important, and it is written LATER in the same file than both
 *   `border-radius: 0` rules at the same (1,1,0) - so it wins on source order. The
 *   authored intent is square, twice; the render is 6px.
 *
 *   HOW IT BECOMES INEXPRESSIBLE: the row is square because this file says so once, and
 *   because a rule outside the shadow root cannot select the box that draws the corner
 *   however it is spelled. The suite injects the defeating rule verbatim - an
 *   attribute-substring selector with !important - and asserts 0px survives.
 *
 * T2 - LAYOUT_SPEC_DRAFT.md:1178, this row's half of it.
 *   "The sub-category column does not align with the category column: the `> * + *`
 *    half of the rule can never match ... Measured pitch 89 vs 93, 24px out by row 7 -
 *    and the same mistake means the sub-nav has no row separators at all (measured
 *    `box-shadow: none`)."  (slate-shell.css:417-424, 430-434; settings.js:6426)
 *
 *   MEASURED, both halves, on the category column:
 *     CITE settings-machine-machine-info .settings-nav-btn rects = [0,219,260,89]
 *          [0,308,260,89] [0,397,260,89] ... - ten rows, pitch 89
 *          (prov_query.py find --cls settings-nav-btn: 380 elements in 38 states, and
 *          every state has the identical ten rects)
 *     CITE settings-machine-machine-info #accessories-btn [i=11] box-shadow =
 *          rgb(58, 72, 82) 0px 1px 0px 0px inset  <-  slate-shell.css  `#subpage-host
 *          #main-categories-panel ul > li + li .settings-nav-btn, #subpage-host
 *          #sub-categories-panel > * + * .settings-subnav-btn, ...` authored
 *          `inset 0 var(--slate-hairline) 0 var(--slate-line)`  !important=no
 *          (token-driven)
 *   One rule, two columns, and it matches in one of them. The category column is
 *   `ul > li + li` and really has li siblings; the sub-category column is `> * + *` over
 *   a renderer that returns a single `<ul>`, so it has exactly one child and the `+`
 *   never fires. Same rule, so 89 rows against 93 and zero separators in the second
 *   column are ONE mistake with two faces.
 *
 *   HOW IT BECOMES INEXPRESSIBLE, and it takes two mechanisms:
 *     (a) THE PITCH IS A TOKEN, not a rule that has to match. Both nav rows take
 *         --ui-nav-row; a component cannot be 89 in one column and 93 in another
 *         because there is no per-column selector to get right. The suite retargets
 *         --ui-nav-row and asserts every row in two different columns moves together.
 *     (b) THE SEPARATOR IS NOT DRAWN HERE AT ALL. CONVENTIONS §13: "a divider is a gap,
 *         not a border ... a gap needs no sibling selector, so N cells give N-1 seams",
 *         and §13 names T2 by number as the bug that dies there. This component declares
 *         no border and no resting box-shadow of any kind; the ink survives unchanged as
 *         --ui-line on the container's seam gap. The suite asserts the rendered border
 *         width is 0 on every side of every row including the first, so the shape that
 *         produced "zero separators rendered" has nothing left to render.
 *
 * ============================================================================
 * MEASURED STARTING VALUES - every one an oracle answer, quoted verbatim
 * ============================================================================
 * (prov_query.py, prov-baseline (dark) and prov-light; state
 * settings-machine-machine-info. [i=9] #machine-btn is the CURRENT category, [i=11]
 * #accessories-btn and [i=13] #bluetooth-btn are resting ones, [i=6] #left-panel is the
 * ground the transparent rows sit on. The class appears in 38 of the 49 states with
 * identical geometry in every one.)
 *
 *   THE RESTING ROW
 *     CITE settings-machine-machine-info #accessories-btn [i=11] font-size = 22px  <-
 *          slate-shell.css  `#subpage-host .settings-nav-btn`  authored
 *          `var(--slate-text-nav)`  !important=no  (token-driven)   [= --ui-text-nav,
 *          exact: styles/tokens.css:357]
 *     CITE settings-machine-machine-info #accessories-btn [i=11] font-weight = 400  <-
 *          same rule, authored `var(--slate-weight-regular)`  (token-driven)
 *     CITE settings-machine-machine-info #accessories-btn [i=11] color = rgb(148, 161,
 *          169) / [prov-light] rgb(90, 101, 108)  <-  slate-shell.css  `#subpage-host
 *          .settings-nav-btn`  authored `var(--slate-muted)`  !important=yes
 *          (token-driven)   [= --ui-muted, exact: tokens.css:728 #5a656c / :849 #94a1a9]
 *     CITE settings-machine-machine-info #accessories-btn [i=11] background-color =
 *          rgba(0, 0, 0, 0)  <-  slate-shell.css  `#subpage-host .settings-nav-btn`
 *          authored `transparent`  !important=no  (FROZEN/hardcoded)  - see THE GROUND
 *     CITE settings-machine-machine-info #accessories-btn [i=11] padding-left = 24px  <-
 *          slate-shell.css  `#subpage-host .settings-nav-btn`  authored `(NOT CAPTURED
 *          - set via a CSS shorthand)`  (token-driven)   the shorthand is
 *          slate-shell.css:464 `padding: 0 var(--slate-space-5)`, read read-only because
 *          the corpus cannot name a token behind a shorthand   [= --ui-space-5, 24px]
 *     CITE settings-machine-machine-info #accessories-btn [i=11] border-top-width = 0px
 *          <-  app.css  `*, :after, :before`  authored `0px`  (FROZEN/hardcoded)
 *
 *   THE GROUND, and why this row paints one where Slate's row painted none.
 *     CITE settings-machine-machine-info #left-panel [i=6] background-color =
 *          rgb(14, 19, 23) / [prov-light] rgb(242, 243, 243)  <-  slate-shell.css
 *          `#subpage-host #settings-body > #left-panel`  authored `(NOT CAPTURED - set
 *          via a CSS shorthand)`  !important=no  (token-driven)
 *     rgb(14,19,23) / rgb(242,243,243) IS --ui-fascia exactly (tokens.css:720 #f2f3f3,
 *     :841 #0e1317), so painting --ui-fascia on the row reproduces the measured pixel
 *     where Slate puts it. It is declared rather than inherited because CONVENTIONS §13
 *     trap 1 is not survivable otherwise - "A cell that paints nothing is a hole - the
 *     ground shows through everything not painted over it, so a seamed grid of
 *     transparent cells is a slab of divider colour" - and a column of these rows in a
 *     `.seam-grid .seam-rows .seam-line` container is exactly the shape that replaces
 *     the per-row separator T2 broke. Recorded as a deliberate departure.
 *
 *   THE CURRENT ROW - the four dials, measured on this very element.
 *     CITE settings-machine-machine-info #machine-btn [i=9] background-color =
 *          rgb(176, 196, 206) / [prov-light] rgb(49, 92, 112)  <-  slate-shell.css
 *          `#subpage-host .settings-nav-btn.active, ... [aria-current="true"], ...`
 *          authored `var(--slate-selected-face)`  !important=yes  (token-driven)
 *     CITE settings-machine-machine-info #machine-btn [i=9] color = rgb(18, 24, 28) /
 *          [prov-light] rgb(248, 252, 253)  <-  same rule, authored
 *          `var(--slate-selected-ink)`  !important=yes  (token-driven)
 *     Those two readings ARE --ui-selected-face / --ui-selected-ink resolved:
 *     --ui-steel #b0c4ce dark / #315c70 light and --ui-on-steel #12181c / #f8fcfd
 *     (tokens.css:819-820, :856-857, :886-887). The nav row is therefore its own
 *     citation for two of the four dials, independent of the two elements the token
 *     sheet used.
 *     CITE settings-machine-machine-info #machine-btn [i=9] font-weight = 500  <-  same
 *          rule, authored `var(--slate-weight-medium)`  !important=yes  - NOT CARRIED,
 *          see DEPARTURE 4.
 *
 *   THE PITCH IS THE ONE VALUE THE ORACLE DOES NOT DECIDE.
 *     CITE settings-machine-machine-info .settings-nav-btn rects [0,219,260,89]
 *          [0,308,260,89] ... - 89px, ten rows.
 *     DISQUALIFIED on two independent grounds, and the disqualification check
 *     (SCOPE Part 10 §4) was run first: (a) the element is on the 140 layout bugs -
 *     T18, "--slate-nav-row: 89px justifies itself with a derivation that is wrong on
 *     both halves"; (b) a DECISION settles it differently - C4 (accepted),
 *     SCOPE.md:2237: "stop pinning it. --ui-nav-row is DERIVED -
 *     calc(var(--ui-control-h) + 2 * var(--ui-space-3)) = 88px - and the column is a
 *     normal scrolling list, 1fr with its tail free ... a pitch tuned to a row count
 *     breaks the moment a category is added. Categories will be added."
 *     So 89 -> 88, from the token, derived. DEPARTURE 1.
 *
 * ============================================================================
 * THE FOUR SELECTION DIALS ARE THE ONLY SELECTION TREATMENT
 * ============================================================================
 * CONVENTIONS §4, spec §3.9, and this wave's founding-defect callout, which names
 * "the selected states of #24/#25/#52" among the things that "may not own a private
 * selected look".
 *
 * What Slate actually paints on a selected nav row, read read-only, is FOUR expressions
 * of one state stacked on each other:
 *     slate-shell.css:490-499   background-color: var(--slate-selected-face) !important
 *                               color: var(--slate-selected-ink) !important
 *                               box-shadow: none            <- the one WITHOUT !important
 *                               font-weight: var(--slate-weight-medium) !important
 *     slate-shell.css:517-527   a ::before leading bar, left: 0, width:
 *                               var(--slate-selected-led)   <- 0px, so invisible
 *     slate-components.css:262-268  .slate-nav-selected's own !important box-shadow,
 *                               4px of steel-at-72% - the one that WINS (T5)
 * A face and an ink that are the dials, plus a weight change, plus a bar on the leading
 * edge, plus a strip on the bottom edge, of which two render and one of those two is
 * invisible. None of it survives. This component paints selection ONLY from
 * --ui-selected-face / --ui-selected-ink / --ui-selected-led / --ui-selected-glow
 * through the shared `selectionSurface` fragment, and the suite compares every painted
 * property of a current row against a resting one and asserts the ONLY differences are
 * the four the fragment writes. A fifth fails the test rather than shipping.
 *
 * EXACTLY ONE BOX IN THIS COMPONENT CHANGES WHEN THE STATE CHANGES, and it is the
 * button. The host is inert: it paints the ground and nothing else, in either state.
 * That is deliberate and it is what a reviewer should check first - two boxes painting
 * one state is how a second treatment starts, even when both start out identical.
 *
 * ONE CONSEQUENCE OF THE ONE TREATMENT, carried knowingly. Slate's LED dial drove a
 * LEADING bar (slate-shell.css:517-527, `left: 0; width: var(--slate-selected-led)`);
 * `selectionSurface` draws the LED as a BOTTOM inset strip, which is where
 * slate-components.css put it for banks and rows alike. Both are 0px in Slate, so
 * nothing renders either way and no pixel changes today; a fork that turns the dial up
 * gets a bottom strip rather than a left bar, on every selectable surface at once. That
 * is the fragment's call, made in wave 0a, and it is precisely why T5 cannot come back:
 * there is exactly one expression of an LED in the whole skin.
 *
 * THE STATE IS THE ARIA STATE (spec Appendix 15, `slate-components.css:389-392`), AND IT
 * IS ON THE BUTTON.
 *   `aria-current="true"` is rendered onto the internal button, which is both the
 *   element a screen reader announces and the element the paint lands on - so the
 *   accessibility state and the visual state are one attribute on one box and cannot
 *   drift. `aria-current` is the one of the fragment's five spellings that is CORRECT
 *   for navigation ("the current item within a set of related items"), which is why the
 *   property is named `current` rather than `selected`.
 *
 *   The value is the string "true" rather than "page" because that is what the shared
 *   fragment matches (base.js), carried from Slate's own selector list
 *   (`slate-shell.css:492`, `:557`). "page" is the more idiomatic ARIA value and it
 *   would paint nothing at all; it is recorded as a deferred question rather than
 *   settled here, because changing it means changing the one fragment every selectable
 *   surface in the skin reads.
 *
 *   The HOST mirrors the same property as a plain boolean `current` attribute, for a
 *   screen to write and for a container to select on. It is deliberately NOT spelled
 *   `aria-current` there: the host is a role-less generic, so the attribute would be
 *   announced by nothing, and it would ALSO match the fragment's `:host(:is(...))` half
 *   and paint a second, invisible copy of the selected face underneath the button. One
 *   property, two renderings, one painted box.
 *
 *   Bug T15 records what Slate has instead: "selection is class-only with no
 *   aria-current/aria-selected; navigation driven by synthetic .click() so focus never
 *   moves". Here the row IS a real button, so it takes focus by being pressed.
 *
 * ============================================================================
 * DELIBERATE DEPARTURES - each in this wave's expected-changes manifest, each asserted
 * as a departure in test/render/ui-nav-row.render.test.mjs
 * ============================================================================
 *   1. 89px -> 88px, DERIVED. Decision C4, above. Rows lose 1px each and the column's
 *      tail grows 91 -> 101px, which the shell fills by letting the column be 1fr.
 *   2. 6px -> 0px RADIUS. T3's authored intent, rendered for the first time.
 *   3. NO 4px LED ON THE CURRENT ROW. T5. --ui-selected-led is 0px in Slate, so on
 *      Slate's own dials the current row is a solid --ui-selected-face block with no
 *      strip. What is lost is four pixels of steel-at-72% on a steel fill.
 *   4. SELECTION LOSES THE WEIGHT CHANGE. `font-weight: 500 !important` on a selected
 *      row is a private selected look: it is a fifth expression of the same state, it is
 *      not a dial, and a fork cannot turn it off. The face and the ink carry the state,
 *      as they do on every other selectable surface in the skin.
 *   5. NO PER-ROW SEPARATOR. The 1px --ui-line inset shadow becomes the container's seam
 *      gap (CONVENTIONS §13). Same ink, N-1 lines, and T2's `> * + *` shape has nothing
 *      left to fail to match.
 *   6. THE ROW PAINTS ITS OWN GROUND (--ui-fascia) where Slate's was transparent. Same
 *      rendered colour where Slate puts it; see THE GROUND above.
 *   7. FOCUS NO LONGER REPAINTS THE ROW FACE. slate-shell.css:471-475 gives
 *      `:hover, :focus-visible` the same --slate-key face, because Slate's component
 *      ring reached only four classes and a nav row was not one of them (spec §3.6, five
 *      treatments). Here the base's one ring reaches every focusable in the shadow tree,
 *      so focus is the ring and hover is the face - two states, two signals. Hover is
 *      kept, at --ui-key, with the (hover: hover) guard.
 *   8. THE LABEL ELLIPSISES. Slate's nav button has no overflow treatment because at a
 *      frozen 1920x1200 it never meets a narrow container. The oracle is DISQUALIFIED
 *      for responsive behaviour (Part 10 §4) and LAYOUT_SPEC_DRAFT.md governs: the label
 *      clamps to the row rather than widening the column. One line, always.
 *
 * ============================================================================
 * WHAT IS DELIBERATELY NOT HERE
 * ============================================================================
 *   - NO DATA, NO ROUTE, NO ENDPOINT. The row does not know what a settings category is.
 *     It has a label and a current flag, and it says when it was pressed.
 *   - NO SELF-SELECTION. `current` in, event out. A nav COLUMN owns which of its rows is
 *     current, exactly as a listbox owns its selection; a row that deselected its
 *     siblings would have to walk a list it does not own, which is the shape
 *     settings.js:6813 has today and the shape bug T15's synthetic `.click()` comes
 *     from. This row sets no tabindex of its own either - the button is naturally
 *     focusable and a column may impose a roving tabindex over the top.
 *   - NO ROLE ON THE HOST. Slate's markup is `<nav><ul><li><button>`
 *     (settings.html:28-40) and the list semantics belong to the column. A role here
 *     would sit between the `ul` and its `li` and break them.
 *   - NO ICON, NO CHEVRON, NO COUNT. Slate's nav row is a label and nothing else
 *     (settings.html:30-39, one `<span data-i18n-key>` per button). The default slot
 *     takes whatever a screen puts in it and the row lays it out with one gap.
 *   - NO SECOND FOCUS RING. `focus-ring="inset"` is set on connect: a nav row is flush
 *     with its neighbours inside a scrolling column, so an outset ring is clipped by the
 *     column before it is drawn - bug L24's class ("focus rings clipped on all four
 *     sides by the components they sit inside"). A consumer may still ask for
 *     `focus-ring="outset"` and `focusVariant` reports the truth either way.
 *   - NO HIT-AREA OVERLAY. CONVENTIONS §5 keeps the overlay for a leaf whose INK is
 *     smaller than the floor; this row's ink is 88px tall against a --ui-hit-min of 48,
 *     so the paint IS the hit box. The suite measures the rendered box rather than
 *     trusting that sentence - which is bug P4's shape ("a floor the comment claims and
 *     the box does not have").
 *   - NO !important, no raw colour literal, no @font-face, no private palette,
 *     no @media (width...).
 *
 * API
 *   <ui-nav-row>Machine</ui-nav-row>
 *   <ui-nav-row current>Machine</ui-nav-row>
 *   <ui-nav-row disabled>Scale</ui-nav-row>                   dimmed and unpressable
 *   navRow.current = true                                     the Lit spelling
 *
 *   Events: `navigate` - CustomEvent, bubbles, composed, detail { current }, where
 *   `current` is the row's state AT THE MOMENT OF THE PRESS. A column re-rendering its
 *   leaf on every press wants to know it was already the current one; nothing else needs
 *   to be in the event, because the event's target is the row.
 */

import { css, html, nothing } from 'lit';

import { UiElement, selectionSurface } from 'src/components/base.js';

export class UiNavRow extends UiElement {
    static properties = {
        /**
         * The current page in the set. Reflects to a plain `current` attribute on the
         * host and renders `aria-current="true"` onto the button, which is where both
         * the announcement and the paint belong - see THE STATE IS THE ARIA STATE.
         */
        current: { type: Boolean, reflect: true },
        /**
         * Paint only on the host (the base dims from --ui-opacity-disabled); the real
         * `disabled` goes on the real button below, which is what actually refuses the
         * press and leaves the tab order (CONVENTIONS §4).
         *
         * Both spellings are live at once, so the ONE dial has to be stopped from
         * multiplying by itself - see `.row:where(:disabled)` in the styles.
         */
        disabled: { type: Boolean, reflect: true },
    };

    static styles = [
        css`
            /* THE HOST IS THE CELL, AND IT IS INERT.
             *
             * It keeps the base's container-type: inline-size - a nav row FILLS the
             * column it is in, so there is nothing to opt out of (CONVENTIONS §2) - and
             * overrides display, which is the base's only other :host declaration this
             * file touches. A single-child grid is what makes the button stretch to the
             * host in BOTH axes: a column that gives its rows a taller track (a seamed
             * grid with equal rows, say) must not leave a strip of un-painted host at
             * the bottom, because CONVENTIONS §13 trap 1 says the ground shows through
             * everything not painted over it.
             *
             * The ground is declared here as well as on the button for the same reason,
             * one layer further out: if a screen ever puts padding on the host - which
             * it may, the host is the theming escape hatch - the leftover is fascia and
             * not a slab of seam ink. It is the ONLY thing the host paints, and it does
             * not change with the state; the button is the whole selection surface. */
            :host {
                display: grid;

                /* DEPARTURE 1 and decision C4. A FLOOR rather than a height: the label
                 * is one line and never wraps, so every row renders at exactly
                 * --ui-nav-row and the pitch is identical by construction (T2) - but a
                 * consumer who slots something taller gets a taller row instead of a
                 * clipped one. --ui-nav-row is calc((--ui-control-h + 2 * --ui-space-3)
                 * * --ui-density) = 88px (tokens.css:220), DERIVED from the control
                 * height, not tuned to a row count. */
                min-block-size: var(--ui-nav-row);

                /* DEPARTURE 6. CITE #left-panel [i=6] background-color = rgb(14, 19, 23)
                 * / rgb(242, 243, 243) - the ground Slate's transparent row sat on, and
                 * --ui-fascia exactly. */
                background-color: var(--ui-fascia);

                /* No font-family and no line-height: both cross the shadow boundary from
                 * styles/document.css (:38, :64) and restating them would break a
                 * screen's ability to set them locally (CONVENTIONS §11). */
            }

            /* THE ROW IS A REAL BUTTON, which is bug T15's remedy in one line:
             * "navigation driven by synthetic .click() so focus never moves". A button
             * pressed by a finger or by Enter takes focus by itself, gets the base's one
             * focus ring for free (CONVENTIONS §3), and needs no keyboard handling in
             * this file at all.
             *
             * IT IS ALSO THE SELECTION SURFACE. The resting paint is on this class and
             * not on an id, which is CONVENTIONS §4 rule 2 - "An id selector is (1,0,0)
             * and beats every attribute selector in the fragment, so a component that
             * writes #tab { background-color: ... } silently never turns selected". The
             * id is here for tests to query by; the class is what the cascade sees.
             *
             * SOURCE slate-shell.css:459-469, read read-only for the properties outside
             * the corpus's 18-property surface (display, align-items, gap, text-align),
             * token names re-prefixed; every other value carries its CITE in the header:
             *   min-height/height: var(--slate-nav-row); padding: 0 var(--slate-space-5);
             *   gap: var(--slate-space-2); border-radius: 0; background: transparent;
             *   color: var(--slate-muted) !important; font-size: var(--slate-text-nav);
             *   font-weight: var(--slate-weight-regular);
             * plus w-full text-left flex items-center from settings.html:30. */
            .row {
                display: flex;
                align-items: center;
                gap: var(--ui-space-2);
                inline-size: 100%;

                /* THE GRID-ITEM HALF OF DEPARTURE 8, and it is not optional. A grid item
                 * (like a flex item) has an AUTOMATIC minimum size of min-content, and
                 * this button's min-content is the whole label because the label is
                 * nowrap - so without this the button grows to 594px inside a 200px
                 * column and the ellipsis never fires. Measured: the label ran to
                 * x=618 in a row whose right edge was 200. min-inline-size: 0 on the
                 * label alone is not enough; the shrink has to be allowed at both
                 * levels. */
                min-inline-size: 0;

                min-block-size: var(--ui-nav-row);

                /* CITE [i=11] padding-left = 24px, the shorthand slate-shell.css:464
                 * padding: 0 var(--slate-space-5) read read-only. */
                padding-block: 0;
                padding-inline: var(--ui-space-5);

                /* CITE [i=11] border-top-width = 0px. DEPARTURE 5: the 1px --ui-line
                 * separator Slate drew per row with ul > li + li is the CONTAINER's
                 * seam gap now (CONVENTIONS §13), so there is no border here and no
                 * resting box-shadow either - which is the whole of T2's shape gone. */
                border: 0;

                /* DEPARTURE 2, and bug T3. Slate authors this twice
                 * (slate-shell.css:464, :534) and renders 6px both times, because
                 * #subpage-host [class*="rounded-lg"] { border-radius:
                 * var(--slate-radius) !important } at :1027-1033 ties on specificity
                 * and wins on source order. Declared here for the same reason Slate
                 * declared it - rows touch, so the corners are square - and it stays
                 * declared because nothing outside can reach this box to argue. */
                border-radius: 0;

                /* THE GROUND IS ON THE PAINTED BOX, so --ui-selected-face replaces it
                 * rather than sitting on top of a second layer. The fragment's
                 * [aria-current="true"] is (0,1,0) against this rule's (0,1,0) and comes
                 * LATER, so it wins on source order with no !important - which is the
                 * whole of CONVENTIONS §6 in one declaration.
                 * CITE #left-panel [i=6] background-color, see THE GROUND. */
                background-color: var(--ui-fascia);

                /* CITE [i=11] color = rgb(148, 161, 169) / rgb(90, 101, 108) <- authored
                 * var(--slate-muted) !important. The !important is Slate's, and it is
                 * there because three sheets could reach the row; nothing can reach this
                 * one. --ui-selected-ink replaces it the same way the face is replaced,
                 * so the label follows the dial by inheriting from here. */
                color: var(--ui-muted);

                /* CITE [i=11] font-size = 22px <- var(--slate-text-nav) [= --ui-text-nav]
                 * CITE [i=11] font-weight = 400 <- var(--slate-weight-regular)
                 * The markup's own text-[24px] (settings.html:30) is dead - the shell
                 * rule outscores it and the measurement is 22px.
                 * font-family and line-height are inherit rather than declared: the UA
                 * font shorthand on a button resets BOTH to its own 13.33px Arial /
                 * normal, so inheriting is how the document's family and its 1.5 leading
                 * (styles/document.css:38, :64) reach the label. */
                font-family: inherit;
                font-size: var(--ui-text-nav);
                font-weight: var(--ui-weight-regular);
                line-height: inherit;

                /* settings.html:30 text-left, read read-only - outside the corpus's
                 * appearance surface. A UA button centres its label. */
                text-align: start;

                cursor: pointer;
            }

            /* THE DIAL IS APPLIED ONCE. Spec §3.7 settles ONE disabled value, .38, and
             * CONVENTIONS §4 puts it on the base ("Disabled is the other state the base
             * paints"). The base paints BOTH spellings - src/components/base.js:509
             * declares opacity: var(--ui-opacity-disabled) inside
             * :where([disabled], [aria-disabled="true"]) for anything in the shadow
             * tree, and :521 does the same inside
             * :host(:is([disabled], [aria-disabled="true"])) for the host - and this
             * control legitimately carries both, because the disabled property reflects
             * to the host (the paint) while its ?disabled binding goes on the real
             * button (the refusal, render() below).
             * Left alone the two MULTIPLY: MEASURED at BENCH before this
             * rule existed, host opacity 0.38 AND #row opacity 0.38, i.e. .38 x .38 = .144
             * rendered - a row three times fainter than the one dial says, which is spec
             * §3.7's own defect (Slate's three live disabled values) arriving by
             * multiplication instead of by copy-paste. Its sibling #25 measured 0.38/1
             * in the same probe because it already carried this line
             * (ui-subnav-row.js:466), and #3, #12, #15, #21, #35 and #43 carry it too;
             * this row was the only control in the cluster without it.
             *
             * The selector below is (0,1,0) against the base rule's (0,0,0) - the
             * base authors inside :where() precisely so a component can say this in one
             * line with no !important (CONVENTIONS §6). Same spelling as #25, so the two
             * halves of the settings nav cannot drift. */
            .row:where(:disabled) {
                opacity: 1;
                cursor: default;
            }

            /* DEPARTURE 8. The oracle is DISQUALIFIED for responsive behaviour
             * (Part 10 §4): Slate is frozen at 1920x1200 and its nav button has no
             * overflow treatment at all, so LAYOUT_SPEC_DRAFT.md governs. The label
             * clamps to the row and ellipsises rather than widening the column past its
             * track. min-inline-size: 0 is the half that makes it work - a flex item's
             * floor is min-content until it is told otherwise. One line, always. */
            .label {
                flex: 1 1 auto;
                min-inline-size: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* SOURCE slate-shell.css:471-475, read read-only (the corpus records the
             * resting state only, so the oracle is silent on hover):
             *   .settings-nav-btn:hover, :focus-visible { background: var(--slate-key);
             *   color: var(--slate-text) !important }
             * Kept for hover, dropped for focus (DEPARTURE 7: the base's ring is the
             * focus signal), with the (hover: hover) guard the wave-1 press primitives
             * already carry - on a touch panel a sticky :hover leaves the last-pressed
             * control lit, and this is a wall panel. It is a MEDIA FEATURE query, not a
             * width query; the banned thing is @media (width...) (CONVENTIONS §2).
             *
             * THE :not() IS THE INTERESTING PART. Slate needed four more selectors and
             * two more !importants to stop hover repainting the current row
             * (slate-shell.css:501-509: "on a touch panel the row you just tapped keeps
             * :hover, and the generic hover face would repaint it as unselected"). Here
             * the current row is excluded from the hover rule outright, so there is
             * nothing to repaint and nothing to win: one selector, no !important, same
             * outcome, and a resting finger cannot make the current row look unselected.
             *
             * background-COLOR, never the background shorthand: the shorthand resets
             * background-clip and Slate's own sheet documents the 32px slab that cost
             * (slate-live.css:1565-1567). */
            @media (hover: hover) {
                .row:not([aria-current="true"]):hover {
                    background-color: var(--ui-key);
                    color: var(--ui-text);
                }
            }
        `,
        /* STATE FRAGMENT LAST (CONVENTIONS §4 rule 1): selection has to beat the resting
         * paint above it. It is deliberately not wrapped in :where(). This is the ONLY
         * selection treatment in the file, and there is no other one to find. */
        selectionSurface,
    ];

    constructor() {
        super();
        this.current = false;
        this.disabled = false;
    }

    /**
     * One host attribute, set here and never in the constructor - a custom element
     * constructor must not gain attributes.
     *
     * `focus-ring="inset"` is bug L24's remedy in the one line CONVENTIONS §3 documents.
     * A nav row is flush with its neighbours inside a scrolling column, so an outset
     * ring is clipped top and bottom by the column before it is drawn. Setting the real
     * attribute rather than redeclaring the private property keeps `UiElement#
     * focusVariant` honest and leaves `focus-ring="outset"` available to a consumer.
     */
    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('focus-ring')) this.setAttribute('focus-ring', 'inset');
    }

    /** The real control - what a test queries and what a column moves focus to. */
    get control() {
        return this.renderRoot?.querySelector?.('#row') ?? null;
    }

    #onPress = () => {
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { current: this.current },
            bubbles: true,
            composed: true,
        }));
    };

    render() {
        return html`
            <button
                id="row"
                class="row"
                type="button"
                aria-current=${this.current ? 'true' : nothing}
                ?disabled=${this.disabled}
                @click=${this.#onPress}
            ><span id="label" class="label"><slot></slot></span></button>
        `;
    }
}

customElements.define('ui-nav-row', UiNavRow);
