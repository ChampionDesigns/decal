/**
 * ui-data-grid.js — component #34 of the 57-component inventory:
 * ONE TABULAR COMPONENT, behind three of Slate's.
 *
 * Wave 4, item #34, Live-screen compounds (SCOPE Part 4, "Wave 4 — dialog bodies and
 * screen compounds", SCOPE.md:1620-1628). Depends on `tokens` and `#27` only: no store,
 * no endpoint, no ReaPrime name. Rows and columns arrive as data.
 *
 * WHAT THE ROW SAYS, verbatim
 *   SCOPE.md:1626  "| 34 | **Data grid / table** | One tabular component behind Live's
 *   shot-data panel, the HV data page and the HV shot list — **three** implementations
 *   today with three different grid semantics: the HV pair is a `role="grid"` with **no
 *   rows at all** (H4), and Live's copy — the nearest to correct — still leaves its rows
 *   unowned by the grid (L23). Fixed-track templates become `max-content`/`fr` (spec
 *   §4.5). | medium | tokens, #27 |"
 *   SCOPE.md:1683  "| #34 Data grid | H4 (HV `role="grid"` with no rows), L23 (Live's
 *   rows unowned by their grid) |" — the acceptance test is "the defect cannot be
 *   expressed".
 *   SCOPE.md:1697-1699  "**Phase table** and **shot list** → #34 data grid variants.
 *   **Derived list** → a #34 variant, and **out of v1 anyway**."
 *
 * =========================================================================
 * THE DISQUALIFICATION CHECK, RUN FIRST (SCOPE Part 10 §4)
 * =========================================================================
 *
 *   (a) DECISIONS.md + the 45-item register. The row cites D1 and C2 and both REMOVE
 *       work rather than settle a value:
 *         D1  — the puck/derived channels are capability-gated and later, so the
 *               `.slate-derived-list` variant (SCOPE.md:1698) is NOT built here.
 *               MEASURED, for the record, so that nobody hunts for it:
 *               CITE history-shotdata .slate-derived-list [i=148] rect x=1372 y=984
 *                    w=324 h=136 — it exists in Slate and is deliberately absent here.
 *         C2  — "the band's real content height on a five-phase profile has never been
 *               measured … Until then the floor is **unknown** — it is written here as a
 *               token to be filled, not a number" (SCOPE.md:1918-1924). THIS COMPONENT
 *               THEREFORE DECLARES NO BLOCK FLOOR. Its floor is INLINE (the track
 *               minimums, below), which is its own to own; the band's block minimum is
 *               the screen's and is not inventable tonight. The item row says exactly
 *               this: "the foot-band measurement (§7.9-2) affects this component's
 *               variant minima, not its existence."
 *   (b) RESPONSIVE BEHAVIOUR — the oracle never gets a vote (Slate is frozen at
 *       1920x1200). Every track, every floor and the scroll behaviour below are
 *       LAYOUT_SPEC_DRAFT.md's, marked where they come up.
 *   (c) THE 140 LAYOUT BUGS. Grepped §7 before matching anything. This element is on the
 *       list twice — H4 and L23, the row's own two — and four more land on the shapes it
 *       replaces, so Slate is disqualified for each of them:
 *         L20 "seven inline fixed grid templates in the shot-data markup, and the
 *             sheet's carefully-commented calc(34px + 128px + 16px) is hand-derived from
 *             them" (index.html:359, 375, 378, 384, 387, 393, 396; slate-live.css:1309)
 *         L14 the panel "is declared in three separate blocks"
 *         H5  ".sx-recent-item's 4-column template can never render, and the class is
 *             declared twice in one sheet"
 *         P9  ".sx-recent-item declared twice in one file — which is how a 4-column
 *             template got stranded"
 *       All four are one defect wearing four hats: the tracks live in the markup, or in
 *       two places, or in a comment. Here there is ONE track list, computed from
 *       `columns`, written into one custom property.
 *
 * =========================================================================
 * THE TWO BUGS THIS COMPONENT EXISTS TO KILL
 * =========================================================================
 *
 * H4 — "`#hv-data-grid-{a,b}` is a `role="grid"` with **no rows** — 28 children, 27 of
 * them role-bearing, appended as direct children. The Live panel does this correctly,
 * which makes the contrast the fix." (`index.html:608, 615`; `history-viewer.js:811-837`)
 *
 *   Read read-only and confirmed exactly, because ROLES ARE NOT IN THE ORACLE'S
 *   18-PROPERTY APPEARANCE SURFACE and the grid containers themselves are not among the
 *   probed elements. `history-viewer.js:811-837` is a run of `grid.appendChild(...)`:
 *   one corner, six `role="columnheader"`, then per phase one `role="rowheader"` and six
 *   `role="gridcell"` — 1 + 6 + 3x7 = 28 children of the grid, 27 with a role, and not
 *   one `role="row"` between them. What the corpus CAN prove is the consequence, and it
 *   proves it across the whole corpus:
 *     prov_query.py find --role row      -> "searched 49 state(s), found 0 element(s)"
 *     prov_query.py find --role rowgroup -> "searched 49 state(s), found 0 element(s)"
 *     CITE history-shotdata .sx-data-col  [i=178] role=columnheader rect 242x33  (x12)
 *     CITE history-shotdata .sx-data-row  [i=190] role=rowheader    rect 210x30  (x6)
 *     CITE history-shotdata .sx-data-cell [i=191] role=gridcell     rect 242x33  (x36)
 *   Fifty-four cells and headers in that one state, and no row anywhere to own them.
 *
 * L23 — "**A11Y:** `aria-label` on role-less `<div>`s (x3); a `role="grid"` whose rows
 * are not owned by the grid or a rowgroup; …" (`index.html:169, 215, 279, 358, 479-482`)
 *
 *   Live's panel is `index.html:358`:
 *     <div id="shot-data-panel" … role="grid" aria-label="Detailed Shot Data">
 *       <div class="shot-data-cols grid …" role="row"> …three columnheaders… </div>
 *       <div id="shot-data-rows" class=" top-[88px] absolute flex flex-col …">   <- NO ROLE
 *         <div class="grid grid-cols-7 …" role="row">
 *           <div … role="rowheader">Preinfusion</div>
 *           <div class="h-9"></div>                                             <- NO ROLE
 *           <div class="shot-data-cols col-span-5 grid w-full" style="…">       <- NO ROLE
 *             <div id="shot-data-pi-time" … role="gridcell">15s </div>
 *   so the defect is TWO levels deep, not one: a role-less `#shot-data-rows` sits between
 *   the grid and its three rows, and a role-less `.shot-data-cols` sits between each row
 *   and its three cells. Live is "the nearest to correct" because the `role="row"`
 *   elements at least exist — they are simply owned by nothing and own nothing.
 *   The oracle records the orphans' paint:
 *     CITE live-ready #shot-data-panel [i=126] role=grid, text "Time (s) Weight (g)
 *          Volume (mL) Preinfus", rect x=902 y=944 w=1018 h=256
 *     CITE live-ready .h-9 [i=133] role=rowheader rect x=936 y=1018 w=128 h=34
 *     CITE live-ready #shot-data-pi-time [i=134] role=gridcell rect x=1080 y=1018 w=80 h=34
 *
 * HOW BOTH BECOME INEXPRESSIBLE. The consumer hands over `columns` and `rows` and never
 * touches the tree. Every cell this component renders is a child of an element carrying
 * `role="row"`, and every row is a child of an element carrying `role="rowgroup"`, which
 * is a child of the one element carrying `role="table"`. There is no API that appends a
 * cell, no slot inside the table, and the only element that can ever receive an
 * `aria-label` is the roled one. The suite asserts this from CHROME'S OWN ACCESSIBILITY
 * TREE (`Accessibility.getFullAXTree`), walking `childIds` — not from the attributes,
 * because the attributes are what Slate also had.
 *
 * ONE ROLE CHANGED ON THE WAY: `grid` -> `table`. `grid` is a composite widget and
 * promises cell-level keyboard navigation with managed focus; all three Slate
 * implementations promise it and none implements it (no roving tabindex, no key handler,
 * no `tabindex` on a cell anywhere in the three). `table` is the static-data role and is
 * what this component actually is — the row's own name is "Data grid / **table**". The
 * cell role follows the container: inside `role="table"` a data cell is `cell`, not
 * `gridcell`. Recorded as a deferred question with a two-constant reversal.
 *
 * =========================================================================
 * TRACKS — spec §4.5, the row's third sentence
 * =========================================================================
 *
 * "The data grid's fixed 210px row-label track (`slate-live.css:1903`) becomes
 * `max-content` or a `ch` measure; the shot list's six fixed tracks totalling 554px
 * (`:2451`) become `fr`." (LAYOUT_SPEC_DRAFT.md §4.5, :774-776)
 *
 * The three source templates, read read-only (a grid template is not in the oracle's
 * 18-property surface):
 *   slate-live.css:1899-1904  .sx-data-grid   grid-template-columns: 210px repeat(6, minmax(0, 1fr))
 *   slate-live.css:2445-2451  .hv-shot-row    grid-template-columns: 110px 84px minmax(0, 1fr) 110px 110px 140px
 *                             (110 + 84 + 110 + 110 + 140 = 554 — the spec's own number)
 *   index.html:359 et al      seven inline    grid-template-columns: 80px 88px 94px  /  128px 16px repeat(5, 1fr)
 * and the corpus's rendered consequence, which is what a fixed track looks like from
 * outside:
 *   CITE history-shotdata .sx-data-row [i=190] width = 210px  (x6, all six identical)
 *   CITE live-ready #shot-data-pi-time [i=134] width = 80px, [i=135] 88px, [i=136] 94px
 *
 * Here there is one track list and it is built from the data:
 *   row-label track   minmax(var(--_ui-data-grid-label-min), max-content)
 *   value track       minmax(var(--_ui-data-grid-col-min), <grow>fr)
 * `max-content` is the spec's first option and it is only honest because there is ONE
 * grid: every row's label is in the same track, so the track is the widest label rather
 * than the widest label in this row. That is why the rows are `display: contents` and
 * not seven nested grids — Slate's seven inline templates (L20) are seven grids that
 * agree by hand-arithmetic, and `calc(34px + 128px + 16px)` in the sheet is that
 * arithmetic written down (`slate-live.css:1309`).
 *
 * THE MINIMUMS ARE `ch`, WHICH IS THE SPEC'S OTHER OPTION, and they are the component's
 * one real floor: below the sum of them the grid stops shrinking and the frame scrolls.
 * A fixed px floor here would be a fourth hand-derived constant.
 *
 * =========================================================================
 * MEASURED PAINT — every value an oracle answer, quoted verbatim
 * =========================================================================
 * (realine-run/tools/prov_query.py themes/value/find, prov-baseline dark + prov-light.)
 *
 * THE GROUND
 *   CITE live-ready #shot-data-panel [i=126] background-color: dark rgb(14, 19, 23) /
 *        light rgb(242, 243, 243)  <-  slate-live.css  `#main-page #shot-history-panel,
 *        #main-page #shot-data-panel`  authored `(NOT CAPTURED — set via a CSS
 *        shorthand)`  !important=yes  (token-driven)
 *        [= --ui-fascia: styles/tokens.css:720 #f2f3f3 / :841 #0e1317. The corpus cannot
 *         name a token behind a shorthand (--help, CARVE-OUTS); the two computed values
 *         ARE the token's two theme values.]
 *   CITE live-ready #shot-data-panel [i=126] border-top-width = 1px, border-top-color:
 *        dark rgb(82, 97, 107) / light rgb(170, 178, 183)   [= --ui-line-strong,
 *        styles/tokens.css:731 #aab2b7 / :852 #52616b]  — NOT CARRIED, departure 1.
 *
 * THE COLUMN HEADER  (Live's is a two-line stack, the HV page's a one-line pair)
 *   CITE live-ready <span> [i=127] font-size = 14px, font-weight = 600,
 *        letter-spacing = 1.4px, text-transform = uppercase, color: dark
 *        rgb(148, 161, 169) / light rgb(90, 101, 108)   (the label "Time")
 *   CITE history-shotdata .sx-data-col [i=178] font-size = 14px, font-weight = 600,
 *        letter-spacing = 1.4px, text-transform = uppercase, gap = 6px, height = 33px,
 *        color: dark rgb(148, 161, 169) / light rgb(90, 101, 108)  <-  slate-live.css
 *        `.sx-data-col`  authored `var(--slate-muted)`  !important=no  (token-driven)
 *   Both are 14px/600/uppercase/muted — one treatment already, in two places. 14px is
 *   --ui-text-2xs, whose own comment in styles/tokens.css:351 reads "column headers,
 *   units". --ui-muted is the ink; the size overrides the shared `.ui-microcap` role,
 *   which is the sanctioned move (TYPE_ROLES.md rule 2: "pick it by what the text is,
 *   then override the size if a screen genuinely needs a different one").
 *
 * THE UNIT
 *   CITE live-ready .shot-data-col-unit [i=128] font-size = 14px  <-  slate-live.css
 *        `#main-page #shot-data-panel .shot-data-col-unit`  authored `var(--slate-text-sm)`
 *        !important=no  (token-driven)
 *   CITE live-ready .shot-data-col-unit [i=128] font-weight = 400  <-  the same rule
 *        authored `var(--slate-weight-regular)`  !important=no  (token-driven)
 *   CITE live-ready .shot-data-col-unit [i=128] letter-spacing = normal,
 *        text-transform = none, color: dark rgb(148, 161, 169) / light rgb(90, 101, 108)
 *   Slate's own reason for the last two, kept verbatim (slate-live.css:1334-1336):
 *   "A UNIT, written the way every other unit in the skin is written: regular weight, no
 *   tracking, not uppercased … Not uppercased: mL is a unit, and ML is a different one."
 *   That is a correctness rule, not a taste, so it is carried exactly.
 *
 *   AND IT IS PARENTHESISED, WHICH IS SLATE-INCONSISTENT AND RESOLVED THE LIVE PAGE'S
 *   WAY (parity surface 1). Slate spells the same column unit two ways in the same
 *   corpus — the Live panel writes it in brackets and the History page bare:
 *     CITE live-ready .shot-data-col-unit [i=128] text "(s)"; [i=130] "(g)";
 *          [i=132] "(mL)"  — a two-line stack under the label
 *     CITE history-shotdata .sx-data-col [i=178] text "Times"; [i=180] "Weightg";
 *          [i=182] "VolumemL" — a one-line pair, label and bare unit
 *   One component cannot render both, and Ben's tie-break for a role Slate draws two
 *   ways is the LIVE page's treatment ("the live page on slate has had the most work"),
 *   applied everywhere through the one component. So the brackets are added HERE, by the
 *   component, and not written into any caller's data: `unit: 's'` stays the unit, and a
 *   consumer that needs it unbracketed is a component change rather than a per-screen
 *   string. The History data page gets the Live spelling with it, which is the point.
 *
 * THE ROW HEADER
 *   CITE live-ready .h-9 [i=133] color: dark rgb(148, 161, 169) / light
 *        rgb(90, 101, 108)  <-  slate-live.css  `#main-page #shot-data-panel
 *        [role="rowheader"]`  authored `var(--slate-muted)`  !important=yes (token-driven)
 *   CITE live-ready .h-9 [i=133] font-size = 15px, font-weight = 600,
 *        letter-spacing = 1.8px, text-transform = uppercase, height = 34px
 *   That IS the `.ui-microcap` role, so the class is the whole declaration.
 *   The HV page's row label disagrees and loses — see departure 4.
 *
 * THE CELL
 *   CITE live-ready #shot-data-pi-time [i=134] color: dark rgb(244, 247, 248) / light
 *        rgb(23, 26, 28)  <-  slate-live.css  `#main-page #shot-data-panel
 *        [role="gridcell"]`  authored `var(--slate-text)`  !important=yes (token-driven)
 *   CITE live-ready #shot-data-pi-time [i=134] font-size = 17px  <-  the same rule
 *        authored `var(--slate-text-base)`  !important=yes  (token-driven)
 *   CITE live-ready #shot-data-pi-time [i=134] font-family = Geist, system-ui,
 *        sans-serif  <-  the same rule authored `var(--slate-font-numeric)`
 *        !important=yes  — and styles/tokens.css:346-347 records that
 *        "--slate-font-numeric was already defined as var(--slate-font-ui)", so this is
 *        --ui-font-family and there is no second family.
 *   CITE live-ready #shot-data-pi-time [i=134] height = 34px  <-  slate-live.css
 *        `#main-page #shot-data-panel [role="gridcell"], … [role="rowheader"]`
 *        authored `34px`  !important=yes  (FROZEN/hardcoded)  — not carried; see
 *        departure 5.
 *
 * THE ROW GAP AND COLUMN GAP, read read-only from slate-live.css:1899-1904 because a
 * grid gap on the container was not probed there:
 *   .sx-data-grid { column-gap: var(--slate-space-5); row-gap: var(--slate-space-3); }
 *   = --ui-space-5 (24px) and --ui-space-3 (12px).
 *
 * =========================================================================
 * DELIBERATE DEPARTURES — each visible, each declared, each asserted AS a departure
 * (realine-run/waves/4/ledger-src/34-expected-changes.json)
 * =========================================================================
 *
 * 1. NO BORDER, ON ANY SIDE, EVER. Slate's Live panel carries 1px of --ui-line-strong on
 *    its top and left (`border-r-0 border-b-0 … border border-base-400`, index.html:358;
 *    CITE [i=126] border-top-width = 1px). CONVENTIONS §13 is the law: "a divider is a
 *    gap, not a border", and LAYOUT_SPEC_DRAFT.md:521-525 puts exactly that line on the
 *    Live screen instead — `gap: var(--ui-seam)` over `background: var(--ui-line-strong)`,
 *    "the seam IS the divider". This is #16's and #31's departure repeated, for the same
 *    reason and with the same consequence: no line at all if the screen is not a seam
 *    grid, which is a visible omission rather than a silent one. The component paints an
 *    opaque --ui-fascia ground so that it is a legal seam CELL (§13 trap 1: "a cell that
 *    paints nothing is a hole").
 *
 * 2. THE HEADER RULE IS ONE CONTINUOUS LINE, NOT SEVEN DASHES. Slate draws it per cell —
 *    `.sx-data-col { border-bottom: var(--slate-hairline) solid var(--slate-line) }` plus
 *    the same declaration on `.sx-data-corner` (slate-live.css:1906-1917, :1919) — inside
 *    a grid whose `column-gap` is 24px. A per-cell border cannot cross a gutter, so the
 *    "underline" under a seven-track grid is seven segments with six 24px holes in it.
 *    Here it is one element spanning `1 / -1`, `--ui-seam` tall, in `--ui-line`: the
 *    §13 pattern (a gap over a ground) drawn as one row rather than as N per-cell
 *    borders, which is also the pre-review checklist's line — "a divider is the seam
 *    utility (§13), never a per-cell border".
 *
 * 3. THE TOTAL ROW'S EMPHASIS IS ALIVE, AND ON LIVE IT WAS DEAD. Slate's Live markup
 *    marks the three total cells `font-semibold` (index.html:393-398) and the sheet
 *    overrides every cell in the panel:
 *      CITE live-ready #shot-data-total-time [i=142] font-weight = 300  <-  slate-live.css
 *           `#main-page #shot-data-panel [role="gridcell"]` authored `300` !important=yes
 *      CITE live-ready #shot-data-pi-time   [i=134] font-weight = 300  <-  the same rule
 *    — identical, so the markup's emphasis paints NOTHING. That is bug L20's family and
 *    §6's whole argument in one measurement: the important flag is why the intent died.
 *    The HV page's version does work (`.sx-data-row[data-row="total"] { color:
 *    var(--slate-text) }`, `.sx-data-cell[data-row="total"] { font-weight: 400 }`,
 *    slate-live.css:1947-1948) — from 300 to 400, one step, and that is exactly what
 *    this component draws: base cells --ui-weight-light (300), emphasis
 *    --ui-weight-regular (400), plus the ink half (--ui-muted -> --ui-text on the row
 *    header). It was 400/500 until parity surface 1, because the sheet then carried
 *    three weights and had nowhere to put Slate's 300; restoring --ui-weight-light put
 *    both of Slate's own numbers back and made the departure disappear. Live's dead
 *    300/300 stays dead: that is bug L20, and one component has one treatment.
 *
 * 4. ONE ROW-HEADER TREATMENT, AND IT IS LIVE'S. The two disagree —
 *      CITE live-ready .h-9 [i=133] font-size = 15px, letter-spacing = 1.8px,
 *           text-transform = uppercase   (the `.ui-microcap` role)
 *      CITE history-shotdata .sx-data-row [i=190] font-size = 20px,
 *           letter-spacing = normal, text-transform = none, width = 210px
 *    — and one component has one treatment. The microcap wins because it is a shared role
 *    with three other consumers, because the label is a caption over a group of numbers,
 *    and because the 20px version's whole reason was filling a 210px fixed track that
 *    §4.5 deletes. Visible: the HV data page's row labels shrink 20px -> 15px, uppercase,
 *    and their track stops being 210px.
 *
 * 5. ROWS ARE CONTENT-SIZED, NOT 34px. Slate pins every cell and row header to a literal
 *    (CITE [i=134] height = 34px !important=yes; CITE .sx-data-cell [i=191] height = 33px;
 *    CITE .sx-data-row [i=190] height = 30px — three constants for one rhythm). Here the
 *    rhythm is `--ui-space-1` of block padding on a `--ui-text-base` line box plus the
 *    measured `--ui-space-3` row gap: a derivation rather than a constant, which is
 *    Appendix 12's rule ("a size expressed as control + 2 x space, not a measured
 *    constant"). It lands within a pixel of Slate's 33-34px and moves with the type scale
 *    instead of contradicting it.
 *
 * 6. THE UNIT SITS BESIDE ITS LABEL, NOT UNDER IT. Two implementations again: the HV page
 *    is one line (`.sx-data-col { display: flex; align-items: baseline; gap: 6px }`),
 *    Live stacks them (`.shot-data-col-head { flex-direction: column; gap: 1px }`,
 *    slate-live.css:1315-1324). Live's own comment gives the reason it stacked —
 *    "VOLUME (ML) on one line is 112px of uppercase for a column holding 36 — the unit
 *    was setting the column's width, and three columns were sized by their labels rather
 *    than by their numbers" — and §4.5 deletes that reason by making the value tracks
 *    `fr`, where no header can size a column. So the reason evaporated and the one-line
 *    form is kept. The 6px gap is off the spacing scale (§3.3: "the seven steps are the
 *    WHOLE vocabulary; off-scale values snap to the nearest step") and snaps to
 *    `--ui-space-1` = 4px.
 *
 * 7. THE FRAME SCROLLS RATHER THAN CLIPPING, in the inline axis, always. Slate's Live
 *    panel is `absolute` inside a fixed canvas and simply overflows; T16's family
 *    ("hide their scrollbars while remaining scrollable") is the other half of the same
 *    habit. spec §2.4 governs: a scroll region has an explicit floor and a stated
 *    overflow, and hiding the scrollbar is banned. The floor is the sum of the track
 *    minimums; the overflow is `auto`. NO BLOCK FLOOR IS DECLARED — that is C2's
 *    unmeasured number and it is not this component's to invent.
 *
 * =========================================================================
 * WHAT IS DELIBERATELY NOT HERE
 * =========================================================================
 *   - NO SELECTION TREATMENT OF ANY KIND. The row's `dependsOn` is `tokens, #27` — not
 *     #3 and not the dials — and no variant of it selects: the A/B affordance on the
 *     shot list is #45's pick disc, slotted into a cell by the screen. `selectionSurface`
 *     is not imported, and the suite runs the dial drill as a NEGATIVE: all four dials
 *     retargeted, every selection spelling set on every element in the shadow tree, and
 *     not one rendered value may move. Part 10 §12's wave law is that no component in
 *     this wave may own a private "selected" look; a non-selectable one participates by
 *     being provably inert.
 *   - NO DERIVED-LIST VARIANT (D1). See the disqualification check.
 *   - NO STORE, NO ROUTE, NO KEY STRING. Gate 2's line is that a compound reads server
 *     data through `src/data/`, and this one reads no server data at all: the screen
 *     hands it rows. The single import from the data layer is `isNoReading` — the
 *     address layer's own absence predicate — so that an absence renders as the dash and
 *     NEVER as a computed number. There is no `?? compute` anywhere below (A7).
 *   - NO LIMITS OR RANGES OF ANY KIND (B2/R2). A table displays; it does not bound.
 *   - NO `@media`. Container queries only, and in fact no size query at all: the tracks
 *     are the responsive mechanism (CONVENTIONS §2).
 *   - NO STICKY HEADER ROW. Slate solves the long-list case structurally, by putting
 *     `.hv-shot-head` outside the scrolling `<ol>` (index.html:617-619), and a screen can
 *     do the same here with two instances that share one `columns` array — with no
 *     row-header column every track is `fr`, so the two align exactly. Deferred question,
 *     three declarations to reverse.
 *   - NO `part()` surface. Theming crosses the boundary through custom properties only
 *     (Part 4 ground rule 1; A6).
 *
 * ACCESSIBILITY
 *   `role="table"` / `rowgroup` / `row` / `columnheader` / `rowheader` / `cell`, built as
 *   a tree and asserted from Chrome's accessibility tree. The accessible name is
 *   `label`, and it lands on the roled element — never on a role-less `<div>`, which is
 *   the first clause of L23. `column.unit` is part of its header's accessible name, so a
 *   screen reader announcing a cell says "Weight g"; `text-transform` is paint, so the
 *   name keeps the case the author wrote — measured, with one caveat recorded in the
 *   suite: Chrome computes an accessible NAME from rendered text, so a microcap header
 *   whose markup says "Weight" is named "WEIGHT". That is Slate's behaviour too (both of
 *   its header kinds are uppercased by CSS), so it is neither a regression nor this row's
 *   to fix.
 *   The corner is a `columnheader` like the others, carrying `row-header-label`, because
 *   a `table` may not have a role-less child and a header row with three treatments in it
 *   would be the decay this component exists to end — Slate's `.sx-data-corner` is
 *   exactly that role-less child, and it is empty (`history-viewer.js:811`,
 *   `cell('sx-data-corner', '')`), so the label above the row-header column had nowhere
 *   to be said. Appendix 15 is not cited by this row and
 *   correctly so: it is the aria-driven STATE selector contract for `.slate-bank` /
 *   `.slate-stepper`, and this component has no state a user can change.
 *
 * API
 *   <ui-data-grid label="Shot data by phase"></ui-data-grid>
 *     .columns = [{ key: 'time', label: 'Time', unit: 's' },
 *                 { key: 'weight', label: 'Weight', unit: 'g', align: 'end' },
 *                 { key: 'volume', label: 'Volume', unit: 'mL', ink: 'var(--ui-channel-volume)' }]
 *     .rows    = [{ key: 'preinfusion', header: 'Preinfusion', cells: { time: 15, weight: 10 } },
 *                 { key: 'total', header: 'Total', cells: {…}, emphasis: true }]
 *
 *   A cell value may be a number, a string, `null`/`undefined`, or an absence from
 *   `src/data/reading.js`. The last three render `dash` ("—" by default). Nothing else
 *   happens to an absence: no substitute, no zero, no recomputation.
 *   `row-header-label` names the corner; omit it for a list with no row-header column.
 *   A column marked `slot: true` renders `<slot name="cell-<rowKey>-<colKey>">` instead
 *   of text, which is how the shot-list variant gets its A/B pick discs into a cell:
 *     <ui-pick-disc interactive form="pick" slot="cell-shot-42-ab">…</ui-pick-disc>
 *   `<slot name="empty">` shows under the header when `rows` is empty — the home for #38.
 */

/* `lit` is the vendored bundle and the importmap maps the BARE specifier only —
 * index.html:28 is "lit": "./vendor/lit.js" with no "lit/" prefix entry — so
 * `lit/directives/style-map.js` does not resolve here and `styleMap` is not among
 * vendor/lit.js's exports (grepped: zero hits). The two values that come from data are
 * therefore written as single-expression attribute bindings, which Lit sets with
 * setAttribute; `nothing` on such a binding REMOVES the attribute, so a column with no
 * ink carries no style attribute at all rather than an empty one. Both values are
 * validated before they get here — `tracks` is built from finite numbers, `ink` must
 * match INK_REFERENCE. */
import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { isNoReading } from 'src/data/reading.js';

/** The two alignments a column may take. Anything else falls back to `start`, the way
 *  base.js falls back for an unrecognised focus-ring value: a wrong alignment is
 *  cosmetic, an empty one would be a rendering with no text-align at all. */
export const DATA_GRID_ALIGNMENTS = Object.freeze(['start', 'end']);
export const DEFAULT_DATA_GRID_ALIGNMENT = 'start';

/** The absent mark. Same default as `src/stores/units.js`'s NO_READING_MARK and as
 *  #33's, kept as a property rather than an import so the component stays store-free. */
export const DEFAULT_DATA_GRID_DASH = '—';

/**
 * A column's `ink` must be a reference to a public token and nothing else.
 *
 * This is the "tokens in, nothing out" rule (CONVENTIONS §7) enforced at the data
 * boundary rather than trusted: the value is written into a custom property on the
 * cells, so without this an arbitrary string from a screen would become authored CSS
 * that no guard scans. `--ui-channel-*` (styles/chart-channels.css) is what it exists
 * for — Slate paints the same four columns with the trace colours and says why:
 * "Channel ink, matching the traces and the Live panel exactly" (slate-live.css:1950).
 */
const INK_REFERENCE = /^var\(\s*--ui-[a-z0-9-]+\s*\)$/;

export class UiDataGrid extends UiElement {
    static properties = {
        /**
         * PUT EACH COLUMN'S UNIT ON ITS OWN LINE, WITHOUT BRACKETS.
         *
         * Off by default, because Slate's form is "TIME (s)" on one line and every caller
         * but one still draws it. The Live band's phase table asks for it: measured on Ben's
         * tablet, the bracketed form needs 495 px in a track that gives it 365, so every
         * header was ellipsised to a stub. The stacked form needs 409. See the
         * `:host([stacked-units])` rule for the whole argument.
         */
        stackedUnits: { type: Boolean, attribute: 'stacked-units', reflect: true },

        /**
         * `[{ key, label, unit?, align?, grow?, ink?, slot? }]`. `key` indexes
         * `row.cells`; `grow` is the track's `fr` weight (default 1; 0 keeps the floor) — spec §4.5's
         * "become `fr`"; `ink` must be a `var(--ui-*)` reference or it is ignored;
         * `slot: true` makes the column hold slotted controls instead of text.
         */
        columns: { type: Array },

        /**
         * `[{ key, header?, cells: { [colKey]: value }, emphasis? }]`. A row with no
         * `header` still occupies the row-header track when the table has one, so the
         * columns cannot slip by a track.
         */
        rows: { type: Array },

        /** The table's accessible name. Lands on the roled element, never on a div. */
        label: { type: String },

        /** The corner cell's text. Its presence is what gives the table a row-header
         *  column at all, so a shot list simply omits it. */
        rowHeaderLabel: { type: String, attribute: 'row-header-label' },

        /** The one absent mark. A string, so a screen that has imported `units.js` can
         *  pass NO_READING_MARK and there is still exactly one mark on the page. */
        dash: { type: String },
    };

    /* STRUCTURAL FRAGMENTS FIRST (CONVENTIONS §4 rule 1). `selectionSurface` is not in
     * this list at all — see WHAT IS DELIBERATELY NOT HERE. `seams` is not either: this
     * component is not a seam grid, it is a seam CELL, and it paints its own ground. */
    static styles = [typeRoles, css`
        /* THE FRAME IS THE SCROLL REGION AND THE GROUND.
         *
         * Departure 7. spec §2.4: an explicit floor and a stated overflow, and hiding
         * the scrollbar is banned (bug T16 is the habit). The floor is the sum of the
         * track minimums below — a real floor, expressed once, in the tracks themselves
         * rather than as a fourth hand-derived px constant (bug L20's family).
         * NO BLOCK FLOOR: C2's five-phase measurement was never taken and SCOPE.md:1922
         * says so in as many words, so the band's minimum is the screen's to fill in.
         *
         * OPAQUE, AND THAT IS STRUCTURAL. CONVENTIONS §13 trap 1: "a cell that paints
         * nothing is a hole" — the ground of a seam grid shows through anything
         * unpainted. --ui-fascia is Slate's own choice here and the oracle's measured
         * value in both themes.
         *
         * max-block-size: 100% IS THE HALF THAT MAKES THE BLOCK AXIS SCROLL AT ALL, and
         * it is deliberately a MAXIMUM and not a height. A percentage maximum against an
         * auto-height parent computes to none, so a grid dropped into ordinary flow is
         * simply as tall as its rows; the moment a screen puts it in a definite track —
         * History's data page is grid-rows auto auto minmax(0,1fr) with "the list
         * scrolls" (§4.5) — the frame stops at the track and scrolls inside it. One
         * declaration, both cases, and NO min-block-size anywhere: that number is C2's
         * and it has never been measured.
         *
         * overflow: auto MAKES THIS A CLIPPING ANCESTOR, which is bug L24's mechanism
         * ("focus rings clipped on all four sides by the components they sit inside").
         * The documented one-line answer (CONVENTIONS §3) is to switch the subtree to
         * the inset offset, so a control a screen slots into a cell keeps a whole ring. */
        .frame {
            max-block-size: 100%;
            overflow: auto;
            background-color: var(--ui-fascia);
            --_ui-focus-offset: var(--ui-focus-offset-inset);
        }

        /* THE TABLE IS THE ONE GRID.
         *
         * Rows and rowgroups are display: contents, so every cell in the table is an item
         * of THIS grid and the columns line up by construction rather than by seven
         * hand-matched templates (L20). The roles survive: display: contents removes the
         * box, not the element, and the suite reads the accessibility tree to prove it.
         *
         * The track list is data, so it arrives in a custom property rather than as an
         * inline grid-template-columns — the declaration stays here, in authored CSS the
         * guards scan, and only the value comes from outside.
         *
         * GAPS ARE THE MEASURED ONES. slate-live.css:1899-1904, read read-only:
         *   .sx-data-grid { column-gap: var(--slate-space-5); row-gap: var(--slate-space-3);
         *                   align-content: start; }
         *
         * align-items: baseline is what makes a row read as a row: the row header is a
         * 15px microcap and its cells are 17px, and a baseline group per grid row sits
         * them on one line. Slate reaches for align-self: center on the row label
         * (slate-live.css:1932) because it has no row to align within. */
        .table {
            display: grid;
            grid-template-columns: var(--_ui-data-grid-tracks);
            align-content: start;
            align-items: baseline;
            column-gap: var(--ui-space-5);
            row-gap: var(--ui-space-3);

            /* spec §4.5's other option: "a ch measure" (no backticks inside a css
             * template — CONVENTIONS §9). These two ARE the component's
             * inline floor, and they are relative to the type rather than to a canvas —
             * 210px was measured against a 1920 layout that no longer exists. */
            --_ui-data-grid-label-min: 8ch;
            --_ui-data-grid-col-min: 5ch;
        }

        .rowgroup,
        .row {
            display: contents;
        }

        /* THE HEADER RULE — departure 2. One element spanning every track, --ui-seam
         * tall, in --ui-line: a gap over a ground, drawn once (CONVENTIONS §13), rather
         * than a border-bottom per header cell that cannot cross a 24px gutter.
         * aria-hidden AND role=presentation: a table's children are rows and rowgroups,
         * so this must not be one of them in the accessibility tree. */
        .rule {
            grid-column: 1 / -1;
            align-self: center;
            block-size: var(--ui-seam);
            background-color: var(--ui-line);
        }

        /* THE UNIT ON ITS OWN LINE, WHEN THE CALLER ASKS (Ben, 30 August 2026).
         *
         * MEASURED ON HIS TABLET, NOT GUESSED. The Live band's phase table renders in a
         * minmax(0, 1fr) track — it takes whatever the other three blocks leave — and at
         * the tablet's own type scale the four headers with their bracketed units need 495
         * px against the 365 it was getting. Every header was ellipsised to a stub: TI…(s),
         * W…(g), V…(m. Narrowing the other three blocks as far as they will go recovers
         * about 67, which is not 130.
         *
         * SO THE UNIT GIVES A LINE RATHER THAN THE LABEL GIVING ITS LETTERS. The same table
         * needs 409 stacked — inside the budget with room. It is the one change that makes
         * the arithmetic close, and it is opt-in because Slate's own form is the bracketed
         * one and every other caller still draws it.
         *
         * THE BRACKETS GO WITH THE LINE BREAK. "(s)" under "TIME" reads as a parenthetical
         * inside a heading that is not there; "s" under "TIME" reads as the unit of the
         * column. The rule this file already states — a truncated unit is a DIFFERENT unit
         * — is untouched: nothing here shrinks or clips it. */
        :host([stacked-units]) .col {
            flex-direction: column;
            align-items: flex-start;
            gap: 0;
        }
        :host([stacked-units]) .col.align-end { align-items: flex-end; }

        /* THE COLUMN HEADER. .ui-microcap carries ink, weight, tracking and the
         * uppercase; only the SIZE is overridden, to --ui-text-2xs, whose own comment in
         * the token sheet reads "column headers, units" (styles/tokens.css:351).
         * TYPE_ROLES.md rule 2 is the licence: pick the role by what the text is, then
         * override the size if a screen genuinely needs a different one.
         * gap: departure 6 — Slate's off-scale 6px snaps to --ui-space-1. */
        .col {
            display: flex;
            align-items: baseline;
            gap: var(--ui-space-1);
            min-inline-size: 0;
            font-size: var(--ui-text-2xs);
        }

        /* THE UNIT, with Slate's own reason kept (slate-live.css:1334-1336): "regular
         * weight, no tracking, not uppercased … mL is a unit, and ML is a different
         * one." The role would uppercase and track it, so all three are reset here.
         * It never shrinks: the label gives first, always — a truncated unit is a
         * different unit, which is the same argument as the sentence above. */
        .unit {
            flex: 0 0 auto;
            font-weight: var(--ui-weight-regular);
            letter-spacing: normal;
            text-transform: none;
        }

        /* THE LABEL inside a header cell is the half that ellipsises. */
        .col-label {
            min-inline-size: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* THE ROW HEADER is the shared role at its own size — departure 4. */
        .rowhead {
            min-inline-size: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* THE CELL. --ui-text-base and the one family, both measured; .ui-numeric adds
         * tabular figures so a column of numbers lines up and a changing readout does not
         * jitter (bug L10 is a value that was left OUT of Slate's tabular-nums list).
         * padding-block is departure 5: the row's height is a derivation, not 34px.
         * The column's ink arrives as a custom property and defaults to --ui-text, so a
         * column that
         * names no channel is exactly Slate's measured cell. */
        .cell {
            min-inline-size: 0;
            padding-block: var(--ui-space-1);
            overflow: hidden;
            color: var(--_ui-data-grid-ink, var(--ui-text));
            font-size: var(--ui-text-base);

            /* SLATE'S OWN 300, since parity surface 1 restored --ui-weight-light. This
             * read --ui-weight-regular while the sheet carried three weights; Slate's
             * cells are the light numeric-readout role and render 300 on Live and on
             * the HV page alike. See EMPHASIS below for what that does to departure 3. */
            font-weight: var(--ui-weight-light);
            line-height: 1.5;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* ALIGNMENT IS THE COLUMN'S, AND IT REACHES BOTH ENDS OF IT. Slate states it
         * twice and only for the shot list — ".hv-shot-head .hv-col-dur, .hv-shot-head
         * .hv-col-yield { text-align: right }" beside .hv-col-dur's own rule
         * (slate-live.css:2462-2464) — with its reason: "Numbers right-aligned under
         * right-aligned headers, so two shots' figures can be read down the column
         * instead of hunted for." One flag here, applied to the header and the cells
         * together, is that reason made unbreakable. */
        .align-end {
            justify-content: flex-end;
            text-align: end;
        }

        /* A CONTROL COLUMN. The shot list's last column is the A/B assignment — "Every
         * row carries an A and a B button, because which two shots is the only question
         * this page exists to answer" (history-viewer.js:840-843) — so one column may
         * hold slotted controls instead of text. The cell becomes a flex line so that a
         * pair of #45 pick discs sits on it, and it drops the ellipsis and the nowrap,
         * which belong to text. The control brings its own hit area (CONVENTIONS §5)
         * and takes the one focus ring through the base's ::slotted rule, at the INSET
         * offset the frame carries — custom properties inherit down the FLAT tree, so a
         * slotted control inherits the frame's --_ui-focus-offset and its ring is drawn
         * inside the scrollport rather than clipped by it (bug L24). */
        .cell-slot {
            display: flex;
            align-items: center;
            gap: var(--ui-space-2);
            overflow: visible;
            white-space: normal;
        }

        .align-end.cell-slot {
            justify-content: flex-end;
        }

        /* EMPHASIS — the row treatment that was dead on Live and one step on the HV
         * page. Ink on the header, weight on the cells. Classes, never ids: an id is
         * (1,0,0) and would outrank every state rule in the file (CONVENTIONS §4 rule 2).
         *
         * IT IS NO LONGER A DEPARTURE. While the sheet had three weights, the base cell
         * was forced to 400 and the emphasis had to jump to 500 to stay visible; with
         * --ui-weight-light restored the pair is 300 -> 400, which is EXACTLY the HV
         * page's own step (its total row is authored font-weight: 400 over a 300 base,
         * slate-live.css:1947-1948). Live's dead 300/300 stays dead — that is bug L20,
         * and this component is the one treatment for both pages. */
        .rowhead.is-emphasis {
            color: var(--ui-text);
        }

        .cell.is-emphasis {
            font-weight: var(--ui-weight-regular);
        }

        /* THE EMPTY REGION sits OUTSIDE the table, because a table's children are rows
         * and rowgroups and a slot is neither. Slate switches its grid to display: block
         * for the same reason (slate-live.css:1905). #38 is what goes in here. */
        .empty {
            padding-block: var(--ui-space-5);
        }
    `];

    constructor() {
        super();
        this.columns = [];
        this.stackedUnits = false;
        this.rows = [];
        this.label = '';
        this.rowHeaderLabel = '';
        this.dash = DEFAULT_DATA_GRID_DASH;
    }

    /** True when the table carries a row-header column. Naming the corner is what asks
     *  for it: a shot list omits `row-header-label` and gets `fr` tracks only. */
    get hasRowHeader() {
        return typeof this.rowHeaderLabel === 'string' && this.rowHeaderLabel !== '';
    }

    /** The columns, normalised once per render so the template and the track list can
     *  never disagree about how many there are. */
    get normalisedColumns() {
        return (Array.isArray(this.columns) ? this.columns : [])
            .filter((column) => column && typeof column === 'object')
            .map((column, index) => ({
                key: column.key ?? String(index),
                label: column.label ?? '',
                unit: column.unit ?? '',
                align: DATA_GRID_ALIGNMENTS.includes(column.align)
                    ? column.align
                    : DEFAULT_DATA_GRID_ALIGNMENT,
                /* ZERO IS A LEGITIMATE WEIGHT AND USED TO BE COERCED AWAY (parity
                 * 7-live-polish). `0fr` is "keep your floor and give the slack to the
                 * container", which is exactly what Slate's Live band does with its
                 * phase table: ORACLE live-ready #shot-data-panel [i=126] is 1018px
                 * wide and the three value columns inside it are 80 / 88 / 94, so the
                 * table sits at the left of a wide panel with the derived list beside
                 * it rather than three columns 340px apart. The guard read `> 0`, so a
                 * caller asking for 0 silently got 1 — the one value where the coercion
                 * changes the layout instead of rejecting nonsense. Negative and
                 * non-finite still fall back to 1. */
                grow: Number.isFinite(column.grow) && column.grow >= 0 ? column.grow : 1,
                ink: INK_REFERENCE.test(String(column.ink ?? '')) ? String(column.ink) : '',
                slot: column.slot === true,
            }));
    }

    /**
     * The one track list — spec §4.5. The row-label track is `max-content` over a `ch`
     * floor; every value track is `<grow>fr` over a `ch` floor. Nothing here is a pixel,
     * which is the whole of the row's third sentence.
     */
    trackList(columns) {
        /* A ZERO WEIGHT IS CONTENT-SIZED, NOT FLOOR-SIZED. `0fr` resolves to the track's
         * base size — the `ch` floor — which is narrower than the column's own header,
         * so the three headings clipped to "TI… (s)". What a caller asking for 0 means
         * is "size to your content and leave the slack to the container", and that is
         * `max-content` over the same floor. Measured against Slate's own band, which
         * is where the ask came from: ORACLE live-ready #shot-data-pi-time [i=134] w=80,
         * -weight [i=135] w=88, -volume [i=136] w=94 — each column as wide as its
         * heading needs and no wider. */
        const value = columns
            .map((column) => (column.grow === 0
                ? 'minmax(var(--_ui-data-grid-col-min), max-content)'
                : `minmax(var(--_ui-data-grid-col-min), ${column.grow}fr)`));
        const all = this.hasRowHeader
            ? ['minmax(var(--_ui-data-grid-label-min), max-content)', ...value]
            : value;
        /* A grid with no columns at all is a consumer error, not a rendering: `none` is
         * the initial value and says so, where an empty custom property would make the
         * whole declaration invalid at computed-value time and reach the same place by
         * accident. */
        return all.length ? all.join(' ') : 'none';
    }

    /**
     * A cell's text. THE WHOLE OF A7 IS IN THIS FUNCTION: an absence becomes the dash and
     * nothing else ever happens to it — no substitute, no zero, no locally recomputed
     * value. `isNoReading` is the address layer's own predicate (`src/data/reading.js`),
     * so the skin has one definition of "absent" rather than a second one here.
     */
    cellText(value) {
        if (value === null || value === undefined || value === '') return this.dash;
        if (isNoReading(value)) return this.dash;
        return String(value);
    }

    renderHeadRow(columns) {
        return html`
            <div class="row" role="row">
                ${this.hasRowHeader
                    ? html`<div id="corner" class="col ui-microcap" role="columnheader">
                        <span class="col-label">${this.rowHeaderLabel}</span></div>`
                    : nothing}
                ${columns.map((column) => html`
                    <div id="col-${column.key}"
                         class="col ui-microcap ${column.align === 'end' ? 'align-end' : ''}"
                         role="columnheader">
                        <span class="col-label">${column.label}</span>
                        ${column.unit
                            ? html`<span id="unit-${column.key}" class="unit"
                                >${this.stackedUnits ? column.unit : `(${column.unit})`}</span>`
                            : nothing}
                    </div>`)}
            </div>`;
    }

    renderBodyRow(row, columns, index) {
        const key = row.key ?? String(index);
        const emphasis = row.emphasis === true;
        const cells = row.cells && typeof row.cells === 'object' ? row.cells : {};
        return html`
            <div id="row-${key}" class="row" role="row">
                ${this.hasRowHeader
                    ? html`<div id="rowhead-${key}"
                                class="rowhead ui-microcap ${emphasis ? 'is-emphasis' : ''}"
                                role="rowheader">${row.header ?? ''}</div>`
                    : nothing}
                ${columns.map((column) => html`
                    <div id="cell-${key}-${column.key}"
                         class="cell ${column.slot ? 'cell-slot' : 'ui-numeric'} ${emphasis ? 'is-emphasis' : ''} ${column.align === 'end' ? 'align-end' : ''}"
                         style=${column.ink ? `--_ui-data-grid-ink: ${column.ink}` : nothing}
                         role="cell">${column.slot
                            ? html`<slot name="cell-${key}-${column.key}"></slot>`
                            : this.cellText(cells[column.key])}</div>`)}
            </div>`;
    }

    render() {
        const columns = this.normalisedColumns;
        const rows = Array.isArray(this.rows) ? this.rows : [];
        const tracks = this.trackList(columns);
        return html`
            <div id="frame" class="frame">
                <div id="table" class="table"
                     role="table"
                     aria-label=${this.label || nothing}
                     style="--_ui-data-grid-tracks: ${tracks}">
                    <div id="head" class="rowgroup" role="rowgroup">
                        ${this.renderHeadRow(columns)}
                    </div>
                    <div id="rule" class="rule" role="presentation" aria-hidden="true"></div>
                    ${rows.length
                        ? html`<div id="body" class="rowgroup" role="rowgroup">
                            ${rows.map((row, index) => this.renderBodyRow(row, columns, index))}
                        </div>`
                        : nothing}
                </div>
                ${rows.length
                    ? nothing
                    : html`<div id="empty" class="empty"><slot name="empty"></slot></div>`}
            </div>`;
    }
}

customElements.define('ui-data-grid', UiDataGrid);
