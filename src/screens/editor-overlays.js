/**
 * editor-overlays.js — <editor-overlays>, the profile editor's one overlay region: the
 * #53 numpad and the two #18 dialog instances, plus the wiring that decides which of
 * them a given editing gesture opens.
 * SCOPE Part 5 §5 "Rests on: … the numpad-heavy editing flows"; wave 5.5, rows
 * `numpad-flows` (B2/B3, O9, O10) and `editor-dialogs` (O6, O8).
 *
 * ===========================================================================
 * THIS FILE IS WIRING. IT CONSTRUCTS NOTHING.
 * ===========================================================================
 * #53 `<ui-numeric-keypad>` shipped in wave 4 and is proven inside #18 by
 * `test/render/dialog-body-integration.render.test.mjs`; the two editor dialogs are
 * `editor-exit-dialog.js` and `editor-lever-dialog.js`, which are themselves #18
 * instances. What did not exist is the ANSWER TO "which overlay does this gesture open,
 * and with which bounds", and that is the whole of this element.
 *
 *     step-matrix   `step-edit`   a value cell was pressed   -> numpad, the carried range
 *     #41 band      `exit-edit`   slot 'condition'           -> the exit condition dialog
 *     #41 band      `exit-edit`   slot 'volume' | 'weight'   -> numpad, through the door
 *     a settings field row        `edit` + data-editor-field -> numpad, through the door
 *     the lever feel              openLever(...)             -> the lever dialog
 *
 * ===========================================================================
 * THE EVENT SOURCE IS INJECTED, NEVER GUESSED
 * ===========================================================================
 * `source` is the element whose editing events open these overlays — normally the
 * `<editor-screen>` this sits in, since the matrix and the field rows are its light-DOM
 * children and their events are `bubbles: true, composed: true`. It is a PROPERTY: an
 * element that walked up to `parentElement` and started listening would be reaching
 * outside its own tree for a relationship nobody declared, and two of them in one page
 * would each answer the same press.
 *
 * Every route is also available imperatively (`openNumpad`, `openExitCondition`,
 * `openLever`), which is what a composition root uses for a gesture that has no
 * component to emit it — the lever feel is exactly that case today. See the deferred
 * question: `profile-modes.js` routes a review sentence's `lev` segment "to the modal",
 * and the review panel renders segments as inert spans in this wave.
 *
 * THE LISTENERS BELONG TO THE CONNECTION, NOT TO THE PROPERTY. `updated()` attaches on a
 * CHANGE to `source` and `disconnectedCallback` detaches unconditionally, so a re-parent
 * with `source` unchanged used to leave this region routing nothing at all — no keypad,
 * no dialog, no refusal, and no error. `connectedCallback` re-attaches for that reason;
 * `#attach()` is idempotent, so the ordinary mount still attaches exactly once.
 *
 * ===========================================================================
 * ONE OVERLAY AT A TIME, AND THE ARBITRATION IS IN THE ROUTES
 * ===========================================================================
 * Nothing about "one open modal" was a property of this element: the three public routes
 * each showed their own overlay, so a composition root calling `openLever` and then
 * `openExitCondition` and then `openNumpad` stacked THREE simultaneously-open native
 * dialogs. #18 survives that state correctly — the caret follows the top, Escape unwinds
 * one at a time, `inert` is held while any remains — so nothing was stranded; but a state
 * no gesture can reach through the wired routes (the page under an open #18 is inert) and
 * that the suite never enters is a state this region should not permit either.
 *
 * So every open route CLOSES WHATEVER ELSE THIS REGION HAS OPEN FIRST. Close-then-open
 * rather than refuse-while-busy: a route that opens is a route that opens, and a refusal
 * would make an imperative call silently do nothing — the failure mode this file already
 * reports rather than swallows everywhere else (A7). A cancelled dialog writes nothing
 * (`editor-exit-dialog.js`: "Cancel emits nothing and writes nothing"), and the keypad
 * reports its own `cancel` on the way out, which is how `#context` is cleared.
 *
 * The duck is #18's own (`ui-dialog.js`'s `isOpenOverlay`): an open overlay is an element
 * that is `open` and can be told to `hide()`. All three of these are that shape already,
 * so there is no second registry here and nothing to leak on an unmount.
 *
 * WHAT THIS IS NOT: wave 5.2's notice-vs-modal policy pin. That is about a NOTICE keeping
 * none of its ground under a dialog, it is Ben's morning question, and nothing here
 * touches it. This arbitration is between the three overlays of this one region.
 *
 * ===========================================================================
 * B2 — THE NUMPAD'S BOUNDS ARE THE STEPPER'S BOUNDS, AND THERE IS ONE TABLE
 * ===========================================================================
 * #53's own header: "the R2 table is a PROPERTY — the ONLY route to a bound", and
 * without it the body renders its unavailable panel. This file arms it two ways and
 * NEITHER of them states a number:
 *
 *   - a `step-edit` CARRIES the range the matrix already resolved through the door
 *     (`step-matrix.js` #onCellEdit: "whoever opens the numpad takes its limits as DATA
 *     and this matrix already resolved them through the one door"). That entry is passed
 *     straight through, so the cell and the keypad cannot disagree — they are the same
 *     object;
 *   - every other route names a DOOR FIELD and asks `editor-ranges.js` for it, through
 *     `numpadLimitsFor`, which the door declares as "the only place the editor builds
 *     that object".
 *
 * #53 reads `limits[limitKey]`, so a one-row table is what it is handed: the row is the
 * table entry, under the key the caller is editing. A hint typed here — even "0–10" in a
 * heading — would be the second ranges table B2 forbids, and the steam floor 135 /
 * ceiling 165 (Bengle) / 160 (DE1) is nowhere in this file for the same reason.
 *
 * A FIELD THE DOOR REFUSES DOES NOT OPEN A NUMPAD. `openNumpad` returns false and the
 * refusal is reported on the `numpad-refused` event: a keypad with no bounds is #53's
 * unavailable panel, and opening one on purpose is worse than not opening it (A7).
 *
 * ===========================================================================
 * O9 AND O10 ARE #53's, AND THEY ARE DEAD THERE
 * ===========================================================================
 * O9 (the backspace key had no accessible name) and O10 (the numpad title wrote an
 * inline 28px, the one piece of type in the skin whose size was not a token) are
 * properties of the component this file mounts, not of the wiring. Both are asserted on
 * the ARMED keypad in this wave's suite — armed, because an unarmed #53 renders the
 * unavailable panel with one tab stop and measuring that would prove nothing about the
 * pad (the wave-5.2 carry-forward).
 *
 * ===========================================================================
 * THE 5.2 NOTICE-VS-MODAL PIN IS LIVE HERE AND IS NOT RE-DECIDED
 * ===========================================================================
 * This element opens dialogs, and wave 5.2 pinned the arrangement that a notice already
 * on screen keeps 0.000 of its ground once a dialog opens over it. That pin is Ben's
 * morning question; nothing here changes the behaviour, and nothing here asserts it
 * either way.
 *
 * D2: every heading is a value — the row's own label from the port's table, the exit
 * slot's own subject from the band's serialisation seam, or the field row's own label.
 * No wording is invented at the point of opening.
 */

import { css, html } from 'lit';

import { UiElement } from 'src/components/base.js';
import { STEP_MATRIX_ROWS } from 'src/lib/step-matrix-rows.js';
import { exitBand } from 'src/lib/exit-sentence.js';
import { I18nController } from 'src/lib/i18n.js';

/* THE OVERLAYS — #53 from wave 4, and the two #18 instances. */
import 'src/components/ui-numeric-keypad.js';
import 'src/screens/editor-exit-dialog.js';
import 'src/screens/editor-lever-dialog.js';

/** The event a committed numpad entry leaves as. The screen writes the draft. */
export const VALUE_COMMIT = 'value-commit';

/** The event a refused open leaves as — a door's reason, reported and never papered over. */
export const NUMPAD_REFUSED = 'numpad-refused';

/**
 * The attribute a settings field row names its DOOR FIELD with. A field row is a
 * COMPOSITION and not a component (Part 10 §9), so the contract between it and this
 * element has to be data on the element: one attribute, holding an id from
 * `EDITOR_RANGE_FIELD_IDS`, and no bound anywhere near the markup.
 */
export const FIELD_ATTRIBUTE = 'data-editor-field';

/**
 * EACH SCALAR EXIT SLOT OWNS **TWO** KEYS, AND THEY ARE NOT THE SAME KEY.
 *
 * `stepKey`  the key IN THE PROFILE STEP that the confirmed number is written to. It is
 *            what `exit-sentence.js SCALAR_SLOTS` reads to compose the sentence
 *            (`step.volume`, `step.weight`), what `changeCountOf` counts, and what
 *            travels to ReaPrime on a save.
 * `limitKey` the id of the ROW IN THE RANGES DOOR (`editor-ranges.js
 *            EDITOR_RANGE_FIELDS`) that the keypad is armed from. `exitVolume` and
 *            `exitWeight` are door field ids; no profile step has ever carried them.
 *
 * THIS TABLE USED TO BE `{volume: 'exitVolume', weight: 'exitWeight'}` — one string doing
 * both jobs — and that is audit F-020, an S1 because it is silent. `openNumpad` put that
 * one string on the commit context as `field`, `editor-draft.js applyStepValue` applied it
 * verbatim as `{...step, [field]: value}`, and so a person who set a 60 mL exit got
 * `step.exitVolume = 60`: the band still read "+ Volume" with all three add slots empty,
 * the header's change count never moved, and the profile that saved carried a key ReaPrime
 * has never sent. The transition sweep found the same table under the EDIT path
 * (`#routeExitEdit`), where the device answered **200 OK with the compoundHash unchanged**
 * — a silently discarded edit and a successful save being one event on every surface — and
 * under remove-then-re-add, where `applyExitRemove` correctly wrote `volume: 0` and the
 * re-add then rode the wrong key, so one body carried `volume: 0` AND `exitVolume: 48` and
 * the profile ended with no volume stop at all.
 *
 * `stepKey` HAS ONE OTHER AUTHORITY and this table must agree with it:
 * `exit-sentence.js`'s band records carry `field` (from `SCALAR_SLOTS`), which is the same
 * answer, and `editor-draft.js applyExitRemove` reads it from there. The agreement is
 * pinned by a live gesture rather than by a second import —
 * `test/render/editor-exit-key.render.test.mjs` asserts the committed `field` equals the
 * band record's own `field` for the slot that was pressed.
 *
 * `condition` is absent on purpose: it is a three-part sentence and opens the dialog.
 */
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
         * THE ONE RANGES DOOR (B2), injected — `createEditorRanges({machineLimits})`.
         * Forwarded to both dialogs, so there is one door on the screen and not three.
         */
        ranges: { attribute: false },

        /**
         * The element whose editing events open these overlays. Injected; see the
         * header. Setting it moves the listeners, and setting it to null removes them.
         */
        source: { attribute: false },

        /** B9 hint, forwarded to the exit dialog: may Power be offered as an exit? */
        powerExitOffered: { type: Boolean, attribute: 'power-exit-offered' },

        /**
         * THE DRAFT'S STEPS, READ AND NEVER WRITTEN. The dialogs edit A STEP, and the
         * band's `exit-edit` carries an INDEX rather than an object (`#emit` puts
         * `index` on every event it sends), so the object has to come from the draft the
         * screen already holds. Nothing here writes to it; every outcome leaves as an
         * event and the screen owns the draft.
         */
        steps: { attribute: false },
    };

    static styles = [css`
        /* NO BACKTICK IN THIS TEMPLATE, comment or not: one ends the tagged template
         * where it stands and the file stops parsing as JavaScript some way further on.
         *
         * THIS ELEMENT IS NOT A BOX. Each overlay is a display:contents host over a
         * CLOSED native dialog, so an overlay region contributes no grid item, no flex
         * item and no track — the same construction, and the same reason, as the
         * selector screen's "the overlays live here" region. A region that took a track
         * would be a band, and an overlay is not a band (P1). */
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

    /**
     * THE LISTENERS COME BACK WITH THE ELEMENT.
     *
     * `updated()` attaches only when `source` CHANGES, and the disconnect below detaches
     * unconditionally, so a re-parent (`el.remove()` then `parent.appendChild(el)`) with
     * `source` unchanged left every editing gesture unrouted — `source` still truthy, a
     * value cell press opening nothing, and no error anywhere to find it by.
     *
     * `#attach()` returns immediately when it is already listening to this source, so a
     * mount whose `source` arrives as a property still attaches exactly once.
     */
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

    /* ---------------------------------------------------------------------
     * The source
     * ------------------------------------------------------------------- */

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

    /* ---------------------------------------------------------------------
     * The routes
     * ------------------------------------------------------------------- */

    /**
     * A matrix value cell. The RANGE TRAVELS ON THE EVENT — the matrix resolved it
     * through the one door before it emitted — so the keypad is armed with the same
     * entry the stepper beside it is bounded by, not with a second lookup that could
     * differ.
     */
    #routeStepEdit(event) {
        const { index, row, field, value, range } = event.detail ?? {};
        /* THE PRESSED CONTROL IS THE INVOKER, so #18 restores the caret to the cell that
         * was touched rather than to whatever happened to be focused. The shell captures
         * it at OPEN time — "by the time anything closes, the caret is inside the dialog
         * and the element that opened it is unknowable" (ui-dialog.js:699-702). */
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

    /**
     * An exit slot. The CONDITION slot is a three-part sentence — type, direction,
     * threshold — so it opens the dialog; the two accumulators are one number each and
     * open the keypad, through the door's own `exitVolume` / `exitWeight` fields.
     */
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
            /* THE STEP'S OWN KEY, not the door's — F-020. See EXIT_SLOT_FIELD. */
            field: route.stepKey,
            limitKey: route.limitKey,
            value: record?.value,
            index,
            row: slot,
            heading: record?.subject ?? '',
            invoker: pressedIn(event),
        });
    }

    /**
     * `exit-add` — AN EMPTY SLOT WAS FILLED IN, AND IT OPENS THE SAME TWO DOORS AS
     * `exit-edit`. Adding a condition IS editing the one that is not there yet, so a
     * second route would be a second owner of one gesture: the condition slot opens the
     * dialog, a scalar slot opens the pad, and only the starting point differs.
     *
     * THIS LISTENER DID NOT EXIST UNTIL 29 AUGUST 2026, and that is the whole of the bug.
     * Ben: "I tried to press the + Condition button to a step that doesn't have an exit
     * condition and it didn't add one or start the condition modal." The band dispatched
     * `exit-add` correctly, composed and bubbling, carrying {index, slot, type};
     * `step-matrix.js` said in its own header that the event "crosses this boundary
     * untouched"; and the string `exit-add` appeared nowhere else in `src/` except that
     * comment. It is the same shape as the `step-action` bug of 27 August, for the same
     * reason: the band's suite drives the band alone, where an unheard event is the
     * correct outcome.
     *
     * NOTHING IS WRITTEN HERE. The overlay's own confirm carries the write — the dialog's
     * `exit-condition-change`, the pad's `value-commit` — so an add the user cancels
     * leaves the step exactly as it was, which is what a cancel has to mean.
     */
    #routeExitAdd(event) {
        const detail = event.detail ?? {};
        const slot = detail.slot;
        const index = Number.isInteger(detail.index) ? detail.index : 0;

        if (slot === 'condition') {
            /* THE MENU'S PICK REACHES THE DIALOG AS THE STEP'S LOADED TYPE. The dialog
             * seeds from `step.exit.type` and INVENTS the value when there is none
             * (`editor-exit-dialog.js #seed`), so a bare `{type}` is the whole seed and
             * no floor is authored twice. The object is the dialog's to READ — the step
             * in the draft is untouched until the confirm comes back. */
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
            /* THE STEP'S OWN KEY, not the door's — F-020. See EXIT_SLOT_FIELD. */
            field: route.stepKey,
            limitKey: route.limitKey,
            index,
            row: slot,
            heading: record?.subject ?? '',
            invoker: pressedIn(event),
        });
    }

    /**
     * A settings field row. `edit` is #4's own event and it is only routed when the
     * pressed control NAMES A DOOR FIELD — an unnamed `edit` is somebody else's, and
     * guessing a field from a label is how a screen ends up editing the wrong number.
     */
    #routeFieldEdit(event) {
        /* THE COMPOSED PATH, NOT `closest()`. The press lands on a button inside #4's
         * own shadow root, and `closest()` stops at the root it starts in — so the
         * element carrying the attribute (the stepper itself, in the panel's light DOM)
         * would never be found. The path is the only walk that crosses the boundary. */
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

    /* ---------------------------------------------------------------------
     * The public routes
     *
     * ONE OPEN OVERLAY, DECIDED HERE — see the header. Each route closes the other two
     * before it shows its own, and does so only once it is certain it will open.
     * ------------------------------------------------------------------- */

    /** The three overlays this region owns, in render order. Any may be missing. */
    #overlays() {
        return [this.numpad, this.exitDialog, this.leverDialog].filter(Boolean);
    }

    /**
     * Close whatever else this region has open, so that opening `keep` leaves exactly one
     * overlay open rather than a stack of them.
     *
     * `hide()` and not `requestClose()`: this is the region closing its own overlay
     * because it has decided to open another, which is precisely the case #18 says goes
     * straight to `hide()` ("an app closing its own dialog has already decided"). The
     * reason is #18's own word for a close it did not ask for, and the keypad turns it
     * into the `cancel` this element listens for.
     */
    #closeOthers(keep) {
        for (const overlay of this.#overlays()) {
            if (overlay === keep) continue;
            if (overlay.open === true && typeof overlay.hide === 'function') overlay.hide('dismiss');
        }
    }

    /**
     * Arm and open #53.
     *
     * Exactly one of `range` (an entry that already came through the door) or a resolvable
     * key is required. Returns whether it opened; a refused key reports on `numpad-refused`
     * and opens nothing.
     *
     * `field` IS THE DRAFT'S KEY AND `limitKey` IS THE DOOR'S, and until F-020 this method
     * conflated them: it resolved the range from `field` and then put that same `field` on
     * the commit context, so a caller could not name a door row and a step key separately
     * even when they differ. `#routeStepEdit` never hit it because the matrix resolves its
     * own range first and passes it in; the two exit routes did, and wrote `exitVolume`
     * into a profile step. The lookup now uses the resolved `key` — `limitKey || field ||
     * row` — which is the door row the pad is armed from, and leaves `field` to mean one
     * thing only: where the confirmed number is written. Every caller that names just
     * `field` (a settings field row, the public API) is unaffected, because for them the
     * two are the same string.
     */
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

        /* NOT BEFORE THE REFUSAL. A field the door refuses opens nothing, and a refusal
         * that had already closed an open dialog would cost the barista an edit in
         * progress to report a bound this element never had. */
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

    /* ---------------------------------------------------------------------
     * Outcomes
     * ------------------------------------------------------------------- */

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
