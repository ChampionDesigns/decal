/**
 * ui-pick-disc — Wave 2 item #45, the A/B pick disc.
 *
 * Spec row (LAYOUT_SPEC_DRAFT.md §5.2 #45): "A/B pick disc | slate-live.css:2243-2255,
 * :2501-2503". §4.5 lists it among the History screen's components, beside the page
 * header bar, the select, the tab bank and the compare bar. The wave row says it in
 * one line: "The history viewer's two-slot shot selector; selection-family paint on
 * a disc."
 *
 * ============================ WHY THIS FILE IS SHORT ===========================
 * It is one of the six components SCOPE names in the founding-defect callout
 * (SCOPE.md:1576-1578, verbatim):
 *
 *     "#32 (tab bar), #36 (favourites bank), #37 (preset bank), #45 (pick disc),
 *      the wizard chips in #39 and the selected states of #24/#25/#52 are all
 *      expressed through it or through its dials — none of them may own a private
 *      'selected' look."
 *
 * So the entire selected treatment here is the `selectionSurface` import and
 * nothing else. There is no rule below keyed on the selected state. That is not
 * minimalism, it is the point of the wave: a seventh selection look has to be
 * WRITABLE before it can be shipped, and inside this file there is nowhere to put
 * one — the four dials paint face, ink, LED and glow, and every other property the
 * disc has is declared once, in the resting rules, for every state.
 *
 * ============================ THE TWO FORMS, AND WHY ONE FILE ==================
 * Slate draws this disc twice and says out loud that they are one object
 * (`slate-live.css:2235-2236`, read-only source, no backticks): "The A / B tag, and
 * the same disc appears against the rows in the list below, so 'this shot is B' is
 * one recognisable object in both places." And at `:2498-2499`: "The same disc as
 * the header tags, at the size a finger needs."
 *
 *   TAG  (`.slate-hv-pick-tag`, a span in the header)  — names which slot is which.
 *        Filled, because it sits on the header bar. Slate's comment at :2238-2242 is
 *        load-bearing and is carried: "The hairline is load-bearing, not trim.
 *        Filled with --slate-key alone the disc sits on --slate-bar, which in the
 *        light theme is very nearly the same colour: the circle vanished and left a
 *        faint letter floating in the header, so B read as disabled. It looked fine
 *        in dark, which is the only theme the first screenshots were taken in."
 *   PICK (`.hv-pick-btn`, a button in each shot-list row) — assigns that row to a
 *        slot. Hollow until assigned, so twenty-one unassigned rows do not read as
 *        twenty-one filled discs.
 *
 * One element, two attributes since parity surface 6: `interactive` chooses the
 * ELEMENT (a real button or a static span) and `form` chooses the resting paint,
 * because the History band's discs needed the combination Slate never had — a
 * slot-naming tag that is also pressable (see `form` below). The resting paint is
 * the only thing that differs and the oracle measured both; the SELECTED paint is
 * identical in both, which is the whole reason they are one component.
 *
 * ============================ ORACLE (prov-baseline dark / prov-light) ========
 * Disqualification check, run first (Part 10 §4):
 *   - DECISIONS.md settles nothing about this disc differently; the register entry
 *     that governs it is "One selection component, not thirteen. One 'selected'
 *     treatment, not six" (DECISIONS.md:244), which is what the dials are.
 *   - Responsive behaviour has no Slate answer (98.4% frozen). The spec governs, and
 *     §2.3/§3.1 give this control a fixed token size; the suite asserts it does not
 *     read its container or the viewport, at both geometries.
 *   - §7's 140 layout bugs: H3 is on this screen but is the HEADER's flex
 *     ("720px of tab bank pinned flex: 0 0 ... Measured pickers exactly 1014px"), a
 *     screen-level defect, not the disc's. No bug is filed against #45 — the wave
 *     row's `bugs` array is empty. The disc's defect is the architectural one above.
 *
 *   GEOMETRY, unanimous across both forms and every state that contains them:
 *     prov_query.py find --cls slate-hv-pick-tag  → 6 elements in 2 states,
 *       "distinct geometries (w x h), all matched elements:  62 x 62  x6"
 *     prov_query.py find --cls hv-pick-btn        → 42 elements in 1 state,
 *       "distinct geometries (w x h), all matched elements:  62 x 62  x42"
 *     48 elements, one geometry. 62px is --ui-control-inner exactly
 *     (calc(64 - 2*1), styles/tokens.css:93 — Slate declared the same number as a
 *     literal at slate-tokens.css:31).
 *
 *   TAG, RESTING (the B tag):
 *     CITE history-viewer .slate-hv-pick-tag [i=166] background-color: dark
 *       rgb(26, 33, 39) / light rgb(248, 249, 249)  <-  slate-live.css
 *       `.slate-hv-pick-tag`  authored `(NOT CAPTURED — set via a CSS shorthand)`
 *       !important=no          → --ui-key (#1a2127 / #f8f9f9) exactly.
 *     CITE history-viewer .slate-hv-pick-tag [i=166] border-top-color: dark
 *       rgb(82, 97, 107) / light rgb(170, 178, 183)  <-  slate-live.css
 *       `.slate-hv-pick-tag`  → --ui-line-strong (#52616b / #aab2b7) exactly.
 *     ORACLE same element: color dark rgb(244, 247, 248) / light rgb(23, 26, 28)
 *       → --ui-text; border-top-width 1px → --ui-border-w; border-top-left-radius
 *       50%; font-size 14px; font-weight 600; width/height 62px.
 *
 *   PICK, RESTING (an unassigned row disc):
 *     CITE history-shotdata .hv-pick-btn [i=260] background-color = rgba(0, 0, 0, 0)
 *       <-  slate-live.css  `.hv-pick-btn`  authored `transparent`  !important=no
 *       (FROZEN/hardcoded)   — the one authored value on this component the corpus
 *       carries verbatim, because it is not behind a shorthand.
 *     ORACLE history-shotdata .hv-pick-btn [i=260]: border-top-color dark
 *       rgb(58, 72, 82) / light rgb(203, 208, 211) → --ui-line; color dark
 *       rgb(148, 161, 169) / light rgb(90, 101, 108) → --ui-muted; min-height 62px.
 *
 *   SELECTED — and this is the finding that makes the two forms one component.
 *   Both land on exactly the dials' two colours, in both themes:
 *     CITE history-shotdata .hv-pick-btn [i=259] background-color = rgb(176, 196, 206)
 *       <-  slate-live.css  `.hv-pick-btn[aria-pressed="true"]`  authored
 *       `(NOT CAPTURED — set via a CSS shorthand)`  !important=no  (token-driven)
 *     ORACLE history-viewer .slate-hv-pick-tag [i=163] (the A tag) background-color:
 *       dark rgb(176, 196, 206) / light rgb(49, 92, 112), winning rule
 *       `.slate-hv-pick-tag[data-slot="a"]`; color: dark rgb(18, 24, 28) / light
 *       rgb(248, 252, 253).
 *     rgb(176, 196, 206) / rgb(49, 92, 112) is --ui-steel = --ui-selected-face, and
 *     rgb(18, 24, 28) / rgb(248, 252, 253) is --ui-on-steel = --ui-selected-ink
 *     (styles/tokens.css:819-822, 886-889). A third independent witness for the two
 *     colour dials, after the cup-warmer nav button [11] and expanded-charts [164]
 *     quoted in base.js — and the only one that reaches them through TWO different
 *     hand-written rules in a screen sheet, which is precisely the decay this
 *     component ends.
 *
 *   FOCUS — the one place Slate already ships the one ring, exactly:
 *     SOURCE slate-live.css:2518-2520 `.hv-pick-btn:focus-visible { outline: 3px
 *       solid var(--slate-steel); outline-offset: 2px; }` = --ui-focus-w /
 *       --ui-steel / --ui-focus-offset, which is what the base paints. Nothing is
 *       declared here (CONVENTIONS §3: do not author a second one). Outline geometry
 *       is outside the corpus's 18-property surface, so this clause is SOURCE.
 *
 * ============================ DELIBERATE DEPARTURES ============================
 *  1. THE SELECTED BORDER STOPS MOVING. Slate swaps the border colour to
 *     --slate-steel in both selected rules (`slate-live.css:2263` and `:2514`), so a
 *     selected disc's edge dissolves into its fill. That is a fifth painted property
 *     keyed on the selected state — a private "selected" look, which this wave bans
 *     outright. The dials paint face, ink, LED and glow; the hairline is RESTING
 *     paint and keeps its resting token in every state. What you see: a selected
 *     disc keeps a hairline ring instead of losing its edge. What you get: Slate's
 *     own stated intent — one recognisable object whose FILL says which slot it is —
 *     with the ring now doing that job in the selected state too, and a fork
 *     re-themes both states by moving four values.
 *  2. FONT-WEIGHT 600 IS --ui-weight-semibold, AND IT IS NO LONGER A DEPARTURE.
 *     It read the old --ui-weight-bold (700) until parity surface 1, on the authority of a
 *     three-weight scale whose own citation (slate-tokens.css:148-153) declares four,
 *     semibold among them. The token sheet now ships Slate's four; the disc renders
 *     Slate's 600 exactly. See styles/tokens.css, the weights block.
 *  3. THE 14px LANDS ON --ui-text-2xs, NOT --ui-text-sm. Slate's --slate-text-sm IS
 *     14px (`slate-tokens.css:129`, comment "column headers, units"); the rewrite's
 *     scale renamed that step --ui-text-2xs and gave --ui-text-sm to 15px, keeping
 *     the same comment on the same value (styles/tokens.css:351). Same rendered
 *     14px, different token name — worth saying, because reading the old name across
 *     is how a scale rename turns into a one-step type shift.
 *  4. NO HIT-AREA UTILITY, and that is a measurement not an omission. The ink is
 *     62 x 62 on all 48 measured elements and --ui-hit-min is 48px, so both axes
 *     clear the floor with the paint alone. CONVENTIONS §5: the utility is for
 *     controls whose ink is SMALLER than the floor. The suite asserts the rendered
 *     box against the token rather than trusting this sentence — which is the shape
 *     of bug P4, "measured 64x64, so --slate-hit-min is silently not applied where
 *     the comment says it is".
 *
 * ============================ WHAT THIS COMPONENT DOES NOT OWN =================
 * WHICH SHOT IS IN WHICH SLOT. `selected` arrives as a property and leaves as a
 * `pick` event; the disc never sets its own state. Slate's rule is
 * (`slate-live.css:2498-2499`) "Pressed means 'this row is that slot'; tapping a
 * pressed one clears the slot" — and assigning slot A to row 5 must clear slot A
 * from row 3, a fact no single disc can know. A self-toggling disc would render
 * two rows as slot A. The wave row sizes this component "small ... no internal
 * model" and that is the same conclusion from the other end.
 *
 * TOKEN-ONLY (Part 10 §12, wf-w2-state-controls). No data layer, no store import,
 * no endpoint.
 *
 * @fires pick - {detail: {selected, label}}, composed and bubbling, when an
 *               interactive disc is activated. `selected` is what the disc is
 *               ASKING for (the opposite of its current state), never what it has
 *               become. Not fired when disabled, and never for a static tag.
 */

import { css, html, nothing } from 'lit';

import { UiElement, selectionSurface, visuallyHidden } from 'src/components/base.js';

export class UiPickDisc extends UiElement {
    static properties = {
        /**
         * This disc's slot is filled by the thing it belongs to. Reflected, because
         * `selectionSurface` matches `:host([selected])` as well as the aria state
         * inside — CONVENTIONS §4, the state contract.
         */
        selected: { type: Boolean, reflect: true },
        /**
         * Render the pressable form (a real button) rather than the static tag.
         * Reflected, so a screen can see it from outside.
         *
         * IT IS NO LONGER THE RESTING-PAINT DISCRIMINATOR, and that is parity
         * surface 6's correction. It used to be both — pressable AND hollow, in one
         * attribute — and the two are not the same question. See `form`.
         */
        interactive: { type: Boolean, reflect: true },
        /**
         * WHICH OF SLATE'S TWO DISCS THIS IS, and therefore its RESTING paint:
         * `tag` (the default, filled) or `pick` (hollow).
         *
         * WHY IT IS ITS OWN ATTRIBUTE, measured at parity surface 6. The file header
         * names Slate's two forms and says why each is painted the way it is: the TAG
         * is "Filled, because it sits on the header bar" — carrying Slate's own
         * load-bearing comment that a hollow one "vanished and left a faint letter
         * floating in the header, so B read as disabled" — and the PICK is "Hollow
         * until assigned, so twenty-one unassigned rows do not read as twenty-one
         * filled discs". Neither reason is "is it pressable". Slate's tag is a span
         * and its pick a button, so the two questions LOOKED like one question until
         * a consumer wanted the combination Slate never had: the History band's discs
         * NAME the two slots (a tag's job, and always the same two letters) and are
         * also pressable, because pressing one chooses which slot the alignment is
         * expressed against. Bound to `interactive`, they came out hollow, and the
         * oracle says the header's disc is filled:
         *
         *   CITE history-viewer .slate-hv-pick-tag [i=166] (the resting B tag)
         *     background-color = rgb(26, 33, 39) -> --ui-key, color = rgb(244, 247,
         *     248) -> --ui-text, border-top-color = rgb(82, 97, 107)
         *     -> --ui-line-strong
         *
         * against transparent / --ui-muted / --ui-line before this change — which is
         * the vanished circle and the faint letter, reproduced on the screen whose
         * own docblock quotes the warning.
         *
         * THE HOLLOW LOOK IS KEPT, NOT DELETED, and that is DQ-610's shape: Ben's
         * answer there was to keep a capability by giving the component an attribute
         * rather than to remove the look. `form="pick"` is that attribute, and the
         * shot-list row form is what will spend it (`ui-data-grid`'s own example).
         */
        form: { type: String, reflect: true },
        /** Paint dims and input is refused. Reflected; the base dims the host. */
        disabled: { type: Boolean, reflect: true },
        /** Accessible name, for a disc whose visible content is a bare letter. */
        label: { type: String },
    };

    static styles = [
        /* Structural fragments first (CONVENTIONS §5a), state fragments last (§4).
         * No `hitArea`: departure 4 above — the ink already clears the floor. */
        visuallyHidden,
        css`
            /* ---------------------------------------------------------------
             * THE HOST IS THE DISC'S BOX
             *
             * container-type: normal opts out of the base's inline-size
             * containment (CONVENTIONS §2). This control has no container query
             * to resolve — its size is a token on both axes — and inline-grid is
             * what Slate's own tag is (slate-live.css:2244), so it sits in the
             * header's flex row and beside text without becoming a block.
             * ------------------------------------------------------------- */
            :host {
                container-type: normal;
                display: inline-grid;
                flex: none;
                inline-size: var(--ui-control-inner);
                block-size: var(--ui-control-inner);

                /* THE HOST IS A CIRCLE TOO, and this is not decoration.
                 * The selected property reflects, so selectionSurface's
                 * :host(:is(..., [selected])) rule paints background-color on the HOST as well as
                 * on the disc inside it. A square face behind a round disc shows
                 * as a filled square with a circle on top. Same radius on both, and
                 * the two coincide exactly. */
                border-radius: var(--ui-radius-pill);
            }

            /* Outside the corpus's 18-property surface, so: no oracle answer, and
             * none needed. Carried from ui-switch for one behaviour across the
             * library. */
            :host([interactive]) {
                cursor: pointer;
            }

            :host(:is([disabled], [aria-disabled="true"])) {
                cursor: not-allowed;
            }

            /* ---------------------------------------------------------------
             * THE DISC — painted by CLASS, never by id.
             *
             * CONVENTIONS §4 rule 2: an id selector is (1,0,0) and beats every
             * attribute selector in selectionSurface, so a disc painted on #disc
             * would silently never turn selected. The id is here for the suite to
             * query by and for nothing else.
             *
             * The shared half. Everything below is true in every state, which is
             * what leaves the four dials as the only things that move.
             * ------------------------------------------------------------- */
            .disc {
                display: grid;
                place-items: center;
                inline-size: 100%;
                block-size: 100%;

                /* THE ACCESSIBLE NAME IS POSITIONED AGAINST THIS DISC, and until
                 * 26 August 2026 it was positioned against the PAGE.
                 *
                 * visuallyHidden gives .a11y position: absolute (base.js, "the one
                 * visually-hidden treatment") and nothing in this file was a positioned
                 * ancestor, so the span's containing block was the INITIAL containing
                 * block. An absolutely positioned box whose containing block lies
                 * outside a scrollport is not clipped by that scrollport and does not
                 * contribute to its overflow — it contributes to the VIEWPORT's. The
                 * 1px span still takes its static position, and for a disc in row
                 * twenty of a long scrolled list that position is a long way down the
                 * page.
                 *
                 * MEASURED on the History data page, bench 1281x801 at dsf 1.5, twenty
                 * real shots, each row carrying an A disc and a B disc:
                 *
                 *   documentElement.scrollHeight  2028   document.body.scrollHeight 801
                 *   the lowest .a11y span's bottom  2027.6, offsetParent body
                 *   so the DOCUMENT scrolled 1227px and body did not scroll at all
                 *
                 * The rows themselves were clipped correctly inside ui-data-grid's
                 * frame, which measured scrollHeight 1670 in clientHeight 409 exactly as
                 * it should. What escaped was forty one-pixel labels. Dragging the
                 * document through that 1227px reached NOTHING — it slid the whole
                 * screen off the top and left the list sitting where it was — and it
                 * also spent ten pixels of page width on a scrollbar the layout did not
                 * need: the two summary columns measured 593.5 each before this line
                 * existed and 598.5 after it. Setting display: none on the forty spans
                 * alone, with every row height left untouched, took the document scroll
                 * to zero, which separates the escape from the row height: the escape is
                 * the whole of it.
                 *
                 * position: relative with no insets moves nothing and paints nothing. It
                 * only makes the disc the span's containing block, so the name is laid
                 * out inside the control it names. z-index stays auto, so this creates no
                 * stacking context and paint order is unchanged.
                 *
                 * THE GENERAL FORM OF THIS IS base.js's, NOT THIS FILE'S. Fifteen files
                 * in this tree render a .a11y node and every one of them can escape the
                 * same way the moment it is used inside a scroll region; the durable
                 * answer is for the utility itself to pin the span
                 * (inset-block-start: 0; inset-inline-start: 0), which it can do without
                 * knowing anything about its consumers. base.js is a shared
                 * single-writer file, so this component contains its own instance and
                 * the utility's owner carries the report. */
                position: relative;
                margin: 0;
                padding: 0;
                border: var(--ui-border-w) solid var(--ui-line-strong);
                /* ORACLE border-top-left-radius = 50% on all 48 elements. On a
                 * square box --ui-radius-pill draws the identical circle, and it is
                 * the token for "fully round" (styles/tokens.css:294). Both axes are
                 * --ui-control-inner, so the box is square by construction. */
                border-radius: var(--ui-radius-pill);
                background-color: var(--ui-key);
                color: var(--ui-text);
                /* The UA sheet gives <button> its own family and size and no
                 * Tailwind-style reset reaches into a shadow root. The inherit
                 * keyword rather than var(--ui-font-family): the family already crosses the
                 * boundary from styles/document.css, and restating it would break a
                 * screen setting one locally (CONVENTIONS §11). */
                font-family: inherit;
                /* Departure 3: Slate's 14px, on the token that now carries 14px. */
                font-size: var(--ui-text-2xs);
                /* SEMIBOLD IS THIS DISC'S RESTING PAINT, NOT A SELECTED TREATMENT, and
                 * that is why it is written through the private slot rather than as a
                 * bare font-weight. Parity surface 2 made the selected weight the fifth
                 * dial (base.js, --ui-selected-weight), and selectionSurface is (0,1,0)
                 * and goes last, so a plain font-weight here would lose to it and the
                 * SELECTED disc would come out LIGHTER than its resting siblings.
                 * ORACLE  state=history-shotdata .hv-pick-btn font-weight = 600 on all
                 *         42 records, selected and resting alike (2 painted
                 *         --slate-selected-face, 40 hollow); .slate-hv-pick-tag the
                 *         same 600 on all 6. Slate's disc gains face and ink when it is
                 *         picked, and nothing else — so the weight is resting paint.
                 * --_ui-rest-weight is base.js's composition slot for exactly this,
                 * the same idiom --_ui-rest-shadow uses to keep a bank's seam. */
                --_ui-rest-weight: var(--ui-weight-semibold);
                font-weight: var(--_ui-rest-weight);
                /* No line-height. styles/document.css already sets 1.5 and the
                 * glyph is centred by the grid, not by its line box (DQ-216: six
                 * wave-1 primitives declared a ratio that was already there). */
            }

            /* THE PICK's resting paint — hollow, because most rows are unassigned.
             * CITE history-shotdata .hv-pick-btn [i=260] background-color =
             * rgba(0, 0, 0, 0) <- slate-live.css .hv-pick-btn authored
             * transparent !important=no (FROZEN/hardcoded); border-top-color dark
             * rgb(58, 72, 82) -> --ui-line; color dark rgb(148, 161, 169)
             * -> --ui-muted.
             *
             * KEYED ON THE form ATTRIBUTE, NOT ON interactive (parity surface 6) —
             * the class is put on the disc by the form and the two questions are
             * separate. NO BACKTICK IN THIS COMMENT: one ends the css tagged template
             * where it stands (CONVENTIONS §9), and writing this paragraph with them
             * is how that was proved again. A (0,1,0) class, exactly as before, so
             * selectionSurface still beats it. */
            .pick {
                border-color: var(--ui-line);
                background-color: transparent;
                color: var(--ui-muted);
            }

            /* .glyph carries NO rule, deliberately. The letter is centred by the
             * grid above, not by its own line box, so the line-height ratio six
             * wave-1 primitives declared and did not need (DQ-216) has nothing to
             * do here either. The class exists for parity with ui-keycap's glyph
             * span and for the aria-hidden hook in render(). */
        `,
        /* LAST, after the resting paint, because selection has to beat it — and
         * because this is the only place in this file where the selected state is
         * expressed at all. CONVENTIONS §4, usage rule 1. */
        selectionSurface,
    ];

    constructor() {
        super();
        this.selected = false;
        this.interactive = false;
        /* TAG IS THE DEFAULT because it is the paint every disc in the tree wants
         * today: the band names two slots and the data page's captions name two
         * shots. `pick` is opted into by the form that has twenty-one of them. */
        this.form = 'tag';
        this.disabled = false;
        this.label = '';
    }

    render() {
        const named = Boolean(this.label);
        const glyph = html`<span id="glyph" class="glyph"
            aria-hidden=${named ? 'true' : nothing}><slot></slot></span>`;
        /* THE LINE BREAK BEFORE THE `>` IS LOAD-BEARING FOR GATE D, not a style
         * choice. scripts/gate-d.js:210 flags any interpolated template chunk that
         * contains a `/` and no newline, `;` or `{` as a route assembled from
         * fragments; a single-line Lit chunk ending in a closing tag is exactly that
         * shape, and this one raised a violation (wave-2 review cross-1). The break
         * is inside the start tag, so the rendered DOM is byte-identical — no text
         * node is added. The durable question (should the gate exempt
         * src/components/?) is wave 2's deferred question for cross-1 and belongs to
         * gate-d.js's owner — a shared single-writer file no builder may touch. */
        const name = named
            ? html`<span id="a11y" class="a11y"
                >${this.label}</span>`
            : nothing;

        /* THE ARIA STATE AND THE VISUAL STATE ARE THE SAME STATE, so they cannot
         * drift (spec Appendix 15; slate-components.css:389-392). Both spellings
         * below are in selectionSurface's selector list, so the paint follows the
         * announcement with no second rule:
         *
         *   interactive -> aria-pressed, always written, true or false. A toggle
         *     button with no aria-pressed announces as a plain button, and Slate
         *     writes it too (ORACLE winning rule `.hv-pick-btn[aria-pressed="true"]`).
         *   static      -> aria-current, present only when true. The tag is not
         *     pressable; what it says is "A is the shot on the charts"
         *     (slate-live.css:2256-2258), which is what aria-current means.
         */
        /* The resting-paint class is the FORM's; the element is `interactive`'s. */
        const paint = this.form === 'pick' ? 'pick' : 'tag';
        return this.interactive
            ? html`<button id="disc" class="disc ${paint}" type="button"
                    aria-pressed=${this.selected ? 'true' : 'false'}
                    ?disabled=${this.disabled}
                    @click=${this.#onActivate}
                >${glyph}${name}</button>`
            : html`<span id="disc" class="disc ${paint}"
                    aria-current=${this.selected ? 'true' : nothing}
                >${glyph}${name}</span>`;
    }

    updated(changed) {
        super.updated(changed);
        /* The host spelling of disabled, so the base's one dial reaches it whichever
         * way a consumer wrote it (CONVENTIONS §4). The native `disabled` on the
         * button above is what actually refuses the input; this is the paint and the
         * announcement. */
        if (this.disabled) this.setAttribute('aria-disabled', 'true');
        else this.removeAttribute('aria-disabled');
    }

    /**
     * Ask to be picked. The disc does NOT change `selected` — see "what this
     * component does not own" above. A consumer that wants the naive toggle writes
     * one line: el.addEventListener('pick', e => { el.selected = e.detail.selected; }).
     *
     * Bound declaratively in render(), not in firstUpdated: the disc element is a
     * button or a span depending on `interactive`, so a listener attached once to
     * whatever was there first would be stranded on a discarded node the moment the
     * attribute changed. A template binding moves with the element and is torn down
     * with it, which is also this component's whole answer to CONVENTIONS §12's
     * "cleans up on disconnect" — there is nothing else to clean up.
     */
    #onActivate = () => {
        if (!this.interactive || this.disabled) return;
        this.dispatchEvent(new CustomEvent('pick', {
            detail: { selected: !this.selected, label: this.label },
            bubbles: true,
            composed: true,
        }));
    };
}

customElements.define('ui-pick-disc', UiPickDisc);
