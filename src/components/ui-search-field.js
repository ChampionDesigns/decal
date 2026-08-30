/**
 * ui-search-field — Wave 2 item #30, "Search field".
 *
 * SCOPE Part 4 Wave 2 row #30 (SCOPE.md:1544): "Text field with an icon well; the
 * current 52px left pad is `18 + 20 + 14` undocumented (spec §5.2 #30). | small | #6".
 * Inventory row (LAYOUT_SPEC_DRAFT.md §5.2 #30): "Search field with icon well |
 * `slate-shell.css:406-415` | The 52px left pad is `18 + 20 + 14`, undocumented."
 *
 * THE WHOLE POINT OF THE ROW, in one sentence: the well is not a number any more.
 * Slate writes ONE literal on the input and positions the glyph over it absolutely,
 * so the two are held in agreement by hand; here the glyph is a box IN THE FLOW and
 * the well is the sum of three tokens that already exist. No declaration in this
 * file, and no assertion in its suite, carries a 52: the number survives only as the
 * oracle quotation below and as the thing the suite proves cannot be re-typed.
 *
 * TOKEN-ONLY (Part 10 §12, wf-w2-state-controls). No data layer, no store, no
 * endpoint: value, placeholder and name arrive from outside and this element owns
 * none of them. It COMPOSES `ui-text-field` (Wave 1 #6) rather than re-implementing a
 * field — that component's own header says the lead/trail adornment slots "exist here
 * rather than being invented twice" for exactly this row.
 *
 * NO SELECTION STATE, deliberately (wave law, spec §3.9 + CONVENTIONS §4). A search
 * field has nothing to select, so `selectionSurface` is not imported and no rule here
 * paints a face, an ink, an LED or a glow. The four dials remain expressible only
 * through item #3.
 *
 * ---------------------------------------------------------------------------
 * THE ORACLE, quoted rather than paraphrased (Part 10 §4 citation rule). Queried
 * mechanically with realine-run/tools/prov_query.py against prov-baseline (dark) and
 * prov-light. The subject is Slate's own search field, `#settings-search`:
 *
 *   CITE  find --id settings-search -> found 38 element(s) in 38 state(s), every one
 *         rect [18,136,563,64] (captured at 1920x1200).
 *
 *   THE LITERAL THE ROW IS ABOUT:
 *   CITE  settings-machine-steam #settings-search [i=7] padding-left = 52px  <-
 *         slate-shell.css  `#subpage-host #settings-search`  authored `52px`
 *         !important=no  (FROZEN/hardcoded)
 *
 *   THE BOX, and it is the field this component already composes:
 *   CITE  settings-machine-steam #settings-search [i=7] height = 64px  <-
 *         slate-shell.css  `#subpage-host #settings-search`  authored
 *         `var(--slate-control-height)`  !important=no  (token-driven)  -> --ui-control-h
 *   CITE  settings-machine-steam #settings-search [i=7] border-top-width = 1px  <-
 *         slate-shell.css  `#subpage-host #settings-search`  authored `(NOT CAPTURED
 *         — set via a CSS shorthand)`  !important=no  (FROZEN/hardcoded) -> --ui-border-w
 *   CITE  settings-machine-steam #settings-search [i=7] border-top-left-radius = 6px
 *         <-  slate-shell.css  `#subpage-host [class*="rounded-[67.5px]"], #subpage-host
 *         [class*="rounded-[54px]"], #subpage-host [class*="rounded-full"]...`
 *         authored `(NOT CAPTURED — set via a CSS shorthand)`  !important=YES
 *         (token-driven)  -> --ui-radius
 *
 *   THE PAINT, and this is the finding that makes composition the right shape rather
 *   than a convenience — `themes --state settings-machine-steam --id settings-search`:
 *   "15 of 18 properties identical across themes; 3 differ."
 *   CITE  ... background-color: dark rgb(26, 33, 39) / light rgb(248, 249, 249)
 *         <-  slate-shell.css  `#subpage-host #settings-search`  (shorthand)  -> --ui-key
 *   CITE  ... border-top-color: dark rgb(58, 72, 82) / light rgb(203, 208, 211)
 *         <-  same rule  (shorthand)                                         -> --ui-line
 *   CITE  ... color: dark rgb(244, 247, 248) / light rgb(23, 26, 28)
 *         <-  same rule                                                      -> --ui-text
 *   Those are the SAME three tokens `ui-text-field` already carries from the library
 *   rule (`profile-selector #profile-filter [i=13]`, .slate-field). Slate's screen
 *   override and Slate's component rule agree on every colour and disagree on exactly
 *   two numbers — the 52px well and the font size. So the search field is the field,
 *   plus a well.
 *
 *   THE ONE VALUE NOT CARRIED, recorded as a departure below:
 *   CITE  settings-machine-steam #settings-search [i=7] font-size = 18px  <-
 *         slate-shell.css  `#subpage-host #settings-search`  authored
 *         `var(--slate-text-md)`  !important=no  (token-driven)
 *
 * WHERE THE ORACLE IS SILENT OR DISQUALIFIED — the check runs FIRST (Part 10 §4):
 *
 *   1. THE GLYPH ITSELF has no corpus answer at all. "SVG elements are not in the
 *      oracle's element walk, so this family has no corpus answer and is a read-only
 *      source read" (styles/tokens.css:124-125, the --ui-icon declaration). The
 *      read-only read is settings.html:20:
 *          <svg class="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5
 *               text-[var(--text-primary)]" aria-hidden="true" ... viewBox="0 0 24 24"
 *               fill="none" stroke="currentColor">
 *            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
 *                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
 *      -> the ink is `--text-primary`, and slate-tokens.css:236 resolves that:
 *         `--text-primary: var(--slate-text)` -> --ui-text. The path data is carried
 *         verbatim; `w-5 h-5` (20px) is a Tailwind literal and becomes --ui-icon.
 *   2. RESPONSIVE BEHAVIOUR. Slate's field is 563x64 in all 38 states at one canvas
 *      size; 98.4% of that geometry is frozen, so none of it is a target
 *      (LAYOUT_SPEC_DRAFT.md governs, §2.2: "Control heights, touch targets,
 *      hairlines — Fixed token. Never fluid"). The block size is --ui-control-h at
 *      every container size and the inline size is 100% of the container. There is no
 *      @container rule here because nothing in this component should change with
 *      width, and no @media rule ever (§2.1 Rule 1).
 *   3. `!important`. The radius arrives through a `[class*="rounded-full"]` killer
 *      rule with !important=yes. That is the reach-in the shadow boundary removes;
 *      the value is carried, the mechanism is not (§2.1 Rule 3).
 *   4. NO STATE. Hover, focus, disabled and placeholder ink are outside the corpus's
 *      18-property resting surface; they come from the base and the tokens, through
 *      ui-text-field.
 *
 * ---------------------------------------------------------------------------
 * THE WELL IS ARITHMETIC, AND THE ARITHMETIC IS TOKENS
 *
 *     entry inset  =  --ui-space-4  (18px, the field's own inset — the same token
 *                     ui-text-field takes from `.slate-field`'s padding-left = 18px)
 *                  +  --ui-icon     (24px, intrinsic icon geometry, spec §2.3 case 3)
 *                  +  --ui-space-3  (12px, ui-text-field's lead-slot gap)
 *                  =  54px, rendered, and NOT WRITTEN ANYWHERE.
 *
 * Slate's 52 = 18 + 20 + 14 is the same three quantities with two of them off the
 * scale, added up by a person and typed into a rule that has no idea what the glyph
 * is doing. The glyph here is a flow box in the field's flex line, so the entry
 * cannot disagree with it: move any of the three tokens and the well moves. That is
 * the assertion the suite makes three times, once per token, and it is the whole
 * retirement of §5.2 #30's "undocumented".
 *
 * BUGS THIS COMPONENT CANNOT REPRODUCE (each asserted in the suite, cited by id):
 *
 *   §5.2 #30  "The 52px left pad is 18 + 20 + 14, undocumented." Retired by
 *       construction, as above.
 *   T15  (§7.5) "A11Y: ... `aria-label` on role-less divs". The host of a custom
 *       element with no role IS a role-less generic, and `aria-label="Search
 *       settings"` is exactly what Slate's markup writes (settings.html:19). So a
 *       host-written name is ADOPTED AND REMOVED here, the way ui-icon-button does
 *       it: the real <input> ends up as the only element carrying the name.
 *   E14  (§7.4) "A11Y: ... settings fields have no `for`/`id` pairing". With
 *       `show-label` the label is ui-text-field's, in one shadow root, wired
 *       `label[for] -> input[id]` in its own render(); the pairing cannot come apart.
 *   L24  (§7.2) "focus rings clipped on all four sides by the components they sit
 *       inside". One ring, drawn once, on the field wrapper — MEASURED here: with the
 *       entry keyboard-focused the host matches :focus and :focus-within but NOT
 *       :focus-visible, so nesting the field inside this component adds no second
 *       ring. `focus-ring="inset"` on this host moves that one ring inside its own
 *       box — but only because it is RELAYED. THE FINDING: the inset switch does not
 *       survive composition on its own. `--_ui-focus-offset` is inherited, and the
 *       base declares it on every `:host`, so ui-text-field's own declaration
 *       outranks the value inherited from this host and quietly restores the outset
 *       offset. Any wave-2 row that wraps a wave-1 control has this, not just this
 *       one. See the `focus-ring` property.
 *   L12  "a private palette duplicating the public tokens". This file declares no
 *       private property at all and no colour literal; every value is a --ui-* token.
 *   P3   (§7.3) is NOT this component's to fix and is not claimed: "`pb-4` is the one
 *       utility in the file absent from the compiled bundle, so the filter field sits
 *       flush on the hairline". That is the containing pane's padding, i.e. the
 *       screen's business (spec §4.2). Recorded here only so the next reader does not
 *       go looking for it in the component.
 *
 * DELIBERATE DEPARTURES (declared in this wave's expected-changes manifest):
 *   - THE WELL IS 54px, NOT 52. --ui-icon is 24px (styles/tokens.css:126, sourced
 *     from slate-live.css:355-357) against Slate's 20px Tailwind literal, and the
 *     lead gap is --ui-space-3 = 12px against Slate's 14px, which is not on the
 *     spacing scale (§3.3). +4 and -2: the entry text starts 2px further right.
 *   - THE ENTRY IS 17px, NOT 18px. Slate's own two search-shaped fields disagree —
 *     the LIBRARY rule paints `.slate-field` at 17px (--slate-text-base) and the
 *     Settings screen's ID rule overrides it to 18px (--slate-text-md). One
 *     component, one type role: `.ui-body` is --ui-text-base 17px
 *     (src/components/TYPE_ROLES.md), and the 18px is a screen reaching in through an
 *     ID selector, which is the mechanism the shadow boundary removes.
 *   - NO UA CLEAR BUTTON, because `type="search"` is not used. MEASURED in the rig:
 *     with type=search, Chrome draws its own ::-webkit-search-cancel-button inside
 *     the field — a click 10px in from the input's right edge cleared "hello" to ""
 *     while elementFromPoint still reported the input. That control lives in
 *     ui-text-field's shadow root, is unreachable from any rule this component can
 *     write, takes no token and follows no theme: a UA affordance inside a Decal
 *     field, the same shape as the sixth focus treatment CONVENTIONS §3a removes.
 *     The entry is therefore `type="text"` with `inputmode="search"`, which keeps the
 *     search-optimised soft keyboard Slate asked for with `enterkeyhint="search"`.
 *     What is lost with it is a one-tap clear; the `trail` slot and `clear()` are the
 *     seam that puts one back (recorded as a deferred question).
 *
 * @fires input  — the native, composed input event from the entry. It crosses BOTH
 *                 shadow boundaries on its own and retargets to this host, so a
 *                 consumer listens for `input` on <ui-search-field> and nothing is
 *                 re-dispatched.
 * @fires change — re-dispatched composed by ui-text-field (the native one is
 *                 composed:false and would stop at its boundary), so it reaches here
 *                 and out.
 * @fires search — { detail: { value } }, on Enter and on clear(). Slate's own
 *                 settings.js:8128-8133 carries the reason in its comment: "Tapping
 *                 the keyboard's search/enter key dismisses the soft keyboard.
 *                 'search' fires on type=search; keep Enter as a fallback for
 *                 keyboards that send it instead." Two spellings, one event here.
 *                 WHAT TO DO ABOUT IT IS THE SCREEN'S: this component does not blur
 *                 itself, because dismissing a keyboard is policy, not paint.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import 'src/components/ui-text-field.js';

export class UiSearchField extends UiElement {
    static properties = {
        /** The entry's text. Owned by the consumer; mirrored on every keystroke. */
        value: { type: String },
        /** Placeholder text. Slate's is "Search settings..." — content, not design. */
        placeholder: { type: String },
        /**
         * The accessible name. Not shown unless `show-label` is set, because Slate's
         * search field is unlabelled with an aria-label (settings.html:19) — but a
         * control with no name at all is bug T15's other half ("four of twenty
         * switches have no accessible name"), so `accessibleName` falls back to the
         * placeholder rather than leaving the entry anonymous.
         */
        label: { type: String },
        /** Render the label visibly, above the field, with ui-text-field's for/id pair. */
        showLabel: { type: Boolean, attribute: 'show-label' },
        /**
         * A host-level `aria-label`, observed so a screen writing the Slate spelling
         * still re-renders. NOT named `ariaLabel`: that is a real property on Element
         * and shadowing it with a Lit accessor would stop `el.ariaLabel = x` reaching
         * the platform. The value is adopted and then REMOVED from the host — see
         * updated().
         */
        hostLabel: { type: String, attribute: 'aria-label' },
        /** Paint dims and the entry refuses input. Reflected; the base dims the host. */
        disabled: { type: Boolean, reflect: true },
        /**
         * OBSERVED, NOT OWNED — and it has to be forwarded, which is the one thing
         * composition breaks. `--_ui-focus-offset` is an inherited custom property,
         * so `focus-ring="inset"` on a host normally reaches every ring in the
         * subtree; but the base declares that property on EVERY `:host`, and a
         * declaration on the element beats a value inherited into it. So
         * ui-text-field's own `:host` re-declaration silently restores the outset
         * offset and bug L24's one-line answer would stop at this boundary. The
         * attribute is therefore relayed onto the inner field in render(), and this
         * property exists so that writing the attribute re-renders at all —
         * `UiElement#focusVariant` is deliberately not reactive ("it is a styling
         * hint the CSS reads straight off the attribute"), and it stays the resolver,
         * so an unrecognised value still falls back to `outset` rather than blanking
         * the ring.
         */
        focusRing: { type: String, attribute: 'focus-ring' },
    };

    static styles = [
        /* No `hitArea`: nothing here is a leaf control with ink smaller than the
         * floor. The field is --ui-control-h (64px) on both axes' shorter side and the
         * glyph is decorative, not pressable (CONVENTIONS §5).
         *
         * No `selectionSurface`: nothing here is selectable (wave law; CONVENTIONS §4).
         *
         * No `::slotted(:focus-visible)` copy: the base supplies it and ui-text-field's
         * own duplicate is already flagged as redundant rather than exemplary
         * (CONVENTIONS §3a, "Do not re-declare this per component"). */
        css`
            /* ---- the composed field ----------------------------------------
             * ui-text-field is :host { display: block } from the base, so it fills
             * this host without a rule. The class exists for the cascade
             * (CONVENTIONS §9: ids for querying, classes for the cascade) and it
             * carries exactly one declaration, below. */

            /* ONE DIAL, APPLIED ONCE. The base paints --ui-opacity-disabled in three
             * places that all reach a disabled search field: :host(...) on THIS host,
             * :where([disabled]) on the <ui-text-field> element inside this shadow
             * tree, and :host(...) again inside ui-text-field's own tree. Three
             * composited multiplications of .38 is .0548 — seven times further down
             * than the one dial says. The HOST keeps the paint, because
             * the host is the whole control; the inner element is neutralised here.
             * (0,2,0) against the base's :where() (0,0,0) inside this tree, and for
             * two normal declarations in different tree contexts the OUTER tree wins
             * whatever the specificity (CSS Scoping §3.3) — so this one declaration
             * beats both of the others and there is no !important anywhere.
             * ui-icon-button hit the two-way version of this and its fix is the same
             * shape. MEASURED both ways: a standalone disabled ui-text-field host
             * computes .38, the same element inside this component computes 1, and
             * this host computes .38. */
            :host([disabled]) .field {
                opacity: 1;
            }

            /* ---- the icon well ----------------------------------------------
             * A BOX IN THE FLOW, which is the entire row. Slate's glyph is absolutely
             * positioned over an input whose left pad is a hand-computed constant
             * (quoted with its oracle citation in the file header), so the pad knows
             * nothing about the glyph. Here the glyph is a flex item of the field's
             * own line, the entry starts after it by construction, and the well is
             * --ui-space-4 + --ui-icon + --ui-space-3 with no number typed.
             *
             * The square is --ui-icon on BOTH axes: "Intrinsic icon geometry
             * (§2.3 case 3)", styles/tokens.css:121-126.
             *
             * flex: none is not decoration — bug T9's class, "it is a flex item with
             * default shrink ... A touch floor that a parent can shrink is not a
             * floor". At a 200px container the well must still be 24px, and the suite
             * measures it there. ui-text-field's own ::slotted(*) says the same thing
             * from the inner tree; this states it where the box is declared, so the
             * well cannot lose its size to a rule in another file. */
            .well {
                display: grid;
                place-items: center;
                flex: none;
                inline-size: var(--ui-icon);
                block-size: var(--ui-icon);

                /* THE INK, from the read-only source read at the top of this file:
                 * settings.html:20 gives the glyph the ink var(--text-primary), and
                 * slate-tokens.css:236 resolves --text-primary to var(--slate-text).
                 * ui-text-field paints ::slotted(*) at --ui-muted from its own tree
                 * for a generic adornment; a search glyph is Slate's primary ink, and
                 * this declaration wins because the outer tree wins (CSS Scoping
                 * §3.3) — the suite asserts that, because it is the kind of
                 * cross-boundary fact that is easy to believe and wrong. */
                color: var(--ui-text);
            }

            /* The artwork fills the square and paints itself — spec §2.3 case 3 keeps
             * stroke widths with the artwork, so nothing here touches fill or stroke.
             * Two selectors because the glyph can be in two places: this component's
             * default, in its own shadow tree, or the consumer's, slotted in. */
            .glyph,
            slot[name="icon"]::slotted(svg),
            slot[name="icon"]::slotted(img) {
                display: block;
                inline-size: 100%;
                block-size: 100%;
            }

            /* ---- the trailing seam -------------------------------------------
             * A forwarded slot element is display: contents (UA sheet), so it has no
             * box of its own: ui-text-field's own trail-slot margin lands on that
             * box-less element and does nothing. The gap therefore has to be
             * declared HERE, on the consumer's own nodes, which are the real flex
             * items in the field's line. On ::slotted so an EMPTY trail costs no
             * space at all — the same reason ui-text-field puts its adornment gap on
             * the slotted element rather than as a flex gap. */
            slot[name="trail"]::slotted(*) {
                flex: none;
                margin-inline-start: var(--ui-space-3);
            }
        `,
    ];

    /** The host-written name after it has been taken off the host. */
    #adoptedLabel = null;

    /** True for exactly one update: the aria-label removal below is OURS, not a clear. */
    #adopting = false;

    constructor() {
        super();
        this.value = '';
        this.placeholder = '';
        this.label = '';
        this.showLabel = false;
        this.hostLabel = null;
        this.disabled = false;
        this.focusRing = null;
    }

    /* ---- the composed field ------------------------------------------------ */

    /** The inner field. Ids are for querying (CONVENTIONS §9). */
    get field() {
        return this.renderRoot?.querySelector?.('#field') ?? null;
    }

    /**
     * The name the entry will carry, in the order a caller would expect. The
     * placeholder is the last resort rather than the first — Chrome would fall back
     * to it anyway, and stating it makes "this field has no name" a thing that cannot
     * happen quietly (bug T15).
     */
    get accessibleName() {
        return this.label || this.hostLabel || this.#adoptedLabel || this.placeholder || null;
    }

    render() {
        const name = this.accessibleName;
        const labelVisible = this.showLabel && Boolean(this.label);
        return html`
            <ui-text-field
                id="field"
                class="field"
                type="text"
                inputmode="search"
                .value=${this.value ?? ''}
                .placeholder=${this.placeholder ?? ''}
                .label=${labelVisible ? this.label : (name ?? '')}
                ?hide-label=${!labelVisible}
                ?disabled=${this.disabled}
                focus-ring=${this.focusVariant === 'inset' ? 'inset' : nothing}
                @input=${this.#onInput}
                @keydown=${this.#onKeydown}
            >
                <span class="well" slot="lead" aria-hidden="true">
                    <slot name="icon">
                        <!-- Slate's own path, carried verbatim from settings.html:20.
                             aria-hidden on the WELL, so a consumer's replacement glyph
                             is decorative too without having to remember. -->
                        <svg class="glyph" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2"
                             stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                    </slot>
                </span>
                <slot name="trail" slot="trail"></slot>
            </ui-text-field>
        `;
    }

    /**
     * ONE NAME, ON THE ENTRY. The <input> now carries it, so the copy left on this
     * host is a second announcement of the same name on a role-less generic — which
     * ARIA does not allow and Chrome exposes anyway (bug T15, "aria-label on role-less
     * divs"). Moved, not copied; converges in one extra update because `hostLabel`
     * going null cannot re-trigger the removal.
     */
    updated() {
        if (this.#adoptedLabel && this.hasAttribute('aria-label')) {
            this.#adopting = true;
            this.removeAttribute('aria-label');
        }
    }

    willUpdate(changed) {
        if (!changed.has('hostLabel')) return;
        if (this.hostLabel) this.#adoptedLabel = this.hostLabel;
        else if (!this.#adopting) this.#adoptedLabel = null;
        this.#adopting = false;
    }

    /* ---- events ------------------------------------------------------------ */

    /**
     * The entry's own `input` is composed:true and is already on its way out; this
     * handler only keeps the property in step with it. Re-dispatching would deliver
     * it twice — the trap ui-text-field's own comment records.
     */
    #onInput(event) {
        this.value = event.target?.value ?? '';
    }

    /**
     * ONE EVENT FOR TWO KEYBOARDS. `search` is the native name and this is the native
     * meaning; with type=text nothing else fires it, so there is no double.
     */
    #onKeydown(event) {
        if (event.key !== 'Enter') return;
        this.#emitSearch();
    }

    #emitSearch() {
        this.dispatchEvent(new CustomEvent('search', {
            bubbles: true,
            composed: true,
            detail: { value: this.value ?? '' },
        }));
    }

    /* ---- the surface a search field is expected to have -------------------- */

    /**
     * Empty the field and say so. The pair of events is the native contract: Chrome's
     * own clear affordance fires `input` and then `search`, and a consumer that has
     * wired a filter to `input` keeps working without knowing this method exists.
     */
    clear() {
        if ((this.value ?? '') === '') return;
        this.value = '';
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this.#emitSearch();
    }

    /**
     * Focus goes INWARD, without `delegatesFocus`. CONVENTIONS §11: as a default it
     * "produces two rings on one control", and the ring here belongs to the field
     * wrapper inside ui-text-field.
     */
    focus(options) {
        const field = this.field;
        if (field) field.focus(options);
        else super.focus(options);
    }

    blur() {
        const field = this.field;
        if (field) field.blur();
        else super.blur();
    }

    select() { this.field?.select(); }
}

customElements.define('ui-search-field', UiSearchField);

export default UiSearchField;
