/**
 * ui-notes-editor.js — component #55 of the 57-component inventory:
 * THE NOTES EDITOR HOST. A dialog BODY, not a dialog.
 *
 * Wave 4, item #55 (SCOPE Part 4, "Wave 4 — dialog bodies and screen compounds"),
 * the row verbatim:
 *
 *   "Notes editor host | EasyMDE inside a dialog. The inverse-scale hack dies with
 *    the canvas (O7); the modality holes (no Escape, no trap, live on three screens
 *    — O8) are #18's job, solved once. | medium | #18"
 *
 * And #18's own file says the other half out loud (ui-dialog.js:190-193):
 * "NO BODY. Not the numpad's keys (#53), NOT THE NOTES EDITOR (#55), not the time
 * picker (#54). Those are wave-4 rows that fill the `body` slot." So this element
 * fills `slot="body"` and owns no scrim, no focus trap, no `inert` mark, no Escape
 * arbitration and no top-layer paint. A second modal machinery is bug O6 and a wave
 * block; there is not one line of it below.
 *
 * ---------------------------------------------------------------------------
 * THE ORACLE HAS NO ANSWER HERE, AND IT SAYS SO — the disqualification check, run
 * first, as Part 10 §4 requires.
 *
 *   prov_query.py find --cls EasyMDEContainer   -> 0 elements in 0 of 49 states
 *   prov_query.py find --cls editor-toolbar     -> 0 elements in 0 of 49 states
 *   prov_query.py find --cls CodeMirror         -> 0 elements in 0 of 49 states
 *   prov_query.py find --cls notes-modal        -> 0 elements in 0 of 49 states
 *
 * There IS a `modal-notes` state in the corpus and the editor is not in it: the
 * capture caught the Live screen with the "Full notes" button and the DYE2 banner —
 *   CITE modal-notes #shot-dye-btn [i=158] <button class="slate-btn slate-rate-dye">
 *        text "Full notes"  rect x=1745 y=1092 w=147 h=64
 *   CITE modal-notes span#app-toast-message [i=164] text "DYE2 is installed but has
 *        not starte..."  rect x=542 y=1047 w=820 h=33
 * — so the overlay never opened. 165 elements in that state, none of them EasyMDE's.
 * Per the tool's own carve-out ("read the Slate source read-only"), every number
 * below is cited to `notes-modal.css` / `notes-modal.js` by line, and every
 * responsive decision is `LAYOUT_SPEC_DRAFT.md`'s, which governs regardless.
 *
 * Two answers the corpus CAN give, and they are the two O7 turns on:
 *   CITE settings-machine-sleep---wake-schedules .slate-heading [i=74] font-size =
 *        28px  <-  slate-shell.css  authored `var(--slate-text-xl)`  (token-driven)
 *        = --ui-text-xl, and it is what #16 puts on a dialog heading
 *        (ui-sheet-header.js:45-48).
 *   CITE settings-help-keyboard-shortcuts #kb-current-espresso [i=43] <kbd
 *        class="slate-keycap"> rect 48x48, authored `var(--slate-hit-min)` — the one
 *        control in Slate that actually reaches the hit floor (base.js:110-127).
 *
 * ---------------------------------------------------------------------------
 * O7 — "The notes editor's inverse-scale hack makes its body text render at the SAME
 * PHYSICAL SIZE as the dialog title — designed ratio 28:18 = 1.56, delivered 1.04 —
 * and its toolbar keys are 64x62 REAL px against 42.7 real px controls elsewhere."
 * (§7.7 O7, `notes-modal.js:121-143`.)
 *
 * The mechanism, read from the source: `applyInverseScale()` measured the wrap, then
 * wrote `transform: scale(1/appScale)` on an absolutely positioned inner div and
 * sized it `wrapRect / scale` (`notes-modal.js:121-143`). Everything inside that div
 * was therefore authored in PAGE pixels while everything outside it was authored in
 * DESIGN pixels, and the canvas' 0.667 multiplied only the outside. Two consequences,
 * both arithmetic:
 *
 *   type   authored 28 (title, `notes-modal.css:55` var(--slate-text-xl)) against 18
 *          (body, `:249` var(--slate-text-md)) = 1.56 designed. Delivered:
 *          28 x 0.667 = 18.7 real px title against 18 x 1 = 18 real px body = 1.04.
 *   keys   authored 64x62 (`notes-modal.css:169-172`). Outside the scaled div the
 *          same 64 renders 64 x 0.667 = 42.7. So the toolbar keys came out 1.5x every
 *          other control on the machine.
 *
 * THE FIX IS NOT A NUMBER, IT IS THE ABSENCE OF THE TRANSFORM. DECISIONS.md's canvas
 * decision removes `#scaled-content` entirely, so there is exactly one coordinate
 * space and both ratios come out as authored:
 *
 *   - the editing surface is `--ui-text-md` (18px, `styles/tokens.css:355`), the same
 *     step `notes-modal.css:249` asked for, and the dialog heading is `--ui-text-xl`
 *     (28px) through #16 — 28/18 = 1.5555, the DESIGNED ratio, measured in the suite
 *     inside a real <ui-dialog>;
 *   - a toolbar key is `--ui-control-h` (64px) square and renders 64 page px, the
 *     same box as any other 64px control on the page. The suite asserts a key against
 *     a live <ui-button> in the same dialog: ratio 1.0, where Slate delivered 1.5.
 *
 * There is NO `transform` anywhere in this file, and the suite asserts that too —
 * "the inverse-scale hack goes with the canvas" (spec §5.2 row 55). A component that
 * re-introduced one would put O7 back with no other change.
 *
 * ---------------------------------------------------------------------------
 * O8 — "The notes modal is `aria-modal="true"` with no Escape, no focus trap, no
 * backdrop dismiss and no `inert` — and it is live on three screens."
 * (§7.7 O8, `notes-modal.js:42-45, 66, 72`.)
 *
 * Read literally in the source: `overlayEl.setAttribute('role', 'dialog')` and
 * `setAttribute('aria-modal', 'true')` at `:42-45`, and the entire open path at
 * `:66-72` is `classList.add('active')` plus `aria-hidden='false'`. The claim was the
 * whole implementation.
 *
 * SO THIS FILE MAKES THE CLAIM IMPOSSIBLE TO MAKE. It sets no `role`, no
 * `aria-modal`, no `aria-hidden`, no `tabindex` on the host, and reaches for no
 * scrim. Modality is #18's, where it is real — focus trap, focus restore, composed
 * `inert`, the OPEN_DIALOGS Escape stack and the top layer (ui-dialog.js:135-190).
 * §5's own instruction for this bug: "O8/H9 — the modality gap — is closed by the
 * contract above, NOT BY ADDING ATTRIBUTES" (SCOPE.md:2077). The suite asserts the
 * negative on this element and the positive on the shell around it: Escape reaches
 * #18 and closes it, with this body mounted and focused inside.
 *
 * The one thing a notes editor legitimately wants from the shell is the door #18
 * already documents: "close-request {reason} CANCELLABLE — preventDefault refuses the
 * dismissal, which is how a dialog with unsaved work keeps Escape and the backdrop
 * from throwing it away" (ui-dialog.js:234-236). `guard-unsaved` is an opt-in
 * boolean that uses exactly that door and nothing else. It is OFF by default, so the
 * default behaviour is the shell's unmodified behaviour.
 *
 * ---------------------------------------------------------------------------
 * WHY THE VENDOR SHEET IS ADOPTED INTO A CASCADE LAYER
 *
 * CONVENTIONS §8 is the rule: a vendor stylesheet is adopted into THIS root before
 * the widget is built, and `hasAdoptedSheet` is what the test asserts on. Measured
 * here, at the bench geometry, EasyMDE 2.21.0 with and without `easymde.min.css` in
 * the shadow root — the same shape of finding as the uPlot Rule 1 spike:
 *
 *   with the sheet     .CodeMirror-scroll  overflow scroll   .CodeMirror-cursor  1x24, absolute
 *   without it         .CodeMirror-scroll  overflow visible  .CodeMirror-cursor  600x20, STATIC
 *                      toolbar button 16x6 (against 64x64)
 *
 * A caret that is a 600px-wide static block is not a subtle degradation, and it comes
 * with no error. So `#adoptVendorSheet()` throws rather than build without it.
 *
 * THE LAYER IS THE OTHER HALF, and it is what lets this file hold to "zero
 * !important" (CONVENTIONS §6) against a sheet that outranks it. EasyMDE styles its
 * keys at `.editor-toolbar button` — (0,2,1) — and the four selection dials arrive
 * through `selectionSurface`'s `[aria-pressed="true"]`, which is (0,1,0). Slate's own
 * answer to that gap was a sheet of 40 `!important`s (`notes-modal.css:134-232`), and
 * O4's finding is that this is how a library ends up unreachable. Wrapping the vendor
 * text in `@layer ui-vendor { … }` before `replaceSync` drops every one of its
 * unlayered rules below every rule in this file REGARDLESS OF SPECIFICITY, so the
 * resting key paints at (0,1,0), the dials tie it and win on source order, and not
 * one declaration here needs the important flag. Measured: with the layer, a
 * `.ui-mde-key { background-color }` at (0,1,0) beats the vendor's (0,2,1), and
 * `[aria-pressed="true"]` then beats that.
 *
 * The sheet's ten `!important` declarations are unaffected by layering (important
 * declarations reverse layer order) and were read one by one: eight belong to
 * `fullscreen` / `sided` / `cm-fat-cursor`, none of which this component enables;
 * `.CodeMirror-scroll { overflow: scroll !important }` is the behaviour we want; and
 * `.editor-toolbar button { text-decoration: none !important }` collides with
 * nothing declared here.
 *
 * ---------------------------------------------------------------------------
 * WHAT ELSE IS DELIBERATELY DIFFERENT FROM `notes-modal.js`
 *
 *   - NO `autoDownloadFontAwesome`. Slate already refused it (`notes-modal.js:196`)
 *     and the reason is carried: "Slate is a fully offline skin. Never let EasyMDE
 *     inject the remote Font Awesome stylesheet at runtime." The nine icons are
 *     local SVG, transcribed from `notes-modal.js:167-186`.
 *   - NO `autosave`. Same reason Slate gave (`notes-modal.js:200-201`): "EasyMDE
 *     autosave probes unscoped browser-storage keys." Storage is B7's router, and a
 *     dialog body does not own persistence.
 *   - NO SIDE-BY-SIDE / FULLSCREEN key. `toggleSideBySide` calls `toggleFullScreen`,
 *     which is `position: fixed !important` on the container (`easymde.min.css`,
 *     `.EasyMDEContainer .CodeMirror-fullscreen`) — a second escape from the dialog's
 *     box, in a component whose whole row is about not having one. Slate shipped it
 *     (`notes-modal.js:186`); dropped here, recorded as a reversible choice.
 *   - NO `setTimeout(…, 350)` BEFORE CONSTRUCTION. `notes-modal.js:243-250` waits a
 *     frame and then a third of a second before `initEasyMDE()` because the inverse
 *     scale had to be measured first. With no transform there is nothing to measure.
 *   - NO `streamline:scaleupdate` LISTENER (`notes-modal.js:230-238`). That event is
 *     the canvas'. What replaces it is a `ResizeObserver` — C11's finding is that the
 *     old overlays have none at all — which calls CodeMirror's own `refresh()`.
 *   - THE SUBJECT ROW IS A SLOT, not an `<input>` this file builds
 *     (`notes-modal.js:79-88`). A screen that needs one slots #7 `<ui-text-field>`
 *     into `slot="subject"`; the row collapses to nothing when the slot is empty.
 *   - THE ACTIVE KEY IS A SELECTION STATE. EasyMDE toggles a bare `.active` class;
 *     this file mirrors it onto `aria-pressed` for the seven keys that are toggles,
 *     so accessibility state and visual state are the same state (spec Appendix 15)
 *     and the paint comes from the four dials, not from a private look. Slate painted
 *     its own (`notes-modal.css:203-217`: `--slate-key-on`, a `--slate-steel` strip
 *     and a dark-theme glow) — three of the four dials, hand-rolled, in one sheet.
 *   - THE TOOLBAR IS KEYBOARD-REACHABLE. EasyMDE ships `tabindex="-1"` on every
 *     button (measured) with no roving management, so `role="toolbar"` describes a
 *     bank no keyboard can enter. Appendix 10 keeps Slate's roving-tabindex tablist
 *     "exactly as implemented"; this is that pattern on this bank.
 *
 * ---------------------------------------------------------------------------
 * API
 *   <ui-dialog heading="Notes" open>
 *     <ui-notes-editor slot="body" .value=${text}></ui-notes-editor>
 *     <ui-button slot="actions">Cancel</ui-button>
 *     <ui-button slot="actions" variant="primary">Confirm</ui-button>
 *   </ui-dialog>
 *
 *   value          the markdown handed in. Writing it re-seeds the editor and clears
 *                  `dirty`; reading it gives back the seed, never the live text.
 *   text           (getter) the live editor text.
 *   dirty          (getter) text !== seed.
 *   placeholder    empty-state prompt. Defaults to t('Write your notes here…').
 *   label          accessible name of the editing surface. Defaults to t('Notes').
 *   toolbarLabel   accessible name of the key bank. Defaults to t('Formatting').
 *   disabled       reflected. Dims (base) and makes the document read-only.
 *   guardUnsaved   `guard-unsaved`, default OFF. While `dirty`, refuse #18's
 *                  `close-request` — and SAY SO, on the glass, under the editor.
 *   guardRefusal   `guard-refusal`. Overrides the sentence the guard prints.
 *
 *   focusEditor() / markSaved() / refresh()
 *   ready          a promise that settles when the editor exists; `editorReady` is
 *                  the boolean half. `sheetAdopted` reports the vendor sheet.
 *
 *   events         notes-input  {value, dirty}      every edit, no debounce
 *
 *                  `notes-dismiss-blocked {reason}` was the OTHER one until 29 August
 *                  2026 and is retired — audit F-007. It announced that the guard had
 *                  refused a dismissal, nothing in `src/` ever heard it, and the
 *                  refusal was therefore invisible: the dialog just did not close. The
 *                  outcome is now rendered INSIDE this component, at `#refusal`, which
 *                  is where the gesture happened. See `#applyGuard`.
 *
 *   --_ui-notes-min-h   the editing surface's floor, default 2 x control + 2 x space-4
 */

import 'easymde';
import { css, html } from 'lit';
import {
    UiElement,
    adoptStyleSheet,
    hasAdoptedSheet,
    selectionSurface,
    visuallyHidden,
} from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';

/** Resolved against this module, so it does not care what the served root is —
 *  base.js:620 does the same for uPlot's. */
export const EASYMDE_STYLESHEET_URL = new URL('../../vendor/easymde.min.css', import.meta.url).href;

/**
 * One layered `CSSStyleSheet` per page, shared by every instance. A `const` Map and
 * not a module-scope `let`: `test/store.test.mjs:212-222` (CARRY_FORWARD §6 pattern C)
 * forbids the second shape outright, and `base.js:622` already keeps its sheet cache
 * this way.
 */
const vendorSheetCache = new Map();

/**
 * Fetch `easymde.min.css` once and hand back a constructed sheet whose whole text is
 * inside `@layer ui-vendor`. This is `loadStyleSheet()`'s job plus the one wrap, and
 * the wrap is why it is not `loadStyleSheet()`: that helper's cache is keyed by URL
 * and hands the same UNLAYERED object to everyone, and a component that adopted it
 * would be back to needing the important flag.
 */
export function loadLayeredVendorSheet({ fetch: fetchImpl = globalThis.fetch } = {}) {
    const href = EASYMDE_STYLESHEET_URL;
    let pending = vendorSheetCache.get(href);
    if (pending === undefined) {
        pending = Promise.resolve(fetchImpl(href))
            .then((response) => {
                if (!response.ok) throw new Error(`ui-notes-editor: ${response.status} for ${href}`);
                return response.text();
            })
            .then((cssText) => {
                const sheet = new CSSStyleSheet();
                sheet.replaceSync(`@layer ui-vendor {\n${cssText}\n}`);
                return sheet;
            })
            .catch((error) => {
                /* Do not cache a failure: one transient fetch error must not leave
                 * every later notes dialog permanently unstyled. base.js:645-650. */
                vendorSheetCache.delete(href);
                throw error;
            });
        vendorSheetCache.set(href, pending);
    }
    return pending;
}

/* ---------------------------------------------------------------------------
 * THE NINE ICONS, transcribed from `notes-modal.js:167-186`.
 *
 * Slate's own comment there is the reason they are inline SVG and not names:
 * "EasyMDE's named toolbar entries rely on Font Awesome. Slate supplies explicit
 * local SVG controls instead so Notes remains complete offline."
 * Paint comes from CSS (`fill: none; stroke: currentColor`), so there is not a
 * colour literal in this file — A8 guard 3.
 * ------------------------------------------------------------------------- */
const ICON_OPEN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">';
const ICON_CLOSE = '</svg>';

const ICON_PATHS = Object.freeze({
    bold: '<path d="M7 4h6a4 4 0 0 1 0 8H7Zm0 8h7a4 4 0 0 1 0 8H7Z"/>',
    italic: '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
    heading: '<path d="M6 4v16M18 4v16M6 12h12"/>',
    'unordered-list': '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    'ordered-list': '<path d="M10 6h10M10 12h10M10 18h10M4 5h1v3M3 14c0-1 2-2 2-3s-2-1-2 0M3 17h2l-2 3h2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>',
    quote: '<path d="M10 11H5a4 4 0 0 0 4 4v3H5a7 7 0 0 1 0-14h5ZM21 11h-5a4 4 0 0 0 4 4v3h-4a7 7 0 0 1 0-14h5Z"/>',
    'horizontal-rule': '<path d="M4 12h16"/>',
    preview: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
});

/**
 * The bank, in order. `sep` is EasyMDE's `'|'`.
 *
 * `toggle: true` is the half that decides whether a key gets `aria-pressed` at all.
 * A one-shot action that carried `aria-pressed="false"` would announce itself as an
 * un-pressed toggle, which is a worse lie than no state — so link and the horizontal
 * rule carry none.
 */
const TOOLBAR_SPEC = Object.freeze([
    { name: 'bold', title: 'Bold', toggle: true },
    { name: 'italic', title: 'Italic', toggle: true },
    { name: 'heading', title: 'Heading', toggle: true },
    { sep: true },
    { name: 'unordered-list', title: 'Bulleted list', toggle: true },
    { name: 'ordered-list', title: 'Numbered list', toggle: true },
    { sep: true },
    { name: 'link', title: 'Insert link', toggle: false },
    { name: 'quote', title: 'Quote', toggle: true },
    { name: 'horizontal-rule', title: 'Horizontal rule', toggle: false },
    { sep: true },
    { name: 'preview', title: 'Preview', toggle: true },
]);

/** EasyMDE's own action for each name. Read at build time, not at module load: the
 *  global is installed by the side-effect import above. */
function easyMdeActions(EasyMDE) {
    return {
        bold: EasyMDE.toggleBold,
        italic: EasyMDE.toggleItalic,
        heading: EasyMDE.toggleHeadingSmaller,
        'unordered-list': EasyMDE.toggleUnorderedList,
        'ordered-list': EasyMDE.toggleOrderedList,
        link: EasyMDE.drawLink,
        quote: EasyMDE.toggleBlockquote,
        'horizontal-rule': EasyMDE.drawHorizontalRule,
        preview: EasyMDE.togglePreview,
    };
}

const KEY_CLASS = 'ui-mde-key';

export class UiNotesEditor extends UiElement {
    static properties = {
        /** The markdown handed in. The SEED, not the live text — see `text`. */
        value: { type: String },
        /** Empty-state prompt inside the editing surface. */
        placeholder: { type: String },
        /** Accessible name of the editing surface. */
        label: { type: String },
        /** Accessible name of the key bank. */
        toolbarLabel: { type: String, attribute: 'toolbar-label' },
        /** Reflected: the base paints it, and the document goes read-only. */
        disabled: { type: Boolean, reflect: true },
        /**
         * SHOW THE NOTES, TAKE NO EDIT — and look like it, without looking broken.
         *
         * WHY IT IS NOT `disabled`. The selector's detail pane displays a profile's
         * notes and has nowhere to save an edit to: Slate's own pane is a plain
         * `<div id="profile_notes">` that prints `profile.notes` and nothing more
         * (`profile_selector.js:565-569`). Decal mounted a full editor there instead,
         * so the caret landed, the toolbar answered, and every word typed was discarded
         * on the next selection. That is worse than Slate's read-only div, not better.
         *
         * `disabled` would fix the LIE and introduce another: it dims the host, and
         * notes a person is reading are not unavailable. So `readonly` is the third
         * state — full contrast, no caret, no toolbar — which is what a display is.
         */
        readonly: { type: Boolean, reflect: true },
        /** Opt-in. While `dirty`, refuse #18's cancellable `close-request`. */
        guardUnsaved: { type: Boolean, attribute: 'guard-unsaved' },
        /** What the guard SAYS when it refuses. Overrides the shipped sentence. */
        guardRefusal: { type: String, attribute: 'guard-refusal' },
        /** Internal: is anything slotted into `subject`? Drives the row's presence. */
        _hasSubject: { type: Boolean, state: true },
        /**
         * Internal: the guard has just refused a dismissal, so SAY SO — audit F-007.
         *
         * The refusal itself always worked (`#applyGuard` calls `preventDefault` on
         * #18's cancellable `close-request`), and it was completely silent on the
         * glass: the dialog simply did not close, and the only trace was a
         * `notes-dismiss-blocked` event that nothing in `src/` heard. A person pressing
         * Escape twice on an unsaved note learned nothing either time. This is the
         * house idiom the same night's F-050 put on the rename dialog — a refusal
         * happens where the gesture happened, in words.
         */
        _refused: { type: Boolean, state: true },
    };

    static styles = [visuallyHidden, css`
        /* -------------------------------------------------------------------
         * THE HOST FILLS THE BODY CELL. §4.6's dialog is
         * grid-template-rows: auto minmax(0,1fr) auto with the body at 1fr, so a
         * body that wants the whole cell asks for it — and min-block-size: 0 is
         * the half that lets it SHRINK, which is what makes the dialog's own
         * "compress to the first row before scrolling" rule reachable.
         * ----------------------------------------------------------------- */
        :host {
            --_ui-notes-min-h: calc(2 * var(--ui-control-h) + 2 * var(--ui-space-4));

            block-size: 100%;
            min-block-size: 0;
        }

        #frame {
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
            gap: var(--ui-space-4);
            block-size: 100%;
            min-block-size: 0;
        }

        /* The optional subject row. Absent means absent: a zero-height grid row
         * still eats a gap, which is the "one leaf sits 12px lower" family (T13). */
        #subject-row {
            display: block;
        }

        #frame:not(.has-subject) {
            grid-template-rows: minmax(0, 1fr);
        }

        #frame:not(.has-subject) #subject-row {
            display: none;
        }

        /* THE REFUSAL ROW (F-007). Same treatment as the subject row above and for the
         * same reason: it is a grid row, so an EMPTY one would still eat a gap — the
         * "one leaf sits 12px lower" family (T13). Absent means absent.
         *
         * THE CAPTION ROLE IS RESTATED, NOT IMPORTED. editor-screen.js writes
         * class="ui-caption" for its refusal and gets the treatment because it puts
         * typeRoles in its own static styles; this component does not, and adopting a
         * whole type-role sheet to paint one line would be a bigger change than the
         * fix. So the declarations that matter are stated against the SAME tokens the
         * role uses (type-roles.js:258-266) and the ink is the status colour rather
         * than the muted one, because this line is a refusal and not a note. */
        .refusal {
            display: block;
            max-inline-size: var(--ui-measure);
            margin: 0;
            color: var(--ui-status-danger);
            font-size: var(--ui-text-note);
            font-weight: var(--ui-weight-regular);
            line-height: 1.5;
        }

        #frame:not(.has-refusal) .refusal {
            display: none;
        }

        /* The editor host. EasyMDE owns everything inside it, so it carries no
         * padding of its own and no bindings — Lit never touches this subtree.
         *
         * INSET FOCUS OFFSET FOR THE WHOLE SUBTREE (CONVENTIONS §3, bug L24): the
         * dialog body is an overflow-y: auto scrollport, so an outset ring on the
         * bank or on the editing surface is clipped at the cell edge. One line,
         * one treatment, the offset the base already ships for this case. */
        #editor {
            --_ui-focus-offset: var(--ui-focus-offset-inset);

            display: flex;
            min-block-size: 0;
            min-inline-size: 0;
        }

        .EasyMDEContainer {
            display: flex;
            flex: 1 1 0;
            flex-direction: column;
            min-block-size: 0;
            min-inline-size: 0;
            inline-size: 100%;
        }

        /* -------------------------------------------------------------------
         * THE KEY BANK.  Slate's own comment on this row is the design note and it
         * is kept: "One 64px outer bank, 62px inner keys, 1px seams"
         * (notes-modal.css:147). What changes is that 64 now means 64 rendered
         * pixels (O7) and that the number is --ui-control-h rather than a literal.
         *
         * overflow-x: auto is the stated overflow (spec §2.4). A bank that ran out
         * of room used overflow: hidden (notes-modal.css:156) — which is O11's
         * defect one component over: "a context menu taller than the viewport loses
         * its LAST items". Nine keys is 9 x 64 = 576px plus three 1px
         * separators with 8px gutters = 627px, against a 772px body at the default
         * card width (820 inline - 2 x 24 pad, measured), so it does not scroll at either Gate A geometry;
         * it scrolls rather than truncates when a screen narrows the card.
         * ----------------------------------------------------------------- */
        .editor-toolbar {
            display: flex;
            flex: 0 0 auto;
            align-items: stretch;
            min-block-size: var(--ui-control-h);
            margin: 0;
            padding: 0;
            overflow-x: auto;
            overflow-y: hidden;
            border: var(--ui-border-w) solid var(--ui-line);
            border-start-start-radius: var(--ui-radius);
            border-start-end-radius: var(--ui-radius);
            border-end-start-radius: 0;
            border-end-end-radius: 0;
            background-color: var(--ui-key);
            opacity: 1;
        }

        /* THE RESTING KEY, at (0,1,0) on purpose. selectionSurface is
         * [aria-pressed="true"], also (0,1,0), and comes LAST in static styles,
         * so it ties this rule and wins on source order. A shape like
         * .editor-toolbar button (0,1,1) — which is how the vendor sheet and
         * notes-modal.css:167 both spell it — would outrank the dials and the key
         * would silently never turn selected (CONVENTIONS §4 rule 2). */
        .ui-mde-key {
            display: inline-grid;
            flex: 0 0 auto;
            place-items: center;
            inline-size: var(--ui-control-h);
            min-inline-size: var(--ui-control-h);
            block-size: var(--ui-control-h);
            margin: 0;
            padding: 0;
            border: 0;
            border-radius: 0;
            background-color: var(--ui-key);
            color: var(--ui-text-2);
            font: inherit;
            cursor: pointer;
        }

        /* THE SEAM INSIDE A ONE-PIECE BANK — --ui-seam-ink as an inset shadow, the
         * mechanism CONVENTIONS §13 refuses the seam utility for by name, and the
         * one ui-bank.js:456-461 uses. :where() drops this to (0,0,0) DELIBERATELY:
         * at the obvious (0,2,0) a selected key would keep its seam and lose its LED
         * — every key but the first, silently, and invisibly while the LED is 0px
         * (ui-bank.js:429-447). The custom property is still set here, and
         * selectionSurface reads it back out of the slot. */
        :where(.ui-mde-key + .ui-mde-key) {
            --_ui-rest-shadow: inset var(--ui-seam) 0 0 0 var(--ui-seam-ink);

            box-shadow: var(--_ui-rest-shadow);
        }

        .ui-mde-key svg {
            display: block;
            inline-size: var(--ui-icon);
            block-size: var(--ui-icon);
            fill: none;
            stroke: currentColor;
            /* 1.6 and the two joins are notes-modal.css:186-193, read from source:
             * stroke geometry is outside the corpus' 18-property surface. */
            stroke-width: 1.6;
            stroke-linecap: round;
            stroke-linejoin: round;
            pointer-events: none;
        }

        .ui-mde-key:hover {
            background-color: var(--ui-key-on);
            color: var(--ui-text);
        }

        /* ONE DIM, NOT TWO. The base paints --ui-opacity-disabled on the host AND on
         * every [disabled] inside the shadow tree (base.js:509-523), and the keys
         * carry the native attribute because that is what actually refuses a press
         * (CONVENTIONS §4: "the host attribute dims, it does not disable"). Left
         * alone the two compose to .38 x .38 = .14 and the bank goes to a ghost.
         * The base's shadow-tree rule is :where(...) at (0,0,0); this is (0,3,0). */
        /* READONLY HIDES THE TOOLBAR ROW, because a bar of keys that all refuse is a
         * control surface pretending to be one. The keys are already disabled by
         * #applyDisabled; this removes the box they sit in so the pane shows the notes
         * and nothing else. */
        :host([readonly]) .editor-toolbar {
            display: none;
        }

        /* AND THEN THE BOX HAS NO TOP EDGE, which is the half that was missing. The
         * toolbar owns the border-block-start and the two top corners; .CodeMirror below
         * it carries border-block-start: 0 on purpose, because the toolbar's own bottom
         * border is the seam between them and two borders there would draw a 2px rule.
         *
         * HIDE THE TOOLBAR AND THAT REASONING STOPS HOLDING. Ben, 25 August 2026: "The top
         * of the description card is being clipped, the edge seems to be hidden." It was
         * not clipped - it was never drawn. MEASURED on the selector, whose notes pane is
         * readonly: left, right and bottom borders present, top absent, top corners square
         * against the chart card's rounded ones directly above.
         *
         * SO THE ONE ELEMENT LEFT TAKES THE WHOLE BOX. This is the same rule the toolbar
         * branch states, applied to the only child that remains. */
        :host([readonly]) .CodeMirror {
            border-block-start: var(--ui-border-w) solid var(--ui-line);
            border-start-start-radius: var(--ui-radius);
            border-start-end-radius: var(--ui-radius);
        }

        :host([disabled]) .ui-mde-key {
            opacity: 1;
        }

        /* The group divider. 1px x 32px with an 8px gutter is notes-modal.css:227-233;
         * both numbers are derived rather than restated — Appendix 12, "a size
         * expressed as control + 2 x space, not a measured constant". */
        .editor-toolbar i.separator {
            flex: 0 0 auto;
            align-self: center;
            inline-size: var(--ui-hairline);
            block-size: calc(var(--ui-control-h) / 2);
            margin: 0 var(--ui-space-2);
            border: 0;
            background-color: var(--ui-line-strong);
            /* EasyMDE writes a literal "|" into the element; the rule above draws the
             * line, so the glyph is hidden from the eye and from the a11y tree
             * (an <i> with no role is presentational either way). */
            color: transparent;
            font-size: 0;
        }

        /* -------------------------------------------------------------------
         * THE EDITING SURFACE.  O7's other half: the step is --ui-text-md, which
         * IS the step notes-modal.css:249 asked for, and it now renders against a
         * 28px heading in the same coordinate space.
         * ----------------------------------------------------------------- */
        .CodeMirror {
            flex: 1 1 0;
            min-block-size: var(--_ui-notes-min-h);
            padding: var(--ui-space-4);
            border: var(--ui-border-w) solid var(--ui-line);
            border-block-start: 0;
            border-start-start-radius: 0;
            border-start-end-radius: 0;
            border-end-start-radius: var(--ui-radius);
            border-end-end-radius: var(--ui-radius);
            background-color: var(--ui-surface);
            color: var(--ui-text);
            font-family: var(--ui-font-family);
            font-size: var(--ui-text-md);
            font-weight: var(--ui-weight-regular);
            /* 1.6 from notes-modal.css:251, read from source — line-height is one of
             * the two properties the probe never measured (type-roles.js:87-89). */
            line-height: 1.6;
        }

        /* REUSING THE ONE RING on a wrapper the base's selector list cannot reach
         * (CONVENTIONS §3). CodeMirror's real focusable is a 3px-wide hidden
         * textarea parked at the caret; ringing THAT is a 3px ring in the middle of
         * a paragraph. The wrapper takes the ring, the input gives it up, and the
         * declaration is the exported fragment — not a second treatment. */
        .CodeMirror:has(:focus-visible) {
            outline: var(--ui-focus-w) solid var(--ui-steel);
            outline-offset: var(--_ui-focus-offset, var(--ui-focus-offset));
        }

        .CodeMirror textarea:focus-visible {
            outline: none;
        }

        .CodeMirror-cursor {
            border-inline-start-color: var(--ui-text);
        }

        .CodeMirror-selected,
        .CodeMirror-focused .CodeMirror-selected {
            background-color: color-mix(in srgb, var(--ui-steel) 18%, transparent);
        }

        .CodeMirror-placeholder {
            color: var(--ui-muted);
        }

        .CodeMirror-gutters {
            border-inline-end-color: var(--ui-line);
            background-color: var(--ui-key);
        }

        .editor-preview,
        .editor-preview-side {
            padding: var(--ui-space-5);
            background-color: var(--ui-surface);
            color: var(--ui-text);
            font-family: var(--ui-font-family);
            font-size: var(--ui-text-md);
            font-weight: var(--ui-weight-regular);
            line-height: 1.6;
        }
    `, selectionSurface];

    /** The EasyMDE instance. Null until `ready` settles. */
    #mde = null;

    /** The layered vendor sheet, once adopted. */
    #sheet = null;

    /** Resolves when the editor exists (or rejects with the reason it does not). */
    #ready = null;

    #resolveReady = null;

    /** The text last written INTO the editor. `dirty` is measured against it. */
    #seed = '';

    /** Guards the property → editor write against the editor → property echo. */
    #writing = false;

    #resizeObserver = null;

    /** The <ui-dialog> this body is slotted into, while `guard-unsaved` is on. */
    #guardedDialog = null;

    #onCloseRequest = null;

    constructor() {
        super();
        this.value = '';
        this.placeholder = '';
        this.label = '';
        this.toolbarLabel = '';
        this.disabled = false;
        this.readonly = false;
        this.guardUnsaved = false;
        this._hasSubject = false;
        this.i18n = new I18nController(this);
        this.#ready = new Promise((resolve) => { this.#resolveReady = resolve; });
    }

    /* ---- the public surface -------------------------------------------------- */

    /** The EasyMDE instance, for a screen that needs its API. Null before `ready`. */
    get editor() { return this.#mde; }

    /** Has the editor been built? The boolean half of `ready`. */
    get editorReady() { return this.#mde !== null; }

    /** Settles when the editor exists. */
    get ready() { return this.#ready; }

    /** Is `vendor/easymde.min.css` in THIS root? The assertion, not the assumption
     *  (CONVENTIONS §8). */
    get sheetAdopted() {
        return this.#sheet !== null && hasAdoptedSheet(this.renderRoot, this.#sheet);
    }

    /** The LIVE text. `value` is the seed; this is what the user has typed. */
    get text() {
        return this.#mde ? this.#mde.value() : (this.value ?? '');
    }

    /** Has the text moved since it was seeded (or since `markSaved()`)? */
    get dirty() {
        return this.text !== this.#seed;
    }

    /** Every key in the bank, in DOM order. */
    get toolbarKeys() {
        return Array.from(this.renderRoot?.querySelectorAll?.(`.${KEY_CLASS}`) ?? []);
    }

    /** The bank itself. */
    get toolbar() {
        return this.renderRoot?.querySelector?.('.editor-toolbar') ?? null;
    }

    /** Put the caret in the document. */
    async focusEditor() {
        await this.#ready;
        this.#mde?.codemirror?.focus?.();
    }

    /** Take the current text as the new baseline — what a screen calls after a save. */
    markSaved() {
        this.#seed = this.text;
    }

    /** Re-measure. CodeMirror caches its own metrics and needs telling. */
    refresh() {
        this.#mde?.codemirror?.refresh?.();
    }

    /* ---- lifecycle ----------------------------------------------------------- */

    disconnectedCallback() {
        super.disconnectedCallback();
        this.#resizeObserver?.disconnect?.();
        this.#resizeObserver = null;
        this.#detachGuard();
    }

    firstUpdated(changed) {
        super.firstUpdated?.(changed);
        this.#build().catch((error) => {
            /* Rethrow asynchronously so a failed build is a page error the suite
             * sees, rather than an unhandled rejection nothing reads. */
            setTimeout(() => { throw error; });
        });
    }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('value') && !this.#writing) this.#seedEditor(this.value ?? '');
        if (changed.has('disabled') || changed.has('readonly')) this.#applyDisabled();
        if (changed.has('placeholder')) this.#mde?.codemirror?.setOption?.('placeholder', this.placeholderText);
        if (changed.has('label')) this.#applyEditorLabel();
        if (changed.has('toolbarLabel')) this.#applyToolbarLabel();
        if (changed.has('guardUnsaved')) this.#applyGuard();
    }

    /* ---- resolved strings ---------------------------------------------------- */

    /** The key IS the English text (i18n/source/README.md), so an unloaded store
     *  still answers with a usable word. */
    get labelText() { return this.label || this.i18n.t('Notes'); }

    get toolbarLabelText() { return this.toolbarLabel || this.i18n.t('Formatting'); }

    get placeholderText() {
        /* notes-modal.js:199 — the same prompt, with the same ellipsis character. */
        return this.placeholder || this.i18n.t('Write your notes here…');
    }

    /* ---- the build ----------------------------------------------------------- */

    async #build() {
        await this.#adoptVendorSheet();

        const EasyMDE = globalThis.EasyMDE;
        if (typeof EasyMDE !== 'function') {
            throw new Error(
                'ui-notes-editor: `import "easymde"` did not install window.EasyMDE. '
                + 'The vendored file is a UMD build that evaluates for side effect '
                + '(vendor/README.md:116); check the importmap entry.',
            );
        }

        const host = this.renderRoot.querySelector('#editor');
        const area = document.createElement('textarea');
        host.appendChild(area);

        this.#mde = new EasyMDE({
            element: area,
            spellChecker: false,
            status: false,
            /* Slate's reason, kept verbatim (notes-modal.js:193-195): "Slate is a
             * fully offline skin. Never let EasyMDE inject the remote Font Awesome
             * stylesheet at runtime." */
            autoDownloadFontAwesome: false,
            /* Slate's other reason (notes-modal.js:200-201): "EasyMDE autosave probes
             * unscoped browser-storage keys." Storage is B7's router's business. */
            autosave: { enabled: false },
            placeholder: this.placeholderText,
            toolbar: this.#toolbar(EasyMDE),
            minHeight: '100%',
            maxHeight: '100%',
        });

        this.#decorateToolbar();
        this.#applyEditorLabel();
        this.#hideVendorScaffolding();
        this.#applyToolbarLabel();
        this.#seedEditor(this.value ?? '');
        this.#applyDisabled();
        this.#applyGuard();

        const cm = this.#mde.codemirror;
        cm.on('change', this.#onEditorChange);
        /* Registered AFTER construction, so EasyMDE's own cursorActivity handler —
         * the one that writes `.active` — has already run when this fires. */
        cm.on('cursorActivity', this.#syncPressedState);
        cm.on('update', this.#syncPressedState);
        this.#syncPressedState();

        /* C11: "The overlays have no ResizeObserver at all." CodeMirror caches its
         * own metrics, so a dialog that changes size leaves the caret in the wrong
         * place until something calls refresh(). */
        this.#resizeObserver = new ResizeObserver(() => this.refresh());
        this.#resizeObserver.observe(this);

        this.#resolveReady(this);
        return this;
    }

    /**
     * Adopt the layered vendor sheet into THIS root, and refuse to continue without
     * it. Returning false is not enough — the failure is silent by construction
     * (see the header's measurement), which is plot-surface.js:349-354's argument.
     */
    async #adoptVendorSheet() {
        if (this.sheetAdopted) return true;
        this.#sheet = await loadLayeredVendorSheet();
        adoptStyleSheet(this.renderRoot, this.#sheet, { position: 'before' });
        if (!this.sheetAdopted) {
            throw new Error(
                'ui-notes-editor: vendor/easymde.min.css is not in this shadow root. '
                + 'Measured without it: .CodeMirror-scroll computes overflow: visible '
                + 'instead of scroll and .CodeMirror-cursor becomes a 600x20 STATIC '
                + 'block instead of a 1x24 absolute caret — an editor that looks '
                + 'right in a screenshot and cannot be used (CONVENTIONS §8).',
            );
        }
        return true;
    }

    /** EasyMDE's toolbar array, built from TOOLBAR_SPEC. */
    #toolbar(EasyMDE) {
        const actions = easyMdeActions(EasyMDE);
        return TOOLBAR_SPEC.map((row) => {
            if (row.sep) return '|';
            return {
                name: row.name,
                title: this.i18n.t(row.title),
                action: actions[row.name],
                className: `${row.name} ${KEY_CLASS}`,
                /* Concatenated, not interpolated: Gate D's constructed-path scan
                 * reads any interpolated template literal containing a slash as a
                 * route assembled from fragments, and `</svg>` has one
                 * (scripts/gate-d.js:209-214). Two constants say the same thing
                 * without asking the gate to special-case a component. */
                icon: ICON_OPEN + ICON_PATHS[row.name] + ICON_CLOSE,
            };
        });
    }

    /* ---- the toolbar's accessibility ---------------------------------------- */

    /**
     * EasyMDE gives every button `tabindex="-1"` (measured) and no roving
     * management, so `role="toolbar"` names a bank a keyboard cannot enter. Appendix
     * 10 keeps Slate's roving-tabindex tablist "exactly as implemented"; this is the
     * same pattern, one component over.
     */
    #decorateToolbar() {
        const bank = this.toolbar;
        if (!bank) return;
        bank.setAttribute('aria-orientation', 'horizontal');
        const keys = this.toolbarKeys;
        keys.forEach((key, i) => {
            key.tabIndex = i === 0 ? 0 : -1;
        });
        bank.addEventListener('keydown', this.#onToolbarKeydown);
        bank.addEventListener('focusin', this.#onToolbarFocusIn);
        /* F-037 — THE PRESSED STATE FOLLOWS THE PRESS, not just the caret.
         *
         * `#syncPressedState` was registered on CodeMirror's `cursorActivity` and
         * `update` only, and that covers every toggle whose state is a fact about the
         * text: bold, italic, heading, the lists, quote. It does NOT cover PREVIEW,
         * because turning the preview on HIDES the CodeMirror instance — no cursor
         * moves, no update fires, and nothing ever re-read the class.
         *
         * MEASURED, and it is the finding exactly: one press took the button from
         * `preview ui-mde-key` to `preview ui-mde-key active` and left
         * `aria-pressed="false"`, before AND after settling. A sighted person saw the
         * mode change; nothing reading the accessibility tree was told — including this
         * audit's own instruments, which is how it came to be recorded as a fault in
         * the announcement rather than in the control.
         *
         * ON THE BANK, NOT ON THE KEY, and AFTER the action: EasyMDE binds its own
         * handler to each button, so a listener here receives the press on the way up,
         * once the action has already written `.active`. One listener covers every key
         * including the ones added later, and the sync is idempotent — the same
         * function the two CodeMirror events call. */
        bank.addEventListener('click', this.#syncPressedState);
    }

    #onToolbarKeydown = (event) => {
        const keys = this.toolbarKeys.filter((k) => !k.disabled);
        if (keys.length === 0) return;
        const from = keys.indexOf(event.target.closest?.(`.${KEY_CLASS}`));
        let to = null;
        if (event.key === 'ArrowRight') to = from < 0 ? 0 : (from + 1) % keys.length;
        else if (event.key === 'ArrowLeft') to = from < 0 ? keys.length - 1 : (from - 1 + keys.length) % keys.length;
        else if (event.key === 'Home') to = 0;
        else if (event.key === 'End') to = keys.length - 1;
        if (to === null) return;
        event.preventDefault();
        event.stopPropagation();
        keys[to].focus();
    };

    /** The roving half: whichever key has the caret is the one in the tab order. */
    #onToolbarFocusIn = (event) => {
        const focused = event.target.closest?.(`.${KEY_CLASS}`);
        if (!focused) return;
        for (const key of this.toolbarKeys) key.tabIndex = key === focused ? 0 : -1;
    };

    /**
     * Mirror EasyMDE's bare `.active` class onto `aria-pressed`, for the keys that
     * are toggles. This is what makes the paint come from the four dials instead of
     * a private look: `selectionSurface` matches `[aria-pressed="true"]` and nothing
     * else in this file paints a selected state (spec §3.9, DECISIONS.md:244).
     */
    #syncPressedState = () => {
        for (const row of TOOLBAR_SPEC) {
            if (row.sep || !row.toggle) continue;
            const key = this.renderRoot?.querySelector?.(`.${KEY_CLASS}.${row.name}`);
            if (!key) continue;
            key.setAttribute('aria-pressed', key.classList.contains('active') ? 'true' : 'false');
        }
    };

    /** The editing surface's accessible name. CodeMirror's real input is a hidden
     *  textarea with no name of its own — the same shape of hole as O9's unnamed
     *  backspace, one component over. */
    #applyEditorLabel() {
        const input = this.#mde?.codemirror?.getInputField?.();
        if (input) input.setAttribute('aria-label', this.labelText);
    }

    /**
     * TAKE THE VENDOR'S SCAFFOLDING OUT OF THE CONTROL TREE — audit F-016, rows #9,
     * #10, #11, #14, #15 and #16. Six of the sixteen unnamed controls Wave 1 found are
     * in this component, and NONE of them is a control.
     *
     * WHAT THEY ACTUALLY ARE, measured through the mounted DOM rather than read off the
     * ledger paths:
     *
     *   * `#editor > textarea` — the element EasyMDE was CONSTRUCTED ON. It is left in
     *     the DOM as the form-backing field, sized 0×0, with no tabindex. The real
     *     editing surface is CodeMirror's own input, which is a different textarea one
     *     level deeper and is already named ("Profile notes") by `#applyEditorLabel`.
     *     Wave 1 rowed this one because `<textarea>` is an interactive TAG; a person
     *     cannot reach it, and naming it would put a SECOND field with the same name in
     *     the tree beside the one that works.
     *   * `.CodeMirror-vscrollbar` / `-hscrollbar` — CodeMirror's fake scrollbars, each
     *     carrying `tabindex="-1"` and sized 0×0 until content overflows. Rowed for the
     *     tabindex. Their siblings `-scrollbar-filler` and `-gutter-filler` are the same
     *     kind of thing and are hidden with them rather than waiting to be found next
     *     time the ledger is rebuilt at a different size.
     *
     * SO THE FIX IS NOT A NAME, AND THAT IS THE POINT. F-016 says these have no
     * accessible name; the honest reading is that they are not things to announce at
     * all. `aria-hidden` says exactly that, and it is the same remedy the selector's ⋯
     * glyph carries one file over. It is NOT the "turn the finding green while the
     * control stays unreachable" move that was explicitly rejected for the selector's
     * TRIGGER: nothing here takes a press, none of it is reachable by keyboard, and the
     * one element in this subtree a person really does use keeps its name.
     */
    #hideVendorScaffolding() {
        const root = this.renderRoot;
        if (!root) return;
        /* The textarea EasyMDE was built on — NOT `getInputField()`, which is the real
         * one and must stay in the tree. Identity, not a selector, so this can never
         * hide the wrong textarea. */
        const backing = root.querySelector('#editor > textarea');
        const live = this.#mde?.codemirror?.getInputField?.();
        if (backing && backing !== live) {
            backing.setAttribute('aria-hidden', 'true');
            backing.tabIndex = -1;
        }
        for (const el of root.querySelectorAll(
            '.CodeMirror-vscrollbar, .CodeMirror-hscrollbar,'
            + ' .CodeMirror-scrollbar-filler, .CodeMirror-gutter-filler',
        )) {
            el.setAttribute('aria-hidden', 'true');
        }
    }

    #applyToolbarLabel() {
        this.toolbar?.setAttribute?.('aria-label', this.toolbarLabelText);
    }

    #applyDisabled() {
        if (!this.#mde) return;
        const locked = this.disabled || this.readonly;
        this.#mde.codemirror.setOption('readOnly', locked ? 'nocursor' : false);
        for (const key of this.toolbarKeys) key.disabled = locked;
    }

    /* ---- text in, text out --------------------------------------------------- */

    #seedEditor(text) {
        this.#seed = text;
        if (!this.#mde) return;
        if (this.#mde.value() === text) return;
        this.#writing = true;
        try {
            this.#mde.value(text);
        } finally {
            this.#writing = false;
        }
    }

    #onEditorChange = () => {
        if (this.#writing) return;
        /* The refusal is about the state the note was in when it was refused. Typing
         * is the person answering it, so the line goes as soon as they do — a refusal
         * that outstays the situation it described becomes furniture. */
        if (this._refused) this._refused = false;
        this.dispatchEvent(new CustomEvent('notes-input', {
            detail: { value: this.text, dirty: this.dirty },
            bubbles: true,
            composed: true,
        }));
    };

    /* ---- the ONE thing this body asks of the shell --------------------------- */

    /**
     * `close-request` is #18's documented, cancellable door: "preventDefault refuses
     * the dismissal, which is how a dialog with unsaved work keeps Escape and the
     * backdrop from throwing it away" (ui-dialog.js:234-236). Using it is composition;
     * a keydown handler here would be a second Escape owner, which is the thing #18's
     * OPEN_DIALOGS stack exists to make impossible.
     */
    #applyGuard() {
        this.#detachGuard();
        this._refused = false;
        if (!this.guardUnsaved) return;
        const dialog = this.closest('ui-dialog');
        if (!dialog) return;
        this.#onCloseRequest = (event) => {
            if (!this.dirty) {
                this._refused = false;
                return;
            }
            event.preventDefault();
            /* SAY IT HERE — audit F-007. This used to raise `notes-dismiss-blocked`
             * {reason} instead, and nothing in `src/` listened, so the whole outcome of
             * pressing Escape on an unsaved note was that nothing happened. A refusal
             * nobody can see is indistinguishable from a control that is broken.
             *
             * THE LINE IS DRAWN IN THIS COMPONENT AND NOWHERE ELSE, which is the
             * FIXPLAN's own constraint on this fix ("never a cross-screen listener
             * tonight") and is also the right shape: the guard is this component's
             * feature, opted into on this component's attribute, and a refusal belongs
             * beside the work it is protecting rather than in a toast on the far side
             * of a dialog. */
            this._refused = true;
        };
        dialog.addEventListener('close-request', this.#onCloseRequest);
        this.#guardedDialog = dialog;
    }

    #detachGuard() {
        if (this.#guardedDialog && this.#onCloseRequest) {
            this.#guardedDialog.removeEventListener('close-request', this.#onCloseRequest);
        }
        this.#guardedDialog = null;
        this.#onCloseRequest = null;
    }

    /* ---- render -------------------------------------------------------------- */

    #onSubjectSlotChange = (event) => {
        this._hasSubject = event.target.assignedNodes({ flatten: true })
            .some((n) => n.nodeType !== Node.TEXT_NODE || n.textContent.trim() !== '');
    };

    /**
     * The refusal sentence — audit F-007.
     *
     * ONE STRING, THROUGH THE SAME DOOR AS THE OTHERS. This component already authors
     * its own words (`labelText`, `toolbarLabelText`, `placeholderText`, and every
     * toolbar title), so a refusal here is not a new kind of thing; it goes through
     * `i18n.t` like the rest and a consumer can override it.
     */
    get guardRefusalText() {
        return this.guardRefusal
            || this.i18n.t('This note has unsaved changes. Save it, or discard them, before closing.');
    }

    render() {
        const classes = [
            this._hasSubject ? 'has-subject' : '',
            this._refused ? 'has-refusal' : '',
        ].filter(Boolean).join(' ');
        return html`
            <div id="frame" class=${classes}>
                <div id="subject-row"><slot name="subject" @slotchange=${this.#onSubjectSlotChange}></slot></div>
                <div id="editor"></div>
                <!-- WHY THE DIALOG DID NOT CLOSE (F-007). The house refusal idiom, the
                     same shape editor-screen.js renders for a refused rename and
                     settings-screen.js for its two: a caption paragraph with
                     role=status, at the work it is about.
                     IT IS ALWAYS IN THE DOM, unlike those two, and that is deliberate
                     rather than a departure: a live region a screen reader has been
                     watching since first paint announces a change to its text, while
                     one that is INSERTED carrying its message is a new node and may
                     announce nothing at all. The row collapses to zero when empty, so
                     the layout cost is the same as a conditional render. -->
                <p id="refusal" class="refusal" role="status"
                    >${this._refused ? this.guardRefusalText : ''}</p>
            </div>`;
    }
}

customElements.define('ui-notes-editor', UiNotesEditor);
