/**
 * ui-settings-row.js - component #29 of the 57-component inventory: THE SETTINGS ROW.
 *
 * Wave 4, item #29 (SCOPE Part 4, "Wave 4 - dialog bodies and screen compounds",
 * L1641). The one primitive SCOPE and §4.4 project will cover ~30 of Settings' 37 leaves.
 *
 * WHAT IT MEASURES AS, NOW THAT THE SCREEN EXISTS (wave 5.4, cross-7 / cross-6). The ~30
 * below is a QUOTATION of a projection and is left verbatim; this line is this file's own
 * voice and it used to assert the projection as fact. As built: 37 leaves, 9 bespoke, 28
 * classified primitive (`leafKind()` is NOT-in-`BESPOKE_LEAVES`, a classification by
 * exclusion and never a composition count), and 19 leaves that actually COMPOSE this
 * component — 23 rows over 19 distinct leaves, 18 of them primitive, the nineteenth
 * `display-skin` carrying D8's button row. Ten primitive leaves render a heading and
 * nothing else, and every one of them is declared (`PENDING_ROWS`, one `LEAF_NOTE`, and
 * F3/Q1's leaf holding neither by the screen law). `src/screens/settings-screen.js`
 * carries the same breakdown at the screen's end; `src/lib/settings-leaves.js` is where
 * the numbers come from and `test/settings-leaves.test.mjs` pins them.
 *
 * THE ONE-PRIMITIVE LAW IS NOT THE PROJECTION and it is intact: one `ui-settings-row`
 * definition tree-wide, five archetype branches, no sixth that draws.
 *
 * WHAT THE ROW SAYS, verbatim
 *   SCOPE L1641: "Settings row | Label block (heading + optional range hint + live
 *   reading + caption) with one control slot on the right. Covers ~30 of the 37 leaves
 *   (spec §4.4); today it is matched by *class shape* and one leaf sits 12px lower than
 *   the other 36 for picking up stray padding (T13). | medium | #4, #5, #3, #7, #1".
 *   Spec §4.4 says the same thing from the screen's side: "settings row (label block:
 *   heading + optional range hint + optional live reading + optional caption, one
 *   control on the right) - this one primitive covers ~30 of the 37 leaves".
 *
 * ===========================================================================
 * THE BUG THIS COMPONENT EXISTS TO KILL - T13, LAYOUT_SPEC_DRAFT.md:1189
 * ===========================================================================
 *
 *   "One leaf's header sits 12px lower than the other 36, because it wraps its title
 *    in a row that picks up the row primitive's padding-block. Measured y 158/193
 *    against 146/181."   (settings.js:2390-2396; slate-shell.css:1295)
 *
 *   MEASURED HERE, MECHANICALLY, BEFORE ANYTHING WAS WRITTEN:
 *     prov_query.py find --cls slate-title  ->  38 elements in 38 states.
 *     CITE settings-display-brightness .slate-title  rect x=629 y=193 w=1200 h=34
 *     CITE settings-accessories-cup-warmer .slate-title  rect x=629 y=181 w=1200 h=34
 *     ...and 30 more states at y=181. 193 - 181 = 12 = --slate-space-3
 *     (slate-tokens.css:117, 12px). The bug is one token wide.
 *
 *   THE MECHANISM, read read-only from both citations. slate-shell.css:1290-1297 is
 *   the row primitive, and it is selected by CLASS SHAPE:
 *       1290  /* Any row that is "a label and its control" gets the same anatomy. *(/)
 *       1291  #subpage-host #settings-content-area .content-stretch.flex.items-center.justify-between,
 *       1292  #subpage-host #settings-content-area [data-settings-row] {
 *       1293      box-sizing: border-box;
 *       1294      min-height: var(--slate-control-height);
 *       1295      padding-block: var(--slate-space-3);
 *       1296      gap: var(--slate-space-5);
 *       1297  }
 *   The sheet's author knew the class shape was the wrong contract - line 1292 offers
 *   an explicit opt-in, `[data-settings-row]`. Counted read-only across the whole app:
 *   `data-settings-row` occurs EXACTLY ONCE, in that selector. Zero elements opt in,
 *   so all 64 rows are matched by accident of utility-class shape.
 *
 *   And then settings.js:2390-2396, the Brightness leaf, wraps its PAGE TITLE in the
 *   same four classes with an empty second child:
 *       2390  <div class="content-stretch flex flex-col gap-[60px] items-start relative w-full">
 *       2391      <div class="content-stretch flex items-center justify-between relative w-full">
 *       2392          <div class="w-full">
 *       2393              <p class="slate-title" ...>Screen Brightness</p>
 *       2394          </div>
 *       2395
 *       2396      </div>
 *   Line 2391 is not a row. It matches the row rule anyway, takes 12px of
 *   padding-block, and the title lands at y=193.
 *
 *   HOW IT BECOMES INEXPRESSIBLE HERE, and it is structural rather than careful.
 *   A row is a TAG - `<ui-settings-row>` - not a shape. Three independent legs, each
 *   asserted in test/render/ui-settings-row.render.test.mjs:
 *     (a) NO CLASS SHAPE CAN CREATE A ROW. The padding-block below is authored inside
 *         this shadow root against `:host`. No arrangement of `content-stretch flex
 *         items-center justify-between` on any element anywhere can acquire it,
 *         because no selector outside a shadow root reaches into one. The suite mounts
 *         Slate's exact imposter markup (2391-2396, byte-for-byte classes) next to a
 *         real row and asserts its padding-block is 0.
 *     (b) NO CLASS SHAPE CAN CHANGE ONE. The same four classes put ON the host change
 *         nothing: the host's own rule is in this file, and a light-tree class can
 *         only reach it through a rule some sheet would have to write.
 *     (c) NO PADDING LEAKS INWARD. The padding is the host's box; the heading's offset
 *         from the top of its own row is identical on every row built by any route.
 *         The suite builds rows four ways (declarative, createElement + properties,
 *         cloneNode, innerHTML), one of them wearing the imposter classes, and asserts
 *         the spread of heading offsets is ZERO - which is "36 leaves at 181 and one at
 *         193" made arithmetically impossible.
 *
 *   SCOPE L2293 files this under the class the primitive kills outright: "T13 / T20 /
 *   T14 / T17 - the rhythm-and-duplication class, killed by the primitive: one row
 *   component means one padding, one gap vocabulary, one switch geometry."
 *
 * ===========================================================================
 * MEASURED STARTING VALUES - every one an oracle answer, quoted verbatim
 * ===========================================================================
 *
 * DISQUALIFICATION CHECK FIRST (SCOPE Part 10 §4, printed by prov_query.py --help).
 * The oracle keeps its vote for the row's TYPE and INK - none of it is responsive
 * behaviour, none of it is settled differently by a decision, and the elements below
 * are not themselves on the 140 layout bugs. It LOSES its vote on exactly three
 * things, each marked DEPARTURE below: the row's own padding rule (T13's own mechanism
 * - the class-shape selector), the range hint's opacity paint, and the live reading's
 * placement, where spec §4.4's anatomy is a Step 0 document and wins.
 * Separately from all three, the oracle is DISQUALIFIED OUTRIGHT for RESPONSIVE
 * BEHAVIOUR - Slate is frozen at 1920x1200 - and that is what DEPARTURES 5 and 6 are.
 * Neither changes a value the oracle measured; both answer a question it was never asked.
 *
 * State `settings-accessories-cup-warmer` is the reference leaf: it is the one state
 * of the 49 that carries all four label-block parts at once.
 *
 *   THE HEADING  (Slate's <p class="slate-heading">)
 *     CITE settings-accessories-cup-warmer .slate-heading [i=39] font-size = 20px  <-
 *          slate-components.css `.slate-heading` authored `var(--slate-text-lg)`
 *          !important=yes (token-driven)
 *     CITE settings-accessories-cup-warmer .slate-heading [i=39] font-weight = 500  <-
 *          same rule, authored `var(--slate-weight-medium)` !important=yes (token-driven)
 *     CITE settings-accessories-cup-warmer .slate-heading [i=39] color = rgb(244, 247, 248)
 *          <- same rule, authored `var(--slate-text)` !important=yes (token-driven)
 *     CITE settings-accessories-cup-warmer [prov-light] .slate-heading [i=39] color =
 *          rgb(23, 26, 28)  <- same rule    [= --ui-text exactly: tokens.css:726
 *          #171a1c / :847 #f4f7f8]
 *     Measured rect h=26 = 20 x the 1.3 leading `.ui-heading` carries. This is the
 *     `.ui-heading` type role verbatim (type-roles.js:218-224), so the row declares
 *     none of it and composes the role instead.
 *
 *   THE RANGE HINT  (Slate's <span class="text-[20px] font-normal opacity-60 ...>)
 *     CITE settings-accessories-cup-warmer .text-[20px] [i=45] font-size = 17px  <-
 *          slate-shell.css `#subpage-host #settings-content-area [class*="text-[20px]"]`
 *          authored `var(--slate-text-base)` !important=yes (token-driven)
 *     CITE settings-accessories-cup-warmer .text-[20px] [i=45] font-weight = 400  <-
 *          same rule, authored `400` !important=yes (FROZEN/hardcoded)
 *     CITE settings-accessories-cup-warmer .text-[20px] [i=45] color = rgb(244, 247, 248)
 *          <- app.css `.text-\[var\(--text-primary\)\]` authored `var(--text-primary)`
 *          !important=no (token-driven)
 *     CITE settings-accessories-cup-warmer .text-[20px] [i=45] opacity = 0.6  <-
 *          app.css `.opacity-60` authored `0.6` !important=no (FROZEN/hardcoded)
 *     Measured rect [823,375,74,26] against the heading's [629,373,180,26]:
 *     823 - (629+180) = 14, which is settings.js:3632's literal `gap-[14px]`.
 *     17px at weight 400 is the `.ui-body` type role verbatim. The 0.6 is DEPARTURE 2.
 *
 *   THE CAPTION  (Slate's <p class="slate-caption">)
 *     CITE settings-accessories-cup-warmer .slate-caption [i=40] font-size = 16px  <-
 *          slate-components.css `.slate-caption` authored `var(--slate-text-note)`
 *          !important=yes (token-driven)
 *     CITE settings-accessories-cup-warmer .slate-caption [i=40] font-weight = 400  <-
 *          same rule, authored `var(--slate-weight-regular)` !important=yes
 *     CITE settings-accessories-cup-warmer .slate-caption [i=40] color = rgb(148, 161, 169)
 *          <- same rule, authored `var(--slate-muted)` !important=yes (token-driven)
 *     CITE settings-accessories-cup-warmer [prov-light] .slate-caption [i=40] color =
 *          rgb(90, 101, 108)  <- same rule    [= --ui-muted exactly: tokens.css:728
 *          #5a656c / :849 #94a1a9]
 *     Measured rect [629,295,238,24] under the heading's [629,265,238,26]:
 *     295 - (265+26) = 4, which is settings.js:3622's `gap-[4px]` = --ui-space-1.
 *     h=24 = 16 x the 1.5 leading `.ui-caption` carries. The `.ui-caption` role again.
 *
 *   THE LIVE READING  (Slate's <p id="cupWarmerCurrentTemp">)
 *     CITE settings-accessories-cup-warmer #cupWarmerCurrentTemp [i=54] font-size = 18px
 *          <- slate-shell.css `#subpage-host #settings-content-area
 *          [class*="text-[24px]"], ... [class*="text-[22px]"]` authored
 *          `var(--slate-text-md)` !important=yes (token-driven)
 *     CITE settings-accessories-cup-warmer #cupWarmerCurrentTemp [i=54] font-weight = 500
 *          <- slate-shell.css `#subpage-host #settings-content-area
 *          [class*="font-bold"], ... [class*="font-semibold"]` authored `500`
 *          !important=yes (FROZEN/hardcoded)
 *     CITE settings-accessories-cup-warmer #cupWarmerCurrentTemp [i=54] color =
 *          rgb(244, 247, 248) / [prov-light] rgb(23, 26, 28)  <- app.css
 *          `.text-\[var\(--text-primary\)\]` authored `var(--text-primary)`
 *          !important=no (token-driven)   [= --ui-text]
 *     Measured rect h=27 = 18 x 1.5, i.e. the DOCUMENT's leading, not the leading-[1.2]
 *     the markup asks for - so this file declares no line-height either. 18px at 500 is
 *     not one of the six type roles, so it is the only type the row declares itself:
 *     --ui-text-md + --ui-weight-medium, both named, neither invented.
 *
 *   THE ROW BOX  (slate-shell.css:1290-1297, read read-only - the corpus's 49 states
 *   probe the leaves' contents, not their row wrappers, so `find --cls content-stretch`
 *   returns one element and it is a card. No oracle answer exists; the source is the
 *   authority and every value in it is a token this file also has.)
 *     min-height    var(--slate-control-height)  = 64px  ->  --ui-control-h (tokens.css:88)
 *     padding-block var(--slate-space-3)         = 12px  ->  --ui-space-3   (tokens.css:267)
 *     gap           var(--slate-space-5)         = 24px  ->  --ui-space-5   (tokens.css:269)
 *     box-sizing    border-box                           ->  already on :host from base.js
 *
 *   THE GROUND, and why this row paints one where Slate's rows painted none.
 *     CITE settings-accessories-cup-warmer #right-panel [i=36] background-color =
 *          rgb(14, 19, 23)  <- slate-shell.css `#subpage-host #settings-body >
 *          #right-panel, #subpage-host #settings-navigation-container, #subpage-host
 *          #sub-categories-panel` authored `(NOT CAPTURED - set via a CSS shorthand)`
 *          !important=yes (token-driven)
 *     CITE settings-accessories-cup-warmer [prov-light] #right-panel [i=36]
 *          background-color = rgb(242, 243, 243)  <- same rule
 *     Those two are --ui-fascia exactly (tokens.css:720 #f2f3f3, :841 #0e1317), so
 *     painting --ui-fascia on the row reproduces the measured pixel where Slate puts
 *     it. It is declared rather than inherited because CONVENTIONS §13 trap 1 is not
 *     survivable otherwise - "a cell that paints nothing is a hole" - and a leaf is a
 *     column of these rows over a seam ground. §13's own table: "a cell that is a
 *     component paints itself".
 *
 *   THE DIVIDER IS NOT DRAWN HERE, and that is CONVENTIONS §13. Slate separates
 *   settings rows with 43 identical `<hr class="border-t slate-hairline w-full" />`
 *   plus 5 rows that draw a border-top themselves (§13's counted table). Both shapes
 *   become the container's 1px grid gap: N rows give N-1 seams with no sibling
 *   selector and no <hr> elements. This component declares no border of any kind and
 *   the suite asserts border-*-width stays 0 on every row including the first.
 *
 * ===========================================================================
 * DELIBERATE DEPARTURES, each asserted as a departure in the rendering suite
 * ===========================================================================
 *
 * 1. THE ROW IS A TAG, NOT A CLASS SHAPE. That is T13's whole remedy and it is
 *    described in full above.
 *
 * 2. THE RANGE HINT'S INK IS --ui-muted, NOT --ui-text AT opacity 0.6.
 *    Slate paints it `var(--text-primary)` under `.opacity-60` (both CITEd above).
 *    Three reasons, and the first is the token sheet's own:
 *      (a) styles/tokens.css:432-451 records that state opacity is ONE family -
 *          --ui-opacity-disabled .38, --ui-opacity-dim .62/.42 - and that the family
 *          exists because Slate had "three numbers for one state ... exactly the drift
 *          this family exists to end". A fourth literal 0.6 for a permanently
 *          secondary ink is that drift with a new face.
 *      (b) opacity on a text node is not an ink. It multiplies through everything
 *          inherited, so a disabled row would dim twice, and the dial that expresses
 *          "disabled" is the base's, not this file's.
 *      (c) --ui-muted is the named ink for exactly this ("labels, units, disabled",
 *          tokens.css:728) and the CAPTION in the same label block already uses it, so
 *          the row's two secondary texts stop being two different greys.
 *    Size and weight are unchanged: 17px / 400, i.e. the measured values, through
 *    the `.ui-body` role. Recorded as a deferred question - reversing it is one
 *    declaration.
 *
 * 3. THE LIVE READING SITS IN THE LABEL BLOCK. Slate's reference leaf puts it on the
 *    right, where the control goes (CITE #cupWarmerCurrentTemp rect x=1772, against the
 *    leaf measure's right edge at 1829). Spec §4.4 enumerates the row's anatomy the
 *    other way - "label block: heading + optional range hint + optional live reading +
 *    optional caption, one control on the right" - and SCOPE L2268 repeats it word for
 *    word. A Step 0 document beats the oracle on the ladder, and the reason is visible
 *    in Slate: a read-only row with the value on the right is indistinguishable in
 *    markup from a row with a control, so the "one control on the right" slot has two
 *    meanings. Here it has one. The reading keeps its measured type exactly.
 *
 * 4. THE GAP BETWEEN HEADING AND HINT IS --ui-space-3 (12px), NOT THE MEASURED 14.
 *    settings.js:3632 and :1452 both write `gap-[14px]`, which is off the 4/8/12/18/24/28
 *    scale. Bug T20 is that class: "Fourteen distinct gap-[Npx] literals pass through
 *    the shell's rhythm rules untouched". CONVENTIONS §12 requires every length to be a
 *    token or derived from one, so 14 snaps to the nearest step. Two pixels, named.
 *
 * 5. THE ROW WRAPS INSTEAD OF CRUSHING ITS CONTROL. Slate never meets a narrow
 *    container - its geometry is frozen at 1920x1200 and the oracle is DISQUALIFIED for
 *    responsive behaviour (Part 10 §4) - so LAYOUT_SPEC_DRAFT.md governs. §2.3 case 4
 *    makes a minimum floor on a flex track REQUIRED, not merely permitted, and T9/T10
 *    are the counter-examples the spec's Settings section calls active-attention
 *    (SCOPE L2288: "controls hold their stated size ... a control cluster never
 *    overflows its own track"). So: the label block carries a floor, the control track
 *    is `flex: none`, and when the two no longer fit the CONTROL DROPS TO ITS OWN LINE.
 *    There is no `@media (width...)` and no `@container` query in this file - the wrap
 *    is intrinsic, so the row has no threshold to get wrong.
 *
 * 6. THE LABEL TEXT BREAKS RATHER THAN SPILLING, so settings.js:1455's
 *    `whitespace-nowrap` on the hint is NOT carried.
 *    Slate's nowrap is a frozen-viewport choice: at 1920x1200 every hint fits beside its
 *    heading, so nothing there ever asks what a hint should do when it does not fit. Here
 *    it does. With `white-space: nowrap` and the flex default `min-width: auto` the hint
 *    can neither wrap nor shrink, so it leaves the row: measured, a 300px column with
 *    heading "Target temperature" and hint "30-80 °C (Celsius), 86-176 °F (Fahrenheit)"
 *    put the row's scrollWidth at 327 against a clientWidth of 300 - 27px outside the
 *    row, clipped without a mark by any pane with `overflow: hidden`. That is exactly
 *    what §2.4 forbids ("at no point does anything tell the user content was removed"),
 *    and the oracle is DISQUALIFIED here for the same reason as DEPARTURE 5: this is
 *    responsive behaviour and LAYOUT_SPEC_DRAFT.md governs it.
 *    What ships instead is `min-inline-size: 0` plus `overflow-wrap: anywhere` on BOTH
 *    the heading and the hint - the identical rule and the identical reason as the
 *    sibling compound in this wave, ui-definition-card.js:390-396. NOTHING CHANGES AT
 *    ANY WIDTH SLATE WAS CAPTURED AT: normal wrapping breaks only where there is no room,
 *    so a range still sits on one line whenever one line exists, and `anywhere` is the
 *    last resort for a single token longer than the column. Reversing it is restoring one
 *    declaration; recorded as a deferred question.
 *
 * ===========================================================================
 * THE ACCESSIBLE NAME, and why this row hands it to the control
 * ===========================================================================
 *
 * Slate names its settings controls by pointing at the row's own label:
 *     settings.js:1452  <p id="flush-temp-label" class="slate-heading">...
 *     settings.js:1465  <input ... aria-labelledby="flush-temp-label" ...>
 * A cross-root `aria-labelledby` cannot do that: an IDREF resolves inside one tree, and
 * the heading now lives in this shadow root. Component #5 anticipated exactly this in
 * its own header (ui-switch.js:27-33): "the accessible name come from the light DOM -
 * `aria-label` on the host, or `aria-labelledby` pointing at the settings row's own
 * label, which could not reach an input sealed inside a shadow root. Bug T15 records
 * the cost of getting this wrong in Slate: four of twenty switches have no accessible
 * name."
 *
 * So the row hands the name over, once, by the route each control actually reads:
 *   0. A control THAT ALREADY NAMES ITSELF is left alone. Its text is its name, and
 *      replacing it with the row's heading would make the control operable by voice only
 *      under a phrase that does not appear on it - WCAG 2.5.3 Label in Name. A button
 *      reading "Start" in a row headed "Descale the machine" keeps "Start".
 *      THE TEST IS THE ROLE, NOT textContent, and the difference is the whole rule.
 *      "Names itself" means (a) the text is the element's OWN - light DOM that is not in
 *      a named slot, so a glyph a screen puts in ui-stepper's `slot="increment"` or one
 *      of ui-bank's `slot="item-N"` does not count - and (b) the element's role is one
 *      that takes its name FROM CONTENTS (button, link, heading, cell, switch, tab, ...).
 *      A bare textContent test answers YES for `<select><option>Celsius</option></select>`
 *      and for `<textarea>notes</textarea>`, because a native select always has its
 *      options as textContent - and role combobox and role textbox are named by an author
 *      and NEVER by their contents. That test would therefore pre-empt rule 2 for exactly
 *      the two native controls rule 2 lists, and the row would silently ship an unnamed
 *      control: T15's own "four of twenty switches have no accessible name" clause,
 *      re-created inside the primitive built to end it.
 *   1. A `ui-*` control that declares a `label` property gets `el.label = heading`.
 *      That is #1 ui-button, #3 ui-bank, #4 ui-stepper and #7 ui-select - all four of
 *      the row's declared dependencies that have one - and it is the route their own
 *      code already uses to write their name, so nothing races and nothing is
 *      clobbered on the next render.
 *   2. Anything else that can CARRY a name - a native button/input/select/textarea, or
 *      any element with an explicit `role` - gets `aria-label`. That is #5 ui-switch,
 *      whose host is `role="switch"` (ui-switch.js:341).
 *   3. EVERYTHING ELSE IS LEFT ALONE. A role-less wrapper is never given an
 *      `aria-label`, because that is bug T15's own second clause - "aria-label on
 *      role-less divs" (settings.html:43-44) - and a name on a generic is announced by
 *      nothing.
 * An author's own name always wins: a control that already carries `aria-label`,
 * `aria-labelledby` or a non-empty `label` is never touched, and `no-auto-label` turns
 * the whole thing off. What the row wrote, the row removes when the heading goes away.
 *
 * ===========================================================================
 * GATE 2 - WHERE THE SERVER DATA COMES FROM
 * ===========================================================================
 *
 * NO SERVER KEY APPEARS IN THIS FILE and no frame is read here. `heading`, `hint` and
 * `caption` are the screen's strings; the CONTROL is slotted and owns its own value;
 * and `reading` arrives as a READING, which is the address layer's own currency
 * (src/data/reading.js, re-exported by src/data/rea-address.js). Two functions are
 * imported from it and they are the only data logic in the component:
 *   - `isNoReading` - absence is a STATE. An absent reading renders the dash, exactly
 *     as the address layer's contract says ("absence renders as a gap or a dash").
 *   - `toText` - "the presentation adapter for a scalar field", so a non-finite number
 *     becomes the dash rather than the string "NaN".
 * There is no `?? compute` anywhere below (A7): the row never invents a number, never
 * substitutes a default and never falls back to a second source. A screen with no live
 * reading simply does not set the property.
 *
 * NO LIMITS TABLE. The range HINT is a string the screen passes; this component parses
 * nothing, clamps nothing and validates nothing. B2/R2 allow exactly one ranges table
 * in the skin, behind the `r2MachineLimits` adapter tag, and a second one here - even
 * one that only formatted "135-165" - would be this wave's stated block. No number of
 * any kind appears in this file's strings.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   - NO STORE, NO FETCH, NO ROUTE. Compounds consume src/stores/; this one is
 *     underneath that line and consumes nothing.
 *   - NO CONTROL IMPLEMENTATION. The five archetypes are #4/#5/#3/#7/#1, all shipped;
 *     the row slots them and owns the space around them. Importing one would make a
 *     stepper row and a switch row two components instead of one, which is the
 *     duplication the primitive exists to end.
 *   - NO SELECTION LOOK OF ANY KIND. A settings row does not choose among
 *     alternatives; the bank inside it does. The four dials are not imported and the
 *     suite asserts that retargeting all four moves nothing on the row (Part 10 §12,
 *     spec §3.9: no component in this wave may own a private selected look).
 *   - NO SEPARATOR, NO SCROLL REGION, NO !important, NO colour literal, NO @font-face.
 *
 * API
 *   <ui-settings-row heading="Enable cup warmer"
 *                    caption="Warm your cups on the top plate">
 *       <ui-switch checked></ui-switch>
 *   </ui-settings-row>
 *
 *   <ui-settings-row heading="Target temperature" hint="30-80 °C">
 *       <ui-stepper></ui-stepper>
 *   </ui-settings-row>
 *
 *   <ui-settings-row heading="Current temperature" .reading=${plateTemp}
 *                    .readingFormat=${(c) => formatTemp(c, 1)}></ui-settings-row>
 *
 *   heading / hint / caption   strings; each renders its element only when non-empty
 *   note                       a SECOND caption line, under the first. Same type role,
 *                              same ink; it exists because Slate prints two of these
 *                              paragraphs where a control's own requirement has to be
 *                              said next to the control (the steam-stop block's
 *                              milk-probe note). Empty renders nothing
 *   reading                    a READING: a number, a string, or an absence object.
 *                              UNSET (or null) renders no reading element at all;
 *                              an absence object, a non-finite number, or the attribute
 *                              written with no value (reading="") renders `dash`
 *   readingFormat              (number) => string. Default String
 *   dash                       the absence glyph, default the em dash. i18n-free
 *   controlLabel               overrides the name handed to the control
 *   no-auto-label              stop handing the name over at all
 *   .control                   the assigned control elements, for a test or a screen
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { isNoReading, toText } from 'src/data/reading.js';

/**
 * The absence glyph. Same default as `toText`'s (src/data/reading.js:100), and the same
 * reason for it being a property: the module stays i18n-free and a caller may change it.
 */
export const DEFAULT_DASH = '—';

/**
 * Native elements that can carry an accessible name without being given a role.
 * Deliberately short: this is the list of things `aria-label` is defined to name, not a
 * list of things it happens not to crash on. `a` is absent because a bare anchor with no
 * href is not a link and naming it would be T15's third clause again.
 */
const NAMEABLE_ELEMENTS = new Set([
    'button', 'input', 'select', 'textarea', 'meter', 'progress', 'output',
]);

/** How a given control was named, so the row can un-name exactly what it named. */
const BY_PROPERTY = 'property';
const BY_ATTRIBUTE = 'attribute';

/** Whether `el` can carry an accessible name at all - see the header, rule 3. */
function isNameable(el) {
    if (el.hasAttribute('role')) return true;
    if (el.localName === 'a') return el.hasAttribute('href');
    return NAMEABLE_ELEMENTS.has(el.localName);
}

/**
 * ARIA roles whose accessible name comes from the element's OWN CONTENTS - "Name From:
 * author, contents" in the role definitions (ARIA 1.2 §5.3). This is the list rule 0
 * actually needs: it is the set of roles for which the visible text IS the accessible
 * name, and therefore the set for which handing over the row's heading would be WCAG
 * 2.5.3 Label in Name. `combobox` and `textbox` are NOT here, which is the whole point -
 * a <select> and a <textarea> always have contents and are never named by them.
 */
const NAME_FROM_CONTENTS_ROLES = new Set([
    'button', 'cell', 'checkbox', 'columnheader', 'gridcell', 'heading', 'link',
    'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'radio', 'row',
    'rowheader', 'switch', 'tab', 'tooltip', 'treeitem',
]);

/**
 * The implicit role of the native elements a settings row can plausibly be handed - BOTH
 * directions, because the question rule 0 asks has to be answerable with a NO as
 * confidently as with a YES. `input` is mapped to textbox for the same reason it does not
 * matter which input: every input is a void element, so it has no contents to be named by
 * and rule 0 cannot fire on one whatever its type.
 */
const IMPLICIT_ROLES = new Map([
    ['button', 'button'], ['summary', 'button'],
    ['h1', 'heading'], ['h2', 'heading'], ['h3', 'heading'],
    ['h4', 'heading'], ['h5', 'heading'], ['h6', 'heading'],
    ['td', 'cell'], ['th', 'columnheader'], ['option', 'option'], ['li', 'listitem'],
    ['input', 'textbox'], ['select', 'combobox'], ['textarea', 'textbox'],
    ['meter', 'meter'], ['progress', 'progressbar'], ['output', 'status'],
]);

/**
 * The role this element exposes: an explicit `role` (first token, as the attribute is a
 * fallback list), else the implicit role of a native. '' means "cannot be answered from
 * the markup", which for a custom element is a real answer and is handled at the call
 * site.
 */
function roleOf(el) {
    const explicit = String(el.getAttribute('role') ?? '').trim().split(/\s+/)[0];
    if (explicit) return explicit.toLowerCase();
    if (el.localName === 'a') return el.hasAttribute('href') ? 'link' : '';
    return IMPLICIT_ROLES.get(el.localName) ?? '';
}

/**
 * The text this element would expose as ITS OWN name: the light-DOM text that is NOT
 * assigned to a named slot. A glyph a screen puts in `slot="increment"` is a part of the
 * control, not the control's name - #4 ui-stepper renders it inside its own
 * `<button aria-label="Increase ...">` (ui-stepper.js:750) and #3 ui-bank renders it
 * inside one item (ui-bank.js:641). Counting it would make the row treat a decorated
 * stepper as self-naming and leave it anonymous.
 */
function ownText(el) {
    let text = '';
    for (const node of el.childNodes) {
        if (node.nodeType === 1 && node.hasAttribute('slot')) continue;
        text += node.textContent ?? '';
    }
    return text.trim();
}

/**
 * Rule 0's real question: does this control's VISIBLE TEXT already give it its accessible
 * name? Two conditions, and both are load-bearing:
 *   - the text has to be the element's own (`ownText`), not a glyph in a named slot;
 *   - the ROLE has to take its name from contents. A textContent test alone answers YES
 *     for `<select><option>Celsius</option></select>` and `<textarea>notes</textarea>`,
 *     whose roles (combobox, textbox) are named by an author and never by their contents
 *     - so a textContent test skips exactly the two native controls the header lists
 *     under rule 2 and ships them anonymous, which is bug T15 re-created inside the
 *     primitive built to end it.
 * A CUSTOM ELEMENT with no role of its own is the one case the markup cannot answer: it
 * may project that text straight into a <button> in its shadow root, which is what #1
 * ui-button does (`<slot>` inside `<button>`, ui-button.js:278-283), so `<ui-button>Start
 * </ui-button>` in a row headed "Descale the machine" must keep "Start". There the
 * visible text is trusted - the conservative answer, because being wrong that way leaves
 * a name that is READABLE ON THE CONTROL, and being wrong the other way leaves none.
 */
function namesItself(el) {
    if (ownText(el) === '') return false;
    const role = roleOf(el);
    if (role === '') return el.localName.includes('-');
    return NAME_FROM_CONTENTS_ROLES.has(role);
}

export class UiSettingsRow extends UiElement {
    static properties = {
        /** The label. Slate's <p class="slate-heading">; the `.ui-heading` type role. */
        heading: { type: String },
        /**
         * The range hint beside the heading - "30-80 °C". A STRING the screen composed;
         * this component owns no range table (B2/R2, see the header).
         */
        hint: { type: String },
        /** Explanatory copy under the label. Slate's <p class="slate-caption">. */
        caption: { type: String },
        /**
         * A SECOND caption paragraph, under the first, in the same role and the same
         * ink. Not a variant of `caption` and not a concatenation of it: Slate's
         * steam-stop block renders two sibling <p class="slate-caption"> elements
         * ([i=70] the row's own, [i=71] "Requires the Bengle milk temperature probe."),
         * and a screen that joined them into one string would lose the paragraph break
         * the oracle draws and would have no way to give the second line its own
         * condition. Empty renders no element, exactly like `caption`.
         */
        note: { type: String },
        /**
         * The live reading. A number, a string, or an absence object from
         * src/data/reading.js. Left unset, no reading element renders at all; set to an
         * absence, the dash renders - the difference between "this row has no reading"
         * and "this row's reading has not arrived", which is the whole point of the
         * address layer's absence contract.
         *
         * Untyped, so the attribute form carries a string and the property form carries
         * whatever the address layer returned. NOT reflected: an absence is an object
         * and reflecting it would serialise to "[object Object]".
         */
        reading: {},
        /** (number) => string. Runs only for a numeric reading, through `toText`. */
        readingFormat: { attribute: false },
        /** The absence glyph. */
        dash: { type: String },
        /** Overrides the name handed to the control; defaults to `heading`. */
        controlLabel: { type: String, attribute: 'control-label' },
        /** Stop handing the accessible name to the slotted control. */
        noAutoLabel: { type: Boolean, reflect: true, attribute: 'no-auto-label' },
    };

    static styles = [
        /* STRUCTURAL FRAGMENT FIRST (CONVENTIONS §4 rule 1, TYPE_ROLES.md rule 1).
         * Every rule in it is :where()-wrapped, so the row's own rules below win every
         * tie without a specificity fight and without an important flag. */
        typeRoles,
        css`
            /* ---------------------------------------------------------------
             * THE HOST IS THE ROW - and T13 dies on this rule.
             *
             * These four declarations ARE slate-shell.css:1293-1296. What changes is
             * not one value but what they are attached to: there, a class shape any
             * element could wear by accident and one did (settings.js:2391); here, a
             * shadow root that nothing outside can select into. box-sizing is already
             * on :host from base.js, which is the fifth line of that rule.
             * ------------------------------------------------------------- */
            :host {
                display: flex;

                /* DEPARTURE 5: the wrap is intrinsic. No query decides it, so there is
                 * no breakpoint here to be wrong at one geometry and right at another. */
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;

                /* SOURCE slate-shell.css:1296  gap: var(--slate-space-5)   = 24px */
                gap: var(--ui-space-5);

                /* SOURCE slate-shell.css:1294  min-height: var(--slate-control-height)
                 * A FLOOR, not a height: a row with a caption and a reading grows.
                 * --ui-control-h is 64px (tokens.css:88), the same number. */
                min-block-size: var(--ui-control-h);

                /* SOURCE slate-shell.css:1295  padding-block: var(--slate-space-3)
                 * THE 12px OF T13, now unreachable from outside this file. */
                padding-block: var(--ui-space-3);

                /* CITE #right-panel [i=36] background-color = rgb(14, 19, 23) /
                 * [prov-light] rgb(242, 243, 243)  =  --ui-fascia exactly.
                 * CONVENTIONS §13 trap 1: a cell that paints nothing is a hole. */
                background-color: var(--ui-fascia);

                /* THE LABEL BLOCK'S FLOOR, declared HERE and consumed below, which is a
                 * mechanical choice and not a tidy one: a custom property declared on
                 * .label could not be retuned from outside, because this file's own rule
                 * would beat the inherited value. On :host a screen's declaration wins
                 * (for normal declarations the outer tree beats :host, CSS Scoping §3.3),
                 * so this is a real theming hook in the same shape as ui-dialog's
                 * --_ui-dialog-inline. Derived from a token rather than picked: four
                 * control heights. See .label for why a floor is required at all. */
                --_ui-settings-row-label-min: calc(var(--ui-control-h) * 4);
            }

            /* ---------------------------------------------------------------
             * THE LABEL BLOCK - heading + hint, then reading, then caption.
             *
             * SOURCE settings.js:3621-3623, read read-only:
             *   <div class="flex flex-col gap-[4px]"> ... </div>
             * and the gap is confirmed by measurement: CITE .slate-caption [i=40] rect
             * y=295 against CITE .slate-heading [i=39] rect y=265 h=26  ->  295-291 = 4
             * = --ui-space-1 (tokens.css:265).
             *
             * THE FLOOR IS SPEC §2.3 CASE 4 - "minimum floors on a flex/grid track ...
             * These are REQUIRED, not merely permitted". It is what makes the control
             * drop to its own line instead of being crushed (T9/T10's class), and it is
             * derived from a token rather than picked: four control heights. The
             * min(100%, ...) half is what stops the floor becoming an overflow in a
             * container narrower than the floor itself. The value is declared on :host
             * above so a screen can retune one row; it is private (--_ui-) because it is
             * this component's geometry and not a token. */
            .label {
                display: flex;
                flex: 1 1 var(--_ui-settings-row-label-min);
                flex-direction: column;
                gap: var(--ui-space-1);
                min-inline-size: min(100%, var(--_ui-settings-row-label-min));

                /* THE LABEL STOPS BESIDE THE PAGE'S WIDEST CONTROL, not beside its own.
                 *
                 * Ben, 26 August 2026 (O1): "Where the setting has a long text description
                 * we should wrap the text earlier, don't go so close to the button ...
                 * maybe we look at the widest input in the page ... then have all text be
                 * to the left of that by some margin."
                 *
                 * --_ui-leaf-control-w IS THAT WIDEST CONTROL, published by settings-leaf
                 * after every render (see #measureControls there). This row does not
                 * measure it and cannot: a row sees one control, and the rule is about the
                 * page. Two gaps are subtracted, not one — the row's own gap between the
                 * label and the control, and the same again as the margin Ben asked for,
                 * so a short control leaves visible air rather than butting up.
                 *
                 * THE FALLBACK IS 0px, which makes the cap 100% minus two gaps: a row used
                 * outside a settings leaf — the gallery, a fixture — behaves as it always
                 * did, minus a gap of slack. Nothing here depends on the leaf existing. */
                max-inline-size: calc(
                    100% - var(--_ui-leaf-control-w, 0px) - 2 * var(--ui-space-5)
                );
            }

            /* The heading and its hint share a baseline.
             * SOURCE settings.js:3630  <div class="flex items-baseline gap-[14px]">
             * DEPARTURE 4: 14 -> --ui-space-3 (12px), bug T20's class.
             * It wraps, because a long heading beside a long hint in a narrow row has
             * to go somewhere and the alternative is horizontal overflow. */
            .line {
                display: flex;
                flex-wrap: wrap;
                align-items: baseline;
                gap: var(--ui-space-3);
                min-inline-size: 0;
            }

            /* THE HEADING DECLARES NO TYPE. .ui-heading is the measured record
             * exactly - 20px / 500 / --ui-text / 1.3 leading, and 20 x 1.3 = the 26px
             * the oracle measured. The two declarations are the flex floor that lets a
             * long heading wrap rather than widen the row, and DEPARTURE 6's
             * last-resort break - see below, and ui-definition-card.js:390-396, which is
             * the same rule in the sibling compound. */
            .heading,
            .hint {
                min-inline-size: 0;
                /* §2.4's no-silent-clip rule, at the level of one word: an unbroken
                 * token breaks rather than spilling out of the row. */
                overflow-wrap: anywhere;
            }

            /* THE HINT takes .ui-body for its 17px/400 (the measured pair) and
             * --ui-muted for its ink (DEPARTURE 2 - see the header for why the
             * measured opacity: 0.6 over --ui-text is not carried).
             * DEPARTURE 6: settings.js:1455 adds whitespace-nowrap to the same span on
             * the flush leaf and it is NOT carried - see the header. Normal wrapping
             * keeps a range on one line wherever there is room for it, which is every
             * width Slate was captured at, and breaks instead of overflowing where there
             * is not. */
            .hint {
                color: var(--ui-muted);
            }

            /* THE LIVE READING IS AN ASIDE, IN THE SAME TYPE AS THE OTHER ASIDE IN THIS
             * ROW - and getting there meant deciding which of Slate's two answers is
             * right, because Slate gives one thing two treatments.
             *
             * WHAT SLATE DOES, BOTH TIMES:
             *   CITE (hash)cupWarmerCurrentTemp [i=54] font-size = 18px <- var(--slate-text-md)
             *   CITE (hash)cupWarmerCurrentTemp [i=54] font-weight = 500 <- authored 500
             *   CITE (hash)cupWarmerCurrentTemp [i=54] color = --ui-text
             * ...on the Cup Warmer page. On the Steam page the same kind of line - the
             * live machine temperature beside the setting - is a quiet aside at 16 / 400
             * in the secondary ink. One kind of line, two looks, in one skin.
             *
             * THIS COMPONENT FOLLOWED THE CUP WARMER ONE, and the type audit of 26 August
             * caught what that costs: at 18 / 500 in the primary ink the reading COMPETES
             * WITH THE VALUE IN THE STEPPER beside it, which is 27 / 300 in the same ink.
             * A number you cannot change must never out-weigh the number you can.
             *
             * SO IT TAKES .ui-body AND --ui-muted, WHICH IS THE HINT S OWN TREATMENT. The
             * range beside the label is the same class of thing - context for the value,
             * not the value - and the audit calls Decal s secondary ink there "the
             * better call: a range is not a value". A live reading is not a value either.
             * One rule for one kind of line, and it is the rule this row already had.
             *
             * .ui-numeric STAYS, in the template: a readout that changes must not jitter
             * (type-roles.js:288-294). That is about the digits, not about the weight. */
            .reading {
                margin: 0;
                color: var(--ui-muted);
            }

            /* THE CONTROL TRACK. flex: none is SCOPE L2288's active-attention item for
             * this screen - "controls hold their stated size ... a control cluster never
             * overflows its own track" (T9: a select measured 214 in one leaf and 250
             * two rows below inside a single screen; T10: a cluster overflowing its own
             * 140px track by 53px). The track never shrinks, so the row wraps instead.
             * The gap is for the rare leaf with two controls in one row. */
            .control {
                display: flex;
                flex: none;
                align-items: center;
                gap: var(--ui-space-3);
            }
        `,
    ];

    /** What this row named, and how, so it can un-name exactly that. */
    #named = new WeakMap();

    constructor() {
        super();
        this.heading = '';
        this.hint = '';
        this.caption = '';
        this.note = '';
        this.reading = undefined;
        this.readingFormat = null;
        this.dash = DEFAULT_DASH;
        this.controlLabel = '';
        this.noAutoLabel = false;
    }

    /** The assigned control elements - what a screen or a test reaches for. */
    get control() {
        const slot = this.renderRoot?.querySelector?.('#control-slot');
        return slot ? slot.assignedElements({ flatten: true }) : [];
    }

    /**
     * The reading, as text.
     *
     * Three outcomes and no fourth: nothing at all when the property was never set, the
     * dash for an absence, and the formatted value for a reading. There is no
     * `?? compute` and no default number (A7).
     */
    get readingText() {
        const value = this.reading;
        /* Unset (or explicitly null) is "this row has no live reading" and renders no
         * element at all. The EMPTY STRING is the attribute form of an absence - writing
         * `reading` with no value declares that the row has a reading and that it has not
         * arrived - so it renders the dash, exactly as an absence object does. Two
         * different states, never conflated. */
        if (value === undefined || value === null) return null;
        if (value === '') return this.dash;
        if (isNoReading(value)) return this.dash;
        if (typeof value === 'number') {
            /* `toText` is the address layer's own presentation adapter: it is what turns
             * a non-finite number into the dash instead of into the string "NaN". */
            return toText(value, this.readingFormat || String, this.dash);
        }
        if (typeof value === 'string') return value;
        return this.dash;
    }

    /** The name this row would hand to its control. */
    get #controlName() {
        return String(this.controlLabel || this.heading || '').trim();
    }

    /**
     * Hand the row's label to the slotted control - the cross-root replacement for
     * Slate's `aria-labelledby="flush-temp-label"` (settings.js:1452, :1465), which a
     * shadow boundary makes impossible. Rules 0-3 are in the header; this is them.
     */
    #applyNames() {
        const name = this.noAutoLabel ? '' : this.#controlName;

        for (const el of this.control) {
            /* A custom element that has not upgraded yet has no `label` accessor and no
             * role, so it would fall through rule 3 and be skipped forever. Wait for it
             * once and re-run. */
            if (el.localName.includes('-') && !customElements.get(el.localName)) {
                customElements.whenDefined(el.localName)
                    .then(() => { if (this.isConnected) this.#applyNames(); })
                    .catch(() => {});
                continue;
            }

            const mine = this.#named.get(el) ?? null;

            /* RULE 0 - A CONTROL THAT NAMES ITSELF KEEPS THAT NAME.
             * A button reading "Start" in a row headed "Descale the machine" would, if
             * given the heading as its name, be operable by voice only under a phrase that
             * does not appear on it - WCAG 2.5.3 Label in Name. The visible text IS the
             * accessible name for anything whose ROLE takes name-from-contents, so the
             * row leaves those alone and the heading stays what it is: the row's label.
             * The test is the role, never bare textContent - see `namesItself`, and the
             * two native controls (<select>, <textarea>) a textContent test would silently
             * ship anonymous. */
            if (namesItself(el)) continue;

            /* RULE 1 - a ui-* control with its own `label` property. #1, #3, #4, #7. */
            if ('label' in el) {
                const authored = String(el.label ?? '').trim() !== '';
                if (authored && mine !== BY_PROPERTY) continue;   // the author's name wins
                if (!name) {
                    if (mine === BY_PROPERTY) { el.label = ''; this.#named.delete(el); }
                    continue;
                }
                if (el.label !== name) el.label = name;
                this.#named.set(el, BY_PROPERTY);
                continue;
            }

            /* RULE 3 first, stated as a guard: never name a role-less generic. That is
             * bug T15's own second clause, and a name on a generic is announced by
             * nothing anyway. */
            if (!isNameable(el)) continue;

            /* RULE 2 - anything that can carry a name gets `aria-label`. #5 ui-switch. */
            const authored = el.hasAttribute('aria-labelledby')
                || (el.hasAttribute('aria-label') && mine !== BY_ATTRIBUTE);
            if (authored) continue;
            if (!name) {
                if (mine === BY_ATTRIBUTE) { el.removeAttribute('aria-label'); this.#named.delete(el); }
                continue;
            }
            if (el.getAttribute('aria-label') !== name) el.setAttribute('aria-label', name);
            this.#named.set(el, BY_ATTRIBUTE);
        }
    }

    #onSlotChange = () => { this.#applyNames(); };

    updated(changed) {
        super.updated?.(changed);
        this.#applyNames();
    }

    render() {
        const heading = String(this.heading ?? '').trim();
        const hint = String(this.hint ?? '').trim();
        const caption = String(this.caption ?? '').trim();
        const note = String(this.note ?? '').trim();
        const reading = this.readingText;

        return html`
            <div id="label" class="label">
                ${heading || hint
                    ? html`<div id="line" class="line">
                        ${heading ? html`<p id="heading" class="ui-heading heading">${heading}</p>` : nothing}
                        ${hint ? html`<span id="hint" class="ui-body hint">${hint}</span>` : nothing}
                    </div>`
                    : nothing}
                ${reading === null
                    ? nothing
                    : html`<p id="reading" class="ui-body ui-numeric reading">${reading}</p>`}
                ${caption ? html`<p id="caption" class="ui-caption caption">${caption}</p>` : nothing}
                ${note ? html`<p id="note" class="ui-caption caption">${note}</p>` : nothing}
            </div>
            <div id="control" class="control">
                <slot id="control-slot" @slotchange=${this.#onSlotChange}></slot>
            </div>
        `;
    }
}

customElements.define('ui-settings-row', UiSettingsRow);
