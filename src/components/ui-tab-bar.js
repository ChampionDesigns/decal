/**
 * ui-tab-bar — Wave 3 item #32, the Tab bar / tablist.
 *
 * Spec row (LAYOUT_SPEC_DRAFT.md §5.2 #32): "Tab bar / tablist | editor's is correct
 * (`profile_editor.js:3590-3601`); Live's favourites and `#dye-strip` are hand-built
 * copies of the bank".
 * SCOPE Part 4 Wave 3: "Roving-tabindex tablist. The editor's implementation is
 * *correct* and its behaviour carries over (spec §5.2 #32, Appendix 10); the paint
 * comes from #3 so tabs and banks stop diverging."
 *
 * =========================================================================
 * THE ONE-LINE ARGUMENT: A TAB BAR IS A BANK PLUS ITS PANELS
 * =========================================================================
 *
 * Everything a tab LOOKS like is `ui-bank` in `mode="tablist"` (Wave 2 item #3) and
 * everything a tab DOES with the keyboard is ui-bank's Appendix 10 roving tabindex.
 * Neither is re-implemented here — this file contains no selected-state rule, no key
 * handler and no button. What it adds is the half a bank cannot carry, in ui-bank's
 * own words (ui-bank.js:243-247):
 *
 *     "`controls` is the id of the panel a tab owns, which is the half of bug L23 —
 *      'tabs with no tabpanels and no aria-controls' — that a component can carry;
 *      the panel itself belongs to whoever laid the screen out."
 *
 * This component is "whoever laid the screen out". It owns the tab -> panel pairing:
 * the panels' `role="tabpanel"`, their accessible names, which one is showing, and —
 * the part a screen always forgets — that the hidden ones are out of the tab order.
 *
 * WHY THAT MATTERS MORE THAN IT SOUNDS. Spec §7 L23 (`index.html:77-81, 358,
 * 479-482`) is one bug with three symptoms, and every one of them is the *pairing*
 * going missing rather than a control being wrong: "tabs with no tabpanels and no
 * `aria-controls`; a `role="tablist"` whose 46×30 tabs never receive
 * `aria-selected`". A bank fixes the second symptom by construction — its aria state
 * IS its paint (spec Appendix 15) — and can do nothing at all about the first,
 * because the panel is somewhere else in the document.
 *
 * =========================================================================
 * THREE BUGS DIE BY COMPOSITION, WHICH IS THE POINT OF THE ROW
 * =========================================================================
 *
 *   L8 / E10 (§7.2, §7.3)  "The favourites bank and `#dye-strip` are two hand-built
 *              copies of `.slate-bank`, while the expanded tabs use the real one";
 *              "Two competing segmented implementations with opposite selected
 *              treatments ... both bypassing the four selection dials".
 *              → This file cannot express a third. It has no `.item`, no
 *                `[aria-selected]` rule and no colour: a selected tab is painted by
 *                ui-bank's `selectionSurface`, inside ui-bank's shadow root, from
 *                --ui-selected-face / -ink / -led / -glow and nothing else. Turning
 *                one dial moves the tabs, the favourites and the settings banks
 *                together, because there is one implementation to move. The suite
 *                proves it the only way a screenshot cannot: with the four dials
 *                neutral, the selected tab and its neighbours are indistinguishable.
 *
 *   L23 (§7.1)  the pairing, above. A panel handed to this component gets
 *               `role="tabpanel"`, a name, and a visibility that follows the
 *               selection — including when the selection moved by arrow key.
 *
 *   P13's SHAPE (§7.5)  "Closed dialogs stay in the tab order: DaisyUI's `.modal`
 *               sets `display: grid; opacity: 0` with no `visibility: hidden`,
 *               defeating the UA's `dialog:not([open]) { display: none }`. Measured
 *               16 focusables inside `dialog:not([open])` out of 30 on the page."
 *               That is a dialog bug, not a tab bug, but the mechanism is exactly
 *               what a hidden tabpanel is exposed to: `[hidden]` is a UA rule at the
 *               bottom of the cascade and any screen rule with a `display` wins over
 *               it. So a hidden panel gets `inert` as well as `hidden`, and the suite
 *               asserts the focus consequence — through a stylesheet that defeats
 *               `hidden` on purpose — rather than asserting the attribute.
 *
 * =========================================================================
 * WHAT THIS COMPONENT DELIBERATELY DOES NOT DO
 * =========================================================================
 *
 * NO `aria-controls` ATTRIBUTE — BUT THE ASSOCIATION IS MADE, BY REFERENCE.
 * Finding cmodality-12 read the first version of this paragraph and was right about
 * it: L23's text names "tabs with no tabpanels and no `aria-controls`", this component
 * supplied the tabpanels and left the second half standing, and the reason given no
 * longer closes the question.
 *
 * The reason itself still holds for the ATTRIBUTE. An IDREF resolves in one tree
 * scope. The tab buttons live in ui-bank's shadow root; a panel lives in the screen's
 * tree; so `aria-controls="steps-panel"` on a tab would name an element Chrome cannot
 * see and expose nothing — dead metadata of exactly the kind this audit spent a week
 * deleting (spec §5.1's thirteen unused classes, §7's dead selectors). The house has
 * met this three times: ui-page-header.js:282 ("ONE CONSEQUENCE A CONSUMER MUST KNOW:
 * IDREFS DO NOT CROSS A SHADOW BOUNDARY"), ui-sheet-header.js:278, ui-select.js:149.
 *
 * What has changed is that an IDREF is no longer the only spelling. ARIA ELEMENT
 * REFLECTION (`element.ariaControlsElements = [panel]`) takes element references
 * rather than ids and is defined to reach across a shadow boundary in exactly one
 * direction — outwards, to a tree that is a shadow-including ancestor of the referring
 * element's, which is precisely tab-button-to-panel here. MEASURED in the rig's
 * Chrome: `'ariaControlsElements' in Element.prototype === true`, and assigning the
 * screen's panel to a button inside ui-bank's shadow root round-trips (`#syncControls`
 * below). So the association is made where the platform supports it, feature-guarded
 * rather than assumed, and nothing is written when it does not.
 *
 * The panel is still NAMED, not pointed at, in the other direction: `aria-label` from
 * the tab's own label, which resolves in the panel's own tree. ui-bank's per-item
 * `controls` field stays available for a screen that renders a bank and a panel in ONE
 * tree scope; this component never sets it.
 *
 * NO KEY HANDLER. Appendix 10 is "Roving-tabindex tablist, exactly as implemented
 * (`profile_editor.js:3590-3601`)" and it is implemented once, in ui-bank
 * (#onKeydown). Adding an ArrowUp here — or a Ctrl+Tab, or a typeahead — would be a
 * second keyboard for the same widget, which is E10's shape in another medium. The
 * rendering suite drives the arrows through CDP at this component and asserts the
 * selection, the focus, the tab stop AND the panel all moved, so the composition is
 * tested even though the code is not duplicated.
 *
 * NO SELECTION INVENTED. A `value` matching no tab selects nothing and shows no
 * panel — ui-bank's behaviour, inherited deliberately. A component that quietly
 * selects the first tab is a component taking a screen's decision, and the failure it
 * hides (a screen that forgot to set `value`) is loud this way and silent the other.
 * The cost is real and was paid on the way in: the gallery's own states had
 * `value="steps"` against a tab whose value is `Steps`, which selects nothing at all.
 * The suite now counts the selected tabs in every gallery state, because a screenshot
 * of a tablist with nothing selected looks exactly like a tablist.
 *
 * =========================================================================
 * GEOMETRY — AND WHY THE HOST TAKES ITS OWN WIDTH
 * =========================================================================
 *
 * ORACLE, all three of Slate's tablists, one number, re-read through prov_query:
 *   editor-steps / -settings / -review  `<nav class="slate-bank slate-editor-tabs"
 *       role="tablist">` [i=7] rect 430×82 in all three states, tabs
 *       `#editor-tab-0` [i=8] rect 143×80
 *   expanded-charts  `<div class="slate-bank slate-expanded-tabs" role="tablist">`
 *       [i=163] rect 720×82
 *   history-viewer / history-shotdata  `.slate-bank.slate-hv-tabs` [i=168/171] 720×82
 * CITE editor-steps #editor-tab-0 [i=8] min-height = 62px <- slate-components.css
 *      `.slate-bank-item` authored `var(--slate-control-inner)` (token-driven), inside
 *      a nav whose own min-height is 82px <- profile-editor-v3.css
 *      `.slate-editor-tabs` authored `var(--slate-control-lg)` — quoted in
 *      styles/tokens.css:65-69 as the provenance of --ui-control-lg. The 82 is a
 *      CALL-SITE height in Slate, which is why ui-bank makes --ui-control-h a floor
 *      and not a size (ui-bank.js, the :host note). This component IS that call site,
 *      so the height is stated here, once, from the token — never as 82.
 * Slate's rects are frozen 1920×1200 captures and are quoted as what Slate does, not
 * as a responsive target (prov_query's citation rule; LAYOUT_SPEC_DRAFT governs).
 *
 * WIDTH IS INTRINSIC, and both screens that host a tablist say so:
 *   §4.3 editor  "<editor-header> grid-template-columns: minmax(0,1fr) auto
 *                 minmax(0,1fr) — centre track = the tablist's own width; flanks
 *                 overflow, never shove" (Appendix 7).
 *   §4.5 history "tabs flex:0 1 auto ← pickers get room first", against bug H3:
 *                "720px of tab bank pinned flex: 0 0 in the header, so the shot
 *                pickers collapse before the tabs give up a pixel — the opposite of
 *                what the comment three lines above promises."
 * `inline-size: fit-content` is both sentences in one declaration: the tablist's own
 * width while there is room, shrinking under pressure instead of shoving, and never a
 * literal 430 or 720. `stretch` is the opt-out for a screen that wants the bank to
 * fill its box; it is geometry and touches no dial.
 *
 * "THE TABLIST'S OWN WIDTH" IS n x THE WIDEST LABEL, and getting that from
 * `fit-content` alone is what this file got WRONG for two waves — see the sizing note
 * in the style block. A bank of equal cells has to be sized as equal cells, so the one
 * instance a tab bar renders is laid out as equal COLUMNS rather than as flex items
 * that happen to be told to share.
 *
 * ONE HOUSEKEEPING TRAP, RECORDED BECAUSE IT COST THIS FILE A WHOLE RUN: a backtick
 * inside a comment INSIDE the css`` template closes the template. The first draft of
 * the style block quoted `1fr` and `fit-content` the way this header does, and the
 * module then failed to parse — in Chrome only, as "SyntaxError: Invalid or
 * unexpected token", with the component simply never defined. Comments inside the
 * tagged template below therefore quote nothing.
 */

import { css, html } from 'lit';
import { UiElement } from 'src/components/base.js';
import 'src/components/ui-bank.js';

/**
 * Everything this component writes onto a panel it does not own, and therefore
 * everything it must be able to put back. Captured on adoption, restored when the
 * panel leaves the set or the tab bar leaves the document — a component that
 * decorates someone else's element and cannot undo it is how a screen ends up with a
 * permanently `inert` region and no way to find out why.
 */
const MANAGED_ATTRIBUTES = ['role', 'tabindex', 'aria-label', 'hidden', 'inert'];

/**
 * Can a tab point at a panel across the shadow boundary? See the header's
 * `aria-controls` note. Read once, from the prototype, so a browser without ARIA
 * element reflection gets exactly the behaviour it had before — no attribute, no
 * property, no throw.
 */
const SUPPORTS_ARIA_ELEMENT_REFLECTION = typeof Element !== 'undefined'
    && 'ariaControlsElements' in Element.prototype;

/** Strings or objects in, one shape out — the same normalisation ui-bank does. */
function normaliseTab(raw, index) {
    if (raw !== null && typeof raw === 'object') {
        const value = String(raw.value ?? raw.label ?? index);
        return {
            value,
            label: String(raw.label ?? raw.value ?? ''),
            disabled: raw.disabled === true,
        };
    }
    const value = String(raw);
    return { value, label: value, disabled: false };
}

/** Duck-typed rather than `instanceof Element`: a panel may come from another realm. */
function isElement(node) {
    return Boolean(node) && typeof node.setAttribute === 'function'
        && typeof node.getAttribute === 'function';
}

export class UiTabBar extends UiElement {
    static properties = {
        /**
         * The tabs. Strings, or `{ value, label, disabled }` objects — the same
         * shape ui-bank takes, minus `controls` (see the header: an IDREF from a
         * tab in one shadow root to a panel in another tree scope resolves to
         * nothing, so this component names the panel instead of pointing at it).
         *
         * Parsed from a JSON attribute so a screen — and the gallery — can state a
         * tablist in markup. NOT a data source: a tab bar renders what it is given.
         *
         * IN THE STRING SHORTHAND THE VALUE IS THE LABEL, capital included:
         * `tabs='["Steps"]'` gives a tab the value `Steps`, and `value="steps"`
         * therefore selects nothing at all. Use the object form when a screen wants
         * ids of its own.
         */
        tabs: { type: Array },

        /** The selected tab's value. Reflected: it is the state, and tests read it. */
        value: { type: String, reflect: true },

        /**
         * The accessible name of the TABLIST. Lands on ui-bank's host, which is the
         * element carrying `role="tablist"`, so the name is on the thing it names.
         */
        label: { type: String },

        /**
         * A host-level `aria-label`, observed so a screen writing the ordinary
         * spelling still gets a named tablist — and then MOVED off the host, because
         * an `aria-label` on a role-less wrapper is the first symptom listed in bug
         * L23 ("`aria-label` on role-less `<div>`s (×3)") and Chrome exposes it
         * anyway. Same mechanism, same reason, as ui-search-field.js:208-215. A
         * screen that sets BOTH gets `label` as the name and loses the host copy;
         * two names for one tablist is the ambiguity the move exists to end.
         *
         * NOT named `ariaLabel`: that is a real property on Element and shadowing it
         * would stop `el.ariaLabel = x` reaching the platform.
         */
        hostLabel: { type: String, attribute: 'aria-label' },

        /** Paint dims and every tab refuses input. Reflected; the base dims the host. */
        disabled: { type: Boolean, reflect: true },

        /**
         * Fill the container instead of taking the tablist's own width. Off by
         * default because both screens that host a tablist ask for the intrinsic
         * width (§4.3's `auto` centre track, §4.5's `flex: 0 1 auto` against H3);
         * on for a screen that wants Slate's 720px full-bleed bank without writing
         * 720 anywhere.
         */
        stretch: { type: Boolean, reflect: true },

        /**
         * The panels, keyed by tab value: a `Map` or a plain object of
         * `value -> Element`. A property and never an attribute — an element
         * reference cannot come from markup.
         *
         * This is the hand-over for panels that are NOWHERE NEAR the tab bar, which
         * is the normal case and the editor's: `<editor-header>` holds the tablist
         * and `<editor-body>` holds all three panels (§4.3's skeleton). Panels that
         * ARE inside the tab bar can simply be slotted with `data-tab="<value>"`
         * instead, which is the Live expanded-chart shape and the one the gallery can
         * state in HTML.
         *
         * Explicit WINS over slotted; they never merge. Two sources of truth for one
         * pairing is the divergence this component exists to end, and a screen that
         * sets both has a bug that should be visible rather than averaged.
         */
        panels: { attribute: false },
    };

    static styles = [
        /* No `hitArea`: a tab's ink is --ui-control-lg (82px) tall, well clear of the
         * --ui-hit-min floor on the block axis, and on the inline axis the tabs sit
         * shoulder to shoulder inside one bank, so an overlay could only grow into a
         * neighbouring tab. The rendered box is asserted against the token in the
         * suite rather than assumed here (the same call, and the same wording, as
         * ui-bank's).
         *
         * No `selectionSurface` and no colour of any kind. Read the header: the whole
         * claim of this row is that a tab's selected look is not expressible in this
         * file. There is nothing to put here, and the suite reads the live CSSOM to
         * confirm that nothing arrived later.
         *
         * No `seams`: the divider between two tabs is ui-bank's inset shadow inside
         * one control, which CONVENTIONS §13 refuses the seam utility by name.
         *
         * NOTHING BELOW QUOTES ANYTHING. A backtick inside a comment inside this
         * template closes the template; see the header's housekeeping note. */
        css`
            /* ---------------------------------------------------------------
             * THE HOST IS A TWO-ROW GRID: the tablist, then whatever panels were
             * slotted. Both rows are content-sized while the host's own height is
             * auto (a 1fr row in an auto-height grid resolves to its content), so
             * a tab bar with no slotted panels — the editor's arrangement — is
             * exactly as tall as its bank and adds no box of its own.
             *
             * minmax(0, 1fr) on the panel row rather than auto: when a screen DOES
             * give the host a definite height, a panel that is a scroll region needs
             * a bounded track to scroll inside, and 1fr alone floors at min-content
             * and overflows instead (spec §2.4).
             * ------------------------------------------------------------- */
            :host {
                display: grid;
                grid-template-rows: auto minmax(0, 1fr);
                min-block-size: 0;

                /* THE ONE-LINE OPT-OUT, AND THE MEASUREMENT THAT FORCED IT.
                 * CONVENTIONS §2: the base puts container-type: inline-size on every
                 * host, which applies inline-size CONTAINMENT — "the host's inline
                 * size can no longer depend on its contents" — and names the fix for
                 * "a control that must shrink to fit": container-type: normal, in the
                 * component's own styles, no !important. ui-favourite-slot.js:369 and
                 * ui-slider.js:182 are the two components already taking it.
                 *
                 * A TABLIST IS THE THIRD, and §4.3 is the reason: the editor header's
                 * centre track is auto, sized by "the tablist's own width". A contained
                 * host contributes ZERO to an auto track, so the track collapses and
                 * the flanks take the whole header. MEASURED at the bench before this
                 * line existed: a three-tab bar in a 900px container rendered 2px wide
                 * — its two border hairlines and nothing else — at fit-content,
                 * max-content, min-content and inside an inline-block alike. The suite
                 * pins the width, because 2px is not a look anyone reviews twice.
                 * ------------------------------------------------------------- */
                container-type: normal;
            }

            /* ---------------------------------------------------------------
             * THE TABLIST. Height from the token whose provenance IS this element
             * (styles/tokens.css:65-69, .slate-editor-tabs authored
             * var(--slate-control-lg)); width intrinsic, per §4.3 and H3.
             *
             * fit-content = min(max-content, max(min-content, available)). Above the
             * container's width that is the tablist's own width and below it the bank
             * shrinks and ellipsises rather than pushing its neighbours out of the
             * header. One declaration, both sentences, no breakpoint to get wrong and
             * no viewport read (spec §2.1 Rule 1).
             *
             * WHAT fit-content ALONE DOES NOT BUY, MEASURED. This note used to end
             * "equal cells at the widest label, because ui-bank's items are
             * flex: 1 1 0". It is not what happens. Under a max-content constraint
             * Chrome sizes a flex row at the SUM of its items' contributions, and a
             * zero basis then hands each item the MEAN of the labels rather than the
             * max — so every label wider than the mean was ellipsised at EVERY
             * container width, under no space pressure at all. In a 900px stage: the
             * editor's three tabs took 275.688 (= 45.031 + 64.359 + 56.297 of label,
             * plus 3 x 36 padding, plus the hairlines), giving each label a 55.234 box,
             * so "Settings" (64.359) and "Review" (56.297) both rendered clipped, and
             * History's selected "Flow" (37.375 into 36.859) read as three letters and
             * an ellipsis. Invisible to every assertion in the suite, because integer
             * scrollWidth/clientWidth round 37.375 into 36.859 to 37 and 37.
             *
             * SO THE CELLS ARE COLUMNS — AND THAT NOW LIVES IN ui-bank.js.
             * grid-auto-flow: column with grid-auto-columns: 1fr states "n equal
             * cells" in the one layout mode that also SIZES that way intrinsically,
             * and for two waves those three declarations sat in the rule below, on
             * this one instance, with the containment opt-out beside them. That was
             * DQ-692's answer and DQ-692's alternative overtook it: the final review
             * found every bank in a SETTINGS ROW collapsed to 2px for want of the
             * same two lines, so ui-bank now states both for itself (ui-bank.js,
             * THE BANK SIZES ITSELF) and this file states neither. ONE MECHANISM,
             * not two — a second copy here would be the private-fix pattern that
             * ui-bank exists to end, and it would go stale the first time the
             * component's own arithmetic changed.
             *
             * What the bank does for this instance is unchanged and still measured
             * by this suite: the two banks above come out 303.078 and 148.75 with
             * every label intact, and under pressure .item's min-inline-size: 0 lets
             * a track shrink past its content, so a 200px stage still gives a 200px
             * bank with nothing overflowing and the labels ellipsising, and stretch
             * still fills the box with equal cells.
             *
             * A consumer who wants a shorter tablist sets --ui-control-lg on this
             * instance: it is a public token, it inherits, and the bank's own
             * --ui-control-inner derivation follows it. That is the supported route,
             * not a size property, because two ways to state a height is how 62px
             * came to be written by hand eighteen times.
             * ------------------------------------------------------------- */
            .tabs {
                block-size: var(--ui-control-lg);
                inline-size: fit-content;
                max-inline-size: 100%;

                /* THE EQUAL-CELL GRID AND THE CONTAINMENT OPT-OUT ARE NOT HERE.
                 * Both are ui-bank's own, on its :host, so fit-content has something
                 * to fit at every call site rather than only at this one. Restating
                 * either of them here would be a second mechanism for one behaviour;
                 * see the note above for why the pair moved. */
            }

            /* (0,3,0) against .tabs' (0,1,0) — stated rather than relying on source
             * order, so a later rule in this file cannot silently outrank it.
             * SPECIFICITY ON A HOST IS ONE STEP HIGHER than in the light DOM:
             * :host([stretch]) is (0,2,0) — the pseudo-class AND its argument — not
             * (0,1,0), so with the descendant .tabs the selector is (0,3,0). Corrected
             * from a stated (0,2,0) by finding cmodality-9; seams.js:278 has said the
             * same thing correctly all along and the two files no longer disagree in
             * print. The rule won either way; only the number was wrong, and a wrong
             * number in a comment is how the next author reasons their way into a bug. */
            :host([stretch]) .tabs {
                inline-size: 100%;
            }

            /* One cell for every slotted panel, so hidden panels do not each claim a
             * grid row of their own and the showing one is simply the block flow.
             * min-block-size: 0 keeps a scrolling panel able to shrink inside it.
             *
             * Nothing here paints a panel: its ground, padding and scrolling belong
             * to the screen that wrote it. This component only decides WHICH one is
             * showing, and says so in a way a screen reader agrees with. */
            .panels {
                min-block-size: 0;
            }

            /* ONE DIAL, PAINTED ONCE — ui-bank.js:496-505's problem, one level up and
             * solved the same way. A disabled tab bar disables the bank inside it, so
             * without this line the base dims BOTH hosts and they compound:
             * .38 x .38 = .14, a tablist nearly three times fainter than every other
             * disabled control in the skin. MEASURED before this line: the bank host
             * computed 0.38 inside a host already at 0.38. The outer host keeps the
             * dial because it is the element a screen disabled; the bank opts out.
             * The bank's own items still opt out through ui-bank's rule, which keys on
             * the BANK being disabled and so is unaffected. No !important: an
             * outer-tree rule beats an inner :host rule outright. */
            :host([disabled]) .tabs {
                opacity: 1;
            }
        `,
    ];

    /**
     * What each adopted panel looked like before this component touched it, so
     * `#release` can put it back exactly — `null` for an attribute that was absent,
     * which is a different state from an attribute that was empty.
     */
    #managed = new Map();

    /** The host `aria-label` this component has taken over; see `updated()`. */
    #adoptedLabel = null;

    /** True for exactly one update: the one where WE removed the host's aria-label. */
    #adopting = false;

    get #tabs() {
        return (Array.isArray(this.tabs) ? this.tabs : []).map(normaliseTab);
    }

    /** The tablist's accessible name, in the order a caller would expect. */
    get accessibleName() {
        return this.label || this.hostLabel || this.#adoptedLabel || '';
    }

    /**
     * A re-parented tab bar restored its panels on the way out (see
     * `disconnectedCallback`), so it has to claim them again on the way in. Lit does
     * not request an update on reconnect, and nothing else about the component
     * changed, so without this a moved tab bar would show every panel at once.
     */
    connectedCallback() {
        super.connectedCallback();
        if (this.hasUpdated) this.#syncPanels();
    }

    /**
     * PUT EVERYTHING BACK. The panels belong to the screen; a tab bar that is removed
     * and leaves three `inert` regions behind has broken a page it no longer renders,
     * and the screen has no way to know which component did it. The visible cost is
     * that a tab bar moved within the document flashes every panel for one frame —
     * paid back by `connectedCallback` above, and cheaper than the alternative.
     */
    disconnectedCallback() {
        super.disconnectedCallback?.();
        this.#dropControls();
        for (const el of [...this.#managed.keys()]) this.#release(el);
    }

    render() {
        /* One `<ui-bank>`, in the one aria spelling a tablist has. Every property
         * below is a pass-through: this component states no default that ui-bank
         * does not already state, so there is no second opinion to drift.
         *
         * `exportparts` IS THE PASS-THROUGH FOR PAINT. A part reaches one shadow
         * boundary; #3's item is two down from a screen, so without this a caller
         * styling `::part(item)` on this element would be styling nothing and would
         * never be told. Forwarding the name is the whole of it — this component still
         * declares no rule of its own about an item, which is what its header promises. */
        return html`
            <ui-bank
                id="tablist"
                class="tabs"
                exportparts="item"
                mode="tablist"
                .items=${this.#tabs}
                .value=${this.value ?? ''}
                .label=${this.accessibleName}
                ?disabled=${this.disabled}
                @change=${this.#onBankChange}
            ></ui-bank>
            <div class="panels">
                <slot @slotchange=${this.#onSlotChange}></slot>
            </div>
        `;
    }

    willUpdate(changed) {
        super.willUpdate?.(changed);
        if (!changed.has('hostLabel')) return;
        if (this.hostLabel) this.#adoptedLabel = this.hostLabel;
        else if (!this.#adopting) this.#adoptedLabel = null;
        this.#adopting = false;
    }

    updated(changed) {
        super.updated(changed);
        /* ONE NAME, ON THE TABLIST. The bank's host now carries it, so the copy left
         * on this role-less host is a second announcement of the same name on a
         * generic — bug L23's first symptom. Moved, not copied; converges in one
         * extra update because `hostLabel` going null cannot re-trigger the removal. */
        if (this.#adoptedLabel && this.hasAttribute('aria-label')) {
            this.#adopting = true;
            this.removeAttribute('aria-label');
        }
        this.#syncPanels();
        /* The bank renders on its own schedule; on the first update its buttons do not
         * exist yet, so the association is made again once they do. `#syncControls` is
         * idempotent, and the rejection arm is empty because a bank that failed to
         * render has already reported that failure through its own update. */
        this.#bank?.updateComplete?.then(() => this.#syncControls(), () => {});
    }

    /* ---- the tab -> panel pairing ------------------------------------------ */

    /**
     * `[value, element]` pairs from whichever hand-over the screen used. Explicit
     * `panels` wins outright — see the property's note on why they never merge.
     */
    #panelPairs() {
        const explicit = this.panels;
        if (explicit) {
            const raw = explicit instanceof Map
                ? [...explicit.entries()]
                : (typeof explicit === 'object' ? Object.entries(explicit) : []);
            return raw
                .filter(([, el]) => isElement(el))
                .map(([value, el]) => [String(value), el]);
        }
        const slot = this.renderRoot?.querySelector?.('slot');
        if (!slot) return [];
        return slot.assignedElements({ flatten: true })
            .filter((el) => isElement(el) && typeof el.dataset?.tab === 'string')
            .map((el) => [el.dataset.tab, el]);
    }

    /**
     * What the panel looked like before this component touched it, PLUS what this
     * component has since written — the half finding cmodality-8 found missing, and
     * the only way to tell a screen's later write apart from our own.
     */
    #capture(el) {
        const prior = {};
        for (const name of MANAGED_ATTRIBUTES) prior[name] = el.getAttribute(name);
        return { prior, mine: {} };
    }

    /**
     * Write one managed attribute and remember the value. `null` means "removed by
     * us", which is a different record from `undefined` — "never written by us, so the
     * snapshot is still the whole truth".
     */
    #write(el, record, name, value) {
        if (value === null) el.removeAttribute(name);
        else el.setAttribute(name, value);
        record.mine[name] = value;
    }

    /**
     * THE LATE WRITE — finding cmodality-8, and why a snapshot taken once was not
     * enough. `#capture` runs at adoption. A screen that writes `aria-label` on a panel
     * AFTERWARDS — an ordinary thing to do when the screen's own state changes — was
     * still recorded as having had none, so two things went wrong at once: the next
     * `#syncPanels` overruled the screen's name, against this component's own stated
     * rule that it "only ever ADDS one", and `#release` then DELETED it, on the grounds
     * that it had not been there at adoption. A component that decorates someone else's
     * element and destroys an attribute it never wrote is the same failure as leaving a
     * region permanently `inert`, one step quieter.
     *
     * The discriminator is what we last wrote. Attribute still holds our value: the
     * prior stands. Attribute holds something else: the screen has spoken since, its
     * value BECOMES the prior — restored on release, and, for the name, no longer
     * overruled. Ownership is not surrendered; `#syncPanels` still sets the role, the
     * tab stop and the visibility on the very next lines, because those are the
     * contract this component exists to hold. It just stops claiming the panel arrived
     * bare when it did not.
     */
    #reconcile(el, record) {
        for (const name of MANAGED_ATTRIBUTES) {
            const written = record.mine[name];
            if (written === undefined) continue;
            const current = el.getAttribute(name);
            if (current === written) continue;
            record.prior[name] = current;
            delete record.mine[name];
        }
    }

    #release(el) {
        const record = this.#managed.get(el);
        this.#managed.delete(el);
        if (!record) return;
        /* Reconcile on the way out too: the last write a screen made may have landed
         * after the last sync, and it is still the screen's, not ours to discard. */
        this.#reconcile(el, record);
        for (const name of MANAGED_ATTRIBUTES) {
            const value = record.prior[name];
            if (value === null) el.removeAttribute(name);
            else el.setAttribute(name, value);
        }
    }

    /**
     * Write the tabpanel contract onto the panels and take it off the ones that are
     * no longer ours. Idempotent, and called from three places on purpose: `updated`
     * (the state changed), `slotchange` (the panels changed) and `#onBankChange` (so
     * the swap is SYNCHRONOUS with the `change` event a screen is handling — a
     * consumer that reads the DOM in its own handler must not see the previous tab's
     * panel, and Lit's update is a microtask away).
     *
     * A panel keyed to a value that is not one of the tabs is left completely alone.
     * That is a typo in the screen's `data-tab`, and a panel that stays visible is a
     * findable bug; a panel this component quietly hides because it did not recognise
     * it is not.
     */
    #syncPanels() {
        const labels = new Map(this.#tabs.map((tab) => [tab.value, tab.label]));
        const seen = new Set();

        for (const [value, el] of this.#panelPairs()) {
            if (!labels.has(value)) continue;
            seen.add(el);
            if (!this.#managed.has(el)) this.#managed.set(el, this.#capture(el));
            const record = this.#managed.get(el);

            /* Before anything is written: has the SCREEN written since we last did?
             * See `#reconcile` — this is the whole of finding cmodality-8's fix, and
             * it has to run first or the write below erases the evidence. */
            this.#reconcile(el, record);

            this.#write(el, record, 'role', 'tabpanel');

            /* APG gives a tabpanel a tab stop of its own. Stated unconditionally
             * rather than only when the panel has no focusable content: these panels
             * are scroll regions (§4.3's matrix scrolls both axes, settings and each
             * review column scroll `y`), and a scroll region reachable only by mouse
             * is the bug this rewrite keeps finding. One extra Tab stop is the price. */
            this.#write(el, record, 'tabindex', '0');

            /* NAMED, NOT POINTED AT — the header's IDREF note. Only ever ADD a name:
             * a screen that wrote its own `aria-label` or an `aria-labelledby` said
             * something more specific than a tab's label, and this must not overrule
             * it (the same rule as ui-progress-track.js:372). The gate reads `prior`,
             * which `#reconcile` keeps honest whether the screen's name arrived before
             * adoption or an hour after it. */
            const label = labels.get(value);
            if (label && record.prior['aria-label'] === null && !el.hasAttribute('aria-labelledby')) {
                this.#write(el, record, 'aria-label', label);
            }

            /* `hidden` says it to the document; `inert` makes it true even where a
             * screen's own `display` rule outranks the UA's `[hidden]` — bug P13's
             * mechanism, applied to tab panels before it can happen (see the header).
             * Removed together, so the showing panel is never half-inert. */
            const active = value === this.value;
            this.#write(el, record, 'hidden', active ? null : '');
            this.#write(el, record, 'inert', active ? null : '');
        }

        for (const el of [...this.#managed.keys()]) {
            if (!seen.has(el)) this.#release(el);
        }

        this.#syncControls();
    }

    /**
     * TAB -> PANEL, BY REFERENCE — finding cmodality-12. See the header for why this is
     * a property assignment and not an `aria-controls` attribute.
     *
     * NOT a managed attribute: this is written on OUR OWN button, inside ui-bank's
     * shadow root, and never on the screen's element — so there is nothing here for
     * `#capture`/`#release` to put back, and a screen's own `aria-controls` on a panel
     * is untouched. The reference is dropped on the way out all the same, because a
     * detached tab bar holding a live pointer at a screen's panel is the same class of
     * litter as an `inert` mark left behind.
     *
     * Called from `#syncPanels` (which runs on every state change, slot change and
     * bank change) and once more from `updated()` behind the bank's own
     * `updateComplete` — on the FIRST render the bank exists but has not yet rendered
     * its buttons, and there is nothing to point with.
     */
    #syncControls() {
        if (!SUPPORTS_ARIA_ELEMENT_REFLECTION || !this.isConnected) return;
        const buttons = this.#bank?.renderRoot?.querySelectorAll?.('button');
        if (!buttons?.length) return;

        const panels = new Map(this.#panelPairs());
        this.#tabs.forEach((tab, index) => {
            const button = buttons[index];
            if (!button) return;
            const panel = panels.get(tab.value);
            button.ariaControlsElements = panel ? [panel] : null;
        });
    }

    /** Every reference this component made, dropped. */
    #dropControls() {
        if (!SUPPORTS_ARIA_ELEMENT_REFLECTION) return;
        for (const button of this.#bank?.renderRoot?.querySelectorAll?.('button') ?? []) {
            button.ariaControlsElements = null;
        }
    }

    /** The one ui-bank this component renders. */
    get #bank() {
        return this.renderRoot?.querySelector?.('#tablist') ?? null;
    }

    /* ---- events ------------------------------------------------------------ */

    #onSlotChange() {
        this.#syncPanels();
    }

    /**
     * The bank's `change` is `composed: true` and is already on its way out through
     * this host, with its target retargeted to `<ui-tab-bar>` — so a consumer's
     * listener fires exactly once, with `detail.value` and `detail.index` unchanged.
     * Re-dispatching would deliver it twice: the trap ui-text-field's comment records
     * and ui-search-field.js:429 avoids the same way.
     *
     * `value` is assigned synchronously, before the event finishes propagating, so a
     * handler on the host reads the new value; `#syncPanels` runs in the same breath
     * so it reads the new DOM as well.
     */
    #onBankChange(event) {
        const next = event.detail?.value;
        if (next === undefined || next === this.value) return;
        this.value = next;
        this.#syncPanels();
    }
}

customElements.define('ui-tab-bar', UiTabBar);
