/**
 * editor-exit-dialog.js — <editor-exit-dialog>, the profile editor's EXIT CONDITION
 * dialog: an INSTANCE of #18 `<ui-dialog>` holding the three things a condition is —
 * the channel, the direction and the threshold.
 *
 * Its sibling is `editor-lever-dialog.js`; what they share is `editor-dialog-parts.js`.
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
 * ONE THING SITS ON TOP OF THE DOOR AND IT IS NOT A SECOND TABLE: `exit-validity.js`'s
 * `exitValueMin(condition, step)` (O5). The door says what the CHANNEL allows; validity
 * says that a "falls below" threshold floors at one increment rather than zero, "so the
 * dead state cannot be dialled in at all". It may only LIFT the door's own `min`, by the
 * door's own `step`, and it applies to the seed, to the stepper's floor and to a change
 * of direction — see `#floor`. Before it was imported this file cited the module in its
 * header while seeding `over 0`, which `deadExitReason` calls "fires immediately".
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

/** The two directions a threshold can be crossed from, in Slate's own words. */
export const EXIT_DIRECTIONS = Object.freeze([
    Object.freeze({ value: 'over', label: EXIT_VERB.over }),
    Object.freeze({ value: 'under', label: EXIT_VERB.under }),
]);

/* ===========================================================================
 * THE EXIT CONDITION DIALOG
 * =========================================================================== */

export class EditorExitDialog extends UiElement {
    static properties = {
        /** Open state, reflected and forwarded to #18. */
        open: { type: Boolean, reflect: true },

        /** The step whose condition slot is being edited. READ, never mutated. */
        step: { attribute: false },

        /** Which step it is, carried through to the event so a screen can write it. */
        index: { type: Number },

        /** THE ONE RANGES DOOR (B2), injected. See the header. */
        ranges: { attribute: false },

        /** B9 hint: may Power be offered as a cross-variable exit? #41's own prop. */
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

    /**
     * THE FLOOR FOR THE THRESHOLD, WITH THE DIRECTION IN IT (O5).
     *
     * `exit-validity.js:35-44` owns this rule and this file only asks for it: "a falls
     * below threshold floors at one increment rather than zero, SO THE DEAD STATE CANNOT
     * BE DIALLED IN AT ALL. 'Rises past' keeps its zero — the value is reachable and the
     * flag explains the consequence." The header above cited that module while both the
     * seed and the stepper still used `range.min` for BOTH directions, which is exactly
     * the state it exists to prevent: "Flow falls below 0.0 mL/s" is a step with one
     * fewer exit than it appears to have.
     *
     * B2 IS UNTOUCHED. The door's own `min` is the floor and the increment is the door's
     * own `step`; validity may only LIFT a bound, never state one. No number is written
     * here for the same reason no number is written anywhere else in this file.
     */
    #floor(range, condition) {
        const base = Number.isFinite(range?.min) ? range.min : 0;
        const lift = Number.isFinite(range?.step)
            ? exitValueMin(condition, range.step)
            : exitValueMin(condition);
        return Number.isFinite(lift) ? Math.max(base, lift) : base;
    }

    /**
     * What a step with NO exit yet opens on. Not the raw floor: `over 0` "fires
     * immediately — already past zero" and `under 0` "never fires", so the floor itself
     * is a dead exit on a non-negative channel and SEEDING one is authoring the defect
     * on the barista's behalf. One increment off it — the door's increment — is the
     * smallest value that is not provably dead, and the barista may still dial back to
     * zero on `over`, which is the reachable-and-flagged case the module keeps.
     */
    #seedValue(range, condition, type) {
        const floor = this.#floor(range, condition);
        if (!isDeadExit({ type, condition, value: floor })) return floor;
        const step = Number.isFinite(range?.step) && range.step > 0 ? range.step : null;
        if (step === null) return floor;
        const lifted = floor + step;
        return Number.isFinite(range?.max) && lifted > range.max ? floor : lifted;
    }

    /**
     * The draft, from the step. A step with no exit seeds `over` at the door's own band,
     * lifted clear of the dead value — B2 again, and `exit-validity.js` is the module
     * that decided a falls-below threshold floors at one increment.
     */
    #seed() {
        const exit = this.step?.exit ?? null;
        const type = loadedConditionType(this.step) ?? this.#choices()[0] ?? null;
        const { range } = resolveRange(this.ranges, 'exitCondition', { exitType: type });
        const condition = exit?.condition === 'under' ? 'under' : 'over';
        const raw = Number(exit?.value);
        this.#draft = {
            type,
            condition,
            /* A LOADED VALUE IS THE PROFILE'S AND IS NEVER REWRITTEN — a step already
             * authored at a dead threshold reads back exactly as it was saved, and the
             * flag is what says so. The lift applies to the value this dialog INVENTS. */
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
         * "under 0" undialable rather than merely flagged (O5). */
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
        /* The bound moves with the type — exitPressure / exitFlow / exitPower are three
         * table entries and the door picks between them. A value outside the new band is
         * NOT rewritten here: the stepper's own caps refuse to move past a bound, and a
         * silent clamp at a mode switch is how a recipe changes without being edited. */
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
        /* THE ONE LIFT, AND IT IS THE DIRECTION'S OWN FLOOR. Switching to "falls below"
         * with the threshold at zero is how the dead state would be reached without ever
         * dialling it — the stepper's new floor alone cannot fix a value that is already
         * under it. This is NOT the silent clamp `#onType` refuses: that would move a
         * recipe number to fit a band, where this moves a value the O5 rule proves can
         * never end the step, by one increment, and only when it is below the floor. */
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
