/**
 * The blank the screen falls to when the machine sleeps, and what wakes it.
 */

import { css, html, nothing } from 'lit';

import { UiElement, visuallyHidden } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';
import {
    DISPLAY_ACTION,
    SCREENSAVER_ACTION,
    SCREENSAVER_BRIGHTNESS,
    WAKE_CONFIRM_GRACE_MS,
    deriveDisplayAction,
    deriveScreensaverAction,
    deriveSleepButtonAction,
    isMachineAsleep,
    isWakePending,
} from 'src/lib/screensaver-policy.js';
import { defaultFor } from 'src/lib/settings-defaults.js';
import { createScreensaverPlaylist } from 'src/lib/screensaver-images.js';
import { verifyScreensaverImage } from 'src/components/screensaver-image-io.js';
import {
    CLOCK_TICK_MS, DEFAULT_CLOCK_FORMAT, normaliseClockFormat, wallClock,
} from 'src/lib/wall-clock.js';

export const SCREENSAVER_EVENT = Object.freeze({
    WAKE: 'ui-screensaver-wake',
    DIM: 'ui-screensaver-dim',
});

/** The press target's name, as an i18n KEY — keys are English text (`src/lib/i18n.js`). */
const WAKE_LABEL_KEY = 'Wake the machine';
const IMAGE_PLAYLISTS = new WeakMap();

const SUPPORTS_POPOVER = typeof HTMLElement !== 'undefined'
    && typeof HTMLElement.prototype.showPopover === 'function';

const LAYER_ENTRY_EVENTS = Object.freeze(['beforetoggle', 'open-change']);

const BLANK_OWNER = [];

function claimBlank(element) {
    if (BLANK_OWNER.length > 0) return BLANK_OWNER[0] === element;
    BLANK_OWNER.push(element);
    return true;
}

function releaseBlank(element) {
    if (BLANK_OWNER[0] === element) BLANK_OWNER.length = 0;
}

/** For tests and for a screen that wants to assert on it. Never a setter. */
export function blankingOwner() {
    return BLANK_OWNER.length > 0 ? BLANK_OWNER[0] : null;
}

export class UiScreensaver extends UiElement {
    static properties = {
        machineState: { attribute: 'machine-state' },

        enabled: {
            attribute: 'enabled',
            converter: { fromAttribute: (value) => value !== null && value !== 'false' },
        },

        brightnessSupported: { type: Boolean, attribute: 'brightness-supported' },

        /** The blank is up. Reflected so a screen can style around it and a test can see it. */
        active: { type: Boolean, reflect: true },

        displayAction: { attribute: 'display-action', reflect: true },

        /** `viewport` (default) or `container` — see the header. Read by CSS and by the layer. */
        anchor: { type: String, reflect: true },

        /** The press target's accessible name. Overrides the translated default. */
        label: { type: String },

        /** One dimmed line at the foot of the blank, when a wake did not reach the
         *  machine. `app-root.js` writes it; this component asks the machine nothing. */
        wakeError: { attribute: 'wake-error', type: String },

        graceMs: { type: Number, attribute: 'grace-ms' },

        clock: { type: Boolean, reflect: true },

        image: { type: String },

        /** True while the chosen screensaver is the image slideshow. */
        imageMode: { state: true },

        language: { type: String },

        clockFormat: { type: String, attribute: 'clock-format' },

        /** Internal: the time as it is currently PAINTED. Written only when the spelling
         *  moves, so a one-second tick costs one render a minute. */
        _time: { state: true },
    };

    static styles = [
        visuallyHidden,
        css`
            :host {
                position: fixed;
                inset: 0;
                z-index: var(--ui-z-blackout);

                display: none;

                background-color: var(--ui-blackout);
            }

            :host([popover]) {
                margin: 0;
                border: 0;
                padding: 0;
                overflow: visible;
                inline-size: auto;
                block-size: auto;
                color: inherit;
                background-color: var(--ui-blackout);
            }

            :host([active]) {
                display: block;
            }

            :host([anchor="container"]) {
                position: absolute;
            }

            .blank {
                display: block;
                inline-size: 100%;
                block-size: 100%;

                margin: 0;
                border: 0;
                padding: 0;
                background-color: var(--ui-blackout);
                color: inherit;
                font: inherit;

                --_ui-focus-offset: var(--ui-focus-offset-inset);

                display: grid;
                place-items: center;
            }

            .saver-image {
                position: absolute;
                inset: 0;
                inline-size: 100%;
                block-size: 100%;
                object-fit: cover;
                pointer-events: none;
            }

            .clock {
                --_ui-clock-alpha: 0.22;
                --_ui-clock-size: clamp(3rem, 12cqi, 9rem);

                font-family: var(--ui-font-family);
                font-size: var(--_ui-clock-size);
                font-weight: var(--ui-weight-regular);
                font-variant-numeric: tabular-nums;
                letter-spacing: 0.02em;
                line-height: 1;

                color: color-mix(in oklab, var(--ui-blackout-ink) calc(var(--_ui-clock-alpha) * 100%), transparent);

                pointer-events: none;
            }

            .wake-error {
                position: absolute;
                inset-block-end: var(--ui-space-6);
                inset-inline: 0;
                text-align: center;
                font-family: var(--ui-font-family);
                font-size: var(--ui-text-md);
                color: color-mix(in oklab, var(--ui-blackout-ink) 55%, transparent);
                pointer-events: none;
            }

            @keyframes ui-screensaver-drift {
                from { transform: translateY(0); }
                to   { transform: translateY(calc(var(--_ui-clock-drift) * -1)); }
            }

            .clock {
                --_ui-clock-drift: 1.2em;
                --_ui-clock-drift-dur: 240s;

                animation: ui-screensaver-drift var(--_ui-clock-drift-dur) linear infinite alternate;
            }

            @media (prefers-reduced-motion: reduce) {
                .clock {
                    animation: none;
                    transform: translateY(0);
                }
            }
        `,
    ];

    constructor() {
        super();
        this.enabled = true;
        this.brightnessSupported = false;
        this.active = false;
        this.displayAction = DISPLAY_ACTION.NONE;
        this.anchor = 'viewport';
        this.label = '';
        this.wakeError = '';
        this.graceMs = WAKE_CONFIRM_GRACE_MS;
        this.clock = false;
        this.image = '';
        this.imageMode = false;
        this.language = '';
        this.clockFormat = DEFAULT_CLOCK_FORMAT;
        this._time = '';

        /* Per-instance so a screen can inject a clock; the port takes `now` for the same
         * reason. Never a timer this component owns beyond the one grace timeout. */
        this.now = () => Date.now();

        /* Language changes re-render the press target's name. Same controller every
         * component uses; querySelectorAll cannot cross a shadow boundary. */
        this.i18n = new I18nController(this);
    }

    #previousState;

    /** `Date.now()` when we emitted a wake; 0 = none. The port's bounded suppression. */
    #wakeRequestedAt = 0;

    #dimPending = false;

    /** The one timeout: re-derive when the grace expires, so the blank can come back. */
    #graceTimer = null;

    /** The nodes `#watchLayer()` is currently listening on; empty when the blank is down. */
    #watching = [];

    /** True while THIS element is driving its own popover, so its own events are ignored. */
    #reentering = false;

    get #viewportAnchored() {
        return this.anchor !== 'container';
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.active) return;
        if (this.#viewportAnchored && !claimBlank(this)) {
            this.#lower();
            return;
        }
        this.#syncLayer();
    }

    disconnectedCallback() {
        releaseBlank(this);
        this.#clearGrace();
        this.#stopClock();
        /* The listener roots go with the tree: a re-parent changes getRootNode(), and
         * connectedCallback's #syncLayer() re-takes them on the way back in. */
        this.#unwatchLayer();
        super.disconnectedCallback();
    }

    willUpdate(changed) {
        if (changed.has('machineState')) {
            this.displayAction = deriveDisplayAction(this.#previousState, this.machineState);
            this.#previousState = this.machineState;
            this.#dimPending = this.displayAction === DISPLAY_ACTION.DIM;
        }
        this.#applyScreensaverAction();
        if (this.active) this.#applyDisplay();
    }

    updated(changed) {
        if (changed.has('active') || changed.has('anchor')) this.#syncLayer();
        if (changed.has('active') || changed.has('clock')
            || changed.has('language') || changed.has('clockFormat')) this.#syncClock();
    }

    /**
     * The port decides; this applies. Three outcomes and none of them is a command.
     */
    #applyScreensaverAction() {
        const action = deriveScreensaverAction({
            machineState: this.machineState,
            screensaverActive: this.active,
            screensaverEnabled: this.enabled,
            wakePending: isWakePending(this.#wakeRequestedAt, this.now(), this.graceMs),
        });

        if (action === SCREENSAVER_ACTION.SHOW) this.#raise();
        else if (action === SCREENSAVER_ACTION.HIDE) this.#lower();
    }

    #raise() {
        if (this.#viewportAnchored && !claimBlank(this)) {
            return;
        }
        this.active = true;
    }

    #lower() {
        this.active = false;
        this.wakeError = '';
        releaseBlank(this);
    }

    #applyDisplay() {
        if (!this.#dimPending) return;
        if (this.brightnessSupported !== true) return;
        const showsSomething = this.clock === true
            || this.imageMode === true
            || (typeof this.image === 'string' && this.image !== '');
        if (showsSomething) return;
        this.#dimPending = false;
        this.#emit(SCREENSAVER_EVENT.DIM, { brightness: SCREENSAVER_BRIGHTNESS });
    }

    #clockTimer = null;

    #syncClock() {
        const wanted = this.active && this.clock === true;
        if (!wanted) {
            this.#stopClock();
            if (this._time !== '') this._time = '';
            return;
        }
        this.#readClock();
        if (this.#clockTimer !== null) return;
        this.#clockTimer = setInterval(() => this.#readClock(), CLOCK_TICK_MS);
    }

    #readClock() {
        const next = wallClock(new Date(this.now()), this.language, this.clockFormat);
        if (next !== this._time) this._time = next;
    }

    #stopClock() {
        if (this.#clockTimer === null) return;
        clearInterval(this.#clockTimer);
        this.#clockTimer = null;
    }

    #onPress() {
        if (!isMachineAsleep(this.machineState)) {
            this.#lower();
            return;
        }

        const decision = deriveSleepButtonAction({
            machineState: this.machineState,
            screensaverActive: this.active,
        });

        /* Set BEFORE the paint, so the re-derive that `active` triggers already sees the
         * wake in flight and answers NONE instead of raising the overlay again. */
        this.#wakeRequestedAt = this.now();
        this.#scheduleGrace();

        if (decision.hideScreensaver) this.#lower();
        this.#emit(SCREENSAVER_EVENT.WAKE, {
            state: decision.command,
            requestedAt: this.#wakeRequestedAt,
        });
    }

    #scheduleGrace() {
        this.#clearGrace();
        this.#graceTimer = setTimeout(() => {
            this.#graceTimer = null;
            this.#wakeRequestedAt = 0;
            this.requestUpdate();
        }, this.graceMs);
    }

    #clearGrace() {
        if (this.#graceTimer !== null) {
            clearTimeout(this.#graceTimer);
            this.#graceTimer = null;
        }
    }

    #emit(type, detail) {
        this.dispatchEvent(new CustomEvent(type, {
            detail: Object.freeze(detail),
            bubbles: true,
            composed: true,
        }));
    }

    #syncLayer() {
        if (!SUPPORTS_POPOVER || !this.isConnected) {
            this.#unwatchLayer();
            return;
        }

        if (!this.#viewportAnchored) {
            this.#unwatchLayer();
            if (this.hasAttribute('popover')) {
                if (this.matches(':popover-open')) this.hidePopover();
                this.removeAttribute('popover');
            }
            return;
        }

        if (this.getAttribute('popover') !== 'manual') this.setAttribute('popover', 'manual');
        this.#enterTopLayer();
        if (this.active) this.#watchLayer(); else this.#unwatchLayer();
    }

    #enterTopLayer() {
        this.#reentering = true;
        try {
            if (this.matches(':popover-open')) this.hidePopover();
            if (this.active) this.showPopover();
        } catch {
        } finally {
            this.#reentering = false;
        }
    }

    #watchLayer() {
        const roots = [document, this.getRootNode()].filter(
            (node, i, all) => node && typeof node.addEventListener === 'function' && all.indexOf(node) === i,
        );
        if (roots.length === this.#watching.length && roots.every((r, i) => r === this.#watching[i])) return;

        this.#unwatchLayer();
        for (const root of roots) {
            for (const type of LAYER_ENTRY_EVENTS) root.addEventListener(type, this.#onForeignToggle, true);
        }
        this.#watching = roots;
    }

    #unwatchLayer() {
        for (const root of this.#watching) {
            for (const type of LAYER_ENTRY_EVENTS) root.removeEventListener(type, this.#onForeignToggle, true);
        }
        this.#watching = [];
    }

    #onForeignToggle = (event) => {
        if (this.#reentering || !this.active || !this.#viewportAnchored) return;
        if (event.target === this) return;
        const opening = event.type === 'open-change'
            ? event.detail?.open === true
            : event.newState === 'open';
        if (!opening) return;
        queueMicrotask(() => {
            if (!this.isConnected || !this.active || !this.#viewportAnchored) return;
            if (!this.matches(':popover-open')) return;
            this.#enterTopLayer();
        });
    };

    #imageElement = null;

    #renderImage() {
        if (!this.image) { this.#imageElement = null; return nothing; }
        if (this.#imageElement?.getAttribute('src') === this.image) return this.#imageElement;
        /* A new source owns a new node, so an old queued error cannot reject a later slide. */
        const url = this.image;
        const picture = this.ownerDocument.createElement('img');
        picture.id = 'saver-image';
        picture.className = 'saver-image';
        picture.alt = '';
        picture.addEventListener('error', () => {
            if (this.#imageElement === picture && this.image === url) IMAGE_PLAYLISTS.get(this)?.reject(url);
        });
        picture.src = url;
        this.#imageElement = picture;
        return picture;
    }

    render() {
        return html`
            <button
                id="blank"
                class="blank"
                type="button"
                @click=${this.#onPress}
            ><span class="a11y">${this.label || this.i18n.t(WAKE_LABEL_KEY)}</span
            >${this.#renderImage()}${this.clock && this._time
                    ? html`<span id="clock" class="clock" aria-hidden="true">${this._time}</span>`
                    : nothing}</button
            >${this.wakeError
                ? html`<span id="wake-error" class="wake-error" role="status"
                    >${this.wakeError}</span>`
                : nothing}
        `;
    }
}

customElements.define('ui-screensaver', UiScreensaver);

export const SCREENSAVER_DEFAULT_IMAGE = 'src/assets/screensaver-default.jpg';

const DEFAULT_CYCLE_MINUTES = defaultFor('screensaverCycleMinutes');

function createSlideshow(host) {
    const playlist = createScreensaverPlaylist({
        paint: (url) => { host.image = url; },
        verify: (url, options) => verifyScreensaverImage(host.ownerDocument.defaultView, url, options),
        fallback: SCREENSAVER_DEFAULT_IMAGE,
        defaultMinutes: DEFAULT_CYCLE_MINUTES,
    });
    IMAGE_PLAYLISTS.set(host, playlist);

    return {
        ...playlist,
        stop() {
            playlist.stop();
            if (IMAGE_PLAYLISTS.get(host) === playlist) IMAGE_PLAYLISTS.delete(host);
        },
    };
}

export function attachScreensaver(host, { machine = null, display = null, settings = null } = {}) {
    if (!host) throw new Error('attachScreensaver: an element is required');
    const offs = [];

    if (machine) {
        offs.push(machine.subscribe((state) => {
            host.machineState = state && state.value ? state.value.state : undefined;
        }));
    }

    if (settings) {
        for (const method of ['subscribe', 'value', 'load']) {
            if (typeof settings[method] !== 'function') {
                throw new Error(
                    `attachScreensaver: the settings store must provide ${method}() — `
                    + 'the saver reads its preferences through the store\'s own '
                    + 'default-resolving reader, and a partial store would paint the Black '
                    + 'saver on a tablet whose decided type is Image.',
                );
            }
        }

        const slides = createSlideshow(host);
        offs.push(() => slides.stop());

        const decided = (key, apply) => {
            offs.push(settings.subscribe(key, () => apply(settings.value(key))));
        };

        decided('screensaverEnabled', (value) => {
            host.enabled = value !== false;
        });

        /* THE TYPE PICKS THE PAINT, and the two properties it sets are the two the
         * element already had. `black` sets neither, which is what it means. */
        decided('screensaverType', (value) => {
            host.clock = value === 'clock';
            host.imageMode = value === 'image';
            slides.setMode(value === 'image');
        });

        decided('screensaverImages', (value) => {
            void slides.setImages(Array.isArray(value) ? value : []);
        });

        decided('screensaverCycleMinutes', (value) => {
            slides.setCycle(Number.isFinite(value) && value > 0 ? value : null);
        });

        decided('language', (value) => {
            host.language = typeof value === 'string' ? value : '';
        });

        decided('clockFormat', (value) => {
            host.clockFormat = normaliseClockFormat(value);
        });

        for (const key of [
            'screensaverEnabled', 'screensaverType', 'screensaverImages',
            'screensaverCycleMinutes', 'language', 'clockFormat',
        ]) {
            Promise.resolve(settings.load(key)).catch(() => {});
        }
    }

    if (display) {
        offs.push(display.subscribe((state) => {
            /* `readFlag` answers `true`, `false`, or a `noReading`. Only `true` is a
             * capability; the strict compare is the whole check, and there is no `??`
             * turning an absence into a default. */
            const platform = state && state.value ? state.value.platformSupported : null;
            host.brightnessSupported = !!platform && platform.brightness === true;
        }));
    }

    return () => {
        for (const off of offs) off();
        offs.length = 0;
    };
}
