/**
 * ui-confirm-dialog.js — component #19 of the 57-component inventory: THE CONFIRM.
 *
 * Wave 4, item #19 (SCOPE Part 4, "Wave 4 — dialog bodies and screen compounds"), the
 * row verbatim:
 *
 *   "Confirm dialog | Question + destructive/affirmative pair. Never existed
 *    (`DECISIONS.md:251`); the selector's DaisyUI `.modal` stand-ins currently leave
 *    16 focusables reachable inside closed dialogs (P13). | small | #18, #1"
 *
 * `DECISIONS.md:249-251`, the founding sentence: "Component library primitives that
 * never existed: slider, tile, CONFIRM DIALOG, nav row, list row, toast." So there is
 * nothing to port. What exists is four hand-rolled DaisyUI `.modal`s on the profile
 * selector, and this file is measured against them rather than copied from them.
 *
 * THIS IS CONTENT, NOT MACHINERY. Part 10 §12 (wf-w5p2-overlays): "#18/#53/#54/#55
 * already exist from w3/w4; this phase integrates and proves, it does not construct."
 * Every scrim, focus trap, `inert` mark, Escape arbitration and top-layer paint below
 * belongs to `ui-dialog.js` (#18) and none of it is re-implemented here — a second
 * modal machinery is the whole of O6 and is a wave block. The two buttons are #1.
 *
 * Token-only: no store, no endpoint, no server key, no address-layer read. A confirm
 * takes a question it was handed; it does not know what the question is about.
 *
 * ---------------------------------------------------------------------------
 * THE ORACLE, AND WHY IT IS DISQUALIFIED AS A TARGET WHILE STILL BEING THE EVIDENCE
 *
 * prov_query.py prints the disqualification banner before any answer: an element on
 * the 140 layout bugs has no vote, because "matching Slate there reproduces the bug".
 * Slate's confirms are P13 itself, so every number below is quoted as WHAT SLATE DOES
 * — the defect measured — and only the two type answers are carried across.
 *
 *   prov_query.py find --cls slate-dialog       -> 0 elements in 0 of 49 states
 *   prov_query.py find --cls slate-modal        -> 0 elements in 0 of 49 states
 *   prov_query.py find --cls modal-action       -> 0 elements in 0 of 49 states
 *   prov_query.py find --cls modal-box          -> 56 elements in 49 of 49 states
 *
 * That last line IS P13, counted. `.modal-box` is the DaisyUI card inside a CLOSED
 * `<dialog>`, and the corpus finds one in every state of the app because the closed
 * dialogs lay themselves out on every screen. In the selector, five of them:
 *
 *   CITE profile-selector .modal-box [i=191] <div class="modal-box bg-[var(--box-color)]
 *        max-w-[500px] rounded-[20px] p-8 flex flex-col gap-6"> text "Reset profile?
 *        KEEP Reset"  rect x=735 y=454 w=450 h=205
 *   ...and [i=196] 450x277, [i=202] 405x309, [i=210] 405x261, [i=217] 461x155.
 *
 * A closed dialog with a 450x205 rect is the bug in one line. [i=191] is this
 * component's subject exactly — a question and a destructive/affirmative pair — and
 * its two controls are:
 *
 *   CITE profile-selector #reset-profile-cancel [i=193] <button class="h-[60px] px-8
 *        border-2 border-[var(--mimoja-blue)] text-[var(--mimoja-blue)] font-bold
 *        rounded-[15px] text-[18px]"> text "KEEP"  rect x=937 y=572 w=100 h=58
 *   CITE profile-selector #reset-profile-confirm [i=194] <button class="h-[60px] px-8
 *        bg-red-400 text-white font-bold rounded-[15px] text-[18px]"> text "Reset"
 *        rect x=1052 y=572 w=103 h=58
 *   CITE profile-selector #reset-profile-confirm [i=194] background-color =
 *        rgb(248, 113, 113)  <-  app.css `.bg-red-400` authored
 *        `rgb(248 113 113/var(--tw-bg-opacity,1))` !important=no (FROZEN/hardcoded)
 *
 * The destructive action's fill is a RAW TAILWIND LITERAL, not `--slate-danger`, in a
 * skin whose component layer already has a `.slate-btn-danger`. That is O6's "four
 * hand-rolled button implementations" reaching five, and it is why the row's
 * dependency list is "#18, #1": the pair is two `ui-button`s, tone selected by a
 * property, and the literal cannot be expressed.
 *
 * TWO ANSWERS ARE CARRIED, and both are the question's type:
 *
 *   CITE profile-selector .font-bold [i=192] <h3 class="font-bold text-[28px]
 *        text-[var(--text-primary)]"> text "Reset profile?"  rect x=765 y=484 w=391 h=38
 *   CITE profile-selector .font-bold [i=192] font-size = 28px  <-  app.css
 *        `.text-\[28px\]` authored `28px` !important=no (FROZEN/hardcoded)
 *                                                  = --ui-text-xl, via .ui-title
 *   CITE profile-selector .font-bold [i=192] color = rgb(244, 247, 248)  <-
 *        slate-shell.css `#subpage-host .modal-box :is(h2, h3)` authored
 *        `var(--slate-text)` !important=yes (token-driven)
 *                                                  = --ui-text, via .ui-title
 *
 * The ink was already a token and the size was already 28px; only the SIZE's spelling
 * changes, from a Tailwind literal to `--ui-text-xl` through the `.ui-title` role
 * (`TYPE_ROLES.md`). Both are drilled in the suite, because a literal 28px and a
 * token 28px photograph identically — the same argument O10 makes for the numpad.
 *
 * Geometry is NOT carried: the rects above are Slate at 1920x1200 and the tool says
 * so on every answer — "FROZEN — quote it as what Slate does, never as Decal's
 * responsive target (LAYOUT_SPEC_DRAFT.md governs responsive behaviour)".
 *
 * ---------------------------------------------------------------------------
 * THE DEFECT THIS COMPONENT RETIRES, and how it becomes inexpressible
 *
 *   P13 — "Closed dialogs stay in the tab order: DaisyUI's `.modal` sets
 *         `display: grid; opacity: 0` with no `visibility: hidden`, defeating the
 *         UA's `dialog:not([open]) { display: none }`. Measured 16 FOCUSABLES INSIDE
 *         `dialog:not([open])` out of 30 on the page." (§7.7 P13, generated app.css;
 *         `layout/selector.md` V.2)
 *
 * The mechanism that kills it is not a stronger rule — it is that this component
 * owns no display declaration for the dialog box at all. #18 puts the layout on
 * `.dialog[open]` (ui-dialog.js:449-452) precisely so the UA sheet's
 * `dialog:not([open]) { display: none }` is never contradicted, and #19 adds nothing
 * that could contradict it: its two buttons are children of that same box. Four
 * closed confirms therefore contribute FOUR zero-area boxes and ZERO focusables,
 * against Slate's five laid-out cards and sixteen reachable controls.
 * `test/render/ui-confirm-dialog.render.test.mjs` mounts the selector's four and
 * counts, at both geometries.
 *
 * P8 gets a mirror here rather than a second owner. "#confirm-profile-btn — the one
 * affirmative action on the screen — has no primary treatment; measured transparent,
 * identical to Cancel beside it" is #1's row to retire, but #19 is where an
 * affirmative action can go missing by omission, so `tone` selects the variant and
 * the suite drills both fills to their tokens.
 *
 * ---------------------------------------------------------------------------
 * THE SHAPE: TWO TRACKS, NOT THREE — and #18 wrote the reason down first
 *
 * ui-dialog.js:433-436, unprompted: "§4.6's three-row template is the case where all
 * three cells exist; A CONFIRM DIALOG WITH NO HEADER would otherwise keep an empty
 * 0px track AND the seam gap above it, which draws a hairline against nothing at the
 * top of the card."
 *
 * So the question is not a `heading` on the shell. It is the first thing in the BODY,
 * as a real `<h2>` carrying `.ui-title` — which is what Slate does too ([i=192] is an
 * `<h3>` inside the card, with no header band above it). The card is:
 *
 *     body     question + optional detail + slotted extras     1fr, scrolls
 *     ----     one --ui-seam gap, drawn by the grid
 *     actions  cancel, then confirm                            auto
 *
 * The dialog's ACCESSIBLE NAME is the same string, passed as `label`. An IDREF cannot
 * cross a shadow boundary, so `aria-labelledby` pointing at the `<h2>` is not
 * available; #18 met the identical wall for its own heading and settled it the same
 * way — "the name is the same STRING that is on screen rather than a pointer at it"
 * (ui-dialog.js:670-672). The cost is that AT announces the question twice, once as
 * the dialog's name and once as the heading; the alternative is an unnamed modal,
 * which is worse.
 *
 * THE CARD IS NARROWER THAN THE SHELL'S DEFAULT, and that is a body's call to make.
 * #18 defaults `--_ui-dialog-inline` to 820px, which is the NUMPAD's intrinsic width
 * (SOURCE numpad-modal.css:13), and documents the knob: "A screen that wants a
 * narrower dialog writes one line." A confirm is one line of question and two
 * buttons; Slate's four cards are `max-w-[500px]` and `max-w-[450px]` authored. This
 * file therefore states 500px — the AUTHORED cap, not the 450 measured rect, because
 * the rect is frozen 1920x1200 geometry the tool forbids as a target.
 *
 * It is written as `var(--_ui-confirm-inline, 500px)` on the `ui-dialog` ELEMENT
 * rather than on `:host`, and both halves matter. On the element, because a
 * declaration in the outer tree beats the inner tree's own `:host` rule for normal
 * declarations (CSS Scoping §3.3) — #18 MEASURED this: "ui-dialog
 * { --_ui-dialog-inline: 4000px } from the light DOM moved nothing at all until
 * these two moved up here". Through a var() with a fallback rather than a second
 * `:host` declaration, because that leaves the knob open: a screen writes
 * `ui-confirm-dialog { --_ui-confirm-inline: 720px }` and it inherits in, with
 * nothing here to beat it.
 *
 * ONE CONSEQUENCE, DELIBERATELY NOT FOUGHT: at 500px the shell's own container query
 * fires (ui-dialog.js:610-616, "the one breakpoint §4.6 keeps"), so a confirm's cell
 * inset is --ui-space-4 rather than --ui-space-5. That is the shell's rule applying
 * to a narrow card, not an accident, and it cannot be overridden from out here in any
 * case: `.cell`'s own declaration inside the query beats an inherited value.
 *
 * ---------------------------------------------------------------------------
 * ESCAPE MEANS KEEP. The safe default is structural, not a rule:
 *   - the pair is authored cancel-first, so #18's "first tabbable" open focus
 *     (ui-dialog.js:928) lands on the way out and never on the destructive action;
 *   - any dismissal that is not a press on the affirmative action reports `cancel`,
 *     whether it came from the button, Escape, the backdrop or `hide()`. One
 *     outcome path, so a dialog cannot close ambiguously.
 * A consumer that must refuse dismissal keeps #18's cancellable `close-request`.
 *
 * ---------------------------------------------------------------------------
 * API
 *   <ui-confirm-dialog
 *       question="Reset profile?"          the h2, and the dialog's accessible name
 *       detail="Extractamundo Dos! returns to the version that shipped."
 *       tone="destructive"                 'affirmative' (default) | 'destructive'
 *       cancel-label="KEEP" confirm-label="Reset"
 *       level="2"                          1..6, the question's heading level
 *       open>
 *     <p>anything else the body needs</p>   the default slot, under the detail
 *   </ui-confirm-dialog>
 *
 *   show({invoker, reason}) / hide(reason) / requestClose(reason)
 *   confirm(reason) / cancel(reason)     the two outcomes, callable
 *   dialog / confirmButton / cancelButton   the composed parts, for a screen that
 *                                           needs the platform object
 *
 *   events  confirm  {reason}  CANCELLABLE — preventDefault keeps the dialog open,
 *                              which is how an async action shows progress before
 *                              closing. Same idiom as #18's close-request.
 *           cancel   {reason}  a REPORT of a dismissal that was not a confirm.
 *                              Not the native <dialog> `cancel` event: that one is
 *                              neither bubbling nor composed, so it never leaves
 *                              #18's shadow root (ui-dialog.js:1160).
 *           close-request / open-change pass through from #18 unchanged.
 *
 *   --_ui-confirm-inline   the card's intrinsic width, default 500px
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   - NO HEADER, therefore NO CLOSE GLYPH. A confirm states its two ways out; a
 *     third one in the corner is a way out with no stated meaning. Slate's confirm
 *     has none either ([i=191] holds exactly a question and two buttons).
 *   - NO `persistent` / `dismissible` ATTRIBUTE. #18's cancellable `close-request`
 *     already covers it and covers the case an attribute cannot (refuse only while
 *     the work is in flight).
 *   - NO ICON, NO TONE COLOUR ON THE CARD. Tone is the action's paint, exactly as
 *     ui-toast settled it: "tone is ink and edge, not a saturated fill".
 *   - NO SELECTION TREATMENT. Nothing here is selectable, so the four dials are
 *     untouched — asserted as a negative drill, because a component that quietly
 *     grew a fifth selection idiom is the decay #3 exists to stop.
 *   - NO STRING TABLE. The two default labels go through src/lib/i18n.js (D2), whose
 *     key IS its English text; everything else is the consumer's already-translated
 *     text, the same law ui-toast and ui-alert-banner state.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import { SHEET_HEADING_LEVELS, DEFAULT_LEVEL } from 'src/components/ui-sheet-header.js';
import 'src/components/ui-dialog.js';
import 'src/components/ui-button.js';

/**
 * The two tones, and they are the row's own words: "question + DESTRUCTIVE /
 * AFFIRMATIVE pair". Not a colour name and not a variant name — the same string is
 * true whatever `--ui-status-danger` is set to.
 */
export const CONFIRM_TONES = Object.freeze(['affirmative', 'destructive']);

/** Affirmative, because the destructive treatment must be asked for. */
export const DEFAULT_TONE = 'affirmative';

/** tone -> the #1 variant that paints it. One place, so the mapping cannot drift. */
const TONE_VARIANT = Object.freeze({
    affirmative: 'primary',
    destructive: 'danger',
});

export class UiConfirmDialog extends UiElement {
    static properties = {
        /** Reflected: the gallery declares an open confirm in static markup, and a
         *  screen styles around one. Mirrors the shell's own `open` in both
         *  directions — see #onOpenChange. */
        open: { type: Boolean, reflect: true },
        /** The question. The h2 in the body AND the dialog's accessible name. */
        question: { type: String },
        /** One line of consequence under it. Optional; most confirms have one. */
        detail: { type: String },
        /** The affirmative action's label. Defaults to t('Confirm'). */
        confirmLabel: { type: String, attribute: 'confirm-label' },
        /** The way out's label. Defaults to t('Cancel'). */
        cancelLabel: { type: String, attribute: 'cancel-label' },
        /** 'affirmative' | 'destructive'. Reflected so a screen can see the tone it
         *  asked for, and so the suite can read it back. */
        tone: { type: String, reflect: true },
        /** 1..6 for the question's heading element. */
        level: { type: Number, reflect: true },
    };

    static styles = [typeRoles, css`
        /* ---------------------------------------------------------------
         * THE HOST HAS NO BOX, for #18's reason word for word: "a host with the
         * base's display: block would leave a full-width, zero-height block in the
         * middle of somebody's grid — an invisible row that moves their layout by
         * one gap" (ui-dialog.js:334-345). A confirm is written wherever the screen
         * that owns it is written, which is rarely where anything should be laid
         * out. container-type follows it back to normal: a box that does not exist
         * cannot be a container, and everything in here reads THE DIALOG's box,
         * which is the container §4.6 names.
         * ------------------------------------------------------------- */
        :host {
            display: contents;
            container-type: normal;
        }

        /* The card's intrinsic width. On the element, not on :host, and through a
         * var() with a fallback — see "THE CARD IS NARROWER" in the header for why
         * both halves are load-bearing. 500px is Slate's own authored cap:
         * ORACLE profile-selector .modal-box [i=191] class max-w-[500px]. */
        ui-dialog {
            --_ui-dialog-inline: var(--_ui-confirm-inline, 500px);
        }

        /* The body is a stack. --ui-space-4 is the rhythm ui-empty-state.js:339
         * already uses between a title and its prose; the distance from the question
         * to the buttons is not set here at all — it is the cell inset, the seam and
         * the next cell's inset, which is 18 + 1 + 18 at this card width. */
        .body {
            display: grid;
            gap: var(--ui-space-4);
        }

        /* Capped for the same reason .ui-caption is (TYPE_ROLES.md): a screen that
         * widens the card must not get a 900px line of prose. Inert at the default
         * width, which is the point — the cap is for the case that is not default. */
        .detail {
            max-inline-size: var(--ui-measure);
        }
    `];

    /** Which outcome closed the dialog. Read once, in #onOpenChange, so that every
     *  dismissal reports exactly one event and a confirm never also reports a
     *  cancel. */
    #outcome = null;

    constructor() {
        super();
        this.open = false;
        this.question = '';
        this.detail = '';
        this.confirmLabel = '';
        this.cancelLabel = '';
        this.tone = DEFAULT_TONE;
        this.level = DEFAULT_LEVEL;
        /** The element focus returns to. A plain field, exactly as #18 keeps its
         *  own: it is not paint, so it is not reactive. */
        this.invoker = null;
        /** Re-renders on a language change; unsubscribes on disconnect
         *  (src/lib/i18n.js). Same wiring as #31. */
        this.i18n = new I18nController(this);
    }

    /* ---- the composed parts -------------------------------------------------- */

    /** The #18 instance. Public because a screen may need the shell's own API —
     *  `requestClose`, the `dialog` platform object underneath it — and because a
     *  test should read the machinery rather than infer it. */
    get dialog() {
        return this.renderRoot?.querySelector?.('#dialog') ?? null;
    }

    /** The affirmative action. Public so a screen can `focus()` it — #1 forwards
     *  focus inward, which is P8's own screen (ui-button.js:130-132). */
    get confirmButton() {
        return this.renderRoot?.querySelector?.('#confirm') ?? null;
    }

    /** The way out. */
    get cancelButton() {
        return this.renderRoot?.querySelector?.('#cancel') ?? null;
    }

    /** True when the affirmative action carries the destructive treatment. */
    get destructive() {
        return this.tone === 'destructive';
    }

    /** The labels, resolved. The key IS the English text (i18n/source/README.md), so
     *  an unloaded store still answers with a usable word. */
    get confirmText() {
        return this.confirmLabel || this.i18n.t('Confirm');
    }

    get cancelText() {
        return this.cancelLabel || this.i18n.t('Cancel');
    }

    /* ---- the public surface -------------------------------------------------- */

    /**
     * Open. Forwarded to the shell so the RESTORE TARGET is captured there, at open
     * time — "by the time anything closes, the caret is inside the dialog and the
     * element that opened it is unknowable" (ui-dialog.js:699-702).
     */
    show({ invoker = null, reason = 'api' } = {}) {
        if (invoker) this.invoker = invoker;
        const dialog = this.dialog;
        if (dialog) {
            dialog.show({ invoker: this.invoker, reason });
            return;
        }
        /* Before the first render there is no shell yet: the property opens it, and
         * #18's declarative path captures its own restore target (ui-dialog.js:866). */
        this.open = true;
    }

    /** Close. Reports `cancel` unless a confirm is in flight — see #onOpenChange. */
    hide(reason = 'api') {
        const dialog = this.dialog;
        if (dialog) dialog.hide(reason);
        else this.open = false;
    }

    /** ASK to close, cancellably. #18 owns the arbitration; this is the forward. */
    requestClose(reason = 'api') {
        return this.dialog?.requestClose(reason) ?? false;
    }

    /**
     * The affirmative outcome. `confirm` is CANCELLABLE: a consumer that
     * preventDefaults it keeps the dialog open and closes it later, which is what an
     * async action needs. Returns whether the dialog closed.
     */
    confirm(reason = 'confirm') {
        if (!this.open) return false;
        const allowed = this.dispatchEvent(new CustomEvent('confirm', {
            detail: { reason },
            bubbles: true,
            composed: true,
            cancelable: true,
        }));
        if (!allowed) return false;
        this.#outcome = 'confirm';
        this.hide('confirm');
        return true;
    }

    /**
     * The other outcome. Closing IS the cancel — the report is emitted from the one
     * place that sees every dismissal, so Escape, the backdrop and this method
     * cannot disagree.
     */
    cancel(reason = 'cancel') {
        if (!this.open) return false;
        this.hide(reason);
        return true;
    }

    /* ---- normalisation ------------------------------------------------------- */

    /**
     * Fall back rather than render something that is not the thing named, which is
     * the shape base.js uses for `focus-ring` and #16 for `level`. An unknown tone
     * becomes affirmative — a destructive treatment must be ASKED for, never
     * inherited from a typo. The levels list is imported, not restated: #16 owns it
     * and two copies would be free to drift.
     */
    willUpdate(changed) {
        if (changed.has('tone')) {
            const next = CONFIRM_TONES.includes(this.tone) ? this.tone : DEFAULT_TONE;
            if (next !== this.tone) this.tone = next;
        }
        if (changed.has('level')) {
            const raw = Number.parseInt(this.level, 10);
            const next = SHEET_HEADING_LEVELS.includes(raw) ? raw : DEFAULT_LEVEL;
            if (next !== this.level) this.level = next;
        }
    }

    /* ---- the one outcome path ------------------------------------------------ */

    /**
     * Every close arrives here, whatever drove it: the way-out button, Escape, the
     * backdrop, `hide()`, or a screen setting `open = false`. Mirroring the shell's
     * `open` back onto the host is what keeps the reflected attribute honest after a
     * dismissal this component did not initiate.
     */
    #onOpenChange = (event) => {
        const { open, reason } = event.detail ?? {};
        this.open = open === true;
        if (open) { this.#outcome = null; return; }
        const outcome = this.#outcome;
        this.#outcome = null;
        if (outcome === 'confirm') return;
        this.dispatchEvent(new CustomEvent('cancel', {
            detail: { reason: reason ?? 'api' },
            bubbles: true,
            composed: true,
        }));
    };

    #onConfirmPress = () => { this.confirm('press'); };

    #onCancelPress = () => { this.cancel('press'); };

    /* ---- render --------------------------------------------------------------- */

    /**
     * NO HEADING, NO HEADING ELEMENT — #16's own rule (ui-sheet-header.js:440-447),
     * because an empty announced heading is worse than none. A confirm with no
     * question is a legitimate shape only when the body is slotted whole.
     */
    #renderQuestion() {
        const text = this.question ?? '';
        if (!text) return nothing;
        switch (this.level) {
            case 1: return html`<h1 id="question" class="ui-title question"
                >${text}</h1>`;
            case 3: return html`<h3 id="question" class="ui-title question"
                >${text}</h3>`;
            case 4: return html`<h4 id="question" class="ui-title question"
                >${text}</h4>`;
            case 5: return html`<h5 id="question" class="ui-title question"
                >${text}</h5>`;
            case 6: return html`<h6 id="question" class="ui-title question"
                >${text}</h6>`;
            default: return html`<h2 id="question" class="ui-title question"
                >${text}</h2>`;
        }
    }

    /**
     * THE LINE BREAK BEFORE EACH `>` IS LOAD-BEARING FOR GATE D, not a style choice:
     * scripts/gate-d.js:210 flags an interpolated template chunk containing a slash
     * and no newline as a route assembled from fragments, and a single-line Lit chunk
     * ending in a closing tag is exactly that shape (ui-dialog.js:1143-1148).
     *
     * The pair is authored CANCEL FIRST — the reading order Slate has too
     * (ORACLE #reset-profile-cancel x=937 before #reset-profile-confirm x=1052) —
     * and that DOM order is the whole of the safe default: it is the tab order, and
     * it is what #18 hands the caret on open.
     */
    render() {
        return html`<ui-dialog
            id="dialog"
            .open=${this.open}
            .label=${this.question ?? ''}
            @open-change=${this.#onOpenChange}
        ><div id="body" class="body" slot="body"
            >${this.#renderQuestion()}${this.detail
                ? html`<p id="detail" class="detail ui-body"
                    >${this.detail}</p>`
                : nothing}<slot></slot></div
        ><ui-button id="cancel" slot="actions" @click=${this.#onCancelPress}
            >${this.cancelText}</ui-button
        ><ui-button
            id="confirm"
            slot="actions"
            variant=${TONE_VARIANT[this.tone] ?? TONE_VARIANT[DEFAULT_TONE]}
            @click=${this.#onConfirmPress}
            >${this.confirmText}</ui-button
        ></ui-dialog>`;
    }
}

customElements.define('ui-confirm-dialog', UiConfirmDialog);
