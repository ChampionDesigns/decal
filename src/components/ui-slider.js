/**
 * ui-slider - Wave 1 item #23. The library primitive Slate never had.
 *
 * "Component library primitives that never existed: slider, tile, confirm dialog,
 * nav row, list row, toast" (`DECISIONS.md:251`). What Slate has instead is
 * LAYOUT_SPEC_DRAFT.md §5.2 #23's "3 + 1":
 *
 *   Live rating      `slate-live.css:1537-1583`   32px box / 8px ink / 26px thumb
 *   HV align         `slate-live.css:2345-2384`   44px box / 8px ink / 26px thumb
 *   Settings bright  `slate-shell.css:1547-1558`  12px track / 38px thumb (2x !important)
 *   Gecko            `main.css:386-395`           24x24 `#385a92`, never overridden
 *
 * - "Four thumb specs, two of them off-token." This file is one spec, and the two
 * engines read the SAME declarations from the same private properties, which is what
 * retires bug T22 (`LAYOUT_SPEC_DRAFT.md:1198`).
 *
 * ============================================================================
 * WHAT THE ORACLE DECIDED, quoted (Part 10 §4 citation rule)
 * ============================================================================
 *
 * FILL AND REST COLOUR - the strongest answer in the corpus, because it agrees
 * across both themes and therefore names the tokens rather than the colours:
 *
 *   CITE  live-ready #shot-rating-slider [i=157] background-image =
 *         linear-gradient(to right, rgb(176, 196, 206) 0%, rgb(176, 196, 206) 0%,
 *         rgb(58, 72, 82) 0%, rgb(58, 72, 82) 100%)
 *         <-  slate-live.css  #main-page .slate-rate-slider
 *         authored (NOT CAPTURED - set via a CSS shorthand)  !important=no  (token-driven)
 *   CITE  themes live-ready #shot-rating-slider [i=157] background-image
 *         light  linear-gradient(to right, rgb(49, 92, 112) 0%, rgb(49, 92, 112) 0%,
 *         rgb(203, 208, 211) 0%, rgb(203, 208, 211) 100%)   DIFF
 *
 * dark  rgb(176,196,206) = --ui-steel   / rgb(58,72,82)    = --ui-line
 * light rgb(49,92,112)   = --ui-steel   / rgb(203,208,211) = --ui-line
 * So: the FILL is --ui-steel and the REST is --ui-line, in both themes, and the
 * corpus proves it is the token rather than a coincidence.
 *
 * RADIUS:
 *   CITE  live-ready #shot-rating-slider [i=157] border-top-left-radius = 8px
 *         <-  slate-live.css  #main-page .slate-rate-slider
 *         authored (NOT CAPTURED - set via a CSS shorthand)  (token-driven)
 *         (identical dark and light; 16 of 18 properties are)
 *   8px = --ui-radius-lg.
 *
 * INK: not directly probed, but both real sliders derive it the same way -
 * 32 - 2x12 = 8 (`slate-live.css:1544-1545`) and 44 - 2x18 = 8 (`:2347,2370`).
 * Two consumers agreeing on 8px is a token: --ui-space-2.
 *
 * ORACLE DISQUALIFIED - the box height. The measurement exists:
 *   CITE  live-ready #shot-rating-slider [i=157] height = 32px
 *         <-  slate-live.css  #main-page .slate-rate-slider  authored 32px  (token-driven)
 *   CITE  find --cls slate-rate-slider -> 7 elements in 7 states, all 147 x 32
 * and it is a bug: CONVENTIONS §5 / LAYOUT_SPEC_DRAFT.md §2.3 case 2 - "the rating
 * slider is 32px tall against the same 48px floor". Matching it reproduces the
 * defect, so the box is --ui-hit-min through the ONE shared hit-area utility.
 *
 * The HV align slider is the same story one step closer, and its 44px is a SOURCE
 * read, NOT an oracle answer - the distinction matters enough to spell out, because
 * the obvious corpus record is a different element:
 *   CITE  find --cls slate-compare-offset -> 1 element in 1 state,
 *         history-viewer .slate-compare-offset [i=174]
 *         <label class="slate-compare-offset">  text "Align B 0.0 s"
 *         rect x=336 y=159 w=1410 h=44
 * That is the 1410px-wide LABEL ROW that wraps the control, not the slider. The
 * range input inside it was never probed on its own.
 *   SOURCE slate-live.css:2345-2347 `#history-viewer-overlay .slate-compare-offset
 *          input[type="range"] { min-width: 0; height: 44px; ... }` with
 *          `padding-block: 18px` at :2370  ->  44 - 2x18 = the same 8px ink.
 *
 * ORACLE CARVE-OUT - the thumb. The provenance probe measured an 18-property
 * appearance surface on ELEMENTS; a `::-webkit-slider-thumb` is not an element and
 * has no record. Per the tool's own carve-out that falls through to reading the
 * Slate source read-only, and the two real sliders are identical there:
 *   slate-live.css:1574-1580 and :2376-2383 - 26x26, `border: var(--slate-hairline)
 *   solid var(--slate-line-strong)`, `border-radius: 50%`, `background:
 *   var(--slate-surface)`.
 * 26 is not a Slate token, but it is not a magic number either: it is a 24px disc
 * (--ui-icon) plus a hairline on each side, which is exactly what those rules draw.
 * Written as that derivation it stops being a fourth number to keep in step
 * (spec §3.1's "derived, not declared", the one good pattern in the old token file).
 *
 * RESPONSIVE BEHAVIOUR has no oracle answer at all (98.4% frozen). The layout spec
 * governs: the control fills its own container and reads nothing about the viewport.
 *
 * ============================================================================
 * WHAT THIS PRIMITIVE OWNS, AND WHAT IT REFUSES TO
 * ============================================================================
 *
 * Wave law (Part 10 §12): token-only. No data layer, no ReaPrime, no endpoint.
 * `min` / `max` / `step` / `value` / `origin` arrive from outside as properties; the
 * slider never decides what a range means. It emits `input` while dragging (the
 * native event is composed, so it crosses the boundary by itself, retargeted to the
 * host) and re-dispatches `change` on commit, because `change` is composed: false
 * and would otherwise die at the shadow boundary.
 *
 * `origin` is the one behaviour carried up from a consumer rather than invented: the
 * HV align slider fills from the MIDPOINT, not from the left end, and says why -
 * "a slider sitting at 0.0 s reads as centred rather than as 60% of something"
 * (`slate-live.css:2350-2356`). One property replaces a second hand-rolled gradient.
 *
 * SIZING IS THE CONSUMER'S, and both of Slate's own consumers agree: the rating
 * slider states `width: 100%; flex: 0 0 auto` (`slate-live.css:1538,1551`) and the
 * align slider states `min-width: 0; flex: 1 1 auto` (`:2346-2348`). So this file
 * declares no width, no flex and no minimum - a primitive that owned one would be
 * owning a limit, which the wave law puts outside it. What it does owe the consumer
 * is a non-zero size when nobody has stated one: see the container-type note on
 * `:host` below, which is the difference between an unsized slider laying out at its
 * intrinsic width and laying out at 0.
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
        /**
         * THE ONE PROPERTY HERE THAT IS A STRING, AND IT HAS TO BE.
         *
         * `step` is not only a number: `step="any"` is the standard spelling for a
         * continuous control and is the whole of HTML's answer for one. Typed
         * `Number` it arrives as `Number('any')` = NaN, renders the literal
         * attribute `step="NaN"`, and the input falls back to its default step of 1
         * - so a -5..+5 align slider at 1.234 silently reports 1 while the host and
         * the painted fill still say 1.234 (measured: input.value "1", host.value
         * 1.234, gradient at 62.34% with the thumb at 60%).
         *
         * Nothing in this file does arithmetic with `step`; it is forwarded to the
         * input, which is the only thing that should be interpreting it. So it is
         * carried verbatim - `"any"`, `".1"`, `"1"` - and a consumer assigning the
         * property a number still works, because Lit stringifies on the way to the
         * attribute. Ranges and limits arrive from outside (Part 10 §12) and this is
         * one of them: the slider does not get to decide that a range is discrete.
         */
        step: { type: String },
        value: { type: Number },
        /**
         * Where the fill starts, in the same units as `value`. Null (the default)
         * means "the low end", which is every slider that measures a magnitude.
         * Set it to 0 on a -5..+5 range and the fill runs from the middle.
         */
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
                /* CONTAINER-TYPE OPT-OUT, the one line CONVENTIONS §2 documents, and
                 * the reason is measured. container-type: inline-size applies
                 * inline-size CONTAINMENT, so the host's own inline size can no
                 * longer depend on its contents - which makes its max-content size
                 * ZERO. Inside a flex row (which is what BOTH of Slate's consumers
                 * are: slate-live.css:1551 and :2348 both state flex) a
                 * content-sized item then lays out at 0px: measured, host box
                 * {width: 0, height: 48} in a 400px flex row, an invisible control
                 * still eating a 48px line. With the opt-out the same row lays the
                 * control out at its intrinsic width (measured 129px) and a consumer
                 * that states a width or a flex still gets exactly what it stated.
                 *
                 * Nothing is lost: this component has no @container query of its
                 * own, so the containment bought nothing here. If one is ever added,
                 * delete this line and give the consumers a stated width - that is
                 * the whole reversal.
                 *
                 * display: block from the base is kept: an inline box with size
                 * containment is the 0x0 failure the base's own comment describes,
                 * and a block is what fills a slot. */
                container-type: normal;

                /* THE INK AND THE THUMB, DECLARED ON THE HOST.
                 *
                 * Both were declared on .track and that made one of the two
                 * documented hit-area knobs silently dead: --_ui-hit-box reaches
                 * the utility by inheritance from outside, but a --_ui-hit-ink set
                 * on the host was shadowed by the component's own declaration on the
                 * element the utility reads. Measured before the move: host style
                 * --_ui-hit-ink:12px; --_ui-hit-box:44px gave block-size 44px (the
                 * box knob took) with padding-block-start 18px = (44-8)/2 - the ink
                 * knob did nothing. Declared here, both behave the same way: an
                 * inline style on the host outranks :host, so the escape hatch
                 * base.js documents actually opens. */

                /* The ink. Two Slate sliders agree on 8px; --ui-space-2 is 8px. */
                /* THE INK'S HEIGHT, NAMED, because three rules need the same number:
                 * the hit-pad utility centres this much visible bar inside the 48px
                 * touch box, the engine's own runnable track has to be the same height,
                 * and the thumb is centred against it. */
                --_ui-slider-ink: var(--ui-space-2);
                --_ui-hit-ink: var(--_ui-slider-ink);

                /* THE ONE THUMB SPEC, and the whole of bug T22's answer. Both
                 * engines read this; neither carries a number of its own.
                 * = 24px of disc (--ui-icon) + a hairline each side = 26px, which
                 * is what slate-live.css:1574-1580 and :2376-2383 both draw. */
                --_ui-slider-thumb: calc(var(--ui-icon) + 2 * var(--ui-hairline));
            }

            /* ================================================================
             * THE TRACK
             *
             * .hit-pad, not .hit-overlay: the ink IS the background (base.js,
             * "TWO MODES"). The box becomes --ui-hit-min, the padding comes out
             * of it, and the paint is clipped back to the content box - so the
             * track reads as 8px while the whole 48px accepts a press. That is
             * spec Appendix 5's "hit area is separate from ink", as one utility
             * instead of the three copies Slate has.
             * ============================================================== */
            .track {
                /* BLOCK, not the input's default inline-block. An inline-level box
                 * sits on a line box, and the line box keeps room under the baseline
                 * for descenders: measured, the host rendered 53px tall around a 48px
                 * control, so every slider would carry 5px of phantom space and a row
                 * of them would not align with anything. Slate never met this because
                 * all three of its sliders are flex children. */
                display: block;
                inline-size: 100%;
                margin: 0;
                border: 0;
                border-radius: var(--ui-radius-lg);
                cursor: pointer;

                /* Chrome paints its OWN track over the gradient and fills it from
                 * the left end; Gecko paints ::-moz-range-progress for the same
                 * reason. appearance kills the first, accent-color the second -
                 * and both are wrong for an origin-anchored fill, which is the
                 * point slate-live.css:2350-2356 makes in prose. */
                appearance: none;
                -webkit-appearance: none;
                accent-color: transparent;

                /* PAINTED WITH A LONGHAND, NEVER THE background SHORTHAND. The
                 * shorthand resets background-clip to border-box - Slate's own
                 * sheet at slate-live.css:1562-1564 records what that did: "that
                 * is what turned the track into a 32px slab the first time". The
                 * utility's background-clip: content-box is therefore NOT
                 * re-declared here on purpose; if this line ever becomes a
                 * shorthand the rendering test fails rather than the track
                 * quietly swelling to fill its own hit box. */
                background-image: linear-gradient(to right,
                    var(--ui-line) 0%,
                    var(--ui-line) var(--_ui-slider-from, 0%),
                    var(--ui-steel) var(--_ui-slider-from, 0%),
                    var(--ui-steel) var(--_ui-slider-to, 0%),
                    var(--ui-line) var(--_ui-slider-to, 0%),
                    var(--ui-line) 100%);
            }

            /* ================================================================
             * THE THUMB - TWICE, IDENTICALLY. BUG T22.
             *
             * An unknown pseudo-element invalidates the whole selector list it
             * appears in, so the two engines cannot share one rule - which is
             * precisely how Slate ended up with a Gecko thumb nobody maintained:
             * 24x24, its own colours, its own hover transform (main.css:386-395).
             * The rules below therefore have IDENTICAL declaration blocks, every
             * value a token or a private property derived from one, and
             * test/ui-slider-thumb-parity.test.mjs fails if they ever drift.
             * (No backticks in a css template, CONVENTIONS §9 - one terminates it.)
             * ============================================================== */
            .track::-webkit-slider-thumb {
                appearance: none;
                -webkit-appearance: none;
                box-sizing: border-box;
                inline-size: var(--_ui-slider-thumb);
                block-size: var(--_ui-slider-thumb);
                /* THE THUMB SITS ON THE LINE. Ben, 23 Aug 2026, on the Live band's
                 * rating strip: "The slider for the Rate this shot is not done well
                 * with the slider not on the line."
                 *
                 * MEASURED: the bar is --_ui-slider-ink of visible track centred inside
                 * a --ui-hit-min touch box by the hit-pad utility, so the input's
                 * content box is 8px of ink inside 48 of box. Chrome does not centre the
                 * thumb on the ink: it resolved the runnable track against the outer box
                 * and put the thumb's middle about 20px BELOW the line it rides. Both
                 * halves of the correction were needed — the runnable track takes the
                 * ink's height below, and this offsets the thumb by half the difference.
                 * Removing either one puts it back off the line; measured, both ways.
                 *
                 * WRITTEN INTO BOTH BLOCKS, WHICH IS T22's WHOLE POINT. The pair is one
                 * job written twice because CSS cannot merge the two pseudo-elements,
                 * and the bug T22 names is the moment they stop being the same job. So
                 * the correction goes in both, from the same two private properties.
                 * Gecko centres its thumb on its own track unaided and does not need the
                 * offset — but this tree's baseline is the tablet's Chrome WebView, and
                 * a rule that is right in one engine and absent in the other is exactly
                 * the divergence the parity suite exists to prevent. If Gecko ever
                 * becomes a target, the answer is a wrapper that carries the hit area so
                 * the input's own box IS the ink, and neither correction is needed. */
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
                /* THE THUMB SITS ON THE LINE. Ben, 23 Aug 2026, on the Live band's
                 * rating strip: "The slider for the Rate this shot is not done well
                 * with the slider not on the line."
                 *
                 * MEASURED: the bar is --_ui-slider-ink of visible track centred inside
                 * a --ui-hit-min touch box by the hit-pad utility, so the input's
                 * content box is 8px of ink inside 48 of box. Chrome does not centre the
                 * thumb on the ink: it resolved the runnable track against the outer box
                 * and put the thumb's middle about 20px BELOW the line it rides. Both
                 * halves of the correction were needed — the runnable track takes the
                 * ink's height below, and this offsets the thumb by half the difference.
                 * Removing either one puts it back off the line; measured, both ways.
                 *
                 * WRITTEN INTO BOTH BLOCKS, WHICH IS T22's WHOLE POINT. The pair is one
                 * job written twice because CSS cannot merge the two pseudo-elements,
                 * and the bug T22 names is the moment they stop being the same job. So
                 * the correction goes in both, from the same two private properties.
                 * Gecko centres its thumb on its own track unaided and does not need the
                 * offset — but this tree's baseline is the tablet's Chrome WebView, and
                 * a rule that is right in one engine and absent in the other is exactly
                 * the divergence the parity suite exists to prevent. If Gecko ever
                 * becomes a target, the answer is a wrapper that carries the hit area so
                 * the input's own box IS the ink, and neither correction is needed. */
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
                /* The ink's height, matching the WebKit rule above — see the thumb's
                 * note. 100% was read against the outer box rather than the visible
                 * bar, which is what put the thumb off the line. */
                block-size: var(--_ui-slider-ink);
                background-color: transparent;
                border: 0;
            }

            /* ONE DIM, NOT TWO. The base paints --ui-opacity-disabled on the HOST
             * (the reflected disabled attribute) and on any [disabled] element
             * inside the shadow tree - and the real input must carry the native
             * attribute, because that is what stops it accepting input
             * (CONVENTIONS §4: "the host attribute dims, it does not disable").
             * Both at once multiplies the dial by itself: .38 x .38 = .14. A plain
             * (0,1,0)+(0,1,0) selector beats the base's :where() at zero
             * specificity, so this needs no !important (CONVENTIONS §6). */
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
