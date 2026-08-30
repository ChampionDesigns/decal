/**
 * <selector-screen>, the Profile selector.
 */

import { css, html, nothing } from 'lit';

import { UiElement, focusRing } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import { profilePreviewDerivation } from 'src/lib/profile-preview.js';
import { newProfile } from 'src/data/rea-profile.js';
import { NEW_STEP_NAME_KEY } from 'src/lib/profile-modes.js';
import { formatCeilingDuration, profileTotals } from 'src/lib/profile-totals.js';
import { ARM_STATUS } from 'src/stores/profile-arm-store.js';
import {
    matchProfiles,
    restoreFilenameOf,
    ADD_STATUS,
    LIBRARY_STATUS,
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

export class SelectorScreen extends UiElement {
    static properties = {
        boot: { attribute: false },

        /** The profile the machine has loaded, by id — settable for a demo or a test. */
        loadedProfileId: { type: String, attribute: 'loaded-profile-id' },

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
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--ui-space-6);
            padding-block-start: var(--ui-space-5);
            min-inline-size: 0;
        }

        .assign-row .ui-microcap {
            flex: 0 0 auto;
            max-inline-size: 10ch;
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

    constructor() {
        super();
        this.boot = null;
        this.loadedProfileId = '';
        this._state = null;
        this._showHidden = false;
        this._query = '';
        this._activeId = null;
        this._openFolders = new Set();
        this._shareCode = '';
        this._generatorUrl = null;
        this._placeholder = null;
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
        const storage = this.boot?.storage;
        if (!storage || typeof storage.get !== 'function') return;
        const held = await storage.get('profileFoldersOpen').catch(() => null);
        if (!Array.isArray(held) || !held.length) return;
        this._openFolders = new Set(held.filter((name) => typeof name === 'string'));
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.#unwatch?.();
        this.#unwatch = null;
        this.#dropPendingAssignment();
        this.#store = null;
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

    #attach() {
        if (this.#store || !this.isConnected || !this.boot?.library) return;
        this.#store = this.boot.library;
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
            const name = entry?.name ?? entry?.label ?? '';
            return html`<ui-favourite-slot
                data-slot=${number}
                index=${number}
                ?filled=${Boolean(held)}
                ?selected=${Boolean(held) && held === selected}
                label=${name
                    ? t('Favourite {n}: {name}', { n: number, name })
                    : t('Favourite {n}, empty', { n: number })}
                @click=${this.#onFavouriteSlot}
            ></ui-favourite-slot>`;
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

    async #assign(index, id, { load = true } = {}) {
        const store = this.#store;
        if (!store || typeof store.setFavourite !== 'function') return false;
        const t = this.#i18n.t;
        const held = store.favouriteSlotHolding?.(id) ?? null;
        if (held !== null) {
            const title = store.recordFor?.(id)?.profile?.title;
            this.#notice(
                title
                    ? t('“{title}” is already on favourite {n}', { title, n: held + 1 })
                    : t('That profile is already on favourite {n}', { n: held + 1 }),
                'danger',
            );
            return false;
        }
        return Promise.resolve(store.setFavourite(index, id)).then(async () => {
            const title = store.recordFor?.(id)?.profile?.title;
            if (title) this.#notice(t('Favourite {n}: {title}', { n: index + 1, title }), 'ok');
            if (!load) return true;
            const armed = await store.arm?.(id);
            if (armed && armed.status === ARM_STATUS.REFUSED) {
                this.#notice(t('The machine refused this profile.'), 'danger');
            } else if (armed && armed.status !== ARM_STATUS.ARMED) {
                this.#notice(t('The machine has not been given this profile yet'), 'warn');
            }
            return true;
        }).catch(() => false);
    }

    /** Put one line on the screen's toast, if the toast has rendered yet. */
    #notice(message, tone) {
        this.renderRoot?.getElementById('notice')?.show?.(message, { tone, duration: 3000 });
    }

    #onConfirmHide = () => {
        const id = this._state?.selectedId;
        if (!id || !this.#store || typeof this.#store.hide !== 'function') return;
        Promise.resolve(this.#store.hide(id)).catch(() => {});
    };

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
        Promise.resolve(this.#store.purge(id)).catch(() => {});
    };

    /** The one profile, back to its bundle. The store owns the filename and the re-read. */
    #onConfirmReset = () => {
        const id = this._state?.selectedId;
        if (!id || typeof this.#store?.restoreToFactory !== 'function') return;
        Promise.resolve(this.#store.restoreToFactory(id)).catch(() => {});
    };

    #onEditPress = () => { this.#openEditor(); };

    #onDeletePress = () => {
        if (!this._state?.selectedId) return;
        this.renderRoot.getElementById('confirm-remove')?.show({ reason: 'actions' });
    };

    #openNewProfile() {
        if (!this.boot?.profileEditor) return;
        const t = this.#i18n.t;
        this.boot.profileEditor.open({
            id: null,
            profile: newProfile({
                title: t('New profile'),
                stepName: t(NEW_STEP_NAME_KEY),
            }),
        });
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { route: 'editor', invoker: 'add-menu' },
            bubbles: true,
            composed: true,
        }));
    }

    #openEditor() {
        const record = this.#selectedRecord;
        if (!record || !this.boot?.profileEditor) return;
        this.boot.profileEditor.open(record);
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { route: 'editor', invoker: 'detail-actions' },
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
            <!-- A SPAN, NOT A BUTTON, AND THAT IS THE P12 LAW RATHER THAN AN OVERSIGHT.
                 A <button> inside a role="tree" is reported as a button child of the
                 tree, and 78 of them is the exact defect this screen already paid for
                 once: measured with CDP Accessibility.getFullAXTree, 78 operable "More
                 actions" nodes, a listbox with 79 tab stops, and every option's name
                 reading "Preinfuse then 45ml of water More actions".

                 aria-hidden AND tabindex=-1 ON A ui-icon-button WERE NOT ENOUGH: the
                 component renders its own <button> inside its shadow root, and the P12
                 probe walks shadow roots and reports focusables. MEASURED after that
                 attempt: 78 (focusable:ui-icon-button) and 83 button, unchanged. The only
                 element that is neither is one that was never a button.

                 ui-menu TAKES ITS TRIGGER EVENTS ON THE SLOT (ui-menu.js:696), so a span
                 opens the menu exactly as the button did. The pointer gesture Ben asked
                 for ("add the …") is unaffected.

                 THE KEYBOARD ROUTE IS OWED. Assign, Edit and Versions are reachable
                 another way; REMOVE FOR GOOD IS NOT, and that is an open item rather than
                 a settled one.

                 THE NAME IS HERE NOW, AND IT COST A CHANGE IN ui-list-row TO MAKE IT
                 SAFE (audit F-016 #8, closed 29 August 2026 after being attempted and
                 parked earlier the same night). Wave 1 rowed this span as one of sixteen
                 controls whose accessible name is the empty string, and said why: the
                 element carrying the glyph was itself aria-hidden, so the element that
                 TAKES THE PRESS was hidden along with the decoration.

                 THE OBVIOUS FIX ON ITS OWN COSTS MORE THAN IT BUYS, and that was
                 measured before this line was written. Moving aria-hidden onto an inner
                 glyph span and putting an aria-label on this one does give the opener a
                 name -- and Chrome then folded that name into the ROW's, because a
                 treeitem with no explicit label is named from its contents and a
                 labelled descendant is part of them. Measured with
                 Accessibility.getFullAXTree, every row's name became

                     "Alpha bloom Loaded More actions for Alpha bloom"

                 which is the defect the paragraph above this one is about, in a smaller
                 form.

                 WHAT CLOSED IT is the second of the two routes that note named:
                 ui-list-row now composes its OWN aria-label, from its own content, for
                 any row whose list has given it a role. Name-from-content therefore never
                 runs on these rows and a labelled descendant cannot enter their names --
                 so this span may be named, and is. The row's name is unchanged
                 ("Alpha bloom Loaded"), which is asserted in ui-list-row's own suite
                 against the real AX tree rather than argued here.

                 THE GLYPH KEEPS aria-hidden, ON ITS OWN SPAN. The decoration is not the
                 name; without this the opener would be announced as "More actions for
                 Alpha bloom ⋯". The role walk and the tab-stop count are unaffected: a
                 span with an aria-label and no role and no tabindex is reported as
                 nothing by P12's walk, which is why role="button" was never a candidate.

                 THE KEYBOARD ROUTE IS OPEN NO LONGER — Ben's decision D21, 30 August
                 2026, and the ROVING TABINDEX is what makes it compatible with everything
                 above. Read the two numbers together: P12's complaint was SEVENTY-EIGHT
                 operable nodes and SEVENTY-NINE tab stops, measured; this adds exactly
                 ONE, on the row the tree's own aria-activedescendant already names, and
                 it moves with the arrow keys. Tab from the listing reaches the opener for
                 the row you are standing on and nothing else — which is the shape the
                 APG's own "actions in a composite widget" advice describes, and the
                 opposite of a tab stop per row.

                 role="button" COMES WITH THE TABINDEX AND NOT BEFORE IT. An unlabelled
                 focusable generic is worse than either end state: a caret lands on
                 something a screen reader cannot classify. The role is written only where
                 the element is actually reachable, so the 77 openers that are not on the
                 active row stay exactly what the F-016 #8 note above describes — a named
                 span with no role and no tabindex, reported as nothing by a role walk.

                 ENTER AND SPACE ARE HANDLED HERE, ARROWS BY THE COMPONENT. ui-menu's
                 #onTriggerKeydown takes ArrowDown/ArrowUp on the slot and says in its own
                 words why Enter and Space are absent from it: "the trigger is a real
                 button, its native click opens the menu through #onTriggerClick". A span
                 is not, and no native click arrives — so the two keys are supplied by the
                 consumer that chose the span, rather than by widening the component for
                 everybody. show() is its public door and it remembers the opener as the
                 focus to return to, so the caret comes back here when the menu closes.

                 aria-haspopup AND aria-expanded ARE NOT WRITTEN HERE: ui-menu's
                 #syncTrigger puts both on whatever is slotted, and keeps aria-expanded in
                 step with the open state. A second copy would be a second owner. -->
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
            this.#openEditor();
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
        if (!this._state?.selectedId) return;
        this.#store.clearRefusal();
        Promise.resolve(this.#onConfirmChosen()).catch(() => {});
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
        if (id) this.#store.restoreToFactory(id);
    };

    #onVersionsClose = () => { this.#store?.clearVersions(); };

    #onRestoreOpen = () => {
        this.renderRoot.getElementById('restore')?.show({ reason: 'toolbar' });
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
            if (globalThis.location) globalThis.location.href = this._generatorUrl;
        }
    };

    #onGeneratePress = () => {
        if (this._generatorUrl && globalThis.location) globalThis.location.href = this._generatorUrl;
    };

    #onFilePick = async (event) => {
        const file = event.detail?.file;
        if (!file || !this.#store?.createFromFile) return;
        let text = '';
        try {
            text = await file.text();
        } catch {
            /* A file the tablet would not read. The store's own `not-json` refusal is the
             * same sentence a person needs, and routing it through there keeps one owner
             * of what an add can answer. */
            text = '';
        }
        await this.#store.createFromFile(text);
        const state = this.#store.get?.();
        /* THE DIALOG IS ONLY OPENED TO SAY NO. A file that landed needs no surface — the
         * list it joined is the answer, and it is already on screen. */
        if (state?.add?.status === ADD_STATUS.REFUSED || state?.add?.status === ADD_STATUS.FAILED) {
            this.renderRoot.getElementById('share-code')?.show({ reason: 'refusal' });
        }
    };

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

    render() {
        const t = this.#i18n.t;
        const state = this._state;
        const record = this.#selectedRecord;
        const profile = record?.profile ?? null;
        const preview = profilePreviewDerivation(profile);
        const totals = profileTotals(profile);
        const refusal = state?.refusal ?? null;
        const rows = this.#rows;
        const restorable = state?.restorable ?? [];
        const title = profile?.title ?? (this.#demo ? this._placeholder : null);
        const loading = state?.status === LIBRARY_STATUS.LOADING;

        return html`
            <ui-page-header heading=${t('Profiles')} layout="flanks">
                <div slot="trail" class="band-actions">
                    <!-- BOTH ARE TALL, and the band already said so (parity surface 5;
                         parity surface 1 wrote the same two words on live-screen.js and
                         gave the whole argument at its ACTIONS block). --ui-band-h is
                         calc((--ui-control-lg + 2 * --ui-band-inset) * --ui-density) =
                         118 at density 1, and the CONTROL is deliberately not multiplied
                         ("ergonomics is physical", ui-page-header.js:185), so a 64px
                         control in this band leaves 27px of dead space above and below
                         itself and contradicts the derivation the band's own height comes
                         from. <ui-page-header> renders ITS OWN commit cluster tall
                         (ui-page-header.js:551-563, the Settings screen's Cancel/Save);
                         the Live band is tall; this screen supplied the trail slot itself
                         and was the last one in the tree still drawing 64. The oracle
                         agrees rather than merely permitting it:
                           ORACLE profile-selector #cancel-profile-btn [i=4] height =
                           82px, min-height = 82px, rect=[1602,18,108,82];
                           #confirm-profile-btn [i=5] the same 82, rect=[1722,18,168,82];
                           the band [i=2] min-height = 118px. 82 + 2*18 = 118 exactly,
                           which is why both sit at y=18 and not at y=27.
                         No geometry is written here and NO BACKTICK either (CONVENTIONS
                         §9, and this comment cost one): the tall attribute IS
                         --ui-control-lg, by name, on the component that already had it. -->
                    <ui-button id="cancel" tall @click=${this.#onCancelPress}
                        >${t('Cancel')}</ui-button
                    >
                    <ui-button
                        id="confirm"
                        tall
                        variant="primary"
                        ?disabled=${!state?.selectedId}
                        @click=${this.#onConfirmPress}
                        >${t('Confirm')}</ui-button
                    >
                </div>
            </ui-page-header>

            <selector-split id="split" part="split">
                <selector-list-pane id="list-pane" slot="list">
                    <div slot="toolbar" class="toolbar">
                        <!-- NO CAPTION. Ben, 25 August 2026: "We can remove 'ALL PROFILES'
                             label." It said what the screen already says — its own title is
                             "Profiles" and the list under it is the profiles — and it was
                             what pushed the three controls to the right-hand end of the
                             band. With it gone they start where Slate's do.

                             THE COUNT WENT WITH IT and that is the one thing lost: the
                             caption carried "93". Slate has no count either. -->

                        <!-- ADD A PROFILE (Ben, 24 Aug 2026: "We should add Upload,
                             import and the generate one"). Three doors behind one menu,
                             because they are three ways to do one thing and a band with
                             three buttons on it says they are three things.
                             THE GENERATOR ROW IS ABSENT until its plugin answers loaded —
                             a link to a plugin that is not installed is a dead affordance,
                             which is the old skin's own rule for the same control. -->
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

                        <!-- THE HIDDEN TOGGLE. Ben, 25 August 2026: "Add the hidden
                             toggle." Slate's #view_profile, MEASURED at 124.8 x 82 with the
                             word "Hidden" beside its glyph.

                             PRESSED IS THE STATE AND aria-pressed IS THE SPELLING, so the
                             control says which set is on screen rather than needing a second
                             label. It is rendered whether or not anything is hidden: unlike
                             the restore icon below it, "nothing is hidden" is an ANSWER this
                             control gives, and a toggle that vanished when the answer was
                             empty could never give it. -->
                        <ui-button
                            id="hidden-toggle"
                            variant=${this._showHidden ? 'primary' : nothing}
                            aria-pressed=${this._showHidden ? 'true' : 'false'}
                            @click=${this.#onToggleHidden}
                            >${t('Hidden')}</ui-button
                        >

                        <!-- GENERATE, WITH ITS NAME ON IT. Ben, 25 August 2026: "Move the
                             +, Hidden, and Generate button to the left, like what slate
                             has" and "The generate button needs to say generate or
                             something, its not clear what the icon does."

                             IT WAS THE FOURTH ROW OF THE + MENU until now, which is why it
                             read as an unlabelled glyph: the glyph beside Hidden was the
                             RESTORE icon, and it is labelled below. Slate carries Generate
                             as its own worded button in this band - profile_selector.html:26,
                             #ai_generate_profile - so this is the parity move as well as
                             the legibility one.

                             STILL GATED ON THE PLUGIN ANSWERING. A link to a plugin that is
                             not installed is a dead affordance, and that rule does not
                             change by moving the control into daylight. -->
                        ${this._generatorUrl
                            ? html`<ui-button
                                id="generate"
                                @click=${this.#onGeneratePress}
                                >${t('Generate')}</ui-button
                            >`
                            : nothing}

                        <!-- D6's ENTRY POINT, NOW WORDED. Ben read its glyph as Generate,
                             which is the strongest evidence a glyph can give that it is not
                             carrying its own meaning. It says Restore now.

                             Rendered only when there is something to restore, because a
                             control that is permanently disabled on a machine nobody has
                             deleted from is a dead affordance (P10's family). The count IS
                             the offer. -->
                        ${restorable.length
                            ? html`<ui-button
                                id="restore-open"
                                @click=${this.#onRestoreOpen}
                                >${t('Restore')}</ui-button
                            >`
                            : nothing}
                    </div>

                    <ui-search-field
                        id="filter"
                        slot="filter"
                        label=${t('Filter profiles')}
                        placeholder=${t('Filter profiles')}
                        .value=${this._query}
                        @input=${this.#onFilterInput}
                        @search=${this.#onSearch}
                    ></ui-search-field>

                    <!-- THE LISTBOX (P12). One tab stop, aria-activedescendant, a keydown
                         handler, and only options and groups inside it.
                         THE SEAM CLASSES ARE ON THE ELEMENT, never restated in a
                         stylesheet: seams.js owns the three declarations and this is the
                         same class list settings-nav-column.js:200 renders on its own
                         rows. See selector-list.js for why the list had no divider at
                         all until parity surface 5. -->
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
                    ${!this.#demo && rows.length === 0 && !loading
                        ? html`<p slot="list" class="list-empty" id="list-empty"
                            >${t('No profiles found.')}</p>`
                        : nothing}

                    <!-- SLATE'S ASSIGN ROW: a cap, then five discs.
                         Ben, 25 August 2026: "Can we use slates assign Favorites row, maybe
                         reduce the height a bit but have the ASSIGN FAVOURITE and the 5
                         round buttons. It looks clean." -->
                    <div id="favourites" slot="favourites" class="assign-row">
                        <span class="ui-microcap">${t('Assign favourite')}</span>
                        ${this.#favouriteSlots()}
                    </div>
                </selector-list-pane>

                <selector-detail-pane id="detail-pane" slot="detail">
                    <div slot="title" class="title-row">
                        <h2 id="detail-title" class="ui-heading"
                            >${title ?? t('No profile selected')}</h2
                        >

                        <!-- THREE BUTTONS, NOT A MENU. Ben, 25 August 2026, on the
                             selector audit's finding 6 ("Three buttons, or one menu"):
                             "Copy slate."

                             SLATE'S OWN THREE, MEASURED on its running selector: Delete
                             102.3 x 82 in red ink on a translucent red ground, Reset, and
                             Edit 112 x 82. The actions are the ones the ... already
                             carried; what changes is that they are on screen rather than
                             one press behind a glyph.

                             HIDE KEEPS ITS OWN WORD and Slate's paint. Decal calls this
                             Hide and not Delete on purpose, and the contract says why:
                             DELETE /profiles/<id> is a SOFT delete - the record stays and a
                             bundled one comes back through Restore. Painting it as Slate's
                             Delete while calling it Delete would be the first honest half
                             and the second a lie. -->
                        <div id="actions" class="detail-actions">
                            <!-- TWO DESTRUCTIVE WORDS, AND EACH DOES WHAT IT SAYS. Ben,
                                 25 August 2026: "Hide should hide, delete should delete
                                 after confirmation."

                                 SLATE HAS ONE BUTTON HERE and calls it Delete, for a route
                                 that hides. That was the audit's "The word" row and it is
                                 what this replaces: Hide takes DELETE /profiles/<id>, the
                                 SOFT delete that sets a visibility and removes nothing, and
                                 Delete takes /purge, the one route that removes a record.

                                 HIDE GOES AWAY ON A HIDDEN PROFILE. There is nothing left
                                 for it to do, and a disabled button that is only ever
                                 disabled in one view is a control that has to be explained.
                                 Delete stays in both. -->
                            ${this._showHidden ? nothing : html`<ui-button
                                id="act-hide"
                                variant="danger"
                                ?disabled=${!record}
                                @click=${this.#onHidePress}
                                >${t('Hide')}</ui-button
                            >`}
                            <ui-button
                                id="act-delete"
                                variant="danger"
                                ?disabled=${!record}
                                @click=${this.#onDeletePress}
                                >${t('Delete')}</ui-button
                            >
                            ${this.#canReset
                                ? html`<ui-button
                                    id="act-reset"
                                    ?disabled=${!record}
                                    @click=${this.#onResetPress}
                                    >${t('Reset')}</ui-button
                                >`
                                : nothing}
                            <ui-button
                                id="act-edit"
                                ?disabled=${!record}
                                @click=${this.#onEditPress}
                                >${t('Edit')}</ui-button
                            >
                        </div>

                        <!-- THE OVERLAYS LIVE HERE, and P1 is why: this screen's grid has
                             exactly two children and an overlay is not a band. Every
                             confirm host has a display:contents host over a closed native
                             dialog, so none contributes a flex item here.
                             (No backtick in this template, comment or not.)

                             THE LOAD CONFIRM IS GONE (Ben, 24 Aug 2026). A button labelled
                             Confirm that opened a dialog asking you to confirm asked the
                             same question twice; the old skin's own Confirm writes the
                             workflow and leaves. What remains here asks about the things
                             this app cannot undo. -->

                        <!-- THE FILE PICKER, HELD OPEN NOWHERE. <ui-file-button> is a
                             button over a clipped input; it is in the tree so a menu row
                             can click it, and it paints nothing of its own here. -->
                        <ui-file-button
                            id="upload"
                            class="hidden-control"
                            accept=".json,application/json"
                            label=${t('Upload a profile')}
                            @file-pick=${this.#onFilePick}
                            >${t('Upload a profile')}</ui-file-button
                        >

                        <!-- THE SHARE CODE. Four characters and a message that says which
                             of the two refusals happened — a wrong code and a Visualizer
                             account nobody is signed in to need different answers, and the
                             old skin shows a whole second modal for the second. -->
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
                                <ui-button
                                    id="share-import"
                                    variant="primary"
                                    ?disabled=${!this._shareCode || this.#adding}
                                    @click=${this.#onShareImport}
                                    >${t('Import')}</ui-button
                                >
                            </div>
                        </ui-dialog>

                        <!-- THE HIDE CONFIRM. Its detail names the profile, because the
                             menu it came from is closed by the time the question is asked
                             and "this profile" would then name nothing on screen. -->
                        <ui-confirm-dialog
                            id="confirm-hide"
                            tone="destructive"
                            question=${t('Hide this profile?')}
                            detail=${title ?? ''}
                            cancel-label=${t('Cancel')}
                            confirm-label=${t('Hide')}
                            @confirm=${this.#onConfirmHide}
                        ></ui-confirm-dialog>

                        <!-- REMOVE FOR GOOD, AND THE QUESTION SAYS SO IN THOSE WORDS.
                             Ben, 25 August 2026: "build it behind a confirm that says
                             plainly it cannot be undone."

                             THE DETAIL IS THE SENTENCE, not the profile's name — the name
                             is in the question. Every other confirm on this screen can
                             afford to name the thing and stop, because every other action
                             here is reversible: a hidden bundled profile comes back through
                             Restore, and a hidden user profile is still on the server. This
                             is the one route that removes a record, so the sentence a user
                             needs is what it costs, not what it is about. -->
                        <ui-confirm-dialog
                            id="confirm-remove"
                            tone="destructive"
                            question=${t('Delete {name}?', { name: title ?? t('this profile') })}
                            detail=${t('This removes the profile from the machine. It cannot be undone, and Restore will not bring a bundled profile back.')}
                            cancel-label=${t('Cancel')}
                            confirm-label=${t('Delete')}
                            @confirm=${this.#onConfirmRemove}
                        ></ui-confirm-dialog>

                        <!-- RESET ONE PROFILE, ASKED FIRST. Same route as the bulk restore
                             below and the same 'nothing the user made is touched' promise —
                             what differs is that this one names the profile it is about,
                             because it was reached from that profile's own row of actions. -->
                        <ui-confirm-dialog
                            id="confirm-reset"
                            question=${t('Reset this profile to factory?')}
                            detail=${title ?? ''}
                            cancel-label=${t('Cancel')}
                            confirm-label=${t('Reset')}
                            @confirm=${this.#onConfirmReset}
                        ></ui-confirm-dialog>

                        <!-- D6, FIRST HALF ONLY. The wording says exactly what the handler
                             does (see #restoreBody): the bundled version comes back, and
                             nothing the user made is touched, because their edit is a
                             different record with a different id. The PURGE half is
                             deferred and has no control anywhere on this screen. -->
                        <ui-dialog id="restore" heading=${t('Restore bundled profiles')}>
                            <p slot="header-trail"
                                >${t('The bundled version comes back. Your own profiles are untouched.')}</p
                            >
                            <div slot="body">${this.#restoreBody()}</div>
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
                        <!-- B9 — THE REFUSAL, AT THE POINT OF PICKING. #49 takes a message
                             and does not know the message: the server's own sentence
                             arrives through profileRefusal() and is printed verbatim.

                             AND IT TAKES NOTHING ELSE. This surface used to bind the
                             refusal's own kind onto a "kind" attribute as well, and #49 has
                             no such property, attribute or rule: its whole properties map is
                             {_hasHeadline, _hasRemedy} (ui-alert-banner.js:180-185), and the
                             only "kind" in that file is a prose note about the OLD skin's
                             three alert kinds. An attribute with no consumer is P9's class
                             exactly — markup that implies a distinction it never paints —
                             so it is gone. The distinction still reaches the person, in the
                             one place it was ever readable: the server's own two sentences,
                             "Unsupported profile" and "Invalid profile", verbatim in the
                             headline. The kind stays a VALUE on the store's state, where
                             profileRefusal() puts it and the suites assert it. -->
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

                    <!-- chart-C3: THE PLOT HOST IS UNPADDED. The card's inset lives on its
                         FRAME and the plot host inside it carries none, which is #47's own
                         contract and is inherited whole by mounting the card rather than
                         building a well around it. Nothing here declares padding on it. -->
                    <ui-chart-card
                        id="preview"
                        slot="chart"
                        label=${t('Profile preview')}
                        channels="targetPressure targetFlow"
                        .derivation=${preview}
                    >
                        <span slot="empty">${t('Choose a profile to see its curves')}</span>
                    </ui-chart-card>

                    <!-- READONLY, because there is nowhere to save an edit to.
                         Slate's pane is a plain div that prints profile.notes
                         (profile_selector.js:565); this mounted a full editor over the
                         same read, so the caret landed and every word typed was thrown
                         away at the next selection. Writing notes needs a route, a store
                         and a Save — none of which this screen has — so until it does,
                         the pane says what it can do. -->
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

            <!-- THE SCREEN'S ONE LINE OF SPEECH. Slate says every favourite outcome in a
                 toast, refusal and success alike, and its own note explains why they
                 cannot share one: an error toast that a success overwrites 300 ms later
                 is an error nobody reads.

                 IT IS OUTSIDE THE SPLIT ON PURPOSE. ui-toast is position: fixed, so it
                 contributes no grid item and P1's "this screen's grid has exactly two
                 children" still holds - the same placement editor-screen.js:981 makes for
                 the same reason. -->
            <ui-toast id="notice"></ui-toast>
        `;
    }
}

customElements.define('selector-screen', SelectorScreen);
