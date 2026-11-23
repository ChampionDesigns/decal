import { css, html, nothing, svg } from 'lit';
import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import 'src/components/ui-dialog.js';
import 'src/components/ui-icon-button.js';
import 'src/components/ui-stepper.js';
import {
    DEFAULT_PUMP_CURVE, NATIVE_SHAPING_DEFAULTS, NATIVE_SHAPING_LIMITS, NATIVE_SHAPING_MODES,
    checkNativeShaping, movePoint,
} from 'src/lib/native-shaping-rules.js';
import {
    CURVE_AXES, DE1_240V_CURVE, benglePumpLine, pumpCurveLine, rampResponse, stepResponse,
} from 'src/lib/native-shaping-curves.js';
import { WIRE_STEPS_PER_UNIT, wireUnits } from 'src/lib/shot-model.js';

const GRAB_PX = 36;
const PRESSURE_KEY_STEP = 0.1;
const PRESSURE_KEY_JUMP = 0.5;
const FLOW_KEY_STEP = 0.1;
const FLOW_KEY_JUMP = 1;
const CURVE_PAD = Object.freeze({ left: 70, right: 18, top: 16, bottom: 52 });
const MINI_PAD = Object.freeze({ left: 44, right: 8, top: 22, bottom: 30 });
const PREVIEW_PAD = Object.freeze({ left: 44, right: 12, top: 12, bottom: 30 });
const MODE_WORDS = Object.freeze({ both: 'Both', rise: 'Rise', fall: 'Fall' });

const TIPS = Object.freeze({
    modal: {
        heading: 'Native shaping',
        body: ['How the Bengle shapes the targets of this profile. Bengle only. Changes here show in the preview at once; Apply sends them to the Chart tab. Save stores them with the profile.'],
    },
    curve: {
        heading: 'Pump curve',
        body: [
            'Drag a point: the nearest point within about 36 px moves. With a keyboard, Tab to a point; the arrow keys move it (left and right: pressure, 0.1 bar; up and down: flow, 0.1 mL/s; Shift: 0.5 bar or 1 mL/s). This screen does not add or remove points.',
            'The point at 0 bar, 20 mL/s is fixed. Pressure 0.5 to 13.5 bar, each point at least 0.5 bar above the one before. Flow 0 to 20 mL/s, never rising. Curve off: no curve. Pale dots: the loaded shot, flow against pressure.',
            'Orange dashed line: the Bengle pump. 20 mL/s from 0 to 5.5 bar, then down to 0 mL/s at 13.5 bar.',
            'Dashed grey line: the most flow a DE1 gives at each pressure on 240 V mains, from the 240 V table of the DE1 pump model: about 10.7 mL/s at 0 bar, 5.6 at 6 bar, 1.8 at 12 bar. It shows how a DE1 behaves. It is not a limit of this machine.',
        ],
    },
    ftau: {
        heading: 'Flow τ',
        body: [
            'Time constant of a flow step, 0 to 5 s, in steps of 0.02 s. 0 = a plain step. Both, Rise, Fall: the step directions it acts on.',
            'Chart: a flow step up at 0 s and down at 2.5 s. Dashed: the step. Solid: the shaped target.',
        ],
    },
    ptau: {
        heading: 'Pressure τ',
        body: [
            'Time constant of a pressure step, 0 to 5 s, in steps of 0.02 s. 0 = a plain step. Both, Rise, Fall: the step directions it acts on.',
            'Chart: a pressure step up at 0 s and down at 2.5 s. Dashed: the step. Solid: the shaped target.',
        ],
    },
    rfac: {
        heading: 'Ramp factor',
        body: [
            'Smooth steps: the ramp, then a filter with time constant ramp factor × τ. 0 to 4, in steps of 0.02; 0 = the plain ramp.',
            'Chart: a smooth pressure step, 2 to 9 bar in 4 s, with pressure τ times the ramp factor. Dashed: the ramp. Solid: the shaped target.',
        ],
    },
    preview: {
        heading: 'Preview',
        body: ['Thin: the edited profile with the values of the loaded shot. Bold: the values in this screen. Same puck, grind and step targets as the Chart tab.'],
    },
});

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

function infoIcon() {
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
        ><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6"></path><path d="M12 7.5v.5"></path></svg>`;
}

function linePath(points, x, y) {
    return points.map(([a, b], i) => `${i ? 'L' : 'M'}${x(a).toFixed(1)} ${y(b).toFixed(1)}`).join('');
}

function seriesPath(t, values, x, y) {
    let d = '';
    let pen = false;
    for (let i = 0; i < t.length; i++) {
        if (!finite(values[i]) || !finite(t[i])) {
            pen = false;
            continue;
        }
        d += `${pen ? 'L' : 'M'}${x(t[i]).toFixed(1)} ${y(values[i]).toFixed(1)}`;
        pen = true;
    }
    return d;
}

function onStep(value, perUnit) {
    return wireUnits(value, perUnit) / perUnit;
}

function draftFrom(block) {
    const d = NATIVE_SHAPING_DEFAULTS;
    const b = block && typeof block === 'object' && !Array.isArray(block) ? block : {};
    const points = Array.isArray(b.pump_curve)
        ? b.pump_curve
            .filter((pt) => pt && finite(Number(pt.pressure)) && finite(Number(pt.flow)))
            .map((pt) => ({ pressure: Number(pt.pressure), flow: Number(pt.flow) }))
        : [];
    const num = (v, fallback) => (finite(Number(v)) && v !== null && v !== '' ? Number(v) : fallback);
    const mode = (v) => (NATIVE_SHAPING_MODES.includes(v) ? v : 'both');
    return {
        on: points.length > 0,
        points,
        flowTau: num(b.flow_tau, d.flow_tau),
        flowMode: mode(b.flow_mode),
        pressureTau: num(b.pressure_tau, d.pressure_tau),
        pressureMode: mode(b.pressure_mode),
        ramp: num(b.ramp_factor, d.ramp_factor),
    };
}

function blockFromDraft(draft) {
    return {
        version: NATIVE_SHAPING_LIMITS.version,
        pump_curve: draft.on ? draft.points.map((pt) => ({ pressure: pt.pressure, flow: pt.flow })) : [],
        flow_tau: draft.flowTau,
        flow_mode: draft.flowMode,
        pressure_tau: draft.pressureTau,
        pressure_mode: draft.pressureMode,
        ramp_factor: draft.ramp,
    };
}

function sameValue(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

export class EditorShapingDialog extends UiElement {
    static properties = {
        shot: { attribute: false },
        previewer: { attribute: false },
        _draft: { state: true },
        _selected: { state: true },
        _preview: { state: true },
        _tip: { state: true },
        _sizes: { state: true },
    };

    static styles = [typeRoles, css`
        :host {
            --_sd-hit: max(var(--ui-hit-min), var(--_ui-hit-floor, 0px));
            display: contents;
        }

        .top {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        .top h2 {
            margin: 0;
        }

        .title {
            display: flex;
            align-items: center;
        }

        .spacer {
            flex: 1 1 0;
        }

        .chip {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: var(--ui-space-2);
            min-block-size: var(--_sd-hit);
            min-inline-size: var(--_sd-hit);
            padding-inline: var(--ui-space-4);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            background-color: transparent;
            color: var(--ui-text);
            font: inherit;
            cursor: pointer;
        }

        .chip[aria-pressed="true"] {
            border-color: var(--ui-steel);
        }

        .chip .box {
            inline-size: 16px;
            block-size: 16px;
            border: var(--ui-border-w-strong, 2px) solid var(--ui-text-2);
            border-radius: 3px;
        }

        .chip[aria-pressed="true"] .box {
            border-color: var(--ui-steel);
            background-color: var(--ui-steel);
        }

        .chip.primary {
            border-color: var(--ui-steel);
            background-color: var(--ui-steel);
            color: var(--ui-on-steel);
        }

        .chip:disabled {
            opacity: .5;
            cursor: default;
        }

        ui-icon-button.info {
            --_ui-icon-btn-box: var(--_sd-hit);
            --_ui-icon-btn-border: 0;
        }

        #shape-slot {
            flex: 1 1 auto;
            display: flex;
            flex-direction: column;
            min-block-size: 0;
        }

        #shape-body {
            flex: 1 1 auto;
            display: grid;
            grid-template-columns: minmax(0, 1.36fr) minmax(0, 1fr);
            grid-template-rows: minmax(0, 1fr);
            gap: var(--ui-space-3) var(--ui-space-4);
            min-block-size: 0;
            padding: var(--ui-space-4) var(--ui-space-6);
            background-color: var(--ui-fascia);
        }

        #shape-body.prev {
            grid-template-rows: minmax(0, 1fr) minmax(max-content, .5fr);
        }

        .panel {
            min-inline-size: 0;
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            background-color: var(--ui-surface);
        }

        #curve-sec {
            display: flex;
            flex-direction: column;
            gap: var(--ui-space-2);
            min-block-size: 0;
            padding: var(--ui-space-2) var(--ui-space-4) var(--ui-space-3);
        }

        .head {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: var(--ui-space-2);
            min-inline-size: 0;
        }

        .head h3,
        .card-head h3 {
            margin: 0;
            white-space: nowrap;
        }

        .bank {
            display: inline-flex;
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
        }

        .bank button {
            min-block-size: var(--_sd-hit);
            min-inline-size: var(--_sd-hit);
            padding: 0 var(--ui-space-3);
            border: 0;
            background: transparent;
            color: var(--ui-text-2);
            font: inherit;
            white-space: nowrap;
            cursor: pointer;
        }

        .bank button + button {
            border-inline-start: var(--ui-border-w) solid var(--ui-line);
        }

        .bank button[aria-pressed="true"] {
            background-color: var(--ui-steel);
            color: var(--ui-on-steel);
        }

        #curve-box {
            position: relative;
            flex: 1 1 auto;
            min-block-size: 120px;
        }

        #curve-chart,
        .mini > svg,
        #preview-chart {
            position: absolute;
            inset-block-start: 0;
            inset-inline-start: 0;
            display: block;
            touch-action: none;
        }

        .tick {
            fill: var(--ui-text-2);
            font-size: 13px;
        }

        .pt {
            cursor: grab;
            outline: none;
        }

        .pt .ring {
            fill: none;
            stroke: transparent;
        }

        .pt:focus-visible .ring {
            stroke: var(--ui-steel);
        }

        #m-right {
            display: grid;
            grid-template-rows: repeat(3, minmax(min-content, 1fr));
            gap: var(--ui-space-3);
            min-block-size: 0;
            overflow-y: auto;
            overscroll-behavior: contain;
        }

        .ctl-card {
            display: grid;
            grid-template-columns: max-content minmax(0, 1fr);
            gap: 0 var(--ui-space-4);
            padding: var(--ui-space-1) var(--ui-space-3) var(--ui-space-1) var(--ui-space-4);
        }

        .ctl-side {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: var(--ui-space-1);
            min-inline-size: 0;
        }

        .card-head {
            display: flex;
            align-items: center;
            min-block-size: var(--_sd-hit);
        }

        .card-head .tt {
            display: grid;
        }

        .ctl-side .bank {
            display: flex;
        }

        .ctl-side .bank button {
            flex: 1 1 0;
            padding: 0 var(--ui-space-2);
        }

        .mini {
            position: relative;
            min-inline-size: 0;
            min-block-size: 96px;
            margin-block: var(--ui-space-1);
        }

        #preview-sec {
            grid-column: 1 / -1;
            display: flex;
            flex-direction: column;
            gap: var(--ui-space-1);
            min-block-size: 0;
            padding: var(--ui-space-1) var(--ui-space-4) var(--ui-space-2);
        }

        #preview-box {
            position: relative;
            flex: 1 1 auto;
            min-block-size: 120px;
        }

        #preview-sum {
            margin: 0;
            font-variant-numeric: tabular-nums;
        }

        .tip p {
            margin: 0 0 var(--ui-space-2);
        }

        @container (max-width: 759px) {
            #shape-body,
            #shape-body.prev {
                display: flex;
                flex-direction: column;
                overflow-y: auto;
            }

            #curve-sec {
                flex: none;
            }

            #curve-box {
                flex: none;
                block-size: 260px;
            }

            #m-right {
                flex: none;
                grid-template-rows: none;
                overflow: visible;
            }

            #preview-sec {
                flex: none;
                block-size: 260px;
            }

            .ctl-card {
                grid-template-columns: minmax(0, 1fr);
            }

            .mini {
                min-block-size: 110px;
            }
        }
    `];

    #i18n = new I18nController(this);
    #resize = null;
    #drag = null;
    #fromNone = false;
    #touched = false;

    constructor() {
        super();
        this.shot = null;
        this.previewer = null;
        this._draft = null;
        this._selected = 0;
        this._preview = false;
        this._tip = null;
        this._sizes = {};
    }

    connectedCallback() {
        super.connectedCallback();
        this.#resize ??= new ResizeObserver((entries) => {
            const next = { ...this._sizes };
            let changed = false;
            for (const entry of entries) {
                const id = entry.target.id;
                const w = Math.floor(entry.contentRect.width);
                const h = Math.floor(entry.contentRect.height);
                if (next[id]?.w !== w || next[id]?.h !== h) {
                    next[id] = { w, h };
                    changed = true;
                }
            }
            if (changed) this._sizes = next;
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.#resize?.disconnect();
    }

    updated() {
        for (const id of ['curve-box', 'ftau-chart', 'ptau-chart', 'rfac-chart', 'preview-box']) {
            const el = this.renderRoot.getElementById(id);
            if (el && !el.dataset.watched) {
                el.dataset.watched = '1';
                this.#resize?.observe(el);
            }
        }
    }

    get open() {
        return this._draft !== null;
    }

    get draft() {
        return this._draft;
    }

    get result() {
        if (!this._draft) return null;
        return checkNativeShaping(blockFromDraft(this._draft));
    }

    show({ block = null, invoker = null } = {}) {
        const given = block && typeof block === 'object' && !Array.isArray(block) ? block : null;
        this.#fromNone = given === null;
        this.#touched = false;
        this._draft = draftFrom(given);
        this._selected = 0;
        this.updateComplete.then(() => {
            const dialog = this.renderRoot.getElementById('shape-dialog');
            dialog?.show({ invoker });
            this.updateComplete.then(() => this.renderRoot.getElementById('shape-cancel')?.focus({ preventScroll: true }));
        });
    }

    hide() {
        this.renderRoot.getElementById('shape-dialog')?.hide('close');
    }

    #onOpenChange = (event) => {
        if (event.target?.id !== 'shape-dialog') return;
        if (!event.detail?.open) {
            this._draft = null;
            this.#drag = null;
        }
    };

    #outBlock(result) {
        return this.#fromNone && !this.#touched ? null : result.block;
    }

    #apply = () => {
        const result = this.result;
        if (!result?.ok) return;
        const block = this.#outBlock(result);
        this.dispatchEvent(new CustomEvent('shaping-apply', {
            detail: { block },
            bubbles: true,
            composed: true,
        }));
        this.hide();
    };

    #set(patch) {
        const draft = this._draft;
        if (Object.keys(patch).some((k) => !sameValue(patch[k], draft[k]))) this.#touched = true;
        this._draft = { ...draft, ...patch };
    }

    #curveOn(on) {
        if (!this._draft) return;
        if (on && !this._draft.points.length) {
            this.#set({ on: true, points: DEFAULT_PUMP_CURVE.map((pt) => ({ ...pt })) });
            this._selected = 0;
            return;
        }
        this.#set({ on });
    }

    #onStepper(field, perUnit, event) {
        event.stopPropagation();
        const v = Number(event.detail?.value);
        if (!finite(v)) return;
        this.#set({ [field]: onStep(v, perUnit) });
    }

    #movePoint(i, pressure, flow) {
        this.#set({ points: movePoint(this._draft.points, i, pressure, flow) });
    }

    #geometry() {
        const size = this._sizes['curve-box'] ?? { w: 0, h: 0 };
        const w = Math.max(240, size.w);
        const h = Math.max(120, size.h);
        const p = CURVE_PAD;
        const pw = w - p.left - p.right;
        const ph = h - p.top - p.bottom;
        const x = (P) => p.left + P / CURVE_AXES.pressureMax * pw;
        const y = (Q) => p.top + ph - Q / CURVE_AXES.flowMax * ph;
        return { w, h, pw, ph, x, y, pad: p };
    }

    #localPoint(event, g) {
        const svgEl = this.renderRoot.getElementById('curve-chart');
        const box = svgEl.getBoundingClientRect();
        const sx = box.width > 0 ? g.w / box.width : 1;
        const sy = box.height > 0 ? g.h / box.height : 1;
        return { px: (event.clientX - box.left) * sx, py: (event.clientY - box.top) * sy };
    }

    #onPointer = (event) => {
        const draft = this._draft;
        if (!draft?.on || !draft.points.length) return;
        const g = this.#geometry();
        const { px, py } = this.#localPoint(event, g);
        if (event.type === 'pointerdown') {
            let best = -1;
            let bestD = GRAB_PX;
            draft.points.forEach((pt, i) => {
                const d = Math.hypot(g.x(pt.pressure) - px, g.y(pt.flow) - py);
                if (d <= bestD) {
                    best = i;
                    bestD = d;
                }
            });
            if (best < 0) return;
            const pt = draft.points[best];
            this.#drag = { i: best, dx: g.x(pt.pressure) - px, dy: g.y(pt.flow) - py, id: event.pointerId };
            this._selected = best;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            event.preventDefault();
            this.renderRoot.getElementById(`pt-${best + 1}`)?.focus({ preventScroll: true });
            return;
        }
        const drag = this.#drag;
        if (!drag || drag.id !== event.pointerId) return;
        if (event.type === 'pointermove') {
            const P = (px + drag.dx - g.pad.left) / g.pw * CURVE_AXES.pressureMax;
            const Q = (g.pad.top + g.ph - (py + drag.dy)) / g.ph * CURVE_AXES.flowMax;
            this.#movePoint(drag.i, P, Q);
            return;
        }
        this.#drag = null;
    };

    #onPointKey(i, event) {
        const pt = this._draft?.points[i];
        if (!pt) return;
        const dp = event.shiftKey ? PRESSURE_KEY_JUMP : PRESSURE_KEY_STEP;
        const dq = event.shiftKey ? FLOW_KEY_JUMP : FLOW_KEY_STEP;
        let pressure = pt.pressure;
        let flow = pt.flow;
        switch (event.key) {
            case 'ArrowLeft': pressure -= dp; break;
            case 'ArrowRight': pressure += dp; break;
            case 'ArrowUp': flow += dq; break;
            case 'ArrowDown': flow -= dq; break;
            default: return;
        }
        event.preventDefault();
        this._selected = i;
        this.#movePoint(i, pressure, flow);
    }

    #curveChart() {
        const t = this.#i18n.t;
        const draft = this._draft;
        const g = this.#geometry();
        const { x, y, pad, pw, ph } = g;
        const grid = [];
        for (let P = 0; P <= CURVE_AXES.pressureMax; P += 1) {
            if (P > 0 && P < CURVE_AXES.pressureMax) {
                grid.push(svg`<line
                    x1=${x(P)} x2=${x(P)} y1=${pad.top} y2=${pad.top + ph} stroke="var(--ui-line)"></line>`);
            }
            if (P % 2 === 0) {
                grid.push(svg`<text
                    class="tick" x=${x(P)} y=${pad.top + ph + 20} text-anchor="middle">${P}</text>`);
            }
        }
        for (let Q = 0; Q <= 20; Q += 5) {
            if (Q > 0) grid.push(svg`<line
                x1=${pad.left} x2=${pad.left + pw} y1=${y(Q)} y2=${y(Q)} stroke="var(--ui-line)"></line>`);
            grid.push(svg`<text
                class="tick" x=${pad.left - 8} y=${y(Q)} dy=".35em" text-anchor="end">${Q}</text>`);
        }
        const shot = this.shot;
        const dots = [];
        if (shot && Array.isArray(shot.P) && Array.isArray(shot.Q)) {
            for (let i = 0; i < shot.P.length; i += 2) {
                const P = shot.P[i];
                const Q = shot.Q[i];
                if (finite(P) && finite(Q) && Q > 0.05) {
                    dots.push(svg`<circle
                        class="shot-dot" cx=${x(P).toFixed(1)} cy=${y(Q).toFixed(1)} r="2.6" fill="var(--ui-channel-flow)" fill-opacity=".28"></circle>`);
                }
            }
        }
        const pump = benglePumpLine();
        const de1End = DE1_240V_CURVE[DE1_240V_CURVE.length - 1];
        const curve = pumpCurveLine(draft.points);
        const on = draft.on;
        const points = on ? draft.points.map((pt, j) => {
            const cx = x(pt.pressure).toFixed(1);
            const cy = y(pt.flow).toFixed(1);
            const me = j === this._selected;
            return svg`<g class="pt" id=${`pt-${j + 1}`} data-pt=${j} tabindex="0" role="button"
                aria-roledescription=${t('draggable point')}
                aria-label=${t('Point {n}: {p} bar, {q} mL/s', { n: j + 1, p: pt.pressure.toFixed(1), q: pt.flow.toFixed(1) })}
                @keydown=${(e) => this.#onPointKey(j, e)}
                @focus=${() => { this._selected = j; }}
            ><circle cx=${cx} cy=${cy} r="24" fill="transparent"></circle
            ><circle class="ring" cx=${cx} cy=${cy} r="15" stroke-width="2.5"></circle
            ><circle cx=${cx} cy=${cy} r="9" fill=${me ? 'var(--ui-steel)' : 'var(--ui-surface)'} stroke="var(--ui-steel)" stroke-width="3"></circle
            ></g>`;
        }) : [];
        let message = '';
        if (!on) message = t('Curve off: only the Bengle pump line limits the flow');
        return svg`
            <rect x=${pad.left} y=${pad.top} width=${pw} height=${ph} fill="var(--ui-surface)" stroke="var(--ui-line)"></rect>
            ${grid}
            <text class="tick" x=${pad.left + pw / 2} y=${g.h - 4} text-anchor="middle">${t('Pressure (bar)')}</text>
            <text class="tick" x="4" y=${Math.max(13, pad.top - 2)}>mL/s</text>
            ${dots}
            <path id="bengle-pump" d=${linePath(pump, x, y)} fill="none" stroke="var(--ui-status-busy)" stroke-width="2" stroke-dasharray="9 6"></path>
            <text id="bengle-pump-label" class="tick" x=${x(11.2) + 8} y=${y(8.5)} style="fill: var(--ui-status-busy)">${t('Bengle pump')}</text>
            <g class="de1-ref" pointer-events="none">
                <path id="de1-curve" d=${linePath(DE1_240V_CURVE, x, y)} fill="none" stroke="var(--ui-muted)" stroke-width="2" stroke-dasharray="6 4"></path>
                <text id="de1-label" class="tick" x=${x(de1End[0]) - 18} y=${y(de1End[1]) + 24} text-anchor="end" style="fill: var(--ui-muted)">${t('DE1 240 V')}</text>
            </g>
            ${curve.length ? svg`<path id="pump-curve" d=${linePath(curve, x, y)} fill="none" stroke="var(--ui-steel)" stroke-width="3"
                stroke-dasharray=${on ? nothing : '4 5'} stroke-opacity=${on ? nothing : '.45'}></path>` : nothing}
            <rect id="fixed-point" x=${x(0) - 4} y=${y(20) - 4} width="8" height="8" fill="var(--ui-muted)"><title>${t('Fixed point: 0 bar, 20 mL/s')}</title></rect>
            ${points}
            ${message ? svg`<text class="tick" x=${pad.left + pw / 2} y=${pad.top + ph / 2} text-anchor="middle">${message}</text>` : nothing}
        `;
    }

    #mini(id, data, x0, x1, yMax, color, unit) {
        const size = this._sizes[id] ?? { w: 0, h: 0 };
        const w = Math.max(160, size.w);
        const h = Math.max(60, size.h);
        const p = MINI_PAD;
        const pw = w - p.left - p.right;
        const ph = h - p.top - p.bottom;
        const x = (v) => p.left + (v - x0) / (x1 - x0) * pw;
        const y = (v) => p.top + ph - v / yMax * ph;
        const ticks = [];
        for (let v = 0; v <= yMax; v += yMax > 8 ? 3 : 2) {
            ticks.push(svg`<text
                class="tick" x=${p.left - 4} y=${y(v)} dy=".35em" text-anchor="end">${v}</text>`);
        }
        for (let s = Math.ceil(x0); s <= x1; s += 1) {
            ticks.push(svg`<line
                x1=${x(s)} x2=${x(s)} y1=${p.top} y2=${p.top + ph} stroke="var(--ui-line)"></line><text class="tick" x=${x(s)} y=${p.top + ph + 18} text-anchor="middle">${s}</text>`);
        }
        return svg`
            <rect x=${p.left} y=${p.top} width=${pw} height=${ph} fill="var(--ui-surface)" stroke="var(--ui-line)"></rect>
            ${ticks}
            <text class="tick" x=${p.left + pw} y=${p.top - 6} text-anchor="end">${unit}</text>
            <path class="raw" d=${seriesPath(data.t, data.raw, x, y)} fill="none" stroke=${color} stroke-width="1.6" stroke-dasharray="6 6"></path>
            <path class="shaped" d=${seriesPath(data.t, data.shaped, x, y)} fill="none" stroke=${color} stroke-width="3"></path>
        `;
    }

    #miniSvg(id, label, content) {
        const size = this._sizes[id] ?? { w: 0, h: 0 };
        return html`<div
            class="mini" id=${id}>${size.w > 0 ? html`<svg
            width=${size.w} height=${size.h} viewBox=${`0 0 ${size.w} ${size.h}`} role="img" aria-label=${label}
        >${content}</svg>` : nothing}</div>`;
    }

    #previewData() {
        if (!this._preview || typeof this.previewer !== 'function') return null;
        const result = this.result;
        if (!result?.ok) return null;
        return this.previewer(this.#outBlock(result));
    }

    #previewChart(data) {
        const size = this._sizes['preview-box'] ?? { w: 0, h: 0 };
        if (!data || size.w <= 0) return nothing;
        const w = size.w;
        const h = Math.max(80, size.h);
        const p = PREVIEW_PAD;
        const pw = w - p.left - p.right;
        const ph = h - p.top - p.bottom;
        const tEnd = Math.max(data.saved.end, data.edited.end, 1);
        const xMax = Math.ceil((tEnd + 0.5) / 5) * 5;
        const peak = Math.max(12, ...data.saved.P.filter(finite), ...data.edited.P.filter(finite),
            ...data.saved.Q.filter(finite), ...data.edited.Q.filter(finite));
        const yMax = Math.ceil(peak / 2) * 2;
        const x = (v) => p.left + v / xMax * pw;
        const y = (v) => p.top + ph - v / yMax * ph;
        const ticks = [];
        for (let s = 0; s <= xMax; s += 5) {
            ticks.push(svg`<text
                class="tick" x=${x(s)} y=${p.top + ph + 18} text-anchor="middle">${s}</text>`);
        }
        for (let v = 0; v <= yMax; v += 2) {
            ticks.push(svg`<text
                class="tick" x=${p.left - 4} y=${y(v)} dy=".35em" text-anchor="end">${v}</text>`);
        }
        const run = (r, width, cls) => svg`
            <path class=${`${cls} p`} d=${seriesPath(r.t, r.P, x, y)} fill="none" stroke="var(--ui-channel-pressure)" stroke-width=${width}></path>
            <path class=${`${cls} q`} d=${seriesPath(r.t, r.Q, x, y)} fill="none" stroke="var(--ui-channel-flow)" stroke-width=${width}></path>`;
        return html`<svg id="preview-chart" width=${w} height=${h} viewBox=${`0 0 ${w} ${h}`} role="img"
            aria-label=${this.#i18n.t('Preview chart of the whole profile, against the values of the loaded shot')}
        ><rect x=${p.left} y=${p.top} width=${pw} height=${ph} fill="var(--ui-surface)" stroke="var(--ui-line)"></rect
        >${ticks}${run(data.saved, 1.4, 'saved')}${run(data.edited, 3, 'edited')}</svg>`;
    }

    #previewSection() {
        const t = this.#i18n.t;
        if (!this._preview) return nothing;
        const data = this.#previewData();
        const sum = data
            ? t('Shot time: before {a} s, these values {b} s; peak pressure {c} / {d} bar.', {
                a: data.saved.time.toFixed(1), b: data.edited.time.toFixed(1),
                c: data.saved.peakP.toFixed(2), d: data.edited.peakP.toFixed(2),
            })
            : t('Load a shot in the Chart tab to see the preview.');
        return html`<section class="panel" id="preview-sec">
            <div class="head">
                <h3 class="ui-title-sm">${t('Preview: the whole profile')}</h3>
                <ui-icon-button class="info" id="tip-preview-btn" label=${t('About the preview')}
                    @click=${(e) => this.#openTip('preview', e.currentTarget)}>${infoIcon()}</ui-icon-button>
                <p id="preview-sum" class="ui-caption">${sum}</p>
            </div>
            <div id="preview-box">${this.#previewChart(data)}</div>
        </section>`;
    }

    #openTip(name, invoker) {
        this._tip = name;
        this.updateComplete.then(() => this.renderRoot.getElementById('shape-tip')?.show({ invoker }));
    }

    #modeBank(prefix, label, value, field) {
        const t = this.#i18n.t;
        return html`<div
            class="bank" role="group" aria-label=${label}>${NATIVE_SHAPING_MODES.map((m) => html`<button
            type="button" id=${`${prefix}-${m}`} aria-pressed=${value === m ? 'true' : 'false'}
            @click=${() => this.#set({ [field]: m })}>${t(MODE_WORDS[m])}</button>`)}</div>`;
    }

    #card({ id, heading, unit, tip, field, perUnit, limits, mode, chart }) {
        const t = this.#i18n.t;
        const value = this._draft[field];
        return html`<section class="panel ctl-card" id=${`${id}-sec`}>
            <div class="ctl-side">
                <div class="card-head">
                    <div class="tt"><h3 class="ui-title-sm" id=${`${id}-h`}>${t(heading)}</h3><span class="ui-caption" id=${`${id}-u`}>${t(unit)}</span></div>
                    <ui-icon-button class="info" id=${`tip-${id}-btn`} label=${t('About {name}', { name: t(heading) })}
                        @click=${(e) => this.#openTip(tip, e.currentTarget)}>${infoIcon()}</ui-icon-button>
                </div>
                <ui-stepper
                    id=${id}
                    label=${t(heading)}
                    .value=${value}
                    .min=${limits.min}
                    .max=${limits.max}
                    .step=${limits.step}
                    @change=${(e) => this.#onStepper(field, perUnit, e)}
                ></ui-stepper>
                ${mode ?? nothing}
            </div>
            ${chart}
        </section>`;
    }

    #body() {
        const t = this.#i18n.t;
        const d = this._draft;
        if (!d) return nothing;
        const L = NATIVE_SHAPING_LIMITS;
        const curveSize = this._sizes['curve-box'] ?? { w: 0, h: 0 };
        const g = this.#geometry();
        return html`
            <div id="shape-body" class=${this._preview ? 'prev' : ''}>
                <section class="panel" id="curve-sec">
                    <div class="head">
                        <h3 class="ui-title-sm" id="curve-h">${t('Pump curve')}</h3>
                        <ui-icon-button class="info" id="tip-curve-btn" label=${t('About the pump curve')}
                            @click=${(e) => this.#openTip('curve', e.currentTarget)}>${infoIcon()}</ui-icon-button>
                        <span class="spacer"></span>
                        <div class="bank" role="group" aria-labelledby="curve-h">
                            <button type="button" id="curve-on" aria-pressed=${d.on ? 'true' : 'false'} @click=${() => this.#curveOn(true)}>${t('Curve on')}</button>
                            <button type="button" id="curve-off" aria-pressed=${d.on ? 'false' : 'true'} @click=${() => this.#curveOn(false)}>${t('Curve off')}</button>
                        </div>
                    </div>
                    <div id="curve-box">${curveSize.w > 0 ? html`<svg
                        id="curve-chart"
                        width=${g.w}
                        height=${g.h}
                        viewBox=${`0 0 ${g.w} ${g.h}`}
                        role="group"
                        aria-label=${t('Pump curve: flow against pressure')}
                        @pointerdown=${this.#onPointer}
                        @pointermove=${this.#onPointer}
                        @pointerup=${this.#onPointer}
                        @pointercancel=${this.#onPointer}
                    >${this.#curveChart()}</svg>` : nothing}</div>
                </section>

                <div id="m-right">
                    ${this.#card({
                        id: 'ftau', heading: 'Flow τ', unit: 's · 0 to 5', tip: 'ftau', field: 'flowTau',
                        perUnit: WIRE_STEPS_PER_UNIT.tau, limits: L.tau,
                        mode: this.#modeBank('fmode', t('Flow τ acts on'), d.flowMode, 'flowMode'),
                        chart: this.#miniSvg('ftau-chart', t('Flow target: a step up at 0 s and a step down at 2.5 s. Dashed: the step. Solid: the shaped target.'),
                            this.#mini('ftau-chart', stepResponse('flow', d.flowTau, d.flowMode), -0.5, 5, 9, 'var(--ui-channel-flow)', 'mL/s · s')),
                    })}
                    ${this.#card({
                        id: 'ptau', heading: 'Pressure τ', unit: 's · 0 to 5', tip: 'ptau', field: 'pressureTau',
                        perUnit: WIRE_STEPS_PER_UNIT.tau, limits: L.tau,
                        mode: this.#modeBank('pmode', t('Pressure τ acts on'), d.pressureMode, 'pressureMode'),
                        chart: this.#miniSvg('ptau-chart', t('Pressure target: a step up at 0 s and a step down at 2.5 s. Dashed: the step. Solid: the shaped target.'),
                            this.#mini('ptau-chart', stepResponse('pressure', d.pressureTau, d.pressureMode), -0.5, 5, 7, 'var(--ui-channel-pressure)', 'bar · s')),
                    })}
                    ${this.#card({
                        id: 'rfac', heading: 'Ramp factor', unit: '× τ · 0 to 4', tip: 'rfac', field: 'ramp',
                        perUnit: WIRE_STEPS_PER_UNIT.ramp, limits: L.ramp,
                        chart: this.#miniSvg('rfac-chart', t('A smooth pressure step, 2 to 9 bar in 4 s, with pressure τ times the ramp factor. Dashed: the ramp. Solid: the shaped target.'),
                            this.#mini('rfac-chart', rampResponse(d.ramp, d.pressureTau, d.pressureMode), -0.5, 6, 10, 'var(--ui-channel-pressure)', 'bar · s')),
                    })}
                </div>

                ${this.#previewSection()}
            </div>
        `;
    }

    render() {
        const t = this.#i18n.t;
        const valid = this.result?.ok === true;
        return html`
            <ui-dialog id="shape-dialog" placement="full" label=${t('Native shaping')}
                @open-change=${this.#onOpenChange}>
                <div slot="header" class="top">
                    <div class="title">
                        <h2 id="dlg-title" class="ui-title">${t('Native shaping')}</h2>
                        <ui-icon-button class="info" id="tip-modal-btn" label=${t('About native shaping')}
                            @click=${(e) => this.#openTip('modal', e.currentTarget)}>${infoIcon()}</ui-icon-button>
                    </div>
                    <span class="spacer"></span>
                    <button type="button" class="chip" id="preview-btn" aria-pressed=${this._preview ? 'true' : 'false'}
                        @click=${() => { this._preview = !this._preview; }}><span class="box" aria-hidden="true"></span>${t('Preview: the whole profile')}</button>
                    <button type="button" class="chip" id="shape-cancel" @click=${() => this.hide()}>${t('Cancel')}</button>
                    <button type="button" class="chip primary" id="shape-apply" ?disabled=${!valid} @click=${this.#apply}>${t('Apply')}</button>
                </div>
                <div slot="body" id="shape-slot">${this.#body()}</div>
                <ui-dialog id="shape-tip" heading=${this._tip ? t(TIPS[this._tip].heading) : ''}>
                    <div slot="body" class="tip">${this._tip ? TIPS[this._tip].body.map((p) => html`<p
                        >${t(p)}</p>`) : nothing}</div>
                    <button type="button" class="chip" slot="actions" id="shape-tip-close"
                        @click=${() => this.renderRoot.getElementById('shape-tip')?.hide('close')}>${t('Close')}</button>
                </ui-dialog>
            </ui-dialog>
        `;
    }
}

customElements.define('editor-shaping-dialog', EditorShapingDialog);
