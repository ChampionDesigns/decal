/**
 * ui-section-header.js - component #27 of the 57-component inventory:
 * THE STICKY CAPTION OVER A LIST GROUP.
 *
 * Wave 2, item #27 (SCOPE Part 4, "Wave 2 - controls with a state model, and small
 * compounds of Wave 1", SCOPE.md:1546). Token-only: no data layer, no ReaPrime, no
 * endpoint, no import from src/data/ or src/stores/. The caption text, the count and
 * the heading level all arrive from outside; this element owns paint, the band's
 * geometry and the stick, and nothing else.
 *
 * WHAT THE ROW SAYS, verbatim
 *   SCOPE.md:1546  "| 27 | **Sticky section header** | The sticky caption over list
 *   groups at `--ui-section-head-h`. | small | tokens |"
 *   waves/2/ITEMS.json #27 notes: "Size: small. The sticky caption over list groups at
 *   --ui-section-head-h. Wave 3's #34 data grid depends on it."
 *   spec §5.2 row 27: "| 27 | Sticky section header | slate-shell.css:2044-2049 |"
 *   spec §4.2 lists it among the profile selector's components.
 *
 * ROW #27 CITES NO BUG ID AND NO DECISION, AND THAT IS A CHECKED FACT, not an
 * omission. The disqualification check (SCOPE Part 10 §4) was run FIRST, mechanically:
 *   (a) DECISIONS.md + the 45-item register: grep for "section header" / "sticky" -
 *       no decision reaches this element, so nothing overrides the oracle here;
 *   (b) responsive behaviour: DISQUALIFIED for the oracle always. Slate is frozen at
 *       1920x1200, so the narrow-container behaviour below is LAYOUT_SPEC_DRAFT.md's,
 *       not Slate's, and is marked where it comes up;
 *   (c) the 140 layout bugs (LAYOUT_SPEC_DRAFT.md §7) and the 31 contract bugs:
 *       grepping §7 for "section header" / "sticky" returns §3's --ui-z-sticky token
 *       row (:425), §4.2's component list (:614), §4.3 (:627) and the §5.2 inventory
 *       row (:898) - no bug. The two ids Slate's own sheet quotes at this element,
 *       P7 and O11, belong to OTHER elements in the numbered lists (spec §7 P7 is the
 *       summary strip vs chart card register; O11 is the context menu losing its last
 *       items), so neither is this component's defect to kill. The oracle is therefore
 *       cleared for every appearance value below.
 *
 * MEASURED STARTING VALUES - every one an oracle answer, quoted verbatim.
 * (realine-run/tools/prov_query.py themes --state profile-selector --cls ...,
 *  against prov-baseline (dark) and prov-light.)
 *
 *   THE BAND (.slate-section-header, 2 elements in 1 state, both 639x60):
 *     CITE profile-selector .slate-section-header [i=14] background-color: dark
 *          rgb(14, 19, 23) / light rgb(242, 243, 243)  <-  slate-shell.css
 *          `#subpage-host #profile-list [data-profile-section]`  authored
 *          `(NOT CAPTURED - set via a CSS shorthand)`  !important=no  (token-driven)
 *          [the shorthand is slate-shell.css:2048 `background: var(--slate-fascia)`,
 *           read read-only from the Slate source because the corpus cannot name a
 *           token behind a shorthand; the two computed values ARE --ui-fascia's two
 *           theme values, styles/tokens.css:720 #f2f3f3 / :841 #0e1317]
 *     CITE profile-selector .slate-section-header [i=14] height = 60px  <-
 *          slate-shell.css  `#subpage-host #profile-list [class*="uppercase"],
 *          #subpage-host #profile-list [data-profile-section]`  authored `60px`
 *          !important=yes  (FROZEN/hardcoded)
 *          [min-height = 60px in the same record, both themes; = --ui-section-head-h,
 *           styles/tokens.css:232, whose own comment settles that it is "a fixed
 *           literal, not a control+space derivation"]
 *     CITE profile-selector .slate-section-header [i=14] padding-left = 24px  <-
 *          slate-shell.css  `#subpage-host #profile-editor-grid #profile-list > *,
 *          #subpage-host #profile-editor-grid #profile-list .slate-profile-folder-body
 *          > *`  authored `24px`  !important=no  (FROZEN/hardcoded)   (= --ui-space-5;
 *          the header's OWN rule declares the same 24px at slate-shell.css:2083)
 *     CITE profile-selector .slate-section-header [i=14] gap = 12px  <-  slate-shell.css
 *          `#subpage-host .slate-section-header`  authored `var(--slate-space-3)`
 *          !important=no  (token-driven)                              (= --ui-space-3)
 *     CITE profile-selector .slate-section-header [i=14] border-top-width = 0px,
 *          box-shadow = none, opacity = 1, background-image = none
 *     CITE profile-selector .slate-section-header [i=31] border-top-width = 1px  <-
 *          slate-shell.css  `#subpage-host #profile-editor-grid #profile-list > * + *,
 *          #subpage-host #profile-editor-grid #profile-list .slate-profile-folder-body
 *          > * + *`  authored `(NOT CAPTURED - set via a CSS shorthand)`
 *          !important=no  (FROZEN/hardcoded)
 *          - the SECOND header only, border-top-color: dark rgb(58, 72, 82) / light
 *            rgb(203, 208, 211) (= --ui-line). THE TOOL'S OWN WINNING RULE IS THE
 *            PROOF FOR DEPARTURE 3: the declaration belongs to the LIST, not to the
 *            header. A header that painted it would paint it on the first one too.
 *
 *   THE CAPTION AND THE COUNT (both .slate-microcap; the count also
 *   .slate-section-count - profile_selector.js:743-753 builds the band as exactly two
 *   microcap spans):
 *     CITE profile-selector .slate-microcap [i=16] color: dark rgb(148, 161, 169)
 *          / light rgb(90, 101, 108)  <-  slate-components.css  `.slate-microcap`
 *          authored `var(--slate-muted)`  !important=yes  (token-driven)
 *     CITE profile-selector .slate-microcap [i=16] font-size = 15px  <-
 *          slate-components.css  `.slate-microcap`  authored `var(--slate-text-cap)`
 *          !important=yes  (token-driven)
 *     CITE profile-selector .slate-microcap [i=16] font-weight = 600  <-
 *          slate-components.css  `.slate-microcap`  authored
 *          `var(--slate-weight-semibold)`  !important=yes  (token-driven)
 *     CITE profile-selector .slate-microcap [i=16] letter-spacing = 1.8px  <-
 *          slate-components.css  `.slate-microcap`  authored `var(--slate-tracking-cap)`
 *          !important=yes  (token-driven)
 *     CITE profile-selector .slate-microcap [i=16] text-transform = uppercase,
 *          height = 18px
 *     CITE profile-selector .slate-microcap [i=16] rect x=604 y=351 w=11 h=18 (text "6")
 *          and [i=33] rect x=594 y=667 w=21 h=18 (text "72")
 *   That IS the Decal `.ui-microcap` type role, so this component imports
 *   `typeRoles` and writes the class rather than restating five declarations
 *   (TYPE_ROLES.md "Using them"; the role's own oracle record is
 *   `CITE expanded-charts .slate-microcap [i=168] font-size = 15px / font-weight = 600
 *   / letter-spacing = 1.8px / text-transform = uppercase`). It is the first shipping
 *   consumer of that fragment, which is what the fragment exists for.
 *
 * WHAT THE CORPUS COULD NOT ANSWER, and where the value came from instead. The probe
 * measured an 18-property appearance surface (prov_query.py --help, CARVE-OUTS), so
 * `position`, `top`, `z-index`, `display`, `align-items`, `justify-content`,
 * `padding-bottom`, `user-select` and `overflow` were NEVER measured. The documented
 * fallback is a read-only read of the Slate source, and this is it, verbatim:
 *
 *   slate-shell.css:2042-2049
 *     /* P7 - the section captions stay put while their section scrolls, so the list
 *        never loses which half of the library you are looking at. *\/
 *     #subpage-host #profile-list [data-profile-section] {
 *         position: sticky; top: 0; z-index: 2; background: var(--slate-fascia); }
 *
 *   slate-shell.css:2072-2085
 *     /* O11 - one section-header band. The only real defect was 12px of extra top
 *        padding on the first header; the labels are deliberately bottom-anchored
 *        above their divider, so they are NOT centred. *\/
 *     #subpage-host .slate-section-header {
 *         display: flex; align-items: flex-end; justify-content: space-between;
 *         gap: var(--slate-space-3); height: 60px; padding: 0 24px var(--slate-space-2); }
 *     #subpage-host .slate-section-count { color: var(--slate-muted); }
 *
 *   profile_selector.js:746 gives the band the `select-none` class - carried as
 *   `user-select: none`, because a caption that selects under a long press on a wall
 *   panel reads as a fault.
 *
 * DELIBERATE DEPARTURES - each one visible, each one declared to the wave-2 manifest
 * (realine-run/waves/2/ledger-src/27-expected-changes.json, region ui-section-header,
 * rendered into realine-run/EXPECTED_CHANGES.jsonl by the gate's build_ledgers.mjs) and
 * each one asserted AS a departure, with both numbers named, in
 * test/render/ui-section-header.render.test.mjs:
 *
 *   1. MICROCAP WEIGHT 600 -> 700 and TRACKING .12em -> .04em — BOTH REVERSED, at
 *      parity surfaces 1 and 0, and both decided upstream of this file in the token
 *      layer, exactly as the departures were. LAYOUT_SPEC_DRAFT §3.5 named the pair in
 *      ONE sentence and mis-transcribed both halves of the six lines it cites
 *      (slate-tokens.css:148-153: four weights with semibold 600, and .12em). The role
 *      renders Slate's 600 and Slate's 1.8px, and this component inherits that by
 *      consuming the role rather than re-cutting it.
 *   2. z-index 2 -> var(--ui-z-sticky) = 10. LAYOUT_SPEC_DRAFT.md:425 declares the
 *      layer ("`--ui-z-sticky` | `10` | `profile-editor-v3.css:318` (the sticky rail,
 *      z-5)") and :435 states the rule the number serves: "no element outside a dialog
 *      needs a z-index above --ui-z-sticky". z-index was never probed, so this is the
 *      spec settling a value the oracle has no vote on. Nothing changes visually while
 *      the header is the only positioned thing in the list; it changes which layer
 *      wins when a list grows a second one.
 *   3. NO TOP BORDER, EVER - and the divider does not disappear, it changes owner.
 *      The oracle records border-top: 1px --ui-line on the SECOND header ([i=31]) and
 *      0px on the first, because the declaration is the LIST's `> * + *` rule
 *      (slate-shell.css:270-273), not the header's. CONVENTIONS §13 is the law here:
 *      "a divider is a gap, not a border" - Slate "contains the pattern twice and the
 *      anti-pattern 55 times". A section header that painted its own top border would
 *      be copy 56, and it would be wrong twice over: wrong on the first header of a
 *      list, and undefeatable from the outside when the list already draws a seam.
 *      The consumer draws it with the shared utility - a list is `.seam-grid
 *      .seam-rows .seam-line` and the gap between rows IS the divider - which is
 *      exactly how wave 3's #34 data grid will consume this element.
 *   4. THE CAPTION CLAMPS AND ELLIPSISES at a narrow container, and the count never
 *      gives up a pixel. The oracle is DISQUALIFIED for responsive behaviour (Part 10
 *      §4: Slate is frozen at 1920x1200 and a 639px band never meets a narrow one);
 *      LAYOUT_SPEC_DRAFT.md governs. One line always - the band is a fixed
 *      --ui-section-head-h and a caption that wrapped would be clipped instead.
 *   5. AN OPTIONAL `count-label`, for the same reason ui-badge grew one: a screen
 *      reader reading Slate's band says "Your Profiles. 6". See ACCESSIBILITY.
 *   6. THE CAPTION IS A HEADING WHERE SLATE'S IS A SPAN, and the box that comes with
 *      it is zeroed. profile_selector.js:743-753 builds the band as two microcap
 *      SPANS; this component makes the caption an `<h2>` because "a role is paint. A
 *      heading is structure, and a screen reader reads <h2>, not .ui-heading"
 *      (TYPE_ROLES.md rule 2) - see ACCESSIBILITY. A `<h2>` is a BLOCK with a UA
 *      `margin-block: 0.83em`, and `.ui-microcap` is an inline modifier that touches
 *      no box property by decision (TYPE_ROLES.md rule 5), so the swap silently
 *      imports 12.45px of margin that Slate's span never had. `.caption` therefore
 *      declares `margin-block: 0` - the layout owns spacing, the type never does.
 *      Recorded here rather than left implicit because the margin is the half of the
 *      swap that shows: without the reset the caption's baseline sat 12.44px above the
 *      count's (measured) while the oracle records the two sharing one y and one
 *      height, and the band's own quoted reason says they are bottom-anchored.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   - NO SELECTION TREATMENT OF ANY KIND, and that is this wave's founding law, not a
 *     shrug. A section header is a caption over a group; it is not selectable, not
 *     pressable, and has no state a user can change. `selectionSurface` is not
 *     imported, the four dials are not read, and there is no private "selected" look
 *     to find: the suite retargets all four dials AND sets every selection spelling
 *     (`selected`, `.is-selected`, aria-pressed/selected/checked/current) and asserts
 *     that not one rendered value moves. Wave 2 is where the seventh treatment becomes
 *     inexpressible (spec §3.9; Part 10 §12), and the way a non-selectable component
 *     participates in that is by being provably inert.
 *   - NO HIT-AREA UTILITY AND NO 48px FLOOR. spec §2.3 and Appendix 5 govern touch
 *     TARGETS and CONVENTIONS §5 names the utility's three consumers (#15, #23, #35).
 *     The band is 60px tall, which clears the floor anyway, but it accepts no press:
 *     growing a hit box here would put a target with nothing behind it on top of the
 *     list it captions. A control that belongs in the band goes in the `trail` slot
 *     and brings its own hit area.
 *   - NO DENSITY ARITHMETIC. styles/tokens.css:189-191 settles it in its own comment:
 *     "--ui-section-head-h is a fixed literal, not a control+space derivation, so it
 *     is outside the row-2 pattern and stays put."
 *   - NO `@media`. Container queries only (CONVENTIONS §2) - and in fact no size query
 *     at all: the band is one line at every width, which is what makes it honest.
 *   - NO part() theming surface. Theming crosses the boundary through custom
 *     properties only (Part 4 ground rule 1; A6).
 *
 * ACCESSIBILITY
 *   The caption is a real heading - `<h2>` with `aria-level` - because "a role is
 *   paint. A heading is structure, and a screen reader reads <h2>, not .ui-heading"
 *   (TYPE_ROLES.md rule 2). `level` moves the level without changing the paint.
 *   text-transform is paint too, so the accessible name keeps the case the author
 *   wrote: the markup says "Your Profiles" and a screen reader says "Your Profiles",
 *   not "Y-O-U-R".
 *   The count is a SIBLING of the heading, never inside it, so the heading's
 *   accessible name is the caption alone. `count-label` names the number for a screen
 *   reader ("6 profiles") the way ui-badge's `label` does, with the glyph hidden and
 *   the label carried by the shared `visuallyHidden` fragment - never a fourth copy.
 *   Row #27 cites no Appendix 15 rule, and that is correct: Appendix 15 is the
 *   aria-*-driven STATE selector contract for .slate-bank / .slate-stepper, and this
 *   component has no state a user can change.
 *   ONE THING THIS ELEMENT DOES NOT DECIDE: whether a heading is legal where the
 *   consumer puts it. Slate's own list is `role="listbox"` with these captions as
 *   non-`option` children, which layout/selector.md BUG-12 calls invalid - but the
 *   fix is the LIST's role structure, not a caption that stops being a heading.
 *
 * API
 *   <ui-section-header>Your Profiles</ui-section-header>
 *   <ui-section-header count="6">Your Profiles</ui-section-header>
 *   <ui-section-header count="6" count-label="6 profiles">Your Profiles</ui-section-header>
 *   <ui-section-header level="3">Built-In Profiles</ui-section-header>
 *   <ui-section-header>Your Profiles<ui-icon-button slot="trail" ...></ui-icon-button></ui-section-header>
 *
 *   The host is the sticky box, so the consumer puts it in the scrolling list's flow
 *   and nothing else is required. It sticks to the top of its scrollport at
 *   --ui-z-sticky, with an opaque --ui-fascia ground so the rows pass under it.
 */

import { css, html, nothing } from 'lit';
import { UiElement, visuallyHidden } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';

/** The heading levels `level` may take. Anything else falls back to 2 rather than
 *  emitting an invalid aria-level - the same choice base.js makes for an
 *  unrecognised focus-ring value and ui-badge for an unrecognised variant. */
export const SECTION_HEADER_LEVELS = Object.freeze([1, 2, 3, 4, 5, 6]);
export const DEFAULT_SECTION_HEADER_LEVEL = 2;

export class UiSectionHeader extends UiElement {
    static properties = {
        /** The group's item count, rendered at the end of the band. String so that
         *  count="0" is a count and not a falsy nothing.
         *  NOT reflected: nothing reads it back, and a reflected String whose default
         *  is the empty string stamps a bare count="" on every header that has no
         *  count - which would make a consumer's [count] selector match everything.
         *  `level` IS reflected, because normalising 9 to 2 has to be visible in the
         *  DOM or the element says one thing and renders another. */
        count: { type: String },
        /** Accessible name for the count, whose visible glyph is a bare number. */
        countLabel: { type: String, attribute: 'count-label' },
        /** Heading level, 1-6. Paint does not move; only aria-level does. */
        level: { type: Number, reflect: true },
    };

    /* STRUCTURAL FRAGMENTS FIRST (CONVENTIONS §4 rule 1, §5a, TYPE_ROLES.md rule 1).
     * `selectionSurface` is not in this list at all - see WHAT IS DELIBERATELY NOT
     * HERE. There is no state fragment, because there is no state. */
    static styles = [typeRoles, visuallyHidden, css`
        /* THE STICK. Source, read-only, slate-shell.css:2042-2049 (the corpus never
         * probed position/top/z-index - prov_query.py CARVE-OUTS):
         *   position: sticky; top: 0; z-index: 2; background: var(--slate-fascia);
         * with Slate's own reason kept: "the section captions stay put while their
         * section scrolls, so the list never loses which half of the library you are
         * looking at."
         *
         * THE HOST IS THE STICKY BOX and it has to be: the element sits in the
         * scrolling list's own flow, so anything inside the shadow root would stick
         * to a box that does not scroll. z-index needs a positioned element, which
         * sticky is - see DEPARTURE 2 for why the layer is the token and not 2.
         *
         * The height is the token and the token is a fixed literal by decision
         * (styles/tokens.css:189-191). min-block-size restates it exactly as Slate
         * restated min-height beside height, so a consumer's grid or flex track
         * cannot quietly compress the band.
         *
         * container-type: inline-size stays as the base set it. The band fills the
         * list's width, which is the case the base default is right for. */
        :host {
            position: sticky;
            inset-block-start: 0;
            z-index: var(--ui-z-sticky);
            block-size: var(--ui-section-head-h);
            min-block-size: var(--ui-section-head-h);
        }

        /* THE PAINT IS ON A CLASS INSIDE THE ROOT, NEVER ON :host - bug P8's
         * mechanism. A screen sheet CAN name the host from outside and cannot name
         * anything in here, so the ground stays this component's business. The band
         * fills the host, so the sticky box and the painted box are the same box.
         *
         * OPAQUE IS LOAD-BEARING, not decoration: a sticky caption with a transparent
         * ground shows the rows sliding under it and is unreadable within one row of
         * scrolling. --ui-fascia is Slate's own choice here and the oracle's measured
         * value in both themes.
         *
         * Source, read-only, slate-shell.css:2076-2083, with Slate's reason kept
         * verbatim: "one section-header band. The only real defect was 12px of extra
         * top padding on the first header; the labels are deliberately bottom-anchored
         * above their divider, so they are NOT centred."
         *
         * justify-content: space-between is carried from that rule; with the caption
         * flexing it distributes nothing, which is why the two spellings can never
         * disagree about where the count sits.
         *
         * NO BORDER, EVER - departure 3. A divider is a gap, not a border
         * (CONVENTIONS §13); the list draws the seam. */
        .band {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: var(--ui-space-3);
            block-size: 100%;
            padding-inline: var(--ui-space-5);
            padding-block: 0 var(--ui-space-2);
            background-color: var(--ui-fascia);
            /* profile_selector.js:746 puts the select-none class on the band (no
             * backticks in a css template - CONVENTIONS §9): a caption that
             * selects under a long press on a wall panel reads as a fault. */
            user-select: none;
        }

        /* THE CAPTION. Type is the shared role, not five restated declarations:
         * .ui-microcap is 15px --ui-text-sm at --ui-weight-semibold, --ui-muted, tracked
         * --ui-tracking-cap, uppercase (TYPE_ROLES.md "The six"), which is exactly the
         * oracle's .slate-microcap record with the token layer's two departures.
         *
         * The clamp is departure 4 and the oracle has no vote on it. min-inline-size
         * is the load-bearing half: a flex item floors at min-content by default, so
         * without it the caption would overflow the band instead of ellipsising.
         *
         * ZEROING THE MARGIN IS THE PRICE OF DEPARTURE 6, and it is load-bearing rather
         * than tidy-up. Slate's caption is a span (profile_selector.js:743-753 builds
         * the band as exactly two microcap spans); this one is a real h2, and a UA h2
         * carries margin-block: 0.83em = 12.45px at the role's 15px.
         * .ui-microcap deliberately does NOT zero it - TYPE_ROLES.md rule 5, verbatim:
         * ".ui-numeric and .ui-microcap are inline modifiers and touch no box property"
         * - so only the four BLOCK roles reset the UA margin, and the swap to a heading
         * brings the margin with it. With align-items: flex-end the margin box is what
         * is bottom-aligned, so the caption's TEXT floated 12.44px above the count's:
         * MEASURED at BENCH before this line existed, caption rect bottom
         * 39.5625 against count rect bottom 52 in a 0->60 band. That contradicted the
         * band's own quoted reason (slate-shell.css:2072-2074, "the labels are
         * deliberately bottom-anchored above their divider") for half the band, and the
         * oracle disagrees with the result outright:
         *   CITE profile-selector .slate-microcap [i=16] rect x=24 y=351 w=140 h=18
         *        (the caption) and [i=16] rect x=604 y=351 w=11 h=18 (the count "6")
         *   CITE profile-selector .slate-microcap [i=33] rect x=24 y=667 w=168 h=18
         *        and rect x=594 y=667 w=21 h=18 (the second band, "72")
         * - one y and one height per band, both times. Spacing is the layout's job
         * (TYPE_ROLES.md rule 5 again), and the layout here is the band's padding. */
        .caption {
            flex: 1 1 auto;
            margin-block: 0;
            min-inline-size: 0;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        /* THE COUNT. Slate gives it the same microcap role plus its own colour rule
         * (slate-shell.css:2085, .slate-section-count taking color var(--slate-muted)),
         * which is the value the role already carries - so the class is the whole
         * declaration and there is no second ink to drift.
         * It never shrinks: the caption gives first, always. */
        .count {
            flex: 0 0 auto;
        }
    `];

    constructor() {
        super();
        this.count = '';
        this.countLabel = '';
        this.level = DEFAULT_SECTION_HEADER_LEVEL;
    }

    /** Normalise before paint, so level="9" and level="banana" are a documented
     *  fallback rather than an invalid aria-level on a real heading. */
    willUpdate(changed) {
        if (changed.has('level')) {
            const raw = Number.parseInt(this.level, 10);
            const next = SECTION_HEADER_LEVELS.includes(raw) ? raw : DEFAULT_SECTION_HEADER_LEVEL;
            if (next !== this.level) this.level = next;
        }
    }

    /** True when there is a count to draw. `0` is a count; '' and null are not. */
    get hasCount() {
        return this.count !== null && this.count !== undefined && String(this.count) !== '';
    }

    render() {
        const named = Boolean(this.countLabel);
        return html`
            <div id="band" class="band">
                <h2 id="caption" class="ui-microcap caption" aria-level=${this.level}><slot></slot></h2>
                ${this.hasCount
                    ? html`<span id="count" class="ui-microcap count"
                        aria-hidden=${named ? 'true' : nothing}>${this.count}</span>`
                    : nothing}
                ${this.hasCount && named
                    ? html`<span id="a11y" class="a11y">${this.countLabel}</span>`
                    : nothing}
                <slot name="trail"></slot>
            </div>`;
    }
}

customElements.define('ui-section-header', UiSectionHeader);
