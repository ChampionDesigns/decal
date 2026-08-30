/**
 * ui-numeric-keypad.js — component #53 of the 57-component inventory: THE NUMERIC
 * KEYPAD, and only the BODY of the dialog it lives in.
 *
 * Wave 4, item #53 (SCOPE Part 4, "Wave 4 — dialog bodies"). spec §5.1 row 53:
 * "53 | Numeric keypad | `numpad-modal.css:296-331` | The body of the dialog,
 * separate from the dialog shell."  That last clause is the whole shape of this
 * file: MODALITY IS NOT HERE. #18 (`ui-dialog`) owns the top layer, the focus trap,
 * the inertness, the scrim, the restore target and the Escape arbitration; this
 * component supplies content for its `body` and `actions` slots and nothing else.
 * A second modal machinery in here would be a wave block.
 *
 * WHY THAT SPLIT IS NOT ARBITRARY — spec Appendix 13, "what this spec deliberately
 * carries over", item 13:
 *
 *   "The numpad's bounded, scrollable card (`numpad-modal.css:44-48`) and its
 *    Escape ownership for nested dialogs (`numpad-modal.js:252-268`) — the only
 *    overlay that handles a short viewport, and a real fix to a real problem."
 *
 * BOTH halves were carried into #18 rather than kept here: the bounded scrollable
 * card is `ui-dialog.js`'s three-cell grid with `overflow-y: auto` on the body cell,
 * and the Escape ownership is #18's module-level OPEN_DIALOGS stack. The numpad is
 * the overlay that got it right; #18 copied it; so #53 inherits it by composition
 * and asserts it rather than re-implementing it (see section 6 of the suite).
 *
 * ------------------------------------------------------------------------------
 * THE TWO BUGS THIS COMPONENT EXISTS TO RETIRE (spec §7, "Overlays")
 * ------------------------------------------------------------------------------
 *
 *   O9   "The numpad's backspace key has no accessible name (an unlabelled <svg>,
 *         not even aria-hidden), and the display is updated by innerHTML with no
 *         aria-live."   `numpad-modal.js:220-222, 291-292`
 *
 *   O10  "The numpad title writes an inline 28px unconditionally on every open and
 *         shrinks to a 16px floor — the one piece of type in the skin whose size is
 *         not a token — while its comment describes two-line wrapping that three
 *         white-space: nowrap declarations forbid."
 *         `numpad-modal.js:508-522`; `numpad-modal.css:83`; `slate-components.css:685`
 *
 * O9 dies structurally. The pressable is a real `<button>` and the backspace one
 * carries `aria-label`, so it has a name whatever glyph the face shows; the readout
 * is a live region (`role="status"`, `aria-live="polite"`, `aria-atomic="true"`)
 * whose text is set by Lit, never by `innerHTML`.
 *
 * O10 dies by SUBTRACTION: this component owns no title at all. The heading is
 * `ui-dialog`'s `heading` property, rendered by #16 `ui-sheet-header` through the
 * `.ui-title` type role — `type-roles.js:205-208`, `font-size: var(--ui-text-xl)`.
 * There is no fit loop, no inline style and no measured shrink, so the size cannot
 * be the one piece of type in the skin that is not a token.
 *   ORACLE, the defect itself:
 *   CITE modal-numpad #numpad-modal-title [i=167] font-size = 28px  <-  <inline>
 *        `<inline>`  authored `28px`  !important=no  (FROZEN/hardcoded)
 *   Every other piece of type in the same state is token-driven, e.g.
 *   CITE modal-numpad #numpad-display-value [i=173] font-size = 42px  <-
 *        numpad-modal.css `.numpad-modal-input-value` authored `var(--slate-display-md)`
 *        !important=no  (token-driven)
 *   CITE modal-numpad .numpad-modal-numpad-btn [i=175] font-size = 30px  <-
 *        numpad-modal.css `.numpad-modal-numpad-btn` authored `var(--slate-display-sm)`
 *        !important=no  (token-driven)
 * O10's second half — "a comment describes two-line wrapping that three
 * white-space: nowrap declarations forbid" — is settled UPSTREAM, in #16: a sheet
 * title is one line, ellipsised, with `min-inline-size: 0` making the ellipsis
 * reachable (`ui-sheet-header.js:360-367`). One behaviour, stated, instead of a
 * comment and three rules disagreeing.
 *
 * ------------------------------------------------------------------------------
 * EVERY BOUND COMES FROM THE PORT. THERE IS NO NUMBER IN THIS FILE.
 * ------------------------------------------------------------------------------
 *
 * Decisions B2 and B3. `src/lib/machine-limits.js` is the ONE limits table in the
 * skin and it lives behind the R2 adapter; a numpad that hand-wrote a min or a max
 * would be the second copy B2 exists to prevent, and the old skin had three
 * disagreeing answers for `dose` alone (machine-limits.js's own comment: "the
 * numpad's hint, the profile editor's, and the rail's + button, which had no ceiling
 * at all").
 *
 * B3 is why this component could not be built before the port: Slate's steam row was
 * 130..170, and 130 °C is inside the DEAD BAND where the heater is off — the clamp
 * snapped users into a temperature the machine does not hold. The corrected row is
 * floor 135 with a machine-dependent ceiling, 165 on Bengle and 160 on a DE1
 * (`doc/Skins.md:573`, "135–160 °C for DE1 and 135–165 °C for Bengle"). This file
 * never sees those numbers: it receives a frozen table and asks the port.
 *
 * THE ROUTE, and it is the only one (port digest, and `capabilities-store.js:406`):
 *
 *     const answer = capabilitiesStore.machineLimits();   // the R2 envelope
 *     keypad.limits = answer.value;                       // the frozen table
 *
 * `answer.known === false` means the machine class has not arrived, so the table
 * carries NO steam row. That is not a reason to invent a ceiling — A7, never a
 * fallback — so with no row for `limit-key` this component renders the keypad
 * UNAVAILABLE and refuses to confirm. Absence is a real answer and it is rendered as
 * one. `hasLimit()` is the test; there is no `?? 100` anywhere.
 *
 * NOTHING HERE IMPORTS `src/data/` OR `src/stores/`, and no server key string
 * appears in this file. The screen reads the store and hands the table down, which
 * is the Gate 2 shape every component in the library uses.
 *
 * ------------------------------------------------------------------------------
 * MEASURED STARTING VALUES — the oracle, quoted, with the disqualification check run
 * ------------------------------------------------------------------------------
 *
 * Disqualification (SCOPE Part 10 §4) run FIRST, per element:
 *   - the TITLE is bug O10 → the oracle is DISQUALIFIED for it and the spec governs.
 *     Its 28px is quoted above as the defect, never as a target.
 *   - the BACKSPACE key is bug O9 → disqualified for its accessibility shape.
 *   - RESPONSIVE BEHAVIOUR is disqualified everywhere: Slate is frozen at 1920×1200
 *     and §4.6 notes its one real breakpoint "neither fires on the bench tablet, so
 *     the narrow/short numpad layout is currently untested on the target hardware".
 *     The layout spec governs, and it says to carry that breakpoint "as a container
 *     query on the dialog's own box" — which is what `.body` does below.
 *   - everything else in `modal-numpad` is CLEAR: grepping §7's 140 layout bugs for
 *     "numpad" returns L22 (the RAIL's numpad targets, a different control), O9, O10
 *     and O15 (a third sheet reaching in — impossible through a shadow root).
 *
 *   CITE modal-numpad .numpad-modal-container [i=166] rect x=550 y=284 w=820 h=545
 *        — 820px is the card width, and it is #18's own default --_ui-dialog-inline.
 *   CITE modal-numpad .numpad-modal-numpad-btn [i=175..186] "distinct geometries
 *        (w x h), all matched elements: 107 x 88 x12"; rects [1000,416,107,88]
 *        [1119,416,...] [1238,416,...] [1000,516,...] — so the pad is 3 columns
 *        × 4 rows with a 12px gutter on both axes (1119−1000−107 = 12; 516−416−88 = 12)
 *        = --ui-space-3, and the key WIDTH is a 1fr share of the column, not a
 *        constant (numpad-modal.css:302 `repeat(3, minmax(0, 1fr))`).
 *   CITE modal-numpad .numpad-modal-numpad-btn [i=175] background-color: dark
 *        rgb(26, 33, 39) / light rgb(248, 249, 249)  <-  numpad-modal.css authored
 *        `(NOT CAPTURED — set via a CSS shorthand)` !important=no (token-driven)
 *        [= --ui-key, styles/tokens.css:722 #f8f9f9 / :843 #1a2127 — exact, both
 *         themes, and exactly what #15's face already paints]
 *   CITE modal-numpad .numpad-modal-numpad-btn [i=175] border-top-color: dark
 *        rgb(58, 72, 82) / light rgb(203, 208, 211); border-top-width = 1px;
 *        border-top-left-radius = 6px   [= --ui-line / --ui-border-w / --ui-radius]
 *   CITE modal-numpad #numpad-display-value [i=173] rect x=575 y=574 w=376 h=104;
 *        color: dark rgb(244, 247, 248) / light rgb(23, 26, 28) <- numpad-modal.css
 *        `.numpad-modal-input-value` authored `var(--slate-text)` (token-driven)
 *        [= --ui-text]; font-weight 300 both themes.
 *   CITE modal-numpad .numpad-modal-input-box [i=171] background-color: dark
 *        rgb(14, 19, 23) / light rgb(248, 249, 249) — DIFF, and the two are DIFFERENT
 *        TOKENS: --ui-fascia in dark, --ui-key in light. See departure 3.
 *   CITE modal-numpad .numpad-modal-input-box [i=171] border-top-left-radius = 6px
 *        [= --ui-radius]; height 104px.
 *
 * ------------------------------------------------------------------------------
 * DELIBERATE DEPARTURES — each also asserted as a departure in the suite
 * ------------------------------------------------------------------------------
 *
 * 1. THE KEY FACE IS #15, UNCHANGED, SO THE KEY IS 48px TALL AND NOT 88px.
 *    Row #53 depends on #15 and #15 is the numpad key face — "this element is the
 *    FACE; #53 (Wave 4, the numpad body) owns pressing" (ui-keycap.js). Its box is
 *    `min-inline-size: var(--ui-hit-min); block-size: var(--ui-hit-min)`, and the
 *    numpad cannot re-point those: guard 4 (`scripts/guards.js:151-177`,
 *    "private-palette") makes ANY `--ui-*` declaration inside a component an error,
 *    and #15 exposes no `--_ui-keycap-block` / type hook to set instead. Slate's own
 *    rule is 88px with a comment worth keeping ("this is the one control on the
 *    machine that is used with a fingertip, at speed, often with a wet hand ... 88px
 *    is the same four rows in the space the dialog already had"), so the loss is
 *    real and it is recorded — in EXPECTED_CHANGES as a decision and in
 *    DEFERRED_QUESTIONS with its reversal, which is two additive lines in #15 plus
 *    one declaration here. What is NOT lost is the floor: 48px is
 *    `--ui-hit-min`, "a wet fingertip is about 9 mm; at this panel's density that is
 *    ~48px" (`slate-tokens.css:99-102`), and the key is ~107px wide because the
 *    column is Slate's own 1fr. The alternative — a fourth hand-rolled key rule in
 *    this file — is the decay the component layer exists to stop, and would also
 *    make #15 dead code on the day it shipped.
 *
 * 2. THE PAD KEY IS A `<button>` WRAPPING THE FACE. #15 is deliberately not
 *    interactive. A numpad key must be operable from a keyboard and announce as a
 *    button, and `tabindex` alone gives neither Enter/Space activation nor a role,
 *    so the pressable is a real button and the face is its content. `<kbd>` is
 *    phrasing content, so this nests legally. The ONE focus ring comes from the base
 *    for free (its selector list contains `button`); this file authors no ring.
 *
 * 3. THE ENTRY WELL IS `--ui-fascia` IN BOTH THEMES. Slate's well computes
 *    `--slate-fascia` in dark and `--slate-key` in light (the CITE above), because
 *    the authored `background: var(--slate-key)` shorthand is overridden by a
 *    `[data-theme='dark']` rule — so the well reads RECESSED on one theme and RAISED
 *    on the other, which is the thing a well must not do. One token, both themes,
 *    recessed in both: `--ui-fascia` is darker than `--ui-key` in light too
 *    (#f2f3f3 vs #f8f9f9).
 *
 * 4. THE WELL'S HAIRLINE IS `--ui-line-strong`, NOT `--ui-steel`.
 *    `numpad-modal.css:184` authors `border: 1px solid var(--slate-steel)` on the
 *    well. `--ui-steel` is documented in `styles/tokens.css:750` as "focus ring,
 *    selected LED, selected FILL" — a resting steel outline on an element that is
 *    not focusable reads as a focus ring on a control that cannot take focus, which
 *    is the sixth focus look starting (spec §3.6). The well is an enclosure, so it
 *    takes the enclosure ink.
 *
 * 5. NO BLINKING CARET. `numpad-modal.css:204-218` animates a 2px bar at 1 Hz
 *    forever. CONVENTIONS §11: there is no reduced-motion rule in the base because
 *    the honest implementation needs `!important`, so an unconditional infinite
 *    animation is not something a leaf may introduce. The live region announces the
 *    value instead, which is the accessibility half the caret never provided (O9).
 *
 * 6. WEIGHT 300 → `--ui-weight-light`, AND THE DEPARTURE IS CLOSED for the readout.
 *    The readout and the keys are weight 300 in Slate. The sheet used to ship three
 *    weights (400/500/700) and the nearest was 400; parity surface 1 restored Slate's
 *    own four after finding that LAYOUT_SPEC_DRAFT §3.5's three-weight line is refuted
 *    by its own citation (slate-tokens.css:148-153 declares light 300 and semibold 600).
 *    The readout here now reads --ui-weight-light. THE KEYS ARE NOT THIS FILE'S: they
 *    are <ui-keycap>, which still renders --ui-weight-regular — recorded as a
 *    modal-numpad-surface row for that surface's parity pass, not fixed from here.
 *
 * 7. THE DECIMAL KEY IS DISABLED ON AN INTEGER-STEP FIELD, and the entry length is
 *    DERIVED FROM THE RANGE rather than Slate's fixed five characters
 *    (`numpad-modal.js:300`). Both come from the port's declaration, so both move
 *    when the table moves; neither is a number written here. Typing `18.5` into a
 *    step-1 dose was accepted by Slate and then silently rounded downstream.
 *
 * 8. ZERO IS A VALUE. `numpad-modal.js:535-545` maps a typed `0` to the empty
 *    string unless `min === 0`, a special case that exists because the old table had
 *    no way to say what zero MEANS. The port's rows carry `zeroMeans` and a `floor`,
 *    and `clamp()` snaps a value inside a hole to the nearer end, so `0` is simply
 *    the value the table says it is and the hack is dropped.
 *
 * ------------------------------------------------------------------------------
 * API
 * ------------------------------------------------------------------------------
 *
 *   <ui-numeric-keypad
 *       heading="Dose in"          the dialog's heading AND its accessible name (#16)
 *       limit-key="dose"           a key of the port's table — LIMIT_KEYS
 *       unit="g"                   presentation only; the screen owns °C/°F
 *       value="18"                 the value being edited
 *       .limits=${answer.value}    the R2 table — the ONLY route to a derived bound
 *       .band=${displayBand}       the DISPLAY band, when the caller holds one
 *       .previous=${['18', '20']}  recent values, up to four
 *       open></ui-numeric-keypad>
 *
 *   `.band` is `{min, max, step, decimals, label, clamp}` — the same band the caller's
 *   stepper is drawing, still derived from the ONE table (`boundsFor()` in
 *   `settings-leaf-model.js`, `numpadBandFor()` in `live-targets.js`). It wins over the
 *   `limits` + `limit-key` pair, which stays as the fallback for callers that hold no
 *   converted band. Read `range` below for what each field is for and why the property
 *   exists at all.
 *
 *   show({invoker, reason}) / hide(reason) / requestClose(reason)   forwarded to #18
 *   confirm(reason) / cancel(reason)
 *   events: `confirm` {value, raw, limitKey} CANCELLABLE (preventDefault keeps it
 *           open for an async write), `cancel` {reason}, both bubbling and composed
 *   theming: `--_ui-numpad-inline` re-points the card width (default 820px, the
 *           oracle's own container width)
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   - No `keydown` handler of any kind. Escape belongs to #18's stack (Appendix 13),
 *     and a second handler is exactly the "two dialogs close on one gesture" bug
 *     that ownership was invented to stop.
 *   - No storage. Slate's numpad wrote its own previous-values list to a KV
 *     namespace (`numpad-modal.js:31-49`). Persistence is a screen's business and
 *     goes through `src/stores/`; `previous` arrives as a property.
 *   - No unit conversion. `unit` is a string the screen supplies from the units
 *     store, because the °C/°F choice is a setting, not a keypad behaviour. `.band`
 *     does not change that: it arrives ALREADY CONVERTED, and this file still does no
 *     arithmetic on a unit it cannot see.
 *   - No `@media (width…)`; the one carried breakpoint is a container query on this
 *     component's own body box (spec §4.6).
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { seams } from 'src/components/seams.js';
import { I18nController } from 'src/lib/i18n.js';
import { SHEET_HEADING_LEVELS, DEFAULT_LEVEL } from 'src/components/ui-sheet-header.js';
import { hasLimit, clamp, numpadRange } from 'src/lib/machine-limits.js';
import 'src/components/ui-dialog.js';
import 'src/components/ui-button.js';
import 'src/components/ui-keycap.js';

/**
 * The pad, in reading order, exactly as the oracle photographed it — three columns,
 * four rows, 1..9 then decimal / 0 / backspace.
 * CITE modal-numpad .numpad-modal-numpad-btn [i=175] text "1" rect x=1000 y=416,
 *      [i=176] "2" x=1119, [i=177] "3" x=1238, [i=178] "4" y=516 …
 * `kind` is what the press does; `glyph` is what the face shows.
 */
const PAD = Object.freeze([
    Object.freeze({ id: '1', kind: 'digit', glyph: '1' }),
    Object.freeze({ id: '2', kind: 'digit', glyph: '2' }),
    Object.freeze({ id: '3', kind: 'digit', glyph: '3' }),
    Object.freeze({ id: '4', kind: 'digit', glyph: '4' }),
    Object.freeze({ id: '5', kind: 'digit', glyph: '5' }),
    Object.freeze({ id: '6', kind: 'digit', glyph: '6' }),
    Object.freeze({ id: '7', kind: 'digit', glyph: '7' }),
    Object.freeze({ id: '8', kind: 'digit', glyph: '8' }),
    Object.freeze({ id: '9', kind: 'digit', glyph: '9' }),
    Object.freeze({ id: 'decimal', kind: 'decimal', glyph: '.' }),
    Object.freeze({ id: '0', kind: 'digit', glyph: '0' }),
    /* U+232B ERASE TO THE LEFT. The glyph reads as nothing to a screen reader, which
     * is half of O9; the name is on the button, which is the pressable. */
    Object.freeze({ id: 'backspace', kind: 'backspace', glyph: '⌫' }),
]);

/** Up to four recent values, two rows of two — `numpad-modal.js:356-358`. */
const PREVIOUS_SHOWN = 4;

/** The empty buffer. Backspacing past the last character lands here, not on ''. */
const EMPTY = '0';

/**
 * How many characters the buffer may hold, derived from the range the port declares
 * so the typed path cannot disagree with the clamp. Slate hard-coded five for every
 * field (`numpad-modal.js:300`), which let 999.9 be typed into a 120 g dose.
 *
 * THE PRECISION IS THE BAND'S WHEN THE BAND STATES ONE. A converted band's step is not
 * its precision: 1 °C converts to 1.8 °F, and inferring "one decimal" from that would let
 * a tenth be typed into a band whose every reachable value is a whole machine degree.
 * `decimals` is what the caller was told by `machine-limits.js` via `displayRange`; the
 * step is the fallback for the raw table rows, where the two are the same number.
 */
function bufferLimit(range) {
    const decimals = Number.isFinite(range.decimals)
        ? range.decimals
        : (String(range.step).split('.')[1]?.length ?? 0);
    const whole = String(Math.trunc(Math.abs(range.max))).length;
    return Math.max(1, whole + decimals);
}

export class UiNumericKeypad extends UiElement {
    static properties = {
        /** Reflected: the gallery declares an open keypad in static markup, and a
         *  screen styles around one. Mirrored from the shell in #onOpenChange. */
        open: { type: Boolean, reflect: true },
        /** The field name. #18's `heading` and its accessible name — see O10. */
        heading: { type: String },
        /** A key of the port's table (`LIMIT_KEYS`). No row → unavailable. */
        limitKey: { type: String, attribute: 'limit-key' },
        /** The frozen table from `capabilitiesStore.machineLimits().value`.
         *  A property, never an attribute: a table is not a string, and an
         *  attribute would be an invitation to write one out by hand. */
        limits: { attribute: false },
        /**
         * THE DISPLAY BAND, TOLD RATHER THAN DERIVED. See the block comment on `range`
         * below for why this exists and what it must contain. A property for the same
         * reason `limits` is one: it carries a function.
         */
        band: { attribute: false },
        /** The value being edited, as the screen holds it. */
        value: { type: String },
        /** Presentation only. The screen owns which unit that is. */
        unit: { type: String },
        /** Recent values. Plain strings; the screen owns where they came from. */
        previous: { attribute: false },
        /** 1..6 for the heading element #16 renders. */
        level: { type: Number, reflect: true },
        /** The entry buffer. Internal — a screen reads `value` on confirm. */
        _buffer: { state: true },
        /** True until the first keypress, so the first digit REPLACES rather than
         *  appends (`numpad-modal.js:296-299`). Internal. */
        _fresh: { state: true },
    };

    static styles = [seams, typeRoles, css`
        /* ---------------------------------------------------------------
         * THE HOST HAS NO BOX — #18's reason, word for word: "a host with the base's
         * display: block would leave a full-width, zero-height block in the middle of
         * somebody's grid — an invisible row that moves their layout by one gap"
         * (ui-dialog.js:334-345). container-type follows it back to normal, because a
         * box that does not exist cannot be a container; the container everything in
         * here reads is .body, which is the dialog's own box (spec §4.6).
         * ------------------------------------------------------------- */
        :host {
            display: contents;
            container-type: normal;
        }

        /* The card width. ORACLE modal-numpad .numpad-modal-container [i=166]
         * rect w=820 — which is also #18's default, so this declaration exists for
         * the var() hook, not to change the number: a screen or the gallery narrows
         * the card with --_ui-numpad-inline and the container query below does the
         * rest. Same shape as #19's --_ui-confirm-inline. */
        ui-dialog {
            --_ui-dialog-inline: var(--_ui-numpad-inline, 820px);
        }

        /* THE CONTAINER, and the only one. spec §4.6 on Slate's single real
         * breakpoint: "numpad-modal.css:411 (max-width: 720px) and :428
         * (max-height: 650px and min-width: 721px) query the real window, which for a
         * top-layer dialog is the only query that means anything ... Carry that as a
         * container query on the dialog's own box." This element fills #18's body
         * cell, so its inline size IS the dialog's inner width.
         *
         * L24 LIVES HERE TOO. #18's body cell is the scroll region (overflow-y: auto,
         * which computes overflow-x to auto as well), so an OUTSET ring on anything at
         * an edge of this box is clipped on that side. CONVENTIONS §3 names this exact
         * remedy for a whole subtree — "a control inside an overflow: hidden parent
         * needs the ring drawn inside its own box, or it is clipped" — and setting it
         * here rather than on the pad alone catches the recent-value pills too. */
        .body {
            container-type: inline-size;
            display: block;
            --_ui-focus-offset: var(--ui-focus-offset-inset);
        }

        /* TWO COLUMNS WITH A RULE BETWEEN THEM, drawn as a gap over a ground — the
         * seam utility (CONVENTIONS §13), never a per-cell border. Slate draws it as
         * a 1px <div> (numpad-modal.css:227-231, width 1px, background
         * var(--slate-line)); one grid gap is the same line with no element.
         * The cells paint themselves, which is the utility's own escape from trap 1
         * ("a cell that paints nothing is a hole") — .seam-cell's --ui-fascia is the
         * PAGE ground and this is a raised card. */
        .layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 0.92fr);
            align-items: stretch;
        }

        .col {
            min-inline-size: 0;
            background-color: var(--ui-surface);
        }

        /* The rule needs air on both sides or it reads as a border on the content.
         * ORACLE gap 24px between the columns (numpad-modal.css:136) — carried as the
         * inset, since the gap itself is now the hairline. */
        .entry {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: var(--ui-space-3);
            padding-inline-end: var(--ui-space-5);
        }

        /* THE PAD COLUMN MAY NOT BE SQUEEZED BELOW ITS OWN KEYS.
         * ORACLE .numpad-modal-content grid-template-columns
         * minmax(0, 1fr) 1px minmax(320px, 0.92fr) — the right column has a FLOOR and
         * ours had none, so the readout's column took the width and the pad shrank to
         * fit whatever was left. The floor is stated as the pad's own arithmetic (three
         * keys and two gutters) rather than as Slate's rounded 320, so it stays true if
         * either token moves. */
        .pad-col {
            min-inline-size: calc(3 * (var(--ui-control-h) + var(--ui-space-5))
                + 2 * var(--ui-space-3));
            display: grid;
            align-content: center;
            padding-inline-start: var(--ui-space-5);
        }

        /* STACKED, under the carried breakpoint. Slate's window query is 720px; this
         * is the same question asked of the box that actually matters. At 584px the
         * pad's three 48px floors plus the gutters and both insets no longer leave a
         * readable entry column beside them. .layout.seam-cols is (0,2,0) so the row
         * gap has to be re-stated here to beat the utility's own row-gap: 0. */
        @container (max-width: 584px) {
            .layout {
                grid-template-columns: minmax(0, 1fr);
            }

            .layout.seam-cols {
                row-gap: var(--ui-seam);
            }

            .entry {
                padding-inline-end: 0;
                padding-block-end: var(--ui-space-5);
            }

            .pad-col {
                padding-inline-start: 0;
                padding-block-start: var(--ui-space-5);
            }
        }

        /* THE READOUT. A live region, and the size is a token — the two halves of O9
         * and O10 that this element owns.
         * ORACLE .numpad-modal-input-box [i=171] height 104px. Expressed as
         * control + 2 x space rather than carried as a measured constant, which is
         * spec Appendix 12's rule for every fixed dimension ("a size expressed as
         * control + 2 x space, not a measured constant"); 64 + 2 x 24 = 112. */
        .well {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--ui-space-1);
            block-size: calc(var(--ui-control-h) + 2 * var(--ui-space-5));
            padding-inline: var(--ui-space-3);
            border: var(--ui-border-w) solid var(--ui-line-strong);
            border-radius: var(--ui-radius);
            /* Departure 3: recessed in BOTH themes. */
            background-color: var(--ui-fascia);
            overflow: hidden;
        }

        /* ORACLE #numpad-display-value [i=173] font-size 42px <- var(--slate-display-md),
         * colour var(--slate-text) in both themes. .ui-numeric supplies the tabular
         * lining figures; nothing here is a literal. */
        .readout {
            color: var(--ui-text);
            font-size: var(--ui-display-md);
            /* Slate's own 300 — see departure 6, now closed for this element. */
            font-weight: var(--ui-weight-light);
            line-height: 1;
            white-space: nowrap;
        }

        /* ORACLE .numpad-unit-text (numpad-modal.css:219-225) colour
         * var(--slate-text-2), one step down in size from the readout. */
        .unit {
            color: var(--ui-text-2);
            font-size: var(--ui-text-lg);
            font-weight: var(--ui-weight-regular);
            line-height: 1;
        }

        /* The range, in the port's own words. .ui-caption is muted --ui-text-note. */
        .hint {
            text-align: center;
        }

        /* THE PREVIOUS-VALUE STRIP. Two rows of two (numpad-modal.js:356-358).
         * ORACLE .numpad-modal-previous-grid gap 9px / .numpad-previous-row gap 9px
         * — 8px is --ui-space-2, the nearest step on the scale (spec §3.2: the
         * spacing scale is the one source of gutters). */
        .previous {
            display: grid;
            gap: var(--ui-space-2);
        }

        /* .ui-microcap is a paint role and sets no margin, so the UA's own paragraph
         * margin would still be there. One rule, on the class, not on the id. */
        .prev-title {
            margin: 0;
        }

        .previous-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: var(--ui-space-2);
        }

        /* #1 is inline-grid by default; a pill in a 2-up grid fills its cell. */
        .previous-grid ui-button {
            display: grid;
        }

        /* THE PAD. 3 x 4 with a --ui-space-3 gutter, and the key width is the
         * column's 1fr share — Slate's own repeat(3, minmax(0, 1fr)).
         *
         * L24 LIVES HERE: #18's body cell is the scroll region (overflow-y: auto,
         * which computes overflow-x to auto as well), so an OUTSET ring on an edge
         * key is clipped on that side; the inset offset that fixes it is declared once
         * on .body above, for the whole scrolled subtree. */
        .pad {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: var(--ui-space-3);

            /* THE ROW HEIGHT WAS MISSING AND THAT IS WHY IT LOOKED WRONG (Ben, 24 Aug
             * 2026: "The numberpad modal is ugly compared to Slate, please make it look
             * the same").
             *
             * ORACLE .numpad-modal-numpad grid-template-rows repeat(4, 88px), and
             * .numpad-modal-numpad-btn min-height 88px (numpad-modal.css:296-305). With
             * no row sizing at all the keys collapsed to #11's own natural height — a
             * pad of squat keys under a full-height readout, which is the whole of what
             * Ben was looking at.
             *
             * EXPRESSED AS control + space, NOT AS 88 (Appendix 12: "a size expressed as
             * control + 2 x space, not a measured constant"). 64 + 24 = 88, the same
             * arithmetic the readout's own block-size uses one rule up. */
            grid-auto-rows: calc(var(--ui-control-h) + var(--ui-space-5));
        }

        /* Departure 2: the pressable. It paints NOTHING — #15 is the face — so it
         * declares only the geometry that makes the button box coincide with the
         * face, and the radius so the base's one ring follows the face's corners.
         * background-color: transparent rather than the background shorthand,
         * for the reason base.js documents as THE ONE TRAP. */
        .key {
            display: grid;
            margin: 0;
            padding: 0;
            border: 0;
            border-radius: var(--ui-radius);
            background-color: transparent;
            color: inherit;
            font: inherit;
            cursor: pointer;
        }

        /* THE ONE DECLARATION #15's REVERSAL NEEDS, now that its two additive lines
         * exist. Departure 1 above recorded the loss and named this as the fix.
         *
         * ORACLE .numpad-modal-numpad-btn min-height 88px, font-size
         * var(--slate-display-sm), font-weight 300 (numpad-modal.css:303-318). The
         * height is the same control + space arithmetic the row uses, so the face and
         * its cell cannot disagree; the weight is Slate's own light, which is what makes
         * a big digit read as a number rather than as a heading. */
        .key ui-keycap {
            --_ui-keycap-block: calc(var(--ui-control-h) + var(--ui-space-5));
            --_ui-keycap-size: var(--ui-display-sm);
            --_ui-keycap-weight: var(--ui-weight-light);
            inline-size: 100%;
        }

        /* THE UNAVAILABLE STATE — A7's absence, rendered as absence. No pad, no
         * invented ceiling, and the reason is on screen rather than in a console. */
        .unavailable {
            display: grid;
            gap: var(--ui-space-2);
            align-content: center;
            min-block-size: calc(var(--ui-control-h) + 2 * var(--ui-space-5));
            text-align: center;
        }
    `];

    /** Which outcome closed the dialog, so one dismissal reports exactly one event. */
    #outcome = null;

    constructor() {
        super();
        this.open = false;
        this.heading = '';
        this.limitKey = '';
        this.limits = null;
        this.band = null;
        this.value = '';
        this.unit = '';
        this.previous = [];
        this.level = DEFAULT_LEVEL;
        this._buffer = EMPTY;
        this._fresh = true;
        /** The element focus returns to. Not paint, so not reactive — #18 keeps its
         *  own the same way. */
        this.invoker = null;
        this.i18n = new I18nController(this);
    }

    /* ---- the composed parts -------------------------------------------------- */

    /** The #18 instance, so a screen or a test reads the machinery rather than
     *  inferring it. */
    get dialog() {
        return this.renderRoot?.querySelector?.('#dialog') ?? null;
    }

    /** The live region. */
    get display() {
        return this.renderRoot?.querySelector?.('#display') ?? null;
    }

    /* ---- the port, and nothing but the port ---------------------------------- */

    /**
     * ==========================================================================
     * THE DISPLAY BAND, TOLD RATHER THAN DERIVED — 27 August 2026
     * ==========================================================================
     *
     * THE DEFECT. This component derived everything it needed from `limits` and
     * `limit-key`, which is the RAW machine table and is always in the machine's own
     * units. The two screens that open it draw a CONVERTED band — the settings rows
     * and the Live rail both take `boundsFor()` / `displayRange()` and hand their
     * steppers a Fahrenheit face — so on a Fahrenheit tablet the stepper and the
     * keypad over it were reading two different bands. MEASURED on the settings
     * fixture, Machine › Steam, the `milkStopTemp` row: the keypad's own `range`
     * answered `{min: 30, max: 85}`, its hint read "30–85 °C" beside a well reading
     * °F, and typing 150 clamped to 85.
     *
     * THE CLAMP IS THE SERIOUS HALF. A wrong hint is a wrong sentence; a wrong clamp
     * is a wrong number on the machine. The settings screen's confirm handler puts
     * the value back through the model, and the model's `set()` converts display →
     * machine — so a typed 150 °F was first clamped against the CELSIUS band to 85
     * and then read as 85 °F, arriving at the machine as 29.4 °C. Wrong twice, in
     * opposite directions, with nothing on screen to say so.
     *
     * THE SAME GAP, IN MILLILITRES. `live-screen.js` names it in as many words: the
     * hint "reads the RAW R2 row and says '0–255 mL' under a weight stop while the
     * well beside it says g". One field, two words for it, and only the caller knows
     * which one is being drawn. It is the same defect and it takes the same fix.
     *
     * SO THE PORT IS TOLD, AND B2 IS UNTOUCHED. The band below is still DERIVED FROM
     * THE ONE TABLE — `boundsFor()` and `displayRange()` do nothing but put a
     * Fahrenheit face on `machine-limits.js`'s own row, and the clamp it carries
     * converts in, runs the machine's own hole-aware `clamp()` against the machine's
     * own numbers, and converts out. What changes is WHO holds the converted band:
     * the caller that already had it, instead of this file computing a second one it
     * has no way to convert.
     *
     * WHAT A BAND MUST CARRY, and every field is used:
     *
     *   min, max    the bounds IN THE DISPLAY UNIT — the buffer length is read off
     *               `max`, so a Fahrenheit band gets three digits where its Celsius
     *               face gets two.
     *   step        the display step. Only `decimals` is read off it as a fallback.
     *   decimals    how many decimals a typed value may carry, which is the MACHINE's
     *               precision and not the converted step's. See `bufferLimit`.
     *   label       the hint, in the unit being drawn, composed by `bandHint` in
     *               `machine-limits.js`. Never assembled here — that rule predates
     *               this property and is the reason the hint could be wrong but could
     *               not be wrong in two different ways.
     *   clamp       display in, display out. The one function that decides what a
     *               typed number becomes.
     *
     * AND THE OLD PATH IS THE FALLBACK, not a deleted branch. A caller with no
     * converted band — the profile editor, the gallery, every existing test — passes
     * `limits` and `limit-key` exactly as before and gets exactly what it got before.
     * A band is an addition to the contract, never a replacement for it.
     */

    /**
     * True when there is a band to type inside: one the caller declared, or one the
     * ONE table declares for this field. The whole gate.
     *
     * A BAND IS ONLY A BAND IF IT CAN CLAMP. A caller holding an UNBOUNDED row — the
     * settings model answers `{min: null, max: null, bounded: false, clamp: null}` for
     * a reading with no declared range — must not be able to turn A7's "this value
     * cannot be set yet" into a typeable well by handing over an object. `#usableBand`
     * is what decides, and it asks for the two things every branch below reads.
     */
    get ranged() {
        return Boolean(this.#usableBand) || hasLimit(this.limits, this.limitKey);
    }

    /** The caller's band, or null when there is nothing usable in what it passed. */
    get #usableBand() {
        const band = this.band;
        if (!band || typeof band !== 'object') return null;
        if (!Number.isFinite(band.min) || !Number.isFinite(band.max)) return null;
        if (typeof band.clamp !== 'function') return null;
        return band;
    }

    /**
     * The range as a numpad config — `{min, max, step, label}` — or null. Every
     * bound in the rendered output comes from here, and there is no other source.
     *
     * THE TOLD BAND WINS. It is the one in the unit the well is drawn in; the derived
     * one is the machine's own and is right only when the two happen to be the same.
     */
    get range() {
        const band = this.#usableBand;
        if (band) return band;
        return hasLimit(this.limits, this.limitKey)
            ? numpadRange(this.limits, this.limitKey)
            : null;
    }

    /** The port's own sentence for the range, including the hole when there is one
     *  ("0 (steam heater off) or 135–165"). Never assembled here. */
    get rangeText() {
        return this.range?.label ?? '';
    }

    /**
     * A decimal point is offered only where the declared step has one.
     *
     * `decimals` OUTRANKS THE STEP, and on a converted band it has to: 1 °C is 1.8 °F,
     * so a band every one of whose values is a whole machine degree would otherwise
     * look fractional and offer a decimal key that could only produce a value the
     * clamp would round away.
     */
    get decimalAllowed() {
        const range = this.range;
        if (!range) return false;
        if (Number.isFinite(range.decimals)) return range.decimals > 0;
        return !Number.isInteger(range.step);
    }

    /**
     * A NUMBER THE BAND DOES NOT ACCEPT IS REFUSED HERE, NOT SUBSTITUTED LATER.
     * (Audit F-021, 29 August 2026.)
     *
     * THE DEFECT. `clamped` below is the only thing that ever looked at the band on the way
     * out, and it CLAMPS: every out-of-band number confirmed as a different number, with the
     * readout showing what was typed right up to the press and the machine receiving
     * something else. On `steamTemp` that is not a cosmetic difference — the band has a hole
     * at the bottom, `clamp` snaps to the nearer end of it, and a typed 63 left as
     * `targetTemperature: 0`, which turns the steam heater OFF. Reproduced four times and
     * confirmed on the tablet: the server accepts and stores the 0.
     *
     * SO CONFIRM IS THE REFUSAL. The pad already prints the band it accepts, above the well
     * (`rangeText`); with the affirmative disabled while the buffer is outside it, the hint
     * stops being decoration and becomes the reason. Nothing is corrected on the user's
     * behalf and nothing is announced as accepted that was not typed.
     *
     * AND ONLY WHERE THE BAND ASKS FOR IT — `refuseOutside`, which `padBand` in
     * `machine-limits.js` sets on the one band shape that cannot be corrected. Clamping is
     * the contract everywhere else and it is kept: type 300 into a 0–255 volume and you get
     * 255, which is a correction a person can see in the result. A hole cannot be corrected
     * — the nearest legal value to 63 °C is 0, and 0 is not a colder steam temperature, it
     * is the heater off — so that band refuses and the rest do not. Whether every pad in
     * the skin should refuse instead of clamp is a decision about every control in it, and
     * it is Ben's; it is written up rather than taken here.
     *
     * WHAT THIS IS NOT. It is not a validity model and it does not clear the buffer — a
     * half-typed "1" on a 135–170 band is out of band and becomes legal at "135", so the
     * state has to be recomputed on every press and never latched.
     *
     * `clamp` STAYS, in both senses: this getter reads the BAND (what the pad offers) while
     * `clamped` reads the TABLE (what the wire will take), and the two are deliberately not
     * the same on a holed row. The clamp is the last defence for every path that does not
     * come through this pad.
     */
    get outOfBand() {
        const range = this.range;
        if (!range?.refuseOutside) return false;
        const typed = Number(this._buffer);
        /* A buffer that is not a number is not a REFUSAL, it is an absence — the empty
         * readout, mid-decimal "12.". Those already have their own answer below. */
        if (!Number.isFinite(typed)) return false;
        return typed < range.min || typed > range.max;
    }

    /** The typed string, clamped by the port. Null when there is no declared range,
     *  because there is nothing to clamp against and nothing to invent. */
    get clamped() {
        const band = this.#usableBand;
        if (band) return band.clamp(Number(this._buffer));
        if (!hasLimit(this.limits, this.limitKey)) return null;
        return clamp(this.limits, this.limitKey, Number(this._buffer));
    }

    /** Up to four, the way Slate showed them. */
    get shownPrevious() {
        return Array.isArray(this.previous) ? this.previous.slice(0, PREVIOUS_SHOWN) : [];
    }

    /* ---- the public surface -------------------------------------------------- */

    /** Open. Forwarded so #18 captures the restore target at open time. */
    show({ invoker = null, reason = 'api' } = {}) {
        if (invoker) this.invoker = invoker;
        const dialog = this.dialog;
        if (dialog) {
            dialog.show({ invoker: this.invoker, reason });
            return;
        }
        this.open = true;
    }

    hide(reason = 'api') {
        const dialog = this.dialog;
        if (dialog) dialog.hide(reason);
        else this.open = false;
    }

    /** ASK to close, cancellably. #18 owns the arbitration; this is the forward. */
    requestClose(reason = 'api') {
        return this.dialog?.requestClose(reason) ?? false;
    }

    /**
     * The affirmative outcome. Refused outright when the table declares no range for
     * this field: confirming would mean writing a number nothing bounded (A7).
     * `confirm` is CANCELLABLE so an async write can keep the dialog open.
     */
    confirm(reason = 'confirm') {
        /* AND REFUSED WHEN THE TYPED NUMBER IS OUTSIDE THE BAND THE PAD PRINTS — see
         * `outOfBand`. In code as well as in paint, so `useprevious`, the Enter key and an
         * `api` confirm cannot get past a disabled button. */
        if (!this.open || !this.ranged || this.outOfBand) return false;
        const allowed = this.dispatchEvent(new CustomEvent('confirm', {
            detail: { value: this.clamped, raw: this._buffer, limitKey: this.limitKey, reason },
            bubbles: true,
            composed: true,
            cancelable: true,
        }));
        if (!allowed) return false;
        this.#outcome = 'confirm';
        this.hide('confirm');
        return true;
    }

    /** Closing IS the cancel; the report is emitted from the one place that sees
     *  every dismissal, so Escape, the backdrop and this cannot disagree. */
    cancel(reason = 'cancel') {
        if (!this.open) return false;
        this.hide(reason);
        return true;
    }

    /* ---- entry --------------------------------------------------------------- */

    /**
     * One press. `kind` is the pad row's own verb, so the switch cannot drift from
     * the table that renders it.
     */
    press(id) {
        const key = PAD.find((k) => k.id === id);
        if (!key) return this._buffer;
        if (key.kind === 'backspace') return this.#backspace();
        if (key.kind === 'decimal') return this.#decimal();
        return this.#digit(key.glyph);
    }

    #digit(glyph) {
        const cap = this.range ? bufferLimit(this.range) : 0;
        if (this._fresh || this._buffer === EMPTY || this._buffer === '') {
            this._buffer = glyph;
            this._fresh = false;
        } else if (this._buffer.replace('.', '').length < cap) {
            this._buffer += glyph;
        }
        return this._buffer;
    }

    #decimal() {
        if (!this.decimalAllowed) return this._buffer;
        if (this._fresh) {
            this._buffer = `${EMPTY}.`;
            this._fresh = false;
        } else if (!this._buffer.includes('.')) {
            this._buffer += '.';
        }
        return this._buffer;
    }

    /** Backspacing past the last character lands on the empty buffer, never on a
     *  blank readout — `numpad-modal.js:320-329`. */
    #backspace() {
        this._fresh = false;
        const next = this._buffer.slice(0, -1);
        this._buffer = next === '' ? EMPTY : next;
        return this._buffer;
    }

    /** A recent value is a press and a confirm in one gesture, which is what made
     *  the strip worth having — `numpad-modal.js:331-338`. */
    useprevious(raw) {
        this._buffer = String(raw);
        this._fresh = false;
        this.confirm('previous');
    }

    /* ---- normalisation ------------------------------------------------------- */

    willUpdate(changed) {
        if (changed.has('level')) {
            const raw = Number.parseInt(this.level, 10);
            const next = SHEET_HEADING_LEVELS.includes(raw) ? raw : DEFAULT_LEVEL;
            if (next !== this.level) this.level = next;
        }
        /* Opening reloads the buffer from the value the screen holds, so a cancelled
         * edit leaves nothing behind and the next open starts from the truth. */
        if (changed.has('open') && this.open) this.#reset();
        if (changed.has('value') && !this.open) this.#reset();
    }

    #reset() {
        const incoming = String(this.value ?? '').trim();
        this._buffer = incoming === '' ? EMPTY : incoming;
        this._fresh = true;
    }

    /* ---- the one outcome path ------------------------------------------------ */

    #onOpenChange = (event) => {
        const { open, reason } = event.detail ?? {};
        this.open = open === true;
        if (open) { this.#outcome = null; return; }
        const outcome = this.#outcome;
        this.#outcome = null;
        if (outcome === 'confirm') return;
        this.dispatchEvent(new CustomEvent('cancel', {
            detail: { reason: reason ?? 'api' },
            bubbles: true,
            composed: true,
        }));
    };

    #onKeyPress = (event) => {
        const id = event.currentTarget?.dataset?.key;
        if (id) this.press(id);
    };

    #onPreviousPress = (event) => {
        const raw = event.currentTarget?.dataset?.value;
        if (raw !== undefined) this.useprevious(raw);
    };

    #onConfirmPress = () => { this.confirm('press'); };

    #onCancelPress = () => { this.cancel('press'); };

    /* ---- render --------------------------------------------------------------- */

    /**
     * O9's second half. `role="status"` + `aria-live="polite"` + `aria-atomic="true"`
     * on the readout, and the text set by Lit rather than by `innerHTML`, so every
     * press is announced as one value. The name comes from the dialog heading, which
     * is why the region itself carries none.
     */
    #renderWell() {
        return html`<div id="well" class="well"
            ><span id="display" class="display readout ui-numeric"
                role="status" aria-live="polite" aria-atomic="true"
                aria-invalid=${this.outOfBand ? 'true' : nothing}
                >${this._buffer}</span
            >${this.unit
                ? html`<span id="unit" class="unit">${this.unit}</span>`
                : nothing}</div>`;
    }

    /**
     * The pad. `disabled` is the real attribute (refusal), and the base dims it
     * through `--ui-opacity-disabled` — one dial, not a second look.
     *
     * O9's first half: the backspace button carries `aria-label`, so the face's
     * glyph never has to be the name. Its glyph is `aria-hidden` on the face through
     * #15's own `label` affordance, which is the reason that property exists
     * ("Recorded for Wave 4: the numpad's unnamed backspace is bug O9, and this is
     * the affordance that retires it there").
     */
    #renderPad() {
        const off = !this.decimalAllowed;
        return html`<div id="pad" class="pad"
            >${PAD.map((key) => {
                const isDecimal = key.kind === 'decimal';
                const name = key.kind === 'backspace' ? this.i18n.t('Backspace') : '';
                return html`<button
                    id=${`key-${key.id}`}
                    class="key"
                    type="button"
                    data-key=${key.id}
                    aria-label=${name || nothing}
                    ?disabled=${isDecimal && off}
                    @click=${this.#onKeyPress}
                    ><ui-keycap label=${name || nothing}
                        >${key.glyph}</ui-keycap
                    ></button>`;
            })}</div
        >`;
    }

    /** Up to four recent values, two rows of two. Each is a #1 button. */
    #renderPrevious() {
        const values = this.shownPrevious;
        if (values.length === 0) return nothing;
        return html`<div id="previous" class="previous"
            ><p id="previous-title" class="prev-title ui-microcap"
                >${this.i18n.t('Previous values')}</p
            ><div id="previous-grid" class="previous-grid">${values.map((raw, i) => html`<ui-button
                id=${`previous-${i}`}
                data-value=${String(raw)}
                @click=${this.#onPreviousPress}
                >${String(raw)}</ui-button>`)}</div></div>`;
    }

    /**
     * A7 on screen. No range declared for this field means the machine class has not
     * arrived (`known === false`), and a keypad with no bounds has nothing honest to
     * offer — so it says so instead of opening at some invented ceiling.
     */
    #renderUnavailable() {
        return html`<div id="unavailable" class="unavailable"
            ><p id="unavailable-title" class="ui-body"
                >${this.i18n.t('This value cannot be set yet.')}</p
            ><p id="unavailable-detail" class="ui-caption"
                >${this.i18n.t('The machine has not reported the limits for this setting.')}</p
            ></div>`;
    }

    /**
     * THE LINE BREAK BEFORE EACH `>` IS LOAD-BEARING FOR GATE D, not a style choice:
     * `scripts/gate-d.js:210` flags an interpolated template chunk containing a slash
     * and no newline as a route assembled from fragments, and a single-line Lit chunk
     * ending in a closing tag is exactly that shape (ui-dialog.js:1143-1148).
     *
     * CANCEL FIRST, the reading order Slate has too (`numpad-modal.js:179-180`:
     * #numpad-cancel then #numpad-confirm). That DOM order is the tab order and is
     * what #18 hands the caret on open.
     *
     * THE TWO BUTTONS SIT IN THE HEADER, NOT THE FOOTER. Slate puts them there —
     * `.numpad-modal-actions` is a child of `.numpad-modal-header`, top-right, beside
     * the title — and rendered side by side on 24 August the footer was the one
     * remaining shape difference between the two cards. #16 names this exact shape as
     * supported (`ui-sheet-header.js:272-273` shows a Cancel and a primary Confirm in
     * its own `trail` slot), and #18 forwards `header-trail` into it, so this is the
     * documented route and not a hole cut for one caller.
     *
     * #18's footer disappears on its own: `_hasActions` is a slotchange flag, and an
     * `actions` slot with nothing assigned renders no footer row at all.
     *
     * THE RANGE READS ABOVE THE VALUE for the same reason — Slate's
     * `.numpad-modal-input-label` precedes `.numpad-modal-input-box`. A hint under the
     * readout reads as a result; above it, it reads as the instruction it is.
     */
    render() {
        const ranged = this.ranged;
        /* THE AFFIRMATIVE IS THE REFUSAL SURFACE (audit F-021). Disabled for the same two
         * reasons the pad has: nothing declares a band at all, or the buffer is outside the
         * one printed above the well. */
        const refused = !ranged || this.outOfBand;
        return html`<ui-dialog
            id="dialog"
            .open=${this.open}
            .heading=${this.heading ?? ''}
            .label=${this.heading ?? ''}
            .level=${this.level}
            @open-change=${this.#onOpenChange}
        ><div id="body" class="body" slot="body"
            ><div id="layout" class="layout seam-grid seam-cols seam-line"
                ><div id="entry" class="col entry"
                    ><p
                        id="hint" class="hint ui-caption"
                        >${this.rangeText}</p
                    >${ranged ? this.#renderWell() : this.#renderUnavailable()
                    }${this.#renderPrevious()}</div
                ><div id="pad-col" class="col pad-col"
                    >${ranged ? this.#renderPad() : nothing}</div
                ></div
            ></div
        ><ui-button id="cancel" slot="header-trail" @click=${this.#onCancelPress}
            >${this.i18n.t('Cancel')}</ui-button
        ><ui-button
            id="confirm"
            slot="header-trail"
            variant="primary"
            ?disabled=${refused}
            @click=${this.#onConfirmPress}
            >${this.i18n.t('Confirm')}</ui-button
        ></ui-dialog>`;
    }
}

customElements.define('ui-numeric-keypad', UiNumericKeypad);
