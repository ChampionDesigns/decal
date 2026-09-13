/**
 * <editor-overlays>, the profile editor's one overlay region: the #53 numpad and the two #18 dialog instances, plus the wiring that decides which of them a given editing gesture opens.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';
import { STEP_MATRIX_ROWS } from 'src/lib/step-matrix-rows.js';
import { exitBand } from 'src/lib/exit-sentence.js';
import { exitValueMin } from 'src/lib/exit-validity.js';
import { deepActiveElement } from 'src/lib/focus-trap.js';
import { resolveRange } from 'src/screens/editor-dialog-parts.js';
import { I18nController } from 'src/lib/i18n.js';

import 'src/components/ui-numeric-keypad.js';
import 'src/screens/editor-exit-dialog.js';
import 'src/screens/editor-lever-dialog.js';

/** The event a committed numpad entry leaves as. The screen writes the draft. */
export const VALUE_COMMIT = 'value-commit';

/** The event a refused open leaves as — a door's reason, reported and never papered over. */
export const NUMPAD_REFUSED = 'numpad-refused';

export const FIELD_ATTRIBUTE = 'data-editor-field';

const EXIT_SLOT_FIELD = Object.freeze({
    volume: Object.freeze({ stepKey: 'volume', limitKey: 'exitVolume' }),
    weight: Object.freeze({ stepKey: 'weight', limitKey: 'exitWeight' }),
});

/** The matrix row's own label, for the keypad heading. The port's table, read by key. */
const ROW_LABEL = new Map(STEP_MATRIX_ROWS.map((row) => [row.key, row.label]));

/** The control a press landed on — the innermost node of the event's composed path. */
function pressedIn(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    return path[0] ?? event.target ?? null;
}

function invokerOf(event) {
    const named = event?.detail?.invoker ?? null;
    if (named && typeof named.focus === 'function') return named;
    const active = deepActiveElement();
    const body = globalThis.document?.body ?? null;
    if (active && active !== body && typeof active.focus === 'function') return active;
    return pressedIn(event);
}

export class EditorOverlays extends UiElement {
    static properties = {
        /**
         * THE ONE RANGES DOOR, injected — `createEditorRanges({machineLimits})`.
         * Forwarded to both dialogs, so there is one door on the screen and not three.
         */
        ranges: { attribute: false },

        /**
         * The element whose editing events open these overlays. Injected; see the
         * header. Setting it moves the listeners, and setting it to null removes them.
         */
        source: { attribute: false },

        /** Hint, forwarded to the exit dialog: may Power be offered as an exit? */
        powerExitOffered: { type: Boolean, attribute: 'power-exit-offered' },

        steps: { attribute: false },
    };

    static styles = [css`
        :host {
            display: contents;
        }
    `];

    #i18n = new I18nController(this);

    /** What the open keypad is editing, so the commit can be reported with its address. */
    #context = null;

    /** The element the listeners are currently attached to. */
    #listening = null;

    #onStepEdit = (event) => this.#routeStepEdit(event);

    #onExitEdit = (event) => this.#routeExitEdit(event);

    #onExitAdd = (event) => this.#routeExitAdd(event);

    #onFieldEdit = (event) => this.#routeFieldEdit(event);

    /**
     * `lever-edit` — a lever value in the review sentence was pressed. The step comes
     * from `steps`, so the dialog seeds from the draft rather than from the sentence.
     */
    #onLeverEdit = (event) => {
        const index = event.detail?.index;
        if (!Number.isInteger(index)) return;
        this.openLever({ index, invoker: invokerOf(event) });
    };

    constructor() {
        super();
        this.ranges = null;
        this.source = null;
        this.powerExitOffered = false;
        this.steps = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this.#attach();
    }

    disconnectedCallback() {
        this.#detach();
        super.disconnectedCallback?.();
    }

    /** #53, for a caller that wants to ask it what it is showing. */
    get numpad() { return this.renderRoot?.querySelector?.('#numpad') ?? null; }

    /** The exit condition dialog. */
    get exitDialog() { return this.renderRoot?.querySelector?.('#exit') ?? null; }

    /** The lever dialog. */
    get leverDialog() { return this.renderRoot?.querySelector?.('#lever') ?? null; }

    /** What the open keypad is editing: `{origin, field, index, row, limitKey}` or null. */
    get context() { return this.#context ? { ...this.#context } : null; }

    /** The step at an index, or null. Read-only, and never a step this file invented. */
    #stepAt(index) {
        const steps = Array.isArray(this.steps) ? this.steps : null;
        if (!steps || !Number.isInteger(index)) return null;
        return steps[index] ?? null;
    }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('source')) this.#attach();
    }

    render() {
        return html`
            <ui-numeric-keypad
                id="numpad"
                @confirm=${this.#onConfirm}
                @cancel=${this.#onCancel}
            ></ui-numeric-keypad>

            <editor-exit-dialog
                id="exit"
                .ranges=${this.ranges}
                ?power-exit-offered=${this.powerExitOffered}
                @edit=${this.#onExitDialogEdit}
            ></editor-exit-dialog>

            <editor-lever-dialog
                id="lever"
                .ranges=${this.ranges}
            ></editor-lever-dialog>
        `;
    }

    /**
     * The exit dialog's own threshold asked for the keypad. Only one overlay may be open,
     * so the keypad REPLACES the dialog and this remembers what to reopen: the step, and
     * the draft as it stood, so the type and the direction survive the trip.
     */
    #onExitDialogEdit = (event) => {
        event.stopPropagation();
        const dialog = this.exitDialog;
        if (!dialog) return;
        const draft = dialog.draft;
        const index = Number.isInteger(dialog.index) ? dialog.index : 0;
        const { range } = resolveRange(this.ranges, 'exitCondition', { exitType: draft?.type });
        if (!range) {
            this.#refuse('the exit condition has no range, so its keypad has no bound', {
                index, exitType: draft?.type ?? null,
            });
            return;
        }
        const floor = Math.max(
            Number.isFinite(range.min) ? range.min : 0,
            Number.isFinite(range.step)
                ? exitValueMin(draft?.condition, range.step)
                : exitValueMin(draft?.condition),
        );
        const invoker = invokerOf(event);
        this.#resume = { index, draft };
        this.openNumpad({
            origin: 'exit-dialog',
            field: 'exitCondition',
            range: Number.isFinite(floor) && floor !== range.min
                ? { ...range, min: floor }
                : range,
            value: event.detail?.value ?? draft?.value,
            index,
            row: 'condition',
            heading: 'Threshold',
            invoker,
        });
    };

    /** Where an `exit-dialog` keypad returns to, or null. */
    #resume = null;

    /** What the exit dialog returns focus to, held across a keypad trip. */
    #exitInvoker = null;

    /** Reopen the exit dialog after its keypad, with `value` folded into the draft. */
    #returnToExitDialog(value) {
        const resume = this.#resume;
        this.#resume = null;
        if (!resume) return false;
        const draft = Number.isFinite(value)
            ? { ...resume.draft, value }
            : resume.draft;
        return this.openExitCondition({ index: resume.index, draft });
    }

    #attach() {
        if (this.#listening === this.source) return;
        this.#detach();
        const source = this.source;
        if (!source || typeof source.addEventListener !== 'function') return;
        source.addEventListener('step-edit', this.#onStepEdit);
        source.addEventListener('exit-edit', this.#onExitEdit);
        source.addEventListener('exit-add', this.#onExitAdd);
        source.addEventListener('edit', this.#onFieldEdit);
        source.addEventListener('lever-edit', this.#onLeverEdit);
        this.#listening = source;
    }

    #detach() {
        const source = this.#listening;
        if (!source) return;
        source.removeEventListener('step-edit', this.#onStepEdit);
        source.removeEventListener('exit-edit', this.#onExitEdit);
        source.removeEventListener('exit-add', this.#onExitAdd);
        source.removeEventListener('edit', this.#onFieldEdit);
        source.removeEventListener('lever-edit', this.#onLeverEdit);
        this.#listening = null;
    }

    #routeStepEdit(event) {
        const { index, row, field, value, range } = event.detail ?? {};
        const invoker = invokerOf(event);
        if (!range) {
            this.#refuse('step-edit carried no range, so the matrix itself has none', { index, row, field });
            return;
        }
        this.openNumpad({
            origin: 'matrix',
            limitKey: row,
            range,
            value,
            index,
            row,
            field,
            heading: ROW_LABEL.get(row) ?? '',
            invoker,
        });
    }

    #routeExitEdit(event) {
        const detail = event.detail ?? {};
        const slot = detail.slot;
        const record = detail.serialized ?? null;
        const index = Number.isInteger(detail.index) ? detail.index : 0;

        if (slot === 'condition') {
            this.openExitCondition({ index, invoker: invokerOf(event) });
            return;
        }
        const route = EXIT_SLOT_FIELD[slot];
        if (!route) {
            this.#refuse(`no route for exit slot "${slot}"`, { slot });
            return;
        }
        this.openNumpad({
            origin: 'exit',
            field: route.stepKey,
            limitKey: route.limitKey,
            value: record?.value,
            index,
            row: slot,
            heading: record?.subject ?? '',
            invoker: invokerOf(event),
        });
    }

    #routeExitAdd(event) {
        const detail = event.detail ?? {};
        const slot = detail.slot;
        const index = Number.isInteger(detail.index) ? detail.index : 0;

        if (slot === 'condition') {
            this.openExitCondition({
                index,
                step: { ...(this.#stepAt(index) ?? {}), exit: { type: detail.type } },
                invoker: invokerOf(event),
            });
            return;
        }
        const route = EXIT_SLOT_FIELD[slot];
        if (!route) {
            this.#refuse(`no route for exit add slot "${slot}"`, { slot });
            return;
        }
        /* The heading comes from the BAND, not from a table repeated here: an add has no
         * serialized record to read a subject off, and `exit-sentence.js` already owns
         * the one name each slot answers to. */
        const record = exitBand(this.#stepAt(index), { powerExitOffered: this.powerExitOffered })
            .find((entry) => entry.slot === slot) ?? null;
        this.openNumpad({
            origin: 'exit',
            field: route.stepKey,
            limitKey: route.limitKey,
            index,
            row: slot,
            heading: record?.subject ?? '',
            invoker: invokerOf(event),
        });
    }

    #routeFieldEdit(event) {
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
        const host = path.find((node) => node?.hasAttribute?.(FIELD_ATTRIBUTE)) ?? null;
        const field = host?.getAttribute?.(FIELD_ATTRIBUTE);
        if (!field) return;
        event.stopPropagation();
        this.openNumpad({
            origin: 'field',
            field,
            limitKey: field,
            value: event.detail?.value,
            heading: host.label ?? host.getAttribute('data-editor-label') ?? '',
            invoker: invokerOf(event),
        });
    }

    /** The three overlays this region owns, in render order. Any may be missing. */
    #overlays() {
        return [this.numpad, this.exitDialog, this.leverDialog].filter(Boolean);
    }

    #closeOthers(keep) {
        for (const overlay of this.#overlays()) {
            if (overlay === keep) continue;
            if (overlay.open === true && typeof overlay.hide === 'function') overlay.hide('dismiss');
        }
    }

    openNumpad({
        origin = 'api', field = null, range = null, limitKey = null, value = null,
        index = null, row = null, heading = '', invoker = null,
    } = {}) {
        const pad = this.numpad;
        if (!pad) return false;
        const key = limitKey || field || row || 'value';

        let entry = range;
        if (!entry) {
            if (!this.ranges || typeof this.ranges.numpadLimitsFor !== 'function') {
                this.#refuse('no ranges door was injected, so no bound has an owner', { field });
                return false;
            }
            try {
                entry = this.ranges.numpadLimitsFor(key);
            } catch (error) {
                this.#refuse(error?.message ?? String(error), { field });
                return false;
            }
        }

        this.#context = { origin, field, index, row, limitKey: key };
        /* ONE ROW, UNDER THE KEY BEING EDITED. #53 reads `limits[limitKey]`, so this is
         * the shape it needs and the entry inside it is the door's, unmodified. */
        pad.limits = Object.freeze({ [key]: entry });
        pad.limitKey = key;
        pad.unit = entry.unit ?? '';
        pad.value = value === null || value === undefined ? '' : String(value);
        pad.heading = heading ? this.#i18n.t(heading) : '';

        /* OPEN FIRST, THEN CLOSE WHAT THIS REPLACES. Closing first leaves one frame with
         * neither overlay on screen, which reads as a flicker when a dialog hands over to
         * the keypad. Still not before the refusal: every refusal above returns before
         * this point, so an edit in progress survives a bound this element never had. */
        pad.show({ invoker, reason: 'press' });
        this.#closeOthers(pad);
        return true;
    }

    /** Open the exit condition dialog on one step. Any other overlay closes first. */
    openExitCondition({ index = 0, step = null, invoker = null, draft = null } = {}) {
        const dialog = this.exitDialog;
        if (!dialog) return false;
        dialog.index = index;
        dialog.step = step ?? this.#stepAt(index);
        if (draft === null) this.#exitInvoker = invoker;
        /* Open first, then close what it replaces — see openNumpad. */
        dialog.show({ invoker: this.#exitInvoker ?? invoker, reason: 'press', draft });
        this.#closeOthers(dialog);
        return true;
    }

    /** Open the lever dialog on one step. Any other overlay closes first. */
    openLever({ index = 0, step = null, invoker = null } = {}) {
        const dialog = this.leverDialog;
        if (!dialog) return false;
        dialog.index = index;
        dialog.step = step ?? this.#stepAt(index);
        /* Open first, then close what it replaces — see openNumpad. */
        dialog.show({ invoker, reason: 'press' });
        this.#closeOthers(dialog);
        return true;
    }

    /**
     * #53 confirmed. The clamped value and the address it belongs to leave together;
     * this element writes no draft, exactly as the matrix and the band do not.
     */
    #onConfirm(event) {
        const context = this.#context ?? {};
        this.#context = null;

        /* A keypad the exit dialog opened goes back to it, carrying the number. Nothing
         * is committed here: the dialog owns that draft and emits on its own confirm. */
        if (context.origin === 'exit-dialog') {
            this.#returnToExitDialog(Number(event.detail?.value));
            return;
        }

        this.dispatchEvent(new CustomEvent(VALUE_COMMIT, {
            detail: {
                ...context,
                value: event.detail?.value,
                raw: event.detail?.raw,
            },
            bubbles: true,
            composed: true,
        }));
    }

    /** #53 dismissed. A keypad the exit dialog opened reopens it, with the draft it had. */
    #onCancel() {
        const context = this.#context ?? {};
        this.#context = null;
        if (context.origin === 'exit-dialog') this.#returnToExitDialog(null);
    }

    /** A refusal is REPORTED. The door's own sentence, never a substituted band. */
    #refuse(reason, detail = {}) {
        this.dispatchEvent(new CustomEvent(NUMPAD_REFUSED, {
            detail: { ...detail, reason },
            bubbles: true,
            composed: true,
        }));
    }
}

customElements.define('editor-overlays', EditorOverlays);
