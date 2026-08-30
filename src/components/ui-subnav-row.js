/**
 * ui-subnav-row.js - component #25 of the 57-component inventory: THE SETTINGS
 * SUB-CATEGORY ROW.
 *
 * Wave 2, item #25 (SCOPE Part 4, "Wave 2 - controls with a state model, and small
 * compounds of Wave 1"). Token-only: no data layer, no store, no endpoint, no import
 * from src/data/ or src/stores/. A label arrives through the slot, a parent owns which
 * row is current, and this element owns paint, a fixed pitch and one press.
 *
 * WHAT THE ROW SAYS, verbatim (realine-run/waves/2/ITEMS.json, id "#25")
 *   name:  "Sub-nav row"
 *   spec:  "#24's contract; #3's selection treatment (LAYOUT_SPEC_DRAFT.md §3.9)"
 *   bugs:  T2, T3, T5
 *   notes: "Size: small. Settings sub-category row. Its current pitch and separator
 *          rules cannot match the markup at all - 89 vs 93px pitch, zero separators
 *          rendered (T2). Its selected state is expressed through #3 or its dials,
 *          never privately."
 *   spec §5.2 #25: "Sub-nav row | slate-shell.css:530-539 | Its separator and pitch
 *          rules cannot match (§7)."
 *   spec §4.4 names it in the Settings component list, between "nav row" and
 *          "settings row", and its column skeleton is
 *          "<subnav-column>  list (1fr, overflow-y:auto, VISIBLE scrollbar)".
 *
 * DISQUALIFICATION CHECK FIRST (prov_query.py --help, "RUN THIS CHECK BEFORE YOU
 * TRUST AN ANSWER"), because this element is on the 140-bug list three times:
 *   1. DECISIONS.md - no decision in the 45-item register touches the sub-nav row.
 *      C5 (accepted) touches the nav/pane SEAM and is quoted under T2 below.
 *   2. Responsive behaviour - NO Slate answer, ever: 98.4% of its geometry is frozen
 *      and the corpus is 1920x1200 only. LAYOUT_SPEC_DRAFT.md governs, and it is
 *      named at each of the three places it comes up.
 *   3. The 140 layout bugs - grepping §7 for this element returns T2 (pitch and
 *      separators), T3 (radius) and T5 (the LED), plus T18 (the 89px derivation) and
 *      T16 (the hidden scrollbar) on the column that holds it. So the oracle is
 *      DISQUALIFIED for: row height, row pitch, row separators, border-radius and the
 *      selected box-shadow. It is CLEAR - and used, quoted, in both themes - for
 *      every paint value: the resting ink, the resting ground, the type size, the
 *      type weight, the inline padding and the two selected colours.
 *
 * THE SLATE RULES, read read-only from the source because four of the declarations
 * reach the corpus through shorthands (padding:, background:, box-shadow: on the
 * selected rule, and the radius) and prov_query.py refuses to guess a token name
 * behind a shorthand. slate-shell.css:528-539 and :551-563, their own comments kept:
 *
 *     -- Same row height and type size as the category column - the two read as one
 *        navigation surface rather than two lists that happen to sit side by side. --
 *     #subpage-host .settings-subnav-btn {
 *         min-height: var(--slate-nav-row);
 *         height: var(--slate-nav-row);
 *         padding: 0 var(--slate-space-5);
 *         border-radius: 0 !important;
 *         background: transparent;
 *         color: var(--slate-muted) !important;
 *         font-size: var(--slate-text-nav);
 *         font-weight: var(--slate-weight-regular);
 *     }
 *     #subpage-host .settings-subnav-btn:hover,
 *     #subpage-host .settings-subnav-btn:focus-visible {
 *         background: var(--slate-key);
 *         color: var(--slate-text) !important;
 *     }
 *     -- THE CURRENT PAGE: a solid block of the accent, not a tint of it. ...
 *        Solid fill needs no bar of its own: the whole row IS the indicator. --
 *     #subpage-host .settings-subnav-btn.slate-nav-selected,
 *     #subpage-host .settings-subnav-btn[aria-current="true"],
 *     #subpage-host .settings-subnav-btn[aria-selected="true"] {
 *         position: relative;
 *         background: var(--slate-selected-face) !important;
 *         box-shadow: none;
 *         color: var(--slate-selected-ink) !important;
 *         font-weight: var(--slate-weight-medium);
 *     }
 *
 * and the two column rules that are T2 itself, slate-shell.css:417-424 and :430-434:
 *
 *     #subpage-host #main-categories-panel ul > li + li,
 *     #subpage-host #sub-categories-panel > * + *        { margin-top: 0 !important; }
 *     #subpage-host #main-categories-panel ul > li + li .settings-nav-btn,
 *     #subpage-host #sub-categories-panel > * + * .settings-subnav-btn,
 *     #subpage-host #sub-categories-panel > * + *.settings-subnav-btn {
 *         box-shadow: inset 0 var(--slate-hairline) 0 var(--slate-line);
 *     }
 *
 * settings.js:6426 returns ONE <ul> from renderSubcategories(), so
 * "#sub-categories-panel > * + *" has no second child to match, ever. Both halves
 * die together: the 4px of Tailwind space-y-1 margin survives (89px rows on a 93px
 * pitch) and the separator is never drawn.
 *
 * MEASURED STARTING VALUES - every one an oracle answer, quoted verbatim.
 * (prov_query.py find/value/themes, prov-baseline (dark) + prov-light.)
 *
 *   CITE  prov_query.py find --cls settings-subnav-btn -> "found 173 element(s) in
 *         38 state(s)"; settings-accessories-cup-warmer rects [261,219,338,89]
 *         [261,312,338,89] [261,405,338,89]. Height 89, pitch 93. THIS IS T2, and it
 *         is why the geometry below comes from the spec and not from here.
 *   CITE  settings-accessories-cup-warmer .settings-subnav-btn [i=32] color:
 *         dark rgb(148, 161, 169) / light rgb(90, 101, 108) <- slate-shell.css
 *         `#subpage-host .settings-subnav-btn` authored `var(--slate-muted)`
 *         !important=yes (token-driven)
 *         [= --ui-muted, styles/tokens.css:728 #5a656c / :849 #94a1a9 - exact, both themes]
 *   CITE  settings-accessories-cup-warmer .settings-subnav-btn [i=32] background-color
 *         = rgba(0, 0, 0, 0) <- slate-shell.css `#subpage-host .settings-subnav-btn`
 *         authored `transparent` !important=no (FROZEN/hardcoded)
 *   CITE  settings-accessories-cup-warmer #sub-categories-panel [i=29] background-color:
 *         dark rgb(14, 19, 23) / light rgb(242, 243, 243) <- slate-shell.css
 *         `#subpage-host #settings-body > #right-panel, #subpage-host
 *         #settings-navigation-container, #subpage-host #sub-categories-panel`
 *         authored `(NOT CAPTURED - set via a CSS shorthand)` !important=yes (token-driven)
 *         [= --ui-fascia, styles/tokens.css:720 #f2f3f3 / :841 #0e1317 - exact, both
 *          themes. The transparent row and the panel it sits on are ONE colour on
 *          screen; which element declares it is settled under DEPARTURE 2.]
 *   CITE  settings-accessories-cup-warmer .settings-subnav-btn [i=32] font-size = 22px
 *         <- slate-shell.css `#subpage-host .settings-subnav-btn` authored
 *         `var(--slate-text-nav)` !important=no (token-driven)
 *         (= --ui-text-nav, styles/tokens.css:357)
 *   CITE  settings-accessories-cup-warmer .settings-subnav-btn [i=32] font-weight = 400
 *         <- slate-shell.css `#subpage-host .settings-subnav-btn` authored
 *         `var(--slate-weight-regular)` !important=no (token-driven)
 *         (= --ui-weight-regular, styles/tokens.css:370)
 *   CITE  settings-accessories-cup-warmer .settings-subnav-btn [i=34] padding-left = 24px
 *         <- slate-shell.css `#subpage-host .settings-subnav-btn` authored
 *         `(NOT CAPTURED - set via a CSS shorthand)` !important=no (token-driven)
 *         [the shorthand is slate-shell.css:534 `padding: 0 var(--slate-space-5)`;
 *          = --ui-space-5, styles/tokens.css:269]
 *   CITE  settings-accessories-cup-warmer .settings-subnav-btn [i=34] gap = 2px <-
 *         slate-shell.css `#subpage-host .settings-subnav-btn` authored `2px`
 *         !important=no (FROZEN/hardcoded)
 *         [a screen literal off the seven-step scale; spec §3.3 snaps off-scale values
 *          to the nearest step, 2 -> 4 = --ui-space-1. It is only ever seen by a
 *          consumer who slots two things.]
 *   CITE  settings-accessories-cup-warmer .settings-subnav-btn [i=30] background-color:
 *         dark rgb(176, 196, 206) / light rgb(49, 92, 112) <- slate-shell.css
 *         `#subpage-host .settings-subnav-btn.slate-nav-selected, ...
 *         [aria-current="true"], ... [aria-selected` authored `(NOT CAPTURED - set via
 *         a CSS shorthand)` !important=yes (token-driven)
 *         [= --ui-selected-face -> --ui-steel, styles/tokens.css:750 #315c70 / :857
 *          #b0c4ce - exact, both themes]
 *   CITE  settings-accessories-cup-warmer .settings-subnav-btn [i=30] color:
 *         dark rgb(18, 24, 28) / light rgb(248, 252, 253) <- same rule, authored
 *         `var(--slate-selected-ink)` !important=yes (token-driven)
 *         [= --ui-selected-ink -> --ui-on-steel, styles/tokens.css:751 #f8fcfd / :858
 *          #12181c - exact, both themes]
 *   CITE  settings-accessories-cup-warmer .settings-subnav-btn [i=34] box-shadow = none
 *         <- (no declaration - inherited or initial value) (FROZEN/hardcoded)
 *         [T2's second half, measured: the separator rule never matched]
 *   CITE  settings-accessories-cup-warmer .settings-subnav-btn [i=34]
 *         letter-spacing = normal, text-transform = none, opacity = 1,
 *         border-top-width = 0px, font-family = Geist, system-ui, sans-serif
 *   CITE  themes settings-accessories-cup-warmer [i=30]: "15 of 18 properties identical
 *         across themes; 3 differ" - and the three are exactly face, ink and the LED.
 *
 * THE THREE BUGS THIS ROW EXISTS TO KILL
 *
 *   T2  "The sub-category column does not align with the category column: the
 *        `> * + *` half of the rule can never match, because renderSubcategories()
 *        returns a single <ul>. Measured pitch 89 vs 93, 24px out by row 7 - and the
 *        same mistake means the sub-nav has no row separators at all (measured
 *        box-shadow: none)."   slate-shell.css:417-424, 430-434; settings.js:6426
 *
 *        BOTH HALVES BECOME INEXPRESSIBLE, and neither by being careful.
 *        (a) PITCH. The row's outer box IS the pitch: block-size: var(--ui-nav-row)
 *            and no margin anywhere in this file. There is no second owner of the
 *            dimension to disagree with - spec §2.3, "One owner per dimension" - so
 *            the only way two nav columns can differ is if somebody retargets the
 *            token, which moves both. The suite asserts it the way T2 states it:
 *            seven rows of each column, tops equal at row 7, delta 0 against T2's 24.
 *        (b) SEPARATORS. This row draws NONE, on purpose, and cannot: a divider is a
 *            gap, not a border (CONVENTIONS §13, spec §2.2 / Appendix 2). The column
 *            is a seam grid and N cells give N-1 seams with no sibling selector in
 *            sight, which is why §13 names T2 first: "T2 ... becomes impossible: a
 *            gap needs no sibling selector, so N cells give N-1 seams." The only
 *            thing asked of this component is that it be an opaque CELL (DEPARTURE 2).
 *
 *   T3  "Nav rows are rounded despite `border-radius: 0` in two places - an
 *        attribute-selector rule later in the same file wins. Measured 6px."
 *        slate-shell.css:1027-1033 vs :464, :534
 *        CITE settings-accessories-cup-warmer .settings-subnav-btn [i=34]
 *             border-top-left-radius = 6px <- slate-shell.css
 *             `#subpage-host [class*="rounded-[67.5px]"], #subpage-host
 *             [class*="rounded-[54px]"], #subpage-host
 *             [class*="rounded-full"]:not(.slate-keep-round):not([class*="si`
 *             authored `(NOT CAPTURED - set via a CSS shorthand)` !important=yes
 *        The authored intent is square and the rendered answer is 6px, because the
 *        row's own rule was outranked by a substring attribute selector matching the
 *        Tailwind class in its markup (rounded-lg), from 500 lines away, with
 *        !important. THE FIX IS NOT A BIGGER SELECTOR. The corner is declared once,
 *        inside a shadow root, where no document rule of any specificity can reach
 *        it - and the suite proves that by putting exactly such a rule in the
 *        document and watching the corner not move.
 *
 *   T5  "The selected nav row still draws a 4px LED it is explicitly not supposed to,
 *        because the `box-shadow: none` that removes it is not `!important` and the
 *        component's is. The fork dial --slate-selected-led is bypassed entirely."
 *        slate-shell.css:496, :558 vs slate-components.css:262-268
 *        CITE settings-accessories-cup-warmer .settings-subnav-btn [i=30] box-shadow =
 *             rgba(0, 0, 0, 0) 0px -4px 0px 0px inset, color(srgb 0.690196 0.768627
 *             0.807843 / 0.72) 0px -4px 0px 0px inset <- slate-components.css
 *             `.slate-nav-selected` authored `inset 0 calc(-1 *
 *             var(--slate-toggle-indicator-height)) 0 calc(-1 *
 *             var(--slate-toggle-indicator-height) +
 *             var(--slate-toggle-indicator-height)) transparent, inset 0 calc(-1 *
 *             var(--slate-toggle-indicator-height)) color-mix(in srgb,
 *             var(--slate-steel) 72%, transparent)` !important=yes (token-driven)
 *        Two sheets, two intentions, and the loud one wins: the row said "no bar, the
 *        fill is the cue", the shared list class said "a bar, always", and the dial
 *        that exists to answer exactly this question was consulted by neither. Here
 *        there is one rule that can draw an LED on this element - selectionSurface in
 *        base.js - and its length is var(--ui-selected-led), 0px in Slate and
 *        var(--ui-toggle-led) in Radian. This file declares NO box-shadow at all, at
 *        any state, which is the only way to be sure.
 *
 * DELIBERATE DEPARTURES, each in realine-run/waves/2/ledger-src/25-expected-changes.json
 * and each asserted as a departure in test/render/ui-subnav-row.render.test.mjs:
 *
 *   1. THE PITCH IS 88, NOT 89 - and 77 in a short window. Oracle disqualified (T2,
 *      T18). Spec §3.2: "--ui-nav-row | calc(var(--ui-control-h) + 2 *
 *      var(--ui-space-3)) = 88px | replaces slate-tokens.css:85 | Disagreement -
 *      resolved", with T18 recording that the old 89 "justifies itself with a
 *      derivation that is wrong on both halves". styles/tokens.css:220 multiplies by
 *      --ui-density, so the same token is 77px below 700px of window height. The row
 *      never computes that arithmetic (CONVENTIONS §11) - it consumes the token.
 *   2. THE ROW PAINTS THE COLUMN'S GROUND. Slate's row is `transparent` over a panel
 *      painted --slate-fascia; the two CITEs above are the same colour arriving from
 *      two elements. Rendered pixels are identical either way at rest - but a
 *      transparent cell in a seam grid is CONVENTIONS §13 trap 1, "a slab of divider
 *      colour", so the host paints --ui-fascia and the control stays transparent
 *      above it. Same arrangement as ui-bank (#3), whose host paints --ui-key and
 *      whose .item is transparent.
 *   3. SELECTION DOES NOT MOVE THE TYPE WEIGHT. Slate's selected row is 500 against a
 *      resting 400 (CITE [i=30] font-weight = 500 / [i=32] font-weight = 400). Weight
 *      is not one of the four dials, so a rule for it here would be a private
 *      "selected" look in a component that is not the selection component - banned by
 *      this wave outright ("no private 'selected' look anywhere in the wave"; row #25:
 *      "Its selected state is expressed through #3 or its dials, never privately").
 *      The weight lift survives where the wave puts it, in #3 and only there:
 *      ui-bank.js:368-389, "SELECTION ALSO LIFTS THE WEIGHT, AND THAT IS A RULE, NOT A
 *      FIFTH DIAL ... this stays a rule in the one selection component rather than
 *      becoming --ui-selected-weight". If the register later wants it on nav rows too,
 *      the honest form is that fifth dial in styles/tokens.css, not a second copy of
 *      the rule here (recorded as a deferred question).
 *   4. THE SQUARE CORNER IS REAL. Slate authored `border-radius: 0 !important` and
 *      rendered 6px (T3). This renders 0px. It is a visible change against the running
 *      app and an exact match to what the app's own author wrote.
 *   5. FOCUS DOES NOT REPAINT THE FACE. slate-shell.css:541-544 gives :focus-visible
 *      the hover face. The corpus captures no focus state, so nothing is contradicted
 *      by measurement - but §3.6 says one focus treatment, and here that is the ring
 *      the base draws. A face that changes on focus AND on hover AND on selection is
 *      three cues for two states.
 *   6. THE HOVER FACE IS GUARDED BY `(hover: hover)`. Slate's rule is unguarded
 *      (slate-shell.css:541-544). On a touch panel :hover STICKS to the last element
 *      tapped, so an ordinary sub-nav row keeps the --ui-key face under a finger that
 *      has already lifted - and nothing repaints a non-current row, so the stale face
 *      survives until the next tap lands somewhere else. THIS IS A WALL PANEL. The
 *      sibling #24 carries the same guard and says why (ui-nav-row.js:503-506, "on a
 *      touch panel a sticky :hover leaves the last-pressed control lit, and this is a
 *      wall panel"), as do the wave-1 press primitives (ui-icon-button, ui-list-row).
 *      It is a MEDIA FEATURE query, not a width query; CONVENTIONS §2 bans
 *      `@media (width...)` and nothing else. Visible change: on the bench tablet the
 *      resting face never lights at all; :active still does, because a press is a real
 *      state with a real end.
 *   7. `focus-ring="inset"` IS THE DEFAULT, NOT THE CONSUMER'S JOB. Set in
 *      connectedCallback, exactly as #24 sets it (ui-nav-row.js:548-551). The column
 *      this row is specified to live in SCROLLS - spec §4.4's skeleton is
 *      "<subnav-column>  list (1fr, overflow-y:auto, VISIBLE scrollbar)" and
 *      LAYOUT_SPEC_DRAFT.md:724-727 says it again ("The nav columns scroll with a
 *      visible scrollbar") - and a flush row in a scrolling column has its outset ring
 *      clipped by the column before it is drawn, on the inline axis for EVERY row and
 *      on the block axis for the first and last. That is bug L24 itself ("focus rings
 *      clipped on all four sides by the components they sit inside"), and leaving the
 *      remedy opt-in retires L24 only for consumers who remember it. MEASURED before
 *      this default existed: ring left edge at -5 against a column left edge of 0.
 *      `focus-ring="outset"` is still available and still honoured - connectedCallback
 *      only fills the attribute in when it is absent, so `focusVariant` stays honest.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   - NO SEPARATOR, NO BORDER, NO SHADOW. See T2(b) and T5. The suite asserts all four
 *     border widths are 0 and box-shadow is `none` at rest, so the anti-pattern is
 *     absent rather than merely unused.
 *   - NO SELECTION MODEL. Clicking does not make the row current: it emits `navigate`
 *     and the column decides, because "current" is the router's fact, not this
 *     element's opinion. Size small in Part 4's vocabulary is "paint and tokens plus at
 *     most hover/disabled/focus, no internal model".
 *   - NO DATA. No import from src/data/ or src/stores/, no fetch, no route table. The
 *     label is slotted and `value` is an opaque string the consumer chose.
 *   - NO SIZE QUERY OF ANY KIND: no `@media (width...)`, no `@container`. Every
 *     dimension here is a fixed ergonomic token (spec §2.2: "Control heights, touch
 *     targets, hairlines | Fixed token. Never fluid"). The narrow-window answer for
 *     this screen is a COLUMN decision, not a row one - spec §4.4: "@container
 *     (inline-size < 1100px) -> two columns (nav collapses to one, breadcrumbed)" -
 *     and it belongs to whoever owns <master-detail>. A long label ellipsises; the
 *     row's height never changes. The ONE @media in this file is `(hover: hover)`,
 *     which is a media FEATURE and not a width - DEPARTURE 6, and CONVENTIONS §2's
 *     ban is on `@media (width...)` alone.
 *   - NO SCROLLING, NO overflow: hidden ON THE CONTROL. Only the label clips, so this
 *     component cuts nobody's ring from the inside. The ring is not left outset on
 *     that account, though: the COLUMN clips, and DEPARTURE 7 defaults this row to
 *     `focus-ring="inset"` for it. The column that scrolls owns spec §2.4's floor and
 *     its VISIBLE scrollbar (T16 is the column's bug, not the row's).
 *   - NO part() THEMING SURFACE. Theming crosses the boundary through custom
 *     properties only (Part 4 ground rule 1; A6).
 *
 * ACCESSIBILITY (spec Appendix 15: "The `aria-*`-driven state selectors on
 * .slate-bank / .slate-stepper - the right contract for a Lit component's reflected
 * properties")
 *   A real <button>, so it is in the tab order, activates on Enter and Space, and
 *   moves focus when pressed. T15 records what the settings screen does instead today:
 *   "selection is class-only with no aria-current/aria-selected; navigation driven by
 *   synthetic .click() so focus never moves". Here `current` is ONE reactive property
 *   that renders BOTH the aria state and the paint, from the same value in the same
 *   render, so visual state and accessibility state cannot drift.
 *   `aria-current="true"` and not `aria-current="page"`: "page" is the more precise
 *   ARIA value, but the ONE sanctioned selected paint (selectionSurface, base.js:353)
 *   matches ="true", which is also Slate's own contract
 *   (slate-shell.css:557 `.settings-subnav-btn[aria-current="true"]`). Choosing "page"
 *   would force a private selected rule, which this wave forbids. Recorded as a
 *   deferred question for base.js's owner, not settled here.
 *
 * API
 *   <ui-subnav-row>Cup Warmer</ui-subnav-row>              a row
 *   <ui-subnav-row current>Lighting</ui-subnav-row>        the current page
 *   <ui-subnav-row value="lighting">Lighting</ui-subnav-row>   echoed in the event
 *   <ui-subnav-row summary="220V">Voltage</ui-subnav-row>  the leaf's headline scalar,
 *                                                          hard right, muted; empty
 *                                                          draws no element (S20)
 *   <ui-subnav-row disabled>Soon</ui-subnav-row>           dimmed by --ui-opacity-disabled
 *   <ui-subnav-row focus-ring="outset">…</ui-subnav-row>   opt OUT of the inset default
 *                                                          (DEPARTURE 7; inset is set on
 *                                                          connect, because the column
 *                                                          scrolls - L24)
 *   <ui-subnav-row hidden>…</ui-subnav-row>                really hidden
 *
 *   Events: `navigate` - CustomEvent, bubbles, composed, detail { value }, fired on
 *   activation (pointer or keyboard) and never on a disabled row. The row does not
 *   change its own `current`; the consumer sets it.
 *
 *   THE ONE SPELLING. Selection is `current`. The base fragment also paints
 *   :host([selected]) and the other three aria spellings on the host, because it is
 *   shared; this component reflects `current` and renders aria-current on the control,
 *   and that is the contract its hover exclusion is built around.
 */

import { css, html, nothing } from 'lit';
import { UiElement, selectionSurface } from 'src/components/base.js';

export class UiSubnavRow extends UiElement {
    static properties = {
        /** The current page in the sub-category column. Renders aria-current="true". */
        current: { type: Boolean, reflect: true },
        /** Paint only - the base dims the host; the control refuses the press. */
        disabled: { type: Boolean, reflect: true },
        /** An opaque id the consumer chose, echoed in the navigate event. */
        value: { type: String },
        /**
         * THE LEAF'S ONE HEADLINE SCALAR, drawn hard right after the label. Empty draws
         * NOTHING — no element, no dash — because a nav list is not a place to report an
         * absence, and half these rows have no scalar at all. See the `.summary` rule.
         */
        summary: { type: String },
    };

    /* NO STRUCTURAL FRAGMENT: this row needs neither hitArea (its box is
     * var(--ui-nav-row), well over the --ui-hit-min floor - asserted, not assumed) nor
     * visuallyHidden (the slotted label IS the accessible name). selectionSurface is
     * LAST, after the resting paint, because it has to win the tie against it
     * (CONVENTIONS §4 rule 1). */
    static styles = [css`
        /* ---------------------------------------------------------------
         * THE HOST IS THE CELL.
         *
         * DEPARTURE 2. The column is a seam grid - a 1px gap over a coloured
         * ground, CONVENTIONS §13 - and its trap 1 is that "a cell that paints
         * nothing is a hole", so a column of transparent rows would render as a
         * slab of divider ink. Slate got the same pixels by painting the PANEL
         * and leaving the row transparent, which works right up until the panel
         * is the thing drawing the separators.
         *   CITE settings-accessories-cup-warmer #sub-categories-panel [i=29]
         *        background-color: dark rgb(14, 19, 23) / light rgb(242, 243, 243)
         *        (token-driven)  -> --ui-fascia, exact in both themes
         * Base gives display: block and container-type: inline-size; neither is
         * restated. There is no @container query in this file - see WHAT IS
         * DELIBERATELY NOT HERE - and the containment is still correct for a
         * cell that fills a column track.
         * ------------------------------------------------------------- */
        :host {
            background-color: var(--ui-fascia);
        }

        /* ---------------------------------------------------------------
         * THE CONTROL. SOURCE slate-shell.css:530-539.
         *
         * A CLASS, NEVER AN ID (CONVENTIONS §4 rule 2). Every declaration that
         * selection has to beat sits at (0,1,0) on .row, which selectionSurface
         * ties and then wins on source order. An id here would be (1,0,0) and
         * this row would silently never turn current - which is the same shape
         * as T3 and T5, one storey down.
         * ------------------------------------------------------------- */
        .row {
            display: flex;
            align-items: center;

            /* CITE settings-accessories-cup-warmer .settings-subnav-btn [i=34]
             *      gap = 2px, authored 2px, FROZEN/hardcoded. Off the seven-step
             *      scale, so spec §3.3 snaps it to the nearest step: --ui-space-1.
             *      Only ever visible to a consumer who slots two things. */
            gap: var(--ui-space-1);

            /* THE PITCH, AND THE ONLY OWNER OF IT (spec §2.3). DEPARTURE 1: 88,
             * not Slate's 89 - the oracle is disqualified here by T2 and T18, and
             * spec §3.2 resolves the disagreement to
             * calc(var(--ui-control-h) + 2 * var(--ui-space-3)). No margin, no
             * min-block-size, no second declaration anywhere in this file: the
             * outer box IS the pitch, so two nav columns cannot drift apart. */
            inline-size: 100%;
            block-size: var(--ui-nav-row);

            /* CITE ... [i=34] padding-left = 24px (token-driven); the shorthand is
             * slate-shell.css:534 padding: 0 var(--slate-space-5). The sub-nav row
             * takes the SAME inline padding as the category row - Slate indents
             * neither, and depth is carried by the column, not by a step. */
            padding-block: 0;
            padding-inline: var(--ui-space-5);

            /* T2(b) AND T5, AS AN ABSENCE. No border, no box-shadow, at any state:
             * the separator is the column's gap and the LED is the dial's. The
             * suite asserts both are still zero, because an absence nobody checks
             * comes back. */
            border: 0;

            /* T3. Authored 0 in Slate too - and rendered 6px, because a substring
             * attribute selector 500 lines away carried !important. Declared once,
             * here, where no document rule can reach it whatever its specificity. */
            border-radius: 0;

            /* CITE ... [i=32] background-color = rgba(0, 0, 0, 0), authored
             * transparent, FROZEN/hardcoded. The host's --ui-fascia shows through
             * an ordinary row; DEPARTURE 2 explains why the ground moved one
             * element out. */
            background-color: transparent;

            /* CITE ... [i=32] color: dark rgb(148, 161, 169) / light
             * rgb(90, 101, 108) authored var(--slate-muted) (token-driven)
             * = --ui-muted, exact in both themes. */
            color: var(--ui-muted);

            /* A button does not inherit its font: the UA sets the font shorthand
             * on it, which resets family, size, weight AND line-height. Family and
             * line-height come back by inheritance from styles/document.css
             * (CONVENTIONS §11; DQ-216 - inherit CONSUMES the 1.5 rather than
             * restating a ratio), and the two the oracle measured are stated from
             * tokens.
             * CITE ... [i=32] font-size = 22px authored var(--slate-text-nav)
             * CITE ... [i=32] font-weight = 400 authored var(--slate-weight-regular) */
            font-family: inherit;
            line-height: inherit;
            font-size: var(--ui-text-nav);
            font-weight: var(--ui-weight-regular);

            /* A nav row is read left to right; the UA centres button text. */
            text-align: start;

            appearance: none;
            cursor: pointer;
        }

        /* HOVER AND PRESS, WRITTEN TO LOSE TO SELECTION.
         *
         * Slate needed six selectors and !important to stop the row you just
         * tapped repainting itself as unselected under your finger
         * (slate-shell.css:566-571, "on a touch panel the last row tapped keeps
         * :hover, so the current page would lose its fill the moment you chose
         * it"). Written .row:where(:hover…) the pseudo-class contributes nothing,
         * so this rule carries the same (0,1,0) as selectionSurface's attribute
         * selectors and loses to them on source order - the fragment is last.
         * Same mechanism as ui-bank.js:467. :not(:disabled) is inside the
         * :where() for the same reason: it must not raise the weight.
         *
         *   CITE (source, not corpus - no hover state is captured)
         *        slate-shell.css:541-544 background: var(--slate-key);
         *        color: var(--slate-text)   -> --ui-key / --ui-text
         *        slate-shell.css:437-440 :active background-color:
         *        var(--slate-key-on)        -> --ui-key-on
         * DEPARTURE 5: Slate gives :focus-visible the hover face as well. The ring
         * is the focus treatment (spec §3.6), so it is not repeated here.
         *
         * DEPARTURE 6, AND IT IS THE @media BELOW. The exclusion above protects the
         * CURRENT row from a sticky :hover; it does nothing at all for an ordinary
         * one, which on a touch panel keeps the --ui-key face under a finger that has
         * already lifted and holds it until the next tap lands elsewhere. This is a
         * WALL PANEL. The hover:hover guard is the one #24 carries for exactly this
         * (ui-nav-row.js:503-506, "on a touch panel a sticky :hover leaves the
         * last-pressed control lit, and this is a wall panel") and that two wave-1
         * press primitives carry too. It is a MEDIA FEATURE query, not a width query:
         * CONVENTIONS §2's ban is on @media (width ...) alone.
         *
         * NO BACKTICK ANYWHERE IN THIS TEMPLATE (CONVENTIONS §9): a backtick
         * terminates the css literal and the syntax error points at a word in prose.
         *
         * :active IS DELIBERATELY OUTSIDE THE GUARD. A press is a real state with a
         * real end - it releases with the finger - so the press face is the only
         * resting-face change a touch user should ever see. */
        @media (hover: hover) {
            .row:where(:hover:not(:disabled)) {
                background-color: var(--ui-key);
                color: var(--ui-text);
            }
        }

        .row:where(:active:not(:disabled)) {
            background-color: var(--ui-key-on);
        }

        /* DISABLED IS PAINTED ONCE, ON THE HOST.
         *
         * The base dims BOTH spellings - :host(:is([disabled],…)) and
         * :where([disabled],…) inside the shadow tree - and this is the component
         * in the wave where both are true at once: the disabled flag reflects to the host
         * (so the base dims the row) and the same flag puts the native attribute on
         * the control (so the press is actually refused, rather than merely looking
         * refused). Left alone that is .38 x .38 = .14, a row three times fainter
         * than the one dial says, which is the shape of Slate's three live disabled
         * values (spec §3.7) arriving by multiplication instead of by copy-paste.
         * Measured at 0.38 on the control before this rule existed.
         *
         * .row:where(:disabled) is (0,1,0) against the base rule's (0,0,0) - the
         * base authors inside :where() precisely so a component can say this in one
         * line with no !important (CONVENTIONS §6). */
        .row:where(:disabled) {
            opacity: 1;
            cursor: default;
        }

        /* THE LABEL. One line, clipped with an ellipsis rather than wrapped: a row
         * whose height depends on its text is a row whose column has no pitch,
         * which is the family T2 belongs to. The text node is untouched, so the
         * accessible name stays whole when the ink does not.
         * min-inline-size: 0 because a flex item's automatic minimum size is its
         * content, and without it the ellipsis never engages. */
        .label {
            min-inline-size: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* THE HEADLINE SCALAR (S20), IN ITS OWN TRACK AND NEVER IN THE LABEL'S.
         *
         * Slate's own markup puts it in a sibling span inside the same flex row
         * (settings.js:6413-6421, .settings-subnav-value) and that is the whole of
         * the structure; what is decided here is the three rules that make it safe
         * to put a number next to a name that ellipsises.
         *
         * FLEX NONE AND MARGIN-INLINE-START AUTO. The number takes its own
         * content and no more, and the free space is pushed in front of it, so it
         * ends on the row's inline end whatever the label is. Without the first
         * the number is a flex item that can be squeezed to nothing; without the
         * second it sits against the label and the column reads as ragged.
         *
         * IT NEVER WRAPS AND NEVER CLIPS. The LABEL is the part that gives way
         * (see above) - a name is recoverable from its first characters and a
         * number is not, so on a narrow column the page name truncates and the
         * value stays whole. That is the opposite of what happens if both are
         * allowed to shrink, which is the ordinary flex default and the reason
         * this rule exists at all.
         *
         * MUTED INK AT THE ROW'S OWN SIZE. It is evidence about the page, not a
         * second label for it, so it is the same type role one tone quieter -
         * and it inherits its colour from nothing: the resting row is ALREADY
         * --ui-muted, and a selected row turns its whole text --ui-selected-ink
         * through the shared fragment. Declaring a colour here would be a private
         * paint that the selection dials could not reach, which is exactly what
         * DEPARTURE 3 refuses one storey up. So it states OPACITY instead - the
         * shared --ui-opacity-dim, which is already theme-aware (.62 light, .42
         * dark) - and that composes with whichever ink the row is wearing.
         *
         * NO BACKTICK IN THIS COMMENT: one would end the css literal and the
         * parse error would name a line hundreds of rows away. */
        .summary {
            flex: none;
            margin-inline-start: auto;
            padding-inline-start: var(--ui-space-3);
            white-space: nowrap;
            opacity: var(--ui-opacity-dim);
            font-variant-numeric: tabular-nums;
        }
    `,
    /* THE ONLY SELECTED PAINT IN THE COMPONENT, and it is not in the component:
     * four dials, one shared fragment, zero rules of our own (spec §3.9,
     * CONVENTIONS §4). Slate is face + ink with the LED and glow off; Radian is
     * the same rules with two different values. DEPARTURE 3 records the one thing
     * Slate did here that is NOT one of the four - the 400 -> 500 weight lift -
     * and why it stays in #3 rather than being copied into a second component. */
    selectionSurface];

    constructor() {
        super();
        this.current = false;
        this.disabled = false;
        this.value = '';
        this.summary = '';
    }

    /**
     * DEPARTURE 7. One host attribute, set here and never in the constructor - a custom
     * element constructor must not gain attributes.
     *
     * `focus-ring="inset"` is bug L24's remedy in the one line CONVENTIONS §3
     * documents, and it is the DEFAULT here rather than the consumer's job because the
     * column this row is specified to live in scrolls: spec §4.4's skeleton reads
     * "<subnav-column>  list (1fr, overflow-y:auto, VISIBLE scrollbar)" and
     * LAYOUT_SPEC_DRAFT.md:724-727 says it again - "The nav columns scroll with a
     * visible scrollbar". A row flush with its column has an outset ring clipped on the
     * inline axis for EVERY row and on the block axis for the first and last, so
     * leaving the remedy opt-in retires L24 only for the consumers who remember it.
     * Identical to the sibling #24 (ui-nav-row.js:548-551), deliberately: two rows in
     * one navigation surface that ring differently is the divergence this wave exists
     * to stop.
     *
     * Setting the REAL attribute rather than redeclaring the private property keeps
     * `UiElement#focusVariant` honest and leaves `focus-ring="outset"` available to a
     * consumer - the attribute is only filled in when it is absent.
     */
    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('focus-ring')) this.setAttribute('focus-ring', 'inset');
    }

    render() {
        /* ONE PROPERTY RENDERS BOTH THE STATE AND THE PAINT. `nothing` removes the
         * attribute entirely rather than writing aria-current="false", so the
         * selector in selectionSurface has nothing to match and a screen reader has
         * nothing to announce. */
        /* THE SCALAR IS PART OF THE ROW'S OWN NAME, and that is why it is inside the
         * button rather than beside it. A screen reader announcing "Voltage" and
         * leaving the number to a sibling element nobody focuses would give a
         * keyboard user strictly less than the screen gives everyone else - and the
         * whole reason S20 exists is that reading the value cost a page load. The
         * label slot and this span are read as one accessible name.
         *
         * AN EMPTY SUMMARY DRAWS NO ELEMENT AT ALL. Not an empty span, which would
         * still take the auto margin's decision and leave a gap nobody can see the
         * reason for, and emphatically not a dash: this list is where a person
         * chooses a page, and a column of dashes reads as a broken screen rather
         * than as a set of pages that hold no single number. The consumer decides
         * what it means for a value to be missing; this element just does not draw
         * one. NO BACKTICK IN THIS COMMENT: one would end the html literal. */
        const summary = String(this.summary ?? '').trim();
        return html`<button
            id="row"
            class="row"
            type="button"
            aria-current=${this.current ? 'true' : nothing}
            ?disabled=${this.disabled}
            @click=${this.#activate}
        ><span id="label" class="label"><slot></slot></span>${summary
            ? html`<span id="summary" class="summary">${summary}</span>`
            : nothing}</button>`;
    }

    #activate() {
        /* A disabled <button> fires no click, so this is belt and braces for a
         * consumer dispatching one by hand - and it is exactly the synthetic-click
         * path T15 complains about, so it should not be the path that works. */
        if (this.disabled) return;
        this.dispatchEvent(new CustomEvent('navigate', {
            bubbles: true,
            composed: true,
            detail: { value: this.value },
        }));
    }
}

customElements.define('ui-subnav-row', UiSubnavRow);
