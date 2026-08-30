/**
 * ui-data-grid.demo.js — the gallery's loader for the DATA GRID (wave 4, item #34).
 *
 * WHY A DEMO MODULE AND NOT `module: '../../../src/components/ui-data-grid.js'`.
 * One mechanical reason, the same one `ui-chart-card.demo.js` records: gallery.js does
 * exactly one `import(entry.module)` per entry and a state's markup is a STRING assigned
 * to `stageHost.innerHTML` (gallery.js:46-51, :81), so there is no hook in which to hand
 * the grid its `columns` and `rows`. They are properties, deliberately — a table whose
 * data arrived as a JSON attribute would be a table that re-parses its own contents on
 * every keystroke of a live shot — so a bare `<ui-data-grid>` in a state would photograph
 * as its empty state. Which IS a state, and has its own entry below; it is just not the
 * one anybody wants to look at first.
 *
 * THE SUBJECT IS THE SHIPPING COMPONENT. Each element here adds ONE thing to
 * `UiDataGrid` — a constructor that sets the two data properties — and overrides nothing
 * that paints, nothing that measures and nothing that renders. The three shapes are the
 * three the row names: SCOPE.md:1697, "Phase table and shot list → #34 data grid
 * variants", plus the empty case. The derived list is the fourth and is deliberately
 * absent (D1).
 *
 * THE NUMBERS ARE SLATE'S OWN, taken from its markup so the picture is comparable with
 * the old screen rather than invented: index.html:359-400 ships the phase table with
 * Time / Weight / Volume over Preinfusion / Extraction / Total, and the shot list's
 * columns are "Date, time, profile, shot length, yield, and the A/B assignment"
 * (slate-live.css:2441-2443).
 */

import { UiDataGrid } from '../../../src/components/ui-data-grid.js';
/* The `empty` state slots #38 into the grid's own empty region, and gallery.js does one
 * import per entry — without this the tag stays an unknown element and photographs as
 * bare text (the same reason ui-chart-legend.demo.js imports the card). */
import '../../../src/components/ui-empty-state.js';

/** Live's shot-data panel and the History data page: a row-header column, three
 *  channels, and the Total row emphasised. The volume column carries channel ink —
 *  "Channel ink, matching the traces and the Live panel exactly" (slate-live.css:1950). */
class UiDataGridPhase extends UiDataGrid {
    constructor() {
        super();
        this.label = 'Shot data by phase';
        this.rowHeaderLabel = 'Phase';
        this.columns = [
            { key: 'time', label: 'Time', unit: 's' },
            { key: 'weight', label: 'Weight', unit: 'g', align: 'end' },
            { key: 'volume', label: 'Volume', unit: 'mL', ink: 'var(--ui-channel-volume)' },
        ];
        this.rows = [
            { key: 'preinfusion', header: 'Preinfusion', cells: { time: 15, weight: 10, volume: 17 } },
            { key: 'extraction', header: 'Extraction', cells: { time: 30, weight: 29, volume: 30 } },
            { key: 'total', header: 'Total', emphasis: true, cells: { time: 45, weight: 39, volume: 57 } },
        ];
    }
}

/** The same table on a shot that never left preinfusion — the case Slate's own comment
 *  describes at history-viewer.js:827-830: "Total has no per-channel ranges and
 *  Extraction can be absent on a shot that never left preinfusion. An em dash says 'not
 *  applicable here'; an empty cell says 'we forgot'." Nothing is computed to fill them. */
class UiDataGridAbsent extends UiDataGridPhase {
    constructor() {
        super();
        this.rows = [
            { key: 'preinfusion', header: 'Preinfusion', cells: { time: 15, weight: 10, volume: 17 } },
            { key: 'extraction', header: 'Extraction', cells: {} },
            {
                key: 'total',
                header: 'Total',
                emphasis: true,
                cells: { time: 15, weight: 10, volume: { noReading: true, reason: 'permanent' } },
            },
        ];
    }
}

/** The History shot list: no row-header column, a wide profile track, right-aligned
 *  outcome columns and a control column for the A/B assignment. */
class UiDataGridList extends UiDataGrid {
    constructor() {
        super();
        this.label = 'Stored shots';
        this.columns = [
            { key: 'date', label: 'Date' },
            { key: 'time', label: 'Time' },
            { key: 'name', label: 'Profile', grow: 3 },
            { key: 'length', label: 'Length', unit: 's', align: 'end' },
            { key: 'yield', label: 'Yield', unit: 'g', align: 'end' },
            { key: 'ab', label: 'A / B', slot: true, align: 'end' },
        ];
        this.rows = [
            ['s1', '17 Aug', '08:12', 'Londinium classic', '31', '36.4'],
            ['s2', '17 Aug', '07:40', 'Blooming allongé', '44', '52.1'],
            ['s3', '16 Aug', '16:05', 'Turbo bomb', '18', '40.0'],
            ['s4', '16 Aug', '09:22', 'Lever, long PI', '38', '35.8'],
            ['s5', '15 Aug', '08:03', 'Londinium classic', '30', '36.0'],
            ['s6', '14 Aug', '17:44', 'Adaptive pressure ramp with a very long name', '35', '37.2'],
        ].map(([key, date, time, name, length, yieldG]) => ({
            key,
            cells: { date, time, name, length, yield: yieldG },
        }));
    }
}

/** The same columns with nothing in them. A table with no rows is still a table with
 *  columns, so the header and its rule stay; the space below is the #38 slot. */
class UiDataGridEmpty extends UiDataGridPhase {
    constructor() {
        super();
        this.label = 'Shot data by phase, empty';
        this.rows = [];
    }
}

customElements.define('ui-data-grid-phase', UiDataGridPhase);
customElements.define('ui-data-grid-empty', UiDataGridEmpty);
customElements.define('ui-data-grid-absent', UiDataGridAbsent);
customElements.define('ui-data-grid-list', UiDataGridList);
