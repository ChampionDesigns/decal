/**
 *.
 */

import { css, html, svg } from 'lit';
import { UiElement } from 'src/components/base.js';
import { seams } from 'src/components/seams.js';
import { I18nController } from 'src/lib/i18n.js';
import 'src/components/ui-button.js';

/** The event a screen listens for. One name, one detail - a press control that needs
 *  a bespoke event per key is one every consumer has to learn five times. */
export const STEP_ACTION = 'step-action';

export const ACTION_KEYS = Object.freeze([
    Object.freeze({ action: 'move-left', label: 'Move step left', ink: 'neutral', edge: 'first' }),
    Object.freeze({ action: 'delete', label: 'Delete step', ink: 'danger', edge: null, minCount: 2 }),
    Object.freeze({ action: 'insert-after', label: 'Insert step after', ink: 'accent', edge: null }),
    Object.freeze({ action: 'duplicate', label: 'Duplicate step', ink: 'neutral', edge: null }),
    Object.freeze({ action: 'move-right', label: 'Move step right', ink: 'neutral', edge: 'last' }),
]);

const GLYPHS = Object.freeze({
    'move-left': svg`<polyline points="15 18 9 12 15 6"/>`,
    delete: svg`<polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6M14 11v6"/>
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>`,
    'insert-after': svg`<path d="M12 5v14M5 12h14"/>`,
    duplicate: svg`<rect x="9" y="9" width="11" height="11" rx="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`,
    'move-right': svg`<polyline points="9 18 15 12 9 6"/>`,
});

const STROKE = Object.freeze({
    'move-left': '2.5',
    delete: '2',
    'insert-after': '2.5',
    duplicate: '2',
    'move-right': '2.5',
});

export class UiActionKeyRail extends UiElement {
    static properties = {
        /** The step's 0-based position. Disables `move-left` at 0. */
        index: { type: Number, reflect: true },
        /** How many steps the profile has. Disables `move-right` at index === count-1. */
        count: { type: Number, reflect: true },
        /** Accessible name for the group. Defaults to a translated "Step actions". */
        label: { type: String },
        /** Whole rail unavailable: every key dimmed by the one dial and refused. */
        disabled: { type: Boolean, reflect: true },
    };

    static styles = [seams, css`
        :host {
            --_ui-key-rail-keys: 5;
        }

        .rail {
            box-sizing: border-box;

            inline-size: 100%;
            min-inline-size: calc(
                var(--_ui-key-rail-keys) * var(--ui-control-h)
                + (var(--_ui-key-rail-keys) - 1) * var(--ui-seam)
                + 2 * var(--ui-border-w));

            grid-auto-flow: column;
            grid-auto-columns: minmax(0, 1fr);
            align-items: stretch;

            border: var(--ui-border-w) solid var(--ui-line);
            border-radius: var(--ui-radius);

            overflow: hidden;
        }

        .cell {
            display: grid;
        }

        .glyph {
            display: block;
            flex: none;
            inline-size: var(--ui-icon);
            block-size: var(--ui-icon);
            color: var(--ui-muted);
        }

        .glyph-accent {
            color: var(--ui-steel);
        }

        .glyph-danger {
            color: color-mix(in srgb, var(--ui-status-danger) 72%, var(--ui-muted));
        }
    `];

    constructor() {
        super();
        this.index = 0;
        this.count = 1;
        this.label = '';
        this.disabled = false;
        this.i18n = new I18nController(this);
    }

    /** The group's accessible name. */
    get groupLabel() {
        return this.label || this.i18n.t('Step actions');
    }

    keyDisabled(key) {
        if (this.disabled) return true;
        const count = Number.isFinite(this.count) ? this.count : 1;
        const index = Number.isFinite(this.index) ? this.index : 0;
        if (Number.isFinite(key.minCount) && count < key.minCount) return true;
        if (key.edge === 'first') return index <= 0;
        if (key.edge === 'last') return index >= count - 1;
        return false;
    }

    /** The rendered <ui-button> for one action id - what a test and a screen focus. */
    keyElement(action) {
        return this.renderRoot?.querySelector?.(`#key-${action}`) ?? null;
    }

    #press = (event) => {
        const action = event.currentTarget?.dataset?.action;
        if (!action) return;
        this.dispatchEvent(new CustomEvent(STEP_ACTION, {
            bubbles: true,
            composed: true,
            cancelable: true,
            detail: { action, index: this.index, count: this.count },
        }));
    };

    #renderKey(key) {
        const inkClass = key.ink === 'neutral' ? '' : ` glyph-${key.ink}`;
        return html`<div class="cell seam-cell"><ui-button
            id="key-${key.action}"
            variant="ghost"
            focus-ring="inset"
            data-action=${key.action}
            label=${this.i18n.t(key.label)}
            ?disabled=${this.keyDisabled(key)}
            @click=${this.#press}
        ><svg
            class="glyph${inkClass}"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width=${STROKE[key.action]}
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >${GLYPHS[key.action]}</svg></ui-button></div>`;
    }

    render() {
        return html`<div id="rail" class="rail seam-grid seam-cols seam-line"
            role="group" aria-label=${this.groupLabel}
        >${ACTION_KEYS.map((key) => this.#renderKey(key))}</div>`;
    }
}

customElements.define('ui-action-key-rail', UiActionKeyRail);
