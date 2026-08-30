/**
 * ui-compare-bar.js — Wave 4 item #44, the History screen's A/B alignment strip.
 *
 * SCOPE Part 4, Wave 4 row 44: "Compare bar | A/B alignment strip: slider + numeric
 * output + reset. Currently sized by the wrong sibling (H8). +/-5 s offset policy ports
 * from history-viewer.js | small-medium | #23, #1". SCOPE Part 4's History component
 * list says the same thing with the fix attached: "compare bar (#44 - slider + output +
 * reset, with the bar's height set by its own contents, not by whichever button is
 * tallest, H8)" (SCOPE.md:2478).
 *
 * WHAT IT IS FOR, in the shipped app's own words (index.html:566-574, read read-only):
 * two pours of the same profile do not start at the same instant - preinfusion ends on a
 * pressure threshold, so a coarser grind pushes everything after it a second or two
 * right, and an unaligned pair reads as a difference in the coffee. Hidden on SHOT DATA,
 * where a table has no time axis to slide.
 *
 * ============================================================================
 * WHAT THIS COMPONENT OWNS, AND WHAT IT REFUSES TO
 * ============================================================================
 *
 * THE POLICY IS NOT HERE. Every number and every rule about the offset comes from
 * src/lib/alignment-offset.js - the Gate 7 port staged ahead of this item (SCOPE Part 10
 * §8). The limit (5 s), the step (0.1 s), the clamp, the readout string, the three
 * enable rules and the slot-change reset are that module's; this file renders them. There
 * is no second copy of any of them here, and no arithmetic on an offset anywhere below.
 *
 * THE CENTRE-ORIGIN FILL IS NOT HERE EITHER. #23's `origin` property already carries it
 * ("a slider sitting at 0.0 s reads as centred rather than as 60% of something",
 * slate-live.css:2350-2356). This file sets origin="0" and owns no gradient.
 *
 * OFFSET-AS-REDRAW (CARRY_FORWARD history-viewer.js; alignment-offset.js:170-185). A new
 * offset is an EVENT, not a reach into anyone's trace list: this component emits
 * `offset-change` and the screen rebuilds its series with
 * shiftSeriesX(series, clampAlignmentOffset(n)). Slate's first implementation walked the
 * renderer's traces and rewrote their x arrays in place, addressed one index past the
 * end, and the swallowed throw made the control do nothing at all. A redraw is 4 ms.
 *
 * GATE 2. This compound reads NO server data: an alignment offset is view state the
 * person operating the slider owns. There is no src/data read here, no src/stores
 * import, no route and no key string - by absence, not by exemption. (alignment-offset.js
 * says the same of itself.)
 *
 * ============================================================================
 * BUG H8 - THE ONE THIS ROW IS ON THE HOOK FOR
 * ============================================================================
 *
 *   H8 | "The align bar's height is set by the 64px Reset button, not the 44px slider
 *        beside it." | slate-components.css:151   (LAYOUT_SPEC_DRAFT.md:1211)
 *
 * Measured, mechanically, in one corpus state - the two siblings disagreeing is the whole
 * defect and both numbers are in the oracle:
 *
 *   CITE  history-viewer #hv-align [i=176] height = 44px  <-  slate-live.css
 *         `#history-viewer-overlay .slate-compare-offset input[type="range"]`
 *         authored `44px`  !important=no  (FROZEN/hardcoded)
 *   CITE  history-viewer #hv-align-reset [i=178] height = 64px  <-  (no declaration —
 *         inherited or initial value)  (token-driven)
 *   CITE  history-viewer #hv-align-bar [i=172] height = 90px  <-  (no declaration —
 *         inherited or initial value)     = 64 + 2x12 padding + 2x1 border
 *
 * `layout/selector.md:579` costs it: the bar is 20px taller than its own control needs,
 * and at the design canvas that is 20px taken off a plot page that already does not fit.
 *
 * THE FIX, and it is two declarations. The row states its own height from ONE token, and
 * every control in it is sized to that row:
 *
 *   1. `.bar { block-size: <row + padding + border> }` - a STATED height. Nothing in the
 *      row can push it: not a taller button, not a wrapped label, not a slotted key.
 *   2. the slider takes the same row through the hit-area utility's documented knob,
 *      `--_ui-hit-box` (CONVENTIONS §5: "overrides the floor where a control needs a
 *      taller one"; ui-slider.js:190-199 measured that it reaches the utility by
 *      inheritance from outside). Its ink stays 8px.
 *
 * So the slider and the Reset are the SAME height and neither of them sets the bar. The
 * row is --ui-control-h, "the skin's spine: .slate-btn, .slate-field, .slate-select, list
 * rows, rail rows, settings rows" (spec §3.1) - a control row in this skin is 64, and at
 * 44 the align slider was the one control in the app that was not. The taller box is also
 * strictly the better touch target on a wet panel (--ui-hit-min is a FLOOR, not a size).
 *
 * WHY NOT THE OTHER WAY - shrink the Reset to the slider's 48 and let the bar be 70? That
 * needs a compact variant of #1, which #1 does not have and which is a wave-1 change, not
 * this row's. Recorded as a deferred question rather than improvised. Either way H8 is
 * dead the moment the bar states its own height, which is the half this file can do
 * without reaching into another component.
 *
 * ============================================================================
 * WHAT THE ORACLE DECIDED, quoted (Part 10 §4 citation rule)
 * ============================================================================
 * Disqualification check run first (prov_query.py --help). The oracle has NO vote on
 * responsive behaviour (98.4% of Slate's geometry is frozen at 1920x1200) - the layout
 * spec governs the container rule below - and no vote on the bar's HEIGHT, which is bug
 * H8. Everything else in this file is quoted:
 *
 *   CITE  find --cls slate-compare-bar -> "found 1 element(s) in 1 state(s)",
 *         history-viewer #hv-align-bar [i=172] <div id="hv-align-bar"
 *         class="slate-compare-bar"> text "A solid B dashed Align B 0.0 s Reset"
 *         rect x=28 y=136 w=1864 h=90
 *   CITE  history-viewer #hv-align-bar [i=172] background-color = rgb(14, 19, 23)
 *         <- slate-live.css `#history-viewer-overlay .slate-compare-bar`  (token-driven)
 *         = --ui-fascia in dark; light rgb(242,243,243) is the same token.
 *   CITE  history-viewer #hv-align-bar [i=172] gap = 24px  <-  slate-live.css
 *         `#history-viewer-overlay .slate-compare-bar`  authored `var(--slate-space-5)`
 *   CITE  history-viewer #hv-align-bar [i=172] padding-left = 24px  (shorthand; the
 *         authored value is not captured - source reads `var(--slate-space-3)
 *         var(--slate-space-5)`, slate-live.css:2292)
 *   CITE  history-viewer #hv-align-bar [i=172] border-top-left-radius = 6px = --ui-radius
 *   CITE  find --cls slate-compare-offset -> "found 1 element(s) in 1 state(s)",
 *         history-viewer .slate-compare-offset [i=174] <label class="slate-compare-offset">
 *         text "Align B 0.0 s"  rect x=336 y=159 w=1410 h=44
 *   CITE  history-viewer .slate-compare-offset-label [i=175] color = rgb(148, 161, 169)
 *         <- slate-live.css authored `var(--slate-muted)`   -> --ui-muted
 *   CITE  history-viewer .slate-compare-offset-label [i=175] font-size = 15px
 *         <- authored `var(--slate-text-cap)`               -> --ui-text-sm
 *   CITE  history-viewer .slate-compare-offset-label [i=175] text-transform = uppercase,
 *         letter-spacing = 1.8px (authored `0.12em`), font-weight = 600
 *         -> the .ui-microcap TYPE ROLE, which owns all four (TYPE_ROLES.md:67). The
 *         role's tracking is --ui-tracking-cap and its weight is --ui-weight-semibold —
 *         both of them Slate's own values since parity surfaces 0 and 1, so the role no
 *         longer departs from the oracle here at all.
 *   CITE  history-viewer #hv-align-value [i=177] width = 84px   -> the readout's floor
 *   CITE  history-viewer #hv-align-value [i=177] color = rgb(244, 247, 248)
 *         <- authored `var(--slate-text)`                    -> --ui-text
 *   CITE  history-viewer #hv-align-value [i=177] font-size = 17px
 *         <- authored `var(--slate-text-base)`               -> --ui-text-base
 *   CITE  history-viewer #hv-align-reset [i=178] color = rgb(148, 161, 169)  <-
 *         slate-components.css `.slate-btn:disabled, .slate-btn[disabled],
 *         .slate-btn[aria-disabled="true"]` authored `var(--slate-muted)` !important=yes
 *         - the captured state has the Reset DISABLED at offset 0, which is exactly
 *         alignmentControlState's `resetDisabled` rule ("reset is only ever an undo").
 *
 * TWO SLATE RULES DELIBERATELY NOT CARRIED, both replaced by something already in the
 * library rather than by a second copy here:
 *   - `.slate-compare-bar[data-comparing="false"] { opacity: .45 }` (slate-live.css:2402)
 *     - a fifth dim value. There is ONE disabled dial, --ui-opacity-disabled (spec §3.7),
 *     and the base paints it; the caption and the key take the same dial, nothing else.
 *   - the `input[type=range]` block (:2345-2374): 30 lines of track, thumb, gradient and
 *     hit padding that ARE #23. Composed, not reproduced.
 *
 * ============================================================================
 * COMPOSITION AND THE SLOT
 * ============================================================================
 * #23 ui-slider, #1 ui-button - the row's two stated dependencies, composed. The
 * readout is an <output>, which is this component's own element and not a control.
 *
 * The A-solid/B-dashed key rides in `slot="key"`. It is a CHART key (Slate marks it
 * aria-hidden and draws it with two border-top rules, slate-live.css:2302-2326) and the
 * library already has a key component, #10 ui-chart-legend; re-drawing one here would be
 * the third legend in a skin that is meant to have one. The slot is empty by default,
 * costs no gap when nothing is assigned, and lets the History screen (wave 5 phase 6)
 * settle where the A/B key lives without this file being rewritten. Recorded as a
 * deferred question.
 */

import { html, css, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import 'src/components/ui-slider.js';
import 'src/components/ui-button.js';
import {
    ALIGNMENT_OFFSET_LIMIT_S,
    ALIGNMENT_OFFSET_STEP_S,
    ALIGNMENT_SLOT,
    alignmentControlState,
    alignmentOffsetAfterSlotChange,
    clampAlignmentOffset,
    formatAlignmentOffset,
} from 'src/lib/alignment-offset.js';

/** Slate's own strings, carried unchanged (index.html:581-586). */
const DEFAULT_LABEL = 'Align B';
const DEFAULT_SLIDER_LABEL = 'Slide shot B along the time axis';
const DEFAULT_RESET_LABEL = 'Reset';

class UiCompareBar extends UiElement {
    static properties = {
        /**
         * The offset in force, in seconds. Clamped to the ported policy on every
         * update, so what a consumer reads back is what is applied - the
         * "no two controls can disagree" rule (history-viewer.js:1146).
         */
        offset: { type: Number },
        /** Is there a second shot to slide? Reflected: it dims the caption. */
        hasComparison: { type: Boolean, attribute: 'has-comparison', reflect: true },
        /**
         * A chart page has a time axis; the data page does not.
         *
         * DEFAULT TRUE, and the converter is why the attribute can still say otherwise
         * (the same shape as ui-screensaver.js:275-287, item #57): a plain Boolean
         * attribute cannot express "off" by absence, and absence is the common case in
         * markup - a compare bar lives on a chart page, which is what the port's own
         * default says. `has-time-axis="false"` turns it off; anything else present, or
         * absent altogether, leaves it on.
         */
        hasTimeAxis: {
            attribute: 'has-time-axis',
            converter: { fromAttribute: (value) => value !== null && value !== 'false' },
        },
        /**
         * DERIVED AND REFLECTED, not an input: alignmentControlState().available. A
         * table has no time axis to slide, so the bar is not shown at all rather than
         * shown dead - Slate's own `bar.hidden = state.page === 'data'`
         * (history-viewer.js:1046) expressed as state instead of an imperative write to
         * a global attribute. The element stays in the DOM and takes no box.
         */
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
        // Structural fragment FIRST (CONVENTIONS §4 usage rule 1). No selectionSurface:
        // this component has a value and an enablement, never a selected state, so
        // Appendix 15's aria-state contract has nothing to bind to here.
        typeRoles,
        css`
            :host {
                /* THE ROW, AND THE WHOLE OF H8's FIX.
                 *
                 * One private length, read by everything in the strip: the bar states
                 * its block-size from it and the slider is sized to it. --ui-control-h
                 * is the skin's spine (spec §3.1), which is what a control row is;
                 * --ui-hit-min is a FLOOR for a small control, not a row height.
                 *
                 * Reverse the H8 decision by changing this one line. */
                --_ui-compare-row: var(--ui-control-h);
            }

            /* Derived, not declared (spec §3.1's one good pattern): the bar is the row
             * plus its own padding and border. box-sizing is border-box for everything
             * in this tree (base.js), so block-size has to carry all three. */
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

            /* Not shown at all rather than shown dead. The base already gives
             * :host([hidden]) { display: none } for a consumer that wants to hide the
             * bar for its own reasons; this is the component's own answer to "there is
             * no time axis", and the two do not collide. */
            :host(:not([available])) {
                display: none;
            }

            /* THE KEY SLOT. A slot with nothing assigned is still a flex item and would
             * still take a 24px gap beside it, which is a gap in front of nothing. The
             * assignment is tracked in JS because no selector can see it: :empty tests
             * light-DOM children and :has() walks the DOM tree, neither of which is the
             * flattened tree. */
            .key {
                display: none;
                flex: 0 0 auto;
                align-items: center;
            }

            :host([has-key]) .key {
                display: flex;
            }

            /* Slate's own label row: flex 1 1 auto, min-width 0, so the SLIDER is what
             * absorbs a squeeze and the caption, readout and Reset keep their size
             * (slate-live.css:2328-2334). The gap is its --slate-space-4. */
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

            /* THE ALIGN SLIDER, sized to the row through the hit-area utility's
             * documented knob. The ink stays --ui-space-2 (#23's own declaration), so
             * this makes the TARGET taller and paints nothing new. A slider narrower
             * than a fingertip is not a control, so the floor is the hit minimum;
             * below that the strip overflows visibly rather than crushing it. */
            .control {
                flex: 1 1 auto;
                min-inline-size: var(--ui-hit-min);
                --_ui-hit-box: var(--_ui-compare-row);
            }

            /* Tabular, so the number does not shuffle sideways under a finger that is
             * still on the slider (slate-live.css:2389-2390, carried as the .ui-numeric
             * role rather than as a second font-variant declaration).
             *
             * THE ONE BARE px IN THIS FILE, DECLARED: it is spec §2.3 CASE 4, "Minimum
             * floors on a flex/grid track", which the spec calls "required, not merely
             * permitted" (LAYOUT_SPEC_DRAFT.md:199-200). §2.3 opens by saying a reviewer
             * "may reject a bare px on sight" (:190-191), so the case is named here rather
             * than left to be inferred. The readout is flex: 0 0 auto and therefore
             * content-sized, and its content changes width as the offset moves 0.0 -> +0.1
             * -> -5.0; without a floor the Reset button walks sideways under the thumb
             * while the user is still dragging. The number is not chosen here - it is
             * Slate's own, carried exactly (CITE history-viewer #hv-align-value [i=177]
             * width = 84px, :119 above).
             *
             * It is a FLOOR, not a width - content may exceed it - and nothing else in the
             * skin has to agree with 84, so it is not a shared constant wanting a token
             * (§2.3's "the same number written in two places" ban). It IS type-derived,
             * though: 84px was measured against Slate's 17px face, so it does not track
             * --ui-text-base the way a ch- or em-based floor would. Not re-derived here -
             * moving it moves a frozen CITE and re-baselines this component's captures,
             * and wave 5 phase 6 owns the History screen where the readout gets its real
             * content. Recorded as a deferred question. */
            .readout {
                flex: 0 0 auto;
                min-inline-size: 84px;
                color: var(--ui-text);
                font-size: var(--ui-text-base);
                text-align: end;
            }

            .reset {
                flex: 0 0 auto;
            }

            /* ONE DIAL, NOT A FIFTH VALUE. Slate dims the key and the caption to .45
             * when there is nothing to compare (slate-live.css:2400-2405, "nothing to
             * align against reads as a dimmed bar, not a missing one"). The controls
             * dim themselves - they carry the real disabled state and the base paints
             * --ui-opacity-disabled on it - so all this rule does is bring the two
             * pieces of static text along at the same dial. */
            :host(:not([has-comparison])) .key,
            :host(:not([has-comparison])) .caption {
                opacity: var(--ui-opacity-disabled);
            }

            /* THE ONE CONTAINER RULE (spec §2.1 Rule 1; the oracle has no vote on
             * responsive behaviour). The strip's fixed side is 48 padding + 71 caption +
             * 18 + 84 readout + 18 + ~96 Reset + 24 = ~359px, so at 640px the track is
             * ~281px for 100 steps of 0.1 s - under 3px a step, where the control stops
             * being usable before it stops fitting. Below that the caption drops: it is
             * a visual repeat of the slider's own accessible name, which is why it can
             * go without display: none costing an announcement. */
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

    willUpdate() {
        /* Clamp on the way in, whoever set it: a value from an attribute, a stored view
         * or a keyboard nudge is bounded by the same policy as the slider's own. The
         * port normalises -0 and rejects non-finite input, so this settles in one pass. */
        const clamped = clampAlignmentOffset(this.offset);
        if (clamped !== this.offset) this.offset = clamped;
        this.available = this.#state.available;
    }

    /**
     * Apply the ported slot-change rule and tell the screen. Call this when a shot
     * picker changes: sliding B and then choosing a different B leaves an offset that
     * belongs to a shot that is gone (alignment-offset.js:100-119).
     *
     * @param {string} slot ALIGNMENT_SLOT.REFERENCE ('a') or ALIGNMENT_SLOT.MOVING ('b')
     */
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

    #onReset() {
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
                    <output
                        id="readout"
                        class="ui-numeric readout"
                        part="readout"
                        aria-hidden="true"
                    >${text}</output>
                </div>
                <ui-button
                    id="reset"
                    class="reset"
                    part="reset"
                    ?disabled=${state.resetDisabled}
                    @click=${this.#onReset}
                >${this.resetLabel}</ui-button>
            </div>
        `;
    }
}

customElements.define('ui-compare-bar', UiCompareBar);

export { UiCompareBar, ALIGNMENT_SLOT };
