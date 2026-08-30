/**
 * ui-favourite-slot.js - component #35 of the 57-component inventory: THE SQUARE
 * PROFILE SHORTCUT.
 *
 * Wave 2, item #35 (SCOPE Part 4, "Wave 2 - controls with a state model, and small
 * compounds of Wave 1", L1547). Token-only: no data layer, no ReaPrime, no endpoint,
 * no import from src/data/ or src/stores/. A profile arrives as three properties -
 * a number to show, a name to announce, and whether the slot holds anything.
 *
 * WHAT THE ROW SAYS, verbatim
 *   SCOPE L1547: "Favourite slot | The square profile shortcut. Today its geometry
 *   and paint live 1300 lines apart in one sheet and the hit-floor comment is
 *   silently untrue (P4). | small | selection dials, hit-area utility".
 *   ITEMS.json #35 reading list: "LAYOUT_SPEC_DRAFT.md §2.3 and Appendix 5 (the one
 *   shared hit-area utility - ink separate from hit floor; consumed by #15, #23 and
 *   #35 instead of today's three separate copies)" and "§3.9 (selection dials)".
 *   Downstream, recorded because it constrains the API: Wave 4's #36 favourites bank
 *   is "a composition of #3 + #35" (SCOPE L1547 note / ITEMS.json #35 notes), and
 *   spec §4.2's profile-selector component list names the list row's "favourite
 *   disc" - the same disc one size down (slate-shell.css:1693, and its own comment:
 *   "It now inherits .ps-fav-slot wholesale and overrides only the size, so the two
 *   cannot drift apart").
 *
 * ============================================================================
 * BUG P4, WHICH IS THIS ROW'S WHOLE JOB - AND THE MISREADING TO AVOID
 * ============================================================================
 * LAYOUT_SPEC_DRAFT.md §7.3, verbatim:
 *   "P4 | The favourite slots take their GEOMETRY from one rule and their PAINT
 *    from another 1300 lines away; measured 64x64, so --slate-hit-min is silently
 *    not applied where the comment says it is, and the favourites row is 113px
 *    rather than ~96. | slate-shell.css:351-355 + :1666-1677; layout/selector.md V.1"
 *
 * P4 IS NOT "the target is too small". 64 is BIGGER than the 48px floor. Wave 1's
 * item #2 read it that way, the claim was withdrawn in the fix phase, and the
 * misreading was carried forward as still live in five files - the shared one being
 * test/harness/assertions.js:467, whose message says "a floor the comment claims and
 * the box does not have" (waves/1/REPORT.md:146-153, DONE.json carriedForward[0]).
 * That file is a SHARED single-writer file and is not this row's to edit, so the
 * reconciliation is made here, in the one component P4 is actually about, and in its
 * suite: this file's hit-floor test asserts the floor AND, separately, that the token
 * is what sizes the box. Both halves, because P4 is the second one.
 *
 * WHAT P4 ACTUALLY IS, read read-only from the Slate source (both rules are outside
 * the corpus's 18-property appearance surface for width/height provenance, and
 * prov_query.py refuses to guess behind a shorthand, so the mechanism comes from the
 * sheet). TWO rules reach one element, 1300 lines apart, at IDENTICAL specificity
 * (1,1,0) each:
 *
 *     slate-shell.css:351   #subpage-host [id^="assign-fav-btn-"] {
 *                               width: 64px; min-width: 64px;
 *                               height: 64px; min-height: 64px;
 *                               border: 1px solid var(--slate-line);
 *                               border-radius: var(--slate-radius);
 *                               background: var(--slate-key); ... }
 *
 *     slate-shell.css:1666  #subpage-host .ps-fav-slot {
 *                               display: inline-grid; place-items: center;
 *                               width: var(--slate-hit-min);
 *                               height: var(--slate-hit-min);
 *                               border: var(--slate-hairline) solid var(--slate-line-strong);
 *                               border-radius: 50%;
 *                               background: transparent; color: var(--slate-muted); ... }
 *
 * The later rule WINS the tie on source order, so width/height do resolve to
 * var(--slate-hit-min) = 48px - and the box still measures 64x64, because
 * MIN-WIDTH AND MIN-HEIGHT ARE DIFFERENT PROPERTIES and the 64px minimums from 1300
 * lines up clamp the used value back. The token is live, cited, and inert. That is
 * the defect: not a small target, but a dimension with two owners, one of which is
 * invisible from the other (spec §2.3: "One owner per dimension", and its ban on
 * "the same number written in two places").
 *
 * HOW IT BECOMES INEXPRESSIBLE HERE, and it is the architecture rather than care:
 *   - one element, one shadow root, one rule set: geometry and paint are eleven lines
 *     apart in .slot below, not 1300, and nothing outside can add a second rule;
 *   - the box IS the token - inline-size and block-size resolve to --ui-hit-min and
 *     move when it moves (asserted as a drill, which is the honest form of "the
 *     comment is true");
 *   - there is no min-* clamp anywhere in this file, and a document-level
 *     "* { min-inline-size: 64px !important }" cannot reach into the shadow tree.
 *     The suite injects exactly that and watches the box not move.
 *   - the hit floor is the SHARED utility (Appendix 5), so the floor survives even
 *     when a consumer shrinks the ink - the difference between a floor a comment
 *     claims and a floor the box has.
 *
 * ============================================================================
 * MEASURED STARTING VALUES - every one an oracle answer, quoted verbatim
 * ============================================================================
 * (prov_query.py value/find, prov-baseline (dark) + prov-light. Disqualification
 * check first, per SCOPE Part 10 §4: no DECISIONS.md decision touches the favourite
 * slot - grep for "favourite"/"favorite" returns only DECISIONS.md:474-477, about the
 * favourites STORAGE KEY; responsive behaviour has no Slate answer and the layout
 * spec governs; and the element IS on the 140-bug list at P4, so its GEOMETRY is
 * disqualified and only its PAINT is quoted below. That split is the point of the
 * check.)
 *
 *   CITE  prov_query.py find --cls ps-fav-slot -> "found 5 element(s) in 1 state(s)";
 *         profile-selector, rects [207,1112,64,64] [293,1112,64,64] [379,1112,64,64]
 *         [465,1112,64,64] [551,1112,64,64]; "distinct geometries (w x h), all matched
 *         elements: 64 x 64 x5". DISQUALIFIED - this is P4 itself, and the corpus
 *         banner says so on its own: "geometry above is Slate (captured at 1920x1200)
 *         and is FROZEN - quote it as what Slate does, never as Decal's responsive
 *         target". Slots 0-2 are data-occupied="true", slots 3-4 are empty, which is
 *         how both paint states below were measured on one screen.
 *
 *   EMPTY (the resting slot)
 *   CITE  profile-selector #assign-fav-btn-3 [i=170] background-color = rgba(0, 0, 0, 0)
 *         <- slate-shell.css `#subpage-host .ps-fav-slot` authored `transparent`
 *         !important=no (FROZEN/hardcoded)
 *   CITE  profile-selector #assign-fav-btn-3 [i=170] color = rgb(148, 161, 169)
 *         <- slate-shell.css `#subpage-host .ps-fav-slot` authored `var(--slate-muted)`
 *         !important=no (token-driven)   [prov-light: rgb(90, 101, 108); = --ui-muted,
 *         styles/tokens.css:849 #94a1a9 dark / :728 #5a656c light - exact, both themes]
 *   CITE  profile-selector #assign-fav-btn-3 [i=170] border-top-color = rgb(82, 97, 107)
 *         <- slate-shell.css `#subpage-host .ps-fav-slot` authored `(NOT CAPTURED -
 *         set via a CSS shorthand)` !important=no (token-driven)   [prov-light:
 *         rgb(170, 178, 183); the shorthand is slate-shell.css:1671 `border:
 *         var(--slate-hairline) solid var(--slate-line-strong)`; = --ui-line-strong,
 *         styles/tokens.css:852 #52616b dark / :731 #aab2b7 light - exact, both themes]
 *
 *   FILLED (data-occupied="true")
 *   CITE  profile-selector #assign-fav-btn-0 [i=167] background-color = rgb(23, 59, 77)
 *         <- slate-shell.css `#subpage-host .ps-fav-slot[data-occupied="true"]`
 *         authored `(NOT CAPTURED - set via a CSS shorthand)` !important=no
 *         (token-driven)   [prov-light: rgb(35, 79, 99); the shorthand is
 *         slate-shell.css:1681 `background: var(--slate-primary)`; = --ui-primary,
 *         styles/tokens.css:859 #173b4d dark / :752 #234f63 light - exact, both themes]
 *   CITE  profile-selector #assign-fav-btn-0 [i=167] color = rgb(246, 251, 253)
 *         <- slate-shell.css `#subpage-host .ps-fav-slot[data-occupied="true"]`
 *         authored `var(--slate-on-primary)` !important=no (token-driven)
 *         [prov-light: rgb(248, 252, 253); = --ui-on-primary, styles/tokens.css:860
 *         #f6fbfd dark / :753 #f8fcfd light - exact, both themes]
 *   CITE  profile-selector #assign-fav-btn-0 [i=167] border-top-color =
 *         color(srgb 0.258196 0.381804 0.443608) <- slate-shell.css `#subpage-host
 *         .ps-fav-slot[data-occupied="true"]` authored `(NOT CAPTURED - shorthand)`
 *         !important=no (token-driven)   [prov-light: color(srgb 0.152627 0.324078
 *         0.40251); the shorthand is slate-shell.css:1680 `border-color:
 *         color-mix(in srgb, var(--slate-primary) 72%, var(--slate-steel))`, carried
 *         here unchanged - and it reproduces BOTH oracle values to six decimals]
 *
 *   TYPE, both states, both themes
 *   CITE  profile-selector #assign-fav-btn-0 [i=167] font-size = 17px <- slate-shell.css
 *         `#subpage-host .ps-fav-slot` authored `var(--slate-text-base)` !important=no
 *         (token-driven)   (= --ui-text-base, styles/tokens.css:354)
 *   CITE  profile-selector #assign-fav-btn-0 [i=167] font-weight = 500 <- slate-shell.css
 *         `#subpage-host .ps-fav-slot` authored `var(--slate-weight-medium)`
 *         !important=no (token-driven)   (= --ui-weight-medium, styles/tokens.css:371)
 *         [note the 400 in slate-shell.css:361 loses the same source-order tie the
 *          radius wins - one more consequence of the two-rule shape P4 names]
 *   CITE  profile-selector #assign-fav-btn-0 [i=167] box-shadow = none <- (no
 *         declaration - inherited or initial value) (FROZEN/hardcoded)
 *   CITE  profile-selector #assign-fav-btn-0 [i=167] font-family = Geist, system-ui,
 *         sans-serif <- slate-shell.css `body, button, input, select, textarea`
 *         authored `var(--slate-font-ui)` !important=no (token-driven)
 *         (= --ui-font-family, styles/tokens.css:348)
 *   CITE  profile-selector #assign-fav-btn-0 [i=167] letter-spacing = normal,
 *         opacity = 1, text-transform = none
 *   CARVE-OUT, stated because it decides the shape: "prov_query: property not probed:
 *         border-radius". The corpus never measured radius, so the tool "says so
 *         plainly and stops; fall through to reading the Slate source read-only" -
 *         and the source is the P4 pair itself, disagreeing with itself
 *         (slate-shell.css:357 var(--slate-radius) vs :1672 50%, the later winning).
 *         See DEFERRED QUESTIONS below.
 *
 * ============================================================================
 * SELECTION: THE FOUR DIALS, AND NOTHING ELSE (the wave's founding defect)
 * ============================================================================
 * CONVENTIONS §4 / spec §3.9 / DECISIONS.md:239. `selectionSurface` is imported and
 * placed LAST in static styles, and this component paints NO selected colour, border
 * or shadow of its own. That is the whole of the treatment:
 *     --ui-selected-face -> background-color
 *     --ui-selected-ink  -> color, and therefore currentColor
 *     --ui-selected-led  -> an inset box-shadow strip in currentColor
 *     --ui-selected-glow -> a text-shadow mixed toward transparent
 * Slate ships led 0px and glow 0%; Radian moves two values and this file does not
 * change (styles/tokens.css:819-822 and :886-889).
 *
 * OCCUPANCY IS NOT SELECTION, and keeping those two apart is the reason the paint
 * below is routed through private properties instead of a second rule.
 *   - Slate's own comment, slate-shell.css:1663-1665: "The five favourite slots were
 *     pixel-identical whatever they held, so tapping one was a blind overwrite.
 *     Occupancy is now the difference between an outlined slot and a filled one."
 *     That is a real fix and it is kept.
 *   - It is painted from --ui-primary, "the primary action FILL" (styles/tokens.css:752),
 *     which is the polarity ui-switch already states for its ON track: "the oracle
 *     paints its ON track from --slate-primary (the primary-action fill), not from
 *     --slate-selected-face, and the four dials exist for the ONE component that
 *     chooses among alternatives" (ui-switch.js). A filled slot says "something lives
 *     here"; a selected slot says "this one is current". Different facts, different
 *     tokens, and --ui-primary and --ui-selected-face (= --ui-steel) are visibly
 *     different blocks in both themes.
 *   - A slot can be BOTH, and then the dials win: selection is a STATE treatment and
 *     has to beat the resting paint. THAT SENTENCE WAS FALSE FOR ONE OF THE TWO
 *     SELECTION SPELLINGS until fix-phase finding c2-3: `selected` worked (it renders
 *     aria-pressed onto the button, which the fragment's first block matches), but
 *     selection spelled on the HOST - the spelling ACCESSIBILITY promises #36 - was
 *     painted onto a host the disc covers exactly, so a filled+selected slot rendered
 *     pixel-identical to an unselected one. The `:host(:is(...))` block in the styles
 *     is the fix, and it is the same values-not-a-second-rule mechanism as occupancy.
 *
 * THE SPECIFICITY TRAP THIS FILE HAD TO DODGE, stated because the obvious spelling is
 * wrong and it is wrong SILENTLY. `selectionSurface` carries a real (0,1,0) and wins
 * ties on source order. The natural way to write occupancy is ui-button's:
 *     :host([variant="primary"]) .btn { background-color: var(--ui-primary) }   (0,3,0)
 * ui-button can write that because it paints no selection at all. Here the same shape
 * would be (0,3,0) against the fragment's (0,1,0), so a filled AND selected slot would
 * keep its primary fill and silently never turn selected - "precisely how thirteen
 * bypassed selection treatments get written by accident" (base.js, usage rule 2, which
 * makes the same argument about an id). So occupancy sets PRIVATE PROPERTIES on the
 * host and the painted rule stays a bare class:
 *     :host([filled]) { --_ui-fav-slot-face: var(--ui-primary); ... }        (0,2,0)
 *     .slot           { background-color: var(--_ui-fav-slot-face); ... }    (0,1,0)
 * The fragment then beats .slot on source order, exactly as designed, and the value
 * indirection costs nothing. The private names are --_ui-* (CONVENTIONS §7), they
 * reference public tokens and never carry a colour value of their own.
 *
 * THE ONE THING SELECTION DOES NOT REPAINT is the border, because border-color is not
 * one of the four dials. A selected filled slot therefore keeps its occupancy rim over
 * the selected face. Deliberate: adding a fifth dial to fix it is the decay this wave
 * exists to stop, and the rim carries information the face no longer can.
 *
 * ============================================================================
 * THE HIT FLOOR - THE ONE SHARED UTILITY (spec §2.3 case 2, Appendix 5)
 * ============================================================================
 * Appendix 5: "Hit area is separate from ink ... Good patterns; make them ONE utility
 * rather than three copies." CONVENTIONS §5 names the three consumers - #15 keycap,
 * #23 slider, #35 THIS - so `hitArea` is imported and `.hit-overlay` rides on the
 * button, which is a leaf (its two children are spans). --ui-hit-min is 48px because
 * "a wet fingertip is about 9mm" (slate-tokens.css:99-102), and spec §2.3 case 2 names
 * `.ps-fav-slot slate-shell.css:1669-1670` as one of the three places that floor is
 * load-bearing.
 *
 * The ink and the floor are separate knobs, which is what makes the utility do work
 * here rather than tie: --_ui-fav-slot-size sets the INK and defaults to --ui-hit-min,
 * so at rest the disc is exactly the floor; a consumer that needs the smaller disc -
 * spec §4.2's list-row "favourite disc", Slate's .ps-fav-badge at 44px, "the SAME
 * disc, one size down ... so the two cannot drift apart" (slate-shell.css:1685-1692) -
 * sets it to var(--ui-control-sm) and the ::before still holds 48px on both axes.
 *
 * ============================================================================
 * DELIBERATE DEPARTURES (each also asserted as a departure in the suite, and filed in
 * realine-run/waves/2/ledger-src/35-expected-changes.json; departure 6 and the
 * transparent-vs-repainted call it rests on are in 35-fix-expected-changes.json and
 * 35-fix-deferred-questions.json, separate drops so a concurrent writer on the
 * originals cannot lose them)
 * ============================================================================
 *   1. 48x48, NOT 64x64. The measured Slate box is disqualified (it is P4), and the
 *      spec does the arithmetic itself: "the favourites row is 113px (not ~96) because
 *      the slots are 64x64, not 48" (§4.2, "Measured today"). The box is
 *      var(--ui-hit-min), the token Slate's own rule already names.
 *   2. NO min-* CLAMP, ANYWHERE. The clamp is P4's mechanism. inline-size/block-size
 *      are the only dimensions this file declares, so there is one owner per dimension
 *      (§2.3).
 *   3. THE EDGE MIX IS SHARED WITH ui-button, not re-derived: the same
 *      color-mix(in srgb, var(--ui-primary) 72%, var(--ui-steel)) Slate writes at
 *      slate-shell.css:1680 and slate-components.css:175-179. It reproduces both
 *      oracle values exactly, so this is parity rather than a departure - recorded
 *      because the corpus reports it as an uncitable shorthand.
 *   4. NO SHRINK. The oracle is disqualified for responsive behaviour, so §2.2 governs:
 *      "Control heights, touch targets, hairlines | Fixed token. Never fluid ... A
 *      control that shrinks with the window becomes unusable exactly when the window
 *      is small." In a container narrower than the disc the slot OVERFLOWS. Tested.
 *   5. AN ACCESSIBLE NAME. See ACCESSIBILITY.
 *   6. A SELECTED SLOT DROPS ITS OCCUPANCY FILL. Slate has no rendered answer - its
 *      five slots have occupancy but no selected state at all - so this is the wave
 *      law resolving a case the oracle never met: --ui-selected-face replaces
 *      --ui-primary on the face, and the occupancy rim (the 72%/steel edge mix) is the
 *      only thing left saying the slot is full. Fixed as finding c2-3; before it, the
 *      fill won and selection was invisible on the composition path #36 will take.
 *
 * DEFERRED QUESTIONS (filed in realine-run/waves/2/ledger-src/35-deferred-questions.json,
 * plus one in 35-fix-deferred-questions.json)
 *   - TRANSPARENT DISC OR REPAINTED DISC when selection is spelled on the host. The
 *     disc goes transparent so the host's ONE painted surface - face and the inset LED
 *     - shows through it; repainting the disc with --ui-selected-face would make the
 *     assertion tidier and re-hide dial 3. One value, reversible either way.
 *   - DISC OR SQUARE. SCOPE L1547 calls this "the square profile shortcut"; spec §4.2's
 *     component list calls the list-row instance a "favourite DISC"; Slate renders a
 *     circle (slate-shell.css:1672 `border-radius: 50%`, winning the source-order tie
 *     against `var(--slate-radius)` at :357 - and that disagreement is inside P4's own
 *     citation). The corpus never probed border-radius. Shipped as the disc, through
 *     --_ui-fav-slot-radius, so the square is one property away in either direction.
 *   - aria-pressed IS ALWAYS PRESENT (true or false) rather than only when selected.
 *     See ACCESSIBILITY.
 *   - NO CUSTOM ACTIVATION EVENT. The inner control is a real button, so `click`
 *     composes out and retargets to the host; a named event is additive later.
 *
 * ACCESSIBILITY (spec Appendix 15, the aria-*-driven state selectors: "the right
 * contract for a Lit component's reflected properties")
 *   - SELECTION IS THE ARIA STATE, so visual state and accessibility state are the
 *     same state and cannot drift. `selected` is a reflected property and the button
 *     carries aria-pressed. Slate's bank items are the precedent - the fragment's own
 *     oracle citation is a `.slate-bank-item` and the rule list includes
 *     `.slate-bank-item[aria-pressed="true"]` (slate-components.css:389-392).
 *     aria-pressed is emitted as "false" when unselected rather than omitted: a
 *     control that CAN be current should say that it is not, and a bank of slots where
 *     only the current one has a state is the asymmetry screen-reader users notice.
 *     Reversing it is one ternary (deferred question).
 *   - A CONSUMER MAY SPELL IT DIFFERENTLY. #36 composes #3 with this element, and if
 *     the bank puts aria-selected / aria-checked / aria-current on the HOST, the
 *     fragment's :host(:is(...)) block paints the host - so the host carries the same
 *     radius as the disc and the two can never disagree by a square corner. The disc
 *     then has to GET OUT OF THE WAY of that paint rather than sit on top of it, which
 *     is what the styles' own :host(:is(...)) block does: transparent face, dial ink.
 *     Both spellings render the same pixels, asserted property-by-property.
 *   - THE NAME. A disc showing "3" announces as "3, button", which says nothing about
 *     which profile it holds - and the whole point of Slate's occupancy fix is that
 *     the slots are no longer "pixel-identical whatever they held". `label` supplies
 *     the name: the visible mark goes aria-hidden and the name is exposed as visually
 *     hidden text through the SHARED `visuallyHidden` fragment (CONVENTIONS §5a), the
 *     same affordance ui-badge, ui-keycap and ui-locked-value take.
 *   - DISABLED dims through the base's one dial and refuses the press through the
 *     native attribute on the real button; `.slot[disabled] { opacity: 1 }` stops the
 *     dial multiplying by itself (.38 x .38 = .14), exactly as ui-button:228 does.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   - NO DATA LAYER. Wave law: no import from src/data/ or src/stores/, no endpoint.
 *     A favourite's identity, its profile and what a press DOES are the consumer's.
 *   - NO ROW, NO BANK, NO ROVING FOCUS. That is #36 (Wave 4) composing #3 with this.
 *     The 113px-to-~96 half of P4 is the row's arithmetic; what this element owes it
 *     is a 48px box, and the suite asserts a five-slot row is 48 tall rather than 64.
 *   - NO @media, and no container query either - every dimension here is a fixed
 *     ergonomic token by §2.2, so the host opts OUT of container hosting (see styles)
 *     for the same reason ui-keycap does: it must size to its own disc, not to the
 *     slot it sits in.
 *   - NO part() theming surface; theming crosses the boundary through custom
 *     properties only (Part 4 ground rule 1; A6).
 *
 * API
 *   <ui-favourite-slot index="1"></ui-favourite-slot>            an empty slot
 *   <ui-favourite-slot index="1" filled label="Cremina"></ui-favourite-slot>
 *   <ui-favourite-slot index="1" filled selected label="Cremina, current">
 *   <ui-favourite-slot index="1">C</ui-favourite-slot>           slotted mark wins
 *   <ui-favourite-slot disabled index="5"></ui-favourite-slot>
 *   <ui-favourite-slot focus-ring="inset" ...>                   inside overflow:hidden (L24)
 *
 *   CUSTOM PROPERTIES a consumer may set (the only styling surface there is):
 *   --_ui-fav-slot-size    the INK, default var(--ui-hit-min). The hit floor holds at
 *                          --ui-hit-min whatever this says.
 *   --_ui-fav-slot-radius  default var(--ui-radius-pill) - a disc.
 */

import { css, html, nothing } from 'lit';
import { UiElement, hitArea, visuallyHidden, selectionSurface } from 'src/components/base.js';

export class UiFavouriteSlot extends UiElement {
    static properties = {
        /** The 1-based number the disc shows when nothing is slotted. 0 shows nothing. */
        index: { type: Number },
        /** Accessible name - the profile the slot holds, or "Favourite 3, empty". */
        label: { type: String },
        /** Occupancy: "an outlined slot or a filled one". NOT selection. */
        filled: { type: Boolean, reflect: true },
        /** Selection, painted by the four dials and nothing else. */
        selected: { type: Boolean, reflect: true },
        /** Paint dims (base) and the press is refused (native attribute). */
        disabled: { type: Boolean, reflect: true },
    };

    /* STRUCTURAL FRAGMENTS FIRST, STATE FRAGMENT LAST (CONVENTIONS §4 rule 1, §5).
     * selectionSurface must be able to win a source-order tie against .slot. */
    static styles = [hitArea, visuallyHidden, css`
        /* CONTAINER-HOSTING OPT-OUT, the one-liner CONVENTIONS §2 documents. Nothing
         * in this file is size-keyed, so no container is needed for queries; what the
         * opt-out buys is that inline-size containment cannot freeze the disc at the
         * width of the slot it sits in. Departure 4 - a control that shrinks with the
         * window becomes unusable exactly when the window is small (§2.2) - depends
         * on it. */
        :host {
            container-type: normal;
            display: inline-grid;

            /* If a consumer spells selection on the HOST (a bank putting
             * aria-selected there), the fragment paints the host: same radius, so the
             * paint can never appear as a square behind a round disc. */
            border-radius: var(--_ui-fav-slot-radius, var(--ui-radius-pill));

            /* OCCUPANCY AS VALUES, NOT AS A SECOND RULE - see THE SPECIFICITY TRAP in
             * the header. Private (--_ui-), referencing public tokens, never carrying
             * a colour of their own (CONVENTIONS §7). */
            --_ui-fav-slot-face: transparent;
            --_ui-fav-slot-ink: var(--ui-muted);
            --_ui-fav-slot-edge: var(--ui-line-strong);
        }

        /* "Occupancy is now the difference between an outlined slot and a filled one"
         * (slate-shell.css:1663-1665). The three values are the oracle's, exactly:
         * --ui-primary, --ui-on-primary, and Slate's own 72%/steel edge mix. */
        :host([filled]) {
            --_ui-fav-slot-face: var(--ui-primary);
            --_ui-fav-slot-ink: var(--ui-on-primary);
            --_ui-fav-slot-edge: color-mix(in srgb, var(--ui-primary) 72%, var(--ui-steel));
        }

        /* SELECTION SPELLED ON THE HOST GETS OUT OF THE DIALS' WAY. Same mechanism as
         * occupancy above - values, not a second rule - and it declares no colour of its
         * own, only the ink dial and the ABSENCE of a resting face.
         *
         * WHY IT IS NEEDED, and it is a real defect rather than a tidy-up (fix-phase
         * finding c2-3). This component has two selection spellings and only one of them
         * worked. The selected property reflects AND renders aria-pressed onto the
         * button, so selectionSurface's first block matches #slot directly and the disc
         * turns selected: MEASURED at BENCH, a filled+selected slot painted its disc
         * background rgb(176, 196, 206) = --ui-selected-face, ink rgb(18, 24, 28) =
         * --ui-selected-ink. The OTHER spelling is the one ACCESSIBILITY promises #36
         * ("if the bank puts aria-selected / aria-checked / aria-current on the HOST,
         * the fragment's :host(:is(...)) block paints the host"), and it did not reach
         * the disc at all, because the host is display: inline-grid sized to the disc
         * and .slot's own background-color and color sit on top of everything the
         * fragment paints. MEASURED at BENCH before this block existed:
         *   <ui-favourite-slot filled aria-selected="true">  host bg rgb(176, 196, 206)
         *     but disc bg rgb(23, 59, 77) (= --ui-primary) and ink rgb(246, 251, 253)
         *     - i.e. pixel-identical to an UNSELECTED filled slot, on a 48x48 host the
         *     disc covers exactly. Dial 1 hidden.
         *   <ui-favourite-slot aria-selected="true">  host bg rgb(176, 196, 206), disc
         *     bg transparent (so the face DID show) but ink rgb(148, 161, 169) =
         *     --ui-muted on a steel face, ~1.5:1. Dial 2 dead.
         * That falsifies the header's own "A slot can be BOTH, and then the dials win",
         * and it is the founding defect's exact shape: a component's private resting
         * paint quietly beating the one selection treatment (Part 10 §12, spec §3.9).
         *
         * FACE IS SET TO TRANSPARENT RATHER THAN TO --ui-selected-face, deliberately.
         * The host and the disc are the SAME BOX at the same radius, and the fragment
         * has already painted the host with all four dials; a transparent disc lets that
         * one painted surface through - face, and the inset LED, which an opaque disc
         * would cover even if it were painted the same colour. text-shadow inherits
         * across the shadow boundary, so the glow reaches the mark either way. The
         * result is that BOTH spellings render the same pixels, which the suite asserts
         * property-by-property rather than trusting.
         *
         * The selector list is selectionSurface's own :host(:is(...)) list, character
         * for character (base.js), so the two can never disagree about what "selected on
         * the host" means. (0,2,0), the same weight as :host([filled]) and AFTER it in
         * source order, which is what makes selection beat occupancy - the tie is
         * intentional and the order is the whole mechanism (CONVENTIONS §4 rule 1).
         *
         * The BORDER is untouched here, exactly as the header says: border-color is not
         * one of the four dials, so a selected filled slot keeps its occupancy rim over
         * the selected face and the rim carries information the face no longer can. */
        :host(:is(
            [aria-pressed="true"],
            [aria-selected="true"],
            [aria-checked="true"],
            [aria-current="true"],
            [selected]
        )) {
            --_ui-fav-slot-face: transparent;
            --_ui-fav-slot-ink: var(--ui-selected-ink);
        }

        /* THE DISC. Geometry and paint in ONE rule, in one shadow root, which is the
         * whole of P4's remedy - Slate's two rules are 1300 lines apart in one sheet
         * and cannot see each other.
         *
         * PAINTED BY CLASS, never by id and never on :host (CONVENTIONS §4 rule 2):
         * an id is (1,0,0) and the host is reachable from a document sheet, and either
         * one silently defeats the selection fragment. */
        .slot {
            display: inline-grid;
            place-items: center;

            /* THE BOX IS THE TOKEN. No min-inline-size, no min-block-size: P4 is a
             * dimension with two owners, and this is the only rule that owns it. */
            inline-size: var(--_ui-fav-slot-size, var(--ui-hit-min));
            block-size: var(--_ui-fav-slot-size, var(--ui-hit-min));
            padding: 0;

            border: var(--ui-border-w) solid var(--_ui-fav-slot-edge);
            border-radius: var(--_ui-fav-slot-radius, var(--ui-radius-pill));
            background-color: var(--_ui-fav-slot-face);
            color: var(--_ui-fav-slot-ink);

            /* A button does not inherit type from the document - the UA sets its own
             * family and size - so these three are declared rather than restated
             * (CONVENTIONS §11). One family, not two (styles/tokens.css:346-347). */
            font-family: var(--ui-font-family);
            font-size: var(--ui-text-base);
            font-weight: var(--ui-weight-medium);

            cursor: pointer;
        }

        /* THE DIAL IS APPLIED ONCE - the base paints both spellings of disabled and
         * this control legitimately carries both (the host attribute is the paint, the
         * native attribute on the real button is the refusal). Without this the two
         * multiply and .38 x .38 renders at .14. Bare (0,2,0), no !important
         * (CONVENTIONS §6), and it declares nothing the selection fragment declares. */
        .slot[disabled] {
            opacity: 1;
            cursor: default;
        }

        /* The mark's own box, so the label property has something to hide and the
         * suite has something stable to query. Not a paint surface.
         * (No backticks in here - CONVENTIONS §9, and this file paid the toll.) */
        .mark {
            display: block;
        }
    `, selectionSurface];

    constructor() {
        super();
        this.index = 0;
        this.label = '';
        this.filled = false;
        this.selected = false;
        this.disabled = false;
    }

    render() {
        const named = Boolean(this.label);
        /* AN INERT SLOT IS A MARK, NOT A CONTROL, and says so with a role.
         *
         * `inert` already stops the press and the focus. What it does NOT stop is the
         * element being a <button>, and an accessibility tree reports a button's implicit
         * role whether or not it can be reached. That is the whole of the selector's P12
         * defect: a decorative disc drawn on 5 list rows arrived as 5 button children of a
         * role="tree" that is supposed to hold only items and groups.
         *
         * role="presentation" REMOVES THE IMPLICIT ROLE. It is ignored on a focusable
         * element - which is exactly why it is spelled on the inert branch and nowhere
         * else, because inert is what makes the element unfocusable in the first place.
         *
         * THE TAG STAYS A BUTTON on purpose. Rendering a <span> instead was tried first
         * and broke ui-favourites-bank at both geometries: its five marks are all inert,
         * and the selected disc's paint reads `aria-pressed` off this element. Same tag,
         * same attributes, same paint - only the reported role changes. */
        /* `.hit-overlay` is on the BUTTON, not the host: the utility's ::before is
         * positioned against its originating element, and the button is the element
         * whose ink a consumer can shrink. Leaf-only is satisfied - both children are
         * spans, and nothing inside is interactive. */
        return html`<button id="slot" class="slot hit-overlay" type="button"
            role=${this.inert ? 'presentation' : nothing}
            aria-pressed=${this.selected ? 'true' : 'false'}
            ?disabled=${this.disabled}
            ><span id="mark" class="mark" aria-hidden=${named ? 'true' : nothing}
                ><slot>${this.index > 0 ? this.index : nothing}</slot></span
            >${named ? html`<span id="a11y" class="a11y">${this.label}</span>` : nothing}</button>`;
    }
}

customElements.define('ui-favourite-slot', UiFavouriteSlot);
