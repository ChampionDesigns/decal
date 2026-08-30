/**
 * ui-bank — Wave 2 item #3, the Segmented bank. THE selection component.
 *
 * Spec row (LAYOUT_SPEC_DRAFT.md §5.2 #3): "Segmented bank | `:348-424` — 41/24
 * uses | The one component with a real state model: `aria-pressed|selected|checked`
 * **or** `.is-selected`, seam via `box-shadow: inset` on the `+` sibling,
 * touch-panel `:hover` re-assertion. The right contract for a Lit component's
 * reflected properties."
 *
 * =========================================================================
 * WHY THIS FILE IS THE POINT OF THE REWRITE
 * =========================================================================
 *
 * `DECISIONS.md:244`: "One selection component, not thirteen. One 'selected'
 * treatment, not six." This is that one component. Every other selection surface
 * in the inventory is a use of it or a thin composition over it — #32 tab bar
 * takes its paint from here, #36 favourites bank is this plus #35, #37 preset bank
 * is a use of this, #39's wizard chips and the selected states of #24 / #25 / #52
 * are this component's dials — and none of them may own a private "selected" look
 * (SCOPE Part 4, the founding-defect callout).
 *
 * The enforcement is not a convention. It is the shadow boundary: the paint lives
 * on `.item` inside this root, a screen cannot reach it, and the only way in is the
 * four dials (A6, A8; `DECISIONS.md:171-175`). Deliberately NO `::part()` and no
 * exportparts anywhere below — a part is a hole in exactly the wall this component
 * exists to be.
 *
 * THREE BUGS DIE HERE, and each one dies structurally rather than by being fixed:
 *
 *   L8 (§7.2)  "The favourites bank and `#dye-strip` are two hand-built copies of
 *              `.slate-bank`, while the expanded tabs use the real one — so
 *              re-skinning selection changes the tabs and leaves the favourites
 *              alone, bypassing all four `--slate-selected-*` dials."
 *              → There is one implementation. A favourites bank, a dye strip and a
 *                tab bank are three USES of it in three aria spellings, and one
 *                turn of --ui-selected-face moves all three. There is no second
 *                copy to fall out of step, because writing one would mean writing a
 *                second custom element and the wave forbids it.
 *                CITE live-ready #profile-fav-nav [i=2] background-color =
 *                rgb(26, 33, 39)  <-  slate-live.css `#main-page #profile-fav-nav`
 *                — the copy agrees with the real component on the GROUND
 *                (--ui-key, the same value as .slate-bank) and diverges only on
 *                selection, which is exactly why the divergence went unnoticed.
 *
 *   E10 (§7.3) "Two competing segmented implementations with opposite selected
 *              treatments — a light steel block on Live, a dark seated slice in the
 *              editor — both bypassing the four selection dials; and the editor's
 *              win rests on a specificity tie broken only by `<link>` order."
 *              → A document sheet cannot reach `.item`. Load order stops being a
 *                mechanism, because there is nothing for a second sheet to tie
 *                WITH. The two looks the bug describes are both still reachable —
 *                Slate's solid block and the fork's seated slice — but only through
 *                the dials, and then both banks move together.
 *                SOURCE `profile-editor-v3.css:411-471` (read-only) is the second
 *                implementation in full: the same 64/62 geometry as the real bank,
 *                reached with thirteen !important declarations, a seam drawn as a
 *                ::before strip rather than an inset shadow, a private per-channel
 *                LED (`--pe-led`, re-pointed by `[data-val]`) and a resting ink of
 *                --slate-text-2 where the component sheet says --slate-muted. Two
 *                sheets, two answers to every one of those, and no mechanism that
 *                could have told them apart.
 *
 *   T5 (§7.5)  "The selected nav row still draws a 4px LED it is explicitly not
 *              supposed to, because the `box-shadow: none` that removes it is not
 *              `!important` and the component's is. The fork dial
 *              `--slate-selected-led` is bypassed entirely."
 *              → The LED is a length, not a rule. It is off because
 *                --ui-selected-led is 0px, and any scope may turn it off — :root, a
 *                screen, one instance's style attribute — with a value, never with
 *                a weight. Zero !important in this file (Gate C guard 3), so there
 *                is no fight to lose.
 *
 * =========================================================================
 * ORACLE (prov_query.py, prov-baseline = dark / prov-light = light)
 * =========================================================================
 *
 * DISQUALIFICATION CHECK FIRST (SCOPE Part 10 §4). The bank appears in the corpus
 * 14 times across 13 states, and NOT all of them may be quoted:
 *   - the THREE editor states (editor-steps / editor-settings / editor-review) are
 *     bug E10's subject — the editor's sheet repaints the selected tab with its own
 *     seated slice on a link-order tie. Their SELECTED paint is disqualified.
 *   - `expanded-charts` and `history-*` use the real component sheet, so they are
 *     the citable selected paint;
 *   - `expanded-charts`'s item PADDING is overridden at the call site
 *     (`#expanded-chart-overlay .slate-expanded-tabs .slate-bank-item`, 12px), so
 *     the padding is quoted from a settings bank instead, where the component's own
 *     rule wins.
 *   - all rects are FROZEN 1920x1200 geometry: quoted as what Slate does, never as
 *     a responsive target. LAYOUT_SPEC_DRAFT.md governs the container behaviour and
 *     the oracle has no vote there.
 *
 * THE BANK (the host below)
 *   CITE expanded-charts .slate-bank [i=163] background-color: dark rgb(26, 33, 39)
 *        / light rgb(248, 249, 249)   -> --ui-key   (#1a2127 / #f8f9f9, exact)
 *   CITE expanded-charts .slate-bank [i=163] border-top-color: dark rgb(58, 72, 82)
 *        / light rgb(203, 208, 211)   -> --ui-line  (#3a4852 / #cbd0d3, exact)
 *   CITE expanded-charts .slate-bank [i=163] border-top-width = 1px
 *                                    -> --ui-border-w (= --ui-hairline)
 *   CITE expanded-charts .slate-bank [i=163] border-top-left-radius = 6px
 *                                    -> --ui-radius
 *   SOURCE `slate-components.css:348-356` (read-only) for the three values the
 *   corpus records as "(NOT CAPTURED — set via a CSS shorthand)": the sheet writes
 *   "min-height: var(--slate-control-height); overflow: hidden; border:
 *   var(--slate-hairline) solid var(--slate-line); border-radius:
 *   var(--slate-radius); background: var(--slate-key)". The corpus carve-out says
 *   the token NAME behind a shorthand is not citable; the computed value, the
 *   stylesheet and the winning selector all are, and they agree with the source.
 *
 * THE ITEM
 *   CITE settings-connection-scale .slate-bank-item [i=45] padding-left = 18px  <-
 *        slate-components.css `.slate-bank-item`  !important=no  -> --ui-space-4
 *   CITE expanded-charts #expanded-tab-power [i=165] color: dark rgb(148, 161, 169)
 *        / light rgb(90, 101, 108)    -> --ui-muted (#94a1a9 / #5a656c, exact)
 *   CITE expanded-charts #expanded-tab-power [i=165] font-size = 17px
 *                                    -> --ui-text-base
 *   CITE expanded-charts #expanded-tab-power [i=165] font-weight = 400
 *                                    -> --ui-weight-regular
 *   CITE expanded-charts #expanded-tab-power [i=165] min-height = 62px
 *                                    -> --ui-control-inner, which IS
 *                                       calc(--ui-control-h - 2 * --ui-hairline)
 *                                       = 64 - 2 = 62. The bank's own floor is 64
 *                                       (--ui-control-h) and the settings banks
 *                                       measure exactly 64 outside / 62 inside;
 *                                       the 82/80 tab banks are a call-site height.
 *   CITE expanded-charts #expanded-tab-power [i=165] background-color =
 *        rgba(0, 0, 0, 0) in both themes  -> transparent, the bank's ground shows
 *
 * THE SEAM (the `+` sibling inset shadow, and the reason --_ui-rest-shadow exists)
 *   CITE expanded-charts #expanded-tab-power [i=165] box-shadow:
 *        dark  rgba(194, 208, 218, 0.17) 1px 0px 0px 0px inset
 *        light rgba(30, 42, 50, 0.11) 1px 0px 0px 0px inset
 *        <- slate-components.css `.slate-bank-item + .slate-bank-item`
 *        -> --ui-seam-ink at --ui-seam, exactly the two token values
 *           (rgb(194 208 218 / .17) dark, rgb(30 42 50 / .11) light).
 *
 * THE SELECTED PAINT — the two dials the corpus can see
 *   CITE expanded-charts #expanded-tab-flow [i=164] background-color: dark
 *        rgb(176, 196, 206) / light rgb(49, 92, 112)  <-  slate-components.css
 *        `.slate-bank-item[aria-pressed="true"], .slate-bank-item[aria-selected=
 *        "true"], .slate-bank-item[aria-checked="true"], .slate-bank-item
 *        .is-selected`  !important=no   -> --ui-selected-face = --ui-steel
 *   CITE expanded-charts #expanded-tab-flow [i=164] color: dark rgb(18, 24, 28) /
 *        light rgb(248, 252, 253)  <- the same rule, authored
 *        `var(--slate-selected-ink)`  !important=no  -> --ui-selected-ink
 *   The other two dials are 0px and 0% in Slate, so no rendered value can prove
 *   them; the suite proves them by moving them, which is the only honest form
 *   (test/harness/assertions.js assertOneSelectionTreatment, case c).
 *
 * DELIBERATE DEPARTURE — THE SELECTED CELL DOES NOT GAIN WEIGHT, and this is the
 * one place the oracle is overruled on a value it can see. Slate's selected rule
 * also writes "font-weight: var(--slate-weight-medium)" (`slate-components.css:392`)
 * and the corpus records it, quoted verbatim:
 *   CITE expanded-charts #expanded-tab-flow [i=164] font-weight = 500  <-
 *        slate-components.css  `.slate-bank-item[aria-pressed="true"],
 *        .slate-bank-item[aria-selected="true"],
 *        .slate-bank-item[aria-checked="true"], .slate-bank-item.is-selected`
 *        authored `var(--slate-weight-medium)`  !important=no  (token-driven)
 * against the resting
 *   CITE expanded-charts #expanded-tab-power [i=165] font-weight = 400.
 *
 * IT IS NOT CARRIED. font-weight is untouched by all four dials, so a weight rule is
 * a selected look that SURVIVES retargeting every dial — which is the founding
 * defect's exact shape (SCOPE Part 10 §12: "no private 'selected' look anywhere in
 * the wave"), shipped by the one component the wave exists to make it inexpressible
 * in. The disqualification check settles the ladder: `DECISIONS.md:239` carries
 * forward "the four `--slate-selected-*` dials" and `:243` "One 'selected'
 * treatment, not six", and a decision beats every other source (prov_query.py's own
 * printed rule). A FIFTH DIAL, `--ui-selected-weight`, was the alternative and is
 * refused for the same reason: §3.9's table names FOUR, and a component may not take
 * a register decision on its own. #26 `ui-list-row` already made this exact call on
 * the same Slate declaration (`ui-list-row.js` departure 3, `slate-shell.css:310`,
 * asserted as a departure in its suite); two components in one wave may not rule
 * opposite ways on one property, and the rule that moves is this one.
 *
 * What is left is the whole treatment and nothing else: face, ink, LED, glow. Turn
 * all four off and a selected cell is indistinguishable from a resting one — which
 * is the property `test/render/ui-bank.render.test.mjs` §4 now measures, in all
 * three aria spellings, over every non-dial property ui-list-row watches.
 * Declared to the wave-2 ledger (region "ui-bank — the selected weight").
 *
 * =========================================================================
 * TOKEN-ONLY (Part 10 §12, wf-w2-state-controls)
 * =========================================================================
 * No data layer, no store, no endpoint, no import from src/data/ or src/stores/.
 * `items` and `value` arrive from outside and `change` leaves; whoever owns the
 * data owns the list. A primitive that "needs" server data is a design error to
 * flag, not to satisfy.
 *
 * @fires change - {detail: {value, index}}, composed and bubbling, only on a user
 *                 choice that actually changes the value. Not fired for a
 *                 programmatic `el.value = x`, which is the native contract.
 */

import { css, html, nothing } from 'lit';

import { UiElement, selectionSurface } from 'src/components/base.js';
import { bindPressHold } from 'src/lib/press-hold.js';

/**
 * THE THREE ARIA SPELLINGS, ONE TREATMENT — spec Appendix 15, carrying
 * `slate-components.css:389-392`: "the aria-*-driven state selectors on
 * `.slate-bank` / `.slate-stepper` — the right contract for a Lit component's
 * reflected properties".
 *
 * Slate's own banks are all three shapes at once, measured:
 *   role="tab"    #editor-tab-0, #expanded-tab-flow, #hv-tab-flow   (aria-selected)
 *   role="radio"  settings-connection-scale [i=45..47]              (aria-checked)
 *   no role       settings-accessories-lighting [i=41..43, 46..47]  (aria-pressed)
 * The accessibility answer differs per shape and the PAINT does not: all three
 * spellings land on the same `selectionSurface` selector list. That is the whole
 * argument of Appendix 15 — accessibility state and visual state are one state, so
 * they cannot drift.
 */
const MODES = {
    radio: { host: 'radiogroup', item: 'radio', state: 'aria-checked' },
    tablist: { host: 'tablist', item: 'tab', state: 'aria-selected' },
    toolbar: { host: 'group', item: null, state: 'aria-pressed' },
};

const DEFAULT_MODE = 'radio';

/** Strings or objects in, one shape out. */
function normaliseItem(raw, index) {
    if (raw !== null && typeof raw === 'object') {
        const value = String(raw.value ?? raw.label ?? index);
        return {
            value,
            label: String(raw.label ?? raw.value ?? ''),
            disabled: raw.disabled === true,
            controls: raw.controls ? String(raw.controls) : null,
        };
    }
    const value = String(raw);
    return { value, label: value, disabled: false, controls: null };
}

export class UiBank extends UiElement {
    static properties = {
        /**
         * The choices. Strings, or `{ value, label, disabled, controls }` objects.
         * Parsed from a JSON attribute so the gallery can state one in markup.
         *
         * NOT a data source (see the header). `controls` is the id of the panel a
         * tab owns, which is the half of bug L23 — "tabs with no tabpanels and no
         * aria-controls" — that a component can carry; the panel itself belongs to
         * whoever laid the screen out.
         */
        items: { type: Array },

        /** The chosen item's value. Reflected: it is the state, and tests read it. */
        value: { type: String, reflect: true },

        /**
         * `radio` (default) | `tablist` | `toolbar` — which of the three aria
         * spellings this bank speaks. It changes the roles and the state attribute
         * and NOTHING about the paint, which is the point.
         */
        mode: { type: String, reflect: true },

        /** Accessible name for the GROUP, put on the host as `aria-label`. */
        label: { type: String },

        /**
         * `regular` (default) | `compact` — how much room a cell gives to its inset.
         *
         * THE ONE THING IT MOVES IS THE ITEM'S INLINE PADDING, and it exists because
         * a bank with a DEFINITE width divides that width equally whatever its labels
         * need: finding cmp-lo-2 is the Live rail's mode bank at 1920, four equal
         * 105.5px cells whose 2 × 18px inset leaves 69.5px for a 76.38px "Hot water",
         * so two of the four default labels ellipsised at rest. The row cannot widen
         * (Ben, 21 Aug 2026: the rail is --ui-rail-w and the bank already spans it),
         * so the inset is what gives — one step down the spacing scale, as a NAMED
         * state of this one component rather than a padding written at a call site
         * that no other bank would ever hear about.
         *
         * NOT --ui-density, and for the reason C3 records in tokens.css: a subtree
         * re-declaration of the multiplier cannot re-derive tokens already resolved
         * on :root. This names the value it wants, like `density="compact"` on #4.
         */
        density: { type: String, reflect: true },

        /**
         * OFFER A SECOND ACTION PER CELL: hold one, and the bank says which.
         *
         * OFF BY DEFAULT AND OPT-IN, because a hidden gesture on a control that has no
         * second action is a control that pauses for 600 ms and then does the ordinary
         * thing. Two banks in this skin have one — Slate holds a FAVOURITE to replace or
         * clear it (`profileManager.js:1040`) and a PRESET to re-cut it (`ui.js:1666`) —
         * and both reach it through this component rather than each binding pointers of
         * its own.
         *
         * WHAT IT DOES: dispatches `item-hold` with `{value, index}` at the threshold,
         * while the finger is still down, and swallows the click that the release would
         * otherwise produce. `change` is NOT fired for a held cell.
         */
        hold: { type: Boolean, reflect: true },

        /**
         * THE TOOLBAR FORM — --ui-control-lg instead of --ui-control-h, orthogonal to
         * `density`, exactly as <ui-button tall> is orthogonal to its variant.
         *
         * Slate names this size: `--slate-control-lg: 82px  / toolbar controls that
         * carry a whole screen /` (slate-tokens.css:32), and its Live header's
         * favourites strip is one — `#main-page #profile-fav-nav { height:
         * var(--slate-control-lg) }`, with its cells at 80.
         *   ORACLE live-ready #profile-fav-nav [i=2] rect=[120,18,1040,82], height =
         *          82px authored var(--slate-control-lg); #fav-profile-btn-0 [i=3]
         *          rect=[121,19,264,80], height 80 = 82 minus the two hairlines.
         * A NAMED STATE OF THIS COMPONENT, not a token re-declared at the call site:
         * a screen that wrote --ui-control-h on a subtree would be re-declaring a
         * public token (Gate C forbids it, and rightly — --ui-control-inner is derived
         * on :root and would not follow it anyway, so half the bank would move and
         * half would not). Both halves move here, from one attribute.
         */
        tall: { type: Boolean, reflect: true },

        /**
         * THE OTHER END OF THE SAME DIAL: a bank whose row is TEXT rather than a
         * control. Ben, 23 Aug 2026, on the Live rail's preset rows: "the presets for
         * Drink weight, Steam flow shouldn't be the normal toggle, but insted the same
         * look slate had with just numbers with line underneath highlighting what value
         * is selected."
         *
         * With the fill and the frame turned off, --ui-control-h reserves a control's
         * box around four numbers that no longer look like a control — and on the Live
         * rail those 16px twice over are what the section dividers needed to sit
         * between two rows instead of against the lower one.
         *
         * --ui-hit-min AND NOT SOMETHING SMALLER, because the cells are still pressable:
         * the floor that matters for a text row is the touch one, and that token IS it.
         * A NAMED STATE OF THIS COMPONENT for the same reason `tall` is one — both
         * halves move from one attribute, and a call site writing --ui-control-h on a
         * subtree would be re-declaring a public token, which Gate C forbids.
         */
        plain: { type: Boolean, reflect: true },

        /** Paint AND behaviour: the base dims the host, the buttons refuse input. */
        disabled: { type: Boolean, reflect: true },
    };

    static styles = [
        /* No `hitArea` import, and that is a decision rather than an omission
         * (CONVENTIONS §5, and ui-switch's identical note). An item's ink is its
         * own box: --ui-control-inner (62px) tall by construction, which clears the
         * 48px floor on the block axis with the paint alone, and on the inline axis
         * the items sit shoulder to shoulder, so an overlay could only grow into
         * its neighbour. Slate's preset bank reaches for the same escape hatch
         * (`slate-live.css:781-790` maxes the block axis only). The rendered box is
         * asserted against --ui-hit-min in the suite rather than assumed here.
         *
         * No `visuallyHidden` either: every item carries visible text or slotted
         * content, and the group's name is an aria-label on the host.
         *
         * `selectionSurface` is LAST, after the resting paint, because it has to
         * beat it (CONVENTIONS §4 rule 1). Everything below it is written to lose
         * that fight on purpose — see the specificity note on `.item:where(:hover)`
         * and the one on the seam. */
        css`
            /* ---------------------------------------------------------------
             * THE HOST IS THE BANK. One piece, one border, one radius.
             *
             * SOURCE slate-components.css:348-356 .slate-bank, oracle-confirmed
             * per value in the header. The host carries the group role, so the
             * accessible group and the painted box are the same element and a
             * screen can point aria-labelledby at a label in its own tree.
             * ------------------------------------------------------------- */
            :host {
                /* THE CELL'S INSET, NAMED ONCE so the compact state below moves it
                 * without a second padding declaration to keep in step.
                 * CITE settings-connection-scale .slate-bank-item [i=45]
                 * padding-left = 18px <- slate-components.css .slate-bank-item. */
                --_ui-item-inset: var(--ui-space-4);

                /* THE ROW HEIGHT AND THE CELL HEIGHT, NAMED ONCE, for the reason the
                 * inset above is named once: the tall state moves both from one place,
                 * and the derivation (a cell is the row minus its two hairlines) is
                 * written here rather than twice. */
                --_ui-bank-row: var(--ui-control-h);
                --_ui-bank-item: var(--ui-control-inner);

                /* Base gives display: block; a bank is a row of equal cells, and
                 * these three declarations are how "equal" is stated. See THE BANK
                 * SIZES ITSELF below for why they are grid and not a flex basis. */
                display: grid;
                grid-auto-flow: column;
                grid-auto-columns: 1fr;
                align-items: stretch;

                /* ---------------------------------------------------------------
                 * THE BANK SIZES ITSELF (DQ-692's alternative, taken 21 Aug 2026).
                 *
                 * CONVENTIONS 2: the base puts container-type: inline-size on every
                 * host, which applies inline-size CONTAINMENT - "the host's own
                 * inline size can no longer depend on its contents". That is right
                 * for anything that FILLS a slot, and this component used to leave
                 * it alone on exactly that argument. It is wrong for a bank asked
                 * for its own width, and three call sites had already been bitten:
                 * ui-time-picker (both readout banks collapsed to 2px, and the
                 * suite saw it as "clicking PM does not change the time"),
                 * ui-tab-bar (a three-tab bar rendered 2px in a 900px stage) and,
                 * undetected until the final review, EVERY bank in a settings row -
                 * the machine-steam stop-mode bank measured 2.00px wide with its
                 * three 36px items overflowing an overflow: hidden host, invisible
                 * AND dead to the touch (elementFromPoint at an item centre
                 * answered settings-leaf-pane, not the button). Two consumers had a
                 * hand-written cure each and the third had none, which is this
                 * file's founding defect in a different property.
                 *
                 * So the opt-out is stated ONCE, here, and a bank is intrinsically
                 * sized wherever it is put. There is no @container rule in this
                 * file to lose (see .label below) and no consumer's @container
                 * query resolves against a bank host, so nothing else changes.
                 *
                 * AND THE CELLS HAD TO BECOME COLUMNS FOR IT TO BE WORTH HAVING.
                 * Under a max-content constraint Chrome sizes a flex row at the SUM
                 * of its items' contributions, and a zero basis then hands each item
                 * the MEAN of the labels rather than the max - so every label wider
                 * than the mean ellipsised at EVERY width, under no space pressure
                 * at all (measured on the editor's tablist: 275.688 total, a 55.234
                 * box, Settings at 64.359 clipped). An fr track takes the LARGEST
                 * of its items' contributions and every track gets it, so the bank
                 * is n x (widest label + chrome) and each cell is equal. Under
                 * pressure nothing changes: .item's min-inline-size: 0 is still
                 * what lets a track shrink past its content, so a narrow container
                 * gets a bank that fits it with the labels ellipsising.
                 *
                 * A bank given a DEFINITE width divides it identically either way
                 * (both give (width - 2 x hairline) / n), which is why every sized
                 * consumer is unchanged by construction - and measured per suite
                 * rather than assumed.
                 * ------------------------------------------------------------- */
                container-type: normal;

                /* CITE expanded-charts .slate-bank [i=163] border-top-width = 1px,
                 * border-top-color dark rgb(58, 72, 82) / light rgb(203, 208, 211),
                 * border-top-left-radius = 6px. */
                border: var(--ui-border-w) solid var(--ui-line);
                border-radius: var(--ui-radius);

                /* CITE expanded-charts .slate-bank [i=163] background-color:
                 * dark rgb(26, 33, 39) / light rgb(248, 249, 249). */
                background-color: var(--ui-key);

                /* SOURCE slate-components.css:349 min-height:
                 * var(--slate-control-height). The settings banks measure exactly
                 * 64 outside / 62 inside; the 82px tab banks are a call-site
                 * height, so this is a FLOOR and not a size. The tall form names the
                 * other one Slate declares — see the tall property. */
                min-block-size: var(--_ui-bank-row);

                /* SOURCE slate-components.css:351 overflow: hidden — the radius has
                 * to clip a selected item's face at the two end corners, and there
                 * is nothing else in the box to hide, because the items shrink
                 * (an fr track with min-inline-size: 0) rather than overflow. This is
                 * NOT a hidden scroll region: spec §2.4's ban is on content
                 * silently removed, and the suite asserts scrollWidth never exceeds
                 * clientWidth at the narrow container.
                 *
                 * AND THEREFORE THE RING GOES INSIDE. Bug L24 / layout/live.md
                 * A11Y-5: "the expanded tabs inside .slate-bank { overflow:
                 * hidden } ... cut on all four sides. Hence the inset variant."
                 * Declared here for the whole component rather than asked of the
                 * consumer as focus-ring=inset, because a bank ALWAYS clips — a
                 * consumer who had to remember it is a consumer who will forget it.
                 * Custom properties inherit, so slotted item content gets the same
                 * offset (CONVENTIONS §3a). */
                overflow: hidden;
                --_ui-focus-offset: var(--ui-focus-offset-inset);
            }

            /* THE PACKED CELL (finding cmp-lo-2; Ben's ruling, 21 Aug 2026).
             *
             * BEN'S INSTRUCTION IS THE MECHANISM AND THE TRIGGER, IN HIS OWN TERMS:
             * "equal-at-widest is reached by TRIMMING CELL PADDING until the widest
             * default label fits its equal cell; MEASURED AT FIX TIME; add a
             * label-fits assertion ... If a future label outgrows even that, the
             * assertion catches it." It did catch it, at parity surface 1.
             *
             * TWO steps down the spacing scale, 18 -> 8, and the number is a
             * MEASUREMENT rather than a preference. It was 12 while the rail's
             * interior was 424: the widest default label in the skin's only pressured
             * bank is "Hot water" at 76.38px, its equal cell was 105.5px, so the inset
             * could be at most (105.5 - 76.38) / 2 = 14.56 and --ui-space-3 was the
             * largest step under it. Parity surface 1 put the rail on Slate's own
             * arithmetic (--ui-rail-w 430 with a 28px inset and an 18px gutter, so the
             * interior is 374, not 424), which makes the equal cell 93.0 and the
             * ceiling (93.0 - 76.38) / 2 = 8.31 — and --ui-space-2 is the largest step
             * under THAT. Measured after the change, at 1920: cell 93.0, inset 8, box
             * 77.0 against "Hot water" 76.38 and "Espresso" 70.75. Both fit; at 12 they
             * did not, which is what turned the label-fits assertion red.
             *
             * WHAT IT DOES NOT REACH: an intrinsically sized bank (the editor and
             * history tab bars) is n x (widest label + inset), so it was never
             * clipping and does not ask for this - it stays regular and its own
             * suite's width arithmetic is unchanged. Only a bank given a definite
             * width can be tighter than its own labels, and the Live rail's mode bank
             * is the only one in the skin.
             * ------------------------------------------------------------- */
            :host([density="compact"]) {
                --_ui-item-inset: var(--ui-space-2);
            }

            /* THE TALL FORM — see the tall property for Slate's own name for this
             * size and the oracle records. Both halves move together: the row takes
             * --ui-control-lg and the cell takes it minus the two hairlines, which is
             * the same arithmetic --ui-control-inner is, at the other height. */
            :host([tall]) {
                --_ui-bank-row: var(--ui-control-lg);
                --_ui-bank-item: calc(var(--ui-control-lg) - 2 * var(--ui-hairline));
            }

            /* THE PLAIN FORM — the same two halves, at the touch floor. See the plain
             * property. Written after the tall rule so that a bank given both attributes
             * resolves to one answer rather than to whichever selector came first; they
             * are opposite ends of one dial and nothing should ask for both. */
            :host([plain]) {
                /* THE ARITHMETIC RUNS THE OTHER WAY HERE, and the reason is the floor
                 * itself. Above, the row is the size and the cell is the row minus its
                 * two hairlines. Do that at --ui-hit-min and the CELL comes out at 46,
                 * two pixels under the touch floor the row is named after — measured, by
                 * this bank's own L22 sweep. So the CELL takes --ui-hit-min and the row
                 * is the cell plus its hairlines: 48 of hit area, in a 50px row, still
                 * 14px shorter than the control form it replaces. */
                --_ui-bank-item: var(--ui-hit-min);
                --_ui-bank-row: calc(var(--ui-hit-min) + 2 * var(--ui-hairline));
            }

            /* ---------------------------------------------------------------
             * THE ITEM. SOURCE slate-components.css:358-369 .slate-bank-item.
             *
             * A CLASS, NEVER AN ID (CONVENTIONS §4 rule 2). The ids below are for
             * the suite to query by; every declaration that selection has to beat
             * is on .item, at (0,1,0), which selectionSurface ties and then
             * wins on source order. An id here would be (1,0,0) and this component
             * would silently never turn selected.
             * ------------------------------------------------------------- */
            .item {
                /* NO FLEX BASIS HERE ANY MORE. The equal-cell arithmetic moved to
                 * :host's grid-auto-columns: 1fr - one mechanism, stated once, and
                 * the only one that also holds when the bank is sized by its own
                 * content. min-inline-size: 0 stays and does the job it always did:
                 * it is what lets a track shrink past its content.
                 *
                 * A FLOOR IS A HOOK, DEFAULTING TO NO FLOOR. Ben, 25 August 2026, on the
                 * editor's tab bar: "make the button width match slates". Slate's three
                 * tabs are 142.7 each - one width, not three word-widths - and a bank
                 * that is sized by its own content cannot reach that without being told
                 * a number. The default is 0, so every other bank in the skin is
                 * unchanged. */
                min-inline-size: var(--_ui-bank-item-min, 0);

                /* CITE expanded-charts #expanded-tab-power [i=165] min-height =
                 * 62px -> --ui-control-inner = --ui-control-h - 2 * --ui-hairline.
                 * Derived, so a bank at a different control height keeps its two
                 * hairlines instead of losing them to a literal 62. */
                min-block-size: var(--_ui-bank-item);

                display: flex;
                align-items: center;
                justify-content: center;

                /* The inset is --_ui-item-inset, declared on the host above and
                 * moved by density="compact". The 12px on Slate's expanded tabs is a
                 * call-site override (#expanded-chart-overlay .slate-expanded-tabs
                 * .slate-bank-item) and is not this component's regular answer - it
                 * is, by arithmetic rather than by copying, the compact one. */
                padding-block: 0;
                padding-inline: var(--_ui-item-inset);

                border: 0;
                border-radius: 0;

                /* CITE expanded-charts #expanded-tab-power [i=165]
                 * background-color = rgba(0, 0, 0, 0) in both themes: the bank's
                 * --ui-key ground shows through an unselected item. */
                background-color: transparent;

                /* CITE expanded-charts #expanded-tab-power [i=165] color: dark
                 * rgb(148, 161, 169) / light rgb(90, 101, 108) -> --ui-muted. */
                color: var(--ui-muted);

                /* A button does not inherit its font: the UA sets the font
                 * shorthand on it, which resets family, size, weight AND
                 * line-height. Family and line-height come back by inheritance
                 * from styles/document.css (CONVENTIONS §11 — the base declares
                 * neither on :host so a screen can still set them), and the two the
                 * oracle measured are stated from tokens.
                 * CITE expanded-charts #expanded-tab-power [i=165] font-size = 17px
                 * and font-weight = 400. DQ-216: line-height: inherit CONSUMES
                 * document.css's 1.5 rather than restating a ratio. */
                font-family: inherit;
                line-height: inherit;
                font-size: var(--ui-text-base);
                font-weight: var(--ui-weight-regular);

                cursor: pointer;
            }

            /* THERE IS NO SELECTED-STATE RULE HERE, AND THE ABSENCE IS THE FEATURE.
             *
             * Everything a selected cell looks like arrives through selectionSurface
             * below — the four dials and nothing else. A rule of the shape
             *     .item:where([aria-checked="true"], …) { font-weight: … }
             * used to sit at this line, carrying slate-components.css:392's
             * font-weight: var(--slate-weight-medium). It was removed: font-weight is
             * the one property no dial can reach, so such a rule keeps a selected cell
             * visibly distinguished after a fork retargets every dial to nothing. That
             * is a private "selected" look in the component built to make private
             * selected looks inexpressible (SCOPE Part 10 §12; DECISIONS.md:243).
             *
             * The full argument, the verbatim oracle answer it overrules, and why a
             * fifth dial was refused rather than added, are in the header's DELIBERATE
             * DEPARTURE block. Anything added here that is not a dial re-opens the
             * founding defect, and the suite's §4 drill will say so by name. */

            /* The label track. The bank answers a narrow container by shrinking its
             * cells and ellipsising, which is a component reading its own box
             * (spec §2.1 Rule 1) without a breakpoint to get wrong. There is no
             * @container rule in this file for the same reason ui-text-field states
             * — nothing here has a second layout to switch to. */
            .label {
                min-inline-size: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* ---------------------------------------------------------------
             * THE SEAM — and the specificity that makes it survive selection.
             *
             * CITE expanded-charts #expanded-tab-power [i=165] box-shadow: dark
             * rgba(194, 208, 218, 0.17) 1px 0px 0px 0px inset / light
             * rgba(30, 42, 50, 0.11) 1px 0px 0px 0px inset  <-
             * slate-components.css .slate-bank-item + .slate-bank-item.
             *
             * READ THIS BEFORE CHANGING THE SELECTOR. selectionSurface composes
             * the two shadows — its declaration is
             *     var(--_ui-rest-shadow, 0 0 transparent), inset 0 -LED 0 0 currentColor
             * so the seam rides through selection in the private slot. That only
             * works if the resting rule LOSES the box-shadow cascade, and the
             * obvious spelling does not: .item + .item is (0,2,0) and the
             * fragment's [aria-selected="true"] is (0,1,0), so a selected item
             * that is not the first would keep its seam and lose its LED — every
             * item but one, silently, and invisibly while the LED is 0px.
             *
             * Wrapping the whole selector in :where() drops it to (0,0,0):
             *   - unselected item -> this rule is the only box-shadow: the seam;
             *   - selected item   -> the fragment wins the property and reads the
             *     seam back out of --_ui-rest-shadow, which this rule still sets
             *     because nothing else declares that custom property.
             * The suite asserts both segments on a selected MIDDLE item, which is
             * the only place the difference shows.
             *
             * Set on the element that draws it, never on a wrapper: custom
             * properties inherit, and a wrapper would hand the seam to every
             * selected descendant (base.js, the --_ui-rest-shadow note).
             *
             * AND NOT THE SEAM UTILITY. CONVENTIONS §13 refuses this weight by name:
             * "Appendix 2's first weight, --slate-seam -> --ui-seam-ink, is the inset
             * shadow between segments of a one-piece bank (#3 ...); a gap between two
             * panes and a shadow inside one control are different mechanisms, so this
             * utility refuses it." So seams.js is deliberately not imported here — a
             * grid gap would show the page ground through the middle of a control
             * that is meant to read as one piece. */
            :where(.item + .item) {
                --_ui-rest-shadow: inset var(--ui-seam) 0 0 0 var(--ui-seam-ink);
                box-shadow: var(--_ui-rest-shadow);
            }

            /* ---------------------------------------------------------------
             * HOVER, AND SLATE'S "TOUCH-PANEL :HOVER RE-ASSERTION" RETIRED
             *
             * slate-components.css:415-422 repeats the whole selected paint a
             * second time under :hover, with this comment: "On a touch panel the
             * last thing tapped keeps :hover, so without this the option you just
             * chose repaints itself as unselected under your finger." Correct
             * diagnosis, and a fifth copy of the selected treatment to keep in step
             * — which is the defect this component exists to end.
             *
             * The cause is specificity: a plain .item:hover is (0,2,0) and beats
             * the (0,1,0) state selectors, so the hover paint outranks the
             * selection. Written as .item:where(:hover) the hover pseudo-class
             * contributes nothing, the rule is (0,1,0), it TIES with
             * selectionSurface — and loses on source order, because the fragment
             * is last. So the selected item keeps its face under a stuck finger
             * with no second copy of anything, and the re-assertion rule has
             * nothing left to re-assert. CONVENTIONS §6: "To override a base rule,
             * write the rule" — and its converse, which is this.
             *
             * The paint itself is an ink lift and no face, so hover can never be
             * mistaken for selection at arm's length across a kitchen. */
            .item:where(:hover) {
                color: var(--ui-text-2);
            }

            /* Paint is the base's one dial (--ui-opacity-disabled, via
             * :where([disabled])); this is the pointer affordance only. */
            .item:where(:disabled) {
                cursor: default;
            }

            /* ONE DIAL, PAINTED ONCE. A disabled BANK disables every button in it,
             * so without this line the base would apply --ui-opacity-disabled to
             * the host AND to each item and they would compound: .38 x .38 = .14, a
             * bank three times fainter than every other disabled control in the
             * skin. The host keeps the dial; the items opt out — but only when the
             * HOST is the disabled one, so a single disabled item inside a live
             * bank still dims. Specificity, not !important: (0,3,0) against the
             * base's :where() (0,0,0). */
            :host([disabled]) .item:disabled {
                opacity: 1;
            }
        `,
        selectionSurface,
    ];

    constructor() {
        super();
        this.items = [];
        this.value = '';
        this.mode = DEFAULT_MODE;
        this.label = '';
        this.density = 'regular';
        this.disabled = false;
        this.hold = false;
    }

    /** The root's one gesture binding, or null while `hold` is off. */
    #holdOff = null;

    /**
     * The author's `role`, captured once, so `mode` can own the role without ever
     * overwriting a role a screen stated deliberately. Same shape as ui-switch's
     * tabindex capture and for the same reason: connectedCallback runs again on
     * every re-parent, and by then the attribute in the DOM is this component's own.
     */
    #authorRole = null;

    /**
     * The author's `aria-label`, captured in the same breath and for the same reason.
     * `label` is this component's own API for the group name and it wins while it has
     * a value; when it is cleared the host must go back to what the SCREEN wrote, not
     * to whatever this component wrote last. Without the capture, "remove the name I
     * added" and "remove the name the screen added" are the same call.
     */
    #authorLabel = null;

    #captured = false;

    /**
     * Which item is the tab stop, when that is NOT the selected one. Only `toolbar`
     * mode can be in that position — see #onKeydown. `null` means "follow the
     * selection", which is the answer for radio and tablist and the reason this
     * field is cleared whenever the value, the items or the mode change.
     */
    #roving = null;

    get #mode() {
        return Object.prototype.hasOwnProperty.call(MODES, this.mode) ? this.mode : DEFAULT_MODE;
    }

    get #items() {
        return (Array.isArray(this.items) ? this.items : []).map(normaliseItem);
    }

    /**
     * NOTHING TO CLEAN UP ON DISCONNECT, and that is a design choice rather than an
     * oversight (CONVENTIONS §12's last-but-one box). Every listener this component
     * has is a Lit template binding on a button in its own shadow tree, so it is
     * removed with the tree; there is no host listener, no observer, no timer and
     * no vendor instance. `connectedCallback` therefore does one thing, once.
     */
    connectedCallback() {
        super.connectedCallback();
        if (!this.#captured) {
            this.#authorRole = this.getAttribute('role');
            this.#authorLabel = this.getAttribute('aria-label');
            this.#captured = true;
        }
    }

    willUpdate(changed) {
        super.willUpdate?.(changed);
        /* A selection arriving from outside takes the tab stop back. */
        if (changed.has('value') || changed.has('items') || changed.has('mode')) {
            this.#roving = null;
        }
    }

    /**
     * The aria state and the visual state are the SAME state (spec Appendix 15), so
     * this method writes the group half and `render()` writes the item half, and
     * neither has a second opinion to drift towards.
     */
    updated(changed) {
        super.updated(changed);
        this.#bindHold();
        if (this.#authorRole === null) this.setAttribute('role', MODES[this.#mode].host);
        /* BOTH BRANCHES, for the same reason `disabled` has both: an attribute that is
         * written and never removed is state that cannot go back. `label` is the
         * GROUP's accessible name, and a bank whose label was cleared — a mode switch,
         * a screen re-using one instance for a second question — went on announcing
         * the previous question's name with nothing on screen to contradict it. The
         * else branch closes that, and the captured author value is what it falls back
         * to, so clearing THIS component's name never deletes the SCREEN's.
         *
         * Removed rather than set to "": an empty aria-label is a name of "", which
         * beats an author `aria-labelledby` and leaves the group anonymous. Absent
         * means "no name of my own", so the screen's labelledby — the reason the host
         * carries the group role at all — becomes the name again. */
        if (this.label) this.setAttribute('aria-label', this.label);
        else if (this.#authorLabel !== null) this.setAttribute('aria-label', this.#authorLabel);
        else this.removeAttribute('aria-label');
        if (this.disabled) this.setAttribute('aria-disabled', 'true');
        else this.removeAttribute('aria-disabled');
    }

    /**
     * Bind the hold gesture ONCE, to the root, and resolve the cell when it fires.
     *
     * THE FIRST DRAFT BOUND EVERY CELL AND REBOUND THEM ON EVERY RENDER, and it never
     * once fired. A hold is 600 ms long and this bank re-renders inside that window —
     * the clock ticks, a feed lands, a target repaints — so the teardown ran while the
     * finger was still down and cancelled the timer every time. MEASURED in the browser:
     * the bindings were present on all four cells and no hold ever completed.
     *
     * DELEGATION IS THE FIX AND NOT A REFINEMENT. The root outlives every render, so the
     * gesture cannot be interrupted by one; the cell is read from the event at the moment
     * the hold completes, which is also the only moment it is needed.
     */
    #bindHold() {
        const wanted = !!this.hold;
        if (wanted === (this.#holdOff !== null)) return;
        if (!wanted) {
            this.#holdOff();
            this.#holdOff = null;
            return;
        }
        this.#holdOff = bindPressHold(this.renderRoot, {
            onHold: ({ path }) => {
                if (this.disabled) return;
                /* THE PATH IS THE POINTERDOWN'S, captured at press time — see
                 * press-hold.js. Reading it off the event here answers [], because the
                 * hold completes long after that event finished dispatching. */
                const button = path.find((node) => node instanceof Element
                    && node.classList?.contains('item'));
                if (!button) return;
                const index = [...this.renderRoot.querySelectorAll('.item')].indexOf(button);
                const item = this.#items[index];
                if (!item) return;
                /* A DISABLED CELL STILL HOLDS. An empty favourite slot is disabled for
                 * the ordinary press — there is nothing to load — and it is exactly the
                 * slot a person holds to fill. Slate's own empty-slot menu ("Browse
                 * Profiles") is that case. */
                this.dispatchEvent(new CustomEvent('item-hold', {
                    detail: { value: item.value, index },
                    bubbles: true,
                    composed: true,
                }));
            },
        });
    }

    disconnectedCallback() {
        if (this.#holdOff) { this.#holdOff(); this.#holdOff = null; }
        super.disconnectedCallback();
    }

    /** The index that carries `tabindex="0"` — one per bank, the roving contract. */
    #tabStop(items) {
        if (this.#roving !== null && items[this.#roving] && !items[this.#roving].disabled) {
            return this.#roving;
        }
        const selected = items.findIndex((item) => item.value === this.value && !item.disabled);
        if (selected >= 0) return selected;
        return items.findIndex((item) => !item.disabled);
    }

    render() {
        const items = this.#items;
        const mode = MODES[this.#mode];
        const stop = this.#tabStop(items);

        return items.map((item, index) => {
            const on = item.value === this.value;
            /* Three bindings rather than one computed attribute name, so the whole
             * of Appendix 15's contract is visible in the template: exactly one of
             * them is present, and all three are the same state. */
            return html`
                <button
                    id="item-${index}"
                    part="item"
                    class="item"
                    type="button"
                    role=${mode.item ?? nothing}
                    aria-controls=${item.controls ?? nothing}
                    aria-checked=${mode.state === 'aria-checked' ? String(on) : nothing}
                    aria-selected=${mode.state === 'aria-selected' ? String(on) : nothing}
                    aria-pressed=${mode.state === 'aria-pressed' ? String(on) : nothing}
                    tabindex=${index === stop ? '0' : '-1'}
                    ?disabled=${this.disabled || item.disabled}
                    @click=${() => this.#choose(index)}
                    @keydown=${(event) => this.#onKeydown(event, index)}
                >
                    <span class="label"><slot name="item-${item.value}">${item.label}</slot></span>
                </button>
            `;
        });
    }

    /**
     * Choose an item. The ONLY way `value` changes from inside, and the only place
     * `change` is fired — never for a programmatic write, which is the native
     * contract a settings screen expects when it echoes state back.
     */
    #choose(index) {
        const items = this.#items;
        const item = items[index];
        if (!item || item.disabled || this.disabled) return;
        if (item.value === this.value) return;
        this.value = item.value;
        this.dispatchEvent(new CustomEvent('change', {
            detail: { value: item.value, index },
            bubbles: true,
            composed: true,
        }));
    }

    /** The next enabled index in `dir`, wrapping; `null` if there is none. */
    #step(from, dir) {
        const items = this.#items;
        const n = items.length;
        for (let k = 1; k <= n; k++) {
            const i = ((from + dir * k) % n + n) % n;
            if (!items[i].disabled) return i;
        }
        return null;
    }

    /** The first (`dir > 0`) or last enabled index. */
    #edge(dir) {
        const items = this.#items;
        for (let k = 0; k < items.length; k++) {
            const i = dir > 0 ? k : items.length - 1 - k;
            if (!items[i].disabled) return i;
        }
        return null;
    }

    async #focusItem(index) {
        await this.updateComplete;
        this.shadowRoot?.getElementById(`item-${index}`)?.focus();
    }

    /**
     * KEYBOARD — Appendix 10, "Roving-tabindex tablist, exactly as implemented
     * (`profile_editor.js:3590-3601`)", which is the one keyboard pattern the spec
     * keeps verbatim. Read read-only, it is: ArrowRight / ArrowLeft wrapping
     * modulo, Home, End, preventDefault, then setActiveTab(next) AND next.focus().
     * Selection follows focus, which is also what ARIA expects of a radiogroup and
     * of an automatically-activated tablist. Those four keys and no others; adding
     * ArrowUp / ArrowDown is a one-line change and is filed rather than taken.
     *
     * The one departure, and it is the aria reading rather than a preference:
     * `toolbar` mode spells its state `aria-pressed`, where selection following
     * focus would press a button the user only arrowed past. There, arrows move the
     * tab stop and Space/Enter chooses.
     *
     * Slate does not skip disabled tabs because Slate never disables one. This does,
     * on both the arrow path and the Home/End path.
     */
    #onKeydown(event, index) {
        let next = null;
        switch (event.key) {
            case 'ArrowRight': next = this.#step(index, 1); break;
            case 'ArrowLeft': next = this.#step(index, -1); break;
            case 'Home': next = this.#edge(1); break;
            case 'End': next = this.#edge(-1); break;
            case ' ':
            case 'Spacebar':
            case 'Enter':
                /* Space scrolls the page otherwise, and the page is a wall panel. */
                event.preventDefault();
                this.#choose(index);
                return;
            default:
                return;
        }
        if (next === null) return;
        event.preventDefault();
        if (this.#mode === 'toolbar') {
            this.#roving = next;
            this.requestUpdate();
        } else {
            this.#choose(next);
        }
        this.#focusItem(next);
    }
}

customElements.define('ui-bank', UiBank);
