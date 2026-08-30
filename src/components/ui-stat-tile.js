/**
 * <ui-stat-tile> — a labelled reading: a microcap over a number, with an optional unit beside it.
 */

import { css, html, nothing } from 'lit';
import { UiElement, visuallyHidden } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';

const NO_READING_MARK = '—';

/* What an absent reading is called out loud. */
const ABSENT_KEY = 'no reading';

export class UiStatTile extends UiElement {
    static properties = {
        label: { type: String },
        /* The reading, already formatted. null, undefined and '' are absent and render the
           dash; 0 is a reading and renders as 0. */
        value: { type: String },
        /* The unit suffix. Omitted when empty. */
        unit: { type: String },
        /* Which display step the digits read: xs|sm|md|lg|xl. */
        size: { type: String, reflect: true },
        /* The track floor, for a tile that will be promoted. */
        reserve: { type: String, reflect: true },
        /* The mark drawn for an absent reading. */
        dash: { type: String },
        _slotted: { type: Boolean, state: true },
    };

    static styles = [visuallyHidden, css`
        :host {
            container-type: normal;
            display: grid;

            --_ui-stat-value-size: var(--ui-display-lg);

            --_ui-stat-value-reserve: var(--_ui-stat-value-size);

            --_ui-stat-label-h: calc(var(--ui-text-sm) * 1.2);

            --_ui-stat-value-tracking: normal;

            --_ui-stat-unit-size: var(--ui-text-2xs);

            --_ui-stat-ink: var(--ui-text);

            grid-template-rows:
                var(--_ui-stat-label-h)
                minmax(var(--_ui-stat-value-reserve), 1fr);

            row-gap: var(--ui-space-1);

            min-inline-size: 0;
        }

        :host([size="xs"]) { --_ui-stat-value-size: var(--ui-display-xs); }
        :host([size="sm"]) { --_ui-stat-value-size: var(--ui-display-sm); }
        :host([size="md"]) { --_ui-stat-value-size: var(--ui-display-md); }
        :host([size="lg"]) { --_ui-stat-value-size: var(--ui-display-lg); }
        :host([size="xl"]) { --_ui-stat-value-size: var(--ui-display-xl); }

        :host([reserve="xs"]) { --_ui-stat-value-reserve: var(--ui-display-xs); }
        :host([reserve="sm"]) { --_ui-stat-value-reserve: var(--ui-display-sm); }
        :host([reserve="md"]) { --_ui-stat-value-reserve: var(--ui-display-md); }
        :host([reserve="lg"]) { --_ui-stat-value-reserve: var(--ui-display-lg); }
        :host([reserve="xl"]) { --_ui-stat-value-reserve: var(--ui-display-xl); }

        .label {
            grid-row: 1;
            align-self: start;

            min-inline-size: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: var(--_ui-stat-label-wrap, nowrap);

            color: var(--ui-muted);

            /* minmax, so a tile promoted mid-shot does not shrink when it is demoted again. */
            font-family: var(--ui-font-family);

            font-size: var(--ui-text-sm);

            font-weight: var(--ui-weight-semibold);

            letter-spacing: var(--ui-tracking-cap);

            line-height: var(--_ui-stat-label-h);

            text-transform: uppercase;
        }

        .value {
            grid-row: 2;
            align-self: end;
            display: flex;
            align-items: baseline;
            min-inline-size: 0;

            color: var(--_ui-stat-ink);
            font-family: var(--ui-font-family);
            font-size: var(--_ui-stat-value-size);

            font-variant-numeric: tabular-nums;

            font-weight: var(--ui-weight-light);

            letter-spacing: var(--_ui-stat-value-tracking);

            line-height: 1;

            white-space: nowrap;

            transition: font-size var(--ui-dur-slow) var(--ui-ease);
        }

        @media (prefers-reduced-motion: reduce) {
            .value { transition: none; }
        }

        .reading {
            min-inline-size: 0;
        }

        .value.is-absent {
            color: var(--ui-muted);
        }

        .unit {
            margin-inline-start: var(--ui-space-1);

            color: var(--ui-muted);

            font-size: var(--_ui-stat-unit-size);

            font-weight: var(--ui-weight-regular);

            letter-spacing: normal;
        }

        slot[name="value"] {
            display: contents;
        }

    `];

    constructor() {
        super();
        this.label = '';
        this.value = null;
        this.unit = '';
        this.size = 'lg';
        this.reserve = '';
        this.dash = NO_READING_MARK;
        this._slotted = false;
        this.i18n = new I18nController(this);
    }

    get #absent() {
        return this.value === null || this.value === undefined || this.value === '';
    }

    #onSlotChange(event) {
        const assigned = event.target.assignedNodes({ flatten: true });
        this._slotted = assigned.some(
            (node) => node.nodeType === Node.ELEMENT_NODE
                || (node.textContent || '').trim() !== '',
        );
    }

    render() {

        const own = this._slotted
            ? nothing
            : this.#absent
                ? html`<span id="reading" class="reading" aria-hidden="true"
                    >${this.dash}</span
                    >${this.unit
                        ? html`<small id="unit" class="unit" aria-hidden="true"
                            >${this.unit}</small>`
                        : nothing
                    }<span id="a11y" class="a11y">${this.i18n.t(ABSENT_KEY)}</span>`
                : html`<span id="reading" class="reading">${this.value}</span
                    >${this.unit
                        ? html`<small id="unit" class="unit">${this.unit}</small>`
                        : nothing}`;

        /* Tabular figures: proportional digits jitter sideways on every frame. */
        const valueClass = !this._slotted && this.#absent ? 'value is-absent' : 'value';

        return html`<span id="label" class="label">${this.label}</span
            ><div id="value" class=${valueClass}>${own}<slot
                name="value" @slotchange=${this.#onSlotChange}></slot></div>`;
    }
}

customElements.define('ui-stat-tile', UiStatTile);
