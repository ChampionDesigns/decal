/**
 * The chart's key: one entry per channel, each able to turn its trace off.
 */

import { css, html, nothing } from 'lit';

import { UiElement, hitArea } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { DASH_PATTERNS } from 'src/lib/chart-axis.js';
import { channelNameFor, channelToken, readChartTokens, resolveChannels } from 'src/lib/chart-tokens.js';
import { logger } from 'src/lib/logger.js';

export const DOUBLE_TAP_MS = 320;

function normaliseItem(item) {
    const raw = typeof item === 'string' ? { key: item } : (item ?? {});
    const key = String(raw.key ?? '');
    return {
        key,
        channel: channelNameFor(key),
        label: typeof raw.label === 'string' ? raw.label : '',
        minor: raw.minor === true,
        dash: typeof raw.dash === 'string' && Object.hasOwn(DASH_PATTERNS, raw.dash) ? raw.dash : null,
        off: raw.off === true,
    };
}

export class UiChartLegend extends UiElement {
    static properties = {
        items: { type: Array },

        /** Accessible name for the GROUP, put on the host as `aria-label`. */
        label: { type: String },

        values: { type: Object },

        chart: { attribute: 'chart' },
    };

    static styles = [hitArea, typeRoles, css`
        :host {
            display: block;

            --_ui-off-opacity: .35;
            --_ui-swatch-w: var(--ui-legend-swatch-w);
        }

        .row {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            column-gap: var(--ui-space-3);
            row-gap: var(--ui-space-2);
            min-inline-size: 0;
        }

        .chip {
            display: inline-flex;
            align-items: center;
            gap: var(--ui-space-2);
            min-block-size: var(--ui-legend-chip-h);
            max-inline-size: 100%;
            padding-inline: var(--ui-space-3);
            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);
            background-color: var(--ui-key);
            color: var(--ui-text-2);
            font-family: inherit;
            font-size: var(--ui-chart-legend);
            font-weight: var(--ui-weight-medium);
            line-height: 1.2;
            text-align: start;
            cursor: pointer;
        }

        .chip[aria-pressed="false"] {
            background-color: transparent;
            color: var(--ui-muted);
        }

        .chip[aria-pressed="false"] .swatch {
            opacity: var(--_ui-off-opacity);
        }

        .swatch {
            flex: none;
            inline-size: var(--_ui-swatch-w);
            block-size: var(--ui-chart-stroke);
            overflow: visible;
        }

        .swatch line {
            stroke: var(--_ui-swatch-ink, currentColor);
            stroke-width: var(--ui-chart-stroke);
            stroke-dasharray: var(--_ui-swatch-dash, none);
            stroke-linecap: butt;
        }

        .chip[data-minor] .swatch line {
            stroke-width: var(--ui-chart-stroke-minor);
        }

        .label {
            min-inline-size: 0;
            overflow-wrap: anywhere;
        }

        .value {
            flex: none;
            color: var(--ui-muted);
            font-variant-numeric: tabular-nums lining-nums;
        }
    `];

    constructor() {
        super();
        this.items = [];
        this.label = '';
        this.values = null;
        this.chart = null;
    }

    /** Keys currently turned off. A Set, so isolate is one pass. */
    #hidden = new Set();

    /** The last pointer tap, for the 320ms isolate window. */
    #lastTapAt = 0;
    #lastTapKey = null;
    #lastWasToggle = false;

    /** Channel names whose token resolved to nothing at the last check. */
    #unresolved = Object.freeze([]);

    /** ui-bank.js:520-540's capture, for the same reason: never overwrite the screen's. */
    #authorRole = null;
    #authorLabel = null;
    #captured = false;

    get series() { return this.#items(); }

    /** The keys currently turned off, in item order. */
    get hiddenKeys() { return this.#items().filter((i) => this.#hidden.has(i.key)).map((i) => i.key); }

    /** True while a series is drawn. */
    isVisible(key) { return !this.#hidden.has(String(key)); }

    get unresolvedChannels() { return this.#unresolved; }

    /** Show or hide one series. The road in for a screen restoring saved state. */
    setVisible(key, visible, reason = 'set') {
        const id = String(key);
        if (visible) this.#hidden.delete(id);
        else this.#hidden.add(id);
        this.#commit(id, visible, reason);
    }

    isolate(key) {
        const id = String(key);
        const items = this.#items();
        const alreadyAlone = items.every((item) => (item.key === id) === !this.#hidden.has(item.key));
        this.#hidden = new Set(alreadyAlone ? [] : items.filter((i) => i.key !== id).map((i) => i.key));
        this.#commit(id, !this.#hidden.has(id), alreadyAlone ? 'restore' : 'isolate');
    }

    reset() {
        this.#hidden = new Set();
        this.#commit(null, true, 'reset');
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.#captured) {
            this.#authorRole = this.getAttribute('role');
            this.#authorLabel = this.getAttribute('aria-label');
            this.#captured = true;
        }
    }

    willUpdate(changed) {
        super.willUpdate?.(changed);
        if (!changed.has('items')) return;
        const live = new Set(this.#items().map((item) => item.key));
        for (const key of [...this.#hidden]) if (!live.has(key)) this.#hidden.delete(key);
        for (const item of this.#items()) if (item.off) this.#hidden.add(item.key);
        this.#checkChannels();
    }

    updated(changed) {
        super.updated(changed);
        if (this.#authorRole === null) this.setAttribute('role', 'group');
        if (this.label) this.setAttribute('aria-label', this.label);
        else if (this.#authorLabel !== null) this.setAttribute('aria-label', this.#authorLabel);
        else this.removeAttribute('aria-label');
        /* A chart bound after the items arrived starts out of step with the chips. */
        if (changed.has('chart') || changed.has('items')) this.#applyToChart();
    }

    render() {
        const values = this.values ?? {};
        return html`<div
            class="row"
            part="row"
        >${this.#items().map((item) => {
            const visible = !this.#hidden.has(item.key);
            const value = values[item.key];
            return html`<button
                type="button"
                class="chip hit-overlay"
                part="item"
                id=${`chip-${item.key}`}
                data-key=${item.key}
                ?data-minor=${item.minor}
                aria-pressed=${visible ? 'true' : 'false'}
                style=${`--_ui-swatch-ink: var(${channelToken(item.channel)});`
                    + (item.dash ? ` --_ui-swatch-dash: ${DASH_PATTERNS[item.dash].join(' ')};` : '')}
                @click=${(event) => this.#onClick(event, item.key)}
            ><svg class="swatch" part="swatch" aria-hidden="true"
                ><line x1="0" y1="50%" x2="100%" y2="50%"></line></svg
            ><span class="label" part="label">${item.label}</span
            >${value === undefined || value === null || value === ''
                ? nothing
                : html`<span class="value ui-numeric" part="value">${value}</span>`}</button>`;
        })}</div>`;
    }

    #items() {
        return (Array.isArray(this.items) ? this.items : []).map(normaliseItem).filter((i) => i.key);
    }

    #onClick(event, key) {
        const pointer = Number(event.detail) !== 0;
        const now = event.timeStamp;
        const isDouble = pointer && this.#lastTapKey === key && (now - this.#lastTapAt) < DOUBLE_TAP_MS;
        const undoable = this.#lastWasToggle;
        this.#lastTapAt = pointer ? now : 0;
        this.#lastTapKey = pointer ? key : null;
        this.#lastWasToggle = !isDouble;
        if (isDouble) {
            if (undoable) {
                if (this.#hidden.has(key)) this.#hidden.delete(key);
                else this.#hidden.add(key);
            }
            this.isolate(key);
        } else {
            this.setVisible(key, this.#hidden.has(key), 'toggle');
        }
    }

    /** Paint, drive the plot if there is one, and say what happened — in that order. */
    #commit(key, visible, reason) {
        this.requestUpdate();
        this.#applyToChart();
        this.dispatchEvent(new CustomEvent('legend-change', {
            bubbles: true,
            composed: true,
            detail: { key, visible, reason, hidden: this.hiddenKeys },
        }));
    }

    /** The bound chart, by reference or by id in this legend's own root. */
    get #chartElement() {
        const chart = this.chart;
        if (!chart) return null;
        if (typeof chart !== 'string') return chart;
        const root = this.getRootNode?.();
        return root?.getElementById?.(chart) ?? null;
    }

    #applyToChart() {
        const chart = this.#chartElement;
        const handle = chart?.plotHandle;
        const channels = chart?.channels;
        if (!handle?.setSeriesVisible || !Array.isArray(channels)) return false;
        let applied = 0;
        for (const item of this.#items()) {
            const index = channels.findIndex((c) => c.key === item.key
                || channelNameFor(c.key) === item.channel);
            if (index < 0) continue;
            handle.setSeriesVisible(index, !this.#hidden.has(item.key));
            applied += 1;
        }
        return applied > 0;
    }

    #checkChannels() {
        const items = this.#items();
        if (!items.length) { this.#unresolved = Object.freeze([]); return; }
        let tokens;
        try {
            tokens = readChartTokens(this, { strict: false });
        } catch {
            return;                       // no getComputedStyle: not connected yet
        }
        const { unresolved } = resolveChannels(items.map((i) => i.key), tokens.channels, { strict: false });
        this.#unresolved = unresolved;
        if (unresolved.length) {
            logger.error(
                `ui-chart-legend: ${unresolved.length} channel(s) have no colour — ${unresolved.join(', ')}. `
                + 'The swatch falls back to the chip\'s own ink; every drawn channel needs a token in '
                + 'styles/chart-channels.css and, if its key is a derivation key, an entry in '
                + 'SERIES_KEY_CHANNELS.',
            );
        }
    }
}

customElements.define('ui-chart-legend', UiChartLegend);
