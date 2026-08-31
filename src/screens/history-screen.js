/**
 * <history-screen>, the shot history's shell.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import { ALIGNMENT_SLOT } from 'src/lib/alignment-offset.js';
import { HistoryViewer } from 'src/lib/history-viewer.js';
import { createShotsStore } from 'src/stores/shots-store.js';

import 'src/screens/history-header.js';

import 'src/screens/history-flow-page.js';
import 'src/screens/history-power-page.js';
import 'src/screens/history-data-page.js';

import 'src/components/ui-button.js';
import 'src/components/ui-select.js';
import 'src/components/ui-pick-disc.js';
import 'src/components/ui-tab-bar.js';
import 'src/components/ui-compare-bar.js';

export const HISTORY_PAGES = Object.freeze([
    Object.freeze({ value: 'flow', label: 'Flow' }),
    Object.freeze({ value: 'power', label: 'Power' }),
    Object.freeze({ value: 'data', label: 'Data' }),
]);

export const DEFAULT_HISTORY_PAGE = 'flow';

/** The control the caret lands on when this screen is entered. See `#focusEntry`. */
export const HISTORY_ENTRY_FOCUS = 'back';

export class HistoryScreen extends UiElement {
    static properties = {
        /** The app shell's boot object, handed down by <app-root> at creation. */
        boot: { attribute: false },

        comparing: { type: Boolean, reflect: true },

        page: { type: String, reflect: true },

        shotOptions: { attribute: false },

        /** The shot in slot A (the reference) and in slot B (the one that moves). */
        shotA: { type: String, attribute: 'shot-a' },
        shotB: { type: String, attribute: 'shot-b' },

        activeSlot: { type: String, attribute: 'active-slot', reflect: true },

        offset: { type: Number },

        restoreFocusTo: { attribute: false },
    };

    static styles = [typeRoles, seams, css`
        :host(.seam-grid) {
            grid-template-rows: var(--ui-band-h) auto minmax(0, 1fr);
            block-size: 100%;
        }

        /* Row 1. min-inline-size: 0 so a long option label cannot widen the screen;
         * the band's own four items are history-header's and nothing here reaches
         * into them. */
        history-header {
            grid-row: 1;
            min-inline-size: 0;
        }

        .compare-open {
            display: flex;
            align-items: center;
        }

        ui-compare-bar {
            grid-row: 2;
            min-inline-size: 0;
        }

        #page {
            grid-row: 3;
            display: grid;
            grid-template-rows: minmax(0, 1fr);
            grid-template-columns: minmax(0, 1fr);
            padding-inline: var(--ui-space-6);
            min-inline-size: 0;
            min-block-size: 0;
            background-color: var(--ui-fascia);
        }

        #page > slot {
            display: contents;
        }

        #page > slot > [data-page] {
            grid-row: 1;
            grid-column: 1;
        }

        ::slotted([slot="page"]) {
            grid-row: 1;
            grid-column: 1;
        }

        ::slotted([hidden]) {
            display: none;
        }

        /* The back control keeps its own measure in a band that gives elsewhere. */
        #back {
            flex: 0 0 auto;
        }
    `];

    #i18n = new I18nController(this);

    #viewer = null;

    /** The boot the viewer was built from, so it is built once and not per update. */
    #bootUsed = null;

    /** Whether this mounting has chosen its opening shot. See `#seedNewest`. */
    #seeded = false;

    /** The `value -> Element` map last handed to #32, so it is rebuilt only when the pages
     *  themselves change — the ELEMENTS, not just their names. See `#wirePages`. */
    #panels = null;

    /** How many pages a CALLER has assigned to the mount slot. See `#renderPages`. */
    #assignedPages = 0;

    /** True once the caret has been placed for this mounting. */
    #focused = false;

    constructor() {
        super();
        this.boot = null;
        this.page = DEFAULT_HISTORY_PAGE;
        this.shotOptions = null;
        this.shotA = '';
        this.shotB = '';
        /** Whether the opening shot has been chosen for this mounting. See `#seedNewest`. */
        this.#seeded = false;
        this.activeSlot = ALIGNMENT_SLOT.REFERENCE;
        this.comparing = false;
        this.offset = 0;
        this.restoreFocusTo = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this.classList.add('seam-grid', 'seam-strong');
    }

    disconnectedCallback() {
        /* The pairing S10 is the absence of. The store keeps its records — another
         * viewer may hold them — and only this screen's subscription goes. */
        this.#viewer?.stop();
        super.disconnectedCallback();
    }

    #openViewer() {
        if (this.#bootUsed === this.boot) return;
        this.#bootUsed = this.boot;
        this.#viewer?.stop();
        this.#viewer = null;
        const transport = this.boot?.transport ?? null;
        if (!transport) return;
        const store = this.boot?.shotHistory
            ?? createShotsStore({ transport, logger: this.boot?.logger ?? null });
        this.#viewer = new HistoryViewer({ store, host: this });
        this.#viewer.start();
    }

    /** The port is opened BEFORE the first render, so the first update already has the
     *  store's replayed state rather than a frame of nothing followed by a frame of it. */
    willUpdate(changed) {
        super.willUpdate?.(changed);
        this.#openViewer();
        this.#syncFromViewer();
    }

    #syncFromViewer() {
        const viewer = this.#viewer;
        if (!viewer) return;
        this.offset = viewer.offset;
        this.#seedNewest();
    }

    #seedNewest() {
        if (this.shotA || this.#seeded) return;
        const options = this.#viewer?.shotOptions ?? [];
        if (!options.length) return;
        this.#seeded = true;
        this.shotA = options[0].value;
        this.#viewer.select(ALIGNMENT_SLOT.REFERENCE, options[0].value);
    }

    render() {
        const t = this.#i18n.t;
        const viewer = this.#viewer;
        const options = Array.isArray(this.shotOptions)
            ? this.shotOptions
            : (viewer?.shotOptions ?? []);
        const tabs = HISTORY_PAGES.map(({ value, label }) => ({ value, label: t(label) }));
        const hasComparison = viewer
            ? viewer.hasComparison
            : (Boolean(this.shotA) && Boolean(this.shotB));

        return html`
            <history-header id="band">
                <ui-button
                    id="back"
                    slot="back"
                    tall
                    label=${t('Back to the live shot')}
                    @click=${this.#onBack}
                >${t('Back')}</ui-button>

                ${this.#renderPicker('picker-a', ALIGNMENT_SLOT.REFERENCE, 'A', t('Shot A'), this.shotA, options)}

                ${this.#comparing
                    ? this.#renderPicker('picker-b', ALIGNMENT_SLOT.MOVING, 'B', t('Shot B'), this.shotB,
                        [{ value: '', label: t('No comparison') }, ...options])
                    : html`<div slot="picker-b" class="compare-open">
                        <ui-button
                            id="compare-open"
                            @click=${this.#onCompareOpen}
                            >${t('Compare')}</ui-button
                        >
                    </div>`}

                <ui-tab-bar
                    id="tabs"
                    slot="tabs"
                    .tabs=${tabs}
                    .value=${this.page}
                    label=${t('History pages')}
                    @change=${this.#onPageChange}
                ></ui-tab-bar>
            </history-header>

            ${this.#comparing ? html`<ui-compare-bar
                id="compare"
                .offset=${this.offset}
                ?has-comparison=${hasComparison}
                has-time-axis=${this.page === 'data' ? 'false' : 'true'}
                label=${t('Align B')}
                slider-label=${t('Slide shot B along the time axis')}
                reset-label=${t('Reset')}
                @offset-change=${this.#onOffsetChange}
            ></ui-compare-bar>` : nothing}

            <div id="page" part="page"><slot name="page" @slotchange=${this.#onPagesChanged}
                >${this.#renderPages(viewer)}</slot></div>
        `;
    }

    #renderPages(viewer) {
        if (!viewer) return nothing;
        if (this.#assignedPages > 0 || this.querySelector('[slot="page"]')) return nothing;
        return html`
            <history-flow-page
                data-page="flow"
                .derivationA=${viewer.derivationA}
                .derivationB=${viewer.derivationB}
                .failure=${viewer.failure}
                .offset=${viewer.offset}
            ></history-flow-page>
            <history-power-page
                data-page="power"
                .derivationA=${viewer.derivationA}
                .derivationB=${viewer.derivationB}
                .failure=${viewer.failure}
                .offset=${viewer.offset}
            ></history-power-page>
            <history-data-page
                data-page="data"
                .derivationA=${viewer.derivationA}
                .derivationB=${viewer.derivationB}
                .failure=${viewer.failure}
                .rows=${viewer.rows}
                shot-a=${this.shotA}
                shot-b=${this.shotB}
                @shot-change=${this.#onRowPick}
            ></history-data-page>
        `;
    }

    #renderPicker(region, slotId, letter, name, value, options) {
        const t = this.#i18n.t;
        return html`
            <ui-pick-disc
                id="disc-${slotId}"
                slot=${region}
                label=${name}
                interactive
                ?selected=${this.activeSlot === slotId}
                @pick=${() => this.#onSlotPick(slotId)}
            >${letter}</ui-pick-disc>
            <ui-select
                id="select-${slotId}"
                slot=${region}
                label=${t('Choose {name}', { name })}
                .options=${options}
                .value=${value ?? ''}
                @change=${(event) => this.#onShotChange(slotId, event)}
            ></ui-select>
        `;
    }

    updated(changed) {
        super.updated?.(changed);
        this.#wirePages();
        this.#focusEntry();
    }

    /** A page arrived or left. A light-DOM child does not trigger a re-render, so the
     *  slot's own event is what keeps the tab bar's map honest. */
    #onPagesChanged = () => {
        this.#wirePages();
    };

    #wirePages() {
        const bar = this.renderRoot?.querySelector?.('#tabs');
        const slot = this.renderRoot?.querySelector?.('slot[name="page"]');
        if (!bar || !slot) return;
        const map = new Map();
        const assigned = slot.assignedElements ? slot.assignedElements() : [];
        if (assigned.length !== this.#assignedPages) {
            this.#assignedPages = assigned.length;
            this.requestUpdate();
        }
        const mounted = slot.assignedElements ? slot.assignedElements({ flatten: true }) : [];
        for (const el of mounted) {
            const name = el.getAttribute?.('data-page');
            if (name && !map.has(name)) map.set(name, el);
        }
        if (this.#samePanels(map)) return;
        this.#panels = map;
        bar.panels = map;
    }

    /** True when `map` names the same pages AND holds the same elements as the map #32
     *  was last handed. A `Map` with equal keys is NOT the same panel set. */
    #samePanels(map) {
        const prev = this.#panels;
        if (!prev || prev.size !== map.size) return false;
        for (const [name, el] of map) if (prev.get(name) !== el) return false;
        return true;
    }

    async #focusEntry() {
        if (this.#focused) return;
        const wanted = typeof this.restoreFocusTo === 'string' && this.restoreFocusTo
            ? this.restoreFocusTo
            : HISTORY_ENTRY_FOCUS;
        const target = this.renderRoot?.getElementById?.(wanted)
            ?? this.renderRoot?.getElementById?.(HISTORY_ENTRY_FOCUS);
        if (!target || typeof target.focus !== 'function') return;
        this.#focused = true;

        await target.updateComplete;
        target.focus({ preventScroll: true });
    }

    #onBack = () => {
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { back: true },
            bubbles: true,
            composed: true,
        }));
    };

    /** #3's composed `change`, arriving through #32's shadow root. One owner of the
     *  selection: this screen writes `page` and the bar reads it back. */
    #onPageChange = (event) => {
        const value = event?.detail?.value;
        if (typeof value !== 'string') return;
        this.page = value;
    };

    /** Comparing was asked for. The B picker appears; nothing is loaded until it is used. */
    #onCompareOpen = () => { this.comparing = true; };

    get #comparing() { return this.comparing || Boolean(this.shotB); }

    #onSlotPick(slotId) {
        if (this.activeSlot === slotId) return;
        this.#viewer?.setActiveSlot(slotId);
        this.activeSlot = slotId;
    }

    #onRowPick = (event) => {
        event.stopPropagation();
        const slot = event?.detail?.slot;
        if (slot !== ALIGNMENT_SLOT.REFERENCE && slot !== ALIGNMENT_SLOT.MOVING) return;
        this.#onShotChange(slot, event);
    };

    #onShotChange(slotId, event) {
        const value = event?.detail?.value ?? event?.target?.value ?? '';
        if (slotId === ALIGNMENT_SLOT.REFERENCE) this.shotA = value;
        else {
            this.shotB = value;
            if (!value) this.comparing = false;
        }
        this.#viewer?.select(slotId, value);
        this.dispatchEvent(new CustomEvent('shot-change', {
            detail: { slot: slotId, value },
            bubbles: true,
            composed: true,
        }));
    }

    #onOffsetChange = (event) => {
        const value = event?.detail?.offset;
        if (typeof value !== 'number') return;
        if (event?.detail?.reason === 'reset') {
            this.offset = this.#viewer ? this.#viewer.resetOffset() : 0;
            return;
        }
        this.offset = this.#viewer ? this.#viewer.setOffset(value) : value;
    };
}

customElements.define('history-screen', HistoryScreen);
