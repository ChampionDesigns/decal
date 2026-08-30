/**
 * ui-stepper - Wave 2 item #4, the skin's most-used compound.
 *
 * SPEC  LAYOUT_SPEC_DRAFT.md section 5.1 #4 - "Stepper, slate-components.css:541-553,
 *       :601, :935-981 - 112 uses. 3-column grid with a `field-sizing: content` path
 *       and an @supports fallback." Size: medium. Slate's own header on the block is
 *       the brief: "A stepper: minus / value / plus as ONE CONTINUOUS INSTRUMENT,
 *       seams not gaps. Live, the Editor and Settings all use this shape."
 *
 * THE TWO REGISTER DECISIONS THIS ROW CARRIES
 *
 *   C3  "Step-matrix caps become a named `compact` density, not a private 64px"
 *       (SCOPE.md:171). Slate has FOUR values for one job: --slate-stepper-cap: 92px
 *       global (renders nowhere), 78px on Live (a six-selector override list), 78px in
 *       Settings, and the profile editor re-implements the whole control with hard
 *       64px caps and never reads the token (profile-editor-v3.css:504-507, 519-520).
 *       LAYOUT_SPEC_DRAFT.md section 3.1 resolves the disagreement to 78px - "what two
 *       of the three live screens already render, and it is measured" - and OQ-4's
 *       residue is answered here: the editor's 64 becomes `density="compact"`, a NAMED
 *       state of this one component, not a second implementation.
 *
 *   B2  "exactly one limits table in the skin, never two" (SCOPE.md:3063), and the API
 *       shape it fixes: "ranges arrive as data, the component never owns limits -
 *       FIXED FROM THEIR FIRST LINE". So: min / max / step / the step function all
 *       arrive from outside. There is no table in this file, no default ceiling, and
 *       nothing here knows what a steam temperature is. With no min and no max stated
 *       the control is genuinely unbounded - the rendering suite proves it by stepping
 *       past every number a machine would accept.
 *
 * WAVE LAW. No data layer, no endpoint, no import from src/data/ or src/stores/. And
 * NO SELECTION TREATMENT: a stepper has no selected state, so it paints none, and the
 * suite asserts the negative - moving all four selection dials moves zero pixels here.
 * The founding defect was thirteen selection components and six selected looks; a
 * component that quietly grows a seventh is how that happened the first time.
 *
 * ---------------------------------------------------------------------------
 * THE APPEARANCE IS MEASURED, NOT CHOSEN
 * ---------------------------------------------------------------------------
 * Every value below carries the oracle line that decided it, quoted verbatim
 * (SCOPE Part 10 section 4). `prov_query.py find --cls slate-stepper` returns
 * 85 elements in 16 states at ONE distinct geometry - 268 x 64 - and the value cell
 * (`--cls slate-stepper-value`) 85 elements at 110 x 62. The control is
 * 78 + 110 + 78 + 2 hairlines = 268 exactly.
 *
 *   ORACLE  settings-machine-steam .slate-stepper [i=50] background-color =
 *           rgb(26, 33, 39)  <-  slate-components.css `.slate-stepper`  (token-driven)
 *                                                            -> --ui-key
 *   ORACLE  settings-machine-steam .slate-stepper [i=50] border-top-color =
 *           rgb(58, 72, 82)  <-  slate-components.css `.slate-stepper`
 *                                                            -> --ui-line
 *   ORACLE  settings-machine-steam .slate-stepper [i=50] border-top-width = 1px
 *           <-  slate-components.css `.slate-stepper`         -> --ui-border-w
 *   ORACLE  settings-machine-steam .slate-stepper [i=50] border-top-left-radius = 6px
 *           <-  slate-components.css `.slate-stepper`         -> --ui-radius
 *   ORACLE  settings-machine-steam <button> [i=51] rect x=1562 y=286 w=78 h=62
 *           color = rgb(148, 161, 169)  <-  slate-components.css
 *           `.slate-stepper > button`  authored `var(--slate-muted)`
 *                                                            -> --ui-muted
 *   ORACLE  settings-machine-steam <button> [i=51] font-size = 28px  <-
 *           slate-components.css `.slate-stepper > button`
 *           authored `var(--slate-text-xl)`                  -> --ui-text-xl
 *   ORACLE  settings-machine-steam <button> [i=51] background-color = rgba(0, 0, 0, 0)
 *           <-  slate-components.css `.slate-stepper > button` authored `transparent`
 *   ORACLE  settings-machine-steam <button> [i=51] box-shadow =
 *           rgba(194, 208, 218, 0.17) -1px 0px 0px 0px inset  <-  slate-components.css
 *           `.slate-stepper > button:first-child`  authored
 *           `inset calc(-1 * var(--slate-hairline)) 0 var(--slate-seam)`
 *                                              -> --ui-seam (length) + --ui-seam-ink
 *   ORACLE  settings-machine-steam .slate-stepper-value [i=52] background-color =
 *           color(srgb 0.760784 0.815686 0.854902 / 0.0927451) [prov-baseline] /
 *           color(srgb 0.117647 0.164706 0.196078 / 0.0603922) [prov-light]  <-
 *           slate-components.css `.slate-stepper-value`  (set via a CSS shorthand;
 *           source reads `background: color-mix(in srgb, var(--slate-seam) 55%,
 *           transparent)`)                                  -> --ui-seam-ink at 55%
 *   ORACLE  settings-machine-steam .slate-stepper-value [i=52] box-shadow =
 *           rgba(194, 208, 218, 0.17) 0px 1px 0px 0px inset  <-  slate-components.css
 *           `.slate-stepper-value`  authored `inset 0 var(--slate-hairline)
 *           var(--slate-seam)`                              -> --ui-seam / --ui-seam-ink
 *   ORACLE  settings-machine-steam .slate-stepper-value [i=52] color =
 *           rgb(244, 247, 248)  <-  slate-components.css `.slate-stepper-value`
 *           authored `var(--slate-text)`                    -> --ui-text
 *   ORACLE  settings-machine-steam .slate-stepper-value [i=52] font-size = 27px  <-
 *           slate-components.css `.slate-stepper-value`
 *           authored `var(--slate-display-xs)`              -> --ui-display-xs
 *   ORACLE  settings-machine-steam .slate-stepper-unit [i=54] font-size = 14px  <-
 *           slate-components.css `.slate-stepper-value small, .slate-stepper-value
 *           .slate-stepper-unit`  authored `var(--slate-text-sm)`
 *                                                            -> --ui-text-2xs
 *   ORACLE  settings-machine-steam .slate-stepper-unit [i=54] color =
 *           rgb(148, 161, 169)  authored `var(--slate-muted)` -> --ui-muted
 *   ORACLE  settings-machine-steam .slate-stepper-unit [i=54] font-weight = 400
 *           authored `var(--slate-weight-regular)`          -> --ui-weight-regular
 *   ORACLE  live-ready #grind-value [i=21] font-family = Geist, system-ui, sans-serif
 *           <-  slate-components.css `.slate-stepper-value`
 *           authored `var(--slate-font-numeric)`  -- and tokens.css:346-348 records
 *           that --slate-font-numeric was ALREADY var(--slate-font-ui), so there is
 *           one family token and the numeric part of the role is
 *           `font-variant-numeric` alone (type-roles.js, `.ui-numeric`).
 *
 * THREE DELIBERATE DEPARTURES FROM THE ORACLE, each because a decision outranks it:
 *
 *   1. WEIGHT 300. NO LONGER A DEPARTURE, as of parity surface 1. Slate authors
 *      `var(--slate-weight-light)` on both the caps (28px/300) and the value (27px/300);
 *      this component rendered 400 while the sheet carried three weights, on the
 *      authority of a LAYOUT_SPEC_DRAFT §3.5 line whose own citation
 *      (slate-tokens.css:148-153) declares FOUR, light among them. --ui-weight-light
 *      exists now and both read it, so the cap and the value are Slate's own weight.
 *      CITE live-ready #dose-in-value [i=26] font-weight = 300 <- slate-components.css
 *           {.slate-stepper-value} authored `var(--slate-weight-light)` (token-driven);
 *      CITE live-ready #dose-in-minus [i=25] font-weight = 300 <- slate-live.css
 *           {#main-page #dose-section button, ...} authored `300`.
 *   2. VALUE TYPE 27px -> --ui-display-xs. NO LONGER A DEPARTURE, as of parity
 *      surface 0: the token was clamp(22px, 2.2cqi, 27px), which resolved to 22px
 *      against this component's own 268px container and so rendered the value FIVE
 *      PIXELS smaller than the oracle everywhere (MEASURED at
 *      settings--leaf-machine-hot-water: Decal #value 22px against Slate's
 *      .slate-stepper-value 27px). --ui-display-xs is now the fixed 27px Slate
 *      declares, which is also what the clamp's own ceiling already said, so this
 *      element now matches the oracle it was derived from (tokens.css cites
 *      expanded-charts [21] .slate-stepper-value 27px -> --ui-display-xs). The
 *      component still names only the token; the change was one line in the sheet.
 *   3. UNIT SIZE lands on --ui-text-2xs (14px), NOT --ui-text-sm. Slate authored
 *      --slate-text-sm and it computes 14px; decal's --ui-text-sm is 15px and
 *      --ui-text-2xs is 14px with the comment "column headers, units". The oracle's
 *      NUMBER is honoured; the token NAME moved under it.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS COMPONENT FIXES THAT SLATE DOES NOT
 * ---------------------------------------------------------------------------
 *
 *   L24 "A11Y: focus rings clipped on all four sides by the components they sit
 *       inside" - and this control is one of the two named clippers:
 *       "the +/- caps live inside `.slate-stepper { overflow: hidden }`
 *       (slate-components.css:549) ... cut on all four sides (layout/live.md A11Y-5).
 *       Hence the inset variant." (LAYOUT_SPEC_DRAFT.md:400-406)
 *       Two things kill it here. The band draws NO `overflow: hidden` at all - see the
 *       corner note on `.cap` - so there is nothing to clip; and the ring inside the
 *       band is the INSET offset, because a cap sits flush against the band's border
 *       and an outset ring would paint over it and over its neighbour. One treatment,
 *       the documented second offset (CONVENTIONS.md section 3).
 *
 *   L22 (the value-cell half) "A11Y: rail value cells are `tabindex="-1"`"
 *       (app.js:91). An editable value cell here is a real <button>: in the tab order,
 *       operable from the keyboard, and 110 x 62 - past the --ui-hit-min floor on both
 *       axes. A cell that is NOT editable carries no tabindex at all rather than -1;
 *       "unreachable" and "not interactive" are different statements.
 *
 *   Section 2.4's default of hiding overflow. `.slate-stepper` is on the spec's list of
 *       places where "hidden is the default answer everywhere except the numpad ... At
 *       no point does anything tell the user content was removed"
 *       (LAYOUT_SPEC_DRAFT.md:222-228). A value too long for its cell ellipsises - the
 *       one form of clipping that says so - and the full text stays in the accessible
 *       name, so nothing is removed silently.
 *
 *   L9 (the structural half only). "Every rail stepper draws its seam TWICE (component
 *       inset shadow + Live border)" (slate-components.css:588 + slate-live.css:610-615).
 *       The shadow boundary makes the second drawer inexpressible: a screen cannot
 *       reach `.cap` to add a border. The Live row's own rule is that row's to delete
 *       (CONVENTIONS.md section 13 - "retiring L9 takes this utility AND those two
 *       rows"), so only this half is claimed.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY NOT HERE
 * ---------------------------------------------------------------------------
 *   - NO LIMITS TABLE, and no defaults that stand in for one (B2). `min` and `max`
 *     unstated means unbounded, not "some sensible range".
 *   - NO SELECTION TREATMENT and no import of `selectionSurface`. See the wave law
 *     above.
 *   - NO NUMPAD. The value cell reports that it was pressed and stops there; the numpad
 *     is item #53 and the dialog is #18.
 *   - NO PRESS-AND-HOLD REPEAT. It is a timer, and a timer is behaviour with a cleanup
 *     obligation; adding one later is additive and reverses nothing.
 *   - NO `field-sizing: content` INPUT FORM. Slate's Settings variant puts a real
 *     <input> in the cell with an @supports fallback (:935-981). Here the cell is one
 *     box with two content forms - a button when `editable`, plain text otherwise - and
 *     text entry belongs to the numpad both variants already open.
 *   - No `!important`, no raw colour literal, no @font-face, no `@media (width...)`.
 */

import { css, html, nothing, svg } from 'lit';

import { UiElement, visuallyHidden } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';

/**
 * THE CAP GLYPHS, and they are the DEFAULT rather than a caller's job — parity
 * surface 0.
 *
 * Slate draws an inline SVG in each cap and sizes it from the component:
 * `.slate-stepper > button > svg { display: block; width: var(--slate-space-5);
 * height: var(--slate-space-5) }` (slate-components.css:582-586), 24px, with the
 * note "The markup ships 36px glyphs and Live alone scaled them down, so the same
 * stepper drew a 24px +/- on the rail and a 36px one in Settings."
 *
 * ORACLE: of the 144 stepper caps in the 49 baseline states, 116 render with EMPTY
 * text — the SVG — and 28 render the text glyphs. The 28 are exactly the two
 * hand-built continuation steppers on the Live rail (#steam-flow-minus/-plus and
 * #hot-water-temp-minus/-plus, seven states each), which are markup Slate wrote by
 * hand rather than the component's own default. So the SVG is Slate's default and
 * the text pair is Slate's exception — which is why the SLOTS STAY: a caller that
 * wants the text form (or any other mark) still passes it, and the two Slate sites
 * that do so remain expressible.
 *
 * THE PATHS ARE SLATE'S OWN, taken from its markup unchanged
 * (`slate/app/index.html:150,152` and `src/ui/Minus.svg` / `Plus.svg`): the same
 * `0 0 50 50` box, the same coordinates, the same 3px round-capped stroke. Only the
 * ink is retargeted — `currentColor` rather than the file's `#121212` literal, which
 * is what Slate's own inlined copy already does and what Gate C requires: the cap's
 * colour is `--ui-muted` on `.cap`, and a glyph that named its own colour would be a
 * second source for it and would not dim with the cap's disabled state.
 *
 * `aria-hidden` because the accessible name is the button's `aria-label`; a glyph
 * that named itself would say it twice.
 */
const MINUS_GLYPH = svg`<svg class="glyph" viewBox="0 0 50 50" aria-hidden="true"
    fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"
    stroke-linejoin="round"><path d="M10.416 25H39.5827"/></svg>`;

const PLUS_GLYPH = svg`<svg class="glyph" viewBox="0 0 50 50" aria-hidden="true"
    fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"
    stroke-linejoin="round"><path d="M24.9993 10.4165V39.5832M10.416 24.9998H39.5827"/></svg>`;

/** Direction constants, so nothing in here reads a bare 1 or -1. */
const UP = 1;
const DOWN = -1;

class UiStepper extends UiElement {
    static properties = {
        /** The quantity. A number; the display form is derived, never stored twice. */
        value: { type: Number },

        /**
         * THE LIMITS, AND THEY ARRIVE FROM OUTSIDE (B2). Unstated is unbounded - null,
         * not a number this file picked. `machine-limits.js` (the port) or ReaPrime's
         * served ranges (R2, possibly F2 underneath) hand these down; nothing here
         * knows a steam temperature from a grind setting.
         */
        min: { type: Number },
        max: { type: Number },

        /** The increment. Also data: a fan threshold and a flow rate do not share one. */
        step: { type: Number },

        /** The unit, printed after the number in the one lockup Slate settled on. */
        unit: { type: String },

        /** The accessible name of the whole control - a cross-root label cannot see in. */
        label: { type: String },

        /**
         * WHERE THE CONTROL'S OWN NAME IS DRAWN: `none` (the default) or `start`.
         *
         * `none` is what every stepper in the skin shipped until now - the name is the
         * accessible name and nothing else, because a stepper in a settings row or an
         * editor cell sits under a label the ROW already draws. The Live rail draws no
         * such label, and three identical wells reading an em dash apiece is finding
         * cmp-lo-3: "Dose and Drink weight (both unit g when loaded) cannot be told
         * apart by sight". Ben's ruling (21 Aug 2026): a visible label to the LEFT of
         * every rail stepper, the well filling the rest of the row.
         *
         * ONE STRING, TWO JOBS, AND STILL ONE SOURCE. `start` does not add a second
         * property to keep in step: the same `label` becomes the visible microcap AND
         * the group's accessible name, and the name is then taken FROM the visible
         * element (`aria-labelledby`) rather than restated beside it - so the two
         * cannot disagree. One caveat, the same one ui-data-grid's suite records:
         * Chrome computes an accessible name from RENDERED text, so through
         * `aria-labelledby` the microcap's `text-transform: uppercase` reaches the
         * AX name ("DRINK WEIGHT" for a label written "Drink weight") - measured in
         * the review's AX-tree probe. Slate's own rail labels are uppercased by CSS
         * the same way, so that is parity, not drift.
         *
         * Reflected, so the attribute a consumer writes is the state a suite reads.
         */
        labelPosition: { type: String, attribute: 'label-position', reflect: true },

        /**
         * HIDE THE NAME FROM SIGHT WITHOUT HIDING IT FROM THE ACCESSIBLE NAME.
         *
         * Ben, 30 August 2026, on the Live rail's two continuation rows: "lets remove all
         * these little sub headings ... we dont say this for any of the others and we have
         * units so its mostly clear what it does." FLOW sits over a well reading mL/s and
         * TEMPERATURE over one reading degrees, so the unit already says which row it is.
         *
         * IT IS NOT `display: none`, and that distinction is the whole point of this
         * property. The label carries `id="label"`, and the band below is named by
         * `aria-labelledby="label"` — remove the node from the accessibility tree and the
         * control loses its name entirely. The shared `visuallyHidden` fragment keeps it
         * rendered, laid out and announced (base.js: "NOT display: none, NOT
         * visibility: hidden, NOT width: 0 ... which is the one thing this must not do").
         *
         * THE COLUMN DOES NOT COLLAPSE. `label-position="start"` sizes its first track
         * from `--ui-stepper-label-w`, a declared width rather than the label's content,
         * so a hidden name leaves the rail's wells where they were.
         */
        labelHidden: { type: Boolean, attribute: 'label-hidden', reflect: true },

        /**
         * `regular` | `compact` - C3's named density. Reflected so the attribute
         * selector below is the same state a test and a screen both read.
         */
        density: { type: String, reflect: true },

        /** Paint on the host from --ui-opacity-disabled; behaviour on the controls. */
        disabled: { type: Boolean, reflect: true },

        /**
         * Does pressing the value cell open something? Default NO. A button that
         * promises `aria-haspopup="dialog"` and opens nothing is a worse defect than a
         * plain readout, so the promise is opt-in and the consumer keeps it.
         */
        editable: { type: Boolean },

        /**
         * A word under the value, or empty for none.
         *
         * Slate's lever target is the case that asked for it: `9.0 bar` with `classic`
         * beneath, inside the same value box. Not a label and not a unit - see the
         * render for why the three are different things.
         */
        note: { type: String },

        /**
         * The value is a STATE rather than a number - the limiter switched off, and
         * nothing else today.
         *
         * REFLECTED, because the sheet styles on it. The caller decides: this component
         * cannot tell an off value from a zero one, and guessing that zero means off
         * would be wrong for every stepper whose zero is a real setting.
         */
        off: { type: Boolean, reflect: true },

        /**
         * THE STEP FUNCTION, OPTIONAL, AND THE OTHER HALF OF B2.
         * `next(value, direction, { min, max, step }) -> number`. The carried
         * `machine-limits.js` pattern is "a clamp that understands the steam hole
         * (0-or-working-band), and a step that SKIPS the hole" (CARRY_FORWARD.md) -
         * knowledge this component must not contain and must not prevent. When it is
         * absent the arithmetic below applies; when it is present it decides, and the
         * result is used as given.
         */
        next: { attribute: false },

        /** `format(value) -> string`, for a cell like Slate's "40g (1:2.4)". */
        format: { attribute: false },

        /**
         * THE BAND AS THE SCREEN ALREADY SPELLS IT — optional, and it WINS over the
         * `min`/`max` sentence derived below. (Audit F-047, 29 August 2026.)
         *
         * THE DEFECT. `#rangeHint` says "Range {min} to {max}", which is true of the two
         * numbers it is handed and false of the band whenever those two numbers are not the
         * whole story. `steamTemp` is exactly that row: `min` is 0 because zero is how the
         * machine is told "no steam", and the working band starts at 135 — so the row PRINTS
         * "135–170 °C" beside a stepper that ANNOUNCES "Range 0 to 170 °C". Twenty-one of
         * the twenty-two banded rows in settings agree with themselves; that one does not,
         * and the disagreement is invisible to everyone who can see the screen.
         *
         * SO THE SENTENCE IS TOLD, NOT DERIVED, WHERE A CALLER HAS ONE. `bandHint` in
         * `machine-limits.js` is the single author of that line and the settings row is
         * already drawing its answer; handing the same string down makes the printed hint
         * and the announced hint one string rather than two spellings of one band. A caller
         * with nothing to say passes nothing and gets the derived sentence exactly as
         * before — this is an addition to the contract, never a replacement.
         *
         * IT IS NOT A LIMIT AND IT DOES NOT CLAMP. B2 still holds: `min` and `max` are what
         * bound this control, and a `hint` that disagreed with them would be a label lying
         * about a range, which is the defect the derived sentence exists to prevent. It is
         * for the one shape the two numbers cannot express — a band with a hole in it.
         */
        hint: { type: String },

        /** Overridable so the control is not hard-wired to one language. */
        decreaseLabel: { type: String, attribute: 'decrease-label' },
        increaseLabel: { type: String, attribute: 'increase-label' },
    };

    static styles = [typeRoles, visuallyHidden, css`
        :host {
            /* THE CAP, AND C3'S NAMED DENSITY.
             * --ui-stepper-cap is 78px, the value section 3.1 resolved the
             * four-values-for-one-job disagreement to and the value the oracle
             * measures: settings-machine-steam <button> [i=51] rect w=78, and
             * 1640 - 1561 - 1 hairline = 78 from the value cell's own left edge.
             *
             * The compact band re-declares the CAP, never --ui-density. tokens.css
             * (the density block) states why in full: "C3's named compact is a subtree
             * re-declaration that wins locally. It cannot be a subtree re-declaration
             * of --ui-density: var() substitutes at computed-value time on the element
             * that DECLARES the custom property, so --ui-band-h is already resolved on
             * :root and a descendant's --ui-density does not re-derive it. C3
             * re-declares the cap/band token it wants, not the multiplier."
             * It is spelled --_ui-cap and not --ui-stepper-cap because guard 4
             * (private-palette) fails any component that re-declares a public token -
             * bug L12's shape. A private property may READ a public one; that is the
             * whole of the mechanism. */
            --_ui-cap: var(--ui-stepper-cap);

            /* The value cell's floor, and the only length here the oracle measured
             * rather than derived: prov_query.py find --cls slate-stepper-value ->
             * 85 elements in 16 states, ONE distinct geometry, 110 x 62. In Slate this
             * width is an accident of minmax(0, 1fr) in a 268px box - which also means
             * the number is the first thing to disappear when the box shrinks. Here the
             * same 110 is a FLOOR, and it is what the host's own floor is built from. */
            /*
             * THE NUMBER MOVED TO tokens.css (parity 7-live-polish) and this alias is
             * what the rest of this file goes on reading. The Live rail has to align
             * its preset banks and its stop-condition toggles to the same well the
             * stepper computes, which means spelling the same min() outside this
             * component - and a second copy of the one width the oracle measured is
             * exactly the drift a token exists to prevent. */
            --_ui-value-min: var(--ui-stepper-value-min);

            /* THE HIT FLOOR, ENFORCED IN THE TRACK ITSELF (Appendix 5). --ui-hit-min is
             * physically justified rather than taste - "a wet fingertip is about 9mm; at
             * this panel's density that is ~48px" - so a cap may be retargeted smaller
             * by a consumer and still may not RENDER smaller. max() makes that
             * structural instead of a comment claiming it, which is precisely bug P4's
             * shape: "measured 64x64, so --slate-hit-min is silently not applied where
             * the comment says it is". */
            --_ui-cap-used: max(var(--ui-hit-min), var(--_ui-cap));

            /* THE WELL, IN ITS TWO FORMS, FROM THE SAME THREE NUMBERS.
             *
             * --_ui-well is the control at its stated size: two caps, the value cell's
             * floor, and the two hairlines - 78 + 110 + 78 + 2 = 268, the oracle's one
             * distinct geometry, arrived at rather than typed.
             *
             * --_ui-well-floor is the same control with both caps on --ui-hit-min:
             * 48 + 110 + 48 + 2 = 208. It is what the control can be squeezed to
             * WITHOUT breaking L22, and it exists because label-position="start"
             * needs a number for "what the well must keep" before it can say what the
             * label may have. Nothing renders at this size unless the row is too
             * narrow for the stated one; the caps read it themselves, in .band. */
            --_ui-well: calc(
                2 * var(--_ui-cap-used) + var(--_ui-value-min) + 2 * var(--ui-border-w));
            --_ui-well-floor: calc(
                2 * var(--ui-hit-min) + var(--_ui-value-min) + 2 * var(--ui-border-w));

            /* AN EXPLICIT FLOOR, STATED (spec section 2.4). Below it the control
             * overflows its parent VISIBLY. That is T9's principle applied here: a
             * control holds its stated size, and a row that runs out of space gives up
             * somewhere a reader can see.
             *
             * It has to be arithmetic and not min-content: the base puts
             * container-type: inline-size on the host, and inline-size CONTAINMENT
             * means the host's inline size may not depend on its contents, so
             * min-content resolves to 0 (CONVENTIONS.md section 2). */
            min-inline-size: var(--_ui-well);
        }

        /* ===================================================================
         * THE LABELLED FORM (finding cmp-lo-3; Ben's ruling, 21 Aug 2026)
         *
         * Two columns: the name, then the well filling everything that is left.
         * Slate's shape, read off its own rail rather than off a sketch -
         * CITE live-ready #grind-label [i=18] rect [28,165,88,20] and
         * #hotwater-label [i=74] rect [28,991,108,41] beside .slate-stepper
         * [i=19] rect [134,143,268,64]: the labels are width:auto (their own 130px class is overridden)
         * inside the 106px between the rail's inset and the well, they WRAP when
         * their words are long (Hot Water is two lines, 41px tall) and the well
         * is 268 whatever the label does.
         *
         * THE LABEL COLUMN IS WHAT THE ROW CAN PAY, NOT A NUMBER THIS FILE PICKED.
         * --ui-stepper-label-w is the most it ever wants (tokens.css derives it from
         * the rail's own widest form); the min() below is the row's own answer when
         * the rail is narrower than that, and it reserves the WELL's hit-floor form
         * first - so the label takes the slack and the caps give theirs down to
         * --ui-hit-min and no further. MEASURED, all three geometries, espresso:
         *
         *   rail interior 424 (1920 wide)  label 144, well 268, caps 78  <- stated size
         *   rail interior 297 (bench 1281) label  77, well 208, caps 48  <- hit floor
         *   rail interior 284 (floor 1000) label  64, well 208, caps 48  <- hit floor
         *
         * so the well is Slate's exact 268 with a 110px value cell at the reference
         * width, and on the bench tablet the caps - never the number - pay for the
         * label. Below 268 of row the host's own min-inline-size stops the squeeze
         * and the control overflows where it can be seen, exactly as it always did.
         * =================================================================== */
        :host([label-position="start"]) {
            display: grid;
            grid-template-columns:
                min(var(--ui-stepper-label-w),
                    calc(100% - var(--ui-space-4) - var(--_ui-well-floor)))
                minmax(0, 1fr);
            align-items: center;

            /* THE GUTTER IS SLATE'S 18, PARITY SURFACE 1. It was --ui-space-3 (12).
             * Slate's rail row is 28 (inset) + 88 (name) + 18 (gutter) + 268 (well) + 28
             * = 430, so the gutter is the one term between the name column and the well
             * and it is 18, not 12. The label-position="start" form is the Live rail's
             * alone (it is the only caller in the tree), so this moves the rail and
             * nothing else; the unlabelled form has no gutter to spend.
             * ORACLE  state=live-ready element=[23] <span id="dose-label">
             *         rect=[28,256,88,20] and element=[24] <div class="slate-stepper">
             *         rect.x=134: 28 + 88 = 116, and 134 - 116 = 18. */
            column-gap: var(--ui-space-4);
        }

        :host([density="compact"]) {
            /* C3. The editor's step matrix packs N step columns across the width and
             * 78px caps cost 28px per step against 64 - "real money at five steps"
             * (OQ-4). 64px is --ui-control-h, the row height every control in the skin
             * already shares, so the compact cap is a SQUARE cap and is derived rather
             * than the editor's typed 64. Same component, named state, one
             * implementation. */
            --_ui-cap: var(--ui-control-h);
        }

        /* ONE CONTINUOUS INSTRUMENT, SEAMS NOT GAPS - Slate's own header at
         * slate-components.css:540. The seams are the caps' inset shadows below; a
         * gap here would show the band's own background through, which is a different
         * mechanism and a different weight (CONVENTIONS.md section 13, "what this is
         * not"). */
        .band {
            box-sizing: border-box;
            display: grid;

            /* THE CAP THE ROW CAN ACTUALLY PAY FOR. The stated cap while there is
             * room for it, and never below --ui-hit-min: a wet fingertip is 9mm
             * whatever the row is doing (Appendix 5, bug P4's shape).
             *
             * This changes NOTHING for an unlabelled stepper, and that is checked
             * rather than hoped: the host's min-inline-size is --_ui-well, so the
             * band is never narrower than 2 caps + the value floor + the hairlines,
             * and min() lands on the stated cap exactly - 268 - 2 hairlines = 266,
             * (266 - 110) / 2 = 78, the oracle's own number. It bites only in the
             * labelled form above, where the label has taken the row's slack and the
             * caps are what is left to give. Percentages in a track size resolve
             * against the grid container's content box, so 100% here IS the band. */
            --_ui-cap-fit: max(
                var(--ui-hit-min),
                min(var(--_ui-cap-used), calc((100% - var(--_ui-value-min)) / 2)));

            /* The three tracks, and Slate's own shape: a cap, the value taking the
             * slack, a cap. At the oracle's 268px that is 78 / 110 / 78 exactly.
             * The one addition is the value cell's FLOOR: Slate writes minmax(0, 1fr),
             * which lets the number collapse to nothing before the caps give up a pixel,
             * and the number is the whole point of the control. Below the floor the host
             * above stops shrinking and the control overflows where it can be seen. */
            grid-template-columns:
                var(--_ui-cap-fit)
                minmax(var(--_ui-value-min), 1fr)
                var(--_ui-cap-fit);
            align-items: stretch;

            min-block-size: var(--ui-control-h);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);

            /* Longhand, never the background shorthand: it resets background-clip,
             * which is the trap Slate's own sheet documents at slate-live.css:1565-1567
             * ("that is what turned the track into a 32px slab the first time"). */
            background-color: var(--ui-key);

            /* L24, HALF ONE. Slate clips this box and cuts every ring inside it on all
             * four sides; the ring in here is drawn INSIDE the element instead. This is
             * the private property, not a second treatment: same width, same ink, the
             * documented second offset (CONVENTIONS.md section 3). It is set on the
             * band rather than via the host attribute because the reason is structural
             * - a cap is flush against the band's border whatever the host says. */
            --_ui-focus-offset: var(--ui-focus-offset-inset);
        }

        /* ===================================================================
         * THE NAME CELL — the label, and whatever a caller puts under it
         * ===================================================================
         * The first grid track used to BE the label span. It is now a box holding the
         * label and a slot named 'caption' beneath it, because Slate's rail draws two
         * of its nine rows that way and this component owned the whole cell:
         *   ORACLE live-ready #steam-label [i=48] "Steam" rect [28,613,68,20] with
         *          #steam-capability [i=49] "Timed stop" rect [28,640,81,14] under it;
         *          #hotwater-label [i=74] / #hot-water-capability [i=75] the same.
         *
         * A SLOT, NOT A PROPERTY, and that is the whole reason it is cheap. The caption
         * on those two rows is L25's restored CONTROL (see live-targets.js), so it is a
         * button with items, a value and an event — none of which this component should
         * learn. A slot takes any of it and this file keeps knowing nothing: no caption
         * text, no options, no stop conditions, and no second look to maintain.
         *
         * NOTHING CHANGES FOR A CALLER THAT SLOTS NOTHING. An empty slot is an empty
         * box, the cell is the label's own height as before, and align-items: center
         * on the host still centres the cell against the well. Measured: the seven rail
         * rows with no caption render at the same y they rendered at before the slot
         * existed. */
        .name {
            display: block;
            min-inline-size: 0;
        }

        /* THE VISIBLE NAME. A microcap, which is the role the token sheet already
         * derived FROM this element - type-roles.js quotes Slate's own rail label
         * (17px / 600 / uppercase / 0.12em -> --ui-text-sm / --ui-weight-semibold /
         * --ui-tracking-cap), so nothing about its look is decided here.
         *
         * IT WRAPS AND IT NEVER HIDES. Slate's own labels wrap (Hot Water is two
         * lines) and this file has less room than Slate did on the bench tablet, so
         * overflow-wrap: anywhere is what a word longer than its column does
         * instead of overflowing into the well or being clipped away - spec section
         * 2.4's rule is that content is never silently removed, and a broken word is
         * visibly broken. Three lines of it still clear --ui-control-h (3 x 18 = 54
         * against 64), so a long name costs the rail no height.
         *
         * NO min-inline-size AND NO ellipsis: the column is stated on the host, and
         * an ellipsis here would be the one form of hiding the label cannot afford -
         * it is the only thing telling two identical wells apart. */
        .label {
            /* A BLOCK, so it fills the name cell rather than shrinking to its text.
             * It used to BE the grid item and got that for nothing; wrapping it in
             * .name made it an inline span whose box is the words, and the rail's own
             * gutter measurement went from 18px to 24.89 because the 88px column was
             * being measured from the end of "GRIND" instead of from the end of the
             * column. Nothing about the paint changes — an inline span and a block
             * span put the same glyphs in the same place — only what the box reports,
             * which is what the cmp-lo-3 assertions read. */
            display: block;

            /* THE NAME'S SIZE IS A SEAM, and the default is the microcap role's own
             * (--ui-text-sm, 15px) so a caller that says nothing renders exactly what
             * this control has always rendered. Slate's rail draws its block headings
             * at 17px and the CONTINUATION rows under them at 12px - two sizes, one
             * control - and a component cannot know which a row is. So the row model
             * says (live-targets.js, the row's continuation flag) and the Live screen's
             * own sheet fills this property; nothing here decides. */
            font-size: var(--_ui-stepper-label-size, var(--ui-text-sm));

            /* MEASURED AND REJECTED FIRST: hyphens: auto, so a word longer than its
             * column would break as TEMPERA- / TURE rather than TEMPERA / TURE. It
             * changes zero pixels in the engine every gate runs in - written, rendered
             * and read back at the bench with the document's own lang="en" in place -
             * so it is not here. A declaration that does nothing is a claim nobody
             * checked.
             *
             * THE BREAK IS A SEAM TOO, and anywhere stays the default. Slate's own rail
             * lets a name that does not fit its column KEEP ITS WORD and overflow into
             * the 18px gutter instead of breaking: ORACLE live-ready #hotwater-label
             * [i=74] rect [28,991,108,41] is 108 wide in an 88 column, running 2px into
             * the well. A caller with one long word and a gutter to spend says so; a
             * caller that says nothing still breaks rather than overflow, which is the
             * safe answer when nobody has measured the row. */
            overflow-wrap: var(--_ui-stepper-label-wrap, anywhere);
        }

        .cap {
            /* Slate's measured note, kept verbatim because the fix is not obvious:
             * "this rule used to set no display at all -- so the buttons resolved to
             * display: block, where a button's inherited text-align: center still
             * centres TEXT but does nothing for a replaced inline element. Measured:
             * the SVG glyphs sat 26.5px left of centre in a 78px cap, hard against the
             * edge, while the two text rows looked correct." */
            display: inline-grid;
            place-items: center;

            box-sizing: border-box;
            min-block-size: var(--ui-control-inner);
            min-inline-size: 0;
            padding: 0;
            border: 0;

            /* L24, HALF TWO. Slate reaches for overflow: hidden on the band so the
             * caps cannot square off the outer radius. That one declaration is both
             * L24's clipper and an instance of section 2.4's "hidden is the default
             * answer everywhere" list, which names .slate-stepper (:549) by line. The
             * caps carry the corners themselves instead, so there is nothing to clip
             * and nothing to hide: a cap that grows a pressed or hovered face later
             * still lands inside the band's radius. */
            border-radius: 0;

            background-color: transparent;
            color: var(--ui-muted);

            /* A form control does not inherit type from its ancestors - the UA sheet
             * sets its own - and CONVENTIONS.md section 11 keeps font declarations off
             * :host precisely because they normally DO inherit. Restoring the
             * inheritance is what Slate's own reset does (app.css button, input,
             * optgroup, select, textarea { font-family: inherit }). */
            font-family: inherit;
            font-size: var(--ui-text-xl);
            /* Slate's own 300 on the cap — see departure 1 in the header, now closed. */
            font-weight: var(--ui-weight-light);
            line-height: 1;

            cursor: pointer;
            /* A wall panel operated with a wet hand: a mistimed second tap selects the
             * glyph instead of pressing the button. */
            -webkit-user-select: none;
            user-select: none;
        }

        /* The corners the band no longer clips, plus THE SEAM, DRAWN ONCE (L9's
         * structural half). An inset shadow offset one hairline outward paints a line
         * on the cap's inner edge; --ui-seam is the LENGTH token and --ui-seam-ink the
         * colour, named apart on purpose (tokens.css:550-553). Nothing outside this
         * shadow root can add a second.
         *
         * NAMED, NOT POSITIONAL, and this was a live defect before it was a comment.
         * Slate writes .slate-stepper > button:first-child / :last-child because its
         * band holds exactly three children. This band holds a FOURTH when a range is
         * stated - the visually-hidden hint the group is described by - so :last-child
         * stopped matching the plus cap the moment a limit arrived, and the cap lost
         * both its seam and its outer corner in exactly the states that have a range.
         * Position is not identity. */
        .cap-start {
            border-start-start-radius: var(--ui-radius);
            border-end-start-radius: var(--ui-radius);
            box-shadow: inset calc(-1 * var(--ui-seam)) 0 0 0 var(--ui-seam-ink);
        }

        .cap-end {
            border-start-end-radius: var(--ui-radius);
            border-end-end-radius: var(--ui-radius);
            box-shadow: inset var(--ui-seam) 0 0 0 var(--ui-seam-ink);
        }

        /* THE ICON SIZE IS THE COMPONENT'S, which is Slate's own conclusion:
         * "The markup ships 36px glyphs and Live alone scaled them down, so the same
         * stepper drew a 24px +/- on the rail and a 36px one in Settings."
         * display: block because "an inline SVG sits on the text baseline, which leaves
         * descender space below it and lifts the glyph off true centre". --ui-icon is
         * 24px, the same number Slate's --slate-space-5 carried, under the name that
         * says what it is (tokens.css:126, intrinsic icon geometry). */
        .cap .glyph,
        .cap ::slotted(svg),
        .cap ::slotted(img) {
            display: block;
            inline-size: var(--ui-icon);
            block-size: var(--ui-icon);
        }

        /* THE VALUE CELL. Slate's comment is the specification and is kept:
         * "ONE LINE BOX, the height of the cell: the unit sits after the number on its
         * own baseline and the pair centres vertically, because the line box IS the
         * cell. Flexbox cannot do both at once - align-items is either baseline or
         * center, and picking baseline floats the pair at the top." */
        .value {
            box-sizing: border-box;
            display: block;
            min-inline-size: 0;
            block-size: var(--ui-control-inner);
            padding: 0;
            border: 0;

            /* A recessed face says "you can press this" without borrowing the
             * underline, which already means selected here (Slate's note). 55% of the
             * seam ink, which is exactly what the corpus measures in both themes. */
            background-color: color-mix(in srgb, var(--ui-seam-ink) 55%, transparent);
            box-shadow: inset 0 var(--ui-seam) 0 0 var(--ui-seam-ink);
            color: var(--ui-text);

            text-align: center;
            font-family: inherit;
            /* One value size for every stepper in the skin. The same component was
             * rendering 40px in the editor and 18px in Settings. */
            font-size: var(--ui-display-xs);
            /* Slate's own 300 on the value — see departure 1 in the header, now closed. */
            font-weight: var(--ui-weight-light);
            /* A LENGTH, not a ratio: the line box IS the cell, which is the whole of
             * the lockup quoted above. Not the redundant 1.5 ratio DQ-216 is about. */
            line-height: var(--ui-control-inner);

            /* Section 2.4 without the silence: a value too long for its cell says so
             * with an ellipsis, and the full text is still in the accessible name. */
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* A NOTE MAKES THE VALUE TWO LINES, and the three declarations above that assume
         * one have to give.
         *
         * A line-height of --ui-control-inner makes the LINE BOX the cell - the whole
         * point of the single-line lockup - and a second line inside that is a second
         * cell height, which overflows and is clipped by the rule two lines up. Measured
         * before this: the word rendered, sat 4px below the value's box, and was cut.
         *
         * SO THE NOTE CASE STATES ITS OWN THREE. The line height goes back to a ratio,
         * the block size to a floor, and the stack centres what it holds. Every stepper
         * without a note is byte-identical to what it was. */
        :host([note]) .value {
            block-size: auto;
            min-block-size: var(--ui-control-inner);
            line-height: 1.1;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        button.value {
            cursor: pointer;
            -webkit-user-select: none;
            user-select: none;
        }

        /* Whatever is inside shares that one line: the number, and the unit beside it. */
        .num,
        .unit {
            display: inline;
            line-height: inherit;
        }

        /* THE NUMBER'S OWN INK, WHICH ARRIVES FROM OUTSIDE (parity surface 1). Slate
         * paints a rail target's number in the colour of the channel that target
         * commands and leaves the rest plain, so the seam is a custom property with the
         * cell's ink as its default: this component owns no channel table, exactly as
         * <ui-stat-tile> owns none, and the table lives with the rows (live-targets.js).
         * A stepper nobody hands an ink to is unchanged, which is every stepper in
         * Settings and both of the rail's own untinted rows.
         *   ORACLE live-ready [i=45] the span inside #temp-value, text "84",
         *          color = rgb(221, 98, 84), winning rule slate-live.css
         *          {#main-page #temp-value [data-rail-number]} authored
         *          var(--slate-data-target-group-temperature) !important
         *          [= --ui-channel-target-group-temperature #dd6254]. */
        .num {
            color: var(--_ui-stepper-number-ink, inherit);
        }

        /* THE NOTE'S STACK. Two lines where a note is set, one where it is not - the
         * value keeps the whole cell to itself and nothing moves for the common case.
         * The stack is centred on both axes because the value well is. */
        .stack {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-inline-size: 0;
        }

        .line {
            display: flex;
            align-items: baseline;
            gap: var(--ui-space-1);
        }

        /* ORACLE: Slate draws the word muted and small under the number, in the same
         * value box - .pe-value-line holds the number and unit, and the feel word
         * follows on its own line. --ui-text-2 and one step down is what the unit beside
         * it already uses, so the two read as one lockup.
         *
         * NO BACKTICK IN THIS TEMPLATE, comment or not. */
        .note {
            color: var(--ui-text-2);
            font-size: var(--ui-text-sm);
            line-height: 1.1;
        }

        /* ONE UNIT LOCKUP: the unit sits AFTER the number, muted, one step down, and
         * slightly opened.
         *
         * SLATE-INCONSISTENT, RESOLVED THE LIVE PAGE'S WAY (parity surface 1). Slate
         * draws this same unit at two sizes with two trackings, and the difference is
         * which screen the control is on:
         *   ORACLE live-ready <small> [i=28] "g" font-size = 18px, letter-spacing =
         *          0.54px, color = rgb(148,161,169), font-weight = 400  <- slate-live.css
         *          {#main-page #drink-ratio-value, .slate-value-note, [data-rail-unit],
         *          .slate-stepper-value small} authored var(--slate-text-md) !important
         *          and .03em — 56 records in the corpus, every one on the Live rail
         *   ORACLE settings-machine-hot-water .slate-stepper-unit [i=78] "mL/s"
         *          font-size = 14px, letter-spacing = normal  <- authored
         *          var(--slate-text-sm) — 20 records, every one in Settings
         * One component cannot draw both. Ben's tie-break is the Live page's treatment
         * ("the live page on slate has had the most work"), and his own formulation of
         * the rule names this case exactly — "rail controls the Live page's". So the
         * unit is 18px at .03em everywhere, and Settings' steppers come with it. It read
         * --ui-text-2xs (14px) with no tracking until this pass, which was Slate's
         * SETTINGS treatment applied to the Live rail.
         *
         * Slate's own reason for the rest of the lockup, kept verbatim
         * (slate-live.css:678-687): "THE UNIT, once, for every control on the rail — and
         * the same treatment the profile editor gives its own steppers (.pe-value-unit):
         * under the number, muted, a clear step down in size, regular weight. It was four
         * different things here." Four became one there; two become one here. */
        .unit {
            margin-inline-start: var(--ui-space-1);
            color: var(--ui-muted);
            font-family: inherit;

            /* SLATE'S 14, AND IT IS A LITERAL BECAUSE THE SCALE HAS NO 14.
             *
             * Ben, 25 August 2026, choosing between the two measurements: "Use slates
             * 14". ORACLE .pe-value-unit reads 14px against a 28px value - the unit is
             * exactly half the number. This was --ui-text-md, which resolves to 18
             * against our 27, so the measure read as two thirds of the reading rather
             * than half of it, and a value and its unit looked like two numbers.
             *
             * THE SCALE HAS 12 AND 15 AND NOTHING BETWEEN. Rounding to either would
             * miss Slate by three pixels on a mark that appears beside every number in
             * the skin. The number is stated once, here, with its oracle - which is the
             * same standing this file gives Slate's other measured constants. */
            font-size: 14px;
            font-weight: var(--ui-weight-regular);
            letter-spacing: var(--ui-tracking-unit);
        }

        /* AN OFF VALUE IS NOT A READING, AND THE TYPE SAYS SO.
         *
         * Ben, 25 August 2026: "Use 27/300 but make off muted ink & can we remove the
         * unit if its off?" Both, and the second is the sharper half - "OFF bar" reads
         * as a quantity in bar, which is the one thing it is not.
         *
         * THE SIZE AND WEIGHT DO NOT MOVE. Slate drops to 20/500 for its own OFF; his
         * call is to keep the value's 27/300 so the cell does not jump as a limiter is
         * switched on and off, and to carry the difference in the INK alone.
         *
         * WHY THE HOST AND NOT THE FORMATTER: the formatter returns a string, and a
         * string cannot say what it means. The off flag is the caller's own answer - the
         * row model already knows, because zeroLabel exists for exactly this state.
         *
         * NO BACKTICK IN THIS TEMPLATE, comment or not. */
        :host([off]) .num {
            color: var(--ui-muted);
        }

        /* ONE DIAL, PAINTED ONCE. <ui-stepper disabled> puts the attribute on the HOST
         * and the base paints --ui-opacity-disabled there; the controls carry the
         * native attribute so they genuinely stop accepting input, and the base paints
         * [disabled] inside a shadow tree too - which would compound to .38 x .38 =
         * .14, a control three times fainter than every other disabled control in the
         * skin. The host keeps the dial; the controls opt out. Specificity, not
         * !important (CONVENTIONS.md section 6). A cap at a RANGE END is a different
         * state and uses aria-disabled, which the base paints and this rule does not
         * touch - see #capState. */
        .cap:disabled,
        .value:disabled {
            opacity: 1;
        }
    `];

    constructor() {
        super();
        this.value = 0;
        this.min = null;
        this.max = null;
        this.step = 1;
        this.unit = '';
        this.label = '';
        this.labelHidden = false;
        this.labelPosition = 'none';
        this.density = 'regular';
        this.disabled = false;
        this.editable = false;
        this.note = '';
        this.off = false;
        this.next = null;
        this.format = null;
        this.hint = '';
        this.decreaseLabel = 'Decrease';
        this.increaseLabel = 'Increase';
    }

    /* ---------------------------------------------------------------------
     * Numbers in, numbers out. No table, no knowledge of any quantity.
     * ------------------------------------------------------------------- */

    /** A stated limit is a finite number; anything else is "not stated" (B2). */
    static #limit(v) {
        const n = Number(v);
        return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n;
    }

    /** Decimal places of a literal, so 0.1 + 0.2 never reaches the screen as 0.30000000000000004. */
    static #decimals(n) {
        const s = String(n);
        const dot = s.indexOf('.');
        return dot < 0 ? 0 : s.length - dot - 1;
    }

    get #stepSize() {
        const n = Number(this.step);
        return Number.isFinite(n) && n > 0 ? n : 1;
    }

    get #current() {
        const n = Number(this.value);
        return Number.isFinite(n) ? n : 0;
    }

    get #lo() { return UiStepper.#limit(this.min); }
    get #hi() { return UiStepper.#limit(this.max); }

    #clamp(n) {
        const lo = this.#lo;
        const hi = this.#hi;
        let out = n;
        if (lo !== null && out < lo) out = lo;
        if (hi !== null && out > hi) out = hi;
        return out;
    }

    /**
     * The next value in one direction. The optional `next` property decides when it is
     * given one - that is where the steam hole's 0-or-working-band lives, and it is
     * NOT here (B2). Otherwise: one step, clamped, rounded to the step's own precision.
     */
    #nextValue(direction) {
        const current = this.#current;
        const step = this.#stepSize;

        if (typeof this.next === 'function') {
            const supplied = Number(this.next(current, direction, {
                min: this.#lo, max: this.#hi, step,
            }));
            return Number.isFinite(supplied) ? supplied : current;
        }

        const raw = current + direction * step;
        const places = UiStepper.#decimals(step);
        return this.#clamp(Number(raw.toFixed(places)));
    }

    /** At a range end a cap does nothing, and must not keep looking live (Slate's note). */
    #atEnd(direction) {
        const lo = this.#lo;
        const hi = this.#hi;
        if (direction === DOWN) return lo !== null && this.#current <= lo;
        return hi !== null && this.#current >= hi;
    }

    /** The displayed number. Never fewer digits than the value actually has. */
    get #display() {
        if (typeof this.format === 'function') return String(this.format(this.#current));
        const places = Math.max(
            UiStepper.#decimals(this.#stepSize),
            UiStepper.#decimals(this.#current),
        );
        return this.#current.toFixed(places);
    }

    /**
     * THE RANGE HINT, READ FROM THE SAME TWO PROPERTIES THAT CLAMP. The carried
     * `machine-limits.js` pattern includes "a range hint read from the same declaration
     * so a label cannot claim a stale range" (CARRY_FORWARD.md); here that is
     * structural rather than a convention, because there is only one declaration to
     * read. No limits stated, no hint, and nothing invented.
     */
    get #rangeHint() {
        /* THE CALLER'S OWN SENTENCE WINS — see the `hint` property. It is the band already
         * printed beside this control, so announcing anything else would be two spellings
         * of one band, which is audit F-047 exactly. */
        const told = String(this.hint ?? '').trim();
        if (told) return told;
        const lo = this.#lo;
        const hi = this.#hi;
        const unit = this.unit ? ` ${this.unit}` : '';
        if (lo !== null && hi !== null) return `Range ${lo} to ${hi}${unit}`;
        if (lo !== null) return `Minimum ${lo}${unit}`;
        if (hi !== null) return `Maximum ${hi}${unit}`;
        return '';
    }

    /* ---------------------------------------------------------------------
     * Behaviour
     * ------------------------------------------------------------------- */

    #commit(direction) {
        if (this.disabled || this.#atEnd(direction)) return;
        const previous = this.#current;
        const value = this.#nextValue(direction);
        if (value === previous) return;
        this.value = value;
        this.dispatchEvent(new CustomEvent('change', {
            bubbles: true,
            composed: true,
            detail: { value, previous, direction },
        }));
    }

    #onEdit() {
        if (this.disabled || !this.editable) return;
        /* The numpad is #53's and the dialog is #18's. This says "pressed", with the
         * value, and stops - a component that opened its own overlay would be reaching
         * outside its own tree. */
        this.dispatchEvent(new CustomEvent('edit', {
            bubbles: true,
            composed: true,
            detail: { value: this.#current },
        }));
    }

    /**
     * Arrow keys, and Home/End only where a limit is actually stated. Additive to the
     * buttons' own Enter/Space, which is native and untouched.
     */
    #onKeydown(event) {
        if (this.disabled || event.altKey || event.ctrlKey || event.metaKey) return;
        let handled = true;
        switch (event.key) {
            case 'ArrowUp': case 'ArrowRight': this.#commit(UP); break;
            case 'ArrowDown': case 'ArrowLeft': this.#commit(DOWN); break;
            case 'Home': {
                const lo = this.#lo;
                if (lo === null) { handled = false; break; }
                this.#jumpTo(lo);
                break;
            }
            case 'End': {
                const hi = this.#hi;
                if (hi === null) { handled = false; break; }
                this.#jumpTo(hi);
                break;
            }
            default: handled = false;
        }
        if (handled) event.preventDefault();
    }

    #jumpTo(target) {
        const previous = this.#current;
        if (target === previous) return;
        this.value = target;
        this.dispatchEvent(new CustomEvent('change', {
            bubbles: true,
            composed: true,
            detail: { value: target, previous, direction: target > previous ? UP : DOWN },
        }));
    }

    /* ---------------------------------------------------------------------
     * Render
     * ------------------------------------------------------------------- */

    /**
     * aria-disabled, not the native attribute, for a range end: the cap stays in the
     * tab order so a keyboard user can find out WHY it does nothing, and the base
     * paints --ui-opacity-disabled on that spelling too. Slate supports both spellings
     * at slate-components.css:595-600 and this picks the one that keeps the control
     * discoverable. Suppressed entirely while the HOST is disabled, or the two dials
     * would compound.
     */
    #capState(direction) {
        return !this.disabled && this.#atEnd(direction) ? 'true' : nothing;
    }

    render() {
        const display = this.#display;
        const hint = this.#rangeHint;
        const spoken = [this.label, `${display}${this.unit ? ` ${this.unit}` : ''}`]
            .filter(Boolean).join(', ');

        /* A name is DRAWN only when there is one to draw. `label-position="start"` on a
         * stepper with no label would otherwise leave an empty column holding the well
         * off the start of its row - a gap nobody asked for, in the one place bug L5
         * says a rail may not have hand-tuned space. */
        const named = this.labelPosition === 'start' && Boolean(this.label);

        /* THE VALUE, AND UNDER IT A NOTE WHERE ONE IS SET.
         *
         * Ben, 25 August 2026, choosing Slate's lever cell: Slate prints the spring
         * preset under the target on a lever step - `9.0 bar` and then `classic`
         * (measured: `<span class="pe-value-number">9.0</span><span
         * class="pe-value-unit">bar</span>` with the word on a second line inside the
         * same value button). The word is INSIDE the control, not under it, so it
         * belongs to this component rather than to the cell that places it.
         *
         * IT IS NOT A SECOND LABEL. `label` names the control for a screen reader and
         * `unit` is the measure; the note is a word ABOUT the value that only some
         * values have. Absent, nothing is drawn and the cell is exactly what it was. */
        /* NO UNIT ON AN OFF VALUE. "OFF bar" reads as a quantity in bar; "OFF" reads as
         * what it is.
         *
         * THE PROPERTY IS STILL SET, so `spoken` above keeps the measure and an EDITABLE
         * stepper announces "Limiter, OFF bar" - the measure is dropped from the paint
         * only. A read-only stepper has no aria-label at all (see the div branch below):
         * its announcement is its text, and there "OFF" is the whole answer, because a
         * limit that is switched off is not switched off IN BAR. */
        const line = html`<span
                id="number"
                class="num ui-numeric"
            >${display}</span>${this.unit && !this.off
                ? html`<small id="unit" class="unit">${this.unit}</small>`
                : nothing}`;
        const cell = this.note
            ? html`<span class="stack"><span class="line">${line}</span
                ><small id="note" class="note">${this.note}</small></span>`
            : line;

        return html`
            ${named
                ? html`<span class="name"
                        ><span id="label"
                            class="label ui-microcap ${this.labelHidden ? 'a11y' : ''}"
                            >${this.label}</span
                        ><slot name="caption"></slot
                    ></span>`
                : nothing}
            <div
                class="band"
                role="group"
                aria-label=${named ? nothing : (this.label || nothing)}
                aria-labelledby=${named ? 'label' : nothing}
                aria-describedby=${hint ? 'range' : nothing}
                @keydown=${this.#onKeydown}
            >
                <button
                    id="decrement"
                    class="cap cap-start"
                    type="button"
                    aria-label=${`${this.decreaseLabel} ${this.label}`.trim()}
                    aria-disabled=${this.#capState(DOWN)}
                    ?disabled=${this.disabled}
                    @click=${() => this.#commit(DOWN)}
                ><slot name="decrement">${MINUS_GLYPH}</slot></button>

                ${this.editable
                    ? html`<button
                            id="value"
                            class="value ui-numeric"
                            type="button"
                            aria-haspopup="dialog"
                            aria-live="polite"
                            aria-label=${spoken || nothing}
                            ?disabled=${this.disabled}
                            @click=${this.#onEdit}
                        >${cell}</button>`
                    : html`<div
                            id="value"
                            class="value ui-numeric"
                            aria-live="polite"
                        >${cell}</div>`}

                <button
                    id="increment"
                    class="cap cap-end"
                    type="button"
                    aria-label=${`${this.increaseLabel} ${this.label}`.trim()}
                    aria-disabled=${this.#capState(UP)}
                    ?disabled=${this.disabled}
                    @click=${() => this.#commit(UP)}
                ><slot name="increment">${PLUS_GLYPH}</slot></button>

                ${hint ? html`<span id="range" class="a11y">${hint}</span>` : nothing}
            </div>
        `;
    }
}

customElements.define('ui-stepper', UiStepper);

export { UiStepper };
