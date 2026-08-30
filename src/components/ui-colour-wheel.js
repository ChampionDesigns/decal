/**
 * ui-colour-wheel.js — A COLOUR WHEEL AND A BRIGHTNESS SLIDER, over the vendored iro.
 *
 * WHY IT EXISTS. Ben, 24 August 2026: "LED colour wheel is missing from the settings."
 * The lighting leaf shipped with six preset swatches and no way to pick anything else,
 * which on a strip whose whole point is colour is a control that answers six questions
 * out of sixteen million. Slate has the wheel (`settings.js initLedPicker`), iro is
 * already vendored here, and nothing was using it.
 *
 * IT WRAPS iro RATHER THAN DRAWING ONE. A hue wheel with a value slider is a solved
 * problem with real pointer maths behind it, and the library is already in the tree.
 *
 * ===========================================================================
 * THE THREE TRAPS, ALL OF THEM SLATE'S, PAID FOR ONCE HERE
 * ===========================================================================
 *
 * 1. THE SCALE. iro reads `getBoundingClientRect()` for the pointer and its own `width`
 *    CONFIG for the geometry. Under `app-fit`'s `zoom: S` the rect is in PAINTED units
 *    and the config is in DESIGN units, so a touch lands off by S — worse the further
 *    from the top-left corner it is. Slate hit this with a `transform: scale` and
 *    counter-scaled the picker; the same cure works here, and the sizing is what makes
 *    it invisible: `zoom: 1/S` on the host neutralises the app's zoom, and the config
 *    width is `design x S`, so the wheel PAINTS at exactly the size a design-unit
 *    sibling does and iro's two coordinate systems agree.
 *
 * 2. THE PROGRAMMATIC SET. iro fires `input:change` for `color.set()` as well as for a
 *    finger, so writing the current colour in when the selection moves would instantly
 *    write the colour you navigated AWAY FROM into the zone you navigated TO. Slate's
 *    own note calls that "a data-loss bug" wearing a flicker fix. `#writing` is the
 *    guard, and it is set around every programmatic write.
 *
 * 3. THE REBUILD. Constructing a picker on every render is the flicker, and it also
 *    loses the drag in progress. The instance is built ONCE per mounting and afterwards
 *    only its colour is set.
 *
 * 4. THE VALUE COMING BACK ROUND MID-DRAG. A consumer that acts on `colour-input` hands
 *    this element a new `value`, and writing that into the picker MOVES THE HANDLE the
 *    finger is holding — so the colour follows for a moment and then stops. Trap 2's
 *    guard cannot cover it: that one stops OUR write being reported as a gesture, this
 *    is a gesture being overwritten by our write. A drag owns the picker; a write made
 *    during one is held and applied on the lift.
 *
 * WHAT IT REPORTS, and the difference matters to a caller that writes to a machine:
 *   `colour-input`  the value while a finger is moving. Many per drag.
 *   `colour-change` the value when the finger lifts. One per drag.
 * Slate drives its live preview from the first and its commit from the second.
 *
 * API
 *   <ui-colour-wheel value="#ff8800" label="Zone colour" size="300"></ui-colour-wheel>
 */

import { html, css } from 'lit';
import iro from 'iro';

import { UiElement } from 'src/components/base.js';

/** The wheel's design-unit width when a caller states none. Slate's own 300. */
export const DEFAULT_WHEEL_SIZE = 300;

/** A six-digit hex, or null. The one shape this component speaks. */
export function readHex(value) {
    const text = String(value ?? '').trim();
    return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : null;
}

export class UiColourWheel extends UiElement {
    static properties = {
        /** The colour, as `#rrggbb`. Anything else is ignored rather than guessed at. */
        value: { type: String },
        /** Accessible name for the group. */
        label: { type: String },
        /** The wheel's width in DESIGN units. */
        size: { type: Number },
        /** Paint AND refusal. */
        disabled: { type: Boolean, reflect: true },
    };

    static styles = [css`
        :host {
            container-type: normal;
            display: block;
        }

        /* THE SLOT RESERVES THE SPACE. The picker is counter-zoomed, so its painted size
         * and its layout box disagree; the wrapper is what keeps a sibling from landing
         * underneath it. Same shape as the old skin's own picker slot. */
        .slot {
            position: relative;
            display: block;
        }

        .picker {
            display: block;
        }

        :host([disabled]) .slot {
            opacity: var(--ui-opacity-disabled);
            pointer-events: none;
        }
    `];

    constructor() {
        super();
        this.value = '';
        this.label = '';
        this.size = DEFAULT_WHEEL_SIZE;
        this.disabled = false;
        this.#picker = null;
        this.#writing = false;
        this.#built = null;
    }

    #picker;

    /** True while this element is setting the picker's colour — see trap 2. */
    #writing;

    /** The `{size, scale}` the live picker was built for, so a change rebuilds it. */
    #built;

    disconnectedCallback() {
        this.#destroy();
        super.disconnectedCallback();
    }

    updated(changed) {
        super.updated(changed);
        this.#ensure();
        if (changed.has('value')) this.#write(readHex(this.value));
    }

    /**
     * The app's own zoom, or 1.
     *
     * READ OFF THE PUBLISHED PROPERTY, never measured: `app-fit.js` writes
     * `--ui-app-scale` on the root and is the one owner of what the scale is. Measuring
     * a rect here would be a second answer to the same question, and the two would
     * disagree during a resize.
     */
    get #scale() {
        const root = this.ownerDocument?.documentElement;
        if (!root) return 1;
        const raw = parseFloat(getComputedStyle(root).getPropertyValue('--ui-app-scale'));
        return Number.isFinite(raw) && raw > 0 ? raw : 1;
    }

    #destroy() {
        this.#picker = null;
        this.#built = null;
        const mount = this.renderRoot?.getElementById?.('picker');
        if (mount) mount.innerHTML = '';
    }

    /** Build the picker once, and again only when its size or the app's scale moves. */
    #ensure() {
        const mount = this.renderRoot?.getElementById?.('picker');
        if (!mount) return;
        const scale = this.#scale;
        const size = Number.isFinite(this.size) && this.size > 0 ? this.size : DEFAULT_WHEEL_SIZE;
        if (this.#picker && this.#built && this.#built.size === size && this.#built.scale === scale) return;

        this.#destroy();
        const slot = this.renderRoot.getElementById('slot');
        /* THE CONFIG WIDTH IS DESIGN x SCALE and the host is counter-zoomed — see trap 1.
         * At S = 1 both are no-ops and this is an ordinary picker. */
        const painted = Math.max(1, Math.round(size * scale));
        mount.style.zoom = scale === 1 ? '' : String(1 / scale);
        if (slot) slot.style.blockSize = '';

        this.#picker = new iro.ColorPicker(mount, {
            width: painted,
            color: readHex(this.value) ?? '#ffffff',
            borderWidth: 0,
            handleRadius: Math.max(8, Math.round(painted * 0.06)),
            padding: 6,
            layout: [
                { component: iro.ui.Wheel, options: { wheelLightness: false } },
                { component: iro.ui.Slider, options: { sliderType: 'value' } },
            ],
        });
        this.#built = { size, scale };

        /* THE SLOT TAKES THE PAINTED HEIGHT, because the counter-zoom means the picker's
         * layout box is smaller than what it draws. Read after construction, so it is the
         * picker's own answer rather than an arithmetic guess about the slider's height. */
        if (slot) {
            const box = mount.getBoundingClientRect();
            if (box.height > 0) slot.style.blockSize = `${box.height / (scale || 1)}px`;
        }

        /* THE FOURTH TRAP, AND IT IS THE ONE THAT COST A DRAG (Ben, 24 Aug 2026: "The
         * actual LED colour follows my finger for a little bit but then stops").
         *
         * THE VALUE COMES BACK ROUND. A consumer that acts on `colour-input` — the LED
         * leaf writes it to the machine — publishes a store change, re-renders, and hands
         * this element a new `value`. `updated()` then writes it INTO the picker, and
         * `color.set` MOVES THE HANDLE. Mid-drag that is a fight: the finger is at one
         * angle, the write puts the handle at another, and iro's own tracking is
         * computing from a handle that keeps being moved under it. What a user sees is a
         * colour that follows for a moment and then stops.
         *
         * IT IS NOT TRAP 2 AND THE GUARD FOR THAT ONE CANNOT COVER IT. `#writing` stops
         * OUR write from being reported back as a user gesture — the loop in the other
         * direction. This is the user's gesture being overwritten by our write, and the
         * only thing that can tell them apart is knowing a drag is in progress.
         *
         * THE VALUE IS ALSO NOT THE SAME VALUE. What comes back has been through
         * `ledHex8ToColour16` and back, so it is quantised — a write of a colour the user
         * did not choose, on top of the handle they are holding.
         *
         * So: a drag OWNS the picker. Writes are refused while one is in flight and the
         * last refused value is applied on the lift, so a consumer that clamped or
         * quantised still gets its answer onto the handle — just not during the gesture. */
        this.#picker.on('input:start', () => { this.#dragging = true; });

        this.#picker.on('input:change', (colour) => {
            if (this.#writing || this.disabled) return;
            this.#emit('colour-input', colour.hexString);
        });

        this.#picker.on('input:end', (colour) => {
            this.#dragging = false;
            /* THE WRITE THE DRAG REFUSED, applied now that the handle is free. Without
             * this a consumer that quantises would never see its own answer on the wheel:
             * every write during the drag was dropped and the last one arrived while the
             * flag was still up. */
            const pending = this.#pendingWrite;
            this.#pendingWrite = null;
            if (this.#writing || this.disabled) return;
            this.#emit('colour-change', colour.hexString);
            if (pending) this.#write(pending);
        });
    }

    /** True while a finger or a mouse is on the wheel. See trap 4. */
    #dragging = false;

    /** A write refused during a drag, applied on the lift. See trap 4. */
    #pendingWrite = null;

    /** Set the picker's colour without its own change event coming back at us. */
    #write(hex) {
        if (!this.#picker || !hex) return;
        /* A DRAG OWNS THE PICKER (trap 4). Held, not dropped: the lift applies it. */
        if (this.#dragging) { this.#pendingWrite = hex; return; }
        if (String(this.#picker.color.hexString).toLowerCase() === hex) return;
        this.#writing = true;
        try {
            this.#picker.color.set(hex);
        } finally {
            this.#writing = false;
        }
    }

    #emit(type, hex) {
        const value = readHex(hex);
        if (!value) return;
        this.value = value;
        this.dispatchEvent(new CustomEvent(type, {
            detail: { hex: value },
            bubbles: true,
            composed: true,
        }));
    }

    render() {
        return html`
            <div id="slot" class="slot" role="group" aria-label=${this.label || 'Colour'}>
                <div id="picker" class="picker"></div>
            </div>`;
    }
}

customElements.define('ui-colour-wheel', UiColourWheel);
