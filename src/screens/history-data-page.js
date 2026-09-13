/**
 * <history-data-page>, the History route's second page.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import { historyPhaseColumns, historyPhaseRows } from 'src/lib/live-targets.js';
import { HISTORY_COLUMNS } from 'src/lib/shot-summary.js';
import { ALIGNMENT_SLOT } from 'src/lib/alignment-offset.js';
import { DEFAULT_TEMP_UNIT, normaliseUnit } from 'src/lib/temperature.js';
/* The port's reader for the port's typed failure — the same two sentences the flow
 * page shows, from the same function, so one fault is not described two ways. */
import { failureRefusal } from 'src/lib/history-viewer.js';
/** The one dash spelling in the tree, borrowed from the component that owns it
 *  rather than typed again here — `live-screen.js:239` does the same, and
 *  `shot-summary.js`'s DEFAULT_DASH is the same character. */
import { DEFAULT_DATA_GRID_DASH } from 'src/components/ui-data-grid.js';

import 'src/components/ui-data-grid.js';
import 'src/components/ui-empty-state.js';
import 'src/components/ui-pick-disc.js';

import 'src/components/ui-button.js';
/** The mount contract's `data-page` value. */
export const DATA_PAGE_ID = 'data';

const LIST_HEADINGS = Object.freeze({
    date: 'Date',
    time: 'Time',
    profile: 'Profile',
    duration: 'Shot',
    yield: 'Out',
    peakPressure: 'Peak',
    averageFlow: 'Flow',
    enjoyment: 'Rating',
});

const SLOTS = Object.freeze([
    Object.freeze({
        slot: ALIGNMENT_SLOT.REFERENCE,
        letter: 'A',
        name: 'Show as A — {shot}',
        clear: 'Clear A — {shot}',
    }),
    Object.freeze({
        slot: ALIGNMENT_SLOT.MOVING,
        letter: 'B',
        name: 'Compare as B — {shot}',
        clear: 'Clear B — {shot}',
    }),
]);

export class HistoryDataPage extends UiElement {
    static properties = {
        /** Shot A's gate-6 derivation, for the first phase table. */
        derivationA: { attribute: false },

        /** Shot B's, or null — the table then says "No comparison shot" and means it. */
        derivationB: { attribute: false },

        failure: { attribute: false },

        rows: { attribute: false },

        /** The shot the band has in slot A, so its row can be marked in the list. */
        shotA: { type: String, attribute: 'shot-a' },

        /** The shot in slot B. */
        shotB: { type: String, attribute: 'shot-b' },
        listWindow: { attribute: false },
        tempUnit: { type: String, attribute: 'temp-unit' },
    };

    static styles = [typeRoles, css`
        :host {
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
            grid-template-columns: 1fr 1fr;
            gap: var(--ui-space-5) var(--ui-space-6);
            min-block-size: 0;
            min-inline-size: 0;
        }

        #list-region {
            grid-column: 1 / -1;
            display: grid;
            grid-template-rows: minmax(0, 1fr) auto;
            gap: var(--ui-space-2);
            min-block-size: 0;
            min-inline-size: 0;
        }
        #pager {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--ui-space-4);
            min-inline-size: 0;
        }
        #pager .range {
            color: var(--ui-text-2);
            min-inline-size: 0;
        }
        #pager .moves {
            display: flex;
            align-items: center;
            gap: var(--ui-space-3);
            flex: none;
        }

        @media (max-width: 1100px) {
            :host {
                grid-template-columns: minmax(0, 1fr);

                grid-template-rows: auto auto minmax(0, 1fr);
            }
        }

        .phase {
            display: grid;
            grid-template-rows: auto auto;
            gap: var(--ui-space-2);
            min-inline-size: 0;
        }

        .caption {
            display: flex;
            align-items: center;
            gap: var(--ui-space-4);
            min-inline-size: 0;
            padding-block-start: var(--ui-space-3);
        }

        .shot {
            color: var(--ui-text-2);
            min-inline-size: 0;
        }

        #table-a,
        #table-b {
            block-size: min-content;
            min-inline-size: 0;
        }

        /* THE ONE SCROLL REGION, floored on the token and never on a literal. The floor is
         * a PROPOSAL (M18) and lives in styles/tokens.css carrying that note. */
        #shot-list {
            min-block-size: var(--ui-history-list-min-h);
            min-inline-size: 0;
        }
    `];

    #i18n = new I18nController(this);

    constructor() {
        super();
        this.derivationA = null;
        this.derivationB = null;
        this.failure = null;
        this.rows = null;
        this.shotA = '';
        this.shotB = '';
        this.listWindow = null;
        this.tempUnit = DEFAULT_TEMP_UNIT;
    }
    get #unit() {
        return normaliseUnit(this.tempUnit) ?? DEFAULT_TEMP_UNIT;
    }

    /** The mount contract, filled in by the page that knows the answers. See the flow page. */
    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('slot')) this.setAttribute('slot', 'page');
        if (!this.hasAttribute('data-page')) this.setAttribute('data-page', DATA_PAGE_ID);
    }

    render() {
        const t = this.#i18n.t;
        const rows = Array.isArray(this.rows) ? this.rows : [];
        /* null unless the store reported a failure, in which case every surface with
         * nothing to show says what the machine said instead of guessing on its behalf. */
        const refusal = failureRefusal(this.failure, t);
        return html`
            ${this.#renderPhaseTable('a', 'A', this.shotA, this.derivationA, t('Shot A'),
                (this.shotA && refusal?.heading) || t('No shot selected'))}
            ${this.#renderPhaseTable('b', 'B', this.shotB, this.derivationB, t('Shot B'),
                (this.shotB && refusal?.heading) || t('No comparison shot'))}

            <div id="list-region">
                <ui-data-grid
                    id="shot-list"
                    label=${t('Recorded shots')}
                    dash=${DEFAULT_DATA_GRID_DASH}
                    .columns=${this.#listColumns()}
                    .rows=${rows.map((row) => this.#listRow(row))}
                >
                    ${rows.map((row) => this.#renderPicks(row))}
                    <ui-empty-state
                        slot="empty"
                        heading=${refusal?.heading ?? t('No shots recorded yet')}
                        body=${refusal?.body ?? t('Pull a shot and it will be listed here.')}
                    ></ui-empty-state>
                </ui-data-grid>
                ${this.#renderPager(rows.length)}
            </div>
        `;
    }

    #renderPager(shown) {
        const t = this.#i18n.t;
        const view = this.listWindow;
        const total = Number.isFinite(view?.total) ? view.total : null;
        const size = Number.isFinite(view?.size) && view.size > 0 ? view.size : 0;
        const offset = Number.isFinite(view?.offset) && view.offset > 0 ? view.offset : 0;
        const failed = Boolean(view?.failed);
        const busy = Boolean(view?.busy);
        if (total === null || size === 0) return nothing;
        if (total <= size && offset === 0 && !failed) return nothing;
        const from = shown ? offset + 1 : 0;
        const to = offset + shown;
        return html`
            <div id="pager" part="pager">
                <span class="range ui-caption" role="status" aria-live="polite"
                    >${failed
                        ? t('That page of shots did not arrive. The list below is the last one that did.')
                        : (busy
                            ? t('Loading shots…')
                            : t('Showing {from}-{to} of {total}', { from, to, total }))}</span
                >
                <span class="moves">
                    <ui-button
                        id="page-newer"
                        ?disabled=${busy || offset === 0}
                        @click=${() => this.#turnPage(-1)}
                        >${t('Newer')}</ui-button
                    >
                    <ui-button
                        id="page-older"
                        ?disabled=${busy || (!failed && to >= total)}
                        @click=${() => this.#turnPage(1)}
                        >${failed ? t('Try again') : t('Older')}</ui-button
                    >
                </span>
            </div>`;
    }
    #turnPage(delta) {
        this.dispatchEvent(new CustomEvent('page-change', {
            bubbles: true,
            composed: true,
            detail: { delta },
        }));
    }
    #renderPhaseTable(slot, letter, id, derivation, name, refusal) {
        const t = this.#i18n.t;
        const ok = Boolean(derivation && derivation.ok);
        const shot = this.#identityOf(id);
        return html`
            <section id="phase-${slot}" class="phase">
                <div class="caption">
                    <ui-pick-disc
                        id="disc-${slot}"
                        label=${name}
                        ?selected=${Boolean(shot)}
                        >${letter}</ui-pick-disc
                    >
                    <span id="shot-${slot}" class="shot ui-body">${shot ?? ''}</span>
                </div>

                <ui-data-grid
                    id="table-${slot}"
                    label=${shot
                        ? t('{name} by phase, {shot}', { name, shot })
                        : t('{name} by phase', { name })}
                    row-header-label=${t('Phase')}
                    dash=${DEFAULT_DATA_GRID_DASH}
                    .columns=${historyPhaseColumns(this.#unit)
                        .map((column) => ({ ...column, label: t(column.label) }))}
                    .rows=${ok
                        ? historyPhaseRows(derivation, this.#unit)
                            .map((row) => ({ ...row, header: t(row.header) }))
                        : []}
                >
                    <ui-empty-state slot="empty" heading=${refusal}></ui-empty-state>
                </ui-data-grid>
            </section>`;
    }

    #identityOf(id) {
        if (!id) return null;
        const rows = Array.isArray(this.rows) ? this.rows : [];
        const label = rows.find((row) => row && row.id === id)?.label;
        return typeof label === 'string' && label !== '' ? label : null;
    }

    #listColumns() {
        const t = this.#i18n.t;
        return [...HISTORY_COLUMNS.map((column) => ({
            key: column.key,
            label: t(LIST_HEADINGS[column.key] ?? column.key),
            align: column.align,
            grow: column.grow,
            ink: column.ink,
        })), {
            key: 'picks',
            label: t('Charts'),
            align: 'end',
            grow: 0,
            slot: true,
        }];
    }

    #renderPicks(row) {
        const t = this.#i18n.t;
        const id = row?.id ?? '';
        if (!id) return nothing;
        const label = row?.label ?? '';
        return SLOTS.map(({ slot, letter, name, clear }) => {
            const current = slot === ALIGNMENT_SLOT.REFERENCE ? this.shotA : this.shotB;
            const chosen = current === id;
            return html`<ui-pick-disc
                slot="cell-${id}-picks"
                data-pick=${slot}
                data-shot=${id}
                form="pick"
                interactive
                ?selected=${chosen}
                label=${t(chosen ? clear : name, { shot: label })}
                @pick=${() => this.#onPick(slot, chosen ? '' : id)}
                >${letter}</ui-pick-disc>`;
        });
    }

    #onPick(slot, value) {
        this.dispatchEvent(new CustomEvent('shot-change', {
            detail: { slot, value },
            bubbles: true,
            composed: true,
        }));
    }

    #listRow(row) {
        const cells = {};
        for (const column of HISTORY_COLUMNS) {
            cells[column.key] = row?.cells?.[column.key]?.text ?? null;
        }
        return {
            key: row?.id ?? '',
            cells,
            emphasis: Boolean(row?.id) && (row.id === this.shotA || row.id === this.shotB),
        };
    }
}

customElements.define('history-data-page', HistoryDataPage);
