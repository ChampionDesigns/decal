/**
 * ui-progress-track — Wave 1 item #17, the Progress track.
 *
 * Spec row (LAYOUT_SPEC_DRAFT.md §5.1 #17): "Progress track | `:?` — 1 use".
 * The `:?` is the inventory saying the audit could not name a component-sheet
 * line for it; SCOPE.md:1527 fills that in and is the whole brief:
 *
 *   "Determinate progress line. One use today — the app-update download bar
 *    (`settings.js:6240`, verified); the firmware file-upload user is removed,
 *    not carried (D4)."
 *
 * D4 (DECISIONS, SCOPE.md:288/297/2216) — "the hand-picked file upload is
 * removed, not carried. A control that flashes firmware from an arbitrary file
 * is worse than no control." So this component has exactly ONE consumer and it
 * is determinate. There is deliberately no indeterminate mode, no buffered
 * second bar, no cancel affordance and no upload API: each of those would be a
 * feature with no consumer, and the one that had a consumer was killed.
 *
 * TOKEN-ONLY (Part 10 §12, wf-w1-primitives). No data layer, no ReaPrime, no
 * endpoint. `value` and `max` arrive from outside as attributes/properties and
 * the component owns neither the range nor the transport — "a primitive that
 * needs server data is a design error to flag, not satisfy". The app-update
 * websocket is the screen's business, not this element's.
 *
 * SHAPE. The HOST is the progressbar: role, aria-valuemin/max/now/text and the
 * accessible name all sit on it, which is what lets `aria-labelledby` point at
 * the panel's own "App Update" heading in the light DOM — an inner element
 * sealed in a shadow root could not be referenced that way. Inside are exactly
 * two painted boxes and nothing focusable.
 *
 * NO NATIVE <progress>, ON PURPOSE. A native progress element is painted through
 * per-engine pseudo-elements (::-webkit-progress-value, ::-moz-progress-bar) and
 * an unknown pseudo-element invalidates the whole selector list it appears in, so
 * the two engines cannot share one rule. That is exactly how Slate ended up with
 * bug T22 — "four thumb specs over three hand-rolled sliders + un-overridden
 * Gecko thumb" (§7.5), a Gecko thumb nobody maintained. T22 is not on this row,
 * but it is the trap this element would walk into for no gain: a progressbar is
 * not interactive, so the native element buys nothing that role="progressbar"
 * plus aria-valuenow does not already give, and it costs two divergent paint
 * paths. Two divs render identically in both engines and the suite asserts the
 * shadow tree has no `progress` element in it.
 *
 * ======================= ORACLE — THE DISQUALIFICATION RUN FIRST ==============
 * Step 1, the bug grep. LAYOUT_SPEC_DRAFT.md §7's 140 layout bugs mention
 * "progress" nowhere, and this row carries NO bug ids. Nothing here is a
 * catalogued defect to avoid reproducing — but see DEPARTURES 1, which is an
 * UNCATALOGUED one the corpus never got to see.
 *
 * Step 2, the decision check. D4 settles the scope (one consumer, determinate).
 * No decision settles the paint.
 *
 * Step 3, the query — and it comes back EMPTY, which is itself the answer:
 *
 *   $ prov_query.py find --cls slate-progress-track
 *   corpus    prov-baseline (dark)
 *   searched  49 state(s)
 *   found     0 element(s) in 0 state(s)
 *   0 elements matched anywhere in this corpus.
 *   The corpus has no answer for this element: read the Slate source read-only,
 *   or record a reversible choice in DEFERRED_QUESTIONS.md.
 *
 * That is a documented carve-out, not a tool fault: the bar exists only while
 * `phase === 'downloading'` (settings.js:6239), and no capture in the 49 states
 * was taken mid-download. `find --cls slate-key-on` is empty for the same
 * reason — it is a token, not a class. So the starting values below are the
 * tool's own fallback, a READ-ONLY source read of the one use site:
 *
 *   SOURCE  app/src/settings/settings.js:6240
 *     <div class="slate-progress-track w-full h-[10px] overflow-hidden mt-1">
 *       <div class="h-full slate-accent-bg transition-[width] duration-200"
 *            style="width:${pct}%"></div>
 *     </div>
 *   SOURCE  app/src/css/slate-components.css:723-726
 *     .slate-progress-track {
 *         border-radius: var(--slate-radius);
 *         background-color: var(--slate-key-on) !important;
 *     }
 *   SOURCE  app/src/css/slate-components.css:127-130
 *     .slate-accent-bg { background-color: var(--slate-primary) !important; … }
 *
 * → trough --ui-key-on at --ui-radius, 10px tall, full width, clipped;
 *   fill full height, 200ms on width. Every one of those is carried. The FILL
 *   COLOUR is the one that is not — see DEPARTURES 1.
 *
 * WHERE THE ORACLE DOES SPEAK, it is quoted: the fill colour question has a
 * corpus answer from the library's OTHER filled track, and it agrees across
 * both themes, which is what makes it a token answer rather than a colour:
 *
 *   CITE  live-ready #shot-rating-slider [i=157] background-image =
 *         linear-gradient(to right, rgb(176, 196, 206) 0%, rgb(176, 196, 206) 0%,
 *         rgb(58, 72, 82) 0%, rgb(58, 72, 82) 100%)
 *         <-  slate-live.css  `#main-page .slate-rate-slider`
 *         authored `(NOT CAPTURED — set via a CSS shorthand)`  !important=no
 *         (token-driven)
 *   CITE  themes live-ready #shot-rating-slider [i=157] background-image:
 *         dark  linear-gradient(… rgb(176, 196, 206) … rgb(58, 72, 82) …) /
 *         light linear-gradient(… rgb(49, 92, 112) … rgb(203, 208, 211) …)  DIFF
 *
 *   dark  rgb(176,196,206) = --ui-steel ; light rgb(49,92,112) = --ui-steel.
 *   The FILL of a filled track in this skin is --ui-steel, in both themes.
 *   (ui-slider #23 reads the same pair off the same record — one library, one
 *   answer for one visual object.)
 *
 * And the value being departed from, quoted so the departure is arguable:
 *
 *   CITE  settings-help-send-feedback #feedback-submit-btn [i=65]
 *         background-color = rgb(23, 59, 77)  <-  slate-components.css
 *         `.slate-accent-bg`  authored `var(--slate-primary)`  !important=yes
 *         (token-driven)
 *
 * rgb(23,59,77) = #173b4d = --ui-primary in dark. That is the class the
 * progress fill wears at settings.js:6240.
 *
 * ============================ DELIBERATE DEPARTURES ============================
 *
 *  1. THE FILL IS --ui-steel, NOT --ui-primary. Slate's fill class computes to
 *     rgb(23,59,77) (the CITE above) and its trough to --slate-key-on #283139 in
 *     dark. Measured against WCAG 1.4.11 (non-text contrast, 3:1):
 *
 *         dark   --ui-primary #173b4d on --ui-key-on #283139  =  1.11:1
 *         light  --ui-primary #234f63 on --ui-key-on #e3e7e9  =  7.12:1
 *         dark   --ui-steel   #b0c4ce on --ui-key-on #283139  =  7.32:1
 *         light  --ui-steel   #315c70 on --ui-key-on #e3e7e9  =  5.83:1
 *
 *     1.11:1 is a download bar that is present, correct and invisible — in the
 *     theme the machine ships in. It is not in §7 only because no capture was
 *     ever taken mid-download; the token sheet names the mechanism anyway
 *     (styles/tokens.css, --ui-steel/--ui-primary: "--ui-primary … in dark it is
 *     a deep navy"; "--ui-steel INVERTS between themes"). --ui-primary is the
 *     PRIMARY-ACTION fill — a button ground carrying --ui-on-primary ink, sized
 *     to be read as a mass against the page. A 10px indicator read against a
 *     control face is the other job, and the token whose stated role covers it
 *     is --ui-steel ("focus ring, selected LED, selected FILL"), which is also
 *     what the oracle measures on the skin's other filled track. The rendering
 *     suite asserts >= 3:1 in BOTH themes, so this cannot silently regress.
 *     REVERSIBLE IN ONE WORD: swap --ui-steel for --ui-primary in .fill below.
 *
 *  2. THE THICKNESS IS DERIVED, NOT THE LITERAL 10px. See --_ui-progress-h.
 *
 *  3. ONE !important BECOMES ZERO. Slate needs it because app.css utilities
 *     reach the same div; nothing reaches into a shadow root (CONVENTIONS §6).
 *
 *  4. THE TRANSITION ACTUALLY RUNS. Slate authors `transition-[width]
 *     duration-200` on the fill and then defeats it: settings.js re-renders the
 *     whole panel with `section.innerHTML = renderAppUpdateBlock(data)` on every
 *     state change, so every frame of the download is a BRAND NEW div starting
 *     at its final width — a transition that can never fire. A Lit component
 *     persists across updates, so the authored intent happens for the first
 *     time. Same declaration, at --ui-dur-slow (200ms, spec §3.7), and honoured
 *     `prefers-reduced-motion` because this is now an animating component
 *     (CONVENTIONS §11: the base carries no reduced-motion rule by design).
 *
 * RESPONSIVE BEHAVIOUR has no Slate answer (98.4% frozen) and the layout spec
 * governs: the bar is `w-full` at its one use site and stays that way — it
 * fills its container on both axes of the geometry matrix and reads NO viewport.
 * There is not a single width query in this file, per §2.1 Rule 1.
 *
 *   AND THE DEGENERATE CASE OF "FILLS ITS CONTAINER", because a consumer will
 *   meet it. The base puts `container-type: inline-size` on the host
 *   (CONVENTIONS §2: "the host's inline size can no longer depend on its
 *   contents"), so the host contributes ZERO to intrinsic sizing, and `.track`
 *   below is `inline-size: 100%` of the host. In a SHRINK-TO-FIT slot there is
 *   therefore nothing to fill and the bar renders 0 wide — present, correct,
 *   accessible and invisible. Measured at the bench geometry: a bare flex item,
 *   host 0 / track 0; a column flex with `align-items: flex-start`, host 0 /
 *   track 0; a grid cell with `justify-items: start`, host 0 / track 0. The one
 *   live use site survives on a default — settings.js:6247 is `flex flex-col`,
 *   whose `align-items` is `stretch` — so one word added there would silently
 *   remove the download bar.
 *
 *   STATED, NOT DEFENDED AGAINST, and there is nothing honest to defend with: a
 *   10px indicator cannot invent an inline size nobody gave it, and dropping the
 *   containment would not help either, since a 100%-wide child of a shrink-to-fit
 *   box is still 0. THE REMEDY IS ONE DECLARATION AT THE CALL SITE —
 *   `align-self: stretch` (or the column default), `flex-grow: 1` on a row, a
 *   width, a grid track. Both halves are pinned in
 *   test/render/ui-progress-track.render.test.mjs: "a bar TOLD to grow takes the
 *   leftover space" and "a bar given NOTHING to fill renders 0 wide".
 *
 * @property value  - progress in the author's own units, clamped to 0..max.
 * @property max    - the top of the range. Defaults to 1, the native <progress>
 *                    default, which is also the shape of the one live producer
 *                    (`state.progress` is a 0..1 fraction, settings.js:6195).
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';

/** 0..1, whatever arrives. */
const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** A fraction as a CSS percentage, without float noise. Mirrors ui-slider's. */
const pct = (fraction) => `${Number((clamp01(fraction) * 100).toFixed(3))}%`;

/** Numbers only; anything else is 0. */
const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

export class UiProgressTrack extends UiElement {
    static properties = {
        /** Progress in the author's units. Clamped to 0..max for both paint and aria. */
        value: { type: Number },
        /** Top of the range. Arrives from outside; a primitive never owns a limit. */
        max: { type: Number },
        /** Accessible name. A bar with no visible label MUST carry one. */
        label: { type: String },
        /** Human-readable value for a screen reader: "42%", "3 of 7". */
        valueText: { type: String, attribute: 'value-text' },
    };

    static styles = [
        /* No `hitArea`: a progressbar is not a hit target. CONVENTIONS §5 names the
         * utility's three consumers — #15 keycap, #23 slider, #35 favourite slot —
         * and this row cites neither Appendix 5 nor a hit floor. Padding a 10px
         * indicator out to 48px would put an invisible 48px-tall dead zone across
         * the width of a settings card and swallow presses meant for what is under
         * it.
         *
         * No `selectionSurface` either: this has a VALUE, not a selected state, so
         * none of the four dials applies — the same judgement ui-slider records. */
        css`
            /* ---------------------------------------------------------------
             * THE HOST — full width, exactly as the one use site asks
             * (settings.js:6240, class w-full). The base already gives :host
             * display:block and container-type:inline-size; nothing here reads
             * the container or the viewport, it simply fills what it is given.
             *
             * "What it is given" is the whole contract, and its degenerate case
             * is in the header under RESPONSIVE BEHAVIOUR: in a shrink-to-fit
             * slot the host has no inline size to fill and the bar is 0 wide.
             * That is the call site's declaration to make, not this file's, and
             * both halves are pinned by the rendering suite.
             * ------------------------------------------------------------- */
            :host {
                /* THE THICKNESS. Slate authors h-[10px] and 10px is not a token
                 * in styles/tokens.css. This component may not add one: tokens.css
                 * is a shared file and this wave has sixteen builders writing in
                 * parallel under whole-file writes, so a new token here is a
                 * clobber risk with no owner. So the 10 is DERIVED from tokens, in
                 * the idiom ui-slider already uses for its own un-tokenised 26px
                 * thumb (calc of --ui-icon plus two hairlines):
                 *
                 *     --ui-space-2 (8px) ... the ink of the ONE other filled track
                 *     in this library, where ui-slider sets --_ui-hit-ink to it
                 *     with the note "Two Slate sliders agree on 8px"
                 *   + 2 x --ui-hairline (1px) ... a hairline of trough each side
                 *   = 10px exactly, which is the measured source value.
                 *
                 * PRIVATE (--_ui-), so the token-integrity check that scans for
                 * var(--ui- cannot mistake it for a missing token, and it is a
                 * length and never a colour (CONVENTIONS §7). The reversal, if
                 * the wave ever wants the number named, is one token
                 * (--ui-progress-h: 10px) and one substitution below. */
                --_ui-progress-h: calc(var(--ui-space-2) + 2 * var(--ui-hairline));
            }

            /* ---------------------------------------------------------------
             * THE TROUGH — painted by CLASS, never an id (CONVENTIONS §4 rule 2:
             * ids are for tests to query by, classes are for the cascade).
             * ------------------------------------------------------------- */
            .track {
                display: block;
                inline-size: 100%;
                block-size: var(--_ui-progress-h);
                border-radius: var(--ui-radius);

                /* SOURCE slate-components.css:723-726 .slate-progress-track —
                 * border-radius from the slate radius token, background-color
                 * from the slate key-on token (both quoted verbatim in the file
                 * header). The one !important that rule carries is gone: nothing
                 * can reach into a shadow root, so there is nothing to out-rank
                 * (CONVENTIONS §6). Painted with the LONGHAND, which
                 * matters on any element whose ink is its background — the
                 * background shorthand resets background-clip and that is what
                 * turned a track into a 32px slab in Slate's own sheet
                 * (slate-live.css:1565-1567). */
                background-color: var(--ui-key-on);

                /* clip, not hidden. Slate writes overflow-hidden here to square
                 * off the fill against the rounded trough, and clipping IS wanted
                 * — but overflow:hidden makes a scroll container, and spec §2.4
                 * asks every scroll region to declare a floor and a visible
                 * scrollbar. This region can never scroll (the fill is capped at
                 * 100%), so the honest spelling is the one that clips without
                 * pretending to scroll. Nothing focusable lives inside, so this
                 * cannot clip a focus ring the way bug L24 describes: the ring
                 * belongs to the HOST, which is outside this box. */
                overflow: clip;
            }

            /* ---------------------------------------------------------------
             * THE FILL. Flow-relative on purpose: inline-size and the inline
             * start edge mean an RTL locale fills from the right with no second
             * rule and no transform.
             * ------------------------------------------------------------- */
            .fill {
                display: block;
                block-size: 100%;
                inline-size: var(--_ui-progress-at, 0%);

                /* DEPARTURE 1 — --ui-steel, not --ui-primary. The header carries
                 * the full argument and the numbers; in one line: the oracle
                 * measures --ui-steel as the fill of this skin's other filled
                 * track in BOTH themes (live-ready #shot-rating-slider [i=157]),
                 * while Slate's .slate-accent-bg fill gives 1.11:1 against this
                 * trough in dark. One word to revert. */
                background-color: var(--ui-steel);

                /* SOURCE settings.js:6240 — transition-[width] duration-200.
                 * 200ms is --ui-dur-slow (spec §3.7). Logical property, so the
                 * animation is the same one in RTL. */
                transition: inline-size var(--ui-dur-slow) var(--ui-ease);
            }

            /* CONVENTIONS §11 — the base deliberately carries no reduced-motion
             * rule and says it "belongs in styles/document.css or in each
             * animating component". This is now an animating component (departure
             * 4). Not a width query: §2.1 Rule 1 bans a component reading the
             * VIEWPORT, and this reads a user preference. */
            @media (prefers-reduced-motion: reduce) {
                .fill {
                    transition-duration: 0s;
                }
            }
        `,
    ];

    constructor() {
        super();
        this.value = 0;
        this.max = 1;
        this.label = '';
        this.valueText = '';
    }

    /**
     * The single sanitised reading of the range, used by BOTH the paint and the
     * aria attributes. One state, two readers — accessibility state and visual
     * state are the same state, so they cannot drift (spec Appendix 15).
     */
    get #reading() {
        const max = num(this.max);
        // A non-positive or non-finite range is degenerate: report zero rather
        // than dividing by it, and say the same thing to a screen reader.
        const top = max > 0 ? max : 0;
        const value = Math.min(Math.max(num(this.value), 0), top);
        return { top, value, fraction: top > 0 ? clamp01(value / top) : 0 };
    }

    connectedCallback() {
        super.connectedCallback();
        // Set once, and only if the author has not chosen otherwise.
        if (!this.hasAttribute('role')) this.setAttribute('role', 'progressbar');
    }

    /**
     * Appendix 15's contract, written in one place on every update so the aria
     * numbers and the painted width cannot disagree. aria-valuemin is the
     * constant 0 that #reading clamps to.
     */
    updated(changed) {
        super.updated(changed);
        const { top, value } = this.#reading;
        this.setAttribute('aria-valuemin', '0');
        this.setAttribute('aria-valuemax', String(top));
        this.setAttribute('aria-valuenow', String(value));
        if (this.valueText) this.setAttribute('aria-valuetext', this.valueText);
        else this.removeAttribute('aria-valuetext');
        // Only ever ADD a name: an author who wrote aria-label or aria-labelledby
        // on the host keeps it, which is how the settings panel points this at its
        // own "App Update" heading.
        if (this.label) this.setAttribute('aria-label', this.label);
    }

    render() {
        /* No <slot>: the bar is a leaf and its label is a sibling in the light
         * DOM (the status line at settings.js:6255), which is also what lets
         * aria-labelledby reach it.
         *
         * aria-hidden on both boxes: the accessible object is the HOST, and a
         * div announcing itself inside a progressbar is noise. */
        return html`
            <div class="track" aria-hidden="true">
                <div class="fill" style="--_ui-progress-at:${pct(this.#reading.fraction)}"></div>
            </div>
        `;
    }
}

customElements.define('ui-progress-track', UiProgressTrack);
