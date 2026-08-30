/**
 * ui-preset-bank — Wave 4 item #37, the Preset bank (Live compound).
 *
 * Part 4 Wave 4, "Live-screen compounds" table, row #37: "Steam/hot-water preset row
 * — the fourth selection idiom collapses into a #3 use. | small | #3".
 * Spec row (LAYOUT_SPEC_DRAFT.md §5.2 #37): "Preset bank | `slate-live.css:723-797` |
 * A fourth selection idiom."
 *
 * =========================================================================
 * THE ROW IN ONE SENTENCE: THIS IS THE FOURTH IDIOM, DELETED
 * =========================================================================
 *
 * SCOPE Part 4's founding-defect callout names four coexisting selection
 * implementations, and this component is the fourth one: "The preset bank is a fourth
 * idiom (spec §5.2 #37); the Settings nav bypasses the LED dial (T5)." The register's
 * answer is already accepted — "One selection component, not thirteen. One 'selected'
 * treatment, not six" (`DECISIONS.md:244`) — and the same paragraph says what happens
 * to this row: "#32 (tab bar), #36 (favourites bank), #37 (preset bank), #45 (pick
 * disc) ... are all expressed through it or through its dials — none of them may own a
 * private 'selected' look."
 *
 * So this file renders ONE `<ui-bank>` and adds no paint of any kind. There is no
 * `.item` here, no `[aria-pressed]` rule, no colour and no font: a selected preset is
 * painted inside ui-bank's shadow root by `selectionSurface`, from
 * --ui-selected-face / -ink / -led / -glow and nothing else. What is left for this
 * component is the half a bank cannot carry, and it is the half the audit found
 * interesting: WHICH preset is active is not this component's opinion.
 *
 * WHAT THE FOURTH IDIOM ACTUALLY WAS — measured, so the deletion is legible. Slate
 * paints "selected" here with four properties, none of them a dial:
 *   CITE live-ready #drink-out-preset-3 [i=39] color = rgb(244, 247, 248)  <-
 *        slate-live.css  #main-page #shot-settings .preset-active  authored
 *        var(--slate-text)  !important=yes  (token-driven)      [light rgb(23, 26, 28)]
 *   CITE live-ready #drink-out-preset-3 [i=39] font-weight = 400  <-  slate-live.css
 *        #main-page #shot-settings .preset-active  authored 400  !important=yes
 *        (FROZEN/hardcoded)   — against the resting
 *   CITE live-ready #drink-out-preset-1 [i=37] font-weight = 300  <-  slate-live.css
 *        (the seven-selector preset-button list)  authored 300  !important=yes
 *        (FROZEN/hardcoded)
 * plus, from the source read read-only because the corpus never probed either
 * property (prov_query carve-out: "text-shadow ... not 'no rule', but 'never
 * measured'"), SOURCE `slate-live.css:774-800`: a text-shadow glow mixed from
 * --slate-steel at --slate-glow, and a 42px ::after underline at 72% steel.
 *
 * Four painted properties keyed on the selected state, and the four
 * `--slate-selected-*` dials reach exactly none of them. That is the bug: a fork
 * retargets every dial and this row does not move. Here the row moves, because the
 * only thing that can paint it is the dials.
 *
 * =========================================================================
 * THE HALF A BANK CANNOT CARRY: THE HIGHLIGHT IS DERIVED, AND READ-ONLY
 * =========================================================================
 *
 * A preset is not a mode. The truth is the machine's current value; a preset row is a
 * set of shortcuts to it, and "which one is lit" is a QUESTION ABOUT THAT VALUE. Slate
 * knows this and says so, in the one place it is written down —
 * SOURCE `slate/app/src/modules/steam-mode.js:57-75` (read-only), `steamFlowHighlightIndex`:
 *
 *     "Index of the steam-flow preset to highlight for a given flow value, or -1 when
 *      the flow matches no preset (no highlight — the honest state for a hand-dialed
 *      flow). Matching is at the tile's 0.1 ml/s display precision.
 *      The highlight is DERIVED from the current flow value, read-only in both
 *      directions: this function never yields a flow value and callers must never
 *      write one when applying it (the old boot path did the reverse, pushing the
 *      persisted tap-index's VALUE into the workflow, silently resetting a
 *      hand-dialed flow on every app load)."
 *
 * `ui-bank` is UNCONTROLLED — it writes its own `value` on a press and fires `change`
 * (ui-bank.js:647-663), which is the right contract for a segmented control whose
 * state IS the answer. It is the wrong contract for this row, and the difference is
 * the defect above: a bank left to itself lights the pressed cell immediately, whether
 * or not the machine ever takes the value. This component therefore holds the bank
 * controlled — the press becomes an INTENT (`preset-select`), the highlight moves only
 * when `value` comes back changed, and a press the machine refuses leaves the row
 * showing what the machine actually has.
 *
 * TWO CONSEQUENCES WORTH KNOWING:
 *   - `preset-select` carries the preset's NUMBER, never its rendered label. Reading a
 *     number back out of a string another module printed is the single worst coupling
 *     the audit found (`CARRY_FORWARD.md`, `chart.js:1664-1678`), and it starts exactly
 *     here, with a component that only publishes text.
 *   - NOTHING active is a first-class state, not an error. Measured, in the corpus:
 *     CITE live-ready — `find --cls has-context-menu` returns 8 preset buttons in this
 *     state (drink-out 30 / 36 / 40 / 50 at y=395, steam-flow 0.6 / 0.8 / 1.0 / 1.2 at
 *     y=764) while `find --cls preset-active` returns exactly ONE (#drink-out-preset-3).
 *     Slate's own Live screen ships a preset row with no active preset, because the
 *     steam flow was hand-dialled — "the honest state" above, rendered.
 *
 * =========================================================================
 * GATE 2 — WHY THERE IS NO ADDRESS LAYER IMPORT AND THAT IS NOT AN EVASION
 * =========================================================================
 *
 * There is no server data in this component to address. The audit checked:
 * `CAPABILITY_DIFF.md:1472-1475`, "Preset arrays (steam flow / steam time / flush /
 * temp / drink-out / hot-water / milk-stop) in IndexedDB" — "I checked whether ReaPrime
 * has any preset concept to defer to and it has none - zero hits across the webserver
 * and controller layers. These are skin-authored UI affordances, correctly skin-owned."
 * `presets` is therefore the screen's, and `value` is the CONTROL's — which the screen
 * reads through `src/stores/` and the `src/data/` address layer, one level up, where
 * the machine names live. No key string appears in this file and no frame is read here.
 *
 * What IS consumed from the platform is the pair of decisions this component would
 * otherwise have re-made badly:
 *   - `formatToStep` (`src/stores/units.js`) — one formatter, so "1.0" renders as 1.0
 *     and not as 1, and so the match precision and the printed precision are the same
 *     decision rather than two that drift. This is steam-mode.js's `toFixed(1)` rule,
 *     expressed once, through the module that owns display precision.
 *   - `hasReading` (`src/data/reading.js`) — the address layer's own absence predicate.
 *     An absent value highlights nothing. There is no `?? compute` anywhere below (A7):
 *     absence is a state, not a prompt to invent a number.
 *
 * NO LIMITS TABLE, DELIBERATELY. A preset row is choices, not bounds, and B2/R2 allow
 * exactly one ranges table in the skin, behind `r2MachineLimits`. This component
 * neither clamps nor validates: an out-of-range preset is the caller's to not pass, and
 * a second table here would be the wave's stated block. The steam floor is 135 (not
 * 130) and the ceiling 165 Bengle / 160 DE1 (`CARRY_FORWARD.md` §3c, `machine-limits.js`
 * row; ReaPrime `de1_controller.dart:545`) — which is why the gallery's steam state
 * shows 135 / 145 / 155 / 165 and why 130 appears nowhere in this row's files.
 *
 * ALSO NOT PORTED: `STEAM_FLOW_PRESETS_BY_MODEL` (`steam-mode.js:9-13`), the table that
 * picks a preset group by substring-matching a machine-model string. `CARRY_FORWARD.md`
 * §3c: "Prefer capabilities over the model-string table (A3)", and A3 requires a
 * machine discriminator to be an explicit named thing rather than a substring match.
 * The presets arrive as data; where they come from is R3's enumeration, not this row's.
 *
 * =========================================================================
 * GEOMETRY — WHAT SLATE MEASURES, AND THE ONE DEPARTURE
 * =========================================================================
 *
 * DISQUALIFICATION CHECK FIRST (SCOPE Part 10 §4). Slate's rects here are frozen
 * 1920x1200 captures, quoted as what Slate does and never as a responsive target;
 * LAYOUT_SPEC_DRAFT.md governs the container behaviour. Two of the row's own numbers
 * are disqualified outright as bug L5's family — "the rail's rhythm is a solved chain
 * with two emergent alignments; changing one row breaks both", and §4.1's "the rewrite
 * gets its alignments from the grid or does without them":
 *   SOURCE slate-live.css:723-744 (read-only) — width 374px !important with
 *   padding-left: 106px "so the four columns sit exactly over the stepper above", and
 *   margin-top: calc(--slate-rail-attach - --slate-rail-gap), a negative correction
 *   margin against the column's own gap. Neither is carried: attachment and alignment
 *   are the rail grid's job in Part 5, not this component's.
 *
 * What the corpus does answer is the buttons, and the shape is a bank:
 *   CITE live-ready #drink-out-preset-3 [i=39] rect 67x34, text "40"  (the same rect in
 *        all 7 states that capture it: expanded-charts, history-shotdata,
 *        history-viewer, live-pulling, live-ready, modal-notes, modal-numpad)
 *   CITE live-ready — four cells at x=134 / 201 / 268 / 335, so 4 x 67 = 268 wide
 *   CITE live-ready .slate-stepper — 268 x 64, in every one of the 85 elements the
 *        corpus finds across 16 states.
 * The preset row is exactly the width of the stepper it sets, in four equal cells.
 * `ui-bank` gives that for nothing: items are flex: 1 1 0 and the host fills its column
 * (ui-bank.js:342-344). No width, no template and no padding is stated in this file.
 *
 * THE DEPARTURE, and it is the row's real cost. Slate's ink box is 34px tall with the
 * hit area lifted back to the floor by an invisible extension — spec Appendix 5 carries
 * exactly this forward: "Hit area is separate from ink — ::before at max(100%,
 * var(--slate-hit-min)) on presets (slate-live.css:781-790)". A #3 use cannot express
 * it. The pressable element is ui-bank's own button, inside ui-bank's shadow root,
 * under a host that sets overflow: hidden so the radius can clip a selected face
 * (ui-bank.js:313-329) — an overlay slotted in from out here would be clipped back to
 * the box on the block axis, which is the ONE axis Slate grows. So the ink box becomes
 * the hit box, at ui-bank's --ui-control-h floor: 64px outside, --ui-control-inner =
 * 62px per cell, against a --ui-hit-min of 48. The suite measures the rendered cell
 * rather than trusting this paragraph.
 *
 * A COMPACT VARIANT WAS THE ALTERNATIVE AND IS REFUSED, not forgotten. Retargeting
 * --ui-control-h on the bank instance is what ui-tab-bar.js:341-352 calls "the
 * supported route" for a call-site height — but a component may not DECLARE a --ui-*
 * property: Gate C's private-palette guard (scripts/guards.js:150-177) fails the build
 * on it by name, because that is bug L12's shape. The honest alternatives are both
 * register decisions rather than a component's: a 94th token (§3.10 counts 93), or a
 * height property, which is "two ways to state a height ... how 62px came to be written
 * by hand eighteen times" (ui-tab-bar.js:348-351). #3 refused a fifth dial for the same
 * reason and this row refuses the same way. Declared to the wave-4 ledger; one line
 * reverses it the day a token exists.
 *
 * TYPE IS THE BANK'S, and that is the second departure. Slate prints the numerals one
 * step up the scale:
 *   CITE live-ready #drink-out-preset-3 [i=39] font-size = 18px  <-  slate-live.css
 *        (the seven-selector preset-button list)  authored var(--slate-text-md)
 *        !important=yes  (token-driven)
 * against #3's own 17px (--ui-text-base, itself measured from the real bank:
 * ui-bank.js:114-115). §3.5 gives the two tokens their jobs — --ui-text-md is "nav
 * rows, list rows" and --ui-text-base is "body, control values, buttons" — and a preset
 * is a control value on a button. The 18px is the same off-library drift that produced
 * the fourth idiom in the first place, so the row takes the library's answer. Same
 * reversal, one line, same ledger.
 *
 * THE RESTING INK is #3's --ui-muted rather than Slate's lift toward the text colour:
 *   CITE live-ready #drink-out-preset-1 [i=37] color = color(srgb 0.618039 0.665098
 *        0.693726)  <-  slate-live.css  authored
 *        color-mix(in srgb, var(--slate-muted) 90%, var(--slate-text))  !important=yes
 *        (token-driven)      [light color(srgb 0.326667 0.366667 0.392157)]
 * Half of that mix's purpose was to make the resting cells legible against the ACTIVE
 * one, which the dials now do; the other half is a fifth resting ink in a library with
 * one. Not carried.
 *
 * =========================================================================
 * WHAT THIS COMPONENT IS NOT
 * =========================================================================
 *
 * NOT the row's label, its unit or its spacing. Slate's preset row sits under a label
 * block that is bug L18 ("the steam/hot-water label block is 108px in an 88px grid
 * track ... the knock-on workaround is padding-top: 11px") and the unit lives there,
 * which is why the buttons are bare numerals — measured "30" / "36" / "40" / "50" and
 * "0.6" / "0.8" / "1.0" / "1.2". The rail's grid owns all three in Part 5.
 *
 * NOT a context menu. Slate's preset buttons carry `has-context-menu` (a long-press to
 * edit the preset's value, persisted to IndexedDB — `CAPABILITY_DIFF.md:1472`), which
 * is why the corpus reads a transparent 2px inset shadow on them:
 *   CITE live-ready #drink-out-preset-3 [i=39] box-shadow = rgba(0, 0, 0, 0) 0px -2px
 *        0px 0px inset  <-  context-menu.css  button.has-context-menu  authored
 *        transparent 0px -2px 0px 0px inset  (FROZEN/hardcoded)
 * Editing presets is not in the row and #21 is the menu when it is.
 *
 * @fires preset-select - {detail: {value, label, index}}, composed and bubbling. An
 *                        INTENT, not a state change: the highlight does not move until
 *                        `value` says it did. Never fired for a programmatic write, and
 *                        never for the preset that is already active.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';
import 'src/components/ui-bank.js';

import { hasReading } from 'src/data/reading.js';
import { decimalsForStep, formatToStep } from 'src/stores/units.js';

/**
 * The most decimals a preset list may imply. 0.1 + 0.2 is 0.30000000000000004 and
 * `String()` prints all seventeen of them, which would make a match on printed
 * precision impossible for the one arithmetic mistake most likely to reach here.
 * Slate's own tile precision is one decimal (`steam-mode.js:60`).
 */
const MAX_DECIMALS = 3;

/** Numbers or objects in, one shape out — the same normalisation ui-bank does. */
function normalisePreset(raw) {
    if (raw !== null && typeof raw === 'object') {
        return {
            value: Number(raw.value),
            label: raw.label === undefined || raw.label === null ? null : String(raw.label),
            disabled: raw.disabled === true,
        };
    }
    return { value: Number(raw), label: null, disabled: false };
}

/**
 * The step a preset list implies, when the caller has not said. Two decimals of
 * evidence, both measured: the drink-out row prints "30" / "36" / "40" / "50" (step 1)
 * and the steam-flow row "0.6" / "0.8" / "1.0" / "1.2" (step 0.1), and the second is the
 * one that matters — printed as `String(1.0)` it would read "1" and stop matching a
 * machine value of 1.0.
 */
function inferStep(presets) {
    let decimals = 0;
    for (const preset of presets) {
        if (!hasReading(preset.value)) continue;
        decimals = Math.max(decimals, decimalsForStep(preset.value));
    }
    return decimals > 0 ? Number(`1e-${Math.min(decimals, MAX_DECIMALS)}`) : 1;
}

export class UiPresetBank extends UiElement {
    static properties = {
        /**
         * The shortcuts. Numbers, or `{ value, label, disabled }` objects for a preset
         * whose label is not its number. Parsed from a JSON attribute so the gallery
         * and a screen's markup can state one.
         *
         * NOT a data source and not a table (see the header): ReaPrime has no preset
         * concept, so these are the screen's, and no range is checked here.
         */
        presets: { type: Array },

        /**
         * The CONTROL's current value — the machine's, not this row's. A number, or
         * absent (null / an absence from `src/data/reading.js`) for a value that has
         * not arrived, which highlights nothing.
         *
         * NOT reflected, unlike ui-bank's `value`. An absence is an object, and a
         * reflecting Number property would serialise it into the attribute and read it
         * back as NaN — the rendering would stay right and the property would quietly
         * stop being what the caller set. The readable state is `activeIndex`, which is
         * derived anyway, plus the bank's own reflected key.
         */
        value: { type: Number },

        /**
         * Display precision, as a step: 1, 0.1, 0.05. Both the printed label and the
         * match run through it, so they cannot disagree. Omitted, it is inferred from
         * the presets themselves.
         */
        step: { type: Number },

        /** Accessible name for the GROUP — the question the row answers. */
        label: { type: String },

        /** Paint AND behaviour, both inherited from the bank underneath. */
        disabled: { type: Boolean, reflect: true },

        /**
         * OFFER SLATE'S SECOND ACTION: hold a cell and the bank says which one.
         *
         * Slate's preset banks are its only re-cuttable control — hold one and a menu
         * offers Apply / Enter value / Save current here / Revert (`ui.js:1630-1666`).
         * Decal shipped the banks, and `storage-routes.js` shipped the two rows an
         * edited bank would live in, with no gesture between them: the rows could never
         * be written and the defaults were permanent. This is the gesture; the MENU is
         * the screen's, because what the four items do is the screen's business.
         */
        hold: { type: Boolean, reflect: true },
    };

    static styles = [
        /* ONE RULE, AND IT PAINTS NOTHING. Everything visible about this component is
         * ui-bank's, which is the row's whole claim; the rule below is the arithmetic
         * fix that composition always needs.
         *
         * No hitArea: the pressable element is the bank's button, in the bank's shadow
         * root, and an overlay from out here is clipped by the bank's own
         * overflow: hidden — see the header's DEPARTURE. No visuallyHidden: every cell
         * carries visible text and the group is named on the bank's host. No seams: the
         * divider between two cells is ui-bank's inset shadow inside one control, which
         * CONVENTIONS §13 refuses the seam utility by name. No selectionSurface and
         * no font: the selected treatment is the four dials', re-aimed below, and
         * every weight in the row is ui-bank's already.
         *
         * IT DOES NOW TURN TWO COLOURS OFF, and that sentence used to read "no colour
         * … there is no fifth thing here to paint with". Ben's 23 Aug ruling put
         * Slate's preset idiom back — numbers on the rail's ground, underlined when
         * selected — so the bank's own key fill and frame are switched to
         * `transparent` from out here. Two keywords, no literal, no new colour: what
         * shows through is the rail's ground, which stays its one owner. */
        css`
            /* ===================================================================
             * SLATE'S PRESET IDIOM, EXPRESSED AS DIALS — Ben, 23 Aug 2026
             * ===================================================================
             * "the presets for Drink weight, Steam flow shouldn't be the normal
             * toggle, but insted the same look slate had with just numbers with
             * line underneath highlighting what value is selected. Maybe the
             * selected value could also be a little bold or slighyl larger?
             * Might look good but needs to be sutble."
             *
             * That is Slate's own paint for this row, and this file's header block
             * already measured it: selected color = var(--slate-text) against a
             * resting 300 and a selected 400 weight, plus a text-shadow glow and a
             * 42px ::after underline at 72 percent steel (slate-live.css:774-800).
             * The header calls the fourth idiom a BUG — four painted properties,
             * none of them reachable by a dial, so a fork retargets everything and
             * this row does not move.
             *
             * SO THE LOOK COMES BACK AND THE BUG DOES NOT. Every property below is
             * one of the four dials, re-aimed for this component only:
             *
             *   face  transparent   there is no fill. The numbers sit on the rail's
             *                       own ground, which is the whole of "just numbers".
             *   ink   --ui-text     the selected number is the brightest thing in
             *                       the row, exactly as the CITE above reads.
             *   led   the underline. --ui-selected-led is a LENGTH and the surface
             *                       draws it as an inset bottom bar in currentColor
             *                       (base.js:378-393) — the mechanism Slate's own
             *                       Settings nav uses, so no fifth property and no
             *                       ::after of our own.
             * The glow dial is left where the theme put it: Slate's is 0 percent on
             * every other selected thing, and a glow here would be the one place in
             * the skin that shimmers.
             *
             * THE WEIGHT DIAL IS LEFT ALONE TOO, AND THAT IS THE ANSWER TO "a little
             * bold". The step Ben is asking for is already there and needs nothing
             * from this file: ui-bank rests its cells at --ui-weight-regular
             * (ui-bank.js:534) and selectionSurface is composed LAST, so a selected
             * cell takes --ui-selected-weight, which the token sheet sets to
             * --ui-weight-medium (tokens.css:849). 400 -> 500 is one notch, the same
             * size of step as Slate's own 300 -> 400, and it now READS as emphasis
             * because the fill it used to hide behind is gone.
             *
             * NOT A FONT-SIZE, and that half is a reasoned no rather than an
             * oversight: the row is a grid of equal cells, so a larger selected
             * number would move its three neighbours every time the value changed.
             *
             * THE THREE VALUES ARE NOT HERE, AND THE WIRING IS. A first draft
             * scoped them to :host in this file and Gate C's private-palette guard
             * refused it, correctly: re-declaring a public --ui-* token inside a
             * component is bug L12's exact shape — "the names stay public and the
             * values go local, so every consumer downstream reads a colour the token
             * file does not control and a fork retargeting the template changes
             * nothing here". Which row wears which selection idiom is a THEME
             * decision, so the values live in styles/tokens.css under a block that
             * names this element, where one owner keeps them and a fork's retarget
             * moves this row with everything else. See THE PRESET ROW'S SELECTION
             * IDIOM there. Nothing crosses ui-bank's shadow boundary either way — a
             * custom property inherits in, which is why the dials are the way in and
             * why ui-bank refuses ::part by name.
             *
             * AND THE WIRING HAS TO BE HERE rather than in the sheet: a document
             * stylesheet cannot match an element inside a shadow root, and every
             * preset bank in the app is inside <live-screen>'s. A ui-preset-bank
             * selector in tokens.css reached this component's own test fixture, where
             * the element sits in the light DOM, and nothing on the glass.
             *
             * EVERY VALUE BELOW IS A PUBLIC TOKEN, NEVER A LITERAL, which is the one
             * shape the private-palette guard allows through: the token file still
             * owns what the row looks like, and this file only says which dial reads
             * which name. Write a colour here instead and Gate C refuses it, which is
             * bug L12 staying dead. */
            :host {
                --ui-selected-face: var(--ui-preset-selected-face);
                --ui-selected-ink: var(--ui-preset-selected-ink);
                --ui-selected-led: var(--ui-preset-selected-led);
            }

            /* AND THE ROW HAS NO CONTAINER. "just numbers with line underneath" is
             * two claims and the underline above is only the first: Slate's preset
             * row is text on the rail's own ground, with no key fill and no frame
             * around the four cells. ui-bank paints both for its own resting state
             * (--ui-key plus a --ui-line border, ui-bank.js:400-405), which is right
             * for a segmented control and wrong for this one.
             *
             * AN OUTER-TREE RULE, NOT A REACH INSIDE. .presets is the <ui-bank>
             * ELEMENT in THIS shadow root, so this is the same mechanism the disabled
             * rule below already uses and its note already explains: an outer-tree
             * rule beats an inner :host rule outright, no !important needed. Nothing
             * here crosses ui-bank's shadow boundary, and the selected treatment is
             * still the dials' — the wall the bank exists to be is intact.
             *
             * The cells keep their hit area: --ui-hit-min is the button's, inside the
             * bank, and none of it is touched here. */
            .presets {
                background-color: transparent;
                border-color: transparent;

                /* THE ROW'S HEIGHT IS NOT SET HERE, and the first attempt to set it
                 * from out here is why that is worth saying: a min-block-size on this
                 * element moves the HOST and leaves the cells at --ui-control-inner, so
                 * the row measured 64 regardless. Both halves move together from
                 * ui-bank's own plain attribute — the mirror of its tall — which is
                 * where a row height belongs. See the render below. */
            }

            /* ONE DIAL, PAINTED ONCE — ui-bank.js:496-505 one level up, and
             * ui-tab-bar.js:395-404 solved it identically for the identical reason. A
             * disabled preset bank disables the bank inside it, so without this line
             * the base dims BOTH hosts and they compound: .38 x .38 = .14, a row three
             * times fainter than every other disabled control in the skin. The outer
             * host keeps the dial because it is the element a screen disabled; the bank
             * opts out. Specificity, not !important: an outer-tree rule beats an inner
             * host rule outright. */
            :host([disabled]) .presets {
                opacity: 1;
            }
        `,
    ];

    constructor() {
        super();
        this.presets = [];
        this.value = null;
        this.step = null;
        this.label = '';
        this.disabled = false;
        this.hold = false;
    }

    /**
     * An `aria-label` the SCREEN wrote on this host, moved rather than copied.
     *
     * The host takes no role, and bug L23's first symptom is "aria-label on role-less
     * <div>s (x3)" — Chrome exposes the name anyway, so leaving it here would announce
     * the row twice, once anonymously. ui-tab-bar.js made the same move for the same
     * bug; the name belongs on the element carrying the group role, which is the bank.
     */
    #hostLabel = null;

    /** The bank's accessible name, in the order a caller would expect. */
    get accessibleName() {
        return this.label || this.#hostLabel || '';
    }

    /** The presets, normalised. */
    get #presets() {
        return (Array.isArray(this.presets) ? this.presets : []).map(normalisePreset);
    }

    /** The precision both the labels and the match are read at. */
    get #step() {
        const stated = Number(this.step);
        return Number.isFinite(stated) && stated > 0 ? stated : inferStep(this.#presets);
    }

    /**
     * The index of the preset the CURRENT VALUE matches, or -1 for none.
     *
     * Derived, and read-only in both directions (`steam-mode.js:57-75`): the match runs
     * value -> preset and never the other way, so no press can make this method return
     * something the value does not support.
     *
     * `hasReading` on both sides is the whole absence policy — an absent value, a
     * non-numeric preset and a preset list with a hole all fall through to -1 rather
     * than to a coerced 0. There is no fallback branch (A7).
     */
    get activeIndex() {
        if (!hasReading(this.value)) return -1;
        const step = this.#step;
        const target = formatToStep(this.value, step);
        return this.#presets.findIndex(
            (preset) => hasReading(preset.value) && formatToStep(preset.value, step) === target,
        );
    }

    /** The bank's item key for the active preset, or the empty key for none. */
    get #activeKey() {
        const index = this.activeIndex;
        return index >= 0 ? String(index) : '';
    }

    /**
     * The bank's items. The KEY is the index and the LABEL is the formatted number, so
     * two presets that print the same string still address separately and the match
     * stays this component's business rather than the bank's string comparison.
     */
    get #items() {
        const step = this.#step;
        return this.#presets.map((preset, index) => ({
            value: String(index),
            label: preset.label ?? formatToStep(preset.value, step),
            disabled: preset.disabled,
        }));
    }

    /** The one bank this component renders. */
    get #bank() {
        return this.shadowRoot?.getElementById('presets') ?? null;
    }

    connectedCallback() {
        super.connectedCallback();
        this.#adoptHostLabel();
    }

    render() {
        /* One `<ui-bank>`, in the aria spelling a set of shortcuts has.
         *
         * TOOLBAR, NOT RADIO, and it is the aria reading rather than a preference.
         * ui-bank.js:700-706: "toolbar mode spells its state aria-pressed, where
         * selection following focus would press a button the user only arrowed past.
         * There, arrows move the tab stop and Space/Enter chooses." Every press here
         * asks a machine to change a setting, so arrowing across four presets must not
         * ask four times. It is also Slate's own markup shape: the preset buttons carry
         * no role at all, which ui-bank.js:204-207 maps to the aria-pressed spelling.
         *
         * Every binding below is a pass-through except `.value`, which is the whole
         * point of the file — see #onBankChange.
         *
         * THE COMPACT INSET IS BEN'S OWN ANSWER TO cmp-lo-2 (parity 7-live-polish).
         * His ruling on that finding: "the bank cannot widen, so equal-at-widest is
         * reached by TRIMMING CELL PADDING until the widest default label fits its
         * equal cell; measured at fix time; add a label-fits assertion." It was written
         * about the Live rail's mode bank and it is about the SHAPE rather than about
         * that control — a bank with a DEFINITE width divides it equally whatever its
         * labels need, and this is the only other bank in the skin with one.
         *
         * MEASURED at the 1000x600 design floor, where the rail's well is at its
         * squeezed 208px form: four equal cells of 52px, and the regular --ui-space-4
         * inset on each side leaves 15.5px of content box for a "30" that needs 21.7 —
         * cmp-lo-2's shortfall exactly, in the one bank nobody had looked at (the Live
         * suite's own query walked the rail's LIGHT dom, where this bank is not).
         * Compact is --ui-space-2 and leaves 36. At the reference geometry the cells
         * are Slate's own 67px and the label fits either way, and the text is centred
         * in a flex cell, so nothing moves there:
         *   ORACLE live-ready #drink-out-preset-1 [i=37] rect [134,395,67,34],
         *          padding-left 2px — Slate's own inset here is smaller than either of
         *          Decal's two steps.
         * The label-fits assertion Ben asked for is in live-bands.render.test.mjs. */
        return html`
            <ui-bank
                id="presets"
                class="presets"
                mode="toolbar"
                density="compact"
                plain
                .items=${this.#items}
                .value=${this.#activeKey}
                .label=${this.accessibleName}
                ?disabled=${this.disabled}
                ?hold=${this.hold}
                @change=${this.#onBankChange}
                @item-hold=${this.#onBankHold}
            ></ui-bank>
        `;
    }

    updated(changed) {
        super.updated(changed);
        if (this.#adoptHostLabel()) this.requestUpdate();
        this.#holdHighlight();
    }

    /**
     * Move a screen-written `aria-label` onto the bank. Returns true only on the update
     * that actually moved one, so the extra render this asks for happens once.
     */
    #adoptHostLabel() {
        const written = this.getAttribute('aria-label');
        if (written === null) return false;
        this.#hostLabel = written;
        this.removeAttribute('aria-label');
        return true;
    }

    /**
     * Put the bank's selection back where the VALUE says it is.
     *
     * ui-bank writes its own `value` on a press (ui-bank.js:652-657), and Lit will not
     * write the binding back afterwards: the template's committed value is still the
     * derived key, so the dirty check sees no change and the drift would survive every
     * later render. Hence an imperative re-assert, after every update and immediately
     * on the press, which together are the "read-only in both directions" contract.
     */
    #holdHighlight() {
        const bank = this.#bank;
        if (!bank) return;
        const key = this.#activeKey;
        if (bank.value !== key) bank.value = key;
    }

    /**
     * A press. The bank has already moved its own selection; this puts it back and
     * publishes the intent instead.
     *
     * The bank's `change` is stopped here rather than re-fired: it is an implementation
     * detail of the composition, it carries the bank's index key rather than a machine
     * value, and a consumer that saw both would have two events for one press with
     * different payloads — which is how a screen ends up writing the label.
     */
    /**
     * A cell was held. Re-emitted with the PRESET rather than with the bank's index key,
     * for the same reason `#onBankChange` re-emits rather than letting the inner event
     * out: the index is this component's private addressing and the number is what a
     * caller can act on.
     */
    #onBankHold(event) {
        event.stopPropagation();
        const index = Number(event.detail?.value);
        const preset = this.#presets[index];
        if (!preset || this.disabled) return;
        this.dispatchEvent(new CustomEvent('preset-hold', {
            detail: { value: preset.value, label: this.#items[index].label, index },
            bubbles: true,
            composed: true,
        }));
    }

    #onBankChange(event) {
        event.stopPropagation();
        const index = Number(event.detail?.value);
        this.#holdHighlight();

        const preset = this.#presets[index];
        if (!preset || preset.disabled || this.disabled) return;

        this.dispatchEvent(new CustomEvent('preset-select', {
            detail: { value: preset.value, label: this.#items[index].label, index },
            bubbles: true,
            composed: true,
        }));
    }
}

customElements.define('ui-preset-bank', UiPresetBank);
