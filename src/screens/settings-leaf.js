/**
 * <settings-leaf>, the ONE renderer for every leaf that composes the settings row.
 */

import { css, html, nothing } from 'lit';

import { UiElement, visuallyHidden } from 'src/components/base.js';
import { typeRoles } from 'src/components/type-roles.js';
import { I18nController } from 'src/lib/i18n.js';
import { leafDescription } from 'src/lib/settings-leaf-copy.js';
import { ARCHETYPE, leafAction } from 'src/lib/settings-leaves.js';
import { TEMP_UNIT, toDisplayTemp, unitSymbol } from 'src/lib/temperature.js';
import 'src/components/ui-slider.js';
import { NO_READING } from 'src/data/reading.js';

import 'src/components/ui-settings-row.js';
import 'src/components/ui-stepper.js';
import 'src/components/ui-switch.js';
import 'src/components/ui-bank.js';
import 'src/components/ui-select.js';
import 'src/components/ui-button.js';
import 'src/components/ui-text-field.js';

const INERT_VALUE = () => '\u2013';
const FAHRENHEIT_SYMBOL = unitSymbol(TEMP_UNIT.FAHRENHEIT);

const READING_FORMATTERS = new Map();
function liveReadingFormat(word, unit) {
    const key = `live|${word}|${unit}`;
    let found = READING_FORMATTERS.get(key);
    if (!found) {
        found = (value) => `${word} ${Math.round(value)}${unit ? ` ${unit}` : ''}`;
        READING_FORMATTERS.set(key, found);
    }
    return found;
}

function measuredReadingFormat(label, unit, items, agrees) {
    const numeric = (items ?? []).filter((item) => Number.isFinite(Number(item.value)));
    const key = `measured|${label}|${unit}|${agrees}|${numeric.map((i) => `${i.value}:${i.label}`).join(',')}`;
    let found = READING_FORMATTERS.get(key);
    if (!found) {
        found = (value) => {
            const shown = `${label}: ${Math.round(value)}${unit ? ` ${unit}` : ''}`;
            if (numeric.length === 0) return shown;
            const nearest = numeric.reduce((best, item) => (
                Math.abs(Number(item.value) - value) < Math.abs(Number(best.value) - value) ? item : best
            ));
            return `${shown} \u2014 ${agrees} ${nearest.label}`;
        };
        READING_FORMATTERS.set(key, found);
    }
    return found;
}

function unitReadingFormat(unit) {
    const key = `unit|${unit}`;
    let found = READING_FORMATTERS.get(key);
    if (!found) {
        found = (value) => {
            const number = Number(value);
            if (!Number.isFinite(number)) return String(value);
            return `${number.toFixed(1)}${unit ? ` ${unit}` : ''}`;
        };
        READING_FORMATTERS.set(key, found);
    }
    return found;
}

export class SettingsLeaf extends UiElement {
    static properties = {
        /** The leaf id, from `settings-nav.js`. */
        leafId: { type: String, attribute: 'leaf-id' },

        /** The leaf's display name. Content, handed down; this element names nothing. */
        heading: { type: String },

        eyebrow: { type: String },

        /** `createSettingsLeafModel(...)`. Absent renders the leaf's heading and no rows. */
        model: { attribute: false },

        liveFeed: { attribute: false },

        /** Internal: the last snapshot frame, so one subscription repaints the readings. */
        _snapshot: { state: true },

        /** Internal: the model's change beacon, so one subscription re-renders the leaf. */
        _version: { state: true },
    };

    static styles = [visuallyHidden, typeRoles, css`
        :host {
            display: grid;
            gap: var(--ui-space-4);
            align-content: start;
            min-inline-size: 0;
        }

        #leaf-heading {
            margin: 0;
        }

        #leaf-title-block {
            display: grid;
            gap: var(--ui-space-1);
            min-inline-size: 0;
        }

        #leaf-eyebrow {
            margin: 0;
        }

        #leaf-head-row {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: var(--ui-space-5);
            min-inline-size: 0;

            min-block-size: var(--ui-control-h);
        }

        #leaf-restore {
            flex: none;
        }

        #leaf-rule {
            block-size: var(--ui-seam);
            margin: 0;
            border: 0;
            background-color: var(--ui-line);
        }

        /* THE SENTENCE. Prose, so it takes the prose measure rather than the row measure —
         * a description running the full width of a leaf would be the longest line on the
         * page and the hardest to read. */
        #leaf-desc {
            margin: 0;
            max-inline-size: var(--ui-measure);
            color: var(--ui-muted);
        }

        /* The note, and any other sentence a leaf's emptiness needs. Prose, so it
         * takes the prose measure rather than the form measure the pane sets. */
        #note {
            margin: 0;
            max-inline-size: var(--ui-measure);
        }

        ui-settings-row {
            display: flex;
        }

        ui-settings-row[data-staged]::after {
            content: "";
            align-self: center;
            flex: none;
            inline-size: var(--ui-space-2);
            block-size: var(--ui-space-2);
            margin-inline-start: var(--ui-space-2);
            border-radius: var(--ui-radius-pill);
            background: var(--ui-muted);
        }

        ui-settings-row > ui-text-field {
            inline-size: var(--ui-form-control-w);
        }

    `];

    #i18n = new I18nController(this);

    #controlWidth = 0;

    /** Held so `disconnectedCallback` can undo it — a screen that leaks one subscription
     *  per leaf change is S10 wearing a settings screen. */
    #unwatch = null;

    constructor() {
        super();
        this.leafId = '';
        this.heading = '';
        this.eyebrow = '';
        this.model = null;
        this.liveFeed = null;
        this._version = 0;
        this._snapshot = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this.#watch();
        this.#watchLive();
    }

    disconnectedCallback() {
        if (this.#frame) { cancelAnimationFrame(this.#frame); this.#frame = 0; }
        super.disconnectedCallback?.();
        this.#unwatch?.();
        this.#unwatch = null;
        this.#unfeed?.();
        this.#unfeed = null;
    }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('model')) this.#watch();
        if (changed.has('liveFeed')) this.#watchLive();
        if (changed.has('leafId') || changed.has('model')) this.#load();

        this.#measureControls();
        if (this.#controlWidth <= 0) {
            if (this.#frame) cancelAnimationFrame(this.#frame);
            this.#frame = requestAnimationFrame(() => {
                this.#frame = 0;
                this.#measureControls();
            });
        }
    }

    #watch() {
        this.#unwatch?.();
        this.#unwatch = null;
        if (!this.model || typeof this.model.subscribe !== 'function') return;
        this.#unwatch = this.model.subscribe((state) => { this._version = state.version; });
    }

    /** The live feed's unsubscribe, kept apart from the model's. */
    #unfeed = null;

    #watchLive() {
        this.#unfeed?.();
        this.#unfeed = null;
        const feed = this.liveFeed;
        if (!feed || typeof feed.subscribe !== 'function') return;
        this.#unfeed = feed.subscribe((state) => {
            const frame = state?.frame ?? null;
            if (this.#readingsMoved(frame)) this._snapshot = frame;
        });
    }

    /** True when a channel this leaf shows reads a different whole number. */
    #readingsMoved(frame) {
        const channels = (this.model?.rows?.(this.leafId) ?? [])
            .map((view) => view.live)
            .filter(Boolean);
        if (channels.length === 0) return false;
        const before = this._snapshot ?? null;
        return channels.some((channel) => {
            const was = Number(before?.[channel]);
            const now = Number(frame?.[channel]);
            if (!Number.isFinite(was) && !Number.isFinite(now)) return false;
            if (!Number.isFinite(was) || !Number.isFinite(now)) return true;
            return Math.round(was) !== Math.round(now);
        });
    }

    #load() {
        if (!this.model || !this.leafId) return;
        Promise.resolve(this.model.load(this.leafId)).catch(() => {});
    }

    render() {
        const t = this.#i18n.t;
        const rows = this.model ? this.model.rows(this.leafId) : [];
        const note = this.model ? this.model.note(this.leafId) : null;

        const desc = leafDescription(this.leafId);
        const restorable = this.model?.restorableRows?.(this.leafId)?.length ?? 0;
        /* THE PAGE'S OWN ACTION, if it has one. A registry lookup, not a branch: a leaf
         * gains one by being named in `LEAF_ACTIONS`, and this element still knows nothing
         * about what any of them do. */
        const action = leafAction(this.leafId);
        return html`
            <div id="leaf-head-row">
                <div id="leaf-title-block">
                    ${this.eyebrow
                        ? html`<p id="leaf-eyebrow" class="ui-microcap">${t(this.eyebrow)}</p>`
                        : nothing}
                    <h2 id="leaf-heading" class="ui-title">${t(this.heading)}</h2>
                </div>
                ${action
                    ? html`<ui-button
                        id="leaf-action"
                        data-action=${action.action}
                        @click=${() => this.#pageAction(action)}
                        >${t(action.label)}</ui-button
                    >`
                    : nothing}
                ${restorable > 0
                    ? html`<ui-button
                        id="leaf-restore"
                        @click=${this.#onRestore}
                        >${t('Restore defaults')}</ui-button
                    >`
                    : nothing}
            </div>

            <hr id="leaf-rule">
            ${desc ? html`<p id="leaf-desc" class="ui-body">${t(desc)}</p>` : nothing}
            ${note ? html`<p id="note" class="ui-caption">${t(note)}</p>` : nothing}
            ${rows.map((view) => this.#row(view))}
        `;
    }

    /**
     * ONE ROW SHAPE. Everything a leaf can say is a property of #29 — heading, hint,
     * caption, reading — and everything it can do is one control in the slot.
     */
    #measureControls() {
        const rows = this.renderRoot?.querySelectorAll?.('ui-settings-row');
        if (!rows || rows.length === 0) return;
        let widest = 0;
        for (const row of rows) {
            const control = row.shadowRoot?.getElementById?.('control');
            const width = control?.offsetWidth ?? 0;
            if (width > widest) widest = width;
        }
        if (widest <= 0) return;
        if (Math.abs(widest - this.#controlWidth) < 0.5) return;
        this.#controlWidth = widest;
        this.style.setProperty('--_ui-leaf-control-w', `${widest}px`);
    }

    /**
     * The pending frame, so a leaf swapped out mid-frame does not measure a tree it has
     * left.
     */
    #frame = 0;

    #onRestore = () => {
        Promise.resolve(this.model?.restoreDefaults?.(this.leafId)).catch(() => {});
    };

    #row(view) {
        const t = this.#i18n.t;
        return html`<ui-settings-row
            data-row=${view.id}
            data-archetype=${view.archetype}
            ?data-staged=${view.staged}
            heading=${t(view.heading)}
            hint=${view.hint}
            caption=${view.caption ? t(view.caption) : ''}
            note=${this.#note(view)}
            .reading=${this.#reading(view)}
            .readingFormat=${this.#readingFormat(view)}
        >${this.#control(view)}</ui-settings-row>`;
    }

    /** The formatter for whichever KIND of reading this row carries, or undefined. */
    #readingFormat(view) {
        const t = this.#i18n.t;
        if (view.live) return liveReadingFormat(t('now'), view.bounds?.unit ?? '');
        if (view.row.readingField) {
            return measuredReadingFormat(
                t(view.row.readingLabel ?? 'Measured'),
                view.row.readingUnit ?? '',
                this.#items(view),
                t('consistent with'),
            );
        }
        if (view.archetype === ARCHETYPE.READING && view.bounds?.unit) {
            return unitReadingFormat(view.bounds.unit);
        }
        return undefined;
    }

    #reading(view) {
        if (!view.live) return view.reading;
        if (view.inert || view.pending) return NO_READING;
        const value = Number(this._snapshot?.[view.live]);
        if (!Number.isFinite(value) || value <= 0) return NO_READING;
        return view.bounds?.unit === FAHRENHEIT_SYMBOL
            ? toDisplayTemp(value, TEMP_UNIT.FAHRENHEIT)
            : value;
    }

    #note(view) {
        const t = this.#i18n.t;
        return (view.notes ?? [])
            .map((note) => t(note))
            .join(' ');
    }

    #control(view) {
        const t = this.#i18n.t;
        const off = view.inert || view.pending;
        switch (view.archetype) {
            case ARCHETYPE.STEPPER:

                return html`<ui-stepper
                    data-row=${view.id}
                    editable
                    hint=${view.hint}
                    ?disabled=${off}
                    ?off=${off}
                    .format=${off ? INERT_VALUE : (view.bounds.format ?? undefined)}
                    .value=${view.value}
                    .min=${view.bounds.min}
                    .max=${view.bounds.max}
                    .step=${view.bounds.step}
                    unit=${view.bounds.unit}
                    .next=${view.bounds.next}
                    @change=${(event) => this.#write(view, event.detail?.value)}
                    @edit=${() => this.#edit(view)}
                ></ui-stepper>`;

            case ARCHETYPE.SWITCH:
                if (view.pending) {
                    return html`<ui-switch
                        pending
                        pending-label=${t('Not known')}
                    ></ui-switch>`;
                }
                return html`<ui-switch
                    ?checked=${view.checked}
                    ?disabled=${off}
                    @change=${(event) => this.#write(view, event.detail?.checked)}
                ></ui-switch>`;

            case ARCHETYPE.SLIDER:
                return html`<ui-slider
                    .min=${view.bounds?.min ?? 0}
                    .max=${view.bounds?.max ?? 100}
                    step=${String(view.bounds?.step ?? 1)}
                    .value=${Number(view.value)}
                    ?disabled=${off}
                    label=${t(view.heading)}
                    value-text=${`${view.value}${view.bounds?.unit ?? ''}`}
                    @change=${(event) => this.#write(view, Number(event.target?.value))}
                ></ui-slider>`;

            case ARCHETYPE.BANK:
                return html`<ui-bank
                    .items=${this.#items(view)}
                    value=${off ? '' : (view.value ?? '')}
                    ?disabled=${off}
                    @change=${(event) => this.#write(view, this.#choose(view, event.detail?.value))}
                ></ui-bank>`;

            case ARCHETYPE.SELECT:
                return html`<ui-select
                    .options=${this.#items(view)}
                    value=${String(view.value ?? '')}
                    ?disabled=${off}
                    @change=${(event) => this.#write(view, this.#choose(view, event.detail?.value))}
                ></ui-select>`;

            case ARCHETYPE.BUTTON:
                return html`<ui-button
                    @click=${() => this.#act(view)}
                >${t(view.row.control ?? view.heading)}</ui-button>`;

            case ARCHETYPE.TEXT:
                return html`<ui-text-field
                    hide-label
                    .value=${view.value ?? ''}
                    @change=${(event) => this.#write(view, event.target?.value)}
                ></ui-text-field>`;

            /* READING — no control at all, which is a shipped state of #29 rather than
             * a missing one: the row renders its heading, its caption and its reading,
             * and the slot stays empty. */
            default:
                return nothing;
        }
    }

    #items(view) {
        const t = this.#i18n.t;
        return (view.items ?? []).map((item) => (item.disabled
            ? { value: item.value, label: t(item.label), disabled: true }
            : { value: item.value, label: t(item.label) }));
    }

    #choose(view, announced) {
        const item = (view.items ?? []).find((choice) => String(choice.value) === String(announced));
        return item ? item.value : announced;
    }

    #write(view, value) {
        if (value === undefined || !this.model) return;
        Promise.resolve(this.model.set(view.row, value))
            .then((result) => {
                this.dispatchEvent(new CustomEvent('leaf-change', {
                    detail: { row: view.id, value, ok: result?.ok !== false, staged: Boolean(result?.staged) },
                    bubbles: true,
                    composed: true,
                }));
            })
            .catch(() => {});
    }

    #edit(view) {
        this.dispatchEvent(new CustomEvent('leaf-edit', {
            detail: { row: view.id, leaf: this.leafId, value: view.value },
            bubbles: true,
            composed: true,
        }));
    }

    #act(view) {
        this.dispatchEvent(new CustomEvent('leaf-action', {
            detail: { action: view.row.action, row: view.id, leaf: this.leafId },
            bubbles: true,
            composed: true,
        }));
    }

    #pageAction(action) {
        this.dispatchEvent(new CustomEvent('leaf-action', {
            detail: { action: action.action, row: null, leaf: this.leafId },
            bubbles: true,
            composed: true,
        }));
    }
}

customElements.define('settings-leaf', SettingsLeaf);
