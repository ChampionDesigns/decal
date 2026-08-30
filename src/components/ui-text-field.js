/**
 * ui-text-field - Wave 1 item #6, "Text field".
 *
 * SCOPE Part 4 Wave 1 row #6: `LAYOUT_SPEC_DRAFT.md` §5.1 #6 - Text field,
 * `slate-components.css:710-720` - 19 uses. Size small. "Single-line entry. Needs
 * `formAssociated` - named as real Lit friction in the stack decision
 * (`DECISIONS.md:196`)." Wave 2 #30 (Search field) is built on this one, which is
 * why the lead/trail adornment slots exist here rather than being invented twice.
 *
 * TOKEN-ONLY (Part 10 §12, wf-w1-primitives). No data layer, no ReaPrime, no
 * endpoint. Everything variable - value, placeholder, name, limits - arrives from
 * outside as an attribute or property; this element owns none of it.
 *
 * ---------------------------------------------------------------------------
 * THE ORACLE, quoted rather than paraphrased (Part 10 §4 citation rule). Every
 * appearance value below is `prov_query.py`'s answer for the one Slate field that
 * is painted by the LIBRARY rule rather than by a screen's Tailwind pile-up -
 * `profile-selector #profile-filter [i=13] <input id="profile-filter"
 * class="slate-field w-full">`, rect x=24 y=240 w=591 h=64, captured at 1920x1200.
 *
 *   CITE  profile-selector #profile-filter [i=13] height = 64px  <-
 *         slate-components.css  {.slate-field}  authored `var(--slate-control-height)`
 *         !important=no  (token-driven)                         -> --ui-control-h
 *   CITE  profile-selector #profile-filter [i=13] padding-left = 18px  <-
 *         slate-components.css  {.slate-field}  authored (NOT CAPTURED - set via a
 *         CSS shorthand)  !important=no  (token-driven)         -> --ui-space-4
 *   CITE  profile-selector #profile-filter [i=13] font-size = 17px  <-
 *         slate-components.css  {.slate-field}  authored `var(--slate-text-base)`
 *         !important=no  (token-driven)                         -> --ui-text-base
 *   CITE  profile-selector #profile-filter [i=13] font-weight = 400  <-
 *         slate-components.css  {.slate-field}  authored `var(--slate-weight-regular)`
 *         !important=no  (token-driven)                         -> --ui-weight-regular
 *   CITE  profile-selector #profile-filter [i=13] color = rgb(244, 247, 248)  <-
 *         slate-components.css  {.slate-field}  authored `var(--slate-text)`
 *         !important=no  (token-driven)                         -> --ui-text
 *   CITE  profile-selector #profile-filter [i=13] background-color = rgb(26, 33, 39)
 *         <-  slate-components.css  {.slate-field}  authored (NOT CAPTURED - set via
 *         a CSS shorthand)  !important=no  (token-driven)       -> --ui-key
 *   CITE  profile-selector #profile-filter [i=13] border-top-left-radius = 6px  <-
 *         slate-components.css  {.slate-field}  authored (NOT CAPTURED - set via a
 *         CSS shorthand)  !important=no  (token-driven)         -> --ui-radius
 *   CITE  profile-selector #profile-filter [i=13] border-top-width = 1px  <-
 *         slate-components.css  {.slate-field}  (token-driven)  -> --ui-border-w
 *   CITE  `prov_query.py themes --state profile-selector --id profile-filter`:
 *         15 of 18 properties identical across themes; 3 differ -
 *         background-color rgb(26,33,39) dark / rgb(248,249,249) light (--ui-key),
 *         border-top-color rgb(58,72,82) dark / rgb(203,208,211) light (--ui-line),
 *         color rgb(244,247,248) dark / rgb(23,26,28) light (--ui-text).
 *         font-family Geist, system-ui, sans-serif in BOTH -> --ui-font-family.
 *
 * The height is corroborated by the spec rather than taken on the oracle's word:
 * §3.1 names `.slate-field` as a consumer of `--ui-control-h` = 64px.
 *
 * WHERE THE ORACLE IS DISQUALIFIED, and why (the check runs FIRST, Part 10 §4):
 *
 *   - RESPONSIVE BEHAVIOUR. Slate's field is 563x64 in 38 states and 591/500/1200/
 *     140/120/92 wide elsewhere, all captured at one canvas size; 98.4% of that
 *     geometry is frozen, so none of it is a target. `LAYOUT_SPEC_DRAFT.md` §2.2
 *     governs instead: "Control heights, touch targets, hairlines - Fixed token.
 *     Never fluid." The block size is therefore --ui-control-h at every container
 *     size and the inline size is 100% of whatever contains it. There is no
 *     `@container` rule in this file because there is nothing here that should
 *     change with width - and no `@media` rule, ever (§2.1 Rule 1).
 *   - `!important`. Every settings-screen field is painted by
 *     `#subpage-host #settings-content-area input:not([type="range"])...` with
 *     `!important=yes` on eight of the eighteen probed properties. That is the
 *     reach-in the shadow boundary removes; the values are carried, the mechanism
 *     is not (§2.1 Rule 3, zero !important).
 *   - THE ORACLE HAS NO ANSWER for `::placeholder` (outside the 18-property
 *     appearance surface) or for a label, a disabled field or an invalid field
 *     (no such state in the 49). Those fall to the tokens and are marked below.
 *
 * BUGS NOT REPRODUCED. The row itself carries no bug ids, but three catalogued
 * defects are about exactly this element and are asserted dead in the suite:
 *
 *   E14 (`LAYOUT_SPEC_DRAFT.md` §7.4) - "A11Y: ... settings fields have no
 *       `for`/`id` pairing". Here the label is part of the component and the
 *       pairing cannot come apart: one shadow root, one id, `label[for]` wired in
 *       `render()`; with `hide-label` the name survives as `aria-label`.
 *   E7  (§7.4) - "The step-name input clips its own descenders - 28.8px of line
 *       box in a 28px box". Nothing here fixes the input's block size to a type
 *       measurement: the input stretches to the field's content box (62px of it)
 *       and the line box is centred inside that with room to spare.
 *   L24 (§7.2) - "A11Y: focus rings clipped on all four sides by the components
 *       they sit inside". `focus-ring="inset"` on the host is the one-line answer
 *       and it reaches this component for free, because the ring is drawn from
 *       `--_ui-focus-offset` which the base switches (CONVENTIONS §3).
 *
 * WHERE THE RING IS DRAWN, and why it is not on the input. CONVENTIONS §3 names
 * this case: "Reusing the ring on something the selector list does not reach - a
 * wrapper that should show the ring while an inner input takes focus". A field with
 * a leading icon must ring the whole field, not the text box inside it, so the
 * wrapper carries `focusRing` through `:has(:focus-visible)` and the input's own
 * ring is suppressed by a plain higher-specificity selector. One treatment, two
 * offsets, no `!important` - which is the second half of that same section.
 *
 * THE SLOT CONTRACT, which is the third place that ring has to reach. The lead and
 * trail slots take LIGHT-DOM content, and neither of the two rules above can see it:
 * the base's focusable list is scoped to the shadow tree, and `:has()` walks the DOM
 * tree rather than the flattened tree, so `.field:has(:focus-visible)` cannot match a
 * slotted element. A slotted `<button>` therefore fell back to the UA's `outline:
 * auto` - a sixth treatment inside a Decal field, measured. `::slotted(
 * :focus-visible)` is the one selector that does reach light-DOM children of the
 * host, and it draws the SAME fragment at the SAME offset, so a plain button and a
 * `ui-*` control that rings itself both come out with one identical ring. Nothing is
 * required of the consumer beyond slotting a focusable element. (Wave-wide, this is
 * review finding cross-3: 12 of 14 elements expose a slot and none has a `::slotted`
 * focus rule; the general answer belongs in `base.js`/`CONVENTIONS.md`, which are not
 * this row's files.)
 *
 * FORM ASSOCIATION is the friction `DECISIONS.md:196` warns about, so it is real
 * here rather than deferred: `static formAssociated`, `ElementInternals`,
 * `setFormValue` on every keystroke, validity mirrored from the inner input with
 * the input as the validation anchor, and all four form lifecycle callbacks - and
 * `name` REFLECTS, because the form reads the host's name ATTRIBUTE and a property
 * that did not reflect would drop the field out of the form silently (see below).
 */

import { css, html, nothing } from 'lit';

import { UiElement, focusRing } from 'src/components/base.js';

/**
 * The types a SINGLE-LINE ENTRY may be. Deliberately not open: `number` belongs to
 * the stepper (#4) and a `checkbox` smuggled through `type` would be a switch (#5)
 * wearing a field's paint. An unrecognised value falls back to `text` rather than
 * throwing - a wrong keyboard is cosmetic, a dead control is not.
 */
const TEXT_TYPES = new Set(['text', 'search', 'email', 'tel', 'url', 'password']);

/** Every flag `ElementInternals.setValidity()` accepts, mirrored from the input. */
const VALIDITY_FLAGS = [
    'valueMissing', 'typeMismatch', 'patternMismatch', 'tooLong', 'tooShort',
    'rangeUnderflow', 'rangeOverflow', 'stepMismatch', 'badInput', 'customError',
];

class UiTextField extends UiElement {
    /** DECISIONS.md:196 - "forms need `formAssociated`". This is that. */
    static formAssociated = true;

    static properties = {
        value: { type: String },
        /**
         * REFLECTED, and the reflection is the mechanism rather than tidiness. Form
         * submission for a form-associated custom element reads the HOST's `name`
         * CONTENT ATTRIBUTE (HTML "entry construction algorithm": an element with no
         * non-empty name attribute contributes nothing), so a consumer that writes
         * `el.name = 'host'` as a property would take the field out of the form with
         * no error at all. MEASURED before the fix: `.name='host'` gave
         * { hasAttr: false, prop: 'host' } and `new FormData(form).entries()` came
         * back []. The inner input's `name` is NOT the mechanism - an input inside a
         * shadow root has no form owner and never joins the outer form; it is kept
         * only because the UA's autofill heuristics read it.
         *
         * The converter is the `align` rule applied to a property that MUST reflect:
         * "a reflected property with a default writes align=start onto every
         * instance, which is noise in the DOM and in a capture diff". An empty name
         * submits nothing either way, so an empty string removes the attribute
         * instead of writing name="".
         */
        name: {
            type: String,
            reflect: true,
            converter: {
                fromAttribute: (value) => value ?? '',
                toAttribute: (value) => (value || null),
            },
        },
        type: { type: String },
        placeholder: { type: String },
        label: { type: String },
        hideLabel: { type: Boolean, attribute: 'hide-label' },
        align: { type: String, reflect: true },
        disabled: { type: Boolean, reflect: true },
        readonly: { type: Boolean, reflect: true },
        required: { type: Boolean, reflect: true },
        invalid: { type: Boolean, reflect: true },
        autocomplete: { type: String },
        inputmode: { type: String },
        pattern: { type: String },
        maxlength: { type: Number },
    };

    static styles = [
        css`
            /* ---- the label -------------------------------------------------
             * NO ORACLE ANSWER: no Slate field has a label (that is bug E14).
             * Tokens decide: secondary ink, the note step, the small gap. */
            .label {
                display: block;
                margin-block-end: var(--ui-space-2);
                color: var(--ui-text-2);
                font-family: var(--ui-font-family);
                font-size: var(--ui-text-note);
                font-weight: var(--ui-weight-regular);
            }

            /* ---- the field box ---------------------------------------------
             * Every declaration here is one of the oracle CITE lines at the top
             * of this file, expressed as the token it resolves to. box-sizing is
             * border-box from the base, so 64px is the OUTER box exactly as
             * Slate measures it (min-height 64px / height 64px, both probed). */
            .field {
                display: flex;
                align-items: center;
                inline-size: 100%;
                block-size: var(--ui-control-h);
                min-block-size: var(--ui-control-h);
                padding-inline: var(--ui-space-4);
                border: var(--ui-border-w) solid var(--ui-line);
                border-radius: var(--ui-radius);
                background-color: var(--ui-key);
                color: var(--ui-text);
                cursor: text;
            }

            /* THE ring, on the wrapper, from the exported fragment - CONVENTIONS
             * §3, "a wrapper that should show the ring while an inner input takes
             * focus". --_ui-focus-offset is inherited from :host, so
             * focus-ring="inset" on the host moves this ring inside its own box
             * and bug L24 cannot express itself here. */
            .field:has(:focus-visible) {
                ${focusRing}
            }

            /* The other half of the same section: a plain higher-specificity
             * selector beats the base's zero-specificity :where() rule. There is
             * no second ring and no !important anywhere in the file. */
            .input:focus-visible {
                outline: none;
            }

            /* NO ORACLE ANSWER for an invalid field - no such state in the 49.
             * --ui-status-danger is the status family's own member (§3 A5). */
            :host([invalid]) .field {
                border-color: var(--ui-status-danger);
            }

            /* ---- the entry itself ------------------------------------------
             * align-self: stretch, and NO fixed block-size: the input takes the
             * field's whole 62px content box so the entire box accepts a press,
             * and its line box is centred inside that with room to spare. Bug E7
             * is a 28.8px line box in a 28px box; nothing here sizes the box from
             * a type measurement, so that shape has nowhere to come from. */
            .input {
                flex: 1 1 auto;
                align-self: stretch;
                min-inline-size: 0;
                margin: 0;
                padding: 0;
                border: 0;
                background-color: transparent;
                color: inherit;
                font-family: var(--ui-font-family);
                font-size: var(--ui-text-base);
                font-weight: var(--ui-weight-regular);
                text-align: start;
            }

            /* NO ORACLE ANSWER: ::placeholder is outside the 18-property
             * appearance surface. --ui-muted is the token for "labels, units,
             * disabled". opacity: 1 because a UA default of 0.54 would make the
             * dial a lie. */
            .input::placeholder {
                color: var(--ui-muted);
                opacity: 1;
            }

            /* Slate writes this as a utility on the element - screensaver-cycle-
             * seconds is slate-field w-[140px] text-center, and share-code-input
             * is slate-field ... text-center - so it is a real variant of the
             * component, expressed as a reflected attribute rather than a class a
             * screen reaches in with. */
            :host([align="center"]) .input {
                text-align: center;
            }

            :host([align="end"]) .input {
                text-align: end;
            }

            /* ---- adornments -------------------------------------------------
             * The gap lives on the SLOTTED element, not on the flex container: a
             * flex gap would push the entry inward by a full step even with both
             * slots empty, and the oracle's padding-left is 18px to the text. */
            ::slotted(*) {
                flex: 0 0 auto;
                color: var(--ui-muted);
            }

            slot[name="lead"]::slotted(*) {
                margin-inline-end: var(--ui-space-3);
            }

            slot[name="trail"]::slotted(*) {
                margin-inline-start: var(--ui-space-3);
            }

            /* THE SAME ring, on a FOCUSABLE ADORNMENT - the slot contract, made
             * mechanical. Wave 2 #30 (Search field) slots a clear button here, and
             * without this rule that button paints the UA's own outline: auto
             * (MEASURED: outline-style auto, 1px, rgb(16,16,16)) - a sixth focus
             * treatment inside a Decal field, which is precisely what CONVENTIONS
             * §3 exists to prevent.
             *
             * Neither of the two rules above it can reach the case. The base's
             * :where(button, input, ...) list matches inside the SHADOW tree and a
             * slotted element is light DOM; and .field:has(:focus-visible) walks the
             * DOM tree rather than the flattened tree, so it never matches a slotted
             * descendant either (measured: the field's outline stayed none while the
             * button was :focus-visible). ::slotted() is the one selector that does
             * reach it, and it takes the ring from the same exported fragment, at the
             * offset the host is carrying - so a slotted ui-* control that already
             * rings itself gets the IDENTICAL declarations from the outer tree, not a
             * second ring.
             *
             * :focus-visible and not :focus-within on the wrapper, deliberately: the
             * ring belongs on the thing that took the focus, and :focus-within would
             * also fire the field's ring on a mouse press. */
            ::slotted(:focus-visible) {
                ${focusRing}
            }
        `,
    ];

    #internals = null;

    #defaultValue = null;

    constructor() {
        super();
        this.value = '';
        this.name = '';
        this.type = 'text';
        this.placeholder = '';
        this.label = '';
        this.hideLabel = false;
        // `align` is deliberately left undefined rather than defaulted to 'start':
        // a reflected property with a default writes align="start" onto every
        // instance, which is noise in the DOM and in a capture diff.
        this.disabled = false;
        this.readonly = false;
        this.required = false;
        this.invalid = false;
        this.autocomplete = '';
        this.inputmode = '';
        this.pattern = '';
        this.maxlength = undefined;
        this.#internals = this.attachInternals();
    }

    /* ---- the rendered control -------------------------------------------- */

    /** The inner input, once there is one. Ids are for querying (CONVENTIONS §9). */
    get #control() {
        return this.renderRoot?.querySelector('#control') ?? null;
    }

    /** An unrecognised `type` is cosmetic damage, not a dead control. */
    get #inputType() {
        return TEXT_TYPES.has(this.type) ? this.type : 'text';
    }

    render() {
        const showLabel = Boolean(this.label) && !this.hideLabel;
        return html`
            ${showLabel
                ? html`<label id="label" class="label" for="control">${this.label}</label>`
                : nothing}
            <div id="field" class="field" @click=${this.#onFieldClick}>
                <slot name="lead"></slot>
                <input
                    id="control"
                    class="input"
                    type=${this.#inputType}
                    .value=${this.value ?? ''}
                    name=${this.name || nothing}
                    placeholder=${this.placeholder || nothing}
                    autocomplete=${this.autocomplete || nothing}
                    inputmode=${this.inputmode || nothing}
                    pattern=${this.pattern || nothing}
                    maxlength=${Number.isFinite(this.maxlength) ? this.maxlength : nothing}
                    aria-label=${showLabel ? nothing : (this.label || nothing)}
                    aria-invalid=${this.invalid ? 'true' : nothing}
                    ?disabled=${this.disabled}
                    ?readonly=${this.readonly}
                    ?required=${this.required}
                    @input=${this.#onInput}
                    @change=${this.#onChange}>
                <slot name="trail"></slot>
            </div>
        `;
    }

    connectedCallback() {
        super.connectedCallback();
        // The reset value is whatever the markup said, captured once. Read here
        // rather than in the constructor so `createElement` + `setAttribute` and
        // parser upgrade behave the same way.
        if (this.#defaultValue === null) this.#defaultValue = this.getAttribute('value') ?? '';
    }

    firstUpdated() {
        this.#syncForm();
    }

    updated(changed) {
        if (changed.has('value') || changed.has('required') || changed.has('pattern')
            || changed.has('type') || changed.has('maxlength') || changed.has('disabled')) {
            this.#syncForm();
        }
    }

    /* ---- events ----------------------------------------------------------- */

    #onInput(event) {
        this.value = event.target.value;
        this.#syncForm();
        // `input` is composed:true, so the native event already crosses the shadow
        // boundary with the HOST as its retargeted target. Re-dispatching would
        // deliver it twice.
    }

    #onChange() {
        // `change` is bubbles:true but composed:FALSE, so it stops at the shadow
        // boundary and a consumer listening on <ui-text-field> would never see it.
        this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }

    /** A press on the field's padding is a press on the entry. */
    #onFieldClick(event) {
        if (event.target === event.currentTarget) this.#control?.focus();
    }

    /* ---- form association (DECISIONS.md:196) ------------------------------ */

    #syncForm() {
        const internals = this.#internals;
        if (!internals) return;
        internals.setFormValue(this.value ?? '');

        const input = this.#control;
        if (!input) return;
        const flags = {};
        for (const flag of VALIDITY_FLAGS) {
            if (input.validity[flag]) flags[flag] = true;
        }
        // The input is the validation ANCHOR, so reportValidity() points its bubble
        // at the thing the user has to fix rather than at an opaque host box.
        internals.setValidity(flags, input.validationMessage, input);
    }

    formResetCallback() {
        this.value = this.#defaultValue ?? '';
        this.#syncForm();
    }

    formDisabledCallback(disabled) {
        this.disabled = disabled;
    }

    formStateRestoreCallback(state) {
        this.value = typeof state === 'string' ? state : '';
        this.#syncForm();
    }

    /* ---- the native-ish surface a form control is expected to have -------- */

    get form() { return this.#internals?.form ?? null; }

    get validity() { return this.#internals?.validity ?? null; }

    get validationMessage() { return this.#internals?.validationMessage ?? ''; }

    get willValidate() { return this.#internals?.willValidate ?? false; }

    checkValidity() { return this.#internals?.checkValidity() ?? true; }

    reportValidity() { return this.#internals?.reportValidity() ?? true; }

    /**
     * Focus goes INWARD, without `delegatesFocus`. CONVENTIONS §11: delegatesFocus
     * as a default "produces two rings on one control" - and it would here, because
     * :host(:focus-visible) already carries the base's ring and the wrapper carries
     * this component's.
     */
    focus(options) {
        const input = this.#control;
        if (input) input.focus(options);
        else super.focus(options);
    }

    blur() {
        const input = this.#control;
        if (input) input.blur();
        else super.blur();
    }

    select() { this.#control?.select(); }
}

customElements.define('ui-text-field', UiTextField);

export { UiTextField };
