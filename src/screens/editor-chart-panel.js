import { css, html, nothing, svg } from 'lit';
import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import 'src/components/ui-icon-button.js';
import 'src/components/ui-dialog.js';
import 'src/components/ui-slider.js';
import 'src/components/ui-stepper.js';
import { runShotModel, settingsFromNativeShaping, stepsFromProfile, NATIVE_SHAPING_KEY } from 'src/lib/shot-model.js';
import { de1EmulationOf } from 'src/lib/de1-emulation.js';
import {
    CHART_NOT_USABLE, NOT_USABLE_WORDS, editorRecordForShot, shotFacts, shotPlan, shotRowFacts, shotShapingBlock,
} from 'src/lib/chart-shot-load.js';
import { createMultiStartFit, fitSpread, FIT_STARTS } from 'src/lib/puck-multistart.js';
import { authoringRange, modeRanges } from 'src/lib/profile-modes.js';
import { createShotsStore } from 'src/stores/shots-store.js';
import {
    GRIND_RANGE, MEASURED_SERIES, RUN_END, TARGET_SERIES, centredRate, chartXMax, chartYMax, grindFactor,
    isPoorFit, mainStepOf, resultChange, runResults, seriesToggle, shotResults, valueAt,
} from 'src/lib/chart-series.js';

export const SHOT_PAGE_SIZE = 20;

const FIT_SLICE_MS = 12;
const STILL_SAVING = 'Still saving. One moment.';
const NOT_LOADED = 'The shot did not load.';
const CURSOR_STEP_S = 0.5;
const CURSOR_JUMP_S = 2;
const MODEL_T_MAX = 120;
const PAD = Object.freeze({ left: 70, right: 16, top: 18, bottom: 44 });
const SERIES_KEYS = Object.freeze(['P', 'Q', 'G']);
const SERIES_NAMES = Object.freeze({ P: 'Pressure', Q: 'Flow', G: 'GFlow', targets: 'Target' });
const SERIES_UNITS = Object.freeze({ P: 'bar', Q: 'mL/s', G: 'g/s' });
const RUN_END_WORDS = Object.freeze({
    [RUN_END.STOP]: 'at target weight',
    [RUN_END.END]: 'profile end',
    [RUN_END.LIMIT]: 'time limit',
});
const TIPS = Object.freeze({
    chart: {
        heading: 'Model run',
        body: [
            'Edited: the model run of the edited profile, with the puck fitted to the loaded shot.',
            'Before any edit, and at grind x1.00, Edited is the model of the loaded shot itself. The chart then shows how well the model fits that shot: Edited against Shot.',
            'Shot: the loaded shot, as recorded: wide and pale lines; marks at the bottom: its step changes. Bold: the edited run. Dashed: the targets of the edited run. Dashed upright lines: step changes of the edited run. Shaded: a step of the edited run with a target of 0.',
            'GFlow: the weight flow into the cup, g/s, on the left axis with flow. For both runs it is the change of the cup weight over 1 s (centred). Tap a series name in the toolbar to hide or show it; the scale does not change.',
            'Touch or drag on the chart to read the values at one time. With the chart in focus, the left and right arrow keys move the cursor (Shift: 2 s); Escape hides it.',
        ],
    },
    grind: {
        heading: 'Grind',
        body: ['Scales the puck resistance (the settle time stays). Finer: up to x2. Coarser: down to x0.5. x1.00: the grind of the loaded shot. Grind changes the edited run only.'],
    },
    results: { heading: 'Results', body: [] },
    shots: {
        heading: 'Pick a shot',
        body: [
            'A shot loads the profile it ran (steps and native shaping), and the model fits the puck to that shot. The chart then compares the edited profile with that shot.',
            'The model cannot run a shot in DE1 emulation, or a shot with no target weight. Such a shot loads its profile only.',
        ],
    },
    steps: { heading: 'Step targets', body: ['Each change runs the model again.'] },
});

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const fixed = (v, digits) => (finite(v) ? v.toFixed(digits) : '–');

function infoIcon() {
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
        ><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6"></path><path d="M12 7.5v.5"></path></svg>`;
}

function pathOf(t, values, x, y) {
    let d = '';
    let pen = false;
    for (let i = 0; i < t.length; i++) {
        const v = values[i];
        if (!finite(v) || !finite(t[i])) {
            pen = false;
            continue;
        }
        d += `${pen ? 'L' : 'M'}${x(t[i]).toFixed(1)} ${y(v).toFixed(1)}`;
        pen = true;
    }
    return d;
}

function stepTarget(step) {
    if (!step) return null;
    return step.pump === 'flow' ? step.flow : step.pressure;
}

class EditorChartPanel extends UiElement {
    static properties = {
        boot: { attribute: false },
        profile: { attribute: false },
        baseline: { attribute: false },
        dirty: { type: Boolean },
        saving: { type: Boolean },
        fitStarts: { attribute: false },
        _rows: { state: true },
        _total: { state: true },
        _listStatus: { state: true },
        _loaded: { state: true },
        _fit: { state: true },
        _fitting: { state: true },
        _show: { state: true },
        _runs: { state: true },
        _note: { state: true },
        _grind: { state: true },
        _cursor: { state: true },
        _size: { state: true },
        _tip: { state: true },
        _pending: { state: true },
        _pickerOpen: { state: true },
        _loadError: { state: true },
    };

    static styles = [typeRoles, css`
        :host {
            --_cp-hit: max(var(--ui-hit-min), var(--_ui-hit-floor, 0px));
            display: grid;
            grid-template-rows: auto auto minmax(0, 1fr) auto;
            gap: var(--ui-space-3);
            box-sizing: border-box;
            block-size: 100%;
            min-block-size: 0;
            min-inline-size: 0;
            padding: var(--ui-space-4) var(--ui-space-6);
            background-color: var(--ui-fascia);
            container-type: inline-size;
        }

        :host([hidden]) {
            display: none;
        }

        .notes {
            display: grid;
            gap: var(--ui-space-2);
        }

        .notes p {
            margin: 0;
        }

        #de1-notice,
        #fit-warn {
            padding: var(--ui-space-2) var(--ui-space-4);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            background-color: var(--ui-surface);
            color: var(--ui-text);
        }

        #toolbar {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: var(--ui-space-2);
            min-inline-size: 0;
        }

        #toolbar h2 {
            margin: 0;
        }

        .spacer {
            flex: 1 1 0;
        }

        .chip {
            display: inline-flex;
            align-items: center;
            gap: var(--ui-space-2);
            min-block-size: var(--_cp-hit);
            min-inline-size: var(--_cp-hit);
            padding-inline: var(--ui-space-3);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            background-color: transparent;
            color: var(--ui-text-2);
            font: inherit;
            cursor: pointer;
        }

        .chip[aria-pressed="true"] {
            border-color: var(--ui-steel);
            color: var(--ui-text);
        }

        .chip.primary {
            border-color: var(--ui-steel);
            background-color: var(--ui-steel);
            color: var(--ui-on-steel);
        }

        ui-slider {
            --_ui-hit-box: var(--_cp-hit);
        }

        .chip:disabled {
            opacity: .5;
            cursor: default;
        }

        .chip .swatch {
            inline-size: 20px;
            block-size: 4px;
            border-radius: 2px;
            background-color: currentColor;
        }

        .k-P .swatch { background-color: var(--ui-channel-pressure); }
        .k-Q .swatch { background-color: var(--ui-channel-flow); }
        .k-G .swatch { background-color: var(--ui-channel-weight-flow); }
        .k-T .swatch {
            background: repeating-linear-gradient(90deg, var(--ui-text-2) 0 6px, transparent 6px 10px);
        }

        ui-icon-button.info {
            --_ui-icon-btn-box: var(--_cp-hit);
            --_ui-icon-btn-border: 0;
        }

        #chart-wrap {
            position: relative;
            min-block-size: 0;
            min-inline-size: 0;
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            background-color: var(--ui-surface);
            overflow: hidden;
        }

        #main-chart {
            position: absolute;
            inset: 0;
            display: block;
            inline-size: 100%;
            block-size: 100%;
            touch-action: none;
        }

        #main-chart:focus-visible {
            outline: var(--ui-border-w-strong) solid var(--ui-steel);
            outline-offset: -2px;
        }

        .grid line { stroke: var(--ui-line); stroke-width: 1; }
        .axis text { fill: var(--ui-text-2); font-size: 15px; }
        .s-P { stroke: var(--ui-channel-pressure); }
        .s-Q { stroke: var(--ui-channel-flow); }
        .s-G { stroke: var(--ui-channel-weight-flow); }
        .t-P { stroke: var(--ui-channel-target-pressure); }
        .t-Q { stroke: var(--ui-channel-target-flow); }
        .line { fill: none; stroke-linejoin: round; stroke-linecap: round; }
        .edited { stroke-width: 3; }
        .shot { stroke-width: 9; opacity: .28; }
        .target { stroke-width: 2; stroke-dasharray: 16 10; }
        .step-line { stroke: var(--ui-channel-step-boundary); stroke-width: 1.5; stroke-dasharray: 6 6; }
        .step-label { fill: var(--ui-text-2); font-size: 14px; }
        .shot-mark { fill: var(--ui-channel-step-boundary); }
        .bloom { fill: var(--ui-channel-step-boundary); opacity: .12; }
        .cursor { stroke: var(--ui-text); stroke-width: 1.5; }
        .dot { stroke: var(--ui-surface); stroke-width: 2; }
        .dot.P { fill: var(--ui-channel-pressure); }
        .dot.Q { fill: var(--ui-channel-flow); }
        .dot.G { fill: var(--ui-channel-weight-flow); }

        #cur-label {
            position: absolute;
            inset-block-start: var(--ui-space-2);
            padding: var(--ui-space-2) var(--ui-space-3);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            background-color: var(--ui-surface);
            color: var(--ui-text);
            pointer-events: none;
            white-space: nowrap;
        }

        #cur-label table {
            border-collapse: collapse;
        }

        #cur-label th,
        #cur-label td {
            padding: 0 var(--ui-space-2);
            text-align: end;
            font-weight: normal;
        }

        #no-model {
            position: absolute;
            inset: 0;
            display: grid;
            place-content: center;
            gap: var(--ui-space-2);
            padding: var(--ui-space-5);
            text-align: center;
            background-color: color-mix(in srgb, var(--ui-surface) 88%, transparent);
        }

        #no-model p {
            margin: 0;
            max-inline-size: 60ch;
        }

        .sr-only {
            position: absolute;
            inline-size: 1px;
            block-size: 1px;
            overflow: hidden;
            clip-path: inset(50%);
            white-space: nowrap;
        }

        #strip {
            display: grid;
            grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        #strip.has-shaping {
            grid-template-columns: minmax(0, 2fr) auto minmax(0, 1fr) minmax(0, 1fr);
        }

        #shaping-entry {
            justify-content: center;
            padding-inline: var(--ui-space-5);
            white-space: nowrap;
        }

        .card {
            display: grid;
            gap: var(--ui-space-1);
            align-content: center;
            min-inline-size: 0;
            min-block-size: var(--_cp-hit);
            padding: var(--ui-space-2) var(--ui-space-3);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            background-color: var(--ui-surface);
            color: var(--ui-text);
            font: inherit;
            text-align: start;
        }

        button.card {
            cursor: pointer;
        }

        .card-head {
            display: flex;
            align-items: center;
            gap: var(--ui-space-2);
            min-inline-size: 0;
        }

        .grind-row {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto;
            align-items: center;
            gap: var(--ui-space-2);
        }

        .grind-out {
            display: flex;
            align-items: center;
            gap: var(--ui-space-2);
        }

        .big {
            font-size: var(--ui-text-lg, 1.25rem);
        }

        .table {
            inline-size: 100%;
            border-collapse: collapse;
        }

        .table th,
        .table td {
            padding: var(--ui-space-2);
            border-block-end: var(--ui-border-w) solid var(--ui-line);
            text-align: end;
        }

        .table th:first-child,
        .table td:first-child {
            text-align: start;
        }

        .step-block {
            display: grid;
            gap: var(--ui-space-2);
            padding-block: var(--ui-space-3);
            border-block-end: var(--ui-border-w) solid var(--ui-line);
        }

        .step-block p {
            margin: 0;
        }

        .step-grid {
            display: flex;
            flex-wrap: wrap;
            gap: var(--ui-space-4);
            align-items: end;
        }

        .tip p {
            margin: 0 0 var(--ui-space-2);
        }

        #picker {
            --_ui-dialog-inline: min(calc(480px / var(--ui-app-scale, 1)), 50%);
        }

        @media (max-width: 759px) {
            #picker {
                --_ui-dialog-inline: 100%;
            }
        }

        .picker-body {
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
            gap: var(--ui-space-2);
            block-size: 100%;
        }

        .picker-head {
            display: flex;
            align-items: center;
            gap: var(--ui-space-2);
        }

        .picker-head h2 {
            margin: 0;
            flex: 1 1 auto;
        }

        .picker-top {
            display: grid;
            gap: var(--ui-space-1);
        }

        .picker-caption,
        #load-error {
            margin: 0;
        }

        #shot-list {
            margin: 0;
            padding: 0;
            list-style: none;
            overflow-y: auto;
            min-block-size: 0;
        }

        .shot-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: var(--ui-space-1) var(--ui-space-3);
            inline-size: 100%;
            min-block-size: var(--_cp-hit);
            padding: var(--ui-space-2) var(--ui-space-3);
            border: 0;
            border-block-end: var(--ui-border-w) solid var(--ui-line);
            background-color: transparent;
            color: var(--ui-text);
            font: inherit;
            text-align: start;
            cursor: pointer;
        }

        .shot-row[aria-current="true"] {
            background-color: color-mix(in srgb, var(--ui-steel) 12%, transparent);
        }

        .shot-row .when,
        .shot-row .nums {
            white-space: nowrap;
        }

        .shot-row .title {
            min-inline-size: 0;
            overflow-wrap: anywhere;
        }

        .tags {
            display: flex;
            flex-wrap: wrap;
            gap: var(--ui-space-1);
            grid-column: 1 / -1;
        }

        .tags:empty {
            display: none;
        }

        .tag {
            padding: 0 var(--ui-space-2);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            white-space: nowrap;
        }

        .list-note {
            padding: var(--ui-space-3);
        }

        @container (max-width: 900px) {
            #strip {
                grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            }

            #strip.has-shaping {
                grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr);
            }

            #grind-card {
                grid-column: 1 / -1;
            }
        }
    `];

    #i18n = new I18nController(this);
    #fitJob = null;
    #fitTimer = 0;
    #loadSeq = 0;
    #shots = null;
    #shotsBoot = null;
    #resize = null;
    #drag = false;
    #memo = { key: null, value: null };

    constructor() {
        super();
        this.boot = null;
        this.profile = null;
        this.baseline = null;
        this.dirty = false;
        this.saving = false;
        this.fitStarts = FIT_STARTS;
        this._rows = [];
        this._total = null;
        this._listStatus = 'idle';
        this._loaded = null;
        this._fit = null;
        this._fitting = false;
        this._show = { P: true, Q: true, G: true, [TARGET_SERIES]: true };
        this._runs = { edited: true, shot: true };
        this._note = '';
        this._grind = 0;
        this._cursor = null;
        this._size = { w: 0, h: 0 };
        this._tip = null;
        this._pending = null;
        this._pickerOpen = false;
        this._loadError = '';
    }

    connectedCallback() {
        super.connectedCallback();
        this.#resize ??= new ResizeObserver((entries) => {
            const box = entries[0]?.contentRect;
            if (!box) return;
            const w = Math.round(box.width);
            const h = Math.round(box.height);
            if (w !== this._size.w || h !== this._size.h) this._size = { w, h };
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.#stopFit();
        this.#resize?.disconnect();
    }

    firstUpdated() {
        const wrap = this.renderRoot.getElementById('chart-wrap');
        if (wrap) this.#resize.observe(wrap);
    }

    get loadedShot() {
        return this._loaded;
    }

    get fitResult() {
        return this._fit;
    }

    get spread() {
        return this._fit ? fitSpread(this._fit.fits) : null;
    }

    get pickerOpen() {
        return this._pickerOpen;
    }

    openPicker(invoker = null) {
        const dialog = this.renderRoot?.getElementById('picker');
        if (!dialog || dialog.open) return;
        dialog.show({ invoker });
        this._pickerOpen = true;
        this.#emitPicker();
        if (!this._rows.length && this._listStatus !== 'loading') this.#readPage(0);
    }

    closePicker() {
        const dialog = this.renderRoot?.getElementById('picker');
        if (!dialog || !dialog.open) return;
        dialog.hide('api');
    }

    #onPickerOpenChange = (event) => {
        if (event.target !== event.currentTarget || event.detail?.open) return;
        this.#loadSeq += 1;
        this._pickerOpen = false;
        this._pending = null;
        this._loadError = '';
        this.#emitPicker();
    };

    #emitPicker() {
        this.dispatchEvent(new CustomEvent('chart-picker', {
            bubbles: true, composed: true, detail: { open: this._pickerOpen },
        }));
    }

    #onListScroll = (event) => {
        const list = event.currentTarget;
        if (list.scrollTop + list.clientHeight < list.scrollHeight - 4) return;
        this.#readMore();
    };

    #hasMore() {
        return finite(this._total) && this._rows.length < this._total;
    }

    #readMore() {
        if (this._listStatus === 'loading' || !this.#hasMore()) return;
        this.#readPage(this._rows.length);
    }

    get #shotStore() {
        if (this.#shotsBoot !== this.boot) {
            this.#shotsBoot = this.boot;
            const transport = this.boot?.transport ?? null;
            this.#shots = transport ? createShotsStore({ transport, logger: this.boot?.logger ?? null }) : null;
        }
        return this.#shots;
    }

    async #readPage(offset) {
        const shots = this.#shotStore;
        if (!shots || typeof shots.readPage !== 'function') {
            this._listStatus = 'failed';
            return;
        }
        this._listStatus = 'loading';
        let state;
        try {
            state = await shots.readPage({ limit: SHOT_PAGE_SIZE, offset, order: 'desc' });
        } catch {
            state = null;
        }
        if (!state || state.status === 'failed' || !Array.isArray(state.items)) {
            this._listStatus = 'failed';
            return;
        }
        const seen = new Set(this._rows.map((r) => r.id));
        const fresh = state.items.map(shotRowFacts).filter((r) => r.id && !seen.has(r.id));
        this._rows = offset === 0 ? state.items.map(shotRowFacts).filter((r) => r.id) : [...this._rows, ...fresh];
        this._total = finite(state.total) ? state.total : this._rows.length;
        this._listStatus = 'ready';
    }

    #refuseWhileSaving() {
        if (!this.saving) return false;
        this._loadError = STILL_SAVING;
        return true;
    }

    #onRowPick(row) {
        if (this.#refuseWhileSaving()) return;
        if (this.dirty) {
            this._pending = row;
            this.updateComplete.then(() => {
                const confirm = this.renderRoot.getElementById('load-confirm');
                confirm?.show({ invoker: this.renderRoot.querySelector(`.shot-row[data-id="${row.id}"]`) });
            });
            return;
        }
        this.#load(row.id);
    }

    #onConfirmCancel = () => {
        this.renderRoot.getElementById('load-confirm')?.hide('cancel');
        this._pending = null;
    };

    #onConfirmLoad = () => {
        const row = this._pending;
        this.renderRoot.getElementById('load-confirm')?.hide('confirm');
        this._pending = null;
        if (row && !this.#refuseWhileSaving()) this.#load(row.id);
    };

    #onConfirmClose = () => {
        this._pending = null;
    };

    async #load(id) {
        const shots = this.#shotStore;
        if (!shots) return;
        const seq = ++this.#loadSeq;
        const draft = this.profile;
        this._loadError = '';
        let answer;
        try {
            answer = await shots.loadShot(id);
        } catch {
            answer = null;
        }
        if (seq !== this.#loadSeq || this.profile !== draft) return;
        if (this.#refuseWhileSaving()) return;
        if (!answer || !answer.ok) {
            this._loadError = NOT_LOADED;
            return;
        }
        const record = answer.record;
        const listed = this.boot?.library?.get?.()?.records ?? [];
        const opened = editorRecordForShot(record, listed);
        const plan = shotPlan(record);
        this.#stopFit();
        this._fit = null;
        this._grind = 0;
        this._cursor = null;
        this._loaded = {
            id, record, plan,
            facts: shotFacts(record, plan),
            mainStep: plan.shot ? mainStepOf(plan.shot) : null,
            openedWeight: Number((opened?.profile ?? plan.profile)?.target_weight),
        };
        this._rows = this._rows.map((r) => (r.id === id ? { ...r, time: this._loaded.facts.time } : r));
        if (opened) {
            this.dispatchEvent(new CustomEvent('chart-shot-load', {
                bubbles: true, composed: true, detail: { record: opened },
            }));
        }
        this.#emitStatus();
        this.closePicker();
        if (plan.usable) this.#startFit(plan);
    }

    #startFit(plan) {
        this._fitting = true;
        this.#fitJob = createMultiStartFit({
            shot: plan.shot,
            steps: plan.steps,
            settings: plan.settings,
            targetWeight: plan.targetWeight,
            starts: Array.isArray(this.fitStarts) && this.fitStarts.length ? this.fitStarts : FIT_STARTS,
        });
        const job = this.#fitJob;
        const tick = () => {
            this.#fitTimer = 0;
            if (job !== this.#fitJob) return;
            const until = performance.now() + FIT_SLICE_MS;
            let p = job.progress();
            while (!p.done && performance.now() < until) p = job.run(2);
            if (!p.done) {
                this.#fitTimer = setTimeout(tick, 0);
                return;
            }
            this.#fitJob = null;
            this._fitting = false;
            this._fit = job.result();
            this.#emitStatus();
        };
        this.#fitTimer = setTimeout(tick, 0);
    }

    #stopFit() {
        if (this.#fitTimer) clearTimeout(this.#fitTimer);
        this.#fitTimer = 0;
        this.#fitJob?.stop();
        this.#fitJob = null;
        this._fitting = false;
    }

    #emitStatus() {
        this.dispatchEvent(new CustomEvent('chart-status', {
            bubbles: true, composed: true, detail: { line: this.shotLine },
        }));
    }

    get shotLine() {
        const t = this.#i18n.t;
        const loaded = this._loaded;
        if (!loaded) return '';
        const f = loaded.facts;
        const when = f.clock.ok ? `${f.clock.dateFull} ${f.clock.time}` : '–';
        const parts = [t('Shot {when} · {dose} g → {yield} g · {time} s', {
            when, dose: fixed(f.dose, 1), yield: fixed(f.yield, 1), time: fixed(f.time, 1),
        })];
        if (f.de1) parts.push(t('DE1 emulation'));
        if (f.noTarget) parts.push(t('no target weight'));
        return parts.join(' · ');
    }

    get #modelState() {
        const loaded = this._loaded;
        if (!loaded) return { kind: 'empty' };
        if (!loaded.plan.usable) return { kind: 'shot', reason: loaded.plan.reason };
        const steps = stepsFromProfile(this.profile ?? loaded.plan.profile);
        if (!steps) return { kind: 'profile', reason: CHART_NOT_USABLE.STEP_NOT_MODELLED };
        return { kind: 'ok', steps };
    }

    #editedRun(steps) {
        const fit = this._fit;
        if (!fit || !fit.best || !steps) return null;
        const profile = this.profile ?? this._loaded.plan.profile;
        const wanted = Number(profile?.target_weight);
        const changed = finite(wanted) && wanted > 0 && wanted !== this._loaded.openedWeight;
        const stopW = changed ? wanted : this._loaded.plan.targetWeight;
        const key = [fit, profile, this._grind, stopW, this._loaded];
        const memo = this.#memo;
        if (memo.key && memo.key.every((v, i) => v === key[i])) return memo.value;
        const run = runShotModel(steps, this.#settingsOf(profile?.[NATIVE_SHAPING_KEY]), fit.best.puck, {
            grind: grindFactor(this._grind), stopW, tMax: MODEL_T_MAX,
        });
        const value = { run, steps, G: centredRate(run.out.t, run.out.W), stopW };
        this.#memo = { key, value };
        return value;
    }

    #settingsOf(block) {
        if (block && typeof block === 'object' && !Array.isArray(block)) return settingsFromNativeShaping(block);
        return this._loaded?.plan?.settings ?? settingsFromNativeShaping(null);
    }

    shapingPreview(block) {
        const state = this.#modelState;
        const fit = this._fit;
        if (state.kind !== 'ok' || !fit?.best) return null;
        const base = this.#editedRun(state.steps);
        if (!base) return null;
        const options = { grind: grindFactor(this._grind), stopW: base.stopW, tMax: MODEL_T_MAX };
        const pack = (run) => {
            const r = runResults(run, { dose: null, mainStep: null });
            return { t: run.out.t, P: run.out.P, Q: run.out.Q, end: run.end.t, time: r.time, peakP: r.peakP };
        };
        const saved = runShotModel(state.steps, this._loaded.plan.settings, fit.best.puck, options);
        const edited = runShotModel(state.steps, this.#settingsOf(block), fit.best.puck, options);
        return { saved: pack(saved), edited: pack(edited) };
    }

    get shotShaping() {
        const record = this._loaded?.record;
        return record ? shotShapingBlock(record) : null;
    }

    get shotPoints() {
        const series = this.#shotSeries();
        return series ? { P: series.P, Q: series.Q } : null;
    }

    #onShapingOpen = (event) => {
        this.dispatchEvent(new CustomEvent('shaping-open', {
            detail: { invoker: event.currentTarget },
            bubbles: true,
            composed: true,
        }));
    };

    #shotSeries() {
        const plan = this._loaded?.plan;
        if (!plan?.shot) return null;
        const shot = plan.shot;
        const flowQ = plan.flow && plan.flow.t.length === shot.t.length ? plan.flow.Q : shot.t.map(() => null);
        return { t: shot.t, P: shot.P, Q: flowQ, G: centredRate(shot.t, shot.W), changes: shot.changes ?? [] };
    }

    #onKey(key) {
        if (key === TARGET_SERIES || MEASURED_SERIES.includes(key)) {
            const r = seriesToggle(this._show, key);
            this._show = r.show;
            this._note = r.refused ? 'One series stays on. Show another series first.' : '';
        }
    }

    #onRun(name) {
        this._runs = { ...this._runs, [name]: !this._runs[name] };
    }

    #onGrind = (event) => {
        event.stopPropagation();
        const v = Number(event.currentTarget.value);
        this._grind = finite(v) ? Math.min(GRIND_RANGE.max, Math.max(GRIND_RANGE.min, v)) : 0;
    };

    #onGrindReset = () => {
        this._grind = 0;
    };

    #openTip(name, invoker) {
        this._tip = name;
        this.updateComplete.then(() => this.renderRoot.getElementById('tip')?.show({ invoker }));
    }

    #onTipClose = () => {
        this.renderRoot.getElementById('tip')?.hide('close');
    };

    #openDialog(id, event) {
        this.renderRoot.getElementById(id)?.show({ invoker: event.currentTarget });
    }

    #closeDialog(id) {
        this.renderRoot.getElementById(id)?.hide('close');
    }

    #chartGeometry(xMax, yMax) {
        const w = Math.max(this._size.w, 1);
        const h = Math.max(this._size.h, 1);
        const plotW = Math.max(1, w - PAD.left - PAD.right);
        const plotH = Math.max(1, h - PAD.top - PAD.bottom);
        return {
            w, h, plotW, plotH,
            x: (t) => PAD.left + (t / xMax) * plotW,
            y: (v) => PAD.top + plotH - (Math.max(0, Math.min(v, yMax)) / yMax) * plotH,
            tAt: (px) => Math.max(0, Math.min(xMax, ((px - PAD.left) / plotW) * xMax)),
        };
    }

    #frame() {
        const state = this.#modelState;
        const shot = this.#shotSeries();
        const edited = state.kind === 'ok' ? this.#editedRun(state.steps) : null;
        const parts = [];
        const times = [];
        if (shot) {
            parts.push(shot.P, shot.Q, shot.G);
            times.push(shot.t[shot.t.length - 1]);
        }
        if (edited) {
            const o = edited.run.out;
            parts.push(o.P, o.Q, o.tP, o.tQ, edited.G);
            times.push(edited.run.end.t);
        }
        const yMax = chartYMax(parts);
        const xMax = chartXMax(times);
        return { state, shot, edited, yMax, xMax, geo: this.#chartGeometry(xMax, yMax) };
    }

    #onPointer = (event) => {
        if (event.type === 'pointerdown') {
            this.#drag = true;
            event.currentTarget.setPointerCapture?.(event.pointerId);
        } else if (event.type === 'pointerup' || event.type === 'pointercancel') {
            this.#drag = false;
            return;
        } else if (!this.#drag) {
            return;
        }
        const f = this.#frame();
        if (f.state.kind !== 'ok' && !f.shot) return;
        const box = event.currentTarget.getBoundingClientRect();
        const scale = box.width > 0 ? f.geo.w / box.width : 1;
        this._cursor = f.geo.tAt((event.clientX - box.left) * scale);
    };

    #onChartKey = (event) => {
        if (event.key === 'Escape') {
            if (this._cursor !== null) {
                this._cursor = null;
                event.stopPropagation();
            }
            return;
        }
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const f = this.#frame();
        const step = (event.shiftKey ? CURSOR_JUMP_S : CURSOR_STEP_S) * (event.key === 'ArrowLeft' ? -1 : 1);
        const from = this._cursor ?? 0;
        this._cursor = Math.max(0, Math.min(f.xMax, Math.round((from + step) * 10) / 10));
    };

    #valuesAt(f, at) {
        const out = {};
        if (f.edited && this._runs.edited) {
            const o = f.edited.run.out;
            const running = at <= f.edited.run.end.t + 1e-9;
            out.edited = running ? { P: valueAt(o.t, o.P, at), Q: valueAt(o.t, o.Q, at), G: valueAt(o.t, f.edited.G, at) } : null;
        }
        if (f.shot && this._runs.shot) {
            const s = f.shot;
            const running = at <= s.t[s.t.length - 1] + 1e-9;
            out.shot = running ? { P: valueAt(s.t, s.P, at), Q: valueAt(s.t, s.Q, at), G: valueAt(s.t, s.G, at) } : null;
        }
        return out;
    }

    #readout(f) {
        const t = this.#i18n.t;
        if (this._cursor === null) {
            return t('Touch or drag on the chart, or focus it and use the arrow keys, to read the values at one time.');
        }
        const v = this.#valuesAt(f, this._cursor);
        const part = (name, values) => {
            if (values === undefined) return '';
            if (values === null) return ` ${t(name)}: ${t('not running')}.`;
            const shown = SERIES_KEYS.filter((k) => this._show[k])
                .map((k) => `${fixed(values[k], 1)} ${SERIES_UNITS[k]}`).join(', ');
            return ` ${t(name)}: ${shown}.`;
        };
        return `${t('At {t} s.', { t: this._cursor.toFixed(1) })}${part('Edited', v.edited)}${part('Shot', v.shot)}`;
    }

    #grid(f) {
        const { geo, xMax, yMax } = f;
        const yStep = yMax <= 12 ? 2 : 4;
        const xStep = xMax <= 40 ? 5 : 10;
        const ys = [];
        for (let v = 0; v <= yMax + 1e-9; v += yStep) ys.push(v);
        const xs = [];
        for (let v = 0; v <= xMax + 1e-9; v += xStep) xs.push(v);
        return svg`<g class="grid">
            ${ys.map((v) => svg`<line x1=${PAD.left} x2=${geo.w - PAD.right} y1=${geo.y(v)} y2=${geo.y(v)}></line>`)}
        </g><g class="axis">
            ${ys.map((v) => svg`<text x=${PAD.left - 10} y=${geo.y(v) + 5} text-anchor="end">${v}</text>`)}
            ${xs.map((v) => svg`<text x=${geo.x(v)} y=${geo.h - PAD.bottom + 24} text-anchor="middle">${v}</text>`)}
        </g>`;
    }

    #lines(f) {
        const { geo } = f;
        const parts = [];
        if (f.edited && this._runs.edited) {
            const run = f.edited.run;
            for (const fr of run.frames) {
                const step = f.edited.steps[fr.k];
                const end = fr.t1 ?? run.end.t;
                if (step && step.v <= 0) {
                    parts.push(svg`<rect class="bloom" x=${geo.x(fr.t0)} y=${PAD.top}
                        width=${Math.max(0, geo.x(end) - geo.x(fr.t0))} height=${geo.plotH}></rect>`);
                }
                if (fr.k > 0) {
                    parts.push(svg`<line class="step-line" x1=${geo.x(fr.t0)} x2=${geo.x(fr.t0)}
                        y1=${PAD.top} y2=${PAD.top + geo.plotH}></line>
                        <text class="step-label" x=${geo.x(fr.t0) + 4} y=${PAD.top + 14}>${fr.k + 1}</text>`);
                }
            }
        }
        if (f.shot && this._runs.shot) {
            for (const key of SERIES_KEYS) {
                if (!this._show[key]) continue;
                parts.push(svg`<path class=${`line shot s-${key}`} data-run="shot" data-series=${key}
                    d=${pathOf(f.shot.t, f.shot[key], geo.x, geo.y)}></path>`);
            }
            const base = PAD.top + geo.plotH;
            for (const at of f.shot.changes) {
                const x = geo.x(at);
                parts.push(svg`<path
                    class="shot-mark" d=${`M${x - 6} ${base}L${x + 6} ${base}L${x} ${base - 10}Z`}></path>`);
            }
        }
        if (f.edited && this._runs.edited) {
            const o = f.edited.run.out;
            if (this._show[TARGET_SERIES]) {
                parts.push(svg`<path
                    class="line target t-P" data-run="edited" data-series="tP" d=${pathOf(o.t, o.tP, geo.x, geo.y)}></path>`);
                parts.push(svg`<path
                    class="line target t-Q" data-run="edited" data-series="tQ" d=${pathOf(o.t, o.tQ, geo.x, geo.y)}></path>`);
            }
            const values = { P: o.P, Q: o.Q, G: f.edited.G };
            for (const key of SERIES_KEYS) {
                if (!this._show[key]) continue;
                parts.push(svg`<path class=${`line edited s-${key}`} data-run="edited" data-series=${key}
                    d=${pathOf(o.t, values[key], geo.x, geo.y)}></path>`);
            }
        }
        if (this._cursor !== null) {
            const x = geo.x(this._cursor);
            parts.push(svg`<line
                class="cursor" x1=${x} x2=${x} y1=${PAD.top} y2=${PAD.top + geo.plotH}></line>`);
            const v = this.#valuesAt(f, this._cursor);
            for (const run of ['edited', 'shot']) {
                const values = v[run];
                if (!values) continue;
                for (const key of SERIES_KEYS) {
                    if (!this._show[key] || !finite(values[key])) continue;
                    parts.push(svg`<circle
                        class=${`dot ${key}`} cx=${x} cy=${geo.y(values[key])} r="6"></circle>`);
                }
            }
        }
        return parts;
    }

    #cursorLabel(f) {
        const t = this.#i18n.t;
        if (this._cursor === null) return nothing;
        const v = this.#valuesAt(f, this._cursor);
        const keys = SERIES_KEYS.filter((k) => this._show[k]);
        const x = f.geo.x(this._cursor);
        const left = x > f.geo.w / 2;
        const style = left
            ? `inset-inline-end: ${Math.max(0, f.geo.w - x + 12)}px`
            : `inset-inline-start: ${x + 12}px`;
        const row = (name, values) => (values === undefined ? nothing : html`<tr>
            <th scope="row">${t(name)}</th>
            ${values === null
                ? html`<td colspan=${keys.length}>${t('not running')}</td>`
                : keys.map((k) => html`<td class="ui-numeric">${fixed(values[k], 1)}</td>`)}
        </tr>`);
        return html`<div id="cur-label" style=${style} aria-hidden="true">
            <table>
                <tr><th>${t('{t} s', { t: this._cursor.toFixed(1) })}</th>
                    ${keys.map((k) => html`<th>${SERIES_UNITS[k]}</th>`)}</tr>
                ${row('Edited', v.edited)}
                ${row('Shot', v.shot)}
            </table>
        </div>`;
    }

    #noModel(state) {
        const t = this.#i18n.t;
        if (state.kind === 'ok') return nothing;
        if (state.kind === 'empty') {
            return html`<div id="no-model" role="status">
                <p id="no-model-t" class="ui-title-sm">${t('Pick a shot to see the model.')}</p>
                <p id="no-model-c" class="ui-caption">${t('Tap the profile name to pick a shot.')}</p>
            </div>`;
        }
        const reason = t(NOT_USABLE_WORDS[state.reason] ?? state.reason);
        return html`<div id="no-model" role="status" data-reason=${state.reason}>
            <p id="no-model-t" class="ui-title-sm">${state.kind === 'shot'
                ? t('The model cannot run this shot ({reason})', { reason })
                : t('The model cannot run the edited profile ({reason})', { reason })}</p>
            <p id="no-model-c" class="ui-caption">${state.kind === 'shot'
                ? t('The profile of this shot is loaded: edit it, then Save. To see the model, pick a Bengle shot with a target weight.')
                : t('Change the profile back to see the model.')}</p>
        </div>`;
    }

    #results(f) {
        const loaded = this._loaded;
        if (!loaded?.plan.shot) return null;
        const dose = loaded.plan.dose ?? 0;
        const mainStep = loaded.mainStep;
        const shot = shotResults(loaded.plan.shot, loaded.plan.flow, { dose, mainStep });
        const edited = f.edited ? runResults(f.edited.run, { dose, mainStep }) : null;
        return { shot, edited, mainStep, dose };
    }

    #resultsTable(f) {
        const t = this.#i18n.t;
        const r = this.#results(f);
        if (!r) return html`
            <p>${t('Pick a shot to see the model.')}</p>`;
        const step = Array.isArray(this.profile?.steps) ? this.profile.steps[r.mainStep] : null;
        const target = stepTarget(step);
        const targetText = finite(target) ? `${target} ${step.pump === 'flow' ? 'mL/s' : 'bar'}` : '–';
        const rows = [
            ['time', t('Shot time, s'), 'time', 1, (v) => fixed(v, 1)],
            ['peak', t('Peak pressure, bar'), 'peakP', 2, (v) => fixed(v, 2)],
            ['flow', t('Mean flow in step {n} ({target}), mL/s', { n: finite(r.mainStep) ? r.mainStep + 1 : '–', target: targetText }), 'meanQ', 2, (v) => fixed(v, 2)],
            ['weight', t('Final weight, g'), 'W', 1, (v) => fixed(v, 1)],
            ['ratio', t('Ratio'), 'ratio', 2, (v) => (finite(v) ? `1 : ${v.toFixed(2)}` : '–')],
        ];
        const change = (key, digits) => {
            const d = resultChange(r.shot[key], r.edited ? r.edited[key] : null, digits);
            if (d === null || !finite(d)) return '–';
            return `${d > 0 ? '+' : ''}${d.toFixed(digits)}`;
        };
        return html`<table class="table" id="results-table">
            <thead><tr><th scope="col">${t('Result')}</th><th scope="col">${t('Shot')}</th>
                <th scope="col">${t('Edited')}</th><th scope="col">${t('Change')}</th></tr></thead>
            <tbody>
                ${rows.map(([id, label, key, digits, show]) => html`<tr data-row=${id}>
                    <th scope="row">${label}</th>
                    <td class="ui-numeric">${show(r.shot[key])}</td>
                    <td class="ui-numeric">${r.edited ? show(r.edited[key]) : '–'}</td>
                    <td class="ui-numeric">${change(key, digits)}</td>
                </tr>`)}
                <tr data-row="ended">
                    <th scope="row">${t('Run ended')}</th>
                    <td>–</td>
                    <td>${r.edited ? t(RUN_END_WORDS[r.edited.why] ?? r.edited.why) : '–'}</td>
                    <td>–</td>
                </tr>
            </tbody>
        </table>`;
    }

    #changedSteps() {
        const now = Array.isArray(this.profile?.steps) ? this.profile.steps : [];
        const was = Array.isArray(this.baseline?.steps) ? this.baseline.steps : [];
        let n = 0;
        now.forEach((s, i) => {
            const b = was[i];
            if (!b || stepTarget(s) !== stepTarget(b) || s.seconds !== b.seconds) n++;
        });
        return n;
    }

    #onStepValue(index, field, event) {
        event.stopPropagation();
        const value = Number(event.detail?.value);
        if (!finite(value)) return;
        this.dispatchEvent(new CustomEvent('step-change', {
            bubbles: true, composed: true, detail: { index, field, value },
        }));
    }

    #onStepsReset = () => {
        const now = Array.isArray(this.profile?.steps) ? this.profile.steps : [];
        const was = Array.isArray(this.baseline?.steps) ? this.baseline.steps : [];
        now.forEach((s, i) => {
            const b = was[i];
            if (!b || b.pump !== s.pump) return;
            const field = s.pump === 'flow' ? 'flow' : 'pressure';
            for (const [key, value] of [[field, b[field]], ['seconds', b.seconds]]) {
                if (finite(value) && s[key] !== value) {
                    this.dispatchEvent(new CustomEvent('step-change', {
                        bubbles: true, composed: true, detail: { index: i, field: key, value },
                    }));
                }
            }
        });
    };

    #exitText(exit) {
        const t = this.#i18n.t;
        if (!exit || !finite(exit.value)) return t('none');
        const unit = exit.type === 'flow' ? 'mL/s' : 'bar';
        const words = {
            'pressure-over': 'pressure over {v} {unit}',
            'pressure-under': 'pressure under {v} {unit}',
            'flow-over': 'flow over {v} {unit}',
            'flow-under': 'flow under {v} {unit}',
        };
        const key = words[`${exit.type}-${exit.condition === 'under' ? 'under' : 'over'}`];
        return key ? t(key, { v: exit.value, unit }) : t('none');
    }

    #stepsBody() {
        const t = this.#i18n.t;
        const steps = Array.isArray(this.profile?.steps) ? this.profile.steps : [];
        if (!steps.length) return html`
            <p>${t('No profile is open')}</p>`;
        const machineClass = this.boot?.capabilities?.machineClass?.() ?? null;
        const seconds = authoringRange('seconds', machineClass);
        return steps.map((s, i) => {
            const flow = s.pump === 'flow';
            const field = flow ? 'flow' : 'pressure';
            const name = typeof s.name === 'string' && s.name ? s.name : t('Step {n}', { n: i + 1 });
            const modelled = s.pump === 'flow' || s.pump === 'pressure';
            const target = modelled ? modeRanges(s.pump, machineClass).target : null;
            return html`<div class="step-block" data-step=${i}>
                <p class="ui-title-sm">${i + 1}. ${name}</p>
                <div class="step-grid">
                    ${modelled ? html`<ui-stepper
                        class="step-target"
                        label=${flow ? t('Step {n} target, mL/s', { n: i + 1 }) : t('Step {n} target, bar', { n: i + 1 })}
                        unit=${flow ? 'mL/s' : 'bar'}
                        .value=${Number(s[field]) || 0}
                        .min=${target.min}
                        .max=${target.max}
                        .step=${target.step}
                        @change=${(e) => this.#onStepValue(i, field, e)}
                    ></ui-stepper>` : nothing}
                    <ui-stepper
                        class="step-seconds"
                        label=${t('Step {n} time limit, s', { n: i + 1 })}
                        unit="s"
                        .value=${Number(s.seconds) || 0}
                        .min=${seconds.min}
                        .max=${seconds.max}
                        .step=${seconds.step}
                        @change=${(e) => this.#onStepValue(i, 'seconds', e)}
                    ></ui-stepper>
                    <p class="ui-caption">${t('Exit')}: ${this.#exitText(s.exit)}</p>
                </div>
            </div>`;
        });
    }

    #tipBody() {
        const t = this.#i18n.t;
        const name = this._tip;
        if (!name) return nothing;
        if (name === 'results') {
            const loaded = this._loaded;
            const f = this.#frame();
            return html`<p>${t('Shot: the loaded shot, as recorded. Edited: the model run. The model stops the run at {weight} g in the cup. Change: edited minus shot. Ratio: weight out against {dose} g in.', {
                weight: fixed(f.edited?.stopW ?? loaded?.plan.targetWeight ?? null, 1),
                dose: fixed(loaded?.plan.dose ?? null, 1),
            })}</p>`;
        }
        return TIPS[name].body.map((p) => html`
            <p>${t(p)}</p>`);
    }

    #pickerRows() {
        const t = this.#i18n.t;
        const loadedId = this._loaded?.id ?? null;
        const rows = this._rows.map((row) => {
            const when = row.clock.ok ? `${row.clock.dateFull} ${row.clock.time}` : '–';
            const loaded = row.id === loadedId;
            const time = row.time ?? null;
            return html`<li><button
                type="button"
                class="shot-row"
                data-id=${row.id}
                aria-current=${loaded ? 'true' : 'false'}
                @click=${() => this.#onRowPick(row)}
            >
                <span class="when ui-numeric">${when}</span>
                <span class="nums ui-numeric">${fixed(row.dose, 1)} g → ${fixed(row.yield, 1)} g · ${fixed(time, 1)} s</span>
                <span class="title">${row.title || t('Untitled')}</span>
                <span class="tags">${loaded ? html`<span
                    class="tag loaded">${t('Loaded')}</span>` : nothing}${row.de1
                    ? html`<span
                        class="tag de1">${t('DE1')}</span>` : nothing}${row.noTarget
                    ? html`<span
                        class="tag no-target">${t('No target weight')}</span>` : nothing}</span>
            </button></li>`;
        });
        let note = nothing;
        if (this._listStatus === 'loading') note = html`<li class="list-note" role="status">${t('Loading…')}</li>`;
        else if (this._listStatus === 'failed') note = html`<li class="list-note" role="status">${t('The shots did not load.')}</li>`;
        else if (this._listStatus === 'ready' && !this._rows.length) note = html`<li class="list-note">${t('No shots yet.')}</li>`;
        return html`${rows}${note}`;
    }

    #pendingText() {
        const t = this.#i18n.t;
        const row = this._pending;
        if (!row) return '';
        const when = row.clock.ok ? `${row.clock.dateFull} ${row.clock.time}` : '–';
        return t('Shot {when} · {profile} · {nums}.', {
            when, profile: row.title || t('Untitled'), nums: `${fixed(row.dose, 1)} g → ${fixed(row.yield, 1)} g`,
        });
    }

    render() {
        const t = this.#i18n.t;
        const f = this.#frame();
        const ok = f.state.kind === 'ok';
        const fit = this._fit?.best ?? null;
        const rms = fit?.check?.rmsAll ?? null;
        const r = this.#results(f);
        const changed = this.#changedSteps();
        const stepCount = Array.isArray(this.profile?.steps) ? this.profile.steps.length : 0;
        const grindText = `x${grindFactor(this._grind).toFixed(2)}`;
        const grindWord = this._grind === 0 ? t('as loaded shot') : (this._grind < 0 ? t('finer') : t('coarser'));
        const fitting = this._fitting && this._loaded?.plan.usable;
        const shaping = !de1EmulationOf(this.profile);

        return html`
            <div class="notes">
                ${de1EmulationOf(this.profile) ? html`<p
                    id="de1-notice" role="status">${t('DE1 emulation is on. The machine then ignores the native shaping, and this model does not cover DE1 emulation. Turn DE1 emulation off in Settings to use this chart.')}</p>` : nothing}
                ${ok && fit && isPoorFit(rms) ? html`<p id="fit-warn" role="status">${t('Model fit is poor for this shot: {rms} bar rms', { rms: rms.toFixed(2) })}</p>` : nothing}
                ${fitting ? html`<p
                    id="fit-caption" class="ui-caption" role="status">${t('The model is fitting to this shot.')}</p>` : nothing}
            </div>

            <div id="toolbar">
                <h2 class="ui-title-sm">${t('Model run')}</h2>
                <ui-icon-button class="info" id="tip-chart-btn" label=${t('About the model run')}
                    @click=${(e) => this.#openTip('chart', e.currentTarget)}>${infoIcon()}</ui-icon-button>
                <button type="button" class="chip" id="lg-edited" ?disabled=${!ok}
                    aria-pressed=${this._runs.edited ? 'true' : 'false'} @click=${() => this.#onRun('edited')}
                    ><span class="swatch"></span>${t('Edited')}</button>
                <button type="button" class="chip" id="lg-shot" ?disabled=${!ok}
                    aria-pressed=${this._runs.shot ? 'true' : 'false'} @click=${() => this.#onRun('shot')}
                    ><span class="swatch"></span>${t('Shot')}</button>
                <span class="spacer"></span>
                ${[['P', 'lk-P'], ['Q', 'lk-Q'], ['G', 'lk-G'], [TARGET_SERIES, 'lk-T']].map(([key, id]) => html`<button
                    type="button"
                    class=${`chip key k-${key === TARGET_SERIES ? 'T' : key}`}
                    id=${id}
                    ?disabled=${!ok}
                    aria-pressed=${this._show[key] ? 'true' : 'false'}
                    @click=${() => this.#onKey(key)}
                ><span class="swatch"></span>${t(SERIES_NAMES[key])}</button>`)}
                <p id="chart-note" class="ui-caption sr-status" role="status">${this._note ? t(this._note) : ''}</p>
            </div>

            <div id="chart-wrap">
                <svg
                    id="main-chart"
                    tabindex="0"
                    role="group"
                    aria-label=${t('Model run')}
                    aria-describedby="readout"
                    viewBox=${`0 0 ${f.geo.w} ${f.geo.h}`}
                    @pointerdown=${this.#onPointer}
                    @pointermove=${this.#onPointer}
                    @pointerup=${this.#onPointer}
                    @pointercancel=${this.#onPointer}
                    @keydown=${this.#onChartKey}
                >${this._size.w > 0 ? svg`${this.#grid(f)}${this.#lines(f)}` : nothing}</svg>
                ${this.#cursorLabel(f)}
                ${this.#noModel(f.state)}
                <p id="readout" class="sr-only" aria-live="polite">${this.#readout(f)}</p>
            </div>

            <div id="strip" class=${shaping ? 'has-shaping' : ''}>
                <div class="card" id="grind-card">
                    <div class="card-head">
                        <span class="ui-microcap">${t('Grind')}</span>
                        <ui-icon-button class="info" id="tip-grind-btn" label=${t('About the grind')}
                            @click=${(e) => this.#openTip('grind', e.currentTarget)}>${infoIcon()}</ui-icon-button>
                        <span class="spacer"></span>
                        <span class="grind-out"><output id="grind-x" class="ui-numeric">${grindText}</output>
                            <span id="grind-word" class="ui-caption">${grindWord}</span></span>
                        <button type="button" class="chip action" id="grind-reset" ?disabled=${this._grind === 0} @click=${this.#onGrindReset}>${t('Reset')}</button>
                    </div>
                    <div class="grind-row">
                        <span class="ui-caption">${t('Finer (x2)')}</span>
                        <ui-slider
                            id="grind"
                            label=${t('Grind')}
                            value-text=${`${grindText} ${grindWord}`}
                            .min=${GRIND_RANGE.min}
                            .max=${GRIND_RANGE.max}
                            step=${String(GRIND_RANGE.step)}
                            .value=${this._grind}
                            ?disabled=${!ok}
                            @change=${this.#onGrind}
                        ></ui-slider>
                        <span class="ui-caption">${t('Coarser (x0.5)')}</span>
                    </div>
                </div>

                ${shaping ? html`<button type="button" class="card" id="shaping-entry" aria-haspopup="dialog"
                    @click=${this.#onShapingOpen}>${t('Native shaping')}</button>` : nothing}

                <button type="button" class="card" id="keys-btn" aria-haspopup="dialog"
                    @click=${(e) => this.#openDialog('results', e)}>
                    <span class="ui-microcap">${t('Peak pressure')}</span>
                    <span id="kn-peak" class="big ui-numeric">${r?.edited ? `${r.edited.peakP.toFixed(2)} bar` : '–'}</span>
                    <span id="kn-peak-s" class="ui-caption ui-numeric">${t('shot {v} bar', { v: r ? r.shot.peakP.toFixed(2) : '–' })}</span>
                </button>

                <button type="button" class="card" id="steps-entry" aria-haspopup="dialog"
                    @click=${(e) => this.#openDialog('steps-sheet', e)}>
                    <span class="ui-microcap">${t('Step targets')}</span>
                    <span id="steps-sum" class="ui-caption">${changed
                        ? `${t('{n} changed', { n: changed })} · ${t('{n} steps', { n: stepCount })}`
                        : t('{n} steps', { n: stepCount })}</span>
                </button>
            </div>

            <ui-dialog id="results" heading=${t('Results')}>
                <ui-icon-button slot="header-trail" class="info" id="tip-results-btn" label=${t('About the results')}
                    @click=${(e) => this.#openTip('results', e.currentTarget)}>${infoIcon()}</ui-icon-button>
                <div slot="body">${this.#resultsTable(f)}</div>
                <button type="button" class="chip action" slot="actions" id="results-close" @click=${() => this.#closeDialog('results')}>${t('Close')}</button>
            </ui-dialog>

            <ui-dialog id="steps-sheet" heading=${t('Step targets')}>
                <ui-icon-button slot="header-trail" class="info" id="tip-steps-btn" label=${t('About the step targets')}
                    @click=${(e) => this.#openTip('steps', e.currentTarget)}>${infoIcon()}</ui-icon-button>
                <div slot="body">${this.#stepsBody()}</div>
                <button type="button" class="chip action" slot="actions" id="steps-reset" ?disabled=${!changed} @click=${this.#onStepsReset}>${t('Reset to saved')}</button>
                <button type="button" class="chip action" slot="actions" id="steps-close" @click=${() => this.#closeDialog('steps-sheet')}>${t('Close')}</button>
            </ui-dialog>

            <ui-dialog id="tip" heading=${this._tip ? t(TIPS[this._tip].heading) : ''}>
                <div slot="body" class="tip">${this.#tipBody()}</div>
                <button type="button" class="chip action" slot="actions" id="tip-close" @click=${this.#onTipClose}>${t('Close')}</button>
            </ui-dialog>

            <ui-dialog
                id="picker"
                placement="start"
                label=${t('Pick a shot')}
                @open-change=${this.#onPickerOpenChange}
            >
                <div slot="header" class="picker-head">
                    <h2 id="picker-h" class="ui-title-sm">${t('Pick a shot')}</h2>
                    <ui-icon-button class="info" id="tip-shots-btn" label=${t('About picking a shot')}
                        @click=${(e) => this.#openTip('shots', e.currentTarget)}>${infoIcon()}</ui-icon-button>
                    <button type="button" class="chip action" id="picker-close" @click=${() => this.closePicker()}>${t('Close')}</button>
                </div>
                <div slot="body" class="picker-body">
                    <div class="picker-top">
                        <p class="picker-caption ui-caption">${t('Newest first. A shot loads the profile it ran into the editor, and the model fits the puck to that shot.')}</p>
                        ${this._loadError ? html`<p
                            id="load-error" class="ui-caption" role="status">${t(this._loadError)}</p>` : nothing}
                    </div>
                    <ul id="shot-list" @scroll=${this.#onListScroll}>${this.#pickerRows()}</ul>
                </div>
                <ui-dialog id="load-confirm" heading=${t('Load this shot?')}
                    @close-request=${this.#onConfirmClose}>
                    <div slot="body" id="load-confirm-desc"><p>${t('Your edits are discarded.')}</p><p>${this.#pendingText()}</p></div>
                    <button type="button" class="chip action" slot="actions" id="load-cancel" @click=${this.#onConfirmCancel}>${t('Cancel')}</button>
                    <button type="button" class="chip action primary" slot="actions" id="load-go" @click=${this.#onConfirmLoad}>${t('Load')}</button>
                </ui-dialog>
            </ui-dialog>
        `;
    }
}

customElements.define('editor-chart-panel', EditorChartPanel);
