/**
 * ui-exit-sentence.js — component #41 of the 57-component inventory:
 * THE EXIT CHIP, WHICH IS NOW ONLY A SENTENCE.
 *
 * Wave 4, item #41, the editor compound group (SCOPE Part 4 Wave 4,
 * `scope/04-components.md:233`; SCOPE.md:1653):
 *
 *   "Exit chip / sentence | The step-exit condition rendered as a sentence with a
 *    remove ×; add-slot popover via #21. Per C8: build only the visible sentence,
 *    and re-provide the serialisation seam AS A PLAIN FUNCTION IN THE MODEL LAYER
 *    — deliberately, since dropping the hidden controls argues against a recorded
 *    decision. Unsatisfiable-exit warning from `exit-validity.js`, PORT-AS-IS."
 *
 * ===========================================================================
 * WHAT THIS COMPONENT IS, AND WHAT IT REFUSES TO BE
 * ===========================================================================
 * It is one band of a step column: three slots — Condition, Volume, Weight —
 * each either a SENTENCE with a remove × or an ADD SLOT. That is the whole
 * visible surface.
 *
 * It owns no dialog, no numpad and no menu machinery. The add-condition popover
 * is `<ui-menu>` (#21, wave 3) composed here; the numpad the value tap opens is
 * #53 inside #18's shell, and this component only says that it was tapped. Any
 * second modal machinery would be a wave block, and there is none here.
 *
 * THE HIDDEN CONTROL SET IS GONE — that is decision C8, and the model layer
 * (`src/lib/exit-sentence.js`) carries its replacement. Read that file's header
 * for the argument; what matters here is the consequence:
 *
 *   • the shadow tree contains exactly the controls that are on screen — two per
 *     occupied slot (sentence + remove), one per add slot, and nothing else;
 *   • nothing in it is `visibility: hidden`, `display: none` or `hidden`;
 *   • `serializeExitSlots(step)` answers everything the hidden DOM answered,
 *     before first paint and with no element mounted at all.
 *
 * `test/render/ui-exit-sentence.render.test.mjs` asserts all three mechanically.
 *
 * ===========================================================================
 * GATE 2 — ADDRESSING, AND WHY THIS COMPOUND TAKES PROPERTIES
 * ===========================================================================
 * Not one server key string appears in this file. The only server-shaped fact in
 * play — which exit types ReaPrime's model can express — is reached through the
 * address layer, `REA_EXIT_TYPES` (`src/data/rea-profile.js:69`), and it is
 * reached by the model module, not here.
 *
 * The step itself is EDITOR DRAFT STATE, not server data: it is the object the
 * screen is editing and has not saved. There is no draft store in wave 4 and
 * inventing one here would put a second owner beside the editor screen (wave 5,
 * `wf-w5p5-editor`), so the draft arrives as a property and every change leaves
 * as an event. The one capability this band gates on — may Power be offered as a
 * cross-variable exit — arrives already decoded, as a boolean, because the mask
 * lives behind R3 (`adapters-r.js:300`, `PROFILE_MODE_BIT.powerExit = 0x8`) and
 * `capabilities-store.js:390 profileModes()` is its one reader. A UI-OFFER HINT
 * ONLY; the authority is ReaPrime's arm-time 400 (B9).
 *
 * B2: not one min, max or step is authored here. Every bound the band knows comes
 * from `AUTHORING_RANGES` through the model module — the ONE table, unified by
 * wave 4's `port-profile-modes` (`CARRY_FORWARD.md` §3d: three disagreeing copies
 * before it).
 *
 * ===========================================================================
 * ORACLE — every appearance value below is one of these lines, quoted verbatim.
 * Queried mechanically with realine-run/tools/prov_query.py against
 * slate-audit-2026-08-16/prov-baseline (dark). The disqualification banner was
 * read first: geometry is Slate at 1920x1200 and is FROZEN, so the RATIOS are
 * carried and the container decides the rest (LAYOUT_SPEC_DRAFT.md governs
 * responsive behaviour; the oracle has no vote there).
 * ===========================================================================
 *
 * THE BAND, MEASURED. One state has it: editor-steps.
 *
 *   CITE  find --cls pe-chip-summary -> 6 element(s) in 1 state(s)
 *         editor-steps [236,868,274,64] [236,940,274,64] [668,868,274,64]
 *                      [668,940,274,64] [1100,841,274,64] [1100,967,274,64]
 *         distinct geometries: 274 x 64  x6
 *         text "Pressurerises past4.5 bar" / "Volumereaches100 mL"
 *              "Pressurefalls below2.2 bar" / "Flowfalls below0.0 mL/s"
 *   CITE  find --cls pe-chip-x -> 6 element(s) in 1 state(s)
 *         [518,868,64,64] ... distinct geometries: 64 x 64  x6   text "×"
 *   CITE  find --cls pe-empty-slot -> 3 element(s) in 1 state(s)
 *         [236,1012,346,64] [668,1012,346,64] [1100,1039,346,64]
 *         distinct geometries: 346 x 64  x3   text "+Weight"
 *   CITE  find --cls pe-exit-dead-note -> 1 element(s) in 1 state(s)
 *         [1100,913,346,42]
 *         text "never fires — cannot fall below zero · e"
 *
 * THE THREE NUMBERS THAT MATTER, and they are ratios, not a width:
 *   sentence 274 + GAP 8 (518 − 236 − 274) + remove 64 = 346, the add slot's own
 *   width. Row pitch 940 − 868 = 72 = 64 + 8, the same gap again. So the band is
 *   ONE COLUMN of --ui-control-h rows at a --ui-space-2 gap, and the sentence is
 *   whatever is left after the remove button — `minmax(0, 1fr) auto`. At a 346px
 *   container that lands on 274 / 8 / 64 exactly, which the suite asserts rather
 *   than assuming.
 *
 * THE SENTENCE'S FACE
 *   CITE  editor-steps .pe-chip-summary [i=161] background-color = rgb(26, 33, 39)
 *         <- profile-editor-v3.css `.pe-chip-summary` authored (NOT CAPTURED —
 *            set via a CSS shorthand) !important=no  (token-driven)
 *         => --ui-key, whose dark value is #1a2127 = rgb(26, 33, 39), EXACT.
 *            The authored token name is behind `background:` and is not citable;
 *            the computed value, the stylesheet, the selector and the
 *            "MOVED under token perturbation" verdict all are. Slate's source
 *            reads `background: var(--slate-key)` (profile-editor-v3.css:716).
 *   CITE  editor-steps .pe-chip-summary [i=161] color = rgb(186, 196, 202)
 *         <- profile-editor-v3.css `.pe-chip-summary` authored `var(--slate-text-2)`
 *            !important=no (token-driven)
 *         => --ui-text-2, dark #bac4ca = rgb(186, 196, 202), EXACT.
 *   CITE  editor-steps .pe-chip-summary [i=161] border-top-width = 1px
 *         => --ui-border-w (= --ui-hairline). Source: `border: 1px solid
 *            var(--slate-line)` (:714) -> --ui-line.
 *   CITE  editor-steps .pe-chip-summary [i=161] padding-left = 8px
 *         <- authored `8px` !important=no (FROZEN/hardcoded)  => --ui-space-2.
 *   CITE  editor-steps .pe-chip-x [i=160] border-top-left-radius = 6px
 *         => --ui-radius (6px, tokens.css:291). The SENTENCE's own radius is
 *            behind the `border-radius` shorthand and is NOT citable
 *            (prov_query shorthand carve-out); Slate's source is
 *            `border-radius: var(--slate-radius)` (:715), the same token.
 *
 * THE SENTENCE'S FOUR PARTS — subject, verb, number, unit
 *   CITE  editor-steps .pe-data-number [i=164] color = rgb(46, 194, 126)
 *         <- profile-editor-v3.css `.slate-profile-editor [data-tone="pressure"]
 *            .pe-data-number` authored `var(--slate-editor-pressure)`
 *         => #2ec27e = --ui-channel-pressure, EXACT. See DEPARTURE 1.
 *   CITE  editor-steps .pe-data-number [i=196] color = rgb(57, 123, 206)
 *         <- `[data-tone="flow"] .pe-data-number` authored `var(--slate-editor-flow)`
 *         => #397bce = --ui-channel-flow, EXACT.
 *   CITE  editor-steps .pe-data-number [i=170] color = rgb(176, 196, 206)
 *         <- `.pe-chip-summary .pe-data-number` authored `var(--pe-exit-tone)`
 *            (token-driven)  — this is the VOLUME row, which has no tone rule and
 *            falls back to the chip's default `--pe-exit-tone: var(--slate-steel)`
 *            (:700)  => --ui-steel, dark #b0c4ce = rgb(176, 196, 206), EXACT.
 *   CITE  editor-steps .pe-data-number [i=164] font-size = 16px
 *         <- `.pe-chip-summary .pe-data-number` authored `var(--slate-text-note)`
 *         => --ui-text-note (16px, tokens.css:353, "secondary notes beside a control").
 *   CITE  editor-steps .pe-data-number [i=164] font-weight = 300
 *         <- authored `300` !important=no (FROZEN/hardcoded)   => DEPARTURE 2.
 *   CITE  editor-steps .pe-data-unit [i=165] font-size = 15px
 *         <- `.pe-chip-summary .pe-data-unit` authored `var(--slate-text-cap)`
 *         => --ui-text-sm (15px, tokens.css:352), EXACT.
 *   CITE  editor-steps .pe-data-unit [i=165] color = rgb(148, 161, 169)
 *         <- authored `var(--slate-muted)`  => --ui-muted, dark #94a1a9, EXACT.
 *   CITE  editor-steps .pe-data-unit [i=165] font-weight = 400  => --ui-weight-regular.
 *   The subject and the verb are outside the corpus (`find --cls
 *   pe-chip-summary-direction` -> "0 elements matched anywhere in this corpus"),
 *   so they are a read-only source read, which the tool's carve-out sends you to:
 *   `.pe-chip-summary b { color: var(--pe-exit-tone); font-size: var(--slate-text-note);
 *    font-weight: 500 }` (:726-732) and `.pe-chip-summary span { font-size:
 *    var(--slate-text-cap); font-weight: 400 }` (:733-738), both with
 *   `overflow: hidden; text-overflow: ellipsis`.
 *
 * THE ADD SLOT
 *   CITE  editor-steps .pe-empty-slot [i=172] background-color = rgba(0, 0, 0, 0)
 *         <- `.pe-empty-slot, .pe-chip-add` authored `transparent` (FROZEN/hardcoded)
 *   CITE  editor-steps .pe-empty-slot [i=172] color = rgb(148, 161, 169)
 *         <- authored `var(--slate-muted)`  => --ui-muted, EXACT.
 *   CITE  editor-steps .pe-empty-slot [i=172] border-top-color =
 *         color(srgb 0.321569 0.380392 0.419608 / 0.58)  (token-driven)
 *         => rgb(82, 97, 107) at 58% = --ui-line-strong (dark #52616b) mixed with
 *            transparent. Slate's source is the same expression:
 *            `1px dashed color-mix(in srgb, var(--slate-line-strong) 58%,
 *            transparent)` (:832).
 *   CITE  editor-steps .pe-empty-slot [i=172] border-top-left-radius = 6px  => --ui-radius.
 *   CITE  editor-steps .pe-empty-slot [i=172] font-size = 16px
 *         <- authored `var(--slate-text-note)`  => --ui-text-note, EXACT.
 *   CITE  editor-steps .pe-empty-slot [i=172] padding-left = 12px
 *         <- authored `12px` (FROZEN/hardcoded)  => --ui-space-3, EXACT.
 *
 * THE DEAD-EXIT NOTE
 *   CITE  editor-steps .pe-exit-dead-note [i=198] color = rgb(229, 165, 14)
 *         <- profile-editor-v3.css `.slate-profile-editor .pe-exit-dead-note`
 *            authored `var(--slate-power)` !important=no (token-driven)
 *         => --ui-tint-power, dark #e5a50e = rgb(229, 165, 14), EXACT.
 *   CITE  editor-steps .pe-exit-dead-note [i=198] font-size = 14px
 *         <- authored `var(--slate-text-sm)` (token-driven)   => DEPARTURE 3.
 *
 * ===========================================================================
 * DELIBERATE DEPARTURES — five, each one line to reverse
 * ===========================================================================
 *  1. THE CHANNEL TONE COMES FROM THE CHART CHANNELS, NOT A PRIVATE NAMESPACE.
 *     Slate reaches its tone through `--slate-editor-pressure` and friends, which
 *     `styles/tokens.css:609-614` names as the editor's own fourth copy of the
 *     palette — the Live screen declares the first three — and which the oracle
 *     shows "resolving to the CHART palette's values, not this one" (:612-613).
 *     `styles/chart-channels.css:118-120` records the same `.pe-data-number`
 *     reading from the editor-review state (this file's is editor-steps, :120-123)
 *     and calls that private namespace "the same class of defect as bug L12".
 *     So the VALUE is carried exactly (#2ec27e / #397bce) and the private
 *     namespace is dropped: this file reads `--ui-channel-pressure` / `-flow` /
 *     `-power` directly. There is no `--ui-tint-pressure` for it to read instead
 *     — the tint family is flow / power / lever / heat — so inventing one would
 *     be a fifth palette, which is the thing being removed.
 *  2. WEIGHT 300 — CLOSED AT PARITY SURFACE 1. The type scale had three weights and
 *     300 was not one of them, so this read --ui-weight-regular (400); a fourth
 *     declared here would have been a per-component ladder, which is why it waited for
 *     the token layer. It did not wait for nothing: the three-weight line in
 *     LAYOUT_SPEC_DRAFT §3.5 is refuted by its own citation (slate-tokens.css:148-153
 *     declares --slate-weight-light: 300 "large numeric readouts only"), the sheet now
 *     ships it, and the number reads --ui-weight-light — Slate's own value, from the
 *     one ladder.
 *  3. THE NOTE TAKES --ui-text-note (16px), NOT Slate's 14. Decal's ladder has
 *     no 14px step; --ui-text-sm is 15 and is described as "uppercase microcaps",
 *     while --ui-text-note is described in the token sheet as "secondary notes
 *     beside a control" — which is what this is, by name. One step, and the
 *     warning gets slightly more legible rather than less.
 *  4. THE SENTENCE IS NOT ABSOLUTELY POSITIONED. Slate's summary is
 *     `position: absolute; top/right:72px/bottom/left:0; z-index: 2` (:701-706)
 *     laid over the controls it hides — the geometry is a consequence of the
 *     hidden set, and 72 is 64 + 8 spelled as a third number. With the hidden set
 *     gone the row is simply a two-column grid and 72 disappears with it.
 *  5. THE REMOVE BUTTON IS #2 (ui-icon-button), so its face is the library's:
 *     transparent, --ui-line border, --ui-radius — where Slate's × sat on
 *     --ui-key. Border and radius match the oracle exactly; the fill does not.
 *     Composing the primitive is the wave law, and one control with two faces is
 *     what the library exists to end. The × GLYPH keeps Slate's ink exactly,
 *     because the glyph is this component's own node:
 *     CITE editor-steps .pe-chip-x [i=160] color = color(srgb 0.811922 0.464784
 *     0.459451) <- `.pe-chip-x` authored `color-mix(in srgb, var(--slate-danger)
 *     72%, var(--slate-muted))` (token-driven) — reproduced on --ui-status-danger
 *     and --ui-muted, whose dark values give that exact triple.
 *
 * ===========================================================================
 * BUGS THIS COMPONENT CANNOT EXPRESS
 * ===========================================================================
 * E16 (spec §7.4, LAYOUT_SPEC_DRAFT.md:1167) — "The exit band can OVERFLOW ITS
 *   FIXED 280px TRACK: a dead-exit note is appended as an uncapped wrapping <p>
 *   into the chip list, and neither the cell nor `.pe-exit-cell` sets `overflow`,
 *   so the excess spills symmetrically into the rows above and below."
 *   (`profile_editor.js:1862-1863`; `profile-editor-v3.css:1450-1456`)
 *   Here the band has no fixed track at all: it is content-sized with a stated
 *   floor and a stated overflow (spec §2.4), and the note is a row of the same
 *   grid rather than a free child of a fixed-height box. The suite asserts the
 *   note's box stays inside the host's padding box at both geometries and at a
 *   narrow container, and that a squeezed band SCROLLS rather than clipping.
 *
 * E14 (spec §7.4, :1165) — "A11Y: … 32 grid ± buttons share two `aria-label`s,
 *   both UNTRANSLATED". The ± buttons are gone with the hidden set, and every
 *   remaining control here has a name that (a) names its own slot, so no two
 *   agree, and (b) goes through `src/lib/i18n.js` (D2), whose key is its own
 *   English text. The sentence button is deliberately NOT given an aria-label:
 *   its visible sentence IS its accessible name, which is what keeps voice
 *   control able to say what a user can read (Label in Name).
 *
 * E19's class (:1170) — `white-space: nowrap` with no overflow. The sentence is
 *   nowrap AND states `overflow: hidden` with `text-overflow: ellipsis` on the
 *   two parts that can grow, which is Slate's own summary rule (:726-738) and
 *   not its rail-label mistake.
 *
 * @fires exit-edit   - {detail:{slot, type, index, serialized}} the sentence was
 *                      pressed. The SCREEN decides what opens (the condition
 *                      dialog for a threshold, the numpad for a scalar); this
 *                      component owns no overlay. `serialized` is the C8 seam's
 *                      record for that slot, so the opener already has the bounds.
 * @fires exit-remove - {detail:{slot, type, index}} the × was pressed.
 * @fires exit-add    - {detail:{slot, type, index}} an add slot was chosen. For
 *                      the condition slot `type` is the menu item that was picked.
 * Composed and bubbling, all three: an editor screen listens at the matrix.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import {
    exitBand,
    exitTypeLabel,
    formatExitValue,
    serializeExitSlots,
} from 'src/lib/exit-sentence.js';
import 'src/components/ui-icon-button.js';
import 'src/components/ui-menu.js';

export class UiExitSentence extends UiElement {
    static properties = {
        /**
         * The profile step being edited — EDITOR DRAFT STATE, handed in whole.
         * `{pump, exit:{type,condition,value}, volume, weight, seconds}`. Never
         * mutated here: every change leaves as an event and the screen owns the
         * draft, which is what lets a foreign Power/Lever profile round-trip
         * unchanged (`profile_editor.js:1616-1618`, the render-harness pin).
         */
        step: { type: Object },
        /** Which step column this band belongs to. Travels on every event. */
        index: { type: Number },
        /**
         * May Power be offered as a cross-variable exit? Slate's two-gate
         * (`profileModesOffered && caps & bit3`) ALREADY ANDed by the screen —
         * see the Gate 2 note in the header. A hint, never an authority (B9).
         */
        powerExitOffered: { type: Boolean, attribute: 'power-exit-offered' },
        /** Paint dims (the base) and every control refuses. */
        disabled: { type: Boolean, reflect: true },
    };

    static styles = [
        /* Structural fragment first (CONVENTIONS §4). `typeRoles` is a default
         * layer — every rule in it is written to lose a tie — and it is here for
         * `.ui-numeric` (tabular figures on the value) and `.ui-caption` (the O5
         * note). No `visuallyHidden`: nothing in this component is icon-only, and
         * the one glyph that is — the × — takes its name from #2's `label`. */
        typeRoles,
        css`
            /* ---------------------------------------------------------------
             * THE BAND — a content-sized column with a floor and a stated
             * overflow, which is the whole of E16's fix.
             *
             * The base gives :host display:block + container-type:inline-size,
             * so every rule below resolves against THIS band's own width and
             * never the viewport (CONVENTIONS §2, spec §2.1 Rule 1). Nothing
             * here is keyed on a media query.
             * ------------------------------------------------------------- */
            :host {
                /* Spec §2.4's floor, named once and read by the band. One row is
                 * the honest minimum: a band with no room for a single slot is
                 * not a smaller band, it is a broken one. */
                --_ui-exit-floor: var(--ui-control-h);
                min-block-size: var(--_ui-exit-floor);
            }

            .band {
                display: grid;
                /* CITE row pitch 940 − 868 = 72 = 64 + 8, and the sentence-to-×
                 * gap 518 − 236 − 274 = 8. One gap, both axes. */
                /* A HOOK, DEFAULTING TO THE MEASURED 8. The oracle above is still the
                 * default and still right; what a caller can now say is that its own
                 * grid uses a different rhythm and this band should share it. The
                 * profile editor does exactly that - see --_ui-exit-gap there. */
                gap: var(--_ui-exit-gap, var(--ui-space-2));
                align-content: start;
                block-size: 100%;
                min-block-size: var(--_ui-exit-floor);
                /* STATED, and not hidden: "The old app's default answer
                 * everywhere but the numpad was hidden" (Part 8 §2). A band
                 * squeezed by its cell scrolls and shows it. */
                overflow-y: auto;

                /* ...and a stated overflow is a CLIPPER, which is bug L24's whole
                 * class: "focus rings clipped on all four sides by the components
                 * they sit inside". CONVENTIONS §3 names the one-line remedy and
                 * this is it — the ring is drawn INSIDE the control's own box, so
                 * the first and last rows keep a complete ring instead of losing
                 * their top and bottom edges to the scrollport. One treatment,
                 * two offsets; nothing here authors a second ring. */
                --_ui-focus-offset: var(--ui-focus-offset-inset);
            }

            /* ---------------------------------------------------------------
             * ONE SLOT ROW — sentence + remove, or one full-width add slot.
             *
             * CITE 274 + 8 + 64 = 346, the add slot's own measured width. So the
             * remove button is auto (it is 64 wide by its own floor) and the
             * sentence takes what is left. The 274 is a consequence at a 346px
             * container, never a declaration.
             * ------------------------------------------------------------- */
            .row {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                gap: var(--ui-space-2);
                align-items: center;
                min-block-size: var(--ui-control-h);

                /* The channel tone, defaulting to Slate's own default —
                 * "--pe-exit-tone: var(--slate-steel)" (:700), which the oracle
                 * confirms on the Volume row at rgb(176, 196, 206). Declared on
                 * the ROW so it inherits to exactly the parts that paint with it
                 * and no further (CONVENTIONS §4's --_ui-rest-shadow argument:
                 * set a private property on the element that draws, never on a
                 * wrapper). DEPARTURE 1 covers where the three values come from. */
                --_ui-exit-tone: var(--ui-steel);
            }
            .row[data-tone='pressure'] { --_ui-exit-tone: var(--ui-channel-pressure); }
            .row[data-tone='flow'] { --_ui-exit-tone: var(--ui-channel-flow); }
            .row[data-tone='power'] { --_ui-exit-tone: var(--ui-channel-power); }

            .row.add {
                grid-template-columns: minmax(0, 1fr);
            }

            /* ---------------------------------------------------------------
             * THE SENTENCE — the only edit entry point (O3, C8).
             * ------------------------------------------------------------- */
            .sentence {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: var(--ui-space-2);
                min-inline-size: 0;
                min-block-size: var(--ui-control-h);
                padding-inline: var(--ui-space-2);
                overflow: hidden;

                border: var(--ui-border-w) solid var(--ui-line);
                border-radius: var(--ui-radius);
                background-color: var(--ui-key);
                color: var(--ui-text-2);
                cursor: pointer;

                /* A button does NOT inherit type from its ancestors: the UA sheet
                 * gives every form control its own font and no preflight reaches
                 * inside a shadow root. Same reasoning as ui-icon-button.js:327. */
                font-family: inherit;
                font-size: var(--ui-text-note);
                text-align: center;
                white-space: nowrap;
            }

            .sentence:disabled {
                cursor: default;
            }

            /* The two halves. Both may ellipsise — Slate's own rule (:726-738),
             * and the half E19 got wrong elsewhere in the same sheet.
             *
             * DEPARTURE 4a: Slate's inner gap is 6px, three times
             * (profile-editor-v3.css:711, :764). 6 is not a step on this ladder
             * (--ui-space-1 4, --ui-space-2 8, tokens.css:264-271), and one gap
             * for the whole band — row pitch, sentence-to-×, and inside the
             * sentence — is one number instead of two. */
            .phrase,
            .value {
                display: flex;
                align-items: center;
                gap: var(--ui-space-2);
                min-inline-size: 0;
                overflow: hidden;
            }

            .subject {
                min-inline-size: 0;
                overflow: hidden;
                color: var(--_ui-exit-tone);
                font-size: var(--ui-text-note);
                font-weight: var(--ui-weight-medium);
                text-overflow: ellipsis;
            }

            .verb {
                min-inline-size: 0;
                overflow: hidden;
                font-size: var(--ui-text-sm);
                font-weight: var(--ui-weight-regular);
                text-overflow: ellipsis;
            }

            .number {
                color: var(--_ui-exit-tone);
                font-size: var(--ui-text-note);
                /* Slate's own 300, from the shared ladder — departure 2, now closed.
                 * CITE editor-steps .pe-data-number [i=164] font-weight = 300. */
                font-weight: var(--ui-weight-light);
            }

            .unit {
                color: var(--ui-muted);
                font-size: var(--ui-text-sm);
                font-weight: var(--ui-weight-regular);
            }

            /* ---------------------------------------------------------------
             * O5 — A PROVABLY UNSATISFIABLE EXIT
             *
             * The chip gets an outline and the note goes UNDER it, as a sibling.
             * Slate's reason is right and is kept (profile_editor.js:1764-1767):
             * "the chip is a fixed-height row in a grid, and a child that wraps to
             * a second line tears the card's layout apart." What is NOT kept is
             * the fixed 280px track it wrapped inside — that is E16.
             * ------------------------------------------------------------- */
            .row.dead .sentence {
                border-color: var(--ui-tint-power);
            }

            .note {
                color: var(--ui-tint-power);
                /* DEPARTURE 3: --ui-text-note, one step up from Slate's 14px. */
                font-size: var(--ui-text-note);
                /* The uncapped <p> of E16, capped: it wraps inside its own row
                 * instead of spilling into the rows above and below. */
                min-inline-size: 0;
                max-inline-size: 100%;
                overflow-wrap: break-word;
            }

            /* ---------------------------------------------------------------
             * THE ADD SLOTS — Appendix 9's "add-slots below".
             *
             * The class is .add-slot and NOT .add, deliberately: the row that
             * holds it carries the class row add, so the layout can tell an offer
             * from a set slot, and a bare .add selector paints the ROW as well as
             * the button. Measured cost of the collision before it was split: the
             * row inherited the button's 12px inline padding and 1px border, so
             * row-weight measured 346x66 against a 64px --ui-control-h and the
             * button inside it measured 320 rather than the oracle's 346
             * (CITE editor-steps .pe-empty-slot [i=172] 346 x 64). One class name,
             * two rendered defects.
             *
             * CONVENTIONS §9, learned again here: no backticks inside a css
             * template, comments included — one terminates the literal and the
             * syntax error points at a word in the prose.
             * ------------------------------------------------------------- */
            .add-slot {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: var(--ui-space-1);
                inline-size: 100%;
                min-block-size: var(--ui-control-h);
                padding-inline: var(--ui-space-3);

                border: var(--ui-border-w) dashed
                    color-mix(in srgb, var(--ui-line-strong) 58%, transparent);
                border-radius: var(--ui-radius);
                background-color: transparent;
                color: var(--ui-muted);
                cursor: pointer;

                font-family: inherit;
                font-size: var(--ui-text-note);
                font-weight: var(--ui-weight-medium);
                text-align: center;

                /* Re-stated here as well as on .band because #21's host is a
                 * custom element of its own: base.js declares
                 * --_ui-focus-offset on every :host, so <ui-menu> resets the
                 * band's inset value for everything inside it — including the
                 * trigger this component slots in, which is a LIGHT child of
                 * ui-menu and inherits from it. A declaration on the element
                 * that draws the ring is the only one that cannot be reset
                 * underneath (CONVENTIONS §4's --_ui-rest-shadow argument). */
                --_ui-focus-offset: var(--ui-focus-offset-inset);
            }

            .add-slot:disabled {
                cursor: default;
            }

            /* #21's host is inline-block and shrink-wraps its trigger. A slot row
             * is full width, so the host is told so from OUTSIDE — the shadow-host
             * precedence route CONVENTIONS §2 documents, no !important anywhere. */
            ui-menu {
                display: block;
                inline-size: 100%;
            }

            /* The × glyph is this component's own node, slotted into #2, so its
             * ink is this component's to state — and it is the oracle's exactly.
             * DEPARTURE 5 covers the face around it. */
            .glyph {
                color: color-mix(in srgb, var(--ui-status-danger) 72%, var(--ui-muted));
                font-size: var(--ui-text-lg);
                line-height: 1;
            }
        `,
    ];

    constructor() {
        super();
        this.step = null;
        this.index = 0;
        this.powerExitOffered = false;
        this.disabled = false;
        /* D2: the key IS its own English text (i18n/source/README.md), so an
         * untranslated build renders the same words Slate rendered. This is the
         * half of E14 that says "both UNTRANSLATED". */
        this.i18n = new I18nController(this);
    }

    /** The three slots, from the ONE table. Recomputed per render; pure. */
    get band() {
        return exitBand(this.step, { powerExitOffered: this.powerExitOffered });
    }

    /**
     * THE C8 SEAM, reachable from the element for convenience — it delegates and
     * owns nothing. The function is the seam; this is a shortcut for a consumer
     * that already has the element in hand.
     */
    serialize() {
        return serializeExitSlots(this.step, { powerExitOffered: this.powerExitOffered });
    }

    #emit(type, detail) {
        this.dispatchEvent(new CustomEvent(type, {
            detail: { index: this.index, ...detail },
            bubbles: true,
            composed: true,
        }));
    }

    #onEdit(slot) {
        const serialized = this.serialize().find((record) => record.slot === slot.slot) ?? null;
        this.#emit('exit-edit', { slot: slot.slot, type: slot.type, serialized });
    }

    #onRemove(slot) {
        this.#emit('exit-remove', { slot: slot.slot, type: slot.type });
    }

    #onAdd(slot, type) {
        this.#emit('exit-add', { slot: slot.slot, type });
    }

    render() {
        const band = this.band;
        /* APPENDIX 9, verbatim: "The exit band's stable three slots — Condition,
         * Volume, Weight, OCCUPIED FIRST AND ADD-SLOTS BELOW — so the band never
         * changes height" (LAYOUT_SPEC_DRAFT.md:1414). The model returns them in
         * slot order; the partition is the layout half, and it lives here. */
        const occupied = band.filter((slot) => slot.occupied);
        const offered = band.filter(
            (slot) => !slot.occupied && (slot.slot !== 'condition' || slot.choices.length > 0),
        );

        return html`
            <div id="band" class="band">
                ${occupied.map((slot) => this.#renderOccupied(slot))}
                ${offered.map((slot) => this.#renderOffered(slot))}
            </div>
        `;
    }

    #renderOccupied(slot) {
        const t = this.i18n.t;
        const text = formatExitValue(slot.value, slot.step);
        return html`
            <div
                id="row-${slot.slot}"
                class="row ${slot.dead ? 'dead' : ''}"
                data-tone=${slot.type}
            >
                <button
                    id="sentence-${slot.slot}"
                    class="sentence"
                    type="button"
                    ?disabled=${this.disabled}
                    title=${slot.deadReason ? t(slot.deadReason) : nothing}
                    @click=${() => this.#onEdit(slot)}
                ><span class="phrase"
                    ><b class="subject">${t(slot.subject)}</b
                    ><span class="verb">${t(slot.verb)}</span
                ></span><span class="value ui-numeric"
                    ><span class="number">${text}</span
                    ><span class="unit">${slot.unit}</span
                ></span></button>
                <ui-icon-button
                    id="remove-${slot.slot}"
                    class="remove"
                    label=${`${t('Remove')} ${t(slot.subject)}`}
                    focus-ring="inset"
                    ?disabled=${this.disabled}
                    @click=${() => this.#onRemove(slot)}
                ><span class="glyph" aria-hidden="true">&times;</span></ui-icon-button>
            </div>
            ${slot.dead ? html`
                <p id="note-${slot.slot}" class="note ui-caption">
                    ${t(slot.deadReason)}${slot.note ? ` · ${t(slot.note)}` : ''}
                </p>
            ` : nothing}
        `;
    }

    #renderOffered(slot) {
        const t = this.i18n.t;
        /* The Condition slot opens a MENU because its legal cross-variable
         * choices depend on the active pump and on a capability bit; a scalar
         * slot seeds directly (`profile_editor.js:1916-1919`). The menu is #21,
         * composed — there is no second popover machinery in this file. */
        if (slot.slot === 'condition') {
            return html`
                <div id="row-${slot.slot}" class="row add">
                    <ui-menu
                        id="menu-${slot.slot}"
                        label=${t('Add exit condition')}
                        .items=${slot.choices.map((type) => ({ id: type, label: t(exitTypeLabel(type)) }))}
                        ?disabled=${this.disabled}
                        @select=${(event) => { event.stopPropagation(); this.#onAdd(slot, event.detail.id); }}
                    >
                        <button
                            id="add-${slot.slot}"
                            class="add-slot"
                            type="button"
                            slot="trigger"
                            ?disabled=${this.disabled}
                        >+ ${t('Condition')}</button>
                    </ui-menu>
                </div>
            `;
        }
        return html`
            <div id="row-${slot.slot}" class="row add">
                <button
                    id="add-${slot.slot}"
                    class="add-slot"
                    type="button"
                    ?disabled=${this.disabled}
                    @click=${() => this.#onAdd(slot, slot.type)}
                >+ ${t(slot.subject)}</button>
            </div>
        `;
    }
}

customElements.define('ui-exit-sentence', UiExitSentence);
