/**
 * ui-status-chip.js - component #48 of the 57-component inventory: THE MACHINE-STATE
 * CHIP AND THE RECORDING PULSE.
 *
 * Wave 1, item #48 (SCOPE Part 4, "Wave 1 - primitives"; SCOPE.md:1524). Token-only:
 * no data layer, no ReaPrime, no endpoint. The chip is handed its words from outside
 * and is told whether a shot is happening; it never asks anything.
 *
 * WHY IT EXISTS AS A COMPONENT AT ALL
 *   spec §5.2 #48: "Status chip / live pulse | slate-live.css:903-916, :1832-1841 |
 *   `.slate-chart-state` (:1738-1745) styles a class no element carries."
 *   SCOPE.md:1524: "The machine-state chip and the recording pulse on Live. Its
 *   current sibling `.slate-chart-state` styles a class no element carries (L13) -
 *   build one, not two."
 *
 * THE BUG THIS COMPONENT RETIRES - L13 (spec §7.2, LAYOUT_SPEC_DRAFT.md:1112)
 *   "`.slate-chart-state` styles a class no element carries." (slate-live.css:1738-1745)
 *
 *   ORACLE, the defect itself, quoted - a query that returns NOTHING is the proof:
 *     prov_query.py find --cls slate-chart-state
 *       corpus prov-baseline (dark); searched 49 state(s); found 0 element(s) in 0 state(s)
 *       "0 elements matched anywhere in this corpus."  exit=1
 *
 *   Slate wrote the status chip TWICE and shipped both. The rule that reaches the
 *   screen is `#main-page #machine-status` (slate-live.css:903-916, six !important
 *   declarations); the rule that reaches nothing is `#main-page .slate-chart-state`
 *   (:1738-1745). They do not even agree - the live one is --slate-text-md / 600 /
 *   .08em, the dead one is --slate-text-cap / --slate-weight-semibold /
 *   --slate-tracking-cap - so the dead rule is not a harmless duplicate, it is a
 *   SECOND DESIGN nobody could see was unused. There is one element here and one set
 *   of rules for it, and test/render/ui-status-chip.render.test.mjs asserts
 *   mechanically that every class this file authors is carried by a rendered node
 *   ("L13 cannot express").
 *
 * MEASURED STARTING VALUES - every one is an oracle answer, quoted verbatim.
 * (prov_query.py against slate-audit-2026-08-16/prov-baseline, dark, and prov-light.)
 *
 *   prov_query.py find --id machine-status
 *     found 7 element(s) in 7 state(s) - expanded-charts, history-shotdata,
 *     history-viewer, live-pulling, live-ready, modal-notes, modal-numpad
 *     distinct geometries (w x h), all matched elements: 161 x 22  x7
 *     <div id="machine-status" class="status-msg-red"> text "Disconnected"
 *
 *   CITE live-ready #machine-status [i=94] color = rgb(148, 161, 169)
 *     <- slate-live.css `#main-page #machine-status` authored `var(--slate-muted)`
 *        !important=no (token-driven)
 *     CITE live-ready #machine-status [i=94] color: dark rgb(148, 161, 169) /
 *        light rgb(90, 101, 108)   <- both are --ui-muted's two theme values
 *        (styles/tokens.css: #94a1a9 dark, #5a656c light - exact, both themes)
 *   CITE live-ready #machine-status [i=94] font-size = 18px
 *     <- slate-live.css `#main-page #machine-status` authored `var(--slate-text-md)`
 *        !important=yes (token-driven)              -> --ui-text-md, 18px
 *   CITE live-ready #machine-status [i=94] font-weight = 600
 *     <- slate-live.css `#main-page #machine-status` authored `600` !important=yes
 *        (FROZEN/hardcoded)                          -> see DEPARTURE 1
 *   CITE live-ready #machine-status [i=94] letter-spacing = 1.44px
 *     <- slate-live.css `#main-page #machine-status` authored `0.08em` !important=yes
 *        (token-driven)                              -> see DEPARTURE 2
 *   CITE live-ready #machine-status [i=94] text-transform = uppercase
 *     <- slate-live.css `#main-page #machine-status` authored `uppercase` !important=no
 *        (FROZEN/hardcoded)
 *   CITE live-ready #machine-status [i=94] background-color = rgba(0, 0, 0, 0)
 *     <- (no declaration - inherited or initial value)
 *   CITE live-ready #machine-status [i=94] box-shadow = none
 *   CITE live-ready #machine-status [i=94] border-top-left-radius = 0px
 *   CITE live-ready #machine-status [i=94] border-top-width = 0px  (themes table)
 *   CITE live-ready #machine-status [i=94] padding-left = 0px      (themes table)
 *   CITE live-ready #machine-status [i=94] height = 21.5938px
 *     <- (no declaration - inherited or initial value)  (token-driven)
 *        A LINE BOX, NOT A BOX WITH A SIZE - but a line box the same rule SETS:
 *        slate-live.css:912 `line-height: 1.2 !important`, in the middle of the six
 *        declarations quoted above. 18px x 1.2 = 21.6, which Chrome lays out as
 *        21.5938px (1/64 px units). `height` is inside the oracle's 18-property
 *        surface, so dropping the leading moves a FROZEN value: with no declaration
 *        the chip renders at the UA's `normal` = 23px. Decal's document layer has
 *        no leading of its own to inherit (`grep -n "line-height\|leading"
 *        styles/document.css styles/tokens.css` -> zero hits), so the ratio is
 *        carried on .chip below. That is a restoration, not a departure.
 *   CITE themes live-ready #machine-status: 17 of 18 properties identical across
 *        themes; 1 differ (color).
 *
 *   SO THE "CHIP" IS NOT A PILL. Every decoration a chip would have - fill, border,
 *   radius, padding, elevation - measures to zero or none in both themes on all
 *   seven captured states. This component draws tracked uppercase text and nothing
 *   else. Inventing a pill here would be inventing a design, not porting one.
 *
 * WHAT THE ORACLE CANNOT ANSWER, and what was read instead
 *   The corpus never captured the pulse. All seven records read class
 *   "status-msg-red" and text "Disconnected" - including live-pulling - so
 *   `[data-chart-state="live"]` never fired during the capture and the dot has no
 *   measured value. Part 10 §4 carve-out: "fall through to reading the Slate source
 *   read-only." That source is slate-live.css:1832-1846, quoted here in full because
 *   it is the whole specification of the pulse:
 *
 *     #main-page #machine-status[data-chart-state="live"]::before {
 *         content: ""; display: inline-block;
 *         width: 10px; height: 10px;
 *         margin-right: var(--slate-space-2);
 *         border-radius: 50%;
 *         background: var(--slate-danger);
 *         animation: slate-live-pulse 1.6s ease-in-out infinite;
 *     }
 *     @keyframes slate-live-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .3 } }
 *
 *   and its authored intent, slate-live.css:1833-1834: "P24 - the chart's own state.
 *   LIVE pulses so the difference between a shot happening now and a plot of one that
 *   finished is visible at arm's length."
 *
 *   --slate-danger is --ui-status-danger: the oracle reads
 *   settings-machine-sleep---wake-schedules .slate-btn [i=72] color = rgb(230, 102, 97)
 *   <- slate-components.css `.slate-btn-danger` authored `var(--slate-danger)`, and
 *   --ui-status-danger is #e66661 = rgb(230, 102, 97) dark (styles/tokens.css:866).
 *   --slate-space-2 is --ui-space-2, 8px (spec §3.3, unchanged).
 *
 *   Also outside the oracle's reach by construction: the 18-property appearance
 *   surface excludes "margins, flex/grid placement", so how the dot sits beside the
 *   words is a source read plus a stated choice, never a measurement.
 *
 * DELIBERATE DEPARTURES, all six recorded in the wave-1 ledger
 * (_skinlab/realine-run/EXPECTED_CHANGES.jsonl, region ui-status-chip; source
 * _skinlab/realine-run/waves/1/ledger-src/) - a ledger that exists on disk and can be
 * checked, not a "manifest" no file corresponds to. Each is ALSO asserted as a
 * departure in test/render/ui-status-chip.render.test.mjs, which is the copy a gate
 * can run rather than read.
 *   (History, because this block said the opposite twice. An early draft cited "the
 *   wave manifest" and nothing corresponded to it; the correction struck the sentence
 *   and said "there is no per-wave manifest file for wave 1 - the record is HERE, in
 *   this header", which was true when written. Finding cross-5 settled it the third
 *   way: eight sibling components made the same citation, so the convention was right
 *   and only the artifact was missing. waves/1/ledger-src/ + build_ledgers.mjs now
 *   exist, the same mechanism waves 0a and 0b already had, so the citation resolves.)
 *   1. WEIGHT 600 -> --ui-weight-semibold, AND IT IS NO LONGER A DEPARTURE. THE
 *      TOKEN LAYER DECIDED THIS, not this builder, and at parity surface 1 it decided
 *      it the other way: styles/tokens.css shipped three weights ("600 -> 700 on the
 *      ~50 elements that read semibold") on the authority of LAYOUT_SPEC_DRAFT §3.5,
 *      whose own citation slate-tokens.css:148-153 declares FOUR weights with
 *      semibold at 600. The sheet now carries Slate's four and this chip renders
 *      Slate's own 600. (Slate hardcoded 600 at slate-live.css:911 and the dead twin asked
 *      for --slate-weight-semibold. Had the token sheet NOT settled it, 500 and 700
 *      are equidistant from 600 and the tiebreak would be Slate's own stated intent
 *      at slate-live.css:901-902: "Uppercase and tracked so it still reads as a state
 *      rather than as prose" - bold keeps that, medium is the prose end.)
 *   2. TRACKING .08em -> --ui-tracking-cap, which is Slate's own .12em since parity
 *      surface 0 (its .04em rested on a LAYOUT_SPEC_DRAFT line refuted by its own
 *      citation). 1.44px becomes 2.16px at 18px, and the token layer decided it: one
 *      component, one token, the value Slate declares and renders on 190 elements.
 *      Slate's .08em is also a hardcoded second number for a job that already has a
 *      token - the dead twin used `var(--slate-tracking-cap)` for exactly this text -
 *      and §2.3 bans "the same number written in two places. If two components must
 *      agree, they share a token." Merging two chips into one is precisely the case
 *      where the two numbers have to become one.
 *   3. THE LABEL WRAPS rather than overflowing. Slate sets white-space: nowrap at a
 *      frozen 1920x1200; responsive behaviour has no Slate answer (Part 10 §4
 *      disqualification check) and §2.4 makes silent clipping the inherited default
 *      the rewrite exists to stop. Same choice ui-button made, for the same reason.
 *      The dot never shrinks and never wraps away from the first word.
 *   4. A REAL ELEMENT, not a ::before. Conditional rendering makes the dot's absence
 *      structural rather than a paint state, which is what lets the L13 assertion
 *      read "no class in this file goes unmatched" as a fact about the DOM.
 *   5. role="status" ON THE HOST. Slate's chip is a bare <div> whose text is rewritten
 *      in place, so a machine going from READY to DISCONNECTED is announced to nobody -
 *      the same class of defect the spec logs as O9 and C14 ("the display is updated by
 *      innerHTML with no aria-live"). Appendix 15 keeps Slate's aria-driven state
 *      contract; this is the missing half of it. Set only if the author has not chosen
 *      a role.
 *   6. REDUCED MOTION IS HONOURED. CONVENTIONS §11: the base carries no rule and says
 *      it "belongs in styles/document.css or in each animating component". This is
 *      the animating component. It needs no !important - the later rule simply wins -
 *      and prefers-reduced-motion is not a width query, so §2's ban does not reach it.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   - NO TONES. No ok / warn / danger variants. The oracle measures ONE ink on all
 *     seven states in both themes, and the small coloured status marker is item #12
 *     (Badge, + active + attention). A second badge is the decay the rewrite exists
 *     to stop, and there is no 17th item.
 *   - NO PILL. See the oracle block above: every decoration measures zero.
 *   - NO STATE VOCABULARY. The chip does not know what "ready" means, does not map a
 *     machine state to a word, and does not own a range - it renders what it is given.
 *     A primitive that needs server data is a design error to flag, not to satisfy.
 *   - NO SELECTION TREATMENT. Nothing here is selectable; the four dials belong to
 *     component #3 (CONVENTIONS §4).
 *   - NO HIT AREA. The row cites neither Appendix 5 nor a hit floor: this is a
 *     readout, not a control. Adding a 48px box to a text label would push the header
 *     band apart for a target nobody can press.
 *
 * API
 *   <ui-status-chip>Ready</ui-status-chip>
 *   <ui-status-chip>Disconnected</ui-status-chip>
 *   <ui-status-chip live>Live</ui-status-chip>        <- the pulsing dot appears
 *   <ui-status-chip role="presentation">Ready</ui-status-chip>   <- author keeps the role
 *
 *   Internal knobs (--_ui-, not tokens, not an API surface): --_ui-dot-size,
 *   --_ui-pulse-dur, --_ui-pulse-floor.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';

export class UiStatusChip extends UiElement {
    static properties = {
        /** A shot is happening now: show the pulsing dot. Reflected so a screen can
         *  lay out `ui-status-chip[live]` from outside without piercing anything. */
        live: { type: Boolean, reflect: true },
    };

    static styles = [css`
        /* CONTAINER-HOSTING OPT-OUT, the one-liner CONVENTIONS §2 documents. The base
         * puts container-type: inline-size on every host, which is right for anything
         * filling a slot and wrong for "a control that must shrink to fit its glyph".
         * This chip sits at the end of a header row - Slate reaches the same shape
         * with flex: 0 0 auto plus margin-left: auto (slate-live.css:911-912) - so it
         * must be as wide as its words and no wider. Nothing in this file is
         * size-keyed, so there is no query to lose. max-inline-size keeps departure 3
         * honest: the chip may wrap, it may never push its container wider. */
        :host {
            container-type: normal;
            display: inline-flex;
            max-inline-size: 100%;

            /* PRIVATE GEOMETRY AND TIMING (CONVENTIONS §7). Declared here rather than
             * in JS because a custom element constructor may not write attributes,
             * and because a :host declaration is the one that an outside rule
             * ui-status-chip { --_ui-dot-size: 14px } beats by construction: CSS
             * Scoping sorts shadow-tree rules matching the host BELOW document-tree
             * rules, whatever the specificity. Internals, not tokens - the leading
             * underscore is what keeps the token-integrity scan for var(--ui- honest,
             * and none of these may ever carry a colour.
             *
             * dot-size 10px and pulse-dur 1.6s / floor .3 are slate-live.css:1836-1846
             * read verbatim; the corpus has no capture of the pulse to measure. */
            --_ui-dot-size: 10px;
            --_ui-pulse-dur: 1.6s;
            --_ui-pulse-floor: .3;
        }

        /* RESTING PAINT ON A CLASS, NEVER AN ID (CONVENTIONS §4 rule 2) - and never
         * on :host, which is the half L13 turns on: the ONE thing that must be true
         * of this component is that the styled node is the rendered node. A class in
         * a shadow root that no element carries is a build error the test catches;
         * a class in a global sheet that no element carries is slate-live.css:1738.
         *
         * ORACLE, live-ready #machine-status [i=94], quoted in the header block:
         *   color = rgb(148, 161, 169) <- authored var(--slate-muted)      -> --ui-muted
         *   font-size = 18px           <- authored var(--slate-text-md)    -> --ui-text-md
         *   text-transform = uppercase <- authored uppercase
         *   background-color = rgba(0, 0, 0, 0), box-shadow = none,
         *   border-top-left-radius = 0px, border-top-width = 0px, padding-left = 0px
         *     <- (no declaration - inherited or initial value)
         * font-weight and letter-spacing are departures 1 and 2; see the header. */
        .chip {
            display: flex;
            align-items: center;
            /* Slate spends margin-right: var(--slate-space-2) on the dot
             * (slate-live.css:1837). One gap says the same thing once, and it is the
             * same 8px: spec §3.3 carries the spacing scale unchanged. */
            gap: var(--ui-space-2);
            min-inline-size: 0;
            background-color: transparent;
            color: var(--ui-muted);
            /* The family already crosses the boundary from styles/document.css;
             * restating the token would break a screen setting one locally
             * (CONVENTIONS §11). Slate's own reading here is font-family =
             * Inter, sans-serif from main.css .status-msg-red, i.e. inherited too. */
            /* THE SIZE IS A HOOK WITH THE ORACLE AS ITS DEFAULT (Ben, 30 August 2026:
             * "can we make IDLE font a bit bigger, its a different area but think we
             * should tweak it now"). The 18px above is frozen — it is one of the
             * oracle's 18 properties for [i=94], and the 21.5938px height record two
             * comments down is derived from it — so it stays the default and no caller
             * that leaves the property alone moves at all. Live's identity line sets
             * the hook to --ui-text-lg; every other user keeps 18. */
            font-size: var(--_ui-status-chip-size, var(--ui-text-md));
            font-weight: var(--ui-weight-semibold);
            letter-spacing: var(--ui-tracking-cap);
            /* THE HEIGHT RECORD. slate-live.css:912 declares line-height: 1.2
             * !important - the seventh declaration of the same rule the six values
             * above come from, and the one that produces
             *   CITE live-ready #machine-status [i=94] height = 21.5938px
             *        <- (no declaration - inherited or initial value) (token-driven)
             * (18px x 1.2 = 21.6, laid out in 1/64 px units). height is inside the
             * oracle's 18-property surface, so this is a frozen measurement and not a
             * by-product; leaving it undeclared renders 23px, because Decal's
             * document layer carries no leading to inherit the way Slate inherits
             * Tailwind's preflight 1.5. Carried as a plain ratio, like the six
             * siblings that carry a Slate line-height (type-roles.js:190/204/223/237/
             * 256, ui-empty-state.js:314/325, ui-keycap.js:270, ui-icon-button.js:243,
             * ui-alert-banner.js:257, ui-select.js:234): there is no --ui-leading-*
             * family, §3.5 never proposes one, and tokens.css is wave 0a's file. No
             * !important needed - nothing in here competes with it. */
            line-height: 1.2;
            text-transform: uppercase;
        }

        /* DEPARTURE 3. Slate is white-space: nowrap at a frozen 1920x1200. Below that
         * width nowrap is a silent clip, which §2.4 names as the inherited default
         * worth removing. Wrapping keeps every letter on screen; anywhere is what
         * makes DISCONNECTED survive a container narrower than the word. */
        .label {
            min-inline-size: 0;
            overflow-wrap: anywhere;
        }

        /* THE PULSE. Read from slate-live.css:1832-1846 read-only, because the corpus
         * has no capture of it: all seven #machine-status records read
         * class "status-msg-red" text "Disconnected", live-pulling included.
         *
         *   width: 10px; height: 10px      -> --_ui-dot-size, spec §2.3 case 3,
         *      "icon and glyph geometry intrinsic to the artwork"
         *   border-radius: 50%             -> --ui-radius-pill; spec §3.4 records that
         *      "any value >= half the height does the same" for a pill
         *   background: var(--slate-danger) -> --ui-status-danger
         *      (oracle: .slate-btn-danger color = rgb(230, 102, 97) <- var(--slate-danger);
         *       --ui-status-danger is #e66661 = rgb(230, 102, 97) dark)
         *   animation: 1.6s ease-in-out infinite -> --_ui-pulse-dur, ease-in-out kept.
         *      NOT --ui-ease: that curve is cubic-bezier(.2, 0, 0, 1), an entrance
         *      ease, and a breathe wants a symmetric one.
         *
         * flex: none is the container contract - departure 3 lets the words wrap and
         * the dot is not words. */
        .dot {
            flex: none;
            inline-size: var(--_ui-dot-size);
            block-size: var(--_ui-dot-size);
            border-radius: var(--ui-radius-pill);
            background-color: var(--ui-status-danger);
            animation: ui-status-chip-pulse var(--_ui-pulse-dur) ease-in-out infinite;
        }

        /* Slate's keyframes, carried unchanged (slate-live.css:1844-1846). */
        @keyframes ui-status-chip-pulse {
            0%, 100% { opacity: 1; }
            50%      { opacity: var(--_ui-pulse-floor); }
        }

        /* DEPARTURE 6. CONVENTIONS §11 hands reduced motion to "each animating
         * component"; this is the first one. No !important is needed - this rule is
         * later than the one it overrides and ties are won by order (§6). This is a
         * feature query, not a width query, so §2's ban does not reach it. The dot
         * stays visible at full opacity: it is the only mark that says a shot is
         * happening, so it must not be what motion sensitivity costs the user. */
        @media (prefers-reduced-motion: reduce) {
            .dot {
                animation: none;
            }
        }
    `];

    constructor() {
        super();
        this.live = false;
    }

    connectedCallback() {
        super.connectedCallback();
        /* DEPARTURE 5. role="status" carries an implicit polite live region and
         * aria-atomic, so READY -> DISCONNECTED is announced as a whole phrase. Only
         * if the author has not already chosen a role: a chip used as decoration
         * beside a heading that already announces should stay silent. */
        if (!this.hasAttribute('role')) this.setAttribute('role', 'status');
    }

    render() {
        return html`<span id="chip" class="chip"
            >${this.live
                ? html`<span id="dot" class="dot" aria-hidden="true"></span>`
                : nothing}<span id="label" class="label"><slot></slot></span></span>`;
    }
}

customElements.define('ui-status-chip', UiStatusChip);
