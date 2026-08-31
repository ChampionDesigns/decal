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
    NAV_KIND,
    navName,
    categoryFor,
    categoryOf,
    leafFor,
    isSearching,
    searchSettings,
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

const LIGHTING_LEAF = 'accessories-lighting';
import { DEFAULT_ROUTE_ID as HOME_ROUTE } from 'src/lib/app-routes.js';
import { settingsModelFor, settingsBespokeFor } from 'src/screens/settings-model.js';
import { DENSITY_ROW, LEAF_KIND, leafKind } from 'src/lib/settings-leaves.js';
import { applyDensity } from 'src/lib/density.js';
import { FEED } from 'src/stores/live-stores.js';

const QUICKSTART_GUIDE_URL = 'https://decentespresso.com/doc/quickstart/';

const COMMIT_REFUSAL_TEXT = Object.freeze({
    noMachinePort: 'Nothing was saved — this tablet is not connected to a machine.',
    writeFailed: 'The machine refused the change. It may be busy, or not connected.',
    unknown: 'Nothing was saved. The change is still here — try again.',
});

const WRITE_REFUSAL_TEXT = Object.freeze({
    backendFailed: 'That preference could not be saved on this device.',
    capabilityNotPresent: 'This machine does not have that feature.',
    unknown: 'That preference could not be saved.',
});

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

        /** Internal: which nav column column 1 holds while collapsed. */
        _navLevel: { state: true },

        _commitRefusal: { state: true },

        _writeRefusal: { state: true },

        _typing: { state: true },

        model: { attribute: false },

        bespoke: { attribute: false },

        theme: { attribute: false },

        densityRoot: { attribute: false },
    };

    static styles = [typeRoles, seams, css`
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

    /** Held so `disconnectedCallback` can undo it: one subscription, never two. */
    #unwatchModel = null;

    /** The settings store's write-failure subscription, for the life of this screen. */
    #unwatchWriteFailure = null;

    /** The LED strip store's, so the header's count moves when a preview goes uncommitted. */
    #unwatchLed = null;

    /** The display feed, watched for the brightness row. See `#watchPanel`. */
    #unwatchPanel = null;

    constructor() {
        super();
        this.boot = null;
        this.changeCount = 0;
        this.categoryId = SETTINGS_TREE[0].id;
        this.leafId = SETTINGS_TREE[0].leaves[0].id;
        this._query = '';
        this._navLevel = NAV_LEVEL.LEAVES;
        this.model = null;
        this.bespoke = null;
        this.theme = null;
        this.densityRoot = null;
        this._typing = null;
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
        this.#unwatchLed?.();
        this.#unwatchLed = null;
        this.#unwatchPanel?.();
        this.#unwatchPanel = null;
    }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('boot') || changed.has('model')) this.#adoptModel();
    }

    get #machineClass() {
        const capabilities = this.boot?.capabilities ?? null;
        return typeof capabilities?.machineClass === 'function' ? capabilities.machineClass() : null;
    }

    get #machineFeed() {
        const live = this.boot?.live ?? null;
        if (!live || typeof live.feed !== 'function') return null;
        try {
            return live.feed(FEED.MACHINE);
        } catch {
            return null;
        }
    }

    get #ledPending() {
        if (this.#leaf.id !== LIGHTING_LEAF) return false;
        const led = this.bespoke?.led ?? null;
        return typeof led?.get === 'function' && led.get().dirty === true;
    }

    #adoptModel() {
        const model = this.model ?? settingsModelFor(this.boot);
        if (model && model !== this.model) this.model = model;
        const bespoke = this.bespoke ?? settingsBespokeFor(this.boot);
        if (bespoke && bespoke !== this.bespoke) this.bespoke = bespoke;
        const led = bespoke?.led ?? null;
        if (!this.#unwatchLed && typeof led?.subscribe === 'function') {
            this.#unwatchLed = led.subscribe(() => this.requestUpdate());
        }
        const displayFeed = bespoke?.display?.feed ?? null;
        if (!this.#unwatchPanel && typeof displayFeed?.subscribe === 'function') {
            let last = null;
            this.#unwatchPanel = displayFeed.subscribe((state) => {
                const level = state?.value?.brightness;
                const next = Number.isFinite(level) ? Math.round(level) : null;
                if (next !== last) { last = next; this.requestUpdate(); }
            });
        }
        if (!model || typeof model.subscribe !== 'function') return;
        if (this.#unwatchModel) return;
        this.#unwatchModel = model.subscribe((state) => { this.changeCount = state.changeCount; });

        const settings = this.boot?.settings ?? null;
        if (!this.#unwatchWriteFailure && typeof settings?.onWriteFailure === 'function') {
            this.#unwatchWriteFailure = settings.onWriteFailure((failure) => {
                this._writeRefusal = failure?.reason ?? 'unknown';
            });
        }
    }

    /** The category currently selected, always a real one. */
    get #category() {
        return categoryFor(this.categoryId) ?? SETTINGS_TREE[0];
    }

    get #leaf() {
        const shown = leavesFor(this.#category, this.#machineClass);
        const leaf = leafFor(this.leafId);
        if (leaf
            && categoryOf(this.leafId)?.id === this.#category.id
            && leafShownOn(leaf, this.#machineClass)) return leaf;
        return shown[0] ?? this.#category.leaves[0];
    }

    render() {
        const t = this.#i18n.t;
        const category = this.#category;

        return html`
            <ui-page-header
                id="band"
                heading=${t('Settings')}
                commit
                change-count=${this.changeCount + (this.#ledPending ? 1 : 0)}
                @commit=${this.#onCommit}
                @cancel=${this.#onCancel}
            ></ui-page-header>

            ${this._commitRefusal
                ? html`<p id="commit-refusal" class="ui-caption" role="status"
                    >${t(COMMIT_REFUSAL_TEXT[this._commitRefusal] ?? COMMIT_REFUSAL_TEXT.unknown)}</p>`
                : nothing}

            ${this._writeRefusal
                ? html`<p id="write-refusal" class="ui-caption" role="status"
                    >${t(WRITE_REFUSAL_TEXT[this._writeRefusal] ?? WRITE_REFUSAL_TEXT.unknown)}</p>`
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
                    ${leavesFor(category, this.#machineClass).map((leaf) => html`<ui-subnav-row
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
            ? searchSettings(this._query, SETTINGS_TREE, this.#machineClass)
            : SETTINGS_TREE.map((category) => ({
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
            ?current=${this.#isCurrentRow(row)}
        >${t(navName(row.node))}</ui-nav-row>`);
    }

    /** A category row is current when it is the category; a leaf result, the leaf. */
    #isCurrentRow(row) {
        return row.kind === NAV_KIND.LEAF
            ? row.node.id === this.#leaf.id
            : row.node.id === this.categoryId;
    }

    #onCommit = (event) => {
        if (this.#ledPending) {
            const led = this.bespoke.led;
            Promise.resolve(led.commit())
                .then((ok) => {
                    if (ok === false) {
                        this._commitRefusal = 'writeFailed';
                        return;
                    }
                    this._commitRefusal = null;
                    this.#leaveScreen();
                })
                .catch(() => { this._commitRefusal = 'unknown'; });
            return;
        }
        if (!event.detail?.dirty || !this.model) {
            this.#leaveScreen();
            return;
        }
        Promise.resolve(this.model.commit())
            .then((result) => {
                if (result && result.ok === false) {
                    this._commitRefusal = result.reason ?? 'unknown';
                    return;
                }
                this._commitRefusal = null;
                this._writeRefusal = null;
                this.#leaveScreen();
            })
            .catch(() => { this._commitRefusal = 'unknown'; });
    };

    #onCancel = () => {
        if (this.#ledPending) Promise.resolve(this.bespoke.led.reset()).catch(() => {});
        this.model?.discard?.();
        this._commitRefusal = null;
        this._writeRefusal = null;
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
            this.exit(new URL('../', this.ownerDocument?.location?.href ?? 'about:blank').href);
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

    /** Overridden in tests. The default is the only navigation this screen performs. */
    exit = (href) => {
        const location = this.ownerDocument?.defaultView?.location;
        if (location && typeof location.assign === 'function') location.assign(href);
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
        if (row.dataset.kind === NAV_KIND.LEAF) this.leafId = id;
        else this.leafId = categoryFor(categoryId)?.leaves[0]?.id ?? this.leafId;
        /* Collapsed, choosing a category steps you INTO it; wide, this selects
         * nothing, because both nav columns are on screen at once. */
        this._navLevel = NAV_LEVEL.LEAVES;
    };

    /** The sub-nav row carries `value`, which is its own API (#25), so read that. */
    #onLeafNavigate = (event) => {
        const id = event.detail?.value ?? event.target?.dataset?.id;
        if (!id) return;
        this._writeRefusal = null;
        this.leafId = id;
    };

    #onCrumbUp = () => {
        this._navLevel = NAV_LEVEL.CATEGORIES;
    };

    #onSearch = (event) => {
        this._query = event.target?.value ?? '';
    };
}

customElements.define('settings-screen', SettingsScreen);
