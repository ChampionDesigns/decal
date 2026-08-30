/**
 * ui-list-row.js - component #26 of the 57-component inventory: THE LIST ROW.
 *
 * Wave 2, item #26 (SCOPE Part 4, "Wave 2 - controls with a state model, and small
 * compounds of Wave 1", L1545). No data layer, no endpoint, no import from src/data/
 * or src/stores/: the title, the provenance string, the favourite disc and the
 * selected flag all arrive from outside, and the row emits one event back.
 *
 * WHAT THE ROW SAYS, verbatim
 *   SCOPE L1545: "List row | Title + provenance badge + favourite disc + overflow
 *   affordance. Never existed (DECISIONS.md:251); currently built TWICE in JS with
 *   byte-identical class strings, and an affordance added to one copy never reached
 *   the other (P6) - the exact failure a single component makes impossible. | medium
 *   | #1, #12".  DECISIONS.md:250-251 lists it among the "component library
 *   primitives that never existed: slider, tile, confirm dialog, nav row, list row,
 *   toast".
 *
 * THE BUG THIS COMPONENT EXISTS TO KILL - P6, LAYOUT_SPEC_DRAFT.md:1135
 *   "The profile row is implemented twice (177 and 126 lines, byte-identical class
 *    strings) - and the module's own comment records the cost: the affordance added
 *    to the first never reached the second."
 *    (profile_selector.js:756-932 renderProfileItem, :1334-1459 renderFilteredItem)
 *   Slate's own comment at profile_selector.js:1400-1404, read read-only, is the
 *   confession: "THE SAME MENU AS THE UNFILTERED LIST. This row is built by a second
 *   renderer, and the visible affordance added to the first one never reached it - so
 *   hide/favourite/rename/delete were a long-press secret again the moment you typed
 *   in the search box, which is exactly when a user is hunting for a profile to act
 *   on."
 *
 *   HOW IT BECOMES INEXPRESSIBLE HERE, and it is structural rather than careful:
 *   there is ONE class, ONE shadow template and ONE stylesheet, so "the filtered list"
 *   and "the unfiltered list" are the same twelve lines of markup. A screen cannot
 *   have a second copy to forget, because a screen no longer owns the row's markup at
 *   all - it owns a tag name. Two lists therefore CANNOT DISAGREE about what a row is:
 *   whatever the row draws, it draws in every list, and whatever a screen slots into
 *   `slot="actions"` it slots through one placement rule that lives here. The
 *   rendering suite builds rows by four different routes (declarative markup,
 *   createElement + properties, cloneNode, innerHTML) and asserts all four produce a
 *   byte-identical row that literally shares one CSSStyleSheet object and one
 *   constructor - which is the mechanical form of "the defect cannot be expressed".
 *
 *   NOTE, 30 August 2026 (audit D11): this argument USED to rest on the row's own
 *   built-in overflow affordance - "the affordance is therefore rendered by THIS file
 *   and is present on every row by construction". That affordance is gone (see THE
 *   AMPUTATION below) and the argument did not need it: one component is what makes
 *   the divergence inexpressible, not one particular child of it.
 *
 * MEASURED STARTING VALUES - every one an oracle answer, quoted verbatim.
 * (prov_query.py, prov-baseline (dark) and prov-light; state profile-selector, the
 * only one of the 49 that renders this row. [i=21] is a row, [i=22] its title span,
 * [i=23] its overflow affordance, [i=6] the grid the list sits on.)
 *
 * [i=23]'S READINGS ARE KEPT AS PROVENANCE AND ARE NO LONGER ASSERTED. The row drew
 * its own overflow affordance until 30 August 2026; the amputation (D11, below) took
 * the paint rules with it, and the readings below are what those rules reproduced.
 * They are retained because a future row action - slotted or built-in - inherits the
 * same geometry question, and because deleting a measurement deletes the only record
 * of what Slate actually did.
 *
 *   THE ROW
 *     CITE profile-selector .p-3 [i=21] height = 64px  <-  slate-shell.css
 *          `#subpage-host .profile-selector-bg #profile-list > *, #subpage-host
 *          #profile-editor-grid #profile-list > *` authored `var(--slate-list-row)`
 *          !important=no (token-driven)
 *     CITE profile-selector .p-3 [i=21] min-height = 64px  <-  same rule, same token
 *     CITE profile-selector .p-3 [i=21] padding-left = 24px  <-  slate-shell.css
 *          `#subpage-host #profile-editor-grid #profile-list > *, ...` authored `24px`
 *          !important=no (FROZEN/hardcoded)
 *     CITE profile-selector .p-3 [i=21] font-size = 20px  <-  slate-shell.css
 *          `#subpage-host #profile-editor-grid #profile-list > *, ...` authored
 *          `var(--slate-text-lg)` !important=yes (token-driven)
 *     CITE profile-selector .p-3 [i=21] font-weight = 400  <-  same rule, authored
 *          `400` !important=yes (FROZEN/hardcoded)
 *     CITE profile-selector .p-3 [i=21] color: dark rgb(244, 247, 248) / light
 *          rgb(23, 26, 28)  <-  app.css `.text-\[var\(--text-primary\)\]` authored
 *          `var(--text-primary)` !important=no (token-driven)   [= --ui-text, exact:
 *          styles/tokens.css:726 #171a1c / :847 #f4f7f8]
 *     CITE profile-selector .p-3 [i=21] background-color = rgba(0, 0, 0, 0)  <-  (no
 *          declaration - inherited or initial value)  - see THE GROUND below
 *     CITE profile-selector .p-3 [i=21] box-shadow = none  <-  (no declaration)
 *     CITE profile-selector .p-3 [i=21] border-top-left-radius = 0px  <-
 *          slate-shell.css authored `0px` (FROZEN/hardcoded) - rows touch, so the
 *          corners are square; the initial value already is 0 and nothing declares it
 *     CITE profile-selector .p-3 [i=21] border-top-color: dark rgb(58, 72, 82) /
 *          light rgb(203, 208, 211)  <-  slate-shell.css `#subpage-host
 *          #profile-editor-grid #profile-list > * + *, ...` authored `(NOT CAPTURED -
 *          set via a CSS shorthand)` !important=no (token-driven)   [= --ui-line,
 *          exact: tokens.css:730 #cbd0d3 / :851 #3a4852]  - see THE SEPARATOR below
 *
 *   THE TITLE
 *     CITE profile-selector <span> [i=22] font-size = 20px  <-  (no declaration -
 *          inherited or initial value)  - inherited from the row's own 20px
 *     CITE profile-selector <span> [i=22] height = 30px  <-  (no declaration) - the
 *          line box: 20px x the 1.5 Slate inherits from Tailwind's preflight, which
 *          Decal declares once in styles/document.css:64. Nothing is declared here.
 *     CITE profile-selector <span> [i=22] font-weight = 400  <-  (no declaration)
 *
 *   THE OVERFLOW AFFORDANCE
 *     CITE profile-selector .slate-profile-more [i=23] width = 64px  <-  slate-shell.css
 *          `#subpage-host #profile-list .slate-profile-more` authored
 *          `var(--slate-control-height)` !important=no (token-driven)
 *     CITE profile-selector .slate-profile-more [i=23] height = 64px  <-  same
 *     CITE profile-selector .slate-profile-more [i=23] font-size = 28px  <-  same rule,
 *          authored `var(--slate-text-xl)` !important=no (token-driven)
 *     CITE profile-selector .slate-profile-more [i=23] border-top-left-radius = 6px  <-
 *          same rule, authored `(NOT CAPTURED - set via a CSS shorthand)`; the
 *          shorthand is slate-shell.css:286 `border-radius: var(--slate-radius)`, read
 *          read-only because the corpus cannot name a token behind a shorthand
 *     CITE profile-selector .slate-profile-more [i=23] border-top-width = 0px  <-  same
 *          rule, authored `0px` !important=no (FROZEN/hardcoded)
 *     CITE profile-selector .slate-profile-more [i=23] background-color = rgba(0, 0, 0, 0)
 *          <-  same rule, authored `transparent` !important=no (FROZEN/hardcoded)
 *     CITE profile-selector .slate-profile-more [i=23] color: dark rgb(148, 161, 169) /
 *          light rgb(90, 101, 108)  <-  slate-shell.css `#subpage-host #profile-list
 *          .slate-profile-more` authored `var(--slate-muted)` !important=no
 *          (token-driven)   [= --ui-muted, exact: tokens.css:728 #5a656c / :849 #94a1a9]
 *     The affordance is 64x64, so it clears --ui-hit-min (48px) on both axes with its
 *     paint alone and needs no hit-area overlay (CONVENTIONS §5: the overlay is for a
 *     leaf whose INK is smaller than the floor).
 *
 *   THE GROUND, and why this row paints one where Slate's painted none.
 *     The row measures transparent, and what shows through it is the selector's grid:
 *     CITE profile-selector #profile-editor-grid [i=6] background-color = rgb(14, 19, 23)
 *          <-  slate-shell.css `#subpage-host #profile-editor-grid` authored `(NOT
 *          CAPTURED - set via a CSS shorthand)` !important=no (token-driven)
 *     CITE profile-selector [prov-light] #profile-editor-grid [i=6] background-color =
 *          rgb(242, 243, 243)  <-  same rule
 *     rgb(14,19,23) / rgb(242,243,243) IS --ui-fascia exactly (tokens.css:720 #f2f3f3,
 *     :841 #0e1317), so painting --ui-fascia on the row reproduces the measured pixel
 *     where Slate puts it. It is declared rather than inherited because CONVENTIONS
 *     §13 trap 1 is not survivable otherwise: "A cell that paints nothing is a hole -
 *     the ground shows through everything not painted over it, so a seamed grid of
 *     transparent cells is a slab of divider colour", and §13's own table says "a cell
 *     that is a component paints itself". A list of these rows in a `.seam-grid
 *     .seam-rows .seam-line` container is the shape that replaces the separator below.
 *     Recorded as a deliberate departure.
 *
 *   THE SEPARATOR IS NOT DRAWN HERE, and that is CONVENTIONS §13.
 *     Slate draws it per row - `#profile-list > * + * { border-top: 1px solid
 *     var(--slate-line) }` - which is the `> * + *` shape §13 retires: "a divider is a
 *     gap, not a border ... a gap needs no sibling selector, so N cells give N-1
 *     seams". The ink is unchanged (--ui-line, the CITE above); the drawer moves to
 *     whatever lays the rows out. This component declares no border of any kind, and
 *     the suite asserts border-top-width stays 0 on every row including the first.
 *
 * THE FOUR SELECTION DIALS ARE THE ONLY SELECTION TREATMENT (CONVENTIONS §4, spec
 * §3.9, this wave's founding-defect callout).
 *   The oracle is DISQUALIFIED for this row's selected paint on two independent
 *   grounds and the disqualification check (Part 10 §4) was run first:
 *     (a) a DECISION settles it differently - spec §3.9 / Appendix 11's four dials,
 *         and the wave law that no component may own a private selected look;
 *     (b) the element is on the 140 layout bugs - P11, LAYOUT_SPEC_DRAFT.md:1140:
 *         "Selecting a profile toggles three classes that cannot paint"
 *         (profile_selector.js:832, 923, 959, 1446 vs slate-shell.css:304-311).
 *   What Slate actually paints on a selected row, read read-only, is THREE private
 *   expressions on top of each other:
 *       slate-shell.css:304-311  background: var(--slate-key-on) !important;
 *                                color: var(--slate-text) !important;
 *                                box-shadow: inset 0 -1px color-mix(...steel 72%...);
 *                                font-weight: 500;
 *       slate-shell.css:579-596  background-color: var(--slate-key-on) !important;
 *                                font-weight: var(--slate-weight-medium) !important;
 *                                plus a ::before leading bar of var(--slate-steel) at
 *                                var(--slate-toggle-indicator-height)
 *   - a face that is not the face dial, a weight change, and a hand-drawn LED bar, all
 *   won with !important because three sheets could reach the same element. None of it
 *   survives: this component paints selection ONLY from --ui-selected-face /
 *   --ui-selected-ink / --ui-selected-led / --ui-selected-glow, through the shared
 *   `selectionSurface` fragment, and the suite compares every painted property of a
 *   selected row against an unselected one and asserts the ONLY differences are the
 *   four the fragment writes. A fifth would fail the test rather than ship.
 *
 *   THE STATE IS THE ARIA STATE (spec Appendix 15, `slate-components.css:389-392`).
 *   `selected` reflects to `aria-selected="true"/"false"` through a converter, so
 *   accessibility state and visual state are one state and cannot drift, and a screen
 *   that writes the Slate spelling `aria-selected="true"` selects the row exactly as a
 *   screen that sets `.selected = true` does. THE ROW STATES NO ROLE OF ITS OWN - the
 *   list that owns the pattern owns the role. See departure 7.
 *
 * DELIBERATE DEPARTURES, each declared in this wave's expected-changes manifest and
 * each asserted as a departure in test/render/ui-list-row.render.test.mjs:
 *   1. THE ROW PAINTS ITS OWN GROUND (--ui-fascia) where Slate's was transparent. Same
 *      rendered colour where Slate puts it; see THE GROUND above.
 *   2. NO PER-ROW SEPARATOR. The 1px --ui-line top border becomes the container's gap
 *      (CONVENTIONS §13). Same ink, N-1 lines instead of N-1 borders, and bug T2's
 *      shape ("the `> * + *` half of the rule can never match") cannot recur.
 *   3. SELECTION LOSES THE WEIGHT CHANGE AND THE LEADING BAR. Slate bolds the title to
 *      500 and draws a 4px steel bar; both are private selected looks. The LED dial is
 *      the sanctioned expression of a bar and Slate ships it at 0px, so on Slate's own
 *      dials the selected row is a solid --ui-selected-face block with no bar - which
 *      is the same call the token sheet already recorded for the Settings nav
 *      (base.js: "the Settings nav's own 4px LED was steel-at-72% drawn ON a steel
 *      face - invisible before and absent after").
 *   4. THE TITLE ELLIPSISES. Slate's title span has no overflow treatment because at a
 *      frozen 1920x1200 it never meets a narrow container. The oracle is DISQUALIFIED
 *      for responsive behaviour (Part 10 §4) and LAYOUT_SPEC_DRAFT.md governs: the
 *      title clamps to the row and ellipsises rather than shoving a slotted control
 *      off the end. One line, always - a list row that wraps stops being a row.
 *   5. THE PROVENANCE BADGE KEEPS THE BADGE TREATMENT. slate-shell.css:313-321 reaches
 *      into the row and repaints the badge as a pipe-separated span - `padding: 0 0 0
 *      9px !important; border-left: 1px solid var(--slate-line-strong);
 *      background: transparent !important; font-size: var(--slate-text-sm)
 *      !important` - which is bug P8's mechanism (a screen sheet reaching a library
 *      element). Nothing can reach into a shadow root, so the badge is a ui-badge and
 *      looks like one. This is the architecture working, not a style choice.
 *   6. THE ROW DRAWS NO ROW-ACTIONS CONTROL AT ALL. Slate's `.slate-profile-more` has
 *      no counterpart here: a screen that wants row actions slots its own trigger into
 *      `slot="actions"` and the row places it. This departure REPLACES the original
 *      one ("the overflow affordance is the row's own control, not a composed #2 icon
 *      button") on 30 August 2026 - see THE AMPUTATION below for why, and WHY NOT
 *      ui-icon-button for the reason a slotted control is still the right shape.
 *   7. NO DEFAULT `role="option"`. Slate sets one (profile_selector.js:784) and this
 *      component used to carry it forward. It does not any more, because the source is
 *      DISQUALIFIED: that line is inside bug P12 (LAYOUT_SPEC_DRAFT.md:1141,
 *      `profile_selector.js:774-786`) - "role=`listbox` with role=`option` divs, no
 *      tabindex, no aria-activedescendant, no keydown handler anywhere in the module -
 *      and NON-OPTION CHILDREN INSIDE THE LISTBOX". A row that carries a real
 *      `<button>` is exactly such a child, so carrying the role reproduces the bug
 *      rather than retiring it, which is prov_query.py's printed disqualification
 *      rule. Since 30 August 2026 the button in question is the one a SCREEN slots
 *      into `slot="actions"` rather than one the row draws itself - the row no longer
 *      forces the question on every list, but it also cannot answer it, because it
 *      does not know what its consumer will slot.
 *      ARIA 1.2 puts `option` on the children-presentational list, i.e. an option's
 *      descendants are not meant to be operable at all. MEASURED in the Gate A engine
 *      (CDP Accessibility.getFullAXTree, asserted in the suite): Chrome does not
 *      actually prune the button - it stays `button "More actions"`, focusable - but
 *      the option's own name USED TO BECOME "Lever Classic demo More actions", so every
 *      row in a twenty-row listbox announced the affordance's name as part of its own.
 *      THAT HALF IS FIXED (29 Aug 2026, audit F-016 #8): a row that has been given a
 *      role now names ITSELF from its own content, so name-from-content never runs and
 *      no affordance folds into it. The suite asserts the conjunction the old
 *      disjunction could not express - option named "Lever Classic demo", a slotted
 *      control named "More actions", both. What is NOT fixed and does not go away is
 *      the tab-stop half: a real `<button>` inside a listbox is still a focusable
 *      non-option child, which is still P12, and is still why `selector-screen` slots
 *      a `<span>` with an `aria-label` and no `tabindex` rather than a button.
 *      Stating `option` remains a decision about the LIST, and the list is the
 *      only thing that knows whether it built a listbox (rows with nothing slotted, or
 *      a non-operable slotted trigger), a grid (rows as `row`, the trigger in a
 *      `gridcell`) or a plain list of links.
 *      So: the row states nothing, a consumer's `role` is left untouched, and
 *      `aria-selected` is still reflected in both states for whichever role arrives.
 *      Recorded as a deferred question - reversing it is one line in
 *      `connectedCallback`.
 *
 * WHY NOT ui-icon-button IN THE ACTIONS SLOT, since the wave law says compose and never
 * re-implement. This block was written when the row drew the affordance itself and
 * asked whether it should compose #2 instead; the amputation did not retire the
 * question, it MOVED it to the consumer, and reason (a) is a measured fact about every
 * press primitive against a selection surface, so it is exactly why a screen's SLOTTED
 * control has the same problem. Two reasons, and the first is measured:
 *   (a) IT CANNOT TAKE THE SELECTED INK. `ui-icon-button` paints `color:
 *       var(--ui-text-2)` inside its own shadow root (ui-icon-button.js:325), so it
 *       does not inherit, and a component may not re-declare a public --ui-* token to
 *       re-theme a child (scripts/guards.js `private-palette`, which is an error).
 *       On a selected row that leaves the glyph at --ui-text-2 on --ui-selected-face:
 *       #3f474c on #315c70 in light and #bac4ca on #b0c4ce in dark - a contrast ratio
 *       near 1, i.e. an affordance that vanishes exactly when the row is the one the
 *       user is acting on. Slate hit this and wrote a rule for it (slate-shell.css:
 *       299-302, "On the selected row the muted grey is nearly the fill it sits on").
 *       The same is true of every wave-1 press primitive - ui-button also declares
 *       `color: var(--ui-text-2)` - so none of them can sit inside a selection
 *       surface today. Recorded as a deferred question for the gate.
 *   (b) SLATE'S OWN LIBRARY DID NOT THINK IT WAS ONE. `.slate-icon-btn` is a
 *       slate-components.css library control and item #2 maps to it; `.slate-profile-more`
 *       is a slate-shell.css control belonging to this row, and row #26's declared
 *       dependencies are #1 and #12 - not #2.
 *   WHAT A SLOTTED CONTROL GETS INSTEAD: inheritance. Slotted content is in the LIGHT
 *   tree, so `color` reaches it from the host through the flattened tree and the ink
 *   dial moves it with the title, with no second colour named anywhere and no rule in
 *   this file. A control that paints its own `color` inside its own shadow root - which
 *   is what (a) is about - opts itself out of that and must solve it itself.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   - NO LIMITS, NO DATA, NO ENDPOINT. `provenance` is a string the caller computed;
 *     this file does not decide when a provenance chip earns its place (Slate's
 *     `showsProvenance(title, parentTitle)` is the screen's rule, profile_selector.js:801).
 *   - NO FAVOURITE DISC IMPLEMENTATION. That is component #35, a parallel row in this
 *     same wave, so depending on it would be a build-order fault. The disc arrives
 *     through `slot="favourite"`; the row owns its placement and the gap and nothing
 *     else. The disc is genuinely optional per row (only some profiles occupy a slot),
 *     which is what makes a slot right here. Since 30 August 2026 the same is true of
 *     row actions: `slot="actions"` is the only route, and it is optional per list.
 *   - NO CLICK-TO-SELECT. The row is a controlled component: `selected` in, events
 *     out. Slate's per-row click handler is what forces every row to walk the whole
 *     list deselecting siblings (profile_selector.js:897-931, twice over); a listbox
 *     owns its selection, and the roving tabindex that bug P12 asks for lives there
 *     too. This row sets no tabindex of its own.
 *   - NO SECOND FOCUS RING. `focus-ring="inset"` is set on connect instead, because a
 *     list row is flush with its neighbours inside a scrolling list and an outset ring
 *     is clipped there - bug L24's class exactly ("focus rings clipped on all four
 *     sides by the components they sit inside"). The base's own
 *     `:host([focus-ring="inset"])` does the work; a consumer can still write
 *     `focus-ring="outset"` and it is honoured, and `focusVariant` reports the truth
 *     either way because the attribute is real. The row has ONE focusable thing of its
 *     own - the host - since the amputation; a control a screen slots brings its own
 *     focus treatment and its own gate-A suite, and this file does not reach into it.
 *   - NO !important, no raw colour literal, no @font-face, no private palette.
 *
 * API
 *   <ui-list-row>Lever Classic demo</ui-list-row>
 *   <ui-list-row aria-selected="true">Power</ui-list-row>        the Slate spelling
 *   <ui-list-row .selected=${true}>Power</ui-list-row>           the Lit spelling
 *   <ui-list-row provenance="from Adaptive v2">Adaptive v3</ui-list-row>
 *   <ui-list-row><span>Title</span><ui-favourite-slot slot="favourite">3</ui-favourite-slot></ui-list-row>
 *   <ui-list-row><span>Title</span><span slot="actions" aria-label="More actions for Power">⋯</span></ui-list-row>
 *       — ROW ACTIONS ARE THE CONSUMER'S. The row places what is slotted and gives it
 *         the gap; it draws no trigger of its own and knows nothing about the menu.
 *
 *   Events: NONE, in either direction.
 *
 * THE AMPUTATION — 30 August 2026, audit D11 (out of F-009, MORNING_REPORT §3.2 #11)
 *
 * The row used to draw its own overflow affordance: a `<button id="overflow">` with
 * `aria-haspopup="menu"`, and a three-attribute API — `no-overflow`, `overflow-label`,
 * `overflow-expanded` — for consumers to suppress and name it. All of it is gone. The
 * chain of four facts that ended it, each one measured rather than argued:
 *
 *   1. Its `overflow` event had no listener anywhere in `src/` (audit F-009, 29 Aug),
 *      so the button announced its press to nobody.
 *   2. Removing the emit left the button INERT: it took a press, let it through to the
 *      list, and went on claiming `aria-haspopup="menu"` about a menu that no longer
 *      arrived.
 *   3. It was rendered NOWHERE IN THE PRODUCT — every `<ui-list-row>` in `src/` passed
 *      `no-overflow`, measured twice (rounds 1 and 2). The one screen with row actions,
 *      `selector-screen`, had always used `slot="actions"`, because a menu positions
 *      itself against its own trigger and an event cannot do that.
 *   4. While rendered, it LEAKED ITS OWN NAME into the row's: an `aria-label`led button
 *      in this shadow root is part of the row's name-from-content walk, so a provenance
 *      row read "Beta bloom Loaded More actions for Beta" with no screen involved.
 *      `#composeRowLabel` fixed the walk; the amputation removes the leak's source.
 *
 * THE THREE ATTRIBUTES REMAIN TOLERATED. Lit observes no property for them now, so a
 * consumer still writing `no-overflow` is INERT, not broken — which is what made this
 * change safe to land before or after its consumers, in either order. `selector-screen`
 * and `settings-bespoke-leaf` have since dropped theirs.
 *
 * WHAT WENT WITH IT: the `.overflow` paint (a grid button, its `(hover: hover)` wash,
 * and `:host([aria-selected="true"]) .overflow { color: inherit }`), the exported
 * `OVERFLOW_GLYPH` (`⋯`, Slate's own, profile_selector.js:886) and
 * `DEFAULT_OVERFLOW_LABEL` (`More actions`), the `overflowControl` getter, and the
 * oracle assertions on [i=23] — whose readings are kept above as provenance, since
 * `slate-shell.css:278-291`/`:293-297`/`:299-302` is not recorded anywhere else.
 *
 * THE ROW NAMES ITSELF, AND THAT IS THE WHOLE OF F-016 #8.
 *
 * A row given a name-from-content role by its list — `option`, `treeitem`, `row` — is
 * named by Chrome from EVERYTHING inside it, and a labelled descendant is part of that.
 * So a row with a named actions affordance reads, in full:
 *
 *     "Alpha bloom Loaded More actions for Alpha bloom"
 *
 * which is the announcement defect the selector already paid for once. That is why the
 * one affordance a screen could name — the `<ui-menu>` trigger it slots into
 * `slot="actions"` — has been `aria-hidden` and therefore NAMELESS since it was built:
 * the screen was choosing between an unnamed control and a polluted row, and neither is
 * acceptable.
 *
 * This row now sets its own `aria-label` from its own content — the title slot, the
 * provenance chip and the favourite slot, in that order, which is EXACTLY the string
 * Chrome composed before — so name-from-content stops and the affordances drop out of
 * it. The name a person hears does not change; what changes is that naming an
 * affordance no longer costs the row its name. `#composeRowLabel` carries the
 * measurement.
 *
 * A consumer that writes its own `aria-label` or `aria-labelledby` keeps it: this only
 * fills a name in where the browser was going to compose one anyway.
 */

import { css, html, nothing } from 'lit';

import { UiElement, selectionSurface } from 'src/components/base.js';
import 'src/components/ui-badge.js';

/**
 * `aria-selected` is a three-valued ARIA attribute and a listbox option is expected to
 * carry it in BOTH states, so `toAttribute` never returns null: an unselected row
 * reflects `aria-selected="false"` exactly as Slate writes it (profile_selector.js:785).
 * One property, one attribute, no second spelling to drift from.
 */
const ARIA_SELECTED = {
    fromAttribute: (value) => value === 'true',
    toAttribute: (value) => (value ? 'true' : 'false'),
};

export class UiListRow extends UiElement {
    static properties = {
        /**
         * Selected, as the aria state. Reflects to `aria-selected`, which is one of the
         * five spellings `selectionSurface` matches on the host - so the paint and the
         * accessibility state are literally the same attribute (spec Appendix 15).
         */
        selected: { reflect: true, attribute: 'aria-selected', converter: ARIA_SELECTED },
        /** The provenance chip's text. Empty (the default) renders no chip at all. */
        provenance: { type: String },

        /* `no-overflow`, `overflow-label` and `overflow-expanded` WERE DECLARED HERE
         * and were removed on 30 August 2026 (D11 - see THE AMPUTATION in the header).
         *
         * They are deliberately not replaced by anything. Lit only observes attributes
         * it has a property for, so all three are now ordinary unobserved attributes:
         * a consumer that still writes `no-overflow` gets an attribute that sits on the
         * host and does nothing, which is INERT rather than broken. That is what let
         * the component change and its eleven consumer sites land independently, in
         * either order, with no window in which the product was wrong. */
    };

    static styles = [
        css`
            /* THE HOST IS THE ROW. It keeps the base's container-type: inline-size -
             * a row FILLS the column it is in, so there is nothing to opt out of
             * (CONVENTIONS §2), and the container it hosts is the one its own title
             * measures itself against. No @media anywhere in this file.
             *
             * The resting ground is on the host and that is deliberate here, against
             * the general advice, for one mechanical reason: the selected paint lands
             * on the host too, because the host is where the aria state has to be -
             * aria-selected belongs on the element carrying whatever role the list gave
             * it (departure 7). Painting the resting state anywhere else
             * would put the two layers in different boxes. The fragment's
             * :host(:is([aria-selected="true"], ...)) is (0,2,0) against this rule's
             * (0,1,0), so selection wins with no !important (CONVENTIONS §6). */
            :host {
                display: flex;
                align-items: center;
                gap: var(--ui-space-3);

                /* CITE .p-3 [i=21] min-height = 64px <- authored var(--slate-list-row).
                 * A FLOOR, not a height: a row with a two-line title grows rather than
                 * clipping. --ui-list-row is var(--ui-control-h) (tokens.css:226). */
                min-block-size: var(--ui-list-row);

                /* CITE .p-3 [i=21] padding-left = 24px <- authored 24px
                 * (FROZEN/hardcoded) - on the scale as --ui-space-5 (tokens.css:269). */
                padding-inline: var(--ui-space-5);

                background-color: var(--ui-fascia);

                /* THE TYPE IS ON THE ROW, WHICH IS WHERE THE ORACLE MEASURED IT.
                 * CITE .p-3 [i=21] font-size = 20px <- authored var(--slate-text-lg),
                 * CITE .p-3 [i=21] font-weight = 400 <- authored 400  (both !important
                 * in Slate, because three sheets could reach the row); and
                 * CITE <span> [i=22] font-size = 20px <- (no declaration - inherited or
                 * initial value), which is the second half of the same record: Slate
                 * declares the type on the ROW and the title inherits it. Declaring it
                 * here reproduces both readings and hands the same type to a title the
                 * consumer slots as markup rather than as bare text - inheritance
                 * follows the FLATTENED tree, so slotted content takes it too.
                 *
                 * --ui-text-lg is 20px (tokens.css:356) and reproduces the measured
                 * value exactly. Its comment reads "section headings" while
                 * --ui-text-md's reads "nav rows, list rows"; both comments are carried
                 * from slate-tokens.css and the MEASUREMENT is the authority (Part 10
                 * §4), so this row takes 20px. Slate's authored text-[30px] on the same
                 * element is dead - overridden to 20px - and tokens.css:331 retires it
                 * by name.
                 *
                 * No line-height and no font-family: both cross the shadow boundary
                 * from styles/document.css (:38, :64) and restating them would break a
                 * screen's ability to set them locally (CONVENTIONS §11). The 30px line
                 * box the oracle measured on [i=22] is 20 x that document leading. No
                 * color either - CITE [i=21] color <- var(--text-primary) is --ui-text,
                 * which document.css:37 already puts on the document, and NOT declaring
                 * it is what lets --ui-selected-ink reach the title by inheritance when
                 * the host turns selected. */
                font-size: var(--ui-text-lg);
                font-weight: var(--ui-weight-regular);

                /* Outside the oracle's 18-property surface, so read read-only from the
                 * markup: profile_selector.js:775 gives every row cursor-pointer and
                 * no-select, and main.css:333-339 defines .no-select as user-select:
                 * none. A long-press on a wall panel that selects the row's text
                 * instead of opening its menu is the failure this prevents. */
                cursor: pointer;
                user-select: none;
            }

            /* THE LEADING GROUP - title and chip, sharing a baseline.
             * SOURCE profile_selector.js:788, read read-only:
             *   leftSide.className = 'flex items-baseline gap-2 min-w-0'
             * gap-2 is 8px = --ui-space-2. min-inline-size: 0 is what lets the title
             * ellipsise instead of forcing the row wider than its container - a flex
             * item's floor is min-content until it is told otherwise. */
            .lead {
                display: flex;
                flex: 1 1 auto;
                align-items: baseline;
                gap: var(--ui-space-2);
                min-inline-size: 0;
            }

            /* THE TITLE DECLARES NO TYPE AT ALL, and that is the oracle record rather
             * than an omission: CITE <span> [i=22] font-size = 20px, font-weight = 400,
             * height = 30px, all three "<- (no declaration - inherited or initial
             * value)". Everything it needs arrives from the row above it.
             *
             * The four declarations it does carry are DEPARTURE 4, the clamp. The
             * oracle is DISQUALIFIED for responsive behaviour (Part 10 §4) - Slate is
             * frozen at 1920x1200 and its title span has no overflow treatment at all -
             * so LAYOUT_SPEC_DRAFT.md governs: the title ellipsises rather than shoving
             * a slotted control off the end of the row. min-inline-size: 0 is the half
             * that makes it work; a flex item's floor is min-content until it is told
             * otherwise, and without it the row would simply get wider than its
             * container. One line, always - a list row that wraps stops being a row. */
            .title {
                min-inline-size: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* The chip must not be squeezed by a long title: the title ellipsises, the
             * provenance does not. */
            .provenance {
                flex: none;
            }

            /* NEITHER MUST A SLOTTED CONTROL BE SQUEEZED, and this rule is a DEBT OF THE
             * AMPUTATION rather than a new idea. Every non-lead child of this row is
             * flex: none - the provenance chip above, and the deleted affordance before
             * it - because .lead is the designated shrinker (flex: 1 1 auto,
             * min-inline-size: 0) and everything else keeps its size. Slotted content is
             * a flex item of the host too (a slot is display: contents), but it arrived
             * with the initial flex-shrink: 1 and nothing had ever noticed, because the
             * one trailing control the row had was its own and carried flex: none.
             *
             * MEASURED, in the 240px stage the suite already had: a 48px slotted trigger
             * came out 16.6px wide - a third of --ui-hit-min - the moment the affordance
             * that used to sit beside it was deleted. The floor is physical (Appendix 5:
             * "a wet fingertip is about 9mm"), so this is bug P4/L22's exact shape.
             *
             * PLACEMENT, NOT PAINT. This is the one thing a ::slotted rule may say here:
             * the header's line is "the row owns placement and the gap; the control owns
             * its own paint", and refusing to shrink someone else's control is placement.
             * Nothing else about a consumer's control is decided from this file. */
            ::slotted(*) {
                flex: none;
            }

            /* NO PAINT FOR ROW ACTIONS, and no rule reaching a slotted control.
             *
             * The 3,755 characters that used to sit here painted the row's own
             * "overflow" button - the grid cell, its (hover: hover) wash, and the
             * selected-row ink rule - and went with the amputation (D11, 30 August
             * 2026; the header has the four facts and the oracle readings the rules
             * reproduced). What replaced them is nothing, on purpose, in all three
             * parts:
             *
             *   GEOMETRY. The host is a flex row with gap: var(--ui-space-3), and a
             *   slot is display: contents by default, so whatever a consumer slots into
             *   actions becomes a flex item of the row and takes the gap. An empty
             *   slot contributes no flex item at all, which is why a row with no
             *   actions needs no opt-out attribute to look right - it was never the
             *   attribute that removed the gap, it was the absence of a child.
             *
             *   PAINT. A ::slotted() rule here would be this file deciding what a
             *   consumer's control looks like, on a control it did not build and whose
             *   gate-A suite it cannot see. The one thing the row does contribute is
             *   INHERITANCE: color crosses to slotted content through the flattened
             *   tree, so --ui-selected-ink reaches a slotted glyph with no rule and no
             *   second colour named - see WHY NOT ui-icon-button in the header for the
             *   control that opts itself out of that by painting its own.
             *
             *   HIT AREA. --ui-hit-min is the consumer's to clear, on its own control.
             *   The row's contribution is not to squeeze it: the actions slot's flex
             *   item keeps its own basis while the lead group is the one that shrinks
             *   (flex: 1 1 auto, min-inline-size: 0). The suite measures that in a
             *   240px container, which is the case where it could go wrong. */
        `,
        /* STATE FRAGMENT LAST (CONVENTIONS §4 rule 1): selection has to beat the
         * resting paint above it. It is deliberately not wrapped in :where(). */
        selectionSurface,
    ];

    constructor() {
        super();
        this.selected = false;
        this.provenance = '';
    }

    /**
     * THE EMIT WENT ON 29 AUGUST 2026 (F-009); THE AFFORDANCE ITSELF ON 30 AUGUST
     * (D11). The header's THE AMPUTATION section carries the four measured facts and
     * the full list of what was deleted; this note keeps the two behavioural points
     * that a reader looking for a removed handler will want.
     *
     * THE PRESS STILL REACHES THE LIST, and that was never the handler's doing: it was
     * the DELIBERATE ABSENCE of `stopPropagation`. A press on whatever a consumer slots
     * into `actions` bubbles to the list exactly as a press on the old built-in button
     * did, which is how the row a menu acts on gets selected.
     *
     * A MENU ANCHORS TO ITS OWN TRIGGER, which is the thing the retired `overflow`
     * event could not do and the reason no screen ever listened for it. The consumer
     * slots the trigger, so the consumer already holds the element to anchor against;
     * there is nothing for this component to hand it.
     */

    /**
     * THE ROW'S OWN NAME — audit F-016 #8. Composed from exactly the three places
     * Chrome's name-from-content walk reaches when there is no affordance: the title
     * slot, the provenance chip, the favourite slot, in rendered order.
     *
     * MEASURED against `Accessibility.getFullAXTree`, which is the only thing that
     * knows. Four candidate mechanisms were tried on a `role="treeitem"` row before
     * this one, and three of them do NOT work:
     *
     *   `aria-labelledby` from the host to a shadow id — the IDREF does not resolve
     *      across the boundary, so no name at all;
     *   `ariaLabelledByElements` (element reflection, supported here) — accepted
     *      without error and the computed name did not move;
     *   `role="none"` on the labelled affordance — name still absorbed
     *      ("Delta More actions for Delta");
     *   `title=` instead of `aria-label` on the affordance — the row absorbs the
     *      affordance's TEXT instead ("Gamma x"), which is worse, and a tooltip is not
     *      a name a finger on a wall panel can reach.
     *
     * An explicit name on the ROW is what stops the walk, and it is the only thing that
     * does. The string is identical to what the walk produced before, so nothing a
     * person hears changes: `"Alpha Loaded 3"` stays `"Alpha Loaded 3"`. What changes is
     * that `"… More actions for Alpha"` can no longer be appended to it.
     *
     * THIS ALSO CLOSED A LEAK THE COMPONENT HAD ON ITS OWN. The built-in affordance was
     * an `aria-label`led `<button>` in this shadow root, and it was absorbed exactly the
     * same way — a `provenance` row with the affordance rendered read
     * `"Beta bloom Loaded More actions for Beta"` with no screen involved at all. Wave 1
     * never rowed it because every consumer in `src/` passed `no-overflow`. That
     * affordance was deleted on 30 August 2026 (D11), so the leak has no source left;
     * the composition below is unchanged, because the leak a SCREEN can still create by
     * slotting a labelled trigger is the one it was written for.
     */
    #composeRowLabel() {
        const root = this.renderRoot;
        if (!root) return '';
        const slotText = (selector) => (root.querySelector(selector)
            ?.assignedNodes?.({ flatten: true }) ?? [])
            .map((node) => node.textContent ?? '')
            .join(' ');
        /* The actions slot is DELIBERATELY NOT IN THIS LIST: that is the whole of
         * F-016 #8. A trigger slotted there may carry its own name without entering
         * the row's, which is what let the selector name its opener at all. */
        return [
            slotText('slot:not([name])'),
            root.getElementById('provenance')?.textContent ?? '',
            slotText('slot[name="favourite"]'),
        ].join(' ').replace(/\s+/g, ' ').trim();
    }

    /**
     * Write it — but ONLY for a row whose list has given it a role.
     *
     * THE ROLE IS THE WHOLE CONDITION, and it is the precise one. A row with no role is
     * a `generic` box: Chrome computes no name for it, so there is nothing to protect
     * and nothing to pollute. Writing an `aria-label` there would put a name on a
     * generic — which is not a thing ARIA supports and which Chrome then exposes, so an
     * unroled row would start announcing its own title as a container ON TOP of the
     * static text inside it. Measured: with the label written unconditionally, an
     * unroled row read `{role: 'generic', name: 'Lever Classic demo'}` where it had read
     * `{name: ''}` before. Departure 7 says the LIST owns the role; this follows the
     * same line, and only speaks when the list has spoken.
     *
     * A consumer that named the row itself keeps its name. "Itself" is decided by
     * comparing against the last name WE wrote: an `aria-label` this element did not
     * author is a consumer's, and it is left alone from then on. `aria-labelledby` wins
     * outright — a consumer pointing at its own element has said something more specific
     * than this can.
     */
    #applyRowLabel() {
        if (this.hasAttribute('aria-labelledby')) return;
        const written = this.getAttribute('aria-label');
        if (written !== null && written !== this.#rowLabel) return;
        const composed = this.hasAttribute('role') ? this.#composeRowLabel() : '';
        if (composed === this.#rowLabel) return;
        this.#rowLabel = composed;
        if (composed) this.setAttribute('aria-label', composed);
        else this.removeAttribute('aria-label');
    }

    /** The last name this element wrote for itself; see `#applyRowLabel`. */
    #rowLabel = null;

    /**
     * `role` is stated by the LIST, on the host, as a plain attribute — so no Lit
     * update fires when it changes and there is nothing else to hang the recompute on.
     * One filtered observer per row, which costs nothing while nothing mutates.
     */
    #roleWatch = null;

    #onContentChange = () => this.#applyRowLabel();

    /**
     * ONE host attribute, set here and never in the constructor - a custom element
     * constructor must not gain attributes.
     *
     * NO ROLE IS SET. It used to be `role="option"`, carried from Slate
     * (profile_selector.js:784); departure 7 in the header has the full argument and
     * the measurement. The short form: that line is inside bug P12 and its complaint
     * is literally "non-option children inside the listbox", which is what a trigger a
     * screen slots into `actions` is. The list owns the pattern, so the list owns the
     * role - `role="option"`, `role="row"`, or none. The row
     * WATCHES for it rather than stating it, because whether this row names itself
     * depends on whether a name is being computed for it at all - see `#applyRowLabel`.
     *
     * `focus-ring="inset"` is bug L24's remedy in the one line CONVENTIONS §3
     * documents. A list row is flush with its neighbours inside a scrolling list, so an
     * outset ring is clipped top and bottom by the list before it is drawn. Setting the
     * real attribute rather than redeclaring the private property keeps
     * `UiElement#focusVariant` honest and leaves `focus-ring="outset"` available.
     */
    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('focus-ring')) this.setAttribute('focus-ring', 'inset');
        if (!this.#roleWatch) {
            this.#roleWatch = new MutationObserver(() => this.#applyRowLabel());
        }
        this.#roleWatch.observe(this, { attributes: true, attributeFilter: ['role'] });
    }

    disconnectedCallback() {
        this.#roleWatch?.disconnect();
        super.disconnectedCallback?.();
    }

    updated(changed) {
        super.updated?.(changed);
        /* The provenance chip is rendered by US, so a change to it never fires a
         * slotchange — the label has to be recomposed on every update as well as on
         * every content change. All three routes converge on one idempotent write. */
        this.#applyRowLabel();
    }

    render() {
        const provenance = String(this.provenance ?? '').trim();
        return html`
            <div id="lead" class="lead">
                <span id="title" class="title"><slot @slotchange=${this.#onContentChange}></slot></span>
                ${provenance
                    ? html`<ui-badge id="provenance" class="provenance">${provenance}</ui-badge>`
                    : nothing}
            </div>
            <slot name="favourite" @slotchange=${this.#onContentChange}></slot>
            <!-- ROW ACTIONS, AND THE ROW BRINGS NONE OF ITS OWN.
                 A screen that wants them brings a control that already knows how to
                 position itself - a menu anchored to its own trigger - and slots it
                 here. That is the arrangement every screen in this skin actually uses,
                 and it is why the row's own built-in affordance was deleted on 30
                 August 2026: see THE AMPUTATION in the header.
                 WHATEVER IS SLOTTED HERE MAY BE NAMED. It does not reach the row's own
                 accessible name - see #composeRowLabel, which is what made naming the
                 selector's menu trigger possible at all. -->
            <slot name="actions"></slot>
        `;
    }
}

customElements.define('ui-list-row', UiListRow);
