/**
 * ui-switch — Wave 1 item #5, the Switch.
 *
 * Spec row (LAYOUT_SPEC_DRAFT.md §5.1 #5): "Switch | `slate-components.css:428-482`
 * — 22 uses | **Paint only** — geometry is 80 literals in `settings.js` (§3.1)."
 * That sentence is the whole brief: Slate's component sheet paints a switch and
 * declares no width or height at all, so every one of the twenty call sites in
 * `src/settings/settings.js` writes the geometry out by hand.
 *
 * THE DEFECT THIS COMPONENT RETIRES — bug T17 (§7.5): "Twenty hardcoded copies of
 * the switch geometry in template strings, including an undocumented derived
 * throw." The literals are `w-[100px] h-[50px]`, `size-[40px]`, `left-[5px]` and
 * `peer-checked:translate-x-[46px]`, twenty times each — eighty in total — and the
 * 46 is `100 − 40 − 2×5 − 4` written nowhere. §3.1: "Four tokens plus a derived
 * throw replaces eighty literals."
 *
 * So the rule this file lives by: NO length literal appears below. Every dimension
 * is `var(--ui-switch-*)` and the throw is the arithmetic, not its answer. The
 * rendering suite proves it the only way that counts — it retargets each of the
 * four tokens on `:root` and asserts the knob's travel re-derives. A file with 46
 * baked in passes every screenshot and fails that drill.
 *
 * TOKEN-ONLY (Part 10 §12, wf-w1-primitives). No data layer, no ReaPrime, no
 * endpoint. `checked` arrives from outside and leaves as a `change` event; the
 * component owns no state beyond the paint.
 *
 * SHAPE. The HOST is the control: `role="switch"`, `tabindex`, `aria-checked`. The
 * shadow tree is two painted boxes and nothing focusable, which is what lets the
 * accessible name come from the light DOM — `aria-label` on the host, or
 * `aria-labelledby` pointing at the settings row's own label, which could not
 * reach an input sealed inside a shadow root. Bug T15 records the cost of getting
 * this wrong in Slate: "four of twenty switches have no accessible name".
 *
 * ============================ ORACLE (prov-baseline, dark) =====================
 * `prov_query.py find --cls slate-switch` → 24 elements in 13 states, ONE distinct
 * geometry, 100 × 50, ×24. The two paint states and the disabled one are unanimous
 * across all 24, which is why this component reproduces them exactly.
 *
 * READ THIS FIRST — ORACLE vs SOURCE, AND WHY HALF THE CLAUSES BELOW SAY SOURCE.
 * Slate paints this control with the `background:`, `border:` and `border-radius:`
 * SHORTHANDS, and the provenance probe records authored text per longhand. For
 * every colour and every edge on the switch the tool therefore prints, verbatim,
 * `authored (NOT CAPTURED — set via a CSS shorthand)` — it flags rather than
 * guesses (Part 10 §4 carve-out). So below: the VALUE and the WINNING RULE are
 * oracle answers, quoted; the TOKEN NAME beside each is a read-only source read of
 * `slate-components.css:442-459` and `slate-shell.css:1027-1033`, labelled SOURCE.
 * A `var(--slate-*)` clause dressed as an oracle answer would be a claim the corpus
 * does not carry, in exactly the place the tool refuses to guess.
 *
 *   GEOMETRY — the one part the corpus does carry authored text for, because
 *   Tailwind writes it as longhands:
 *     ORACLE state=settings-display-wake-lock .slate-switch [i=46] <label class=
 *     "slate-switch relative flex items-center cursor-pointer flex-shrink-0
 *     w-[100px] h-[50px]"> rect=[1729,291,100,50]; property=width value=100px
 *     winning rule=app.css `.w-\[100px\]` authored `100px` !important=no;
 *     property=height value=50px winning rule=app.css `.h-\[50px\]` authored
 *     `50px` !important=no.
 *     ORACLE .absolute [i=48] <div class="absolute top-1/2 left-[5px]
 *     -translate-y-1/2 peer-checked:translate-x-[46px] size-[40px] rounded-full
 *     ..."> rect=[1780,296,40,40]; property=width value=40px winning rule=app.css
 *     `.size-\[40px\]` authored `40px` !important=no.
 *     → knob origin is +5,+5 on the host box (ORACLE knob-off [i=52] in
 *       settings-connection-scale rect=[1734,594,40,40] against its track
 *       [i=51] rect=[1729,589,100,50]) and the CHECKED knob sits at +51
 *       (1780 − 1729). Measured on all 24: dx=5 when off, dx=51 when on.
 *
 *   TRACK, OFF (state=settings-connection-scale element=[51])
 *     ORACLE property=background-color computed=rgb(26, 33, 39) winning rule=
 *     slate-components.css `.slate-switch input[type="checkbox"] + div` authored
 *     `(NOT CAPTURED — set via a CSS shorthand)` !important=yes (token-driven).
 *     SOURCE slate-components.css:445 `background: var(--slate-key) !important`
 *       → --ui-key (#1a2127 dark) = rgb(26, 33, 39) exactly.
 *     ORACLE property=border-top-color computed=rgb(58, 72, 82), same winning rule,
 *     authored `(NOT CAPTURED — set via a CSS shorthand)` !important=yes.
 *     SOURCE slate-components.css:443 `border: var(--slate-hairline) solid
 *       var(--slate-line) !important`  → --ui-line (#3a4852) exactly, at
 *       --ui-border-w (ORACLE property=border-top-width computed=1px, same rule,
 *       same NOT CAPTURED clause).
 *     ORACLE property=border-top-left-radius computed=6px winning rule=
 *     slate-shell.css `#subpage-host [class*="rounded-[67.5px]"], ... [class*=
 *     "rounded-full"]:not(.slate-keep-round):not([class*="size-["]), ...` authored
 *     `(NOT CAPTURED — set via a CSS shorthand)` !important=yes.
 *     SOURCE slate-shell.css:1033 `border-radius: var(--slate-radius) !important`
 *       → --ui-radius (6px). Note the authored class is `rounded-full`: the shell
 *       squares it back off and BEATS the component sheet's own radius, so the
 *       SQUARE is the rendered truth (§2.2 materials: square-cornered track).
 *
 *   TRACK, ON (state=settings-display-wake-lock element=[47])
 *     ORACLE property=background-color computed=rgb(23, 59, 77) winning rule=
 *     slate-components.css `.slate-switch input[type="checkbox"]:checked + div`
 *     authored `(NOT CAPTURED — set via a CSS shorthand)` !important=yes.
 *     SOURCE slate-components.css:450 `background: var(--slate-primary)
 *       !important`  → --ui-primary (#173b4d) = rgb(23, 59, 77).
 *     ORACLE property=border-top-color computed=color(srgb 0.258196 0.381804
 *     0.443608), same winning rule, same NOT CAPTURED clause.
 *     SOURCE slate-components.css:449 `border-color: color-mix(in srgb,
 *       var(--slate-primary) 72%, var(--slate-steel)) !important` — `border-color`
 *       is itself a shorthand over the four side longhands, which is why the probe
 *       records no authored text for `border-top-color` here either.
 *
 *   KNOB, OFF (state=settings-connection-scale element=[52])
 *     ORACLE property=background-color computed=rgb(82, 97, 107) winning rule=
 *     slate-components.css `.slate-switch input[type="checkbox"] + div + div`
 *     authored `(NOT CAPTURED — set via a CSS shorthand)` !important=yes.
 *     SOURCE slate-components.css:455 `background: var(--slate-line-strong)
 *       !important`  → --ui-line-strong (#52616b) = rgb(82, 97, 107).
 *   KNOB, ON (state=settings-display-wake-lock element=[48])
 *     ORACLE property=background-color computed=rgb(246, 251, 253) winning rule=
 *     slate-components.css `.slate-switch input[type="checkbox"]:checked + div +
 *     div` authored `(NOT CAPTURED — set via a CSS shorthand)` !important=yes.
 *     SOURCE slate-components.css:459 `background: var(--slate-on-primary)
 *       !important`  → --ui-on-primary (#f6fbfd) = rgb(246, 251, 253).
 *   KNOB radius — the one paint value the corpus DOES carry authored, because the
 *     sheet writes it as its own declaration:
 *     ORACLE state=settings-display-wake-lock [i=48] property=
 *     border-top-left-radius computed=4px winning rule=slate-components.css
 *     `.slate-switch input[type="checkbox"] + div + div` authored `4px`
 *     !important=yes  → --ui-radius-sm (4px), the token that number is.
 *
 *   DISABLED    ORACLE state=settings-machine-hot-water .slate-switch [i=82]
 *     <label class="slate-switch stopHotWaterAtWeightLabel relative flex
 *     items-center flex-shrink-0 w-[100px] h-[50px] opacity-40 cursor-not-allowed">
 *     property=opacity computed=0.55 winning rule=slate-components.css
 *     `.slate-switch:has(input[type="checkbox"]:disabled)` authored `0.55`
 *     !important=no.  NOT MATCHED — see DEPARTURES below.
 *
 * DISQUALIFICATION CHECK, run before any of the above was trusted:
 *   - T17 is the one bug on this row and it is a SOURCE defect (eighty literals),
 *     not a rendered one. The rendered geometry is not the bug and is matched;
 *     the authoring shape is the bug and is not reproduced.
 *   - Responsive behaviour has no Slate answer (98.4% frozen). §3.1 gives the four
 *     values as fixed px, and §2.3 permits them: this control does not respond to
 *     its container or to the viewport, and the suite asserts that as a fact at
 *     both standard geometries rather than leaving it implied.
 *   - No decision in DECISIONS.md settles switch paint differently.
 *
 * ============================ DELIBERATE DEPARTURES ============================
 *  1. DISABLED IS .38, NOT .55. Spec §3.7 settles `--ui-opacity-disabled: .38`
 *     against Slate's three live values, and CONVENTIONS §4 makes it the ONE
 *     disabled dial the base paints. Slate's own comment on that rule is worth
 *     keeping though, and it is kept: it dims "the switch AS ONE OBJECT" because
 *     "fading the track and the knob separately makes each blend with what is
 *     behind IT ... measured 7 levels apart on Stop at Weight". One opacity, on
 *     the host, over the composite — exactly one fade, at the spec's value.
 *  2. FOUR `!important` DECLARATIONS BECOME ZERO. Slate needs them because
 *     `app.css` utilities can reach the same divs. Nothing reaches into a shadow
 *     root (CONVENTIONS §6), so the same paint lands from plain class selectors.
 *  3. THE HOST OWNS ITS OWN FLEX SIZING. Slate writes `flex-shrink-0` at all
 *     twenty call sites; here `flex: none` is one declaration inside the
 *     component. Same rendering, one owner — the failure mode it forecloses is
 *     bug T9's ("it is a flex item with default shrink. Measured 214 in one leaf
 *     and 250 two rows below, inside a single screen").
 *
 * @fires change - {detail: {checked}}, composed and bubbling, after a user toggle.
 *                 Not fired for a programmatic `el.checked = x`, which is the
 *                 native checkbox contract.
 *
 * ============================ Q14 IS ANSWERED: shape="pill" ===================
 * The register question was whether the "toggle pill" (#56) is a component or an
 * attribute on this one. Ben's ruling (DQ-610, 21 Aug 2026): it is an attribute
 * here, and the wrapper goes — "keep the capability by giving #5 a `shape="pill"`
 * attribute and DELETE the #56 wrapper", because the pill LOOK may be wanted soon
 * and a component that is two corner radii is not a component.
 *
 * The evidence #56 was built to gather is worth keeping in one place, because it
 * is what makes the deletion safe rather than merely tidy:
 *
 *   - THE PILL IS NEVER RENDERED IN SLATE. `prov_query.py find --cls
 *     brightness-toggle-label` and `--cls brightness-toggle-checkbox` each searched
 *     all 49 states and found 0 elements; `main.css:414-451` has the classes and
 *     `app/src` has no markup, no JS and no test that uses them, and
 *     `window.handleBrightnessAutoToggle` (`settings.js:8751`) has zero call sites.
 *     Figma exported a control the app never built.
 *   - NONE OF ITS NUMBERS IS CARRIED. Spec §3.4 drops `main.css:424`'s
 *     machine-generated `border-radius: 2617.374px` by name and keeps
 *     `--ui-radius-pill` (9999px), which is the one thing this attribute uses.
 *   - NOTHING COMPOSED IT. Verified at the final review and again at the deletion:
 *     no screen, no leaf and no fixture mounted `<ui-toggle-pill>`; the settings
 *     screen's own suite asserts the absence (`test/settings-bespoke.test.mjs`
 *     Q14), and that assertion outlives the wrapper.
 *
 * TWO PROPERTIES AND NOT ONE, and the measurement is why: the track and the knob
 * paint from `--ui-radius` (6px) and `--ui-radius-sm` (4px), a step apart. A single
 * shape property collapses them — which the round form hides and the REVERSAL
 * exposes: measured, a one-property version restored to track 6 / knob 6 against a
 * bare switch's 6 / 4. So the attribute re-points one hook per token, and turning it
 * off is exact.
 *
 * @attr {string} shape - `pill` gives the track and the knob fully-round corners.
 *          Any other value (including none) is the default square-cornered switch.
 * @cssprop [--_ui-switch-radius=var(--ui-radius)] - the track's corner.
 * @cssprop [--_ui-switch-knob-radius=var(--ui-radius-sm)] - the knob's corner.
 *          Rendering-neutral by construction: the defaults are the same two tokens
 *          this file always painted, so the oracle's square-cornered track is
 *          unchanged for every existing use. They are `--_ui-*` privates rather than
 *          a re-pointing of the public tokens because Gate C's private-palette guard
 *          (bug L12) forbids the second — which is a real finding about this skin's
 *          own law: a shape variant CANNOT be built as an outside re-point, so the
 *          knob has to live on the component.
 */

import { css, html } from 'lit';

import { UiElement, visuallyHidden } from 'src/components/base.js';

export class UiSwitch extends UiElement {
    static properties = {
        /** ON when true. Reflected, because the paint is keyed on the attribute. */
        checked: { type: Boolean, reflect: true },
        /** Paint dims and input is refused. Reflected; the base dims the host. */
        disabled: { type: Boolean, reflect: true },
        /**
         * The track's shape. `pill` is the only value that paints anything different
         * (fully-round track and knob); everything else, including the default empty
         * string, is the square-cornered switch. Reflected, because the paint is keyed
         * on the attribute — the same construction as `checked` two lines up, and it
         * means a gallery state, a screen and a test all name one thing.
         *
         * DQ-610, Ben's ruling: this attribute IS #56 (see the header).
         */
        shape: { type: String, reflect: true },

        /**
         * NOBODY HAS READ THIS SWITCH YET — so it asserts nothing at all.
         *
         * Audit F-042 found the settings face painting a fallback dressed as a reading for
         * seconds after a reload, and round 1's fix gave every unanswered row a pending
         * face: disabled, dashed, asserting nothing. It named this component as the one
         * place that could not be made honest, in its own words: *"a disabled `ui-switch`
         * still announces checked/unchecked, so a pending switch asserts 'off' to a screen
         * reader even while it refuses input; `ui-switch` carries `role="switch"` and has
         * no third state"*. MEASURED on the tablet: Accessories › Cup Warmer booted with
         * the pre-warm switch reading FALSE for about four seconds while the server held
         * TRUE. Ben's ruling (D08, 30 August 2026): *"a switch whose source has not
         * answered renders as a skeleton/inert row, never a false 'off' ... a screen reader
         * must not hear 'off' while pending."*
         *
         * IT IS NOT A THIRD STATE, AND THE ARIA IS WHY. `aria-checked="mixed"` is defined
         * for `role="checkbox"` and NOT for `role="switch"` — ARIA 1.2 gives switch
         * true/false and nothing else — so a tri-state switch would ship an invalid value
         * that assistive technology is free to read as false: the same lie with more code
         * behind it. `pending` instead makes this element stop being a switch: `updated()`
         * drops the role, drops `aria-checked`, and takes it out of the tab order, so the
         * accessibility tree contains a generic with a sentence in it and no claim.
         *
         * DISTINCT FROM `disabled`, and the two are not interchangeable. Disabled is a
         * switch whose state is KNOWN and whose control is off — a master switch above it
         * is off, and drawing the machine's held value greyed out is true. Pending is
         * nobody knowing. A row can be both; `pending` wins, because a claim you cannot
         * make is not improved by adding that you also cannot change it.
         *
         * Reflected, because the paint is keyed on the attribute, exactly as `checked` is.
         */
        pending: { type: Boolean, reflect: true },

        /**
         * WHAT A SCREEN READER IS TOLD INSTEAD OF A STATE, while `pending`.
         *
         * A property rather than a string this file authors, because D2 puts translation
         * at the render site: the settings leaf holds the i18n controller and passes
         * `t('Not known')` down. A component that reached for the catalogue itself would
         * be a second place a leaf's words come from.
         *
         * EMPTY IS ALLOWED and renders no span at all — a pending switch with nothing to
         * say is still silent about its state, which is the whole requirement. The
         * sentence is the courtesy on top.
         */
        pendingLabel: { type: String, attribute: 'pending-label' },
    };

    static styles = [
        /* THE SHARED VISUALLY-HIDDEN TREATMENT, FIRST — it is a structural fragment and
         * CONVENTIONS §5 says structural fragments lead, so this component's own rules at
         * equal specificity still win on source order. It carries `.a11y`, which the
         * pending face renders its sentence into (see `render`). Before D08 this component
         * had no announced text at all: its name came from the row beside it and its state
         * from `aria-checked`, and neither is available while nobody has read it.
         */
        visuallyHidden,
        /* No `hitArea` import: the host IS the ink and it is 100 x 50, so both axes
         * clear --ui-hit-min (48px) with the paint alone. The utility exists for
         * controls whose ink is SMALLER than the floor (CONVENTIONS §5); pulling it
         * in here would add an overlay above a control that has no need of one.
         *
         * No `selectionSurface` either, and that is a judgement worth stating.
         * `aria-checked` is in the fragment's contract list, but a switch is not a
         * selection surface: the oracle paints its ON track from --slate-primary
         * (the primary-action fill), not from --slate-selected-face, and the four
         * dials exist for the ONE component that chooses among alternatives
         * (CONVENTIONS §4). Importing the fragment would repaint this track in
         * --ui-selected-face and lose the polarity the sheet documents. */
        css`
            /* ---------------------------------------------------------------
             * THE HOST IS THE CONTROL AND THE TRACK'S BOX
             * ------------------------------------------------------------- */
            :host {
                /* Slate's label is relative flex items-center flex-shrink-0
                 * at w-[100px] h-[50px]. Same box, from the tokens. */
                position: relative;
                display: inline-block;
                flex: none;
                inline-size: var(--ui-switch-track-w);
                block-size: var(--ui-switch-track-h);
                cursor: pointer;

                /* THE DERIVED THROW — bug T17's undocumented 46.
                 *
                 * Written exactly as styles/tokens.css:145-146 writes it, which is
                 * §3.1's "Throw is calc(track-w - knob - 2*inset - border),
                 * DERIVED, not the literal 46px":
                 *     100 - 40 - 2x5 - 2x2 = 46
                 * The border term is --ui-border-w-strong because the AUTHORED
                 * track in Slate is Tailwind's border-2 (the component sheet then
                 * overrides the rendered width to a hairline, which is why the
                 * measured gaps either side of the knob are 4 and 8 rather than 6
                 * and 6). Deriving from the authored 2px reproduces the measured
                 * dx=51 exactly; deriving from the rendered hairline would give 48
                 * and move the knob 2px. The oracle wins on the rendered position.
                 *
                 * PRIVATE (--_ui-), so the token-integrity check cannot mistake it
                 * for a missing token, and it is a length, never a colour
                 * (CONVENTIONS §7). */
                --_ui-switch-throw: calc(
                    var(--ui-switch-track-w)
                    - var(--ui-switch-knob)
                    - 2 * var(--ui-switch-inset)
                    - 2 * var(--ui-border-w-strong)
                );
            }

            /* Slate: cursor-not-allowed on the disabled label. The dimming itself
             * comes from the base's one disabled dial on the host. */
            :host(:is([disabled], [aria-disabled="true"])) {
                cursor: not-allowed;
            }

            /* ---------------------------------------------------------------
             * THE PILL (Q14 / DQ-610, Ben's ruling). #56 dissolved into this
             * attribute and the wrapper component is gone.
             *
             * TWO DECLARATIONS AND NOTHING ELSE. Geometry, paint, polarity, the
             * throw, the keyboard and the change event are all untouched: a pilled
             * switch and a bare one differ by two corner radii and by nothing that
             * can be measured anywhere else. The suite asserts exactly that, property
             * by property, which is the same proof the wrapper's own suite carried.
             *
             * --ui-radius-pill is spec 3.4's kept value (help-overlay.css:10, :113).
             * main.css:424's machine-generated 2617.374px is dropped by name in the
             * same table, and it is not here: any value at or above half the height
             * paints the identical shape.
             *
             * ONE PROPERTY PER TOKEN RE-POINTED. The track is --ui-radius (6px) and
             * the knob --ui-radius-sm (4px) - a step apart - so a single hook would
             * render the same pill and REVERSE to the wrong switch (measured 6/6
             * against 6/4). Nothing here is a colour, a size or a state.
             * ------------------------------------------------------------- */
            :host([shape="pill"]) {
                --_ui-switch-radius: var(--ui-radius-pill);
                --_ui-switch-knob-radius: var(--ui-radius-pill);
            }

            /* ---------------------------------------------------------------
             * THE TRACK — Slate's absolute inset-0 div, painted by CLASS
             * (CONVENTIONS §4 rule 2: ids are for tests, classes for the cascade)
             * ------------------------------------------------------------- */
            .track {
                position: absolute;
                inset: 0;
                border: var(--ui-border-w) solid var(--ui-line);
                /* SHAPE HOOK, added by Wave 4 #56 and now driven by this component's
                 * own shape="pill" (DQ-610; #56 is retired). The default is
                 * --ui-radius and nothing rendered moves: the token is still the
                 * value, reached through a private property with the token as its
                 * fallback — the idiom ui-favourite-slot uses at :375 and :468.
                 *
                 * Why the indirection exists at all: Gate C's private-palette guard
                 * forbids a component re-declaring a public --ui-* token ("no private
                 * token namespaces shadowing the public ones", CONVENTIONS §7, bug
                 * L12), so a wrapper cannot legally re-point --ui-radius for a
                 * slotted subtree. A --_ui-* hook is the sanctioned route and the
                 * guard "deliberately allows" it. Written as a var() fallback rather
                 * than a :host declaration so an outer tree's value is picked up by
                 * plain inheritance, with no cascade question to get wrong. */
                border-radius: var(--_ui-switch-radius, var(--ui-radius));
                background-color: var(--ui-key);
                transition:
                    background-color var(--ui-dur-slow) var(--ui-ease),
                    border-color var(--ui-dur-slow) var(--ui-ease);
            }

            /* ---------------------------------------------------------------
             * THE KNOB — positioned against the HOST, not against the track.
             * Slate's knob is a sibling of the track inside the label, so its 5px
             * inset is measured from the label's border box; nesting it inside the
             * track would measure from the track's PADDING box and add the
             * hairline, putting the knob at +6 instead of the measured +5.
             * ------------------------------------------------------------- */
            .knob {
                position: absolute;
                inset-block-start: 50%;
                inset-inline-start: var(--ui-switch-inset);
                inline-size: var(--ui-switch-knob);
                block-size: var(--ui-switch-knob);
                /* The knob's half of the same hook. TWO properties and not one,
                 * because the track and the knob are --ui-radius (6px) and
                 * --ui-radius-sm (4px) — a step apart, and a single hook collapses
                 * them: measured, a one-property pill reversed to 6/6 against this
                 * component's 6/4. */
                border-radius: var(--_ui-switch-knob-radius, var(--ui-radius-sm));
                background-color: var(--ui-line-strong);
                /* The independent transform property, so the resting centring and
                 * the travel are one declaration and cannot fight a transform set
                 * elsewhere. -50% resolves against the knob's own block size. */
                translate: 0 -50%;
                transition:
                    translate var(--ui-dur-slow) var(--ui-ease),
                    background-color var(--ui-dur-slow) var(--ui-ease);
            }

            /* ---------------------------------------------------------------
             * ON. "POLARITY IS FIXED: filled track = on, always"
             * (slate-components.css:434-437) — only the knob moves and only the
             * track fills, so the dark mass never swaps between states.
             * ------------------------------------------------------------- */
            :host([checked]) .track {
                background-color: var(--ui-primary);
                border-color: color-mix(in srgb, var(--ui-primary) 72%, var(--ui-steel));
            }

            :host([checked]) .knob {
                background-color: var(--ui-on-primary);
                translate: var(--_ui-switch-throw) -50%;
            }

            /* THE PENDING FACE — audit F-042's weak case, Ben's D08 (30 August 2026).
             *
             * NO BACKTICKS IN THIS COMMENT: one would close the css template and the file
             * would stop parsing as JavaScript some way further on. Gate C catches it;
             * this campaign has tripped it four times.
             *
             * TWO DECLARATIONS AND THEY BOTH SUBTRACT. The track keeps its box, its border
             * and its corner from the rules above, so a pending switch occupies exactly
             * the space the settled one will — no reflow when the answer lands, which is
             * why this lives here and not in the leaf: the leaf may not restate the switch
             * geometry (bug T17, pinned by test/settings-leaves.test.mjs).
             *
             * --ui-muted IS THE ABSENCE COLOUR the rest of the pending face already uses
             * (the inert dash in settings-leaf.js), and it is a token, not a mix: a
             * pending switch and a pending stepper are the same statement and should not
             * be two greys. The cursor stops being a pointer because there is nothing to
             * press - the toggle refuses. */
            :host([pending]) .pending-track {
                background-color: var(--ui-muted);
                border-color: var(--ui-line);
            }

            :host([pending]) {
                cursor: default;
            }

            /* CONVENTIONS §11: the base deliberately carries no reduced-motion
             * rule, and says it "belongs in styles/document.css or in each
             * animating component". This is the animating component. No
             * !important is needed because these rules are later than the ones
             * they override, in the same sheet. Not a width query — §2.1 Rule 1's
             * ban is on a component reading the VIEWPORT, and this reads a user
             * preference. */
            @media (prefers-reduced-motion: reduce) {
                .track,
                .knob {
                    transition-duration: 0s;
                }
            }
        `,
    ];

    constructor() {
        super();
        this.checked = false;
        this.disabled = false;
        /* Empty rather than a named default: the only value that paints anything is
         * `pill`, and a `shape="default"` attribute on every switch in the tree would
         * be markup implying a distinction the sheet does not have (P9). */
        this.shape = '';
        this.pending = false;
        this.pendingLabel = '';
    }

    /**
     * DID THIS COMPONENT WRITE THE `role`, or did the author?
     *
     * `connectedCallback` sets `role="switch"` only when the author has not chosen
     * otherwise, because "a screen may legitimately want role='checkbox' for a switch
     * inside a group". `pending` has to REMOVE that role and put it back, and it must put
     * back what was there — so it may only touch a role this component owns. An author's
     * `role="checkbox"` is theirs; a pending switch under it drops nothing and this
     * component says so rather than guessing.
     */
    #ownsRole = false;

    /**
     * THE TAB ORDER HAS TWO OWNERS AND THIS FIELD IS HOW THEY STAY APART.
     *
     * The host is the control, so it must carry a `tabindex` — and a tab bar with a
     * roving tabindex owns that same number on the same element (Appendix 10,
     * "Roving-tabindex tablist, exactly as implemented", the one keyboard pattern
     * the spec keeps verbatim). Disabling the switch has to take it out of the tab
     * order and giving it back has to restore whatever the OWNER last chose, not
     * whatever this component last wrote.
     *
     * So two fields, and the second is what makes the first honest:
     *   #authorTabIndex — the value the outside world asked for, `null` for "none".
     *   #ownTabIndex    — the value this component itself last wrote.
     * `updated()` adopts the live attribute as the author's whenever it differs
     * from `#ownTabIndex`; anything this component did not write is by definition
     * someone else's intent, whether it arrived in the initial markup or from a
     * roving tablist three seconds later.
     *
     * The failure this replaces: capturing the author's value in
     * `connectedCallback` alone. `connectedCallback` runs again on every re-parent,
     * and by then the component's own `tabindex="-1"` is sitting on a disabled
     * host — so a disabled switch that was moved in the DOM captured "-1" as the
     * author's value and was never returned to the tab order when it was enabled.
     */
    #authorTabIndex = null;

    /** Has the author's value been captured at least once? `null` is a real value. */
    #captured = false;

    /** The last `tabindex` this component wrote, so an outside write is visible. */
    #ownTabIndex = null;

    connectedCallback() {
        super.connectedCallback();
        /* Set once, and only if the author has not chosen otherwise — a screen may
         * legitimately want role="checkbox" for a switch inside a group.
         *
         * `#ownsRole` is remembered here rather than re-derived later, because by the time
         * `updated()` runs the attribute this component wrote looks exactly like one the
         * author wrote. A pending switch removes the role, so on the next connect there
         * would be no attribute to find and the question "was it mine?" has to have been
         * answered before it was taken away. */
        if (!this.hasAttribute('role')) {
            this.#ownsRole = true;
            /* AND IT IS NOT WRITTEN AT ALL WHILE PENDING, which is a race rather than a
             * tidiness. `updated()` removes the role, but `ui-settings-row`'s naming ladder
             * runs on ITS OWN update — which lands between this callback and that one — and
             * `isNameable` returns true for anything carrying a `role` attribute. MEASURED:
             * the row wrote `aria-label="Show screen saver when the machine sleeps"` onto a
             * switch that then dropped its role, leaving a named generic announcing the
             * heading a second time. Writing the role a moment later is the same as never
             * writing it, except for the window in which somebody reads it. */
            if (!this.pending) this.setAttribute('role', 'switch');
        }
        /* FIRST connect only. A re-parent must not re-read an attribute this
         * component wrote itself. */
        if (!this.#captured) {
            this.#authorTabIndex = this.getAttribute('tabindex');
            this.#captured = true;
        }
        this.addEventListener('click', this.#onClick);
        this.addEventListener('keydown', this.#onKeydown);
    }

    disconnectedCallback() {
        this.removeEventListener('click', this.#onClick);
        this.removeEventListener('keydown', this.#onKeydown);
        super.disconnectedCallback();
    }

    /** Write `tabindex` and remember that WE wrote it. */
    #setTabIndex(value) {
        this.#ownTabIndex = value;
        this.setAttribute('tabindex', value);
    }

    /**
     * The aria state and the visual state are the SAME state, so they cannot drift
     * (LAYOUT_SPEC_DRAFT.md Appendix 15, "the aria-*-driven state selectors ... the
     * right contract for a Lit component's reflected properties"). `checked` is a
     * reflected reactive property and `aria-checked` is written from it here, in
     * one place, every update.
     */
    updated(changed) {
        super.updated(changed);

        /* PENDING COMES FIRST AND RETURNS, because everything below it makes a claim.
         *
         * Removing the role is what does the work: with no `role` attribute the host is a
         * generic, `aria-checked` on a generic is meaningless (and is removed anyway), and
         * `Accessibility.getFullAXTree` reports no switch and no checked property — which
         * is the assertion `test/render/settings-pending-switch.render.test.mjs` makes,
         * because the failure was never about markup, it was about what the tree claims.
         *
         * `role="none"` WAS THE FIRST CHOICE AND IS WRONG. An element with role none or
         * presentation has that role IGNORED as soon as it carries a global `aria-*`
         * attribute (ARIA 1.2 §5.4's presentational-role conflict), and this host carries
         * `aria-disabled` in the very state that would want it — so the role would silently
         * fall back to the implicit one and the element would be a generic anyway, by a
         * route that reads as deliberate. Removing the attribute says the same thing
         * without depending on a conflict rule to say it.
         *
         * NOT IN THE TAB ORDER, still programmatically focusable: the same treatment
         * `disabled` gets below, for the same reason — a state a screen reader user can
         * reach and be told about. `aria-disabled` is NOT written here: it would be a
         * claim about a control, and there is no control until somebody has read one. */
        if (this.pending) {
            if (this.#ownsRole) this.removeAttribute('role');
            this.removeAttribute('aria-checked');
            this.removeAttribute('aria-disabled');
            const livePending = this.getAttribute('tabindex');
            if (livePending !== this.#ownTabIndex) this.#authorTabIndex = livePending;
            this.#setTabIndex('-1');
            return;
        }

        /* NO LONGER PENDING: the role this component wrote comes back before anything
         * asserts through it. A switch that answered and kept a missing role would be
         * announced as static text with a value nobody could hear. */
        if (this.#ownsRole && !this.hasAttribute('role')) this.setAttribute('role', 'switch');

        this.setAttribute('aria-checked', this.checked ? 'true' : 'false');

        /* Adopt an outside write before overwriting it. A roving tablist sets
         * tabindex AFTER connect, so a component that only ever restored its
         * connect-time snapshot would revert the owner's choice on the next toggle
         * — which is precisely what the field above exists to prevent. */
        const live = this.getAttribute('tabindex');
        if (live !== this.#ownTabIndex) this.#authorTabIndex = live;

        if (this.disabled) {
            this.setAttribute('aria-disabled', 'true');
            /* Out of the tab order, still programmatically focusable — the state a
             * screen reader user can reach and be told about. */
            this.#setTabIndex('-1');
        } else {
            this.removeAttribute('aria-disabled');
            this.#setTabIndex(this.#authorTabIndex ?? '0');
        }
    }

    render() {
        /* No <slot>. A switch is a leaf: its label is a sibling in the light DOM
         * (spec §5.2 #29, the settings row), which is also what lets
         * aria-labelledby reach it. */

        /* THE PENDING FACE: the track's box with no knob in it, and a sentence.
         *
         * NO KNOB, and that is the whole picture. The knob is the state — it is the thing
         * that sits left or right — so drawing one in either position while nobody has
         * read the value is the visual half of the same lie the role was telling. What is
         * left is the track: the same box, so a row does not resize when the answer lands,
         * and dimmed, so it does not read as a switch that happens to be off.
         *
         * NOT ANIMATED. A pulsing bar would be the only moving thing on a wall panel, and
         * it would say "working" where the honest word is "unknown".
         *
         * THE SENTENCE IS IN THE SHADOW ROOT rather than the light DOM, so a consumer
         * cannot forget it and cannot double it. It uses the shared visually-hidden
         * treatment from `base.js` — a clipped 1px box, still laid out and still
         * announced, never `display: none`. */
        if (this.pending) {
            return html`
                <span class="track pending-track" aria-hidden="true"></span>
                ${this.pendingLabel ? html`<span class="a11y">${this.pendingLabel}</span>` : ''}
            `;
        }

        return html`
            <span class="track" aria-hidden="true"></span>
            <span class="knob" aria-hidden="true"></span>
        `;
    }

    /** Toggle and announce. The only way `checked` changes from inside. */
    #toggle() {
        /* A PRESS ON A PENDING SWITCH DOES NOTHING AND SAYS NOTHING. Refusing here rather
         * than only in the renderer is what makes the state safe against a consumer that
         * sets `pending` without also setting `disabled`: there is no value to flip from,
         * so a toggle would invent one and then announce it as the user's choice. */
        if (this.pending) return;
        if (this.disabled) return;
        this.checked = !this.checked;
        this.dispatchEvent(new CustomEvent('change', {
            detail: { checked: this.checked },
            bubbles: true,
            composed: true,
        }));
    }

    #onClick = () => {
        this.#toggle();
    };

    #onKeydown = (event) => {
        /* Space is the required key for role="switch"; Enter is accepted too, which
         * is what a user arriving from a native checkbox or a button expects. */
        if (event.key !== ' ' && event.key !== 'Spacebar' && event.key !== 'Enter') return;
        /* Space scrolls the page otherwise, and the page is a wall panel. */
        event.preventDefault();
        this.#toggle();
    };
}

customElements.define('ui-switch', UiSwitch);
