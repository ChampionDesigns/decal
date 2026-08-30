/**
 * ui-icon-button — Wave 1 item #2, "Icon button (+ lg)".
 *
 * Spec row (LAYOUT_SPEC_DRAFT.md §5.1 #2): "Icon button (+ lg) | 14 + 5 uses" — the
 * one inventory row with an empty Note column, i.e. nothing about it is disputed.
 * The wave row's own note is the whole brief: "Square press control holding a glyph
 * at `--ui-icon`/`--ui-icon-lg`." Two sizes, one square, one glyph slot, and every
 * number a token.
 *
 * TOKEN-ONLY (Part 10 §12, wf-w1-primitives). No data layer, no ReaPrime, no
 * endpoint. The label, the size and the disabled flag all arrive from outside as
 * attributes; this element owns none of them and validates none of them.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE ORACLE MEASURED — every appearance value below is one of these lines.
 * Queried mechanically with realine-run/tools/prov_query.py against
 * slate-audit-2026-08-16/prov-baseline (dark) and prov-light. Quoted, never
 * paraphrased (SCOPE Part 10 §4).
 *
 *   CITE  find --cls slate-icon-btn -> 24 element(s) in 11 state(s); distinct
 *         geometries 82x82 x14, 96x82 x7, 58x58 x3.
 *         find --cls slate-icon-btn-lg -> 14 element(s) in 11 state(s).
 *
 *   THE SMALL SQUARE — the component class's own size. Three elements in the corpus
 *   take their box from `.slate-icon-btn` alone (the modal closes); every other one
 *   carries -lg or a screen override:
 *   CITE  profile-selector #add-profile-modal-close [i=200] width = 64px  <-
 *         slate-components.css  `.slate-icon-btn`  authored `var(--slate-control-height)`
 *         !important=no  (token-driven)
 *   CITE  profile-selector #add-profile-modal-close [i=200] height = 64px  <-
 *         slate-components.css  `.slate-icon-btn`  authored `var(--slate-control-height)`
 *         !important=no  (token-driven)
 *   => --ui-control-h (64px, styles/tokens.css:88, spec §3.1 "the skin's spine").
 *
 *   AND THE RENDERED BOX IS NOT 64x64 ANYWHERE — the same record prints
 *   `rect x=1112 y=433 w=58 h=58   (captured at 1920x1200)` beside that computed 64px,
 *   and `find --cls slate-icon-btn` lists the distinct geometries as 82x82 x14,
 *   96x82 x7, 58x58 x3. 64x64 appears zero times. The reason is a read-only source
 *   read, because the corpus never probed it (prov_query.py CARVE-OUTS: "transforms
 *   were never probed"): the profile selector's four dialogs parse INSIDE
 *   #scaled-content (spec §7.3 P1) and `scaling.js:173` sets
 *   `translate(...) scale(sx, sy)` on it, so those three boxes are captured scaled
 *   (58 = 64 x 0.90625) while getComputedStyle still reads the authored 64px.
 *   The COMPUTED value and its winning rule are the citable facts and they are what
 *   this component carries; "the only element in the corpus that renders it" was a
 *   claim the same query disproves, and it is struck here and in the gallery entry.
 *
 *   THE LARGE SQUARE:
 *   CITE  editor-review #editor-history-btn [i=11] width = 82px  <-
 *         slate-components.css  `.slate-icon-btn-lg`  authored `var(--slate-control-lg)`
 *         !important=no  (token-driven)
 *   CITE  editor-review #editor-history-btn [i=11] height = 82px  <-
 *         slate-components.css  `.slate-icon-btn-lg`  authored `var(--slate-control-lg)`
 *         !important=no  (token-driven)
 *   => --ui-control-lg (82px, styles/tokens.css:96, spec §3.1 "Header controls only").
 *
 *   THE PAINT, and it inverts correctly on both themes (`themes --state editor-review
 *   --id editor-history-btn`: 16 of 18 properties identical across themes; 2 differ):
 *   CITE  editor-review #editor-history-btn [i=11] background-color = rgba(0, 0, 0, 0)
 *         <-  slate-components.css  `.slate-icon-btn`  authored `transparent`
 *         !important=no  (FROZEN/hardcoded)
 *   CITE  editor-review #editor-history-btn [i=11] color = rgb(186, 196, 202)  <-
 *         slate-components.css  `.slate-icon-btn`  authored `var(--slate-text-2)`
 *         !important=no  (token-driven)          [light: rgb(63, 71, 76)  DIFF]
 *         => --ui-text-2 (dark #bac4ca = rgb(186,196,202); light #3f474c = rgb(63,71,76))
 *   CITE  editor-review #editor-history-btn [i=11] border-top-color = rgb(58, 72, 82)
 *         <-  slate-components.css  `.slate-icon-btn`  authored `(NOT CAPTURED — set
 *         via a CSS shorthand)`  !important=no  (token-driven)
 *                                              [light: rgb(203, 208, 211)  DIFF]
 *         => --ui-line (dark #3a4852 = rgb(58,72,82); light #cbd0d3 = rgb(203,208,211))
 *   CITE  editor-review #editor-history-btn [i=11] border-top-width = 1px  <-
 *         slate-components.css  `.slate-icon-btn`  (shorthand)  => --ui-border-w
 *   CITE  editor-review #editor-history-btn [i=11] border-top-left-radius = 6px  <-
 *         slate-components.css  `.slate-icon-btn`  (shorthand)  => --ui-radius (6px)
 *   CITE  live-ready #profile-open-selector [i=8] padding-left = 0px  <-
 *         slate-components.css  `.slate-icon-btn`  authored `0px`  !important=no
 *   CITE  editor-review #editor-history-btn [i=11] font-weight = 400  => --ui-weight-regular
 *   CITE  editor-review #editor-history-btn [i=11] box-shadow = none
 *         <-  (no declaration — inherited or initial value)
 *
 *   The three shorthand lines are flagged by the tool itself: the authored token
 *   NAME is not citable behind `border:` / `border-radius:`, only the computed value,
 *   the sheet and the selector. The token each maps to is therefore taken from
 *   styles/tokens.css by VALUE (rgb(58,72,82) is --ui-line's dark value and nothing
 *   else's), which is the same identification the token sheet's own SOURCE comments
 *   make.
 *
 * ORACLE DISQUALIFIED / SILENT, in four places, each handled below:
 *   1. RESPONSIVE BEHAVIOUR. No answer exists — 98.4% of Slate's geometry is frozen
 *      and the corpus is a single 1920x1200 capture. LAYOUT_SPEC_DRAFT.md governs:
 *      this is a FIXED control (§2.3 case 2, "physically justified"), so it is the
 *      same square at 1281x801 and at the 1000x600 floor, and it reads no viewport.
 *   2. HOVER, FOCUS AND DISABLED are outside the corpus's 18-property appearance
 *      surface (it records resting state only). The ring comes from the base and
 *      --ui-focus-* (§3.6); the hover is a read-only source read of
 *      slate-components.css:329-335; disabled is one dial, --ui-opacity-disabled.
 *   3. THE 96x82 GEOMETRY in the find table is not this component. It is
 *      #fullscreen-toggle-btn under a screen rule — `#main-page .slate-live-header
 *      .slate-icon-action { min-width: var(--slate-control-lg) }`
 *      (slate-live.css:350-352) plus the header's padding. The primitive is SQUARE
 *      (the spec row's own word); a header that wants a wider tap slab is item #31's
 *      business, from outside — AND THE MECHANISM FOR THAT IS HERE, because deferring
 *      it without one leaves #31 nothing to do it with (ITEMS.json notes (7):
 *      "#1, #2 -> Wave 2 #16 sheet header and #31 page header bar", "recorded because
 *      they constrain the API"):
 *
 *          ui-icon-button.header-action { inline-size: 96px }   <- item #31's sheet
 *
 *      The two squares are the control's FLOOR, not a cap: .btn declares min-inline-
 *      size/min-block-size and stretches to the host's box (grid `stretch` is the
 *      default alignment), so widening the HOST widens the PRESSABLE control with it,
 *      with no dead unpressable strip and no !important — an outside rule naming the
 *      element beats :host by the shadow-host precedence rule (CONVENTIONS §6). No
 *      public custom property is invented for this: --_ui-icon-btn-box stays private
 *      (CONVENTIONS §7), and a component's public sizing surface is the host itself,
 *      the same lever ui-button documents for a full-width button.
 *   4. THE ACCESSIBLE NAME. Six of the nine icon buttons in the corpus carry one
 *      (aria-label=Choose a profile / Toggle Fullscreen / Version history / Back to
 *      main screen x2 / Add New Profile); the three modal closes carry aria="" with
 *      text "✕", i.e. their name IS the glyph — untranslatable, and unreadable to a
 *      screen reader user. Decal takes the name from `label` instead.
 *
 *      AND A HOST-WRITTEN NAME IS MOVED, NOT COPIED. The host of a custom element
 *      with no role is a generic, and ARIA does not allow a name on role=generic —
 *      Chrome computes one anyway, so `aria-label` left on the host AND copied to the
 *      button is one name announced twice, the second time on a container that does
 *      nothing. The host's aria-label is therefore adopted and then removed from the
 *      host; the real <button> is the only element that carries it. `.hostLabel`
 *      still reads the adopted value back, and setting it to '' clears the name.
 *
 *   5. THE STATE ATTRIBUTES AN OPENER NEEDS. A shadow root forwards no aria-*:
 *      anything a screen writes on the host lands on that same role-less generic and
 *      never reaches the control. Two of the corpus's nine icon buttons are openers
 *      (#profile-open-selector "Choose a profile", #add_profile "Add New Profile"), so
 *      aria-expanded / aria-haspopup / aria-controls / aria-pressed are observed on the
 *      host and rendered onto the button — spec Appendix 15, "the `aria-*`-driven state
 *      selectors ... the right contract for a Lit component's reflected properties".
 *      COPIED, not moved, unlike the name: a state on a generic is not exposed to AT so
 *      it duplicates nothing, and a screen may be using it as its own CSS hook.
 *      NO SELECTION PAINT rides along with aria-pressed. CONVENTIONS §4 gives selection
 *      to item #3, the segmented bank; a treatment here would be the fourteenth
 *      selection idiom, which is the decay the rewrite exists to stop. The attribute
 *      relays the state a consumer already wrote; it does not invent a look for it.
 *
 * ---------------------------------------------------------------------------
 * BUGS THIS COMPONENT CANNOT REPRODUCE (each has an assertion in
 * test/render/ui-icon-button.render.test.mjs cited to its id):
 *
 *   L24  "focus rings clipped on all four sides by the components they sit inside".
 *        An icon button in a header band is exactly that shape. One ring, two
 *        offsets: focus-ring="inset" on the host switches this whole component to
 *        --ui-focus-offset-inset and the clipper cannot reach the ring (CONVENTIONS
 *        §3). No second treatment is authored here — the base owns the only one.
 *   L22  "five of the nine numpad targets are inline spans whose hit box is the
 *        glyphs — measured 32 x 35 against a 48px floor, on a wall panel operated
 *        with a wet hand" (§7.2 L22). Both squares here clear --ui-hit-min (48px)
 *        with paint alone: 64 and 82, on both axes, asserted on the rendered border
 *        box. That half is genuinely unreachable in this component.
 *
 *   P4, READ CORRECTLY, and it is NOT a hit-floor violation. §7.3 P4: "The favourite
 *        slots take their GEOMETRY from one rule and their PAINT from another 1300
 *        lines away; measured 64x64, so --slate-hit-min is silently not applied where
 *        the comment says it is, and the favourites row is 113px rather than ~96."
 *        The box EXCEEDS the 48px floor — the defect is a hard-coded 64
 *        (slate-shell.css:351-355 `#subpage-host [id^="assign-fav-btn-"]`) standing in
 *        for the token the neighbouring rule reads (:1666-1677 `.ps-fav-slot`
 *        `width: var(--slate-hit-min)`), in a second file, with a knock-on row height.
 *        So the assertion that clears P4's CLASS here is the token drill, not a
 *        measurement of 64: retarget --ui-control-h and the rendered square moves with
 *        it, which a hard-coded box cannot do. Geometry and paint are also one rule in
 *        one file. The favourite slot itself is not this component (it is a later
 *        row); what this file can honestly claim is P4's class, not P4.
 *   L12  "a private palette duplicating the public tokens value-for-value". This
 *        file declares two private properties, both --_ui-, both pure geometry
 *        references; the token drills prove every rendered value still comes from
 *        :root.
 *   SLATE'S OWN [hidden] DEFECT, from the sheet's comment at
 *   slate-components.css:236-240: "A component sets `display`, which outranks the
 *   [hidden] attribute — so hiding one by script silently did nothing." Slate needed
 *   `display: none !important` to fix it. Here :host([hidden]) is (0,2,0) against
 *   this file's :host (0,1,0), so hiding works with zero !important — the base rule
 *   wins on specificity, not on ordering.
 *
 * DELIBERATE DEPARTURES, both recorded in the wave-1 ledger
 * (_skinlab/realine-run/EXPECTED_CHANGES.jsonl, region ui-icon-button; source
 * _skinlab/realine-run/waves/1/ledger-src/) - a ledger that exists on disk and can be
 * checked, not a "manifest" no file corresponds to:
 *   - A TEXT glyph is drawn at --ui-icon, not at Slate's 16px. Slate's ✕ closes
 *     inherit the browser default (CITE profile-selector #add-profile-modal-close
 *     [i=200] font-size = 16px <- app.css `button, input, optgroup, select,
 *     textarea` authored `100%` !important=no (FROZEN/hardcoded)) — a preflight
 *     leak, not a design value. The row says the glyph is at --ui-icon/--ui-icon-lg
 *     and a text glyph is a glyph.
 *   - DISABLED is .38 (--ui-opacity-disabled, spec §3.7) against Slate's `.3`
 *     (slate-components.css:812-816), which is one of the three live values §3.7
 *     settles.
 *
 * @fires click — the native, composed click from the inner button. No custom event:
 *                a press control that needs a bespoke event name is one every
 *                consumer has to learn twice.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';

export class UiIconButton extends UiElement {
    static properties = {
        /**
         * `'md'` (default, --ui-control-h) or `'lg'` (--ui-control-lg). Reflected,
         * because the geometry is keyed on the attribute; an unrecognised value
         * simply does not match the [size="lg"] rule and stays md, which is the
         * same forgiving fallback UiElement#focusVariant uses for focus-ring.
         */
        size: { type: String, reflect: true },
        /**
         * The accessible name. An icon button has no visible text, so this is not
         * decoration — it is the only thing a screen reader can announce.
         */
        label: { type: String },
        /** Paint dims and input is refused. Reflected; the base dims the host. */
        disabled: { type: Boolean, reflect: true },
        /**
         * A host-level `aria-label`, observed so a screen that writes the Slate
         * spelling still gets a re-render. NOT named `ariaLabel`: that is a real
         * property on Element (ARIA reflection) and shadowing it with a Lit accessor
         * would make `el.ariaLabel = x` stop reaching the platform.
         */
        hostLabel: { type: String, attribute: 'aria-label' },
        /**
         * THE OPENER'S STATE, relayed to the real control. A shadow root forwards no
         * aria-*, so without these four an `aria-expanded` a screen wrote on the host
         * sits on a role-less generic and no assistive technology ever sees it — and
         * two of the corpus's nine icon buttons are openers. Observed as attributes
         * (that is how a screen writes them) and rendered onto the button below.
         * String, not Boolean: aria-expanded is the three-valued ARIA spelling
         * ("true"/"false"/absent) and aria-haspopup carries `menu`, `dialog`, `listbox`.
         * aria-pressed is relayed and NOT painted — CONVENTIONS §4 gives selection
         * treatment to item #3, the segmented bank.
         */
        expanded: { type: String, attribute: 'aria-expanded' },
        haspopup: { type: String, attribute: 'aria-haspopup' },
        controls: { type: String, attribute: 'aria-controls' },
        pressed: { type: String, attribute: 'aria-pressed' },
    };

    static styles = [
        /* No `hitArea`: this control's INK is 64x64 (or 82x82), so both axes clear
         * --ui-hit-min with the paint alone. The overlay exists for a leaf whose ink
         * is SMALLER than the floor (CONVENTIONS §5) and it would sit above this
         * element's own slotted glyph for no gain.
         *
         * No `selectionSurface`: no icon button in the 49-state corpus carries
         * aria-pressed, aria-selected or .is-selected — checked, all nine. A toggle
         * treatment here would be a fourteenth selection idiom invented, not carried,
         * and item #3 (segmented bank) is the one component that owns selection
         * (CONVENTIONS §4). Recorded as a deferred question (realine-run/waves/1/
         * ledger-src/02-builders-deferred-questions.json), reversible by importing
         * the fragment. */
        css`
            /* ---------------------------------------------------------------
             * THE HOST IS THE SQUARE
             *
             * CONTAINER-HOSTING OPT-OUT, in the one line CONVENTIONS §2 documents:
             * inline-size containment means the host's inline size can no longer
             * depend on its contents, which is right for anything filling a slot and
             * wrong for a control that must shrink to fit its glyph. Without it, an
             * icon button in a flex header row contributes a 0px intrinsic size and
             * the failure looks like "my component vanished".
             *
             * flex: none for the same reason from the other side, and it is bug T9's
             * class: "it is a flex item with default shrink. Measured 214 in one leaf
             * and 250 two rows below, inside a single screen". A touch floor that a
             * parent can shrink is not a floor.
             * ------------------------------------------------------------- */
            :host {
                container-type: normal;
                display: inline-grid;
                flex: none;

                /* Private geometry, --_ui- so the token-integrity check can never
                 * mistake it for a token (CONVENTIONS §7). Two properties, one per
                 * size, so the size variant is two declarations rather than a second
                 * copy of the whole control. Neither carries a colour. */
                --_ui-icon-btn-box: var(--ui-control-h);
                --_ui-icon-btn-glyph: var(--ui-icon);
            }

            /* THE LG VARIANT. "Same component, one size token apart" — the sheet's
             * own words at slate-components.css:227-231, kept. */
            :host([size="lg"]) {
                --_ui-icon-btn-box: var(--ui-control-lg);
                --_ui-icon-btn-glyph: var(--ui-icon-lg);
            }

            /* ---------------------------------------------------------------
             * THE CONTROL
             *
             * Painted by CLASS, never by id (CONVENTIONS §9): the id is here for the
             * rendering suite to query by. A resting paint on an id is (1,0,0) and
             * silently beats every state treatment that might be composed on later.
             * ------------------------------------------------------------- */
            .btn {
                display: inline-grid;
                place-items: center;

                /* THE SQUARE IS A FLOOR, NOT A CAP, and that is the whole of item
                 * #31's lever. Slate declares min-height beside the height and the
                 * reason spec §2.3 case 2 gives is that the touch floor is physical:
                 * a floor, not a preference. Declared as min-* ONLY, so the control
                 * stretches to the host's box (stretch is the default alignment for
                 * a grid item with an auto size) — a header that sets
                 * ui-icon-button { inline-size: 96px } from outside gets a 96px
                 * PRESSABLE control, not a 64px button in a 96px host with a dead
                 * strip beside it. With no host size the host is content-sized, so
                 * both axes resolve to the floor and the resting control is exactly
                 * 64x64 / 82x82. */
                min-inline-size: var(--_ui-icon-btn-box);
                min-block-size: var(--_ui-icon-btn-box);
                padding: 0;

                /* THE BOX IS A HOOK, and it is one because a caller needed it off.
                 *
                 * Ben, 25 August 2026, on the profile editor's rename pencil: "copy
                 * Slates edit icon and remove the box around it". Slate's own
                 * .slate-editor-pencil is border: 0 with a transparent ground - the
                 * glyph alone, no control chrome - and it is the only place in that
                 * skin where an icon button is drawn that way.
                 *
                 * A PRIVATE ON :host IS THE ONLY ROUTE A CALLER HAS. Gate C forbids
                 * re-pointing a public --ui-* token from outside, and a border rule
                 * aimed at this element from a screen cannot reach the shadow tree at
                 * all. Declared here it is a default an outer declaration overrides,
                 * which is the shape the whole library uses for a knob. */
                border: var(--_ui-icon-btn-border, var(--ui-border-w) solid var(--ui-line));
                border-radius: var(--ui-radius);
                background-color: transparent;
                color: var(--ui-text-2);

                /* A button does NOT inherit type from its ancestors — the UA sheet
                 * gives every form control its own font (measured: 13.333px Arial
                 * inside a shadow root, where no preflight reaches). So the four
                 * declarations are load-bearing, not tidy-up. */
                font-family: inherit;
                font-weight: var(--ui-weight-regular);
                font-size: var(--_ui-icon-btn-glyph);
                line-height: 1;

                cursor: pointer;
            }

            /* THE GLYPH. Artwork is sized by the component and painted by itself:
             * spec §2.3 case 3 keeps "icon and glyph geometry intrinsic to the
             * artwork (stroke widths, a 12px arrow square)" with the artwork, so
             * nothing here touches fill or stroke. A TEXT glyph needs no rule at all
             * — it inherits font-size through the flat tree from .btn. */
            ::slotted(svg),
            ::slotted(img) {
                inline-size: var(--_ui-icon-btn-glyph);
                block-size: var(--_ui-icon-btn-glyph);
            }

            /* HOVER, from a read-only source read of slate-components.css:329-335
             * (the corpus records resting state only, so the oracle is silent here):
             *     .slate-btn:not(:disabled):hover,
             *     .slate-icon-btn:not(:disabled):hover {
             *         border-color: var(--slate-line-strong);
             *         background: var(--slate-key);
             *         color: var(--slate-text);
             *     }
             * Kept including its guard. The guard is not decoration: on a touch
             * panel a sticky :hover leaves the last-pressed control lit, and this is
             * a wall panel. It is a MEDIA FEATURE query, not a width query — the
             * banned thing is @media (width...), which would make the component read
             * the viewport instead of its own container (CONVENTIONS §2).
             *
             * background-COLOR, never the background shorthand: the shorthand resets
             * background-clip and Slate's own sheet documents what that costs
             * (slate-live.css:1565-1567, the 32px slab). */
            @media (hover: hover) {
                .btn:not(:disabled):hover {
                    border-color: var(--ui-line-strong);
                    background-color: var(--ui-key);
                    color: var(--ui-text);
                }
            }

            /* ONE DIAL, APPLIED ONCE — and this rule is the whole reason the trap is
             * survivable. The base paints --ui-opacity-disabled on BOTH spellings:
             * :host(:is([disabled], [aria-disabled="true"])) for the reflected host
             * attribute, and :where([disabled]) for the native attribute on the inner
             * control. A component that carries both (which this one must: the host
             * attribute is the API, the native attribute is what actually refuses
             * input) composites them, and .38 x .38 = .1444 — a control dimmed nearly
             * three times as far as the dial says. The host keeps the paint because
             * the host IS the whole control; the inner button is neutralised.
             * Specificity (0,2,0) against the base's :where() (0,0,0), so no
             * !important anywhere (CONVENTIONS §6). */
            :host(:is([disabled], [aria-disabled="true"])) .btn {
                opacity: 1;
            }
        `,
    ];

    /**
     * The host-written name after it has been taken off the host. Private, because a
     * consumer reads it back through `.hostLabel` / `.accessibleName`, never here.
     */
    #adoptedLabel = null;

    /** True for exactly one update: the aria-label removal below is OURS, not a clear. */
    #adopting = false;

    constructor() {
        super();
        this.size = 'md';
        this.label = '';
        this.disabled = false;
        this.hostLabel = null;
        this.expanded = null;
        this.haspopup = null;
        this.controls = null;
        this.pressed = null;
    }

    /** The inner control — what focus, clicks and the native disabled belong to. */
    get control() {
        return this.renderRoot?.querySelector?.('button') ?? null;
    }

    /**
     * Focus forwards to the control, so `iconButton.focus()` does what the caller
     * plainly means. NOT `delegatesFocus`: that also makes the host match
     * :focus-visible, and the base rings the host as well as the inner button — two
     * rings on one control, which is the exact thing CONVENTIONS §11 says not to
     * turn on globally.
     */
    focus(options) {
        const control = this.control;
        if (control) control.focus(options);
        else super.focus(options);
    }

    blur() {
        const control = this.control;
        if (control) control.blur();
        else super.blur();
    }

    /**
     * The accessible name, in the order a caller would expect: the property first,
     * then the two spellings a Slate-shaped screen would already be writing. Never
     * the glyph — six of Slate's nine icon buttons name themselves properly and the
     * three that do not are named "✕".
     */
    get accessibleName() {
        return this.label || this.hostLabel || this.#adoptedLabel
            || this.getAttribute('title') || null;
    }

    /**
     * Remember a host-written name before the attribute is taken away, and forget it
     * when the CONSUMER clears it. The flag is what tells the two apart: our own
     * removeAttribute below sets `hostLabel` to null on the way through, and without
     * it the component would erase the name it had just adopted.
     */
    willUpdate(changed) {
        if (!changed.has('hostLabel')) return;
        if (this.hostLabel) this.#adoptedLabel = this.hostLabel;
        else if (!this.#adopting) this.#adoptedLabel = null;
        this.#adopting = false;
    }

    /**
     * ONE NAME, ON THE CONTROL. The button now carries it, so the copy on the host is
     * a second announcement of the same name on a role-less generic — which ARIA does
     * not allow and Chrome exposes anyway. Moved, not copied; converges in one extra
     * update because `hostLabel` going null cannot re-trigger the removal.
     */
    updated() {
        if (this.#adoptedLabel && this.hasAttribute('aria-label')) {
            this.#adopting = true;
            this.removeAttribute('aria-label');
        }
    }

    render() {
        const name = this.accessibleName;
        return html`
            <button
                id="control"
                class="btn"
                type="button"
                ?disabled=${this.disabled}
                aria-label=${name ?? nothing}
                aria-expanded=${this.expanded ?? nothing}
                aria-haspopup=${this.haspopup ?? nothing}
                aria-controls=${this.controls ?? nothing}
                aria-pressed=${this.pressed ?? nothing}
            ><slot></slot></button>
        `;
    }
}

customElements.define('ui-icon-button', UiIconButton);
