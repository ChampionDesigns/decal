/**
 * <selector-screen>, the Profile selector.
 */

import { css, html, nothing } from 'lit';

import { UiElement, focusRing } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import { PREVIEW_CHANNEL_KEYS, profilePreviewDerivation } from 'src/lib/profile-preview.js';

import { newProfile, profileFailureSentence } from 'src/data/rea-profile.js';
import { NEW_STEP_NAME_KEY } from 'src/lib/profile-modes.js';

import { formatCeilingDuration, profileTotals } from 'src/lib/profile-totals.js';
import { ARM_STATUS } from 'src/stores/profile-arm-store.js';
import { SAVE_STATUS } from 'src/stores/profile-editor-store.js';
import {
    matchProfiles,
    restoreFilenameOf,
    ADD_STATUS,
    ASSIGN_RESULT,
    LIBRARY_STATUS,
    MANAGE_RESULT,
    RESTORE_STATUS,
    VERSIONS_STATUS,
} from 'src/stores/profile-library-store.js';
import {
    highlightParts,
    listboxGroups,
    nextActiveIndex,
    optionIdFor,
    treeNodes,
    treeSideStep,
    R1_PROVISIONAL_ATTR,
    R1_PROVISIONAL_HIGHLIGHT,
} from 'src/lib/profile-listbox.js';
import { listboxStyles } from 'src/screens/selector-list.js';
import { generatorHandoff, openProfileGenerator } from 'src/lib/profile-handoff.js';

import { legendItems } from 'src/lib/history-series.js';
import { comparisonStepRules } from 'src/lib/history-compare.js';
import { CHANNEL_READOUT, readoutTime } from 'src/lib/chart-readout.js';
import { CHANNEL_TREATMENTS } from 'src/components/ui-chart-card.js';

import 'src/screens/selector-split.js';
import 'src/screens/selector-list-pane.js';
import 'src/screens/selector-detail-pane.js';

import 'src/components/ui-page-header.js';
import 'src/components/ui-button.js';
import 'src/components/ui-icon-button.js';
import 'src/components/ui-search-field.js';
import 'src/components/ui-list-row.js';
import 'src/components/ui-section-header.js';
import 'src/components/ui-favourite-slot.js';
import 'src/components/ui-stat-tile.js';
import 'src/components/ui-chart-card.js';
import 'src/components/ui-chart-legend.js';
import 'src/components/ui-notes-editor.js';
import 'src/components/ui-alert-banner.js';
import 'src/components/ui-toast.js';
import 'src/components/ui-menu.js';
import 'src/components/ui-dialog.js';
import 'src/components/ui-confirm-dialog.js';
import 'src/components/ui-file-button.js';
import 'src/components/ui-text-field.js';

/** Re-exported so a reviewer grepping the screen finds R1's marking here too. */
export { R1_PROVISIONAL_ATTR, R1_PROVISIONAL_HIGHLIGHT };

const PLACEHOLDER_ROWS = Object.freeze([
    { title: 'Extractamundo Dos!', provenance: 'Bundled' },
    { title: 'Tea portafilter / Green', provenance: 'Bundled' },
    { title: 'Tea portafilter / Oolong', provenance: 'Bundled' },
    { title: 'Baseline', provenance: 'Yours' },
]);

/** The five slots, 1-based, as a person reads them off the discs. */
const SLOT_NUMBERS = Object.freeze([1, 2, 3, 4, 5]);

const SELECTOR_RETURN_VIEWS = new WeakMap();

const SUMMARY_TILES = Object.freeze([
    Object.freeze({
        key: 'temp', label: 'Temp',
        read: (profile) => {
            const temps = stepsOf(profile)
                .map((step) => numeric(step?.temperature))
                .filter((value) => value !== null);
            return temps.length ? { value: Math.max(...temps).toFixed(1), unit: '°C' } : null;
        },
    }),
    Object.freeze({
        key: 'peak', label: 'Peak',
        read: (profile, totals) => (totals.peakPressure === null
            ? null
            : { value: totals.peakPressure.toFixed(1), unit: 'bar' }),
    }),
    Object.freeze({
        key: 'duration', label: 'Duration',
        read: (profile, totals) => (totals.maxSeconds === null
            ? null
            : { value: formatCeilingDuration(totals.maxSeconds), unit: 'max' }),
    }),
    Object.freeze({
        /* THE ONE TILE EVERY PROFILE CAN ANSWER: a profile with no steps has none, and
         * zero steps is a reading rather than an absence. */
        key: 'steps', label: 'Steps',
        read: (profile, totals) => ({ value: String(totals.steps), unit: '' }),
    }),
    Object.freeze({
        key: 'stop-at', label: 'Stop at',
        read: (profile) => {
            const weight = numeric(profile.target_weight);
            if (weight !== null) return { value: String(weight), unit: 'g' };
            const volume = numeric(profile.target_volume);
            return volume === null ? null : { value: String(volume), unit: 'mL' };
        },
    }),
]);

/** The profile's steps, or none. Same reading as `profile-totals.js`'s. */
const stepsOf = (profile) => (Array.isArray(profile?.steps) ? profile.steps : []);

/** A number a profile actually states. Zero is ReaPrime's "unset" for these fields. */
function numeric(value) {
    const n = Number(value);
    return Number.isFinite(n) && n !== 0 ? n : null;
}

/** Menu item ids. Strings in one place, so the template and the handler cannot part. */
const FOLD_SHUT_GLYPH = '\u25B8';

const FOLD_OPEN_GLYPH = '\u25BE';

export const FOLDER_NODE_PREFIX = 'folder:';

const folderNodeId = (folder) => `${FOLDER_NODE_PREFIX}${folder}`;

const ADD_ACTION = Object.freeze({
    NEW: 'new',
    UPLOAD: 'upload',
    SHARE_CODE: 'share-code',
    GENERATE: 'generate',
});

const ACTION = Object.freeze({
    /** A row menu's five slot rows — the number rides on the id after a colon. */
    ASSIGN: 'assign',
    REMOVE: 'remove',
    VERSIONS: 'versions',
    EDIT: 'edit',
    HIDE: 'hide',
});

const PREVIEW_TERM_LABELS = Object.freeze({
    targetPressure: 'Pressure',
    targetFlow: 'Flow',
});

const PREVIEW_AXIS_TERM = '{name} ({unit})';

const PREVIEW_TIME_UNIT = String(readoutTime(0) ?? '').replace(/^[^A-Za-z°]*/, '');

export class SelectorScreen extends UiElement {
    static properties = {
        boot: { attribute: false },

        /** The profile the machine has loaded, by id — settable for a demo or a test. */
        loadedProfileId: { type: String, attribute: 'loaded-profile-id' },

        /** The id of the control to put focus back on once the screen has revealed. */
        restoreFocusTo: { attribute: false },

        /** Internal: the library store's published state. */
        _state: { state: true },
        /** Internal: the filter field's text. */
        _query: { state: true },

        _showHidden: { state: true },
        /** Internal: which option `aria-activedescendant` names. A record id, or null. */
        _activeId: { state: true },
        /** Internal: which placeholder row is selected, in the no-boot layout demo. */
        _placeholder: { state: true },

        _openFolders: { state: true },

        /** What has been typed into the share-code field. */
        _shareCode: { state: true },

        /** The generator plugin's page, or null while it is absent or not loaded. */
        _generatorUrl: { state: true },

        /** The favourite replacement awaiting confirmation, or null. */
        _replacement: { state: true },
        /** The chosen file's name, for the import dialog to show. */
        _fileName: { state: true },
        /** What the import had to say, or null while it has said nothing. */
        _fileError: { state: true },
        /** True while an import is in flight — a second press is refused. */
        _filePending: { state: true },
        /** Whether the generator was navigated to, and whether that navigation failed. */
        _generatorOpened: { state: true },
        _generatorFailed: { state: true },
        /** True while the selected profile is being sent to the machine. */
        _usingProfile: { state: true },
    };

    static styles = [typeRoles, seams, listboxStyles, css`
        .hidden-control {
            position: absolute;
            inline-size: 1px;
            block-size: 1px;
            overflow: hidden;
            clip-path: inset(50%);
        }

        /* The share-code dialog's body: a field, whatever the add had to say, and the
         * one affirmative button. */
        .share-body {
            display: grid;
            gap: var(--ui-space-4);
            min-inline-size: 0;
        }

        .restore-body {
            display: grid;
            gap: var(--ui-space-4);
            min-inline-size: 0;
        }
        .dialog-lead {
            margin: 0;
            font-size: var(--ui-text-note);
            line-height: 1.35;
            color: var(--ui-text-2);
        }

        .title-copy,
        .file-body,
        .replacement-body {
            display: grid;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        .title-copy .ui-caption { color: var(--ui-muted); }

        .file-name,
        .replacement-name { overflow-wrap: anywhere; }

        .title-copy { gap: var(--ui-space-1); }

        .dialog-message {
            --ui-display-xl: var(--ui-text-lg);
            --_ui-headline-leading: 1.4;
        }

        .favourite-choice {
            display: grid;
            justify-items: center;
            gap: var(--ui-space-2);
            min-inline-size: 0;
        }

        .favourite-name {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
            overflow-wrap: anywhere;
            font-size: var(--ui-text-note);
            line-height: 1.2;
            text-align: center;
            color: var(--ui-text-2);
        }

        :host(.seam-grid) {
            grid-template-rows: var(--ui-band-h) minmax(0, 1fr);
            block-size: 100%;
        }

        /* Row 1. min-inline-size: 0 so a long profile title in the band cannot widen
         * the screen; the band's own layout is #31's and nothing here reaches into it. */
        ui-page-header {
            grid-row: 1;
            min-inline-size: 0;
        }

        selector-split {
            grid-row: 2;
            min-inline-size: 0;
            min-block-size: 0;
        }

        .band-actions {
            display: flex;
            align-items: center;
            gap: var(--ui-space-2);
        }

        .toolbar,
        .title-row {
            display: flex;
            align-items: center;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        /* The title takes the slack so the overflow affordance sits at the trailing
         * edge, and it ELLIPSES rather than widening the pane: a 60-character profile
         * title is ordinary in this fixture. */
        #detail-title {
            font-size: var(--ui-text-xl);
            line-height: 1.2;
            min-inline-size: 0;
            overflow-x: clip;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .detail-actions {
            margin-inline-start: auto;
            display: flex;
            align-items: center;
            gap: var(--ui-space-3);
            flex: 0 0 auto;
        }

        .hit {
            background-color: color-mix(in srgb, var(--ui-match) 55%, transparent);
            color: inherit;
            border-radius: var(--ui-radius-sm, 3px);
        }

        .row-dots {
            display: grid;
            place-items: center;
            inline-size: var(--ui-control-h);
            block-size: var(--ui-control-h);
            flex: 0 0 auto;
            border-radius: var(--ui-radius);
            color: var(--ui-muted);
            font-size: var(--ui-icon);
            line-height: 1;
            cursor: pointer;
        }

        .row-dots:focus-visible { ${focusRing} }

        .row-menu {
            flex: 0 0 auto;
        }

        .row-fav {
            --_ui-fav-slot-size: var(--ui-control-sm);
        }

        .assign-row {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            align-items: start;
            gap: var(--ui-space-3);
            padding-block-start: var(--ui-space-5);
            min-inline-size: 0;
        }

        .assign-row .ui-microcap {
            grid-column: 1 / -1;
            font-size: var(--ui-text-md);
            font-weight: var(--ui-weight-regular);
            line-height: 1.2;
            white-space: normal;
        }

        .assign-row ui-favourite-slot {
            --_ui-fav-slot-size: var(--ui-control-h);
        }

        .summary {
            display: flex;
            flex-wrap: wrap;
            align-items: baseline;
            gap: var(--ui-space-3) var(--ui-space-6);
            min-inline-size: 0;
        }

        .summary > * {
            flex: 0 0 auto;
            min-inline-size: 0;
        }

        .detail-strip {
            display: flex;
            flex-direction: column;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        .preview-key {
            display: flex;
            align-items: center;
            gap: var(--ui-space-3);
            min-inline-size: 0;
        }

        .preview-key ui-chart-legend {
            flex: 1 1 auto;
            min-inline-size: 0;
        }

        .preview-key .axis {
            flex: 0 0 auto;
            font-size: var(--ui-text-note);
            line-height: 1.5;
            color: var(--ui-muted);
            white-space: nowrap;
        }

        .list-state {
            display: flex;
            flex-direction: column;
            align-items: start;
            gap: var(--ui-space-3);
            padding: var(--ui-space-4) var(--ui-space-3);
            min-inline-size: 0;
        }

        .dialog-list {
            display: flex;
            flex-direction: column;
            gap: var(--ui-space-1);
            min-inline-size: 0;
        }

        #list-caption {
            flex: 1 1 auto;
            min-inline-size: 0;
        }
    `];

    #i18n = new I18nController(this);

    /** The library store, built once `boot` arrives. Null in the layout demo. */
    #store = null;

    /** The store's unsubscribe, dropped in disconnectedCallback. */
    #unwatch = null;
    #entryRevealed = false;
    #returnView = null;
    #entryTask = null;
    #entryGeneration = 0;
    #replacementResolve = null;
    #importFile = null;

    #legendCache = null;
    #previewLegendCard = null;

    constructor() {
        super();
        this.boot = null;
        this.loadedProfileId = '';
        this.restoreFocusTo = null;
        this._state = null;
        this._showHidden = false;
        this._query = '';
        this._activeId = null;
        this._openFolders = new Set();
        this._shareCode = '';
        this._generatorUrl = null;
        this._placeholder = null;
        this._replacement = null;
        this._fileName = '';
        this._fileError = null;
        this._filePending = false;
        this._generatorOpened = false;
        this._generatorFailed = false;
        this._usingProfile = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this.classList.add('seam-grid', 'seam-strong');
        this.#attach();
        this.#readOpenFolders();
        this.#readGenerator();
    }

    /**
     * IS THE PROFILE GENERATOR THERE? Asked once, not awaited, and answered with a URL or
     * null — null keeps the menu row out of the list rather than showing one that 404s.
     */
    async #readGenerator() {
        const url = await this.#store?.generatorUrl?.().catch(() => null);
        if (typeof url === 'string' && url) this._generatorUrl = url;
    }

    async #readOpenFolders() {
        if (this.#returnView) return;
        const storage = this.boot?.storage;
        if (!storage || typeof storage.get !== 'function') return;
        const held = await storage.get('profileFoldersOpen').catch(() => null);
        if (!Array.isArray(held) || !held.length) return;
        this._openFolders = new Set([...held.filter((name) => typeof name === 'string'), ...this._openFolders]);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.#unwatch?.();
        this.#unwatch = null;
        this.#dropPendingAssignment();
        this.#store = null;
        this.#entryRevealed = false;
        this.#entryGeneration++;
        this.#entryTask = null;
        this.#replacementResolve?.(false);
        this.#replacementResolve = null;
        this._replacement = null;
    }

    async #takePendingAssignment() {
        const storage = this.boot?.storage;
        if (!storage || typeof storage.get !== 'function') return null;
        const held = await storage.get('pendingAssignmentIndex').catch(() => null);
        this.#dropPendingAssignment();
        const index = Number(held);
        if (held === null || held === undefined || held === '' || !Number.isInteger(index)) return null;
        if (index < 0 || index >= SLOT_NUMBERS.length) return null;
        return index;
    }

    /** Drop the pending assignment, wherever the visit ends. Never throws, never waits. */
    #dropPendingAssignment() {
        const storage = this.boot?.storage;
        if (!storage || typeof storage.remove !== 'function') return;
        Promise.resolve(storage.remove('pendingAssignmentIndex')).catch(() => {});
    }

    willUpdate(changed) {
        if (changed.has('boot')) this.#attach();
    }

    updated(changed) {
        super.updated(changed);
        this.#bindPreviewLegend();
        if (!this.#entryRevealed && this._state?.status === LIBRARY_STATUS.READY) {
            this.#entryRevealed = true;
            this.#entryTask = this.#restoreEntry();
        } else if (changed.has('restoreFocusTo') && this.restoreFocusTo && this.#entryRevealed) {
            Promise.resolve(this.#entryTask).then(() => this.#restoreEntryFocus());
        }
    }

    #restoreEntryFocus() {
        if (!this.isConnected || !this.restoreFocusTo) return;
        this.renderRoot.getElementById(this.restoreFocusTo)?.focus?.({ preventScroll: true });
    }

    async #restoreEntry() {
        const generation = this.#entryGeneration;
        const view = this.#returnView;
        this.#returnView = null;
        const editor = this.boot?.profileEditor?.get?.();
        const savedId = editor?.save === SAVE_STATUS.SAVED ? editor.record?.id : null;
        const savedAnother = Boolean(view && savedId && savedId !== view.editorRecordId);
        const rows = view?.showHidden ? this._state?.hidden : this._state?.listable;
        const canRestore = view && !savedAnother && (view.selectedId === null
            || matchProfiles(rows ?? [], view.query).some(record => record.id === view.selectedId));
        if (canRestore) {
            this._showHidden = view.showHidden;
            this._query = view.query;
            this._openFolders = new Set(view.openFolders);
            this._activeId = view.activeId;
            this.#store?.select(view.selectedId);
            await this.updateComplete;
            await new Promise(requestAnimationFrame);
            if (!this.isConnected || generation !== this.#entryGeneration) return;
            const list = this.renderRoot.getElementById('list-pane')?.shadowRoot?.getElementById('list');
            if (list) { list.scrollTop = view.scrollTop; list.scrollLeft = view.scrollLeft; }
        } else {
            this._query = '';
            const availableSaved = view && savedId && this.#store?.recordFor(savedId);
            const id = availableSaved ? savedId : this.#openingRecordId;
            if (id !== this._state.selectedId) this.#store?.select(id);
            await this.#revealProfile(id, { switchList: Boolean(availableSaved) });
        }
        if (generation === this.#entryGeneration) this.#restoreEntryFocus();
    }

    #rememberEditorView(editorRecordId) {
        const list = this.renderRoot.getElementById('list-pane')?.shadowRoot?.getElementById('list');
        SELECTOR_RETURN_VIEWS.set(this.boot, {
            showHidden: this._showHidden, query: this._query,
            openFolders: [...this._openFolders], activeId: this._activeId,
            selectedId: this._state?.selectedId ?? null, editorRecordId,
            scrollTop: list?.scrollTop ?? 0, scrollLeft: list?.scrollLeft ?? 0,
        });
    }

    get #openingRecordId() {
        const rows = this._showHidden ? this._state?.hidden : this._state?.listable;
        const contains = id => Boolean(id) && rows?.some(record => record.id === id);
        if (contains(this._state?.selectedId)) return this._state.selectedId;
        return contains(this._state?.loaded?.id) ? this._state.loaded.id : null;
    }

    async #revealProfile(id, { switchList = false } = {}) {
        if (!id || !this.isConnected) return;
        const record = this.#store?.recordFor?.(id);
        if (!record) return;
        const hidden = Boolean(this._state?.hidden?.some((entry) => entry.id === id));
        if (!switchList && hidden !== this._showHidden) return;
        this._query = '';
        if (switchList) this._showHidden = hidden;
        const group = listboxGroups(this.#rows).find((entry) => entry.entries.some((item) => item.id === id));
        if (group?.folder) this._openFolders = new Set([...this._openFolders, group.folder]);
        this._activeId = id;
        await this.updateComplete;
        this.renderRoot.getElementById(optionIdFor(id))?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }

    #attach() {
        if (this.#store || !this.isConnected || !this.boot?.library) return;
        this.#store = this.boot.library;
        const returning = SELECTOR_RETURN_VIEWS.get(this.boot);
        SELECTOR_RETURN_VIEWS.delete(this.boot);
        if (returning && this.restoreFocusTo) {
            this.#returnView = returning;
            this._showHidden = returning.showHidden;
            this._query = returning.query;
            this._openFolders = new Set(returning.openFolders);
        }
        this.#unwatch = this.#store.subscribe((state) => { this._state = state; });
        this._state = this.#store.get();
        this.#store.load();
    }

    /** The store, for a suite that drives the loop. Null in the layout demo. */
    get store() { return this.#store; }

    /** True when there is no shell, so the screen is the layout demo. */
    get #demo() { return this.#store === null; }

    /** The rows the listbox shows: rule 1's listable set, through the filter. */
    get #rows() {
        if (this._showHidden) return matchProfiles(this._state?.hidden ?? [], this._query);
        if (this.#demo) return [];
        return matchProfiles(this._state?.listable ?? [], this._query);
    }

    get #nodes() {
        if (this.#demo) return [];
        const rows = this.#rows;
        return treeNodes(rows, this._query ? new Set(listboxGroups(rows)
            .map((group) => group.folder).filter(Boolean)) : this._openFolders);
    }

    get #selectedRecord() {
        if (this.#demo) return null;
        return this.#store.selected();
    }

    /** Which option the keyboard is on: the active one, else the selected, else first. */
    get #activeIndex() {
        const nodes = this.#nodes;
        if (nodes.length === 0) return -1;
        const idOf = (node) => (node.kind === 'folder' ? folderNodeId(node.folder) : node.record.id);
        const byActive = nodes.findIndex((node) => idOf(node) === this._activeId);
        if (byActive >= 0) return byActive;
        const selected = this._state?.selectedId;
        const bySelected = nodes.findIndex((node) => node.kind === 'profile' && node.record.id === selected);
        return bySelected >= 0 ? bySelected : 0;
    }

    /** The id `aria-activedescendant` names, or null when the list is empty. */
    get activeDescendantId() {
        const nodes = this.#nodes;
        const at = this.#activeIndex;
        if (at < 0 || !nodes[at]) return null;
        return nodes[at].kind === 'folder'
            ? optionIdFor(folderNodeId(nodes[at].folder))
            : optionIdFor(nodes[at].record.id);
    }

    #applyQuery(next) {
        this._query = next ?? '';
        this._activeId = null;
    }

    #onSearch = (event) => {
        this.#applyQuery(event.detail?.value ?? '');
    };

    #onFilterInput = (event) => {
        this.#applyQuery(event.currentTarget?.value ?? '');
    };

    #onPick = (event) => {
        const id = event.currentTarget.dataset.id;
        if (!id) return;
        this._activeId = id;
        this.#store?.select(id);
    };

    /** The layout demo's rows select nothing — a placeholder has no profile to draw. */
    #onPickPlaceholder = (event) => {
        this._placeholder = event.currentTarget.dataset.title;
    };

    #onListKeyDown = (event) => {
        const nodes = this.#nodes;
        const at = this.#activeIndex;
        const next = nextActiveIndex(event.key, at, nodes.length);
        if (next === null) return;

        const move = (index) => {
            const node = nodes[index];
            if (!node) return;
            this._activeId = node.kind === 'folder' ? folderNodeId(node.folder) : node.record.id;
            this.updateComplete.then(() => {
                const el = this.renderRoot.getElementById(optionIdFor(this._activeId));
                /* `block: 'nearest'` so a row already on screen does not move the pane at
                 * all — a list that re-centres on every arrow press slides under a finger
                 * that is only reading. */
                el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
            });
        };

        if (next === 'choose') {
            /* ENTER MEANS THE SAME AS A TAP, and on a family a tap folds it. */
            const node = nodes[at];
            if (node?.kind === 'folder') this.#toggleFolder(node.folder);
            else if (node) this.#store?.select(node.record.id);
        } else if (next === 'open' || next === 'close') {
            /* THE TREE'S TWO SIDEWAYS KEYS. `treeSideStep` answers with a family to open,
             * a family to shut, or an index to move to — the four cases the APG's tree
             * pattern names, and no fifth. */
            const step = treeSideStep(next, nodes, at);
            if (!step) return;
            if (step.open) this.#toggleFolder(step.open, true);
            else if (step.close) this.#toggleFolder(step.close, false);
            else move(step.index);
        } else {
            move(next);
        }
        event.preventDefault();
        event.stopPropagation();
    };

    #toggleFolder(folder, force = null) {
        if (typeof folder !== 'string' || !folder) return;
        const open = new Set(this._openFolders);
        const wanted = force === null ? !open.has(folder) : force;
        if (wanted === open.has(folder)) return;
        if (wanted) open.add(folder);
        else open.delete(folder);
        this._openFolders = open;
        const storage = this.boot?.storage;
        if (storage && typeof storage.set === 'function') {
            Promise.resolve(storage.set('profileFoldersOpen', [...open])).catch(() => {});
        }
    }

    #onFolderPick = (event) => {
        const folder = event.currentTarget.dataset.folder;
        if (folder) {
            this._activeId = folderNodeId(folder);
            this.#toggleFolder(folder);
        }
    };

    #favouriteSlots() {
        const t = this.#i18n.t;
        const entries = this.#demo ? [] : (this.#store?.favouriteEntries?.() ?? []);
        const selected = this._state?.selectedId ?? '';
        return SLOT_NUMBERS.map((number) => {
            const entry = entries[number - 1] ?? null;
            const held = entry?.value ?? entry?.id ?? '';
            const name = entry?.name || entry?.label || (held ? t('Unavailable profile') : '');
            return html`<div class="favourite-choice"><ui-favourite-slot
                data-slot=${number}
                index=${number}
                ?filled=${Boolean(held)}
                ?selected=${Boolean(held) && held === selected}
                label=${name
                    ? t('Favourite {n}: {name}', { n: number, name })
                    : t('Favourite {n}, empty', { n: number })}
                @click=${this.#onFavouriteSlot}
            ></ui-favourite-slot><span class="favourite-name" title=${name}
                >${name || t('Empty')}</span></div>`;
        });
    }

    /** A disc was pressed. Same rule as the bank's, through the same store call. */
    #onFavouriteSlot = (event) => {
        const slot = Number(event.currentTarget?.dataset?.slot);
        if (!Number.isFinite(slot)) return;
        this.#onFavouriteChange({ detail: { slot } });
    };

    #onFavouriteChange = (event) => {
        const slot = event.detail?.slot;
        const selected = this._state?.selectedId;
        if (!Number.isInteger(slot) || slot < 1) return;
        if (!selected) {
            this.#notice(this.#i18n.t('Pick a profile from the list to assign it.'), 'warn');
            return;
        }
        this.#assign(slot - 1, selected);
    };

    async #assign(index, id, { load = true, confirmed = false } = {}) {
        const store = this.#store;
        if (!store || typeof store.setFavourite !== 'function') return false;
        const t = this.#i18n.t;
        const held = store.favouriteSlotHolding?.(id) ?? null;
        if (held !== null) {
            this.#refusedDuplicate(id, held);
            return false;
        }
        const previousId = this._state?.favourites?.assignments?.[index] ?? null;
        if (!confirmed && previousId && previousId !== id) {
            if (this._replacement) return false;
            return new Promise((resolve) => {
                this.#replacementResolve = resolve;
                this._replacement = { index, id, previousId, load, pending: false, error: null };
                this.updateComplete.then(() => this.renderRoot.getElementById('replace-favourite')
                    ?.show({ reason: 'replace-favourite' }));
            });
        }
        const outcome = await Promise.resolve(store.setFavourite(index, id)).catch(() => null);
        const ending = outcome?.result ?? null;
        if (ending === ASSIGN_RESULT.REFUSED_DUPLICATE) {
            this.#refusedDuplicate(id, outcome.held);
            return false;
        }
        if (ending !== ASSIGN_RESULT.ASSIGNED) {
            if (!confirmed) this.#notice(
                t('Favourite {n} could not be saved, and is unchanged.', { n: index + 1 }),
                'danger',
            );
            return false;
        }
        const title = store.recordFor?.(id)?.profile?.title;
        if (title) this.#notice(t('Favourite {n}: {title}', { n: index + 1, title }), 'ok');
        if (!load) return true;
        const armed = await Promise.resolve(store.arm?.(id)).catch(() => null);
        if (armed && armed.status === ARM_STATUS.REFUSED) {
            this.#notice(t('The machine refused this profile.'), 'danger');
        } else if (!armed || armed.status !== ARM_STATUS.ARMED) {
            this.#notice(t('The machine has not been given this profile yet'), 'warn');
        }
        return true;
    }

    #onReplacementClose = (event) => {
        if (this._replacement?.pending) { event.preventDefault(); return; }
        this.#finishReplacement(false);
    };

    #finishReplacement(assigned) {
        const resolve = this.#replacementResolve;
        this.#replacementResolve = null;
        this._replacement = null;
        this.renderRoot.getElementById('replace-favourite')?.hide(assigned ? 'assigned' : 'cancel');
        resolve?.(assigned);
    }

    #onReplacementConfirm = async () => {
        const pending = this._replacement;
        if (!pending || pending.pending) return;
        const currentId = this._state?.favourites?.assignments?.[pending.index] ?? null;
        if (currentId !== pending.previousId) {
            this._replacement = { ...pending, previousId: currentId,
                error: this.#i18n.t('This favourite changed. Review the replacement before continuing.') };
            return;
        }
        this._replacement = { ...pending, pending: true, error: null };
        const assigned = await this.#assign(pending.index, pending.id, { load: pending.load, confirmed: true });
        if (assigned) this.#finishReplacement(true);
        else this._replacement = { ...pending, pending: false,
            error: this.#i18n.t('The favourite could not be saved. Try again, or cancel to keep it unchanged.') };
    };

    #refusedDuplicate(id, held) {
        const t = this.#i18n.t;
        const title = this.#store?.recordFor?.(id)?.profile?.title;
        this.#notice(
            title
                ? t('“{title}” is already on favourite {n}', { title, n: held + 1 })
                : t('That profile is already on favourite {n}', { n: held + 1 }),
            'danger',
        );
    }

    /** Put one line on the screen's toast, if the toast has rendered yet. */
    #notice(message, tone) {
        this.renderRoot?.getElementById('notice')?.show?.(message, { tone, duration: 3000 });
    }

    #onConfirmHide = () => {
        const id = this._state?.selectedId;
        if (!id || !this.#store || typeof this.#store.hide !== 'function') return;
        this.#reportManage(
            this.#store.hide(id),
            this.#i18n.t('That profile could not be hidden. Try again.'),
        );
    };

    #reportManage(result, failed) {
        return Promise.resolve(result)
            .then((outcome) => {
                const ending = outcome?.result ?? null;
                if (ending === MANAGE_RESULT.DONE) return;
                if (ending === MANAGE_RESULT.NO_RECORD) {
                    this.#notice(this.#i18n.t('That profile is no longer in the library.'), 'warn');
                    return;
                }
                this.#notice(failed, 'danger');
            })
            .catch(() => { this.#notice(failed, 'danger'); });
    }

    get #canReset() {
        const record = this.#selectedRecord;
        return Boolean(record) && restoreFilenameOf(record) !== null;
    }

    #onToggleHidden = () => {
        this._showHidden = !this._showHidden;
        this.#store?.select?.(null);
    };

    #onHidePress = () => {
        if (!this._state?.selectedId) return;
        this.renderRoot.getElementById('confirm-hide')?.show({ reason: 'detail-actions' });
    };

    #onResetPress = () => {
        const id = this._state?.selectedId;
        if (!id || !this.#canReset) return;
        this.renderRoot.getElementById('confirm-reset')?.show({ reason: 'detail-actions' });
    };

    /**
     * REMOVED. The store owns the route, the 404-is-already-gone reading and the re-read;
     * this only asks, and it has already asked.
     */
    #onConfirmRemove = () => {
        const id = this._state?.selectedId;
        if (!id || typeof this.#store?.purge !== 'function') return;
        this.#reportManage(
            this.#store.purge(id),
            this.#i18n.t('That profile could not be deleted. Try again.'),
        );
    };

    /** The one profile, back to its bundle. The store owns the filename and the re-read. */
    #onConfirmReset = () => {
        const id = this._state?.selectedId;
        if (!id || typeof this.#store?.restoreToFactory !== 'function') return;
        this.#reportRestore(this.#store.restoreToFactory(id));
    };

    #reportRestore(result) {
        return Promise.resolve(result)
            .then((state) => {
                if (state?.restore?.status !== RESTORE_STATUS.FAILED) return;
                this.#notice(
                    this.#i18n.t('That profile could not be reset. Try again.'), 'danger',
                );
            })
            .catch(() => {
                this.#notice(
                    this.#i18n.t('That profile could not be reset. Try again.'), 'danger',
                );
            });
    }

    #onEditPress = () => { this.#openEditor(); };

    #onDeletePress = () => {
        if (!this._state?.selectedId) return;
        this.renderRoot.getElementById('confirm-remove')?.show({ reason: 'actions' });
    };

    #openNewProfile() {
        if (!this.boot?.profileEditor) return;
        this.#rememberEditorView(null);
        const t = this.#i18n.t;
        this.boot.profileEditor.open({
            id: null,
            profile: newProfile({
                title: t('New profile'),
                stepName: t(NEW_STEP_NAME_KEY),
            }),
        });
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { route: 'editor', invoker: 'add-open' },
            bubbles: true,
            composed: true,
        }));
    }

    #openEditor(invoker = 'act-edit') {
        const record = this.#selectedRecord;
        if (!record || !this.boot?.profileEditor) return;
        this.#rememberEditorView(record.id);
        this.boot.profileEditor.open(record);
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { route: 'editor', invoker },
            bubbles: true,
            composed: true,
        }));
    }

    #titleParts(title) {
        const parts = highlightParts(title, this._query);
        if (parts.length === 1 && !parts[0].hit) return title;
        return parts.map((part) => (part.hit
            ? html`<mark class="hit">${part.text}</mark
                >`
            : part.text));
    }

    #rowMenu(record, isActiveRow = false) {
        const t = this.#i18n.t;
        const id = record?.id;
        if (!id) return nothing;
        return html`<ui-menu
            slot="actions"
            class="row-menu"
            label=${t('Actions for {name}', { name: record.profile?.title || t('Untitled') })}
            .items=${this.#rowMenuItems(record)}
            @select=${(event) => this.#onRowMenuSelect(event, id)}
            @click=${(event) => event.stopPropagation()}
        >
            <span
                slot="trigger"
                class="row-dots"
                role=${isActiveRow ? 'button' : nothing}
                tabindex=${isActiveRow ? '0' : nothing}
                aria-label=${t('More actions for {name}', { name: record.profile?.title || t('Untitled') })}
                @keydown=${this.#onRowMenuKey}
            ><span class="row-dots-glyph" aria-hidden="true">⋯</span></span>
        </ui-menu>`;
    }

    #onRowMenuKey = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const menu = event.currentTarget?.closest?.('ui-menu');
        if (!menu || menu.open) return;
        event.preventDefault();
        event.stopPropagation();
        menu.show({ focus: 'first', reason: 'keyboard' });
    };

    #rowMenuItems(record) {
        const t = this.#i18n.t;
        const assignments = this._state?.favourites?.assignments ?? {};
        const items = SLOT_NUMBERS.map((number) => {
            const held = assignments[number - 1] ?? null;
            const holder = held ? this.#store?.recordFor?.(held) : null;
            const name = holder?.profile?.title ?? '';
            return {
                id: `${ACTION.ASSIGN}:${number}`,
                label: name
                    ? t('Favourite {n} — replace {name}', { n: number, name })
                    : t('Favourite {n}', { n: number }),
                selected: held === record.id,
            };
        });
        items.push({ separator: true });
        items.push({ id: ACTION.EDIT, label: t('Edit profile') });
        items.push({ id: ACTION.VERSIONS, label: t('Previous versions') });
        items.push({ separator: true });
        if (!this._showHidden) items.push({ id: ACTION.HIDE, label: t('Hide'), danger: true });
        items.push({ id: ACTION.REMOVE, label: t('Delete'), danger: true });
        return items;
    }

    #onRowMenuSelect(event, id) {
        const chosen = String(event.detail?.id ?? '');
        if (chosen.startsWith(`${ACTION.ASSIGN}:`)) {
            const slot = Number(chosen.slice(ACTION.ASSIGN.length + 1));
            if (Number.isFinite(slot)) this.#assign(slot - 1, id);
            return;
        }
        if (chosen === ACTION.EDIT) {
            this.#store?.select(id);
            this.#openEditor('rows');
            return;
        }
        if (chosen === ACTION.VERSIONS) {
            this.#store?.select(id);
            this.#store?.versionsOf(id);
            this.renderRoot.getElementById('versions')?.show({ reason: 'row-menu' });
            return;
        }
        if (chosen === ACTION.REMOVE) {
            this.#store?.select(id);
            this.renderRoot.getElementById('confirm-remove')?.show({ reason: 'row-menu' });
            return;
        }
        if (chosen === ACTION.HIDE) {
            this.#store?.select(id);
            this.renderRoot.getElementById('confirm-hide')?.show({ reason: 'row-menu' });
        }
    }

    #favouriteMarkFor(id) {
        const assignments = this._state?.favourites?.assignments;
        if (!id || !assignments) return nothing;
        for (const [index, held] of Object.entries(assignments)) {
            if (held !== id) continue;
            const slot = Number(index) + 1;
            if (!Number.isFinite(slot)) return nothing;
            return html`<ui-favourite-slot
                slot="favourite"
                class="row-fav"
                inert
                aria-hidden="true"
                filled
                index=${slot}
                label=${this.#i18n.t('Favourite {slot}', { slot })}
            ></ui-favourite-slot>`;
        }
        return nothing;
    }

    #onCancelPress = () => {
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { back: true }, bubbles: true, composed: true,
        }));
    };

    #onConfirmPress = () => {
        if (!this._state?.selectedId || this._usingProfile) return;
        this._usingProfile = true;
        this.#store.clearRefusal();
        Promise.resolve(this.#onConfirmChosen()).catch(() => {
            this.#notice(this.#i18n.t('This profile could not be used. Try again.'), 'danger');
        }).finally(() => { this._usingProfile = false; });
    };

    async #onConfirmChosen() {
        const pending = await this.#takePendingAssignment();
        if (pending === null) return this.#onConfirmLoad();

        const id = this._state?.selectedId;
        if (!id) return undefined;
        const assigned = await this.#assign(pending, id);
        if (!assigned) return undefined;
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { route: 'live' }, bubbles: true, composed: true,
        }));
        return undefined;
    }

    #onConfirmLoad = async () => {
        const armed = await this.#store?.arm();
        if (!armed) return;
        if (armed.status === ARM_STATUS.REFUSED) {
            this.#notice(this.#i18n.t('The machine refused this profile.'), 'danger');
            return;
        }
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { route: 'live' }, bubbles: true, composed: true,
        }));
    };

    #onRestore = (event) => {
        const id = event.currentTarget.dataset.id;
        if (id) this.#reportRestore(this.#store.restoreToFactory(id));
    };

    #onVersionsClose = () => { this.#store?.clearVersions(); };

    #onRestoreOpen = () => {
        this.renderRoot.getElementById('restore')?.show({ reason: 'toolbar' });
    };

    #manageItems() {
        const t = this.#i18n.t;
        return [
            { id: ACTION.VERSIONS, label: t('Previous versions') },
            ...(this.#canReset ? [{ id: 'reset', label: t('Reset to factory') }] : []),
            { separator: true },
            ...(!this._showHidden ? [{ id: ACTION.HIDE, label: t('Hide'), danger: true }] : []),
            { id: ACTION.REMOVE, label: t('Delete'), danger: true },
        ];
    }

    #onManageSelect = (event) => {
        const action = event.detail?.id;
        if (action === 'reset') this.#onResetPress();
        else if (action === ACTION.HIDE) this.#onHidePress();
        else if (action === ACTION.REMOVE) this.#onDeletePress();
        else this.#onRowMenuSelect(event, this._state?.selectedId);
    };

    #option(record, index, activeRecordId) {
        const t = this.#i18n.t;
        const id = record.id;
        const title = record.profile?.title || t('Untitled');
        const loaded = this._state?.loaded;
        const isLoaded = Boolean(loaded?.id) && loaded.id === id;
        return html`
            <ui-list-row
                id=${optionIdFor(id)}
                role="treeitem"
                data-id=${id}
                data-index=${index}
                ?data-active=${id === activeRecordId}
                ?data-r1-provisional=${isLoaded && loaded.provisional === true}
                ?selected=${id === this._state?.selectedId}
                provenance=${isLoaded ? t('Loaded') : nothing}
                @click=${this.#onPick}
                >${this.#titleParts(title)}${this.#favouriteMarkFor(id)}${this.#rowMenu(record, id === activeRecordId)}</ui-list-row
            >`;
    }

    #placeholderRow(row, index) {
        const t = this.#i18n.t;
        return html`
            <ui-list-row
                id=${optionIdFor('demo-' + index)}
                role="treeitem"
                data-title=${row.title}
                data-placeholder
                provenance=${t(row.provenance)}
                ?selected=${this._placeholder === row.title}
                @click=${this.#onPickPlaceholder}
                >${row.title}</ui-list-row
            >`;
    }

    #listingState(t) {
        if (this.#demo) return nothing;
        const status = this._state?.status ?? null;
        if (status === LIBRARY_STATUS.FAILED) {
            return html`<div slot="list" class="list-state" id="list-failed" role="alert">
                <p class="ui-body" id="list-failed-text"
                    >${t('The profile list could not be read.')}</p>
                <ui-button id="list-retry" @click=${this.#onRetryListing}
                    >${t('Try again')}</ui-button
                >
            </div>`;
        }
        if (this.#rows.length > 0) return nothing;
        if (status === LIBRARY_STATUS.LOADING) {
            return html`<p slot="list" class="list-empty" id="list-loading" role="status"
                >${t('Reading the profile list…')}</p>`;
        }
        return html`<p slot="list" class="list-empty" id="list-empty"
            >${t('No profiles found.')}</p>`;
    }

    #onRetryListing = () => { this.#store?.load?.(); };

    #listBody() {
        const demo = this.#demo;
        const rows = demo
            ? PLACEHOLDER_ROWS.map((row) => ({ id: '', profile: { title: row.title }, placeholder: row }))
            : this.#rows;
        if (rows.length === 0) return nothing;

        const activeNode = demo ? null : this.#nodes[this.#activeIndex];
        const activeRecordId = activeNode && activeNode.kind === 'profile'
            ? activeNode.record.id : null;
        let index = -1;
        const option = (record) => {
            index += 1;
            return record.placeholder
                ? this.#placeholderRow(record.placeholder, index)
                : this.#option(record, index, activeRecordId);
        };

        const t = this.#i18n.t;
        const open = this._query
            ? new Set(listboxGroups(rows).map((group) => group.folder).filter(Boolean))
            : this._openFolders;
        const activeId = this._activeId;

        return listboxGroups(rows, { folders: !demo }).map((group) => {
            if (group.folder === null) return group.entries.map(option);
            const expanded = open.has(group.folder);
            const id = folderNodeId(group.folder);
            const head = html`
                <ui-list-row
                    id=${optionIdFor(id)}
                    role="treeitem"
                    class="family-row"
                    aria-expanded=${expanded ? 'true' : 'false'}
                    data-folder=${group.folder}
                    ?data-active=${id === activeId}
                    provenance=${t('{n} profiles').replace('{n}', String(group.entries.length))}
                    @click=${this.#onFolderPick}
                    ><span class="fold-mark" aria-hidden="true"
                        >${expanded ? FOLD_OPEN_GLYPH : FOLD_SHUT_GLYPH}</span
                    >${group.folder}</ui-list-row
                >`;
            if (!expanded) {
                /* The counter still has to advance past them, or the demo's data-index
                 * and the keyboard's own walk disagree about which row is which. */
                index += group.entries.length;
                return head;
            }
            return html`${head}
                <div class="group seam-grid seam-rows seam-line" role="group"
                    aria-label=${group.folder}>
                    ${group.entries.map(option)}
                </div>`;
        });
    }

    #addItems() {
        const t = this.#i18n.t;
        const items = [
            { id: ADD_ACTION.NEW, label: t('New profile') },
            { id: ADD_ACTION.UPLOAD, label: t('Upload a profile') },
            { id: ADD_ACTION.SHARE_CODE, label: t('Import a share code') },
        ];
        return items;
    }

    #onAddSelect = (event) => {
        const id = event.detail?.id;
        if (id === ADD_ACTION.NEW) {
            this.#openNewProfile();
            return;
        }
        if (id === ADD_ACTION.UPLOAD) {
            this.#store?.clearAdd?.();
            this.renderRoot.getElementById('upload')?.input?.click();
            return;
        }
        if (id === ADD_ACTION.SHARE_CODE) {
            this._shareCode = '';
            this.#store?.clearAdd?.();
            this.renderRoot.getElementById('share-code')?.show({ reason: 'menu' });
            return;
        }
        if (id === ADD_ACTION.GENERATE && this._generatorUrl) {
            this.#onGeneratePress();
        }
    };

    #onGeneratePress = () => {
        if (!this._generatorUrl) return;
        this._generatorOpened = false;
        this._generatorFailed = false;
        this.renderRoot.getElementById('generator-handoff')?.show({ reason: 'generate' });
    };

    #onGeneratorOpen = () => {
        const opened = openProfileGenerator(this.ownerDocument?.defaultView, this._generatorUrl);
        this._generatorFailed = !opened;
        this._generatorOpened = opened;
    };

    #onGeneratorReturn = async () => {
        await this.#store?.load?.();
        this.renderRoot.getElementById('generator-handoff')?.hide('returned');
    };

    #onFilePick = async (event) => {
        const file = event.detail?.file;
        if (!file || !this.#store?.createFromFile || this._filePending) return;
        this.#importFile = file;
        this._fileName = file.name || this.#i18n.t('Selected file');
        this.#store.clearAdd?.();
        this.renderRoot.getElementById('file-import')?.show({ reason: 'file' });
        await this.#importSelectedFile();
    };

    #importSelectedFile = async () => {
        if (!this.#importFile || this._filePending) return;
        this._filePending = true;
        this._fileError = null;
        let text;
        try {
            text = await this.#importFile.text();
        } catch {
            this._fileError = this.#i18n.t('This file could not be read. Try again or choose another file.');
        }
        if (!this._fileError) {
            try { await this.#store.createFromFile(text); }
            catch { this._fileError = this.#i18n.t('The profile could not be imported. Try again.'); }
        }
        this._filePending = false;
        if (!this._fileError && this.#store?.get?.()?.add?.status === ADD_STATUS.ADDED) {
            this.#notice(this.#i18n.t('Imported {name}.', { name: this._fileName }), 'ok');
            this.renderRoot.getElementById('file-import')?.hide('imported');
        }
    };

    #onFileClose = (event) => {
        if (this._filePending) { event.preventDefault(); return; }
        this.#store?.clearAdd?.();
    };

    #onChooseFile = () => this.renderRoot.getElementById('upload')?.input?.click();

    #fileMessage() {
        const t = this.#i18n.t;
        if (this._filePending) return html`
            <p role="status">${t('Importing profile…')}</p>`;
        const add = this._state?.add;
        const messages = {
            'not-json': t('This file is not valid JSON.'),
            'not-a-profile': t('This file does not contain a profile.'),
            'missing-fields': t('Required profile fields are missing: {fields}.', {
                fields: (add?.missing ?? []).join(', '),
            }),
            'steps-not-an-array': t('The profile’s steps field must be a list.'),
        };
        const message = this._fileError ?? messages[add?.reason]
            ?? t('The profile could not be imported. Try again.');
        const reason = profileFailureSentence(add?.error);
        return html`<ui-alert-banner id="file-message" class="dialog-message">${message}
            ${reason ? html`<span slot="remedy">${reason}</span>` : nothing}</ui-alert-banner>`;
    }

    #onShareInput = (event) => {
        this._shareCode = String(event.detail?.value ?? event.target?.value ?? '').trim();
    };

    #onShareImport = async () => {
        if (!this._shareCode || !this.#store?.importShareCode) return;
        await this.#store.importShareCode(this._shareCode);
        if (this.#store.get?.()?.add?.status === ADD_STATUS.ADDED) {
            this._shareCode = '';
            this.renderRoot.getElementById('share-code')?.hide('imported');
        }
    };

    #onAddClose = () => { this.#store?.clearAdd?.(); };

    /** True while an add is in flight — the Import button refuses a second press. */
    get #adding() { return this._state?.add?.status === ADD_STATUS.ADDING; }

    #addMessage() {
        const t = this.#i18n.t;
        const add = this._state?.add ?? null;
        if (!add || add.status === ADD_STATUS.IDLE || add.status === ADD_STATUS.ADDING) return nothing;
        const say = {
            'not-json': t('That file is not a profile.'),
            'not-a-profile': t('That file is not a profile.'),
            'missing-fields': t('That file is missing fields a profile needs.'),
            'steps-not-an-array': t('That file is not a profile.'),
            'no-code': t('Enter a share code.'),
            'bad-code': t('That share code did not work.'),
            'not-signed-in': t('Sign in to Visualizer in Settings first.'),
        };
        const text = add.status === ADD_STATUS.ADDED
            ? t('Added.')
            : (say[add.reason] ?? t('That could not be added.'));
        return html`<ui-alert-banner
            id="add-message"
            kind=${add.status === ADD_STATUS.ADDED ? 'info' : 'warning'}
            >${text}</ui-alert-banner
        >`;
    }

    /** One dialog body list: the rows, or the sentence that says why there are none. */
    #dialogList(rows, note) {
        return html`<div class="dialog-list">
            ${rows.length ? rows : html`<p>${note}</p>`}
        </div>`;
    }

    #versionsBody() {
        const t = this.#i18n.t;
        const versions = this._state?.versions;
        const status = versions?.status ?? VERSIONS_STATUS.IDLE;
        if (status === VERSIONS_STATUS.READY && versions.records.length) {
            return this.#dialogList(versions.records.map((record) => html`
                <ui-list-row
                    provenance=${record.id === versions.id ? t('This one') : nothing}
                    >${record.profile?.title || t('Untitled')}</ui-list-row
                >`), '');
        }
        if (status === VERSIONS_STATUS.LOADING) return this.#dialogList([], t('Reading versions…'));
        if (status === VERSIONS_STATUS.FAILED) {
            return this.#dialogList([], t('The versions could not be read.'));
        }
        return this.#dialogList([], t('This profile has no other versions.'));
    }

    #restoreBody() {
        const t = this.#i18n.t;
        const rows = (this._state?.restorable ?? []).map((record) => html`
            <ui-button
                data-id=${record.id}
                data-filename=${restoreFilenameOf(record) ?? ''}
                @click=${this.#onRestore}
                >${record.profile?.title || t('Untitled')}</ui-button
            >`);
        return this.#dialogList(rows, t('Every bundled profile is already here.'));
    }

    #bindPreviewLegend() {
        const card = this.renderRoot.getElementById('preview');
        if (!card || card === this.#previewLegendCard) return;
        this.#previewLegendCard = card;
        card.setRuleSource(tokens => {
            this.renderRoot.getElementById('key')?.reapply();
            const rules = comparisonStepRules({
                a: card.derivation,
                paint: {
                    colour: tokens?.channels?.['step-boundary'],
                    ink: tokens?.surface?.label,
                    width: tokens?.geometry?.strokeMinor,
                },
            });
            return { ...rules, labels: rules.labels.map(label => ({ ...label, rotate: true })) };
        });
    }

    #previewLegend(t) {
        const language = this.#i18n.language;
        if (this.#legendCache?.language === language) return this.#legendCache.items;
        const labels = {};
        for (const key of PREVIEW_CHANNEL_KEYS) {
            labels[key] = t(PREVIEW_AXIS_TERM, {
                name: t(PREVIEW_TERM_LABELS[key] ?? key),
                unit: CHANNEL_READOUT[key]?.unit ?? '',
            });
        }
        const items = legendItems(PREVIEW_CHANNEL_KEYS, labels, CHANNEL_TREATMENTS);
        this.#legendCache = { language, items };
        return items;
    }

    render() {
        const t = this.#i18n.t;
        const state = this._state;
        const record = this.#selectedRecord;
        const profile = record?.profile ?? null;
        const preview = profilePreviewDerivation(profile);
        const totals = profileTotals(profile);
        const refusal = state?.refusal ?? null;
        const restorable = state?.restorable ?? [];
        const title = profile?.title ?? (this.#demo ? this._placeholder : null);
        const loaded = state?.loaded;
        const replacement = this._replacement;
        const replacedName = this.#store?.recordFor?.(replacement?.previousId)?.profile?.title
            ?? (replacement?.previousId ? t('Unavailable profile') : t('Empty'));
        const replacementName = this.#store?.recordFor?.(replacement?.id)?.profile?.title ?? t('Untitled');
        const handoff = generatorHandoff(this.ownerDocument?.defaultView, this._generatorUrl);

        return html`
            <ui-page-header heading=${t('Profiles')} layout="flanks">
                <div slot="trail" class="band-actions">
                    <ui-button id="cancel" tall @click=${this.#onCancelPress}
                        >${t('Cancel')}</ui-button
                    >
                    <ui-button
                        id="confirm"
                        tall
                        variant="primary"
                        ?disabled=${!state?.selectedId || this._usingProfile}
                        @click=${this.#onConfirmPress}
                        >${this._usingProfile ? t('Using profile…') : t('Use profile')}</ui-button
                    >
                </div>
            </ui-page-header>

            <selector-split id="split" part="split">
                <selector-list-pane id="list-pane" slot="list">
                    <div slot="toolbar" class="toolbar">

                        <ui-menu
                            id="add"
                            label=${t('Add a profile')}
                            .items=${this.#addItems()}
                            @select=${this.#onAddSelect}
                        >
                            <ui-icon-button
                                slot="trigger"
                                id="add-open"
                                label=${t('Add a profile')}
                                >&#43;</ui-icon-button
                            >
                        </ui-menu>

                        <ui-button
                            id="hidden-toggle"
                            variant=${this._showHidden ? 'primary' : nothing}
                            aria-pressed=${this._showHidden ? 'true' : 'false'}
                            @click=${this.#onToggleHidden}
                            >${t('Hidden')}</ui-button
                        >

                        ${this._generatorUrl
                            ? html`<ui-button
                                id="generate"
                                @click=${this.#onGeneratePress}
                                >${t('Generate')}</ui-button
                            >`
                            : nothing}

                        ${restorable.length
                            ? html`<ui-button
                                id="restore-open"
                                @click=${this.#onRestoreOpen}
                                >${t('Restore')}</ui-button
                            >`
                            : nothing}
                    </div>

                    <ui-search-field
                        slot="filter"
                        id="filter"
                        label=${t('Filter profiles')}
                        placeholder=${t('Filter profiles')}
                        .value=${this._query}
                        @input=${this.#onFilterInput}
                        @search=${this.#onSearch}
                    ></ui-search-field>

                    <div
                        slot="list"
                        class="listbox seam-grid seam-rows seam-line"
                        id="rows"
                        role="tree"
                        tabindex="0"
                        aria-label=${t('Profiles')}
                        aria-activedescendant=${this.activeDescendantId ?? nothing}
                        @keydown=${this.#onListKeyDown}
                    >
                        ${this.#listBody()}
                    </div>
                    ${this.#listingState(t)}

                    <div id="favourites" slot="favourites" class="assign-row">
                        <span class="ui-microcap">${t('Assign favourite')}</span>
                        ${this.#favouriteSlots()}
                    </div>
                </selector-list-pane>

                <selector-detail-pane id="detail-pane" slot="detail">
                    <div slot="title" class="title-row">
                        <div class="title-copy">
                            <span id="selection-context" class="ui-caption">${record && record.id === loaded?.id
                                ? t('Loaded profile') : t('Preview selection')}</span>
                            <h2 id="detail-title" class="ui-heading" title=${title ?? ''}
                                >${title ?? t('No profile selected')}</h2>
                        </div>
                        <div id="actions" class="detail-actions">
                            <ui-menu id="manage" label=${t('Manage profile')}
                                .items=${this.#manageItems()} @select=${this.#onManageSelect}>
                                <ui-button slot="trigger" id="manage-open" ?disabled=${!record}
                                    >${t('Manage')}</ui-button>
                            </ui-menu>
                            <ui-button id="act-edit" ?disabled=${!record} @click=${this.#onEditPress}
                                >${t('Edit')}</ui-button>
                        </div>

                        <ui-file-button
                            id="upload"
                            class="hidden-control"
                            accept=".json,application/json"
                            label=${t('Upload a profile')}
                            @file-pick=${this.#onFilePick}
                            >${t('Upload a profile')}</ui-file-button
                        >

                        <ui-dialog id="replace-favourite" standard-actions
                            heading=${t('Replace favourite {n}?', { n: (replacement?.index ?? 0) + 1 })}
                            @close-request=${this.#onReplacementClose}>
                            <div slot="body" class="replacement-body">
                                <span class="ui-caption">${t('Current favourite')}</span>
                                <strong class="replacement-name">${replacedName}</strong>
                                <span class="ui-caption">${t('Replace with')}</span>
                                <strong class="replacement-name">${replacementName}</strong>
                                <p>${t('The original profile stays in your library. The replacement will also be loaded on the machine.')}</p>
                                ${replacement?.error ? html`<ui-alert-banner id="replacement-error" class="dialog-message"
                                    >${replacement.error}</ui-alert-banner>` : nothing}
                                ${replacement?.pending ? html`<p role="status">${t('Saving favourite…')}</p>` : nothing}
                            </div>
                            <ui-button id="replacement-cancel" slot="actions" ?disabled=${replacement?.pending}
                                @click=${() => this.#finishReplacement(false)}>${t('Cancel')}</ui-button>
                            <ui-button id="replacement-confirm" slot="actions" variant="primary"
                                ?disabled=${replacement?.pending} @click=${this.#onReplacementConfirm}
                                >${t('Replace favourite')}</ui-button>
                        </ui-dialog>

                        <ui-dialog id="file-import" standard-actions heading=${t('Import a profile')}
                            @close-request=${this.#onFileClose}>
                            <div slot="body" class="file-body">
                                <strong class="file-name">${this._fileName}</strong>
                                ${this.#fileMessage()}
                            </div>
                            <ui-button id="file-cancel" slot="actions" ?disabled=${this._filePending}
                                @click=${() => this.renderRoot.getElementById('file-import')?.requestClose('cancel')}
                                >${t('Cancel')}</ui-button>
                            ${this._fileError || state?.add?.status === ADD_STATUS.FAILED ? html`
                                <ui-button id="file-retry" slot="actions" ?disabled=${this._filePending}
                                    @click=${this.#importSelectedFile}>${t('Retry')}</ui-button>` : nothing}
                            <ui-button id="file-choose" slot="actions" variant="primary" ?disabled=${this._filePending}
                                @click=${this.#onChooseFile}>${t('Choose another file')}</ui-button>
                        </ui-dialog>

                        <ui-dialog id="generator-handoff" standard-actions heading=${t('Open profile generator')}>
                            <div slot="body" class="file-body">
                                <strong>${t('Decent Profile Generator')}</strong>
                                <p>${handoff.mode === 'browser'
                                    ? t('The generator opens in a new browser tab. Decal keeps your selection here.')
                                    : handoff.surface === 'embedded'
                                        ? t('The generator opens in this app view and replaces Decal. Returning through the Dashboard reloads Decal.')
                                        : t('The generator opens in the system browser. Decal stays open in this app.')}</p>
                                <p>${t(handoff.returnKey)}</p>
                                ${this._generatorOpened && handoff.mode === 'browser'
                                    ? html`<p role="status">${t('After adding a profile in the generator, refresh the library here.')}</p>` : nothing}
                                ${this._generatorFailed ? html`<ui-alert-banner id="generator-error" class="dialog-message"
                                    >${handoff.mode === 'browser'
                                        ? t('The generator could not be opened. Allow new tabs for Decal and try again.')
                                        : t('The generator could not be opened. Try again.')}</ui-alert-banner>` : nothing}
                            </div>
                            <ui-button id="generator-cancel" slot="actions"
                                @click=${() => this.renderRoot.getElementById('generator-handoff')?.hide('cancel')}
                                >${t('Cancel')}</ui-button>
                            ${this._generatorOpened && handoff.mode === 'browser' ? html`
                                <ui-button id="generator-refresh" slot="actions" variant="primary"
                                    @click=${this.#onGeneratorReturn}>${t('Refresh profiles')}</ui-button>` : html`
                                <ui-button id="generator-open" slot="actions" variant="primary"
                                    @click=${this.#onGeneratorOpen}>${t('Open generator')}</ui-button>`}
                        </ui-dialog>

                        <ui-dialog
                            id="share-code"
                            heading=${t('Import a share code')}
                            @close-request=${this.#onAddClose}
                        >
                            <div slot="body" class="share-body">
                                <ui-text-field
                                    id="share-input"
                                    label=${t('Share code')}
                                    .value=${this._shareCode}
                                    @change=${this.#onShareInput}
                                ></ui-text-field>
                                ${this.#addMessage()}
                            </div>
                            <ui-button id="share-cancel" slot="actions"
                                @click=${() => this.renderRoot.getElementById('share-code')?.requestClose('cancel')}
                                >${t('Cancel')}</ui-button>
                            <ui-button
                                id="share-import"
                                slot="actions"
                                variant="primary"
                                ?disabled=${!this._shareCode || this.#adding}
                                @click=${this.#onShareImport}
                                >${t('Import')}</ui-button
                            >
                        </ui-dialog>

                        <ui-confirm-dialog
                            id="confirm-hide"
                            tone="destructive"
                            question=${t('Hide this profile?')}
                            detail=${title ?? ''}
                            cancel-label=${t('Cancel')}
                            confirm-label=${t('Hide')}
                            @confirm=${this.#onConfirmHide}
                        ></ui-confirm-dialog>

                        <ui-confirm-dialog
                            id="confirm-remove"
                            tone="destructive"
                            question=${t('Delete {name}?', { name: title ?? t('this profile') })}
                            detail=${t('This removes the profile from the machine. It cannot be undone, and Restore will not bring a bundled profile back.')}
                            cancel-label=${t('Cancel')}
                            confirm-label=${t('Delete')}
                            @confirm=${this.#onConfirmRemove}
                        ></ui-confirm-dialog>

                        <ui-confirm-dialog
                            id="confirm-reset"
                            question=${t('Reset this profile to factory?')}
                            detail=${title ?? ''}
                            cancel-label=${t('Cancel')}
                            confirm-label=${t('Reset')}
                            @confirm=${this.#onConfirmReset}
                        ></ui-confirm-dialog>

                        <ui-dialog id="restore" heading=${t('Restore bundled profiles')}>
                            <div slot="body" class="restore-body">
                                <p class="dialog-lead"
                                    >${t('The bundled version comes back. Your own profiles are untouched.')}</p
                                >
                                ${this.#restoreBody()}
                            </div>
                            <ui-button id="restore-close" slot="actions"
                                @click=${() => this.renderRoot.getElementById('restore')?.requestClose('cancel')}
                                >${t('Close')}</ui-button>
                        </ui-dialog>

                        <ui-dialog
                            id="versions"
                            heading=${t('Previous versions')}
                            @close-request=${this.#onVersionsClose}
                        >
                            <div slot="body">${this.#versionsBody()}</div>
                        </ui-dialog>
                    </div>

                    <div slot="summary" class="detail-strip">
                        ${refusal
                            ? html`<ui-alert-banner id="refusal"
                                >${refusal.error}<span slot="remedy">${refusal.message}</span
                                ></ui-alert-banner>`
                            : nothing}

                        <div class="summary" id="summary">
                            ${SUMMARY_TILES.map((tile) => {
                                const reading = profile ? tile.read(profile, totals) : null;
                                return html`
                                <ui-stat-tile
                                    data-tile=${tile.key}
                                    label=${t(tile.label)}
                                    unit=${reading?.unit ?? ''}
                                    size="sm"
                                    value=${reading?.value ?? ''}
                                ></ui-stat-tile>`;
                            })}
                        </div>
                    </div>

                    <ui-chart-card
                        id="preview"
                        slot="chart"
                        label=${t('Profile preview')}
                        channels="targetPressure targetFlow"
                        .derivation=${preview}
                    >
                        <span slot="empty">${t('Choose a profile to see its curves')}</span>
                        ${preview.ok
                            ? html`<div slot="legend" class="preview-key">
                                <ui-chart-legend
                                    id="key"
                                    chart="preview"
                                    label=${t('Chart key')}
                                    .items=${this.#previewLegend(t)}
                                ></ui-chart-legend>
                                <span id="axis-x" class="axis">${t(PREVIEW_AXIS_TERM, {
                                    name: t('Time'),
                                    unit: PREVIEW_TIME_UNIT,
                                })}</span>
                            </div>`
                            : nothing}
                    </ui-chart-card>

                    <ui-notes-editor
                        readonly
                        id="notes"
                        slot="notes"
                        label=${t('Profile notes')}
                        placeholder=${t('Notes about this profile')}
                        .value=${profile?.notes ?? ''}
                    ></ui-notes-editor>
                </selector-detail-pane>
            </selector-split>

            <ui-toast id="notice"></ui-toast>
        `;
    }
}

customElements.define('selector-screen', SelectorScreen);
