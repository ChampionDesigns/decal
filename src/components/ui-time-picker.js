/**
 * ui-time-picker — Wave 4 item #54, the time picker FACE, as a dialog body.
 *
 * Part 4's Wave 4 "Dialog bodies" row, verbatim (SCOPE.md:1617):
 *
 *     | 54 | **Time picker face** | The SVG clock face — already the one genuinely
 *     fluid element in the old app (spec §5.2 #54). Pure logic from
 *     `time-picker-core.js`, PORT-AS-IS. | medium | #18; `time-picker-core.js` |
 *
 * and the inventory row it points at (LAYOUT_SPEC_DRAFT.md:925):
 *
 *     | 54 | Time picker face | `time-picker-modal.css:152-170` | The one
 *     SVG-intrinsic, genuinely fluid element in the old app. |
 *
 * ============================ WHAT THIS IS AND IS NOT =========================
 * It is CONTENT ONLY. #18 (`ui-dialog`) owns modality, the focus trap, inertness,
 * Escape arbitration, the scrim and the top-layer paint; this element fills
 * `slot="body"` and nothing else. Slate's picker hand-rolled all of that
 * (`time-picker-modal.js:131-176`: its own `<dialog>`, its own backdrop rgba, its own
 * click-outside handler) and §4.6 is explicit that it must not: "One dialog
 * component, not seven ... the numpad, the notes editor, the time picker, the
 * settings schedule sheet, the exit-condition dialog, the lever dialog and the
 * confirm dialogs". A second modal machinery here would be the wave's block.
 *
 * The title and the Cancel/OK pair are #18's too — `heading` and `slot="actions"`.
 * Slate drew them inside the card (`.tpm-title`, `.tpm-btn`), and its own title is
 * bug A10: "all three consumers re-declare the title type and the time picker's is
 * 20px/800 against the component's 28px/500" (spec §5.1 row 16). Not restating it
 * here is how A10 dies for this consumer.
 *
 * IT READS NO SERVER DATA — Gate 2 by construction. Its whole input is a `value`
 * string and its whole output is a `change` event; there is no store, no fetch, no
 * address-layer call and no server key string anywhere in this file, because
 * `CARRY_FORWARD.md:242` records the reason: "ReaPrime has no time-of-day resource."
 * The wake-schedule screen that hosts it owns whatever persistence exists.
 *
 * ============================ THE PORT ========================================
 * `src/lib/time-picker-core.js` is PORT-AS-IS (SCOPE.md:2641, "68 lines ... The only
 * file in the candidate set with ZERO imports; every function total, no NaN paths").
 * Every number this component derives comes back through it —
 * `parseTime24` / `formatTime24` / `to12h` / `to24h` / `snapMinute` /
 * `hourHandAngle` / `minuteHandAngle` — and nothing about the time arithmetic is
 * re-implemented below. In particular:
 *
 *   - `value` is the ONLY state. h12, minute and AM/PM are re-derived from it on
 *     every render through `parseTime24` + `to12h`, so there is no second copy to
 *     drift. Slate kept a module-level `state` object beside the input and wrote
 *     both (`time-picker-modal.js:28-34, 186-191`).
 *   - An unparseable `value` does not become NaN and does not overwrite the caller's
 *     string: `parseTime24` falls back (`:20, :23`) and the face draws the fallback
 *     until the first real choice. Totality is the whole reason the module was
 *     PORT-AS-IS.
 *   - The 12 label angles ARE `hourHandAngle` / `minuteHandAngle`. Slate computed
 *     `i * 30 - 90` inline (`time-picker-modal.js:73`) beside the two exported
 *     helpers that return exactly that; here the helper is the single owner.
 *
 * ============================ ORACLE ==========================================
 * Disqualification check, run FIRST (SCOPE Part 10 §4), and it disqualifies the
 * oracle three ways over:
 *
 *   1. NO CORPUS COVERAGE. The picker is not one of the 49 states.
 *      `prov_query.py find --cls tpm-svg`   → "searched 49 state(s), found 0
 *      element(s) in 0 state(s)", and the same for `tpm-dialog`, `tpm-clock`,
 *      `tpm-seg`, `tpm-num`. The tool's own answer: "The corpus has no answer for
 *      this element: read the Slate source read-only, or record a reversible choice."
 *      So every value below is either a token, a read-only source read of
 *      `time-picker-modal.css` / `.js`, or the spec.
 *   2. RESPONSIVE BEHAVIOUR. This row is the one element the spec calls fluid, and
 *      "Slate has no answer: 98.4% of its geometry is frozen. LAYOUT_SPEC_DRAFT.md
 *      governs."
 *   3. §7's bug list reaches this file directly — O16 below.
 *
 * The one oracle answer that IS quotable is the control this face replaces, on the
 * screen that opens it:
 *
 *     CITE settings-machine-sleep---wake-schedules #schedule-time-input [i=76]
 *          font-size = 17px  <-  slate-shell.css
 *          `#subpage-host #settings-content-area input:not([type="range"])...`
 *          authored `var(--slate-text-base)`  !important=yes  (token-driven)
 *          rect x=691 y=396 w=538 h=58
 *
 * 17px is `--ui-text-base`, and it is also what `time-picker-modal.css:174` gives
 * the clock numbers (`font-size: var(--slate-text-base)`) — source and oracle agree,
 * so the chip glyph is `--ui-text-base` and not a guess.
 *
 * Composed primitives are measured, and those the oracle does answer for:
 *     CITE settings-connection-scale .slate-bank-item [i=45] rect 126 x 62
 *     CITE settings-display-skin     .slate-bank-item      rect 129 x 62
 *     (`find --cls slate-bank-item` → 41 elements in 13 states) → --ui-control-inner.
 *     CITE settings-help-keyboard-shortcuts .slate-keycap → 6 elements, 5 at 48 x 48
 *     (`find --cls slate-keycap`) — the one place Slate's own touch floor is real,
 *     and the floor this face's chips take.
 *
 * ============================ THE THREE DEFECTS THAT DIE ======================
 * The wave row's `bugs` array is empty, so these are cited from the spec rather than
 * from the row, and each has an assertion in
 * `test/render/ui-time-picker.render.test.mjs`.
 *
 * O16 — "Literal colours in two sheets whose own headers claim they have none"
 *   (§7.7, `time-picker-modal.css:192`). That line is this component's, exactly:
 *       .tpm-num-sel { fill: #fff; }
 *   the selected clock number, painted with a hex, inside a sheet whose header says
 *   "every value now resolves to a Slate token" (`:5-9`). There is no `fill` colour
 *   in this file at all: the selected chip is a real HTML button and its whole
 *   selected look is `selectionSurface` — `--ui-selected-ink` for the glyph,
 *   `--ui-selected-face` for the disc under it. A literal cannot move under a token
 *   drill; the suite drills it.
 *
 * §2.2 ROW 1 — "Control heights, touch targets, hairlines: FIXED TOKEN. Never
 *   fluid ... A control that shrinks with the window becomes unusable exactly when
 *   the window is small." Slate's number targets are `<circle r="22">` inside an SVG
 *   at `width: 264px; max-width: 78vw` (`time-picker-modal.js:77`,
 *   `time-picker-modal.css:152-155`), i.e. a 44-unit touch target that scales with
 *   the viewport and is already under the 48px floor at its natural size. Here the
 *   12 targets are HTML buttons at `--ui-hit-min`, at FLUID POSITIONS but a FIXED
 *   SIZE: the artwork scales, the finger does not. This is also why the face has a
 *   floor rather than shrinking indefinitely — see `--_ui-tp-pitch` below.
 *
 * §4.6 / §2.1 RULE 1 — "The time picker `overflow: visible`s at `max-height: 96vh`
 *   and needs a ≥590px-tall viewport to fit", and `max-width: 78vw` on the SVG.
 *   Three viewport queries in one small overlay. This file writes no `vw`, no `vh`
 *   and no `@media (width…)`: the face reads its own container
 *   (`inline-size: min(100%, …)`) and the dialog body's bounded, scrollable cell is
 *   #18's `.body { overflow-y: auto }`. The suite renders at both Gate A geometries
 *   and asserts the face is the same size in a container of the same width.
 *
 * ============================ DEPARTURES, ON PURPOSE ==========================
 * 1. THE 12 NUMBERS ARE BUTTONS, NOT SVG `<text>`. Slate's are `<text>` and
 *    `<circle>` with a delegated click handler (`time-picker-modal.js:98-110`) —
 *    no role, no tabindex, no `aria-checked`, no keyboard path of any kind. The
 *    artwork (disc, hand, hub) stays SVG and stays fluid, which is the property
 *    §5.2 #54 names; the semantics move to a `role="radiogroup"` of real buttons so
 *    Appendix 15's contract ("the `aria-*`-driven state selectors ... the right
 *    contract for a Lit component's reflected properties") and Appendix 10's
 *    roving tabindex both apply. It is also what makes the four dials reach the
 *    selected number: `background-color` does not paint an SVG `<text>`, which is
 *    precisely why Slate reached for a `fill` literal.
 * 2. NO KNOB CIRCLE. Slate draws `<circle r="20" class="tpm-knob">` under the
 *    selected number AND colours the number. The selected chip IS that disc here —
 *    one object painted once by `--ui-selected-face`, 48px instead of 40px.
 * 3. NO COLON BETWEEN HH AND MM. Slate's `.tpm-colon` separates two detached
 *    rounded boxes 8px apart (`time-picker-modal.css:111-115`). The readout is a
 *    one-piece `ui-bank` here, so the divider is the bank's seam — CONVENTIONS §13,
 *    "a divider is a gap, not a border". Gallery state `readout` exists to be looked
 *    at and accepted or rejected on purpose; recorded as a deferred question.
 * 4. AM/PM IS A ROW, NOT A COLUMN. Slate stacks them vertically in a 54px box
 *    (`time-picker-modal.css:117-127`). `ui-bank` is horizontal and exposes no
 *    orientation, and #3 is the one selection component — "the fourth selection
 *    idiom collapses into a #3 use" (Part 4, #37). Two shoulder-to-shoulder cells
 *    with the bank's own seam.
 *
 * ====================== THE ZERO-CONFIGURATION STATE ==========================
 * `<ui-time-picker>` with no `value` DRAWS 07:00 AM. `parseTime24('')` returns the
 * fallback its own signature documents — `{ h24: 7, m: 0 }`, `time-picker-core.js:14-25`,
 * "so the picker always opens on a real time rather than NaN" — so the hand points at
 * 7, chip 7 is the checked radio and the live region states "07:00 AM". `value` itself
 * stays "": this component never writes back a time the caller did not choose, which is
 * the rule the garbage case follows too (`value="nope"` draws 07:00 and stays "nope")
 * and the native `<input type="time">` contract `#commit` keeps.
 *
 * THAT IS A DECISION, not an accident of a default parameter, and it is asserted both
 * ways in the suite ("no value at all draws the fallback and invents no value") — the
 * state was previously drawn by no stated rule and covered by no test. It is also NOT
 * A7's fallback: A7 bans porting a `?? compute` path over absent SERVER data, and
 * there is no server data in this component at all (CARRY_FORWARD.md:242) — this is
 * the ported module's totality, which is why it was PORT-AS-IS.
 *
 * The two halves separate, and the second is recorded as a deferred question: a clock
 * face has to point SOMEWHERE, but it does not have to CHECK a chip. Leaving no radio
 * checked until `value` is a real time — the shape an off-tick minute already takes —
 * is one ternary in `#selectedIndex`.
 *
 * ============================ WHY #3 CARRIES THE READOUT ======================
 * `ui-bank`'s `.item` states `font-size: var(--ui-text-base)`, and a time readout is
 * DISPLAY type (`time-picker-modal.css:99` `font-size: var(--slate-display-md)`).
 * Rather than fork the bank or hand-roll a fifth selection idiom, the digits are
 * SLOTTED into the bank's per-item slot (`ui-bank.js` render(): `<slot
 * name="item-${value}">`). A slotted node lives in THIS shadow tree, so this file's
 * `.digits { font-size: var(--ui-display-md) }` applies to it while the bank keeps
 * ownership of the roles, the roving tabindex, the seam and the four dials. No
 * selection rule is written in this file for the readout at all.
 *
 * @fires change — {detail: {value, h24, m}}, composed and bubbling, only on a user
 *                 choice that actually changes `value`. Not fired for a programmatic
 *                 `el.value = x`, which is the native contract `ui-bank` also keeps.
 */

import { css, html, nothing } from 'lit';

import { UiElement, selectionSurface, visuallyHidden } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';
import {
    formatTime24,
    hourHandAngle,
    minuteHandAngle,
    parseTime24,
    snapMinute,
    to12h,
    to24h,
} from 'src/lib/time-picker-core.js';
/* THE ONE SPELLING OF A TIME OF DAY (audit F-043). This component's readout used to be
 * unconditionally 12-hour while the opener that leads to it was unconditionally 24-hour,
 * so one value read two ways one press apart. `wall-clock.js` already owned that decision
 * for the two surfaces that draw a clock; it owns it for this one now as well. */
import { clockTime, CLOCK_FORMAT, DEFAULT_CLOCK_FORMAT, normaliseClockFormat } from 'src/lib/wall-clock.js';

import 'src/components/ui-bank.js';

/* ===========================================================================
 * THE ARTWORK'S GEOMETRY — read-only from `time-picker-modal.js:36-40`, which
 * names itself: "geometry (matches the 264x264 viewBox in time-picker-modal.css)".
 * The corpus has no answer here (0 elements in 0 states), and these are §2.3 case 3
 * lengths — "icon and glyph geometry intrinsic to the artwork". They are USER
 * UNITS in the viewBox, not CSS px: nothing below renders at 264px because it says
 * 264, it renders at whatever the container gives and the viewBox scales.
 *
 * ONE OWNER PER DIMENSION (§2.3). These constants are the owner: the CSS floor and
 * the per-chip positions are both computed from them and handed to the sheet as
 * custom properties, so the ratio is never written twice.
 * =========================================================================== */
const VIEW = 264;
const CENTRE = VIEW / 2;   // 132
const RING = 98;           // the radius the 12 labels sit on
const DISC_R = 118;        // the tinted face behind them
const HUB_R = 4;
const HAND_W = 2.5;

/** Label ring radius as a fraction of the face box — the chips' polar placement. */
const RING_FRACTION = RING / VIEW;

/**
 * THE FACE'S FLOOR, DERIVED (spec Appendix 12: "a size expressed as
 * control + 2 x space, not a measured constant").
 *
 * The 12 labels sit 30 degrees apart on a ring of radius 98 in a 264-unit box, so
 * the distance between two adjacent centres is 2 * 98 * sin(15deg) = 50.73 units =
 * 19.2% of the face. Each chip is --ui-hit-min across and must not eat its
 * neighbour, so the face cannot go below hit-min / that fraction. At the shipped
 * 48px floor that is ~250px. Move --ui-hit-min and the floor moves with it, which
 * is the assertion the suite makes rather than a comment claiming it.
 */
const CHIP_PITCH = (2 * RING * Math.sin(Math.PI / 12)) / VIEW;

/** Slate's own label sets, `time-picker-modal.js:42-43`, carried unchanged. */
const HOUR_LABELS = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
const MINUTE_LABELS = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

const MINUTE_STEP = 5;
const MODES = ['hour', 'minute'];

/**
 * A point on the label ring, from a hand angle in degrees.
 *
 * `time-picker-modal.js:45-48` in user units; this is the same function expressed as
 * a fraction of the box, because the chips are positioned in percentages and the
 * hand in viewBox units. Both callers read this one implementation.
 */
function ringPoint(angleDeg) {
    const a = (angleDeg * Math.PI) / 180;
    return { x: Math.cos(a), y: Math.sin(a) };
}

export class UiTimePicker extends UiElement {
    static properties = {
        /**
         * The time, as the 24-hour "HH:MM" string `formatTime24` produces and
         * `parseTime24` reads — "the exact shape the native <input type="time"> and
         * the existing save handlers read, so callers stay unchanged"
         * (`time-picker-core.js:27-29`). Reflected: it is the state, and tests read it.
         */
        value: { type: String, reflect: true },

        /** Which dial the face is showing: `hour` (default) or `minute`. Reflected. */
        mode: { type: String, reflect: true },

        /** Accessible name for the whole picker, when the dialog's heading is not it. */
        label: { type: String },

        /**
         * Auto-advance hour -> minute on an explicit choice, "like the OS picker"
         * (`time-picker-modal.js:105`). Arrow-key roving never advances: a dial that
         * changes under the caret is unusable from a keyboard.
         */
        autoAdvance: { type: Boolean, attribute: 'auto-advance' },

        /** Paint AND behaviour: the base dims the host, the controls refuse input. */
        disabled: { type: Boolean, reflect: true },

        /**
         * HOW THE READOUT IS WRITTEN — `24h` or `12h`, the `clockFormat` preference.
         * (Audit F-043, 29 August 2026.)
         *
         * TOLD, NEVER READ. Same shape as `ui-screensaver`'s property of the same name and
         * for the same reason: a component may not reach for a stored preference, so the
         * screen that composes this one hands it down. A caller with no opinion gets the
         * shipped default, which is what every existing caller silently got before.
         *
         * IT MOVES THE READOUT, NOT THE FACE. The dial is twelve chips and a before/after
         * noon bank, which is the control Slate shipped and the one this component is a
         * port of; a 24-hour DIAL is a different instrument, not a format. So `24h` writes
         * the hour segment and the live region as 13..23, and the meridiem bank stays —
         * it is the only way to reach the afternoon from twelve positions, and in 24-hour
         * mode the readout beside it says which half you are in without ambiguity.
         */
        clockFormat: { type: String, attribute: 'clock-format' },
    };

    static styles = [
        /* Structural fragment first (CONVENTIONS §4 rule 1). */
        visuallyHidden,

        css`
            /* ---------------------------------------------------------------
             * THE HOST IS THE DIALOG BODY'S CONTENT BOX.
             *
             * display: block and container-type: inline-size arrive from the base,
             * which is what makes every size below read this element's own box and
             * never the window (§2.1 Rule 1). #18's .body cell supplies the inset
             * (--_ui-dialog-pad) and the scroll behaviour (overflow-y: auto), so
             * there is no padding, no max-height and no overflow rule here — three
             * things Slate's card declared for itself and got wrong (§4.6: the
             * picker "overflow: visible-s at max-height: 96vh").
             * ------------------------------------------------------------- */
            :host {
                display: grid;
                gap: var(--ui-space-4);
                justify-items: center;

                /* minmax(0, 1fr) AND NOT auto, which is what an implicit column would
                 * be. The readout below states a fixed size and OVERFLOWS a narrow
                 * body on purpose; an auto track takes its min-content contribution —
                 * a definite width is its own min-content — and grows the track to
                 * match. The face then reads that inflated track as its 100% instead
                 * of reading this component's real box, so "a component reads its own
                 * container" (§2.1 Rule 1) would quietly become "reads its widest
                 * sibling". Measured: a 256px stage gave a 264px face. The 0 floor
                 * decouples them — the row overflows the track, the face fills it. */
                grid-template-columns: minmax(0, 1fr);

                /* THE ONE DOCUMENTED KNOB. SOURCE time-picker-modal.css:153
                 * width: 264px — the artwork's natural size, and the viewBox's.
                 * Its companion there, max-width: 78vw, is DROPPED: a component
                 * may not read the viewport (§2.1 Rule 1), and min(100%, …) below
                 * says the same thing about the right box. A screen that wants a
                 * bigger clock raises this; it cannot be lowered past the touch
                 * floor, by construction. */
                --_ui-tp-face-max: 264px;

                /* ONE READOUT CELL. SOURCE time-picker-modal.css:90-92
                 * .tpm-seg { width: 88px; height: 68px } — the display segment's own
                 * width, carried because the readout row is four such cells (HH, MM,
                 * AM, PM) and Slate drew two of them at exactly this size. It is a
                 * FLEX BASIS for the two banks, not a fixed width: below the row's
                 * natural size the cells shrink together and #3 ellipsises, which is
                 * the behaviour ui-bank documents for a narrow container. */
                --_ui-tp-seg: 88px;
            }

            /* ---------------------------------------------------------------
             * THE READOUT — two composed banks, and no selection rule of its own.
             *
             * SOURCE time-picker-modal.css:88-95 .tpm-display { display: flex;
             * align-items: center; justify-content: center; gap: 8px;
             * margin-bottom: 18px } — 8px is --ui-space-2, 18px is --ui-space-4 and
             * is the host's grid gap above rather than a margin here.
             *
             * THE ROW HAS A DEFINITE WIDTH, AND THAT IS NOT A STYLE CHOICE — it is
             * CONVENTIONS §2's trap, measured here the hard way. The base puts
             * container-type: inline-size on every UiElement :host, which applies
             * inline-size CONTAINMENT, so a ui-bank's own width can no longer come
             * from its contents. Sized with flex-basis: auto both banks collapsed to
             * 2px (their two hairlines) with the item buttons overflowing a host that
             * is overflow: hidden — invisible on screen and DEAD TO THE TOUCH, which
             * is exactly the failure Part 8 §3 Rule 1 says a screenshot gate cannot
             * see. The suite caught it as "clicking PM does not change the time".
             *
             * So the row states a size and the banks take a SHARE of it (flex-basis:
             * 0, which is definite): four equal cells — HH, MM, AM, PM — at Slate's
             * own segment width, plus the one gap between the two banks.
             *
             * AND THE SIZE DOES NOT SHRINK, which is the other half of §2.2 row 1.
             * The clock below is the FLUID element (§5.2 #54); this row is four
             * CONTROLS, and "control heights, touch targets, hairlines: fixed token,
             * never fluid". Let the row track its container instead and at 200px the
             * four cells reach 48px, which is 12px of content box after #3's own
             * padding-inline: every digit ellipsises away while the clock beside it
             * stays perfectly legible. So the readout overflows a container too
             * narrow for it — the same answer the face gives, for the same reason —
             * and the readout, not the clock, is this body's binding floor.
             * No container query: there is no second arrangement to switch to.
             * ------------------------------------------------------------- */
            .display {
                display: flex;
                align-items: stretch;
                justify-content: center;
                gap: var(--ui-space-2);
                inline-size: calc(4 * var(--_ui-tp-seg) + var(--ui-space-2));
            }

            /* The digits, slotted INTO #3 so the bank keeps the roles, the roving
             * tabindex, the seam and the dials while this file owns the type.
             * SOURCE time-picker-modal.css:99-101 font-size: var(--slate-display-md);
             * font-weight: 700; font-variant-numeric: tabular-nums — the last one is
             * why "06" and "11" do not shuffle the seam sideways as the hour changes.
             *
             * NO COLOUR HERE. The digits inherit color from the bank's own cell,
             * which is --ui-muted at rest and --ui-selected-ink when the cell is
             * checked. One ink, arriving through the dial, and nothing in this file
             * keyed on the selected state. */
            .digits {
                font-size: var(--ui-display-md);
                font-weight: var(--ui-weight-semibold);
                font-variant-numeric: tabular-nums;
            }

            /* Equal shares, so all four cells are one width. flex-basis: 0 rather
             * than auto — see the .display block: an auto basis is a content-based
             * size, and a contained host has none. */
            .field,
            .meridiem {
                flex: 1 1 0;
            }

            /* ---------------------------------------------------------------
             * THE FACE — the fluid half, and the whole reason this row exists.
             *
             * inline-size reads THIS component's container and stops at the artwork's
             * natural size; aspect-ratio keeps it square without a second length.
             * There is no height anywhere, and no vw/vh: at 1281x801 and at 1000x600
             * the same container gives the same face, which the suite measures.
             * ------------------------------------------------------------- */
            .face {
                position: relative;
                inline-size: min(100%, var(--_ui-tp-face-max));
                aspect-ratio: 1;

                /* THE TOUCH FLOOR, DERIVED (§2.2 row 1, §2.3 case 4).
                 * --_ui-tp-pitch is the adjacent-chip spacing as a fraction of the
                 * box, handed down from the module's own geometry constants so the
                 * ratio is not written twice. Below this the 48px chips overlap, so
                 * the face overflows a narrower container rather than shrinking the
                 * targets under the thumb — the same answer ui-pick-disc gives, and
                 * §2.2's first row states. */
                min-inline-size: calc(var(--ui-hit-min) / var(--_ui-tp-pitch));
            }

            /* The artwork. aria-hidden in the template: the 12 buttons above it carry
             * every piece of meaning, and a decorative SVG in the accessibility tree
             * is noise. */
            .dial {
                position: absolute;
                inset: 0;
                inline-size: 100%;
                block-size: 100%;
                display: block;
            }

            /* SOURCE time-picker-modal.css:161-163 .tpm-face { fill: var(--tpm-face) }
             * with --tpm-face: color-mix(in srgb, var(--slate-steel) 10%, transparent)
             * (:23). The dark theme's second value (12%, :34) is dropped: one token
             * set, no per-theme palette — which is the sheet's own stated intent at
             * :29-30, "The dark theme needs no second palette". */
            .disc {
                fill: color-mix(in srgb, var(--ui-steel) 10%, transparent);
            }

            /* SOURCE time-picker-modal.css:165-168 stroke: var(--tpm-accent-soft),
             * which is var(--slate-steel) (:25), stroke-width: 2.5. The width is
             * USER UNITS and scales with the artwork — a hairline that is part of a
             * drawing, not a control's edge, so --ui-hairline is the wrong token and
             * §2.3 case 3 is the right permission. */
            .hand {
                stroke: var(--ui-steel);
                stroke-width: ${HAND_W};
                stroke-linecap: round;
            }

            /* SOURCE time-picker-modal.css:170-172 .tpm-hub { fill: var(--tpm-accent-soft) }. */
            .hub {
                fill: var(--ui-steel);
            }

            .ring {
                position: absolute;
                inset: 0;
            }

            /* ---------------------------------------------------------------
             * ONE NUMBER. A CLASS, NEVER AN ID (CONVENTIONS §4 rule 2) — the ids
             * below are for the suite to query by, and an id here would be (1,0,0)
             * and would silently defeat every selected rule in selectionSurface.
             *
             * SOURCE time-picker-modal.css:173-181 .tpm-num { font-size:
             * var(--slate-text-base); font-weight: 700; fill: var(--tpm-text);
             * cursor: pointer; user-select: none }. fill becomes color because
             * this is a button and not a glyph in a drawing; the oracle corroborates
             * the size on the control this face replaces (see the header's CITE).
             *
             * THE SIZE IS THE TOKEN AND IT DOES NOT SCALE. The position is a
             * percentage of the face and the box is --ui-hit-min: artwork fluid,
             * finger fixed (§2.2 row 1). No .hit-overlay from CONVENTIONS §5 — the
             * ink IS the box here, so the overlay would grow a second box over a
             * target that already reaches the floor.
             * ------------------------------------------------------------- */
            .chip {
                position: absolute;
                transform: translate(-50%, -50%);

                inline-size: var(--ui-hit-min);
                block-size: var(--ui-hit-min);

                display: flex;
                align-items: center;
                justify-content: center;

                border: 0;
                border-radius: var(--ui-radius-pill);
                padding: 0;

                background-color: transparent;
                color: var(--ui-text);

                /* A button does not inherit its font — the UA sets the font
                 * shorthand on it. Family and line-height come back by inheritance
                 * from styles/document.css; the two the sources state are stated. */
                font-family: inherit;
                line-height: inherit;
                font-size: var(--ui-text-base);
                font-weight: var(--ui-weight-semibold);

                cursor: pointer;
                -webkit-user-select: none;
                user-select: none;
            }

            /* The minute dial's off-tick state: 07:37 has no chip to check, so the
             * hand alone carries it (time-picker-modal.js:61, "no exact number
             * between ticks"). Nothing is painted differently — this comment exists
             * so the absence is not read as a missing rule. */
        `,

        /* State fragment LAST, after the resting paint, because it has to beat it
         * (CONVENTIONS §4 rule 1). Everything a selected chip looks like arrives
         * here and nowhere else: --ui-selected-face under it, --ui-selected-ink in
         * it, the LED and the glow if a fork turns them up. This import is O16's
         * replacement — `fill: #fff` cannot be retargeted and these four can. */
        selectionSurface,
    ];

    constructor() {
        super();
        this.value = '';
        this.mode = 'hour';
        this.label = '';
        this.autoAdvance = true;
        this.disabled = false;
        this.clockFormat = DEFAULT_CLOCK_FORMAT;

        /** D2: no string table — the labels go through src/lib/i18n.js. */
        this.i18n = new I18nController(this);
    }

    /** Index to focus once the next render has produced the chips. */
    #pendingFocus = null;

    /** The `aria-label` the SCREEN wrote, so clearing `label` gives it back. */
    #authorLabel = null;

    connectedCallback() {
        super.connectedCallback();
        /* NOT the constructor: a custom element constructor must not gain
         * attributes (CONVENTIONS §13 makes the same note for the seam classes). */
        if (!this.hasAttribute('role')) this.setAttribute('role', 'group');
        if (this.#authorLabel === null) this.#authorLabel = this.getAttribute('aria-label');
    }

    /**
     * The group's accessible name. `label` wins while it has one; cleared, the host
     * goes back to whatever the screen wrote rather than to "" — an empty
     * `aria-label` is a name of "", which beats an author `aria-labelledby` and
     * leaves the group anonymous. Same shape, same reason, as `ui-bank`.
     */
    willUpdate(changed) {
        if (!changed.has('label')) return;
        if (this.label) this.setAttribute('aria-label', this.label);
        else if (this.#authorLabel) this.setAttribute('aria-label', this.#authorLabel);
        else this.removeAttribute('aria-label');
    }

    /* ---- the time, re-derived rather than stored ------------------------- */

    /**
     * The parsed time. Total by construction — `parseTime24` has no NaN path, so an
     * empty `value` (the zero-configuration state) and an unparseable one both take
     * its documented fallback of 07:00. See THE ZERO-CONFIGURATION STATE in the
     * header: the fallback is DRAWN and never written back to `value`.
     */
    get #time() {
        const { h24, m } = parseTime24(this.value);
        const { h12, ampm } = to12h(h24);
        return { h24, m, h12, ampm };
    }

    get #mode() {
        return MODES.includes(this.mode) ? this.mode : 'hour';
    }

    /** The stored preference, turned into one of the two — `wall-clock.js`'s own coercion,
     *  so an unrecognised value cannot mean something different here than on the Live
     *  header's clock. */
    get #clockFormat() {
        return normaliseClockFormat(this.clockFormat);
    }

    /**
     * Which chip is checked, or -1.
     *
     * Hours: 12 o'clock lives at index 0 (`time-picker-modal.js:57`).
     * Minutes: only a multiple of the step has a chip, and `snapMinute` — the ported
     * function whose job this is — is what decides. 07:37 checks nothing.
     */
    #selectedIndex(time) {
        if (this.#mode === 'hour') return time.h12 % 12;
        return snapMinute(time.m, MINUTE_STEP) === time.m ? (time.m / MINUTE_STEP) % 12 : -1;
    }

    /** The hand's angle, straight from the ported helpers. */
    #handAngle(time) {
        return this.#mode === 'hour' ? hourHandAngle(time.h12) : minuteHandAngle(time.m);
    }

    /* ---- writing ---------------------------------------------------------- */

    /**
     * Commit a new time. Fires `change` only when the string actually moves, which
     * is the native contract and `ui-bank`'s.
     */
    #commit(h24, m) {
        const next = formatTime24(h24, m);
        if (next === this.value) return false;
        this.value = next;
        this.dispatchEvent(new CustomEvent('change', {
            detail: { value: next, h24, m },
            bubbles: true,
            composed: true,
        }));
        return true;
    }

    /** A chip was chosen. `advance` is false for arrow-key roving. */
    #choose(index, { advance }) {
        if (this.disabled) return;
        const time = this.#time;

        if (this.#mode === 'hour') {
            const h12 = index === 0 ? 12 : index;
            this.#commit(to24h(h12, time.ampm), time.m);
            if (advance && this.autoAdvance) this.mode = 'minute';
        } else {
            this.#commit(time.h24, (index * MINUTE_STEP) % 60);
        }
    }

    /**
     * The bank's own `change` must not leave this host wearing this component's
     * name. `ui-bank` fires composed + bubbling, so without this the readout's
     * segment switch would surface to the screen as if the TIME had changed.
     */
    #onField(event) {
        event.stopPropagation();
        const next = event.detail?.value;
        if (MODES.includes(next)) this.mode = next;
    }

    #onMeridiem(event) {
        event.stopPropagation();
        const next = String(event.detail?.value || '').toUpperCase();
        if (next !== 'AM' && next !== 'PM') return;
        const time = this.#time;
        this.#commit(to24h(time.h12, next), time.m);
    }

    /**
     * Roving tabindex, Appendix 10's carried-over idea ("Roving-tabindex tablist,
     * exactly as implemented") in its radio-group spelling: focus moves round the
     * dial and the value follows focus, which is the WAI-ARIA radio contract. It
     * never auto-advances — see the `autoAdvance` property.
     */
    #onKeydown(event, index) {
        const last = HOUR_LABELS.length - 1;
        let next = null;
        switch (event.key) {
            case 'ArrowRight': case 'ArrowDown': next = (index + 1) % (last + 1); break;
            case 'ArrowLeft': case 'ArrowUp': next = (index + last) % (last + 1); break;
            case 'Home': next = 0; break;
            case 'End': next = last; break;
            default: return;
        }
        event.preventDefault();
        this.#pendingFocus = next;
        this.#choose(next, { advance: false });
        /* Choosing the chip that is already checked moves no reactive property, so
         * without this the roving focus would stall on the selected number. */
        this.requestUpdate();
    }

    updated(changed) {
        super.updated?.(changed);
        const index = this.#pendingFocus;
        if (index === null) return;
        this.#pendingFocus = null;
        this.renderRoot.getElementById(`chip-${index}`)?.focus();
    }

    /* ---- rendering -------------------------------------------------------- */

    render() {
        const time = this.#time;
        const mode = this.#mode;
        const labels = mode === 'hour' ? HOUR_LABELS : MINUTE_LABELS;
        const selected = this.#selectedIndex(time);
        const tabStop = selected >= 0 ? selected : 0;

        /* THE HOUR SEGMENT FOLLOWS THE PREFERENCE (audit F-043). Twelve-hour is the
         * dial's own numbering and was the only thing this readout could say; 24-hour is
         * what the opener beside it had been saying all along. */
        const twentyFour = this.#clockFormat === CLOCK_FORMAT.H24;
        const hh = String(twentyFour ? time.h24 : time.h12).padStart(2, '0');
        const mm = String(time.m).padStart(2, '0');
        /* THE WHOLE TIME, THROUGH THE ONE FORMATTER — the same string the opener that
         * led here prints, rather than a second assembly of the same three parts. */
        const spoken = clockTime(time.h24, time.m, this.#clockFormat, this.i18n.language);

        const hand = ringPoint(this.#handAngle(time));
        const handX = (CENTRE + RING * hand.x).toFixed(2);
        const handY = (CENTRE + RING * hand.y).toFixed(2);

        const dialName = mode === 'hour' ? this.i18n.t('Hour') : this.i18n.t('Minute');

        return html`
            <div class="display">
                <ui-bank
                    id="field"
                    class="field"
                    mode="radio"
                    .items=${[
                        { value: 'hour', label: hh },
                        { value: 'minute', label: mm },
                    ]}
                    value=${mode}
                    label=${this.i18n.t('Set hours or minutes')}
                    ?disabled=${this.disabled}
                    @change=${this.#onField}
                >
                    <span slot="item-hour" class="digits">${hh}</span>
                    <span slot="item-minute" class="digits">${mm}</span>
                </ui-bank>

                <ui-bank
                    id="meridiem"
                    class="meridiem"
                    mode="radio"
                    .items=${[{ value: 'AM', label: 'AM' }, { value: 'PM', label: 'PM' }]}
                    value=${time.ampm}
                    label=${this.i18n.t('Before or after noon')}
                    ?disabled=${this.disabled}
                    @change=${this.#onMeridiem}
                ></ui-bank>
            </div>

            <div class="face" id="face" style="--_ui-tp-pitch:${CHIP_PITCH.toFixed(5)}">
                <svg
                    class="dial"
                    viewBox="0 0 ${VIEW} ${VIEW}"
                    aria-hidden="true"
                    focusable="false"
                >
                    <circle class="disc" cx=${CENTRE} cy=${CENTRE} r=${DISC_R}></circle>
                    <line class="hand" x1=${CENTRE} y1=${CENTRE} x2=${handX} y2=${handY}></line>
                    <circle class="hub" cx=${CENTRE} cy=${CENTRE} r=${HUB_R}></circle>
                </svg>

                <div
                    class="ring"
                    id="ring"
                    role="radiogroup"
                    aria-label=${dialName}
                    aria-disabled=${this.disabled ? 'true' : nothing}
                >
                    ${labels.map((text, index) => {
                        const p = ringPoint(index * 30 - 90);
                        const left = (50 + RING_FRACTION * 100 * p.x).toFixed(3);
                        const top = (50 + RING_FRACTION * 100 * p.y).toFixed(3);
                        const on = index === selected;
                        return html`
                            <button
                                id="chip-${index}"
                                class="chip"
                                type="button"
                                role="radio"
                                aria-checked=${on ? 'true' : 'false'}
                                tabindex=${index === tabStop ? '0' : '-1'}
                                style="left:${left}%;top:${top}%"
                                ?disabled=${this.disabled}
                                @click=${() => this.#choose(index, { advance: true })}
                                @keydown=${(event) => this.#onKeydown(event, index)}
                            >${text}</button>
                        `;
                    })}
                </div>
            </div>

            <!-- O9's shape, one dialog body along: the numpad's "display is updated
                 by innerHTML with no aria-live" (§7.7). The readout here is two
                 button labels, and a button whose text changes announces nothing, so
                 the whole time is stated once, politely, in the one visually-hidden
                 treatment (CONVENTIONS §5a). -->
            <p
                class="a11y"
                id="live"
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >${spoken}</p>
        `;
    }
}

customElements.define('ui-time-picker', UiTimePicker);
