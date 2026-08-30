/**
 * ui-sheet-header.js — component #16 of the 57-component inventory: THE ONE HEADER
 * A DIALOG OR SHEET WEARS.
 *
 * Wave 2, item #16 (SCOPE Part 4, "Wave 2 — controls with a state model, and small
 * compounds of Wave 1", SCOPE.md:1550, verbatim):
 *
 *   "| 16 | **Sheet header** | Title + actions cluster for dialogs and sheets.
 *    Exists; carries over with one repair: `.slate-sheet-actions` currently means a
 *    header cluster in the library and a dialog footer in the shell (O13) — the
 *    rewrite gives the two jobs two names. | small | #1, #2 |"
 *
 * Token-only: no data layer, no store, no endpoint (wave law). Everything it shows
 * arrives as a property or through its one slot; every value it paints arrives from
 * styles/tokens.css.
 *
 * ---------------------------------------------------------------------------
 * WHY IT EXISTS AS A COMPONENT, IN THE AUDIT'S OWN WORDS
 *
 * spec §5.1 row 16 calls the Slate original "the library's one real win in the
 * overlay group" — and then documents both ways the win leaked. `layout/overlays.md`
 * §2.3, verified: "Only the **header** is shared: `.slate-sheet-header` /
 * `.slate-sheet-title` / `.slate-sheet-actions` (`:664-695`), and all three overlays
 * that have a header do carry them". Slate's own comment at slate-components.css:
 * 660-663 says why it was built:
 *
 *   "A sheet's header: its title, and the way out. The three modals each drew their
 *    own — 64px vs 118px tall, uppercase vs sentence case, 500 vs 800 weight, a rule
 *    under one of them — so the skin had three answers to 'what does a modal header
 *    look like'."
 *
 * That is the right diagnosis and the class-based cure did not hold, because a class
 * is reachable from every other sheet in the document. Three consumers
 * (numpad-modal.js:176, time-picker-modal.js:136, notes-modal.js:52) each re-declare
 * the title type on top of it, and a fourth sheet re-declares the row geometry. The
 * shadow boundary is what makes the cure stick: the row, the inset and the type are
 * all declared on classes inside this root, where no screen sheet can name them.
 *
 * ---------------------------------------------------------------------------
 * MEASURED STARTING VALUES — every one an oracle answer, quoted verbatim
 * (prov_query.py against slate-audit-2026-08-16/prov-baseline, dark, and prov-light).
 *
 * The oracle answers for the TITLE — two elements in two states, and they agree:
 *
 *   CITE settings-machine-sleep---wake-schedules .slate-heading [i=74] font-size =
 *        28px  <-  slate-shell.css  `#subpage-host #settings-content-area :is(h1,
 *        h2, h3, h4), ...`  authored `var(--slate-text-xl)`  !important=yes
 *        (token-driven)                                        = --ui-text-xl
 *   CITE settings-machine-sleep---wake-schedules .slate-heading [i=74] font-weight =
 *        500  <-  slate-shell.css  `#subpage-host #settings-content-area :is(h1, h2,
 *        h3, h4), ...`  authored `500`  !important=yes  (FROZEN/hardcoded)
 *                                                              = --ui-weight-medium
 *   CITE settings-machine-sleep---wake-schedules .slate-heading [i=74] text-transform
 *        = uppercase  <-  slate-components.css  `.slate-sheet-title`  authored
 *        `uppercase`  !important=no  (FROZEN/hardcoded)
 *   CITE settings-machine-sleep---wake-schedules .slate-heading [i=74] letter-spacing
 *        = 1.12px  <-  slate-components.css  `.slate-sheet-title`  authored `0.04em`
 *        !important=no  (a LITERAL, and NOT --slate-tracking-cap, which is .12em with
 *        the comment "uppercase microcaps" at slate-tokens.css:153)
 *        SLATE-INCONSISTENT; carried through --ui-tracking-cap, so 3.36px rather than
 *        1.12px. Settled at parity surface 0, re-checked at surface 2 — see .title.
 *   CITE settings-machine-sleep---wake-schedules .slate-heading [i=74] color: dark
 *        rgb(244, 247, 248) / light rgb(23, 26, 28)  <-  slate-shell.css
 *        `#subpage-host #settings-content-area :is(h1, h2, h3, h4), ...`  authored
 *        `var(--slate-text)`  !important=yes                    = --ui-text
 *   CITE modal-numpad #numpad-modal-title [i=167] color: dark rgb(244, 247, 248) /
 *        light rgb(23, 26, 28)  <-  dark numpad-modal.css  `[data-theme='dark']
 *        .numpad-modal-title, ...`  authored `var(--slate-text)`  !important=no ;
 *        light numpad-modal.css  `.numpad-modal-title`  authored `var(--slate-text)`
 *        !important=no
 *
 * ONE ORACLE ANSWER IS DISQUALIFIED AND IT IS ON THIS COMPONENT'S OWN ELEMENT:
 *
 *   CITE modal-numpad #numpad-modal-title [i=167] font-size = 28px  <-  <inline>
 *        `<inline>`  authored `28px`  !important=no  (FROZEN/hardcoded)
 *
 *   The numpad's 28px is an INLINE STYLE written by script on every open, and that is
 *   bug O10 — "The numpad title writes an inline 28px unconditionally on every open
 *   and shrinks to a 16px floor — the one piece of type in the skin whose size is not
 *   a token" (§7.7 O10, numpad-modal.js:508-522). It lands on the same number as the
 *   token, which is exactly what makes it dangerous to quote. The settings state's
 *   [i=74] is the citable answer: same 28px, arriving through `var(--slate-text-xl)`.
 *
 * THE ROW GEOMETRY has no oracle answer at all and was read from source, read-only.
 * `prov_query.py find --cls slate-sheet-header` → "0 elements matched anywhere in
 * this corpus"; so did `slate-sheet-actions`, `numpad-modal-header`, `tpm-header` and
 * `notes-modal-header`. The corpus's own instruction for that case is printed with
 * the result: "read the Slate source read-only". slate-components.css:664-695, in
 * full, is the four declarations below plus the border this file deliberately drops:
 *
 *   .slate-sheet-header { box-sizing: border-box; display: flex; align-items:
 *       center; justify-content: space-between; gap: var(--slate-space-5);
 *       min-height: var(--slate-control-height); padding-bottom: var(--slate-space-4);
 *       border-bottom: var(--slate-hairline) solid var(--slate-line); }
 *   .slate-sheet-title { min-width: 0; ... white-space: nowrap; overflow: hidden;
 *       text-overflow: ellipsis; }
 *   .slate-sheet-actions { display: flex; align-items: center;
 *       gap: var(--slate-space-3); flex-shrink: 0; }
 *
 * and every token maps 1:1 (slate-tokens.css:30/117/118/119 → --ui-control-h 64px,
 * --ui-space-3 12px, --ui-space-4 18px, --ui-space-5 24px).
 *
 * ---------------------------------------------------------------------------
 * THE DEFECTS THIS COMPONENT RETIRES. Each has an assertion in
 * test/render/ui-sheet-header.render.test.mjs, cited to its id.
 *
 *   O13 — THE ROW'S OWN BUG. §7.7: "`.slate-sheet-actions` means two different things
 *        — a header cluster in the library, a dialog footer in the shell"
 *        (`slate-components.css:690-695` vs `slate-shell.css:2227-2232`). The library
 *        means a cluster riding at the END OF THE TITLE ROW; the shell means a FOOTER,
 *        and spells it `justify-content: flex-end; gap: var(--slate-space-4);
 *        margin-top: var(--slate-space-7)`. Any sheet loaded after the library
 *        therefore restyles every header cluster in the app, and the numpad, the time
 *        picker and the notes editor all put their real Cancel/Confirm buttons in one.
 *
 *        THE REPAIR THE ROW ASKS FOR IS "two jobs, two names", and it is made twice
 *        over here:
 *          * BY NAME. This component's cluster is the `trail` slot. The dialog footer
 *            is the `actions` slot and it belongs to #18 — SCOPE.md:1591 gives the
 *            dialog shell "`header`/`body`/`actions` slots", and spec §4.6's skeleton
 *            (LAYOUT_SPEC_DRAFT.md:809-813) puts `actions` on the LAST grid row. The
 *            name `actions` is spoken for by the footer, so the header cluster takes
 *            the name its siblings already use for a trailing cluster
 *            (ui-text-field, ui-search-field, ui-section-header).
 *          * BY MECHANISM, which is the half that cannot decay. `.trail` is a class
 *            inside this shadow root. The shell's three footer declarations can be
 *            aimed at `ui-sheet-header .trail` from a screen sheet and land on
 *            nothing, and there is no way to write them so they do.
 *
 *   A10 — THE VERIFIER'S CORRECTION TO §5.1 ROW 16, and the reason the "one shared
 *        header" was only ever half true (`layout/overlays.md` A10, verbatim): "The
 *        shared header supplies the flex row, the `min-height` and the rule — but
 *        every one of its three consumers re-declares the *title type*, and one of
 *        them diverges … time picker (`time-picker-modal.css:74-75`): **20px / 800**
 *        — a different title entirely. So the 'one shared header' still renders two
 *        title treatments across three dialogs. The win is the row geometry, not the
 *        type."
 *
 *        TWO THINGS END IT, and only both together. The type is declared on `.title`
 *        inside this root, so `20px / 800` aimed from outside cannot reach it — AND
 *        THERE IS NO TITLE SLOT, so a consumer cannot smuggle in its own element to
 *        carry a document rule instead. The title is a plain string property. That is
 *        the whole reason `heading` is not a slot; see "WHAT IS DELIBERATELY NOT
 *        HERE" below.
 *
 *   O1  — ITS MECHANISM, not the whole bug. §7.7: "`slate-shell.css` silently
 *        **re-imposes the 118px notes header** that `notes-modal.css` deleted, and
 *        kills the shared header's bottom padding — the fix landed in one file and
 *        was reverted by another." The reverting rule is `slate-shell.css:961-965`,
 *        `height: 118px; padding: 0`, unscoped, loaded after `notes-modal.css`
 *        (`index.html:49` vs `:46`), on an element carrying both classes. The inset
 *        here is `padding-block-end` on `.head`, so the `padding: 0` half of that
 *        rule has nothing to hit; a consumer can still make the HOST 118px tall,
 *        which is its own box and its own business. Asserted with the shell's exact
 *        two declarations.
 *
 * ---------------------------------------------------------------------------
 * FIVE DELIBERATE DEPARTURES. All are in the wave-2 expected-changes manifest.
 *
 *   1. THE RULE UNDER THE HEADER IS NOT DRAWN HERE. Slate ends `.slate-sheet-header`
 *      with `border-bottom: var(--slate-hairline) solid var(--slate-line)`. This
 *      component draws no border, and that is CONVENTIONS §13, which is in the
 *      pre-review checklist as "a divider is the seam utility (§13), never a per-cell
 *      border" and which names this exact line as the utility's job: ".seam-strong |
 *      Ink --ui-line-strong — the emphasised divider: rail edge, **header underline**,
 *      band top." A line between the header and the body is a line BETWEEN TWO CELLS,
 *      so it is the parent's grid gap:
 *
 *          <ui-dialog class="seam-grid seam-rows seam-line">   <- #18, wave 3
 *              <ui-sheet-header heading="Set time">…</ui-sheet-header>
 *              <div class="seam-cell">…body…</div>
 *          </ui-dialog>
 *
 *      §13's own summary of what this buys is bug T2 — "a gap needs no sibling
 *      selector, so N cells give N−1 seams" — and it is why the same header can sit
 *      at the top of a sheet with no line under it at all without a second rule
 *      being invented to suppress one. VISIBLE CHANGE: a `<ui-sheet-header>` mounted
 *      on its own has no line beneath it until a parent draws one. That is a real
 *      difference on screen and it is why the gallery ships a seamed state.
 *      The 18px of space above the line stays here, because it is this cell's inset.
 *
 *   2. THE TITLE IS A REAL HEADING, at a level the consumer picks. Slate's four call
 *      sites are `<h2>` (numpad), `<h3>` (settings sheet) and TWO `<span>`s (time
 *      picker `tpm-title`, notes `notes-modal-title`) — so half the dialogs in the
 *      skin announce their title as ordinary text. TYPE_ROLES.md rule 2: "A heading
 *      is structure, and a screen reader reads `<h2>`, not `.ui-heading`. Never fake
 *      a heading with a styled `<span>`." `level` renders h1…h6; the default is 2,
 *      which is what the one dialog that got it right used. And the other half of
 *      the same rule: an EMPTY `heading` renders NO heading element rather than an
 *      empty one, because an announced heading with nothing in it is a heading that
 *      is not a title. Same test as #31's (`ui-page-header.js:463`).
 *
 *   3. THE TYPE IS THE SHARED ROLE PLUS TWO DECLARATIONS. `.ui-title` from
 *      src/components/type-roles.js already carries the oracle's 28 / 500 / --ui-text
 *      / margin 0; this file adds only the two things a sheet title has and a page
 *      title does not — `text-transform: uppercase` and --ui-tracking-cap. Slate
 *      restates the whole type; the difference is one place to change it instead of
 *      four. Slate's own note on the capitals is carried as written
 *      (slate-components.css:679-681): "Capitals belong to the type, not the string:
 *      typed in, they were an English-only effect." So `heading` keeps the case the
 *      author wrote and the accessible name is unaffected — the same rule
 *      type-roles.js states for `.ui-microcap`.
 *
 *   4. AN EMPTY CLUSTER TAKES NO SPACE. Slate's `.slate-sheet-actions` is always in
 *      the markup; an empty one still eats the 24px flex gap. Here the cluster is
 *      removed from layout when its slot has no element in it, which is the same
 *      mechanism ui-alert-banner and ui-empty-state already use for their optional
 *      parts (`.is-empty { display: none }`). A header with only a title is then a
 *      title, not a title and a 24px hole.
 *
 *   5. RESPONSIVE BEHAVIOUR IS THE SPEC'S, NOT SLATE'S — the oracle is DISQUALIFIED
 *      (Part 10 §4, printed by prov_query.py itself: "the question is RESPONSIVE
 *      BEHAVIOUR. Slate has no answer: 98.4% of its geometry is frozen"). The
 *      measured 159x31 and 538x33 titles are what a 1920x1200 canvas gave them. This
 *      header fills its container, reads no viewport, and has no `@media` anywhere.
 *      Its one narrow-container behaviour is Slate's and is carried on purpose: the
 *      title ellipsises (`min-inline-size: 0` + `overflow: hidden` +
 *      `text-overflow: ellipsis`) and the cluster keeps its full width
 *      (`flex-shrink: 0`), so the way out never gets squeezed off the row. The
 *      ellipsis is visual only — the whole string stays in the accessibility tree.
 *
 *      AND THE DEGENERATE CASE, which every UiElement shares and ui-card documents
 *      first (ui-card.js:104-124): the base puts `container-type: inline-size` on the
 *      host, so in an INTRINSIC-SIZING slot — a bare flex item, a grid cell with
 *      `justify-items: start` — there is no container inline size to fill and the
 *      host resolves to 0. The remedy is one declaration at the call site
 *      (`flex: 1`, `align-self: stretch`, a width, a grid track). Pinned by a test
 *      rather than left to be rediscovered.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY NOT HERE
 *
 *   - NO SELECTION TREATMENT, and nothing in this file reads a selection dial. A
 *     header is not selectable. CONVENTIONS §4: the four dials only mean anything
 *     because there is ONE selection component (#3), and the wave law for wave 2 is
 *     that no component may own a private "selected" look. What this component owes
 *     that law is the negative proof, and the suite carries it both ways: retargeting
 *     all four dials moves nothing this file paints, and a selectable control placed
 *     in the `trail` slot still paints from the dials, unaltered, through the slot.
 *
 *   - NO TITLE SLOT AND NO DEFAULT SLOT. `heading` is a string. This is departure 2's
 *     enforcement half and it is the surprising part of the API, so: a slot would let
 *     a consumer supply its own element, a document rule is the OUTERMOST tree and
 *     wins over `::slotted()` whatever the specificity (CSS Scoping §3.3), and A10's
 *     20px/800 divergence would be one line of screen CSS away again. A child with no
 *     `slot="trail"` is assigned nowhere and therefore not rendered at all — asserted,
 *     because silently dropping content is worth proving rather than discovering.
 *
 *   - NO FOOTER, NO BACKDROP, NO SIZING, NO MODALITY. Those are #18's (SCOPE.md:1591,
 *     spec §4.6) and the whole point of O13's repair is that this file does not grow
 *     a second actions cluster.
 *
 *   - NO STICKY. A header that stays put while a body scrolls is the scroller's
 *     business; #27 (`--ui-section-head-h`) is the component that sticks.
 *
 *   - NO --ui-density ARITHMETIC. styles/tokens.css:174-190: density multiplies band
 *       heights, and NOT --ui-control-h, "because ergonomics is physical". This row's
 *       floor IS --ui-control-h, so it does not move.
 *
 *   - NO ELEVATION AND NO GROUND. The header paints no background: it is a cell of
 *     the surface that contains it, and that surface (#18/#20, wave 3/4) owns the
 *     ground, the radius and the shadow.
 *
 * ---------------------------------------------------------------------------
 * API
 *   <ui-sheet-header heading="Set time"></ui-sheet-header>
 *   <ui-sheet-header heading="Notes" level="1"></ui-sheet-header>   h1…h6, default 2
 *   <ui-sheet-header>                            no heading, no heading ELEMENT — a
 *       <ui-icon-button slot="trail" label="Close">…</ui-icon-button>   cluster-only row
 *   </ui-sheet-header>
 *   <ui-sheet-header heading="Drink out">
 *       <ui-button slot="trail">Cancel</ui-button>
 *       <ui-button slot="trail" variant="primary">Confirm</ui-button>
 *   </ui-sheet-header>
 *   <ui-sheet-header focus-ring="inset">        base attribute, for a clipping parent
 *   ui-sheet-header { flex: 1 }                 in a shrink-to-fit slot, give it an
 *                                               inline size — departure 5
 *   --_ui-sheet-head-min                        the row floor, if --ui-control-h is
 *                                               wrong for one sheet
 *
 *   Labelling the dialog: an IDREF does not cross a shadow boundary, so #18 cannot
 *   point `aria-labelledby` at the heading in here. It sets its own accessible name
 *   from the same string it passed in — `aria-label=${heading}` — which is one value
 *   in one place and cannot drift from what is on screen.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';

/** The levels a heading may take. Anything else falls back to DEFAULT_LEVEL rather
 *  than rendering a non-heading — the same fallback shape base.js uses for
 *  focus-ring and ui-card uses for pad. */
export const SHEET_HEADING_LEVELS = Object.freeze([1, 2, 3, 4, 5, 6]);

/** `<h2>`: what the one Slate dialog that used a real heading element used
 *  (numpad-modal.js:177). */
export const DEFAULT_LEVEL = 2;

export class UiSheetHeader extends UiElement {
    static properties = {
        /** The title, as a string. Not a slot — see "WHAT IS DELIBERATELY NOT HERE". */
        heading: { type: String },
        /** 1…6. Reflected so a screen can see the level it asked for. */
        level: { type: Number, reflect: true },
        /** Whether the trail slot has an element in it (departure 4). */
        _hasTrail: { state: true },
    };

    static styles = [typeRoles, css`
        :host {
            /* THE ROW FLOOR, in one private slot so a sheet with a genuinely
             * different band can move it without a public token appearing
             * (CONVENTIONS §7: internals are --_ui-*, and a private may reference a
             * public token but never carry a colour).
             * SOURCE slate-components.css:670 min-height: var(--slate-control-height);
             * --slate-control-height is 64px (slate-tokens.css:30) = --ui-control-h.
             * NOT multiplied by --ui-density: styles/tokens.css:174-190 keeps
             * --ui-control-h out of the density arithmetic, "because ergonomics is
             * physical". */
            --_ui-sheet-head-min: var(--ui-control-h);
        }

        /* THE ROW, ON A CLASS AND INSIDE THE ROOT (CONVENTIONS §4 rule 2, and the
         * mechanism half of O13/O1). Not on :host — a screen sheet can name the host
         * from outside and can name nothing in here, which is the entire repair.
         * Every value is a token; there is not a number in this block.
         *
         * The six declarations here are Slate's eight minus two, read from
         * slate-components.css:665-672 because the corpus has no answer for this
         * element ("0 elements matched anywhere in this corpus", prov_query.py find
         * --cls slate-sheet-header). The two dropped are box-sizing, which the base
         * already inherits into every element in this root, and border-bottom.
         * box-sizing is inherited from :host via the base's :where(*) rule, so the
         * floor INCLUDES the bottom inset exactly as Slate's own explicit
         * box-sizing: border-box at :666 makes it — a title-only header is 64px
         * tall in total, not 64 + 18.
         *
         * WHAT IS NOT HERE is border-block-end. Departure 1: the line under a header
         * is the parent's row seam (CONVENTIONS §13, .seam-strong, "header
         * underline"), never a per-cell border. */
        .head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--ui-space-5);
            min-block-size: var(--_ui-sheet-head-min);
            padding-block-end: var(--ui-space-4);
        }

        /* THE TITLE. .ui-title (type-roles.js) carries the oracle's 28 / 500 /
         * --ui-text / line-height 1.2 / margin 0; what is added here is what a SHEET
         * title has and a page title does not — the capitals, the tracking, and the
         * three declarations that make one line ellipsise instead of wrap.
         * ORACLE settings-machine-sleep---wake-schedules .slate-heading [i=74]
         *        text-transform = uppercase (slate-components.css .slate-sheet-title,
         *        authored uppercase) and letter-spacing = 1.12px (same rule, authored
         *        0.04em); modal-numpad #numpad-modal-title [i=167] the same 1.12px.
         *        28 x .04 = 1.12 exactly, on both of the corpus's sheet titles.
         *
         * THE TRACKING IS SLATE-INCONSISTENT AND THIS IS THE TOKEN'S SIDE OF IT.
         * Slate's .04em here is an authored LITERAL (slate-components.css:684) and NOT
         * --slate-tracking-cap, which is .12em with the comment "uppercase microcaps"
         * (slate-tokens.css:153). Slate then hand-writes .08em on the live status chip,
         * .01em in notes-modal and slate-shell, and .11/.09/.08/.06/.03/.02em across
         * the editor: rendered census over the 49 baseline states, .12em on 190
         * elements against .04em on 2. Decal draws uppercase tracked text through ONE
         * token, and the value is Slate's own DECLARED one — the drive's
         * slate-inconsistent rule, settled at parity surface 0 and re-checked at
         * surface 2 against the same census. So this title tracks 3.36px at 28px where
         * the oracle renders 1.12px, and it agrees with every other uppercase element
         * in the skin instead of being one of two exceptions.
         *   CORRECTED AT SURFACE 2, and it is a comment fix rather than a value one:
         *   this block used to read "0.04em is --ui-tracking-cap, and 28 x .04 = 1.12
         *   exactly", an identity surface 0 falsified when it moved the token to .12em.
         *   The arithmetic is now 28 x .12 = 3.36, and the departure is stated as one.
         *   ui-sheet-header.render.test.mjs pins both the 3.36 and the drill that
         *   proves it is the token rather than a second literal.
         *
         * The role is written in :where() so it loses every tie; .title is (0,1,0)
         * and wins, which is why the two can share one element.
         * min-inline-size: 0 is what lets a flex item shrink below its content and is
         * what makes the ellipsis reachable at all (slate-components.css:676). */
        .title {
            min-inline-size: 0;
            text-transform: uppercase;
            letter-spacing: var(--ui-tracking-cap);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* THE TRAIL CLUSTER — Slate's .slate-sheet-actions (slate-components.css:
         * 690-695) under a name the dialog footer does not also answer to (O13).
         * flex-shrink: 0 is the half that matters on a narrow sheet: the title gives
         * up width, the way out does not.
         *
         * margin-inline-start: auto IS WHAT KEEPS IT TRAILING WITH NO TITLE (c3-7).
         * justify-content: space-between on .head separates TWO items; with one it
         * puts that item at the START. Until the empty-heading fix there was always a
         * second item — an empty <h2> nobody could see — so space-between held the
         * cluster right by accident, and removing the empty heading moved every
         * cluster-only header's way out to the left edge. An auto margin absorbs the
         * same free space space-between distributes, so the titled case is unchanged
         * to the pixel (asserted at both geometries), and the title-less case is
         * right on purpose rather than by accident. */
        .trail {
            display: flex;
            align-items: center;
            gap: var(--ui-space-3);
            flex-shrink: 0;
            margin-inline-start: auto;
        }

        /* DEPARTURE 4. After .trail, so it wins the (0,1,0) tie on source order —
         * the same shape ui-alert-banner:287 uses for its optional parts. An empty
         * cluster that stayed in the layout would keep the 24px gap and leave a
         * title-only header looking cut off on the right. */
        .is-empty {
            display: none;
        }
    `];

    constructor() {
        super();
        this.heading = '';
        this.level = DEFAULT_LEVEL;
        /* False until a slotchange says otherwise. The other order would be wrong:
         * slotchange does not fire for a slot that never receives an assignment, so
         * defaulting to true would leave the gap in place forever on a title-only
         * header. It fires before first paint, so nothing flashes. */
        this._hasTrail = false;
    }

    /** Normalise before paint, so level="0", level="9" and level="two" are a
     *  documented fallback rather than a heading that is not a heading. */
    willUpdate(changed) {
        if (changed.has('level')) {
            const raw = Number.parseInt(this.level, 10);
            const next = SHEET_HEADING_LEVELS.includes(raw) ? raw : DEFAULT_LEVEL;
            if (next !== this.level) this.level = next;
        }
    }

    /**
     * FILLED IS DEFINED ON ELEMENTS, not on text — the opposite of
     * ui-alert-banner's rule, and for the opposite reason. That component takes a
     * MESSAGE, so an empty wrapper is empty. This one takes CONTROLS: a button whose
     * label is an icon carries no text at all, and counting text would hide the way
     * out of any dialog whose close is a glyph. Element assignment also means
     * slotchange alone is enough — adding or removing a child re-runs assignment —
     * so there is no MutationObserver here and nothing to disconnect.
     */
    #onSlotChange(event) {
        this._hasTrail = event.target.assignedElements({ flatten: true }).length > 0;
    }

    /**
     * SIX LITERAL TEMPLATES, ON PURPOSE. A dynamic tag name needs
     * `lit/static-html.js`, and the whole of departure 2 is that this is a REAL
     * heading element rather than a `<span role="heading">`; six short lines buy
     * that with no second Lit module and no unsafe template path.
     *
     * NO HEADING, NO HEADING ELEMENT (wave-2 review c3-7). `heading` defaults to ''
     * and every level below used to render anyway, which put an EMPTY h1…h6 in the
     * accessibility tree — an announced heading with nothing in it, which is the
     * same defect class departure 2 exists to fix from the other side (a title that
     * is not a heading, and now a heading that is not a title). The test is
     * `Boolean(text)`, byte-for-byte #31's (`ui-page-header.js:463`, `const titled =
     * Boolean(this.heading)`), so the two headers in this wave answer the empty
     * string identically rather than each inventing a rule. A header with only a
     * trail cluster is a legitimate shape — a sheet whose one control is the way out
     * — and it is a gallery state.
     *
     * THE LINE BREAK BEFORE EACH `>` IS LOAD-BEARING FOR GATE D, not a style choice.
     * `scripts/gate-d.js:210` flags any interpolated template chunk that contains a
     * `/` and no newline, `;` or `{` as a route assembled from fragments; a
     * single-line Lit chunk ending in a closing tag is exactly that shape, and these
     * six raised six violations (wave-2 review cross-1). The break is inside the
     * start tag, so the rendered DOM is byte-identical — no text node is added. The
     * durable question (should the gate exempt src/components/?) is wave 2's deferred
     * question for cross-1 and belongs to gate-d.js's owner — scripts/gate-d.js is a
     * shared single-writer file no builder may touch (REVIEW.md, "For wave 3").
     * Deleting six line breaks reverses this.
     */
    #renderHeading() {
        const text = this.heading ?? '';
        if (!text) return nothing;
        switch (this.level) {
            case 1: return html`<h1 id="title" class="ui-title title"
                >${text}</h1>`;
            case 3: return html`<h3 id="title" class="ui-title title"
                >${text}</h3>`;
            case 4: return html`<h4 id="title" class="ui-title title"
                >${text}</h4>`;
            case 5: return html`<h5 id="title" class="ui-title title"
                >${text}</h5>`;
            case 6: return html`<h6 id="title" class="ui-title title"
                >${text}</h6>`;
            default: return html`<h2 id="title" class="ui-title title"
                >${text}</h2>`;
        }
    }

    render() {
        return html`<div id="head" class="head">
            ${this.#renderHeading()}
            <div id="trail" class=${this._hasTrail ? 'trail' : 'trail is-empty'}
            ><slot name="trail" @slotchange=${this.#onSlotChange}></slot></div>
        </div>`;
    }
}

customElements.define('ui-sheet-header', UiSheetHeader);
