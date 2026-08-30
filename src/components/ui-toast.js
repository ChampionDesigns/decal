/**
 * ui-toast.js - component #22 of the 57-component inventory: THE TOAST SURFACE.
 *
 * Wave 3, item #22. ITEMS.json's row, verbatim:
 *   spec:  "LAYOUT_SPEC_DRAFT.md §5 inventory item #22"
 *          "`DECISIONS.md:251` - one of the six primitives the library never had"
 *          "`--ui-z-toast` layer token"
 *   notes: "Size small. Transient notice on the `--ui-z-toast` layer. Never existed
 *          (`DECISIONS.md:251`); today raw DaisyUI markup in `index.html`. Rides in
 *          this wave because it shares the overlay token families."
 *
 * THERE IS NO ORACLE ANSWER FOR THIS COMPONENT, AND THAT IS A MEASURED FACT, NOT AN
 * OMISSION. The disqualification check was run first and then the corpus was asked
 * mechanically, twice:
 *
 *   prov_query.py find --cls toast
 *     corpus prov-baseline (dark); searched 49 state(s); found 0 element(s) in 0
 *     state(s). "0 elements matched anywhere in this corpus."
 *   prov_query.py find --id app-toast
 *     corpus prov-baseline (dark); searched 49 state(s); found 0 element(s) in 0
 *     state(s). "0 elements matched anywhere in this corpus."
 *
 * The reason is in Slate's own markup: `#app-toast` and `#fullscreen-toast-container`
 * ship `style="… display: none"` (index.html:645, :657) and are shown only by script,
 * so the capture battery never caught either of them in any of the 49 states. The
 * corpus prints the instruction for exactly this case - "read the Slate source
 * read-only, or record a reversible choice in DEFERRED_QUESTIONS.md" - and both were
 * used. EVERY number below is therefore a SOURCE READ with a file:line, or a spec
 * token, never a measurement. The wave's expected-changes ledger declares this
 * component as NEW SURFACE for the final review.
 *
 * WHAT SLATE HAS TODAY, read read-only.
 *
 *   index.html:657-661   the app toast
 *     <div id="app-toast" class="toast toast-buttom toast-center"
 *          style="z-index: 10001; display: none;">
 *       <div class="alert alert-info">
 *         <span id="app-toast-message" class="text-[22px] font-['Inter']"></span>
 *
 *   index.html:645-656   the fullscreen prompt toast - a SECOND consumer, and the one
 *     that proves the surface must take rich content rather than a string: it carries
 *     an h3, a body line and TWO buttons ("Enter Fullscreen", "Later"), inside
 *     `class="toast toast-center toast-middle"` with `shadow-lg` on the alert.
 *
 *   ui.js:3283-3316      showToast(message, duration = 2400, type = 'info')
 *     - ONE element. clearTimeout(toastHideTimer) then messageEl.textContent = message,
 *       so a second toast REPLACES the first and restarts its clock. "Scale tared"
 *       (app.js:1074, 2000ms) silently eats "Shot blocked: no scale connected"
 *       (app.js:852, 4000ms) if they land together.
 *     - four types: info | success | error | warning, via alert-<type>.
 *     - accessibility, verbatim: `if (type === 'error' || type === 'alert')` ->
 *       role="alert" + aria-live="assertive", else role="status" + aria-live="polite".
 *     - `if (duration > 0)` schedules hideToast; duration 0 is sticky.
 *     - 26 call sites across app.js, api.js, profileManager.js, profile_editor.js,
 *       profile_selector.js, settings.js, history.js and shot-rating.js, with
 *       durations 2000/2400/3000/4000/5000/6000.
 *
 *   src/css/app.css (the built DaisyUI)  the geometry nobody wrote by hand
 *     .toast { position: fixed; display: flex; min-width: fit-content;
 *              flex-direction: column; white-space: nowrap; gap: .5rem; padding: 1rem }
 *     .toast > * { animation: toast-pop .25s ease-out }
 *     @keyframes toast-pop { 0% { transform: scale(.9); opacity: 0 }
 *                            to { transform: scale(1); opacity: 1 } }
 *     .toast:where(.toast-center) { inset-inline: 50%; translate -50% }
 *     default vertical is `bottom: 0`, and `.toast-bottom` re-states it.
 *     .alert { display: grid; gap: 1rem; border-radius: var(--rounded-box, 1rem);
 *              border-width: 1px; padding: 1rem }
 *
 *   src/css/slate-shell.css:84-104   the only hand-written paint on the toast
 *     #app-toast .alert-success { border-color/background: var(--slate-pressure)
 *                                 !important; color: var(--slate-on-primary) }
 *     #app-toast .alert-error, #app-toast .alert-alert { … var(--slate-danger) … }
 *     #app-toast .alert-warning { … var(--slate-power) … }
 *     `info` has NO rule, so the default type - 20 of the 26 call sites - paints in
 *     DaisyUI's own oklch(72.06% .191 231.6) cyan, a colour from a vendor palette that
 *     nobody in this project chose. That is bug L12's shape ("private token namespaces
 *     shadowing the public ones") arriving from outside instead of inside.
 *
 * THE SOURCE READS THAT ARE CARRIED, each with its target token:
 *   stack gap        .5rem   = 8px    -> --ui-space-2                    (exact)
 *   region inset     1rem    = 16px   -> --ui-space-4, 18px              (+2, DEPARTURE 8)
 *   notice padding   1rem    = 16px   -> --ui-space-4, 18px              (+2, DEPARTURE 8)
 *   notice radius    1rem    = 16px   -> --ui-radius-xl, 12px            (§3.4: "a
 *                                        floating SURFACE: modal, sheet, menu")
 *   notice border    1px             -> --ui-border-w                    (exact)
 *   message type     text-[22px]     -> --ui-text-nav, 22px              (exact)
 *   elevation        shadow-lg (:646) -> --ui-elev-2
 *   enter motion     .25s ease-out    -> --ui-dur-slow (200ms) + --ui-ease
 *   default duration 2400ms           -> DEFAULT_TOAST_DURATION
 *   placement        bottom + centre  -> the default; `placement="top"` is the
 *                                        fullscreen prompt's toast-middle neighbour
 *   layer            z-index 10001    -> --ui-z-toast (300). §3.7: "Four literals on
 *                                        a scale beat thirteen literals with no scale."
 *
 * THE ORACLE IS DISQUALIFIED FOR TWO MORE QUESTIONS BEYOND ITS SILENCE, and both are
 * settled above it:
 *   1. RESPONSIVE BEHAVIOUR has no Slate answer (98.4% frozen); LAYOUT_SPEC_DRAFT
 *      governs. That is what DEPARTURE 2 rests on.
 *   2. THE §7 BUG LIST is off-limits - matching Slate there reproduces the bug.
 *      Two bugs sit on this element. S14 (spec §7.1): "Dead shell markup: … class=
 *      'toast-buttom'" - the typo means the class matches no rule, and the toast lands
 *      at DaisyUI's default `bottom: 0` by accident rather than by instruction. The
 *      RENDERED result is bottom-centre, which is this component's default; the dead
 *      class is not carried. And spec §1.2(e): "#scaled-content carries a transform,
 *      so it is the containing block for every position: fixed descendant. Anything
 *      mounted on document.body - every native <dialog>…, the context menu, the
 *      toasts - lays out in REAL VIEWPORT PIXELS over a UI drawn at sx." With no
 *      canvas (§1.3) there is one coordinate space and the problem does not exist.
 *
 * SHAPE: ONE ELEMENT THAT IS THE REGION, NOT ONE ELEMENT THAT IS A NOTICE.
 *
 * The wave gives item #22 exactly one custom element (wave 2's gate counts them:
 * "12 components / 12 customElements, thirteenthItem false"), and the deliverable
 * names STACKING, TIMEOUT, DISMISSAL, MOTION and ARIA-LIVE - five concerns that a
 * single notice cannot own, because stacking, capping and announcement ordering are
 * relationships BETWEEN notices. So `ui-toast` is the surface: the fixed layer, the
 * column, the clocks and the live region. A notice is any element child.
 *
 * That is also Slate's own split, moved inside a shadow root: `.toast` is the fixed
 * column and `.alert` is the card in it. And it is the split spec §4.6 writes -
 * "Menus, toasts and the context menu get the same treatment: <x-menu> and <x-toast>
 * as components … on the --ui-z-* scale."
 *
 * THE OWNERSHIP CONTRACT, which is the one thing a consumer must read:
 *   YOU SLOT A NOTICE IN AND HAND IT OVER. From that moment the region shows it,
 *   paces it, and REMOVES IT FROM THE DOM when it is dismissed. It does not report
 *   back: the handover is one-way, which is what "transient" means, it is exactly
 *   what showToast(msg, 3000) does today, and it is what makes an exit animation
 *   possible at all: a component that must leave a node it does not own can only
 *   hide it. (A `ui-toast-dismiss` announcement stood here until 29 Aug 2026 and
 *   nothing in this skin ever bound it — audit F-014.)
 *   A consumer that re-renders its own template must NOT keep dismissed notices in
 *   that template - use show() or appendChild, not a repeat() over a list.
 *
 * DELIBERATE DEPARTURES. Each is also asserted in test/render/ui-toast.render.test.mjs,
 * which is the copy a gate can run rather than read.
 *
 *  1. TONE IS INK AND EDGE, NOT A SATURATED FILL - and the reason is measured.
 *     Slate paints the card with the status colour and writes --slate-on-primary on
 *     top. In LIGHT that works; in DARK, which is the theme the machine boots into
 *     (bug S11), the status tokens are the BRIGHT variants meant to be read AS ink on
 *     a dark ground, so white on them is unreadable. WCAG 2.1 contrast, computed from
 *     styles/tokens.css:773-776 and :865-868 against --ui-on-primary:
 *          carried fill scheme   ok 1.83  danger 3.13  warn 2.07   (dark)
 *                                ok 5.62  danger 6.44  warn 5.70   (light)
 *          this component        ok 8.81  danger 5.16  warn 7.78   (dark)
 *                                ok 5.80  danger 6.66  warn 5.89   (light)
 *                                info 15.62 (dark) / 17.49 (light)
 *     Every tone here clears AA in both themes; three of Slate's fail it in dark and
 *     two of those fail even the 3:1 non-text floor. The rewrite's one MEASURED notice
 *     surface already does it this way - ui-alert-banner draws --ui-status-danger as
 *     INK on --ui-fascia, which is the oracle's own answer for the alert strip - so
 *     this is the house treatment rather than a new one. VISIBLE: a danger toast is a
 *     surface-coloured card with red ink and a red edge, where Slate's was a red slab
 *     with white text.
 *  2. THE MESSAGE WRAPS. DaisyUI authors `white-space: nowrap` on `.toast`, so a long
 *     message grows the column until it leaves the window - silent clipping, the
 *     inherited default §2.4 exists to end, and the same call this file's sibling
 *     ui-status-chip made for the same reason. Here the notice is capped at
 *     min(100%, --ui-measure) and wraps.
 *  3. TOASTS STACK. Slate has one element and a `messageEl.textContent = message`, so
 *     the second toast in a burst destroys the first and restarts its clock. This
 *     region stacks up to `max-visible` (default 3, `0` = no cap) and retires the
 *     OLDEST when a fourth arrives — the newest is the one being read. Slate's burst
 *     lost the FIRST message and restarted the clock on it silently; this one loses
 *     the message that has already had its time on the glass, which is a different
 *     and defensible answer. (Until 29 Aug 2026 the drop was also announced, with a
 *     reason of "overflow", so "a consumer can see it happen". No consumer ever did —
 *     audit F-014 — and the announcement is gone; the render suite reads the drop off
 *     the DOM instead, which is where a person reads it too.)
 *  4. THE LIVE REGION IS PERSISTENT AND THE PRIORITY RIDES ON THE NOTICE. Slate
 *     rewrites role and aria-live on the container per message. Swapping a live
 *     region's own role/politeness at the moment its contents change is the one thing
 *     assistive technology handles worst. So the region is `role="status"` +
 *     `aria-live="polite"` + `aria-atomic="false"` from mount and never changes, and
 *     the danger notice carries `role="alert"` itself, which is Slate's own mapping
 *     ("error | alert" -> assertive) applied per notice - the only form that survives
 *     stacking. Both are set only if the author has not chosen a role, exactly as
 *     ui-alert-banner and ui-status-chip do.
 *  5. THE REGION DOES NOT EAT TAPS. A `position: fixed` box on the top layer of a
 *     wall panel intercepts every press inside it. The region is `pointer-events:
 *     none` and each notice is `pointer-events: auto`, so an empty toast layer is
 *     physically not there. Slate avoids the problem only by keeping the element
 *     `display: none`, which is a different mechanism with a different failure.
 *  6. A NOTICE IS DISMISSED BY PRESSING IT. Slate has no dismiss affordance at all
 *     on `#app-toast`; the machine is a wall panel with no keyboard and no pointer
 *     escape, so a sticky toast (`duration="0"`) with no way to clear it is a dead
 *     end. A press anywhere on a notice dismisses it UNLESS it landed on something
 *     interactive - which is what keeps the fullscreen prompt's own two buttons
 *     working. An element carrying `data-ui-toast-dismiss` dismisses on press however
 *     interactive it is: that is Slate's "Later" button, expressed as one attribute.
 *  7. THE CLOCK PAUSES WHILE FOCUS IS INSIDE. A toast with a control in it that
 *     vanishes mid-reach is worse than one that stays. Slate cannot have this
 *     problem because its toast has no timer interaction at all. NOT hover: the rig
 *     reports (hover: none) and CDP can remove the feature but not grant it, so a
 *     hover rule would be untestable by construction (wave-2 carried-forward (d)).
 *  8. TWO PIXELS OF INSET AND PADDING. DaisyUI's 1rem is 16px and the spacing scale
 *     (§3.3) runs 4/8/12/18/24/28/40/56 - there is no 16. --ui-space-4 (18px) is the
 *     nearest step. One token reference reverses it to --ui-space-3 (12px).
 *  9. THE ENTER MOTION IS A TRANSITION, NOT A KEYFRAME ANIMATION. DaisyUI runs
 *     `animation: toast-pop .25s ease-out` on `.toast > *`. A `@keyframes` declared in
 *     a shadow root and named by a `::slotted()` rule resolves in the stylesheet's own
 *     tree scope, which works, but it gives no exit and no way to hold a frame. Since
 *     the region owns the node it can write `data-ui-toast` on it and transition
 *     between three states - enter -> shown -> exit - which buys the exit animation
 *     the DaisyUI form cannot express, at the same curve and the token's duration.
 * 10. NOTICES PRESENT AT MOUNT DO NOT ANIMATE IN. A toast that is already in the
 *     markup is not arriving, and a capture battery that photographs the stage
 *     mid-transition has a non-deterministic baseline. Anything added after the
 *     region's first frame animates.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   - NO MESSAGE TABLE, NO STRINGS. The region never authors a word, so nothing here
 *     needs an i18n key; the consumer passes text it has already translated. Same law
 *     as ui-alert-banner: "it takes a message, it does not know the message."
 *   - NO STORE, NO ENDPOINT. Wave 3's law: no component calls an endpoint, and this
 *     one does not even read a store. A toast queue in src/stores/ is a screen-layer
 *     decision and src/stores/ is a shared directory this lane must not write.
 *   - NO DOCUMENT-LEVEL ESCAPE HANDLER. Escape belongs to the modal surface (#18,
 *     this same wave). A non-modal layer that swallowed Escape would take it from a
 *     dialog open underneath it, which is a defect no test in this suite would see.
 *   - NO CLOSE GLYPH RENDERED BY THE REGION. It would be a sixth press treatment
 *     inside the layer that exists to end five of them (§3.6). The consumer slots
 *     ui-button or ui-icon-button and marks it `data-ui-toast-dismiss`.
 *   - NO SELECTION TREATMENT, NO HIT FLOOR ON THE REGION. Nothing here is selectable,
 *     and the notice is not a control - its own slotted controls carry the floor from
 *     wave 1. The press-to-dismiss target is the whole card, which is far above 48px
 *     by construction.
 *   - NO ANCHOR POSITIONING AND NO VIEWPORT CLAMP. Spec §4.6 asks for those in the
 *     same sentence, but they belong to `<x-menu>` (item #21, this wave): a menu is
 *     positioned FROM AN ANCHOR and can therefore leave the window. A toast has no
 *     anchor; it is inset from the edge it is pinned to and cannot escape.
 *   - NO REPOSITION ANIMATION when a notice in the middle of the stack leaves. The
 *     survivors jump. Doing it properly is a FLIP measurement per notice per frame,
 *     which is a rendering-cost decision this item has no measurement for.
 *
 * API
 *   <ui-toast>                                       the surface, bottom-centre
 *     <div tone="danger" duration="6000">Scale lost - stop at weight disabled</div>
 *   </ui-toast>
 *
 *   toast.show('Scale tared', { tone: 'ok', duration: 2000 })  -> the notice element
 *   toast.dismiss(notice)  toast.clear()  toast.notices
 *
 *   host attributes  placement="bottom|top"   anchor="viewport|container"
 *                    max-visible="3"          (0 = no cap)
 *   notice attributes  tone="info|ok|warn|danger"   duration="<ms>"  (0 = sticky)
 *                      data-ui-toast-dismiss        (on a control inside a notice)
 *   event  open-change       { bubbles, composed, detail: { open: true, reason: 'layer-entry' } }
 *          the library's layer-entry announcement, emitted every time this region takes
 *          the top layer — see #syncLayer. Never emitted by a container-anchored region,
 *          which takes no layer, and never with open: false (a region that leaves the
 *          layer leaves nothing on top of anything).
 *
 *   Internal knobs (--_ui-, not tokens, not API): --_ui-toast-inset, --_ui-toast-scale.
 */

import { css, html } from 'lit';
import { UiElement } from 'src/components/base.js';

/** ui.js:3283 `showToast(message, duration = 2400, type = 'info')`, carried. */
export const DEFAULT_TOAST_DURATION = 2400;

/** Slate stacks nothing; three is the cap this component chose. DEPARTURE 3. */
export const DEFAULT_MAX_VISIBLE = 3;

/**
 * Slate's four alert types, renamed to the token family that paints them.
 * success -> ok (A5 splits the old --slate-pressure into --ui-status-ok and the
 * chart's own channel), error|alert -> danger, warning -> warn, info unchanged.
 */
export const TOAST_TONES = Object.freeze(['info', 'ok', 'warn', 'danger']);

/**
 * ===========================================================================
 * A DANGER NOTICE OUTRANKS A MODAL — DQ-565, Ben's policy, 21 August 2026
 * ===========================================================================
 *
 * The costed #22 repair, adopted. Wave 5.2 measured the defect and pinned it rather than
 * fixing it (finding cross-2): a notice already on screen is BURIED by a dialog opened
 * after it, because the top layer is ordered by ENTRY and `--ui-z-toast` cannot reach
 * into it. `#syncLayer()` below already re-enters the layer when a notice ARRIVES, which
 * is why the other order — notice raised over an open dialog — always worked; the gap was
 * the dialog arriving second. Ben's ruling: "a danger-tone notice re-takes the top layer
 * above a modal".
 *
 * TONE IS THE GATE, and it is the whole of the policy. `danger` is already the one tone
 * this component announces assertively (`applyAssertiveRole` below) — the tone reserved
 * for something the user must know NOW — so it is the tone that may interrupt a modal.
 * Every other tone keeps today's behaviour exactly: buried is fine for "Saved".
 *
 * THE SIGNAL IS #57's, WHICH IS WHY THERE IS NO SECOND MECHANISM. `ui-screensaver`'s
 * `#watchLayer()` holds the top of the top layer the same way, off the same announcement,
 * and its header explains the shape: re-enter in a MICROTASK queued from the news, so the
 * other element is already in the layer and no frame paints in between.
 *
 * ONE EVENT AND NOT TWO, AND THAT IS THE ANTI-LOOP. #57 listens to `beforetoggle` as well,
 * because it must catch a native popover nothing in this library announced. This region
 * must NOT: `beforetoggle` fires on every `hidePopover()`/`showPopover()` pair, so two
 * elements that both re-entered on it would re-enter on each other's re-entry, for ever.
 * `open-change` is the library's own "a surface OPENED" and #57's re-entry does not emit
 * it, so the settled order is blank > danger notice > dialog — D10 intact, which is the
 * one thing this repair may not cost. `reason: 'layer-entry'` (what `#syncLayer()` emits)
 * is skipped for the same reason one region out: a re-take is not an opening.
 */
const LAYER_ENTRY_EVENT = 'open-change';

/** The `reason` `#syncLayer()` announces with — a re-take, never an opening. */
const LAYER_ENTRY_REASON = 'layer-entry';

/** The one tone that may interrupt a modal (DQ-565). */
const INTERRUPTING_TONE = 'danger';

/** The lifecycle attribute the region writes on a notice it owns. */
const STATE_ATTR = 'data-ui-toast';

/** Marks a control inside a notice as "pressing me dismisses this". */
const DISMISS_ATTR = 'data-ui-toast-dismiss';

/**
 * Native things a press must NOT be read as "dismiss this toast". Any CUSTOM element
 * between the press and the notice counts too (see #isInteractive) - listing ui-*
 * tags here would go stale the moment wave 4 adds one.
 */
const NATIVE_INTERACTIVE =
    'a[href], button, input, select, textarea, summary, label, ' +
    '[tabindex]:not([tabindex="-1"]), [role="button"], [role="link"], [contenteditable]';

/** `duration` -> ms. Anything unreadable falls back rather than becoming sticky. */
function readDuration(raw) {
    if (raw === null || raw === '') return DEFAULT_TOAST_DURATION;
    const ms = Number(raw);
    if (!Number.isFinite(ms) || ms < 0) return DEFAULT_TOAST_DURATION;
    return ms;
}

/**
 * DEPARTURE 4's second half, and the ONE place it is written — finding cmodality-9.
 *
 * Slate's own mapping, ui.js:3298-3305: error|alert is assertive, everything else
 * polite, and `role="alert"` carries assertive implicitly. Only if the consumer has
 * not chosen a role of their own.
 *
 * It lives out here, as a function both `show()` and `#adopt()` call, because WHEN it
 * runs is the whole of the finding: an assertive announcement is triggered by the
 * INSERTION of a `role="alert"` element into the document (or by a content change
 * inside one already there). Adding the role to a node that is ALREADY a child of the
 * polite region is the ordering assistive technology handles least reliably — the
 * notice may be announced politely, or not at all — and `danger` is the only tone the
 * assertive path exists for. So the role goes on while the element is still detached.
 */
function applyAssertiveRole(notice) {
    if (notice.getAttribute('tone') === 'danger' && !notice.hasAttribute('role')) {
        notice.setAttribute('role', 'alert');
    }
}

/**
 * TOP LAYER OR NOTHING — finding cross-1, and the measurement that bounds it.
 *
 * A modal `<dialog>` and its `::backdrop` live in the TOP LAYER, which no `z-index`
 * can reach: `--ui-z-toast` is 300 and the scrim paints over it whatever the number.
 * MEASURED (BENCH, real CDP, both geometries identical): with a dialog open,
 * `t.show('Saved')` created a notice with a real rect and a shadow-piercing hit test
 * at the notice's own centre returned `dialog` — the scrim. The one notice a modal
 * save flow most needs to deliver is the one that arrived by no channel at all.
 *
 * `popover="manual"` is the fix for the half that CAN be fixed. Manual popovers are
 * not light-dismissed, do not take focus and do not answer Escape, so nothing about
 * the region's behaviour changes — only which layer it paints in. MEASURED: a 2x2
 * screenshot crop over the region with a blue `::backdrop` behind a modal dialog reads
 * (255, 0, 0) — the region's own paint, above the scrim — and the host and notice
 * rects are byte-identical with the attribute on and off, because every UA `[popover]`
 * declaration is neutralised by `:host([popover])` below.
 *
 * WHAT IT DOES NOT BUY, measured rather than assumed, because a comment claiming
 * otherwise would be worse than no comment:
 *   - HIT TESTING. `document.elementFromPoint` over the notice still answers `dialog`.
 *     A modal dialog blocks interaction with the whole document outside itself; that
 *     is what modal MEANS and no layer beats it. A notice raised during a modal is
 *     readable, not pressable.
 *   - THE ACCESSIBILITY TREE. CDP `Accessibility.getFullAXTree` finds neither a
 *     body-level `role="status"` region NOR the same region promoted to the top layer
 *     while a modal dialog is open — with ui-dialog's own `inert` marks removed. The
 *     platform's "blocked by a modal dialog" removes it, and nothing this component
 *     can write undoes that. A notice that must be ANNOUNCED during a modal has to be
 *     raised inside the dialog's own subtree; that is a wave-5.2 screen decision, and
 *     it is recorded as one.
 *
 * `anchor="container"` is deliberately excluded: a top-layer box's containing block is
 * the viewport, so promoting a container-anchored region would move it to the window
 * corner and take the gallery's whole capture battery with it. A panel-scoped notice
 * is not competing with an app-modal scrim either.
 */
const SUPPORTS_POPOVER = typeof HTMLElement !== 'undefined'
    && typeof HTMLElement.prototype.showPopover === 'function';

/** The one place a transition duration is turned into a number of milliseconds. */
function readMs(value) {
    const first = String(value || '0s').split(',')[0].trim();
    const ms = first.endsWith('ms') ? parseFloat(first) : parseFloat(first) * 1000;
    return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

export class UiToast extends UiElement {
    /* NO REACTIVE PROPERTIES, and that is the design rather than an oversight. The
     * three host options (placement, anchor, max-visible) are read by CSS off the
     * attribute or by one getter, and the notices live in the LIGHT DOM where the
     * consumer put them - so nothing this component knows can change what it renders.
     * render() is constant. The same argument the base makes for `focusVariant`:
     * reflecting a default would stamp placement="bottom" onto every instance for no
     * gain. */

    static styles = [css`
        /* THE LAYER. Item #22's row names it - "Transient notice on the --ui-z-toast
         * layer" - and spec §4.6 puts menus and toasts "on the --ui-z-* scale", so
         * unlike ui-alert-banner (which sets no position because a screen lays it out
         * in flow) this component owns its own stacking and its own pinning.
         *
         * position: fixed is NOT a viewport QUERY. CONVENTIONS §2 bans
         * @media (width…), and there is none in this file - no width query of any
         * kind, at any level. A fixed box's containing block IS the viewport by
         * definition, which is what "a layer above the page" means; the alternative
         * would be a screen-level wrapper that every screen has to remember.
         *
         * pointer-events: none is DEPARTURE 5 and it is load-bearing: without it this
         * box swallows every press inside its footprint whether or not a toast is
         * showing. The notices switch it back on for themselves. */
        :host {
            position: fixed;
            z-index: var(--ui-z-toast);
            inset-inline: var(--_ui-toast-inset);
            inset-block-start: auto;
            inset-block-end: var(--_ui-toast-inset);
            pointer-events: none;

            /* PRIVATE (CONVENTIONS §7), never tokens, and neither may ever carry a
             * colour. The inset is DEPARTURE 8; the scale is the enter/exit
             * displacement, DaisyUI's toast-pop 0% transform: scale(.9). */
            --_ui-toast-inset: var(--ui-space-4);
            --_ui-toast-scale: .9;
        }

        /* THE TOP-LAYER NEUTRALISER - finding cross-1, and it changes no geometry.
         *
         * The UA sheet dresses every [popover] as a little card: margin: auto (which
         * would centre this region in the window), width/height: fit-content, a solid
         * border, padding, overflow: auto, and an opaque Canvas background. Every one
         * of those is written back here. Nothing about POSITION is repeated - :host
         * above already states position, both insets and the placement flip, and an
         * author rule beats the UA sheet per property whatever its specificity, so
         * restating them here would only create a second opinion for
         * :host([placement="top"]) to lose a source-order tie to.
         *
         * MEASURED, BENCH: host rect [18, 712, 1245, 71] and notice rect
         * [595.34, 715.55, 90.30, 63.90] - identical to the byte with the attribute on
         * and off. display is not restated either: [popover]:not(:popover-open) is a UA
         * rule and the base's own :host { display: block } already outranks it, so a
         * region whose showPopover() ever fails keeps painting where it always did. */
        :host([popover]) {
            margin: 0;
            border: 0;
            padding: 0;
            overflow: visible;
            inline-size: auto;
            block-size: auto;
            background-color: transparent;
            color: inherit;
        }

        /* index.html:645 puts the fullscreen prompt at toast-middle and the app toast
         * at the bottom. Only the two edges are offered: a middle toast is a modal
         * that forgot to be one, and #18 owns modality this wave. */
        :host([placement="top"]) {
            inset-block-start: var(--_ui-toast-inset);
            inset-block-end: auto;
        }

        /* THE ONE ESCAPE FROM THE VIEWPORT, and the reason the gallery can photograph
         * this component at all: anchor="container" makes the layer relative to the
         * nearest positioned ancestor instead. Without it every gallery state would
         * pile up in the same corner of the window, on top of the chrome, and the
         * capture battery would shoot the same picture for all of them. It is also
         * how a panel-scoped notice is expressed. */
        :host([anchor="container"]) {
            position: absolute;
        }

        /* THE COLUMN. gap is DaisyUI's .5rem exactly. align-items: center is
         * toast-center, without the translate: the region already spans the inset box,
         * so centring is the flex line's job and no transform is needed - which
         * matters because the notices use transform for their own motion. */
        .stack {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--ui-space-2);
        }

        /* Newest nearest the pinned edge, in both placements. At the bottom that is
         * DOM order; at the top the column runs the other way. */
        :host([placement="top"]) .stack {
            flex-direction: column-reverse;
        }

        /* THE NOTICE. ::slotted() reaches exactly the top-level assigned nodes, which
         * is exactly the set of notices - a nested element is the consumer's business
         * and inherits the ink from here.
         *
         * A DOCUMENT rule still wins over these (CSS Scoping §3.3: for two normal
         * declarations in different tree contexts the OUTER tree wins whatever the
         * specificity), so a screen that has stated a treatment keeps it. That is the
         * same mechanism CONVENTIONS §3a describes for the focus ring, read in the
         * other direction.
         *
         * box-sizing is declared here because the base's inherit chain covers the
         * SHADOW tree; a slotted node belongs to the document tree and takes whatever
         * that sets. */
        ::slotted(*) {
            box-sizing: border-box;
            pointer-events: auto;
            max-inline-size: min(100%, var(--ui-measure));
            padding: var(--ui-space-4);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius-xl);
            background-color: var(--ui-surface);
            color: var(--ui-text);
            font-size: var(--ui-text-nav);
            box-shadow: var(--ui-elev-2);

            /* DEPARTURE 2. DaisyUI is white-space: nowrap; a message that cannot wrap
             * leaves the window instead of getting taller. */
            overflow-wrap: anywhere;

            /* DEPARTURE 9. Two properties only, so nothing here can move the layout of
             * the stack - a transform and an opacity are composited, and a mid-flight
             * frame never changes where the next notice sits. */
            transition:
                opacity var(--ui-dur-slow) var(--ui-ease),
                transform var(--ui-dur-slow) var(--ui-ease);
        }

        /* background-color and NOT the background shorthand, every time: the shorthand
         * resets background-clip, which is the documented 32px-slab trap
         * (CONVENTIONS §5, quoting slate-live.css:1565-1567). Nothing here clips a
         * background today; the habit is the point.
         *
         * DEPARTURE 1 - tone is ink and edge. The contrast table is in this file's
         * header block: white on the dark theme's status fills measures 1.83 / 3.13 /
         * 2.07, and these measure 8.81 / 5.16 / 7.78. */
        ::slotted([tone="ok"]) {
            color: var(--ui-status-ok);
            border-color: var(--ui-status-ok);
        }

        ::slotted([tone="warn"]) {
            color: var(--ui-tint-power);
            border-color: var(--ui-tint-power);
        }

        ::slotted([tone="danger"]) {
            color: var(--ui-status-danger);
            border-color: var(--ui-status-danger);
        }

        /* THE THREE LIFECYCLE STATES. enter and exit are the same frame, which is what
         * makes a toast that arrives and a toast that leaves read as one gesture
         * played forwards and backwards - DaisyUI's toast-pop keyframes, 0% and to,
         * with nothing in between to invent. */
        ::slotted([data-ui-toast="enter"]),
        ::slotted([data-ui-toast="exit"]) {
            opacity: 0;
            transform: scale(var(--_ui-toast-scale));
        }

        ::slotted([data-ui-toast="shown"]) {
            opacity: 1;
            transform: scale(1);
        }

        /* CONVENTIONS §11 puts reduced motion in each animating component, because the
         * honest global form needs !important. The transition is removed rather than
         * shortened, so a notice is simply there or not there; the states above still
         * hold their opacity, so nothing depends on a transitionend that will not
         * fire (which is why #dismiss reads the duration rather than listening). */
        @media (prefers-reduced-motion: reduce) {
            ::slotted(*) {
                transition: none;
            }
        }
    `];

    /** notice -> { duration, remaining, startedAt, handle }. Insertion-ordered. */
    #clocks = new Map();

    /** Notices being removed: still in the DOM, no longer counted, not re-adoptable. */
    #leaving = new Set();

    #observer = new MutationObserver((records) => this.#onMutations(records));

    /** False until the region has had one frame; see DEPARTURE 10. */
    #ready = false;

    #paused = false;

    /** The roots this region is listening to for DQ-565's re-take, or empty. */
    #watching = [];

    #onClick = (event) => this.#handlePress(event);

    #onFocusIn = () => this.#pause();

    #onFocusOut = (event) => {
        /* relatedTarget is where focus is GOING, and it is retargeted to the outermost
         * host in this tree - so a move between two controls inside one notice, even
         * across a shadow boundary, is still `contains`ed here and does not resume.
         * null (focus left for the page) resumes, which is what it should do. */
        if (!event.relatedTarget || !this.contains(event.relatedTarget)) this.#resume();
    };

    connectedCallback() {
        super.connectedCallback();

        /* DEPARTURE 4. The persistent live region, set once and never rewritten.
         * aria-atomic="false" so an arriving notice is announced on its own rather
         * than the whole stack being re-read; role="status" already implies
         * aria-live="polite", and both are written because Slate wrote both and
         * because a screen that overrides one should not have to guess about the
         * other. Only if the author has not chosen a role - a region used as a
         * decorative layer on a screen that already announces should not shout. */
        if (!this.hasAttribute('role')) {
            this.setAttribute('role', 'status');
            this.setAttribute('aria-live', 'polite');
            this.setAttribute('aria-atomic', 'false');
        }

        this.#observer.observe(this, { childList: true });
        this.addEventListener('click', this.#onClick);
        this.addEventListener('focusin', this.#onFocusIn);
        this.addEventListener('focusout', this.#onFocusOut);
        this.#syncLayer();

        /* Children that are already here are adopted WITHOUT motion (DEPARTURE 10).
         * Done here AND in firstUpdated because the two cases differ: an element
         * upgraded from an innerHTML assignment already has its children, while one
         * upgraded by the streaming parser does not - and anything the parser adds
         * later arrives through the observer while #ready is still false, so it is
         * still treated as initial. */
        this.#adoptExisting(true);
        this.#syncDangerWatch();
        requestAnimationFrame(() => { this.#ready = true; });
    }

    disconnectedCallback() {
        this.#observer.disconnect();
        this.#unwatchLayer();
        this.removeEventListener('click', this.#onClick);
        this.removeEventListener('focusin', this.#onFocusIn);
        this.removeEventListener('focusout', this.#onFocusOut);
        for (const clock of this.#clocks.values()) clearTimeout(clock.handle);

        /* THE STATE ATTRIBUTE COMES OFF, and that is not tidiness. Moving an element in
         * the DOM is a disconnect followed by a connect, and #adopt is idempotent BY
         * that attribute - so a region that left its marks behind would come back and
         * refuse to adopt any of the notices it was already holding, pacing none of
         * them and never dismissing them. A notice mid-exit is left to leave: its
         * removal timer is the one thing here that is not this component's to cancel. */
        for (const notice of this.#clocks.keys()) notice.removeAttribute(STATE_ATTR);
        this.#clocks.clear();
        this.#leaving.clear();
        this.#ready = false;
        this.#paused = false;
        super.disconnectedCallback();
    }

    firstUpdated() {
        this.#adoptExisting(true);
    }

    /**
     * Put the region in the top layer, or take it out — see SUPPORTS_POPOVER above for
     * what that buys and what it does not.
     *
     * Re-shown on every adoption, not only at connect, and that is the load-bearing
     * part: the top layer is ordered by ENTRY, so a region promoted at mount sits
     * BELOW a dialog that opened afterwards. Re-entering it when a notice arrives is
     * what puts the notice above the scrim that is on screen at the moment it is
     * raised. Cheap: no style recalculation happens between the two calls.
     *
     * AND IT SAYS SO — finding c-surfaces-1, wave 5.2. Entering the top layer is a fact
     * about the whole page, not about this tree: #57's blank has to re-take the layer
     * after anything else enters it, or `--ui-z-blackout` (400) > `--ui-z-toast` (300)
     * stops being true (D10, SCOPE:218). The platform's own `beforetoggle` is
     * `composed: false`, so it stops at the root it fired in and a region living inside a
     * SCREEN'S shadow template — the ordinary composition once a screen owns its own
     * toast — is invisible to a document-level listener. MEASURED at exactly that
     * arrangement: 24,031 non-black pixels at bench on a screen D10 calls fully black,
     * the same number the flat-tree case gave before #57's repair.
     *
     * `open-change` `{open, reason}`, `bubbles: true, composed: true`, is the library's
     * own announcement and the one thing that crosses a shadow boundary. #18
     * (`ui-dialog.js:800`) and #21 (`ui-menu.js:1056`) already emit it and
     * `ui-screensaver.js`'s `LAYER_ENTRY_EVENTS` already consumes it, so this is
     * vocabulary rather than a dependency: this component does not know what listens, only
     * that a library surface announces when it takes the layer. AFTER the entry, never
     * before, for the same reason #18 announces after `#present()` — a listener that
     * re-enters on the news must find this region already there or it re-takes too early.
     */
    #syncLayer() {
        if (!SUPPORTS_POPOVER || !this.isConnected) return;

        if (this.getAttribute('anchor') === 'container') {
            if (this.hasAttribute('popover')) {
                if (this.matches(':popover-open')) this.hidePopover();
                this.removeAttribute('popover');
            }
            /* No layer was taken, so there is nothing to announce: a container-anchored
             * region paints on --ui-z-toast and the scale governs it honestly. */
            return;
        }

        if (this.getAttribute('popover') !== 'manual') this.setAttribute('popover', 'manual');
        try {
            if (this.matches(':popover-open')) this.hidePopover();
            this.showPopover();
        } catch {
            /* A region mid-removal, or one whose popover state the page is driving
             * itself. The region still paints where it always did; only the layer is
             * lost, and a throw here would take the notice with it. */
        }

        /* Announced on the STATE, not on the attempt: a `showPopover()` that threw took no
         * layer and must not claim one. */
        if (!this.matches(':popover-open')) return;
        this.dispatchEvent(new CustomEvent('open-change', {
            bubbles: true,
            composed: true,
            detail: { open: true, reason: LAYER_ENTRY_REASON },
        }));
    }

    /* ---- DQ-565: a danger notice re-takes the layer over a modal ----------- */

    /** True while this region is pacing at least one `danger` notice. */
    get #holdsDanger() {
        for (const notice of this.#clocks.keys()) {
            if (notice.getAttribute('tone') === INTERRUPTING_TONE) return true;
        }
        return false;
    }

    /**
     * Listen while there is something to protect, and not a moment longer.
     *
     * Armed by the presence of a danger notice rather than by a property, so a screen
     * asks for the behaviour by raising the tone that means it — there is no second
     * switch to set and none to forget. A container-anchored region takes no layer at
     * all, so it has none to re-take.
     *
     * BOTH ROOTS, exactly as #57 does it: `document` catches the page's own surfaces and
     * `getRootNode()` catches siblings when a screen mounts this region inside its own
     * shadow template. `open-change` is composed and would reach `document` anyway; the
     * second root costs nothing and keeps the two files' shapes identical.
     */
    #syncDangerWatch() {
        const wanted = this.isConnected && SUPPORTS_POPOVER
            && this.getAttribute('anchor') !== 'container' && this.#holdsDanger;
        if (!wanted) {
            this.#unwatchLayer();
            return;
        }
        const roots = [document, this.getRootNode()].filter(
            (node, i, all) => node && typeof node.addEventListener === 'function' && all.indexOf(node) === i,
        );
        if (roots.length === this.#watching.length && roots.every((r, i) => r === this.#watching[i])) return;
        this.#unwatchLayer();
        for (const root of roots) root.addEventListener(LAYER_ENTRY_EVENT, this.#onForeignOpen, true);
        this.#watching = roots;
    }

    #unwatchLayer() {
        for (const root of this.#watching) root.removeEventListener(LAYER_ENTRY_EVENT, this.#onForeignOpen, true);
        this.#watching = [];
    }

    /**
     * Something else opened. Re-take the layer after it, in a microtask.
     *
     * An arrow field so the same reference removes and so `this` is the region on a
     * capture listener firing for a target somewhere else entirely — #57's note, and the
     * same reason.
     */
    #onForeignOpen = (event) => {
        if (event.target === this) return;
        if (event.detail?.open !== true) return;
        if (event.detail?.reason === LAYER_ENTRY_REASON) return;
        if (!this.#holdsDanger) return;
        queueMicrotask(() => {
            if (!this.isConnected || !this.#holdsDanger) return;
            if (this.getAttribute('anchor') === 'container') return;
            this.#syncLayer();
        });
    };

    /* ---- the public surface ------------------------------------------------ */

    /** The notices this region is currently pacing, oldest first. */
    get notices() {
        return [...this.#clocks.keys()];
    }

    /** `max-visible`, or DEFAULT_MAX_VISIBLE. 0 (or negative) means no cap. */
    get maxVisible() {
        if (!this.hasAttribute('max-visible')) return DEFAULT_MAX_VISIBLE;
        const n = Number(this.getAttribute('max-visible'));
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_MAX_VISIBLE;
    }

    /**
     * The showToast(message, duration, type) shape, as a method on the surface.
     *
     * Creates the notice element itself, which is the only reason a consumer with a
     * plain string never has to know what a notice is made of. Adoption is done
     * SYNCHRONOUSLY here rather than waiting for the observer's microtask, so the
     * returned element already carries its state and its clock and a caller can
     * dismiss it on the next line.
     */
    show(message, { tone = 'info', duration = null } = {}) {
        const notice = document.createElement('div');
        notice.textContent = String(message ?? '');
        notice.setAttribute('tone', TOAST_TONES.includes(tone) ? tone : 'info');
        if (duration !== null && duration !== undefined) notice.setAttribute('duration', String(duration));
        /* BEFORE THE INSERTION, not after it — finding cmodality-9, and the whole of
         * applyAssertiveRole's note. #adopt calls it again and it is idempotent; this
         * call is the one that makes a `danger` notice an assertive ANNOUNCEMENT
         * rather than a polite node that acquired a role afterwards. */
        applyAssertiveRole(notice);
        this.appendChild(notice);
        this.#adopt(notice);
        return notice;
    }

    /**
     * Retire one notice: stop its clock, play it out, and remove it.
     *
     * It used to "say so" as well, and no longer does — see `#remove` and audit
     * F-014. The second parameter this took (`reason = 'api'`) went with the
     * announcement it existed to fill in; extra arguments are harmless in JS, so a
     * caller written against the old signature still works.
     *
     * @returns true if this region was pacing that notice.
     */
    dismiss(notice) {
        if (!this.#clocks.has(notice)) return false;
        clearTimeout(this.#clocks.get(notice).handle);
        this.#clocks.delete(notice);
        this.#leaving.add(notice);
        notice.setAttribute(STATE_ATTR, 'exit');

        /* The duration is READ, not listened for. A 0s transition fires no
         * transitionend in Chrome, so a listener-only implementation leaves every
         * notice in the DOM forever under prefers-reduced-motion - the users who can
         * least afford a stuck overlay. */
        const out = readMs(getComputedStyle(notice).transitionDuration);
        if (out === 0) this.#remove(notice);
        else setTimeout(() => this.#remove(notice), out);

        /* DQ-565: the last danger notice leaving takes the listener with it. */
        this.#syncDangerWatch();
        return true;
    }

    /** Retire everything, oldest first. */
    clear() {
        for (const notice of this.notices) this.dismiss(notice);
    }

    /* ---- adoption and the clocks ------------------------------------------ */

    #adoptExisting(initial) {
        for (const child of [...this.children]) this.#adopt(child, initial);
    }

    /**
     * Take ownership of one element child.
     *
     * Idempotent by the state attribute, which is what lets show() adopt
     * synchronously and the observer's later record be a no-op rather than a second
     * clock on the same node.
     */
    #adopt(notice, initial = !this.#ready) {
        if (notice.nodeType !== Node.ELEMENT_NODE) return;
        if (this.#clocks.has(notice) || this.#leaving.has(notice)) return;
        if (notice.hasAttribute(STATE_ATTR)) return;

        /* DEPARTURE 4's second half: the priority rides on the notice. For a notice
         * that arrived through the observer this is the only place it can be written -
         * the consumer inserted the node - and show()'s own call has already done it
         * for the path where the element was still detached. */
        applyAssertiveRole(notice);

        notice.setAttribute(STATE_ATTR, initial ? 'shown' : 'enter');
        this.#clocks.set(notice, { duration: 0, remaining: 0, startedAt: 0, handle: 0 });

        if (!initial) {
            /* Two frames: the first lets the engine take `enter` as the starting
             * style, the second changes it. One frame is enough in Chrome only when a
             * style flush has already happened, and the shape that is enough ALWAYS is
             * cheaper than the shape that is usually enough. */
            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (this.#clocks.has(notice)) notice.setAttribute(STATE_ATTR, 'shown');
            }));
        }

        this.#startClock(notice);
        this.#enforceCap();

        /* cross-1: whatever layer the scrim is on, this notice goes above it. LAST, and
         * that position is measured: re-entering the top layer forces a style
         * resolution, and a resolution taken between the insertion and the `enter`
         * write gave the notice a resting first style — so `enter` became a TRANSITION
         * from opacity 1 rather than the starting frame, and the arrival had no
         * entrance to play. Caught by the suite's own toast-pop assertion. */
        this.#syncLayer();

        /* DQ-565: and if what just arrived is a danger notice, start listening for the
         * next surface that opens over it. */
        this.#syncDangerWatch();
    }

    #startClock(notice) {
        const duration = readDuration(notice.getAttribute('duration'));
        const clock = this.#clocks.get(notice);
        if (!clock) return;
        clock.duration = duration;
        clock.remaining = duration;
        /* ui.js:3307 `if (duration > 0)`. Zero is sticky, and stays sticky. */
        if (duration <= 0) return;
        if (!this.#paused) this.#schedule(notice);
    }

    #schedule(notice) {
        const clock = this.#clocks.get(notice);
        if (!clock || clock.remaining <= 0) return;
        clock.startedAt = Date.now();
        clock.handle = setTimeout(() => this.dismiss(notice, 'timeout'), clock.remaining);
    }

    /** DEPARTURE 7. */
    #pause() {
        if (this.#paused) return;
        this.#paused = true;
        const now = Date.now();
        for (const clock of this.#clocks.values()) {
            if (!clock.handle) continue;
            clearTimeout(clock.handle);
            clock.handle = 0;
            clock.remaining = Math.max(0, clock.remaining - (now - clock.startedAt));
        }
    }

    #resume() {
        if (!this.#paused) return;
        this.#paused = false;
        for (const [notice, clock] of this.#clocks) {
            if (clock.duration > 0 && !clock.handle) this.#schedule(notice);
        }
    }

    /** DEPARTURE 3. The oldest goes, because the newest is the one being read. */
    #enforceCap() {
        const cap = this.maxVisible;
        if (cap <= 0) return;
        const live = this.notices;
        for (let i = 0; i < live.length - cap; i++) this.dismiss(live[i]);
    }

    /**
     * The node leaves. THIS USED TO ANNOUNCE (`ui-toast-dismiss`, with the node and a
     * reason in the detail) and the announcement was retired 29 August 2026, audit
     * F-014: it was heard nowhere in `src/`, by the gate and by hand.
     *
     * The comment that stood here argued the case for it — "a consumer that wants it
     * back can re-append it, and one that is keeping a count can decrement" — and in
     * two years of this skin nobody wanted either. Every consumer of this region is
     * `toast.show(…)` and nothing else: five call sites in `editor-screen.js`, the
     * two hosts in `editor-screen.js` and `selector-screen.js`, no `dismiss()`, no
     * `clear()`, no `@ui-toast-dismiss` binding anywhere. Fire and forget is the whole
     * contract, and it is the contract because a toast that outlives its screen's
     * interest in it is what the ownership rule above exists to prevent.
     *
     * THE `reason` WENT WITH IT, and that is the honest half of this removal rather
     * than a second change. `'timeout' | 'tap' | 'action' | 'overflow' | 'api'` was
     * threaded from `dismiss()` through a timer into this method for the sole purpose
     * of riding in that detail — nothing here ever branched on it. A label carried
     * across four methods for a reader that no longer exists is the same dead wire one
     * layer down. The BEHAVIOURS it labelled are unchanged and are still each asserted
     * in the render suite, through the DOM: the oldest goes when the cap is reached, a
     * timed notice leaves on its own, a press dismisses, a press on a control inside
     * does not, a control marked `data-ui-toast-dismiss` does.
     */
    #remove(notice) {
        this.#leaving.delete(notice);
        notice.removeAttribute(STATE_ATTR);
        notice.remove();
    }

    /* ---- presses ----------------------------------------------------------- */

    /** The managed notice this node sits inside, or null. */
    #noticeOf(node) {
        for (let el = node; el && el !== this; el = el.parentElement) {
            if (el.parentElement === this) return this.#clocks.has(el) ? el : null;
        }
        return null;
    }

    /**
     * Would a press here have meant something other than "dismiss"?
     *
     * Any CUSTOM element between the press and the notice counts, which is how this
     * stays true as wave 4 and wave 5 add controls: a tag with a hyphen in it is
     * something somebody built to be pressed, held or dragged. The notice itself is
     * excluded from the walk, so a notice that IS a ui-card still dismisses on press.
     */
    #isInteractive(target, notice) {
        for (let el = target; el && el !== notice; el = el.parentElement) {
            if (el.tagName.includes('-')) return true;
            if (el.matches?.(NATIVE_INTERACTIVE)) return true;
        }
        return false;
    }

    /** DEPARTURE 6. */
    #handlePress(event) {
        const target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        const notice = this.#noticeOf(target);
        if (!notice) return;
        /* Scoped to the notice on purpose: closest() would happily walk past it, out
         * through this region and into whatever the screen wrapped around it, and a
         * marker up there is not this notice's dismiss control. */
        const marker = target.closest(`[${DISMISS_ATTR}]`);
        if (marker && notice.contains(marker)) {
            this.dismiss(notice, 'action');
            return;
        }
        if (this.#isInteractive(target, notice)) return;
        this.dismiss(notice, 'tap');
    }

    #onMutations(records) {
        for (const record of records) {
            for (const node of record.removedNodes) {
                /* The consumer took it back. Drop the clock rather than firing at a
                 * node that is no longer anywhere - and do NOT emit a dismissal, which
                 * would be this component reporting somebody else's decision. */
                const clock = this.#clocks.get(node);
                if (clock) {
                    clearTimeout(clock.handle);
                    this.#clocks.delete(node);
                }
                this.#leaving.delete(node);
            }
            for (const node of record.addedNodes) this.#adopt(node);
        }
        /* A consumer that took its own notice back can have taken the last danger one. */
        this.#syncDangerWatch();
    }

    render() {
        return html`<div id="stack" class="stack"><slot></slot></div>`;
    }
}

customElements.define('ui-toast', UiToast);
