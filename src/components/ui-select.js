/**
 * ui-select - Wave 1 item #7, the library's one dropdown.
 *
 * SPEC  LAYOUT_SPEC_DRAFT.md section 5.1 #7 - "Select, slate-components.css:486-513
 *       - 13 uses. Caret geometry is six raw numbers written twice (:498/509/510 and
 *       :524/534/535)." Size: small. Part 4's own one-line brief: "Native select,
 *       styled ... Must hold its width as a flex item - today it renders 214px and
 *       250px in the same screen (T9)."
 *
 * TOKEN-ONLY (Part 10 section 12, wf-w1-primitives). No data layer, no ReaPrime, no
 * endpoint. The option list arrives from outside as a property; the control never
 * fetches, never knows what a shot is, and owns no ranges or limits of its own.
 *
 * THE BUG THIS COMPONENT EXISTS TO KILL
 *
 *   T9  "select.slate-select does not hold its stated 250px - it is a flex item with
 *       default shrink. Measured 214 in one leaf and 250 two rows below, inside a
 *       single screen." (slate-shell.css:695-700; layout/settings.md BUG-9, M3)
 *
 *   The oracle reproduces it exactly, in one state:
 *     ORACLE  prov_query.py find --cls slate-select
 *             state=settings-extensions-decent-app-settings
 *             element=#logLevelSelect [i=48] <select class="slate-select w-[250px]
 *             max-w-[250px]"> rect=[1579,489,250,64]
 *             element=.slate-select [i=51] <select class="slate-select w-[250px]
 *             max-w-[250px]"> rect=[1612,627,217,64]
 *             -> TWO selects, ONE screen, the SAME authored width, 250 and 217.
 *     ORACLE  state=settings-units---language-temperature element=#temp-unit-select
 *             [i=38] property=width value=213.578px  (authored `width: 250px
 *             !important`, slate-shell.css:698)
 *
 *   The stated size and the used size are different numbers, and nothing in the
 *   sheet connects them. SCOPE.md:2288 states the rule the fix has to satisfy:
 *   "T9 / T10 - controls hold their stated size: a select is `flex: none` at its
 *   token width." So the host is `flex: none` and its inline size is stated once, by
 *   whoever lays the row out. A stated width is HELD, not negotiated.
 *
 * THE APPEARANCE IS MEASURED, NOT CHOSEN. Every value below carries the oracle line
 * that decided it, quoted verbatim (Part 10 section 4). All eighteen probed
 * properties on .slate-select land on tokens that already exist in styles/tokens.css,
 * so this component declares no new public token and retargets entirely from there.
 *
 *   ORACLE  state=settings-units---language-temperature element=[38]
 *           <select id="temp-unit-select" class="slate-select w-[200px]">
 *           property=background-color value=rgb(26, 33, 39) [dark] /
 *           rgb(248, 249, 249) [light] winning rule=slate-components.css
 *           {.slate-select} authored `var(--slate-key)`      -> --ui-key
 *   ORACLE  ... property=color value=rgb(244, 247, 248) [dark] / rgb(23, 26, 28)
 *           [light] winning rule=slate-components.css {.slate-select}
 *           authored `var(--slate-text)`                     -> --ui-text
 *   ORACLE  ... property=font-size value=17px winning rule=slate-components.css
 *           {.slate-select} authored `var(--slate-text-base)` -> --ui-text-base
 *   ORACLE  ... property=font-weight value=400 winning rule=slate-components.css
 *           {.slate-select} authored `var(--slate-weight-regular)`
 *                                                            -> --ui-weight-regular
 *   ORACLE  ... property=font-family value=`Geist, system-ui, sans-serif`
 *           winning rule=app.css {button, input, optgroup, select, textarea}
 *           authored `inherit`                               -> font-family: inherit
 *   ORACLE  ... property=border-top-width value=1px winning rule=
 *           slate-components.css {.slate-select} authored (NOT CAPTURED - set via a
 *           CSS shorthand)                                   -> --ui-border-w
 *   ORACLE  ... property=border-top-color value=rgb(58, 72, 82) [dark] /
 *           rgb(203, 208, 211) [light] winning rule=slate-components.css
 *           {.slate-select}                                  -> --ui-line
 *   ORACLE  ... property=border-top-left-radius value=6px winning rule=
 *           slate-components.css {.slate-select}             -> --ui-radius
 *   ORACLE  ... property=padding-left value=18px winning rule=slate-components.css
 *           {.slate-select}                                  -> --ui-space-4
 *   ORACLE  ... property=height value=64px AND property=min-height value=64px
 *           winning rule=slate-shell.css {#subpage-host #settings-content-area
 *           select.slate-select} authored `var(--slate-control-height)`
 *                                                            -> --ui-control-h
 *   ORACLE  ... property=box-shadow value=none (no declaration)  -> nothing to draw
 *   ORACLE  ... property=opacity value=1 (no declaration)
 *   ORACLE  ... property=background-image value=`linear-gradient(45deg,
 *           rgba(0, 0, 0, 0) 50%, rgb(148, 161, 169) 50%), linear-gradient(135deg,
 *           rgb(148, 161, 169) 50%, rgba(0, 0, 0, 0) 50%)` winning rule=
 *           slate-components.css {.slate-select} authored `linear-gradient(45deg,
 *           transparent 50%, var(--slate-muted) 50%), linear-gradient(135deg,
 *           var(--slate-muted) 50%, transparent 50%)`        -> --ui-muted
 *
 * THE CARET, AND WHY IT IS THE ROW'S OTHER HALF. The two-gradient caret is a genuinely
 * good idea and is carried unchanged in kind: no asset, no data URI, and the colour is
 * a token, so it follows the theme with no second rule. What is not carried is its
 * arithmetic. Slate writes SIX raw numbers - `padding: 0 46px 0 ...`,
 * `background-position: right 23px center, right 17px center`,
 * `background-size: 7px 7px, 7px 7px` - and then writes all six AGAIN for
 * `.slate-picker` (slate-components.css:524/534/535), a class the spec's own dead
 * list retires. Two declarations of one number is exactly what section 2.3 bans.
 *
 * Here there are TWO artwork numbers and ONE token, and everything else is derived
 * from them:
 *   --_ui-caret        7px, the tile. Intrinsic glyph geometry (section 2.3 case 3),
 *                      and the one value the oracle measured.
 *   --_ui-caret-overlap 1px, how far the two tiles overlap. Also case 3 - artwork, not
 *                      a hairline, which is why it is a private constant and NOT
 *                      --ui-hairline: that token exists so the HAIRLINE can go to
 *                      0.5px at high dpr (section 2.3 case 1), and --ui-border-w is
 *                      derived from it, so borrowing it here would let one dpr edit
 *                      reshape the chevron and shift the text inset by half a pixel.
 *   --_ui-caret-inset  the caret's inset from the trailing edge = --ui-space-4 (18px).
 *                      Slate's 17px snapped to the spacing scale (section 3.3, "the
 *                      seven steps are the WHOLE vocabulary; off-scale values snap to
 *                      the nearest step"), which also makes it the SAME inset as the
 *                      text's leading padding - one number, both edges.
 * and then:
 *   --_ui-caret-band   the whole glyph, trailing edge to far side =
 *                      inset + 2*tile - overlap, which is what Slate's 23 vs 17
 *                      encodes (23 = 17+7-1).
 *   padding-inline-end band + --ui-space-4, so the text clears the caret by the same
 *                      step it is inset from the leading edge.
 * Retarget --ui-space-4 and the caret, the padding and the text inset all move
 * together. That is the row's "caret geometry becomes tokens" in one place.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   - No selection treatment. A select's chosen option is drawn by the UA popup, which
 *     no stylesheet reaches; painting a fourteenth selected look on the closed control
 *     is precisely the decay the four dials exist to stop. The rendering suite asserts
 *     the negative: moving --ui-selected-face moves nothing in this component.
 *   - No focus ring of its own. The base already rings `select:focus-visible` from
 *     --ui-focus-*; a second treatment here would be the sixth focus look starting.
 *   - No width token. The wave law is explicit that ranges and limits arrive from
 *     outside; the row that lays out a settings leaf states the width once and this
 *     control holds it. The default is the control's own max-content, which is a size
 *     it can always honour.
 *   - No `!important`, no raw colour literal, no @font-face, no `@media (width...)`.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';

class UiSelect extends UiElement {
    static properties = {
        /**
         * The choices. Strings, or `{ value, label, disabled }` objects. Parsed from a
         * JSON attribute so the gallery can state one in markup.
         *
         * WHAT THIS IS NOT: a data source. A primitive that "needs" server data is a
         * design error to flag, not to satisfy (Part 10 section 12) - whoever owns the
         * data hands the list down.
         */
        options: { type: Array },

        /** The chosen option's value. Adopted from the control at first render. */
        value: { type: String },

        /**
         * The accessible name. A cross-root `aria-labelledby` cannot see a label in
         * another tree, so the name comes in as a string and is put on the control
         * itself (spec Appendix 15's contract - accessibility state and visual state
         * are the same state, expressed once).
         */
        label: { type: String },

        /**
         * Paint AND behaviour. The base dims the host from --ui-opacity-disabled; the
         * native attribute below is what actually stops input.
         */
        disabled: { type: Boolean, reflect: true },
    };

    static styles = [css`
        :host {
            /* CONTAINER HOSTING, OPTED OUT - the one-line escape hatch in
             * CONVENTIONS.md section 2, and here it is mechanical rather than
             * stylistic. A select's natural inline size IS its longest option, so
             * inline-size CONTAINMENT would forbid exactly the thing that sizes this
             * control and the host would come out 0 wide ("my component vanished").
             * Nothing in this component uses a container query, so nothing is lost;
             * a consumer that wants a stated width states one, below. */
            container-type: normal;
            display: inline-grid;

            /* T9, AND THIS LINE IS THE WHOLE FIX.
             * "T9 / T10 - controls hold their stated size: a select is flex: none at
             * its token width" (SCOPE.md:2288). Slate's select is a flex item at the
             * default flex: 0 1 auto, so a greedy sibling takes its pixels and the
             * authored 250px renders 213.578px - measured, in the corpus, twice.
             * flex: none is 0 0 auto: the stated size is held, and a row that runs
             * out of space gives up somewhere a reader can see.
             *
             * THE STATED SIZE COMES FROM OUTSIDE. inline-size on the host is the
             * documented API: an outer-tree rule (or an inline style) beats :host, so
             *     .settings-row ui-select { inline-size: 260px }
             * states it once for a whole screen. The default below is the control's own
             * max-content - the one width it can always honour without lying. */
            flex: none;
            inline-size: max-content;

            /* Never wider than the box it was put in. Slate's own max-width: 100%
             * (slate-shell.css:699), which is the correct half of that rule: this is
             * the container speaking, not the viewport, so it holds at 1000x600 and at
             * 1281x801 alike (spec section 2.1 Rule 1). */
            max-inline-size: 100%;

            /* THE CARET, AS TWO NUMBERS AND A TOKEN INSTEAD OF SIX WRITTEN TWICE.
             * SOURCE slate-components.css:498/509/510 - padding: 0 46px 0
             * var(--slate-space-4), background-position: right 23px center, right
             * 17px center, background-size: 7px 7px, 7px 7px; copied verbatim to
             * .slate-picker at :524/534/535. background-position and background-size
             * are outside the oracle's 18-property surface, so the two numbers below
             * are a read-only SOURCE read, not an oracle answer.
             * 23 = 17 + 7 - 1: the tiles overlap by one px, which is what makes the
             * pair read as one chevron. That relationship is derived here rather than
             * re-typed.
             *
             * THE OVERLAP IS ARTWORK, NOT A HAIRLINE, and it is spelled as its own
             * private constant for that reason. Spec section 2.3 case 1 defines
             * --ui-hairline as the hairline "via --ui-hairline so it can become 0.5px
             * at high dpr later"; this 1px is case 3, "icon and glyph geometry
             * intrinsic to the artwork", exactly like the 7px tile beside it. Reaching
             * for the public token would have coupled the chevron's shape to a dpr
             * decision about BORDERS - --ui-border-w is var(--ui-hairline)
             * (tokens.css:409), so one edit would both thicken every edge and reshape
             * this glyph, moving padding-inline-end by half a pixel with it. */
            --_ui-caret: 7px;
            --_ui-caret-overlap: 1px;
            --_ui-caret-inset: var(--ui-space-4);
            --_ui-caret-band: calc(
                var(--_ui-caret-inset) + 2 * var(--_ui-caret) - var(--_ui-caret-overlap));
        }

        /* The resting paint is on a CLASS, never on the id (CONVENTIONS.md section 4
         * rule 2). The id is here for the rendering suite to query by. */
        .field {
            /* Suppress the platform chrome so the caret below is the only one. Chrome
             * 123 is the stated WebView floor (spec section 1.1), so no -webkit- twin. */
            appearance: none;

            /* The grid stretches the control to the host box on both axes (the default
             * justify-items/align-items), so a stated width on the host reaches the
             * control with no second declaration. This is the FLOOR only.
             *
             * min-inline-size: 0 is load-bearing and was MEASURED, not assumed. A grid
             * item's automatic minimum size is its MIN-CONTENT size, and a select's
             * min-content size is its longest option - so with a stated 260px host the
             * control still laid out 405px wide and painted straight through the host
             * box and out of the settings row. That is T9 again, one level down: the
             * stated size held on the wrapper and the ink ignored it. Zero lets the
             * control take the size it was given and let the UA elide the text. */
            min-inline-size: 0;
            min-block-size: var(--ui-control-h);

            /* A form control does not inherit type from its ancestors - the UA sheet
             * sets its own - and CONVENTIONS.md section 11 keeps font declarations off
             * :host precisely because they normally DO inherit. So the control restores
             * the inheritance, which is what Slate's own reset does. */
            font-family: inherit;
            font-size: var(--ui-text-base);
            font-weight: var(--ui-weight-regular);
            line-height: normal;

            padding-block: 0;
            padding-inline-start: var(--ui-space-4);
            padding-inline-end: calc(var(--_ui-caret-band) + var(--ui-space-4));

            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            color: var(--ui-text);

            /* BACKGROUND LONGHANDS ONLY, and the reason is Slate's own note at
             * slate-live.css:1565-1567: background-clip is a longhand of the
             * background shorthand, and a shorthand here would drop the caret
             * entirely. slate-shell.css:679-686 records the same failure from the other
             * side - a shell rule using the shorthand reset background-image and
             * "every dropdown in Settings rendered as a bordered box with no caret:
             * visually identical to the read-only value cells on Machine Info, with
             * nothing to say which of them can be tapped". */
            background-color: var(--ui-key);
            background-image:
                linear-gradient(45deg, transparent 50%, var(--ui-muted) 50%),
                linear-gradient(135deg, var(--ui-muted) 50%, transparent 50%);
            background-position:
                right calc(var(--_ui-caret-band) - var(--_ui-caret)) center,
                right var(--_ui-caret-inset) center;
            background-size:
                var(--_ui-caret) var(--_ui-caret),
                var(--_ui-caret) var(--_ui-caret);
            background-repeat: no-repeat;
        }

        /* ONE DIAL, PAINTED ONCE. <ui-select disabled> puts the attribute on the HOST
         * (Lit reflects it) and the control below carries the native attribute so the
         * control genuinely stops accepting input - and the base paints
         * --ui-opacity-disabled on BOTH spellings, which would compound: .38 x .38 =
         * .14, a control three times fainter than every other disabled control in the
         * skin. The host keeps the dial; the control opts out. Specificity, not
         * !important - a class plus a pseudo-class outranks the base's :where()
         * (CONVENTIONS.md section 6, "to override a base rule, write the rule"). */
        .field:disabled {
            opacity: 1;
        }
    `];

    constructor() {
        super();
        this.options = [];
        this.value = '';
        this.label = '';
        this.disabled = false;
    }

    /** The control, for the value sync and for focus(). */
    get #control() {
        return this.renderRoot?.querySelector('#control') ?? null;
    }

    /** Focus lands on the control, not on the wrapper - one ring, on the real thing. */
    focus(options) {
        const control = this.#control;
        if (control) control.focus(options);
        else super.focus(options);
    }

    /**
     * Strings or objects, in; one shape, out. A number is accepted because a JSON
     * attribute of numeric choices is the obvious way to write one.
     */
    static #choices(list) {
        if (!Array.isArray(list)) return [];
        return list.map((item) => {
            if (item === null || typeof item !== 'object') {
                const text = String(item ?? '');
                return { value: text, label: text, disabled: false };
            }
            const value = String(item.value ?? item.label ?? '');
            return {
                value,
                label: String(item.label ?? item.value ?? ''),
                disabled: Boolean(item.disabled),
            };
        });
    }

    render() {
        return html`
            <select
                id="control"
                class="field"
                aria-label=${this.label || nothing}
                ?disabled=${this.disabled}
                @change=${this.#onChange}
            >${UiSelect.#choices(this.options).map((choice) => html`<option
                    value=${choice.value}
                    ?disabled=${choice.disabled}
                >${choice.label}</option>`)}</select>
        `;
    }

    /**
     * The value binding cannot live in the template: Lit commits parts in source
     * order, so a `.value` on the <select> would be set BEFORE its <option> children
     * exist and would be discarded. It is committed here instead, after the children.
     *
     * BOTH DIRECTIONS, and on EVERY update rather than only the first. The list is
     * documented as arriving from outside as a property (Part 10 section 12), and a
     * property assigned after mount - `el.options = [...]` - lands on an update where
     * the control had no children the first time round. Adopting only in
     * firstUpdated() left the host's value at '' forever while the control displayed
     * and returned the first option: MEASURED as
     * {"hostValue":"","controlValue":"Celsius","idx":0}, with no error to notice.
     * So: a stated value is pushed DOWN to the control; an unstated one is adopted UP
     * from it, whenever the control has one. Setting `value` here schedules one more
     * update, which then finds the two in agreement and stops - no loop, and an
     * option whose value really is '' simply stays ''.
     */
    updated() {
        const control = this.#control;
        if (!control) return;
        if (this.value) {
            if (control.value !== this.value) control.value = this.value;
        } else if (control.value) {
            this.value = control.value;
        }
    }

    /**
     * `change` is NOT a composed event, so the native one dies at the shadow boundary
     * and a consumer listening on <ui-select> would never hear it. Re-raised as a
     * composed CustomEvent carrying the value, which is the whole of this component's
     * outward contract.
     */
    #onChange(event) {
        event.stopPropagation();
        this.value = event.target.value;
        this.dispatchEvent(new CustomEvent('change', {
            bubbles: true,
            composed: true,
            detail: { value: this.value },
        }));
    }
}

customElements.define('ui-select', UiSelect);

export { UiSelect };
