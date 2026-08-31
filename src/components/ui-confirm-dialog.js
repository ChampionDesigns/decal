/**
 * A dialog that asks one question and offers two answers.
 */

import { css, html, nothing } from 'lit';
import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import { SHEET_HEADING_LEVELS, DEFAULT_LEVEL } from 'src/components/ui-sheet-header.js';
import 'src/components/ui-dialog.js';
import 'src/components/ui-button.js';

/**
 * The two tones, and they are the row's own words: "question + DESTRUCTIVE /
 * AFFIRMATIVE pair". Not a colour name and not a variant name — the same string is
 * true whatever `--ui-status-danger` is set to.
 */
export const CONFIRM_TONES = Object.freeze(['affirmative', 'destructive']);

/** Affirmative, because the destructive treatment must be asked for. */
export const DEFAULT_TONE = 'affirmative';

/** tone -> the #1 variant that paints it. One place, so the mapping cannot drift. */
const TONE_VARIANT = Object.freeze({
    affirmative: 'primary',
    destructive: 'danger',
});

export class UiConfirmDialog extends UiElement {
    static properties = {
        /** Reflected: the gallery declares an open confirm in static markup, and a
         *  screen styles around one. Mirrors the shell's own `open` in both
         *  directions — see #onOpenChange. */
        open: { type: Boolean, reflect: true },
        /** The question. The h2 in the body AND the dialog's accessible name. */
        question: { type: String },
        /** One line of consequence under it. Optional; most confirms have one. */
        detail: { type: String },
        /** The affirmative action's label. Defaults to t('Confirm'). */
        confirmLabel: { type: String, attribute: 'confirm-label' },
        /** The way out's label. Defaults to t('Cancel'). */
        cancelLabel: { type: String, attribute: 'cancel-label' },
        /** 'affirmative' | 'destructive'. Reflected so a screen can see the tone it
         *  asked for, and so the suite can read it back. */
        tone: { type: String, reflect: true },
        /** 1..6 for the question's heading element. */
        level: { type: Number, reflect: true },
    };

    static styles = [typeRoles, css`
        :host {
            display: contents;
            container-type: normal;
        }

        ui-dialog {
            --_ui-dialog-inline: var(--_ui-confirm-inline, 500px);
        }

        .body {
            display: grid;
            gap: var(--ui-space-4);
        }

        .detail {
            max-inline-size: var(--ui-measure);
        }
    `];

    /** Which outcome closed the dialog. Read once, in #onOpenChange, so that every
     *  dismissal reports exactly one event and a confirm never also reports a
     *  cancel. */
    #outcome = null;

    constructor() {
        super();
        this.open = false;
        this.question = '';
        this.detail = '';
        this.confirmLabel = '';
        this.cancelLabel = '';
        this.tone = DEFAULT_TONE;
        this.level = DEFAULT_LEVEL;
        /** The element focus returns to. A plain field, exactly as #18 keeps its
         *  own: it is not paint, so it is not reactive. */
        this.invoker = null;
        /** Re-renders on a language change; unsubscribes on disconnect
         *  (src/lib/i18n.js). Same wiring as #31. */
        this.i18n = new I18nController(this);
    }

    get dialog() {
        return this.renderRoot?.querySelector?.('#dialog') ?? null;
    }

    /** The affirmative action. Public so a screen can `focus()` it; the button forwards
     *  focus inward itself. */
    get confirmButton() {
        return this.renderRoot?.querySelector?.('#confirm') ?? null;
    }

    /** The way out. */
    get cancelButton() {
        return this.renderRoot?.querySelector?.('#cancel') ?? null;
    }

    /** True when the affirmative action carries the destructive treatment. */
    get destructive() {
        return this.tone === 'destructive';
    }

    get confirmText() {
        return this.confirmLabel || this.i18n.t('Confirm');
    }

    get cancelText() {
        return this.cancelLabel || this.i18n.t('Cancel');
    }

    show({ invoker = null, reason = 'api' } = {}) {
        if (invoker) this.invoker = invoker;
        const dialog = this.dialog;
        if (dialog) {
            dialog.show({ invoker: this.invoker, reason });
            return;
        }
        /* Before the first render there is no shell yet: the property opens it, and
         * #18's declarative path captures its own restore target (ui-dialog.js:866). */
        this.open = true;
    }

    /** Close. Reports `cancel` unless a confirm is in flight — see #onOpenChange. */
    hide(reason = 'api') {
        const dialog = this.dialog;
        if (dialog) dialog.hide(reason);
        else this.open = false;
    }

    /** ASK to close, cancellably. #18 owns the arbitration; this is the forward. */
    requestClose(reason = 'api') {
        return this.dialog?.requestClose(reason) ?? false;
    }

    confirm(reason = 'confirm') {
        if (!this.open) return false;
        const allowed = this.dispatchEvent(new CustomEvent('confirm', {
            detail: { reason },
            bubbles: true,
            composed: true,
            cancelable: true,
        }));
        if (!allowed) return false;
        this.#outcome = 'confirm';
        this.hide('confirm');
        return true;
    }

    /**
     * The other outcome. Closing IS the cancel — the report is emitted from the one
     * place that sees every dismissal, so Escape, the backdrop and this method
     * cannot disagree.
     */
    cancel(reason = 'cancel') {
        if (!this.open) return false;
        this.hide(reason);
        return true;
    }

    willUpdate(changed) {
        if (changed.has('tone')) {
            const next = CONFIRM_TONES.includes(this.tone) ? this.tone : DEFAULT_TONE;
            if (next !== this.tone) this.tone = next;
        }
        if (changed.has('level')) {
            const raw = Number.parseInt(this.level, 10);
            const next = SHEET_HEADING_LEVELS.includes(raw) ? raw : DEFAULT_LEVEL;
            if (next !== this.level) this.level = next;
        }
    }

    #onOpenChange = (event) => {
        const { open, reason } = event.detail ?? {};
        this.open = open === true;
        if (open) { this.#outcome = null; return; }
        const outcome = this.#outcome;
        this.#outcome = null;
        if (outcome === 'confirm') return;
        this.dispatchEvent(new CustomEvent('cancel', {
            detail: { reason: reason ?? 'api' },
            bubbles: true,
            composed: true,
        }));
    };

    #onConfirmPress = () => { this.confirm('press'); };

    #onCancelPress = () => { this.cancel('press'); };

    #renderQuestion() {
        const text = this.question ?? '';
        if (!text) return nothing;
        switch (this.level) {
            case 1: return html`<h1 id="question" class="ui-title question"
                >${text}</h1>`;
            case 3: return html`<h3 id="question" class="ui-title question"
                >${text}</h3>`;
            case 4: return html`<h4 id="question" class="ui-title question"
                >${text}</h4>`;
            case 5: return html`<h5 id="question" class="ui-title question"
                >${text}</h5>`;
            case 6: return html`<h6 id="question" class="ui-title question"
                >${text}</h6>`;
            default: return html`<h2 id="question" class="ui-title question"
                >${text}</h2>`;
        }
    }

    render() {
        return html`<ui-dialog
            id="dialog"
            .open=${this.open}
            .label=${this.question ?? ''}
            @open-change=${this.#onOpenChange}
        ><div id="body" class="body" slot="body"
            >${this.#renderQuestion()}${this.detail
                ? html`<p id="detail" class="detail ui-body"
                    >${this.detail}</p>`
                : nothing}<slot></slot></div
        ><ui-button id="cancel" slot="actions" @click=${this.#onCancelPress}
            >${this.cancelText}</ui-button
        ><ui-button
            id="confirm"
            slot="actions"
            variant=${TONE_VARIANT[this.tone] ?? TONE_VARIANT[DEFAULT_TONE]}
            @click=${this.#onConfirmPress}
            >${this.confirmText}</ui-button
        ></ui-dialog>`;
    }
}

customElements.define('ui-confirm-dialog', UiConfirmDialog);
