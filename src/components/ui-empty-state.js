/**
 * ui-empty-state.js - component #38 of the 57-component inventory: THE "NOTHING
 * HERE" BLOCK.
 *
 * Wave 1, item #38 (SCOPE Part 4, "Wave 1 - primitives"; LAYOUT_SPEC_DRAFT.md §5.2
 * row 38): "Empty state | hand-rolled at slate-shell.css:1975-1976 + three
 * left-aligned-by-accident states". The row's own note is the brief:
 *
 *     "'Nothing here' block for lists and panes. Authored centred, rendered
 *      left-aligned by shell rules today (T11) - a component makes that impossible."
 *
 * Token-only, per the wave law: no data layer, no ReaPrime, no endpoint. Every word
 * it shows arrives as an attribute or through a slot; every value it paints arrives
 * from styles/tokens.css.
 *
 * ---------------------------------------------------------------------------
 * THE DEFECT IT RETIRES - T11, and it dies STRUCTURALLY
 * ---------------------------------------------------------------------------
 * LAYOUT_SPEC_DRAFT.md §7.5 T11, verbatim:
 *
 *     "The loading/empty states are authored centred and rendered LEFT-ALIGNED by
 *      three shell rules - four call sites affected."
 *      (slate-shell.css:1304-1306, 1326-1328, 1244-1250)
 *
 * The four call sites are settings.js:6851, :8251, :8424 and :8443, each of them
 *
 *     contentArea.innerHTML = '<div class="flex flex-col items-center justify-center
 *                              h-full text-center p-8"> ... </div>'
 *
 * and each of them beaten by a shell rule it cannot see. Read the three rules and
 * the mechanism is one sentence three times over - a screen sheet reaching an
 * element it did not author, with !important:
 *
 *     slate-shell.css:1244-1250  #subpage-host #settings-content-area > *
 *                                { padding-left: 0 !important; padding-right: 0 !important }
 *     slate-shell.css:1304-1306  #subpage-host #settings-content-area .flex.flex-col.items-center
 *                                { align-items: stretch !important }
 *     slate-shell.css:1326-1328  #subpage-host #settings-content-area
 *                                [class*="text-center"]:not(input):not(...)
 *                                { text-align: left !important }
 *
 * There is a FOURTH mechanism the bug's citation does not name, inside the boxed
 * variant this component also carries: slate-components.css:109-118 sets
 * `.slate-caption { text-align: left !important }`, so the supporting prose of the
 * one empty state in the provenance corpus is left-aligned inside a centred card by
 * the LIBRARY, not by the shell. Both halves are the same failure - alignment
 * decided by whoever wrote the last selector.
 *
 * THE FOURTH MECHANISM IS ONLY DEAD FOR PROSE THIS COMPONENT RENDERS, and the
 * distinction is not a quibble: slotted prose lives in the LIGHT tree, where
 * `ui-empty-state p { text-align: left }` reaches it directly, and a shadow
 * `::slotted()` rule cannot defend it (an outer tree's NORMAL declaration already
 * outranks ::slotted, and §2.1 Rule 3 forbids the !important that would win).
 * MEASURED: with that one line in the document the shadow `#body` still computes
 * `center` and a slotted <p> computes `left`. So the prose has TWO ways in and only
 * one of them is immune - see THE PROSE, TWO WAYS below.
 *
 * WHY A COMPONENT ENDS IT, and why the ending is structural rather than careful.
 * SCOPE.md:2295 (Part 5 §4) records T11 as one of the defects that "dies with Shadow
 * DOM". Nothing outside a shadow root can name `.empty` inside it, so no screen
 * sheet can retarget the alignment - and `text-align` is the one property in the
 * three rules that INHERITS, so a consumer writing
 * `ui-empty-state { text-align: left }` from outside would still reach in. That is
 * why `.empty` DECLARES `text-align: center` rather than relying on a default: a
 * declaration on the element beats an inherited value, always, and no !important is
 * needed anywhere (CONVENTIONS §6). Asserted three ways in
 * test/render/ui-empty-state.render.test.mjs, including a mount that injects all
 * three shell rules verbatim into the document.
 *
 * ---------------------------------------------------------------------------
 * MEASURED STARTING VALUES - every one an oracle answer, quoted verbatim
 * ---------------------------------------------------------------------------
 * prov_query.py against slate-audit-2026-08-16/prov-baseline (dark) and prov-light.
 * The corpus holds exactly ONE empty state - `find --cls slate-emptystate-icon` ->
 * 1 element in 1 state, settings-help-talk-to-decent - so that state is the whole
 * measured surface and the other four call sites (which only render when a category
 * has no children) are outside the 49 states. Where the corpus is silent the Slate
 * source is read read-only, which is still ladder step 3.
 *
 * THE BOXED WELL (the dashed card):
 *   CITE settings-help-talk-to-decent .flex [i=42] background-color: dark
 *        rgb(26, 33, 39) / light rgb(248, 249, 249)  <-  slate-shell.css
 *        `#subpage-host #settings-content-area [class*="bg-[var(--box-color)]"],
 *        #subpage-host #settings-content-area [class*="bg-[var(--box-color-alt)]"]`
 *        authored `var(--slate-key)`  !important=yes        [= --ui-key, both themes]
 *   CITE settings-help-talk-to-decent .flex [i=42] border-top-color: dark
 *        rgb(58, 72, 82) / light rgb(203, 208, 211)  <-  slate-shell.css
 *        (same selector)  authored `(NOT CAPTURED - set via a CSS shorthand)`
 *        !important=yes                                    [= --ui-line, both themes]
 *   CITE settings-help-talk-to-decent .flex [i=42] border-top-width = 2px
 *        (themes identical)                                [= --ui-border-w-strong]
 *   CITE settings-help-talk-to-decent .flex [i=42] gap = 18px  <-  slate-shell.css
 *        `#subpage-host #settings-content-area :is([class*="gap-[30px]"],
 *        [class*="gap-[24px]"])`  authored `18px`  !important=yes  (FROZEN/hardcoded)
 *                                                          [= --ui-space-4 exactly]
 *   CITE settings-help-talk-to-decent .flex [i=42] padding-left = 36px  <-  app.css
 *        `.p-\[36px\]`  authored `36px`  !important=no  (FROZEN/hardcoded)
 *   CITE settings-help-talk-to-decent .flex [i=42] box-shadow = none
 *
 * THE GLYPH DISC:
 *   CITE settings-help-talk-to-decent .slate-emptystate-icon [i=43] background-color:
 *        dark rgb(40, 49, 57) / light rgb(227, 231, 233)  <-  slate-shell.css
 *        `#subpage-host .slate-emptystate-icon`  authored `(NOT CAPTURED - set via a
 *        CSS shorthand)`  !important=no                   [= --ui-key-on, both themes]
 *   CITE settings-help-talk-to-decent .slate-emptystate-icon [i=43] color: dark
 *        rgb(148, 161, 169) / light rgb(90, 101, 108)  <-  slate-shell.css
 *        `#subpage-host .slate-emptystate-icon`  authored `var(--slate-muted)`
 *        !important=no                                    [= --ui-muted, both themes]
 *   CITE settings-help-talk-to-decent .slate-emptystate-icon [i=43] width = 64px,
 *        height = 64px, border-top-left-radius = 50%, border-top-width = 0px
 *   (`find --cls slate-emptystate-icon` -> "distinct geometries: 64 x 64  x1")
 *
 * THE HEADING:
 *   CITE settings-help-talk-to-decent .text-[24px] [i=44] font-size = 18px  <-
 *        slate-shell.css `#subpage-host #settings-content-area
 *        [class*="text-[24px]"], #subpage-host #settings-content-area
 *        [class*="text-[22px]"]`  authored `var(--slate-text-md)`  !important=yes
 *        (token-driven)                                    [= --ui-text-md]
 *   CITE settings-help-talk-to-decent .text-[24px] [i=44] font-weight = 500  <-
 *        slate-shell.css `#subpage-host #settings-content-area [class*="font-bold"],
 *        #subpage-host #settings-content-area [class*="font-semibold"]`  authored
 *        `500`  !important=yes  (FROZEN/hardcoded)         [= --ui-weight-medium]
 *   CITE settings-help-talk-to-decent .text-[24px] [i=44] color: dark
 *        rgb(244, 247, 248) / light rgb(23, 26, 28)  <-  app.css
 *        `.text-\[var\(--text-primary\)\]`  authored `var(--text-primary)`
 *        !important=no                                     [= --ui-text, both themes]
 *   (The markup authors `text-[24px] font-bold` and renders 18px/500. The RENDERED
 *    value is the oracle's answer and it is what this component uses; the authored
 *    one is exactly the "declared size is never the used size" pattern the audit
 *    keeps finding, and is not on the §7 bug list, so no disqualification applies.)
 *
 * THE SUPPORTING PROSE:
 *   CITE settings-help-talk-to-decent .slate-caption [i=45] font-size = 16px
 *        (themes identical)                                [= --ui-text-note]
 *   CITE settings-help-talk-to-decent .slate-caption [i=45] color: dark
 *        rgb(148, 161, 169) / light rgb(90, 101, 108)  <-  slate-components.css
 *        `.slate-caption`  authored `var(--slate-muted)`  !important=yes
 *        (token-driven)                                    [= --ui-muted, both themes]
 *   Source read (max-width, line-height and margin are outside the 18-property
 *        surface): slate-components.css:105-118 `.slate-caption { margin: 0;
 *        max-width: 70ch; line-height: 1.5 !important; text-align: left !important }`
 *        - the measure is kept as --ui-measure, the line-height is kept, the
 *        `margin: 0` is kept and carried onto SLOTTED prose as well (a <p> arrives
 *        with a 16px UA margin, measured, which turned the 8px heading-to-prose gap
 *        into 24px), and the text-align is the fourth T11 mechanism above and is
 *        DROPPED.
 *
 * ---------------------------------------------------------------------------
 * THE PROSE, TWO WAYS - and only one of them is out of reach
 * ---------------------------------------------------------------------------
 * `body="..."` is a STRING PROPERTY, rendered as a <p> inside the shadow root
 * exactly the way `heading` is. Nothing outside can name it, so T11's fourth
 * mechanism cannot touch it. That is the way to pass a sentence, and it is what
 * every one of Slate's four call sites actually passes.
 *
 * The DEFAULT SLOT still takes prose, because a sentence with a link in it is real
 * and a string cannot carry one. Slotted nodes are the consumer's own elements in
 * the consumer's own tree: they get the caption treatment by inheritance and their
 * UA margin removed by `::slotted()`, but their ALIGNMENT is reachable by any sheet
 * that can name them, and no rule in here can outrank an outer normal declaration.
 * Stated, not papered over - the same shape as ui-alert-banner's known limit.
 *
 * Both may be set; both render, property first. Two ways in with one rendering each
 * is predictable; silently suppressing one would be the invisible failure.
 *
 * ---------------------------------------------------------------------------
 * DELIBERATE DEPARTURES, all recorded in the wave-1 ledger
 * (_skinlab/realine-run/EXPECTED_CHANGES.jsonl, region `ui-empty-state`; source
 * _skinlab/realine-run/waves/1/ledger-src/) - a checkable ledger on disk, not a
 * "manifest" no file corresponds to
 * ---------------------------------------------------------------------------
 *  1. T11 - CENTRED, AND UNREACHABLE FROM OUTSIDE. bug-not-reproduced.
 *  2. INSET 36px -> 40px (--ui-space-7). spec §3.3, verbatim: "Propose: the seven
 *     steps are the whole vocabulary; off-scale values snap to the nearest step.
 *     30 -> 28, 32 -> 28, 26 -> 24, 20 -> 18, 16 -> 18, 14 -> 12, 9 -> 8, 6 -> 8,
 *     10 -> 8, 36 -> 40, 48 -> 40." The plain shape's Slate inset is p-8 = 32px,
 *     and the same table snaps 32 -> 28 (--ui-space-6). +4px and -4px, once each.
 *  3. RADIUS 20px -> --ui-radius-lg (8px). spec §3.4 enumerates the whole radius
 *     vocabulary as 4 / 6 / 8 / 12 / 9999 and drops `rounded-[20px]` explicitly.
 *     `lg` rather than `xl` because styles/tokens.css:292 defines lg as "wells,
 *     panels, chart cards" and xl as "a floating SURFACE: modal, sheet, menu" - an
 *     empty state is a well, not a floating surface. Recorded as reversible.
 *  4. THE GLYPH IS 28px (--ui-icon-lg), not Slate's inline 32. spec §3.1 tokenises
 *     icon geometry as 24 / 28 and 32 is not a step; the 64px disc is unchanged.
 *  5. NO PAINTED DISC WITHOUT A GLYPH. Slate needs a whole shell rule for this -
 *     slate-shell.css:1605-1612, "P21 - the empty-state icon on Talk to Decent was
 *     a featureless grey rounded square: the signature of a CSS mask URL that failed
 *     to resolve, leaving the background painted ... Suppress the painted background
 *     so a missing glyph is absent rather than a grey block pretending to be art."
 *     Here the disc is not rendered at all when its slot is empty, so the grey block
 *     cannot exist and the !important that suppresses it is not needed.
 *  6. THE PROSE CAN ARRIVE AS A PROPERTY, which Slate has no equivalent of - its
 *     four call sites write the sentence into an innerHTML string. Additive: the
 *     slot is unchanged, and the reversal is deleting the property and its one <p>.
 *     It exists because it is the only construction that puts the supporting prose
 *     out of a screen sheet's reach; see THE PROSE, TWO WAYS.
 *  7. SLOTTED PROSE LOSES ITS UA MARGIN (`::slotted(*) { margin-block: 0 }`), which
 *     is slate-components.css:108's own `.slate-caption { margin: 0 }` applied where
 *     Slate could not reach - measured 16px, i.e. the oracle's 8px inner gap
 *     rendering as 24px for the markup a real caller writes.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY NOT HERE
 * ---------------------------------------------------------------------------
 *   - NO align="start" ESCAPE HATCH. The row's brief is that a component makes
 *     left-alignment impossible; an opt-out is additive later and un-shippable to
 *     remove once consumed, so the reversible choice is to leave it out.
 *   - NO role="status" / aria-live. The search-result call site ("No settings match
 *     your search", settings.js:8443) is the canonical live-region case, but a
 *     live region on every empty state announces on every navigation. Additive
 *     later; recorded as an open question rather than guessed at now
 *     (realine-run/waves/1/ledger-src/02-builders-deferred-questions.json).
 *   - NO HEADING LEVEL. Slate authors the line as a <p> (settings.js:2057) and the
 *     right level depends on the pane around it, which a primitive cannot know.
 *   - NO SELECTION, NO FOCUS OF ITS OWN, NO HIT AREA. Nothing here is interactive:
 *     an action belongs in the `actions` slot as a real control (#1 ui-button), and
 *     the hit floor is that control's business (CONVENTIONS §5 lists the three
 *     consumers and this is not one of them).
 *   - NO DATA. Wave law: a primitive that "needs" server data is a design error to
 *     flag, not satisfy. The strings arrive from the screen.
 *
 * API
 *   <ui-empty-state heading="No settings match your search"
 *       body="Try a shorter search, or clear it to see every category."
 *   ></ui-empty-state>
 *   <ui-empty-state boxed heading="No Decent account linked">
 *       <svg slot="icon">...</svg>
 *       Messages to support are sent from your <a href="...">Decent account</a>.
 *       <ui-button slot="actions">Clear search</ui-button>
 *   </ui-empty-state>
 *   ui-empty-state { block-size: 100% }        fill a pane; the block centres in it
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';

/** An assigned node that is actually content - elements, or text that is not just
 *  the whitespace between tags. Without the trim, every
 *  `<ui-empty-state>\n</ui-empty-state>` in real markup reports a body. */
const isContent = (node) => node.nodeType === 1 || (node.textContent ?? '').trim() !== '';

export class UiEmptyState extends UiElement {
    static properties = {
        /** The one line that says what is missing. Rendered as a <p>; see the header. */
        heading: { type: String },
        /**
         * The supporting sentence, as a STRING - rendered inside the root the way
         * `heading` is, and therefore out of reach of any screen sheet. The default
         * slot still takes rich prose; see THE PROSE, TWO WAYS in the header for
         * which one a caller wants and what the slot cannot defend.
         */
        body: { type: String },
        /** The dashed well (Slate's Talk-to-Decent card). Default is the plain block. */
        boxed: { type: Boolean, reflect: true },

        /* Slot occupancy. A slot cannot be queried from CSS - `:has()` sees a slot's
         * CHILDREN (its fallback content), never its assigned nodes - so the three
         * parts report themselves through slotchange and the grid drops the ones that
         * would otherwise contribute a gap row of nothing. */
        _hasIcon: { state: true },
        _hasBody: { state: true },
        _hasActions: { state: true },
    };

    static styles = [css`
        /* THE INSET, in one private slot the two shapes retarget.
         * Plain: Slate's p-8 = 32px, spec §3.3 "32 -> 28".
         * Boxed: Slate's p-[36px] (ORACLE padding-left = 36px, app.css .p-[36px]),
         * spec §3.3 "36 -> 40". */
        :host {
            --_ui-empty-pad: var(--ui-space-6);
        }

        :host([boxed]) {
            --_ui-empty-pad: var(--ui-space-7);
        }

        /* THE BLOCK. Centred by construction and on a CLASS, inside the root, where
         * no screen sheet can name it (CONVENTIONS §4 rule 2, §6).
         *
         * text-align is DECLARED, not left to inherit, and that is the whole of T11:
         * a declaration on the element beats any inherited value, so a consumer
         * writing text-align on the host - which is what
         * slate-shell.css:1326-1328 does to Slate's four call sites - changes the
         * host and cannot change this. The cross-axis half needs one more line;
         * see the justify-self note below, which is where the modern spelling of
         * slate-shell.css:1304-1306 gets in.
         *
         * min-block-size: 100% is Slate's h-full, expressed so it costs nothing when
         * the host is content-sized: with no height on the host the block is its
         * content, and a screen that writes block-size: 100% on the host
         * gets a block that fills the pane and centres in it. NOT block-size, which
         * would clip content taller than the pane - the silent-clipping habit
         * spec §2.4 exists to end. */
        .empty {
            display: grid;

            /* T11'S MODERN FORM, and the one reach-in the shadow boundary does NOT
             * stop by itself. CSS Box Alignment now applies in block layout, so
             * justify-items on the HOST reaches this box - it is the host's only
             * child box - and a screen writing the 2026 spelling of
             * slate-shell.css:1304-1306 shrink-wraps the block and pushes it to the
             * inline start. MEASURED at both Gate A geometries before this line
             * existed: 1281 -> 499px wide, 391px off centre. Declaring the pair
             * restores the block default and puts it out of reach, the same way
             * text-align is declared rather than inherited below. */
            justify-self: stretch;
            align-self: stretch;

            /* AND THE SAME REACH-IN THROUGH A DIFFERENT LAYOUT MODE, which the two
             * lines above do NOT cover: justify-self is IGNORED on a flex item.
             * Slate's four call sites are themselves flex columns
             * (slate-shell.css:1304-1306 targets .flex.flex-col.items-center), so
             * ui-empty-state { display: flex; justify-content: flex-start } is the
             * modern spelling a screen sheet is most likely to write - and an outer
             * normal declaration beats the base's :host { display: block } whatever
             * its specificity, because outer trees win. MEASURED with only
             * justify-self in force, at BENCH: host 1281 -> block 124.94px wide,
             * heading 578px off centre. A percentage inline size resolves against the
             * flex container's content box, so the block fills the host again and
             * justify-content has nothing left to move: same mount, same rule, block
             * 1281px, heading 0.008px off centre, document overflow 0. Costs nothing
             * in block layout - 100% and auto compute the same box there, and
             * box-sizing is border-box (base.js), so the padding stays inside.
             *
             * THE ONE CASE NOTHING IN HERE CAN REACH, stated rather than implied: a
             * host that is a CONTENT-SIZED grid or flex container - e.g.
             * ui-empty-state { display: grid; justify-content: start } - sizes its
             * track to the item, and a percentage against that track is circular, so
             * the block still shrink-wraps (measured with this line in force: 161.25px
             * in a 1281px host). That is the HOST's own box, and the host belongs to
             * the consumer: spec §2.1 Rule 1, a component reads its own container.
             * Only a screen writing that rule can undo it, and it undoes its own pane
             * with the same stroke. */
            inline-size: 100%;

            justify-items: center;
            align-content: center;
            gap: var(--ui-space-4);
            padding: var(--_ui-empty-pad);
            min-block-size: 100%;
            text-align: center;
        }

        /* THE WELL. ORACLE: --ui-key ground, --ui-line edge, 2px
         * (--ui-border-w-strong), both themes matching to the byte. The dashed
         * border-style is outside the corpus's 18-property surface, so it is a
         * read-only source read: settings.js:2049 authors border-2 border-dashed.
         * (No backticks in a css template, CONVENTIONS §9 - this file paid the
         * two-syntax-error toll that rule was written from.) */
        :host([boxed]) .empty {
            border: var(--ui-border-w-strong) dashed var(--ui-line);
            border-radius: var(--ui-radius-lg);
            background-color: var(--ui-key);
        }

        /* THE GLYPH DISC. ORACLE 64 x 64, radius 50%, --ui-key-on ground,
         * --ui-muted ink. 64px is the control spine (--ui-control-h) rather than a
         * literal, so the disc tracks the skin's one geometry token instead of
         * becoming one more number that nothing connects to anything. */
        .icon {
            display: grid;
            place-items: center;
            inline-size: var(--ui-control-h);
            block-size: var(--ui-control-h);
            border-radius: var(--ui-radius-pill);
            background-color: var(--ui-key-on);
            color: var(--ui-muted);
        }

        /* Slate's glyph is an inline 32px svg; spec §3.1 tokenises icons at 24 / 28. */
        slot[name="icon"]::slotted(*) {
            inline-size: var(--ui-icon-lg);
            block-size: var(--ui-icon-lg);
        }

        /* The heading/prose pair. ORACLE gap = 8px is Slate's inner
         * flex-col gap-[8px] (settings.js:2056), which is --ui-space-2 exactly;
         * the 18px outer gap is the oracle's own measured value. */
        .text {
            display: grid;
            gap: var(--ui-space-2);
            justify-items: center;
            max-inline-size: var(--ui-measure);
        }

        /* ORACLE 18px / 500 / --ui-text. */
        .heading {
            margin: 0;
            color: var(--ui-text);
            font-size: var(--ui-text-md);
            font-weight: var(--ui-weight-medium);
            line-height: 1.2;
        }

        /* ORACLE 16px / --ui-muted, with slate-components.css:109-118's measure and
         * line-height kept and its text-align: left dropped (T11's fourth
         * mechanism). Inherited properties cross into slotted prose, so a plain
         * <p> in the slot lands on this treatment without the caller naming it. */
        .body {
            color: var(--ui-muted);
            font-size: var(--ui-text-note);
            font-weight: var(--ui-weight-regular);
            line-height: 1.5;
        }

        /* The body PROPERTY's prose, rendered inside the root beside the slot and
         * therefore unreachable from any screen sheet - the only construction that
         * makes T11's fourth mechanism impossible rather than merely dropped. See
         * THE PROSE, TWO WAYS in the header. margin: 0 for the same reason
         * slate-components.css:108 writes it on .slate-caption: a <p>'s UA margin
         * would add 16px to the 8px the .text grid already spends. */
        .prose {
            margin: 0;
        }

        /* SLOTTED prose keeps the UA margin unless something says otherwise, and the
         * gap here is the oracle's: 8px (--ui-space-2) between heading and prose,
         * 18px (--ui-space-4) outside. MEASURED on a slotted <p>: margin-block 16px,
         * i.e. the asserted 8px gap rendered as 24px for the one markup shape a real
         * caller writes. slate-components.css:108 .slate-caption { margin: 0 }
         * carries this for Slate and is kept here rather than dropped with the
         * text-align beside it. ::slotted() beats the UA origin - author always does
         * - which is why this one works where the alignment defence cannot. */
        slot:not([name])::slotted(*) {
            margin-block: 0;
        }

        /* The action row. Wraps rather than overflows: a component reads its own
         * container (spec §2.1 Rule 1), and two buttons do not fit a narrow pane. */
        .actions {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: var(--ui-space-3);
        }

        /* An absent part is not rendered at all - it does not contribute a gap row,
         * and the disc cannot become P21's grey block pretending to be art. */
        .is-empty {
            display: none;
        }
    `];

    constructor() {
        super();
        this.heading = '';
        this.body = '';
        this.boxed = false;
        this._hasIcon = false;
        this._hasBody = false;
        this._hasActions = false;
    }

    /** One handler for three slots; the slot's own name picks the flag. */
    #onSlotChange(event) {
        const slot = event.target;
        const filled = slot.assignedNodes({ flatten: true }).some(isContent);
        if (slot.name === 'icon') this._hasIcon = filled;
        else if (slot.name === 'actions') this._hasActions = filled;
        else this._hasBody = filled;
    }

    render() {
        // An empty part is dropped rather than hidden-but-present, because a
        // zero-height grid item still contributes its share of the gap: an absent
        // text pair would put 36px between the disc and the actions instead of 18.
        const hasProse = Boolean(this.body) || this._hasBody;
        const hasText = Boolean(this.heading) || hasProse;
        return html`<div id="empty" class="empty">
            <div
                id="icon"
                class="icon ${this._hasIcon ? '' : 'is-empty'}"
                aria-hidden="true"
            ><slot name="icon" @slotchange=${this.#onSlotChange}></slot></div>

            <div id="text" class="text ${hasText ? '' : 'is-empty'}">
                ${this.heading
                    ? html`<p id="heading" class="heading">${this.heading}</p>`
                    : nothing}
                <div
                    id="body"
                    class="body ${hasProse ? '' : 'is-empty'}"
                >${this.body
                    ? html`<p id="prose" class="prose">${this.body}</p>`
                    : nothing}<slot @slotchange=${this.#onSlotChange}></slot></div>
            </div>

            <div
                id="actions"
                class="actions ${this._hasActions ? '' : 'is-empty'}"
            ><slot name="actions" @slotchange=${this.#onSlotChange}></slot></div>
        </div>`;
    }
}

customElements.define('ui-empty-state', UiEmptyState);
