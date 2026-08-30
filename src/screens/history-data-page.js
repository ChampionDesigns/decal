/**
 * history-data-page.js — <history-data-page>, the History route's second page.
 * Wave 5.6 (wf-w5p6-history), rows `hist-data-page`, `hist-components`, and bugs
 * H4 (real grid semantics) and H5 (the data grid built once).
 *
 * ===========================================================================
 * §4.5's TRACK LIST, AND WHAT EACH TRACK IS
 * ===========================================================================
 *
 *     grid-template-rows: auto auto minmax(0, 1fr)
 *       ├─ #phase-a    caption + #table-a    auto — the table is its own min-content
 *       ├─ #phase-b    caption + #table-b    auto — the same
 *       └─ #shot-list  every recorded shot   the page's ONE scroll region
 *
 * THE FIRST TWO TRACKS HOLD SECTIONS RATHER THAN TABLES, since `cmp-seh-4` gave each
 * table a caption; the track list is unchanged and so is every claim under it, because a
 * section of two auto rows is still auto.
 *
 * THE TWO TABLES ARE FIXED SUMMARIES AND MUST NOT SCROLL. `<ui-data-grid>`'s frame is a
 * scroll region — `overflow: auto` with `max-block-size: 100%` — and its own file warns
 * that "overflow: auto MAKES THIS A CLIPPING ANCESTOR, which is bug L24's mechanism". The
 * answer is not to switch the component's overflow off from outside (nothing here can
 * reach into its shadow root, and a part() surface deliberately does not exist): it is to
 * SIZE the instances so the overflow never engages. A percentage maximum against an
 * auto-height parent computes to `none`, so a table in an `auto` track is simply as tall
 * as its rows. The suite asserts `scrollHeight === clientHeight` on both, which is the
 * claim rather than the mechanism.
 *
 * THE LIST IS THE ONE THAT SCROLLS, and its floor is a TOKEN: `--ui-history-list-min-h`,
 * = 3 x `--ui-list-row`, carrying an M18 note because Part 5 §6 marks the figure
 * "proposal — confirm on prototype". It is never spelled as a literal here, in a test, or
 * in a comment. Its scrollbar stays VISIBLE (§2.4 bans hiding it).
 *
 * ===========================================================================
 * H5 — THE DATA GRID IS BUILT ONCE, AND THIS PAGE IS THE PROOF
 * ===========================================================================
 * Slate has THREE grid implementations with three different grid semantics plus a
 * stranded fourth column template (`.sx-recent-item`'s four columns can never render and
 * the class is declared twice in one sheet). This page composes `<ui-data-grid>` (#34,
 * wave 4) three times and declares no track of its own for any of them.
 *
 * THE SHARPEST FORM OF "BUILT ONCE" IS THE COLUMNS, NOT THE COMPONENT.
 * `HISTORY_PHASE_COLUMNS` and `historyPhaseRows()` are `src/lib/live-targets.js`'s, and
 * both are built ON the Live panel's `PHASE_COLUMNS` / `phaseRows()` rather than beside
 * them: this table is those three columns plus Slate's TEMP, FLOW and PRESSURE, and it
 * calls the Live builder for the first three so they cannot part. Ben, 25 August 2026:
 * "Copy Slate" — the Live screen's shot-data panel
 * renders the same two things through the same component (`live-screen.js:1309-1313`). So
 * the Live panel and History's two tables are not two implementations that agree; they
 * are one, imported twice. A fourth column set here would be H5 arriving by the front
 * door.
 *
 * THE FIXED TRACKS DO NOT COME ACROSS. §4.5: the row-label track becomes `max-content` or
 * a `ch` measure and the shot list's six fixed tracks totalling 554px become `fr`. Both
 * are already the component's: `--_ui-data-grid-tracks` composes the label track as
 * `minmax(<min>, max-content)` and every value track as `minmax(<min>, <grow>fr)`. So
 * `grow` is all this page states, and it states it in `HISTORY_COLUMNS`
 * (`shot-summary.js`), which has no pixel in it.
 *
 * ===========================================================================
 * H4 — ROWS THAT OWN THEIR CELLS
 * ===========================================================================
 * `#hv-data-grid-{a,b}` is a `role="grid"` with NO ROWS: 28 children, 27 of them
 * role-bearing, appended as direct children of the grid. #34 renders
 * `table > rowgroup > row > columnheader | rowheader | cell` with the rows and rowgroups
 * `display: contents`, so the tree is correct while every cell stays an item of the one
 * grid — "there is no API that appends a cell without a row". This page asserts that
 * through Chrome's own accessibility tree rather than through the DOM, because the DOM is
 * where Slate's version also looks fine.
 *
 * THE ROW-HEADER COLUMN IS A PROPERTY OF THE TABLE, NOT OF THE PAGE. `row-header-label`'s
 * presence is what gives a table a row-header column at all, so the two phase tables state
 * one ("Phase") and the shot list omits it — the grid's own docs say "a shot list simply
 * omits it", and with no row-header column every track is `fr`.
 *
 * ===========================================================================
 * B5 / Q17 — THE DASH, AND NO FETCH BEHIND IT
 * ===========================================================================
 * The list's eight columns come from `shot-summary.js`'s `HISTORY_COLUMNS` and its rows
 * from `shotRows()`, which take a `/shots` list item and an ALREADY-COMPUTED derivation
 * when one exists. There is no `fillMissingOutcomes`, no pending queue and no per-row
 * fetch: a row with no derivation dashes its three derived columns and that is the
 * finished answer, not a pending one. Absence is absence — `hasReading` is a finite
 * number, so a real 0 prints `0.0 g` and only an absence reaches the dash. Slate prints
 * the string `'0.0'` where its own docblock promises a dash, because its sentinel is a
 * string and its guard tests truthiness.
 *
 * ===========================================================================
 * EACH TABLE SAYS WHOSE SHOT IT IS  (`cmp-seh-4`, Ben: agreed)
 * ===========================================================================
 * The finding, verbatim: "two identical-looking tables with different numbers,
 * distinguishable only by order". The shot's identity reached the accessible label and
 * nothing else, so at design size the page showed 3.3 s over 8.3 s with nothing on screen
 * saying which shot either belonged to. Slate captioned each table and the port dropped
 * the caption with no manifest row naming it.
 *
 *   CITE prov-baseline/history-shotdata.json [i=176] span.slate-hv-pick-tag text "A",
 *        rect [57, 155, 62, 62] - the same 62px disc the band uses, which is #45.
 *   CITE prov-baseline/history-shotdata.json [i=177] span#hv-data-sub-a.sx-data-sub text
 *        "15/08 07:10 . Lever Classic demo", rect [137, 173, 255, 26], font-size 17px,
 *        weight 400, colour rgb(186, 196, 202)  [= --ui-text-2, tokens.css:1295 dark /
 *        :1169 light]. 137 - (57 + 62) = 18px = --ui-space-4, and 17px at the 1.5 ratio
 *        is 25.5px, which is the measured height. Every number is a token already.
 *   CITE [i=211] and [i=212] are the same two elements for slot B, 266px lower.
 *
 * ONE STRING, PAINTED AND SPOKEN. The caption is `shotOptionLabel()`'s output - the same
 * spelling the A/B pickers offer in the band above, computed ONCE in `shot-summary.js`
 * and carried on the row model this page is already handed as `row.label`. This file does
 * not format a date, a title or a yield; it looks up the row whose id the slot holds. The
 * grid's `label=` gains the same string through `{name} by phase, {shot}`, so the name a
 * screen reader is given and the text a person can see cannot drift into two spellings.
 *
 * A SLOT WITH NO SHOT PAINTS NO TEXT, and the disc stays. That is Slate's own behaviour
 * (`history-viewer.js:783`, read-only: `if (sub) sub.textContent = ''` on the no-record
 * branch) and it is right - the table underneath already says "No comparison shot" in the
 * library's empty state, and a caption repeating it would be the same sentence twice.
 *
 * THE DISC IS FILLED WHEN THE SLOT IS FILLED. Slate tinted the A disc and left B plain
 * through `.slate-hv-pick-tag[data-slot="a"]`, which is a private look keyed on WHICH
 * SLOT it is - a seventh selection treatment, and the founding-defect callout
 * (SCOPE.md:1576-1578) names #45 as one of the six components that may never own one. So
 * the port paints the state the dials exist for instead: `selected` when this slot has a
 * shot on the charts, which is exactly what #45's `aria-current` announces
 * ("A is the shot on the charts", slate-live.css:2256-2258). Two filled discs when both
 * slots are filled is the honest picture; the letters are what tell A from B.
 *
 * ===========================================================================
 * WHAT THIS PAGE DOES NOT DO
 * ===========================================================================
 * No fetch, no store, no endpoint: rows and derivations arrive as properties. No steam
 * history (D3). No derived channels and no P-Q: they render on the POWER page and nowhere
 * else, which is the whole extent of Ben's reversal of D1. Nothing here parses a number back out of
 * rendered text (chart-C13) — every cell is spelled once, in `shot-summary.js`, from the
 * one walk. D2: every readable string is read through `I18nController`.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import { HISTORY_PHASE_COLUMNS, historyPhaseRows } from 'src/lib/live-targets.js';
import { HISTORY_COLUMNS } from 'src/lib/shot-summary.js';
import { ALIGNMENT_SLOT } from 'src/lib/alignment-offset.js';
/* The port's reader for the port's typed failure — the same two sentences the flow
 * page shows, from the same function, so one fault is not described two ways. */
import { failureRefusal } from 'src/lib/history-viewer.js';
/** The one dash spelling in the tree, borrowed from the component that owns it
 *  rather than typed again here — `live-screen.js:239` does the same, and
 *  `shot-summary.js`'s DEFAULT_DASH is the same character. */
import { DEFAULT_DATA_GRID_DASH } from 'src/components/ui-data-grid.js';

/* COMPOSED, NOT CONSTRUCTED (Part 10 §9). #34 the data grid (wave 4) and the empty state
 * (wave 2). Both were built before this screen existed. */
import 'src/components/ui-data-grid.js';
import 'src/components/ui-empty-state.js';
/* #45, the A/B pick disc — the SAME component the band's two pickers are, in its static
 * tag form. Slate drew the tag and the row button as one object on purpose and said so;
 * a second circle with a letter in it would be that decision thrown away. */
import 'src/components/ui-pick-disc.js';

/** The mount contract's `data-page` value. */
export const DATA_PAGE_ID = 'data';

/**
 * The shot list's column headings, by the key `HISTORY_COLUMNS` states.
 *
 * THE COLUMN TABLE HOLDS NO STRING A PERSON READS, deliberately: `shot-summary.js` is
 * DOM-free and i18n-free by construction, so the words belong to whichever component
 * renders it, in that component's translated words (D2). Slate's own five headings are
 * carried — Date, Time, Profile, Shot, Out (`history-viewer.js:857-859`) — and the three
 * columns it never had are named for what they are.
 */
const LIST_HEADINGS = Object.freeze({
    date: 'Date',
    time: 'Time',
    profile: 'Profile',
    duration: 'Shot',
    yield: 'Out',
    peakPressure: 'Peak',
    averageFlow: 'Flow',
    enjoyment: 'Rating',
});

/**
 * THE TWO PICK SLOTS, and every string a disc needs.
 *
 * `ALIGNMENT_SLOT` is the same pair of names the band's pickers use and the same pair
 * `<history-screen>` switches on, so a disc and a dropdown that choose the same slot say
 * the same word. The letters are Slate's ("tap A or B to put a shot on the charts").
 *
 * TWO LABELS PER SLOT, because a disc that is already filled offers the opposite action:
 * pressing it clears the slot. An accessible name that still said "Show as A" on the
 * control that unshows it would be the name lying about what the press does.
 */
const SLOTS = Object.freeze([
    Object.freeze({
        slot: ALIGNMENT_SLOT.REFERENCE,
        letter: 'A',
        name: 'Show as A — {shot}',
        clear: 'Clear A — {shot}',
    }),
    Object.freeze({
        slot: ALIGNMENT_SLOT.MOVING,
        letter: 'B',
        name: 'Compare as B — {shot}',
        clear: 'Clear B — {shot}',
    }),
]);

export class HistoryDataPage extends UiElement {
    static properties = {
        /** Shot A's gate-6 derivation, for the first phase table. */
        derivationA: { attribute: false },

        /** Shot B's, or null — the table then says "No comparison shot" and means it. */
        derivationB: { attribute: false },

        /**
         * The store's typed failure, VERBATIM, or null — `history-viewer.js`'s `failure`,
         * handed down by the screen that owns the viewer. This page still reads no store.
         *
         * WHY A LIST PAGE NEEDS IT AT ALL: measured with a transport failing every
         * request, this page rendered "No shots recorded yet / Pull a shot and it will be
         * listed here" — a sentence that is false, and is the one a machine with an empty
         * database would also show. The refusal now says which of the two happened.
         */
        failure: { attribute: false },

        /**
         * The shot list's rows, as `shot-summary.js`'s `shotRows()` builds them:
         * `[{ id, cells: { [columnKey]: { text, value, present, source } } }]`.
         *
         * NAMED `rows` BECAUSE THAT IS WHAT THE STORE PUBLISHES, and neither this name nor
         * anything under it spells `shots` — Gate D retires `/\.shots\b/` tree-wide
         * (CB-21: the list endpoint answers `{items, total, limit, offset}` and the old
         * skin read `response.shots`, so its history chips were empty on every machine
         * ever built).
         */
        rows: { attribute: false },

        /** The shot the band has in slot A, so its row can be marked in the list. */
        shotA: { type: String, attribute: 'shot-a' },

        /** The shot in slot B. */
        shotB: { type: String, attribute: 'shot-b' },
    };

    static styles = [typeRoles, css`
        /* NO BACKTICK IN THIS TEMPLATE, comment or not (CONVENTIONS §9).
         *
         * THE HOST IS THE GRID ITEM. The mount region's slot is display: contents, so the
         * track list goes here — §4.5's own, and there is no px in it. No container query
         * lives in this file, so unlike the flow page there is nothing that needs an inner
         * box to be queried against: the rows are declared on the element that is the cell.
         *
         * NO overflow HERE. The list owns the page's one scroll region and it owns it
         * inside its own component; a page that scrolled would be scrolling its two fixed
         * summaries as well, and #page above it deliberately declares no overflow either
         * (bug L24 — a clipping ancestor clips a focus ring it does not own). */
        :host {
            display: grid;
            /* THE TWO PHASE TABLES SHARE ONE ROW NOW, and the shot list keeps the rest.
             *
             * Ben, 25 August 2026: "Due to your smaller Phase chart I believe we can fit B
             * to the right of A? If so please do that."
             *
             * It is his own measurement and it is right: the table went from three columns
             * to six on 25 August, and six of these columns is still about half the page,
             * because they are number columns with a floor and no growth. Stacked, the two
             * summaries cost the shot list two full table heights; side by side they cost
             * it one, and the comparison reads across rather than down - which is what a
             * comparison is for. Slate stacks them and says why ("the columns then line up,
             * which is what makes two tables a comparison instead of two tables"), and that
             * reason holds only while a table is too wide to sit beside its pair. */
            grid-template-rows: auto minmax(0, 1fr);
            grid-template-columns: 1fr 1fr;
            gap: var(--ui-space-5) var(--ui-space-6);
            min-block-size: 0;
            min-inline-size: 0;
        }

        /* THE LIST SPANS BOTH COLUMNS. It is one table of every shot, not one per slot. */
        #shot-list {
            grid-column: 1 / -1;
        }

        /* A NARROW PAGE PUTS THEM BACK ONE ABOVE THE OTHER. Two six-column numeric tables
         * in half of a small screen is two tables of ellipses. The threshold is the pair's
         * own floor rather than a picked width: --ui-rail-w is the one layout width this
         * tree states, and two tables plus their gap is about two of them. */
        @media (max-width: 1100px) {
            :host {
                grid-template-columns: minmax(0, 1fr);

                /* AND THE ROWS GO BACK TO THREE WITH IT. This is the half that was missed
                 * when B moved beside A on 25 August 2026: the columns changed here and
                 * the rows above kept describing the two-column page, where there are two
                 * rows because A and B share the first one.
                 *
                 * WHAT THAT DID, measured at the 1000x600 floor: three items went into two
                 * declared tracks, so PHASE B took the minmax(0, 1fr) and was squeezed
                 * below phase A (222.6 against 237.4 — the same table, two heights), and
                 * the shot list fell into an implicit auto row and sat at its own minimum
                 * for ever. The track that pays was the wrong one, and the track that is
                 * supposed to take what is left could not.
                 *
                 * The file's own header states the shape: auto / auto / minmax(0, 1fr). */
                grid-template-rows: auto auto minmax(0, 1fr);
            }
        }

        /* A PHASE SECTION IS THE GRID ITEM NOW — caption over table, and the section is
         * what the host's first two auto tracks size to. The auto-height chain the tables
         * depend on is unbroken: an auto row inside an auto row is still auto. */
        .phase {
            display: grid;
            grid-template-rows: auto auto;
            gap: var(--ui-space-2);
            min-inline-size: 0;
        }

        /* THE CAPTION. The disc's own size is a token it carries itself; this rule owns
         * only the row it sits in. --ui-space-4 is the oracle's 18px, measured between the
         * disc's right edge and the text's left. Centred rather than baselined: the disc
         * is a circle with a letter in it, and a 62px circle hung off a 17px baseline sits
         * visibly low. */
        .caption {
            display: flex;
            align-items: center;
            gap: var(--ui-space-4);
            min-inline-size: 0;
            /* AIR ABOVE THE DISC. Ben, 25 August 2026: "In the main area, the A in the
             * circle is too close to the header rail thing, need to move it down a little."
             *
             * The disc is a 62px circle and the compare bar above it ends on a hairline, so
             * with the page's own --ui-space-3 between them the circle very nearly touches
             * the rule. This is the space the caption needs rather than a space the page
             * gives every child: the second table's caption sits beside this one now, not
             * under it, so a gap on the host would open a hole nothing fills. */
            padding-block-start: var(--ui-space-3);
        }

        /* The shot's own words, in the secondary ink the oracle paints them in. It may
         * WRAP and it never clips (§2.4): min-inline-size: 0 is what lets it shrink inside
         * the flex row instead of pushing the row wider than the page. */
        .shot {
            color: var(--ui-text-2);
            min-inline-size: 0;
        }

        /* THE TWO FIXED SUMMARIES. block-size: min-content is the floors table's own word
         * for them, and it is also what keeps the component's frame from becoming a scroll
         * region: its max-block-size: 100% has an auto-height chain to resolve against, so
         * the frame is as tall as its rows and overflow: auto never engages. */
        #table-a,
        #table-b {
            block-size: min-content;
            min-inline-size: 0;
        }

        /* THE ONE SCROLL REGION, floored on the token and never on a literal. The floor is
         * a PROPOSAL (M18) and lives in styles/tokens.css carrying that note. */
        #shot-list {
            min-block-size: var(--ui-history-list-min-h);
            min-inline-size: 0;
        }
    `];

    #i18n = new I18nController(this);

    constructor() {
        super();
        this.derivationA = null;
        this.derivationB = null;
        this.failure = null;
        this.rows = null;
        this.shotA = '';
        this.shotB = '';
    }

    /** The mount contract, filled in by the page that knows the answers. See the flow page. */
    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('slot')) this.setAttribute('slot', 'page');
        if (!this.hasAttribute('data-page')) this.setAttribute('data-page', DATA_PAGE_ID);
    }

    render() {
        const t = this.#i18n.t;
        const rows = Array.isArray(this.rows) ? this.rows : [];
        /* null unless the store reported a failure, in which case every surface with
         * nothing to show says what the machine said instead of guessing on its behalf. */
        const refusal = failureRefusal(this.failure, t);
        /* A TABLE SPEAKS FOR THE READ IT ASKED FOR. "No shot selected" is TRUE when
         * nothing is picked — it is only a lie when a shot WAS picked and did not
         * arrive — so the failure replaces it there and nowhere else. The list has no
         * such distinction: the failing read is the one that fills it. */
        return html`
            ${this.#renderPhaseTable('a', 'A', this.shotA, this.derivationA, t('Shot A'),
                (this.shotA && refusal?.heading) || t('No shot selected'))}
            ${this.#renderPhaseTable('b', 'B', this.shotB, this.derivationB, t('Shot B'),
                (this.shotB && refusal?.heading) || t('No comparison shot'))}

            <!-- THE SHOT LIST. #34 again, with no row-header-label — "a shot list simply
                 omits it" — so every one of its eight tracks is fr. -->
            <ui-data-grid
                id="shot-list"
                label=${t('Recorded shots')}
                dash=${DEFAULT_DATA_GRID_DASH}
                .columns=${this.#listColumns()}
                .rows=${rows.map((row) => this.#listRow(row))}
            >
                ${rows.map((row) => this.#renderPicks(row))}
                <ui-empty-state
                    slot="empty"
                    heading=${refusal?.heading ?? t('No shots recorded yet')}
                    body=${refusal?.body ?? t('Pull a shot and it will be listed here.')}
                ></ui-empty-state>
            </ui-data-grid>
        `;
    }

    /**
     * One shot's phase table, under its own caption: Live's own columns and Live's own row
     * builder (H5), the library's own disc (#45), and the row model's own label.
     *
     * The labels are translated HERE and the table is handed the result, which is the
     * pattern `live-screen.js:1311-1312` records — the column table is data and the words
     * are the screen's.
     *
     * `shot` is the ONE identity string (see the header). It reaches the caption and the
     * grid's accessible name from the same constant, so the two cannot part; a slot with
     * no shot has no identity to say and the grid keeps the name it always had.
     */
    #renderPhaseTable(slot, letter, id, derivation, name, refusal) {
        const t = this.#i18n.t;
        const ok = Boolean(derivation && derivation.ok);
        const shot = this.#identityOf(id);
        return html`
            <section id="phase-${slot}" class="phase">
                <div class="caption">
                    <ui-pick-disc
                        id="disc-${slot}"
                        label=${name}
                        ?selected=${Boolean(shot)}
                        >${letter}</ui-pick-disc
                    >
                    <span id="shot-${slot}" class="shot ui-body">${shot ?? ''}</span>
                </div>

                <ui-data-grid
                    id="table-${slot}"
                    label=${shot
                        ? t('{name} by phase, {shot}', { name, shot })
                        : t('{name} by phase', { name })}
                    row-header-label=${t('Phase')}
                    dash=${DEFAULT_DATA_GRID_DASH}
                    .columns=${HISTORY_PHASE_COLUMNS.map((column) => ({ ...column, label: t(column.label) }))}
                    .rows=${ok
                        ? historyPhaseRows(derivation).map((row) => ({ ...row, header: t(row.header) }))
                        : []}
                >
                    <ui-empty-state slot="empty" heading=${refusal}></ui-empty-state>
                </ui-data-grid>
            </section>`;
    }

    /**
     * How the shot in this slot names itself, or `null`.
     *
     * READ OFF THE ROW MODEL, NEVER FORMATTED HERE. `shot-summary.js`'s `shotRow()` puts
     * `shotOptionLabel(summary)` on every row as `label`, and that is the string the band's
     * two pickers already offer — so the caption, the picker option and the accessible name
     * are one spelling with one owner. A page that built its own would be a second answer
     * to "how does a shot name itself", which is the class of defect H5 is about one floor
     * down.
     *
     * An id with no row is an absence, not a blank: the listing is a page of twenty and a
     * shot older than that is legitimately not in it.
     */
    #identityOf(id) {
        if (!id) return null;
        const rows = Array.isArray(this.rows) ? this.rows : [];
        const label = rows.find((row) => row && row.id === id)?.label;
        return typeof label === 'string' && label !== '' ? label : null;
    }

    /**
     * The list's columns: `HISTORY_COLUMNS`'s keys, grow weights and alignment, plus the
     * headings and units this component owns. `unit` is part of a header's accessible
     * name, so it goes to the grid rather than into the cell text — the cells already
     * carry their own units from `scalarText`, which is the one place a number is spelled.
     */
    #listColumns() {
        const t = this.#i18n.t;
        return [...HISTORY_COLUMNS.map((column) => ({
            key: column.key,
            label: t(LIST_HEADINGS[column.key] ?? column.key),
            align: column.align,
            grow: column.grow,
            /* THE COLUMN'S INK travels with the column, exactly as the phase tables'
             * weight-channel ink travels with PHASE_COLUMNS. Passed through rather than
             * decided here: the hierarchy is the table's, and the argument for each of
             * the three values is quoted from the oracle beside it (parity surface 6). */
            ink: column.ink,
        })), {
            /* THE PICK COLUMN. Ben, 25 August 2026, on the chart audit's finding 7
             * ("Putting a shot on the charts"): "Copy Slate". Slate gives every row an A
             * and a B button and says why in the row's own heading — "All shots — tap A
             * or B to put a shot on the charts" — with the reason spelled out beside the
             * renderer: "which two shots is the only question this page exists to answer
             * and a list you can only read is a list that makes you go back to a
             * dropdown".
             *
             * `slot: true` IS A SEAM THAT WAS ALREADY BUILT FOR THIS. `<ui-data-grid>`'s
             * own header names the case in as many words — "shot list is #45's pick disc,
             * slotted into a cell by the screen" — and gives the slot name's shape,
             * `cell-<rowKey>-<colKey>`. It had no caller until now.
             *
             * `grow: 0` KEEPS IT OFF THE TEXT COLUMNS. Two discs are a fixed width, and a
             * pick column that stretched would take room from the profile title, which is
             * the one column on this list that can actually use it. */
            key: 'picks',
            label: t('Charts'),
            align: 'end',
            grow: 0,
            slot: true,
        }];
    }

    /**
     * The two discs for one row, addressed into the grid's pick cell.
     *
     * THEY ARE LIGHT-DOM CHILDREN OF THE GRID, which is what `slot: true` means and is
     * also why they can be authored here at all: the grid renders
     * `<slot name="cell-{rowKey}-picks">` and the browser projects whatever this page put
     * in that named slot. The discs stay in THIS shadow root for styling and for events.
     *
     * PRESSING THE SLOT A SHOT ALREADY OCCUPIES CLEARS IT, which is Slate's rule and its
     * reason: "the only way to get back to one shot on the charts without hunting for a
     * 'none' entry in a list of seventy". The disc reports the state it is asking FOR
     * (`detail.selected`), so this reads that rather than negating anything itself.
     *
     * `form="pick"` AND NOT THE DEFAULT TAG. The component's own header says which is
     * which: hollow "until assigned, so twenty-one unassigned rows do not read as
     * twenty-one filled discs", against the band's filled tags which name a slot rather
     * than offer one. This is the case it describes.
     */
    #renderPicks(row) {
        const t = this.#i18n.t;
        const id = row?.id ?? '';
        if (!id) return nothing;
        const label = row?.label ?? '';
        return SLOTS.map(({ slot, letter, name, clear }) => {
            const current = slot === ALIGNMENT_SLOT.REFERENCE ? this.shotA : this.shotB;
            const chosen = current === id;
            return html`<ui-pick-disc
                slot="cell-${id}-picks"
                data-pick=${slot}
                data-shot=${id}
                form="pick"
                interactive
                ?selected=${chosen}
                label=${t(chosen ? clear : name, { shot: label })}
                @pick=${() => this.#onPick(slot, chosen ? '' : id)}
                >${letter}</ui-pick-disc>`;
        });
    }

    /**
     * A row's disc was pressed. The page holds no selection of its own and says so by
     * having nothing to set: `shotA` and `shotB` arrive as attributes from
     * `<history-screen>`, which owns them and owns the load. This announces the same
     * `shot-change` the band's two pickers announce, with the same detail shape, so the
     * screen has ONE handler and the two routes to a selection cannot disagree — which is
     * Slate's own arrangement ("The dropdowns and these buttons are two routes to the same
     * state — refreshChrome() repaints both from it").
     */
    #onPick(slot, value) {
        this.dispatchEvent(new CustomEvent('shot-change', {
            detail: { slot, value },
            bubbles: true,
            composed: true,
        }));
    }

    /**
     * One list row. The cell TEXT is `shot-summary.js`'s — already spelled, already
     * dashed where a value is absent — so nothing is recomputed, re-rounded or
     * re-substituted here (A7). `emphasis` marks the shots the band is showing, which is
     * the only thing this page knows that the row model does not.
     */
    #listRow(row) {
        const cells = {};
        for (const column of HISTORY_COLUMNS) {
            cells[column.key] = row?.cells?.[column.key]?.text ?? null;
        }
        return {
            key: row?.id ?? '',
            cells,
            emphasis: Boolean(row?.id) && (row.id === this.shotA || row.id === this.shotB),
        };
    }
}

customElements.define('history-data-page', HistoryDataPage);
