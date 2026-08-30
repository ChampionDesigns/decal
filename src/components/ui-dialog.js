/**
 * ui-dialog.js — component #18 of the 57-component inventory: THE ONE DIALOG.
 *
 * Wave 3, item #18 (SCOPE Part 4, "Wave 3 — the platform owners"), the row verbatim:
 *
 *   "Size large. One native `<dialog>` with `header`/`body`/`actions` slots; real
 *    modality — `inert` on the page, focus trap, focus restore — or the `aria-modal`
 *    attribute comes off. Replaces at least seven hand-rolled dialogs (O6). With no
 *    canvas there is no second coordinate space: S7 (1.5x-sized dialog buttons) and
 *    S8 (z-index that lies) cease to exist structurally. Defect table also credits it
 *    with H9/O8 (fake modality)."
 *
 * This is the ONE dialog machinery. Part 10 §12 (wf-w5p2-overlays): "#18/#53/#54/#55
 * already exist from w3/w4; this phase integrates and proves, it does not construct."
 * Wave 4's #19/#20/#53/#54/#55 all depend on this file. A screen brings a BODY; it
 * does not bring a scrim, a z-index, a focus trap or an Escape handler, and the
 * reason seven of them each brought their own is the whole of O6.
 *
 * Token-only: no data layer, no store, no endpoint (wave law).
 *
 * ---------------------------------------------------------------------------
 * THE CONTRACT, spec §4.6 (LAYOUT_SPEC_DRAFT.md:802-813) verbatim, and where each
 * line lands below:
 *
 *   <x-dialog>        native <dialog>; one coordinate space with the page          -> the template
 *     inline-size:    min(<intrinsic>, 100% - 2*var(--ui-space-6))                 -> .dialog
 *     max-block-size: calc(100% - 2*var(--ui-space-5))                             -> .dialog
 *     display:grid; grid-template-rows: auto minmax(0,1fr) auto                    -> .dialog.has-head.has-actions
 *       header  auto   (shared sheet header: title + actions cluster)              -> #16, composed
 *       body    1fr    overflow-y: auto           <- mandatory                     -> .body
 *       actions auto                                                               -> .actions
 *     backdrop: var(--ui-scrim) + backdrop-filter: blur(var(--ui-scrim-blur))      -> .dialog::backdrop
 *
 * ONE DEPARTURE FROM THE SKELETON, and it buys the other half of the same section.
 * The skeleton writes `min(<intrinsic>, ...)`; this file writes
 * `min(var(--_ui-dialog-inline), calc(100% - 2 * var(--ui-space-6)))` with the
 * private defaulting to 820px. Two reasons, both mechanical:
 *   a) SOURCE numpad-modal.css:13 `width: min(820px, calc(100vw - 48px))` — the
 *      skeleton IS the numpad's rule with the numbers tokenised, and 820px is the
 *      intrinsic width the one dialog §4.6 calls "the best-behaved overlay in the
 *      group" already has. The same section's second half asks for the numpad's
 *      720px breakpoint to be carried "as a container query on the dialog's own box".
 *   b) A container query needs a container, `container-type: inline-size` applies
 *      inline-size CONTAINMENT, and containment on a box whose width is `max-content`
 *      resolves that width to ZERO (measured on ui-menu's host, ui-menu.js:262-276:
 *      inline-block + inline-size containment gave 0x64 for a 200x64 trigger). An
 *      intrinsic width and a container query on the same box are mutually exclusive,
 *      and §4.6 asks for both. A definite private property gives up nothing: a screen
 *      that wants a narrower dialog writes one line, and the width is still clamped
 *      to the window by the same `min()` the skeleton specifies.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE ORACLE ACTUALLY HAS, WHICH IS ONE ELEMENT AND FOUR ANSWERS
 *
 * Nearly every dialog class is invisible to the corpus, because no captured state has
 * an overlay open and `::backdrop` is outside the probe's 18-property surface
 * (styles/tokens.css:41). Measured, prov_query.py find --cls, 49 states searched:
 * `numpad-modal-overlay` 0, `slate-dialog` 0, `notes-modal-overlay` 0,
 * `slate-sheet-actions` 0. But ONE dialog element is in there — the numpad's card in
 * state `modal-numpad` — and every one of its probed answers agrees with a choice
 * this file makes independently from source:
 *
 *   CITE modal-numpad .numpad-modal-container [i=166] width = 820px  <-  numpad-modal
 *        .css `.numpad-modal-container` authored `100%` (the 820 comes from the
 *        overlay's own min(820px, ...)), rect 820x545 captured at 1920x1200
 *                                                     = --_ui-dialog-inline's default
 *   CITE modal-numpad .numpad-modal-container [i=166] border-top-left-radius = 12px
 *        <-  numpad-modal.css `.numpad-modal-container` (token-driven, authored value
 *        not captured: set via a shorthand)             = --ui-radius-xl
 *   CITE modal-numpad .numpad-modal-container [i=166] box-shadow = rgba(0, 0, 0, 0.52)
 *        0px 24px 70px 0px  <-  dark numpad-modal.css `[data-theme='dark']
 *        .numpad-modal-container` authored the same, !important=no (FROZEN/hardcoded)
 *                                       = --ui-elev-3's DARK value, to the byte
 *   CITE modal-numpad .numpad-modal-container [i=166] padding-left = 0px  <-  no
 *        declaration                    = the card holds no inset; its CELLS do
 *
 * The one answer NOT carried is background-color: the oracle computes rgb(26, 33, 39)
 * in dark and --ui-surface is rgb(24, 30, 35). The token sheet is a Step 0 artefact
 * and wins over one sheet's near-miss (spec §3.6); the difference is under a JND on a
 * card and this is the ground every other surface in the app already paints.
 *
 * ---------------------------------------------------------------------------
 * THE DEFECTS THIS COMPONENT RETIRES. Each has an assertion in
 * test/render/ui-dialog.render.test.mjs, cited to its id.
 *
 *   O6 — "No modal component. Seven hand-rolled dialogs, four hand-rolled button
 *        implementations, three focus treatments, EIGHT SCRIM COLOURS, SIX BLUR
 *        RADII, no z-index scale, no motion tokens" (§7.7 O6, `layout/overlays.md`
 *        §2.3, C5). One scrim, from `--ui-scrim`, on the real `::backdrop`; one blur,
 *        from `--ui-scrim-blur`. Asserted as a token drill, because a scrim written
 *        as a literal and a scrim reading the token photograph identically.
 *
 *   H9 — "Both big overlays are aria-modal=true with nothing inert, nothing
 *        aria-hidden, no focus trap and no focus restore — every control behind them
 *        stays focusable" (`index.html:455, 542`).
 *   O8 — "The notes modal is aria-modal=true with no Escape, no focus trap, no
 *        backdrop dismiss and no inert — and it is live on three screens"
 *        (`notes-modal.js:42-45, 66, 72`). §4.6: "Modality is real, or the attribute
 *        comes off." So `aria-modal="true"` is written here and it is EARNED, four
 *        ways, each measured rather than claimed:
 *          - focus outside is refused (a real `focus()` call leaves the caret put);
 *          - a real CDP click outside runs no handler;
 *          - Tab and Shift+Tab cycle inside the dialog and never reach `body`;
 *          - closing puts the caret back on the invoker, synchronously.
 *
 *   S7 — "Modals live in a different coordinate space from the UI that opens them —
 *        a 64px dialog button is 1.5x the 64px rail button beside it"
 *        (`time-picker-modal.css:2-3`; measured `layout/selector.md` V.1). With no
 *        `#scaled-content` transform there is one coordinate space, and the test is
 *        the direct one: the same `ui-button` markup inside the dialog and on the
 *        page behind it renders the same box, to the pixel, at both geometries.
 *
 *   S8 — "The transform makes #scaled-content the containing block for
 *        position: fixed, so the notes overlay covers the CANVAS, and its
 *        z-index: 10000 paints BELOW a body child at 9999" (`notes-modal.css:7-11`).
 *        The top layer is not on the z scale at all: a `<dialog>` opened with
 *        `showModal()` paints above every stacking context in the document, and the
 *        test proves it against a `transform: translateZ(0)` pane at `z-index: 10000`
 *        — the exact shape that beat the notes modal. Which is why this file declares
 *        NO `z-index`: `styles/tokens.css:455-462` says "with no canvas and real
 *        top-layer <dialog>, nothing outside a dialog needs a z-index above
 *        --ui-z-sticky", and a dead `z-index` on a top-layer box would be a number
 *        that reads as load-bearing and is ignored by the engine.
 *
 *   O13 — the repair #16 started, finished here. `.slate-sheet-actions` means a
 *        header cluster in the library and a dialog FOOTER in the shell
 *        (`slate-components.css:690-695` vs `slate-shell.css:2227-2232`). #16 named
 *        its cluster `trail` and left `actions` for this file
 *        (ui-sheet-header.js:220-238). So: the footer is the `actions` slot, and its
 *        three declarations are the shell's own — SOURCE slate-shell.css:2227-2231
 *        `display: flex; justify-content: flex-end; gap: var(--slate-space-4)`
 *        (--ui-space-4) — with the `margin-top: var(--slate-space-7)` replaced by the
 *        cell's own inset and the seam above it.
 *
 * ---------------------------------------------------------------------------
 * ESCAPE, AND WHY IT IS OWNED RATHER THAN LEFT TO THE UA
 *
 * Appendix 13 item 13 keeps exactly two things from the numpad: "its bounded,
 * scrollable card (numpad-modal.css:44-48) and its ESCAPE OWNERSHIP for nested
 * dialogs (numpad-modal.js:252-268) — the only overlay that handles a short viewport,
 * and a real fix to a real problem." That source, verbatim:
 *
 *   "Desktop Chrome can synthesize a separate native `cancel` for every open
 *    top-layer dialog from one Escape key. Own the key before the UA default runs so
 *    a nested numpad closes by itself and the Exit dialog underneath never sees that
 *    same physical gesture."
 *
 * Carried as three parts, and it is the third that does the work here:
 *   1. a CAPTURE-phase `keydown` on the dialog element, which `preventDefault`s,
 *      `stopPropagation`s and `stopImmediatePropagation`s the gesture — so a screen's
 *      own document-level Escape handler never sees it either;
 *   2. `cancel` is `preventDefault`ed, so the UA never closes the dialog behind the
 *      component's back and `close-request` is always the door;
 *   3. a MODULE-LEVEL STACK of open dialogs. Slate could only defend the case where
 *      the inner dialog is a DOM descendant of the outer one; two dialogs opened as
 *      SIBLINGS share no propagation path at all, and the UA's duplicated `cancel`
 *      reaches both. `OPEN_DIALOGS` makes "am I the top-most?" a question with an
 *      answer, and only the top-most acts. Asserted with two sibling dialogs.
 *   4. AND THE SAME QUESTION ONE LAYER DOWN (finding cross-2). "Top-most" is not
 *      "top-most DIALOG": a `ui-menu` open inside an open dialog is the top-most thing
 *      on screen, and part 1's capture listener reached the key first and closed the
 *      dialog UNDER it, stranding a menu whose anchor had just become `display: none`.
 *      So the walk in `#nestedOverlayOwns` runs before anything else: an open overlay
 *      between the caret and this dialog's box takes the press, and this component
 *      does not touch it. See `isOpenOverlay` for why the test is a duck and not a
 *      second registry.
 *
 * ---------------------------------------------------------------------------
 * WHAT `inert` ADDS, GIVEN THE UA ALREADY BLOCKS THE PAGE
 *
 * MEASURED FIRST (probe, both Gate A geometries): under `showModal()` Chrome already
 * refuses `focus()` and swallows clicks outside the dialog, and it computes that on
 * the FLAT tree — slotted light-DOM body content stays fully interactive while
 * everything outside the dialog is blocked. So native modality is not a claim.
 *
 * `#applyInert` is still written, because the row names it and because the two things
 * it adds are not free: `inert` removes the background from the ACCESSIBILITY tree
 * (the `aria-hidden` half of H9's complaint, without putting `aria-hidden` on
 * focusable content), and it is what makes a background pane vanish from
 * `flatTabbables()` rather than merely fail to take focus. It walks the COMPOSED
 * ancestor path — every sibling at every level, crossing shadow boundaries — so a
 * dialog nested three components deep still isolates the app, not just its own
 * parent's children. Every element it marks is remembered and un-marked on close;
 * an element that was ALREADY inert is left alone, which is what makes nesting
 * survive (dialog B marks A's host; when B closes, A is live again). ONE KIND OF
 * SIBLING IS NEVER MARKED — a live region; see `LIVE_REGION_SELECTOR` and finding
 * cross-1, including the measurement showing what the platform does there regardless.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY NOT HERE
 *
 *   - NO NON-MODAL MODE. §4.6 lists seven dialogs and every one of them is modal.
 *     A `show()`-not-`showModal()` path would be a second machinery with no consumer
 *     and none of the guarantees above.
 *   - NO BODY. Not the numpad's keys (#53), not the notes editor (#55), not the time
 *     picker (#54). Those are wave-4 rows that fill the `body` slot.
 *   - NO `z-index`. See S8 above.
 *   - NO EXIT ANIMATION. The entry fade is `opacity var(--ui-dur) var(--ui-ease)`
 *     with `@starting-style`; the exit is instant, deliberately. An animated exit
 *     needs `transition-behavior: allow-discrete` to hold the box on screen, and the
 *     closing frame is precisely the one in which the page behind must already be
 *     interactive — a dead dialog painted over a live page is the same class of lie
 *     as a modal that is not modal.
 *   - NO SCROLL LOCK ON THE PAGE. The top layer does not scroll the document, and
 *     `body { overflow: hidden }` written by an overlay is how the old app lost its
 *     scroll position (`main.css:153-155` is already the app-wide version of it).
 *
 * ---------------------------------------------------------------------------
 * API
 *   <ui-dialog heading="Drink out" open>
 *     <ui-icon-button slot="header-trail" label="Close"></ui-icon-button>
 *     <div slot="body">...</div>
 *     <ui-button slot="actions">Cancel</ui-button>
 *     <ui-button slot="actions" variant="primary">Confirm</ui-button>
 *   </ui-dialog>
 *
 *   open           reflected boolean. Setting it opens/closes; the attribute form is
 *                  what lets the gallery declare an open dialog in static markup.
 *   heading        the title, handed to #16. Also the accessible name (an IDREF does
 *                  not cross a shadow boundary, so the name is the same string, in
 *                  one place — ui-sheet-header.js:277-281).
 *   label          accessible name when a custom `header` slot means there is no
 *                  `heading` string to borrow. Defaults to `heading`.
 *   level          1..6, forwarded to #16's heading element.
 *   invoker        the element focus returns to. Defaults to whatever had the caret
 *                  when the dialog opened.
 *   show({invoker, reason}) / hide(reason) / toggle(reason) / requestClose(reason)
 *
 *   slots          header       replaces the built-in #16 header entirely
 *                  header-trail forwarded into #16's `trail` cluster
 *                  body         the scroll region; the DEFAULT slot lands here too
 *                  actions      the footer cluster (O13's other name)
 *
 *   events         close-request  {reason}  CANCELLABLE — preventDefault refuses the
 *                                 dismissal, which is how a dialog with unsaved work
 *                                 keeps Escape and the backdrop from throwing it away
 *                  open-change    {open, reason}
 *
 *   --_ui-dialog-inline   the intrinsic width, default 820px
 *   --_ui-dialog-pad      the cell inset, default --ui-space-5 (18px under 720px)
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';
import {
    deepActiveElement,
    firstAutofocus,
    flatTabbables,
    trapTarget,
    NON_RENDERED_TAGS,
} from 'src/lib/focus-trap.js';
import 'src/components/ui-sheet-header.js';

/**
 * Every open dialog, oldest first. The answer to "is this gesture mine?" when one
 * Escape reaches two dialogs that share no propagation path — see ESCAPE above.
 * Module-level because the question is about the DOCUMENT's top layer, which is one
 * thing however many components are looking at it.
 */
export const OPEN_DIALOGS = [];

/** The levels #16 accepts. Kept in step with SHEET_HEADING_LEVELS by forwarding the
 *  raw value: #16 normalises it, so this file has no second opinion. */
export const DEFAULT_LEVEL = 2;

/**
 * THE OVERLAY PROTOCOL, as one predicate — finding cross-2.
 *
 * Appendix 13 says "the top-most overlay acts". `OPEN_DIALOGS` answers that for
 * dialogs, which is the case the numpad could not defend; it cannot answer it for a
 * LIGHTER overlay nested inside a dialog, because a stack of dialogs contains no
 * menus. MEASURED, both geometries: a `ui-menu` open inside an open `ui-dialog`, its
 * surface holding the caret and hit-testing top-most, and one Escape closed the DIALOG
 * UNDERNEATH — the capture-phase listener below owns the key before the menu's own
 * handler (ui-menu.js:996) can ever see it — leaving a menu whose anchor is now
 * `display: none` and which no second press could reach.
 *
 * The answer is a duck, not a registry: an open overlay is a custom element that is
 * `open` and can be told to `hide()`. Both this component and `ui-menu` are that shape
 * already, so nothing has to be registered, nothing can leak on an unmount, and a
 * component that grows the same two members joins by existing. `<details open>` and a
 * bare `<dialog open>` are not — neither has `hide()` — which is the discrimination
 * that matters, because both can legitimately sit in a dialog body.
 *
 * Read across `composedPath()` up to this dialog's own box, so it is the gesture's
 * path that decides and not a global "is anything open anywhere".
 */
const isOpenOverlay = (node) => Boolean(
    node
    && node.nodeType === 1 /* Node.ELEMENT_NODE */
    && typeof node.localName === 'string'
    && node.localName.includes('-')
    && node.open === true
    && typeof node.hide === 'function',
);

/**
 * A live region is never isolated — finding cross-1's first half.
 *
 * MEASURED (CDP `Accessibility.getFullAXTree`, BENCH): with a modal `<dialog>` open,
 * a body-level `role="status"` region is absent from the accessibility tree WHETHER OR
 * NOT this component marked it `inert`, and so is the same region promoted into the
 * top layer as a `popover`. That removal is the platform's own "blocked by a modal
 * dialog", not ours, and no attribute here can undo it — see ui-toast.js's DEPARTURE
 * on the same finding for the half that CAN be fixed (paint).
 *
 * The exemption stays regardless, and it is not decoration: a mark this component
 * makes must never be the reason a status region goes quiet, on any path where the
 * platform is not already doing it (a non-modal presentation, a mark that outlives its
 * dialog). Marking a live region is the one case where "isolate the page" is the wrong
 * instruction.
 */
const LIVE_REGION_SELECTOR = '[aria-live], [role="status"], [role="alert"], [role="log"], [role="timer"]';

export class UiDialog extends UiElement {
    static properties = {
        /** Reflected: the gallery declares an open dialog in static markup, screens
         *  style around one, and the suite reads it. */
        open: { type: Boolean, reflect: true },
        heading: { type: String },
        label: { type: String },
        level: { type: Number },
        /** Whether a custom `header` slot has an element in it. */
        _hasHeader: { state: true },
        /** Whether the `header-trail` cluster has one. */
        _hasHeaderTrail: { state: true },
        /** Whether the footer has one. */
        _hasActions: { state: true },
    };

    static styles = css`
        /* ---------------------------------------------------------------
         * THE HOST HAS NO BOX.
         *
         * A modal dialog lives in the TOP LAYER: its geometry comes from the
         * viewport, not from wherever the consumer happened to write the tag. A
         * host with the base's display: block would leave a full-width, zero-height
         * block in the middle of somebody's grid — an invisible row that moves
         * their layout by one gap. display: contents removes the box and leaves the
         * shadow tree exactly where it is.
         *
         * container-type goes back to normal for the same reason the menu does it
         * (ui-menu.js:262-276): a box that does not exist cannot be a container,
         * and this component's one container query resolves against the DIALOG,
         * which is the box §4.6 names ("a container query on the dialog's own box").
         * ------------------------------------------------------------- */
        :host {
            display: contents;
            container-type: normal;

            /* THE TWO ESCAPE HATCHES, ON THE HOST AND NOT ON .dialog — the same
             * placement, for the same reason, as #16's --_ui-sheet-head-min
             * (ui-sheet-header.js:311-320). A custom property declared on the
             * element that USES it beats the value inherited from outside, so a
             * private declared on .dialog would be a private a screen cannot set:
             * measured, ui-dialog { --_ui-dialog-inline: 4000px } from the light DOM
             * moved nothing at all until these two moved up here. On :host it is a
             * default that an outer declaration overrides, which is what a documented
             * knob has to be.
             *
             * SOURCE numpad-modal.css:13 width: min(820px, calc(100vw - 48px)) — the
             * intrinsic half; see "ONE DEPARTURE" in the header.
             * SOURCE numpad-modal.css:61 padding: 24px = --ui-space-5. */
            --_ui-dialog-inline: 820px;
            --_ui-dialog-pad: var(--ui-space-5);
        }

        /* ---------------------------------------------------------------
         * THE DIALOG. Every line of §4.6's skeleton, and nothing else.
         *
         * inset: 0 with margin: auto is the centring; SOURCE numpad-modal.css:8-20,
         * whose own comment says why the insets are pinned: "Native dialog defaults
         * can stretch an auto-height top-layer box to its max-height. Pin every
         * inset to auto so the dialog's border box hugs the bounded card instead of
         * leaving a full-height invisible click sheet." That invisible sheet is not
         * cosmetic here — it is what the backdrop-dismiss hit test would have to
         * fight.
         *
         * THE GRID IS THE SEAM (CONVENTIONS §13: a divider is a gap, not a border).
         * The dialog paints --ui-line and each cell paints --ui-surface over it, so
         * the only ink that shows is the one hairline gap between rows. Slate drew
         * that line four different ways — .slate-sheet-header's border-bottom,
         * .numpad-modal-header-divider's margins, and two more — and #16 dropped its
         * border for exactly this (ui-sheet-header.js "departure 1").
         *
         * NOT the seams.js fragment: its .seam-grid sets display, gap and ground in
         * one class and this box needs all three to be conditional on which cells
         * exist. Same call ui-menu made for its .group (ui-menu.js:427-433).
         * ------------------------------------------------------------- */
        .dialog {
            inset: 0;
            margin: auto;
            padding: 0;
            border: 0;
            inline-size: min(var(--_ui-dialog-inline), calc(100% - 2 * var(--ui-space-6)));
            max-block-size: calc(100% - 2 * var(--ui-space-5));
            block-size: fit-content;

            /* The container §4.6 asks for. Safe because the inline size above is
             * definite in both arms of the min(). */
            container-type: inline-size;

            /* NO display DECLARATION HERE, AND THAT IS BUG P13's SHAPE.
             *
             * "Closed dialogs stay in the tab order: DaisyUI's .modal sets
             * display: grid; opacity: 0 with no visibility: hidden, DEFEATING THE
             * UA'S dialog:not([open]) { display: none }. Measured 16 focusables
             * inside dialog:not([open]) out of 30 on the page" (§7.7 P13, generated
             * app.css). An author declaration beats the UA sheet whatever its
             * specificity, so a display: grid written on the ELEMENT rather than
             * on the open STATE is that bug, exactly, one framework later — and it
             * was: with it here, the closed dialog laid out over the page and
             * swallowed the press on its own invoker (measured, both geometries,
             * before this comment existed). The layout belongs to .dialog[open].
             *
             * The grid TEMPLATE stays out here because it costs nothing on a box
             * that is not displayed, and keeping the three row-count rules together
             * is worth more than symmetry with the display. */
            grid-template-rows: minmax(0, 1fr);
            gap: var(--ui-seam);

            background-color: var(--ui-line);
            border-radius: var(--ui-radius-xl);
            box-shadow: var(--ui-elev-3);
            color: var(--ui-text);

            opacity: 0;
            transition: opacity var(--ui-dur) var(--ui-ease);
        }

        /* THE ROW COUNT IS THE CELL COUNT. §4.6's three-row template is the case
         * where all three cells exist; a confirm dialog with no header would
         * otherwise keep an empty 0px track AND the seam gap above it, which draws a
         * hairline against nothing at the top of the card. Ordered so that
         * has-head.has-actions (0,3,0) wins, and has-actions after has-head so the
         * two (0,2,0) singles resolve by source order rather than by luck. */
        .dialog.has-head {
            grid-template-rows: auto minmax(0, 1fr);
        }

        .dialog.has-actions {
            grid-template-rows: minmax(0, 1fr) auto;
        }

        .dialog.has-head.has-actions {
            grid-template-rows: auto minmax(0, 1fr) auto;
        }

        .dialog[open] {
            display: grid;
            opacity: 1;
        }

        /* The fade is on the way IN only (header, "NO EXIT ANIMATION"). Without
         * @starting-style there is no start value to transition FROM and the
         * declaration above would be inert on the first paint. */
        @starting-style {
            .dialog[open] {
                opacity: 0;
            }
        }

        /* ---------------------------------------------------------------
         * THE SCRIM — O6's eight colours and six radii, once.
         * §4.6: "backdrop: var(--ui-scrim) + backdrop-filter:
         * blur(var(--ui-scrim-blur))", and "Backdrop, not a canvas blur ... With no
         * canvas the ::backdrop works directly" — three sheets blur #scaled-content
         * from the outside today because a top-layer ::backdrop cannot reach it
         * (numpad-modal.css:35-37, profile-editor-v3.css:899, :1237).
         *
         * MEASURED, because ::backdrop only began inheriting from its originating
         * element in recent Chrome and a var() that does not resolve here would be a
         * TRANSPARENT scrim that photographs as "slightly odd": the two custom
         * properties resolve, rgba(0, 0, 0, 0.56) and blur(6px), at both geometries.
         * ------------------------------------------------------------- */
        .dialog::backdrop {
            background-color: var(--ui-scrim);
            backdrop-filter: blur(var(--ui-scrim-blur));
            opacity: 0;
            transition: opacity var(--ui-dur) var(--ui-ease);
        }

        .dialog[open]::backdrop {
            opacity: 1;
        }

        @starting-style {
            .dialog[open]::backdrop {
                opacity: 0;
            }
        }

        /* CONVENTIONS §11 — the base carries no reduced-motion rule and says it
         * "belongs in styles/document.css or in each animating component". Same
         * shape as ui-progress-track.js:323. Not a width query: §2.1 Rule 1 bans a
         * component reading the VIEWPORT; this reads a user preference. */
        @media (prefers-reduced-motion: reduce) {
            .dialog,
            .dialog::backdrop {
                transition-duration: 0s;
            }
        }

        /* ---------------------------------------------------------------
         * THE CELLS. Opaque, so the grid's ink shows only in the gaps.
         * ------------------------------------------------------------- */
        .cell {
            background-color: var(--ui-surface);
            padding: var(--_ui-dialog-pad);
        }

        /* The card's corners, on the cells rather than on the dialog, because
         * clipping them with overflow: hidden on the dialog would clip every focus
         * ring inside it — bug L24's class exactly (--ui-focus-w is 3px and sits
         * OUTSIDE the box at --ui-focus-offset). With one cell only, both rules
         * match it and all four corners round. */
        .cell:first-child {
            border-start-start-radius: var(--ui-radius-xl);
            border-start-end-radius: var(--ui-radius-xl);
        }

        .cell:last-child {
            border-end-start-radius: var(--ui-radius-xl);
            border-end-end-radius: var(--ui-radius-xl);
        }

        /* The built-in header already carries its own bottom inset — #16's .head has
         * padding-block-end: var(--ui-space-4) (ui-sheet-header.js:339) — and the
         * seam is the line under it. Doubling the two would put 42px between a title
         * and its own rule. A CUSTOM header slot owns its own inset, so it keeps the
         * cell's. */
        .head.sheet {
            padding-block-end: 0;
        }

        /* ---------------------------------------------------------------
         * THE BODY — §4.6's one mandatory word, and spec §2.4's floor.
         *
         * "Bounded and scrollable is mandatory. Only the numpad does this today
         * (numpad-modal.css:44-48) and it is the best-behaved overlay in the group.
         * The time picker overflow: visibles at max-height: 96vh ...; the notes
         * container is overflow: hidden with nothing scrolling."
         *
         * §2.4 wants three things from every scroll region: an explicit floor, an
         * explicit overflow, and "a defined order of surrender when the container is
         * shorter than the sum of the floors". The floor is one control row, the
         * same one ui-menu's list takes (ui-menu.js:421-425). THE ORDER OF SURRENDER
         * is the grid: header and footer are auto tracks and do not shrink, the
         * body is the only 1fr track, so a short window is absorbed here and nowhere
         * else — and the last thing to go is the way out of the dialog.
         *
         * NO --_ui-focus-offset FLIP HERE, and the reason is worth writing down
         * because the obvious line does nothing. ui-menu's list sets
         * --_ui-focus-offset: var(--ui-focus-offset-inset) on its scrollport
         * (ui-menu.js:422) and that works because the rows it scrolls are in its OWN
         * shadow tree. Everything this scrollport holds arrives through a slot, and
         * base.js:429-437 declares --_ui-focus-offset on every UiElement :host — a
         * declaration on the element that uses the property, which beats the value
         * inherited from this cell. So the line would be inert for exactly the
         * children it was written for. A control that sits flush against the top of
         * a body sets focus-ring="inset" on itself, which is the one-word opt-out the
         * base already documents; the cell's own --_ui-dialog-pad keeps every other
         * case clear of the edge. Recorded as a deferred question.
         * ------------------------------------------------------------- */
        .body {
            min-block-size: var(--ui-control-h);
            overflow-y: auto;
        }

        /* ---------------------------------------------------------------
         * THE FOOTER — O13's second name.
         * SOURCE slate-shell.css:2227-2231 display: flex; justify-content: flex-end;
         * gap: var(--slate-space-4). The margin-top there is replaced by this cell's
         * own inset plus the seam above it.
         * flex-wrap, because three buttons at --ui-control-h in a 380px dialog is a
         * real arrangement and the alternative is a footer that overflows its card.
         * ------------------------------------------------------------- */
        .actions {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: flex-end;
            gap: var(--ui-space-4);
        }

        /* After .head/.body/.actions so it wins the (0,1,0) tie on source order —
         * the same shape ui-sheet-header.js:394 uses. A display: none child is not a
         * grid item at all, so the row count and the seam count stay honest. */
        .is-empty {
            display: none;
        }

        /* ---------------------------------------------------------------
         * THE ONE BREAKPOINT §4.6 KEEPS, as the container query it asks for.
         *
         * "One real breakpoint survives here, and it is correct.
         * numpad-modal.css:411 (max-width: 720px) ... query the real window, which
         * for a top-layer dialog is the only query that means anything. Carry that
         * as a container query on the dialog's own box."
         *
         * The shell's share of that rule is one declaration —
         * numpad-modal.css:416 padding 24px -> 18px, which is --ui-space-5 ->
         * --ui-space-4. Everything else inside those two media blocks is the
         * numpad's BODY (its keys, its input box, its divider) and belongs to #53.
         *
         * Note what the query is asked about: the DIALOG's inline size, not the
         * window's. At 1281 and at 1000 the dialog is its intrinsic 820px and this
         * does not fire, which matches the audit's own note that "neither fires on
         * the bench tablet". It fires when a screen narrows the dialog, which is the
         * case §2.1 Rule 1 exists to make possible.
         * ------------------------------------------------------------- */
        @container (max-width: 720px) {
            .cell {
                --_ui-dialog-pad: var(--ui-space-4);
            }
        }
    `;

    constructor() {
        super();
        this.open = false;
        this.heading = '';
        this.label = '';
        this.level = DEFAULT_LEVEL;
        /** The element focus returns to. Null means "whoever had it at open". */
        this.invoker = null;

        this._hasHeader = false;
        this._hasHeaderTrail = false;
        this._hasActions = false;

        this.#returnFocusTo = null;
        this.#inerted = [];
        this.#presented = false;
    }

    #returnFocusTo;

    #inerted;

    /** True between showModal() and close(). Makes present/dismiss idempotent, so
     *  the property path and the method path cannot double-fire. */
    #presented;

    /**
     * Where the press that may become a click STARTED — finding cmodality-1.
     * `true` outside the card, `false` on or inside it, `null` for a click that had
     * no press at all (a synthetic dispatch, a keyboard-driven `.click()`). See
     * `#onClick`, which is the only reader.
     */
    #pressOutside = null;

    /* ---- what the component is ---------------------------------------------- */

    /**
     * The native dialog element. Public because wave 5.2 integrates real bodies into
     * this shell and a body may need the platform object — and because a body that
     * closes the thing it sits in must not leave the component behind: the `close`
     * listener in firstUpdated() is what makes `el.dialog.close()` a supported path
     * rather than a way to strand an inert page. Asserted.
     *
     * Note for whoever reaches for `form method="dialog"` in a slotted body: the
     * form's nearest ancestor dialog is looked up in ITS node tree, and a slotted
     * body's ancestors are the host, not the shadow tree's dialog. Use
     * `requestClose()` or this element.
     */
    get dialog() {
        return this.renderRoot?.querySelector?.('#dialog') ?? null;
    }

    /** The accessible name. An IDREF cannot cross a shadow boundary, so the name is
     *  the same STRING that is on screen rather than a pointer at it. */
    get accessibleName() {
        return this.label || this.heading || '';
    }

    /** Is a header rendered at all? A cluster-only header is a legitimate #16 shape
     *  (ui-sheet-header.js:266-268), so a trail with no heading still makes one. */
    get headed() {
        return Boolean(this._hasHeader || this.heading || this._hasHeaderTrail);
    }

    /** Am I the dialog a stray Escape belongs to? See ESCAPE in the header. */
    get topmost() {
        return OPEN_DIALOGS.length > 0 && OPEN_DIALOGS[OPEN_DIALOGS.length - 1] === this;
    }

    /** Every control the trap will cycle through, in flat-tree order. Public
     *  because "the trap traps" is a claim about THIS list and a test should be
     *  able to read it rather than infer it from where the caret ended up. */
    get tabbables() {
        const dialog = this.dialog;
        return dialog ? flatTabbables(dialog) : [];
    }

    /* ---- the public surface -------------------------------------------------- */

    /**
     * Open, modally, and take focus.
     *
     * The return target is captured HERE and not at close time, which is the whole
     * of "focus restore": by the time anything closes, the caret is inside the
     * dialog and the element that opened it is unknowable.
     */
    show({ invoker = null, reason = 'api' } = {}) {
        if (this.open) return;
        this.#returnFocusTo = invoker ?? this.invoker ?? deepActiveElement();
        this.#reason = reason;
        this.open = true;
    }

    /**
     * Close, returning focus SYNCHRONOUSLY to the invoker — before this call
     * returns, and exactly once.
     *
     * ONE RESTORE, NOT TWO, and the lesson is wave 3's own: `cmodality-1` moved
     * ui-menu's restore INTO hide() because leaving it to updated() (a microtask
     * later) took the caret back from any handler that had moved it. The same shape
     * would be worse here — a dialog's close handler opening the NEXT dialog is the
     * normal case, not the exotic one.
     */
    hide(reason = 'api') {
        if (!this.open) return;
        this.#reason = reason;
        this.open = false;
        this.#dismiss();
    }

    toggle(reason = 'api') {
        if (this.open) this.hide(reason);
        else this.show({ reason });
    }

    /**
     * ASK to close. Every dismissal the USER drives comes through here — Escape and
     * the backdrop — and a consumer that preventDefaults `close-request` keeps the
     * dialog open. That is the whole opt-out: no `persistent` attribute, no second
     * spelling of "not dismissible", and it covers the case attributes cannot (a
     * dialog that refuses only while its form is dirty).
     *
     * `hide()` does NOT go through here: an app closing its own dialog has already
     * decided.
     */
    requestClose(reason = 'api') {
        if (!this.open) return false;
        const allowed = this.dispatchEvent(new CustomEvent('close-request', {
            detail: { reason },
            bubbles: true,
            composed: true,
            cancelable: true,
        }));
        if (!allowed) return false;
        this.hide(reason);
        return true;
    }

    /* ---- lifecycle ----------------------------------------------------------- */

    #reason = 'api';

    willUpdate(changed) {
        if (changed.has('level')) {
            const raw = Number.parseInt(this.level, 10);
            if (!Number.isFinite(raw)) this.level = DEFAULT_LEVEL;
        }
    }

    firstUpdated() {
        /* CAPTURE, and on the dialog element rather than the host: an event from
         * slotted light DOM passes through the slot's ancestors in its composed
         * path, so the dialog element sees every key pressed anywhere inside it —
         * including inside a nested shadow root — before the content does. That
         * ordering is Appendix 13's requirement, not a preference. */
        this.dialog?.addEventListener('keydown', this.#onKeydown, true);
        /* A close this component did not make: el.dialog.close() from a body, or a
         * form with method="dialog" INSIDE the shadow tree. Without this the property
         * would say open while the top layer says closed, the inert marks would never
         * be released, and the page would sit dead with nothing on screen to explain
         * it. Asserted through the public `dialog` getter. */
        this.dialog?.addEventListener('close', this.#onNativeClose);
    }

    updated(changed) {
        super.updated(changed);
        if (!changed.has('open')) return;
        if (this.open) this.#present();
        else this.#dismiss();

        /* A CLOSED dialog reaching its first render is not an event. Lit puts every
         * property set before the first update into changedProperties with an old
         * value of undefined, so without this line every ui-dialog on a screen
         * announces open: false the moment it mounts, and a consumer counting
         * open-change events counts one per dialog before anything has happened. A
         * dialog that mounts already open IS an event and still announces. */
        const previous = changed.get('open');
        const reason = this.#reason;
        this.#reason = 'api';
        if (previous === undefined && !this.open) return;

        this.dispatchEvent(new CustomEvent('open-change', {
            detail: { open: this.open, reason },
            bubbles: true,
            composed: true,
        }));
    }

    /**
     * A RE-PARENTED DIALOG IS STILL THE SAME DIALOG — finding cmodality-2.
     *
     * `firstUpdated()` runs ONCE, and it is where the capture-phase `keydown` (Escape
     * ownership AND the whole Tab branch) and the native `close` listener are attached;
     * `disconnectedCallback()` takes both off, because a component that leaves its
     * listeners on a detached tree is the other half of the inert-marks bug. Without
     * the symmetric re-attach here, a plain `removeChild` + `appendChild` of an OPEN
     * dialog — what a screen does when it moves a region, and what the gallery does to
     * its stage — left the component permanently desynced: MEASURED, BENCH, host
     * `open === true`, native `dialog.open === false`, computed `display: none`, no
     * `open-change` announced. The app believed a dialog was open with nothing on
     * screen. Forcing it shut and open again re-presented it, but five real CDP Tab
     * presses then walked `btn → BODY → btn → btn → BODY`: the caret on document.body,
     * the exact dead step `focus-trap.js` exists to remove, because the listener that
     * carries the trap was gone.
     *
     * `hasUpdated` is the guard: on the FIRST connect there is no render root yet and
     * `firstUpdated()` owns the attach. `addEventListener` is idempotent for the same
     * function and phase, so a belt-and-braces double call cannot double-fire.
     *
     * This is the shape `ui-tab-bar.js:414` already uses for the same reason.
     */
    connectedCallback() {
        super.connectedCallback();
        if (!this.hasUpdated) return;
        this.dialog?.addEventListener('keydown', this.#onKeydown, true);
        this.dialog?.addEventListener('close', this.#onNativeClose);
        /* The property survived the move; the top layer did not. Re-present so the two
         * agree again — `#present()` is idempotent through `#presented`, which the
         * disconnect cleared. */
        if (this.open) this.#present();
    }

    disconnectedCallback() {
        /* The gallery replaces its stage with innerHTML, which disconnects an open
         * dialog. Chrome drops it from the top layer; the inert marks are OURS and
         * would otherwise outlive the component that made them — a permanently
         * inert page, with nothing on screen to explain it. */
        const returnTo = this.#returnFocusTo;
        this.#dismiss({ restoreFocus: false });
        /* A disconnect may be a MOVE (see connectedCallback), and a move does not
         * change who opened the dialog. `#restoreFocus` already ignores a target that
         * has left the document, so keeping it costs nothing and a re-parented dialog
         * still knows where the caret goes home to. */
        this.#returnFocusTo = returnTo;
        this.dialog?.removeEventListener('keydown', this.#onKeydown, true);
        this.dialog?.removeEventListener('close', this.#onNativeClose);
        super.disconnectedCallback();
    }

    /* ---- present / dismiss --------------------------------------------------- */

    #present() {
        const dialog = this.dialog;
        if (!dialog || this.#presented) return;
        if (!this.isConnected) return;
        this.#presented = true;
        this.#pressOutside = null;
        /* THE DECLARATIVE PATH'S RESTORE TARGET. show() captures it before anything
         * moves; `dialog.open = true` — the gallery's form, and a screen's — passes
         * through no method of ours, and this component takes focus on that path too.
         * Captured HERE, before showModal(), because showModal() is the thing that
         * moves the caret: one line later there is nothing left to remember, and the
         * caret would land on document.body at close, which is §4.6's own defect
         * arriving by the other door. */
        if (!this.#returnFocusTo) this.#returnFocusTo = this.invoker ?? deepActiveElement();
        if (!OPEN_DIALOGS.includes(this)) OPEN_DIALOGS.push(this);
        this.#applyInert();
        if (!dialog.open) dialog.showModal();
        this.#focusOnOpen();
    }

    #dismiss({ restoreFocus = true } = {}) {
        const dialog = this.dialog;
        if (!this.#presented) {
            /* Still release anything a half-open state left behind. */
            this.#releaseInert();
            return;
        }
        this.#presented = false;
        this.#pressOutside = null;
        /* NOTHING THIS DIALOG HELD STAYS OPEN BEHIND IT — cross-2's second half. A menu
         * open in the body when the dialog closes by any other door (the header's close
         * button, `hide()`, a native close) keeps `open === true` while its anchor is
         * `display: none`: nothing on screen can dismiss it, and re-opening the dialog
         * shows a menu the user never asked for. Light DOM only, which is where a
         * slotted body's overlays live; an overlay buried in a screen component's own
         * shadow root is that component's to close. */
        this.#closeNestedOverlays();
        if (dialog?.open) dialog.close();
        const at = OPEN_DIALOGS.indexOf(this);
        if (at !== -1) OPEN_DIALOGS.splice(at, 1);
        this.#releaseInert();
        if (restoreFocus) this.#restoreFocus();
        else this.#returnFocusTo = null;
    }

    /** See the call in `#dismiss()`. Silent about anything that is not an overlay. */
    #closeNestedOverlays() {
        for (const node of this.querySelectorAll('*')) {
            if (isOpenOverlay(node)) node.hide('dismiss');
        }
    }

    /* ---- focus ---------------------------------------------------------------- */

    /**
     * `autofocus` first, then the first control the trap knows about, then the
     * dialog box itself — which is why the dialog carries tabindex="-1": a dialog
     * whose body is a paragraph has nothing to focus, and leaving the caret outside
     * would mean the very first Tab escapes the trap it never entered.
     *
     * `showModal()` has already moved focus by the time this runs; it honours
     * `autofocus` only among its own DOM descendants, so a slotted body's autofocus
     * is invisible to it. Doing it again here is not redundant, it is the half that
     * covers the slots.
     */
    #focusOnOpen() {
        const dialog = this.dialog;
        if (!dialog) return;
        const target = firstAutofocus(dialog) ?? flatTabbables(dialog)[0] ?? dialog;
        target.focus?.();
    }

    /**
     * The half spec §4.6 says every overlay in the old app is missing: "no inert, no
     * aria-hidden, no focus trap, no focus restore". Chrome restores focus on
     * `close()` by itself, and this runs AFTER it deliberately: the UA restores to
     * whatever had focus when `showModal()` ran, which is not the same thing as the
     * invoker a consumer named, and it knows nothing about an element that has since
     * been re-rendered.
     */
    #restoreFocus() {
        const target = this.#returnFocusTo;
        this.#returnFocusTo = null;
        if (!target || !target.isConnected || typeof target.focus !== 'function') return;
        target.focus();
    }

    /* ---- modality ------------------------------------------------------------- */

    /**
     * Mark every sibling on the composed path from this host to the document.
     * Crossing shadow boundaries is the point: a dialog opened by a screen component
     * three roots deep must isolate the APP, and stopping at its own parent would
     * isolate a div.
     */
    #applyInert() {
        const marked = new Set();
        let node = this;
        /* A cap, not a belief: a cycle here would hang the page with the dialog
         * half-open, and 200 levels is far past any tree this app builds. */
        for (let guard = 0; node && guard < 200; guard += 1) {
            const parent = node.parentNode;
            if (!parent) break;
            /* The document's one element child is <html>; there is nothing beside it
             * to isolate, and marking it would inert the dialog with everything else. */
            if (parent.nodeType === 9 /* Node.DOCUMENT_NODE */) break;

            for (const sibling of parent.children ?? []) {
                if (sibling === node || marked.has(sibling)) continue;
                if (sibling.inert === true) continue;
                if (NON_RENDERED_TAGS.includes(sibling.tagName)) continue;
                /* cross-1: a status region is not background. See LIVE_REGION_SELECTOR. */
                if (sibling.matches?.(LIVE_REGION_SELECTOR)) continue;
                sibling.inert = true;
                marked.add(sibling);
            }

            /* THE FLAT-TREE HOP. A slotted node's rendered position is at its SLOT,
             * inside somebody else's shadow root, and `parentNode` knows nothing
             * about it — so a walk on the DOM tree alone leaves every sibling on the
             * shadow side of the boundary live. Stepping to the slot puts the next
             * round among those siblings; the round just finished has already
             * covered this node's light-DOM ones. */
            const slot = node.assignedSlot;
            if (slot) { node = slot; continue; }

            /* Otherwise up one level, crossing a shadow root to its host: a
             * ShadowRoot has no parentNode of its own. */
            node = parent.host ?? parent;
        }
        this.#inerted = [...marked];
    }

    /** Exactly what was marked, and nothing else. */
    #releaseInert() {
        for (const element of this.#inerted) element.inert = false;
        this.#inerted = [];
    }

    /* ---- events --------------------------------------------------------------- */

    /**
     * Escape and Tab, in capture, on the dialog. Appendix 13 item 13's ownership and
     * the measured wrap-through-body fix, in one listener because they are one
     * question: which element does this key press belong to.
     */
    #onKeydown = (event) => {
        if (event.key === 'Escape' || event.keyCode === 27) {
            /* NOT EVERY ESCAPE INSIDE THIS BOX IS THIS BOX'S — finding cross-2. An
             * overlay of its own on the gesture's path, between the caret and this
             * dialog's box, is the top-most thing on screen and Appendix 13 gives it
             * the key. Stand fully down: no preventDefault, no stopPropagation, so the
             * press reaches the handler that will consume it. Everything below is
             * unchanged for the case where nothing is nested — which is every case the
             * suite had before this one. */
            if (this.#nestedOverlayOwns(event)) return;
            /* Own it whether or not this dialog acts on it: a nested dialog closing
             * itself must not let the same physical gesture reach the one
             * underneath, and a screen's document-level Escape must not see it
             * either (numpad-modal.js:260-268). */
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            if (this.topmost) this.requestClose('escape');
            return;
        }
        if (event.key !== 'Tab') return;

        const items = this.tabbables;
        const dialog = this.dialog;
        if (!items.length) {
            /* Nothing to cycle: the caret stays on the dialog box rather than
             * stepping out to body and leaving a modal dialog behind it. */
            event.preventDefault();
            dialog?.focus?.();
            return;
        }
        const target = trapTarget(items, deepActiveElement(), { backwards: event.shiftKey });
        if (!target) return;   /* an interior step: the browser's own is the right one */
        event.preventDefault();
        target.focus();
    };

    /**
     * Is there an open overlay between the caret and this dialog's own box?
     *
     * The walk stops AT `this.dialog`, so it reads only what is nested INSIDE this
     * dialog — this component's own host sits beyond that point and can never match
     * itself, and a sibling dialog is not on this path at all.
     */
    #nestedOverlayOwns(event) {
        const boundary = this.dialog;
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        for (const node of path) {
            if (node === boundary) return false;
            if (isOpenOverlay(node)) return true;
        }
        return false;
    }

    /**
     * The UA's own close request. Always prevented, so `close-request` is the only
     * door; only the top-most dialog acts, because desktop Chrome can synthesise one
     * `cancel` per open dialog from a single Escape (numpad-modal.js:252-256).
     */
    #onCancel = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (this.topmost) this.requestClose('escape');
    };

    /** A native close this component did not ask for — see firstUpdated(). */
    #onNativeClose = () => {
        if (!this.open) return;
        /* A STALE ANNOUNCEMENT. `close` is queued, not fired synchronously, so a
         * re-parent — close on disconnect, `showModal()` again on connect, both in one
         * task — delivers it AFTER the dialog is back on screen. The platform's own
         * state is the arbiter: a dialog that is presenting has not closed. */
        if (this.dialog?.open) return;
        this.#reason = 'native';
        this.open = false;
        this.#dismiss();
    };

    /**
     * Backdrop dismissal — O8's "no backdrop dismiss", and the reason it needs three
     * tests rather than one. A click on the `::backdrop` is dispatched AT the dialog
     * element, and so is a click on the 1px seam gap between two cells, because the
     * gap is the dialog's own background showing through. Target alone would make
     * that hairline a dismiss button, so the point has to be outside the border box —
     * and the point alone dismisses on a drag that merely ENDED outside, which is
     * `#onPointerDown` below.
     *
     * Is this pointer event's own point within the card's border box?
     */
    #pointInCard(event) {
        const box = this.dialog?.getBoundingClientRect();
        if (!box) return false;
        return event.clientX >= box.left && event.clientX <= box.right
            && event.clientY >= box.top && event.clientY <= box.bottom;
    }

    /**
     * A DISMISS IS TWO POINTS, NOT ONE — finding cmodality-1. A `click` is dispatched
     * at the nearest common ancestor of its press and its release, with the RELEASE's
     * coordinates, so a press that starts in the card and ends past its edge — an
     * ordinary text drag, a flick in the scrolling body that runs out of list — arrives
     * here targeted at the dialog with a point outside the box, and the point test
     * alone read it as a backdrop press. MEASURED, BENCH, real CDP: press at (card
     * centre-x, card top + 60), move and release 40px below the card, `open === false`.
     * Whatever the user was in the middle of went with it.
     *
     * So the press end is latched too. `null` — a click with no press before it, which
     * is a synthetic dispatch or a keyboard-driven `.click()` — keeps the old
     * behaviour rather than inventing a rule for a gesture nobody made.
     */
    #onPointerDown = (event) => {
        this.#pressOutside = event.target === this.dialog && !this.#pointInCard(event);
    };

    #onClick = (event) => {
        const startedOutside = this.#pressOutside;
        this.#pressOutside = null;
        if (event.target !== this.dialog) return;
        if (this.#pointInCard(event)) return;
        if (startedOutside === false) return;
        this.requestClose('backdrop');
    };

    #onHeaderSlotChange = (event) => {
        this._hasHeader = event.target.assignedElements({ flatten: true }).length > 0;
    };

    #onHeaderTrailSlotChange = (event) => {
        this._hasHeaderTrail = event.target.assignedElements({ flatten: true }).length > 0;
    };

    #onActionsSlotChange = (event) => {
        this._hasActions = event.target.assignedElements({ flatten: true }).length > 0;
    };

    /* ---- render --------------------------------------------------------------- */

    /**
     * THE LINE BREAK BEFORE EACH `>` IS LOAD-BEARING FOR GATE D, not a style choice:
     * scripts/gate-d.js:210 flags an interpolated template chunk containing a slash
     * and no newline as a route assembled from fragments, and a single-line Lit chunk
     * ending in a closing tag is exactly that shape (ui-sheet-header.js:432-441).
     */
    render() {
        const headed = this.headed;
        const sheet = !this._hasHeader;
        const name = this.accessibleName;
        const classes = ['dialog', headed ? 'has-head' : '', this._hasActions ? 'has-actions' : '']
            .filter(Boolean).join(' ');

        return html`<dialog
            id="dialog"
            class=${classes}
            tabindex="-1"
            aria-modal="true"
            aria-label=${name || nothing}
            @cancel=${this.#onCancel}
            @pointerdown=${this.#onPointerDown}
            @click=${this.#onClick}
        >
            <div id="head" class=${['cell', 'head', sheet ? 'sheet' : '', headed ? '' : 'is-empty'].filter(Boolean).join(' ')}
            ><slot name="header" @slotchange=${this.#onHeaderSlotChange}></slot
            >${sheet ? html`<ui-sheet-header heading=${this.heading} level=${this.level}
                ><slot name="header-trail" slot="trail" @slotchange=${this.#onHeaderTrailSlotChange}></slot
                ></ui-sheet-header>` : nothing}</div
            ><div id="body" class="cell body"
            ><slot name="body"></slot><slot></slot></div
            ><div id="actions" class=${this._hasActions ? 'cell actions' : 'cell actions is-empty'}
            ><slot name="actions" @slotchange=${this.#onActionsSlotChange}></slot></div>
        </dialog>`;
    }
}

customElements.define('ui-dialog', UiDialog);
