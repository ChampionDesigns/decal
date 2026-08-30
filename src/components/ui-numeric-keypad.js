/**
 * THE NUMERIC KEYPAD, and only the BODY of the dialog it lives in.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { seams } from 'src/components/seams.js';
import { I18nController } from 'src/lib/i18n.js';
import { SHEET_HEADING_LEVELS, DEFAULT_LEVEL } from 'src/components/ui-sheet-header.js';
import { hasLimit, clamp, numpadRange } from 'src/lib/machine-limits.js';
import 'src/components/ui-dialog.js';
import 'src/components/ui-button.js';
import 'src/components/ui-keycap.js';

const PAD = Object.freeze([
    Object.freeze({ id: '1', kind: 'digit', glyph: '1' }),
    Object.freeze({ id: '2', kind: 'digit', glyph: '2' }),
    Object.freeze({ id: '3', kind: 'digit', glyph: '3' }),
    Object.freeze({ id: '4', kind: 'digit', glyph: '4' }),
    Object.freeze({ id: '5', kind: 'digit', glyph: '5' }),
    Object.freeze({ id: '6', kind: 'digit', glyph: '6' }),
    Object.freeze({ id: '7', kind: 'digit', glyph: '7' }),
    Object.freeze({ id: '8', kind: 'digit', glyph: '8' }),
    Object.freeze({ id: '9', kind: 'digit', glyph: '9' }),
    Object.freeze({ id: 'decimal', kind: 'decimal', glyph: '.' }),
    Object.freeze({ id: '0', kind: 'digit', glyph: '0' }),
    /* U+232B ERASE TO THE LEFT. The glyph reads as nothing to a screen reader, which
     * is half of O9; the name is on the button, which is the pressable. */
    Object.freeze({ id: 'backspace', kind: 'backspace', glyph: '⌫' }),
]);

/** Up to four recent values, two rows of two — `numpad-modal.js:356-358`. */
const PREVIOUS_SHOWN = 4;

/** The empty buffer. Backspacing past the last character lands here, not on ''. */
const EMPTY = '0';

function bufferLimit(range) {
    const decimals = Number.isFinite(range.decimals)
        ? range.decimals
        : (String(range.step).split('.')[1]?.length ?? 0);
    const whole = String(Math.trunc(Math.abs(range.max))).length;
    return Math.max(1, whole + decimals);
}

export class UiNumericKeypad extends UiElement {
    static properties = {
        /** Reflected: the gallery declares an open keypad in static markup, and a
         *  screen styles around one. Mirrored from the shell in #onOpenChange. */
        open: { type: Boolean, reflect: true },
        /** The field name. #18's `heading` and its accessible name — see O10. */
        heading: { type: String },
        /** A key of the port's table (`LIMIT_KEYS`). No row → unavailable. */
        limitKey: { type: String, attribute: 'limit-key' },
        /** The frozen table from `capabilitiesStore.machineLimits().value`.
         *  A property, never an attribute: a table is not a string, and an
         *  attribute would be an invitation to write one out by hand. */
        limits: { attribute: false },
        band: { attribute: false },
        /** The value being edited, as the screen holds it. */
        value: { type: String },
        /** Presentation only. The screen owns which unit that is. */
        unit: { type: String },
        /** Recent values. Plain strings; the screen owns where they came from. */
        previous: { attribute: false },
        /** 1..6 for the heading element #16 renders. */
        level: { type: Number, reflect: true },
        /** The entry buffer. Internal — a screen reads `value` on confirm. */
        _buffer: { state: true },
        /** True until the first keypress, so the first digit REPLACES rather than
         *  appends (`numpad-modal.js:296-299`). Internal. */
        _fresh: { state: true },
    };

    static styles = [seams, typeRoles, css`
        :host {
            display: contents;
            container-type: normal;
        }

        ui-dialog {
            --_ui-dialog-inline: var(--_ui-numpad-inline, 820px);
        }

        .body {
            container-type: inline-size;
            display: block;
            --_ui-focus-offset: var(--ui-focus-offset-inset);
        }

        .layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 0.92fr);
            align-items: stretch;
        }

        .col {
            min-inline-size: 0;
            background-color: var(--ui-surface);
        }

        .entry {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: var(--ui-space-3);
            padding-inline-end: var(--ui-space-5);
        }

        .pad-col {
            min-inline-size: calc(3 * (var(--ui-control-h) + var(--ui-space-5))
                + 2 * var(--ui-space-3));
            display: grid;
            align-content: center;
            padding-inline-start: var(--ui-space-5);
        }

        @container (max-width: 584px) {
            .layout {
                grid-template-columns: minmax(0, 1fr);
            }

            .layout.seam-cols {
                row-gap: var(--ui-seam);
            }

            .entry {
                padding-inline-end: 0;
                padding-block-end: var(--ui-space-5);
            }

            .pad-col {
                padding-inline-start: 0;
                padding-block-start: var(--ui-space-5);
            }
        }

        .well {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--ui-space-1);
            block-size: calc(var(--ui-control-h) + 2 * var(--ui-space-5));
            padding-inline: var(--ui-space-3);
            border: var(--ui-border-w) solid var(--ui-line-strong);
            border-radius: var(--ui-radius);
            background-color: var(--ui-fascia);
            overflow: hidden;
        }

        .readout {
            color: var(--ui-text);
            font-size: var(--ui-display-md);
            font-weight: var(--ui-weight-light);
            line-height: 1;
            white-space: nowrap;
        }

        .unit {
            color: var(--ui-text-2);
            font-size: var(--ui-text-lg);
            font-weight: var(--ui-weight-regular);
            line-height: 1;
        }

        /* The range, in the port's own words. .ui-caption is muted --ui-text-note. */
        .hint {
            text-align: center;
        }

        .previous {
            display: grid;
            gap: var(--ui-space-2);
        }

        /* .ui-microcap is a paint role and sets no margin, so the UA's own paragraph
         * margin would still be there. One rule, on the class, not on the id. */
        .prev-title {
            margin: 0;
        }

        .previous-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: var(--ui-space-2);
        }

        /* #1 is inline-grid by default; a pill in a 2-up grid fills its cell. */
        .previous-grid ui-button {
            display: grid;
        }

        .pad {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: var(--ui-space-3);

            grid-auto-rows: calc(var(--ui-control-h) + var(--ui-space-5));
        }

        .key {
            display: grid;
            margin: 0;
            padding: 0;
            border: 0;
            border-radius: var(--ui-radius);
            background-color: transparent;
            color: inherit;
            font: inherit;
            cursor: pointer;
        }

        .key ui-keycap {
            --_ui-keycap-block: calc(var(--ui-control-h) + var(--ui-space-5));
            --_ui-keycap-size: var(--ui-display-sm);
            --_ui-keycap-weight: var(--ui-weight-light);
            inline-size: 100%;
        }

        /* THE UNAVAILABLE STATE — A7's absence, rendered as absence. No pad, no
         * invented ceiling, and the reason is on screen rather than in a console. */
        .unavailable {
            display: grid;
            gap: var(--ui-space-2);
            align-content: center;
            min-block-size: calc(var(--ui-control-h) + 2 * var(--ui-space-5));
            text-align: center;
        }
    `];

    /** Which outcome closed the dialog, so one dismissal reports exactly one event. */
    #outcome = null;

    constructor() {
        super();
        this.open = false;
        this.heading = '';
        this.limitKey = '';
        this.limits = null;
        this.band = null;
        this.value = '';
        this.unit = '';
        this.previous = [];
        this.level = DEFAULT_LEVEL;
        this._buffer = EMPTY;
        this._fresh = true;
        /** The element focus returns to. Not paint, so not reactive — #18 keeps its
         *  own the same way. */
        this.invoker = null;
        this.i18n = new I18nController(this);
    }

    /** The #18 instance, so a screen or a test reads the machinery rather than
     *  inferring it. */
    get dialog() {
        return this.renderRoot?.querySelector?.('#dialog') ?? null;
    }

    /** The live region. */
    get display() {
        return this.renderRoot?.querySelector?.('#display') ?? null;
    }

    get ranged() {
        return Boolean(this.#usableBand) || hasLimit(this.limits, this.limitKey);
    }

    /** The caller's band, or null when there is nothing usable in what it passed. */
    get #usableBand() {
        const band = this.band;
        if (!band || typeof band !== 'object') return null;
        if (!Number.isFinite(band.min) || !Number.isFinite(band.max)) return null;
        if (typeof band.clamp !== 'function') return null;
        return band;
    }

    get range() {
        const band = this.#usableBand;
        if (band) return band;
        return hasLimit(this.limits, this.limitKey)
            ? numpadRange(this.limits, this.limitKey)
            : null;
    }

    /** The port's own sentence for the range, including the hole when there is one
     *  ("0 (steam heater off) or 135–165"). Never assembled here. */
    get rangeText() {
        return this.range?.label ?? '';
    }

    get decimalAllowed() {
        const range = this.range;
        if (!range) return false;
        if (Number.isFinite(range.decimals)) return range.decimals > 0;
        return !Number.isInteger(range.step);
    }

    get outOfBand() {
        const range = this.range;
        if (!range?.refuseOutside) return false;
        const typed = Number(this._buffer);
        /* A buffer that is not a number is not a REFUSAL, it is an absence — the empty
         * readout, mid-decimal "12.". Those already have their own answer below. */
        if (!Number.isFinite(typed)) return false;
        return typed < range.min || typed > range.max;
    }

    /** The typed string, clamped by the port. Null when there is no declared range,
     *  because there is nothing to clamp against and nothing to invent. */
    get clamped() {
        const band = this.#usableBand;
        if (band) return band.clamp(Number(this._buffer));
        if (!hasLimit(this.limits, this.limitKey)) return null;
        return clamp(this.limits, this.limitKey, Number(this._buffer));
    }

    get shownPrevious() {
        return Array.isArray(this.previous) ? this.previous.slice(0, PREVIOUS_SHOWN) : [];
    }

    /** Open. Forwarded so #18 captures the restore target at open time. */
    show({ invoker = null, reason = 'api' } = {}) {
        if (invoker) this.invoker = invoker;
        const dialog = this.dialog;
        if (dialog) {
            dialog.show({ invoker: this.invoker, reason });
            return;
        }
        this.open = true;
    }

    hide(reason = 'api') {
        const dialog = this.dialog;
        if (dialog) dialog.hide(reason);
        else this.open = false;
    }

    /** ASK to close, cancellably. #18 owns the arbitration; this is the forward. */
    requestClose(reason = 'api') {
        return this.dialog?.requestClose(reason) ?? false;
    }

    confirm(reason = 'confirm') {
        if (!this.open || !this.ranged || this.outOfBand) return false;
        const allowed = this.dispatchEvent(new CustomEvent('confirm', {
            detail: { value: this.clamped, raw: this._buffer, limitKey: this.limitKey, reason },
            bubbles: true,
            composed: true,
            cancelable: true,
        }));
        if (!allowed) return false;
        this.#outcome = 'confirm';
        this.hide('confirm');
        return true;
    }

    /** Closing IS the cancel; the report is emitted from the one place that sees
     *  every dismissal, so Escape, the backdrop and this cannot disagree. */
    cancel(reason = 'cancel') {
        if (!this.open) return false;
        this.hide(reason);
        return true;
    }

    /**
     * One press. `kind` is the pad row's own verb, so the switch cannot drift from
     * the table that renders it.
     */
    press(id) {
        const key = PAD.find((k) => k.id === id);
        if (!key) return this._buffer;
        if (key.kind === 'backspace') return this.#backspace();
        if (key.kind === 'decimal') return this.#decimal();
        return this.#digit(key.glyph);
    }

    #digit(glyph) {
        const cap = this.range ? bufferLimit(this.range) : 0;
        if (this._fresh || this._buffer === EMPTY || this._buffer === '') {
            this._buffer = glyph;
            this._fresh = false;
        } else if (this._buffer.replace('.', '').length < cap) {
            this._buffer += glyph;
        }
        return this._buffer;
    }

    #decimal() {
        if (!this.decimalAllowed) return this._buffer;
        if (this._fresh) {
            this._buffer = `${EMPTY}.`;
            this._fresh = false;
        } else if (!this._buffer.includes('.')) {
            this._buffer += '.';
        }
        return this._buffer;
    }

    /** Backspacing past the last character lands on the empty buffer, never on a
     *  blank readout — `numpad-modal.js:320-329`. */
    #backspace() {
        this._fresh = false;
        const next = this._buffer.slice(0, -1);
        this._buffer = next === '' ? EMPTY : next;
        return this._buffer;
    }

    /** A recent value is a press and a confirm in one gesture, which is what made
     *  the strip worth having — `numpad-modal.js:331-338`. */
    useprevious(raw) {
        this._buffer = String(raw);
        this._fresh = false;
        this.confirm('previous');
    }

    willUpdate(changed) {
        if (changed.has('level')) {
            const raw = Number.parseInt(this.level, 10);
            const next = SHEET_HEADING_LEVELS.includes(raw) ? raw : DEFAULT_LEVEL;
            if (next !== this.level) this.level = next;
        }
        /* Opening reloads the buffer from the value the screen holds, so a cancelled
         * edit leaves nothing behind and the next open starts from the truth. */
        if (changed.has('open') && this.open) this.#reset();
        if (changed.has('value') && !this.open) this.#reset();
    }

    #reset() {
        const incoming = String(this.value ?? '').trim();
        this._buffer = incoming === '' ? EMPTY : incoming;
        this._fresh = true;
    }

    #onOpenChange = (event) => {
        const { open, reason } = event.detail ?? {};
        this.open = open === true;
        if (open) { this.#outcome = null; return; }
        const outcome = this.#outcome;
        this.#outcome = null;
        if (outcome === 'confirm') return;
        this.dispatchEvent(new CustomEvent('cancel', {
            detail: { reason: reason ?? 'api' },
            bubbles: true,
            composed: true,
        }));
    };

    #onKeyPress = (event) => {
        const id = event.currentTarget?.dataset?.key;
        if (id) this.press(id);
    };

    #onPreviousPress = (event) => {
        const raw = event.currentTarget?.dataset?.value;
        if (raw !== undefined) this.useprevious(raw);
    };

    #onConfirmPress = () => { this.confirm('press'); };

    #onCancelPress = () => { this.cancel('press'); };

    #renderWell() {
        return html`<div id="well" class="well"
            ><span id="display" class="display readout ui-numeric"
                role="status" aria-live="polite" aria-atomic="true"
                aria-invalid=${this.outOfBand ? 'true' : nothing}
                >${this._buffer}</span
            >${this.unit
                ? html`<span id="unit" class="unit">${this.unit}</span>`
                : nothing}</div>`;
    }

    #renderPad() {
        const off = !this.decimalAllowed;
        return html`<div id="pad" class="pad"
            >${PAD.map((key) => {
                const isDecimal = key.kind === 'decimal';
                const name = key.kind === 'backspace' ? this.i18n.t('Backspace') : '';
                return html`<button
                    id=${`key-${key.id}`}
                    class="key"
                    type="button"
                    data-key=${key.id}
                    aria-label=${name || nothing}
                    ?disabled=${isDecimal && off}
                    @click=${this.#onKeyPress}
                    ><ui-keycap label=${name || nothing}
                        >${key.glyph}</ui-keycap
                    ></button>`;
            })}</div
        >`;
    }

    /** Up to four recent values, two rows of two. Each is a #1 button. */
    #renderPrevious() {
        const values = this.shownPrevious;
        if (values.length === 0) return nothing;
        return html`<div id="previous" class="previous"
            ><p id="previous-title" class="prev-title ui-microcap"
                >${this.i18n.t('Previous values')}</p
            ><div id="previous-grid" class="previous-grid">${values.map((raw, i) => html`<ui-button
                id=${`previous-${i}`}
                data-value=${String(raw)}
                @click=${this.#onPreviousPress}
                >${String(raw)}</ui-button>`)}</div></div>`;
    }

    #renderUnavailable() {
        return html`<div id="unavailable" class="unavailable"
            ><p id="unavailable-title" class="ui-body"
                >${this.i18n.t('This value cannot be set yet.')}</p
            ><p id="unavailable-detail" class="ui-caption"
                >${this.i18n.t('The machine has not reported the limits for this setting.')}</p
            ></div>`;
    }

    render() {
        const ranged = this.ranged;
        const refused = !ranged || this.outOfBand;
        return html`<ui-dialog
            id="dialog"
            .open=${this.open}
            .heading=${this.heading ?? ''}
            .label=${this.heading ?? ''}
            .level=${this.level}
            @open-change=${this.#onOpenChange}
        ><div id="body" class="body" slot="body"
            ><div id="layout" class="layout seam-grid seam-cols seam-line"
                ><div id="entry" class="col entry"
                    ><p
                        id="hint" class="hint ui-caption"
                        >${this.rangeText}</p
                    >${ranged ? this.#renderWell() : this.#renderUnavailable()
                    }${this.#renderPrevious()}</div
                ><div id="pad-col" class="col pad-col"
                    >${ranged ? this.#renderPad() : nothing}</div
                ></div
            ></div
        ><ui-button id="cancel" slot="header-trail" @click=${this.#onCancelPress}
            >${this.i18n.t('Cancel')}</ui-button
        ><ui-button
            id="confirm"
            slot="header-trail"
            variant="primary"
            ?disabled=${refused}
            @click=${this.#onConfirmPress}
            >${this.i18n.t('Confirm')}</ui-button
        ></ui-dialog>`;
    }
}

customElements.define('ui-numeric-keypad', UiNumericKeypad);
