/**
 * <editor-lever-dialog>, the profile editor's LEVER dialog: an instance of <ui-dialog> holding the two feel legs, the three presets, and P0 shown but not editable.
 */

import { html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import { LEVER_PRESETS, inferLeverPreset } from 'src/lib/profile-modes.js';
import { dialogRows, resolveRange } from 'src/screens/editor-dialog-parts.js';

/* THE PARTS — every one a library component, composed. */
import 'src/components/ui-dialog.js';
import 'src/components/ui-bank.js';
import 'src/components/ui-stepper.js';
import 'src/components/ui-locked-value.js';
import 'src/components/ui-button.js';

/** The event the lever dialog reports its one outcome as. */
export const LEVER_CHANGE = 'lever-change';

/** The preset names, in `LEVER_PRESETS` declaration order. */
export const LEVER_PRESET_NAMES = Object.freeze(Object.keys(LEVER_PRESETS));

export const P0_READING_KEY = '{label}, {value}';

export const LEVER_PRESET_LABEL = Object.freeze({
    CLASSIC: 'Classic',
    GENTLE: 'Gentle',
    FIRM: 'Firm',
});

export class EditorLeverDialog extends UiElement {
    static properties = {
        open: { type: Boolean, reflect: true },

        /** The lever step. READ, never mutated — P0 in particular. */
        step: { attribute: false },

        index: { type: Number },

        /** THE ONE RANGES DOOR, injected. */
        ranges: { attribute: false },

        level: { type: Number },
    };

    static styles = [typeRoles, dialogRows];

    #i18n = new I18nController(this);

    /** The local draft, and it has EXACTLY TWO KEYS. That is the invariant, in code. */
    #draft = null;

    constructor() {
        super();
        this.open = false;
        this.step = null;
        this.index = 0;
        this.ranges = null;
        this.level = 2;
    }

    get dialog() { return this.renderRoot?.querySelector?.('#dialog') ?? null; }

    get draft() { return this.#draft ? { ...this.#draft } : null; }

    /** The feel the draft currently expresses — the port's own inference, not a flag. */
    get preset() {
        return inferLeverPreset({ ...(this.step ?? {}), ...(this.#draft ?? {}) });
    }

    show({ invoker = null, reason = 'api' } = {}) {
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

    /** The two feel legs, off the step. P0 is not among them and never will be. */
    #seed() {
        const step = this.step ?? {};
        const spring = Number(step.leverSpring);
        const give = Number(step.leverGive);
        this.#draft = {
            leverSpring: Number.isFinite(spring) ? spring : LEVER_PRESETS.CLASSIC.leverSpring,
            leverGive: Number.isFinite(give) ? give : LEVER_PRESETS.CLASSIC.leverGive,
        };
    }

    render() {
        const t = this.#i18n.t;
        const draft = this.#draft ?? { leverSpring: 0, leverGive: 0 };
        const spring = resolveRange(this.ranges, 'stepLeverSpring');
        const give = resolveRange(this.ranges, 'stepLeverGive');
        const p0 = Number(this.step?.pressure);
        const p0Range = resolveRange(this.ranges, 'stepTarget', { pump: 'lever' });

        const p0Unit = p0Range.range?.unit ? ` ${p0Range.range.unit}` : '';
        const p0Text = Number.isFinite(p0) ? `${p0}${p0Unit}` : '—';
        const p0Reading = Number.isFinite(p0)
            ? t(P0_READING_KEY, { label: t('Lever P0'), value: p0Text })
            : t('Lever P0');

        return html`
            <ui-dialog
                id="dialog"
                heading=${t('Lever feel')}
                level=${this.level}
                .open=${this.open}
                @open-change=${this.#onOpenChange}
            >
                <div id="body" class="body" slot="body">
                    <div class="row" data-row="preset">
                        <span class="ui-caption">${t('Feel')}</span>
                        <ui-bank
                            id="preset"
                            label=${t('Feel')}
                            .items=${LEVER_PRESET_NAMES.map((name) => ({
                                value: name,
                                label: t(LEVER_PRESET_LABEL[name]),
                            }))}
                            .value=${this.preset === 'CUSTOM' ? '' : this.preset}
                            @change=${this.#onPreset}
                        ></ui-bank>
                    </div>

                    <div class="row" data-row="spring">
                        <span class="ui-caption">${t('Spring')}</span>
                        <ui-stepper
                            id="spring"
                            label=${t('Spring')}
                            title=${spring.refusal ? t('Unavailable') : nothing}
                            data-refusal=${spring.refusal || nothing}
                            ?disabled=${Boolean(spring.refusal)}
                            .value=${draft.leverSpring}
                            .min=${spring.range ? spring.range.min : null}
                            .max=${spring.range ? spring.range.max : null}
                            .step=${spring.range ? spring.range.step : null}
                            unit=${spring.range?.unit ?? nothing}
                            @change=${this.#onSpring}
                        ></ui-stepper>
                    </div>

                    <div class="row" data-row="give">
                        <span class="ui-caption">${t('Give')}</span>
                        <ui-stepper
                            id="give"
                            label=${t('Give')}
                            title=${give.refusal ? t('Unavailable') : nothing}
                            data-refusal=${give.refusal || nothing}
                            ?disabled=${Boolean(give.refusal)}
                            .value=${draft.leverGive}
                            .min=${give.range ? give.range.min : null}
                            .max=${give.range ? give.range.max : null}
                            .step=${give.range ? give.range.step : null}
                            unit=${give.range?.unit ?? nothing}
                            @change=${this.#onGive}
                        ></ui-stepper>
                    </div>

                    <div class="row" data-row="p0">
                        <span class="ui-caption" id="p0-label">${t('Lever P0')}</span>
                        <ui-locked-value id="p0" label=${p0Reading}
                            >${p0Text}</ui-locked-value
                        >
                        <p class="note ui-caption"
                            >${t('A feel preset changes Spring and Give only. P0 stays as you set it.')}</p
                        >
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

    /**
     * A PRESET PICK. `LEVER_PRESETS[name]` is spread WHOLE and it has exactly two keys —
     * there is no third to spread, and nothing here reads or writes `pressure`.
     */
    #onPreset(event) {
        const name = event?.detail?.value;
        const preset = LEVER_PRESETS[name];
        if (!preset) return;
        this.#draft = { leverSpring: preset.leverSpring, leverGive: preset.leverGive };
        this.requestUpdate();
    }

    #onSpring(event) {
        const value = event?.detail?.value;
        if (!Number.isFinite(value) || !this.#draft) return;
        this.#draft = { ...this.#draft, leverSpring: value };
        this.requestUpdate();
    }

    #onGive(event) {
        const value = event?.detail?.value;
        if (!Number.isFinite(value) || !this.#draft) return;
        this.#draft = { ...this.#draft, leverGive: value };
        this.requestUpdate();
    }

    #onCancel() { this.requestClose('cancel'); }

    #onConfirm() {
        const draft = this.#draft;
        if (draft) {
            this.dispatchEvent(new CustomEvent(LEVER_CHANGE, {
                detail: {
                    index: this.index,
                    leverSpring: draft.leverSpring,
                    leverGive: draft.leverGive,
                },
                bubbles: true,
                composed: true,
            }));
        }
        this.hide('confirm');
    }
}

customElements.define('editor-lever-dialog', EditorLeverDialog);
