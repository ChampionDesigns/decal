/**
 * The bar that names the two shots being compared and offers the way out of the comparison.
 */

import { html, css, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import 'src/components/ui-slider.js';
import 'src/components/ui-text-field.js';
import 'src/components/ui-button.js';
import {
    ALIGNMENT_OFFSET_LIMIT_S,
    ALIGNMENT_OFFSET_STEP_S,
    ALIGNMENT_SLOT,
    alignmentControlState,
    alignmentOffsetAfterSlotChange,
    clampAlignmentOffset,
    formatAlignmentOffset,
    parseAlignmentOffset,
} from 'src/lib/alignment-offset.js';

const DEFAULT_LABEL = 'Align B';
const DEFAULT_SLIDER_LABEL = 'Slide shot B along the time axis';
const DEFAULT_RESET_LABEL = 'Reset';

class UiCompareBar extends UiElement {
    static properties = {
        offset: { type: Number },

        _offsetDraft: { state: true },

        _offsetInvalid: { state: true },

        inputLabel: { type: String, attribute: 'input-label' },

        errorLabel: { type: String, attribute: 'error-label' },

        /** Is there a second shot to slide? Reflected: it dims the caption. */
        hasComparison: { type: Boolean, attribute: 'has-comparison', reflect: true },
        hasTimeAxis: {
            attribute: 'has-time-axis',
            converter: { fromAttribute: (value) => value !== null && value !== 'false' },
        },
        available: { type: Boolean, reflect: true },
        /** True while something is assigned to slot="key" - the slot's gap depends on it. */
        hasKey: { type: Boolean, attribute: 'has-key', reflect: true },
        /** The visible caption. */
        label: { type: String },
        /** The slider's accessible name - it has no visible label of its own. */
        sliderLabel: { type: String, attribute: 'slider-label' },
        /** The reset button's words. */
        resetLabel: { type: String, attribute: 'reset-label' },
    };

    static styles = [
        typeRoles,
        css`
            :host {
                --_ui-compare-row: var(--ui-control-h);
            }

            .bar {
                display: flex;
                align-items: center;
                gap: var(--ui-space-5);
                block-size: calc(
                    var(--_ui-compare-row) + 2 * var(--ui-space-3) + 2 * var(--ui-border-w));
                padding: var(--ui-space-3) var(--ui-space-5);
                border: var(--ui-border-w) solid var(--ui-line);
                border-radius: var(--ui-radius);
                background-color: var(--ui-fascia);
            }

            :host(:not([available])) {
                display: none;
            }

            .key {
                display: none;
                flex: 0 0 auto;
                align-items: center;
            }

            :host([has-key]) .key {
                display: flex;
            }

            .align {
                display: flex;
                flex: 1 1 auto;
                align-items: center;
                gap: var(--ui-space-4);
                min-inline-size: 0;
            }

            .caption {
                flex: 0 0 auto;
                white-space: nowrap;
            }

            .control {
                flex: 1 1 auto;
                min-inline-size: var(--ui-hit-min);
                --_ui-hit-box: var(--_ui-compare-row);
            }

            .readout[hidden] { display: none; }

            .readout {
                flex: 0 0 auto;
                min-inline-size: 84px;
                color: var(--ui-text);
                font-size: var(--ui-text-base);
                text-align: end;
            }

            .entry { flex: 0 0 128px; min-inline-size: 0; }

            .entry ui-text-field { inline-size: 100%; }

            .entry .error { color: var(--ui-status-danger); font-size: var(--ui-text-xs); }

            .bar:has(.error) { block-size: auto; }

            .reset {
                flex: 0 0 auto;
            }

            :host(:not([has-comparison])) .key,
            :host(:not([has-comparison])) .caption {
                opacity: var(--ui-opacity-disabled);
            }

            @container (max-width: 640px) {
                .caption {
                    display: none;
                }
            }
        `,
    ];

    constructor() {
        super();
        this.offset = 0;
        this._offsetDraft = null;
        this._offsetInvalid = false;
        this.inputLabel = 'Offset for shot B in seconds';
        this.errorLabel = 'Enter a number from −5 to +5 seconds.';
        this.hasComparison = false;
        this.hasTimeAxis = true;
        this.available = true;
        this.hasKey = false;
        this.label = DEFAULT_LABEL;
        this.sliderLabel = DEFAULT_SLIDER_LABEL;
        this.resetLabel = DEFAULT_RESET_LABEL;
    }

    /** The ported enable rules, as data. Never recomputed by hand in this file. */
    get #state() {
        return alignmentControlState({
            offset: this.offset,
            hasComparison: this.hasComparison,
            hasTimeAxis: this.hasTimeAxis,
        });
    }

    willUpdate(changed) {
        if (changed.has('offset')) {
            this._offsetDraft = null;
            this._offsetInvalid = false;
        }
        const clamped = clampAlignmentOffset(this.offset);
        if (clamped !== this.offset) this.offset = clamped;
        this.available = this.#state.available;
    }

    applySlotChange(slot) {
        const next = alignmentOffsetAfterSlotChange(this.offset, slot);
        if (next === this.offset) return next;
        this.offset = next;
        this.#emit('slot-change');
        return next;
    }

    /** ONE event, one shape. The screen redraws; nothing here touches a trace. */
    #emit(reason) {
        this.dispatchEvent(new CustomEvent('offset-change', {
            detail: { offset: this.offset, reason },
            bubbles: true,
            composed: true,
        }));
    }

    #onSlide(event) {
        const next = clampAlignmentOffset(event.target.value);
        if (next === this.offset) return;
        this.offset = next;
        this.#emit('slide');
    }

    #onNumberInput(event) {
        this._offsetDraft = event.currentTarget.value;
        this._offsetInvalid = false;
    }

    #commitNumber = () => {
        if (!this.hasComparison) return;
        const next = parseAlignmentOffset(this._offsetDraft ?? this.offset.toFixed(1));
        if (next === null) { this._offsetInvalid = true; return; }
        this._offsetDraft = null;
        this._offsetInvalid = false;
        if (next === this.offset) return;
        this.offset = next;
        this.#emit('number');
    };

    #onNumberKey(event) {
        if (event.key === 'Enter') { event.preventDefault(); this.#commitNumber(); }
        if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation();
            this._offsetDraft = null; this._offsetInvalid = false;
        }
    }

    #onReset() {
        this._offsetDraft = null;
        this._offsetInvalid = false;
        if (this.offset === 0) return;
        this.offset = 0;
        this.#emit('reset');
    }

    #onKeySlotChange(event) {
        this.hasKey = event.target.assignedElements({ flatten: true }).length > 0;
    }

    render() {
        const state = this.#state;
        if (!state.available) return nothing;

        /* One string, from the port, in both places it appears: the visible readout and
         * the slider's aria-valuetext. They cannot drift because there is one call. */
        const text = formatAlignmentOffset(this.offset);

        return html`
            <div id="bar" class="bar" part="bar">
                <slot id="key" name="key" class="key" @slotchange=${this.#onKeySlotChange}></slot>
                <div id="align" class="align" part="align">
                    <span id="caption" class="ui-microcap caption" part="caption">${this.label}</span>
                    <ui-slider
                        id="slider"
                        class="control"
                        part="slider"
                        min=${-ALIGNMENT_OFFSET_LIMIT_S}
                        max=${ALIGNMENT_OFFSET_LIMIT_S}
                        step=${String(ALIGNMENT_OFFSET_STEP_S)}
                        origin="0"
                        .value=${this.offset}
                        ?disabled=${state.sliderDisabled}
                        label=${this.sliderLabel}
                        value-text=${text}
                        @input=${this.#onSlide}
                    ></ui-slider>
                    <output id="readout" class="ui-numeric readout" part="readout" aria-hidden="true" hidden>${text}</output>
                    <div class="entry">
                        <ui-text-field id="offset-input" class="ui-numeric"
                            label=${this.inputLabel} hide-label inputmode="decimal" align="end"
                            .value=${this._offsetDraft ?? this.offset.toFixed(1)}
                            ?disabled=${state.sliderDisabled} ?invalid=${this._offsetInvalid}
                            @input=${this.#onNumberInput} @change=${this.#commitNumber}
                            @keydown=${this.#onNumberKey}
                        ><span slot="trail">s</span></ui-text-field>
                        ${this._offsetInvalid ? html`<span class="error" role="alert">${this.errorLabel}</span>` : nothing}
                    </div>
                </div>
                <ui-button
                    id="reset"
                    class="reset"
                    part="reset"
                    ?disabled=${state.resetDisabled && this._offsetDraft === null}
                    @click=${this.#onReset}
                >${this.resetLabel}</ui-button>
            </div>
        `;
    }
}

customElements.define('ui-compare-bar', UiCompareBar);

export { UiCompareBar, ALIGNMENT_SLOT };
