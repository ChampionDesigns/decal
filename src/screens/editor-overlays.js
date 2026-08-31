/**
 * <editor-overlays>, the profile editor's one overlay region: the #53 numpad and the two #18 dialog instances, plus the wiring that decides which of them a given editing gesture opens.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';
import { STEP_MATRIX_ROWS } from 'src/lib/step-matrix-rows.js';
import { exitBand } from 'src/lib/exit-sentence.js';
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
            ></editor-exit-dialog>

            <editor-lever-dialog
                id="lever"
                .ranges=${this.ranges}
            ></editor-lever-dialog>
        `;
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
        this.#listening = source;
    }

    #detach() {
        const source = this.#listening;
        if (!source) return;
        source.removeEventListener('step-edit', this.#onStepEdit);
        source.removeEventListener('exit-edit', this.#onExitEdit);
        source.removeEventListener('exit-add', this.#onExitAdd);
        source.removeEventListener('edit', this.#onFieldEdit);
        this.#listening = null;
    }

    #routeStepEdit(event) {
        const { index, row, field, value, range } = event.detail ?? {};
        const invoker = pressedIn(event);
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
            this.openExitCondition({ index, invoker: pressedIn(event) });
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
            invoker: pressedIn(event),
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
                invoker: pressedIn(event),
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
            invoker: pressedIn(event),
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
            invoker: pressedIn(event),
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

        this.#closeOthers(pad);

        this.#context = { origin, field, index, row, limitKey: key };
        /* ONE ROW, UNDER THE KEY BEING EDITED. #53 reads `limits[limitKey]`, so this is
         * the shape it needs and the entry inside it is the door's, unmodified. */
        pad.limits = Object.freeze({ [key]: entry });
        pad.limitKey = key;
        pad.unit = entry.unit ?? '';
        pad.value = value === null || value === undefined ? '' : String(value);
        pad.heading = heading ? this.#i18n.t(heading) : '';
        pad.show({ invoker, reason: 'press' });
        return true;
    }

    /** Open the exit condition dialog on one step. Any other overlay closes first. */
    openExitCondition({ index = 0, step = null, invoker = null } = {}) {
        const dialog = this.exitDialog;
        if (!dialog) return false;
        this.#closeOthers(dialog);
        dialog.index = index;
        dialog.step = step ?? this.#stepAt(index);
        dialog.show({ invoker, reason: 'press' });
        return true;
    }

    /** Open the lever dialog on one step. Any other overlay closes first. */
    openLever({ index = 0, step = null, invoker = null } = {}) {
        const dialog = this.leverDialog;
        if (!dialog) return false;
        this.#closeOthers(dialog);
        dialog.index = index;
        dialog.step = step ?? this.#stepAt(index);
        dialog.show({ invoker, reason: 'press' });
        return true;
    }

    /**
     * #53 confirmed. The clamped value and the address it belongs to leave together;
     * this element writes no draft, exactly as the matrix and the band do not.
     */
    #onConfirm(event) {
        const context = this.#context ?? {};
        this.dispatchEvent(new CustomEvent(VALUE_COMMIT, {
            detail: {
                ...context,
                value: event.detail?.value,
                raw: event.detail?.raw,
            },
            bubbles: true,
            composed: true,
        }));
        this.#context = null;
    }

    #onCancel() { this.#context = null; }

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
