/**
 * ui-stop-button.js - component #47 of the 57-component inventory: THE ABORT TARGET.
 *
 * Wave 4, item #47, "Live-screen compounds" (SCOPE Part 4, Wave 4). The row, verbatim:
 *
 *   | 47 | STOP overlay button | The full-width shot-abort control. | small | #1 |
 *
 * and the layout spec's inventory line that makes it one of the 57 rather than a use of
 * something else:
 *
 *   | 47 | STOP overlay button | slate-live.css:1775-1795 | |    (spec §5.2)
 *
 * WHAT IT IS. One control, present only while something is running, spanning the rail it
 * sits over, that asks for the run to stop. It carries no machine vocabulary, issues no
 * request and owns no state but its own presence: it renders a press and reports it.
 *
 * ---------------------------------------------------------------------------
 * WAVE LAW, AND WHY THIS FILE IS SHORT
 * ---------------------------------------------------------------------------
 * Gate 2 addressing: this component reads NO server data. It imports nothing from
 * src/data/ and nothing from src/stores/, types no server key, and issues no fetch and
 * no socket message. `running` arrives as a property and the press leaves as an event;
 * the Live screen (Part 5 §1, wf-w5p1) is what joins either end to the shot-state feed
 * and to the machine command. That is the same split Slate already had - `ui.js:3562-3563`
 * decides presence, `app.js:1738-1762` maps the press to MachineState.IDLE - with the two
 * halves moved out of two god modules and into one caller.
 *
 * A7 - no fallback path: there is no local guess about whether a shot is running. Absent
 * `running` is not "probably idle" computed from something else; it is the caller saying
 * nothing, and the control is absent. (The three-valued version of that question - yes /
 * no / the feed died mid-shot - is recorded as a deferred question rather than invented
 * here; see "what is deliberately not here".)
 *
 * ---------------------------------------------------------------------------
 * THE ORACLE HAS NO ANSWER FOR THIS ELEMENT, AND SAYS SO
 * ---------------------------------------------------------------------------
 * Run mechanically, disqualification check first (Part 10 §4):
 *
 *   prov_query.py find --cls slate-rail-stop
 *     corpus prov-baseline (dark); searched 49 state(s); found 0 element(s) in 0 state(s)
 *     "0 elements matched anywhere in this corpus. The corpus has no answer for this
 *      element: read the Slate source read-only, or record a reversible choice."
 *   prov_query.py find --id ghc-stop-btn-rail   -> 0 element(s) in 0 state(s)
 *   prov_query.py find --id ghc-stop-btn        -> 0 element(s) in 0 state(s)
 *
 * That is the documented carve-out, not a gap in the query: "States outside the 49 (steam
 * mode, a rendered GHC strip, the DYE2 paths - M16) have no corpus answer at all." The
 * abort target ships `hidden` (index.html:131) and is unhidden only by
 * `updateGhcStopButton(isActive)` (ui.js:3556-3565), which needs a machine actually
 * running; even the `live-pulling` capture has it hidden, which is why the whole GHC
 * family measures zero across all 49 states.
 *
 * So the appearance is a READ-ONLY SOURCE READ of slate-live.css:1773-1797, quoted here
 * in full because it is the entire specification of this control:
 *
 *   // P6 - the abort target. Spans the rail so it cannot be missed or mistaken for
 *   // one of the six value rows, and only exists while something is running.
 *   #main-page .slate-rail-stop {
 *       position: absolute; left: 0;
 *       // SEATED ON THE FIRST ROW, off the rail's own padding and control height
 *       // rather than a literal. At top:130/height:96 it straddled the bottom 50px
 *       // of DOSE and the top 20px of DRINK - and DOSE is the one row the dim rule
 *       // below deliberately leaves live, so the abort target was covering the only
 *       // other control you are allowed to touch mid-shot. Grind is the row you
 *       // cannot want while the pump is running, so that is the row it takes.
 *       top: 25px; z-index: 6;
 *       width: 430px; height: var(--slate-control-height);
 *       border: 0; border-radius: 0;
 *       background: var(--slate-danger);
 *       color: var(--slate-on-primary);
 *       font-size: var(--slate-display-xs);
 *       font-weight: var(--slate-weight-medium);
 *       letter-spacing: .12em;
 *   }
 *   #main-page .slate-rail-stop[hidden] { display: none !important; }
 *   #main-page.is-running .slate-rail-stop { pointer-events: auto; }
 *
 * and index.html:131:
 *   <button id="ghc-stop-btn-rail" class="slate-rail-stop" type="button" hidden
 *           aria-label="Stop the machine">STOP</button>
 *
 * EVERY TOKEN THAT RULE NAMES IS MEASURED SOMEWHERE ELSE IN THE CORPUS, so the values
 * below are oracle answers even though this element is not:
 *
 *   CITE settings-machine-sleep---wake-schedules .slate-btn [i=72] color = rgb(230, 102, 97)
 *        <- slate-components.css `.slate-btn-danger` authored `var(--slate-danger)`
 *        !important=no (token-driven)
 *        [prov-light: .slate-btn [i=72] color = rgb(181, 28, 35), same rule]
 *        = --ui-status-danger, #e66661 dark / #b51c23 light (styles/tokens.css:866, :774)
 *   CITE settings-machine-sleep---wake-schedules .slate-btn [i=100] color = rgb(246, 251, 253)
 *        <- slate-components.css `.slate-btn-primary` authored `var(--slate-on-primary)`
 *        [prov-light: [i=100] = rgb(248, 252, 253)]
 *        = --ui-on-primary, #f6fbfd dark / #f8fcfd light (styles/tokens.css:860, :753)
 *   CITE settings-maintenance-machine-descaling .slate-btn [i=43] min-height = 64px
 *        <- slate-components.css `.slate-btn` authored `var(--slate-control-height)`
 *        (token-driven) = --ui-control-h, 64px (styles/tokens.css:88)
 *   CITE expanded-charts #grind-value [i=21] font-size = 27px
 *        <- slate-components.css `.slate-stepper-value` authored `var(--slate-display-xs)`
 *        (token-driven) = --ui-display-xs, clamp(22px, 2.2cqi, 27px) (styles/tokens.css:361)
 *   CITE find --cls slate-stepper -> 85 element(s) in 16 state(s), every one 268 x 64 at
 *        x=134 - the rail rows this control lies over. Slate's own 430px is the RAIL, not
 *        the row: the abort target is wider than everything it covers, which is the whole
 *        of "spans the rail so it cannot be missed".
 * Slate's rects are frozen 1920x1200 captures, quoted as what Slate does and never as a
 * responsive target - LAYOUT_SPEC_DRAFT.md governs responsive behaviour (§7 grepped
 * first: this control appears in §7.2 nowhere, and carries no bug id of its own).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS ITS OWN CONTROL AND NOT A ui-button USE
 * ---------------------------------------------------------------------------
 * The row's "Depends on: #1" is read as the press primitive existing first, not as a
 * composition, and the reasoning is worth writing down because "compose, never
 * re-implement" is a wave law:
 *
 *   1. #1's variant set is CLOSED AT FOUR by the spec that defines it - "Button
 *      (+ primary / tall / ghost / danger)" (spec §5.1 #1) - and none of the four is a
 *      solid danger fill: `.slate-btn-danger` is a 14% tint with danger INK
 *      (ui-button.js:78-83, from slate-components.css:208-212). A 14% wash is not the
 *      abort target; Slate painted this control solid deliberately.
 *   2. There is no legal way to make a ui-button paint solid danger from outside. The
 *      only theming that crosses a shadow boundary is a custom property (A6), and
 *      re-pointing a public token on an instance - `--ui-primary: var(--ui-status-danger)`
 *      - is a Gate C ERROR by construction: guards.js:150-177, "no re-declaring a public
 *      --ui-* token inside a component", which exists for bug L12. `part()` theming is
 *      refused by #1 itself.
 *   3. Slate never used `.slate-btn` here either - the element carries `.slate-rail-stop`
 *      and nothing else - and the audit records it as its own inventory row, #47, in the
 *      list of forty things that must BECOME components. It is not a fifth copy of #1;
 *      it is the one implementation of a different control, which is what the row asks
 *      for.
 *
 * That leaves one honest alternative - teach #1 a fifth variant - and it is recorded as a
 * deferred question with its reversal, not taken tonight: editing a wave-1 primitive from
 * a wave-4 row would both contradict #1's own spec line and put two parallel builders on
 * one file under a whole-file-write rule.
 *
 * What IS composed is everything the library actually offers for this shape: `UiElement`
 * (the one focus ring, the disabled dial, the box-sizing and container rules), and the
 * i18n controller for D2. There is no second focus treatment, no private palette, no
 * hand-rolled hit utility and no selection surface in this file.
 *
 * ---------------------------------------------------------------------------
 * DELIBERATE DEPARTURES FROM SLATE (each one measured or cited)
 * ---------------------------------------------------------------------------
 *  1. IT DOES NOT POSITION ITSELF. Slate is `position: absolute; left: 0; top: 25px;
 *     z-index: 6` inside the rail. Here the host is a plain block that fills the box it
 *     is given, and the SCREEN decides where that box is - the spec's own answer to the
 *     same shape one component along: L1, "the GHC strip absolutely positioned over the
 *     chart's time axis ... In flow, always" (SCOPE Part 5 §1). The overlay is not lost:
 *     a rewrite rail stacks its first row and this control in ONE grid cell, so nothing
 *     moves when the control appears - which is Appendix item 3, "state changes weight,
 *     never position", the rule Slate's 25px top offset was hand-solving. A component
 *     that positions itself cannot be stacked, cannot give the space back, and encodes a
 *     row height it cannot see (bug L5's family - "any alignment that depends on a
 *     specific row count is rejected in review").
 *  2. NO WIDTH. Slate's 430px is the rail at 1920x1200 and is frozen geometry; here the
 *     control fills its container, whatever the container is (spec §2.1 Rule 1). The rail
 *     token is `--ui-rail-w: clamp(320px, 26%, 460px)`, so 430 is one point on that line.
 *  3. LETTER-SPACING .12em -> --ui-tracking-cap (.04em). The token layer settled this
 *     against the oracle in writing, for the whole skin: "The spec is a Step 0 document
 *     and beats the oracle, so .04em it is" (styles/tokens.css:374-382). Shipping .12em
 *     here would be the second number for a job that has a token (§2.3).
 *  4. NO text-transform: uppercase. Slate's caps are literal text in the markup, and
 *     under D2 the visible word is a translated value: a transform would shout in a
 *     language whose casing rules say otherwise. In English the rendered result is
 *     identical, because the key IS "STOP".
 *  5. THE LABEL WRAPS rather than overflowing. Slate is frozen at one size and never
 *     meets a narrow container; §2.4 makes silent clipping the inherited default the
 *     rewrite exists to stop, and the oracle has no vote on responsive behaviour. Same
 *     choice ui-button and ui-status-chip made, for the same reason.
 *  6. `pointer-events` IS NOT DECLARED. Slate needs `#main-page.is-running
 *     .slate-rail-stop { pointer-events: auto }` only because the rail sets
 *     `pointer-events: none` on itself while running and this control is INSIDE it. That
 *     is the screen's inertness policy, and it belongs to the screen; a component that
 *     re-asserts pointer-events is guessing at a parent it cannot see.
 *  7. THE DIMMING OF THE ROWS BELOW IS NOT HERE. `#main-page.is-running #shot-settings >
 *     div:not(#dose-section) { opacity: .62 }` (.42 dark) is the rail receding, not the
 *     button painting - and its two tokens already exist for it (--ui-opacity-dim /
 *     --ui-opacity-dim-dark, styles/tokens.css:465-466). Bug L11 is exactly what happens
 *     when two owners paint one state: "Two dimming systems fight over the rail ... Inline
 *     wins." One owner, and it is the rail.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY NOT HERE
 * ---------------------------------------------------------------------------
 *  - NO SELECTION TREATMENT. A momentary command has no selected state, so it paints
 *    none and the suite proves the negative: all four `--ui-selected-*` dials driven to
 *    drill values move zero pixels here. The founding defect was thirteen selection
 *    components and six looks (CONVENTIONS §4).
 *  - NO `disabled`. An abort control that can be greyed out is a hazard, and the one it
 *    replaces was exactly that: Slate's GHC stop was "dimmed, not disabled - the 20%
 *    opacity was the whole treatment, so a dimmed Coffee button still took the tap"
 *    (ui.js:3566-3570). This control is either present or absent. The base still paints
 *    the one disabled dial if a consumer insists on the attribute; nothing here adds a
 *    second meaning to it.
 *  - NO CONFIRMATION STEP. Stopping is the safe direction: Slate maps this press to
 *    MachineState.IDLE (app.js:1745), which is legal from every state. A confirm dialog
 *    (#19) in front of an abort is a second tap between the user and the safe outcome.
 *  - NO DEBOUNCE, NO IN-FLIGHT LOCK. A second press is a second request. Swallowing the
 *    second one is how "I pressed stop and nothing happened" becomes "I pressed stop
 *    twice and nothing happened"; coalescing belongs to whoever owns the transport.
 *  - NO MACHINE VOCABULARY. It does not know what espresso is, does not read
 *    MACHINE_STATE, and does not decide when a shot is running. Item #48's rule, kept:
 *    "a primitive that needs server data is a design error to flag, not to satisfy."
 *  - NO ELAPSED TIME, NO SECONDARY LINE. The row is one control; the numbers are the
 *    gauge cluster's (#33).
 *
 * ---------------------------------------------------------------------------
 * API
 * ---------------------------------------------------------------------------
 *   <ui-stop-button running></ui-stop-button>          <- the control exists
 *   <ui-stop-button></ui-stop-button>                  <- nothing renders at all
 *   <ui-stop-button running>Abort</ui-stop-button>     <- the visible word, slotted
 *   <ui-stop-button running label="Stop the shot">     <- the accessible name
 *   <ui-stop-button running label="">                  <- name falls back to the words
 *   <ui-stop-button running focus-ring="inset">        <- base attribute, clipping parent
 *
 *   Events:  `stop-request` {bubbles, composed, detail:{reason:'press'}} - the ask.
 *            `click` composes and retargets to the host on its own, so a screen may
 *            listen to either; `stop-request` is the one that says what it means and
 *            the one a screen should use.
 *
 *   `focus()` / `blur()` go inward to the real <button> (forwarded, not delegatesFocus -
 *   CONVENTIONS §11), and `control` is the element they act on. Both are no-ops while
 *   the control is absent, because then there is nothing to focus - which is the point.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';

/** The event a screen listens for. Exported so no caller spells it by hand. */
export const STOP_REQUEST = 'stop-request';

/** The visible word, as an i18n KEY (keys are English text - src/lib/i18n.js). */
export const STOP_LABEL_KEY = 'STOP';

/** The accessible name, Slate's own string (index.html:131 aria-label). */
export const STOP_NAME_KEY = 'Stop the machine';

export class UiStopButton extends UiElement {
    static properties = {
        /** Is something running? The control exists only while this is true. */
        running: { type: Boolean, reflect: true },
        /** Accessible name. Empty string = fall back to the visible words. */
        label: { type: String },
    };

    static styles = [css`
        /* The host is the box the screen gives it, and the control fills that box.
         * display: grid rather than block so the button STRETCHES to the cell when the
         * rail stacks it over its first row - an abort target with transparent margins
         * would leak presses through to the control it is covering.
         * container-type: inline-size stays as the base set it: --ui-display-xs is
         * clamp(22px, 2.2cqi, 27px) and the cqi has to resolve against THIS component's
         * container, which is the only reason the display steps are fluid (spec §3.5,
         * §2.1 Rule 1). */
        :host {
            display: grid;
        }

        /* "Only exists while something is running" (slate-live.css:1773-1774). The
         * render() half removes the button from the tree - no focusable, no hit target,
         * nothing for a screen reader to find - and this rule removes the box. Two
         * halves because either alone is a half-truth: a display:none button is still in
         * the DOM, and a removed button still leaves an empty grid box behind.
         * (0,2,0) beats the :host rule above, which is (0,1,0). */
        :host(:not([running])) {
            display: none;
        }

        /* RESTING PAINT ON A CLASS, NEVER AN ID (CONVENTIONS §4 rule 2) and never on
         * :host: a screen sheet can name the host from outside and can name nothing in
         * here, which is the mechanism that makes the look unreachable rather than
         * merely un-overridden. */
        .stop {
            display: flex;
            align-items: center;
            justify-content: center;
            min-block-size: var(--ui-control-h);
            padding-inline: var(--ui-space-5);
            /* Slate: border: 0; border-radius: 0. A control that spans a band edge to
             * edge takes the band's corners, not its own - a radius here would draw four
             * notches of rail through the abort target. */
            border: 0;
            border-radius: 0;
            background-color: var(--ui-status-danger);
            color: var(--ui-on-primary);
            /* The UA sheet sets font-family/-size on <button> and there is no Tailwind
             * preflight inside a shadow root to undo it, so both must be stated. Plain
             * inherit for the family: it already crosses the boundary from
             * styles/document.css, and restating the token would break a screen's
             * ability to set a family locally (CONVENTIONS §11). */
            font-family: inherit;
            font-size: var(--ui-display-xs);
            font-weight: var(--ui-weight-medium);
            letter-spacing: var(--ui-tracking-cap);
            text-align: center;
            /* SOURCE (read-only, outside the oracle's 18-property surface): Tailwind
             * preflight in app.css gives every Slate button cursor: pointer. */
            cursor: pointer;
        }
    `];

    /** An aria-label the SCREEN wrote on this host, moved rather than copied - bug L23's
     *  first symptom is "aria-label on role-less <div>s (x3)", and Chrome exposes the
     *  name on a role-less host anyway, so leaving it would announce the control twice.
     *  ui-preset-bank and ui-tab-bar make the same move for the same bug. */
    #hostLabel = null;

    constructor() {
        super();
        this.running = false;
        this.label = '';
        /* D2: translation is a value the component reads, not a document walk. A
         * language change re-renders this element through its own template; a
         * querySelectorAll cannot cross a shadow boundary at all (src/lib/i18n.js). */
        this.i18n = new I18nController(this);
    }

    /** The inner control - what focus and the press belong to. Null while absent. */
    get control() {
        return this.renderRoot?.querySelector?.('button') ?? null;
    }

    /** The name, in the order a caller would expect: an explicit `label`, then an
     *  aria-label the screen wrote on the host, then Slate's own string. An EMPTY
     *  `label=""` attribute is a real answer and not an absence - it means "the visible
     *  words are the name", which is what a slotted verb wants (WCAG label-in-name is
     *  satisfied either way: "Stop the machine" contains the word on the face). */
    get accessibleName() {
        if (this.label) return this.label;
        if (this.hasAttribute('label')) return '';
        return this.#hostLabel ?? this.i18n.t(STOP_NAME_KEY);
    }

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

    updated(changed) {
        super.updated(changed);
        if (this.#adoptHostLabel()) this.requestUpdate();
    }

    /** Move a screen-written aria-label onto the button. Returns true only on the update
     *  that actually moved one, so the extra render this asks for happens once. */
    #adoptHostLabel() {
        const written = this.getAttribute('aria-label');
        if (written === null) return false;
        this.#hostLabel = written;
        this.removeAttribute('aria-label');
        return true;
    }

    /**
     * Ask for the run to stop. The component does not stop anything: it says that the
     * one control on the screen whose job is stopping was pressed, and the screen turns
     * that into the machine command (Slate: setMachineState(MachineState.IDLE),
     * app.js:1745-1758). Not cancelable - an abort is not something another layer gets
     * to veto by calling preventDefault.
     */
    #onPress = () => {
        this.dispatchEvent(new CustomEvent(STOP_REQUEST, {
            detail: { reason: 'press' },
            bubbles: true,
            composed: true,
        }));
    };

    render() {
        /* Absent, not hidden. "no cost at all when nothing is running: the control does
         * not exist then" (ui.js:3559-3561). A hidden-but-present button is P13's shape
         * - "16 focusables reachable inside closed dialogs" - one control at a time. */
        if (!this.running) return nothing;

        const name = this.accessibleName;
        return html`<button
            id="stop"
            class="stop"
            type="button"
            aria-label=${name ? name : nothing}
            @click=${this.#onPress}
        ><slot>${this.i18n.t(STOP_LABEL_KEY)}</slot></button>`;
    }
}

customElements.define('ui-stop-button', UiStopButton);
