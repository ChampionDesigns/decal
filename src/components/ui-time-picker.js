/**
 * A time of day, entered by keypad rather than by scrolling.
 */

import { css, html, nothing } from 'lit';

import { UiElement, selectionSurface, visuallyHidden } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';
import {
    formatTime24,
    hourHandAngle,
    minuteHandAngle,
    parseTime24,
    snapMinute,
    to12h,
    to24h,
} from 'src/lib/time-picker-core.js';
import { clockTime, CLOCK_FORMAT, DEFAULT_CLOCK_FORMAT, normaliseClockFormat } from 'src/lib/wall-clock.js';

import 'src/components/ui-bank.js';

const VIEW = 264;
const CENTRE = VIEW / 2;   // 132
const RING = 98;           // the radius the 12 labels sit on
const DISC_R = 118;        // the tinted face behind them
const HUB_R = 4;
const HAND_W = 2.5;

/** Label ring radius as a fraction of the face box — the chips' polar placement. */
const RING_FRACTION = RING / VIEW;

const CHIP_PITCH = (2 * RING * Math.sin(Math.PI / 12)) / VIEW;

const HOUR_LABELS = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
const MINUTE_LABELS = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

const MINUTE_STEP = 5;
const MODES = ['hour', 'minute'];

function ringPoint(angleDeg) {
    const a = (angleDeg * Math.PI) / 180;
    return { x: Math.cos(a), y: Math.sin(a) };
}

export class UiTimePicker extends UiElement {
    static properties = {
        value: { type: String, reflect: true },

        /** Which dial the face is showing: `hour` (default) or `minute`. Reflected. */
        mode: { type: String, reflect: true },

        /** Accessible name for the whole picker, when the dialog's heading is not it. */
        label: { type: String },

        autoAdvance: { type: Boolean, attribute: 'auto-advance' },

        /** Paint AND behaviour: the base dims the host, the controls refuse input. */
        disabled: { type: Boolean, reflect: true },

        clockFormat: { type: String, attribute: 'clock-format' },
    };

    static styles = [
        visuallyHidden,

        css`
            :host {
                display: grid;
                gap: var(--ui-space-4);
                justify-items: center;

                grid-template-columns: minmax(0, 1fr);

                --_ui-tp-face-max: 264px;

                --_ui-tp-seg: 88px;
            }

            .display {
                display: flex;
                align-items: stretch;
                justify-content: center;
                gap: var(--ui-space-2);
                inline-size: calc(4 * var(--_ui-tp-seg) + var(--ui-space-2));
            }

            .digits {
                font-size: var(--ui-display-md);
                font-weight: var(--ui-weight-semibold);
                font-variant-numeric: tabular-nums;
            }

            /* Equal shares, so all four cells are one width. flex-basis: 0 rather
             * than auto — see the .display block: an auto basis is a content-based
             * size, and a contained host has none. */
            .field,
            .meridiem {
                flex: 1 1 0;
            }

            .face {
                position: relative;
                inline-size: min(100%, var(--_ui-tp-face-max));
                aspect-ratio: 1;

                min-inline-size: calc(var(--ui-hit-min) / var(--_ui-tp-pitch));
            }

            /* The artwork. aria-hidden in the template: the 12 buttons above it carry
             * every piece of meaning, and a decorative SVG in the accessibility tree
             * is noise. */
            .dial {
                position: absolute;
                inset: 0;
                inline-size: 100%;
                block-size: 100%;
                display: block;
            }

            .disc {
                fill: color-mix(in srgb, var(--ui-steel) 10%, transparent);
            }

            .hand {
                stroke: var(--ui-steel);
                stroke-width: ${HAND_W};
                stroke-linecap: round;
            }

            .hub {
                fill: var(--ui-steel);
            }

            .ring {
                position: absolute;
                inset: 0;
            }

            .chip {
                position: absolute;
                transform: translate(-50%, -50%);

                inline-size: var(--ui-hit-min);
                block-size: var(--ui-hit-min);

                display: flex;
                align-items: center;
                justify-content: center;

                border: 0;
                border-radius: var(--ui-radius-pill);
                padding: 0;

                background-color: transparent;
                color: var(--ui-text);

                font-family: inherit;
                line-height: inherit;
                font-size: var(--ui-text-base);
                font-weight: var(--ui-weight-semibold);

                cursor: pointer;
                -webkit-user-select: none;
                user-select: none;
            }

        `,

        selectionSurface,
    ];

    constructor() {
        super();
        this.value = '';
        this.mode = 'hour';
        this.label = '';
        this.autoAdvance = true;
        this.disabled = false;
        this.clockFormat = DEFAULT_CLOCK_FORMAT;

        /** No string table — the labels go through src/lib/i18n.js. */
        this.i18n = new I18nController(this);
    }

    /** Index to focus once the next render has produced the chips. */
    #pendingFocus = null;

    /** The `aria-label` the SCREEN wrote, so clearing `label` gives it back. */
    #authorLabel = null;

    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('role')) this.setAttribute('role', 'group');
        if (this.#authorLabel === null) this.#authorLabel = this.getAttribute('aria-label');
    }

    willUpdate(changed) {
        if (!changed.has('label')) return;
        if (this.label) this.setAttribute('aria-label', this.label);
        else if (this.#authorLabel) this.setAttribute('aria-label', this.#authorLabel);
        else this.removeAttribute('aria-label');
    }

    get #time() {
        const { h24, m } = parseTime24(this.value);
        const { h12, ampm } = to12h(h24);
        return { h24, m, h12, ampm };
    }

    get #mode() {
        return MODES.includes(this.mode) ? this.mode : 'hour';
    }

    /** The stored preference, turned into one of the two — `wall-clock.js`'s own coercion,
     *  so an unrecognised value cannot mean something different here than on the Live
     *  header's clock. */
    get #clockFormat() {
        return normaliseClockFormat(this.clockFormat);
    }

    #selectedIndex(time) {
        if (this.#mode === 'hour') return time.h12 % 12;
        return snapMinute(time.m, MINUTE_STEP) === time.m ? (time.m / MINUTE_STEP) % 12 : -1;
    }

    /** The hand's angle, straight from the ported helpers. */
    #handAngle(time) {
        return this.#mode === 'hour' ? hourHandAngle(time.h12) : minuteHandAngle(time.m);
    }

    /**
     * Commit a new time. Fires `change` only when the string actually moves, which
     * is the native contract and `ui-bank`'s.
     */
    #commit(h24, m) {
        const next = formatTime24(h24, m);
        if (next === this.value) return false;
        this.value = next;
        this.dispatchEvent(new CustomEvent('change', {
            detail: { value: next, h24, m },
            bubbles: true,
            composed: true,
        }));
        return true;
    }

    /** A chip was chosen. `advance` is false for arrow-key roving. */
    #choose(index, { advance }) {
        if (this.disabled) return;
        const time = this.#time;

        if (this.#mode === 'hour') {
            const h12 = index === 0 ? 12 : index;
            this.#commit(to24h(h12, time.ampm), time.m);
            if (advance && this.autoAdvance) this.mode = 'minute';
        } else {
            this.#commit(time.h24, (index * MINUTE_STEP) % 60);
        }
    }

    #onField(event) {
        event.stopPropagation();
        const next = event.detail?.value;
        if (MODES.includes(next)) this.mode = next;
    }

    #onMeridiem(event) {
        event.stopPropagation();
        const next = String(event.detail?.value || '').toUpperCase();
        if (next !== 'AM' && next !== 'PM') return;
        const time = this.#time;
        this.#commit(to24h(time.h12, next), time.m);
    }

    #onKeydown(event, index) {
        const last = HOUR_LABELS.length - 1;
        let next = null;
        switch (event.key) {
            case 'ArrowRight': case 'ArrowDown': next = (index + 1) % (last + 1); break;
            case 'ArrowLeft': case 'ArrowUp': next = (index + last) % (last + 1); break;
            case 'Home': next = 0; break;
            case 'End': next = last; break;
            default: return;
        }
        event.preventDefault();
        this.#pendingFocus = next;
        this.#choose(next, { advance: false });
        /* Choosing the chip that is already checked moves no reactive property, so
         * without this the roving focus would stall on the selected number. */
        this.requestUpdate();
    }

    updated(changed) {
        super.updated?.(changed);
        const index = this.#pendingFocus;
        if (index === null) return;
        this.#pendingFocus = null;
        this.renderRoot.getElementById(`chip-${index}`)?.focus();
    }

    render() {
        const time = this.#time;
        const mode = this.#mode;
        const labels = mode === 'hour' ? HOUR_LABELS : MINUTE_LABELS;
        const selected = this.#selectedIndex(time);
        const tabStop = selected >= 0 ? selected : 0;

        const twentyFour = this.#clockFormat === CLOCK_FORMAT.H24;
        const hh = String(twentyFour ? time.h24 : time.h12).padStart(2, '0');
        const mm = String(time.m).padStart(2, '0');
        /* THE WHOLE TIME, THROUGH THE ONE FORMATTER — the same string the opener that
         * led here prints, rather than a second assembly of the same three parts. */
        const spoken = clockTime(time.h24, time.m, this.#clockFormat, this.i18n.language);

        const hand = ringPoint(this.#handAngle(time));
        const handX = (CENTRE + RING * hand.x).toFixed(2);
        const handY = (CENTRE + RING * hand.y).toFixed(2);

        const dialName = mode === 'hour' ? this.i18n.t('Hour') : this.i18n.t('Minute');

        return html`
            <div class="display">
                <ui-bank
                    id="field"
                    class="field"
                    mode="radio"
                    density="compact"
                    .items=${[
                        { value: 'hour', label: hh },
                        { value: 'minute', label: mm },
                    ]}
                    value=${mode}
                    label=${this.i18n.t('Set hours or minutes')}
                    ?disabled=${this.disabled}
                    @change=${this.#onField}
                >
                    <span slot="item-hour" class="digits">${hh}</span>
                    <span slot="item-minute" class="digits">${mm}</span>
                </ui-bank>

                <ui-bank
                    id="meridiem"
                    class="meridiem"
                    mode="radio"
                    .items=${[{ value: 'AM', label: 'AM' }, { value: 'PM', label: 'PM' }]}
                    value=${time.ampm}
                    label=${this.i18n.t('Before or after noon')}
                    ?disabled=${this.disabled}
                    @change=${this.#onMeridiem}
                ></ui-bank>
            </div>

            <div class="face" id="face" style="--_ui-tp-pitch:${CHIP_PITCH.toFixed(5)}">
                <svg
                    class="dial"
                    viewBox="0 0 ${VIEW} ${VIEW}"
                    aria-hidden="true"
                    focusable="false"
                >
                    <circle class="disc" cx=${CENTRE} cy=${CENTRE} r=${DISC_R}></circle>
                    <line class="hand" x1=${CENTRE} y1=${CENTRE} x2=${handX} y2=${handY}></line>
                    <circle class="hub" cx=${CENTRE} cy=${CENTRE} r=${HUB_R}></circle>
                </svg>

                <div
                    class="ring"
                    id="ring"
                    role="radiogroup"
                    aria-label=${dialName}
                    aria-disabled=${this.disabled ? 'true' : nothing}
                >
                    ${labels.map((text, index) => {
                        const p = ringPoint(index * 30 - 90);
                        const left = (50 + RING_FRACTION * 100 * p.x).toFixed(3);
                        const top = (50 + RING_FRACTION * 100 * p.y).toFixed(3);
                        const on = index === selected;
                        return html`
                            <button
                                id="chip-${index}"
                                class="chip"
                                type="button"
                                role="radio"
                                aria-checked=${on ? 'true' : 'false'}
                                tabindex=${index === tabStop ? '0' : '-1'}
                                style="left:${left}%;top:${top}%"
                                ?disabled=${this.disabled}
                                @click=${() => this.#choose(index, { advance: true })}
                                @keydown=${(event) => this.#onKeydown(event, index)}
                            >${text}</button>
                        `;
                    })}
                </div>
            </div>

            <p
                class="a11y"
                id="live"
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >${spoken}</p>
        `;
    }
}

customElements.define('ui-time-picker', UiTimePicker);
