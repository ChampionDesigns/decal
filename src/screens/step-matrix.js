/**
 * step-matrix.js — <step-matrix>, the profile editor's Steps grid.
 * `LAYOUT_SPEC_DRAFT.md` §4.3 and §7.4 (E1, E7, E11, E13, E14, E15, E16, E17-E20);
 * SCOPE Part 5 §5; wave 5.5 (wf-w5p5-editor), rows `step-matrix-grid`,
 * `step-matrix-scroll`, `compact-density`, `locked-value-box`, `exit-chip-sentence`,
 * `exit-band-slots`, `action-key-rail`, `matrix-accessibility`, `step-name-input`.
 *
 * ===========================================================================
 * ONE GRID, AND THAT IS THE WHOLE STRUCTURAL IDEA  (§4.3)
 * ===========================================================================
 * "One grid holds the sticky row-label rail AND every step column, so a row and its
 * label share a track and align by construction with no JS height sync. This is the
 * best structural idea in the app. Only the fixed tracks are wrong."
 *
 * So the rail cell and the N data cells of one row are cells of ONE grid, and nothing
 * in this file measures or synchronises a height. What did not come across is the
 * track lists:
 *
 *   Slate  rows    82 92 92 88 88 88 92 92 280 88 !important  — ten literals summing
 *                  to exactly 1082, the canvas height spelled out (E1)
 *          cols    '192px' + (' ' + visualColW + 'px').repeat(n), with the fill/scroll
 *                  flip at steps.length <= 4 — a 4 derived from 1920 and documented
 *                  nowhere (E15)
 *   here   rows    grid-auto-rows: minmax(min-content, auto) — content-derived, with
 *                  the exit row taking its own min from its three stable slots
 *          cols    minmax(rail-min, fit-content(rail-cap))
 *                  repeat(var(--_ui-step-count), minmax(step-min, 1fr))
 *
 * THE FILL THRESHOLD IS NOT DECLARED ANYWHERE, AND THAT IS THE POINT. A step column is
 * minmax(step-min, 1fr): above the width where N columns of step-min fit, 1fr shares
 * the space and nothing scrolls horizontally; below it the minimum binds, the grid
 * overflows and the scroll container scrolls. The flip is a CONSEQUENCE of the track
 * function and of the container's own width — there is no number to derive from 1920,
 * and no steps.length to compare against. The suite SWEEPS the width and asserts the
 * flip happens exactly once, where the arithmetic says it must.
 *
 * ===========================================================================
 * E1's TRAP IS LIVE AGAIN HERE, AND IT IS ANSWERED BY THREE DECLARATIONS
 * ===========================================================================
 * E1: "Ten fixed row tracks sum to EXACTLY the container height, so on any platform
 * with classic scrollbars the horizontal scrollbar at 5+ steps pushes the grid over and
 * overflow-y: hidden CUTS THE ACTION ROW."
 *
 * Both axes scroll here, so a horizontal scrollbar still steals block size. The three
 * declarations that make that harmless:
 *
 *   overflow: auto on BOTH axes   the stolen height produces a VERTICAL SCROLLBAR
 *                                 rather than a clip (§2.4: nothing clips silently,
 *                                 and hiding a scrollbar on a region that scrolls is
 *                                 banned)
 *   align-content: start          rows keep their own heights instead of being
 *                                 stretched to fill the scrollport. This is the
 *                                 declaration that stops the content box being sized
 *                                 to exactly its own content — stretch is what makes
 *                                 "rows sum to the container" true by accident
 *   no block-size: 100% on the grid, and no row track that names a height
 *
 * The suite proves it as a rendered fact: with a horizontal scrollbar PRESENT at a
 * height where the matrix also scrolls vertically, the action row is scrolled to and
 * measured fully inside the scrollport.
 *
 * M6 IS AN OPEN MEASUREMENT AND NOTHING HERE ASSUMES ITS ANSWER. Whether the Android
 * WebView uses overlay scrollbars (§7.9 item 8) decides how much block size a
 * horizontal scrollbar steals — 0 with overlay scrollbars, ~15px with classic ones.
 * This geometry holds either way BECAUSE it never books a scrollbar allowance: no
 * token, no padding and no test here encodes a scrollbar width. What the engine steals
 * is read back from the box (scrollbarBlock) at assertion time.
 *
 * ===========================================================================
 * C3 — A NAMED COMPACT DENSITY, WINNING LOCALLY
 * ===========================================================================
 * The corpus contradicts itself: Part 5 §5 says the matrix's named compact density
 * "composes with the global density", Part 2 §5 rule 2 says a container-scoped
 * re-declaration "wins locally over the ambient value and composes with neither".
 * Rule 2 is the register's own composition rule and owns the token, so this is the
 * WINS-LOCALLY reading (DQ recorded, reversible at one declaration site).
 *
 * IT RE-DECLARES THE THING IT WANTS, NEVER THE MULTIPLIER. styles/tokens.css:1176-1182
 * states the mechanism: "a container-scoped re-declaration of --ui-density: var()
 * substitutes at computed-value time on the element where the calc is written, so
 * --ui-band-h already resolved on :root and a descendant's --ui-density does not
 * re-derive it. C3 re-declares the cap/band token it wants, not the multiplier."
 *
 * So compact is two re-declarations and nothing else:
 *   - this matrix's own VERTICAL RHYTHM, --_ui-matrix-rhythm, one step down the space
 *     ladder (Slate's measured 12px cell padding becomes 8);
 *   - density="compact" passed to every #4 ui-stepper, which re-declares its own cap
 *     from --ui-stepper-cap (78) to --ui-control-h (64) — C3's named density, already
 *     built, and the reason the matrix's private hard-coded 64 does not come across.
 *
 * DENSITY MULTIPLIES VERTICAL RHYTHM ONLY. --ui-control-h and --ui-hit-min are not
 * touched here and cannot be: nothing in this file declares a control height at all.
 * The suite measures both across the density flip and asserts they do not move.
 *
 * ===========================================================================
 * ONE OWNER PER DIMENSION  (E2/E3/E5/E8)
 * ===========================================================================
 * There is NO LAYOUT COMPUTED IN JAVASCRIPT in this file: no ResizeObserver, no
 * matchMedia, no getBoundingClientRect, no measured width written back as a style, and
 * no exported scale. E8 is the cautionary tale — --pe-scale was declared, documented,
 * exported and TESTED and connected to nothing.
 *
 * ONE VALUE CROSSES FROM JS TO CSS AND IT IS A COUNT, NOT A LENGTH:
 * --_ui-step-count, the number of step columns, written on the host in updated() and
 * read by repeat() in the track list. It is private (--_ui-, CONVENTIONS §7) and a
 * COUNT rather than a length, which is the convention ui-action-key-rail.js:335
 * established for exactly this shape. It is content, not geometry: nothing measures a
 * box to produce it. The suite proves it is CONSULTED by moving it and watching the
 * used track list and a rendered box change (E8's proof, not a token drill).
 *
 * ===========================================================================
 * THE RAIL, AND E19
 * ===========================================================================
 * E19: "white-space: nowrap ... with no overflow; rail labels can spill onto the first
 * data cell." Slate's rail is a 192px track holding a nowrap label with no overflow
 * rule, so a longer translation of "Max Duration" paints over the first step column.
 *
 * Here the rail track is minmax(rail-min, fit-content(rail-cap)) and the rail cell
 * clips with an ellipsis. fit-content() is what makes both halves true at once: the
 * track grows with the longest label (§4.3's max-content) but never past the cap, and
 * a cell with overflow: hidden has an automatic minimum size of zero, so the cap
 * actually binds. THE CAP IS DERIVED: a label rail may not cost more width than one
 * step column, so it is --_ui-step-min. Reversible at one declaration.
 *
 * ===========================================================================
 * WHAT THIS COMPONENT DOES NOT DO
 * ===========================================================================
 *   - NO DRAG, in any form (C7). No draggable attribute, no pointermove, no drop
 *     target, and no drag-looking affordance that does not drag (P10, "no dead
 *     affordances"). Reorder is #42's move-left/move-right pair and stays buttons.
 *   - NO HIDDEN EXIT-CHIP CONTROL SET (C8). The exit band is #41, which renders the
 *     visible sentence and its remove control only; the serialisation seam is
 *     serializeExitSlots() in the model layer, re-provided as a plain function and
 *     re-exported below so a consumer of this matrix needs one import.
 *   - NO RANGES TABLE (B2/B3). Not one min, max or step is written here. Every bound
 *     arrives through the `ranges` door (src/lib/editor-ranges.js) which itself
 *     declares no number. A field the door refuses renders UNAVAILABLE — a disabled
 *     control carrying the door's own reason — never a plausible band (A7).
 *   - NO DRAFT MUTATION. `steps` is read and never written; every change leaves as an
 *     event and the screen owns the draft. Same contract as #41.
 *   - NO NUMPAD, NO DIALOG. `editable` is OFF by default, so a value cell promises
 *     aria-haspopup="dialog" only when the screen that mounts the matrix has a numpad
 *     to open. A promise with nothing behind it is the worse defect.
 *   - No !important, no colour literal, no @font-face, no @media (width...), and no
 *     @container: the fill/scroll flip is a track function, not a query.
 *
 * ===========================================================================
 * MOUNTING IT
 * ===========================================================================
 *     <editor-screen>
 *       <step-matrix slot="steps" .steps=${steps} .ranges=${editorRanges}></step-matrix>
 *     </editor-screen>
 *
 * The region is one grid cell of <editor-body>, minmax(0,1fr) in both axes, and the
 * slot is display: contents so THIS element is the grid item. The region declares no
 * overflow: §4.3 gives both axes to this component and a second owner there would be
 * E2/E3's class (editor-screen.js's own header states the same contract).
 */

import { css, html, nothing, svg } from 'lit';

import { UiElement, focusRing, visuallyHidden } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import {
    STEP_MATRIX_ROWS,
    CELL_NAME_KEY,
    STEP_NAME_KEY,
    STEP_ORDINAL_KEY,
    HELD_TARGET_TEXT,
    bankOptionsFor,
    cellKindFor,
    fieldFor,
    matrixChannel,
    readValue,
    STEP_MATRIX_ROW_KEYS,
} from 'src/lib/step-matrix-rows.js';

/* THE HEAD CELL'S THIRD LINE reads the ONE mode table, the same one the Pump bank and
 * the review sentence read. A local map of four words here would be a second table of
 * the same four. */
import { LEVER_FEEL_WORD, PUMP_MODE_LABEL, inferLeverPreset } from 'src/lib/profile-modes.js';

/**
 * The step count at which Slate stops filling and starts scrolling.
 *
 * ORACLE `profile_editor.js:2160`: `const visualMode = steps.length <= 4 ? 'fill' :
 * 'scroll'`. The two widths that follow from it are declared in the sheet; this is the
 * one number that decides between them, and it is here because a stylesheet cannot
 * compare a count.
 */
const SLATE_FILL_MAX_STEPS = 4;

/* THE RENAME PENCIL, the ONE mark the profile title uses (Ben, 25 August 2026: "this
 * will also be the same icon used for the step title"). */
import { penIcon } from 'src/lib/icons.js';

/* THE CELLS' CONTENT — every one a library component, composed. A hand-built copy of
 * any of them is scope invention (Part 10 §9). */
import 'src/components/ui-stepper.js';
import 'src/components/ui-bank.js';
import 'src/components/ui-locked-value.js';
import 'src/components/ui-text-field.js';
import 'src/components/ui-exit-sentence.js';
import 'src/components/ui-action-key-rail.js';
/* The add door dispatches the SAME event the per-step key rail does — one writer, one
 * rule. See `#renderAdd`. */
import { STEP_ACTION } from 'src/components/ui-action-key-rail.js';

/** C8's seam, re-exported: a consumer of the matrix needs one import for the band. */
export { serializeExitSlots } from 'src/lib/exit-sentence.js';

/** The event a screen listens for when a cell's value changes. */
export const STEP_CHANGE = 'step-change';

/** The event a screen listens for when a value cell asks for the numpad. */
export const STEP_EDIT = 'step-edit';

/**
 * THE EMPTY AREA'S NAME, as an i18n KEY (D2 — the key IS its English text). It names the
 * OUTCOME rather than the region, because the region is what a person sees and the outcome
 * is what they are choosing: "Steps" is already the tabpanel's name and sharing it here
 * would be F-017's collision with none of its excuse.
 */
export const ADD_STEP_KEY = 'Add a step';

/** The two densities, C3's named states. `compact` is this screen's own. */
export const MATRIX_DENSITIES = Object.freeze(['regular', 'compact']);

export class StepMatrix extends UiElement {
    static properties = {
        /**
         * THE DRAFT'S STEPS, READ AND NEVER WRITTEN. An array of profile steps in the
         * shape ReaPrime serves ({name, pump, transition, exit, volume, seconds,
         * weight, temperature, sensor, limiter:{value,range}, + the mode's own target
         * key}). Every change leaves as an event; the screen owns the draft.
         */
        steps: { attribute: false },

        /**
         * THE ONE RANGES DOOR (B2), injected — `createEditorRanges({machineLimits})`
         * from src/lib/editor-ranges.js. It travels as a value because the machine
         * table is genuinely per-machine and a module-level import would let a second
         * caller hold a different one. Absent, or refusing a field, renders that
         * control UNAVAILABLE with the door's own reason (A7).
         */
        ranges: { attribute: false },

        /** C3's named density. `regular` | `compact`, reflected so one attribute is
         *  the state a test and a screen both read. This screen's matrix is compact. */
        density: { type: String, reflect: true },

        /** The table's accessible name (D2 — a value, not an IDREF across a root). */
        label: { type: String },

        /** B9 hint: may Power be offered as a cross-variable exit? #41's own prop. */
        powerExitOffered: { type: Boolean, attribute: 'power-exit-offered' },

        /** Capability hint: is HOLD authorable on this machine? transitionSegments'. */
        holdOffered: { type: Boolean, attribute: 'hold-offered' },

        /** Capability hint: are the advanced Power/Lever modes offered? pumpChipsFor'. */
        pumpModesOffered: { type: Boolean, attribute: 'pump-modes-offered' },

        /**
         * Does pressing a value cell open a numpad? Default NO. #4's own reasoning,
         * kept: a button promising aria-haspopup="dialog" that opens nothing is worse
         * than a plain readout, so the screen opts in when it has the dialog.
         */
        editable: { type: Boolean },

        /**
         * Internal: which step's name is being TYPED, by index, or null.
         *
         * SLATE'S SHAPE, AND THE HEADER'S. A step name is a heading until it is pressed
         * and a field while it is (`#editor-title-display` swapping to
         * `#editor-title-input`, `profile_editor.js:3255`), which is the same pair this
         * screen's own profile title uses one band up. The index and not a boolean,
         * because two columns must not both be open.
         */
        _editing: { state: true },
    };

    static styles = [typeRoles, seams, visuallyHidden, css`
        /* NO BACKTICK IN THIS TEMPLATE, comment or not: one ends the tagged template
         * where it stands and the file stops parsing as JavaScript some way further on.
         *
         * ===================================================================
         * THE GRID, THE SCROLL REGION AND THE FLOOR — ONE BOX, ONE OWNER
         * ===================================================================
         * The host IS the grid AND the scrollport. Two boxes would mean two owners of
         * one dimension: the inner grid would take the scrollport width and hand its
         * size on, which is E2/E3's class and how a floor stops binding.
         *
         * display / gap / ground come from the seam utility through the classes added
         * to the HOST in connectedCallback, because a .seam-grid rule inside this
         * shadow root can never match its own host (CONVENTIONS §13 (b)). Same
         * construction as editor-screen.js. The weight is --ui-line and the gap is
         * COLUMNS ONLY, which is Slate's own measured matrix seam:
         *   CITE editor-steps .pe-grid [i=17] gap = 0px 1px, background-color =
         *        rgb(58, 72, 82) / rgb(203, 208, 211) = --ui-line in BOTH themes
         * (seams.js quotes both lines; the utility exists for this grid). */
        :host(.seam-grid) {
            /* THE FOUR LENGTHS, all private (CONVENTIONS §7), all declared once.
             *
             * --_ui-rail-min and --_ui-step-min are §4.3's own two numbers, written
             * where the track list that uses them is written and nowhere else.
             *
             * --_ui-rail-cap is DERIVED and is E19's other half: a label rail may not
             * cost more width than one step column, so the cap is the step column's
             * own minimum. One declaration to move if it is ever wrong.
             *
             * THE RAIL FLOOR STAYS AT §4.3's 160 AND THAT IS A DEFERRED QUESTION, NOT
             * A PREFERENCE (parity surface 4, DQ-4-A). Slate's rail renders 192px wide
             * with its row labels in small caps on all ten label cells, and this rail is
             * 160 with body copy. Restoring the small caps needs the width and the width
             * costs the FLOOR geometry its fill regime: measured, at 1000x600 with two
             * steps the matrix scrollport is 975px and 192 + 2 x 400 + 2 seams = 994, so
             * the two step columns stop fitting. No single number does both - 173 is the
             * widest rail that still fills and 179 the narrowest that holds the widest
             * label (EXIT CONDITIONS, 155px, in a cell that spends 24px on padding).
             * Ben's call; the ground half below is separable and landed. */
            /* THE RAIL, SLATE'S OWN WIDTH. ORACLE profile_editor.js renders
             * grid.style.gridTemplateColumns = '192px' + ..., measured 192px on the
             * running skin. A LENGTH and not fit-content(), because the column cap
             * subtracts it. */
            --_ui-rail-w: 192px;

            /* SLATE'S TWO COLUMN WIDTHS. ORACLE profile_editor.js:2160-2161 - 431 at
             * four steps or fewer, 372 at five or more. updated() picks between them;
             * the default is the wide one, which is what a matrix whose step count has
             * not been written yet should draw. */
            --_ui-step-w-fill: 431px;
            --_ui-step-w-scroll: 372px;
            --_ui-step-w: var(--_ui-step-w-fill);

            /* THE CONTROL'S WIDTH, AND IT IS A CONSTANT IN BOTH MODES. ORACLE
             * --pe-control-width reads 346px at two steps AND at five: Slate pins the
             * stepper and the segmented bank and lets the column breathe around them.
             *
             * 350 AND NOT SLATE'S 346, by Ben's own arithmetic on 25 August 2026: "make
             * all the controls 350px wide? This should get it pixel perfect width." The
             * five action keys divide it into fives, which 346 does not do cleanly, and
             * the four pixels are invisible against a 431 column. Every control in a step
             * cell is this wide, the key rail included - which is the whole point. */
            --_ui-step-ctrl-w: 350px;

            /* The cell's floor is the control plus its own inset, so a column can never
             * be narrower than what stands in it. */
            --_ui-step-min: calc(var(--_ui-step-ctrl-w) + 2 * var(--ui-space-3));

            --_ui-rail-min: var(--_ui-rail-w);
            --_ui-rail-cap: var(--_ui-step-min);


            /* THE COUNT, not a length — the convention ui-action-key-rail.js:335
             * established. Declared here so the track list is never invalid before
             * the first render writes the real count. */
            --_ui-step-count: 1;

            /* The row split, defaults matching STEP_MATRIX_ROWS' own shape so the track
             * list is never invalid before the first render writes the real counts. */
            --_ui-rows-before-exits: 8;
            --_ui-rows-after-exits: 1;

            /* THE VERTICAL RHYTHM, and the only thing C3's compact re-declares here.
             * Slate's own cell padding is 12px (E15 counts it: "cell padding 12 +
             * control 346 = 370 in a 372px column"), which is --ui-space-3 exactly. */
            --_ui-matrix-rhythm: var(--ui-space-3);

            /* THE EXIT ROW'S OWN MIN (§4.3, "the exit row gets its own min"), as
             * Appendix 9's three stable slots rather than Slate's fixed 280px track:
             * three #41 rows at --ui-control-h with the band's own two gaps between
             * them. Arithmetic over tokens the band itself uses, so it cannot
             * disagree with what it measures (ui-exit-sentence.js .row is
             * min-block-size: var(--ui-control-h) and the band gap is --ui-space-2). */
            /* THE BAND'S OWN GAP, AND THE GRID'S RHYTHM ARE ONE NUMBER NOW.
             *
             * Ben, 25 August 2026: "the skin on the tablet still shows narrow spacing
             * between the exit when condition chips." Measured, ours was 8 and so is
             * Slate's - the band was not tighter than the oracle, it was tighter than the
             * ROWS AROUND IT.
             *
             * TWICE THE RHYTHM, BECAUSE A ROW GAP IS TWO CELLS' PADDING. Ben, 25 August
             * 2026: "I just want it to be the same gap as say between target and limiter,
             * they should be treated the same way as the other rows, should be able to
             * change one value that adjusts all the row gaps."
             *
             * The first pass set this to the rhythm and that was the wrong arithmetic, so
             * the band still read tighter than everything around it. What separates the
             * Target control from the Limiter control is not one rhythm - it is Target's
             * padding-block-end PLUS Limiter's padding-block-start, and the cell pays the
             * rhythm on BOTH edges. Measured on the tablet at 0.1.20: Target to Limiter
             * 19.99, Pump to Transition 19.99, band 10. The band's slots are siblings
             * inside ONE cell, so nothing pays that padding for them and the gap has to
             * carry the whole distance itself.
             *
             * ONE NUMBER STILL MOVES ALL OF IT. --_ui-matrix-rhythm is the only place a
             * density is written; every row gap and now the band's own pitch are
             * expressions over it, so they cannot drift apart again. */
            --_ui-exit-gap: calc(2 * var(--_ui-matrix-rhythm));
            --_ui-exit-row-min: calc(3 * var(--ui-control-h) + 2 * var(--_ui-exit-gap));

            /* THE WHOLE CELL, AND THE TRACK HAS TO ASK FOR THE SAME NUMBER.
             *
             * --_ui-exit-row-min is the three SLOTS. The cell pays the matrix rhythm on
             * both of its own edges on top of them (see .cell.exits), so the box the
             * track has to hold is two rhythms taller than the slots are.
             *
             * IT WAS WRITTEN TWICE AND THE TWO DISAGREED. The track floor asked for the
             * slots and the cell's floor asked for the slots plus the padding, so at the
             * intrinsic height the cell stood 2 x --_ui-matrix-rhythm — 20px at the
             * default density — taller than the row it is in, and its rail label sat
             * short of it. A row and its label share a track BY CONSTRUCTION is this
             * grid's first rule; two floors derived apart is how it stopped being true.
             * Found 26 August 2026 by the rendering suite, which measures the pair. */
            --_ui-exit-cell-min: calc(var(--_ui-exit-row-min) + 2 * var(--_ui-matrix-rhythm));

            /* THE TRACKS. §4.3's own two lines, with one grammar correction stated
             * rather than silently absorbed.
             *
             * THE RAIL. §4.3 writes it as minmax(160px, max-content) AND asks for
             * "overflow: hidden + ellipsis" on it. Those two cannot both be true: a
             * max-content track is never narrower than its content, so the ellipsis
             * could never appear and a long translation would simply eat the width it
             * wanted. fit-content(cap) is max-content CLAMPED, which is the pair of
             * behaviours the paragraph describes.
             *
             * AND fit-content() IS NOT A minmax() MAXIMUM. The grammar is
             * <track-size> = minmax(<inflexible-breadth>, <track-breadth>) |
             * fit-content(<length-percentage>), so fit-content inside minmax makes the
             * whole declaration invalid and the grid silently falls back to ONE COLUMN
             * (measured). The 160 floor therefore lives where fit-content already
             * reads it: fit-content's own minimum is auto, and auto is the item's
             * minimum contribution, so --_ui-rail-min is declared on the rail CELL
             * below. Measured across all four cases: a short label gives a 160px rail,
             * a very long one 300 and never more, and in scroll mode the rail falls
             * back to its floor and ellipsises - the rail gives way before the data
             * does.
             *
             * THE STEP COLUMNS ARE minmax(auto, 1fr) AND NOT minmax(300px, 1fr), AND
             * THE DIFFERENCE IS E15. §4.3's 300 is a DESIGN floor written before the
             * library existed; the widest control this grid actually holds is #42's
             * five-key rank, which is 376px as built (its own header records
             * "max(376, 326) today") and 400 with this cell's rhythm. A track whose
             * minimum is the literal 300 would hand the rail a 300px column, and #42
             * then does what its header says it does: "when a container is narrower
             * than the rank, the rail overflows it where a reader can see". Measured
             * at 700px of stage: 88px of rail hanging over the next column.
             *
             * E15 is that failure exactly - "cell padding 12 + control 346 = 370 in a
             * 372px column, and NOTHING IN EITHER FILE CONNECTS THE THREE NUMBERS". So
             * the three numbers are connected here: an auto minimum takes the LARGEST
             * of what the items need, the 300 design floor moves onto the cells (where
             * it is one of those items' contributions), and the column can never come
             * out narrower than the widest control standing in it. Nothing is typed
             * twice and no number is copied from another component. */
            /* SLATE'S TWO COLUMN WIDTHS, WHICH ARE CONSTANTS AND NOT A FORMULA.
             *
             * I HAD THIS WRONG ONCE. computeGridLayout is in Slate's source and it does
             * compute an equal-share width capped at the three-wide one - but the
             * RENDERER DOES NOT CALL IT. profile_editor.js:2160-2161 is the whole rule:
             *
             *     const visualMode = steps.length <= 4 ? "fill" : "scroll";
             *     const visualColW = visualMode === "fill" ? 431 : 372;
             *
             * Four steps or fewer get 431. Five or more get 372 and the grid overflows
             * into the scrollport. Measured on the running skin: 431 at two steps, 372 at
             * five, and 192 for the rail in both. My formula produced 576 at two steps,
             * which is where Ben saw the steppers stretch.
             *
             * THE COUNT DECIDES THE WIDTH, and updated() writes it - the same place the
             * step count is written, from the same list. A CSS-only spelling would need a
             * container query on a count, which is not a thing. */
            grid-template-columns:
                var(--_ui-rail-w)
                repeat(var(--_ui-step-count), var(--_ui-step-w))
                minmax(0, 1fr);

            /* AND THE SLACK FALLS TO THE RIGHT, which is Slate's own note: "the grid's
             * fixed tracks pack to the start, so the slack falls to the RIGHT and steps
             * grow rightward as they are added - no centering". */
            justify-content: start;

            /* CONTENT-DERIVED ROWS WITH A MINIMUM, and never a literal list. Every row
             * is implicit: this file declares no grid-template-rows at all, so there
             * is nowhere for ten numbers to be written. */
            /* NINE ROWS AT THEIR OWN HEIGHT AND ONE THAT GROWS, and the two counts are
             * the ROW TABLE's, written on the host beside the step count. Not ten
             * literals: the exits row's INDEX is looked up, so a row added to the table
             * before or after it moves the split without touching this declaration. */
            grid-template-rows:
                repeat(var(--_ui-rows-before-exits), min-content)
                minmax(var(--_ui-exit-cell-min), 1fr)
                repeat(var(--_ui-rows-after-exits), min-content);

            /* The fallback while the first render has not written the counts, and for a
             * matrix mounted with no rows at all. */
            grid-auto-rows: minmax(min-content, auto);

            /* THE EXIT ROW TAKES THE SLACK, SO THE ACTION RAIL SITS AT THE BOTTOM.
             *
             * Ben, 25 August 2026: "The buttons on the bottom of the editor should be at
             * the bottom of the screen with a gap above, not below." Slate's renderer
             * asks for the same thing in the same words - "Exit-when (1fr - absorbs the
             * residual so the footer pins to the bottom and a full 5-chip step exactly
             * fills the height)".
             *
             * ONE ROW IS NAMED, NOT TEN. grid-template-rows would be the ten literals
             * this file refuses to write; grid-row: 9 / span 1 on the exits cells plus
             * a 1fr on that one implicit track is not expressible either. What IS
             * expressible is the row itself growing: the exits cells are given
             * align-self: stretch and the track a floor, and the residual reaches them
             * because the grid stretches. So the declaration that moves is
             * align-content, from start back to stretch, with the EXITS row the only one
             * whose cells can grow into it (.cell.exits below states the floor; every
             * other row is min-content and cannot).
             *
             * THIS IS ALSO WHAT CLOSED THE BAND, properly this time. align-self: start on
             * the host shrank the box so the leftover belonged to #steps; now the rows
             * fill the box, so there is no leftover to own. Slate's rows do the same by
             * arithmetic - its ten fixed heights sum to its container. */
            align-content: stretch;

            /* THE ANTI-E1 DECLARATION. stretch (the initial value) distributes spare
             * block size into the rows, which is what makes "the row tracks sum to
             * exactly the container height" true without anyone typing it. start keeps
             * every row at its own height, so a scrollbar stealing block size cannot
             * push a row out of a grid that had been sized to fit exactly.
             *
             * NOTHING declares justify-content: with 1fr columns there is never any
             * spare inline size to distribute, and a declaration that cannot change a
             * used value is E17's class (z-index on a static box). */
            /* SUPERSEDED 25 August 2026 by the exits-row rule below: start kept the rows
             * at their own heights AND left the residual under them, which is the band
             * Ben asked about. See align-content: stretch there. */

            /* BOTH AXES, STATED (§2.4, §4.3). Not hidden, not clip, and no
             * scrollbar-width: T16 is two nav columns hiding a live scrollbar and it
             * is banned. */
            overflow: auto;

            /* THE FLOOR (§2.4, M18): the matrix's own header row plus one step row, as
             * a token derived from rows this skin already has. Below it the matrix
             * overflows its cell VISIBLY rather than shrinking away — #steps declares
             * no overflow for exactly that reason. */
            min-block-size: var(--ui-editor-matrix-min-h);

            /* AS TALL AS ITS ROWS, AND NEVER TALLER THAN ITS CELL.
             *
             * Ben, 25 August 2026: "why is there an empty row at the bottom in
             * decal". It was not a row. THIS HOST PAINTS THE SEAM GROUND — the grid
             * paints --ui-line and each cell paints its own ground over it, so the only
             * ink that shows is the hairline gaps (CONVENTIONS §13). The host is a grid
             * item in #steps' one minmax(0, 1fr) row and STRETCHED to it, while
             * align-content: start keeps the rows at their own heights — so on any
             * screen taller than ten rows the leftover was seam ground with no cell over
             * it: measured 1079px of box against 1005px of rows, a 73px bar of
             * --ui-line across the full width. It reads as an eleventh, empty row.
             * Slate never shows it because its grid is its content's height.
             *
             * align-self: start IS THE WHOLE FIX and it changes nothing else. The rows
             * were already at their own heights; this only stops the BOX outrunning
             * them. E1's three declarations are untouched — both axes still scroll,
             * align-content is still start, and no block-size: 100% appears here.
             *
             * max-block-size: 100% IS THE OTHER HALF. Without it, start would let a
             * tall profile grow past its cell and scroll the page instead of the
             * matrix, which is the one thing §4.3 gives this component both axes to
             * prevent. The percentage resolves because the row it caps against is
             * definite. */
            /* THE HOST FILLS ITS CELL AGAIN. align-self: start shrank it so the leftover
             * belonged to #steps; since 25 August the EXITS row takes the residual
             * instead, so the rows fill the box and there is no leftover to own. That is
             * also what puts the action rail at the bottom. */

            /* NOTHING ON THE INLINE AXIS. The columns are 1fr, so the tracks always
             * fill the region and there is never uncovered seam ground beside them —
             * see the track list above for what a fixed column would cost. */

            /* NO min-inline-size: 0 HERE, deliberately. A grid item whose overflow is
             * not visible already has an automatic minimum size of zero, so the
             * declaration would change no used value — and a declaration that cannot
             * change a used value is E17's whole class. Measured: the matrix shrinks
             * below its own content width and scrolls, with nothing declared. */
        }

        /* C3, THE ONE RE-DECLARATION. One step down the space ladder for the rhythm;
         * the caps are the stepper's own named density, passed as a property below.
         * NOTHING here touches --ui-control-h or --ui-hit-min: "density multiplies
         * band heights and row gaps ONLY ... ergonomics is physical" (tokens.css). */
        /* COMPACT NOW MEANS THE SAME RHYTHM AS REGULAR, and that is a decision rather
         * than a leftover.
         *
         * Ben, 25 August 2026: "Slate uses more of the height by increasing the gap
         * between each row, looks like we could increase the each gap by 6-8px and it
         * would still work but we should check." --ui-space-2 to --ui-space-3 is 8 to 12,
         * which is 4 more above and 4 more below every row: 8 per row, the middle of the
         * range he asked for.
         *
         * TEN, NOT TWELVE, AND THE REASON IS THE EXIT BAND. Ben, 25 August 2026: "the
         * row gap ... needs to reduce from the new 12 to 10 or 11 as the gap between the
         * exit conditions haven't increased and don't look tight still." The band's own
         * slots are one --ui-space-2 apart and that number did not move with this one, so
         * at 12 the rows outside the band were spaced wider than the rows inside it and
         * the band read as cramped by comparison.
         *
         * THE MIDPOINT OF TWO SCALE STEPS, not a literal 10. The scale has 8 and 12 and
         * nothing between; the midpoint IS 10, and writing it as the midpoint keeps it
         * tied to the scale rather than floating beside it. */
        :host(.seam-grid[density="compact"]) {
            --_ui-matrix-rhythm: calc((var(--ui-space-2) + var(--ui-space-3)) / 2);
        }

        /* ===================================================================
         * ROWS ARE display: contents, WHICH IS WHAT LETS SEMANTICS AND LAYOUT
         * BOTH BE RIGHT  (E14, and H4 one screen over)
         * ===================================================================
         * role="table" requires rows that own their cells; the shared-track alignment
         * requires the cells to be grid items of ONE grid. display: contents on the
         * row element gives both: the element stays in the accessibility tree as a
         * row and its children become the grid's items.
         *
         * H4 is what the alternative looks like: "role=grid with NO ROWS - 28
         * children, 27 of them role-bearing, appended as direct children". */
        .row {
            display: contents;
        }

        /* AND THE TABLE ITSELF IS display: contents FOR THE SAME REASON (D05).
         *
         * role="table" sat on the HOST until 30 August 2026, which made every element
         * in this shadow root one of the table's children — including the add door, which
         * is not a row. The rows now have their own box to belong to and the door is that
         * box's sibling; display: contents keeps the cells grid items of the host grid,
         * exactly as it does one rule up, so not one used value moved. */
        .rows {
            display: contents;
        }

        /* ===================================================================
         * ONE CELL
         * ===================================================================
         * The ground is .seam-cell (--ui-fascia) from the utility: without a painted
         * cell there is no seam, only ground.
         *
         * padding-block is THE rhythm and the only thing density moves. padding-inline
         * is not rhythm and does not move with it — a narrower column is not a denser
         * one, and E15 is what happens when the inline numbers stop adding up. */
        .cell {
            display: flex;
            align-items: center;
            padding-block: var(--_ui-matrix-rhythm);
            padding-inline: var(--ui-space-3);

            /* NO INLINE FLOOR ON THE CELL ANY MORE, AND ITS ABSENCE IS THE FIX.
             *
             * Ben, 25 August 2026: "the vertical dividing lines are not showing, they are
             * only on the bottom button rows, not the full column."
             *
             * MEASURED: the gap between two step cells was MINUS 1.1px on every row but
             * the action rail. The cells were overlapping, and a cell lying over the 1px
             * column gap covers the only ink the seam has - the grid paints --ui-line and
             * the cells paint over it, so an overlapping cell erases the line rather than
             * leaving it.
             *
             * WHY THEY OVERLAPPED: this floor was the control's 350 plus 2 x 12 of inset,
             * which is 374 - and at five steps Slate's column is 372. Two pixels of
             * overflow per cell, every row.
             *
             * THE FLOOR BELONGED TO AN OLDER TRACK LIST. It was written when the step
             * track was minmax(auto, 1fr), where a cell's specified minimum is one of the
             * contributions the auto minimum takes the largest of. The track is a
             * constant now, so the floor cannot widen anything - it can only overflow.
             * The control keeps its own max-inline-size: 100%, which is what makes it
             * give way instead. */
        }

        /* THE THREE HORIZONTAL RULES, and only three. Slate paints its group seams as
         * inset shadows rather than borders (profile-editor-v3.css:333-338) because a
         * border would take layout space inside a fixed track; here the reason is
         * simpler — the seam utility rules COLUMNS in this grid (row-gap: 0, Slate's
         * measured 0px 1px), so a row seam is a paint on the cells that end a group.
         * The two groups are Slate's own: GRID_GROUP_END = {tempProbe, limiter}
         * (profile_editor.js:580), plus the head row's own rule. */
        .cell.group-end {
            box-shadow: inset 0 calc(-1 * var(--ui-seam)) 0 0 var(--ui-line);
        }

        /* THE GROUP RULE GETS AIR ON BOTH SIDES.
         *
         * Ben, 25 August 2026: "There is heavy horizontal lines showing the different
         * categories, these should have bigger margins above and below them. Ie between
         * Step and Temperature, Probe and Pump there should be a bigger gap with the
         * line going through them."
         *
         * SLATE DOES HALF OF THIS and its numbers are the basis: a group-end row is
         * rowCtrlGe: 77 against a plain rowCtrl: 68, and its own note says why —
         * "(6+15 pad + 55 control + 1 border)". Nine extra pixels, all BELOW the rule.
         * Ben asks for both sides, so the row above the rule and the row below it each
         * take the same step, and the rule sits in the middle of the gap rather than at
         * the top of it.
         *
         * ONE STEP ON THE SPACING SCALE, not a measured 9: --ui-space-3 is this
         * matrix's own rhythm, so a group gap is two of them where a plain row has one.
         * The classes are on the ROW so + can reach the row after it; the cells carry
         * group-end for the rule itself, which is a paint and not a box. */
        .row.group-end > .cell {
            padding-block-end: calc(2 * var(--_ui-matrix-rhythm));
        }

        /* EXCEPT THE HEAD ROW, WHICH KEEPS ITS RULE AND NOT THE EXTRA SPACE.
         *
         * Ben, 25 August 2026: "in the step row, seems there is too much margin below the
         * step style now." The head row is a group end, so it was taking the doubled
         * padding under the type line - a gap that reads as a hole because there is no
         * control under it, only the rule.
         *
         * SLATE DOES THE SAME. Its three rules are "above Temperature (the step header's
         * lower edge), below Probe, and below Limiter", and only the two CONTROL rows get
         * the taller box: rowCtrlGe is 77 against rowCtrl's 68, while the header is its
         * own 82 with even padding. The extra air belongs under a rule that has a control
         * above it. */
        .row.group-end > .cell.head {
            padding-block-end: var(--_ui-matrix-rhythm);
        }

        .row.group-end + .row > .cell {
            padding-block-start: calc(2 * var(--_ui-matrix-rhythm));
        }

        /* THE FILLER, AND IT IS ONE ELEMENT.
         *
         * The capped columns stop short of the region on a wide screen, and this host
         * paints the SEAM GROUND (CONVENTIONS 13: the grid paints --ui-line, the cells
         * paint over it, the 1px gaps are the only ink). The leftover had no cell over
         * it, so it read as a slab of divider colour - the same hole Slate records in
         * its own .pe-grid comment, "432px of flat --slate-line down the right quarter
         * of the screen ... which reads as a container that failed to paint".
         *
         * SLATE CLOSES IT WITH width: max-content ON THE GRID and lets the scroll
         * container behind show through. Measured here, that sized this box to 864px
         * against tracks of 1022 and clipped the last column: a scroll container's
         * intrinsic width does not include a sticky rail cell whose overflow is hidden.
         *
         * SO THE LEFTOVER IS COVERED INSTEAD OF THE BOX BEING SHRUNK, by one element in
         * the trailing 1fr track spanning every row. Not one filler cell per row: ten
         * presentational children inside ten role=row parents is ten things for a screen
         * reader to skip, and this is a paint. It sits OUTSIDE the table element (D05)
         * and carries aria-hidden, so the table's shape is exactly the rows and cells the
         * model declares. */
        .filler {
            grid-column: -2 / -1;
            grid-row: 1 / -1;
            background-color: var(--ui-fascia);
        }

        /* THE FILLER IS ALSO THE ADD DOOR, when the matrix is editable (F-033).
         *
         * Ben, 29 August 2026 (intent review, L0129): "a tap in the panel's empty step
         * area creates a new step there — including on a profile with no steps at all",
         * and the empty area "should carry a small plus icon". The audit measured three
         * guarded presses in that area, each resolving to THIS element, each changing
         * nothing: no plus was composed anywhere and no press handler existed.
         *
         * IT IS THE SAME ELEMENT AND NOT A NEW ONE, because the area a person aims at is
         * exactly the leftover this paint already covers. A second box floated over it
         * would be two hit targets for one gesture, and the one underneath would still be
         * the dead paint the audit pressed.
         *
         * IT IS OUTSIDE THE TABLE, NOT INSIDE IT (D05, Ben, 30 August 2026). The first
         * round shipped this as a button loose inside role="table" and said so; the strict
         * reading of that role takes rows and row groups as children and nothing else. The
         * rows now sit in their own role="table" element and this door is that element's
         * SIBLING — reachable, named, and in a legal slot, with the same box and the same
         * press. See #renderAdd for why a row/cell wrapper was not the shape chosen.
         *
         * NON-EDITABLE MATRICES ARE UNCHANGED: they keep the aria-hidden paint, because
         * a read-only matrix has nothing to add a step to. */
        button.filler {
            /* A button is not a div: reset the ground the UA gives it, and let the ONE
             * background-color declaration above stay the only one. */
            appearance: none;
            border: 0;
            margin: 0;
            padding: 0;
            font: inherit;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;

            /* A FLOOR, BECAUSE THE TRACK IT SITS IN HAS A MINIMUM OF ZERO.
             *
             * The trailing track is minmax(0, 1fr) — deliberately, so the fixed step
             * columns pack to the start and the slack falls right. When there is slack
             * this box stretches into all of it, which is the empty area a person aims
             * at. When the columns already fill the port, the track is 0px wide and this
             * box would be too: measured at 1281 wide with three 431px columns, exactly
             * 0px. A door that disappears once a profile has enough steps is not a fix,
             * so the item is floored at the hit minimum and overflows the zero track to
             * the right, where the matrix's own horizontal scroll reaches it. */
            min-inline-size: var(--ui-hit-min);
        }

        button.filler:focus-visible {
            ${focusRing}
            --_ui-focus-offset: var(--ui-focus-offset-inset);
        }

        /* THE ZERO-STEP FACE. With no rows there is no trailing track to sit in and no
         * row span to fill, so the door takes the whole grid and states a floor — the
         * same one the matrix itself is given. */
        button.filler.empty {
            grid-column: 1 / -1;
            grid-row: 1 / -1;
            min-block-size: var(--ui-editor-matrix-min-h);
        }

        .plus {
            display: block;
            flex: none;
            inline-size: var(--ui-icon);
            block-size: var(--ui-icon);
            color: var(--ui-steel);
        }

        /* THE STICKY RAIL. Slate's structural idea, kept: the rail is a cell of the
         * same grid AND stays put while the step columns scroll under it.
         *
         * z-index is on a POSITIONED element and is therefore consulted — E17's first
         * leftover is "z-index: 2 on a position: static element", and the suite proves
         * this one by scrolling the matrix and reading the rail's box back. */
        .cell.rail {
            position: sticky;
            inset-inline-start: 0;
            z-index: 1;

            /* THE RAIL'S FLOOR, and it is here rather than in the track list because
             * fit-content()'s own minimum is auto - the item's minimum contribution -
             * and because minmax() will not take fit-content() as a maximum (see the
             * track list). One declaration, read by the track that needs it, and it
             * outranks the step floor .cell states at (0,1,0). */
            min-inline-size: var(--_ui-rail-min);

            /* E19, both halves. The clip is what stops a longer translation of
             * "Max Duration" painting over the first data cell, and the ellipsis
             * below is what a clipped label should look like. */
            overflow: hidden;

            /* THE RAIL HAS ITS OWN GROUND, and it is the bar's (parity surface 4).
             * The rail is sticky and the step columns scroll UNDER it, so a rail on
             * the same fascia as the cells has nothing to separate it from what is
             * passing behind. Slate gives it the bar ground and this is Slate's own
             * value, exactly:
             *   ORACLE editor-steps .pe-grid-label [i=31,53,66,79,92,114,136,158,208]
             *          and .pe-grid-head-label [i=18] background-color =
             *          rgb(17, 22, 26) = #11161a = --ui-bar, on all ten, against
             *          .pe-grid-cell [i=32,...] rgb(14, 19, 23) = --ui-fascia.
             * (0,2,0) beats .seam-cell's (0,1,0), so source order does not decide it. */
            background-color: var(--ui-bar);
        }

        /* THE RAIL LABEL IS SLATE'S SMALL CAPS, AND DQ-4-A IS CLOSED (25 August 2026).
         *
         * WHAT THE DQ SAID: Slate sets the rail in small caps (.pe-grid-label 15px /
         * 500 / --ui-muted / uppercase / 1.35px, identical on all ten label cells) and
         * the role that draws exactly that is .ui-microcap - but at the caps the widest
         * label was 155px against a 136px content box, so it could not land without the
         * 192px rail, and the 192px rail costs the FLOOR geometry its fill regime.
         *
         * WHAT CLOSED IT WAS NOT A WIDTH. The 155px label was EXIT CONDITIONS, and that
         * was never Slate's word for the row: Slate reads "Exit when", measured on the
         * running skin. With the wording corrected in the row table the widest label is
         * MAX DURATION, and the actions row - the other long one - draws no label at
         * all, which is also Slate's. So the caps fit the 160px rail as it stands and
         * the fill regime is untouched. The DQ was a real question about a width; the
         * answer was that one of its inputs was wrong.
         *
         * THE ELLIPSIS STAYS. It is E19's other half and it is what a TRANSLATED label
         * does when it outgrows the rail; nothing above promises every language fits. */
        .rail-label {
            /* NO COLOUR HERE. .ui-microcap supplies --ui-muted, which IS the oracle's
             * value for these ten cells; a --ui-text-2 override at (0,1,0) would beat
             * the role's :where() and put back the one thing the caps were meant to
             * carry. */
            min-inline-size: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* ===================================================================
         * THE HEAD CELL — the step's ordinal over its name  (E7)
         * ===================================================================
         * E7 is "the step-name input clips its own descenders - 28.8px of line box in
         * a 28px box, ~31.7px on the tablet". Nothing here sizes the input from a type
         * measurement: #6 ui-text-field gives the input the field's whole content box
         * (--ui-control-h tall) and centres the line box inside it, so the shape E7
         * describes has nowhere to come from. The cell is a column with a gap, and the
         * cell's height is its content's — there is no track to clip against. */
        .cell.head {
            flex-direction: column;
            align-items: stretch;
            justify-content: center;

            /* SLATE'S 64, AND NO GAP.
             *
             * Ben, 25 August 2026: "Reduce of the row height, likely 64px will be right
             * with the number beside the name we could likely have more margin above and
             * below the text."
             *
             * ORACLE .pe-step-header: height 64px, gap 0, three flex-basis lines of 17,
             * 28 and 15. The number is BESIDE the name here rather than above it, so two
             * lines carry what Slate spends three on - 24 of name and 15 of mode, 39 in
             * a 64px box, and the 12 either side is the margin he asked for.
             *
             * --ui-control-h IS 64. Not a literal: it is the same token every control in
             * this grid is built on, so the header and the rows below it move together. */
            /* TALLER THAN SLATE'S 64, BECAUSE OUR TWO LINES ARE TALLER THAN ITS THREE.
             *
             * Ben, 25 August 2026: "Step row needs more height, Decal is clipping the
             * type text." He is right and the cause was the line box, not the cell: the
             * type had line-height 1 on a 15px font, which is the em box and not the
             * font's own ascent and descent - the caps sat right on the edges and the
             * cell's overflow took the rest.
             *
             * 64 + ONE STEP. The name is 24 at 1.2 (28.8) and the type is now 15 at 1.2
             * (18): 47 of text where Slate spends 60 across three lines. The extra step
             * is the margin he asked for above and below rather than more text. */
            /* A MINIMUM, NOT A HEIGHT, and the difference is this cell's own padding.
             * box-sizing is border-box everywhere (base.js), and the head row is a GROUP
             * END - so its padding is one rhythm above and two below, 36 in all. A fixed
             * 76 left 40 for 47 of text and clipped the type line, which is the very
             * thing this change was for. A minimum lets the cell be its text plus its
             * padding: 83, against Slate's 82. */
            min-block-size: calc(var(--ui-control-h) + var(--ui-space-3));
            gap: 0;
        }

        /* THE NAME LINE: the number, the name, and the pencil.
         *
         * Ben, 25 August 2026: "move the number from the top to the left of the step
         * name so it should be 1. PI, with it centered like the Slate. Add a little pen
         * edit icon that we use for the profile name on the far right so show its
         * editable."
         *
         * THREE COLUMNS AND THE PAIR IS IN THE MIDDLE ONE. Centring the name inside a
         * flex row that also holds the pencil would centre the PAIR, not the name - the
         * pencil would push it left by half its width. An empty first track the same
         * width as the pencil is what makes the middle track the cell's true centre,
         * which is where Slate's own title sits. */
        /* THE NAME LINE IS THE TEXT'S HEIGHT, AND THE PENCIL DOES NOT SET IT.
         *
         * The pencil keeps its 48px hit floor - that is not negotiable - but a 48px item
         * in the flow would make this line 48 and leave the header no margin at all:
         * 48 + 15 is 63 in a 64px box. Taking it OUT of the flow lets the line be the
         * text's own 24 and lets the hit area overlap the padding it sits in, which is
         * where the 12px either side of the text comes from.
         *
         * The reserved inline space stays: an equal inset each side is what keeps the
         * name centred on the CELL rather than on the space left over beside the
         * pencil. */
        /* THE NAME GETS THE STEPPER'S WIDTH, AND ONLY THE PENCIL IS RESERVED.
         *
         * Ben, 25 August 2026: "The title is not centering and has a large margin to the
         * left that is causing longer titles to clip, it should max to the stepper width,
         * ie align on the left edge of the stepper, before it start to clip."
         *
         * IT WAS INSET ON BOTH SIDES - 48 each - to keep the name centred on the cell
         * against the pencil's own 48. That cost 96 of the 350 the control has, so a name
         * ellipsised at 254 while the stepper below it ran the full width. Now only the
         * pencil's MARK is reserved, at the icon's own size rather than its hit box: the
         * name starts at the stepper's left edge and clips at 322 rather than 254.
         *
         * THE PENCIL KEEPS ITS 48px HIT AREA and simply overhangs into the cell's gutter,
         * which is transparent. The floor is not negotiable; what it does not have to do
         * is push text. */
        .head-line {
            position: relative;
            padding-inline-end: var(--ui-icon);
            min-inline-size: 0;
        }

        .head-line > .name,
        .head-line > .name-display {
            inline-size: 100%;
            min-inline-size: 0;
        }

        .head-line > .step-pen {
            position: absolute;
            inset-inline-end: 0;
            inset-block-start: 50%;
            transform: translateY(-50%);

            /* NO BOX, and the same mark: the profile title's pencil one band up is the
             * same control with the same two declarations. */
            --_ui-icon-btn-border: 0;
            --_ui-icon-btn-box: var(--ui-hit-min);
        }

        /* THE NAME AT REST IS A HEADING, which is decision 2's "match Slate": Slate sets
         * it as a title and swaps in an input only while it is being typed. The button
         * is the other half of Slate's pair - pressing the name opens the same edit the
         * pencil does (profile_editor.js:3255 binds both). */
        .name-display {
            border: 0;
            padding: 0;
            background-color: transparent;
            color: var(--ui-text);
            font: inherit;

            /* THE NAME IS A HEADING AND THE TYPE HAS TO SAY SO.
             *
             * Ben, 25 August 2026: "in the step title the Step name and the set type both
             * has the same size font. Whereas in slate they are different."
             *
             * MEASURED, AND HE IS RIGHT: ours were 16 and 15 - a pixel apart, which reads
             * as one size. Slate's are 24 and 14 (.pe-step-name against
             * .pe-step-summary), a ratio of 1.7.
             *
             * --ui-text-lg IS THE SCALE'S HEADING STEP and it is 20. Slate's 24 is not on
             * this scale, and the scale is the thing that keeps a heading here the same
             * size as a heading anywhere else in the skin. 20 against the mode's 15 is
             * the difference he asked for; 20 against Slate's 24 is the departure, and it
             * is the same one the mode line above states for the same reason. */
            /* SLATE'S 24 / 500 (Ben, 25 August 2026: "Step name - Use Slate, 24 / 500").
             *
             * ORACLE .pe-step-name: 24px at weight 500 against the step type's 14 at
             * 500 - the size carries the hierarchy and the weight is the same on both,
             * which is why Slate's pair reads as a title over a label rather than as two
             * emphasised words.
             *
             * A LITERAL, for the reason the unit's 14 is one: the type scale has 20 and
             * 27 and nothing between. Two numbers now come from Slate rather than from
             * the scale, and both are in the same lockup - the step header - which is at
             * least one honest place rather than two scattered ones. */
            font-size: 24px;
            line-height: 1.2;
            font-weight: var(--ui-weight-medium);
            text-align: center;
            cursor: pointer;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* THE NUMBER, now INSIDE the name line rather than a line of its own. It reads
         * as a label on the name and not as a second word: one step down in weight and
         * colour, with the full stop and the space Ben asked for. ONE rule - a second
         * .ordinal block at the same condition is P9, and the scan catches it. */
        .ordinal {
            color: var(--ui-text-2);
            font-weight: var(--ui-weight-regular);
            margin-inline-end: var(--ui-space-1);

            /* THREE QUARTERS OF THE TITLE (Ben, 25 August 2026: "The step number needs
             * to be smaller, maybe around 75% of the title size"). An em and not a
             * token: it is a RATIO to whatever the name is set at, so the two move
             * together if the name ever does. 0.75 of 24 is 18, which is also the step
             * between the name and the type. */
            font-size: 0.75em;
        }

        /* THE MODE LINE, tinted by the pump the column is in. The four tones are the
         * chart's own channel tokens where a channel exists for the mode, which is what
         * keeps a Flow column blue on this screen and on every plot in the app; POWER
         * and LEVER have no trace of their own, so they take the two the rest of the
         * editor already gives them.
         *
         * CENTRED AND UNDER THE NAME, which is Slate's order: number, name, mode. */
        .mode {
            /* SLATE'S TYPE FOR THE STEP TYPE (Ben, 25 August 2026: "use the same font
             * size and weight and color for the step type etc. Same distance between the
             * title and the step type").
             *
             * ORACLE .pe-step-summary: 14px, weight 500, line-height 15px, letter-spacing
             * 0.06em, uppercase, centred, and the colour is the per-tone one below.
             *
             * WHAT .ui-microcap GAVE was 15/600/.12em at line-height 1.2, which is a
             * third taller and twice the tracking - the two things that made this line
             * take space the header did not have. The role stays for the transform and
             * the family; these four override it.
             *
             * THE SIZE IS A TOKEN AND IT IS 15, NOT 14. The type scale has 12 and 15 and
             * nothing between; a 14px literal here would be the first number in this
             * sheet that belongs to no step of it. One pixel, stated rather than smuggled.
             *
             * THE TRACKING IS HALF THE CAP TOKEN, which is 0.06em exactly - Slate's own
             * value, written as the relationship rather than as a second constant.
             *
             * THE DISTANCE FROM THE NAME IS ZERO, which is Slate's gap: the 15px line box
             * sits directly under the name's. */
            font-size: var(--ui-text-sm);
            font-weight: var(--ui-weight-medium);
            letter-spacing: calc(var(--ui-tracking-cap) / 2);

            /* A RATIO, NOT 1. Slate states 15px on a 14px font - a ratio of 1.07, which
             * is enough for its own metrics. Ours at exactly 1 was the em box, and Geist
             * draws its caps taller than that: the type clipped top and bottom. 1.2 is
             * the same ratio the name above it uses, so the two lines stack on one
             * rhythm. */
            line-height: 1.2;
            text-align: center;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .mode[data-tone="flow"] { color: var(--ui-channel-flow); }
        .mode[data-tone="pressure"] { color: var(--ui-channel-pressure); }
        .mode[data-tone="power"] { color: var(--ui-channel-power); }

        /* LEVER TAKES THE TINT TOKEN, NOT A CHANNEL. There is no --ui-channel-lever
         * because a lever step draws no trace of its own; --ui-tint-lever IS the
         * oracle's lever purple (tokens.css:1403 / :1507, both themes, carried from
         * slate --slate-lever #7046b5). Inventing a channel token for a channel that
         * does not exist would be the second table this file keeps avoiding. */
        .mode[data-tone="lever"] { color: var(--ui-tint-lever); }


        /* ===================================================================
         * THE VALUE'S INK IS ITS CHANNEL'S  (parity surface 4)
         * ===================================================================
         * Slate paints a matrix value in the colour of the channel it belongs to and
         * leaves the ones that belong to none — a duration, a power target — plain.
         * The oracle lines, the target-vs-limit distinction and the derivation that
         * decides which cell gets which are all in src/lib/step-matrix-rows.js
         * (matrixChannel); this sheet only turns a NAME into an ink, which is
         * src/screens/live-screen.js's arrangement for the rail, one screen over.
         *
         * --_ui-stepper-number-ink is #4's own declared seam and a cell that names no
         * channel sets nothing, so its number keeps the cell's ink. Deliberately a
         * rule and not a style attribute: bug L11 is "inline wins".
         *
         * NO BACKTICK APPEARS IN THIS COMMENT and that is not style: this block lives
         * inside a tagged css template literal, so one would END the template and the
         * file would parse as prose. (Caught here by 66 red render tests — the same
         * trap parity surface 2 hit twice.)
         * =================================================================== */
        ui-stepper[data-channel="temperature"] {
            --_ui-stepper-number-ink: var(--ui-channel-target-group-temperature);
        }

        ui-stepper[data-channel="flow"] {
            --_ui-stepper-number-ink: var(--ui-channel-target-flow);
        }

        ui-stepper[data-channel="pressure"] {
            --_ui-stepper-number-ink: var(--ui-channel-target-pressure);
        }

        ui-stepper[data-channel="flow-limit"] {
            --_ui-stepper-number-ink: var(--ui-channel-flow);
        }

        ui-stepper[data-channel="pressure-limit"] {
            --_ui-stepper-number-ink: var(--ui-channel-pressure);
        }

        /* EVERY CONTROL IS ONE WIDTH, AND IT DOES NOT GROW WITH THE COLUMN.
         *
         * Ben, 25 August 2026, on the steppers: "Copy slate". Slate's
         * --pe-control-width is 346px at two steps and 346px at five - the control is
         * pinned and the column breathes around it. Ours filled the cell, so a two-step
         * profile drew a 552px stepper against Slate's 346.
         *
         * SUPERSEDES "every control fills its cell; the container owns the inline size"
         * (2.3, and #43's DEPARTURE 1). The container still owns it - it just says one
         * number now instead of "all of me". CENTRED, because the air is on both sides
         * rather than absent. */
        /* THE BANK'S CHIPS TAKE SLATE'S TYPE AND INSET, and it is a fit problem rather
         * than a taste one.
         *
         * Ben, 25 August 2026: "The PUMP row, pressure is being clipped with Press...
         * this didn't happen on slate." At five steps four chips share the control, so
         * each is about 87. Ours spent 8 either side at 17px, leaving 71 for the word;
         * Slate spends 5 either side at 16px, leaving 76. Measured on the running skin:
         * .pe-segmented button, 86.8 wide, padding 0 5px, font-size 16.
         *
         * #3 EXPOSES BOTH. The inset is its own private; the type comes through the part
         * it now exports. Neither is a rule this file could otherwise reach. */
        /* ONE RULE FOR THE BANK, not two at the same condition (P9). The width block
         * below covers every other control in a cell; the bank carries its own copy here
         * so that its inset and its width are one declaration rather than the same
         * selector written twice. */
        .cell > ui-bank {
            --_ui-item-inset: 5px;
            inline-size: var(--_ui-step-ctrl-w);
            max-inline-size: 100%;
            margin-inline: auto;
            min-inline-size: 0;
        }

        .cell > ui-bank::part(item) {
            font-size: 16px;
        }

        /* NO ui-text-field HERE. The only text field this matrix draws is the step NAME,
         * and it is a child of .head-line rather than of the cell — so a .cell > child
         * selector could never match it, and E4's own guard had been failing on that one
         * line. The name takes its width from the .head-line rule below, which does match.
         * NO BACKTICK IN THIS COMMENT: one ends the css template. */
        .cell > ui-stepper,
        .cell > ui-locked-value,
        .cell > ui-action-key-rail,
        .cell > .exit-group,
        .cell.head > .head-line {
            inline-size: var(--_ui-step-ctrl-w);
            max-inline-size: 100%;
            margin-inline: auto;
            min-inline-size: 0;
        }

        /* ===================================================================
         * THE EXIT BAND'S CELL  (E16, Appendix 9)
         * ===================================================================
         * E16: "the exit band can OVERFLOW ITS FIXED 280px TRACK: a dead-exit note is
         * appended as an uncapped wrapping <p> into the chip list, and neither the cell
         * nor .pe-exit-cell sets overflow, so the excess spills symmetrically into the
         * rows above and below."
         *
         * Two declarations answer it, and they are the same two Appendix 9 asks for:
         * the cell's block size IS the three stable slots (so adding or removing an
         * exit condition cannot reflow the matrix's rows), and #41's own band scrolls
         * inside it (its .band already declares overflow-y: auto with a floor). The
         * note is then contained by a region that scrolls and shows it — never
         * clipped, never spilled.
         *
         * A definite block size is what makes the band's own 100% resolvable; without
         * it the band grows and the note takes the row with it. */
        .cell.exits {
            /* The three slots are the CONTENT box, so the cell's own rhythm is added
             * on top of them rather than taken out of them — box-sizing is border-box
             * everywhere (base.js), and a band given 192px of room for 208px of slots
             * would scroll while showing exactly what it was built to show.
             *
             * A MINIMUM SINCE 25 AUGUST 2026, NOT A HEIGHT. This is the row that takes
             * the grid's residual so the action rail sits at the bottom, and a definite
             * block-size is exactly what stops a cell growing with its track. The floor
             * is unchanged; what is new is that it may be exceeded.
             *
             * THE SAME NUMBER THE TRACK ASKS FOR, and it is one declaration now rather
             * than the same arithmetic written out here and a shorter version written in
             * grid-template-rows. */
            min-block-size: var(--_ui-exit-cell-min);
            block-size: 100%;
            align-items: stretch;
        }

        /* The band's own box, and the per-step accessible context its controls sit in
         * (see the render section). display: flex so the compound stretches to the
         * cell's definite height rather than to its own content. */
        .exit-group {
            display: flex;
        }

        .cell.exits ui-exit-sentence {
            flex: 1 1 auto;
            min-inline-size: 0;
            block-size: 100%;
        }

        /* ===================================================================
         * THE ACTION ROW'S CELL, AND THE ONE PLACE THE COLUMN LISTENS TO ITS
         * CONTENT  (E15, C7)
         * ===================================================================
         * The rail is the widest control in the grid and it is sized BY ITS KEYS -
         * #42's own words: "a rank of touch targets is spec §2.2's fixed token, never
         * fluid: a wider editor column wants the same five keys, not five wider ones,
         * and a narrower one must not shave them". So this is the cell that must be
         * allowed to raise its column above the design floor, and it says so by
         * dropping the floor and letting its content speak.
         *
         * AND THE CONTAINMENT HAS TO COME OFF FOR THE GRID TO HEAR IT. base.js gives
         * every UiElement container-type: inline-size, which is inline-size
         * CONTAINMENT: the host's intrinsic size may not depend on its contents, so
         * the rank inside resolves to 0 for anything measuring from outside. #42
         * documents the same fact from the inside ("the rail is INSIDE the
         * containment, so max-content works here and cannot work on :host") and #4
         * hit it first. Turning it off for THIS placement costs nothing - #42 declares
         * no @container rule at all, so nothing inside it reads the container it
         * stops being - and it is what carries the rank out to the track that has to
         * hold it. Without it the rail overflows its cell by a measured 88px.
         *
         * The alternative was a number: five keys times a control height, typed here,
         * which is both a copy of another component's internals AND wrong (the keys
         * are 74 wide, not 64, because #1's own padding decides a key). That is E15
         * with the numbers re-typed rather than connected. */
        .cell.actions {
            min-inline-size: auto;
        }

        .cell.actions ui-action-key-rail {
            container-type: normal;
        }
    `];

    #i18n = new I18nController(this);

    constructor() {
        super();
        this.steps = null;
        this.ranges = null;
        this.density = 'compact';
        this.label = 'Profile steps';
        this.powerExitOffered = false;
        this.holdOffered = false;
        this.pumpModesOffered = false;
        this.editable = false;
        this._editing = null;
    }

    /**
     * The seam classes go on the HOST, not in the constructor — a custom element
     * constructor must not gain attributes (CONVENTIONS §13 (b)).
     *
     * THE TABLE ROLE IS NOT HERE ANY MORE, and that is the D05 fix (Ben, 30 August 2026).
     * It used to be, on the stated grounds that the host IS the grid and "a role on a
     * wrapper the rows do not belong to is H4's defect" — but H4's defect is a role on a
     * box the rows are NOT inside, and `render()`'s wrapper is a box they ARE inside. What
     * the host cannot be is a table that also contains the add door, because the door is
     * not a row: everything in this shadow root is a child of the host, so a table role
     * here makes every sibling of the rows an illegal child of a table.
     *
     * The wrapper is `display: contents`, so the cells stay grid items of THIS grid — the
     * same construction, and the same reason, as `.row`. One box, one owner: unchanged.
     */
    connectedCallback() {
        super.connectedCallback();
        this.classList.add('seam-grid', 'seam-cols', 'seam-line');
    }

    /** The steps, as an array, without inventing one. */
    get #list() {
        return Array.isArray(this.steps) ? this.steps : [];
    }

    /** The step list this element last rendered, so a change can be READ rather than
     *  assumed. See `willUpdate` — it is the only thing this is for. */
    #renderedSteps = [];

    /**
     * A NAME FIELD MAY NOT SURVIVE THE STEP MOVING OUT FROM UNDER IT.
     *
     * `_editing` is an INDEX (see its declaration: "The index and not a boolean, because
     * two columns must not both be open"), and an index is only a name for as long as the
     * list holds still. Once the action rail could reorder, insert into and delete from the
     * list — 27 August 2026 — it stopped holding still: open step 3's name field, delete
     * step 1, and `_editing` still says 2 while column 2 is now a completely different
     * step. The person would be typing into the wrong profile step, with the field showing
     * the wrong starting text, and nothing on screen would say so.
     *
     * THE TEST IS OBJECT IDENTITY, NOT LENGTH, and that is what makes it precise. Every
     * edit in this tree is immutable (`editor-draft.js`: "Every function returns a NEW
     * profile with new step objects ON THE PATH THAT CHANGED"), so a value edit to some
     * OTHER step leaves the edited step's object untouched and the field stays open —
     * which is what a person typing a name while a preview re-derives needs. A structural
     * action moves objects between slots, so the object at `_editing` is a different one
     * and the field closes. A length test would miss both moves; a "steps changed at all"
     * test would close the field on every unrelated keystroke elsewhere.
     *
     * CLOSING IS THE RIGHT ANSWER RATHER THAN FOLLOWING THE STEP, because the name field
     * commits on `change` and on `blur` and the press that reordered the list blurred it
     * first — so the person's typing is already in the draft by the time this runs. What
     * is left to decide is only where an EMPTY field should be, and the answer is nowhere.
     */
    willUpdate(changed) {
        super.willUpdate?.(changed);
        if (!changed.has('steps')) return;
        const before = this.#renderedSteps;
        const after = this.#list;
        this.#renderedSteps = after;
        if (this._editing === null) return;
        if (after[this._editing] !== before[this._editing]) this._editing = null;
    }

    /**
     * PUT THE CARET BACK ON A KEY, by step index and action id. Returns whether it landed.
     *
     * THIS IS THE OTHER HALF OF A STRUCTURAL EDIT and it belongs here, not in the screen.
     * The rails live in THIS shadow root, and CONVENTIONS' first rule is that a screen
     * cannot reach into a component's internals — so the screen asks, in the vocabulary it
     * already speaks (a step index and one of the rail's five action ids), and this element
     * does the reaching. `ui-action-key-rail.js` already exposes `keyElement(action)` for
     * exactly this, described in its own file as "what a test and a screen focus".
     *
     * WHY IT IS NEEDED AT ALL: pressing move-right re-renders the matrix with the step in a
     * new column, and Lit reuses the DOM — so the button under the finger now belongs to
     * the step that was displaced. Without this, a second press moves the WRONG step, and
     * after a delete the caret falls all the way out to <body>. With it, the caret rides
     * with the step and a second press does the same thing to the same step.
     *
     * IT REFUSES SILENTLY AND ON PURPOSE (returns false): a key that is now disabled — the
     * step reached the end, or a delete left one step and delete went grey — must NOT be
     * focused, because focusing a disabled control is how a caret disappears without
     * leaving a trace. The caller has nothing to recover from; the caret simply stays.
     */
    focusStepKey(index, action) {
        const cell = this.renderRoot?.querySelector?.(`[data-cell="actions-${index}"]`);
        const rail = cell?.querySelector?.('ui-action-key-rail') ?? null;
        const key = rail?.keyElement?.(action) ?? null;
        if (!key || key.disabled) return false;
        key.focus();
        return true;
    }

    /**
     * THE ONE VALUE THAT CROSSES FROM JS TO CSS, and it is a count of CONTENT rather
     * than a measurement of a box. Written on the host because the host is the grid;
     * Lit cannot style its own host from render(), and an inner wrapper to hold the
     * style would be the second box this component exists without.
     */
    updated(changed) {
        super.updated?.(changed);
        const count = this.#list.length;
        if (count > 0) this.style.setProperty('--_ui-step-count', String(count));
        else this.style.removeProperty('--_ui-step-count');

        /* THE ROW SPLIT, so the exits row can be the one that grows and the action rail
         * sits at the bottom (Ben, 25 August 2026). Read off the table rather than
         * counted by hand: a row inserted either side of `exits` moves this and nothing
         * else. `-1` never happens — `exits` is in the table — but a missing row would
         * otherwise write a negative repeat() and invalidate the whole track list. */
        /* SLATE'S TWO COLUMN WIDTHS, PICKED BY THE COUNT. Its own rule, verbatim:
         * `steps.length <= 4 ? 431 : 372`. Written here rather than in the sheet because
         * CSS cannot branch on a number. */
        this.style.setProperty('--_ui-step-w',
            count <= SLATE_FILL_MAX_STEPS
                ? 'var(--_ui-step-w-fill)'
                : 'var(--_ui-step-w-scroll)');

        const exitsAt = STEP_MATRIX_ROW_KEYS.indexOf('exits');
        if (exitsAt >= 0) {
            this.style.setProperty('--_ui-rows-before-exits', String(exitsAt));
            this.style.setProperty('--_ui-rows-after-exits',
                String(STEP_MATRIX_ROW_KEYS.length - exitsAt - 1));
        }

        /* THE TABLE'S OWN NAME IS NO LONGER WRITTEN HERE. It moved with the table role
         * (D05) onto the element `render()` gives that role, where it is a bound
         * attribute rather than a hand-written one. It is still a translated VALUE and
         * not an IDREF: aria-labelledby cannot cross a shadow boundary, which is the
         * fact #32 is shaped around ("the panel is NAMED, not pointed at"). Naming the
         * host as well would announce the same string twice, once on a generic box. */
    }

    /* ---------------------------------------------------------------------
     * Ranges — through the door, or refused
     * ------------------------------------------------------------------- */

    /**
     * The one range entry for one cell, or the door's own refusal.
     *
     * A7, and editor-ranges.js's own instruction: "Absence is the R2 door's real
     * answer - render the control unavailable. Never stand a plausible band in for
     * it." So a refusal is carried as a REASON and rendered as a disabled control,
     * never swallowed and never replaced with a number.
     *
     * THE REASON IS DEVELOPER PROSE AND IT DOES NOT GO ON SCREEN. The door's messages
     * are English sentences written for whoever mis-wired the mount, and a tooltip is
     * not the place for them (D2: every readable string is a translated value). The
     * visible word is t('Unavailable'); the reason rides on data-refusal, where the
     * suite reads it and a console does too.
     */
    #rangeFor(field, ctx) {
        if (!field) return { range: null, refusal: null };
        if (!this.ranges) {
            return {
                range: null,
                refusal: 'no ranges door was handed to <step-matrix>, so no control in it '
                    + 'has bounds. Inject createEditorRanges({machineLimits}).',
            };
        }
        try {
            return { range: this.ranges.rangeFor(field, ctx), refusal: null };
        } catch (error) {
            return { range: null, refusal: error?.message ?? String(error) };
        }
    }

    /* ---------------------------------------------------------------------
     * Events out — the draft is the screen's
     * ------------------------------------------------------------------- */

    #emit(type, detail) {
        this.dispatchEvent(new CustomEvent(type, {
            detail,
            bubbles: true,
            composed: true,
        }));
    }

    /**
     * #4 and #3 both dispatch a composed `change`. It is stopped here and re-emitted
     * as `step-change` WITH ITS COORDINATES, because a screen holding a draft needs to
     * know which step and which key moved — and because a bare `change` crossing this
     * boundary would collide with every other `change` on the screen.
     */
    #onCellChange(event, row, step, index) {
        event.stopPropagation();
        const field = fieldFor(row, step);
        if (!field) return;
        this.#emit(STEP_CHANGE, {
            index,
            row: row.key,
            field,
            value: event.detail?.value,
            previous: readValue(row, step),
        });
    }

    /**
     * #4's `edit` — the value cell was pressed. Re-emitted with the coordinates AND
     * the range, because whoever opens the numpad takes its limits as DATA and this
     * matrix already resolved them through the one door.
     */
    #onCellEdit(event, row, step, index, range) {
        event.stopPropagation();
        const field = fieldFor(row, step);
        if (!field) return;
        this.#emit(STEP_EDIT, {
            index,
            row: row.key,
            field,
            value: event.detail?.value,
            range,
        });
    }

    /* ---------------------------------------------------------------------
     * Render
     * ------------------------------------------------------------------- */

    /**
     * A matrix with no steps renders NOTHING BUT THE WAY BACK — audit F-033.
     *
     * This used to return `nothing`, on the stated grounds that "a profile with zero steps
     * is not an editing surface, and 'never delete the last step' is the draft owner's rule
     * to keep, not a shape for this file to guess at". The draft owner DID take that rule
     * (`editor-draft.js` rule 1 refuses the last delete), and it is still the right rule —
     * but it only stops a person deleting their way into the dead end. A profile that
     * ARRIVES with no steps was still stuck, because with no columns there is no action
     * rail and therefore no "Insert step after" key anywhere on the glass. Ben met exactly
     * that on 27 August ("there is not + button to add a new step etc, ie I cannot add any
     * steps") and named the fix on 29 August when he corrected L0129's intent: a tap in the
     * empty step area creates a step, "including on a profile with no steps at all".
     *
     * It is still not an invented empty state and still not a phantom column: it is one
     * button, and its only outcome is to make the matrix drawable.
     */
    render() {
        const steps = this.#list;
        /* NO ROWS, NO TABLE. `role="table"` requires row children, so a table element
         * with nothing in it is not a shape a screen reader can be given — which is
         * what the host was when this returned `nothing` (an empty role="table", every
         * time a profile arrived with no steps). Now there is either a table with its
         * rows in it, or no table at all. */
        if (!steps.length) return this.editable ? this.#renderAdd(0) : nothing;
        /* THE DOOR IS THE TABLE'S SIBLING, NOT ITS CHILD — see #renderAdd. Read-only it
         * is the paint it always was, carrying no role and aria-hidden; editable it is
         * that same paint wearing the add door. Either way the table a screen reader
         * walks is exactly the ten rows the model declares, and nothing else. */
        return html`<div class="rows" role="table" aria-label=${this.#tableName || nothing}
        >${STEP_MATRIX_ROWS.map((row) => this.#renderRow(row, steps))}</div>${
            this.#renderAdd(steps.length)}`;
    }

    /** The table's translated accessible name, or '' when the caller cleared `label`. */
    get #tableName() {
        return this.label ? this.#i18n.t(this.label) : '';
    }

    /**
     * THE EMPTY AREA, AND WHAT IT IS FOR (F-033).
     *
     * Read-only: the paint it always was. Editable: the same box, pressable, carrying the
     * small plus Ben asked for and a real accessible name.
     *
     * IT IS THE TABLE'S SIBLING AND NOT ONE OF ITS CHILDREN — Ben, 30 August 2026, on the
     * first round's stated departure ("a button loose inside role=table"). The strict
     * reading of the table role takes ROWS and row groups as children and nothing else, so
     * a control sitting among them is a shape no screen reader is promised. The rows now
     * live inside their own `role="table"` element (see `render()`), and this door is that
     * element's SIBLING inside the same grid — which is also the honest description of what
     * it does: it does not belong to a row, and it adds a COLUMN rather than a row, so a
     * row/cell wrapper would announce it as a table position it does not occupy.
     *
     * NOTHING ABOUT THE PRESS OR THE BOX MOVED. It is still the same element the audit's
     * three guarded presses resolved to, still floored at the hit minimum against the
     * trailing track's zero minimum, and still the whole grid on a zero-step profile.
     *
     * THE PRESS EMITS `step-action`, THE KEY RAIL'S OWN EVENT, and that is the whole
     * design. `editor-screen.js #onStepAction` already listens for it on the host and
     * routes it through `editor-draft.js applyStepAction`, which owns every rule about what
     * a structural edit MEANS — the preinfusion marker, the leading HOLD, where the caret
     * lands. A second event, or a write from this file, would be a second owner of one
     * gesture; the matrix announces and the screen decides, which is the contract this
     * file's own header states.
     *
     * THE INDEX IS `count - 1` — "after the last step", which is where the next column
     * would draw, which is where the person pressed. On a zero-step profile that is **−1**,
     * and `applyStepAction` takes it for `insert-after` alone: the gap before the first
     * step is a real place and `at = index + 1` needs no second branch for it.
     *
     * THE GLYPH IS SLATE'S OWN INSERT PATH, and it is the artwork rather than a font
     * character for the reason `ui-action-key-rail.js` gives at GLYPHS: the geometry is
     * intrinsic to the icon. The two are the same mark on purpose — this door and the "+"
     * key under a column do the same thing.
     */
    #renderAdd(count) {
        if (!this.editable) return html`<div class="filler" aria-hidden="true"></div>`;
        const t = this.#i18n.t;
        return html`<button
            id="add-step"
            type="button"
            class=${count === 0 ? 'filler add empty' : 'filler add'}
            aria-label=${t(ADD_STEP_KEY)}
            @click=${() => this.#emit(STEP_ACTION, {
                action: 'insert-after', index: count - 1, count,
            })}
        ><svg
            class="plus"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >${svg`<path d="M12 5v14M5 12h14"/>`}</svg></button>`;
    }

    #renderRow(row, steps) {
        const t = this.#i18n.t;
        const head = row.key === 'head';
        const group = row.groupEnd ? ' group-end' : '';
        return html`
            <div class="row${group}" role="row" data-row=${row.key}>
                <div
                    class="cell rail seam-cell${group}"
                    role=${head ? 'columnheader' : 'rowheader'}
                    data-rail=${row.key}
                ><span
                    class=${row.railHidden ? 'rail-label ui-microcap a11y' : 'rail-label ui-microcap'}
                >${t(row.label)}</span></div>
                ${steps.map((step, index) => html`
                    <div
                        class="cell seam-cell ${row.key}${group}"
                        role=${head ? 'columnheader' : 'cell'}
                        data-cell=${`${row.key}-${index}`}
                    >${this.#renderCell(row, step, index, steps.length)}</div>
                `)}
            </div>
        `;
    }

    /** The translated, per-cell accessible name (E14, D2). */
    #cellName(row, index) {
        return this.#i18n.t(CELL_NAME_KEY, { label: this.#i18n.t(row.label), n: index + 1 });
    }

    #renderCell(row, step, index, total) {
        switch (cellKindFor(row, step)) {
            case 'head': return this.#renderHead(step, index, total);
            case 'stepper': return this.#renderStepper(row, step, index);
            case 'locked': return this.#renderLocked(row, index);
            case 'bank': return this.#renderBank(row, step, index);
            case 'exits': return this.#renderExits(row, step, index);
            case 'actions': return this.#renderActions(row, step, index, total);
            default: return nothing;
        }
    }

    /**
     * THE HEAD CELL: the ordinal, the name, the mode. Slate's three lines, measured on
     * the running skin 25 August 2026:
     *
     *   <div class="pe-step-header">
     *     <span class="pe-step-num">01</span>
     *     <input class="pe-step-name" aria-label="Step 1 name">
     *     <span class="pe-step-summary" data-tone="flow">Flow</span>
     *   </div>
     *
     * TWO THINGS CHANGED HERE AND BOTH ARE THAT MEASUREMENT. The ordinal DREW the whole
     * sentence "Step 1 of 2" where Slate draws "01"; and there was no third line at
     * all, so the column said nothing about the mode its cells were coloured for.
     *
     * THE SENTENCE IS NOT LOST, IT IS SPOKEN. The table's key is still read, still with
     * both placeholders — the placeholder rule, so a word-order change survives
     * translation — and it goes into a visually-hidden span. A reader who lands on the
     * column header hears "Step 1 of 2"; a reader who looks at it sees the number, which
     * is the only thing that fits above a name field.
     *
     * THE MODE LINE IS DRAWN, NEVER DERIVED. `PUMP_MODE_LABEL` is the one mode table's
     * own word, and `data-tone` carries the pump key so the tint is a stylesheet's
     * decision rather than a colour chosen in a template.
     *
     * THE NULL BRANCH IS DEFENSIVE AND THE SUITE CANNOT REACH IT, which is worth
     * writing down rather than leaving as an untested line: a step whose pump this
     * build does not know never arrives here, because `fieldFor` throws on it three
     * cells earlier (`getModeConfig`, A7 — "foreign JSON is coerced by
     * normalizeImportedStep at the import boundary"). The branch stays because an
     * invented mode word over cells ranged for a different mode is the failure A7
     * exists to stop, and because this cell must not be the one place that re-decides
     * what the mode table already refuses.
     */
    #renderHead(step, index, total) {
        const t = this.#i18n.t;
        const pump = step?.pump;
        const mode = pump && PUMP_MODE_LABEL[pump] ? PUMP_MODE_LABEL[pump] : null;
        const name = step?.name ?? '';
        const editing = this._editing === index;
        const spoken = t(STEP_NAME_KEY, { n: index + 1 });

        const commit = (event) => {
            event.stopPropagation();
            this._editing = null;
            const value = event.target?.value ?? '';
            if (value === name) return;
            this.#emit(STEP_CHANGE, { index, row: 'head', field: 'name', value, previous: name });
        };

        return html`
            <div class="head-line">
                <span class="a11y">${t(STEP_ORDINAL_KEY, { n: index + 1, total })}</span>
                ${editing
                    ? html`<ui-text-field
                        class="name"
                        hide-label
                        label=${spoken}
                        .value=${name}
                        @change=${commit}
                        @blur=${commit}
                    ></ui-text-field>`
                    : html`<button
                        class="name-display ui-heading"
                        type="button"
                        title=${spoken}
                        @click=${() => { this._editing = index; }}
                    ><span class="ordinal" aria-hidden="true">${index + 1}.</span
                    >${name}</button>`}
                <ui-icon-button
                    class="step-pen"
                    label=${spoken}
                    @click=${() => { this._editing = index; }}
                >${penIcon()}</ui-icon-button>
            </div>
            ${mode
                ? html`<span
                    class="mode ui-microcap"
                    data-tone=${pump}
                    >${t(mode)}</span
                >`
                : nothing}
        `;
    }

    /**
     * A STEPPER CELL. min/max/step and the unit arrive AS DATA from the one door and
     * are handed straight on: this file neither reads them nor rounds them.
     *
     * A refused field renders the same control DISABLED — which reads as UNAVAILABLE
     * rather than as unbounded, and is the door's own instruction. The visible word is
     * a translated value; the door's developer-facing reason rides on data-refusal.
     */
    #renderStepper(row, step, index) {
        const { range, refusal } = this.#rangeFor(row.rangeField, {
            pump: step?.pump ?? null,
        });
        const value = readValue(row, step);
        return html`<ui-stepper
            density=${this.density}
            data-channel=${matrixChannel(row, step) ?? nothing}
            label=${this.#cellName(row, index)}
            title=${refusal ? this.#i18n.t('Unavailable') : nothing}
            data-refusal=${refusal || nothing}
            ?disabled=${Boolean(refusal)}
            ?editable=${this.editable && !refusal}
            .value=${Number.isFinite(value) ? value : 0}
            .min=${range ? range.min : null}
            .max=${range ? range.max : null}
            .step=${range ? range.step : null}
            unit=${row.unit ?? range?.unit ?? nothing}
            note=${this.#stepperNote(row, step)}
            .format=${row.zeroLabel ? this.#zeroLabelFormat(row, range) : null}
            ?off=${Boolean(row.zeroLabel) && !(Number(value) > 0)}
            @change=${(event) => this.#onCellChange(event, row, step, index)}
            @edit=${(event) => this.#onCellEdit(event, row, step, index, range)}
        ></ui-stepper>`;
    }

    /**
     * THE WORD UNDER A VALUE, where a value has one. Today there is exactly one.
     *
     * Ben, 25 August 2026, choosing Slate's cell: a LEVER step's target prints the
     * spring preset under the number - `9.0 bar` then `classic`. It is the only place
     * the feel is visible without opening the lever dialog, which is what makes it
     * worth the line.
     *
     * `inferLeverPreset` IS THE ONE READER. The preset is not stored; it is inferred
     * from the spring and give legs, and `profile-modes.js` owns that inference for the
     * review sentence already. A second reading of the same two numbers here is how the
     * cell and the sentence would come to disagree.
     *
     * CUSTOM DRAWS NOTHING rather than the word "custom": a step whose feel matches no
     * preset has no preset to name, and A7's stance is that a missing answer is said by
     * absence, not by a stand-in.
     */
    #stepperNote(row, step) {
        if (row.key !== 'target' || (step && step.pump) !== 'lever') return nothing;
        const word = LEVER_FEEL_WORD[inferLeverPreset(step)];
        return word ? this.#i18n.t(word) : nothing;
    }

    /**
     * A ROW WHOSE ZERO IS A STATE gets a formatter, and #4 already takes one.
     *
     * `ui-stepper.format` is a function property the component consults instead of its
     * own `toFixed`, so "OFF" arrives by the seam that exists for it rather than by a
     * branch inside the component or a second value path here. The unit still draws
     * beside it, which is Slate's own shape: "OFF" then "bar".
     *
     * IT IS BUILT PER RENDER AND THAT IS DELIBERATE. A held function would close over
     * the range it was built with, and this cell's range CHANGES with the step's pump
     * mode (a flow step limits pressure, a pressure step limits flow); the decimals
     * come from that range's step, so a stale closure would print 12 as "12.00" one
     * mode later. Lit rebinds the property, not the DOM, so the cost is one comparison.
     */
    #zeroLabelFormat(row, range) {
        const places = range && Number.isFinite(range.step)
            ? (String(range.step).split('.')[1]?.length ?? 0)
            : 1;
        const off = this.#i18n.t(row.zeroLabel);
        return (value) => (Number(value) > 0 ? Number(value).toFixed(places) : off);
    }

    /**
     * THE LOCKED CELL (#43) — the Target row on a HOLD step, "a stepper with no caps".
     * It is PLACED, not built: wave 1 owns the box, the value arrives through its
     * default slot, and the two cells must agree on metrics because they are the same
     * cell in two states. The suite asserts their rects match.
     */
    #renderLocked(row, index) {
        const t = this.#i18n.t;
        return html`<ui-locked-value
            label=${this.#cellName(row, index)}
        >${t(HELD_TARGET_TEXT)}</ui-locked-value>`;
    }

    /** A SEGMENTED CELL (#3). Options and selection are the ports' decisions. */
    #renderBank(row, step, index) {
        const t = this.#i18n.t;
        const bank = bankOptionsFor(row, step, index, {
            pumpModesOffered: this.pumpModesOffered,
            holdOffered: this.holdOffered,
        });
        /* DENSITY GOES DOWN HERE TOO, and the omission was visible the moment the
         * advanced pump modes were wired on 25 August 2026: at FOUR chips in one cell
         * the regular 18px inset left 65px for "Pressure" at 17px and the word
         * ellipsised, while its sibling #4 in the same column had been taking
         * `density` all along. #3's compact rule moves ONE declaration — the inset,
         * 18px to 8px — and its own header wrote it for this case: "only a bank given
         * a definite width can be tighter than its own labels". */
        return html`<ui-bank
            density=${this.density}
            label=${this.#cellName(row, index)}
            .items=${bank.options.map((option) => ({
                value: option.value,
                label: t(option.label),
                disabled: option.disabled,
            }))}
            .value=${bank.value ?? ''}
            ?disabled=${bank.readOnly}
            @change=${(event) => this.#onCellChange(event, row, step, index)}
        ></ui-bank>`;
    }

    /**
     * THE EXIT BAND (#41, C8). The compound owns the sentence, the remove control and
     * the #21 add-slot popover; its events (`exit-edit`, `exit-remove`, `exit-add`)
     * are composed and already carry the step index, so they cross this boundary
     * untouched — re-emitting them would be a second owner of one message.
     *
     * The group wrapper is what gives the band's controls their per-step context: #41
     * names its own buttons ("Remove Volume"), which is right inside one band and
     * repeats across columns, and E14's counter-example is exactly repeated names.
     */
    #renderExits(row, step, index) {
        return html`<div
            class="exit-group"
            role="group"
            aria-label=${this.#cellName(row, index)}
        ><ui-exit-sentence
            .step=${step}
            .index=${index}
            ?power-exit-offered=${this.powerExitOffered}
        ></ui-exit-sentence></div>`;
    }

    /**
     * THE ACTION KEY RAIL (#42, C7). Five keys as shipped — move-left, delete,
     * insert-after, duplicate, move-right — and the reorder pair IS move-left and
     * move-right. NOTHING DRAG-SHAPED IS PASSED, ASKED FOR OR ADDED: the component
     * carries no drag path and this file adds none.
     *
     * Its `step-action` event is composed and carries {action, index, count}, so it
     * crosses this boundary as it is — AND `editor-screen.js` LISTENS FOR IT, on its host,
     * beside the four value events, applying it through `editor-draft.js applyStepAction`.
     *
     * THAT SENTENCE USED TO STOP AT THE DASH, and the stop was the bug. Ben, 27 August
     * 2026: "IN the profile editor page, the 5 buttons down the bottom dont seem to do
     * anything, like if I try to make a new step of copy one etc it does noting." The rail
     * dispatched correctly and this file mounted it correctly and NOTHING IN `src/` was on
     * the other end — five buttons, a documented contract, and no listener. The rail's own
     * 700-line suite was green throughout, because it exercises the rail in isolation and
     * an event with no listener is exactly what it asserts. A comment describing a
     * connection is not a connection.
     *
     * THE COUNT IS THE WHOLE LIST'S, NOT THIS COLUMN'S. `total` is what disables the two
     * edge keys at the ends and what disables DELETE on a one-step profile (the rail's own
     * `minCount`), so it has to be the draft's length rather than anything local.
     */
    #renderActions(row, step, index, total) {
        return html`<ui-action-key-rail
            .index=${index}
            .count=${total}
            label=${this.#cellName(row, index)}
        ></ui-action-key-rail>`;
    }
}

customElements.define('step-matrix', StepMatrix);
