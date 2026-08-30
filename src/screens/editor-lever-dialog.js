/**
 * editor-lever-dialog.js — <editor-lever-dialog>, the profile editor's LEVER dialog:
 * an INSTANCE of #18 `<ui-dialog>` holding the two feel legs, the three presets, and P0
 * shown but not editable.
 *
 * Its sibling is `editor-exit-dialog.js`; what they share is `editor-dialog-parts.js`.
 * SCOPE Part 5 §5 "Components" ("`<x-dialog>` (exit condition, lever)");
 * `LAYOUT_SPEC_DRAFT.md` §4.3 and §4.6; wave 5.5, row `editor-dialogs` (O6, O8).
 *
 * ===========================================================================
 * WHAT THIS FILE IS, AND WHAT IT IS DELIBERATELY NOT
 * ===========================================================================
 * These two bodies did not exist. A unique `customElements.define()` sweep over `src/**`
 * returns no tag matching `lever` or `exit-condition`, and neither was ever numbered by
 * the 57-item inventory — they are named only in `LAYOUT_SPEC_DRAFT.md:685` and :795-796.
 * `test/render/dialog-body-integration.render.test.mjs:35` records the absence as
 * EXPECTED and wave 5.2's brief ("this phase integrates and proves, it does not
 * construct") deferred them to the phase that owns the screen. This is that phase.
 *
 * SO NEITHER OF THESE IS A COMPONENT. They are SCREEN-LEVEL COMPOSITIONS, in
 * `src/screens/` beside `editor-body.js` and `step-matrix.js`, and every part they are
 * made of is a library component used as shipped:
 *
 *   #18 ui-dialog      the modality — inert, focus trap, focus restore, Escape, scrim
 *   #3  ui-bank        the exit type, the direction, the lever presets
 *   #4  ui-stepper     every number, armed from the ONE ranges door
 *   #43 ui-locked-value  P0 in the lever dialog: shown, never edited (see below)
 *   #1  ui-button      the two actions
 *
 * O6 IS THE WHOLE POINT: "seven hand-rolled dialogs". There is no `<dialog>`, no scrim,
 * no z-index, no focus handling and no Escape handler in this file. Each element HOSTS a
 * `<ui-dialog>` in its own shadow root and forwards `show`/`hide`/`requestClose` to it —
 * the same composition #19 `ui-confirm-dialog` and #53 `ui-numeric-keypad` use, and both
 * of these are added as rows to that suite's BODIES table rather than getting a second
 * suite of their own. A second modal mechanism would be the block.
 *
 * O8 dies by the same composition: #18 marks the page `inert`, traps focus, restores the
 * caret to the invoker synchronously on close and owns Escape through its stack. Slate's
 * notes modal was `aria-modal="true"` with none of the four.
 *
 * ===========================================================================
 * THE LEVER PRESET INVARIANT, WHICH AN EARLIER VERSION BROKE
 * ===========================================================================
 * `profile-modes.js:329-333`, verbatim: "a feel preset sets the SPRING CHARACTER ONLY —
 * Spring (`leverSpring`) plus Give (`leverGive`). It NEVER touches P0 (`step.pressure`):
 * P0 is the barista's recipe choice and changing the feel must not silently move the peak
 * pressure." `LEVER_PRESETS` sets exactly those two keys and `inferLeverPreset` matches on
 * the pair alone, so a CLASSIC-feel step authored at P0 = 8 bar still reads CLASSIC.
 *
 * This dialog therefore CANNOT express a P0 change: P0 is rendered in a #43 locked value
 * box, the draft it edits has exactly two keys, and the event it emits carries exactly
 * those two. The invariant is asserted across every preset in the suite — the emitted
 * detail has no pressure key and the locked box's reading is byte-identical before and
 * after each pick.
 *
 * NO "CUSTOM" CHIP. `LEVER_PRESETS` has three entries and `inferLeverPreset` returns
 * CUSTOM for a feel that matches none of them. A fourth chip would be a control that sets
 * nothing — P10's dead affordance — so a custom feel simply selects no chip, which is
 * #3's own stated behaviour for a value matching no item.
 *
 * ===========================================================================
 * B2 — NOT ONE BOUND IS WRITTEN HERE
 * ===========================================================================
 * Every min/max/step/unit arrives through `src/lib/editor-ranges.js`, injected as the
 * `ranges` property, and is handed straight to #4. A refused field renders the control
 * DISABLED carrying the door's own reason (A7) — never a plausible band. The four fields
 * these two dialogs edit are `exitCondition` (by exit type), `stepLeverSpring` and
 * `stepLeverGive`; the door resolves each to exactly one table entry.
 *
 * ===========================================================================
 * THE DRAFT IS THE SCREEN'S  (B10's neighbour, and #41's contract)
 * ===========================================================================
 * Both dialogs hold a LOCAL draft while open and emit ONE event on the confirm action.
 * Cancel emits nothing and writes nothing. `step` is read and never mutated; the screen
 * owns the profile draft, exactly as `ui-exit-sentence` and `step-matrix` already state.
 *
 * D2: every readable string is a value read through I18nController. The exit type faces
 * come from `exitTypeLabel` (the same table the sentence's subject reads) and the two
 * verbs from `EXIT_VERB`, so a word is never spelled twice — "two spellings of one word
 * is how the Review path drifted from the editor in the first place".
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

/**
 * THE ACCESSIBLE READING for the P0 box — a caption and the already-formatted value,
 * joined by the TABLE and not by `+` here, because a word-order change is exactly what
 * concatenation at a call site cannot survive (i18n/source/strings.json `placeholderRule`).
 * The same shape `{label}, step {n}` takes for the matrix's per-cell names.
 */
export const P0_READING_KEY = '{label}, {value}';

/**
 * The chip faces. The port's `LEVER_FEEL_WORD` is the REVIEW SENTENCE's word — lower
 * case, mid-sentence ("a classic feel") — and `profile-modes.js:140-143` states the rule
 * this follows: wording is verbatim PER SURFACE, ranges are not. A chip is its own
 * surface, so it asks the catalogue for the casing it wants; both go through `t()` and
 * neither invents a second range, a second order or a second preset.
 */
export const LEVER_PRESET_LABEL = Object.freeze({
    CLASSIC: 'Classic',
    GENTLE: 'Gentle',
    FIRM: 'Firm',
});

/* ===========================================================================
 * THE LEVER DIALOG
 * =========================================================================== */

export class EditorLeverDialog extends UiElement {
    static properties = {
        open: { type: Boolean, reflect: true },

        /** The lever step. READ, never mutated — P0 in particular. */
        step: { attribute: false },

        index: { type: Number },

        /** THE ONE RANGES DOOR (B2), injected. */
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
        /* The draft is a private field, not a reactive property: seeding it outside an
         * update cycle needs the request said out loud. Inside `willUpdate` the render
         * that follows already sees it, so the seed there asks for nothing. */
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

        /* THE READING, COMPOSED ONCE. The number is the step's and the unit is the
         * DOOR'S (B2) — neither is typed here. `p0Text` is what the box shows and
         * `p0Reading` is what a screen reader is told; they are built from the same
         * pieces so no edit can move one without the other. See the P0 row below. */
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

                    <!-- P0, SHOWN AND NOT EDITABLE HERE. #43 takes no data: the value
                         arrives through its default slot and the formatted sentence is
                         this caller's. The unit is the range's, never a word typed here,
                         and the Target row of the step matrix is where P0 is edited.

                         NO BACKTICK IN THIS COMMENT: one ends the html tagged template
                         where it stands (the same trap ui-chart-card's css block names).

                         The label IS THE WHOLE ACCESSIBLE READING, not the caption. #43
                         makes the slotted glyphs aria-hidden the moment a label is set
                         (ui-locked-value.js render(), ACCESSIBILITY note), so a label of
                         "Lever P0" — which is ALREADY on screen as #p0-label beside the
                         box — announced the caption twice and the reading not at all: the
                         one value this dialog exists to protect reached no assistive
                         technology, while the suite's textContent invariant stayed green.
                         The reading is COMPOSED ONCE above and used for both the visible
                         glyphs and the label, so the two cannot drift. With no finite P0
                         there is no reading to announce and the caption alone is the
                         honest name — the em dash is a visual placeholder and announcing
                         it would be worse than announcing nothing. -->
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
