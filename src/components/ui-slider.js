/**
 * Ui-slider.
 */

import { html, css, nothing } from 'lit';
import { UiElement, hitArea } from 'src/components/base.js';

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Percentages, trimmed so the rendered gradient reads `25%`, not `25.0000001%`. */
const pct = (fraction) => `${Number((clamp01(fraction) * 100).toFixed(3))}%`;

class UiSlider extends UiElement {
    static properties = {
        min: { type: Number },
        max: { type: Number },
        step: { type: String },
        value: { type: Number },
        origin: { type: Number },
        disabled: { type: Boolean, reflect: true },
        /** Accessible name. A control with no visible label MUST carry one. */
        label: { type: String },
        /** Human-readable value for a screen reader: "3 of 5", "+1.4 s". */
        valueText: { type: String, attribute: 'value-text' },
    };

    static styles = [
        // Structural fragment FIRST (CONVENTIONS §4 usage rule 1). There is no
        // selectionSurface here: a slider has a value, not a selected state.
        hitArea,
        css`
            :host {
                container-type: normal;

                --_ui-slider-ink: var(--ui-space-2);
                --_ui-hit-ink: var(--_ui-slider-ink);

                --_ui-slider-thumb: calc(var(--ui-icon) + 2 * var(--ui-hairline));
            }

            .track {
                display: block;
                inline-size: 100%;
                margin: 0;
                border: 0;
                border-radius: var(--ui-radius-lg);
                cursor: pointer;

                appearance: none;
                -webkit-appearance: none;
                accent-color: transparent;

                background-image: linear-gradient(to right,
                    var(--ui-line) 0%,
                    var(--ui-line) var(--_ui-slider-from, 0%),
                    var(--ui-steel) var(--_ui-slider-from, 0%),
                    var(--ui-steel) var(--_ui-slider-to, 0%),
                    var(--ui-line) var(--_ui-slider-to, 0%),
                    var(--ui-line) 100%);
            }

            .track::-webkit-slider-thumb {
                appearance: none;
                -webkit-appearance: none;
                box-sizing: border-box;
                inline-size: var(--_ui-slider-thumb);
                block-size: var(--_ui-slider-thumb);
                margin-block-start: calc(
                    (var(--_ui-slider-ink) - var(--_ui-slider-thumb)) / 2);

                border: var(--ui-hairline) solid var(--ui-line-strong);
                border-radius: var(--ui-radius-pill);
                background-color: var(--ui-surface);
            }

            .track::-moz-range-thumb {
                appearance: none;
                -webkit-appearance: none;
                box-sizing: border-box;
                inline-size: var(--_ui-slider-thumb);
                block-size: var(--_ui-slider-thumb);
                margin-block-start: calc(
                    (var(--_ui-slider-ink) - var(--_ui-slider-thumb)) / 2);
                border: var(--ui-hairline) solid var(--ui-line-strong);
                border-radius: var(--ui-radius-pill);
                background-color: var(--ui-surface);
            }

            /* The engine's own track, out of the way so the element's gradient is
             * the only thing painted. Same pairing rule, same identical blocks. */
            .track::-webkit-slider-runnable-track {
                /* THE INK'S HEIGHT, NOT 100% — see the thumb's note above. 100% was
                 * read against the outer 48px box rather than the 8px of visible bar,
                 * which is what put the thumb off the line. */
                block-size: var(--_ui-slider-ink);
                background-color: transparent;
                border: 0;
            }

            .track::-moz-range-track {
                block-size: var(--_ui-slider-ink);
                background-color: transparent;
                border: 0;
            }

            :host([disabled]) .track {
                opacity: 1;
            }
        `,
    ];

    constructor() {
        super();
        this.min = 0;
        this.max = 100;
        /* A string, like the attribute it becomes - see the property comment. */
        this.step = '1';
        this.value = 0;
        this.origin = null;
        this.disabled = false;
        this.label = '';
        this.valueText = '';
    }

    /** Where `v` sits in the range, 0..1. A zero-width range is all the way down. */
    #fraction(v) {
        const span = Number(this.max) - Number(this.min);
        if (!Number.isFinite(span) || span <= 0) return 0;
        return clamp01((Number(v) - Number(this.min)) / span);
    }

    #onInput(event) {
        // Set BEFORE the event continues past the input: the native `input` event is
        // composed, so it reaches the outside retargeted to this host, and a listener
        // reading `event.target.value` must see the new number.
        this.value = event.currentTarget.valueAsNumber;
    }

    #onChange(event) {
        this.value = event.currentTarget.valueAsNumber;
        // `change` is composed: false - it dies at the shadow boundary. Re-dispatch,
        // or a consumer that only listens for the commit never hears one.
        this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }

    render() {
        const at = this.#fraction(this.value);
        const from = this.origin === null || this.origin === undefined || Number.isNaN(this.origin)
            ? 0
            : this.#fraction(this.origin);

        return html`
            <input
                id="track"
                class="track hit-pad"
                type="range"
                style="--_ui-slider-from:${pct(Math.min(from, at))};--_ui-slider-to:${pct(Math.max(from, at))}"
                min=${this.min}
                max=${this.max}
                step=${this.step}
                .value=${String(this.value)}
                ?disabled=${this.disabled}
                aria-label=${this.label || nothing}
                aria-valuetext=${this.valueText || nothing}
                @input=${this.#onInput}
                @change=${this.#onChange}
            >
        `;
    }
}

customElements.define('ui-slider', UiSlider);

export { UiSlider };
