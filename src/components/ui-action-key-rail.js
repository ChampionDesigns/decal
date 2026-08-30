/**
 * ui-action-key-rail.js - Wave 4 item #42 of the 57-component inventory:
 * THE EDITOR FOOTER'S KEY ROW.
 *
 * SCOPE Part 4, Wave 4, "Editor-screen compounds" (SCOPE.md:1654), verbatim:
 *   "| 42 | **Action key rail** | The editor footer's key row (add / duplicate /
 *    reorder buttons - reorder stays buttons, no drag in v1, C7). | small | #1, #15 |"
 * spec inventory row, LAYOUT_SPEC_DRAFT.md:913: "| 42 | Action key rail |
 * `profile-editor-v3.css:1047-1054` | |" - no "why it must be one thing" note and no
 * bug id, which is checked below, not assumed.
 *
 * THE ROW CITES NO BUG ID AND CARRIES ONE DECISION, C7.
 *   C7 (ACCEPTED), SCOPE.md:2327-2329: "the five footer buttons, no drag in v1. The
 *   original reasoning ('drag works with a mouse, not a tablet') still holds for the
 *   primary device. Adding drag later is easy; the standing instruction is not to add
 *   it without asking." Also SCOPE.md:293 and :171, and LAYOUT_SPEC_DRAFT.md:668-670
 *   ("Reorder is buttons, not drag ... Do not add drag without asking (OQ-9)").
 *   So: FIVE keys, no pointer-drag of any kind, and no drag affordance either -
 *   P10's rule ("no dead affordances: if the pane divider is not draggable, it does
 *   not show a drag cursor", LAYOUT_SPEC_DRAFT.md:1139, bug P10) applied one screen over.
 *   Nothing in this file listens for pointerdown, sets a grab cursor or draws a
 *   handle. Slate's own comment at profile_editor.js:2090-2092 is the same sentence:
 *   "mockup footer order minus the SKIPPED drag handle".
 *
 * ===========================================================================
 * DISQUALIFICATION CHECK, RUN FIRST (SCOPE Part 10 §4; prov_query.py --help)
 * ===========================================================================
 * 1. A DECISION? C7 settles the control TYPE (buttons) and the COUNT (five). It does
 *    not touch paint or geometry, so the oracle keeps its vote on those.
 * 2. RESPONSIVE BEHAVIOUR? Slate is frozen at 1920x1200 and has no answer; the layout
 *    spec governs. Every width statement below is the spec's, marked where it comes
 *    up: §2.2 (control heights are fixed tokens, never fluid), §2.3 case 2 (touch
 *    floors), §4.3 (the editor's step columns and what may scroll).
 * 3. ON THE 140-BUG LIST? The rail's own row is clean, but TWO of §7.4's twenty land
 *    on the elements this component is built from, so the oracle is disqualified for
 *    exactly two values and no others:
 *      E13 - "[data-theme=dark] .pe-action-btn { color: #959595 } is LIVE and
 *            off-token; the guard that should catch it only scans markup files, never
 *            stylesheets" (dark-mode.css:46-48). Measured here, so it is a fact and
 *            not a quotation of the bug list:
 *        CITE editor-steps .pe-action-btn [i=214] color: dark rgb(149, 149, 149) /
 *             light rgb(90, 101, 108)  <-  dark dark-mode.css
 *             `[data-theme="dark"] .pe-action-btn` authored `rgb(149, 149, 149)`
 *             !important=no ; light profile-editor-v3.css `.pe-action-btn` authored
 *             `var(--slate-muted)` !important=no
 *      The light value IS --ui-muted (styles/tokens.css:738 #5a656c = rgb(90,101,108),
 *      exact). The dark value is a literal that happens to sit 1-13 units from
 *      --ui-muted dark (#94a1a9). Decal paints the neutral keys --ui-muted in BOTH
 *      themes; the drill in §3 of the suite is what proves it.
 *      E1  - "Ten fixed row tracks sum to EXACTLY the container height, so ... the
 *            horizontal scrollbar at 5+ steps pushes the grid over and
 *            `overflow-y: hidden` CUTS THE ACTION ROW". This component is the row
 *            that gets cut. It cannot cause E1 (the matrix owns those tracks) but it
 *            can reproduce its CLASS - a box that clips its own content silently -
 *            and it uses `overflow: hidden` for the radius, so §6 of the suite
 *            asserts the clip never has anything to clip, at both geometries and
 *            under a squeeze.
 *
 * ===========================================================================
 * WHAT SLATE DOES, MEASURED - every line quoted, never paraphrased
 * ===========================================================================
 * prov_query.py, corpus prov-baseline (dark) + prov-light (light), state
 * `editor-steps`. The rail appears once per step column; the state carries three.
 *
 *   CITE  prov_query.py find --cls pe-action-cell -> "searched 49 state(s) ...
 *         found 3 element(s) in 1 state(s)"; editor-steps rects
 *         [251,1124,316,64] [683,1124,316,64] [1115,1124,316,64];
 *         "distinct geometries (w x h), all matched elements: 316 x 64 x3".
 *   CITE  prov_query.py find --cls pe-action-btn -> "found 15 element(s) in 1
 *         state(s)"; "distinct geometries (w x h), all matched elements: 62 x 62 x15";
 *         first cell's five at x = 252 / 315 / 378 / 441 / 504, y=1125.
 *         FIVE KEYS PER RAIL, THREE RAILS, MEASURED - which is C7's count arriving
 *         from the other direction.
 *   CITE  editor-steps .pe-action-cell [i=210] background-color: dark rgb(58, 72, 82) /
 *         light rgb(203, 208, 211)  <-  dark profile-editor-v3.css `.pe-action-cell`
 *         authored `(NOT CAPTURED - set via a CSS shorthand)` !important=no ; light
 *         same rule.   [= --ui-line, styles/tokens.css:740 #cbd0d3 / :866 #3a4852 -
 *          exact, both themes. The shorthand is profile-editor-v3.css:1057
 *          `background: var(--slate-line)`, read read-only because prov_query refuses
 *          to guess a token name behind a shorthand.]
 *   CITE  editor-steps .pe-action-cell [i=210] gap = 1px, padding-left = 1px,
 *         height = 64px, width = 316px, border-top-left-radius = 6px,
 *         border-top-width = 0px, box-shadow = none, opacity = 1.
 *   CITE  editor-steps .pe-action-btn [i=213] background-color: dark rgb(14, 19, 23) /
 *         light rgb(242, 243, 243)  <-  profile-editor-v3.css `.pe-action-btn`
 *         authored `(NOT CAPTURED - shorthand)` !important=no.
 *         [= --ui-fascia, styles/tokens.css:730 #f2f3f3 / :856 #0e1317 - exact, both.]
 *   CITE  editor-steps .pe-action-btn [i=213] color: dark rgb(176, 196, 206) / light
 *         rgb(49, 92, 112)  <-  profile-editor-v3.css `.pe-action-btn.pe-act-add`
 *         authored `var(--slate-steel)` !important=no.
 *         [= --ui-steel, styles/tokens.css:760 #315c70 / :872 #b0c4ce - exact, both.]
 *   CITE  editor-steps .pe-action-btn [i=212] color: dark
 *         color(srgb 0.811922 0.464784 0.459451) / light
 *         color(srgb 0.609882 0.189961 0.217412)  <-  profile-editor-v3.css
 *         `.pe-action-btn.pe-act-del` authored
 *         `color-mix(in srgb, var(--slate-danger) 72%, var(--slate-muted))`
 *         !important=no.
 *         [carried as arithmetic, not as a value: --ui-status-danger 72% into
 *          --ui-muted reproduces both numbers to six places - .72*.902+.28*.580=.8119,
 *          .72*.400+.28*.631=.4647, .72*.380+.28*.663=.4592 dark, and
 *          .72*.7098+.28*.3529=.6099 / .18997 / .21743 light. Asserted in §3.]
 *   CITE  editor-steps .pe-action-btn [i=211] background-color: dark rgb(14, 19, 23) /
 *         light rgb(242, 243, 243)  <-  profile-editor-v3.css
 *         `.pe-action-btn.pe-act-disabled` - THE DISABLED KEY'S GROUND IS THE LIVE
 *         KEY'S GROUND, measured identical in both themes. Slate's own sheet says why,
 *         profile-editor-v3.css:1076-1081: "An inherited :disabled rule was painting
 *         these a shade lighter than their live siblings - so the two arrows you
 *         CANNOT press (first step's back, last step's forward) were the two that
 *         looked filled, which is the skin's selected treatment. A dimmed glyph on the
 *         same ground is the whole disabled state."
 *   CITE  editor-steps .pe-action-btn [i=211] color: dark rgb(148, 161, 169) / light
 *         rgb(90, 101, 108)  <-  slate-shell.css `#subpage-host :is(button, a):disabled,
 *         #subpage-host [aria-disabled="true"]` authored `var(--slate-muted)`
 *         !important=yes.
 *         READ THAT AGAINST THE COMMENT ABOVE IT. Slate wrote
 *         `color: color-mix(in srgb, var(--slate-muted) 44%, var(--slate-fascia))` for
 *         the dim and A SHELL RULE 1000 LINES AWAY BEAT IT WITH !important, so the
 *         dimmed glyph the comment describes is NOT what renders: the disabled key's
 *         ink lands on plain --slate-muted, within 1-13 units of the live neutral
 *         key's own #959595. The stated fix is defeated by reach-in. That is the
 *         mechanism the shadow boundary removes, not a style preference
 *         (CONVENTIONS §6), and here the dim is the ONE dial - see DEPARTURE 4.
 *
 * ===========================================================================
 * WHAT THIS COMPOUND IS MADE OF, and why #15 is not in the DOM
 * ===========================================================================
 * The row's "Depends on" column reads "#1, #15" - Button and Keycap. What ships:
 *
 *   THE PRESS CONTROL IS #1, ui-button, variant="ghost", five instances, composed.
 *   Not re-implemented: a bare <button> with paint in here would be a second press
 *   control, which is the decay the rewrite exists to stop. Ghost is the variant that
 *   matches the measurement - `border-color: transparent; background-color:
 *   transparent` (ui-button.js) against Slate's `.pe-action-btn { border: 0;
 *   border-radius: 0; background: var(--slate-fascia) }` - so the key's FACE comes
 *   from the cell underneath it and the key contributes no second border. #2
 *   (ui-icon-button) would have been the closer square, and it is NOT used, for a
 *   mechanical reason: its `.btn` carries `border: var(--ui-border-w) solid
 *   var(--ui-line)`, there is no public lever to remove it, and removing it by
 *   re-pointing --ui-border-w is a Gate C failure by construction (guards.js
 *   privatePaletteGuard: "no re-declaring a public --ui-* token inside a component").
 *   A 1px --ui-line border on each key inside a --ui-line seam grid draws 3px of line
 *   between neighbours where 1px is intended - bug L9's shape exactly, "every rail
 *   stepper draws its seam twice" (CONVENTIONS §13).
 *
 *   THE KEY FACE IS THE SEAM UTILITY, NOT #15. ui-keycap is (a) deliberately not
 *   interactive ("NOT INTERACTIVE ... #53 owns pressing", ui-keycap.js) so it cannot
 *   BE a key here, and (b) a different face: #15 paints --ui-key inside a
 *   --ui-line-strong hairline with a 3x skirt and --ui-radius, while the oracle above
 *   measures this key at --ui-fascia with border-top-width 0 and border-radius 0. The
 *   face Decal paints is `.seam-cell` - `background-color: var(--ui-fascia)`
 *   (seams.js) - which is the measured token, arrived at from the utility rather than
 *   copied. Recorded as a deferred question with its one-line reversal.
 *
 *   THE RAIL IS THE SEAM UTILITY. Slate's `.pe-action-cell` is `display: flex;
 *   gap: 1px; padding: 1px; background: var(--slate-line); border-radius:
 *   var(--slate-radius); overflow: hidden` - which is CONVENTIONS §13's grid-gap
 *   divider written out by hand, one screen before the utility existed. Here it is
 *   `.seam-grid.seam-cols.seam-line`: "the gap IS the divider", ink --ui-line, "the
 *   weight that ENCLOSES a control, used between controls".
 *
 * ===========================================================================
 * DELIBERATE DEPARTURES - each one is a row in
 * _skinlab/realine-run/waves/4/ledger-src/42-expected-changes.json and an assertion
 * in test/render/ui-action-key-rail.render.test.mjs
 * ===========================================================================
 *   1. THE KEY IS --ui-control-h SQUARE (64), NOT SLATE'S 62. Slate's key is
 *      `height: 62px !important` inside a 64px cell with 1px of padding - i.e. the
 *      skin's control height minus the seam, so the band could stay exactly 64. Those
 *      are two of the numbers §7.4 E11 counts: "25 literal 64px and 18 literal 62px
 *      in the editor sheet, while --slate-control-height is used once (inside a dead
 *      rule) and --slate-control-inner ZERO times". Decal keeps the CONTROL at the
 *      token and lets the BAND be what that makes it: 64 + 2 x --ui-border-w = 66.
 *      Two px taller than Slate, zero literals, and the key still clears --ui-hit-min
 *      (48) on both axes with paint alone.
 *   2. THE OUTER 1px IS A BORDER, NOT PADDING ON THE GROUND. Slate rings the slab by
 *      padding the seam ground. CONVENTIONS §13 is explicit that "a gap draws lines
 *      BETWEEN cells and never around the outside", and that the enclosure is
 *      --ui-border-w with --ui-line. Same ink, same 1px, one mechanism per job - and
 *      the same shape #4's band already ships (ui-stepper.js .band).
 *   3. THE GLYPH IS --ui-icon (24), NOT SLATE'S 23. `.pe-action-btn svg { width: 23px;
 *      height: 23px }` is a bare literal in the same sheet E11 counts; spec §2.3
 *      case 3 keeps stroke widths and viewBoxes with the artwork (they are carried
 *      verbatim below) but the BOX is the icon token.
 *   4. DISABLED IS ONE DIAL, AND THAT IS WHAT MAKES SLATE'S OWN COMMENT TRUE.
 *      spec §3.7 settles a single --ui-opacity-disabled at .38 against Slate's three
 *      live values; Slate's rail adds a fourth (color-mix 44% muted into fascia) which
 *      the shell's !important then defeats anyway (measured above). Here the dim is
 *      the base's dial on the ui-button host - and because the FACE is painted by the
 *      cell UNDER the transparent ghost button, the dial reaches the glyph and not the
 *      ground. "A dimmed glyph on the same ground is the whole disabled state",
 *      achieved structurally rather than by a fourth value. §4 of the suite measures
 *      both halves: the ground identical to a live sibling's, the glyph at .38.
 *   5. `pointer-events: none` IS NOT CARRIED. Slate needs it because its disabled key
 *      is still a live <button> under a class. Here `disabled` puts the native
 *      attribute on the real control (ui-button's contract), which refuses the press
 *      and removes it from the tab order without a second mechanism.
 *   6. THE FIVE KEYS ARE NAMED, IN THE TRANSLATION LAYER. Slate names them through
 *      getTranslation() already (profile_editor.js:2119-2123), so this is a carry, not
 *      a fix - but it is the affordance §7.4 E14 finds missing two rows up the same
 *      screen ("32 grid +/- buttons share two aria-labels, both UNTRANSLATED"), and it
 *      is worth stating that the rail does it properly. The five keys are not yet rows
 *      in `i18n/source/strings.json`; t() returns the key for the source language, so
 *      the rendered name is identical either way and adding the rows later is purely
 *      additive (deferred question 3).
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   - NO DRAG, NO DRAG AFFORDANCE, NO HANDLE (C7, and OQ-9 says do not add it
 *     without asking). Not a pointerdown listener in the file.
 *   - NO SELECTION TREATMENT, and `selectionSurface` is deliberately not imported.
 *     A key is pressed, not selected; the four dials mean something only because
 *     there is ONE selection component (#3, CONVENTIONS §4), and the wave's own note
 *     forbids a private selected look. The trap is real and Slate hit it from the
 *     other side - its disabled keys "looked filled, which is the skin's selected
 *     treatment". §5 of the suite sets every selection spelling on the host and on a
 *     key and asserts nothing moves.
 *   - NO SERVER DATA, NO STORE, NO ROUTE. `index` and `count` are the step's position
 *     in the profile being edited, handed in by the screen; a rail that fetched
 *     anything would be a Gate 2 violation with no reason to exist. src/data/ and
 *     src/stores/ are not imported and the contract table gains no row.
 *   - NO KEYBOARD MODEL OF ITS OWN. Five tabbable buttons, which is what Slate ships
 *     and what a group of five unrelated actions wants. A toolbar with roving
 *     tabindex is a state model (and a `medium`); recorded as deferred question 2.
 *   - NO `part()` theming surface. Theming crosses the boundary through custom
 *     properties only (Part 4 ground rule 1; A6).
 *
 * ACCESSIBILITY
 *   `role="group"` with a name on the rail, and a per-key accessible name via #1's
 *   `label` (which #1 puts on the real <button>, where a name is allowed). Row #42
 *   cites no Appendix 15 contract and correctly: Appendix 15 is the aria-driven
 *   SELECTION-state selector rule for `.slate-bank` / `.slate-stepper`, and a key
 *   rail has no selection state. What it does have is a disabled state on two of its
 *   five keys, and that is the native attribute on the native control.
 *
 * API
 *   <ui-action-key-rail index="2" count="6"></ui-action-key-rail>
 *   <ui-action-key-rail label="Step 3 actions"></ui-action-key-rail>
 *   <ui-action-key-rail disabled></ui-action-key-rail>       whole rail unavailable
 *   rail.addEventListener('step-action', (e) => e.detail)     -> { action, index, count }
 *
 *   `action` is one of ACTION_KEYS' five ids, in Slate's own footer order:
 *   move-left, delete, insert-after, duplicate, move-right. The event is cancelable,
 *   so a screen can put #19 (confirm dialog) in front of `delete` by calling
 *   preventDefault() and re-issuing - the same shape #18 uses for close-request.
 *
 * @fires step-action - {action, index, count}, bubbles, composed, cancelable.
 */

import { css, html, svg } from 'lit';
import { UiElement } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';
import { I18nController } from 'src/lib/i18n.js';
import 'src/components/ui-button.js';

/** The event a screen listens for. One name, one detail - a press control that needs
 *  a bespoke event per key is one every consumer has to learn five times. */
export const STEP_ACTION = 'step-action';

/**
 * THE FIVE KEYS, IN SLATE'S FOOTER ORDER, read read-only from
 * profile_editor.js:2119-2123 (`cell.appendChild(mkBtn(...))` x5):
 *   move-left . delete . insert-after . duplicate . move-right
 * with Slate's own aria-label strings kept as the translation keys, and its `ink`
 * column carrying the two coloured keys (`pe-act-del`, `pe-act-add`).
 *
 * `edge` marks the two keys C7's reorder pair disables at the ends of the list -
 * "move-left is greyed+inert on the first step, move-right on the last"
 * (profile_editor.js:2091-2092).
 *
 * `minCount` marks a key that needs a LIST rather than a position: it is unavailable
 * below that many steps. Exactly one key has one, and it is DELETE at two.
 *
 * THAT IS A DECLARED DEPARTURE FROM SLATE AND IT WAS ADDED 27 AUGUST 2026. Slate's
 * `deleteStep` splices unconditionally, so its footer will empty a profile - and this
 * file's suite pinned the same behaviour, in as many words ("the only step is still
 * deletable - Slate's behaviour"). It is wrong, and the tree already said so somewhere
 * else: `step-matrix.js render()` refuses to draw a matrix with no steps ("A profile with
 * zero steps is not an editing surface") and hands the other half of the rule to whoever
 * owns the draft - "'never delete the last step' is the draft owner's rule to keep".
 * `editor-draft.js applyStepAction` is that owner and now keeps it.
 *
 * SO THE KEY HAS TO GO GREY, or the refusal would be invisible. Ben, 27 August 2026, on
 * exactly this class of thing: "the 5 buttons down the bottom dont seem to do anything".
 * A button that is pressable and does nothing is the defect this whole rail was just
 * repaired for; a button that is visibly unavailable is an answer. The mechanism is the
 * one already here - `keyDisabled` - and not a new one.
 *
 * WHY IT IS A DEAD END WORTH REFUSING: with no steps there are no step columns, with no
 * step columns there are no action rails, and the action rail is the ONLY route to a new
 * step. Ben met that state from the other side the same morning, on a new profile seeded
 * with an empty step list: "there is not + button to add a new step etc, ie I cannot add
 * any steps."
 */
export const ACTION_KEYS = Object.freeze([
    Object.freeze({ action: 'move-left', label: 'Move step left', ink: 'neutral', edge: 'first' }),
    Object.freeze({ action: 'delete', label: 'Delete step', ink: 'danger', edge: null, minCount: 2 }),
    Object.freeze({ action: 'insert-after', label: 'Insert step after', ink: 'accent', edge: null }),
    Object.freeze({ action: 'duplicate', label: 'Duplicate step', ink: 'neutral', edge: null }),
    Object.freeze({ action: 'move-right', label: 'Move step right', ink: 'neutral', edge: 'last' }),
]);

/**
 * THE ARTWORK, carried verbatim from profile_editor.js:2099-2103 - the same viewBox,
 * the same paths, the same stroke widths (2.5 for the chevrons and the plus, 2 for the
 * trash and the duplicate). spec §2.3 case 3: "icon and glyph geometry intrinsic to
 * the artwork (stroke widths, a 12px arrow square)" stays with the artwork. What does
 * NOT come with it is Slate's `width="22"`/`width="24"` attribute pair and the sheet's
 * `svg { width: 23px }` - the box is --ui-icon, set in the styles below (departure 3).
 */
const GLYPHS = Object.freeze({
    'move-left': svg`<polyline points="15 18 9 12 15 6"/>`,
    delete: svg`<polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6M14 11v6"/>
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>`,
    'insert-after': svg`<path d="M12 5v14M5 12h14"/>`,
    duplicate: svg`<rect x="9" y="9" width="11" height="11" rx="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`,
    'move-right': svg`<polyline points="9 18 15 12 9 6"/>`,
});

/** Slate's own per-glyph stroke widths, kept (see GLYPHS). */
const STROKE = Object.freeze({
    'move-left': '2.5',
    delete: '2',
    'insert-after': '2.5',
    duplicate: '2',
    'move-right': '2.5',
});

export class UiActionKeyRail extends UiElement {
    static properties = {
        /** The step's 0-based position. Disables `move-left` at 0. */
        index: { type: Number, reflect: true },
        /** How many steps the profile has. Disables `move-right` at index === count-1. */
        count: { type: Number, reflect: true },
        /** Accessible name for the group. Defaults to a translated "Step actions". */
        label: { type: String },
        /** Whole rail unavailable: every key dimmed by the one dial and refused. */
        disabled: { type: Boolean, reflect: true },
    };

    /* STRUCTURAL FRAGMENT FIRST (CONVENTIONS §4 rule 1, §13). `selectionSurface` is not
     * here at all - see WHAT IS DELIBERATELY NOT HERE. */
    static styles = [seams, css`
        /* ------------------------------------------------------------------
         * THE HOST
         *
         * The base's defaults are kept whole: display: block + container-type:
         * inline-size. The host is the SLOT the rail is dropped into - a matrix cell,
         * a footer band - and it fills it. The rail inside does NOT fill it; see
         * below. No @container query lives in this file, because every dimension here
         * is a fixed ergonomic token and spec §2.2 requires exactly that: "Control
         * heights, touch targets, hairlines | Fixed token. Never fluid ... A control
         * that shrinks with the window becomes unusable exactly when the window is
         * small."
         *
         * --_ui-key-rail-keys is private (CONVENTIONS §7), a count rather than a
         * length, and is C7's five stated once, for the floor below. */
        :host {
            --_ui-key-rail-keys: 5;
        }

        /* ------------------------------------------------------------------
         * THE RAIL - one slab, seams not gaps of ground
         *
         * .seam-grid.seam-cols.seam-line supplies display: grid, column-gap:
         * var(--ui-seam) and background-color: var(--ui-line). Nothing here restates
         * any of the three: the weight class is (0,2,0) and this rule is (0,1,0), so a
         * background declared here would silently lose (seams.js, trap 3).
         *
         * Slate's equivalent is profile-editor-v3.css:1051-1060, hand-written:
         * flex + gap: 1px + padding: 1px + background: var(--slate-line) +
         * border-radius: var(--slate-radius) + overflow: hidden. */
        .rail {
            box-sizing: border-box;

            /* THE RAIL IS A RANK OF FIVE TOUCH TARGETS AND IS SIZED BY THEM, not by
             * the column it sits in - which is also what Slate does, though with a
             * literal: .pe-action-cell carries width: var(--pe-footer-width), computed
             * 316px, and profile_editor.js:2097 calls it "approved five-key footer
             * rail". A rank of touch targets is spec §2.2's "fixed token, never
             * fluid": a wider editor column wants the same five keys, not five wider
             * ones, and a narrower one must not shave them.
             *
             * Two statements, and they are different jobs. max-content is the WIDTH:
             * five keys at whatever #1's own padding makes a key, so this component
             * never restates another component's internals. The calc is the FLOOR,
             * stated in this file's own terms - five --ui-control-h targets, four
             * seams, two border edges - so the rank can never come out below the
             * ergonomic minimum even if #1 got tighter. max(376, 326) today.
             *
             * WHY THE FLOOR IS ARITHMETIC AND NOT min-content ON THE HOST - #4 hit
             * this first and documents it (ui-stepper.js): "the base puts
             * container-type: inline-size on the host, and inline-size CONTAINMENT
             * means the host's inline size may not depend on its contents, so
             * min-content resolves to 0". The rail is INSIDE the containment, so
             * max-content works here and cannot work on :host. When a container is
             * narrower than the rank, the rail overflows it where a reader can see -
             * T9's principle, and the honest opposite of E1, where a too-small
             * container silently cut the action row away. */
            /* THE RANK TAKES THE WIDTH IT IS GIVEN, AND ITS KEYS DIVIDE IT.
             *
             * Ben, 25 August 2026: "tweak the bottom buttons so the 4 buttons are the
             * same total width as say the slider ... Then make all the controls 350px
             * wide? This should get it pixel perfect width."
             *
             * That is the goal, and it is a better one than a square key: every control
             * in a step column starts and ends on the same two pixels. A rank sized to
             * its own keys can only hit that by arithmetic that happens to agree; a rank
             * sized to its container hits it by construction.
             *
             * THE FLOOR STAYS AND IT IS STILL THE ERGONOMIC ONE - five --ui-control-h
             * targets and the chrome between them. Below that the rail overflows its HOST
             * where a reader can see it, which is T9's principle and the honest opposite
             * of E1. Nothing is ever cut INSIDE the slab, because the floor is what five
             * of #1's keys actually occupy - see the min-inline-size below.
             * A caller that gives it less than the floor gets a visible overflow rather
             * than five keys too small to press. */
            inline-size: 100%;
            /* FIVE CONTROL HEIGHTS, NOT FIVE HIT MINIMA — and the difference is a clip.
             *
             * This floor read --ui-hit-min (48) for one release. A 48px track cannot hold
             * one of these keys: #1 pads a button --ui-space-5 a side and encloses it in a
             * hairline, and box-sizing is border-box, so a key's used width can never fall
             * below 24 + 24 + 2 = 50 whatever any minimum says. At the 48 floor every key
             * stood 2px out of its track and the slab's own overflow: hidden CUT them —
             * silently, which is E1's whole class arriving through the door this component
             * exists to close.
             *
             * 64 IS ALSO BEN'S OWN NUMBER. 25 August 2026: "Copy Slate but make the
             * buttons 64 x 64". A rank whose floor is 48 contradicts the square key it is
             * a rank of. Five --ui-control-h targets, four seams, two border edges — 326
             * today, and nothing here is a literal. */
            min-inline-size: calc(
                var(--_ui-key-rail-keys) * var(--ui-control-h)
                + (var(--_ui-key-rail-keys) - 1) * var(--ui-seam)
                + 2 * var(--ui-border-w));

            /* ONE TRACK PER KEY, AND EVERY KEY IS SQUARE.
             *
             * Ben, 25 August 2026: "Copy Slate but make the buttons 64 x 64". Slate's
             * are 62 squares; this file's header already argued for 64 as
             * --ui-control-h, "two px taller than Slate, zero literals", and the height
             * was always right. The WIDTH was not: minmax(64, max-content) let a key
             * grow to whatever #1's padding made it, measured 75 against a 64 box, so
             * the rank read as five wide keys rather than five square ones.
             *
             * EQUAL SHARES OF THE RANK, and the height stays --ui-control-h. 1fr is
             * what makes the five keys divide the width the rank was given, so the rail
             * ends where the stepper above it ends. At the 350 this grid gives a control
             * that is 68.8 a key: the four seams and the two border edges live inside
             * the 350, which is why the number is not the round 70 - the alternative is
             * a rail 356 wide beside a 350 stepper, which is the thing being fixed.
             *
             * A KEY IS NEVER BELOW THE HIT FLOOR because the rank's own minimum is five
             * of them; the tracks cannot be smaller than the box that holds them. */
            grid-auto-flow: column;
            grid-auto-columns: minmax(0, 1fr);
            align-items: stretch;

            /* DEPARTURE 2: the outer 1px is the enclosure, not the ground showing
             * through padding. Same ink, same width, the mechanism CONVENTIONS §13
             * names for enclosing a box. */
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);

            /* Slate's declaration, kept, and for Slate's reason: square keys inside a
             * rounded slab square off its corners unless the slab clips them. It is
             * NOT a scroll region and never has anything to clip - the rail is sized
             * BY its tracks - which is what §6 of the suite measures, because a silent
             * clip is E1's whole class. */
            overflow: hidden;
        }

        /* THE KEY FACE. .seam-cell is --ui-fascia, the token the oracle measures on
         * .pe-action-btn. It is on this wrapper and NOT on the button, deliberately:
         * the disabled dial fades the element it is on, and a faded FACE would make
         * the two arrows you cannot press look different from their live siblings -
         * which is the defect Slate's own comment at profile-editor-v3.css:1076-1081
         * describes fixing. Ground here, glyph in there, one dial (departure 4). */
        .cell {
            display: grid;
        }

        /* THE KEY - #1, ghost.
         *
         * NOTHING IS DECLARED HERE AND THAT IS THE FINDING. #1's host is inline-grid,
         * so its inner <button> is a GRID ITEM and stretches to the host box; the host
         * is a grid item of .cell and stretches to the track. The whole key is
         * therefore pressable, with no dead strip - which is #2's documented widening
         * behaviour arriving for free through #1.
         *
         * Measured, because the obvious "fix" breaks it: writing #1's own documented
         * full-width lever here - ui-button { display: block } - turns the host into a
         * block container, and a <button> in a block container is shrink-to-fit in
         * Chrome whatever its display, so the control came out 74px inside a 255px key
         * with 181px of dead fascia beside it. That is precisely the "64px button in a
         * 96px host with a dead strip beside it" ui-icon-button.js:104-117 names.
         * Asserted in §2 of the suite on every key, at both geometries. There is no
         * .key rule at all, and adding one is how the dead strip comes back. */

        /* THE GLYPH.
         *
         * The svg is this component's own element, sitting in this shadow tree and
         * slotted into #1 - so it is styled here, by class, with no ::slotted() and no
         * reach into #1. color is set on the artwork itself, which is what overrides
         * the ink #1's .btn hands down by inheritance; every stroke in GLYPHS is
         * currentColor.
         *
         * flex: none because the glyph is a flex item inside #1's .btn: at the rail's
         * floor the button's content box is 64 - 2 x 24 = 16px and the artwork is
         * deliberately allowed to overflow it symmetrically (it stays inside the key's
         * own 64px box and centres). Shrinking it instead would make the icon smaller
         * exactly when the panel got harder to hit. */
        .glyph {
            display: block;
            flex: none;
            inline-size: var(--ui-icon);
            block-size: var(--ui-icon);
            color: var(--ui-muted);
        }

        /* The two coloured keys, in the order the cascade needs (single classes, later
         * wins - CONVENTIONS §4 rule 2 keeps all of this off ids). Slate's arithmetic
         * for the delete key is carried as arithmetic, not as its computed value, so
         * it stays true when either token moves. */
        .glyph-accent {
            color: var(--ui-steel);
        }

        .glyph-danger {
            color: color-mix(in srgb, var(--ui-status-danger) 72%, var(--ui-muted));
        }
    `];

    constructor() {
        super();
        this.index = 0;
        this.count = 1;
        this.label = '';
        this.disabled = false;
        this.i18n = new I18nController(this);
    }

    /** The group's accessible name. */
    get groupLabel() {
        return this.label || this.i18n.t('Step actions');
    }

    /**
     * Is one key unavailable? Three reasons now, and all three are presentation state the
     * screen already owns: the whole rail is disabled, this is an edge key at its edge, or
     * the list is too short for this key to mean anything. Reorder is buttons (C7), so
     * "cannot move further" has to be a button state; there is no drag to make it obvious
     * another way, and "cannot delete the last step" has no other way either.
     *
     * `minCount` IS CHECKED BEFORE `edge`, and on a one-step profile that matters: index 0
     * of 1 is simultaneously first and last, so all three of the marked keys answer true
     * and the only live pair is insert-after and duplicate - which is exactly right. That
     * is the state a brand-new profile opens in.
     */
    keyDisabled(key) {
        if (this.disabled) return true;
        const count = Number.isFinite(this.count) ? this.count : 1;
        const index = Number.isFinite(this.index) ? this.index : 0;
        if (Number.isFinite(key.minCount) && count < key.minCount) return true;
        if (key.edge === 'first') return index <= 0;
        if (key.edge === 'last') return index >= count - 1;
        return false;
    }

    /** The rendered <ui-button> for one action id - what a test and a screen focus. */
    keyElement(action) {
        return this.renderRoot?.querySelector?.(`#key-${action}`) ?? null;
    }

    #press = (event) => {
        const action = event.currentTarget?.dataset?.action;
        if (!action) return;
        this.dispatchEvent(new CustomEvent(STEP_ACTION, {
            bubbles: true,
            composed: true,
            cancelable: true,
            detail: { action, index: this.index, count: this.count },
        }));
    };

    #renderKey(key) {
        const inkClass = key.ink === 'neutral' ? '' : ` glyph-${key.ink}`;
        return html`<div class="cell seam-cell"><ui-button
            id="key-${key.action}"
            variant="ghost"
            focus-ring="inset"
            data-action=${key.action}
            label=${this.i18n.t(key.label)}
            ?disabled=${this.keyDisabled(key)}
            @click=${this.#press}
        ><svg
            class="glyph${inkClass}"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width=${STROKE[key.action]}
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >${GLYPHS[key.action]}</svg></ui-button></div>`;
    }

    render() {
        /* focus-ring="inset" on every key is L24's answer for this shape: the rail
         * clips (for the radius) and an outset ring at +2px would be cut on all four
         * sides. It is the host attribute rather than the private property #4 sets on
         * its band, because base.js declares --_ui-focus-offset on :host - so a value
         * inherited from the rail is overridden at each ui-button and only the
         * attribute reaches through (base.js:436, :443). */
        return html`<div id="rail" class="rail seam-grid seam-cols seam-line"
            role="group" aria-label=${this.groupLabel}
        >${ACTION_KEYS.map((key) => this.#renderKey(key))}</div>`;
    }
}

customElements.define('ui-action-key-rail', UiActionKeyRail);
