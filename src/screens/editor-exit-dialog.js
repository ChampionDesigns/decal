/**
 * <editor-exit-dialog>, the profile editor's EXIT CONDITION dialog: an INSTANCE of #18 <ui-dialog> holding the three things a condition is — the channel, the direction and the threshold.
 */

import { html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import {
    EXIT_VERB,
    exitConditionChoices,
    exitTypeLabel,
    loadedConditionType,
} from 'src/lib/exit-sentence.js';
import { exitValueMin, isDeadExit } from 'src/lib/exit-validity.js';
import { dialogRows, resolveRange } from 'src/screens/editor-dialog-parts.js';

/* THE PARTS — every one a library component, composed. */
import 'src/components/ui-dialog.js';
import 'src/components/ui-bank.js';
import 'src/components/ui-stepper.js';
import 'src/components/ui-button.js';

/** The event the exit dialog reports its one outcome as. */
export const EXIT_CONDITION_CHANGE = 'exit-condition-change';

export const EXIT_DIRECTIONS = Object.freeze([
    Object.freeze({ value: 'over', label: EXIT_VERB.over }),
    Object.freeze({ value: 'under', label: EXIT_VERB.under }),
]);

export class EditorExitDialog extends UiElement {
    static properties = {
        /** Open state, reflected and forwarded to #18. */
        open: { type: Boolean, reflect: true },

        /** The step whose condition slot is being edited. READ, never mutated. */
        step: { attribute: false },

        /** Which step it is, carried through to the event so a screen can write it. */
        index: { type: Number },

        /** THE ONE RANGES DOOR, injected. See the header. */
        ranges: { attribute: false },

        /** Hint: may Power be offered as a cross-variable exit? */
        powerExitOffered: { type: Boolean, attribute: 'power-exit-offered' },

        /** Heading level, forwarded to #18 (which forwards it to #16). */
        level: { type: Number },
    };

    static styles = [typeRoles, dialogRows];

    #i18n = new I18nController(this);

    /** The local draft: the three things a condition IS. Null while closed. */
    #draft = null;

    constructor() {
        super();
        this.open = false;
        this.step = null;
        this.index = 0;
        this.ranges = null;
        this.powerExitOffered = false;
        this.level = 2;
    }

    /** #18, for the forwards below. */
    get dialog() { return this.renderRoot?.querySelector?.('#dialog') ?? null; }

    /** What would be emitted if the confirm action were pressed now. Read-only. */
    get draft() { return this.#draft ? { ...this.#draft } : null; }

    /**
     * Open, seeding the draft from the step. Forwarded to #18 so the RESTORE TARGET is
     * captured there, at open time (`ui-dialog.js:699-702`).
     */
    show({ invoker = null, reason = 'api', draft = null } = {}) {
        /* RESUME, NOT RESEED, when a draft is handed back. The threshold's keypad is a
         * second overlay and the region shows one at a time, so editing the number closes
         * this dialog and reopens it. Reseeding from the step would throw away the type
         * and the direction just chosen. */
        if (draft) {
            this.#draft = { ...draft };
            this.requestUpdate();
            const back = this.dialog;
            if (back) back.show({ invoker, reason });
            else this.open = true;
            return;
        }
        this.#seed();
        this.requestUpdate();
        const dialog = this.dialog;
        if (dialog) dialog.show({ invoker, reason });
        else this.open = true;
    }

    hide(reason = 'api') {
        const dialog = this.dialog;
        if (dialog) dialog.hide(reason);
        else this.open = false;
    }

    requestClose(reason = 'api') {
        return this.dialog?.requestClose(reason) ?? false;
    }

    willUpdate(changed) {
        super.willUpdate?.(changed);
        if (changed.has('step') && this.open) this.#seed();
    }

    #floor(range, condition) {
        const base = Number.isFinite(range?.min) ? range.min : 0;
        const lift = Number.isFinite(range?.step)
            ? exitValueMin(condition, range.step)
            : exitValueMin(condition);
        return Number.isFinite(lift) ? Math.max(base, lift) : base;
    }

    #seedValue(range, condition, type) {
        const floor = this.#floor(range, condition);
        if (!isDeadExit({ type, condition, value: floor })) return floor;
        const step = Number.isFinite(range?.step) && range.step > 0 ? range.step : null;
        if (step === null) return floor;
        const lifted = floor + step;
        return Number.isFinite(range?.max) && lifted > range.max ? floor : lifted;
    }

    #seed() {
        const exit = this.step?.exit ?? null;
        const type = loadedConditionType(this.step) ?? this.#choices()[0] ?? null;
        const { range } = resolveRange(this.ranges, 'exitCondition', { exitType: type });
        const condition = exit?.condition === 'under' ? 'under' : 'over';
        const raw = Number(exit?.value);
        this.#draft = {
            type,
            condition,
            value: Number.isFinite(raw) ? raw : this.#seedValue(range, condition, type),
        };
    }

    /** The types this step may exit on — the port's rule, never a list typed here. */
    #choices() {
        return exitConditionChoices(
            this.step,
            this.powerExitOffered,
            loadedConditionType(this.step),
        );
    }

    render() {
        const t = this.#i18n.t;
        const draft = this.#draft ?? { type: null, condition: 'over', value: 0 };
        const { range, refusal } = resolveRange(this.ranges, 'exitCondition', {
            exitType: draft.type,
        });
        /* THE DIRECTION IS PART OF THE BOUND. #4 clamps to `min`, so this is what makes
         * "under 0" undialable rather than merely flagged. */
        const floor = range ? this.#floor(range, draft.condition) : null;

        return html`
            <ui-dialog
                id="dialog"
                heading=${t('Exit condition')}
                level=${this.level}
                .open=${this.open}
                @open-change=${this.#onOpenChange}
            >
                <div id="body" class="body" slot="body">
                    <div class="row" data-row="type">
                        <span class="ui-caption" id="type-label">${t('Exit on')}</span>
                        <ui-bank
                            id="type"
                            label=${t('Exit on')}
                            .items=${this.#choices().map((type) => ({
                                value: type,
                                label: t(exitTypeLabel(type)),
                            }))}
                            .value=${draft.type ?? ''}
                            @change=${this.#onType}
                        ></ui-bank>
                    </div>

                    <div class="row" data-row="direction">
                        <span class="ui-caption" id="direction-label">${t('When it')}</span>
                        <ui-bank
                            id="direction"
                            label=${t('When it')}
                            .items=${EXIT_DIRECTIONS.map((d) => ({ value: d.value, label: t(d.label) }))}
                            .value=${draft.condition}
                            @change=${this.#onDirection}
                        ></ui-bank>
                    </div>

                    <div class="row" data-row="value">
                        <span class="ui-caption">${t('Threshold')}</span>
                        <ui-stepper
                            id="value"
                            editable
                            label=${t('Threshold')}
                            title=${refusal ? t('Unavailable') : nothing}
                            data-refusal=${refusal || nothing}
                            ?disabled=${Boolean(refusal)}
                            .value=${draft.value}
                            .min=${floor}
                            .max=${range ? range.max : null}
                            .step=${range ? range.step : null}
                            unit=${range?.unit ?? nothing}
                            @change=${this.#onValue}
                        ></ui-stepper>
                    </div>
                </div>

                <ui-button id="cancel" slot="actions" @click=${this.#onCancel}
                    >${t('Cancel')}</ui-button
                >
                <ui-button id="confirm" slot="actions" variant="primary" @click=${this.#onConfirm}
                    >${t('Done')}</ui-button
                >
            </ui-dialog>
        `;
    }

    #onOpenChange(event) {
        this.open = Boolean(event?.detail?.open ?? this.dialog?.open);
    }

    #onType(event) {
        const type = event?.detail?.value;
        if (typeof type !== 'string' || !this.#draft) return;
        this.#draft = { ...this.#draft, type };
        this.requestUpdate();
    }

    #onDirection(event) {
        const condition = event?.detail?.value;
        if (condition !== 'over' && condition !== 'under') return;
        const { range } = resolveRange(this.ranges, 'exitCondition', {
            exitType: this.#draft?.type,
        });
        const floor = this.#floor(range, condition);
        const value = Number(this.#draft?.value);
        this.#draft = {
            ...this.#draft,
            condition,
            value: Number.isFinite(value) && value < floor ? floor : this.#draft?.value,
        };
        this.requestUpdate();
    }

    #onValue(event) {
        const value = event?.detail?.value;
        if (!Number.isFinite(value) || !this.#draft) return;
        this.#draft = { ...this.#draft, value };
        this.requestUpdate();
    }

    #onCancel() { this.requestClose('cancel'); }

    /** The one outcome. The screen writes it; this dialog writes nothing. */
    #onConfirm() {
        const draft = this.#draft;
        if (draft) {
            this.dispatchEvent(new CustomEvent(EXIT_CONDITION_CHANGE, {
                detail: {
                    index: this.index,
                    slot: 'condition',
                    type: draft.type,
                    condition: draft.condition,
                    value: draft.value,
                },
                bubbles: true,
                composed: true,
            }));
        }
        this.hide('confirm');
    }
}

customElements.define('editor-exit-dialog', EditorExitDialog);
