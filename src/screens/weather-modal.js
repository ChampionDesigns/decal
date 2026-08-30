/**
 * The.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';
import { weatherIcon } from 'src/lib/icons.js';
import {
    MODAL_PERIODS, conditionWord, hoursOf, markFor, unitsOf, windowOf,
} from 'src/lib/weather-model.js';
import { typeRoles } from 'src/components/type-roles.js';

import 'src/components/ui-dialog.js';

export class WeatherModal extends UiElement {
    static properties = {
        open: { type: Boolean, reflect: true },
        /** The plugin's last frame, verbatim. */
        reading: { attribute: false },
        /** True while a written location is in flight. */
        saving: { type: Boolean },
        editing: { type: Boolean },
    };

    #i18n = new I18nController(this);

    constructor() {
        super();
        this.open = false;
        this.reading = null;
        this.saving = false;
        this.editing = false;
    }

    static styles = [typeRoles, css`
        :host { display: contents; }

        .body { display: flex; flex-direction: column; gap: var(--ui-space-3); }

        .now { display: flex; align-items: center; gap: var(--ui-space-3); }
        .now .glyph { display: block; color: var(--ui-text-2); }
        .now .glyph svg { display: block; inline-size: 72px; block-size: 72px; }
        .now .stack { display: flex; flex-direction: column; gap: 2px; }
        .now .big { display: flex; align-items: baseline; gap: 4px; font-variant-numeric: tabular-nums; }
        .now .big .value {
            font-size: var(--ui-display-lg);
            font-weight: 500;
            line-height: 1;
            letter-spacing: -.025em;
            color: var(--ui-channel-group-temperature);
        }
        .now .big .unit { font-size: var(--ui-text-md); color: var(--ui-muted); }
        .now .word { font-size: var(--ui-text-md); }
        .now .feels { font-size: var(--ui-text-2xs); color: var(--ui-muted); }

        /* THE THREE PARTS OF THE DAY. A bar each, because a percentage is easier to
           compare as a length than as a number, and the three are read together. */
        .rain {
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            padding: var(--ui-space-2);
            display: flex;
            flex-direction: column;
            gap: var(--ui-space-2);
        }
        .rain > .caption {
            font-size: var(--ui-text-xs);
            font-weight: 600;
            letter-spacing: .09em;
            text-transform: uppercase;
            color: var(--ui-muted);
        }
        .part {
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: baseline;
            column-gap: var(--ui-space-2);
            row-gap: 3px;
        }
        .part .when { font-size: var(--ui-text-note); }
        .part .hours { grid-column: 1; font-size: var(--ui-text-xs); color: var(--ui-muted); }
        .part .pc {
            grid-column: 2;
            grid-row: 1 / span 2;
            align-self: center;
            font-size: var(--ui-text-2xl);
            font-variant-numeric: tabular-nums;
        }
        .part .pc .unit { font-size: var(--ui-text-2xs); color: var(--ui-muted); }
        .part .bar {
            grid-column: 1 / -1;
            block-size: 4px;
            border-radius: var(--ui-radius-pill);
            background: var(--ui-key-on);
            overflow: hidden;
        }
        .part .bar i { display: block; block-size: 100%; background: var(--ui-channel-flow); }
        .part .mm { grid-column: 1 / -1; font-size: var(--ui-text-xs); color: var(--ui-text-2); }

        .grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: var(--ui-border-w);
            background: var(--ui-line);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            overflow: hidden;
        }
        .cell {
            background: var(--ui-surface);
            padding: var(--ui-space-2);
            display: flex;
            flex-direction: column;
            gap: 3px;
        }
        .cell .lab {
            font-size: var(--ui-text-xs);
            font-weight: 600;
            letter-spacing: .09em;
            text-transform: uppercase;
            color: var(--ui-muted);
        }
        .cell .v { font-size: var(--ui-text-2xl); font-variant-numeric: tabular-nums; }
        .cell .v .unit { font-size: var(--ui-text-2xs); color: var(--ui-muted); margin-inline-start: 2px; }

        .place { display: flex; flex-direction: column; gap: var(--ui-space-2); }
        .place .lab {
            font-size: var(--ui-text-xs);
            font-weight: 600;
            letter-spacing: .09em;
            text-transform: uppercase;
            color: var(--ui-muted);
        }
        .place .row { display: flex; gap: var(--ui-space-2); }
        .place input {
            flex: 1 1 auto;
            min-inline-size: 0;
            font: inherit;
            font-size: var(--ui-text-md);
            color: var(--ui-text);
            background: var(--ui-surface);
            border: var(--ui-border-w) solid var(--ui-line-strong);
            border-radius: var(--ui-radius);
            padding: var(--ui-space-2);
        }
        .place input:focus-visible {
            outline: var(--ui-border-w-strong) solid var(--ui-steel);
            outline-offset: 1px;
        }
        .place .save {
            font: inherit;
            font-size: var(--ui-text-base);
            padding: var(--ui-space-2) var(--ui-space-3);
            border-radius: var(--ui-radius);
            border: var(--ui-border-w) solid var(--ui-primary);
            background: var(--ui-primary);
            color: var(--ui-on-primary);
            cursor: pointer;
        }
        .place .save[disabled] { opacity: .5; cursor: default; }
        .place .save.ghost {
            background: var(--ui-key);
            color: var(--ui-text);
            border-color: var(--ui-line);
        }
        .place .current {
            flex: 1 1 auto;
            min-inline-size: 0;
            font-size: var(--ui-text-md);
            align-self: center;
        }
        .place .note { font-size: var(--ui-text-xs); color: var(--ui-muted); }

        .stamp { font-size: var(--ui-text-xs); color: var(--ui-muted); text-align: end; }
    `];

    show({ invoker = null } = {}) {
        this.open = true;
        const dialog = this.renderRoot?.querySelector?.('#dialog');
        if (dialog) dialog.show({ invoker, reason: 'press' });
    }

    hide(reason = 'api') {
        const dialog = this.renderRoot?.querySelector?.('#dialog');
        if (dialog) dialog.hide(reason);
        this.open = false;
    }

    render() {
        const t = this.#i18n.t;
        const reading = this.reading;
        return html`<ui-dialog
            id="dialog"
            ?open=${this.open}
            heading=${t('Weather')}
            label=${t('Weather')}
            @open-change=${this.#onOpenChange}
        >
            ${reading && reading.ok ? this.#renderBody(reading) : this.#renderEmpty()}
        </ui-dialog>`;
    }

    #renderEmpty() {
        const t = this.#i18n.t;
        return html`<div class="body">
            <p class="note">${t('No reading yet. Set a location below and it will arrive shortly.')}</p>
            ${this.#renderPlace()}
        </div>`;
    }

    #renderBody(reading) {
        const t = this.#i18n.t;
        const units = unitsOf(reading);
        const periods = windowOf(reading, MODAL_PERIODS);
        return html`<div class="body">
            <div class="now">
                <span class="glyph">${weatherIcon(markFor(reading.code, reading.isDay))}</span>
                <div class="stack">
                    <div class="big">
                        <span class="value">${reading.temperature}</span
                        ><span class="unit">${units.temperature}</span>
                    </div>
                    <span class="word">${t(conditionWord(reading.code, reading.isDay))}</span>
                    ${typeof reading.apparent === 'number' ? html`<span class="feels"
                    >${t('Feels like')} ${reading.apparent} ${units.temperature}</span>` : nothing}
                </div>
            </div>

            ${periods.length ? html`<div class="rain">
                <span class="caption">${t('Rain today')}</span>
                ${periods.map((p) => this.#renderPart(p, units))}
            </div>` : nothing}

            <div class="grid">
                ${this.#cell(t('Humidity'), reading.humidity, '%')}
                ${this.#cell(t('Dew point'), reading.dewPoint, units.temperature)}
                ${this.#cell(t('Wind'), reading.wind,
                    reading.windFrom ? `${units.wind} ${reading.windFrom}` : units.wind)}
                ${this.#cell(t('Pressure'), reading.pressure, 'hPa')}
            </div>

            ${this.#renderPlace()}

            ${typeof reading.ageMinutes === 'number' ? html`<span class="stamp"
            >${t('Updated')} ${reading.ageMinutes} ${t('min ago')} · Open-Meteo</span>` : nothing}
        </div>`;
    }

    #renderPart(period, units) {
        const t = this.#i18n.t;
        const pc = typeof period.probability === 'number' ? period.probability : null;
        return html`<div class="part">
            <span class="when">${t(period.label)}${period.tomorrow ? ` · ${t('tomorrow')}` : ''}</span>
            <span class="hours">${hoursOf(period)}</span>
            <span class="pc">${pc === null ? html`&mdash;` : html`${pc}<span class="unit">%</span>`}</span>
            <div class="bar"><i style=${`width:${pc === null ? 0 : pc}%`}></i></div>
            ${typeof period.amount === 'number' ? html`<span class="mm"
            >${period.amount} ${units.rain} ${t('expected')}</span>` : nothing}
        </div>`;
    }

    #cell(label, value, unit) {
        return html`<div class="cell">
            <span class="lab">${label}</span>
            <span class="v">${typeof value === 'number' ? html`${value}<span
                class="unit"
            >${unit}</span>` : html`&mdash;`}</span>
        </div>`;
    }

    #renderPlace() {
        const t = this.#i18n.t;
        const place = this.reading && this.reading.place ? this.reading.place : '';
        if (!this.editing) {
            return html`<div class="place">
                <span class="lab">${t('Location')}</span>
                <div class="row">
                    <span class="current">${place || t('Not set')}</span>
                    <button
                        class="save ghost"
                        type="button"
                        @click=${this.#edit}
                    >${place ? t('Change') : t('Set')}</button>
                </div>
            </div>`;
        }
        return html`<div class="place">
            <span class="lab">${t('Location')}</span>
            <div class="row">
                <input
                    id="place"
                    type="text"
                    autofocus
                    .value=${place}
                    placeholder=${t('Town or suburb, with the state and country')}
                    aria-label=${t('Location')}
                    @keydown=${this.#onKey}
                >
                <button
                    class="save"
                    type="button"
                    ?disabled=${this.saving}
                    @click=${this.#save}
                >${this.saving ? t('Saving') : t('Save')}</button>
            </div>
            <span class="note">${t('Name the state and country too — four places are called Brunswick.')}</span>
        </div>`;
    }

    #edit = () => {
        this.editing = true;
        /* The field carries `autofocus`, which `ui-dialog` honours — but only at OPEN.
         * Revealed later it has to be asked for, and after the render that creates it. */
        this.updateComplete.then(() => {
            const field = this.renderRoot?.querySelector?.('#place');
            if (field) field.focus();
        });
    };

    #onKey = (event) => {
        if (event.key === 'Enter') this.#save();
    };

    /**
     * THE SCREEN OWNS THE TRANSPORT. This says what was typed and nothing else — the same
     * rule the rest of this file follows, and the reason a component here never holds a
     * route.
     */
    #save = () => {
        const field = this.renderRoot?.querySelector?.('#place');
        const value = field ? String(field.value || '').trim() : '';
        if (!value) return;
        this.editing = false;
        this.dispatchEvent(new CustomEvent('weather-location', {
            detail: { location: value },
            bubbles: true,
            composed: true,
        }));
    };

    #onOpenChange = (event) => {
        this.open = Boolean(event.detail && event.detail.open);
    };
}

customElements.define('weather-modal', WeatherModal);
