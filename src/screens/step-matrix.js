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

const SLATE_FILL_MAX_STEPS = 4;

import { penIcon } from 'src/lib/icons.js';

import 'src/components/ui-stepper.js';
import 'src/components/ui-bank.js';
import 'src/components/ui-locked-value.js';
import 'src/components/ui-text-field.js';
import 'src/components/ui-exit-sentence.js';
import 'src/components/ui-action-key-rail.js';
import { STEP_ACTION } from 'src/components/ui-action-key-rail.js';

export { serializeExitSlots } from 'src/lib/exit-sentence.js';

export const STEP_CHANGE = 'step-change';

export const STEP_EDIT = 'step-edit';

export const ADD_STEP_KEY = 'Add a step';

/* Dispatched when a cell's value changes. */
export const MATRIX_DENSITIES = Object.freeze(['regular', 'compact']);

export class StepMatrix extends UiElement {
    static properties = {
        /* Dispatched when a value cell asks for the numpad. */
        steps: { attribute: false },

        ranges: { attribute: false },

        density: { type: String, reflect: true },

        /* The draft's steps, in the shape ReaPrime serves. Read, never written. */
        label: { type: String },

        /* The ranges door, injected: the limits are per-machine. */
        powerExitOffered: { type: Boolean, attribute: 'power-exit-offered' },

        /* regular or compact, reflected. */
        holdOffered: { type: Boolean, attribute: 'hold-offered' },

        /* The table's accessible name. */
        pumpModesOffered: { type: Boolean, attribute: 'pump-modes-offered' },

        editable: { type: Boolean },

        _editing: { state: true },
    };

    static styles = [typeRoles, seams, visuallyHidden, css`
        :host(.seam-grid) {
            /* Whether pressing a value cell opens the numpad. Off by default: a control that
               announces a dialog and opens nothing is worse than a plain readout. */
            --_ui-rail-w: 192px;

            /* Which step's name is being typed, by index, or null. */
            --_ui-step-w-fill: 431px;
            --_ui-step-w-scroll: 372px;
            --_ui-step-w: var(--_ui-step-w-fill);

            /* No backtick anywhere in this template, comments included: one ends the tagged
               template where it stands. */
            --_ui-step-ctrl-w: 350px;

            --_ui-step-min: calc(var(--_ui-step-ctrl-w) + 2 * var(--ui-space-3));

            --_ui-rail-min: var(--_ui-rail-w);
            --_ui-rail-cap: var(--_ui-step-min);

            --_ui-step-count: 1;

            --_ui-rows-before-exits: 8;
            --_ui-rows-after-exits: 1;

            --_ui-matrix-rhythm: var(--ui-space-3);

            --_ui-exit-gap: calc(2 * var(--_ui-matrix-rhythm));
            --_ui-exit-row-min: calc(3 * var(--ui-control-h) + 2 * var(--_ui-exit-gap));

            --_ui-exit-cell-min: calc(var(--_ui-exit-row-min) + 2 * var(--_ui-matrix-rhythm));

            grid-template-columns:
                var(--_ui-rail-w)
                repeat(var(--_ui-step-count), var(--_ui-step-w))
                minmax(0, 1fr);

            justify-content: start;

            grid-template-rows:
                repeat(var(--_ui-rows-before-exits), min-content)
                minmax(var(--_ui-exit-cell-min), 1fr)
                repeat(var(--_ui-rows-after-exits), min-content);

            grid-auto-rows: minmax(min-content, auto);

            align-content: stretch;

            /* Rows are implicit and content-derived: a literal track list would have to be kept
               in step with the row table. */
            overflow: auto;

            min-block-size: var(--ui-editor-matrix-min-h);

        }

        :host(.seam-grid[density="compact"]) {
            --_ui-matrix-rhythm: calc((var(--ui-space-2) + var(--ui-space-3)) / 2);
        }

        .row {
            display: contents;
        }

        .rows {
            display: contents;
        }

        .cell {
            display: flex;
            align-items: center;
            padding-block: var(--_ui-matrix-rhythm);
            padding-inline: var(--ui-space-3);

        }

        .cell.group-end {
            box-shadow: inset 0 calc(-1 * var(--ui-seam)) 0 0 var(--ui-line);
        }

        /* No min-inline-size: 0 here — a grid item whose overflow is not visible already
           has an automatic minimum of zero. */
        .row.group-end > .cell {
            padding-block-end: calc(2 * var(--_ui-matrix-rhythm));
        }

        .row.group-end > .cell.head {
            padding-block-end: var(--_ui-matrix-rhythm);
        }

        .row.group-end + .row > .cell {
            padding-block-start: calc(2 * var(--_ui-matrix-rhythm));
        }

        .filler {
            grid-column: -2 / -1;
            grid-row: 1 / -1;
            background-color: var(--ui-fascia);
        }

        /* Rows are display: contents, so the semantic row wraps its cells without becoming
           a box between the grid and them. */
        button.filler {
            /* role="table" must not sit on the host: it would make every element inside it a
               table descendant. */
            appearance: none;
            border: 0;
            margin: 0;
            padding: 0;
            font: inherit;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;

            min-inline-size: var(--ui-hit-min);
        }

        button.filler:focus-visible {
            ${focusRing}
            --_ui-focus-offset: var(--ui-focus-offset-inset);
        }

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

        .cell.rail {
            position: sticky;
            inset-inline-start: 0;
            z-index: 1;

            min-inline-size: var(--_ui-rail-min);

            overflow: hidden;

            background-color: var(--ui-bar);
        }

        .rail-label {
            min-inline-size: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .cell.head {
            flex-direction: column;
            align-items: stretch;
            justify-content: center;

            min-block-size: calc(var(--ui-control-h) + var(--ui-space-3));
            gap: 0;
        }

        /* Clip and ellipsis together: a longer translation of a row label must not paint
           over the first data cell. */
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

            --_ui-icon-btn-border: 0;
            --_ui-icon-btn-box: var(--ui-hit-min);
        }

        .name-display {
            border: 0;
            padding: 0;
            background-color: transparent;
            color: var(--ui-text);
            font: inherit;

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

            font-size: 0.75em;
        }

        .mode {
            font-size: var(--ui-text-sm);
            font-weight: var(--ui-weight-medium);
            letter-spacing: calc(var(--ui-tracking-cap) / 2);

            line-height: 1.2;
            text-align: center;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .mode[data-tone="flow"] { color: var(--ui-channel-flow); }
        .mode[data-tone="pressure"] { color: var(--ui-channel-pressure); }
        .mode[data-tone="power"] { color: var(--ui-channel-power); }

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
            min-block-size: var(--_ui-exit-cell-min);
            block-size: 100%;
            align-items: stretch;
        }

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

    connectedCallback() {
        super.connectedCallback();
        this.classList.add('seam-grid', 'seam-cols', 'seam-line');
    }

    get #list() {
        return Array.isArray(this.steps) ? this.steps : [];
    }

    #renderedSteps = [];

    willUpdate(changed) {
        super.willUpdate?.(changed);
        if (!changed.has('steps')) return;
        const before = this.#renderedSteps;
        const after = this.#list;
        this.#renderedSteps = after;
        if (this._editing === null) return;
        if (after[this._editing] !== before[this._editing]) this._editing = null;
    }

    focusStepKey(index, action) {
        const cell = this.renderRoot?.querySelector?.(`[data-cell="actions-${index}"]`);
        const rail = cell?.querySelector?.('ui-action-key-rail') ?? null;
        const key = rail?.keyElement?.(action) ?? null;
        if (!key || key.disabled) return false;
        key.focus();
        return true;
    }

    updated(changed) {
        super.updated?.(changed);
        const count = this.#list.length;
        if (count > 0) this.style.setProperty('--_ui-step-count', String(count));
        else this.style.removeProperty('--_ui-step-count');

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

    render() {
        const steps = this.#list;
        if (!steps.length) return this.editable ? this.#renderAdd(0) : nothing;
        return html`<div class="rows" role="table" aria-label=${this.#tableName || nothing}
        >${STEP_MATRIX_ROWS.map((row) => this.#renderRow(row, steps))}</div>${
            this.#renderAdd(steps.length)}`;
    }

    /* Set on the host rather than in the constructor: a custom element constructor must
       not gain attributes. */
    get #tableName() {
        return this.label ? this.#i18n.t(this.label) : '';
    }

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

    /* _editing is an index, so a reorder has to clear or move it — a name field must
       not survive the step moving out from under it. */
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

    /* Put the caret back on a key, by step index and action id. Returns whether it
       landed. */
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

    /* The one value that crosses from JS to CSS: a count of content, not a
       measurement. */
    #stepperNote(row, step) {
        if (row.key !== 'target' || (step && step.pump) !== 'lever') return nothing;
        const word = LEVER_FEEL_WORD[inferLeverPreset(step)];
        return word ? this.#i18n.t(word) : nothing;
    }

    #zeroLabelFormat(row, range) {
        const places = range && Number.isFinite(range.step)
            ? (String(range.step).split('.')[1]?.length ?? 0)
            : 1;
        const off = this.#i18n.t(row.zeroLabel);
        return (value) => (Number(value) > 0 ? Number(value).toFixed(places) : off);
    }

    #renderLocked(row, index) {
        const t = this.#i18n.t;
        return html`<ui-locked-value
            label=${this.#cellName(row, index)}
        >${t(HELD_TARGET_TEXT)}</ui-locked-value>`;
    }

    #renderBank(row, step, index) {
        const t = this.#i18n.t;
        const bank = bankOptionsFor(row, step, index, {
            pumpModesOffered: this.pumpModesOffered,
            holdOffered: this.holdOffered,
        });
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

    /* One range entry for one cell, or the door's refusal. Absence is a real answer. */
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

    /* The cell's own change is stopped and re-emitted with its coordinates. */
    #renderActions(row, step, index, total) {
        return html`<ui-action-key-rail
            .index=${index}
            .count=${total}
            label=${this.#cellName(row, index)}
        ></ui-action-key-rail>`;
    }
}

customElements.define('step-matrix', StepMatrix);
