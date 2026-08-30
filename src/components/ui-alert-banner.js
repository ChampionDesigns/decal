/**
 * ui-alert-banner.js - component #49 of the 57-component inventory: THE ALERT BANNER.
 *
 * Wave 1, item #49 (SCOPE Part 4, "Wave 1 - primitives"; SCOPE.md:1530). Token-only:
 * no data layer, no ReaPrime, no endpoint, no state vocabulary. It is handed a
 * message and it renders it.
 *
 * WHAT THE ROW SAYS, verbatim (SCOPE.md:1530)
 *   "Alert banner | In-flow warning strip on Live. Also the surface where a profile
 *    refusal lands once ReaPrime can report one (B9 / R7) - build it to take a
 *    message, not to know the message. | small | tokens"
 *   spec §5.2 #49: "Alert banner | slate-live.css:2028-2038 |"
 *
 * THE REFUSAL SURFACE IS NOT WIRED HERE, and that is the wave law, not an omission.
 *   SCOPE.md:1861-1865 owns the wiring and states the split: "v1 builds the refusal
 *   surface and wires it to every refusal ReaPrime can already report - the arm-time
 *   400 (Unsupported profile) exists today and needs zero upstream work; the alert
 *   banner (#49) takes a message, it does not know the message. When R7 lands, the
 *   same surface carries the machine-side refusal." R7's fact-finding is M13
 *   (SCOPE.md:5174). Part 5 §1 is the consumer; this file has no idea any of that
 *   exists, which is exactly what lets the same element carry both refusals.
 *
 * MEASURED STARTING VALUES - every one is an oracle answer, quoted verbatim.
 * (prov_query.py against slate-audit-2026-08-16/prov-baseline, dark, and prov-light.)
 *
 *   prov_query.py find --cls slate-live-alert
 *     found 3 element(s) in 3 state(s) - history-shotdata, live-pulling, modal-numpad
 *     distinct geometries (w x h), all matched elements:  1375 x 130  x3
 *     <div id="live-alert" class="slate-live-alert" role="alert">
 *     text "Disconnected Check the machine is powere"  rect x=488 y=168 w=1375 h=130
 *
 *   CITE live-pulling #live-alert [i=92] background-color = rgb(14, 19, 23)
 *     <- slate-live.css `#main-page .slate-live-alert` authored
 *        `(NOT CAPTURED - set via a CSS shorthand)` !important=no (token-driven)
 *        -> the shorthand is slate-live.css:2037 `background: var(--slate-fascia)`,
 *           read read-only under the tool's own shorthand carve-out.
 *           --ui-fascia is #0e1317 dark = rgb(14, 19, 23) and #f2f3f3 light
 *           = rgb(242, 243, 243), both exact (styles/tokens.css:720, :841).
 *   CITE live-pulling #live-alert [i=92] gap = 4px
 *     <- slate-live.css `#main-page .slate-live-alert` authored `var(--slate-space-1)`
 *        !important=no (token-driven)                    -> --ui-space-1, 4px
 *   CITE live-pulling #live-alert [i=92] padding-left = 28px
 *     <- slate-live.css `#main-page .slate-live-alert` authored
 *        `(NOT CAPTURED - set via a CSS shorthand)` !important=no (token-driven)
 *        -> the shorthand is slate-live.css:2036 `padding: 0 var(--slate-space-6)`
 *           -> --ui-space-6, 28px. See DEPARTURE 2 for the block half.
 *   CITE live-pulling #live-alert [i=92] color = rgb(244, 247, 248)
 *     <- (no declaration - inherited or initial value)  ... so this file declares none.
 *   CITE live-pulling #live-alert [i=92] box-shadow = none, border-top-width = 0px,
 *        border-top-left-radius = 0px, opacity = 1, letter-spacing = normal,
 *        text-transform = none, background-image = none, min-height = 0px
 *     <- themes table, identical dark and light. A STRIP, not a card: no edge, no
 *        radius, no elevation. Inventing any of them would be inventing a design.
 *
 *   CITE live-pulling #live-alert-state [i=93] font-size = 52px
 *     <- slate-live.css `#main-page .slate-live-alert strong` authored
 *        `var(--slate-display-xl)` !important=no (token-driven) -> --ui-display-xl
 *   CITE live-pulling #live-alert-state [i=93] color = rgb(230, 102, 97)
 *     <- slate-live.css `#main-page .slate-live-alert strong` authored
 *        `var(--slate-danger)` !important=no (token-driven)     -> --ui-status-danger
 *        themes: dark rgb(230, 102, 97) / light rgb(181, 28, 35) - and styles/tokens.css
 *        cites THIS ELEMENT as the source for --ui-status-danger (#e66661 / #b51c23).
 *   CITE live-pulling #live-alert-state [i=93] font-weight = 500
 *     <- slate-live.css `#main-page .slate-live-alert strong` authored
 *        `var(--slate-weight-medium)` !important=no (token-driven) -> --ui-weight-medium
 *   CITE live-pulling #live-alert-state [i=93] height = 54.5938px (themes table,
 *        identical in both) - 54.5938 / 52 = 1.0499, which is the authored
 *        line-height: 1.05 at slate-live.css:2046 measuring itself. line-height is
 *        outside the 18-property probe (carve-out), so the number is a source read
 *        and the height is its confirmation.
 *
 *   CITE live-pulling #live-alert-remedy [i=94] font-size = 20px
 *     <- slate-live.css `#main-page .slate-live-alert span` authored
 *        `var(--slate-text-lg)` !important=no (token-driven)   -> --ui-text-lg, 20px
 *   CITE live-pulling #live-alert-remedy [i=94] color = rgb(186, 196, 202)
 *     <- slate-live.css `#main-page .slate-live-alert span` authored
 *        `var(--slate-text-2)` !important=no (token-driven)    -> --ui-text-2
 *        themes: dark rgb(186, 196, 202) / light rgb(63, 71, 76) = #bac4ca / #3f474c.
 *   CITE live-pulling #live-alert-remedy [i=94] font-weight = 400
 *     <- (no declaration - inherited or initial value)  ... so this file declares none.
 *
 * THE ORACLE IS DISQUALIFIED FOR TWO QUESTIONS, and both are settled above it.
 *
 *   1. WHERE THE BANNER SITS. Slate's is an overlay: slate-live.css:2029-2031
 *      `position: absolute; inset: 0; z-index: 5`, covering the display header band -
 *      which is why its rendered box is exactly the band, 1375 x 130. Placement is
 *      also outside the probe by construction ("margins, flex/grid placement,
 *      z-index, transforms were never probed"). The rewrite decides it twice, the
 *      same way:
 *        SCOPE.md:1530 - "In-flow warning strip on Live."
 *        LAYOUT_SPEC_DRAFT.md:520 §4.1 - "Skeleton. One grid. No absolutely-positioned
 *          structure." (and :541, the GHC strip: "auto, IN FLOW.")
 *      So this file sets NO position, NO inset and NO z-index. The screen places the
 *      host; the component fills whatever box it is given. Both placements stay
 *      available - a screen that writes `position: absolute; inset: 0` on the host
 *      still gets Slate's exact overlay, because the banner carries
 *      min-block-size: 100% and centres its content. DEPARTURE 1.
 *
 *   2. RESPONSIVE BEHAVIOUR. No Slate answer exists (98.4% frozen). The 52px headline
 *      is --ui-display-xl = clamp(38px, 4.2cqi, 52px), read against THIS COMPONENT'S
 *      OWN CONTAINER (the base puts container-type: inline-size on every host). At
 *      Slate's frozen 1375px the clamp returns 4.2cqi = 57.75px -> 52px, reproducing
 *      the oracle exactly; narrower it shrinks to a 38px floor. That is the spec's own
 *      order of surrender, LAYOUT_SPEC_DRAFT.md:551: "Display type shrinks via its
 *      clamp() (§3.5)." This is why the container-hosting opt-out of CONVENTIONS §2 is
 *      deliberately NOT taken here: cqi has to resolve against the banner.
 *
 * DELIBERATE DEPARTURES, each recorded in the wave-1 ledger
 * (_skinlab/realine-run/EXPECTED_CHANGES.jsonl, region ui-alert-banner; source
 * _skinlab/realine-run/waves/1/ledger-src/) - a ledger that exists on disk and can be
 * checked, not a "manifest" no file corresponds to. Each is ALSO asserted as a
 * departure in test/render/ui-alert-banner.render.test.mjs, which is the copy a gate
 * can run rather than read:
 *   1. IN FLOW, NOT AN OVERLAY - see disqualification 1 above. Visible: Slate's banner
 *      hides the gauges it covers; this one is a strip the screen lays out.
 *   2. BLOCK PADDING EXISTS. Slate authors `padding: 0 var(--slate-space-6)` - the
 *      block inset is zero because inset:0 stretched the box to 130px and
 *      justify-content: center did the rest. Measured, that centring leaves 21px above
 *      and below (host y=168 h=130; headline y=189 h=54.59; remedy y=247 h=30, so
 *      168->189 = 21 and 298->277 = 21). In flow there is nothing to stretch, so the
 *      inset has to be authored. 21px sits exactly between --ui-space-4 (18) and
 *      --ui-space-5 (24); the tie goes to the smaller, because Slate authored ZERO and
 *      anything at all is already an addition. One token reference reverses it.
 *   3. AN EMPTY PART COLLAPSES. Slate's two children always exist and are written by
 *      id (ui.js:3534-3535), so an alert with no remedy still spends the 4px gap. Here
 *      each part is present only when something is slotted into it, which is what lets
 *      a one-line refusal ("Profile refused") look deliberate rather than truncated.
 *      Emptiness is recomputed on TEXT change as well as on assignment change - see
 *      #syncParts; a strip that only listened to slotchange stayed collapsed forever
 *      when its message arrived after mount, which is how every live alert arrives.
 *   4. role="alert" IS SET BY THE COMPONENT, not by the call site. Slate carries it in
 *      markup (index.html:271, `<div id="live-alert" class="slate-live-alert"
 *      role="alert" hidden>`) - correct, and one hand-written attribute away from
 *      being forgotten at the next call site. Set only if the author has not chosen a
 *      role, exactly as ui-status-chip does with role="status".
 *   5. NO !important ANYWHERE, INCLUDING FOR `hidden`. Slate needs
 *      slate-live.css:2040 `#main-page .slate-live-alert[hidden] { display: none
 *      !important }` because its own `display: flex` at (1,1,0) outranks the UA's
 *      [hidden] rule. Here the flex lives on an element INSIDE the shadow root and
 *      :host([hidden]) { display: none } is in the base, so <ui-alert-banner hidden>
 *      hides with an ordinary rule (CONVENTIONS §6). The test asserts the rendered
 *      consequence, not the absence of a keyword.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   - NO SEVERITY / TONE VARIANTS. The oracle measures ONE treatment, and Slate's
 *     three alert kinds (ui.js:3514-3518 - disconnected, error, needsWater) all paint
 *     identically. A second look invented here is the decay the rewrite exists to
 *     stop, and #12 Badge already owns the small coloured marker. There is no 17th
 *     item.
 *   - NO MESSAGE TABLE. This component does not know what "disconnected" means, does
 *     not map a machine state to words, and does not own a range. Ranges and limits
 *     arrive from outside; a primitive that needs server data is a design error to
 *     flag, not to satisfy (Part 10 §12).
 *   - NO DISMISS CONTROL, NO ACTION SLOT. Slate's banner clears when the condition
 *     clears and carries no affordance; adding one would be designing the refusal
 *     interaction here instead of in Part 5 §1, which owns it.
 *   - NO SELECTION TREATMENT and NO HIT AREA. Nothing here is selectable or pressable;
 *     the row cites neither Appendix 5 nor a hit floor. A 48px box around a warning
 *     strip is a target nobody presses.
 *   - NO position / z-index. See disqualification 1. --ui-z-overlay exists for the
 *     screen that wants Slate's stacking back.
 *
 * API
 *   <ui-alert-banner>
 *       Disconnected
 *       <span slot="remedy">Check the machine is powered on and paired.</span>
 *   </ui-alert-banner>
 *
 *   <ui-alert-banner>Profile refused</ui-alert-banner>        <- remedy collapses
 *   <ui-alert-banner hidden>...</ui-alert-banner>             <- gone, no !important
 *   <ui-alert-banner role="status">...</ui-alert-banner>      <- author keeps the role
 *
 *   Internal knob (--_ui-, not a token, not an API surface): --_ui-headline-leading.
 */

import { css, html } from 'lit';
import { UiElement } from 'src/components/base.js';

export class UiAlertBanner extends UiElement {
    static properties = {
        /* Whether anything is slotted into each part. Internal reactive state, not an
         * API: the consumer says what it has by slotting it, never by setting a flag. */
        _hasHeadline: { state: true },
        _hasRemedy: { state: true },
    };

    static styles = [css`
        :host {
            /* NO container-type OPT-OUT ON PURPOSE. --ui-display-xl is
             * clamp(38px, 4.2cqi, 52px) and cqi resolves against the nearest query
             * container, which the base makes this host. Switching to
             * container-type: normal here would silently hand the headline to some
             * ancestor's width - or to the initial containing block - and the
             * measured 52px at 1375px would stop being reproducible.
             *
             * NO position, NO inset, NO z-index: placement belongs to the screen
             * (see disqualification 1 in the header block). */

            /* THE HEADLINE'S LEADING, private (CONVENTIONS §7). slate-live.css:2046
             * authors line-height: 1.05 and the oracle confirms it as a height:
             * 54.5938px at font-size 52px = 1.0499. There is no leading token to read
             * - the type family carries sizes, weights and tracking, not leading - so
             * this is a source read parked in the private slot rather than a bare
             * number in a rule. It may never carry a colour. */
            --_ui-headline-leading: 1.05;
        }

        /* RESTING PAINT ON A CLASS, NEVER AN ID (CONVENTIONS §4 rule 2), and never on
         * :host - the styled node is the rendered node, which is the half of L13 that
         * generalises past the status chip.
         *
         * ORACLE, live-pulling #live-alert [i=92], quoted in the header block:
         *   background-color = rgb(14, 19, 23)  <- shorthand background:
         *                                          var(--slate-fascia)    -> --ui-fascia
         *   gap = 4px                           <- authored var(--slate-space-1)
         *   padding-left = 28px                 <- shorthand padding: 0
         *                                          var(--slate-space-6)   -> --ui-space-6
         *   box-shadow = none, border-top-width = 0px, border-top-left-radius = 0px
         *                                       <- themes table, both themes
         *
         * background-color, not the background shorthand: the shorthand resets
         * background-clip, which is the documented 32px-slab trap (CONVENTIONS §5,
         * quoting slate-live.css:1565-1567). Nothing here clips a background today,
         * and the habit is the point.
         *
         * min-block-size: 100% is what keeps Slate's overlay reachable from outside.
         * Against an in-flow host it resolves to nothing (percentage on an indefinite
         * containing block); against a host a screen has stretched with inset: 0 it
         * fills the box and justify-content: center reproduces the measured 21px of
         * air above and below. One rule, both placements. */
        .banner {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: var(--ui-space-1);
            min-inline-size: 0;
            min-block-size: 100%;
            /* DEPARTURE 2 - the block half is authored here, the inline half is the
             * oracle's 28px. */
            padding-block: var(--ui-space-4);
            padding-inline: var(--ui-space-6);
            background-color: var(--ui-fascia);
        }

        /* ORACLE, live-pulling #live-alert-state [i=93]:
         *   font-size = 52px    <- authored var(--slate-display-xl) -> --ui-display-xl
         *   color = rgb(230, 102, 97) dark / rgb(181, 28, 35) light
         *                       <- authored var(--slate-danger)     -> --ui-status-danger
         *   font-weight = 500   <- authored var(--slate-weight-medium)
         *                                                           -> --ui-weight-medium
         * The font-weight declaration is load-bearing twice over: it is the oracle's
         * value AND it stops the UA stylesheet's bolder on <strong> leaking in.
         *
         * overflow-wrap: anywhere - responsive behaviour, which the oracle does not
         * get a vote on. A 52px word in a container narrower than itself either wraps
         * or leaves the box; §2.4 makes silent clipping the inherited default the
         * rewrite exists to stop, and an alert that overflows its own strip is a
         * worse failure than an alert that wraps. */
        .headline {
            display: block;
            min-inline-size: 0;
            color: var(--ui-status-danger);
            font-size: var(--ui-display-xl);
            font-weight: var(--ui-weight-medium);
            line-height: var(--_ui-headline-leading);
            overflow-wrap: anywhere;
        }

        /* ORACLE, live-pulling #live-alert-remedy [i=94]:
         *   font-size = 20px    <- authored var(--slate-text-lg)  -> --ui-text-lg
         *   color = rgb(186, 196, 202) dark / rgb(63, 71, 76) light
         *                       <- authored var(--slate-text-2)   -> --ui-text-2
         *   font-weight = 400   <- (no declaration - inherited or initial value), so
         *                          this rule declares none either. */
        .remedy {
            display: block;
            min-inline-size: 0;
            color: var(--ui-text-2);
            font-size: var(--ui-text-lg);
            overflow-wrap: anywhere;
        }

        /* DEPARTURE 3. A part with nothing slotted into it is not a part. display:
         * none removes it as a flex item, so the 4px gap goes with it - a
         * zero-height box would have kept the gap and left a one-line alert looking
         * cut off. */
        .is-empty {
            display: none;
        }
    `];

    constructor() {
        super();
        /* Both start false, and slotchange raises the ones that have content - as
         * does the observer below, for the case slotchange cannot see. The other
         * order would be wrong: slotchange does NOT fire for a slot that never
         * receives an assignment, so defaulting to true would leave an empty remedy
         * permanently visible. It fires before paint, so nothing flashes. */
        this._hasHeadline = false;
        this._hasRemedy = false;
    }

    /**
     * A part is filled when its assigned nodes carry non-whitespace TEXT.
     *
     * Emptiness is defined on text and not on node count on purpose, and it is the
     * contract this component already states: it takes a MESSAGE. The shape the
     * consumer will actually write is a Lit template that always emits the wrapper
     * and sometimes has nothing to put in it - <span slot="remedy">${remedy ?? ''}
     * </span> - and counting that element as content would defeat DEPARTURE 3 for
     * every real call site while satisfying it only for hand-written markup.
     *
     * THE KNOWN LIMIT, stated rather than papered over: a remedy consisting only of a
     * replaced element with no text (a bare image) reads as empty. That is outside
     * this primitive's contract - it has no icon slot and no action slot by design -
     * and the reversal is one clause here, not a redesign.
     */
    #readSlot(slot) {
        const filled = slot.assignedNodes({ flatten: true })
            .map((node) => node.textContent || '')
            .join('')
            .trim() !== '';
        if (slot.name === 'remedy') this._hasRemedy = filled;
        else this._hasHeadline = filled;
    }

    #onSlotChange(event) {
        this.#readSlot(event.target);
    }

    /**
     * EMPTINESS IS DEFINED ON TEXT, SO IT HAS TO BE RECOMPUTED WHEN TEXT CHANGES.
     *
     * `slotchange` fires when a slot's ASSIGNMENT changes. It does not fire when an
     * already-assigned node's text changes, and that is precisely how a live alert
     * arrives: the consumer mounts the surface once and fills it when the condition
     * appears. With slotchange as the only writer, MEASURED at BENCH:
     *
     *   (a) <ui-alert-banner><span id="h"></span></ui-alert-banner> then
     *       h.textContent = 'Disconnected'  ->  #headline display stayed `none`,
     *       banner 860x36: the host holds the message and the strip shows nothing.
     *   (b) The Lit consumer this file's own comment above names as the reason for
     *       text-based emptiness - <span slot="remedy">${remedy ?? ''}</span> -
     *       re-rendered with a real remedy: #remedy display stayed `none`
     *       permanently, because Lit updates the existing text node in place.
     *   (c) The reverse, which is the direction a real alert uses most: clearing a
     *       filled remedy left it displayed.
     *
     * The one component whose job is to interrupt failed silently in all three. So
     * the light-DOM subtree is observed for characterData as well as childList, and
     * both parts are recomputed from their slots. The observer watches THIS element,
     * never the shadow root - a shadow tree is a separate tree and is not observed by
     * a host-rooted MutationObserver, so re-rendering here cannot feed itself.
     *
     * slotchange is kept as well: it fires before first paint for markup that is
     * already filled, which is what keeps an empty part from flashing.
     */
    #syncParts = () => {
        for (const slot of this.renderRoot?.querySelectorAll?.('slot') ?? []) this.#readSlot(slot);
    };

    #observer = new MutationObserver(this.#syncParts);

    connectedCallback() {
        super.connectedCallback();
        /* DEPARTURE 4. role="alert" carries an implicit assertive live region and
         * aria-atomic, so the whole message is announced when it arrives - which is
         * the entire point of a surface whose job is to interrupt. Only if the author
         * has not already chosen a role: a banner used as a static notice on a page
         * that already announces should not shout twice. Slate's own markup carries
         * it (index.html:271), one attribute away from being forgotten. */
        if (!this.hasAttribute('role')) this.setAttribute('role', 'alert');
        this.#observer.observe(this, { childList: true, subtree: true, characterData: true });
    }

    disconnectedCallback() {
        this.#observer.disconnect();
        super.disconnectedCallback();
    }

    render() {
        const headline = this._hasHeadline ? 'headline' : 'headline is-empty';
        const remedy = this._hasRemedy ? 'remedy' : 'remedy is-empty';
        return html`<div id="banner" class="banner"
            ><strong id="headline" class="${headline}"
                ><slot @slotchange=${this.#onSlotChange}></slot
            ></strong
            ><span id="remedy" class="${remedy}"
                ><slot name="remedy" @slotchange=${this.#onSlotChange}></slot
            ></span
        ></div>`;
    }
}

customElements.define('ui-alert-banner', UiAlertBanner);
