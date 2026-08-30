/**
 * ui-menu — Wave 3 item #21, the menu / popover.
 *
 * Spec row (LAYOUT_SPEC_DRAFT.md §5.2 #21): "Menu / popover | context-menu.css +
 * .pe-chip-add-menu (profile-editor-v3.css:846) | Two implementations; the first is
 * half-overridden by the shell (§7)." The wave row adds the shape in one line:
 * "Anchored floating list with viewport clamping in the page's own coordinate space
 * ... Bounded and scrollable, like every overlay."
 *
 * Spec §4.6 is the contract this file answers to, verbatim: "Menus, toasts and the
 * context menu get the same treatment: x-menu and x-toast as components, positioned
 * from the anchor with a viewport clamp, on the --ui-z-* scale."
 *
 * ============================ NO ORACLE ANSWER EXISTS =========================
 * Disqualification check, run first (Part 10 §4), and it disqualifies the corpus
 * outright — this component has no oracle row at all:
 *
 *     prov_query.py find --cls context-menu       -> 0 elements in 0 states
 *     prov_query.py find --cls context-menu-item  -> 0 elements in 0 states
 *     prov_query.py find --cls pe-chip-add-menu   -> 0 elements in 0 states
 *
 * All three are transient: none of the 49 captured states has a menu open, so the
 * corpus never walked one. The tool's own answer is the instruction followed here —
 * "The corpus has no answer for this element: read the Slate source read-only, or
 * record a reversible choice in DEFERRED_QUESTIONS.md". Every value below is
 * therefore a SOURCE read of the two implementations, cited by file and line, plus
 * the token sheet where the rewrite has already decided.
 *
 *   - DECISIONS.md settles nothing about menus (grep: zero hits for menu/popover).
 *     The register decision that reaches this file is the one behind every overlay:
 *     "no menu/list-item/popover/toast component" is defect O6.
 *   - RESPONSIVE BEHAVIOUR has no Slate answer. Slate's menu clamps to a viewport
 *     that was 1920x1200 under a scaled canvas; spec §1.2 rejected the canvas, so the
 *     clamp is written fresh against the real window here.
 *   - §7's 140 layout bugs: O2 and O11 are filed against THIS component and are the
 *     two things it exists to kill. Matching Slate there reproduces the bug.
 *
 * ============================ THE TWO BUGS THIS KILLS =========================
 * O2 (spec:1219) "slate-shell.css:935-954 re-declares the context menu UNSCOPED and
 *   later, and box-shadow: none kills its elevation — a floating menu with no shadow,
 *   and roughly half of context-menu.css unreachable."
 *   SOURCE context-menu.css:21 declares the shadow this component is supposed to
 *   have: 0 12px 32px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08) — and that pair is
 *   the SOURCE line for --ui-elev-2 in the rewrite's own token sheet
 *   (styles/tokens.css:797-798). So the fix is not "put a shadow back": it is that the
 *   elevation is a token, declared once, in a shadow root nothing outside can reach.
 *   There is no second sheet to re-declare it, and the suite drills --ui-elev-2 to
 *   prove the rendered shadow comes from the token rather than from a literal.
 *
 * O11 (spec:1228) "A context menu taller than the viewport loses its LAST items: top
 *   is clamped to >= 12, the menu has no overflow rule, and the page cannot scroll."
 *   SOURCE context-menu.js:44 clamps top into the viewport; context-menu.css has no
 *   overflow declaration anywhere; main.css:153-155 stops the page scrolling. Three
 *   correct-looking lines in three files that add up to silent data loss.
 *   The fix is spec §2.4 applied to this box: the cap is COMPUTED from the space that
 *   actually exists beside the anchor, the list carries an explicit floor and a stated
 *   overflow-y: auto with a visible scrollbar, and the order of surrender is written
 *   down (below). A menu of forty items keeps all forty reachable at the 1000x600
 *   floor geometry, which is the assertion the suite makes.
 *
 * ============================ THE ORDER OF SURRENDER (spec §2.4) ==============
 * "an explicit min-height, an explicit overflow behaviour, and a defined order of
 * surrender when the container is shorter than the sum of the floors."
 *
 *   1. The menu takes the side of the anchor with room for it (below preferred, which
 *      is Slate's rule at context-menu.js:35 and the same test).
 *   2. If the natural height does not fit, the menu is CAPPED to the space that side
 *      has and the list scrolls. Nothing is ever positioned off-screen.
 *   3. If that side cannot give --_ui-menu-min-block (two rows), the anchor gap is
 *      what surrenders: the cap becomes the whole viewport less its edge padding and
 *      the menu is allowed to cover its own anchor. A menu that hides the button you
 *      pressed is recoverable; a menu whose last three items are unreachable is not.
 *
 * ============================ POSITIONING, AND THE TRAP IN IT =================
 * Slate positions in JS (context-menu.js:27-53) and it is the right call — CSS anchor
 * positioning is not in the target WebView's guaranteed set and the arrow needs the
 * same numbers. Carried: centre on the anchor, MARGIN 8px gap, VIEWPORT_PADDING 12px
 * clamp, flip above when below will not fit, --arrow-offset back to the anchor's
 * centre. Those two constants become --ui-space-2 and --ui-space-3, read from the
 * cascade rather than written again in JS, so retargeting the spacing scale moves the
 * geometry (the suite drills exactly that).
 *
 * THE TRAP, MEASURED RATHER THAN REASONED. A fixed-position box is only positioned
 * against the window while no ancestor has taken the containing block off it, and the
 * list of things that do is longer than it looks. Measured in this rig (HeadlessChrome
 * 147, a 10px fixed child at top/left 0 inside a host at [90, 120]):
 *
 *     contain: layout            TRAPPED   kid lands at the host, not the window
 *     contain: paint             TRAPPED
 *     transform: translateX(0)   TRAPPED
 *     filter: blur(0)            TRAPPED
 *     backdrop-filter: blur(2px) TRAPPED
 *     will-change: transform     TRAPPED
 *     container-type: inline-size    not trapped
 *     container-type: size           not trapped
 *
 * The first reading of this component's own header claimed the base's container-type
 * was the trap, on the strength of css-contain's layout-containment clause. It is NOT,
 * in this engine — the two container-type rows above are the correction, and they are
 * the reason this note carries a table instead of an argument.
 *
 * What IS still true is the consumer half, and it is Slate's own bug §3.7: "because
 * #scaled-content is transformed it is a stacking context, so the notes modal's
 * z-index: 10000 is sealed inside it and paints BELOW the context menu's 9999". Six of
 * the eight rows above are things a screen legitimately does to an ancestor. Slate
 * escapes by appending the menu to document.body (context-menu.js:14, :22); a
 * component cannot. So the position pass MEASURES its containing block instead, at
 * (0,0) and again at (100%, 100%), and both anchors the geometry and clamps inside
 * the box those two rects describe. With no such ancestor that box IS the window, so
 * spec §4.6's "viewport clamp" is what a screen gets; inside one it is the space the
 * surface can actually reach, because a fixed box's coordinate space is its
 * containing block and clamping in another space is clamping in the wrong one.
 *
 * That is also what makes the gallery honest: a state gives its stage contain: layout
 * and gets a self-contained coordinate space, so eight open menus sit in eight stages
 * instead of piling up in one corner of the viewport.
 *
 * ============================ SLATE'S VALUES, AND WHERE THEY LAND =============
 * Two implementations, and where they agree it is treated as a real constraint.
 *
 *   SURFACE   min-width 220px      context-menu.css:15 AND profile-editor-v3.css:847
 *                                  — the same number in both, so it is kept, as ONE
 *                                    number in one place (spec §2.3's rule about the
 *                                    same number written twice)
 *             max-width 320px      context-menu.css:16
 *             border 1px           context-menu.css:19 -> --ui-border-w
 *             border-color         slate-shell.css:936 var(--slate-line) -> --ui-line
 *             background           slate-shell.css:938 var(--slate-surface) -> --ui-surface
 *             color                slate-shell.css:939 var(--slate-text) -> --ui-text
 *             border-radius        context-menu.css:20 --slate-radius-xl (12px);
 *                                    the shell override says -lg (8px). tokens.css:293
 *                                    settles it with the token's own comment — "a
 *                                    floating SURFACE: modal, sheet, menu" — so
 *                                    --ui-radius-xl. See DEPARTURES 1.
 *             box-shadow           context-menu.css:21 -> --ui-elev-2 (O2)
 *             padding 6px / 7px    context-menu.css:22 / profile-editor-v3.css:848 —
 *                                    two implementations, two numbers, neither on the
 *                                    spacing ladder. --ui-space-1 (4px), the nearest
 *                                    step, on a 600px-tall floor geometry where 2x4px
 *                                    of chrome is two-thirds of a scroll line.
 *   ITEM      min-height 64px      slate-shell.css:945, and 64px is --ui-control-h
 *                                    exactly. context-menu.css:82's 48px is the
 *                                    --ui-hit-min floor; the shipped menu is a
 *                                    control-height row and clears the floor with room.
 *             font-size            slate-shell.css:947 var(--slate-text-base) = 17px
 *                                    -> --ui-text-base (17px, same step, same comment)
 *             font-weight 400      slate-shell.css:948 -> --ui-weight-regular
 *             border-radius        context-menu.css:79 --slate-radius (6px) -> --ui-radius
 *             padding 12px 14px    context-menu.css:71 -> --ui-space-3 (12px) both axes
 *             gap 12px             context-menu.css:69 -> --ui-space-3 exactly
 *             hover/focus fill     slate-shell.css:952 var(--slate-key-on) -> --ui-key-on
 *             danger ink           context-menu.css:90 var(--slate-danger) -> --ui-status-danger
 *             danger fill          context-menu.css:94 color-mix(in srgb, danger 12%,
 *                                    transparent) — carried, on the token
 *   ARROW     12px square          context-menu.css:49-50. Spec §2.3 case 3 permits a
 *                                    fixed px for "icon and glyph geometry intrinsic to
 *                                    the artwork (stroke widths, a 12px arrow square)"
 *                                    — this is the arrow that clause is about.
 *             offset -7px          context-menu.css:56 — written here as the derivation
 *                                    it is, calc(size / -2 - border), which is -7px for
 *                                    a 12px square inside a 1px border.
 *
 * ============================ DELIBERATE DEPARTURES ============================
 *  1. RADIUS 12px, NOT THE SHELL'S 8px. The shell override (slate-shell.css:937) is
 *     half of bug O2 — the unscoped re-declaration — and its radius line is part of
 *     what the audit calls "roughly half of context-menu.css unreachable". The token
 *     sheet already decided which step a floating surface takes, in the token's own
 *     comment, so the menu matches the dialog and the sheet rather than the override.
 *     Reversible in one word; recorded as a deferred question.
 *  2. DIVIDERS ARE GAPS. Slate draws a divider as a 1px background element with side
 *     margins (context-menu.css:118-122) — the per-cell border CONVENTIONS §13 exists
 *     to remove. A separator here splits the items into GROUPS and the seam utility's
 *     1px grid gap over a coloured ground draws the line, so N groups give N-1 seams
 *     and there is no per-cell rule to get wrong. Nothing is re-implemented: the
 *     classes are seams.js's.
 *  3. THE INTER-ITEM 2px GAP GOES (context-menu.css:25). It exists so the item's own
 *     rounded hover fill does not touch its neighbour's. With the seam grid carrying
 *     the only divider, the gap has no job left, and 2px is not on the spacing ladder.
 *  4. THE ONE FOCUS RING STAYS. Slate's item declares outline: none on :focus-visible
 *     (context-menu.css:87) and paints a background instead — the fifth focus
 *     treatment §3.6 counts. Here the base's ring is kept AND the fill is kept; the
 *     ring takes --ui-focus-offset-inset, because the list scrolls and an outset ring
 *     on the first row would be clipped by its own scrollport (bug L24's class).
 *  5. ICONS ARE GLYPHS, NOT MARKUP. Slate's builder assigns item.icon through
 *     innerHTML (context-menu.js:77, :105). An item list is DATA; a data path that
 *     reaches innerHTML is a script path. The icon field renders as text.
 *  6. NO TRANSITION, for now. context-menu.css:31 and :81 are SOURCE lines for
 *     --ui-dur and --ui-dur-fast, so this component is where they would first get a
 *     consumer — but a transition on a property Gate A asserts on is a flake
 *     generator (settle() is four frames; the fill transition is 80ms), and
 *     CONVENTIONS §11 has no home yet for the reduced-motion rule the honest version
 *     needs. Recorded as a deferred question rather than half-built.
 *  7. NO document-LEVEL LISTENER. Slate attaches a capturing keydown handler to
 *     document (context-menu.js:152) because its menu is a detached div. Focus lives
 *     inside this component's own surface, so the keys are handled on the surface and
 *     Escape does not travel any further than the overlay that consumed it.
 *
 * ============================ WHAT THIS COMPONENT DOES NOT OWN =================
 * WHAT THE ITEMS DO. A select event leaves; no item state comes back. And the menu
 * does not know why it was opened — a long-press gesture on a list row belongs to the
 * row (#26), which passes itself as anchorElement.
 *
 * TOKEN-ONLY. No store import, no endpoint, no data layer (Part 10 §12).
 *
 * @fires select      - {detail: {id, index, item}} composed and bubbling, after the
 *                      menu has closed and focus has been returned. Slate's order
 *                      (context-menu.js:116-117), and it is the right one: the
 *                      consumer's handler may open a dialog, and it must be able to
 *                      move focus LAST.
 * @fires open-change - {detail: {open, reason}} composed and bubbling, whenever the
 *                      component opens or closes itself. reason is one of trigger,
 *                      keyboard, escape, outside, select, tab.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';

/** Requested placement. The RESOLVED one is published on the host as `placed`. */
const PLACEMENTS = ['auto', 'below', 'above'];

const clamp = (min, value, max) => Math.min(Math.max(value, min), Math.max(min, max));

/** A computed custom property as a number. Unset or unparseable reads as 0. */
const lengthOf = (style, name) => {
    const raw = parseFloat(style.getPropertyValue(name));
    return Number.isFinite(raw) ? raw : 0;
};

export class UiMenu extends UiElement {
    static properties = {
        /**
         * The rows. `[{id, label, icon?, danger?, disabled?}]`, and `{separator: true}`
         * for a group break. Lit's default converter JSON-parses the attribute form,
         * which is what lets the gallery declare a menu in static markup.
         */
        items: { type: Array },
        /**
         * Reflected: a consumer styles around an open menu, and the suite reads it.
         * Setting it from outside opens the menu WITHOUT moving focus — see
         * #focusOnOpen. Focus is only taken when the component itself was asked to
         * open by a press or a key.
         */
        open: { type: Boolean, reflect: true },
        /** Accessible name for the list, when the trigger's own name is not enough. */
        label: { type: String },
        /** 'auto' (default) | 'below' | 'above'. A request, not the outcome. */
        placement: { type: String, reflect: true },
        /** The trigger refuses to open. The base dims the host. */
        disabled: { type: Boolean, reflect: true },
    };

    static styles = [
        /* Structural fragment first (CONVENTIONS §5a). The seam utility is the
         * divider; departure 2. */
        seams,
        css`
            /* ---------------------------------------------------------------
             * THE HOST IS THE TRIGGER'S BOX, AND NOT A CONTAINER.
             *
             * The host wraps a trigger and nothing else, so it shrink-wraps it —
             * and that is what forces container-type off. MEASURED here, a 200x64
             * button inside a span:
             *
             *     display: inline-block; container-type: inline-size   ->    0 x 64
             *     display: inline-block; container-type: normal        ->  200 x 64
             *     display: block;        container-type: inline-size   -> 1281 x 64
             *
             * inline-size containment means the contents cannot affect the inline
             * size, so a shrink-to-fit box with it on resolves to zero and the
             * trigger overflows a 0px host. base.js:407-409 documents the same shape
             * from the other end ("an inline box with size containment is a 0x0 box
             * - the failure looks like my component vanished").
             *
             * Affordable because this component has no container query to resolve:
             * its rows are --ui-control-h and its position is the window's business.
             * ------------------------------------------------------------- */
            :host {
                container-type: normal;
                display: inline-block;

                /* The two constants Slate writes in JS (context-menu.js:3-4,
                 * MARGIN 8 and VIEWPORT_PADDING 12), declared once here on the
                 * spacing ladder and READ BACK by the position pass. One owner per
                 * dimension (spec §2.3): the cascade owns the number, JS owns the
                 * arithmetic. */
                --_ui-menu-gap: var(--ui-space-2);
                --_ui-menu-edge: var(--ui-space-3);

                /* The §2.4 floor, expressed on the CAP rather than on the box: the
                 * menu is never capped below two full rows, and if the anchor's side
                 * cannot give that, the anchor gap surrenders instead (see the
                 * header). A min-block-size on the surface itself would inflate a
                 * one-item menu to two rows of empty surface. */
                --_ui-menu-min-block: calc(2 * var(--ui-control-h));

                /* SOURCE context-menu.css:15 and profile-editor-v3.css:847 both
                 * declare min-width: 220px. Two independent implementations agreeing
                 * makes it a real constraint; §2.3's rule is that it may then exist
                 * exactly once, which is here. Max from context-menu.css:16. */
                --_ui-menu-min-inline: 220px;
                --_ui-menu-max-inline: 320px;

                /* Spec §2.3 case 3, which names this artwork: "a 12px arrow square". */
                --_ui-menu-arrow-size: 12px;
            }

            :host(:is([disabled], [aria-disabled="true"])) {
                cursor: not-allowed;
            }

            /* ---------------------------------------------------------------
             * THE BACKDROP — a click catcher, not a scrim.
             *
             * SOURCE context-menu.css:1-7: fixed, inset 0, transparent, one step
             * below the menu. No --ui-scrim: a menu is not modal, and the page
             * behind it must stay readable. What it buys is that the dismissing tap
             * is SWALLOWED rather than landing on whatever was underneath — on a
             * wall panel the control under a menu is often Sleep or a shot control.
             *
             * Same z as the surface, ordered before it in the template: two boxes at
             * one z-index paint in tree order, so the scale keeps one value for this
             * layer instead of gaining a --ui-z-menu-backdrop nobody asked for.
             * ------------------------------------------------------------- */
            .backdrop {
                position: fixed;
                inset: 0;
                z-index: var(--ui-z-menu);
                background-color: transparent;
            }

            /* ---------------------------------------------------------------
             * THE SURFACE. Painted by CLASS, never by id (CONVENTIONS §4 rule 2);
             * the ids are for the suite to query by.
             *
             * inset-*-start reads two private properties the position pass writes.
             * They are the only two lengths in this component JS owns, and CSS
             * declares the properties they land in exactly once.
             * ------------------------------------------------------------- */
            .surface {
                position: fixed;
                inset-block-start: var(--_ui-menu-top, 0px);
                inset-inline-start: var(--_ui-menu-left, 0px);
                z-index: var(--ui-z-menu);

                display: flex;
                flex-direction: column;
                inline-size: max-content;
                min-inline-size: var(--_ui-menu-min-inline);
                /* 100% of a fixed box is its CONTAINING BLOCK, which for a page with
                 * no transformed ancestor is the window — so this is spec §4.6's
                 * "viewport clamp" without a single vw in the file, and it stays true
                 * inside the contained ancestors measured in the header. Rule 1
                 * forbids a component ADAPTING to the viewport: there is no width
                 * query here and the rows measure the same at both geometries. */
                max-inline-size: min(
                    var(--_ui-menu-max-inline),
                    calc(100% - 2 * var(--_ui-menu-edge))
                );
                max-block-size: var(--_ui-menu-max-block, none);

                padding: var(--ui-space-1);
                border: var(--ui-border-w) solid var(--ui-line);
                border-radius: var(--ui-radius-xl);
                background-color: var(--ui-surface);
                color: var(--ui-text);

                /* O2, and the whole of it. One token, one declaration, in a shadow
                 * root that slate-shell.css's successor cannot reach. */
                box-shadow: var(--ui-elev-2);
            }

            /* The pointer at the anchor. SOURCE context-menu.css:45-64. */
            .surface::before {
                content: "";
                position: absolute;
                inset-inline-start: var(--_ui-menu-arrow, 50%);
                inline-size: var(--_ui-menu-arrow-size);
                block-size: var(--_ui-menu-arrow-size);
                border: var(--ui-border-w) solid var(--ui-line);
                background-color: var(--ui-surface);
                transform: translateX(-50%) rotate(45deg);
            }

            /* Slate writes -7px twice (context-menu.css:56, :61). It is not a
             * literal, it is half the square plus the border it has to cover. */
            .surface.below::before {
                inset-block-start: calc(var(--_ui-menu-arrow-size) / -2 - var(--ui-border-w));
                border-inline-end-width: 0;
                border-block-end-width: 0;
            }

            .surface.above::before {
                inset-block-end: calc(var(--_ui-menu-arrow-size) / -2 - var(--ui-border-w));
                border-inline-start-width: 0;
                border-block-start-width: 0;
            }

            /* NO outline: none ON THE SURFACE, deliberately. It carries tabindex=-1
             * so a slotted-content popover has somewhere to put focus, which means
             * the base's ring rule reaches it through [tabindex] — and suppressing
             * that would be a component deciding it wants a different focus story
             * (CONVENTIONS §3). A programmatic focus after a press does not match
             * :focus-visible, so the ring only ever appears for a keyboard, which is
             * when it is wanted.
             *
             * ---------------------------------------------------------------
             * THE LIST — the scroll region, and the O11 fix's other half.
             *
             * spec §2.4: an explicit floor, an explicit overflow, a visible
             * scrollbar. The floor is one full row, so a squeezed menu shows a row
             * and scrolls rather than collapsing to a sliver; the cap above it comes
             * from the position pass. min-block-size does not fight flex shrink —
             * it only stops it below one row, which is the point.
             *
             * The focus offset flips to the inset variant for this subtree (the
             * mechanism base.js:439-445 documents): an outset ring on the first row
             * is clipped by this scrollport, which is bug L24's class exactly.
             * ------------------------------------------------------------- */
            .list {
                --_ui-focus-offset: var(--ui-focus-offset-inset);
                min-block-size: var(--ui-control-h);
                overflow-y: auto;
            }

            /* Departure 2: a group is a seam CELL. Not .seam-cell — that paints
             * --ui-fascia, the page body, which is the wrong ground inside a floating
             * surface. Opaque, so the grid's ink shows only in the 1px gaps. */
            .group {
                display: grid;
                background-color: var(--ui-surface);
            }

            /* ---------------------------------------------------------------
             * THE ITEM. A control-height row: SOURCE slate-shell.css:945 min-height
             * 64px, which is --ui-control-h, over context-menu.css:82's 48px floor.
             * ------------------------------------------------------------- */
            .item {
                display: flex;
                align-items: center;
                gap: var(--ui-space-3);
                inline-size: 100%;
                min-block-size: var(--ui-control-h);
                margin: 0;
                padding: var(--ui-space-3);
                border: 0;
                border-radius: var(--ui-radius);
                background-color: transparent;
                color: inherit;
                /* The UA sheet gives a button its own family and size, and no reset
                 * reaches into a shadow root. inherit rather than var(--ui-font-family):
                 * the family already crosses the boundary from styles/document.css and
                 * restating it would break a screen setting one locally
                 * (CONVENTIONS §11). */
                font-family: inherit;
                font-size: var(--ui-text-base);
                font-weight: var(--ui-weight-regular);
                text-align: start;
                cursor: pointer;
            }

            /* One rule for both, as Slate has it (context-menu.css:84-88). The hover
             * half is not testable on this rig — headless Chrome reports (hover:none)
             * and CDP can remove the feature but not grant it — so the suite asserts
             * the focus half and the rule keeps them identical by construction. */
            .item:is(:hover, :focus-visible) {
                background-color: var(--ui-key-on);
            }

            .item.danger {
                color: var(--ui-status-danger);
            }

            /* SOURCE context-menu.css:94, on the token: a destructive row must not
             * highlight in the neutral fill, or the one row you want to be sure about
             * is the one that looks like every other. */
            .item.danger:is(:hover, :focus-visible) {
                background-color: color-mix(in srgb, var(--ui-status-danger) 12%, transparent);
            }

            /* Paint is the base's one disabled dial; this is only the pointer. */
            .item:disabled {
                cursor: not-allowed;
            }

            .icon {
                flex: none;
                display: inline-grid;
                place-items: center;
                inline-size: var(--ui-icon);
                block-size: var(--ui-icon);
            }

            /* min-inline-size: 0 or a long label refuses to wrap inside the flex row
             * and pushes the surface past its own max-inline-size. */
            .label {
                flex: 1 1 auto;
                min-inline-size: 0;
            }
        `,
    ];

    constructor() {
        super();
        this.items = [];
        this.open = false;
        this.label = '';
        this.placement = 'auto';
        this.disabled = false;

        /** Set by an interaction; null for a declarative open. See #focusOnOpen. */
        this.#pendingFocus = null;
        this.#returnFocusTo = null;
        this.#triggerRefs = [];
        /** An anchor other than the slotted trigger — a list row that long-pressed. */
        this.anchorElement = null;
    }

    #pendingFocus;

    #returnFocusTo;

    #triggerRefs;

    #onWindowChange = () => {
        if (this.open) this.#position();
    };

    /* ---- what the component is anchored to --------------------------------- */

    /** The first element assigned to the trigger slot, or null. */
    get triggerElement() {
        const slot = this.renderRoot?.querySelector?.('slot[name="trigger"]');
        return slot?.assignedElements?.({ flatten: true })?.[0] ?? null;
    }

    /** What the surface is positioned against: an explicit anchor, else the trigger. */
    get anchor() {
        return this.anchorElement ?? this.triggerElement;
    }

    get #surface() {
        return this.renderRoot?.querySelector?.('#surface') ?? null;
    }

    /**
     * The rows that can take focus. Disabled rows are skipped by the keyboard walk,
     * which is Slate's own rule (context-menu.js:124-126) and the reason a disabled
     * row keeps aria-disabled as well as the native attribute.
     */
    get #enabledItems() {
        return [...(this.renderRoot?.querySelectorAll?.('.item') ?? [])]
            .filter((el) => !el.disabled);
    }

    /** Items split on separators. Empty groups are dropped, so a leading, trailing or
     *  doubled separator cannot draw a seam against nothing. */
    get #groups() {
        const groups = [];
        let current = [];
        (Array.isArray(this.items) ? this.items : []).forEach((item, index) => {
            if (item && item.separator) {
                if (current.length) groups.push(current);
                current = [];
                return;
            }
            if (item) current.push({ item, index });
        });
        if (current.length) groups.push(current);
        return groups;
    }

    /* ---- the public surface ------------------------------------------------- */

    /** Open and take focus, as a press would. */
    show({ focus = 'first', reason = 'api' } = {}) {
        if (this.open || this.disabled) return;
        this.#pendingFocus = focus;
        this.#returnFocusTo = deepActiveElement();
        this.open = true;
        this.#announce(reason);
    }

    /**
     * Close, returning focus SYNCHRONOUSLY to whatever had it when the menu took focus
     * — before this call returns, and exactly once.
     *
     * ONE RESTORE, NOT TWO. This used to leave the restore to #restoreFocus in
     * updated(), and updated() is a microtask later: a consumer that called hide() and
     * then moved the caret itself had it taken back a tick afterwards, and the same
     * second focus landed after every select handler (MEASURED via CDP: a handler that
     * focused a dialog ended with the caret on the trigger). The restore has to be a
     * thing that HAPPENS during the call that caused it, so the caller is always the
     * last writer. #restoreFocus clears its own target, so updated()'s call is now a
     * no-op for every close that came through here and still covers the one close that
     * cannot: a consumer flipping the `open` PROPERTY, which has no method to hook.
     */
    hide(reason = 'api') {
        if (!this.open) return;
        /* A menu opened declaratively never captured a return target, but the user
         * may still have arrowed into it — and the rows are about to be removed from
         * the DOM. Without this line focus lands on document.body, which is precisely
         * the defect §4.6 names ("no focus restore") arriving by the other door. */
        if (!this.#returnFocusTo && this.#hasFocusInside()) {
            this.#returnFocusTo = this.triggerElement;
        }
        this.open = false;
        this.#restoreFocus();
        this.#announce(reason);
    }

    /** True when the caret is on the surface or on one of its rows. */
    #hasFocusInside() {
        const active = this.renderRoot?.activeElement ?? null;
        return Boolean(active && this.#surface?.contains(active));
    }

    /**
     * Close and put the caret back SYNCHRONOUSLY, before this call returns.
     *
     * Every close the component makes itself goes through here, and the reason is that
     * Lit's update is a microtask while two of the three dismissals have something
     * racing it: Tab's default action is the browser's focus advance, and a select
     * event's handler may move focus itself. Both must see the caret already home.
     * MEASURED as a red test before this existed — the select listener read the caret
     * still sitting on the row it had just pressed.
     *
     * It is `hide` itself that restores now, so this is the name the dismissal paths
     * read by rather than a second mechanism: two paths were the defect. Kept as the
     * one word the six call sites say, and as the place this note lives.
     */
    #closeAndReturn(reason) {
        this.hide(reason);
    }

    toggle(reason = 'api') {
        if (this.open) this.hide(reason);
        else this.show({ reason });
    }

    /* ---- lifecycle ---------------------------------------------------------- */

    willUpdate(changed) {
        if (changed.has('placement')) {
            const raw = String(this.placement ?? '').trim().toLowerCase();
            const next = PLACEMENTS.includes(raw) ? raw : 'auto';
            if (next !== this.placement) this.placement = next;
        }
    }

    updated(changed) {
        super.updated(changed);

        if (this.disabled) this.setAttribute('aria-disabled', 'true');
        else this.removeAttribute('aria-disabled');

        if (changed.has('open')) {
            if (this.open) {
                this.#attach();
                /* Positioned synchronously here, not in a rAF. Slate needs the frame
                 * (context-menu.js:181) because it builds the DOM imperatively and has
                 * nothing to measure until the browser has laid it out; Lit has
                 * already written the DOM by the time updated() runs, so measuring now
                 * is measuring the real thing — and it is measured AFTER the items
                 * exist, which is bug chart-C10's shape one component over ("measures
                 * its host before its own legend is inserted"). */
                this.#position();
                this.#focusOnOpen();
            } else {
                this.#detach();
                /* THE PROPERTY PATH ONLY. Every close that ran through hide() has
                 * already restored and cleared its target, so this call does nothing
                 * for those — deliberately, because a second focus one microtask after
                 * the caller's own is exactly how the component used to steal the caret
                 * back from a select handler. What is left for it is `menu.open = false`
                 * written by a consumer, which passes through no method of ours. */
                this.#restoreFocus();
            }
        } else if (this.open) {
            /* Items or placement changed under an open menu: the cap and the flip are
             * both functions of the content, so they are recomputed, not kept. */
            this.#position();
        }

        this.#syncTrigger();
    }

    disconnectedCallback() {
        this.#detach();
        this.#clearTrigger();
        super.disconnectedCallback();
    }

    render() {
        /* The trigger's events are taken on the SLOT: an event from a slotted node
         * passes through the slot in its composed path, so one listener covers
         * whatever the consumer put there — #1's ui-button, a plain button, or an icon
         * button — without this component reaching into anyone's tree. */
        return html`
            <slot
                name="trigger"
                @click=${this.#onTriggerClick}
                @keydown=${this.#onTriggerKeydown}
                @slotchange=${this.#onTriggerSlotChange}
            ></slot>
            ${this.open ? this.#renderSurface() : nothing}
        `;
    }

    #renderSurface() {
        const groups = this.#groups;
        return html`
            <div
                id="backdrop"
                class="backdrop"
                @click=${this.#onBackdropClick}
            ></div>
            <div
                id="surface"
                class="surface"
                tabindex="-1"
                @keydown=${this.#onSurfaceKeydown}
            >
                ${groups.length ? html`
                    <div
                        id="list"
                        class="list seam-grid seam-rows seam-line"
                        role="menu"
                        aria-label=${this.label ? this.label : nothing}
                    >${groups.map((group) => html`
                        <div class="group" role="group">${group.map((entry) => this.#renderItem(entry))}</div>
                    `)}</div>
                ` : nothing}
                <slot></slot>
            </div>
        `;
    }

    #renderItem({ item, index }) {
        const disabled = Boolean(item.disabled);
        return html`
            <button
                class="item ${item.danger ? 'danger' : ''}"
                type="button"
                role="menuitem"
                tabindex="-1"
                data-index=${String(index)}
                ?disabled=${disabled}
                aria-disabled=${disabled ? 'true' : nothing}
                @click=${this.#onItemClick}
            >
                ${item.icon ? html`
                    <span class="icon" aria-hidden="true">${item.icon}</span>
                ` : nothing}
                <span class="label">${item.label ?? ''}</span>
            </button>
        `;
    }

    /* ---- position ----------------------------------------------------------- */

    /**
     * Two measured passes, and the first one is the interesting half.
     *
     * PASS 1 parks the surface at (0,0) of its containing block with the cap lifted,
     * and reads the rect. That single rect answers two questions this component
     * cannot assume: how tall the menu WANTS to be, and where the origin of its
     * containing block is in window coordinates.
     *
     * PASS 2 parks it at (100%, 100%) and reads the rect again. A percentage inset on
     * a fixed box resolves against its containing block, so the second rect's top-left
     * IS the containing block's bottom-right — measured, not walked up the ancestor
     * chain guessing at which of transform / filter / backdrop-filter / contain /
     * will-change / perspective did it this time.
     *
     * Those two rects give the CLAMP BOX. For a page with no such ancestor it is the
     * window exactly, which is spec §4.6's "viewport clamp"; inside one it is the
     * space the surface can actually reach, because a fixed box's coordinate space is
     * its containing block and clamping in any other space is clamping in the wrong
     * one. Slate can only escape the question by appending the menu to document.body
     * (context-menu.js:14, :22); a component cannot.
     *
     * PASS 3 writes the four numbers. Everything is in window coordinates until the
     * last two lines, where the origin comes back off.
     */
    #position() {
        const surface = this.#surface;
        const anchor = this.anchor;
        if (!surface || !anchor || !anchor.getBoundingClientRect) return;

        const style = getComputedStyle(this);

        surface.style.setProperty('--_ui-menu-max-block', 'none');
        surface.style.setProperty('--_ui-menu-top', '0px');
        surface.style.setProperty('--_ui-menu-left', '0px');
        const origin = surface.getBoundingClientRect();
        const originX = origin.left;
        const originY = origin.top;
        const naturalBlock = origin.height;
        const inlineSize = origin.width;

        /* ---- ONE SPACE, AND IT IS THE PAINTED ONE ----------------------------
         *
         * The three passes above are all `getBoundingClientRect()`, which answers
         * PAINTED px. The five token lengths below are computed styles, which answer
         * LAYOUT px. Those were the same number until the fit landed
         * (src/lib/app-fit.js) and drew the app at a scale — 0.6675 on the bench
         * tablet — and a gap, an edge inset and a minimum height mixed into painted
         * arithmetic at two thirds of their intended size is a menu that clamps
         * against the wrong edge and flips above when it did not need to.
         *
         * So the tokens are converted INTO the painted space here, the arithmetic
         * below is unchanged, and the four written values are converted back at the
         * end. The ratio is measured off the surface itself — border box against
         * border box — so a transformed ancestor or a browser zoom counts too, and it
         * is 1 when nothing is scaled, which is what it was before any of this. */
        const toPainted = surface.offsetWidth > 0 ? origin.width / surface.offsetWidth : 1;
        const toLayout = toPainted > 0 ? 1 / toPainted : 1;

        const gap = lengthOf(style, '--_ui-menu-gap') * toPainted;
        const edge = lengthOf(style, '--_ui-menu-edge') * toPainted;
        const minBlock = lengthOf(style, '--_ui-menu-min-block') * toPainted;
        const arrowSize = lengthOf(style, '--_ui-menu-arrow-size') * toPainted;
        const radius = lengthOf(getComputedStyle(surface), 'border-top-left-radius') * toPainted;

        surface.style.setProperty('--_ui-menu-top', '100%');
        surface.style.setProperty('--_ui-menu-left', '100%');
        const far = surface.getBoundingClientRect();
        const box = { left: originX, top: originY, right: far.left, bottom: far.top };

        const a = anchor.getBoundingClientRect();

        const spaceBelow = box.bottom - a.bottom - gap - edge;
        const spaceAbove = a.top - box.top - gap - edge;

        /* Slate's own test, kept: prefer below, flip only when below cannot hold the
         * menu AND above has more room (context-menu.js:35). */
        let place = this.placement;
        if (place !== 'below' && place !== 'above') {
            place = (spaceBelow >= naturalBlock || spaceBelow >= spaceAbove) ? 'below' : 'above';
        }

        let available = place === 'below' ? spaceBelow : spaceAbove;
        if (available < Math.min(naturalBlock, minBlock)) {
            /* Step 3 of the order of surrender: the anchor gap yields, not the items. */
            available = box.bottom - box.top - 2 * edge;
        }
        const maxBlock = Math.max(0, available);
        const blockSize = Math.min(naturalBlock, maxBlock);

        let top = place === 'below' ? a.bottom + gap : a.top - gap - blockSize;
        top = clamp(box.top + edge, top, box.bottom - edge - blockSize);

        let left = a.left + a.width / 2 - inlineSize / 2;
        left = clamp(box.left + edge, left, box.right - edge - inlineSize);

        /* The arrow points at the anchor's centre wherever the clamp put the box, and
         * stops short of the corners so it never straddles the radius. */
        const arrowReach = radius + arrowSize;
        const arrow = clamp(
            arrowReach,
            a.left + a.width / 2 - left,
            Math.max(arrowReach, inlineSize - arrowReach),
        );

        surface.classList.toggle('below', place === 'below');
        surface.classList.toggle('above', place === 'above');
        this.setAttribute('placed', place);

        /* BACK INTO LAYOUT px — these four are read as lengths inside the scaled
         * subtree. Every one is a DIFFERENCE (the origin subtraction is what takes the
         * translation back off), so a single ratio converts them exactly. */
        surface.style.setProperty('--_ui-menu-max-block', `${maxBlock * toLayout}px`);
        surface.style.setProperty('--_ui-menu-arrow', `${arrow * toLayout}px`);
        surface.style.setProperty('--_ui-menu-top', `${(top - originY) * toLayout}px`);
        surface.style.setProperty('--_ui-menu-left', `${(left - originX) * toLayout}px`);
    }

    #attach() {
        /* Reposition rather than close. Slate closes on both (context-menu.js:212-213)
         * because its menu cannot follow a moving anchor; this one can, and a menu
         * that vanishes when the tablet's on-screen keyboard resizes the window is a
         * worse answer than one that moves. */
        window.addEventListener('resize', this.#onWindowChange);
        window.addEventListener('scroll', this.#onWindowChange, true);
    }

    #detach() {
        window.removeEventListener('resize', this.#onWindowChange);
        window.removeEventListener('scroll', this.#onWindowChange, true);
    }

    /* ---- focus -------------------------------------------------------------- */

    /**
     * Focus is taken only when the open was an INTERACTION. A declarative open — a
     * consumer setting the property, or the gallery writing the attribute — leaves
     * focus where it was, because stealing it is exactly the behaviour that makes
     * eight open menus on one gallery page fight over the caret.
     */
    #focusOnOpen() {
        const want = this.#pendingFocus;
        this.#pendingFocus = null;
        if (!want) return;

        const items = this.#enabledItems;
        if (!items.length) {
            this.#surface?.focus();
            return;
        }
        (want === 'last' ? items[items.length - 1] : items[0]).focus();
    }

    /**
     * The half spec §4.6 says every overlay in the old app is missing: "no inert, no
     * aria-hidden, no focus trap, no focus restore ... Escape is not the gap;
     * isolation and focus are." Slate's menu focuses its first item on open
     * (context-menu.js:184-185) and returns focus nowhere at all on close, so a
     * keyboard user who presses Escape lands on document.body.
     */
    #restoreFocus() {
        const target = this.#returnFocusTo;
        this.#returnFocusTo = null;
        if (!target || !target.isConnected || typeof target.focus !== 'function') return;
        target.focus();
    }

    #focusStep(delta) {
        const items = this.#enabledItems;
        if (!items.length) return;
        const active = this.renderRoot?.activeElement ?? null;
        const at = items.indexOf(active);
        /* From nowhere, ArrowDown lands on the first row and ArrowUp on the last —
         * the same wrap Slate computes at context-menu.js:138 and :142. */
        const next = at === -1
            ? (delta > 0 ? 0 : items.length - 1)
            : (at + delta + items.length) % items.length;
        items[next].focus();
    }

    /* ---- events ------------------------------------------------------------- */

    #onTriggerClick = () => {
        if (this.disabled) return;
        if (this.open) this.#closeAndReturn('trigger');
        else this.show({ focus: 'first', reason: 'trigger' });
    };

    #onTriggerKeydown = (event) => {
        if (this.disabled) return;
        if (event.key === 'Escape' && this.open) {
            event.preventDefault();
            event.stopPropagation();
            this.#closeAndReturn('escape');
            return;
        }
        /* Enter and Space are deliberately absent: the trigger is a real button, its
         * native click opens the menu through #onTriggerClick, and handling the key
         * as well would open and immediately re-toggle it. */
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        const focus = event.key === 'ArrowUp' ? 'last' : 'first';
        if (this.open) this.#focusStep(focus === 'last' ? -1 : 1);
        else this.show({ focus, reason: 'keyboard' });
    };

    #onTriggerSlotChange = () => {
        this.#clearTrigger();
        this.#syncTrigger();
    };

    /**
     * SOURCE context-menu.js:188-193, with its comment, which is a measured tablet
     * finding worth carrying: "Dismiss on click (fires after the full touch sequence
     * ends). Listening on touchstart with preventDefault left the in-progress touch
     * bound to the now-hidden backdrop and broke the next pan on the profile list."
     */
    #onBackdropClick = (event) => {
        event.stopPropagation();
        this.#closeAndReturn(this.#pressWasOnTrigger(event) ? 'trigger' : 'outside');
    };

    /**
     * WHY THE BACKDROP HAS TO ASK. The backdrop is `position: fixed; inset: 0`, so it
     * covers the trigger too, and a second press on the trigger is caught HERE and
     * stopped — `#onTriggerClick`'s `if (this.open) this.#closeAndReturn('trigger')`
     * never runs. The menu still closes, which is why this went unseen; what was wrong
     * is the WORD it closed with.
     *
     * MEASURED, before this hit test existed: press #trig, settle, press #trig again ->
     * open-change reasons ['trigger', 'outside']. A consumer keying a re-open guard or
     * analytics off detail.reason cannot tell the toggle from a dismissal, and the
     * component's own documented toggle path was dead code.
     *
     * The remedy stays inside the backdrop rather than punching a hole in it: the
     * dismissing press must still be SWALLOWED (that is the whole point of the
     * backdrop on a wall panel, where the control under a menu is often Sleep), so the
     * event is not re-dispatched to the trigger — only classified. Geometry, not
     * event.target: the target is always the backdrop, and the trigger is the element
     * whose box the pointer is over.
     *
     * A press with no coordinates (a synthetic `backdrop.click()`, clientX/Y = 0) is
     * reported as 'outside'. That is honest — nothing was pointed at.
     */
    #pressWasOnTrigger(event) {
        const trigger = this.triggerElement;
        if (!trigger || typeof event.clientX !== 'number') return false;
        /* Both zero is the synthetic click, not the top-left pixel. */
        if (event.clientX === 0 && event.clientY === 0) return false;
        const r = trigger.getBoundingClientRect();
        return event.clientX >= r.left && event.clientX <= r.right
            && event.clientY >= r.top && event.clientY <= r.bottom;
    }

    #onSurfaceKeydown = (event) => {
        switch (event.key) {
            case 'Escape':
                event.preventDefault();
                /* An overlay consumes the Escape it acted on. Slate's handler is on
                 * document in the CAPTURE phase (context-menu.js:152), so a menu open
                 * inside a dialog closes both. */
                event.stopPropagation();
                this.#closeAndReturn('escape');
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.#focusStep(1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.#focusStep(-1);
                break;
            case 'Home': {
                event.preventDefault();
                const items = this.#enabledItems;
                if (items.length) items[0].focus();
                break;
            }
            case 'End': {
                event.preventDefault();
                const items = this.#enabledItems;
                if (items.length) items[items.length - 1].focus();
                break;
            }
            case 'Tab':
                /* NOT prevented. Tab out of a menu closes it and the sequential walk
                 * continues from the trigger — so the next stop is the element after
                 * the trigger, not whatever happened to follow a row inside a shadow
                 * root. #closeAndReturn is what makes that deterministic against the
                 * browser's own focus advance. */
                this.#closeAndReturn('tab');
                break;
            default:
                break;
        }
    };

    #onItemClick = (event) => {
        const button = event.currentTarget;
        if (button.disabled) return;
        const index = Number(button.dataset.index);
        const item = (Array.isArray(this.items) ? this.items : [])[index];
        if (!item) return;

        /* Close FIRST, then tell the consumer — Slate's order (context-menu.js:116-117)
         * and the right one: focus is back on the trigger before the handler runs, so
         * a handler that opens a dialog moves focus last and nothing races it. */
        this.#closeAndReturn('select');
        this.dispatchEvent(new CustomEvent('select', {
            detail: { id: item.id ?? null, index, item },
            bubbles: true,
            composed: true,
        }));
    };

    #announce(reason) {
        this.dispatchEvent(new CustomEvent('open-change', {
            detail: { open: this.open, reason },
            bubbles: true,
            composed: true,
        }));
    }

    /* ---- the trigger's ARIA -------------------------------------------------- */

    /**
     * aria-haspopup and aria-expanded belong on the thing announced as a button, and
     * on NOTHING ELSE.
     *
     * For a plain slotted `<button>` that is the element itself. For #1's ui-button the
     * host is a role-less generic wrapper and the button is one shadow root down, so
     * the attributes go to `control`, which ui-button publishes as public API for
     * exactly this reason (ui-button.js:242-244 — "the inner control - what focus, the
     * press and the native disabled belong to", and its own focus() forwards there on
     * the same argument). Lit does not manage these attributes on that element, so a
     * re-render of the trigger cannot clear them.
     *
     * THIS USED TO WRITE BOTH, and the split is measured rather than reasoned. With
     * both copies authored, Chrome's AX tree (Accessibility.getFullAXTree, BENCH,
     * menu open) carried:
     *   - exactly ONE node with `expanded` — role button, name "Actions", the control.
     *     aria-expanded on a role-less generic is DROPPED; that copy never did anything.
     *   - but TWO with a popup: the button, and an unnamed `generic` carrying hasPopup
     *     from the host copy — Chrome exposes that one anyway.
     * An unnamed generic announcing a popup next to the real button is bug L23's shape
     * ("aria-label on role-less <div>s"), and the same reading ui-tab-bar.js:455-462 and
     * ui-search-field.js:208-215 already act on. So: one announcement, on the element
     * that has the role. The host branch survives for the plain-button case, where the
     * slotted element IS the button.
     *
     * aria-controls is deliberately absent: an IDREF cannot cross a shadow boundary,
     * and the menu's id is inside this component's root. Recorded as a deferred
     * question rather than written as a reference that resolves to nothing.
     */
    #syncTrigger() {
        const el = this.triggerElement;
        if (!el) return;
        const control = el.control instanceof HTMLElement ? el.control : null;
        const next = control ? [control] : [el];

        /* THE TARGET CAN MOVE, AND WHAT IT MOVES OFF MUST BE CLEANED.
         *
         * updated() calls this on every update, and `el.control` is undefined until
         * ui-button upgrades — so the first sync of a not-yet-upgraded trigger writes
         * to the HOST, and a later one writes to the control. Without this, the host
         * keeps the attributes it was given and the tree ends up with exactly the
         * unnamed generic-carrying-hasPopup that writing one copy exists to prevent.
         * The bug was invisible while both copies were written, which is how a
         * one-line narrowing turns into a re-entrancy trap. */
        for (const old of this.#triggerRefs) {
            if (next.includes(old)) continue;
            old.removeAttribute('aria-haspopup');
            old.removeAttribute('aria-expanded');
        }

        this.#triggerRefs = next;
        for (const target of this.#triggerRefs) {
            target.setAttribute('aria-haspopup', 'menu');
            target.setAttribute('aria-expanded', this.open ? 'true' : 'false');
        }
    }

    #clearTrigger() {
        for (const target of this.#triggerRefs) {
            target.removeAttribute('aria-haspopup');
            target.removeAttribute('aria-expanded');
        }
        this.#triggerRefs = [];
    }
}

/** activeElement through shadow roots — what "the element that had focus" means here. */
function deepActiveElement() {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    return el;
}

customElements.define('ui-menu', UiMenu);
