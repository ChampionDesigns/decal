/**
 * ui-button.js - component #1 of the 57-component inventory: THE ONE PRESS CONTROL.
 *
 * Wave 1, item #1 (SCOPE Part 4, "Wave 1 - primitives"). Token-only: no data layer,
 * no ReaPrime, no endpoint. Ranges, labels and handlers all arrive from outside.
 *
 * WHY IT EXISTS AS A COMPONENT AT ALL
 *   spec §5.1 #1: "Button (+ primary / tall / ghost / danger), slate-components.css:147,
 *   175, 249 - 135 uses. Overlays re-implement it FOUR times to dodge a constraint that
 *   does not exist: .slate-btn is a plain global class, and slate-shell.css has *no*
 *   #subpage-host .slate-btn geometry rule (layout/overlays.md §2.3, B)."
 *
 * THE BUG THIS COMPONENT RETIRES - P8 (spec §7.3)
 *   "#confirm-profile-btn - the one affirmative action on the screen - has **no primary
 *   treatment**; measured transparent, identical to Cancel beside it. The comment above
 *   the rule states the intent the rule defeats." (slate-shell.css:158-172 vs
 *   slate-components.css:175-179)
 *
 *   ORACLE, the defect itself, quoted:
 *     state=profile-selector element=#confirm-profile-btn [i=5] property=background-color
 *     value=rgba(0, 0, 0, 0) winning rule=slate-shell.css
 *     {#subpage-host #subpage-header button:not(#fullscreen-toggle-btn),
 *      #subpage-host #subpage-header a} authored `transparent` !important=no
 *     (FROZEN/hardcoded)
 *
 *   A SCREEN SHEET reached a component and flattened its fill. The mechanism that kills
 *   it here is not a stronger selector - it is the shadow boundary: the paint lives on
 *   .btn inside this root, where no screen rule can name it. Asserted, not assumed, in
 *   test/render/ui-button.render.test.mjs ("P8 cannot express").
 *
 * MEASURED STARTING VALUES - every one is an oracle answer, quoted verbatim.
 * (prov_query.py against slate-audit-2026-08-16/prov-baseline, dark, and prov-light.)
 *
 *   DEFAULT (.slate-btn), the "Start over" button on the load-cell wizard:
 *     settings-calibration-load-cells .slate-btn [i=55] background-color = rgba(0, 0, 0, 0)
 *       <- slate-components.css `.slate-btn` authored `transparent` !important=no
 *     settings-calibration-load-cells .slate-btn [i=55] color = rgb(186, 196, 202)
 *       <- slate-components.css `.slate-btn` authored `var(--slate-text-2)` (token-driven)
 *       [prov-light: rgb(63, 71, 76) - both are --ui-text-2's two theme values]
 *     settings-calibration-load-cells .slate-btn [i=55] min-height = 64px
 *       <- slate-shell.css `#subpage-host #settings-content-area :is(button, ...)`
 *          authored `64px`; the COMPONENT's own rule is
 *       settings-maintenance-machine-descaling .slate-btn [i=43] min-height = 64px
 *       <- slate-components.css `.slate-btn` authored `var(--slate-control-height)`
 *     settings-maintenance-machine-descaling .slate-btn [i=43] font-size = 17px
 *       <- slate-components.css `.slate-btn` authored `var(--slate-text-base)`
 *     settings-maintenance-machine-descaling .slate-btn [i=43] font-weight = 500
 *       <- slate-components.css `.slate-btn` authored `var(--slate-weight-medium)`
 *     settings-maintenance-machine-descaling .slate-btn [i=43] border-top-left-radius = 6px
 *       <- slate-components.css `.slate-btn` (set via the border-radius shorthand)
 *     settings-calibration-load-cells .slate-btn [i=55] border-top-color = rgb(58, 72, 82)
 *       <- (shorthand) = --ui-line dark; prov-light rgb(203, 208, 211) = --ui-line light
 *     settings-calibration-load-cells .slate-btn [i=55] padding-left = 24px
 *       <- slate-components.css `.slate-btn` (set via the padding shorthand) = --ui-space-5
 *     settings-calibration-load-cells .slate-btn [i=55] box-shadow = none
 *
 *   PRIMARY (.slate-btn-primary), the load-cell "Zero" button:
 *     settings-calibration-load-cells .slate-btn [i=54] background-color = rgb(23, 59, 77)
 *       <- slate-components.css `.slate-btn-primary` (shorthand) (token-driven)
 *       = #173b4d = --ui-primary dark; prov-light rgb(35, 79, 99) = #234f63 = --ui-primary light
 *     settings-calibration-load-cells .slate-btn [i=54] color = rgb(246, 251, 253)
 *       <- slate-components.css `.slate-btn-primary` authored `var(--slate-on-primary)`
 *
 *   DANGER (.slate-btn-danger), the sleep-schedule "Delete":
 *     settings-machine-sleep---wake-schedules .slate-btn [i=72] background-color =
 *       color(srgb 0.901961 0.4 0.380392 / 0.14) <- slate-components.css `.slate-btn-danger`
 *     settings-machine-sleep---wake-schedules .slate-btn [i=72] color = rgb(230, 102, 97)
 *       <- slate-components.css `.slate-btn-danger` authored `var(--slate-danger)`
 *
 *   GHOST (.slate-btn-ghost), the descaling instructions link:
 *     settings-maintenance-machine-descaling .slate-btn [i=43] background-color = rgba(0, 0, 0, 0)
 *       <- slate-components.css `.slate-btn-ghost` authored `transparent`
 *     settings-maintenance-machine-descaling .slate-btn [i=43] border-top-color = rgba(0, 0, 0, 0)
 *       <- slate-components.css `.slate-btn-ghost` authored `transparent`
 *
 *   TALL (.slate-btn-tall), the settings header "Close":
 *     settings-machine-water-tank #save-settings-btn [i=4] min-height = 82px
 *       <- slate-shell.css authored `var(--slate-control-lg)` (token-driven)
 *     and slate-components.css `.slate-btn-tall { min-height: var(--slate-control-lg) }`.
 *
 * The two mixes are Slate's own arithmetic, carried unchanged from
 * slate-components.css:175-179 and :208-212, with the token names re-prefixed:
 *     .slate-btn-primary { border-color: color-mix(in srgb, var(--slate-primary) 72%, var(--slate-steel)) }
 *     .slate-btn-danger  { border-color: color-mix(in srgb, var(--slate-danger) 72%, var(--slate-line));
 *                          background: color-mix(in srgb, var(--slate-danger) 14%, transparent) }
 *
 * DELIBERATE DEPARTURES, each recorded in the wave-1 ledger
 * (_skinlab/realine-run/EXPECTED_CHANGES.jsonl, region ui-button; source
 * _skinlab/realine-run/waves/1/ledger-src/) - a ledger that exists on disk and can be
 * checked, not a "manifest" no file corresponds to:
 *   1. P8 - primary paints. See above.
 *   2. DISABLED is ONE dial. Slate re-paints a disabled button (transparent face,
 *      --slate-muted ink, slate-components.css:157-167); spec §3.7 settles a single
 *      --ui-opacity-disabled at .38 against Slate's three live values, and the base
 *      element already applies it to the host. So a disabled PRIMARY here stays navy at
 *      .38 rather than becoming a transparent outline. Paint only - the inner control
 *      carries the native `disabled` attribute, which is what refuses the press.
 *   3. The button WRAPS rather than overflowing its container. Slate's geometry is
 *      frozen at 1920x1200 and the oracle has no vote on responsive behaviour
 *      (Part 10 §4 disqualification check); spec §2.2 governs, and a control that
 *      shrinks with the window is banned only for its HEIGHT ("ergonomics is physical").
 *   4. `gap: var(--ui-space-2)` between slotted children. The oracle reads
 *      settings-calibration-load-cells .slate-btn [i=55] gap = normal <- (no declaration),
 *      i.e. Slate never declared one, so a leading glyph touches its label. Invisible
 *      with a single text child.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   - NO selection treatment. `aria-pressed` paint belongs to component #3, the
 *     segmented bank (spec §5.1 #3, "the one component with a real state model").
 *     CONVENTIONS §4: the four dials "only mean anything because there is ONE selection
 *     component". Adding a second is the decay the rewrite exists to stop.
 *   - NO `type="submit"`. A submit button inside a shadow root does not submit an outer
 *     form; form participation is item #6's `formAssociated` problem (DECISIONS.md:196).
 *   - NO `part()` theming surface. Theming crosses the boundary through custom
 *     properties only (Part 4 ground rule 1; A6).
 *
 * API
 *   <ui-button>Start over</ui-button>
 *   <ui-button variant="primary">Zero</ui-button>
 *   <ui-button variant="ghost">Descaling instructions</ui-button>
 *   <ui-button variant="danger">Delete</ui-button>
 *   <ui-button tall variant="primary">Save</ui-button>
 *   <ui-button disabled>Save</ui-button>
 *   <ui-button label="Close">x</ui-button>          <- accessible name for a glyph slot
 *   <ui-button focus-ring="inset">...</ui-button>   <- base attribute, for a clipping band
 *
 *   `click` needs no plumbing: the inner button's event composes and retargets to the
 *   host, so <ui-button @click=...> is the whole contract. A disabled button fires none.
 *
 *   `focus()` DOES need plumbing, and it is here: it goes inward to the real <button>,
 *   so a dialog or a header can put focus on its affirmative action with
 *   `panel.querySelector('ui-button[variant="primary"]').focus()` - P8's own screen.
 *   Forwarded, NOT `delegatesFocus`: CONVENTIONS §11 says delegatesFocus as a default
 *   "produces two rings on one control", and it would here, because the base rings
 *   :host(:focus-visible) as well as every focusable inside the root. `blur()` is its
 *   pair, and `control` is the element both of them act on.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';

/** The four the spec names. Anything else falls back to `default` rather than blanking
 *  the control - the same choice base.js makes for an unrecognised focus-ring value. */
export const BUTTON_VARIANTS = Object.freeze(['default', 'primary', 'ghost', 'danger']);

export class UiButton extends UiElement {
    static properties = {
        /** 'default' | 'primary' | 'ghost' | 'danger'. */
        variant: { type: String, reflect: true },
        /** Header height - --ui-control-lg instead of --ui-control-h. Orthogonal to
         *  `variant`, exactly as .slate-btn-tall is orthogonal to .slate-btn-danger. */
        tall: { type: Boolean, reflect: true },
        /**
         * NO BOX OF ITS OWN — the control is exactly its label, and the caller supplies
         * the hit area from outside.
         *
         * ADDED FOR THE LIVE RAIL'S STOP-CONDITION CAPTION, which is a real toggle in
         * Slate (`#steam-mode-toggle`, `#hot-water-mode-toggle` — `role="button"` spans
         * with click handlers) and had been rebuilt here as inert text, because the two
         * library controls that fit were a 62px bank cell and a 44px button and the row
         * is a 14px caption line. `bare` is the third size, and it exists so that a
         * screen never has to reach into this shadow root or rebind a public token to
         * get one (both refused: P8, and gate C's private-palette rule).
         *
         * IT IS THE OPPOSITE OF `tall` AND SHARES ITS SHAPE: orthogonal to `variant`,
         * reflected, and it changes ONLY the box. Focus ring, disabled refusal,
         * accessible name and paint are all still the button's.
         */
        bare: { type: Boolean, reflect: true },
        /** Paint AND refusal: the base dims the host, the inner control refuses. */
        disabled: { type: Boolean, reflect: true },
        /** Accessible name, for a slot that holds a glyph rather than words. */
        label: { type: String },
    };

    static styles = [css`
        /* CONTAINER-HOSTING OPT-OUT, the one-liner CONVENTIONS §2 documents. The base
         * puts container-type: inline-size on every host, which is right for anything
         * filling a slot and wrong for "a control that must shrink to fit its glyph".
         * A button is sized by its label. No rule in this file is size-keyed, so there
         * is nothing to query; a screen that needs a full-width button sets
         * ui-button { display: block } from outside, which wins over :host by the
         * shadow-host precedence rule with no !important anywhere. */
        :host {
            container-type: normal;
            display: inline-grid;

        }

        /* RESTING PAINT ON A CLASS, NEVER AN ID (CONVENTIONS §4 rule 2) - and never on
         * :host either, which is the half P8 turns on: a screen sheet CAN name the host
         * from outside, and cannot name anything in here. */
        .btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--ui-space-2);
            min-block-size: var(--ui-control-h);

            /* AND IT MAY SHRINK BELOW ITS OWN PADDING, which a grid item does NOT do by
             * default: min-inline-size auto on a grid item is its MIN-CONTENT, and for
             * this button that is 24 + 24 of padding plus whatever is in it. Measured at
             * 74px for a 24px icon.
             *
             * WHAT THAT COST, and it was visible. #42's five-key rank divides the width it
             * is given between five of these — Ben, 25 August 2026: "make all the controls
             * 350px wide? This should get it pixel perfect width" — so at 350 a key's track
             * is 68.8. A button that cannot go below 74 overflowed its track by 5px, and
             * the rank's own overflow: hidden CUT it: five keys silently trimmed on the
             * right, with no scrollbar and nothing to see but a slightly wrong glyph.
             *
             * ZERO, NOT A SMALLER FLOOR. The floor a control needs is ergonomic and it is
             * stated where it belongs — --ui-control-h here for the block axis, and the
             * rank's own five-key floor for the inline one. What this line removes is an
             * INLINE minimum nobody chose: the CONTENT's min-content, dragged in by
             * min-inline-size auto on a grid item. Contents centre in whatever box they
             * get; a label too long for its box still overflows where a reader can see it,
             * which is unchanged.
             *
             * IT DOES NOT MAKE THE BUTTON ARBITRARILY NARROW, AND IT CANNOT. box-sizing is
             * border-box, so the used width can never fall below the padding plus the
             * enclosure — 24 + 24 + 2 = 50px — whatever any minimum says. That is the real
             * floor of a key, and it is why #42's rank floors its tracks at
             * --ui-control-h (64) rather than at --ui-hit-min (48): a 48px track cannot
             * hold this button at all, and asking it to is how the rank got clipped. */
            min-inline-size: 0;

            padding-inline: var(--ui-space-5);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            background-color: transparent;
            color: var(--ui-text-2);
            /* The UA sheet sets font-family/-size on <button> and there is no Tailwind
             * preflight inside a shadow root to undo it, so both must be stated. Plain
             * inherit rather than var(--ui-font-family): the family already crosses the boundary
             * from styles/document.css, and restating the token would break a screen's
             * ability to set a family locally (CONVENTIONS §11). */
            font-family: inherit;
            font-size: var(--ui-text-base);
            font-weight: var(--ui-weight-medium);
            /* SOURCE (read-only, outside the oracle's 18-property surface): Tailwind
             * preflight in app.css gives every Slate button cursor: pointer. */
            cursor: pointer;
            box-shadow: none;
        }

        :host([tall]) .btn {
            min-block-size: var(--ui-control-lg);
        }

        /* BARE: the label and nothing else. Line-height still comes from the type, so
         * the control keeps a hit area as tall as its own text rather than collapsing
         * to zero, and a caller that wants more states its own padding on the host. */
        :host([bare]) .btn {
            min-block-size: 0;
            padding-inline: 0;
            /* AND NO BORDER BOX. The resting border is transparent in every variant a
             * bare button would use, but its WIDTH is still two hairlines of height —
             * measured at 4px on a 14px line, which is a third again as tall as the
             * caption it replaced. A control that is exactly its label has no border to
             * be transparent. */
            border-width: 0;
            /* The UA sheet's own padding of 1px 6px on a button: the inline half is
             * covered above, and the block half is two more pixels of row. */
            padding-block: 0;
            font-size: inherit;
            font-weight: inherit;
            line-height: inherit;
            letter-spacing: inherit;
            text-transform: inherit;
        }

        :host([variant="primary"]) .btn {
            border-color: color-mix(in srgb, var(--ui-primary) 72%, var(--ui-steel));
            background-color: var(--ui-primary);
            color: var(--ui-on-primary);
        }

        :host([variant="ghost"]) .btn {
            border-color: transparent;
            background-color: transparent;
        }

        :host([variant="danger"]) .btn {
            border-color: color-mix(in srgb, var(--ui-status-danger) 72%, var(--ui-line));
            background-color: color-mix(in srgb, var(--ui-status-danger) 14%, transparent);
            color: var(--ui-status-danger);
        }

        /* THE DIAL IS APPLIED ONCE. The base paints BOTH spellings of disabled - the
         * host attribute (the ordinary Lit spelling) and [disabled] anywhere in the
         * shadow tree - and this control legitimately carries both, because the host
         * attribute is the paint and the native attribute on the real <button> is the
         * refusal. Without this line the two multiply and .38 x .38 renders at .14:
         * a control three times fainter than the one dial says. Bare (0,1,1) beats the
         * base rule's :where() (0,0,0); no !important (CONVENTIONS §6). */
        .btn[disabled] {
            opacity: 1;
            cursor: default;
        }
    `];

    constructor() {
        super();
        this.variant = 'default';
        this.tall = false;
        this.bare = false;
        this.disabled = false;
        this.label = '';
    }

    /** The inner control - what focus, the press and the native `disabled` belong to. */
    get control() {
        return this.renderRoot?.querySelector?.('button') ?? null;
    }

    /**
     * Focus goes INWARD, without `delegatesFocus`. A host with neither is not focusable
     * at all, so `document.querySelector('ui-button').focus()` was a silent no-op - and
     * that call IS the API a dialog or a header uses to put focus on Confirm (spec §7.3
     * P8's screen). The same three lines ui-select, ui-text-field and ui-icon-button
     * already carry; CONVENTIONS §11 is why it is per component and not in the base.
     * `super.focus()` before the first render, so an early call is not swallowed.
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

    /** Normalise before paint, so `variant="Primary"` and `variant="nope"` are a
     *  documented fallback rather than an unstyled control. */
    willUpdate(changed) {
        if (changed.has('variant')) {
            const raw = String(this.variant ?? '').trim().toLowerCase();
            const next = BUTTON_VARIANTS.includes(raw) ? raw : 'default';
            if (next !== this.variant) this.variant = next;
        }
    }

    render() {
        return html`<button
            id="btn"
            class="btn"
            type="button"
            ?disabled=${this.disabled}
            aria-label=${this.label ? this.label : nothing}
        ><slot></slot></button>`;
    }
}

customElements.define('ui-button', UiButton);
