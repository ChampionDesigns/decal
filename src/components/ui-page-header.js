/**
 * ui-page-header.js - component #31 of the 57-component inventory: THE SCREEN BAND.
 *
 * Wave 2, item #31 (SCOPE Part 4, "Wave 2 - controls with a state model, and small
 * compounds of Wave 1", SCOPE.md:1551):
 *   "| 31 | Page header bar | The 118px screen header band. Three implementations
 *    across four screens today, disagreeing by 2px on inset within a single screen
 *    (spec §5.2 #31, P17). Owns the Save-button wording rule - 'Save (3)', decided
 *    centrally, never per screen (D11): the settings Save is this bar's action
 *    (settings.html:7 #save-settings-btn, verified), not a dialog's. | medium |
 *    #1, #2, band tokens |"
 *
 * NO DATA LAYER, NO ENDPOINT (wave law). The unsaved-change COUNT arrives as a
 * property; the WORDING built from it is this component's, and that split is the
 * whole of D11. Nothing here imports src/data/ or src/stores/.
 *
 * ------------------------------------------------------------------------------
 * THE THREE IMPLEMENTATIONS THIS REPLACES  (spec §5.2 #31)
 *   slate-shell.css:134-141        `#subpage-host #subpage-header`   Settings + selector
 *   slate-live.css:94-102          `#main-page .slate-live-header`   Live + expanded + HV
 *   profile-editor-v3.css:95-104   `.slate-editor-header`            editor
 * A fourth band is the History Viewer's own header (slate-live.css:2201-2212), which
 * is where the 2px disagreement below is measured against.
 *
 * ------------------------------------------------------------------------------
 * THE BUG THIS COMPONENT RETIRES - P17 (spec §7.3, LAYOUT_SPEC_DRAFT.md:1146)
 *
 *   "The page header's `padding: 0 30px` is off the spacing scale and disagrees with
 *    the 28px used by the History Viewer header and `#right-panel > *` on the same
 *    screens."  (slate-shell.css:137)
 *
 *   ORACLE, the defect itself, quoted:
 *     CITE settings-display-skin #subpage-header [i=2] padding-left = 30px  <-
 *          slate-shell.css  `#subpage-host #subpage-header`  authored `30px`
 *          !important=no  (FROZEN/hardcoded)
 *     CITE editor-steps .slate-editor-header [i=2] padding-left = 30px  <-
 *          profile-editor-v3.css  `.slate-editor-header`  authored `30px`
 *          !important=no  (FROZEN/hardcoded)
 *   and the 28px it disagrees with, read from source because the HV overlay is not a
 *   corpus state: slate-live.css:2210 `padding: 0 var(--slate-space-6)`.
 *
 *   THE FIX IS THE SPEC'S, NOT A PREFERENCE. §3.3: "the seven steps are the whole
 *   vocabulary; off-scale values snap to the nearest step. 30 -> 28 ... The one place
 *   this is a real design decision is the header inset (30 vs 28), because the
 *   Settings header, the History Viewer header (slate-live.css:2209) and
 *   `#right-panel > *` (slate-shell.css:1387) already disagree by 2px on the same
 *   screen (layout/settings.md M3)." So: --ui-space-6, 28px, once.
 *
 *   AND THE MECHANISM, WHICH MATTERS MORE THAN THE NUMBER. The inset is declared on
 *   .band INSIDE this shadow root, written as `var(--ui-space-6)` with no private
 *   property in front of it. No SELECTOR from outside can reach it: a screen sheet
 *   cannot name .band, `ui-page-header *` stops at the boundary, there is no ::part,
 *   and there is no --_ui-* hook to inherit into. Six such rules are live in the
 *   suite's fixture throughout and none of them lands.
 *
 *   ONE PATH REMAINS OPEN AND IT IS OPEN BY DESIGN - the token channel. Custom
 *   properties inherit THROUGH a shadow boundary; that is not a leak, it is A6, the
 *   only theming surface this library has. So `#screen-a { --ui-space-6: 30px }` in a
 *   screen sheet does reach this band, and an earlier draft of this comment claimed
 *   otherwise ("The only way to move this inset is to move --ui-space-6 on :root").
 *   That claim was FALSE and is corrected here: the token can be retargeted on ANY
 *   ancestor, not only on :root. Nor can the component defend against it - re-declaring
 *   --ui-space-6 on :host is what scripts/guards.js's `private-palette` guard exists to
 *   forbid ("component re-declares the public token"), because a component that pins a
 *   public token is bug L12.
 *
 *   WHAT P17 ACTUALLY LOSES, then, is not reachability but PRIVACY OF SCOPE. P17 was
 *   three bands with three literals, each movable alone and none of them announcing
 *   itself. The token channel is neither private nor per-band: the same declaration
 *   moves EVERY --ui-space-6 in that subtree together - the leaf pane's own inset, the
 *   list rows under it, every 28px on the screen - so a 2px header drift cannot be
 *   bought without visibly paying for it everywhere else on that screen. That is what
 *   "on the scale" means, and it is the honest claim. Both halves are asserted in
 *   test/render/ui-page-header.render.test.mjs ("P17 cannot express" for the six
 *   selectors; "the one reachable path is the token channel" for the blast radius).
 *
 * ------------------------------------------------------------------------------
 * THE DECISION THIS COMPONENT OWNS - D11 (accepted, SCOPE.md:2220)
 *
 *   "the save button reads 'Save (3)', and the shared component decides the wording
 *    - never per screen."
 *
 *   The carry-forward states the same thing as a deletion (SCOPE.md:2682): Slate's
 *   commit-state.js returns `primaryLabel: 'Save settings'` and "the one live caller
 *   discards the returned label to build its own ... D11 settles it: the button says
 *   'Save (3)' and the wording is decided by the shared component - so drop
 *   primaryLabel from the module".
 *
 *   THE RULE, in full, and it is the same shape Slate's settings screen reached by
 *   hand at settings.js:271-281:
 *     count > 0   Cancel + "Save (N)", the save primary        (dirty)
 *     count = 0   Cancel + "Save", neither one filled          (clean)
 *
 *   THE CLEAN STATE CHANGED ON 25 AUGUST 2026, and this block described the old one
 *   until the audit recapture caught it. It read '"Close" alone, no Cancel, no primary
 *   fill', which was Slate's own S10 shape and was tried here. Ben ruled for the pair on
 *   BOTH committing screens instead: a header whose buttons appear and disappear as you
 *   touch things is a header you have to look at before you can leave, and Cancel means
 *   the same thing on a clean page as on a dirty one. What the count still decides is the
 *   WORDING and the FILL - "Save (3)" against "Save", primary against neutral - which is
 *   D11's actual claim and is unaffected.
 *   The clean state is not this component's invention either - it is Slate's own S10
 *   note (slate-components.css:737-740): "Save was full-primary on untouched pages,
 *   so the affirmative treatment said nothing about whether there was anything to
 *   affirm. Clean pages get a neutral control; the primary fill is spent only when
 *   there are edits to commit."
 *
 *   THE ORACLE CORROBORATES BOTH HALVES, and it corroborates them by what is MISSING:
 *     CITE settings-display-skin #save-settings-btn [i=4]
 *          <button id="save-settings-btn" class="slate-btn slate-btn-tall
 *          slate-commit-clean"> text "Close"  rect x=1722 y=18 w=168 h=82
 *     `prov_query.py find --id cancel-settings-btn` -> "0 elements matched anywhere in
 *          this corpus" - Cancel is `hidden` in all 38 settings states, because all 38
 *          are clean. The count-carrying label has no corpus answer at all for the
 *          same reason, so "Save (3)" is decided by D11 and cited to D11.
 *
 *   WHAT MAKES IT INEXPRESSIBLE PER SCREEN. There is no label property, no label
 *   attribute and no slot in the commit region. A screen supplies a NUMBER and gets a
 *   SENTENCE; it has no way to supply the sentence. Asserted ("D11 cannot express").
 *
 * ------------------------------------------------------------------------------
 * MEASURED STARTING VALUES - every one is an oracle answer, quoted verbatim.
 * (prov_query.py against slate-audit-2026-08-16/prov-baseline, dark, and prov-light.)
 *
 *   THE BAND
 *     CITE settings-display-skin #subpage-header [i=2] height = 118px  <-
 *          slate-shell.css  `#subpage-host #subpage-header`  authored
 *          `var(--slate-header-height)`  !important=no  (token-driven)   = --ui-band-h
 *     CITE settings-display-skin #subpage-header [i=2] background-color =
 *          rgb(17, 22, 26)  <-  slate-shell.css  `#subpage-host #subpage-header`
 *          authored `(NOT CAPTURED - set via a CSS shorthand)`  !important=no
 *          (token-driven)   [light rgb(250, 250, 250)]   = --ui-bar
 *     CITE editor-steps .slate-editor-header [i=2] gap = normal 18px  <-  (no
 *          declaration - inherited or initial value)  (FROZEN/hardcoded)
 *          - i.e. column-gap 18px, authored `column-gap: 18px` at
 *          profile-editor-v3.css:99.  = --ui-space-4
 *     `find --cls slate-live-header` -> 7 elements in 7 states, every one
 *          `1920 x 118`; `find --cls slate-editor-header` -> 3 in 3, all `1920 x 118`;
 *          `find --id subpage-header` -> 39 in 39, all `1920 x 118`. One height, three
 *          sheets, and that agreement is the thing worth keeping.
 *
 *   THE TITLE
 *     CITE settings-display-skin #page_title [i=3] font-size = 28px  <-
 *          slate-shell.css  `#subpage-host #subpage-header #page_title`  authored
 *          `var(--slate-text-xl)`  !important=no  (token-driven)      = --ui-text-xl
 *     CITE settings-display-skin #page_title [i=3] font-weight = 500  <-  the same
 *          rule, authored `500`  !important=no  (FROZEN/hardcoded)  = --ui-weight-medium
 *     CITE settings-display-skin #page_title [i=3] color = rgb(244, 247, 248)  <-
 *          the same rule, authored `var(--slate-text)`  !important=no  (token-driven)
 *          [light rgb(23, 26, 28)]                                     = --ui-text
 *     Those three are exactly `.ui-title` from type-roles.js, so this file writes the
 *     class and restates none of them (TYPE_ROLES.md rule 1). The FOURTH is this
 *     element's own and .ui-title does not carry it:
 *     CITE settings-display-skin #page_title [i=3] letter-spacing = 0.28px  <-
 *          slate-shell.css  `#subpage-host #subpage-header #page_title`  authored
 *          `0.01em`  !important=no  (token-driven)
 *          [0.01em x 28px = 0.28px exactly; declared on .title below]
 *     THE DISQUALIFICATION CHECK RUNS FIRST AND DOES NOT FIRE: tracking is a paint
 *     property inside the corpus's 18-property surface, no decision in the 45-item
 *     register touches title tracking, and #page_title appears on neither §7's 140
 *     layout bugs nor the 31 contract bugs. So the oracle is QUALIFIED and it is
 *     carried, rather than being dropped and filed as a departure. It was dropped in
 *     the first cut of this file (review finding cross-5), which is why it is called
 *     out here rather than passed over: the title rendered `normal`.
 *     NOTE THE SIBLING, BECAUSE THE PAIR LOOKS LIKE AN INCONSISTENCY AND IS NOT.
 *     ui-sheet-header (#16) carries `text-transform: uppercase` and
 *     `letter-spacing: var(--ui-tracking-cap)` on ITS 28px/500 title
 *     (CITE settings-machine-sleep---wake-schedules .slate-heading [i=74]
 *     text-transform = uppercase, letter-spacing = 1.12px authored `0.04em`). Both are
 *     oracle-correct: Slate's SHEET title genuinely is uppercase at .04em and its PAGE
 *     title genuinely is mixed case at .01em. Two 28px/500 titles that differ in case
 *     and tracking is what Slate ships, and both halves are cited.
 *
 *   THE ACTIONS
 *     CITE settings-display-skin #save-settings-btn [i=4] height = 82px  <-
 *          slate-shell.css  `#subpage-host #subpage-header button:not(
 *          #fullscreen-toggle-btn), #subpage-host #subpage-header a`  authored
 *          `var(--slate-control-lg)`  !important=no  (token-driven)  = --ui-control-lg
 *          -> `tall` on ui-button (#1), which is that token by name.
 *     Slate's own cluster gap is `gap-[22.5px]`, compiled (app.css
 *     `.gap-\[22\.5px\]{gap:22.5px}`, verified read-only - it is the 22.5px TYPE
 *     literal that never compiles, not this one). Off scale; §3.3 snaps to the
 *     nearest step, 22.5 -> 24 = --ui-space-5.
 *
 *   THE DERIVATION, WHICH IS THE POINT (Appendix 12, "the derived header band - a
 *   size expressed as control + 2 x space, not a measured constant"). The save
 *   button's rect is y=18 h=82 in a 118px band: 18 + 82 + 18 = 118, and 18 is
 *   --ui-band-inset while 82 is --ui-control-lg. This file therefore declares NO
 *   block padding at all - it centres, and the 18px falls out. Slate's own comment
 *   says the same (slate-live.css:95-97): "the controls centre in it through
 *   --slate-header-inset -- so changing the band moves its contents and the canvas
 *   below it together". Centring rather than padding is also what survives the
 *   compact density band: --ui-density multiplies --ui-band-h (118 -> 103.25) and
 *   deliberately does NOT multiply --ui-control-lg, because "ergonomics is physical"
 *   (tokens.css:180-189) - so a declared `padding-block: var(--ui-band-inset)` would
 *   squeeze an 82px control into a 67.25px content box. Pinned by a test that
 *   retargets --ui-density and reads both boxes.
 *
 * ------------------------------------------------------------------------------
 * FIVE DELIBERATE DEPARTURES, all in EXPECTED_CHANGES.jsonl, region ui-page-header.
 *
 *   1. THE INSET IS 28px, NOT 30px. P17's fix, above. What visibly changes: page
 *      titles on Settings and the editor shift 2px left, exactly as spec §3.3
 *      predicts ("What visibly changes: page titles on Settings and the editor shift
 *      2px left").
 *
 *   2. THE BAND DRAWS NO BOTTOM EDGE. All three Slate implementations carry
 *      `box-shadow: inset 0 -1px var(--slate-line-strong)`:
 *        CITE editor-steps .slate-editor-header [i=2] box-shadow = rgb(82, 97, 107)
 *             0px -1px 0px 0px inset  <-  profile-editor-v3.css `.slate-editor-header`
 *             authored `inset 0 -1px var(--slate-line-strong)`  !important=no
 *             (token-driven)   [light rgb(170, 178, 183)]
 *      CONVENTIONS §13 names this exact line as the seam utility's job - ".seam-strong
 *      | Ink --ui-line-strong - the emphasised divider: rail edge, HEADER UNDERLINE,
 *      band top" - and the spec's own Live skeleton draws it as the screen grid's gap
 *      (LAYOUT_SPEC_DRAFT.md:521-525: `gap: var(--ui-seam)` over `background:
 *      var(--ui-line-strong)`, "the seam IS the divider"). All four screens that use
 *      this component put it in row 1 of a grid (§4.1, §4.2:581, §4.4:698, §4.5:758),
 *      so the gap below it IS the underline. A band that ALSO drew its own would be
 *      bug L9's shape - "every rail stepper draws its seam twice (component inset
 *      shadow + Live border)". Same call the sibling #27 made (ui-section-header.js:294,
 *      "the list draws the seam"). What visibly changes: nothing, if the screen is a
 *      seam grid; no line at all, if it is not - which is a visible omission rather
 *      than a silent one, and the gallery shows both.
 *
 *   3. ROLE="BANNER" IS OPT-IN, NOT THE DEFAULT - AND OPT-IN MEANS role="none" WHEN IT
 *      IS OFF. A bare <header> has the IMPLICIT ARIA role `banner` unless it descends
 *      from article/aside/main/nav/section or role=article/complementary/main/
 *      navigation/region, and `role="dialog"` is not on that list. So simply omitting
 *      the attribute does not withhold the landmark; it grants it. MEASURED on this
 *      build via CDP Accessibility.queryAXTree: `<div role="dialog"><ui-page-header
 *      heading="Settings"></ui-page-header></div>` with `banner` unset computed AXROLE
 *      "banner" on #band - i.e. exactly the landmark-in-a-dialog this departure was
 *      written to prevent, in the default spelling. The element is still a real
 *      <header> either way; what changes is that the non-banner case now says
 *      `role="none"` out loud, which removes the implicit landmark and leaves the
 *      band's children exposed untouched (a presentational role is not focusable here
 *      and carries no global aria-* attribute, so nothing restores it). The suite
 *      asserts the COMPUTED role, not the attribute - the attribute check that shipped
 *      first could not fail for the property this departure claims.
 *      The oracle splits, and it is what asks for the opt-in:
 *        CITE live-ready .slate-live-header [i=1]  <header class="slate-live-header
 *             bg-[var(--box-color)] border-b border-base-400 w-full h-[168px]
 *             relative" role="banner">
 *        CITE settings-display-skin #subpage-header [i=2]  <div id="subpage-header"
 *             class="flex justify-between items-center p-6 border-b border-base-300
 *             bg-[var(--box-color)] h-[150px]">        (no role, and its PARENT is
 *             `role="dialog" aria-labelledby="page_title"` - settings.html:6)
 *      39 states without the role against 7 with it, and the 39 are right: a banner
 *      landmark inside a dialog is a landmark in the wrong place. Default off; Live
 *      writes `banner`.
 *
 *   4. THE TITLE ELLIPSISES INSTEAD OF SHOVING. Slate's #page_title has no overflow
 *      rule, which is safe only because the canvas is frozen at 1920 - the oracle is
 *      DISQUALIFIED on responsive behaviour (Part 10 §4; spec §1.2). Appendix 7's
 *      idea is kept exactly - "A three-column header with a fixed centre track, so
 *      tabs stay optically centred and the flanks overflow rather than shove" - and
 *      the flank that overflows does it as an ellipsis, the same treatment spec §4.3
 *      gives the editor's label rail for the same reason (E19: "white-space: nowrap
 *      ... with no overflow; rail labels can spill onto the first data cell").
 *
 *   5. THE CENTRE TRACK IS `auto`, NOT 430px. Slate's editor header is
 *      `grid-template-columns: minmax(0, 1fr) 430px minmax(0, 1fr)`
 *      (profile-editor-v3.css:97, verified; spec §4.3 "header `minmax(0,1fr) 430px
 *      minmax(0,1fr)` with 697px flanks (:98, verified)"). The spec's skeleton
 *      replaces it in so many words: "<editor-header>   grid-template-columns:
 *      minmax(0,1fr) auto minmax(0,1fr) / centre track = the tablist's own width;
 *      flanks overflow, never shove" (LAYOUT_SPEC_DRAFT.md:632-633). A px literal
 *      three times over is the same defect as the 430px rail written three times
 *      (BUG-11), and --ui-rail-w already exists for the rail.
 *
 * ------------------------------------------------------------------------------
 * WHAT IS DELIBERATELY NOT HERE
 *   - NO SELECTION TREATMENT OF ANY KIND. This band hosts the things that select -
 *     the editor tablist, Live's favourites bank, the History Viewer's tab bank - but
 *     it hosts them through a SLOT, and they are #3/#32/#36. CONVENTIONS §4: the four
 *     dials only mean anything because there is ONE selection component, and a band
 *     that painted its slotted tabs would be the seventh treatment. There is no
 *     `--ui-selected-*` in this file and no aria-state selector; the wave-law
 *     assertion in the suite proves a slotted [aria-selected="true"] takes nothing
 *     from here.
 *   - NO TABS, NO BANK, NO SEARCH FIELD. Every screen's centre content is a different
 *     component; this one owns the band, the tracks and the commit rule.
 *   - NO ROUTING. `commit` and `cancel` are events. What a screen does with them -
 *     flush a pending-changes registry, close a dialog - is the screen's, and in this
 *     wave it is nobody's (no data layer).
 *   - NO OBJECT NAME. Slate's commitView took one ("Save settings"); D11 deleted it
 *     along with primaryLabel. A count, and nothing else, crosses the boundary.
 *
 * ------------------------------------------------------------------------------
 * ONE CONSEQUENCE A CONSUMER MUST KNOW: IDREFS DO NOT CROSS A SHADOW BOUNDARY.
 * Slate's settings root is `<div role="dialog" aria-labelledby="page_title">` and
 * #page_title lives beside it in the light tree. Here the title is #title inside this
 * root, so that IDREF cannot resolve. A screen that labels a dialog by its page header
 * writes the name instead:  <div role="dialog" aria-label="Settings">. One line, at
 * the call site, and the alternative (reflecting the heading back out as a light-DOM
 * node) would put the title in two places. Recorded in this wave's deferred-questions
 * ledger (realine-run/waves/2/ledger-src/31-deferred-questions.json); the ledger id is
 * assigned by the gate, so no number is pinned here - twelve builders claiming the
 * next id in parallel is how two rows end up with one id.
 *
 * ------------------------------------------------------------------------------
 * API
 *   <ui-page-header heading="Settings"></ui-page-header>
 *   <ui-page-header heading="Profile editor" layout="flanks">      the default:
 *       <div slot="centre">…tablist…</div>                         minmax(0,1fr) auto
 *       <div slot="trail">…actions…</div>                          minmax(0,1fr)
 *   </ui-page-header>
 *   <ui-page-header layout="centre" banner>                        Live: auto
 *       <ui-button slot="lead">Profiles</ui-button>                minmax(0,1fr) auto
 *       <div slot="centre">…favourites bank…</div>
 *       <div slot="trail">…destinations…</div>
 *   </ui-page-header>
 *   <ui-page-header heading="Settings" commit change-count="3">    D11: renders
 *       Cancel + "Save (3)"; at 0 it renders Cancel + "Save", unfilled.
 *   header.changeCount = 0                                         the same state
 *   @commit / @cancel                                              detail
 *                                                    { changeCount, dirty }
 *   WIDENING AN ACTION, and which side of the boundary each lever is on:
 *     .header-action { inline-size: 96px }        in THIS sheet - the only lever for
 *         the commit cluster, because #cancel/#save live in this shadow root and no
 *         document rule of any specificity reaches them.
 *     ui-icon-button.header-action { inline-size: 96px }   in the CONSUMER's sheet,
 *         naming the consumer's own slotted control - #2's documented widening hook
 *         (ui-icon-button.js:104-117). ::slotted(.header-action) then keeps it from
 *         shrinking, so the width the consumer set is the width it gets.
 *
 *   THE ATTRIBUTE IS `change-count`, THE PROPERTY IS `changeCount` - the ordinary Lit
 *   dash-to-camel mapping, spelled out because four siblings needed an explicit note
 *   for a property/attribute mismatch (ui-card.js:171, ui-progress-track.js:189,
 *   ui-text-field.js:172, ui-slider.js:115).
 *
 * TRANSLATION. The three words this component owns are read through the i18n store
 * (D2 accepted, SCOPE.md:1772: "English only in v1, but the translation mechanism is
 * designed in from day one - translation as a value each component reads"), and
 * src/lib/i18n.js:86 says the same in its own comment: "The one instance every
 * component reads." Keys are English text and t() falls back to the key, so an empty
 * store renders exactly what Slate renders. This is the first component in the tree
 * with wording of its own, which is why it is the first to read the store.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';

/* #1, the button. Imported for its definition: the commit cluster is a COMPOSITION of
 * wave-1 primitives, never a re-implementation (wave brief; #31's dependsOn is
 * "#1, #2, wave-0a: band tokens"). `tall` is --ui-control-lg by name, which is the
 * oracle's 82px for this exact button. */
import 'src/components/ui-button.js';

/** Which track takes the free space. Two, because the spec's own skeletons are two:
 *  flanks = editor/settings/selector (LAYOUT_SPEC_DRAFT.md:632, Appendix 7);
 *  centre = Live (:540, "library button, favourites bank (1fr, min-width: 0),
 *  action cluster"). Anything else falls back to `flanks` rather than collapsing the
 *  band - the same choice base.js makes for focus-ring and ui-card makes for pad. */
export const PAGE_HEADER_LAYOUTS = Object.freeze(['flanks', 'centre']);

export class UiPageHeader extends UiElement {
    static properties = {
        /** The page title. Empty renders no heading element at all. */
        heading: { type: String },
        /** 'flanks' (default) | 'centre'. */
        layout: { type: String, reflect: true },
        /** Render the D11 commit cluster in the trail region. */
        commit: { type: Boolean, reflect: true },
        /** Unsaved changes. A NUMBER in; the sentence is this component's (D11). */
        changeCount: { type: Number, attribute: 'change-count' },
        /** Landmark opt-in - departure 3. Live sets it; a dialog header does not. */
        banner: { type: Boolean, reflect: true },
    };

    static styles = [typeRoles, css`
        /* The host is a one-cell grid so .band stretches to it in both axes. The band
         * is a FLOOR, not a fixed height: in the spec's screen skeletons the row track
         * is already var(--ui-band-h) (§4.1:519, §4.2:581, §4.4:698, §4.5:758) and the
         * two agree; anywhere else the band cannot be squashed below it.
         * container-type stays as the base set it - a header fills the row it is given,
         * so inline-size containment is right here (CONVENTIONS §2). No rule in this
         * file is size-keyed and none may be: a component reads its own container,
         * never the viewport (spec §2.1 Rule 1). */
        :host {
            display: grid;
            min-block-size: var(--ui-band-h);
        }

        /* THE BAND, ON A CLASS AND INSIDE THE ROOT (CONVENTIONS §4 rule 2, and the
         * mechanism that retires P17). Not on :host - a screen sheet can name the host
         * from outside and can name nothing in here. Every value is a token; there is
         * not a number in this block.
         *
         * NO padding-block. 18 + 82 + 18 = 118 is a CONSEQUENCE of centring
         * --ui-control-lg in --ui-band-h, not a declaration - see "THE DERIVATION" in
         * the header. NO box-shadow: the seam draws the underline (departure 2).
         * NO overflow: hidden anywhere on this element or on .region - a band whose
         * children are all controls is exactly the shape bug L24 describes, "focus
         * rings clipped on all four sides by the components they sit inside". */
        .band {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
            align-items: center;
            column-gap: var(--ui-space-4);
            min-block-size: var(--ui-band-h);
            padding-inline: var(--ui-space-6);
            background-color: var(--ui-bar);
        }

        /* Live's distribution: the bank in the middle takes the room, the two clusters
         * are content-sized (LAYOUT_SPEC_DRAFT.md:540). */
        :host([layout="centre"]) .band {
            grid-template-columns: auto minmax(0, 1fr) auto;
        }

        /* A region is a row of controls. min-inline-size: 0 on both the track (via
         * minmax) and the flex box, or a long title refuses to shrink and shoves the
         * centre off axis - which is the half of Appendix 7 that has to hold.
         * gap is --ui-space-5, one step wider than the gap BETWEEN regions, so a
         * cluster reads as a cluster: §3.3's snap of Slate's compiled 22.5px. */
        .region {
            display: flex;
            align-items: center;
            gap: var(--ui-space-5);
            min-inline-size: 0;
        }

        .region-centre { justify-content: center; }
        .region-trail { justify-content: flex-end; }

        /* Appendix 7's other half, made mechanical: "the flanks overflow rather than
         * shove". A flex item shrinks by default, so without this the commit cluster
         * would give room before the title did - and the thing that must never give is
         * the affirmative action. The title has min-inline-size: 0 and is therefore the
         * one box in the band that CAN shrink, so it is the one that does.
         *
         * flex: 0 0 auto IS A SHRINK RULE, NOT A SIZE - the width still comes from the
         * control's own content box. WHO CAN CHANGE THAT WIDTH, precisely, because the
         * first cut of this file got it wrong (review finding c3-4):
         *   - THE COMMIT CLUSTER (#cancel, #save) is rendered INSIDE this shadow root.
         *     No document rule reaches it at any specificity - not
         *     ui-page-header ui-button.header-action, not the star selector, not a
         *     ::part that does not exist. The lever for those two is this class, in
         *     this sheet, one line below - a change to the component, made once, for
         *     every screen. That is the point of there being one band.
         *   - A SLOTTED CONTROL is the consumer's own light-DOM element, so the
         *     consumer's own sheet reaches it normally, and #2's documented widening
         *     hook (ui-icon-button.js:104-117,
         *     ui-icon-button.header-action { inline-size: 96px }) is exactly that rule
         *     written by whoever slots the button. This class then applies to it too,
         *     through the slot, so a widened slotted action does not start shrinking.
         * Both halves are asserted; nothing about the hook was exercised before.
         *
         * NO BACKTICK ANYWHERE IN THIS TEMPLATE (CONVENTIONS section 9): a backtick
         * terminates the css literal and the syntax error points at a word in prose. */
        .header-action,
        ::slotted(.header-action) {
            flex: 0 0 auto;
        }

        /* Departure 4. overflow: hidden is safe HERE and nowhere else in this file:
         * an h1 is not focusable, so it cannot clip a ring.
         *
         * THE TRACKING IS THE ORACLE'S, and it is the one type value .ui-title does not
         * carry (TYPE_ROLES.md rule 1 says restate nothing the role already states -
         * this is not one of them). The role is written in :where() so it loses every
         * tie; .title is (0,1,0) and wins, which is how the two share one element -
         * the same arrangement ui-sheet-header uses for its own title.
         *   CITE settings-display-skin #page_title [i=3] letter-spacing = 0.28px  <-
         *        slate-shell.css  #subpage-host #subpage-header #page_title  authored
         *        0.01em  !important=no  (token-driven)
         * WRITTEN AS THE AUTHORED em, NOT THE MEASURED px: 0.01em tracks with the type
         * size, so a retarget of --ui-text-xl carries it, and 0.28px would not. There
         * is no tracking token for title type - --ui-tracking-cap is .04em, the
         * microcap value, and is a different number for a different register - so this
         * is an authored literal here rather than a token invented from one use. That
         * choice is the file's, and it is filed as a deferred question. */
        .title {
            min-inline-size: 0;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            letter-spacing: .01em;
        }
    `];

    constructor() {
        super();
        this.heading = '';
        this.layout = 'flanks';
        this.commit = false;
        this.changeCount = 0;
        this.banner = false;
        /* Subscribes on connect, unsubscribes on disconnect - the controller does both
         * (src/lib/i18n.js:96-116), which is the "cleans up on disconnect" line of
         * CONVENTIONS §12 satisfied by construction. */
        this.i18n = new I18nController(this);
    }

    /** Normalise before paint, so layout="Centre" and layout="nope" are a documented
     *  fallback rather than a band with no tracks. */
    willUpdate(changed) {
        if (changed.has('layout')) {
            const raw = String(this.layout ?? '').trim().toLowerCase();
            // "center" is the same word; accept it and answer in the spec's spelling.
            const spelt = raw === 'center' ? 'centre' : raw;
            const next = PAGE_HEADER_LAYOUTS.includes(spelt) ? spelt : 'flanks';
            if (next !== this.layout) this.layout = next;
        }
    }

    /** The count, as a count. A negative, fractional or unparseable value is zero
     *  changes - "cannot tell" is clean, because a false-dirty Save is worse than no
     *  dirty state (SCOPE.md:2682, carrying Slate's own rule forward). */
    get #count() {
        const n = Number(this.changeCount);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }

    /**
     * D11, and the only place in the tree that decides these words.
     *
     * THE WHOLE SENTENCE IS THE KEY, not a translated word with English punctuation
     * built around it. D2 (accepted, SCOPE.md:1771-1775) designs the translation
     * mechanism in from day one, and src/lib/i18n.js:31-38's `interpolate` over a
     * {name} placeholder is that mechanism: `t(key, params)` fills the placeholder on
     * the catalogue's string AND on the key-as-fallback path, so the translatable unit
     * is the whole of 'Save ({count})'. Written as `${t('Save')} (${n})` - which is
     * what shipped first, review finding c3-5 - the parentheses, the space and the word
     * order are frozen English that no catalogue can move, which is the same defect D11
     * names one level up: wording decided outside the shared component.
     *
     * The rendered English is unchanged, because keys ARE English text and the fallback
     * interpolates: an empty store still renders exactly "Save (3)" and "Close".
     */
    /**
     * SAVE, ALWAYS, WITH THE COUNT WHEN THERE IS ONE.
     *
     * Ben, 25 August 2026, choosing Slate's header for the profile editor: Slate shows
     * Cancel and a filled Save whether or not anything has changed, and its SETTINGS
     * header is the same pair (`settings.html:6-7`). So this is not one screen's
     * preference - it is the shape both of Slate's committing screens have, and D11's
     * "Close alone at zero" was the departure.
     *
     * THE COUNT STILL CROSSES, which is the half of D11 that was never in question: a
     * screen supplies a number and this decides the wording. What changed is the word at
     * zero, not who owns it.
     */
    get #commitLabel() {
        const n = this.#count;
        return n > 0 ? this.i18n.t('Save ({count})', { count: n }) : this.i18n.t('Save');
    }

    #emit(type) {
        const n = this.#count;
        this.dispatchEvent(new CustomEvent(type, {
            detail: { changeCount: n, dirty: n > 0 },
            bubbles: true,
            composed: true,
        }));
    }

    /* ONE event for both states, because Slate is one handler for both states
     * (settings.js:6773 - the same listener flushes when there is something to flush
     * and closes either way). `dirty` in the detail is what a screen branches on, and
     * it is the same boolean that chose the label, so the two cannot drift. */
    #onCommit = () => this.#emit('commit');
    #onCancel = () => this.#emit('cancel');

    /** The commit cluster. No slot, no label property: D11's wording has no per-screen
     *  surface, and that absence is the decision. */
    #renderCommit() {
        const dirty = this.#count > 0;
        return html`
            <ui-button
                id="cancel"
                class="header-action"
                tall
                @click=${this.#onCancel}
            >${this.i18n.t('Cancel')}</ui-button>
            <ui-button
                id="save"
                class="header-action"
                tall
                variant=${dirty ? 'primary' : 'default'}
                @click=${this.#onCommit}
            >${this.#commitLabel}</ui-button>
        `;
    }

    render() {
        const titled = Boolean(this.heading);
        /* DEPARTURE 3, and the explicit `none` is the departure. A bare <header> has
         * the IMPLICIT role `banner` unless it descends from article/aside/main/nav/
         * section or role=article/complementary/main/navigation/region - and
         * role="dialog", which is what Slate's settings root is (settings.html:6), is
         * on none of those lists. Omitting the attribute would therefore GRANT the
         * landmark rather than withhold it: measured AXROLE "banner" on this element
         * with `banner` unset inside a role="dialog" parent. `none` removes the
         * implicit role and nothing restores it (the band is not focusable and carries
         * no global aria-* attribute); the children stay exposed exactly as they were,
         * and the element is still a real <header>. */
        return html`<header
            id="band"
            class="band"
            role=${this.banner ? 'banner' : 'none'}
        >
            <div id="lead" class="region region-lead">
                ${titled
                    ? html`<h1 id="title" class="ui-title title">${this.heading}</h1>`
                    : nothing}
                <slot name="lead"></slot>
            </div>
            <div id="centre" class="region region-centre"><slot name="centre"></slot></div>
            <div id="trail" class="region region-trail">
                <slot name="trail"></slot>
                ${this.commit ? this.#renderCommit() : nothing}
            </div>
        </header>`;
    }
}

customElements.define('ui-page-header', UiPageHeader);
