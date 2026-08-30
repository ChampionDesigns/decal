/**
 * <editor-screen>, the profile editor's shell.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import { shotClock } from 'src/lib/shot-summary.js';
import { VERSIONS_STATUS } from 'src/stores/profile-library-store.js';
import { createEditorRanges } from 'src/lib/editor-ranges.js';
import {
    applyEditorEdit, applyStepAction, EDITOR_EDIT, renameBody,
} from 'src/lib/editor-draft.js';
import { STEP_ACTION } from 'src/components/ui-action-key-rail.js';
import {
    commitPlan, COMMIT_GESTURE, SAVE_OPERATION, CHANGE_TELL,
} from 'src/lib/editor-commit.js';
import {
    profileFailureSentence, PROFILE_VISIBILITY, profileVisibilityOf,
} from 'src/data/rea-profile.js';
import { profileTotalTerms, TOTALS_SEPARATOR } from 'src/lib/profile-totals.js';
import { NEW_STEP_NAME_KEY, reviewStepSpec } from 'src/lib/profile-modes.js';
import {
    VERSION_KEPT, versionChangeFacts, parentRecordOf, lineageFactsOf,
} from 'src/lib/profile-lineage.js';

const VERSION_FIELD_WORDS = Object.freeze({
    title: 'the name',
    notes: 'the notes',
    author: 'the author',
    beverage_type: 'the beverage',
    version: 'the profile version',
    target_volume: 'target volume',
    target_weight: 'target weight',
    target_volume_count_start: 'volume count start',
    tank_temperature: 'tank temperature',
});
import { SAVE_STATUS, VISIBILITY_WRITE } from 'src/stores/profile-editor-store.js';
import { CAPABILITY } from 'src/stores/capabilities-store.js';
import { historyIcon, penIcon } from 'src/lib/icons.js';

import 'src/screens/editor-body.js';
import 'src/screens/editor-settings-panel.js';
import 'src/screens/editor-review-panel.js';

import 'src/screens/step-matrix.js';
import 'src/screens/editor-preview.js';
import 'src/screens/editor-overlays.js';
/* The overlays' REFUSAL, by its own name. A door that declined to open says so on this
 * event and the screen is the only thing above it with a notice surface — see
 * `#onNumpadRefused`. */
import { NUMPAD_REFUSED } from 'src/screens/editor-overlays.js';

import 'src/components/ui-page-header.js';
import 'src/components/ui-tab-bar.js';
import 'src/components/ui-icon-button.js';
import 'src/components/ui-dialog.js';
import 'src/components/ui-button.js';
import 'src/components/ui-text-field.js';
/* #7, for the Settings panel's "Count volume from" — a step INDEX, whose only legal
 * values are the steps the draft already holds. See `#settingsRows`. */
import 'src/components/ui-select.js';
/* #5, for the Settings panel's "Hidden from the library" — a RECORD property rather than
 * a profile key, written by its own request. See `#settingsRows` and `#onHiddenSwitch`. */
import 'src/components/ui-switch.js';
import 'src/components/ui-toast.js';

export const EDITOR_TABS = Object.freeze([
    Object.freeze({ value: 'steps', label: 'Steps' }),
    Object.freeze({ value: 'settings', label: 'Settings' }),
    Object.freeze({ value: 'review', label: 'Review' }),
]);

export const DEFAULT_EDITOR_TAB = 'steps';

export const EDITOR_REGIONS = Object.freeze(['steps', 'settings', 'preview', 'overlays']);

const EMPTY_REGIONS = Object.freeze(Object.fromEntries(EDITOR_REGIONS.map((r) => [r, false])));

export class EditorScreen extends UiElement {
    static properties = {
        boot: { attribute: false },

        changeCount: { type: Number, attribute: 'change-count' },

        tab: { type: String, reflect: true },

        reviewColumns: { attribute: false },

        /**
         * Internal: the profile-editor store's published state — `{load, record,
         * baseline, save, report, refusal, version, …}`. Mirrored, never re-derived.
         */
        _state: { state: true },

        _draft: { state: true },

        _callerRegions: { state: true },

        _renameRefusal: { state: true },
    };

    static styles = [typeRoles, seams, css`

        .versions {
            display: grid;
            gap: var(--ui-space-2);
            justify-items: stretch;
            min-inline-size: 0;
        }

        :host(.seam-grid) {
            grid-template-rows: var(--ui-band-h) minmax(0, 1fr);
            block-size: 100%;
        }

        /* Row 1. min-inline-size: 0 so a long heading cannot widen the screen; the
         * band's own three tracks are #31's and nothing here reaches into them. */
        ui-page-header {
            grid-row: 1;
            min-inline-size: 0;
        }

        editor-body {
            grid-row: 2;
            min-inline-size: 0;
            min-block-size: 0;
        }

        .field {
            display: block;
            min-inline-size: 0;
        }

        .field ui-text-field,
        .field ui-select {
            inline-size: 100%;
        }

        .field .switch-line {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--ui-space-3);
            min-block-size: var(--ui-hit-min);
        }

        .field .switch-line ui-switch {
            flex: none;
        }

        .field .ui-caption {
            display: block;
            margin-block-start: var(--ui-space-2);
            color: var(--ui-muted);
        }

        #steps {
            display: grid;
            grid-template-rows: minmax(0, 1fr);
            grid-template-columns: minmax(0, 1fr);
            min-inline-size: 0;
            min-block-size: 0;

            background-color: var(--ui-fascia);
        }

        #steps[hidden] {
            display: none;
        }

        #steps > slot,
        slot[name="settings"],
        slot[name="preview"],
        slot[name="overlays"] {
            display: contents;
        }

        #identity {
            display: grid;
            grid-template-rows: auto minmax(var(--ui-hit-min), 1fr) auto;
            align-content: center;
            max-block-size: var(--ui-band-h);
            gap: var(--ui-space-1);
            min-inline-size: 0;
        }

        .name-row {
            display: flex;
            align-items: center;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        #tabs {
            --_ui-item-inset: 14px;
            --_ui-bank-item-min: 143px;
        }

        #tabs::part(item) {
            font-size: 16px;
            letter-spacing: 1.76px;
            text-transform: uppercase;
        }

        #title-pencil {
            --_ui-icon-btn-box: var(--ui-hit-min);

            --_ui-icon-btn-border: 0;
        }

        #editor-title {
            min-block-size: var(--ui-hit-min);
            min-inline-size: 0;
            overflow: hidden;
            border: 0;
            padding: 0;
            background-color: transparent;
            font-family: inherit;
            text-align: start;
            text-overflow: ellipsis;
            white-space: nowrap;
            cursor: pointer;
        }

        #totals {
            max-inline-size: none;
            min-inline-size: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    `];

    #i18n = new I18nController(this);

    /** The `value -> Element` map handed to #32, built once the panels exist. */
    #panels = null;

    /** The shell's editor store, or null when this screen was mounted without a boot. */
    #store = null;

    /** The subscription to it. One in, one out — P14. */
    #unwatch = null;

    /** THE ONE RANGES DOOR (B2), built from the shell's capability answer. */
    #ranges = null;

    /**
     * THE THREE CAPABILITY HINTS THE MATRIX TAKES, read once at attach beside the
     * ranges. Fail-closed defaults, so a screen with no boot offers nothing.
     */
    #modes = Object.freeze({ pumpModes: false, hold: false, powerExit: false });

    /** The record object `_draft` was seeded from, so a re-seat is a real event. */
    #seatedFrom = null;

    /** The operation the last save took, so the answer knows which draft rule applies. */
    #pending = null;

    /** The last save status announced, so one outcome is announced exactly once. */
    #announced = SAVE_STATUS.IDLE;

    constructor() {
        super();
        this.boot = null;
        this.changeCount = 0;
        this.tab = DEFAULT_EDITOR_TAB;
        this.reviewColumns = null;
        this._state = null;
        this._draft = null;
        this._callerRegions = EMPTY_REGIONS;
        this._renameRefusal = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this.classList.add('seam-grid', 'seam-strong');

        for (const name of Object.values(EDITOR_EDIT)) this.addEventListener(name, this.#onEdit);

        this.addEventListener(STEP_ACTION, this.#onStepAction);

        this.addEventListener(NUMPAD_REFUSED, this.#onNumpadRefused);
        this.#noteCallerMounts();
        this.#attach();
    }

    disconnectedCallback() {
        for (const name of Object.values(EDITOR_EDIT)) this.removeEventListener(name, this.#onEdit);
        this.removeEventListener(STEP_ACTION, this.#onStepAction);
        this.removeEventListener(NUMPAD_REFUSED, this.#onNumpadRefused);
        this.#unwatch?.();
        this.#unwatch = null;
        this.#store = null;
        super.disconnectedCallback();
    }

    /** The shell may set `boot` before or after this element is connected; both must
     *  open the screen exactly once. Same construction as `selector-screen.js:409`. */
    willUpdate(changed) {
        if (changed.has('boot')) this.#attach();
    }

    #attach() {
        if (!this.isConnected || !this.boot?.profileEditor) return;
        if (this.#store === this.boot.profileEditor) return;
        this.#unwatch?.();
        this.#store = this.boot.profileEditor;
        const limits = this.boot.capabilities?.machineLimits?.()?.value ?? null;
        const machineClass = this.boot.capabilities?.machineClass?.() ?? null;
        this.#ranges = limits ? createEditorRanges({ machineLimits: limits, machineClass }) : null;
        this.#modes = this.#readModes();
        this.#unwatch = this.#store.subscribe((state) => this.#onStoreState(state));
        this.#onStoreState(this.#store.get());
    }

    #readModes() {
        const answer = this.boot?.capabilities?.profileModes?.() ?? null;
        if (!answer || answer.capability !== CAPABILITY.PRESENT) {
            return Object.freeze({ pumpModes: false, hold: false, powerExit: false });
        }
        const offers = answer.value?.offers ?? null;
        return Object.freeze({
            pumpModes: true,
            hold: offers?.hold === true,
            powerExit: offers?.powerExit === true,
        });
    }

    #owns(region) { return Boolean(this._draft) && this._callerRegions[region] !== true; }

    #noteCallerMounts() {
        const next = {};
        let moved = false;
        for (const region of EDITOR_REGIONS) {
            next[region] = this.querySelector(`:scope > [slot="${region}"]`) !== null;
            if (next[region] !== this._callerRegions[region]) moved = true;
        }
        if (moved) this._callerRegions = Object.freeze(next);
    }

    #onSlotChange = () => this.#noteCallerMounts();

    #reviewFromDraft() {
        if (!this._draft || !this.#ranges) return null;
        const steps = Array.isArray(this._draft.steps) ? this._draft.steps : [];
        if (steps.length === 0) return null;
        const t = this.#i18n.t;
        try {
            const machineRanges = this.#ranges.machineRangesForReview();
            const machineClass = this.#ranges.machineClass();
            const blocks = steps.map((step, index) => ({
                id: `step-${index}`,
                heading: t('Step {n}', { n: index + 1 }),
                lines: reviewStepSpec(step, { machineRanges, machineClass }),
            }));
            const half = Math.ceil(blocks.length / 2);
            return [
                { id: 'a', blocks: blocks.slice(0, half) },
                { id: 'b', blocks: blocks.slice(half) },
            ];
        } catch (error) {
            this.#log('warn', `editor: the review could not be built — ${error?.message ?? error}`);
            return null;
        }
    }

    #totalsLine() {
        const t = this.#i18n.t;
        return profileTotalTerms(this._draft)
            .map((term) => t(term.text, term.params))
            .join(TOTALS_SEPARATOR);
    }

    render() {
        const t = this.#i18n.t;
        const tabs = EDITOR_TABS.map(({ value, label }) => ({ value, label: t(label) }));
        const identity = this._draft !== null;
        const steps = this._draft && Array.isArray(this._draft.steps) ? this._draft.steps : null;

        return html`
            <ui-page-header
                id="band"
                heading=${identity ? '' : t('Profile editor')}
                commit
                change-count=${this.#count}
                @commit=${this.#onCommit}
                @cancel=${this.#onCancel}
                @change=${this.#onTabChange}
            >
                <!-- THE PROFILE'S IDENTITY (cmp-seh-3). One flex item in the lead
                     flank: the eyebrow the heading used to be, the name as a button, the
                     rename pencil beside it, and the ceilings. Absent until a profile is
                     open, because a name and four ceilings are things only a loaded
                     profile has. -->
                ${identity ? html`
                    <div id="identity" slot="lead">
                        <span id="eyebrow" class="ui-microcap">${t('Profile editor')}</span>
                        <div class="name-row">
                            <button
                                id="editor-title"
                                class="ui-title"
                                type="button"
                                @click=${this.#onRenameOpen}
                            >${this._draft.title || t('Untitled')}</button>
                            <ui-icon-button
                                id="title-pencil"
                                label=${t('Edit profile name')}
                                @click=${this.#onRenameOpen}
                                >${penIcon()}</ui-icon-button
                            >
                        </div>
                        <p id="totals" class="ui-caption ui-numeric">${this.#totalsLine()}</p>
                    </div>` : nothing}

                <!-- THE CENTRE TRACK IS THIS ELEMENT'S OWN WIDTH. No stretch: see
                     the header. The tablist is named, and #32 names its panels rather
                     than pointing at them, because an IDREF cannot cross a shadow
                     boundary. -->
                <!-- SLATE'S TABS (Ben, 25 August 2026: "I have changed my mind, make them
                     all caps same font size as slate, also make the button width match
                     slates"). ORACLE .slate-editor-tabs .slate-bank-item, measured on the
                     running skin: 142.7 x 80 each, padding 0 14px, 16px at weight 500,
                     letter-spacing 1.76px, uppercase. The three privates below carry
                     those; #3 owns the paint, so nothing here states a colour. -->
                <ui-tab-bar
                    slot="centre"
                    id="tabs"
                    .tabs=${tabs}
                    .value=${this.tab}
                    label=${t('Editor panels')}
                ></ui-tab-bar>

                <!-- PREVIOUS VERSIONS, BESIDE SAVE (Ben, 24 Aug 2026: "Can we add it to
                     the editor as well, could be useful to be able to undo a change etc.")
                     Slate has the same control in the same place (#editor-history-btn),
                     and it is shown only for a record with a lineage to have: a bundled
                     profile has none, and neither does a draft that has never been saved.
                     Restoring is NON-DESTRUCTIVE — see #onVersionPick. -->
                ${identity && this.#canBrowseVersions ? html`
                    <ui-icon-button
                        slot="trail"
                        id="versions-open"
                        size="lg"
                        label=${t('Previous versions')}
                        @click=${this.#onVersionsOpen}
                        >${historyIcon()}</ui-icon-button
                    >` : nothing}
            </ui-page-header>

            <editor-body id="body">
                <!-- THE MOUNT REGIONS' FALLBACK CONTENT (dec-A-B-1). The engine renders
                     what is inside a slot ONLY when nothing is assigned to it, so a
                     caller who mounts its own matrix, preview or overlay region gets
                     exactly what it always got and nothing below is created at all. The
                     app mounts none of the three, and this is where it gets them. -->
                <div id="steps" part="steps" slot="steps">
                    <slot name="steps" @slotchange=${this.#onSlotChange}>
                        ${this.#owns('steps') ? html`<step-matrix
                            id="matrix"
                            editable
                            density="compact"
                            label=${t('Profile steps')}
                            ?pump-modes-offered=${this.#modes.pumpModes}
                            ?hold-offered=${this.#modes.hold}
                            ?power-exit-offered=${this.#modes.powerExit}
                            .ranges=${this.#ranges}
                            .steps=${steps}
                        ></step-matrix>` : nothing}
                    </slot>
                </div>

                <editor-settings-panel id="settings-panel" slot="settings">
                    <slot name="settings" @slotchange=${this.#onSlotChange}>
                        ${this.#owns('settings') ? this.#settingsRows() : nothing}
                    </slot>
                </editor-settings-panel>

                <editor-review-panel
                    id="review-panel"
                    slot="review"
                    .columns=${this.reviewColumns ?? this.#reviewFromDraft()}
                >
                    <!-- THE PREVIEW CHART'S MOUNT REGION (row chart-preview). A slot
                         forwarding into the review panel's own "chart" slot; empty, it
                         is an auto row of zero height and every measurement of this
                         panel is what it was without it. -->
                    <slot name="preview" slot="chart" @slotchange=${this.#onSlotChange}>
                        ${this.#owns('preview') ? html`<editor-preview
                            id="preview"
                            .profile=${this._draft}
                        ></editor-preview>` : nothing}
                    </slot>
                </editor-review-panel>
            </editor-body>

            <!-- THE VERSION LIST. A dialog rather than a menu: the rows are profile
                 titles with a date beside them, and a menu row is one line of text.
                 display:contents over a closed native dialog, so it adds no row to the
                 screen's two — the same shape every other overlay here has. -->
            <ui-dialog
                id="versions"
                heading=${t('Previous versions')}
                @close-request=${this.#onVersionsClose}
            >
                <div slot="body" class="versions">${this.#versionsBody()}</div>
            </ui-dialog>

            <!-- THE OVERLAY REGION (rows editor-dialogs, numpad-flows). It is not a
                 band: <editor-overlays> is display:contents over closed dialogs, so this
                 contributes no third row to the screen's two. -->
            <slot name="overlays" @slotchange=${this.#onSlotChange}>
                ${this.#owns('overlays') ? html`<editor-overlays
                    id="overlays"
                    .ranges=${this.#ranges}
                    .steps=${steps}
                    .source=${this}
                ></editor-overlays>` : nothing}
            </slot>

            <!-- THE RENAME (cmp-seh-3), AND IT IS ONE PIPELINE, NOT A SECOND. The pencil
                 and the title open this; its confirm is the RENAME gesture and goes
                 through the same commitPlan table the band's Save uses. It is a
                 ui-dialog over a CLOSED native dialog with a display:contents host, so
                 it takes no track in this screen's two-row grid — the same construction,
                 and the same reason, as the selector's own overlays. -->
            <ui-dialog id="discard-dialog" heading=${t('Discard your changes?')}>
                <div slot="body">
                    <p>${t('{count} changes will be lost.', { count: this.#count })}</p>
                </div>
                <div slot="actions">
                    <ui-button id="discard-cancel" @click=${this.#onDiscardCancel}
                        >${t('Keep editing')}</ui-button
                    >
                    <ui-button id="discard-confirm" variant="primary" @click=${this.#onDiscardConfirm}
                        >${t('Discard')}</ui-button
                    >
                </div>
            </ui-dialog>

            <ui-dialog id="rename-dialog" heading=${t('Edit profile name')}>
                <div slot="body">
                    <ui-text-field
                        id="rename-field"
                        label=${t('Profile name')}
                        ?invalid=${Boolean(this._renameRefusal)}
                        .value=${this._draft?.title ?? ''}
                    ></ui-text-field>
                    <!-- WHY THE RENAME DID NOT HAPPEN (F-050). The house refusal idiom —
                         a ui-caption paragraph with role=status, the same shape
                         settings-screen.js uses for its two — rendered AT THE FIELD,
                         because the dialog now stays open to hold it. NO BACKTICK HERE. -->
                    ${this._renameRefusal
                        ? html`<p id="rename-refusal" class="ui-caption" role="status"
                            >${t(this._renameRefusal)}</p>`
                        : nothing}
                </div>
                <div slot="actions">
                    <ui-button id="rename-cancel" @click=${this.#onRenameCancel}
                        >${t('Cancel')}</ui-button
                    >
                    <ui-button id="rename-save" variant="primary" @click=${this.#onRenameConfirm}
                        >${t('Save')}</ui-button
                    >
                </div>
            </ui-dialog>

            <!-- WHAT THE SERVER SAID. #22 is the skin's notice surface and it is
                 position: fixed, so it contributes no grid item either. A save that
                 reported nothing would be the silence dec-A-B-1 is about. -->
            <ui-toast id="notice"></ui-toast>
        `;
    }

    updated(changed) {
        super.updated?.(changed);
        this.#wirePanels();
    }

    #wirePanels() {
        const bar = this.renderRoot?.querySelector?.('#tabs');
        if (!bar || this.#panels) return;
        const map = new Map();
        for (const { value } of EDITOR_TABS) {
            const el = this.renderRoot.querySelector(`[slot="${value}"]`);
            if (el) map.set(value, el);
        }
        if (map.size !== EDITOR_TABS.length) return;
        this.#panels = map;
        bar.panels = map;
    }

    #onTabChange(event) {
        const value = event?.detail?.value;
        if (typeof value !== 'string') return;
        this.tab = value;
    }

    #onStoreState(state) {
        this._state = state;
        const record = state && state.record ? state.record : null;
        const served = record && typeof record === 'object' ? record.profile ?? null : null;

        if (!record) {
            this._draft = null;
        } else if (this.#pending === SAVE_OPERATION.IN_PLACE && this._draft && served) {
            this._draft = { ...this._draft, title: served.title };
        } else if (record !== this.#seatedFrom) {
            this._draft = served;
        }
        this.#seatedFrom = record;

        const status = state ? state.save : SAVE_STATUS.IDLE;
        if (status !== this.#announced) {
            this.#announced = status;
            if (status !== SAVE_STATUS.SAVING && status !== SAVE_STATUS.IDLE) {
                this.#pending = null;
                this.#announce(state);

                if (status === SAVE_STATUS.SAVED && this.#closeOnSaved) {
                    this.#closeOnSaved = false;
                    this.#leave();
                } else if (status !== SAVE_STATUS.SAVED) {
                    this.#closeOnSaved = false;
                }
            }
        }
    }

    get #canBrowseVersions() {
        const record = this._state?.record ?? null;
        return Boolean(record && record.id && this.boot?.library);
    }

    #onVersionsOpen = () => {
        const record = this._state?.record ?? null;
        const library = this.boot?.library;
        if (!record?.id || !library) return;
        this.#versionsWatch?.();
        this.#versionsWatch = library.subscribe(() => this.requestUpdate());
        Promise.resolve(library.versionsOf(record.id)).catch(() => {});
        this.renderRoot?.getElementById?.('versions')?.show({ reason: 'press' });
    };

    #onVersionsClose = () => {
        this.#versionsWatch?.();
        this.#versionsWatch = null;
        this.boot?.library?.clearVersions?.();
    };

    /** The library subscription this screen holds only while the version list is open. */
    #versionsWatch = null;

    #onVersionPick = (event) => {
        const id = event.currentTarget.dataset.id;
        const versions = this.boot?.library?.get?.()?.versions;
        const record = (versions?.records ?? []).find((candidate) => candidate.id === id);
        const profile = record?.profile ?? null;
        if (!profile || !this._draft) return;
        this._draft = { ...profile, title: this._draft.title };
        this.renderRoot?.getElementById?.('versions')?.hide('restored');
        this.#onVersionsClose();
    };

    #onFieldChange(key, value) {
        if (!this._draft) return;
        this._draft = { ...this._draft, [key]: value };
    }

    /** `ui-text-field`'s composed `change`, as the key it belongs to. */
    #onTextField = (event) => {
        const key = event.currentTarget?.dataset?.profileKey;
        if (!key) return;
        event.stopPropagation();
        this.#onFieldChange(key, event.currentTarget.value ?? '');
    };

    #onCountFrom = (event) => {
        event.stopPropagation();
        const raw = Number(event.detail?.value ?? event.currentTarget?.value);
        if (!Number.isInteger(raw) || raw < 0) return;
        this.#onFieldChange('target_volume_count_start', raw);
    };

    #settingsRows() {
        const draft = this._draft;
        if (!draft) return nothing;
        const t = this.#i18n.t;
        const text = (key, label) => html`
            <div class="field">
                <ui-text-field
                    id=${`field-${key}`}
                    data-profile-key=${key}
                    label=${t(label)}
                    .value=${draft[key] ?? ''}
                    @change=${this.#onTextField}
                ></ui-text-field>
            </div>`;

        const steps = Array.isArray(draft.steps) ? draft.steps : [];
        const choices = [
            { value: '0', label: t('None') },
            ...steps.map((step, i) => ({
                value: String(i + 1),
                label: step?.name || t('Step {n}', { n: i + 1 }),
            })),
        ];
        const marker = Number.isInteger(draft.target_volume_count_start)
            ? draft.target_volume_count_start : 0;

        return html`
            ${text('title', 'Profile name')}
            ${text('author', 'Author')}
            ${text('beverage_type', 'Beverage')}
            ${text('notes', 'Notes')}

            <div class="field">
                <ui-text-field
                    id="field-tank-temperature"
                    data-profile-key="tank_temperature"
                    label=${t('Tank temperature')}
                    .value=${draft.tank_temperature ?? ''}
                    @change=${this.#onTankTemperature}
                ></ui-text-field>
                <!-- THE CAPTION IS THE DOOR'S OWN REASON, shortened to a sentence a
                     barista can act on. editor-ranges.js refuses this field a range
                     because every profile load ends in a tankTemp MMR write, so the
                     machine takes this number from the profile whatever a control set.
                     NO BACKTICK IN THIS COMMENT. -->
                <span class="ui-caption"
                    >${t('The machine takes this from the profile each time it loads.')}</span
                >
            </div>

            <div class="field">
                <ui-select
                    id="field-count-from"
                    label=${t('Count volume from')}
                    .options=${choices}
                    .value=${String(marker)}
                    @change=${this.#onCountFrom}
                ></ui-select>
                <span class="ui-caption"
                    >${t('Volume exits ignore everything poured before this step.')}</span
                >
            </div>

            ${this.#hiddenSwitchRow()}
        `;
    }

    #hiddenSwitchRow() {
        const t = this.#i18n.t;
        const face = this.#libraryFace;
        return html`
            <div class="field">
                <div class="switch-line">
                    <span id="field-hidden-label" class="ui-body"
                        >${t('Hidden from the library')}</span
                    >
                    <ui-switch
                        id="field-hidden"
                        aria-labelledby="field-hidden-label"
                        data-face=${face.state}
                        .checked=${face.checked}
                        ?disabled=${face.disabled}
                        @change=${this.#onHiddenSwitch}
                    ></ui-switch>
                </div>
                <span class="ui-caption" role="status">${face.caption}</span>
            </div>`;
    }

    get #libraryFace() {
        const t = this.#i18n.t;
        const state = this._state ?? null;
        const write = state?.visibility ?? null;
        const record = this.#record;
        const seated = Boolean(record && record.id);

        if (!seated) {
            return {
                state: 'unseated',
                checked: false,
                disabled: true,
                caption: t('Save this profile first — the library has nothing to hide yet.'),
            };
        }

        const shown = write?.value ?? profileVisibilityOf(record);
        const hidden = shown === PROFILE_VISIBILITY.HIDDEN;

        if (write?.status === VISIBILITY_WRITE.WRITING) {
            return {
                state: 'writing',
                checked: hidden,
                disabled: true,
                caption: write.wanted === PROFILE_VISIBILITY.HIDDEN
                    ? t('Hiding it…') : t('Showing it again…'),
            };
        }
        if (write?.status === VISIBILITY_WRITE.FAILED) {
            const said = write.refusal?.message || write.refusal?.error || null;
            return {
                state: 'failed',
                checked: hidden,
                disabled: false,
                caption: said
                    ? t('The library was not changed. {reason}', { reason: said })
                    : t('The library could not be changed. Try again.'),
            };
        }
        if (shown !== PROFILE_VISIBILITY.VISIBLE && shown !== PROFILE_VISIBILITY.HIDDEN) {
            return {
                state: 'unknown',
                checked: false,
                disabled: true,
                caption: shown
                    ? t('This profile is {state}, which this switch cannot change.', { state: shown })
                    : t('The library has not said whether this profile is listed.'),
            };
        }
        return {
            state: 'settled',
            checked: hidden,
            disabled: false,
            caption: hidden
                ? t('The library is not listing this profile.')
                : t('The library lists this profile.'),
        };
    }

    #onHiddenSwitch = (event) => {
        event.stopPropagation();
        const wanted = event.detail?.checked === true
            ? PROFILE_VISIBILITY.HIDDEN
            : PROFILE_VISIBILITY.VISIBLE;

        const control = event.currentTarget ?? this.renderRoot?.querySelector?.('#field-hidden');
        if (control) control.checked = this.#libraryFace.checked;

        if (!this.#store) return;
        this.#store.setVisibility(wanted);
    };

    #onTankTemperature = (event) => {
        event.stopPropagation();
        const raw = String(event.currentTarget?.value ?? '').trim();
        if (raw === '') return;
        const value = Number(raw);
        if (!Number.isFinite(value)) return;
        this.#onFieldChange('tank_temperature', value);
    };

    #versionsBody() {
        const t = this.#i18n.t;
        const state = this.boot?.library?.get?.()?.versions ?? null;
        const status = state?.status ?? VERSIONS_STATUS.IDLE;
        if (status === VERSIONS_STATUS.LOADING) {
            return html`<p
                >${t('Reading versions…')}</p
            >`;
        }
        if (status === VERSIONS_STATUS.FAILED) {
            return html`<p
                >${t('The versions could not be read.')}</p
            >`;
        }
        const here = this._state?.record?.id ?? null;
        const others = (state?.records ?? []).filter((record) => record.id !== here);
        if (status !== VERSIONS_STATUS.READY || others.length === 0) {
            return html`<p
                >${t('This profile has no other versions.')}</p
            >`;
        }
        return others.map((record) => {
            const when = shotClock(record.updatedAt ?? record.createdAt);
            const title = record.profile?.title || t('Untitled');
            const stamp = when.ok ? `${title} · ${when.dateSummary} ${when.time}` : title;
            const changed = this.#versionChangeLine(record, state?.records ?? []);

            const rowName = changed ? `${stamp} — ${changed}` : stamp;
            return html`
                <ui-button
                    data-id=${record.id}
                    @click=${this.#onVersionPick}
                    >${rowName}</ui-button
                >`;
        });
    }

    #versionChangeLine(record, records) {
        const t = this.#i18n.t;
        const parent = parentRecordOf(record, records);
        const facts = versionChangeFacts(record, parent);
        if (!facts.known) {
            return lineageFactsOf(record).hasParent ? null : t('original');
        }

        const parts = [];
        if (facts.wholesale) parts.push(t('the steps'));
        if (facts.changed.length === 1) {
            parts.push(t('step {n}', { n: facts.changed[0] + 1 }));
        } else if (facts.changed.length > 1) {
            parts.push(t('steps {list}', { list: facts.changed.map((i) => i + 1).join(', ') }));
        }
        if (facts.added.length) {
            parts.push(facts.added.length === 1
                ? t('1 step added')
                : t('{count} steps added', { count: facts.added.length }));
        }
        if (facts.removed.length) {
            parts.push(facts.removed.length === 1
                ? t('1 step removed')
                : t('{count} steps removed', { count: facts.removed.length }));
        }
        for (const key of facts.scalars) {
            parts.push(VERSION_FIELD_WORDS[key] ? t(VERSION_FIELD_WORDS[key]) : key);
        }

        if (parts.length === 0) {
            return t('no changes');
        }
        if (parts.length > 3) {
            return `${parts.slice(0, 3).join(', ')}, ${t('+{count} more', { count: parts.length - 3 })}`;
        }
        return parts.join(', ');
    }

    /** An editing event arrived. `editor-draft.js` holds every rule; this is the wire. */
    #onEdit = (event) => {
        /* NOTHING IS OPEN — a bare mounting, or a harness stage that owns its own draft.
         * The event is left alone for whoever else is listening. */
        if (!this._draft) return;
        const result = applyEditorEdit(this._draft, event.type, event.detail ?? {});
        if (result.applied) this._draft = result.draft;
        else this.#log('warn', `editor: an edit was not applied — ${result.reason}`);
    };

    #onStepAction = (event) => {
        if (!this._draft) return;
        const detail = event.detail ?? {};
        const matrix = typeof event.composedPath === 'function'
            ? event.composedPath().find((node) => node?.localName === 'step-matrix') ?? null
            : null;

        const result = applyStepAction(this._draft, detail, {
            /* D2, and the reason `NEW_STEP_NAME_KEY` is a key rather than text: the seed
             * lives in a DOM-free module with no translator, so the word is made here. */
            stepName: this.#i18n.t(NEW_STEP_NAME_KEY),
        });
        if (!result.applied) {
            this.#log('warn', `editor: a step action was not applied — ${result.reason}`);
            return;
        }
        this._draft = result.draft;

        this.updateComplete
            .then(() => matrix?.updateComplete ?? null)
            .then(() => matrix?.focusStepKey?.(result.index, detail.action))
            .catch((error) => this.#log('warn',
                `editor: the caret could not be put back — ${error?.message ?? error}`));
    };

    #onNumpadRefused = (event) => {
        const detail = event.detail ?? {};
        const reason = typeof detail.reason === 'string' ? detail.reason : '';
        const where = [detail.field, detail.row, detail.slot].filter(Boolean).join('/');
        this.#log('warn', `editor: a numpad open was refused${where ? ` (${where})` : ''} — ${reason}`);

        const toast = this.renderRoot?.querySelector?.('#notice');
        if (!toast || typeof toast.show !== 'function') return;
        const t = this.#i18n.t;
        toast.show(
            reason
                ? t('That value cannot be edited here. {reason}', { reason })
                : t('That value cannot be edited here.'),
            { tone: 'warn' },
        );
    };

    /** The shell's logger, when there is one. A screen mounted without a boot is silent. */
    #log(level, message) {
        const logger = this.boot?.logger ?? null;
        if (logger && typeof logger[level] === 'function') logger[level](message);
    }

    get #change() {
        if (this.#store && this._draft) return this.#store.changeCount(this._draft);
        const count = Number.isFinite(this.changeCount) ? this.changeCount : 0;
        return { count, clean: count === 0, tell: CHANGE_TELL.COMPARED, fields: [] };
    }

    /** D11's count alone — what the band renders and what the discard question counts. */
    get #count() { return this.#change.count; }

    /** The record the editor has open, or null. */
    get #record() { return this._state?.record ?? null; }

    #closeOnSaved = false;

    #commit(gesture, { profile = null } = {}) {
        const change = this.#change;
        const plan = commitPlan({
            gesture,
            dirty: change.count > 0,
            tell: change.tell,
            seated: Boolean(this.#record),
        });
        if (plan.close && !plan.operation) { this.#leave(); return plan; }

        if (!plan.operation || !this.#store) return this.#nothingToSave(plan);

        const body = plan.operation === SAVE_OPERATION.NEW_VERSION ? this._draft : profile;
        if (!body) return this.#nothingToSave(plan);
        this.#pending = plan.operation;
        this.#store[plan.operation](body);

        /* THE LEAVE IS DEFERRED TO THE OUTCOME. `plan.close` is the request; the store's
         * SAVED publish is when it is honoured. See `#onStoreState`, which carries the
         * reasoning and the measurement. */
        this.#closeOnSaved = plan.close === true;
        return plan;
    }

    #nothingToSave(plan) {
        this.#log('warn', `editor: the commit did nothing — ${plan.reason}`);
        const toast = this.renderRoot?.querySelector?.('#notice');
        if (toast && typeof toast.show === 'function') {
            toast.show(this.#i18n.t('Nothing was saved — no profile is open.'), { tone: 'warn' });
        }
        return plan;
    }

    /** Leave the editor. The shell owns navigation, so this ASKS (app-root.js:375). */
    #leave() {
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { back: true },
            bubbles: true,
            composed: true,
        }));
    }

    #announce(state) {
        const t = this.#i18n.t;
        const toast = this.renderRoot?.querySelector?.('#notice');
        if (!toast || typeof toast.show !== 'function') return;

        if (state.save === SAVE_STATUS.REFUSED) {
            const refusal = state.refusal ?? {};
            const message = [refusal.error, refusal.message].filter(Boolean).join(' — ');
            toast.show(message || t('The server refused the save.'), { tone: 'danger' });
            return;
        }
        if (state.save === SAVE_STATUS.FAILED) {
            const status = state.report?.status ?? null;
            const said = profileFailureSentence(state.report?.error);
            let message;
            if (said && status) {
                message = t('The save failed ({status}). {reason}', {
                    status: String(status), reason: said,
                });
            } else if (said) {
                message = t('The save failed. {reason}', { reason: said });
            } else if (status) {
                message = t('The save failed ({status}).', { status: String(status) });
            } else {
                message = t('The save failed.');
            }
            toast.show(message, { tone: 'danger' });
            return;
        }
        if (state.save !== SAVE_STATUS.SAVED) return;

        /* SAVED. What became of the previous version is `profile-lineage.js`'s answer off
         * two server-issued ids — never a guess — and each word below is one of its four. */
        switch (state.version?.kept) {
            case VERSION_KEPT.LINKED:
                toast.show(t('Saved. The previous version is kept.'), { tone: 'ok' });
                break;
            case VERSION_KEPT.SAME_RECORD:
                toast.show(t('Saved. One record, updated in place.'), { tone: 'ok' });
                break;
            case VERSION_KEPT.RESTORED:
                toast.show(t('Restored. This version is now the current one.'), { tone: 'ok' });
                break;
            case VERSION_KEPT.NOT_LINKED:
                toast.show(t('Saved. The previous version was not kept.'), { tone: 'warn' });
                break;
            default:
                toast.show(t('Saved.'), { tone: 'ok' });
        }
    }

    #onRenameOpen = (event) => {
        const dialog = this.renderRoot?.querySelector?.('#rename-dialog');
        if (!dialog) return;
        const field = this.renderRoot.querySelector('#rename-field');
        if (field) field.value = this._draft?.title ?? '';
        /* A FRESH OPEN CARRIES NO REFUSAL. The last one belonged to the title that was
         * typed then, and re-showing it over an untouched field would accuse the person
         * of something they have not done yet. */
        this._renameRefusal = null;
        dialog.show({ invoker: event?.currentTarget ?? null, reason: 'press' });
    };

    #onRenameConfirm = () => {
        const field = this.renderRoot?.querySelector?.('#rename-field');
        const wanted = typeof field?.value === 'string' ? field.value.trim() : '';

        if (wanted === '') {
            this._renameRefusal = 'A profile needs a name.';
            return;
        }
        this._renameRefusal = null;

        if (!this.#record?.id) {
            if (this._draft) this._draft = { ...this._draft, title: wanted };
            this.renderRoot?.querySelector?.('#rename-dialog')?.hide('confirm');
            return;
        }

        const body = renameBody(this._state?.baseline ?? null, wanted);
        this.renderRoot?.querySelector?.('#rename-dialog')?.hide('confirm');
        if (!body) return;
        this.#commit(COMMIT_GESTURE.RENAME, { profile: body });
    };

    #onRenameCancel = () => {
        this._renameRefusal = null;
        this.renderRoot?.querySelector?.('#rename-dialog')?.hide('cancel');
    };

    #onCommit(event) {
        event.stopPropagation();
        if (this.#store) this.#commit(COMMIT_GESTURE.SAVE);
    }

    #onCancel(event) {
        event.stopPropagation();
        if (this.#count > 0) {
            this.renderRoot?.querySelector?.('#discard-dialog')?.show();
            return;
        }
        this.#leave();
    }

    #onDiscardCancel = () => {
        this.renderRoot?.querySelector?.('#discard-dialog')?.hide('cancel');
    };

    #onDiscardConfirm = () => {
        this.renderRoot?.querySelector?.('#discard-dialog')?.hide('confirm');
        this.#leave();
    }
}

customElements.define('editor-screen', EditorScreen);
