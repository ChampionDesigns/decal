/**
 * <settings-screen>, the Settings master–detail shell.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import {
    SETTINGS_TREE,
    categoriesFor,
    NAV_KIND,
    navName,
    categoryFor,
    categoryOf,
    leafFor,
    isSearching,
    leavesFor,
    leafShownOn,
} from 'src/lib/settings-nav.js';

import 'src/screens/settings-master-detail.js';
import 'src/screens/settings-nav-column.js';
import 'src/screens/settings-leaf-pane.js';
import 'src/screens/settings-leaf.js';
import 'src/screens/settings-bespoke-leaf.js';
import 'src/components/ui-numeric-keypad.js';

import 'src/components/ui-page-header.js';
import 'src/components/ui-search-field.js';
import 'src/components/ui-nav-row.js';
import 'src/components/ui-subnav-row.js';
import 'src/components/ui-button.js';
import 'src/components/ui-empty-state.js';

import { NAV_LEVEL } from 'src/screens/settings-master-detail.js';

import { DEFAULT_ROUTE_ID as HOME_ROUTE } from 'src/lib/app-routes.js';
import { settingsModelFor, settingsBespokeFor } from 'src/screens/settings-model.js';
import { COMMIT_REFUSAL } from 'src/stores/settings-leaf-model.js';
import { DENSITY_ROW, LEAF_KIND, leafKind } from 'src/lib/settings-leaves.js';
import { searchSettingControls } from 'src/lib/settings-search.js';
import { highlightSettingsTarget } from 'src/screens/settings-search-focus.js';
import { applyDensity } from 'src/lib/density.js';
import { leaveSkin } from 'src/lib/host-exit.js';
import { FEED } from 'src/stores/live-stores.js';

import { OPERATION, OPERATION_KIND, READ_REFUSAL, WRITE_REFUSAL } from 'src/stores/settings-store.js';
import { READING_FRESHNESS, freshnessOf } from 'src/lib/feed-freshness.js';
const QUICKSTART_GUIDE_URL = 'https://decentespresso.com/doc/quickstart/';

const COMMIT_REFUSAL_TEXT = Object.freeze({
    noMachinePort: 'Nothing was saved — this tablet is not connected to a machine.',
    writeFailed: 'The machine refused the change. It may be busy, or not connected.',
    unknown: 'Nothing was saved. The change is still here — try again.',
});

const PARTIAL_COMMIT_TEXT = Object.freeze({
    backendFailed: 'The machine took the change. This tablet could not remember it — try again.',
    capabilityNotPresent: 'The machine took the change. This tablet cannot remember it here.',
    unknown: 'The machine took the change. Part of it was not saved — try again.',
});
const panelSignature = (value) => [
    value?.brightness,
    value?.requestedBrightness,
    value?.wakeLockOverride,
].map((field) => (field === undefined ? '-' : String(field))).join('|');
const SAVE_GROUP = Object.freeze({
    MACHINE: 'machine',
    LIGHTING: 'lighting',
    PLUGIN: 'plugin',
});
const LIGHTING_LEAF = 'accessories-lighting';
const SAVE_GROUP_NAME = Object.freeze({
    [SAVE_GROUP.MACHINE]: 'Machine settings',
    [SAVE_GROUP.LIGHTING]: 'Lighting',
    [SAVE_GROUP.PLUGIN]: 'Plugin settings',
});
const WRITE_REFUSAL_TEXT = Object.freeze({
    backendFailed: 'That preference could not be saved on this device.',
    capabilityNotPresent: 'This machine does not have that feature.',
    unknown: 'That preference could not be saved.',
});

const PENDING_MARKER_BACKSTOP_MS = 15000;
export class SettingsScreen extends UiElement {
    static properties = {
        boot: { attribute: false },

        changeCount: { type: Number, attribute: 'change-count' },

        /** The selected category id. Settable, so a harness state is one attribute. */
        categoryId: { type: String, attribute: 'category-id' },

        /** The selected leaf id. Settable for the same reason. */
        leafId: { type: String, attribute: 'leaf-id' },

        /** Internal: the search field's text. */
        _query: { state: true },
        _searchTarget: { state: true },

        /** Internal: which nav column column 1 holds while collapsed. */
        _navLevel: { state: true },

        _commitRefusal: { state: true },

        _commitRefusalGroup: { state: true },
        _commitRefusalDetail: { state: true },
        _writeRefusal: { state: true },

        _pendingPreference: { state: true },
        _readFailure: { state: true },
        _typing: { state: true },

        model: { attribute: false },

        bespoke: { attribute: false },

        theme: { attribute: false },

        densityRoot: { attribute: false },
    };

    static styles = [typeRoles, seams, css`
        .search-result {
            display: grid;
            gap: var(--ui-space-1);
            padding-block: var(--ui-space-3);
            white-space: normal;
            font-size: var(--ui-text-base);
            line-height: 1.4;
        }
        .search-context {
            font-size: var(--ui-text-2xs);
            font-weight: var(--ui-weight-regular);
        }
        settings-leaf::part(search-match),
        settings-bespoke-leaf::part(search-match) {
            outline: var(--ui-border-w-strong) solid var(--ui-steel);
            outline-offset: var(--ui-space-2);
            border-radius: var(--ui-radius);
        }
        #bespoke {
            margin-block-start: var(--ui-space-4);
        }

        :host(.seam-grid) {
            grid-template-rows: var(--ui-band-h) minmax(0, 1fr);
            block-size: 100%;
        }

        /* Row 1. min-inline-size: 0 so a long heading cannot widen the screen; the
         * band's own layout is #31's and nothing here reaches into it. */
        ui-page-header {
            grid-row: 1;
            min-inline-size: 0;
        }

        #refusal-region {
            grid-row: 3;
            display: grid;
            gap: var(--ui-space-2);
            padding: var(--ui-space-3) var(--ui-space-5);
            background-color: var(--ui-fascia);
            min-inline-size: 0;
        }
        settings-master-detail {
            grid-row: 2;
            min-inline-size: 0;
            min-block-size: 0;
        }

        #crumb-trail {
            display: flex;
            align-items: center;
            gap: var(--ui-space-2);
            min-inline-size: 0;
        }

        #crumb-here {
            min-inline-size: 0;
            overflow-x: clip;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

    `];

    #i18n = new I18nController(this);
    #unwatchNavigation = [];
    #navigationSource = null;
    #clearSearchHighlight = null;

    /** Held so `disconnectedCallback` can undo it: one subscription, never two. */
    #unwatchModel = null;

    /** The settings store's write-failure subscription, for the life of this screen. */
    #unwatchWriteFailure = null;

    #unwatchOperation = null;
    /** The LED strip store's, so the header's count moves when a preview goes uncommitted. */
    #unwatchLed = null;

    #unwatchPlugins = null;
    /** The display feed, watched for the brightness row. See `#watchPanel`. */
    #unwatchPanel = null;
    #pendingTimer = null;
    #readingsSource = null;
    #readingsFeed = null;

    constructor() {
        super();
        this.boot = null;
        this.changeCount = 0;
        this.categoryId = SETTINGS_TREE[0].id;
        this.leafId = SETTINGS_TREE[0].leaves[0].id;
        this._query = '';
        this._navLevel = NAV_LEVEL.LEAVES;
        this._commitRefusal = null;
        this._commitRefusalGroup = null;
        this._commitRefusalDetail = null;
        this._writeRefusal = null;
        this._pendingPreference = null;
        this._readFailure = null;
        this.model = null;
        this.bespoke = null;
        this.theme = null;
        this.densityRoot = null;
        this._typing = null;
        this.pendingBackstopMs = PENDING_MARKER_BACKSTOP_MS;
    }

    connectedCallback() {
        super.connectedCallback();
        this.classList.add('seam-grid', 'seam-strong');
        if (!this.densityRoot) this.densityRoot = this.ownerDocument?.documentElement ?? null;
        this.#adoptModel();
    }

    disconnectedCallback() {
        super.disconnectedCallback?.();
        this.#unwatchModel?.();
        this.#unwatchModel = null;
        this.#unwatchWriteFailure?.();
        this.#unwatchWriteFailure = null;
        this.#unwatchOperation?.();
        this.#unwatchOperation = null;
        this.#unwatchLed?.();
        this.#unwatchLed = null;
        this.#unwatchPlugins?.();
        this.#unwatchPlugins = null;
        this.#unwatchPanel?.();
        this.#unwatchPanel = null;
        this.#clearPendingTimer();
        this.#unwatchNavigation.forEach((stop) => stop());
        this.#unwatchNavigation = [];
        this.#navigationSource = null;
        this.#clearSearchHighlight?.();
    }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('boot') || changed.has('model') || changed.has('bespoke')) this.#adoptModel();
        if (this.categoryId !== this.#category.id || this.leafId !== this.#leaf.id) {
            this.categoryId = this.#category.id;
            this.leafId = this.#leaf.id;
        }
        if (changed.has('_searchTarget') || changed.has('leafId')) {
            this.#clearSearchHighlight?.();
            this.#clearSearchHighlight = this._searchTarget?.leaf.id === this.#leaf.id
                ? highlightSettingsTarget(this, this._searchTarget)
                : null;
        }
    }

    get #machineClass() {
        return this.boot?.capabilities?.machineClass?.() ?? this.bespoke?.machineClass?.() ?? null;
    }
    #capability = (name) => {
        return this.boot?.capabilities?.capability?.(name) ?? this.bespoke?.capability?.(name) ?? 'unknown';
    };
    #watchNavigation() {
        const source = this.bespoke ?? this.boot?.capabilities;
        if (source === this.#navigationSource) return;
        this.#unwatchNavigation.forEach((stop) => stop());
        this.#unwatchNavigation = [];
        this.#navigationSource = source;
        const repaint = () => this.requestUpdate();
        const capabilities = this.boot?.capabilities;
        const stop = capabilities?.subscribe?.(repaint) ?? this.bespoke?.watchAllowed?.(repaint);
        if (typeof stop === 'function') this.#unwatchNavigation.push(stop);
    }

    get #machineFeed() {
        const live = this.boot?.live ?? null;
        if (!live || typeof live.feed !== 'function') return null;
        try {
            return this.#currentReadingsOf(live.feed(FEED.MACHINE));
        } catch {
            return null;
        }
    }

    #currentReadingsOf(feed) {
        if (!feed || typeof feed.subscribe !== 'function') return null;
        if (this.#readingsSource === feed) return this.#readingsFeed;
        const current = (state) => (state
            ? {
                ...state,
                frame: freshnessOf(state) === READING_FRESHNESS.FRESH ? (state.frame ?? null) : null,
            }
            : state);
        const view = Object.freeze({
            get: () => current(feed.get?.() ?? null),
            subscribe: (listener) => feed.subscribe((state) => listener(current(state))),
        });
        this.#readingsSource = feed;
        this.#readingsFeed = view;
        return view;
    }
    get #ledPending() {
        const led = this.bespoke?.led ?? null;
        return typeof led?.get === 'function' && led.get().dirty === true;
    }
    get #pluginPending() {
        const plugins = this.bespoke?.plugins ?? null;
        return typeof plugins?.get === 'function' && plugins.get().dirty === true;
    }
    get #pendingGroups() {
        const groups = [];
        const model = this.model ?? null;
        if (model && (this.changeCount > 0 || model.hasPendingWrites === true)) {
            groups.push(Object.freeze({
                id: SAVE_GROUP.MACHINE,
                commit: () => model.commit(),
                cancel: () => { model.discard?.(); },
            }));
        }
        if (this.#ledPending) {
            const led = this.bespoke.led;
            groups.push(Object.freeze({
                id: SAVE_GROUP.LIGHTING,
                commit: async () => Object.freeze({
                    ok: (await led.commit()) !== false,
                    reason: 'writeFailed',
                }),
                cancel: () => { Promise.resolve(led.reset()).catch(() => {}); },
            }));
        }
        if (this.#pluginPending) {
            const plugins = this.bespoke.plugins;
            groups.push(Object.freeze({
                id: SAVE_GROUP.PLUGIN,
                commit: () => plugins.commitDrafts(),
                cancel: () => { plugins.discardDrafts(); },
            }));
        }
        return groups;
    }
    #refusalRegion() {
        const t = this.#i18n.t;
        const saidOnTheLeaf = this._commitRefusalGroup === SAVE_GROUP.LIGHTING
            && this.leafId === LIGHTING_LEAF;
        const commit = this._commitRefusal && !saidOnTheLeaf;
        if (!commit && !this._writeRefusal) return nothing;
        return html`<div id="refusal-region">
            ${commit
                ? html`<p id="commit-refusal" class="ui-caption" role="status"
                    >${this.#refusalGroupName}${t(this.#refusalSentence)}</p>`
                : nothing}
            ${this._writeRefusal
                ? html`<p id="write-refusal" class="ui-caption" role="status"
                    >${t(WRITE_REFUSAL_TEXT[this._writeRefusal] ?? WRITE_REFUSAL_TEXT.unknown)}</p>`
                : nothing}
        </div>`;
    }
    get #refusalGroupName() {
        if (this._commitRefusal === COMMIT_REFUSAL.MEMORY_NOT_SAVED) return '';
        const name = SAVE_GROUP_NAME[this._commitRefusalGroup];
        return name ? `${this.#i18n.t(name)}: ` : '';
    }
    get #refusalSentence() {
        if (this._commitRefusal === COMMIT_REFUSAL.MEMORY_NOT_SAVED) {
            return PARTIAL_COMMIT_TEXT[this._commitRefusalDetail] ?? PARTIAL_COMMIT_TEXT.unknown;
        }
        return COMMIT_REFUSAL_TEXT[this._commitRefusal] ?? COMMIT_REFUSAL_TEXT.unknown;
    }

    #adoptModel() {
        const model = this.model ?? settingsModelFor(this.boot);
        if (model && model !== this.model) this.model = model;
        const bespoke = this.bespoke ?? settingsBespokeFor(this.boot);
        if (bespoke && bespoke !== this.bespoke) this.bespoke = bespoke;
        this.#watchNavigation();
        const led = bespoke?.led ?? null;
        if (!this.#unwatchLed && typeof led?.subscribe === 'function') {
            this.#unwatchLed = led.subscribe(() => this.requestUpdate());
        }
        const plugins = bespoke?.plugins ?? null;
        if (!this.#unwatchPlugins && typeof plugins?.subscribe === 'function') {
            this.#unwatchPlugins = plugins.subscribe(() => this.requestUpdate());
        }
        const displayFeed = bespoke?.display?.feed ?? null;
        if (!this.#unwatchPanel && typeof displayFeed?.subscribe === 'function') {
            let last = null;
            this.#unwatchPanel = displayFeed.subscribe((state) => {
                const next = panelSignature(state?.value ?? null);
                if (next === last) return;
                last = next;
                this.requestUpdate();
                this.renderRoot?.getElementById('leaf')?.requestUpdate();
            });
        }
        if (!model || typeof model.subscribe !== 'function') return;
        if (this.#unwatchModel) return;
        this.#unwatchModel = model.subscribe((state) => { this.changeCount = state.changeCount; });

        const settings = this.boot?.settings ?? null;
        if (!this.#unwatchWriteFailure && typeof settings?.onWriteFailure === 'function') {
            this.#unwatchWriteFailure = settings.onWriteFailure((failure) => {
                if (failure?.reason === WRITE_REFUSAL.SUPERSEDED) return;
                this._writeRefusal = failure?.reason ?? 'unknown';
            });
        }
        if (!this.#unwatchOperation && typeof settings?.onOperation === 'function') {
            this.#unwatchOperation = settings.onOperation((operation) => {
                if (operation.kind === OPERATION_KIND.READ) {
                    if (operation.status === OPERATION.FAILED
                        && operation.reason === READ_REFUSAL.BACKEND_FAILED) {
                        this._readFailure = operation.key;
                        return;
                    }
                    if (this._readFailure === operation.key) this._readFailure = null;
                    return;
                }
                if (operation.status === OPERATION.PENDING) {
                    this._pendingPreference = operation.key;
                    this.#armPendingTimer();
                    return;
                }
                if (this._pendingPreference === operation.key) {
                    this._pendingPreference = null;
                    this.#clearPendingTimer();
                }
            });
        }
    }

    #armPendingTimer() {
        this.#clearPendingTimer();
        this.#pendingTimer = setTimeout(() => {
            this.#pendingTimer = null;
            this._pendingPreference = null;
        }, this.pendingBackstopMs);
    }
    #clearPendingTimer() {
        if (this.#pendingTimer === null) return;
        clearTimeout(this.#pendingTimer);
        this.#pendingTimer = null;
    }
    /** The category currently selected, always a real one. */
    get #category() {
        const shown = categoriesFor(SETTINGS_TREE, this.#machineClass, this.#capability);
        return shown.find((category) => category.id === this.categoryId) ?? shown[0];
    }

    get #leaf() {
        const shown = leavesFor(this.#category, this.#machineClass, this.#capability);
        const leaf = leafFor(this.leafId);
        if (leaf
            && categoryOf(this.leafId)?.id === this.#category.id
            && leafShownOn(leaf, this.#machineClass, this.#capability)) return leaf;
        return shown[0];
    }

    render() {
        const t = this.#i18n.t;
        const category = this.#category;

        return html`
            <ui-page-header
                id="band"
                heading=${t('Settings')}
                commit
                change-count=${this.changeCount + (this.#ledPending ? 1 : 0) + (this.#pluginPending ? 1 : 0)}
                @commit=${this.#onCommit}
                @cancel=${this.#onCancel}
            ></ui-page-header>

            ${this.#refusalRegion()}
            ${this._pendingPreference
                ? html`<p id="preference-pending" class="ui-caption" role="status"
                    >${t('Saving your choice…')}</p>`
                : nothing}

            ${this._readFailure
                ? html`<p id="preference-unread" class="ui-caption" role="status"
                    >${t('That preference could not be read. This is the last value known.')}</p>`
                : nothing}

            <settings-master-detail id="body" nav-level=${this._navLevel}>
                <div slot="crumb" id="crumb-trail">
                    <ui-button
                        id="crumb-up"
                        variant="ghost"
                        @click=${this.#onCrumbUp}
                    >${t('All categories')}</ui-button>
                    <span id="crumb-here" class="ui-body">${t(navName(category))}</span>
                </div>

                <ui-search-field
                    id="search"
                    slot="search"
                    label=${t('Search settings')}
                    placeholder=${t('Search settings...')}
                    .value=${this._query}
                    @input=${this.#onSearch}
                    @search=${this.#onSearch}
                ></ui-search-field>

                <settings-nav-column
                    slot="nav"
                    id="nav"
                    @navigate=${this.#onNavNavigate}
                >
                    ${this.#navRows()}
                </settings-nav-column>

                <settings-nav-column
                    slot="subnav"
                    id="subnav"
                    @navigate=${this.#onLeafNavigate}
                >
                    ${leavesFor(category, this.#machineClass, this.#capability).map((leaf) => html`<ui-subnav-row
                        data-id=${leaf.id}
                        .value=${leaf.id}
                        summary=${this.model?.navSummary?.(leaf.id) ?? ''}
                        ?current=${leaf.id === this.#leaf.id}
                    >${t(navName(leaf))}</ui-subnav-row>`)}
                </settings-nav-column>

                <settings-leaf-pane slot="leaf" id="leaf-pane">
                    <settings-leaf
                        id="leaf"
                        leaf-id=${this.#leaf.id}
                        eyebrow=${navName(category)}
                        heading=${navName(this.#leaf)}
                        .model=${this.model}
                        .liveFeed=${this.#machineFeed}
                        @leaf-action=${this.#onLeafAction}
                        @leaf-change=${this.#onLeafChange}
                        @leaf-edit=${this.#onLeafEdit}
                    ></settings-leaf>
                    ${leafKind(this.#leaf.id) === LEAF_KIND.BESPOKE
                        ? html`<settings-bespoke-leaf
                            id="bespoke"
                            leaf-id=${this.#leaf.id}
                            .deps=${this.bespoke}
                            .theme=${this.theme}
                        ></settings-bespoke-leaf>`
                        : nothing}
                </settings-leaf-pane>
            </settings-master-detail>
            ${this.#renderKeypad()}
        `;
    }

    #renderKeypad() {
        const t = this.#i18n.t;
        const view = this.#typingView;
        return html`
            <ui-numeric-keypad
                id="keypad"
                ?open=${Boolean(view)}
                heading=${view ? t(view.heading) : ''}
                .limits=${this.bespoke?.limits ?? null}
                .limitKey=${view?.row?.limit ?? ''}
                .band=${this.#typingBand}
                .value=${view && view.value !== undefined && view.value !== null ? String(view.value) : ''}
                unit=${view ? view.bounds.unit : ''}
                @confirm=${this.#onKeypadConfirm}
                @open-change=${this.#onKeypadClose}
            ></ui-numeric-keypad>`;
    }

    get #typingBand() {
        const view = this.#typingView;
        if (!view || !view.bounds?.bounded) return null;
        return { ...(view.padBounds ?? view.bounds), label: view.hint };
    }

    /** The joined row the keypad is typing into, or null. Looked up, never held. */
    get #typingView() {
        if (!this._typing || !this.model || !this.#leaf) return null;
        return this.model.rows(this.#leaf.id).find((view) => view.id === this._typing) ?? null;
    }

    /** A stepper's number was pressed. Open the keypad on that row. */
    #onLeafEdit = (event) => {
        const row = event.detail?.row;
        if (typeof row === 'string' && row !== '') this._typing = row;
    };

    #onKeypadConfirm = (event) => {
        const view = this.#typingView;
        const value = event?.detail?.value;
        this._typing = null;
        if (!view || !Number.isFinite(value)) return;
        Promise.resolve(this.model.set(view.row, value)).catch(() => {});
    };

    /** The dialog announced its own close. Only a CLOSE clears the row — see the wake. */
    #onKeypadClose = (event) => {
        if (event?.detail?.open === false) this._typing = null;
    };

    #navRows() {
        const t = this.#i18n.t;
        const rows = isSearching(this._query)
            ? searchSettingControls(this._query, {
                machineClass: this.#machineClass, capability: this.#capability,
                views: this.model ? (id) => this.model.rows(id) : null, translate: t,
                fieldVisible: (field) => !field.target.startsWith('night-')
                    || this.model?.allRows(field.leaf).find((view) => view.id === 'accessories-usb-charger-night')?.checked !== false,
            })
            : categoriesFor(SETTINGS_TREE, this.#machineClass, this.#capability).map((category) => ({
                kind: NAV_KIND.CATEGORY, node: category, category,
            }));

        if (rows.length === 0) {
            return html`<ui-empty-state
                id="search-empty"
                heading=${t('No settings match')}
                body=${t('Nothing here is called “{query}”. Try a shorter word.', { query: this._query.trim() })}
            ></ui-empty-state>`;
        }

        return rows.map((row) => html`<ui-nav-row
            data-id=${row.node.id}
            data-kind=${row.kind}
            data-category=${row.category.id}
            data-leaf=${row.leaf?.id ?? nothing}
            data-target=${row.target ?? nothing}
            data-primitive=${row.primitive ? 'true' : nothing}
            ?current=${this.#isCurrentRow(row)}
        >${row.kind === NAV_KIND.ROW
            ? html`<span class="search-result"><span>${t(row.heading)}</span><span class="search-context"
                >${t(navName(row.category))} › ${t(navName(row.leaf))}</span></span>`
            : t(navName(row.node))}</ui-nav-row>`);
    }

    /** A category row is current when it is the category; a leaf result, the leaf. */
    #isCurrentRow(row) {
        if (row.kind === NAV_KIND.ROW) return row.node.id === this._searchTarget?.node.id;
        return row.kind === NAV_KIND.LEAF
            ? row.node.id === this.#leaf.id
            : row.node.id === this.categoryId;
    }

    #onCommit = () => {
        const groups = this.#pendingGroups;
        if (groups.length === 0) {
            this.#clearRefusals();
            this.#leaveScreen();
            return;
        }
        this.#saveGroups(groups).catch(() => {
            this._commitRefusal = 'unknown';
            this._commitRefusalDetail = null;
        });
    };

    async #saveGroups(groups) {
        const failed = [];
        for (const group of groups) {
            let outcome = null;
            try {
                outcome = await group.commit();
            } catch {
                outcome = { ok: false, reason: 'unknown' };
            }
            if (!outcome || outcome.ok === false) {
                failed.push({
                    id: group.id,
                    reason: outcome?.reason ?? 'unknown',
                    detail: outcome?.detail ?? null,
                });
            }
        }
        if (failed.length === 0) {
            this.#clearRefusals();
            this.#leaveScreen();
            return;
        }
        this._commitRefusal = failed[0].reason;
        this._commitRefusalGroup = failed[0].id;
        this._commitRefusalDetail = failed[0].detail ?? null;
    }
    #clearRefusals() {
        this._commitRefusal = null;
        this._commitRefusalGroup = null;
        this._commitRefusalDetail = null;
        this._writeRefusal = null;
    }
    #onCancel = () => {
        for (const group of this.#pendingGroups) group.cancel();
        this.#clearRefusals();
        this.#leaveScreen();
    };

    #leaveScreen() {
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { route: HOME_ROUTE },
            bubbles: true,
            composed: true,
        }));
    }

    #onLeafAction = (event) => {
        const action = event.detail?.action;
        if (action === 'leave-skin') {
            leaveSkin(this.ownerDocument?.defaultView ?? null);
            return;
        }
        if (action === 'scan-devices') {
            void this.bespoke?.scaleConnect?.scan?.();
            return;
        }
        if (action === 'open-quickstart') {
            try {
                this.ownerDocument?.defaultView?.open?.(QUICKSTART_GUIDE_URL, '_blank', 'noopener');
            } catch { /* a webview that refuses to open a window is not an error to report */ }
        }
    };

    #onLeafChange = (event) => {
        if (event.detail?.row !== DENSITY_ROW) return;
        if (event.detail?.ok === false) return;
        applyDensity(this.densityRoot, event.detail.value);
    };

    #onNavNavigate = (event) => {
        const row = event.target;
        const id = row?.dataset?.id;
        if (!id) return;
        const categoryId = row.dataset.category ?? id;
        this.categoryId = categoryId;
        this._searchTarget = null;
        if (row.dataset.kind === NAV_KIND.ROW) {
            this.leafId = row.dataset.leaf;
            this._searchTarget = {
                node: { id }, leaf: leafFor(this.leafId), target: row.dataset.target,
                primitive: row.dataset.primitive === 'true',
            };
        } else if (row.dataset.kind === NAV_KIND.LEAF) this.leafId = id;
        else this.leafId = leavesFor(categoryFor(categoryId), this.#machineClass, this.#capability)[0]?.id ?? this.leafId;
        /* Collapsed, choosing a category steps you INTO it; wide, this selects
         * nothing, because both nav columns are on screen at once. */
        this._navLevel = NAV_LEVEL.LEAVES;
    };

    /** The sub-nav row carries `value`, which is its own API (#25), so read that. */
    #onLeafNavigate = (event) => {
        const id = event.detail?.value ?? event.target?.dataset?.id;
        if (!id) return;
        this._writeRefusal = null;
        this._searchTarget = null;
        this.leafId = id;
    };

    #onCrumbUp = () => {
        this._navLevel = NAV_LEVEL.CATEGORIES;
    };

    #onSearch = (event) => {
        this._query = event.target?.value ?? '';
        this._searchTarget = null;
        this._navLevel = NAV_LEVEL.CATEGORIES;
    };
}

customElements.define('settings-screen', SettingsScreen);
