/**
 * editor-preview.js — <editor-preview>, the profile editor's preview chart.
 * SCOPE Part 5 §5 "Components" ("chart card (preview)") and "Bugs this screen must not
 * reproduce" (E12, chart-C5, chart-C6); wave 5.5 (wf-w5p5-editor), row `chart-preview`.
 *
 * ===========================================================================
 * IT IS A #9 INSTANCE. THERE IS NO PLOT IN THIS FILE.
 * ===========================================================================
 * chart-C6: "every chart lives in a chart card, and the guard lists them all". So this
 * element renders exactly one `<ui-chart-card>` and owns no canvas, no uPlot, no axis,
 * no legend and no colour. A private plot here would be the second chart implementation
 * that item exists to forbid, and the suite counts it: every canvas in the mounted
 * editor must have a `ui-chart-card` ancestor.
 *
 * chart-C5: the old preview restated the palette as six hex literals. There is not one
 * colour in this file — #9 reads `styles/chart-channels.css` through `chart-tokens.js`
 * (A6) and this element does not name a channel colour at all. The two CHANNELS it
 * draws are `PREVIEW_CHANNEL_KEYS`, imported from the module that produces the data, so
 * the key list is not spelled twice either.
 *
 * ===========================================================================
 * THE DATA PATH, AND WHY IT IS A CALL RATHER THAN A BINDING  (E12)
 * ===========================================================================
 * §7.4 E12: "The Review chart is destroyed and rebuilt on every ± press, numpad commit
 * and mode change — ~20 call sites — with no `activeTab` guard, so while the Steps tab
 * is showing it allocates a fresh 1×1 canvas per edit" (`profile_editor.js:3056-3057`).
 *
 * Two halves, and #9 already provides the first: `showDerivation(d)` is an IN-PLACE
 * update. Underneath it `plot-surface.js:747` calls `plot.setData(data, xRange)` — a
 * DATA change is a setData and never a construction. A rebuild happens on a THEME change
 * (uPlot bakes axis and grid colours in at construction) or on a channel change, and on
 * nothing else. So an edit costs one `setData`, which is what the suite counts through
 * the card's own `buildCount` / `paintCount`.
 *
 * THE SECOND HALF IS THE MISSING `activeTab` GUARD, and it is built here as an
 * OBSERVATION rather than as a second owner of visibility. #32 `ui-tab-bar` owns which
 * panel is showing and expresses it as `hidden` + `inert`; this element never reads a
 * tab, never reads a panel and never writes either. It asks the ENGINE whether it has a
 * rendered box — `checkVisibility()`, which is false inside a `display: none` subtree —
 * and while the answer is no it holds the derivation instead of feeding it. Nothing is
 * lost: the latest derivation is fed the moment a box appears, which a ResizeObserver on
 * this host reports (0 → a size).
 *
 * WHY THAT IS NOT E8's CLASS. E8 is a layout value computed in JavaScript and consulted
 * by nothing. No layout is computed here: the observer gates a DATA feed, the card owns
 * its own box, and the proof is behavioural — N edits while hidden move the card's paint
 * count by zero, and showing the panel again paints the LATEST data.
 *
 * A HIDDEN CARD IS NEVER FED, SO IT IS NEVER BUILT AT ZERO SIZE BY AN EDIT. `setChannels`
 * is the call that constructs the plot and it arrives with the first derivation, which is
 * to say on the first frame this element actually has a box. That is the whole of Slate's
 * "fresh 1×1 canvas": the old preview built into a hidden tab and got the size of a box
 * that was not there.
 *
 * THE DATA PATH IS NOT THE ONLY REBUILD TRIGGER, AND THE GUARD ABOVE ONLY COVERS IT.
 * #9's other one is a THEME change — uPlot bakes axis and grid colours in at construction
 * — and it arrives at the card directly, through the surface's own MutationObserver on
 * the document root, without passing through this element at all. MEASURED, before it was
 * gated: on the Steps tab with the preview hidden, one `setTheme` moved the card's
 * buildCount 2→3 and paintCount 3→4 and left the canvas at 2×2 device / 0×0 CSS px —
 * §7.4 E12's "fresh 1×1 canvas", down the theme path. So the gate lives where the
 * rebuild does (`plot-surface.refreshPalette`, `hasRenderedBox`), in the same shape as
 * the gate here: hold it while there is no box, apply it when one appears. The claim
 * this element may make is therefore the SCOPED one — no rebuild and no paint from an
 * edit while hidden, and no rebuild from a retheme while hidden — and not "a background
 * tab does not render at all", which the MOUNT still contradicts: the card's first build
 * runs from its own mount even on a hidden tab, and that construction is
 * `c-editing-surfaces-8`'s subject, not this one's.
 *
 * ===========================================================================
 * WHERE THE CURVES COME FROM
 * ===========================================================================
 * `profile-preview.js` `profilePreviewDerivation(profile)` — wave 5.3's producer for a
 * profile that has never been run, already composed from `profile-modes.js`
 * `stepTargetOverlay`. This file derives nothing: a second producer would be a second
 * answer to "what does a Power step command?".
 *
 * A REFUSAL IS NOT AN EMPTY CHART. `emptyProfilePreview(reason)` keeps the axes and
 * carries a reason, and the card paints the slotted refusal over them (#9's own rule).
 * The reason is reported, never guessed at: a draft with no steps says so.
 *
 * ===========================================================================
 * ONE OWNER PER DIMENSION
 * ===========================================================================
 * This element declares no height for the chart. #9's floor is its own
 * (`--ui-chart-min-h` + the card's chrome) and the row it sits in is `auto`, so the card
 * asks for its floor and gets it. There is no `min-content` anywhere near the plot host
 * — #9 records that trap in its own file — and no `overflow: hidden`, which is what made
 * chart-C3's 32px overflow invisible in Slate.
 *
 * D2: the label and the refusal wording are values read through I18nController.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';
import {
    PREVIEW_CHANNEL_KEYS,
    PREVIEW_REFUSAL,
    emptyProfilePreview,
    profilePreviewDerivation,
} from 'src/lib/profile-preview.js';
/* THE CURSOR'S OTHER HALF (audit F-032). The card has emitted `cursor-change` since wave
 * 3 and nothing has ever listened: measured on this very element, the cursor part tracked
 * the pointer while its text and the foot slot stayed empty at every position, so a drag
 * moved a line and named no number. `chart-readout.js` owns the rounding and the units. */
import { readoutLine, readoutTerms } from 'src/lib/chart-readout.js';

/* THE CHART — a library component, composed. A hand-built plot here is scope invention
 * (Part 10 §9) and chart-C6's own defect. */
import 'src/components/ui-chart-card.js';

/** The refusal sentence for each reason `profile-preview.js` can report. */
const REFUSAL_TEXT = Object.freeze({
    [PREVIEW_REFUSAL.NO_PROFILE]: 'No profile to preview',
    [PREVIEW_REFUSAL.NO_STEPS]: 'This profile has no steps yet',
    [PREVIEW_REFUSAL.NO_DURATION]: 'Every step is zero seconds long, so there is no curve to draw',
});

/**
 * WHAT THE TWO PREVIEW CHANNELS ARE CALLED IN THE READING.
 *
 * `PREVIEW_CHANNEL_KEYS` is `targetPressure` / `targetFlow` — the profile's PLAN, which is
 * the only thing a profile that has never been run has. On this card the plan is the whole
 * of what is drawn, so the words are the plain quantities rather than "Target …": there is
 * nothing here for them to be a target OF.
 *
 * THE TIME HAS NO LABEL. "4.2 s" says what it is, and it is the last term of the line.
 */
const TERM_LABELS = Object.freeze({
    targetPressure: 'Pressure',
    targetFlow: 'Flow',
});

export class EditorPreview extends UiElement {
    static properties = {
        /**
         * THE DRAFT, READ AND NEVER WRITTEN. The profile shape ReaPrime serves
         * (`{title, steps, …}`). Every edit hands this element a new draft object and
         * that is the whole of the update: no per-field API, no partial patch.
         */
        profile: { attribute: false },

        /** The chart's accessible name (D2 — a value, not an IDREF across a root). */
        label: { type: String },

        /**
         * WHERE THE POINTER IS ON THE PREVIEW — the card's own frozen `cursor-change`
         * detail, or null.
         *
         * Internal state, and the DETAIL is held rather than the words: the sentence is
         * composed at render time, so the language controller re-composes it on a language
         * change without the cursor having to move.
         */
        _cursor: { state: true },
    };

    static styles = [css`
        /* NO BACKTICK IN THIS TEMPLATE, comment or not: one ends the tagged template
         * where it stands and the file stops parsing as JavaScript some way further on.
         *
         * A BLOCK AND NOTHING ELSE. The card's floor is the card's; a block-size here
         * would be a second owner of the one dimension #9 already owns (§2.3, E15). */
        :host {
            display: block;
            min-inline-size: 0;
        }

        ui-chart-card {
            display: block;
            min-inline-size: 0;
        }

        /* THE READING THE SCRUB PUTS ON THE CARD (audit F-032).
         *
         * ITS HEIGHT IS RESERVED WHETHER OR NOT IT HAS WORDS, and that is the difference
         * between a readout and a jolt: text appearing on pointerdown would take its own
         * height out of the plot underneath the finger reading it, and the card's
         * ResizeObserver would resize the canvas mid-drag. One line of caption type
         * (--ui-text-note at the 1.5 ratio type-roles.js sets), stated the way tokens.css
         * states every other one-line reserve.
         *
         * IT DOES NOT TOUCH THE CARD'S FLOOR. This element states no height for the chart
         * — that is #9's, and it stays #9's; this rule sizes a slotted child inside the
         * card's own foot row, which the card's grid has always had. */
        .reading {
            display: block;
            min-block-size: calc(var(--ui-text-note) * 1.5);
            font-size: var(--ui-text-note);
            line-height: 1.5;
            /* It starts where the DATA starts: uPlot keeps a gutter for the axis labels
             * and this tree states it as a token, so a reading beginning at the card's
             * edge would sit 70px left of the first gridline. */
            padding-inline-start: var(--ui-chart-gutter-l);
            color: var(--ui-muted);
        }
    `];

    #i18n = new I18nController(this);

    /** The derivation for the current draft. Recomputed only when the draft moves. */
    #derivation = null;

    /** Was there a feed we could not make because there was no box? */
    #pending = false;

    /** Reports 0 -> a size, which is a hidden panel becoming the showing one. */
    #resize = null;

    constructor() {
        super();
        this.profile = null;
        this.label = 'Profile preview';
        this._cursor = null;
    }

    connectedCallback() {
        super.connectedCallback();
        if (typeof ResizeObserver !== 'undefined' && !this.#resize) {
            this.#resize = new ResizeObserver(() => this.#onBox());
            this.#resize.observe(this);
        }
    }

    disconnectedCallback() {
        this.#resize?.disconnect();
        this.#resize = null;
        super.disconnectedCallback?.();
    }

    /** The card, for a consumer that wants to ask it what it drew. Read-only. */
    get card() {
        return this.renderRoot?.querySelector?.('#card') ?? null;
    }

    /**
     * Does this element have a rendered box? The ENGINE's answer, not a tab's:
     * `checkVisibility()` is false inside a `display: none` subtree, which is what
     * ui-tab-bar's `hidden` produces on a panel that is not showing.
     */
    get rendered() {
        if (!this.isConnected) return false;
        if (typeof this.checkVisibility === 'function') return this.checkVisibility();
        return Boolean(this.offsetParent);
    }

    /** True while a derivation is held back because there was nothing to draw into. */
    get deferred() { return this.#pending; }

    /** The derivation currently held, fed or not. The suite reads it; nothing writes it. */
    get derivation() { return this.#derivation; }

    willUpdate(changed) {
        super.willUpdate?.(changed);
        if (changed.has('profile')) this.#derive();
    }

    updated(changed) {
        super.updated?.(changed);
        this.#feed();
    }

    render() {
        const t = this.#i18n.t;
        const reason = this.#derivation?.ok ? null : this.#derivation?.reason;
        return html`
            <ui-chart-card
                id="card"
                part="card"
                label=${t(this.label)}
                scrub-label=${t('{name} scrub', { name: t(this.label) })}
                @cursor-change=${this.#onCursor}
            >
                <span slot="empty">${t(REFUSAL_TEXT[reason] ?? REFUSAL_TEXT[PREVIEW_REFUSAL.NO_PROFILE])}</span>
                <!-- THE READING (audit F-032). The card has always emitted the numbers it
                     drew at the cursor's own index; this is the first thing to print
                     them. It is a live region because the strip is the only place they
                     appear, so a reader who cannot see the plot still gets the answer. -->
                <span
                    slot="foot"
                    part="reading"
                    class="reading"
                    role="status"
                    aria-live="polite"
                    >${this.#reading(t)}</span
                >
            </ui-chart-card>
        `;
    }

    /**
     * THE SENTENCE THE FOOT PRINTS — the planned value at the instant under the pointer,
     * and the second it is at. Empty at rest, which is what clears it on release.
     */
    #reading(t) {
        const words = {};
        for (const [key, label] of Object.entries(TERM_LABELS)) words[key] = t(label);
        return readoutLine(readoutTerms(this._cursor, PREVIEW_CHANNEL_KEYS), words);
    }

    /**
     * The card's cursor moved. The DETAIL is held; `#reading` composes it.
     *
     * NO GUARD ON THE TARGET, because this element renders exactly one chart card and
     * says so in its own header ("there is no plot in this file" — a second one would be
     * chart-C6's defect). The listener is bound on that card.
     */
    #onCursor = (event) => {
        this._cursor = event.detail;
    };

    /**
     * The draft's curves. One producer, and it is `profile-preview.js` — this file
     * neither reads a step nor decides what a mode commands.
     */
    #derive() {
        this.#derivation = this.profile
            ? profilePreviewDerivation(this.profile)
            : emptyProfilePreview(PREVIEW_REFUSAL.NO_PROFILE);
        this.#pending = true;
    }

    /**
     * Hand the card what it should be showing, IF there is anything to show it into.
     *
     * `channelKeys` is set to the same frozen array every time, so Lit sees no change
     * after the first feed and the plot is constructed exactly once — a rebuild costs a
     * uPlot construction and E12 is the bug where that happened per keypress.
     */
    #feed() {
        const card = this.card;
        if (!card || !this.#derivation) return;
        if (!this.rendered) { this.#pending = true; return; }
        this.#pending = false;
        card.channelKeys = PREVIEW_CHANNEL_KEYS;
        card.showDerivation(this.#derivation);
    }

    /** A box appeared (or changed). Feed anything held back while there was none. */
    #onBox() {
        if (this.#pending) this.#feed();
    }
}

customElements.define('editor-preview', EditorPreview);
