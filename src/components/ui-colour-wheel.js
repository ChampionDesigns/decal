/**
 * A hue wheel with a saturation field, reporting a colour as the caller's own format.
 */

import { html, css } from 'lit';
import iro from 'iro';

import { UiElement } from 'src/components/base.js';

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

        if (slot) {
            const box = mount.getBoundingClientRect();
            if (box.height > 0) slot.style.blockSize = `${box.height / (scale || 1)}px`;
        }

        this.#picker.on('input:start', () => { this.#dragging = true; });

        this.#picker.on('input:change', (colour) => {
            if (this.#writing || this.disabled) return;
            this.#emit('colour-input', colour.hexString);
        });

        this.#picker.on('input:end', (colour) => {
            this.#dragging = false;
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
