/**
 * The live screen's bottom-right corner.
 */

import { css, html, nothing } from 'lit';

import { UiElement } from 'src/components/base.js';
import { I18nController } from 'src/lib/i18n.js';
import { placeIcon, weatherIcon } from 'src/lib/icons.js';
import {
    CORNER_PERIODS, WEATHER_STATE, markFor, rangeOf, unitsOf, weatherState, wetIndex,
    windowOf,
} from 'src/lib/weather-model.js';
import { typeRoles } from 'src/components/type-roles.js';

export class UiWeatherCorner extends UiElement {
    static properties = {
        /** The plugin's last frame, verbatim. Null until one arrives. */
        reading: { attribute: false },
    };

    #i18n = new I18nController(this);

    constructor() {
        super();
        this.reading = null;
    }

    static styles = [typeRoles, css`
        :host {
            display: block;
            inline-size: 290px;
            block-size: 100%;
        }

        .card {
            inline-size: 100%;
            block-size: 100%;
            /* NO SURFACE, NO BORDER, NO RADIUS AT REST - see the header. The band's
               other blocks have none either. */
            background: none;
            border: 0;
            border-radius: var(--ui-radius);
            /* 8px sides, not 12: it is what widens each half of the strip to 68px, which
             * is what lets NIGHT fit. See the header. */
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            color: var(--ui-text);
            font: inherit;
            text-align: inherit;
            cursor: pointer;
            transition: background .14s ease;
        }

        .card:hover { background: var(--ui-key); }
        .card:focus-visible {
            outline: var(--ui-border-w-strong) solid var(--ui-steel);
            outline-offset: -2px;
            background: var(--ui-key);
        }
        @media (prefers-reduced-motion: reduce) {
            .card { transition: none; }
        }

        .glyph {
            display: block;
            color: var(--ui-text-2);
        }
        .glyph svg {
            display: block;
            inline-size: 44px;
            block-size: 44px;
        }

        /* THE HEAD, SIDEWAYS. One line, mark then temperature, and the row is the full
         * width so anything added later has a place to sit. */
        .head {
            inline-size: 100%;
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .range {
            margin-inline-start: auto;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 2px;
            line-height: 1.15;
        }
        .range .pair { display: flex; align-items: baseline; gap: 7px; }
        .range .k {
            font-size: var(--ui-text-2xs);
            font-weight: 600;
            letter-spacing: .06em;
            text-transform: uppercase;
            color: var(--ui-muted);
        }
        .range .v {
            font-size: var(--ui-text-md);
            color: var(--ui-text-2);
            font-variant-numeric: tabular-nums;
        }
        .prompt .glyph svg {
            inline-size: 40px;
            block-size: 40px;
        }

        .temp {
            display: flex;
            align-items: baseline;
            gap: 3px;
            font-variant-numeric: tabular-nums;
        }
        .temp .value {
            /* 40, not --ui-display-lg's 45. See THE TEMPERATURE in the header. */
            font-size: 40px;
            font-weight: 500;
            line-height: 1.05;
            letter-spacing: -.02em;
            color: var(--ui-channel-group-temperature);
        }
        .temp .unit { font-size: var(--ui-text-2xs); color: var(--ui-muted); }

        .rain {
            flex: 1 1 auto;
            inline-size: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0;
        }
        .rain .title {
            align-self: stretch;
            text-align: center;
            border-block-start: var(--ui-border-w) solid var(--ui-seam-ink);
            font-size: var(--ui-text-md);
            font-weight: 600;
            letter-spacing: .14em;
            text-transform: uppercase;
            color: var(--ui-muted);
            line-height: 1.2;
            padding-block: 6px 4px;
        }
        .halves {
            flex: 1 1 auto;
            inline-size: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr;
            align-items: stretch;
        }
        .half { display: flex; flex-direction: column; align-items: center;
                justify-content: space-between; }
        .half .label {
            font-size: var(--ui-text-note);
            font-weight: 600;
            letter-spacing: .04em;
            text-transform: uppercase;
            color: var(--ui-muted);
            line-height: 1.4;
        }
        .half .chance {
            font-size: var(--ui-text-lg);
            font-variant-numeric: tabular-nums;
            line-height: 1.15;
        }
        .half .amount {
            font-size: var(--ui-text-base);
            color: var(--ui-text-2);
            font-variant-numeric: tabular-nums;
            line-height: 1.3;
        }
        .half .unit { font-size: var(--ui-text-2xs); color: var(--ui-muted); }
        .half.wet .chance { color: var(--ui-channel-flow); }

        /* The prompt: no location has ever been set, so the corner asks once. */
        .card.prompt { justify-content: center; gap: 10px; }
        .prompt .ask { font-size: var(--ui-text-note); color: var(--ui-text-2); text-align: center; }
        .prompt .where { font-size: var(--ui-text-xs); color: var(--ui-muted); text-align: center; }
    `];

    render() {
        const state = weatherState(this.reading);
        if (state === WEATHER_STATE.HIDDEN) return nothing;
        if (state === WEATHER_STATE.PROMPT) return this.#renderPrompt();
        return this.#renderReading();
    }

    #renderPrompt() {
        const t = this.#i18n.t;
        return html`<button
            class="card prompt"
            type="button"
            @click=${this.#open}
        >
            <span class="glyph">${placeIcon()}</span>
            <span class="ask">${t('Set your location')}</span>
            <span class="where">${t('Press to choose a place')}</span>
        </button>`;
    }

    #renderReading() {
        const t = this.#i18n.t;
        const reading = this.reading;
        const units = unitsOf(reading);
        const periods = windowOf(reading, CORNER_PERIODS);
        const wet = wetIndex(periods);
        /* NULL ON A TABLET STILL RUNNING weather.reaplugin 1.0.x, which sends neither
         * field. The pair is then simply absent — the head keeps its shape. */
        const range = rangeOf(reading);

        return html`<button
            class="card"
            type="button"
            aria-label=${t('Weather. Press for detail.')}
            @click=${this.#open}
        >
            <div class="head">
                <span class="glyph">${weatherIcon(markFor(reading.code, reading.isDay))}</span>
                <div class="temp">
                    <span class="value">${Math.round(reading.temperature)}</span
                    ><span class="unit">${units.temperature}</span>
                </div>
                ${range ? html`<div class="range">
                    <span class="pair"><span class="k">${t('Max')}</span
                        ><span class="v num">${Math.round(range.high)}&deg;</span></span>
                    <span class="pair"><span class="k">${t('Min')}</span
                        ><span class="v num">${Math.round(range.low)}&deg;</span></span>
                </div>` : nothing}
            </div>
            ${periods.length ? html`<div class="rain">
                <span class="title">${t('Chance of rain')}</span>
                <div class="halves">
                    ${periods.map((period, i) => html`
                        <div class="half ${i === wet ? 'wet' : ''}">
                            <span class="label">${t(period.label)}</span>
                            <span class="chance">${this.#chance(period)}</span>
                            <span class="amount">${this.#amount(period, units)}</span>
                        </div>`)}
                </div>
            </div>` : nothing}
        </button>`;
    }

    #open = () => {
        this.dispatchEvent(new CustomEvent('weather-open', { bubbles: true, composed: true }));
    };

    #chance(period) {
        if (typeof period.probability !== 'number') return html`&mdash;`;
        return html`${period.probability}<span
            class="unit"
        >%</span>`;
    }

    #amount(period, units) {
        if (typeof period.amount !== 'number') return nothing;
        return html`${period.amount}<span
            class="unit"
        > ${units.rain}</span>`;
    }
}

customElements.define('ui-weather-corner', UiWeatherCorner);
