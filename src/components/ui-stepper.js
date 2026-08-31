/**
 * A number with a control either side of it, a label, and an optional caption beneath.
 */

import { css, html, nothing, svg } from 'lit';

import { UiElement, visuallyHidden } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';

const MINUS_GLYPH = svg`<svg class="glyph" viewBox="0 0 50 50" aria-hidden="true"
    fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"
    stroke-linejoin="round"><path d="M10.416 25H39.5827"/></svg>`;

const PLUS_GLYPH = svg`<svg class="glyph" viewBox="0 0 50 50" aria-hidden="true"
    fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"
    stroke-linejoin="round"><path d="M24.9993 10.4165V39.5832M10.416 24.9998H39.5827"/></svg>`;

/** Direction constants, so nothing in here reads a bare 1 or -1. */
const UP = 1;
const DOWN = -1;

class UiStepper extends UiElement {
    static properties = {
        /** The quantity. A number; the display form is derived, never stored twice. */
        value: { type: Number },

        min: { type: Number },
        max: { type: Number },

        /** The increment. Also data: a fan threshold and a flow rate do not share one. */
        step: { type: Number },

        unit: { type: String },

        /** The accessible name of the whole control - a cross-root label cannot see in. */
        label: { type: String },

        labelPosition: { type: String, attribute: 'label-position', reflect: true },

        labelHidden: { type: Boolean, attribute: 'label-hidden', reflect: true },

        /**
         * `regular` | `compact` - the named density. Reflected so the attribute
         * selector below is the same state a test and a screen both read.
         */
        density: { type: String, reflect: true },

        /** Paint on the host from --ui-opacity-disabled; behaviour on the controls. */
        disabled: { type: Boolean, reflect: true },

        editable: { type: Boolean },

        note: { type: String },

        off: { type: Boolean, reflect: true },

        next: { attribute: false },

        format: { attribute: false },

        hint: { type: String },

        /** Overridable so the control is not hard-wired to one language. */
        decreaseLabel: { type: String, attribute: 'decrease-label' },
        increaseLabel: { type: String, attribute: 'increase-label' },
    };

    static styles = [typeRoles, visuallyHidden, css`
        :host {
            --_ui-cap: var(--ui-stepper-cap);

            --_ui-value-min: var(--ui-stepper-value-min);

            --_ui-cap-used: max(var(--ui-hit-min), var(--_ui-cap));

            --_ui-well: calc(
                2 * var(--_ui-cap-used) + var(--_ui-value-min) + 2 * var(--ui-border-w));
            --_ui-well-floor: calc(
                2 * var(--ui-hit-min) + var(--_ui-value-min) + 2 * var(--ui-border-w));

            min-inline-size: var(--_ui-well);
        }

        :host([label-position="start"]) {
            display: grid;
            grid-template-columns:
                min(var(--ui-stepper-label-w),
                    calc(100% - var(--ui-space-4) - var(--_ui-well-floor)))
                minmax(0, 1fr);
            align-items: center;

            column-gap: var(--ui-space-4);
        }

        :host([density="compact"]) {
            --_ui-cap: var(--ui-control-h);
        }

        .band {
            box-sizing: border-box;
            display: grid;

            --_ui-cap-fit: max(
                var(--ui-hit-min),
                min(var(--_ui-cap-used), calc((100% - var(--_ui-value-min)) / 2)));

            grid-template-columns:
                var(--_ui-cap-fit)
                minmax(var(--_ui-value-min), 1fr)
                var(--_ui-cap-fit);
            align-items: stretch;

            min-block-size: var(--ui-control-h);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);

            background-color: var(--ui-key);

            --_ui-focus-offset: var(--ui-focus-offset-inset);
        }

        .name {
            display: block;
            min-inline-size: 0;
        }

        .label {
            display: block;

            font-size: var(--_ui-stepper-label-size, var(--ui-text-sm));

            overflow-wrap: var(--_ui-stepper-label-wrap, anywhere);
        }

        .cap {
            display: inline-grid;
            place-items: center;

            box-sizing: border-box;
            min-block-size: var(--ui-control-inner);
            min-inline-size: 0;
            padding: 0;
            border: 0;

            border-radius: 0;

            background-color: transparent;
            color: var(--ui-muted);

            font-family: inherit;
            font-size: var(--ui-text-xl);
            font-weight: var(--ui-weight-light);
            line-height: 1;

            cursor: pointer;
            /* A wall panel operated with a wet hand: a mistimed second tap selects the
             * glyph instead of pressing the button. */
            -webkit-user-select: none;
            user-select: none;
        }

        .cap-start {
            border-start-start-radius: var(--ui-radius);
            border-end-start-radius: var(--ui-radius);
            box-shadow: inset calc(-1 * var(--ui-seam)) 0 0 0 var(--ui-seam-ink);
        }

        .cap-end {
            border-start-end-radius: var(--ui-radius);
            border-end-end-radius: var(--ui-radius);
            box-shadow: inset var(--ui-seam) 0 0 0 var(--ui-seam-ink);
        }

        .cap .glyph,
        .cap ::slotted(svg),
        .cap ::slotted(img) {
            display: block;
            inline-size: var(--ui-icon);
            block-size: var(--ui-icon);
        }

        .value {
            box-sizing: border-box;
            display: block;
            min-inline-size: 0;
            block-size: var(--ui-control-inner);
            padding: 0;
            border: 0;

            background-color: color-mix(in srgb, var(--ui-seam-ink) 55%, transparent);
            box-shadow: inset 0 var(--ui-seam) 0 0 var(--ui-seam-ink);
            color: var(--ui-text);

            text-align: center;
            font-family: inherit;
            /* One value size for every stepper in the skin. The same component was
             * rendering 40px in the editor and 18px in Settings. */
            font-size: var(--ui-display-xs);
            font-weight: var(--ui-weight-light);
            line-height: var(--ui-control-inner);

            /* Section 2.4 without the silence: a value too long for its cell says so
             * with an ellipsis, and the full text is still in the accessible name. */
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        :host([note]) .value {
            block-size: auto;
            min-block-size: var(--ui-control-inner);
            line-height: 1.1;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        button.value {
            cursor: pointer;
            -webkit-user-select: none;
            user-select: none;
        }

        /* Whatever is inside shares that one line: the number, and the unit beside it. */
        .num,
        .unit {
            display: inline;
            line-height: inherit;
        }

        .num {
            color: var(--_ui-stepper-number-ink, inherit);
        }

        .stack {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-inline-size: 0;
        }

        .line {
            display: flex;
            align-items: baseline;
            gap: var(--ui-space-1);
        }

        .note {
            color: var(--ui-text-2);
            font-size: var(--ui-text-sm);
            line-height: 1.1;
        }

        .unit {
            margin-inline-start: var(--ui-space-1);
            color: var(--ui-muted);
            font-family: inherit;

            font-size: 14px;
            font-weight: var(--ui-weight-regular);
            letter-spacing: var(--ui-tracking-unit);
        }

        :host([off]) .num {
            color: var(--ui-muted);
        }

        .cap:disabled,
        .value:disabled {
            opacity: 1;
        }
    `];

    constructor() {
        super();
        this.value = 0;
        this.min = null;
        this.max = null;
        this.step = 1;
        this.unit = '';
        this.label = '';
        this.labelHidden = false;
        this.labelPosition = 'none';
        this.density = 'regular';
        this.disabled = false;
        this.editable = false;
        this.note = '';
        this.off = false;
        this.next = null;
        this.format = null;
        this.hint = '';
        this.decreaseLabel = 'Decrease';
        this.increaseLabel = 'Increase';
    }

    /** A stated limit is a finite number; anything else is "not stated". */
    static #limit(v) {
        const n = Number(v);
        return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n;
    }

    /** Decimal places of a literal, so 0.1 + 0.2 never reaches the screen as 0.30000000000000004. */
    static #decimals(n) {
        const s = String(n);
        const dot = s.indexOf('.');
        return dot < 0 ? 0 : s.length - dot - 1;
    }

    get #stepSize() {
        const n = Number(this.step);
        return Number.isFinite(n) && n > 0 ? n : 1;
    }

    get #current() {
        const n = Number(this.value);
        return Number.isFinite(n) ? n : 0;
    }

    get #lo() { return UiStepper.#limit(this.min); }
    get #hi() { return UiStepper.#limit(this.max); }

    #clamp(n) {
        const lo = this.#lo;
        const hi = this.#hi;
        let out = n;
        if (lo !== null && out < lo) out = lo;
        if (hi !== null && out > hi) out = hi;
        return out;
    }

    #nextValue(direction) {
        const current = this.#current;
        const step = this.#stepSize;

        if (typeof this.next === 'function') {
            const supplied = Number(this.next(current, direction, {
                min: this.#lo, max: this.#hi, step,
            }));
            return Number.isFinite(supplied) ? supplied : current;
        }

        const raw = current + direction * step;
        const places = UiStepper.#decimals(step);
        return this.#clamp(Number(raw.toFixed(places)));
    }

    #atEnd(direction) {
        const lo = this.#lo;
        const hi = this.#hi;
        if (direction === DOWN) return lo !== null && this.#current <= lo;
        return hi !== null && this.#current >= hi;
    }

    /** The displayed number. Never fewer digits than the value actually has. */
    get #display() {
        if (typeof this.format === 'function') return String(this.format(this.#current));
        const places = Math.max(
            UiStepper.#decimals(this.#stepSize),
            UiStepper.#decimals(this.#current),
        );
        return this.#current.toFixed(places);
    }

    get #rangeHint() {
        const told = String(this.hint ?? '').trim();
        if (told) return told;
        const lo = this.#lo;
        const hi = this.#hi;
        const unit = this.unit ? ` ${this.unit}` : '';
        if (lo !== null && hi !== null) return `Range ${lo} to ${hi}${unit}`;
        if (lo !== null) return `Minimum ${lo}${unit}`;
        if (hi !== null) return `Maximum ${hi}${unit}`;
        return '';
    }

    #commit(direction) {
        if (this.disabled || this.#atEnd(direction)) return;
        const previous = this.#current;
        const value = this.#nextValue(direction);
        if (value === previous) return;
        this.value = value;
        this.dispatchEvent(new CustomEvent('change', {
            bubbles: true,
            composed: true,
            detail: { value, previous, direction },
        }));
    }

    #onEdit() {
        if (this.disabled || !this.editable) return;
        /* The numpad is #53's and the dialog is #18's. This says "pressed", with the
         * value, and stops - a component that opened its own overlay would be reaching
         * outside its own tree. */
        this.dispatchEvent(new CustomEvent('edit', {
            bubbles: true,
            composed: true,
            detail: { value: this.#current },
        }));
    }

    /**
     * Arrow keys, and Home/End only where a limit is actually stated. Additive to the
     * buttons' own Enter/Space, which is native and untouched.
     */
    #onKeydown(event) {
        if (this.disabled || event.altKey || event.ctrlKey || event.metaKey) return;
        let handled = true;
        switch (event.key) {
            case 'ArrowUp': case 'ArrowRight': this.#commit(UP); break;
            case 'ArrowDown': case 'ArrowLeft': this.#commit(DOWN); break;
            case 'Home': {
                const lo = this.#lo;
                if (lo === null) { handled = false; break; }
                this.#jumpTo(lo);
                break;
            }
            case 'End': {
                const hi = this.#hi;
                if (hi === null) { handled = false; break; }
                this.#jumpTo(hi);
                break;
            }
            default: handled = false;
        }
        if (handled) event.preventDefault();
    }

    #jumpTo(target) {
        const previous = this.#current;
        if (target === previous) return;
        this.value = target;
        this.dispatchEvent(new CustomEvent('change', {
            bubbles: true,
            composed: true,
            detail: { value: target, previous, direction: target > previous ? UP : DOWN },
        }));
    }

    #capState(direction) {
        return !this.disabled && this.#atEnd(direction) ? 'true' : nothing;
    }

    render() {
        const display = this.#display;
        const hint = this.#rangeHint;
        const spoken = [this.label, `${display}${this.unit ? ` ${this.unit}` : ''}`]
            .filter(Boolean).join(', ');

        const named = this.labelPosition === 'start' && Boolean(this.label);

        const line = html`<span
                id="number"
                class="num ui-numeric"
            >${display}</span>${this.unit && !this.off
                ? html`<small id="unit" class="unit">${this.unit}</small>`
                : nothing}`;
        const cell = this.note
            ? html`<span class="stack"><span class="line">${line}</span
                ><small id="note" class="note">${this.note}</small></span>`
            : line;

        return html`
            ${named
                ? html`<span class="name"
                        ><span id="label"
                            class="label ui-microcap ${this.labelHidden ? 'a11y' : ''}"
                            >${this.label}</span
                        ><slot name="caption"></slot
                    ></span>`
                : nothing}
            <div
                class="band"
                role="group"
                aria-label=${named ? nothing : (this.label || nothing)}
                aria-labelledby=${named ? 'label' : nothing}
                aria-describedby=${hint ? 'range' : nothing}
                @keydown=${this.#onKeydown}
            >
                <button
                    id="decrement"
                    class="cap cap-start"
                    type="button"
                    aria-label=${`${this.decreaseLabel} ${this.label}`.trim()}
                    aria-disabled=${this.#capState(DOWN)}
                    ?disabled=${this.disabled}
                    @click=${() => this.#commit(DOWN)}
                ><slot name="decrement">${MINUS_GLYPH}</slot></button>

                ${this.editable
                    ? html`<button
                            id="value"
                            class="value ui-numeric"
                            type="button"
                            aria-haspopup="dialog"
                            aria-live="polite"
                            aria-label=${spoken || nothing}
                            ?disabled=${this.disabled}
                            @click=${this.#onEdit}
                        >${cell}</button>`
                    : html`<div
                            id="value"
                            class="value ui-numeric"
                            aria-live="polite"
                        >${cell}</div>`}

                <button
                    id="increment"
                    class="cap cap-end"
                    type="button"
                    aria-label=${`${this.increaseLabel} ${this.label}`.trim()}
                    aria-disabled=${this.#capState(UP)}
                    ?disabled=${this.disabled}
                    @click=${() => this.#commit(UP)}
                ><slot name="increment">${PLUS_GLYPH}</slot></button>

                ${hint ? html`<span id="range" class="a11y">${hint}</span>` : nothing}
            </div>
        `;
    }
}

customElements.define('ui-stepper', UiStepper);

export { UiStepper };
