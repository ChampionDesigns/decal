/**
 * <ui-data-grid> — one tabular component: a header row, optional row headers, and cells laid out on a single grid.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { isNoReading } from 'src/data/reading.js';

export const DATA_GRID_ALIGNMENTS = Object.freeze(['start', 'end']);
export const DEFAULT_DATA_GRID_ALIGNMENT = 'start';

export const DEFAULT_DATA_GRID_DASH = '—';

/* A column's ink must be a reference to a public token and nothing else. */
const INK_REFERENCE = /^var\(\s*--ui-[a-z0-9-]+\s*\)$/;

export class UiDataGrid extends UiElement {
    static properties = {
        /* Put each column's unit on its own line, without brackets. */
        stackedUnits: { type: Boolean, attribute: 'stacked-units', reflect: true },

        /* [{ key, label, unit?, align?, grow?, ink?, slot? }]. key indexes row.cells; grow
           is the track's fr weight, and 0 keeps the floor. */
        columns: { type: Array },

        /* [{ key, header?, cells, emphasis? }]. A row with no header still occupies the
           row-header track when the table has one. */
        rows: { type: Array },

        /* The table's accessible name. */
        label: { type: String },

        /* The corner cell's text. Its presence is what gives the table a row-header column
           at all. */
        rowHeaderLabel: { type: String, attribute: 'row-header-label' },

        /* The mark drawn for an absent cell. */
        dash: { type: String },
    };

    static styles = [typeRoles, css`
        .frame {
            max-block-size: 100%;
            overflow: auto;
            background-color: var(--ui-fascia);
            --_ui-focus-offset: var(--ui-focus-offset-inset);
        }

        .table {
            display: grid;
            grid-template-columns: var(--_ui-data-grid-tracks);
            align-content: start;
            align-items: baseline;
            column-gap: var(--ui-space-5);
            row-gap: var(--ui-space-3);

            /* Rows and rowgroups are display: contents, so every cell is an item of this one
               grid. */
            --_ui-data-grid-label-min: 8ch;
            --_ui-data-grid-col-min: 5ch;
        }

        .rowgroup,
        .row {
            display: contents;
        }

        .rule {
            grid-column: 1 / -1;
            align-self: center;
            block-size: var(--ui-seam);
            background-color: var(--ui-line);
        }

        :host([stacked-units]) .col {
            flex-direction: column;
            align-items: flex-start;
            gap: 0;
        }
        :host([stacked-units]) .col.align-end { align-items: flex-end; }

        .col {
            display: flex;
            align-items: baseline;
            gap: var(--ui-space-1);
            min-inline-size: 0;
            font-size: var(--ui-text-2xs);
        }

        .unit {
            flex: 0 0 auto;
            font-weight: var(--ui-weight-regular);
            letter-spacing: normal;
            text-transform: none;
        }

        /* The unit never shrinks — the label gives first, because a truncated unit is a
           different unit. */
        .col-label {
            min-inline-size: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .rowhead {
            min-inline-size: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .cell {
            min-inline-size: 0;
            padding-block: var(--ui-space-1);
            overflow: hidden;
            color: var(--_ui-data-grid-ink, var(--ui-text));
            font-size: var(--ui-text-base);

            font-weight: var(--ui-weight-light);
            line-height: 1.5;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .align-end {
            justify-content: flex-end;
            text-align: end;
        }

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

        .rowhead.is-emphasis {
            color: var(--ui-text);
        }

        .cell.is-emphasis {
            font-weight: var(--ui-weight-regular);
        }

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

    get hasRowHeader() {
        return typeof this.rowHeaderLabel === 'string' && this.rowHeaderLabel !== '';
    }

    /* The empty region sits outside the table: a table's children are rows and
       rowgroups, and a slot is neither. */
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
                /* True when the table carries a row-header column. */
                grow: Number.isFinite(column.grow) && column.grow >= 0 ? column.grow : 1,
                ink: INK_REFERENCE.test(String(column.ink ?? '')) ? String(column.ink) : '',
                slot: column.slot === true,
            }));
    }

    trackList(columns) {
        /* Zero is a legitimate weight: 0fr means "keep your floor and give the slack to the
           others". */
        const value = columns
            .map((column) => (column.grow === 0
                ? 'minmax(var(--_ui-data-grid-col-min), max-content)'
                : `minmax(var(--_ui-data-grid-col-min), ${column.grow}fr)`));
        const all = this.hasRowHeader
            ? ['minmax(var(--_ui-data-grid-label-min), max-content)', ...value]
            : value;
        /* The one track list: a max-content row-label track, then each value track at its
           weight in fr, all over a ch floor. */
        return all.length ? all.join(' ') : 'none';
    }

    /* A zero weight resolves to the track's base size, which is narrower than the
       column's own header. */
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
