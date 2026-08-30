/**
 * ui-locked-value.js - component #43 of the 57-component inventory: THE LOCKED VALUE BOX.
 *
 * Wave 1, item #43 (SCOPE Part 4, "Wave 1 - primitives", L1528). Token-only: no data
 * layer, no ReaPrime, no endpoint. The text arrives from outside through the default
 * slot; this element owns paint and nothing else. Its WIDTH also arrives from outside,
 * and that is the whole design argument below.
 *
 * WHAT THE ROW SAYS, verbatim
 *   spec §5.2 #43: "Locked value box | profile-editor-v3.css:640-641" (LAYOUT_SPEC_DRAFT.md:914).
 *   SCOPE L1528: "The editor's read-only value cell (a stepper with no caps)." size small,
 *   depends on: tokens.
 *   ITEMS.json #43 notes: "Consumed by the Wave 4 editor compounds; it is a primitive here,
 *   not a variant of #4 stepper (which is Wave 2)."
 *
 *   Slate's own comment on the thing, profile_editor.js:1096-1098, and it is the spec for
 *   the behaviour half:
 *     "Locked Target for a HOLD step - the .value-locked dashed box. It holds the
 *      PREVIOUS step's achieved value and is intentionally NON-INTERACTIVE (no numpad,
 *      no +/-): a HOLD step carries no authored target."
 *
 * ROW #43 CITES NO BUG ID, AND THAT IS MEASURED, not an omission: grepping
 * LAYOUT_SPEC_DRAFT.md §7's 140 layout bugs for "locked" and "dashed" returns §5.2's own
 * row and nothing else. So the disqualification check clears the sources for every
 * appearance value here - except responsive behaviour, which is disqualified everywhere
 * (Slate is frozen at 1920x1200) and is marked as such where it comes up.
 *
 * =========================================================================================
 * THE ORACLE HAS NO RECORD OF THIS ELEMENT, AND THE TOOL SAYS SO
 * =========================================================================================
 *   $ prov_query.py find --cls pe-value-locked
 *     corpus    prov-baseline (dark)
 *     searched  49 state(s)
 *     found     0 element(s) in 0 state(s)
 *     "0 elements matched anywhere in this corpus. The corpus has no answer for this
 *      element: read the Slate source read-only, or record a reversible choice in
 *      DEFERRED_QUESTIONS.md."
 *
 * That is the documented CARVE-OUT, not a tool fault. The captured `editor-steps` state
 * has 234 element records and 34 distinct `pe-*` classes; `pe-value-locked` is not among
 * them because the captured profile contains no HOLD step, and the box renders only for a
 * HOLD step. So the starting values below are read READ-ONLY from the Slate source and
 * quoted verbatim, and the oracle is used for what it CAN answer: the neighbouring
 * geometry this cell has to match, and the computed value of every token it borrows.
 *
 * THE SOURCE RECORD, profile-editor-v3.css:639-655, quoted whole:
 *     .pe-value-locked {
 *         width: var(--pe-control-width) !important;    <- 346px; departure 1
 *         height: 64px;                                 <- literal; departure 2 (E11)
 *         display: inline-flex;
 *         align-items: center;
 *         justify-content: center;
 *         padding: 0 14px;                              <- off-scale; departure 3
 *         border: 1px dashed var(--slate-line-strong);
 *         border-radius: var(--slate-radius);
 *         background: var(--slate-surface);
 *         color: var(--slate-muted);
 *         font-family: var(--slate-font-ui);
 *         font-size: var(--slate-text-note);
 *         font-weight: 400;
 *         letter-spacing: 0;
 *         text-align: center;
 *     }
 * and its call site, profile_editor.js:1099-1107 + :2028:
 *     function makeValueLocked(text, width = 260, plain = false) { ...
 *         el.style.width = width + 'px';                 <- discarded by the !important
 *     makeValueLocked(heldTargetCopy(index), CTRL_W, true)
 *
 * ORACLE ANSWERS, quoted verbatim - state, element, property, value, winning rule.
 *
 *   THE BOX IT MUST MATCH. "A stepper with no caps" is confirmable: the locked box
 *   declares the same width token and the same 64px, and the stepper is in the corpus.
 *     CITE editor-steps .pe-stepper [i=33] width = 346px <- profile-editor-v3.css
 *          `.pe-grid .pe-stepper` authored `var(--pe-control-width)` !important=yes
 *          (FROZEN/hardcoded)
 *     CITE editor-steps .pe-stepper [i=33] height = 64px <- profile-editor-v3.css
 *          `.pe-stepper` authored `64px` !important=no (FROZEN/hardcoded)
 *     CITE editor-steps .pe-stepper [i=33] min-height = 64px <- profile-editor-v3.css
 *          `.pe-stepper` authored `64px` !important=no (FROZEN/hardcoded)
 *     CITE editor-steps .pe-stepper [i=33] border-top-left-radius = 6px <-
 *          profile-editor-v3.css `.pe-stepper` authored (NOT CAPTURED - set via a CSS
 *          shorthand) !important=no (token-driven)
 *     CITE editor-steps .pe-stepper [i=33] font-size = 16px <- (no declaration -
 *          inherited or initial value) (FROZEN/hardcoded)
 *     CITE editor-steps .pe-stepper [i=33] font-weight = 400 <- (no declaration -
 *          inherited or initial value) (FROZEN/hardcoded)
 *     CITE editor-steps .pe-stepper [i=33] letter-spacing = normal <- (no declaration -
 *          inherited or initial value) (FROZEN/hardcoded)
 *   The `!important=yes` and the two `authored 64px (FROZEN/hardcoded)` readings are the
 *   oracle stating departures 1 and 2 in its own words.
 *
 *   THE INK, --slate-line-strong, measured on the one other element that borders itself
 *   with it at hairline width (slate-components.css:783, the keycap):
 *     CITE settings-help-keyboard-shortcuts #kb-current-sleeping [i=58] border-top-color:
 *          dark rgb(82, 97, 107) / light rgb(170, 178, 183) <- slate-components.css
 *          `.slate-keycap` authored (NOT CAPTURED - set via a CSS shorthand) !important=no
 *     CITE settings-help-keyboard-shortcuts #kb-current-sleeping [i=58]
 *          border-top-width = 1px <- slate-components.css `.slate-keycap` authored
 *          (NOT CAPTURED - set via a CSS shorthand) !important=no (token-driven)
 *     [= --ui-line-strong, styles/tokens.css:731 #aab2b7 / :852 #52616b - exact, both themes]
 *
 *   THE FACE, --slate-surface:
 *     CITE profile-selector #profile_notes [i=189] background-color: dark rgb(24, 30, 35)
 *          / light rgb(255, 255, 255) <- slate-shell.css `#subpage-host
 *          #profile-editor-grid #profile-chart-wrap, #subpage-host #profile-editor-grid
 *          #profile_notes` authored (NOT CAPTURED - set via a CSS shorthand) !important=no
 *     [= --ui-surface, styles/tokens.css:721 #ffffff / :842 #181e23 - exact, both themes]
 *
 *   THE TEXT INK, --slate-muted, measured on the editor's own unit label two rules away:
 *     CITE editor-steps .pe-value-unit [i=37] color: dark rgb(148, 161, 169) / light
 *          rgb(90, 101, 108) <- profile-editor-v3.css `.pe-value-unit, .pe-value-feel`
 *          authored `var(--slate-muted)` !important=no (token-driven)
 *     [= --ui-muted, styles/tokens.css:728 #5a656c / :849 #94a1a9 - exact, both themes]
 *
 *   THE SIZE, --slate-text-note, and THE HEIGHT TOKEN the literal should have been:
 *     CITE modal-numpad #numpad-confirm [i=169] font-size = 16px <- numpad-modal.css
 *          `.numpad-modal-cancel, .numpad-modal-confirm` authored `var(--slate-text-note)`
 *          !important=no (token-driven)
 *     CITE modal-numpad #numpad-confirm [i=169] height = 64px <- numpad-modal.css
 *          `.numpad-modal-cancel, .numpad-modal-confirm` authored
 *          `var(--slate-control-height)` !important=no (token-driven)
 *     [= --ui-text-note 16px (tokens.css:353, same comment as slate-tokens.css:131) and
 *      --ui-control-h 64px (tokens.css:88, spec §3.1 "The skin's spine")]
 *
 * =========================================================================================
 * FIVE DELIBERATE DEPARTURES, each recorded in the wave-1 ledger
 * (_skinlab/realine-run/EXPECTED_CHANGES.jsonl, region ui-locked-value; source
 * _skinlab/realine-run/waves/1/ledger-src/) - a ledger that exists on disk and can be
 * checked, not a "manifest" no file corresponds to. Each is ALSO asserted as a
 * departure in test/render/ui-locked-value.render.test.mjs, which is the copy a gate
 * can run rather than read:
 * =========================================================================================
 *  1. THE BOX DOES NOT OWN ITS WIDTH. Slate pins `width: var(--pe-control-width)
 *     !important` - 346px - and the `!important` exists to beat `el.style.width =
 *     width + 'px'` written by its own call site (profile_editor.js:1104), so the width
 *     argument threaded through `makeValueLocked(text, width = 260, plain)` is computed
 *     and then discarded. spec §2.3 bans exactly this: "Layout computed in JS and then
 *     overridden in CSS ... ONE OWNER PER DIMENSION", and E15 is the same 346 arriving
 *     two pixels short of its column ("cell padding 12 + control 346 = 370 in a 372px
 *     column - and nothing in either file connects the three numbers"). Here the
 *     CONTAINER owns the inline size: the host is `display: block` and fills its cell,
 *     the box fills the host, and the wave-4 editor grid sets the column. That is also
 *     the wave law - "Ranges/limits arrive as attributes/properties from outside; a
 *     primitive never owns them" - and Part 4 ground rule 2, a component reads its own
 *     container.
 *
 *  2. THE HEIGHT IS THE TOKEN, AND IT IS A FLOOR. Bug E11: "25 literal 64px and 18
 *     literal 62px in the editor sheet, while --slate-control-height is used once (inside
 *     a dead rule) and --slate-control-inner ZERO times." The oracle reads this box's
 *     neighbour as `authored 64px (FROZEN/hardcoded)` while the numpad's buttons -
 *     the same 64px - read `authored var(--slate-control-height) (token-driven)`. One of
 *     those two is the bug. This box reads --ui-control-h.
 *     And it is `min-block-size`, not `height`, which retires bug E7's class in passing
 *     ("the step-name input clips its own descenders - 28.8px of line box in a 28px
 *     box"): a fixed height smaller than the line box clips, a floor grows. spec §2.3
 *     case 4 makes minimum floors REQUIRED, not merely permitted. With border-box and a
 *     hairline edge the content box is then 62px = --ui-control-inner, derived rather
 *     than declared, exactly as spec §3.1 says it should be.
 *
 *  3. THE INLINE PADDING SNAPS TO THE SCALE. Slate writes `padding: 0 14px`, and
 *     styles/tokens.css:242-244 names 14 in the list of off-scale values in live use:
 *     "The seven steps are the WHOLE vocabulary; off-scale values snap to the nearest
 *     step (§3.3). Today 30/32/26/20/16/14/9/6/10/36/48 are all in live use". 14 is
 *     nearer --ui-space-3 (12px) than --ui-space-4 (18px), so 12px it is. Visible change:
 *     2px tighter on each side, and only where the text is long enough to reach the
 *     padding at all - the content is centred.
 *
 *  4. ONE LINE, WITH AN ELLIPSIS. Slate's rule states no `white-space` and no `overflow`,
 *     so long held-target copy ("Holds 02 Preinfusion 84.0 degC" and longer) wraps and
 *     spills out of a fixed 64px box - bug E19's class, "white-space: nowrap ... with no
 *     overflow" and E16's, "neither the cell nor .pe-exit-cell sets overflow, so the
 *     excess spills symmetrically into the rows above and below". The treatment is not
 *     invented: the same sheet's own value cell already does it, .pe-value-number at
 *     profile-editor-v3.css:568-578 and .pe-value-unit at :593-604, both
 *     `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`. The oracle is
 *     DISQUALIFIED here anyway - what a box does at a container narrower than 1920 is
 *     responsive behaviour and Slate has no answer.
 *
 *  5. IT KEEPS THE ONE FOCUS RING IF A CONSUMER MAKES IT FOCUSABLE. The box takes no
 *     focus of its own and this file adds no tabindex - Slate's comment is the spec and
 *     it says NON-INTERACTIVE. But a wave-4 grid with a roving tabindex may well want the
 *     cell reachable so it can be read, and when it does, the ring must be the one ring
 *     (base, from --ui-focus-*) and must not be clipped - bug L24, "focus rings clipped
 *     on all four sides by the components they sit inside", whose named mechanism is
 *     `.slate-stepper { overflow: hidden }` (slate-components.css:549) - the very
 *     component this box is "a stepper with no caps" of. Nothing in this file sets
 *     overflow on the box, so the ring clears it; the ellipsis clip is one span INSIDE
 *     the box and contains nothing focusable.
 *
 * =========================================================================================
 * WHAT IS DELIBERATELY NOT HERE
 * =========================================================================================
 *   - NO caps, NO +/-, NO numpad, NO click handler, NO tabindex, NO role. "Intentionally
 *     NON-INTERACTIVE" is the component (profile_editor.js:1097-1098). #4 Stepper is a
 *     separate wave-2 item and this is not a variant of it (ITEMS.json #43 notes).
 *   - NO selection treatment, and `selectionSurface` is deliberately not imported. The
 *     four dials mean something only because there is ONE selection component
 *     (CONVENTIONS §4). A locked cell has no state a user can change - which is also why
 *     row #43 cites no Appendix 15 contract: Appendix 15 is the aria-*-driven STATE
 *     selector for .slate-bank / .slate-stepper.
 *   - NO hit-area utility and NO ::before overlay. spec §2.3 case 2 and Appendix 5 govern
 *     touch TARGETS and the shared utility's three consumers are #15, #23 and #35
 *     (CONVENTIONS §5). Nothing here is pressable. The box is 64px tall in any case,
 *     which clears --ui-hit-min without asking - but a hit overlay on a non-target would
 *     sit on top of whatever IS the target in that row.
 *   - NO container query. The component honours its container by FILLING it and clamping
 *     its text; no rule here is size-keyed, so `container-type: inline-size` stays at the
 *     base default (right for anything filling a slot - CONVENTIONS §2) and there is no
 *     `:host { container-type: normal }` opt-out.
 *   - NO value/unit split. The editor's live value cell splits .pe-value-number from
 *     .pe-value-unit; the locked box renders one `textContent` and nothing else
 *     (profile_editor.js:1106). The formatted sentence is the consumer's to build -
 *     `heldTargetCopy()` is data-shaped and belongs to the wave-4 compound.
 *   - NO `part()` theming surface. Theming crosses the boundary through custom properties
 *     only (Part 4 ground rule 1; A6).
 *
 * ACCESSIBILITY
 *   The slot's text is the accessible content, which is right for the shape Slate ships:
 *   "Holds previous target" and "Holds 02 Preinfusion 84.0 degC" are sentences that say
 *   what the box means. `label` is the escape hatch for the other shape - a bare reading
 *   in a column whose header carries the meaning - and it takes ui-badge's spelling
 *   exactly: the visible glyphs go `aria-hidden` and the label is exposed as visually
 *   hidden text. NOT `aria-label` on the span: aria-label is ignored on an element with
 *   the generic role, which is what a bare <span> and a bare custom element both have.
 *
 * API
 *   <ui-locked-value>Holds previous target</ui-locked-value>
 *   <ui-locked-value>Holds 02 Preinfusion 84.0 &deg;C</ui-locked-value>
 *   <ui-locked-value label="Held target, 84.0 degrees Celsius">84.0 &deg;C</ui-locked-value>
 *   <ui-locked-value tabindex="0">...</ui-locked-value>        consumer-owned focusability
 *   <ui-locked-value focus-ring="inset">...</ui-locked-value>  inside a clipping band
 *   <ui-locked-value hidden>...</ui-locked-value>              really hidden
 */

import { css, html, nothing } from 'lit';
import { UiElement, visuallyHidden } from 'src/components/base.js';

export class UiLockedValue extends UiElement {
    static properties = {
        /** Accessible name, for a box whose visible content is a bare reading. */
        label: { type: String },
    };

    /* STRUCTURAL FRAGMENT FIRST (CONVENTIONS §4 rule 1, §5). `selectionSurface` is
     * not here at all - see WHAT IS DELIBERATELY NOT HERE. */
    static styles = [visuallyHidden, css`
        /* RESTING PAINT ON A CLASS, NEVER AN ID (CONVENTIONS §4 rule 2) - and never on
         * :host either. A screen sheet CAN name the host from outside and cannot name
         * anything in here; painting on :host is how bug P8's mechanism reaches a
         * component ("the one affirmative action on the screen has no primary
         * treatment; measured transparent"). Ids are for the tests to query by.
         *
         * SOURCE profile-editor-v3.css:639-655 (.pe-value-locked), token names
         * re-prefixed, with the five departures marked. */
        .box {
            display: flex;
            align-items: center;
            justify-content: center;

            /* DEPARTURE 1 - no width. The host fills its cell and this fills the host;
             * the container owns the inline size (spec §2.3 "One owner per dimension",
             * E15, wave law). Slate: width: var(--pe-control-width) !important. */

            /* DEPARTURE 2 - a floor, from the token. Slate: height: 64px, one of E11's
             * 25 literals. min-block-size grows instead of clipping (E7's class), and
             * with border-box + a hairline edge the content box is the 62px
             * --ui-control-inner without anyone declaring it (spec §3.1). */
            min-block-size: var(--ui-control-h);

            /* DEPARTURE 3 - 14px snaps to the nearest scale step (styles/tokens.css:242,
             * spec §3.3). Slate: padding: 0 14px. */
            padding-inline: var(--ui-space-3);

            /* Longhands, not the border shorthand. Slate's own sheet documents what a
             * shorthand does to an implied longhand (slate-live.css:1565-1567) and the
             * oracle records the cost: every one of this box's neighbours reads
             * "authored (NOT CAPTURED - set via a CSS shorthand)", so the corpus can
             * name the value and not the token. Three longhands stay citable. */
            border-width: var(--ui-border-w);
            border-style: dashed;
            border-color: var(--ui-line-strong);
            border-radius: var(--ui-radius);

            background-color: var(--ui-surface);
            color: var(--ui-muted);

            /* Restated deliberately, against CONVENTIONS §11's default. The base leaves
             * font-family off :host so a screen can set one locally - correct for a
             * component that inherits neutrally. This one does not: it sits in a column
             * of numeric-family value cells (.pe-value-number reads
             * var(--slate-font-numeric)) and Slate names the UI family here on purpose,
             * because "Holds previous target" is prose, not a reading. A token, not a
             * literal, and never an @font-face (spec §6.3 Rule 2). */
            font-family: var(--ui-font-family);
            font-size: var(--ui-text-note);
            font-weight: var(--ui-weight-regular);

            /* Slate writes letter-spacing: 0 to undo .pe-value-number's 0.03em. Tracking
             * inherits and therefore crosses the shadow boundary, so the box states its
             * own rather than taking whatever the cell around it happens to carry.
             * Authored as the keyword, not as 0: the two render identically here, and
             * normal is what the rest of that column already computes -
             *   CITE editor-steps .pe-stepper [i=33] letter-spacing = normal <- (no
             *        declaration - inherited or initial value) (FROZEN/hardcoded)
             * so the box does not quietly pin a different keyword from its neighbours. */
            letter-spacing: normal;
            text-align: center;
        }

        /* DEPARTURE 4's other half. text-overflow needs a block container with a
         * definite constraint, so the text takes its own box inside the flex line
         * rather than riding as an anonymous flex item, where the ellipsis would
         * silently do nothing. min-inline-size: 0 because a flex item floors at
         * min-content by default - without it the box would be overflowed rather than
         * clamped, which is the defect this departure exists to retire.
         * SOURCE profile-editor-v3.css:568-578 / :593-604, the same sheet's own value
         * cell: overflow: hidden; text-overflow: ellipsis; white-space: nowrap. */
        .text {
            display: block;
            min-inline-size: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* The visually-hidden .a11y treatment is the SHARED fragment above, not a
         * copy: visuallyHidden from base.js, structural, first in static styles
         * (CONVENTIONS §5). It was three byte-identical copies here, in ui-badge.js
         * and in ui-keycap.js until the fragment existed. */
    `];

    constructor() {
        super();
        this.label = '';
    }

    render() {
        const named = Boolean(this.label);
        return html`<div id="box" class="box"
            ><span id="text" class="text" aria-hidden=${named ? 'true' : nothing}><slot></slot></span
            >${named ? html`<span id="a11y" class="a11y">${this.label}</span>` : nothing}</div>`;
    }
}

customElements.define('ui-locked-value', UiLockedValue);
