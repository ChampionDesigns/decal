/**
 * The gallery's loader for the DATA GRID (.
 */

import { UiDataGrid } from '../../../src/components/ui-data-grid.js';
import '../../../src/components/ui-empty-state.js';

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
