/**
 * history-screen.js — <history-screen>, the shot history's shell.
 * SCOPE Part 5 §6 "Skeleton and what flexes"; `LAYOUT_SPEC_DRAFT.md` §4.5 WHOLE as of
 * fix run 6 (the power page, Ben's reversal of D1 for that one surface); wave 5.6
 * (wf-w5p6-history), rows `hist-route-conversion`, `hist-skeleton`, `hist-scroll-floors`,
 * `hist-ab-pickers`, and bugs H3, H6, H9.
 *
 * ===========================================================================
 * A ROUTE, NOT AN OVERLAY  (the phase's headline proof)
 * ===========================================================================
 * §4.5's first line about this screen is "A **route**, not a `display:flex` toggle",
 * and Part 5 §6 says why: "with real navigation state, so back works". Slate toggles a
 * panel over the Live DOM, which is why it has no state to go back TO, why both of its
 * overlays are `aria-modal="true"` with nothing inert behind them (H9), and why every
 * control on the screen underneath stays focusable while the viewer is up.
 *
 * This file is a screen component behind a row in `src/lib/app-routes.js`. What that
 * buys, mechanically:
 *
 *   NAVIGATION STATE IS THE ADDRESS. `#/history` is the state; a hash assignment
 *     pushes a session-history entry, so browser and OS Back work with nothing in this
 *     tree implementing them (`app-root.js` `goto`).
 *   THE SCREEN THAT IS NOT SHOWING IS NOT THERE. `<app-root>` removes the outgoing
 *     screen and creates the incoming one, so while Live is up there is no
 *     `<history-screen>` in the document at all — no hidden copy to be modal over, and
 *     nothing behind an overlay to be left focusable. An always-mounted screen hidden
 *     by a style would be the overlay again wearing a route's name.
 *   MODALITY DISSOLVES. There is no `aria-modal` here and no `inert`: a route is not
 *     modal, it is WHERE YOU ARE. Both would be a lie about a document that contains
 *     exactly one screen.
 *
 * WHAT SURVIVES OF H9 IS FOCUS ON NAVIGATION, and it is INHERITED, not rebuilt. The
 * phase-2 dialog contract is "name an invoker, restore focus to it on leaving"
 * (`ui-dialog.js`: `invoker` — "the element focus returns to"). Its CODE is private to
 * that component and `src/lib/focus-trap.js` exports no restore function, so what
 * crosses over is the contract: Live names the affordance it left from, `<app-root>`
 * carries the pair across the swap, and each screen writes the two lines that put the
 * caret back. A second trap/restore machinery would be the block; there is none here,
 * and there is nothing to trap — every control in the document is on this screen.
 *
 * ===========================================================================
 * THE GRID  (§4.5, quoted)
 * ===========================================================================
 *
 *     <history-screen>            display:grid; height:100%
 *       grid-template-rows: var(--ui-band-h) auto minmax(0,1fr)
 *
 *       ├─ <history-header>   back · picker A · picker B · tab bank      (H3)
 *       ├─ <ui-compare-bar>   auto; NOT SHOWN on the data page           (#44, H8)
 *       └─ #page              one of THREE — the mount region     (fix run 6)
 *
 * ROW 2 IS `auto` AND THAT IS THE PRESENCE RULE. `<ui-compare-bar>` derives
 * `available` from `alignmentControlState()` and answers `display: none` when there is
 * no time axis to slide, so on the data page the row measures zero and the page takes
 * the pixels. Slate does this imperatively — `bar.hidden = state.page === 'data'`
 * (`history-viewer.js:1046`) — and the component expresses it as state; this screen
 * only says which page it is on.
 *
 * H6 — NO `height: 100%` ON A FLEX ITEM. `.slate-hv-data { height: 100% }` over-
 * constrains a flex item whose siblings already claim 226px (`slate-live.css:2422`),
 * the same "declared size is never the used size" pattern as the plots. There is
 * exactly ONE `block-size: 100%` in this file and it is on the HOST, which is a GRID
 * ITEM of `<app-root>`'s single `minmax(0,1fr)` row (`app-root.js` `.app`): a definite
 * track, so 100% of it resolves to the track and the two agree by construction. Every
 * box below it takes its height from a track, and the track arithmetic belongs to the
 * grid. The suite asserts the used size equals the track at two heights.
 *
 * ===========================================================================
 * THE PAGE MOUNT REGION — ITS CONTRACT, FOR THE BUILDER THAT FILLS IT
 * ===========================================================================
 * This file gives the pages a box; `hist-flow-page` and `hist-data-page` fill it.
 *
 *   THE BOX. `#page` is one grid cell: `grid-template-rows: minmax(0,1fr)`,
 *     `grid-template-columns: minmax(0,1fr)`, both minimums 0, and its height is
 *     whatever the screen's third track is — the window, less the band, less the
 *     compare bar when it is showing. It paints `--ui-fascia` because a cell that does
 *     not paint is a hole in the seamed grid rather than a seam (`seams.js` trap 1).
 *
 *   WHO OWNS OVERFLOW: THE PAGE, NEVER THIS REGION. `#page` declares no `overflow` at
 *     all, deliberately — `overflow: auto` makes a box a clipping ancestor (bug L24's
 *     mechanism, and `ui-data-grid.js` says so about its own frame), and a region that
 *     clipped would clip the focus ring of a control it does not own. Part 5 §6's
 *     floors table is the page's to honour:
 *
 *       chart page plots  floor --ui-chart-min-h each, NEVER SCROLL — they resize;
 *                         below two usable plots the page shows ONE plot and a
 *                         selector rather than two unusable strips (H1). No px plot
 *                         height anywhere: the declared 416/344/360/592 already were
 *                         not the rendered 404/334/308.6/507.4.
 *       shot list         floor var(--ui-history-list-min-h) = 3 x --ui-list-row
 *                         (Part 5 §6 marks the figure a PROPOSAL, so it is a token
 *                         with an M18 note in styles/tokens.css and never a literal),
 *                         overflow auto with a VISIBLE scrollbar (§2.4 bans hiding it).
 *       data tables       their own min-content and NO overflow — they are fixed
 *                         summaries, and `<ui-data-grid>`'s frame is a scroll region
 *                         whose overflow:auto would otherwise engage.
 *
 *   HOW A PAGE DECLARES ITS OWN ROWS. On ITSELF, because the slot is
 *     `display: contents` and the mounted element is therefore the grid item — a
 *     wrapper box would take the cell and then have to hand its size on, which is how
 *     a floor stops binding. §4.5: flow is `grid-template-rows: 1.2fr 1fr` (+ a legend
 *     row per plot), data is `auto auto minmax(0,1fr)` (table A, table B, the list
 *     scrolls). RATIO TRACKS, NEVER PX.
 *
 *   HOW IT ARRIVES. As a light-DOM child with `slot="page"` and `data-page` naming
 *     which page it is:
 *
 *       <history-screen>
 *         <history-flow-page slot="page" data-page="flow"></history-flow-page>
 *         <history-power-page slot="page" data-page="power"></history-power-page>
 *         <history-data-page slot="page" data-page="data"></history-data-page>
 *       </history-screen>
 *
 *     Mount one, two or all three. `<ui-tab-bar>` owns which is showing — this screen hands it
 *     the `value -> Element` map and #32 writes `role="tabpanel"`, `tabindex`, the
 *     accessible name, `hidden` and `inert`, and restores all five on release. One
 *     owner for "which page is showing", and it is the component whose job that is.
 *
 * ===========================================================================
 * THE A/B PICKERS  (row `hist-ab-pickers`; #7, #45; T9)
 * ===========================================================================
 * Each picker is #45 `<ui-pick-disc>` beside #7 `<ui-select>`. The disc is
 * SELECTION-FAMILY PAINT ON A DISC and the four dials are its only expression — there
 * is no `selected` look in this file and nowhere for one to go, which is the whole of
 * "one selection component, not thirteen" (DECISIONS.md:244).
 *
 * T9 — THE SELECT HOLDS ITS WIDTH. `ui-select.js` is `flex: none` at its stated size,
 * and this screen states nothing: the control falls back to its own max-content, "the
 * one width it can always honour without lying". Two pickers on one screen therefore
 * render the SAME width, which is exactly what Slate does not do (measured 250px and
 * 213.578px for two selects at one authored width). The option text's own width is
 * M10, an open measurement for the bench pass — recorded, never frozen here.
 *
 * ===========================================================================
 * WHAT THIS FILE DOES NOT DO
 * ===========================================================================
 * No `fetch()` and no endpoint spelled here: with a `boot`, `#openViewer` builds ONE
 * shots store over the boot's one transport and reads it through `HistoryViewer`, so every
 * byte arrives through the generated client and a store; without a boot the shot data
 * still arrives as properties. The power page, the P–Q trajectory and the #11 time key
 * are HERE as of fix run 6 (Ben's reversal of D1 for this surface) and are
 * `history-power-page.js`'s, not this file's — this screen gains a row in HISTORY_PAGES
 * and a third fallback page and nothing else. No `fillMissingOutcomes` and no per-row fetch
 * (B5 / Q17: the scalars come from the one Gate 6 walk and an absent value is a dash).
 * No layout computed in JavaScript: no ResizeObserver, no matchMedia, no measured width
 * written back as a style. D2 — every readable string is a value read through
 * `I18nController`, from this file's first commit.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import { ALIGNMENT_SLOT } from 'src/lib/alignment-offset.js';
import { HistoryViewer } from 'src/lib/history-viewer.js';
import { createShotsStore } from 'src/stores/shots-store.js';

import 'src/screens/history-header.js';

/* THE THREE PAGES. They are this screen's own default content, rendered into the mount
 * region's slot as its FALLBACK — so a caller that mounts its own pages (a fixture
 * staging one, a gallery entry) replaces them by assigning to the slot, and a route-
 * mounted screen, which has no light-DOM children because `<app-root>` creates it with
 * `createElement`, still arrives with the screen it is. No `createElement` here and no
 * `innerHTML`: the pages are template values like everything else. */
import 'src/screens/history-flow-page.js';
import 'src/screens/history-power-page.js';
import 'src/screens/history-data-page.js';

/* THE BOXES' CONTENT — every one a library component, composed. §4.5's component list
 * for this screen. A hand-built copy of any of them is scope invention (Part 10 §9). */
import 'src/components/ui-button.js';
import 'src/components/ui-select.js';
import 'src/components/ui-pick-disc.js';
import 'src/components/ui-tab-bar.js';
import 'src/components/ui-compare-bar.js';

/**
 * The three pages, in the order §4.5 lists them. `value` is the id this screen and the
 * tab bar agree on; `label` is content and goes through `t()` at the call site.
 *
 * THREE, AND THE THIRD IS D1'S CARVE-OUT REVERSED FOR ONE SURFACE. §4.5 draws
 * flow / power / data. D1 kept the derived channels out of the baseline and the power
 * page exists only to show them, so v1 shipped TWO — until Ben reversed it for this page
 * and this page alone (BEN_DECISIONS_2026-08-21.md: "the power page should still be
 * there, same charts as before are required"). Everywhere else D1 still holds: the Live
 * foot band's derived list stays dead and the fused/detector machinery stays deleted.
 *
 * THE ORDER IS §4.5's, NOT THE ORDER THEY WERE BUILT IN. Power sits between Flow and Data
 * because that is where the spec draws it and because the two chart pages belong together;
 * a tab appended to the end would put the table between the two plots.
 *
 * A ROW HERE IS A FLOOR IN THE BAND. `history-header.js`'s `.tabs` min-inline-size is
 * composed from HISTORY_PAGES.length times the hit token — "a third page adds a term here
 * in the same change that adds the tab", written there before there was a third page.
 */
export const HISTORY_PAGES = Object.freeze([
    Object.freeze({ value: 'flow', label: 'Flow' }),
    Object.freeze({ value: 'power', label: 'Power' }),
    Object.freeze({ value: 'data', label: 'Data' }),
]);

/** The page the screen opens on. §4.5 lists flow first and it is the screen's point. */
export const DEFAULT_HISTORY_PAGE = 'flow';

/** The control the caret lands on when this screen is entered. See `#focusEntry`. */
export const HISTORY_ENTRY_FOCUS = 'back';

export class HistoryScreen extends UiElement {
    static properties = {
        /** The app shell's boot object, handed down by <app-root> at creation. */
        boot: { attribute: false },

        /**
         * Has a comparison been asked for?
         *
         * REFLECTED, so a harness reads the state off the DOM and a sheet can see it. It
         * is TRUE whenever a B shot is picked and stays true until B is cleared, so the
         * two ways in — the button, and arriving with a comparison already chosen — land
         * in the same state with no second flag.
         */
        comparing: { type: Boolean, reflect: true },

        /**
         * Which page is showing — one of `HISTORY_PAGES`. Reflected, so a harness state
         * is one attribute and a test reads the selection off the DOM rather than out
         * of a private field. ONE OWNER: this screen writes it and the bar reads it
         * back (the pattern `editor-screen.js:385` records).
         */
        page: { type: String, reflect: true },

        /**
         * The shots the pickers offer: `[{value, label}]`, #7's own `options` shape.
         * Data in, layout out — this screen fetches nothing and derives nothing.
         *
         * NAMED `shotOptions`, NOT `shots`, AND THE REASON IS A CONTRACT BUG. Gate D
         * scans this tree for `/\.shots\b/` and refuses it wherever it appears in code
         * (CB-21): the list endpoint answers `{items, total, limit, offset}`, the old
         * skin read `response.shots`, and its history chips were therefore empty on
         * every machine ever built, silently, behind a debug-level log. The gate cannot
         * tell a screen's own property from that read and it is right not to try — one
         * spelling, retired everywhere, is what makes the retirement checkable. This
         * name also says what the value IS: option rows for a picker, not shot records.
         * (The wave's store publishes its own row model as `rows` and its state field as
         * `items`, so no layer in this screen's stack spells the retired name.)
         *
         * THE LABELS ARE THE CONSUMER'S, AND THEY ARE A SHORT FORM. A picker's floor is
         * its own contents (see `history-header.js`), so the label's width is what
         * decides how much give the tab bank has left; M10 owns that measurement.
         */
        shotOptions: { attribute: false },

        /** The shot in slot A (the reference) and in slot B (the one that moves). */
        shotA: { type: String, attribute: 'shot-a' },
        shotB: { type: String, attribute: 'shot-b' },

        /**
         * Which slot the discs mark as selected — `ALIGNMENT_SLOT.REFERENCE` ('a') or
         * `.MOVING` ('b'). Reflected for the same reason `page` is.
         *
         * NOT NAMED `slot`, and that is a platform fact rather than taste: `slot` is an
         * existing HTMLElement property reflecting the `slot` ATTRIBUTE, which is how a
         * light-DOM child says which slot it goes in. A reactive property of that name
         * would reflect an alignment slot onto the attribute that assigns this screen
         * into somebody else's slot, and the two meanings would silently be one string.
         */
        activeSlot: { type: String, attribute: 'active-slot', reflect: true },

        /**
         * The alignment offset in force, in seconds. The bar CLAMPS it to the ported
         * policy on every update (`alignment-offset.js`, Slate's own ±5 s), so what is
         * read back here is what is applied — "no two controls can disagree".
         */
        offset: { type: Number },

        /**
         * THE ROUTE FORM OF THE DIALOG CONTRACT'S `invoker` (H9). A string id, not an
         * element: `ui-dialog` names an element because the invoker outlives the
         * dialog, and a route swap destroys the screen it left. `<app-root>` sets this
         * on the incoming screen when the caret should go back to a named affordance;
         * unset, entry focus is this screen's own default.
         */
        restoreFocusTo: { attribute: false },
    };

    static styles = [typeRoles, seams, css`
        /* NO BACKTICK IN THIS TEMPLATE, comment or not (CONVENTIONS §9).
         *
         * THE GRID. display / gap / ground come from the seam utility via the host
         * classes added in connectedCallback; :host(.seam-grid) is (0,2,0), so this
         * rule — same selector, written later — is what adds the tracks to it.
         *
         * THE ONE block-size: 100% IN THIS FILE, and H6 is why it is here and
         * nowhere else: the host is a GRID ITEM of <app-root>'s single minmax(0,1fr)
         * row, which is a definite track, so this resolves to the track rather than
         * over-constraining a flex line whose siblings already claimed space. */
        :host(.seam-grid) {
            grid-template-rows: var(--ui-band-h) auto minmax(0, 1fr);
            block-size: 100%;
        }

        /* Row 1. min-inline-size: 0 so a long option label cannot widen the screen;
         * the band's own four items are history-header's and nothing here reaches
         * into them. */
        history-header {
            grid-row: 1;
            min-inline-size: 0;
        }

        /* THE COMPARE AFFORDANCE sits in the B picker's own region, so the header's
         * track list is unchanged whether a comparison is open or not — the button and
         * the picker are the same cell, which is what stops the tabs sliding when one
         * replaces the other. */
        .compare-open {
            display: flex;
            align-items: center;
        }

        /* Row 2, and it is auto in the track list above: the bar is its own height
         * (H8 — "the bar's height set by its own contents, not by whichever button is
         * tallest"), and when it answers display: none on the data page this row
         * measures zero. Nothing here states a height for it. */
        ui-compare-bar {
            grid-row: 2;
            min-inline-size: 0;
        }

        /* Row 3 — THE PAGE MOUNT REGION. One cell, both minimums 0, NO overflow: the
         * page owns its own, and a region that clipped would clip a focus ring it does
         * not own (bug L24). Its contract is in the file header.
         *
         * THE INLINE INSET, AND IT IS A RESTORE (parity surface 6). Without it this
         * region ran edge to edge and so did everything in it: the oracle insets ALL
         * THREE of its History surfaces by exactly 28 --
         *   CITE history-viewer   #hv-page-flow  [i=179] rect x=28 width=1864
         *   CITE history-shotdata #hv-page-data  [i=175] rect x=28 width=1864
         *   CITE expanded-charts  #expanded-page-flow [i=167] rect x=28 width=1864
         * -- while this region rendered x=0 width=1920, which put the data page's
         * Rating column head at 1860..1920 hard against the right edge, the phase
         * tables' row names and the caption discs at x=0 hard against the left, and
         * the power page's time-key caption at 1860..1925 -- FIVE PIXELS OFF THE
         * SCREEN at both Gate A geometries, measured.
         *
         * INLINE ONLY, and the omission is the point. Slate insets its card on all
         * four sides; this screen's vertical dividers are the seam grid's 1px gaps
         * (§4.1, "the seam IS the divider"), which four gated surfaces already draw,
         * and block padding here would ALSO widen the data page's recorded overflow
         * (ECM-1053: 7.59px at bench, 193.84 at the floor) by another 2 x 28 -- a
         * number that is Ben's open question, not this pass's to move.
         *
         * --ui-space-6 is 28: the oracle's own value on this screen, and the token
         * <ui-page-header> and <settings-leaf-pane> already spend on the same job. */
        #page {
            grid-row: 3;
            display: grid;
            grid-template-rows: minmax(0, 1fr);
            grid-template-columns: minmax(0, 1fr);
            padding-inline: var(--ui-space-6);
            min-inline-size: 0;
            min-block-size: 0;
            background-color: var(--ui-fascia);
        }

        /* THE FORWARDING SLOT. display: contents, so the light-DOM page a caller
         * mounts is itself the grid item and a floor declared on the page still binds.
         * A box in the chain would take the cell and then have to hand its size on. */
        #page > slot {
            display: contents;
        }

        /* AND THE SAME PIN FOR THE SLOT'S FALLBACK. ::slotted() matches ASSIGNED nodes
         * only, so the three pages this screen renders as its own default content are
         * not reached by the rule below — they are ordinary children of the slot, made grid
         * items of #page by the display: contents above. One cell, every page, exactly as
         * for a mounted set. */
        #page > slot > [data-page] {
            grid-row: 1;
            grid-column: 1;
        }

        /* AND EVERY PAGE IS THE SAME CELL. The region declares ONE row and ONE column;
         * every page is mounted at once and auto-placement would otherwise put the
         * others in IMPLICIT rows, so they would share the region's height instead of each
         * having it. All of them are pinned to row 1 / column 1 and they overlay - which
         * is what a tab panel set is.
         *
         * IT IS BELT AND BRACES TODAY, stated as such rather than as a fix: #32 marks
         * the page that is not showing hidden, that page is display: none, and a
         * display:none box takes no track - so with the tab bar wired the implicit row
         * never appears and removing this rule changes no measurement (checked, both
         * ways, at bench). What it covers is the window BEFORE the bar has adopted the
         * panels and any stage that mounts a page without one. Placement is the
         * region's business because it owns the cell; SIZING is the page's, and nothing
         * here states one.
         *
         * NO BACKTICK IN THIS COMMENT, and this paragraph is why the rule is repeated
         * at the top of the block: one backtick here ENDS THE TAGGED TEMPLATE, the file
         * stops parsing, and what a reader sees is not a syntax error but the shell
         * answering "the screen module could not be loaded" - measured, in this file,
         * by writing two of them. node --check on a copy is what finds it. */
        ::slotted([slot="page"]) {
            grid-row: 1;
            grid-column: 1;
        }

        /* AND THE HALF THAT MAKES #32's hidden WORK ON A SLOTTED PAGE. ::slotted()
         * is an author rule in THIS root and outranks the UA sheet's
         * [hidden] { display: none } for a page that declares a display of its own —
         * the mechanism ui-tab-bar's own header calls bug P13. A page that is a custom
         * element built on base.js needs no help (it already declares
         * :host([hidden]) { display: none }); a page that is a plain element does. */
        ::slotted([hidden]) {
            display: none;
        }

        /* The back control keeps its own measure in a band that gives elsewhere. */
        #back {
            flex: 0 0 auto;
        }
    `];

    #i18n = new I18nController(this);

    /**
     * THE PORT, PER INSTANCE (`src/lib/history-viewer.js`).
     *
     * Null until a `boot` arrives, which is what keeps every existing stage honest: a
     * fixture or a gallery entry that hands this screen `shotOptions` and two derivations
     * as properties still works, and is still the ONLY caller of those properties. With a
     * boot, the viewer is the owner and the properties are what it publishes.
     *
     * Slate's equivalent is a module-level `state` object with 92 references to it, so
     * two viewers were the same three shots and the same one offset. Here two screens
     * over one store are two independent viewers, which is the whole of the structural
     * conversion and is asserted directly in `test/history-viewer.test.mjs`.
     */
    #viewer = null;

    /** The boot the viewer was built from, so it is built once and not per update. */
    #bootUsed = null;

    /** Whether this mounting has chosen its opening shot. See `#seedNewest`. */
    #seeded = false;

    /** The `value -> Element` map last handed to #32, so it is rebuilt only when the pages
     *  themselves change — the ELEMENTS, not just their names. See `#wirePages`. */
    #panels = null;

    /** How many pages a CALLER has assigned to the mount slot. See `#renderPages`. */
    #assignedPages = 0;

    /** True once the caret has been placed for this mounting. */
    #focused = false;

    constructor() {
        super();
        this.boot = null;
        this.page = DEFAULT_HISTORY_PAGE;
        this.shotOptions = null;
        this.shotA = '';
        this.shotB = '';
        /** Whether the opening shot has been chosen for this mounting. See `#seedNewest`. */
        this.#seeded = false;
        this.activeSlot = ALIGNMENT_SLOT.REFERENCE;
        this.comparing = false;
        this.offset = 0;
        this.restoreFocusTo = null;
    }

    /** The seam classes go on the HOST, not in the constructor — a custom element
     *  constructor must not gain attributes (CONVENTIONS §13 (b)). */
    connectedCallback() {
        super.connectedCallback();
        this.classList.add('seam-grid', 'seam-strong');
    }

    disconnectedCallback() {
        /* The pairing S10 is the absence of. The store keeps its records — another
         * viewer may hold them — and only this screen's subscription goes. */
        this.#viewer?.stop();
        super.disconnectedCallback();
    }

    /**
     * Build the port from the boot, once, and open it.
     *
     * THE SHELL'S SHOTS STORE, NOT ONE OF ITS OWN. This built its own and said why: "there
     * is no second screen reading shots, so hoisting it into app-boot would put a
     * per-screen cache in the app's permanent state". There is a second reader now — the
     * Live page's chart and foot band are about the last stored shot — and the store is on
     * the boot for it. Two stores over one archive means two caches, and the store's whole
     * promise is ONE fetch and ONE gate-6 walk per shot id: the record the Live page had
     * already walked was fetched and walked again the moment this screen opened, 221 KB
     * and a full parse for a shot the app was already holding.
     *
     * IT IS ALSO WHAT MAKES THE OPENING SHOT FREE. This screen now selects the newest shot
     * on arrival (see `#seedNewest`); against a shared store that is the record the Live
     * page has in hand, so the arrival costs nothing.
     *
     * NOT STOPPED ON DISCONNECT, for the same reason as the selector's library store: it
     * is the shell's, and the viewer's own `stop()` drops this screen's subscription and
     * nothing else.
     *
     * `start()` is NOT awaited and its rejection is NOT caught. The store answers a
     * failed read with a typed state the screen shows; anything that throws out of here
     * is a programmer error and must be seen. A catch around this line is the swallowing
     * catch (`history-viewer.js:1007-1018`) wearing a rewrite's name.
     */
    #openViewer() {
        if (this.#bootUsed === this.boot) return;
        this.#bootUsed = this.boot;
        this.#viewer?.stop();
        this.#viewer = null;
        const transport = this.boot?.transport ?? null;
        if (!transport) return;
        /* A boot that does not serve the store still opens the screen, with one of its
         * own — the same shape every other absence on this screen takes, and what keeps a
         * fixture that hands over a bare transport working. */
        const store = this.boot?.shotHistory
            ?? createShotsStore({ transport, logger: this.boot?.logger ?? null });
        this.#viewer = new HistoryViewer({ store, host: this });
        this.#viewer.start();
    }

    /** The port is opened BEFORE the first render, so the first update already has the
     *  store's replayed state rather than a frame of nothing followed by a frame of it. */
    willUpdate(changed) {
        super.willUpdate?.(changed);
        this.#openViewer();
        this.#syncFromViewer();
    }

    /**
     * ONE number the viewer owns outright, and it is the offset.
     *
     * The handlers below write to the viewer, the viewer applies the ported policy — the
     * clamp, and the reset when the MOVING shot changes — and what comes back here is what
     * was APPLIED ("no two controls can disagree", `history-viewer.js:1146`). The reset is
     * why this is a sync rather than a return value: it happens because of a shot change,
     * not because of an offset change, so nothing on the offset's own path would carry it.
     *
     * THE SELECTION IS NOT SYNCED BACK, deliberately. `shotA` / `shotB` / `activeSlot` are
     * inputs a stage may set directly — the capture battery does exactly that — and a sync
     * would blank them the moment a viewer with no selection of its own existed. The
     * handlers write both sides in one gesture, so the two cannot drift; a sync would only
     * add a second owner to a value that already has one.
     */
    #syncFromViewer() {
        const viewer = this.#viewer;
        if (!viewer) return;
        this.offset = viewer.offset;
        this.#seedNewest();
    }

    /**
     * OPEN ON THE LAST SHOT — once, and only when nothing has been picked.
     *
     * THE SCREEN OPENED ON TWO EMPTY PLOTS AND A PICKER THAT NAMED A SHOT. `shotA` starts
     * as the empty string, and a `<ui-select>` with no value shows its FIRST option, so
     * both pickers read "23/08 18:01 · New Profile · 23.5 g" over two panels saying "No
     * shot selected. Pick a shot in the band above to see how it poured." The screen was
     * telling the truth in one place and appearing to have made a choice in the other,
     * which is the worst of the two readings — and every arrival at the History screen
     * met it, including the one from the Live chart.
     *
     * THE NEWEST, because that is the shot a person has just pulled and the one the Live
     * page was already about. Slot B is left empty on purpose: a comparison is something
     * you ask for, and seeding it would put the same shot in both slots and turn the
     * alignment slider on over nothing.
     *
     * ONLY WHEN NOTHING IS PICKED, so it cannot fight a person's own choice, and it
     * cannot re-seed after a deliberate clear within the same mounting: `shotA` is only
     * empty before the first pick. A stage that sets `shotA` by hand (the capture
     * battery does) is already past this guard by the time the rows land.
     */
    #seedNewest() {
        if (this.shotA || this.#seeded) return;
        const options = this.#viewer?.shotOptions ?? [];
        if (!options.length) return;
        this.#seeded = true;
        this.shotA = options[0].value;
        this.#viewer.select(ALIGNMENT_SLOT.REFERENCE, options[0].value);
    }

    render() {
        const t = this.#i18n.t;
        const viewer = this.#viewer;
        const options = Array.isArray(this.shotOptions)
            ? this.shotOptions
            : (viewer?.shotOptions ?? []);
        const tabs = HISTORY_PAGES.map(({ value, label }) => ({ value, label: t(label) }));
        /* TWO SHOTS PICKED IS NOT TWO SHOTS LOADED. With a viewer the answer is "is there
         * a second DERIVATION to slide", so the slider is live the moment there is
         * something to move and not a moment before; without one this stays the property
         * reading a stage sets by hand. */
        const hasComparison = viewer
            ? viewer.hasComparison
            : (Boolean(this.shotA) && Boolean(this.shotB));

        return html`
            <history-header id="band">
                <!-- THE WAY BACK. A real control in the band, because a route with no
                     visible way out is a route only a hardware key can leave — and the
                     tablet's browser chrome is not on screen. It asks the shell to go
                     back rather than reaching for location itself, so a screen
                     mounted in a fixture or the gallery simply does nothing.

                     THE tall ATTRIBUTE IS A BAND CONTROL'S HEIGHT, and this is the
                     third screen to want it (parity surface 6). NO BACKTICK IN THIS
                     COMMENT: it sits inside an html tagged template and one of them
                     ends it where it stands (CONVENTIONS §9). Surface 1 found the Live band's
                     controls at --ui-control-h in a band derived from
                     --ui-control-lg; surface 5 landed the same fix on the selector's
                     Cancel and Confirm; this band was missed because it is a screen's
                     own box rather than <ui-page-header>. The oracle agrees on every
                     control in this band: CITE history-viewer #hv-back [i=161] rect
                     82x82 at y=18, and its three tabs [i=169..171] 80 tall in the same
                     118px row, where this button rendered 64 at y=27. The band's own
                     height does not move: 118 = --ui-control-lg + 2 x --ui-band-inset,
                     so an 82px control is exactly what the derivation was written
                     for. -->
                <ui-button
                    id="back"
                    slot="back"
                    tall
                    label=${t('Back to the live shot')}
                    @click=${this.#onBack}
                >${t('Back')}</ui-button>

                ${this.#renderPicker('picker-a', ALIGNMENT_SLOT.REFERENCE, 'A', t('Shot A'), this.shotA, options)}

                <!-- COMPARING IS A THING YOU ASK FOR (Ben, 24 Aug 2026: "The expanded
                     chart that you get when pressing the chart is not the same as the
                     history viewer.")
                     IT IS TWO SURFACES IN THE OLD SKIN, and the difference is not the
                     plots — those are the same four — but everything around them. Tapping
                     the chart opens ONE shot big; "All shots" opens a COMPARISON, with two
                     pickers and an alignment slider. Decal pointed both at the
                     comparison, so pressing the chart to see the shot you just pulled
                     handed you a second picker you did not ask for and an alignment slider
                     that could not do anything.
                     ONE SCREEN, TWO STATES. Until a comparison is asked for, B and the
                     alignment bar are ABSENT — not disabled — and this is how you ask.
                     Choosing "No comparison" in B puts it away again. -->
                ${this.#comparing
                    ? this.#renderPicker('picker-b', ALIGNMENT_SLOT.MOVING, 'B', t('Shot B'), this.shotB,
                        [{ value: '', label: t('No comparison') }, ...options])
                    : html`<div slot="picker-b" class="compare-open">
                        <ui-button
                            id="compare-open"
                            @click=${this.#onCompareOpen}
                            >${t('Compare')}</ui-button
                        >
                    </div>`}

                <ui-tab-bar
                    id="tabs"
                    slot="tabs"
                    .tabs=${tabs}
                    .value=${this.page}
                    label=${t('History pages')}
                    @change=${this.#onPageChange}
                ></ui-tab-bar>
            </history-header>

            <!-- #44, COMPOSED AND NOT RE-STATED. The bar renders #23 and #1 and owns
                 the caption; the POLICY is src/lib/alignment-offset.js's. available
                 is derived there from has-time-axis, which is the presence rule: a
                 table has no time axis to slide, so on the data page the bar is not
                 shown at all rather than shown dead.

                 THE POWER PAGE KEEPS THE BAR, and the test is inverted for it: the
                 question is which page has NO time axis, and that is the table alone.
                 The power page's first chart is against time like the flow page's; its
                 second is not, and the offset reaches it as the CORRESPONDENCE MARKS
                 (Q16) rather than as a slide — "a time offset cannot move a P-Q path",
                 so what moves is the marks that say which point of one path matches
                 which point of the other. -->
            ${this.#comparing ? html`<ui-compare-bar
                id="compare"
                .offset=${this.offset}
                ?has-comparison=${hasComparison}
                has-time-axis=${this.page === 'data' ? 'false' : 'true'}
                label=${t('Align B')}
                slider-label=${t('Slide shot B along the time axis')}
                reset-label=${t('Reset')}
                @offset-change=${this.#onOffsetChange}
            ></ui-compare-bar>` : nothing}

            <div id="page" part="page"><slot name="page" @slotchange=${this.#onPagesChanged}
                >${this.#renderPages(viewer)}</slot></div>
        `;
    }

    /**
     * THE SCREEN'S OWN TWO PAGES, as the mount slot's FALLBACK CONTENT.
     *
     * A route-mounted screen has no light-DOM children — `<app-root>` creates the element
     * and hands it to Lit as a template value, and nothing appends to it — so a screen
     * whose pages could only arrive from outside would render an empty region on the one
     * path that matters. Fallback content is the platform's own answer: it renders when
     * NOTHING is assigned and disappears the moment a caller assigns a page, so the
     * shell's "mount one or both" contract and the route both work, with one code path
     * and no `createElement` anywhere.
     *
     * THREE PAGES. The power page landed with fix run 6 (Ben's reversal of D1 for this
     * one surface) and brought the #11 time key and the P-Q trajectory with it, which is
     * where the two `--ui-timekey-*` tokens got their first consumers.
     */
    #renderPages(viewer) {
        if (!viewer) return nothing;
        /* A CALLER'S PAGES WIN, AND THE FALLBACK IS NOT BUILT AT ALL. Slot fallback
         * content stops being RENDERED once something is assigned, but Lit would still
         * create it — two spare pages, each building two chart cards nothing shows. The
         * light-DOM read covers markup that arrives with the element and the assigned
         * count covers a stage that appends later (`slotchange` calls `#wirePages`). */
        if (this.#assignedPages > 0 || this.querySelector('[slot="page"]')) return nothing;
        return html`
            <history-flow-page
                data-page="flow"
                .derivationA=${viewer.derivationA}
                .derivationB=${viewer.derivationB}
                .failure=${viewer.failure}
                .offset=${viewer.offset}
            ></history-flow-page>
            <history-power-page
                data-page="power"
                .derivationA=${viewer.derivationA}
                .derivationB=${viewer.derivationB}
                .failure=${viewer.failure}
                .offset=${viewer.offset}
            ></history-power-page>
            <history-data-page
                data-page="data"
                .derivationA=${viewer.derivationA}
                .derivationB=${viewer.derivationB}
                .failure=${viewer.failure}
                .rows=${viewer.rows}
                shot-a=${this.shotA}
                shot-b=${this.shotB}
                @shot-change=${this.#onRowPick}
            ></history-data-page>
        `;
    }

    /**
     * One picker: the disc and the select, in the band's own slot.
     *
     * The disc is `interactive` (a real button) and carries `selected` for the slot in
     * force — selection-family paint, from the dials, and nothing else. The select
     * states no width: #7 falls back to its own max-content, which is T9's fix and the
     * reason both pickers render the same width.
     *
     * AND IT IS A TAG, WHICH IS #45's DEFAULT FORM AND NOT AN OMISSION (parity surface
     * 6). This disc NAMES a slot — the letter is A or B for the life of the screen — so
     * its resting paint is the one Slate puts on the header, filled --ui-key with
     * --ui-text ink inside a --ui-line-strong ring (CITE history-viewer
     * .slate-hv-pick-tag [i=166]). Until surface 6 the component read that paint off
     * `interactive`, so making this disc pressable also made it hollow: the shot list's
     * paint, on the band, which is the failure #45's own header quotes from Slate —
     * "the circle vanished and left a faint letter floating in the header, so B read as
     * disabled". Measured before the fix: this band's resting B disc rendered
     * transparent / --ui-muted / --ui-line. The two questions are now two attributes,
     * this call site answers only one of them, and the hollow row form is still
     * reachable as form="pick".
     */
    #renderPicker(region, slotId, letter, name, value, options) {
        const t = this.#i18n.t;
        return html`
            <ui-pick-disc
                id="disc-${slotId}"
                slot=${region}
                label=${name}
                interactive
                ?selected=${this.activeSlot === slotId}
                @pick=${() => this.#onSlotPick(slotId)}
            >${letter}</ui-pick-disc>
            <ui-select
                id="select-${slotId}"
                slot=${region}
                label=${t('Choose {name}', { name })}
                .options=${options}
                .value=${value ?? ''}
                @change=${(event) => this.#onShotChange(slotId, event)}
            ></ui-select>
        `;
    }

    updated(changed) {
        super.updated?.(changed);
        this.#wirePages();
        this.#focusEntry();
    }

    /**
     * Hand #32 the page elements that are actually mounted.
     *
     * TOLERANT OF ONE, TWO OR THREE, unlike the editor's three-or-nothing: a fixture that
     * mounts only the flow page is a legitimate stage, and a tab whose panel is absent
     * is #32's own documented state rather than something to paper over. Rebuilt only
     * when the pages themselves change — the ELEMENTS, not just their names (`#samePanels`)
     * — because the map's identity is what Lit compares, so rebuilding it every update
     * would re-run the bar's whole adopt/release pass for no change.
     */
    /** A page arrived or left. A light-DOM child does not trigger a re-render, so the
     *  slot's own event is what keeps the tab bar's map honest. */
    #onPagesChanged = () => {
        this.#wirePages();
    };

    #wirePages() {
        const bar = this.renderRoot?.querySelector?.('#tabs');
        const slot = this.renderRoot?.querySelector?.('slot[name="page"]');
        if (!bar || !slot) return;
        const map = new Map();
        /* FLATTEN, so the slot's own fallback content answers when nothing is assigned.
         * That is how the screen's three default pages reach #32's panel map by the same
         * one code path a caller-mounted set does. */
        const assigned = slot.assignedElements ? slot.assignedElements() : [];
        if (assigned.length !== this.#assignedPages) {
            this.#assignedPages = assigned.length;
            this.requestUpdate();
        }
        const mounted = slot.assignedElements ? slot.assignedElements({ flatten: true }) : [];
        for (const el of mounted) {
            const name = el.getAttribute?.('data-page');
            if (name && !map.has(name)) map.set(name, el);
        }
        /* THE GUARD KEYS ON THE ELEMENTS, NOT ON THEIR NAMES, and the difference is the
         * whole of this screen's one block. A caller that assigns pages AFTER the screen
         * has rendered its fallback replaces the two ELEMENTS while the names stay
         * `flow data`, so a name-keyed guard returned early and #32 went on pointing at
         * two DETACHED fallbacks: nothing was ever marked hidden and BOTH pages painted
         * into the one grid cell. Measured before this line, through the real shell and
         * the route fixture: flow and data both 591 tall at bench and both 404.75 at the
         * floor, `hidden` false on both, `bar.panels` holding two elements whose
         * `isConnected` was false. That is the path every gallery frame drives
         * (`api.stagePages`), so both captured History frames photographed it.
         *
         * The SET is still what is compared, so an update that changed something else
         * costs nothing; only the identity test is new. */
        if (this.#samePanels(map)) return;
        this.#panels = map;
        bar.panels = map;
    }

    /** True when `map` names the same pages AND holds the same elements as the map #32
     *  was last handed. A `Map` with equal keys is NOT the same panel set. */
    #samePanels(map) {
        const prev = this.#panels;
        if (!prev || prev.size !== map.size) return false;
        for (const [name, el] of map) if (prev.get(name) !== el) return false;
        return true;
    }

    /**
     * WHERE THE CARET LANDS ON ENTRY, and the second half of H9.
     *
     * Deterministic, once per mounting, and the same rule whichever way the screen was
     * reached: the caret goes to the affordance `<app-root>` named (a return), or to
     * the way out (an arrival). A screen that left focus on `<body>` would make the
     * first Tab after a navigation land somewhere that depends on what the browser
     * happened to remember, which is the state H9 describes from the other side.
     *
     * `preventScroll` because a focus that scrolls the band is a focus that moved the
     * layout to announce itself.
     */
    async #focusEntry() {
        if (this.#focused) return;
        const wanted = typeof this.restoreFocusTo === 'string' && this.restoreFocusTo
            ? this.restoreFocusTo
            : HISTORY_ENTRY_FOCUS;
        const target = this.renderRoot?.getElementById?.(wanted)
            ?? this.renderRoot?.getElementById?.(HISTORY_ENTRY_FOCUS);
        if (!target || typeof target.focus !== 'function') return;
        this.#focused = true;

        /* AWAIT THE CONTROL, and this line is a measured bug rather than caution.
         * Focus goes INWARD: #1 forwards focus() to the native button in its own
         * shadow root and falls back to super.focus() when that button does not exist
         * yet - and a host with neither delegatesFocus nor tabindex "is not focusable
         * at all, so document.querySelector('ui-button').focus() was a silent no-op"
         * (ui-button.js:248). A child component's first render is scheduled AFTER its
         * parent's updated(), so focusing here without waiting focuses nothing and
         * leaves the caret on <body> - measured, exactly that, before this await. */
        await target.updateComplete;
        target.focus({ preventScroll: true });
    }

    /**
     * Back. The shell owns navigation, so this ASKS — a composed, bubbling `navigate`
     * event that `<app-root>` catches with a template binding. `detail.back` rather
     * than a route id because "back" is a different intent from "go to Live": the shell
     * pops the entry it pushed when it can, and only falls through to a navigation when
     * the entry underneath is not ours.
     */
    #onBack = () => {
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { back: true },
            bubbles: true,
            composed: true,
        }));
    };

    /** #3's composed `change`, arriving through #32's shadow root. One owner of the
     *  selection: this screen writes `page` and the bar reads it back. */
    #onPageChange = (event) => {
        const value = event?.detail?.value;
        if (typeof value !== 'string') return;
        this.page = value;
    };

    /** Comparing was asked for. The B picker appears; nothing is loaded until it is used. */
    #onCompareOpen = () => { this.comparing = true; };

    /**
     * True while the comparison controls belong on screen.
     *
     * A PICKED B COUNTS, whether or not the button was pressed: a screen that arrived
     * with a comparison already in force would otherwise hide the controls that are
     * plainly doing something.
     */
    get #comparing() { return this.comparing || Boolean(this.shotB); }

    /**
     * A DISC WAS PRESSED: that slot becomes the one in force.
     *
     * THE COURTESY EMIT IS GONE (audit F-012, removed 29 Aug 2026). It used to end
     * `dispatchEvent(new CustomEvent('slot-change', { detail: { slot } }))` and its
     * doc line said the change was "re-emitted for whatever wires the shots, because
     * this screen decides nothing about the data". Nothing ever wired it: the gate found
     * the name emitted here and heard nowhere in `src/`, and a hand sweep of
     * `index.html`, `tools/` and `test/harness/` agreed.
     *
     * IT WAS ALSO NOT TRUE OF THIS METHOD. Marking a disc is the one thing on this screen
     * that decides nothing about the DATA — `history-viewer.js` `setActiveSlot` says so
     * itself ("it does not touch the offset... marking a disc changes no shot") — so
     * there was never a downstream that needed telling. The two lines above are the whole
     * of the job and they are both local.
     *
     * NOT TO BE CONFUSED with `ui-compare-bar`'s `applySlotChange`, which dispatches the
     * fixed literal `offset-change` with `reason: 'slot-change'` in its detail. That wire
     * is live, is heard by `#onOffsetChange` below, and is untouched.
     */
    #onSlotPick(slotId) {
        if (this.activeSlot === slotId) return;
        this.#viewer?.setActiveSlot(slotId);
        this.activeSlot = slotId;
    }

    /**
     * A ROW'S DISC WAS PRESSED, on the data page's shot list.
     *
     * IT GOES THROUGH `#onShotChange`, which is the whole point of routing it here rather
     * than letting the list own a selection: the dropdown and the disc are two routes to
     * one state, and the screen has one handler that loads the shot and one place that
     * re-announces the change. Slate says the same thing about the same pair — "The
     * dropdowns and these buttons are two routes to the same state ... so they cannot
     * disagree about what is selected".
     *
     * THE EVENT IS STOPPED HERE. The page announces `shot-change` with the band's own
     * detail shape, and `#onShotChange` announces it again on the screen; letting the
     * page's copy keep bubbling would deliver two identical events to anything listening
     * above, one of which named a slot the screen had not acted on yet.
     */
    #onRowPick = (event) => {
        event.stopPropagation();
        const slot = event?.detail?.slot;
        if (slot !== ALIGNMENT_SLOT.REFERENCE && slot !== ALIGNMENT_SLOT.MOVING) return;
        this.#onShotChange(slot, event);
    };

    /** A shot was chosen. The screen holds the id it was given and says what changed;
     *  loading the shot is the wiring's, not the skeleton's. */
    #onShotChange(slotId, event) {
        const value = event?.detail?.value ?? event?.target?.value ?? '';
        if (slotId === ALIGNMENT_SLOT.REFERENCE) this.shotA = value;
        else {
            this.shotB = value;
            /* CLEARING B PUTS THE COMPARISON AWAY. "No comparison" is the way back, and
             * leaving the empty picker and a dead alignment bar on screen after it would
             * be the state this pair exists to avoid. */
            if (!value) this.comparing = false;
        }
        /* THE PORT LOADS IT — one record, one walk, for a shot a person picked. NOT
         * awaited and NOT caught: the store reports a failed read as typed state
         * (`viewer.failure`), and anything that throws out of here is a programmer error
         * that must be seen rather than a rendering that quietly does not change. */
        this.#viewer?.select(slotId, value);
        this.dispatchEvent(new CustomEvent('shot-change', {
            detail: { slot: slotId, value },
            bubbles: true,
            composed: true,
        }));
    }

    /**
     * The bar clamped it; this screen records what was applied. The bar's own event
     * keeps travelling, so whatever rebuilds the series hears it once, from the bar.
     *
     * RESET ARRIVES HERE TOO, AND IT ALWAYS DID (audit F-015, routed 29 Aug 2026).
     *
     * This screen used to carry `@reset=${this.#onOffsetReset}` on the bar and an
     * `#onOffsetReset` handler whose body was
     * `this.offset = this.#viewer ? this.#viewer.resetOffset() : 0`. Neither could ever
     * run. `ui-compare-bar` has exactly ONE `dispatchEvent` in the whole file and it
     * dispatches the fixed literal `offset-change`; its `#onReset()` calls
     * `this.#emit('reset')`, and `#emit(reason)` puts the argument in `detail.reason`,
     * never in `type`. `<ui-compare-bar>` is a custom element containing no `<form>`, so
     * the builtin DOM `reset` event cannot fire on it either.
     *
     * THE GATE COULD NOT SEE IT. `reset` is a standard DOM form event and sits in
     * `gate-wire.js`'s fixed `BUILTIN_EVENTS`, which excludes a name from BOTH sets; the
     * gate's own header states that limit ("a CustomEvent deliberately named like a
     * builtin is INVISIBLE to this gate"). The list is fixed at ship time and is Ben's
     * call, so it is untouched — and nothing here renames an event either.
     *
     * SO THE REASON IS READ INSTEAD. `reason === 'reset'` calls `viewer.resetOffset()`,
     * which is the method the dead binding meant to reach.
     *
     * `resetOffset()` AND `setOffset(0)` ARE THE SAME CALL TODAY —
     * `history-viewer.js:338` is literally `return this.setOffset(0)` — so the gesture
     * has always ended in the right number by falling through the clause below. That is
     * worth writing down rather than hiding: the binding was DOUBLE dead, and this change
     * moves no behaviour. What it buys is that the reset gesture reaches the viewer by
     * the method named for it, so a `resetOffset` that ever stops being `setOffset(0)`
     * does not silently take the wrong path.
     */
    #onOffsetChange = (event) => {
        const value = event?.detail?.offset;
        if (typeof value !== 'number') return;
        if (event?.detail?.reason === 'reset') {
            this.offset = this.#viewer ? this.#viewer.resetOffset() : 0;
            return;
        }
        /* OFFSET-AS-REDRAW. The number goes to the port, the port hands it to the pages
         * as a property, and the pages rebuild their series with `shiftSeriesX`. Nothing
         * here reaches into a plot to rewrite a trace's x array in place — that machinery
         * existed because a redraw was assumed expensive, it addressed one index past the
         * end, and the throw was swallowed. */
        this.offset = this.#viewer ? this.#viewer.setOffset(value) : value;
    };
}

customElements.define('history-screen', HistoryScreen);
