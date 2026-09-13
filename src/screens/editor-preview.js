/**
 * <editor-preview>, the profile editor's preview chart.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';
import {
    PREVIEW_CHANNEL_KEYS,
    PREVIEW_REFUSAL,
    emptyProfilePreview,
    profilePreviewDerivation,
} from 'src/lib/profile-preview.js';
import { readoutLine, readoutTerms, readoutTime } from 'src/lib/chart-readout.js';

import 'src/components/ui-chart-card.js';

/** The refusal sentence for each reason `profile-preview.js` can report. */
const REFUSAL_TEXT = Object.freeze({
    [PREVIEW_REFUSAL.NO_PROFILE]: 'No profile to preview',
    [PREVIEW_REFUSAL.NO_STEPS]: 'This profile has no steps yet',
    [PREVIEW_REFUSAL.NO_DURATION]: 'Every step is zero seconds long, so there is no curve to draw',
});

const TERM_LABELS = Object.freeze({
    targetPressure: 'Pressure',
    targetFlow: 'Flow',
});

const AXIS_TERM = '{name} ({unit})';
const TIME_UNIT = String(readoutTime(0) ?? '').replace(/^[^A-Za-z°]*/, '');

export class EditorPreview extends UiElement {
    static properties = {
        profile: { attribute: false },

        /** The chart's accessible name — a value, not an IDREF across a root. */
        label: { type: String },

        _cursor: { state: true },
    };

    static styles = [css`
        :host {
            display: block;
            min-inline-size: 0;

            /* Pass the height on rather than pick one: the container decides how tall
               the chart is, and without this it would stop at the card's own minimum. */
            block-size: 100%;
        }

        ui-chart-card {
            display: block;
            min-inline-size: 0;
            block-size: 100%;
        }

        .foot {
            display: flex;
            align-items: baseline;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        .reading {
            display: block;
            flex: 1 1 auto;
            min-block-size: calc(var(--ui-text-note) * 1.5);
            font-size: var(--ui-text-note);
            line-height: 1.5;
            padding-inline-start: var(--ui-chart-gutter-l);
            color: var(--ui-muted);
            min-inline-size: 0;
        }

        .axis {
            flex: 0 0 auto;
            font-size: var(--ui-text-note);
            line-height: 1.5;
            color: var(--ui-muted);
            white-space: nowrap;
        }
    `];

    #i18n = new I18nController(this);

    /** The derivation for the current draft. Recomputed only when the draft moves. */
    #derivation = null;

    /** Was there a feed we could not make because there was no box? */
    #pending = false;

    /** Reports 0 -> a size, which is a hidden panel becoming the showing one. */
    #resize = null;

    constructor() {
        super();
        this.profile = null;
        this.label = 'Profile preview';
        this._cursor = null;
    }

    connectedCallback() {
        super.connectedCallback();
        if (typeof ResizeObserver !== 'undefined' && !this.#resize) {
            this.#resize = new ResizeObserver(() => this.#onBox());
            this.#resize.observe(this);
        }
    }

    disconnectedCallback() {
        this.#resize?.disconnect();
        this.#resize = null;
        super.disconnectedCallback?.();
    }

    /** The card, for a consumer that wants to ask it what it drew. Read-only. */
    get card() {
        return this.renderRoot?.querySelector?.('#card') ?? null;
    }

    get rendered() {
        if (!this.isConnected) return false;
        if (typeof this.checkVisibility === 'function') return this.checkVisibility();
        return Boolean(this.offsetParent);
    }

    /** True while a derivation is held back because there was nothing to draw into. */
    get deferred() { return this.#pending; }

    /** The derivation currently held, fed or not. The suite reads it; nothing writes it. */
    get derivation() { return this.#derivation; }

    willUpdate(changed) {
        super.willUpdate?.(changed);
        if (changed.has('profile')) this.#derive();
    }

    updated(changed) {
        super.updated?.(changed);
        this.#feed();
    }

    render() {
        const t = this.#i18n.t;
        const reason = this.#derivation?.ok ? null : this.#derivation?.reason;
        return html`
            <ui-chart-card
                id="card"
                part="card"
                label=${t(this.label)}
                scrub-label=${t('{name} scrub', { name: t(this.label) })}
                @cursor-change=${this.#onCursor}
            >
                <span slot="empty">${t(REFUSAL_TEXT[reason] ?? REFUSAL_TEXT[PREVIEW_REFUSAL.NO_PROFILE])}</span>
                <div slot="foot" part="foot" class="foot">
                    <span
                        part="reading"
                        class="reading"
                        role="status"
                        aria-live="polite"
                        >${this.#reading(t)}</span
                    >
                    <span id="axis-x" class="axis">${t(AXIS_TERM, {
                        name: t('Time'),
                        unit: TIME_UNIT,
                    })}</span>
                </div>
            </ui-chart-card>
        `;
    }

    /**
     * THE SENTENCE THE FOOT PRINTS — the planned value at the instant under the pointer,
     * and the second it is at. Empty at rest, which is what clears it on release.
     */
    #reading(t) {
        const words = {};
        for (const [key, label] of Object.entries(TERM_LABELS)) words[key] = t(label);
        return readoutLine(readoutTerms(this._cursor, PREVIEW_CHANNEL_KEYS), words);
    }

    #onCursor = (event) => {
        this._cursor = event.detail;
    };

    /**
     * The draft's curves. One producer, and it is `profile-preview.js` — this file
     * neither reads a step nor decides what a mode commands.
     */
    #derive() {
        this.#derivation = this.profile
            ? profilePreviewDerivation(this.profile)
            : emptyProfilePreview(PREVIEW_REFUSAL.NO_PROFILE);
        this.#pending = true;
    }

    #feed() {
        const card = this.card;
        if (!card || !this.#derivation) return;
        if (!this.rendered) { this.#pending = true; return; }
        this.#pending = false;
        card.channelKeys = PREVIEW_CHANNEL_KEYS;
        card.showDerivation(this.#derivation);
    }

    /** A box appeared (or changed). Feed anything held back while there was none. */
    #onBox() {
        if (this.#pending) this.#feed();
    }
}

customElements.define('editor-preview', EditorPreview);
