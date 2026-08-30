/**
 * ui-definition-card.js - component #50 of the 57-component inventory:
 * THE LABEL/VALUE INFO CARD.
 *
 * Wave 4, item #50 (SCOPE Part 4, "Wave 4 - dialog bodies and screen compounds",
 * SCOPE.md:1642):
 *   "| 50 | Definition card | Label/value info card (machine-info leaf). | small | #8 |"
 * spec §5.2 row 50 (LAYOUT_SPEC_DRAFT.md:921): "| 50 | Definition card |
 * `machine-machine-info` leaf | |".  spec §4.4 (:736) lists it among the settings
 * screen's components, and :739 counts machine-info as one of the nine leaves that
 * "need their own layout, not seven"; `layout/settings.md`:888 states the same row as
 * a requirement of the rewrite - "Seven leaves need their own layout: machine-info
 * (definition card) ...".
 *
 * It is a COMPOUND of #8 (`ui-card.js`), not a second surface: the card paints, the
 * card owns the inset, the card owns bounded scroll, and this file adds the one thing
 * #8 deliberately refused - "NO HEADER/FOOTER SLOTS. 'Plain surface' is the whole
 * brief; the label/value layout is #50" (ui-card.js header).
 *
 * DISQUALIFICATION CHECK, RUN FIRST AND MECHANICALLY (SCOPE Part 10 §4; the banner
 * prov_query.py --help prints).
 *   (a) DECISIONS.md + the 45-item register: grepped for "definition" / "machine
 *       info" / "machine-info" - no decision reaches this element, so nothing
 *       overrides the oracle here.  The wave-wide component law does reach it and is
 *       obeyed below (Lit + Shadow DOM, custom-properties theming, container-driven,
 *       zero !important, no colour literal, no @font-face, no private selection look).
 *   (b) RESPONSIVE BEHAVIOUR: the oracle NEVER has a vote.  Slate's machine-info card
 *       is 1200x492 because a 1920x1200 canvas gave it that; LAYOUT_SPEC_DRAFT.md
 *       §2.1 Rule 1 governs, and every rule in this file reads its own container.
 *   (c) THE 140 LAYOUT BUGS (spec §7) and the 31 contract bugs: §7.5 Settings (21
 *       entries, spec:1173-1198) was read row by row.  None of T1-T22 names the
 *       machine-info leaf or its card.  The two that come closest belong to other
 *       elements: T13 is "one leaf's header sits 12px lower than the other 36"
 *       (`settings.js:2390-2396`, the FEEDBACK leaf's title wrapper - it is #29's
 *       defect, and #29 is a different row), and T20 is the fourteen `gap-[Npx]`
 *       literals in the leaf ROOTS, not in this card.  The oracle is therefore
 *       cleared for every appearance value quoted below.  Row #50 in
 *       `waves/4/ITEMS.json` carries `"bugs": []` and `"decisions": []`, and that is
 *       a checked fact rather than an omission.
 *
 * MEASURED STARTING VALUES - every one an oracle answer, quoted verbatim.
 * (realine-run/tools/prov_query.py against prov-baseline (dark) and prov-light; the
 * leaf is state `settings-machine-machine-info`, 71 element records.)
 *
 *   THE SURFACE is #8's, already measured and cited in ui-card.js from this very
 *   element:
 *     CITE settings-machine-machine-info .slate-card [i=47] background-color =
 *          rgb(26, 33, 39)  <-  slate-components.css  `.slate-card`  authored
 *          `var(--slate-key)`  !important=yes  (token-driven)   = --ui-key
 *     CITE settings-machine-machine-info .slate-card [i=47] rect x=629 y=273
 *          w=1200 h=492, padding-left = 24px  <-  app.css  `.p-6`  authored `1.5rem`
 *          (FROZEN/hardcoded)   = --ui-space-5, which is ui-card's default inset
 *     the markup is `<div class="slate-card w-full p-6 flex flex-col gap-0">` - one
 *     column, gap 0, seven children.
 *
 *   THE TERM (the left-hand label), .slate-heading:
 *     CITE settings-machine-machine-info .slate-heading [i=50] font-size = 20px  <-
 *          slate-components.css  `.slate-heading`  authored `var(--slate-text-lg)`
 *          !important=yes  (token-driven)                            = --ui-text-lg
 *     CITE settings-machine-machine-info .slate-heading [i=50] font-weight = 500  <-
 *          slate-components.css  `.slate-heading`  authored
 *          `var(--slate-weight-medium)`  !important=yes  (token-driven)
 *     CITE settings-machine-machine-info .slate-heading [i=50] color: dark
 *          rgb(244, 247, 248) / light rgb(23, 26, 28)  <-  slate-components.css
 *          `.slate-heading`  authored `var(--slate-text)`  !important=yes
 *          (token-driven)                                              = --ui-text
 *     20px / 500 / --ui-text IS `.ui-heading` to the byte (TYPE_ROLES.md, "The six"),
 *     so the term takes the role and this file declares no type of its own.
 *
 *   THE VALUE (the right-hand reading), .slate-body.slate-text.slate-numeric:
 *     CITE settings-machine-machine-info .slate-body [i=51] font-size = 17px,
 *          font-weight = 400, letter-spacing = normal, text-transform = none
 *          [17 of 18 properties identical across themes]        = --ui-text-base
 *     CITE settings-machine-machine-info .slate-body [i=51] color: dark
 *          rgb(244, 247, 248) / light rgb(23, 26, 28)  <-  slate-components.css
 *          `.slate-text`  authored `var(--slate-text)`  !important=yes (token-driven)
 *     17px / 400 / inherited ink IS `.ui-body`; `.slate-text` is an ink switch and
 *     TYPE_ROLES.md already records that it is not carried, because --ui-text arrives
 *     by inheritance from styles/document.css.  `.slate-numeric` carries over as
 *     `.ui-numeric` - a modifier, not a step - and Slate puts it on EVERY value in
 *     this card, "Bengle" and "Enabled" included, so this file does too.
 *
 *   THE DIVIDER, and it is the reason this component exists in the shape it does:
 *     CITE settings-machine-machine-info .flex [i=52] border-top-color: dark
 *          rgb(58, 72, 82) / light rgb(203, 208, 211)  <-  slate-components.css
 *          `.slate-hairline`  authored `(NOT CAPTURED - set via a CSS shorthand)`
 *          !important=yes  (token-driven)                              = --ui-line
 *     CITE settings-machine-machine-info .flex [i=52] border-top-width = 1px  <-
 *          app.css  `.border-t`  authored `1px`  !important=no  (FROZEN/hardcoded)
 *          - the ink is a token and the WIDTH is a Tailwind literal, which is why
 *          --ui-hairline exists (spec §3.1, "so it can go to 0.5px/dpr").
 *     CITE find --cls slate-hairline -> "found 8 element(s) in 2 state(s)", of which
 *          5 are in this leaf: [654,425,1150,63] [654,488,1150,63] [654,551,1150,63]
 *          [654,614,1150,63] [654,677,1150,63] - a constant 63px pitch, all
 *          `<div class="flex items-center justify-between py-[18px] border-t
 *          slate-hairline">`.
 *
 *   THE HEADER ROW - a heading plus one trailing action:
 *     CITE settings-machine-machine-info .slate-heading [i=48] text "Machine"
 *          rect x=654 y=317 w=80 h=26
 *     CITE settings-machine-machine-info .slate-btn [i=49] text "Copy all"
 *          rect x=1690 y=298 w=114 h=64 - height 64 = --ui-control-h, and it is what
 *          makes the header row 64px: the card's content box starts at y=298
 *          (273 + 1 border + 24 inset) and the first data row starts at 362.
 *
 * THE ROW PITCH IS AN EXACT CARRY, and it falls out rather than being pinned.
 * 63px measured = 1px border + 18 + 26 + 18.  Here: `.ui-heading` is 20px at
 * line-height 1.3 = 26px (TYPE_ROLES.md), `padding-block: var(--ui-space-4)` is
 * 18px (styles/tokens.css:268, and 18 is Slate's own py-[18px] with no snapping
 * needed), so a data row's content box is 62px and one --ui-seam of grid gap makes
 * the pitch 63.  Asserted at both geometries in
 * test/render/ui-definition-card.render.test.mjs.
 *
 * FIVE DELIBERATE DEPARTURES.
 *
 *   1. THE DIVIDER IS A GAP, NOT A BORDER - CONVENTIONS §13, which names this exact
 *      element.  Its table counts Slate's 55 hairline uses as three shapes and puts
 *      this card's rows in the row that says YES: "5 | <div class='flex items-center
 *      justify-between py-[18px] border-t slate-hairline'> ... Yes - a content row
 *      drawing the divider above it; a row gap draws it for free".  So the rows sit
 *      in a `.seam-grid.seam-rows.seam-line` and each paints itself; N rows give N-1
 *      seams with no sibling selector to get wrong.  T2's mechanism - "the `> * + *`
 *      half of the rule can never match ... the sub-nav has no row separators at all"
 *      - becomes inexpressible here, and that is asserted, not asserted-about.
 *
 *   2. AND THEREFORE THE HEADER GETS ITS SEAM, WHICH SLATE DOES NOT DRAW.  Measured:
 *      the card has SEVEN rows and FIVE hairlines.  The header row (y 298-362) and
 *      the first data row (y 362-425) carry no `border-t`, so Slate draws a divider
 *      between every adjacent pair except the first two.  A grid gap cannot express
 *      "every pair but one" without re-inventing the per-row class that made T2
 *      possible, and the missing line is not a design statement anywhere in the spec
 *      or the register - it is the shape of a class that did not get added.  This
 *      component draws 6 seams for 7 rows.  Recorded as an expected change with its
 *      measured numbers rather than silently matched or silently dropped.
 *
 *   3. THE HEADER ROW HAS A FLOOR, NOT A PADDING.  Slate's header is 64px because a
 *      64px button happens to sit in it; take the button away and the row collapses
 *      to the heading.  Here it is `min-block-size: var(--ui-control-h)`, so a card
 *      with a heading and no action reads at the same rhythm as one with both.  The
 *      data rows keep the measured padding instead, because nothing in them has a
 *      control's height.
 *
 *   4. RESPONSIVE BEHAVIOUR IS THE SPEC'S (§2.1 Rule 1, §2.4).  A term and a value
 *      that cannot share a line WRAP - the value keeps its end alignment on its own
 *      line - and long unbroken text breaks rather than spilling.  Slate never meets
 *      this: its 1200px column is frozen, its row states no overflow at all, and
 *      "hiding the scrollbar is banned" is the general rule the wrap serves here.
 *      No `@media`, no viewport read, nothing keyed to anything but this component's
 *      own container.
 *
 *   5. ABSENCE IS A VALUE, AND IT RENDERS AS THE DASH.  A7 (`src/data/reading.js`:12,
 *      quoted): "A missing channel renders as a gap or a dash, never as a
 *      locally-recomputed ratio ... or a zero that reads as a measurement."  So
 *      `null`, `undefined`, `''` and a NO_READING object all render the em dash with
 *      the sentence beside it for a screen reader, and `0` renders as `0` because a
 *      zero IS a reading.  There is no `?? compute...` anywhere in this file and
 *      there may never be one.
 *
 * GATE 2, STATED PLAINLY.  This component NAMES NO SERVER KEY and reads no frame.
 * Its rows arrive as data - `[{ term, value }]` - exactly as SCOPE Part 4 says of
 * this whole wave ("the components above take channels as data"), and the wave-5
 * screen is what reads `src/stores/` and hands the list over.  The one thing it does
 * import from the data layer is `isNoReading`, the address layer's own absence
 * predicate (`src/data/reading.js`), so that a reading handed straight through from
 * `readMachineSnapshot` renders as a dash instead of `[object Object]`.  That is the
 * address layer being CONSUMED, not bypassed; the key strings stay in
 * `src/data/rea-names.js` where they belong.  Same route ui-preset-bank.js:226 takes.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   - NO SELECTION TREATMENT, and no dials.  A definition card picks nothing.  The
 *     wave's law is that no component here may own a private "selected" look; the
 *     honest form of obeying it is to own no state look at all, and the suite asserts
 *     the absence rather than trusting it.
 *   - NO PER-ROW CONTROL SLOT.  A label with a control on the right is #29 Settings
 *     row, which 19 of the 37 leaves compose as built (23 rows over 19 leaves, 18 of
 *     them primitive — measured wave 5.4; §4.4 PROJECTS ~30 and this line used to
 *     assert the projection in its own voice).  This is the leaf where the right-hand
 *     side is a READING.  One action lives in the header, where Slate puts "Copy
 *     all", and it arrives through a slot rather than being built here.
 *   - NO COPY-TO-CLIPBOARD.  Slate's `Copy all` is a screen behaviour over data this
 *     component does not own.  It slots in.
 *   - NO SECOND SURFACE.  Paint, radius, border, inset, bounded scroll and the
 *     max-block-size cap are all #8's, forwarded.  Duplicating any of them here would
 *     be the fork ui-card's header documents (six token-driven borders against
 *     fourteen frozen ones) re-created inside the library.
 *
 * API
 *   <ui-definition-card heading="Machine" items="[...]"></ui-definition-card>
 *   items='[{"term":"Model","value":"Bengle"}]'   the rows, in order
 *   heading="Machine"                             optional card title
 *   level="2"                                     1..6, the title's heading level
 *   label="Machine information"                   group name; defaults to `heading`
 *   pad="tight" | "none" | "regular"              forwarded to #8's inset
 *   <ui-definition-card scroll>                   forwarded to #8's bounded scroll
 *   dash="-"                                      the absent mark, if not the em dash
 *   <ui-button slot="actions">Copy all</ui-button> the header's trailing cluster
 *   ui-definition-card { max-block-size: 275px }  the cap, from outside, as #8 asks
 *
 *   THE ATTRIBUTE IS `scroll`, THE PROPERTY IS `scrollable`, for the reason ui-card.js
 *   sets out at length: a reactive property named `scroll` shadows
 *   Element.prototype.scroll(), and this element forwards to a scroll container, so
 *   the standard method has to keep working on it.  One spelling, both components.
 */

import { css, html, nothing } from 'lit';
import { UiElement, visuallyHidden } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import { isNoReading } from 'src/data/reading.js';
import { SHEET_HEADING_LEVELS, DEFAULT_LEVEL } from 'src/components/ui-sheet-header.js';
import { CARD_PADS } from 'src/components/ui-card.js';

/**
 * THE ONE ABSENT-VALUE MARK, U+2014 EM DASH.
 *
 * Byte-identical to `src/stores/units.js`'s `NO_READING_MARK` and to
 * ui-stat-tile.js:388, and re-declared here for the reason ui-stat-tile records:
 * `dash` is a property whose default this is, so the wave-5 screen - which already
 * imports units.js - hands the module's own constant in and there is never a second
 * constant in force at runtime.  Written as the escape so the copies diff
 * mechanically: an em dash and an en dash look alike.
 */
const NO_READING_MARK = '—';

/**
 * WHAT AN ABSENT READING IS CALLED OUT LOUD - a translation KEY, not a wording knob.
 * D11 (SCOPE.md:2220): "the shared component decides the wording - never per screen."
 * The key is its own English text (i18n/source/README.md), i18n/source/strings.json
 * carries "No reading", and lookup is case-insensitive returning the CALLER's casing -
 * so this renders lowercase in a sentence position, exactly as ui-stat-tile.js:400
 * spells it.  Two components, one wording.
 */
const ABSENT_KEY = 'no reading';

/**
 * Rows in, one shape out.  A hole, a bare string and an object all normalise; nothing
 * is ever dropped, because silently removing content is the one thing spec §2.4 bans
 * by name.  A row whose term did not arrive renders an empty term and a dash, which
 * is visible and fixable; a row that vanished would not be.
 */
export function normaliseDefinition(raw, index) {
    if (raw === null || raw === undefined) {
        return { term: '', value: undefined, index };
    }
    if (typeof raw === 'object') {
        const term = raw.term ?? raw.label ?? raw.name;
        return {
            term: term === null || term === undefined ? '' : String(term),
            value: raw.value,
            index,
        };
    }
    return { term: String(raw), value: undefined, index };
}

/**
 * ABSENCE IS NOT FALSINESS - the rule ui-stat-tile.js:748 states and reading.js:12
 * requires.  `0`, `'0'` and `'0.0'` are readings; `null`, `undefined`, `''` and any
 * NO_READING are not.  `false` is neither: it is a caller bug, and rendering it
 * loudly beats hiding it.
 */
export function isAbsentDefinition(value) {
    return value === null || value === undefined || value === '' || isNoReading(value);
}

export class UiDefinitionCard extends UiElement {
    static properties = {
        /** The rows, in order. NOT a data source: a store owns the list (Gate 2). */
        items: { type: Array },

        /** Optional card title. No heading, no heading element - #16's own rule. */
        heading: { type: String },

        /** 1..6. The list is imported from #16, never restated. */
        level: { type: Number, reflect: true },

        /** Accessible name for the card's group. Falls back to `heading`. */
        label: { type: String },

        /** 'regular' | 'tight' | 'none'. #8's inset, forwarded. */
        pad: { type: String, reflect: true },

        /** #8's bounded scroll region. Attribute `scroll`, property `scrollable`. */
        scrollable: { type: Boolean, reflect: true, attribute: 'scroll' },

        /** The absent mark. A property so the screen can hand units.js's own in. */
        dash: { type: String },

        /** Whether anything is assigned to the actions slot. Internal. */
        _hasActions: { state: true },
    };

    static styles = [
        /* STRUCTURAL FRAGMENTS FIRST (CONVENTIONS §4, §5a, §13): `seams` draws the
         * dividers, `typeRoles` is a default layer written to lose a tie, and
         * `visuallyHidden` is the one screen-reader-only treatment. There is no
         * `selectionSurface` at the end and that absence is deliberate - see the
         * header. */
        seams,
        typeRoles,
        visuallyHidden,
        css`
        /* THE HOST IS A ONE-ROW GRID, for exactly the reason ui-card's is: a screen
         * writes ui-definition-card { max-block-size: 275px } from outside, the row
         * track resolves to the capped height, and minmax(0, 1fr) lets the card
         * shrink below its content so the overflow becomes #8's scrollbar instead of
         * spilling. With no cap the track is content-sized and nothing changes.
         * container-type stays as the base set it (CONVENTIONS §2): this fills a
         * slot. No rule in this file is size-keyed and none may be - a component
         * reads its own container, never the viewport (spec §2.1 Rule 1). */
        :host {
            display: grid;
            grid-template-rows: minmax(0, 1fr);
        }

        /* THE CARD FILLS THE HOST. #8 is a grid too, so this is one declaration. */
        .surface {
            min-inline-size: 0;
        }

        /* THE SEAMED COLUMN. .seam-grid.seam-rows.seam-line comes from the seams
         * fragment: row gap only, --ui-seam wide, over --ui-line - which is the ink
         * the oracle measures on .slate-hairline in both themes. The grid is the
         * divider; there is no border anywhere in this file. */
        .stack {
            grid-template-columns: minmax(0, 1fr);
            align-content: start;
        }

        /* A NESTED SEAM GRID IS A CELL, and it names its own weight (CONVENTIONS §13
         * trap 3): a weight class is (0,2,0) and .seam-cell is (0,1,0), so the list
         * wins whatever the source order. The <dl> has to be its own grid because
         * HTML will not let a heading row live inside a description list - the
         * content model is groups of dt/dd, or divs wrapping them. Two grids, one
         * ink, one gap width: the seam between the header and the first row is drawn
         * by the outer grid and is indistinguishable from the ones inside.
         * It carries the WEIGHT and not .cell: a weight class is (0,2,0) and would
         * beat the cell ground whatever the source order, so writing both would only
         * make a reader wonder which won. The list's ground IS the divider ink, and
         * its rows paint over all of it except the gaps. */
        .list {
            grid-template-columns: minmax(0, 1fr);
            align-content: start;
            margin: 0;
        }

        /* TRAP 1 (CONVENTIONS §13): a cell that paints nothing is a hole - the ground
         * shows through everything not painted over it, so an unpainted row would be
         * a slab of divider colour. The ground here is the CARD's, --ui-key, the
         * value the oracle reads on .slate-card in both themes. Not .seam-cell,
         * whose --ui-fascia is the page body and would read as a second surface
         * inside the card. */
        .cell {
            background-color: var(--ui-key);
            min-inline-size: 0;
        }

        /* THE ROWS. Flex with wrap, because the responsive half is the spec's and not
         * Slate's (departure 4): the value keeps its end alignment via an auto
         * inline-start margin, which survives wrapping onto its own line.
         * padding-block is the measured py-[18px] = --ui-space-4, and with a 26px
         * .ui-heading line box that is the 62px content box + 1px seam = the 63px
         * pitch the oracle measures five times over. */
        .row,
        .head {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            column-gap: var(--ui-space-5);
        }

        .row {
            padding-block: var(--ui-space-4);
        }

        /* DEPARTURE 3: the header row states a floor instead of borrowing one from
         * whatever control happens to be slotted into it. --ui-control-h is the 64px
         * the oracle measures on the "Copy all" button. */
        .head {
            min-block-size: var(--ui-control-h);
        }

        /* A HEADER WITH NEITHER A TITLE NOR AN ACTION IS NOT A ROW. Removed from the
         * grid entirely, so it draws no phantom seam. The slot stays in the tree
         * inside it - slot assignment is a DOM operation, not a layout one - so
         * slotchange still fires and the row comes back the moment content arrives. */
        .head.is-empty {
            display: none;
        }

        .heading,
        .term {
            min-inline-size: 0;
            /* §2.4's no-silent-clip rule, at the level of one word: an unbroken
             * serial number breaks rather than spilling out of the card. */
            overflow-wrap: anywhere;
        }

        /* THE TRAILING CLUSTER. An auto margin rather than justify-content, so the
         * cluster stays at the end on a wrapped line too. */
        .actions {
            display: flex;
            align-items: center;
            gap: var(--ui-space-3);
            margin-inline-start: auto;
        }

        .value {
            min-inline-size: 0;
            margin-inline-start: auto;
            margin-inline-end: 0;
            text-align: end;
            overflow-wrap: anywhere;
        }
    `];

    constructor() {
        super();
        this.items = [];
        this.heading = '';
        this.level = DEFAULT_LEVEL;
        this.label = '';
        this.pad = 'regular';
        this.scrollable = false;
        this.dash = NO_READING_MARK;
        this._hasActions = false;
        /* D2's mechanism, the same spelling #33 and #31 use, so the wave has one
         * shape for this: the controller subscribes on connect and requests an update
         * on a language change, so the absent sentence re-renders through the
         * template rather than by anyone reaching into this root. */
        this.i18n = new I18nController(this);
    }

    /** Normalise before paint, so a typo is a documented fallback and not a surface
     *  with no inset or a heading at no level. Both lists are IMPORTED - #16 owns the
     *  levels, #8 owns the pads - because a second copy is a second thing to drift. */
    willUpdate(changed) {
        if (changed.has('level')) {
            const raw = Number.parseInt(this.level, 10);
            const next = SHEET_HEADING_LEVELS.includes(raw) ? raw : DEFAULT_LEVEL;
            if (next !== this.level) this.level = next;
        }
        if (changed.has('pad')) {
            const raw = String(this.pad ?? '').trim().toLowerCase();
            const next = CARD_PADS.includes(raw) ? raw : 'regular';
            if (next !== this.pad) this.pad = next;
        }
    }

    /** The rows, normalised. Never fewer than were handed in. */
    get #rows() {
        const raw = Array.isArray(this.items) ? this.items : [];
        return raw.map((row, i) => normaliseDefinition(row, i));
    }

    /** The group's accessible name. An explicit label wins; the title is the fallback,
     *  which is the "region labelled by its heading" pattern written the only way a
     *  shadow boundary allows - an IDREF cannot cross it, so aria-labelledby is not
     *  available and the string is passed to #8's own `label`. */
    get #groupName() {
        return this.label || this.heading || '';
    }

    #onActionsSlotChange(event) {
        const assigned = event.target.assignedNodes({ flatten: true });
        this._hasActions = assigned.some(
            (node) => node.nodeType === Node.ELEMENT_NODE
                || (node.textContent || '').trim() !== '',
        );
    }

    /**
     * NO HEADING, NO HEADING ELEMENT - #16's rule (ui-sheet-header.js:440-447),
     * because an empty announced heading is worse than none.
     */
    #renderHeading() {
        const text = this.heading ?? '';
        if (!text) return nothing;
        switch (this.level) {
            case 1: return html`<h1 id="heading" class="ui-heading heading"
                >${text}</h1>`;
            case 3: return html`<h3 id="heading" class="ui-heading heading"
                >${text}</h3>`;
            case 4: return html`<h4 id="heading" class="ui-heading heading"
                >${text}</h4>`;
            case 5: return html`<h5 id="heading" class="ui-heading heading"
                >${text}</h5>`;
            case 6: return html`<h6 id="heading" class="ui-heading heading"
                >${text}</h6>`;
            default: return html`<h2 id="heading" class="ui-heading heading"
                >${text}</h2>`;
        }
    }

    /**
     * The dash is a glyph standing for a sentence, so it is hidden from the
     * accessibility tree and the sentence is exposed instead (ui-stat-tile's shape).
     */
    #renderValue(value) {
        /* THE LINE BREAK BEFORE THE `>` IS LOAD-BEARING FOR GATE D, not a style
         * choice: scripts/gate-d.js:210 flags an interpolated template chunk
         * containing a slash and no newline as a route assembled from fragments, and
         * a single-line Lit chunk ending in a closing tag is exactly that shape
         * (ui-confirm-dialog.js:492 records the same trap). */
        if (!isAbsentDefinition(value)) {
            return html`<span class="text"
                >${value}</span>`;
        }
        return html`<span class="text" aria-hidden="true">${this.dash}</span
            ><span class="a11y">${this.i18n.t(ABSENT_KEY)}</span>`;
    }

    #renderRow(row) {
        return html`<div class="cell row" id="row-${row.index}">
            <dt class="ui-heading term" id="term-${row.index}">${row.term}</dt>
            <dd class="ui-body ui-numeric value" id="value-${row.index}">${this.#renderValue(row.value)}</dd>
        </div>`;
    }

    render() {
        const rows = this.#rows;
        const name = this.#groupName;
        const headEmpty = !this.heading && !this._hasActions;
        /* THE INNER CARD'S ID IS `surface`, NOT `card`, and that is for the tests
         * rather than for the cascade: #8's own paint div is `#card` inside ITS root,
         * so a deep selector reads `#defs >>> #surface >>> #card` — two different ids
         * for two different boxes, instead of one id repeated across a boundary. */
        return html`<ui-card
            id="surface"
            class="surface"
            .pad=${this.pad}
            .scrollable=${this.scrollable}
            .label=${name}
        ><div id="stack" class="stack seam-grid seam-rows seam-line">
            <div id="head" class="cell head ${headEmpty ? 'is-empty' : ''}">
                ${this.#renderHeading()}
                <span id="actions" class="actions"><slot
                    name="actions" @slotchange=${this.#onActionsSlotChange}></slot></span>
            </div>
            <dl id="list" class="list seam-grid seam-rows seam-line"
                >${rows.map((row) => this.#renderRow(row))}</dl>
        </div></ui-card>`;
    }
}

customElements.define('ui-definition-card', UiDefinitionCard);
