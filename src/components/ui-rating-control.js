/**
 * The shot rating: a row of presses, one of them chosen.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import 'src/components/ui-stat-tile.js';
import 'src/components/ui-slider.js';
import 'src/components/ui-button.js';
import 'src/components/ui-dialog.js';

import { I18nController } from 'src/lib/i18n.js';
import { hasReading } from 'src/data/reading.js';
import { formatToStep, NO_READING_MARK } from 'src/stores/units.js';

export const RATING_MIN = 0;
export const RATING_MAX = 100;
export const RATING_STEP = 1;

const LABEL_KEY = 'Rate this shot';
const HANDOFF_KEY = 'Full notes';

const NOTES_KEY = 'Shot notes';

/** The sheet's own cap over the big number, and its way out. */
const SHEET_OUT_OF_KEY = 'Score out of {max}';
const SHEET_DONE_KEY = 'Done';
/** The slider's accessible name. Placeholders are filled by t(), never concatenated. */
const SLIDER_NAME_KEY = 'Shot rating, {min} to {max}';
/** What a screen reader hears on an unrated shot, where a sighted user sees the dash. */
const UNRATED_KEY = 'Not rated';
/** The announced value: "73 of 100" rather than a bare percentage. */
const RATED_KEY = '{score} of {max}';

export class UiRatingControl extends UiElement {
    static properties = {
        shotId: { type: String, attribute: 'shot-id' },

        score: { type: Number },

        /**
         * Is the DYE handoff available on this machine? A capability, decided one
         * level up (A3) — never a substring match on a plugin id here.
         */
        handoff: { type: Boolean },

        open: { type: Boolean, reflect: true },

        /** Override for the cap over the score. Defaults to the translated key. */
        label: { type: String },

        /** Override for the handoff's words. Defaults to the translated key. */
        handoffLabel: { type: String, attribute: 'handoff-label' },

        /** Paint AND refusal, from the caller. The base dims the host; see the styles. */
        disabled: { type: Boolean, reflect: true },

        /** The number under the thumb before the screen has echoed it back. */
        _draft: { state: true },
    };

    static styles = [
        css`
            #rate {
                inline-size: 100%;
            }

            #rate .score {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--ui-space-1);
                inline-size: 100%;
            }

            #rate .cap {
                font-size: var(--ui-text-xs);
                white-space: nowrap;
                font-weight: var(--ui-weight-semibold);
                letter-spacing: var(--ui-tracking-cap);
                text-transform: uppercase;
                color: var(--ui-muted);
                line-height: 1.2;
                text-align: center;
            }

            #rate .num {
                font-size: var(--ui-display-xs);
                font-weight: var(--ui-weight-light);
                line-height: 1.1;
                color: var(--ui-text);
            }

            /* A SHOT NOBODY HAS RATED SHOWS THE DASH IN MUTED INK, which is the tile's own
             * rule for an absent reading and is why the dash is not a zero. */
            #rate .score.unrated .num {
                color: var(--ui-muted);
            }

            /* THE SHEET. One column: the number, then the slider under it, at the rhythm
             * the corner itself uses. */
            #sheet-body {
                display: flex;
                flex-direction: column;
                gap: var(--ui-space-4);
                min-inline-size: 0;
            }

            :host {
                /* THE COLUMN IS THE HOST — no inner box, so there is no second
                 * opinion about this zone's height (see the header). */
                display: flex;
                flex-direction: column;
                align-items: stretch;

                justify-content: space-between;

                gap: var(--ui-space-3);

                min-block-size: max-content;
            }

            .row {
                flex: 0 0 auto;
            }

            .handoff {
                margin-block-start: auto;
            }

            .score.unrated {
                --_ui-stat-ink: var(--ui-muted);
            }

            :host([disabled]) .row {
                opacity: 1;
            }
        `,
    ];

    constructor() {
        super();
        this.open = false;
        this.shotId = '';
        this.score = null;
        this.handoff = false;
        this.label = '';
        this.handoffLabel = '';
        this.disabled = false;
        this._draft = null;
        /* D2's mechanism, same spelling as #19 and #33 so the wave has one shape for
         * this and not two. */
        this.i18n = new I18nController(this);
    }

    #hostLabel = null;

    /** Is there a shot to rate at all? */
    get ratable() {
        return !this.disabled && !!this.shotId;
    }

    /** Has this shot got a score — served or drafted? */
    get rated() {
        return hasReading(this.#shown);
    }

    /** The number on screen: the draft while dragging, otherwise what was served. */
    get #shown() {
        if (hasReading(this._draft)) return this._draft;
        return hasReading(this.score) ? this.score : null;
    }

    get #scoreText() {
        const shown = this.#shown;
        return shown === null ? null : formatToStep(shown, RATING_STEP);
    }

    get #sliderName() {
        return this.i18n.t(SLIDER_NAME_KEY, { min: RATING_MIN, max: RATING_MAX });
    }

    get #valueText() {
        const shown = this.#shown;
        if (shown === null) return this.i18n.t(UNRATED_KEY);
        return this.i18n.t(RATED_KEY, { score: this.#scoreText, max: RATING_MAX });
    }

    get #thumb() {
        const shown = this.#shown;
        return shown === null ? RATING_MIN : shown;
    }

    connectedCallback() {
        super.connectedCallback();
        this.#adoptHostLabel();
    }

    willUpdate(changed) {
        super.willUpdate?.(changed);
        if (changed.has('shotId') || changed.has('score')) this._draft = null;
    }

    render() {
        const inert = !this.ratable;
        const scoreText = this.#scoreText;
        const capLabel = this.label || this.i18n.t(LABEL_KEY);

        return html`
            <!-- THE SCORE IS THE BUTTON. It carries the cap and the number it opens the
                 sheet to change, so the corner still says what it says at rest and the
                 press is where it always was. An unrated shot shows the dash the tile
                 shows, not a zero: a shot nobody has rated has no score. -->
            <ui-button
                id="rate"
                class="row rate"
                ?disabled=${inert}
                .label=${this.#hostLabel || ''}
                aria-haspopup="dialog"
                aria-expanded=${this.open ? 'true' : 'false'}
                @click=${this.#openSheet}
            >
                <span class="score ${scoreText === null ? 'unrated' : ''}">
                    <span class="cap">${capLabel}</span>
                    <span class="num">${scoreText ?? NO_READING_MARK}</span>
                </span>
            </ui-button>

            <ui-button
                id="notes"
                class="row notes"
                ?disabled=${!this.shotId}
                @click=${this.#onNotes}
            >${this.i18n.t(NOTES_KEY)}</ui-button>

            ${this.open ? html`<ui-dialog
                id="sheet"
                heading=${capLabel}
                .open=${true}
                @open-change=${this.#onSheetChange}
            >
                <div id="sheet-body" slot="body">
                    <ui-stat-tile
                        id="sheet-score"
                        class="${scoreText === null ? 'unrated' : ''}"
                        .label=${this.i18n.t(SHEET_OUT_OF_KEY, { max: RATING_MAX })}
                        .value=${scoreText}
                    ></ui-stat-tile>

                    <!-- THE SAME SLIDER, MOVED. #23's control, the same 0..100 scale from
                         the same three constants, and the same two handlers - so the value
                         a drag produces and the event it announces are unchanged by having
                         been put behind a press. -->
                    <ui-slider
                        id="slider"
                        min=${RATING_MIN}
                        max=${RATING_MAX}
                        step=${String(RATING_STEP)}
                        .value=${this.#thumb}
                        .label=${this.#sliderName}
                        .valueText=${this.#valueText}
                        ?disabled=${inert}
                        @input=${this.#onSliderInput}
                        @change=${this.#onSliderChange}
                    ></ui-slider>
                </div>
                <ui-button slot="actions" id="sheet-done" variant="primary"
                    @click=${this.#closeSheet}>${this.i18n.t(SHEET_DONE_KEY)}</ui-button>
            </ui-dialog>` : nothing}

            ${this.handoff
                ? html`<ui-button
                        id="handoff"
                        class="row handoff"
                        ?disabled=${inert}
                        @click=${this.#onHandoff}
                    >${this.handoffLabel || this.i18n.t(HANDOFF_KEY)}</ui-button>`
                : nothing}
        `;
    }

    /* ─────────────────────────────────────────────────── the sheet, and the notes */

    #openSheet = () => {
        if (!this.ratable) return;
        this.open = true;
    };

    #closeSheet = () => { this.open = false; };

    /* The dialog announces its own close — Escape, the scrim, the close control. Only a
     * CLOSE is acted on: `open-change` fires on open too. */
    #onSheetChange = (event) => {
        if (event?.detail?.open === false) this.open = false;
    };

    #onNotes = () => {
        if (!this.shotId) return;
        this.dispatchEvent(new CustomEvent('notes-open', {
            detail: { shotId: this.shotId },
            bubbles: true,
            composed: true,
        }));
    };

    updated(changed) {
        super.updated(changed);
        if (this.#adoptHostLabel()) this.requestUpdate();
    }

    /**
     * Move a screen-written `aria-label` onto the slider. Returns true only on the
     * update that actually moved one, so the extra render this asks for happens once.
     */
    #adoptHostLabel() {
        const written = this.getAttribute('aria-label');
        if (written === null) return false;
        this.#hostLabel = written;
        this.removeAttribute('aria-label');
        return true;
    }

    #onSliderInput(event) {
        if (!this.ratable) return;
        this._draft = Number(event.currentTarget.value);
    }

    /**
     * The commit. ONE per gesture, which is why there is no debounce timer here
     * (shot-rating.js:90-99 saved on `input` and therefore needed one).
     */
    #onSliderChange(event) {
        if (!this.ratable) return;
        this._draft = Number(event.currentTarget.value);
        this.#emit('rating-change', this._draft);
    }

    /**
     * The handoff. An intent with a shot id on it and nothing else — no global, no
     * plugin knowledge, no silent no-op (see the header, item 3).
     */
    #onHandoff() {
        if (!this.ratable) return;
        this.dispatchEvent(new CustomEvent('dye-handoff', {
            detail: { shotId: this.shotId },
            bubbles: true,
            composed: true,
        }));
    }

    #emit(type, score) {
        this.dispatchEvent(new CustomEvent(type, {
            detail: { score, shotId: this.shotId },
            bubbles: true,
            composed: true,
        }));
    }
}

customElements.define('ui-rating-control', UiRatingControl);
