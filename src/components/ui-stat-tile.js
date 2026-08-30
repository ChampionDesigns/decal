/**
 * ui-stat-tile.js - component #33 of the 57-component inventory: THE STAT TILE / GAUGE.
 *
 * Wave 2, item #33 (SCOPE Part 4, "Wave 2", L1552). Token-only: no data layer, no
 * ReaPrime, no endpoint, and no import from src/data/ or src/stores/ (wave law). The
 * label, the reading and the unit all arrive from outside as properties; this element
 * owns paint, the two-row track geometry, and nothing else.
 *
 * WHAT THE ROW SAYS, verbatim
 *   ITEMS.json #33 spec:  "DECISIONS.md:251 (named as a missing primitive)"
 *                         "the display type clamp() scale"
 *                         "NO_READING = '-' from the units.js port as the one
 *                          absent-value mark"      [the mark is an EM DASH, U+2014]
 *   ITEMS.json #33 notes: "Size: medium. Label-over-value readout cluster on Live.
 *                          Value track sized by the display type clamp() scale - today
 *                          the track is 44px against digits at 45px and 52px, so
 *                          promoted digits are clipped by the plot canvas (L2). Part 5's
 *                          'summary tile strip' is a row of #33, not a separate
 *                          component."
 *   ITEMS.json #33 bugs:  L2, and only L2.
 *   spec §5.2 #33:        "Stat tile / gauge | slate-live.css:939-946 | Named as a
 *                          missing primitive in DECISIONS.md:251."
 *                          (LAYOUT_SPEC_DRAFT.md:904)
 *   DECISIONS.md:251:     "Component library primitives that never existed: slider,
 *                          tile, confirm dialog, nav row, list row, toast."
 *
 * =========================================================================================
 * THE DISQUALIFICATION CHECK, RUN FIRST (prov_query.py --help, "DISQUALIFICATION")
 * =========================================================================================
 *  1. A DECISION SETTLING IT DIFFERENTLY. Two were, both at token level, and BOTH HAVE
 *     SINCE BEEN REVERSED at parity surfaces 0 and 1 — each was a LAYOUT_SPEC_DRAFT §3.5
 *     transcription its own citation (slate-tokens.css:148-153) refutes. The tracking is
 *     .12em again (surface 0) and the weights are Slate's four again (surface 1), so
 *     this tile's label renders 15px/600/.12em and its reading 300, which is the oracle
 *     exactly. The departures below are recorded as CLOSED rather than deleted, because
 *     what they say about the mechanism is still true.
 *  2. RESPONSIVE BEHAVIOUR. Disqualified everywhere - Slate is frozen at 1920x1200. What
 *     the tile does at a narrower container is governed by LAYOUT_SPEC_DRAFT.md:358-369
 *     (the fluid display scale) and §2.1 Rule 1, never by a measured Slate rect.
 *  3. THE 140 LAYOUT BUGS. Grepping LAYOUT_SPEC_DRAFT.md §7 for "gauge" returns exactly
 *     two rows, L2 and L3, and BOTH are this element:
 *       L2 - "The gauge cluster's value track is 44px against numbers at 45px and 52px.
 *             Measured #slate-live-time [488,248,69,52]; the cluster ends at 297, the
 *             chart begins at 298, so the promoted digits are clipped by the plot
 *             canvas." (slate-live.css:919-931, 959-968, 978, 2100-2107)
 *       L3 - "align-items: flex-end on .slate-gauge > strong is dead - same specificity,
 *             later baseline wins." (slate-live.css:949-951 vs :959-968)
 *     So Slate's GEOMETRY for this element is disqualified outright. Its PAINT is not,
 *     and the oracle answers for the paint are quoted verbatim below.
 *
 * =========================================================================================
 * ORACLE ANSWERS, quoted verbatim - state, element, property, value, winning rule
 * =========================================================================================
 * THE LABEL (a .slate-microcap - the "FLOW" cap over the flow gauge):
 *   CITE live-ready <span> [i=102] font-size = 15px  <-  slate-live.css
 *        `#main-page .slate-gauge > span:first-child`  authored `var(--slate-text-cap)`
 *        !important=yes  (token-driven)
 *   CITE live-ready <span> [i=102] color = rgb(148, 161, 169)  <-  slate-live.css
 *        `#main-page .slate-microcap, #main-page .slate-gauge > span:first-child,
 *        #main-page #weight-text, #main-page #shot-history-label`  authored
 *        `var(--slate-muted)`  !important=yes  (token-driven)
 *   CITE live-ready <span> [i=102] letter-spacing = 1.8px  <-  slate-live.css
 *        `#main-page .slate-microcap, ...`  authored `0.12em`  !important=yes
 *        (token-driven)
 *   CITE live-ready <span> [i=102] text-transform = uppercase  <-  slate-live.css
 *        `#main-page .slate-microcap, ...`  authored `uppercase`  !important=no
 *        (FROZEN/hardcoded)
 *   CITE live-ready <span> [i=102] font-weight = 600  <-  slate-live.css
 *        `#main-page .slate-microcap, ...`  authored `600`  !important=yes
 *        (FROZEN/hardcoded)
 *   CITE live-ready <span> [i=102] height = 18px, and dark rgb(148, 161, 169) /
 *        light rgb(90, 101, 108)   [prov_query.py themes --state live-ready --index 102]
 *        [= --ui-muted, styles/tokens.css:728 #5a656c / :849 #94a1a9 - exact, both themes]
 *
 * THE READING, at the resting step (--slate-display-lg):
 *   CITE live-ready #slate-live-pressure [i=100] font-size = 45px  <-  (no declaration -
 *        inherited or initial value)  (token-driven)
 *   CITE live-ready #slate-live-pressure [i=100] font-weight = 300  <-  (no declaration -
 *        inherited or initial value)  (FROZEN/hardcoded)
 *   CITE live-ready #slate-live-pressure [i=100] letter-spacing = normal  <-  (no
 *        declaration - inherited or initial value)  (FROZEN/hardcoded)
 *   CITE live-ready #slate-live-flow [i=103] font-size = 45px  <-  (no declaration -
 *        inherited or initial value)  (token-driven)
 *
 * THE READING, at the promoted step (--slate-display-xl), and THE PROMOTION ITSELF:
 *   CITE live-ready #slate-live-time [i=97] font-size = 52px  <-  (no declaration -
 *        inherited or initial value)  (token-driven)
 *   CITE live-ready #slate-live-time [i=97] color = rgb(244, 247, 248)  <-  (no
 *        declaration - inherited or initial value)  (token-driven)
 *        [= --ui-text, styles/tokens.css:847 #f4f7f8 dark / :726 #171a1c light]
 *   CITE live-pulling #slate-live-pressure [i=103] font-size = 52px  <-  (no declaration
 *        - inherited or initial value)  (token-driven)
 *   Rest 45px -> pulling 52px on the same element is the promotion, and it is the whole
 *   of what L2 breaks.
 *
 * THE CHANNEL TINT on a tinted reading (NOT owned here - see THE INK, below):
 *   CITE live-ready #slate-live-pressure [i=100] color = rgb(46, 194, 126)  <-
 *        slate-live.css  `#main-page .slate-gauge-pressure strong > span`  authored
 *        `var(--slate-data-pressure, var(--slate-live-pressure))`  !important=no
 *        (FROZEN/hardcoded)
 *   CITE live-ready #slate-live-flow [i=103] color = rgb(57, 123, 206)  <-
 *        slate-live.css  `#main-page .slate-gauge-flow strong > span`  authored
 *        `var(--slate-data-flow, var(--slate-live-flow))`  !important=no
 *        (FROZEN/hardcoded)
 *   [= --ui-channel-pressure #2ec27e and --ui-channel-flow #397bce,
 *    styles/chart-channels.css:101,103 - exact, and byte-identical in both themes]
 *
 * THE GEOMETRY THE ORACLE CAN VOUCH FOR, AND WHY IT IS QUOTED AS A DEFECT:
 *   CITE live-ready #slate-live-time [i=97] rect x=488 y=248 w=69 h=52
 *   CITE live-pulling #slate-live-pressure [i=103] rect x=710 y=248 w=72 h=52
 *   CITE      geometry above is Slate (captured at 1920x1200) and is FROZEN - quote it
 *   CITE      as what Slate does, never as Decal's responsive target
 *   CITE      (LAYOUT_SPEC_DRAFT.md governs responsive behaviour; the oracle has no vote).
 *   248 + 52 = 300, against a cluster that ends at 297 and a chart that begins at 298.
 *   That is L2, measured, in the oracle's own numbers.
 *
 * THE SOURCE RECORD, slate-live.css:899-978 + :2100-2107, read READ-ONLY (grid placement
 * and margins are outside the corpus's 18-property appearance surface, so the oracle says
 * so and stops):
 *     #main-page .slate-gauge-cluster {
 *         display: grid; height: 84px; min-height: 84px;          <- L2's mechanism
 *         grid-template-columns: 1.15fr repeat(6, minmax(0, 1fr));
 *         align-items: stretch; column-gap: 24px; padding: 8px 0 6px;
 *     }
 *     #main-page .slate-gauge {
 *         display: grid; grid-template-rows: auto 1fr;            <- CARRIED FORWARD
 *         row-gap: var(--slate-space-1); min-width: 0;
 *     }
 *     #main-page .slate-gauge > strong { display: flex; align-items: flex-end; }  <- L3, dead
 *     #main-page .slate-gauge > span:first-child {
 *         display: block; margin-bottom: 4px;
 *         font-size: var(--slate-text-cap) !important; line-height: 18px;
 *     }
 *     #main-page .slate-gauge strong {
 *         display: flex; align-items: baseline; color: var(--slate-text);
 *         font-family: var(--slate-font-numeric); font-size: var(--slate-display-lg);
 *         font-variant-numeric: tabular-nums; font-weight: 300; line-height: 1;
 *         white-space: nowrap;
 *     }
 *     #main-page .slate-gauge strong small {
 *         margin-left: 4px; color: var(--slate-muted);
 *         font-family: var(--slate-font-ui); font-size: var(--slate-text-sm);
 *         font-weight: 400;
 *     }
 *     #main-page .slate-gauge-time strong { font-size: var(--slate-display-xl);
 *         letter-spacing: -.02em; }
 *     #main-page[data-live-state="pulling"] :is(.slate-gauge-weight, .slate-gauge-time,
 *         .slate-gauge-pressure, .slate-gauge-flow) strong {
 *         font-size: var(--slate-display-xl); transition: font-size .25s ease;
 *     }
 *
 * AND THE COMMENT SLATE WROTE ABOVE IT, which is carried forward whole
 * (LAYOUT_SPEC_DRAFT.md Appendix item 4: "The label row is a row - a per-gauge two-row
 * grid with a fixed label track, so promoting a number does not drag its own label up"):
 *     "THE LABEL ROW IS A ROW. The cluster is bottom-aligned on the numbers, so a gauge
 *      with a larger value pushed its own caps label up and out of line - TIME sat 7px
 *      above the other six in the resting state, and in the pulling state the promoted
 *      four sat 22px above the rest. A two-row grid per gauge with a fixed label track
 *      puts every label on one baseline whatever size the number under it is."
 * Slate got that right. This file keeps the two-row grid and fixes what it sits in.
 *
 * =========================================================================================
 * L2, AND WHY IT IS INEXPRESSIBLE HERE
 * =========================================================================================
 * L2's mechanism is three declarations working together:
 *   (a) the cluster pins `height: 84px; min-height: 84px`;
 *   (b) padding 8+6 and a label track of 18+4+4 leave the value track 44px;
 *   (c) the number in that track is 45px at rest and 52px promoted.
 * 45 > 44 and 52 > 44, so the digits overflow their own cluster downward and the plot
 * canvas - a SIBLING that starts one pixel later - paints over them.
 *
 * The fix the row states is "value track sized by the display type clamp() scale", and
 * that is exactly what this file does:
 *
 *   grid-template-rows: var(--_ui-stat-label-h) minmax(var(--_ui-stat-value-reserve), auto)
 *
 * The value track's FLOOR is the same token the digits read, so (c) can never exceed (b):
 * they are one number. There is no (a) at all - this component declares no height, no
 * min-height and no max-height, so its own box always contains its own digits and there
 * is nothing to overflow out of. `minmax(X, auto)` rather than a fixed X because spec
 * §2.3 case 4 makes minimum floors REQUIRED rather than merely permitted: a fixed track
 * smaller than its line box clips, a floor grows. Drill --ui-display-xl to 120px and the
 * tile is taller; the digits are still inside it. That is asserted, at both geometries.
 *
 * THE RESERVE, and the other half of the promotion. Appendix item 3 is also carried
 * forward: "State changes weight, never position. [data-live-state] recomposes WITHIN the
 * existing tracks: nothing appears, disappears or slides mid-pull ... This is why the
 * screen is readable during a shot. Keep the rule." Slate bought that with the fixed 84px
 * that causes L2. This component buys it with `reserve`: a tile that will be promoted
 * declares the LARGEST step it can reach, so the track is already that tall at rest and
 * the digits grow into space that was always there. Nothing reflows mid-pull AND nothing
 * clips - the two are not in tension once the track and the type read one token.
 * `reserve` defaults to the tile's own size, so a summary tile strip (Part 5) that never
 * promotes reserves nothing.
 *
 * L3 IS NOT THIS ROW'S BUG but it is this element's, so this file must not re-grow it:
 * "align-items: flex-end on .slate-gauge > strong is dead - same specificity, later
 * baseline wins". There is exactly ONE alignment declaration per axis for the value box
 * here - `align-items: baseline` inside it (reading and unit share a baseline) and
 * `align-self: end` on it (the value box sits at the bottom of its track, which is what
 * Slate's dead `flex-end` was reaching for). Neither can be overridden by a later rule in
 * this sheet because there is no later rule.
 *
 * =========================================================================================
 * DELIBERATE DEPARTURES, each recorded in the wave-2 ledger
 * (_skinlab/realine-run/EXPECTED_CHANGES.jsonl, region ui-stat-tile) and each asserted AS
 * a departure in test/render/ui-stat-tile.render.test.mjs, so a silent drift back to
 * Slate's value is a red test too:
 * =========================================================================================
 *  1. NO FIXED HEIGHT ANYWHERE - the L2 fix itself, above. Slate: cluster
 *     `height: 84px; min-height: 84px` with a 44px residual value track. Here: a label
 *     track derived from --ui-text-sm and a value track floored at the display token.
 *     Visible change: the resting tile is ~4px taller in content than Slate's 70px, and
 *     the promoted digits are whole.
 *
 *  2. THE VALUE WEIGHT IS 300 — CLOSED AT PARITY SURFACE 1. It was 400 while the sheet
 *     carried three weights; --ui-weight-light is back and the reading renders Slate's
 *     own 300. Visible change: the readouts lighten, which is half of what Ben meant by
 *     "everything thick".
 *
 *  3. THE LABEL TRACKING IS .12em AND THE LABEL WEIGHT IS 600 — BOTH CLOSED, at parity
 *     surfaces 0 and 1 respectively. The label is now the oracle's own
 *     15px/600/.12em/--ui-muted, with no departure left in it.
 *
 *  4. THE TIME TILE LOSES ITS PRIVATE -.02em. Slate tightens exactly one gauge -
 *     `.slate-gauge-time strong { letter-spacing: -.02em }`, measured -1.04px at 52px -
 *     while the oracle reads every other gauge back as `letter-spacing = normal`. One of
 *     those two is the odd one out and there is no tracking token for display type, so
 *     authoring -.02em here would be an off-token literal in a component (CONVENTIONS §7).
 *     Every tile reads `normal`; --_ui-stat-value-tracking is the escape hatch if the
 *     bench wants the optical tightening back, and it is one line in the cluster.
 *
 *  5. THE TIME TILE'S UNIT GOES 16px -> 15px. Slate gives one gauge a 16px unit
 *     (`.slate-gauge-time strong small { font-size: var(--slate-text-note) }`) and the
 *     other six 15px. One unit size, --ui-text-sm, with --_ui-stat-unit-size as the
 *     escape hatch. --ui-text-sm's own comment is "uppercase microcaps" and the unit is
 *     the same register as the label.
 *
 *  6. THE TRANSITION IS TOKENISED: `font-size var(--ui-dur-slow) var(--ui-ease)` against
 *     Slate's `font-size .25s ease`. 250ms -> 200ms and the bare keyword -> the one
 *     curve (styles/tokens.css:428-430, "The easing curve is new: the old skin uses bare
 *     ease-out everywhere"). Plus a `prefers-reduced-motion: reduce` rule Slate has
 *     nowhere - CONVENTIONS §11 keeps that OUT of the base because the honest base
 *     version needs !important, and says it "belongs in styles/document.css or in each
 *     animating component". This is an animating component; the rule is its own, later in
 *     its own sheet, and needs no !important.
 *
 *  7. THE LABEL ELLIPSISES. Slate's microcap is `white-space: nowrap` with no overflow
 *     stated, so a long cap in a narrow gauge spills into its neighbour - E19's class
 *     ("white-space: nowrap ... with no overflow"). The oracle is disqualified here in
 *     any case: what a box does below 1920 is responsive behaviour. The READING never
 *     ellipsises - a clipped number is a wrong number, and the fluid scale is what
 *     absorbs a narrow container (departure 8).
 *
 *  8. THE DIGITS ARE FLUID, AND THE TILE IS NOT THEIR CONTAINER. LAYOUT_SPEC_DRAFT.md:368
 *     is explicit: "Upper bounds are the current values (slate-tokens.css:142-146); cqi
 *     resolves against THE GAUGE CLUSTER'S OWN CONTAINER." So this component opts out of
 *     the base's `container-type: inline-size` (CONVENTIONS §2's one-line opt-out) and
 *     queries an ancestor instead. It has to: seven tiles in a cluster are each ~1/7 of
 *     its width, so a per-tile container would resolve 4.2cqi against ~170px = ~7px and
 *     every tile in the skin would sit pinned at the clamp's 38px floor forever, with the
 *     clamp doing nothing. Sizing them together is the only reading under which the
 *     fluid scale means anything. The consumer that lays tiles out declares
 *     `container-type: inline-size`; see the gallery entry, which does it in every state.
 *
 * =========================================================================================
 * WHAT IS DELIBERATELY NOT HERE
 * =========================================================================================
 *   - NO SELECTION TREATMENT, and `selectionSurface` is deliberately not imported. Wave
 *     law: "NO private 'selected' look anywhere in this wave - a component expresses
 *     selection ONLY via the dial tokens." A readout has no selected state at all: it is
 *     not in the founding-defect callout's list (#3, #24, #25, #35, #45, and later
 *     #32/#36/#37/#39/#52), it exposes no aria-pressed / aria-selected / aria-checked /
 *     aria-current and no .is-selected, and nothing in this sheet paints a background at
 *     all. The four dials mean something only because there is ONE selection component
 *     (CONVENTIONS §4); a tile that grew a private highlight would be the fourteenth
 *     implementation the rewrite exists to prevent. Asserted, not merely asserted-to.
 *   - NO CHANNEL TABLE. Slate hard-codes seven per-gauge tint rules
 *     (`.slate-gauge-pressure strong > span` and six siblings). The sixteen channel
 *     colours live in styles/chart-channels.css and the map from a tile to a channel is
 *     the CLUSTER's, so the ink arrives as `--_ui-stat-ink: var(--ui-channel-flow)` from
 *     outside. A component that carried the list would have to be edited to add a
 *     channel, and a lookup table inside a primitive is the shape the wave law blocks for
 *     the stepper's limits. Same argument, same answer.
 *   - NO LIMITS, NO RANGES, NO FORMATTING, NO UNIT CONVERSION. `value` is already a
 *     string by the time it arrives. Rounding, C/F and the step precision are units.js's
 *     (CARRY_FORWARD.md:308) and belong to whatever calls this.
 *   - NO IMPORT OF NO_READING. src/stores/units.js:67 exports `NO_READING_MARK = '-'`
 *     [em dash] and src/data/reading.js:66 exports `NO_READING` as the absence VALUE, and
 *     wave law forbids a wave-2 component importing from either. The mark is a property
 *     with the same default, so the wave-4 screen that already imports units.js passes
 *     the module's own copy through and there is never a second constant in force.
 *   - NO PER-INSTANCE WORDING, and that is why there is no `absent-label` attribute. D11:
 *     "the shared component decides the wording - never per screen." The announced sentence
 *     comes from src/lib/i18n.js (D2), which IS the shared decision; see ACCESSIBILITY.
 *     Asserted, not merely asserted-to: the suite writes the attribute and proves it is
 *     inert, and moves the language and proves the announcement follows.
 *   - NO ACTION PILL. Slate paints one inside the gauge -
 *     `.slate-gauge strong > span.slate-gauge-action`, a hairline pill with its own ink
 *     and `color: ... !important`, "so it stops reading as a weight and starts reading as
 *     a button" (slate-live.css:983-996). It IS a button, so it is #1 ui-button, slotted.
 *     A private button treatment inside a readout is the founding defect's exact shape in
 *     a different family. Wave law: compose wave-1 primitives, never re-implement them.
 *   - NO HIT-AREA UTILITY. Row #33 cites none, and Appendix 5's three consumers are #15,
 *     #23 and #35 (CONVENTIONS §5). Nothing here is pressable. A slotted ui-button brings
 *     its own floor. A ::before overlay on a non-target would sit on top of whatever IS
 *     the target in that row.
 *   - NO ARIA STATE CONTRACT. Row #33 cites no Appendix 15 rule, and Appendix 15 is the
 *     aria-*-driven STATE selector for .slate-bank / .slate-stepper (CONVENTIONS §4) - a
 *     readout has no state a user can change. What IS handled is the accessible NAME of
 *     an absent reading; see ACCESSIBILITY.
 *   - NO `part()` THEMING SURFACE. Theming crosses the boundary through custom properties
 *     only (Part 4 ground rule 1; A6).
 *   - NO @media (width...). CONVENTIONS §2. The one media query here is
 *     prefers-reduced-motion, which is not a width query.
 *
 * =========================================================================================
 * ACCESSIBILITY
 * =========================================================================================
 * With a reading present, the label and the value are text in DOM order and a screen
 * reader gets "FLOW 2.1 ml/s" without a role, which is right: a tile is not a widget.
 *
 * With NO reading, the em dash is the problem. It is a GLYPH standing for a sentence -
 * units.js's own header comment says so: "The Live readout row wrote an em dash and the
 * derived list eight inches under it wrote an en dash - one idea, two marks, on one
 * screen" - and screen readers variously announce it as "em dash" or skip it silently,
 * so "FLOW" alone is what a blind user hears while a sighted one sees "FLOW -". The dash
 * therefore goes `aria-hidden` and the sentence is exposed as visually hidden text
 * through the SHARED `visuallyHidden` fragment (CONVENTIONS §5a - never a fourth copy).
 *
 * THE SENTENCE IS TRANSLATED, NOT PARAMETERISED (wave-2 review c3-6). It was a per-instance
 * `absent-label` attribute with an English default, on the argument that "a primitive that
 * reaches for a string catalogue is a primitive with a dependency". That argument loses to
 * two decisions. D2 (SCOPE.md:1772-1775): "translation as a value each component reads,
 * per-language files generated at build time. EVERY COMPONENT ON EVERY SCREEN BELOW IS
 * BUILT THAT WAY FROM ITS FIRST COMMIT; this is the one D-item that shapes the architecture
 * rather than the scope." D11 (SCOPE.md:2220): "the shared component decides the wording -
 * never per screen." A per-instance wording attribute is the exact surface D11 removes from
 * #31's save button, and it is worse here: seven tiles sit in one Live cluster, so seven
 * announcements of the same absence could differ - "one idea, two marks, on one screen"
 * (units.js's own header) in the accessibility tree, where nobody can see it drift.
 * src/lib/i18n.js is lib, not src/data/ or src/stores/, so the wave law permits it and #31
 * already imports it; the controller is ~20 lines, holds no DOM and fetches nothing.
 * The key IS its English text (i18n/source/README.md), so an unloaded store still answers
 * "no reading" - the announcement cannot go blank or become an identifier.
 *
 * =========================================================================================
 * API
 * =========================================================================================
 *   <ui-stat-tile label="Flow" value="2.1" unit="ml/s"></ui-stat-tile>
 *   <ui-stat-tile label="Time" value="24.6" unit="s" size="xl"></ui-stat-tile>
 *   <ui-stat-tile label="Pressure" value="9.0" unit="bar" reserve="xl"></ui-stat-tile>
 *   <ui-stat-tile label="Ratio"></ui-stat-tile>                     an absent reading
 *   <ui-stat-tile label="Weight" value="0" unit="g"></ui-stat-tile>  ZERO IS A READING
 *   <ui-stat-tile label="Weight"><ui-button slot="value">Retry</ui-button></ui-stat-tile>
 *   <ui-stat-tile label="Flow" value="2.1" unit="ml/s"
 *                 style="--_ui-stat-ink: var(--ui-channel-flow)"></ui-stat-tile>
 *
 *   size    xs|sm|md|lg|xl - which display step the digits read. Default lg.
 *   reserve xs|sm|md|lg|xl - the track floor, for a tile that will be promoted.
 *                            Defaults to `size`, i.e. no reserved space.
 *
 *   Custom properties a consumer may set (private by CONVENTIONS §7, which is what makes
 *   them a documented surface rather than a public token this component declares):
 *     --_ui-stat-ink              the reading's colour.   Default var(--ui-text).
 *     --_ui-stat-value-tracking   the reading's tracking. Default normal (departure 4).
 *     --_ui-stat-unit-size        the unit's size.        Default var(--ui-text-sm).
 *     --_ui-stat-label-h          the fixed label track.  Default 1.2 x --ui-text-sm.
 */

import { css, html, nothing } from 'lit';
import { UiElement, visuallyHidden } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';

/**
 * THE ONE ABSENT-VALUE MARK, U+2014 EM DASH.
 *
 * NOT imported. src/stores/units.js:67 is `export const NO_READING_MARK = '—';` and
 * this is byte-identical to it, but wave law forbids a wave-2 component importing from
 * src/stores/ or src/data/, and units.js is a store module carrying the C/F preference.
 * `dash` is a property with this as its default, so the wave-4 screen - which already
 * imports units.js - hands the module's own constant in and there is never a second
 * constant in force at runtime. Written as the escape so the two copies can be diffed
 * mechanically rather than by eye: an em dash and an en dash look alike, which is the
 * exact confusion units.js's header comment was written about.
 */
const NO_READING_MARK = '—';

/**
 * WHAT AN ABSENT READING IS CALLED OUT LOUD - a translation KEY, not a wording knob.
 *
 * D11 (SCOPE.md:2220): "the shared component decides the wording - never per screen." The
 * key is its own English text (i18n/source/README.md: "A key IS its English text. An
 * untranslated string therefore renders as English, never as a bare identifier"), and
 * i18n/source/strings.json:300 carries it. Lookup is case-insensitive and returns the
 * CALLER's casing for the source language, so this renders lowercase whether or not a
 * language file is loaded. See ACCESSIBILITY.
 */
const ABSENT_KEY = 'no reading';

export class UiStatTile extends UiElement {
    static properties = {
        /** The microcap over the reading. Always rendered, so the track never collapses. */
        label: { type: String },
        /**
         * The reading, already formatted. `null` / `undefined` / '' are ABSENT and render
         * the dash; 0 is a READING and renders as 0. reading.js:12-15 is the whole reason
         * that distinction is load-bearing: "A missing channel renders as a gap or a dash,
         * never as ... a zero that reads as a measurement."
         */
        value: { type: String },
        /** The unit suffix, in the label's register. Omitted when empty. */
        unit: { type: String },
        /** Which display step the digits read: xs|sm|md|lg|xl. */
        size: { type: String, reflect: true },
        /** The track floor, for a tile that will be promoted: xs|sm|md|lg|xl. */
        reserve: { type: String, reflect: true },
        /**
         * The absent-value mark. Defaults to units.js's own em dash.
         *
         * NOT the same shape as the announced sentence, and the difference is the wave law:
         * there is no importable single source for the MARK (units.js is src/stores/), so a
         * property is the only way the wave-4 screen can hand the module's own constant in,
         * while the SENTENCE has one - src/lib/i18n.js - and therefore gets no per-instance
         * surface at all. One idea, one source, in both cases (wave-2 review c3-6).
         */
        dash: { type: String },
        /** Internal: does the value slot carry anything? */
        _slotted: { type: Boolean, state: true },
    };

    /* STRUCTURAL FRAGMENT FIRST (CONVENTIONS §4 rule 1, §5a). `selectionSurface` is not
     * here at all, and that is the wave law - see WHAT IS DELIBERATELY NOT HERE. */
    static styles = [visuallyHidden, css`
        /* =================================================================
         * THE HOST IS THE TWO-ROW GRID.
         *
         * Carried forward whole from slate-live.css:933-946 and Appendix item
         * 4: "a per-gauge two-row grid with a fixed label track, so promoting
         * a number does not drag its own label up". One label track, one value
         * track; the label sits at the top whatever size the number is, the
         * number sits at the bottom of its own track so numbers share a
         * baseline across the cluster.
         * ================================================================= */
        :host {
            /* THE CONTAINER OPT-OUT (CONVENTIONS §2's one line, departure 8).
             * The base puts container-type: inline-size on :host, which is
             * right for anything filling a slot and wrong here: the display
             * scale is clamp(38px, 4.2cqi, 52px) and LAYOUT_SPEC_DRAFT.md:368
             * says "cqi resolves against the gauge cluster's own container".
             * Seven tiles in a cluster are each ~1/7 of it, so a per-tile
             * container would pin every reading in the skin at the clamp's
             * floor and the fluid scale would do nothing at all. The consumer
             * laying tiles out declares the container. */
            container-type: normal;
            display: grid;

            /* --- the private geometry surface (CONVENTIONS §7: --_ui-*) ---- */

            /* Which display step the digits read. Overridden per size below. */
            --_ui-stat-value-size: var(--ui-display-lg);

            /* THE VALUE TRACK'S FLOOR, and half of the L2 fix. It defaults to
             * the very token the digits read, so "the track" and "the number"
             * are one number and the track can never be the smaller of the
             * two. Slate had 44 against 45 and 52. A tile that will be
             * PROMOTED overrides this with reserve="xl" so the space is
             * already there and nothing reflows mid-pull (Appendix item 3). */
            --_ui-stat-value-reserve: var(--_ui-stat-value-size);

            /* THE FIXED LABEL TRACK. Derived, not restated (styles/tokens.css:25
             * "Derive, don't restate"): 1.2 x --ui-text-sm = 18px at 15px, which
             * is the microcap line box the oracle measures -
             *   CITE live-ready <span> [i=102] height = 18px
             * Slate authors the 18px as a literal line-height. Deriving it means
             * the track follows --ui-text-sm under a drill instead of stranding
             * an 18px box around a moved cap. */
            --_ui-stat-label-h: calc(var(--ui-text-sm) * 1.2);

            /* Departure 4: every tile reads normal, as six of Slate's seven do.
             *   CITE live-ready #slate-live-pressure [i=100] letter-spacing =
             *        normal <- (no declaration - inherited or initial value)
             *        (FROZEN/hardcoded) */
            --_ui-stat-value-tracking: normal;

            /* Departure 5: one unit size for every tile — and at parity surface 1 that
             * one size became THE ORACLE'S OWN, --ui-text-2xs (14px), where it had been
             * --ui-text-sm (15px) for no cited reason.
             *   ORACLE live-ready <small> [i=101] "bar" font-size = 14px <- slate-live.css
             *          .slate-gauge strong small, authored var(--slate-text-sm)
             *          (token-driven); [i=104] "mL/s" and [i=109] "°C" the same 14px.
             * --slate-text-sm's own comment in slate-tokens.css:129 is "column headers,
             * units", and Decal renamed that step --ui-text-2xs keeping the comment —
             * so this is the unit step by name on both sides, and <ui-stepper> already
             * drew its unit at it. Two components now render one role at one size.
             * WHAT DEPARTURE 5 STILL COVERS: Slate promotes the TIME gauge's unit one
             * step to --slate-text-note (16px, [i=98] "s") because that reading is
             * 52px. One size for every tile is still the rule here. */
            --_ui-stat-unit-size: var(--ui-text-2xs);

            /* The reading's ink. A CHANNEL TINT ARRIVES HERE FROM THE CLUSTER -
             * this component owns no channel table. Default is the plain ink,
             * which is what Slate's untinted gauges compute:
             *   CITE live-ready #slate-live-time [i=97] color = rgb(244, 247, 248)
             *        <- (no declaration - inherited or initial value) (token-driven) */
            --_ui-stat-ink: var(--ui-text);

            /* THE L2 FIX, IN ONE DECLARATION. Row #33: "Value track sized by
             * the display type clamp() scale". minmax(floor, ...) rather than a
             * fixed track because spec §2.3 case 4 makes minimum floors
             * REQUIRED: a fixed track smaller than its line box clips (E7's
             * class), a floor grows. There is deliberately NO height,
             * min-height or max-height on this element - Slate's cluster
             * carried height: 84px AND min-height: 84px, and that pair is
             * exactly what pushed 52px of digits into the plot canvas.
             *
             * THE MAXIMUM IS 1fr, WHICH IS SLATE'S OWN grid-template-rows:
             * auto 1fr (slate-live.css:937) AND ITS REASON, quoted from
             * slate-live.css:904-908: "STRETCH, so every gauge spans the
             * cluster and its two internal tracks line up with its neighbours'.
             * [end] bottom-aligned each gauge box independently, so a gauge
             * with a bigger number sat taller and dragged its own label up."
             * (CONVENTIONS §9: no backticks inside a css template, including
             * in comments - the quote's own backticks are dropped, not kept.)
             * A cluster stretches its tiles to the tallest of them; the fr
             * hands that extra height to the VALUE track, so the readings stay
             * on one line across the row instead of floating at the top of
             * their own boxes. With an indefinite height - a tile on its own -
             * one fr track resolves to its max-content contribution, so the
             * floor still governs and the tile is still exactly as tall as it
             * needs to be. */
            grid-template-rows:
                var(--_ui-stat-label-h)
                minmax(var(--_ui-stat-value-reserve), 1fr);

            /* SOURCE slate-live.css:940 row-gap: var(--slate-space-1). Slate
             * ALSO writes margin-bottom: 4px on the label, so the real gap is
             * 8px expressed as two 4s in two rules. One owner per dimension
             * (spec §2.3): the gap is the gap. */
            row-gap: var(--ui-space-1);

            /* SOURCE slate-live.css:945 min-width: 0 - so a tile in a cluster
             * track can shrink below its content rather than forcing the row
             * wider. Logical spelling. */
            min-inline-size: 0;
        }

        /* THE FIVE DISPLAY STEPS. :host([size=...]) is (0,2,0) and beats the
         * bare :host above whatever the source order. Authored as five rules
         * rather than a JS lookup so the step names live in CSS with the
         * tokens they name and nothing in this component holds a table. */
        :host([size="xs"]) { --_ui-stat-value-size: var(--ui-display-xs); }
        :host([size="sm"]) { --_ui-stat-value-size: var(--ui-display-sm); }
        :host([size="md"]) { --_ui-stat-value-size: var(--ui-display-md); }
        :host([size="lg"]) { --_ui-stat-value-size: var(--ui-display-lg); }
        :host([size="xl"]) { --_ui-stat-value-size: var(--ui-display-xl); }

        /* THE RESERVE, same five steps. A tile promoted from lg to xl mid-shot
         * carries reserve="xl" and its box never changes size. */
        :host([reserve="xs"]) { --_ui-stat-value-reserve: var(--ui-display-xs); }
        :host([reserve="sm"]) { --_ui-stat-value-reserve: var(--ui-display-sm); }
        :host([reserve="md"]) { --_ui-stat-value-reserve: var(--ui-display-md); }
        :host([reserve="lg"]) { --_ui-stat-value-reserve: var(--ui-display-lg); }
        :host([reserve="xl"]) { --_ui-stat-value-reserve: var(--ui-display-xl); }

        /* =================================================================
         * THE LABEL - a .slate-microcap over its own reading.
         * Resting paint on a CLASS, never an id (CONVENTIONS §4 rule 2, §9).
         * ================================================================= */
        .label {
            grid-row: 1;
            align-self: start;

            /* Departure 7. Slate states nowrap and no overflow, so a long cap
             * in a narrow gauge spills sideways into its neighbour (E19's
             * class). The oracle is disqualified for this anyway - a container
             * narrower than 1920 is responsive behaviour and Slate has none.
             * min-inline-size: 0 because a grid item floors at min-content by
             * default, and without it the box is overflowed rather than
             * clamped - which would defeat the ellipsis silently. */
            min-inline-size: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            /* NOWRAP BY DEFAULT AND WRAPPING WHEN A CALLER SAYS SO.
             *
             * Every tile in the gauge cluster is one word wide and nowrap is right for all
             * of them. The exception is a tile used as a BUTTON'S face, where the cap is a
             * sentence — "Rate this shot" — in a column sized by the band beside it, and
             * ellipsising it leaves a control reading "RATE THIS…".
             *
             * A CUSTOM PROPERTY AND NOT A ::part, deliberately: the part surface is argued
             * for two files and a third would have to be
             * argued there (overlay-hygiene.test.mjs). What a caller wants here is a VALUE
             * the component already has an opinion about, which is exactly what a custom
             * property is for. */
            white-space: var(--_ui-stat-label-wrap, nowrap);

            /*   CITE live-ready <span> [i=102] color = rgb(148, 161, 169) <-
             *        slate-live.css {#main-page .slate-microcap, #main-page
             *        .slate-gauge > span:first-child, ...} authored
             *        var(--slate-muted) !important=yes (token-driven)
             *   [dark rgb(148, 161, 169) / light rgb(90, 101, 108) = --ui-muted,
             *    styles/tokens.css:849 / :728 - exact, both themes] */
            color: var(--ui-muted);

            /* Restated deliberately against CONVENTIONS §11's default: the
             * cluster around this tile sets no family, and Slate names the UI
             * family on the microcap while the reading below reads the numeric
             * family. Both resolve to one token here (tokens.css:346-347: "One
             * family, not two: the old --slate-font-numeric was already defined
             * as var(--slate-font-ui)"), and never an @font-face in a component
             * (spec §6.3 Rule 2, measured). */
            font-family: var(--ui-font-family);

            /*   CITE live-ready <span> [i=102] font-size = 15px <- slate-live.css
             *        {#main-page .slate-gauge > span:first-child} authored
             *        var(--slate-text-cap) !important=yes (token-driven)
             *   [= --ui-text-sm 15px, styles/tokens.css:352 "uppercase microcaps"] */
            font-size: var(--ui-text-sm);

            /* Oracle: font-weight = 600, authored 600 (FROZEN/hardcoded), and the
             * token now IS 600 — parity surface 1 restored --ui-weight-semibold. */
            font-weight: var(--ui-weight-semibold);

            /* Oracle: letter-spacing = 1.8px, authored 0.12em — and the token has
             * been .12em since parity surface 0, so this is exact. */
            letter-spacing: var(--ui-tracking-cap);

            /* The line box IS the track, so the label fills row 1 exactly and
             * every label in a cluster sits on one baseline - which is the
             * whole point Slate's comment makes. Slate writes line-height: 18px
             * as a literal; this is the same 18px derived from --ui-text-sm. */
            line-height: var(--_ui-stat-label-h);

            /*   CITE live-ready <span> [i=102] text-transform = uppercase <-
             *        slate-live.css {#main-page .slate-microcap, ...} authored
             *        uppercase !important=no (FROZEN/hardcoded) */
            text-transform: uppercase;
        }

        /* =================================================================
         * THE VALUE BOX.
         *
         * ONE ALIGNMENT DECLARATION PER AXIS, and there is no later rule in
         * this sheet that could shadow either - which is L3 made impossible
         * ("align-items: flex-end on .slate-gauge > strong is dead - same
         * specificity, later baseline wins").
         *   align-items: baseline  the reading and its unit share a baseline
         *                          (SOURCE slate-live.css:960, the surviving
         *                          half of L3's pair)
         *   align-self: end        the box sits at the BOTTOM of its track,
         *                          which is what Slate's dead flex-end reached
         *                          for and what makes readings of different
         *                          sizes share a line across a cluster
         * ================================================================= */
        .value {
            grid-row: 2;
            align-self: end;
            display: flex;
            align-items: baseline;
            min-inline-size: 0;

            color: var(--_ui-stat-ink);
            font-family: var(--ui-font-family);
            font-size: var(--_ui-stat-value-size);

            /* SOURCE slate-live.css:963. Not negotiable on a readout changing
             * fifteen times a second: proportional digits make the number jitter
             * sideways on every frame. Outside the corpus's 18-property surface,
             * so read read-only from the source. */
            font-variant-numeric: tabular-nums;

            /* Oracle: font-weight = 300 (FROZEN/hardcoded) — and --ui-weight-light IS
             * 300 since parity surface 1, so the reading is Slate's exactly.
             * CITE live-ready #slate-live-pressure [i=100] font-weight = 300 (inherited
             *      from .slate-gauge strong, slate-live.css:959, which authors
             *      font-weight: var(--slate-weight-light)). */
            font-weight: var(--ui-weight-light);

            letter-spacing: var(--_ui-stat-value-tracking);

            /* SOURCE slate-live.css:964. The line box is then exactly the font
             * size, which is what lets the track floor and the type read ONE
             * token - see the L2 note on :host. */
            line-height: 1;

            /* SOURCE slate-live.css:965. A reading never wraps and never
             * ellipsises: a clipped number is a WRONG number. What absorbs a
             * narrow container is the fluid scale (departure 8), not a clip. */
            white-space: nowrap;

            /* Departure 6. Slate: transition: font-size .25s ease. */
            transition: font-size var(--ui-dur-slow) var(--ui-ease);
        }

        /* Departure 6's other half. CONVENTIONS §11 keeps this OUT of the base
         * because the honest base version needs !important, and says it
         * "belongs in styles/document.css or in each animating component".
         * This is an animating component. Same selector, later in the same
         * sheet, so it wins on order with no !important - CONVENTIONS §6's
         * "To override a base rule, write the rule", applied to my own.
         * NOT a width query: CONVENTIONS §2 bans @media (width...), and this
         * is a user preference the container cannot express. */
        @media (prefers-reduced-motion: reduce) {
            .value { transition: none; }
        }

        /* The reading itself. It carries no paint of its own - the ink is on
         * .value so that currentColor, and therefore a slotted control, inherits
         * the same tint. */
        .reading {
            min-inline-size: 0;
        }

        /* ===================================================================
         * AN ABSENT READING IS MUTED - SLATE'S OWN STATE RULE (parity surface 1)
         *
         * SOURCE slate-live.css, the rule
         *        #main-page .slate-gauge.slate-is-absent strong > span,
         *        #main-page .slate-gauge.slate-is-absent strong
         *        { color: var(--slate-muted) !important }
         * ORACLE state=live-ready element=[108] <span id="data-group-temp"> text "—"
         *        property=color value=rgb(148, 161, 169) <- that rule, !important=yes;
         *        element=[111] <span id="data-steam-temp"> the same, same value. Both
         *        gauges declare a channel colour (--slate-data-group-temperature
         *        #c94e4b, --slate-data-steam-temperature #b13933) and NEITHER paints
         *        it, because the reading is absent - the state rule outranks the role.
         *
         * THIS IS WHY THE CHANNEL TABLE COULD MOVE TO THE CLUSTER WITHOUT MOVING THE
         * ABSENCE RULE WITH IT. The tint is a fact about which channel a tile shows;
         * being muted is a fact about having nothing to show, which every tile knows
         * about itself. A cluster that had to remember to un-tint an empty tile is a
         * cluster that will forget - and a channel-coloured em dash reads as a
         * measurement, which is the A7 class of defect this file already refuses in
         * its value contract (null / undefined / empty are ABSENT ... 0 is a
         * READING). It is stated on .value, not on .reading, so a slotted control
         * inherits it through currentColor exactly as the tint does. */
        .value.is-absent {
            color: var(--ui-muted);
        }

        /* =================================================================
         * THE UNIT - SOURCE slate-live.css:970-977.
         * ================================================================= */
        .unit {
            /* SOURCE margin-left: 4px -> --ui-space-1, logical spelling. */
            margin-inline-start: var(--ui-space-1);

            /* SOURCE color: var(--slate-muted). Same ink as the label: the unit
             * is the label's register, not the reading's. */
            color: var(--ui-muted);

            /* Departure 5: one size for every tile's unit. */
            font-size: var(--_ui-stat-unit-size);

            /* SOURCE font-weight: 400. Already the token's value, stated because
             * .value above sets a weight the unit must not inherit if that token
             * ever moves independently. */
            font-weight: var(--ui-weight-regular);

            /* The reading's tracking is the reading's. A unit is a word. */
            letter-spacing: normal;
        }

        /* The slot for an ACTION in the value's place - Slate's
         * .slate-gauge-action, which is a button and is therefore #1 ui-button
         * slotted in rather than a private pill re-drawn here. Nothing is
         * painted on it: it brings its own paint, its own hit floor and the one
         * focus ring (the base rings ::slotted(:focus-visible), CONVENTIONS §3a).
         * The slot is display: contents so it does not add a box between the
         * flex line and the control. */
        slot[name="value"] {
            display: contents;
        }

        /* .a11y is the SHARED visuallyHidden fragment above, not a fourth copy
         * (CONVENTIONS §5a). It names an absent reading - see ACCESSIBILITY. */
    `];

    constructor() {
        super();
        this.label = '';
        this.value = null;
        this.unit = '';
        this.size = 'lg';
        this.reserve = '';
        this.dash = NO_READING_MARK;
        this._slotted = false;
        /* D2's mechanism, same spelling as #31 (ui-page-header.js:396) so the wave has one
         * shape for this and not two. The controller subscribes on connect and requests an
         * update on a language change, so the announcement re-renders through the template
         * rather than by anyone reaching into this root. */
        this.i18n = new I18nController(this);
    }

    /**
     * ABSENCE IS NOT FALSINESS. reading.js:12-15, A7: "A missing channel renders as a gap
     * or a dash, never as ... a zero that reads as a measurement." So 0, '0' and '0.0'
     * are readings; null, undefined and '' are not. `false` is not a reading either, but
     * it is not absence - it is a caller bug, and rendering it loudly beats hiding it.
     */
    get #absent() {
        return this.value === null || this.value === undefined || this.value === '';
    }

    #onSlotChange(event) {
        const assigned = event.target.assignedNodes({ flatten: true });
        this._slotted = assigned.some(
            (node) => node.nodeType === Node.ELEMENT_NODE
                || (node.textContent || '').trim() !== '',
        );
    }

    render() {
        /* A slotted control REPLACES the reading; it does not sit beside it. Slate's
         * action occupies the value slot for exactly the same reason - the scale has
         * dropped, so there is no weight to show. */
        /* THE UNIT SURVIVES AN ABSENT READING (parity surface 1). Slate draws it:
         *   ORACLE live-ready #data-group-temp [i=108] text "—" with
         *          #data-group-temp-unit [i=109] "°C" rect=[1343,274,16,14] beside it,
         *          and #data-steam-temp-unit [i=112] the same over its own em dash.
         * It is also what this file's own consumer already promised — live-screen.js:
         * "The label and the unit stay, because they are the promise of what will be
         * here" — while the template dropped it, so a tile with no reading lost the one
         * mark saying WHICH quantity is missing. It is aria-hidden with the dash, for
         * the dash's own reason: the pair stands for a sentence, and the sentence
         * ("no reading") is what the accessibility tree gets instead. */
        const own = this._slotted
            ? nothing
            : this.#absent
                /* The dash is a glyph standing for a sentence, so it is hidden from the
                 * accessibility tree and the sentence is exposed instead. */
                ? html`<span id="reading" class="reading" aria-hidden="true"
                    >${this.dash}</span
                    >${this.unit
                        ? html`<small id="unit" class="unit" aria-hidden="true"
                            >${this.unit}</small>`
                        : nothing
                    }<span id="a11y" class="a11y">${this.i18n.t(ABSENT_KEY)}</span>`
                : html`<span id="reading" class="reading">${this.value}</span
                    >${this.unit
                        ? html`<small id="unit" class="unit">${this.unit}</small>`
                        : nothing}`;

        /* is-absent paints the muted state rule above. It is off while a control is
         * slotted, because a slotted control is an ACTION and Slate gives that its own
         * ink (--slate-text-2 on .slate-gauge-action) rather than the absence's. */
        const valueClass = !this._slotted && this.#absent ? 'value is-absent' : 'value';

        return html`<span id="label" class="label">${this.label}</span
            ><div id="value" class=${valueClass}>${own}<slot
                name="value" @slotchange=${this.#onSlotChange}></slot></div>`;
    }
}

customElements.define('ui-stat-tile', UiStatTile);
