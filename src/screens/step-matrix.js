/**
 * <step-matrix> — the profile editor's Steps grid.
 *
 * Rows are the step fields; columns are the steps. It renders a draft and reports
 * changes; it never writes one. Every cell is a library component.
 */

import { css, html, nothing, svg } from 'lit';

import { UiElement, focusRing, visuallyHidden } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import {
    STEP_MATRIX_ROWS,
    CELL_NAME_KEY,
    STEP_NAME_KEY,
    STEP_ORDINAL_KEY,
    HELD_TARGET_TEXT,
    bankOptionsFor,
    cellKindFor,
    fieldFor,
    matrixChannel,
    readValue,
    STEP_MATRIX_ROW_KEYS,
} from 'src/lib/step-matrix-rows.js';

import { LEVER_FEEL_WORD, PUMP_MODE_LABEL, inferLeverPreset } from 'src/lib/profile-modes.js';

/* Above this many steps the grid scrolls instead of filling the width. The two
   column widths below follow from it. */
const SLATE_FILL_MAX_STEPS = 4;

import { penIcon } from 'src/lib/icons.js';

import 'src/components/ui-stepper.js';
import 'src/components/ui-bank.js';
import 'src/components/ui-locked-value.js';
import 'src/components/ui-text-field.js';
import 'src/components/ui-exit-sentence.js';
import 'src/components/ui-action-key-rail.js';
/* The add door dispatches the same event as the per-step rail, so there is one
   writer. See #renderAdd. */
import { STEP_ACTION } from 'src/components/ui-action-key-rail.js';

/* Re-exported so a consumer of the matrix needs one import for the exit band. */
export { serializeExitSlots } from 'src/lib/exit-sentence.js';

/* Dispatched when a cell's value changes. */
export const STEP_CHANGE = 'step-change';

/* Dispatched when a value cell asks for the numpad. */
export const STEP_EDIT = 'step-edit';

/* The empty area's name, and its own i18n key. It names the outcome rather than
   the region: what a person gets, not where they are. */
export const ADD_STEP_KEY = 'Add a step';

/* The two densities. `compact` is the editor's. */
export const MATRIX_DENSITIES = Object.freeze(['regular', 'compact']);

export class StepMatrix extends UiElement {
    static properties = {
        /* The draft's steps, in the shape ReaPrime serves. Read, never written — the
           matrix reports a change and the owner applies it. */
        steps: { attribute: false },

        /* The ranges door, injected rather than imported: the limits are per-machine, so
           a module-level table would be a second source of them. */
        ranges: { attribute: false },

        /* `regular` or `compact`, reflected so one attribute is the state a screen and a
           test both read. */
        density: { type: String, reflect: true },

        /* The table's accessible name. A value, not an IDREF — the reference would have
           to cross a shadow root. */
        label: { type: String },

        /* Whether Power may be offered as a cross-variable exit. */
        powerExitOffered: { type: Boolean, attribute: 'power-exit-offered' },

        /* Whether HOLD is authorable on this machine. */
        holdOffered: { type: Boolean, attribute: 'hold-offered' },

        /* Whether the advanced Power and Lever modes are offered. */
        pumpModesOffered: { type: Boolean, attribute: 'pump-modes-offered' },

        /* Whether pressing a value cell opens the numpad. Off by default: a control that
           announces aria-haspopup="dialog" and opens nothing is worse than a plain
           readout, so the screen opts in only once it can answer. */
        editable: { type: Boolean },

        /* Which step's name is being typed, by index, or null. A name is a heading until
           it is pressed and a field while it is. */
        _editing: { state: true },
    };

    static styles = [typeRoles, seams, visuallyHidden, css`
        /* No backtick anywhere in this template, comments included: one ends the tagged
           template where it stands, and the file then fails to parse somewhere further
           down with no clue where. */
        :host(.seam-grid) {
            /* The rail is a fixed length, not fit-content: the row labels must not resize the
               grid as their text changes. */
            --_ui-rail-w: 192px;

            /* Two column widths: the wider one while the grid fills, the narrower once it
               scrolls. updated() picks between them. */
            --_ui-step-w-fill: 431px;
            --_ui-step-w-scroll: 372px;
            --_ui-step-w: var(--_ui-step-w-fill);

            /* The control width is constant in both modes — the column breathes around it,
               the control does not shrink. */
            --_ui-step-ctrl-w: 350px;

            /* A column can never be narrower than the control standing in it. */
            --_ui-step-min: calc(var(--_ui-step-ctrl-w) + 2 * var(--ui-space-3));

            --_ui-rail-min: var(--_ui-rail-w);
            --_ui-rail-cap: var(--_ui-step-min);

            /* A count, not a length. Declared here so the track list is valid before the
               first render writes the real number. */
            --_ui-step-count: 1;

            /* The row split, defaulting to the row table's own shape for the same reason. */
            --_ui-rows-before-exits: 8;
            --_ui-rows-after-exits: 1;

            /* The vertical rhythm, and the only thing compact re-declares. */
            --_ui-matrix-rhythm: var(--ui-space-3);

            /* The exit row carries three stacked slots, so it takes its own minimum rather
               than the cell floor. */
            /* The band's gap and the grid's rhythm are one number, so the chips inside the
               exit row are spaced like everything around them. */
            --_ui-exit-gap: calc(2 * var(--_ui-matrix-rhythm));
            --_ui-exit-row-min: calc(3 * var(--ui-control-h) + 2 * var(--_ui-exit-gap));

            /* The cell asks the track for the same number, and pays the rhythm on both of its
               own edges. */
            --_ui-exit-cell-min: calc(var(--_ui-exit-row-min) + 2 * var(--_ui-matrix-rhythm));

            /* The rail is fixed; the step columns are the chosen width; a trailing 1fr takes
               whatever is left. */
            /* Constants, not a formula. The reference implementation computes a layout
               elsewhere, but these two widths are fixed values in it. */
            grid-template-columns:
                var(--_ui-rail-w)
                repeat(var(--_ui-step-count), var(--_ui-step-w))
                minmax(0, 1fr);

            /* The fixed tracks pack to the start, so the slack falls to the right and the
               steps grow leftward from it. */
            justify-content: start;

            /* Rows are implicit and content-derived. There is no grid-template-rows anywhere
               in this file: a literal list would have to be kept in step with the row table. */
            /* Nine rows at their own height and one that grows. Both counts come from the row
               table, set on the host beside the step count. */
            grid-template-rows:
                repeat(var(--_ui-rows-before-exits), min-content)
                minmax(var(--_ui-exit-cell-min), 1fr)
                repeat(var(--_ui-rows-after-exits), min-content);

            /* The fallback until the first render writes the counts, and for a matrix mounted
               with no rows. */
            grid-auto-rows: minmax(min-content, auto);

            /* The exit row takes the slack, which is what puts the action rail at the bottom
               of the panel rather than under a band of empty grid. */
            align-content: stretch;

            /* Both axes stated. Never hidden or clip: a live scrollbar that cannot be seen is
               a row nobody can reach. */
            overflow: auto;

            /* The floor is the header row plus one step row. Below it the matrix scrolls
               rather than crushing a cell. */
            min-block-size: var(--ui-editor-matrix-min-h);

            /* As tall as its rows and never taller than its cell — the residual belongs to the
               exit row, not to a phantom row under the last one. */
            /* Nothing on the inline axis: the columns are 1fr, so the tracks always fill the
               region and no seam ground shows beside them. */

            /* No min-inline-size: 0 here, deliberately. A grid item whose overflow is not
               visible already has an automatic minimum of zero. */
        }

        /* The one thing compact re-declares: one step down the spacing ladder. The
           control caps come from the stepper's own density instead. */
        /* Compact and regular share a rhythm. That is a decision, not a leftover: the
           height is better spent on the rows than on the gaps between them. */
        :host(.seam-grid[density="compact"]) {
            --_ui-matrix-rhythm: calc((var(--ui-space-2) + var(--ui-space-3)) / 2);
        }

        /* Rows are display: contents, so the semantic row wraps its cells without
           becoming a box between the grid and them. */
        .row {
            display: contents;
        }

        /* The table is display: contents for the same reason. role="table" must not sit on
           the host: it would make every element inside it a table descendant. */
        .rows {
            display: contents;
        }

        .cell {
            display: flex;
            align-items: center;
            padding-block: var(--_ui-matrix-rhythm);
            padding-inline: var(--ui-space-3);

            /* No inline floor on the cell. With one, a cell could outgrow its column and the
               vertical rules stopped meeting the horizontal ones. */
        }

        /* Three horizontal rules and no more. They are backgrounds rather than borders so
           a rule never adds to the cell's height. */
        .cell.group-end {
            box-shadow: inset 0 calc(-1 * var(--ui-seam)) 0 0 var(--ui-line);
        }

        /* A group rule gets air on both sides, so the categories read as blocks rather
           than as lines. */
        .row.group-end > .cell {
            padding-block-end: calc(2 * var(--_ui-matrix-rhythm));
        }

        /* Except the head row, which keeps its rule without the extra space below it. */
        .row.group-end > .cell.head {
            padding-block-end: var(--_ui-matrix-rhythm);
        }

        .row.group-end + .row > .cell {
            padding-block-start: calc(2 * var(--_ui-matrix-rhythm));
        }

        /* One filler element paints the seam ground where the capped columns stop short
           of the region. */
        .filler {
            grid-column: -2 / -1;
            grid-row: 1 / -1;
            background-color: var(--ui-fascia);
        }

        /* The filler is also the add door when the matrix is editable: a press in the
           empty step area adds a step. */
        button.filler {
            /* A button is not a div: reset the ground the browser gives it so the one
               background-color above stays the only one. */
            appearance: none;
            border: 0;
            margin: 0;
            padding: 0;
            font: inherit;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;

            /* A floor, because the trailing track is minmax(0, 1fr) and would otherwise let
               this collapse. */
            min-inline-size: var(--ui-hit-min);
        }

        button.filler:focus-visible {
            ${focusRing}
            --_ui-focus-offset: var(--ui-focus-offset-inset);
        }

        /* With no steps there is no trailing track and no rows to span, so the door takes
           the whole grid and states its own floor. */
        button.filler.empty {
            grid-column: 1 / -1;
            grid-row: 1 / -1;
            min-block-size: var(--ui-editor-matrix-min-h);
        }

        .plus {
            display: block;
            flex: none;
            inline-size: var(--ui-icon);
            block-size: var(--ui-icon);
            color: var(--ui-steel);
        }

        /* The rail is a cell of the same grid and stays put while the step columns scroll
           under it. */
        .cell.rail {
            position: sticky;
            inset-inline-start: 0;
            z-index: 1;

            /* The rail's floor is here rather than in the track list: fit-content()'s own
               minimum is the item's contribution, which is not what this needs. */
            min-inline-size: var(--_ui-rail-min);

            /* Clip and ellipsis together: a longer translation of a row label must not paint
               over the first data cell. */
            overflow: hidden;

            /* The rail carries its own ground. It is sticky and the columns scroll under it,
               so a transparent rail would show them through. */
            background-color: var(--ui-bar);
        }

        /* The rail labels are small caps at the shared microcap size. */
        .rail-label {
            /* No colour here. The microcap role supplies it, and an override at this
               specificity would beat the role for every one of these cells. */
            min-inline-size: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .cell.head {
            flex-direction: column;
            align-items: stretch;
            justify-content: center;

            /* 64 tall with no gap: the ordinal sits beside the name rather than above it. */
            /* Taller than the reference's 64, because two lines of this type are taller than
               its three. */
            /* A minimum, not a height. box-sizing is border-box, and this cell is a group end
               that carries its own rule. */
            min-block-size: calc(var(--ui-control-h) + var(--ui-space-3));
            gap: 0;
        }

        /* The name line: ordinal, name, pencil. */
        /* The pencil does not set the line's height. It keeps its 48px hit target, but a
           48px item would otherwise make every head row that tall. */
        /* The name gets the stepper's width; only the pencil is reserved beside it. */
        .head-line {
            position: relative;
            padding-inline-end: var(--ui-icon);
            min-inline-size: 0;
        }

        .head-line > .name,
        .head-line > .name-display {
            inline-size: 100%;
            min-inline-size: 0;
        }

        .head-line > .step-pen {
            position: absolute;
            inset-inline-end: 0;
            inset-block-start: 50%;
            transform: translateY(-50%);

            /* No box, and the same mark the profile title uses. */
            --_ui-icon-btn-border: 0;
            --_ui-icon-btn-box: var(--ui-hit-min);
        }

        /* At rest the name is a heading and becomes a field only while it is typed. */
        .name-display {
            border: 0;
            padding: 0;
            background-color: transparent;
            color: var(--ui-text);
            font: inherit;

            /* The name is a heading and the type is not, so they must not read at one size. */
            /* 24 at weight 500, against the step type below it. */
            font-size: 24px;
            line-height: 1.2;
            font-weight: var(--ui-weight-medium);
            text-align: center;
            cursor: pointer;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .ordinal {
            color: var(--ui-text-2);
            font-weight: var(--ui-weight-regular);
            margin-inline-end: var(--ui-space-1);

            /* Three quarters of the title, in em so it tracks the name if that changes. */
            font-size: 0.75em;
        }

        /* The mode line is tinted by the pump the column is in, using the chart's own
           channel tokens so a mode reads the same here as it does on a trace. */
        .mode {
            font-size: var(--ui-text-sm);
            font-weight: var(--ui-weight-medium);
            letter-spacing: calc(var(--ui-tracking-cap) / 2);

            /* A ratio, not 1. At exactly 1 the line is the em box and the descenders clip. */
            line-height: 1.2;
            text-align: center;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .mode[data-tone="flow"] { color: var(--ui-channel-flow); }
        .mode[data-tone="pressure"] { color: var(--ui-channel-pressure); }
        .mode[data-tone="power"] { color: var(--ui-channel-power); }

        /* Lever takes a tint token rather than a channel token: a lever step draws no
           trace, so there is no channel for it. */
        .mode[data-tone="lever"] { color: var(--ui-tint-lever); }

        ui-stepper[data-channel="temperature"] {
            --_ui-stepper-number-ink: var(--ui-channel-target-group-temperature);
        }

        ui-stepper[data-channel="flow"] {
            --_ui-stepper-number-ink: var(--ui-channel-target-flow);
        }

        ui-stepper[data-channel="pressure"] {
            --_ui-stepper-number-ink: var(--ui-channel-target-pressure);
        }

        ui-stepper[data-channel="flow-limit"] {
            --_ui-stepper-number-ink: var(--ui-channel-flow);
        }

        ui-stepper[data-channel="pressure-limit"] {
            --_ui-stepper-number-ink: var(--ui-channel-pressure);
        }

        /* Every control is one width and does not grow with its column. */
        /* The bank's chips take a tighter type and inset — at four chips in one column it
           is a fit problem, not a taste one. */
        /* One rule for the bank. The width block below covers every other control, and
           two rules at the same condition would race. */
        .cell > ui-bank {
            --_ui-item-inset: 5px;
            inline-size: var(--_ui-step-ctrl-w);
            max-inline-size: 100%;
            margin-inline: auto;
            min-inline-size: 0;
        }

        .cell > ui-bank::part(item) {
            font-size: 16px;
        }

        /* No text field in a cell. The only one this matrix draws is the step name, and it
           is a child of the head line. */
        .cell > ui-stepper,
        .cell > ui-locked-value,
        .cell > ui-action-key-rail,
        .cell > .exit-group,
        .cell.head > .head-line {
            inline-size: var(--_ui-step-ctrl-w);
            max-inline-size: 100%;
            margin-inline: auto;
            min-inline-size: 0;
        }

        .cell.exits {
            /* The three slots are the content box, so the cell's rhythm is added on top of
               them rather than taken out of them. */
            min-block-size: var(--_ui-exit-cell-min);
            block-size: 100%;
            align-items: stretch;
        }

        /* The band's box, and the per-step context its controls are announced in. */
        .exit-group {
            display: flex;
        }

        .cell.exits ui-exit-sentence {
            flex: 1 1 auto;
            min-inline-size: 0;
            block-size: 100%;
        }

        .cell.actions {
            min-inline-size: auto;
        }

        .cell.actions ui-action-key-rail {
            container-type: normal;
        }
    `];

    #i18n = new I18nController(this);

    constructor() {
        super();
        this.steps = null;
        this.ranges = null;
        this.density = 'compact';
        this.label = 'Profile steps';
        this.powerExitOffered = false;
        this.holdOffered = false;
        this.pumpModesOffered = false;
        this.editable = false;
        this._editing = null;
    }

    /* The seam classes go on the host here rather than in the constructor: a custom
       element constructor must not gain attributes. */
    connectedCallback() {
        super.connectedCallback();
        this.classList.add('seam-grid', 'seam-cols', 'seam-line');
    }

    /* The steps as an array, without inventing one. */
    get #list() {
        return Array.isArray(this.steps) ? this.steps : [];
    }

    /* The step list last rendered, so a change can be read rather than assumed. Used
       only by willUpdate. */
    #renderedSteps = [];

    /* A name field must not survive the step moving out from under it: _editing is an
       index, so a reorder has to clear or move it. */
    willUpdate(changed) {
        super.willUpdate?.(changed);
        if (!changed.has('steps')) return;
        const before = this.#renderedSteps;
        const after = this.#list;
        this.#renderedSteps = after;
        if (this._editing === null) return;
        if (after[this._editing] !== before[this._editing]) this._editing = null;
    }

    /* Put the caret back on a key, by step index and action id. Returns whether it
       landed — the other half of a structural edit. */
    focusStepKey(index, action) {
        const cell = this.renderRoot?.querySelector?.(`[data-cell="actions-${index}"]`);
        const rail = cell?.querySelector?.('ui-action-key-rail') ?? null;
        const key = rail?.keyElement?.(action) ?? null;
        if (!key || key.disabled) return false;
        key.focus();
        return true;
    }

    /* The one value that crosses from JS to CSS: a count of content, not a
       measurement. Written on the host so the track list can use it. */
    updated(changed) {
        super.updated?.(changed);
        const count = this.#list.length;
        if (count > 0) this.style.setProperty('--_ui-step-count', String(count));
        else this.style.removeProperty('--_ui-step-count');

        /* The row split, so the exit row is the one that grows and the action rail sits at
           the bottom. Read off the row table rather than counted here. */
        /* The two column widths, picked by the step count. */
        this.style.setProperty('--_ui-step-w',
            count <= SLATE_FILL_MAX_STEPS
                ? 'var(--_ui-step-w-fill)'
                : 'var(--_ui-step-w-scroll)');

        const exitsAt = STEP_MATRIX_ROW_KEYS.indexOf('exits');
        if (exitsAt >= 0) {
            this.style.setProperty('--_ui-rows-before-exits', String(exitsAt));
            this.style.setProperty('--_ui-rows-after-exits',
                String(STEP_MATRIX_ROW_KEYS.length - exitsAt - 1));
        }

    }

    /* One range entry for one cell, or the door's refusal. Absence is a real answer
       and is not filled in here. */
    #rangeFor(field, ctx) {
        if (!field) return { range: null, refusal: null };
        if (!this.ranges) {
            return {
                range: null,
                refusal: 'no ranges door was handed to <step-matrix>, so no control in it '
                    + 'has bounds. Inject createEditorRanges({machineLimits}).',
            };
        }
        try {
            return { range: this.ranges.rangeFor(field, ctx), refusal: null };
        } catch (error) {
            return { range: null, refusal: error?.message ?? String(error) };
        }
    }

    #emit(type, detail) {
        this.dispatchEvent(new CustomEvent(type, {
            detail,
            bubbles: true,
            composed: true,
        }));
    }

    /* The cell's own `change` is stopped and re-emitted with its coordinates: a screen
       holding the draft needs to know which cell moved, not just that one did. */
    #onCellChange(event, row, step, index) {
        event.stopPropagation();
        const field = fieldFor(row, step);
        if (!field) return;
        this.#emit(STEP_CHANGE, {
            index,
            row: row.key,
            field,
            value: event.detail?.value,
            previous: readValue(row, step),
        });
    }

    /* The value cell was pressed. Re-emitted with the coordinates and the range,
       because whoever opens the numpad needs its limits. */
    #onCellEdit(event, row, step, index, range) {
        event.stopPropagation();
        const field = fieldFor(row, step);
        if (!field) return;
        this.#emit(STEP_EDIT, {
            index,
            row: row.key,
            field,
            value: event.detail?.value,
            range,
        });
    }

    /* With no steps the matrix still renders the way back, so an empty profile is not
       a dead end. */
    render() {
        const steps = this.#list;
        /* No rows, no table. role="table" requires row children, so an empty table is a
           shape a screen reader cannot be given. */
        if (!steps.length) return this.editable ? this.#renderAdd(0) : nothing;
        /* The door is the table's sibling, not its child. Read-only it is paint and
           carries no role. */
        return html`<div class="rows" role="table" aria-label=${this.#tableName || nothing}
        >${STEP_MATRIX_ROWS.map((row) => this.#renderRow(row, steps))}</div>${
            this.#renderAdd(steps.length)}`;
    }

    /* The table's translated name, or '' when the caller cleared it. */
    get #tableName() {
        return this.label ? this.#i18n.t(this.label) : '';
    }

    /* The empty area: paint when read-only, a pressable add door when editable. */
    #renderAdd(count) {
        if (!this.editable) return html`<div class="filler" aria-hidden="true"></div>`;
        const t = this.#i18n.t;
        return html`<button
            id="add-step"
            type="button"
            class=${count === 0 ? 'filler add empty' : 'filler add'}
            aria-label=${t(ADD_STEP_KEY)}
            @click=${() => this.#emit(STEP_ACTION, {
                action: 'insert-after', index: count - 1, count,
            })}
        ><svg
            class="plus"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >${svg`<path d="M12 5v14M5 12h14"/>`}</svg></button>`;
    }

    #renderRow(row, steps) {
        const t = this.#i18n.t;
        const head = row.key === 'head';
        const group = row.groupEnd ? ' group-end' : '';
        return html`
            <div class="row${group}" role="row" data-row=${row.key}>
                <div
                    class="cell rail seam-cell${group}"
                    role=${head ? 'columnheader' : 'rowheader'}
                    data-rail=${row.key}
                ><span
                    class=${row.railHidden ? 'rail-label ui-microcap a11y' : 'rail-label ui-microcap'}
                >${t(row.label)}</span></div>
                ${steps.map((step, index) => html`
                    <div
                        class="cell seam-cell ${row.key}${group}"
                        role=${head ? 'columnheader' : 'cell'}
                        data-cell=${`${row.key}-${index}`}
                    >${this.#renderCell(row, step, index, steps.length)}</div>
                `)}
            </div>
        `;
    }

    /* The translated, per-cell accessible name. */
    #cellName(row, index) {
        return this.#i18n.t(CELL_NAME_KEY, { label: this.#i18n.t(row.label), n: index + 1 });
    }

    #renderCell(row, step, index, total) {
        switch (cellKindFor(row, step)) {
            case 'head': return this.#renderHead(step, index, total);
            case 'stepper': return this.#renderStepper(row, step, index);
            case 'locked': return this.#renderLocked(row, index);
            case 'bank': return this.#renderBank(row, step, index);
            case 'exits': return this.#renderExits(row, step, index);
            case 'actions': return this.#renderActions(row, step, index, total);
            default: return nothing;
        }
    }

    /* The head cell: ordinal, name, mode. */
    #renderHead(step, index, total) {
        const t = this.#i18n.t;
        const pump = step?.pump;
        const mode = pump && PUMP_MODE_LABEL[pump] ? PUMP_MODE_LABEL[pump] : null;
        const name = step?.name ?? '';
        const editing = this._editing === index;
        const spoken = t(STEP_NAME_KEY, { n: index + 1 });

        const commit = (event) => {
            event.stopPropagation();
            this._editing = null;
            const value = event.target?.value ?? '';
            if (value === name) return;
            this.#emit(STEP_CHANGE, { index, row: 'head', field: 'name', value, previous: name });
        };

        return html`
            <div class="head-line">
                <span class="a11y">${t(STEP_ORDINAL_KEY, { n: index + 1, total })}</span>
                ${editing
                    ? html`<ui-text-field
                        class="name"
                        hide-label
                        label=${spoken}
                        .value=${name}
                        @change=${commit}
                        @blur=${commit}
                    ></ui-text-field>`
                    : html`<button
                        class="name-display ui-heading"
                        type="button"
                        title=${spoken}
                        @click=${() => { this._editing = index; }}
                    ><span class="ordinal" aria-hidden="true">${index + 1}.</span
                    >${name}</button>`}
                <ui-icon-button
                    class="step-pen"
                    label=${spoken}
                    @click=${() => { this._editing = index; }}
                >${penIcon()}</ui-icon-button>
            </div>
            ${mode
                ? html`<span
                    class="mode ui-microcap"
                    data-tone=${pump}
                    >${t(mode)}</span
                >`
                : nothing}
        `;
    }

    /* A stepper cell. The bounds and the unit arrive as data from the ranges door and
       are handed straight on — this file neither reads nor rounds them. */
    #renderStepper(row, step, index) {
        const { range, refusal } = this.#rangeFor(row.rangeField, {
            pump: step?.pump ?? null,
        });
        const value = readValue(row, step);
        return html`<ui-stepper
            density=${this.density}
            data-channel=${matrixChannel(row, step) ?? nothing}
            label=${this.#cellName(row, index)}
            title=${refusal ? this.#i18n.t('Unavailable') : nothing}
            data-refusal=${refusal || nothing}
            ?disabled=${Boolean(refusal)}
            ?editable=${this.editable && !refusal}
            .value=${Number.isFinite(value) ? value : 0}
            .min=${range ? range.min : null}
            .max=${range ? range.max : null}
            .step=${range ? range.step : null}
            unit=${row.unit ?? range?.unit ?? nothing}
            note=${this.#stepperNote(row, step)}
            .format=${row.zeroLabel ? this.#zeroLabelFormat(row, range) : null}
            ?off=${Boolean(row.zeroLabel) && !(Number(value) > 0)}
            @change=${(event) => this.#onCellChange(event, row, step, index)}
            @edit=${(event) => this.#onCellEdit(event, row, step, index, range)}
        ></ui-stepper>`;
    }

    /* The word under a value, where a value has one. */
    #stepperNote(row, step) {
        if (row.key !== 'target' || (step && step.pump) !== 'lever') return nothing;
        const word = LEVER_FEEL_WORD[inferLeverPreset(step)];
        return word ? this.#i18n.t(word) : nothing;
    }

    /* A row whose zero is a state gets a formatter; the stepper consults it in place
       of its own number formatting. */
    #zeroLabelFormat(row, range) {
        const places = range && Number.isFinite(range.step)
            ? (String(range.step).split('.')[1]?.length ?? 0)
            : 1;
        const off = this.#i18n.t(row.zeroLabel);
        return (value) => (Number(value) > 0 ? Number(value).toFixed(places) : off);
    }

    /* The locked cell: the Target row on a HOLD step, a stepper with no caps. Placed,
       not built. */
    #renderLocked(row, index) {
        const t = this.#i18n.t;
        return html`<ui-locked-value
            label=${this.#cellName(row, index)}
        >${t(HELD_TARGET_TEXT)}</ui-locked-value>`;
    }

    /* A segmented cell. Options and selection are the caller's decisions. */
    #renderBank(row, step, index) {
        const t = this.#i18n.t;
        const bank = bankOptionsFor(row, step, index, {
            pumpModesOffered: this.pumpModesOffered,
            holdOffered: this.holdOffered,
        });
        /* Density reaches the bank too. At four chips in one column the difference is
           whether the row fits. */
        return html`<ui-bank
            density=${this.density}
            label=${this.#cellName(row, index)}
            .items=${bank.options.map((option) => ({
                value: option.value,
                label: t(option.label),
                disabled: option.disabled,
            }))}
            .value=${bank.value ?? ''}
            ?disabled=${bank.readOnly}
            @change=${(event) => this.#onCellChange(event, row, step, index)}
        ></ui-bank>`;
    }

    /* The exit band. The compound owns the sentence, the remove control and the
       add-slot popover, and reports through its own events. */
    #renderExits(row, step, index) {
        return html`<div
            class="exit-group"
            role="group"
            aria-label=${this.#cellName(row, index)}
        ><ui-exit-sentence
            .step=${step}
            .index=${index}
            ?power-exit-offered=${this.powerExitOffered}
        ></ui-exit-sentence></div>`;
    }

    /* The action key rail: move-left, delete, insert-after, duplicate, move-right. */
    #renderActions(row, step, index, total) {
        return html`<ui-action-key-rail
            .index=${index}
            .count=${total}
            label=${this.#cellName(row, index)}
        ></ui-action-key-rail>`;
    }
}

customElements.define('step-matrix', StepMatrix);
